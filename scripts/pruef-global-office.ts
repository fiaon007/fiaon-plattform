// ═══════════════════════════════════════════════════════════════════════════
// PRÜFSTAND: DAS OFFICE-WERKZEUG FÜR FIAON GLOBAL (17.09.2026, E-188)
//
// REIN: keine Datenbank, kein Netz, kein Browser. Geladen werden nur
// client/src/pages/agent/global-logik.ts (ohne React), die Rundgänge, die
// geteilten Global-Texte und die Wortwand. `heute` wird jeder Rechnung als
// Parameter gereicht.
//
// WAS ER BELEGT
//   1. Die Liste: Reihenfolge (bezahlt-nicht-gestartet zuerst, dann nächste
//      Frist, dann Alter; Beendetes unten), die vier Kopfzahlen, Filter, Suche.
//   2. Das Lesen der Serverantwort: Eine leere, halbe oder falsch getypte
//      Antwort stürzt nicht ab — der Server entstand gleichzeitig in einem
//      anderen Zweig. Und eine vollständige Antwort kommt vollständig an.
//   3. Datum: ISO-Tag bleibt derselbe Tag (kein Zeitzonen-Rutsch), Berliner
//      „heute" an der Mitternachtskante, Tage bis zur Frist über die
//      Zeitumstellung hinweg.
//   4. Die Datei-Prüfung vor dem Hochladen: PDF/JPG/PNG/HEIC bis 15 MB.
//   5. Jeder Satz, den das Werkzeug dem KUNDEN vorschlägt, besteht die Wortwand
//      UND die schärferen Global-Regeln; die englischen Sätze die englischen
//      Verbote. Gegenprobe: Ein verbotener Satz wird erkannt.
//   6. Die schärferen Regeln in shared/fiaon-global-wortregeln.ts sind
//      wortgleich mit denen im Prüfstand scripts/pruef-wortwand-de.ts.
//   7. Der Kasten „Was ich dem Kunden NICHT zusage" findet seine Sätze im
//      Leitfaden — ändert dort jemand den Wortlaut, fällt es hier auf.
//   8. Die Rundgänge zeigen nur auf Stellen, die es in den Seiten gibt.
//   9. Die 50 Bundesstaaten und DC, jedes Kürzel einmal.
//
//   npx tsx scripts/pruef-global-office.ts
// ═══════════════════════════════════════════════════════════════════════════
import fs from "node:fs";
import path from "node:path";
import {
  zeileLesen, zeilenLesen, akteLesen, sortiere, kopfZahlen, filtere, FILTER_TEXT, STATUS_TEXT,
  isoTagAus, berlinTag, tageBis, tagText, zeitText, fristLage, groesseText, euroText,
  dateiPruefen, UPLOAD_MAX_BYTES, ETAPPEN_TITEL, ETAPPE_KUNDENTEXT, ETAPPE_KUNDENTEXT_EN, KUNDEN_PLATZHALTER, KUNDEN_PLATZHALTER_EN,
  etappeKundentext, etappenImPaket, kundentextHinweise, nichtZusagen, US_STAATEN, staatName, telLink, ART_SONSTIGES,
  type GlobalZeile,
} from "../client/src/pages/agent/global-logik";
import { GLOBAL_SCHAERFER, globalWortPruefen } from "../shared/fiaon-global-wortregeln";
import { GLOBAL_PFLICHTHINWEIS } from "../shared/fiaon-global";
import { RUNDGAENGE } from "../client/src/pages/agent/rundgaenge";

const WURZEL = path.resolve(import.meta.dirname ?? ".", "..");
let gut = 0;
let schlecht = 0;
const log = (s = "") => console.log(s);
function ok(text: string, bedingung: boolean, fund = ""): void {
  if (bedingung) { gut++; log(`  ok    ${text}`); }
  else { schlecht++; log(`  ROT   ${text}${fund ? `  →  ${fund}` : ""}`); }
}
function titel(t: string): void { log(`\n${"─".repeat(74)}\n${t}\n${"─".repeat(74)}`); }

const HEUTE = "2026-09-17";
const zeile = (o: Record<string, unknown>): GlobalZeile => zeileLesen({ firma: "Muster GmbH", paket: "global_struktur", status: "gestartet", ...o })!;

