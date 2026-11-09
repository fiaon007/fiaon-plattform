// ═══════════════════════════════════════════════════════════════════════════
// PRÜFSTAND: KAPITAL-ANGEBOT FASSUNG C — PRIVATPERSONEN (Register E-432, 27.10.2026)
//
// Rein, ohne Datenbank und ohne Netz. Alle Daten sind MUSTER (Repo öffentlich): Max Mustermann, Muster Partner LLC, *.example.
//
//   1 Rechner gegen eine UNABHÄNGIGE Nachrechnung (Bisektion auf die Rate, Zinsen in BigInt kaufmännisch gerundet) für T = 5 … 15,
//     dazu ein Lauf über viele Beträge (die Rundung halber Cent fiel nur bei anderen Beträgen auf, Nachprüfung 27.10.)
//   2 Grenzfälle (Stufen der Zinstreppe, Laufzeit außerhalb, ohne Zins, Zins schon in den ratenfreien Monaten, Formate mit
//     geschütztem Leerzeichen)
//   3 Vertrag: Pflichtsätze (Widerrufsbelehrung + Formular, Sofortbeginn/Wertersatz, Registerstand der Bürgin, Kapital frei,
//     kein Steuermodell, Geld-zurück-Garantie mit engem Ruhen, Ziel ≠ Garantie, Begleitung statt Zusage, persönliche Haftung offen,
//     ITIN-Check, Auflösung nach Garantiefall/Widerruf, Haftung, Endpreise, Befugnisse …)
//   4 Kein Bankname, keine Kartenrahmen-Zusage, kein „bis zu“, kein „60x“ — in Vertrag, Seite, Übersicht, Annahme, Etappen, Bestätigung
//   5 Kosten vollständig (mit Gesamtpreis des ersten Jahres) in Seite, Vertrag, Übersicht und Informationen vor Vertragsschluss
//   6 Wortwand (Hausregeln + E-188) — „Garantie“ nur als Hauptwort der Geld-zurück-Garantie, nie „garantiert“, nie „sicher?“
//   7 Prüfsumme, Annahmevermerk (mit letzter Rate), gekürzte Ausweisnummern, Parameter- und Kundenprüfung, Teil 2 / Auszahlung,
//     „Mein Auftrag“, Aufgaben-Texte, Registerstand der Bürgin
//   4b KEIN Verwendungszweck (Justin 27.10.2026, 17:40): ein Marken-Vorhaben in den Daten taucht in keinem Kundentext und keinem
//     Vertrag auf; keine Wörter eines Zwecks (Vorhaben, Ort, bezahlter Anteil, Termin, Bauträger) — auch nicht fest im Text
//   5b „Ihre Investition“ leise, aber vollständig und lesbar: alle Beträge in der sichtbaren Zeile, Schrift 13–15 px, Kontrast ≥ 4,5:1
//   7b „Ihr Team“ (Justin 27.10.2026, abends — wie Fassung A/B): Einlesen nach denselben Regeln wie A/B, Porträt des Hauses,
//     Bildname → Adresse NUR hinter dem Link, KI-Porträt/fremde Adresse/Pfad → Initialen, Bildnachweis, leeres Team = kein Abschnitt,
//     und vor allem: Vertrag, Prüfsumme und der Fingerabdruck für den Browser sind mit und ohne Team GLEICH (eine offene Seite muss
//     nicht neu laden) — auch über die echte Kundensicht des Servers (kapitalCKundenSicht, ohne Datenbank)
//
//   10 E-474 (Justin 02.11.2026) — Angaben vom Kunden (datenVomKunden) und Fast-Track nach Wahl (fastTrackWahl), ohne Datenbank:
//      Bestand byte-gleich (Prüfsumme über Vertrag, Seite, Übersicht, Annahme, Bestätigung, Aufgaben gegen die Grundlinie aus
//      origin/main vor E-474), Anlage ohne Ausweis nur mit Parameter, Unterschrift gesperrt bis die Angaben da sind, ungültige Angaben
//      abgewiesen (mit Feld), Vertrag ohne „ausgewiesen durch“ mit Reisepass-Satz, beide Wahlen (Betrag, Vertrag, Vermerk,
//      Bestätigung, Aufgabe, „Mein Auftrag“, Rechnungstext), Annahme-Prüfungen des Servers, falscher Token 403, Wortwand der neuen Texte
//   12 E-487 (09.11.2026) — die Tempo-Fassung „Vorrang“, ohne Datenbank: angenommene Verträge (ohne schalter.tempoFassung) über den
//      echten Leseweg WORTGLEICH wie vor E-487 (Grundlinie aus 5256de04), welche Fassung wann gilt, offene Angebote (mit/ohne Wahl,
//      Delaware/Florida) in keinem Kundentext mit „72 Stunden“ oder einer Stunden-/Tageszusage für die EIN, der neue Fast-Track überall
//      gleich (Vertrag Ziffer 2 Absatz 3, Fragen, Informationen, Karten, Übersicht, Bestätigung, Aufgabe), Express nur wo der Staat ihn
//      hat, der Satz „drei bis fünf Wochen“ unverändert, die Annahme hält die Fassung fest (gleiche Prüfsumme vorher/nachher), neue
//      Angebote aus einer Quelle, nichts vorgewählt (Seite + Server), Wortwand, kein „garantiert“, kein Bank-/Behörden-Vorbehalt
//   11 nur mit --lokal: derselbe Weg ECHT gegen eine Prüfstand-Kopie (127.0.0.1) und den lokalen Server (PRUEF_BASIS, gleiches
//      SESSION_SECRET): Anlage, Angaben über die Route, Annahme ohne und mit Fast-Track (Teil 1, Rechnungstext, Akte), danach keine
//      Änderung mehr, zweiter Skriptlauf überschreibt die Angaben nicht, Reisepass-Upload über die Route in die Akte
//
//   npx tsx scripts/pruef-kapital-fassung-c.ts
//   env -i PATH="$PATH" HOME="$HOME" DATABASE_URL='postgresql://fiaon@127.0.0.1:54329/<kopie>?sslmode=require' SESSION_SECRET=<wie der Server> \
//     PRUEF_BASIS=http://127.0.0.1:5474 PORT=5474 npx tsx scripts/pruef-kapital-fassung-c.ts --lokal
//   … --privat <angebot.json>   prüft zusätzlich, dass KEIN Wert des echten Kunden und kein Name aus seinem Team in den Code-Dateien
//                               steht (Repo öffentlich)
//   … --mail <Mail.txt>         prüft den Mailtext (Wortwand, kein Bankname, {{LINK}} vorhanden, Kosten und Rate genannt)
// ═══════════════════════════════════════════════════════════════════════════
import { readFileSync, existsSync } from "node:fs";
import path from "node:path";

