// ═══════════════════════════════════════════════════════════════════════════
// FIAON GLOBAL — DIE LEISTUNGEN (19.09.2026, E-191 · neu gefasst 13.11.2026, E-510)
// Sechs Seiten, je eine Suchfrage: US-Firmengründung, EIN und ITIN, US-Geschäftskonto,
// Finanzierung und Firmenkreditkarten, US-Pflichten, persönlich in Miami.
//
// E-510 (13.11.2026, Justin: „keine Magie, sondern knallharte Fakten“): Jede Seite folgt dem
// Sprachleitfaden FIAON Global. Jeder Abschnitt sagt, was wir tun, unter welcher Bedingung und wer
// entscheidet. Die festen Sätze (S1 bis S17), die sechs Schritte, die Tabelle „Wer macht was“ und die
// Belege kommen aus shared/fiaon-global-saetze.ts — sie werden hier nie ein zweites Mal getippt.
// Kein Betrag ist getippt: Honorare aus SAETZE_BETRAEGE (Preisquelle), die Kurzform der Spanne des
// Kapitalrahmens aus EIN_PRODUKT.
//
// WAS HIER NIE STEHT: eine Zusage zu Konto, Karte oder Finanzierung (es entscheidet das jeweilige
// Institut), eine Dauer als Zusage, ein Zinssatz, ein Bankname, ein Steuerversprechen, ein Ort oder eine
// Anschrift einer Partnergesellschaft. Die Erstattung nach Ziffer 4 steht nur bei der Finanzierung —
// nie bei Gründung, Steuernummern, Konto oder Karten. Partner erscheinen nur in ihrer Rolle
// („Partner-Anwälte“, „US-Steuerberater (CPA) aus unserem Partnernetz“, „unsere Partner in den USA“).
// Die Frage zur Verwendung der Mittel kommt wortgleich aus GLOBAL_KAPITAL_FREI (eine Quelle).
// ═══════════════════════════════════════════════════════════════════════════
import { GLOBAL_PFLICHTHINWEIS, GLOBAL_KAPITAL_FREI } from "../fiaon-global";
import {
  GELD_ZURUECK, SAETZE_BETRAEGE, SCHRITTE_KOPF, SECHS_SCHRITTE,
  beleg, satz, weitererSatz, type Schritt, type SchrittNr,
} from "../fiaon-global-saetze";
import type { GlobalSeite } from "./typen";
import { EIN_PRODUKT } from "./ein-produkt";

export const STAND_LEISTUNGEN = "2026-11-13";
const S = STAND_LEISTUNGEN;
/** Die Beträge aus der Preisquelle — Honorar mit dem Auftrag, Mindestbetrag des Erfolgshonorars, Jahresbetreuung, Spanne. */
const B = SAETZE_BETRAEGE.de;
/** „50.000 – 1.000.000 US-$“ — die Kurzform der Spanne für die Kennziffer. */
const RAHMEN_KURZ = EIN_PRODUKT.de.rahmenKurz;
const KOPF = SCHRITTE_KOPF.de;
/** Ein Schritt der festen Erzählung (Leitfaden 2.2) — Satz, Bedingung und Entscheider wortgleich aus der einen Quelle. */
const schritt = (nr: SchrittNr): Schritt => SECHS_SCHRITTE.de.find((x) => x.nr === nr)!;
/** Eine Zeile der Tabelle „Wer macht was“ (Leitfaden 2.4). */
const werZeile = (nr: SchrittNr): string[] => {
  const x = schritt(nr);
  return [`${x.nr} ${x.titel}`, x.werMachtWas.fiaon, x.werMachtWas.sie, x.entscheidet, x.werMachtWas.wennEsAusbleibt];
};
const WER_KOPF: string[] = [KOPF.spalten.schritt, KOPF.spalten.fiaon, KOPF.spalten.sie, KOPF.spalten.entscheidet, KOPF.spalten.wennEsAusbleibt];
/** Erster Buchstabe groß — für einen Satzteil, der eine Listenzeile beginnt. */
const gross = (t: string): string => t.charAt(0).toUpperCase() + t.slice(1);
/** Ohne Schlusspunkt — ein fester Satz als Zeile einer Liste, deren Zeilen ohne Punkt enden. */
const ohnePunkt = (t: string): string => t.replace(/\.$/, "");

/** Überschrift und erster Satz der Karte „Ein Mandat“ (Leitfaden 7.2 und 8.2). */
const KARTE_H2 = "Ein Mandat";
const EIN_MANDAT = "Ein Mandat, ein Vertrag, ein Ansprechpartner.";
/** Das Honorar in der Zeile „Auf einen Blick“ — die drei Zeitpunkte aus S12 in der Kurzform des Leitfadens (1.3, Fassung A). */
const HONORAR_BLICK = `${B.honorarAuftrag} mit Ihrem Auftrag. Mit der Eintragung Ihrer Gesellschaft das Erfolgshonorar nach Ihrem Kapitalrahmen, mindestens ${B.erfolgMin}. Ab dem zweiten Jahr auf Wunsch ${B.jahresbetreuung} im Jahr.`;
/** Was ab dem zweiten Jahr anfällt (Vertrag Ziffer 6 Absatz 3) — Betrag aus der Preisquelle. */
const LAUFEND = `Ab dem zweiten Jahr fallen die laufenden Kosten Ihrer Gesellschaft an: Staatsgebühr, Registered Agent und die jährliche US-Meldung. Mit der Jahresbetreuung übernehmen wir das auf Wunsch für ${B.jahresbetreuung} im Jahr, Staatsgebühr enthalten; die Jahresbetreuung verlängert sich nicht von selbst.`;
/** Die erste jährliche US-Meldung — Wortlaut des Vertrags (Ziffer 2), Rollenbezeichnung nach Leitplanke 5. */
const US_MELDUNG = "die erste jährliche US-Meldung durch einen US-Steuerberater (CPA) aus unserem Partnernetz";
/** Der Vermerk der Wissens-Inhalte (Leitfaden 5.11). */
const VERMERK = "Diese Seite erklärt Grundlagen und ersetzt keine steuerliche oder rechtliche Prüfung Ihres Falls.";
/** Der Reisepass im ITIN-Antrag — der Weg, den die IRS zulässt, ohne einen Partner beim Namen oder Ort zu nennen. */
const PASS_WEG = "Die IRS erlaubt, dass ein von ihr zugelassener Certifying Acceptance Agent Ihren Reisepass bestätigt; das Original müssen Sie dann nicht in die USA senden. Den Weg stimmen wir vor dem Antrag mit Ihnen ab.";

