// ═══════════════════════════════════════════════════════════════════════════
// FIAON GLOBAL — DIE KOSTEN (19.09.2026, E-191)
// „LLC gründen Kosten" ist eine der häufigsten Suchen. Diese Seite rechnet vor:
// unser Honorar, was es im ersten Jahr umfasst, was ab dem zweiten Jahr anfällt,
// was die Staaten verlangen — und was es kosten würde, alles selbst zu organisieren.
// Zahlen Dritter aus fakten.ts (Quelle und Stand dort).
// E-509 (12.11.2026): EIN Produkt statt vier Pakete — das Erfolgshonorar nach Kapitalrahmen
// (Beispiele gerechnet mit verkaufPreis, derselben Funktion wie Honorarrechner und Vertrag), die Jahresbetreuung.
// E-510 (13.11.2026): nach dem Sprachleitfaden (Abschnitt 7.5 Kostenseite). Das Suchwort „Kosten“ bleibt in Titel und H1,
// im Text heißt unser Entgelt „Honorar“. Das Honorar steht immer in drei Zeilen (fester Satz S12), „mindestens“ statt „ab“.
// Feste Sätze, Beträge und die Erstattung kommen aus shared/fiaon-global-saetze.ts — hier wird keiner davon getippt.
// Kein Wort zur Bürgschaft, keine Dauer als Zusage: Eintragungszeiten sind Erfahrungswerte mit Stand (Satz S15).
// ═══════════════════════════════════════════════════════════════════════════
import { GLOBAL_KAPITAL_FREI } from "../fiaon-global";
import { VERKAUF_KURS_VORGABE, verkaufEur, verkaufPreis, verkaufUsd } from "../fiaon-global-verkauf";
import { VERKAUF_RAHMEN } from "../fiaon-global-verkauf-preise";
import { GELD_ZURUECK, SAETZE_BETRAEGE, SECHS_SCHRITTE, beleg, satz, weitererSatz } from "../fiaon-global-saetze";
import { EIN_PRODUKT } from "./ein-produkt";
import { FAKTEN_STAND, IRS, MARKT, QUELLEN_IRS, QUELLEN_STAATEN, STAAT } from "./fakten";
import type { GlobalSeite } from "./typen";
// E-465 (29.10.2026): Eintragungszeiten und Express je Staat aus der einen Quelle.
import { BUNDESSTAATEN, STAATEN_STAND_TEXT } from "../fiaon-global-bundesstaaten";

/** Die Beträge aus der Preisquelle — nie getippt. */
const B = SAETZE_BETRAEGE.de;
/** Aus ein-produkt.ts, damit alle Seiten dasselbe sagen: die Liste „im ersten Jahr enthalten“, die Zeile zum Erfolgshonorar (aus S12) und die Überschrift der Karte „Ein Mandat“. */
const P = EIN_PRODUKT.de;
/** Beispiele für das Erfolgshonorar — gerechnet wie im Honorarrechner, zum Rückfall-Kurs der Anzeige. Erster und letzter Wert aus der Preisquelle. */
const BEISPIEL_RAHMEN = [VERKAUF_RAHMEN.minUsd, 100_000, 150_000, 250_000, 500_000, VERKAUF_RAHMEN.selbstMaxUsd];
const KURS_TAG = VERKAUF_KURS_VORGABE.kursDatum.replace(/^(\d{4})-(\d{2})-(\d{2})$/, "$3.$2.$1");
const KURS = VERKAUF_KURS_VORGABE.kursUsdJeEur.toLocaleString("de-DE", { minimumFractionDigits: 4, maximumFractionDigits: 4 });

/** Das Honorar in drei Zeilen — der feste Satz S12, wortgleich. */
const S12 = satz("S12");
/** Das Honorar in Kurzform (Leitfaden 1.3, Antwort „Was kostet es — und wann?“) — für Antworten, in denen S12 zu lang wäre. */
const HONORAR_KURZ = `${B.honorarAuftrag} mit Ihrem Auftrag. Mit der Eintragung Ihrer Gesellschaft das Erfolgshonorar nach Ihrem Kapitalrahmen, mindestens ${B.erfolgMin}. Ab dem zweiten Jahr auf Wunsch ${B.jahresbetreuung} im Jahr.`;
/** Schritt 5 (Finanzierung): die Folge, wenn sie ausbleibt — aus der Tabelle „Wer macht was“. */
const WENN_ES_AUSBLEIBT = SECHS_SCHRITTE.de.find((s) => s.nr === 5)?.werMachtWas.wennEsAusbleibt ?? satz("S7");
/** „60 $ bis 400 $“ — die Spanne der jährlichen Staatsgebühr, aus fakten.ts gebaut. */
const JAHR_SPANNE = `${STAAT.wyoming.jahr.replace(/^mindestens /, "")} bis ${STAAT.delaware.jahr}`;
const GRUENDUNG_SPANNE = `${STAAT.wyoming.gruendung} bis ${STAAT.florida.gruendung}`;

