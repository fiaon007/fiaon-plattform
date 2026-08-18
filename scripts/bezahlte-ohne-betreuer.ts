// ═══════════════════════════════════════════════════════════════════════════
// BEZAHLTE OHNE BETREUER — DEN BESTAND NACHZIEHEN
//
// ── DIE MELDUNG (Team, 30.08.2026) ─────────────────────────────────────────
// „Zahlung eingegangen — ohne Betreuer."
//
// ── DIE URSACHE (scripts/mess-stufen-betreuer.ts) ─────────────────────────
// GEMESSEN: 88 bezahlte oder gemeldete Personen ohne Zuständigen. Nur EINE
// davon hatte einen Agenten an der Bestellung — es fehlte also wirklich, die
// Anzeige log nicht.
//
// `sofortZuteilen` schloss Stufe 0 aus („ein Bestandskunde ist aus dem Vertrieb
// heraus"). Wer als Stufe 1 oder 2 zugeteilt worden WÄRE, ist beim Bezahlen
// längst zugeteilt. Übrig bleiben die Direktzahler: Für sie griff die Zuteilung
// nie, und nach dem Bezahlen nie wieder.
//
// Die Regel ist seit dem 30.08.2026 geändert (Stufe 0 ist dabei). Dieser Lauf
// holt nach, was die alte Regel liegen ließ.
//
// ── WAS DIESER LAUF NICHT ENTSCHEIDET ─────────────────────────────────────
// Wer zuständig wird, entscheidet `sofortZuteilen` — dieselbe Funktion, die es
// im Betrieb tut, samt Besitzschutz und kleinster Last. Hier steht keine zweite
// Verteilung.
//
// ── SICHERHEITEN ──────────────────────────────────────────────────────────
//   1. Ohne `--schreiben` passiert nichts. Vorschau als CSV.
//   2. Zählprobe danach: 0 bezahlte Personen ohne Zuständigen (soweit ein
//      verteilender Mitarbeiter verfügbar war).
//   3. Jede Zuteilung schreibt einen Verlaufseintrag — das macht
//      `sofortZuteilen` selbst.
//
//   npx tsx scripts/bezahlte-ohne-betreuer.ts              → Vorschau
//   npx tsx scripts/bezahlte-ohne-betreuer.ts --schreiben  → ausführen
// ═══════════════════════════════════════════════════════════════════════════
import "dotenv/config";
import { mkdirSync, writeFileSync } from "node:fs";
import { sqlPool } from "../server/lib/db-pool";
import { sofortZuteilen, agentMitKleinsterLast } from "../server/lib/fiaon-zuteilung";