// ── 1. Die Liste ────────────────────────────────────────────────────────────
titel("1. Liste: Reihenfolge, Kopfzahlen, Filter, Suche");
{
  const zeilen = [
    zeile({ ref: "A-ALT", status: "gestartet", alterTage: 40 }),
    zeile({ ref: "B-FRIST-SPAET", status: "gestartet", alterTage: 5, naechsteFrist: { titel: "Annual Report", faelligAm: "2026-12-01" } }),
    zeile({ ref: "C-BEZAHLT", status: "bezahlt", alterTage: 1 }),
    zeile({ ref: "D-FRIST-FRUEH", status: "offen", alterTage: 2, betragCents: 249900, naechsteFrist: { titel: "Form 5472", faelligAm: "2026-10-01" } }),
    zeile({ ref: "E-STORNIERT", status: "storniert", alterTage: 90 }),
    zeile({ ref: "F-FERTIG", status: "abgeschlossen", alterTage: 200 }),
    zeile({ ref: "G-JUNG", status: "offen", alterTage: 3, betragCents: 499900 }),
    zeile({ ref: "H-UEBERFAELLIG", status: "gestartet", alterTage: 9, naechsteFrist: { titel: "Staatsgebühr", faelligAm: "2026-09-10" } }),
  ];
  const folge = sortiere(zeilen).map((z) => z.ref);
  ok("bezahlt-nicht-gestartet steht ganz oben", folge[0] === "C-BEZAHLT", folge.join(" "));
  ok("danach nach nächster Frist: überfällig vor früh vor spät", folge.slice(1, 4).join(",") === "H-UEBERFAELLIG,D-FRIST-FRUEH,B-FRIST-SPAET", folge.join(" "));
  ok("ohne Frist: der ältere Auftrag zuerst", folge.indexOf("A-ALT") < folge.indexOf("G-JUNG"), folge.join(" "));
  ok("Abgeschlossenes und Storniertes ganz unten, storniert zuletzt", folge.slice(-2).join(",") === "F-FERTIG,E-STORNIERT", folge.join(" "));
  ok("sortiere verändert die Eingabe nicht", zeilen[0].ref === "A-ALT");

  const z = kopfZahlen(zeilen, HEUTE);
  ok("offen unbezahlt = 2", z.offen === 2, String(z.offen));
  ok("offener Wert = 2.499 € + 4.999 €", z.offenCents === 749800, String(z.offenCents));
  ok("bezahlt, nicht gestartet = 1", z.bezahlt === 1);
  ok("in Arbeit = 3", z.inArbeit === 3, String(z.inArbeit));
  ok("Fristen in 30 Tagen = 2 (überfällig zählt mit, 01.12. nicht)", z.fristen30 === 2, String(z.fristen30));
  ok("eine Frist an einem stornierten Auftrag zählt nicht", kopfZahlen([zeile({ ref: "X", status: "storniert", naechsteFrist: { titel: "t", faelligAm: "2026-09-20" } })], HEUTE).fristen30 === 0);
  ok("Frist genau in 30 Tagen zählt, in 31 nicht", kopfZahlen([zeile({ ref: "X", naechsteFrist: { titel: "t", faelligAm: "2026-10-17" } })], HEUTE).fristen30 === 1
    && kopfZahlen([zeile({ ref: "X", naechsteFrist: { titel: "t", faelligAm: "2026-10-18" } })], HEUTE).fristen30 === 0);

  ok("Filter „Laufend“ blendet Storniertes und Abgeschlossenes aus", filtere(zeilen, "laufend", "").length === 6);
  ok("Filter „Bezahlt“ zeigt genau den einen", filtere(zeilen, "bezahlt", "").map((x) => x.ref).join() === "C-BEZAHLT");
  ok("Filter „Alle“ zeigt alle", filtere(zeilen, "alle", "").length === zeilen.length);
  ok("Suche findet die Referenz, Groß/klein egal", filtere(zeilen, "alle", "d-frist").length === 1);
  ok("Suche findet die Firma", filtere(zeilen, "alle", "muster").length === zeilen.length);
  ok("Suche ohne Treffer ist leer, kein Absturz", filtere(zeilen, "alle", "gibtesnicht").length === 0);
  ok("jeder Filter hat eine Beschriftung, jeder Stand einen Text", FILTER_TEXT.length === 6 && Object.keys(STATUS_TEXT).length === 5);
}