for (const k of ["BREVO_API_KEY", "MAKE_WEBHOOK_URL", "OPENAI_API_KEY"]) if (process.env[k]) { console.error(`ABBRUCH: ${k} ist gesetzt.`); process.exit(3); }
// E-474: --lokal fährt Abschnitt 11 gegen eine Prüfstand-Kopie auf 127.0.0.1 — nie gegen eine fremde Datenbank, Netz nur zu 127.0.0.1.
const LOKAL = process.argv.includes("--lokal");
if (LOKAL) {
  let host = ""; try { host = new URL(String(process.env.DATABASE_URL)).hostname; } catch { /* unten */ }
  if (!["127.0.0.1", "localhost"].includes(host)) { console.error("ABBRUCH: --lokal läuft nur gegen eine Datenbank auf 127.0.0.1/localhost."); process.exit(2); }
  const echt = globalThis.fetch;
  globalThis.fetch = (async (u: any, i?: any) => {
    if (!/^http:\/\/(127\.0\.0\.1|localhost):\d+\//.test(String(u?.url ?? u))) throw new Error("Prüfstand: Netz nur zu 127.0.0.1");
    return echt(u, i);
  }) as typeof fetch;
} else {
  process.env.DATABASE_URL = "postgres://pruefstand:ohne@127.0.0.1:1/keine-datenbank";
  globalThis.fetch = (async () => { throw new Error("Prüfstand: kein Netz"); }) as typeof fetch;
}
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
  buerginAktiv: false, buerginStandAm: "2026-10-19",
  unterlagen: [{ titel: "Reisepass", am: "2026-10-27" }, { titel: "Personalausweis", am: "2026-10-27" }, { titel: "Gehaltsnachweise August bis Oktober 2026", am: "2026-10-27" }, { titel: "Kontoauszug Oktober 2026", am: "2026-10-27" }],
});
const kunde = C.kapitalCKundePruefen(KUNDE_ROH);
if (!kunde.ok) { console.error("Musterkunde ungültig:", kunde.error); process.exit(1); }
const D = { ref: "FIAON-IA-CMUSTER", fassung: C.KAPITAL_C_FASSUNG, kunde: kunde.kunde, buergin: BUERGIN, parameter: PAR, gueltigBis: "2026-11-10" };
/** Leerzeichen glätten — \s trifft auch das geschützte Leerzeichen (U+00A0) zwischen Zahl und Einheit. */
const flach = (s: string) => s.replace(/\s+/g, " ");
const ohneHtml = (h: string) => flach(h.replace(/<[^>]+>/g, " ").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'"));
const absText = (z: { absaetze: { art: string; text?: string; einleitung?: string; zeilen?: string[] }[] }[]) =>
  z.flatMap((x) => x.absaetze.flatMap((a) => (a.art === "p" ? [a.text ?? ""] : [a.einleitung ?? "", ...(a.zeilen ?? [])])));
function sammle(wert: unknown, aus: string[]): string[] {
  if (typeof wert === "string") { if (wert.trim()) aus.push(wert); }
  else if (typeof wert === "function") { try { sammle((wert as (...a: unknown[]) => unknown)({ anrede: "Sehr geehrter Herr Mustermann", angenommen: "28.10.2026 um 10:00 Uhr", llc: "MUSTER LLC", ref: "R", laufzeit: "zehn Jahre", heute: "3.289 €", zweck: "FIAON-X", faellig: "04.11.2026" }), aus); } catch { /* nicht aufrufbar */ } }
  else if (Array.isArray(wert)) wert.forEach((x) => sammle(x, aus));
  else if (wert && typeof wert === "object") Object.values(wert).forEach((x) => sammle(x, aus));
  return aus;
}

// ═══ 1 RECHNER GEGEN UNABHÄNGIGE NACHRECHNUNG ═══════════════════════════════
abschnitt("1 Laufzeit-Rechner gegen unabhängige Nachrechnung (T = 5 … 15, BigInt)");
/** Die Zinstreppe, unabhängig formuliert: Jahr n nach dem zinsfreien Teil = Start + n·Schritt (in Basispunkten). */
function zinsBpUnabhaengig(m: number, zinsfrei = 16, start = 150, schritt = 50): number {
  if (m <= zinsfrei) return 0;
  let jahrNachStart = 0; let grenze = zinsfrei + 1 + 12;
  while (m >= grenze) { jahrNachStart++; grenze += 12; }
  return start + schritt * jahrNachStart;
}
/** Endsaldo nach allen Raten bei Rate r (Gleitkomma, ohne Rundung) — nur für die Bisektion auf die Rate. */
function endsaldo(P: number, jahre: number, r: number): number {
  let s = P;
  for (let m = 7; m <= 6 + 12 * jahre; m++) s = s * (1 + zinsBpUnabhaengig(m) / 10_000 / 12) - r;
  return s;
}
function rateBisektion(P: number, jahre: number): number {
  let lo = 0, hi = P;
  for (let i = 0; i < 200; i++) { const mid = (lo + hi) / 2; if (endsaldo(P, jahre, mid) > 0) lo = mid; else hi = mid; }
  return (lo + hi) / 2;
}
/** Zins eines Monats in Cent, kaufmännisch gerundet, exakt in BigInt: floor((2·S·bp + 120.000) / 240.000). */
const zinsBig = (s: bigint, bp: number) => (2n * s * BigInt(bp) + 120_000n) / 240_000n;
/** Der ganze Plan in BigInt mit DERSELBEN Rate: Zinsen, letzte Rate, Endsaldo. */
function simBig(betragCents: number, jahre: number, rateCents: number, k = { ratenfrei: 6, zinsfrei: 16, start: 150, schritt: 50 }) {
  let s = BigInt(betragCents); let zinsen = 0n; let letzte = 0n;
  const erste = k.ratenfrei + 1; const ende = k.ratenfrei + 12 * jahre;
  for (let m = 1; m < erste; m++) { const z = zinsBig(s, zinsBpUnabhaengig(m, k.zinsfrei, k.start, k.schritt)); s += z; zinsen += z; }
  for (let m = erste; m <= ende; m++) {
    const z = zinsBig(s, zinsBpUnabhaengig(m, k.zinsfrei, k.start, k.schritt)); s += z; zinsen += z;
    const zahl = m === ende ? s : BigInt(rateCents); if (m === ende) letzte = zahl; s -= zahl;
  }
  return { s, zinsen: Number(zinsen), letzte: Number(letzte) };
}
let vorherRate = Infinity; let vorherZinsen = -1;
const P = PAR.betragCents / 100;
const tabelle: string[] = [];
for (let T = 5; T <= 15; T++) {
  const plan = C.kapitalCPlan(PAR, T);
  const r = rateBisektion(P, T);
  ok(Math.abs(plan.monatsrateCents - Math.round(r * 100)) <= 1, `T=${T}: Rate ${plan.monatsrateCents} Cent = unabhängig ${Math.round(r * 100)} Cent (±1)`, { plan: plan.monatsrateCents, r });
  const sim = simBig(PAR.betragCents, T, plan.monatsrateCents);
  ok(sim.s === 0n && plan.zinsenCents === sim.zinsen && plan.letzteRateCents === sim.letzte, `T=${T}: Zinsen ${sim.zinsen} und letzte Rate ${sim.letzte} exakt nachgerechnet (BigInt), Saldo 0`, { s: String(sim.s), plan: [plan.zinsenCents, plan.letzteRateCents] });
  ok(Math.abs(plan.letzteRateCents - plan.monatsrateCents) <= 150, `T=${T}: letzte Rate weicht höchstens 1,50 € ab (Restcent)`, [plan.letzteRateCents, plan.monatsrateCents]);
  const raten = 12 * T;
  ok(plan.rueckzahlungCents === PAR.betragCents + plan.zinsenCents && plan.rueckzahlungCents === (raten - 1) * plan.monatsrateCents + plan.letzteRateCents, `T=${T}: Rückzahlung = Betrag + Zinsen = Summe der Raten (mit letzter Rate)`);
  ok(plan.raten === raten && plan.ersteRateMonat === 7 && plan.letzteRateMonat === 6 + raten, `T=${T}: ${raten} Raten, Monat 7 bis ${6 + raten}`);
  ok(plan.zinsZuletztBp === zinsBpUnabhaengig(6 + raten), `T=${T}: Zins zuletzt ${zinsBpUnabhaengig(6 + raten) / 100} %`, plan.zinsZuletztBp);
  const tr = plan.treppe;
  ok(tr[0].vonMonat === 1 && tr[tr.length - 1].bisMonat === 6 + raten && tr.every((x, i) => i === 0 || x.vonMonat === tr[i - 1].bisMonat + 1), `T=${T}: Zinstreppe lückenlos Monat 1 bis ${6 + raten}`);
  ok(tr.reduce((a, x) => a + x.zinsenCents, 0) === plan.zinsenCents && tr[tr.length - 1].restschuldCents === 0, `T=${T}: Zinsen der Stufen = Zinsen gesamt, Restschuld am Ende 0`);
  ok(tr.every((x) => { for (let m = x.vonMonat; m <= x.bisMonat; m++) if (zinsBpUnabhaengig(m) !== x.zinsBp) return false; return true; }), `T=${T}: jede Stufe trägt den richtigen Zins`);
  ok(tr[0].ratenfrei && tr[0].bisMonat === 6 && tr[0].zinsBp === 0 && tr[1].vonMonat === 7 && tr[1].bisMonat === 16 && tr[1].zinsBp === 0 && tr[2].vonMonat === 17 && tr[2].zinsBp === 150, `T=${T}: Monat 1–6 ratenfrei, 7–16 zinsfrei, ab 17 1,5 %`);
  ok(plan.monatsrateCents < vorherRate && plan.zinsenCents > vorherZinsen, `T=${T}: längere Laufzeit → kleinere Rate, mehr Zinsen`);
  ok(plan.usd.monatsrate === Math.round(plan.monatsrateCents / 100 * PAR.kursUsdJeEur), `T=${T}: Rate in US-$ = Euro × Kurs`);
  // Die letzte Rate steht offen da, sobald sie abweicht — in der Zeile der Übersicht und im Annahmevermerk.
  const anders = plan.letzteRateCents !== plan.monatsrateCents;
  ok(C.kapitalCLetzteRateAnders(plan) === anders && flach(C.kapitalCLaufzeitZeile(PAR, T)).includes(anders ? `letzte Rate ${flach(C.kapitalCEurCent(plan.letzteRateCents))}` : "· Rechenbeispiel")
    && (!anders || flach(C.kapitalCLaufzeitSatz(PAR, T)).includes(`letzte Rate ${flach(C.kapitalCEurCent(plan.letzteRateCents))}`)), `T=${T}: letzte Rate offen genannt, wenn sie abweicht`);
  vorherRate = plan.monatsrateCents; vorherZinsen = plan.zinsenCents;
  tabelle.push(`${String(T).padStart(2)} J.  Rate ${flach(C.kapitalCEurCent(plan.monatsrateCents)).padStart(11)}  letzte ${flach(C.kapitalCEurCent(plan.letzteRateCents)).padStart(11)}  Zinsen ${flach(C.kapitalCEurCent(plan.zinsenCents)).padStart(12)}  zuletzt ${flach(C.kapitalCProzent(plan.zinsZuletztBp))}`);
}
console.log(tabelle.map((z) => `  ${z}`).join("\n"));
{
  // Bei 250.000 € ändert die Ganzzahl-Rundung keine Zahl (Nachprüfung 27.10.): Rate 10 J. 2.333,86 €, letzte 2.334,34 €, 15 J. 1.736,92 €.
  const p10 = C.kapitalCPlan(PAR, 10), p5 = C.kapitalCPlan(PAR, 5), p15 = C.kapitalCPlan(PAR, 15);
  ok(p5.monatsrateCents === 431_258 && p10.monatsrateCents === 233_386 && p10.letzteRateCents === 233_434 && p10.zinsenCents === 3_006_368 && p15.monatsrateCents === 173_692 && p15.zinsenCents === 6_264_648,
    "250.000 €: Raten 4.312,58 / 2.333,86 (letzte 2.334,34) / 1.736,92 €, Zinsen 30.063,68 / 62.646,48 € — wie vor der Umstellung");
  // Viele Beträge: Zinsen und letzte Rate exakt (BigInt), Saldo 0 — hier rundete die Kommazahl halbe Cent früher manchmal ab.
  let plaene = 0; const abweichung: string[] = [];
  for (let betrag = 100_000; betrag <= 100_000_000; betrag = Math.round(betrag * 1.017 + 1337)) {
    for (let T = 5; T <= 15; T++) {
      const par = { ...PAR, betragCents: betrag };
      const plan = C.kapitalCPlan(par, T);
      const sim = simBig(betrag, T, plan.monatsrateCents);
      plaene++;
      if (sim.s !== 0n || sim.zinsen !== plan.zinsenCents || sim.letzte !== plan.letzteRateCents) abweichung.push(`${betrag}/${T}`);
    }
  }
  ok(abweichung.length === 0 && plaene > 4000, `${plaene} Pläne über viele Beträge: Zinsen und letzte Rate exakt wie BigInt`, abweichung.slice(0, 8));
  const p95 = C.kapitalCPlan({ ...PAR, betragCents: 9_500_000 }, 15);
  ok(p95.letzteRateCents === simBig(9_500_000, 15, p95.monatsrateCents).letzte && p95.letzteRateCents === 66_031, "95.000 € / 15 J.: letzte Rate 660,31 € (vorher 660,30 € — halber Cent abgerundet)", p95.letzteRateCents);
}

// ═══ 2 GRENZFÄLLE ═══════════════════════════════════════════════════════════
abschnitt("2 Grenzfälle");
{
  const z = (m: number) => C.kapitalCZinsBp(m, PAR);
  ok(z(1) === 0 && z(16) === 0 && z(17) === 150 && z(28) === 150 && z(29) === 200 && z(40) === 200 && z(41) === 250 && z(185) === 850 && z(186) === 850, "Zinstreppe: 16 → 0, 17 → 1,5 %, 28/29 → 1,5/2 %, 40/41 → 2/2,5 %, 185 → 8,5 %");
  const wirft = (j: unknown) => { try { C.kapitalCPlan(PAR, j as number); return false; } catch (e) { return e instanceof RangeError; } };
  ok(wirft(4) && wirft(16) && wirft(10.5) && wirft(Number.NaN) && wirft("10"), "Laufzeit außerhalb 5–15, krumm oder kein Zahlwert → RangeError");
  ok(C.kapitalCLaufzeitGueltig(5, PAR) && C.kapitalCLaufzeitGueltig(15, PAR) && !C.kapitalCLaufzeitGueltig(16, PAR) && C.kapitalCLaufzeiten(PAR).join() === "5,6,7,8,9,10,11,12,13,14,15", "Laufzeiten 5 … 15");
  const ohneZins = { ...PAR, betragCents: 1_000_000, zinsStartBp: 0, zinsSchrittBp: 0 };
  const p0 = C.kapitalCPlan(ohneZins, 7);
  ok(p0.zinsenCents === 0 && p0.monatsrateCents === Math.round(1_000_000 / 84) && p0.letzteRateCents === 1_000_000 - 83 * Math.round(1_000_000 / 84), "ohne Zins: Rate = Betrag/Raten, Rest in der letzten Rate", p0);
  const frueh = { ...PAR, zinsfreiMonate: 0 };
  const pf = C.kapitalCPlan(frueh, 5);
  const simF = simBig(PAR.betragCents, 5, pf.monatsrateCents, { ratenfrei: 6, zinsfrei: 0, start: 150, schritt: 50 });
  ok(pf.treppe[0].ratenfrei && pf.treppe[0].zinsenCents > 0 && pf.treppe[0].restschuldCents > PAR.betragCents && pf.treppe[pf.treppe.length - 1].restschuldCents === 0 && simF.s === 0n && simF.zinsen === pf.zinsenCents,
    "Zins in ratenfreien Monaten: wächst zu (BigInt gleich), Plan endet trotzdem bei 0");
  ok(C.kapitalCProzent(200) === "2 %" && C.kapitalCProzent(150) === "1,5 %" && !/\b0\s?%/.test(C.kapitalCProzent(300)), "Prozent mit geschütztem Leerzeichen, ohne „,0“ (kein „0 %“ für die Wortwand)");
  ok(C.kapitalCEurCent(233386) === "2.333,86 €" && C.kapitalCUsd(2611.4) === "2.611 US-$" && C.kapitalCEur(25_000_000) === "250.000 €" && C.kapitalCUngefaehr("x") === "≈ x", "Formate: 2.333,86 € · 2.611 US-$ · 250.000 € · „≈ x“ — je mit geschütztem Leerzeichen");
  ok(C.kapitalCOrdnung(17) === "siebzehnten" && C.kapitalCOrdnung(29) === "neunundzwanzigsten" && C.kapitalCOrdnung(7) === "siebten" && C.kapitalCOrdnung(41) === "einundvierzigsten" && C.kapitalCOrdnung(18) === "achtzehnten", "Ordnungszahlen im Vertrag");
  ok(C.kapitalCAusweisKurz("C01X00T47") === "••••••T47" && C.kapitalCAusweisKurz("AB") === "•••", "Ausweisnummer gekürzt: nur die letzten drei Zeichen");
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
  ok(/^Dieses Angebot gibt es nur mit Fast-Track: Ohne diesen Haken dürften wir erst nach Ablauf der Widerrufsfrist beginnen — für unser Ziel, die Auszahlung in Woche vier, zählt aber jede Woche\. Ohne den Haken können Sie das Angebot deshalb nicht annehmen\.$/.test(C.kapitalCAnnahmeTexte(D).sofortUnter), "Sofortbeginn offen als Bedingung des Angebots — mit seinem Grund (Ziel Woche vier, ohne Vorhaben und Termin), kein Schein einer Wahl");
  ok(/die Bürgin ist zum Zeitpunkt der Übernahme im Register ihres Bundesstaats als aktiv geführt/.test(vertragText), "Bürgschaft: Registerstand der Bürgin als Bedingung (Bestand, nicht abgeschwächt)");
  ok(/Die Bürgin wird im Register ihres Bundesstaats derzeit als inaktiv geführt \(Stand 19\.10\.2026\); die Bürgschaft übernimmt sie erst nach ihrer Reaktivierung, wenn sie dort wieder als aktiv geführt wird \(Absatz 3\)/.test(vertragText), "Bürgin inaktiv → offen in Ziffer 5 Absatz 1, mit Stand und Verweis auf die Bedingung");
  const aktiv = flach(absText(C.kapitalCZiffern({ ...D, parameter: { ...PAR, buerginAktiv: true } })).join("\n"));
  ok(!/inaktiv/.test(aktiv) && !sammle(C.kapitalCSeite({ ...D, parameter: { ...PAR, buerginAktiv: true } }), []).some((t) => /inaktiv/.test(t)), "Bürgin aktiv (nach dem Reinstatement) → kein Inaktiv-Satz in Vertrag und Seite");
  ok(C.kapitalCPflichtFehlen({ ...D, parameter: { ...PAR, unterschriftFrei: false } }).some((f) => /Freigabe zur Unterschrift/.test(f))
    && C.kapitalCPflichtFehlen({ ...D, parameter: { ...PAR, unterschriftFrei: true } }).length === 0, "Unterschrift erst nach Justins GO: ohne Freigabe gesperrt, mit Freigabe frei");
  ok(C.KAPITAL_C_VORGABEN.unterschriftFrei === false && C.kapitalCParameterAus({}).unterschriftFrei === false
    && C.kapitalCParameterAus({ unterschriftFrei: "ja" as any }).unterschriftFrei === false && C.kapitalCParameterAus({ unterschriftFrei: true }).unterschriftFrei === true, "Vorgabe gesperrt; nur ein echtes true gibt frei");
  ok(/tritt diesem Vertrag für Ziffer 5 bei/.test(vertragText) && /als Gesamtschuldner den gezahlten Betrag/.test(vertragText)
    && /Eine Bareinlage oder dingliche Sicherheit verlangen FIAON und die Bürgin nicht; für den Rückgriff nach Absatz 5 haftet der Auftraggeber persönlich/.test(vertragText), "Bürgschaft: Beitritt, Rückgriff offen, persönliche Haftung ausdrücklich (kein „ohne Sicherheiten“)");
  const ohneDd = flach(absText(C.kapitalCZiffern({ ...D, parameter: { ...PAR, ddAbgeschlossen: false } })).join("\n"));
  ok(/für den Rückgriff nach Absatz 4 haftet/.test(ohneDd) && /Rückgriff nach Ziffer 5 Absatz 4 gilt fort/.test(ohneDd) && /\(Absatz 2\)/.test(ohneDd) && /Rückgriff nach Ziffer 5 Absatz 5 gilt fort/.test(vertragText), "Absatz-Verweise in Ziffer 5/9 folgen dem Absatz zur Prüfung (mit/ohne Due Diligence)");
  ok(!/stets in der Lage/.test(vertragText) && /Zeichnet sich ab, dass sie eine Rate nicht pünktlich zahlen kann, teilt der Auftraggeber dies FIAON unverzüglich in Textform mit/.test(vertragText), "keine Ausstattungspflicht ohne Grenze — stattdessen Mitteilung, wenn eine Rate wackelt („dies FIAON“)");
  ok(/Die Mittel sind nicht an die USA gebunden/.test(vertragText) && /klärt der Partner-Steuerberater von FIAON vorab/.test(vertragText) && /Eine US-Gesellschaft ist kein Steuermodell\./.test(vertragText), "Kapital frei + Partner-Steuerberater + kein Steuermodell");
  const seiteText = flach(sammle(C.kapitalCSeite(D), []).join("\n"));
  ok(seiteText.includes(G.GLOBAL_KAPITAL_FREI.de.satz) && seiteText.includes(G.GLOBAL_KAPITAL_FREI.de.steuer), "Seite: GLOBAL_KAPITAL_FREI wörtlich (Satz + Steuer)");
  // Begleitung statt Zusage (§ 5 UWG, § 32 KWG): FIAON begleitet, das Institut entscheidet; keine „eigene Finanzierungsbank“.
  ok(/FIAON begleitet die Gesellschaft bis zur Finanzierung über 250\.000 € durch eine US-Bank \(nachfolgend „finanzierendes Institut“\)/.test(vertragText) && /über die Finanzierung entscheidet das finanzierende Institut nach seiner Prüfung/.test(vertragText)
    && /Ziel der Begleitung ist eine Finanzierung zu folgenden Bedingungen:/.test(vertragText) && !/führt die Gesellschaft zu/.test(vertragText), "Ziffer 4: Begleitung bis zur Finanzierung, Institut entscheidet, Bedingungen als Ziel");
  ok(![vertragText, seiteText, rumpf].some((t) => /Finanzierungsbank/.test(t)), "nirgends „unsere/die US-Finanzierungsbank von FIAON“ (§ 39 KWG)");
  ok(/Due-Diligence-Prüfung des Auftraggebers mit positivem Ergebnis abgeschlossen; über die Finanzierung entscheidet das finanzierende Institut/.test(vertragText), "Due Diligence ohne Anschein einer Kreditzusage");
  const g = C.kapitalCGarantie(PAR);
  ok(vertragText.includes(flach(g.vertrag)) && /^Geld-zurück-Garantie: Wird der Gesellschaft die Finanzierung nach Absatz 1 und 2 nicht binnen acht Wochen ab Auftragserteilung ausgezahlt, erstattet FIAON/.test(g.vertrag)
    && /binnen vierzehn Tagen nach Fristende/.test(g.vertrag) && /alles, was er bis dahin an FIAON gezahlt hat \(Ziffer 6 Absatz 1 und 2\)/.test(g.vertrag), "Geld-zurück-Garantie: acht Wochen, alles Gezahlte (inkl. Erfolgshonorar) binnen vierzehn Tagen");
  ok(/auf seinen Wunsch löst FIAON sie dann auf und trägt die Kosten dafür; bis dahin bestehen ihre US-Meldepflichten nach Ziffer 8 fort/.test(g.vertrag) && /Eine bereits gegründete Gesellschaft bleibt dem Auftraggeber; auf seinen Wunsch löst FIAON sie auf und trägt die Kosten dafür/.test(vertragText) && !/auf eigene Kosten/.test(vertragText), "Garantiefall und Widerruf: Auflösung auf Wunsch, FIAON trägt die Kosten (eindeutig), US-Pflichten bis dahin");
  ok(/Die Frist ruht, solange die Vergütung nach Ziffer 6 Absatz 1 nicht gezahlt ist\. Sie ruht außerdem nur für die Tage, um die der Auftraggeber die Frist nach Ziffer 7 Absatz 2 überschreitet, und solange ein der Gesellschaft vorgelegtes Finanzierungsangebot über den Betrag zu den Bedingungen nach Absatz 2 ohne weitere Sicherheiten oder Kosten des Auftraggebers zur Annahme offensteht; lehnt die Gesellschaft ein solches Angebot ab oder lässt sie es verfallen, entfällt die Geld-zurück-Garantie\./.test(vertragText)
    && !/nicht annimmt/.test(vertragText), "Ruhen eng und mit Ende: nur Überschreitungstage, nur solange ein Angebot nach Absatz 2 offensteht; abgelehnt → Garantie entfällt");
  // Runde 2 (Recht): eindeutige Bezüge, Begleitung ab Monat 18 nur mit der Jahresbetreuung, erste Jahresmeldung im ersten Jahr, Beschwerdeweg.
  ok(vertragText.includes("über die Finanzierung das finanzierende Institut; für die Finanzierung gilt die Geld-zurück-Garantie nach Ziffer 4.") && !/; für sie gilt die Geld-zurück-Garantie/.test(vertragText), "Ziffer 8: „für die Finanzierung gilt …“ (kein zweideutiges „sie“, Ziffer 3 Abs. 2)");
  ok(/darüber entscheidet das jeweilige Institut\. Solange die Jahresbetreuung nach Ziffer 6 Absatz 3 läuft, begleitet FIAON die Gesellschaft dabei\./.test(vertragText) && /der Pflichtenkalender, die Begleitung bei einer Aufstockung oder Umschuldung nach Ziffer 4 Absatz 2 und ein fester Ansprechpartner/.test(vertragText) && !/FIAON begleitet sie dabei/.test(vertragText), "Aufstockung/Umschuldung ab Monat 18: Begleitung nur mit der Jahresbetreuung (Ziffer 6 Abs. 3) — nichts außerhalb der Vertragsdauer");
  ok(/die erste Jahresmeldung der Gesellschaft beim Bundesstaat \(Annual Report\) einschließlich der Staatsgebühr und die erste jährliche US-Meldung/.test(vertragText), "Ziffer 2: erste Jahresmeldung beim Bundesstaat im ersten Jahr enthalten (sonst Auflösung der LLC möglich)");
  ok(/der Antrag auf die EIN laufen beschleunigt/.test(vertragText), "Ziffer 2 Abs. 3: „Antrag auf die EIN“");
  ok(/Beschwerden richtet der Auftraggeber an support@fiaon\.com\./.test(vertragText), "Ziffer 14: Beschwerdeweg im PDF (§ 312f Abs. 2 S. 2 BGB, Art. 246a § 1 Abs. 1 Nr. 7 EGBGB)");
  ok(/liegen FIAON bei Vertragsschluss vor; ihretwegen ruht die Frist nicht/.test(vertragText), "Unterlagen liegen vor → ihretwegen ruht die Frist nicht");
  ok(/Ziel der Parteien ist die Auszahlung binnen vier Wochen ab Auftragserteilung/.test(vertragText) && /Verbindlich ist allein die Frist der Geld-zurück-Garantie nach Absatz 5/.test(vertragText), "Vier Wochen nur als Ziel, verbindlich sind acht");
  ok(/Bleibt die Finanzierung aus, gilt die Geld-zurück-Garantie nach Ziffer 4; die Haftung nach Satz 1 bleibt unberührt/.test(vertragText) && !/gilt allein die Garantie/.test(vertragText), "Ziffer 11: Garantie schließt die Haftung bei Vorsatz/grober Fahrlässigkeit nicht aus (§ 309 Nr. 7 BGB)");
  const kond = flach(C.kapitalCKonditionenSatz(PAR));
  ok(vertragText.includes(kond) && /ersten sechs Monate nach der Auszahlung sind ratenfrei/.test(kond) && /fünf bis fünfzehn Jahre/.test(kond) && /ersten sechzehn Monate sind zinsfrei/.test(kond)
    && /ab dem siebzehnten Monat beträgt der Zins 1,5 % im Jahr/.test(kond) && /um 0,5 Prozentpunkte/.test(kond) && /ab dem neunundzwanzigsten Monat 2 %/.test(kond) && /Ab dem achtzehnten Monat kann die Gesellschaft auf Wunsch eine Aufstockung beantragen oder die Finanzierung über ein anderes Institut umschulden; darüber entscheidet das jeweilige Institut/.test(kond),
  "Konditionen: 6 ratenfrei, 5–15 Jahre, 16 zinsfrei, ab 17 1,5 % + 0,5 je Jahr, ab 18 Aufstockung beantragen (Institut entscheidet)");
  ok(/Die Raten zahlt die Gesellschaft pünktlich zu jedem Fälligkeitstag an das finanzierende Institut/.test(vertragText), "Raten pünktlich an das finanzierende Institut");
  ok(/Darlehen und Raten lauten auf US-Dollar; Euro-Beträge sind Umrechnungen, ihr Gegenwert in Euro kann sich mit dem Wechselkurs ändern — steigt der Kurs des US-Dollars um zehn Prozent, steigt jede Rate in Euro ebenfalls um zehn Prozent/.test(vertragText), "Währungsrisiko mit Beispiel");
  ok(/Ausgezahlt wird in US-Dollar zum Referenzkurs der Europäischen Zentralbank am Tag der Auszahlung; zum Kurs vom 26\.10\.2026 sind das rund 279\.700 US-\$/.test(vertragText), "Auszahlung in US-Dollar zum EZB-Kurs des Auszahlungstags, Schätzung mit Kurs und Datum");
  // Justin 27.10.2026, 17:40: „Was er mit dem Geld macht, ist seine Sache!“ — kein Zweck in Präambel, Ziffer 4 und Ziffer 5.
  ok(/Der Auftraggeber möchte eine eigene US-Gesellschaft gründen, die eine Finanzierung aufnimmt\./.test(rumpf) && !/Die Mittel dienen/.test(vertragText) && !/dient dem Zweck/.test(vertragText)
    && vertragText.includes(flach(C.KAPITAL_C_VERWENDUNG.vertrag)), "Kein Verwendungszweck: Präambel ohne Vorhaben, Ziffer 4 ohne „Die Mittel dienen …“ (die Gesellschaft entscheidet selbst, wofür und wo), Ziffer 5 ohne Zweckbindung");
  ok(/Alle Beträge sind Endpreise; eine etwa anfallende Umsatzsteuer ist darin enthalten/.test(vertragText), "Endpreise");
  ok(/verlängert sich nicht von selbst/.test(vertragText), "Jahresbetreuung verlängert sich nicht von selbst (Verbraucher)");
  ok(/Der Auftraggeber schließt diesen Vertrag als Verbraucher/.test(vertragText), "Verbrauchervertrag ausdrücklich");
  ok(/Herr Max Mustermann, geboren am 15\.01\.1980 in Musterstadt, deutscher Staatsangehöriger, wohnhaft Musterweg 1, 12345 Musterstadt, Deutschland, ausgewiesen durch Reisepass Nr\. C01X00T47 \(Stadt Musterstadt, gültig bis 01\.01\.2033\) und Personalausweis Nr\. T22000129/.test(vertragText), "Vertragsparteien: Name, Geburtsdatum, Anschrift, Ausweise (vollständig im Vertrag)");
  ok(/Bis zur Prüfung im Register ist der Name vorgemerkt/.test(vertragText), "LLC-Name vorgemerkt bis Registerprüfung");
  ok(/soweit die Voraussetzungen der US-Steuerbehörde vorliegen, was FIAON vorab prüft \(ITIN-Check\) — der persönlichen US-Steuernummer des Auftraggebers \(ITIN\)/.test(vertragText) && /Liegen die Voraussetzungen für eine ITIN nicht vor, zeigt FIAON dem Auftraggeber die Wege für Konto und Karten ohne ITIN/.test(vertragText), "ITIN nur nach ITIN-Check, Folge ohne Grund geregelt (E-437)");
  ok(/Für die Leistungen nach Ziffer 2 und 3 im ersten Jahr \(Gründung, Konto und Karten\) zahlt der Auftraggeber einmalig 2\.790 €/.test(vertragText) && !/Ziffer 2 bis 4 im ersten Jahr/.test(vertragText), "Gründungspreis nur für Gründung, Konto und Karten (keine eigene Vergütung für die Finanzierung, § 34c GewO)");
  ok(/Weitere Allgemeine Geschäftsbedingungen gelten nicht\./.test(vertragText) && !/Allgemeine Geschäftsbedingungen gelten für diesen Vertrag nicht/.test(vertragText), "Ziffer 14: „Weitere AGB gelten nicht“ (der Vertrag selbst ist vorformuliert)");
  ok(/Die Anträge stellen der Auftraggeber bzw\. die Gesellschaft selbst; FIAON bereitet sie vollständig vor/.test(vertragText), "Banking stellt der Kunde selbst");
  ok(ziffern.some((z) => z.titel === B.BEFUGNISSE_TITEL.de) && B.vertragHatBefugnisse(C.KAPITAL_C_FASSUNG), "Befugnisse aus der Quelle (Ziffer 13), Fassung trägt die Ziffer");
  ok(/weder bereit noch verpflichtet, an Streitbeilegungsverfahren vor einer Verbraucherschlichtungsstelle teilzunehmen/.test(vertragText) && /Rechtswahl gilt nur, soweit/.test(vertragText), "Verbraucher: Streitbeilegung, Rechtswahl mit Schutzvorbehalt");
  ok(ziffern.map((z) => z.nr).join() === "1,2,3,4,5,6,7,8,9,10,11,12,13,14", "vierzehn Ziffern in Reihenfolge");
  const an = C.kapitalCAnnahmeTexte(D);
  ok(an.knopf === "Auftrag zahlungspflichtig erteilen" && an.knopf === K.KAPITAL_KNOPF, "Knopf „Auftrag zahlungspflichtig erteilen“ (§ 312j Abs. 3 BGB)");
  ok(["vertrag", "informationen", "widerruf"].every((x) => an.gelesen.includes((an.gelesenLinks as Record<string, string>)[x])), "die drei Verweis-Wörter stehen im Satz „gelesen“");
  const info = C.kapitalCSeite(D).informationen.zeilen;
  ok(["Ihr Vertragspartner", "Die Leistung", "Die Preise", "Zahlung", "Beginn und Zeitplan", "Geld-zurück-Garantie", "Sicherheiten und Bürgschaft", "Vertragsdauer", "Widerrufsrecht", "Gewährleistung und Beschwerden", "Vertragstext und Sprache"].every((t) => info.some((x) => x.titel === t)), "Informationen vor Vertragsschluss (Art. 246a EGBGB) vollständig — mit Garantie, Sicherheiten, Vertragsdauer");
  const infoText = (t: string) => flach(info.find((x) => x.titel === t)?.text ?? "");
  ok(/Die Frist ruht nur, solange Gründung und Fast-Track nicht bezahlt sind/.test(infoText("Geld-zurück-Garantie")) && /persönlich/.test(infoText("Sicherheiten und Bürgschaft")) && /inaktiv/.test(infoText("Sicherheiten und Bürgschaft")), "Informationen: Garantie mit Ruhensgründen, persönlicher Rückgriff, Registerstand der Bürgin");
  ok(/Companies House/.test(info[0].text) && /\+41 44 244 93 01/.test(info[0].text) && /support@fiaon\.com/.test(info[0].text), "Anbieter mit Register, Telefon, E-Mail");
  // Gekürzte Ausweisnummern auf der Seite und im Entwurf; die Prüfsumme läuft über den vollständigen Vertrag.
  const kurz = ohneHtml(C.kapitalCRumpfHtml(D, null, { ausweiseGekuerzt: true }));
  ok(kurz.includes("Reisepass Nr. ••••••T47") && kurz.includes("Personalausweis Nr. ••••••129") && !kurz.includes("C01X00T47") && !kurz.includes("T22000129") && rumpf.includes("C01X00T47"), "Ausweisnummern: über den Link gekürzt, im Vertrag vollständig");
}

// ═══ 4 KEIN BANKNAME, KEINE KARTENRAHMEN-ZUSAGE ═════════════════════════════
abschnitt("4 Kein Bankname, keine Kartenrahmen-Zusage");
const alleTexte: { wo: string; text: string }[] = [];
const push = (wo: string, wert: unknown) => sammle(wert, []).forEach((t) => alleTexte.push({ wo, text: flach(t) }));
push("vertrag", absText(ziffern)); push("praeambel", C.kapitalCPraeambel(D)); push("seite", C.kapitalCSeite(D)); push("annahme", C.kapitalCAnnahmeTexte(D));
push("uebersicht", C.kapitalCBestellUebersicht(D, 10)); push("annahme-fest", { ...C.KAPITAL_C_ANNAHME, fertigTitel: C.KAPITAL_C_ANNAHME.fertigTitel("Herr Mustermann"), fertigText: C.KAPITAL_C_ANNAHME.fertigText("max@beispiel.example", "MUSTER LLC", "zehn Jahre"), fertigZahlung: C.KAPITAL_C_ANNAHME.fertigZahlung("3.289 €") });
push("etappen", C.KAPITAL_C_ETAPPEN); push("vermerk", C.kapitalCLaufzeitSatz(PAR, 10)); push("bestaetigung", C.KAPITAL_C_BESTAETIGUNG);
push("mein-auftrag", C.kapitalCMeinAuftrag({ parameter: PAR, angenommenAm: "2026-10-28", teile: [], garantieErfuelltAm: null, erstattungAusgeloest: false, laufzeitJahre: 10 }));
const BANK = /\b(bank of america|boa|bofa|chase|capital one|american express|amex|wells fargo|citi(bank|group)?|jp ?morgan|goldman|mercury|brex|ramp)\b/i;
ok(alleTexte.every((x) => !BANK.test(x.text)), "kein Bankname in Vertrag, Seite, Übersicht, Annahme, Etappen, Bestätigung", alleTexte.filter((x) => BANK.test(x.text)).map((x) => `${x.wo}: ${x.text.slice(0, 80)}`));
ok(alleTexte.every((x) => !/\bbis zu\b/i.test(x.text)), "kein „bis zu“ (außer im gesetzlichen Muster der Anlage)", alleTexte.filter((x) => /\bbis zu\b/i.test(x.text)).map((x) => x.text.slice(0, 80)));
ok(alleTexte.every((x) => !/\b60\s?(x|×|-?mal|fach)\b/i.test(x.text)), "kein „60x“");
const RAHMEN = /(\d[\d.]*\s*(US-\$|USD|\$|€)[^.]{0,50}\b(karte|rahmen|limit))|((karte|kreditkarte|rahmen|limit)\w*[^.]{0,50}\d[\d.]*\s*(US-\$|USD|\$))/i;
// Der Name der Leistung „Gründung, Konto und Karten“ (Runde 2: überall gleich, wie auf der Rechnung) ist keine Rahmen-Zahl.
const ohneLeistungsname = (t: string) => t.replace(/Gründung, Konto und Karten/g, "Gründung");
ok(alleTexte.every((x) => !RAHMEN.test(ohneLeistungsname(x.text))), "keine Kartenrahmen-Zahl", alleTexte.filter((x) => RAHMEN.test(ohneLeistungsname(x.text))).map((x) => x.text.slice(0, 90)));
const seiteFlach = flach(sammle(C.kapitalCSeite(D), []).join("\n"));
ok(seiteFlach.includes("Einführungszeiträume ohne Sollzins bieten manche Herausgeber an; die Bedingungen legt jeder Herausgeber selbst fest.") && seiteFlach.includes("Über Konto, Karten und deren Rahmen entscheidet das jeweilige Institut."), "die zwei erlaubten Karten-Sätze stehen auf der Seite");
ok(vertragText.includes("Einführungszeiträume ohne Sollzins bieten manche Herausgeber an; die Bedingungen legt jeder Herausgeber selbst fest.") && /Über Konto, Karten und deren Rahmen entscheidet das jeweilige Institut/.test(vertragText) && /Für Konto und Karten gilt die Geld-zurück-Garantie nach Ziffer 4 nicht/.test(vertragText), "Vertrag: Institut entscheidet, Sollzins-Satz, Garantie nicht für Karten");
ok(alleTexte.every((x) => !/\bnorthwest\b/i.test(x.text)) && !/Schwarzott|Northwest/i.test(readFileSync(path.join(WURZEL, "shared/fiaon-global-angebot-kapital-c.ts"), "utf8").replace(/\/\/.*$/gm, "")), "kein Partnername im Code der Fassung C");

// ═══ 4b KEIN VERWENDUNGSZWECK (Justin 27.10.2026, 17:40) ═════════════════════
abschnitt("4b Kein Verwendungszweck — Vorhaben, Ort, Anteil, Termin nirgends (Justin 27.10.2026)");
{
  // (a) Ein MARKEN-Vorhaben in den Daten: Kein Kundentext und kein Vertrag darf eines seiner Felder zeigen (die Felder bleiben nur
  //     als Datenfeld in der Akte).
  const MARKE = { art: "Markenvorhaben", wo: "in Markenland", woKurz: "im Markenland", bezahltProzent: 37, fertigstellung: "2027-03-19" };
  const DM = { ...D, parameter: { ...PAR, projekt: MARKE } };
  const angenommen = { am: new Date("2026-10-28T10:00:00Z"), ip: "203.0.113.7", userAgent: "x", hash: "abc", wahl: { llc: { wunsch: "MUSTER VENTURES LLC", alternative1: "", alternative2: "" }, laufzeitJahre: 10, sofortBeginn: true as const }, unterschrift: { art: "getippt" as const, name: "Max Mustermann" } };
  const texte: { wo: string; text: string }[] = [];
  const dazu = (wo: string, wert: unknown) => sammle(wert, []).forEach((t) => texte.push({ wo, text: flach(t) }));
  dazu("vertrag (Entwurf)", ohneHtml(C.kapitalCRumpfHtml(DM, null, { ausweiseGekuerzt: true })));
  dazu("vertrag (angenommen)", ohneHtml(C.kapitalCRumpfHtml(DM, angenommen)));
  dazu("vertrag-kopf", [C.kapitalCVertragTitel(), C.kapitalCVertragUnterzeile(DM), C.kapitalCVertragInhalt(DM)]);
  dazu("seite", C.kapitalCSeite(DM)); dazu("annahme", C.kapitalCAnnahmeTexte(DM)); dazu("uebersicht", C.kapitalCBestellUebersicht(DM, 10));
  dazu("nach-der-annahme", { ...C.KAPITAL_C_ANNAHME, fertigTitel: C.KAPITAL_C_ANNAHME.fertigTitel("Herr Mustermann"), fertigText: C.KAPITAL_C_ANNAHME.fertigText("max@beispiel.example", "MUSTER LLC", "zehn Jahre"), fertigZahlung: C.KAPITAL_C_ANNAHME.fertigZahlung("3.289 €") });
  dazu("bestaetigung", C.KAPITAL_C_BESTAETIGUNG); dazu("etappen", C.KAPITAL_C_ETAPPEN);
  dazu("mein-auftrag", C.kapitalCMeinAuftrag({ parameter: DM.parameter, angenommenAm: "2026-10-28", teile: [], garantieErfuelltAm: null, erstattungAusgeloest: false, laufzeitJahre: 10 }));
  dazu("zahlungsseite", C.kapitalCZahlungsseiteTeil2({ bezahlt: false, angebotRef: "FIAON-IA-CMUSTER", titel: "Erfolgshonorar", eingetragenAm: "2026-11-04", zielWochen: 4 }));
  dazu("aufgaben", [C.kapitalCStartAufgabe({ angebotRef: "R", name: "Max Mustermann", parameter: DM.parameter, bezahltAm: "2026-10-29", zweck: "FIAON-ABC", frist: { beginn: "2026-10-29", ende: "2026-12-24" }, llc: "MUSTER LLC", laufzeitJahre: 10, bestaetigung: { da: true, grund: null } }),
    C.kapitalCFristAufgabe({ schritt: "warnung14", tageBis: 14, angebotRef: "R", name: "Max Mustermann", fristBeginn: "2026-10-29", fristEnde: "2026-12-24", parameter: DM.parameter })]);
  const marke = /Markenvorhaben|Markenland|\b37\s?%|19\.03\.2027|19\. März 2027/;
  ok(texte.length > 150 && texte.every((x) => !marke.test(x.text)), `kein Feld des Vorhabens in ${texte.length} Texten (Vertrag, Seite, Annahme, Übersicht, Bestätigung, Mein Auftrag, Zahlungsseite, Aufgaben)`, texte.filter((x) => marke.test(x.text)).map((x) => `${x.wo}: ${x.text.slice(0, 90)}`));
  // (b) Kein Wort eines Zwecks — auch nicht fest im Text (Vorhaben, Ort, bezahlter Anteil, Termin, Bauträger, Restzahlung).
  const ZWECK = /emirat|\bVAE\b|arabisch|dubai|immobil|bauträger|fertigstell|\bprojekt|restzahlung|\b60\s?%|31\.\s?12\.|31\. Dezember/i;
  ok(texte.every((x) => !ZWECK.test(x.text)), "kein Vorhaben, kein Ort, kein bezahlter Anteil, kein Termin, kein Bauträger — in keinem Kundentext und keinem Vertrag", texte.filter((x) => ZWECK.test(x.text)).map((x) => `${x.wo}: ${x.text.slice(0, 90)}`));
  // (c) Statt des Zwecks: „Sie entscheiden“ — Seite (Konditionen, Fragen) und Vertrag (Ziffer 4 Absatz 4).
  const seiteM = flach(sammle(C.kapitalCSeite(DM), []).join(" "));
  ok(seiteM.includes(C.KAPITAL_C_VERWENDUNG.seite) && flach(absText(C.kapitalCZiffern(DM)).join(" ")).includes(flach(C.KAPITAL_C_VERWENDUNG.vertrag)) && seiteM.includes(C.KAPITAL_C_VERWENDUNG.rat),
    "Statt des Zwecks: „Wofür Ihre Gesellschaft die Finanzierung einsetzt, entscheiden Sie“, Ziffer 4 Abs. 4 und der Rat ohne Bauträger");
  // (d) Der Hero, wie Justin ihn will: die Finanzierung für die Gesellschaft — Gründung, Begleitung, Bürgschaft, Geld-zurück-Garantie.
  const h = C.kapitalCSeite(D).hero;
  ok(h.titel === "Die Finanzierung für Ihre Gesellschaft." && /^Wir gründen Ihre eigene US-Gesellschaft und begleiten Sie bis zur Auszahlung Ihrer Finanzierung über 250\.000 €\. Unsere US-Partnergesellschaft übernimmt die Bürgschaft gegenüber der Bank — und Sie erhalten eine Geld-zurück-Garantie\.$/.test(flach(h.lead))
    && flach(C.kapitalCSeite(D).auftakt.zeile) === "Ihre eigene US-Gesellschaft und Ihre Finanzierung über 250.000 €.", "Hero und Willkommen ohne Verwendungszweck", { titel: h.titel, lead: h.lead });
  ok(Object.values(C.KAPITAL_C_VORGABEN.projekt).every((v) => !v), "Vorgabe des Vorhabens leer (nur Datenfeld, das Repo trägt kein Vorhaben)");
}

// ═══ 5 KOSTEN VOLLSTÄNDIG ════════════════════════════════════════════════════
abschnitt("5 Kosten vollständig (offen, Endpreise, Gesamtpreis)");
{
  const s = C.kapitalCSeite(D);
  const inv = flach(sammle(s.investition, []).join(" "));
  ok(["3.289 €", "2.790 €", "499 €", "6.890 €", "699 €", "10.179 €"].every((b) => inv.includes(b)), "Seite „Ihre Investition“: 3.289 € heute (2.790 + 499), 6.890 € mit der Eintragung, 699 €/Jahr, im ersten Jahr 10.179 €", inv);
  ok(/Endpreise/.test(inv) && /Erfolgshonorar/.test(inv) && /einschließlich Bürgschaft/.test(inv) && /Mit der Eintragung Ihrer Gesellschaft/.test(inv) && /nach unserem Plan in Woche eins oder zwei/.test(inv) && !/fällig erst/.test(inv), "Erfolgshonorar inkl. Bürgschaft, fällig mit der Eintragung (ohne „erst“), Zeitpunkt nach Plan genannt");
  ok(C.kapitalCErstesJahrCents(PAR) === 1_017_900, "Gesamtpreis erstes Jahr 10.179 €");
  const z6 = flach(absText(ziffern.filter((z) => z.nr === 6)).join(" "));
  ok(["2.790 €", "499 €", "3.289 €", "6.890 €", "699 €", "10.179 €"].every((b) => z6.includes(b)), "Vertrag Ziffer 6: alle Beträge und der Gesamtpreis");
  const ue = flach(sammle(C.kapitalCBestellUebersicht(D, 10), []).join(" "));
  ok(["3.289 €", "2.790 €", "499 €", "6.890 €", "699 €", "250.000 €", "10.179 €"].every((b) => ue.includes(b)) && /Endpreise/.test(ue), "Übersicht über dem Knopf: alle Beträge, Gesamtpreis, Endpreise");
  const inf = flach(sammle(s.informationen, []).join(" "));
  ok(["3.289 €", "2.790 €", "499 €", "6.890 €", "699 €", "10.179 €"].every((b) => inf.includes(b)), "Informationen vor Vertragsschluss: alle Beträge und der Gesamtpreis");
  ok(C.kapitalCHeuteCents(PAR) === 328_900, "heute fällig 3.289 €");
  const uz = C.kapitalCBestellUebersicht(D, 10).zeilen;
  ok(uz.some((z) => z.label === "Laufzeit der Finanzierung" && /^zehn Jahre · Monatsrate 2\.333,86 € \(≈ 2\.611 US-\$, letzte Rate 2\.334,34 €\) · Rechenbeispiel/.test(flach(z.wert))), "Übersicht: „Laufzeit der Finanzierung“ mit Rate (ohne ≈ vor der Euro-Rate) und letzter Rate", uz.find((z) => /Laufzeit/.test(z.label)));
  ok(uz.some((z) => z.label === "Vertragsdauer" && /Begleitung zwölf Monate ab der Eintragung; die Jahresbetreuung ab Jahr 2 nur mit Ihrer Zahlung, keine automatische Verlängerung/.test(z.wert)), "Übersicht: Vertragsdauer des FIAON-Vertrags (§ 312j Abs. 2 BGB)");
  const VER = /ersetzen Sie ihr den gezahlten Betrag persönlich — höchstens in Höhe des ausgezahlten Darlehens, zuzüglich der Kosten \(Ziffer 5\)\./;
  ok(uz.some((z) => z.label === "Ihre Verantwortung" && VER.test(z.wert)) && VER.test(s.rechner.verantwortung) && VER.test(flach(sammle(s.informationen, []).join(" "))), "Ihre Verantwortung mit Obergrenze: am Rechner, in der Übersicht und in den Informationen");
  ok(s.investition.zeilen[0].wann === "Mit Ihrem Auftrag" && uz.some((z) => z.label === "Fällig mit Ihrem Auftrag") && !uz.some((z) => /^Heute/.test(z.label)) && /Fällig mit Ihrem Auftrag: 3\.289 €/.test(flach(C.kapitalCAnnahmeTexte(D).unterKnopf)), "„Mit Ihrem Auftrag“ statt „heute“ — in Investition, Übersicht und unter dem Knopf");
  ok(/Kommt die Auszahlung nicht binnen acht Wochen, erhalten Sie auch diesen Betrag zurück\./.test(s.investition.zeilen[1].text) && flach(s.investition.summe) === "Im ersten Jahr insgesamt 10.179 €.", "Investition: Erfolgshonorar mit Geld-zurück-Satz, Summe ohne doppeltes „Endpreise“");
  ok(uz.some((z) => z.label === "Geld-zurück-Garantie (Ziffer 4)" && /erhalten Sie alles Gezahlte zurück/.test(z.wert)), "Übersicht: Geld-zurück-Garantie");
}

// ═══ 5b IHRE INVESTITION: LEISE, ABER VOLLSTÄNDIG UND LESBAR (Justin 27.10.2026, 17:40) ═══
abschnitt("5b Ihre Investition: leise, vollständig, lesbar (Justin 27.10.2026)");
{
  const inv = C.kapitalCSeite(D).investition;
  const zeile = flach(inv.zeile);
  ok(["3.289 €", "6.890 €", "10.179 €", "699 €"].every((b) => zeile.includes(b)) && /^Mit Ihrem Auftrag 3\.289 €, mit der Eintragung Ihrer Gesellschaft 6\.890 € einschließlich Bürgschaft — im ersten Jahr insgesamt 10\.179 €; ab dem zweiten Jahr 699 € je Jahr\. Alle Beträge sind Endpreise\.$/.test(zeile),
    "Investition vollständig in der SICHTBAREN Zeile: 3.289 € mit dem Auftrag, 6.890 € mit der Eintragung, im ersten Jahr 10.179 €, ab Jahr 2 699 € je Jahr, Endpreise", zeile);
  ok(C.kapitalCHeuteCents(PAR) === 328_900 && PAR.erfolgCents === 689_000 && C.kapitalCErstesJahrCents(PAR) === 1_017_900 && PAR.jahresCents === 69_900, "Zahlen der Zeile: 2.790 + 499 = 3.289; + 6.890 = 10.179; 699 je Jahr");
  ok(inv.knopf === "Einzelheiten" && inv.zeilen.length === 3 && flach(inv.summe) === "Im ersten Jahr insgesamt 10.179 €." && /Überweisung auf Rechnung/.test(inv.fein), "Einzelheiten zum Aufklappen: drei Posten, Summe, Zahlweg");
  // Leitplanke im Stil: jede Schrift 13–15 px, Farben nur --leise/--text, keine Karte, kein Schatten, keine Serifen-Ziffer.
  const css = readFileSync(path.join(WURZEL, "client/src/styles/global-angebot-kapital-c.css"), "utf8").replace(/\/\*[\s\S]*?\*\//g, "");
  const regeln = [...css.matchAll(/([^{}]*\.gkc-invest[^{}]*)\{([^}]*)\}/g)].map((m) => ({ sel: m[1].trim(), rumpf: m[2] }));
  const groessen = regeln.flatMap((r) => [...r.rumpf.matchAll(/font-size:\s*([\d.]+)px/g)].map((m) => ({ sel: r.sel, px: Number(m[1]) })));
  ok(regeln.length >= 8 && groessen.length >= 5 && groessen.every((g) => g.px >= 13 && g.px <= 15), "Investition: jede Schrift 13–15 px (lesbar, aber leise — keine großen Ziffern)", groessen);
  const farben = regeln.flatMap((r) => [...r.rumpf.matchAll(/(?:^|;)\s*color:\s*([^;]+)/g)].map((m) => m[1].trim()));
  ok(farben.length >= 5 && farben.every((f) => ["var(--leise)", "var(--text)"].includes(f)), "Investition: Farben nur --leise/--text", farben);
  ok(!regeln.some((r) => /box-shadow|background|var\(--serif\)|font-weight:\s*[5-9]00/.test(r.rumpf)), "Investition: keine Karte, kein Schatten, keine Serifen-Ziffer, kein kräftiges Gewicht");
  // Kontrast aus der Quelle (global-angebot-firma.css): --leise und --text auf Papier und auf Weiß mindestens 4,5:1.
  const basis = readFileSync(path.join(WURZEL, "client/src/styles/global-angebot-firma.css"), "utf8");
  const farbe = (n: string) => (basis.match(new RegExp(`--${n}:\\s*(#[0-9a-fA-F]{6})`)) ?? [])[1] ?? "";
  const lum = (hex: string) => { const k = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4)); return 0.2126 * k[0] + 0.7152 * k[1] + 0.0722 * k[2]; };
  const kontrast = (a: string, b: string) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };
  const papier = farbe("papier");
  const werte = ["leise", "text"].map((n) => ({ n, hex: farbe(n), papier: Math.round(kontrast(farbe(n), papier) * 100) / 100, weiss: Math.round(kontrast(farbe(n), "#ffffff") * 100) / 100 }));
  ok(!!papier && werte.every((w) => w.hex && w.papier >= 4.5 && w.weiss >= 4.5), "Investition: Kontrast ≥ 4,5:1 auf Papier und auf Weiß", werte);
  // Die Seite zeigt die Zeile SICHTBAR — vor „Einzelheiten“, nicht darin; kein großer Kopf mehr.
  const tsx = readFileSync(path.join(WURZEL, "client/src/pages/business-angebot-kapital-c.tsx"), "utf8");
  const a = tsx.indexOf('id="investition"'); const block = tsx.slice(a, tsx.indexOf("</section>", a));
  ok(a > 0 && block.indexOf("{I.zeile}") > 0 && block.indexOf("{I.zeile}") < block.indexOf("<Klapp") && !/<Kopf\b/.test(block) && !/gaf-h2/.test(block), "Seite: Zeile mit allen Beträgen sichtbar vor „Einzelheiten“, kein großer Kopf");
  // Die Übersicht direkt über dem Knopf (§ 312j BGB) bleibt vollständig.
  const ue = C.kapitalCBestellUebersicht(D, 10).zeilen;
  ok(["Fällig mit Ihrem Auftrag", "Mit der Eintragung", "Im ersten Jahr insgesamt", "Ab dem zweiten Jahr"].every((l) => ue.some((z) => z.label === l)), "Übersicht über dem Knopf: alle vier Preiszeilen stehen weiter da");
}

