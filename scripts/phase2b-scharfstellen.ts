// ════════════════════════════════════════════════════════════════════
// PHASE 2B (V1) — Provisionsregel SCHARFSTELLEN (einmalig, NACH dem Deploy).
//
//   npx tsx scripts/phase2b-scharfstellen.ts            → zeigt Status (nur lesen)
//   npx tsx scripts/phase2b-scharfstellen.ts --write    → setzt Stichtag = JETZT
//
// Wirkung: Bestellungen, die VOR dem Stichtag erstellt wurden, laufen nach dem
// ALTEN Modell (Zuweisung genügt). Erst Bestellungen AB Stichtag brauchen
// dokumentierte Betreuung (P2-B). Bereits gebuchte Provisionen bleiben unter
// allen Umständen unangetastet — dieses Skript fasst KEINE Provisionen an.
// Audit: Begleit-Setting commission_cutoff_set_info dokumentiert das Setzen.
// ════════════════════════════════════════════════════════════════════
import "dotenv/config";
import postgres from "postgres";

const sql = postgres(process.env.DATABASE_URL!, { ssl: "require", max: 1 });
const WRITE = process.argv.includes("--write");

async function main() {
  const cur = await sql`SELECT value FROM fiaon_settings WHERE key = 'commission_cutoff_at'`;
  console.log("Aktueller Stichtag:", cur.length && cur[0].value ? cur[0].value : "NICHT GESETZT (Altmodell für alle)");

  // Wen schützt der Stichtag? Offene Bestellungen mit Agent, aber ohne Doku.
  const [v1] = await sql`
    SELECT COUNT(*)::int AS geschuetzt
    FROM fiaon_applications a
    WHERE a.payment_status IN ('pending_payment', 'claimed_paid')
      AND a.merged_into IS NULL AND a.assigned_agent_id IS NOT NULL
      AND NOT EXISTS (
        SELECT 1 FROM fiaon_contact_log c
        WHERE c.ref = a.ref AND c.agent_id IS NOT NULL AND c.voided_at IS NULL
          AND c.type IN ('result', 'email_sent'))
      AND NOT EXISTS (
        SELECT 1 FROM fiaon_lead_log g JOIN fiaon_leads l ON l.id = g.lead_id
        WHERE l.converted_order_id = a.ref AND g.agent_id IS NOT NULL
          AND g.type IN ('result', 'email_sent'))
  `;
  console.log(`Durch das Altmodell geschützte offene Bestellungen (Agent zugewiesen, keine Doku): ${v1.geschuetzt}`);

  if (!WRITE) {
    console.log("\nDRY-RUN — nichts geschrieben. Zum Scharfstellen: --write (erst NACH dem Deploy ausführen).");
    await sql.end();
    return;
  }

  if (cur.length && cur[0].value) {
    console.log("\nABBRUCH: Stichtag ist bereits gesetzt und wird NICHT überschrieben (kein rückwirkender Regelwechsel).");
    await sql.end();
    process.exit(1);
  }

  const now = new Date().toISOString();
  await sql`
    INSERT INTO fiaon_settings (key, value, updated_at) VALUES ('commission_cutoff_at', ${now}, NOW())
    ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()
  `;
  // Audit-Spur: wer/wann/warum (Begleit-Setting, unveränderlich gedacht).
  await sql`
    INSERT INTO fiaon_settings (key, value, updated_at)
    VALUES ('commission_cutoff_set_info', ${`Gesetzt am ${now} per scripts/phase2b-scharfstellen.ts (Phase 2B V1). Bestellungen davor: Altmodell (Zuweisung genügt). ${v1.geschuetzt} offene Bestellungen geschützt.`}, NOW())
    ON CONFLICT (key) DO NOTHING
  `;
  console.log(`\nSTICHTAG GESETZT: ${now}`);
  console.log("Ab jetzt gilt für NEUE Bestellungen: Provision nur bei dokumentierter Betreuung.");
  await sql.end();
}

main().catch((e) => { console.error(e); process.exit(1); });
