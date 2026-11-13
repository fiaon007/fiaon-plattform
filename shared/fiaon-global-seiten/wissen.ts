// ═══════════════════════════════════════════════════════════════════════════
// FIAON GLOBAL — WISSEN (19.09.2026, E-191)
// Die Übersicht und sechs Beiträge. Sie beantworten, wonach Unternehmer vor
// einer US-Gründung suchen („llc steuern", „llc oder corporation", „llc vs
// gmbh", „form 5472", „welcher bundesstaat", „llc seriös") — ehrlich, mit
// Quellen, ohne Steuerversprechen. Autor ist die Redaktion von FIAON Global;
// keine erfundene Person (bei Geld- und Steuerthemen zählt, wer spricht).
// Seit 19.09.2026 (Justin): Die US-Gesellschaft ist ein Werkzeug für Geschäft in
// den USA UND für Kapital, das nicht an die USA gebunden ist (GLOBAL_KAPITAL_FREI)
// — ein Steuermodell ist sie weiterhin nicht.
// ═══════════════════════════════════════════════════════════════════════════
import { GLOBAL_KAPITAL_FREI, GLOBAL_PFLICHTHINWEIS, GLOBAL_ROLLEN, globalPreisText } from "../fiaon-global";
// E-509 (12.11.2026): EIN Produkt statt vier Pakete — der Satz zu den Partnern ohne „Paket“.
import { EIN_PRODUKT } from "./ein-produkt";
// E-510 (13.11.2026, Sprachleitfaden): feste Sätze aus der einen Quelle (S2: Anträge, Konto und Karte).
import { SCHRITTE_KOPF, SECHS_SCHRITTE, beleg, satz } from "../fiaon-global-saetze";
import { GLOBAL_VERBUNDEN } from "../fiaon-global-partner";
import { FAKTEN_STAND, IRS, QUELLEN_IRS, QUELLEN_STAATEN } from "./fakten";
import type { GlobalSeite } from "./typen";
import { bundesstaatWahlSeite } from "./bundesstaat-wahl";

/** Tag der letzten inhaltlichen Änderung (E-510, Sprachleitfaden). Erstveröffentlichung dieser Seiten: 19.09.2026 (Standard des Registers, Feld „erschienen“ fehlt). */
const S = "2026-11-13";
// Zweite Runde Sprachleitfaden (Wissens-Artikel): Jeder Beitrag erklärt und stimmt ohne uns. Über uns steht je Beitrag genau
// ein Absatz am Ende („Was FIAON Global dabei übernimmt“, mit „Ihr Teil“ und „Bedingung“) — gebaut aus den festen Sätzen.
/** Schritt eins der festen Erzählung (Gründung) und die Namen seiner Teile — wortgleich aus der einen Quelle. */
const [GRUENDUNG] = SECHS_SCHRITTE.de;
const TEIL = SCHRITTE_KOPF.de.teile;
/** Überschrift des einen Absatzes über uns. */
const FIAON_TITEL = "Was FIAON Global dabei übernimmt";
/** Zuständigkeit für Steuerfragen — als Rolle, nie als Tätigkeit eines Partners. */
const STEUERFRAGEN = "Steuerfragen liegen bei Partner-Steuerberatern, die in eigener Verantwortung arbeiten.";
/** Der zweite Satz des Rollen-Satzes: wer die Honorare der Partner trägt. */
const [, HONORARE_DER_PARTNER] = EIN_PRODUKT.de.partner.split(/(?<=\.)\s+/);
/** Der Absatz über uns in den beiden Rechtsform-Beiträgen: Gründung, Ihr Teil, Bedingung, Zuständigkeit für Steuerfragen. */
const FIAON_GRUENDUNG = `${FIAON_TITEL}: ${GRUENDUNG.satz} ${TEIL.ihrTeil}: ${GRUENDUNG.ihrTeil} ${TEIL.bedingung}: ${GRUENDUNG.bedingung} ${STEUERFRAGEN}`;
/** Die festen Sätze zu Anträgen, Konto und Karte und zum Steuermodell — je einmal geholt, überall wortgleich. */
const ANTRAEGE = satz("S2");
const KEIN_STEUERMODELL = satz("S10");
const QUELLE_AO10 = { titel: "§ 10 AO — Geschäftsleitung", url: "https://www.gesetze-im-internet.de/ao_1977/__10.html" };
const QUELLE_AO138 = { titel: "§ 138 AO — Anzeigen über die Erwerbstätigkeit", url: "https://www.gesetze-im-internet.de/ao_1977/__138.html" };
const QUELLE_KSTG1 = { titel: "§ 1 KStG — Unbeschränkte Steuerpflicht", url: "https://www.gesetze-im-internet.de/kstg_1977/__1.html" };
const QUELLE_BMF = { titel: "BMF-Schreiben vom 19.03.2004 zur US-LLC (KStH 2022, Anlage 10)", url: "https://usth.bundesfinanzministerium.de/ksth/2022/B-Anlagen/Anlage-10/inhalt.html" };
const QUELLE_DBG50 = { titel: "Art. 50 DBG — Persönliche Zugehörigkeit", url: "https://www.fedlex.admin.ch/eli/cc/1991/1184_1184_1184/de#art_50" };
const QUELLE_ASTG = { titel: "§ 7 AStG — Hinzurechnungsbesteuerung", url: "https://www.gesetze-im-internet.de/astg/__7.html" };
const QUELLE_GMBHG5 = { titel: "§ 5 GmbHG — Stammkapital", url: "https://www.gesetze-im-internet.de/gmbhg/__5.html" };
const QUELLE_I1120 = { titel: "IRS — Instructions for Form 1120", url: "https://www.irs.gov/instructions/i1120" };
// 27.10.2026: Österreich als vollwertige Spalte in „Was wo gilt“ (/business/wissen/us-llc-steuern) — Wortlaut
// am 27.10.2026 im RIS, in der Findok des BMF und in der Fedlex (DBG, Stand 02.09.2026) nachgelesen.
const RIS = "https://www.ris.bka.gv.at/NormDokument.wxe?Abfrage=Bundesnormen";
const QUELLE_BAO27 = { titel: "§ 27 BAO (Österreich) — Sitz und Ort der Geschäftsleitung", url: `${RIS}&Gesetzesnummer=10003940&Paragraf=27` };
const QUELLE_KSTG_AT1 = { titel: "§ 1 KStG 1988 (Österreich) — Unbeschränkte Steuerpflicht", url: `${RIS}&Gesetzesnummer=10004569&Paragraf=1` };
const QUELLE_EAS1159 = { titel: "BMF Österreich, EAS 1159 vom 31.10.1997 — Typenvergleich bei der US-LLC", url: "https://findok.bmf.gv.at/findok/resources/pdf/09ba647c-ba5c-473d-a01f-1bcf7b2fbf89/14179.1.X.X.pdf" };
const QUELLE_BAO120 = { titel: "§ 120 BAO (Österreich) — Anzeigepflichten", url: `${RIS}&Gesetzesnummer=10003940&Paragraf=120` };
const QUELLE_BAO121 = { titel: "§ 121 BAO (Österreich) — Frist der Anzeigen", url: `${RIS}&Gesetzesnummer=10003940&Paragraf=121` };
const QUELLE_KSTG_AT10A = { titel: "§ 10a KStG 1988 (Österreich) — Passiveinkünfte niedrigbesteuerter Körperschaften", url: `${RIS}&Gesetzesnummer=10004569&Paragraf=10a` };
const QUELLE_DBG49 = { titel: "Art. 49 DBG — Juristische Personen, Gleichstellung ausländischer", url: "https://www.fedlex.admin.ch/eli/cc/1991/1184_1184_1184/de#art_49" };
const QUELLE_DBG52 = { titel: "Art. 52 DBG — Umfang der Steuerpflicht", url: "https://www.fedlex.admin.ch/eli/cc/1991/1184_1184_1184/de#art_52" };
const QUELLE_DBG124 = { titel: "Art. 124 DBG — Steuererklärung", url: "https://www.fedlex.admin.ch/eli/cc/1991/1184_1184_1184/de#art_124" };