// ═══ 6 WORTWAND ═════════════════════════════════════════════════════════════
abschnitt("6 Wortwand (Hausregeln + E-188, Nachprüfung 27.10.)");
{
  // „Garantie“ ist in dieser Fassung Justins Entscheidung (Ziffer 4) — erlaubt NUR als Hauptwort der Geld-zurück-Garantie bzw.
  // ihrer Frist. „garantiert/garantieren“ (eine Zusage des Ergebnisses) bleibt überall rot, ebenso „Ist … sicher?“.
  const garantieGebunden = (satz: string) => /Geld-zurück-Garantie|Garantiefrist|Garantiefall/.test(satz) && !/\bgarantier/i.test(satz);
  const saetze = (t: string) => t.split(/(?<=[.!?])\s+(?=[A-ZÄÖÜ„])/);
  let treffer = 0;
  for (const { wo, text } of alleTexte) {
    for (const satz of saetze(text)) {
      for (const f of W.globalWortPruefen(satz, ["aufgabe_an_betreuer"])) {
        if (/garant/i.test(f.treffer) && garantieGebunden(satz)) continue;
        // Justin 27.10.2026 (E-432): Die Konditionen der Finanzierung stehen im Vertrag als Ziel der Begleitung (Ziffer 4 — das
        // Institut entscheidet, die Raten sind ein Rechenbeispiel). Einzelvertrag, keine Werbung: Nur DIESE Sätze sind von der
        // Zins-Regel (E-439, verbotene Aussage 1) ausgenommen; für alle anderen Global-Texte bleibt sie scharf.
        if (wo === "vertrag" && /verbotene Aussage 1/.test(f.hinweis) && /zinsfrei/.test(satz) && /siebzehnten Monat/.test(satz)) continue;
        treffer++; console.log(`  WAND  ${wo}: „${satz.slice(0, 110)}“ → ${f.hinweis}`);
      }
    }
  }
  ok(treffer === 0, `Wortwand: ${treffer} Treffer in ${alleTexte.length} Texten`);
  const garantSaetze = alleTexte.flatMap((x) => saetze(x.text)).filter((s) => /\bgarant/i.test(s));
  ok(garantSaetze.length > 0 && garantSaetze.every(garantieGebunden), `jedes „Garantie“ (${garantSaetze.length}) ist die Geld-zurück-Garantie — nie „garantiert“`, garantSaetze.filter((s) => !garantieGebunden(s)));
  const SCHAERFER = [/sicherheiten\s+verlang\w*[^.]*nicht/i, /\bist\b[^?]*\bsicher\?/i, /ohne pause/i, /ohne sicherheiten/i, /auszahlung[^.]{0,30}garantiert/i, /garantier\w*[^.]{0,40}auszahlung/i, /\bführt (die Gesellschaft|sie) zu einer finanzierung/i, /finanzierungsbank/i];
  const scharf = alleTexte.filter((x) => SCHAERFER.some((r) => r.test(x.text)));
  ok(scharf.length === 0, "keine Umschreibungen: „Sicherheiten verlangen … nicht“, „Ist … sicher?“, „ohne Pause“, „Auszahlung garantiert“, „führt zu einer Finanzierung“", scharf.map((x) => `${x.wo}: ${x.text.slice(0, 90)}`));
}

