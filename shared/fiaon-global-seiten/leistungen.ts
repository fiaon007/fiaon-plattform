// ═══════════════════════════════════════════════════════════════════════════
// FIAON GLOBAL — DIE LEISTUNGEN (19.09.2026, E-191)
// Sechs Seiten, je eine Suchfrage: US-Firmengründung, EIN und ITIN,
// US-Geschäftskonto, Firmenkarten und Kapital, US-Pflichten, persönlich in Miami.
// Preise, Kapitalrahmen und Dauer kommen aus shared/fiaon-global.ts — nie als
// zweite Zahl hier. Seit 19.09.2026 (Justin): Das Kapital ist nicht an die USA
// gebunden — die Sätze dazu kommen aus GLOBAL_KAPITAL_FREI, immer mit Institut
// und Partner-Steuerberater.
// ═══════════════════════════════════════════════════════════════════════════
import { GLOBAL_PFLICHTHINWEIS, GLOBAL_ROLLEN, GLOBAL_LAUFEND, GLOBAL_KAPITAL_FREI } from "../fiaon-global";
import { VERKAUF_RAHMEN } from "../fiaon-global-verkauf-preise";
import type { GlobalSeite } from "./typen";
import { EIN_PRODUKT } from "./ein-produkt";

// E-509 (12.11.2026): EIN Produkt statt vier Pakete — jede Leistung dieser Seiten gehört zum einen Auftrag; Preise nur aus
// EIN_PRODUKT. Die Seite /business/miami (bis E-509: Global VIP mit Flug und Hotel) sagt jetzt: ab 1 Mio. US-Dollar persönlich.
export const STAND_LEISTUNGEN = "2026-11-12";
const S = STAND_LEISTUNGEN;
const P = EIN_PRODUKT.de;
/** „950.000 US-Dollar“ — bis dahin schließt der Kunde selbst ab (darüber: Miami). */
const SELBST_MAX = `${VERKAUF_RAHMEN.selbstMaxUsd.toLocaleString("de-DE")} US-Dollar`;

