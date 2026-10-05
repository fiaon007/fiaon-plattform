// ═══════════════════════════════════════════════════════════════════════════
// PRÜFSTAND LIMIT-GESPRÄCH (05.10.2026, E-283) — ohne Netz, ohne Datenbank
//
// Justin: „Limit-Gespräch muss der Kunde buchen in der App, also sowas wie
// ‚Limit-Erhöhung anfragen', das geht aber nur alle 3 Monate."
//
// Geprüft wird die REINE Regel (shared/fiaon-limit-gespraech.ts), die Server,
// App und Demo gleich benutzen:
//   1  Sperrfrist in Kalendermonaten, Monatsende → letzter Tag des Monats —
//      und GEGEN die Ratenfälligkeit (faelligkeit, server/lib/fiaon-abo-zyklus.ts)
//      gehalten: zwei Fassungen derselben Rechnung, an jedem Tag 2026–2028.
//   2  gezählt / nicht gezählt (erledigt, verpasst mit/ohne erledigt_am, abgesagt)
//   3  jeder Grund und ihre Reihenfolge, der Stichtag selbst, „ab"-Texte
//   4  die Sätze: Wortwand (wandPruefen), keine Rückruf-Zusage, kein Bank-Satz
//      aus E-281, Vertrag § 3 wörtlich und nur bei Paketen mit der Leistung
//   5  wenige Quelltext-Wachen, wo ein Fehler still wäre (Art-Ableitung,
//      öffentliche Route fest „auto") — ausdrücklich als solche benannt
//
//   npx tsx scripts/pruef-limit-gespraech.ts             → Exit 1 bei Fehlern
//   npx tsx scripts/pruef-limit-gespraech.ts --rot-probe → baut drei Fehler
//     ein (Monatsende über Date-Überlauf, „verpasst" zählt immer, gestopptes Abo
//     zählt nicht als beendet) und MUSS rot werden — sonst prüft der Prüfstand nichts.
// ═══════════════════════════════════════════════════════════════════════════
import fs from "node:fs";
import path from "node:path";
import * as L from "../shared/fiaon-limit-gespraech";
import { faelligkeit } from "../server/lib/fiaon-abo-zyklus";
import { wandPruefen } from "../shared/fiaon-wortverbote";
import { ANTRAG_NEU_PAKETE, ANTRAG_NEU_LEISTUNG_FASSUNG, ANTRAG_NEU_VERTRAG_FASSUNG, LIMIT_GESPRAECH } from "../shared/fiaon-antrag-neu";
import { antragNeuVertragHtml } from "../shared/fiaon-antrag-neu-vertrag";
import { terminArtAusQuelle, terminArtFuerKunden, TERMIN_ARTEN } from "../shared/fiaon-termin-art";
import { leitfadenFuerLage, leitfadenVonKey } from "../shared/fiaon-leitfaeden";

const ROT = process.argv.includes("--rot-probe");
let geprueft = 0, fehler = 0;
const ok = (bedingung: unknown, text: string, info: unknown = "") => {
  geprueft++;
  if (!bedingung) { fehler++; console.log(`  ✗ ${text}${info !== "" ? ` — ${typeof info === "string" ? info : JSON.stringify(info)}` : ""}`); }
};
const abschnitt = (t: string) => console.log(`\n── ${t} ${"─".repeat(Math.max(0, 70 - t.length))}`);
const wurzel = path.resolve(import.meta.dirname ?? ".", "..");
const lies = (p: string) => fs.readFileSync(path.join(wurzel, p), "utf8");

// ── DIE GEPRÜFTEN FUNKTIONEN — in der Rotprobe absichtlich kaputt ────────────
const F = {
  plusMonate: L.plusMonate,
  limitGezaehlt: L.limitGezaehlt,
  limitVertragBeendet: L.limitVertragBeendet,
};
if (ROT) {
  console.log("ROTPROBE: Monatsende über Date-Überlauf, „verpasst“ zählt immer, gestopptes Abo nie beendet — dieser Lauf MUSS rot werden.");
  // Die alte Regel vor E-283: Nur „gekündigt UND Ende erreicht" beendet — ein gestopptes Abo bleibt ewig buchbar.
  F.limitVertragBeendet = (e) => e.gekuendigt && e.vertragEndeErreicht;
  // Der klassische Fehler: setMonth läuft über (30.11. + 3 → 02.03. statt 28.02.).
  F.plusMonate = (t: string, n: number) => {
    const d = new Date(`${t}T12:00:00Z`); d.setUTCMonth(d.getUTCMonth() + n); return d.toISOString().slice(0, 10);
  };
  // Der teure Fehler: Ein verpasstes Gespräch sperrt drei Monate.
  F.limitGezaehlt = (t) => String(t.status) === "erledigt" || String(t.status) === "verpasst";
}

