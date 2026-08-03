/**
 * ═══════════════════════════════════════════════════════════════════════════
 * TIER-VORSCHAU — NUR LESEN
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Rechnet die Tier-Verteilung mit der Logik aus `server/lib/tier.ts` durch,
 * OHNE etwas zu schreiben. Zweck: die Zahlen gegenprüfen, bevor die Migration
 * Spalten anlegt und einen Backfill fährt.
 *
 * Läuft in einer Transaktion mit SET TRANSACTION READ ONLY — die Datenbank
 * selbst weist jeden Schreibversuch ab.
 *
 *   npx tsx scripts/tier-vorschau.ts
 */

import "dotenv/config";
import { sqlPool } from "../server/lib/db-pool";
import { ABBRECHER_STATUS, antragBasisSql, personTierSql, rangSql } from "../server/lib/tier";

const log = (s = "") => console.log(s);
const linie = (z = "─") => log(z.repeat(74));
const pad = (s: unknown, n: number) => String(s).padStart(n);

const TIER_NAME: Record<string, string> = {
  "-1": "ausgeschlossen (nur Admin)",
  "0": "Bestandskunde (raus aus Sales)",
  "1": "Tier 1",
  "2": "Tier 2",
  "3": "Tier 3",
};

async function main(): Promise<void> {
  await sqlPool.begin(async (tx) => {
    await tx.unsafe("SET TRANSACTION READ ONLY");

    log();
    log("TIER-VORSCHAU MIT KORRIGIERTER LOGIK (Tier nur aus payment_status)");
    linie("═");

    // ── Verteilung je Tier und Grund ────────────────────────────────────────
    const verteilung = await tx.unsafe(`
      WITH t AS (${personTierSql()})
      SELECT priority_tier, tier_reason, count(*)::int AS personen
      FROM t GROUP BY 1, 2 ORDER BY 1, 3 DESC`);

    log();
    log("  Tier  Grund                       Personen");
    linie();
    const jeTier = new Map<number, number>();
    for (const r of verteilung as any[]) {
      jeTier.set(r.priority_tier, (jeTier.get(r.priority_tier) ?? 0) + r.personen);
      log(`  ${pad(r.priority_tier, 4)}  ${String(r.tier_reason).padEnd(26)} ${pad(r.personen, 8)}`);
    }
    linie();
    log("  Summen je Tier:");
    let gesamt = 0;
    for (const [tier, n] of [...jeTier.entries()].sort((a, b) => a[0] - b[0])) {
      gesamt += n;
      log(`    ${TIER_NAME[String(tier)] ?? `Tier ${tier}`.padEnd(30)} ${pad(n, 8)}`);
    }
    log(`    ${"GESAMT (lebende Personen)".padEnd(30)} ${pad(gesamt, 8)}`);

    // ── Wer geht in den Vertrieb? ───────────────────────────────────────────
    const [pools] = await tx.unsafe(`
      WITH t AS (${personTierSql()})
      SELECT (count(*) FILTER (WHERE priority_tier = 1))::int AS tier1,
             (count(*) FILTER (WHERE priority_tier = 2))::int AS tier2,
             (count(*) FILTER (WHERE priority_tier = 3))::int AS tier3,
             (count(*) FILTER (WHERE priority_tier IN (1,2,3)))::int AS verteilbar
      FROM t`) as any[];
    log();
    log("  Verteilbare Personen (Tier 1–3): " + pools.verteilbar);
    log(`    Tier 1 ${pad(pools.tier1, 6)}  → bei cap 30 × 4 Agenten = 120 verteilt, Reserve ${Math.max(0, pools.tier1 - 120)}`);
    log(`    Tier 2 ${pad(pools.tier2, 6)}  → bei cap 60 × 4 Agenten = 240 verteilt, Reserve ${Math.max(0, pools.tier2 - 240)}`);
    log(`    Tier 3 ${pad(pools.tier3, 6)}  → Reserve, kein Cap gesetzt`);

    // ── Kontrollen, damit nichts stillschweigend verschwindet ───────────────
    log();
    log("KONTROLLEN");
    linie("═");

    // Unbekannte payment_status-Werte bekommen Rang 0 und würden als „nur_lead"
    // gelten, obwohl ein Antrag existiert. Das muss auffallen.
    const unbekannt = await tx.unsafe(`
      SELECT a.payment_status, COALESCE(a.status,'∅') AS status, count(*)::int AS n
      FROM fiaon_applications a
      WHERE ${antragBasisSql("a")} AND (${rangSql("a")}) = 0
      GROUP BY 1, 2 ORDER BY 3 DESC`);
    if ((unbekannt as any[]).length === 0) {
      log("  ✓ Kein Antrag fällt durch die Rangfolge (alle payment_status abgedeckt).");
    } else {
      log("  ⚠ Anträge ohne Rang — diese Personen würden als „nur_lead“ gelten:");
      for (const r of unbekannt as any[]) {
        log(`      payment_status=${r.payment_status}  status=${r.status}  ${r.n}`);
      }
    }

    // pending ohne status: wird bewusst als abgeschlossen gewertet.
    const [ohneStatus] = await tx.unsafe(`
      SELECT count(*)::int AS n
      FROM fiaon_applications a
      WHERE ${antragBasisSql("a")} AND a.payment_status = 'pending'
        AND COALESCE(a.status,'') = ''`) as any[];
    log(`  pending ohne status (gilt als abgeschlossen, Tier 2): ${ohneStatus.n}`);

    // Aufteilung innerhalb von pending — die einzige Stelle, an der `status` zählt.
    const pending = await tx.unsafe(`
      SELECT CASE WHEN COALESCE(a.status,'') IN (${ABBRECHER_STATUS.map((s) => `'${s}'`).join(", ")})
                  THEN 'abgebrochen → Tier 3' ELSE 'abgeschlossen → Tier 2' END AS gruppe,
             count(*)::int AS antraege
      FROM fiaon_applications a
      WHERE ${antragBasisSql("a")} AND a.payment_status = 'pending'
      GROUP BY 1 ORDER BY 2 DESC`);
    log();
    log("  Aufteilung von payment_status = 'pending' (Antragsebene):");
    for (const r of pending as any[]) log(`      ${String(r.gruppe).padEnd(26)} ${pad(r.antraege, 6)}`);

    // ── Tier 1 nach heutigem Besitzer — zeigt die Schieflage ────────────────
    const jeAgent = await tx.unsafe(`
      WITH t AS (${personTierSql()})
      SELECT COALESCE(ag.name, '— unzugewiesen —') AS agent,
             (count(*) FILTER (WHERE t.priority_tier = 1))::int AS tier1,
             (count(*) FILTER (WHERE t.priority_tier = 2))::int AS tier2,
             (count(*) FILTER (WHERE t.priority_tier = 3))::int AS tier3
      FROM t
      JOIN fiaon_persons p ON p.id = t.person_id
      LEFT JOIN fiaon_agents ag ON ag.id = p.assigned_agent_id
      GROUP BY 1 ORDER BY 2 DESC, 3 DESC`);
    log();
    log("  Tier je heutigem Besitzer (Personenebene, vor der Neuverteilung):");
    log(`      ${"Agent".padEnd(26)} ${pad("Tier1", 6)} ${pad("Tier2", 6)} ${pad("Tier3", 6)}`);
    for (const r of jeAgent as any[]) {
      log(`      ${String(r.agent).slice(0, 25).padEnd(26)} ${pad(r.tier1, 6)} ${pad(r.tier2, 6)} ${pad(r.tier3, 6)}`);
    }

    log();
    log("Es wurde ausschliesslich gelesen. Keine Spalte angelegt, kein Backfill.");
  });

  await sqlPool.end({ timeout: 5 });
}

main().catch(async (err) => {
  console.error("\nFehler:", err?.message || err);
  await sqlPool.end({ timeout: 5 }).catch(() => {});
  process.exit(1);
});
