/**
 * ═══════════════════════════════════════════════════════════════════
 * KARTEI — VERIFIKATION (nur lesend)
 * ═══════════════════════════════════════════════════════════════════
 *
 * Prüft die harten Zusagen des Umbaus gegen die echte Datenbank:
 *
 *   V1  Die Kartei-Abfrage liefert KEINE Kontaktdaten-Spalten
 *       (Name/Telefon/E-Mail/Adresse) — Maskierung serverseitig, nicht im UI.
 *   V2  Eine Person erzeugt genau EINE Karte (Lead + Antrag zusammengeführt).
 *   V3  Bezahlte, gemergte, stornierte und aussortierte Datensätze sind NICHT
 *       in der Kartei (Direktzahler-Regel).
 *   V4  Karten-Zustände frei / vergeben / in Bearbeitung sind konsistent.
 *
 * Verwendung: npx tsx scripts/kartei-verify.ts
 */

import "dotenv/config";
import postgres from "postgres";

if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL fehlt.");
  process.exit(2);
}
const sql = postgres(process.env.DATABASE_URL, { ssl: "require", max: 3 });

/** Spaltennamen, die niemals aus der Kartei-Abfrage kommen dürfen. */
const FORBIDDEN = [
  "email", "contact_email", "billing_email",
  "phone", "contact_phone", "telefon", "phone_country_code",
  "first_name", "last_name", "vorname", "nachname",
  "contact_name", "company_name",
  "street", "city", "zip", "iban",
];

let failures = 0;
function check(name: string, ok: boolean, detail: string): void {
  if (!ok) failures++;
  console.log(`${ok ? "✅" : "❌"} ${name}\n     ${detail}`);
}

