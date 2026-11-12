// ═══════════════════════════════════════════════════════════════════════════
// FIAON GLOBAL — DIE KOSTEN (19.09.2026, E-191)
// „LLC gründen Kosten" ist eine der häufigsten Suchen. Diese Seite sagt alles:
// den Preis, was er enthält, was ab dem zweiten Jahr anfällt, was die
// Staaten verlangen — und was es kosten würde, alles selbst zu organisieren.
// Zahlen Dritter aus fakten.ts (Quelle und Stand dort).
// E-509 (12.11.2026): EIN Produkt statt vier Pakete — der eine Preis, das Erfolgshonorar nach Kapitalrahmen
// (Beispiele gerechnet mit verkaufPreis, derselben Funktion wie Konfigurator und Vertrag), die Jahresbetreuung.
// ═══════════════════════════════════════════════════════════════════════════
import { GLOBAL_KAPITAL_FREI, GLOBAL_LAUFEND } from "../fiaon-global";
import { VERKAUF_KURS_VORGABE, verkaufEur, verkaufPreis, verkaufUsd } from "../fiaon-global-verkauf";
import { EIN_PRODUKT } from "./ein-produkt";
import { FAKTEN_STAND, IRS, MARKT, QUELLEN_IRS, QUELLEN_STAATEN, STAAT } from "./fakten";
import type { GlobalSeite } from "./typen";
// E-465 (29.10.2026): Eintragungszeiten und Express je Staat aus der einen Quelle.
import { BUNDESSTAATEN, STAAT_WAHL_SATZ, STAATEN_STAND_TEXT } from "../fiaon-global-bundesstaaten";

const P = EIN_PRODUKT.de;
/** Beispiele für das Erfolgshonorar — gerechnet wie im Konfigurator, zum Rückfall-Kurs der Anzeige. */
const BEISPIEL_RAHMEN = [50_000, 100_000, 150_000, 250_000, 500_000, 950_000];
const KURS_TAG = VERKAUF_KURS_VORGABE.kursDatum.replace(/^(\d{4})-(\d{2})-(\d{2})$/, "$3.$2.$1");
const KURS = VERKAUF_KURS_VORGABE.kursUsdJeEur.toLocaleString("de-DE", { minimumFractionDigits: 4, maximumFractionDigits: 4 });

