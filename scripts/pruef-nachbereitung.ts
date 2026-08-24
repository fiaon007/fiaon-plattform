// ═══════════════════════════════════════════════════════════════════════════
// PRÜFSTAND: Was sieht der Mitarbeiter nach dem Gespräch?
//
// Justin, 24.08.2026: „Prüfe das bitte doppelt und dreifach, bevor es live
// geht … und dann versetze dich in die Rolle des Mitarbeiters, gehe JEDES
// Szenario im Detail durch, dann siehst du, ob ALLE Ansichten wirklich so
// funktionieren, wie sie sollten."
//
// Dieses Skript schickt JEDE Lage durch die Entscheidung und schreibt auf, was
// der Mensch am Telefon zu sehen bekäme. Es prüft dabei fünf Regeln, die nie
// verletzt werden dürfen — siehe unten.
// ═══════════════════════════════════════════════════════════════════════════
import { nachbereitungsWege, nachLageSatz, type NachEingang, type NachLage, type Urteil } from "../shared/fiaon-anruf-nachbereitung";
import { ERGEBNIS_LISTE } from "../shared/fiaon-kontakt-ergebnis-liste";

const ERLAUBTE_ARTEN = new Set(ERGEBNIS_LISTE.map((e) => e.art as string));
const LAGEN: NachLage[] = ["rate_ueberfaellig", "zusage_gebrochen", "rueckruf_faellig",
  "bezahlt_ohne_termin", "zahlung_gemeldet", "rechnung_offen", "lead_ohne_antrag",
  "termin_heute", "alles_gut", "unbekannt"];
const URTEILE: Urteil[] = ["gut", "nicht_erreicht", "schlecht"];

let faelle = 0;
const fehler: string[] = [];

function pruefe(e: NachEingang, u: Urteil) {
  faelle++;
  const wege = nachbereitungsWege(e, u);
  const wo = `${e.lage} | Mandat=${e.hatMandat ? "ja" : "nein"} | Termin=${e.hatTermin ? "ja" : "nein"} | Zusage=${e.hatZusage ? "ja" : "nein"} | ohneKunde=${e.ohneKunde} | Rate=${e.mitRate} | ${u}`;

  // Regel 1: Es muss IMMER etwas zu klicken geben — außer beim
  // Forderungsmanagement, das seine eigene Liste mitbringt.
  if (wege.length === 0 && !e.mitRate) fehler.push(`KEIN WEG: ${wo}`);

  for (const w of wege) {
    // Regel 2: Nur kanonische Ergebnisse. Ein erfundenes lehnt der Server ab.
    if (!ERLAUBTE_ARTEN.has(w.art)) fehler.push(`UNBEKANNTE ART "${w.art}": ${wo}`);
    // Regel 3: Jeder Weg hat eine Beschriftung und einen Hinweis.
    if (!w.label?.trim()) fehler.push(`OHNE BESCHRIFTUNG: ${wo}`);
    if (!w.hinweis?.trim()) fehler.push(`OHNE HINWEIS: ${w.label} — ${wo}`);
    // Regel 4: „Sonstiges" verlangt IMMER eine Notiz (so prüft es der Server).
    if (w.art === "erreicht_sonstiges" && !w.notizPflicht) fehler.push(`SONSTIGES OHNE NOTIZPFLICHT: ${wo}`);
  }
  // Regel 5: Justins Kernregel — steht der Termin schon, darf nicht nach einem
  // Termin gefragt werden.
  if (e.hatTermin && wege.some((w) => w.braucht === "termin")) {
    fehler.push(`FRAGT NACH TERMIN, OBWOHL EINER STEHT: ${wo}`);
  }
  // Regel 6: Steht die Zusage schon, darf nicht nach einem Zusagedatum gefragt
  // werden — außer bei einer GEBROCHENEN Zusage, dort ist ein neues Datum der
  // ganze Zweck des Anrufs.
  if (e.hatZusage && e.lage !== "zusage_gebrochen" && wege.some((w) => w.braucht === "zusage")) {
    fehler.push(`FRAGT NACH ZUSAGE, OBWOHL EINE STEHT: ${wo}`);
  }
  // Regel 7: Ohne Mandat muss es beide Abschlusswege geben.
  if (u === "gut" && !e.hatMandat && !e.ohneKunde && !e.mitRate) {
    if (!wege.some((w) => w.mandat || w.label.includes("Mandat gewonnen"))) fehler.push(`OHNE „Mandat gewonnen": ${wo}`);
    if (!wege.some((w) => w.label.includes("nicht gewonnen"))) fehler.push(`OHNE „Mandat nicht gewonnen": ${wo}`);
  }
  return wege;
}