// ═══════════════════════════════════════════════════════════════════════════
abschnitt("1 · Sperrfrist in Kalendermonaten");
const FAELLE: [string, number, string][] = [
  ["2026-10-05", 3, "2027-01-05"],
  ["2026-11-30", 3, "2027-02-28"],   // Februar ohne 30.
  ["2027-11-30", 3, "2028-02-29"],   // Schaltjahr
  ["2026-08-31", 3, "2026-11-30"],   // November ohne 31.
  ["2026-12-15", 3, "2027-03-15"],   // Jahreswechsel
  ["2026-01-31", 1, "2026-02-28"],
  ["2026-03-31", 3, "2026-06-30"],
  ["2099-12-31", 3, "2100-03-31"],   // 2100 ist kein Schaltjahr — der Tag bleibt
  ["2099-11-30", 3, "2100-02-28"],
];
for (const [von, n, soll] of FAELLE) ok(F.plusMonate(von, n) === soll, `${von} + ${n} Monate = ${soll}`, F.plusMonate(von, n));
ok(L.plusMonate("2026-02-30", 3) === null, "kein gültiger Tag (30.02.) → null, nie geraten");
ok(L.plusMonate("05.10.2026", 3) === null, "deutsches Format ist kein Tag → null");
ok(L.plusMonate("2026-10-05", 1.5) === null, "halbe Monate → null");
// Gegen die Ratenfälligkeit: jeder Tag 2026–2028, drei und sechs Monate.
{
  let abweichung: string | null = null, tage = 0;
  for (let t = Date.UTC(2026, 0, 1); t <= Date.UTC(2028, 11, 31); t += 86_400_000) {
    const tag = new Date(t).toISOString().slice(0, 10);
    tage++;
    for (const n of [3, 6]) {
      const a = F.plusMonate(tag, n), b = faelligkeit(tag, n);
      if (a !== b && !abweichung) abweichung = `${tag} + ${n}: ${a} ≠ faelligkeit ${b}`;
    }
  }
  ok(!abweichung && tage > 1000, `plusMonate = faelligkeit an allen ${tage} Tagen 2026–2028 (3 und 6 Monate)`, abweichung ?? "");
}
ok(L.limitAbIso("2026-07-05", null) === "2026-10-05", "ab = Anker + 3 Monate");
ok(L.limitAbIso("2026-07-05", "2026-09-20") === "2026-12-20", "ab = späteres von Anker+3 und letztem Gespräch+3");
ok(L.limitAbIso("2026-07-05", "2026-01-10") === "2026-10-05", "ein altes Gespräch verschiebt nichts nach vorn");
ok(L.limitAbIso(null, null) === null, "ohne Anker und ohne Gespräch: keine Frist (null)");
ok(L.tagText("2027-02-28") === "28.02.2027" && L.tagKurz("2027-02-28") === "28.02.", "Datumstexte TT.MM.JJJJ / TT.MM.");

// ═══════════════════════════════════════════════════════════════════════════
abschnitt("2 · Gezählt oder nicht");
ok(F.limitGezaehlt({ status: "erledigt", erledigtAm: "2026-10-01T10:00:00Z" }) === true, "erledigt zählt");
ok(F.limitGezaehlt({ status: "erledigt", erledigtAm: null }) === true, "erledigt zählt auch ohne erledigt_am (Altbestand)");
ok(F.limitGezaehlt({ status: "verpasst", erledigtAm: new Date() }) === false, "verpasst MIT erledigt_am (Mitarbeiter bestätigt) zählt NICHT — Vertrag: nur geführte");
ok(F.limitGezaehlt({ status: "verpasst", erledigtAm: null }) === false, "verpasst OHNE erledigt_am (automatisch nach 12 h) zählt NICHT");
ok(F.limitGezaehlt({ status: "verpasst", erledigtAm: undefined }) === false, "verpasst ohne Feld zählt nicht");
ok(F.limitGezaehlt({ status: "abgesagt", erledigtAm: "2026-10-01" }) === false, "abgesagt zählt nie");
ok(F.limitGezaehlt({ status: "gebucht", erledigtAm: null }) === false, "gebucht zählt nicht");

// ═══════════════════════════════════════════════════════════════════════════
abschnitt("3 · Gründe, Reihenfolge, Stichtag");
const basis: L.LimitEingabe = {
  paketKey: "pro", bezahlt: true, globalKunde: false, startGefuehrt: true, ankerIso: "2026-07-05",
  rueckstandNr: null, beendet: false, letztesGezaehltIso: null, gebucht: null, letztes: null, heuteIso: "2026-10-05",
};
const g = (e: Partial<L.LimitEingabe>) => L.limitAnspruchAus({ ...basis, ...e });
const GEBUCHT: L.LimitGebucht = { beginn: "2026-10-20T08:00:00.000Z", datumText: "20.10.2026", uhrzeit: "10:00", mit: "Herrn Stripling", vorbei: false, absageLink: "/termin/absagen/x?anrede=sie" };
ok(g({}).grund === "frei" && g({}).buchbar, "am Stichtag (Anker + 3 Monate) buchbar", g({}));
ok(g({ heuteIso: "2026-10-04" }).grund === "sperrfrist", "einen Tag vorher: Sperrfrist");
ok(g({ heuteIso: "2026-10-04" }).abText === "05.10.2026", "Sperrfrist nennt den Tag „05.10.2026“", g({ heuteIso: "2026-10-04" }).abText);
ok(g({ heuteIso: "kaputt" }).grund === "sperrfrist", "ein unlesbares „heute“ schaltet nichts frei");
ok(g({ ankerIso: "2026-11-30", heuteIso: "2027-02-27" }).grund === "sperrfrist" && g({ ankerIso: "2026-11-30", heuteIso: "2027-02-28" }).grund === "frei",
  "Monatsende: Anker 30.11. → ab 28.02. (27.02. gesperrt, 28.02. frei)");