export const LEISTUNGEN: GlobalSeite[] = [
  // ─────────────────────────────────────────────────────────────────────────
  {
    pfad: "/business/us-firmengruendung",
    art: "leistung",
    seo: {
      titel: "US-Firma gründen: LLC oder Corporation — FIAON Global",
      beschreibung: "Ihre US-Gesellschaft aus Deutschland oder der Schweiz: Gründung, EIN, ITIN, Registered Agent und Adresse — in einem Auftrag, erstes Jahr inklusive.",
    },
    stand: S,
    kennung: "FG · 01",
    auge: "Leistung · US-Firmengründung",
    h1: "US-Firmengründung.",
    h1b: "Mit Team vor Ort, in einem Auftrag.",
    lead: "Wir gründen Ihre Gesellschaft in den USA, beantragen EIN und ITIN und stellen Registered Agent, US-Geschäftsadresse und Telefonnummer — aus Deutschland, Österreich oder der Schweiz, ohne dass Sie dafür reisen müssen. Ein Ansprechpartner, ein Vertrag, ein Auftrag.",
    ziffern: [
      { wert: P.preis, label: P.preisLabel },
      { wert: "wenige Wochen", label: "bis Ihre Gesellschaft steht — Erfahrungswert" },
      { wert: "3 Standorte", label: "London · Zürich · Miami" },
    ],
    blick: [
      ["Rechtsform", "LLC oder Corporation — entschieden vor der Gründung, geprüft durch unseren Partner-Steuerberater"],
      ["Bundesstaat", "Nach Ihrem Vorhaben, Ihren Kunden und Ihren Partnern in den USA"],
      ["Sie brauchen", "Reisepass, Adressnachweis, Namenswunsch, Tätigkeitsbeschreibung — als Unternehmen zusätzlich den Registerauszug"],
      ["Begleitung", "Im ersten Jahr: US-Büro, Assistenz und Meldungen — und bis zur Finanzierung"],
      ["Preis", `${P.preis} mit Ihrem Auftrag — Staatsgebühren und Partner-Honorare inklusive; Erfolgshonorar mit der Eintragung`],
      ["Vertragspartner", "FIAON LTD, London · vor Ort: Schwarzott Group, Miami"],
    ],
    kurz: "Eine US-Gesellschaft lässt sich vollständig aus dem Ausland gründen — ohne Wohnsitz in den USA, ohne Reise und ohne Mindestkapital. FIAON übernimmt Gründung, Steuernummern, Registered Agent, Adresse und Telefonnummer und die Abstimmung mit Anwalt, Steuerberater und US-CPA, in einem Auftrag. Steuerpflichtig bleibt die Gesellschaft in der Regel dort, wo sie tatsächlich geführt wird.",
    bloecke: [
      {
        typ: "text", id: "was-es-ist", h2: "Was eine US-Gesellschaft ist — und was nicht",
        absaetze: [
          "Die Limited Liability Company (LLC) kommt der deutschen GmbH am nächsten: Die Gesellschaft haftet mit ihrem Vermögen, Sie als Gesellschafter grundsätzlich nicht mit Ihrem privaten. Anders als eine GmbH braucht sie kein Mindestkapital und keinen Notartermin; die Satzung heißt Operating Agreement und regelt, wer entscheidet und wem der Gewinn zusteht.",
          "Die Corporation ähnelt eher einer Aktiengesellschaft. Sie passt, wenn Investoren einsteigen sollen, wenn Anteile an Mitarbeiter gehen oder wenn eine US-Bank oder ein Geschäftspartner ausdrücklich eine Corporation erwartet.",
          "Eine US-Gesellschaft ist kein Steuermodell. Wird sie aus Deutschland, Österreich oder der Schweiz geführt, bleibt sie in der Regel dort steuerpflichtig. Sinnvoll ist sie für Unternehmen, die in den USA verkaufen, einkaufen, Verträge schließen oder dort eine eigene Bank- und Kartenhistorie für ihren Kapitalbedarf aufbauen wollen.",
          `${GLOBAL_KAPITAL_FREI.de.satz} ${GLOBAL_KAPITAL_FREI.de.steuer}`,
        ],
      },
      {
        typ: "tabelle", id: "llc-corporation", h2: "LLC oder Corporation — die Unterschiede",
        lead: "Welche Form zu Ihrem Vorhaben passt, prüft unser Partner-Steuerberater vor der Gründung. Die Grundzüge:",
        kopf: ["", "LLC", "Corporation"],
        zeilen: [
          ["Haftung", "beschränkt auf das Gesellschaftsvermögen", "beschränkt auf das Gesellschaftsvermögen"],
          ["Besteuerung in den USA", "Eine LLC mit einem ausländischen Gesellschafter wird dort in der Regel steuerlich nicht als eigenes Steuersubjekt behandelt", "Die Gesellschaft zahlt Körperschaftsteuer des Bundes, dazu je nach Staat eine eigene"],
          ["Innere Ordnung", "Operating Agreement, frei gestaltbar", "Satzung, Vorstand, Anteile nach festen Regeln"],
          ["Investoren und Mitarbeiteranteile", "möglich, aber seltener üblich", "der übliche Weg"],
          ["Passt zu", "Handel, Dienstleistung, Holding, eigene Kartenhistorie", "Wachstum mit Investoren, Beteiligung von Mitarbeitern"],
        ],
        fuss: ["Die Einordnung durch das Finanzamt im Heimatland folgt eigenen Regeln (in Deutschland ein Typenvergleich) — auch das klärt der Partner-Steuerberater vorab."],
      },
      {
        typ: "etappen", id: "ablauf", h2: "So läuft die Gründung ab",
        lead: "Fünf Schritte, eine Reihenfolge. Dauern nennen wir als Erfahrungswerte — Behörden bestimmen ihr eigenes Tempo.",
        etappen: [
          { titel: "Startgespräch und Prüfung", dauer: "in der ersten Woche", text: "Ihr Ansprechpartner klärt Vorhaben, Rechtsform und Bundesstaat. Unser Partner-Steuerberater prüft vor der Gründung, wie die Gesellschaft in Ihrem Heimatland behandelt wird und welche Meldungen dort anfallen." },
          { titel: "Reisepass und Name", dauer: "sobald beides vorliegt", text: "Sie laden Ihren Reisepass hoch und wählen den Namen Ihrer Gesellschaft, dazu zwei Ausweichnamen. Der Bundesstaat vergibt jeden Namen nur einmal." },
          { titel: "Gründung und Operating Agreement", dauer: "in der Regel wenige Wochen", text: "Unser Team vor Ort reicht die Gründung beim Bundesstaat ein, stellt Registered Agent, US-Geschäftsadresse und Telefonnummer. Unser Partner-Anwalt setzt das Operating Agreement auf." },
          { titel: "EIN und ITIN", dauer: "je nach IRS", text: "Wir bereiten die Anträge vor und reichen sie ein. Die EIN erhält Ihre Gesellschaft, die ITIN Sie persönlich — beide vergibt die US-Steuerbehörde IRS in eigener Frist." },
          { titel: "Konto, Karte und Pflichtenkalender", dauer: "mit vollständigen Dokumenten", text: "Wir bereiten den ersten Konto- und Kartenantrag vollständig vor und tragen alle Fristen Ihrer Gesellschaft in den Pflichtenkalender ein. Die erste jährliche US-Meldung erstellt unser US-CPA." },
        ],
      },
      {
        typ: "rollen", id: "wer-was-tut", h2: "Wer was tut",
        lead: GLOBAL_ROLLEN.de.fiaon,
        fiaon: ["Koordination aller Beteiligten, ein Ansprechpartner", "Gründung, Registered Agent, Adresse und Telefon", "Anträge für EIN und ITIN", "Konto- und Kartenantrag vorbereitet", "Pflichtenkalender und Dokumentenraum"],
        partner: ["Partner-Steuerberater: Prüfung vor der Gründung", "Partner-Anwalt: Operating Agreement", "US-CPA: erste jährliche US-Meldung", "Schwarzott Group, Miami: Termine und Einreichungen vor Ort"],
        sie: ["fünf Unterlagen hochladen", "Rechtsform und Namen entscheiden", "Anträge unterschreiben", "Ihre Gesellschaft im Heimatland melden — mit Ihrem Steuerberater"],
      },
      {
        typ: "text", id: "inklusive", h2: "Was im Preis enthalten ist",
        absaetze: ["Sie zahlen einen Preis. Die Honorare unserer Partner für die Leistungen Ihres Auftrags tragen wir:"],
        punkte: [...P.enthalten],
        nach: GLOBAL_LAUFEND.de,
      },
      {
        typ: "hinweis", id: "wissen", h2: "Was Sie vor der Gründung wissen müssen",
        punkte: [...GLOBAL_PFLICHTHINWEIS.de, P.geldZurueck],
      },
      { typ: "paket", id: "mandat", h2: P.karteH2, lead: P.karteLead, paket: "global_struktur" },
      { typ: "standorte", id: "standorte", h2: "Drei Standorte, ein Vertrag", lead: "Ihr Vertragspartner sitzt in London, die Partner in Zürich und Miami." },
    ],
    fragen: [
      { f: "Kann ich eine US-Firma gründen, ohne in den USA zu wohnen?", a: "Ja. Für die Gründung einer LLC oder Corporation brauchen Sie weder einen Wohnsitz noch eine Staatsbürgerschaft in den USA. Die gesetzlich vorgeschriebene Anschrift im Bundesstaat stellt der Registered Agent, die Geschäftsadresse und Telefonnummer stellen wir." },
      { f: "Muss ich für die Gründung in die USA reisen?", a: "Nein. Unser Team vor Ort reicht ein und nimmt Termine wahr; Sie unterschreiben online. Ab einem Kapitalrahmen von 1 Mio. US-Dollar treffen wir Sie persönlich in Miami." },
      { f: "LLC oder Corporation — was passt zu mir?", a: "Für Handel, Dienstleistung und den Aufbau einer eigenen Kartenhistorie ist die LLC meist die einfachere Form. Eine Corporation passt, wenn Investoren einsteigen oder Mitarbeiter Anteile erhalten sollen. Unser Partner-Steuerberater prüft das vor der Gründung für Ihren Fall." },
      { f: "Wie lange dauert eine US-Firmengründung?", a: "Die Gesellschaft selbst steht in der Regel nach wenigen Wochen. EIN und ITIN hängen von der US-Steuerbehörde ab, die ihre Fristen selbst bestimmt." },
      { f: "Was kostet eine US-Firmengründung bei FIAON?", a: `${P.preisSatzKurz} Ab dem zweiten Jahr fallen die laufenden Kosten der Gesellschaft an; die Aufstellung steht auf der Seite „Kosten“.` },
      { f: "Ist eine US-Gesellschaft ein Steuermodell?", a: `Nein. Wird die Gesellschaft aus Deutschland, Österreich oder der Schweiz geführt, ist sie in der Regel dort steuerpflichtig, und in den USA kommen jährliche Meldepflichten hinzu. Eine US-Gesellschaft lohnt sich für echtes Geschäft in den USA und für den Aufbau von Kapital — nicht als Steuermodell. ${GLOBAL_KAPITAL_FREI.de.satz} ${GLOBAL_KAPITAL_FREI.de.steuer}` },
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
      beschreibung: "EIN für Ihre US-Gesellschaft, ITIN für Sie persönlich: Wir klären den steuerlichen Grund, bereiten beide Anträge vor und reichen sie bei der IRS ein.",
    },
    stand: S,
    kennung: "FG · 02",
    auge: "Leistung · US-Steuernummern",
    h1: "EIN und ITIN.",
    h1b: "Die zwei Nummern, ohne die nichts läuft.",
    lead: "Die EIN ist die Steuernummer Ihrer US-Gesellschaft, die ITIN Ihre persönliche US-Steuernummer. Ohne EIN gibt es kein Geschäftskonto und keine US-Meldung, ohne ITIN in der Regel keine persönliche Kredithistorie in den USA. Wir bereiten beide Anträge vor und reichen sie ein.",
    ziffern: [
      { wert: "enthalten", label: "EIN und ITIN: Anträge vorbereitet und eingereicht" },
      { wert: "ohne SSN", label: "Die EIN braucht keine US-Sozialversicherungsnummer" },
      { wert: "IRS", label: "Beide Nummern vergibt die US-Steuerbehörde" },
    ],
    blick: [
      ["EIN", "Steuernummer der Gesellschaft — Formular SS-4, bei der IRS kostenlos"],
      ["ITIN", "Persönliche Steuernummer — Formular W-7 mit geprüftem Pass"],
      ["Voraussetzung ITIN", "Ein steuerlicher Grund, den die IRS anerkennt — wir prüfen ihn vor dem Antrag"],
      ["Ihr Pass", "Prüfung durch unseren zertifizierten Acceptance-Agent-Partner im DACH-Raum — persönlich oder im Videotermin"],
      ["Dauer laut IRS", "EIN per Fax etwa vier Werktage · ITIN sieben, aus dem Ausland neun bis elf Wochen"],
      ["Im Auftrag", "Enthalten, ohne Aufpreis"],
    ],
    kurz: "Die EIN (Employer Identification Number) erhält Ihre Gesellschaft von der US-Steuerbehörde IRS — kostenlos und ohne US-Sozialversicherungsnummer. Die ITIN (Individual Taxpayer Identification Number) erhalten Sie persönlich, wenn ein steuerlicher Grund vorliegt; beantragt wird sie mit Formular W-7 und einem geprüften Pass. FIAON bereitet beide Anträge vor und reicht sie ein; entscheiden tut die IRS.",
    bloecke: [
      {
        typ: "tabelle", id: "vergleich", h2: "EIN und ITIN im Vergleich",
        kopf: ["", "EIN", "ITIN"],
        zeilen: [
          ["Für wen", "Ihre US-Gesellschaft", "Sie als Person"],
          ["Wozu", "Konto, Meldungen, Rechnungen, Verträge", "persönliche Steuerpflichten und Kredithistorie in den USA"],
          ["Formular", "SS-4", "W-7"],
          ["Voraussetzung", "eine gegründete Gesellschaft", "ein steuerlicher Grund, den die IRS anerkennt"],
          ["Gebühr der IRS", "keine", "keine"],
          ["Dauer laut IRS", "Fax etwa vier Werktage, Post etwa vier Wochen", "etwa sieben Wochen, aus dem Ausland neun bis elf"],
          // E-465 (29.10.2026): die heutige Praxis neben der Angabe der IRS (shared/fiaon-global-bundesstaaten.ts, EIN_ZEITEN).
          ["Derzeit in der Praxis", "Telefon aus dem Ausland am selben Tag, Fax oft rund zwei Wochen", "wie laut IRS"],
        ],
        fuss: ["Bearbeitungszeiten laut IRS (Stand 2026): EIN per Fax etwa vier Werktage, per Post etwa vier Wochen; ITIN etwa sieben Wochen, zwischen Mitte Januar und Ende April sowie bei Anträgen aus dem Ausland neun bis elf Wochen."],
      },
      {
        typ: "text", id: "ein", h2: "Die EIN — die Nummer Ihrer Gesellschaft",
        absaetze: [
          "Jede US-Gesellschaft braucht eine EIN: für das Geschäftskonto, für Rechnungen an US-Kunden, für die jährliche Meldung an die IRS und für jeden Vertrag, bei dem ein US-Partner eine Steuernummer verlangt.",
          "Das Online-Verfahren der IRS setzt eine US-Steuernummer der verantwortlichen Person voraus. Gesellschafter ohne eine solche Nummer beantragen die EIN schriftlich mit Formular SS-4 — das übernehmen wir: ausfüllen, von Ihnen unterschreiben lassen, einreichen und die Bestätigung der IRS in Ihren Dokumentenraum legen.",
        ],
      },
      {
        typ: "text", id: "itin", h2: "Die ITIN — Ihre persönliche US-Steuernummer",
        absaetze: [
          "Die ITIN ist für Menschen gedacht, die in den USA steuerlich erfasst werden müssen, aber keine Sozialversicherungsnummer erhalten können. Sie ist keine Arbeitserlaubnis und kein Aufenthaltstitel, sondern allein eine Steuernummer.",
          "Für US-Firmenkarten zählt sie, weil ein Herausgeber bei der persönlichen Haftung des Inhabers die Person prüft — und dafür eine US-Steuernummer braucht. Die IRS vergibt die ITIN aber nur mit einem steuerlichen Grund: In der Regel wird sie zusammen mit einer US-Steuererklärung beantragt oder über eine der Ausnahmen, die die IRS zulässt. Ob und welcher Grund in Ihrem Fall vorliegt, klären wir vor dem Antrag mit unserem US-CPA; einen Antrag ohne tragfähigen Grund stellen wir nicht.",
          "Ihren Pass müssen Sie nicht in die USA schicken: Unser zertifizierter Acceptance-Agent-Partner im DACH-Raum prüft ihn persönlich oder im Videotermin und reicht den Antrag ein.",
        ],
      },
      {
        typ: "etappen", id: "ablauf", h2: "So laufen die Anträge ab",
        etappen: [
          { titel: "Gesellschaft gegründet", text: "Die EIN kann erst beantragt werden, wenn die Gesellschaft beim Bundesstaat eingetragen ist." },
          { titel: "SS-4 vorbereitet und eingereicht", text: "Wir füllen das Formular aus, Sie unterschreiben, wir reichen ein. Die Bestätigung der IRS liegt danach in Ihrem Dokumentenraum." },
          { titel: "Grund für die ITIN geprüft", text: "Unser US-CPA prüft, welcher steuerliche Grund vorliegt. Ohne tragfähigen Grund stellen wir keinen Antrag — statt ihn ins Leere laufen zu lassen." },
          { titel: "W-7 mit geprüftem Pass", text: "Unser zertifizierter Acceptance-Agent-Partner prüft Ihren Pass; der Antrag geht mit den nötigen Anlagen an die IRS, und wir verfolgen ihn bis zum Bescheid." },
        ],
      },
      {
        typ: "hinweis", id: "wissen", h2: "Was Sie wissen müssen",
        punkte: [
          "Beide Nummern vergibt allein die IRS, in eigener Frist. FIAON bereitet vor und reicht ein — entscheiden kann FIAON nicht.",
          "Die ITIN setzt einen steuerlichen Grund voraus. Ein Konto- oder Kartenwunsch allein ist kein Grund, den die IRS anerkennt.",
          "Eine ITIN ist keine Kreditkarte und kein Rahmen. Sie ist eine Voraussetzung, damit ein Herausgeber Sie überhaupt prüfen kann.",
        ],
      },
      { typ: "paket", id: "mandat", h2: P.karteH2, lead: "EIN und ITIN sind in Ihrem Auftrag enthalten.", paket: "global_struktur" },
    ],
    fragen: [
      { f: "Brauche ich eine US-Sozialversicherungsnummer für die EIN?", a: "Nein. Gesellschafter ohne US-Steuernummer beantragen die EIN schriftlich mit Formular SS-4. Das Online-Verfahren der IRS steht nur Antragstellern mit US-Steuernummer offen." },
      { f: "Was kostet die EIN bei der IRS?", a: "Nichts. Die IRS erhebt für die EIN keine Gebühr. Bei FIAON Global sind Vorbereitung und Einreichung in Ihrem Auftrag enthalten." },
      { f: "Wozu brauche ich eine ITIN?", a: "Für persönliche Steuerpflichten in den USA — und damit ein US-Herausgeber Sie als Person prüfen kann, wenn Sie für eine Firmenkarte persönlich haften. Die IRS vergibt die ITIN nur mit einem steuerlichen Grund." },
      { f: "Bekomme ich mit der ITIN automatisch eine Kreditkarte?", a: "Nein. Die ITIN ist eine Steuernummer. Ob ein Herausgeber eine Karte ausgibt und mit welchem Rahmen, entscheidet er selbst nach seinen Regeln." },
      { f: "Muss ich meinen Pass in die USA schicken?", a: "Nein. Unser zertifizierter Acceptance-Agent-Partner im DACH-Raum prüft Ihren Pass persönlich oder im Videotermin und reicht den Antrag ein." },
      { f: "Wie lange dauert die ITIN?", a: "Nach Angabe der IRS etwa sieben Wochen; zwischen Mitte Januar und Ende April sowie bei Anträgen aus dem Ausland neun bis elf Wochen. FIAON kann das nicht beschleunigen — wir sorgen dafür, dass der Antrag vollständig ist, denn unvollständige Anträge sind der häufigste Grund für Verzögerungen." },
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
      beschreibung: "US-Konto für Ihre LLC oder Corporation: Unterlagen zusammengestellt, Antrag vollständig vorbereitet, Rückfragen begleitet. Das Institut entscheidet.",
    },
    stand: S,
    kennung: "FG · 03",
    auge: "Leistung · US-Geschäftskonto",
    h1: "Das US-Geschäftskonto.",
    h1b: "Vorbereitet, bevor das Institut fragt.",
    lead: "Ein US-Konto für Ihre Gesellschaft steht und fällt mit den Unterlagen. Wir stellen sie vollständig zusammen, bereiten den Antrag vor und begleiten jede Rückfrage des Instituts — online oder, wo nötig, mit unserem Team vor Ort.",
    ziffern: [
      { wert: "enthalten", label: "Konto- und Kartenanträge vollständig vorbereitet" },
      { wert: "keine Vollmacht", label: "FIAON hat nie Zugriff auf Ihr Konto" },
      { wert: "Miami", label: "Termine vor Ort mit unserem Team, wo ein Institut sie verlangt" },
    ],
    blick: [
      ["Kontoinhaber", "Ihre US-Gesellschaft — nicht FIAON"],
      ["Voraussetzung", "Gegründete Gesellschaft, EIN, Operating Agreement, US-Geschäftsadresse"],
      ["Wie", "Online oder mit einem Termin vor Ort, je nach Institut"],
      ["FIAON", "Unterlagen, Antrag, Rückfragen, Termine — keine Vollmacht über Ihr Geld"],
      ["Entscheidung", "Allein das Institut, nach eigenen Regeln"],
      ["Im Auftrag", "Privates Konto, Geschäftskonto und Karten: jeder Antrag vorbereitet"],
    ],
    kurz: "Eine US-Gesellschaft kann ein Geschäftskonto in den USA eröffnen, wenn sie eingetragen ist und eine EIN hat. Institute verlangen dafür Gründungsunterlagen, die EIN-Bestätigung, das Operating Agreement, Ausweise der Gesellschafter und eine nachvollziehbare Beschreibung des Geschäfts. FIAON bereitet diese Unterlagen und den Antrag vollständig vor; ob und zu welchen Bedingungen ein Konto eröffnet wird, entscheidet das Institut.",
    bloecke: [
      {
        typ: "text", id: "unterlagen", h2: "Was ein Institut sehen will",
        absaetze: ["Die Liste ist bei den meisten Instituten ähnlich. Fehlt ein Teil oder widersprechen sich zwei Unterlagen, bleibt der Antrag liegen — deshalb prüfen wir alles, bevor etwas eingereicht wird:"],
        punkte: [
          "Gründungsunterlagen der Gesellschaft (Articles of Organization oder Incorporation)",
          "Bestätigung der EIN durch die IRS",
          "Operating Agreement oder Satzung",
          "Reisepässe der Gesellschafter und der Geschäftsführung",
          "US-Geschäftsadresse und Telefonnummer",
          "eine klare Beschreibung des Geschäfts: was, für wen, mit welchen Zahlungsströmen",
        ],
      },
      {
        typ: "karten", id: "wege", h2: "Online oder vor Ort", spalten: 2,
        karten: [
          { tag: "Online", titel: "Eröffnung aus der Ferne", text: "Viele Institute eröffnen Konten für Gesellschaften mit Gesellschaftern im Ausland vollständig online. Wir bereiten den Antrag so vor, dass Rückfragen die Ausnahme bleiben." },
          { tag: "Vor Ort", titel: "Termin in der Filiale", text: "Manche Institute verlangen einen persönlichen Termin. Dann planen wir ihn rechtzeitig mit Ihnen und begleiten Sie vor Ort." },
        ],
      },
      {
        typ: "text", id: "ablehnung", h2: "Warum Konten abgelehnt werden",
        absaetze: ["Die häufigsten Gründe sind keine Zufälle, sondern Lücken, die sich vorher schließen lassen:"],
        punkte: [
          "Das Geschäftsmodell ist aus den Unterlagen nicht zu verstehen.",
          "Es fehlt ein erkennbarer Bezug zu den USA — Kunden, Lieferanten oder Verträge.",
          "Namen, Adressen oder Beteiligungen stimmen in zwei Unterlagen nicht überein.",
          "Zahlungsströme berühren Länder oder Branchen, die das Institut nicht bedient.",
        ],
        nach: "Wir benennen solche Lücken vor dem Antrag — nicht erst nach der Ablehnung.",
      },
      {
        typ: "hinweis", id: "wissen", h2: "Was Sie wissen müssen",
        punkte: [
          "Über Konto, Karte und Rahmen entscheidet allein das jeweilige Institut.",
          "FIAON nennt auf dieser Seite keine Institute: Ihre Anforderungen ändern sich, und welches passt, hängt von Ihrem Vorhaben ab. Im Startgespräch nennen wir Ihnen den aktuellen Stand.",
          "Kontoinhaber ist Ihre Gesellschaft. FIAON erhält keine Vollmacht über Ihr Konto und nimmt nie Geld für Sie entgegen.",
        ],
      },
      { typ: "paket", id: "mandat", h2: P.karteH2, lead: "Konto- und Kartenanträge sind in Ihrem Auftrag enthalten — jeder vollständig vorbereitet.", paket: "global_banking" },
    ],
    fragen: [
      { f: "Kann ich als Deutscher ein US-Geschäftskonto eröffnen?", a: "Ja — für Ihre US-Gesellschaft. Voraussetzung sind eine eingetragene Gesellschaft, eine EIN und vollständige Unterlagen. Ob ein Institut das Konto eröffnet, entscheidet es selbst." },
      { f: "Muss ich dafür in die USA reisen?", a: "Oft nicht: Viele Institute eröffnen Konten für Gesellschafter im Ausland online. Verlangt ein Institut einen Termin, begleitet Sie unser Team in Miami." },
      { f: "Welche Unterlagen braucht die Bank?", a: "In der Regel Gründungsunterlagen, EIN-Bestätigung, Operating Agreement, Reisepässe, US-Geschäftsadresse und eine klare Beschreibung des Geschäfts. Wir stellen sie zusammen und prüfen sie auf Widersprüche." },
      { f: "Warum nennt FIAON keine Banknamen?", a: "Weil sich die Anforderungen der Institute laufend ändern und die passende Wahl von Ihrem Vorhaben abhängt. Welche Institute aktuell in Frage kommen, besprechen wir im Startgespräch." },
      { f: "Hat FIAON Zugriff auf mein Konto?", a: "Nein. Kontoinhaber ist Ihre Gesellschaft. FIAON erhält keine Vollmacht und nimmt nie Geld für Sie entgegen." },
    ],
    paket: "global_banking",
    weiter: ["/business/wissen/us-bankkonto-unterlagen", "/business/firmenkarten-kapital", "/business/ein-itin", "/business/wissen/registered-agent-adresse"],
  },

  // ─────────────────────────────────────────────────────────────────────────
  {
    pfad: "/business/firmenkarten-kapital",
    art: "leistung",
    seo: {
      titel: "US-Firmenkarten und Kapitalaufbau — FIAON Global",
      beschreibung: "Die Kartenleiter: erste US-Firmenkarte, planvolle Folgeanträge, Kennzahlen für ein Bankdarlehen. Der Kapitalrahmen ist Ihr Ziel — das Institut entscheidet.",
    },
    stand: S,
    kennung: "FG · 04",
    auge: "Leistung · Firmenkarten und Kapital",
    h1: "Firmenkarten und Kapital.",
    h1b: "Schritt für Schritt aufgebaut.",
    lead: "Kapital bei US-Instituten wächst nicht über einen Antrag, sondern über eine Historie: die erste Firmenkarte, pünktliche Abrechnung, weitere Herausgeber in einer klugen Reihenfolge — und später ein mögliches Bankdarlehen. Wir planen die Reihenfolge und bereiten jeden Antrag vor.",
    ziffern: [
      { wert: P.rahmenKurz, label: "Kapitalrahmen, den Sie selbst wählen — über die Finanzierung entscheidet das Institut" },
      { wert: "vier Etappen", label: "Gründung, erste Karte, Kartenleiter, Bankdarlehen" },
      { wert: "Zürich", label: "Kapital-Etappe mit der Schwarzott Group" },
    ],
    blick: [
      ["Kapitalrahmen", `${P.rahmen} — Sie wählen ihn selbst`],
      ["Erste Karte", "Meist kleiner Rahmen, ohne Bareinlage, mit persönlicher Haftung des Inhabers"],
      ["Kartenleiter", "Weitere Herausgeber nach einigen Monaten pünktlicher Abrechnung"],
      ["Finanzierung", "Wir begleiten bis zur Auszahlung — über die Finanzierung entscheidet das finanzierende Institut"],
      ["Verwendung", `${GLOBAL_KAPITAL_FREI.de.kurz} — die steuerliche Behandlung klärt unser Partner-Steuerberater vorab`],
      ["FIAON", "Plant, bereitet vor, begleitet — vergibt und vermittelt keine Kredite"],
      ["Entscheidung", "Allein das jeweilige Institut"],
    ],
    kurz: "US-Firmenkarten und Kreditrahmen entstehen aus Historie: Eine neue Gesellschaft beginnt meist mit einer Karte mit kleinem Rahmen, die der Inhaber persönlich absichert. Pünktliche Abrechnung über einige Monate öffnet weitere Herausgeber, eine gewachsene Historie später ein mögliches Bankdarlehen. FIAON plant diese Reihenfolge und bereitet jeden Antrag vor; über jeden Rahmen entscheidet das Institut.",
    bloecke: [
      {
        typ: "etappen", id: "leiter", h2: "Die Kartenleiter in vier Etappen",
        lead: "Dauern sind Erfahrungswerte. Wie schnell eine Etappe geht, bestimmen die Institute — und Ihre pünktliche Abrechnung.",
        etappen: [
          { titel: "Gründung und Dokumente", dauer: "in der Regel wenige Wochen", text: "Gesellschaft, EIN, ITIN, US-Adresse und Telefonnummer — ohne sie prüft kein Herausgeber einen Antrag." },
          { titel: "Die erste Firmenkarte", dauer: "nach vollständigen Dokumenten", text: "Der erste Antrag bei einem US-Herausgeber — meist mit kleinem Rahmen und ohne Bareinlage, dafür mit persönlicher Haftung des Inhabers." },
          { titel: "Die Kartenleiter", dauer: "nach einigen Monaten", text: "Pünktliche Abrechnung öffnet weitere Herausgeber. Wir planen die Reihenfolge und bereiten jeden Antrag vor; ob und zu welchen Bedingungen ein Herausgeber zusagt, legt er selbst fest." },
          { titel: "Das Bankdarlehen", dauer: "mit gewachsener Historie", text: "Mit einer Historie über mehrere Herausgeber kann ein Darlehen bei einer US-Bank in Frage kommen. Wir bereiten Kennzahlen und Unterlagen auf; den Antrag stellen Sie, die Bank prüft nach ihren Regeln." },
        ],
      },
      {
        typ: "tabelle", id: "kapitalrahmen", h2: "Ihr Kapitalrahmen",
        lead: "Der Kapitalrahmen ist das Ziel, das Sie selbst wählen. Danach richtet sich unsere Begleitung — er ist kein Ergebnis, das FIAON zusagen kann.",
        kopf: ["Kapitalrahmen", "Wie es läuft", "Abschluss"],
        zeilen: [
          [`${P.rahmenAb} bis ${SELBST_MAX}`, "aus der Ferne", "online, im Konfigurator"], [`ab ${P.rahmenEnde}`, "persönlich in Miami", "nach unserem Gespräch"],
        ],
        hervor: 1,
        fuss: ["Über Konto, Karte, Rahmen und Darlehen entscheidet allein das jeweilige Institut."],
      },
      // 19.09.2026 — Justin: „Das Kapital muss NICHT in den USA ausgegeben werden." Wortlaut aus GLOBAL_KAPITAL_FREI.
      {
        typ: "text", id: "europa", h2: "Einsetzbar in den USA und in Europa",
        absaetze: [GLOBAL_KAPITAL_FREI.de.satz, GLOBAL_KAPITAL_FREI.de.steuer],
      },
      {
        typ: "text", id: "wovon", h2: "Wovon ein Rahmen abhängt",
        absaetze: ["Herausgeber und Banken entscheiden nach eigenen Regeln. In ihre Prüfung fließt fast immer ein:"],
        punkte: [
          "die Dauer und Pünktlichkeit der bisherigen Abrechnung",
          "Umsatz und Zahlungsströme der Gesellschaft",
          "ein nachvollziehbares Geschäft mit Bezug zu den USA",
          "die persönliche Kreditwürdigkeit des haftenden Inhabers",
          "vollständige, widerspruchsfreie Unterlagen",
        ],
        nach: "Auf die ersten drei Punkte haben Sie Einfluss — und genau dort setzt unsere Planung an.",
      },
      {
        typ: "karten", id: "grenzen", h2: "Was FIAON tut — und was nicht", spalten: 2,
        karten: [
          { tag: "FIAON tut", titel: "Planen, vorbereiten, begleiten", text: "Reihenfolge der Herausgeber, vollständige Anträge, Kennzahlen-Mappe für ein späteres Darlehen, monatlicher Durchgang mit Ihrem Ansprechpartner." },
          { tag: "FIAON tut nicht", titel: "Zusagen, vergeben, vermitteln", text: "FIAON ist keine Bank, vergibt keine Kredite, vermittelt keine Kredite und sagt keinen Rahmen zu. Jede Entscheidung trifft das Institut." },
        ],
      },
      {
        typ: "hinweis", id: "wissen", h2: "Was Sie wissen müssen",
        punkte: [
          "US-Firmenkarten setzen in der Regel die persönliche Haftung des Inhabers voraus. Wer haftet, steht mit seinem Vermögen für die Abrechnung ein.",
          "Ein Kapitalrahmen ist ein Ziel, kein Versprechen. Die Zahl richtet die Begleitung aus; über jeden Rahmen entscheidet das Institut.",
          "Einführungszeiträume ohne Sollzins bieten manche Herausgeber an; die Bedingungen legt jeder Herausgeber selbst fest und kann sie ändern.",
        ],
      },
      { typ: "paket", id: "mandat", h2: P.karteH2, lead: P.karteLead, paket: "global_kapital" },
      { typ: "standorte", id: "standorte", h2: "Die Kapital-Etappe", lead: "Die Schwarzott Group in Zürich begleitet die Kapital-Etappe: Kennzahlen und Unterlagen für Finanzierungsgespräche." },
    ],
    fragen: [
      { f: "Wie hoch wird mein Kartenrahmen?", a: "Das entscheidet der Herausgeber nach seinen Regeln. Der Kapitalrahmen, den Sie wählen, ist Ihr Ziel und richtet unsere Begleitung aus — er ist keine Zusage." },
      { f: GLOBAL_KAPITAL_FREI.de.frage, a: GLOBAL_KAPITAL_FREI.de.antwort },
      { f: "Brauche ich eine Sicherheit für die erste Firmenkarte?", a: "Die erste Karte gibt es meist ohne Bareinlage, aber mit persönlicher Haftung des Inhabers. Die Haftung ist die Absicherung des Herausgebers." },
      { f: "Vermittelt FIAON Kredite?", a: "Nein. FIAON ist keine Bank, vergibt keine Kredite und vermittelt keine. Wir planen die Reihenfolge, bereiten Anträge und Unterlagen vor und begleiten Sie; entscheiden tut das Institut." },
      { f: "Wie groß kann der Kapitalrahmen sein?", a: P.rahmenSatz },
      { f: "Wie lange dauert der Aufbau?", a: "Die Gesellschaft steht in der Regel nach wenigen Wochen; Konto, Karten und Finanzierung folgen der Prüfung der Institute. Wie schnell es geht, bestimmen die Institute und Ihre pünktliche Abrechnung." },
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
      beschreibung: "Form 5472 mit Form 1120, Jahresmeldung, Registered Agent: Wir führen den Pflichtenkalender Ihrer US-Gesellschaft, unser US-CPA erstellt die erste Meldung.",
    },
    stand: S,
    kennung: "FG · 05",
    auge: "Leistung · US-Pflichten",
    h1: "Ihre US-Pflichten.",
    h1b: "Im Kalender, nicht im Hinterkopf.",
    lead: "Eine US-Gesellschaft hat Pflichten, auch wenn sie keinen Umsatz macht: die jährliche Meldung an die IRS, die Gebühr des Bundesstaats, den Registered Agent — und die Meldung im Heimatland. Wir führen den Kalender, unser US-CPA erstellt die erste Meldung.",
    ziffern: [
      { wert: "Form 5472", label: "mit Form 1120 — jährlich, auch ohne Umsatz" },
      { wert: "15. April", label: "Frist der IRS für Gesellschaften mit Kalenderjahr" },
      { wert: "enthalten", label: "Erste jährliche US-Meldung durch unseren US-CPA" },
    ],
    blick: [
      ["IRS", "Form 5472 mit Form 1120 für Gesellschaften mit ausländischem Gesellschafter"],
      ["Bundesstaat", "Jahresmeldung oder Jahresgebühr, je nach Staat mit eigener Frist"],
      ["Registered Agent", "Jährlich — ohne ihn keine gültige Anschrift im Bundesstaat"],
      ["Heimatland", "Meldung der Beteiligung und Steuererklärung — mit Ihrem Steuerberater"],
      ["Im Auftrag", "Erste US-Meldung durch US-CPA · Pflichtenkalender"],
      ["Ab Jahr zwei", `Jahresbetreuung: ${P.jahres} im Jahr, alle Gebühren inklusive`],
    ],
    kurz: "Eine US-Gesellschaft mit einem ausländischen Gesellschafter muss der IRS jedes Jahr Form 5472 zusammen mit Form 1120 übermitteln — auch ohne Umsatz. Dazu kommen die Jahresmeldung oder Jahresgebühr des Bundesstaats und der Registered Agent. Im Heimatland ist die Beteiligung zu melden und die Gesellschaft in der Regel dort zu versteuern. FIAON führt den Pflichtenkalender; die erste jährliche US-Meldung erstellt unser US-CPA, im Preis enthalten.",
    bloecke: [
      {
        typ: "tabelle", id: "kalender", h2: "Die Pflichten einer US-Gesellschaft im Jahr",
        kopf: ["Pflicht", "Bei wem", "Frist", "Wer sie übernimmt"],
        zeilen: [
          ["Form 5472 mit Form 1120", "IRS, per Fax oder Post", "15. April, mit Form 7004 bis 15. Oktober", "US-CPA (erstes Jahr enthalten)"],
          ["Jahresmeldung oder Jahressteuer", "Bundesstaat", "Florida 1. Januar bis 1. Mai · Delaware 1. Juni · Wyoming im Gründungsmonat", "FIAON im Pflichtenkalender"],
          ["Registered Agent", "Bundesstaat", "jährlich", "im ersten Jahr enthalten"],
          ["Meldung der Beteiligung (DE: § 138 AO)", "Finanzamt im Heimatland", "mit der Steuererklärung, spätestens 14 Monate nach Jahresende", "Ihr Steuerberater"],
          ["Steuererklärung der Gesellschaft", "Finanzamt im Heimatland", "nach dortigem Recht", "Ihr Steuerberater"],
        ],
        fuss: ["IRS-Frist für Gesellschaften, deren Geschäftsjahr dem Kalenderjahr entspricht. Staatsfristen für LLCs; Beträge und Einzelheiten auf den Seiten der Bundesstaaten und unter „Kosten“.", "In den USA gegründete Gesellschaften sind seit dem 14. August 2026 von der Meldung wirtschaftlich Berechtigter (BOI) an FinCEN befreit."],
      },
      {
        typ: "text", id: "form-5472", h2: "Form 5472 — die Meldung, die niemand vergessen darf",
        absaetze: [
          "Gehört eine US-Gesellschaft einem ausländischen Gesellschafter, meldet sie der IRS jedes Jahr ihre Geschäfte mit ihm: Einlagen, Entnahmen, Darlehen, bezahlte Leistungen. Dafür gibt es Form 5472, eingereicht zusammen mit einer Form 1120, die bei einer solchen Gesellschaft nur als Deckblatt dient.",
          "Die Meldung ist auch dann Pflicht, wenn die Gesellschaft keinen Umsatz gemacht hat — schon die Einlage bei der Gründung ist eine meldepflichtige Transaktion. Eingereicht wird sie nicht elektronisch, sondern per Fax oder Post. Für eine fehlende oder wesentlich unvollständige Meldung kann die IRS eine Strafe von 25.000 US-Dollar je Formular und Jahr festsetzen; bleibt die Meldung nach einer Aufforderung aus, kommen weitere Beträge hinzu.",
        ],
      },
      {
        typ: "text", id: "heimat", h2: "Die Pflichten im Heimatland",
        absaetze: [
          "In Deutschland ist die Gründung oder der Erwerb einer Beteiligung an einer ausländischen Gesellschaft dem Finanzamt zu melden (§ 138 AO) — zusammen mit der Steuererklärung, spätestens 14 Monate nach Ablauf des Jahres. Wer die Meldung versäumt, riskiert ein Bußgeld von höchstens 25.000 Euro (§ 379 AO). Wie das Finanzamt die US-Gesellschaft einordnet, richtet sich nach einem Typenvergleich.",
          "In der Schweiz und in Österreich gelten eigene Regeln. In allen drei Ländern gilt: Wird die Gesellschaft von dort aus geführt, ist sie dort in der Regel steuerpflichtig. Das klärt unser Partner-Steuerberater vor der Gründung — die laufende Steuererklärung übernimmt Ihr Steuerberater.",
        ],
      },
      {
        typ: "hinweis", id: "wissen", h2: "Was Sie wissen müssen",
        punkte: [
          "Fristen und Strafen setzen die Behörden, nicht FIAON. Der Pflichtenkalender erinnert rechtzeitig; die Verantwortung für die Gesellschaft bleibt bei Ihnen.",
          GLOBAL_LAUFEND.de,
          "Die laufende Buchhaltung und die Steuererklärung im Heimatland sind nicht Teil Ihres Auftrags; sie übernimmt Ihr Steuerberater.",
        ],
      },
      { typ: "paket", id: "mandat", h2: P.karteH2, lead: "Der Pflichtenkalender für alle US-Meldungen und Fristen ist in Ihrem Auftrag enthalten.", paket: "global_banking" },
    ],
    fragen: [
      { f: "Muss ich Form 5472 auch ohne Umsatz abgeben?", a: "Ja. Die Pflicht hängt nicht am Umsatz, sondern daran, dass die Gesellschaft einem ausländischen Gesellschafter gehört und Geschäfte mit ihm meldet — Gründungseinlagen zählen bereits dazu." },
      { f: "Was passiert, wenn ich die Frist verpasse?", a: "Die IRS kann eine Strafe von 25.000 US-Dollar je Formular und Jahr festsetzen, bei fortdauerndem Versäumnis nach einer Aufforderung zusätzliche Beträge. Deshalb steht die Frist im Pflichtenkalender, und die erste Meldung erstellt unser US-CPA." },
      { f: "Wer erstellt die jährliche US-Meldung?", a: `Im ersten Jahr unser US-CPA — das Honorar ist im Preis enthalten. Ab dem zweiten Jahr übernimmt das die Jahresbetreuung für ${P.jahres} im Jahr, alle Gebühren inklusive.` },
      { f: "Muss ich die US-Gesellschaft dem Finanzamt melden?", a: "In Deutschland ja, nach § 138 AO zusammen mit der Steuererklärung. In Österreich und der Schweiz gelten eigene Regeln; unser Partner-Steuerberater nennt sie Ihnen vor der Gründung." },
      { f: "Was kostet die US-Gesellschaft ab dem zweiten Jahr?", a: `Staatsgebühr, Registered Agent und die jährliche US-Meldung. Mit der Jahresbetreuung übernehmen wir all das für ${P.jahres} im Jahr, alle Gebühren inklusive; die Einzelbeträge je Bundesstaat stehen auf der Seite „Kosten“.` },
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
      beschreibung: "Ab einem Kapitalrahmen von 1 Mio. US-Dollar begleiten wir Sie persönlich in Miami: Termine bei Behörden und Instituten mit unserem Team vor Ort.",
    },
    stand: S,
    kennung: "FG · 06",
    auge: "Leistung · Miami",
    h1: "Persönlich in Miami.",
    h1b: "Ab 1 Mio. US-Dollar Kapitalrahmen.",
    lead: `Bis ${SELBST_MAX} läuft alles aus der Ferne. Ab 1 Mio. US-Dollar begleiten wir Sie persönlich in Miami — mit Terminen bei Behörden und Instituten an der Seite unseres Teams und der Geschäftsführung. Den Termin stimmen wir mit Ihnen ab.`,
    ziffern: [
      { wert: "ab 1 Mio. US-$", label: "Kapitalrahmen — über die Finanzierung entscheidet das Institut" },
      { wert: "persönlich", label: "Ihr Termin mit der Geschäftsführung" },
      { wert: "Miami", label: "mit der Schwarzott Group vor Ort" },
    ],
    blick: [
      ["Für wen", "Kapitalrahmen ab 1 Mio. US-Dollar"],
      ["Vor Ort", "Termine bei Behörden und Instituten gemeinsam mit unserem Team"],
      ["Begleitung", "Durch die Geschäftsführung von FIAON"],
      ["Ihr Weg dorthin", "Anfrage im Konfigurator — wir melden uns und stimmen den Termin ab"],
      ["Darunter", `Bis ${SELBST_MAX}: alles aus der Ferne, online unterschrieben`],
      ["Ihr Angebot", "Erhalten Sie persönlich, nach unserem Gespräch"],
    ],
    kurz: "Ab einem Kapitalrahmen von 1 Mio. US-Dollar begleitet FIAON Global persönlich in Miami: Termine bei Behörden und Instituten gemeinsam mit unserem Team vor Ort und der Geschäftsführung. Darunter läuft alles aus der Ferne, und Sie schließen online ab. Ihre Anfrage stellen Sie im Konfigurator; wir melden uns und stimmen den Termin mit Ihnen ab. Über die Finanzierung entscheidet das finanzierende Institut.",
    bloecke: [
      {
        typ: "text", id: "warum", h2: "Warum vor Ort",
        absaetze: [
          "Die meisten Gründungen brauchen keine Reise. Wer aber einen großen Kapitalrahmen aufbaut, mehrere Institute anspricht oder schlicht selbst sehen will, mit wem er arbeitet, gewinnt mit einem Termin vor Ort: Gespräche werden kürzer, Rückfragen verschwinden, und Sie lernen die Menschen kennen, die Ihre Gesellschaft in den USA begleiten.",
          "Miami ist dafür kein Zufall: Hier sitzt unser Team vor Ort, die Schwarzott Group, und von hier aus werden Termine bei Behörden und Instituten wahrgenommen.",
        ],
      },
      {
        typ: "etappen", id: "auftakt", h2: "Der Weg nach Miami in vier Schritten",
        etappen: [
          { titel: "Anfrage im Konfigurator", text: "Sie stellen den Regler auf 1 Mio. US-Dollar und senden Ihre Anfrage. Wir melden uns bei Ihnen." },
          { titel: "Gespräch und Angebot", text: "Wir besprechen Ihr Vorhaben und stimmen den Termin ab. Ihr Angebot erhalten Sie persönlich." },
          { titel: "Termine vor Ort", text: "Behörden- und Institutstermine gemeinsam mit unserem Team, dazu eine Arbeitssitzung mit der Geschäftsführung." },
          { titel: "Weiter aus der Ferne", text: "Nach dem Termin läuft alles Weitere wie bei jedem Auftrag: Sie steuern jeden Schritt in „Mein Auftrag“." },
        ],
      },
      {
        typ: "hinweis", id: "reise", h2: "Die Reise — klar geregelt",
        punkte: [
          "Termin, Reise und Ablauf vor Ort stimmen wir vorab mit Ihnen ab.",
          "FIAON ist kein Reiseveranstalter und verkauft keine Reise.",
          "Über Konto, Karte, Rahmen und Finanzierung entscheidet auch nach einem Termin vor Ort allein das jeweilige Institut.",
        ],
      },
      { typ: "paket", id: "mandat", h2: P.karteH2, lead: P.karteLead, paket: "global_vip" },
      { typ: "standorte", id: "standorte", h2: "Ihr Team in Miami", lead: "Vertragspartner ist die FIAON LTD in London; vor Ort arbeitet die Schwarzott Group." },
    ],
    fragen: [
      { f: "Ab wann treffen wir uns persönlich?", a: "Ab einem Kapitalrahmen von 1 Mio. US-Dollar. Darunter läuft alles aus der Ferne, und Sie schließen online ab." },
      { f: "Ist das eine Pauschalreise?", a: "Nein. FIAON ist kein Reiseveranstalter und verkauft keine Reisen. Termin, Reise und Ablauf vor Ort stimmen wir vorab mit Ihnen ab." },
      { f: "Wann findet der Termin statt?", a: "Nach unserem Gespräch — wir stimmen ihn mit Ihnen ab." },
      { f: "Was bedeutet der Kapitalrahmen?", a: `Er ist der Rahmen, den Sie für Ihre Gesellschaft wählen — Ihr Ziel, keine Zusage. Über die Finanzierung entscheidet das finanzierende Institut. ${GLOBAL_KAPITAL_FREI.de.satz} ${GLOBAL_KAPITAL_FREI.de.steuer}` },
      { f: "Brauche ich für die Gründung überhaupt eine Reise?", a: `Nein. Bis ${SELBST_MAX} Kapitalrahmen läuft jeder Auftrag vollständig aus der Ferne.` },
    ],
    paket: "global_vip",
    weiter: ["/business/firmenkarten-kapital", "/business/partner", "/business/florida", "/business/kosten"],
  },
];
