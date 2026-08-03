/**
 * ═══════════════════════════════════════════════════════════════════════════
 * RÜCKWEG DER ERSTVERTEILUNG
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Stellt den Besitzstand VOR der Erstverteilung wieder her — nicht aus einem
 * Backup, sondern aus der Beweiskette in `fiaon_agent_events`, die der Trigger
 * aus Migration 033 bei jedem Besitzwechsel schreibt.
 *
 * WARUM NICHT AUS DEM BACKUP
 * Ein Backup-Restore würde alles zurückdrehen, was seit dem Abzug passiert ist:
 * Zahlungen, Provisionen, Gesprächsnotizen, Rechnungsnummern. Dieses Skript
 * fasst NUR `fiaon_persons.assigned_agent_id` an. Alles andere bleibt, wie es
 * ist. Das Backup ist die Reserve für den Fall, dass auch dieser Weg versagt.
 *
 * DIE ENTSCHEIDENDE REGEL
 * Pro Person wird der ÄLTESTE Verteilungs-Eintrag gelesen und dessen
 * `from_agent_id` wiederhergestellt. Nicht der neueste: Lief nach der
 * Erstverteilung schon eine Rotation oder ein Nachschub, beschreibt nur der
 * älteste Eintrag den Zustand vor dem Umbau. Der neueste würde den Stand
 * mitten im Umbau festschreiben.
 *
 * WAS ES NICHT ZURÜCKDREHT
 *   · `priority_tier` / `tier_reason` — die stammen aus dem Backfill, nicht
 *     aus der Verteilung, und sind unabhängig davon richtig.
 *   · Die Antragszeilen. Die zieht der Trigger von selbst nach, sobald die
 *     Person zurückgesetzt wird — genau derselbe Weg wie beim Verteilen.
 *   · Bereits geschriebene Beweiszeilen. Die Historie wird ergänzt, nie
 *     gefälscht: Jede Rücknahme erzeugt einen eigenen Eintrag mit dem Grund
 *     `verteilung_rollback`.
 *
 * AUFRUF
 *   npx tsx scripts/verteilung-rollback.ts             # nur zeigen
 *   npx tsx scripts/verteilung-rollback.ts --apply     # wirklich zurücksetzen
 *
 * Optional ein anderer Grund, falls nicht die Erstverteilung zurückgenommen
 * werden soll, sondern z. B. ein fehlgelaufener Nachschub:
 *   npx tsx scripts/verteilung-rollback.ts --grund=nachschub --apply
 *
 * Alles läuft in EINER Transaktion. Bricht etwas ab, ist nichts geschehen.
 */

import "dotenv/config";
import { sqlPool } from "../server/lib/db-pool";

const APPLY = process.argv.includes("--apply");
const GRUND_ARG = process.argv.find((a) => a.startsWith("--grund="));
const GRUND = GRUND_ARG ? GRUND_ARG.split("=")[1] : "initial_redistribution";

const log = (s = "") => console.log(s);
const linie = (z = "─") => log(z.repeat(74));

type Wiederherstellung = {
  person_id: number;
  zurueck_zu: number | null;
  aktuell: number | null;
  priority_tier: number;
  erster_wechsel: string;
};