export const WISSEN: GlobalSeite[] = [
  // ─────────────────────────────────────────────────────────────────────────
  {
    pfad: "/business/wissen",
    art: "hub",
    seo: {
      titel: "Ratgeber US-Gesellschaft: LLC, EIN, Konto — FIAON Global",
      beschreibung: "28 Beiträge zur US-Gesellschaft: LLC, EIN und ITIN, Anschrift, Konto, Credit Score, Firmenkreditkarten, Finanzierung, Steuern — mit Quellen und Stand.",
    },
    // 23.09.2026 (E-232): zehn Praxis-Beiträge dazu (wissen-gruendung.ts, wissen-konto-karten.ts), nach Themen geordnet.
    // 13.11.2026 (E-510): Wortlaut nach Sprachleitfaden — „mit Quellen und Stand“ statt Beteuerung, „Finanzierung“ statt Jargon.
    stand: "2026-11-13",
    kennung: "FG · 22",
    auge: "Wissen",
    h1: "Wissen vor der Gründung.",
    h1b: "Mit Quellen und Stand.",
    lead: "Die Beiträge erklären die US-Gesellschaft für Unternehmer aus Deutschland, Österreich und der Schweiz: Gründung, Steuernummern und laufende Pflichten. Jeder Beitrag nennt seine Quellen, seinen Stand und die Grenzen der Rechtsform.",
    ziffern: [
      { wert: "28 Beiträge", label: "Gründung, Steuernummern, Konto, Karten, Finanzierung, Steuern" },
      { wert: "3 Staaten", label: "Delaware, Florida, Wyoming" },
      { wert: FAKTEN_STAND, label: "Stand aller Zahlen" },
    ],
    blick: [
      ["Gründung", "Die Anleitung in zehn Schritten, Bundesstaat, Rechtsform, Struktur"],
      ["Steuernummern", "EIN ohne SSN, ITIN mit Form W-7"],
      ["US-Präsenz", "Registered Agent, Geschäftsadresse, Telefonnummer"],
      ["Konto und Karten", "Unterlagen, Credit Score, Business Credit, Firmenkreditkarten, Finanzierung, Immobilien"],
      ["Steuern", "Steuerpflicht im Wohnsitzland, Form 5472, die US-Steuererklärung"],
      ["Anbieter", "Die Prüfliste in acht Punkten"],
      ["Redaktion", "FIAON Global — Quellen am Ende jedes Beitrags"],
    ],
    kurz: `Eine US-Gesellschaft dient dem Geschäft in den USA und der Finanzierung Ihres Vorhabens. ${GLOBAL_KAPITAL_FREI.de.satz} ${GLOBAL_KAPITAL_FREI.de.steuer} ${KEIN_STEUERMODELL} Wird die Gesellschaft aus dem Wohnsitzland geführt, ist sie in der Regel dort steuerpflichtig. Sie melden die Gründung dem Finanzamt; in den USA gibt die Gesellschaft jährlich Form 5472 ab. Die Beiträge erklären den Ablauf von der Gründung bis zur Steuererklärung.`,
    bloecke: [
      {
        typ: "verzeichnis", id: "gruendung", h2: "Vor der Gründung",
        eintraege: [
          { pfad: "/business/wissen/llc-gruenden", tag: "Anleitung" },
          { pfad: "/business/wissen/bundesstaat-waehlen", tag: "Bundesstaat" },
          { pfad: "/business/wissen/llc-oder-corporation", tag: "Rechtsform" },
          { pfad: "/business/wissen/llc-oder-gmbh", tag: "Rechtsform" },
          { pfad: "/business/wissen/tochter-oder-zweigniederlassung", tag: "Struktur" },
          { pfad: "/business/wissen/anbieter-pruefen", tag: "Anbieter" },
          { pfad: "/business/wissen/markteintritt-usa", tag: "Markteintritt" },
          { pfad: "/business/wissen/nachteile-us-llc", tag: "Abwägung" },
        ],
      },
      {
        typ: "verzeichnis", id: "steuernummern", h2: "Steuernummern und US-Präsenz",
        eintraege: [
          { pfad: "/business/wissen/ein-beantragen", tag: "Steuernummer" },
          { pfad: "/business/wissen/itin-beantragen", tag: "Steuernummer" },
          { pfad: "/business/wissen/registered-agent-adresse", tag: "US-Präsenz" },
          { pfad: "/business/wissen/us-adresse-und-telefon", tag: "US-Präsenz" },
        ],
      },
      {
        typ: "verzeichnis", id: "konto-karten", h2: "Konto, Bonität, Karten und Finanzierung",
        eintraege: [
          { pfad: "/business/wissen/us-bankkonto-unterlagen", tag: "Konto" },
          { pfad: "/business/wissen/us-bonitaet-aufbauen", tag: "Bonität" },
          { pfad: "/business/wissen/business-credit-usa", tag: "Firmenbonität" },
          { pfad: "/business/wissen/us-firmenkarte-beantragen", tag: "Firmenkreditkarten" },
          { pfad: "/business/wissen/finanzierungswege-usa", tag: "Finanzierung" },
          { pfad: "/business/wissen/us-immobilie-finanzieren", tag: "Immobilien" },
        ],
      },
      {
        typ: "verzeichnis", id: "funding", h2: "Finanzierung in den USA",
        eintraege: [
          { pfad: "/business/wissen/us-funding", tag: "Überblick" },
          { pfad: "/business/wissen/kreditkarten-stacking", tag: "Warnzeichen" },
          { pfad: "/business/wissen/sba-kredit-auslaender", tag: "SBA" },
        ],
      },
      {
        typ: "verzeichnis", id: "steuern", h2: "Steuern und Pflichten",
        eintraege: [
          { pfad: "/business/wissen/us-llc-steuern", tag: "Steuern" },
          { pfad: "/business/wissen/llc-steuererklaerung", tag: "Steuererklärung" },
          { pfad: "/business/wissen/form-5472", tag: "Meldepflicht" },
          { pfad: "/business/wissen/us-llc-wohnsitz-deutschland", tag: "Deutschland" },
        ],
      },
      {
        typ: "verzeichnis", id: "praxis", h2: "Verkaufen, Visum, Bestand",
        eintraege: [
          { pfad: "/business/wissen/amazon-stripe-paypal-llc", tag: "Plattformen" },
          { pfad: "/business/wissen/e2-visum", tag: "Visum" },
          { pfad: "/business/wissen/llc-retten-oder-aufloesen", tag: "Bestand" },
        ],
      },
      {
        typ: "verzeichnis", id: "staaten", h2: "Die Bundesstaaten",
        eintraege: [
          { pfad: "/business/florida", tag: "Bundesstaat" },
          { pfad: "/business/delaware", tag: "Bundesstaat" },
          { pfad: "/business/wyoming", tag: "Bundesstaat" },
        ],
      },
      {
        typ: "verzeichnis", id: "laender", h2: "Nach Herkunftsland",
        eintraege: [
          { pfad: "/business/aus-deutschland", tag: "Deutschland" },
          { pfad: "/business/aus-der-schweiz", tag: "Schweiz" },
          { pfad: "/business/aus-oesterreich", tag: "Österreich" },
          { pfad: "/business/partner", tag: "Standorte" },
        ],
      },
      {
        typ: "pakete", id: "mandat", h2: EIN_PRODUKT.de.karteH2,
        lead: `Jeder Beitrag beschreibt eine Aufgabe. In einem Mandat übernimmt FIAON Global die Gründung, die Anträge für EIN und ITIN und die US-Präsenz. Im ersten Jahr enthalten sind außerdem der Pflichtenkalender und die erste jährliche US-Meldung. Zu Konto und Karten: ${ANTRAEGE} ${EIN_PRODUKT.de.partner}`,
      },
    ],
    fragen: [],
    weiter: ["/business/us-firmengruendung", "/business/kosten", "/business/fragen", "/business/ablauf"],
  },

  // ─────────────────────────────────────────────────────────────────────────
  {
    pfad: "/business/wissen/us-llc-steuern",
    art: "wissen",
    seo: {
      titel: "US-LLC und Steuern: Was wo gilt — FIAON Global",
      beschreibung: "US-LLC und Steuern: wo die Gesellschaft steuerpflichtig ist, wie das Finanzamt sie einordnet und welche Meldepflichten gelten. Mit Quellen und Stand.",
    },
    // 27.10.2026: Tabelle „Was wo gilt“ mit Österreich als eigener Spalte (Quellen RIS, Findok, Fedlex).
    // 13.11.2026 (E-510): Wortlaut nach Sprachleitfaden; Steuerfragen klären Partner-Steuerberater in eigener Verantwortung.
    stand: "2026-11-13",
    kennung: "FG · 23",
    auge: "Wissen · Steuern",
    h1: "US-LLC und Steuern.",
    h1b: "In der Regel steuerpflichtig, wo sie geführt wird.",
    lead: "US-LLC und Steuern: Maßgeblich ist meist der Ort, an dem die Gesellschaft geführt wird. Für Unternehmer, die in Deutschland, Österreich oder der Schweiz leben und von dort arbeiten, liegt dieser Ort in der Regel im Wohnsitzland. Der Beitrag nennt die Regeln je Land, die Meldepflichten und den Zweck einer US-Gesellschaft.",
    ziffern: [
      { wert: "§ 10 AO", label: "Ort der Geschäftsleitung entscheidet" },
      { wert: "Art. 50 DBG", label: "tatsächliche Verwaltung in der Schweiz" },
      { wert: "Form 5472", label: "jährliche Meldung an die IRS" },
    ],
    blick: [
      ["Grundsatz", "Steuerpflichtig in der Regel dort, wo die Gesellschaft geführt wird"],
      ["Deutschland", "Ort der Geschäftsleitung (§ 10 AO), Typenvergleich, § 138 AO"],
      ["Schweiz", "Sitz oder tatsächliche Verwaltung (Art. 50 DBG)"],
      ["USA", "Meldepflicht Form 5472 auch ohne Umsatz"],
      ["Zweck", "Geschäft, Verträge, Konto und Karten in den USA"],
      ["Finanzierung", GLOBAL_KAPITAL_FREI.de.kurz],
      ["Steuerfragen", "Vor der Gründung mit einem Steuerberater klären"],
    ],
    kurz: `Eine US-LLC ist in der Regel dort steuerpflichtig, wo sie geführt wird. Wer sie vom Wohnsitzland aus führt, hat dort ihren Ort der Geschäftsleitung beziehungsweise ihre tatsächliche Verwaltung. Hinzu kommen Meldepflichten im Wohnsitzland und in den USA. ${KEIN_STEUERMODELL} Die Gesellschaft dient dem Geschäft in den USA und der Finanzierung Ihres Vorhabens. ${GLOBAL_KAPITAL_FREI.de.satz} ${GLOBAL_KAPITAL_FREI.de.steuer}`,
    bloecke: [
      {
        typ: "text", id: "mythos", h2: "Steuerliche Behandlung in den USA",
        absaetze: [
          "Eine LLC mit einem einzigen ausländischen Gesellschafter gilt in den USA steuerlich meist nicht als eigenes Steuersubjekt. Hat sie dort kein Geschäft, zahlt sie in den USA oft keine Bundessteuer auf ihren Gewinn. Staaten wie Wyoming erheben zudem keine eigene Körperschaftsteuer.",
          "Daraus entsteht die Aussage, eine US-LLC sei „steuerfrei“. Sie beschreibt nur die Rechtslage in den USA. Der Staat, in dem der Unternehmer lebt und arbeitet, wendet eigene Regeln an. Diese knüpfen an den Ort an, an dem die Gesellschaft tatsächlich geführt wird.",
        ],
      },
      {
        typ: "text", id: "deutschland", h2: "Deutschland: der Ort der Geschäftsleitung",
        absaetze: [
          "Nach § 10 AO ist die Geschäftsleitung der Mittelpunkt der geschäftlichen Oberleitung. Wer die wichtigen Entscheidungen seiner US-Gesellschaft in Deutschland trifft, hat die Geschäftsleitung in Deutschland. Eine Kapitalgesellschaft mit Geschäftsleitung im Inland ist hier unbeschränkt körperschaftsteuerpflichtig, mit allen Einkünften (§ 1 KStG).",
          "Das Finanzamt ordnet die LLC wie eine GmbH oder wie eine Personengesellschaft ein. Darüber entscheidet ein Typenvergleich nach dem Gesamtbild ihrer Merkmale (BMF-Schreiben vom 19. März 2004). Die Einordnung in den USA spielt dafür keine Rolle. Bei niedrig besteuerten, passiven Einkünften kann zudem die Hinzurechnungsbesteuerung nach dem Außensteuergesetz greifen.",
          "Hinzu kommt die Meldung nach § 138 AO. Sie teilen dem Finanzamt die Gründung oder den Erwerb der Beteiligung mit, zusammen mit der Steuererklärung.",
        ],
      },
      {
        typ: "text", id: "schweiz", h2: "Schweiz und Österreich",
        absaetze: [
          "In der Schweiz sind juristische Personen steuerpflichtig, wenn sich ihr Sitz oder ihre tatsächliche Verwaltung dort befindet (Art. 50 DBG). Wer die US-Gesellschaft von der Schweiz aus führt, muss mit der Steuerpflicht in der Schweiz rechnen.",
          "Österreich knüpft ebenfalls an den Ort der Geschäftsleitung an. In allen drei Ländern entscheidet damit derselbe Umstand: der Ort, an dem die Gesellschaft tatsächlich geführt wird.",
        ],
      },
      {
        typ: "tabelle", id: "uebersicht", h2: "Was wo gilt",
        kopf: ["", "USA", "Deutschland", "Österreich", "Schweiz"],
        zeilen: [
          ["Anknüpfung (Ort der Geschäftsleitung)", "Rechtsform und Geschäft in den USA", "Ort der Geschäftsleitung: Mittelpunkt der geschäftlichen Oberleitung (§ 10 AO)", "Ort der Geschäftsleitung: Mittelpunkt der geschäftlichen Oberleitung (§ 27 Abs. 2 BAO)", "Sitz oder tatsächliche Verwaltung in der Schweiz (Art. 50 DBG)"],
          ["Unbeschränkte Steuerpflicht der Gesellschaft", "ohne Geschäft in den USA oft keine Bundessteuer auf den Gewinn", "Geschäftsleitung oder Sitz in Deutschland: mit allen Einkünften (§ 1 KStG)", "Geschäftsleitung oder Sitz in Österreich: mit allen in- und ausländischen Einkünften (§ 1 Abs. 2 KStG 1988)", "Sitz oder tatsächliche Verwaltung in der Schweiz: unbeschränkt, aber nicht für Geschäftsbetriebe, Betriebsstätten und Grundstücke im Ausland (Art. 52 Abs. 1 DBG)"],
          ["Einordnung der LLC", "meist kein eigenes Steuersubjekt", "Typenvergleich nach dem Gesamtbild; die Einordnung in den USA zählt nicht (BMF-Schreiben vom 19.03.2004)", "Typenvergleich nach Aufbau und wirtschaftlicher Bedeutung; die Behandlung in den USA ist nicht entscheidend (BMF, EAS 1159)", "gleichgestellt der Schweizer juristischen Person, der sie rechtlich oder tatsächlich am ähnlichsten ist (Art. 49 Abs. 3 DBG)"],
          ["Meldepflicht der Beteiligung", "Form 5472 mit Form 1120, jährlich", "Gründung oder Erwerb dem Finanzamt mitteilen, mit der Steuererklärung (§ 138 Abs. 2 und 5 AO)", "Umstände anzeigen, die die persönliche Abgabepflicht begründen oder ändern, binnen einem Monat (§§ 120, 121 BAO); ob die Beteiligung dazugehört, im Einzelfall prüfen", "Steuererklärung vollständig und samt Beilagen einreichen (Art. 124 Abs. 2 DBG); eine gesonderte Meldung im Einzelfall prüfen"],
          ["Hinzurechnung niedrig besteuerter Gesellschaften", "im Einzelfall prüfen", "nur wenn die Gesellschaft weder Geschäftsleitung noch Sitz in Deutschland hat: niedrig besteuerte, passive Einkünfte beim beherrschenden Gesellschafter steuerpflichtig (§ 7 AStG)", "Passiveinkünfte niedrig besteuerter ausländischer Körperschaften werden einer beherrschenden Körperschaft hinzugerechnet (§ 10a KStG 1988); für natürliche Personen im Einzelfall prüfen", "im Einzelfall prüfen"],
          ["Wer es prüft", "US-CPA", "Steuerberater", "Steuerberater", "Treuhand oder Steuerberater"],
        ],
        fuss: [
          "Vereinfachte Übersicht; im Einzelfall entscheiden Tätigkeit, Rechtsform und Doppelbesteuerungsabkommen.",
          "Die Zeile zur unbeschränkten Steuerpflicht setzt voraus, dass die LLC als Körperschaft beziehungsweise juristische Person eingeordnet wird. Darüber entscheidet in allen drei Ländern der Vergleich mit den heimischen Rechtsformen.",
        ],
      },
      {
        typ: "karten", id: "wofuer", h2: "Wofür eine US-Gesellschaft dient", spalten: 3,
        karten: [
          { tag: "Geeignet für", titel: "Geschäft in den USA", text: "Verträge mit US-Kunden, Zahlungen in US-Dollar und getrennte Haftung. Hinzu kommen ein US-Konto und eine Zahlungshistorie in den USA. Über das Konto entscheidet das jeweilige Institut." },
          { tag: "Geeignet für", titel: "Finanzierung — auch für Europa", text: `${satz("S1")} ${GLOBAL_KAPITAL_FREI.de.satz} ${GLOBAL_KAPITAL_FREI.de.steuer}` },
          { tag: "Nicht geeignet für", titel: "Steuern im Wohnsitzland vermeiden", text: "Wird die Gesellschaft vom Wohnsitzland aus geführt, ist sie dort in der Regel steuerpflichtig. Die Aussage „steuerfrei“ lässt den Ort der Geschäftsleitung außer Acht." },
        ],
      },
      {
        typ: "hinweis", id: "wissen", h2: "Was Sie wissen müssen",
        punkte: [
          "Dieser Beitrag erklärt Grundlagen und ersetzt keine steuerliche oder rechtliche Prüfung Ihres Falls.",
          GLOBAL_PFLICHTHINWEIS.de[0],
          GLOBAL_PFLICHTHINWEIS.de[1],
          `${FIAON_TITEL}: ${STEUERFRAGEN} ${HONORARE_DER_PARTNER} ${TEIL.ihrTeil}: Ihre Steuererklärung und die Meldung im Wohnsitzland liegen bei Ihnen und Ihrem Steuerberater. ${TEIL.bedingung}: Über die Besteuerung entscheiden die US-Steuerbehörde und das Finanzamt Ihres Wohnsitzlands.`,
        ],
      },
    ],
    fragen: [
      { f: "Muss ich meine US-LLC in Deutschland versteuern?", a: "In der Regel ja, wenn Sie die Gesellschaft von Deutschland aus führen. Der Ort der Geschäftsleitung liegt dann in Deutschland (§ 10 AO). Wie das Finanzamt die LLC einordnet, entscheidet ein Typenvergleich." },
      { f: "Ist eine Wyoming-LLC „steuerfrei“?", a: "Wyoming erhebt keine eigene Körperschaftsteuer. Steuerpflichtig ist die Gesellschaft dort, wo sie geführt wird. Für Unternehmer aus Deutschland, Österreich oder der Schweiz ist das in der Regel das Wohnsitzland." },
      { f: "Warum gilt die US-LLC oft als „steuerfrei“?", a: "Eine LLC mit ausländischem Gesellschafter zahlt in den USA oft keine Bundessteuer. Das gilt für die USA. Über die Steuerpflicht im Wohnsitzland entscheidet der Ort der Geschäftsleitung." },
      { f: "Wofür eignet sich eine US-Gesellschaft?", a: `Für das Geschäft in den USA: Verträge mit US-Kunden, Zahlungen in US-Dollar und getrennte Haftung. Hinzu kommen ein US-Konto, eine Zahlungshistorie in den USA und die Finanzierung Ihres Vorhabens. Über Konto, Karte und Finanzierung entscheidet das jeweilige Institut. ${GLOBAL_KAPITAL_FREI.de.satz} ${GLOBAL_KAPITAL_FREI.de.steuer}` },
    ],
    weiter: ["/business/aus-deutschland", "/business/aus-der-schweiz", "/business/wissen/form-5472", "/business/wissen/llc-steuererklaerung"],
    quellen: [
      QUELLE_AO10, QUELLE_KSTG1, QUELLE_BMF, QUELLE_ASTG, QUELLE_AO138,
      QUELLE_BAO27, QUELLE_KSTG_AT1, QUELLE_EAS1159, QUELLE_BAO120, QUELLE_BAO121, QUELLE_KSTG_AT10A,
      QUELLE_DBG49, QUELLE_DBG50, QUELLE_DBG52, QUELLE_DBG124,
      QUELLEN_IRS[4],
    ],
  },

  // ─────────────────────────────────────────────────────────────────────────
  {
    pfad: "/business/wissen/llc-oder-corporation",
    art: "wissen",
    seo: {
      titel: "LLC oder Corporation: Was passt? — FIAON Global",
      beschreibung: "LLC oder C-Corporation im Vergleich: Haftung, Besteuerung, Investoren, Formalitäten und laufende Kosten. Mit Quellen und Stand.",
    },
    stand: S,
    kennung: "FG · 24",
    auge: "Wissen · Rechtsform",
    h1: "LLC oder Corporation.",
    h1b: "Gleiche Haftung, verschiedene Besteuerung.",
    lead: "LLC oder Corporation: Beide Rechtsformen beschränken die Haftung. Sie unterscheiden sich in der Besteuerung, in der inneren Ordnung und in der Eignung für Investoren. Die Wahl wirkt sich auf Konto und Karten, auf die Meldungen und auf spätere Beteiligungen aus.",
    ziffern: [
      { wert: IRS.koerperschaftsteuer, label: "Körperschaftsteuer des Bundes für Corporations" },
      { wert: "2 Formen", label: "beide mit beschränkter Haftung" },
      { wert: "vor der Gründung", label: "steuerliche Folgen im Wohnsitzland klären" },
    ],
    blick: [
      ["LLC", "Frei gestaltbar, in den USA meist kein eigenes Steuersubjekt"],
      ["Corporation", "Eigenes Steuersubjekt, übliche Form für Investoren"],
      ["Haftung", "Bei beiden auf das Gesellschaftsvermögen beschränkt"],
      ["Investoren", "Erwarten in der Regel eine Corporation"],
      ["Wechsel", "Später möglich, mit Aufwand in beiden Ländern"],
      ["Steuerfragen", "Vor der Gründung mit einem Steuerberater klären"],
    ],
    kurz: `LLC oder Corporation: Für Handel, Dienstleistung und eine Zahlungshistorie in den USA passt meist die LLC. Die Corporation ist die übliche Form, wenn Investoren einsteigen oder Mitarbeiter Anteile erhalten sollen. Die LLC regelt ihre innere Ordnung frei im Operating Agreement, ihrer Satzung. Mit einem ausländischen Gesellschafter ist sie in den USA meist kein eigenes Steuersubjekt. Die Corporation ist ein eigenes Steuersubjekt und zahlt auf Bundesebene ${IRS.koerperschaftsteuer} Körperschaftsteuer.`,
    bloecke: [
      {
        typ: "tabelle", id: "vergleich", h2: "LLC und Corporation im Vergleich",
        kopf: ["", "LLC", "Corporation"],
        zeilen: [
          ["Haftung", "auf das Gesellschaftsvermögen beschränkt", "auf das Gesellschaftsvermögen beschränkt"],
          ["Steuer in den USA", "mit einem ausländischen Gesellschafter meist kein eigenes Steuersubjekt", `eigenes Steuersubjekt, Bund ${IRS.koerperschaftsteuer}, dazu je nach Staat`],
          ["Innere Ordnung", "Operating Agreement, frei gestaltbar", "Satzung, Vorstand, Aktien nach festen Regeln"],
          ["Investoren", "selten", "üblich"],
          ["Mitarbeiterbeteiligung", "möglich, aber unüblich", "üblich über Aktienoptionen"],
          ["Jährliche Meldung an die IRS", "Form 5472 mit Form 1120 (als Deckblatt)", "Form 1120; ist ein Anteilseigner zu mindestens 25 % ausländisch, dazu Form 5472"],
          ["Laufende Kosten", "niedriger", "höher, etwa durch Franchise Tax in Delaware"],
        ],
        fuss: ["Vereinfachte Übersicht; die Einordnung im Wohnsitzland folgt eigenen Regeln."],
      },
      {
        typ: "karten", id: "wann", h2: "Wann welche Form passt", spalten: 2,
        karten: [
          { tag: "LLC", titel: "Handel, Dienstleistung, Zahlungshistorie", text: "Passt meist, wenn die Gesellschaft Aufträge abwickelt, Waren verkauft oder eine Zahlungshistorie in den USA aufbaut und keine Investoren geplant sind." },
          { tag: "Corporation", titel: "Investoren, Beteiligungen, Verkauf", text: "Passt meist, wenn US-Investoren einsteigen, Mitarbeiter Anteile erhalten oder das Unternehmen später verkauft werden soll." },
        ],
      },
      {
        typ: "text", id: "wechsel", h2: "Späterer Wechsel der Rechtsform",
        absaetze: [
          "Eine LLC lässt sich in eine Corporation umwandeln. Der Wechsel kostet Zeit und Gebühren; hinzu kommt die steuerliche Klärung in beiden Ländern. Deshalb gehört eine Frage vor die Gründung: wer in drei Jahren an der Gesellschaft beteiligt sein soll.",
        ],
      },
      {
        typ: "hinweis", id: "wissen", h2: "Was Sie wissen müssen",
        punkte: [
          "Die Wahl der Rechtsform hat steuerliche Folgen im Wohnsitzland. Diese Fragen gehören vor der Gründung zu einem Steuerberater.",
          GLOBAL_PFLICHTHINWEIS.de[1],
          FIAON_GRUENDUNG,
        ],
      },
    ],
    fragen: [
      { f: "Was ist der Unterschied zwischen LLC und Corporation?", a: `Beide beschränken die Haftung. Die LLC ist frei gestaltbar und mit einem ausländischen Gesellschafter in den USA meist kein eigenes Steuersubjekt. Die Corporation ist ein eigenes Steuersubjekt (Bund ${IRS.koerperschaftsteuer}) und die übliche Form für Investoren.` },
      { f: "Welche Rechtsform brauche ich für US-Investoren?", a: "In der Regel eine Corporation, oft in Delaware. Investoren in den USA kennen diese Form und erwarten sie." },
      { f: "Kann ich eine LLC später in eine Corporation umwandeln?", a: "Ja. Der Wechsel bringt Gebühren, neue Unterlagen und eine steuerliche Klärung in beiden Ländern mit sich." },
    ],
    weiter: ["/business/delaware", "/business/wissen/llc-oder-gmbh", "/business/us-firmengruendung", "/business/wissen/llc-gruenden"],
    quellen: [QUELLE_I1120, QUELLEN_IRS[4], QUELLEN_STAATEN.delaware[3]],
  },

  // ─────────────────────────────────────────────────────────────────────────
  {
    pfad: "/business/wissen/llc-oder-gmbh",
    art: "wissen",
    seo: {
      titel: "LLC oder GmbH: Der Vergleich — FIAON Global",
      beschreibung: "US-LLC oder GmbH im Vergleich: Gründung, Stammkapital, Notar, Haftung, Steuern und Pflichten. Dazu die übliche Struktur aus beiden — mit Quellen.",
    },
    stand: S,
    kennung: "FG · 25",
    auge: "Wissen · Rechtsform",
    h1: "LLC oder GmbH.",
    h1b: "Zwei Rechtsformen für zwei Märkte.",
    lead: "LLC oder GmbH: Die LLC entsteht ohne Notar und ohne Mindestkapital, die GmbH mit beidem. Die GmbH ist für das Geschäft in Deutschland angelegt, die LLC für das Geschäft in den USA. Häufig ist die GmbH die Gesellschafterin der LLC.",
    ziffern: [
      { wert: "25.000 €", label: "Stammkapital einer GmbH (§ 5 GmbHG)" },
      { wert: "kein", label: "Mindestkapital und kein Notar bei der LLC" },
      { wert: "oft beides", label: "die GmbH als Gesellschafterin der LLC" },
    ],
    blick: [
      ["GmbH", "Notar, Handelsregister, 25.000 € Stammkapital"],
      ["LLC", "Einreichung beim Bundesstaat, kein Mindestkapital"],
      ["Haftung", "Bei beiden auf das Gesellschaftsvermögen beschränkt"],
      ["Steuern", "Beide dort, wo sie geführt werden"],
      ["Übliche Struktur", "GmbH in Deutschland, LLC als US-Tochter"],
      ["Steuerfragen", "Vor der Gründung mit einem Steuerberater klären"],
    ],
    kurz: "LLC oder GmbH: Die GmbH entsteht mit Notar und Handelsregister und braucht 25.000 Euro Stammkapital. Die LLC entsteht durch Einreichung beim Bundesstaat, ohne Notar und ohne Mindestkapital. Beide beschränken die Haftung. Beide sind dort steuerpflichtig, wo sie geführt werden. Unternehmen mit Geschäft in beiden Ländern verbinden meist beide Formen: Die GmbH in Deutschland ist Gesellschafterin der LLC in den USA.",
    bloecke: [
      {
        typ: "tabelle", id: "vergleich", h2: "GmbH und LLC im Vergleich",
        kopf: ["", "GmbH", "US-LLC"],
        zeilen: [
          ["Gründung", "Notar und Handelsregister", "Einreichung beim Bundesstaat"],
          ["Mindestkapital", "25.000 €, bei der Gründung mindestens zur Hälfte eingezahlt", "keins"],
          ["Satzung", "Gesellschaftsvertrag, notariell beurkundet", "Operating Agreement, privatschriftlich"],
          ["Haftung", "auf das Gesellschaftsvermögen beschränkt", "auf das Gesellschaftsvermögen beschränkt"],
          ["Steuern", "dort, wo sie geführt wird", "dort, wo sie geführt wird — dazu US-Meldepflichten"],
          ["Jährlich", "Jahresabschluss, Offenlegung", "Staatsgebühr, Registered Agent, Form 5472"],
          ["Angelegt für", "Geschäft in Deutschland", "Geschäft in den USA"],
        ],
        fuss: ["Vereinfachte Übersicht. Für die UG (haftungsbeschränkt) gelten eigene Regeln zum Stammkapital."],
      },
      {
        typ: "text", id: "struktur", h2: "Die übliche Struktur: GmbH und LLC",
        absaetze: [
          "Wer in Deutschland ein Unternehmen führt und in den USA Geschäft aufbaut, gründet in der Regel eine LLC unter der GmbH. Die GmbH ist Gesellschafterin. Die LLC schließt Verträge in den USA, führt das US-Konto und baut dort eine Zahlungshistorie auf. Über das Konto entscheidet das jeweilige Institut.",
          "So bleiben Haftung und Zahlen des US-Geschäfts getrennt. Steuerlich kommt es darauf an, wo die LLC geführt wird und wie das Finanzamt sie einordnet. Diese Fragen gehören vor der Gründung zu einem Steuerberater. Gehört eine Florida-LLC einer GmbH, gibt die GmbH in Florida zudem eine eigene Steuererklärung ab.",
        ],
      },
      {
        typ: "hinweis", id: "wissen", h2: "Was Sie wissen müssen",
        punkte: [
          "Die GmbH bleibt die Form für das Geschäft in Deutschland, die LLC die Form für das Geschäft in den USA.",
          GLOBAL_PFLICHTHINWEIS.de[0],
          "Die GmbH meldet ihre Beteiligung an der LLC dem Finanzamt nach § 138 AO.",
          FIAON_GRUENDUNG,
        ],
      },
    ],
    fragen: [
      { f: "Ist eine LLC dasselbe wie eine GmbH?", a: "Nicht ganz. Beide beschränken die Haftung. Die LLC braucht weder Notar noch Mindestkapital, und ihre Satzung, das Operating Agreement, ist frei gestaltbar." },
      { f: "Kann meine GmbH eine US-LLC gründen?", a: "Ja. Die GmbH wird Gesellschafterin der LLC. Zu den Unterlagen gehören dann der Handelsregisterauszug der GmbH und die Reisepässe der Geschäftsführung. Wer sein Angebot über den Honorarrechner anfordert, wird persönlich Gesellschafter. Soll Ihre GmbH, AG oder Holding die Anteile halten, stimmen wir das im Gespräch mit Ihnen ab." },
      { f: "Spart die LLC gegenüber der GmbH Steuern?", a: "In der Regel nicht. Beide sind dort steuerpflichtig, wo sie geführt werden. Für die LLC kommen Meldepflichten in den USA hinzu." },
    ],
    weiter: ["/business/tochtergesellschaft-usa", "/business/wissen/llc-oder-corporation", "/business/wissen/tochter-oder-zweigniederlassung", "/business/wissen/us-llc-steuern"],
    quellen: [QUELLE_GMBHG5, QUELLE_AO10, QUELLE_AO138, QUELLEN_STAATEN.florida[4]],
  },

  // ─────────────────────────────────────────────────────────────────────────
  {
    pfad: "/business/wissen/form-5472",
    art: "wissen",
    seo: {
      titel: "Form 5472 für die LLC: Frist, Strafe, Ablauf — FIAON Global",
      beschreibung: "Form 5472 mit Pro-forma-1120: wer melden muss, was meldepflichtig ist, Frist 15. April, Strafe 25.000 $ — Pflicht auch ohne Umsatz.",
    },
    stand: S,
    kennung: "FG · 26",
    auge: "Wissen · Meldepflicht",
    h1: "Form 5472.",
    h1b: "Jährliche Meldung, auch ohne Umsatz.",
    lead: "Mit Form 5472 meldet eine US-Gesellschaft der US-Steuerbehörde IRS jedes Jahr die Geschäfte mit ihrem ausländischen Gesellschafter. Eine Form 1120 dient dabei als Deckblatt. Die Meldung ist auch ohne Umsatz Pflicht; für ein Versäumnis kann die IRS eine Strafe festsetzen.",
    ziffern: [
      { wert: "15. April", label: "Frist, mit Form 7004 bis 15. Oktober" },
      { wert: "25.000 $", label: "Strafe je Formular und Jahr" },
      { wert: "Fax oder Post", label: "nicht elektronisch" },
    ],
    blick: [
      ["Wer", "US-Gesellschaft mit ausländischem Gesellschafter, steuerlich kein eigenes Steuersubjekt"],
      ["Was", "Form 5472 mit einer Pro-forma-Form 1120"],
      ["Meldepflichtig", "Einlagen, Entnahmen, Darlehen, Zahlungen — auch die Einlage bei Gründung"],
      ["Frist", IRS.frist5472],
      ["Einreichung", "Per Fax oder Post, nicht elektronisch"],
      ["Strafe", `${IRS.strafe5472}, weitere Beträge nach Aufforderung`],
    ],
    kurz: `Form 5472 meldet der IRS die Geschäfte zwischen einer US-Gesellschaft und ihrem ausländischen Gesellschafter. Eine LLC, die steuerlich kein eigenes Steuersubjekt ist, reicht sie mit einer Pro-forma-Form 1120 ein. Frist ist der 15. April, verlängerbar bis 15. Oktober; die Meldung geht per Fax oder Post an die IRS. Meldepflichtig ist schon die Einlage bei der Gründung. Für eine fehlende Meldung kann die IRS ${IRS.strafe5472} festsetzen.`,
    bloecke: [
      {
        typ: "text", id: "wer", h2: "Wer melden muss",
        absaetze: [
          "Seit 2017 gilt eine eigene Regel für US-LLCs mit einem einzigen ausländischen Gesellschafter. Gilt die LLC steuerlich nicht als eigenes Steuersubjekt, wird sie für diese Meldung wie eine Corporation behandelt. Sie gibt jedes Jahr Form 5472 ab, zusammen mit einer Form 1120. Diese trägt nur Name, Adresse und EIN, die Steuernummer der Gesellschaft, und heißt Pro-forma-Form 1120.",
          "Auch Corporations mit ausländischem Anteilseigner melden auf Form 5472, dort als Anlage zu ihrer regulären Steuererklärung.",
        ],
      },
      {
        typ: "text", id: "was", h2: "Was meldepflichtig ist",
        absaetze: ["Die Gesellschaft meldet ihre Geschäfte mit dem ausländischen Gesellschafter oder mit ihm nahestehenden Personen, etwa:"],
        punkte: [
          "die Einlage bei der Gründung und jede weitere Einlage",
          "Entnahmen und Ausschüttungen",
          "Darlehen in beide Richtungen",
          "Zahlungen für Leistungen, Waren oder Rechte",
        ],
        nach: "Schon die Einlage bei der Gründung zählt. Die Meldung ist deshalb im ersten Jahr in aller Regel fällig, auch ohne Umsatz. Die Gesellschaft führt außerdem Aufzeichnungen, die diese Geschäfte belegen.",
      },
      {
        typ: "etappen", id: "ablauf", h2: "Ablauf der Meldung",
        etappen: [
          { titel: "Aufzeichnungen", text: "Die Gesellschaft hält Einlagen, Entnahmen und Zahlungen über das Jahr fest, jeweils mit Beleg." },
          { titel: "Erstellung durch den US-Steuerberater (CPA)", text: "Ein US-Steuerberater (CPA) erstellt Form 5472 und die Pro-forma-Form 1120 aus diesen Aufzeichnungen." },
          { titel: "Einreichung", text: "Bis zum 15. April per Fax oder Post an die IRS; mit Form 7004 verlängerbar bis 15. Oktober." },
          { titel: "Ablage", text: "Kopie und Nachweis der Einreichung gehören zu den Unterlagen der Gesellschaft." },
        ],
      },
      {
        typ: "hinweis", id: "strafe", h2: "Strafen bei Versäumnis",
        punkte: [
          `Für eine fehlende oder wesentlich unvollständige Meldung kann die IRS ${IRS.strafe5472} festsetzen. Dasselbe gilt, wenn die nötigen Aufzeichnungen fehlen.`,
          "Bleibt die Meldung länger als neunzig Tage nach einer Aufforderung der IRS aus, kommen für jeden weiteren Zeitraum von dreißig Tagen erneut 25.000 $ hinzu.",
          `${FIAON_TITEL}: Im ersten Jahr Ihres Mandats enthalten ist die erste jährliche US-Meldung durch einen US-Steuerberater (CPA) aus unserem Partnernetz. Kopie und Nachweis der Einreichung legen wir in Ihr Portal. ${TEIL.ihrTeil}: Sie halten Einlagen, Entnahmen und Zahlungen Ihrer Gesellschaft mit Belegen fest. ${TEIL.bedingung}: Über Fristverlängerung und Strafen entscheidet die IRS.`,
        ],
      },
    ],
    fragen: [
      { f: "Wer muss Form 5472 abgeben?", a: "Eine US-Gesellschaft mit ausländischem Gesellschafter. Das gilt auch für eine LLC, die steuerlich kein eigenes Steuersubjekt ist. Sie reicht Form 5472 mit einer Pro-forma-Form 1120 ein." },
      { f: "Muss ich Form 5472 abgeben, wenn meine LLC keinen Umsatz hatte?", a: "Ja, sobald es meldepflichtige Geschäfte gab. Schon die Einlage bei der Gründung zählt dazu." },
      { f: "Kann ich Form 5472 elektronisch einreichen?", a: "Nein. Die Pro-forma-Form 1120 mit Form 5472 geht per Fax oder Post an die IRS." },
      { f: "Wie hoch ist die Strafe für eine vergessene Form 5472?", a: `Die IRS kann ${IRS.strafe5472} festsetzen. Dauert das Versäumnis nach einer Aufforderung an, kommen weitere Beträge hinzu.` },
    ],
    weiter: ["/business/us-pflichten", "/business/wissen/llc-steuererklaerung", "/business/wissen/us-llc-steuern", "/business/wissen/ein-beantragen"],
    quellen: [QUELLEN_IRS[4], QUELLEN_IRS[5], QUELLE_I1120],
  },

  // ─────────────────────────────────────────────────────────────────────────
  // E-465 (29.10.2026): FG · 27 entsteht für DE und EN aus shared/fiaon-global-seiten/bundesstaat-wahl.ts
  // (Zeiten, Express, Vor- und Nachteile aus shared/fiaon-global-bundesstaaten.ts).
  bundesstaatWahlSeite("de"),

  // ─────────────────────────────────────────────────────────────────────────
  {
    pfad: "/business/wissen/anbieter-pruefen",
    art: "wissen",
    seo: {
      titel: "LLC-Anbieter seriös? Die Prüfliste — FIAON Global",
      // E-509 (12.11.2026): Die Prüfliste legen wir an uns selbst an — seit dem einen Produkt heißt der Punkt „Honorar, das vorab feststeht“
      // (vorher „Festpreis“: Unser Erfolgshonorar richtet sich nach dem gewählten Kapitalrahmen und steht vor dem Auftrag fest).
      // E-510 (13.11.2026): „Honorar“ statt „Preis“; über uns nur: „Honorar und Leistungen stehen fest, bevor Sie unterzeichnen.“ (Leitfaden 5.6 Nr. 12)
      beschreibung: "Seriöse Begleitung bei der US-Gründung erkennen: Vertragspartner im Register, Honorar vorab, keine Steuer- und Kreditversprechen, Partner mit Zulassung.",
    },
    stand: "2026-11-13",
    kennung: "FG · 28",
    auge: "Wissen · Anbieter",
    h1: "Seriöse LLC-Anbieter erkennen.",
    h1b: "Acht Punkte vor der Unterschrift.",
    lead: "Ob ein LLC-Anbieter seriös arbeitet, zeigt sich an acht Punkten. Jeden davon können Sie vor der Unterschrift selbst prüfen. Die LLC selbst ist eine gewöhnliche Rechtsform in den USA. Wir legen dieselbe Liste an uns selbst an.",
    ziffern: [
      { wert: "8 Punkte", label: "vor der Unterschrift prüfbar" },
      { wert: "Drei Register", label: "Companies House, Zefix, Handelsregister" },
      { wert: "Companies House", label: "FIAON LTD, Nr. 17318250" },
    ],
    blick: [
      ["Register", "Vertragspartner mit Registernummer, prüfbar"],
      ["Honorar", "Steht vorab fest, mit Leistungsverzeichnis"],
      ["Steuern", "Pflichthinweise statt Zusagen"],
      ["Kredit", "Über Rahmen, Karte und Darlehen entscheidet das Institut"],
      ["Partner", "Steuerberater und Anwälte mit Zulassung, in eigener Verantwortung"],
      ["Verbindungen", "Verbundene Gesellschaften sind benannt"],
    ],
    kurz: "Einen seriösen LLC-Anbieter erkennen Sie an Merkmalen, die sich vor der Unterschrift prüfen lassen. Der Vertragspartner hat eine prüfbare Registernummer. Das Honorar steht vorab fest, mit Leistungsverzeichnis. Pflichthinweise zu Steuern und Meldungen stehen offen auf der Seite. Zusagen zu Steuern, Karten und Krediten gibt der Anbieter nicht. Steuer- und Rechtsfragen liegen bei Partnern mit eigener Zulassung; verbundene Gesellschaften sind benannt.",
    bloecke: [
      {
        typ: "etappen", id: "liste", h2: "Die acht Punkte",
        etappen: [
          { titel: "Vertragspartner im Register", text: "Name, Rechtsform, Sitz und Registernummer stehen im Vertrag und sind im Register auffindbar. Ohne prüfbaren Vertragspartner fehlt die Grundlage für einen Vertrag." },
          { titel: "Honorar vorab, mit Leistungsverzeichnis", text: "Der Vertrag nennt schriftlich, was enthalten ist und was ab dem zweiten Jahr anfällt. Laufende Entgelte, die erst nach der Unterschrift auftauchen, sind ein Warnzeichen." },
          { titel: "Aussagen zu Steuern", text: "Die Aussagen „steuerfrei“ oder „ohne Steuern“ lassen den Ort der Geschäftsleitung außer Acht. Ein seriöser Anbieter nennt die Steuerpflicht im Wohnsitzland und die Meldepflichten." },
          { titel: "Zusagen zu Karten und Krediten", text: "Über Konto, Karte und Rahmen entscheidet das jeweilige Institut. Einen Betrag kann deshalb kein Anbieter zusagen. Ein Ziel, das Sie selbst wählen, ist keine Zusage." },
          { titel: "Zuständigkeit für Steuer- und Rechtsfragen", text: "Steuer- und Rechtsfragen beantworten nur Steuerberater, US-Steuerberater (CPA) und Anwälte mit Zulassung, in eigener Verantwortung. Ein Gründungsdienst selbst ist dazu nicht befugt." },
          { titel: "Die US-Pflichten", text: "Ein seriöser Anbieter nennt Form 5472, Staatsgebühr und Registered Agent vor der Unterschrift. Für eine versäumte Meldung kann die IRS eine Strafe festsetzen." },
          { titel: "Zugriff auf Ihr Geld", text: "Kontoinhaberin ist Ihre Gesellschaft. Ein Anbieter braucht keine Vollmacht über Ihr Konto und nimmt kein Geld für Sie entgegen." },
          { titel: "Offene Verbindungen", text: "Gehören Partner zum selben Eigentümer wie der Anbieter, steht das offen auf seiner Seite." },
        ],
      },
      {
        typ: "text", id: "fiaon", h2: "Dieselbe Liste für FIAON Global",
        absaetze: [
          `Ihr Vertragspartner ist die FIAON LTD, eingetragen im Companies House unter Nr. 17318250. Honorar und Leistungen stehen fest, bevor Sie unterzeichnen; die laufenden Kosten ab dem zweiten Jahr nennen wir vorab. ${KEIN_STEUERMODELL}`,
          `${ANTRAEGE} ${satz("S1")} ${beleg("keinZugriff")}`,
          EIN_PRODUKT.de.partner,
          GLOBAL_VERBUNDEN,
        ],
      },
      {
        typ: "hinweis", id: "wissen", h2: "Was Sie wissen müssen",
        punkte: [
          "Die Rechtsform eines Anbieters sagt nichts über seine Arbeitsweise. Das gilt für die LLC, die Ltd und die GmbH.",
          "Prüfen Sie Registernummern selbst: im Companies House, in Zefix oder im Handelsregister.",
          GLOBAL_PFLICHTHINWEIS.de[2],
        ],
      },
    ],
    fragen: [
      { f: "Woran erkenne ich einen seriösen Anbieter für die US-Gründung?", a: "An einem prüfbaren Vertragspartner mit Registernummer und an einem Honorar, das vorab feststeht, mit Leistungsverzeichnis. Hinzu kommen Pflichthinweise zu Steuern und Meldungen. Zusagen zu Steuern, Karten und Krediten gibt ein seriöser Anbieter nicht." },
      { f: "Ist eine LLC an sich unseriös?", a: "Nein. Die LLC ist eine gewöhnliche Rechtsform in den USA. Über Seriosität entscheidet die Arbeitsweise eines Anbieters, nicht seine Rechtsform." },
      { f: "Wie prüfe ich die Registernummer von FIAON?", a: "Im Companies House (England und Wales) unter Nr. 17318250." },
    ],
    weiter: ["/business/partner", "/business/vergleich", "/business/kosten", "/business/wissen/us-firmenkarte-beantragen"],
    quellen: [
      { titel: "Companies House — FIAON LTD", url: "https://find-and-update.company-information.service.gov.uk/company/17318250" },
      { titel: "Zefix — Zentraler Firmenindex der Schweiz", url: "https://www.zefix.ch/de/search/entity/welcome" },
    ],
  },
];
