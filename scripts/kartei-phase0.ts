/**
 * ═══════════════════════════════════════════════════════════════════
 * PHASE 0 — BESTANDSAUFNAHME FÜR DIE OFFENE KUNDEN-KARTEI
 * ═══════════════════════════════════════════════════════════════════
 *
 * NUR LESEND. Kein UPDATE, kein DELETE, keine Mail, kein Webhook.
 * Liefert die Zahlen, die vor dem Umbau feststehen müssen:
 *
 *   1. Wie viele Leads/Kunden sind wem zugewiesen?
 *   2. Davon wie viele OHNE jeden dokumentierten Kontakt? (→ Migrationsmenge)
 *   3. Dubletten-Risiko: dieselbe Person als Lead UND als Antrag.
 *   4. Welche Agenten haben das Onboarding (Zustimmung + Vertrag) abgeschlossen?
 *   5. Wie groß wäre die freie Kartei nach der Migration?
 *
 * Verwendung:  npx tsx scripts/kartei-phase0.ts
 *              npx tsx scripts/kartei-phase0.ts --md   (Markdown für SYSTEM_DIAGNOSE.md)
 */

import "dotenv/config";
import postgres from "postgres";

if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL fehlt.");
  process.exit(2);
}
const sql = postgres(process.env.DATABASE_URL, { ssl: "require", max: 3 });

const MD = process.argv.includes("--md");

/** Offene Lead-Status — nur diese stehen überhaupt zur Bearbeitung an. */
const OPEN_LEAD_STATUS = ["neu", "kontaktiert", "nicht_erreichbar"];
/** Offene Bestellungen — nur diese sind Arbeitsvorrat. */
const OPEN_PAYMENT_STATUS = ["pending_payment", "claimed_paid"];

interface AgentStock {
  agent_id: number | null;
  agent_name: string;
  leads_total: number;
  leads_ohne_kontakt: number;
  kunden_total: number;
  kunden_ohne_kontakt: number;
}

/**
 * „Dokumentierter Kontakt" = mindestens ein nicht-widerrufener Log-Eintrag vom
 * Typ `result` (Kontakt-Ergebnis) ODER `note` (Notiz) ODER `email_sent`.
 * Bewusst NICHT: `claim`/`system` — eine bloße Übernahme oder eine System-Zeile
 * ist keine Betreuung (genau die Unterscheidung, die Phase 2 für die Provision
 * trifft). Ebenfalls NICHT: automatische `followup`-Mails der Engine.
 */
const CONTACT_TYPES = ["result", "note", "email_sent"];

async function leadStock(): Promise<Map<number | null, { total: number; ohne: number }>> {
  const rows = await sql`
    SELECT l.assigned_agent_id AS agent_id,
           COUNT(*)::int AS total,
           COUNT(*) FILTER (WHERE NOT EXISTS (
             SELECT 1 FROM fiaon_lead_log g
             WHERE g.lead_id = l.id AND g.type = ANY(${CONTACT_TYPES})
           ))::int AS ohne
    FROM fiaon_leads l
    WHERE l.status = ANY(${OPEN_LEAD_STATUS})
      AND l.dismissed_at IS NULL
    GROUP BY l.assigned_agent_id
  `;
  return new Map(rows.map((r: any) => [r.agent_id === null ? null : Number(r.agent_id), { total: r.total, ohne: r.ohne }]));
}

async function customerStock(): Promise<Map<number | null, { total: number; ohne: number }>> {
  const rows = await sql`
    SELECT a.assigned_agent_id AS agent_id,
           COUNT(*)::int AS total,
           COUNT(*) FILTER (WHERE NOT EXISTS (
             SELECT 1 FROM fiaon_contact_log c
             WHERE c.ref = a.ref AND c.type = ANY(${CONTACT_TYPES}) AND c.voided_at IS NULL
           ))::int AS ohne
    FROM fiaon_applications a
    WHERE a.payment_status = ANY(${OPEN_PAYMENT_STATUS})
      AND a.merged_into IS NULL
      AND a.dismissed_at IS NULL
    GROUP BY a.assigned_agent_id
  `;
  return new Map(rows.map((r: any) => [r.agent_id === null ? null : Number(r.agent_id), { total: r.total, ohne: r.ohne }]));
}

async function agents(): Promise<{ id: number; name: string; active: boolean }[]> {
  const rows = await sql`SELECT id, name, active FROM fiaon_agents ORDER BY id ASC`;
  return rows.map((r: any) => ({ id: Number(r.id), name: r.name, active: !!r.active }));
}

