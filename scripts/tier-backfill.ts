/**
 * ═══════════════════════════════════════════════════════════════════════════
 * BACKFILL: priority_tier UND tier_reason
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Schreibt das Tier jeder lebenden Person in die von Migration 032 angelegten
 * Spalten. Die Rangfolge kommt ausschliesslich aus `server/lib/tier.ts` — hier
 * steht keine zweite Kopie der Regeln.
 *
 * Ohne `--apply` wird nur gezeigt, was sich ändern würde.
 *
 *   npx tsx scripts/tier-backfill.ts
 *   npx tsx scripts/tier-backfill.ts --apply
 *
 * KONTROLLE
 * Nach dem Schreiben wird die GESPEICHERTE Spalte gegen den Ausdruck aus
 * tier.ts gestellt. Nicht gegen erwartete Zahlen — eine Übereinstimmung mit
 * Wunschwerten beweist nichts, wenn beide Seiten aus derselben falschen Quelle
 * stammen. Bleibt eine einzige Person übrig, deren gespeichertes Tier von der
 * Berechnung abweicht, endet das Skript mit Fehlercode.
 */

import "dotenv/config";
import { sqlPool } from "../server/lib/db-pool";
import { personTierSql } from "../server/lib/tier";

const APPLY = process.argv.includes("--apply");

const log = (s = "") => console.log(s);
const linie = (z = "─") => log(z.repeat(74));
const pad = (s: unknown, n: number) => String(s).padStart(n);

/**
 * Momentaufnahme der freigegebenen Vorschau vom 03.08.2026, 14:39.
 *
 * Dient der SICHTPRÜFUNG, nicht als Abbruchkriterium. Die Datenbank läuft
 * weiter: Jeder neue Lead erhöht Tier 3, jede ablaufende Zahlungsfrist
 * verschiebt eine Person von `rechnung_offen` nach
 * `zahlungsfrist_abgelaufen`. Ein Vergleich gegen feste Zahlen müsste auf
 * einem lebenden System zwangsläufig Fehlalarm auslösen.
 *
 * Das harte Kriterium ist Kontrolle 1: gespeicherte Spalte gegen tier.ts.
 */
const MOMENTAUFNAHME: Record<string, number> = {
  "0": 267, "1": 146, "2": 1655, "3": 2354, "-1": 2,
};
const MOMENTAUFNAHME_GESAMT = 4424;