async function main() {
  linie("═");
  log("  RÜCKWEG DER ERSTVERTEILUNG");
  log(`  Grund in der Beweiskette: ${GRUND}`);
  log(`  Modus: ${APPLY ? "AUSFÜHREN" : "nur zeigen (--apply fehlt)"}`);
  linie("═");
  log();

  // ── Gibt es überhaupt etwas zurückzunehmen? ──────────────────────────────
  const [vorhanden] = (await sqlPool`
    SELECT count(*)::int AS anzahl,
           MIN(created_at) AS erster,
           MAX(created_at) AS letzter
    FROM fiaon_agent_events
    WHERE type = 'person_owner_changed' AND reason = ${GRUND}
  `) as any[];

  if (!vorhanden || vorhanden.anzahl === 0) {
    log(`  Keine Einträge mit Grund „${GRUND}“ gefunden.`);
    log("  Es gibt nichts zurückzunehmen. Wurde die Verteilung überhaupt ausgeführt?");
    log();
    await sqlPool.end({ timeout: 5 });
    return;
  }

  log(`  ${vorhanden.anzahl} Besitzwechsel gefunden`);
  log(`  von ${new Date(vorhanden.erster).toLocaleString("de-DE")}`);
  log(`  bis ${new Date(vorhanden.letzter).toLocaleString("de-DE")}`);
  log();

  // ── Der Zielzustand: pro Person der ÄLTESTE Eintrag ──────────────────────
  // `DISTINCT ON` mit passender Sortierung ist hier genau das richtige
  // Werkzeug: Es liefert je Person exakt eine Zeile, und zwar die früheste.
  const plan = (await sqlPool`
    WITH erster_wechsel AS (
      SELECT DISTINCT ON ((meta::json->>'person_id')::int)
             (meta::json->>'person_id')::int AS person_id,
             from_agent_id,
             created_at
      FROM fiaon_agent_events
      WHERE type = 'person_owner_changed'
        AND reason = ${GRUND}
        AND meta IS NOT NULL
        -- IS JSON VOR dem Cast: Schreibt irgendwann ein anderer Ereignistyp
        -- Freitext in die meta-Spalte, darf der Rückweg nicht daran zerbrechen.
        AND meta IS JSON
        AND meta::json->>'person_id' IS NOT NULL
      ORDER BY (meta::json->>'person_id')::int, created_at ASC
    )
    SELECT e.person_id,
           e.from_agent_id AS zurueck_zu,
           p.assigned_agent_id AS aktuell,
           p.priority_tier,
           e.created_at AS erster_wechsel
    FROM erster_wechsel e
    JOIN fiaon_persons p ON p.id = e.person_id
    WHERE p.assigned_agent_id IS DISTINCT FROM e.from_agent_id
    ORDER BY e.person_id
  `) as unknown as Wiederherstellung[];

  if (plan.length === 0) {
    log("  Jede betroffene Person steht bereits auf ihrem Ausgangswert.");
    log("  Der Rückweg ist entweder schon gegangen oder war nie nötig.");
    log();
    await sqlPool.end({ timeout: 5 });
    return;
  }

  // ── Was würde passieren, aufgeschlüsselt ─────────────────────────────────
  log(`  ${plan.length} Personen würden zurückgesetzt.`);
  log();

  const nachZiel = new Map<string, number>();
  for (const p of plan) {
    const schluessel = `${p.aktuell ?? "Pool"} → ${p.zurueck_zu ?? "Pool"}`;
    nachZiel.set(schluessel, (nachZiel.get(schluessel) ?? 0) + 1);
  }
  log("  Bewegung (aktueller Besitzer → Ausgangsbesitzer):");
  for (const [schluessel, anzahl] of [...nachZiel.entries()].sort((a, b) => b[1] - a[1])) {
    log(`    ${String(anzahl).padStart(5)} × Agent ${schluessel}`);
  }
  log();

  const nachTier = new Map<number, number>();
  for (const p of plan) nachTier.set(p.priority_tier, (nachTier.get(p.priority_tier) ?? 0) + 1);
  log("  Nach Tier:");
  for (const [tier, anzahl] of [...nachTier.entries()].sort((a, b) => a[0] - b[0])) {
    log(`    Tier ${tier}: ${anzahl}`);
  }
  log();

  const zurueckInPool = plan.filter((p) => p.zurueck_zu === null).length;
  if (zurueckInPool > 0) {
    log(`  Hinweis: ${zurueckInPool} Personen hatten VOR der Verteilung keinen Besitzer.`);
    log("  Sie landen wieder im Pool — das ist der korrekte Ausgangszustand.");
    log();
  }

  if (!APPLY) {
    linie();
    log("  Nichts geändert. Mit --apply wirklich zurücksetzen.");
    linie();
    await sqlPool.end({ timeout: 5 });
    return;
  }

  // ── Ausführen ────────────────────────────────────────────────────────────
  // Eine Transaktion für alles. Der Trigger aus 033 zieht die Antragszeilen
  // nach und schreibt pro Person eine Beweiszeile mit dem neuen Grund.
  linie();
  log("  Setze zurück …");

  let gesetzt = 0;
  await sqlPool.begin(async (tx) => {
    await tx`SELECT set_config('fiaon.reason', 'verteilung_rollback', true)`;
    await tx`SELECT set_config('fiaon.actor', 'system:verteilung-rollback', true)`;

    for (const p of plan) {
      const betroffen = await tx`
        UPDATE fiaon_persons
           SET assigned_agent_id = ${p.zurueck_zu}
         WHERE id = ${p.person_id}
           AND assigned_agent_id IS DISTINCT FROM ${p.zurueck_zu}
        RETURNING id
      `;
      gesetzt += betroffen.length;
    }
  });

  log(`  ${gesetzt} Personen zurückgesetzt.`);
  log();

  // ── Kontrolle: bleibt eine Person auf dem falschen Wert? ─────────────────
  const [rest] = (await sqlPool`
    WITH erster_wechsel AS (
      SELECT DISTINCT ON ((meta::json->>'person_id')::int)
             (meta::json->>'person_id')::int AS person_id,
             from_agent_id
      FROM fiaon_agent_events
      WHERE type = 'person_owner_changed'
        AND reason = ${GRUND}
        AND meta IS NOT NULL
        AND meta IS JSON
        AND meta::json->>'person_id' IS NOT NULL
      ORDER BY (meta::json->>'person_id')::int, created_at ASC
    )
    SELECT count(*)::int AS abweichungen
    FROM erster_wechsel e
    JOIN fiaon_persons p ON p.id = e.person_id
    WHERE p.assigned_agent_id IS DISTINCT FROM e.from_agent_id
  `) as any[];

  linie("═");
  if ((rest?.abweichungen ?? 0) === 0) {
    log("  KONTROLLE BESTANDEN — jede betroffene Person steht auf ihrem Ausgangswert.");
    log("  Die Antragszeilen sind über den Trigger mitgezogen.");
  } else {
    log(`  KONTROLLE FEHLGESCHLAGEN — ${rest.abweichungen} Personen weichen noch ab.`);
    log("  Bitte prüfen, bevor weitergearbeitet wird.");
  }
  linie("═");

  await sqlPool.end({ timeout: 5 });
  if ((rest?.abweichungen ?? 0) !== 0) process.exit(1);
}

main().catch(async (err) => {
  console.error("[VERTEILUNG-ROLLBACK]", err);
  await sqlPool.end({ timeout: 5 }).catch(() => {});
  process.exit(1);
});
