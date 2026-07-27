/**
 * Zeigt den Fortschritt eines laufenden Migrations-Stapels (nur lesend).
 * Verwendung: npx tsx scripts/kartei-fortschritt.ts <batch-id>
 */
import "dotenv/config";
import postgres from "postgres";

const sql = postgres(process.env.DATABASE_URL!, { ssl: "require", max: 1 });
const batch = process.argv[2];

async function main(): Promise<void> {
  if (!batch) {
    console.error("Stapel-Kennung fehlt. Beispiel: npx tsx scripts/kartei-fortschritt.ts mig-2026-07-27-abc123");
    process.exit(2);
  }
  const [r] = await sql`
    SELECT COUNT(*)::int AS c,
           MIN(created_at) AS start,
           MAX(created_at) AS zuletzt
    FROM fiaon_kartei_events
    WHERE event = 'migration_release' AND meta->>'batch_id' = ${batch}
  `;
  const [rest] = await sql`
    SELECT COUNT(*)::int AS c FROM fiaon_leads
    WHERE assigned_agent_id IS NOT NULL
      AND status IN ('neu','kontaktiert','nicht_erreichbar')
      AND dismissed_at IS NULL AND converted_order_id IS NULL
      AND NOT EXISTS (SELECT 1 FROM fiaon_lead_log g WHERE g.lead_id = fiaon_leads.id AND g.type IN ('result','note','email_sent'))
  `;
  console.log(`Stapel ${batch}`);
  console.log(`  freigegeben ......... ${r.c} von 2056`);
  console.log(`  noch offen (Leads) .. ${rest.c}`);
  if (r.start) console.log(`  läuft seit .......... ${new Date(r.start).toLocaleTimeString("de-DE")}`);
  await sql.end();
}
main().catch(async (e) => { console.error(e); await sql.end().catch(() => {}); process.exit(1); });
