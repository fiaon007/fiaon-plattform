/** Sofortprüfung: Wird der Audit-Trail der Migration wirklich geschrieben? Nur lesend. */
import "dotenv/config";
import postgres from "postgres";
const sql = postgres(process.env.DATABASE_URL!, { ssl: "require", max: 1 });

async function main(): Promise<void> {
  const cols = await sql`
    SELECT column_name, data_type FROM information_schema.columns
    WHERE table_name = 'fiaon_kartei_events' ORDER BY ordinal_position
  `;
  console.log("Spalten fiaon_kartei_events:");
  for (const c of cols) console.log(`  ${c.column_name.padEnd(22)} ${c.data_type}`);

  const [n] = await sql`SELECT COUNT(*)::int AS c FROM fiaon_kartei_events`;
  console.log(`\nEinträge gesamt: ${n.c}`);

  const byEvent = await sql`
    SELECT event, COUNT(*)::int AS c FROM fiaon_kartei_events GROUP BY event ORDER BY c DESC
  `;
  console.log("\nNach Ereignisart:");
  for (const r of byEvent) console.log(`  ${String(r.event).padEnd(22)} ${r.c}`);

  const last = await sql`
    SELECT kind, target_id, agent_id, event, actor, meta, created_at
    FROM fiaon_kartei_events ORDER BY created_at DESC LIMIT 3
  `;
  console.log("\nLetzte 3 Einträge:");
  for (const r of last) {
    console.log(`  ${r.event} · ${r.kind} ${r.target_id} · Agent ${r.agent_id} · meta=${JSON.stringify(r.meta)}`);
  }
  await sql.end();
}
main().catch(async (e) => { console.error(e); await sql.end().catch(() => {}); process.exit(1); });
