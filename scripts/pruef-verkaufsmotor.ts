// ═══════════════════════════════════════════════════════════════════════════
// PRÜFSTAND: DER VERKAUFSMOTOR VON FIAON GLOBAL (Register E-509, 12.11.2026)
//
// Prüft ohne Datenbank und ohne Netz, was Startseite, Konfigurator und Server gemeinsam lesen:
//   1  PREISE       eine Quelle; das Erfolgshonorar ist die Staffel aus E-505 (Beispiele wie im Register)
//   2  REGLER       jeder Rasterpunkt liegt auf dem Raster des Vertragsmotors; alte Paket-Links landen richtig
//   3  WEICHE       Selbstabschluss oder persönlicher Weg — jeder Sonderfall
//   4  EINGABE      Pflichtfelder, Bereinigung, nichts Fremdes in Namen
//   5  VERTRAG      die Parameter des Selbstabschlusses ergeben ein gültiges Angebot der Fassung C; der Vertrag behauptet
//                   keine abgeschlossene Prüfung, die Unterschrift ist frei, Betrag und Honorar folgen dem Regler
//   6  EINSTELLUNG  ohne Einstellung aus; alter Registerstand steht nicht im Vertrag; Grenzen; Probebetrieb („nurLeitung“):
//                   wer selbst abschließen darf (verkaufSperrGrund) und was die Seite je Aufrufer erfährt (verkaufSeitenSicht)
//   7  SCHUTZ       Zeit-Siegel, Bremsen
//   7b PROBEBETRIEB die Weiche in verkaufStarten selbst (Werkbank statt Datenbank): Besucher → Anfrage, Leitung → Angebot,
//                   ohne Schlüssel alles wie bisher
//   8  TEXTE        deutsch und englisch gleich gebaut; Wortwand (deutsch: Hauswand + E-188, englisch: GLOBAL_SCHAERFER_EN);
//                   kein Paketname, kein alter Preis; Mails
//   9  ÜBERBLICK    „Ihr Vertrag im Überblick“ folgt den Ziffern des Vertrags und gibt keinen Wortlaut öffentlich aus; der Kopf
//                   für Suchmaschinen sagt dasselbe wie die Seite
//  10  LEITPLANKE   „Bürgschaft“ steht auf keiner öffentlichen Fläche des Verkaufsmotors (Texte de/en, Fragen der Startseite,
//                   Kopf und Datenblock für Suchmaschinen, /llms.txt, Karte „Ein Produkt“, Mail vor dem Angebot, Antwort an die
//                   Seite, Quelltext von Startseite und Konfigurator) — im Vertrag selbst steht sie unverändert
//  11  LEITFADEN    (E-510, 13.11.2026) der Kanzlei-Ton auf Startseite und Honorarrechner: die sechs Schritte in Justins
//                   Reihenfolge, EIN Name je Handlung („Angebot anfordern“, „Gespräch vereinbaren“), jeder Betrag aus der
//                   Preisquelle und „mindestens“ statt „ab“, der Kapitalrahmen nie ohne S9 und den Miami-Satz, die zwei
//                   Fassungen des Satzes nach dem Absenden, die vier Antworten der 30-Sekunden-Probe, die neun Fragen mit
//                   ihren festen Sätzen, die Karte „Ein Mandat“ für Österreich und die Schweiz
//
// Aufruf: env -i HOME="$HOME" PATH="$PATH" TZ=Europe/Berlin CRONS=aus DOTENV_CONFIG_PATH=/dev/null SESSION_SECRET=pruefstand \
//           DATABASE_URL=postgresql://pruef@127.0.0.1:9/keine node_modules/.bin/tsx scripts/pruef-verkaufsmotor.ts
//         Exit 1 bei Fehlern.
// ═══════════════════════════════════════════════════════════════════════════
import * as V from "../shared/fiaon-global-verkauf";
import * as KC from "../shared/fiaon-global-angebot-kapital-c";
import { wandPruefen } from "../shared/fiaon-wortverbote";
import { GLOBAL_SCHAERFER, globalWortPruefenEn } from "../shared/fiaon-global-wortregeln";
import * as SZ from "../shared/fiaon-global-saetze";

let gut = 0; let schlecht = 0;
function ok(bedingung: unknown, was: string) {
  if (bedingung) gut++; else { schlecht++; console.log(`FEHLER  ${was}`); }
}
const gleich = (a: unknown, b: unknown, was: string) => ok(JSON.stringify(a) === JSON.stringify(b), `${was} — ist ${JSON.stringify(a)}, soll ${JSON.stringify(b)}`);

// ── 1 PREISE ────────────────────────────────────────────────────────────────
gleich(V.VERKAUF_PREISE, { gruendungCents: 279_900, fastTrackCents: 49_900, jahresCents: 69_900 }, "Preise: Gründung 2.799 €, Fast-Track 499 €, Jahresbetreuung 699 €");
const KURS = 1.1165;
for (const [usd, honorar] of [[50_000, 299_000], [100_000, 448_000], [150_000, 582_000], [250_000, 851_000], [500_000, 1_299_000], [750_000, 1_635_000], [950_000, 1_903_000], [1_000_000, 1_970_000]] as const) {
  const p = V.verkaufPreis(usd, KURS);
  gleich(p.erfolgCents, honorar, `Erfolgshonorar bei ${usd} US-$`);
  gleich(p.erfolgCents, KC.kapitalCStaffelHonorarCents(usd, KURS), `Erfolgshonorar ${usd}: dieselbe Funktion wie der Vertrag`);
  gleich(p.erstesJahrCents, 279_900 + honorar, `erstes Jahr bei ${usd} US-$`);
  gleich(p.erstesJahrMitFastTrackCents, 279_900 + 49_900 + honorar, `erstes Jahr mit Fast-Track bei ${usd} US-$`);
  gleich(p.rahmenEurCents, KC.kapitalCRahmenEuroCents(usd, KURS), `Rahmen in Euro bei ${usd}: dieselbe Funktion wie der Vertrag`);
}
gleich(V.verkaufEur(279_900, "de"), "2.799 €", "Euro deutsch");
gleich(V.verkaufEur(279_900, "en"), "€2,799", "Euro englisch");
gleich(V.verkaufUsd(150_000, "de"), "150.000 US-$", "Dollar deutsch");
gleich(V.verkaufUsd(150_000, "en"), "US$150,000", "Dollar englisch");
// Die Staffel selbst darf sich nie ändern (angenommene Verträge würden umgerechnet).
gleich(KC.KAPITAL_C_STAFFEL, { fassung: "E-505", stufen: [{ bisUsd: 100_000, bp: 500 }, { bisUsd: 250_000, bp: 300 }, { bisUsd: 500_000, bp: 200 }, { bisUsd: 1_000_000, bp: 150 }], mindestCents: 299_000, rundungCents: 1_000 }, "Staffel E-505 unverändert");
// Die Vorgaben des Vertragsmotors bleiben unberührt (Rückfall für Bestandsangebote).
gleich([KC.KAPITAL_C_VORGABEN.gruendungCents, KC.KAPITAL_C_VORGABEN.fastTrackCents, KC.KAPITAL_C_VORGABEN.erfolgCents, KC.KAPITAL_C_VORGABEN.jahresCents], [279_000, 49_900, 689_000, 69_900], "KAPITAL_C_VORGABEN unverändert");

// ── 2 REGLER ────────────────────────────────────────────────────────────────
const stopps = V.verkaufStopps();
gleich(stopps[0], 50_000, "Regler beginnt bei 50.000");
gleich(stopps[stopps.length - 1], 1_000_000, "Regler endet bei 1 Mio.");
gleich(stopps.length, 36, "36 Rasterpunkte");
ok(stopps.every((x, i) => i === 0 || x > stopps[i - 1]), "Rasterpunkte steigen");
const raster = { minUsd: V.VERKAUF_RAHMEN.minUsd, maxUsd: V.VERKAUF_RAHMEN.maxUsd, schrittUsd: V.VERKAUF_RAHMEN.schrittUsd };
ok(stopps.every((x) => KC.kapitalCRahmenGueltig(raster, x)), "jeder Rasterpunkt liegt auf dem Raster des Vertragsmotors");
ok(stopps.includes(V.VERKAUF_RAHMEN.startUsd) && stopps.includes(V.VERKAUF_RAHMEN.selbstMaxUsd), "Start und Selbst-Maximum sind Rasterpunkte");
ok(stopps.filter((x) => x > V.VERKAUF_RAHMEN.selbstMaxUsd).length === 1, "über dem Selbst-Maximum liegt nur die Million");
ok(V.verkaufStoppGueltig(150_000) && !V.verkaufStoppGueltig(155_000) && !V.verkaufStoppGueltig("150000") && !V.verkaufStoppGueltig(40_000) && !V.verkaufStoppGueltig(1_050_000), "gültig ist nur ein Rasterpunkt als Zahl");
gleich([V.verkaufUsdAusPaket("global_struktur"), V.verkaufUsdAusPaket("GLOBAL_BANKING"), V.verkaufUsdAusPaket("global_kapital"), V.verkaufUsdAusPaket("global_vip"), V.verkaufUsdAusPaket("pro")], [50_000, 100_000, 250_000, 1_000_000, null], "alte Paket-Links");
gleich([V.verkaufStoppNahe(1), V.verkaufStoppNahe(274_000), V.verkaufStoppNahe(276_000), V.verkaufStoppNahe(9e9)], [50_000, 250_000, 300_000, 1_000_000], "nächster Rasterpunkt");
gleich([V.verkaufPfad("de"), V.verkaufPfad("en"), V.verkaufPfad("de", { rahmen: 250_000 })], ["/business/start", "/en/business/start", "/business/start?rahmen=250000"], "Pfad des Konfigurators");

// ── 3 WEICHE ────────────────────────────────────────────────────────────────
const w = (i: V.VerkaufInteresse[], usd: number, land: V.VerkaufLand, bestand = false) => V.verkaufWeg({ interessen: i, usd, land, bestand });
gleich(w(["kapital"], 150_000, "DE"), "abschluss", "Deutschland mit Kapital: Selbstabschluss");
gleich(w(["kapital", "karten", "konto", "beratung"], 950_000, "CH"), "abschluss", "Schweiz, 950.000: Selbstabschluss");
gleich(w(["kapital"], 1_000_000, "DE"), "miami", "1 Mio.: Miami");
gleich(w(["kapital"], 150_000, "AT"), "vorhaben", "Österreich mit Kapital: persönlich");
gleich(w(["kapital"], 150_000, "ANDERES"), "vorhaben", "anderes Land: persönlich");
gleich(w(["karten"], 150_000, "DE"), "ohne_kapital", "ohne Kapital: persönlich");
gleich(w(["karten", "beratung"], 1_000_000, "AT"), "ohne_kapital", "ohne Kapital geht vor Miami und Land");
gleich(w(["kapital"], 150_000, "DE", true), "bestand", "bestehende Gesellschaft: Prüfung");
gleich(w(["karten"], 1_000_000, "AT", true), "bestand", "bestehende Gesellschaft geht vor allem");

