// ═══════════════════════════════════════════════════════════════════════════
// TERMIN-BUCHUNG: WIE VIELE ABLEHNUNGEN NACH DEM DEPLOY?
//
// ── DER ANLASS (19.08.2026) ────────────────────────────────────────────────
// Der `falsche_rolle`-Fix ist in Commit 759a47f, 19.08.2026 13:58:53 +0200.
// Meldungen von 12:06 (Florentine über Reinhold Müller) liegen DAVOR und
// beweisen nichts über den Fix.
//
// Ziel: Nach dem Deploy 0 Ablehnungen außer „Slot vergeben".
//
// ── DIE FALLE, DIE DIESE MESSUNG VERMEIDET ────────────────────────────────
// Commit-Zeit ist NICHT Deploy-Zeit. Zwischen Push und laufendem Code auf
// Render liegen Minuten; bis dahin schreibt die alte Fassung weiter (AGENTS.md:
// „Ein Bestandslauf braucht einen zweiten Termin"). Diese Messung zeigt deshalb
// BEIDE Grenzen — Commit-Zeit und eine Stunde danach — und sagt ausdrücklich,
// wie viele Versuche überhaupt in das Fenster fallen. Eine Aussage über 0
// Versuche ist keine Aussage.
//
// NUR LESEND.
//
//   npx tsx scripts/mess-buchung-nach-deploy.ts
// ═══════════════════════════════════════════════════════════════════════════
import "dotenv/config";
import { sqlPool } from "../server/lib/db-pool";

/** Commit 759a47f — der falsche_rolle-Fix. */
const COMMIT = "2026-08-19T13:58:53+02:00";

// ═══════════════════════════════════════════════════════════════════════════
// DER ERFOLGSWERT HEISST „gebucht", NICHT „ok"
//
// Ein erster Entwurf filterte auf den Wert „ok" und meldete daraufhin 22
// „Ablehnungen ohne Grund" — darunter zwei nach dem Deploy. Es waren
// GEBUCHTE Termine: In der Spalte stehen genau zwei Werte, `gebucht` und
// `abgelehnt`.
//
// Damit hätte diese Messung den Fix für kaputt erklärt, den sie prüfen soll.
// AGENTS.md: „Eine neue Ableitung nimmt die Werte aus der WIRKLICHKEIT auf,
// nicht die aus der Spezifikation." Deshalb steht der Wert hier als Konstante
// und wird unten gegen die Tabelle geprüft.
// ═══════════════════════════════════════════════════════════════════════════
const ERFOLG = "gebucht";

const log = (s = "") => console.log(s);
function titel(t: string): void { log(`\n${"═".repeat(76)}\n${t}\n${"═".repeat(76)}`); }

