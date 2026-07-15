// ════════════════════════════════════════════════════════════════════
// PHASE-2B-DIAGNOSE (V1–V3) für SYSTEM_DIAGNOSE.md
// NUR LESEND — ausschließlich SELECT, keine Schreiboperationen.
// Aufruf: npx tsx scripts/diagnose-phase2b.ts
// ════════════════════════════════════════════════════════════════════
import "dotenv/config";
import { appendFileSync, writeFileSync } from "fs";
import postgres from "postgres";

const sql = postgres(process.env.DATABASE_URL!, { ssl: "require", max: 1 });
const OUT = "/tmp/diagnose-2b.txt";
writeFileSync(OUT, `Phase-2B-Diagnose ${new Date().toISOString()}\n`);

function log(...args: any[]) {
  const line = args.map((a) => (typeof a === "string" ? a : JSON.stringify(a, null, 1))).join(" ");
  console.log(line);
  appendFileSync(OUT, line + "\n");
}

async function main() {
  // ═══ V1 — Stichtag: Wer würde ohne Stichtag leer ausgehen? ═══
  log("\n═══ V1 — Offene Bestellungen mit Agent, aber OHNE dokumentiertes Kontakt-Ergebnis ═══");
  const [v1] = await sql`
    SELECT COUNT(*)::int AS total,
           COUNT(*) FILTER (WHERE NOT EXISTS (
             SELECT 1 FROM fiaon_contact_log c
             WHERE c.ref = a.ref AND c.agent_id IS NOT NULL AND c.voided_at IS NULL
               AND c.type IN ('result', 'email_sent')
           ) AND NOT EXISTS (
             SELECT 1 FROM fiaon_lead_log g
             JOIN fiaon_leads l ON l.id = g.lead_id
             WHERE l.converted_order_id = a.ref AND g.agent_id IS NOT NULL
               AND g.type IN ('result', 'email_sent')
           ))::int AS ohne_doku
    FROM fiaon_applications a
    WHERE a.payment_status IN ('pending_payment', 'claimed_paid')
      AND a.merged_into IS NULL AND a.assigned_agent_id IS NOT NULL
  `;
  log("V1.1 offene/angekündigte Bestellungen mit Agent:", v1);
  const v1b = await sql`
    SELECT ag.name, COUNT(*)::int AS betroffen
    FROM fiaon_applications a
    JOIN fiaon_agents ag ON ag.id = a.assigned_agent_id
    WHERE a.payment_status IN ('pending_payment', 'claimed_paid')
      AND a.merged_into IS NULL
      AND NOT EXISTS (
        SELECT 1 FROM fiaon_contact_log c
        WHERE c.ref = a.ref AND c.agent_id IS NOT NULL AND c.voided_at IS NULL
          AND c.type IN ('result', 'email_sent'))
      AND NOT EXISTS (
        SELECT 1 FROM fiaon_lead_log g JOIN fiaon_leads l ON l.id = g.lead_id
        WHERE l.converted_order_id = a.ref AND g.agent_id IS NOT NULL
          AND g.type IN ('result', 'email_sent'))
    GROUP BY ag.name ORDER BY betroffen DESC
  `;
  log("V1.2 betroffene Agenten (würden ohne Stichtag leer ausgehen):", v1b);

  // ═══ V2 — Leads ohne Kontaktdaten in der Warteschlange ═══
  log("\n═══ V2 — Leads ohne Telefon UND ohne E-Mail (gehören nicht in die Queue) ═══");
  const [v2] = await sql`
    SELECT COUNT(*)::int AS offene_leads,
           COUNT(*) FILTER (WHERE COALESCE(telefon,'') = '' AND COALESCE(email,'') = '')::int AS ohne_kontaktdaten,
           COUNT(*) FILTER (WHERE COALESCE(telefon,'') = '' AND COALESCE(email,'') <> '')::int AS nur_email,
           COUNT(*) FILTER (WHERE COALESCE(telefon,'') <> '')::int AS mit_telefon
    FROM fiaon_leads WHERE status IN ('neu', 'kontaktiert', 'nicht_erreichbar')
  `;
  log("V2.1 offene Leads nach Kontaktdaten:", v2);
  const v2b = await sql`
    SELECT COUNT(*)::int AS offene_akten,
           COUNT(*) FILTER (WHERE opened_at < NOW() - INTERVAL '30 minutes')::int AS aelter_30min
    FROM fiaon_leads
    WHERE opened_at IS NOT NULL AND status IN ('neu', 'kontaktiert', 'nicht_erreichbar')
  `.catch((e) => [{ offene_akten: `Spalte fehlt noch (Migration steht aus): ${e.message}` }] as any);
  log("V2.2 aktuell offene Akten:", v2b[0]);

  // ═══ V3 — Grenzfall-Daten ═══
  log("\n═══ V3 — Grenzfall-Daten ═══");
  const [v3a] = await sql`
    SELECT COUNT(*)::int AS link_versand_agent
    FROM fiaon_lead_log WHERE type = 'email_sent' AND agent_id IS NOT NULL
  `;
  log("V3.5 dokumentierte Link-/Mail-Versände durch Agenten (lead_log):", v3a);
  const [v3b] = await sql`
    SELECT COUNT(*)::int AS dubletten_familien
    FROM (
      SELECT LOWER(email) FROM fiaon_applications
      WHERE merged_into IS NULL AND email IS NOT NULL AND email <> ''
      GROUP BY LOWER(email) HAVING COUNT(*) > 1
    ) x
  `;
  log("V3.6 E-Mail-Familien mit mehreren Bestellungen (Dubletten-Attribution relevant):", v3b);

  // ═══ V4-Vorschau — offene Bank-Eingänge (Rematch-Kandidaten) ═══
  log("\n═══ V4 — offene Bank-Eingänge (Rematch-Kandidaten) ═══");
  const [v4] = await sql`
    SELECT COUNT(*)::int AS offen FROM fiaon_bank_txns
    WHERE match_status = 'unmatched' AND applied = FALSE
  `.catch(() => [{ offen: "Tabelle fehlt" }] as any);
  log("V4.1 unzugeordnete Eingänge:", v4);

  // Stichtag-Setting vorhanden?
  const cut = await sql`SELECT value FROM fiaon_settings WHERE key = 'commission_cutoff_at'`.catch(() => []);
  log("\nV1.3 Setting commission_cutoff_at:", cut.length ? cut[0].value : "NICHT GESETZT");

  await sql.end();
  log("\nFertig. Rohausgabe: " + OUT);
}

main().catch((e) => { console.error(e); process.exit(1); });
