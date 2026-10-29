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
import { GLOBAL_VERBUNDEN } from "../fiaon-global-partner";
import { FAKTEN_STAND, IRS, QUELLEN_IRS, QUELLEN_STAATEN } from "./fakten";
import type { GlobalSeite } from "./typen";
import { bundesstaatWahlSeite } from "./bundesstaat-wahl";

const S = "2026-09-19";
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
      beschreibung: "28 Beiträge zur US-Gesellschaft: LLC, EIN und ITIN, Anschrift, Konto, Credit Score, Firmenkarten, US-Funding, Steuern — ehrlich erklärt, mit Quellen.",
    },
    // 23.09.2026 (E-232): zehn Praxis-Beiträge dazu (wissen-gruendung.ts, wissen-konto-karten.ts), nach Themen geordnet.
    stand: "2026-09-23",
    kennung: "FG · 22",
    auge: "Wissen",
    h1: "Wissen vor der Gründung.",
    h1b: "Ehrlich erklärt, mit Quellen.",
    lead: "Was Unternehmer aus Deutschland, Österreich und der Schweiz über eine US-Gesellschaft wissen sollten: Gründung, EIN und ITIN, US-Präsenz, Konto, Karten, Steuererklärung und Struktur. Jeder Beitrag nennt seine Quellen und seinen Stand und sagt auch, was eine US-Gesellschaft nicht kann.",
    ziffern: [
      { wert: "28 Beiträge", label: "Gründung, Steuernummern, Konto, Karten, Finanzierung, Steuern" },
      { wert: "3 Staaten", label: "Delaware, Florida, Wyoming" },
      { wert: FAKTEN_STAND, label: "Stand aller Zahlen" },
    ],
    blick: [
      ["Gründung", "Die Anleitung in zehn Schritten, Bundesstaat, Rechtsform, Struktur"],
      ["Steuernummern", "EIN ohne SSN, ITIN mit Form W-7"],
      ["US-Präsenz", "Registered Agent, Geschäftsadresse, Telefonnummer"],
      ["Konto und Karten", "Unterlagen, Credit Score, Business Credit, Firmenkarten, Finanzierung, Immobilien"],
      ["Steuern", "Steuermodell oder nicht, Form 5472, die US-Steuererklärung"],
      ["Anbieter", "Woran Sie seriöse Begleitung erkennen"],
      ["Redaktion", "FIAON Global — Quellen am Ende jedes Beitrags"],
    ],
    kurz: `Eine US-Gesellschaft ist ein Werkzeug für echtes Geschäft in den USA und für den Aufbau von Kapital — kein Steuermodell. ${GLOBAL_KAPITAL_FREI.de.satz} ${GLOBAL_KAPITAL_FREI.de.steuer} Wer die Gesellschaft aus Deutschland, Österreich oder der Schweiz führt, versteuert sie in der Regel zu Hause, meldet sie dem Finanzamt und gibt in den USA jährlich Form 5472 ab. Die Beiträge hier erklären jeden Schritt — von der Gründung über Steuernummern, Konto und Karten bis zur Steuererklärung.`,
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
          { pfad: "/business/wissen/us-firmenkarte-beantragen", tag: "Firmenkarten" },
          { pfad: "/business/wissen/finanzierungswege-usa", tag: "Finanzierung" },
          { pfad: "/business/wissen/us-immobilie-finanzieren", tag: "Immobilien" },
        ],
      },
      {
        typ: "verzeichnis", id: "funding", h2: "US-Funding und Kapital",
        eintraege: [
          { pfad: "/business/wissen/us-funding", tag: "Pfeiler" },
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
        typ: "pakete", id: "pakete", h2: "Alles aus einer Hand",
        lead: "Jeder Beitrag hier beschreibt eine Aufgabe. FIAON Global übernimmt sie alle — Gründung, Steuernummern, US-Präsenz, Konto- und Kartenanträge, Pflichtenkalender und die erste US-Meldung, mit Partner-Anwalt, Partner-Steuerberater und US-CPA. Zum Festpreis, alle Gebühren für die Leistungen des Pakets inklusive.",
      },
    ],
    fragen: [],
    weiter: ["/business/us-firmengruendung", "/business/kosten", "/business/fragen", "/business/paket-finder"],
  },

  // ─────────────────────────────────────────────────────────────────────────
  {
    pfad: "/business/wissen/us-llc-steuern",
    art: "wissen",
    seo: {
      titel: "US-LLC und Steuern: Die ehrliche Antwort — FIAON Global",
      beschreibung: "Spart eine US-LLC Steuern? Für Unternehmer aus Deutschland und der Schweiz meist nicht: Geschäftsleitung, Typenvergleich, Meldepflichten — mit Quellen.",
    },
    // 27.10.2026: Tabelle „Was wo gilt“ mit Österreich als eigener Spalte (Quellen RIS, Findok, Fedlex).
    stand: "2026-10-27",
    kennung: "FG · 23",
    auge: "Wissen · Steuern",
    h1: "Spart eine US-LLC Steuern?",
    h1b: "Die ehrliche Antwort.",
    lead: "„Steuerfrei mit der US-LLC“ ist eines der hartnäckigsten Versprechen im Netz. Für Unternehmer, die in Deutschland, Österreich oder der Schweiz leben und von dort arbeiten, trägt es in aller Regel nicht. Hier steht, warum — und wofür eine US-Gesellschaft trotzdem gut ist.",
    ziffern: [
      { wert: "§ 10 AO", label: "Ort der Geschäftsleitung entscheidet" },
      { wert: "Art. 50 DBG", label: "tatsächliche Verwaltung in der Schweiz" },
      { wert: "Form 5472", label: "jährliche Meldung an die IRS" },
    ],
    blick: [
      ["Kurz", "Geführt von zu Hause = in der Regel zu Hause steuerpflichtig"],
      ["Deutschland", "Ort der Geschäftsleitung (§ 10 AO), Typenvergleich, § 138 AO"],
      ["Schweiz", "Sitz oder tatsächliche Verwaltung (Art. 50 DBG)"],
      ["USA", "Meldepflicht Form 5472 auch ohne Umsatz"],
      ["Wofür sie taugt", "Geschäft, Konto, Karten und Verträge in den USA"],
      ["Kapital", GLOBAL_KAPITAL_FREI.de.kurz],
      ["Prüfung", "Vor jeder Gründung durch unseren Partner-Steuerberater"],
    ],
    kurz: `In der Regel nicht. Eine US-LLC, die ein Unternehmer von Deutschland, Österreich oder der Schweiz aus führt, hat dort ihren Ort der Geschäftsleitung beziehungsweise ihre tatsächliche Verwaltung und ist dort steuerpflichtig. Dazu kommen Meldepflichten in beiden Ländern. Eine US-Gesellschaft lohnt sich für echtes Geschäft in den USA und für den Aufbau von Kapital — nicht, um Steuern zu vermeiden. ${GLOBAL_KAPITAL_FREI.de.satz} ${GLOBAL_KAPITAL_FREI.de.steuer}`,
    bloecke: [
      {
        typ: "text", id: "mythos", h2: "Woher das Versprechen kommt",
        absaetze: [
          "Eine LLC mit einem einzigen ausländischen Gesellschafter wird in den USA steuerlich meist nicht als eigenes Steuersubjekt behandelt. Hat sie dort kein Geschäft, zahlt sie in den USA oft keine Bundessteuer auf ihren Gewinn. Staaten wie Wyoming erheben zudem keine eigene Körperschaftsteuer.",
          "Daraus wird im Netz schnell „steuerfrei“. Übersehen wird dabei, dass der Staat, in dem der Unternehmer lebt und arbeitet, eigene Regeln hat — und die knüpfen nicht an den Sitz der Gesellschaft an, sondern daran, wo sie tatsächlich geführt wird.",
        ],
      },
      {
        typ: "text", id: "deutschland", h2: "Deutschland: der Ort der Geschäftsleitung",
        absaetze: [
          "Nach § 10 AO ist die Geschäftsleitung der Mittelpunkt der geschäftlichen Oberleitung. Wer die wichtigen Entscheidungen seiner US-Gesellschaft an seinem Schreibtisch in Deutschland trifft, hat die Geschäftsleitung in Deutschland. Eine Kapitalgesellschaft mit Geschäftsleitung im Inland ist hier unbeschränkt körperschaftsteuerpflichtig (§ 1 KStG) — mit allen Einkünften.",
          "Wie das Finanzamt die LLC einordnet — wie eine GmbH oder wie eine Personengesellschaft —, entscheidet ein Typenvergleich nach dem Gesamtbild ihrer Merkmale (BMF-Schreiben vom 19. März 2004). Die Einordnung in den USA spielt dafür keine Rolle. Bei niedrig besteuerten, passiven Einkünften kann zudem die Hinzurechnungsbesteuerung nach dem Außensteuergesetz greifen.",
          "Hinzu kommt die Meldung: Gründung oder Erwerb der Beteiligung sind dem Finanzamt nach § 138 AO mitzuteilen, zusammen mit der Steuererklärung.",
        ],
      },
      {
        typ: "text", id: "schweiz", h2: "Schweiz und Österreich",
        absaetze: [
          "In der Schweiz sind juristische Personen steuerpflichtig, wenn sich ihr Sitz oder ihre tatsächliche Verwaltung hier befindet (Art. 50 DBG). Auch hier gilt: Wer die US-Gesellschaft von der Schweiz aus führt, muss mit der Steuerpflicht in der Schweiz rechnen.",
          "Österreich knüpft ebenfalls an den Ort der Geschäftsleitung an. In allen drei Ländern entscheidet damit dieselbe Frage: Wo wird die Gesellschaft tatsächlich geführt?",
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
          "Die Zeile zur unbeschränkten Steuerpflicht setzt voraus, dass die LLC als Körperschaft beziehungsweise juristische Person eingeordnet wird; das entscheidet in allen drei Ländern der Vergleich mit den heimischen Rechtsformen.",
        ],
      },
      {
        typ: "karten", id: "wofuer", h2: "Wofür eine US-Gesellschaft gut ist", spalten: 3,
        karten: [
          { tag: "Gut für", titel: "Geschäft in den USA", text: "Verträge mit US-Kunden, ein US-Konto, Zahlungen in US-Dollar, getrennte Haftung, eine eigene Kartenhistorie in den USA." },
          { tag: "Gut für", titel: "Kapitalaufbau — auch für Europa", text: `${GLOBAL_KAPITAL_FREI.de.satz} ${GLOBAL_KAPITAL_FREI.de.steuer}` },
          { tag: "Nicht gut für", titel: "Steuern zu Hause vermeiden", text: "Wird sie von zu Hause geführt, ist sie dort in der Regel steuerpflichtig. Wer „steuerfrei“ verspricht, verschweigt den Ort der Geschäftsleitung." },
        ],
      },
      {
        typ: "hinweis", id: "wissen", h2: "Was Sie wissen müssen",
        punkte: [
          "Dieser Beitrag erklärt Grundlagen. Ihren Fall prüft vor der Gründung unser Partner-Steuerberater auf Ihr Mandat — die Prüfung ist im Festpreis jedes Pakets enthalten.",
          GLOBAL_PFLICHTHINWEIS.de[0],
          GLOBAL_PFLICHTHINWEIS.de[1],
        ],
      },
    ],
    fragen: [
      { f: "Muss ich meine US-LLC in Deutschland versteuern?", a: "Wenn Sie sie von Deutschland aus führen, in der Regel ja: Der Ort der Geschäftsleitung liegt dann in Deutschland (§ 10 AO). Wie das Finanzamt die LLC einordnet, entscheidet ein Typenvergleich." },
      { f: "Ist eine Wyoming-LLC steuerfrei?", a: "Wyoming erhebt keine eigene Körperschaftsteuer. Steuerpflichtig ist die Gesellschaft aber dort, wo sie geführt wird — für Unternehmer aus Deutschland, Österreich oder der Schweiz in der Regel zu Hause." },
      { f: "Warum werben so viele mit einer steuerfreien LLC?", a: "Weil eine LLC mit ausländischem Gesellschafter in den USA oft keine Bundessteuer zahlt. Das stimmt für die USA, sagt aber nichts über die Steuerpflicht im Heimatland — und die hängt am Ort der Geschäftsleitung." },
      { f: "Wofür lohnt sich eine US-Gesellschaft dann?", a: `Für echtes Geschäft in den USA — Verträge mit US-Kunden, ein US-Konto, Zahlungen in US-Dollar, getrennte Haftung, eine eigene Kartenhistorie — und für den Aufbau von Kapital. ${GLOBAL_KAPITAL_FREI.de.satz} ${GLOBAL_KAPITAL_FREI.de.steuer}` },
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
      beschreibung: "LLC oder C-Corporation: Haftung, Besteuerung, Investoren, Formalitäten und Kosten im Vergleich — und wann welche Rechtsform zu Ihrem Vorhaben passt.",
    },
    stand: S,
    kennung: "FG · 24",
    auge: "Wissen · Rechtsform",
    h1: "LLC oder Corporation?",
    h1b: "Die Wahl, die alles Weitere prägt.",
    lead: "Beide Rechtsformen beschränken die Haftung. Der Unterschied liegt in der Besteuerung, in der inneren Ordnung und darin, wer später einsteigen soll. Die Wahl prägt Konto, Karten, Meldungen und jeden Investor, der kommt.",
    ziffern: [
      { wert: IRS.koerperschaftsteuer, label: "Körperschaftsteuer des Bundes für Corporations" },
      { wert: "2 Formen", label: "beide mit beschränkter Haftung" },
      { wert: "vor der Gründung", label: "geprüft durch unseren Partner-Steuerberater" },
    ],
    blick: [
      ["LLC", "Schlank, flexibel, meist kein eigenes Steuersubjekt in den USA"],
      ["Corporation", "Eigenes Steuersubjekt, Standard für Investoren"],
      ["Haftung", "Bei beiden auf das Gesellschaftsvermögen beschränkt"],
      ["Investoren", "Erwarten in der Regel eine Corporation"],
      ["Wechsel", "Später möglich, aber mit Aufwand"],
      ["Prüfung", "Vor der Gründung im Festpreis enthalten"],
    ],
    kurz: `Die LLC ist die schlankere Form: flexibel geregelt im Operating Agreement und mit einem ausländischen Gesellschafter in den USA meist kein eigenes Steuersubjekt. Die Corporation ist ein eigenes Steuersubjekt — auf Bundesebene mit ${IRS.koerperschaftsteuer} Körperschaftsteuer — und der Standard, wenn Investoren einsteigen oder Mitarbeiter beteiligt werden sollen. Für Handel, Dienstleistung und den Aufbau einer Kartenhistorie ist meist die LLC die einfachere Wahl.`,
    bloecke: [
      {
        typ: "tabelle", id: "vergleich", h2: "Der Vergleich",
        kopf: ["", "LLC", "Corporation"],
        zeilen: [
          ["Haftung", "auf das Gesellschaftsvermögen beschränkt", "auf das Gesellschaftsvermögen beschränkt"],
          ["Steuer in den USA", "mit einem ausländischen Gesellschafter meist kein eigenes Steuersubjekt", `eigenes Steuersubjekt, Bund ${IRS.koerperschaftsteuer}, dazu je nach Staat`],
          ["Innere Ordnung", "Operating Agreement, frei gestaltbar", "Satzung, Vorstand, Aktien nach festen Regeln"],
          ["Investoren", "selten", "der Standard"],
          ["Mitarbeiterbeteiligung", "möglich, aber unüblich", "üblich über Aktienoptionen"],
          ["Jährliche Meldung an die IRS", "Form 5472 mit Form 1120 (als Deckblatt)", "Form 1120; ist ein Anteilseigner zu mindestens 25 % ausländisch, dazu Form 5472"],
          ["Laufende Kosten", "niedriger", "höher, etwa durch Franchise Tax in Delaware"],
        ],
        fuss: ["Vereinfachte Übersicht; die Einordnung im Heimatland folgt eigenen Regeln."],
      },
      {
        typ: "karten", id: "wann", h2: "Wann welche Form passt", spalten: 2,
        karten: [
          { tag: "LLC", titel: "Handel, Dienstleistung, Kartenhistorie", text: "Wenn die Gesellschaft Aufträge abwickelt, Waren verkauft oder eine eigene Bank- und Kartenhistorie aufbauen soll — und keine Investoren geplant sind." },
          { tag: "Corporation", titel: "Investoren, Beteiligungen, Verkauf", text: "Wenn US-Investoren einsteigen, Mitarbeiter Anteile erhalten oder das Unternehmen später verkauft werden soll." },
        ],
      },
      {
        typ: "text", id: "wechsel", h2: "Kann man später wechseln?",
        absaetze: [
          "Ja — eine LLC lässt sich in eine Corporation umwandeln. Der Wechsel kostet aber Zeit, Gebühren und steuerliche Prüfung in beiden Ländern. Deshalb lohnt es sich, die Frage vor der Gründung ernsthaft zu stellen: Wer soll in drei Jahren an dieser Gesellschaft beteiligt sein?",
        ],
      },
      {
        typ: "hinweis", id: "wissen", h2: "Was Sie wissen müssen",
        punkte: [
          "Die Wahl der Rechtsform hat steuerliche Folgen im Heimatland. Unser Partner-Steuerberater prüft sie vor der Gründung auf Ihr Mandat.",
          GLOBAL_PFLICHTHINWEIS.de[1],
        ],
      },
    ],
    fragen: [
      { f: "Was ist der Unterschied zwischen LLC und Corporation?", a: `Beide beschränken die Haftung. Die LLC ist flexibler und mit einem ausländischen Gesellschafter in den USA meist kein eigenes Steuersubjekt; die Corporation ist ein eigenes Steuersubjekt (Bund ${IRS.koerperschaftsteuer}) und der Standard für Investoren.` },
      { f: "Welche Rechtsform brauche ich für US-Investoren?", a: "In der Regel eine Corporation, oft in Delaware. Investoren in den USA kennen diese Form und erwarten sie." },
      { f: "Kann ich eine LLC später in eine Corporation umwandeln?", a: "Ja, aber mit Aufwand: Gebühren, neue Unterlagen und eine steuerliche Prüfung in beiden Ländern." },
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
      beschreibung: "US-LLC oder GmbH: Gründung, Stammkapital, Notar, Haftung, Steuern und Pflichten im Vergleich — und warum die Frage meist nicht entweder-oder lautet.",
    },
    stand: S,
    kennung: "FG · 25",
    auge: "Wissen · Rechtsform",
    h1: "LLC oder GmbH?",
    h1b: "Meist kein Entweder-oder.",
    lead: "Die LLC gilt als „amerikanische GmbH“ — schneller gegründet, ohne Notar, ohne Stammkapital. Das stimmt. Aber die Frage ist selten, welche von beiden: Die GmbH ist für das Geschäft zu Hause gemacht, die LLC für das Geschäft in den USA. Oft gehört die LLC der GmbH.",
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
      ["Typisch", "GmbH zu Hause, LLC als US-Tochter"],
      ["Prüfung", "Vor der Gründung durch unseren Partner-Steuerberater"],
    ],
    kurz: "Die GmbH wird mit Notar und Handelsregister gegründet und braucht 25.000 Euro Stammkapital; die LLC wird beim Bundesstaat eingereicht und braucht weder Notar noch Mindestkapital. Beide beschränken die Haftung, und beide sind dort steuerpflichtig, wo sie geführt werden. Für Unternehmen mit Geschäft in beiden Ländern ist die typische Lösung keine Wahl, sondern eine Struktur: die GmbH zu Hause als Gesellschafterin der LLC in den USA.",
    bloecke: [
      {
        typ: "tabelle", id: "vergleich", h2: "Der Vergleich",
        kopf: ["", "GmbH", "US-LLC"],
        zeilen: [
          ["Gründung", "Notar und Handelsregister", "Einreichung beim Bundesstaat"],
          ["Mindestkapital", "25.000 €, bei der Gründung mindestens zur Hälfte eingezahlt", "keins"],
          ["Satzung", "Gesellschaftsvertrag, notariell beurkundet", "Operating Agreement, privatschriftlich"],
          ["Haftung", "auf das Gesellschaftsvermögen beschränkt", "auf das Gesellschaftsvermögen beschränkt"],
          ["Steuern", "dort, wo sie geführt wird", "dort, wo sie geführt wird — dazu US-Meldepflichten"],
          ["Jährlich", "Jahresabschluss, Offenlegung", "Staatsgebühr, Registered Agent, Form 5472"],
          ["Gemacht für", "Geschäft in Deutschland", "Geschäft in den USA"],
        ],
        fuss: ["Vereinfachte Übersicht. Für die UG (haftungsbeschränkt) gelten eigene Regeln zum Stammkapital."],
      },
      {
        typ: "text", id: "struktur", h2: "Die typische Struktur: GmbH und LLC",
        absaetze: [
          "Wer in Deutschland ein Unternehmen führt und in den USA Geschäft aufbaut, gründet in der Regel keine LLC statt der GmbH, sondern eine LLC unter der GmbH. Die GmbH ist Gesellschafterin, die LLC schließt Verträge in den USA, führt das US-Konto und baut dort eine eigene Historie auf.",
          "So bleiben Haftung und Zahlen des US-Geschäfts getrennt. Steuerlich ist dabei zu klären, wo die LLC geführt wird und wie sie eingeordnet wird — das prüft unser Partner-Steuerberater vor der Gründung. Gehört eine Florida-LLC einer GmbH, gibt die GmbH in Florida zudem eine eigene Steuererklärung ab.",
        ],
      },
      {
        typ: "hinweis", id: "wissen", h2: "Was Sie wissen müssen",
        punkte: [
          "Eine LLC ersetzt keine GmbH für das Geschäft in Deutschland — und umgekehrt.",
          GLOBAL_PFLICHTHINWEIS.de[0],
          "Die Beteiligung der GmbH an der LLC ist dem Finanzamt nach § 138 AO zu melden.",
        ],
      },
    ],
    fragen: [
      { f: "Ist eine LLC dasselbe wie eine GmbH?", a: "Nicht ganz. Beide beschränken die Haftung, aber die LLC braucht weder Notar noch Mindestkapital, und ihre Satzung — das Operating Agreement — ist frei gestaltbar." },
      { f: "Kann meine GmbH eine US-LLC gründen?", a: "Ja. Die GmbH wird Gesellschafterin der LLC. Wir benötigen dann den Handelsregisterauszug der GmbH und die Pässe der Geschäftsführung." },
      { f: "Spart die LLC gegenüber der GmbH Steuern?", a: "In der Regel nicht. Beide sind dort steuerpflichtig, wo sie geführt werden; die LLC bringt zusätzlich Meldepflichten in den USA mit sich." },
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
    h1b: "Die Meldung, die niemand vergessen darf.",
    lead: "Gehört eine US-Gesellschaft einem ausländischen Gesellschafter, meldet sie der IRS jedes Jahr ihre Geschäfte mit ihm — mit Form 5472 und einer Form 1120 als Deckblatt. Die Meldung ist auch ohne Umsatz Pflicht, und ihr Versäumnis ist teuer.",
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
    kurz: `Form 5472 meldet der IRS die Geschäfte zwischen einer US-Gesellschaft und ihrem ausländischen Gesellschafter. Eine LLC, die steuerlich kein eigenes Steuersubjekt ist, reicht sie mit einer Pro-forma-Form 1120 ein — bis zum 15. April, verlängerbar bis 15. Oktober, per Fax oder Post. Meldepflichtig ist schon die Einlage bei der Gründung; die Strafe für eine fehlende Meldung beträgt ${IRS.strafe5472}.`,
    bloecke: [
      {
        typ: "text", id: "wer", h2: "Wer melden muss",
        absaetze: [
          "Seit 2017 gilt: Eine US-LLC mit einem einzigen ausländischen Gesellschafter, die steuerlich nicht als eigenes Steuersubjekt gilt, wird für diese Meldung wie eine Corporation behandelt. Sie gibt jedes Jahr Form 5472 ab, zusammen mit einer Form 1120, die nur Name, Adresse und EIN trägt — der sogenannten Pro-forma-Form 1120.",
          "Auch Corporations mit ausländischem Anteilseigner melden auf Form 5472, dort als Anlage zu ihrer regulären Steuererklärung.",
        ],
      },
      {
        typ: "text", id: "was", h2: "Was meldepflichtig ist",
        absaetze: ["Gemeldet werden die Geschäfte zwischen der Gesellschaft und ihrem ausländischen Gesellschafter oder ihm nahestehenden Personen, etwa:"],
        punkte: [
          "die Einlage bei der Gründung und jede weitere Einlage",
          "Entnahmen und Ausschüttungen",
          "Darlehen in beide Richtungen",
          "Zahlungen für Leistungen, Waren oder Rechte",
        ],
        nach: "Weil schon die Einlage bei der Gründung zählt, ist die Meldung im ersten Jahr praktisch immer fällig — auch ohne einen Dollar Umsatz. Die Gesellschaft muss außerdem Aufzeichnungen führen, die diese Geschäfte belegen.",
      },
      {
        typ: "etappen", id: "ablauf", h2: "So läuft die Meldung ab",
        etappen: [
          { titel: "Aufzeichnungen", text: "Einlagen, Entnahmen und Zahlungen werden über das Jahr festgehalten — mit Belegen." },
          { titel: "Erstellung durch den US-CPA", text: "Der US-CPA erstellt Form 5472 und die Pro-forma-Form 1120 aus diesen Aufzeichnungen." },
          { titel: "Einreichung", text: "Bis zum 15. April per Fax oder Post an die IRS; mit Form 7004 verlängerbar bis 15. Oktober." },
          { titel: "Ablage", text: "Kopie und Nachweis der Einreichung liegen in Ihrem Dokumentenraum." },
        ],
      },
      {
        typ: "hinweis", id: "strafe", h2: "Was ein Versäumnis kostet",
        punkte: [
          `Für eine fehlende oder wesentlich unvollständige Meldung kann die IRS ${IRS.strafe5472} festsetzen — ebenso, wenn die nötigen Aufzeichnungen fehlen.`,
          "Bleibt die Meldung länger als 90 Tage nach einer Aufforderung der IRS aus, kommen für jeden weiteren Zeitraum von 30 Tagen erneut 25.000 $ hinzu.",
          "Die erste jährliche Meldung erstellt bei FIAON Global unser US-CPA — das Honorar ist im Festpreis jedes Pakets enthalten.",
        ],
      },
    ],
    fragen: [
      { f: "Wer muss Form 5472 abgeben?", a: "Eine US-Gesellschaft mit ausländischem Gesellschafter — auch eine LLC, die steuerlich kein eigenes Steuersubjekt ist. Sie reicht Form 5472 mit einer Pro-forma-Form 1120 ein." },
      { f: "Muss ich Form 5472 abgeben, wenn meine LLC keinen Umsatz hatte?", a: "Ja, sobald es meldepflichtige Geschäfte gab — und schon die Einlage bei der Gründung zählt dazu." },
      { f: "Kann ich Form 5472 elektronisch einreichen?", a: "Für die Pro-forma-Form 1120 mit Form 5472 nein. Sie wird per Fax oder Post an die IRS geschickt." },
      { f: "Wie hoch ist die Strafe für eine vergessene Form 5472?", a: `Die IRS kann ${IRS.strafe5472} festsetzen, bei fortdauerndem Versäumnis nach einer Aufforderung weitere Beträge.` },
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
      beschreibung: "Seriöse Begleitung bei der US-Gründung erkennen: Vertragspartner im Register, Festpreis, keine Steuer- und Kreditversprechen, Partner mit Zulassung.",
    },
    stand: S,
    kennung: "FG · 28",
    auge: "Wissen · Anbieter",
    h1: "Seriös oder nicht?",
    h1b: "Die Prüfliste vor dem Auftrag.",
    lead: "„LLC“ ist eine Rechtsform — nicht mehr und nicht weniger. Viele Anbieter nutzen sie, gute wie schlechte. Ob eine Begleitung seriös ist, zeigt sich an acht Punkten, die Sie vor jedem Auftrag prüfen können. Wir legen dieselbe Liste an uns selbst an.",
    ziffern: [
      { wert: "8 Punkte", label: "vor jedem Auftrag prüfbar" },
      { wert: "2 Minuten", label: "genügen für den Registercheck" },
      { wert: "Companies House", label: "FIAON LTD No. 17318250" },
    ],
    blick: [
      ["Register", "Vertragspartner mit Registernummer, prüfbar"],
      ["Preis", "Festpreis mit Leistungsverzeichnis"],
      ["Steuern", "Keine Versprechen — Pflichthinweise stattdessen"],
      ["Kredit", "Keine Zusage zu Rahmen, Karte oder Darlehen"],
      ["Partner", "Steuerberater und Anwälte mit Zulassung, auf Ihr Mandat"],
      ["Offenheit", "Verbundene Gesellschaften werden genannt"],
    ],
    kurz: "Seriöse Begleitung bei der US-Gründung erkennen Sie an einem Vertragspartner mit prüfbarer Registernummer, einem Festpreis mit Leistungsverzeichnis, klaren Pflichthinweisen zu Steuern und Meldungen, dem Verzicht auf Zusagen zu Steuern, Karten und Krediten, Partnern mit eigener Zulassung — und daran, dass verbundene Gesellschaften offen genannt werden.",
    bloecke: [
      {
        typ: "etappen", id: "liste", h2: "Die acht Punkte",
        etappen: [
          { titel: "Wer ist Ihr Vertragspartner?", text: "Name, Rechtsform, Sitz und Registernummer müssen im Vertrag stehen — und im Register auffindbar sein. Ohne prüfbaren Vertragspartner kein Auftrag." },
          { titel: "Gibt es einen Festpreis mit Leistungsverzeichnis?", text: "Was enthalten ist, steht schriftlich — auch, was ab dem zweiten Jahr anfällt. Abos, die erst nach der Unterschrift auftauchen, sind ein Warnzeichen." },
          { titel: "Werden Steuern versprochen?", text: "„Steuerfrei“ oder „ohne Steuern“ verschweigt den Ort der Geschäftsleitung. Seriöse Anbieter nennen die Steuerpflicht zu Hause und die Meldepflichten." },
          { titel: "Werden Karten, Rahmen oder Kredite zugesagt?", text: "Über Konto, Karte und Rahmen entscheidet das Institut. Wer Beträge verspricht, verspricht, was er nicht halten kann." },
          { titel: "Wer beantwortet Steuer- und Rechtsfragen?", text: "Nur Steuerberater, US-CPA und Anwälte mit Zulassung — auf Ihr eigenes Mandat. Ein Gründungsdienst selbst darf das nicht." },
          { titel: "Werden die US-Pflichten genannt?", text: "Form 5472, Staatsgebühr, Registered Agent: Wer sie vor dem Auftrag nicht nennt, lässt Sie mit der teuersten Frist allein." },
          { titel: "Wer hat Zugriff auf Ihr Geld?", text: "Kontoinhaber ist Ihre Gesellschaft. Ein Anbieter braucht keine Vollmacht über Ihr Konto und nimmt kein Geld für Sie entgegen." },
          { titel: "Werden Verbindungen offen genannt?", text: "Gehören Partner zum selben Eigentümer, gehört das auf die Seite — nicht ins Kleingedruckte." },
        ],
      },
      {
        typ: "text", id: "fiaon", h2: "Dieselbe Liste für FIAON Global",
        absaetze: [
          "Unser Vertragspartner ist die FIAON LTD, eingetragen im Companies House unter der Nummer 17318250. Der Festpreis steht mit Leistungsverzeichnis im Vertrag, die laufenden Kosten ab dem zweiten Jahr nennen wir vorab. Zu Steuern geben wir keine Zusagen, und wir sagen weder Karten noch Rahmen zu.",
          GLOBAL_ROLLEN.de.partner,
          GLOBAL_VERBUNDEN,
        ],
      },
      {
        typ: "hinweis", id: "wissen", h2: "Was Sie wissen müssen",
        punkte: [
          "Eine Rechtsform sagt nichts über Seriosität — weder eine LLC noch eine Ltd noch eine GmbH.",
          "Prüfen Sie Registernummern selbst: im Companies House, in Zefix oder im Handelsregister.",
          GLOBAL_PFLICHTHINWEIS.de[2],
        ],
      },
    ],
    fragen: [
      { f: "Woran erkenne ich einen seriösen Anbieter für die US-Gründung?", a: "An einem prüfbaren Vertragspartner mit Registernummer, einem Festpreis mit Leistungsverzeichnis, klaren Pflichthinweisen und dem Verzicht auf Zusagen zu Steuern, Karten und Krediten." },
      { f: "Ist eine LLC an sich unseriös?", a: "Nein. Die LLC ist eine gewöhnliche Rechtsform in den USA. Über Seriosität entscheidet, wie ein Anbieter arbeitet — nicht, welche Rechtsform er hat." },
      { f: "Wie prüfe ich die Registernummer von FIAON?", a: "Im Companies House (England and Wales) unter der Nummer 17318250. Die Schwarzott Capital Partners AG finden Sie in Zefix unter CHE-102.119.428." },
    ],
    weiter: ["/business/partner", "/business/vergleich", "/business/kosten", "/business/wissen/us-firmenkarte-beantragen"],
    quellen: [
      { titel: "Companies House — FIAON LTD", url: "https://find-and-update.company-information.service.gov.uk/company/17318250" },
      { titel: "Zefix — Schwarzott Capital Partners AG", url: "https://www.zefix.ch/de/search/entity/list/firm/304048" },
    ],
  },
];