async function main(): Promise<void> {
  log();
  log(APPLY ? "BACKFILL — SCHREIBEND" : "BACKFILL — PROBELAUF (nichts wird geschrieben)");
  linie("═");

  // ── Wie viele Zeilen weichen ab? ─────────────────────────────────────────
  const [vorher] = (await sqlPool.unsafe(`
    WITH t AS (${personTierSql()})
    SELECT count(*)::int AS abweichend
    FROM fiaon_persons p JOIN t ON t.person_id = p.id
    WHERE p.priority_tier IS DISTINCT FROM t.priority_tier
       OR p.tier_reason   IS DISTINCT FROM t.tier_reason`)) as any[];
  log(`  Personen mit abweichendem Tier: ${vorher.abweichend}`);

  if (!APPLY) {
    log();
    log("  Mit --apply wird geschrieben.");
    await sqlPool.end({ timeout: 5 });
    return;
  }

  // ── Schreiben ────────────────────────────────────────────────────────────
  // Nur tatsächlich abweichende Zeilen anfassen, damit `updated_at`-Trigger und
  // Replikationsvolumen nicht ohne Grund ausgelöst werden.
  const ergebnis = await sqlPool.unsafe(`
    WITH t AS (${personTierSql()})
    UPDATE fiaon_persons p
    SET priority_tier = t.priority_tier,
        tier_reason   = t.tier_reason
    FROM t
    WHERE t.person_id = p.id
      AND (p.priority_tier IS DISTINCT FROM t.priority_tier
        OR p.tier_reason   IS DISTINCT FROM t.tier_reason)`);
  log(`  Geschrieben: ${(ergebnis as any).count ?? vorher.abweichend} Zeilen`);

  // ── Kontrolle 1: gespeichert == berechnet ────────────────────────────────
  const [rest] = (await sqlPool.unsafe(`
    WITH t AS (${personTierSql()})
    SELECT count(*)::int AS abweichend
    FROM fiaon_persons p JOIN t ON t.person_id = p.id
    WHERE p.priority_tier IS DISTINCT FROM t.priority_tier
       OR p.tier_reason   IS DISTINCT FROM t.tier_reason`)) as any[];

  log();
  log("KONTROLLE 1 — gespeicherte Spalte gegen tier.ts");
  linie();
  log(`  Verbleibende Abweichungen: ${rest.abweichend}  ${rest.abweichend === 0 ? "✓" : "✗ STOPP"}`);

  // ── Kontrolle 2: Verteilung aus der TABELLE ──────────────────────────────
  const verteilung = (await sqlPool`
    SELECT priority_tier, tier_reason, count(*)::int AS personen
    FROM fiaon_persons
    WHERE merged_into_person_id IS NULL
    GROUP BY 1, 2 ORDER BY 1, 3 DESC`) as any[];

  log();
  log("KONTROLLE 2 — Verteilung, gelesen aus fiaon_persons");
  linie();
  const jeTier = new Map<number, number>();
  for (const r of verteilung) {
    jeTier.set(r.priority_tier, (jeTier.get(r.priority_tier) ?? 0) + r.personen);
    log(`  Tier ${pad(r.priority_tier, 2)}  ${String(r.tier_reason).padEnd(26)} ${pad(r.personen, 7)}`);
  }

  log();
  log("  Tier    Ist  Vorschau   Delta");
  for (const tier of ["0", "1", "2", "3", "-1"]) {
    const ist = jeTier.get(Number(tier)) ?? 0;
    const damals = MOMENTAUFNAHME[tier];
    const d = ist - damals;
    log(`  ${pad(tier, 4)} ${pad(ist, 6)} ${pad(damals, 9)} ${pad(d === 0 ? "—" : (d > 0 ? `+${d}` : d), 7)}`);
  }

  const gesamt = [...jeTier.values()].reduce((a, b) => a + b, 0);
  const dGesamt = gesamt - MOMENTAUFNAHME_GESAMT;
  log(`  Gesamt ${pad(gesamt, 4)} ${pad(MOMENTAUFNAHME_GESAMT, 9)} ${pad(dGesamt === 0 ? "—" : `+${dGesamt}`, 7)}`);

  // Wächst die Gesamtzahl, muss sich das durch neu angelegte Personen erklären
  // lassen. Bleibt ein Rest, ist etwas anderes passiert und gehört angesehen.
  if (dGesamt !== 0) {
    const [neu] = (await sqlPool`
      SELECT count(*)::int AS n
      FROM fiaon_persons
      WHERE merged_into_person_id IS NULL
        AND created_at > TIMESTAMPTZ '2026-08-03 12:29:00+00'`) as any[];
    log();
    log(`  Seit der Momentaufnahme neu angelegte Personen: ${neu.n}`);
    log(`  ${neu.n === dGesamt
      ? "✓ Die Differenz ist damit vollständig erklärt."
      : "⚠ Die Differenz ist NICHT vollständig erklärt — bitte ansehen."}`);
  }

  await sqlPool.end({ timeout: 5 });

  if (rest.abweichend !== 0) {
    log();
    log("STOPP — gespeichertes Tier und Berechnung weichen ab. Kein weiterer Schritt.");
    process.exit(1);
  }
  log();
  log("Backfill vollständig. Gespeichertes Tier und tier.ts sind deckungsgleich.");
}

main().catch(async (err) => {
  console.error("\nFehler:", err?.message || err);
  await sqlPool.end({ timeout: 5 }).catch(() => {});
  process.exit(1);
});
