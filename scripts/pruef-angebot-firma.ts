// ═══════════════════════════════════════════════════════════════════════════
// PRÜFSTAND: DAS FIRMENANGEBOT (B2B) VON FIAON GLOBAL
// Register E-301 (07.10.2026)
//
// ── TEIL 1 — OHNE DATENBANK (immer) ───────────────────────────────────────
//   Zwanzig Ziffern mit Titeln, Vertragssprache (ohne Ihr/wir) in Vertrag und Anlage 1, Wortwand (Hauswand +
//   Global-Regeln + Angebotsregeln), „garant…“ nur aus firmaGarantie/FIRMA_GARANTIE_FEST, kein „Ziel“ beim Kapital,
//   Fristen als Wort (zahlwort bis neunundneunzig), keine Kundendaten im Repo (Grep gegen die LOKALE Liste — Pfad in
//   FIAON_KUNDENWOERTER, sonst die Datei im Fahrplan), Rechenregeln (Umsatzbeteiligung mit anteiligem erstem Jahr,
//   Quartals-Differenz, Jahresabgleich; Verkauf; Monate monatsende-sicher 31.01. → 28./29.02.; Laufzeit, Kündigung,
//   Garantiefrist), Prüfsumme stabil und nur vom Text abhängig, Kundenfassung des Prüfberichts (ohne Bereich 8,
//   ohne interne Sätze), Seite vollständig, Hildbrands Prüfsumme unverändert.
//   Vor-Live-Prüfung (07./08.10.2026, Abschnitt 9): keine Bild-/Binärdatei im Bau und nichts unter client/public/angebote,
//   kundenbezogene Bedingungen nur aus den Angebotsdaten, Texte ohne Zusage über Ziffer 7 hinaus, Versandsperre an die
//   Prüfsumme der Freigabe gebunden, Zahlungstakt ohne Mail an die Firmenkundin (Aufgabe Tag 10 bleibt), die Wände E-301
//   an beiden Mail-Türen, Bilder bereinigt (EXIF/XMP) und nur hinter dem Link, Hinweis zum Linkprotokoll, /team unverändert.
//   Nachprüfung (08.10.2026): der GIT-INDEX — kein Pfad mit älterer gestagter Fassung (Status MM), der gestagte Inhalt gegen
//   dieselbe Liste der Kundenwörter, nichts unter client/public/angebote und keine Binärdatei im Index, kein Kundenwort im Namen
//   des Branches; WARNUNG (kein Fehler) für ANDERE Arbeitsbäume desselben Repos mit Angebotsbildern, shared/fiaon-team.ts oder
//   einem Kundenwort im Branch (dort entscheidet Justin) — FEHLER, sobald dort Kundendaten GESTAGT sind. „In einer Auszahlung“
//   ist vorgesehen, kein Tatbestand (Ziffer 7 Absatz 2, Ziffer 8 Absatz 3, Anlage 1 Fassung D); Versand erst bei Sunbiz
//   „Active“ (nie „Inactive“, „not Active“, Auflösung); Link und Freigabe des Anwalts bei gesperrtem Versand nur für die Stufe
//   „inhaber“; die Freigabe hängt auch an den Angaben der Bürgin. Zweite Nachprüfung: „Nachholen“ meldet beim Firmenangebot
//   keine Bestätigungsmail; die Annahme prüft vorher die CHECKs der Migration 096 (sonst 503, nichts gespeichert).
//   Runde 2 (08.10.2026, Fassung C, Abschnitt 10): Garantiefrist ab Annahme mit Ruhen bei fehlender Mitwirkung, Empfängerin die
//   US-Gesellschaft; gemeinsames Wachstumsbudget (Hälfte, Aufstellung = Summe, Start erst am Tag „Shop live“, Mindestlaufzeit ab
//   dann); Unterschrift Pflicht (leer/ohne → abgewiesen, gezeichnet oder getippt, im Annahmevermerk); Team nur aus den
//   Angebotsdaten (kein KI-Porträt, Monogramm), Leser mit Annahme-Knopf am Ende, keine Fotos im Zeitstrahl und auf den Karten.
//   Runde 3 (08.10.2026, Fassung D, Abschnitt 11): Kapital im Hero und direkt danach, Gründungskosten nur als Zeile, kompakt
//   (drei Punkte, ein Satz, acht Fragen offen), Ziffer 7 garantiert die Auszahlung (keine Zusage), spätester Starttag des
//   Wachstumsbudgets (Ziffer 10 Absatz 2), Team nur mit bestaetigt !== false.
//
// ── TEIL 2 — MIT --lokal (Prüfstand-DB auf 127.0.0.1 + laufender lokaler Server, PRUEF_BASIS) ──
//   Anlegen über das Import-Skript mit einer erfundenen Firma (Musterfirma Beispiel GmbH) → Kundensicht (Form =
//   FirmaKundenSicht) → Annahme: Häkchen fehlen 400, Unterschrift fehlt/leer 400, Name ohne Nachnamen 400, Hash falsch 409, gut 200 →
//   Person am Angebot + Global-Kunde-Regel → Rechnung Gründung (Firma, UID, Reverse Charge, Rechnungstext) →
//   Garantiefrist ab Annahme, Unterschrift gespeichert und im PDF → vor „Shop live“ keine Monatsteile → „Shop live“: vierundzwanzig
//   Monatsteile ab dem Tag, erste Rechnung sofort (2.000 €), keine Mail → Monatslauf mit simulierter Uhr (Rechnung am Fälligkeitstag,
//   nicht davor, nicht doppelt) → Zahlung Gründung → Start → Bedingungen erfüllt (Frist bleibt) → Frist ruht → Garantiefall →
//   Umsatz (erstes Jahr anteilig, Quartale, Jahresabgleich mit Gutschrift) → Verkauf 5 % → Verlängerung → Kündigung →
//   PDFs über den Kundenlink → Liste der Leitung (art „firma“, Knöpfe) → Leitungsrouten ohne Anmeldung gesperrt →
//   Nachbesserung: Jahresabgleich und Nullmeldung zählen einmal, Ende der Umsatzbeteiligung, Cent-Feld als Text → 400,
//   Storno des Auftrags (offene Teile entfallen, keine Rechnung mehr).
//   Vor-Live-Prüfung: Import mit --bilder (Metadaten weg, fehlendes Bild bricht ab), Bild-Route (mit Link 200/304, falsch
//   403, ohne Angebot 404, abgelaufen 410, unbekannter Name 404, alter öffentlicher Pfad kein Bild), Freigabe des Anwalts
//   an die Fassung gebunden, Zahlungstakt Tag 4/8/11, Wände an Make-Tür und globalMailSenden, Aufgabe „Rechnung schicken“
//   auch im Nachholweg (mit Reverse Charge), „steht schon“ öffnet nichts, Storno über die Zahlungsliste stoppt Rechnungen,
//   Verkauf: Pflichtfeld Veräußerer, Doppelklick 409, Gesellschafter ohne Rechnung, Mail-Protokoll ohne Automatik.
//   Nachprüfung: Liste und Freigabe über die echten Routen mit Chef-Ausweis (HMAC wie der Server, SESSION_SECRET gleich):
//   „leitung“ sieht bei gesperrtem Versand keinen Link und darf die Freigabe nicht eintragen (403), „inhaber“ schon.
//   Zweite Nachprüfung: Bürgin nach der Freigabe geändert → gesperrt, zurück → frei; Import-Skript --nur-vorbedingungen
//   (Spalten, Bildtabelle, CHECKs, Live-Code über die Bild-Route; falsche Live-Basis → FEHLT) und --produktion bricht ohne
//   Vorbedingungen ab, ohne zu schreiben; CHECKs der Teile alt + Tabelle gesperrt → Annahme 503, nichts gespeichert;
//   danach holt der nächste Aufruf den Tausch nach; „Nachholen“ beim Firmenangebot meldet keine Mail.
//   Der Server nimmt nur echte Browser an (Roboter-Wand): Die Annahme schickt eine öffentliche Adresse und einen
//   normalen Browser-User-Agent. Die Daten bleiben in der Prüfstand-Kopie (keine Produktion, keine Mail — Schlüssel leer).
//
//   env -i PATH="$PATH" HOME="$HOME" DATABASE_URL=postgresql://fiaon@127.0.0.1:54329/<kopie>?sslmode=require \
//     SESSION_SECRET=<wie der Server> PRUEF_BASIS=http://127.0.0.1:5298 PORT=5298 npx tsx scripts/pruef-angebot-firma.ts --lokal
//   Ohne --lokal: npx tsx scripts/pruef-angebot-firma.ts   (Exit 1 bei Fehlern)
// ═══════════════════════════════════════════════════════════════════════════
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import zl from "node:zlib";
import { execFileSync } from "node:child_process";

const LOKAL = process.argv.includes("--lokal");
if (!LOKAL) process.env.DATABASE_URL = "postgres://pruefstand:ohne@127.0.0.1:1/keine-datenbank";
else {
  let host = "";
  try { host = new URL(String(process.env.DATABASE_URL)).hostname; } catch { /* unten */ }
  if (!["127.0.0.1", "localhost"].includes(host)) { console.error("ABBRUCH: --lokal läuft nur gegen eine Datenbank auf 127.0.0.1/localhost."); process.exit(2); }
  if (process.env.BREVO_API_KEY || process.env.MAKE_WEBHOOK_URL) { console.error("ABBRUCH: Ein Mail-Weg ist gesetzt — bitte mit env -i starten."); process.exit(2); }
}

const S = await import("../shared/fiaon-global-angebot-firma");
const F = await import("../server/lib/fiaon-global-angebot-firma");
const SA = await import("../shared/fiaon-global-angebot");
const V = await import("../server/lib/fiaon-global-angebot-vertrag");
const { wandPruefen } = await import("../shared/fiaon-wortverbote");
const { GLOBAL_SCHAERFER } = await import("../shared/fiaon-global-wortregeln");
type FirmaDaten = import("../shared/fiaon-global-angebot-firma").FirmaDaten;

let fehler = 0; let n = 0;
const ok = (b: unknown, was: string, zusatz?: unknown) => { n++; if (!b) { fehler++; console.log(`  FEHLER  ${was}${zusatz !== undefined ? `  → ${String(typeof zusatz === "string" ? zusatz : JSON.stringify(zusatz)).slice(0, 500)}` : ""}`); } };
const titel = (t: string) => console.log(`\n── ${t}`);

// ── Erfundene Testfirma (KEINE Kundendaten — Hausregel E-242) ──────────────────
const KUNDE = {
  art: "firma" as const,
  firma: { name: "Musterfirma Beispiel GmbH", marke: "BEISPIELMARKE", rechtsform: "GmbH", registergericht: "Landesgericht Musterstadt", registernummer: "FN 999999z", uid: "ATU12345675", strasse: "Musterweg 7", plz: "1010", ort: "Musterstadt", land: "AT" as const },
  vertretung: { anrede: "Frau" as const, vorname: "Martina", nachname: "Muster", funktion: "Geschäftsführerin und Gesellschafterin" },
  email: "pruef@musterfirma-beispiel.example", telefon: "",
};
const INHALT = {
  heroUnter: "Ein Betrieb mit eigenem Produkt — mit eigener US-Gesellschaft, Kapital für den nächsten Schritt und einem Team an seiner Seite.",
  ziele: [{ titel: "Mehr Menge", text: "Neue Maschinen und mehr Fläche für die Produktion." }, { titel: "Neue Märkte", text: "Handel in Europa und eine eigene Gesellschaft in den USA." }],
  // Bilder nur als NAMEN (die Dateien liegen in der Datenbank am Angebot, ausgeliefert hinter dem Link — Gegenprüfung 07.10.2026).
  bilder: { herkunft: { src: "szene-a.webp", srcset: "szene-a.webp 960w, szene-a-gross.webp 1920w", breite: 1920, hoehe: 1080, alt: "Testszene", ki: true, hinweis: "Szene mit KI erstellt" } },
  // Eine erfundene kundenbezogene Bedingung — wie sie aus der privaten Datei kommt (im Code steht nur die allgemeine).
  bedingungen: [{ schluessel: "testbedingung", vertrag: "der Nachweis einer erfundenen Testbedingung der Auftraggeberin", titel: "Nachweis zur Testbedingung", warum: "Ein erfundener Grund, damit der Prüfstand die Reihenfolge und den Wortlaut aus den Angebotsdaten prüft." }],
  sonderfreigabe: { aktiv: true, text: "Die Bürgschaft wird trotz offener Punkte im Prüfbericht ausnahmsweise durch die Geschäftsleitung freigegeben.", unterzeichner: "Justin Schwarzott", funktion: "Director der FIAON LTD · Manager der Schwarzott Global LLC", datum: "2026-10-07" },
  ansprechpartner: "justin",
};
const PARAMETER = { ...S.FIRMA_VORGABEN, inhalt: INHALT };
const FIRMA_OHNE_INHALT = () => ({ ...S.FIRMA_VORGABEN, inhalt: {} });
const BUERGIN_VOLL = { ...SA.BUERGIN_VORGABE, registernummer: "L00000000000", unterzeichnetAm: "2026-10-07", bestaetigt: true, bestaetigtGrundlage: "Registerauszug (Sunbiz) vom 07.10.2026: Status Active — Prüfstand" };
const befund = (id: string, pruefung: string) => ({ id, aussage: `Prüfaussage ${id}.`, quelle_name: "Prüfquelle", quelle_url: "https://example.org/quelle", stand: "07.10.2026", art: "primär", pruefung });
const COMPLIANCE_ROH = {
  absender: "FIAON LTD",
  meta: { firma: "Musterfirma Beispiel GmbH", kurz: "Musterfirma", anlass: "Prüfung vor einem Mandat · Interne Fassung", pruefdatum: "07.10.2026", datenstand: "Abrufe am 07.10.2026", kopf: [["Firmenwortlaut", "Musterfirma Beispiel GmbH"], ["Sitz", "Musterstadt"]] },
  gesamt: { ampel: "GELB", titel: "Zusammenarbeit möglich, offene Punkte lösbar.", text: ["Ein **echter** Betrieb mit belegtem Handel."], zusatz: [{ ampel: "ROT", titel: "Interner Punkt", text: "Nur für FIAON." }], kernzahlen: [{ wert: "3", text: "Handelspartner" }], auflagen: ["**Jahresabschlüsse** vorlegen."] },
  bereiche: [1, 2, 3, 4, 5, 6, 7, 8].map((nr) => ({
    nr, titel: nr === 8 ? "Fit mit FIAON Global" : `Bereich ${nr}`, ampel: nr === 4 ? "ROT" : nr === 2 ? "GRÜN" : "GELB", kurz: `Kurzurteil ${nr}.`, urteil: [`Urteil ${nr}.`],
    befunde: [befund(`B${nr}a`, "bestätigt"), befund(`B${nr}b`, "unbelegt"), befund(`B${nr}c`, "korrigiert")], nicht_geprueft: [{ punkt: "Auszug", grund: "kostenpflichtig" }], chancen: ["Chance."], risiken: ["Risiko."],
  })),
  chancen: [{ titel: "Handel", text: "Belegt." }], schwaechen: [{ titel: "Abschlüsse", text: "Fehlen." }],
  methodik: ["Öffentliche Quellen.", "Momentaufnahme: vor Vertragsschluss erneut prüfen. Interne Fassung; für die Kundenseite wird eine gekürzte Fassung erstellt."],
  fuss: "FIAON LTD · Prüfbericht",
};
const COMPLIANCE = S.complianceKundenfassung(COMPLIANCE_ROH);
const D: FirmaDaten = { ref: "FIAON-IA-FPRUEF1", fassung: S.FIRMA_FASSUNG, kunde: KUNDE, parameter: PARAMETER, buergin: BUERGIN_VOLL, compliance: COMPLIANCE, gueltigBis: "2026-10-28" };
/**
 * Prüfsumme der Testfirma D. Ändert sich der Wortlaut bewusst, hier mit Datum und Grund nachtragen.
 *   07.10.2026 (E-301):              5308a98ebab0e90ff2479df35732aa68e6f983146edf14d9c36d4a712de02402
 *   07.10.2026 (E-301 Nachbesserung, vor jedem Versand): Bedingungen der Bürgschaft erfüllbar (Maschinen vorab, Tag der
 *     erfüllten Bedingungen mit Frist), Garantie entfällt nur bei Kündigung aus wichtigem Grund, „angeboten“ bestimmt,
 *     Rückbürgschaft mit Höchstbetrag, Verkaufsbeteiligung schuldet, wer veräußert, Kontrollwechsel, Gruppe = verbundene
 *     Unternehmen, Ende der Umsatzbeteiligung, Start der Gründung nach Zahlung, Textform, Anlage 1 als deed (Fassung B).
 *     86aece66e95b1cb8b2eafdfa49824ed158e385c26dd3df2a63fe30a7d998c0e8
 *   07.10.2026 (E-301, Justins Änderungen nach der Live-Vorschau, Vertragsfassung IA-FIRMA-2026-10-07-B, Anlage 1 Fassung C):
 *     keine Begleitung einer neuen Geschäftsführung (Ziffer 4, dafür: Geschäftsführung und Anteile bleiben unberührt), eine
 *     Auszahlung statt Tranchen, nur noch zwei Bedingungen der Bürgschaft und keine Sicherheiten (Ziffer 8, Anlage 1 ohne
 *     Ziffer „Sicherheiten“), Quartalszahlen nicht mehr in Ziffer 15, Ziffer 20 Absatz 1, Knopf der Firmenfassung im
 *     Annahmeblock, Absatznummern als eigenes Element, Anker „praeambel“.
 *     82ad22f4ceee5903602f522604a8fdbf68ecc6210f4fced3f336e37b978a8508
 *   08.10.2026 (E-301, Vor-Live-Prüfung): nur die TESTDATEN — eine erfundene kundenbezogene Bedingung kommt jetzt aus den
 *     Angebotsdaten (inhalt.bedingungen; im Code steht nur die allgemeine), die Testfirma heißt neutral (Musterfirma
 *     Beispiel GmbH, PLZ 1010). Der Wortlaut der Vertragsbausteine selbst ist unverändert.
 *     85895ee0d77ff0475c79cbe7f9d539ca3dc0abfdb7d2014069dbff6a309ab1f7
 *   08.10.2026 (E-301, Nachprüfung — vor jeder Freigabe): „in einer Auszahlung“ ist vorgesehen, kein Tatbestand — Ziffer 7
 *     Absatz 2 („gleich ob in einem Betrag oder in Teilbeträgen“), Ziffer 8 Absatz 3 (keine Bindung der Bürgschaft an die
 *     Auszahlungsart oder einen Verwendungsplan), Anlage 1 Fassung D (bei Teilbeträgen gilt die Zusage für alle).
 */
/*   7ba1bdcfee61bf505011f7ec4a90099c4e2a7f1a8c05418ebb8c4c0f0fd54ecc  (bis Runde 2)
 *   08.10.2026 (E-301, Runde 2 — Justins Änderungen nach der Live-Seite, Vertragsfassung IA-FIRMA-2026-10-08-C): BEWUSST neu gesetzt.
 *     Grund: Ziffer 7 Absatz 1/3/4 (Garantiefrist ab dem Tag der Annahme, Empfängerin die US-Gesellschaft, Ruhen bei fehlenden
 *     Unterlagen nach Ziffer 8 Absatz 4), Ziffer 10 (gemeinsames Wachstumsbudget mit Aufstellung, Starttag = Tag „Shop live“,
 *     Mehrbudget in Absatz 6), Verweise in den Ziffern 3, 5, 6, 13, 14, Präambel, Annahmeblock („mit Unterschrift und Klick“).
 *     Anlage 1 unverändert (Fassung D, eigene Prüfsumme gleich — Prüfung unten).
 *     3fd1283153c3a5e6c14b04581b9b383526d5f510aab227caa5067af12902dd22  (bis Runde 3)
 *   08.10.2026 (E-301, Runde 3 — Endfassung zum Versand, Vertragsfassung IA-FIRMA-2026-10-08-D): BEWUSST neu gesetzt.
 *     Grund: Ziffer 7 Absatz 1, 2 und 5 — garantiert ist die AUSZAHLUNG der ersten Runde an die US-Gesellschaft binnen drei
 *     Monaten ab der Annahme, eine Zusage allein genügt nicht mehr (Justin, Punkt 4); Ziffer 10 Absatz 2 — spätester Starttag
 *     des Wachstumsbudgets sechs Monate nach der Annahme, es sei denn, die Verzögerung beruht auf Umständen, die FIAON zu
 *     vertreten hat (Punkt 5). Die Fassung steht in der Prüfsumme (firmaHashEingabe). Anlage 1 unverändert (Prüfung unten).
 */
const PRUEFSUMME_FIRMA_D = "a819be482a28db13e6932e275be3299ca07d02adb07abbb533b0792b1e948f22";
/** Die Prüfsumme der Anlage 1 der Testfirma — Runde 2 darf sie NICHT ändern (das unterschriebene Original bleibt gültig). */
const PRUEFSUMME_ANLAGE1_D = "ce6bfc306ea38af67f3ec958145381fd7bdd3d200c193ed6dffe158f8b685a8a"; // = Stand vor Runde 2 (aus main 50cde08d nachgerechnet)

// Die Garantie-Sätze — die EINE Quelle. Sie (und die Etiketten) werden vor der Wortwand herausgenommen.
const G = S.firmaGarantie(PARAMETER);
const G_SAETZE = [...Object.values(G).flatMap((x) => (Array.isArray(x) ? x : [x])), ...Object.values(S.FIRMA_GARANTIE_FEST)].map(String).sort((a, b) => b.length - a.length);
const ohneGarantie = (t: string) => [...S.FIRMA_GARANTIE_ETIKETTEN].reduce((x, e) => x.split(e).join(""), G_SAETZE.reduce((x, g) => x.split(g).join(""), t));
const texteAus = (v: unknown): string[] => { const aus: string[] = []; const s = (x: unknown) => { if (typeof x === "string") aus.push(x); else if (Array.isArray(x)) x.forEach(s); else if (x && typeof x === "object") Object.values(x).forEach(s); }; s(v); return aus; };
const absaetzeText = (z: import("../shared/fiaon-global-angebot").AngebotZiffer[]) => z.flatMap((x) => x.absaetze.flatMap((a) => (a.art === "p" ? [a.text] : [a.einleitung ?? "", ...a.zeilen])));

// ═══ TEIL 1 ════════════════════════════════════════════════════════════════
titel("1. Ziffern und Vertragssprache");
{
  const z = S.firmaZiffern(D);
  ok(z.length === 20 && z.every((x, i) => x.nr === i + 1), "zwanzig Ziffern, fortlaufend", z.map((x) => x.nr));
  ok(JSON.stringify(z.map((x) => x.titel)) === JSON.stringify(S.FIRMA_ZIFFER_TITEL), "Titel der Ziffern = FIRMA_ZIFFER_TITEL", z.map((x) => x.titel));
  const a1 = S.firmaAnlage1Ziffern(D);
  ok(a1.every((x, i) => x.nr === i + 1), "Anlage 1: Ziffern fortlaufend (mit Sonderfreigabe)", a1.map((x) => x.nr));
  ok(S.firmaAnlage1Ziffern({ ...D, parameter: { ...PARAMETER, inhalt: { ...INHALT, sonderfreigabe: { aktiv: false, text: "" } } } }).every((x, i) => x.nr === i + 1), "Anlage 1: Ziffern fortlaufend (ohne Sonderfreigabe)");
  const vertrag = [...S.firmaPraeambel(D), ...absaetzeText(z), ...S.firmaAnlage1Parteien(D), ...absaetzeText(a1)].join("\n");
  const ansprache = vertrag.match(/\b(Ihr|Ihre|Ihrer|Ihrem|Ihren|Ihres|Ihnen|[Uu]nser\w*|[Ww]ir)\b/g) ?? [];
  ok(ansprache.length === 0, "Vertragssprache in Präambel, Vertrag und Anlage 1 (kein Ihr/wir)", ansprache);
  const t = S.htmlZuText(F.firmaRumpf(D));
  for (const muss of ["Recht von England und Wales", "Gerichte von England und Wales in London", "Vertragssprache ist Deutsch", "Ein Widerrufsrecht für Verbraucher besteht deshalb nicht", "Reverse Charge",
    "vierundzwanzig Monate", "spätestens drei Monate vor Ablauf", "jeweils zwölf Monate", "höchstens sechzig Monate", "kein gesondertes Entgelt", "ein gesondertes Entgelt", "aufschiebend bedingt",
    "legt FIAON das der Auftraggeberin vor der Beauftragung dieses Partners offen", "Art. 28 DSGVO", "Contracts (Rights of Third Parties) Act 1999", "mehr als fünf Prozent zulasten von FIAON",
    "Umsatzsteuervoranmeldungen", "Jahresabgleich", "vierundzwanzig Monaten nach ihrem Ende", "Kapitalerhöhungen", "Eine Pflicht zum Verkauf besteht nicht", INHALT.sonderfreigabe.text,
    "Im ersten Kalenderjahr zählen nur die Netto-Umsätze ab dem Monat des Starttags", "Tag der erfüllten Bedingungen", "Monatsende", "monatlich im Voraus"].filter((x) => x !== "Monatsende")) {
    ok(t.includes(muss), `Vertrag enthält „${muss.slice(0, 60)}“`);
  }
  ok(t.includes(G.vertragGarantie) && t.includes(G.vertragFolge) && t.includes(G.vertragRuhen), "Vertrag: Garantie, Folge und Ruhen aus firmaGarantie (Ziffer 7)");
  ok(/Anlage 2 — Prüfbericht/.test(t) && /Anlage 1 — Bürgschaftszusage der Schwarzott Global LLC/.test(t), "Rumpf: Anlage 1 und Anlage 2");
  // Verweise: die Absätze, auf die der Text zeigt, gibt es.
  const abs = (nr: number) => z[nr - 1].absaetze.length;
  ok(abs(7) >= 5 && abs(8) >= 5 && abs(10) >= 6 && abs(11) >= 8 && abs(12) >= 3 && abs(14) >= 4, "Verweise Ziffer 7 Abs. 4/5, 8 Abs. 4/5, 10 Abs. 2/3/6, 11 Abs. 5–8, 12 Abs. 3, 14 Abs. 3/4 zeigen auf echte Absätze");
}

titel("2. Wortwand, Global-Regeln, Fristen als Wort");
{
  const pruefe = (name: string, text: string) => {
    const w = wandPruefen(ohneGarantie(text));
    ok(w.length === 0, `${name}: Hauswand`, w.map((x) => `${x.treffer} (${x.hinweis.slice(0, 40)})`));
    for (const r of GLOBAL_SCHAERFER) { const m = text.match(new RegExp(r.muster.source, "gi")) ?? []; ok(m.length === 0, `${name}: ${r.grund.slice(0, 50)}`, m); }
    const ziffer = text.match(/\b\d+\s*(Wochen|Tage|Tagen|Werktage|Werktagen|Monate|Monaten)\b/g) ?? [];
    ok(ziffer.length === 0, `${name}: keine Frist mit Ziffer`, ziffer);
    const heikel = ohneGarantie(text).match(/\b(vermittel\w*|beschaff\w*|Zusicherung|garantiert?)\b/gi) ?? [];
    ok(heikel.length === 0, `${name}: kein „vermitteln/beschaffen/garantiert“ außerhalb der Garantie`, heikel);
    ok(!/\bbis zu\b/i.test(text), `${name}: kein „bis zu“`);
    ok(!/Rahmen genehmigt|genehmigt/i.test(text), `${name}: „Sonderfreigabe“ statt „genehmigt“`);
    ok(!/\b0\s?%/.test(text), `${name}: kein „0 %“`);
  };
  // Anlage 2 ist der Prüfbericht der Kundin (Daten, nicht unser Text) — der Vertrag wird ohne ihn geprüft.
  const vertragOhneAnlage2 = S.htmlZuText(F.firmaRumpf({ ...D, compliance: null }));
  pruefe("Vertrag + Anlage 1", vertragOhneAnlage2);
  const seite = S.firmaSeite(D);
  pruefe("Seite", texteAus({ ...seite, hero: { ...seite.hero, glas: null } }).join("\n"));
  pruefe("Bestellübersicht", texteAus(S.firmaBestellUebersicht(D)).join("\n"));
  pruefe("Annahme", texteAus(S.firmaAnnahmeTexte(D)).join("\n"));
  pruefe("Annahme-Antworten", texteAus(Object.values(S.FIRMA_ANNAHME).map((v) => (typeof v === "function" ? (v as (...a: string[]) => string)("pruef@example.org", "08.10.2026") : v))).join("\n"));
  pruefe("Rechnungstexte", ["sofort", "monatlich", "umsatz", "verkauf"].map((f) => texteAus(S.firmaRechnungsText({ angebotRef: "FIAON-IA-FPRUEF1", auftragRef: "FIAON-X", faelligkeit: f, titel: "Titel", zeitraum: "Q1 2027", bemessungCents: 100 }))).flat().join("\n"));
  pruefe("Pflichthinweise", S.firmaPflichthinweise(D).join("\n"));
  // „garant…“ nur aus der einen Quelle
  const alles = [vertragOhneAnlage2, texteAus(seite).join("\n"), texteAus(S.firmaBestellUebersicht(D)).join("\n"), texteAus(S.firmaAnnahmeTexte(D)).join("\n")].join("\n");
  const rest = ohneGarantie(alles).match(/garant\w*/gi) ?? [];
  ok(rest.length === 0, "„garant…“ steht nur in firmaGarantie / FIRMA_GARANTIE_FEST", rest);
  ok(G_SAETZE.every((x) => /garant/i.test(x) || x.length > 0), "Garantie-Quelle vorhanden");
  // Justin (07.10.2026): Die erste Runde ist kein „Ziel“ — sie kommt.
  const kapitalTexte = [texteAus(seite.kapital), texteAus(seite.hero), texteAus(seite.leistungen.karten.find((k) => k.schluessel === "kapital")), seite.phasen.liste.find((p) => p.abzeichen === "Kapital")?.text ?? ""].flat().join("\n");
  ok(!/\bZiel/i.test(kapitalTexte), "Kapital: nie „Ziel“ (Justin 07.10.2026: die 250.000 USD kommen)", kapitalTexte.match(/.{0,30}Ziel.{0,30}/gi));
  ok(seite.kapital.garantie.every((x) => G.kapital.includes(x)) && seite.hero.kapital.satz === G.satz, "Seite: Garantie-Sätze aus firmaGarantie (Kapital und Hero)");
  // zahlwort bis neunundneunzig
  const zw: [number, string][] = [[1, "eins"], [12, "zwölf"], [21, "einundzwanzig"], [24, "vierundzwanzig"], [31, "einunddreißig"], [36, "sechsunddreißig"], [60, "sechzig"], [90, "neunzig"], [99, "neunundneunzig"]];
  for (const [z2, w] of zw) ok(S.zahlwort(z2) === w, `zahlwort(${z2}) = ${w}`, S.zahlwort(z2));
  let warf = false; try { S.zahlwort(100); } catch { warf = true; }
  ok(warf, "zahlwort(100) wirft");
  ok(S.monateWort(24) === "vierundzwanzig Monate" && S.monatenWort(3) === "drei Monaten" && S.tagenWort(7) === "sieben Tagen", "Monats- und Tageswörter");
}

