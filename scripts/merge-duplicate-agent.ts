// ════════════════════════════════════════════════════════════════════
// AGENTEN-DUBLETTE ZUSAMMENFÜHREN (zusammenführen, NICHT löschen).
//
//   npx tsx scripts/merge-duplicate-agent.ts                 → nur lesen (DRY-RUN)
//   npx tsx scripts/merge-duplicate-agent.ts --name="Justin Schwarzott"
//   npx tsx scripts/merge-duplicate-agent.ts --name="Justin Schwarzott" --apply
//   npx tsx scripts/merge-duplicate-agent.ts --from=7 --to=2 --apply
//
// Anlass (SYSTEM_DIAGNOSE.md D1.1): „Justin Schwarzott" existiert doppelt im
// Agenten-Stamm (#2 aktiv, #7 inaktiv). Zwei Stammsätze verteilen die Historie
// (Provisionen, Kontakte, Zuweisungen) auf zwei Identitäten → Berichte stimmen
// nicht. Dieses Skript hängt ALLE Verweise des Quell-Agenten auf den Ziel-Agenten
// um und deaktiviert den Quell-Stammsatz. Es wird NICHTS gelöscht; jede Zeile
// bleibt erhalten, nur die Zuordnung (agent_id) wandert auf den Ziel-Agenten.
//
// Sicher: DRY-RUN ist Standard. Der Schreibvorgang läuft in EINER Transaktion
// (alles-oder-nichts). Audit-Ereignisse (fiaon_agent_events) dokumentieren den
// Merge auf beiden Seiten. Keine Geschäftslogik wird verändert.
// ════════════════════════════════════════════════════════════════════
import "dotenv/config";
import postgres from "postgres";

const sql = postgres(process.env.DATABASE_URL!, { ssl: "require", max: 1 });
const APPLY = process.argv.includes("--apply");
const argVal = (k: string): string | null => {
  const a = process.argv.find((x) => x.startsWith(`--${k}=`));
  return a ? a.slice(k.length + 3) : null;
};

async function pickAgents(): Promise<{ target: any; sources: any[] }> {
  const fromId = argVal("from");
  const toId = argVal("to");
  if (fromId && toId) {
    const rows = await sql`SELECT id, name, active FROM fiaon_agents WHERE id IN (${Number(fromId)}, ${Number(toId)})`;
    const target = rows.find((r: any) => Number(r.id) === Number(toId));
    const source = rows.find((r: any) => Number(r.id) === Number(fromId));
    if (!target || !source) throw new Error("--from/--to: Agent(en) nicht gefunden.");
    return { target, sources: [source] };
  }

  const name = argVal("name") || "Justin Schwarzott";
  const group = await sql`
    SELECT id, name, active FROM fiaon_agents
    WHERE LOWER(TRIM(name)) = ${name.trim().toLowerCase()}
    ORDER BY active DESC, id ASC
  `;
  if (group.length < 2) throw new Error(`Keine Dublette für „${name}" gefunden (${group.length} Treffer).`);
  // Ziel = bevorzugt aktiver Stammsatz mit den meisten Verweisen; Quelle = Rest.
  const withCounts = await Promise.all(group.map(async (a: any) => ({ ...a, refs: await countRefs(Number(a.id)) })));
  withCounts.sort((x, y) => (Number(y.active) - Number(x.active)) || (y.refs - x.refs) || (x.id - y.id));
  const [target, ...sources] = withCounts;
  return { target, sources };
}

/** Alle Spalten in fiaon_*-Tabellen, die auf eine Agenten-id verweisen. */
async function agentRefColumns(): Promise<{ table: string; column: string }[]> {
  const rows = await sql`
    SELECT table_name, column_name FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name LIKE 'fiaon\_%'
      AND table_name <> 'fiaon_agents'
      AND (column_name = 'agent_id' OR column_name LIKE '%\_agent\_id')
    ORDER BY table_name, column_name
  `;
  return rows.map((r: any) => ({ table: r.table_name, column: r.column_name }));
}

