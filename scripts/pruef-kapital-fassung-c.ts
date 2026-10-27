// ═══════════════════════════════════════════════════════════════════════════
// PRÜFSTAND: KAPITAL-ANGEBOT FASSUNG C — PRIVATPERSONEN (Register E-432, 27.10.2026)
//
// Rein, ohne Datenbank und ohne Netz. Alle Daten sind MUSTER (Repo öffentlich): Max Mustermann, Muster Partner LLC, *.example.
//
//   1 Rechner gegen eine UNABHÄNGIGE Nachrechnung (Bisektion auf die Rate, eigene Zinstreppe) für T = 5 … 15 Jahre
//   2 Grenzfälle (Stufen der Zinstreppe, Laufzeit außerhalb, ohne Zins, Zins schon in den ratenfreien Monaten)
//   3 Vertrag: Pflichtsätze (Widerrufsbelehrung + Formular, Sofortbeginn/Wertersatz, Registerstand der Bürgin, Kapital frei,
//     kein Steuermodell, Garantie mit Ruhen, Ziel ≠ Garantie, Konditionen, Raten pünktlich, Währung, Endpreise, Befugnisse …)
//   4 Kein Bankname, keine Kartenrahmen-Zusage, kein „bis zu“, kein „60x“ — in Vertrag, Seite, Übersicht, Annahme, Etappen
//   5 Kosten vollständig in Seite, Vertrag, Übersicht und Informationen vor Vertragsschluss
//   6 Wortwand (Hausregeln + E-188) — „garant…“ nur dort, wo die vertragliche Garantie gemeint ist; das gesetzliche Muster bleibt wörtlich
//   7 Prüfsumme, Annahmevermerk, Parameter- und Kundenprüfung, Teil 2 / Auszahlung, „Mein Auftrag“, Aufgaben-Texte
//
//   npx tsx scripts/pruef-kapital-fassung-c.ts
//   … --privat <angebot.json>   prüft zusätzlich, dass KEIN Wert des echten Kunden in den Code-Dateien steht (Repo öffentlich)
//   … --mail <Mail.txt>         prüft den Mailtext (Wortwand, kein Bankname, {{LINK}} vorhanden)
// ═══════════════════════════════════════════════════════════════════════════
import { readFileSync, existsSync } from "node:fs";
import path from "node:path";

for (const k of ["BREVO_API_KEY", "MAKE_WEBHOOK_URL", "OPENAI_API_KEY"]) if (process.env[k]) { console.error(`ABBRUCH: ${k} ist gesetzt.`); process.exit(3); }
process.env.DATABASE_URL = "postgres://pruefstand:ohne@127.0.0.1:1/keine-datenbank";
globalThis.fetch = (async () => { throw new Error("Prüfstand: kein Netz"); }) as typeof fetch;
const arg = (n: string): string | null => { const i = process.argv.indexOf(n); return i > 0 && process.argv[i + 1] && !process.argv[i + 1].startsWith("--") ? process.argv[i + 1] : null; };

const WURZEL = path.resolve(import.meta.dirname ?? ".", "..");
let gut = 0; const rot: string[] = [];
function ok(bed: unknown, text: string, fund: unknown = ""): void { if (bed) { gut++; return; } rot.push(text); console.log(`  ROT   ${text}${fund !== "" ? `  →  ${typeof fund === "string" ? fund : JSON.stringify(fund).slice(0, 500)}` : ""}`); }
const abschnitt = (t: string) => console.log(`\n── ${t} ${"─".repeat(Math.max(0, 72 - t.length))}`);

const C = await import("../shared/fiaon-global-angebot-kapital-c");
const K = await import("../shared/fiaon-global-angebot-kapital");
const G = await import("../shared/fiaon-global");
const W = await import("../shared/fiaon-global-wortregeln");
const B = await import("../shared/fiaon-global-befugnisse");
const WR = await import("../shared/fiaon-global-widerruf");