titel("3. Keine Kundendaten im Repo (Grep gegen die lokale Liste; Bilder nie im Repo; der Git-Index)");
let warnungen = 0;
const warnung = (was: string) => { warnungen++; console.log(`  WARNUNG ${was}`); };
{
  const wurzel = execFileSync("git", ["rev-parse", "--show-toplevel"], { encoding: "utf8" }).trim();
  const git = (args: string[], cwd = wurzel) => execFileSync("git", args, { cwd, encoding: "utf8", maxBuffer: 256 * 1024 * 1024 });
  const namen = (aus: string) => aus.split("\0").filter(Boolean);
  const geaendert = namen(git(["diff", "--name-only", "-z", "HEAD"]));
  const neu = namen(git(["ls-files", "--others", "--exclude-standard", "-z"]));
  const dateien = [...new Set([...geaendert, ...neu])];
  // Text in Bildern sieht kein Grep (Gegenprüfung 07.10.2026: die Angebotsbilder zeigten die Marke der Kundin). Deshalb:
  // KEINE neue oder geänderte Bild-/Binärdatei in diesem Bau — Bilder eines Angebots gehören in die Datenbank (--bilder).
  const binaer = /\.(webp|png|jpe?g|gif|svg|avif|heic|pdf|woff2?|ttf|ico|mp4|mov|glb)$/i;
  const BINAER_ERLAUBT: readonly string[] = []; // ausdrücklich freigegebene Binärdateien dieses Baus: keine
  const binaerNeu = dateien.filter((d) => binaer.test(d) && !BINAER_ERLAUBT.includes(d));
  ok(binaerNeu.length === 0, "keine neue oder geänderte Bild-/Binärdatei im Bau (Bilder eines Angebots nur in die Datenbank)", binaerNeu);
  const oeffentlich = path.join(wurzel, "client/public/angebote");
  const liste = (o: string): string[] => fs.readdirSync(o, { withFileTypes: true }).flatMap((e) => e.isDirectory() ? liste(path.join(o, e.name)) : [path.join(o, e.name)]);
  const dort = fs.existsSync(oeffentlich) ? liste(oeffentlich) : [];
  ok(dort.length === 0, "unter client/public/angebote/ liegt keine Datei (Angebotsbilder nie öffentlich)", dort.map((x) => path.relative(wurzel, x)));
  ok(/^client\/public\/angebote\/$/m.test(fs.readFileSync(path.join(wurzel, ".gitignore"), "utf8")), ".gitignore sperrt client/public/angebote/");
  ok(!/angebote/i.test(fs.readFileSync(path.join(wurzel, "client/public/robots.txt"), "utf8")), "robots.txt nennt keinen Ordner für Angebotsbilder (würde ihn verraten)");

  // ── Der Git-Index (Nachprüfung 08.10.2026): „git commit“ nimmt den INDEX, nicht den Arbeitsbaum. Eine früher gestagte
  //    Fassung (Status „MM“) hätte alte Kundenmerkmale veröffentlicht, obwohl der Arbeitsbaum sauber war — der Grep sah nur
  //    den Arbeitsbaum. Darum: Jeder gestagte Pfad trägt genau den Stand des Arbeitsbaums (oder ist gar nicht gestagt), und
  //    der gestagte Inhalt läuft durch dieselbe Liste wie der Arbeitsbaum.
  const gestagt = namen(git(["diff", "--cached", "--name-only", "-z"]));
  const gestagtMitInhalt = namen(git(["diff", "--cached", "--name-only", "--diff-filter=d", "-z"]));
  const ungestagt = new Set(namen(git(["diff", "--name-only", "-z"])));
  const beides = gestagt.filter((d) => ungestagt.has(d));
  ok(beides.length === 0, "Git-Index: kein Pfad mit älterer gestagter Fassung (Status MM) — vor dem Commit „git add -- <pfad>“ oder „git restore --staged -- <pfad>“", beides);
  const indexBild = gestagt.filter((d) => d.startsWith("client/public/angebote/") || (binaer.test(d) && !BINAER_ERLAUBT.includes(d)));
  ok(indexBild.length === 0, "Git-Index: nichts unter client/public/angebote/ und keine Bild-/Binärdatei", indexBild);

  const listePfad = process.env.FIAON_KUNDENWOERTER || "/Users/Justin/Desktop/FIAON/04_Fahrplan/ANGEBOT_FIRMA_2026-10/kundendaten-woerter.txt";
  if (!fs.existsSync(listePfad)) {
    console.log(`  ÜBERSPRUNGEN — Liste nicht gefunden (${listePfad}). Pfad über FIAON_KUNDENWOERTER setzen.`);
  } else {
    const woerter = fs.readFileSync(listePfad, "utf8").split(/\r?\n/).map((x) => x.trim()).filter((x) => x && !x.startsWith("#"));
    const esc = (w: string) => w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const muster = woerter.map((w) => new RegExp(`(?<![\\p{L}\\p{N}])${esc(w)}(?![\\p{L}\\p{N}])`, "iu"));
    const hat = (t: string) => muster.some((m) => m.test(t));
    // Ausgaben nennen nie ein Kundenwort (Protokolle landen in Chats und Berichten) — es wird durch „…“ ersetzt.
    const ohneWort = (t: string) => muster.reduce((x, m) => x.replace(new RegExp(m.source, "giu"), "…"), t);
    let treffer = 0;
    const pruefeText = (wo: string, inhalt: string) => {
      for (const m of muster) { const x = inhalt.match(m); if (x) { treffer++; ok(false, `Kundenwort in ${wo}`, ohneWort(`…${inhalt.slice(Math.max(0, (x.index ?? 0) - 30), (x.index ?? 0) + 30)}…`)); } }
    };
    for (const datei of dateien) {
      if (hat(datei)) { treffer++; ok(false, `Dateiname enthält ein Kundenwort: ${ohneWort(datei)}`); }
      if (binaer.test(datei)) continue; // oben schon rot
      const voll = path.join(wurzel, datei);
      if (!fs.existsSync(voll) || fs.statSync(voll).isDirectory()) continue;
      pruefeText(datei, fs.readFileSync(voll, "utf8"));
    }
    ok(treffer === 0, `keine Kundenwörter in ${dateien.length} geänderten/neuen Dateien (${woerter.length} Wörter, ganze Wörter, ohne Groß/Klein)`);
    // Der gestagte Inhalt — genau das, was ein „git commit“ jetzt nähme (git show :<pfad>).
    let trefferIndex = 0; const vorher = treffer;
    for (const datei of gestagt) if (hat(datei)) { trefferIndex++; ok(false, `Git-Index: Dateiname enthält ein Kundenwort: ${ohneWort(datei)}`); }
    for (const datei of gestagtMitInhalt) {
      if (binaer.test(datei)) continue; // oben schon rot
      pruefeText(`Git-Index ${datei}`, git(["show", `:${datei}`]));
    }
    trefferIndex += treffer - vorher;
    ok(trefferIndex === 0, `Git-Index: keine Kundenwörter in ${gestagt.length} gestagten Dateien (Inhalt aus dem Index, nicht aus dem Arbeitsbaum)`);
    // Der Name des Branches reist mit jedem Push (und steht im Pull-Request).
    const branch = git(["rev-parse", "--abbrev-ref", "HEAD"]).trim();
    let oben = ""; try { oben = execFileSync("git", ["rev-parse", "--abbrev-ref", "--symbolic-full-name", "@{u}"], { cwd: wurzel, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim(); } catch { /* kein Upstream */ }
    ok(!hat(branch) && !hat(oben), "Branch und Upstream ohne Kundenwort", ohneWort(`${branch} → ${oben || "(kein Upstream)"}`));
    // ANDERE Arbeitsbäume desselben Repos (Nachprüfung 08.10.2026: ein alter Bau-Arbeitsbaum mit Angebotsbildern, Personaldaten
    // und der Marke im Branchnamen). Sie gehören nicht zu diesem Bau — darum WARNUNG statt Fehler; Justin entscheidet, ob sie
    // aufgelöst werden. Nur lesen (--no-optional-locks), nichts anfassen, kein Kundenwort in der Ausgabe.
    // Zweite Nachprüfung 08.10.2026 (N7): ROT wird es, sobald dort etwas mit Kundendaten GESTAGT ist (Bild unter
    // client/public/angebote/, Binärdatei mit Kundenwort im Namen oder ein Kundenwort im gestagten Inhalt) — dann fehlt nur
    // noch „git commit“ bis zur Veröffentlichung. Die Warnung nennt außerdem den Upstream (origin/main = ein Push von dort
    // landet auf main) und zählt Kundenwörter im ungestagten Stand des Baums (nur Zahl, nie das Wort).
    const baeume = git(["worktree", "list", "--porcelain"]).split(/\n\n+/).map((b) => ({
      pfad: b.match(/^worktree (.+)$/m)?.[1] ?? "", branch: b.match(/^branch refs\/heads\/(.+)$/m)?.[1] ?? "",
    })).filter((b) => b.pfad && path.resolve(b.pfad) !== path.resolve(wurzel) && fs.existsSync(b.pfad));
    const fremd = (pfad: string, args: string[]) => execFileSync("git", ["--no-optional-locks", "-C", pfad, ...args], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"], timeout: 20_000, maxBuffer: 64 * 1024 * 1024 });
    const zaehle = (t: string) => muster.reduce((x, m) => x + (t.match(new RegExp(m.source, "giu"))?.length ?? 0), 0);
    let gesehen = 0; let gestagtRot = 0;
    for (const b of baeume) {
      const gruende: string[] = [];
      if (hat(b.branch)) gruende.push("Kundenwort im Branchnamen");
      if (hat(b.pfad)) gruende.push("Kundenwort im Pfad");
      try {
        const st = fremd(b.pfad, ["status", "--porcelain", "-uall", "--", "client/public/angebote", "shared/fiaon-team.ts"]).split("\n").filter(Boolean);
        const bilder = st.filter((z) => z.includes("client/public/angebote/")).length;
        if (bilder) gruende.push(`${bilder} Datei(en) unter client/public/angebote/ (nicht in .gitignore dieses Stands)`);
        if (st.some((z) => z.endsWith("shared/fiaon-team.ts"))) gruende.push("shared/fiaon-team.ts (Personaldaten)");
      } catch { /* Arbeitsbaum nicht lesbar — übergehen */ }
      // Gestagt = ein „git commit“ entfernt. Das prüft der Prüfstand in JEDEM fremden Baum (schnell: Index gegen HEAD).
      try {
        const idx = fremd(b.pfad, ["diff", "--cached", "--name-only", "--diff-filter=d", "-z"]).split("\0").filter(Boolean);
        const rot: string[] = [];
        for (const d of idx) {
          if (d.startsWith("client/public/angebote/") || (binaer.test(d) && hat(d))) { rot.push(ohneWort(d)); continue; }
          if (hat(d)) { rot.push(ohneWort(d)); continue; }
          if (binaer.test(d)) continue;
          let inhalt = ""; try { inhalt = fremd(b.pfad, ["show", `:${d}`]); } catch { continue; }
          if (hat(inhalt)) rot.push(`${ohneWort(d)} (${zaehle(inhalt)} Kundenwort/-wörter im gestagten Inhalt)`);
        }
        if (rot.length) { gestagtRot++; ok(false, `Arbeitsbaum ${ohneWort(b.pfad)}: Kundendaten GESTAGT — ein „git commit“ dort veröffentlicht sie (Justin: „git -C <baum> restore --staged -- <pfad>“)`, rot.slice(0, 12)); }
      } catch { /* Index nicht lesbar — übergehen */ }
      if (gruende.length) {
        // Nur für schon auffällige Bäume (sonst zu langsam bei vielen Arbeitsbäumen): Upstream und Kundenwörter im Stand.
        try {
          const oben2 = fremd(b.pfad, ["rev-parse", "--abbrev-ref", "--symbolic-full-name", "@{u}"]).trim();
          if (/(^|\/)main$/.test(oben2)) gruende.push(`Upstream ${ohneWort(oben2)} (ein Push von dort landet auf main)`);
        } catch { /* kein Upstream */ }
        try {
          let woerterDort = zaehle(fremd(b.pfad, ["diff", "HEAD"]).split("\n").filter((z) => z.startsWith("+")).join("\n"));
          for (const d of fremd(b.pfad, ["ls-files", "--others", "--exclude-standard", "-z"]).split("\0").filter(Boolean)) {
            const voll = path.join(b.pfad, d);
            if (binaer.test(d) || !fs.existsSync(voll) || fs.statSync(voll).size > 2_000_000) continue;
            woerterDort += zaehle(fs.readFileSync(voll, "utf8"));
          }
          gruende.push(`${woerterDort} Kundenwort/-wörter im ungestagten Text (Änderungen und neue Dateien)`);
        } catch { /* nicht lesbar — übergehen */ }
      }
      gesehen++;
      if (gruende.length) warnung(`Arbeitsbaum ${ohneWort(b.pfad)} (Branch ${ohneWort(b.branch || "losgelöst")}): ${gruende.join("; ")} — von dort NIE committen oder pushen; auflösen entscheidet Justin.`);
    }
    ok(gestagtRot === 0, `fremde Arbeitsbäume: nirgends Kundendaten gestagt (${gesehen} gelesen)`);
    console.log(`  (andere Arbeitsbäume gelesen: ${gesehen})`);
  }
}

titel("4. Rechenregeln");
{
  ok(S.plusMonate("2026-01-31", 1) === "2026-02-28" && S.plusMonate("2028-01-31", 1) === "2028-02-29" && S.plusMonate("2026-01-31", 2) === "2026-03-31", "Monate monatsende-sicher: 31.01. → 28.02./29.02. (Schaltjahr), +2 → 31.03.");
  ok(S.plusMonate("2026-03-31", -1) === "2026-02-28" && S.plusMonate("2026-12-15", 1) === "2027-01-15" && S.plusMonate("2026-10-07", 24) === "2028-10-07", "Monate rückwärts und über den Jahreswechsel");
  ok(S.monatFaelligAm("2026-01-31", 1) === "2026-01-31" && S.monatFaelligAm("2026-01-31", 2) === "2026-02-28" && S.monatFaelligAm("2026-01-31", 3) === "2026-03-31", "Fälligkeit je Monat vom Starttag aus (nicht verkettet)");
  ok(S.monatZeitraum("2026-10-07", 1).text === "07.10.2026–06.11.2026", "Zeitraum Monat 1", S.monatZeitraum("2026-10-07", 1));
  // „Spätestens drei Monate vor Ablauf“: Ende 06.10.2028 (Ende des Tages) → Eingang bis einschließlich 06.07.2028 (Nachbesserung E-301).
  ok(S.laufzeitEnde("2026-10-07", 24) === "2028-10-06" && S.kuendigungSpaetestens("2028-10-06", 3) === "2028-07-06", "Laufzeitende und späteste Kündigung (06.07.2028)", S.kuendigungSpaetestens("2028-10-06", 3));
  ok(S.kuendigungSpaetestens("2028-10-30", 3) === "2028-07-30" && S.kuendigungSpaetestens("2028-11-30", 3) === "2028-08-31" && S.kuendigungSpaetestens("2028-11-29", 3) === "2028-08-29", "späteste Kündigung am Monatsende (30.10. → 30.07., 30.11. → 31.08., 29.11. → 29.08.)");
  const par = PARAMETER;
  ok(S.kuendigungWirksamZum("2026-10-07", par, "2028-07-06").zum === "2028-10-06" && S.kuendigungWirksamZum("2026-10-07", par, "2028-07-07").zum === "2029-10-06" && S.kuendigungWirksamZum("2026-10-07", par, "2026-12-01").zum === "2028-10-06", "Kündigung: Grenztag 06.07. wirkt zum Ende der Mindestlaufzeit, 07.07. erst zum Ende der Verlängerung");
  ok(S.umsatzSchwelleJahr(par, 2028, "2026-10-07", "2028-12-31").schwelleCents === 60_000_000 && S.umsatzSchwelleJahr(par, 2028, "2026-10-07", "2028-09-30").schwelleCents === 45_000_000 && S.umsatzSchwelleJahr(par, 2029, "2026-10-07", "2028-09-30").schwelleCents === 0, "letztes Jahr anteilig bis zum Monat des Endes (Januar bis September = 9/12 = 450.000 €), danach keine");
  ok(S.umsatzSchwelleJahr(par, 2026, "2026-10-07", "2026-12-31").monate === 3 && S.quartalsEnde("2028-08-15") === "2028-09-30" && S.quartalsEnde("2028-12-31") === "2028-12-31", "Quartalsende");
  ok(S.umsatzBeteiligungEnde({ kuendigung: { am: "2028-07-01", zum: "2028-10-06" } }, false) === "2028-12-31" && S.umsatzBeteiligungEnde({ kuendigung: { am: "2028-07-01", zum: "2028-10-06" } }, true) === null
    && S.umsatzBeteiligungEnde({ verkauf: { am: "2027-05-10", endetUmsatz: true } }, true) === "2027-06-30" && S.umsatzBeteiligungEnde({ verkauf: { am: "2027-05-10", endetUmsatz: false } }, false) === null,
    "Ende der Umsatzbeteiligung: Vertragsende ohne Bürgschaft → Quartalsende; mit Bürgschaft offen; Mehrheitsverkauf beendet, Teilverkauf nicht");
  ok(!S.kuendigungSperrtGarantie({ am: "2027-01-01", zum: "2027-02-01" }, "2027-03-01") && !S.kuendigungSperrtGarantie({ am: "2027-01-01", zum: "2028-10-06", art: "ordentlich" }, "2027-03-01")
    && S.kuendigungSperrtGarantie({ am: "2027-01-01", zum: "2027-02-01", art: "ausserordentlich", garantieEntfaellt: true }, "2027-03-01") && !S.kuendigungSperrtGarantie({ am: "2027-01-01", zum: "2027-02-01", art: "ausserordentlich", garantieEntfaellt: false }, "2027-03-01")
    && !S.kuendigungSperrtGarantie({ am: "2027-01-01", zum: "2027-04-01", art: "ausserordentlich", garantieEntfaellt: true }, "2027-03-01"),
    "Garantie entfällt nur bei Kündigung aus wichtigem Grund vor dem Fristende — eine ordentliche Kündigung lässt sie stehen (Ziffer 14 Absatz 3)");
  ok(S.umsatzSchwelleJahr(par, 2026, "2026-10-07").schwelleCents === 15_000_000 && S.umsatzSchwelleJahr(par, 2026, "2026-10-07").monate === 3, "erstes Jahr anteilig: Oktober bis Dezember = 3/12 × 600.000 € = 150.000 €");
  ok(S.umsatzSchwelleJahr(par, 2027, "2026-10-07").schwelleCents === 60_000_000 && S.umsatzSchwelleJahr(par, 2025, "2026-10-07").schwelleCents === 0, "Folgejahr volle Schwelle, Vorjahr keine");
  ok(S.umsatzSchwelleJahr(par, 2026, "2026-01-15").schwelleCents === 60_000_000, "Start im Januar: volle Schwelle");
  const u = (kum: number, sw: number, bereits: number) => S.umsatzBeteiligungRechnen({ kumuliertCents: kum, schwelleCents: sw, satzProzent: 10, bereitsCents: bereits });
  ok(u(50_000_000, 60_000_000, 0).rechnungCents === 0, "Q1: unter der Schwelle → keine Beteiligung");
  ok(u(70_000_000, 60_000_000, 0).rechnungCents === 1_000_000, "Q2: 700.000 € → 10 % von 100.000 € = 10.000 €");
  ok(u(90_000_000, 60_000_000, 1_000_000).rechnungCents === 2_000_000, "Q3: 900.000 €, bereits 10.000 € → 20.000 € (Quartals-Differenz)");
  const j = u(85_000_000, 60_000_000, 3_000_000);
  ok(j.rechnungCents === 0 && j.gutschriftCents === 500_000 && j.beteiligungJahrCents === 2_500_000, "Jahresabgleich 850.000 €, bereits 30.000 € → Gutschrift 5.000 €", j);
  ok(u(40_000_000, 15_000_000, 0).rechnungCents === 2_500_000, "erstes Jahr: 400.000 € über 150.000 € → 25.000 €");
  ok(S.verkaufBeteiligungRechnen(200_000_000, 5) === 10_000_000 && S.verkaufBeteiligungRechnen(33_333, 5) === 1667, "Verkauf 5 %: 2.000.000 € → 100.000 €; Rundung auf Cent");
  ok(S.rechnerBeteiligung(120_000_000, 60_000_000, 10) === 6_000_000 && S.rechnerBeteiligung(50_000_000, 60_000_000, 10) === 0, "Rechner: nur Schwelle × Satz");
  ok(S.garantieFristEnde("2026-11-30", 3) === "2027-02-28" && S.garantieFristEnde("2026-11-30", 3, 5) === "2027-03-05", "Garantiefrist drei Monate, monatsende-sicher, plus geruhte Tage");
  ok(F.euroZuCents("812.345,67") === 81_234_567 && F.euroZuCents("2.000.000") === 200_000_000 && F.euroZuCents("750.000,00") === 75_000_000 && F.euroZuCents("1,5") === 150 && F.euroZuCents("12.34") === null, "Euro-Eingaben streng (Tausenderpunkt, Komma für Cent)");
  ok(F.euroZuCents(700000) === 70_000_000 && F.centsFeld(70_000_000) === 70_000_000 && F.centsFeld("70000000") === null && F.centsFeld(1.5) === null, "Euro-Feld: Zahl = Euro; …Cents-Feld: nur ganze Zahl, Text wird abgewiesen (nicht umgedeutet)");
}

titel("5. Prüfsumme");
{
  const h1 = F.firmaTextHash(D); const h2 = F.firmaTextHash(JSON.parse(JSON.stringify(D)));
  ok(/^[0-9a-f]{64}$/.test(h1) && h1 === h2, "Prüfsumme stabil (zweimal gerechnet, auch nach JSON-Rundlauf)");
  if (PRUEFSUMME_FIRMA_D.startsWith("__")) console.log(`  HINWEIS  Prüfsumme der Testfirma D: ${h1} — in PRUEFSUMME_FIRMA_D eintragen.`);
  else ok(h1 === PRUEFSUMME_FIRMA_D, "Prüfsumme der Testfirma D unverändert (Wortlaut-Stand E-301)", h1);
  ok(F.firmaTextHash({ ...D, buergin: { ...BUERGIN_VOLL, unterzeichnetAm: "2026-10-08" } }) !== h1, "Anlage 1 geändert → andere Prüfsumme");
  ok(F.firmaTextHash({ ...D, compliance: { ...COMPLIANCE, gesamt: { ...COMPLIANCE.gesamt, titel: "anders" } } }) !== h1, "Anlage 2 geändert → andere Prüfsumme");
  const mit = F.firmaRumpf(D, { am: new Date("2026-10-08T10:00:00Z"), ip: "203.0.113.7", userAgent: "Mozilla/5.0", hash: h1, unterschrift: { art: "getippt", name: "Martina Muster", png: null } });
  ok(mit.includes("Unterschrift: Name getippt („Martina Muster“)") && mit.includes("Vertretungsbefugnis") && !mit.includes("Starttag:") && F.firmaTextHash(D) === h1, "Annahmevermerk (Unterschrift, Bestätigungen; kein Starttag in Fassung C) steht im PDF, nicht in der Prüfsumme");
  if (PRUEFSUMME_ANLAGE1_D.startsWith("__")) console.log(`  HINWEIS  Prüfsumme Anlage 1 der Testfirma D: ${F.firmaAnlage1Pruefsumme(D)} — in PRUEFSUMME_ANLAGE1_D eintragen.`);
  else ok(F.firmaAnlage1Pruefsumme(D) === PRUEFSUMME_ANLAGE1_D, "Anlage 1 der Testfirma D unverändert (Runde 2 berührt sie nicht)", F.firmaAnlage1Pruefsumme(D));
  ok(F.firmaAnlage1Pruefsumme(D) !== h1 && /^[0-9a-f]{64}$/.test(F.firmaAnlage1Pruefsumme(D)), "Anlage 1 hat ihre eigene Prüfsumme");
}

titel("6. Prüfbericht: Kundenfassung und Gestaltung");
{
  ok(COMPLIANCE.bereiche.length === 7 && !COMPLIANCE.bereiche.some((b) => /fit mit fiaon/i.test(b.titel) || b.nr === 8), "Bereich 8 („Fit mit FIAON“) entfernt");
  ok(!("zusatz" in COMPLIANCE.gesamt) && !JSON.stringify(COMPLIANCE).includes("Interner Punkt"), "gesamt.zusatz entfernt");
  ok(!JSON.stringify(COMPLIANCE).includes("Interne Fassung") && COMPLIANCE.methodik[1] === "Momentaufnahme: vor Vertragsschluss erneut prüfen.", "Methodik ohne „Interne Fassung …“", COMPLIANCE.methodik);
  ok(COMPLIANCE.meta.anlass === "Prüfbericht zu Ihrem Angebot", "Untertitel „Prüfbericht zu Ihrem Angebot“");
  ok(JSON.stringify(S.complianceKundenfassung(COMPLIANCE)) === JSON.stringify(COMPLIANCE), "Kundenfassung ist wiederholbar (zweimal gefiltert = einmal)");
  // Zusammenführung E-301: interne Bewertung der eigenen Haftung, „interne Fassung“ im Fuß und jeder „Ziel“-Satz zur
  // Finanzierung verschwinden aus der Kundenfassung (eigene Testdaten — die Prüfsumme der Testfirma bleibt).
  const intern = S.complianceKundenfassung({ ...COMPLIANCE_ROH, fuss: "FIAON LTD · Prüfbericht · Vertraulich, interne Fassung.",
    bereiche: [{ ...COMPLIANCE_ROH.bereiche[2], urteil: ["Ein Testabsatz ohne Wertung.", "**Einschätzung.** Für ein Mandat mit Zahlung je Phase spricht nichts dagegen. Eine Haftungsübernahme durch eine FIAON-Gesellschaft: ROT.",
      "**Bewertung.** Für eine Haftung oder ein Funding von 100.000 € fehlt heute jede prüfbare Grundlage: ROT. Auf GELB kommt der Bereich mit Abschlüssen und einem Plan."],
      risiken: ["Prüfer finden das Verfahren. Eine Finanzierung ist damit ein Ziel, keine Zusage.", "Die Finanzierungsrunde bleibt ein Ziel."] }] });
  ok(intern.bereiche[0].urteil.length === 2 && intern.bereiche[0].urteil[0] === "Ein Testabsatz ohne Wertung.", "Kundenfassung ohne interne Bewertung (Mandat, FIAON-Gesellschaft)", intern.bereiche[0].urteil);
  ok(intern.bereiche[0].urteil[1] === "**Bewertung.** Auf GELB kommt der Bereich mit Abschlüssen und einem Plan.", "Kundenfassung ohne „Grundlage fehlt“-Satz zu Haftung/Funding — was fehlt, bleibt stehen (Justin 07.10.2026: die 250.000 USD kommen)", intern.bereiche[0].urteil);
  ok(S.ohneGrundlageSatz("Grundlage sind EO 14388 vom 20.02.2026.") === "Grundlage sind EO 14388 vom 20.02.2026." && S.ohneGrundlageSatz("Der Umsatz 250.000 € ist belegt. Es fehlt eine Grundlage für eine Haftung.") === "Der Umsatz 250.000 € ist belegt.", "„Grundlage“ ohne Haftung/Funding bleibt; Zahlen mit Punkt trennen keinen Satz");
  ok(JSON.stringify(S.complianceKundenfassung(intern)) === JSON.stringify(intern), "Kundenfassung mit den neuen Filtern wiederholbar");
  ok(JSON.stringify(intern.bereiche[0].risiken) === JSON.stringify(["Prüfer finden das Verfahren."]), "Kundenfassung ohne „Ziel“-Sätze zur Finanzierung (Justin 07.10.2026)", intern.bereiche[0].risiken);
  ok(intern.fuss === "FIAON LTD · Prüfbericht · Vertraulich, Kundenfassung.", "Fuß: „Kundenfassung“ statt „interne Fassung“", intern.fuss);
  ok(S.ohneZielSatz("Online-Marketing im Zielmarkt, höchstens 7.500 €.") === "Online-Marketing im Zielmarkt, höchstens 7.500 €.", "„Zielmarkt“ bleibt (nur das Wort „Ziel“ zur Finanzierung fällt)");
  const html = S.complianceHtml(COMPLIANCE, { ref: D.ref });
  ok(html.includes('class="cb-turm"') && (html.match(/class="cb-kachel"/g) ?? []).length === 7 && html.includes("1/3 belegt") === false && html.includes("2/3 belegt"), "HTML: Ampelturm, sieben Kacheln, „belegt“-Balken (bestätigt + korrigiert)");
  ok(html.includes("<strong>echter</strong>") && !html.includes("**"), "Fettdruck aus **…** umgesetzt");
  ok(html.includes("Gesamtampel GELB") && html.includes("Gelb — lösbare offene Punkte"), "Legende mit Wort, nie Farbe allein");
  ok(S.complianceBelegt(COMPLIANCE.bereiche[0]).ok === 2, "complianceBelegt zählt bestätigt/korrigiert/neu");
}

titel("7. Seite, Übersicht, Annahme");
{
  const s = S.firmaSeite(D);
  ok(s.auftakt.gruss === "Herzlichen Glückwunsch, Frau Muster." && s.auftakt.zeile === "BEISPIELMARKE geht in die Welt — und wir gehen mit.", "Auftakt aus dem Angebot", s.auftakt);
  ok(s.phasen.liste.length === 7 && s.phasen.liste.map((p) => p.nr).join() === "0,1,2,3,4,5,6" && s.phasen.liste.every((p) => !p.bild) && s.phasen.liste[2].titel === "Aufbau" && s.phasen.liste[2].illustration === "aufbau", "sieben Phasen (0–6), keine Fotos im Zeitstrahl — „Aufbau“ mit eigener Animation (Runde 2, Punkt 4)");
  ok(s.phasen.sub === "Sieben Etappen — vom Start bis in weitere Runden.", "Untertitel des Zeitstrahls", s.phasen.sub);
  // Justin (07.10.2026, Punkt 2): keine „neue Rolle“, kein Rollenwechsel, keine Begleitung einer neuen Geschäftsführung — nirgends.
  const rumpfText = S.htmlZuText(F.firmaRumpf(D));
  const rolle = (t: string) => t.match(/.{0,30}(neue Rolle|Rollenwechsel|Übergabe der Geschäftsführung|Einarbeitung einer Geschäftsführung|Produktentwicklung).{0,30}/gi) ?? [];
  ok(rolle(texteAus(s).join("\n")).length === 0 && rolle(rumpfText).length === 0, "kein Rollenwechsel auf Seite und im Vertrag", [...rolle(texteAus(s).join("\n")), ...rolle(rumpfText)]);
  ok(/Geschäftsführung und Anteile der Auftraggeberin bleiben von diesem Vertrag unberührt; FIAON erwirbt keine Anteile und übernimmt keine Geschäftsführung/.test(rumpfText), "Ziffer 4: Geschäftsführung und Anteile bleiben unberührt");
  const bleibe = s.fragen.liste.find((x) => /^Bleibe ich/.test(x.frage));
  ok(!!bleibe && bleibe.frage === "Bleibe ich Geschäftsführerin und Eigentümerin?" && bleibe.antwort[0].startsWith("Ja. Sie bleiben Geschäftsführerin und Eigentümerin Ihrer Gesellschaft") && /US-Gesellschaft gehört Ihnen/.test(bleibe.antwort.join(" ")), "Frage „Bleibe ich …?“: Geschäftsführerin, Eigentümerin, US-Gesellschaft gehört ihr", bleibe);
  const allein = S.firmaFragen({ ...D, kunde: { ...KUNDE, vertretung: { ...KUNDE.vertretung, funktion: "Geschäftsführerin und Alleingesellschafterin" } } }).find((x) => /^Bleibe ich/.test(x.frage));
  ok(!!allein && allein.antwort[0].includes("Geschäftsführerin und zu 100 % Eigentümerin Ihrer Gesellschaft"), "Alleingesellschafterin: „zu 100 % Eigentümerin“", allein?.antwort[0]);
  // Punkt 3 und 4: eine Auszahlung; genau zwei Bedingungen; keine Sicherheiten — auf Seite, im Vertrag und in Anlage 1.
  const verboten = /Tranche|Sicherheit|Rückbürgschaft|Sicherungsübereignung|Abtretung|Leseberechtigung|Mittelverwendung nach|Unbedenklichkeit|Quartalszahlen/i;
  const seiteText = texteAus(s).join("\n");
  ok(!verboten.test(seiteText), "Seite: keine Tranchen, Sicherheiten oder gestrichenen Bedingungen", seiteText.match(new RegExp(`.{0,40}(${verboten.source}).{0,40}`, "gi")));
  ok(!verboten.test(S.htmlZuText(F.firmaRumpf({ ...D, compliance: null }))), "Vertrag + Anlage 1: keine Tranchen, Sicherheiten oder gestrichenen Bedingungen", S.htmlZuText(F.firmaRumpf({ ...D, compliance: null })).match(new RegExp(`.{0,40}(${verboten.source}).{0,40}`, "gi")));
  ok(rumpfText.includes("Die erste Runde ist für eine Auszahlung in einem Betrag vorgesehen.") && S.firmaAnlage1Ziffern(D).some((z) => z.titel === "Auszahlung in einem Betrag"), "eine Auszahlung vorgesehen (Ziffer 8 Absatz 3, Anlage 1)");
  // Nachprüfung 08.10.2026: „in einer Auszahlung“ ist VORGESEHEN, kein Tatbestand — nicht in der Bestimmung „erhalten“ (Ziffer 7
  // Absatz 2), keine Grenze der Bürgschaft (Ziffer 8 Absatz 3) und keine Grenze der Zusage (Anlage 1): Zahlt ein Institut in
  // Teilbeträgen aus, bleiben Garantie und Bürgschaft stehen.
  // Runde 3 (Fassung D, Punkt 4): garantiert ist die AUSZAHLUNG — eine Zusage allein genügt nicht mehr.
  ok(!/in einer Auszahlung|bereitgestellt|verbindlich zugesagt/.test(G.vertragErhalten) && G.vertragErhalten.includes("ausgezahlt hat, gleich ob in einem Betrag oder in Teilbeträgen; eine Zusage allein genügt nicht."), "Ziffer 7 Absatz 2: ausgezahlt (keine bloße Zusage), gleich ob in einem Betrag oder in Teilbeträgen", G.vertragErhalten.slice(0, 260));
  ok(!/in einer Auszahlung bereitgestellt|deren Mittel der US-Gesellschaft in einer Auszahlung/.test(rumpfText) && rumpfText.includes("Weder FIAON noch die Bürgin knüpfen die Bürgschaft an eine Auszahlung in Teilbeträgen oder an einen Plan über die Verwendung der Mittel."), "Ziffer 8 Absatz 3: die Bürgschaft hängt an keiner Auszahlungsart und keinem Verwendungsplan");
  const a1Ausz = S.firmaAnlage1Ziffern(D).find((z) => z.titel === "Auszahlung in einem Betrag");
  const a1AuszText = a1Ausz ? absaetzeText([a1Ausz]).join(" ") : "";
  ok(a1AuszText.includes("weder an eine Auszahlung in Teilbeträgen noch an einen Plan über die Verwendung der Mittel") && a1AuszText.includes("gilt die Zusage für alle Teilbeträge"), "Anlage 1: Zusage ohne Bindung an die Auszahlungsart — bei Teilbeträgen gilt sie für alle", a1AuszText);
  ok(S.ANLAGE1_FIRMA_FASSUNG === "IA-FIRMA-ANLAGE1-2026-10-08-D", "Anlage 1 trägt die neue Fassung D (Wortlaut geändert → neue Kennung)", S.ANLAGE1_FIRMA_FASSUNG);
  const auszSeite = texteAus(s).filter((x) => /einer Auszahlung|einem Betrag/.test(x));
  ok(auszSeite.length >= 2 && auszSeite.every((x) => /vorgesehen/i.test(x)) && !/Bereitgestellt in einer Auszahlung|kommt in einer Auszahlung/.test(seiteText), "Seite: die Auszahlung in einem Betrag ist überall „vorgesehen“, keine Zusage", auszSeite);
  ok(!/in einer Auszahlung|in einem Betrag/.test(G.phaseKapital.split(" — sonst")[0]), "Phase „Erste Runde“: die Auszahlungsart steht nicht im Satz der Garantie", G.phaseKapital);
  ok(/Einsicht in Umsatzsteuervoranmeldungen, betriebswirtschaftliche Auswertungen/.test(rumpfText), "Prüfrecht der Umsatzbeteiligung (UVA/BWA) bleibt in Ziffer 11");
  ok(/binnen vierzehn Tagen nach Vorlage der letzten Unterlage/.test(rumpfText) && /vierzehnte Tag nach dieser Vorlage/.test(rumpfText), "Tag der erfüllten Bedingungen: Bestätigung binnen vierzehn Tagen bleibt");
  ok(!S.firmaAnlage1Ziffern(D).some((z) => /Sicherheit/.test(z.titel)) && S.firmaAnlage1Ziffern(D).every((z, i) => z.nr === i + 1), "Anlage 1: keine Ziffer „Sicherheiten“, fortlaufend gezählt");
  // Runde 2, Punkt 9: Team aus den Angebotsdaten (inhalt.team). Ohne Daten: die Leitung mit ihren echten Porträts (nie ein KI-Porträt).
  const team = s.team.personen.map((p) => p.name);
  ok(s.team.titel === "Ihr Team bei FIAON Global" && !team.includes("Justin Schwarzott") && team.length === 2 && s.team.personen.every((p) => (p.foto === null || p.foto.startsWith("/portraits/")) && p.initialen.length === 2), "Team ohne Angebotsdaten: die Leitung (ohne den Ansprechpartner), nur echte Porträts", team);
  const tbasis = "/api/fiaon/global/angebot/T/bild/";
  const tdaten = S.firmaSeite({ ...D, parameter: { ...PARAMETER, inhalt: { ...INHALT, team: [{ name: "Testperson Eins", rolle: "Testrolle A" }, { name: "Dr. Testperson", rolle: "Testrolle B", foto: `${tbasis}team-t.webp` }, { name: "Justin Schwarzott", rolle: "doppelt" }, { name: "Testperson Drei", rolle: "Testrolle C", foto: "haus:justin" }] } } }).team.personen;
  ok(tdaten.length === 3 && tdaten[0].foto === null && tdaten[0].initialen === "TE" && tdaten[1].foto === `${tbasis}team-t.webp` && tdaten[1].initialen === "T" && tdaten[2].foto === null, "Team aus inhalt.team: Monogramm ohne Foto, echtes Foto hinter dem Link, KI-Porträt des Hauses abgewiesen, Ansprechpartner nicht doppelt", tdaten);
  ok(!S.firmaTeamFotoOk("haus:justin") && S.firmaTeamFotoOk("haus:florentine") && S.firmaTeamFotoOk("team-a.webp") && !S.firmaTeamFotoOk("/portraits/x.jpg"), "Teamfoto: nur echte Fotos (KI-Porträt nein, Bildname ja)");
  ok(/Team \(inhalt\.team\)/.test(S.firmaParameterFehler({ ...PARAMETER, inhalt: { ...INHALT, team: [{ name: "X", rolle: "Y", foto: "haus:justin" }] } }) ?? ""), "firmaParameterFehler lehnt ein KI-Porträt im Team ab");
  ok(S.firmaBildVerweise({ team: [{ name: "a", rolle: "b", foto: "team-a.webp" }, { name: "c", rolle: "d", foto: "haus:florentine" }] }).join() === "team-a.webp", "Import spielt Teamfotos ein (nur Bildnamen)");
  const seiteQ7 = fs.readFileSync("client/src/pages/business-angebot-firma.tsx", "utf8");
  // Das Porträt des Ansprechpartners trägt seinen KI-Hinweis im Bildnachweis; KI-Symbolbilder des Teams (Justin 08.10. abends)
  // stehen dagegen neben echten Namen und sind deshalb einzeln gekennzeichnet (gaf-team-ki, Prüfung in Abschnitt 11).
  ok(!/gaf-ki-rund|portraitHinweis/.test(seiteQ7.replace(/\/\/.*$|\{\/\*[\s\S]*?\*\/\}/gm, "")) && s.bildnachweis.includes("Porträt Justin Schwarzott: Porträt mit KI erstellt"), "kein KI-Hinweis unter dem Porträt des Ansprechpartners — einmal im Bildnachweis am Seitenende");
  // Punkt 8: Inhaltsverzeichnis des Lesers = Ziffern des Rumpfs (Anker vorhanden).
  const html = F.firmaRumpf(D);
  ok(s.vertrag.inhalt.length === 23 && s.vertrag.inhalt.every((z) => html.includes(`id="${z.anker}"`)), "Leser: Inhalt (Präambel, zwanzig Ziffern, zwei Anlagen) mit Ankern im Vertrags-HTML", s.vertrag.inhalt.map((z) => z.anker));
  ok(s.leistungen.karten.map((k) => k.schluessel).join() === "gesellschaft,kapital,strategie,plattform,vertrieb,ansprechpartner", "sechs Leistungskarten");
  // Justin 08.10.2026 abends: Das Wachstumsbudget steht nicht mehr in den Konditionen der Seite, nur im Vertrag.
  ok(S.firmaInvestPosten(D).length === 4 && S.firmaInvestPosten(D).every((p) => p.was && p.wann && p.warum && p.wie) && S.firmaInvestPosten(D).map((p) => p.betrag).join(" · ") === "6.900 € · 2.000 € · 10 % · 5 %", "vier Posten mit Was/Wann/Warum/Wie (Wachstumsbudget: Ihr Anteil 2.000 €)", S.firmaInvestPosten(D).map((p) => p.betrag));
  ok(s.investition.posten.map((p) => p.schluessel).join() === "gruendung,umsatz,verkauf" && !texteAus(s.investition.posten).join(" ").includes("Wachstumsbudget") && !s.investition.fein.join(" ").includes("Wachstumsbudget"), "Konditionen der Seite: Gründung, Umsatz- und Verkaufsbeteiligung — das Wachstumsbudget nur im Vertrag", s.investition.posten.map((p) => p.schluessel));
  ok(/Ziffer 10|Wachstumsbudget/.test(rumpfText) && rumpfText.includes("Wachstumsbudget"), "… das Wachstumsbudget steht weiter im Vertrag");
  ok(s.investition.rechner.minCents === 60_000_000 && s.investition.rechner.maxCents === 300_000_000 && s.investition.rechner.zeileBeteiligung.includes("{umsatz}") && s.investition.rechner.zeileBeteiligung.includes("{cent}") && s.investition.rechner.zeileUnterSchwelle.includes("{schwelle}"), "Rechner 600.000 € … 3.000.000 €, Platzhalter");
  ok(!("extra" in s.investition) && !/Etikettendruck|Labortests|Lager und Logistik/.test(texteAus(s).join("\n")), "Punkt 6: keine Liste „Was Sie direkt zahlen“ auf der Seite");
  ok(/Werbebudget für bezahlte Anzeigen über das gemeinsame Wachstumsbudget nach Absatz 3 hinaus \(Mehrbudget nach Absprache\)/.test(rumpfText) && /Etikettendruck/.test(rumpfText), "… sie steht nur im Vertrag (Ziffer 10 Absatz 6) — Werbebudget nur über das gemeinsame Budget hinaus");
  // Punkt 5: Rechner mit Skala (Schwelle + volle Millionen).
  ok(JSON.stringify(s.investition.rechner.skala) === JSON.stringify([{ cents: 60_000_000, text: "600.000 €", schwelle: true }, { cents: 100_000_000, text: "1 Mio." }, { cents: 200_000_000, text: "2 Mio." }, { cents: 300_000_000, text: "3 Mio." }]) && s.investition.rechner.zahlTitel === "Beteiligung pro Jahr", "Rechner: Skala 600.000 € · 1 Mio. · 2 Mio. · 3 Mio., Titel der Zahl", s.investition.rechner.skala);
  const fr = s.fragen.liste.map((x) => x.frage).join(" | ");
  for (const m of [/Was zahle ich wann/, /Warum eine Umsatzbeteiligung/, /Umsatz nicht wächst/, /Muss ich verkaufen/, /Wachstumsbudget/, /Wie ist die erste Runde abgesichert/, /Bedingungen hat die Bürgschaft/, /Sonderfreigabe/, /kündige/, /Gehört die US-Gesellschaft mir/, /selbst tun/, /Bleibe ich Geschäftsführerin und Eigentümerin/, /Umsatzsteuer/, /Ist die erste Runde ein Kredit\?/])
    ok(m.test(fr), `Frage vorhanden: ${m.source}`);
  ok(s.fragen.liste.length >= 14 && s.fragen.liste.every((x) => x.antwort.length >= 1 && x.antwort.every((a) => a.length > 20)), "mindestens vierzehn Fragen mit Antworten");
  ok(s.kapital.betrag === "250.000 USD" && s.kapital.bedingungen.length === 2 && s.kapital.bedingungen.map((b) => b.titel).join(" | ") === "Nachweis zur Testbedingung | Jahresabschlüsse der letzten zwei Jahre" && s.kapital.bedingungen.every((b) => b.titel && b.text) && s.kapital.sonderfreigabe.unterzeichner === "Justin Schwarzott", "Kapital: Betrag, zwei Bedingungen (die aus den Angebotsdaten zuerst) mit Warum, Sonderfreigabe");
  // E-242 (Gegenprüfung 07.10.2026): Im Code steht NUR die allgemeine Bedingung — eine kundenbezogene kommt aus den Angebotsdaten.
  ok(S.FIRMA_BEDINGUNGEN.length === 1 && S.FIRMA_BEDINGUNGEN[0].schluessel === "jahresabschluesse", "im Code nur die allgemeine Bedingung (Jahresabschlüsse) — kein Kundenbaustein", S.FIRMA_BEDINGUNGEN.map((b) => b.schluessel));
  ok(S.firmaBedingungen({ inhalt: {} }).map((b) => b.schluessel).join() === "jahresabschluesse", "ohne Angebotsdaten: nur Jahresabschlüsse");
  ok(rumpfText.includes("der Nachweis einer erfundenen Testbedingung der Auftraggeberin") && rumpfText.indexOf("erfundenen Testbedingung") < rumpfText.indexOf("die Jahresabschlüsse der Auftraggeberin für die letzten zwei Geschäftsjahre"), "Vertrag: die Bedingung aus den Angebotsdaten steht wörtlich und vor der allgemeinen");
  ok(S.firmaSeite({ ...D, parameter: { ...PARAMETER, inhalt: { ...INHALT, bedingungenAus: ["testbedingung"] } } }).kapital.bedingungen.length === 1, "Bedingung abschaltbar (bedingungenAus)");
  ok(S.firmaBedingungenAusInhalt([{ schluessel: "a b", vertrag: "x", titel: "y", warum: "z" }, { schluessel: "gut", vertrag: "", titel: "y", warum: "z" }, { schluessel: "gut2", vertrag: "v", titel: "t", warum: "w" }, { schluessel: "gut2", vertrag: "v2", titel: "t2", warum: "w2" }]).map((b) => b.schluessel).join() === "gut2", "ungültige oder doppelte Bedingungen fallen weg");
  ok(/inhalt\.bedingungen/.test(S.firmaParameterFehler({ ...PARAMETER, inhalt: { ...INHALT, bedingungen: [{ schluessel: "x", vertrag: "", titel: "", warum: "" }] as any } }) ?? ""), "firmaParameterFehler lehnt eine unvollständige Bedingung ab");
  const mitStimmung = S.firmaSeite({ ...D, parameter: { ...PARAMETER, inhalt: { ...INHALT, bilder: { ...INHALT.bilder, usa: { ...INHALT.bilder.herkunft, src: "szene-b.webp", srcset: undefined } } } } });
  ok(mitStimmung.stimmung?.src === "szene-b.webp" && mitStimmung.bildnachweis.includes("Stimmungsbild mit KI erstellt") && s.stimmung === null && !s.bildnachweis.includes("Stimmungsbild") && s.bildnachweis.includes("Porträt mit KI erstellt"), "höchstens ein Stimmungsbild (usa/stimmung), Bildnachweis nur aus dem, was die Seite zeigt", mitStimmung.bildnachweis);
  ok(s.leistungen.karten.every((k) => !k.bild), "Leistungskarten ohne Fotos (Runde 2, Punkt 5)");
  ok(s.leistungen.karten[0].text === "Ihre US-Gesellschaft komplett — mit Office, Empfangsdame, Telefonannahme, rechtlichen Unterlagen, Dokumenten und einem direkten Ansprechpartner für Sie", "Leistung „US-Gesellschaft“: Justins Untertitel wörtlich (Punkt 2)");
  ok(s.investition.titel === "Unsere Vereinbarung" && S.FIRMA_VEREINBARUNG_TITEL === "Unsere Vereinbarung", "„Ihre Investition“ heißt „Unsere Vereinbarung“ (Punkt 6, eine Zeile in der Textquelle)");
  const gp = s.investition.posten.find((p) => p.schluessel === "gruendung")!;
  ok(gp.titel === "Gründungskosten" && gp.hinweis === "Wir verdienen an den Gründungskosten nichts — sie decken ausschließlich, was Gründung und Start kosten." && gp.bestandteile?.join(" · ") === "Gründung und Eintragung · EIN und ITIN · Registered Agent · Anwalt · Steuerberater · Bank- und Kontoeröffnung · Unterlagen · Behörden" && !/\d+[.,]?\d*\s?€/.test(gp.bestandteile.join(" ")), "Gründungskosten: Justins Satz, Bestandteile ohne Einzelbeträge (Punkt 7)");
  const ue = S.firmaBestellUebersicht(D);
  ok(ue.titel === "Unsere Zusammenarbeit im Überblick" && ["Vertragspartner", "Auftraggeberin", "Gründungskosten", "Wachstumsbudget", "Umsatzbeteiligung", "Verkaufsbeteiligung", "Erste Runde", "Bürgschaft", "Laufzeit", "Umsatzsteuer", "Recht"].every((l) => ue.zeilen.some((z) => z.label === l)), "Bestellübersicht: alle Kernzeilen");
  const an = S.firmaAnnahmeTexte(D);
  // Punkt 9: eigener Knopf der Firmenfassung aus EINER Quelle (Seite, Annahmevermerk im PDF); Hildbrand unverändert.
  ok(S.FIRMA_KNOPF === "Zusammenarbeit und Kapital verbindlich annehmen" && SA.ANGEBOT_KNOPF === "Auftrag zahlungspflichtig erteilen", "Knopf Firma neu, Knopf Individualangebot unverändert");
  ok(rumpfText.includes(`Wird mit Unterschrift und Klick auf „${S.FIRMA_KNOPF}“ angenommen.`) && F.firmaRumpf(D, { am: new Date("2026-10-08T10:00:00Z"), ip: "203.0.113.7", userAgent: "Mozilla/5.0", hash: "x", unterschrift: { art: "getippt", name: "Martina Muster" } }).includes(`Angenommen mit Unterschrift und Klick auf „${S.FIRMA_KNOPF}“`), "Annahmevermerk im PDF nennt Unterschrift und Knopf der Firmenfassung");
  ok(an.unterKnopf.startsWith("Mit Klick nehmen Sie das Angebot verbindlich an; die Gründungskosten von 6.900 € werden mit der Rechnung fällig"), "Satz unter dem Knopf nennt die Zahlungspflicht", an.unterKnopf);
  ok(an.knopf === S.FIRMA_KNOPF && an.unternehmer.includes("kein Widerrufsrecht") && an.vertretung.includes("allein zu vertreten"), "Annahme: Knopf und zwei Pflicht-Häkchen");
  ok(S.firmaKundeAnrede(KUNDE) === "Sehr geehrte Frau Muster" && S.firmaKundeAnrede({ ...KUNDE, vertretung: { ...KUNDE.vertretung, anrede: "Herr" as any } }) === "Sehr geehrter Herr Muster", "Anrede");
  ok(S.firmaPflichtFehlen(D).length === 0 && S.firmaPflichtFehlen({ ...D, compliance: null }).some((x) => /Prüfbericht/.test(x)) && S.firmaPflichtFehlen({ ...D, buergin: SA.BUERGIN_VORGABE }).length > 0, "Pflichtfelder sperren die Annahme");
  ok(/Anwalt/.test(S.firmaVersandSperre(BUERGIN_VOLL, {}) ?? "") && S.firmaVersandSperre(BUERGIN_VOLL, { anwalt: { name: "Kanzlei Prüf", am: "2026-10-07" } }) === null && S.firmaVersandSperre(SA.BUERGIN_VORGABE, { anwalt: { name: "K", am: "2026-10-07" } }) === null && /Registernachweis/.test(SA.angebotVersandSperre(SA.BUERGIN_VORGABE) ?? ""), "Versandsperre Firma = nur Anwaltsfreigabe (Justin 08.10. abends); Individualangebot behält den Registernachweis");
  const r = ["sofort", "monatlich", "umsatz", "verkauf"].map((f) => S.firmaRechnungsText({ angebotRef: "FIAON-IA-FPRUEF1", auftragRef: "FIAON-X", faelligkeit: f, titel: f === "monatlich" ? S.FIRMA_TEIL_TITEL.monat(3) : f === "umsatz" ? S.FIRMA_TEIL_TITEL.umsatz(2027, 2) : f === "verkauf" ? S.FIRMA_TEIL_TITEL.verkauf : "Gründung", zeitraum: f === "umsatz" ? "Q2 2027" : null, bemessungCents: 70_000_000 }));
  ok(r[0].beschreibung.includes("Gründung der US-Gesellschaft") && r[1].beschreibung.includes("Wachstumsbudget — Ihr Anteil, Monat 3") && r[1].beschreibung.includes("gemeinsamen Wachstumsbudget") && r[2].beschreibung.includes("Umsatzbeteiligung — Q2 2027") && r[2].zeitraum === "Q2 2027" && r[3].beschreibung.includes("Verkaufsbeteiligung"), "Rechnungstexte je Posten");
}

titel("8. Hildbrand: Individualangebot unverändert");
{
  // Der Prüfstand des Individualangebots (ohne DB) rechnet die Prüfsumme des Testangebots D gegen PRUEFSUMME_D_VORHER —
  // hier nur gestartet, damit die Testdaten nicht ein zweites Mal im Repo stehen.
  let aus = ""; let code = 0;
  try { aus = execFileSync("npx", ["tsx", "scripts/pruef-individualangebot.ts"], { encoding: "utf8", env: { ...process.env, DATABASE_URL: "postgres://pruefstand:ohne@127.0.0.1:1/keine-datenbank" } }); }
  catch (e: any) { code = e?.status ?? 1; aus = String(e?.stdout ?? ""); }
  const zahl = aus.match(/(✓ alle \d+ Prüfungen grün|✗ \d+ von \d+ Prüfungen rot)/);
  ok(code === 0, "scripts/pruef-individualangebot.ts (ohne DB) grün", aus.split("\n").filter((x) => /FEHLER/.test(x)).slice(0, 5));
  ok(!/FEHLER\s+Prüfsumme \(text_hash\) unverändert/.test(aus), "PRUEFSUMME_D_VORHER unverändert");
  if (zahl) console.log(`  (Individualangebot: ${zahl[0]})`);
  ok(SA.ANGEBOT_FASSUNG === "IA-2026-10-01-KG" && !S.istFirmenFassung(SA.ANGEBOT_FASSUNG) && S.istFirmenFassung(S.FIRMA_FASSUNG), "Fassungen getrennt (IA-… vs. IA-FIRMA-…)");
  void V;
}

// ── Testbilder (erfunden, wenige Byte) — mit Metadaten, damit das Bereinigen etwas zu tun hat ───────────────────────
function rifBlock(art: string, daten: Buffer): Buffer {
  const kopf = Buffer.alloc(8); kopf.write(art, 0, "latin1"); kopf.writeUInt32LE(daten.length, 4);
  return Buffer.concat([kopf, daten, daten.length % 2 ? Buffer.alloc(1) : Buffer.alloc(0)]);
}
function testWebp(mitMetadaten: boolean, farbe = 0): Buffer {
  const vp8x = Buffer.alloc(10); vp8x[0] = mitMetadaten ? 0x0c : 0; // EXIF + XMP gemeldet
  const bild = Buffer.from([0x2f, 0x00, 0x00, 0x00, 0x00, 0x07, 0x10, 0x11, 0x11, 0x88, 0x88, 0xfe, 0x07, farbe & 0xff]);
  const bloecke = [rifBlock("VP8X", vp8x), rifBlock("VP8L", bild)];
  if (mitMetadaten) bloecke.push(rifBlock("EXIF", Buffer.from("Exif\0\0MM\0*\0\0\0\x08GPS-Pruefstand")), rifBlock("XMP ", Buffer.from("<x:xmpmeta>Autor Pruefstand</x:xmpmeta>")));
  const rumpf = Buffer.concat(bloecke);
  const kopf = Buffer.alloc(12); kopf.write("RIFF", 0, "latin1"); kopf.writeUInt32LE(4 + rumpf.length, 4); kopf.write("WEBP", 8, "latin1");
  return Buffer.concat([kopf, rumpf]);
}
function pngBlock(art: string, daten: Buffer): Buffer {
  const b = Buffer.alloc(12 + daten.length); b.writeUInt32BE(daten.length, 0); b.write(art, 4, "latin1"); daten.copy(b, 8); return b; // CRC egal (nicht neu gerechnet)
}
function testPng(): Buffer {
  return Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), pngBlock("IHDR", Buffer.alloc(13)), pngBlock("tEXt", Buffer.from("Author\0Pruefstand")), pngBlock("IDAT", Buffer.alloc(4)), pngBlock("IEND", Buffer.alloc(0))]);
}
function testJpeg(): Buffer {
  const seg = (marke: number, daten: Buffer) => { const b = Buffer.alloc(4); b[0] = 0xff; b[1] = marke; b.writeUInt16BE(daten.length + 2, 2); return Buffer.concat([b, daten]); };
  return Buffer.concat([Buffer.from([0xff, 0xd8]), seg(0xe0, Buffer.from("JFIF\0\x01\x01")), seg(0xe1, Buffer.from("Exif\0\0GPS")), seg(0xe2, Buffer.from("ICC_PROFILE\0")), seg(0xfe, Buffer.from("Kommentar")), seg(0xda, Buffer.from([0, 0, 0])), Buffer.from([1, 2, 3, 0xff, 0xd9])]);
}