// ── 4 EINGABE ───────────────────────────────────────────────────────────────
const basis = { sprache: "de", interessen: ["kapital", "karten"], usd: 150_000, land: "DE", bestand: false, anrede: "Herr", vorname: " Max ", nachname: "Mustermann", email: " Max@Beispiel.Example ", telefon: "+49 170 1234567", nachricht: "  Hallo  \n Welt " };
const e0 = V.verkaufEingabeLesen(basis);
ok(e0.ok, "gültige Eingabe");
if (e0.ok) {
  gleich(e0.eingabe.vorname, "Max", "Vorname bereinigt");
  gleich(e0.eingabe.email, "max@beispiel.example", "E-Mail klein und ohne Rand");
  gleich(e0.eingabe.nachricht, "Hallo Welt", "Nachricht ohne Zeilenumbrüche");
  gleich(e0.eingabe.interessen, ["kapital", "karten"], "Interessen");
}
const feld = (aenderung: Record<string, unknown>) => { const r = V.verkaufEingabeLesen({ ...basis, ...aenderung }); return r.ok ? "ok" : r.feld; };
gleich(feld({ interessen: [] }), "interessen", "ohne Interesse");
gleich(feld({ interessen: ["gold"] }), "interessen", "unbekanntes Interesse");
gleich(feld({ interessen: "kapital" }), "interessen", "Interessen als Text");
gleich(feld({ usd: 155_000 }), "usd", "Rahmen neben dem Raster");
gleich(feld({ usd: "150000" }), "usd", "Rahmen als Text");
gleich(feld({ land: "FR" }), "land", "unbekanntes Land");
gleich(feld({ land: "ch" }), "ok", "Land klein geschrieben");
gleich(feld({ vorname: "" }), "vorname", "Vorname fehlt");
gleich(feld({ vorname: "<script>" }), "vorname", "Zeichen im Vornamen");
gleich(feld({ nachname: "Muster\"mann" }), "nachname", "Anführungszeichen im Nachnamen");
gleich(feld({ nachname: "von der Müller-Lüdenscheidt" }), "ok", "langer Name mit Umlaut und Bindestrich");
gleich(feld({ email: "max@beispiel" }), "email", "E-Mail ohne Endung");
gleich(feld({ email: "max @beispiel.example" }), "email", "E-Mail mit Leerzeichen");
gleich(feld({ telefon: "123" }), "telefon", "Telefon zu kurz");
gleich(feld({ telefon: "+49 170 <b>1234567" }), "telefon", "Zeichen im Telefon");
gleich(feld({ anrede: "Dr." }), "ok", "unbekannte Anrede wird leer");
{ const r = V.verkaufEingabeLesen({ ...basis, anrede: "Dr.", sprache: "EN-gb", bestand: "ja" }); ok(r.ok && r.eingabe.anrede === "" && r.eingabe.sprache === "en" && r.eingabe.bestand === false, "Anrede leer, Sprache englisch, „bestand“ nur als echtes true"); }
{ const r = V.verkaufEingabeLesen({ ...basis, interessen: ["kapital", "kapital", "konto"] }); ok(r.ok && r.eingabe.interessen.length === 2, "doppelte Interessen zählen einmal"); }

// ── 5 VERTRAG ───────────────────────────────────────────────────────────────
const est = { kursUsdJeEur: KURS, kursDatum: "2026-11-06", buerginAktiv: false, buerginStandAm: "", team: [], selbstMaxUsd: V.VERKAUF_RAHMEN.selbstMaxUsd };
for (const usd of [50_000, 150_000, 250_000, 950_000]) {
  const par = KC.kapitalCNeuesAngebotParameter(V.verkaufAngebotParameter(usd, est));
  gleich(KC.kapitalCParameterFehler(par), null, `Parameter bei ${usd}: gültig`);
  ok(par.rahmenWahl && par.rahmenWahl.gewaehltUsd === usd && par.rahmenWahl.minUsd === 50_000 && par.rahmenWahl.maxUsd === 950_000 && par.rahmenWahl.schrittUsd === 10_000, `Regler bei ${usd}: 50.000 bis 950.000 in Zehntausendern`);
  gleich(par.erfolgCents, V.verkaufPreis(usd, KURS).erfolgCents, `Erfolgshonorar im Vertrag = Preis im Konfigurator (${usd})`);
  gleich(par.betragCents, V.verkaufPreis(usd, KURS).rahmenEurCents, `Betrag im Vertrag = Rahmen im Konfigurator (${usd})`);
  gleich([par.gruendungCents, par.fastTrackCents, par.jahresCents, par.zahlungszielTage], [279_900, 49_900, 69_900, 0], `Preise im Vertrag (${usd})`);
  ok(par.unterschriftFrei && par.datenVomKunden && par.fastTrackWahl && !par.ddAbgeschlossen, `Schalter (${usd}): Unterschrift frei, Angaben vom Kunden, Fast-Track wählbar, keine abgeschlossene Prüfung behauptet`);
  gleich([par.bundesstaat, par.staatenFassung, par.tempoFassung], ["Delaware", "E-465", KC.KAPITAL_C_TEMPO_FASSUNG], `Bundesstaat und Fassungen (${usd})`);
  ok(!par.bestand && !par.llcVorschlag, `kein Bestand, kein Namensvorschlag (${usd})`);
  const k = KC.kapitalCKundePruefen({ art: "privat", anrede: "Herr", vorname: "Max", nachname: "Mustermann", email: "max@beispiel.example", telefon: "+49 170 1234567", land: "DE" }, { nurKontakt: true });
  ok(k.ok, "Kunde aus dem Konfigurator (nur Kontakt) ist anlegbar");
  if (k.ok) {
    const d = { ref: "FIAON-IA-CMUSTER", fassung: KC.KAPITAL_C_FASSUNG, kunde: k.kunde, parameter: par, gueltigBis: "2026-11-19",
      buergin: { name: "Muster Partner LLC", bundesstaat: "Florida", anschrift: "1 Example Way, Miami, FL 33100, USA", registernummer: "L00000000000", vertreter: "Erika Muster", funktion: "Manager" } };
    const fehlt = KC.kapitalCPflichtFehlen(d);
    ok(fehlt.length === 1 && fehlt[0].startsWith("Auftraggeber:"), `vor den Angaben fehlt nur, was der Kunde selbst einträgt (${usd}) — ${JSON.stringify(fehlt)}`);
    const voll = { ...d, kunde: { ...k.kunde, geburtsdatum: "1980-01-15", strasse: "Musterweg 1", plz: "12345", ort: "Musterstadt" } };
    gleich(KC.kapitalCPflichtFehlen(voll), [], `mit den Angaben ist die Annahme frei (${usd})`);
    const vertrag = KC.kapitalCZiffern(voll).map((z) => z.absaetze.map((a) => (a.art === "p" ? a.text : [a.einleitung ?? "", ...a.zeilen].join(" "))).join(" ")).join(" ");
    ok(!/Due-Diligence-Prüfung des Auftraggebers mit positivem Ergebnis abgeschlossen/.test(vertrag), `Vertrag behauptet keine abgeschlossene Prüfung (${usd})`);
    ok(vertrag.includes(KC.kapitalCEur(par.erfolgCents)) && vertrag.includes(KC.kapitalCEur(par.betragCents)), `Vertrag nennt Honorar und Betrag des Reglers (${usd})`);
    ok(vertrag.includes("derzeit als inaktiv geführt") && !/Stand \d\d\.\d\d\.\d{4}\)/.test(vertrag.slice(vertrag.indexOf("derzeit als inaktiv geführt") - 5, vertrag.indexOf("derzeit als inaktiv geführt") + 60)), `Registerstand der Bürgin offen und ohne Datum (${usd})`);
  }
}
{ // Deckel aus der Einstellung
  const par = KC.kapitalCNeuesAngebotParameter(V.verkaufAngebotParameter(250_000, { ...est, selbstMaxUsd: 250_000 }));
  ok(par.rahmenWahl?.maxUsd === 250_000 && par.rahmenWahl.gewaehltUsd === 250_000, "Deckel 250.000 aus der Einstellung schneidet den Regler ab");
  const zuHoch = KC.kapitalCNeuesAngebotParameter(V.verkaufAngebotParameter(500_000, { ...est, selbstMaxUsd: 250_000 }));
  ok(zuHoch.rahmenWahl?.gewaehltUsd === 250_000, "ein Wert über dem Deckel landet auf dem Deckel");
}