export const KOSTEN: GlobalSeite[] = [
  {
    pfad: "/business/kosten",
    art: "preise",
    seo: {
      titel: "LLC gründen: Kosten im Überblick — FIAON Global",
      beschreibung: "Was eine US-LLC kostet: Staatsgebühren in Florida, Delaware und Wyoming, laufende Kosten ab Jahr zwei und der Preis von FIAON Global — mit Quellen.",
    },
    stand: "2026-11-12",
    kennung: "FG · 07",
    auge: "Preise und Ablauf · Kosten",
    h1: "Was eine US-Firma kostet.",
    h1b: "Einmalig, jährlich — offen gesagt.",
    lead: "Eine US-Gesellschaft kostet beim Staat wenig. Teuer werden die Dinge, die niemand vorher nennt: Registered Agent, jährliche Meldung, Steuerberater, US-CPA. Hier steht alles — der Preis von FIAON Global, was er enthält und was ab dem zweiten Jahr anfällt.",
    ziffern: [
      { wert: P.preis, label: P.preisLabel },
      { wert: `${STAAT.wyoming.gruendung} bis ${STAAT.florida.gruendung}`, label: "Gründungsgebühr des Staats für eine LLC" },
      { wert: "ab Jahr zwei", label: "Staat, Registered Agent, US-Meldung — vorab genannt" },
    ],
    blick: [
      ["Preis", `${P.preis} mit Ihrem Auftrag · Erfolgshonorar mit der Eintragung · ${P.jahres} im Jahr ab Jahr zwei`],
      ["Enthalten", "Staatsgebühr, Registered Agent, Adresse, Telefon und Assistenz im ersten Jahr, EIN, ITIN, Anwalt, US-Steuerberater"],
      ["Staat, einmalig", `Florida ${STAAT.florida.gruendung} · Delaware ${STAAT.delaware.gruendung} · Wyoming ${STAAT.wyoming.gruendung}`],
      ["Staat, jährlich", `Florida ${STAAT.florida.jahr} · Delaware ${STAAT.delaware.jahr} · Wyoming ${STAAT.wyoming.jahr}`],
      ["IRS", "EIN und ITIN ohne Gebühr"],
      ["Endpreise", "Alle Beträge sind Endpreise"],
    ],
    kurz: `Die Gründung einer US-LLC kostet beim Bundesstaat ${STAAT.wyoming.gruendung} (Wyoming) bis ${STAAT.florida.gruendung} (Florida); EIN und ITIN vergibt die IRS ohne Gebühr. Jährlich fallen die Staatsgebühr oder -steuer, der Registered Agent (am Markt ${MARKT.agent}) und die Meldung an die IRS durch einen US-CPA (am Markt ${MARKT.cpa5472}) an. Bei FIAON Global ist das erste Jahr im Preis von ${P.preis} enthalten — mit Anwalt und US-Steuerberater aus unserem Partnernetz.`,
    bloecke: [
      {
        typ: "tabelle", id: "festpreise", h2: "Der Preis",
        lead: `Ein Auftrag: ${P.name}. Kein Abo, keine Monatsrate.`,
        kopf: ["Wann", "Was", "Preis"],
        zeilen: [
          ["Mit Ihrem Auftrag", "Gründung mit aktiver Betreuung im ersten Jahr", P.preis],
          ["Mit Ihrem Auftrag, auf Wunsch", "Fast-Track: Vorrang in allen Schritten", P.fastTrack],
          ["Mit der Eintragung", "Erfolgshonorar nach Ihrem Kapitalrahmen, Bürgschaft enthalten", "siehe unten"],
          ["Ab dem zweiten Jahr, auf Wunsch", "Jahresbetreuung", `${P.jahres} im Jahr`],
        ],
        hervor: 2,
        fuss: [
          "Alle Beträge sind Endpreise. Den Kapitalrahmen wählen Sie selbst; über die Finanzierung entscheidet das finanzierende Institut.",
          // 19.09.2026 (Justin): Das Kapital ist nicht an die USA gebunden — Wortlaut aus GLOBAL_KAPITAL_FREI.
          `${GLOBAL_KAPITAL_FREI.de.satz} ${GLOBAL_KAPITAL_FREI.de.steuer}`,
        ],
      },
      {
        typ: "tabelle", id: "erfolgshonorar", h2: "Das Erfolgshonorar nach Kapitalrahmen",
        lead: P.erfolg,
        kopf: ["Kapitalrahmen", "Erfolgshonorar", "Erstes Jahr insgesamt"],
        zeilen: BEISPIEL_RAHMEN.map((usd) => { const p = verkaufPreis(usd, VERKAUF_KURS_VORGABE.kursUsdJeEur); return [verkaufUsd(usd, "de"), verkaufEur(p.erfolgCents, "de"), verkaufEur(p.erstesJahrCents, "de")]; }),
        hervor: 1,
        fuss: [
          `Beispiele ohne Fast-Track, umgerechnet zum Referenzkurs der Europäischen Zentralbank vom ${KURS_TAG} (1 € = ${KURS} US-$). Ihren genauen Preis zeigt der Konfigurator.`,
          "Ab 1 Mio. US-Dollar begleiten wir Sie persönlich in Miami; darunter läuft alles aus der Ferne.",
        ],
      },
      {
        typ: "text", id: "enthalten", h2: "Was im Preis enthalten ist",
        absaetze: ["Sie zahlen einen Preis. Die Honorare unserer Partner für die Leistungen Ihres Auftrags tragen wir:"],
        punkte: [...P.enthalten],
        nach: "Recht und Steuern leisten Anwälte und US-Steuerberater aus unserem Partnernetz, jeweils im eigenen Mandat. Anträge bei Bank und Kartenherausgeber stellen Sie selbst; wir bereiten jeden vollständig vor.",
      },
      {
        typ: "tabelle", id: "staaten", h2: "Was die Bundesstaaten verlangen",
        lead: "Die drei Staaten, nach denen am häufigsten gefragt wird — Beträge für eine LLC.",
        kopf: ["", "Florida", "Delaware", "Wyoming"],
        zeilen: [
          ["Gründung", STAAT.florida.gruendung, STAAT.delaware.gruendung, STAAT.wyoming.gruendung],
          ["Jährlich", `${STAAT.florida.jahr} (${STAAT.florida.jahrName})`, `${STAAT.delaware.jahr} (${STAAT.delaware.jahrName})`, `${STAAT.wyoming.jahr} (${STAAT.wyoming.jahrName})`],
          ["Frist", "1. Januar bis 1. Mai", STAAT.delaware.jahrFrist, "Gründungsmonat"],
          ["Bei Verzug", STAAT.florida.jahrVerzug, STAAT.delaware.jahrVerzug, "Auflösung nach 60 Tagen möglich"],
          ["Registered Agent", "Pflicht", "Pflicht", "Pflicht"],
          [`Eintragung (Stand ${STAATEN_STAND_TEXT.de})`, BUNDESSTAATEN.florida.eintragungKurz.de, BUNDESSTAATEN.delaware.eintragungKurz.de, BUNDESSTAATEN.wyoming.eintragungKurz.de],
          ["Express", BUNDESSTAATEN.florida.express.kurz.de, BUNDESSTAATEN.delaware.express.kurz.de, BUNDESSTAATEN.wyoming.express.kurz.de],
        ],
        fuss: [
          `Stand ${FAKTEN_STAND}; Eintragungszeiten Stand ${STAATEN_STAND_TEXT.de}, Erfahrungswerte ohne Zusage. ${STAAT.florida.gruendung} in Florida = ${STAAT.florida.gruendungDetail}.`,
          `Delaware: ${STAAT.delaware.jahrAlt}`,
          `Wyoming: ${STAAT.wyoming.jahrDetail}.`,
          "Für Corporations gelten andere Beträge; die Einzelheiten stehen auf den Seiten der Bundesstaaten.",
        ],
      },
      {
        typ: "tabelle", id: "laufend", h2: "Was ab dem zweiten Jahr jährlich anfällt",
        lead: GLOBAL_LAUFEND.de,
        kopf: ["Posten", "Betrag", "Bemerkung"],
        zeilen: [
          ["Staatsgebühr oder -steuer", "60 $ bis 400 $", "je nach Bundesstaat, siehe oben"],
          ["Registered Agent", MARKT.agent, "gesetzlich vorgeschrieben"],
          ["Form 5472 mit Form 1120", MARKT.cpa5472, "durch einen US-CPA, auch ohne Umsatz Pflicht"],
          ["Steuerberater im Heimatland", "nach dessen Honorar", "Steuererklärung und Meldung der Beteiligung"],
          ["Jahresbetreuung FIAON Global", `${P.jahres} im Jahr`, "Staatsgebühr, Registered Agent, Adresse, Telefon und Form 5472 inklusive"],
        ],
        fuss: [`Registered Agent und US-CPA: veröffentlichte Preise mehrerer Anbieter, September 2026 — keine amtlichen Werte. Mit der Jahresbetreuung übernehmen wir alle Posten außer dem Steuerberater im Heimatland für ${P.jahres} im Jahr, alle Gebühren inklusive (19.09.2026).`],
      },
      {
        typ: "tabelle", id: "selbst", h2: "Selbst organisiert — oder aus einer Hand",
        lead: "Was jede Stelle einzeln kosten würde. Wer nur eine Gesellschaft braucht und alles selbst koordiniert, zahlt weniger als bei uns — und trägt jedes Risiko allein.",
        kopf: ["Posten", "Selbst organisiert", "FIAON Global"],
        zeilen: [
          ["Gründungsgebühr des Staats", `${STAAT.wyoming.gruendung} bis ${STAAT.florida.gruendung}`, "enthalten"],
          ["Registered Agent, erstes Jahr", MARKT.agent.replace(" im Jahr", ""), "enthalten"],
          ["US-Adresse und Telefonnummer", "nach Anbieter", "enthalten, erstes Jahr"],
          ["EIN", "keine Gebühr, Ihr Aufwand", "enthalten"],
          ["ITIN über einen Acceptance Agent", MARKT.acceptanceAgent, "enthalten"],
          ["Operating Agreement durch einen Anwalt", "nach Honorar", "enthalten"],
          ["Prüfung durch einen Steuerberater", "nach Honorar", "enthalten"],
          ["Erste Form 5472 durch einen US-CPA", MARKT.cpa5472.replace(" im Jahr", ""), "enthalten"],
          ["Konto- und Kartenantrag, Koordination", "Ihre Zeit", "enthalten"],
        ],
        hervor: 2,
        fuss: [`Gebühren der Staaten und der IRS: amtliche Werte, Stand ${FAKTEN_STAND}. Übrige Posten: Marktspannen.`],
      },
      {
        typ: "hinweis", id: "wissen", h2: "Was Sie wissen müssen",
        punkte: [
          "Laufende Buchhaltung, Umsatzsteuer-Registrierungen in den USA und die Steuererklärung im Heimatland sind nicht Teil Ihres Auftrags.",
          `Für eine versäumte Form 5472 kann die IRS ${IRS.strafe5472} festsetzen — die teuerste Position ist die vergessene.`,
          "Gebühren der Staaten ändern sich: Delaware hat die Jahressteuer der LLC ab dem Steuerjahr 2026 von 300 $ auf 400 $ angehoben.",
          STAAT_WAHL_SATZ.de,
        ],
      },
      { typ: "pakete", id: "mandat", h2: P.karteH2, lead: P.karteLead },
    ],
    fragen: [
      { f: "Was kostet es, eine LLC in den USA zu gründen?", a: `Beim Bundesstaat ${STAAT.wyoming.gruendung} (Wyoming), ${STAAT.delaware.gruendung} (Delaware) oder ${STAAT.florida.gruendung} (Florida). Dazu kommen Registered Agent, Adresse, Anwalt, Steuerberater und US-CPA. Bei FIAON Global ist all das im Preis von ${P.preis} enthalten.` },
      { f: "Welche laufenden Kosten hat eine US-LLC?", a: `Jährlich die Staatsgebühr oder -steuer (60 $ bis 400 $ je nach Staat), den Registered Agent (am Markt ${MARKT.agent}) und die Meldung an die IRS durch einen US-CPA (am Markt ${MARKT.cpa5472}).` },
      { f: "Was kosten EIN und ITIN?", a: `Bei der IRS nichts. Wer die ITIN über einen Acceptance Agent beantragt, zahlt am Markt ${MARKT.acceptanceAgent}. Bei FIAON Global sind beide Anträge im Preis enthalten.` },
      { f: "Gibt es versteckte Kosten?", a: `Nein. Was im Preis steckt, steht im Vertrag. Die laufenden Kosten Ihrer Gesellschaft ab dem zweiten Jahr übernimmt auf Wunsch die Jahresbetreuung für ${P.jahres} im Jahr, alle Gebühren inklusive; Buchhaltung und Steuererklärung im Heimatland sind nicht Teil Ihres Auftrags.` },
      { f: "Was zahle ich wann?", a: P.preisSatzKurz },
      { f: "Warum ist der Preis höher als die Staatsgebühr?", a: "Weil er alle enthält, die für Ihre Gesellschaft arbeiten: Registered Agent, Adresse, Telefon, Assistenz, Anwalt, US-Steuerberater, die Anträge für EIN und ITIN und die Vorbereitung von Konto und Karten — koordiniert von einem Ansprechpartner." },
    ],
    weiter: ["/business/wissen/bundesstaat-waehlen", "/business/vergleich", "/business/ablauf", "/business/privatpersonen", "/business/us-pflichten"],
    quellen: [...QUELLEN_STAATEN.florida.slice(0, 2), QUELLEN_STAATEN.delaware[0], QUELLEN_STAATEN.delaware[1], QUELLEN_STAATEN.wyoming[0], QUELLEN_STAATEN.wyoming[1], QUELLEN_IRS[0], QUELLEN_IRS[2], QUELLEN_IRS[4]],
  },
];