titel("9. Vor-Live-Prüfung (07./08.10.2026): Texte, Versandsperre, keine Kundenmail, Bilder, Personal");
{
  const ZT = await import("../server/lib/fiaon-global-zahlungstakt");
  const FP = await import("../server/lib/fiaon-global-firma-post");
  const BB = await import("../server/lib/fiaon-bild-bereinigen");
  const lesen = (d: string) => fs.readFileSync(path.join(process.cwd(), d), "utf8");
  // ── Texte: nichts zusagen, was über Ziffer 7 hinausgeht ──
  const seite = S.firmaSeite(D); const alles = texteAus(seite).join("\n");
  ok(!/sehr sicher/i.test(alles) && !/sobald die Bedingungen der Bürgschaft erfüllt sind/i.test(texteAus(seite.hero).join("\n")), "Seite: kein „sehr sicher“, im Kopf kein „sobald …“");
  ok(G.frageSicher[0].startsWith("Vertraglich garantiert nach Ziffer 7") && /Auszahlung einer ersten Runde/.test(G.frageSicher[0]) && /erstatten wir Ihnen die Gründung/.test(G.frageSicher.join(" ")) && /entscheidet das Institut/.test(G.frageSicherMehr) && seite.fragen.liste.some((f) => f.antwort.includes(G.frageSicherMehr)), "„Wie ist die erste Runde abgesichert?“: Auszahlung garantiert nach Ziffer 7, sonst Erstattung; Institut entscheidet (unter „Weitere Fragen“)", G.frageSicher[0]);
  ok(!/erhält die erste Runde/.test(G.frageRot) && /Ziffer 7/.test(G.frageRot) && /erstatten wir Ihnen die Gründung/.test(G.frageRot), "Frage „Rot“: keine Zusage „erhält die erste Runde“, sondern Frist und Erstattung", G.frageRot);
  // Runde 2 (Justin 08.10.2026, Punkt 3) — sein Satz wörtlich, ohne Verstärker, an erster Stelle (Kopf und „Ihr Kapital“).
  const JUSTINS_SATZ = "Vertraglich garantiert nach Ziffer 7: eine erste Runde über 250.000 USD für Ihre Gesellschaft. Auszahlung innerhalb von drei Monaten nach Annahme.";
  ok(G.satz === JUSTINS_SATZ && G.kapital[0] === JUSTINS_SATZ && seite.hero.kapital.satz === JUSTINS_SATZ, "Garantie-Satz wörtlich (Kopf neben der großen Zahl und Kapital)", G.satz);
  ok(!/sehr sicher|sicher|ganz bestimmt|auf jeden Fall|100 %|erhält die erste Runde/i.test([...G.kapital, G.nutzenKapital, G.leistungKapital, G.phaseKapital, G.uebersicht, G.annahmeUnterKnopf, ...G.frageSicher, G.frageSicherMehr, G.frageRot].join(" ")), "keine Verstärker und kein „erhält die erste Runde“ auf der Seite");
  ok(!/Normalerweise/.test(alles) && /Die Geschäftsleitung hat die Bürgschaft trotz offener Punkte freigegeben/.test(alles), "Sonderfreigabe ohne Behauptung über eine Praxis der Bürgin");
  ok([...G.kapital, G.leistungKapital, G.phaseKapital, G.nutzenKapital, ...G.frageSicher].filter((x) => /garantier|erhält/i.test(x)).every((x) => /Ziffer 7/.test(x)), "jeder Satz, der die erste Runde zusagt, bindet sie an Ziffer 7");
  // ── Versandsperre an die Fassung gebunden ──
  const jetzt = { textHash: F.firmaTextHash(D), anlage1: F.firmaAnlage1Pruefsumme(D) };
  ok(S.firmaVersandSperre(BUERGIN_VOLL, { anwalt: { name: "Kanzlei Prüf", am: "2026-10-07", ...jetzt } }, jetzt) === null, "Freigabe zur aktuellen Fassung → Versand frei");
  ok(/geändert/.test(S.firmaVersandSperre(BUERGIN_VOLL, { anwalt: { name: "Kanzlei Prüf", am: "2026-10-07", ...jetzt } }, { ...jetzt, textHash: "0".repeat(64) }) ?? ""), "Vertrag seit der Freigabe geändert → gesperrt");
  ok(/geändert/.test(S.firmaVersandSperre(BUERGIN_VOLL, { anwalt: { name: "Kanzlei Prüf", am: "2026-10-07", ...jetzt } }, { ...jetzt, anlage1: "1".repeat(64) }) ?? ""), "Anlage 1 seit der Freigabe geändert → gesperrt");
  ok(/geändert/.test(S.firmaVersandSperre(BUERGIN_VOLL, { anwalt: { name: "Kanzlei Prüf", am: "2026-10-07" } }, jetzt) ?? ""), "Freigabe ohne Prüfsumme → gesperrt (neu eintragen)");
  ok(F.firmaTextHash({ ...D, parameter: { ...PARAMETER, monatCents: 199100 } }) !== jetzt.textHash, "ein geänderter Anteil am Wachstumsbudget ändert die Prüfsumme (sperrt eine alte Freigabe)");
  // ── Nachprüfung 08.10.2026: Versand erst bei Sunbiz „Active“ (Justin 07.10.) — nicht schon beim Wort „Sunbiz“ ──
  ok(S.firmaRegisterAktiv("Sunbiz-Auszug vom 09.10.2026: Status Active") && S.firmaRegisterAktiv("Registerauszug (Sunbiz), ACTIVE")
    && !S.firmaRegisterAktiv("Registerauszug (Sunbiz) vom 07.10.2026") && !S.firmaRegisterAktiv("Sunbiz-Auszug vom 01.10.2026: Status Inactive")
    && !S.firmaRegisterAktiv("Sunbiz: INACTIVE, Reinstatement beantragt — danach Active") && !S.firmaRegisterAktiv("Sunbiz: Activeness") && !S.firmaRegisterAktiv(null),
    "Status „Active“: als eigenes Wort, nie zusammen mit „Inactive“");
  const freiAnwalt = { anwalt: { name: "Kanzlei Prüf", am: "2026-10-07" } };
  const ohneStatus = { ...BUERGIN_VOLL, bestaetigtGrundlage: "Registerauszug (Sunbiz) vom 07.10.2026" };
  const inaktiv = { ...BUERGIN_VOLL, bestaetigtGrundlage: "Sunbiz-Auszug vom 07.10.2026: Status Inactive" };
  ok(S.firmaVersandSperre(ohneStatus, freiAnwalt) === null && S.firmaVersandSperre(inaktiv, freiAnwalt) === null && S.firmaVersandSperre(BUERGIN_VOLL, freiAnwalt) === null,
    "Versandsperre Firma: der Registerstatus sperrt nicht mehr (Justin 08.10. abends) — nur die Anwaltsfreigabe zählt", { ohneStatus: S.firmaVersandSperre(ohneStatus, freiAnwalt), inaktiv: S.firmaVersandSperre(inaktiv, freiAnwalt) });
  ok(SA.angebotVersandSperre(ohneStatus) === null, "Individualangebot (E-268) unverändert: angebotVersandSperre verlangt weiter nur den Registerauszug");
  // ── Zweite Nachprüfung 08.10.2026 (N4): Verneinungen sperren; die Freigabe hängt auch an den Angaben der Bürgin ──
  const verneint = ["Sunbiz-Auszug vom 09.10.2026: Status not active", "Sunbiz: Status nicht Active", "Sunbiz: Admin Dissolution, früher Active",
    "Sunbiz: kein Active-Status", "Sunbiz: Active — revoked am 01.10.2026", "Sunbiz: no longer active", "Sunbiz: non-active", "Sunbiz: INACT/UA",
    "Sunbiz: formerly Active, withdrawn", "Sunbiz: Active (Annual Report nicht eingereicht, aufgelöst)", "Sunbiz: Status: Inactive", "Sunbiz: nicht mehr Active"];
  const bejaht = ["Sunbiz-Auszug vom 09.10.2026: Status Active", "Registerauszug (Sunbiz), ACTIVE", BUERGIN_VOLL.bestaetigtGrundlage, "Sunbiz Detail by Entity Name vom 09.10.2026 — Status: ACTIVE", "Sunbiz Document No. L21000012345 vom 09.10.2026: Status Active", "Sunbiz Document Number L21000012345, Status Active, Annual Report 2026 eingereicht"];
  ok(verneint.every((g) => !S.firmaRegisterAktiv(g)) && bejaht.every((g) => S.firmaRegisterAktiv(g)), "Status „Active“: Verneinung, Auflösung, Widerruf, „früher Active“ sperren — der echte Wortlaut „Status Active/ACTIVE“ gibt frei", { durch: verneint.filter((g) => S.firmaRegisterAktiv(g)), gesperrt: bejaht.filter((g) => !S.firmaRegisterAktiv(g)) });
  const bJetzt = F.firmaBuerginPruefsumme(BUERGIN_VOLL);
  const zweiterAuszug = { ...BUERGIN_VOLL, bestaetigtGrundlage: "Sunbiz-Auszug vom 09.10.2026: Status Active (zweiter Auszug)" };
  ok(/^[0-9a-f]{64}$/.test(bJetzt) && F.firmaBuerginPruefsumme(zweiterAuszug) !== bJetzt && F.firmaBuerginPruefsumme({ ...BUERGIN_VOLL }) === bJetzt
    && F.firmaBuerginPruefsumme({ ...BUERGIN_VOLL, bestaetigt: false }) !== bJetzt, "Prüfsumme der Bürgin-Angaben: Grundlage und Haken zählen mit, gleiche Angaben → gleiche Summe");
  ok(F.firmaTextHash({ ...D, buergin: zweiterAuszug }) === F.firmaTextHash(D) && F.firmaAnlage1Pruefsumme({ ...D, buergin: zweiterAuszug }) === F.firmaAnlage1Pruefsumme(D), "die Grundlage steht nicht im Vertrag — darum bindet die Freigabe sie über eine eigene Prüfsumme (Vertragsprüfsumme unberührt)");
  const jetztB = { ...jetzt, buergin: bJetzt };
  const freiMitB = { anwalt: { name: "Kanzlei Prüf", am: "2026-10-07", ...jetztB } };
  ok(S.firmaVersandSperre(BUERGIN_VOLL, freiMitB, jetztB) === null, "Freigabe mit Bürgin-Prüfsumme, Angaben unverändert → frei");
  const nachAenderung = S.firmaVersandSperre(zweiterAuszug, freiMitB, { ...jetzt, buergin: F.firmaBuerginPruefsumme(zweiterAuszug) });
  ok(/Angaben der Bürgin/.test(nachAenderung ?? "") && /nur Justin/.test(nachAenderung ?? ""), "Bürgin nach der Freigabe geändert (auch mit „Active“) → gesperrt, bis Justin neu freigibt", nachAenderung);
  ok(/Angaben der Bürgin/.test(S.firmaVersandSperre(BUERGIN_VOLL, { anwalt: { name: "Kanzlei Prüf", am: "2026-10-07", ...jetzt } }, jetztB) ?? ""), "alte Freigabe ohne Bürgin-Prüfsumme → gesperrt (neu eintragen)");
  const firmaQ = lesen("server/lib/fiaon-global-angebot-firma.ts");
  ok(/buergin: firmaBuerginPruefsumme\(l\.d\.buergin\) \};\n  const anwalt = \{ name, am, von: wer, fassung: l\.d\.fassung, \.\.\.aktuell \};/.test(firmaQ)
    && /firmaVersandSperre\(d\.buergin, fr, \{ textHash: firmaTextHash\(d\), anlage1: firmaAnlage1Pruefsumme\(d\), buergin: firmaBuerginPruefsumme\(d\.buergin\) \}\)/.test(firmaQ),
    "Freigabe speichert die Bürgin-Prüfsumme; die Liste der Leitung vergleicht sie");
  // ── Zweite Nachprüfung 08.10.2026 (N1): „Nachholen“ meldet beim Firmenangebot keine Bestätigungsmail ──
  const A0 = await import("../server/lib/fiaon-global-angebot");
  const mFirma = A0.nachholenMeldung({ ok: true, grund: "Firmenangebot — keine automatische Bestätigungsmail", firma: true });
  ok(!/Bestätigungsmail stehen/.test(mFirma) && /keine Mail an die Kundin/.test(mFirma) && /Vertrag und Rechnung schickt der Ansprechpartner von Hand/.test(mFirma), "Nachholen beim Firmenangebot: „keine Mail — Vertrag und Rechnung von Hand“", mFirma);
  ok(A0.nachholenMeldung({ ok: true, grund: null }) === "Bestellung, Akte und Bestätigungsmail stehen." && A0.nachholenMeldung({ ok: false, grund: "Brevo aus" }) === "Bestellung und Akte stehen — die Mail ging nicht raus: Brevo aus", "Nachholen beim Individualangebot (E-268): Wortlaut unverändert");
  ok(/meldung: nachholenMeldung\(mail\) \+ sgSatz/.test(lesen("server/routes/fiaon-global-angebot.ts")) && /firma: true \};/.test(lesen("server/lib/fiaon-global-angebot.ts")), "Route „Nachholen“ baut die Meldung aus nachholenMeldung; bestaetigungSenden meldet „firma“");
  // ── Zweite Nachprüfung 08.10.2026 (N6): CHECK-Tausch wiederholbar, Annahme erst mit CHECKs, Import prüft vor --produktion ──
  const angebotQ = lesen("server/lib/fiaon-global-angebot.ts");
  const ensureTeil = angebotQ.slice(angebotQ.indexOf("export function ensureAngebotTabellen"), angebotQ.indexOf("// ── JSONB lesen und schreiben"));
  ok(/if \(!\(await firmaTeileCheckSichern\(\)\)\)/.test(ensureTeil) && !/ADD CONSTRAINT fiaon_global_angebot_teile_nr_check/.test(ensureTeil) && /if \(teileCheckOk\) return true;/.test(angebotQ) && /return \(teileCheckOk = await firmaTeileCheckLesen\(\)\);/.test(angebotQ),
    "ensureAngebotTabellen merkt sich nur den Erfolg des CHECK-Tauschs (firmaTeileCheckSichern) — scheitert er, versucht es der nächste Aufruf");
  const annQ = firmaQ.slice(firmaQ.indexOf("export async function firmaAnnehmen"), firmaQ.indexOf("/** Bestellzeile anlegen"));
  ok(annQ.indexOf("firmaTeileCheckSichern()") > 0 && annQ.indexOf("firmaTeileCheckSichern()") < annQ.indexOf("firmaVertragPdf(") && annQ.indexOf("firmaTeileCheckSichern()") < annQ.indexOf("SET status = 'angenommen'") && /fehler\(503, [^\n]*code: "TECHNIK"/.test(annQ),
    "firmaAnnehmen fragt die CHECKs VOR PDF und Annahme — sonst 503, nichts gespeichert");
  const impQ = lesen("scripts/angebot-firma-anlegen.ts");
  ok(impQ.indexOf("if (produktion) {\n  const fehltVor = await vorbedingungen(true);") > 0 && impQ.indexOf("if (produktion) {\n  const fehltVor = await vorbedingungen(true);") < impQ.indexOf("await A.ensureAngebotTabellen();")
    && /schema_migrations WHERE filename = '096_global_angebot_firma\.sql'/.test(impQ) && /bild\/vorab\.webp/.test(impQ) && /Zurücknehmen, falls nötig/.test(impQ),
    "Import-Skript: vor --produktion Migration 096, Spalten, CHECKs und Live-Code prüfen (vor jeder DDL), Hinweis zum Zurücknehmen");
  // ── Nachprüfung 08.10.2026: „Link nur an Justin“ — bei gesperrtem Versand nur die Stufe „inhaber“ ──
  const gesperrt = { art: "firma", id: 1, status: "offen", versandSperre: "Die Freigabe des Vertrags durch den Anwalt fehlt.", link: "https://example.org/business/angebot/T1" };
  const freiE = { art: "firma", id: 2, status: "offen", versandSperre: null, link: "https://example.org/business/angebot/T2" };
  const angenommenE = { art: "firma", id: 3, status: "angenommen", versandSperre: "x", link: "https://example.org/business/angebot/T3" };
  const individual = { id: 4, status: "offen", versandSperre: "x", link: "https://example.org/business/angebot/T4" };
  const fuer = (stufe: string | null) => F.firmaListeFuerStufe([gesperrt, freiE, angenommenE, individual] as Record<string, unknown>[], stufe);
  const lt = fuer("leitung"); const gf = fuer("geschaeftsfuehrung"); const inh = fuer("inhaber"); const ohne = fuer(null);
  ok(lt[0].link === null && lt[0].linkNurInhaber === true && gf[0].link === null && ohne[0].link === null && lt[0].versandSperre === gesperrt.versandSperre, "gesperrtes Firmenangebot: „leitung“/„geschaeftsfuehrung“ sehen den Grund, aber keinen Link", lt[0]);
  ok(inh[0].link === gesperrt.link && !("linkNurInhaber" in inh[0]), "„inhaber“ (Justin) sieht den Link", inh[0]);
  ok(lt[1].link === freiE.link && lt[2].link === angenommenE.link && lt[3].link === individual.link, "freie und angenommene Firmenangebote und Individualangebote unverändert");
  const routen = lesen("server/routes/fiaon-global-angebot.ts");
  ok(/const FIRMA_NUR_INHABER: ReadonlySet<string> = new Set\(\["freigabe"\]\)/.test(routen) && /requireChef\(FIRMA_NUR_INHABER\.has\(pfad\) \? "inhaber" : "leitung"\)/.test(routen), "Route „Freigabe Anwalt“ nur für die Stufe „inhaber“");
  ok(/angebote: firmaListeFuerStufe\(await angebotListe\(/.test(routen) && /req\.chef\?\.stufe\)/.test(routen), "Liste der Leitung geht durch firmaListeFuerStufe (Stufe aus dem Chef-Ausweis)");
  // ── Zahlungstakt: keine Erinnerungsmail an die Firmenkundin, die Aufgabe am zehnten Tag bleibt ──
  const auftrag = new Date("2026-10-05T08:00:00Z"); // Montag
  const am = (tag: string) => new Date(`${tag}T10:00:00+02:00`);
  const st = (ohne: boolean) => ({ status: "offen", erstelltAm: auftrag, erinnerung1Am: null, erinnerung2Am: null, aufgabeAm: null, ohneErinnerungsmail: ohne });
  ok(ZT.zahlungstaktStufe(st(false), am("2026-10-08")) === "erinnerung_1" && ZT.zahlungstaktStufe(st(false), am("2026-10-12")) === "erinnerung_2", "Global-Auftrag: Erinnerung an Tag 3 und 7 wie bisher");
  ok(ZT.zahlungstaktStufe(st(true), am("2026-10-08")) === null && ZT.zahlungstaktStufe(st(true), am("2026-10-12")) === null, "Firmenangebot: an Tag 3 und 7 KEINE Erinnerungsmail");
  ok(ZT.zahlungstaktStufe(st(true), am("2026-10-15")) === "aufgabe", "Firmenangebot: an Tag 10 die Aufgabe „anrufen“");
  ok(FP.istFirmenAkte({ bestaetigungen: { firmenangebot: true } }) && FP.istFirmenAkte({ bestaetigungen: JSON.stringify({ firmenangebot: true }) }) && !FP.istFirmenAkte({ bestaetigungen: { annahme: "x" } }) && !FP.istFirmenAkte(null), "istFirmenAkte: Objekt und Text, sonst nein");
  ok(FP.globalAutomatik(undefined) && FP.globalAutomatik("System (FIAON Global, Zahlungstakt)") && FP.globalAutomatik("Tageslauf (Pflichtenkalender)") && !FP.globalAutomatik("Daniel Stripling"), "Automatik = leer, „System …“, „Tageslauf …“; ein Name = von Hand");
  ok(await FP.firmaGlobalMailSperre("global_frist", { bestaetigungen: { firmenangebot: true } }, "x@example.org", "Tageslauf (Pflichtenkalender)") === true
    && await FP.firmaGlobalMailSperre("global_frist", { bestaetigungen: { firmenangebot: true } }, "x@example.org", "Daniel Stripling") === false
    && await FP.firmaGlobalMailSperre("global_zugang", { bestaetigungen: { firmenangebot: true } }, "x@example.org", undefined) === false, "Global-Mail an eine Firmenakte: Automatik gesperrt, von Hand und „Zugang angefordert“ frei");
  // ── Die Türen und Quellen (Quelltext — damit niemand sie beim nächsten Umbau verliert) ──
  const mw = lesen("server/make-webhook.ts");
  ok(/firmaKundinAdresse/.test(mw) && mw.indexOf("firmaKundinAdresse") < mw.indexOf("DIE VERTRAGSBESTÄTIGUNG NUR MIT IHREM PDF") && /!payload\.test && !opts\.manuell/.test(mw), "Mail-Tür (make-webhook): Wand E-301 vor dem Versand, nur für Automatik");
  ok(/firmaGlobalMailSperre/.test(lesen("server/lib/fiaon-global-auftrag.ts")), "globalMailSenden fragt die Wand E-301");
  ok(/ohneErinnerungsmail: istFirmenAkte\(z\)/.test(lesen("server/lib/fiaon-global-zahlungstakt.ts")), "Zahlungstakt reicht das Merkmal der Firmenakte durch");
  ok(/OR \$\{ohneKundenmail\}::boolean THEN NOW\(\)/.test(lesen("server/lib/fiaon-global-angebot-startgespraech.ts")), "Startgespräch eines Firmenangebots: Terminerinnerung ab der Buchung erledigt (keine Mail)");
  ok(/rechnung_ust_modus = \$\{f\.uid \? "reverse_charge" : "none"\} WHERE ref = \$\{ref\}/.test(lesen("server/lib/fiaon-global-angebot-firma.ts")), "Reverse Charge steht schon an der Bestellzeile — vor der Rechnungsnummer");
  // ── Bilder: bereinigen, nur Namen, Adresse nur hinter dem Link ──
  const w = BB.bildOhneMetadaten(testWebp(true), "a.webp");
  ok(w.typ === "image/webp" && w.entfernt.join() === "EXIF,XMP" && !w.daten.includes(Buffer.from("EXIF")) && !w.daten.includes(Buffer.from("Pruefstand")) && w.daten.readUInt32LE(4) + 8 === w.daten.length && (w.daten[20] & 0x0c) === 0, "WebP: EXIF und XMP entfernt, Merker gelöscht, RIFF-Länge stimmt", w.entfernt);
  ok(BB.bildOhneMetadaten(testWebp(false), "b.webp").entfernt.length === 0, "WebP ohne Metadaten bleibt unverändert");
  const pn = BB.bildOhneMetadaten(testPng(), "c.png");
  ok(pn.typ === "image/png" && pn.entfernt.join() === "tEXt" && !pn.daten.includes(Buffer.from("Pruefstand")), "PNG: tEXt entfernt");
  const jp = BB.bildOhneMetadaten(testJpeg(), "d.jpg");
  ok(jp.typ === "image/jpeg" && jp.entfernt.join() === "APP1 (Exif/XMP),COM" && jp.daten.includes(Buffer.from("ICC_PROFILE")) && !jp.daten.includes(Buffer.from("GPS")), "JPEG: Exif und Kommentar entfernt, Farbprofil bleibt", jp.entfernt);
  const wirft = (f: () => unknown) => { try { f(); return false; } catch { return true; } };
  ok(wirft(() => BB.bildOhneMetadaten(Buffer.from("<svg xmlns='http://www.w3.org/2000/svg'/>"), "e.svg")) && wirft(() => BB.bildOhneMetadaten(testPng(), "f.webp")) && wirft(() => BB.bildOhneMetadaten(testWebp(true).subarray(0, 30), "g.webp")), "kein SVG, Endung muss zum Inhalt passen, abgeschnittene Datei abgelehnt");
  const token = "FIAON-IA-FPRUEF1.1999999999999.sig";
  const mit = S.firmaInhaltMitBildLinks({ ...INHALT, glas: { etikett: "etikett-t.webp", etikettVerhaeltnis: 1.3, deckel: "silber", inhalt: "#333333", name: "Testglas", foto: { src: "foto-t.webp", breite: 10, hoehe: 10, alt: "Foto", ki: false } } }, token);
  const basis = `/api/fiaon/global/angebot/${encodeURIComponent(token)}/bild/`;
  ok(mit.bilder?.herkunft?.src === `${basis}szene-a.webp` && mit.bilder?.herkunft?.srcset === `${basis}szene-a.webp 960w, ${basis}szene-a-gross.webp 1920w` && mit.glas?.etikett === `${basis}etikett-t.webp` && mit.glas?.foto.src === `${basis}foto-t.webp`, "Bildnamen → Adressen hinter dem Link (src, srcset, Etikett, Foto)", mit.bilder?.herkunft);
  const alt = S.firmaInhaltMitBildLinks({ bilder: { x: { src: "/angebote/k1/x.webp", breite: 1, hoehe: 1, alt: "", ki: true } }, glas: { etikett: "/angebote/k1/e.webp", etikettVerhaeltnis: 1, deckel: "silber", inhalt: "#000000", name: "", foto: { src: "f.webp", breite: 1, hoehe: 1, alt: "", ki: false } } }, token);
  ok(!alt.bilder?.x && alt.glas === null, "ein öffentlicher Pfad wird nie ausgegeben (Bild fällt weg, Glas ohne gültiges Etikett entfällt)");
  ok(/nur Bildnamen/.test(S.firmaParameterFehler({ ...PARAMETER, inhalt: { ...INHALT, bilder: { x: { src: "/angebote/k1/x.webp", breite: 1, hoehe: 1, alt: "", ki: true } } } }) ?? ""), "firmaParameterFehler lehnt Pfade statt Bildnamen ab");
  ok(S.firmaBildVerweise(INHALT).join() === "szene-a.webp,szene-a-gross.webp", "firmaBildVerweise nennt alle Namen (src und srcset)", S.firmaBildVerweise(INHALT));
  // ── Seite: Hinweis zum Protokoll der Linkaufrufe (wie E-268), außerhalb des Vertrags ──
  const seiteQ = lesen("client/src/pages/business-angebot-firma.tsx");
  ok(/import \{ ANGEBOT_AUFRUF_HINWEIS \} from "@shared\/fiaon-global-angebot"/.test(seiteQ) && (seiteQ.match(/\{ANGEBOT_AUFRUF_HINWEIS\}/g) ?? []).length >= 1 && /href="\/datenschutz"/.test(seiteQ), "Firmenseite zeigt den Hinweis zum Protokoll der Linkaufrufe und die Datenschutzerklärung");
  ok(!F.firmaRumpf(D).includes(SA.ANGEBOT_AUFRUF_HINWEIS), "der Hinweis steht nicht im Vertragstext (Prüfsumme unberührt)");
  // ── Personal: /team unverändert, keine Personalmaßnahmen im Repo ──
  ok(!fs.existsSync(path.join(process.cwd(), "shared/fiaon-team.ts")), "shared/fiaon-team.ts gibt es nicht (keine Liste mit Kündigungen/Sperren im Repo)");
  let teamGleich = true; try { execFileSync("git", ["diff", "--quiet", "HEAD", "--", "client/src/components/site/Team.tsx"]); } catch { teamGleich = false; }
  ok(teamGleich, "client/src/components/site/Team.tsx unverändert gegenüber main");
}

// ── Test-PNG (erfunden): RGBA 8 Bit, gültige Prüfsummen — leer oder mit einem Strich ──────────────────────────────
function testPngRgba(breite: number, hoehe: number, tinte: boolean): Buffer {
  const zeile = breite * 4 + 1; const roh = Buffer.alloc(zeile * hoehe);
  if (tinte) for (let x = 10; x < breite - 10; x++) { const y = Math.round(hoehe / 2 + Math.sin(x / 9) * 8); const o = y * zeile + 1 + x * 4; roh[o] = 27; roh[o + 1] = 56; roh[o + 2] = 102; roh[o + 3] = 255; }
  const block = (art: string, d: Buffer) => { const l = Buffer.alloc(4); l.writeUInt32BE(d.length); const t = Buffer.from(art, "latin1"); const c = Buffer.alloc(4); c.writeUInt32BE(zl.crc32(Buffer.concat([t, d])) >>> 0); return Buffer.concat([l, t, d, c]); };
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(breite, 0); ihdr.writeUInt32BE(hoehe, 4); ihdr[8] = 8; ihdr[9] = 6;
  return Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), block("IHDR", ihdr), block("IDAT", zl.deflateSync(roh)), block("IEND", Buffer.alloc(0))]);
}
const pngUrl = (b: Buffer) => `data:image/png;base64,${b.toString("base64")}`;