ok(g({ letztesGezaehltIso: "2026-09-01", heuteIso: "2026-11-30" }).grund === "sperrfrist"
  && g({ letztesGezaehltIso: "2026-09-01", heuteIso: "2026-12-01" }).grund === "frei", "letztes gezähltes Gespräch 01.09. → ab 01.12.");
ok(g({ ankerIso: null, letztesGezaehltIso: null }).grund === "frei", "ohne Anker und ohne Gespräch: frei (keine belegbare Frist)");
ok(g({ globalKunde: true }).grund === "global" && !g({ globalKunde: true }).buchbar, "Global-Kunde (E-272): nie");
for (const k of ["start", "schufa", "global_struktur", null, ""]) ok(g({ paketKey: k }).grund === "kein_paket", `Paket „${k}“: kein Limit-Gespräch`);
for (const k of ["pro", "ultra", "highend", "PRO", " Ultra "]) ok(g({ paketKey: k }).grund === "frei", `Paket „${k}“: Limit-Gespräch`);
ok(g({ bezahlt: false }).grund === "nicht_bezahlt", "unbezahlt: nicht buchbar");
ok(g({ beendet: true }).grund === "beendet", "Vertrag beendet: nicht buchbar");
ok(g({ gebucht: GEBUCHT }).grund === "gebucht" && g({ gebucht: GEBUCHT }).gebucht?.datumText === "20.10.2026", "ein gebuchtes offenes Gespräch: „gebucht“ mit Datum");
ok(g({ rueckstandNr: 3 }).grund === "rueckstand" && g({ rueckstandNr: 3 }).rueckstandNr === 3, "überfällige Rate: Rückstand");
ok(g({ startGefuehrt: false }).grund === "start_fehlt", "Startgespräch fehlt");
// Reihenfolge
ok(g({ globalKunde: true, paketKey: "start" }).grund === "global", "Reihenfolge: Global vor Paket");
ok(g({ paketKey: "start", bezahlt: false }).grund === "kein_paket", "Reihenfolge: Paket vor Zahlung");
ok(g({ bezahlt: false, beendet: true }).grund === "nicht_bezahlt", "Reihenfolge: Zahlung vor Vertragsende");
ok(g({ beendet: true, gebucht: GEBUCHT }).grund === "beendet", "Reihenfolge: beendet vor gebucht");
ok(g({ gebucht: GEBUCHT, rueckstandNr: 2, startGefuehrt: false }).grund === "gebucht", "Reihenfolge: gebucht vor Rückstand und Startgespräch");
ok(g({ rueckstandNr: 2, startGefuehrt: false }).grund === "rueckstand", "Reihenfolge: Rückstand vor Startgespräch (wie die Zuständigkeit)");
ok(g({ startGefuehrt: false, heuteIso: "2026-08-01" }).grund === "start_fehlt", "Reihenfolge: Startgespräch vor Sperrfrist");
ok(g({ rueckstandNr: 2 }).abIso === "2026-10-05", "„ab“ wird auch bei anderem Grund mitgerechnet (für die Akte)");
// E-283 (#23): fristOffen ist dieselbe Bedingung wie der Grund „sperrfrist“.
ok(g({ heuteIso: "2026-10-04" }).fristOffen === true && g({}).fristOffen === false, "fristOffen: am Vortag offen, am Stichtag nicht");
ok(g({ ankerIso: null }).fristOffen === false, "fristOffen: ohne Frist nie offen");
ok(g({ heuteIso: "kaputt" }).fristOffen === true, "fristOffen: ein unlesbares „heute“ hält die Frist offen");
for (const h of ["2026-09-01", "2026-10-04", "2026-10-05", "2026-12-24"]) {
  const x = g({ heuteIso: h });
  ok(x.fristOffen === (x.grund === "sperrfrist"), `fristOffen = Grund „sperrfrist“ (heute ${h})`, x);
}
// E-283 (#20): Vertrag beendet — auch ein ohne Kündigung gestopptes Abo, sobald der Monat der letzten Rate vorbei ist.
const vb = (e: Partial<Parameters<typeof L.limitVertragBeendet>[0]>) => F.limitVertragBeendet({
  gekuendigt: false, vertragEndeErreicht: false, aboGestoppt: false, letzteRateFaelligIso: null, heuteIso: "2026-10-05", ...e,
});
ok(vb({}) === false, "beendet: laufendes Abo ohne Kündigung und ohne Stopp → nein");
ok(vb({ aboGestoppt: true, letzteRateFaelligIso: "2026-08-05" }) === true, "beendet: gestoppt ohne Kündigung, letzte Rate 05.08., heute 05.10. → ja");
ok(vb({ aboGestoppt: true, letzteRateFaelligIso: "2026-09-20" }) === false, "beendet: gestoppt, letzte Rate 20.09. — der bezahlte Monat läuft bis 20.10. → nein");
ok(vb({ aboGestoppt: true, letzteRateFaelligIso: "2026-09-05" }) === true, "beendet: gestoppt, letzte Rate 05.09. — am 05.10. ist der Monat vorbei → ja");
ok(vb({ aboGestoppt: true, letzteRateFaelligIso: "2026-08-31", heuteIso: "2026-09-29" }) === false
  && vb({ aboGestoppt: true, letzteRateFaelligIso: "2026-08-31", heuteIso: "2026-09-30" }) === true, "beendet: Monatsende 31.08. + 1 Monat = 30.09.");
