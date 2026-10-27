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
//
//   npx tsx scripts/pruef-kapital-fassung-c.ts
//   … --privat <angebot.json>   prüft zusätzlich, dass KEIN Wert des echten Kunden in den Code-Dateien steht (Repo öffentlich)
//   … --mail <Mail.txt>         prüft den Mailtext (Wortwand, kein Bankname, {{LINK}} vorhanden, Kosten und Rate genannt)
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
  ok(/Dieses Angebot gibt es nur mit Fast-Track: Ohne diesen Haken können Sie es nicht annehmen/.test(C.kapitalCAnnahmeTexte(D).sofortUnter), "Sofortbeginn offen als Bedingung des Angebots (kein Schein einer Wahl)");
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
  ok(!/stets in der Lage/.test(vertragText) && /Zeichnet sich ab, dass sie eine Rate nicht pünktlich zahlen kann, teilt der Auftraggeber das FIAON unverzüglich in Textform mit/.test(vertragText), "keine Ausstattungspflicht ohne Grenze — stattdessen Mitteilung, wenn eine Rate wackelt");
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
  ok(/auf seinen Wunsch löst FIAON sie dann auf eigene Kosten auf, bis dahin bestehen ihre US-Meldepflichten nach Ziffer 8 fort/.test(g.vertrag) && /Eine bereits gegründete Gesellschaft bleibt dem Auftraggeber; auf seinen Wunsch löst FIAON sie auf eigene Kosten auf/.test(vertragText), "Garantiefall und Widerruf: Auflösung auf Wunsch, US-Pflichten bis dahin");
  ok(/Die Frist ruht, solange die Vergütung nach Ziffer 6 Absatz 1 nicht gezahlt ist\. Sie ruht außerdem nur für die Tage, um die der Auftraggeber die Frist nach Ziffer 7 Absatz 2 überschreitet, und solange die Gesellschaft ein ihr vorgelegtes Finanzierungsangebot über den Betrag zu den Bedingungen nach Absatz 2 ohne weitere Sicherheiten oder Kosten des Auftraggebers nicht annimmt/.test(vertragText), "Ruhen eng: nur Überschreitungstage, nur Angebote ohne weitere Sicherheiten oder Kosten");
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
  ok(/Der Auftraggeber möchte sein Immobilienprojekt in den Vereinigten Arabischen Emiraten \(zu 60 % bezahlt, Fertigstellung vorgesehen zum 31\.12\.2026\) finanzieren/.test(rumpf) && /Die Mittel dienen dem Immobilienprojekt des Auftraggebers in den Vereinigten Arabischen Emiraten/.test(vertragText), "Projekt: Präambel „sein …“, Ziffer 4 im Dativ");
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
ok(alleTexte.every((x) => !RAHMEN.test(x.text)), "keine Kartenrahmen-Zahl", alleTexte.filter((x) => RAHMEN.test(x.text)).map((x) => x.text.slice(0, 90)));
const seiteFlach = flach(sammle(C.kapitalCSeite(D), []).join("\n"));
ok(seiteFlach.includes("Einführungszeiträume ohne Sollzins bieten manche Herausgeber an; die Bedingungen legt jeder Herausgeber selbst fest.") && seiteFlach.includes("Über Konto, Karten und deren Rahmen entscheidet das jeweilige Institut."), "die zwei erlaubten Karten-Sätze stehen auf der Seite");
ok(vertragText.includes("Einführungszeiträume ohne Sollzins bieten manche Herausgeber an; die Bedingungen legt jeder Herausgeber selbst fest.") && /Über Konto, Karten und deren Rahmen entscheidet das jeweilige Institut/.test(vertragText) && /Für Konto und Karten gilt die Geld-zurück-Garantie nach Ziffer 4 nicht/.test(vertragText), "Vertrag: Institut entscheidet, Sollzins-Satz, Garantie nicht für Karten");
ok(alleTexte.every((x) => !/\bnorthwest\b/i.test(x.text)) && !/Schwarzott|Northwest/i.test(readFileSync(path.join(WURZEL, "shared/fiaon-global-angebot-kapital-c.ts"), "utf8").replace(/\/\/.*$/gm, "")), "kein Partnername im Code der Fassung C");

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
  ok(uz.some((z) => z.label === "Ihre Verantwortung" && /ersetzen Sie ihr den Betrag persönlich \(Ziffer 5\)/.test(z.wert)) && /persönlich \(Ziffer 5\)/.test(s.rechner.verantwortung), "Ihre Verantwortung: am Rechner und in der Übersicht über dem Knopf");
  ok(uz.some((z) => z.label === "Geld-zurück-Garantie (Ziffer 4)" && /erhalten Sie alles Gezahlte zurück/.test(z.wert)), "Übersicht: Geld-zurück-Garantie");
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
  ok(roh.betragCents === C.KAPITAL_C_VORGABEN.betragCents && roh.laufzeitMaxJahre >= roh.laufzeitMinJahre && roh.laufzeitVorschlagJahre <= roh.laufzeitMaxJahre && roh.kursUsdJeEur === C.KAPITAL_C_VORGABEN.kursUsdJeEur && roh.projekt.bezahltProzent === 60
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
  const au = { status: "angenommen", angenommenAm: "2026-10-28", heute: "2026-11-20", garantieErfuelltAm: null, erstattungAusgeloest: false };
  ok(C.kapitalCAuszahlungPruefen(au, { datum: "2026-11-19" }).ok && (C.kapitalCAuszahlungPruefen({ ...au, garantieErfuelltAm: "2026-11-19" }, { datum: "2026-11-19" }) as any).schon && !C.kapitalCAuszahlungPruefen({ ...au, erstattungAusgeloest: true }, { datum: "2026-11-19" }).ok, "Auszahlung eintragen: einmal, nicht nach dem Garantiefall");
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
  ok(/^ERST Vertragsbestätigung senden — /.test(stOhne.titel) && /VERTRAGSBESTÄTIGUNG FEHLT \(§ 312f BGB\)/.test(stOhne.text) && /vorher nicht anmelden/.test(stOhne.text), "Start-Aufgabe ohne Vertragsbestätigung: zuerst senden, vorher nicht anmelden");
  // Die Vertragsbestätigung (§ 312f BGB): Anhang-Texte, Widerruf, Sofortbeginn, keine Zusage.
  const bt = flach(sammle(C.KAPITAL_C_BESTAETIGUNG, []).join(" "));
  ok(/Im Anhang finden Sie Ihren Vertrag mit Annahmevermerk, der Widerrufsbelehrung und dem Muster-Widerrufsformular/.test(bt) && /binnen vierzehn Tagen ohne Angabe von Gründen widerrufen/.test(bt) && /vor Ablauf der Widerrufsfrist beginnen \(Fast-Track\)/.test(bt) && /angemessenen Betrag/.test(bt), "Vertragsbestätigung: Vertrag, Belehrung, Formular, Sofortbeginn mit Wertersatz");
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
  const dateien = ["shared/fiaon-global-angebot-kapital-c.ts", "server/lib/fiaon-global-angebot-kapital-c.ts", "client/src/pages/business-angebot-kapital-c.tsx", "client/src/styles/global-angebot-kapital-c.css", "scripts/pruef-kapital-fassung-c.ts", "scripts/angebot-kapital-anlegen.ts", "shared/fiaon-global-angebot-kapital.ts", "server/lib/fiaon-global-angebot-kapital.ts", "server/lib/fiaon-global-auftrag.ts", "client/src/pages/business-angebot.tsx", "client/src/components/angebot-firma/VertragsLeser.tsx", "scripts/pruef-wortwand-de.ts"];
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
  ok(/3\.289 €/.test(tf) && /6\.890 €/.test(tf) && /Ziffer 6/.test(tf), "Mail: Ihre Investition in einem ruhigen Satz (heute 3.289 €, bei Eintragung 6.890 €, Ziffer 6)");
  ok(/4\.312,58 €/.test(tf) && /1\.736,92 €/.test(tf), "Mail: Monatsrate je nach Laufzeit (5 und 15 Jahre)");
  if (/<html/i.test(t)) ok(!/font-weight:\s*[6-9]00/.test(t.split("fiaon-karte")[0]) && !/font:\s*[6-9]00/.test(t.split("fiaon-karte")[0]), "Mail (HTML): kein Schriftgewicht 600+ im Text (Signaturkarte ausgenommen)");
  const funde = W.globalWortPruefen(tf, ["aufgabe_an_betreuer"]).filter((f) => !(/garant/i.test(f.treffer) && /Geld-zurück-Garantie/.test(tf) && !/\bgarantier/i.test(tf)));
  ok(funde.length === 0, "Mail: Wortwand", funde);
}

console.log(`\n${gut} grün, ${rot.length} rot.`);
if (rot.length) { console.log(rot.map((r) => `  · ${r}`).join("\n")); process.exit(1); }