/** Onboarding: Zustimmung zu allen Dokumenten + signierter Vertrag der AKTIVEN Version. */
async function onboardingStatus(): Promise<Map<number, { consents: number; signed: boolean }>> {
  const out = new Map<number, { consents: number; signed: boolean }>();
  const consents = await sql`
    SELECT agent_id, COUNT(DISTINCT doc_key)::int AS c FROM fiaon_agent_consents GROUP BY agent_id
  `;
  for (const r of consents) out.set(Number(r.agent_id), { consents: r.c, signed: false });
  const active = await sql`SELECT version FROM fiaon_contract_templates WHERE status = 'active' LIMIT 1`;
  if (active.length > 0) {
    const signed = await sql`
      SELECT DISTINCT agent_id FROM fiaon_agent_contracts
      WHERE status = 'signed' AND template_version = ${active[0].version}
    `;
    for (const r of signed) {
      const cur = out.get(Number(r.agent_id)) || { consents: 0, signed: false };
      cur.signed = true;
      out.set(Number(r.agent_id), cur);
    }
  }
  return out;
}

/** Dubletten-Risiko: Person existiert gleichzeitig als offener Lead UND offener Antrag. */
async function duplicateRisk(): Promise<{ perEmail: number; perPhone: number; appPairs: number }> {
  const [byEmail] = await sql`
    SELECT COUNT(DISTINCT LOWER(TRIM(l.email)))::int AS c
    FROM fiaon_leads l
    JOIN fiaon_applications a
      ON LOWER(TRIM(a.email)) = LOWER(TRIM(l.email))
    WHERE l.status = ANY(${OPEN_LEAD_STATUS}) AND l.dismissed_at IS NULL
      AND COALESCE(l.email, '') <> ''
      AND a.merged_into IS NULL AND a.dismissed_at IS NULL
  `;
  const [byPhone] = await sql`
    SELECT COUNT(DISTINCT RIGHT(REGEXP_REPLACE(l.telefon, '\\D', '', 'g'), 9))::int AS c
    FROM fiaon_leads l
    JOIN fiaon_applications a
      ON RIGHT(REGEXP_REPLACE(a.phone, '\\D', '', 'g'), 9) = RIGHT(REGEXP_REPLACE(l.telefon, '\\D', '', 'g'), 9)
    WHERE l.status = ANY(${OPEN_LEAD_STATUS}) AND l.dismissed_at IS NULL
      AND LENGTH(REGEXP_REPLACE(COALESCE(l.telefon, ''), '\\D', '', 'g')) >= 9
      AND a.merged_into IS NULL AND a.dismissed_at IS NULL
  `;
  const [appPairs] = await sql`
    SELECT COUNT(*)::int AS c FROM (
      SELECT LOWER(TRIM(email)) AS e
      FROM fiaon_applications
      WHERE merged_into IS NULL AND COALESCE(email, '') <> ''
      GROUP BY 1 HAVING COUNT(*) > 1
    ) t
  `;
  return { perEmail: Number(byEmail.c), perPhone: Number(byPhone.c), appPairs: Number(appPairs.c) };
}

/** Selbstzahler-Kontrolle: bezahlte/gemergte Datensätze dürfen nie in der Kartei liegen. */
async function exitStates(): Promise<Record<string, number>> {
  const [r] = await sql`
    SELECT
      COUNT(*) FILTER (WHERE payment_status = 'paid')::int AS bezahlt,
      COUNT(*) FILTER (WHERE merged_into IS NOT NULL)::int AS gemergt,
      COUNT(*) FILTER (WHERE dismissed_at IS NOT NULL)::int AS aussortiert,
      COUNT(*) FILTER (WHERE payment_status = 'expired')::int AS abgelaufen
    FROM fiaon_applications
  `;
  return { bezahlt: r.bezahlt, gemergt: r.gemergt, aussortiert: r.aussortiert, abgelaufen: r.abgelaufen };
}

function table(headers: string[], rows: (string | number)[][]): string {
  if (MD) {
    const out = [`| ${headers.join(" | ")} |`, `| ${headers.map(() => "---").join(" | ")} |`];
    for (const r of rows) out.push(`| ${r.join(" | ")} |`);
    return out.join("\n");
  }
  const widths = headers.map((h, i) => Math.max(h.length, ...rows.map((r) => String(r[i]).length)));
  const line = (cells: (string | number)[]) => cells.map((c, i) => String(c).padEnd(widths[i])).join("  ");
  return [line(headers), widths.map((w) => "-".repeat(w)).join("  "), ...rows.map(line)].join("\n");
}