ok(vb({ aboGestoppt: true, letzteRateFaelligIso: null }) === true, "beendet: gestoppt ohne jede Rate → ja (es läuft nichts)");
ok(vb({ gekuendigt: true, aboGestoppt: true, vertragEndeErreicht: false, letzteRateFaelligIso: "2026-01-05" }) === false,
  "beendet: gekündigt (setzt abo_gestoppt_am sofort), Vertragsende in der Zukunft → nein");
ok(vb({ gekuendigt: true, aboGestoppt: true, vertragEndeErreicht: true }) === true, "beendet: gekündigt, Vertragsende vorbei → ja");
ok(vb({ gekuendigt: true, vertragEndeErreicht: false }) === false, "beendet: gekündigt ohne erreichtes Ende → nein");
ok(vb({ aboGestoppt: true, letzteRateFaelligIso: "2026-09-20", heuteIso: "kaputt" }) === true, "beendet: unlesbares „heute“ schaltet nichts frei");
ok(g({ beendet: vb({ aboGestoppt: true, letzteRateFaelligIso: "2026-06-05" }) }).grund === "beendet", "gestopptes Abo nach dem letzten Monat: Grund „beendet“");
// Zusätze und Akte
ok(L.limitZusatz(g({})) === "jetzt buchbar", "Mehr: „jetzt buchbar“", L.limitZusatz(g({})));
ok(L.limitZusatz(g({ heuteIso: "2026-09-01" })) === "ab 05.10.", "Mehr: „ab 05.10.“", L.limitZusatz(g({ heuteIso: "2026-09-01" })));
ok(L.limitZusatz(g({ gebucht: GEBUCHT })) === "gebucht 20.10., 10:00 Uhr", "Mehr: „gebucht 20.10., 10:00 Uhr“", L.limitZusatz(g({ gebucht: GEBUCHT })));
ok(L.limitZusatz(g({ gebucht: { ...GEBUCHT, vorbei: true } })) === "", "Mehr: ein vorbeiges, nicht vermerktes Gespräch ohne Zusatz");
ok(L.limitZusatz(g({ paketKey: "start" })) === "" && L.limitZusatz(null) === "", "Mehr: ohne Leistung oder Stand kein Zusatz");
ok(L.limitStandText(g({})) === "Limit-Gespräch: jetzt buchbar", "Akte: jetzt buchbar");
ok(L.limitStandText(g({ heuteIso: "2026-09-01" })) === "Limit-Gespräch: ab 05.10.2026", "Akte: ab 05.10.2026", L.limitStandText(g({ heuteIso: "2026-09-01" })));
ok(L.limitStandText(g({ gebucht: GEBUCHT })) === "Limit-Gespräch: gebucht 20.10.2026, 10:00 Uhr", "Akte: gebucht …");
ok(L.limitStandText(g({ paketKey: "start" })) === null && L.limitStandText(g({ globalKunde: true })) === null, "Akte: FIAON Start und Global ohne Zeile");