// ── 6 EINSTELLUNG, 7 SCHUTZ (Server-Bausteine, rein) ────────────────────────
const S = await import("../server/lib/fiaon-global-verkauf");
{
  const aus = S.verkaufEinstellungAus(undefined, "2026-11-12");
  ok(!aus.an && aus.buergin === null && aus.grundAus === "Schalter aus", "ohne Einstellung: aus");
  gleich([aus.kursUsdJeEur, aus.kursDatum, aus.tagesGrenze, aus.selbstMaxUsd], [1.1165, "2026-11-06", 25, 950_000], "Vorgaben ohne Einstellung");
  ok(!S.verkaufEinstellungAus("kein json", "2026-11-12").an, "kaputte Einstellung: aus");
  ok(!S.verkaufEinstellungAus(JSON.stringify({ an: true }), "2026-11-12").an, "an, aber ohne Registernummer: aus");
  ok(!S.verkaufEinstellungAus(JSON.stringify({ an: "true", buerginRegister: "L00000000000" }), "2026-11-12").an, "„an“ nur als echtes true");
  const an = S.verkaufEinstellungAus(JSON.stringify({ an: true, buerginRegister: "L00000000000", buerginStandAm: "2026-11-09", kursUsdJeEur: 1.12, kursDatum: "2026-11-11", tagesGrenze: 40, selbstMaxUsd: 250_000 }), "2026-11-12");
  ok(an.an && an.buergin?.registernummer === "L00000000000" && an.buergin.name && an.buergin.anschrift && an.buergin.vertreter && an.buergin.funktion && an.buergin.bundesstaat, "an mit Registernummer: Bürgin vollständig");
  gleich(KC.kapitalCBuerginFehler(an.buergin), null, "Bürgin besteht die Prüfung des Vertragsmotors");
  gleich([an.kursUsdJeEur, an.kursDatum, an.tagesGrenze, an.selbstMaxUsd, an.buerginStandAm, an.buerginAktiv], [1.12, "2026-11-11", 40, 250_000, "2026-11-09", false], "Werte aus der Einstellung");
  gleich(S.verkaufEinstellungAus(JSON.stringify({ an: true, buerginRegister: "L1", buerginStandAm: "2026-11-01" }), "2026-11-12").buerginStandAm, "", "Registerstand älter als sieben Tage steht nicht im Vertrag");
  gleich(S.verkaufEinstellungAus(JSON.stringify({ an: true, buerginRegister: "L1", buerginStandAm: "2026-11-20" }), "2026-11-12").buerginStandAm, "", "Registerstand in der Zukunft zählt nicht");
  gleich(S.verkaufEinstellungAus(JSON.stringify({ an: true, buerginRegister: "L1", selbstMaxUsd: 5_000_000, tagesGrenze: 9999, kursUsdJeEur: 9 }), "2026-11-12").selbstMaxUsd, 950_000, "Deckel über dem Selbst-Maximum zählt nicht");
  gleich(S.verkaufEinstellungAus(JSON.stringify({ an: true, buerginRegister: "<L1>" }), "2026-11-12").buergin?.registernummer, "L1", "Registernummer bereinigt");

  // Probebetrieb: der freiwillige Schlüssel „nurLeitung“ — Vorgabe false, nur das echte true zählt.
  gleich([aus.nurLeitung, an.nurLeitung], [false, false], "ohne den Schlüssel „nurLeitung“: kein Probebetrieb");
  const probe = S.verkaufEinstellungAus(JSON.stringify({ an: true, buerginRegister: "L00000000000", nurLeitung: true }), "2026-11-12");
  ok(probe.an && probe.nurLeitung === true && probe.grundAus === null, "„nurLeitung“: true → Probebetrieb, der Schalter bleibt an");
  gleich([S.verkaufEinstellungAus(JSON.stringify({ an: true, buerginRegister: "L1", nurLeitung: "true" }), "2026-11-12").nurLeitung, S.verkaufEinstellungAus(JSON.stringify({ an: true, buerginRegister: "L1", nurLeitung: 1 }), "2026-11-12").nurLeitung, S.verkaufEinstellungAus(JSON.stringify({ an: true, buerginRegister: "L1", nurLeitung: false }), "2026-11-12").nurLeitung], [false, false, false], "„nurLeitung“ nur als echtes true");
  // Wer darf selbst abschließen? (rein — dieselbe Funktion lesen Seite und Weiche)
  gleich([S.verkaufSperrGrund(an, false), S.verkaufSperrGrund(an, true)], [null, null], "ohne Probebetrieb: Besucher und Leitung schließen selbst ab");
  gleich([S.verkaufSperrGrund(probe, false), S.verkaufSperrGrund(probe, true)], [S.VERKAUF_GRUND_PROBE, null], "Probebetrieb: Besucher → Grund, Leitung → frei");
  gleich(S.VERKAUF_GRUND_PROBE, "Probebetrieb: Selbstabschluss noch nicht für alle freigegeben", "Grund des Probebetriebs im Wortlaut (Meldung an Justin)");
  gleich([S.verkaufSperrGrund(aus, false), S.verkaufSperrGrund(aus, true), S.verkaufSperrGrund({ ...aus, nurLeitung: true }, true)], ["Schalter aus", "Schalter aus", "Schalter aus"], "Notschalter geht vor: auch die Leitung bekommt dann kein Angebot");
  gleich([S.verkaufSperrGrund(an, true, 250_000), S.verkaufSperrGrund(an, true, 260_000), S.verkaufSperrGrund({ ...probe, selbstMaxUsd: 250_000 }, false, 260_000)], [null, "Rahmen über dem Deckel des Selbstabschlusses", S.VERKAUF_GRUND_PROBE], "Deckel gilt für alle; im Probebetrieb nennt die Meldung zuerst den Probebetrieb");
  // Was die Seite beim Laden bekommt — „an“ nur, wenn für DIESEN Aufrufer wirklich ein Angebot entstünde.
  const sicht = (e: typeof an, leitung: boolean) => S.verkaufSeitenSicht(leitung, e) as Record<string, unknown>;
  gleich([sicht(an, false).an, sicht(an, true).an], [true, true], "Seitensicht ohne Probebetrieb: an für alle");
  gleich([sicht(probe, false).an, sicht(probe, true).an], [false, true], "Seitensicht im Probebetrieb: Besucher aus, Leitung an");
  gleich([sicht(aus, false).an, sicht(aus, true).an], [false, false], "Seitensicht mit Notschalter: aus für alle");
  gleich(Object.keys(sicht(probe, false)).sort(), ["an", "kursDatum", "kursUsdJeEur", "ok", "selbstMaxUsd", "siegel"], "Seitensicht: genau diese Felder — kein Grund, kein „nurLeitung“, nichts zur Bürgin");
  gleich(S.verkaufSiegelPruefen(sicht(probe, false).siegel, Date.now() + S.SIEGEL_MIN_MS), "gut", "Seitensicht: das Siegel ist gültig");
  ok(S.verkaufSeitenSicht.length === 0, "Seitensicht: ohne Angabe gilt der Aufrufer als Besucher (Vorgabe leitung = false)");
}
{
  const t0 = 1_800_000_000_000;
  const siegel = S.verkaufSiegel(t0);
  gleich(S.verkaufSiegelPruefen(siegel, t0 + 1_000), "zu_schnell", "Siegel: nach einer Sekunde zu schnell");
  gleich(S.verkaufSiegelPruefen(siegel, t0 + S.SIEGEL_MIN_MS), "gut", "Siegel: nach vier Sekunden gut");
  gleich(S.verkaufSiegelPruefen(siegel, t0 + S.SIEGEL_MAX_MS + 1), "alt", "Siegel: nach sechs Stunden alt");
  gleich(S.verkaufSiegelPruefen(siegel.replace(/.$/, (c) => (c === "0" ? "1" : "0")), t0 + 10_000), "ungueltig", "Siegel: verändert");
  gleich(S.verkaufSiegelPruefen(`${t0 - 60_000}.${siegel.split(".")[1]}`, t0 + 10_000), "ungueltig", "Siegel: fremde Zeit");
  gleich(S.verkaufSiegelPruefen("", t0), "ungueltig", "Siegel: leer");
  gleich(S.verkaufSiegelPruefen(undefined, t0), "ungueltig", "Siegel: fehlt");
}
{
  S.verkaufBremsenLeeren();
  const t0 = 1_800_000_000_000;
  const r = [0, 1, 2, 3, 4].map((i) => S.verkaufZuViel("203.0.113.7", `a${i}@beispiel.example`, t0 + i * 1_000));
  gleich(r, [false, false, false, false, true], "je Anschluss vier Versuche in fünfzehn Minuten");
  ok(!S.verkaufZuViel("203.0.113.8", "b@beispiel.example", t0) && S.verkaufZuViel("203.0.113.9", "b@beispiel.example", t0 + 30_000), "je Adresse ein Versuch in der Minute");
  ok(!S.verkaufZuViel("203.0.113.9", "b@beispiel.example", t0 + 61_000), "nach einer Minute wieder frei");
  S.verkaufBremsenLeeren();
  let zaehler = 0;
  for (let i = 0; i < 20; i++) if (!S.verkaufZuViel("203.0.113.10", `c${i}@beispiel.example`, t0 + i * 16 * 60_000)) zaehler++;
  gleich(zaehler, 12, "je Anschluss zwölf Versuche am Tag");
  S.verkaufBremsenLeeren();
}