// ── 2. Die Serverantwort lesen ──────────────────────────────────────────────
titel("2. Serverantwort lesen — nichts stürzt ab, nichts geht verloren");
{
  for (const [name, wert] of [["null", null], ["Zahl", 7], ["Text", "x"], ["leeres Objekt", {}], ["ok ohne auftrag", { ok: true }], ["auftrag ohne ref", { auftrag: { firma: {} } }], ["auftrag als Liste", { auftrag: [] }]] as [string, unknown][]) {
    let geworfen = false; let erg: unknown = "—";
    try { erg = akteLesen(wert); } catch { geworfen = true; }
    ok(`akteLesen(${name}) → null, kein Absturz`, !geworfen && erg === null);
  }
  ok("zeilenLesen ohne zeilen → leere Liste", zeilenLesen({ ok: true }).length === 0 && zeilenLesen(null).length === 0);
  ok("Zeilen ohne ref fallen heraus", zeilenLesen({ zeilen: [{ firma: "X" }, null, 5, { ref: "R1" }] }).length === 1);

  const karg = akteLesen({ auftrag: { ref: "FIA-1" } })!;
  ok("karge Akte: Stand offen, Etappe 0, Zahlung offen", karg.status === "offen" && karg.etappe === 0 && karg.zahlung.status === "offen");
  ok("karge Akte: sechs Etappen mit den Titeln der Schnittstelle", karg.etappen.length === 6 && karg.etappen.map((e) => e.titel).join("|") === ETAPPEN_TITEL.join("|"));
  ok("karge Akte: leere Listen statt undefined", [karg.unterlagen, karg.dokumente, karg.fristen, karg.verlauf, karg.notizen, karg.verlaufAlles].every((l) => Array.isArray(l) && l.length === 0));
  ok("karge Akte: keine Links erfunden", karg.kundenLink === null && karg.vertragUrl === null && karg.rechnungUrl === null);
  ok("karge Akte: Upload bietet wenigstens „sonstiges“ an", karg.dokumentArten.length === 1 && karg.dokumentArten[0].art === ART_SONSTIGES);

  const schief = akteLesen({ auftrag: { ref: "FIA-2", status: "quatsch", etappe: "9", sprache: "fr", firma: "kein Objekt", zahlung: null, etappen: "nein", unterlagen: [null, { art: "" }, { art: "pass", titel: "Reisepass", vorhanden: "ja" }], dokumente: [{ name: "ohne id" }], fristen: [{ id: 3, titel: "ohne Datum" }, { id: "f1", titel: "Report", faelligAm: "2026-11-01T00:00:00.000Z", erledigt: 1 }], gesellschaft: { form: "GmbH", bundesstaat: "de", itinStand: "egal", einVorhanden: "true" }, intern: { notizen: "x", verlaufAlles: [{ text: "" }, { text: "Hallo", sichtbar: "true" }] } } })!;
  ok("unbekannter Stand wird „offen“, Etappe 9 wird 5, Sprache fr wird de", schief.status === "offen" && schief.etappe === 5 && schief.sprache === "de");
  ok("„vorhanden“ zählt nur als echtes true", schief.unterlagen.length === 1 && schief.unterlagen[0].vorhanden === false);
  ok("Dokument ohne id und Frist ohne Datum fallen heraus", schief.dokumente.length === 0 && schief.fristen.length === 1);
  ok("Frist als Mitternacht-UTC bleibt der 01.11.", schief.fristen[0].faelligAm === "2026-11-01" && schief.fristen[0].erledigt === false);
  ok("Gesellschaft: fremde Form leer, Staat groß, ITIN offen, EIN nur bei echtem true", schief.gesellschaft.form === "" && schief.gesellschaft.bundesstaat === "DE" && schief.gesellschaft.itinStand === "offen" && schief.gesellschaft.einVorhanden === false);
  ok("Verlauf: leerer Text fällt heraus, „sichtbar“ nur bei echtem true", schief.verlaufAlles.length === 1 && schief.verlaufAlles[0].sichtbar === false);

  const voll = akteLesen({ ok: true, auftrag: {
    ref: "FIA-3", status: "gestartet", sprache: "en", paket: "global_banking", paketName: "FIAON Global Banking",
    firma: { name: "Beispiel AG", ort: "Wien", land: "AT" }, zahlung: { status: "bezahlt" }, etappe: 2,
    etappen: [{ nr: 1, titel: "Gründung und Dokumente", text: "t", stand: "fertig", seit: "2026-09-01" }, { nr: 2, titel: "Die erste Firmenkarte", text: "t", stand: "jetzt", seit: "2026-09-10" }],
    stichtag: "2026-11-15", naechsterSchritt: { text: "Bitte laden Sie den Adressnachweis hoch.", bis: "2026-09-30" },
    ansprechpartner: { name: "Daniel Stripling", vorname: "Daniel", email: "d@example.org" },
    gesellschaft: { name: "Beispiel Holdings LLC", form: "LLC", bundesstaat: "WY", gegruendetAm: "2026-09-05", einVorhanden: true, itinStand: "beantragt" },
    unterlagen: [{ art: "pass", titel: "Reisepass", hinweis: "farbig", vorhanden: true }, { art: "adresse", titel: "Adressnachweis", hinweis: "", vorhanden: false }],
    dokumente: [{ id: 11, art: "pass", artText: "Reisepass", name: "pass.pdf", groesse: 120000, von: "kunde", am: "2026-09-12T08:00:00Z" }, { id: "12", art: "gruendung", artText: "Gründungsdokument", name: "articles.pdf", groesse: 80000, von: "fiaon", am: "2026-09-13T08:00:00Z", sichtbar: true }],
    fristen: [{ id: 1, titel: "Annual Report Wyoming", faelligAm: "2027-09-01", erledigt: false, hinweis: "Staatsgebühr", regel: true }],
    verlauf: [{ am: "2026-09-10T09:00:00Z", text: "Etappe 2" }], vertragUrl: "/v.pdf", rechnungUrl: "/r.pdf",
    kontakt: { anrede: "Frau", vorname: "Eva", nachname: "Muster", funktion: "Vorstand", email: "eva@example.org", telefon: "+43 1 234567" },
    firmaVoll: { name: "Beispiel AG", rechtsform: "AG", strasse: "Ring 1", plz: "1010", ort: "Wien", land: "AT", leer: "", zahl: 7 }, ustId: "ATU12345678",
    intern: { notizen: [{ id: 1, am: "2026-09-11T10:00:00Z", von: "Daniel", text: "intern", sichtbar: false }], verlaufAlles: [{ am: "2026-09-11T10:00:00Z", art: "notiz", text: "intern", sichtbar: false, von: "Daniel" }] },
    kundenLink: "/business/auftrag/FIA-3?t=abc",
  } })!;
  ok("volle Akte: Sprache en, Stand gestartet, Etappe 2, Stichtag", voll.sprache === "en" && voll.status === "gestartet" && voll.etappe === 2 && voll.stichtag === "2026-11-15");
  ok("volle Akte: Etappen 1/2 vom Server, 0 und 3–5 ergänzt", voll.etappen.length === 6 && voll.etappen[1].stand === "fertig" && voll.etappen[2].seit === "2026-09-10" && voll.etappen[0].stand === "fertig" && voll.etappen[3].stand === "offen");
  ok("volle Akte: Zahl-ids werden Text (für die Adresse der Route)", voll.dokumente[0].id === "11" && voll.fristen[0].id === "1" && voll.fristen[0].regel === true);
  ok("volle Akte: Sichtbarkeit unbekannt = null, bekannt = true", voll.dokumente[0].sichtbar === null && voll.dokumente[1].sichtbar === true);
  ok("volle Akte: Firmenfelder ohne leere, Zahl als Text", voll.firmaVoll.leer === undefined && voll.firmaVoll.zahl === "7" && voll.firmaVoll.strasse === "Ring 1");
  ok("volle Akte: Preis aus dem Katalog, wenn die Antwort keinen nennt", voll.betragCents === 499900, String(voll.betragCents));
  ok("volle Akte: Upload-Arten = Unterlagen + sonstiges", voll.dokumentArten.map((a) => a.art).join() === `pass,adresse,${ART_SONSTIGES}`);
  ok("nennt der Server dokumentArten, gilt seine Liste", akteLesen({ auftrag: { ref: "R", dokumentArten: [{ art: "ein", titel: "EIN-Bestätigung" }], unterlagen: [{ art: "pass", titel: "Pass" }] } })!.dokumentArten.map((a) => a.art).join() === "ein");
  ok("Liste: nächster Schritt als Text ODER als Objekt", zeileLesen({ ref: "R", naechsterSchritt: "Pass hochladen" })?.naechsterSchritt?.text === "Pass hochladen" && zeileLesen({ ref: "R", naechsterSchritt: { text: "x", bis: "2026-10-01" } })?.naechsterSchritt?.bis === "2026-10-01");
  ok("Liste: Betrag aus dem Katalog, wenn er fehlt", zeileLesen({ ref: "R", paket: "global_struktur" })?.betragCents === 249900);
}