async function countRefs(agentId: number): Promise<number> {
  const cols = await agentRefColumns();
  let total = 0;
  for (const { table, column } of cols) {
    const [r] = await sql.unsafe(`SELECT COUNT(*)::int AS c FROM ${table} WHERE ${column} = $1`, [agentId]);
    total += Number(r.c);
  }
  return total;
}

async function main() {
  const { target, sources } = await pickAgents();
  console.log(`ZIEL   (bleibt):  #${target.id} ${target.name} ${target.active ? "(aktiv)" : "(inaktiv)"}`);
  for (const s of sources) console.log(`QUELLE (wird zusammengeführt): #${s.id} ${s.name} ${s.active ? "(aktiv)" : "(inaktiv)"}`);
  if (sources.some((s) => Number(s.id) === Number(target.id))) throw new Error("Quelle und Ziel sind identisch.");

  const cols = await agentRefColumns();
  console.log(`\nGeprüfte Verweis-Spalten (${cols.length}): ${cols.map((c) => `${c.table}.${c.column}`).join(", ")}`);

  // Umzuhängende Verweise je Quelle/Spalte zählen (nur lesen).
  const plan: { source: number; table: string; column: string; count: number }[] = [];
  for (const s of sources) {
    for (const { table, column } of cols) {
      const [r] = await sql.unsafe(`SELECT COUNT(*)::int AS c FROM ${table} WHERE ${column} = $1`, [Number(s.id)]);
      if (Number(r.c) > 0) plan.push({ source: Number(s.id), table, column, count: Number(r.c) });
    }
  }
  console.log("\nUmzuhängende Verweise:");
  if (plan.length === 0) console.log("  (keine — die Quelle hat keine referenzierten Datensätze)");
  for (const p of plan) console.log(`  #${p.source} → #${target.id}: ${p.table}.${p.column} = ${p.count}`);

  if (!APPLY) {
    console.log("\nDRY-RUN — nichts geschrieben. Zum Ausführen: --apply");
    await sql.end();
    return;
  }

  // Schreibvorgang: EINE Transaktion (alles-oder-nichts). Unique-Kollisionen
  // (z. B. Lese-Markierungen, die beide Agenten haben) brechen sauber ab —
  // dann bitte die betroffene Tabelle mit dem Betreiber manuell klären.
  await sql.begin(async (tx) => {
    const nowInfo = { at: new Date().toISOString(), to: Number(target.id), sources: sources.map((s) => Number(s.id)), moved: {} as Record<string, number> };
    for (const p of plan) {
      const res = await tx.unsafe(`UPDATE ${p.table} SET ${p.column} = $1 WHERE ${p.column} = $2`, [Number(target.id), p.source]);
      const moved = (res as any).count ?? p.count;
      nowInfo.moved[`${p.table}.${p.column}`] = (nowInfo.moved[`${p.table}.${p.column}`] || 0) + Number(moved);
    }
    // Quelle deaktivieren (NICHT löschen) + Sitzungen invalidieren.
    for (const s of sources) {
      await tx`UPDATE fiaon_agents SET active = FALSE, session_epoch = COALESCE(session_epoch, 0) + 1, updated_at = NOW() WHERE id = ${Number(s.id)}`;
    }
    // Audit: Merge auf Ziel- und Quellseite dokumentieren.
    await tx`
      INSERT INTO fiaon_agent_events (agent_id, type, meta, created_at)
      VALUES (${Number(target.id)}, 'agent_merge_received', ${JSON.stringify(nowInfo)}, NOW())
    `;
    for (const s of sources) {
      await tx`
        INSERT INTO fiaon_agent_events (agent_id, type, meta, created_at)
        VALUES (${Number(s.id)}, 'agent_merged_into', ${JSON.stringify({ at: nowInfo.at, into: Number(target.id) })}, NOW())
      `;
    }
  });

  console.log(`\nZUSAMMENGEFÜHRT: alle Verweise → #${target.id} ${target.name}. Quelle(n) deaktiviert (nicht gelöscht). Audit-Ereignisse geschrieben.`);
  await sql.end();
}

main().catch((e) => { console.error(e); process.exit(1); });