// ═══ 7 PRÜFSUMME, VERMERK, PRÜFUNGEN, NACH DER ANNAHME ══════════════════════
abschnitt("7 Prüfsumme, Annahmevermerk, Prüfungen, nach der Annahme");
{
  const h1 = C.kapitalCHashEingabe(D, C.kapitalCRumpfHtml(D, null));
  const h2 = C.kapitalCHashEingabe(D, C.kapitalCRumpfHtml({ ...D, parameter: { ...PAR, erfolgCents: 700_000 } }, null));
  ok(h1 !== h2 && h1 === C.kapitalCHashEingabe(D, C.kapitalCRumpfHtml(D, null)), "Prüfsumme stabil, ändert sich mit dem Preis");
  const vermerk = ohneHtml(C.kapitalCRumpfHtml(D, { am: new Date("2026-10-28T10:00:00Z"), ip: "203.0.113.7", userAgent: "x", hash: "abc", wahl: { llc: { wunsch: "MUSTER VENTURES LLC", alternative1: "", alternative2: "" }, laufzeitJahre: 10, sofortBeginn: true }, unterschrift: { art: "getippt", name: "Max Mustermann" } }));
  ok(/Laufzeit der Finanzierung \(Ziffer 4 Absatz 2\): zehn Jahre \(120 Monatsraten ab dem siebten Monat nach der Auszahlung\); Monatsrate nach dem Rechenbeispiel 2\.333,86 € \(≈ 2\.611 US-\$, letzte Rate 2\.334,34 €\)/.test(vermerk), "Annahmevermerk: Laufzeit, Raten, Monatsrate und letzte Rate", vermerk.slice(vermerk.indexOf("Annahmevermerk"), vermerk.indexOf("Annahmevermerk") + 400));
  ok(/Wunschname MUSTER VENTURES LLC/.test(vermerk) && vermerk.includes(C.KAPITAL_C_SOFORT_TEXT) && vermerk.includes(C.KAPITAL_C_GELESEN_TEXT), "Annahmevermerk: Name, Sofortbeginn und „gelesen“ wörtlich");
  const roh = C.kapitalCParameterAus({ betragCents: -5, laufzeitMinJahre: 7, laufzeitMaxJahre: 3, laufzeitVorschlagJahre: 40, kursUsdJeEur: 9, projekt: { bezahltProzent: 140 } as any, buerginAktiv: "ja" as any, buerginStandAm: "19.10.2026" });
  ok(roh.betragCents === C.KAPITAL_C_VORGABEN.betragCents && roh.laufzeitMaxJahre >= roh.laufzeitMinJahre && roh.laufzeitVorschlagJahre <= roh.laufzeitMaxJahre && roh.kursUsdJeEur === C.KAPITAL_C_VORGABEN.kursUsdJeEur && roh.projekt.bezahltProzent === C.KAPITAL_C_VORGABEN.projekt.bezahltProzent
    && roh.buerginAktiv === false && roh.buerginStandAm === "", "Parameter: Unsinn fällt auf die Vorgaben zurück (Bürgin ohne Beleg = inaktiv)");
  ok(!C.kapitalCKundePruefen({ ...KUNDE_ROH, ausweise: [] }).ok && !C.kapitalCKundePruefen({ ...KUNDE_ROH, plz: "1234" }).ok && !C.kapitalCKundePruefen({ ...KUNDE_ROH, email: "kein" }).ok
    && !C.kapitalCKundePruefen({ ...KUNDE_ROH, ausweise: [{ art: "reisepass", nummer: "x", gueltigBis: "2030-01-01", behoerde: "B" }] }).ok && !C.kapitalCKundePruefen({ ...KUNDE_ROH, geburtsdatum: "15.01.1980" }).ok, "Kunde: Ausweis, PLZ, E-Mail, Nummer, Geburtsdatum werden geprüft");
  const DF = { ...D, parameter: { ...PAR, unterschriftFrei: true } };
  ok(C.kapitalCPflichtFehlen(DF).length === 0 && C.kapitalCPflichtFehlen({ ...DF, buergin: { ...BUERGIN, registernummer: "" } }).length === 1, "Pflichtfelder: vollständig (freigegeben) / Bürgin ohne Registernummer fehlt");
  const lage = { status: "angenommen", parameter: PAR, angenommenAm: "2026-10-28", heute: "2026-11-05", teil1Bezahlt: true, vorhanden: null };
  ok(!C.kapitalCTeil2Pruefen({ ...lage, teil1Bezahlt: false }, { datum: "2026-11-04" }).ok && !C.kapitalCTeil2Pruefen({ ...lage, status: "offen" }, { datum: "2026-11-04" }).ok
    && !C.kapitalCTeil2Pruefen(lage, { datum: "2026-11-06" }).ok && !C.kapitalCTeil2Pruefen(lage, { datum: "2026-10-27" }).ok, "Teil 2: erst nach Zahlung Teil 1, nach Annahme, Datum nicht in der Zukunft/vor der Annahme");
  const t2 = C.kapitalCTeil2Pruefen(lage, { datum: "2026-11-04", beleg: "  Sunbiz   Bestätigung " }) as any;
  ok(t2.ok && t2.daten.betragCents === 689_000 && t2.daten.beleg === "Sunbiz Bestätigung", "Teil 2: Erfolgshonorar 6.890 €, Beleg geglättet");
  ok((C.kapitalCTeil2Pruefen({ ...lage, vorhanden: { rechnungSteht: true } }, { datum: "2026-11-04" }) as any).schon === true, "Teil 2: schon berechnet → nichts Neues");
  const au = { status: "angenommen", angenommenAm: "2026-10-28", heute: "2026-11-20", garantieErfuelltAm: null, erstattungAusgeloest: false, fristBeginn: "2026-10-29" };
  ok(C.kapitalCAuszahlungPruefen(au, { datum: "2026-11-19" }).ok && (C.kapitalCAuszahlungPruefen({ ...au, garantieErfuelltAm: "2026-11-19" }, { datum: "2026-11-19" }) as any).schon && !C.kapitalCAuszahlungPruefen({ ...au, erstattungAusgeloest: true }, { datum: "2026-11-19" }).ok, "Auszahlung eintragen: einmal, nicht nach dem Garantiefall");
  ok(!C.kapitalCAuszahlungPruefen({ ...au, fristBeginn: null }, { datum: "2026-11-19" }).ok && !C.kapitalCAuszahlungPruefen(au, { datum: "2026-10-28" }).ok, "Auszahlung erst, wenn Teil 1 bezahlt ist (Frist läuft), nie vor dem Fristbeginn — kein Fehlklick setzt „Garantie erfüllt“");
  // Runde 2 (Technik): Teil 2 auf der öffentlichen Zahlungsseite — Texte der Fassung C, nie „Bürgschaft zugesagt“.
  const zs = C.kapitalCZahlungsseiteTeil2({ bezahlt: false, angebotRef: "FIAON-IA-CMUSTER", titel: "Erfolgshonorar", eingetragenAm: "2026-11-04", zielWochen: 4 });
  const zsText = flach(sammle(zs, []).join(" "));
  ok(/^Ihre Gesellschaft ist eingetragen — offen ist das Erfolgshonorar \(Ziffer 6 Absatz 2, Angebot FIAON-IA-CMUSTER\)\.$/.test(zs.satz) && zs.pruefung.text === "am 04.11.2026 beim Bundesstaat (Ziffer 6 Absatz 2)"
    && !/zugesagt|Bürgschaftsgebühr|Bürgschaft für Ihre Finanzierung steht|stimmt die Form der Bürgschaft/.test(zsText) && /Woche vier/.test(zsText) && /Geld-zurück-Garantie/.test(zsText), "Zahlungsseite Teil 2 (Fassung C): eingetragen + Erfolgshonorar, kein „Bürgschaft zugesagt“", zs);
  ok(K.kapitalRechnungsTextNachFassung({ angebotRef: "FIAON-IA-CMUSTER", nr: 2, auftragRef: "FIAON-X", ereignisAm: "2026-11-04", fassung: C.KAPITAL_C_FASSUNG }).beschreibung.includes("Erfolgshonorar einschließlich Bürgschaft (Ziffer 6 Absatz 2) — Gesellschaft eingetragen am 04.11.2026")
    && /Konto und Karten im ersten Jahr sowie Fast-Track \(Ziffer 6 Absatz 1\)/.test(K.kapitalRechnungsTextNachFassung({ angebotRef: "R", nr: 1, auftragRef: "A", fassung: C.KAPITAL_C_FASSUNG }).beschreibung)
    && !/Finanzierungsbegleitung/.test(K.kapitalRechnungsTextNachFassung({ angebotRef: "R", nr: 1, auftragRef: "A", fassung: C.KAPITAL_C_FASSUNG }).beschreibung + C.KAPITAL_C_TEIL1_TITEL)
    && /Bürgschaftsgebühr/.test(K.kapitalRechnungsTextNachFassung({ angebotRef: "R", nr: 2, auftragRef: "A", fassung: K.KAPITAL_FASSUNG }).beschreibung), "Rechnungstexte je Fassung (C: ohne „Finanzierungsbegleitung“, Erfolgshonorar; B unverändert)");
  ok(K.istKapitalFassung(C.KAPITAL_C_FASSUNG) && K.istKapitalCFassung(C.KAPITAL_C_FASSUNG) && !K.istKapitalCFassung(K.KAPITAL_FASSUNG) && K.kapitalMitGebuehren(C.KAPITAL_C_FASSUNG), "Fassung C läuft durch alle Kapital-Wege, verzweigt aber eigens");
  const t1 = { nr: 1, titel: C.KAPITAL_C_TEIL1_TITEL, betragCents: 328_900, stand: "bezahlt", rechnungsnummer: "R-1", bestellRef: "FIAON-1", ereignisAm: null, bezahltAm: "2026-10-29" };
  const ma = C.kapitalCMeinAuftrag({ parameter: PAR, angenommenAm: "2026-10-28", teile: [t1], garantieErfuelltAm: null, erstattungAusgeloest: false, laufzeitJahre: 10 });
  ok(ma.teile.length === 2 && ma.teile[1].stand === "noch nicht fällig" && ma.teile[1].betragCents === 689_000 && /mit der Eintragung Ihrer Gesellschaft/.test(String(ma.teile[1].hinweis)), "Mein Auftrag: Teil 2 Erfolgshonorar noch nicht fällig, mit ruhigem Satz");
  ok(ma.fristBeginn === "2026-10-29" && ma.fristEnde === "2026-12-24" && /^Ihre Geld-zurück-Garantie: Ist Ihre Finanzierung über 250\.000 € nicht bis zum 24\.12\.2026 ausgezahlt, erstatten wir Ihnen alles/.test(flach(ma.garantieSatz)) && ma.summeCents === 328_900, "Mein Auftrag: Frist ab Zahlung + acht Wochen, Geld-zurück-Wortlaut, Summe nur Entstandenes", ma);
  ok(/zehn Jahre, Monatsrate nach dem Rechenbeispiel 2\.333,86 €/.test(flach(ma.seiteHinweis)), "Mein Auftrag nennt Laufzeit und Rate");
  const fa = C.kapitalCFristAufgabe({ schritt: "abgelaufen", tageBis: -1, angebotRef: "R", name: "Max Mustermann", fristBeginn: "2026-10-29", fristEnde: "2026-12-24", parameter: PAR });
  ok(/bis 07\.01\.2027/.test(fa.text) && /KEIN Geld/.test(fa.text) && fa.dringend, "Fristwarnung C: Erstattung binnen vierzehn Tagen, kein Geld bewegt");
  const st = C.kapitalCStartAufgabe({ angebotRef: "R", name: "Max Mustermann", parameter: PAR, bezahltAm: "2026-10-29", zweck: "FIAON-ABC", frist: { beginn: "2026-10-29", ende: "2026-12-24" }, llc: "MUSTER VENTURES LLC", laufzeitJahre: 10, bestaetigung: { da: true, grund: null } });
  ok(/bis 05\.11\.2026/.test(st.text) && /Gesellschaft eingetragen/.test(st.text) && /zehn Jahre/.test(st.text) && /BÜRGIN: im Register als inaktiv vermerkt/.test(st.text) && !/^ERST/.test(st.titel), "Start-Aufgabe: Anmeldung binnen fünf Werktagen, Knopf „Gesellschaft eingetragen“, Laufzeit, Bürgin-Hinweis");
  const stOhne = C.kapitalCStartAufgabe({ angebotRef: "R", name: "Max Mustermann", parameter: PAR, bezahltAm: "2026-10-29", zweck: null, frist: null, llc: null, laufzeitJahre: null, bestaetigung: { da: false, grund: "BREVO_API_KEY ist nicht gesetzt." } });
  ok(/^ERST Vertragsbestätigung senden — /.test(stOhne.titel) && /VERTRAGSBESTÄTIGUNG FEHLT \(§ 312f BGB\)/.test(stOhne.text) && /Vorher nicht anmelden/.test(stOhne.text) && /„Auftragsmail nachholen“/.test(stOhne.text), "Start-Aufgabe ohne (zugestellte) Vertragsbestätigung: erst „Auftragsmail nachholen“, vorher nicht anmelden");
  // Die Vertragsbestätigung (§ 312f BGB): Anhang-Texte, Widerruf, Sofortbeginn, keine Zusage.
  const bt = flach(sammle(C.KAPITAL_C_BESTAETIGUNG, []).join(" "));
  ok(/Im Anhang finden Sie Ihren Vertrag mit Annahmevermerk, der Widerrufsbelehrung und dem Muster-Widerrufsformular/.test(bt) && /binnen vierzehn Tagen ohne Angabe von Gründen widerrufen/.test(bt) && /vor Ablauf der Widerrufsfrist beginnen \(Fast-Track\)/.test(bt) && /angemessenen Betrag/.test(bt), "Vertragsbestätigung: Vertrag, Belehrung, Formular, Sofortbeginn mit Wertersatz");
  ok(C.KAPITAL_C_BESTAETIGUNG.knopf2 === "Zu „Mein Auftrag“" && C.KAPITAL_C_ANNAHME.fertigFussMit({ name: "Erika Muster", telefon: "+00 0", email: "e@beispiel.example" }) === "Fragen? Erika Muster ist für Sie da: +00 0 · e@beispiel.example."
    && C.KAPITAL_C_ANNAHME.fertigZahlung("3.289 €") === "Fällig mit Ihrem Auftrag: 3.289 € für Gründung, Konto und Karten sowie Fast-Track.", "Nach der Annahme: „Zu „Mein Auftrag““, Ansprechpartner aus dem Angebot, „Fällig mit Ihrem Auftrag“");
  // Runde 2 (Kundensicht): Bürgschaft offen erklärt — verbunden, beim Namen, 36 Monate, Rückgriff aus Ziffer 5 Abs. 5, Registerstand mit Folge.
  const sb = C.kapitalCSeite(D);
  const fBuerg = flach((sb.fragen.liste.find((x) => x.frage === "Was bedeutet die Bürgschaft für mich?")?.antwort ?? []).join(" "));
  ok(/übernimmt unsere US-Partnergesellschaft, die Muster Partner LLC in Miami — ein mit FIAON verbundenes Unternehmen —, längstens für sechsunddreißig Monate/.test(fBuerg)
    && /das vereinbaren Sie ausdrücklich in Ziffer 5 Absatz 5/.test(fBuerg) && !/so ist es bei jeder Bürgschaft/.test(fBuerg)
    && /Offen gesagt: Die Bürgin wird im Register von Florida derzeit als inaktiv geführt \(Stand 19\.10\.2026\)\. Bürgen wird sie erst, wenn sie dort wieder als aktiv geführt wird \(Ziffer 5\)\. Bürgt sie nicht rechtzeitig, greift Ihre Geld-zurück-Garantie/.test(fBuerg)
    && /auch das Erfolgshonorar/.test(fBuerg) && !/Reaktivierung/.test(fBuerg), "Fragen: Bürgschaft offen (verbunden, Name, 36 Monate, Ziffer 5 Abs. 5, Registerstand mit Folge), ohne „so ist es bei jeder Bürgschaft“", fBuerg);
  ok(sb.fragen.liste[1].frage === "Und wenn die Bank andere Bedingungen anbietet?" && /lehnt Ihre Gesellschaft ein solches Angebot ab, entfällt die Geld-zurück-Garantie \(Ziffer 4\)/.test(flach(sb.fragen.liste[1].antwort.join(" "))), "Fragen: „Und wenn die Bank andere Bedingungen anbietet?“ an Platz 2 — passend zu Ziffer 4 Abs. 6");
  ok(/einmal im Quartal/.test(flach(sb.fragen.liste.find((x) => x.frage === "Wer zahlt die Raten?")?.antwort.join(" ") ?? "")) && /Dauerauftrag/.test(sb.rechner.puenktlich), "Raten: Geld per Dauerauftrag an die Gesellschaft, Quartalsmeldung genannt (Ziffer 5 Abs. 5)");
  ok(!/Vertragsfassung|IA-KAPITAL/.test(C.kapitalCVertragUnterzeile(D)) && /Vertragsstand 27\.10\.2026$/.test(C.kapitalCVertragUnterzeile(D)) && C.kapitalCVertragsstand("IA-KAPITAL-2026-10-27-C") === "27.10.2026", "Kundensicht ohne interne Kennung: „Vertragsstand 27.10.2026“");
  ok(sb.hero.kurs.includes("1\u00a0€\u00a0=\u00a01,1188\u00a0US-$") && sb.rechner.kursZeile.includes("1\u00a0€\u00a0=\u00a01,1188\u00a0US-$"), "Kurs als ganze Gleichung mit geschützten Leerzeichen (bricht nie um)");
  ok(/EC1V\u00a02NX/.test(C.kapitalCBestellUebersicht(D, 10).zeilen[0].wert) && /12345\u00a0Musterstadt/.test(C.kapitalCBestellUebersicht(D, 10).zeilen[1].wert) && /\)\u00a0· Rechenbeispiel/.test(C.kapitalCLaufzeitZeile(PAR, 10)), "Übersicht: Postleitzahlen und „· Rechenbeispiel“ mit geschütztem Leerzeichen");
  ok(C.kapitalCBuerginOrt({ anschrift: "1 Example Way, Miami, FL 33100, USA", bundesstaat: "Florida" }) === "Miami" && C.kapitalCBuerginOrt({ anschrift: "Irgendwo", bundesstaat: "Florida" }) === "Florida", "Ort der Bürgin aus der Anschrift, sonst der Bundesstaat");
}