// ── 3. Datum ────────────────────────────────────────────────────────────────
titel("3. Datum: derselbe Tag, Berliner Mitternacht, Zeitumstellung");
{
  ok("ISO-Tag bleibt, Mitternacht-UTC bleibt derselbe Tag", isoTagAus("2026-10-01") === "2026-10-01" && isoTagAus("2026-10-01T00:00:00.000Z") === "2026-10-01");
  ok("Zeitstempel 22:30 UTC im Sommer ist in Berlin schon der nächste Tag", isoTagAus("2026-09-17T22:30:00Z") === "2026-09-18");
  ok("Unsinn wird null, kein Absturz", isoTagAus("morgen") === null && isoTagAus(undefined) === null && isoTagAus({}) === null);
  ok("berlinTag an der Mitternachtskante (Sommer +2, Winter +1)", berlinTag(new Date("2026-09-17T21:59:00Z")) === "2026-09-17" && berlinTag(new Date("2026-09-17T22:00:00Z")) === "2026-09-18" && berlinTag(new Date("2026-12-31T23:00:00Z")) === "2027-01-01");
  ok("tagText setzt 01.10.2026 ohne Zeitzonen-Rechnung", tagText("2026-10-01") === "01.10.2026" && tagText(null) === "—");
  ok("zeitText zeigt Berliner Zeit", zeitText("2026-09-17T12:05:00Z").includes("14:05") && zeitText("") === "—");
  ok("tageBis über die Zeitumstellung 25.10.2026 hinweg: 24.→26. = 2", tageBis("2026-10-26", "2026-10-24") === 2);
  ok("tageBis: heute 0, gestern -1, Unsinn null", tageBis(HEUTE, HEUTE) === 0 && tageBis("2026-09-16", HEUTE) === -1 && tageBis("x", HEUTE) === null);
  ok("fristLage: überfällig rot, heute rot, morgen warn, in 30 warn, in 31 still", fristLage("2026-09-10", HEUTE).ton === "rot" && fristLage(HEUTE, HEUTE).text === "heute" && fristLage("2026-09-18", HEUTE).text === "morgen" && fristLage("2026-10-17", HEUTE).ton === "warn" && fristLage("2026-10-18", HEUTE).ton === "still");
  ok("fristLage ohne Datum: leer", fristLage(null, HEUTE).text === "");
  ok("Geld und Größe lesbar", euroText(249900) === "2.499 €" && euroText(62475) === "624,75 €" && euroText("x") === "—" && groesseText(120000) === "117 KB" && groesseText(0) === "");
}