// ═══════════════════════════════════════════════════════════════════════════
abschnitt("4 · Die Sätze");
const beispiel = { datumText: "20.10.2026", uhrzeit: "10:00", mit: "Herrn Stripling" };
const saetze: [string, string][] = [];
for (const [k, v] of Object.entries(L.LIMIT_TEXTE)) {
  if (typeof v === "string") saetze.push([k, v]);
  else if (k === "unterzeile") { saetze.push([k, v("Herrn Stripling" as never)]); saetze.push([`${k}()`, v(null as never)]); }
  else if (k === "sperrfrist" || k === "rueckstandAb" || k === "startFehltAb") saetze.push([k, (v as (s: string) => string)("05.01.2027")]);
  else if (k === "gebuchtErfolg") { saetze.push([k, (v as any)(beispiel, true)]); saetze.push([`${k}(ohne Mail)`, (v as any)(beispiel, false)]); }
  else saetze.push([k, (v as (t: typeof beispiel) => string)(beispiel)]);
}
saetze.push(["Vertrag § 3 (Pakete)", LIMIT_GESPRAECH]);
for (const p of ANTRAG_NEU_PAKETE) saetze.push([`Einleitung ${p.key}`, p.intro]);
ok(saetze.length >= 20, `alle Sätze gesammelt (${saetze.length})`);
for (const [k, t] of saetze) {
  const treffer = wandPruefen(t).filter((x) => x.art === "verboten" || x.art === "zusage");
  ok(treffer.length === 0, `Wortwand: „${k}“`, treffer.map((x) => `${x.art}: ${x.treffer}`).join(", "));
  ok(!/über den rahmen entscheidet unsere partnerbank/i.test(t), `kein Bank-Satz aus E-281: „${k}“`);
  ok(!/\b(du|dein|deine|dich|dir)\b/i.test(t), `Sie-Form: „${k}“`);
}
ok(L.LIMIT_TEXTE.titel === "Limit-Erhöhung anfragen" && L.LIMIT_TEXTE.knopf === "Limit-Gespräch buchen", "Titel und Knopf wie beauftragt");
ok(L.LIMIT_TEXTE.unterzeile("Herrn Stripling") === "Alle drei Monate besprechen Sie mit Herrn Stripling den nächsten Schritt zu einem höheren Limit.", "Unterzeile wörtlich");
ok(L.LIMIT_TEXTE.bank === "Über Ihr Limit entscheidet die Bank – im Gespräch bereiten wir Ihren nächsten Schritt vor.", "Bank-Zeile wörtlich");
ok(L.LIMIT_TEXTE.sperrfrist("05.01.2027") === "Ihr nächstes Limit-Gespräch können Sie ab dem 05.01.2027 buchen.", "Sperrfrist wörtlich");
ok(L.LIMIT_TEXTE.rueckstand === "Sobald Ihre offene Rate beglichen ist, können Sie Ihr Limit-Gespräch buchen.", "Rückstand wörtlich");
ok(L.LIMIT_TEXTE.keinPaket === "Das Limit-Gespräch gehört zu FIAON Pro, Ultra und High-End.", "Start-Paket wörtlich");
ok(L.LIMIT_TEXTE.startFehlt === "Zuerst führen Sie Ihr Startgespräch – danach können Sie hier Ihr Limit-Gespräch buchen.", "Startgespräch fehlt wörtlich");
// E-283 (#23): Rückstand und fehlendes Startgespräch nennen bei laufender Frist den Tag — sonst der feste Satz.
{
  const rS = L.limitGrundSatz(g({ ankerIso: "2026-10-01", rueckstandNr: 2, heuteIso: "2026-11-05" }));
  ok(!!rS && rS.includes("ab dem 01.01.2027") && rS.startsWith("Sobald Ihre offene Rate beglichen ist"), "Rückstand mit offener Frist: „… ab dem 01.01.2027 buchen.“", rS);
  const rO = L.limitGrundSatz(g({ ankerIso: "2026-07-01", rueckstandNr: 2, heuteIso: "2026-11-05" }));
  ok(rO === L.LIMIT_TEXTE.rueckstand, "Rückstand nach der Frist: der feste Satz ohne Datum", rO);
  const sS = L.limitGrundSatz(g({ ankerIso: "2026-10-01", startGefuehrt: false, heuteIso: "2026-11-05" }));
  ok(!!sS && sS.includes("ab dem 01.01.2027") && sS.startsWith("Zuerst führen Sie Ihr Startgespräch"), "Startgespräch fehlt mit offener Frist: „… ab dem 01.01.2027 buchen.“", sS);
  const sO = L.limitGrundSatz(g({ ankerIso: "2026-07-01", startGefuehrt: false, heuteIso: "2026-11-05" }));
  ok(sO === L.LIMIT_TEXTE.startFehlt, "Startgespräch fehlt nach der Frist: der feste Satz", sO);
  ok(L.limitGrundSatz(g({ ankerIso: null, rueckstandNr: 1 })) === L.LIMIT_TEXTE.rueckstand, "Rückstand ohne belegbare Frist: der feste Satz");
}
ok(L.LIMIT_TEXTE.keineZeit === "Gerade ist keine Zeit frei. Schauen Sie morgen wieder vorbei – oder schreiben Sie uns an support@fiaon.com.", "Keine Zeit frei wörtlich");
ok(!/(melden uns|rufen sie (zurück|an)|rückruf)/i.test(L.LIMIT_TEXTE.keineZeit), "keine Rückruf-Zusage bei leerem Kalender");
// Vertrag § 3 — wörtlich, nur bei Paketen mit der Leistung, und nur in § 3.
const SATZ_3 = "Das erste Limit-Gespräch ist drei Monate nach Eingang der ersten Monatsrate im Kundenbereich buchbar, jedes weitere drei Monate nach dem letzten geführten. Nicht genutzte Gespräche werden nicht nachgeholt.";
const vertrag = (paketKey: string) => antragNeuVertragHtml({
  ref: "FIAON-PRUEF", anrede: "Frau", vorname: "Erika", nachname: "Muster", geburt: "", strasse: "", nr: "", plz: "", ort: "",
  land: "DE", email: "", paketKey, limit: 1000, sofortBeginn: true,
});
for (const p of ANTRAG_NEU_PAKETE) {
  const html = vertrag(p.key);
  const soll = L.paketMitLimit(p.key);
  ok(p.leistungen.includes(LIMIT_GESPRAECH) === soll, `Leistungen ${p.key}: Limit-Gespräch ${soll ? "enthalten" : "nicht enthalten"}`);
  ok(html.includes(SATZ_3) === soll, `Vertrag ${p.key}: Buchungssatz ${soll ? "steht in § 3" : "fehlt (Paket ohne Leistung)"}`);
  if (soll) {
    const i3 = html.indexOf("§ 3 Leistungen"), i4 = html.indexOf("§ 4 Mitwirkung"), iS = html.indexOf(SATZ_3);
    ok(i3 >= 0 && iS > i3 && iS < i4, `Vertrag ${p.key}: der Satz steht zwischen § 3 und § 4`);
    ok(html.split(SATZ_3).length === 2, `Vertrag ${p.key}: der Satz steht genau einmal`);
  }
}
ok(ANTRAG_NEU_LEISTUNG_FASSUNG === "AN-2026-10-05b" && ANTRAG_NEU_VERTRAG_FASSUNG === "PV-2026-10-05b", "Fassungen hochgezählt (AN-/PV-2026-10-05b)");
ok(vertrag("pro").includes("Vertragsfassung PV-2026-10-05b"), "der Vertrag trägt die neue Fassung");