// ═══ 7b IHR TEAM (wie Fassung A/B, Justin 27.10.2026 abends) ════════════════
abschnitt("7b Ihr Team — Einlesen, Fotos nur hinter dem Link, Prüfsumme unverändert");
{
  // Musterteam (Repo öffentlich): Porträt des Hauses, Fotos am Angebot, ohne Foto — und alles, was NICHT durchgehen darf.
  const TEAM_ROH = [
    { name: "  Paula   Probehaus ", rolle: " Leitung   Muster ", foto: "haus:muster" },
    { name: "Dr. Konrad Kontrollmann", rolle: "Recht (Muster)", foto: "team-konrad-kontrollmann.webp" },
    { name: "Mag. Petra Prüfling", rolle: "Steuern (Muster)", foto: "team-petra-pruefling.webp" },
    { name: "Tim Testmann", rolle: "Ohne Foto (Muster)" },
    { name: "Nina Nichtbestaetigt", rolle: "Muster", foto: "team-nina.webp", bestaetigt: false },
    { name: "", rolle: "ohne Namen" },
    { name: "Olaf Ohnerolle", rolle: "   " },
    { name: "Karl Kiporträt", rolle: "Muster", foto: "haus:justin" },
    { name: "Fritz Fremd", rolle: "Muster", foto: "https://example.com/x.webp" },
    { name: "Paul Pfad", rolle: "Muster", foto: "../geheim.webp" },
  ];
  const parT = C.kapitalCParameterAus({ ...PAR, team: TEAM_ROH as any });
  const DT = { ...D, parameter: parT };
  ok(C.KAPITAL_C_VORGABEN.team.length === 0 && PAR.team.length === 0, "Vorgabe: kein Team (ohne Team bleibt die Seite wie bisher)");
  ok(parT.team.length === 7 && parT.team[0].name === "Paula Probehaus" && parT.team[0].rolle === "Leitung Muster" && parT.team[3].foto === null
    && !parT.team.some((t) => /Nichtbestaetigt|Ohnerolle/.test(t.name)), "Einlesen: geglättet, nur bestätigte, ohne leeren Namen oder leere Rolle", parT.team.map((t) => t.name));
  ok(JSON.stringify(K.kapitalParameterAus({ team: TEAM_ROH as any }).team) === JSON.stringify(parT.team), "Einlesen: dieselben Regeln wie Fassung A/B (kapitalTeamAus)");
  const viele = Array.from({ length: 25 }, (_, i) => ({ name: `Muster ${i} ${"x".repeat(120)}`, rolle: `Rolle ${"y".repeat(150)}`, foto: `team-${"z".repeat(60)}.webp` }));
  const pv = C.kapitalCParameterAus({ team: viele as any });
  ok(pv.team.length === 20 && pv.team.every((t) => t.name.length === 80 && t.rolle.length === 100 && String(t.foto).length === 40), "Grenzen: höchstens 20, Name 80, Rolle 100, foto 40 Zeichen");
  ok(JSON.stringify(C.kapitalCParameterAus({ betragCents: 25_000_000 }, parT).team) === JSON.stringify(parT.team) && JSON.stringify(C.kapitalCParameterAus({ team: "kaputt" as any }, parT).team) === JSON.stringify(parT.team)
    && C.kapitalCParameterAus({ team: [] }, parT).team.length === 0, "Nachtrag ohne team behält es, Unsinn auch; eine leere Liste leert es");

  const TOKEN = "FIAON-IA-CMUSTER.1893456000000.ab+c/d";
  const T_ENC = encodeURIComponent(TOKEN);
  const sT = C.kapitalCSeite(DT, TOKEN);
  const tm = sT.ansprechpartner.team;
  ok(tm.length === 7 && tm.map((t) => t.name).join("|") === parT.team.map((t) => t.name).join("|"), "Seite: das ganze Team in der Reihenfolge der Datei");
  ok(tm[0].foto === "/portraits/muster.jpg", "haus:<kürzel> → echtes Porträt des Hauses (/portraits/<kürzel>.jpg)", tm[0].foto);
  ok(tm[1].foto === `/api/fiaon/global/angebot/${T_ENC}/bild/team-konrad-kontrollmann.webp` && tm[2].foto === `/api/fiaon/global/angebot/${T_ENC}/bild/team-petra-pruefling.webp`,
    "Bildname → Adresse hinter dem persönlichen Link (Token kodiert)", [tm[1].foto, tm[2].foto]);
  ok(tm[3].foto === null && tm[4].foto === null && tm[5].foto === null && tm[6].foto === null, "ohne Foto, KI-Porträt, fremde Adresse, Pfad → Initialen (foto null)", tm.slice(3).map((t) => t.foto));
  ok(tm.every((t) => t.foto === null || t.foto.startsWith("/portraits/") || t.foto.startsWith(`/api/fiaon/global/angebot/${T_ENC}/bild/`)), "nie eine Adresse außerhalb des Links oder der Porträts");
  ok(tm[0].initialen === "PP" && tm[1].initialen === "KK" && tm[2].initialen === "PP" && tm[3].initialen === "TT", "Initialen ohne Titel (Dr., Mag.)", tm.map((t) => t.initialen));
  ok(sT.ansprechpartner.teamTitel === K.KAPITAL_TEAM_TEXTE.titel && sT.ansprechpartner.teamSub === K.KAPITAL_TEAM_TEXTE.sub && K.KAPITAL_TEAM_TEXTE.titel === "Ihr Team"
    && sT.ansprechpartner.titel === "Ihr Ansprechpartner", "Texte wie Fassung A/B: „Ihr Team“ / „Diese Menschen arbeiten an Ihrem Auftrag mit.“ unter „Ihr Ansprechpartner“");
  ok(sT.bildnachweis === "Bildnachweis: Teamfotos teils Symbolbilder." && sT.bildnachweis === K.kapitalBildnachweis(parT), "Bildnachweis wie A/B, sobald ein Foto am Angebot liegt");
  const ohneToken = C.kapitalCSeite(DT).ansprechpartner.team;
  ok(ohneToken[0].foto === "/portraits/muster.jpg" && ohneToken[1].foto === null && ohneToken[2].foto === null, "ohne Link (kein Token): Fotos am Angebot → Initialen, Porträt des Hauses bleibt");
  const nurHaus = C.kapitalCSeite({ ...D, parameter: C.kapitalCParameterAus({ ...PAR, team: [{ name: "Paula Probehaus", rolle: "Muster", foto: "haus:muster" }] }) }, TOKEN);
  ok(nurHaus.bildnachweis === "" && nurHaus.ansprechpartner.team.length === 1, "nur Porträts des Hauses → kein Bildnachweis");
  const leer = C.kapitalCSeite(D, TOKEN);
  ok(leer.ansprechpartner.team.length === 0 && leer.bildnachweis === "", "leeres Team → keine Personen, kein Bildnachweis");
  // Die Seite zeigt den Abschnitt nur mit Team und den Bildnachweis nur, wenn er gesetzt ist — mit den Klassen der Fassung A/B.
  const quelle = readFileSync(path.join(WURZEL, "client/src/pages/business-angebot-kapital-c.tsx"), "utf8");
  ok(/\{team\.length > 0 && \(\s*<div className="gaf-team gkp-team[^"]*" data-fiaon="kapital-team">/.test(quelle) && /\{S\.bildnachweis && <p className="gaf-aufruf-hinweis">\{S\.bildnachweis\}<\/p>\}/.test(quelle)
    && ["gaf-team-raster", "gaf-team-person", "gaf-team-bild", "gaf-team-mono", "gaf-team-name", "gaf-team-rolle"].every((c) => quelle.includes(`className="${c}"`)),
    "Seite: „Ihr Team“ nur mit Team (leeres Team = kein Abschnitt), Bildnachweis nur wenn gesetzt, Klassen wie Fassung A/B");

  // DIE PRÜFSUMME: Das Team steht nie im Vertrag — Text, Inhaltsverzeichnis, Annahmevermerk und Prüfsumme sind gleich.
  const hOhne = C.kapitalCHashEingabe(D, C.kapitalCRumpfHtml(D, null)); const hMit = C.kapitalCHashEingabe(DT, C.kapitalCRumpfHtml(DT, null));
  ok(hOhne === hMit, "Prüfsumme: gleicher Vertragstext mit und ohne Team");
  ok(C.kapitalCRumpfHtml(D, null, { ausweiseGekuerzt: true }) === C.kapitalCRumpfHtml(DT, null, { ausweiseGekuerzt: true }) && JSON.stringify(C.kapitalCVertragInhalt(D)) === JSON.stringify(C.kapitalCVertragInhalt(DT)),
    "Seite und Entwurf: gekürzter Vertrag und Inhaltsverzeichnis gleich");
  const vermerkT = { am: new Date("2026-10-28T10:00:00Z"), ip: "203.0.113.7", userAgent: "x", hash: "abc", wahl: { llc: { wunsch: "MUSTER VENTURES LLC", alternative1: "", alternative2: "" }, laufzeitJahre: 10, sofortBeginn: true as const }, unterschrift: { art: "getippt" as const, name: "Max Mustermann" } };
  ok(C.kapitalCRumpfHtml(D, vermerkT as any) === C.kapitalCRumpfHtml(DT, vermerkT as any), "angenommener Vertrag (mit Vermerk) gleich");
  const vertragT = ohneHtml(C.kapitalCRumpfHtml(DT, vermerkT as any));
  ok(!/Probehaus|Kontrollmann|Prüfling|Testmann|Symbolbild|team-/.test(vertragT), "kein Teamname, kein Foto, kein Bildnachweis im Vertrag");
  // Über den echten Weg des Servers (ohne Datenbank): Prüfsumme, Fingerabdruck für den Browser, Vertrags-HTML — und das Team.
  const KS = await import("../server/lib/fiaon-global-angebot-kapital-c");
  ok(KS.kapitalCTextHash(D) === KS.kapitalCTextHash(DT) && KS.kapitalCSichtHash(D) === KS.kapitalCSichtHash(DT), "Server: kapitalCTextHash und kapitalCSichtHash mit und ohne Team gleich");
  const zeile = (parameter: unknown) => ({ id: 1, angebot_ref: D.ref, fassung: C.KAPITAL_C_FASSUNG, status: "offen", kunde: KUNDE_ROH, parameter, buergin: BUERGIN, gueltig_bis: D.gueltigBis }) as any;
  const sichtOhne = (await KS.kapitalCKundenSicht(TOKEN, zeile({ ...PAR, unterschriftFrei: true }))).body as any;
  const sichtMit = (await KS.kapitalCKundenSicht(TOKEN, zeile({ ...PAR, unterschriftFrei: true, team: TEAM_ROH }))).body as any;
  ok(sichtOhne.textHash === sichtMit.textHash && sichtOhne.html === sichtMit.html && sichtOhne.vertragPdf === sichtMit.vertragPdf && sichtOhne.annahmeBereit === true && sichtMit.annahmeBereit === true,
    "Kundensicht: textHash, Vertrags-HTML und PDF-Adresse mit und ohne Team gleich — offene Seiten müssen nicht neu laden");
  ok(sichtOhne.seite.ansprechpartner.team.length === 0 && sichtMit.seite.ansprechpartner.team.length === 7 && sichtMit.seite.ansprechpartner.team[1].foto === `/api/fiaon/global/angebot/${T_ENC}/bild/team-konrad-kontrollmann.webp`
    && sichtMit.seite.bildnachweis === "Bildnachweis: Teamfotos teils Symbolbilder." && sichtOhne.seite.bildnachweis === "", "Kundensicht: Team mit Fotos hinter dem Link (token-gebunden) und Bildnachweis; ohne Team nichts davon");
}

// ═══ 7c ZAHLUNGSZIEL „SOFORT“ (E-432, 28.10.2026) ═══════════════════════════
// Justin: „Die Rechnung ist eigentlich umgehend, also sofort fällig.“ Neue Angebote: Vorgabe 0 Tage = „zahlbar sofort“ (vorher ergab
// 0 „binnen null Tagen“). Ein Angebot mit gespeicherten sieben Tagen behält jeden Satz wortgleich — Prüfsumme unverändert.
abschnitt("7c Zahlungsziel sofort (0, 1 und 7 Tage)");
{
  const mit = (tage: number) => ({ ...D, parameter: { ...PAR, zahlungszielTage: tage } });
  const texte = (tage: number) => {
    const d = mit(tage);
    const s = C.kapitalCSeite(d);
    return {
      vertrag: flach(absText(C.kapitalCZiffern(d)).join("\n")),
      info: flach(s.informationen.zeilen.find((z) => z.titel === "Zahlung")?.text ?? ""),
      uebersicht: flach(C.kapitalCBestellUebersicht(d, 10).zeilen.map((z) => `${z.label}: ${z.wert}`).join(" | ")),
      knopf: flach(C.kapitalCAnnahmeTexte(d).unterKnopf),
    };
  };
  const t0 = texte(0); const t1 = texte(1); const t7 = texte(7);
  ok(C.KAPITAL_C_VORGABEN.zahlungszielTage === 0, "Vorgabe für neue Angebote: 0 Tage (sofort)");
  ok(/Der Betrag ist mit Vertragsschluss fällig; FIAON stellt die Rechnung bei Annahme dieses Vertrags, zahlbar sofort ohne Abzug per Überweisung\./.test(t0.vertrag) && /FIAON berechnet es mit Rechnung, zahlbar sofort\./.test(t0.vertrag), "0 Tage: Ziffer 6 Abs. 1 und 2 „zahlbar sofort“", t0.vertrag.match(/Der Betrag ist[^.]*\./)?.[0]);
  ok(t0.info === `Per Überweisung auf Rechnung, zahlbar sofort. Die Rechnung über 3.289 € kommt mit der Annahme.` && /Rechnung mit der Annahme, zahlbar sofort/.test(t0.uebersicht) && /Fällig mit Ihrem Auftrag: 3\.289 € — sofort per Überweisung\./.test(t0.knopf), "0 Tage: Informationen, Übersicht (§ 312j) und Satz unter dem Knopf gleichlautend", { info: t0.info, knopf: t0.knopf });
  ok(![t0, t1, t7].some((t) => /null Tagen|eins Tagen|binnen 0|binnen 1 /.test(Object.values(t).join(" "))), "nie „binnen null Tagen“ oder „binnen eins Tagen“");
  ok(/zahlbar binnen eines Tages ohne Abzug per Überweisung/.test(t1.vertrag) && /per Überweisung binnen eines Tages\./.test(t1.knopf), "1 Tag: „binnen eines Tages“");
  ok(/zahlbar binnen sieben Tagen ohne Abzug per Überweisung\./.test(t7.vertrag) && /FIAON berechnet es mit Rechnung, zahlbar binnen sieben Tagen\./.test(t7.vertrag) && t7.info === "Per Überweisung auf Rechnung, zahlbar binnen sieben Tagen. Die Rechnung über 3.289 € kommt mit der Annahme."
    && /Fällig mit Ihrem Auftrag: 3\.289 € — per Überweisung binnen sieben Tagen\./.test(t7.knopf), "7 Tage: Wortlaut wie bisher (Ziffer 6, Informationen, Knopf)");
  ok(C.kapitalCHashEingabe(mit(7), C.kapitalCRumpfHtml(mit(7), null)) !== C.kapitalCHashEingabe(mit(0), C.kapitalCRumpfHtml(mit(0), null)), "0 und 7 Tage ergeben verschiedene Prüfsummen (ein offenes Angebot lädt nach einer Änderung neu)");
  const w = W.globalWortPruefen([t0.vertrag.match(/Der Betrag ist[^.]*\./)?.[0] ?? "", t0.info, t0.knopf].join(" "), ["aufgabe_an_betreuer"]);
  ok(w.length === 0, "0 Tage: Wortwand ohne Treffer", w);
}

// ═══ 10 E-474: ANGABEN VOM KUNDEN, FAST-TRACK NACH WAHL — OHNE DATENBANK ═══════════
abschnitt("10 E-474 — Angaben vom Kunden, Fast-Track nach Wahl, Bestand byte-gleich");
const KS10 = await import("../server/lib/fiaon-global-angebot-kapital-c");
const KONTAKT = { art: "privat", anrede: "Frau", vorname: "Erika", nachname: "Musterfrau", email: "erika.musterfrau@beispiel.example" };
const GUT = { vorname: "Erika", nachname: "Musterfrau", geburtsdatum: "1985-03-04", geburtsort: "", staatsangehoerigkeit: "deutsch", strasse: "Musterweg 7", plz: "12345", ort: "Musterstadt", land: "DE" };
const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15";
const KONTEXT = { ip: "198.51.100.7", userAgent: UA, leitung: false };
const PDK = C.kapitalCParameterAus({ ...C.KAPITAL_C_VORGABEN, datenVomKunden: true, fastTrackWahl: true, unterschriftFrei: true, buerginAktiv: true, buerginStandAm: "2026-11-01", unterlagen: [] });
const annahmeBasis = (nachname = "Musterfrau") => ({ laufzeitJahre: 10, llc: { wunsch: "MUSTER VENTURES", alternative1: "", alternative2: "" }, gelesen: true, unterschrift: { art: "getippt", name: `Erika ${nachname}` } });
{
  // 10a — Bestand byte-gleich: dieselbe Rechnung wie vor E-474 (Grundlinie aus origin/main e26329ff, 02.11.2026). Ändert sich hier
  // etwas, ändert sich der Text OFFENER und ANGENOMMENER Angebote — dann bewusst entscheiden, nie still die Zahl tauschen.
  const GRUNDLINIE = "53e6f0498d92939a10b6d7f796b888bd10ace58c41838ecac4cb7c4935c5e85f";
  const { createHash } = await import("node:crypto");
  const ROH = [
    { buerginAktiv: false, buerginStandAm: "2026-10-19", unterlagen: [{ titel: "Reisepass", am: "2026-10-27" }, { titel: "Kontoauszug Oktober 2026", am: "2026-10-27" }] },
    { zahlungszielTage: 7, ddAbgeschlossen: false, unterlagen: [], buerginAktiv: true, buerginStandAm: "2026-10-30" },
    { staatenFassung: "E-465", bundesstaat: "Delaware", unterlagen: [{ titel: "Reisepass", am: "2026-10-27" }] },
  ];
  const aus: unknown[] = [];
  for (const r of ROH) {
    const par = C.kapitalCParameterAus({ ...C.KAPITAL_C_VORGABEN, ...r } as any);
    const d = { ...D, parameter: par };
    const vermerk = { am: new Date("2026-10-28T10:00:00Z"), ip: "203.0.113.7", userAgent: "x", hash: "abc", wahl: { llc: { wunsch: "MUSTER VENTURES LLC", alternative1: "B LLC", alternative2: "" }, laufzeitJahre: 10, sofortBeginn: true }, unterschrift: { art: "getippt" as const, name: "Max Mustermann" } };
    const seite: any = C.kapitalCSeite(d); delete seite.fastTrack;
    aus.push(C.kapitalCRumpfHtml(d, null), C.kapitalCRumpfHtml(d, null, { ausweiseGekuerzt: true }), C.kapitalCRumpfHtml(d, vermerk), seite,
      C.kapitalCBestellUebersicht(d, 10), C.kapitalCBestellUebersicht(d, null), C.kapitalCAnnahmeTexte(d), C.kapitalCGarantie(par),
      C.KAPITAL_C_BESTAETIGUNG.absaetze({ anrede: "Sehr geehrter Herr Mustermann", angenommen: "28.10.2026 um 10:00 Uhr", llc: "MUSTER LLC" }),
      C.kapitalCStartAufgabe({ angebotRef: "R", name: "Max Mustermann", parameter: par, bezahltAm: "2026-10-29", zweck: "FIAON-X", frist: { beginn: "2026-10-29", ende: "2026-12-24" }, llc: "MUSTER LLC", laufzeitJahre: 10, bestaetigung: { da: false, grund: "x" } }),
      C.kapitalCMeinAuftrag({ parameter: par, angenommenAm: "2026-10-28", teile: [], garantieErfuelltAm: null, erstattungAusgeloest: false, laufzeitJahre: 10 }),
      C.kapitalCPflichtFehlen(d), C.kapitalCKundeZeile(D.kunde), C.kapitalCKundeZeile(D.kunde, { ausweiseGekuerzt: true }),
      C.KAPITAL_C_ANNAHME.fertigZahlung("3.289 €"));
  }
  const ist = createHash("sha256").update(JSON.stringify(aus)).digest("hex");
  ok(ist === GRUNDLINIE, "Bestand byte-gleich: Vertrag (voll, gekürzt, mit Vermerk), Seite, Übersicht, Annahme, Garantie, Bestätigung, Aufgabe, „Mein Auftrag“ wie vor E-474", ist);
  ok(C.kapitalCSeite(D).fastTrack === null && KS10.kapitalCTextHash(D) === KS10.kapitalCTextHash({ ...D, parameter: C.kapitalCParameterAus({ ...PAR }) }), "Bestand: keine Fast-Track-Karten, Prüfsumme unverändert");
  const bestandZeile = { id: 1, angebot_ref: D.ref, fassung: C.KAPITAL_C_FASSUNG, status: "offen", kunde: KUNDE_ROH, parameter: { ...PAR, unterschriftFrei: true }, buergin: BUERGIN, gueltig_bis: D.gueltigBis } as any;
  const sb = (await KS10.kapitalCKundenSicht("T", bestandZeile)).body as any;
  ok(sb.angaben === null && sb.uebersichtJe === null && sb.annahmeBereit === true, "Bestand: Kundensicht ohne Angaben-Schritt und ohne Wahl");

  // 10b — Parameter
  const pv = C.kapitalCParameterAus({});
  const pj = C.kapitalCParameterAus({ datenVomKunden: "ja" as any, fastTrackWahl: 1 as any });
  ok(pv.datenVomKunden === false && pv.fastTrackWahl === false && !pj.datenVomKunden && !pj.fastTrackWahl && PDK.datenVomKunden && PDK.fastTrackWahl, "Parameter: Vorgabe aus, nur echte Wahrheitswerte schalten");

  // 10c — Anlage: ohne Ausweis nur mit Parameter
  ok(!C.kapitalCKundePruefen(KONTAKT).ok, "ohne datenVomKunden: Kontakt allein reicht nicht (wie bisher)");
  ok(C.kapitalCKundePruefen(KONTAKT, { nurKontakt: true }).ok && !C.kapitalCKundePruefen({ ...KONTAKT, email: "kaputt" }, { nurKontakt: true }).ok, "mit datenVomKunden: Anrede, Name, E-Mail genügen — die E-Mail muss stimmen");
  ok(!C.kapitalCKundePruefen({ ...KUNDE_ROH, ausweise: [] }).ok && C.kapitalCKundePruefen({ ...KUNDE_ROH, ausweise: [] }, { ohneAusweis: true }).ok, "Ausweis: Pflicht im Bestand, nicht mit datenVomKunden");

  // 10d — Unterschrift gesperrt, bis die Angaben da sind
  const kk = C.kapitalCKundePruefen(KONTAKT, { nurKontakt: true }); if (!kk.ok) throw new Error(kk.error);
  const DDK = { ref: "FIAON-IA-CMUSTR2", fassung: C.KAPITAL_C_FASSUNG, kunde: kk.kunde, buergin: BUERGIN, parameter: PDK, gueltigBis: "2026-11-16" };
  const fehlt0 = C.kapitalCPflichtFehlen(DDK);
  ok(fehlt0.length === 1 && fehlt0[0].startsWith("Auftraggeber:") && C.kapitalCAngabenFehlen(DDK), "ohne Angaben: Pflicht fehlt (nur die Angaben)", fehlt0);
  const zeileDK = (kunde: unknown, par: unknown = PDK) => ({ id: 2, angebot_ref: DDK.ref, fassung: C.KAPITAL_C_FASSUNG, status: "offen", kunde, parameter: par, buergin: BUERGIN, gueltig_bis: DDK.gueltigBis }) as any;
  const s0 = (await KS10.kapitalCKundenSicht("T2", zeileDK(kk.kunde))).body as any;
  ok(s0.annahmeBereit === false && s0.gesperrtGrund === C.KAPITAL_C_ANNAHME.angabenFehlen && s0.angaben?.fehlen === true && s0.angaben.werte.vorname === "Erika" && s0.angaben.speichern === "/api/fiaon/global/angebot/T2/kapital-angaben",
    "Kundensicht ohne Angaben: gesperrt mit klarem Satz, Schritt „Ihre Angaben“, Name vorbelegt");
  ok(!("ausweise" in s0.angaben.werte) && !/Nr\. /.test(JSON.stringify(s0.angaben)), "Kundensicht: kein Ausweisfeld, keine Nummer");
  ok(/Erika Musterfrau \(Geburtsdatum und Anschrift trägt der Auftraggeber vor der Annahme auf seiner Angebotsseite ein\)/.test(ohneHtml(s0.html)) && !/wohnhaft ,/.test(ohneHtml(s0.html)), "Vertragsvorschau ohne Angaben: ein Satz statt Lücken");
  ok(/Erika Musterfrau — Geburtsdatum und Anschrift bitte oben eintragen/.test(JSON.stringify(s0.uebersicht)), "Übersicht ohne Angaben: Hinweis statt leerer Anschrift");

  // 10e — Angaben prüfen (kapitalCAngabenPruefen)
  const HEUTE = "2026-11-02";
  const g = C.kapitalCAngabenPruefen(kk.kunde, GUT, HEUTE);
  ok(g.ok && g.kunde.email === KONTAKT.email && g.kunde.ausweise.length === 0 && g.kunde.geburtsdatum === "1985-03-04", "gültige Angaben: übernommen, E-Mail bleibt die des Angebots, kein Ausweis", g);
  const FAELLE: [Record<string, unknown>, string, string][] = [
    [{ ...GUT, geburtsdatum: "2010-01-01" }, "geburtsdatum", "minderjährig"], [{ ...GUT, geburtsdatum: "2027-01-01" }, "geburtsdatum", "Zukunft"],
    [{ ...GUT, geburtsdatum: "1985-02-30" }, "geburtsdatum", "Tag gibt es nicht"], [{ ...GUT, geburtsdatum: "" }, "geburtsdatum", "fehlt"],
    [{ ...GUT, geburtsdatum: "1850-01-01" }, "geburtsdatum", "vor 1900"], [{ ...GUT, plz: "1234" }, "plz", "PLZ DE vierstellig"],
    [{ ...GUT, land: "AT", plz: "12345" }, "plz", "PLZ AT fünfstellig"], [{ ...GUT, strasse: "Musterweg" }, "strasse", "ohne Hausnummer"],
    [{ ...GUT, strasse: "" }, "strasse", "Straße fehlt"], [{ ...GUT, vorname: "" }, "vorname", "Vorname fehlt"], [{ ...GUT, nachname: " " }, "nachname", "Nachname fehlt"],
    [{ ...GUT, land: "FR" }, "land", "Land außerhalb DACH"], [{ ...GUT, staatsangehoerigkeit: "<b>x</b>" }, "staatsangehoerigkeit", "Staatsangehörigkeit Unsinn"],
    [{ ...GUT, ort: "" }, "ort", "Ort fehlt"],
  ];
  for (const [roh, feld, text] of FAELLE) { const r = C.kapitalCAngabenPruefen(kk.kunde, roh, HEUTE); ok(!r.ok && r.feld === feld, `ungültig abgewiesen: ${text} → Feld ${feld}`, r); }
  ok(C.kapitalCAngabenPruefen(kk.kunde, { ...GUT, geburtsdatum: "2008-11-02" }, HEUTE).ok && !C.kapitalCAngabenPruefen(kk.kunde, { ...GUT, geburtsdatum: "2008-11-03" }, HEUTE).ok, "18 Jahre genau heute: ja — morgen erst: nein");
  ok(C.kapitalCAngabenPruefen(kk.kunde, { ...GUT, email: "fremd@beispiel.example", ausweise: [{ art: "reisepass", nummer: "X1234567", gueltigBis: "2030-01-01", behoerde: "y" }] }, HEUTE).ok
    && (C.kapitalCAngabenPruefen(kk.kunde, { ...GUT, email: "fremd@beispiel.example" }, HEUTE) as any).kunde.email === KONTAKT.email
    && (C.kapitalCAngabenPruefen(kk.kunde, { ...GUT, ausweise: [{ art: "reisepass", nummer: "X1234567" }] }, HEUTE) as any).kunde.ausweise.length === 0, "E-Mail und Ausweis lassen sich über die Angaben nicht unterschieben");
  if (!g.ok) throw new Error("Angaben ungültig");
  const DDK2 = { ...DDK, kunde: g.kunde };
  ok(C.kapitalCPflichtFehlen(DDK2).length === 0 && !C.kapitalCAngabenFehlen(DDK2), "mit Angaben: Unterschrift frei — ohne Ausweis");
  const s1 = (await KS10.kapitalCKundenSicht("T2", zeileDK(g.kunde))).body as any;
  ok(s1.annahmeBereit === true && s1.gesperrtGrund === null && s1.angaben.fehlen === false && s1.textHash !== s0.textHash && s1.angaben.werte.strasse === "Musterweg 7", "Kundensicht mit Angaben: frei, neuer Fingerabdruck, Angaben vorbelegt");

  // 10f — der Vertrag mit datenVomKunden
  const v = flach(absText(C.kapitalCZiffern(DDK2)).join("\n"));
  ok(!/ausgewiesen durch/.test(v) && /Seinen gültigen Reisepass lädt der Auftraggeber binnen sieben Tagen nach Vertragsschluss zur Identifizierung hoch — auf seiner Angebotsseite oder in seinem Kundenbereich „Mein Auftrag“\. Mit Anmeldungen und Anträgen beginnt FIAON erst, wenn er vorliegt\./.test(v),
    "Vertrag: kein „ausgewiesen durch“, Ziffer 7 mit dem Reisepass nach Vertragsschluss");
  ok(/Die Frist ruht außerdem, bis der Reisepass nach Ziffer 7 Absatz 1 vorliegt\./.test(v) && !/ihretwegen ruht die Frist nicht/.test(v) && /und des Reisepasses nach Ziffer 7 Absatz 1/.test(v), "Ziffer 2 und 4: Anmeldung und Frist erst mit dem Reisepass");
  ok(/Erika Musterfrau, geboren am 04\.03\.1985, deutsche Staatsangehörige, wohnhaft Musterweg 7, 12345 Musterstadt, Deutschland \(nachfolgend „Auftraggeber“\)/.test(v), "Ziffer 1: die eingetragenen Angaben stehen im Vertrag", v.slice(v.indexOf("und Frau"), v.indexOf("und Frau") + 220));
  ok(C.kapitalCGarantie(PDK).info.includes("solange die Vergütung mit Ihrem Auftrag nicht bezahlt ist, bis Ihr Reisepass nach Vertragsschluss vorliegt"), "Informationen: Ruhen nach Wahl und bis zum Reisepass");

  // 10g — Fast-Track nach Wahl: beide Wahlen
  ok(/zahlt der Auftraggeber einmalig 2\.790 €; wählt er bei der Annahme den Fast-Track \(Ziffer 2 Absatz 3\), zahlt er dafür zusätzlich einmalig 499 €, zusammen 3\.289 €/.test(v) && /insgesamt 9\.680 € ohne Fast-Track oder 10\.179 € mit Fast-Track/.test(v), "Ziffer 6: Preise beider Wahlen (Endpreise, erstes Jahr)");
  ok(/In beiden Fällen beginnt FIAON mit/.test(v) && /ohne Fast-Track liegen Gesellschaft, EIN und ITIN in der Regel nach drei bis fünf Wochen vor/.test(v) && /Ziel sind dann die Gesellschaft und ihre EIN binnen 72 Stunden, die ITIN folgt so schnell wie möglich/.test(v) && /Wählt der Auftraggeber den Fast-Track, ist Ziel der Parteien die Auszahlung binnen vier Wochen/.test(v) && /nicht binnen acht Wochen ab Auftragserteilung ausgezahlt/.test(v), "Ziffer 2/4/10 (E-475): beide beginnen sofort, Tempo nach Wahl — Garantie bleibt acht Wochen");
  const am = new Date("2026-11-03T09:00:00Z");
  const verm = (ft: boolean) => ({ am, ip: "198.51.100.7", userAgent: UA, hash: "abc", wahl: { llc: { wunsch: "MUSTER VENTURES LLC", alternative1: "", alternative2: "" }, laufzeitJahre: 10, sofortBeginn: true, fastTrack: ft }, unterschrift: { art: "getippt" as const, name: "Erika Musterfrau" } });
  const vm = ohneHtml(C.kapitalCRumpfHtml(DDK2, verm(true))); const vo = ohneHtml(C.kapitalCRumpfHtml(DDK2, verm(false)));
  ok(/Fast-Track \(Ziffer 2 Absatz 3\): gewählt — fällig mit dem Auftrag 3\.289 €/.test(vm) && vm.includes(C.KAPITAL_C_SOFORT_TEXT_WAHL), "Vermerk mit Fast-Track: 3.289 € und Sofortbeginn wörtlich");
  ok(/Fast-Track \(Ziffer 2 Absatz 3\): nicht gewählt — fällig mit dem Auftrag 2\.790 €/.test(vo) && vo.includes(C.KAPITAL_C_SOFORT_TEXT_WAHL) && !/beginnt nach Ablauf der Widerrufsfrist/.test(vo), "Vermerk ohne Fast-Track (E-475): 2.790 €, Sofortbeginn wörtlich");
  ok(KS10.kapitalCTextHash(DDK2) === KS10.kapitalCTextHash(DDK2) && C.kapitalCHashEingabe(DDK2, C.kapitalCRumpfHtml(DDK2, null)) === C.kapitalCHashEingabe(DDK2, C.kapitalCRumpfHtml({ ...DDK2 }, null)), "Prüfsumme ohne die Wahl (die Wahl steht nur im Vermerk)");
  ok(C.kapitalCHeuteCents(PDK, false) === 279_000 && C.kapitalCHeuteCents(PDK, true) === 328_900 && C.kapitalCHeuteCents(PDK) === 328_900, "Beträge: ohne 2.790 €, mit 3.289 €");
  ok(!C.kapitalCMitFastTrack(PDK, { fastTrack: false }) && C.kapitalCMitFastTrack(PDK, { fastTrack: true }) && C.kapitalCMitFastTrack(PDK, null) && C.kapitalCMitFastTrack(PAR, { fastTrack: false }), "Wahl zählt nur bei fastTrackWahl; ohne Wahl nie ein zu kleiner Betrag");
  const ueb = (ft: boolean | null) => flach(C.kapitalCBestellUebersicht(DDK2, 10, ft).zeilen.map((z) => `${z.label}: ${z.wert}`).join(" | "));
  ok(/Fällig mit Ihrem Auftrag: 2\.790 € \(Gründung, Konto und Karten, ohne Fast-Track\)/.test(ueb(false)) && /Im ersten Jahr insgesamt: 9\.680 €/.test(ueb(false)) && /Beginn: sofort mit Ihrem Zahlungseingang/.test(ueb(false)) && /Gesellschaft, EIN und ITIN in drei bis fünf Wochen/.test(ueb(false)), "Übersicht ohne Fast-Track (E-475: sofort, drei bis fünf Wochen)");
  ok(/Fällig mit Ihrem Auftrag: 3\.289 € \(Gründung, Konto und Karten 2\.790 € \+ Fast-Track 499 €\)/.test(ueb(true)) && /Im ersten Jahr insgesamt: 10\.179 €/.test(ueb(true)) && /Beginn: sofort mit Ihrem Zahlungseingang/.test(ueb(true)), "Übersicht mit Fast-Track");
  ok(/2\.790 € ohne Fast-Track oder 3\.289 € mit Fast-Track — bitte oben wählen/.test(ueb(null)) && /Geld-zurück-Garantie \(Ziffer 4\): Kommt die Auszahlung nicht binnen acht Wochen/.test(ueb(null)), "Übersicht vor der Wahl: beide Beträge, Garantie gleich");
  ok(/Fällig mit Ihrem Auftrag: 2\.790 €/.test(s1.uebersichtJe.ohne.zeilen.map((z: any) => `${z.label}: ${flach(z.wert)}`).join(" | ")) && /Fällig mit Ihrem Auftrag: 3\.289 €/.test(s1.uebersichtJe.mit.zeilen.map((z: any) => `${z.label}: ${flach(z.wert)}`).join(" | ")), "Kundensicht: Übersicht je Wahl");
  const sFT = C.kapitalCSeite(DDK2).fastTrack!;
  ok(sFT && flach(sFT.karten[0].betrag) === "2.790 €" && flach(sFT.karten[1].betrag) === "3.289 €" && /Garantie gilt in beiden Fällen: acht Wochen/.test(sFT.garantie) && /Wir beginnen sofort mit Ihrem Zahlungseingang\. Ihre Gesellschaft, EIN und ITIN stehen in drei bis fünf Wochen\./.test(flach(sFT.karten[0].zeile)) && /Wir beginnen sofort, mit Vorrang: Ihre Gesellschaft und EIN in 72 Stunden\./.test(flach(sFT.karten[1].zeile)) && sFT.heuteCents.ohne === 279_000, "Seite: zwei Karten mit Endpreisen und Tempo (E-475), Garantie in beiden gleich");
  const at = C.kapitalCAnnahmeTexte(DDK2);
  ok(/Fällig mit Ihrem Auftrag: 2\.790 €/.test(flach(at.unterKnopfOhne ?? "")) && /Fällig mit Ihrem Auftrag: 3\.289 €/.test(flach(at.unterKnopf)) && at.fehltFastTrack === C.KAPITAL_C_ANNAHME.fehltFastTrack, "Satz unter dem Knopf je Wahl");
  const bo = C.KAPITAL_C_BESTAETIGUNG.absaetze({ anrede: "Sehr geehrte Frau Musterfrau", angenommen: "03.11.2026 um 10:00 Uhr", llc: "MUSTER VENTURES LLC", fastTrack: false, reisepass: true }).join(" ");
  const bm = C.KAPITAL_C_BESTAETIGUNG.absaetze({ anrede: "Sehr geehrte Frau Musterfrau", angenommen: "03.11.2026 um 10:00 Uhr", llc: "MUSTER VENTURES LLC", fastTrack: true }).join(" ");
  ok(/Sie haben verlangt, dass wir schon vor Ablauf der Widerrufsfrist beginnen/.test(bo) && /Ihre Gesellschaft, EIN und ITIN stehen in drei bis fünf Wochen\./.test(bo) && !/nach Ablauf der Widerrufsfrist beginnen\./.test(bo) && /Bitte laden Sie noch Ihren Reisepass hoch/.test(bo), "Vertragsbestätigung ohne Fast-Track (mit Reisepass-Bitte)");
  ok(/und den Fast-Track\./.test(bm) && /Sie haben verlangt, dass wir schon vor Ablauf der Widerrufsfrist beginnen/.test(bm) && !/Reisepass/.test(bm), "Vertragsbestätigung mit Fast-Track wie bisher");
  ok(C.KAPITAL_C_ANNAHME.fertigZahlung("2.790 €", false) === "Fällig mit Ihrem Auftrag: 2.790 € für Gründung, Konto und Karten.", "Fertig-Ansicht ohne Fast-Track");
  const so = C.kapitalCStartAufgabe({ angebotRef: "R", name: "Erika Musterfrau", parameter: PDK, bezahltAm: "2026-11-04", zweck: "FIAON-X", frist: { beginn: "2026-11-04", ende: "2026-12-30" }, llc: "MUSTER VENTURES LLC", laufzeitJahre: 10, bestaetigung: { da: true, grund: null }, fastTrack: false, reisepassDa: false });
  ok(/OHNE Fast-Track \(kein Vorrang\), Sofortbeginn ausdrücklich verlangt: Gesellschaft, EIN und ITIN in drei bis fünf Wochen/.test(so.text) && /REISEPASS FEHLT NOCH/.test(so.text) && /2\.790 €/.test(so.text) && !/Ziel mit Fast-Track/.test(so.text), "Aufgabe nach Zahlung ohne Fast-Track (E-475): Sofortbeginn, Tempo, Reisepass, Betrag", so.text);
  const mo = C.kapitalCMeinAuftrag({ parameter: PDK, angenommenAm: "2026-11-03", teile: [], garantieErfuelltAm: null, erstattungAusgeloest: false, laufzeitJahre: 10, fastTrack: false });
  const mm = C.kapitalCMeinAuftrag({ parameter: PDK, angenommenAm: "2026-11-03", teile: [], garantieErfuelltAm: null, erstattungAusgeloest: false, laufzeitJahre: 10, fastTrack: true });
  ok(mo.teile[0].titel === "Gründung" && mo.teile[0].betragCents === 279_000 && mm.teile[0].titel === "Gründung und Fast-Track" && mm.teile[0].betragCents === 328_900, "„Mein Auftrag“: Teil 1 je Wahl");
  const rt = (titel?: string) => K.kapitalRechnungsTextNachFassung({ angebotRef: "FIAON-IA-CMUSTR2", nr: 1, auftragRef: "FIAON-X", fassung: C.KAPITAL_C_FASSUNG, teilTitel: titel }).beschreibung;
  ok(!/Fast-Track/.test(rt(C.KAPITAL_C_TEIL1_TITEL_OHNE)) && /sowie Fast-Track/.test(rt(C.KAPITAL_C_TEIL1_TITEL)) && /sowie Fast-Track/.test(rt()), "Rechnungstext Teil 1 je Wahl (ohne Titel wie bisher)");
  ok(C.kapitalCTeil1Titel(false) === "Gründung, Konto und Karten" && C.kapitalCTeil1Titel(true) === C.KAPITAL_C_TEIL1_TITEL, "Titel von Teil 1 je Wahl");

  // 10h — die Annahme des Servers prüft Wahl, Haken und Angaben (ohne Datenbank: falscher Fingerabdruck beendet den Weg vor dem PDF)
  const helfer = { zuViel: () => false };
  const a0 = await KS10.kapitalCAnnehmen(zeileDK(kk.kunde), { ...annahmeBasis(), fastTrack: true, sofortBeginn: true, textHash: s0.textHash }, KONTEXT, helfer);
  ok(a0.status === 409 && a0.body.code === "PFLICHTFELDER", "Annahme ohne Angaben: 409 (Unterschrift gesperrt)", a0);
  const a1 = await KS10.kapitalCAnnehmen(zeileDK(g.kunde), { ...annahmeBasis(), sofortBeginn: true, textHash: "falsch" }, KONTEXT, helfer);
  ok(a1.status === 400 && a1.body.code === "FASTTRACK", "Annahme ohne Wahl: 400 FASTTRACK (nichts vorgewählt)", a1);
  const a2 = await KS10.kapitalCAnnehmen(zeileDK(g.kunde), { ...annahmeBasis(), fastTrack: true, textHash: "falsch" }, KONTEXT, helfer);
  ok(a2.status === 400 && a2.body.code === "HAEKCHEN" && a2.body.error === C.KAPITAL_C_ANNAHME.fehltSofortWahl, "mit Fast-Track ohne Haken „sofort“: 400", a2);
  const a3 = await KS10.kapitalCAnnehmen(zeileDK(g.kunde), { ...annahmeBasis(), fastTrack: false, textHash: "falsch" }, KONTEXT, helfer);
  ok(a3.status === 400 && a3.body.code === "HAEKCHEN" && a3.body.error === C.KAPITAL_C_ANNAHME.fehltSofortWahl, "ohne Fast-Track ist der Haken „sofort“ ebenfalls Pflicht (E-475): 400", a3);
  const ab = await KS10.kapitalCAnnehmen(bestandZeile, { ...annahmeBasis("Mustermann"), unterschrift: { art: "getippt", name: "Max Mustermann" }, fastTrack: false, textHash: "falsch" }, KONTEXT, helfer);
  ok(ab.status === 400 && ab.body.code === "HAEKCHEN", "Bestand: Haken „sofort“ bleibt Pflicht, ein „fastTrack: false“ ändert nichts", ab);

  // 10i — falscher Link an den neuen Routen
  const falsch = "FIAON-IA-CMUSTR2.1893456000000.0123456789abcdef0123456789abcdef";
  ok((await KS10.kapitalCAngabenSpeichern(falsch, GUT, KONTEXT)).status === 403 && (await KS10.kapitalCAngabenSpeichern("Unsinn", GUT, KONTEXT)).status === 403, "Angaben mit falschem Token: 403");
  const pz = await KS10.kapitalCReisepassZutritt(falsch, KONTEXT);
  ok(!pz.ok && pz.antwort.status === 403, "Reisepass mit falschem Token: 403");

  // 10j — Wortwand, kein Bankname und kein Bank-Satz (E-468) in allen Texten der neuen Wege
  const texte10: { wo: string; text: string }[] = [];
  const push10 = (wo: string, wert: unknown) => sammle(wert, []).forEach((t) => texte10.push({ wo, text: flach(t) }));
  push10("vertrag", absText(C.kapitalCZiffern(DDK2))); push10("vertrag-leer", absText(C.kapitalCZiffern(DDK))); push10("seite", C.kapitalCSeite(DDK2)); push10("annahme", at);
  push10("uebersicht", [ueb(true), ueb(false), ueb(null)]); const nurVermerk = (t: string) => t.slice(t.lastIndexOf("Annahmevermerk"), t.indexOf("IP-Adresse", t.lastIndexOf("Annahmevermerk")));
  push10("vermerk", [nurVermerk(vm), nurVermerk(vo)]);
  // Die Aufgabe an Justin ist intern (wie in Abschnitt 6 nicht an der Wand); sie läuft unten durch die Prüfung auf den Bank-Satz.
  push10("bestaetigung", [bo, bm]); push10("mein-auftrag", [mo, mm]); push10("angaben", C.KAPITAL_C_ANGABEN); push10("reisepass", C.KAPITAL_C_REISEPASS);
  push10("annahme-fest", [C.KAPITAL_C_ANNAHME.fehltFastTrack, C.KAPITAL_C_ANNAHME.fehltSofortWahl, C.KAPITAL_C_ANNAHME.angabenFehlen]);
  const saetze10 = (t: string) => t.split(/(?<=[.!?])\s+(?=[A-ZÄÖÜ„])/);
  const gebunden = (satz: string) => /Geld-zurück-Garantie|Garantiefrist|Garantiefall/.test(satz) && !/\bgarantier/i.test(satz);
  let wand = 0;
  for (const { wo, text } of texte10) for (const satz of saetze10(text)) for (const f of W.globalWortPruefen(satz, ["aufgabe_an_betreuer"])) {
    if (/garant/i.test(f.treffer) && gebunden(satz)) continue;
    if (wo.startsWith("vertrag") && /verbotene Aussage 1/.test(f.hinweis) && /zinsfrei/.test(satz) && /siebzehnten Monat/.test(satz)) continue;
    wand++; console.log(`  WAND  ${wo}: „${satz.slice(0, 110)}“ → ${f.hinweis}`);
  }
  ok(wand === 0, `Wortwand der neuen Wege: ${wand} Treffer in ${texte10.length} Texten`);
  const neuTexte = sammle([C.KAPITAL_C_ANGABEN, C.KAPITAL_C_REISEPASS, sFT, at.unterKnopfOhne, at.fehltFastTrack, at.angabenFehlen, C.KAPITAL_C_ANNAHME.fehltSofortWahl, bo, so.text,
    C.kapitalCSeite(DDK2).fragen.liste.filter((f) => /Fast-Track bringt|Angaben/.test(f.frage))], []).join(" ");
  ok(!/(die|das|eine?)\s+(Bank|Institut)\s+entscheidet|entscheidet\s+(die|das)\s+(Bank|Institut)/i.test(neuTexte), "E-468: kein „die Bank/das Institut entscheidet“ in den neuen Texten");
  ok(!/\bdu\b|\bdein/i.test(neuTexte) && /\bSie\b|\bIhre?\b/.test(neuTexte), "Kunden gesiezt");
  ok(texte10.every((x) => !BANK.test(x.text)) && texte10.every((x) => !RAHMEN.test(ohneLeistungsname(x.text))) && texte10.every((x) => !/\bbis zu\b/i.test(x.text)), "kein Bankname, keine Kartenrahmen-Zahl, kein „bis zu“");
}

// ═══ 12 E-487: DIE TEMPO-FASSUNG „VORRANG“ — OHNE DATENBANK ══════════════════════════════════════════
// Bis E-487 nannte der Fast-Track ein Zeitziel („Gesellschaft und EIN binnen 72 Stunden“). Offene Angebote lesen jetzt die Vorrang-
// Fassung (Vorrang in allen Schritten, keine Zeitzusage für die EIN); angenommene Verträge bleiben wortgleich.
abschnitt("12 E-487 — Tempo „Vorrang“: offen ohne „72 Stunden“, angenommen wortgleich, nichts vorgewählt");
const KS12 = await import("../server/lib/fiaon-global-angebot-kapital-c");
{
  const { createHash } = await import("node:crypto");
  // 12a — ANGENOMMENE VERTRÄGE WORTGLEICH: dieselbe Rechnung wie VOR E-487 (Grundlinie aus dem Stand vor diesem Bau, 5256de04,
  // 09.11.2026) — über den echten Leseweg des Servers (kapitalCDatenAus) mit angenommenen Zeilen OHNE schalter.tempoFassung: mit Wahl
  // (beide Wahlen, Angaben vom Kunden, Delaware/Florida) und ohne Wahl. Vertrag (voll, gekürzt, mit Vermerk), Prüfsumme, Seite, Übersicht,
  // Annahme, Garantie, Bestätigung (auch mit Reisepass-Bitte), Start-Aufgabe, „Mein Auftrag“, Fristwarnung. Ändert sich hier etwas,
  // ändert sich der Text eines ANGENOMMENEN Vertrags — dann nie still die Zahl tauschen.
  const GRUNDLINIE_12A = "4c8ca021dac8b410f5b29935b4059e5267b9f1efa88f96cebd3e3f91ea223d13";
  const KUNDE_ANGABEN = { art: "privat", anrede: "Frau", vorname: "Erika", nachname: "Musterfrau", email: "erika.musterfrau@beispiel.example", geburtsdatum: "1985-03-04", geburtsort: "", staatsangehoerigkeit: "deutsch", strasse: "Musterweg 7", plz: "12345", ort: "Musterstadt", land: "DE", telefon: "", ausweise: [] };
  const KUNDE_VOLL = { art: "privat", anrede: "Herr", vorname: "Max", nachname: "Mustermann", geburtsdatum: "1980-01-15", geburtsort: "Musterstadt", staatsangehoerigkeit: "deutsch", strasse: "Musterweg 1", plz: "12345", ort: "Musterstadt", land: "DE", email: "max.mustermann@beispiel.example", telefon: "", ausweise: [{ art: "reisepass", nummer: "C01X00T47", gueltigBis: "2033-01-01", behoerde: "Stadt Musterstadt" }] };
  const FAELLE_12A: { kunde: unknown; par: Record<string, unknown>; ft: (boolean | null)[] }[] = [
    { kunde: KUNDE_ANGABEN, par: { datenVomKunden: true, fastTrackWahl: true, unterschriftFrei: true, buerginAktiv: true, buerginStandAm: "2026-11-01", unterlagen: [], staatenFassung: "E-465", bundesstaat: "Delaware" }, ft: [true, false] },
    { kunde: KUNDE_VOLL, par: { fastTrackWahl: true, zahlungszielTage: 7, unterlagen: [{ titel: "Reisepass", am: "2026-10-27" }], staatenFassung: "E-465", bundesstaat: "Florida" }, ft: [true, false] },
    { kunde: KUNDE_VOLL, par: { buerginAktiv: false, buerginStandAm: "2026-10-19", unterlagen: [{ titel: "Reisepass", am: "2026-10-27" }] }, ft: [null] },
  ];
  const angenommeneZeile = (f: (typeof FAELLE_12A)[number], ft: boolean | null, schalterDazu: Record<string, unknown> = {}) => ({
    id: 3, angebot_ref: "FIAON-IA-CMUSTR3", fassung: "IA-KAPITAL-2026-10-27-C", status: "angenommen", angenommen_am: "2026-11-03T09:09:51.575Z", text_hash: "abc",
    kunde: f.kunde, parameter: { ...C.KAPITAL_C_VORGABEN, ...f.par }, buergin: BUERGIN, gueltig_bis: "2026-11-16", frist_beginn: "2026-11-05", frist_ende: "2026-12-31",
    schalter: { llc: { wunsch: "MUSTER VENTURES LLC", alternative1: "B LLC", alternative2: "" }, laufzeitJahre: 10, sofortBeginn: true, ...(ft == null ? {} : { fastTrack: ft }), unterschrift: { art: "getippt", name: "Muster" }, ...schalterDazu },
  }) as any;
  const aus12a: unknown[] = [];
  for (const f of FAELLE_12A) for (const ft of f.ft) {
    const z = angenommeneZeile(f, ft);
    const d = KS12.kapitalCDatenAus(z); const w = KS12.kapitalCWahlAus(z)!; const par = d.parameter;
    const mit = C.kapitalCMitFastTrack(par, w);
    const vermerk = { am: new Date(z.angenommen_am), ip: "203.0.113.7", userAgent: "x", hash: "abc", wahl: w, unterschrift: w.unterschrift! };
    const best = { anrede: C.kapitalCAnrede(d.kunde), angenommen: "03.11.2026 um 10:09 Uhr", llc: "MUSTER VENTURES LLC", ...(par.fastTrackWahl ? { fastTrack: mit } : {}), tempoFassung: par.tempoFassung };
    const start = { angebotRef: d.ref, name: C.kapitalCName(d.kunde), parameter: par, bezahltAm: "2026-11-06", zweck: "FIAON-X", frist: { beginn: "2026-11-06", ende: "2027-01-01" }, llc: "MUSTER VENTURES LLC", laufzeitJahre: 10, bestaetigung: { da: true, grund: null }, ...(par.fastTrackWahl ? { fastTrack: mit } : {}) };
    aus12a.push(KS12.kapitalCTextHash(d), C.kapitalCRumpfHtml(d, null), C.kapitalCRumpfHtml(d, null, { ausweiseGekuerzt: true }), C.kapitalCRumpfHtml(d, vermerk), C.kapitalCSeite(d),
      C.kapitalCBestellUebersicht(d, 10), C.kapitalCBestellUebersicht(d, 10, true), C.kapitalCBestellUebersicht(d, 10, false), C.kapitalCAnnahmeTexte(d), C.kapitalCGarantie(par),
      C.KAPITAL_C_BESTAETIGUNG.absaetze(best), C.KAPITAL_C_BESTAETIGUNG.absaetze({ ...best, reisepass: true }),
      C.kapitalCStartAufgabe(start), C.kapitalCStartAufgabe({ ...start, reisepassDa: false }),
      C.kapitalCMeinAuftrag({ parameter: par, angenommenAm: "2026-11-03", teile: [], garantieErfuelltAm: null, erstattungAusgeloest: false, laufzeitJahre: 10, ...(par.fastTrackWahl ? { fastTrack: mit } : {}) }),
      KS12.kapitalCFristAufgabeFuer(z, { schritt: "warnung14", tageBis: 14 }));
  }
  const ist12a = createHash("sha256").update(JSON.stringify(aus12a)).digest("hex");
  ok(ist12a === GRUNDLINIE_12A, "Angenommene Verträge wortgleich wie vor E-487: Vertrag (voll, gekürzt, Vermerk), Prüfsumme, Seite, Übersicht, Annahme, Bestätigung, Aufgabe, „Mein Auftrag“, Fristwarnung", ist12a);
  ok(aus12a.length === 80 && /72 Stunden/.test(JSON.stringify(aus12a)), "Gegenprobe: ein vor E-487 angenommener Vertrag mit Wahl trägt seine „72 Stunden“ weiter — so wurde er angenommen");

  // 12b — Welche Fassung gilt? Nicht angenommen → die aktuelle (ohne Schreiben); angenommen → die der Annahme, ohne Vermerk Bestand.
  const TA = C.kapitalCTempoFassungAus;
  ok(C.KAPITAL_C_TEMPO_FASSUNG === "E-487" && TA({ angenommen: false }) === "E-487" && TA({ angenommen: false, schalter: { tempoFassung: "" }, gespeichert: "" }) === "E-487"
    && TA({ angenommen: true }) === "" && TA({ angenommen: true, schalter: {}, gespeichert: "" }) === "" && TA({ angenommen: true, schalter: { tempoFassung: "E-487" } }) === "E-487"
    && TA({ angenommen: true, schalter: { tempoFassung: "" }, gespeichert: "E-487" }) === "" && TA({ angenommen: true, schalter: null, gespeichert: "E-487" }) === "E-487",
  "kapitalCTempoFassungAus: offen → aktuell; angenommen → schalter, sonst gespeichert, sonst leer (Bestand)");
  // Wie die offenen Angebote in der Produktion: gespeichert VOR E-487, also ganz ohne den Schlüssel tempoFassung.
  const { tempoFassung: _ohne, ...VORGABEN_VOR_E487 } = C.KAPITAL_C_VORGABEN;
  const POFFEN = { ...VORGABEN_VOR_E487, datenVomKunden: true, fastTrackWahl: true, unterschriftFrei: true, buerginAktiv: true, buerginStandAm: "2026-11-01", unterlagen: [], staatenFassung: "E-465", bundesstaat: "Delaware" };
  const offeneZeile = (parameter: Record<string, unknown> = POFFEN, extra: Record<string, unknown> = {}) => ({ id: 4, angebot_ref: "FIAON-IA-CMUSTR4", fassung: C.KAPITAL_C_FASSUNG, status: "offen", kunde: KUNDE_ANGABEN, parameter, buergin: BUERGIN, gueltig_bis: "2026-11-23", schalter: null, ...extra }) as any;
  const zOffen = offeneZeile(); const dOffen = KS12.kapitalCDatenAus(zOffen);
  ok(dOffen.parameter.tempoFassung === "E-487" && !("tempoFassung" in zOffen.parameter) && C.kapitalCVorrangGilt(dOffen.parameter), "offenes Angebot (gespeichert ohne tempoFassung, wie in der Produktion): liest E-487 — die Zeile bleibt unverändert, kein Schreiben nötig");
  ok(KS12.kapitalCDatenAus(offeneZeile({ ...POFFEN, tempoFassung: "" })).parameter.tempoFassung === "E-487" && KS12.kapitalCDatenAus(offeneZeile(POFFEN, { status: "abgelaufen" })).parameter.tempoFassung === "E-487",
    "auch mit gespeichert leer oder abgelaufen (nie angenommen): die aktuelle Fassung");
  ok(KS12.kapitalCDatenAus(angenommeneZeile(FAELLE_12A[0], false)).parameter.tempoFassung === "" && KS12.kapitalCDatenAus({ ...angenommeneZeile(FAELLE_12A[0], false), status: "zurueckgezogen" }).parameter.tempoFassung === "",
    "angenommen ohne Vermerk (vor E-487) — auch mit späterem anderem Stand (angenommen_am bleibt): Bestand");

  // 12c — OFFENE ANGEBOTE OHNE „72 STUNDEN“: alle Kundentexte über den echten Weg des Servers (Kundensicht, Vertrag, Vorschau,
  // Bestätigung, Aufgabe, „Mein Auftrag“) — mit Wahl (beide Wahlen), ohne Wahl, Delaware und Florida.
  const ANLAGE_ZEIT = new Date("2026-11-09T10:00:00Z");
  const offenTexte: { wo: string; text: string }[] = [];
  const offenDazu = (wo: string, wert: unknown) => sammle(wert, []).forEach((t) => offenTexte.push({ wo, text: flach(t) }));
  const VARIANTEN_12C: { name: string; par: Record<string, unknown> }[] = [
    { name: "Wahl, Angaben, Delaware", par: POFFEN },
    { name: "Wahl, Florida", par: { ...VORGABEN_VOR_E487, fastTrackWahl: true, unterschriftFrei: true, unterlagen: [{ titel: "Reisepass", am: "2026-10-27" }], staatenFassung: "E-465", bundesstaat: "Florida" } },
    { name: "ohne Wahl (Fast-Track inklusive), Delaware", par: { ...VORGABEN_VOR_E487, unterschriftFrei: true, unterlagen: [{ titel: "Reisepass", am: "2026-10-27" }], staatenFassung: "E-465", bundesstaat: "Delaware" } },
  ];
  for (const vt of VARIANTEN_12C) {
    const z = offeneZeile(vt.par, { kunde: vt.par.datenVomKunden ? KUNDE_ANGABEN : KUNDE_VOLL });
    const d = KS12.kapitalCDatenAus(z); const par = d.parameter;
    const sicht = (await KS12.kapitalCKundenSicht("T12", z)).body as any;
    const ohneStil = (h: string) => ohneHtml(h.replace(/<style>[\s\S]*?<\/style>/g, ""));
    offenDazu(`${vt.name}: kundensicht`, { seite: sicht.seite, uebersicht: sicht.uebersicht, uebersichtJe: sicht.uebersichtJe, annahme: sicht.annahme, gesperrt: sicht.gesperrtGrund });
    offenDazu(`${vt.name}: vertrag`, absText(C.kapitalCZiffern(d)));
    // Ganze Darstellungen (mit Anlage = gesetzliches Muster): für „Stunden“ geprüft, an der Wortwand nicht (wie Abschnitt 4).
    offenDazu(`${vt.name}: html`, [ohneStil(sicht.html), ohneStil(KS12.kapitalCVorschauHtml(d))]);
    for (const ft of par.fastTrackWahl ? [true, false] : [null]) {
      const wahl = { llc: { wunsch: "MUSTER VENTURES LLC", alternative1: "", alternative2: "" }, laufzeitJahre: 10, sofortBeginn: true, ...(ft == null ? {} : { fastTrack: ft }) };
      const mit = C.kapitalCMitFastTrack(par, wahl);
      offenDazu(`${vt.name}: html vermerk ${ft}`, ohneHtml(C.kapitalCRumpfHtml(d, { am: ANLAGE_ZEIT, ip: "203.0.113.7", userAgent: "x", hash: "abc", wahl, unterschrift: { art: "getippt", name: "Muster" } })));
      offenDazu(`${vt.name}: bestaetigung ${ft}`, [C.KAPITAL_C_BESTAETIGUNG.absaetze({ anrede: "Sehr geehrte Frau Musterfrau", angenommen: "09.11.2026 um 11:00 Uhr", llc: "MUSTER VENTURES LLC", ...(par.fastTrackWahl ? { fastTrack: mit } : {}), reisepass: !!par.datenVomKunden, tempoFassung: par.tempoFassung })]);
      offenDazu(`${vt.name}: aufgabe ${ft}`, C.kapitalCStartAufgabe({ angebotRef: d.ref, name: "Erika Musterfrau", parameter: par, bezahltAm: "2026-11-06", zweck: "FIAON-X", frist: { beginn: "2026-11-06", ende: "2027-01-01" }, llc: "MUSTER VENTURES LLC", laufzeitJahre: 10, bestaetigung: { da: true, grund: null }, ...(par.fastTrackWahl ? { fastTrack: mit } : {}), ...(par.datenVomKunden ? { reisepassDa: false } : {}) }));
      offenDazu(`${vt.name}: mein-auftrag ${ft}`, C.kapitalCMeinAuftrag({ parameter: par, angenommenAm: "2026-11-09", teile: [], garantieErfuelltAm: null, erstattungAusgeloest: false, laufzeitJahre: 10, ...(par.fastTrackWahl ? { fastTrack: mit } : {}) }));
    }
  }
  const STUNDEN = offenTexte.filter((x) => /72\s*Stunden|\bStunden\b/i.test(x.text));
  ok(offenTexte.length > 300 && STUNDEN.length === 0, `offene Angebote: kein „72 Stunden“, überhaupt keine Stunden — in ${offenTexte.length} Texten (Seite, Karten, Fragen, Informationen, Übersicht, Vertrag, Vorschau, Vermerk, Bestätigung, Aufgabe)`, STUNDEN.map((x) => `${x.wo}: ${x.text.slice(0, 90)}`));
  // Keine Zeitzusage für die EIN: nie „EIN … in/binnen … Stunden/Tagen/Werktagen“ im selben Satzteil (der Antrag „am Tag der Eintragung“
  // ist ein Arbeitsschritt von FIAON, keine Zusage, wann die Behörde die EIN erteilt).
  const EIN_ZEIT = /\bEIN\b[^.;:]{0,80}\b(Stunden|Tagen|Werktagen)\b|\b(Stunden|Tagen|Werktagen)\b[^.;:]{0,30}\bEIN\b/;
  const einZeit = offenTexte.filter((x) => EIN_ZEIT.test(x.text));
  ok(einZeit.length === 0, "offene Angebote: keine Stunden- oder Tageszusage für die EIN", einZeit.map((x) => `${x.wo}: ${(x.text.match(EIN_ZEIT) ?? [""])[0]}`));

  // 12d — DER NEUE FAST-TRACK, überall derselbe: Vorrang in allen Schritten — Anmeldung (mit Express, wo es ihn gibt) spätestens am
  // Werktag nach dem Eingang, Antrag auf die EIN am Tag der Eintragung, Unterlagen für das finanzierende Institut parallel.
  const sOffen = C.kapitalCSeite(dOffen);
  const vOffen = flach(absText(C.kapitalCZiffern(dOffen)).join("\n"));
  ok(vOffen.includes("Wählt der Auftraggeber bei der Annahme den Fast-Track (Annahmevermerk), bearbeitet FIAON den Auftrag in allen Schritten mit Vorrang: Die Anmeldung reicht FIAON mit der Express-Bearbeitung des Bundesstaats spätestens am Werktag nach diesem Eingang ein, den Antrag auf die EIN am Tag der Eintragung, sobald der Auftraggeber das dafür vorbereitete Formular unterschrieben hat; die Unterlagen für das finanzierende Institut entstehen parallel zur Gründung.")
    && !/laufen beschleunigt|Ziel sind dann die Gesellschaft und ihre EIN|folgt so schnell wie möglich/.test(vOffen), "Vertrag Ziffer 2 Absatz 3 (offen, mit Wahl): Vorrang in allen Schritten — Express, EIN-Antrag am Tag der Eintragung, Unterlagen parallel; kein „beschleunigt“, kein Zeitziel für die EIN", vOffen.slice(vOffen.indexOf("Fast-Track nach Wahl"), vOffen.indexOf("Fast-Track nach Wahl") + 700));
  const vOhneWahl = flach(absText(C.kapitalCZiffern(KS12.kapitalCDatenAus(offeneZeile(VARIANTEN_12C[2].par, { kunde: KUNDE_VOLL })))).join("\n"));
  ok(vOhneWahl.includes("Fast-Track: FIAON bearbeitet den Auftrag in allen Schritten mit Vorrang — die Anmeldung reicht FIAON mit der Express-Bearbeitung des Bundesstaats spätestens am Werktag nach dem Eingang der Vergütung nach Ziffer 6 Absatz 1 ein, den Antrag auf die EIN am Tag der Eintragung, sobald der Auftraggeber das dafür vorbereitete Formular unterschrieben hat; die Unterlagen für das finanzierende Institut entstehen parallel zur Gründung.")
    && !/laufen beschleunigt/.test(vOhneWahl), "Vertrag Ziffer 2 Absatz 3 (offen, Fast-Track inklusive): dieselbe Definition");
  const frage = flach((sOffen.fragen.liste.find((f) => f.frage === "Was bringt der Fast-Track?")?.antwort ?? []).join(" "));
  ok(/^Vorrang in jedem Schritt: Wir melden Ihre Gesellschaft mit dem Express des Bundesstaats spätestens am Werktag nach dem Eingang Ihrer Zahlung und Ihres Reisepasses an, stellen den Antrag auf die EIN am Tag der Eintragung — Sie unterschreiben nur das Formular, das wir dafür vorbereiten — und bereiten die Unterlagen für die Bank parallel vor\./.test(frage)
    && /Unser Ziel ist dann die Auszahlung in Woche vier\. Er kostet einmalig 499 €\. Ihre Geld-zurück-Garantie bleibt mit und ohne Fast-Track bei acht Wochen\.$/.test(frage), "Fragen: „Was bringt der Fast-Track?“ — die drei Schritte, Ziel, Preis, Garantie gleich", frage);
  const info = flach(sOffen.informationen.zeilen.find((z) => z.titel === "Beginn und Zeitplan")?.text ?? "");
  ok(info.includes("mit Fast-Track hat Ihr Auftrag Vorrang in allen Schritten (Anmeldung mit Express spätestens am Werktag nach dem Eingang Ihrer Zahlung und Ihres Reisepasses, Antrag auf die EIN am Tag der Eintragung, die Unterlagen für die Bank parallel), unser Ziel ist dann die Auszahlung in Woche vier."), "Informationen vor Vertragsschluss „Beginn und Zeitplan“: derselbe Vorrang", info);
  const k = sOffen.fastTrack!;
  ok(flach(k.karten[1].zeile) === "Wir beginnen sofort, mit Vorrang in jedem Schritt — die Unterlagen für die Bank entstehen parallel." && k.karten[1].punkte.map(flach).join(" | ") === "Gründung, Konto und Karten · Fast-Track 499 € | Anmeldung mit Express spätestens am Werktag nach Zahlung und Reisepass | Antrag auf die EIN am Tag der Eintragung | Unser Ziel: Auszahlung in Woche vier | Geld-zurück-Garantie: acht Wochen"
    && flach(k.garantie) === "Wir beginnen in beiden Fällen sofort. Mit Fast-Track hat Ihr Auftrag in jedem Schritt Vorrang, unser Ziel ist die Auszahlung in Woche vier. Ihre Geld-zurück-Garantie gilt in beiden Fällen: acht Wochen.", "Karte „Mit Fast-Track“ und Satz darunter: Vorrang mit den Schritten, Ziel, Garantie", k.karten[1]);
  ok(flach(sOffen.weg.sub) === "Wir beginnen in beiden Fällen sofort mit Ihrem Zahlungseingang. Ohne Fast-Track stehen Ihre Gesellschaft und EIN in drei bis fünf Wochen; mit Fast-Track hat Ihr Auftrag in jedem Schritt Vorrang — Ihre Geld-zurück-Garantie bleibt bei acht Wochen."
    && /EIN-Antrag \(mit Fast-Track am Tag der Eintragung\)/.test(sOffen.weg.liste[0].text) && !/EIN mit Vorrang/.test(sOffen.weg.liste[0].text)
    && sOffen.paket.gruppen[0].kacheln.find((x) => x.schluessel === "steuernummern")!.details[0] === "EIN-Antrag vollständig vorbereitet — mit Fast-Track am Tag der Eintragung", "Ihr Weg und Ihr Paket: Vorrang nur mit Fast-Track (ohne Fast-Track kein „EIN mit Vorrang“ mehr)");
  const uebT = flach(C.kapitalCBestellUebersicht(dOffen, 10, true).zeilen.find((z) => z.label === "Beginn")!.wert);
  ok(uebT === "sofort mit Ihrem Zahlungseingang — auf Ihren ausdrücklichen Wunsch vor Ablauf der Widerrufsfrist; mit Fast-Track Vorrang in allen Schritten (Ziffer 2 Absatz 3)", "Übersicht über dem Knopf (mit Fast-Track): Vorrang statt Zeit", uebT);
  const bestT = C.KAPITAL_C_BESTAETIGUNG.absaetze({ anrede: "Sehr geehrte Frau Musterfrau", angenommen: "09.11.2026 um 11:00 Uhr", llc: "MUSTER VENTURES LLC", fastTrack: true, tempoFassung: "E-487" }).join(" ");
  ok(bestT.endsWith("Mit dem Fast-Track bearbeiten wir Ihren Auftrag in allen Schritten mit Vorrang (Ziffer 2 Absatz 3 Ihres Vertrags).") && !/Stunden/.test(bestT), "Vertragsbestätigung (neu angenommen, mit Fast-Track): Vorrang statt „72 Stunden“");
  const startT = C.kapitalCStartAufgabe({ angebotRef: "R", name: "Erika Musterfrau", parameter: dOffen.parameter, bezahltAm: "2026-11-06", zweck: "FIAON-X", frist: { beginn: "2026-11-06", ende: "2027-01-01" }, llc: "MUSTER VENTURES LLC", laufzeitJahre: 10, bestaetigung: { da: true, grund: null }, fastTrack: true }).text;
  ok(/FAST-TRACK gewählt \(Ziffer 2 Absatz 3\): spätestens am Werktag nach Zahlungseingang einreichen, mit Express des Bundesstaats, also bis 09\.11\.2026\. EIN-Antrag am Tag der Eintragung — das Formular \(SS-4\) dafür vorher zur Unterschrift schicken; die Unterlagen für das finanzierende Institut parallel\. Keine Zeit für die EIN zusagen\./.test(startT) && !/binnen fünf Werktagen/.test(startT),
    "Aufgabe nach Zahlung (Fast-Track): Anmeldung am nächsten Werktag (Freitag bezahlt → Montag), EIN-Antrag am Tag der Eintragung, keine Zeitzusage", startT);
  const startOhne = C.kapitalCStartAufgabe({ angebotRef: "R", name: "Erika Musterfrau", parameter: dOffen.parameter, bezahltAm: "2026-11-06", zweck: "FIAON-X", frist: { beginn: "2026-11-06", ende: "2027-01-01" }, llc: "MUSTER VENTURES LLC", laufzeitJahre: 10, bestaetigung: { da: true, grund: null }, fastTrack: false }).text;
  ok(/binnen fünf Werktagen nach Zahlungseingang einreichen, also bis 13\.11\.2026\./.test(startOhne) && /OHNE Fast-Track \(kein Vorrang\)/.test(startOhne) && !/FAST-TRACK/.test(startOhne), "Aufgabe ohne Fast-Track: fünf Werktage wie bisher, kein Vorrang", startOhne);

  // 12e — Express nur, wo der Bundesstaat ihn anbietet (Florida hat keinen — shared/fiaon-global-bundesstaaten.ts).
  const dFl = KS12.kapitalCDatenAus(offeneZeile(VARIANTEN_12C[1].par, { kunde: KUNDE_VOLL }));
  const flTexte = [flach(absText(C.kapitalCZiffern(dFl)).join(" ")), flach(sammle(C.kapitalCSeite(dFl).fastTrack, []).join(" ")), flach((C.kapitalCSeite(dFl).fragen.liste.find((f) => f.frage === "Was bringt der Fast-Track?")?.antwort ?? []).join(" "))];
  ok(flTexte.every((t) => !/Express/.test(t)) && /Die Anmeldung reicht FIAON spätestens am Werktag nach diesem Eingang ein/.test(flTexte[0]) && C.kapitalCVorrang({ bundesstaat: "Wyoming", datenVomKunden: false }).express && !C.kapitalCVorrang({ bundesstaat: "Florida", datenVomKunden: false }).express,
    "Florida (kein Express beim Staat): Vorrang ohne das Wort Express; Delaware und Wyoming mit Express");

  // 12f — DER SATZ OHNE FAST-TRACK BLEIBT WORTGLEICH (Geschäftsentscheidung, nicht Teil von E-487).
  const DBESTAND = { ...dOffen, parameter: { ...dOffen.parameter, tempoFassung: "" } };
  const ohneSatz = "ohne Fast-Track liegen Gesellschaft, EIN und ITIN in der Regel nach drei bis fünf Wochen vor";
  ok(C.KAPITAL_C_TEMPO.ohne === "drei bis fünf Wochen" && vOffen.includes(ohneSatz) && flach(absText(C.kapitalCZiffern(DBESTAND)).join("\n")).includes(ohneSatz)
    && JSON.stringify(sOffen.fastTrack!.karten[0]) === JSON.stringify(C.kapitalCSeite(DBESTAND).fastTrack!.karten[0])
    && JSON.stringify(C.kapitalCBestellUebersicht(dOffen, 10, false)) === JSON.stringify(C.kapitalCBestellUebersicht(DBESTAND, 10, false))
    && JSON.stringify(C.KAPITAL_C_BESTAETIGUNG.absaetze({ anrede: "A", angenommen: "B", llc: "C", fastTrack: false, tempoFassung: "E-487" })) === JSON.stringify(C.KAPITAL_C_BESTAETIGUNG.absaetze({ anrede: "A", angenommen: "B", llc: "C", fastTrack: false })),
  "„Gesellschaft, EIN und ITIN in der Regel nach drei bis fünf Wochen“ (ohne Fast-Track): Vertrag, Karte, Übersicht und Bestätigung unverändert");

  // 12g — DIE ANNAHME HÄLT DIE FASSUNG FEST: Nach der Annahme liest der Vertrag genau den Text, den der Kunde angenommen hat.
  const wahl12 = { llc: { wunsch: "MUSTER VENTURES LLC", alternative1: "", alternative2: "" }, laufzeitJahre: 10, sofortBeginn: true, fastTrack: true };
  const sch12 = KS12.kapitalCSchalterBeiAnnahme(dOffen, wahl12, C.kapitalCPlan(dOffen.parameter, 10), { art: "getippt", name: "Erika Musterfrau" });
  ok(sch12.tempoFassung === "E-487" && sch12.fastTrack === true && sch12.verbraucher === true && sch12.gelesen === true && sch12.rate.monatsrateCents === C.kapitalCPlan(dOffen.parameter, 10).monatsrateCents
    && Object.keys(sch12).join(",") === "llc,laufzeitJahre,sofortBeginn,fastTrack,rate,gelesen,verbraucher,unterschrift,tempoFassung", "Annahme: schalter mit Wahl, Rate, Unterschrift — und der Tempo-Fassung", Object.keys(sch12));
  const zAngenommen = { ...zOffen, status: "angenommen", angenommen_am: "2026-11-09T11:00:00.000Z", schalter: sch12 };
  const dAngenommen = KS12.kapitalCDatenAus(zAngenommen);
  ok(dAngenommen.parameter.tempoFassung === "E-487" && KS12.kapitalCTextHash(dAngenommen) === KS12.kapitalCTextHash(dOffen) && C.kapitalCRumpfHtml(dAngenommen, null) === C.kapitalCRumpfHtml(dOffen, null),
    "nach der Annahme: dieselbe Fassung, derselbe Vertragstext, dieselbe Prüfsumme wie das angenommene Angebot");
  ok(KS12.kapitalCTextHash(dOffen) !== KS12.kapitalCTextHash(DBESTAND), "offene Angebote: neue Prüfsumme — eine noch offene Seite lädt vor der Annahme neu (409 „neu laden“)");

  // 12h — NEUE ANGEBOTE: Staaten-Wahl (E-465) und die aktuelle Tempo-Fassung aus EINER Quelle (Server und Vorschau im Skript).
  const pNeu = C.kapitalCNeuesAngebotParameter({ fastTrackWahl: true });
  ok(pNeu.tempoFassung === "E-487" && pNeu.bundesstaat === "Delaware" && pNeu.staatenFassung === "E-465" && pNeu.fastTrackWahl && C.kapitalCNeuesAngebotParameter({ bundesstaat: "FL", tempoFassung: "" }).tempoFassung === "E-487" && C.kapitalCNeuesAngebotParameter(null).bundesstaat === "Delaware",
    "neue Angebote: E-487 und Delaware als Vorgabe (auch wenn die Datei „leer“ mitschickt)");
  const skript = readFileSync(path.join(WURZEL, "scripts/angebot-kapital-anlegen.ts"), "utf8");
  ok(/const parameter = SC\.kapitalCNeuesAngebotParameter\(roh\.parameter\);/.test(skript), "Skript angebot-kapital-anlegen: die Vorschau rechnet mit derselben Quelle wie der Server");

  // 12i — NICHTS VORGEWÄHLT (§ 312a Abs. 3 BGB): Die Seite startet ohne Wahl und ohne Haken, der Server nimmt nur true/false.
  const tsx = readFileSync(path.join(WURZEL, "client/src/pages/business-angebot-kapital-c.tsx"), "utf8");
  ok(/const \[ft, setFt\] = useState<boolean \| null>\(null\);/.test(tsx) && /const \[sofort, setSofort\] = useState\(false\);/.test(tsx) && /const an = ft !== null && ft === \(c\.schluessel === "mit"\);/.test(tsx)
    && /if \(F && ft === null\) fehlt\.push/.test(tsx), "Seite: Fast-Track-Wahl startet leer (null), Haken „sofort“ leer, keine Karte vorab aktiv, ohne Wahl kein Absenden");
  ok(!sammle(sOffen.fastTrack, []).some((t) => /vorgewählt|empfohlen|Unsere Empfehlung/i.test(t)), "Karten: kein „vorgewählt“, kein „empfohlen“");
  // Das offene Angebot mit eingetragenen Angaben und Freigabe: Die Annahme prüft Wahl und Haken, bevor sie die Prüfsumme vergleicht.
  ok(C.kapitalCPflichtFehlen(dOffen).length === 0, "Muster: offenes Angebot vollständig und freigegeben", C.kapitalCPflichtFehlen(dOffen));
  const annahme12 = (body: Record<string, unknown>) => KS12.kapitalCAnnehmen(zOffen, { ...annahmeBasis(), sofortBeginn: true, textHash: "falsch", ...body }, KONTEXT, { zuViel: () => false });
  const an0 = await annahme12({}); const anS = await annahme12({ fastTrack: "true" }); const an1 = await annahme12({ fastTrack: 1 });
  ok(an0.status === 400 && an0.body.code === "FASTTRACK" && anS.status === 400 && anS.body.code === "FASTTRACK" && an1.status === 400 && an1.body.code === "FASTTRACK", "Server: ohne ausdrückliche Wahl (fehlt, „true“ als Text, 1) → 400 FASTTRACK — nie ein stiller Aufpreis", [an0.body, anS.body, an1.body]);
  const anOk = await annahme12({ fastTrack: false });
  ok(anOk.status === 409 && anOk.body.code === "GEAENDERT", "mit ausdrücklicher Wahl geht es bis zur Prüfsumme (hier absichtlich falsch → 409, ohne Datenbank)", anOk.body);

  // 12j — WORTWAND GRÜN und kein „garantiert“, kein Bank-Satz (E-468), gesiezt — in allen Texten der neuen Fassung.
  const neu12 = [frage, info, flach(sammle(k, []).join(" ")), flach(sOffen.weg.sub), uebT, bestT, flach(C.kapitalCSeite(dFl).fragen.liste.find((f) => f.frage === "Was bringt der Fast-Track?")?.antwort.join(" ") ?? "")];
  let wand12 = 0;
  // Die Aufgabe an Justin ist intern (wie in Abschnitt 6 nicht an der Wand), ganze Darstellungen mit der Anlage auch nicht.
  for (const { wo, text } of [...offenTexte.filter((x) => !/: (aufgabe|html) /.test(`${x.wo} `)), ...neu12.map((t) => ({ wo: "neu", text: t }))]) {
    for (const satz of text.split(/(?<=[.!?])\s+(?=[A-ZÄÖÜ„])/)) for (const f of W.globalWortPruefen(satz, ["aufgabe_an_betreuer"])) {
      if (/garant/i.test(f.treffer) && /Geld-zurück-Garantie|Garantiefrist|Garantiefall/.test(satz) && !/\bgarantier/i.test(satz)) continue;
      if (/: vertrag/.test(wo) && /verbotene Aussage 1/.test(f.hinweis) && /zinsfrei/.test(satz) && /siebzehnten Monat/.test(satz)) continue;
      wand12++; console.log(`  WAND  ${wo}: „${satz.slice(0, 110)}“ → ${f.hinweis}`);
    }
  }
  ok(wand12 === 0, `Wortwand der Tempo-Fassung: ${wand12} Treffer`);
  ok(offenTexte.every((x) => !/\bgarantier/i.test(x.text)) && neu12.every((t) => !/\bgarantier/i.test(t)), "kein „garantiert/garantieren“ — weder zu Auszahlung noch zu Finanzierung oder Tempo");
  const neuFlach = neu12.join(" ");
  ok(!/(die|das|eine?)\s+(Bank|Institut|Behörde)\s+entscheidet|entscheidet\s+(die|das)\s+(Bank|Institut|Behörde)/i.test(neuFlach) && !/\bdu\b|\bdein/i.test(neuFlach) && /\bSie\b|\bIhre?\b/.test(neuFlach), "neue Sätze: kein Bank-/Behörden-Vorbehalt (E-468), Kunden gesiezt");
}

// ═══ 11 E-474 LOKAL: derselbe Weg echt — Prüfstand-DB auf 127.0.0.1 + lokaler Server ═══════════════════
if (LOKAL) {
  abschnitt("11 E-474 lokal — Anlage, Angaben, Annahme ohne und mit Fast-Track, Reisepass (Prüfstand-Kopie + lokaler Server)");
  const A = await import("../server/lib/fiaon-global-angebot");
  const { sqlPool } = await import("../server/lib/db-pool");
  const BASIS = process.env.PRUEF_BASIS ?? "http://127.0.0.1:5474";
  const http = async (pfad: string, init: RequestInit = {}) => {
    const r = await fetch(`${BASIS}${pfad}`, { ...init, headers: { "X-Forwarded-For": "198.51.100.23", "User-Agent": UA, ...(init.headers as Record<string, string> ?? {}) } });
    return { status: r.status, j: (await r.json().catch(() => null)) as any };
  };
  const post = (pfad: string, body: unknown) => http(pfad, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const zeit = Date.now().toString(36);
  const PAR_LOKAL = { datenVomKunden: true, fastTrackWahl: true, unterschriftFrei: true, buerginAktiv: true, buerginStandAm: "2026-11-01" };
  const lauf = async (ft: boolean) => {
    const mail = `e474-${ft ? "mit" : "ohne"}-${zeit}@beispiel.example`;
    const KONTAKT_L = { ...KONTAKT, email: mail };
    const ohne = await KS10.kapitalCAnlegen({ kunde: KONTAKT_L, buergin: BUERGIN, parameter: { unterschriftFrei: true } }, "Prüfstand E-474");
    ok(!ohne.ok && /Geburtsdatum fehlt/.test(ohne.error), `[${ft ? "mit" : "ohne"}] Anlage ohne Parameter: weiter Fehler`, ohne);
    const an = await KS10.kapitalCAnlegen({ kunde: KONTAKT_L, buergin: BUERGIN, parameter: PAR_LOKAL }, "Prüfstand E-474");
    ok(an.ok, `[${ft ? "mit" : "ohne"}] Anlage mit datenVomKunden: Anrede, Name und E-Mail genügen`, an);
    if (!an.ok) return;
    const z0 = (await A.angebotLesen({ id: an.id }))!;
    const token = A.angebotTokenErzeugen(an.ref, String(z0.gueltig_bis instanceof Date ? z0.gueltig_bis.toISOString().slice(0, 10) : z0.gueltig_bis).slice(0, 10));
    const T = encodeURIComponent(token);
    const g0 = await http(`/api/fiaon/global/angebot/${T}`);
    ok(g0.status === 200 && g0.j?.angaben?.fehlen === true && g0.j.annahmeBereit === false && g0.j.uebersichtJe?.mit, `[${ft ? "mit" : "ohne"}] Seite: Angaben fehlen, Unterschrift gesperrt`, g0.j?.error ?? g0.status);
    const falsch = token.slice(0, -1) + (token.endsWith("0") ? "1" : "0");
    ok((await post(`/api/fiaon/global/angebot/${encodeURIComponent(falsch)}/kapital-angaben`, GUT)).status === 403, `[${ft ? "mit" : "ohne"}] Angaben mit falschem Token: 403`);
    const u1 = await post(`/api/fiaon/global/angebot/${T}/kapital-angaben`, { ...GUT, geburtsdatum: "2012-05-05" });
    ok(u1.status === 400 && u1.j?.feld === "geburtsdatum", `[${ft ? "mit" : "ohne"}] ungültige Angaben: 400 mit Feld`, u1);
    const anVorher = await post(`/api/fiaon/global/angebot/${T}/annehmen`, { ...annahmeBasis(), fastTrack: ft, sofortBeginn: ft, textHash: g0.j?.textHash });
    ok(anVorher.status === 409 && anVorher.j?.code === "PFLICHTFELDER", `[${ft ? "mit" : "ohne"}] Annahme vor den Angaben: 409`, anVorher);
    const s1 = await post(`/api/fiaon/global/angebot/${T}/kapital-angaben`, GUT);
    ok(s1.status === 200 && s1.j?.gespeichert === true && s1.j.annahmeBereit === true && s1.j.angaben?.fehlen === false && s1.j.textHash !== g0.j?.textHash, `[${ft ? "mit" : "ohne"}] Angaben über die Route: gespeichert, Unterschrift frei, neuer Fingerabdruck`, s1.j?.error ?? s1.status);
    // Name korrigieren (vor der Unterschrift)
    const s2 = await post(`/api/fiaon/global/angebot/${T}/kapital-angaben`, { ...GUT, nachname: "Musterfrau-Probe" });
    ok(s2.status === 200 && s2.j?.angaben?.werte?.nachname === "Musterfrau-Probe", `[${ft ? "mit" : "ohne"}] Korrektur vor der Unterschrift möglich (Name)`, s2.j?.error ?? s2.status);
    const [db1] = (await sqlPool`SELECT kunde, verlauf FROM fiaon_global_angebote WHERE id = ${an.id}`) as any[];
    const k1 = typeof db1.kunde === "string" ? JSON.parse(db1.kunde) : db1.kunde;
    const verlauf = JSON.stringify(db1.verlauf);
    ok(k1.geburtsdatum === "1985-03-04" && k1.strasse === "Musterweg 7" && k1.nachname === "Musterfrau-Probe" && k1.email === mail && Array.isArray(k1.ausweise) && k1.ausweise.length === 0, `[${ft ? "mit" : "ohne"}] Datenbank: Angaben im Kunden des Angebots, kein Ausweis`, k1);
    ok(/Angaben für den Vertrag eingetragen/.test(verlauf) && /Angaben für den Vertrag geändert/.test(verlauf) && !/1985|Musterweg/.test(verlauf), `[${ft ? "mit" : "ohne"}] Verlauf: Vermerk ohne die Werte`);
    // Zweiter Skriptlauf (Nachtragen mit der privaten Datei, nur Kontakt): die Angaben des Kunden bleiben
    const nach = await KS10.kapitalCAendern(an.id, { kunde: KONTAKT_L, parameter: PAR_LOKAL }, "Prüfstand E-474");
    const [db2] = (await sqlPool`SELECT kunde FROM fiaon_global_angebote WHERE id = ${an.id}`) as any[];
    const k2 = typeof db2.kunde === "string" ? JSON.parse(db2.kunde) : db2.kunde;
    ok(nach.ok && k2.geburtsdatum === "1985-03-04" && k2.nachname === "Musterfrau-Probe", `[${ft ? "mit" : "ohne"}] zweiter Skriptlauf überschreibt die Angaben des Kunden nicht`, k2);
    const g1 = await http(`/api/fiaon/global/angebot/${T}`);
    const annahme = await post(`/api/fiaon/global/angebot/${T}/annehmen`, { ...annahmeBasis("Musterfrau-Probe"), fastTrack: ft, sofortBeginn: ft, textHash: g1.j?.textHash });
    ok(annahme.status === 200 && annahme.j?.ok === true, `[${ft ? "mit" : "ohne"}] Annahme ${ft ? "mit" : "ohne"} Fast-Track über die Route`, annahme.j?.error ?? annahme.status);
    const z = (await A.angebotLesen({ id: an.id }))!;
    const sch = typeof z.schalter === "string" ? JSON.parse(z.schalter) : z.schalter;
    const [t1] = (await sqlPool`SELECT betrag_cents, titel, bestell_ref FROM fiaon_global_angebot_teile WHERE angebot_id = ${an.id} AND nr = 1`) as any[];
    ok(String(z.status) === "angenommen" && sch?.fastTrack === ft && sch?.sofortBeginn === ft, `[${ft ? "mit" : "ohne"}] gespeichert: Wahl und Sofortbeginn im Annahmevermerk`, sch);
    ok(Number(t1?.betrag_cents) === (ft ? 328_900 : 279_000) && t1?.titel === C.kapitalCTeil1Titel(ft), `[${ft ? "mit" : "ohne"}] Teil 1: ${ft ? "3.289 €" : "2.790 €"} mit passendem Titel`, t1);
    if (t1?.bestell_ref) {
      const rz = await A.angebotRechnungsZeile(String(t1.bestell_ref));
      ok(!!rz && /sowie Fast-Track/.test(rz.beschreibung) === ft, `[${ft ? "mit" : "ohne"}] Rechnungstext Teil 1 je Wahl`, rz);
      const [akte] = (await sqlPool`SELECT bestaetigungen FROM fiaon_global_auftraege WHERE ref = ${String(t1.bestell_ref)}`) as any[];
      const be = typeof akte?.bestaetigungen === "string" ? JSON.parse(akte.bestaetigungen) : akte?.bestaetigungen;
      ok(be?.fastTrack === ft && be?.sofortBeginn === ft, `[${ft ? "mit" : "ohne"}] Akte: Wahl in den Bestätigungen`, be);
      const [app] = (await sqlPool`SELECT street, city, zip, first_name, last_name FROM fiaon_applications WHERE ref = ${String(t1.bestell_ref)}`) as any[];
      ok(app?.street === "Musterweg 7" && app?.last_name === "Musterfrau-Probe", `[${ft ? "mit" : "ohne"}] Bestellzeile mit den eingetragenen Angaben (kein alter leerer Kunde)`, app);
    } else ok(false, `[${ft ? "mit" : "ohne"}] Bestellzeile angelegt (Fertigstellen über den lokalen Server)`, z.nacharbeit_fehler);
    const nachher = await post(`/api/fiaon/global/angebot/${T}/kapital-angaben`, { ...GUT, ort: "Anderswo" });
    ok(nachher.status === 409 && nachher.j?.code === "NICHT_OFFEN", `[${ft ? "mit" : "ohne"}] nach der Annahme: keine Änderung (409)`, nachher);
    const fertig = await http(`/api/fiaon/global/angebot/${T}`);
    ok(fertig.j?.privat?.reisepass?.hochladen && fertig.j.privat.reisepass.da === false && flach(fertig.j.fertigZahlung ?? "").includes(ft ? "sowie Fast-Track" : "2.790 € für Gründung, Konto und Karten."), `[${ft ? "mit" : "ohne"}] Fertig-Ansicht: Reisepass-Schritt, Betrag je Wahl`, fertig.j?.fertigZahlung);
    // Reisepass nach der Unterschrift über die Route in die Akte
    const png = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(200, 7)]);
    const hoch = async (daten: Buffer, name: string, tk = T) => { const fd = new FormData(); fd.append("datei", new Blob([daten]), name); return http(`/api/fiaon/global/angebot/${tk}/reisepass`, { method: "POST", body: fd }); };
    ok((await hoch(png, "pass.png", encodeURIComponent(falsch))).status === 403, `[${ft ? "mit" : "ohne"}] Reisepass mit falschem Token: 403`);
    const txt = await hoch(Buffer.from("kein Bild"), "pass.txt");
    ok(txt.status === 400, `[${ft ? "mit" : "ohne"}] Reisepass: nur PDF/JPG/PNG`, txt);
    const ph = await hoch(png, "pass.png");
    ok(ph.status === 200 && ph.j?.da === true, `[${ft ? "mit" : "ohne"}] Reisepass hochgeladen`, ph);
    if (t1?.bestell_ref) {
      const [dok] = (await sqlPool`SELECT art, von FROM fiaon_global_dokumente WHERE ref = ${String(t1.bestell_ref)} AND art = 'reisepass' AND geloescht_am IS NULL LIMIT 1`) as any[];
      ok(dok?.von === "kunde" && (await KS10.kapitalCReisepassDa(String(t1.bestell_ref))), `[${ft ? "mit" : "ohne"}] Reisepass liegt in der Akte (vom Kunden)`, dok);
    }
  };
  await lauf(false);
  await lauf(true);
  await sqlPool.end();
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
  // Das Team (Justin 27.10.2026, abends): Namen und Fotonamen kommen nur aus der privaten Datei. Geprüft wird jeder Namensteil ab vier
  // Buchstaben (ohne Titel) — außer dem Kürzel eines Porträts des Hauses („haus:<kürzel>“ steht als Kürzel ohnehin im Code).
  const teamRoh: any[] = Array.isArray(roh?.parameter?.team) ? roh.parameter.team : [];
  for (const t of teamRoh) {
    const kuerzel = String(t?.foto ?? "").startsWith("haus:") ? String(t.foto).slice(5).toLowerCase() : "";
    const name = String(t?.name ?? "").replace(/\b(Dr|Mag|Prof)\.\s*/g, "").replace(/\s+/g, " ").trim();
    if (name.length >= 4) werte.add(name.toLowerCase());
    for (const teil of name.split(" ")) if (teil.length >= 4 && teil.toLowerCase() !== kuerzel) werte.add(teil.toLowerCase());
  }
  if (teamRoh.length) console.log(`  (dazu ${teamRoh.length} Menschen aus dem Team)`);
  const dateien = ["shared/fiaon-global-angebot-kapital-c.ts", "server/lib/fiaon-global-angebot-kapital-c.ts", "client/src/pages/business-angebot-kapital-c.tsx", "client/src/styles/global-angebot-kapital-c.css", "scripts/pruef-kapital-fassung-c.ts", "scripts/angebot-kapital-anlegen.ts", "shared/fiaon-global-angebot-kapital.ts", "server/lib/fiaon-global-angebot-kapital.ts", "server/lib/fiaon-global-auftrag.ts", "client/src/pages/business-angebot.tsx", "client/src/components/angebot-firma/VertragsLeser.tsx", "scripts/pruef-wortwand-de.ts", "client/src/pages/business-angebot-kapital.tsx", "client/src/styles/global-angebot-kapital.css",
    // E-432 (28.10.2026): das Pflege-Skript für Global-Aufträge, sein Prüfstand und seine Bausteine
    "scripts/global-auftrag-pflegen.ts", "scripts/pruef-global-auftrag-pflegen.ts", "server/lib/fiaon-global-pflege.ts", "server/lib/fiaon-zahlungsfrist.ts"];
  // Als ganzes Wort (Buchstaben/Ziffern davor und danach zählen nicht): ein kurzer Nachname steckt sonst in „übergeben“ o. Ä.
  const ganzesWort = (w: string) => new RegExp(`(?<![\\p{L}\\p{N}])${w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?![\\p{L}\\p{N}])`, "u");
  for (const f of dateien) {
    const q = readFileSync(path.join(WURZEL, f), "utf8").toLowerCase();
    const funde = [...werte].filter((w) => ganzesWort(w).test(q));
    ok(funde.length === 0, `${f}: kein Wert des Kunden`, funde.length ? `${funde.length} Fund(e)` : "");
  }
}
const mail = arg("--mail");
if (mail && existsSync(mail)) {
  abschnitt("9 Mailtext (Wortwand, kein Bankname, Link-Platzhalter, Kosten und Rate)");
  const t = readFileSync(mail, "utf8");
  const tf = flach(t.replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&"));
  ok(t.includes("{{LINK}}"), "Mail: Platzhalter {{LINK}}");
  ok(!BANK.test(tf) && !/\bbis zu\b/i.test(tf) && !/\b60\s?(x|×|-?mal|fach)\b/i.test(tf), "Mail: kein Bankname, kein „bis zu“, kein „60x“");
  ok(!/abgesichert/i.test(tf) && !/\bgarantier/i.test(tf) && /Geld-zurück-Garantie/.test(tf), "Mail: „Geld-zurück-Garantie“ statt „abgesichert“, nie „garantiert“");
  ok(/3\.289 €/.test(tf) && /6\.890 €/.test(tf) && /10\.179 €/.test(tf) && /699 €/.test(tf) && /Ziffer 6/.test(tf) && !/heute 3\.289/.test(tf), "Mail: Ihre Investition vollständig (3.289 € mit dem Auftrag, 6.890 € bei Eintragung, 10.179 € im ersten Jahr, 699 €/Jahr, Ziffer 6)");
  ok(/unsere Begleitung bis zur Finanzierung/.test(tf) && !/ist Ihr Vertrag bereit: Ihre eigene US-Gesellschaft und die Finanzierung/.test(tf) && !/so steht es in Ziffer 4 Ihres Vertrags\./.test(tf.replace(/Geld-zurück-Garantie[^.]*\.[^.]*\./g, "")) && !/vollständig vor/.test(tf), "Mail: Begleitung statt Zusage, Konditionen als Ziel, Unterlagen „für den Start“");
  ok(/4\.312,58 €/.test(tf) && /1\.736,92 €/.test(tf), "Mail: Monatsrate je nach Laufzeit (5 und 15 Jahre)");
  ok(!/emirat|\bVAE\b|arabisch|dubai|immobil|bauträger|fertigstell|\bprojekt|restzahlung|\b60\s?%|31\. Dezember/i.test(tf), "Mail: kein Verwendungszweck (Justin 27.10.2026, 17:40)", (tf.match(/.{0,40}(emirat|immobil|projekt|bauträger|fertigstell).{0,40}/i) ?? [""])[0]);
  if (/<html/i.test(t)) ok(!/font-weight:\s*[6-9]00/.test(t.split("fiaon-karte")[0]) && !/font:\s*[6-9]00/.test(t.split("fiaon-karte")[0]), "Mail (HTML): kein Schriftgewicht 600+ im Text (Signaturkarte ausgenommen)");
  const funde = W.globalWortPruefen(tf, ["aufgabe_an_betreuer"]).filter((f) => !(/garant/i.test(f.treffer) && /Geld-zurück-Garantie/.test(tf) && !/\bgarantier/i.test(tf)));
  ok(funde.length === 0, "Mail: Wortwand", funde);
}

console.log(`\n${gut} grün, ${rot.length} rot.`);
if (rot.length) { console.log(rot.map((r) => `  · ${r}`).join("\n")); process.exit(1); }