// ── 4. Datei-Prüfung ────────────────────────────────────────────────────────
titel("4. Hochladen: PDF/JPG/PNG/HEIC bis 15 MB — geprüft, bevor etwas gesendet wird");
{
  ok("PDF, JPG, PNG, HEIC gehen", [["a.pdf", "application/pdf"], ["b.JPG", "image/jpeg"], ["c.png", "image/png"], ["d.heic", "image/heic"]].every(([name, type]) => dateiPruefen({ name, size: 1000, type }) === null));
  ok("HEIC ohne Typangabe geht über die Endung", dateiPruefen({ name: "IMG_1.HEIC", size: 1000, type: "" }) === null);
  ok("Word, ZIP, ausführbar: abgelehnt", ["x.docx", "x.zip", "x.exe", "ohneendung"].every((name) => dateiPruefen({ name, size: 1000, type: "" }) !== null));
  ok("falscher Typ trotz richtiger Endung: abgelehnt", dateiPruefen({ name: "x.pdf", size: 1000, type: "text/html" }) !== null);
  ok("genau 15 MB geht, ein Byte mehr nicht", dateiPruefen({ name: "x.pdf", size: UPLOAD_MAX_BYTES, type: "application/pdf" }) === null && dateiPruefen({ name: "x.pdf", size: UPLOAD_MAX_BYTES + 1, type: "application/pdf" }) !== null);
  ok("leere Datei und keine Datei: abgelehnt, in Du-Form", dateiPruefen({ name: "x.pdf", size: 0, type: "application/pdf" }) !== null && /wähl/.test(dateiPruefen(null) ?? ""));
}