// ── Musterdaten ──────────────────────────────────────────────────────────────
const KUNDE_ROH = {
  art: "privat", anrede: "Herr", vorname: "Max", nachname: "Mustermann", geburtsdatum: "1980-01-15", geburtsort: "Musterstadt", staatsangehoerigkeit: "deutsch",
  strasse: "Musterweg 1", plz: "12345", ort: "Musterstadt", land: "DE", email: "max.mustermann@beispiel.example", telefon: "",
  ausweise: [{ art: "reisepass", nummer: "C01X00T47", gueltigBis: "2033-01-01", behoerde: "Stadt Musterstadt" }, { art: "personalausweis", nummer: "T22000129", gueltigBis: "2032-05-05", behoerde: "Stadt Musterstadt" }],
};
const BUERGIN = { name: "Muster Partner LLC", bundesstaat: "Florida", anschrift: "1 Example Way, Miami, FL 33100, USA", registernummer: "L00000000000", vertreter: "Erika Muster", funktion: "Manager" };
const PAR = C.kapitalCParameterAus({
  ...C.KAPITAL_C_VORGABEN,
  unterlagen: [{ titel: "Reisepass", am: "2026-10-27" }, { titel: "Personalausweis", am: "2026-10-27" }, { titel: "Gehaltsnachweise August bis Oktober 2026", am: "2026-10-27" }, { titel: "Kontoauszug Oktober 2026", am: "2026-10-27" }],
});
const kunde = C.kapitalCKundePruefen(KUNDE_ROH);
if (!kunde.ok) { console.error("Musterkunde ungültig:", kunde.error); process.exit(1); }
const D = { ref: "FIAON-IA-CMUSTER", fassung: C.KAPITAL_C_FASSUNG, kunde: kunde.kunde, buergin: BUERGIN, parameter: PAR, gueltigBis: "2026-11-10" };
const flach = (s: string) => s.replace(/\s+/g, " ");
const ohneHtml = (h: string) => flach(h.replace(/<[^>]+>/g, " ").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'"));
const absText = (z: { absaetze: { art: string; text?: string; einleitung?: string; zeilen?: string[] }[] }[]) =>
  z.flatMap((x) => x.absaetze.flatMap((a) => (a.art === "p" ? [a.text ?? ""] : [a.einleitung ?? "", ...(a.zeilen ?? [])])));
function sammle(wert: unknown, aus: string[]): string[] {
  if (typeof wert === "string") { if (wert.trim()) aus.push(wert); }
  else if (Array.isArray(wert)) wert.forEach((x) => sammle(x, aus));
  else if (wert && typeof wert === "object") Object.values(wert).forEach((x) => sammle(x, aus));
  return aus;
}

// ═══ 1 RECHNER GEGEN UNABHÄNGIGE NACHRECHNUNG ═══════════════════════════════
abschnitt("1 Laufzeit-Rechner gegen unabhängige Nachrechnung (T = 5 … 15)");
/** Die Zinstreppe, unabhängig formuliert: Jahr n nach dem zinsfreien Teil = Start + n·Schritt. */
function zinsJahrUnabhaengig(m: number): number {
  if (m < 17) return 0;
  let jahrNachStart = 0; let grenze = 17 + 12;
  while (m >= grenze) { jahrNachStart++; grenze += 12; }
  return (1.5 + 0.5 * jahrNachStart) / 100;
}
/** Endsaldo nach allen Raten bei Rate r (Gleitkomma, ohne Rundung). */
function endsaldo(P: number, jahre: number, r: number): number {
  let s = P;
  for (let m = 7; m <= 6 + 12 * jahre; m++) s = s * (1 + zinsJahrUnabhaengig(m) / 12) - r;
  return s;
}
function rateBisektion(P: number, jahre: number): number {
  let lo = 0, hi = P;
  for (let i = 0; i < 200; i++) { const mid = (lo + hi) / 2; if (endsaldo(P, jahre, mid) > 0) lo = mid; else hi = mid; }
  return (lo + hi) / 2;
}
let vorherRate = Infinity; let vorherZinsen = -1;
const P = PAR.betragCents / 100;
const tabelle: string[] = [];
for (let T = 5; T <= 15; T++) {
  const plan = C.kapitalCPlan(PAR, T);
  const r = rateBisektion(P, T);
  ok(Math.abs(plan.monatsrateCents - Math.round(r * 100)) <= 1, `T=${T}: Rate ${plan.monatsrateCents} Cent = unabhängig ${Math.round(r * 100)} Cent (±1)`, { plan: plan.monatsrateCents, r });
  // Unabhängige Cent-Simulation mit DERSELBEN Rate: Zinsen und letzte Rate müssen exakt stimmen, Saldo endet bei null.
  let s = PAR.betragCents; let zinsen = 0; let letzte = 0; const raten = 12 * T;
  for (let m = 7; m <= 6 + raten; m++) {
    const z = Math.round(s * zinsJahrUnabhaengig(m) / 12); s += z; zinsen += z;
    const zahl = m === 6 + raten ? s : plan.monatsrateCents; if (m === 6 + raten) letzte = zahl; s -= zahl;
  }
  ok(s === 0 && plan.zinsenCents === zinsen && plan.letzteRateCents === letzte, `T=${T}: Zinsen ${zinsen} und letzte Rate ${letzte} exakt nachgerechnet, Saldo 0`, { s, zinsen, plan: [plan.zinsenCents, plan.letzteRateCents] });
  ok(Math.abs(plan.letzteRateCents - plan.monatsrateCents) <= 300, `T=${T}: letzte Rate weicht höchstens 3 € ab (Restcent)`, [plan.letzteRateCents, plan.monatsrateCents]);
  ok(plan.rueckzahlungCents === PAR.betragCents + plan.zinsenCents && plan.rueckzahlungCents === (raten - 1) * plan.monatsrateCents + plan.letzteRateCents, `T=${T}: Rückzahlung = Betrag + Zinsen = Summe der Raten`);
  ok(plan.raten === raten && plan.ersteRateMonat === 7 && plan.letzteRateMonat === 6 + raten, `T=${T}: ${raten} Raten, Monat 7 bis ${6 + raten}`);
  const erwartetZuletzt = Math.round(zinsJahrUnabhaengig(6 + raten) * 10_000);
  ok(plan.zinsZuletztBp === erwartetZuletzt, `T=${T}: Zins zuletzt ${erwartetZuletzt / 100} %`, plan.zinsZuletztBp);
  // Zinstreppe: lückenlos von Monat 1 bis zur letzten Rate, Summe der Zinsen, Restschuld am Ende null, jede Stufe mit dem richtigen Zins
  const tr = plan.treppe;
  ok(tr[0].vonMonat === 1 && tr[tr.length - 1].bisMonat === 6 + raten && tr.every((x, i) => i === 0 || x.vonMonat === tr[i - 1].bisMonat + 1), `T=${T}: Zinstreppe lückenlos Monat 1 bis ${6 + raten}`);
  ok(tr.reduce((a, x) => a + x.zinsenCents, 0) === plan.zinsenCents && tr[tr.length - 1].restschuldCents === 0, `T=${T}: Zinsen der Stufen = Zinsen gesamt, Restschuld am Ende 0`);
  ok(tr.every((x) => { for (let m = x.vonMonat; m <= x.bisMonat; m++) if (Math.round(zinsJahrUnabhaengig(m) * 10_000) !== x.zinsBp) return false; return true; }), `T=${T}: jede Stufe trägt den richtigen Zins`);
  ok(tr[0].ratenfrei && tr[0].bisMonat === 6 && tr[0].zinsBp === 0 && tr[1].vonMonat === 7 && tr[1].bisMonat === 16 && tr[1].zinsBp === 0 && tr[2].vonMonat === 17 && tr[2].zinsBp === 150, `T=${T}: Monat 1–6 ratenfrei, 7–16 zinsfrei, ab 17 1,5 %`);
  ok(plan.monatsrateCents < vorherRate && plan.zinsenCents > vorherZinsen, `T=${T}: längere Laufzeit → kleinere Rate, mehr Zinsen`);
  ok(plan.usd.monatsrate === Math.round(plan.monatsrateCents / 100 * PAR.kursUsdJeEur), `T=${T}: Rate in US-$ = Euro × Kurs`);
  vorherRate = plan.monatsrateCents; vorherZinsen = plan.zinsenCents;
  tabelle.push(`${String(T).padStart(2)} J.  Rate ${C.kapitalCEurCent(plan.monatsrateCents).padStart(11)}  Zinsen ${C.kapitalCEurCent(plan.zinsenCents).padStart(12)}  zuletzt ${C.kapitalCProzent(plan.zinsZuletztBp)}`);
}
console.log(tabelle.map((z) => `  ${z}`).join("\n"));

// ═══ 2 GRENZFÄLLE ═══════════════════════════════════════════════════════════
abschnitt("2 Grenzfälle");
{
  const z = (m: number) => C.kapitalCZinsBp(m, PAR);
  ok(z(1) === 0 && z(16) === 0 && z(17) === 150 && z(28) === 150 && z(29) === 200 && z(40) === 200 && z(41) === 250 && z(185) === 850 && z(186) === 850, "Zinstreppe: 16 → 0, 17 → 1,5 %, 28/29 → 1,5/2 %, 40/41 → 2/2,5 %, 185 → 8,5 %");
  const wirft = (j: unknown) => { try { C.kapitalCPlan(PAR, j as number); return false; } catch (e) { return e instanceof RangeError; } };
  ok(wirft(4) && wirft(16) && wirft(10.5) && wirft(Number.NaN) && wirft("10"), "Laufzeit außerhalb 5–15, krumm oder kein Zahlwert → RangeError");
  ok(C.kapitalCLaufzeitGueltig(5, PAR) && C.kapitalCLaufzeitGueltig(15, PAR) && !C.kapitalCLaufzeitGueltig(16, PAR) && C.kapitalCLaufzeiten(PAR).join() === "5,6,7,8,9,10,11,12,13,14,15", "Laufzeiten 5 … 15");
  // Ohne Zins: Rate = Betrag / Raten (gerundet), Restcent in der letzten Rate
  const ohneZins = { ...PAR, betragCents: 1_000_000, zinsStartBp: 0, zinsSchrittBp: 0 };
  const p0 = C.kapitalCPlan(ohneZins, 7);
  ok(p0.zinsenCents === 0 && p0.monatsrateCents === Math.round(1_000_000 / 84) && p0.letzteRateCents === 1_000_000 - 83 * Math.round(1_000_000 / 84), "ohne Zins: Rate = Betrag/Raten, Rest in der letzten Rate", p0);
  // Zins schon in den ratenfreien Monaten (zinsfrei 0): Saldo wächst bis zur ersten Rate
  const frueh = { ...PAR, zinsfreiMonate: 0 };
  const pf = C.kapitalCPlan(frueh, 5);
  ok(pf.treppe[0].ratenfrei && pf.treppe[0].zinsenCents > 0 && pf.treppe[0].restschuldCents > PAR.betragCents && pf.treppe[pf.treppe.length - 1].restschuldCents === 0, "Zins in ratenfreien Monaten: wächst zu, Plan endet trotzdem bei 0");
  ok(C.kapitalCProzent(200) === "2 %" && C.kapitalCProzent(150) === "1,5 %" && !/\b0\s?%/.test(C.kapitalCProzent(300)), "Prozent ohne „,0“ (kein „0 %“ für die Wortwand)");
  ok(C.kapitalCEurCent(233386) === "2.333,86 €" && C.kapitalCUsd(2611.4) === "2.611 US-$", "Formate: 2.333,86 € · 2.611 US-$");
  ok(C.kapitalCOrdnung(17) === "siebzehnten" && C.kapitalCOrdnung(29) === "neunundzwanzigsten" && C.kapitalCOrdnung(7) === "siebten" && C.kapitalCOrdnung(41) === "einundvierzigsten" && C.kapitalCOrdnung(18) === "achtzehnten", "Ordnungszahlen im Vertrag");
}

// ═══ 3 VERTRAG: PFLICHTSÄTZE ═════════════════════════════════════════════════
abschnitt("3 Vertrag: Pflichtsätze");
const ziffern = C.kapitalCZiffern(D);
const vertragText = flach(absText(ziffern).join("\n"));
const rumpf = ohneHtml(C.kapitalCRumpfHtml(D, null));
{
  const wb = WR.globalWiderrufsbelehrung("de");
  ok(wb.abschnitte.flatMap((a) => a.absaetze).every((x) => rumpf.includes(flach(x))) && rumpf.includes(wb.formular.titel) && wb.formular.zeilen.every((x) => rumpf.includes(flach(x))), "Widerrufsbelehrung und Muster-Formular WÖRTLICH in der Anlage");
  ok(/binnen vierzehn Tagen nach Maßgabe der Widerrufsbelehrung in der Anlage/.test(vertragText), "Ziffer 10: Widerrufsrecht mit Verweis auf die Anlage");
  ok(/ausdrücklich verlangt, dass FIAON vor Ablauf der Widerrufsfrist mit der Ausführung beginnt \(Fast-Track\)/.test(vertragText) && /angemessenen Betrag für die bis dahin erbrachten Leistungen/.test(vertragText) && /Widerrufsrecht erlischt, wenn FIAON die Leistungen vollständig erbracht hat/.test(vertragText), "Sofortbeginn: ausdrücklich verlangt, Wertersatz, Erlöschen (§ 356 Abs. 4 / § 357a Abs. 2 BGB)");
  ok(/vor Ablauf der Widerrufsfrist mit der Arbeit beginnt \(Fast-Track\)/.test(C.KAPITAL_C_SOFORT_TEXT) && /anteilig/.test(C.KAPITAL_C_SOFORT_TEXT) && /erlischt/.test(C.KAPITAL_C_SOFORT_TEXT), "Haken-Text Sofortbeginn (wie ANTRAG_NEU_SOFORT_TEXT, mit Erlöschen)");
  ok(/die Bürgin ist zum Zeitpunkt der Übernahme im Register ihres Bundesstaats als aktiv geführt/.test(vertragText), "Bürgschaft: Registerstand der Bürgin als Bedingung (Bestand, nicht abgeschwächt)");
  ok(/tritt diesem Vertrag für Ziffer 5 bei/.test(vertragText) && /als Gesamtschuldner den gezahlten Betrag/.test(vertragText) && /Sicherheiten verlangen FIAON und die Bürgin nicht/.test(vertragText), "Bürgschaft: Beitritt, Rückgriff offen genannt, keine Sicherheiten verlangt");
  ok(/Die Mittel sind nicht an die USA gebunden/.test(vertragText) && /klärt der Partner-Steuerberater von FIAON vorab/.test(vertragText) && /Eine US-Gesellschaft ist kein Steuermodell\./.test(vertragText), "Kapital frei + Partner-Steuerberater + kein Steuermodell");
  const seiteText = flach(sammle(C.kapitalCSeite(D), []).join("\n"));
  ok(seiteText.includes(G.GLOBAL_KAPITAL_FREI.de.satz) && seiteText.includes(G.GLOBAL_KAPITAL_FREI.de.steuer), "Seite: GLOBAL_KAPITAL_FREI wörtlich (Satz + Steuer)");
  const g = C.kapitalCGarantie(PAR);
  ok(vertragText.includes(g.vertrag) && /binnen acht Wochen ab Auftragserteilung/.test(g.vertrag) && /binnen vierzehn Tagen nach Fristende/.test(g.vertrag) && /alles, was er bis dahin an FIAON gezahlt hat \(Ziffer 6 Absatz 1 und 2\)/.test(g.vertrag), "Garantie: acht Wochen, alles Gezahlte (inkl. Erfolgshonorar) binnen vierzehn Tagen");
  ok(/Die Frist ruht, solange die Vergütung nach Ziffer 6 Absatz 1 nicht gezahlt ist, solange Unterlagen nach Ziffer 7 Absatz 2 ausstehen und solange die Gesellschaft ein ihr vorgelegtes Finanzierungsangebot über den Betrag zu den Bedingungen nach Absatz 2 nicht annimmt/.test(vertragText), "Ruhen wie Fassung B: Vergütung, Unterlagen, abgelehntes Angebot zu den Bedingungen");
  ok(/liegen FIAON bei Vertragsschluss vor; ihretwegen ruht die Frist nicht/.test(vertragText), "Unterlagen liegen vor → ihretwegen ruht die Frist nicht");
  ok(/Ziel der Parteien ist die Auszahlung binnen vier Wochen ab Auftragserteilung/.test(vertragText) && /Verbindlich ist die Frist nach Absatz 5/.test(vertragText), "Vier Wochen nur als Ziel, verbindlich sind acht");
  const kond = C.kapitalCKonditionenSatz(PAR);
  ok(vertragText.includes(kond) && /ersten sechs Monate nach der Auszahlung sind ratenfrei/.test(kond) && /fünf bis fünfzehn Jahre/.test(kond) && /ersten sechzehn Monate sind zinsfrei/.test(kond)
    && /ab dem siebzehnten Monat beträgt der Zins 1,5 % im Jahr/.test(kond) && /um 0,5 Prozentpunkte/.test(kond) && /ab dem neunundzwanzigsten Monat 2 %/.test(kond) && /Ab dem achtzehnten Monat .* aufstocken oder über ein anderes Institut umschulden; FIAON begleitet/.test(kond),
  "Konditionen: 6 ratenfrei, 5–15 Jahre, 16 zinsfrei, ab 17 1,5 % + 0,5 je Jahr, ab 18 Aufstockung/Umschuldung");
  ok(/Die Raten zahlt die Gesellschaft pünktlich zu jedem Fälligkeitstag an das finanzierende Institut/.test(vertragText), "Raten pünktlich an das finanzierende Institut");
  ok(/Darlehen und Raten lauten auf US-Dollar; Euro-Beträge sind Umrechnungen, ihr Gegenwert in Euro kann sich mit dem Wechselkurs ändern/.test(vertragText), "Währungsrisiko in einem ruhigen Satz");
  ok(/Ausgezahlt wird in US-Dollar zum Referenzkurs der Europäischen Zentralbank am Tag der Auszahlung; zum Kurs vom 26\.10\.2026 sind das rund 279\.700 US-\$/.test(vertragText), "Auszahlung in US-Dollar zum EZB-Kurs des Auszahlungstags, Schätzung mit Kurs und Datum");
  ok(/Der Auftraggeber möchte sein Immobilienprojekt in den Vereinigten Arabischen Emiraten \(zu 60 % bezahlt, Fertigstellung vorgesehen zum 31\.12\.2026\) finanzieren/.test(rumpf) && /Die Mittel dienen dem Immobilienprojekt des Auftraggebers in den Vereinigten Arabischen Emiraten/.test(vertragText), "Projekt: Präambel „sein …“, Ziffer 4 im Dativ");
  ok(/Alle Beträge sind Endpreise; eine etwa anfallende Umsatzsteuer ist darin enthalten/.test(vertragText), "Endpreise");
  ok(/verlängert sich nicht von selbst/.test(vertragText), "Jahresbetreuung verlängert sich nicht von selbst (Verbraucher)");
  ok(/Der Auftraggeber schließt diesen Vertrag als Verbraucher/.test(vertragText), "Verbrauchervertrag ausdrücklich");
  ok(/Herr Max Mustermann, geboren am 15\.01\.1980 in Musterstadt, deutscher Staatsangehöriger, wohnhaft Musterweg 1, 12345 Musterstadt, Deutschland, ausgewiesen durch Reisepass Nr\. C01X00T47 \(Stadt Musterstadt, gültig bis 01\.01\.2033\) und Personalausweis Nr\. T22000129/.test(vertragText), "Vertragsparteien: Name, Geburtsdatum, Anschrift, Ausweise");
  ok(/Bis zur Prüfung im Register ist der Name vorgemerkt/.test(vertragText), "LLC-Name vorgemerkt bis Registerprüfung");
  ok(/Die Anträge stellen der Auftraggeber bzw\. die Gesellschaft selbst; FIAON bereitet sie vollständig vor/.test(vertragText), "Banking stellt der Kunde selbst");
  ok(ziffern.some((z) => z.titel === B.BEFUGNISSE_TITEL.de) && B.vertragHatBefugnisse(C.KAPITAL_C_FASSUNG), "Befugnisse aus der Quelle (Ziffer 13), Fassung trägt die Ziffer");
  ok(/weder bereit noch verpflichtet, an Streitbeilegungsverfahren vor einer Verbraucherschlichtungsstelle teilzunehmen/.test(vertragText) && /Rechtswahl gilt nur, soweit/.test(vertragText), "Verbraucher: Streitbeilegung, Rechtswahl mit Schutzvorbehalt");
  ok(ziffern.map((z) => z.nr).join() === "1,2,3,4,5,6,7,8,9,10,11,12,13,14", "vierzehn Ziffern in Reihenfolge");
  const an = C.kapitalCAnnahmeTexte(D);
  ok(an.knopf === "Auftrag zahlungspflichtig erteilen" && an.knopf === K.KAPITAL_KNOPF, "Knopf „Auftrag zahlungspflichtig erteilen“ (§ 312j Abs. 3 BGB)");
  const info = C.kapitalCSeite(D).informationen.zeilen;
  ok(info.length >= 9 && ["Ihr Vertragspartner", "Die Leistung", "Die Preise", "Zahlung", "Beginn und Zeitplan", "Laufzeit", "Widerrufsrecht", "Gewährleistung und Beschwerden", "Vertragstext und Sprache"].every((t) => info.some((x) => x.titel === t)), "Informationen vor Vertragsschluss (Art. 246a EGBGB) vollständig");
  ok(/Companies House/.test(info[0].text) && /\+41 44 244 93 01/.test(info[0].text) && /support@fiaon\.com/.test(info[0].text), "Anbieter mit Register, Telefon, E-Mail");
}

// ═══ 4 KEIN BANKNAME, KEINE KARTENRAHMEN-ZUSAGE ═════════════════════════════
abschnitt("4 Kein Bankname, keine Kartenrahmen-Zusage");
const alleTexte: { wo: string; text: string }[] = [];
const push = (wo: string, wert: unknown) => sammle(wert, []).forEach((t) => alleTexte.push({ wo, text: t }));
push("vertrag", absText(ziffern)); push("praeambel", C.kapitalCPraeambel(D)); push("seite", C.kapitalCSeite(D)); push("annahme", C.kapitalCAnnahmeTexte(D));
push("uebersicht", C.kapitalCBestellUebersicht(D, 10)); push("annahme-fest", { ...C.KAPITAL_C_ANNAHME, fertigTitel: C.KAPITAL_C_ANNAHME.fertigTitel("Herr Mustermann"), fertigText: C.KAPITAL_C_ANNAHME.fertigText("max@beispiel.example", "MUSTER LLC", "zehn Jahre"), fertigZahlung: C.KAPITAL_C_ANNAHME.fertigZahlung("3.289 €") });
push("etappen", C.KAPITAL_C_ETAPPEN); push("vermerk", C.kapitalCLaufzeitSatz(PAR, 10));
const BANK = /\b(bank of america|boa|bofa|chase|capital one|american express|amex|wells fargo|citi(bank|group)?|jp ?morgan|goldman|mercury|brex|ramp)\b/i;
ok(alleTexte.every((x) => !BANK.test(x.text)), "kein Bankname in Vertrag, Seite, Übersicht, Annahme, Etappen", alleTexte.filter((x) => BANK.test(x.text)).map((x) => `${x.wo}: ${x.text.slice(0, 80)}`));
ok(alleTexte.every((x) => !/\bbis zu\b/i.test(x.text)), "kein „bis zu“ (außer im gesetzlichen Muster der Anlage)", alleTexte.filter((x) => /\bbis zu\b/i.test(x.text)).map((x) => x.text.slice(0, 80)));
ok(alleTexte.every((x) => !/\b60\s?(x|×|-?mal|fach)\b/i.test(x.text)), "kein „60x“");
const RAHMEN = /(\d[\d.]*\s*(US-\$|USD|\$|€)[^.]{0,50}\b(karte|rahmen|limit))|((karte|kreditkarte|rahmen|limit)\w*[^.]{0,50}\d[\d.]*\s*(US-\$|USD|\$))/i;
ok(alleTexte.every((x) => !RAHMEN.test(x.text)), "keine Kartenrahmen-Zahl", alleTexte.filter((x) => RAHMEN.test(x.text)).map((x) => x.text.slice(0, 90)));
const seiteFlach = flach(sammle(C.kapitalCSeite(D), []).join("\n"));
ok(seiteFlach.includes("Einführungszeiträume ohne Sollzins bieten manche Herausgeber an; die Bedingungen legt jeder Herausgeber selbst fest.") && seiteFlach.includes("Über Konto, Karten und deren Rahmen entscheidet das jeweilige Institut."), "die zwei erlaubten Karten-Sätze stehen auf der Seite");
ok(vertragText.includes("Einführungszeiträume ohne Sollzins bieten manche Herausgeber an; die Bedingungen legt jeder Herausgeber selbst fest.") && /Über Konto, Karten und deren Rahmen entscheidet das jeweilige Institut/.test(vertragText) && /Für Konto und Karten gilt die Garantie nach Ziffer 4 nicht/.test(vertragText), "Vertrag: Institut entscheidet, Sollzins-Satz, Garantie nicht für Karten");
ok(alleTexte.every((x) => !/\bnorthwest\b/i.test(x.text)) && !/Schwarzott|Northwest/i.test(readFileSync(path.join(WURZEL, "shared/fiaon-global-angebot-kapital-c.ts"), "utf8").replace(/\/\/.*$/gm, "")), "kein Partnername im Code der Fassung C");

// ═══ 5 KOSTEN VOLLSTÄNDIG ════════════════════════════════════════════════════
abschnitt("5 Kosten vollständig (offen, Endpreise)");
{
  const s = C.kapitalCSeite(D);
  const inv = flach(sammle(s.investition, []).join(" "));
  ok(["3.289 €", "2.790 €", "499 €", "6.890 €", "699 €"].every((b) => inv.includes(b)), "Seite „Ihre Investition“: 3.289 € heute (2.790 + 499), 6.890 € bei Gründung, 699 €/Jahr", inv);
  ok(/Endpreise/.test(inv) && /Erfolgshonorar/.test(inv) && /einschließlich Bürgschaft/.test(inv) && /eingetragen/.test(inv), "Erfolgshonorar inkl. Bürgschaft, fällig mit Eintragung; Endpreise");
  const z6 = flach(absText(ziffern.filter((z) => z.nr === 6)).join(" "));
  ok(["2.790 €", "499 €", "3.289 €", "6.890 €", "699 €"].every((b) => z6.includes(b)), "Vertrag Ziffer 6: alle Beträge");
  const ue = flach(sammle(C.kapitalCBestellUebersicht(D, 10), []).join(" "));
  ok(["3.289 €", "2.790 €", "499 €", "6.890 €", "699 €", "250.000 €"].every((b) => ue.includes(b)) && /Endpreise/.test(ue), "Übersicht über dem Knopf: alle Beträge + Endpreise");
  const inf = flach(sammle(s.informationen, []).join(" "));
  ok(["3.289 €", "2.790 €", "499 €", "6.890 €", "699 €"].every((b) => inf.includes(b)), "Informationen vor Vertragsschluss: alle Beträge");
  ok(C.kapitalCHeuteCents(PAR) === 328_900, "heute fällig 3.289 €");
  ok(/Ihre Laufzeit/.test(ue) && /zehn Jahre · Monatsrate ≈ 2\.333,86 €/.test(ue), "Übersicht nennt die gewählte Laufzeit mit Rate", ue);
}

// ═══ 6 WORTWAND ═════════════════════════════════════════════════════════════
abschnitt("6 Wortwand (Hausregeln + E-188)");
{
  // „garant…“ ist in dieser Fassung Justins Entscheidung (Garantie Ziffer 4). Erlaubt nur in einem Satz, der die VERTRAGLICHE
  // Garantie meint (Ziffer 4, Wochenfrist, „alles zurück“, „im Vertrag“) — jedes freie „garantiert“ bleibt rot.
  const garantieGebunden = (satz: string) => /Ziffer 4|Wochen|zurück|Gezahlte|im Vertrag|Garantie nach|Garantie aus|Garantiefrist|Finanzierung und Garantie|Finanzierung mit Garantie|Garantie entfällt|mit einer Garantie ein|Garantie erfüllt/.test(satz);
  const saetze = (t: string) => t.split(/(?<=[.!?])\s+(?=[A-ZÄÖÜ„])/);
  let treffer = 0;
  for (const { wo, text } of alleTexte) {
    for (const satz of saetze(text)) {
      for (const f of W.globalWortPruefen(satz, ["aufgabe_an_betreuer"])) {
        if (/garant/i.test(f.treffer) && garantieGebunden(satz)) continue;
        // Zinssätze sind in dieser Fassung vertraglich vereinbart (Justin 27.10.2026) — die Regel „kein 0 %“ gilt weiter.
        treffer++; console.log(`  WAND  ${wo}: „${satz.slice(0, 110)}“ → ${f.hinweis}`);
      }
    }
  }
  ok(treffer === 0, `Wortwand: ${treffer} Treffer in ${alleTexte.length} Texten`);
  const garantSaetze = alleTexte.flatMap((x) => saetze(x.text)).filter((s) => /\bgarant/i.test(s));
  ok(garantSaetze.length > 0 && garantSaetze.every(garantieGebunden), `jedes „garant…“ (${garantSaetze.length}) hängt an der vertraglichen Garantie`, garantSaetze.filter((s) => !garantieGebunden(s)));
}

// ═══ 7 PRÜFSUMME, VERMERK, PRÜFUNGEN, NACH DER ANNAHME ══════════════════════
abschnitt("7 Prüfsumme, Annahmevermerk, Prüfungen, nach der Annahme");
{
  const h1 = C.kapitalCHashEingabe(D, C.kapitalCRumpfHtml(D, null));
  const h2 = C.kapitalCHashEingabe(D, C.kapitalCRumpfHtml({ ...D, parameter: { ...PAR, erfolgCents: 700_000 } }, null));
  ok(h1 !== h2 && h1 === C.kapitalCHashEingabe(D, C.kapitalCRumpfHtml(D, null)), "Prüfsumme stabil, ändert sich mit dem Preis");
  const vermerk = ohneHtml(C.kapitalCRumpfHtml(D, { am: new Date("2026-10-28T10:00:00Z"), ip: "203.0.113.7", userAgent: "x", hash: "abc", wahl: { llc: { wunsch: "MUSTER VENTURES LLC", alternative1: "", alternative2: "" }, laufzeitJahre: 10, sofortBeginn: true }, unterschrift: { art: "getippt", name: "Max Mustermann" } }));
  ok(/Laufzeit der Finanzierung \(Ziffer 4 Absatz 2\): zehn Jahre \(120 Monatsraten ab dem siebten Monat nach der Auszahlung\); Monatsrate nach dem Rechenbeispiel 2\.333,86 €/.test(vermerk), "Annahmevermerk: Laufzeit, Raten, Monatsrate", vermerk.slice(vermerk.indexOf("Annahmevermerk"), vermerk.indexOf("Annahmevermerk") + 400));
  ok(/Wunschname MUSTER VENTURES LLC/.test(vermerk) && vermerk.includes(C.KAPITAL_C_SOFORT_TEXT) && vermerk.includes(C.KAPITAL_C_GELESEN_TEXT), "Annahmevermerk: Name, Sofortbeginn und „gelesen“ wörtlich");
  // Parameter und Kunde
  const roh = C.kapitalCParameterAus({ betragCents: -5, laufzeitMinJahre: 7, laufzeitMaxJahre: 3, laufzeitVorschlagJahre: 40, kursUsdJeEur: 9, projekt: { bezahltProzent: 140 } as any });
  ok(roh.betragCents === C.KAPITAL_C_VORGABEN.betragCents && roh.laufzeitMaxJahre >= roh.laufzeitMinJahre && roh.laufzeitVorschlagJahre <= roh.laufzeitMaxJahre && roh.kursUsdJeEur === C.KAPITAL_C_VORGABEN.kursUsdJeEur && roh.projekt.bezahltProzent === 60, "Parameter: Unsinn fällt auf die Vorgaben zurück");
  ok(!C.kapitalCKundePruefen({ ...KUNDE_ROH, ausweise: [] }).ok && !C.kapitalCKundePruefen({ ...KUNDE_ROH, plz: "1234" }).ok && !C.kapitalCKundePruefen({ ...KUNDE_ROH, email: "kein" }).ok
    && !C.kapitalCKundePruefen({ ...KUNDE_ROH, ausweise: [{ art: "reisepass", nummer: "x", gueltigBis: "2030-01-01", behoerde: "B" }] }).ok && !C.kapitalCKundePruefen({ ...KUNDE_ROH, geburtsdatum: "15.01.1980" }).ok, "Kunde: Ausweis, PLZ, E-Mail, Nummer, Geburtsdatum werden geprüft");
  ok(C.kapitalCPflichtFehlen(D).length === 0 && C.kapitalCPflichtFehlen({ ...D, buergin: { ...BUERGIN, registernummer: "" } }).length === 1, "Pflichtfelder: vollständig / Bürgin ohne Registernummer fehlt");
  // Teil 2 (Erfolgshonorar) und Auszahlung
  const lage = { status: "angenommen", parameter: PAR, angenommenAm: "2026-10-28", heute: "2026-11-05", teil1Bezahlt: true, vorhanden: null };
  ok(!C.kapitalCTeil2Pruefen({ ...lage, teil1Bezahlt: false }, { datum: "2026-11-04" }).ok && !C.kapitalCTeil2Pruefen({ ...lage, status: "offen" }, { datum: "2026-11-04" }).ok
    && !C.kapitalCTeil2Pruefen(lage, { datum: "2026-11-06" }).ok && !C.kapitalCTeil2Pruefen(lage, { datum: "2026-10-27" }).ok, "Teil 2: erst nach Zahlung Teil 1, nach Annahme, Datum nicht in der Zukunft/vor der Annahme");
  const t2 = C.kapitalCTeil2Pruefen(lage, { datum: "2026-11-04", beleg: "  Sunbiz   Bestätigung " }) as any;
  ok(t2.ok && t2.daten.betragCents === 689_000 && t2.daten.beleg === "Sunbiz Bestätigung", "Teil 2: Erfolgshonorar 6.890 €, Beleg geglättet");
  ok((C.kapitalCTeil2Pruefen({ ...lage, vorhanden: { rechnungSteht: true } }, { datum: "2026-11-04" }) as any).schon === true, "Teil 2: schon berechnet → nichts Neues");
  const au = { status: "angenommen", angenommenAm: "2026-10-28", heute: "2026-11-20", garantieErfuelltAm: null, erstattungAusgeloest: false };
  ok(C.kapitalCAuszahlungPruefen(au, { datum: "2026-11-19" }).ok && (C.kapitalCAuszahlungPruefen({ ...au, garantieErfuelltAm: "2026-11-19" }, { datum: "2026-11-19" }) as any).schon && !C.kapitalCAuszahlungPruefen({ ...au, erstattungAusgeloest: true }, { datum: "2026-11-19" }).ok, "Auszahlung eintragen: einmal, nicht nach dem Garantiefall");
  ok(K.kapitalRechnungsTextNachFassung({ angebotRef: "FIAON-IA-CMUSTER", nr: 2, auftragRef: "FIAON-X", ereignisAm: "2026-11-04", fassung: C.KAPITAL_C_FASSUNG }).beschreibung.includes("Erfolgshonorar einschließlich Bürgschaft (Ziffer 6 Absatz 2) — Gesellschaft eingetragen am 04.11.2026")
    && /Fast-Track \(Ziffer 6 Absatz 1\)/.test(K.kapitalRechnungsTextNachFassung({ angebotRef: "R", nr: 1, auftragRef: "A", fassung: C.KAPITAL_C_FASSUNG }).beschreibung)
    && /Bürgschaftsgebühr/.test(K.kapitalRechnungsTextNachFassung({ angebotRef: "R", nr: 2, auftragRef: "A", fassung: K.KAPITAL_FASSUNG }).beschreibung), "Rechnungstexte je Fassung (C: Erfolgshonorar, B unverändert)");
  ok(K.istKapitalFassung(C.KAPITAL_C_FASSUNG) && K.istKapitalCFassung(C.KAPITAL_C_FASSUNG) && !K.istKapitalCFassung(K.KAPITAL_FASSUNG) && K.kapitalMitGebuehren(C.KAPITAL_C_FASSUNG), "Fassung C läuft durch alle Kapital-Wege, verzweigt aber eigens");
  // „Mein Auftrag“
  const t1 = { nr: 1, titel: C.KAPITAL_C_TEIL1_TITEL, betragCents: 328_900, stand: "bezahlt", rechnungsnummer: "R-1", bestellRef: "FIAON-1", ereignisAm: null, bezahltAm: "2026-10-29" };
  const ma = C.kapitalCMeinAuftrag({ parameter: PAR, angenommenAm: "2026-10-28", teile: [t1], garantieErfuelltAm: null, erstattungAusgeloest: false, laufzeitJahre: 10 });
  ok(ma.teile.length === 2 && ma.teile[1].stand === "noch nicht fällig" && ma.teile[1].betragCents === 689_000 && /eingetragen/.test(String(ma.teile[1].hinweis)), "Mein Auftrag: Teil 2 Erfolgshonorar noch nicht fällig, mit ruhigem Satz");
  ok(ma.fristBeginn === "2026-10-29" && ma.fristEnde === "2026-12-24" && /bis zum 24\.12\.2026/.test(ma.garantieSatz) && ma.summeCents === 328_900, "Mein Auftrag: Frist ab Zahlung + acht Wochen, Summe nur Entstandenes", ma);
  ok(/zehn Jahre, Monatsrate nach dem Rechenbeispiel 2\.333,86 €/.test(ma.seiteHinweis), "Mein Auftrag nennt Laufzeit und Rate");
  const fa = C.kapitalCFristAufgabe({ schritt: "abgelaufen", tageBis: -1, angebotRef: "R", name: "Max Mustermann", fristBeginn: "2026-10-29", fristEnde: "2026-12-24", parameter: PAR });
  ok(/bis 07\.01\.2027/.test(fa.text) && /KEIN Geld/.test(fa.text) && fa.dringend, "Fristwarnung C: Erstattung binnen vierzehn Tagen, kein Geld bewegt");
  const st = C.kapitalCStartAufgabe({ angebotRef: "R", name: "Max Mustermann", parameter: PAR, bezahltAm: "2026-10-29", zweck: "FIAON-ABC", frist: { beginn: "2026-10-29", ende: "2026-12-24" }, llc: "MUSTER VENTURES LLC", laufzeitJahre: 10 });
  ok(/bis 05\.11\.2026/.test(st.text) && /Gesellschaft eingetragen/.test(st.text) && /zehn Jahre/.test(st.text), "Start-Aufgabe: Anmeldung binnen fünf Werktagen, Knopf „Gesellschaft eingetragen“, Laufzeit");
}

// ═══ OPTIONAL: KEINE ECHTEN KUNDENDATEN IM CODE / MAILTEXT ══════════════════
const privat = arg("--privat");
if (privat) {
  abschnitt("8 Keine echten Kundendaten im Code (Repo öffentlich)");
  const roh = JSON.parse(readFileSync(privat, "utf8"));
  const werte = new Set<string>();
  const k = roh?.kunde ?? {};
  for (const v of [k.vorname, k.nachname, k.strasse, k.plz, k.ort, k.email, k.geburtsdatum, k.geburtsort, ...(Array.isArray(k.ausweise) ? k.ausweise.map((a: any) => a?.nummer) : [])]) {
    const s = String(v ?? "").trim(); if (s.length >= 4) werte.add(s.toLowerCase());
  }
  const dateien = ["shared/fiaon-global-angebot-kapital-c.ts", "server/lib/fiaon-global-angebot-kapital-c.ts", "client/src/pages/business-angebot-kapital-c.tsx", "client/src/styles/global-angebot-kapital-c.css", "scripts/pruef-kapital-fassung-c.ts", "scripts/angebot-kapital-anlegen.ts", "shared/fiaon-global-angebot-kapital.ts", "server/lib/fiaon-global-angebot-kapital.ts"];
  for (const f of dateien) {
    const q = readFileSync(path.join(WURZEL, f), "utf8").toLowerCase();
    const funde = [...werte].filter((w) => q.includes(w));
    ok(funde.length === 0, `${f}: kein Wert des Kunden`, funde.length ? `${funde.length} Fund(e)` : "");
  }
}
const mail = arg("--mail");
if (mail && existsSync(mail)) {
  abschnitt("9 Mailtext (Wortwand, kein Bankname, Link-Platzhalter)");
  const t = readFileSync(mail, "utf8");
  ok(t.includes("{{LINK}}"), "Mail: Platzhalter {{LINK}}");
  ok(!BANK.test(t) && !/\bbis zu\b/i.test(t) && !/\b60\s?(x|×|-?mal|fach)\b/i.test(t), "Mail: kein Bankname, kein „bis zu“, kein „60x“");
  const funde = W.globalWortPruefen(t, ["aufgabe_an_betreuer"]).filter((f) => !(/garant/i.test(f.treffer) && /acht Wochen|Ziffer 4|zurück/.test(t)));
  ok(funde.length === 0, "Mail: Wortwand", funde);
}

console.log(`\n${gut} grün, ${rot.length} rot.`);
if (rot.length) { console.log(rot.map((r) => `  · ${r}`).join("\n")); process.exit(1); }