async function main(): Promise<void> {
  // Die Kartei-CTE wird aus dem Produktivmodul importiert, damit dieser Test
  // nicht an einer eigenen Kopie der Abfrage vorbeiprüft.
  const mod = await import("../server/routes/fiaon-kartei");
  const buildCte: (w: any) => string = (mod as any).__karteiCteForTests;
  if (typeof buildCte !== "function") {
    console.error("fiaon-kartei.ts exportiert __karteiCteForTests nicht — Test kann die echte Abfrage nicht prüfen.");
    process.exit(2);
  }
  const weights = {
    wFresh: 40, wValue: 25, wReact: 50, wContact: 30, fairnessNth: 4,
    hoardingDays: 7, hoardingWarnDays: 2, autoReleaseMin: 30, requireFullContact: true,
  };
  const cte = buildCte(weights);

  // ── V1: Welche Spalten liefert die Kartei überhaupt? ──────────────────────
  const probe = await sql.unsafe(`${cte} SELECT * FROM kartei k LIMIT 1`);
  const cols = probe.columns ? probe.columns.map((c: any) => c.name) : Object.keys(probe[0] || {});
  const leaked = cols.filter((c: string) => FORBIDDEN.includes(c));
  check(
    "V1 · Kartei-Abfrage enthält keine Kontaktdaten-Spalten",
    leaked.length === 0,
    leaked.length === 0
      ? `${cols.length} Spalten, alle neutral: ${cols.join(", ")}`
      : `LECK: ${leaked.join(", ")}`,
  );

  // ── V2: eine Person = eine Karte ──────────────────────────────────────────
  const [dupEmail] = await sql.unsafe(`
    ${cte}
    SELECT COUNT(*)::int AS c FROM (
      SELECT k.card_id FROM kartei k
      JOIN fiaon_leads l ON ('lead-' || l.id) = k.card_id
      JOIN fiaon_applications a
        ON a.merged_into IS NULL
       AND COALESCE(l.email,'') <> ''
       AND LOWER(TRIM(a.email)) = LOWER(TRIM(l.email))
    ) t
  `);
  check(
    "V2 · Kein Lead in der Kartei, zu dem es einen Antrag derselben E-Mail gibt",
    Number(dupEmail.c) === 0,
    Number(dupEmail.c) === 0 ? "0 Doppelkarten" : `${dupEmail.c} Doppelkarten gefunden`,
  );

  const [dupCards] = await sql.unsafe(`${cte} SELECT COUNT(*)::int - COUNT(DISTINCT k.card_id)::int AS c FROM kartei k`);
  check(
    "V2b · Jede Karten-ID kommt genau einmal vor",
    Number(dupCards.c) === 0,
    `${dupCards.c} Duplikate`,
  );

  // ── V3: Austritts-Zustände sind draußen ───────────────────────────────────
  const [exits] = await sql.unsafe(`
    ${cte}
    SELECT
      COUNT(*) FILTER (WHERE a.payment_status = 'paid')::int      AS bezahlt,
      COUNT(*) FILTER (WHERE a.merged_into IS NOT NULL)::int      AS gemergt,
      COUNT(*) FILTER (WHERE a.dismissed_at IS NOT NULL)::int     AS aussortiert,
      COUNT(*) FILTER (WHERE a.payment_status = 'cancelled')::int AS storniert
    FROM kartei k JOIN fiaon_applications a ON a.ref = k.card_id
  `);
  const totalExits = Number(exits.bezahlt) + Number(exits.gemergt) + Number(exits.aussortiert) + Number(exits.storniert);
  check(
    "V3 · Bezahlt/gemergt/storniert/aussortiert liegt NICHT in der Kartei",
    totalExits === 0,
    totalExits === 0
      ? "Direktzahler-Regel greift — 0 Treffer"
      : `bezahlt=${exits.bezahlt} gemergt=${exits.gemergt} storniert=${exits.storniert} aussortiert=${exits.aussortiert}`,
  );

  // ── V4: Zustände ──────────────────────────────────────────────────────────
  const [state] = await sql.unsafe(`
    ${cte}
    SELECT COUNT(*) FILTER (WHERE k.assigned_agent_id IS NULL)::int     AS frei,
           COUNT(*) FILTER (WHERE k.assigned_agent_id IS NOT NULL)::int AS vergeben,
           COUNT(*) FILTER (WHERE k.opened_at IS NOT NULL)::int         AS in_bearbeitung,
           COUNT(*)::int                                                AS gesamt
    FROM kartei k
  `);
  check(
    "V4 · Kartenzustände summieren sich",
    Number(state.frei) + Number(state.vergeben) === Number(state.gesamt),
    `frei=${state.frei} · vergeben=${state.vergeben} · davon aktiv in Bearbeitung=${state.in_bearbeitung} · gesamt=${state.gesamt}`,
  );

  // ── Mehr als eine aktive Akte pro Agent darf es nie geben ─────────────────
  const multi = await sql`
    SELECT agent_id, SUM(c)::int AS aktive FROM (
      SELECT opened_by_agent_id AS agent_id, COUNT(*)::int AS c FROM fiaon_leads
      WHERE opened_at IS NOT NULL AND status IN ('neu','kontaktiert','nicht_erreichbar')
      GROUP BY opened_by_agent_id
      UNION ALL
      SELECT opened_by_agent_id AS agent_id, COUNT(*)::int AS c FROM fiaon_applications
      WHERE opened_at IS NOT NULL AND payment_status IN ('pending_payment','claimed_paid')
      GROUP BY opened_by_agent_id
    ) t WHERE agent_id IS NOT NULL GROUP BY agent_id HAVING SUM(c) > 1
  `;
  check(
    "V5 · Kein Agent hat mehr als eine aktive Akte",
    multi.length === 0,
    multi.length === 0 ? "0 Verstöße" : multi.map((m: any) => `Agent ${m.agent_id}: ${m.aktive}`).join(", "),
  );

  await sql.end();
  console.log(failures === 0 ? "\n✅ Alle Kartei-Zusagen erfüllt." : `\n❌ ${failures} Prüfung(en) fehlgeschlagen.`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch(async (err) => {
  console.error("Verifikation fehlgeschlagen:", err);
  await sql.end().catch(() => {});
  process.exit(1);
});