// ── 5. Kundensätze ──────────────────────────────────────────────────────────
titel("5. Jeder vorgeschlagene Kundensatz besteht Wortwand und Global-Regeln");
{
  const deutsch: [string, string][] = [
    ...ETAPPE_KUNDENTEXT.map((t, i) => [`Etappe ${i}`, t] as [string, string]),
    ...Object.entries(KUNDEN_PLATZHALTER).map(([k, t]) => [`Platzhalter ${k}`, t] as [string, string]),
  ];
  for (const [wo, satz] of deutsch) {
    const funde = globalWortPruefen(satz);
    ok(`${wo}: keine Treffer`, funde.length === 0, funde.map((f) => `${f.treffer} (${f.hinweis})`).join("; "));
    ok(`${wo}: Sie-Form, kein Du`, !/\b(du|dein|deine|dir|dich)\b/i.test(satz), satz);
  }
  ok("sechs deutsche und sechs englische Etappen-Texte", ETAPPE_KUNDENTEXT.length === 6 && ETAPPE_KUNDENTEXT_EN.length === 6);
  ok("Etappen 2–4 nennen, WER entscheidet (Institut bzw. Bank)", [2, 3, 4].every((i) => /entscheidet/.test(ETAPPE_KUNDENTEXT[i]) && /(Institut|Bank)/.test(ETAPPE_KUNDENTEXT[i])));
  ok("englisch ebenso", [2, 3, 4].every((i) => /decide/.test(ETAPPE_KUNDENTEXT_EN[i]) && /(institution|bank)/i.test(ETAPPE_KUNDENTEXT_EN[i])));
  const EN_VERBOTEN = /\b(guarantee[sd]?|advice|recommend\w*|affiliate\w*|up to|within \d+ (days|weeks|months))\b|\b(capital one|american express|amex|bank of america|chase|mercury|brex|ramp)\b/i;
  for (const [wo, satz] of [...ETAPPE_KUNDENTEXT_EN.map((t, i) => [`Stage ${i}`, t]), ...Object.entries(KUNDEN_PLATZHALTER_EN).map(([k, t]) => [`Placeholder ${k}`, t])] as [string, string][]) {
    ok(`${wo}: keine englischen Verbotswörter, keine deutsche Wand`, !EN_VERBOTEN.test(satz) && globalWortPruefen(satz).length === 0, satz);
  }
  ok("etappeKundentext wählt die Sprache und klemmt die Nummer", etappeKundentext(2, "en") === ETAPPE_KUNDENTEXT_EN[2] && etappeKundentext(99, "de") === ETAPPE_KUNDENTEXT[5] && etappeKundentext(-3, "de") === ETAPPE_KUNDENTEXT[0]);

  // Gegenprobe: Die Prüfung KANN rot werden.
  const boese: [string, string][] = [
    ["Garantie", "Wir garantieren Ihnen die Karte."], ["bis zu", "Sie erhalten einen Rahmen bis zu 50.000 Dollar."],
    ["Frist mit Ziffer", "Die EIN liegt innerhalb von 4 Wochen vor."], ["Bankname", "Ihr Antrag bei Chase wird sicher bewilligt."],
    ["Steuerversprechen", "Damit können Sie Steuern sparen."], ["Empfehlung", "Wir empfehlen Ihnen Wyoming."], ["ohne Sicherheiten", "Die Karte kommt ohne Sicherheiten."],
  ];
  for (const [wo, satz] of boese) ok(`Gegenprobe ${wo}: wird erkannt`, kundentextHinweise(satz).length > 0, satz);
  ok("gedeckt: „meldet sich bei Ihnen“ schlägt im Werkzeug nicht an (die Person schreibt selbst)", kundentextHinweise("Ihr Ansprechpartner meldet sich bei Ihnen.").length === 0);
  ok("ungedeckt schlägt derselbe Satz an", globalWortPruefen("Ihr Ansprechpartner meldet sich bei Ihnen.").length === 1);
  ok("leerer Text: keine Hinweise", kundentextHinweise("   ").length === 0);
}