// ═══════════════════════════════════════════════════════════════════════════
abschnitt("5 · Art, Legende, Leitfaden — und Quelltext-Wachen");
const marke = terminArtAusQuelle("limit_gespraech");
ok(marke.art === "limit" && marke.text === "Limit-Gespräch" && !/unbekannt/.test(marke.grund), "Art „limit_gespraech“ → Marke „Limit-Gespräch“", marke);
ok(terminArtAusQuelle("support").art === "support" && terminArtAusQuelle("support").text !== "Vertrieb", "Nebenfund: „support“ ist nicht mehr „Vertrieb“");
ok(TERMIN_ARTEN.some((a) => a.art === "limit") && TERMIN_ARTEN.some((a) => a.art === "support"), "Legende kennt Limit-Gespräch und Support");
ok(new Set(TERMIN_ARTEN.map((a) => a.ton)).size === TERMIN_ARTEN.length, "jede Art der Legende hat einen eigenen Farbton");
ok(leitfadenFuerLage("alles_gut", "limit_gespraech") === "limit" && leitfadenVonKey("limit").key === "limit", "Leitfaden „Limit-Gespräch“ für einen Limit-Termin heute");
// E-283: Kunden lesen nie die internen Arten — in Mails und im Kundenbereich.
{
  const intern = ["Vertrieb", "Onboarding", "Support", "Zahlung", "Rückruf", "Gründer"];
  const soll: [string, string][] = [
    ["limit_gespraech", "Limit-Gespräch"], ["onboarding_call", "Startgespräch"], ["onboarding", "Startgespräch"],
    ["global", "Gespräch zu FIAON Global"], ["support", "Gespräch"], ["nichterreicht_mail", "Gespräch"], ["portal", "Gespräch"],
    ["agent_manuell", "Gespräch"], ["inkasso_call", "Gespräch"], ["gruender", "Gespräch"], ["", "Gespräch"], ["irgendwas", "Gespräch"],
  ];
  for (const [q, t] of soll) {
    const k = terminArtFuerKunden(q);
    ok(k === t && !intern.some((w) => k.includes(w)), `Kunden-Art „${q}“ → „${t}“`, k);
  }
}
for (const s of leitfadenVonKey("limit").schritte) {
  const t = wandPruefen(`${s.text ?? ""} ${s.satz ?? ""}`).filter((x) => x.art === "verboten");
  ok(t.length === 0, `Leitfaden-Schritt „${s.titel}“ ohne Wortwand-Treffer`, t.map((x) => x.treffer).join(", "));
}
// Quelltext-Wachen: Diese Fehler wären STILL (kein Typfehler, kein Absturz) — darum hier.
const termine = lies("server/lib/fiaon-termine.ts");
const eigener = termine.slice(termine.indexOf("const eigenerRueckruf ="), termine.indexOf("const abgeleitet = eigenerRueckruf"));
ok(/gewuenscht === LIMIT_QUELLE/.test(eigener), "terminBuchen: limit_gespraech steht in eigenerRueckruf (sonst still „support“)");
ok(/limit_gespraech: \{ minuten: 20,/.test(termine), "QUELLEN: limit_gespraech mit 20 Minuten");
ok(/constraint_name[^\n]*fiaon_termine_ein_limit_offen/.test(termine), "terminBuchen übersetzt den Index-Verstoß in „limit_offen“");
const route = lies("server/routes/fiaon-termin.ts");
const oeffentlich = route.slice(route.indexOf(`router.post("/termin/:token/buchen"`), route.indexOf(`router.post("/termin/absagen/:stornoToken"`));
ok(/const gewuenscht = "auto";/.test(oeffentlich) && /quelle: gewuenscht,/.test(oeffentlich) && !/LIMIT_QUELLE|limit_gespraech/.test(oeffentlich),
  "öffentliche Route /termin/:token/buchen bucht weiter fest „auto“");
ok(/kundenBuchungAusfuehren\(/.test(oeffentlich) && !/await terminBuchen\(/.test(oeffentlich), "öffentliche Route nutzt den gemeinsamen Buchungsteil (keine Kopie)");
const bereich = lies("server/routes/fiaon-kunde-bereich.ts");
ok(/t\.quelle !== LIMIT_QUELLE/.test(bereich), "Bereich: der Startgespräch-Rückfall nimmt Limit-Gespräche aus");
const buchenRoute = bereich.slice(bereich.indexOf(`router.post("/kunde/:ref/limit-gespraech/buchen"`));
ok(/requireKunde/.test(buchenRoute.slice(0, 200)) && /req\.kundeRef!/.test(buchenRoute) && !/req\.params\.ref/.test(buchenRoute.slice(0, 3000)), "Buchungsroute: requireKunde und die Referenz aus der Sitzung");
const lib = lies("server/lib/fiaon-limit-gespraech.ts");
const buchenLib = lib.slice(lib.indexOf("export async function limitBuchen("));
ok(buchenLib.indexOf("limitAnspruchFuer(ref)") >= 0 && buchenLib.indexOf("limitAnspruchFuer(ref)") < buchenLib.indexOf("kundenBuchungAusfuehren("), "limitBuchen prüft den Anspruch VOR dem Buchen erneut");
// ── E-283 (Gegenprüfung 05.10.2026): weitere stille Fehler, wieder nur am Quelltext ──
// #10: Die Herkunft aus dem Rumpf der öffentlichen Route schaltet die Ableitung nicht ab.
ok(!/eingabe\.herkunft === "agent"/.test(eigener) && /eingabe\.artVomMitarbeiter === true/.test(eigener),
  "terminBuchen: die Art gilt über artVomMitarbeiter, nicht über herkunft „agent“");
const agentTermine = route.slice(route.indexOf(`router.post("/agent/termine", requireAgent`));
ok(/artVomMitarbeiter: true/.test(agentTermine.slice(0, 6000)), "POST /agent/termine setzt artVomMitarbeiter (hinter requireAgent)");
const kundenBuchung = route.slice(route.indexOf("export async function kundenBuchungAusfuehren("), route.indexOf(`router.get("/termin/:token"`));
ok(kundenBuchung.length > 100 && !/artVomMitarbeiter/.test(kundenBuchung), "kundenBuchungAusfuehren setzt artVomMitarbeiter nie");
// #2: „erledigt“ für ein Limit-Gespräch nur mit gefuehrt: true — in beiden Türen, VOR terminErgebnisSetzen.
const ergebnisRoute = route.slice(route.indexOf(`router.post("/agent/termine/:id/ergebnis"`));
const wand2 = ergebnisRoute.indexOf("req.body?.gefuehrt !== true"), kern2 = ergebnisRoute.indexOf("terminErgebnisSetzen({");
ok(wand2 > 0 && kern2 > wand2 && /String\(termin\.quelle\) === LIMIT_QUELLE && String\(ergebnis\) === "erledigt"/.test(ergebnisRoute.slice(0, kern2)),
  "/agent/termine/:id/ergebnis: Limit-Gespräch „erledigt“ ohne gefuehrt → 409, vor terminErgebnisSetzen");
const mara = lies("server/routes/fiaon-mara-steuerpult.ts");
const maraRoute = mara.slice(mara.indexOf(`router.post("/chef/mara/termine/:id/ergebnis"`));
const wandM = maraRoute.indexOf("req.body?.gefuehrt !== true"), kernM = maraRoute.indexOf("terminErgebnisSetzen({");
ok(wandM > 0 && kernM > wandM && /LIMIT_QUELLE && ergebnis === "erledigt"/.test(maraRoute.slice(0, kernM)), "/chef/mara/termine/:id/ergebnis: dieselbe Wand");
ok(/ergebnis: e, \.\.\.\(e === "erledigt" \? \{ gefuehrt: true \}/.test(lies("client/src/components/admin/ChefMaraTermine.tsx")), "Mara-Steuerpult: „Erledigt“ sagt gefuehrt: true");
const kal = lies("client/src/pages/agent/calendar.tsx");
ok(/const LIMIT_NICHT_GEFUEHRT = \["nicht_erreicht", "mailbox", "nummer_falsch", "notiz"\];/.test(kal), "Kalender: Niemand dran, Mailbox, Falsche Nummer, Ohne Ergebnis = nicht geführt");
const abschluss = kal.slice(kal.indexOf("const abschlussBuchen = async"), kal.indexOf("const nichtZustande = async"));
ok(abschluss.indexOf("tIstLimit(a) && LIMIT_NICHT_GEFUEHRT.includes(art)") > 0
  && abschluss.indexOf("tIstLimit(a) && LIMIT_NICHT_GEFUEHRT.includes(art)") < abschluss.indexOf("/aktivitaet")
  && /nichtZustande\(a, art === "nummer_falsch" \? "nummer_falsch" : "nicht_erschienen"\)/.test(abschluss),
  "Kalender: ein nicht geführtes Limit-Gespräch geht den Weg „kam nicht zustande“, nie „erledigt“");
ok(/gefuehrt: !LIMIT_NICHT_GEFUEHRT\.includes\(art\)/.test(abschluss), "Kalender: der Haken sagt dem Server, ob geführt");
// #19: Der Kunde sagt nur Kommendes ab.
const absagen = termine.slice(termine.indexOf("export async function terminAbsagen("));
ok(/const auchBegonnene = wer !== "kunde";/.test(absagen) && /AND \(\$\{auchBegonnene\} OR beginn > NOW\(\)\)/.test(absagen.slice(0, 1500)),
  "terminAbsagen: Kundenabsage nur vor Beginn (Sperrfrist nicht umgehbar)");
// #22 und die Kunden-Art in den Mails.
const followup = lies("server/routes/fiaon-followup.ts");
ok(/String\(t\.quelle\) === LIMIT_QUELLE \? "\?anrede=sie"/.test(followup), "Erinnerung: Absage-Link des Limit-Gesprächs in der Sie-Fassung");
ok(/termin_art: terminArtFuerKunden\(t\.quelle\)/.test(followup), "Erinnerung: Kunden-Art");
ok(/termin_art: terminArtFuerKunden\(buchung\.quelle\)/.test(route) && /termin_art: terminArtFuerKunden\(termin\.quelle\)/.test(route), "Bestätigung (Buchung, Übergabe): Kunden-Art");
ok(/terminArtFuerKunden\(termin\.quelle\)/.test(absagen), "Absage durch das Team: Kunden-Art");
ok(!/termin_art: [^\n]*terminArtAusQuelle/.test(route + followup + termine), "keine Kundenmail nimmt termin_art aus terminArtAusQuelle");
ok(/art: terminArtFuerKunden\(t\.quelle\)/.test(bereich), "Kundenbereich: Terminliste mit Kunden-Art");
// #20: Der Server liest den Stopp und fragt die eine Regel.
ok(/abo_gestoppt_am/.test(lib.slice(lib.indexOf("export async function limitAnspruchFuer("), lib.indexOf("// E-272: Global-Kunden"))) && /limitVertragBeendet\(\{/.test(lib),
  "limitAnspruchFuer: liest abo_gestoppt_am und entscheidet mit limitVertragBeendet");
// #23: Die Buchungsroute nimmt dieselben Sätze wie die Seite.
ok(/limitGrundSatz\(a\)/.test(buchenRoute.slice(0, 3000)) && !/LIMIT_TEXTE\.rueckstand\b/.test(buchenRoute.slice(0, 3000)), "Buchungsroute: Ablehnungssätze aus limitGrundSatz");
// #24/#25: Unterzeile nur mit Anspruch; nach der Buchung ist die Zeitwahl gesperrt.
const limitSeite = lies("client/src/pages/app/Limit.tsx");
ok(/const mitAnspruch = !!a && !\["kein_paket", "global", "beendet", "nicht_bezahlt"\]\.includes\(a\.grund\);/.test(limitSeite)
  && /\{mitAnspruch && <small>\{LIMIT_TEXTE\.unterzeile/.test(limitSeite) && /\{mitAnspruch && <p[^>]*>\{LIMIT_TEXTE\.bank\}/.test(limitSeite),
  "Limit-Seite: Unterzeile und Bank-Satz nur mit Anspruch dem Grunde nach");
const erfolg = limitSeite.slice(limitSeite.indexOf("if (r?.ok && r.json?.ok) {"), limitSeite.indexOf("// Jeder Ausgang ist sichtbar"));
ok(/setGewaehlt\(null\);/.test(erfolg) && /setEbenGebucht\(true\);/.test(erfolg) && /disabled=\{!gewaehlt \|\| bucht \|\| ebenGebucht\}/.test(limitSeite),
  "Limit-Seite: nach der Buchung Auswahl leer und Knopf gesperrt, bis der neue Stand da ist");
// #15: AGB § 4 Abs. 1 sagt dieselbe Regel wie Vertrag und Code.
const agb = lies("client/src/pages/agb.tsx");
ok(agb.includes("Das erste Limit-Gespräch kann er dort frühestens drei Monate nach Eingang der ersten Monatsrate buchen, jedes weitere frühestens drei Monate nach dem letzten geführten Limit-Gespräch.")
  && !agb.includes("höchstens einmal je drei Monate anfragen"), "AGB § 4 Abs. 1: erste Rate + 3 Monate, danach 3 Monate nach dem letzten GEFÜHRTEN");
const mig = lies("db/migrations/092_limit_gespraech.sql");
ok(/CREATE UNIQUE INDEX IF NOT EXISTS fiaon_termine_ein_limit_offen/.test(mig) && /WHERE quelle = 'limit_gespraech' AND status = 'gebucht'/.test(mig) && !/REFERENCES|DROP/i.test(mig.replace(/^--.*$/gm, "")),
  "Migration 092: eindeutiger Teilindex, IF NOT EXISTS, kein Fremdschlüssel, kein DROP");

console.log(`\n${fehler ? "✗" : "✓"} ${geprueft - fehler}/${geprueft} Prüfungen bestanden${fehler ? `, ${fehler} Fehler` : ""}${ROT ? " (ROTPROBE)" : ""}`);
if (ROT) console.log(fehler ? "ROTPROBE ERFÜLLT: Mit den eingebauten Fehlern wird der Prüfstand rot." : "ROTPROBE GESCHEITERT: Mit den eingebauten Fehlern blieb alles grün.");
process.exit(ROT ? (fehler ? 0 : 1) : (fehler ? 1 : 0));