const SCHREIBEN = process.argv.includes("--schreiben");
const log = (s = "") => console.log(s);
const feld = (v: unknown): string => {
  const s = v == null ? "" : String(v);
  return /[";\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

const OFFEN = (lauf: any) => lauf`
  SELECT p.id, p.person_ref, p.priority_tier,
         COALESCE(NULLIF(TRIM(CONCAT_WS(' ', p.first_name, p.last_name)), ''),
                  p.company_name, p.primary_email, p.person_ref) AS name,
         p.betreuung_seit,
         (SELECT MAX(a.paid_at) FROM fiaon_applications a
           WHERE a.person_id = p.id AND a.merged_into IS NULL) AS bezahlt_am
  FROM fiaon_persons p
  WHERE p.merged_into_person_id IS NULL AND p.ist_test_am IS NULL
    AND p.assigned_agent_id IS NULL
    AND NOT p.is_blocked
    AND EXISTS (
      SELECT 1 FROM fiaon_applications a
      WHERE a.person_id = p.id AND a.merged_into IS NULL
        AND a.payment_status IN ('paid', 'claimed_paid')
    )
  ORDER BY p.id
`;

async function main(): Promise<void> {
  mkdirSync("reports", { recursive: true });
  log("\n══ Bezahlte ohne Betreuer ══\n");

  const offen = (await OFFEN(sqlPool)) as any[];
  log(`  ${String(offen.length).padStart(5)}  bezahlte/gemeldete Personen ohne Zuständigen`);

  // Ohne verteilenden Mitarbeiter ist der Lauf sinnlos — und ein Lauf, der
  // 88 Zeilen anfasst und nichts erreicht, verschleiert die Ursache.
  // AGENTS.md: Ein Lauf, der eine Pflicht einschaltet, prüft VORHER, ob sie
  // erfüllbar ist.
  const zielAgent = await agentMitKleinsterLast(sqlPool);
  if (!zielAgent) {
    log("\n  !! Kein verteilender Mitarbeiter aktiv (active + distribution_active,");
    log("     Rolle agent/vertriebsleiter, kein Testkonto). Der Lauf würde nichts");
    log("     erreichen und bricht ab — das ist eine Personalentscheidung, kein Fehler.\n");
    await sqlPool.end();
    process.exitCode = 1;
    return;
  }

  const mannschaft = (await sqlPool`
    SELECT ag.id, ag.name,
           (SELECT COUNT(*)::int FROM fiaon_persons p
             WHERE p.assigned_agent_id = ag.id AND p.merged_into_person_id IS NULL) AS bestand
    FROM fiaon_agents ag
    WHERE ag.active AND ag.distribution_active AND NOT ag.is_test_account
      AND COALESCE(ag.rolle, 'agent') IN ('agent', 'vertriebsleiter')
    ORDER BY bestand ASC, ag.id ASC
  `) as any[];
  log("");
  log("  Verteilende Mannschaft (nach Bestand):");
  for (const m of mannschaft) log(`   ${String(m.name).slice(0, 26).padEnd(28)} ${String(m.bestand).padStart(5)} Kunden`);

  log("");
  for (const o of offen.slice(0, 20)) {
    log(`   Person ${String(o.id).padStart(6)}  ${String(o.name).slice(0, 26).padEnd(28)} `
      + `Stufe ${o.priority_tier}${o.betreuung_seit ? "  (betreuung_seit gesetzt — Besitzschutz prüft das)" : ""}`);
  }
  if (offen.length > 20) log(`   … und ${offen.length - 20} weitere`);

  writeFileSync("reports/bezahlte-ohne-betreuer.csv",
    `person_id;person_ref;name;stufe;bezahlt_am\n${offen.map((o) =>
      [o.id, o.person_ref, o.name, o.priority_tier, o.bezahlt_am ?? ""].map(feld).join(";")).join("\n")}\n`,
    "utf8");
  log("");
  log("  Vorschau: reports/bezahlte-ohne-betreuer.csv");

  if (!SCHREIBEN) {
    log("\n  Nur Vorschau — es wurde nichts geändert. Ausführen mit --schreiben.\n");
    await sqlPool.end();
    return;
  }

  // ── SCHREIBEN ────────────────────────────────────────────────────────────
  // KEINE umschließende Transaktion: `sofortZuteilen` liest die aktuelle Last
  // bei JEDER Person neu. In einer offenen Transaktion sähe es seine eigenen
  // Zuteilungen — das ist gewollt und funktioniert; aber der Lauf soll auch
  // dann etwas erreicht haben, wenn eine einzelne Person scheitert. Je Person
  // ist der Schreibvorgang ohnehin atomar (UPDATE mit
  // `assigned_agent_id IS NULL` in der Bedingung).
  let zugeteilt = 0;
  const gruende = new Map<string, number>();
  for (const o of offen) {
    const e = await sofortZuteilen(Number(o.id), sqlPool);
    if (e.zugeteilt) zugeteilt++;
    else gruende.set(e.grund, (gruende.get(e.grund) ?? 0) + 1);
  }
  log("");
  log(`  ${zugeteilt} von ${offen.length} zugeteilt.`);
  if (gruende.size > 0) {
    log("  Nicht zugeteilt:");
    for (const [g, n] of Array.from(gruende.entries()).sort((a, b) => b[1] - a[1])) {
      log(`   ${String(n).padStart(4)}  ${g}`);
    }
  }

  // ── ZÄHLPROBE ────────────────────────────────────────────────────────────
  const uebrig = (await OFFEN(sqlPool)) as any[];
  log("");
  log(`  Zählprobe: ${uebrig.length} bezahlte Personen ohne Zuständigen übrig.`);
  if (uebrig.length === 0) {
    log("  ✓ Keine mehr.");
  } else {
    // Ein Rest ist nicht automatisch ein Fehler: Der Besitzschutz hält Menschen
    // zurück, die dokumentiert betreut wurden. Das MUSS dastehen, sonst sucht
    // jemand einen Fehler, den es nicht gibt.
    log("  Diese Personen bleiben mit Begründung liegen (siehe Liste oben) —");
    log("  meist Besitzschutz. Das ist eine Entscheidung, keine Lücke.");
  }
  log("");
  await sqlPool.end();
}

main().catch((e) => { console.error(e); process.exit(1); });