titel("10. Runde 2 (Justin 08.10.2026): Garantie ab Annahme, Wachstumsbudget ab „Shop live“, Unterschrift, Leser, Team");
{
  const rumpf = S.htmlZuText(F.firmaRumpf({ ...D, compliance: null }));
  // ── Punkt 3: Garantiefrist ab Annahme, Empfängerin die US-Gesellschaft, Ruhen bei fehlender Mitwirkung ──
  // Runde 3: Fassung D folgt auf C — die Garantiefrist läuft weiter ab der Annahme.
  ok(S.FIRMA_FASSUNG === "IA-FIRMA-2026-10-08-D" && S.garantieAbAnnahme(S.FIRMA_FASSUNG) && S.garantieAbAnnahme("IA-FIRMA-2026-10-08-C") && !S.garantieAbAnnahme("IA-FIRMA-2026-10-07-B") && !S.garantieAbAnnahme("IA-2026-10-01-KG"), "Firmen-Fassung D (nach C); ab C zählt die Garantiefrist ab der Annahme");
  ok(G.vertragGarantie.includes("an die US-Gesellschaft der Auftraggeberin (Ziffer 1 Absatz 3) innerhalb von drei Monaten nach dem Tag, an dem die Auftraggeberin diesen Vertrag angenommen hat (Tag der Annahme), eine erste Finanzierungsrunde über 250.000 US-Dollar ausgezahlt wird") && G.vertragGarantie.includes("Empfängerin der Auszahlung ist allein die US-Gesellschaft"), "Ziffer 7 Absatz 1: Auszahlung binnen drei Monaten ab dem Tag der Annahme, Empfängerin die US-Gesellschaft", G.vertragGarantie);
  ok(G.vertragBeginn.startsWith("Die Frist der Garantie beginnt mit dem Tag der Annahme; sie hängt nicht davon ab, wann die Bedingungen der Bürgschaft") && !/Solange die Bedingungen nach Ziffer 8 Absatz 4 nicht erfüllt sind, beginnt die Frist nicht/.test(rumpf), "Ziffer 7 Absatz 3: Beginn mit der Annahme — nicht mehr mit den erfüllten Bedingungen");
  ok(G.vertragRuhen.includes("insbesondere die Unterlagen für die Bedingungen nach Ziffer 8 Absatz 4") && G.vertragRuhen.includes("mit einer Frist von mindestens sieben Tagen angefordert") && G.vertragRuhen.includes("Verzögerungen bei Instituten, Behörden, der Bürgin oder Partnern von FIAON lassen die Frist weiterlaufen"), "Ziffer 7 Absatz 4: Ruhen nur bei fehlender Mitwirkung (Unterlagen) nach Aufforderung mit mindestens sieben Tagen");
  ok(rumpf.includes(G.vertragGarantie) && rumpf.includes(G.vertragBeginn) && rumpf.includes(G.vertragRuhen) && G.vertragFolge.includes("erstattet FIAON der Auftraggeberin die gezahlte Vergütung für die Gründung (6.900,00 €)"), "Vertrag: Ziffer 7 aus firmaGarantie, Folge unverändert Erstattung der Gründung");
  ok(G.kapital[2].includes("Nachweis zur Testbedingung und Jahresabschlüsse der letzten zwei Jahre") && /ruht die Frist/.test(G.kapital[2]) && !/Testbedingung/.test(JSON.stringify(S.firmaGarantie(FIRMA_OHNE_INHALT()))), "Seite: die Unterlagen kommen aus den Angebotsdaten (kein Kundenbaustein im Code), fehlen sie, ruht die Frist");
  const phaseK = S.firmaSeite(D).phasen.liste.find((p) => p.abzeichen === "Kapital")!;
  ok(phaseK.nr === 3 && phaseK.dauer === "innerhalb von drei Monaten nach Annahme" && phaseK.text.startsWith("Ab Ihrer Annahme läuft die Frist nach Ziffer 7: Auszahlung"), "Zeitstrahl: „Erste Runde“ innerhalb von drei Monaten nach Annahme (vor dem Strategietag)", phaseK);
  // ── Punkt 8: gemeinsames Wachstumsbudget, Start am Tag „Shop live“ ──
  const b = S.firmaBudget(PARAMETER);
  ok(PARAMETER.monatCents === 200000 && PARAMETER.budgetGesamtCents === 400000 && PARAMETER.budgetStart === "shop-live" && PARAMETER.garantieAb === "annahme", "Vorgaben: Anteil 2.000 €, Budget 4.000 €, Start „Shop live“, Garantie ab Annahme");
  ok(b.zeilen.length === 8 && b.zeilen.reduce((a, z) => a + z.cents, 0) === 400000 && b.zeilen.map((z) => z.betrag).join(" · ") === "1.500 € · 600 € · 600 € · 400 € · 350 € · 250 € · 150 € · 150 €" && b.ihrAnteil === "2.000 €" && b.fiaonAnteil === "2.000 €", "Aufstellung: acht Posten, Summe 4.000 € (Planwerte), Hälfte Kundin / Hälfte FIAON", b.zeilen.map((z) => z.betrag));
  ok(rumpf.includes("bilden die Parteien ab dem Starttag ein gemeinsames Wachstumsbudget von 4.000,00 € im Monat. Die Auftraggeberin trägt davon die Hälfte, 2.000,00 € im Monat (Anteil der Auftraggeberin); FIAON trägt die andere Hälfte.") && rumpf.includes("Starttag ist der Tag, an dem der Online-Shop nach Ziffer 5 live ist") && rumpf.includes("erstmals am Starttag"), "Ziffer 10 Absatz 2: Budget, Hälfte, Starttag = Tag „Shop live“, erste Rechnung an diesem Tag");
  ok(rumpf.includes("Werbebudget Anzeigen (Google, Meta, Pinterest): 1.500,00 €") && rumpf.includes("Recht und Compliance laufend (Impressum, AGB, Datenschutz, Lebensmittel-Kennzeichnung): 150,00 €") && rumpf.includes("Planwerte je Monat, zusammen 4.000,00 €") && rumpf.includes("Personal von FIAON wird aus dem Wachstumsbudget nicht bezahlt."), "Ziffer 10 Absatz 3/4: dieselbe Aufstellung wie auf der Seite, Planwerte, kein Personal");
  ok(rumpf.includes(`Die Mindestlaufzeit beträgt vierundzwanzig Monate ab dem Starttag.`) && rumpf.includes("Das gemeinsame Wachstumsbudget und der Anteil der Auftraggeberin beginnen am Starttag (Ziffer 10 Absatz 2)") && !/Monatspauschale/.test(rumpf), "Ziffer 14: vierundzwanzig Monate ab dem Starttag („Shop live“); keine „Monatspauschale“ mehr im Vertrag");
  ok(!/Starttag ist der Tag, den die Auftraggeberin bei der Annahme wählt/.test(rumpf) && !/\bbis zu\b/i.test(texteAus(b).join(" ") + rumpf), "keine Startwahl bei der Annahme, kein „bis zu“");
  ok(/budgetGesamtCents muss genau das Doppelte/.test(S.firmaParameterFehler({ ...PARAMETER, monatCents: 199000 }) ?? "") && /budgetStart/.test(S.firmaParameterFehler({ ...PARAMETER, budgetStart: "annahme" as any }) ?? "") && /garantieAb/.test(S.firmaParameterFehler({ ...PARAMETER, garantieAb: "bedingungen" as any }) ?? "")
    && /Aufstellung ergibt/.test(S.firmaParameterFehler({ ...PARAMETER, inhalt: { ...INHALT, budgetPosten: [{ schluessel: "a", titel: "A", cents: 100000 }] } }) ?? "") && S.firmaParameterFehler(PARAMETER) === null, "firmaParameterFehler: Hälfte, Start „Shop live“, Garantie ab Annahme, Summe der Aufstellung");
  ok(S.firmaParameterAus({ monatCents: 200000, budgetGesamtCents: 400000, budgetStart: "shop-live", garantieAb: "annahme" }).budgetGesamtCents === 400000 && S.firmaParameterAus({}).budgetStart === "shop-live", "Parameter: Text-Werte und Vorgaben werden gelesen");
  ok(S.FIRMA_TEIL_TITEL.monat(1) === "Wachstumsbudget — Ihr Anteil, Monat 1", "Rechnungstitel „Wachstumsbudget — Ihr Anteil, Monat n“");
  const kn = F.firmaKnoepfe({ status: "angenommen", fr: {}, fristBeginn: "2026-10-08", fristEnde: "2027-01-08", garantieErfuelltAm: null, erstattungAusgeloest: false, gruendungBezahlt: false, heute: "2026-10-09", starttag: null });
  const kn2 = F.firmaKnoepfe({ status: "angenommen", fr: {}, fristBeginn: "2026-10-08", fristEnde: "2027-01-08", garantieErfuelltAm: null, erstattungAusgeloest: false, gruendungBezahlt: false, heute: "2026-10-09", starttag: "2026-11-02" });
  // Gegenprüfung 08.10.2026 (Fund 3): aus wichtigem Grund schon vor dem Starttag — nur die ORDENTLICHE Kündigung wartet auf „Shop live“.
  ok(kn.shopLive === null && /Shop live/.test(String(kn.umsatz)) && kn.kuendigung === null && /Shop live/.test(String(kn.kuendigungOrdentlich)) && /Schon eingetragen/.test(String(kn2.shopLive)) && kn2.umsatz === null && kn2.kuendigungOrdentlich === null && kn.kapital === null, "Knöpfe: „Shop live“ frei nach der Annahme, Umsatz und ordentliche Kündigung erst danach (aus wichtigem Grund schon vorher); erste Runde frei, weil die Frist ab Annahme läuft");
  const routenQ = fs.readFileSync("server/routes/fiaon-global-angebot.ts", "utf8");
  ok(/"shop-live": "firmaShopLive"/.test(routenQ) && /requireChef\(FIRMA_NUR_INHABER\.has\(pfad\) \? "inhaber" : "leitung"\)/.test(routenQ), "Route …/firma/shop-live (Leitung)");
  const chefQ = fs.readFileSync("client/src/components/admin/ChefGlobalAngebote.tsx", "utf8");
  ok(/pfad\("shop-live"\)/.test(chefQ) && /Shop live/.test(chefQ), "Chefbüro: Knopf „Shop live“");
  const shopQ = fs.readFileSync("server/lib/fiaon-global-angebot-firma.ts", "utf8");
  const shopTeil = shopQ.slice(shopQ.indexOf("export async function firmaShopLive"), shopQ.indexOf("export async function firmaKapitalErhalten"));
  ok(shopTeil.length > 100 && !/globalMailSenden|sendMakeWebhook|brevo/i.test(shopTeil) && /keine automatische Mail/.test(shopTeil), "„Shop live“ schickt keine Mail an die Kundin (nur Aufgabe an die zuständige Person)");
  // ── Punkt 11: Unterschrift Pflicht ──
  const leer = testPngRgba(400, 140, false); const voll = testPngRgba(400, 140, true);
  ok(F.firmaPngTintePruefen(leer) !== null && F.firmaPngTintePruefen(voll) === null && F.firmaPngTintePruefen(Buffer.from("kein png")) !== null, "Tinte: leeres Feld abgewiesen, Strich angenommen");
  const up = (x: unknown) => F.firmaUnterschriftPruefen(x, KUNDE);
  ok(!up(undefined).ok && !up({}).ok && !up({ art: "gezeichnet", png: pngUrl(leer) }).ok && !up({ art: "gezeichnet", png: "data:image/png;base64,AAAA" }).ok && !up({ art: "getippt", name: "Martina" }).ok && !up({ art: "getippt", name: "ab" }).ok, "Unterschrift fehlt, leer, kaputt oder ohne Nachnamen → abgewiesen");
  const ug = up({ art: "gezeichnet", png: pngUrl(voll) }); const ut = up({ art: "getippt", name: "  Martina   Muster " });
  ok(ug.ok && ug.vermerk.art === "gezeichnet" && !!ug.vermerk.png && ut.ok && ut.vermerk.name === "Martina Muster" && ut.vermerk.png === null && (up({ art: "getippt", name: "Martina Meier" }) as any).ok === false && (up({ art: "getippt", name: "M. MÜSTER" }) as any).ok === true && (up({ art: "getippt", name: "martina muster" }) as any).ok === true, "gezeichnet (mit Bild) oder getippt (Name mit Nachnamen) angenommen");
  const pdfHtml = F.firmaRumpf(D, { am: new Date("2026-10-08T10:00:00Z"), ip: "203.0.113.7", userAgent: "Mozilla/5.0", hash: "x", unterschrift: { art: "gezeichnet", png: pngUrl(voll) } });
  ok(pdfHtml.includes(`<img class="gv-unterschrift-bild" src="${pngUrl(voll)}"`) && pdfHtml.includes("Unterschrift (von Hand gezeichnet)") && pdfHtml.includes("Unterschrift: von Hand gezeichnet, gespeichert mit Zeit und IP-Adresse"), "Annahmevermerk zeigt die gezeichnete Unterschrift (Bild)");
  const boes = F.firmaRumpf(D, { am: new Date(), ip: "x", userAgent: "x", hash: "x", unterschrift: { art: "getippt", name: "<script>x</script> Muster", png: "javascript:alert(1)" } });
  ok(!boes.includes("<script>") && !boes.includes("javascript:") && boes.includes("gv-unterschrift-getippt"), "Annahmevermerk: getippter Name escaped, nur echte PNG-Daten im Bild");
  const annQ = shopQ.slice(shopQ.indexOf("export async function firmaAnnehmen"), shopQ.indexOf("/** Bestellzeile anlegen"));
  ok(annQ.indexOf("firmaUnterschriftPruefen(") > 0 && annQ.indexOf("firmaUnterschriftPruefen(") < annQ.indexOf("firmaVertragPdf(") && /fehler\(400, u\.error/.test(annQ) && /frist_beginn = \$\{abAnnahme \? annahmeTag : null\}::date/.test(annQ), "Server: Unterschrift VOR PDF und Speicherung geprüft (sonst 400); Garantiefrist ab dem Tag der Annahme gesetzt");
  const anQ = fs.readFileSync("client/src/components/angebot-firma/AnnahmeFirma.tsx", "utf8");
  ok(/UnterschriftFeld/.test(anQ) && !/startAm|startTitel/.test(anQ), "Seite: Unterschriftsfeld in der Annahme, keine Startwahl mehr");
  // ── Punkt 10: Leser mit Annahme-Knopf am Ende ──
  const leserQ = fs.readFileSync("client/src/components/angebot-firma/VertragsLeser.tsx", "utf8");
  const seiteQ10 = fs.readFileSync("client/src/pages/business-angebot-firma.tsx", "utf8");
  ok(/data-fiaon="firma-leser-annehmen"/.test(leserQ) && /annehmen\.knopf/.test(leserQ) && /annehmen=\{\{ knopf: sicht\.annahme\.knopf, onAnnehmen: zurAnnahme \}\}/.test(seiteQ10), "Leser: Abschluss-Block mit dem Knopf aus annahme.knopf — schließt und springt zur Annahme");
  // ── Punkt 4/5: keine Fotos im Zeitstrahl und auf den Karten ──
  const ztQ = fs.readFileSync("client/src/components/angebot-firma/PhasenZeitstrahl.tsx", "utf8"); const lkQ = fs.readFileSync("client/src/components/angebot-firma/LeistungsKarten.tsx", "utf8");
  ok(!/<Bild\b/.test(ztQ) && /AufbauAnimation/.test(ztQ) && !/<Bild\b/.test(lkQ) && /LeistungsIllustration/.test(lkQ), "Zeitstrahl ohne Fotos (Aufbau-Animation), Karten mit eigenen Linien-Illustrationen");
}

titel("11. Runde 3 (Justin 08.10.2026, Endfassung): Kapital vorne, Gründungskosten leise, kompakter, Auszahlung garantiert, spätester Start, Team bestätigt");
{
  const seite = S.firmaSeite(D); const rumpf = S.htmlZuText(F.firmaRumpf({ ...D, compliance: null }));
  const satzZahl = (t: string) => (t.replace(/\b(?:z|d|u|o)\.\s?[a-zä]\./gi, "").match(/[.!?](?=\s+[A-ZÄÖÜ„]|$)/g) ?? []).length;
  // ── Punkt 1: Kapital zuerst ──
  ok(seite.hero.kapital.betrag === "250.000 USD" && seite.hero.kapital.satz === G.satz && seite.hero.nutzen.length <= 3 && !seite.hero.nutzen.includes(G.satz), "Hero: große Zahl 250.000 USD mit Justins Satz (eine Quelle), höchstens drei Nutzen ohne Wiederholung");
  const seiteQ = fs.readFileSync("client/src/pages/business-angebot-firma.tsx", "utf8");
  const iKap = seiteQ.indexOf('id="kapital"'), iZiele = seiteQ.indexOf('id="ziele"'), iWeg = seiteQ.indexOf('id="weg"'), iLst = seiteQ.indexOf('id="leistungen"'), iInv = seiteQ.indexOf('id="investition"');
  const iPb = seiteQ.indexOf("<ComplianceBuehne"), iFr = seiteQ.indexOf('id="fragen"'), iAp = seiteQ.indexOf('id="ansprechpartner"'), iVt = seiteQ.indexOf('id="vertrag"'), iAn = seiteQ.indexOf('id="annahme"');
  ok([iKap, iZiele, iWeg, iLst, iInv, iPb, iFr, iAp, iVt, iAn].every((x, i, a) => x > 0 && (i === 0 || x > a[i - 1])), "Lesefluss: Hero → Kapital → Ziele → Weg → Leistungen → Vereinbarung → Prüfbericht → Fragen → Team → Vertrag → Annahme", [iKap, iZiele, iWeg, iLst, iInv, iPb, iFr, iAp, iVt, iAn]);
  ok(/S\.hero\.kapital\.betrag/.test(seiteQ) && /S\.hero\.kapital\.satz/.test(seiteQ) && !/garantier/i.test(seiteQ.replace(/\/\/.*$/gm, "").replace(/\{\/\*[\s\S]*?\*\/\}/g, "")), "Seite: Zahl und Satz aus den Daten — kein eigener „garant…“-Satz in der Oberfläche");
  const bek = seite.investition.bekommen;
  ok(bek.titel === "Was Sie bekommen" && bek.punkte[0].wert === "250.000 USD" && bek.punkte.length === 3 && seite.investition.konditionenTitel === "Die Konditionen", "Vereinbarung: zuerst „Was Sie bekommen“ (250.000 USD, Gesellschaft, Team), dann die Konditionen");
  // ── Punkt 2: Gründungskosten leise ──
  const gp = seite.investition.posten.find((x) => x.schluessel === "gruendung")!;
  ok(gp.satz === "Einmalige Gründungskosten 6.900 € — wir verdienen daran nichts; sie decken Gründung und Start.", "Gründungskosten: Justins ruhige Zeile", gp.satz);
  const kopfKapital = [...texteAus(seite.hero), ...texteAus(seite.kapital)].join(" ");
  ok(!/6\.900/.test(kopfKapital), "Hero und Kapital nennen die Gründungskosten nicht mit Betrag", kopfKapital.match(/.{0,40}6\.900.{0,40}/g));
  const ue = S.firmaBestellUebersicht(D).zeilen.find((z) => z.label === "Gründungskosten");
  ok(ue?.wert === "6.900,00 € einmalig — fällig mit der Annahme" && rumpf.includes("zahlt die Auftraggeberin einmalig 6.900,00 €. Der Betrag ist mit Vertragsschluss fällig"), "Pflichtangaben bleiben: Preis und Fälligkeit in der Übersicht und im Vertrag");
  const ipQ = fs.readFileSync("client/src/components/angebot-firma/InvestitionsPosten.tsx", "utf8");
  ok(!/gaf-gruendung-klar/.test(ipQ) && /gaf-gruendung-zeile/.test(ipQ) && /<Mehr /.test(ipQ), "Oberfläche: keine große Gründungskarte mehr — eine Zeile, Bestandteile im Aufklapper");
  // ── Punkt 3: kompakter ──
  ok(seite.leistungen.karten.every((k) => k.punkte.length <= 3 && satzZahl(k.text) <= 1), "Leistungskarten: ein Satz und höchstens drei Punkte sichtbar (Rest unter „Mehr erfahren“)", seite.leistungen.karten.map((k) => [k.schluessel, k.punkte.length, satzZahl(k.text)]));
  ok(seite.investition.posten.every((x) => typeof x.satz === "string" && x.satz.length > 20 && satzZahl(x.satz) <= 1), "Vereinbarung: jede Zeile mit genau einem Satz");
  ok(seite.phasen.liste.every((ph) => satzZahl(ph.text) <= 1), "Zeitstrahl: je Etappe ein Satz", seite.phasen.liste.map((ph) => [ph.nr, satzZahl(ph.text)]));
  ok(seite.ziele.punkte.length <= 3, "Ziele: höchstens drei Karten");
  ok(seite.fragen.sichtbar === 8 && seite.fragen.liste.length >= 14 && seite.fragen.liste.slice(0, 8).every((f) => f.antwort.length === 1 && satzZahl(f.antwort[0]) <= 2), "Fragen: acht sichtbar mit kurzer Antwort (höchstens zwei Sätze), der Rest unter „Weitere Fragen“", seite.fragen.liste.slice(0, 8).map((f) => [f.frage.slice(0, 20), f.antwort.length, satzZahl(f.antwort.join(" "))]));
  const faQ = fs.readFileSync("client/src/components/angebot-firma/FragenAntworten.tsx", "utf8"); const cbQ = fs.readFileSync("client/src/components/angebot-firma/ComplianceBuehne.tsx", "utf8");
  ok(/Weitere Fragen/.test(faQ) && /sichtbar=\{S\.fragen\.sichtbar\}/.test(seiteQ) && /<Mehr id="gaf-buehne-mehr"/.test(cbQ) && /gesamt\.text\.slice\(0, 1\)/.test(cbQ), "Oberfläche: „Weitere Fragen“, Prüfbericht mit Gesamturteil und Kacheln, Details und Methodik eingeklappt");
  const gmQ = fs.readFileSync("client/src/components/angebot-firma/gemeinsam.tsx", "utf8");
  ok(/inert: ""/.test(gmQ) && /aria-expanded=\{auf\}/.test(gmQ), "Aufklapper: aria-expanded, zugeklappt inert (nicht per Tastatur erreichbar)");
  // ── Punkt 4: Ziffer 7 — garantiert ist die Auszahlung ──
  ok(rumpf.includes(G.vertragGarantie) && rumpf.includes(G.vertragErhalten) && G.vertragFolge.startsWith("Wird die erste Runde nicht innerhalb der Frist an die US-Gesellschaft ausgezahlt, erstattet FIAON") && !/verbindlich zugesagt/.test(rumpf) && rumpf.includes(G.vertragRuhen), "Ziffer 7: Auszahlung garantiert (Absatz 1/2/5), Ruhen und Folge bleiben, keine „verbindliche Zusage“ mehr");
  ok(S.garantieNurAuszahlung(S.FIRMA_FASSUNG) && !S.garantieNurAuszahlung("IA-FIRMA-2026-10-08-C") && !S.garantieNurAuszahlung("IA-2026-10-01-KG"), "Fassung D: nur die Auszahlung zählt; ältere Fassungen behalten ihre Regel");
  const srvQ = fs.readFileSync("server/lib/fiaon-global-angebot-firma.ts", "utf8");
  const kapTeil = srvQ.slice(srvQ.indexOf("export async function firmaKapitalErhalten"), srvQ.indexOf("export async function firmaFristHemmen"));
  ok(/garantieNurAuszahlung\(l\.d\.fassung\)/.test(kapTeil) && /\["ausgezahlt", "abgelehnt"\]/.test(kapTeil), "Server: „erste Runde erhalten“ nimmt ab Fassung D keine Zusage an");
  const chefQ = fs.readFileSync("client/src/components/admin/ChefGlobalAngebote.tsx", "utf8");
  ok(/!a\.garantieNurAuszahlung && <option value="zugesagt">/.test(chefQ), "Chefbüro: Auswahl „verbindlich zugesagt“ nur bei älteren Fassungen");
  // ── Punkt 5: spätester Start des Wachstumsbudgets ──
  ok(PARAMETER.budgetSpaetestensMonate === 6 && S.budgetSpaetesterStart("2026-10-08", PARAMETER) === "2027-04-08" && S.budgetSpaetesterStart("2026-08-31", PARAMETER) === "2027-02-28", "spätester Starttag: Annahme + sechs Monate, monatsende-sicher");
  ok(rumpf.includes("Ist der Online-Shop sechs Monate nach dem Tag der Annahme (Ziffer 7 Absatz 1) nicht live, ist Starttag dieser Tag (spätester Starttag), es sei denn, die Verzögerung beruht auf Umständen, die FIAON zu vertreten hat; dann bleibt es beim Tag, an dem der Online-Shop live ist."), "Ziffer 10 Absatz 2: spätester Starttag sechs Monate nach der Annahme, außer die Verzögerung liegt bei FIAON");
  const mp = S.firmaInvestPosten(D).find((x) => x.schluessel === "monat")!;
  ok(/spätestens sechs Monate nach Ihrer Annahme, es sei denn, die Verzögerung liegt bei uns/.test(mp.satz) && /spätestens sechs Monate nach Ihrer Annahme/.test(seite.investition.budget.start), "Seite: der späteste Start in einem Satz (Zeile und Aufstellung)", mp.satz);
  ok(/budgetSpaetestensMonate/.test(S.firmaParameterFehler({ ...PARAMETER, budgetSpaetestensMonate: 0 }) ?? "") && /budgetSpaetestensMonate/.test(S.firmaParameterFehler({ ...PARAMETER, budgetSpaetestensMonate: 30 }) ?? "") && S.firmaParameterAus({}).budgetSpaetestensMonate === 6, "Parameter: budgetSpaetestensMonate eins bis vierundzwanzig, Vorgabe sechs");
  const shopTeil = srvQ.slice(srvQ.indexOf("export async function firmaShopLive"), srvQ.indexOf("export async function firmaKapitalErhalten"));
  ok(/art \?\? ""\) === "spaetestens"/.test(shopTeil) && /verzoegerungFiaon !== true/.test(shopTeil) && /budgetSpaetesterStart\(angenommen/.test(shopTeil), "Server: „Spätester Starttag“ erst ab dem Tag, späteres „Shop live“ nur mit Bestätigung der Verzögerung bei FIAON");
  ok(/value="spaetestens"/.test(chefQ) && /verzoegerungFiaon/.test(chefQ), "Chefbüro: Auswahl „Spätester Starttag“ und Haken „Verzögerung bei FIAON“");
  // ── Punkt 6: Team nur bestätigt ──
  const teamPar = { ...PARAMETER, inhalt: { ...INHALT, team: [{ name: "Erika Beispiel", rolle: "Prüfrolle A", bestaetigt: true }, { name: "Max Probe", rolle: "Prüfrolle B", bestaetigt: false }, { name: "Dr. Test Muster", rolle: "Prüfrolle C" }] } };
  const tm = S.firmaTeam(teamPar);
  ok(tm.personen.map((x) => x.name).join(" | ") === "Erika Beispiel | Dr. Test Muster", "Team: bestaetigt = false ausgeblendet, fehlendes Feld gilt als bestätigt", tm.personen.map((x) => x.name));
  ok(S.firmaParameterFehler(teamPar) === null && /bestaetigt/.test(S.firmaParameterFehler({ ...PARAMETER, inhalt: { ...INHALT, team: [{ name: "Erika Beispiel", rolle: "A", bestaetigt: "ja" as any }] } }) ?? ""), "Team: bestaetigt nur true oder false");
  ok(S.firmaTeamFotoOk("haus:florentine") && S.firmaTeamFotoOk("haus:daniel") && !S.firmaTeamFotoOk("haus:justin"), "Hausporträts: echte Fotos erlaubt, das KI-Porträt nicht");
  // Justin 08.10.2026 abends: KI-Symbolbilder fürs Team — nur als Bildname am Angebot, auf der Seite gekennzeichnet (KI-VO Art. 50).
  const kiPar = { ...PARAMETER, inhalt: { ...INHALT, team: [{ name: "Erika Beispiel", rolle: "Prüfrolle A", foto: "team-erika.webp", ki: true }, { name: "Max Probe", rolle: "Prüfrolle B", foto: "haus:florentine" }] } };
  const kiTm = S.firmaTeam({ ...kiPar, inhalt: S.firmaInhaltMitBildLinks(kiPar.inhalt, "FIAON-IA-PRUEF.1.abc") });
  ok(S.firmaParameterFehler(kiPar) === null && kiTm.personen[0].ki === true && !!kiTm.personen[0].foto && kiTm.personen[1].ki === false, "Team: KI-Symbolbild erlaubt und markiert, Hausporträt nicht", kiTm.personen);
  ok(/Team/.test(S.firmaParameterFehler({ ...PARAMETER, inhalt: { ...INHALT, team: [{ name: "Erika Beispiel", rolle: "A", foto: "haus:florentine", ki: true }] } }) ?? "") && /Team/.test(S.firmaParameterFehler({ ...PARAMETER, inhalt: { ...INHALT, team: [{ name: "Erika Beispiel", rolle: "A", foto: "team-erika.webp", ki: "ja" as any }] } }) ?? ""), "Team: ki nur true/false und nie an einem Hausporträt");
  ok(!/gaf-team-ki|KI-Symbolbild/.test(fs.readFileSync("client/src/pages/business-angebot-firma.tsx", "utf8")) && S.firmaBildnachweis(kiPar).includes("Teamfotos teils Symbolbilder") && !S.firmaBildnachweis(PARAMETER).includes("Symbolbild"), "Team: kein Hinweis unter den Fotos (Justin 08.10. abends), leise im Bildnachweis");
  ok(/Porträt mit KI erstellt/.test(S.firmaBildnachweis(PARAMETER)) && !/Porträt mit KI erstellt/.test(texteAus(S.firmaTeam(PARAMETER)).join(" ")), "KI-Hinweis zu Porträts einmal im Bildnachweis, nicht im Team");
  // ── Punkt 7: Fassung und Anlage 1 ──
  ok(S.FIRMA_FASSUNGEN.includes("IA-FIRMA-2026-10-08-C" as any) && S.FIRMA_FASSUNGEN[S.FIRMA_FASSUNGEN.length - 1] === "IA-FIRMA-2026-10-08-D" && S.ANLAGE1_FIRMA_FASSUNG === "IA-FIRMA-ANLAGE1-2026-10-08-D", "Fassungen: D aktuell, C bleibt lesbar; Anlage 1 unverändert (Fassung D der Anlage)");
}

titel("13. Annahme meldet sich per Mail an Justin (08.10.2026, Hildbrand)");
{
  const ia = fs.readFileSync("server/lib/fiaon-global-angebot.ts", "utf8"); const fa = fs.readFileSync("server/lib/fiaon-global-angebot-firma.ts", "utf8");
  const au = fs.readFileSync("server/lib/fiaon-global-angebot-aufrufe.ts", "utf8");
  ok(/export async function annahmeMelden/.test(au) && /an: AUFRUF_MELDUNG_AN/.test(au.slice(au.indexOf("export async function annahmeMelden"))), "annahmeMelden schickt an js@fiaon.com (AUFRUF_MELDUNG_AN)");
  ok(/A\.annahmeMelden\(\{ ref: d\.ref, name, art: "Individualangebot"/.test(ia) && /A\.annahmeMelden\(\{ ref: d\.ref, name, art: "Firmenangebot"/.test(fa), "Individual- und Firmenangebot melden die Annahme sofort per Mail");
}

titel("12. Gegenprüfung 08.10.2026: Starttag mit spätestem Start in jedem Satz, Stundenlauf ohne Starttag, Kündigung vor dem Starttag");
{
  // ── Fund 1: Jeder Satz der Seite, der „live“ sagt, nennt auch den spätesten Start (Ziffer 10 Absatz 2) ──
  const saetze = (t: string) => t.split(/(?<=[.!?])\s+(?=[A-ZÄÖÜ„])/);
  const liveOhneSpaetestens = (texte: string[]) => texte.flatMap(saetze).filter((x) => /\blive\b/i.test(x) && !/spätestens/.test(x));
  ok(liveOhneSpaetestens(["Mindestlaufzeit vierundzwanzig Monate ab dem Tag „Shop live“, danach jeweils zwölf Monate mehr."]).length === 1
    && liveOhneSpaetestens(["Mindestlaufzeit vierundzwanzig Monate ab dem Starttag („Shop live“, spätestens sechs Monate nach Ihrer Annahme)."]).length === 0,
    "Prüfung selbst: „ab dem Tag „Shop live““ ohne „spätestens“ im selben Satz wird rot, mit „spätestens“ grün");
  const seite = S.firmaSeite(D); const ueb = S.firmaBestellUebersicht(D); const ann = S.firmaAnnahmeTexte(D);
  const fertigD = S.FIRMA_ANNAHME.fertigText("pruef@musterfirma-beispiel.example", S.monateWort(PARAMETER.budgetSpaetestensMonate));
  const kundenTexte = [...texteAus(seite), ...texteAus(ueb), ...texteAus(ann), fertigD, F.firmaTeil2Bedingung(D)];
  const rot = liveOhneSpaetestens(kundenTexte);
  ok(rot.length === 0, "Seite, Übersicht, Annahme, Bestätigung und „Mein Auftrag“: kein Satz mit „live“ ohne „spätestens“", rot.map((x) => x.slice(0, 140)));
  const SP = "(„Shop live“, spätestens sechs Monate nach Ihrer Annahme)";
  const mp = S.firmaInvestPosten(D).find((x) => x.schluessel === "monat")!;
  const frageLauf = seite.fragen.liste.find((f) => f.frage.startsWith("Wie lange läuft der Vertrag"))!;
  const frageUs = seite.fragen.liste.find((f) => f.frage === "Gehört die US-Gesellschaft mir?")!;
  const aufbau = seite.phasen.liste.find((ph) => ph.nr === 2)!;
  ok(mp.wie.startsWith(`Mindestlaufzeit vierundzwanzig Monate ab dem Starttag ${SP}, danach`), "Vereinbarung, Wachstumsbudget „Wie“: Mindestlaufzeit ab dem Starttag mit spätestem Start", mp.wie);
  ok(frageLauf.antwort[0].startsWith(`Mindestens vierundzwanzig Monate ab dem Starttag ${SP}, danach`), "Frage „Wie lange läuft der Vertrag“: ab dem Starttag mit spätestem Start", frageLauf.antwort[0]);
  ok(frageUs.antwort.some((a) => a.includes(`was vor dem Starttag ${SP} entsteht, mit dem ersten Anteil`)), "Frage „Gehört die US-Gesellschaft mir?“: Rechte „vor dem Starttag“ (wie Ziffer 5)", frageUs.antwort);
  ok(aufbau.text.includes(`ab dem Starttag ${SP} beginnt unser gemeinsames Wachstumsbudget`) && saetze(aufbau.text).length === 1, "Zeitstrahl „Aufbau“: Wachstumsbudget ab dem Starttag mit spätestem Start, ein Satz", aufbau.text);
  ok(ueb.zeilen.find((z) => z.label === "Laufzeit")?.wert.startsWith("Beginn mit der Annahme; mindestens vierundzwanzig Monate ab dem Starttag („Shop live“, spätestens sechs Monate nach Annahme), danach"), "Übersicht „Laufzeit“: ab dem Starttag mit spätestem Start", ueb.zeilen.find((z) => z.label === "Laufzeit")?.wert);
  ok(ann.unterKnopf.includes("Ihr Anteil am Wachstumsbudget erst ab dem Starttag („Shop live“, spätestens sechs Monate nach Annahme)."), "Satz unter dem Knopf: Anteil erst ab dem Starttag mit spätestem Start", ann.unterKnopf);
  ok(fertigD.includes("beginnt erst, wenn Ihr Shop live ist, spätestens sechs Monate nach Ihrer Annahme.") && /FIRMA_ANNAHME\.fertigText\(d\.kunde\.email, budgetSpaetestensGilt\(d\.fassung\) \? monateWort\(d\.parameter\.budgetSpaetestensMonate\) : null\)/.test(fs.readFileSync("server/lib/fiaon-global-angebot-firma.ts", "utf8")), "Bestätigung nach der Annahme: mit spätestem Start (Fassung D) — der Server reicht ihn nur bei Fassung D herein", fertigD);
  ok(F.firmaTeil2Bedingung(D) === "Wachstumsbudget: Ihr Anteil 2.000,00 € pro Monat im Voraus ab dem Starttag („Shop live“, spätestens sechs Monate nach Annahme)", "„Mein Auftrag“ (Fassung D): ab dem Starttag mit spätestem Start", F.firmaTeil2Bedingung(D));
  // Ältere Fassungen behalten ihren Satz (ohne spätesten Start gibt es ihn dort nicht).
  ok(F.firmaTeil2Bedingung({ ...D, fassung: "IA-FIRMA-2026-10-08-C" }) === "Wachstumsbudget: Ihr Anteil 2.000,00 € pro Monat im Voraus ab dem Tag „Shop live“"
    && S.FIRMA_ANNAHME.fertigText("x@y.example") === "Ihr Vertrag gilt ab heute. Mit der Gründung Ihrer US-Gesellschaft legen wir los, sobald die Gründungskosten eingegangen sind; Ihr Anteil am Wachstumsbudget beginnt erst, wenn Ihr Shop live ist. Vertrag und Rechnung finden Sie hier; Ihr Ansprechpartner schickt beides zusätzlich an x@y.example.",
    "Fassung C: „Mein Auftrag“ und Bestätigung unverändert");
  ok(F.firmaTextHash(D) === PRUEFSUMME_FIRMA_D && F.firmaAnlage1Pruefsumme(D) === PRUEFSUMME_ANLAGE1_D, "Vertrag und Anlage 1 unverändert: die Seitentexte stehen nicht in der Prüfsumme (Fassung D bleibt freigegeben)");
  // ── Fund 2: Der Stundenlauf überspringt ohne Starttag nur Verlängerung und Monatsrechnungen ──
  const srvQ = fs.readFileSync("server/lib/fiaon-global-angebot-firma.ts", "utf8");
  const laufTeil = srvQ.slice(srvQ.indexOf("export async function firmaStundenlauf"), srvQ.indexOf("// LEITUNG (requireChef"));
  const iStart = laufTeil.indexOf("if (sch.starttag) {"); const iHaengt = laufTeil.indexOf("// ── Hängende Teile nachholen"); const iFrist = laufTeil.indexOf("// ── Fristende der Garantie");
  ok(laufTeil.length > 500 && !/if \(!sch\.starttag\) continue;/.test(laufTeil) && iStart > 0 && iStart < laufTeil.indexOf("Verlängerung: Kündigungsfrist") && iHaengt > laufTeil.indexOf("Fällige Monatsteile") && iFrist > iHaengt,
    "Stundenlauf: ohne Starttag kein „continue“ mehr — nur Verlängerung und Monatsrechnungen hängen am Starttag; Fristende und hängende Teile laufen immer");
  ok(/schluessel: `global:\$\{d\.ref\}:spaetester-starttag`/.test(laufTeil) && /COALESCE\(schalter->>'spaetesterStartErinnertAm', ''\) = ''/.test(laufTeil) && /!sch\.starttag && !fr\.kuendigung && budgetSpaetestensGilt\(d\.fassung\)/.test(laufTeil),
    "Stundenlauf: Aufgabe „Spätester Starttag erreicht“ (Fassung D, kein Starttag, keine Kündigung) — einmal, Marke atomar im Schalter");
  // ── Fund 3: Kündigung aus wichtigem Grund vor dem Starttag; danach kein „Shop live“, und die Garantie entfällt ──
  const basis = { status: "angenommen", fristBeginn: "2026-10-08", fristEnde: "2027-01-08", garantieErfuelltAm: null, erstattungAusgeloest: false, gruendungBezahlt: true, starttag: null } as const;
  const kw: NonNullable<import("../shared/fiaon-global-angebot-firma").FirmaFreigaben["kuendigung"]> = { am: "2026-10-20", zum: "2026-10-20", von: "Prüfstand", seite: "auftraggeberin", art: "ausserordentlich", garantieEntfaellt: true };
  const k0 = F.firmaKnoepfe({ ...basis, fr: {}, heute: "2026-10-09" });
  ok(k0.kuendigung === null && /Starttag/.test(String(k0.kuendigungOrdentlich)) && k0.shopLive === null, "vor „Shop live“: Kündigung aus wichtigem Grund frei, ordentliche erst ab dem Starttag", k0);
  const k1 = F.firmaKnoepfe({ ...basis, fr: { kuendigung: kw }, heute: "2027-01-09" });
  ok(/entfallen/.test(String(k1.garantiefall)) && /gekündigt/.test(String(k1.shopLive)) && /Schon eingetragen/.test(String(k1.kuendigung)) && /Schon eingetragen/.test(String(k1.kuendigungOrdentlich)),
    "nach der Kündigung aus wichtigem Grund vor dem Fristende: Garantiefall gesperrt (Ziffer 14 Absatz 3), „Shop live“ gesperrt", k1);
  ok(F.firmaKnoepfe({ ...basis, fr: {}, heute: "2027-01-09" }).garantiefall === null && F.firmaKnoepfe({ ...basis, fr: { kuendigung: { ...kw, garantieEntfaellt: false } }, heute: "2027-01-09" }).garantiefall === null,
    "Gegenprobe: ohne Kündigung — oder wenn FIAON den Grund gab — bleibt der Garantiefall nach dem Fristende frei");
  const kuendTeil = srvQ.slice(srvQ.indexOf("export async function firmaKuendigung"), srvQ.indexOf("// RECHNUNGSZEILE"));
  const shopTeil = srvQ.slice(srvQ.indexOf("export async function firmaShopLive"), srvQ.indexOf("export async function firmaKapitalErhalten"));
  ok(/if \(art === "ordentlich" && kn\.kuendigungOrdentlich\) return nein\(kn\.kuendigungOrdentlich, 409\)/.test(kuendTeil) && /if \(starttag\) await monatsteileBis/.test(kuendTeil) && !/l\.sch\.starttag!/.test(kuendTeil),
    "Server: ordentliche Kündigung an den Starttag gebunden, aus wichtigem Grund ohne Starttag (keine Monatsteile)");
  ok(/COALESCE\(freigaben->'kuendigung', 'null'::jsonb\) = 'null'::jsonb/.test(shopTeil), "Server: „Shop live“ setzt den Starttag nur ohne Kündigung (atomar in der Abfrage)");
  const chefQ = fs.readFileSync("client/src/components/admin/ChefGlobalAngebote.tsx", "utf8");
  ok(/!a\.freigaben\.kuendigung && !k\.kuendigungOrdentlich && <option value="ordentlich">/.test(chefQ) && /a\.freigaben\.kuendigung \|\| k\.kuendigungOrdentlich \? "ausserordentlich" : "ordentlich"/.test(chefQ),
    "Chefbüro: vor „Shop live“ bietet die Kündigung nur „aus wichtigem Grund“ an");
  // Das alte Individualangebot (E-268) ist nicht berührt: eigener Server-Teil, eigene Knöpfe.
  ok(!/kuendigungOrdentlich|spaetester-starttag/.test(fs.readFileSync("server/lib/fiaon-global-angebot.ts", "utf8")), "Individualangebot (E-268): keine der Änderungen");
}

// ═══ TEIL 2 ════════════════════════════════════════════════════════════════
if (LOKAL) {
  const BASIS = String(process.env.PRUEF_BASIS || "http://127.0.0.1:5298");
  process.env.PORT = process.env.PORT || new URL(BASIS).port;
  const { sqlPool } = await import("../server/lib/db-pool");
  const A = await import("../server/lib/fiaon-global-angebot");
  const { berlinToday } = await import("../server/lib/fiaon-time");
  const { istGlobalKunde } = await import("../server/lib/fiaon-global-kunde");
  const { b2bUstModus } = await import("../server/fiaon-invoice");
  const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.6 Safari/605.1.15";
  const IP = `84.115.${10 + Math.floor(Math.random() * 200)}.${10 + Math.floor(Math.random() * 200)}`;
  const heute = berlinToday();
  const lauf = Date.now().toString(36);
  // Chef-Ausweis wie der Server ihn ausstellt (server/routes/fiaon-chef-zugang.ts: agentId.stufe.exp.signatur, HMAC über
  // SESSION_SECRET — Prüfstand und Server laufen mit demselben Wert bzw. beide ohne). Nur für die Prüfstand-Kopie.
  const { createHmac } = await import("node:crypto");
  const chefAusweis = (stufe: "leitung" | "geschaeftsfuehrung" | "inhaber") => {
    const agentId = 999_001; const exp = Date.now() + 3_600_000;
    const sig = createHmac("sha256", process.env.SESSION_SECRET || "fiaon-dev-admin-zugang-secret").update(`chefzugang:${agentId}:${stufe}:${exp}`).digest("hex").slice(0, 40);
    return `fiaon_chef=${agentId}.${stufe}.${exp}.${sig}`;
  };

  titel("A. Anlegen über das Import-Skript (Musterfirma, keine Kundendaten)");
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "pruef-firma-"));
  const email = `pruef+${lauf}@musterfirma-beispiel.example`;
  // Bilder: erfundene WebP MIT Metadaten in einem Ordner außerhalb des Repos — das Skript bereinigt sie und bindet sie ans Angebot.
  const bilderOrdner = path.join(tmp, "bilder"); fs.mkdirSync(bilderOrdner);
  fs.writeFileSync(path.join(bilderOrdner, "szene-a.webp"), testWebp(true, 1));
  fs.writeFileSync(path.join(bilderOrdner, "szene-a-gross.webp"), testWebp(true, 2));
  fs.writeFileSync(path.join(bilderOrdner, "etikett-t.webp"), testWebp(true, 3));
  fs.writeFileSync(path.join(bilderOrdner, "foto-t.webp"), testWebp(false, 4));
  fs.writeFileSync(path.join(bilderOrdner, "Notiz.txt"), "kein Bild");
  const GLAS_TEST = { etikett: "etikett-t.webp", etikettVerhaeltnis: 1.3, deckel: "silber", inhalt: "#333333", name: "Testglas", foto: { src: "foto-t.webp", breite: 10, hoehe: 10, alt: "Testfoto", ki: false } };
  const PARAMETER_LOKAL = { ...PARAMETER, inhalt: { ...INHALT, glas: GLAS_TEST } };
  fs.writeFileSync(path.join(tmp, "angebot.json"), JSON.stringify({ fassung: S.FIRMA_FASSUNG, kunde: { ...KUNDE, email }, buergin: { ...SA.BUERGIN_VORGABE }, parameter: PARAMETER_LOKAL }));
  fs.writeFileSync(path.join(tmp, "compliance.json"), JSON.stringify(COMPLIANCE_ROH));
  // Fehlt ein Bild, auf das die Daten zeigen, legt --schreiben NICHTS an.
  const leer = path.join(tmp, "leer"); fs.mkdirSync(leer);
  let abbruch = ""; try { execFileSync("npx", ["tsx", "scripts/angebot-firma-anlegen.ts", "--datei", path.join(tmp, "angebot.json"), "--bilder", leer, "--vorschau", path.join(tmp, "v0.html"), "--schreiben"], { encoding: "utf8", env: process.env, stdio: "pipe" }); } catch (e: any) { abbruch = String(e?.stderr ?? "") + String(e?.stdout ?? ""); }
  ok(/ABBRUCH: Diese Bilder fehlen im Ordner/.test(abbruch), "Import: fehlt ein Bild im Ordner, bricht --schreiben ab", abbruch.slice(-200));
  const ausgabe = execFileSync("npx", ["tsx", "scripts/angebot-firma-anlegen.ts", "--datei", path.join(tmp, "angebot.json"), "--compliance", path.join(tmp, "compliance.json"), "--bilder", bilderOrdner, "--vorschau", path.join(tmp, "vorschau.html"), "--schreiben"], { encoding: "utf8", env: process.env });
  const id = Number(ausgabe.match(/^ID=(\d+)/m)?.[1]); const token = String(ausgabe.match(/^TOKEN=(\S+)/m)?.[1] ?? ""); const ref = String(ausgabe.match(/^REF=(\S+)/m)?.[1] ?? "");
  ok(id > 0 && token.startsWith(ref) && /^FIAON-IA-F[0-9A-F]{6}$/.test(ref), "Import-Skript legt an und nennt Ref und Token", ausgabe.slice(-300));
  ok(/gesperrt, solange fehlt/.test(ausgabe) && /Versand des Links: Der Registernachweis/.test(ausgabe), "Vorschau nennt Pflichtfelder und Versandsperre");
  ok(/Bilder: 4 geprüft/.test(ausgabe) && /Metadaten entfernt: .*szene-a\.webp \(EXIF, XMP\)/.test(ausgabe) && /übersprungen \(kein Bildname\): 1/.test(ausgabe) && /Bilder eingespielt: 4/.test(ausgabe) && /alle Verweise gedeckt/.test(ausgabe), "Import mit --bilder: geprüft, Metadaten entfernt, Nicht-Bilder übersprungen, eingespielt", ausgabe.split("\n").filter((x) => /Bild/.test(x)));
  {
    const zeilen = (await sqlPool`SELECT name, mime, daten, groesse, sha256 FROM fiaon_global_angebot_bilder WHERE angebot_id = ${id} ORDER BY name`) as any[];
    ok(zeilen.length === 4 && zeilen.every((z) => z.mime === "image/webp" && Number(z.groesse) === Buffer.from(z.daten).length && !Buffer.from(z.daten).includes(Buffer.from("EXIF")) && !Buffer.from(z.daten).includes(Buffer.from("Pruefstand"))), "vier Bilder in der Datenbank am Angebot, ohne EXIF/XMP", zeilen.map((z) => z.name));
  }
  // Zweite Nachprüfung 08.10.2026 (N6): Vorbedingungen vor --produktion — nur lesen, gegen die Prüfstand-Kopie und den lokalen
  // Server als „Live“. Eine Basis ohne Bild-Route (älterer Code) → FEHLT; --schreiben --produktion bricht dann ab, ohne zu schreiben.
  {
    const skript = (args: string[]) => {
      try { return { code: 0, aus: execFileSync("npx", ["tsx", "scripts/angebot-firma-anlegen.ts", ...args], { encoding: "utf8", env: process.env, stdio: "pipe" }) }; }
      catch (e: any) { return { code: Number(e?.status ?? 1), aus: String(e?.stdout ?? "") + String(e?.stderr ?? "") }; }
    };
    const zeilenVon = (aus: string) => aus.split("\n").filter((x) => /^\s+(ok|FEHLT)\s/.test(x));
    const v1 = skript(["--nur-vorbedingungen", "--live", BASIS]);
    ok(/ok\s+Spalten des Firmenangebots \(6 von 6\)/.test(v1.aus) && /ok\s+Tabelle fiaon_global_angebot_bilder/.test(v1.aus) && /ok\s+CHECKs der Teile/.test(v1.aus)
      && /ok\s+Live-Code kennt das Firmenangebot \(Bild-Route [^)]*: (403|404|410), application\/json\)/.test(v1.aus) && /Migration 096 eingetragen/.test(v1.aus),
      "Import --nur-vorbedingungen: Spalten, Bildtabelle, CHECKs und Live-Code (Bild-Route antwortet mit JSON)", zeilenVon(v1.aus));
    const v2 = skript(["--nur-vorbedingungen", "--live", `${BASIS}/kein-pfad`]);
    ok(v2.code === 1 && /FEHLT\s+Live-Code kennt das Firmenangebot/.test(v2.aus) && /NICHT bereit/.test(v2.aus), "Import --nur-vorbedingungen: Basis ohne Bild-Route → FEHLT, Exit 1", zeilenVon(v2.aus));
    const email3 = `pruef+vor-${lauf}@musterfirma-beispiel.example`;
    fs.writeFileSync(path.join(tmp, "angebot-vor.json"), JSON.stringify({ fassung: S.FIRMA_FASSUNG, kunde: { ...KUNDE, email: email3 }, buergin: { ...SA.BUERGIN_VORGABE }, parameter: PARAMETER }));
    const v3 = skript(["--datei", path.join(tmp, "angebot-vor.json"), "--vorschau", path.join(tmp, "v3.html"), "--schreiben", "--produktion", "--live", `${BASIS}/kein-pfad`]);
    const [n3] = (await sqlPool`SELECT COUNT(*)::int AS n FROM fiaon_global_angebote WHERE (kunde #>> '{}')::jsonb ->> 'email' = ${email3}`) as any[];
    ok(v3.code === 1 && /ABBRUCH: Vorbedingungen fehlen/.test(v3.aus) && n3.n === 0, "Import --schreiben --produktion ohne Vorbedingungen → Abbruch, nichts geschrieben", { code: v3.code, angelegt: n3.n, zeilen: zeilenVon(v3.aus) });
    ok(/Zurücknehmen, falls nötig/.test(ausgabe), "Import nennt nach dem Anlegen den Weg zum Zurücknehmen");
  }

  titel("B. Kundensicht (Form = FirmaKundenSicht)");
  const lesen = async () => { const r = await fetch(`${BASIS}/api/fiaon/global/angebot/${encodeURIComponent(token)}`, { headers: { "user-agent": UA, "x-forwarded-for": IP } }); return { status: r.status, body: await r.json() as any }; };
  let sicht = await lesen();
  const SCHLUESSEL = ["ok", "status", "art", "ref", "fassung", "gueltigBis", "kunde", "kundeAnrede", "seite", "compliance", "ansprechpartner", "uebersicht", "annahme", "annahmeBereit", "gesperrtGrund", "html", "textHash", "vertragPdf", "anlage1Pdf", "pruefberichtPdf"];
  ok(sicht.status === 200 && SCHLUESSEL.every((k) => k in sicht.body) && Object.keys(sicht.body).every((k) => SCHLUESSEL.includes(k) || ["vorschauLeitung", "fehlt"].includes(k)), "alle Felder von FirmaKundenSicht, keine fremden", Object.keys(sicht.body));
  ok(sicht.body.art === "firma" && sicht.body.status === "offen" && sicht.body.annahmeBereit === false && typeof sicht.body.gesperrtGrund === "string", "offen, gesperrt solange die Bürgin unvollständig ist");
  ok(sicht.body.compliance?.bereiche?.length === 7 && sicht.body.seite.kapital.garantie.length === 3 && /^[0-9a-f]{64}$/.test(sicht.body.textHash), "Prüfbericht (Kundenfassung), Garantie-Sätze, Prüfsumme");
  ok(sicht.body.kunde.firma === KUNDE.firma.name && sicht.body.kundeAnrede === "Sehr geehrte Frau Muster" && !("beginn" in sicht.body) && sicht.body.fassung === S.FIRMA_FASSUNG && !!sicht.body.annahme.unterschrift?.titel, "Kunde, Anrede, Fassung C, Texte der Unterschrift (keine Startwahl mehr)");
  const ae = await F.firmaAendern(id, { buergin: BUERGIN_VOLL }, "Prüfstand");
  ok(ae.ok && (ae as any).fehlt.length === 0, "Bürgin vollständig eingetragen (firmaAendern)", ae);
  sicht = await lesen();
  ok(sicht.body.annahmeBereit === true && sicht.body.gesperrtGrund === null, "jetzt annehmbar");

  titel("B2. Bilder nur hinter dem Link (Gegenprüfung 07.10.2026)");
  {
    const basis = `/api/fiaon/global/angebot/${encodeURIComponent(token)}/bild/`;
    const sb = sicht.body.seite;
    ok(sb.phasen.liste.every((p: any) => !p.bild) && sb.hero.glas?.etikett === `${basis}etikett-t.webp` && sb.hero.glas?.foto?.src === `${basis}foto-t.webp`, "Kundensicht: Etikett und Produktfoto hinter dem Link, keine Fotos im Zeitstrahl", { glas: sb.hero.glas?.etikett });
    ok(!JSON.stringify(sb).includes("/angebote/"), "Kundensicht nennt keinen öffentlichen Bildpfad");
    const holen = (pfad: string, kopf: Record<string, string> = {}) => fetch(`${BASIS}${pfad}`, { headers: { "user-agent": UA, "x-forwarded-for": IP, ...kopf } });
    const r = await holen(`${basis}szene-a.webp`);
    const buf = Buffer.from(await r.arrayBuffer());
    const etag = r.headers.get("etag") ?? "";
    ok(r.status === 200 && r.headers.get("content-type") === "image/webp" && r.headers.get("x-content-type-options") === "nosniff" && /private/.test(r.headers.get("cache-control") ?? "") && buf.toString("latin1", 0, 4) === "RIFF" && !buf.includes(Buffer.from("EXIF")), "mit Link → 200, image/webp, nosniff, Cache-Control private, ohne EXIF", { status: r.status, typ: r.headers.get("content-type"), cache: r.headers.get("cache-control") });
    ok(/noindex/.test(r.headers.get("x-robots-tag") ?? ""), "Bild: X-Robots-Tag noindex");
    ok((await holen(`${basis}szene-a.webp`, { "if-none-match": etag })).status === 304, "derselbe Inhalt → 304 (Prüfung des Links trotzdem bei jeder Nutzung)");
    const falsch = token.replace(/.$/, (c) => (c === "A" ? "B" : "A"));
    ok((await holen(`/api/fiaon/global/angebot/${encodeURIComponent(falsch)}/bild/szene-a.webp`)).status === 403, "falscher Link (Signatur) → 403");
    ok((await holen(`/api/fiaon/global/angebot/ohne-link/bild/szene-a.webp`)).status === 403, "ohne gültigen Link → 403");
    const fremd = A.angebotTokenMitAblauf("FIAON-IA-FZZZZZZ", Date.now() + 3600_000);
    ok((await holen(`/api/fiaon/global/angebot/${encodeURIComponent(fremd)}/bild/szene-a.webp`)).status === 404, "gültig signierter Link ohne Angebot → 404");
    const alt = A.angebotTokenMitAblauf(ref, Date.now() - 3600_000);
    ok((await holen(`/api/fiaon/global/angebot/${encodeURIComponent(alt)}/bild/szene-a.webp`)).status === 410, "abgelaufener Link → 410");
    ok((await holen(`${basis}gibt-es-nicht.webp`)).status === 404 && (await holen(`${basis}..%2F..%2Fpasswd`)).status === 404 && (await holen(`${basis}Notiz.txt`)).status === 404, "unbekannter oder ungültiger Name → 404 (keine Auflistung)");
    const ohne = await fetch(`${BASIS}/angebote/k7/etikett.webp`, { headers: { "user-agent": UA } });
    ok(!/^image\//.test(ohne.headers.get("content-type") ?? ""), "ohne Link (alter öffentlicher Pfad /angebote/…) → kein Bild", { status: ohne.status, typ: ohne.headers.get("content-type") });
  }

  titel("B3. Freigabe des Anwalts gilt nur für die freigegebene Fassung — und nur der Inhaber sieht den Link und trägt sie ein");
  {
    // Nachprüfung 08.10.2026 („Link nur an Justin“): über die echten Routen mit Chef-Ausweis der jeweiligen Stufe.
    const listeAls = async (stufe: "leitung" | "inhaber") => {
      const r = await fetch(`${BASIS}/api/fiaon/admin/global/angebote`, { headers: { "user-agent": UA, cookie: chefAusweis(stufe) } });
      const j = await r.json().catch(() => ({})) as any;
      return { status: r.status, e: ((j.angebote ?? []) as any[]).find((x) => x.id === id) };
    };
    const vorL = await listeAls("leitung"); const vorI = await listeAls("inhaber");
    ok(vorL.status === 200 && !!vorL.e?.versandSperre && vorL.e.link === null && vorL.e.linkNurInhaber === true, "Route Liste, Stufe „leitung“, Versand gesperrt: Grund sichtbar, KEIN Link", { status: vorL.status, sperre: vorL.e?.versandSperre, link: vorL.e?.link });
    ok(vorI.status === 200 && typeof vorI.e?.link === "string" && vorI.e.link.includes(encodeURIComponent(token).slice(0, 12)), "Route Liste, Stufe „inhaber“: der Link ist da", { status: vorI.status, link: !!vorI.e?.link });
    const freigabeAls = (stufe: "leitung" | "inhaber") => fetch(`${BASIS}/api/fiaon/admin/global/angebote/${id}/firma/freigabe`, { method: "POST", headers: { "content-type": "application/json", "user-agent": UA, cookie: chefAusweis(stufe) }, body: JSON.stringify({ name: "Kanzlei Prüfstand (Route)", am: heute }) });
    const fl = await freigabeAls("leitung");
    const fiaonFrei = await F.firmaFreigabenLesen(id);
    ok(fl.status === 403 && !fiaonFrei.anwalt, "Route „Freigabe Anwalt“, Stufe „leitung“ → 403, nichts eingetragen", { status: fl.status, anwalt: fiaonFrei.anwalt });
    const fi = await freigabeAls("inhaber"); const fij = await fi.json().catch(() => ({})) as any;
    ok(fi.status === 200 && fij.ok === true && (await F.firmaFreigabenLesen(id)).anwalt?.name === "Kanzlei Prüfstand (Route)", "Route „Freigabe Anwalt“, Stufe „inhaber“ → eingetragen", { status: fi.status, meldung: fij.meldung ?? fij.error });
    const nachL = await listeAls("leitung");
    ok(nachL.e?.versandSperre === null && typeof nachL.e?.link === "string", "nach der Freigabe (Versand frei) sieht auch „leitung“ den Link", { sperre: nachL.e?.versandSperre, link: !!nachL.e?.link });
    const fa = await F.firmaFreigabeAnwalt(id, { name: "Kanzlei Prüfstand", am: heute }, "Prüfstand");
    const eintrag = async () => ((await A.angebotListe()) as any[]).find((x) => x.id === id);
    let e0 = await eintrag();
    ok(fa.ok && e0?.versandSperre === null && e0?.freigaben?.anwalt?.textHash === sicht.body.textHash && /Prüfsumme/.test((fa as any).meldung), "Freigabe mit Prüfsumme der aktuellen Fassung → Versand frei", { sperre: e0?.versandSperre, meldung: (fa as any).meldung });
    const ae2 = await F.firmaAendern(id, { parameter: { ...PARAMETER_LOKAL, umsatzSchwelleCents: 60_100_000 } }, "Prüfstand"); // Runde 2: der Anteil am Budget muss die Hälfte bleiben — geändert wird die Schwelle
    e0 = await eintrag();
    ok(ae2.ok && /geändert/.test(e0?.versandSperre ?? ""), "Vertrag nach der Freigabe geändert → Versand wieder gesperrt", e0?.versandSperre);
    await F.firmaAendern(id, { parameter: PARAMETER_LOKAL }, "Prüfstand");
    e0 = await eintrag();
    ok(e0?.versandSperre === null, "zurück auf die freigegebene Fassung → wieder frei (die Freigabe hängt am Text, nicht am Datum)", e0?.versandSperre);
    // Justin (07.10.2026): Versand erst bei Sunbiz „Active“ — ein Auszug mit „Inactive“ sperrt trotz Freigabe.
    const inaktivB = await F.firmaAendern(id, { buergin: { ...BUERGIN_VOLL, bestaetigtGrundlage: "Sunbiz-Auszug vom 07.10.2026: Status Inactive" } }, "Prüfstand");
    e0 = await eintrag();
    ok(inaktivB.ok && /„Active“/.test(e0?.versandSperre ?? ""), "Bürgin laut Auszug „Inactive“ → Versand gesperrt (trotz Freigabe)", e0?.versandSperre);
    await F.firmaAendern(id, { buergin: BUERGIN_VOLL }, "Prüfstand");
    e0 = await eintrag();
    ok(e0?.versandSperre === null, "Auszug „Active“ → wieder frei", e0?.versandSperre);
    // Zweite Nachprüfung 08.10.2026 (N4): Die Freigabe hängt auch an den Angaben der Bürgin — ändert die Leitung danach die
    // Grundlage (selbst auf einen Text mit „Active“), sperrt der Versand, und „leitung“ sieht den Link nicht mehr.
    ok(e0?.freigaben?.anwalt?.buergin === F.firmaBuerginPruefsumme(BUERGIN_VOLL), "die Freigabe trägt die Prüfsumme der Bürgin-Angaben", e0?.freigaben?.anwalt);
    await F.firmaAendern(id, { buergin: { ...BUERGIN_VOLL, bestaetigtGrundlage: "Sunbiz-Auszug vom 09.10.2026: Status Active (zweiter Auszug)" } }, "Prüfstand");
    e0 = await eintrag();
    const lB = await listeAls("leitung");
    ok(/Angaben der Bürgin/.test(e0?.versandSperre ?? "") && !/verneint ihn/.test(e0?.versandSperre ?? "") && lB.e?.link === null && lB.e?.linkNurInhaber === true,
      "Bürgin nach der Freigabe geändert (Grundlage mit „Active“) → Versand gesperrt, „leitung“ sieht den Link nicht mehr", { sperre: e0?.versandSperre, link: lB.e?.link });
    await F.firmaAendern(id, { buergin: BUERGIN_VOLL }, "Prüfstand");
    e0 = await eintrag();
    ok(e0?.versandSperre === null, "zurück auf die freigegebenen Bürgin-Angaben → wieder frei", e0?.versandSperre);
    sicht = await lesen();
  }

  titel("C. Annahme");
  const annehmen = async (body: Record<string, unknown>) => { const r = await fetch(`${BASIS}/api/fiaon/global/angebot/${encodeURIComponent(token)}/annehmen`, { method: "POST", headers: { "content-type": "application/json", "user-agent": UA, "x-forwarded-for": IP }, body: JSON.stringify(body) }); return { status: r.status, body: await r.json() as any }; };
  // Runde 2: Unterschrift Pflicht — erfundene Test-PNGs (RGBA, leer bzw. mit einem Strich).
  const UNTERSCHRIFT = { art: "gezeichnet", png: pngUrl(testPngRgba(480, 160, true)) };
  const gutBody = { textHash: sicht.body.textHash, unternehmer: true, vertretung: true, unterschrift: UNTERSCHRIFT };
  let r1 = await annehmen({ textHash: sicht.body.textHash, unternehmer: true, unterschrift: UNTERSCHRIFT });
  ok(r1.status === 400 && r1.body.code === "HAEKCHEN" && r1.body.fehlt?.includes("vertretung"), "Häkchen „Vertretung“ fehlt → 400", r1);
  r1 = await annehmen({ textHash: sicht.body.textHash, unternehmer: true, vertretung: true });
  ok(r1.status === 400 && r1.body.code === "UNTERSCHRIFT", "ohne Unterschrift → 400 (der Server prüft, nicht nur die Seite)", r1);
  r1 = await annehmen({ ...gutBody, unterschrift: { art: "gezeichnet", png: pngUrl(testPngRgba(480, 160, false)) } });
  ok(r1.status === 400 && r1.body.code === "UNTERSCHRIFT", "leeres Unterschriftsfeld → 400", r1);
  r1 = await annehmen({ ...gutBody, unterschrift: { art: "getippt", name: "Martina" } });
  ok(r1.status === 400 && r1.body.code === "UNTERSCHRIFT" && /Muster/.test(String(r1.body.error)), "getippter Name ohne Nachnamen → 400", r1);
  r1 = await annehmen({ ...gutBody, textHash: "0".repeat(64) });
  ok(r1.status === 409 && r1.body.code === "GEAENDERT", "Prüfsumme falsch → 409", r1);
  const rb = await fetch(`${BASIS}/api/fiaon/global/angebot/${encodeURIComponent(token)}/annehmen`, { method: "POST", headers: { "content-type": "application/json", "user-agent": "HeadlessChrome/129", "x-forwarded-for": IP }, body: JSON.stringify(gutBody) });
  ok(rb.status === 403, "Roboter (HeadlessChrome) → 403");
  // Zweite Nachprüfung 08.10.2026 (N6): CHECKs der Teile noch alt UND die Tabelle gerade gesperrt (der Tausch scheitert an der
  // Sperre) → die Annahme speichert NICHTS (503). Danach holt der nächste Aufruf den Tausch nach. In diesem Prozess (dieselbe
  // Funktion wie im Server); der Server hält die CHECKs für erledigt und wird nicht berührt.
  {
    await sqlPool`
      ALTER TABLE fiaon_global_angebot_teile
        DROP CONSTRAINT IF EXISTS fiaon_global_angebot_teile_nr_check,
        DROP CONSTRAINT IF EXISTS fiaon_global_angebot_teile_faelligkeit_check,
        ADD CONSTRAINT fiaon_global_angebot_teile_nr_check CHECK (nr BETWEEN 1 AND 2) NOT VALID,
        ADD CONSTRAINT fiaon_global_angebot_teile_faelligkeit_check CHECK (faelligkeit IN ('sofort', 'meilenstein')) NOT VALID`;
    A.firmaTeileCheckVergessen();
    ok(!(await A.firmaTeileCheckLesen()), "Prüfstand-Kopie: CHECKs der Teile auf den Stand vor Migration 096 gesetzt (nr 1–2)");
    let loslassen: () => void = () => {}; const gehalten = new Promise<void>((r) => { loslassen = r; });
    let gesperrt: () => void = () => {}; const sperreDa = new Promise<void>((r) => { gesperrt = r; });
    const halter = sqlPool.begin(async (tx: any) => { await tx`LOCK TABLE fiaon_global_angebot_teile IN ACCESS SHARE MODE`; gesperrt(); await gehalten; });
    await sperreDa;
    const t0 = Date.now();
    const r503 = await A.angebotAnnehmen(token, gutBody, { ip: IP, userAgent: UA, leitung: false });
    const dauer = Date.now() - t0;
    loslassen(); await halter;
    const [st503] = (await sqlPool`SELECT status, angenommen_am FROM fiaon_global_angebote WHERE id = ${id}`) as any[];
    ok(r503.status === 503 && r503.body.code === "TECHNIK" && st503.status === "offen" && !st503.angenommen_am, "CHECKs alt und Tabelle gesperrt → Annahme 503, Angebot bleibt offen (nichts gespeichert)", { status: r503.status, code: r503.body.code, stand: st503.status, ms: dauer });
    let nachgeholt = false;
    for (let i = 0; i < 25 && !nachgeholt; i++) { await new Promise((r) => setTimeout(r, 1000)); A.firmaTeileCheckVergessen(); nachgeholt = await A.firmaTeileCheckSichern(); }
    ok(nachgeholt && await A.firmaTeileCheckLesen(), "Sperre weg → der nächste Aufruf holt den CHECK-Tausch nach (nr bis 500, monatlich/umsatz/verkauf)");
  }
  const gut = await annehmen(gutBody);
  ok(gut.status === 200 && gut.body.ok === true && gut.body.art === "firma" && typeof gut.body.auftragRef === "string" && gut.body.fertigTitel, "gute Annahme → 200 mit Auftrag", gut);
  const doppelt = await annehmen(gutBody);
  ok(doppelt.status === 200 && doppelt.body.schon === true && doppelt.body.auftragRef === gut.body.auftragRef, "zweiter Klick → dieselbe Annahme, nichts doppelt", doppelt.status);

  titel("D. Akte, Person, Rechnung Gründung (Firma, UID, Reverse Charge)");
  const [az] = (await sqlPool`SELECT status, person_id, auftrag_ref, schalter, text_hash, fassung, (vertrag_pdf IS NOT NULL) AS pdf FROM fiaon_global_angebote WHERE id = ${id}`) as any[];
  const sch = typeof az.schalter === "string" ? JSON.parse(az.schalter) : az.schalter;
  ok(az.status === "angenommen" && az.pdf && az.text_hash === sicht.body.textHash && az.fassung === S.FIRMA_FASSUNG && sch.starttag === null && sch.startWahl === null && sch.unternehmer === true, "angenommen, PDF, Prüfsumme, Häkchen gespeichert — Starttag noch offen (kommt mit „Shop live“)", { ...az, schalter: { ...sch, unterschrift: sch.unterschrift ? "…" : null } });
  ok(sch.unterschrift?.art === "gezeichnet" && sch.unterschrift?.png === UNTERSCHRIFT.png && sch.unterschrift?.ip === IP && /^\d{4}-\d{2}-\d{2}T/.test(String(sch.unterschrift?.am)), "Unterschrift gespeichert: Bild, Zeit, IP-Adresse", { art: sch.unterschrift?.art, ip: sch.unterschrift?.ip, am: sch.unterschrift?.am });
  {
    const [fz] = (await sqlPool`SELECT frist_beginn, frist_ende, vertrag_pdf FROM fiaon_global_angebote WHERE id = ${id}`) as any[];
    const fb = fz.frist_beginn instanceof Date ? berlinToday(fz.frist_beginn) : String(fz.frist_beginn).slice(0, 10);
    const fe = fz.frist_ende instanceof Date ? berlinToday(fz.frist_ende) : String(fz.frist_ende).slice(0, 10);
    ok(fb === heute && fe === S.garantieFristEnde(heute, 3), "Garantiefrist der ersten Runde ab dem Tag der Annahme: drei Monate (Runde 2, Punkt 3)", { fb, fe });
    let txt = "";
    try {
      const pdfjs: any = await import("pdfjs-dist/legacy/build/pdf.mjs" as any);
      const doc = await pdfjs.getDocument({ data: new Uint8Array(Buffer.from(fz.vertrag_pdf)), verbosity: 0 }).promise;
      for (let pn = 1; pn <= doc.numPages; pn++) { const tc = await (await doc.getPage(pn)).getTextContent(); txt += " " + tc.items.map((it: any) => it.str).join(" "); }
      txt = txt.replace(/\s+/g, " ");
    } catch (e) { txt = `(nicht lesbar: ${e instanceof Error ? e.message : e})`; }
    ok(txt.includes("Unterschrift (von Hand gezeichnet)") && txt.includes("Angenommen mit Unterschrift und Klick auf") && /Unterschrift: von Hand gezeichnet, gespeichert mit Zeit und IP-Adresse/.test(txt), "Vertrags-PDF: Annahmevermerk zeigt die Unterschrift", txt.slice(txt.indexOf("Für die Auftraggeberin"), txt.indexOf("Für die Auftraggeberin") + 300));
  }
  ok(az.person_id != null, "Person am Angebot (fiaon_global_angebote.person_id)", az.person_id);
  if (az.person_id != null) ok(await istGlobalKunde(Number(az.person_id)), "Global-Kunde-Regel (E-272) greift für die Person");
  const ref1 = String(az.auftrag_ref);
  const [b1] = (await sqlPool`SELECT amount_due, company_name, tax_id, legal_form, rechnung_ust_modus, invoice_number, payment_reference, payment_status, payment_due_date, pack_key, person_id FROM fiaon_applications WHERE ref = ${ref1}`) as any[];
  ok(Number(b1.amount_due) === 6900 && b1.company_name === KUNDE.firma.name && b1.tax_id === KUNDE.firma.uid && b1.pack_key === "global_individuell" && b1.payment_status === "pending_payment" && !!b1.invoice_number, "Bestellung Gründung: 6.900,00 €, Firma, UID, Rechnungsnummer", b1);
  ok(b1.rechnung_ust_modus === "reverse_charge" && b2bUstModus(b1) === "reverse_charge", "Reverse Charge an der Bestellung (b2bUstModus)");
  const zeile = await A.angebotRechnungsZeile(ref1);
  ok(zeile?.beschreibung.startsWith(`${S.FIRMA_PAKETNAME} ${ref}: Gründung`) && zeile?.zeitraum === "einmalig", "Rechnungstext Gründung", zeile);
  // Die Rechnung selbst (derselbe Renderer wie für Kunde, Betreuer, Verwaltung): Firma, UID, Reverse-Charge-Satz, Text.
  {
    const { globalRechnungPdf } = await import("../server/lib/fiaon-global-auftrag");
    const r = await globalRechnungPdf(ref1);
    let txt = "";
    try {
      const pdfjs: any = await import("pdfjs-dist/legacy/build/pdf.mjs" as any);
      const doc = await pdfjs.getDocument({ data: new Uint8Array(r!.pdf), verbosity: 0 }).promise;
      const tc = await (await doc.getPage(1)).getTextContent();
      txt = tc.items.map((i: any) => i.str).join(" ").replace(/\s+/g, " ");
    } catch (e) { txt = `(nicht lesbar: ${e instanceof Error ? e.message : e})`; }
    ok(!!r && txt.includes(`Rechnungsempfänger ${KUNDE.firma.name}`) && txt.includes(`USt-IdNr.: ${KUNDE.firma.uid}`) && txt.includes("Steuerschuldnerschaft des Leistungsempfängers (Reverse Charge)") && txt.includes("6.900,00 €") && txt.includes(`${S.FIRMA_PAKETNAME} ${ref}: Gründung`), "Rechnung Gründung (PDF): Firma, UID, Reverse Charge, Betrag, Text", txt.slice(0, 400));
  }
  const [akte] = (await sqlPool`SELECT firma, ust_id, rechnung_ust_modus, angebot_id, bestaetigungen FROM fiaon_global_auftraege WHERE ref = ${ref1}`) as any[];
  const af = typeof akte?.firma === "string" ? JSON.parse(akte.firma) : akte?.firma;
  ok(akte && af?.name === KUNDE.firma.name && af?.art !== "privat" && akte.ust_id === KUNDE.firma.uid && akte.rechnung_ust_modus === "reverse_charge" && Number(akte.angebot_id) === id, "Akte als Unternehmen mit UID", akte);
  const monate = (await sqlPool`SELECT nr, betrag_cents, faellig_am, zeitraum, titel FROM fiaon_global_angebot_teile WHERE angebot_id = ${id} AND faelligkeit = 'monatlich' ORDER BY nr`) as any[];
  const fa = (x: any) => (x instanceof Date ? berlinToday(x) : String(x).slice(0, 10));
  ok(monate.length === 0, "vor „Shop live“: keine Monatsteile — das Wachstumsbudget hat noch nicht begonnen", monate.length);

  titel("D2. Keine automatische Mail an die Kundin (Zahlungstakt, Termine, Türen)");
  {
    const ZT = await import("../server/lib/fiaon-global-zahlungstakt");
    const GA = await import("../server/lib/fiaon-global-auftrag");
    const { sendMakeWebhookMitGrund } = await import("../server/make-webhook");
    const bf = typeof akte?.bestaetigungen === "string" ? JSON.parse(akte.bestaetigungen) : akte?.bestaetigungen;
    ok(bf?.firmenangebot === true, "Akte trägt bestaetigungen.firmenangebot = true", bf);
    // Ein Zeitpunkt im Sendefenster (Berlin 8–20 Uhr, Mo–Sa), höchstens zwei Tage voraus.
    let takt = new Date(Date.now() + 5 * 60_000);
    for (let i = 0; i < 96 && !ZT.imSendefenster(takt); i++) takt = new Date(takt.getTime() + 30 * 60_000);
    const vor = (tage: number) => new Date(takt.getTime() - tage * 864e5);
    await sqlPool`UPDATE fiaon_global_auftraege SET created_at = ${vor(4)}, zahlung_erinnerung_1_am = NULL, zahlung_erinnerung_2_am = NULL, zahlung_aufgabe_am = NULL, zahlung_takt_versuch_am = NULL WHERE ref = ${ref1}`;
    const t4 = await ZT.globalZahlungTaktLauf(takt);
    const [m4] = (await sqlPool`SELECT zahlung_erinnerung_1_am, zahlung_aufgabe_am FROM fiaon_global_auftraege WHERE ref = ${ref1}`) as any[];
    ok(ZT.imSendefenster(takt) && t4.erinnerung1 === 0 && !m4.zahlung_erinnerung_1_am && !m4.zahlung_aufgabe_am, "Zahlungstakt Tag 4: KEINE Erinnerungsmail an die Firmenkundin", { t4, m4 });
    await sqlPool`UPDATE fiaon_global_auftraege SET created_at = ${vor(8)} WHERE ref = ${ref1}`;
    const t8 = await ZT.globalZahlungTaktLauf(takt);
    ok(t8.erinnerung2 === 0 && t8.erinnerung1 === 0, "Zahlungstakt Tag 8: keine zweite Erinnerung", t8);
    await sqlPool`UPDATE fiaon_global_auftraege SET created_at = ${vor(11)} WHERE ref = ${ref1}`;
    const t11 = await ZT.globalZahlungTaktLauf(takt);
    const [m11] = (await sqlPool`SELECT zahlung_aufgabe_am FROM fiaon_global_auftraege WHERE ref = ${ref1}`) as any[];
    const [aufg] = (await sqlPool`SELECT text FROM fiaon_betreiber_todos WHERE schluessel = ${`global:${ref1}:zahlung-tag10`} LIMIT 1`) as any[];
    ok(t11.aufgaben === 1 && !!m11.zahlung_aufgabe_am && /Per Mail wurde NICHT erinnert/.test(String(aufg?.text ?? "")), "Zahlungstakt Tag 11: die Aufgabe „anrufen“ an die zuständige Person bleibt", { t11, text: String(aufg?.text ?? "").slice(0, 120) });
    const zt = (await sqlPool`SELECT COUNT(*)::int AS n FROM fiaon_mail_log WHERE LOWER(empfaenger) = ${email} AND event = 'global_zahlung_erinnerung'`) as any[];
    ok(zt[0].n === 0, "keine Zahlungserinnerung im Mail-Protokoll", zt[0].n);
    // Die zwei Türen: Automatik gesperrt, von Hand frei.
    const FP = await import("../server/lib/fiaon-global-firma-post");
    const mk = await sendMakeWebhookMitGrund("termin_erinnerung" as any, { email, vorname: "Martina", nachname: "Muster", termin_datum: "01.01.2027", termin_uhrzeit: "10:00" } as any);
    ok(!mk.ok && /E-301/.test(String(mk.grund)), "Mail-Tür (Make/Brevo): automatische Terminerinnerung an die Firmenkundin gesperrt", mk.grund);
    ok(await FP.firmaKundinAdresse(email.toUpperCase()) && !(await FP.firmaKundinAdresse(`andere+${lauf}@example.org`)), "die Wand erkennt die Adresse der Firmenkundin (auch in Großbuchstaben) — und nur sie");
    const akte1 = await GA.globalAkteLesen(ref1); const b1x = await GA.globalBestellungLesen(ref1);
    const gm = await GA.globalMailSenden("global_frist", akte1, b1x, { ausgeloestVon: "Tageslauf (Pflichtenkalender)" });
    const gmHand = await GA.globalMailSenden("global_frist", akte1, b1x, { ausgeloestVon: "Prüfstand (von Hand)" });
    ok(!gm.ok && /E-301/.test(String(gm.grund)) && !/E-301/.test(String(gmHand.grund ?? "")), "globalMailSenden: Fristmail des Tageslaufs gesperrt — von Hand nicht von E-301", { auto: gm.grund, hand: gmHand.grund });
    const [sgT] = (await sqlPool`SELECT t.erinnert_am FROM fiaon_global_angebote a JOIN fiaon_termine t ON t.id = a.startgespraech_termin_id WHERE a.id = ${id}`) as any[];
    if (sgT) ok(!!sgT.erinnert_am, "Startgespräch gebucht: Terminerinnerung gilt als erledigt (keine Mail 24 Stunden vorher)", sgT);
    else console.log("  HINWEIS  kein Startgespräch gebucht (keine Zeiten im Prüfstand) — Terminerinnerung nicht prüfbar");
    // Zweite Nachprüfung 08.10.2026 (N1): „Nachholen“ über die echte Route meldet beim Firmenangebot keine Bestätigungsmail.
    const mailVor = (await sqlPool`SELECT COUNT(*)::int AS n FROM fiaon_mail_log WHERE LOWER(empfaenger) = ${email}`) as any[];
    const nh = await fetch(`${BASIS}/api/fiaon/admin/global/angebote/${id}/nachholen`, { method: "POST", headers: { "content-type": "application/json", "user-agent": UA, cookie: chefAusweis("leitung") }, body: "{}" });
    const nhj = await nh.json().catch(() => ({})) as any;
    const mailNach = (await sqlPool`SELECT COUNT(*)::int AS n FROM fiaon_mail_log WHERE LOWER(empfaenger) = ${email}`) as any[];
    ok(nh.status === 200 && !/Bestätigungsmail stehen/.test(String(nhj.meldung)) && /keine Mail an die Kundin/.test(String(nhj.meldung)) && /von Hand/.test(String(nhj.meldung)) && mailNach[0].n === mailVor[0].n,
      "Route „Nachholen“ (Firmenangebot): meldet „keine Mail — Vertrag und Rechnung von Hand“, kein Eintrag im Mail-Protokoll", { status: nh.status, meldung: nhj.meldung ?? nhj.error, mails: [mailVor[0].n, mailNach[0].n] });
  }

  titel("E. „Shop live“ startet das Wachstumsbudget — dann Monatslauf mit simulierter Uhr");
  const berlin = (tag: string) => new Date(`${tag}T10:00:00+02:00`);
  let l1 = await F.firmaStundenlauf(berlin(S.plusTageIso(heute, 40)));
  const nr2 = () => sqlPool`SELECT bestell_ref FROM fiaon_global_angebot_teile WHERE angebot_id = ${id} AND nr = 2`.then((r: any) => r[0]?.bestell_ref ?? null);
  ok(l1.rechnungen === 0 && (await nr2()) === null, "ohne „Shop live“ stellt der Stundenlauf keine Monatsrechnung (auch Wochen später nicht)", l1);
  const umsatzVor = await F.firmaUmsatz(id, { jahr: Number(heute.slice(0, 4)), quartal: 1, kumuliert: "1,00", beleg: "vor Shop live" }, "Prüfstand");
  ok(!umsatzVor.ok && /Shop live/.test((umsatzVor as any).error), "Umsatz eintragen erst nach „Shop live“", umsatzVor);
  const mailVorShop = (await sqlPool`SELECT COUNT(*)::int AS n FROM fiaon_mail_log WHERE LOWER(empfaenger) = ${email}`) as any[];
  const zukunft = await F.firmaShopLive(id, { am: S.plusTageIso(heute, 1) }, "Prüfstand");
  ok(!zukunft.ok && (zukunft as any).status === 400, "„Shop live“ in der Zukunft → abgewiesen", zukunft);
  // Runde 3 (Fassung D, Ziffer 10 Absatz 2): „Spätester Starttag“ erst ab Annahme + sechs Monate; später nur mit Bestätigung.
  const spZuFrueh = await F.firmaShopLive(id, { art: "spaetestens" }, "Prüfstand");
  ok(!spZuFrueh.ok && /spätest/.test((spZuFrueh as any).error ?? ""), "„Spätester Starttag“ vor Annahme + sechs Monate → abgewiesen", spZuFrueh);
  const spaeter = S.plusTageIso(S.budgetSpaetesterStart(heute, PARAMETER), 3);
  const ohneHaken = await F.firmaShopLive(id, { am: spaeter }, "Prüfstand", { heute: spaeter });
  ok(!ohneHaken.ok && /Verzögerung/.test((ohneHaken as any).error ?? ""), "„Shop live“ nach dem spätesten Starttag ohne Bestätigung der Verzögerung bei FIAON → abgewiesen", ohneHaken);
  const sl = await F.firmaShopLive(id, { am: heute }, "Prüfstand");
  const start = heute;
  ok(sl.ok && (sl as any).starttag === start && (sl as any).monate === 24, "„Shop live“ heute → Starttag, vierundzwanzig Monatsteile", sl);
  const monateS = (await sqlPool`SELECT nr, betrag_cents, faellig_am, zeitraum, titel FROM fiaon_global_angebot_teile WHERE angebot_id = ${id} AND faelligkeit = 'monatlich' ORDER BY nr`) as any[];
  ok(monateS.length === 24 && monateS[0].nr === 2 && monateS[23].nr === 25 && monateS.every((m, i) => Number(m.betrag_cents) === 200000 && fa(m.faellig_am) === S.monatFaelligAm(start, i + 1)) && monateS[0].titel === "Wachstumsbudget — Ihr Anteil, Monat 1", "Monatsteile: 2.000 € je Monat ab dem Tag „Shop live“ (nr 2 … 25)", monateS.slice(0, 2));
  const [schS] = (await sqlPool`SELECT schalter FROM fiaon_global_angebote WHERE id = ${id}`) as any[];
  const schS2 = typeof schS.schalter === "string" ? JSON.parse(schS.schalter) : schS.schalter;
  ok(schS2.starttag === start && schS2.shopLiveAm === start && schS2.unterschrift?.art === "gezeichnet", "Schalter: Starttag = Tag „Shop live“, Unterschrift bleibt", { starttag: schS2.starttag });
  const ref2 = await nr2();
  ok(!!ref2, "erste Monatsrechnung an diesem Tag — sofort gestellt", ref2);
  const zweimal = await F.firmaShopLive(id, { am: heute }, "Prüfstand");
  ok(!zweimal.ok && (zweimal as any).status === 409, "„Shop live“ ein zweites Mal → 409", zweimal);
  const mailNachShop = (await sqlPool`SELECT COUNT(*)::int AS n FROM fiaon_mail_log WHERE LOWER(empfaenger) = ${email} AND COALESCE(grund, '') NOT LIKE '%E-301%'`) as any[];
  const [aShop] = (await sqlPool`SELECT text FROM fiaon_betreiber_todos WHERE schluessel = ${`global:${ref}:shop-live`} LIMIT 1`) as any[];
  ok(mailNachShop[0].n <= mailVorShop[0].n && /keine automatische Mail/.test(String(aShop?.text ?? "")), "„Shop live“ und erste Monatsrechnung: keine Mail an die Kundin, Aufgabe „Shop live mitteilen“", { vor: mailVorShop[0].n, nach: mailNachShop[0].n });
  l1 = await F.firmaStundenlauf(berlin(start));
  ok(l1.rechnungen === 0, "Stundenlauf am selben Tag: Monat 1 steht schon, nichts doppelt", l1);
  if (ref2) {
    const [b2] = (await sqlPool`SELECT amount_due, company_name, tax_id, rechnung_ust_modus, invoice_number, pack_name FROM fiaon_applications WHERE ref = ${ref2}`) as any[];
    ok(Number(b2.amount_due) === 2000 && b2.company_name === KUNDE.firma.name && b2.rechnung_ust_modus === "reverse_charge" && !!b2.invoice_number && String(b2.pack_name).includes("Monat 1"), "Monatsrechnung: 2.000,00 € (Ihr Anteil), Firma, Reverse Charge, eigene Nummer", b2);
    const z2 = await A.angebotRechnungsZeile(String(ref2));
    ok(z2?.beschreibung.includes("Wachstumsbudget — Ihr Anteil, Monat 1") && z2?.beschreibung.includes("gemeinsamen Wachstumsbudget") && z2?.zeitraum === S.monatZeitraum(start, 1).text, "Rechnungstext „Wachstumsbudget — Ihr Anteil, Monat 1“ mit Zeitraum", z2);
  }
  l1 = await F.firmaStundenlauf(berlin(start));
  ok(l1.rechnungen === 0, "zweiter Lauf am selben Tag: nichts doppelt", l1);
  l1 = await F.firmaStundenlauf(berlin(S.monatFaelligAm(start, 2)));
  ok(l1.rechnungen === 1, "einen Monat später: Rechnung Monat 2", l1);
  {
    const [t2] = (await sqlPool`SELECT id FROM fiaon_global_angebot_teile WHERE angebot_id = ${id} AND nr = 2`) as any[];
    const schl = `global:${ref}:rechnung:${t2.id}`;
    const [a2] = (await sqlPool`SELECT id, status FROM fiaon_betreiber_todos WHERE schluessel = ${schl} LIMIT 1`) as any[];
    ok(!!a2, "Monat 1: Aufgabe „Rechnung schicken“ (Schlüssel je Teil)", schl);
    // Nachholweg: Bestellzeile gebunden, aber ohne Rechnung (Prozess zwischen den Schritten beendet) — nur Prüfstand-Kopie.
    // Die Bestellzeile trägt payment_reference ab dem Anlegen (NOT NULL); „ohne Rechnung“ heißt payment_status noch 'pending'.
    await sqlPool`UPDATE fiaon_betreiber_todos SET status = 'erledigt', erledigt_am = NOW() WHERE schluessel = ${schl}`;
    await sqlPool`UPDATE fiaon_applications SET payment_status = 'pending', rechnung_ust_modus = 'none' WHERE ref = ${ref2}`;
    const tagM2 = S.monatFaelligAm(start, 2);
    const teileJ = (await sqlPool`SELECT t.*, a.payment_status, a.payment_reference, a.invoice_number, a.payment_due_date, a.completed_at FROM fiaon_global_angebot_teile t LEFT JOIN fiaon_applications a ON a.ref = t.bestell_ref WHERE t.angebot_id = ${id}`) as any[];
    const liste1 = F.firmaListenEintrag((await A.angebotLesen({ id }))!, teileJ, { fr: await F.firmaFreigabenLesen(id), heute: tagM2, aufrufe: null, startgespraech: null }) as any;
    const t2l = liste1?.teile.find((t: any) => t.nr === 2);
    ok(t2l && t2l.rechnungKnopf === null && !t2l.rechnungUrl, "hängende Rechnung: das Chefbüro zeigt „Rechnung jetzt stellen“ (kein „Rechnung steht“)", t2l && { knopf: t2l.rechnungKnopf, url: t2l.rechnungUrl, status: t2l.zahlungsstatus });
    const frischGesperrt = await F.firmaStundenlauf(berlin(S.monatFaelligAm(start, 2)));
    ok(frischGesperrt.rechnungen === 0, "eine gerade erst gebundene Bestellzeile holt der Stundenlauf nicht nach (fünfzehn Minuten Ruhe)", frischGesperrt);
    await sqlPool`UPDATE fiaon_global_angebot_teile SET rechnung_am = NOW() - INTERVAL '1 hour' WHERE id = ${t2.id}`;
    const nachLauf = await F.firmaStundenlauf(berlin(S.monatFaelligAm(start, 2)));
    const [bn] = (await sqlPool`SELECT payment_reference, payment_status, rechnung_ust_modus FROM fiaon_applications WHERE ref = ${ref2}`) as any[];
    const [an2] = (await sqlPool`SELECT status FROM fiaon_betreiber_todos WHERE schluessel = ${schl} LIMIT 1`) as any[];
    const vl = ((await sqlPool`SELECT verlauf FROM fiaon_global_angebote WHERE id = ${id}`) as any[])[0]?.verlauf;
    const nachgeholt = JSON.stringify(vl ?? "").includes("nachgeholt");
    ok(nachLauf.rechnungen === 1 && nachgeholt && bn.payment_status === "pending_payment" && bn.rechnung_ust_modus === "reverse_charge" && an2?.status !== "erledigt", "Stundenlauf holt die hängende Rechnung nach: Reverse Charge gesetzt, Aufgabe „Rechnung schicken“ wieder offen", { nachLauf, bn, aufgabe: an2?.status });
    await sqlPool`UPDATE fiaon_betreiber_todos SET status = 'erledigt', erledigt_am = NOW() WHERE schluessel = ${schl}`;
    const schon = await F.firmaTeilJetztBerechnen(id, Number(t2.id), "Prüfstand", { heute: tagM2 });
    const [an3] = (await sqlPool`SELECT status FROM fiaon_betreiber_todos WHERE schluessel = ${schl} LIMIT 1`) as any[];
    ok(schon.ok && /steht schon/.test((schon as any).meldung) && an3?.status === "erledigt", "„Die Rechnung steht schon“: keine neue Aufgabe (eine erledigte bleibt erledigt)", { schon, aufgabe: an3?.status });
    // Storno über die Zahlungsliste (Gründungsbestellung storniert, Akte bleibt „offen“): keine Monatsrechnung, keine Verlängerung.
    await sqlPool`UPDATE fiaon_applications SET payment_status = 'cancelled', cancelled_at = NOW() WHERE ref = ${ref1}`;
    const vorher = (await sqlPool`SELECT COUNT(*)::int AS n FROM fiaon_global_angebot_teile WHERE angebot_id = ${id} AND bestell_ref IS NOT NULL`) as any[];
    const ls = await F.firmaStundenlauf(berlin(S.monatFaelligAm(start, 3)));
    const nachher = (await sqlPool`SELECT COUNT(*)::int AS n FROM fiaon_global_angebot_teile WHERE angebot_id = ${id} AND bestell_ref IS NOT NULL`) as any[];
    const [t4m] = (await sqlPool`SELECT id FROM fiaon_global_angebot_teile WHERE angebot_id = ${id} AND nr = 4`) as any[];
    const jetztSt = await F.firmaTeilJetztBerechnen(id, Number(t4m.id), "Prüfstand");
    ok(nachher[0].n === vorher[0].n && ls.rechnungen === 0 && !jetztSt.ok && /storniert/.test((jetztSt as any).error), "Gründung über die Zahlungsliste storniert → keine Monatsrechnung, auch nicht von Hand", { vorher: vorher[0].n, nachher: nachher[0].n, ls, jetztSt });
    await sqlPool`UPDATE fiaon_applications SET payment_status = 'pending_payment', cancelled_at = NULL WHERE ref = ${ref1}`;
  }

  titel("F. Zahlung Gründung → Start");
  await sqlPool`UPDATE fiaon_applications SET payment_status = 'paid', completed_at = NOW() WHERE ref = ${ref1}`; // nur Prüfstand-Kopie: Zahlung simuliert
  const gestartet = await A.angebotNachZahlung(ref1);
  const [ak2] = (await sqlPool`SELECT status FROM fiaon_global_auftraege WHERE ref = ${ref1}`) as any[];
  ok(gestartet.gestartet === true && ak2.status === "gestartet", "Gründung bezahlt → Auftrag gestartet (Unternehmen, ohne Widerrufsfrist)", { gestartet, ak2 });
  const start2 = await A.angebotNachZahlung(ref1);
  ok(start2.gestartet === false, "zweite Buchung startet nichts doppelt", start2);

  titel("G. Garantie: Bedingungen → Frist → Ruhen → Garantiefall");
  const ende0 = S.garantieFristEnde(heute, 3);
  const kurz = await F.firmaGarantiefall(id, "Prüfstand");
  ok(!kurz.ok && /Die Frist läuft bis/.test((kurz as any).error), "Frist läuft seit der Annahme — vor ihrem Ende kein Garantiefall", kurz);
  const bed = await F.firmaBedingungenErfuellt(id, { am: heute }, "Prüfstand");
  const [fz2] = (await sqlPool`SELECT frist_ende FROM fiaon_global_angebote WHERE id = ${id}`) as any[];
  ok(bed.ok && (bed as any).fristEnde === ende0 && fa(fz2.frist_ende) === ende0 && (await F.firmaFreigabenLesen(id)).bedingungenErfuelltAm === heute, `Bedingungen erfüllt → Bürgschaft wirksam, die Frist ab Annahme bleibt (bis ${S.firmaTag(ende0)})`, bed);
  const heuteP20 = S.plusTageIso(heute, 20);
  const hem = await F.firmaFristHemmen(id, { aufgefordertAm: S.plusTageIso(heute, 2), erbrachtAm: S.plusTageIso(heute, 15), grund: "Jahresabschlüsse trotz Aufforderung nicht vorgelegt (Prüfstand)." }, "Prüfstand", { heute: heuteP20 });
  ok(hem.ok && (hem as any).tage === 6 && (hem as any).fristEnde === S.plusTageIso(ende0, 6), "Frist ruht ab Aufforderung + sieben Tage bis zur Mitwirkung (6 Tage)", hem);
  const ende1 = S.plusTageIso(ende0, 6);
  const fruh = await F.firmaGarantiefall(id, "Prüfstand", { heute: ende1 });
  ok(!fruh.ok, "am Fristende selbst noch kein Garantiefall", fruh);
  const zusage = await F.firmaKapitalErhalten(id, { art: "zugesagt", am: heute, betragUsd: "250.000", beleg: "Zusage eines Instituts in Textform (Prüfstand, erfunden)." }, "Prüfstand");
  ok(!zusage.ok && /Zusage allein/.test((zusage as any).error ?? ""), "Fassung D: eine Zusage erfüllt die Garantie nicht (nur Auszahlung oder Ablehnung)", zusage);
  const fall = await F.firmaGarantiefall(id, "Prüfstand", { heute: S.plusTageIso(ende1, 1) });
  const [gz] = (await sqlPool`SELECT erstattung_cents, erstattung_ausgeloest_am FROM fiaon_global_angebote WHERE id = ${id}`) as any[];
  ok(fall.ok && Number(gz.erstattung_cents) === 690000 && !!gz.erstattung_ausgeloest_am, "nach dem Fristende: Garantiefall → Erstattung der Gründung 6.900 € vorgemerkt", { fall, gz });
  const nachher = await F.firmaKapitalErhalten(id, { art: "ausgezahlt", am: heute, betragUsd: "250.000", beleg: "Auszahlungsbestätigung liegt im Dokumentenraum (Prüfstand)." }, "Prüfstand");
  ok(!nachher.ok, "nach dem Garantiefall lässt sich „erste Runde erhalten“ nicht mehr eintragen", nachher);

  titel("H. Umsatz- und Verkaufsbeteiligung");
  const jahr0 = Number(start.slice(0, 4));
  const u0 = await F.firmaUmsatz(id, { jahr: jahr0, quartal: 4, kumuliert: "400.000,00", beleg: "UVA Prüfstand Q4" }, "Prüfstand", { heute: `${jahr0 + 1}-01-10` });
  const sw0 = S.umsatzSchwelleJahr(PARAMETER, jahr0, start).schwelleCents;
  ok(u0.ok && (u0 as any).schwelleCents === sw0 && (u0 as any).rechnungCents === Math.round((40_000_000 - sw0) / 10), `erstes Jahr anteilig: Schwelle ${S.firmaEur(sw0)}, 10 % darüber`, u0);
  const uq1 = await F.firmaUmsatz(id, { jahr: jahr0 + 1, quartal: 1, kumuliert: "500.000,00", beleg: "UVA Prüfstand Q1" }, "Prüfstand", { heute: `${jahr0 + 1}-04-20` });
  ok(uq1.ok && (uq1 as any).rechnungCents === 0, "Q1 unter der Schwelle → keine Beteiligung", uq1);
  const uq2 = await F.firmaUmsatz(id, { jahr: jahr0 + 1, quartal: 2, kumuliert: "700.000,00", beleg: "UVA Prüfstand Q2" }, "Prüfstand", { heute: `${jahr0 + 1}-07-20` });
  ok(uq2.ok && (uq2 as any).rechnungCents === 1_000_000, "Q2 700.000 € → 10.000 €", uq2);
  const uq3 = await F.firmaUmsatz(id, { jahr: jahr0 + 1, quartal: 3, kumuliert: "900.000,00", beleg: "UVA Prüfstand Q3" }, "Prüfstand", { heute: `${jahr0 + 1}-10-20` });
  ok(uq3.ok && (uq3 as any).rechnungCents === 2_000_000, "Q3 900.000 €, bereits 10.000 € → 20.000 €", uq3);
  const uq3b = await F.firmaUmsatz(id, { jahr: jahr0 + 1, quartal: 3, kumuliert: "950.000,00", beleg: "UVA Prüfstand Q3 doppelt" }, "Prüfstand", { heute: `${jahr0 + 1}-10-21` });
  ok(!uq3b.ok, "dasselbe Quartal zweimal → abgelehnt", uq3b);
  const uj = await F.firmaUmsatz(id, { jahr: jahr0 + 1, quartal: "jahr", kumuliert: "850.000,00", beleg: "Jahresabschluss Prüfstand" }, "Prüfstand", { heute: `${jahr0 + 2}-03-01` });
  ok(uj.ok && (uj as any).gutschriftCents === 500_000 && (uj as any).rechnungCents === 0, "Jahresabgleich 850.000 € → Gutschrift 5.000 €", uj);
  const vor = await F.firmaUmsatz(id, { jahr: jahr0, quartal: 3, kumuliert: "100.000", beleg: "UVA vor dem Start" }, "Prüfstand", { heute: `${jahr0 + 1}-01-10` });
  ok(!vor.ok, "Quartal vor dem Startmonat → abgelehnt", vor);
  const umsatzTeile = (await sqlPool`SELECT titel, betrag_cents, bestell_ref, zeitraum FROM fiaon_global_angebot_teile WHERE angebot_id = ${id} AND faelligkeit = 'umsatz' ORDER BY nr`) as any[];
  ok(umsatzTeile.length === 3 && umsatzTeile.every((t) => !!t.bestell_ref), "drei Umsatzrechnungen mit Bestellzeile", umsatzTeile);
  if (umsatzTeile[1]?.bestell_ref) {
    const zu = await A.angebotRechnungsZeile(String(umsatzTeile[1].bestell_ref));
    ok(zu?.beschreibung.includes(`Umsatzbeteiligung — Q2 ${jahr0 + 1}`) && zu?.beschreibung.includes("700.000,00 €"), "Rechnungstext Umsatz mit Bemessung", zu);
  }
  const ohneV = await F.firmaVerkauf(id, { gegenleistung: "2.000.000,00", am: heute, beleg: "Kaufvertrag und Zufluss liegen im Dokumentenraum (Prüfstand)." }, "Prüfstand");
  ok(!ohneV.ok && (ohneV as any).status === 400 && /Wer veräußert/.test((ohneV as any).error), "Verkauf ohne „Wer veräußert“ → 400 (Pflichtfeld)", ohneV);
  const vk = await F.firmaVerkauf(id, { veraeusserer: "auftraggeberin", gegenleistung: "2.000.000,00", am: heute, beleg: "Kaufvertrag und Zufluss liegen im Dokumentenraum (Prüfstand)." }, "Prüfstand");
  const [vt] = (await sqlPool`SELECT betrag_cents, bestell_ref FROM fiaon_global_angebot_teile WHERE angebot_id = ${id} AND faelligkeit = 'verkauf'`) as any[];
  ok(vk.ok && (vk as any).betragCents === 10_000_000 && Number(vt?.betrag_cents) === 10_000_000 && !!vt?.bestell_ref, "Verkauf 2.000.000 € → 5 % = 100.000 € mit Rechnung", vk);
  const vk2 = await F.firmaVerkauf(id, { veraeusserer: "auftraggeberin", gegenleistung: "2.000.000,00", am: heute, beleg: "Derselbe Verkauf ein zweites Mal geklickt (Prüfstand)." }, "Prüfstand");
  const vkn = (await sqlPool`SELECT COUNT(*)::int AS n FROM fiaon_global_angebot_teile WHERE angebot_id = ${id} AND faelligkeit = 'verkauf'`) as any[];
  ok(!vk2.ok && (vk2 as any).status === 409 && /steht schon als Teil/.test((vk2 as any).error) && vkn[0].n === 1, "derselbe Verkauf ein zweites Mal → 409, keine zweite Rechnung", { vk2, n: vkn[0].n });
  const bestellVor = (await sqlPool`SELECT COUNT(*)::int AS n FROM fiaon_applications WHERE email = ${email}`) as any[];
  const vg = await F.firmaVerkauf(id, { veraeusserer: "gesellschafter", gegenleistung: "500.000,00", am: heute, beleg: "Anteilskaufvertrag der Gesellschafterin liegt vor (Prüfstand).", endetUmsatz: false }, "Prüfstand");
  const [tg] = (await sqlPool`SELECT id, bestell_ref, schuldner, betrag_cents FROM fiaon_global_angebot_teile WHERE id = ${(vg as any).teilId ?? 0}`) as any[];
  const bestellNach = (await sqlPool`SELECT COUNT(*)::int AS n FROM fiaon_applications WHERE email = ${email}`) as any[];
  const [ag] = (await sqlPool`SELECT id FROM fiaon_betreiber_todos WHERE schluessel = ${`global:${ref}:verkauf-gesellschafter:${tg?.id}`} LIMIT 1`) as any[];
  ok(vg.ok && (vg as any).rechnung === false && tg?.schuldner === "gesellschafter" && !tg?.bestell_ref && Number(tg?.betrag_cents) === 2_500_000 && bestellNach[0].n === bestellVor[0].n && !!ag, "Verkauf durch Gesellschafter: Teil vorgemerkt, KEINE Rechnung an die Firma, Aufgabe an Justin", { vg, tg, bestellungen: [bestellVor[0].n, bestellNach[0].n] });
  const rg = await F.firmaTeilJetztBerechnen(id, Number(tg?.id), "Prüfstand");
  ok(!rg.ok && /Gesellschafter/.test((rg as any).error), "„Rechnung jetzt stellen“ für den Gesellschafter-Teil → abgelehnt", rg);
  const lg = await F.firmaStundenlauf(berlin(S.plusTageIso(heute, 2)));
  const [tg2] = (await sqlPool`SELECT bestell_ref FROM fiaon_global_angebot_teile WHERE id = ${tg?.id ?? 0}`) as any[];
  ok(!tg2?.bestell_ref, "der Stundenlauf rechnet den Gesellschafter-Teil nie ab", lg);

  titel("I. Verlängerung und Kündigung");
  const ende24 = S.laufzeitEnde(start, 24);
  const nachFrist = S.plusTageIso(S.kuendigungSpaetestens(ende24, 3), 1);
  const lv = await F.firmaStundenlauf(berlin(nachFrist));
  const mz = (await sqlPool`SELECT COUNT(*)::int AS n FROM fiaon_global_angebot_teile WHERE angebot_id = ${id} AND faelligkeit = 'monatlich' AND entfallen_am IS NULL`) as any[];
  // Der Stundenlauf zählt über ALLE angenommenen Firmenangebote der Kopie — maßgeblich sind die Teile DIESES Angebots.
  ok(lv.verlaengert >= 1 && mz[0].n === 36, "Kündigungsfrist ohne Kündigung verstrichen → zwölf Monate mehr (36)", { lv, n: mz[0].n });
  const kd = await F.firmaKuendigung(id, { am: nachFrist }, "Prüfstand", { heute: nachFrist });
  ok(kd.ok && (kd as any).zum === S.laufzeitEnde(start, 36), `Kündigung nach der Frist wirkt zum Ende der Verlängerung (${S.firmaTag(S.laufzeitEnde(start, 36))})`, kd);
  const lv2 = await F.firmaStundenlauf(berlin(S.plusTageIso(S.kuendigungSpaetestens(S.laufzeitEnde(start, 36), 3), 1)));
  const mz2 = (await sqlPool`SELECT COUNT(*)::int AS n FROM fiaon_global_angebot_teile WHERE angebot_id = ${id} AND faelligkeit = 'monatlich' AND entfallen_am IS NULL`) as any[];
  ok(mz2[0].n === 36, "nach der Kündigung keine weitere Verlängerung", { lv2, n: mz2[0].n });

  titel("J. PDFs über den Kundenlink, Liste der Leitung, Routen");
  for (const art of ["vertrag", "anlage1", "pruefbericht"]) {
    const r = await fetch(`${BASIS}/api/fiaon/global/angebot/${encodeURIComponent(token)}/${art}.pdf`, { headers: { "user-agent": UA, "x-forwarded-for": IP } });
    const buf = Buffer.from(await r.arrayBuffer());
    ok(r.status === 200 && r.headers.get("content-type") === "application/pdf" && buf.length > 5000 && buf.subarray(0, 4).toString() === "%PDF", `${art}.pdf über den Kundenlink`, { status: r.status, len: buf.length });
  }
  const nachAnnahme = await lesen();
  ok(nachAnnahme.body.status === "angenommen" && nachAnnahme.body.art === "firma" && nachAnnahme.body.auftragRef === ref1, "Kundenlink nach der Annahme: dieselbe Antwort wie E-268 (art „firma“)", nachAnnahme.body.status);
  const liste = await A.angebotListe();
  const e = liste.find((x: any) => x.id === id) as any;
  ok(e?.art === "firma" && e.teile.length >= 30 && e.knoepfe && "umsatz" in e.knoepfe && e.garantie.erstattungCents === 690000 && e.freigaben?.kuendigung?.zum, "Liste der Leitung: art „firma“, Teile, Knöpfe, Garantie, Kündigung", e && { art: e.art, teile: e.teile.length, knoepfe: e.knoepfe });
  ok(e?.versandSperre === null && !!e?.freigaben?.anwalt?.textHash && e.teile.some((t: any) => t.schuldner === "gesellschafter" && /Gesellschafter/.test(String(t.rechnungKnopf))), "Liste: Freigabe passt zur Fassung (frei); Gesellschafter-Teil ohne Rechnungsknopf", { sperre: e?.versandSperre });
  const fa1 = await F.firmaFreigabeAnwalt(id, { name: "Kanzlei Prüfstand", am: heute }, "Prüfstand");
  ok(fa1.ok, "Freigabe Anwalt eintragbar", fa1);
  const ohneAnmeldung = await fetch(`${BASIS}/api/fiaon/admin/global/angebote/${id}/firma/umsatz`, { method: "POST", headers: { "content-type": "application/json", "user-agent": UA }, body: "{}" });
  ok([401, 403].includes(ohneAnmeldung.status), "Leitungsroute ohne Anmeldung gesperrt", ohneAnmeldung.status);
  const meilenstein = await A.angebotMeilenstein(id, { art: "kapital" }, "Prüfstand");
  ok(!meilenstein.ok && /Firmenangebot/.test((meilenstein as any).error), "Knöpfe des Individualangebots lehnen ein Firmenangebot ab", meilenstein);

  titel("K. Nachbesserung: Meldungen zählen einmal, Ende der Beteiligung, Cent-Felder, Storno");
  {
    const jj = jahr0 + 1;
    const uj2 = await F.firmaUmsatz(id, { jahr: jj, quartal: "jahr", kumuliert: "850.000,00", beleg: "Jahresabschluss Prüfstand, zweiter Klick" }, "Prüfstand", { heute: `${jahr0 + 2}-03-02` });
    ok(!uj2.ok && (uj2 as any).status === 409, "Jahresabgleich ein zweites Mal → 409 (keine zweite Gutschrift)", uj2);
    const q0 = await F.firmaUmsatz(id, { jahr: jahr0 + 2, quartal: 1, kumuliert: "100.000,00", beleg: "UVA Prüfstand Q1 null" }, "Prüfstand", { heute: `${jahr0 + 2}-04-20` });
    const q0b = await F.firmaUmsatz(id, { jahr: jahr0 + 2, quartal: 1, kumuliert: "900.000,00", beleg: "UVA Prüfstand Q1 nochmal" }, "Prüfstand", { heute: `${jahr0 + 2}-04-21` });
    ok(q0.ok && (q0 as any).rechnungCents === 0 && !q0b.ok && (q0b as any).status === 409, "Quartal ohne Beteiligung zählt trotzdem: dieselbe Meldung zweimal → 409", { q0, q0b });
    const cents = await F.firmaUmsatz(id, { jahr: jahr0 + 2, quartal: 2, kumuliertCents: "70000000", beleg: "UVA Prüfstand Q2 Text in Cent" }, "Prüfstand", { heute: `${jahr0 + 2}-07-20` });
    ok(!cents.ok && (cents as any).status === 400 && /ganze Zahl in Cent/.test((cents as any).error), "kumuliertCents als Text → 400 (nicht als Euro umgedeutet)", cents);
    const [frz] = (await sqlPool`SELECT freigaben FROM fiaon_global_angebote WHERE id = ${id}`) as any[];
    const fr = typeof frz.freigaben === "string" ? JSON.parse(frz.freigaben) : frz.freigaben;
    const ende = S.umsatzBeteiligungEnde(fr, false);
    ok(!!ende && ende === S.quartalsEnde(fr.kuendigung.zum), "Ende der Umsatzbeteiligung = Quartalsende nach dem Vertragsende (keine Bürgschaft)", { ende, zum: fr?.kuendigung?.zum });
    if (ende) {
      const nachEnde = S.plusTageIso(ende, 1); const nj = Number(nachEnde.slice(0, 4)); const nq = Math.floor((Number(nachEnde.slice(5, 7)) - 1) / 3) + 1;
      const spaet = await F.firmaUmsatz(id, { jahr: nj, quartal: nq, kumuliert: "999.000,00", beleg: "UVA nach dem Ende" }, "Prüfstand", { heute: S.plusTageIso(S.quartalsEnde(nachEnde), 20) });
      ok(!spaet.ok && (spaet as any).status === 409 && /endete/.test((spaet as any).error), "Meldung nach dem Ende der Umsatzbeteiligung → 409", spaet);
    }
    // Storno: offene Teile entfallen, der Stundenlauf stellt keine Rechnung mehr.
    const { globalAuftragStornieren } = await import("../server/lib/fiaon-global-storno");
    const st = await globalAuftragStornieren(ref1, { grund: "Prüfstand: Storno des Firmenauftrags, keine Erstattung (Testdaten).", erstattung: false }, "Prüfstand");
    const offenNach = (await sqlPool`SELECT COUNT(*)::int AS n FROM fiaon_global_angebot_teile WHERE angebot_id = ${id} AND nr > 1 AND bestell_ref IS NULL AND entfallen_am IS NULL`) as any[];
    ok(st.ok && offenNach[0].n === 0, "Storno: alle Teile ohne Rechnung entfallen", { st, offen: offenNach[0].n });
    const vorRech = (await sqlPool`SELECT COUNT(*)::int AS n FROM fiaon_global_angebot_teile WHERE angebot_id = ${id} AND bestell_ref IS NOT NULL`) as any[];
    await F.firmaStundenlauf(berlin(S.monatFaelligAm(start, 6)));
    const nachRech = (await sqlPool`SELECT COUNT(*)::int AS n FROM fiaon_global_angebot_teile WHERE angebot_id = ${id} AND bestell_ref IS NOT NULL`) as any[];
    ok(nachRech[0].n === vorRech[0].n, "nach dem Storno: Stundenlauf stellt keine Monatsrechnung mehr", { vor: vorRech[0].n, nach: nachRech[0].n });
    const [tm] = (await sqlPool`SELECT id FROM fiaon_global_angebot_teile WHERE angebot_id = ${id} AND faelligkeit = 'monatlich' AND bestell_ref IS NULL ORDER BY nr LIMIT 1`) as any[];
    if (tm) { const rj = await F.firmaTeilJetztBerechnen(id, Number(tm.id), "Prüfstand"); ok(!rj.ok, "nach dem Storno: auch „Rechnung jetzt stellen“ lehnt ab", rj); }
  }
  titel("L. Mail-Protokoll: nichts Automatisches an die Kundin");
  {
    const zeilen = (await sqlPool`
      SELECT event, status, grund, ausgeloest_von FROM fiaon_mail_log
       WHERE LOWER(empfaenger) = ${email} AND COALESCE(ausgeloest_von, '') NOT LIKE 'Prüfstand%'`) as any[];
    const leck = zeilen.filter((z) => !/E-301/.test(String(z.grund ?? "")));
    ok(leck.length === 0, `jede automatische Mail an die Firmenkundin hielt die Wand E-301 an (${zeilen.length} Versuche, alle gesperrt)`, leck.map((z) => `${z.event}: ${String(z.grund ?? "").slice(0, 80)}`));
  }
  titel("M. Gegenprüfung 08.10.2026: ohne „Shop live“ — Fristende, spätester Starttag, Kündigung aus wichtigem Grund");
  {
    // Zwei frische Angebote (Musterfirma, eigene Adressen), angenommen über die echte Route — keines bekommt „Shop live“.
    // M1: Fund 2 (Fristende und spätester Starttag ohne Starttag). M2: Fund 3 (Kündigung aus wichtigem Grund vor dem Starttag).
    const berlinM = (tag: string) => new Date(`${tag}T10:00:00+02:00`);
    const anlegenUndAnnehmen = async (kennung: string, ip: string) => {
      const mail = `pruef+${kennung}-${lauf}@musterfirma-beispiel.example`;
      const an = await F.firmaAnlegen({ fassung: S.FIRMA_FASSUNG, kunde: { ...KUNDE, email: mail }, buergin: BUERGIN_VOLL, parameter: PARAMETER, compliance: COMPLIANCE_ROH }, "Prüfstand");
      if (!an.ok) return { id: 0, ref: "", auftragRef: "", fehler: an };
      const tok = decodeURIComponent(new URL(an.link).pathname.split("/").pop() ?? "");
      const si = await fetch(`${BASIS}/api/fiaon/global/angebot/${encodeURIComponent(tok)}`, { headers: { "user-agent": UA, "x-forwarded-for": ip } }).then((r) => r.json()) as any;
      const r = await fetch(`${BASIS}/api/fiaon/global/angebot/${encodeURIComponent(tok)}/annehmen`, { method: "POST", headers: { "content-type": "application/json", "user-agent": UA, "x-forwarded-for": ip }, body: JSON.stringify({ textHash: si.textHash, unternehmer: true, vertretung: true, unterschrift: { art: "getippt", name: "Martina Muster" } }) });
      const j = await r.json() as any;
      return { id: an.id, ref: an.ref, auftragRef: String(j.auftragRef ?? ""), fehler: r.status === 200 && j.ok ? null : { status: r.status, j, bereit: si.annahmeBereit, grund: si.gesperrtGrund } };
    };
    const ipM = (x: number) => `84.116.${20 + x}.${10 + Math.floor(Math.random() * 200)}`;
    const m1 = await anlegenUndAnnehmen("m1", ipM(1)); const m2 = await anlegenUndAnnehmen("m2", ipM(2));
    ok(!m1.fehler && !m2.fehler && !!m1.auftragRef && !!m2.auftragRef, "zwei Angebote (Fassung D) angelegt und angenommen — ohne „Shop live“", { m1: m1.fehler, m2: m2.fehler });
    const fe = S.garantieFristEnde(heute, 3); const sp = S.budgetSpaetesterStart(heute, PARAMETER);
    const zeile = async (aid: number) => { const [x] = (await sqlPool`SELECT schalter, freigaben, frist_ende, frist_abgelaufen_am, erstattung_ausgeloest_am FROM fiaon_global_angebote WHERE id = ${aid}`) as any[]; const j = (v: any) => (typeof v === "string" ? JSON.parse(v) : v ?? {}); return { ...x, schalter: j(x?.schalter), freigaben: j(x?.freigaben) }; };
    const aufgabe = async (schl: string) => (await sqlPool`SELECT id, status, text FROM fiaon_betreiber_todos WHERE schluessel = ${schl}`) as any[];
    const monateVon = async (aid: number) => ((await sqlPool`SELECT COUNT(*)::int AS n FROM fiaon_global_angebot_teile WHERE angebot_id = ${aid} AND faelligkeit = 'monatlich'`) as any[])[0].n;
    const z1 = await zeile(m1.id);
    ok(fa(z1.frist_ende) === fe && !z1.schalter.starttag && (await monateVon(m1.id)) === 0, `M1: Garantiefrist bis ${S.firmaTag(fe)}, kein Starttag, keine Monatsteile`, { fe: fa(z1.frist_ende), starttag: z1.schalter.starttag });

    // ── Fund 3 (M2): Gründung bezahlt (nur Prüfstand-Kopie), dann Kündigung VOR dem Starttag ──
    await sqlPool`UPDATE fiaon_applications SET payment_status = 'paid', completed_at = NOW() WHERE ref = ${m2.auftragRef}`;
    const ord = await F.firmaKuendigung(m2.id, { am: heute, art: "ordentlich" }, "Prüfstand");
    ok(!ord.ok && (ord as any).status === 409 && /Starttag/.test((ord as any).error ?? ""), "M2: ordentliche Kündigung vor „Shop live“ → 409 (Laufzeit zählt erst ab dem Starttag)", ord);
    const ausser = await F.firmaKuendigung(m2.id, { am: heute, art: "ausserordentlich", seite: "auftraggeberin" }, "Prüfstand");
    const z2 = await zeile(m2.id);
    ok(ausser.ok && (ausser as any).zum === heute && /Vor dem Starttag/.test((ausser as any).meldung) && z2.freigaben.kuendigung?.art === "ausserordentlich" && z2.freigaben.kuendigung?.garantieEntfaellt === true && (await monateVon(m2.id)) === 0,
      "M2: Kündigung aus wichtigem Grund vor dem Starttag → eingetragen, keine Monatsteile", { ausser, k: z2.freigaben.kuendigung });
    const nochmal = await F.firmaKuendigung(m2.id, { am: heute, art: "ausserordentlich" }, "Prüfstand");
    ok(!nochmal.ok && (nochmal as any).status === 409 && /Schon eingetragen/.test((nochmal as any).error ?? ""), "M2: zweite Kündigung aus wichtigem Grund → 409", nochmal);
    const slK = await F.firmaShopLive(m2.id, { am: heute }, "Prüfstand");
    const slSp = await F.firmaShopLive(m2.id, { art: "spaetestens" }, "Prüfstand", { heute: sp });
    ok(!slK.ok && (slK as any).status === 409 && /gekündigt/.test((slK as any).error ?? "") && !slSp.ok && (slSp as any).status === 409 && !(await zeile(m2.id)).schalter.starttag && (await monateVon(m2.id)) === 0,
      "M2: „Shop live“ und „Spätester Starttag“ nach der Kündigung → 409, kein Starttag, keine Monatsteile", { slK, slSp });
    const gfK = await F.firmaGarantiefall(m2.id, "Prüfstand", { heute: S.plusTageIso(fe, 1) });
    ok(!gfK.ok && (gfK as any).status === 409 && /entfallen/.test((gfK as any).error ?? "") && !(await zeile(m2.id)).erstattung_ausgeloest_am, "M2: nach dem Fristende kein Garantiefall — die Kündigung aus wichtigem Grund vor dem Fristende lässt die Garantie entfallen (Ziffer 14 Absatz 3)", gfK);

    // ── Fund 2 (M1): Stundenlauf ohne Starttag — Fristende ──
    const schFrist1 = `global:${m1.ref}:garantie-fristende`; const schFrist2 = `global:${m2.ref}:garantie-fristende`;
    await F.firmaStundenlauf(berlinM(fe));
    ok(!(await zeile(m1.id)).frist_abgelaufen_am && (await aufgabe(schFrist1)).length === 0, "Lauf am Fristende selbst: noch nichts (erst am Tag danach)");
    const lf = await F.firmaStundenlauf(berlinM(S.plusTageIso(fe, 1)));
    const nachFrist1 = await zeile(m1.id); const a1 = await aufgabe(schFrist1);
    ok(lf.fristende >= 2 && !!nachFrist1.frist_abgelaufen_am && a1.length === 1 && a1[0].status === "offen" && /Garantiefall/.test(String(a1[0].text)), "M1 ohne „Shop live“, Lauf am Tag nach dem Fristende: frist_abgelaufen_am gesetzt + Aufgabe „Garantiefrist abgelaufen“", { lf, abgelaufen: nachFrist1.frist_abgelaufen_am, aufgaben: a1.length });
    const a2 = await aufgabe(schFrist2);
    ok(a2.length === 1 && /ACHTUNG/.test(String(a2[0].text)) && /entfallen/.test(String(a2[0].text)), "M2 (gekündigt): Aufgabe zum Fristende sagt, dass die Garantie entfallen ist", String(a2[0]?.text ?? "").slice(-220));
    await sqlPool`UPDATE fiaon_betreiber_todos SET status = 'erledigt', erledigt_am = NOW() WHERE schluessel = ${schFrist1}`;
    await F.firmaStundenlauf(berlinM(S.plusTageIso(fe, 2)));
    const b1 = await aufgabe(schFrist1); const nach2 = await zeile(m1.id);
    ok(b1.length === 1 && b1[0].status === "erledigt" && String(b1[0].text) === String(a1[0].text) && String(nach2.frist_abgelaufen_am) === String(nachFrist1.frist_abgelaufen_am), "zweiter Lauf: keine zweite Aufgabe (die erledigte bleibt erledigt, Text unverändert)", { status: b1[0]?.status });

    // ── Fund 2 (M1): spätester Starttag erreicht, kein Starttag → EINE Erinnerung ──
    const schSp1 = `global:${m1.ref}:spaetester-starttag`; const schSp2 = `global:${m2.ref}:spaetester-starttag`;
    await F.firmaStundenlauf(berlinM(S.plusTageIso(sp, -1)));
    ok(!(await zeile(m1.id)).schalter.spaetesterStartErinnertAm && (await aufgabe(schSp1)).length === 0, "Tag vor dem spätesten Starttag: keine Erinnerung");
    const ls = await F.firmaStundenlauf(berlinM(sp));
    const e1 = await aufgabe(schSp1); const zs = await zeile(m1.id);
    ok(ls.starttagErinnert >= 1 && zs.schalter.spaetesterStartErinnertAm === sp && e1.length === 1 && e1[0].status === "offen" && /Spätester Starttag/.test(String(e1[0].text)) && !zs.schalter.starttag && (await monateVon(m1.id)) === 0,
      `am spätesten Starttag (${S.firmaTag(sp)}): Aufgabe an die Leitung, Marke im Schalter — der Starttag selbst bleibt der Leitung überlassen`, { ls, marke: zs.schalter.spaetesterStartErinnertAm, aufgaben: e1.length });
    await sqlPool`UPDATE fiaon_betreiber_todos SET status = 'erledigt', erledigt_am = NOW() WHERE schluessel = ${schSp1}`;
    await F.firmaStundenlauf(berlinM(S.plusTageIso(sp, 1)));
    const e2 = await aufgabe(schSp1);
    ok(e2.length === 1 && e2[0].status === "erledigt" && (await zeile(m1.id)).schalter.spaetesterStartErinnertAm === sp, "zweiter Lauf danach: keine zweite Erinnerung", { status: e2[0]?.status });
    ok((await aufgabe(schSp2)).length === 0 && !(await zeile(m2.id)).schalter.spaetesterStartErinnertAm, "M2 (gekündigt): keine Erinnerung an den spätesten Starttag");
    // Danach trägt die Leitung den spätesten Starttag ein — der Weg bleibt offen (M1 ist nicht gekündigt).
    const spM1 = await F.firmaShopLive(m1.id, { art: "spaetestens" }, "Prüfstand", { heute: sp });
    ok(spM1.ok && (spM1 as any).starttag === sp && (spM1 as any).monate === 24, "M1: „Spätester Starttag“ danach eintragbar → Starttag, vierundzwanzig Monatsteile", spM1);
  }
  await sqlPool.end();
  fs.rmSync(tmp, { recursive: true, force: true });
}

if (warnungen) console.log(`\n${warnungen} Warnung(en) — betreffen nicht diesen Bau, aber das Repo (siehe WARNUNG oben).`);
console.log(`\n${n} Prüfungen, ${fehler} Fehler.`);
process.exit(fehler ? 1 : 0);
