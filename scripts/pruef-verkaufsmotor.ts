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
//   6  EINSTELLUNG  ohne Einstellung aus; alter Registerstand steht nicht im Vertrag; Grenzen
//   7  SCHUTZ       Zeit-Siegel, Bremsen
//   8  TEXTE        deutsch und englisch gleich gebaut; Wortwand (deutsch: Hauswand + E-188, englisch: GLOBAL_SCHAERFER_EN);
//                   kein Paketname, kein alter Preis; Mails
//
// Aufruf: env -i HOME="$HOME" PATH="$PATH" TZ=Europe/Berlin CRONS=aus DOTENV_CONFIG_PATH=/dev/null SESSION_SECRET=pruefstand \
//           DATABASE_URL=postgresql://pruef@127.0.0.1:9/keine node_modules/.bin/tsx scripts/pruef-verkaufsmotor.ts
//         Exit 1 bei Fehlern.
// ═══════════════════════════════════════════════════════════════════════════
import * as V from "../shared/fiaon-global-verkauf";
import * as KC from "../shared/fiaon-global-angebot-kapital-c";
import { wandPruefen } from "../shared/fiaon-wortverbote";
import { GLOBAL_SCHAERFER, globalWortPruefenEn } from "../shared/fiaon-global-wortregeln";

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
  gleich(V.VERKAUF_TEXTE.de.ablauf.schritte.length, 4, "vier Schritte");
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

console.log(`\n${gut} Prüfungen grün, ${schlecht} rot.`);
if (schlecht) process.exitCode = 1;