export const LEISTUNGEN: GlobalSeite[] = [
  // ─────────────────────────────────────────────────────────────────────────
  {
    pfad: "/business/us-firmengruendung",
    art: "leistung",
    seo: {
      titel: "US-Firma gründen: LLC in den USA — FIAON Global",
      beschreibung: "US-Firmengründung in einem Mandat: Wir melden Ihre LLC an und beantragen EIN und ITIN. Es entscheiden der Bundesstaat und die US-Steuerbehörde.",
    },
    stand: S,
    kennung: "FG · 01",
    auge: "Leistung · US-Firmengründung",
    h1: "US-Firmengründung.",
    h1b: "Angemeldet und dokumentiert.",
    lead: `Wir gründen Ihre US-Gesellschaft (LLC) in Delaware, Florida oder Wyoming, holen jede Unterlage ein und beantragen die Steuernummern. ${satz("S3")}`,
    ziffern: [
      { wert: B.honorarAuftrag, label: `mit Ihrem Auftrag — Gründung und erstes Jahr. Mit der Eintragung: Erfolgshonorar, mindestens ${B.erfolgMin}. Ab dem zweiten Jahr auf Wunsch: Jahresbetreuung.` },
      { wert: "3 Bundesstaaten", label: "Delaware, Florida oder Wyoming — über die Eintragung entscheidet der Bundesstaat" },
      { wert: "ein Mandat", label: "ein Vertrag, ein fester Ansprechpartner" },
    ],
    blick: [
      ["Wir übernehmen", "Anmeldung beim Bundesstaat, Gründungsunterlagen, Registered Agent, US-Geschäftsadresse und US-Telefonnummer, Anträge für EIN und ITIN"],
      ["Sie selbst", "Namen wählen, Reisepass hochladen, Unterlagen unterzeichnen"],
      ["Wer entscheidet", "Über die Eintragung der Bundesstaat, über EIN und ITIN die US-Steuerbehörde"],
      ["Honorar", HONORAR_BLICK],
      ["Rechtsform", "LLC — so sieht es Ihr Mandat vor; die Corporation steht unten im Vergleich"],
      ["Bundesstaat", "Delaware, Florida oder Wyoming — über den Honorarrechner Delaware; Florida oder Wyoming stimmen wir im Gespräch mit Ihnen ab"],
      ["Vertragspartner", "FIAON LTD, London — eingetragen im Companies House (England und Wales)"],
    ],
    kurz: "Eine US-Gesellschaft (LLC) lässt sich aus dem Ausland gründen — ohne Wohnsitz in den USA und ohne Mindestkapital. FIAON Global meldet sie beim Bundesstaat an, holt jede Unterlage ein und beantragt EIN und ITIN, in einem Mandat. Über die Eintragung entscheidet der Bundesstaat, über die Steuernummern die US-Steuerbehörde. Steuerpflichtig bleibt die Gesellschaft in der Regel dort, wo sie tatsächlich geführt wird.",
    bloecke: [
      {
        typ: "text", id: "was-es-ist", h2: "Was eine US-Gesellschaft ist — und was nicht",
        absaetze: [
          "Die Limited Liability Company (LLC) kommt der deutschen GmbH am nächsten: Die Gesellschaft haftet mit ihrem Vermögen, Sie als Gesellschafter grundsätzlich nicht mit Ihrem privaten. Anders als eine GmbH braucht sie kein Mindestkapital und keinen Notartermin; die Satzung heißt Operating Agreement und regelt, wer entscheidet und wem der Gewinn zusteht.",
          "Die Corporation ähnelt eher einer Aktiengesellschaft. Sie passt, wenn Investoren einsteigen sollen, wenn Anteile an Mitarbeiter gehen oder wenn ein Institut oder ein Geschäftspartner ausdrücklich eine Corporation erwartet.",
          `${satz("S10")} Wird die Gesellschaft von dort aus geführt, ist sie in der Regel dort steuerpflichtig. Sinnvoll ist sie für Unternehmen, die in den USA verkaufen, einkaufen oder Verträge schließen und dafür eine eigene Bankverbindung und Zahlungshistorie in den USA brauchen.`,
        ],
      },
      {
        typ: "tabelle", id: "llc-corporation", h2: "LLC oder Corporation — die Unterschiede",
        lead: "Ihr Mandat sieht die LLC vor. Zur Einordnung die Grundzüge beider Rechtsformen:",
        kopf: ["", "LLC", "Corporation"],
        zeilen: [
          ["Haftung", "beschränkt auf das Gesellschaftsvermögen", "beschränkt auf das Gesellschaftsvermögen"],
          ["Besteuerung in den USA", "Eine LLC mit einem ausländischen Gesellschafter wird dort in der Regel nicht als eigenes Steuersubjekt behandelt", "Die Gesellschaft zahlt Körperschaftsteuer des Bundes, dazu je nach Staat eine eigene"],
          ["Innere Ordnung", "Operating Agreement, frei gestaltbar", "Satzung, Vorstand, Anteile nach festen Regeln"],
          ["Investoren und Mitarbeiteranteile", "möglich, aber seltener üblich", "der übliche Weg"],
          ["Passt zu", "Handel, Dienstleistung, Holding", "Wachstum mit Investoren, Beteiligung von Mitarbeitern"],
        ],
        fuss: [`Die Einordnung durch das Finanzamt im Wohnsitzland folgt eigenen Regeln (in Deutschland ein Typenvergleich). ${VERMERK}`],
      },
      {
        typ: "etappen", id: "ablauf", h2: "Der Ablauf der Gründung",
        lead: KOPF.lead,
        etappen: [
          { titel: "Ihr Mandat beginnt", text: "Sie fordern Ihr Angebot an, lesen Ihren vollständigen Vertrag und unterzeichnen online. Wir beginnen nach Eingang Ihrer Zahlung." },
          { titel: "Name und Reisepass", text: "Sie wählen den Namen Ihrer Gesellschaft und laden Ihren Reisepass hoch. Wir sehen im Register nach, ob der Name verfügbar ist; der Bundesstaat vergibt jeden Namen nur einmal." },
          { titel: schritt(1).titel, dauer: `Es entscheidet ${schritt(1).entscheidet}`, text: `${schritt(1).satz} ${weitererSatz("UEBERGANG-EINREICHUNG")}` },
          { titel: schritt(2).titel, dauer: `Es entscheidet ${schritt(2).entscheidet}`, text: `${schritt(2).satz} ${schritt(2).werMachtWas.wennEsAusbleibt}` },
          { titel: "Konten, Karten, Finanzierung", dauer: "Es entscheidet das jeweilige Institut", text: "Danach bereiten wir Ihre Kontoanträge, auf Wunsch Ihre Kreditkartenanträge und die Anträge für die Finanzierung vollständig vor. Die Anträge stellen Sie selbst." },
        ],
      },
      {
        typ: "rollen", id: "wer-was-tut", h2: "Wer was verantwortet",
        lead: weitererSatz("ROLLEN"),
        fiaon: [
          "Anmeldung beim Bundesstaat über unsere Partner in den USA, Staatsgebühr enthalten",
          "Registered Agent, US-Geschäftsadresse und US-Telefonnummer im ersten Jahr",
          "Anträge für EIN und ITIN (die ITIN nach unserem ITIN-Check)",
          "Pflichtenkalender und erste Jahresmeldung beim Bundesstaat",
          "Ein fester Ansprechpartner für Post, Anrufe und Termine Ihrer Gesellschaft",
        ],
        partner: [
          "Partner-Anwälte: Rechtsfragen, in eigener Verantwortung",
          "US-Steuerberater (CPA) aus unserem Partnernetz: die erste jährliche US-Meldung",
        ],
        sie: [
          "Den Namen Ihrer Gesellschaft wählen",
          "Ihren Reisepass hochladen",
          "Die vorgelegten Unterlagen unterzeichnen",
          "Ihre Gesellschaft im Wohnsitzland melden — mit Ihrem Steuerberater",
        ],
      },
      {
        typ: "text", id: "inklusive", h2: "Im ersten Jahr enthalten",
        absaetze: ["Mit Ihrem Auftrag sind im ersten Jahr enthalten:"],
        punkte: [
          "Anmeldung beim Bundesstaat, Staatsgebühr enthalten",
          "Operating Agreement und Gründungsunterlagen",
          "Anträge für EIN und ITIN (die ITIN nach unserem ITIN-Check)",
          "Registered Agent, US-Geschäftsadresse und US-Telefonnummer",
          ohnePunkt(weitererSatz("UEBERGANG-ASSISTENZ")),
          gross(US_MELDUNG),
          "Pflichtenkalender und die erste Jahresmeldung beim Bundesstaat, Staatsgebühr enthalten",
          "Vollständig vorbereitete Anträge für Ihre Konten und, auf Wunsch, Ihre Kreditkarten — es entscheidet das jeweilige Institut",
          ohnePunkt(schritt(5).ihrErgebnis),
          `Nicht enthalten: Gebühren und Zinsen der Herausgeber und Institute, Kosten des Darlehens, Steuern, die Jahresbetreuung ab dem zweiten Jahr und Fast-Track (Vorrang in allen Schritten; ${B.fastTrack}, auf Wunsch)`,
        ],
        nach: LAUFEND,
      },
      {
        typ: "hinweis", id: "wissen", h2: "Was Sie vor der Gründung wissen müssen",
        punkte: [...GLOBAL_PFLICHTHINWEIS.de, beleg("fuerWenNicht")],
      },
      { typ: "paket", id: "mandat", h2: KARTE_H2, lead: `${EIN_MANDAT} ${beleg("honorarVorab")}`, paket: "global_struktur" },
    ],
    fragen: [
      { f: "Kann ich eine US-Firma gründen, ohne in den USA zu wohnen?", a: "Ja. Für die Gründung einer LLC brauchen Sie weder einen Wohnsitz noch eine Staatsbürgerschaft in den USA. Die gesetzlich vorgeschriebene Anschrift im Bundesstaat stellt der Registered Agent; US-Geschäftsadresse und US-Telefonnummer sind im ersten Jahr enthalten. Über die Eintragung entscheidet der Bundesstaat." },
      { f: "Muss ich für die Gründung in die USA reisen?", a: `Für die Gründung und die Steuernummer Ihrer Gesellschaft nicht. Ob ein Institut für Konto, Karte oder Finanzierung Ihre Anwesenheit verlangt, entscheidet das Institut. ${weitererSatz("MIAMI")}` },
      { f: "LLC oder Corporation — was passt zu mir?", a: `Ihr Mandat sieht die LLC vor; für Handel und Dienstleistung ist sie meist die schlankere Form. Eine Corporation passt, wenn Investoren einsteigen oder Mitarbeiter Anteile erhalten sollen. ${VERMERK}` },
      { f: "Wie lange dauert eine US-Firmengründung?", a: `${satz("S15")} Die Erfahrungswerte je Schritt stehen auf der Seite „Ablauf“.` },
      { f: "Was kostet eine US-Firmengründung bei FIAON?", a: satz("S12") },
      { f: "Ist eine US-Gesellschaft ein Steuermodell?", a: `Nein. ${satz("S10")} Wird die Gesellschaft von dort aus geführt, ist sie in der Regel dort steuerpflichtig, und in den USA kommen jährliche Meldepflichten hinzu.` },
    ],
    paket: "global_struktur",
    weiter: ["/business/wissen/llc-gruenden", "/business/ein-itin", "/business/kosten", "/business/privatpersonen"],
    quellen: [
      { titel: "IRS — Limited Liability Company (LLC)", url: "https://www.irs.gov/businesses/small-businesses-self-employed/limited-liability-company-llc" },
      { titel: "IRS — Single Member Limited Liability Companies", url: "https://www.irs.gov/businesses/small-businesses-self-employed/single-member-limited-liability-companies" },
    ],
  },

  // ─────────────────────────────────────────────────────────────────────────
  {
    pfad: "/business/ein-itin",
    art: "leistung",
    seo: {
      titel: "EIN und ITIN beantragen — FIAON Global",
      beschreibung: "EIN für Ihre US-Gesellschaft, ITIN für Sie persönlich: Wir bereiten beide Anträge vor und reichen sie ein. Über beide Nummern entscheidet die IRS.",
    },
    stand: S,
    kennung: "FG · 02",
    auge: "Leistung · US-Steuernummern",
    h1: "EIN und ITIN.",
    h1b: "Beantragt, nicht zugesagt.",
    lead: "Die EIN ist die Steuernummer Ihrer US-Gesellschaft, die ITIN Ihre persönliche US-Steuernummer. Wir bereiten beide Anträge vor und reichen sie ein; die ITIN beantragen wir nur, wenn die Voraussetzungen vorliegen. Über beide Nummern entscheidet die US-Steuerbehörde IRS.",
    ziffern: [
      { wert: "enthalten", label: "Anträge für EIN und ITIN — vorbereitet und eingereicht, Teil Ihres Mandats" },
      { wert: "ohne SSN", label: "Die EIN braucht keine US-Sozialversicherungsnummer" },
      { wert: "IRS", label: "Über beide Nummern entscheidet die US-Steuerbehörde" },
    ],
    blick: [
      ["Wir übernehmen", "ITIN-Check, beide Anträge vorbereitet und eingereicht"],
      ["Sie selbst", "Reisepass hochladen, Formulare unterzeichnen"],
      ["Wer entscheidet", "Die US-Steuerbehörde IRS — über beide Nummern, in eigener Frist"],
      ["Honorar", `Teil Ihres Mandats; die IRS erhebt keine Gebühr. ${HONORAR_BLICK}`],
      ["EIN", "Steuernummer der Gesellschaft — Formular SS-4"],
      ["ITIN", "Persönliche Steuernummer — Formular W-7 mit Identitätsnachweis"],
      ["Voraussetzung ITIN", "Ein steuerlicher Grund, den die IRS anerkennt — ob er vorliegt, prüfen wir vor dem Antrag (ITIN-Check)"],
    ],
    kurz: "Die EIN (Employer Identification Number) vergibt die US-Steuerbehörde IRS an Ihre Gesellschaft — ohne Gebühr und ohne US-Sozialversicherungsnummer. Die ITIN (Individual Taxpayer Identification Number) vergibt sie an Sie persönlich, wenn ein steuerlicher Grund vorliegt; beantragt wird sie mit Formular W-7 und einem Identitätsnachweis. FIAON Global bereitet beide Anträge vor und reicht sie ein; es entscheidet die IRS.",
    bloecke: [
      {
        typ: "tabelle", id: "vergleich", h2: "EIN und ITIN im Vergleich",
        kopf: ["", "EIN", "ITIN"],
        zeilen: [
          ["Für wen", "Ihre US-Gesellschaft", "Sie als Person"],
          ["Wozu", "Konto, Meldungen, Rechnungen, Verträge", "persönliche Steuerpflichten und Kredithistorie in den USA"],
          ["Formular", "SS-4", "W-7"],
          ["Voraussetzung", "eine eingetragene Gesellschaft", "ein steuerlicher Grund, den die IRS anerkennt"],
          ["Gebühr der IRS", "keine", "keine"],
          ["Wer entscheidet", "die IRS", "die IRS"],
          ["Dauer laut IRS", "Fax etwa vier Werktage, Post etwa vier Wochen", "etwa sieben Wochen, aus dem Ausland neun bis elf Wochen"],
          // E-465 (29.10.2026): die heutige Praxis neben der Angabe der IRS (shared/fiaon-global-bundesstaaten.ts, EIN_ZEITEN).
          ["Derzeit in der Praxis", "Fax eher sechs bis acht Wochen", "wie laut IRS"],
        ],
        fuss: [
          "Bearbeitungszeiten laut IRS (Stand 2026): EIN per Fax etwa vier Werktage, per Post etwa vier Wochen; ITIN etwa sieben Wochen, zwischen Mitte Januar und Ende April sowie bei Anträgen aus dem Ausland neun bis elf Wochen.",
          `Die Zeile „Derzeit in der Praxis“ nennt Erfahrungswerte (Stand: November 2026). ${satz("S15")}`,
        ],
      },
      {
        typ: "text", id: "ein", h2: "Die EIN — die Nummer Ihrer Gesellschaft",
        absaetze: [
          "Jede US-Gesellschaft braucht eine EIN: für das Geschäftskonto, für Rechnungen an US-Kunden, für die jährliche Meldung an die IRS und für jeden Vertrag, bei dem ein US-Partner eine Steuernummer verlangt.",
          "Das Online-Verfahren der IRS setzt eine US-Steuernummer der verantwortlichen Person voraus. Gesellschafter ohne eine solche Nummer beantragen die EIN schriftlich mit Formular SS-4. Wir füllen es aus, legen es Ihnen unterschriftsreif vor und reichen es ein. Die Bestätigung der IRS finden Sie danach in Ihrem Portal.",
        ],
      },
      {
        typ: "text", id: "itin", h2: "Die ITIN — Ihre persönliche US-Steuernummer",
        absaetze: [
          "Die ITIN ist für Menschen gedacht, die in den USA steuerlich erfasst werden müssen, aber keine Sozialversicherungsnummer erhalten können. Sie ist keine Arbeitserlaubnis und kein Aufenthaltstitel, sondern allein eine Steuernummer.",
          `Für Firmenkreditkarten zählt sie, weil der Herausgeber, der über die Karte entscheidet, bei der persönlichen Haftung des Inhabers die Person beurteilt — und dafür in der Regel eine US-Steuernummer verlangt. Die IRS vergibt die ITIN nur mit einem steuerlichen Grund: In der Regel wird sie zusammen mit einer US-Steuererklärung beantragt oder über eine der Ausnahmen, die die IRS zulässt. ${weitererSatz("UEBERGANG-ITIN")} Ohne tragfähigen Grund stellen wir keinen Antrag. ${schritt(2).werMachtWas.wennEsAusbleibt}`,
          PASS_WEG,
        ],
      },
      {
        typ: "etappen", id: "ablauf", h2: "Der Ablauf der Anträge",
        etappen: [
          { titel: "Gesellschaft eingetragen", text: "Die EIN kann erst beantragt werden, wenn der Bundesstaat die Gesellschaft eingetragen hat." },
          { titel: "SS-4 vorbereitet und eingereicht", text: "Wir füllen das Formular aus, Sie unterzeichnen, wir reichen ein. Über die EIN entscheidet die IRS; ihre Bestätigung finden Sie in Ihrem Portal." },
          { titel: "ITIN-Check", text: `${weitererSatz("UEBERGANG-ITIN")} Ohne tragfähigen Grund stellen wir keinen Antrag.` },
          { titel: "W-7 mit Identitätsnachweis", text: "Der Antrag geht mit Ihrem bestätigten Reisepass und den nötigen Anlagen an die IRS. Wir verfolgen ihn bis zum Bescheid; es entscheidet die IRS." },
        ],
      },
      {
        typ: "hinweis", id: "wissen", h2: "Was Sie wissen müssen",
        punkte: [
          "Beide Nummern vergibt allein die IRS, in eigener Frist. FIAON bereitet vor und reicht ein — entscheiden kann FIAON nicht.",
          "Die ITIN setzt einen steuerlichen Grund voraus. Ein Konto- oder Kartenwunsch allein ist kein Grund, den die IRS anerkennt.",
          "Eine ITIN ist keine Kreditkarte und kein Kreditrahmen. Sie ist in der Regel die Voraussetzung dafür, dass ein Herausgeber Ihren Antrag beurteilen kann; über jede Karte entscheidet der Herausgeber.",
        ],
      },
      { typ: "paket", id: "mandat", h2: KARTE_H2, lead: "Die Anträge für EIN und ITIN sind Teil Ihres Mandats.", paket: "global_struktur" },
    ],
    fragen: [
      { f: "Brauche ich eine US-Sozialversicherungsnummer für die EIN?", a: "Nein. Gesellschafter ohne US-Steuernummer beantragen die EIN schriftlich mit Formular SS-4. Das Online-Verfahren der IRS steht nur Antragstellern mit US-Steuernummer offen." },
      { f: "Was kostet die EIN bei der IRS?", a: "Nichts. Die IRS erhebt für die EIN keine Gebühr. Vorbereitung und Einreichung des Antrags sind Teil Ihres Mandats bei FIAON Global." },
      { f: "Wozu brauche ich eine ITIN?", a: "Für persönliche Steuerpflichten in den USA — und damit ein Herausgeber Sie als Person beurteilen kann, wenn Sie für eine Firmenkreditkarte persönlich haften. Die IRS vergibt die ITIN nur mit einem steuerlichen Grund." },
      { f: "Bekomme ich mit der ITIN automatisch eine Kreditkarte?", a: "Nein. Die ITIN ist eine Steuernummer. Ob ein Herausgeber eine Karte ausgibt und mit welchem Rahmen, entscheidet er selbst nach seinen Regeln." },
      { f: "Muss ich meinen Pass in die USA schicken?", a: `In der Regel nicht. ${PASS_WEG}` },
      { f: "Wie lange dauert die ITIN?", a: "Nach Angabe der IRS etwa sieben Wochen; zwischen Mitte Januar und Ende April sowie bei Anträgen aus dem Ausland neun bis elf Wochen. FIAON kann das nicht beschleunigen — wir achten darauf, dass der Antrag vollständig ist, denn unvollständige Anträge verzögern die Bearbeitung." },
    ],
    paket: "global_struktur",
    weiter: ["/business/wissen/ein-beantragen", "/business/wissen/itin-beantragen", "/business/us-firmengruendung", "/business/us-pflichten"],
    quellen: [
      { titel: "IRS — Employer Identification Number", url: "https://www.irs.gov/businesses/small-businesses-self-employed/employer-identification-number" },
      { titel: "IRS — Form SS-4", url: "https://www.irs.gov/forms-pubs/about-form-ss-4" },
      { titel: "IRS — Individual Taxpayer Identification Number (ITIN)", url: "https://www.irs.gov/tin/itin/individual-taxpayer-identification-number-itin" },
      { titel: "IRS — Form W-7", url: "https://www.irs.gov/forms-pubs/about-form-w-7" },
    ],
  },

  // ─────────────────────────────────────────────────────────────────────────
  {
    pfad: "/business/us-geschaeftskonto",
    art: "leistung",
    seo: {
      titel: "US-Geschäftskonto eröffnen als Deutscher — FIAON Global",
      beschreibung: "US-Geschäftskonto für Ihre LLC: Wir stellen die Unterlagen zusammen und bereiten den Antrag vor. Sie stellen ihn selbst; es entscheidet das Institut.",
    },
    stand: S,
    kennung: "FG · 03",
    auge: "Leistung · US-Geschäftskonto",
    h1: "Das US-Geschäftskonto.",
    h1b: "Vorbereitet von uns, entschieden vom Institut.",
    lead: `Grundlage jedes US-Kontos sind vollständige Unterlagen ohne Widersprüche. Wir stellen sie zusammen und begleiten Sie bis zur Entscheidung des Instituts. ${satz("S2")}`,
    ziffern: [
      { wert: "vorbereitet", label: "Jeder Kontoantrag, vollständig — den Antrag stellen Sie selbst" },
      { wert: "keine Vollmacht", label: beleg("keinZugriff") },
      { wert: "das Institut", label: "entscheidet über jedes Konto, nach eigenen Regeln" },
    ],
    blick: [
      ["Wir übernehmen", "Unterlagen zusammenstellen, Antrag vollständig vorbereiten, Rückfragen begleiten"],
      ["Sie selbst", "Den Antrag stellen und unterzeichnen"],
      ["Wer entscheidet", "Allein das jeweilige Institut, nach eigenen Regeln"],
      ["Honorar", `Teil Ihres Mandats; die Gebühren des Instituts tragen Sie. ${HONORAR_BLICK}`],
      ["Kontoinhaber", "Ihre US-Gesellschaft — nicht FIAON"],
      ["Voraussetzung", "Eingetragene Gesellschaft, EIN, Operating Agreement, US-Geschäftsadresse"],
      ["Im Mandat", "Privates Konto und Geschäftskonto: jeder Antrag vorbereitet; Kreditkartenanträge auf Wunsch"],
    ],
    kurz: "Eine US-Gesellschaft kann ein Geschäftskonto in den USA beantragen, sobald sie eingetragen ist und eine EIN hat. Institute verlangen dafür Gründungsunterlagen, die EIN-Bestätigung, das Operating Agreement, Ausweise der Gesellschafter und eine nachvollziehbare Beschreibung des Geschäfts. FIAON Global bereitet diese Unterlagen und den Antrag vollständig vor; den Antrag stellen Sie selbst. Ob und zu welchen Bedingungen ein Konto eröffnet wird, entscheidet das Institut.",
    bloecke: [
      {
        typ: "text", id: "unterlagen", h2: "Was ein Institut sehen will",
        absaetze: ["Die Liste ist bei den meisten Instituten ähnlich. Fehlt ein Teil oder widersprechen sich zwei Unterlagen, bleibt der Antrag liegen — deshalb gleichen wir die Unterlagen ab, bevor Sie den Antrag stellen:"],
        punkte: [
          "Gründungsunterlagen der Gesellschaft (Articles of Organization oder Incorporation)",
          "Bestätigung der EIN durch die IRS",
          "Operating Agreement oder Satzung",
          "Reisepässe der Gesellschafter und der Geschäftsführung",
          "US-Geschäftsadresse und Telefonnummer",
          "eine klare Beschreibung des Geschäfts: was, für wen, mit welchen Zahlungsströmen",
        ],
        nach: "Über den Antrag entscheidet das Institut.",
      },
      {
        typ: "karten", id: "wege", h2: "Online oder vor Ort", spalten: 2,
        karten: [
          { tag: "Online", titel: "Antrag online", text: "Manche Institute nehmen Anträge von Gesellschaften mit Gesellschaftern im Ausland online entgegen. Wir bereiten den Antrag vollständig vor; ob ein Institut diesen Weg zulässt, entscheidet das Institut." },
          { tag: "Vor Ort", titel: "Termin in der Filiale", text: `Andere Institute verlangen Ihre Anwesenheit. Den Termin bereiten wir mit Ihnen vor. ${weitererSatz("MIAMI")}` },
        ],
      },
      {
        typ: "text", id: "ablehnung", h2: "Warum Konten abgelehnt werden",
        absaetze: ["Typische Gründe sind Lücken in den Unterlagen, die sich vor dem Antrag erkennen lassen:"],
        punkte: [
          "Das Geschäftsmodell ist aus den Unterlagen nicht zu verstehen.",
          "Es fehlt ein erkennbarer Bezug zu den USA — Kunden, Lieferanten oder Verträge.",
          "Namen, Adressen oder Beteiligungen stimmen in zwei Unterlagen nicht überein.",
          "Zahlungsströme berühren Länder oder Branchen, die das Institut nicht bedient.",
        ],
        nach: "Wir benennen solche Lücken vor dem Antrag — nicht erst nach der Ablehnung. Die Entscheidung trifft das Institut.",
      },
      {
        typ: "hinweis", id: "wissen", h2: "Was Sie wissen müssen",
        punkte: [
          satz("S2"),
          "FIAON nennt auf dieser Seite keine Institute: ihre Anforderungen ändern sich, und welches passt, hängt von Ihrem Vorhaben ab. Welche Institute in Betracht kommen, nennt Ihnen Ihr Ansprechpartner.",
          `Kontoinhaber ist Ihre Gesellschaft. ${beleg("keinZugriff")}`,
        ],
      },
      { typ: "paket", id: "mandat", h2: KARTE_H2, lead: "Die Vorbereitung Ihrer Kontoanträge ist Teil Ihres Mandats — privat und für Ihre Gesellschaft.", paket: "global_banking" },
    ],
    fragen: [
      { f: "Kann ich als Deutscher ein US-Geschäftskonto eröffnen?", a: "Beantragen können Sie es für Ihre US-Gesellschaft. Voraussetzung sind eine eingetragene Gesellschaft, eine EIN und vollständige Unterlagen. Ob ein Institut das Konto eröffnet, entscheidet es selbst." },
      { f: "Muss ich dafür in die USA reisen?", a: `Ob ein Institut Ihre Anwesenheit verlangt, entscheidet das Institut. Manche nehmen Anträge online entgegen. ${weitererSatz("MIAMI")}` },
      { f: "Welche Unterlagen braucht die Bank?", a: "In der Regel Gründungsunterlagen, EIN-Bestätigung, Operating Agreement, Reisepässe, US-Geschäftsadresse und eine klare Beschreibung des Geschäfts. Wir stellen sie zusammen und gleichen sie auf Widersprüche ab." },
      { f: "Warum nennt FIAON keine Banknamen?", a: "Weil sich die Anforderungen der Institute ändern und die Wahl von Ihrem Vorhaben abhängt. Welche Institute in Betracht kommen, nennt Ihnen Ihr Ansprechpartner; den Antrag stellen Sie selbst." },
      { f: "Hat FIAON Zugriff auf mein Konto?", a: `Nein. Kontoinhaber ist Ihre Gesellschaft. ${beleg("keinZugriff")}` },
    ],
    paket: "global_banking",
    weiter: ["/business/wissen/us-bankkonto-unterlagen", "/business/firmenkarten-kapital", "/business/ein-itin", "/business/wissen/registered-agent-adresse"],
  },

  // ─────────────────────────────────────────────────────────────────────────
  // E-510: die neue Fassung der Seite nach Leitfaden 8.6 — erst die Finanzierung, dann Kreditkarten als Zusatz auf
  // Wunsch, dann die Prüfung von Umschuldung und Aufstockung ab dem achtzehnten Monat. Die Adresse bleibt; der Anker
  // des Ablaufs heißt „ablauf“. Solange der Vorbehalt V1 offen ist, steht überall die Fassung „heute“ (Schritt 5).
  {
    pfad: "/business/firmenkarten-kapital",
    art: "leistung",
    seo: {
      titel: "Finanzierung und Firmenkreditkarten USA — FIAON Global",
      beschreibung: "Finanzierung Ihrer US-Gesellschaft: vollständig vorbereitete Anträge und Begleitung bis zur Entscheidung des Instituts. Firmenkreditkarten auf Wunsch.",
    },
    stand: S,
    kennung: "FG · 04",
    auge: "Leistung · Finanzierung und Firmenkreditkarten",
    h1: "Finanzierung und Firmenkreditkarten.",
    h1b: "Vorbereitet und begleitet.",
    lead: "Sie wählen den Kapitalrahmen, den Ihre Gesellschaft aufnehmen soll. Wir bereiten jeden Antrag vollständig vor und begleiten Ihre Gesellschaft bis zur Entscheidung des finanzierenden Instituts. Auf Wunsch bereiten wir auch Ihre Kreditkartenanträge vor — ohne zusätzliches Honorar von FIAON.",
    ziffern: [
      { wert: RAHMEN_KURZ, label: satz("S9") },
      { wert: "Entscheidung", label: satz("S1") },
      { wert: "Miami", label: weitererSatz("MIAMI") },
    ],
    blick: [
      ["Kapitalrahmen", `${B.rahmen} — Sie wählen ihn selbst; ab 1 Mio. US-Dollar persönlich in Miami`],
      ["Wir übernehmen", "Vollständig vorbereitete Anträge, Begleitung bis zur Entscheidung"],
      ["Sie selbst", "Kapitalrahmen wählen, Anträge stellen, über jedes Angebot des Instituts entscheiden"],
      ["Wer entscheidet", "Das finanzierende Institut; bei Karten der Herausgeber"],
      ["Honorar", "Erfolgshonorar mit der Eintragung, als Betrag in Ihrem Angebot; Karten ohne zusätzliches Honorar von FIAON"],
      [KOPF.spalten.wennEsAusbleibt, schritt(5).werMachtWas.wennEsAusbleibt],
    ],
    kurz: "FIAON Global begleitet Ihre US-Gesellschaft bis zur Entscheidung über ihre Finanzierung. Sie wählen den Kapitalrahmen; wir bereiten jeden Antrag vollständig vor und begleiten Ihre Gesellschaft, bis das finanzierende Institut entschieden hat. Kreditkartenanträge bereiten wir auf Wunsch vor, ohne zusätzliches Honorar von FIAON. Über Finanzierung, Karten und Rahmen entscheidet allein das jeweilige Institut.",
    bloecke: [
      {
        typ: "etappen", id: "ablauf", h2: "Der Ablauf bis zur Finanzierung",
        lead: satz("S15"),
        etappen: [
          { titel: "Kapitalrahmen wählen", text: `Sie wählen den Kapitalrahmen, den Ihre Gesellschaft aufnehmen soll: ${B.rahmen}. ${weitererSatz("MIAMI")} Ein Kapitalrahmen ist ein Ziel, kein Versprechen.` },
          { titel: "Vor Beginn", text: "Wir stellen Ihre Identität fest und gleichen Ihre Angaben mit den Sanktionslisten ab (Ziffer 8 Ihres Vertrags)." },
          { titel: "Anträge", text: "Wir bereiten jeden Antrag vollständig vor und begleiten Ihre Gesellschaft. Den Antrag stellt sie selbst." },
          { titel: "Entscheidung und Darlehensvertrag", text: `${satz("S1")} Den Darlehensvertrag schließt Ihre Gesellschaft im eigenen Namen.` },
        ],
      },
      {
        typ: "text", id: "wovon", h2: "Wovon die Entscheidung abhängt",
        absaetze: ["Institute und Herausgeber entscheiden nach eigenen Regeln. In ihre Entscheidung fließt in der Regel ein:"],
        punkte: [
          "Umsatz und Zahlungsströme der Gesellschaft",
          "ein nachvollziehbares Geschäft mit Bezug zu den USA",
          "die Dauer und Pünktlichkeit der bisherigen Zahlungen",
          "die persönliche Kreditwürdigkeit des haftenden Inhabers",
          "vollständige Unterlagen ohne Widersprüche",
        ],
        nach: "Vollständige Unterlagen ohne Widersprüche sind unser Teil der Arbeit.",
      },
      {
        typ: "tabelle", id: "verantwortung", h2: "Wer was verantwortet",
        kopf: WER_KOPF,
        zeilen: [werZeile(4), werZeile(5), werZeile(6)],
        fuss: ["Die Ziffern in Klammern nennen die Stelle in Ihrem Vertrag."],
      },
      {
        typ: "text", id: "ausbleiben", h2: GELD_ZURUECK.de.auge,
        absaetze: [],
        punkte: [...GELD_ZURUECK.de.mittel],
        nach: `Die Bedingungen stehen in Ziffer 4 Ihres Vertrags. Für Konto und Karten gilt das nicht. ${satz("S1")}`,
      },
      {
        typ: "text", id: "karten", h2: "Firmenkreditkarten — auf Wunsch",
        absaetze: [
          satz("S4"),
          `${satz("S11")} Wer haftet, steht mit seinem Vermögen für die Abrechnung ein. Gebühren und Zinsen legt der Herausgeber selbst fest, und Sie tragen sie.`,
          "Wir bereiten jeden Kartenantrag einzeln und vollständig vor; die Anträge stellen Sie selbst. Anträge in Serie bereiten wir nicht vor.",
        ],
        nach: "Die Grundlagen erklärt der Wissens-Artikel zur US-Firmenkreditkarte; Sie finden ihn unter „Weiterlesen“.",
      },
      {
        typ: "text", id: "achtzehnter-monat", h2: "Ab dem achtzehnten Monat",
        absaetze: [satz("S6")],
      },
      {
        typ: "text", id: "honorar", h2: "Ihr Honorar",
        absaetze: [satz("S12")],
        nach: "Nicht enthalten sind die Gebühren und Zinsen der Herausgeber und Institute, die Kosten des Darlehens und Steuern.",
      },
      {
        typ: "karten", id: "grenzen", h2: "Was FIAON tut — und was nicht", spalten: 2,
        lead: satz("S9"),
        karten: [
          { tag: "FIAON tut", titel: "Vorbereiten und begleiten", text: "Vollständig vorbereitete Anträge für die Finanzierung und, auf Wunsch, für Kreditkarten. Begleitung Ihrer Gesellschaft bis zur Entscheidung des finanzierenden Instituts." },
          { tag: "FIAON tut nicht", titel: "Zusagen, vergeben, vermitteln", text: `${satz("S8")} FIAON sagt keinen Rahmen zu; darüber entscheidet das jeweilige Institut. ${beleg("keinZugriff")}` },
        ],
      },
      { typ: "paket", id: "mandat", h2: KARTE_H2, lead: `${EIN_MANDAT} ${beleg("honorarVorab")}`, paket: "global_kapital" },
    ],
    fragen: [
      { f: "Sagt FIAON eine Finanzierung zu?", a: `Nein. Über jede Finanzierung entscheidet allein das finanzierende Institut. FIAON vergibt und vermittelt keine Kredite; wir bereiten die Anträge vollständig vor und begleiten Ihre Gesellschaft bis zur Entscheidung. ${satz("S9")} ${satz("S5-C")}` },
      { f: "Wie groß kann der Kapitalrahmen sein?", a: `${B.rahmen}. ${weitererSatz("MIAMI")} ${satz("S9")} ${satz("S1")}` },
      { f: "Wer haftet für eine Firmenkreditkarte?", a: `${satz("S11")} Wer haftet, steht mit seinem Vermögen für die Abrechnung ein. Welche Sicherheiten ein Herausgeber verlangt, entscheidet er selbst.` },
      { f: GLOBAL_KAPITAL_FREI.de.frage, a: GLOBAL_KAPITAL_FREI.de.antwort },
      { f: "Was geschieht ab dem achtzehnten Monat?", a: `${satz("S6")} ${weitererSatz("SCHRITT-6-TAKT")}` },
    ],
    paket: "global_kapital",
    weiter: ["/business/wissen/us-firmenkarte-beantragen", "/business/wissen/business-credit-usa", "/business/wissen/us-bonitaet-aufbauen", "/business/wissen/us-funding"],
  },

  // ─────────────────────────────────────────────────────────────────────────
  {
    pfad: "/business/us-pflichten",
    art: "leistung",
    seo: {
      titel: "Form 5472 und US-Pflichten der LLC — FIAON Global",
      beschreibung: "Form 5472 mit Form 1120, Jahresmeldung, Registered Agent: Wir führen den Pflichtenkalender Ihrer US-Gesellschaft. Fristen und Strafen setzen die Behörden.",
    },
    stand: S,
    kennung: "FG · 05",
    auge: "Leistung · US-Pflichten",
    h1: "Ihre US-Pflichten.",
    h1b: "Jede Frist im Pflichtenkalender.",
    lead: "Eine US-Gesellschaft hat Pflichten, auch wenn sie keinen Umsatz macht: die jährliche Meldung an die IRS, die Gebühr des Bundesstaats, den Registered Agent — und die Meldung im Wohnsitzland. Wir führen den Pflichtenkalender und erinnern rechtzeitig. Fristen und Strafen setzen die Behörden.",
    ziffern: [
      { wert: "Form 5472", label: "mit Form 1120 — jährlich, auch ohne Umsatz" },
      { wert: "15. April", label: "Frist der IRS für Gesellschaften mit Kalenderjahr" },
      { wert: "enthalten", label: `Im ersten Jahr: ${US_MELDUNG}` },
    ],
    blick: [
      ["Wir übernehmen", "Pflichtenkalender, Erinnerung an jede Frist, erste Jahresmeldung beim Bundesstaat"],
      ["Sie selbst", "Meldung der Beteiligung und Steuererklärung im Wohnsitzland — mit Ihrem Steuerberater"],
      ["Wer entscheidet", "Fristen und Strafen setzen IRS, Bundesstaat und Finanzamt"],
      ["Honorar", `Im ersten Jahr Teil Ihres Mandats. ${HONORAR_BLICK}`],
      ["IRS", "Form 5472 mit Form 1120 für Gesellschaften mit ausländischem Gesellschafter"],
      ["Bundesstaat", "Jahresmeldung oder Jahresgebühr, je nach Staat mit eigener Frist"],
      ["Registered Agent", "Jährlich — ohne ihn keine gültige Anschrift im Bundesstaat"],
    ],
    kurz: "Eine US-Gesellschaft mit einem ausländischen Gesellschafter muss der IRS jedes Jahr Form 5472 zusammen mit Form 1120 übermitteln — auch ohne Umsatz. Hinzu kommen Jahresmeldung oder Jahresgebühr des Bundesstaats und der Registered Agent. Im Wohnsitzland ist die Beteiligung zu melden; wird die Gesellschaft von dort aus geführt, ist sie in der Regel dort steuerpflichtig. FIAON Global führt den Pflichtenkalender; die erste jährliche US-Meldung ist im ersten Jahr enthalten.",
    bloecke: [
      {
        typ: "tabelle", id: "kalender", h2: "Die Pflichten einer US-Gesellschaft im Jahr",
        kopf: ["Pflicht", "Bei wem", "Frist", "Wer sie übernimmt"],
        zeilen: [
          ["Form 5472 mit Form 1120", "IRS, per Fax oder Post", "15. April, mit Form 7004 bis 15. Oktober", "US-Steuerberater (CPA) aus unserem Partnernetz (erstes Jahr enthalten)"],
          ["Jahresmeldung oder Jahressteuer", "Bundesstaat", "Florida 1. Januar bis 1. Mai · Delaware 1. Juni · Wyoming im Gründungsmonat", "FIAON (erstes Jahr enthalten, Staatsgebühr eingeschlossen)"],
          ["Registered Agent", "Bundesstaat", "jährlich", "im ersten Jahr enthalten"],
          ["Meldung der Beteiligung (DE: § 138 AO)", "Finanzamt im Wohnsitzland", "mit der Steuererklärung, spätestens vierzehn Monate nach Jahresende", "Ihr Steuerberater"],
          ["Steuererklärung der Gesellschaft", "Finanzamt im Wohnsitzland", "nach dortigem Recht", "Ihr Steuerberater"],
        ],
        fuss: ["IRS-Frist für Gesellschaften, deren Geschäftsjahr dem Kalenderjahr entspricht. Staatsfristen für LLCs; Beträge und Einzelheiten auf den Seiten der Bundesstaaten und unter „Kosten“.", "In den USA gegründete Gesellschaften sind seit dem 14. August 2026 von der Meldung wirtschaftlich Berechtigter (BOI) an FinCEN befreit."],
      },
      {
        typ: "text", id: "form-5472", h2: "Form 5472 — die jährliche Pflichtmeldung",
        absaetze: [
          "Gehört eine US-Gesellschaft einem ausländischen Gesellschafter, meldet sie der IRS jedes Jahr ihre Geschäfte mit ihm: Einlagen, Entnahmen, Darlehen, bezahlte Leistungen. Dafür gibt es Form 5472, eingereicht zusammen mit einer Form 1120, die bei einer solchen Gesellschaft nur als Deckblatt dient.",
          "Die Meldung ist auch dann Pflicht, wenn die Gesellschaft keinen Umsatz gemacht hat — schon die Einlage bei der Gründung ist eine meldepflichtige Transaktion. Eingereicht wird sie nicht elektronisch, sondern per Fax oder Post. Für eine fehlende oder wesentlich unvollständige Meldung kann die IRS eine Strafe von 25.000 US-Dollar je Formular und Jahr festsetzen; bleibt die Meldung nach einer Aufforderung aus, kommen weitere Beträge hinzu.",
        ],
      },
      {
        typ: "text", id: "heimat", h2: "Die Pflichten im Wohnsitzland",
        absaetze: [
          "In Deutschland ist die Gründung oder der Erwerb einer Beteiligung an einer ausländischen Gesellschaft dem Finanzamt zu melden (§ 138 AO) — zusammen mit der Steuererklärung, spätestens vierzehn Monate nach Ablauf des Jahres. Wer die Meldung versäumt, riskiert ein Bußgeld von höchstens 25.000 Euro (§ 379 AO). Wie das Finanzamt die US-Gesellschaft einordnet, richtet sich nach einem Typenvergleich.",
          `In der Schweiz und in Österreich gelten eigene Regeln. In allen drei Ländern gilt: Wird die Gesellschaft von dort aus geführt, ist sie dort in der Regel steuerpflichtig. Die Meldung und die laufende Steuererklärung übernimmt Ihr Steuerberater im Wohnsitzland. ${VERMERK}`,
        ],
      },
      {
        typ: "hinweis", id: "wissen", h2: "Was Sie wissen müssen",
        punkte: [
          "Fristen und Strafen setzen die Behörden, nicht FIAON. Der Pflichtenkalender erinnert rechtzeitig; die Verantwortung für die Gesellschaft bleibt bei Ihnen.",
          LAUFEND,
          "Die laufende Buchhaltung und die Steuererklärung im Wohnsitzland sind nicht Teil Ihres Mandats; sie übernimmt Ihr Steuerberater.",
        ],
      },
      { typ: "paket", id: "mandat", h2: KARTE_H2, lead: "Der Pflichtenkalender für alle US-Meldungen und Fristen ist Teil Ihres Mandats.", paket: "global_banking" },
    ],
    fragen: [
      { f: "Muss ich Form 5472 auch ohne Umsatz abgeben?", a: "Ja. Die Pflicht hängt nicht am Umsatz, sondern daran, dass die Gesellschaft einem ausländischen Gesellschafter gehört. Sie meldet ihre Geschäfte mit ihm; Gründungseinlagen zählen bereits dazu." },
      { f: "Was passiert, wenn ich die Frist verpasse?", a: "Die IRS kann eine Strafe von 25.000 US-Dollar je Formular und Jahr festsetzen, bei fortdauerndem Versäumnis nach einer Aufforderung zusätzliche Beträge. Deshalb steht die Frist in Ihrem Pflichtenkalender, und wir erinnern rechtzeitig." },
      { f: "Wer erstellt die jährliche US-Meldung?", a: `Im ersten Jahr ein US-Steuerberater (CPA) aus unserem Partnernetz; sein Honorar dafür trägt FIAON. Ab dem zweiten Jahr ist die Meldung Teil der Jahresbetreuung, die Sie für ${B.jahresbetreuung} im Jahr beauftragen können; sie verlängert sich nicht von selbst.` },
      { f: "Muss ich die US-Gesellschaft dem Finanzamt melden?", a: "In Deutschland ja, nach § 138 AO zusammen mit der Steuererklärung. In Österreich und der Schweiz gelten eigene Regeln; Ihr Steuerberater im Wohnsitzland nennt sie Ihnen." },
      { f: "Was kostet die US-Gesellschaft ab dem zweiten Jahr?", a: `Staatsgebühr, Registered Agent und die jährliche US-Meldung. Mit der Jahresbetreuung übernehmen wir das auf Wunsch für ${B.jahresbetreuung} im Jahr, Staatsgebühr enthalten; die Jahresbetreuung verlängert sich nicht von selbst. Die Einzelbeträge je Bundesstaat stehen auf der Seite „Kosten“.` },
    ],
    paket: "global_banking",
    weiter: ["/business/wissen/llc-steuererklaerung", "/business/wissen/form-5472", "/business/wissen/registered-agent-adresse", "/business/aus-deutschland"],
    quellen: [
      { titel: "IRS — Instructions for Form 5472", url: "https://www.irs.gov/instructions/i5472" },
      { titel: "IRS — About Form 7004", url: "https://www.irs.gov/forms-pubs/about-form-7004" },
      { titel: "§ 138 AO — Anzeigen über die Erwerbstätigkeit", url: "https://www.gesetze-im-internet.de/ao_1977/__138.html" },
    ],
  },

  // ─────────────────────────────────────────────────────────────────────────
  {
    pfad: "/business/miami",
    art: "leistung",
    seo: {
      titel: "Persönlich in Miami: ab 1 Mio. US-Dollar — FIAON Global",
      beschreibung: "Ab einem Kapitalrahmen von 1 Mio. US-Dollar begleiten wir Sie persönlich in Miami. Über die Finanzierung entscheidet das finanzierende Institut.",
    },
    stand: S,
    kennung: "FG · 06",
    auge: "Leistung · Miami",
    h1: "Persönlich in Miami.",
    h1b: "Ab 1 Mio. US-Dollar Kapitalrahmen.",
    lead: `${weitererSatz("MIAMI")} Ihr Angebot erhalten Sie nach unserem Gespräch; Termin und Ablauf stimmen wir mit Ihnen ab. ${satz("S1")}`,
    ziffern: [
      { wert: "ab 1 Mio. US-$", label: satz("S9") },
      { wert: "persönlich", label: "Ihr Termin mit der Geschäftsführung von FIAON" },
      { wert: "Ihr Angebot", label: "erhalten Sie persönlich, nach unserem Gespräch" },
    ],
    blick: [
      ["Für wen", "Kapitalrahmen ab 1 Mio. US-Dollar"],
      ["Wir übernehmen", "Gespräch, persönliches Angebot, Vorbereitung der Termine in Miami"],
      ["Sie selbst", "Anfrage im Honorarrechner senden, die Reise planen, Anträge selbst stellen"],
      ["Wer entscheidet", "Über Konto, Karte und Finanzierung das jeweilige Institut — auch nach einem Termin in Miami"],
      ["Honorar", "Steht als Betrag in Ihrem persönlichen Angebot, bevor Sie unterzeichnen"],
      ["Ihr Weg dorthin", "Anfrage im Honorarrechner — wir melden uns und stimmen den Termin ab"],
    ],
    kurz: "Ab einem Kapitalrahmen von 1 Mio. US-Dollar begleitet FIAON Global Sie persönlich in Miami. Ihre Anfrage senden Sie im Honorarrechner; wir melden uns, besprechen Ihr Vorhaben und stimmen den Termin mit Ihnen ab. Ihr Angebot erhalten Sie persönlich. Die Anträge stellen Sie selbst; über Konto, Karte und Finanzierung entscheidet das jeweilige Institut.",
    bloecke: [
      {
        typ: "text", id: "warum", h2: "Warum vor Ort",
        absaetze: [
          "Für die Gründung und die Steuernummer Ihrer Gesellschaft ist keine Reise nötig. Bei einem Kapitalrahmen ab 1 Mio. US-Dollar sprechen wir persönlich mit Ihnen: über Ihr Vorhaben, die Unterlagen und die Anträge, die Ihre Gesellschaft stellt.",
          "Ob ein Institut für Konto, Karte oder Finanzierung Ihre Anwesenheit verlangt, entscheidet das Institut. Termine in Miami bereiten wir mit unseren Partnern in den USA vor.",
        ],
      },
      {
        typ: "etappen", id: "auftakt", h2: "Der Weg zum Termin in Miami",
        etappen: [
          { titel: "Anfrage im Honorarrechner", text: "Sie stellen den Regler auf 1 Mio. US-Dollar und senden Ihre Anfrage. Wir melden uns bei Ihnen." },
          { titel: "Gespräch und Angebot", text: "Wir besprechen Ihr Vorhaben und stimmen den Termin ab. Ihr Angebot erhalten Sie persönlich; Ihren vollständigen Vertrag lesen Sie, bevor Sie unterzeichnen." },
          { titel: "Termine in Miami", text: "Ein Arbeitstermin mit der Geschäftsführung von FIAON. Termine bei Instituten bereiten wir mit unseren Partnern in den USA vor; über jeden Antrag entscheidet das Institut." },
          { titel: "Danach: Ihr Mandat", text: "Nach dem Termin folgt Ihr Mandat demselben Ablauf wie jedes andere: von der Gründung bis zur Entscheidung des finanzierenden Instituts. Den Stand sehen Sie in Ihrem Portal." },
        ],
      },
      {
        typ: "hinweis", id: "reise", h2: "Die Reise — was gilt",
        punkte: [
          "Termin, Reise und Ablauf in Miami stimmen wir vorab mit Ihnen ab.",
          "FIAON ist kein Reiseveranstalter und verkauft keine Reise.",
          "Über Konto, Karte, Rahmen und Finanzierung entscheidet auch nach einem Termin in Miami allein das jeweilige Institut.",
        ],
      },
      { typ: "paket", id: "mandat", h2: KARTE_H2, lead: `${EIN_MANDAT} ${beleg("honorarVorab")}`, paket: "global_vip" },
    ],
    fragen: [
      { f: "Ab wann treffen wir uns persönlich?", a: `${weitererSatz("MIAMI")} Ihr Angebot erhalten Sie dann nach unserem Gespräch.` },
      { f: "Ist das eine Pauschalreise?", a: "Nein. FIAON ist kein Reiseveranstalter und verkauft keine Reisen. Termin, Reise und Ablauf in Miami stimmen wir vorab mit Ihnen ab." },
      { f: "Wann findet der Termin statt?", a: "Nach unserem Gespräch — wir stimmen ihn mit Ihnen ab." },
      { f: "Was bedeutet der Kapitalrahmen?", a: `Er ist der Zielbetrag der Finanzierung, den Sie für Ihre Gesellschaft wählen. ${satz("S9")} ${satz("S1")}` },
      { f: "Brauche ich für die Gründung überhaupt eine Reise?", a: "Für die Gründung und die Steuernummer Ihrer Gesellschaft nicht. Ob ein Institut für Konto, Karte oder Finanzierung Ihre Anwesenheit verlangt, entscheidet das Institut." },
    ],
    paket: "global_vip",
    weiter: ["/business/firmenkarten-kapital", "/business/partner", "/business/florida", "/business/kosten"],
  },
];