console.log("═══ WAS DER MITARBEITER NACH DEM GESPRÄCH SIEHT ═══\n");
for (const lage of LAGEN) {
  const ohneKunde = lage === "unbekannt";
  const mitRate = lage === "rate_ueberfaellig";
  for (const hatMandat of ohneKunde ? [false] : [false, true]) {
    for (const hatTermin of [false, true]) {
      for (const hatZusage of [false, true]) {
        const e: NachEingang = { lage, hatMandat, hatTermin, hatZusage, ohneKunde, mitRate };
        for (const u of URTEILE) pruefe(e, u);
      }
    }
  }
}

// Die sechs Lagen, die im Alltag wirklich vorkommen — ausführlich zum Lesen.
const beispiele: { was: string; e: NachEingang }[] = [
  { was: "C-Kunde · Lead, noch kein Antrag", e: { lage: "lead_ohne_antrag", hatMandat: false, hatTermin: false, hatZusage: false, ohneKunde: false, mitRate: false } },
  { was: "B-Kunde · Antrag fertig, Rechnung offen", e: { lage: "rechnung_offen", hatMandat: false, hatTermin: false, hatZusage: false, ohneKunde: false, mitRate: false } },
  { was: "A-Kunde · Zahlung gemeldet", e: { lage: "zahlung_gemeldet", hatMandat: false, hatTermin: false, hatZusage: false, ohneKunde: false, mitRate: false } },
  { was: "Nummer berichtigt UND Termin gebucht (noch kein Mandat)", e: { lage: "rechnung_offen", hatMandat: false, hatTermin: true, hatZusage: false, ohneKunde: false, mitRate: false } },
  { was: "Im Antragsprozess Termin gebucht, hat bezahlt", e: { lage: "bezahlt_ohne_termin", hatMandat: true, hatTermin: true, hatZusage: false, ohneKunde: false, mitRate: false } },
  { was: "Bestandskunde · Zusage gebrochen", e: { lage: "zusage_gebrochen", hatMandat: true, hatTermin: false, hatZusage: true, ohneKunde: false, mitRate: false } },
  { was: "Bestandskunde · alles läuft", e: { lage: "alles_gut", hatMandat: true, hatTermin: false, hatZusage: false, ohneKunde: false, mitRate: false } },
  { was: "Unbekannte Nummer", e: { lage: "unbekannt", hatMandat: false, hatTermin: false, hatZusage: false, ohneKunde: true, mitRate: false } },
];
for (const b of beispiele) {
  console.log(`── ${b.was}`);
  console.log(`   Lagesatz: „${nachLageSatz(b.e, "Petra")}"`);
  for (const u of URTEILE) {
    const w = nachbereitungsWege(b.e, u);
    console.log(`   ${u.padEnd(14)} → ${w.length ? w.map((x) => x.label).join(" · ") : "(eigene Ratenliste)"}`);
  }
  console.log("");
}

console.log(`═══ ${faelle} Fälle geprüft ═══`);
if (fehler.length) {
  console.log(`\n${fehler.length} VERSTÖSSE:`);
  [...new Set(fehler)].slice(0, 25).forEach((f) => console.log("  ·", f));
  process.exit(1);
}
console.log("Keine Verstöße. Alle sieben Regeln halten in jeder Lage.");
