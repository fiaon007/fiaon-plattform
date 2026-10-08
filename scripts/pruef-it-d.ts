// ═══════════════════════════════════════════════════════════════════════════
// PRÜFSTAND E-IT-D (08.10.2026) — Punkte 4a, 4b, 4c des Team-Feedbacks
//
//   4a  Bonitätsauskunft-Rückstand: Stufensätze der Akte, Datenkopie-Weg,
//       Sammelknopf, Liegezeit-Wache, eigener Upload → „Leistung klären",
//       Haken „Einwilligung Datenübermittlung", Mails ohne „kostenlos".
//   4b  FIAON Finanz- und Bonitätsauswertung: Voraussetzungen, Art.-9-Maske,
//       Kennzahlen, Ampeln, FIAON-Finanzwert (100–999, Summe der Kriterien),
//       Schritte, Wände, Vier-Augen, Fassungen, PDF (Chromium, Verzeichnis).
//   4c  Unterlagen anfordern: Upload-Link (signiert, 14 Tage, widerrufbar,
//       nur die Arten), Drossel, Protokoll, Annahme (Hinzufügen), Masken.
//
// Teil A läuft OHNE Datenbank. Teil B nur gegen eine LOKALE Datenbank
// (DATABASE_URL auf 127.0.0.1/localhost — sonst übersprungen), Teil C druckt
// ein echtes PDF mit Chromium (überspringbar mit --ohne-pdf).
//
//   env -i … DATABASE_URL=postgresql://x@127.0.0.1:1/x npx tsx scripts/pruef-it-d.ts            (nur Teil A)
//   env -i … DATABASE_URL=postgresql://fiaon@127.0.0.1:54329/fiaon_it_d npx tsx scripts/pruef-it-d.ts
// Kein Schlüssel in der Umgebung: keine Mail, keine WhatsApp, kein Modell geht raus.
// ═══════════════════════════════════════════════════════════════════════════
import fs from "node:fs";
import path from "node:path";

process.env.DATABASE_URL ||= "postgresql://pruefstand@127.0.0.1:1/ins-leere";
const LOKAL = /@(127\.0\.0\.1|localhost):\d+\/fiaon_/.test(process.env.DATABASE_URL);
const OHNE_PDF = process.argv.includes("--ohne-pdf");

let geprueft = 0, fehler = 0;
const ok = (bedingung: unknown, text: string) => { geprueft++; if (!bedingung) { fehler++; console.log(`  ✗ ${text}`); } };
const abschnitt = (t: string) => console.log(`\n── ${t} ${"─".repeat(Math.max(0, 70 - t.length))}`);
const wurzel = path.resolve(import.meta.dirname ?? ".", "..");
const lies = (p: string) => fs.readFileSync(path.join(wurzel, p), "utf8");

const FA = await import("../shared/fiaon-finanzauswertung");
const AK = await import("../shared/fiaon-auskunft-akte");
const UA = await import("../shared/fiaon-unterlagen-anfrage");
const { wandPruefen } = await import("../shared/fiaon-wortverbote");