// ── 6. Eine Definition ──────────────────────────────────────────────────────
titel("6. Die schärferen Regeln sind wortgleich mit scripts/pruef-wortwand-de.ts");
{
  const pruefstand = fs.readFileSync(path.join(WURZEL, "scripts/pruef-wortwand-de.ts"), "utf8");
  const block = pruefstand.slice(pruefstand.indexOf("const SCHAERFER"), pruefstand.indexOf("];", pruefstand.indexOf("const SCHAERFER")));
  ok("der Prüfstand hat seine Liste noch (oder importiert sie von hier)", block.length > 0 || /fiaon-global-wortregeln/.test(pruefstand));
  if (block.length > 0) {
    for (const r of GLOBAL_SCHAERFER) ok(`Regel ${String(r.muster).slice(0, 48)} steht dort wortgleich`, block.includes(`muster: ${String(r.muster)},`));
    const dort = (block.match(/\{ muster: \//g) ?? []).length; // nur Zeilen mit einem Muster — nicht die Typangabe der Liste
    ok(`gleiche Anzahl Regeln (${dort} dort, ${GLOBAL_SCHAERFER.length} hier)`, dort === GLOBAL_SCHAERFER.length);
  }
}

// ── 7. Der Kasten ───────────────────────────────────────────────────────────
titel("7. „Was ich dem Kunden NICHT zusage“ — aus dem Leitfaden, nichts erfunden");
{
  const n = nichtZusagen();
  ok("zwei Anweisungen an den Mitarbeiter gefunden", n.verbote.length === 2, String(n.verbote.length));
  ok("die erste nennt Karte, Rahmen, Zinssatz, Frist, Steuerersparnis, Darlehen, Banknamen", ["Karte", "Rahmen", "Zinssatz", "Frist", "Steuerersparnis", "Darlehen", "Banknamen"].every((w) => n.verbote[0]?.includes(w)));
  ok("zwei Kundensätze (Karte/Rahmen und Steuern) gefunden", n.saetze.length === 2, String(n.saetze.length));
  ok("die Kundensätze bestehen die Wand", n.saetze.every((s) => globalWortPruefen(s).length === 0), n.saetze.map((s) => globalWortPruefen(s).map((f) => f.treffer).join()).join(" | "));
  ok("drei Pflichthinweise, wörtlich aus shared/fiaon-global.ts", n.pflicht.length === 3 && n.pflicht.every((s, i) => s === GLOBAL_PFLICHTHINWEIS.de[i]));
  ok("drei Rollen-Sätze", n.rollen.length === 3 && n.rollen.every((s) => s.length > 40));
  ok("Paket-Reichweite: Struktur 2, Banking 3, Kapital 4, VIP 4, Unbekanntes 4", etappenImPaket("global_struktur") === 2 && etappenImPaket("global_banking") === 3 && etappenImPaket("global_kapital") === 4 && etappenImPaket("global_vip") === 4 && etappenImPaket("") === 4);
}

// ── 8. Rundgänge ────────────────────────────────────────────────────────────
titel("8. Die Rundgänge zeigen nur auf Stellen, die es gibt");
{
  const quellen = ["client/src/pages/agent/global.tsx", "client/src/pages/agent/global-akte.tsx"].map((p) => fs.readFileSync(path.join(WURZEL, p), "utf8")).join("\n");
  for (const schluessel of ["global", "globalAkte"]) {
    const r = RUNDGAENGE[schluessel];
    ok(`Rundgang „${schluessel}“ ist eingetragen und hat Schritte`, !!r && r.schritte.length >= 4);
    for (const s of r?.schritte ?? []) {
      if (!s.ziel) continue;
      const klasse = s.ziel.match(/^\.([a-z0-9-]+)$/i)?.[1];
      const reiter = s.ziel.match(/^\[data-reiter="([a-z]+)"\]$/)?.[1];
      const da = klasse ? new RegExp(`["\` ]${klasse}["\` $]`).test(quellen) : reiter ? quellen.includes(`["${reiter}", `) && quellen.includes("data-reiter={k}") : false;
      ok(`Ziel ${s.ziel} kommt in den Seiten vor`, da);
    }
    ok(`Rundgang „${schluessel}“: Du-Form, kein „Sie“ an den Mitarbeiter`, (r?.schritte ?? []).every((s) => !/\bSie (können|müssen|sehen|finden)\b/.test(`${s.text} ${s.tipp ?? ""}`)));
  }
  const seiten = fs.readFileSync(path.join(WURZEL, "client/src/App.tsx"), "utf8");
  ok("beide Routen stehen in App.tsx", seiten.includes('path="/agent/global"') && seiten.includes('path="/agent/global/:ref"'));
  const leiste = fs.readFileSync(path.join(WURZEL, "client/src/pages/agent/OfficeShell.tsx"), "utf8");
  ok("der Raum steht in der Leiste und hängt am Zugriff", /href: "\/agent\/global"[^\n]*nurMitZugriff: "global"/.test(leiste));
  const verzeichnis = fs.readFileSync(path.join(WURZEL, "client/src/components/admin/ChefSeitenverzeichnis.tsx"), "utf8");
  ok("das Seitenverzeichnis kennt /agent/global", verzeichnis.includes('"/agent/global"'));

  // Jede Route, die die Akte ruft, gehört zur vereinbarten Schnittstelle.
  const akte = fs.readFileSync(path.join(WURZEL, "client/src/pages/agent/global-akte.tsx"), "utf8");
  const gerufen = [...akte.matchAll(/(?:tun\([^,]+,\s*|\$\{basis\})[`"](\/[a-z-]+)/g)].map((m) => m[1]);
  const erlaubt = ["/etappe", "/naechster-schritt", "/gesellschaft", "/frist", "/dokument", "/notiz", "/stichtag", "/zugang-senden", "/abschliessen"];
  ok(`die Akte ruft nur vereinbarte Wege (${[...new Set(gerufen)].join(" ")})`, gerufen.length >= 9 && gerufen.every((g) => erlaubt.includes(g)), gerufen.filter((g) => !erlaubt.includes(g)).join());
  ok("jeder vereinbarte Weg hat einen Knopf in der Akte", erlaubt.every((e) => gerufen.includes(e)), erlaubt.filter((e) => !gerufen.includes(e)).join());
}

// ── 9. Bundesstaaten ────────────────────────────────────────────────────────
titel("9. 50 Bundesstaaten und der District of Columbia");
{
  ok("51 Einträge", US_STAATEN.length === 51, String(US_STAATEN.length));
  ok("jedes Kürzel einmal, zwei Großbuchstaben", new Set(US_STAATEN.map(([k]) => k)).size === 51 && US_STAATEN.every(([k]) => /^[A-Z]{2}$/.test(k)));
  ok("DC, Delaware, Wyoming, Florida sind dabei", ["DC", "DE", "WY", "FL"].every((k) => US_STAATEN.some(([x]) => x === k)));
  ok("staatName kennt das Kürzel und lässt Unbekanntes stehen", staatName("WY") === "Wyoming" && staatName("XX") === "XX");
  ok("telLink lässt nur Ziffern und +", telLink("+43 (1) 234-567") === "tel:+431234567");
}

log(`\n${"═".repeat(74)}\n${gut + schlecht} Prüfungen — ${gut} grün, ${schlecht} rot.`);
if (schlecht) process.exitCode = 1;