// ── 7b PROBEBETRIEB: DIE WEICHE IN verkaufStarten (Werkbank statt Datenbank und Mail) ─────────────────────────────────
{
  type Ruf = { was: "angebot" | "anfrage" | "zaehlen"; weg?: string; grundAus?: string | null; leitung?: boolean };
  const einst = (extra: Record<string, unknown> = {}) => S.verkaufEinstellungAus(JSON.stringify({ an: true, buerginRegister: "L00000000000", ...extra }), "2026-11-12");
  let lauf = 0;
  async function starten(est: ReturnType<typeof einst>, o: { leitung?: boolean; usd?: number; land?: string; sprache?: string; heute?: number } = {}) {
    const rufe: Ruf[] = [];
    const werk: import("../server/lib/fiaon-global-verkauf").VerkaufWerk = {
      einstellung: () => est,
      heuteAngelegt: async () => { rufe.push({ was: "zaehlen" }); return o.heute ?? 0; },
      angebot: async (_e, _est, k) => { rufe.push({ was: "angebot", leitung: k.leitung }); return { status: 200, body: { ok: true, art: "angebot", url: "/business/angebot/muster" } }; },
      anfrage: async (_e, weg, _est, k, grundAus) => { rufe.push({ was: "anfrage", weg, grundAus, leitung: k.leitung }); return { status: 200, body: { ok: true, art: "anfrage", weg, danke: "persönlicher Weg", messRef: "global-anfrage-0" } }; },
    };
    lauf++;
    S.verkaufBremsenLeeren();
    const koerper = { ...basis, sprache: o.sprache ?? "de", usd: o.usd ?? 150_000, land: o.land ?? "DE", email: `probe${lauf}@beispiel.example`, siegel: S.verkaufSiegel(Date.now() - S.SIEGEL_MIN_MS - 1_000) };
    const antwort = await S.verkaufStarten(koerper, { ip: `198.51.100.${lauf}`, userAgent: "pruefstand", ...(o.leitung === undefined ? {} : { leitung: o.leitung }) }, werk);
    return { antwort, rufe };
  }
  const K = V.VERKAUF_TEXTE.de.konfig;
  const probe = einst({ nurLeitung: true });

  { // Besucher im Probebetrieb → Anfrage über den persönlichen Weg, mit dem Schlusstext des Notschalters; Justin liest den Grund.
    const { antwort, rufe } = await starten(probe);
    gleich(rufe, [{ was: "anfrage", weg: "abschluss", grundAus: S.VERKAUF_GRUND_PROBE }], "Probebetrieb, Besucher: es entsteht eine Anfrage — kein Angebot, kein Blick in die Datenbank");
    gleich([antwort.status, antwort.body.ok, antwort.body.art, antwort.body.aus, antwort.body.danke, antwort.body.titel], [200, true, "anfrage", true, K.fehler.aus, K.persoenlich.titel], "Probebetrieb, Besucher: derselbe freundliche Schluss wie beim Notschalter");
    ok(!/probe|leitung|freigegeben|chef/i.test(JSON.stringify(antwort.body)), "Probebetrieb, Besucher: die Antwort verrät nichts vom Probebetrieb");
  }
  { // derselbe Besucher mit leitung: false ausdrücklich
    const { rufe } = await starten(probe, { leitung: false });
    gleich(rufe.map((r) => r.was), ["anfrage"], "Probebetrieb, leitung = false: Anfrage");
  }
  { // Leitung im Probebetrieb → Angebot
    const { antwort, rufe } = await starten(probe, { leitung: true });
    gleich(rufe, [{ was: "zaehlen" }, { was: "angebot", leitung: true }], "Probebetrieb, Leitung: das Angebot entsteht (nach dem Blick auf die Tagesgrenze)");
    gleich([antwort.body.art, antwort.body.aus], ["angebot", undefined], "Probebetrieb, Leitung: Antwort ist das Angebot");
  }
  { // ohne den Schlüssel: alles wie bisher
    const ohne = einst();
    const besucher = await starten(ohne);
    gleich(besucher.rufe.map((r) => r.was), ["zaehlen", "angebot"], "ohne „nurLeitung“, Besucher: Angebot wie bisher");
    const leitung = await starten(ohne, { leitung: true });
    gleich(leitung.rufe.map((r) => r.was), ["zaehlen", "angebot"], "ohne „nurLeitung“, Leitung: Angebot wie bisher");
    const falsch = await starten(einst({ nurLeitung: "ja" }));
    gleich(falsch.rufe.map((r) => r.was), ["zaehlen", "angebot"], "„nurLeitung“: \"ja\" ist kein Probebetrieb");
  }
  { // Notschalter geht vor — auch für die Leitung
    const aus = S.verkaufEinstellungAus(JSON.stringify({ an: false, buerginRegister: "L00000000000", nurLeitung: true }), "2026-11-12");
    const { antwort, rufe } = await starten(aus, { leitung: true });
    gleich(rufe, [{ was: "anfrage", weg: "abschluss", grundAus: "Schalter aus", leitung: true }], "Notschalter im Probebetrieb: auch die Leitung schickt eine Anfrage");
    gleich([antwort.body.aus, antwort.body.danke], [true, K.fehler.aus], "Notschalter: Schlusstext");
  }
  { // die persönlichen Wege bleiben, was sie sind (kein „aus“, kein Grund)
    const miami = await starten(probe, { usd: 1_000_000 });
    gleich(miami.rufe, [{ was: "anfrage", weg: "miami", grundAus: null }], "Probebetrieb, 1 Mio.: der Miami-Weg wie immer");
    gleich(miami.antwort.body.aus, undefined, "Miami-Weg: kein „aus“ in der Antwort");
    const at = await starten(probe, { land: "AT", leitung: true });
    gleich(at.rufe, [{ was: "anfrage", weg: "vorhaben", grundAus: null, leitung: true }], "Probebetrieb, Österreich: persönlicher Weg — auch für die Leitung");
  }
  { // Tagesgrenze und Deckel gelten weiter (für die Leitung im Probebetrieb und für alle ohne ihn)
    const voll = await starten(probe, { leitung: true, heute: 25 });
    gleich(voll.rufe, [{ was: "zaehlen" }, { was: "anfrage", weg: "abschluss", grundAus: "Tagesgrenze 25 erreicht", leitung: true }], "Tagesgrenze erreicht: Anfrage");
    const deckel = await starten(einst({ selbstMaxUsd: 250_000 }), { usd: 500_000 });
    gleich(deckel.rufe, [{ was: "anfrage", weg: "abschluss", grundAus: "Rahmen über dem Deckel des Selbstabschlusses" }], "Rahmen über dem Deckel: Anfrage, ohne Blick in die Datenbank");
  }
  { // englisch: derselbe Weg, englischer Schluss
    const { antwort } = await starten(probe, { sprache: "en" });
    gleich([antwort.body.danke, antwort.body.titel], [V.VERKAUF_TEXTE.en.konfig.fehler.aus, V.VERKAUF_TEXTE.en.konfig.persoenlich.titel], "Probebetrieb, englisch: Schlusstext englisch");
  }
  S.verkaufBremsenLeeren();
  // Die Route reicht die Leitung an BEIDE Stellen weiter: an die Sicht beim Laden und an das Absenden.
  const fs = await import("fs"); const pfad = await import("path");
  const route = fs.readFileSync(pfad.resolve(import.meta.dirname, "../server/routes/fiaon-global-verkauf.ts"), "utf8");
  ok(/verkaufSeitenSicht\(istLeitung\(req\)\)/.test(route) && /leitung: istLeitung\(req\)/.test(route), "Route: istLeitung(req) geht an verkaufSeitenSicht und an verkaufStarten");
  ok(/Cache-Control", "private, no-store"/.test(route), "Route: die Antworten stehen nie im Zwischenspeicher (sonst sähe ein Besucher die Sicht der Leitung)");
}

// ── 8 TEXTE ─────────────────────────────────────────────────────────────────
function sammle(wert: unknown, pfad: string, aus: [string, string][]) {
  if (typeof wert === "string") { if (wert.trim()) aus.push([pfad, wert]); return; }
  if (typeof wert === "function") { try { sammle((wert as (...a: string[]) => unknown)("2.799 €", "06.11.2026"), `${pfad}()`, aus); } catch { /* nicht aufrufbar */ } return; }
  if (Array.isArray(wert)) { wert.forEach((x, i) => sammle(x, `${pfad}[${i}]`, aus)); return; }
  if (wert && typeof wert === "object") for (const [k, v] of Object.entries(wert)) sammle(v, `${pfad}.${k}`, aus);
}
function gestalt(wert: unknown): unknown {
  if (Array.isArray(wert)) return wert.map(gestalt);
  if (typeof wert === "function") return "fn";
  if (wert && typeof wert === "object") return Object.fromEntries(Object.entries(wert).map(([k, v]) => [k, gestalt(v)]));
  return wert === null ? "null" : typeof wert;
}
{
  // Deutsch und Englisch sind gleich gebaut (bis auf den einen Satz zur Vertragssprache, den nur Englisch trägt).
  const de = gestalt(V.VERKAUF_TEXTE.de) as any; const en = gestalt(V.VERKAUF_TEXTE.en) as any;
  de.konfig.form.vertragssprache = "x"; en.konfig.form.vertragssprache = "x";
  gleich(de, en, "deutsche und englische Texte haben dieselbe Gestalt");
  ok(V.VERKAUF_TEXTE.de.konfig.form.vertragssprache === null && !!V.VERKAUF_TEXTE.en.konfig.form.vertragssprache, "Satz zur Vertragssprache nur auf Englisch");
  gleich(V.VERKAUF_TEXTE.de.produkt.bereiche.map((b) => b.nr), ["I", "II", "III", "IV", "V", "VI", "VII", "VIII"], "acht Bereiche, römisch gezählt");
  // E-510 (13.11.2026) — vorher: „vier Schritte“ (gleich(…schritte.length, 4)). Nachher: die sechs Schritte des Sprachleitfadens
  // in Justins Reihenfolge; die Einzelheiten prüft Abschnitt 11.
  gleich(V.VERKAUF_TEXTE.de.ablauf.schritte.map((x) => x.titel), ["Gründung", "Unterlagen", "Konten", "Kreditkarten auf Wunsch", "Finanzierung", "Umschuldung und Aufstockung"], "sechs Schritte in Justins Reihenfolge");
}
const mailBeispiel = { anrede: "Herr" as const, vorname: "Max", nachname: "Mustermann", usd: 150_000, sprache: "de" as const };
const meldung = e0.ok ? (["abschluss", "miami", "bestand", "vorhaben", "ohne_kapital"] as const).map((x) => V.verkaufMeldungZeilen(e0.eingabe, x, KURS)) : [];
{
  const texte: [string, string][] = [];
  sammle(V.VERKAUF_TEXTE.de, "verkauf", texte);
  sammle(S.verkaufKundenMailTexte(mailBeispiel, "FIAON-IA-CMUSTER", "2026-11-19", false, KURS), "verkauf/mail", texte);
  sammle(S.verkaufKundenMailTexte({ ...mailBeispiel, anrede: "" }, "FIAON-IA-CMUSTER", "2026-11-19", true, KURS), "verkauf/mail-erneut", texte);
  let treffer = 0;
  for (const [pfad, text] of texte) {
    for (const t of wandPruefen(text, ["aufgabe_an_betreuer"])) {
      // „Garantie“ nur als Name der vertraglichen Geld-zurück-Garantie — nie „garantiert“ (wie bei Fassung C).
      if (/garant/i.test(t.treffer) && /Geld-zurück-Garantie/.test(text) && !/\bgarantier/i.test(text)) continue;
      treffer++; console.log(`WAND   ${pfad}: „${text.slice(0, 100)}“ → ${t.hinweis}`);
    }
    for (const r of GLOBAL_SCHAERFER) if (r.muster.test(text)) { treffer++; console.log(`E-188  ${pfad}: „${text.slice(0, 100)}“ → ${r.grund}`); }
    if (/\bPaket\w*\b/.test(text) && !/Keine Pakete/.test(text)) { treffer++; console.log(`PAKET  ${pfad}: „${text.slice(0, 100)}“`); }
    if (/Global (Struktur|Banking|Kapital|VIP)|2\.499|4\.999|6\.999|35\.999/.test(text)) { treffer++; console.log(`ALT    ${pfad}: „${text.slice(0, 100)}“`); }
    if (/\bFunding\b|Affiliate|\bgarantiert/i.test(text)) { treffer++; console.log(`WORT   ${pfad}: „${text.slice(0, 100)}“`); }
  }
  gleich(treffer, 0, `${texte.length} deutsche Texte: Wortwand`);
  ok(texte.length > 150, `deutsche Texte gesammelt (${texte.length})`);
}
{
  const texte: [string, string][] = [];
  sammle(V.VERKAUF_TEXTE.en, "verkauf", texte);
  sammle(S.verkaufKundenMailTexte({ ...mailBeispiel, sprache: "en" }, "FIAON-IA-CMUSTER", "2026-11-19", false, KURS), "verkauf/mail", texte);
  sammle(S.verkaufKundenMailTexte({ ...mailBeispiel, sprache: "en", anrede: "" }, "FIAON-IA-CMUSTER", "2026-11-19", true, KURS), "verkauf/mail-erneut", texte);
  let treffer = 0;
  for (const [pfad, text] of texte) {
    for (const t of globalWortPruefenEn(text)) { treffer++; console.log(`EN     ${pfad}: “${text.slice(0, 100)}” → ${t.hinweis}`); }
    if (/[äöüÄÖÜß]|\b(und|oder|nicht|mit|für|Ihre|Ihr)\b/.test(text)) { treffer++; console.log(`DEUTSCH ${pfad}: “${text.slice(0, 100)}”`); }
    if (/\bpackages?\b/i.test(text) && !/No packages/.test(text)) { treffer++; console.log(`PAKET  ${pfad}: “${text.slice(0, 100)}”`); }
    if (/\b(organiz|color|center\b|license\b|program\b)/i.test(text)) { treffer++; console.log(`US     ${pfad}: “${text.slice(0, 100)}”`); }
  }
  gleich(treffer, 0, `${texte.length} englische Texte: Wortregeln`);
}
{
  // Die Meldung an Justin: jeder Weg hat seinen Satz, Kontakt und Rahmen stehen drin; kein Kundentext.
  ok(meldung.length === 5 && meldung.every((z) => z.length >= 5 && z.some((x) => x.includes("max@beispiel.example")) && z.some((x) => x.includes("150.000 US-$"))), "Meldung an Justin: Kontakt und Rahmen in jedem Weg");
  ok(new Set(meldung.map((z) => z[0])).size === 5, "Meldung an Justin: jeder Weg mit eigenem ersten Satz");
  const mail = S.verkaufKundenMailTexte(mailBeispiel, "FIAON-IA-CMUSTER", "2026-11-19", false, KURS);
  ok(mail.absaetze[0] === "Sehr geehrter Herr Mustermann," && mail.daten.some((d) => d.wert.replace(/\s/g, " ") === "5.820 €") && mail.daten.some((d) => d.wert === "19.11.2026"), "Kundenmail: Anrede, Honorar, Gültigkeit");
  const mailEn = S.verkaufKundenMailTexte({ ...mailBeispiel, sprache: "en" }, "FIAON-IA-CMUSTER", "2026-11-19", false, KURS);
  ok(mailEn.absaetze[0] === "Dear Mr Mustermann," && mailEn.daten.some((d) => d.wert === "€5,820"), "Kundenmail englisch: Anrede, Honorar");
}

// ── 9 „IHR VERTRAG IM ÜBERBLICK“ UND SUCHMASCHINEN-KOPF ─────────────────────
// Bis 12.11.2026 stand hier der öffentliche Mustervertrag im Wortlaut. Der Wortlaut steht nur noch im persönlichen Angebot;
// öffentlich zeigt /business/mustervertrag den AUFBAU des Vertrags. Geprüft wird: Der Überblick folgt den Ziffern des Vertrags
// (damit er nie etwas anderes behauptet als der Vertrag), er gibt sich nicht als Wortlaut aus, und der Server gibt den Vertrag
// nicht mehr öffentlich aus.
const fsP = await import("fs"); const pfadP = await import("path");
const quelle = (datei: string) => fsP.readFileSync(pfadP.resolve(import.meta.dirname, "..", datei), "utf8");
/** Quelltext ohne Kommentare — für Proben, die nur gelten, was im Browser ankommt. */
const ohneKommentar = (text: string) => text.replace(/\/\*[\s\S]*?\*\//g, " ").split("\n").filter((z) => !/^\s*\/\//.test(z)).join("\n");
const musterDaten = (() => {
  const par = KC.kapitalCNeuesAngebotParameter(V.verkaufAngebotParameter(V.VERKAUF_RAHMEN.startUsd, est));
  const k = KC.kapitalCKundePruefen({ art: "privat", anrede: "Herr", vorname: "Max", nachname: "Mustermann", geburtsdatum: "1980-01-15", strasse: "Musterweg 1", plz: "12345", ort: "Musterstadt", land: "DE", email: "max@beispiel.example", telefon: "+49 170 1234567" }, { ohneAusweis: true });
  if (!k.ok) throw new Error(`Musterkunde: ${k.error}`);
  return { ref: "FIAON-IA-CMUSTER", fassung: KC.KAPITAL_C_FASSUNG, kunde: k.kunde, parameter: par, gueltigBis: "2026-11-19",
    buergin: { name: "Muster Partner LLC", bundesstaat: "Florida", anschrift: "1 Example Way, Miami, FL 33100, USA", registernummer: "L00000000000", vertreter: "Erika Muster", funktion: "Manager" } };
})();
{
  const ziffern = KC.kapitalCZiffern(musterDaten);
  gleich(ziffern.map((z) => z.nr), [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14], "Vertrag der Fassung C: vierzehn Ziffern");
  for (const sp of ["de", "en"] as const) {
    const T = V.VERKAUF_TEXTE[sp].vertrag;
    const nummern = T.punkte.filter((x) => x.nr !== "A").flatMap((x) => x.nr.split(/\D+/).filter(Boolean).map(Number));
    gleich(nummern, ziffern.map((z) => z.nr), `Überblick (${sp}): jede Ziffer des Vertrags kommt genau einmal vor`);
    gleich(T.punkte[T.punkte.length - 1].nr, "A", `Überblick (${sp}): am Ende die Anlage`);
    ok(T.punkte.every((x) => x.titel.trim() && x.text.trim().length >= 30), `Überblick (${sp}): jeder Punkt hat Titel und Satz`);
  }
  // Deutsch: Die Titel sind die des Vertrags (Ziffer 4 und 5 stehen als ein Punkt unter dem Titel der Ziffer 4).
  for (const x of V.VERKAUF_TEXTE.de.vertrag.punkte) {
    if (x.nr === "A") { ok(KC.kapitalCVertragInhalt(musterDaten).some((i) => i.marke === "A" && i.titel.endsWith(x.titel)), `Überblick: Titel der Anlage wie im Vertrag („${x.titel}“)`); continue; }
    const erste = Number(x.nr.split(/\D+/)[0]);
    gleich(x.titel, ziffern.find((z) => z.nr === erste)?.titel, `Überblick: Titel von Ziffer ${x.nr} wie im Vertrag`);
  }
  const de = V.VERKAUF_TEXTE.de.vertrag; const en = V.VERKAUF_TEXTE.en.vertrag;
  // E-510 — vorher: „bevor Sie unterschreiben“ und “personal offer”. Nachher (Leitfaden 3.2 und 4.1): ein Wort je Sache —
  // „unterzeichnen“; das eigene Papier heißt englisch “proposal”.
  ok(/nicht im Wortlaut/.test(de.lead) && /persönlichen Angebot/.test(de.lead) && /bevor Sie unterzeichnen/.test(de.lead), "Überblick: der Lead sagt, dass dies nicht der Wortlaut ist und wo der vollständige Vertrag steht");
  ok(/not word for word/.test(en.lead) && /personal proposal/.test(en.lead) && /before you sign/.test(en.lead) && /in German/.test(en.lead), "Überblick englisch: dasselbe, dazu die Vertragssprache");
  ok(/Wort für Wort/.test(de.vollText) && /lesen Sie ihn ganz/.test(de.vollText) && /word for word/.test(en.vollText) && /in full/.test(en.vollText), "Überblick: der Hinweis auf den vollständigen Vertrag im Angebot (beide Sprachen)");
  // Der Vertrag selbst wird nirgends öffentlich ausgegeben: keine Route, kein Baustein, kein Abruf auf der Seite.
  ok(!("verkaufMustervertragHtml" in S) && !("MUSTER_KONDITIONEN" in S), "Server: kein Baustein mehr, der den Vertrag mit Musterdaten öffentlich baut");
  const route = ohneKommentar(quelle("server/routes/fiaon-global-verkauf.ts"));
  ok(!/mustervertrag|VorschauHtml|kapitalC/i.test(route), "Route: gibt keinen Vertragstext öffentlich aus");
  const seite = ohneKommentar(quelle("client/src/pages/site/global-recht.tsx"));
  const ueberblick = seite.slice(seite.indexOf("export function GlobalMustervertragSeite"));
  ok(ueberblick.length > 500 && !/fetch\(|dangerouslySetInnerHTML|\/api\//.test(ueberblick) && /VERKAUF_TEXTE\[s\]\.vertrag/.test(ueberblick), "Seite: der Überblick lädt keinen Vertrag nach — er zeigt nur VERKAUF_TEXTE.vertrag");
  // Die Links nennen die Seite beim Namen (kein „Mustervertrag“ mehr, der einen Wortlaut verspräche).
  const { GLOBAL_FUSS_WOERTER, GLOBAL_WOERTER } = await import("../client/src/i18n/global");
  gleich([GLOBAL_FUSS_WOERTER.de.recht.find((r) => r.pfad === "/business/mustervertrag")?.text, GLOBAL_FUSS_WOERTER.en.recht.find((r) => r.pfad === "/en/business/mustervertrag")?.text], [de.linkName, en.linkName], "Fußzeile: der Link heißt wie die Seite (beide Sprachen)");
  // E-510 — vorher: die Vertrauensleiste aus dem Wörterbuch (GLOBAL_WOERTER.*.vertrauensleiste). Nachher: das Vertrauens-Band
  // aus den festen Sätzen (vier Tatsachen mit Verweis, Leitfaden 6.1) — sichtbarer Text und Text des Verweises.
  const band = (["de", "en"] as const).flatMap((sp) => SZ.vertrauensBand(sp).flatMap((z) => [z.text, z.verweisText ?? ""]));
  const oeffentlich = [JSON.stringify(V.VERKAUF_TEXTE), JSON.stringify(GLOBAL_WOERTER.de.fragen), JSON.stringify(GLOBAL_WOERTER.en.fragen), JSON.stringify(band), JSON.stringify(GLOBAL_FUSS_WOERTER)].join(" ");
  // (Die Adresse /business/mustervertrag bleibt, damit alte Links ankommen — gemeint ist das Wort im Text.)
  ok(!/(?<!\/business\/)Mustervertrag|model contract|sample contract/i.test(oeffentlich), "Startseite, Fragen, Fußzeile: kein „Mustervertrag“ mehr im Text");
}
{
  const { SEO_SEITEN } = await import("../shared/fiaon-seo-seiten");
  const start = (SEO_SEITEN as Record<string, any>)["/"];
  ok(!!start, "SEO: Eintrag „/“ da");
  gleich([start.titel, start.beschreibung], [V.VERKAUF_TEXTE.de.seo.titel, V.VERKAUF_TEXTE.de.seo.beschreibung], "SEO „/“ deutsch = Kopf der Seite");
  gleich([start.en.titel, start.en.beschreibung], [V.VERKAUF_TEXTE.en.seo.titel, V.VERKAUF_TEXTE.en.seo.beschreibung], "SEO „/en“ = Kopf der Seite");
  const alles = JSON.stringify(start);
  ok(!/2\.499|4\.999|6\.999|35\.999|2,499|4,999|6,999|35,999|Global (Struktur|Banking|Kapital|VIP|Structure|Capital)/.test(alles), "SEO „/“: kein alter Preis, kein Paketname");
  ok(alles.includes("2.799 €") && alles.includes("€2,799") && alles.includes("699 €") && alles.includes("€699"), "SEO „/“: der eine Preis und die Jahresbetreuung aus der einen Quelle");
  ok(start.titel.length <= 60 && start.en.titel.length <= 60 && start.beschreibung.length >= 110 && start.beschreibung.length <= 155 && start.en.beschreibung.length >= 110 && start.en.beschreibung.length <= 155, "SEO „/“: Längen von Titel und Beschreibung");
  const konfig = (SEO_SEITEN as Record<string, any>)["/business/start"];
  ok(konfig && !/Paket|package/i.test(JSON.stringify(konfig)), "SEO „/business/start“: ohne Paket");
  // Der Kopf verspricht nichts, was im persönlichen Weg (Notschalter, Probebetrieb) nicht stimmt.
  ok(!/öffnet sich|ohne Wartezeit|no waiting|offer opens/i.test(JSON.stringify([start, konfig])), "SEO „/“ und „/business/start“: kein „öffnet sich sofort“, kein „ohne Wartezeit“ (gilt nicht für jeden Besucher)");
  const ueber = (SEO_SEITEN as Record<string, any>)["/business/mustervertrag"];
  const vt = V.VERKAUF_TEXTE;
  gleich([ueber?.titel, ueber?.beschreibung, ueber?.h1, ueber?.lead], [vt.de.vertrag.seo.titel, vt.de.vertrag.seo.beschreibung, `${vt.de.vertrag.h1a} ${vt.de.vertrag.h1b}`, vt.de.vertrag.lead], "SEO „/business/mustervertrag“ deutsch = Kopf der Seite");
  gleich([ueber?.en?.titel, ueber?.en?.beschreibung, ueber?.en?.h1, ueber?.en?.lead], [vt.en.vertrag.seo.titel, vt.en.vertrag.seo.beschreibung, `${vt.en.vertrag.h1a} ${vt.en.vertrag.h1b}`, vt.en.vertrag.lead], "SEO „/en/business/mustervertrag“ = Kopf der Seite");
  ok(/noindex/.test(String(ueber?.robots)) && ueber.titel.length <= 60 && ueber.en.titel.length <= 60 && [ueber.beschreibung, ueber.en.beschreibung].every((x: string) => x.length >= 110 && x.length <= 155), "SEO „/business/mustervertrag“: noindex, Längen von Titel und Beschreibung");
}

// ── 10 LEITPLANKE: „BÜRGSCHAFT“ STEHT NICHT AUF ÖFFENTLICHEN SEITEN ─────────
// Regel der Firma (30.10.2026, gilt weiter): Die Bürgschaft der US-Partnergesellschaft wird öffentlich nicht beworben. Sie steht
// nur dort, wo sie Vertragsinhalt ist — im persönlichen Angebot hinter dem privaten Link (/business/angebot/<Link>, Vertrag der
// Fassung C mit allen Hinweisen). Diese Wand liest jede öffentliche Fläche des Verkaufsmotors. Auf den übrigen Unterseiten
// (Wissens-Artikel erklären das Wort allgemein) hält scripts/pruef-global-seiten.ts die Wand Satz für Satz.
{
  const WAND = /b(ü|ue)rg|guarantor|surety|guaranty/i;
  // Der Hinweis zum Registerstand gehört zur Bürgschaft — und „Partnergesellschaft“ steht im Verkaufsmotor nur im Vertrag.
  const REGISTER = /inaktiv|inactive|als aktiv geführt|listed as active/i;
  const PARTNERGES = /Partnergesellschaft|partner company/i;
  const funde: string[] = [];
  const lies = (wert: unknown, ort: string, streng = false) => {
    const texte: [string, string][] = [];
    sammle(wert, ort, texte);
    for (const [pfad, text] of texte) {
      const m = text.match(WAND) ?? text.match(REGISTER) ?? (streng ? text.match(PARTNERGES) : null);
      if (m) funde.push(`${pfad}: „${m[0]}“ in „${text.slice(Math.max(0, (m.index ?? 0) - 50), (m.index ?? 0) + 60).replace(/\s+/g, " ")}“`);
    }
    return texte.length;
  };
  let n = 0;
  // 1 Jeder Satz von Startseite, Konfigurator, Karte, Überblick — deutsch und englisch, ganz.
  n += lies(V.VERKAUF_TEXTE.de, "verkauf/de", true);
  n += lies(V.VERKAUF_TEXTE.en, "verkauf/en", true);
  // 2 Die Sätze des einen Produkts auf den Unterseiten (Karte „Ein Produkt“, Preis, Erfolgshonorar).
  const { EIN_PRODUKT } = await import("../shared/fiaon-global-seiten/ein-produkt");
  n += lies(EIN_PRODUKT, "ein-produkt", true);
  // 3 Die Fragen der Startseite — sichtbar (Wörterbuch) und als Markup für Suchmaschinen.
  const { GLOBAL_WOERTER, GLOBAL_FUSS_WOERTER } = await import("../client/src/i18n/global");
  const { SEO_SEITEN, seoFragen } = await import("../shared/fiaon-seo-seiten");
  n += lies([GLOBAL_WOERTER.de.fragen, GLOBAL_WOERTER.en.fragen], "startseite/fragen", true);
  n += lies([seoFragen("/"), seoFragen("/en"), seoFragen("/business/privatpersonen"), seoFragen("/en/business/private-individuals")], "startseite/faq-markup", true);
  // E-510 — vorher: mindestens zehn Fragen im FAQ-Markup (die Startseite trug vierzehn). Nachher: die Startseite trägt die neun
  // Fragen des Leitfadens (8.5); acht davon sind reine Zeichenketten und stehen im Markup — die Honorar-Frage setzt ihre Beträge
  // aus der Preisquelle ein (kein Betrag wird getippt) und steht deshalb sichtbar auf der Seite, aber nicht im Markup.
  ok(seoFragen("/").length >= 8 && seoFragen("/en").length >= 8, `Fragen der Startseite gelesen (${seoFragen("/").length} deutsch, ${seoFragen("/en").length} englisch)`);
  // 4 Kopf der Startseite, des Konfigurators und des Überblicks in der SEO-Tabelle.
  for (const pfad of ["/", "/business/start", "/business/mustervertrag", "/business/privatpersonen"]) n += lies((SEO_SEITEN as Record<string, unknown>)[pfad], `seo${pfad}`, true);
  // 5 Fußzeile und Menü.
  const { GLOBAL_MENUE } = await import("../shared/fiaon-global-menue");
  n += lies([GLOBAL_FUSS_WOERTER, GLOBAL_MENUE], "fuss-und-menue", true);
  // 6 Die Mail an den Kunden VOR dem Öffnen des Angebots (mit dem Link) — alle vier Fassungen.
  for (const sprache of ["de", "en"] as const) for (const erneut of [false, true]) n += lies(S.verkaufKundenMailTexte({ ...mailBeispiel, sprache }, "FIAON-IA-CMUSTER", "2026-11-19", erneut, KURS), `mail/${sprache}${erneut ? "/erneut" : ""}`, true);
  // 7 Die Antwort an die Seite (GET /api/fiaon/global/verkauf) — für Besucher und Leitung, mit und ohne Probebetrieb.
  const mitBuergin = S.verkaufEinstellungAus(JSON.stringify({ an: true, buerginRegister: "L00000000000", buerginAktiv: true, buerginStandAm: "2026-11-11", nurLeitung: true }), "2026-11-12");
  for (const leitung of [false, true]) n += lies(JSON.stringify(S.verkaufSeitenSicht(leitung, mitBuergin)), `sicht/${leitung ? "leitung" : "besucher"}`, true);
  gleich(funde, [], `Leitplanke: ${n} öffentliche Texte des Verkaufsmotors ohne „Bürgschaft“, Registerstand und Partnergesellschaft`);
  ok(n > 600, `Leitplanke: genug Texte gelesen (${n})`);

  // 8 Was Suchmaschinen und Assistenten wirklich bekommen: Vorab-HTML mit Datenblock (JSON-LD) und /llms.txt.
  await import("../server/lib/fiaon-global-seo");
  const { seitenHtml } = await import("../server/lib/fiaon-seiten-seo");
  const { llmsTxt } = await import("../server/lib/fiaon-llms");
  for (const pfad of ["/", "/en", "/business/start", "/en/business/start", "/business/mustervertrag", "/en/business/mustervertrag", "/business/privatpersonen", "/en/business/private-individuals", "/business/kosten", "/en/business/costs", "/business/ablauf"]) {
    const html = (seitenHtml(pfad) ?? "").replace(/<style[\s\S]*?<\/style>/g, " ");
    ok(html.length > 2000, `${pfad}: Vorab-HTML da`);
    const ld = [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)].map((x) => x[1]).join(" ");
    ok(ld.length > 200, `${pfad}: Datenblock (JSON-LD) da`);
    const m = html.match(WAND) ?? html.match(REGISTER);
    ok(!m, `${pfad}: Vorab-HTML oder Datenblock nennt „${m?.[0]}“ bei „…${m ? html.slice(Math.max(0, m.index! - 80), m.index! + 40).replace(/\s+/g, " ") : ""}…“`);
  }
  const llmsGlobal = llmsTxt().split("## FIAON Bonität")[0];
  const lm = llmsGlobal.match(WAND) ?? llmsGlobal.match(REGISTER) ?? llmsGlobal.match(PARTNERGES);
  ok(llmsGlobal.length > 800 && !lm, `/llms.txt (FIAON Global): „${lm?.[0]}“ bei „…${lm ? llmsGlobal.slice(Math.max(0, lm.index! - 80), lm.index! + 40).replace(/\s+/g, " ") : ""}…“`);
  ok(llmsGlobal.includes(V.VERKAUF_TEXTE.de.produkt.preisFein) && llmsGlobal.includes(V.VERKAUF_TEXTE.de.produkt.bereiche[6].zeile), "/llms.txt: Preiszeile und Kapital-Zeile kommen aus VERKAUF_TEXTE (eine Quelle)");

  // 9 Der Quelltext, der im Browser ankommt: kein fest getippter Satz, kein Feld, keine Klasse mit dem Wort.
  for (const datei of ["client/src/components/site/global/VerkaufKonfigurator.tsx", "client/src/components/site/global/VerkaufProdukt.tsx", "client/src/lib/verkauf.ts",
    "client/src/pages/site/global-konfigurator.tsx", "client/src/pages/site/business.tsx", "client/src/pages/site/global-recht.tsx", "client/src/pages/site/global-seite.tsx",
    "client/src/components/site/GlobalNav.tsx", "client/src/components/site/GlobalFuss.tsx"]) {
    const m = ohneKommentar(quelle(datei)).match(WAND);
    ok(!m, `${datei}: „${m?.[0]}“ im Quelltext (ohne Kommentare)`);
  }
  const css = quelle("client/src/styles/global-verkauf.css").replace(/\/\*[\s\S]*?\*\//g, " ");
  ok(!WAND.test(css), `global-verkauf.css: Klasse mit „${css.match(WAND)?.[0]}“`);

  // 10 Im Vertrag selbst steht sie unverändert — die Wand gilt den öffentlichen Seiten, nicht dem Angebot.
  const z5 = KC.kapitalCZiffern(musterDaten).find((z) => z.nr === 5);
  ok(z5?.titel === "Bürgschaft der US-Partnergesellschaft" && JSON.stringify(z5).includes("derzeit als inaktiv geführt"), "Vertrag der Fassung C: Ziffer 5 mit Bürgschaft und Registerstand steht unverändert im Angebot");
  // Der Konfigurator zeigt statt der alten Frage zur Bürgschaft die Frage nach dem Angebot — dessen Antwort führt zum vollständigen Vertrag.
  // E-510 — vorher: „bevor Sie unterschreiben“. Nachher: „bevor Sie unterzeichnen“ (ein Wort je Sache, Leitfaden 3.2).
  ok(/vollständigen Vertrag/.test(V.VERKAUF_TEXTE.de.konfig.angebotFrage.antwort) && /bevor Sie unterzeichnen/.test(V.VERKAUF_TEXTE.de.konfig.angebotFrage.antwort) && /complete agreement/.test(V.VERKAUF_TEXTE.en.konfig.angebotFrage.antwort) && /before you sign/.test(V.VERKAUF_TEXTE.en.konfig.angebotFrage.antwort), "Honorarrechner: „Was steht in meinem Angebot?“ — die Antwort nennt den vollständigen Vertrag vor der Unterschrift");
}

// ── 11 LEITFADEN: DER KANZLEI-TON AUF STARTSEITE UND HONORARRECHNER (E-510, 13.11.2026) ─────────────────────────────
// Sprachleitfaden FIAON Global (verbindliche Endfassung vom 13.11.2026). Geprüft wird hier, was Startseite und Honorarrechner
// gemeinsam halten müssen; die Wörter selbst liest scripts/pruef-global-leitfaden.ts.
{
  const { GLOBAL_WOERTER, GLOBAL_FUSS_WOERTER, GLOBAL_BUEHNE_WOERTER } = await import("../client/src/i18n/global");
  const { EIN_PRODUKT } = await import("../shared/fiaon-global-seiten/ein-produkt");
  const alle = (wert: unknown): string[] => { const aus: [string, string][] = []; sammle(wert, "x", aus); return aus.map((x) => x[1]); };
  const woerter = (text: string) => text.split(/\s+/).filter((w) => /[\p{L}\p{N}]/u.test(w)).length;

  for (const sp of ["de", "en"] as const) {
    const T = V.VERKAUF_TEXTE[sp]; const W = GLOBAL_WOERTER[sp]; const Bt = SZ.SAETZE_BETRAEGE[sp];

    // 11.1 Die sechs Schritte: aus der einen Quelle, in Justins Reihenfolge, jeder Satz mit seiner Bedingung im selben Text.
    const sechs = SZ.sechsSchritte(sp).schritte;
    gleich(sechs.map((x) => x.nr), [1, 2, 3, 4, 5, 6], `sechs Schritte (${sp}): nummeriert 1 bis 6`);
    gleich(T.ablauf.schritte.map((x) => [x.nr, x.titel]), sechs.map((x) => [String(x.nr), x.titel]), `sechs Schritte (${sp}): Titel und Nummern der Seite = feste Sätze`);
    ok(T.ablauf.schritte.every((x, i) => x.text.includes(sechs[i].satz) && x.text.includes(sechs[i].bedingung)), `sechs Schritte (${sp}): jeder Satz steht mit seiner Bedingung im selben Text`);
    ok(sechs.every((x) => x.satz && x.bedingung && x.ihrTeil && x.ihrErgebnis && x.entscheidet), `sechs Schritte (${sp}): jeder Schritt hat Satz, Bedingung, Ihr Teil, Ihr Ergebnis und den, der entscheidet`);
    gleich(`${T.ablauf.h2a} ${T.ablauf.h2b}`, SZ.SCHRITTE_KOPF[sp].h2, `sechs Schritte (${sp}): Überschrift aus den festen Sätzen`);
    ok(sechs.filter((x) => x.ausbleiben).map((x) => x.nr).join() === "5", `sechs Schritte (${sp}): der Satz „wenn die Finanzierung ausbleibt“ steht bei Schritt 5 und nur dort`);
    // Solange es den Prüfschritt im Selbstabschluss nicht gibt (V1), heißt Schritt 5 nur „Finanzierung“ — ohne „Prüfung“ / “due diligence”.
    ok(!SZ.SAETZE_VORBEHALTE.V1 && !/Prüfung|Due Diligence/i.test(JSON.stringify([sechs[4].titel, sechs[4].satz, T.ablauf.schritte[4], T.produkt.bereiche[6], T.buehne, T.blick])), `Schritt 5 (${sp}): die Fassung „heute“ — kein „nach positiver Prüfung“`);
    ok(!SZ.SAETZE_VORBEHALTE.V3 && !SZ.SAETZE_VORBEHALTE.V4, "Vorbehalte V3 und V4 stehen auf „nein“ (Erklär-Satz S16 und Lang-Form der Garantie sind nicht eingebaut)");
    gleich(GLOBAL_BUEHNE_WOERTER[sp].bogenEtappenKurz, [...SZ.kurzwoerter(sp, "DE", 4)], `Kurzwörter der vier Plätze (${sp}): aus den festen Sätzen — ohne das alte Bildwort`);

    // 11.2 EIN Name je Handlung: die Haupt-Handlung heißt überall gleich, die zweite auch; kein Betrag in einem Knopf.
    const haupt = SZ.handlung("angebot", sp); const zweite = SZ.handlung("gespraech", sp);
    gleich([T.buehne.knopf, T.produkt.knopf, T.konfig.weiter, T.konfig.form.absenden, T.konfig.persoenlich.absenden, T.karte.knopf, T.karteLand.CH.knopf, T.leiste.zusammenstellen("2.799 €"), GLOBAL_FUSS_WOERTER[sp].beauftragen],
      Array(9).fill(haupt), `Haupt-Handlung (${sp}): auf jedem Knopf „${haupt}“ — Bühne, Urkunde, Honorarblatt, Formular (beide Betriebsarten), Karte, Leiste, Fuß`);
    gleich([T.buehne.knopfGespraech, W.knopfGespraech, GLOBAL_FUSS_WOERTER[sp].gespraech, T.karteLand.AT.knopf], Array(4).fill(zweite), `Zweite Handlung (${sp}): überall „${zweite}“ — auf der Österreich-Karte die einzige`);
    ok(!/\d/.test(T.leiste.zusammenstellen("2.799 €")), `Leiste am Handy (${sp}): kein Betrag im Knopf`);
    const alt = sp === "de" ? /Angebot zusammenstellen|selbst zusammen|Mein Angebot öffnen|Erst sprechen|Jetzt beauftragen|Weiter zu Ihren Angaben/ : /Build your offer|Put it together|Open my offer|Talk first|Order now|Prepare your proposal|Continue to your details/;
    const flaeche = [...alle(T), ...alle(W), ...alle(GLOBAL_FUSS_WOERTER[sp])];
    ok(!flaeche.some((x) => alt.test(x)), `Handlungen (${sp}): kein alter Name mehr („${flaeche.find((x) => alt.test(x))?.slice(0, 60) ?? ""}“)`);

    // 11.3 Beträge: jeder aus der Preisquelle; „mindestens“ statt „ab“; das Honorar nie nur mit dem ersten Betrag.
    gleich([Bt.honorarAuftrag, Bt.fastTrack, Bt.jahresbetreuung, Bt.erfolgMin], [V.verkaufEur(V.VERKAUF_PREISE.gruendungCents, sp), V.verkaufEur(V.VERKAUF_PREISE.fastTrackCents, sp), V.verkaufEur(V.VERKAUF_PREISE.jahresCents, sp), V.verkaufEur(KC.KAPITAL_C_STAFFEL.mindestCents, sp)], `Beträge der festen Sätze (${sp}) = Preisquelle und Mindestbetrag der Staffel`);
    const dreiZeilen = [T.blick.punkte[1].antwort, W.fragen[1].a, SZ.satz("S12", sp), EIN_PRODUKT[sp].preisSatz];
    ok(dreiZeilen.every((x) => x.includes(Bt.honorarAuftrag) && x.includes(Bt.erfolgMin) && x.includes(Bt.jahresbetreuung)), `Honorar in drei Zeilen (${sp}): Blick-Kasten, Honorar-Frage, S12 und die Unterseiten nennen alle drei Beträge`);
    ok([T.buehne.honorarZeile, T.produkt.preisFein, T.karte.fein, T.karteLand.CH.fein].every((x) => x.includes(Bt.erfolgMin) && /mindestens|at least/.test(x)), `Erfolgshonorar (${sp}): an der Zahl der Bühne, an der Urkunde und auf der Karte mit seinem Mindestbetrag — „mindestens“`);
    const euro = /\d{1,3}(?:[.,]\d{3})*\s?€|€\s?\d{1,3}(?:[.,]\d{3})*/g;
    // „2.799 €“ ist zugleich der Platzhalter, mit dem sammle() Sätze mit einer Lücke füllt (etwa den Satz zum Fast-Track).
    const erlaubt = new Set([Bt.honorarAuftrag, Bt.fastTrack, Bt.jahresbetreuung, Bt.erfolgMin, "2.799 €"].map((x) => x.replace(/\s/g, "")));
    // Der Platzhalter „1 € = … US-$“ im Kurs-Satz ist kein Honorar.
    const fremd = [...alle({ ...T, vertrag: null }), ...alle(W), ...alle(EIN_PRODUKT[sp])].flatMap((x) => (x.replace(/1\s€\s=|€1\s=/g, "").match(euro) ?? []).map((m) => m.replace(/\s/g, ""))).filter((m) => !erlaubt.has(m));
    gleich(fremd, [], `Euro-Beträge (${sp}): auf Startseite, Honorarrechner, Fragen und in den Sätzen der Unterseiten steht kein Betrag außerhalb der Preisquelle`);
    const abBetrag = sp === "de" ? /\b(?:schon\s+)?ab\s+\d[\d.]*\s?€|\bnur\s+\d[\d.]*\s?€/i : /\bfrom\s+(?:just\s+)?€\s?\d|\bonly\s+€\s?\d/i;
    ok(![...alle(T), ...alle(W), ...alle(EIN_PRODUKT[sp])].some((x) => abBetrag.test(x)), `Honorar (${sp}): nie „ab“ oder „nur“ vor einem Betrag`);

    // 11.4 Der Kapitalrahmen steht nie ohne S9 („ein Ziel, kein Versprechen“) und den Miami-Satz im selben Text.
    const mitSpanne = [...alle(T), ...alle(W), ...alle(EIN_PRODUKT[sp])].filter((x) => x.includes(Bt.rahmen) && x !== Bt.rahmen);
    ok(mitSpanne.length >= 4 && mitSpanne.every((x) => x.includes(SZ.satz("S9", sp)) && x.includes(SZ.weitererSatz("MIAMI", sp))), `Kapitalrahmen (${sp}): ${mitSpanne.length} Texte mit der Spanne — jeder mit S9 und dem Miami-Satz`);
    ok(T.buehne.kapitalSatz.includes(SZ.satz("S9", sp)) && T.buehne.kapitalSatz.includes(SZ.weitererSatz("MIAMI", sp)), `Kapitalrahmen im Kasten „Auf einen Blick“ (${sp}): S9 und Miami-Satz`);
    ok(T.konfig.rahmenInstitut === `${SZ.satz("S9", sp)} ${SZ.satz("S1", sp)}` && T.konfig.rahmenHinweis === SZ.weitererSatz("MIAMI", sp), `Am Regler (${sp}): S9, S1 und der Miami-Satz`);
    ok(![...alle(T), ...alle(W)].some((x) => /und mehr|and more/.test(x)), `Kapitalrahmen (${sp}): nie „und mehr“ (nach oben offen)`);

    // 11.5 Zwei Betriebsarten: Der Satz nach dem Absenden verspricht „öffnet sich“ nur dort, wo es für diesen Besucher stimmt.
    const oeffnet = sp === "de" ? /öffnet sich/ : /\bopens\b/;
    ok(oeffnet.test(T.konfig.leadB) && oeffnet.test(T.konfig.form.sub), `Betriebsart Selbstabschluss (${sp}): leadB und der Satz am Formular sagen, dass sich das Angebot öffnet`);
    const geteilt = [T.konfig.leadA, T.konfig.persoenlich.leadB, T.konfig.persoenlich.sub, T.konfig.persoenlich.titel, T.konfig.fehler.aus, T.konfig.weiter, T.konfig.form.titel, ...alle(T.konfig.wege), ...alle(T.buehne), ...alle(T.produkt), ...alle(T.karte), ...alle(T.karteLand), ...alle(T.seo), ...alle(T.blick), T.vertrag.weiter];
    ok(!geteilt.some((x) => oeffnet.test(x)), `Betriebsart persönlich und geteilte Flächen (${sp}): kein Satz verspricht, dass sich das Angebot öffnet`);
    ok(/E-Mail|email/.test(T.konfig.persoenlich.leadB) && /E-Mail|email/.test(T.konfig.fehler.aus), `Betriebsart persönlich (${sp}): das Angebot kommt per E-Mail`);
    ok(T.konfig.form.register.includes("FIAON LTD") && T.konfig.form.register.includes("17318250"), `Am Absende-Knopf (${sp}): Vertragspartner mit Registernummer`);
    ok(T.konfig.blatt.finanzierung === SZ.satz("S5-C", sp) && T.konfig.blatt.garantie === SZ.GELD_ZURUECK[sp].kurzMitNamen && T.konfig.blatt.endpreise === SZ.weitererSatz("HONORAR-SCHLUSS", sp), `Honorarblatt (${sp}): S5-C, Geld-zurück in der Kurz-Form mit Namen, Schluss-Zeile`);

    // 11.6 Die 30-Sekunden-Probe (Fassung A, Zeile „heute“): vier Antworten im Kasten direkt unter der Bühne.
    gleich(T.blick.punkte.length, 4, `30-Sekunden-Probe (${sp}): vier Fragen`);
    const [was, kostet, selbst, ausbleibt] = T.blick.punkte.map((x) => x.antwort);
    ok(sp === "de" ? /gründen/.test(was) && /Entscheidung des finanzierenden Instituts/.test(was) && /Reisepass/.test(selbst) && /stellen Sie selbst/.test(selbst) && /entscheidet das jeweilige Institut/.test(ausbleibt) && /acht Wochen ab Ihrem Auftrag/.test(ausbleibt) && /Ziffer 4/.test(ausbleibt)
      : /form your US company/.test(was) && /lender’s decision/.test(was) && /passport/.test(selbst) && /yourself/.test(selbst) && /rest with the institution concerned/.test(ausbleibt) && /eight weeks of your engagement/.test(ausbleibt) && /clause 4/.test(ausbleibt),
      `30-Sekunden-Probe (${sp}): was geschieht · was ich selbst tue · was gilt, wenn etwas ausbleibt (Institut, Frist mit Beginn, Ziffer 4)`);
    ok(kostet.includes(Bt.honorarAuftrag), `30-Sekunden-Probe (${sp}): was es kostet — und wann`);
    ok(woerter(T.buehne.lead) <= (sp === "de" ? 40 : 45), `Bühne (${sp}): Einleitung höchstens ${sp === "de" ? 40 : 45} Wörter (ist ${woerter(T.buehne.lead)})`);

    // 11.7 Die neun Fragen (Leitfaden 8.5) mit ihren festen Sätzen.
    gleich(W.fragen.length, 9, `Fragen der Startseite (${sp}): neun`);
    ok(W.fragen.every((x) => woerter(x.f) <= 12 && woerter(x.a) <= (sp === "de" ? 60 : 70)), `Fragen (${sp}): Frage höchstens zwölf Wörter, Antwort höchstens ${sp === "de" ? 60 : 70} (längste: ${Math.max(...W.fragen.map((x) => woerter(x.a)))})`);
    const s6 = SZ.satz("S6", sp).split(/(?<=\.)\s+/)[0]; const s10 = SZ.satz("S10", sp).split(/(?<=\.)\s+/);
    ok(W.fragen[7].a.startsWith(s6) && W.fragen[5].a.includes(SZ.satz("S11", sp)) && W.fragen[8].a.includes(SZ.weitererSatz("MIAMI", sp))
      && W.fragen[6].a.includes(s10[0].replace(/\.$/, "")) && W.fragen[4].a.includes(SZ.beleg("fuerWenNicht", sp).split(/(?<=\.)\s+/)[1]),
      `Fragen (${sp}): S6, S10, S11, der Miami-Satz und „für wen es nicht passt“ stehen wortgleich mit den festen Sätzen`);
    ok(/^(Nein|No)\./.test(W.fragen[2].a) && (sp === "de" ? /entscheidet allein das finanzierende Institut/ : /rests with the lender alone/).test(W.fragen[2].a), `Frage „Sagt FIAON eine Finanzierung zu?“ (${sp}): beginnt mit Nein, nennt das Institut`);
    ok((sp === "de" ? /acht Wochen ab Ihrem Auftrag/ : /eight weeks of your engagement/).test(W.fragen[3].a) && (sp === "de" ? /Ziffer 4/ : /clause 4/).test(W.fragen[3].a), `Frage „wenn die Finanzierung ausbleibt“ (${sp}): Frist mit Beginn und Ziffer 4`);
    ok(!W.fragen.some((x) => /Werktag|business day|rund zwei Wochen|around two weeks/.test(x.a)), `Fragen (${sp}): keine Dauer auf der Startseite`);

    // 11.8 Kopf für Suchmaschinen und Schluss-Satz: eine Fassung an zwei Stellen.
    gleich([W.metaTitel, W.metaBeschreibung], [T.seo.titel, T.seo.beschreibung], `Wörterbuch (${sp}): Titel und Beschreibung der Startseite = VERKAUF_TEXTE.seo`);
    ok(T.seo.titel.length <= 60 && T.seo.beschreibung.length <= 155 && T.vertrag.seo.titel.length <= 60 && T.vertrag.seo.beschreibung.length <= 155, `Kopf (${sp}): Titel höchstens 60, Beschreibung höchstens 155 Zeichen`);
    ok(!/Bürg|garantier|Garantie|guarantee|Umschuldung|refinanc|bis zu|up to|\d+\s?%|Kanzlei|law firm/i.test(JSON.stringify([T.seo, T.buehne.h1a, T.buehne.h1b])), `Kopf (${sp}): Titel, Beschreibung und H1 ohne die Wörter aus Leitfaden 9.1 Nr. 5`);
    gleich(`${W.schlussA}${W.schlussB}`, SZ.weitererSatz("SCHLUSS", sp), `Schluss-Satz (${sp}): aus den festen Sätzen`);
    ok(/gründen|Form your US company/.test(T.buehne.h1a), `H1 (${sp}): trägt das Suchwort sichtbar`);

    // 11.9 „Wenn die Finanzierung ausbleibt“: Name als Überschrift, Kurz-Form mit Fristbeginn, drei Zeilen, Ziffer 4 und Institut.
    const G = T.garantie; const s7 = SZ.satz("S7", sp).split(/(?<=\.)\s+/);
    ok(G.auge === SZ.GELD_ZURUECK[sp].auge && G.h2 === `${SZ.GELD_ZURUECK[sp].name}.` && G.text.startsWith(s7[0]) && G.fein === s7[1] && G.mittel.length === 3 && G.mittel.join("|") === SZ.GELD_ZURUECK[sp].mittel.join("|"),
      `Garantie-Abschnitt (${sp}): Augenzeile, Name, Kurz-Form mit Fristbeginn, Mittel-Form, Ziffer 4 und Institut — alles aus den festen Sätzen`);

    // 11.10 Die Karte „Ein Mandat“ der Unterseiten: eigene Fassung für Österreich und die Schweiz (Leitfaden 5.12).
    const at = alle(T.karteLand.AT).join(" \n "); const ch = alle(T.karteLand.CH).join(" \n ");
    ok(!/Konto|Konten|Karte|Finanzierung|Kapitalrahmen|Geld-zurück|Unternehmensberat|account|card|financing|funding|money-back|consultan/i.test(at) && !/\d\s?€|€\s?\d/.test(at) && !T.karteLand.AT.mitBetrag && T.karteLand.AT.zumGespraech,
      `Karte Österreich (${sp}): kein Konto, keine Karte, keine Finanzierung, kein Betrag, nicht „Unternehmensberatung“ — der Knopf führt zum Gespräch`);
    ok(at.includes(SZ.satz("S17", sp)) && T.karteLand.AT.fein === SZ.weitererSatz("HONORAR-AT", sp), `Karte Österreich (${sp}): S17 und der Honorar-Satz ohne Betrag`);
    ok(!/Konto|Konten|Kreditkarte|Karte|account|card/i.test(ch) && T.karteLand.CH.mitBetrag && ch.includes(SZ.satz("S1", sp)), `Karte Schweiz (${sp}): ohne Konto und Karten, mit dem Institut-Satz`);
    gleich([V.verkaufKarte(sp, sp === "de" ? "/business/aus-oesterreich" : "/en/business/from-austria") === T.karteLand.AT, V.verkaufKarte(sp, sp === "de" ? "/business/aus-der-schweiz" : "/en/business/from-switzerland") === T.karteLand.CH, V.verkaufKarte(sp, "/business/kosten") === T.karte, V.verkaufKarte(sp) === T.karte], [true, true, true, true], `Karte (${sp}): die Länderseiten bekommen ihre Fassung, alle anderen die allgemeine`);
    ok(/entscheidet das jeweilige Institut|rest with the institution concerned/.test(alle(T.karte).join(" ")), `Karte allgemein (${sp}): Konto, Karte und Finanzierung nur mit dem Satz, wer entscheidet`);

    // 11.11 Rollen: der Rollen-Satz statt „auf Ihr Mandat“; Recht und Steuern nie als Leistung von FIAON.
    ok(T.partnerSatz === SZ.weitererSatz("ROLLEN", sp) && EIN_PRODUKT[sp].partner === SZ.weitererSatz("ROLLEN", sp) && GLOBAL_FUSS_WOERTER[sp].keineBank === SZ.satz("S8", sp) && GLOBAL_FUSS_WOERTER[sp].keineBankAT === SZ.satz("S8", sp, "AT"), `Rollen (${sp}): Rollen-Satz und S8 (Österreich: S8-AT) aus den festen Sätzen`);
    ok(![...alle(T), ...alle(W), ...alle(GLOBAL_FUSS_WOERTER[sp]), ...alle(EIN_PRODUKT[sp])].some((x) => /auf Ihr Mandat|im eigenen Mandat|Rechtsberatung|Steuerberatung|under your engagement|under their own mandate|legal advice|tax advice/.test(x)), `Rollen (${sp}): kein „auf Ihr Mandat“, keine „Rechtsberatung“ oder „Steuerberatung“ als Leistung`);
    gleich(T.rolle.punkte.length, 4, `„Was FIAON ist — und was nicht“ (${sp}): vier Abgrenzungen`);
    ok(T.rolle.punkte[1].text.startsWith(SZ.satz("S8", sp).split(/(?<=\.)\s+/)[1]) && T.rolle.punkte[2].text === SZ.satz("S10", sp) && T.rolle.punkte[3].text === SZ.weitererSatz("ROLLEN", sp), `„Was FIAON ist — und was nicht“ (${sp}): die Sätze kommen aus den festen Sätzen`);
  }
  // 11.12 Die Seite zeigt, was die Texte sagen: sechs Schritte als eigener Baustein, die H1 ganz sichtbar, keine Tipp-Zeile.
  const seite = ohneKommentar(quelle("client/src/pages/site/business.tsx"));
  const buehne = ohneKommentar(quelle("client/src/components/site/global/HeroGlas.tsx"));
  const schritte = ohneKommentar(quelle("client/src/components/site/global/GlobalSchritte.tsx"));
  ok(/<GlobalSchritte /.test(seite) && /sechsSchritte\(sprache, land\)/.test(schritte) && /<ol /.test(schritte) && /<h3>/.test(schritte) && /s\.bedingung/.test(schritte) && /s\.ihrTeil/.test(schritte) && /s\.ihrErgebnis/.test(schritte) && /s\.entscheidet/.test(schritte),
    "Startseite: die sechs Schritte stehen als geordnete Liste mit Satz, Bedingung, Ihr Teil, Ihr Ergebnis und dem, der entscheidet");
  ok(/<h1 className="hg-h1">\{t\.h1a\} <em>\{t\.h1b\}<\/em><\/h1>/.test(buehne) && !/hg-sr">\{t\.h1b\}/.test(buehne) && !/TippZeile|wechsel/.test(buehne), "Bühne: die ganze Überschrift ist sichtbar — keine Tipp-Zeile, keine versteckte zweite Hälfte");
  ok(/<GlobalBlick /.test(buehne) && /t\.honorarZeile/.test(buehne), "Bühne: der Kasten „Auf einen Blick“ steht direkt darunter; an der Zahl steht die Zeile zum Erfolgshonorar");
  const folge = ["<HeroGlas ", "<GlobalVertrauen ", "<VerkaufProdukt ", "<GlobalSchritte ", "<VerkaufKonfigurator ", "<VerkaufGarantie ", "<VerkaufRolle ", "<GlobalGespraech ", "<Fragen ", 'className="fg-schluss'].map((x) => seite.indexOf(x));
  ok(folge.every((x, i) => x > 0 && (i === 0 || x > folge[i - 1])), `Startseite: Aufbau nach Leitfaden 7.1 (Bühne, Vertrauens-Band, Ein Mandat, sechs Schritte, Honorarrechner, Garantie, Rolle, Erstgespräch, Fragen, Schluss) — ${folge.join(",")}`);
  ok(!/SozialFenster|SternZentrale|GlobalBogen/.test(seite), "Startseite: nach dem Honorarrechner kein Abschnitt mehr, der erst überzeugen soll (kein Social-Fenster, kein Stern, kein Bogen)");
}

console.log(`\n${gut} Prüfungen grün, ${schlecht} rot.`);
if (schlecht) process.exitCode = 1;