// ── Datum relativ zu heute (Berlin), damit der Prüfstand an jedem Tag gilt ──
const heuteIso = (() => {
  const t = new Intl.DateTimeFormat("de-DE", { timeZone: "Europe/Berlin", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date());
  const g = (a: string) => t.find((p) => p.type === a)?.value ?? "";
  return `${g("year")}-${g("month")}-${g("day")}`;
})();
const monatPlus = (ym: string, n: number) => { const g = Number(ym.slice(0, 4)) * 12 + Number(ym.slice(5, 7)) - 1 + n; return `${Math.floor(g / 12)}-${String((g % 12) + 1).padStart(2, "0")}`; };
const tagPlus = (iso: string, n: number) => new Date(Date.parse(`${iso}T12:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10);
const M0 = heuteIso.slice(0, 7);
const [M1, M2, M3] = [monatPlus(M0, -3), monatPlus(M0, -2), monatPlus(M0, -1)];
const letzter = (ym: string) => `${ym}-${String(new Date(Date.UTC(Number(ym.slice(0, 4)), Number(ym.slice(5, 7)), 0)).getUTCDate()).padStart(2, "0")}`;

/** Drei volle Monate eines Gehaltskontos — mit Art.-9-Buchungen, drei Mobilfunkverträgen, Klarna, Dispo. */
function buchungen(opts: { gehalt?: number; mitDispo?: boolean; ruecklast?: number; inkasso?: number; spiel?: number } = {}) {
  const b: any[] = [];
  const gehalt = opts.gehalt ?? 260000;
  let saldo = 50000;
  const add = (datum: string, betragCents: number, empfaenger: string, zweck: string, kategorie: string, wiederkehrend = false) => {
    saldo += betragCents;
    b.push({ datum, betragCents, empfaenger, zweck, kategorie, wiederkehrend, saldoDanachCents: saldo });
  };
  for (const m of [M1, M2, M3]) {
    add(`${m}-01`, -95000, "Hausverwaltung Nord GmbH", `Miete ${m}`, "miete", true);
    add(`${m}-03`, -8500, "Stadtwerke Berlin", "Abschlag Strom", "energie", true);
    add(`${m}-05`, -3999, "Telekom Deutschland GmbH", "Mobilfunk", "telefon_internet", true);
    add(`${m}-05`, -2999, "Vodafone GmbH", "Kabel Internet", "telefon_internet", true);
    add(`${m}-06`, -1999, "Telefonica Germany", "O2 Vertrag", "telefon_internet", true);
    add(`${m}-07`, -1299, "Netflix", "Abo", "abo_medien", true);
    add(`${m}-07`, -1099, "Spotify", "Premium", "abo_medien", true);
    add(`${m}-09`, -2350, "Linden-Apotheke", "Rezept", "gesundheit");
    add(`${m}-10`, -1500, "ver.di Bundesverwaltung", "Mitgliedsbeitrag", "sonstige_ausgabe", true);
    add(`${m}-12`, -4900, "Klarna", "Ratenkauf", "kredit_rate", true);
    for (const d of ["13", "18", "22", "26"]) add(`${m}-${d}`, -6000, "REWE Markt", "Einkauf", "lebensmittel");
    if (opts.mitDispo) add(`${m}-25`, -40000, "Möbelhaus", "Kauf", "freizeit");
    add(`${m}-27`, -780, "Sparkasse", "Sollzinsen Dispositionskredit", "gebuehren");
    add(`${m}-28`, gehalt, "Muster Logistik GmbH", `Lohn/Gehalt ${m}`, "gehalt", true);
  }
  for (let i = 0; i < (opts.ruecklast ?? 0); i++) add(`${M3}-1${i}`, 2999, "Rücklastschrift", "Rückgabe Lastschrift mangels Deckung", "ruecklastschrift");
  for (let i = 0; i < (opts.inkasso ?? 0); i++) add(`${M2}-1${i}`, -5000, "EOS Inkasso", "Forderung", "inkasso_mahnung");
  for (let i = 0; i < (opts.spiel ?? 0); i++) add(`${M3}-0${i + 1}`, -2500, "Tipico", "Sportwette", "gluecksspiel");
  return b.sort((x, y) => x.datum.localeCompare(y.datum));
}

// ═══════════════════════════════════════════════════════════════════════════
// TEIL A — OHNE DATENBANK
// ═══════════════════════════════════════════════════════════════════════════
abschnitt("A1 · Voraussetzungen (Ausweis)");
{
  const auszugOk: any = { vorhanden: true, analyse: { status: "fertig", version: 3, zeitraumVon: `${M1}-01`, zeitraumBis: letzter(M3), nebenkonto: false, buchungsTage: buchungen().map((x) => x.datum), pruefung: { stimmt: true }, fehler: null } };
  const v = (ausweis: any) => FA.voraussetzungenPruefen({ ausweis, auszug: auszugOk, auskunft: null, heuteIso, aktuelleVersion: 3 });
  let r = v({ vorhanden: false, urteil: null, sicht: null });
  ok(r.ausweis.stand === "fehlt" && !r.bereit && r.anforderbar.includes("ausweis") && /Vorder- und Rückseite/.test(r.ausweis.bitte ?? ""), "Ausweis fehlt → anforderbar, Satz nennt Vorder-/Rückseite und Reisepass");
  r = v({ vorhanden: true, urteil: { erkannt: true, vollstaendig: true, fehlt: [], hinweisIntern: "Ausweisdokument erkannt (Reisepass, 1 Seite)." }, sicht: null });
  ok(r.ausweis.ok && r.bereit && r.ausweis.quelle === "pruefung", "Reisepass-Datenseite (Prüfung vollständig) → bereit");
  r = v({ vorhanden: true, urteil: { erkannt: true, vollstaendig: false, fehlt: ["Rückseite des Personalausweises fehlt"] }, sicht: null });
  ok(!r.ausweis.ok && r.ausweis.stand === "mangel" && /Rückseite/.test(r.ausweis.bitte ?? ""), "Personalausweis nur Vorderseite → Rückseite anfordern");
  r = v({ vorhanden: true, urteil: { erkannt: false, vollstaendig: false, fehlt: ["Das Dokument sieht nicht wie ein Ausweisdokument aus"] }, sicht: null });
  ok(r.ausweis.stand === "mangel" && /kein Ausweisdokument/.test(r.ausweis.bitte ?? ""), "Falsche Datei als Ausweis → mangel mit Satz");
  r = v({ vorhanden: true, urteil: { erkannt: null, vollstaendig: null, pruefbar: false, fehlt: [] }, sicht: null });
  ok(r.ausweis.stand === "pruefen" && r.ausweis.bitte === null && !r.anforderbar.includes("ausweis"), "Foto ohne Textschicht → von Hand prüfen, NICHT beim Kunden anfordern");
  r = v({ vorhanden: true, urteil: { erkannt: null, vollstaendig: null, pruefbar: false, fehlt: [] }, sicht: { dokumenttyp: "personalausweis", von: "Prüfer", am: new Date().toISOString() } });
  ok(r.ausweis.ok && r.ausweis.quelle === "sicht" && /Vorder- und Rückseite/.test(r.ausweis.typ ?? ""), "Sichtprüfung durch einen Menschen → Ausweis gilt");
  r = v({ vorhanden: true, urteil: { erkannt: true, vollstaendig: true, dokumenttyp: "Aufenthaltstitel", fehlt: [] }, sicht: null });
  ok(!r.ausweis.ok && /Reisepass/.test(r.ausweis.bitte ?? ""), "Aufenthaltstitel allein gilt nicht — Reisepass anfordern");
  ok(FA.istSichtTyp("reisepass") && !FA.istSichtTyp("fuehrerschein"), "Sichtprüfung kennt nur Reisepass, Personalausweis, Aufenthaltstitel + Pass");
}

abschnitt("A2 · Voraussetzungen (Kontoauszug)");
{
  const ausweisOk: any = { vorhanden: true, urteil: { erkannt: true, vollstaendig: true, fehlt: [] }, sicht: null };
  const v = (analyse: any, vorhanden = true) => FA.voraussetzungenPruefen({ ausweis: ausweisOk, auszug: { vorhanden, analyse }, auskunft: null, heuteIso, aktuelleVersion: 3 });
  const tage = buchungen().map((x) => x.datum);
  const voll = { status: "fertig", version: 3, zeitraumVon: `${M1}-01`, zeitraumBis: letzter(M3), nebenkonto: false, buchungsTage: tage, pruefung: { stimmt: true }, fehler: null };
  let r = v(null, false);
  ok(r.kontoauszug.stand === "fehlt" && r.kontoauszug.bitte?.includes(FA.monatsName(M3)) && r.anforderbar.includes("kontoauszug"), "Kontoauszug fehlt → Bitte nennt die drei Monate");
  r = v(voll);
  ok(r.kontoauszug.ok && r.bereit && r.kontoauszug.cent === "stimmt" && r.vorbehalte.length === 0, "Drei volle Monate, Hauptkonto, Cent stimmt → bereit ohne Vorbehalt");
  r = v({ ...voll, zeitraumVon: `${M3}-01` });
  ok(!r.kontoauszug.ok && /es fehlen/.test(r.kontoauszug.satz) && r.kontoauszug.bitte?.includes(FA.monatsName(M1)) && r.kontoauszug.bitte?.includes(FA.monatsName(M2)), "Nur ein Monat → „es fehlen …“, Bitte nennt die fehlenden Monate");
  r = v({ ...voll, nebenkonto: true });
  ok(r.kontoauszug.stand === "mangel" && /Nebenkonto/.test(r.kontoauszug.satz) && /Einkommen/.test(r.kontoauszug.bitte ?? ""), "Nebenkonto → Gehaltskonto anfordern");
  r = v({ ...voll, buchungsTage: tage.filter((t) => !t.startsWith(M2)) });
  ok(r.kontoauszug.stand === "mangel" && /Lücke/.test(r.kontoauszug.satz), "Lücke (ein Monat ohne Buchung) → mangel");
  r = v({ ...voll, zeitraumVon: tagPlus(heuteIso, -200), zeitraumBis: tagPlus(heuteIso, -100), buchungsTage: [tagPlus(heuteIso, -200), tagPlus(heuteIso, -170), tagPlus(heuteIso, -140), tagPlus(heuteIso, -110), tagPlus(heuteIso, -100)] });
  ok(r.kontoauszug.stand === "mangel" && /veraltet/.test(r.kontoauszug.satz), "Auszug älter als 75 Tage → veraltet");
  r = v({ ...voll, version: 2 });
  ok(r.kontoauszug.stand === "pruefen" && r.kontoauszug.bitte === null, "Alte Auswertungsfassung → neu auswerten, nicht beim Kunden anfordern");
  r = v({ ...voll, status: "unlesbar", fehler: "Das ist eine Gehaltsabrechnung." });
  ok(r.kontoauszug.stand === "mangel" && r.anforderbar.includes("kontoauszug"), "Unlesbar → neu anfordern");
  r = v({ ...voll, pruefung: { stimmt: false, differenzCents: 9000 } });
  ok(r.kontoauszug.ok && r.vorbehalte.includes("cent") && r.kontoauszug.cent === "abweichung", "Cent weicht ab → erlaubt, aber mit Vorbehalt");
  ok(JSON.stringify(FA.fehlendeMonate(`${M1}-01`, letzter(M3), heuteIso)) === "[]", "fehlendeMonate: volle drei Monate → nichts fehlt");
  ok(FA.fehlendeMonate(`${M1}-03`, `${M2}-27`, heuteIso).join(",") === M3, "fehlendeMonate: Monatsauszüge mit Randtagen zählen, der letzte fehlt");
  ok(FA.voraussetzungenPruefen({ ausweis: ausweisOk, auszug: { vorhanden: true, analyse: voll }, auskunft: { status: "fertig" }, heuteIso, aktuelleVersion: 3 }).auskunft.ausgewertet, "Ausgewertete Auskunft fließt ein");
}

abschnitt("A3 · Art.-9-Daten werden nicht ausgewertet und nicht ausgewiesen");
{
  const m = FA.art9Maskieren(buchungen());
  ok(m.anzahl === 6, `Apotheke und Gewerkschaft in drei Monaten maskiert (${m.anzahl})`);
  ok(!m.buchungen.some((b) => /apotheke|ver\.di/i.test(`${b.empfaenger} ${b.zweck}`)), "Kein Name, kein Zweck bleibt stehen");
  ok(FA.art9Art({ empfaenger: "Erzbistum Köln", zweck: "Kirchgeld" }) === "religion" && FA.art9Art({ empfaenger: "IG Metall", zweck: "" }) === "gewerkschaft"
    && FA.art9Art({ empfaenger: "Parship", zweck: "" }) === "sexualleben" && FA.art9Art({ empfaenger: "REWE Markt", zweck: "Einkauf" }) === null
    && FA.art9Art({ empfaenger: "Gemeinde Musterstadt", zweck: "Grundsteuer" }) === null, "Muster je Kategorie, keine Fehlalarme bei Gemeinde/REWE");
  const kg = FA.art9Maskieren([{ datum: `${M3}-02`, betragCents: 150000, empfaenger: "AOK Bayern", zweck: "Krankengeld", kategorie: "sozialleistung" }]);
  ok(kg.anzahl === 1 && kg.buchungen[0].kategorie === "sozialleistung" && kg.buchungen[0].empfaenger === FA.ART9_NAME, "Krankengeld bleibt Einkommen, verliert Absender und Zweck");
  const f = FA.faktenAus(m.buchungen, { zeitraumVon: `${M1}-01`, zeitraumBis: letzter(M3) }, m.anzahl)!;
  const alles = JSON.stringify(f);
  ok(!/apotheke|ver\.di|linden/i.test(alles), "Kennzahlen, Verträge, Kostenpunkte und Tipps enthalten keinen Art.-9-Namen");
  ok(f.art9Anzahl === 6, "Die Zahl der maskierten Buchungen steht im Ergebnis (für den Hinweis im PDF)");
}

abschnitt("A4 · Kennzahlen, Ampeln, FIAON-Finanzwert");
let beispielInhalt: any = null;
{
  const m = FA.art9Maskieren(buchungen());
  const f = FA.faktenAus(m.buchungen, { zeitraumVon: `${M1}-01`, zeitraumBis: letzter(M3) }, m.anzahl)!;
  ok(f && f.zeitraum.volleMonate.length === 3, "Drei volle Monate erkannt");
  ok(Math.abs(f.einkommenJeMonatCents - 260000) < 30000, `Einkommen ≈ 2.600 € (${f.einkommenJeMonatCents})`);
  ok(f.volleMonateMitEinkommen === 3 && f.einkommenQuelle === "gehalt" && f.zahltag === 28, "Einkommen regelmäßig, Quelle Gehalt, Zahltag 28.");
  ok(f.ratenJeMonatCents > 0 && f.ratenPosten.some((n) => /klarna/i.test(n)), "Klarna als Rate erkannt");
  ok(f.vertraege.length >= 5, `Laufende Verträge erkannt (${f.vertraege.length})`);
  ok(FA.doppelteVertraege(f).some((d) => d.kategorie === "Telefon / Internet"), "Drei Telefon-/Internetverträge → Verdacht auf Doppelverträge");
  const ident = { ausweisOk: true, ausweisTyp: "Reisepass (Datenseite)", adresseImAuszug: true, inhaberImAuszug: true };
  const ampeln = FA.ampelnRechnen(f, ident, null, 250000);
  ok(ampeln.length === 7 && FA.BEREICHE.every((b) => ampeln.some((a) => a.key === b.key)), "Sieben Bereiche, je eine Ampel");
  ok(ampeln.find((a) => a.key === "einkommen")!.ampel === "gruen", "Einkommen regelmäßig ≥ 1.000 € → grün");
  ok(ampeln.find((a) => a.key === "fixkosten")!.ampel !== "gruen", "Doppelte Telefonverträge → Fixkosten höchstens gelb");
  const fw = FA.finanzwertRechnen(f, ampeln, null);
  const summe = fw.sockel + fw.kriterien.reduce((s, k) => s + k.punkte, 0);
  ok(fw.wert === summe && fw.wert >= 100 && fw.wert <= 999, `Finanzwert = Sockel + Summe der Kriterien (${fw.wert})`);
  ok(FA.GEWICHTE.reduce((s, g) => s + g.max, 0) + FA.FINANZWERT_SOCKEL === 999, "Gewichte + Sockel = 999");
  ok(fw.kriterien.find((k) => k.key === "auskunft")!.punkte === 25 && fw.kriterien.find((k) => k.key === "auskunft")!.beleg === "nicht bewertet", "Ohne Auskunft: halbe Punkte, „nicht bewertet“");
  ok(JSON.stringify(FA.finanzwertRechnen(f, ampeln, null)) === JSON.stringify(fw), "Deterministisch: gleiche Eingabe, gleicher Wert");
  const mitAuskunft = FA.finanzwertRechnen(f, ampeln, { stufe: "frei", auskunftei: "SCHUFA", vom: null, negativ: 0, offenCents: null });
  ok(mitAuskunft.wert === fw.wert + 24, "Saubere Auskunft: volle 49 statt 25 Punkte");
  ok(FA.bandFuer(999) === "sehr stabil" && FA.bandFuer(850) === "sehr stabil" && FA.bandFuer(849) === "stabil" && FA.bandFuer(700) === "stabil"
    && FA.bandFuer(550) === "tragfähig" && FA.bandFuer(549) === "angespannt" && FA.bandFuer(399) === "kritisch" && FA.bandFuer(100) === "kritisch", "Bandgrenzen 850/700/550/400");
  // Schwellen an veränderten Kennzahlen
  const mit = (x: Partial<typeof f>) => FA.ampelnRechnen({ ...f, ...x } as any, ident, null, null);
  const a = (x: Partial<typeof f>, k: string) => mit(x).find((y) => y.key === k)!.ampel;
  ok(a({ ueberschussQuote: -0.05 }, "lebenshaltung") === "rot" && a({ ueberschussQuote: 0.05, bargeldQuote: 0 }, "lebenshaltung") === "gelb" && a({ ueberschussQuote: 0.2, bargeldQuote: 0 }, "lebenshaltung") === "gruen", "Lebenshaltung: <0 rot, <10 % gelb, sonst grün");
  ok(a({ fixkostenQuote: 0.5, vertraege: [] }, "fixkosten") === "gruen" && a({ fixkostenQuote: 0.6, vertraege: [] }, "fixkosten") === "gelb" && a({ fixkostenQuote: 0.8, vertraege: [] }, "fixkosten") === "rot", "Fixkosten: 55/75 %");
  ok(a({ ratenQuote: 0.1, inkassoAnzahl: 0 }, "verbindlichkeiten") === "gruen" && a({ ratenQuote: 0.2, inkassoAnzahl: 0 }, "verbindlichkeiten") === "gelb" && a({ ratenQuote: 0.4, inkassoAnzahl: 0 }, "verbindlichkeiten") === "rot" && a({ ratenQuote: 0, inkassoAnzahl: 2 }, "verbindlichkeiten") === "rot", "Verbindlichkeiten: 15/35 %, zwei Inkasso → rot");
  ok(a({ ruecklastschriften: 2 }, "zahlungsverhalten") === "rot" && a({ ruecklastschriften: 1, mahnAnzahl: 0 }, "zahlungsverhalten") === "gelb" && a({ ruecklastschriften: 0, mahnAnzahl: 0, dispoTage: 0, tiefsterSaldoCents: 100 }, "zahlungsverhalten") === "gruen", "Zahlungsverhalten: zwei Rücklastschriften rot");
  ok(a({ pfaendungHinweis: true }, "auffaelligkeiten") === "rot" && a({ gluecksspielAnzahl: 2, gluecksspielJeMonatCents: 500, pfaendungHinweis: false, mahnAnzahl: 0, bargeldQuote: 0 }, "auffaelligkeiten") === "gelb", "Auffälligkeiten: Pfändung rot, Glücksspiel gelb");
  ok(FA.ampelnRechnen(f, { ...ident, inhaberImAuszug: false }, null, null).find((x) => x.key === "identitaet")!.ampel === "rot", "Fremder Kontoinhaber → Identität rot");
  ok(FA.ampelnRechnen(f, { ...ident, adresseImAuszug: null, ausweisTyp: "Reisepass" }, null, null).find((x) => x.key === "identitaet")!.ampel === "gelb", "Reisepass ohne Adressbeleg → gelb");
  const ff = FA.faktenAus(FA.art9Maskieren(buchungen({ ruecklast: 2, inkasso: 2, spiel: 3 })).buchungen, { zeitraumVon: `${M1}-01`, zeitraumBis: letzter(M3) })!;
  const amp2 = FA.ampelnRechnen(ff, ident, null, null);
  const fw2 = FA.finanzwertRechnen(ff, amp2, null);
  ok(fw2.wert < fw.wert && FA.gesamtAmpel(amp2, fw2.band).ampel === "rot", `Rücklastschriften + Inkasso → niedrigerer Wert (${fw2.wert}) und rote Gesamtlage`);
  ok(FA.gesamtAmpel(ampeln.map((x) => ({ ...x, ampel: "gruen" as const })), "stabil").ampel === "gruen" && FA.gesamtAmpel(ampeln, "kritisch").ampel === "rot", "Gesamtampel: grün nur stabil ohne Rot, kritisch → rot");
  // Schritte
  const schritte = FA.schritteAus(f);
  ok(schritte.some((s) => s.art === "dispo" && s.wirkung && s.wirkung.bisCents > 0), "Dispozinsen → Schritt mit Euro-Wirkung");
  ok(schritte.some((s) => s.art === "abos" && s.wirkung?.art === "ersparnis"), "Abos → Schritt „bis zu …“");
  ok(schritte.some((s) => s.art.startsWith("doppelt_")), "Doppelte Verträge → Schritt mit dem kleinsten Vertrag als Obergrenze");
  ok(schritte[schritte.length - 1].frist === "365" && schritte[0].frist === "sofort", "Sortiert: sofort zuerst, jährlich zuletzt");
  const sp = FA.sparpotenzial(schritte);
  ok(sp.bisCents >= sp.vonCents && sp.bisCents > 0, "Sparpotenzial als Spanne");
  ok(!JSON.stringify(schritte).match(/check24|verivox|tarifcheck|n26|ing\b|comdirect|dkb/i), "Keine Anbieter- oder Produktnamen in den Schritten");
  beispielInhalt = { f, ampeln, fw, schritte, sp };
}

abschnitt("A5 · Wände für Modelltexte, Freigaberegel, Kopfabgleich");
{
  ok(FA.zahlenWandFunde("Ihr Einkommen liegt bei 2.600 € im Monat.").length > 0, "Zahlenwand: Ziffer außerhalb eines Platzhalters → verworfen");
  ok(FA.zahlenWandFunde("Ihr Einkommen liegt bei {{z:einkommen}} im Monat.").length === 0, "Zahlenwand: Platzhalter erlaubt");
  ok(FA.zahlenWandFunde("{{z:geheim}} steht da").length > 0, "Zahlenwand: unbekannter Platzhalter → verworfen");
  ok(FA.platzhalterEinsetzen("Bei {{z:einkommen}} und {{z:band}}.", { einkommen: "2.600 €", band: "stabil" }) === "Bei 2.600 € und stabil.", "Platzhalter werden vom Server eingesetzt");
  ok(FA.beratungsWandFunde("Nehmen Sie einen Kredit auf, um den Dispo zu lösen.").length === 0 && FA.beratungsWandFunde("Sie sollten einen Kredit aufnehmen.").length > 0, "Beratungswand: Kreditempfehlung");
  ok(FA.beratungsWandFunde("Das ist garantiert so.").length > 0 && FA.beratungsWandFunde("Investieren Sie in einen ETF.").length > 0 && FA.beratungsWandFunde("Die Forderung ist verjährt.").length > 0, "Beratungswand: Zusage, Anlage, Rechtsrat");
  ok(FA.beratungsWandFunde("Damit bist du gut aufgestellt.").length > 0, "Beratungswand: Du-Form");
  ok(FA.beratungsWandFunde("Ihre Einnahmen kommen regelmäßig. Am Monatsende bleibt etwas übrig.").length === 0, "Neutraler Text geht durch");
  const r = (x: Partial<Parameters<typeof FA.freigabeRegel>[0]>) => FA.freigabeRegel({ gesamt: "gruen", vorbehalt: false, rolle: "agent", freigeberId: 12, erstellerId: 12, zustaendig: true, ...x });
  ok(r({}).erlaubt && !r({}).vierAugen, "Grün: der Betreuer darf selbst freigeben");
  ok(!r({ zustaendig: false }).erlaubt, "Fremder Mitarbeiter darf nicht freigeben");
  ok(!r({ gesamt: "rot" }).erlaubt && r({ gesamt: "rot" }).vierAugen, "Rot: der Betreuer darf nicht");
  ok(!r({ gesamt: "rot", rolle: "vertriebsleiter" }).erlaubt, "Rot: auch die Leitung nicht, wenn sie selbst erzeugt hat");
  ok(r({ gesamt: "rot", rolle: "vertriebsleiter", freigeberId: 10 }).erlaubt, "Rot: ein anderer Mensch der Leitung darf");
  ok(!r({ vorbehalt: true, rolle: "agent" }).erlaubt && r({ vorbehalt: true, rolle: "admin", freigeberId: 8 }).erlaubt, "Vorbehalt: Vier-Augen wie bei Rot");
  const kopf = "Sparkasse Berlin Kontoauszug 3/2026 Frau Erika Müller-Lüdenscheidt Teststraße 12 10115 Berlin IBAN DE12 1005 0000 0000 0000 00 Alter Saldo 500,00";
  ok(JSON.stringify(FA.kopfAbgleich(kopf, { nachname: "Müller-Lüdenscheidt", strasse: "Teststraße 12", plz: "10115" })) === '{"inhaber":true,"adresse":true}', "Kopf: Doppelname mit Umlaut und Anschrift gefunden");
  ok(FA.kopfAbgleich(kopf.replace(/Müller/g, "Mueller"), { nachname: "Müller", strasse: "Teststraße", plz: "10115" }).inhaber === true, "Kopf: „Mueller“ = „Müller“");
  ok(FA.kopfAbgleich(kopf, { nachname: "Schmidt", strasse: "Hauptweg 1", plz: "80331" }).inhaber === false, "Kopf: fremder Name → false");
  ok(FA.kopfAbgleich("kurz", { nachname: "Müller" }).inhaber === null, "Kopf ohne Textschicht → nicht prüfbar (null)");
  ok(FA.auswertungNummer(4711, 2) === "FA-4711-2", "Fassungsnummer FA-<Person>-<Fassung>");
}

abschnitt("A6 · Texte: Wortwand, Kennzeichnung, nie „kostenlos“");
{
  ok(/kein SCHUFA-Score/.test(FA.FINANZWERT_KENNZEICHNUNG) && /keine Kredit- oder Kartenzusage/.test(FA.FINANZWERT_KENNZEICHNUNG) && /Art\. 22 DSGVO/.test(FA.FINANZWERT_KENNZEICHNUNG), "Kennzeichnung des Finanzwerts vollständig");
  ok(!/§ 31 BDSG/.test(FA.FINANZWERT_KENNZEICHNUNG), "Nachprüfung: kein falscher Normverweis § 31 BDSG mehr");
  ok(/34c, 34d, 34f, 34i GewO/.test(FA.HAFTUNG_ABSAETZE.join(" ")) && /Rechtsdienstleistungsgesetz/.test(FA.HAFTUNG_ABSAETZE.join(" ")), "Haftungsabsätze: GewO und RDG");
  ok(/Art\. 9 DSGVO/.test(FA.DATENSCHUTZ_ABSATZ) && /KI-Dienstleister/.test(FA.DATENSCHUTZ_ABSATZ) && /Art\. 28 DSGVO/.test(FA.DATENSCHUTZ_ABSATZ) && /Name, Anschrift und Kontonummer/.test(FA.DATENSCHUTZ_ABSATZ),
    "Nachprüfung: Datenschutzhinweis sagt ehrlich, dass der ganze Auszug (mit Kopf) an den KI-Dienstleister geht");
  ok(!/Ausweisbilder gehen an kein Modell/.test(FA.DATENSCHUTZ_ABSATZ) && !/An das Sprachmodell geht nur/.test(FA.DATENSCHUTZ_ABSATZ), "Nachprüfung: keine unzutreffende Zusage zu Modell und Ausweis im Kunden-PDF");
  ok(/unkenntlich/.test(FA.ART9_HINWEIS) && !/werten wir nicht einzeln aus/.test(FA.ART9_HINWEIS), "Nachprüfung: Art.-9-Hinweis — erst gelesen, dann unkenntlich gemacht");
  const { schufaRequestedSaetze } = await import("../server/mail/vorlagen/auskunft-lead");
  const dk = schufaRequestedSaetze("einkauf", { art: "privat", datenkopie: true, rueckstand: true });
  const dkText = Object.values(dk).join(" ");
  ok(/Datenkopie nach Art\. 15 DSGVO/.test(dkText) && /Zahlung für die Bonitätsauskunft ist bei uns eingegangen/.test(dkText), "Datenkopie-Mail: Art. 15 und Entschuldigung beim Rückstand");
  ok(!/kostenlos|kostenfrei|gratis|umsonst|kostenpflichtig/i.test(dkText), "Datenkopie-Mail: kein „kostenlos“, kein „kostenpflichtig“");
  ok(/per Post an Ihre Anschrift/.test(dk.danach_satz) && /hoch/.test(dk.danach_satz) && !/liegt dann in Ihrem Bereich/.test(dk.danach_satz), "Nachprüfung: Datenkopie-Mail nennt den Postweg und bittet um den Upload");
  const kauf = lies("server/routes/fiaon-auskunft-kauf.ts");
  ok(/a\.modus === "datenkopie"/.test(kauf.slice(kauf.indexOf("function danachSatz"), kauf.indexOf("function danachSatz") + 900)) && /per Post an Ihre Anschrift/.test(kauf), "Nachprüfung: Bestätigungsseite im Datenkopie-Weg ebenso ehrlich");
  ok(!/kostenlos/i.test(AK.RUECKSTAND_MAIL_SATZ), "Rückstand-Satz ohne „kostenlos“");
  const vorlage = (await import("../server/mail/vorlagen/finanzauswertung")).FINANZAUSWERTUNG_VORLAGEN.finanzauswertung_bereit;
  const mailText = [vorlage.betreff, vorlage.preheader, vorlage.titel, ...vorlage.absaetze, vorlage.fussnote].join(" ");
  ok(!/\{\{params\.(finanzwert|wert|band|gesamt)\}\}/.test(mailText) && !/\d{3}/.test(mailText), "Mail „Auswertung bereit“: keine Zahl, kein Wert");
  ok(/nicht als Anhang/.test(mailText), "Mail sagt, warum kein Anhang");
  const texte: [string, string][] = [
    ["Kennzeichnung", FA.FINANZWERT_KENNZEICHNUNG], ["Kurz", FA.FINANZWERT_KURZ], ["Datenschutz", FA.DATENSCHUTZ_ABSATZ],
    ...FA.HAFTUNG_ABSAETZE.map((t, i): [string, string] => [`Haftung ${i + 1}`, t]),
    ...FA.VERGLEICHSWEGE.map((v): [string, string] => [`Vergleichsweg ${v.titel}`, `${v.titel}. ${v.text}`]),
    ...Object.entries(FA.VORBEHALT_TEXTE).map(([k, t]): [string, string] => [`Vorbehalt ${k}`, t]),
    ...[...beispielInhalt.schritte, ...FA.schritteAus(FA.faktenAus(FA.art9Maskieren(buchungen({ ruecklast: 2, inkasso: 2, spiel: 3, mitDispo: true, gehalt: 90000 })).buchungen, {})!)]
      .flatMap((s: any): [string, string][] => [[`Schritt ${s.titel}`, `${s.titel}. ${s.warum} ${s.wie.join(" ")}`]]),
    ["Rückstand", AK.RUECKSTAND_MAIL_SATZ], ["Datenkopie-Mail", dkText], ["Mail bereit", mailText],
    ["Upload-Satz", UA.uploadSatz(new Date())], ["Upload-Satz zweiter Knopf", UA.uploadSatz(new Date(), "Unterlagen hochladen")], ["WhatsApp", UA.whatsappText("Erika", ["Ihre Kontoauszüge für August"], "https://www.fiaon.com/unterlagen/1.2.x")],
    ...Object.values(UA.LINK_ART_TEXT).map((x): [string, string] => [`Anleitung ${x.titel}`, x.anleitung]),
    ["Einordnung", FA.einordnungRegel(beispielInhalt.ampeln, beispielInhalt.fw, { ampel: "gelb" }).zusammenfassung],
  ];
  for (const [n, t] of texte) {
    const funde = wandPruefen(t).filter((x) => x.art === "verboten");
    ok(funde.length === 0, `Wortwand „${n}“${funde.length ? `: ${funde.map((x) => x.treffer).join(", ")}` : ""}`);
    ok(!/\b(du|dein|deine|dir|dich)\b/.test(t), `Sie-Form „${n}“`);
  }
  // WhatsApp-Wand (Inkasso-Verdacht, Du-Form, Länge) — derselbe Weg wie waSenden
  const { sendePruefung } = await import("../server/lib/fiaon-whatsapp");
  const wa = UA.whatsappText("Erika", ["Ihre Kontoauszüge für August und September", "die Rückseite Ihres Personalausweises"], "https://www.fiaon.com/unterlagen/12.1760000000.abcdefghijklmnopqrstuvwxyzABCDEF");
  ok(sendePruefung(wa, { namen: ["Erika"] }).length === 0, `WhatsApp-Text besteht die Sendewand (${sendePruefung(wa, { namen: ["Erika"] }).join(" · ")})`);
}

abschnitt("A7 · 4a: Stufensätze der Akte, Wache, Werktage, Haken");
{
  const basis = { preisText: "74 €", mitAbo: true, wort: "SCHUFA-Auskunft", offen: null };
  const b = (x: any = {}) => ({ id: 7, status: "offen", seit: `${tagPlus(heuteIso, -9)}T08:00:00Z`, faelligAb: tagPlus(heuteIso, -9), modus: "einkauf", einwilligung: false, linkAm: null, bezahltAm: `${tagPlus(heuteIso, -60)}T10:00:00Z`, bearbeiter: null, notiz: null, ...x });
  let s = AK.auskunftStufenSatz({ ...basis, stufe: "bezahlt", beschaffung: b() } as any, heuteIso)!;
  ok(/^Bezahlt am/.test(s) && /wartet auf die Auftragsbestätigung/.test(s) && /Link noch nicht gesendet/.test(s) && !/lädt/.test(s), "Bezahlt ohne Einwilligung → „wartet auf die Auftragsbestätigung“, nie „Kunde lädt hoch“");
  s = AK.auskunftStufenSatz({ ...basis, stufe: "bezahlt", beschaffung: b({ einwilligung: true, modus: "datenkopie" }) } as any, heuteIso)!;
  ok(/Beschaffung offen seit/.test(s) && /Datenkopie/.test(s), "Bezahlt mit Einwilligung (Datenkopie) → „Beschaffung offen seit …“");
  s = AK.auskunftStufenSatz({ ...basis, stufe: "bezahlt", beschaffung: b({ einwilligung: true, faelligAb: tagPlus(heuteIso, 5) }) } as any, heuteIso)!;
  ok(/Widerrufsfrist/.test(s), "Fällig erst später → Widerrufsfrist genannt");
  s = AK.auskunftStufenSatz({ ...basis, stufe: "bezahlt", beschaffung: b({ status: "problem", notiz: "Kunde hat eigene Auskunft hochgeladen – Leistung klären" }) } as any, heuteIso)!;
  ok(/Problem: Kunde hat eigene Auskunft hochgeladen/.test(s), "Problem mit Notiz");
  ok(/noch kein Beschaffungsauftrag/.test(AK.auskunftStufenSatz({ ...basis, stufe: "bezahlt", beschaffung: null } as any)!), "Bezahlt ohne Auftrag ehrlich benannt");
  ok(/Zahlung gemeldet/.test(AK.auskunftStufenSatz({ ...basis, stufe: "offen", offen: { betragText: "74 €", gemeldet: true } } as any)!), "Zahlung gemeldet");
  ok(/^Nicht bestellt/.test(AK.auskunftStufenSatz({ ...basis, stufe: "nichts", angebot: true } as any)!), "Nicht bestellt → eigener Upload oder Angebot");
  ok(!/kostenlos/i.test(JSON.stringify(AK)), "Kein „kostenlos“ in den Stufensätzen");
  ok(AK.werktageZwischen("2026-10-02", "2026-10-07") === 3 && AK.werktageZwischen("2026-10-07", "2026-10-07") === 0 && AK.werktageZwischen("2026-10-09", "2026-10-12") === 1, "Werktage zählen Mo–Fr, ohne Starttag");
  const w = (x: any) => AK.wacheStufe({ status: "offen", einwilligung: true, faelligAb: "2026-10-01", linkAm: null, bezahlt: true, dokumentDa: false, ...x }, "2026-10-08");
  ok(w({}) === "aufgabe", "Einwilligung, fällig seit 5 Werktagen → Aufgabe");
  ok(w({ faelligAb: "2026-09-22" }) === "dringend", "Seit 12 Werktagen → dringend");
  ok(w({ faelligAb: "2026-10-07" }) === "keine", "Seit einem Werktag → nichts");
  ok(w({ einwilligung: false, linkAm: "2026-10-01T09:00:00Z" }) === "anruf", "Link seit 5 Werktagen unbestätigt → Anruf");
  ok(w({ einwilligung: false, linkAm: null, angelegtAm: "2026-10-07T08:00:00Z" }) === "keine", "Ohne Link, erst seit einem Werktag angelegt → noch nichts");
  // Nachprüfung 08.10.: bezahlt, keine Einwilligung, Link NIE zugestellt (Rückstand vom 29.09.) → eigene Stufe an die Verantwortung.
  ok(w({ einwilligung: false, linkAm: null, angelegtAm: "2026-09-29T08:00:00Z" }) === "link_fehlt", "Nachprüfung: Link nie zugestellt, seit 7 Werktagen → „link_fehlt“");
  ok(w({ einwilligung: false, linkAm: null }) === "link_fehlt", "Nachprüfung: ohne Anlagedatum zählt die Fälligkeit");
  ok(w({ einwilligung: false, linkAm: null, angelegtAm: "2026-09-29T08:00:00Z", bezahlt: false }) === "keine", "Nicht bezahlt → auch „Link fehlt“ nicht");
  // Nachprüfung 08.10.: Berliner Tag statt UTC — Link um 01:30 Uhr Berlin (Di) zählte als Montag.
  ok(AK.berlinTag("2026-10-05T23:30:00Z") === "2026-10-06" && AK.berlinTag("2026-10-06") === "2026-10-06", "Nachprüfung: berlinTag rechnet in Berliner Zeit");
  ok(w({ einwilligung: false, linkAm: "2026-10-05T23:30:00Z" }) === "keine", "Nachprüfung: Link Di 01:30 Berlin → am Do erst 2 Werktage, noch kein Anruf");
  ok(/heuteIso \?\? berlinTag\(new Date\(\)\)/.test(lies("shared/fiaon-auskunft-akte.ts")), "Nachprüfung: „heute“ in der Akte ist der Berliner Tag");
  ok(w({ dokumentDa: true }) === "keine" && w({ bezahlt: false }) === "keine" && w({ status: "problem" }) === "keine", "Dokument da, nicht bezahlt, Problem → keine Wache");
  ok(AK.EINWILLIGUNG_DATENUEBERMITTLUNG === "Einwilligung Datenübermittlung" && /KEINE Bestellung/.test(AK.EINWILLIGUNG_DATENUEBERMITTLUNG_HINWEIS), "Haken heißt „Einwilligung Datenübermittlung“");
  const pipe = lies("client/src/pages/agent/pipeline.tsx");
  ok(!/\["Bonitätsauskunft", antrag\.zustimmungen\?\.schufa\]/.test(pipe) && /EINWILLIGUNG_DATENUEBERMITTLUNG, antrag\.zustimmungen\?\.schufa/.test(pipe), "Akte: der Haken ist umbenannt");
  ok(/auskunftStufenSatz\(doku\.auskunft\)/.test(pipe) && /<FinanzauswertungAkte personId=\{k\.personId\}/.test(pipe), "Akte: Kachel mit Stufensatz, Block der Auswertung eingebunden");
  ok(/EINWILLIGUNG_DATENUEBERMITTLUNG/.test(lies("client/src/components/admin/AdminAppDetail.tsx")), "Betreiber-Ansicht: dasselbe Wort");
  ok(/auskunftStufenSatz/.test(lies("client/src/components/DokumenteSektion.tsx")) && !/Bezahlt — wir holen die Auskunft ein\./.test(lies("client/src/components/DokumenteSektion.tsx")), "Betreiber-Akte liest die Sätze aus der einen Quelle");
  const lief = lies("server/lib/fiaon-auskunft-lieferung.ts");
  ok(!/function auskunftLieferfaehig|auskunftLieferfaehig\(/.test(lief) && !/auskunftLieferfaehig/.test(lies("server/lib/fiaon-auskunft.ts")), "Keine Verkaufsbremse (Justin: weiter verkaufen)");
  // Integration E-IT-C × E-IT-D (08.10.2026): /upload-kyc und der Akte-Upload laufen jetzt durch unterlageHinzufuegen
  // (fiaon-unterlagen.ts) — dort steht der Aufruf EINMAL für alle Wege (auch Kundenbereich und Verwaltung).
  {
    const ablage = lies("server/lib/fiaon-unterlagen.ts");
    const hinzu = ablage.slice(ablage.indexOf("export async function unterlageHinzufuegen"));
    ok(/beschaffungBeiEigenemUpload\(/.test(hinzu) && /unterlageHinzufuegen\(/.test(lies("server/routes/fiaon-antrag.ts")) && /unterlageHinzufuegen\(/.test(lies("server/routes/fiaon-telefonie.ts")) && /beschaffungBeiEigenemUpload\(/.test(lies("server/lib/fiaon-unterlagen-link.ts")), "Alle Upload-Wege melden eine eigene Auskunft an die Beschaffung (Ablage + Upload-Link)");
  }
  ok(/auskunft_liegezeit_wache/.test(lies("server/routes.ts")) && /auskunft_liegezeit_wache/.test(lies("server/lib/fiaon-crons.ts")), "Wache als Takt registriert und in der Lauf-Ampel");
}

abschnitt("A8 · 4c: Drossel, Token, Masken, Wege");
{
  const jetzt = new Date("2026-10-08T12:00:00Z"), tag = new Date("2026-10-07T22:00:00Z");
  ok(UA.anfrageDrossel([], jetzt, tag).erlaubt, "Ohne Anfrage: erlaubt");
  ok(!UA.anfrageDrossel([new Date(jetzt.getTime() - 5 * 60_000)], jetzt, tag).erlaubt, "Vor 5 Minuten: gesperrt (15 Minuten Abstand)");
  ok(UA.anfrageDrossel([new Date(jetzt.getTime() - 20 * 60_000)], jetzt, tag).erlaubt, "Vor 20 Minuten: erlaubt");
  ok(!UA.anfrageDrossel([1, 2, 3].map((h) => new Date(jetzt.getTime() - h * 3_600_000)), jetzt, tag).erlaubt, "Drei heute: gesperrt");
  ok(UA.anfrageDrossel([1, 2, 3].map((h) => new Date(tag.getTime() - h * 3_600_000)), jetzt, tag).erlaubt, "Drei gestern: erlaubt");
  ok(UA.LINK_GUELTIG_TAGE === 14 && UA.LINK_DATEI_MAX_MB === 50 && UA.LINK_DATEIEN_JE_ART === 20, "14 Tage, 50 MB je Datei, 20 Dateien je Art");
  const L = await import("../server/lib/fiaon-unterlagen-link");
  const t = L.linkToken(42, new Date("2026-10-22T10:00:00Z"), ["kontoauszug", "ausweis"]);
  ok(t === L.linkToken(42, new Date("2026-10-22T10:00:00Z"), ["ausweis", "kontoauszug"]), "Token: Reihenfolge der Arten egal, derselbe Link entsteht neu");
  ok(L.tokenZerlegen(t)?.id === 42 && L.tokenZerlegen(`${t}x`) === null && L.tokenZerlegen("../../etc") === null, "Token: zerlegbar, kaputte Formen abgewiesen");
  ok(t !== L.linkToken(42, new Date("2026-10-22T10:00:00Z"), ["kontoauszug"]), "Token: andere Arten → andere Signatur");
  const { payloadSchwaerzen } = await import("../server/lib/fiaon-mail-log");
  ok(payloadSchwaerzen({ knopf_url: `https://www.fiaon.com/unterlagen/${t}` }).knopf_url === "[verborgen]", "Mail-Protokoll verbirgt den Upload-Link");
  ok(/\/unterlagen\\\/\\d\+\\\.\\d\+\\\./.test(lies("server/index.ts")) || /unterlagen\/…/.test(lies("server/index.ts")), "Zugriffslog verbirgt das Token");
  ok(/\{\{params\.upload_satz\}\}/.test(lies("server/mail/vorlagen/konto.ts")), "Unterlagen-Mail: Satz zum Hochladen kommt vom Auslöser");
  const tel = lies("server/routes/fiaon-telefonie.ts");
  ok(/linkFuerAnfrage\(personId/.test(tel) && /upLink \? upLink\.url : absoluteUrl\("\/login"\)/.test(tel), "Betreiber-Knopf „Anfordern“ führt auf denselben Upload-Link statt /login");
  ok(/<Route path="\/unterlagen\/:token" component=\{UnterlagenLinkPage\} \/>/.test(lies("client/src/App.tsx")), "Seite /unterlagen/:token ist verdrahtet");
  const r = lies("server/routes/fiaon-finanzauswertung.ts");
  ok(/router\.post\("\/unterlagen\/:token\/hochladen", linkZutritt/.test(r) && r.indexOf("linkLesen(String(req.params.token))") < r.indexOf("multer({"), "Zutritt wird geprüft, BEVOR multer den Körper liest");
  // fensterDrossel gibt true zurück, wenn es ZU VIEL ist — ein „!" davor sperrte jeden ersten Aufruf (gefunden im Server-Rauchtest).
  ok(!/if \(!(leseJeIp|uploadJeIp|uploadJeLink|neuJeLink)\(/.test(r) && /if \(leseJeIp\(/.test(r), "Drosseln richtig herum (true = zu viel)");
  const { fensterDrossel } = await import("../server/lib/fiaon-global-bereich-regeln");
  const d = fensterDrossel(2, 60_000);
  ok(d("x", 1) === false && d("x", 2) === false && d("x", 3) === true, "fensterDrossel: die dritte im Fenster ist zu viel");
}

abschnitt("A8b · Gegenprüfung 08.10.: Speicher, Widerruf, Doppelte, Freigabe");
{
  ok(UA.LINK_ANFRAGE_MAX_MB === 120 && UA.LINK_UPLOADS_GLEICHZEITIG === 4 && UA.LINK_UNTERLAGE_MAX_MB === 150, "Obergrenzen: 120 MB je Anfrage, 4 Uploads zugleich, 150 MB je Unterlage");
  const r = lies("server/routes/fiaon-finanzauswertung.ts");
  const zut = r.slice(r.indexOf("async function linkZutritt"), r.indexOf("router.post(\"/unterlagen/:token/hochladen\""));
  ok(/content-length/.test(zut) && zut.indexOf("ANFRAGE_MAX_BYTES") < zut.indexOf("multer({") && /status\(413\)/.test(zut), "Upload: Content-Length vor multer geprüft (413)");
  ok(/req\.on\("data"/.test(zut) && /req\.destroy\(\)/.test(zut) && zut.indexOf('req.on("data"') < zut.indexOf("multer({"), "Upload: Zähler im Strom bricht über der Grenze ab");
  ok(/uploadsLaufend >= LINK_UPLOADS_GLEICHZEITIG/.test(zut) && /res\.on\("close"/.test(zut), "Upload: höchstens vier zugleich, Zähler wird beim Schließen frei");
  const neu = r.slice(r.indexOf('router.post("/unterlagen/:token/neu"'));
  ok(/l\.grund !== "abgelaufen"/.test(neu) && neu.indexOf('l.grund !== "abgelaufen"') < neu.indexOf("unterlagenAnfrageSenden("), "/neu: nur ein ABGELAUFENER Link bringt einen neuen (widerrufen → 410)");
  ok(/zurueckgezogen/.test(r) && /\^ersetzt durch/.test(r), "Widerruf von Hand: eigener Satz statt „Sie haben einen neueren bekommen“");
  const lk = lies("server/lib/fiaon-unterlagen-link.ts");
  const lfa = lk.slice(lk.indexOf("export async function linkFuerAnfrage"), lk.indexOf("export async function vorgaengerWiderrufen"));
  ok(!/widerrufen_am = NOW\(\)/.test(lfa), "linkFuerAnfrage widerruft nichts mehr (erst nach Zustellung)");
  ok(/if \(gesendet\) \{\s*await vorgaengerWiderrufen\(/.test(lk), "Akte: Vorgänger erst nach erfolgreichem Versand widerrufen");
  const tel = lies("server/routes/fiaon-telefonie.ts");
  ok(/if \(erg\.ok && upLink\) \{[\s\S]{0,200}vorgaengerWiderrufen\(personId, upLink\.link\.id\)/.test(tel), "Betreiber-Knopf: Vorgänger erst nach erfolgreicher Mail widerrufen");
  const c = lies("client/src/pages/unterlagen-link.tsx");
  ok(/for \(const e of j\.ergebnisse\) if \(e\?\.ok\) delete n\[e\.art\]/.test(c), "Seite: nach Teilfehler nur die angenommenen Arten aus der Auswahl nehmen");
  ok(/maxGesamtMb \* 1024 \* 1024/.test(c), "Seite: Gesamtgröße vor dem Senden geprüft");
  const fl = lies("server/lib/fiaon-finanzauswertung.ts");
  ok(/WHERE id = \$\{id\} AND status = 'entwurf' RETURNING id/.test(fl) && /pg_advisory_xact_lock/.test(fl), "Freigabe: Sperre je Person + nur „entwurf“ → „freigegeben“");
  ok(/fiaon_finanzauswertungen_eine_frei_idx/.test(fl) && /fiaon_finanzauswertungen_eine_frei_idx/.test(lies("db/migrations/100_finanzauswertung_unterlagen_link.sql")), "Teilindex „eine Freigabe je Person“ (Migration + ensure)");
  ok(/fiaon_unterlagen_teile/.test(lies("db/migrations/100_finanzauswertung_unterlagen_link.sql")) && /fiaon_unterlagen_teile/.test(lk), "Tabelle fiaon_unterlagen_teile (Migration + ensure)");
  // Doppelt gelesene Buchungen (überlappende Auszüge)
  const { doppelteBuchungenEntfernen } = await import("../server/lib/fiaon-kontoauszug-analyse");
  const bu = (datum: string, betragCents: number, saldo: number | null, zweck = "Miete") => ({ datum, betragCents, empfaenger: "X", zweck, kategorie: "miete", wiederkehrend: false, saldoDanachCents: saldo });
  const juli = [bu("2026-07-01", -80000, 120000), bu("2026-07-15", 260000, 380000, "Gehalt")];
  const aug = [bu("2026-08-01", -80000, 300000), bu("2026-08-15", 260000, 560000, "Gehalt")];
  const sep = [bu("2026-09-01", -80000, 480000), bu("2026-09-15", 260000, 740000, "Gehalt")];
  const d1 = doppelteBuchungenEntfernen([...juli, ...aug, ...juli, ...aug, ...sep]);
  ok(d1.entfernt === 4 && d1.buchungen.length === 6, `Quartalsauszug über Juli/August angehängt: 4 Doppelte entfernt (${d1.entfernt})`);
  const d2 = doppelteBuchungenEntfernen([bu("2026-08-03", -1000, null, "Bäcker"), bu("2026-08-03", -1000, null, "Bäcker")]);
  ok(d2.entfernt === 0, "Ohne gedruckten Saldo: zwei gleiche Käufe bleiben beide");
  const d3 = doppelteBuchungenEntfernen([bu("2026-08-03", -5000, 10000, "Lastschrift A"), bu("2026-08-03", 5000, 15000, "Rücklastschrift"), bu("2026-08-03", -5000, 10000, "Lastschrift B")]);
  ok(d3.entfernt === 0, "Gleicher Saldo, anderer Zweck: bleibt");
}

abschnitt("A8c · Nachprüfung 08.10.: Freigabe, Löschung, Merge, Wache, Texte");
{
  const r = (x: Partial<Parameters<typeof FA.freigabeRegel>[0]>) => FA.freigabeRegel({ gesamt: "gruen", vorbehalt: false, rolle: "agent", freigeberId: 12, erstellerId: 12, zustaendig: true, ...x });
  ok(!r({ rolle: "inkasso" }).erlaubt, "Freigabe: Inkasso gibt nie frei (Pflichtmail kennt die Rolle nicht)");
  const route = lies("server/routes/fiaon-finanzauswertung.ts");
  ok(!/zustaendig: true/.test(route) && /const zustaendig = await istBetreuer\(req\.agent!\.id, z\.personId\)/.test(route) && /assigned_agent_id = \$\{agentId\}/.test(route) && /vertreterDarfAnKunde/.test(route),
    "Freigabe: „zuständig“ = zugewiesener Betreuer oder Vertretung — nicht jeder mit Aktenzugang (Pool, Termin, Inkasso)");
  ok((route.match(/gehoertZu\(/g) ?? []).length >= 5, "Fassung ↔ Akte über die zusammengeführte Person (Akte und Kunde)");
  const fl = lies("server/lib/fiaon-finanzauswertung.ts");
  const fg = fl.slice(fl.indexOf("export async function freigeben"), fl.indexOf("export async function verwerfen"));
  ok(/eingabenHash\(eJetzt\)/.test(fg) && fg.indexOf("eingabenHash(eJetzt)") < fg.indexOf("lauf.begin("), "Freigabe: veralteter Entwurf wird abgelehnt (vor der Sperre)");
  const akte = lies("client/src/components/finanzen/FinanzauswertungAkte.tsx");
  ok(/\|\| !!d\.veraltet/.test(akte), "Akte: „An den Kunden übergeben“ ist bei veraltetem Entwurf aus");
  ok(/Link zurückziehen/.test(akte) && /unterlagen-link\/widerrufen/.test(akte) && /links: \{ id: number/.test(fl), "Akte: aktiver Upload-Link sichtbar, Knopf „Link zurückziehen“");
  ok(/AND art <> 'finanzauswertung'/.test(lies("server/routes/fiaon-app.ts")), "Kunde: Auswertungs-PDFs nicht über die allgemeine Dokument-Route (Entwürfe, verworfene)");
  const loe = lies("server/lib/fiaon-loeschen.ts");
  ok((loe.match(/personDatenLoeschen\(/g) ?? []).length === 2 && /personDatenLoeschen\(id, \{\}\)/.test(lies("server/routes/fiaon-vertrieb.ts")), "DSGVO: beide Löschwege und die Kunden-Löschung leeren Auswertung, Links, Anfragen");
  ok(/demo=\{DEMO\}/.test(lies("client/src/pages/mein-bereich.tsx")), "Demo-Kundenbereich: Demo-Hinweis statt Fehlermeldung");
  // Nachprüfung 08.10. (Fund „Sichtprüfung ohne Rücknahme“): Route, Knopf und Rundgang.
  ok(/ausweis-sichtpruefung\/zuruecknehmen/.test(route) && /sichtpruefungZuruecknehmen\(z\.personId, req\.body\?\.grund/.test(route)
    && /Bestätigung zurücknehmen/.test(akte) && /ausweis-sichtpruefung\/zuruecknehmen/.test(akte) && /quelle === "sicht"/.test(akte)
    && /Bestätigung zurücknehmen/.test(lies("client/src/pages/agent/rundgaenge.ts")),
    "Sichtprüfung: „Bestätigung zurücknehmen“ — Route, Knopf (nur bei Bestätigung von Hand) und Rundgang");
  const pdfQ = lies("server/lib/fiaon-finanzauswertung-pdf.ts");
  ok(!/Auf Wunsch fordern wir sie für Sie an/.test(pdfQ) && /neue Fassung dieser Auswertung/.test(pdfQ), "PDF Kapitel 7: kein Angebot ohne Preis, nur der Upload-Hinweis");
  const lk = lies("server/lib/fiaon-unterlagen-link.ts");
  ok(/const \[kopf\] = await personFamilie\(link\.personId, lauf\)/.test(lk), "Upload-Link nach Zusammenführung: gilt für den Kopf der Person");
  ok(/person_id = ANY\(\$\{await import\("\.\/fiaon-unterlagen-link"\)/.test(lies("server/lib/fiaon-auskunft-lieferung.ts")), "Akte: Beschaffungsauftrag einer zusammengeführten Dublette wird gefunden");
  const lief = lies("server/lib/fiaon-auskunft-lieferung.ts");
  ok(/let sammelLaeuft = false/.test(lief) && /pg_try_advisory_lock\(hashtext\('fiaon_auskunft_sammelknopf'\)\)/.test(lief), "Sammelknopf: Sperre im Prozess und in Postgres (kein doppelter Versand)");
  ok(/wacheAufgabenSchliessen\(a\.id, \[wacheSchluessel\(a\.id\)\.anruf, wacheSchluessel\(a\.id\)\.link_fehlt\]/.test(lies("server/routes/fiaon-auskunft-kauf.ts")), "Bestätigung durch den Kunden schließt Anruf- und „Link fehlt“-Aufgabe");
  ok(/await wacheAufgabenSchliessen\(id, \[k\.anruf, k\.aufgabe, k\.dringend, k\.link_fehlt, k\.datenkopie_da\], ergebnis, lauf\)/.test(lief) && /beschaffungsAufgabeSchliessen\(ref, "Auskunft beschafft, in der Akte, Kunde benachrichtigt\.", lauf, id\)/.test(lief),
    "Fertig/Abschließen schließt auch Liegezeit-, Anruf-, „Link fehlt“- und Datenkopie-Aufgaben");
  ok(!/k\.eigene/.test(lief.slice(lief.indexOf("async function beschaffungsAufgabeSchliessen"), lief.indexOf("export function wacheSchluessel"))), "Heikles bleibt: „Leistung klären (Erstattung)“ schließt nie automatisch");
  ok(/über den Knopf „Unterlagen hochladen“ weiter unten/i.test(UA.uploadSatz(new Date(), "Unterlagen hochladen")) && /hauptweg \? \(arten\.length > 1/.test(lies("server/routes/fiaon-telefonie.ts")),
    "Betreiber-Mail mit Angebot: der Upload-Satz zeigt auf den zweiten Knopf");
  // Ampel Identität und Auskunft-Kriterium (offline mit dem Beispiel aus A4)
  const { f } = beispielInhalt;
  const idAmpel = (adresse: boolean | null) => FA.ampelnRechnen(f, { ausweisOk: true, ausweisTyp: "Personalausweis", adresseImAuszug: adresse, inhaberImAuszug: true }, null, null).find((x) => x.key === "identitaet")!.ampel;
  ok(idAmpel(false) === "gelb" && idAmpel(null) === "gruen" && idAmpel(true) === "gruen", "Nachprüfung: Personalausweis + abweichende Anschrift im Auszug → gelb, nicht „Anschrift belegt“");
  const krit = (n: number) => FA.finanzwertRechnen(f, beispielInhalt.ampeln, { stufe: "aufraeumen", auskunftei: "SCHUFA", vom: null, negativ: n, offenCents: null }).kriterien.find((x) => x.key === "auskunft")!.grund;
  ok(krit(1) === "Laut Ihrer Auskunft 1 belastender Eintrag." && krit(3) === "Laut Ihrer Auskunft 3 belastende Einträge." && !/Eintrag\/Einträge/.test(krit(0)), `Nachprüfung: Einzahl/Mehrzahl im Auskunft-Kriterium (${krit(1)} | ${krit(0)})`);
}

abschnitt("A8d · Querprüfung 08.10.: Löschung, Wache, Arten, Texte, Datenschutz");
{
  // Fund 1/9 (hoch): endgültige Löschung nimmt Dateien, Akte und Vorgänge der Familie mit.
  const loe = lies("server/lib/fiaon-loeschen.ts");
  const eg = loe.slice(loe.indexOf("async function endgueltigLoeschen"), loe.indexOf("async function anonymisieren"));
  ok(/personFamilie\(k\.personId, lauf\)/.test(eg) && /personDatenLoeschen\(familie, \{ endgueltig: true \}, lauf\)/.test(eg) && /kundenbereichZeilenLoeschen\(familie, k\.refs, lauf\)/.test(eg)
    && eg.indexOf("kundenbereichZeilenLoeschen(familie") < eg.indexOf("DELETE FROM fiaon_applications"),
    "Querprüfung: endgueltigLoeschen — Familie (personFamilie), Finanzdaten der Familie, Kundenbereich-Zeilen VOR den Bestellungen");
  ok(/DELETE FROM fiaon_dokumente WHERE person_id = ANY\(\$\{familie\}\) OR ref = ANY/.test(loe) && /DELETE FROM fiaon_unterlagen_akte WHERE person_id = ANY\(\$\{familie\}\)/.test(loe)
    && /DELETE FROM fiaon_vorgaenge WHERE person_id = ANY\(\$\{familie\}\)/.test(loe) && /UPDATE fiaon_dokumente SET inhalt = '\\\\x'::bytea[\s\S]{0,200}person_id = ANY\(\$\{familie\}\)/.test(loe),
    "Querprüfung: Dokumente (erst leeren, dann löschen), Akte je Kategorie, Vorgänge — auch die der Dubletten");
  const fl = lies("server/lib/fiaon-finanzauswertung.ts");
  ok(/personDatenLoeschen\(personIdOderFamilie: number \| number\[\]/.test(fl) && (fl.match(/WHERE person_id = ANY\(\$\{personId\}\)/g) ?? []).length === 8, "Querprüfung: personDatenLoeschen nimmt die Familie (alle acht Anweisungen)");
  // Fund 8: Wache über den einen Weg.
  const lief = lies("server/lib/fiaon-auskunft-lieferung.ts");
  const wache = lief.slice(lief.indexOf("export async function wacheAufgabenSchliessen"), lief.indexOf("export async function wacheAufgabenSchliessen") + 2200);
  ok(/systemAufgabenErledigen\(schluessel, grund, "Liegezeit-Wache", lauf\)/.test(wache) && /auftragErledigen\(Number\(z\.id\)/.test(wache) && /VON_HAND_WIEDER_OFFEN\.test/.test(wache)
    && !/SET status = 'erledigt'/.test(lief.slice(lief.indexOf("async function beschaffungsAufgabeSchliessen"), lief.indexOf("export const SAMMEL_LINK_FEHLT_SCHLUESSEL"))),
    "Querprüfung: Wache und Beschaffung erledigen über auftragErledigen (Beitrag, von, Ereignis), von Hand Geöffnetes bleibt offen");
  // Fund 7: eigene Arten.
  const AA = await import("../shared/fiaon-auftrag-arten");
  const ue = AA.auftragArtVon({ schluessel: "unterlagen-eingang:123", quelle: "bestellung", titel: "Unterlagen eingegangen — Auswertung erzeugen" });
  const ab = AA.auftragArtVon({ schluessel: "auskunft-bestaetigung-anruf:7", quelle: "bestellung", titel: "Auftragsbestätigung einholen" });
  ok(ue === "auswertung" && ab === "auskunft_bestaetigung" && AA.artRegel(ue).nurHand && AA.artRegel(ab).nurHand
    && AA.auftragArtVon({ schluessel: "auskunft-beschaffung:FIAON-SCHUFA-X", quelle: "bestellung", titel: "Auskunft beschaffen" }) === "auskunft",
    `Querprüfung: „Unterlagen eingegangen“ und „Auftragsbestätigung“ haben eigene Arten (${ue}, ${ab}); die Beschaffung bleibt „auskunft“`);
  // Fund 14: ehrliche Sätze.
  const pdfQ2 = lies("server/lib/fiaon-finanzauswertung-pdf.ts");
  ok(!/fließt dann in eine neue Fassung/.test(pdfQ2) && /Ihre Ansprechperson kann dann eine neue Fassung dieser Auswertung erstellen/.test(pdfQ2), "Querprüfung: PDF verspricht keine automatische Neufassung");
  const karte = lies("client/src/components/finanzen/Finanzauswertung.tsx");
  ok(!/Sobald Ihre Unterlagen vollständig sind und Ihre Ansprechperson/.test(karte) && /a\.laufend !== false/.test(karte) && /laufend,/.test(lies("server/routes/fiaon-finanzauswertung.ts"))
    && /a\.gekuendigt_am IS NULL/.test(lies("server/routes/fiaon-finanzauswertung.ts")), "Querprüfung: Leerkarte nur mit laufendem, ungekündigtem Paket — sonst ein neutraler Satz");
  // Fund 15: Datenkopie-Weg.
  const mailMod = await import("../server/mail/vorlagen/auskunft-lead");
  const dk = mailMod.schufaRequestedBaustein({ auskunft_liefermodus: "datenkopie" })!;
  const ek = mailMod.schufaRequestedBaustein({ auskunft_liefermodus: "einkauf" })!;
  ok(!/beschaffen wir/.test(dk.preheader) && /Datenkopie in Ihrem Namen an/.test(dk.preheader) && /beschaffen wir/.test(ek.preheader) && dk.knopf?.url === ek.knopf?.url,
    "Querprüfung: Datenkopie-Mail mit eigener Vorzeile (kein „wir beschaffen“), Knopf wie im Einkauf");
  const AKs = await import("../shared/fiaon-auskunft");
  const hk = AKs.AUSKUNFT_DATENKOPIE_AUFTRAG_TEXT("privat");
  ok(!/kostenpflichtig|kostenlos/i.test(hk) && /Datenkopie nach Art\. 15 DSGVO/.test(hk) && /per Post an mich/.test(hk) && AKs.AUSKUNFT_DATENKOPIE_FASSUNG.length <= 20
    && AKs.AUSKUNFT_DATENKOPIE_FASSUNG !== AKs.AUSKUNFT_AUFTRAG_FASSUNG && !/kostenpflichtig|kostenlos/i.test(AKs.AUSKUNFT_DATENKOPIE_AUFTRAG_TEXT("firma")),
    "Querprüfung: Haken im Datenkopie-Weg ohne „kostenpflichtig“/„kostenlos“, eigene Textfassung (≤ 20 Zeichen)");
  const kauf2 = lies("server/routes/fiaon-auskunft-kauf.ts");
  ok(/auftragHaken\(a\.art, datenkopie\)/.test(kauf2) && /Wir fordern Ihre Datenkopie nach Art\. 15 DSGVO in Ihrem Namen an\. Sie kommt per Post zu Ihnen/.test(kauf2)
    && /wortlaut: AUSKUNFT_DATENKOPIE_AUFTRAG_TEXT\(a\.art\), fassung: AUSKUNFT_DATENKOPIE_FASSUNG/.test(kauf2),
    "Querprüfung: Bestätigungsseite — Leistung, Haken und Vermerk im Datenkopie-Weg mit eigenem Wortlaut");
  // Fund 10: Datenschutz.
  ok(/Anthropic PBC oder OpenAI, L\.L\.C\./.test(FA.DATENSCHUTZ_ABSATZ) && /USA/.test(FA.DATENSCHUTZ_ABSATZ) && /Art\. 46 Abs\. 2 lit\. c DSGVO/.test(FA.DATENSCHUTZ_ABSATZ) && /Art\. 22 DSGVO/.test(FA.DATENSCHUTZ_ABSATZ)
    && /Abschnitt IV a/.test(FA.DATENSCHUTZ_ABSATZ), "Querprüfung: PDF-Datenschutz nennt Anbieter, Drittland mit Garantie, Art. 22 und den Abschnitt der Erklärung");
  const priv = lies("client/src/pages/privacy.tsx");
  ok(/id="unterlagen"/.test(priv) && /IV a\. Unterlagen, Auslesen mit KI/.test(priv) && /Anthropic PBC oder OpenAI/.test(priv) && /Standardvertragsklauseln/.test(priv) && /Art\. 22 DSGVO/.test(priv)
    && /Profiling/.test(priv) && /Upload-Link ohne Anmeldung/.test(priv) && !/Ein Transfer dieser spezifischen Analysedaten in Drittländer findet nicht statt/.test(priv) && /Stand 8\. Oktober 2026/.test(priv),
    "Querprüfung: Datenschutzerklärung IV a (Unterlagen, Upload-Link, KI-Anbieter, Drittland, Art. 9, Profiling ohne Art. 22, Speicherdauer), Stand 08.10.");
  const link = lies("client/src/pages/unterlagen-link.tsx");
  ok(/href="\/datenschutz#unterlagen"/.test(link) && /href="\/impressum"/.test(link) && /KI-Dienstleister in unserem Auftrag/.test(link), "Querprüfung: Upload-Seite nennt die KI-Lesung und hat Datenschutz und Impressum in der Fußzeile");
  for (const [n, t] of [["Datenschutz-Absatz", FA.DATENSCHUTZ_ABSATZ], ["Haken Datenkopie", hk], ["Datenkopie-Vorzeile", dk.preheader]] as [string, string][]) {
    const w = wandPruefen(t, []);
    ok(w.length === 0, `Querprüfung: Wortwand ${n} (${w.map((x: any) => x.hinweis).join("; ")})`);
  }
}

abschnitt("A9 · PDF-HTML (ohne Chromium)");
{
  const pdfMod = await import("../server/lib/fiaon-finanzauswertung-pdf");
  const { f, ampeln, fw, schritte, sp } = beispielInhalt;
  const inhalt: any = {
    regelVersion: FA.FA_REGEL_VERSION, nummer: "FA-1-1", fassung: 1, erstelltAm: new Date().toISOString(), kunde: { vorname: "Erika", nachname: "Muster" },
    zeitraum: { von: f.zeitraum.von, bis: f.zeitraum.bis, tage: f.zeitraum.tage }, fakten: f, ampeln, gesamt: FA.gesamtAmpel(ampeln, fw.band), finanzwert: fw,
    schritte, sparpotenzial: sp, vergleichswege: FA.VERGLEICHSWEGE, auskunft: null, einordnung: FA.einordnungRegel(ampeln, fw, { ampel: "gelb" }),
    texteQuelle: "regel", vorbehalte: ["cent"], pruefvermerke: ["Cent-Prüfung: nicht vollständig abgeglichen (siehe Vorbehalt)."], ausweisTyp: "Reisepass (Datenseite)",
  };
  beispielInhalt.inhalt = inhalt;
  const html = pdfMod.finanzauswertungHtml(inhalt, { 1: 3, 2: 4 });
  ok(pdfMod.KAPITEL.length === 11 && pdfMod.KAPITEL.every((k) => html.includes(`FAKAPITEL${String(k.nr).padStart(2, "0")}`)), "Alle elf Kapitel mit Marke für das Verzeichnis");
  ok(html.includes(FA.FINANZWERT_KENNZEICHNUNG.replace(/„/g, "„")) || html.includes("kein SCHUFA-Score"), "Kennzeichnung auf dem Deckblatt");
  ok(!/undefined|NaN|\[object Object\]/.test(html), "Keine leeren Platzhalter (undefined/NaN)");
  ok(!/kostenlos/i.test(html), "Kein „kostenlos“ im PDF");
  ok(/Vorbehalt/.test(html) && html.includes(FA.VORBEHALT_TEXTE.cent), "Vorbehalt steht im PDF");
  ok(/Prüfwert/.test(html) && /[0-9A-F]{4} [0-9A-F]{4} [0-9A-F]{4} [0-9A-F]{4}/.test(html), "Prüfwert im PDF");
  ok(!/Linden-Apotheke|ver\.di/i.test(html) && /besondere Kategorien nach Art\. 9 DSGVO/.test(html), "Keine Art.-9-Namen, Hinweis vorhanden");
  ok(/<td class="s">3<\/td>/.test(html), "Verzeichnis trägt die Seitenzahlen des zweiten Durchgangs");
  const alleSeiten = Object.fromEntries(pdfMod.KAPITEL.map((k) => [k.nr, k.nr + 2]));
  const html2 = pdfMod.finanzauswertungHtml(inhalt, alleSeiten);
  ok(!/FAKAPITEL/.test(html2) && (html2.match(/class="mk"/g) ?? []).length === 11, "Nachprüfung: zweiter Durchgang ohne Kapitelmarken in der Textschicht (Platzhalter gleicher Höhe)");
  ok(/Auswertung FA-1-1|FA-1-1/.test(html) && /Gewichte|Kriterium/.test(html), "Kriterien mit Gewichten offen gelegt");
}

// ═══════════════════════════════════════════════════════════════════════════
// TEIL B — GEGEN DIE LOKALE DATENBANK
// ═══════════════════════════════════════════════════════════════════════════
if (!LOKAL) {
  console.log("\n(Teil B und C übersprungen — DATABASE_URL zeigt nicht auf eine lokale fiaon_-Datenbank.)");
} else {
  const { sqlPool } = await import("../server/lib/db-pool");
  const FL = await import("../server/lib/fiaon-finanzauswertung");
  const L = await import("../server/lib/fiaon-unterlagen-link");
  const LI = await import("../server/lib/fiaon-auskunft-lieferung");
  const PDFDocument = (await import("pdfkit")).default;
  const pdfAus = (zeilen: string[]): Promise<Buffer> => new Promise((fertig) => {
    const d = new PDFDocument({ size: "A4", margin: 40 }); const t: Buffer[] = [];
    d.on("data", (x: Buffer) => t.push(x)); d.on("end", () => fertig(Buffer.concat(t)));
    for (const z of zeilen) d.fontSize(10).text(z);
    d.end();
  });
  const marke = `ITD${Date.now().toString(36).toUpperCase()}`;
  const { nummerFuerWhatsApp, waKanonisch } = await import("../shared/fiaon-whatsapp-erlaubnis");
  /** Je Lauf und Person eine eigene Handynummer — sonst hielte ein offenes Fenster aus einem früheren Lauf. */
  const telefon = (n: string) => `+49151${String(Date.now()).slice(-6)}${(n.charCodeAt(0) % 90) + 10}`;
  await FL.ensureFinanzauswertungTabellen();
  await LI.ensureBeschaffungTabelle();
  const { ensureTodoTabelle } = await import("../server/routes/fiaon-betreiber-todo");
  await ensureTodoTabelle();
  const { ensureAnalyseTabelle } = await import("../server/lib/fiaon-kontoauszug-analyse");
  await ensureAnalyseTabelle();

  /** Ein zahlender Kunde mit Paket, Ausweis und Kontoauszug (Analyse fertig). */
  async function kunde(n: string, o: { buch?: any[]; ausweisUrteil?: any; auszug?: boolean; ausweis?: boolean; kopfName?: string; stimmt?: boolean } = {}) {
    const [p] = (await sqlPool`INSERT INTO fiaon_persons (person_ref, first_name, last_name, street, zip, city, country, primary_email, primary_phone)
      VALUES (${`${marke}-${n}`}, 'Erika', ${`Teststeg${n}`}, 'Teststraße 12', '10115', 'Berlin', 'DE', ${`it-d-${marke.toLowerCase()}-${n}@example.invalid`}, ${telefon(n)}) RETURNING id, primary_phone`) as any[];
    const ref = `FIAON-${marke}-${n}`;
    const auszugPdf = o.auszug === false ? null : await pdfAus([`Sparkasse Berlin Kontoauszug`, `Kontoinhaber Frau Erika ${o.kopfName ?? `Teststeg${n}`}`, "Teststraße 12, 10115 Berlin", "IBAN DE12 1005 0000 0000 0000 00", "Buchungstag Wertstellung Betrag", "Saldo alt 500,00"]);
    const ausweisPdf = o.ausweis === false ? null : await pdfAus(["Reisepass Passport Bundesrepublik Deutschland", "P<D<<TESTSTEG<<ERIKA<<<<<<<<<<<<<<<<<<<<<<<<<"]);
    await sqlPool`INSERT INTO fiaon_applications (ref, payment_reference, person_id, first_name, last_name, email, street, zip, city, country, type, pack_key, pack_name,
                    payment_status, paid_at, income, id_card_pdf, bank_statement_pdf, documents_uploaded_at, created_at)
      VALUES (${ref}, ${`${ref}-Z`}, ${p.id}, 'Erika', ${`Teststeg${n}`}, ${`it-d-${marke.toLowerCase()}-${n}@example.invalid`}, 'Teststraße 12', '10115', 'Berlin', 'DE',
              'privat', 'plus', 'FIAON Plus', 'paid', NOW() - INTERVAL '60 days', 2500, ${ausweisPdf}, ${auszugPdf}, NOW(), NOW() - INTERVAL '70 days')`;
    if (ausweisPdf) await sqlPool`INSERT INTO fiaon_dokument_pruefungen (ref, art, urteil) VALUES (${ref}, 'ausweis', ${sqlPool.json(o.ausweisUrteil ?? { art: "ausweis", pruefbar: true, erkannt: true, vollstaendig: true, fehlt: [], seiten: 1, hinweisKunde: null, hinweisIntern: "Ausweisdokument erkannt (Reisepass, 1 Seite).", quelle: "heuristik" })})
                                  ON CONFLICT (ref, art) DO UPDATE SET urteil = EXCLUDED.urteil`;
    if (auszugPdf) {
      const b = o.buch ?? buchungen();
      await sqlPool`INSERT INTO fiaon_kontoauszug_analysen (ref, person_id, status, zeitraum_von, zeitraum_bis, buchungen, pruefung, nebenkonto, auswertung_version, bank, created_at)
        VALUES (${ref}, ${p.id}, 'fertig', ${`${M1}-01`}, ${letzter(M3)}, ${sqlPool.json(b)}, ${sqlPool.json({ stimmt: o.stimmt ?? true, differenzCents: o.stimmt === false ? 9000 : 0, erfasst: b.length, zeilen: b.length, durchlaeufe: 1, hinweis: null })}, FALSE, 3, 'Sparkasse', NOW())`;
    }
    return { personId: Number(p.id), ref, nummer: waKanonisch(nummerFuerWhatsApp(p.primary_phone)) };
  }
  const leitungA = { name: "Daniel Stripling", agentId: 8 };
  const leitungB = { name: "Florentine Lombardi", agentId: 10 };
  const betreuer = { name: "Lucas Böhnert", agentId: 12 };
  /** Stub für das Modell: Sätze mit Platzhaltern — und ein Feld mit Ziffer, das die Wand ersetzen muss. */
  const einordnungStub = async () => ({
    text: { zusammenfassung: "Ihre Lage ist {{z:band}}. Im Schnitt bleiben {{z:ueberschuss}} im Monat.", bereiche: { identitaet: "Ausweis und Konto passen zusammen.", einkommen: "Ihr Einkommen von 2600 € kommt regelmäßig.", fixkosten: "Feste Zahlungen binden {{z:fixquote}}.", lebenshaltung: "Es bleibt etwas übrig.", verbindlichkeiten: "Raten binden {{z:ratenquote}}.", zahlungsverhalten: "Das Konto war zeitweise im Minus.", auffaelligkeiten: "Keine Auffälligkeiten." } },
    modell: "stub", kostenCents: 1.5, fehler: null,
  });
  const druckStub = async () => pdfAus(["FIAON Finanz- und Bonitätsauswertung (Prüfstand)"]);

  abschnitt("B1 · Auswertung: Voraussetzungen, Erzeugen, Fassungen, Freigabe");
  {
    const k = await kunde("A");
    const e = await FL.eingabenSammeln(k.personId);
    ok(e?.voraussetzungen.bereit === true, `Voraussetzungen erfüllt (${e?.voraussetzungen.ausweis.satz} | ${e?.voraussetzungen.kontoauszug.satz})`);
    const r1 = await FL.erzeugen(k.personId, betreuer, { einordnung: einordnungStub as any, drucken: druckStub }, sqlPool, { warten: true });
    ok(r1.ok && r1.id, `Erzeugen startet (${r1.text})`);
    let f1 = await FL.fassungLesen(r1.id!);
    ok(f1?.status === "entwurf" && f1.fassung === 1 && f1.finanzwert! >= 100 && f1.finanzwert! <= 999 && f1.pdf, `Entwurf 1 mit Wert ${f1?.finanzwert} und PDF`);
    ok(f1?.inhalt?.einordnung.zusammenfassung.includes("€") && !f1?.inhalt?.einordnung.zusammenfassung.includes("{{"), "Platzhalter vom Server eingesetzt");
    ok(!/2600/.test(f1?.inhalt?.einordnung.bereiche.einkommen ?? "") && f1?.inhalt?.einordnung.bereiche.einkommen === f1?.inhalt?.ampeln.find((a: any) => a.key === "einkommen")?.grund, "Feld mit Ziffer vom Modell → fester Satz statt Modelltext");
    ok(f1?.inhalt?.texteQuelle === "ki" && f1?.kostenCents === 1.5, "Texte-Quelle und Kosten je Fassung");
    ok(!JSON.stringify(f1?.inhalt).match(/Linden-Apotheke|ver\.di/i), "Eingefrorener Inhalt ohne Art.-9-Namen");
    ok(f1?.inhalt?.pruefvermerke.some((v: string) => /Kontoinhaber: Ihr Name steht/.test(v)), "Kontoinhaber im Kopf des Auszugs gefunden (Textschicht)");
    // Doppelklick auf einen frischen Entwurf → derselbe Entwurf, keine neue Fassung
    const zahl = async () => Number(((await sqlPool`SELECT COUNT(*)::int AS n FROM fiaon_finanzauswertungen WHERE person_id = ${k.personId}`) as any[])[0].n);
    const n0 = await zahl();
    const wieder = await FL.erzeugen(k.personId, betreuer, { einordnung: einordnungStub as any, drucken: druckStub });
    ok(wieder.id === r1.id && (await zahl()) === n0, "Klick auf einen frischen Entwurf aus denselben Unterlagen → derselbe Entwurf");
    // Freigabe: fremder Mitarbeiter nicht, Betreuer ja
    ok(!(await FL.freigeben(r1.id!, { ...betreuer, rolle: "agent", zustaendig: false }, sqlPool, { mail: false })).ok, "Nicht zuständig → keine Freigabe");
    const fr = await FL.freigeben(r1.id!, { ...betreuer, rolle: "agent", zustaendig: true }, sqlPool);
    ok(fr.ok && /nicht gesendet|gesendet/.test(fr.mail ?? ""), `Betreuer gibt frei, Mail-Versuch protokolliert (${fr.mail})`);
    const [ml] = (await sqlPool`SELECT event, status, payload FROM fiaon_mail_log WHERE person_id = ${k.personId} AND event = 'finanzauswertung_bereit' ORDER BY id DESC LIMIT 1`) as any[];
    const mp = ml ? (typeof ml.payload === "string" ? JSON.parse(ml.payload) : ml.payload) : null;
    ok(!mp || (!/finanzwert|"wert"|ampel/i.test(JSON.stringify(mp)) && String(mp.auswertung_url ?? "").endsWith("/app/auswertung")), "Mail-Nutzlast: nur der Link, kein Wert");
    // Zwei Starts zur selben Zeit → genau eine neue Fassung; ein dritter Klick nach dem Lauf → derselbe Entwurf
    const n1 = await zahl();
    const [a, b] = await Promise.all([
      FL.erzeugen(k.personId, betreuer, { einordnung: einordnungStub as any, drucken: druckStub }),
      FL.erzeugen(k.personId, betreuer, { einordnung: einordnungStub as any, drucken: druckStub }),
    ]);
    for (let i = 0; i < 40; i++) { const x = await FL.fassungLesen(a.id!); if (x?.status !== "laeuft") break; await new Promise((z) => setTimeout(z, 250)); }
    const c = await FL.erzeugen(k.personId, betreuer, { einordnung: einordnungStub as any, drucken: druckStub });
    ok((await zahl()) === n1 + 1 && c.id === a.id, `Doppelklick: genau eine neue Fassung (${a.id}/${b.id}/${c.id})`);
    const f2 = await FL.fassungLesen(a.id!);
    ok(f2?.fassung === 2 && f2.status === "entwurf", "Zweite Fassung entsteht als Entwurf");
    const fr2 = await FL.freigeben(a.id!, { ...betreuer, rolle: "agent", zustaendig: true }, sqlPool, { mail: false });
    ok(fr2.ok && (await FL.fassungLesen(r1.id!))?.status === "ersetzt", "Neue Freigabe → vorige Fassung „ersetzt“ (bleibt sichtbar)");
    const kd = await FL.kundeAuswertungen(k.personId);
    ok(kd.aktuell?.id === a.id && kd.fruehere.some((x) => x.id === r1.id), "Portal: aktuelle und frühere Fassung");
    ok(!(await FL.verwerfen(a.id!, "zu kurz?", leitungA)).ok, "Freigegebene Fassung lässt sich nicht verwerfen");
    const l = await FL.lage(k.personId);
    ok(!l.veraltet && l.fassungen.length === 2, "Lage: zwei Fassungen, nicht veraltet");
    await sqlPool`INSERT INTO fiaon_kontoauszug_analysen (ref, person_id, status, zeitraum_von, zeitraum_bis, buchungen, pruefung, nebenkonto, auswertung_version, created_at)
      VALUES (${k.ref}, ${k.personId}, 'fertig', ${`${M1}-01`}, ${letzter(M3)}, ${sqlPool.json(buchungen())}, ${sqlPool.json({ stimmt: true })}, FALSE, 3, NOW() + INTERVAL '1 second')`;
    ok((await FL.lage(k.personId)).veraltet, "Neue Analyse → „veraltet“");
    const pdf = await FL.pdfLesen(a.id!);
    ok(pdf?.pdf.subarray(0, 4).toString("latin1") === "%PDF", "PDF liegt in fiaon_dokumente");
    const [dok] = (await sqlPool`SELECT art, quelle FROM fiaon_dokumente WHERE person_id = ${k.personId} AND art = 'finanzauswertung' LIMIT 1`) as any[];
    ok(dok?.quelle === "erzeugt", "Ablage: art finanzauswertung, quelle erzeugt");
    // Gegenprüfung 08.10.: Doppelklick auf „Freigeben“ → genau eine Freigabe (eine Mail)
    const r3 = await FL.erzeugen(k.personId, betreuer, { einordnung: einordnungStub as any, drucken: druckStub }, sqlPool, { warten: true });
    const [x1, x2] = await Promise.all([
      FL.freigeben(r3.id!, { ...betreuer, rolle: "agent", zustaendig: true }, sqlPool, { mail: false }),
      FL.freigeben(r3.id!, { ...betreuer, rolle: "agent", zustaendig: true }, sqlPool, { mail: false }),
    ]);
    const [nf] = (await sqlPool`SELECT COUNT(*)::int AS n FROM fiaon_finanzauswertungen WHERE person_id = ${k.personId} AND status = 'freigegeben'`) as any[];
    ok([x1, x2].filter((x) => x.ok).length === 1 && nf.n === 1, `Zwei Freigaben zugleich → genau eine gelingt (${x1.ok}/${x2.ok}, freigegeben ${nf.n})`);
    // Verwerfen und Freigeben zugleich → genau eins gilt, und der Stand passt dazu
    const r4 = await FL.erzeugen(k.personId, betreuer, { einordnung: einordnungStub as any, drucken: druckStub }, sqlPool, { warten: true });
    const [vw, fg] = await Promise.all([
      FL.verwerfen(r4.id!, "Zahlen mit dem Kunden klären", leitungA),
      FL.freigeben(r4.id!, { ...betreuer, rolle: "agent", zustaendig: true }, sqlPool, { mail: false }),
    ]);
    const st4 = (await FL.fassungLesen(r4.id!))?.status;
    ok(vw.ok !== fg.ok && (vw.ok ? st4 === "verworfen" : st4 === "freigegeben"), `Verwerfen gegen Freigeben: genau eins gilt (verworfen ${vw.ok}, freigegeben ${fg.ok}, Stand ${st4})`);
    ok(!(await FL.freigeben(r4.id!, { ...betreuer, rolle: "agent", zustaendig: true }, sqlPool, { mail: false })).ok, "Danach keine zweite Freigabe derselben Fassung");
    const [nf2] = (await sqlPool`SELECT COUNT(*)::int AS n FROM fiaon_finanzauswertungen WHERE person_id = ${k.personId} AND status = 'freigegeben'`) as any[];
    ok(nf2.n === 1, "Höchstens eine freigegebene Fassung je Person");
    const [ix] = (await sqlPool`SELECT to_regclass('fiaon_finanzauswertungen_eine_frei_idx') IS NOT NULL AS da`) as any[];
    ok(ix?.da, "Teilindex „eine Freigabe je Person“ liegt an");
    // Nachprüfung 08.10.: Kam nach dem Entwurf eine neue Analyse, geht der Entwurf nicht an den Kunden.
    const r5 = await FL.erzeugen(k.personId, betreuer, { einordnung: einordnungStub as any, drucken: druckStub }, sqlPool, { warten: true });
    await sqlPool`INSERT INTO fiaon_kontoauszug_analysen (ref, person_id, status, zeitraum_von, zeitraum_bis, buchungen, pruefung, nebenkonto, auswertung_version, created_at)
      VALUES (${k.ref}, ${k.personId}, 'fertig', ${`${M1}-01`}, ${letzter(M3)}, ${sqlPool.json(buchungen())}, ${sqlPool.json({ stimmt: true })}, FALSE, 3, NOW() + INTERVAL '5 seconds')`;
    const alt5 = await FL.freigeben(r5.id!, { ...betreuer, rolle: "agent", zustaendig: true }, sqlPool, { mail: false });
    ok(!alt5.ok && /neue Fassung erzeugen/.test(alt5.text) && (await FL.fassungLesen(r5.id!))?.status === "entwurf", `Nachprüfung: veralteter Entwurf → keine Freigabe (${alt5.text})`);
  }

  abschnitt("B2 · Vier-Augen, Verwerfen, Sichtprüfung, fehlende Voraussetzungen");
  {
    const k = await kunde("B", { stimmt: false, buch: buchungen({ ruecklast: 2, inkasso: 2 }) });
    const r = await FL.erzeugen(k.personId, leitungA, { einordnung: async () => ({ text: null, modell: null, kostenCents: 0, fehler: "KI pausiert" }), drucken: druckStub }, sqlPool, { warten: true });
    const f = await FL.fassungLesen(r.id!);
    ok(f?.vorbehalt && f.vierAugen && f.inhalt?.texteQuelle === "regel", "Vorbehalt (Cent) → Vier-Augen; ohne Modell feste Sätze");
    ok(f?.inhalt?.pruefvermerke.some((v: string) => /feste[nm]? Sätzen/.test(v)), "Prüfvermerk: Einordnung mit festen Sätzen");
    ok(!(await FL.freigeben(r.id!, { ...betreuer, rolle: "agent", zustaendig: true }, sqlPool, { mail: false })).ok, "Betreuer darf nicht freigeben");
    ok(!(await FL.freigeben(r.id!, { ...leitungA, rolle: "vertriebsleiter", zustaendig: true }, sqlPool, { mail: false })).ok, "Ersteller (Leitung) darf nicht freigeben");
    // Integration 08.10.2026 (offener Fund der Nachprüfung): Der Vier-Augen-Entwurf erreicht die Leitung — EINE Aufgabe, idempotent.
    const vaSchl = FL.VIER_AUGEN_SCHLUESSEL(r.id!);
    const vaZeilen = async () => (await sqlPool`SELECT id, status, titel, zustaendig_art, zustaendig_agent_id, art FROM fiaon_betreiber_todos WHERE schluessel = ${vaSchl}`) as any[];
    const va1 = await vaZeilen();
    ok(va1.length === 1 && va1[0].status !== "erledigt" && /^Vier-Augen: Auswertung FA-/.test(va1[0].titel) && va1[0].art === "vier_augen",
      `Vier-Augen-Entwurf → eine offene Aufgabe an die Leitung (${va1.map((z) => `${z.status}/${z.zustaendig_art}/${z.zustaendig_agent_id}`).join(", ")})`);
    ok(va1.length === 1 && Number(va1[0].zustaendig_agent_id) !== leitungA.agentId, "… nie an den, der den Entwurf erzeugt hat");
    await FL.vierAugenAufgabenAbgleichen(k.personId);
    ok((await vaZeilen()).length === 1 && (await vaZeilen())[0].status !== "erledigt", "Abgleich zweimal → weiter genau eine offene Aufgabe");
    ok(!(await FL.verwerfen(r.id!, "x", leitungB)).ok, "Verwerfen ohne Grund abgelehnt");
    ok((await FL.verwerfen(r.id!, "Zahlen mit dem Kunden klären", leitungB)).ok && (await FL.fassungLesen(r.id!))?.status === "verworfen", "Verwerfen mit Grund");
    ok((await vaZeilen())[0]?.status === "erledigt", "Verworfen → die Vier-Augen-Aufgabe ist von selbst erledigt");
    // Sichtprüfung
    const k2 = await kunde("C", { ausweisUrteil: { art: "ausweis", pruefbar: false, erkannt: null, vollstaendig: null, fehlt: [], seiten: 1, hinweisKunde: null, hinweisIntern: "Foto", quelle: "heuristik" } });
    let e = await FL.eingabenSammeln(k2.personId);
    ok(e?.voraussetzungen.ausweis.stand === "pruefen" && !e.voraussetzungen.bereit, "Foto-Ausweis → von Hand prüfen");
    ok(!(await FL.erzeugen(k2.personId, betreuer)).ok, "Ohne Voraussetzungen kein Lauf");
    ok(!(await FL.sichtpruefungSetzen(k2.personId, "fuehrerschein", betreuer)).ok, "Sichtprüfung: Führerschein gilt nicht");
    ok((await FL.sichtpruefungSetzen(k2.personId, "reisepass", betreuer)).ok, "Sichtprüfung: Reisepass bestätigt");
    e = await FL.eingabenSammeln(k2.personId);
    ok(e?.voraussetzungen.ausweis.ok && e.voraussetzungen.bereit, "Nach der Sichtprüfung bereit");
    // Nachprüfung 08.10.: Fehlbestätigung zurücknehmen (mit Grund, Verlauf), danach wieder ungeprüft.
    ok(!(await FL.sichtpruefungZuruecknehmen(k2.personId, "", betreuer)).ok, "Sichtprüfung zurücknehmen: ohne Grund abgelehnt");
    ok((await FL.sichtpruefungZuruecknehmen(k2.personId, "falsche Person auf dem Foto", betreuer)).ok, "Sichtprüfung zurückgenommen");
    e = await FL.eingabenSammeln(k2.personId);
    ok(e?.voraussetzungen.ausweis.stand === "pruefen" && !e.voraussetzungen.bereit && e.ausweis.sicht === null, "Nach der Rücknahme: Ausweis wieder ungeprüft, Auswertung gesperrt");
    const [vz] = (await sqlPool`SELECT note FROM fiaon_contact_log WHERE person_id = ${k2.personId} AND note LIKE 'Ausweis-Bestätigung von Hand zurückgenommen%' ORDER BY id DESC LIMIT 1`) as any[];
    ok(/Reisepass/.test(vz?.note ?? "") && /falsche Person auf dem Foto/.test(vz?.note ?? ""), "Rücknahme steht mit Art und Grund im Verlauf");
    ok(!(await FL.sichtpruefungZuruecknehmen(k2.personId, "noch einmal", betreuer)).ok, "Zweite Rücknahme: nichts mehr zurückzunehmen");
    ok((await FL.sichtpruefungSetzen(k2.personId, "reisepass", betreuer)).ok && (await FL.eingabenSammeln(k2.personId))?.voraussetzungen.bereit, "Neu bestätigt → wieder bereit");
    await sqlPool`UPDATE fiaon_applications SET id_card_pdf = ${await pdfAus(["Personalausweis neu"])} WHERE ref = ${k2.ref}`;
    e = await FL.eingabenSammeln(k2.personId);
    ok(!e?.voraussetzungen.ausweis.ok, "Neue Ausweis-Datei → Sichtprüfung gilt nicht mehr (Prüfwert)");
    const k3 = await kunde("D", { auszug: false });
    e = await FL.eingabenSammeln(k3.personId);
    ok(e?.voraussetzungen.anforderbar.includes("kontoauszug") && e.voraussetzungen.kontoauszug.bitte?.includes(FA.monatsName(M3)), "Kontoauszug fehlt → anforderbar mit Monaten");
  }

  abschnitt("B3 · Upload-Link: Token, Wiederverwendung, Widerruf, Ablauf, Annahme");
  {
    const k = await kunde("E");
    const l1 = await L.linkFuerAnfrage(k.personId, ["kontoauszug"], betreuer);
    ok(l1.neu && l1.url.includes(`/unterlagen/${l1.token}`), "Neuer Link");
    ok((await L.linkLesen(l1.token)).ok, "Token gültig");
    const kaputt = l1.token.slice(0, -2) + (l1.token.endsWith("AA") ? "BB" : "AA");
    ok(!(await L.linkLesen(kaputt)).ok, "Verfälschtes Token abgewiesen");
    const l2 = await L.linkFuerAnfrage(k.personId, ["kontoauszug"], betreuer);
    ok(!l2.neu && l2.token === l1.token, "Gleiche Art → derselbe Link (keine zweite Tür)");
    const l3 = await L.linkFuerAnfrage(k.personId, ["ausweis"], betreuer);
    ok(l3.neu && l3.link.arten.includes("kontoauszug") && l3.link.arten.includes("ausweis"), "Weitere Art → neuer Link mit beiden Arten");
    ok((await L.linkLesen(l1.token)).ok, "Der alte Link gilt weiter, solange der neue nicht zugestellt ist");
    ok((await L.vorgaengerWiderrufen(k.personId, l3.link.id)) >= 1, "Nach der Zustellung: Vorgänger widerrufen");
    const alt = await L.linkLesen(l1.token);
    ok(!alt.ok && alt.grund === "widerrufen" && /^ersetzt durch Link #/.test(alt.link?.widerrufGrund ?? ""), "Der alte Link ist widerrufen (ersetzt)");
    ok((await L.linkLesen(l3.token)).ok, "Der zugestellte Link selbst bleibt gültig");
    // Nachprüfung 08.10.: Die Verwaltung hat den Kontoauszug neu angefordert (KYC „changes_requested“).
    await sqlPool`UPDATE fiaon_applications SET kyc_status = 'changes_requested', reupload_bank_statement = TRUE WHERE ref = ${k.ref}`;
    ok((await L.artenStand(k.personId, ["kontoauszug"])).kontoauszug.stand === "bitte_neu", "Nachprüfung: neu angefordert → Seite zeigt „bitte neu“, nicht „Liegt vor“");
    const vermerkeVorher = Number(((await sqlPool`SELECT COUNT(*)::int AS n FROM fiaon_vermerke WHERE ref = ${k.ref} AND art = 'aufgabe' AND text LIKE ${"Unterlagen eingegangen%"}`) as any[])[0].n);
    // Annahme: anhängen
    const vorher = (await sqlPool`SELECT LENGTH(bank_statement_pdf) AS n FROM fiaon_applications WHERE ref = ${k.ref}`) as any[];
    const neuPdf = await pdfAus(["Kontoauszug Folgemonat", "Saldo neu 700,00"]);
    const an = await L.unterlageAnnehmen({ personId: k.personId, art: "kontoauszug", dateien: [{ buffer: neuPdf, name: "september.pdf", mimetype: "application/pdf" }], quelle: { art: "link", linkId: l3.link.id } });
    const nachher = (await sqlPool`SELECT LENGTH(bank_statement_pdf) AS n FROM fiaon_applications WHERE ref = ${k.ref}`) as any[];
    const { pdfSeiten } = await import("../server/lib/fiaon-pdf-lesen");
    const seitenNachher = await pdfSeiten(Buffer.from(((await sqlPool`SELECT bank_statement_pdf AS d FROM fiaon_applications WHERE ref = ${k.ref}`) as any[])[0].d));
    ok(an.ok && an.angehaengt && seitenNachher >= 2 && Number(vorher[0].n) > 0 && Number(nachher[0].n) > 0, `Kontoauszug angehängt, nicht ersetzt (${seitenNachher} Seiten · ${an.meldung})`);
    ok(/ist angekommen und liegt bei Ihren bisherigen Unterlagen/.test(an.meldung), "Nachprüfung: eine Datei → „liegt“ (Einzahl)");
    const [kyc] = (await sqlPool`SELECT kyc_status, reupload_bank_statement FROM fiaon_applications WHERE ref = ${k.ref}`) as any[];
    ok(kyc?.kyc_status === "pending" && kyc.reupload_bank_statement === false, `Nachprüfung: Link-Upload setzt den KYC-Stand zurück wie /upload-kyc (${kyc?.kyc_status}, ${kyc?.reupload_bank_statement})`);
    const vermerkeNachher = Number(((await sqlPool`SELECT COUNT(*)::int AS n FROM fiaon_vermerke WHERE ref = ${k.ref} AND art = 'aufgabe' AND text LIKE ${"Unterlagen eingegangen%"}`) as any[])[0].n);
    ok(vermerkeNachher === vermerkeVorher + 1, "Nachprüfung: Prüfaufgabe der Verwaltung angelegt (wie /upload-kyc)");
    const stDanach = (await L.artenStand(k.personId, ["kontoauszug"])).kontoauszug;
    ok(!/neu angefordert/.test(stDanach.satz), `Nachprüfung: danach nicht mehr „neu angefordert“ (${stDanach.stand}: ${stDanach.satz})`);
    const [archiv] = (await sqlPool`SELECT COUNT(*)::int AS n FROM fiaon_dokumente WHERE person_id = ${k.personId} AND art = 'frueher_kontoauszug'`) as any[];
    ok(archiv.n >= 1, "Vorige Fassung im Archiv");
    const nochmal = await L.unterlageAnnehmen({ personId: k.personId, art: "kontoauszug", dateien: [{ buffer: Buffer.from((await sqlPool`SELECT bank_statement_pdf AS d FROM fiaon_applications WHERE ref = ${k.ref}` as any)[0].d), name: "gleich.pdf", mimetype: "application/pdf" }], quelle: { art: "link", linkId: l3.link.id } });
    ok(nochmal.ok && /liegt uns schon vor/.test(nochmal.meldung), "Dieselbe Datei erneut → nichts doppelt");
    // Gegenprüfung 08.10.: Nach dem Anhängen ist die Spalte zusammengesetzt — dieselbe TEIL-Datei erneut darf nicht noch einmal angehängt werden.
    const laenge = async () => Number(((await sqlPool`SELECT LENGTH(bank_statement_pdf) AS n FROM fiaon_applications WHERE ref = ${k.ref}`) as any[])[0].n);
    const n1 = await laenge();
    const teil = await L.unterlageAnnehmen({ personId: k.personId, art: "kontoauszug", dateien: [{ buffer: neuPdf, name: "september-nochmal.pdf", mimetype: "application/pdf" }], quelle: { art: "link", linkId: l3.link.id } });
    ok(teil.ok && /liegt uns schon vor/.test(teil.meldung) && (await laenge()) === n1, "Schon angehängte Datei erneut (Teil der zusammengesetzten) → nichts doppelt");
    const okt = await pdfAus(["Kontoauszug Oktober", "Saldo neu 900,00"]);
    const zwei = await L.unterlageAnnehmen({ personId: k.personId, art: "kontoauszug", dateien: [
      { buffer: okt, name: "oktober.pdf", mimetype: "application/pdf" }, { buffer: okt, name: "oktober-kopie.pdf", mimetype: "application/pdf" }, { buffer: neuPdf, name: "september.pdf", mimetype: "application/pdf" },
    ], quelle: { art: "link", linkId: l3.link.id } });
    const seitenZwei = await pdfSeiten(Buffer.from(((await sqlPool`SELECT bank_statement_pdf AS d FROM fiaon_applications WHERE ref = ${k.ref}`) as any[])[0].d));
    ok(zwei.ok && /Ihre Datei/.test(zwei.meldung) && seitenZwei === seitenNachher + 1, `Gleiche Datei zweimal in einer Sendung + schon vorhandene → nur eine neue Seite (${seitenNachher} → ${seitenZwei})`);
    const gross = await L.unterlageAnnehmen({ personId: k.personId, art: "kontoauszug", dateien: [{ buffer: Buffer.concat([Buffer.from("%PDF-1.4\n"), Buffer.alloc(UA.LINK_UNTERLAGE_MAX_MB * 1024 * 1024)]), name: "riesig.pdf", mimetype: "application/pdf" }], quelle: { art: "link", linkId: l3.link.id } });
    ok(!gross.ok && /nur die Seiten hoch, die noch fehlen/.test(gross.meldung), "Über 150 MB je Unterlage → klarer Satz, nichts angehängt");
    const heic = await L.unterlageAnnehmen({ personId: k.personId, art: "ausweis", dateien: [{ buffer: Buffer.from("ftypheic"), name: "IMG_0001.HEIC", mimetype: "image/heic" }], quelle: { art: "link", linkId: l3.link.id } });
    ok(!heic.ok && /HEIC/.test(heic.meldung), "HEIC → klarer Satz statt Fehler");
    const txt = await L.unterlageAnnehmen({ personId: k.personId, art: "ausweis", dateien: [{ buffer: Buffer.from("hallo"), name: "notiz.txt", mimetype: "text/plain" }], quelle: { art: "link", linkId: l3.link.id } });
    ok(!txt.ok && /PDF-, JPG- oder PNG/.test(txt.meldung), "Falscher Dateityp → klarer Satz");
    const [verlauf] = (await sqlPool`SELECT note FROM fiaon_contact_log WHERE person_id = ${k.personId} AND note LIKE ${"%Upload-Link%hochgeladen%"} ORDER BY id DESC LIMIT 1`) as any[];
    ok(!!verlauf, "Verlauf: „über den Upload-Link hochgeladen“");
    const [todo] = (await sqlPool`SELECT titel FROM fiaon_betreiber_todos WHERE schluessel = ${`unterlagen-eingang:${k.personId}`}`) as any[];
    ok(/Unterlagen eingegangen/.test(todo?.titel ?? ""), "Aufgabe „Unterlagen eingegangen — Auswertung erzeugen“");
    const [z] = (await sqlPool`SELECT nutzungen, dateien FROM fiaon_unterlagen_links WHERE id = ${l3.link.id}`) as any[];
    ok(Number(z.nutzungen) >= 1 && Number(z.dateien) >= 1, "Nutzungen am Link gezählt");
    const stand = await L.artenStand(k.personId, ["kontoauszug", "ausweis"]);
    ok(stand.kontoauszug.stand !== "fehlt" && stand.ausweis.stand !== "fehlt", "Lage je Art ohne Inhalte");
    await sqlPool`UPDATE fiaon_unterlagen_links SET gueltig_bis = NOW() - INTERVAL '1 minute' WHERE id = ${l3.link.id}`;
    const ab = await L.linkLesen(l3.token);
    ok(!ab.ok && ab.grund === "ungueltig", "Abgelaufen UND Ablauf im Token passt nicht mehr → ungültig (Token trägt den Ablauf)");
    const l4 = await L.linkFuerAnfrage(k.personId, ["ausweis"], betreuer);
    await sqlPool`UPDATE fiaon_unterlagen_links SET gueltig_bis = ${new Date(Date.now() - 60_000)} WHERE id = ${l4.link.id}`;
    const t4 = L.linkToken(l4.link.id, new Date((await sqlPool`SELECT gueltig_bis FROM fiaon_unterlagen_links WHERE id = ${l4.link.id}` as any)[0].gueltig_bis), l4.link.arten);
    const ab4 = await L.linkLesen(t4);
    ok(!ab4.ok && ab4.grund === "abgelaufen", "Abgelaufener Link → „abgelaufen“ (neuer Link anforderbar)");
    ok((await L.linkWiderrufen(k.personId, "Prüfstand")) >= 0, "Widerruf von Hand läuft");

    // Nachprüfung 08.10.: Die vorhandene Datei ist ein NEBENKONTO — der Gehaltskonto-Auszug ersetzt sie (nicht dahinter).
    const kn = await kunde("N");
    await sqlPool`UPDATE fiaon_kontoauszug_analysen SET nebenkonto = TRUE WHERE ref = ${kn.ref}`;
    const ln = await L.linkFuerAnfrage(kn.personId, ["kontoauszug"], betreuer);
    const gehalt = await pdfAus(["Kontoauszug Gehaltskonto", "Gehalt 2.600,00"]);
    const ers = await L.unterlageAnnehmen({ personId: kn.personId, art: "kontoauszug", dateien: [{ buffer: gehalt, name: "gehaltskonto.pdf", mimetype: "application/pdf" }], quelle: { art: "link", linkId: ln.link.id } });
    const spalteN = async () => Buffer.from(((await sqlPool`SELECT bank_statement_pdf AS d FROM fiaon_applications WHERE ref = ${kn.ref}`) as any[])[0].d);
    ok(ers.ok && !ers.angehaengt && /ersetzt die bisherige Datei/.test(ers.meldung) && (await pdfSeiten(await spalteN())) === 1, `Nachprüfung: Nebenkonto → ersetzt, nicht angehängt (${ers.meldung})`);
    const [archivN] = (await sqlPool`SELECT COUNT(*)::int AS n FROM fiaon_dokumente WHERE person_id = ${kn.personId} AND art = 'frueher_kontoauszug'`) as any[];
    ok(archivN.n >= 1, "Nachprüfung: das Nebenkonto liegt im Archiv der Akte");
    const gehalt2 = await pdfAus(["Kontoauszug Gehaltskonto Folgemonat", "Gehalt 2.600,00"]);
    const erg2 = await L.unterlageAnnehmen({ personId: kn.personId, art: "kontoauszug", dateien: [{ buffer: gehalt2, name: "gehaltskonto-2.pdf", mimetype: "application/pdf" }], quelle: { art: "link", linkId: ln.link.id } });
    ok(erg2.ok && erg2.angehaengt && (await pdfSeiten(await spalteN())) === 2, "Nachprüfung: was schon über den Link kam, wird weiter ergänzt (auch solange die Analyse noch „Nebenkonto“ sagt)");

    // Nachprüfung 08.10.: Zusammenführung — Person M1 wird in M2 zusammengeführt (wie fiaon-person-merge: Bestellungen wandern).
    const m1 = await kunde("M1");
    const m2 = await kunde("M2");
    const lm = await L.linkFuerAnfrage(m1.personId, ["kontoauszug"], betreuer);
    const rm = await FL.erzeugen(m1.personId, betreuer, { einordnung: einordnungStub as any, drucken: druckStub }, sqlPool, { warten: true });
    ok((await FL.freigeben(rm.id!, { ...betreuer, rolle: "agent", zustaendig: true }, sqlPool, { mail: false })).ok, "Merge-Vorlauf: Auswertung von M1 freigegeben");
    const mref = `FIAON-SCHUFA-${marke}-M1`;
    await sqlPool`INSERT INTO fiaon_applications (ref, payment_reference, person_id, email, country, type, pack_key, payment_status, paid_at, created_at)
                  VALUES (${mref}, ${`${mref}-Z`}, ${m1.personId}, ${`it-d-${marke.toLowerCase()}-m1s@example.invalid`}, 'DE', 'schufa', 'schufa', 'paid', NOW() - INTERVAL '20 days', NOW() - INTERVAL '21 days')`;
    const [bm] = (await sqlPool`INSERT INTO fiaon_auskunft_beschaffung (ref, person_id, land, art, faellig_ab, quelle, modus) VALUES (${mref}, ${m1.personId}, 'DE', 'privat', ${tagPlus(heuteIso, -5)}, 'zahlung', 'einkauf') RETURNING id`) as any[];
    await sqlPool`UPDATE fiaon_persons SET merged_into_person_id = ${m2.personId} WHERE id = ${m1.personId}`;
    await sqlPool`UPDATE fiaon_applications SET person_id = ${m2.personId} WHERE person_id = ${m1.personId}`;
    ok(JSON.stringify(await L.personFamilie(m1.personId)) === JSON.stringify([m2.personId, m1.personId]) && (await L.personFamilie(m2.personId))[0] === m2.personId, "Nachprüfung: personFamilie — Kopf zuerst, Dublette dabei");
    const lmLesen = await L.linkLesen(lm.token);
    ok(lmLesen.ok && lmLesen.link.personId === m2.personId, "Nachprüfung: Link der Dublette gilt nach dem Merge für den Kopf");
    const stM = await L.artenStand(lmLesen.ok ? lmLesen.link.personId : m1.personId, ["kontoauszug"]);
    ok(stM.kontoauszug.stand !== "fehlt", "Nachprüfung: Seite des Links zeigt den Stand des Kopfes (nicht „Fehlt noch“)");
    const anM = await L.unterlageAnnehmen({ personId: lmLesen.ok ? lmLesen.link.personId : m1.personId, art: "kontoauszug", dateien: [{ buffer: await pdfAus(["Kontoauszug nach Merge"]), name: "merge.pdf", mimetype: "application/pdf" }], quelle: { art: "link", linkId: lm.link.id } });
    ok(anM.ok, `Nachprüfung: Upload über den Link nach dem Merge gelingt (${anM.meldung})`);
    ok((await FL.kundeAuswertungen(m2.personId)).aktuell?.id === rm.id && (await FL.lage(m2.personId)).fassungen.some((f) => f.id === rm.id), "Nachprüfung: Auswertung der Dublette im Portal und in der Akte des Kopfes");
    ok((await FL.gehoertZu(m1.personId, m2.personId)) && !(await FL.gehoertZu(m2.personId, k.personId)), "Nachprüfung: gehoertZu — Dublette ja, Fremder nein");
    ok((await LI.beschaffungFuerAkte(m2.personId))?.id === Number(bm.id), "Nachprüfung: Beschaffungsauftrag der Dublette in der Akte des Kopfes");

    // Nachprüfung 08.10.: DSGVO-Löschung leert Finanzprofil, Links und Anfragen.
    await sqlPool`INSERT INTO fiaon_unterlagen_anfragen (person_id, arten, quelle, mail_status, adresse, nummer) VALUES (${m1.personId}, ${["kontoauszug"]}, 'akte', 'gesendet', 'x@example.invalid', '+4915100000000')`;
    await FL.personDatenLoeschen(m1.personId);
    const [fa] = (await sqlPool`SELECT inhalt, eingaben FROM fiaon_finanzauswertungen WHERE id = ${rm.id}`) as any[];
    const [li] = (await sqlPool`SELECT widerrufen_am, widerruf_grund FROM fiaon_unterlagen_links WHERE id = ${lm.link.id}`) as any[];
    const [anf] = (await sqlPool`SELECT COUNT(*)::int AS n FROM fiaon_unterlagen_anfragen WHERE person_id = ${m1.personId} AND (adresse IS NOT NULL OR nummer IS NOT NULL)`) as any[];
    ok(fa && fa.inhalt === null && fa.eingaben === null && li?.widerrufen_am && anf.n === 0, "Nachprüfung: DSGVO — Inhalt/Eingaben leer, Link ungültig, Anfragen ohne Adresse und Nummer");
    ok(!(await L.linkLesen(lm.token)).ok, "Nachprüfung: nach der Löschung öffnet der Link nichts mehr");
  }

  abschnitt("B4 · Unterlagen anfordern: Zustandsregel, Kanäle, Protokoll, Drossel");
  {
    const k = await kunde("F", { auszug: false });
    const l0 = await L.linkFuerAnfrage(k.personId, ["ausweis"], betreuer);
    const r = await L.unterlagenAnfrageSenden({ personId: k.personId, arten: ["kontoauszug"], kanaele: ["mail", "whatsapp"], saetze: { kontoauszug: "Ihre Kontoauszüge für August und September" }, akteur: { ...betreuer, rolle: "agent" }, quelle: "akte" });
    ok(r.status !== "abgelehnt" && r.mail.status === "fehlgeschlagen" && r.whatsapp.status === "fenster_zu", `Ohne Schlüssel: Mail versucht (nicht zugestellt), WhatsApp „Fenster zu“ (${r.meldung})`);
    ok(r.linkNeu && (await L.linkLesen(l0.token)).ok, "Mail nicht zugestellt → der Link aus der letzten Mail gilt weiter");
    const [prot] = (await sqlPool`SELECT * FROM fiaon_unterlagen_anfragen WHERE person_id = ${k.personId} ORDER BY id DESC LIMIT 1`) as any[];
    ok(prot && prot.adresse?.includes("@example.invalid") && prot.von === betreuer.name && prot.mail_status === "fehlgeschlagen", "Protokoll: wer, an welche Adresse, Ergebnis je Kanal");
    const [ml] = (await sqlPool`SELECT payload FROM fiaon_mail_log WHERE person_id = ${k.personId} AND event = 'documents_change_request' ORDER BY id DESC LIMIT 1`) as any[];
    const mp = ml ? (typeof ml.payload === "string" ? JSON.parse(ml.payload) : ml.payload) : null;
    ok(mp && mp.knopf_url === "[verborgen]" && /August und September/.test(String(mp.hinweis)) && /ohne Anmeldung/.test(String(mp.upload_satz)) && mp.unterlagen_arten === "kontoauszug",
      "Mail-Nutzlast: genauer Satz, Link verborgen, Upload ohne Anmeldung, Art für die 72-h-Zählung");
    // WhatsApp im offenen Fenster
    await sqlPool`INSERT INTO fiaon_whatsapp (richtung, nummer, person_id, typ, text, empfangen_am) VALUES ('rein', ${k.nummer}, ${k.personId}, 'text', 'Hallo', NOW() - INTERVAL '1 hour')`;
    await sqlPool`INSERT INTO fiaon_unterlagen_anfragen (person_id, arten, quelle, mail_status, whatsapp_status, am) VALUES (${k.personId}, ${["kontoauszug"]}, 'akte', 'fehlgeschlagen', 'aus', NOW() - INTERVAL '1 hour')`;
    const r2 = await L.unterlagenAnfrageSenden({ personId: k.personId, arten: ["kontoauszug"], kanaele: ["whatsapp"], akteur: { ...betreuer, rolle: "agent" }, quelle: "akte" });
    ok(r2.whatsapp.status === "fehlgeschlagen" && /nicht eingerichtet/.test(r2.whatsapp.grund ?? ""), `WhatsApp im offenen Fenster versucht (ohne Konfiguration nicht gesendet: ${r2.whatsapp.grund})`);
    // Drossel: drei erfolgreiche heute → gesperrt; eine vor 5 Minuten → gesperrt
    await sqlPool`INSERT INTO fiaon_unterlagen_anfragen (person_id, arten, quelle, mail_status, am) VALUES (${k.personId}, ${["kontoauszug"]}, 'akte', 'gesendet', NOW() - INTERVAL '5 minutes')`;
    const r3 = await L.unterlagenAnfrageSenden({ personId: k.personId, arten: ["kontoauszug"], kanaele: ["mail"], akteur: { ...betreuer, rolle: "agent" }, quelle: "akte" });
    ok(r3.status === "abgelehnt" && /15 Minuten/.test(r3.meldung), "Drossel: 15 Minuten Abstand");
    // Gekündigt → abgelehnt
    await sqlPool`UPDATE fiaon_applications SET gekuendigt_am = NOW() WHERE ref = ${k.ref}`;
    await sqlPool`DELETE FROM fiaon_unterlagen_anfragen WHERE person_id = ${k.personId}`; // nur in der eigenen Prüfstand-Kopie
    const r4 = await L.unterlagenAnfrageSenden({ personId: k.personId, arten: ["kontoauszug"], kanaele: ["mail"], akteur: { ...betreuer, rolle: "agent" }, quelle: "akte" });
    ok(r4.status === "abgelehnt" && /gekündigt/i.test(r4.meldung), `Gekündigt → keine Anforderung (${r4.meldung})`);
  }

  abschnitt("B5 · 4a: Akte, Sammelknopf (Datenkopie), eigener Upload, Wache, Verantwortung");
  {
    const k = await kunde("G", { auszug: false });
    const sref = `FIAON-SCHUFA-${marke}-G`;
    await sqlPool`INSERT INTO fiaon_applications (ref, payment_reference, person_id, first_name, last_name, email, country, type, pack_key, pack_name, payment_status, paid_at, amount_due, created_at)
                  VALUES (${sref}, ${`${sref}-Z`}, ${k.personId}, 'Erika', 'TeststegG', ${`it-d-${marke.toLowerCase()}-G@example.invalid`}, 'DE', 'schufa', 'schufa', 'Bonitätsauskunft', 'paid', NOW() - INTERVAL '40 days', 74, NOW() - INTERVAL '41 days')`;
    const [bz] = (await sqlPool`INSERT INTO fiaon_auskunft_beschaffung (ref, person_id, land, art, faellig_ab, quelle, modus) VALUES (${sref}, ${k.personId}, 'DE', 'privat', ${tagPlus(heuteIso, -30)}, 'rueckstand', 'einkauf') RETURNING id`) as any[];
    const { dokumentStand } = await import("../server/lib/fiaon-dokumente");
    const st = await dokumentStand({ personId: k.personId, rolle: "agent", zustaendig: true });
    ok(st?.auskunft?.stufe === "bezahlt" && st.auskunft.beschaffung?.id === Number(bz.id) && st.auskunft.beschaffung.einwilligung === false, "Akte: bezahlte Auskunft mit Beschaffungsstand");
    ok(/wartet auf die Auftragsbestätigung/.test(AK.auskunftStufenSatz(st?.auskunft as any) ?? ""), "Kachel: „wartet auf die Auftragsbestätigung“");
    const [a0] = await LI.beschaffungListe({ id: Number(bz.id) });
    ok(LI.sammelKandidat(a0).ja, "Auftrag ist Kandidat für den Sammelknopf");
    const sammel = await LI.auftragLinksAlleSenden(leitungA);
    const [a1] = await LI.beschaffungListe({ id: Number(bz.id) });
    ok(sammel.aufDatenkopie >= 1 && a1.modus === "datenkopie", `Sammelknopf stellt auf Datenkopie (${sammel.aufDatenkopie}, gesendet ${sammel.gesendet}, fehlgeschlagen ${sammel.fehlgeschlagen})`);
    const [ml] = (await sqlPool`SELECT payload FROM fiaon_mail_log WHERE person_id = ${k.personId} AND event = 'schufa_requested' ORDER BY id DESC LIMIT 1`) as any[];
    const mp = ml ? (typeof ml.payload === "string" ? JSON.parse(ml.payload) : ml.payload) : null;
    ok(mp && /Datenkopie nach Art\. 15 DSGVO/.test(String(mp.auftrag_anfang)) && !/kostenlos/i.test(JSON.stringify(mp)) && mp.unterschrift_url === "[verborgen]" && mp.auskunft_liefermodus === "datenkopie",
      "Mail der Auftragsbestätigung: Datenkopie-Sätze, kein „kostenlos“, Link verborgen");
    ok(/Bitte entschuldigen Sie/.test(String(mp?.unterschrift_satz ?? "")), "Rückstand: Entschuldigung in der Mail");
    const [verlauf] = (await sqlPool`SELECT note FROM fiaon_contact_log WHERE ref = ${sref} AND note LIKE ${"%Datenkopie-Weg gestellt%"}`) as any[];
    ok(!!verlauf, "Verlauf: auf den Datenkopie-Weg gestellt");
    // Sende-Ruhe 72 h: gelang die Mail nicht, bleibt der Kandidat — sonst nicht
    const [a2] = await LI.beschaffungListe({ id: Number(bz.id) });
    ok(a2.vollmachtLinkAm ? !LI.sammelKandidat(a2).ja : LI.sammelKandidat(a2).ja, "72 Stunden Ruhe nach einem gesendeten Link");
    // Einwilligung erteilt (Vermerk) → Wache
    await sqlPool`INSERT INTO fiaon_contact_log (ref, person_id, agent_name, type, note, created_at) VALUES (${sref}, ${k.personId}, 'Kunde', 'system', ${"Beschaffungsauftrag ERTEILT über den Kauflink der E-Mail am 01.10.2026 (Fassung 2026-09-25)"}, NOW())`;
    await sqlPool`UPDATE fiaon_auskunft_beschaffung SET faellig_ab = ${tagPlus(heuteIso, -12)} WHERE id = ${bz.id}`;
    const w1 = await LI.beschaffungWache(sqlPool, { heuteIso });
    ok(w1.aufgaben + w1.dringend >= 1, `Wache: Aufgabe für den liegenden Auftrag (${w1.texte.join(" · ")})`);
    const w2 = await LI.beschaffungWache(sqlPool, { heuteIso });
    ok(!w2.texte.some((t) => t.startsWith("Erika TeststegG")), "Wache: kein zweites Mal dieselbe Aufgabe");
    const [todo] = (await sqlPool`SELECT titel, prioritaet FROM fiaon_betreiber_todos WHERE schluessel IN (${`auskunft-liegezeit:${bz.id}`}, ${`auskunft-liegezeit-2:${bz.id}`}) ORDER BY id DESC LIMIT 1`) as any[];
    ok(/beschaffen/.test(todo?.titel ?? ""), "Aufgabe mit Namen und „beschaffen“");
    // Verantwortung
    const auswahl = await LI.beschaffungVerantwortlichAuswahl();
    ok(auswahl.every((p) => p.id !== 927 && p.id !== 928 && p.id !== 2), "Auswahl ohne Testkonten und inaktive");
    if (auswahl.length) {
      ok((await LI.beschaffungVerantwortlichSetzen(auswahl[0].id)).ok && (await LI.beschaffungVerantwortlich())?.id === auswahl[0].id, "Verantwortung gesetzt");
      ok(!(await LI.beschaffungVerantwortlichSetzen(927)).ok, "Testkonto nicht wählbar");
      ok((await LI.beschaffungVerantwortlichSetzen(null)).ok && (await LI.beschaffungVerantwortlich()) === null, "Zurück auf die Leitung");
    }
    // Eigener Upload → Problem „Leistung klären"
    const n = await LI.beschaffungBeiEigenemUpload(k.personId, "kunde", null);
    const [a3] = await LI.beschaffungListe({ id: Number(bz.id) });
    ok(n === 1 && a3.status === "problem" && /Leistung klären/.test(a3.notiz ?? ""), "Eigene Auskunft bei offenem Auftrag → „Problem: Leistung klären“");
    ok((await LI.beschaffungBeiEigenemUpload(k.personId, "kunde", null)) === 0, "Zweiter Upload: nichts doppelt");
    const [eig] = (await sqlPool`SELECT id FROM fiaon_betreiber_todos WHERE schluessel = ${`auskunft-eigene:${bz.id}`}`) as any[];
    ok(!!eig, "Aufgabe an die Verantwortung zur Klärung");
    await LI.beschaffungAktion(Number(bz.id), "abschliessen", leitungA, "Prüfstand: Leistung geklärt");
    const [eig2] = (await sqlPool`SELECT status FROM fiaon_betreiber_todos WHERE schluessel = ${`auskunft-eigene:${bz.id}`}`) as any[];
    ok(eig2?.status !== "erledigt", "Nachprüfung: Abschließen lässt die heikle Klärung „Leistung klären (Erstattung)“ offen — die schließt ein Mensch");
    // Ein Auftrag MIT bestätigtem Auftrag kommt beim Sammelknopf ebenfalls auf den Datenkopie-Weg — ohne zweite Mail.
    const kH = await kunde("H", { auszug: false });
    const hRef = `FIAON-SCHUFA-${marke}-H`;
    await sqlPool`INSERT INTO fiaon_applications (ref, payment_reference, person_id, email, country, type, pack_key, payment_status, paid_at, created_at)
                  VALUES (${hRef}, ${`${hRef}-Z`}, ${kH.personId}, ${`it-d-${marke.toLowerCase()}-h@example.invalid`}, 'DE', 'schufa', 'schufa', 'paid', NOW() - INTERVAL '20 days', NOW() - INTERVAL '21 days')`;
    const [bh] = (await sqlPool`INSERT INTO fiaon_auskunft_beschaffung (ref, person_id, land, art, faellig_ab, quelle, modus) VALUES (${hRef}, ${kH.personId}, 'DE', 'privat', ${tagPlus(heuteIso, -5)}, 'zahlung', 'einkauf') RETURNING id`) as any[];
    await sqlPool`INSERT INTO fiaon_contact_log (ref, person_id, agent_name, type, note) VALUES (${hRef}, ${kH.personId}, 'Kunde', 'system', ${"Beschaffungsauftrag ERTEILT über die Bestellseite am 03.10.2026 (Fassung 2026-09-25)"})`;
    const mailVorher = Number(((await sqlPool`SELECT COUNT(*)::int AS n FROM fiaon_mail_log WHERE person_id = ${kH.personId}`) as any[])[0].n);
    const s2 = await LI.auftragLinksAlleSenden(leitungB);
    const [ah] = await LI.beschaffungListe({ id: Number(bh.id) });
    const mailNachher = Number(((await sqlPool`SELECT COUNT(*)::int AS n FROM fiaon_mail_log WHERE person_id = ${kH.personId}`) as any[])[0].n);
    ok(ah.modus === "datenkopie" && mailNachher === mailVorher && s2.uebersprungen.some((u) => u.id === Number(bh.id)), "Auftrag schon bestätigt → Datenkopie-Weg, keine Mail");
    const stand = await LI.beschaffungSammelStand(await LI.beschaffungListe());
    ok(typeof stand.linkJetzt === "number" && Array.isArray(stand.auswahl), "Steuerpult-Band: Zahlen und Auswahl");

    // Nachprüfung 08.10.: Datenkopie in Arbeit (FIAON hat angefordert) — der Upload des Kunden IST die Lieferung.
    const kJ = await kunde("J", { auszug: false });
    const jRef = `FIAON-SCHUFA-${marke}-J`;
    await sqlPool`INSERT INTO fiaon_applications (ref, payment_reference, person_id, email, country, type, pack_key, payment_status, paid_at, created_at)
                  VALUES (${jRef}, ${`${jRef}-Z`}, ${kJ.personId}, ${`it-d-${marke.toLowerCase()}-j@example.invalid`}, 'DE', 'schufa', 'schufa', 'paid', NOW() - INTERVAL '30 days', NOW() - INTERVAL '31 days')`;
    const [bj] = (await sqlPool`INSERT INTO fiaon_auskunft_beschaffung (ref, person_id, land, art, faellig_ab, quelle, modus, status, bearbeiter) VALUES (${jRef}, ${kJ.personId}, 'DE', 'privat', ${tagPlus(heuteIso, -20)}, 'rueckstand', 'datenkopie', 'in_arbeit', 'Prüfstand') RETURNING id`) as any[];
    await LI.beschaffungBeiEigenemUpload(kJ.personId, "kunde", null);
    const [aj] = await LI.beschaffungListe({ id: Number(bj.id) });
    ok(aj.status === "in_arbeit" && /Datenkopie vom Kunden eingegangen/.test(aj.notiz ?? "") && !/Leistung klären|Erstattung/.test(aj.notiz ?? ""), `Nachprüfung: Datenkopie-Weg — Kunden-Upload ist die Lieferung, kein Klärfall (${aj.status}: ${aj.notiz})`);
    const [tj] = (await sqlPool`SELECT titel, status FROM fiaon_betreiber_todos WHERE schluessel = ${`auskunft-datenkopie-da:${bj.id}`}`) as any[];
    ok(/prüfen und abschließen/.test(tj?.titel ?? "") && tj.status !== "erledigt", "Nachprüfung: Aufgabe „Datenkopie eingegangen — prüfen und abschließen“");
    ok((await LI.beschaffungAktion(Number(bj.id), "abschliessen", leitungA, "Datenkopie vollständig")).ok, "Abschließen ohne Upload");
    const [tj2] = (await sqlPool`SELECT status, ergebnis FROM fiaon_betreiber_todos WHERE schluessel = ${`auskunft-datenkopie-da:${bj.id}`}`) as any[];
    ok(tj2?.status === "erledigt", "Nachprüfung: Abschließen erledigt auch die Datenkopie-Aufgabe");

    // Nachprüfung 08.10.: bezahlt, keine Einwilligung, Link NIE zugestellt → Wache meldet es; danach erledigen sich Aufgaben selbst.
    const kL = await kunde("L", { auszug: false });
    const lRef = `FIAON-SCHUFA-${marke}-L`;
    await sqlPool`INSERT INTO fiaon_applications (ref, payment_reference, person_id, email, country, type, pack_key, payment_status, paid_at, created_at)
                  VALUES (${lRef}, ${`${lRef}-Z`}, ${kL.personId}, ${`it-d-${marke.toLowerCase()}-l@example.invalid`}, 'DE', 'schufa', 'schufa', 'paid', NOW() - INTERVAL '12 days', NOW() - INTERVAL '13 days')`;
    const [bl] = (await sqlPool`INSERT INTO fiaon_auskunft_beschaffung (ref, person_id, land, art, faellig_ab, quelle, modus, created_at) VALUES (${lRef}, ${kL.personId}, 'DE', 'privat', ${tagPlus(heuteIso, -10)}, 'rueckstand', 'einkauf', NOW() - INTERVAL '10 days') RETURNING id`) as any[];
    // Ohne E-Mail-Adresse: der Sammelknopf hilft nicht — die Wache stellt eine Einzelaufgabe (anrufen, Adresse klären).
    await sqlPool`UPDATE fiaon_persons SET primary_email = NULL WHERE id = ${kL.personId}`;
    await sqlPool`UPDATE fiaon_applications SET email = NULL WHERE person_id = ${kL.personId}`;
    const k1 = LI.wacheSchluessel(Number(bl.id));
    const todoStand = async (sch: string) => ((await sqlPool`SELECT status, ergebnis FROM fiaon_betreiber_todos WHERE schluessel = ${sch}`) as any[])[0] ?? null;
    const wl = await LI.beschaffungWache(sqlPool, { heuteIso });
    ok(wl.linkFehlt >= 1 && (await todoStand(k1.link_fehlt))?.status === "offen", `Nachprüfung: Wache meldet „Link nie zugestellt“ (ohne Adresse: Einzelaufgabe) an die Verantwortung (${wl.linkFehlt})`);
    await sqlPool`UPDATE fiaon_auskunft_beschaffung SET vollmacht_link_am = NOW() WHERE id = ${bl.id}`;
    await LI.beschaffungWache(sqlPool, { heuteIso });
    const t1 = await todoStand(k1.link_fehlt);
    ok(t1?.status === "erledigt" && /Automatisch erledigt/.test(t1.ergebnis ?? ""), `Nachprüfung: Link zugestellt → „Link fehlt“ automatisch erledigt (${t1?.ergebnis})`);
    await sqlPool`UPDATE fiaon_auskunft_beschaffung SET vollmacht_link_am = NOW() - INTERVAL '8 days' WHERE id = ${bl.id}`;
    const wa = await LI.beschaffungWache(sqlPool, { heuteIso });
    ok(wa.anrufe >= 1 && (await todoStand(k1.anruf))?.status === "offen", "Wache: Link unbestätigt → Anruf-Aufgabe");
    await sqlPool`INSERT INTO fiaon_contact_log (ref, person_id, agent_name, type, note) VALUES (${lRef}, ${kL.personId}, 'Kunde', 'system', ${"Beschaffungsauftrag ERTEILT über den Kauflink der E-Mail am 08.10.2026 (Fassung 2026-09-25)"})`;
    await LI.beschaffungWache(sqlPool, { heuteIso });
    const t2 = await todoStand(k1.anruf);
    ok(t2?.status === "erledigt" && /Einwilligung liegt vor/.test(t2.ergebnis ?? ""), `Nachprüfung: Kunde hat bestätigt → Anruf-Aufgabe automatisch erledigt (${t2?.ergebnis})`);
    // Querprüfung 08.10.2026 (Fund 8): der eine Weg — Art „auto“, „erledigt von“, Ereignis, Beitrag; von Hand Geöffnetes bleibt offen.
    const [t2v] = (await sqlPool`SELECT id, erledigt_art, erledigt_von, erledigt_ereignis,
                                         (SELECT COUNT(*)::int FROM fiaon_betreiber_todo_beitraege b WHERE b.todo_id = t.id AND b.text LIKE 'Automatisch erledigt (Liegezeit-Wache)%') AS beitraege
                                    FROM fiaon_betreiber_todos t WHERE schluessel = ${k1.anruf}`) as any[];
    ok(t2v?.erledigt_art === "auto" && t2v.erledigt_von === "Liegezeit-Wache" && /Einwilligung liegt vor/.test(String(t2v.erledigt_ereignis)) && Number(t2v.beitraege) >= 1,
      `Querprüfung: Wache erledigt über auftragErledigen (${JSON.stringify(t2v)})`);
    await sqlPool`UPDATE fiaon_betreiber_todos SET status = 'offen', wieder_offen_grund = 'von Prüfstand Leitung wieder geöffnet: Kunde ruft selbst zurück' WHERE id = ${t2v.id}`;
    const [wo] = (await sqlPool`SELECT wieder_offen_grund FROM fiaon_betreiber_todos WHERE id = ${t2v.id}`) as any[];
    const zuHand = await LI.wacheAufgabenSchliessen(Number(bl.id), [k1.anruf], "Prüfstand: erneut", sqlPool);
    ok(/^von /.test(String(wo?.wieder_offen_grund)) && zuHand === 0 && (await todoStand(k1.anruf))?.status !== "erledigt", `Querprüfung: von Hand wieder geöffnet → die Wache schließt nicht erneut (${wo?.wieder_offen_grund})`);
    await sqlPool`UPDATE fiaon_betreiber_todos SET status = 'erledigt', erledigt_am = NOW() WHERE id = ${t2v.id}`;
    const wd = await LI.beschaffungWache(sqlPool, { heuteIso });
    ok((await todoStand(k1.aufgabe))?.status === "offen" || (await todoStand(k1.dringend))?.status === "offen", `Wache: jetzt beschaffbar → Liegezeit-Aufgabe (${wd.texte.filter((t) => t.startsWith("Erika TeststegL")).join(" · ")})`);
    await LI.beschaffungAktion(Number(bl.id), "abschliessen", leitungA, "Prüfstand: geliefert");
    const t3 = (await todoStand(k1.aufgabe)) ?? (await todoStand(k1.dringend));
    ok(t3?.status === "erledigt", "Nachprüfung: Abschließen erledigt die Liegezeit-Aufgabe");

    // Nachprüfung 08.10.: Kunden MIT Adresse und nie zugestelltem Link → EINE Sammelaufgabe mit Namen, keine Einzelflut.
    const kS = await kunde("S", { auszug: false });
    const sRef = `FIAON-SCHUFA-${marke}-S`;
    await sqlPool`INSERT INTO fiaon_applications (ref, payment_reference, person_id, email, country, type, pack_key, payment_status, paid_at, created_at)
                  VALUES (${sRef}, ${`${sRef}-Z`}, ${kS.personId}, ${`it-d-${marke.toLowerCase()}-s@example.invalid`}, 'DE', 'schufa', 'schufa', 'paid', NOW() - INTERVAL '12 days', NOW() - INTERVAL '13 days')`;
    const [bs] = (await sqlPool`INSERT INTO fiaon_auskunft_beschaffung (ref, person_id, land, art, faellig_ab, quelle, modus, created_at) VALUES (${sRef}, ${kS.personId}, 'DE', 'privat', ${tagPlus(heuteIso, -10)}, 'rueckstand', 'einkauf', NOW() - INTERVAL '10 days') RETURNING id`) as any[];
    const ws = await LI.beschaffungWache(sqlPool, { heuteIso });
    const [sammelTodo] = (await sqlPool`SELECT status, text FROM fiaon_betreiber_todos WHERE schluessel = ${LI.SAMMEL_LINK_FEHLT_SCHLUESSEL}`) as any[];
    ok(ws.linkFehlt >= 1 && sammelTodo?.status === "offen" && String(sammelTodo.text).includes("Erika TeststegS") && !(await todoStand(LI.wacheSchluessel(Number(bs.id)).link_fehlt)),
      "Nachprüfung: mit Adresse → eine Sammelaufgabe mit Namen (Sammelknopf), keine Einzelaufgabe");

    // Nachprüfung 08.10.: Sammelknopf zweimal zugleich → der zweite läuft nicht.
    const [s1, s2b] = await Promise.all([LI.auftragLinksAlleSenden(leitungA), LI.auftragLinksAlleSenden(leitungB)]);
    ok([s1, s2b].filter((x) => x.texte.some((t) => /läuft schon/.test(t))).length === 1, "Nachprüfung: paralleler Sammelknopf verschickt nicht doppelt");
  }

  abschnitt("B6 · Querprüfung 08.10.: endgültige DSGVO-Löschung nimmt Dateien, Akte und Vorgänge der Familie mit");
  {
    const LO = await import("../server/lib/fiaon-loeschen");
    const mk = async (n: string) => ((await sqlPool`INSERT INTO fiaon_persons (person_ref, first_name, last_name, primary_email)
      VALUES (${`${marke}-${n}`}, 'Lea', ${`Loeschprobe${n}`}, ${`it-d-${marke.toLowerCase()}-${n}@example.invalid`}) RETURNING id`) as any[])[0].id as number;
    const kopf = Number(await mk("LK")), dub = Number(await mk("LD"));
    await sqlPool`UPDATE fiaon_persons SET merged_into_person_id = ${kopf}, account_status = 'merged', is_blocked = TRUE WHERE id = ${dub}`;
    const lref = `FIAON-${marke}-LK`;
    // Ein Interessent ohne Zahlung, ohne Rechnung, ohne Provision → „endgültig".
    await sqlPool`INSERT INTO fiaon_applications (ref, payment_reference, person_id, first_name, last_name, email, country, type, pack_key, pack_name, payment_status, created_at)
                  VALUES (${lref}, ${`${lref}-Z`}, ${kopf}, 'Lea', 'LoeschprobeLK', ${`it-d-${marke.toLowerCase()}-lk@example.invalid`}, 'DE', 'privat', 'plus', 'FIAON Plus', 'pending_payment', NOW() - INTERVAL '3 days')`;
    const datei = async (pid: number, art: string, kat: string | null, name: string, ref: string | null = null) => {
      const inhalt = await pdfAus([`${name} ${pid} ${marke}`]);
      await sqlPool`INSERT INTO fiaon_dokumente (person_id, ref, art, kategorie, dateiname, mime, bytes, inhalt, quelle, doc_hash)
                    VALUES (${pid}, ${ref}, ${art}, ${kat}, ${name}, 'application/pdf', ${inhalt.length}, ${inhalt}, 'kunde', ${`${marke}-${pid}-${name}`})`;
    };
    await datei(kopf, "unterlage", "ausweis", "ausweis.pdf", lref);
    await datei(kopf, "unterlage", "kontoauszug", "auszug.pdf");
    await datei(kopf, "finanzauswertung", null, "FA-1-1.pdf");
    await datei(dub, "unterlage", "schufa", "auskunft-dublette.pdf");
    await sqlPool`INSERT INTO fiaon_unterlagen_akte (person_id, kategorie, ref, dateien) VALUES (${kopf}, 'ausweis', ${lref}, 1), (${dub}, 'schufa', NULL, 1)`;
    await sqlPool`INSERT INTO fiaon_vorgaenge (person_id, art, titel) VALUES (${dub}, 'brief', 'Brief der Dublette')`;
    await sqlPool`INSERT INTO fiaon_unterlagen_anfragen (person_id, arten, quelle, mail_status, adresse) VALUES (${dub}, ${["ausweis"]}, 'akte', 'gesendet', 'dub@example.invalid')`;
    const v = await LO.vorschau([kopf]);
    ok(v.endgueltig === 1 && v.kandidaten[0]?.art === "endgueltig", `Einteilung: unbezahlter Interessent → endgültig (${v.kandidaten[0]?.begruendung})`);
    const erg = await LO.ausfuehren([kopf], "Prüfstand", v.bestaetigung, "Querprüfung 08.10.");
    ok(erg.ok && erg.endgueltig === 1, `Löschung ausgeführt (${erg.meldung ?? erg.fehler})`);
    const fam = [kopf, dub];
    const [z] = (await sqlPool`
      SELECT (SELECT COUNT(*)::int FROM fiaon_dokumente WHERE person_id = ANY(${fam}) OR ref = ${lref}) AS dok,
             (SELECT COUNT(*)::int FROM fiaon_unterlagen_akte WHERE person_id = ANY(${fam})) AS akte,
             (SELECT COUNT(*)::int FROM fiaon_vorgaenge WHERE person_id = ANY(${fam})) AS vg,
             (SELECT COUNT(*)::int FROM fiaon_unterlagen_anfragen WHERE person_id = ANY(${fam})) AS anf,
             (SELECT COUNT(*)::int FROM fiaon_persons WHERE id = ANY(${fam})) AS pers,
             (SELECT COUNT(*)::int FROM fiaon_applications WHERE ref = ${lref}) AS best`) as any[];
    ok(z.dok === 0, `Keine Datei mehr in fiaon_dokumente — Unterlagen, Auswertungs-PDF und die Datei der Dublette (${z.dok})`);
    ok(z.akte === 0 && z.vg === 0 && z.anf === 0, `Akte je Kategorie, Vorgänge und Anfragen der Familie gelöscht (${z.akte}/${z.vg}/${z.anf})`);
    ok(z.pers === 0 && z.best === 0, `Kopf, Wegweiser der Dublette und Bestellung gelöscht (${z.pers}/${z.best})`);
    const [pr] = (await sqlPool`SELECT art, person_id FROM fiaon_loeschungen WHERE stapel = ${erg.stapel ?? ""}`) as any[];
    ok(pr?.art === "endgueltig" && Number(pr.person_id) === kopf, "Das Löschprotokoll bleibt (Art, Person, Vorgang)");
  }

  // ═════════════════════════════════════════════════════════════════════════
  // TEIL C — ECHTES PDF MIT CHROMIUM
  // ═════════════════════════════════════════════════════════════════════════
  if (!OHNE_PDF) {
    abschnitt("C · PDF: Chromium, Verzeichnis mit Seitenzahlen, Fußzeile");
    try {
      const pdfMod = await import("../server/lib/fiaon-finanzauswertung-pdf");
      const pdf = await pdfMod.finanzauswertungDrucken(beispielInhalt.inhalt);
      const ziel = path.join(wurzel, "..", "it-feedback", "d", "bau");
      fs.mkdirSync(ziel, { recursive: true });
      fs.writeFileSync(path.join(ziel, "probe-finanzauswertung.pdf"), pdf);
      const { pdfTextJeSeite } = await import("../server/lib/fiaon-pdf-lesen");
      const seiten = await pdfTextJeSeite(pdf);
      ok(seiten.length >= 10, `Mindestens zehn Seiten (${seiten.length})`);
      ok(!seiten.some((t) => /FAKAPITEL/.test(t.replace(/\s+/g, ""))), "Nachprüfung: keine Kapitelmarken in der Textschicht der Endfassung");
      ok(seiten.every((t, i) => t.includes(`Seite ${i + 1} von ${seiten.length}`)), "Fußzeile „Seite x von y“ auf jeder Seite");
      ok(seiten.some((t) => /kein SCHUFA-Score/.test(t)), "Kennzeichnung steht im gedruckten PDF");
      ok(pdf.length < 3 * 1024 * 1024, `Unter 3 MB (${Math.round(pdf.length / 1024)} KB)`);
      const verz = seiten[1] ?? "";
      ok(pdfMod.KAPITEL.every((k) => verz.includes(k.titel)) && /Auf einen Blick \d+/.test(verz.replace(/\s+/g, " ")), "Verzeichnis mit Seitenzahlen (zweiter Durchgang)");
    } catch (e) {
      ok(false, `Chromium-Druck: ${String((e as Error)?.message || e).slice(0, 200)}`);
    }
  }
  await sqlPool.end({ timeout: 2 }).catch(() => {});
}

console.log(`\n${fehler === 0 ? "✓" : "✗"} ${geprueft - fehler}/${geprueft} Prüfungen bestanden`);
process.exit(fehler === 0 ? 0 : 1);