async function main(): Promise<void> {
  const [ags, leads, customers, onboard, dupes, exits] = await Promise.all([
    agents(),
    leadStock(),
    customerStock(),
    onboardingStatus(),
    duplicateRisk(),
    exitStates(),
  ]);

  const stock: AgentStock[] = [];
  for (const a of ags) {
    const l = leads.get(a.id) || { total: 0, ohne: 0 };
    const c = customers.get(a.id) || { total: 0, ohne: 0 };
    if (l.total === 0 && c.total === 0) continue;
    stock.push({
      agent_id: a.id,
      agent_name: `${a.name}${a.active ? "" : " (inaktiv)"}`,
      leads_total: l.total,
      leads_ohne_kontakt: l.ohne,
      kunden_total: c.total,
      kunden_ohne_kontakt: c.ohne,
    });
  }
  const freeL = leads.get(null) || { total: 0, ohne: 0 };
  const freeC = customers.get(null) || { total: 0, ohne: 0 };

  console.log(MD ? "### 0.3 Bestandsaufnahme je Agent (Migrationsgrundlage)\n" : "\n=== BESTAND JE AGENT ===\n");
  console.log(
    table(
      ["Agent", "Leads gesamt", "davon ohne Kontakt", "Kunden gesamt", "davon ohne Kontakt", "bleibt beim Agenten", "zurück in die Kartei"],
      stock.map((s) => [
        s.agent_name,
        s.leads_total,
        s.leads_ohne_kontakt,
        s.kunden_total,
        s.kunden_ohne_kontakt,
        s.leads_total - s.leads_ohne_kontakt + (s.kunden_total - s.kunden_ohne_kontakt),
        s.leads_ohne_kontakt + s.kunden_ohne_kontakt,
      ]),
    ),
  );

  const sumBack = stock.reduce((n, s) => n + s.leads_ohne_kontakt + s.kunden_ohne_kontakt, 0);
  const sumKeep = stock.reduce((n, s) => n + (s.leads_total - s.leads_ohne_kontakt) + (s.kunden_total - s.kunden_ohne_kontakt), 0);

  console.log(MD ? "\n### 0.4 Freie Kartei nach der Migration\n" : "\n=== FREIE KARTEI NACH MIGRATION ===\n");
  console.log(
    table(
      ["Herkunft", "Anzahl"],
      [
        ["Heute schon unzugewiesen (Leads)", freeL.total],
        ["Heute schon unzugewiesen (Kunden)", freeC.total],
        ["Rückläufer aus der Migration (ohne dokumentierten Kontakt)", sumBack],
        ["**Freie Kartei gesamt**", freeL.total + freeC.total + sumBack],
        ["Bleibt fest bei den Agenten (dokumentierte Betreuung)", sumKeep],
      ],
    ),
  );

  console.log(MD ? "\n### 0.5 Onboarding-Status (Kartei-Zugang)\n" : "\n=== ONBOARDING ===\n");
  console.log(
    table(
      ["Agent", "aktiv", "Zustimmungen", "Vertrag signiert (aktive Version)", "Kartei-Zugang"],
      ags.map((a) => {
        const o = onboard.get(a.id) || { consents: 0, signed: false };
        const ok = o.signed && o.consents > 0;
        return [a.name, a.active ? "ja" : "nein", o.consents, o.signed ? "ja" : "nein", ok && a.active ? "JA" : "NEIN"];
      }),
    ),
  );

  console.log(MD ? "\n### 0.6 Dubletten-Risiko (eine Person = eine Karte)\n" : "\n=== DUBLETTEN-RISIKO ===\n");
  console.log(
    table(
      ["Prüfung", "Treffer", "Bedeutung"],
      [
        ["Offener Lead + Antrag mit gleicher E-Mail", dupes.perEmail, "würde OHNE Merge zwei Karten erzeugen"],
        ["Offener Lead + Antrag mit gleicher Telefonnummer (letzte 9 Ziffern)", dupes.perPhone, "dito, greift bei fehlender E-Mail"],
        ["Anträge mit mehrfach genutzter E-Mail (nicht gemergt)", dupes.appPairs, "Mehrfach-Karten innerhalb der Anträge"],
      ],
    ),
  );

  console.log(MD ? "\n### 0.7 Zustände, die die Kartei verlassen müssen\n" : "\n=== AUSTRITTS-ZUSTÄNDE ===\n");
  console.log(
    table(
      ["Zustand", "Anzahl", "Regel"],
      [
        ["bezahlt", exits.bezahlt, "verlässt die Kartei sofort (Direktzahler-Regel)"],
        ["gemergt", exits.gemergt, "verlässt die Kartei (Gewinner-Datensatz bleibt)"],
        ["aussortiert", exits.aussortiert, "verlässt die Kartei, Admin kann zurückholen"],
        ["abgelaufen", exits.abgelaufen, "bleibt beim betreuenden Agenten sichtbar"],
      ],
    ),
  );

  await sql.end();
}

main().catch(async (err) => {
  console.error("Phase-0-Report fehlgeschlagen:", err);
  await sql.end().catch(() => {});
  process.exit(1);
});