async function main(): Promise<void> {
  const [jetzt] = (await sqlPool`
    SELECT NOW() AS utc, (NOW() AT TIME ZONE 'Europe/Berlin') AS berlin
  `) as any[];
  log("");
  log(`  Datenbankzeit jetzt: ${String(jetzt.berlin).slice(0, 19)} (Europe/Berlin)`);
  log(`  Commit des Fixes:    ${COMMIT}`);

  // ── DIE WERTE AUS DER WIRKLICHKEIT ──────────────────────────────────────
  const werte = ((await sqlPool`
    SELECT DISTINCT ergebnis FROM fiaon_termin_versuche ORDER BY 1
  `) as any[]).map((r) => String(r.ergebnis));
  log(`  Werte in „ergebnis": ${werte.join(", ")}  —  Erfolg = „${ERFOLG}"`);
  if (!werte.includes(ERFOLG)) {
    log("");
    log("  ABBRUCH: Der angenommene Erfolgswert kommt in der Tabelle nicht vor.");
    log("  Jede Zahl darunter wäre falsch. Erst den Wert klären.");
    await sqlPool.end();
    process.exit(1);
  }

  // ═════════════════════════════════════════════════════════════════════════
  titel("1. ALLE ABLEHNUNGEN — VOR UND NACH DEM COMMIT");
  // ═════════════════════════════════════════════════════════════════════════
  const gruende = (await sqlPool`
    SELECT grund,
           COUNT(*)::int AS gesamt,
           COUNT(*) FILTER (WHERE versucht_am < ${COMMIT}::timestamptz)::int AS vorher,
           COUNT(*) FILTER (WHERE versucht_am >= ${COMMIT}::timestamptz)::int AS nachher,
           MAX(versucht_am) AS letzte
    FROM fiaon_termin_versuche
    WHERE ergebnis <> ${ERFOLG}
    GROUP BY grund
    ORDER BY nachher DESC, gesamt DESC
  `) as any[];

  log("");
  log("  Grund                              gesamt   vor Fix   nach Fix   letzte");
  log(`  ${"─".repeat(74)}`);
  for (const g of gruende) {
    log(`  ${String(g.grund ?? "— ohne Grund —").padEnd(34)}`
      + `${String(g.gesamt).padStart(6)}${String(g.vorher).padStart(10)}`
      + `${String(g.nachher).padStart(11)}   ${String(g.letzte).slice(0, 19)}`);
  }

  const [summe] = (await sqlPool`
    SELECT COUNT(*)::int AS versuche,
           COUNT(*) FILTER (WHERE ergebnis = ${ERFOLG})::int AS ok,
           COUNT(*) FILTER (WHERE ergebnis <> ${ERFOLG})::int AS abgelehnt
    FROM fiaon_termin_versuche
    WHERE versucht_am >= ${COMMIT}::timestamptz
  `) as any[];

  // ── Die Ablehnungen, die ERLAUBT sind ───────────────────────────────────
  // „Slot vergeben" ist kein Fehler, sondern der Betrieb: Zwei Menschen wollen
  // dieselbe Zeit, einer bekommt sie.
  const ERLAUBT = ["slot_weg", "slot_vergeben", "belegt"];
  const [echt] = (await sqlPool`
    SELECT COUNT(*)::int AS n FROM fiaon_termin_versuche
    WHERE versucht_am >= ${COMMIT}::timestamptz
      AND ergebnis <> ${ERFOLG}
      AND COALESCE(grund, '') <> ALL(${ERLAUBT}::text[])
  `) as any[];

  titel("2. DAS ERGEBNIS");
  log("");
  log(`  ${String(summe.versuche).padStart(5)}  Buchungsversuche seit dem Commit`);
  log(`  ${String(summe.ok).padStart(5)}  erfolgreich`);
  log(`  ${String(summe.abgelehnt).padStart(5)}  abgelehnt`);
  log(`  ${String(echt.n).padStart(5)}  davon mit einem Grund, der NICHT „Slot vergeben" ist`);
  log("         → das ist die Zahl, die 0 sein soll");
  log("");

  if (summe.versuche === 0) {
    log("  ACHTUNG: Es gibt noch KEINEN Versuch nach dem Commit. Damit ist die 0");
    log("  oben kein Beweis, sondern eine leere Menge — und die beweist nichts.");
    log("  Der Nachweis braucht einen zweiten Termin, sobald Kunden wieder buchen.");
  }

  // Die einzelnen Fälle, damit man sie nachsehen kann.
  const einzeln = (await sqlPool`
    SELECT v.versucht_am, v.grund, v.ergebnis, v.person_id, v.lead_id, v.quelle,
           v.slot_beginn, v.agent_id, ag.name AS agent, ag.rolle,
           COALESCE(NULLIF(TRIM(CONCAT_WS(' ', p.first_name, p.last_name)), ''),
                    p.company_name, p.person_ref) AS kunde
    FROM fiaon_termin_versuche v
    LEFT JOIN fiaon_persons p ON p.id = v.person_id
    LEFT JOIN fiaon_agents ag ON ag.id = v.agent_id
    WHERE v.versucht_am >= ${COMMIT}::timestamptz AND v.ergebnis <> ${ERFOLG}
    ORDER BY v.versucht_am DESC LIMIT 40
  `) as any[];
  if (einzeln.length > 0) {
    log("");
    log("  Die abgelehnten Versuche im Einzelnen:");
    for (const e of einzeln) {
      log(`     ${String(e.versucht_am).slice(0, 19)}  ${String(e.grund ?? "—").padEnd(22)}`
        + ` ${String(e.kunde ?? `Lead ${e.lead_id}`).slice(0, 22).padEnd(23)}`
        + ` ${String(e.quelle ?? "—").padEnd(12)} ${e.agent ?? "—"} (${e.rolle ?? "—"})`);
    }
  }

  // ═════════════════════════════════════════════════════════════════════════
  titel("3. DIE GEMELDETEN FÄLLE — LAGEN SIE VOR DEM FIX?");
  // ═════════════════════════════════════════════════════════════════════════
  const gemeldet = (await sqlPool`
    SELECT v.versucht_am, v.grund, v.ergebnis, v.quelle,
           COALESCE(NULLIF(TRIM(CONCAT_WS(' ', p.first_name, p.last_name)), ''),
                    p.company_name, p.person_ref) AS kunde
    FROM fiaon_termin_versuche v
    LEFT JOIN fiaon_persons p ON p.id = v.person_id
    WHERE COALESCE(p.last_name, '') ILIKE '%müller%'
       OR COALESCE(p.last_name, '') ILIKE '%mueller%'
    ORDER BY v.versucht_am DESC LIMIT 25
  `) as any[];
  log("");
  log(`  Versuche von Kunden mit Nachnamen Müller (${gemeldet.length}):`);
  for (const g of gemeldet) {
    const vor = new Date(g.versucht_am) < new Date(COMMIT);
    log(`     ${String(g.versucht_am).slice(0, 19)}  ${String(g.ergebnis).padEnd(10)}`
      + ` ${String(g.grund ?? "—").padEnd(20)} ${String(g.kunde).slice(0, 22).padEnd(23)}`
      + ` ${vor ? "VOR dem Fix" : "nach dem Fix"}`);
  }

  // ── Und die Stunde vor dem Fix, als die Meldungen kamen ─────────────────
  const [zwölfUhr] = (await sqlPool`
    SELECT COUNT(*)::int AS n,
           COUNT(*) FILTER (WHERE ergebnis <> ${ERFOLG})::int AS abgelehnt
    FROM fiaon_termin_versuche
    WHERE versucht_am >= '2026-08-19T11:00:00+02:00'::timestamptz
      AND versucht_am <  ${COMMIT}::timestamptz
  `) as any[];
  log("");
  log(`  Zum Vergleich, 11:00 bis zum Commit (dort liegen die Meldungen von 12:06):`);
  log(`     ${zwölfUhr.n} Versuche, ${zwölfUhr.abgelehnt} abgelehnt.`);
  log("");
  await sqlPool.end();
}

main().catch((e) => { console.error(e); process.exit(1); });