export const KOSTEN: GlobalSeite[] = [
  {
    pfad: "/business/kosten",
    art: "preise",
    seo: {
      titel: "LLC gründen: Kosten im Überblick — FIAON Global",
      beschreibung: "Was eine US-LLC kostet: Staatsgebühren in Delaware, Florida und Wyoming, laufende Kosten ab dem zweiten Jahr, unser Honorar — mit Quellen und Stand.",
    },
    stand: "2026-11-13",
    kennung: "FG · 07",
    auge: "Honorar und Ablauf · Kosten",
    h1: "Was eine US-LLC kostet.",
    h1b: "Einmalige und laufende Kosten, mit Quellen.",
    lead: "Beim Bundesstaat kostet die Gründung einer US-Gesellschaft wenig. Den größeren Teil der Kosten machen Registered Agent, jährliche US-Meldung und Steuerberater aus. Diese Seite führt jeden Betrag auf: unser Honorar, was es im ersten Jahr umfasst und was ab dem zweiten Jahr anfällt.",
    // Das Honorar steht im Blickfang vollständig: drei Beträge, jeder mit seinem Zeitpunkt (Leitfaden 5.6).
    ziffern: [
      { wert: B.honorarAuftrag, label: "mit Ihrem Auftrag: Gründung und aktive Betreuung im ersten Jahr" },
      { wert: `mindestens ${B.erfolgMin}`, label: "Erfolgshonorar, fällig mit der Eintragung Ihrer Gesellschaft" },
      { wert: `${B.jahresbetreuung} im Jahr`, label: "Jahresbetreuung ab dem zweiten Jahr, auf Wunsch" },
    ],
    blick: [
      ["Staat, einmalig", `Delaware ${STAAT.delaware.gruendung} · Florida ${STAAT.florida.gruendung} · Wyoming ${STAAT.wyoming.gruendung}`],
      ["Staat, jährlich", `Delaware ${STAAT.delaware.jahr} · Florida ${STAAT.florida.jahr} · Wyoming ${STAAT.wyoming.jahr}`],
      ["IRS", "EIN und ITIN ohne Gebühr der US-Steuerbehörde"],
      ["Wir übernehmen", "Gründung, Unterlagen und die Anträge für EIN und ITIN; Ihre Anträge für Konten, Kreditkarten auf Wunsch und Finanzierung bereiten wir vollständig vor"],
      ["Sie selbst", "Namen wählen, Reisepass hochladen, unterzeichnen; die Anträge bei Institut und Kartenherausgeber stellen Sie selbst"],
      ["Wer entscheidet", "Über die Eintragung der Bundesstaat, über EIN und ITIN die US-Steuerbehörde, über Konto, Karte und Finanzierung das jeweilige Institut"],
      ["Erstattung", WENN_ES_AUSBLEIBT],
      ["Endpreise", "Alle Beträge sind Endpreise und stehen in Ihrem Angebot, bevor Sie unterzeichnen"],
    ],
    kurz: `Beim Bundesstaat kostet die Gründung einer US-LLC ${STAAT.wyoming.gruendung} (Wyoming) bis ${STAAT.florida.gruendung} (Florida); EIN und ITIN erteilt die US-Steuerbehörde IRS ohne Gebühr. ${S12}`,
    bloecke: [
      {
        typ: "tabelle", id: "festpreise", h2: "Was kostet die Gründung einer US-LLC mit FIAON Global?",
        lead: `Ein Mandat: ${weitererSatz("PRODUKTNAME")}. ${weitererSatz("ZAHLUNG")}`,
        kopf: ["Wann", "Was", "Betrag"],
        zeilen: [
          ["Mit Ihrem Auftrag", "Gründung und aktive Betreuung im ersten Jahr", B.honorarAuftrag],
          ["Mit Ihrem Auftrag, auf Wunsch", "Fast-Track: Vorrang in allen Schritten", B.fastTrack],
          ["Mit der Eintragung Ihrer Gesellschaft", "Erfolgshonorar nach Ihrem Kapitalrahmen", `mindestens ${B.erfolgMin}`],
          ["Ab dem zweiten Jahr, auf Wunsch", "Jahresbetreuung; sie verlängert sich nicht von selbst", `${B.jahresbetreuung} im Jahr`],
        ],
        hervor: 2,
        fuss: [`${weitererSatz("HONORAR-SCHLUSS")} ${beleg("honorarVorab")}`],
      },
      {
        typ: "tabelle", id: "erfolgshonorar", h2: "Das Erfolgshonorar nach Kapitalrahmen",
        lead: P.erfolg,
        kopf: ["Kapitalrahmen", "Erfolgshonorar", "Erstes Jahr insgesamt"],
        zeilen: BEISPIEL_RAHMEN.map((usd) => { const p = verkaufPreis(usd, VERKAUF_KURS_VORGABE.kursUsdJeEur); return [verkaufUsd(usd, "de"), verkaufEur(p.erfolgCents, "de"), verkaufEur(p.erstesJahrCents, "de")]; }),
        hervor: 1,
        fuss: [
          `Beispiele ohne Fast-Track, umgerechnet zum Referenzkurs der Europäischen Zentralbank vom ${KURS_TAG} (1 € = ${KURS} US-$). Ihre Honorarübersicht für Ihren Kapitalrahmen zeigt der Honorarrechner.`,
          // Die Zahl zum Kapitalrahmen steht nie allein: S9 und S1 im selben Blick (Leitfaden 5.8).
          `${satz("S9")} ${satz("S1")}`,
          weitererSatz("MIAMI"),
          // 19.09.2026 (Justin): Das Kapital ist nicht an die USA gebunden — Wortlaut aus GLOBAL_KAPITAL_FREI, immer mit dem Satz zum Partner-Steuerberater.
          `${GLOBAL_KAPITAL_FREI.de.satz} ${GLOBAL_KAPITAL_FREI.de.steuer}`,
        ],
      },
      {
        typ: "text", id: "enthalten", h2: "Erstes Jahr: enthalten und nicht enthalten",
        absaetze: [`Ihr Honorar umfasst im ersten Jahr die folgenden Leistungen. ${weitererSatz("ROLLEN")}`],
        punkte: [...P.enthalten],
        nach: "Nicht enthalten sind Gebühren und Zinsen der Herausgeber und Institute, die Kosten des Darlehens und Steuern. Auf Wunsch kommen hinzu: die Jahresbetreuung ab dem zweiten Jahr und Fast-Track. Die Anträge bei Institut und Kartenherausgeber stellen Sie selbst.",
      },
      {
        typ: "tabelle", id: "staaten", h2: "Was die Bundesstaaten verlangen",
        lead: "Die drei Bundesstaaten, in denen wir gründen — Beträge für eine LLC.",
        kopf: ["", "Delaware", "Florida", "Wyoming"],
        zeilen: [
          ["Gründung", STAAT.delaware.gruendung, STAAT.florida.gruendung, STAAT.wyoming.gruendung],
          ["Jährlich", `${STAAT.delaware.jahr} (${STAAT.delaware.jahrName})`, `${STAAT.florida.jahr} (${STAAT.florida.jahrName})`, `${STAAT.wyoming.jahr} (${STAAT.wyoming.jahrName})`],
          ["Frist", STAAT.delaware.jahrFrist, "1. Januar bis 1. Mai", "Gründungsmonat"],
          ["Bei Verzug", STAAT.delaware.jahrVerzug.replace(/^bei Verzug /, ""), STAAT.florida.jahrVerzug, STAAT.wyoming.jahrVerzug],
          ["Registered Agent", "Pflicht", "Pflicht", "Pflicht"],
          [`Eintragung, Erfahrungswert (Stand ${STAATEN_STAND_TEXT.de})`, BUNDESSTAATEN.delaware.eintragungKurz.de, BUNDESSTAATEN.florida.eintragungKurz.de, BUNDESSTAATEN.wyoming.eintragungKurz.de],
          ["Express", BUNDESSTAATEN.delaware.express.kurz.de, BUNDESSTAATEN.florida.express.kurz.de, BUNDESSTAATEN.wyoming.express.kurz.de],
        ],
        fuss: [
          `Quelle: Gebührenordnungen und Gesetze der drei Bundesstaaten (Quellen am Ende der Seite). Stand: ${FAKTEN_STAND}. ${STAAT.florida.gruendung} in Florida = ${STAAT.florida.gruendungDetail}.`,
          `Delaware: ${STAAT.delaware.jahrAlt}`,
          `Wyoming: ${STAAT.wyoming.jahrDetail}.`,
          `Eintragungszeiten: Stand ${STAATEN_STAND_TEXT.de}; über die Eintragung entscheidet der Bundesstaat. ${satz("S15")}`,
          "Für Corporations gelten andere Beträge; die Einzelheiten stehen auf den Internetseiten der Bundesstaaten.",
        ],
      },
      {
        typ: "tabelle", id: "laufend", h2: "Laufende Kosten ab dem zweiten Jahr",
        lead: `Ab dem zweiten Jahr fallen die laufenden Kosten Ihrer Gesellschaft an: Staatsgebühr, Registered Agent und die jährliche US-Meldung. Mit der Jahresbetreuung übernehmen wir diese Posten für ${B.jahresbetreuung} im Jahr; sie verlängert sich nicht von selbst.`,
        kopf: ["Posten", "Betrag", "Bemerkung"],
        zeilen: [
          ["Staatsgebühr oder -steuer", JAHR_SPANNE, "je nach Bundesstaat, siehe oben"],
          ["Registered Agent", MARKT.agent, "gesetzlich vorgeschrieben"],
          ["Form 5472 mit Form 1120", MARKT.cpa5472, "durch einen US-Steuerberater (CPA), auch ohne Umsatz Pflicht"],
          ["Steuerberater im Wohnsitzland", "nach dessen Honorar", "Steuererklärung und Meldung der Beteiligung"],
          ["Jahresbetreuung FIAON Global", `${B.jahresbetreuung} im Jahr`, "auf Wunsch: Staatsgebühr, Registered Agent, US-Geschäftsadresse, US-Telefonnummer und Form 5472 enthalten"],
        ],
        fuss: [`Registered Agent und US-Steuerberater (CPA): veröffentlichte Angaben mehrerer Anbieter, Stand ${FAKTEN_STAND} — keine amtlichen Werte. Die Jahresbetreuung umfasst alle Posten außer dem Steuerberater im Wohnsitzland.`],
      },
      {
        typ: "tabelle", id: "selbst", h2: "Selbst organisiert oder in einem Mandat",
        lead: "Zur Einordnung: was jede Stelle einzeln kostet. Wer nur eine Gesellschaft braucht und alles selbst koordiniert, zahlt weniger als bei uns. Koordination und Risiko liegen dann bei ihm.",
        kopf: ["Posten", "Selbst organisiert", "FIAON Global"],
        zeilen: [
          ["Gründungsgebühr des Staats", GRUENDUNG_SPANNE, "enthalten"],
          ["Registered Agent, erstes Jahr", MARKT.agent.replace(" im Jahr", ""), "enthalten"],
          ["US-Geschäftsadresse und US-Telefonnummer", "nach Anbieter", "enthalten, erstes Jahr"],
          ["EIN", "keine Gebühr, Ihr Aufwand", "Antrag enthalten"],
          ["ITIN über einen Acceptance Agent", MARKT.acceptanceAgent, "Antrag nach unserem ITIN-Check enthalten"],
          ["Operating Agreement", "Vorlage oder Anwalt, nach dessen Honorar", "enthalten"],
          ["Steuerliche Fragen vorab", "Steuerberater, nach dessen Honorar", "liegen bei Partner-Steuerberatern; ihr Honorar trägt FIAON"],
          ["Erste Form 5472 durch einen US-Steuerberater (CPA)", MARKT.cpa5472.replace(" im Jahr", ""), "enthalten"],
          ["Vorbereitung der Konto- und Kartenanträge", "Ihre Zeit", "enthalten; es entscheidet das jeweilige Institut"],
        ],
        hervor: 2,
        fuss: [`Gebühren der Staaten und der IRS: amtliche Werte, Stand ${FAKTEN_STAND}. Übrige Posten: Marktspannen nach veröffentlichten Angaben mehrerer Anbieter, Stand ${FAKTEN_STAND}.`],
      },
      {
        // Geld zurück in der Mittel-Form (Leitfaden 5.7) — nur bei der Finanzierung, mit Fristbeginn, Ziffer 4 und dem Institut-Satz (beides in S7).
        typ: "text", id: "geld-zurueck", h2: GELD_ZURUECK.de.auge,
        absaetze: [satz("S7")],
        punkte: [...GELD_ZURUECK.de.mittel],
        nach: "Für Konto und Karten gilt das nicht.",
      },
      {
        typ: "hinweis", id: "wissen", h2: "Was Sie wissen müssen",
        punkte: [
          "Laufende Buchhaltung, Umsatzsteuer-Registrierungen in den USA und die Steuererklärung im Wohnsitzland sind nicht Teil Ihres Mandats.",
          `Für eine versäumte Form 5472 kann die US-Steuerbehörde IRS eine Strafe von ${IRS.strafe5472} festsetzen.`,
          `Gebühren der Staaten ändern sich: Delaware hat die Jahressteuer der LLC ab dem Steuerjahr 2026 von 300 $ auf ${STAAT.delaware.jahr} angehoben.`,
          // Über den Honorarrechner wird in Delaware gegründet; Florida oder Wyoming werden im Gespräch abgestimmt (wie auf den Staatsseiten).
          "Wir gründen in Delaware, Florida oder Wyoming. Im Honorarrechner ist Delaware als Bundesstaat vorgesehen; einen anderen Staat stimmen wir im Gespräch mit Ihnen ab. Banken und Investoren ist Delaware vertraut.",
        ],
      },
      { typ: "pakete", id: "mandat", h2: P.karteH2, lead: "Ihre Honorarübersicht für Ihren Kapitalrahmen zeigt der Honorarrechner." },
    ],
    fragen: [
      { f: "Was kostet es, eine LLC in den USA zu gründen?", a: `Beim Bundesstaat ${STAAT.wyoming.gruendung} (Wyoming), ${STAAT.delaware.gruendung} (Delaware) oder ${STAAT.florida.gruendung} (Florida). Hinzu kommen die Kosten am Markt für Registered Agent, US-Geschäftsadresse, Operating Agreement und die jährliche US-Meldung. Unser Honorar: ${HONORAR_KURZ}` },
      { f: "Welche laufenden Kosten hat eine US-LLC?", a: `Drei Posten im Jahr. Die Staatsgebühr oder -steuer: ${JAHR_SPANNE} je nach Staat. Der Registered Agent: am Markt ${MARKT.agent}. Die Meldung an die US-Steuerbehörde durch einen US-Steuerberater (CPA): am Markt ${MARKT.cpa5472}. Mit der Jahresbetreuung übernehmen wir diese Posten für ${B.jahresbetreuung} im Jahr; sie verlängert sich nicht von selbst.` },
      { f: "Was kosten EIN und ITIN?", a: `Bei der US-Steuerbehörde IRS nichts. Wer die ITIN über einen Acceptance Agent beantragt, zahlt am Markt ${MARKT.acceptanceAgent}. Bei FIAON Global sind beide Anträge im Honorar enthalten; die ITIN beantragen wir nach unserem ITIN-Check. Über beide Nummern entscheidet die US-Steuerbehörde.` },
      { f: "Was ist im Honorar nicht enthalten?", a: `Nicht enthalten sind Gebühren und Zinsen der Herausgeber und Institute, die Kosten des Darlehens und Steuern. Auf Wunsch kommen hinzu: die Jahresbetreuung ab dem zweiten Jahr (${B.jahresbetreuung} im Jahr) und Fast-Track (${B.fastTrack}). Laufende Buchhaltung und die Steuererklärung im Wohnsitzland sind ebenfalls nicht Teil Ihres Mandats. Was das Honorar umfasst, steht in Ihrem Vertrag.` },
      { f: "Was zahle ich wann?", a: S12 },
      { f: "Warum ist das Honorar höher als die Staatsgebühr?", a: "Weil es mehr umfasst als die Anmeldung beim Bundesstaat: die Unterlagen Ihrer Gesellschaft, Ihr US-Büro im ersten Jahr und die Anträge für EIN und ITIN. Hinzu kommen die erste US-Meldung und vollständig vorbereitete Konto- und Kartenanträge; über sie entscheidet das jeweilige Institut. Die Honorare der Partner für die Leistungen Ihres Vertrags trägt FIAON." },
    ],
    weiter: ["/business/delaware", "/business/florida", "/business/wyoming", "/business/wissen/bundesstaat-waehlen", "/business/vergleich", "/business/ablauf", "/business/privatpersonen", "/business/us-pflichten"],
    quellen: [...QUELLEN_STAATEN.florida.slice(0, 2), QUELLEN_STAATEN.delaware[0], QUELLEN_STAATEN.delaware[1], QUELLEN_STAATEN.wyoming[0], QUELLEN_STAATEN.wyoming[1], QUELLEN_IRS[0], QUELLEN_IRS[2], QUELLEN_IRS[4]],
  },
];
