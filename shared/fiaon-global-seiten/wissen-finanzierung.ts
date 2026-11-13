// ═══════════════════════════════════════════════════════════════════════════
// FIAON GLOBAL — WISSEN: US-ADRESSE UND TELEFON, IMMOBILIEN, FINANZIERUNGSWEGE
// (20.10.2026, E-416)
//
// Drei Beiträge aus Justins eigenem US-Durchlauf (12_USA_Funding_Justin) und der
// Recherche vom 19./20.10.2026 (05_Vision/US_KREDIT_WISSEN_2026-10.md):
//   · was Banken an Anschrift und Telefonnummer prüfen (CMRA, Wohnung/Gewerbe,
//     Mobilfunkdaten) — die häufigste stille Ursache für Sperren und Ablehnungen,
//   · wie Ausländer eine US-Immobilie finanzieren (Mietdeckung, Eigenkapital,
//     Reserven, Herkunft der Mittel, Abschluss aus der Ferne, FIRPTA),
//   · welche Finanzierungswege einer US-Gesellschaft offenstehen, nach Grundlage
//     und Zeitrahmen.
// Wortwand wie in wissen-konto-karten.ts: kein Bankname, kein „bis zu“, keine
// Empfehlung, keine Zusage; über jeden Kredit entscheidet das Institut, FIAON
// vermittelt keine Kredite. Marktzahlen nur mit Quelle und Stand. Die Sicherheit
// einer Muttergesellschaft heißt in dieser Datei „Haftung der Muttergesellschaft“.
//
// E-510 (13.11.2026, Sprachleitfaden FIAON Global, Baustein „Wissens-Artikel“ 7.4):
// je Seite EIN Abschnitt „Was FIAON Global dabei übernimmt“ mit „Sie selbst“ und
// „wer entscheidet“; die festen Sätze (Schritt 5 „Finanzierung“, S1, S7, S9) kommen
// wortgleich aus shared/fiaon-global-saetze.ts. Nie hier: ein Konto, das WIR eröffnen
// (den Antrag stellt der Klient, es entscheidet das Institut), ein Name für die Abfolge
// der Kartenanträge, eine Zusage, Tempo als Argument. Der Satz zur Erstattung (S7)
// steht nur auf der Seite „Finanzierungswege“ — er gilt für die Finanzierung im
// gewählten Kapitalrahmen, nicht für Objektkredite, Konto oder Karten.
// Zweite Runde am selben Tag: jedes Textfeld im Ton des Leitfadens neu gefasst
// (Aussage, Bedingung, Entscheider; Sachtitel; FIAON nur im einen Abschnitt).
// ═══════════════════════════════════════════════════════════════════════════
import { GLOBAL_KAPITAL_FREI, GLOBAL_PFLICHTHINWEIS } from "../fiaon-global";
import { SCHRITTE_KOPF, SECHS_SCHRITTE, satz } from "../fiaon-global-saetze";
import { EIN_PRODUKT } from "./ein-produkt";
import { QUELLEN_WISSEN as Q } from "./fakten";
import type { GlobalQuelle, GlobalSeite } from "./typen";

/** Tag der Erstveröffentlichung (E-416). */
const ERSCHIENEN = "2026-10-20";
/** Tag der letzten inhaltlichen Änderung (E-510, Sprachleitfaden). */
const S = "2026-11-13";
const P = EIN_PRODUKT.de;
/** Schritt 5 der festen Erzählung (Leitfaden 2.2, Fassung „heute“) — wortgleich aus der einen Quelle. */
const FINANZIERUNG = SECHS_SCHRITTE.de.find((x) => x.nr === 5)!;
/** Die Namen der festen Teile eines Schritts: „Ihr Teil“, „Bedingung“ (Leitfaden 2.1). */
const TEIL = SCHRITTE_KOPF.de.teile;
/** Überschrift des einen Abschnitts über uns (Leitfaden 7.4). */
const FIAON_H2 = "Was FIAON Global dabei übernimmt";
/** Der Entscheider-Satz aus S2: „Über Konto, Karte und Rahmen entscheidet das jeweilige Institut.“ */
const INSTITUT = satz("S2").split(/(?<=\.)\s+/)[1];
/** Die ersten zwei Sätze der Rolle (S8): keine Bank, keine Kanzlei; vergibt und vermittelt keine Kredite. */
const ROLLE = satz("S8").split(/(?<=\.)\s+/).slice(0, 2).join(" ");
const KAPITAL_FREI = `${GLOBAL_KAPITAL_FREI.de.satz} ${GLOBAL_KAPITAL_FREI.de.steuer}`;

/ Quellen dieser drei Beiträge (Stand 20.10.2026). */
export const QUELLEN_FINANZIERUNG: Record<string, GlobalQuelle> = {
  ps1583: { titel: "USPS — PS Form 1583, Application for Delivery of Mail Through Agent", url: "https://about.usps.com/forms/ps1583.pdf" },
  dmm508: { titel: "USPS — Domestic Mail Manual 508, Commercial Mail Receiving Agencies", url: "https://pe.usps.com/text/dmm300/508.htm" },
  logingovTelefon: { titel: "Login.gov — Verifying your identity with a phone number", url: "https://login.gov/help/verify-your-identity/phone-number" },
  usc1014: { titel: "18 U.S. Code § 1014 — False statements in loan and credit applications", url: "https://www.law.cornell.edu/uscode/text/18/1014" },
  experianItin: { titel: "Experian — Annual credit report assistance (Anfrage per Post)", url: "https://www.experian.com/assistance/annual-credit-report.html" },
  firpta: { titel: "IRS — FIRPTA Withholding", url: "https://www.irs.gov/individuals/international-taxpayers/firpta-withholding" },
  dscrHandbuch: { titel: "Marktübersicht Foreign-National-Finanzierung 2026 (Handbuch eines Vermittlers)", url: "https://www.americamortgages.com/2026-foreign-national-mortgage-handbook/" },
  dscrProgramm: { titel: "Programmbeschreibung Foreign National DSCR (Kreditgeber, 2026)", url: "https://admortgage.com/programs/foreign-nationals/" },
  dscrZinsen: { titel: "DSCR-Zinsen für ausländische Investoren (Marktbeobachtung, August 2026)", url: "https://homeabroadinc.com/mortgages/dscr-loan-interest-rates/" },
  sbaKredite: { titel: "U.S. Small Business Administration — Loans", url: "https://www.sba.gov/funding-programs/loans" },
  // 27.10.2026 (E-439): Seit 01.03.2026 nur noch 100 % US-Eigentümer mit US-Hauptwohnsitz (vorher hieß es hier „in der Regel nicht").
  sbaRegel2026: { titel: "U.S. GAO, B-338157 — SBA: Staatsbürgerschaft und Wohnsitz bei 7(a)- und 504-Krediten (Notices 5000-876441, 5000-876626)", url: "https://www.gao.gov/products/b-338157" },
};
const QF = QUELLEN_FINANZIERUNG;

export const WISSEN_FINANZIERUNG: GlobalSeite[] = [
  // ─────────────────────────────────────────────────────────────────────────
  // 17 · US-ADRESSE UND TELEFONNUMMER — was Banken prüfen
  {
    pfad: "/business/wissen/us-adresse-und-telefon",
    art: "wissen",
    seo: {
      titel: "US-Adresse und Telefon für die Bank — FIAON Global",
      beschreibung: "Wie US-Institute Anschrift und Telefonnummer prüfen: Wohnadresse, Postadresse, Postannahmestelle (CMRA), Mobilfunkdaten. Mit Quellen und Stand.",
    },
    stand: S,
    erschienen: ERSCHIENEN,
    kennung: "FG · 40",
    auge: "Wissen · US-Präsenz",
    h1: "US-Adresse und Telefon.",
    h1b: "Das Institut prüft beides.",
    lead: "US-Institute gleichen US-Adresse und Telefonnummer eines Antragstellers mit Postdaten und Mobilfunkdaten ab. Häufige Ursachen für Ablehnungen und Sperren sind eine Postannahmestelle als Anschrift, eine Telefonnummer, die nicht auf den Antragsteller lautet, und wechselnde Angaben. Dieser Beitrag erklärt, was Institute prüfen und in welcher Reihenfolge Sie vorgehen.",
    ziffern: [
      { wert: "3 Arten", label: "Wohnadresse, Postadresse, Agent-Adresse" },
      { wert: "1 Anschrift", label: "in jedem Antrag dieselbe" },
    ],
    blick: [
      ["Wohnadresse", "Ihr tatsächlicher Wohnort; persönliche Kartenanträge fragen danach"],
      ["Postadresse", "Der Ort, an dem Ihre Post ankommt; als Postadresse benannt"],
      ["Agent-Adresse", "Gehört der Gesellschaft und steht im Register des Bundesstaats"],
      ["Postannahmestelle", "In den Postdaten als CMRA markiert; braucht PS Form 1583"],
      ["Telefon", "Mobilfunknummer mit Vertrag, auf Ihren Namen"],
      ["Wer entscheidet", "Das jeweilige Institut, über jeden Antrag"],
      ["Mit FIAON Global", "Wir prüfen die US-Anschrift vor dem ersten Antrag"],
    ],
    kurz: "US-Institute gleichen US-Adresse und Telefonnummer mit Postdaten und Mobilfunkdaten ab. Eine Postannahmestelle (CMRA) ist in den Postdaten markiert, eine Gewerbeadresse als Gewerbe. Geeignet ist eine Mobilfunknummer mit Vertrag auf Ihren Namen, mit derselben Anschrift wie beim Institut. Eine Anschrift, die in jedem Antrag gleich bleibt, vermeidet eine häufige Ursache für Sperren. Über jeden Antrag entscheidet das Institut.",
    bloecke: [
      {
        typ: "text", id: "arten", h2: "Drei Arten von Anschrift",
        absaetze: [
          "Die Wohnadresse ist der Ort, an dem Sie tatsächlich wohnen. Persönliche Kartenanträge fragen fast immer nach ihr. Wer in Europa wohnt, gibt dort wahrheitsgemäß seine europäische Wohnadresse an.",
          "Die Postadresse (Mailing Address) ist der Ort, an dem Ihre Post ankommt. Viele Institute erlauben eine abweichende Postadresse, wenn Sie sie als Postadresse benennen. Die Adresse des Registered Agent gehört der Gesellschaft. Der Registered Agent nimmt im Bundesstaat die amtliche Post der Gesellschaft an; seine Adresse steht im Register. Eine Anschrift Ihrer Person ist sie nicht.",
          "Ein Dienst, der gewerblich Post für andere annimmt, ist nach den Regeln der US-Post eine Postannahmestelle (Commercial Mail Receiving Agency, CMRA). Er braucht von jedem Kunden das notariell beglaubigte Formular PS Form 1583.",
        ],
      },
      {
        typ: "tabelle", id: "pruefung", h2: "Was Institute an einer Anschrift sehen",
        lead: "Banken und Kartenherausgeber prüfen Anschriften mit Adressdaten, die auf der Datenbank der US-Post aufbauen. Drei Merkmale bestimmen die Einordnung.",
        kopf: ["Merkmal", "Was es heißt", "Folge im Antrag"],
        zeilen: [
          ["CMRA", "die Anschrift ist eine gewerbliche Postannahmestelle", "gilt als Postfach-Anschrift; Institute lehnen sie oft ab oder prüfen sie gesondert"],
          ["Wohnung oder Gewerbe", "die Post stellt dort an Haushalte oder an Firmen zu", "eine Gewerbeadresse gilt nicht als Wohnadresse"],
          ["Zustellbarkeit", "die Anschrift existiert genau so, mit Hausnummer und Einheit", "eine unvollständige Anschrift lässt sich keiner Akte zuordnen"],
        ],
        fuss: ["Viele virtuelle Büros und Postfachdienste sind in den Postdaten als CMRA markiert, auch wenn die Anschrift eine Suite-Nummer enthält."],
      },
      {
        typ: "text", id: "telefon", h2: "Die Telefonnummer in den Mobilfunkdaten",
        absaetze: [
          "Zur Identitätsprüfung gleichen viele Institute Ihre Telefonnummer mit den Daten des Mobilfunkanbieters ab. Diese Daten zeigen Name und Anschrift des Inhabers, das Alter der Nummer und die Art des Anschlusses. Die Art ist ein Vertrag, eine Prepaid-Karte oder eine Internetnummer.",
          "Internetnummern (VoIP) lehnen Institute häufig ab. Prepaid-Nummern lassen sich oft keinem Namen zuordnen. Verlässlich ist eine Mobilfunknummer mit Vertrag auf Ihren Namen, mit derselben Anschrift wie beim Institut. Je länger Sie die Nummer behalten, desto mehr zählt sie als Merkmal.",
        ],
      },
      {
        typ: "etappen", id: "reihenfolge", h2: "Die Reihenfolge in fünf Schritten",
        etappen: [
          { titel: "Anschrift wählen und prüfen", text: "Vor dem ersten Antrag klären Sie drei Merkmale: Wohnung oder Gewerbe, CMRA oder nicht, vollständig zustellbar." },
          { titel: "Telefonnummer anlegen", text: "Sie schließen einen Mobilfunkvertrag auf Ihren Namen. Beim Mobilfunkanbieter hinterlegen Sie die gewählte Anschrift." },
          { titel: "Überall gleich schreiben", text: "Ihr Name steht wie im Reisepass. Die Anschrift ist in jedem Antrag Zeichen für Zeichen dieselbe." },
          { titel: "Anschrift beibehalten", text: "Jeder Wechsel verteilt Ihre Akte auf mehrere Anschriften. Mit einer Anschrift über Jahre bleibt die Akte vollständig." },
          { titel: "Post empfangen und lesen", text: "Kartenbriefe, Auskünfte und Behördenpost kommen per Post. Ein Dienst, der Sendungen scannt und weiterleitet, macht sie in Europa lesbar." },
        ],
      },
      {
        typ: "karten", id: "irrwege", h2: "Drei Fehler bei Anschrift und Belegen", spalten: 3,
        karten: [
          { tag: "Fehler", titel: "Wechselnde Anschriften", text: "Vier Anschriften in zwei Jahren teilen die Akte auf. Die Auskunftei ordnet Zahlungen dann nicht sicher zu." },
          { tag: "Fehler", titel: "Nachbearbeitete Belege", text: "Eine Rechnung, die vom Original abweicht, ist für jedes Institut ein Ablehnungsgrund. Ihre Vorlage kann strafbar sein. Es zählen nur Originale." },
          { tag: "Fehler", titel: "Falscher Wohnsitz", text: "Wer eine Postadresse als Wohnung angibt, macht im US-Kreditantrag eine Falschangabe. Als Postadresse benannt, ist dieselbe Anschrift keine Falschangabe." },
        ],
      },
      {
        typ: "text", id: "fiaon", h2: FIAON_H2,
        absaetze: [
          "Vor jedem Antrag prüfen wir die US-Anschrift in den Postdaten auf drei Merkmale: CMRA, Wohnung oder Gewerbe, Zustellbarkeit. Name, Anschrift und Telefonnummer halten wir in Ihrer Akte fest, damit sie in jedem Antrag übereinstimmen. Registered Agent, US-Geschäftsadresse und US-Telefonnummer Ihrer Gesellschaft sind im ersten Jahr Ihres Mandats enthalten.",
        ],
        punkte: [
          `${TEIL.ihrTeil}: Sie wählen die Anschrift und stellen jeden Antrag selbst.`,
          `${TEIL.bedingung}: Ob eine Anschrift angenommen wird, entscheidet das jeweilige Institut.`,
        ],
      },
      { typ: "paket", id: "mandat", h2: "Die US-Präsenz in Ihrem Mandat", lead: P.karteLead, paket: "global_banking" },
      {
        typ: "hinweis", id: "wissen", h2: "Was Sie wissen müssen",
        punkte: [
          "Ihre Wohnadresse geben Sie in jedem Antrag wahrheitsgemäß an. Eine Postadresse benennen Sie als solche.",
          "Die Adresse des Registered Agent ist für die amtliche Post der Gesellschaft bestimmt. Eine Anschrift Ihrer Person ist sie nicht.",
          GLOBAL_PFLICHTHINWEIS.de[2],
        ],
      },
    ],
    fragen: [
      { f: "Kann ich die Adresse meines Registered Agent bei der Bank angeben?", a: "Die Adresse des Registered Agent steht für die Gesellschaft im Register. Eine Anschrift Ihrer Person ist sie nicht. Viele Institute lehnen sie für Konto- und Kartenanträge ab." },
      { f: "Was ist eine CMRA?", a: "Eine CMRA (Commercial Mail Receiving Agency) ist ein Dienst, der gewerblich Post für andere annimmt. Er braucht von jedem Kunden das Formular PS Form 1583. In den Postdaten ist er als CMRA markiert." },
      { f: "Warum wird meine US-Telefonnummer nicht akzeptiert?", a: "Häufige Gründe sind eine Internetnummer (VoIP), eine Prepaid-Nummer ohne Namen oder eine Anschrift, die von Ihren Angaben beim Institut abweicht. Eine Mobilfunknummer mit Vertrag auf Ihren Namen behebt das meist. Es entscheidet das Institut." },
      { f: "Darf ich eine US-Postadresse angeben, obwohl ich in Europa wohne?", a: "Viele Institute erlauben das, wenn Sie sie als Postadresse benennen und Ihre Wohnadresse wahrheitsgemäß angeben. Wer eine Postadresse als Wohnung angibt, macht eine Falschangabe." },
    ],
    paket: "global_banking",
    weiter: ["/business/wissen/registered-agent-adresse", "/business/wissen/us-bankkonto-unterlagen", "/business/wissen/us-bonitaet-aufbauen", "/business/wissen/us-firmenkarte-beantragen"],
    quellen: [QF.ps1583, QF.dmm508, QF.logingovTelefon, Q.cip, QF.usc1014],
  },

  // ─────────────────────────────────────────────────────────────────────────
  // 18 · US-IMMOBILIE FINANZIEREN — als Ausländer, aus der Ferne
  {
    pfad: "/business/wissen/us-immobilie-finanzieren",
    art: "wissen",
    seo: {
      titel: "US-Immobilie finanzieren als Ausländer — FIAON Global",
      beschreibung: "Wie Ausländer eine US-Immobilie finanzieren: Mietdeckung, Eigenkapital, Reserven, Herkunft der Mittel, Abschluss per Vollmacht, FIRPTA. Mit Quellen.",
    },
    stand: S,
    erschienen: ERSCHIENEN,
    kennung: "FG · 41",
    auge: "Wissen · Immobilien in den USA",
    h1: "Eine US-Immobilie finanzieren.",
    h1b: "Die Miete deckt die Rate.",
    lead: "Wer als Ausländer eine US-Immobilie finanzieren will, um sie zu vermieten, nutzt meist eine eigene Art der Objektfinanzierung. Der Kreditgeber prüft dabei vor allem, ob die Miete die Rate deckt, weniger Ihr Einkommen oder eine US-Bonität. Dieser Beitrag erklärt den Aufbau dieser Finanzierung, das übliche Eigenkapital und was vor dem Kauf zu klären ist.",
    ziffern: [
      { wert: "1,0", label: "Mietdeckung: Miete deckt die Rate" },
      { wert: "20 – 35 %", label: "Eigenkapital laut Marktangaben 2026" },
    ],
    blick: [
      ["Was zählt", "Die Mieteinnahme des Objekts (DSCR)"],
      ["Käufer", "In der Regel eine US-LLC; der Inhaber haftet persönlich"],
      ["Eigenkapital", "20 bis 35 Prozent, je nach Bonität und Objekt"],
      ["Reserven", "Mehrere Monatsraten, oft auch auf Konten im Ausland"],
      ["Abschluss", "Häufig per notarieller Vollmacht oder Online-Notar"],
      ["Verkauf", "Der Käufer behält einen Teil für die US-Steuer ein (FIRPTA)"],
      ["Wer entscheidet", "Der Kreditgeber, über Kredit, Höhe und Zins"],
      ["Mit FIAON Global", "Wir gründen die Gesellschaft und stellen ihre Unterlagen zusammen"],
    ],
    kurz: "Ausländer finanzieren eine US-Immobilie zur Vermietung meist über eine Mietdeckungs-Finanzierung (DSCR): Der Kreditgeber prüft, ob die Miete die Rate deckt. Laut Marktangaben 2026 erwartet er rund 20 bis 35 Prozent Eigenkapital aus eigenen, belegten Mitteln und Reserven in Höhe mehrerer Monatsraten. Käufer ist meist eine US-LLC; der Inhaber haftet persönlich. Beim späteren Verkauf behält der Käufer einen Teil des Kaufpreises für die US-Steuer ein. Über den Kredit entscheidet der Kreditgeber.",
    bloecke: [
      {
        typ: "text", id: "dscr", h2: "Mietdeckung statt Einkommen",
        absaetze: [
          "Die übliche Finanzierung für Investoren aus dem Ausland heißt DSCR-Kredit (Debt Service Coverage Ratio). Der Kreditgeber teilt die erwartete Miete durch die monatliche Belastung. Zur Belastung zählen Zins und Tilgung, dazu Steuern und Versicherung. Liegt das Ergebnis bei 1,0 oder darüber, deckt die Miete die Rate.",
          "Einen Einkommensnachweis aus Europa verlangen Kreditgeber dafür meist nicht, eine US-Bonität oft auch nicht. Manche Programme verlangen eine Kreditauskunft aus dem Ausland oder einen Bankbrief. Ein vorhandener US-Score kann die Konditionen verbessern.",
        ],
      },
      {
        typ: "tabelle", id: "eckwerte", h2: "Marktangaben 2026",
        lead: "Die Werte stammen aus Programmbeschreibungen und Marktübersichten von Kreditgebern und Vermittlern, Stand Oktober 2026. Jeder Kreditgeber legt eigene Bedingungen fest.",
        kopf: ["Merkmal", "Übliche Spanne"],
        zeilen: [
          ["Eigenkapital beim Kauf", "20 – 35 % des Kaufpreises"],
          ["Zins", "legt allein der Kreditgeber fest — nach Objekt, Eigenkapital und Mietdeckung"],
          ["Mietdeckung (DSCR)", "meist mindestens 1,0"],
          ["Reserven", "6 – 12 Monatsraten, oft im Ausland zulässig"],
          ["Herkunft der Anzahlung", "eigenes Konto, 60 – 90 Tage vorher, belegt"],
          ["Kreditgröße", "ca. 100.000 US-Dollar – 5 Mio. US-Dollar"],
          ["Dauer", "21 – 45 Tage ab vollständigem Antrag"],
        ],
        fuss: ["Marktangaben, keine Zusage. Über Kredit, Höhe und Zins entscheidet allein der Kreditgeber."],
      },
      {
        typ: "etappen", id: "weg", h2: "Der Ablauf in sechs Schritten",
        etappen: [
          { titel: "Gesellschaft", text: "Eine US-LLC mit EIN, der Steuernummer der Gesellschaft, hält das Objekt. Als Inhaber haften Sie persönlich für den Kredit." },
          { titel: "Eigenkapital belegen", text: "Anzahlung, Nebenkosten und Reserven liegen nachweisbar auf eigenen Konten. Kredite Dritter als Anzahlung lehnen Kreditgeber in der Regel ab." },
          { titel: "Objekt und Mietgutachten", text: "Der Gutachter schätzt Wert und Marktmiete. Daraus ergibt sich die Mietdeckung." },
          { titel: "Entscheidung des Kreditgebers", text: "Der Kreditgeber prüft Unterlagen, Objekt und Herkunft der Mittel. Danach entscheidet er über den Kredit." },
          { titel: "Abschluss", text: "Der Abschluss erfolgt häufig per notarieller Vollmacht oder Online-Notar. Die Zahlung läuft über das Treuhandkonto der Title Company." },
          { titel: "Verwaltung", text: "Eine örtliche Hausverwaltung vermietet und betreut das Objekt. Die Miete geht auf das Konto der Gesellschaft." },
        ],
      },
      {
        typ: "karten", id: "varianten", h2: "Drei Arten der Objektfinanzierung", spalten: 3,
        karten: [
          { tag: "Langfristig", titel: "Mietobjekt halten", text: "Ein DSCR-Kredit mit langer Laufzeit, oft dreißig Jahre. Die Miete deckt die Rate. Das ist die übliche Form für Investoren aus dem Ausland." },
          { tag: "Kurzfristig", titel: "Kauf und Sanierung", text: "Kurzfristige Objektkredite (Hard Money) finanzieren Kauf und Sanierung. Sie kosten deutlich mehr als ein langfristiger Objektkredit; hinzu kommen Gebühren. Sie sind für Vorhaben gedacht, deren Ablösung von Beginn an feststeht." },
          { tag: "Verhandelt", titel: "Verkäuferfinanzierung", text: "Der Verkäufer stundet einen Teil des Kaufpreises. Die Bedingungen handeln die Parteien frei aus. Der Vertrag ist Sache eines US-Anwalts." },
        ],
      },
      {
        typ: "text", id: "eigenkapital", h2: "Herkunft des Eigenkapitals",
        absaetze: [
          "Kreditgeber verlangen den Nachweis, dass Anzahlung und Reserven Ihnen gehören und seit einiger Zeit auf Ihrem Konto liegen. Die Mittel dafür können Sie auch im Wohnsitzland aufbringen, etwa durch die Beleihung einer eigenen Immobilie. Sie setzen sie als eigene Mittel ein, sobald sie auf Ihrem Konto liegen und ihre Herkunft belegt ist. Ob ein Kreditgeber so aufgebrachtes Eigenkapital annimmt, klären Sie vorher schriftlich. Die Herkunft geben Sie im Antrag an.",
          KAPITAL_FREI,
        ],
      },
      {
        typ: "text", id: "fiaon", h2: FIAON_H2,
        absaetze: [
          "Wir gründen die Gesellschaft, die das Objekt hält, und beantragen ihre EIN. Den Kontoantrag bereiten wir vollständig vor und stellen die Unterlagen zusammen, die Kreditgeber verlangen. Steuerfragen zu Struktur, Mieteinnahmen und Verkauf liegen bei Partner-Steuerberatern; sie arbeiten in eigener Verantwortung. Diese Fragen gehören vor den Kauf.",
        ],
        punkte: [
          `${TEIL.ihrTeil}: Konto- und Kreditantrag stellen Sie selbst; den Darlehensvertrag schließt Ihre Gesellschaft im eigenen Namen.`,
          `${TEIL.bedingung}: ${ROLLE} Über die Objektfinanzierung entscheidet der Kreditgeber.`,
        ],
      },
      { typ: "paket", id: "mandat", h2: "Die Gesellschaft für Ihr Objekt", lead: P.karteLead, paket: "global_kapital" },
      {
        typ: "hinweis", id: "wissen", h2: "Was Sie wissen müssen",
        punkte: [
          "Beim Verkauf behält der Käufer nach FIRPTA in der Regel 15 Prozent des Kaufpreises für die US-Steuer ein. Bei selbst genutzten Objekten bis 1 Mio. US-Dollar ist es teils weniger. Zu viel Einbehaltenes fordern Sie mit der US-Steuererklärung zurück.",
          "Hält eine Person das Objekt direkt, kann in den USA Erbschaftsteuer anfallen. Die Struktur ist vor dem Kauf steuerlich zu klären.",
          "Marktzahlen sind keine Zusage. Über Kredit, Höhe und Zins entscheidet allein der Kreditgeber.",
          GLOBAL_PFLICHTHINWEIS.de[0],
        ],
      },
    ],
    fragen: [
      { f: "Brauche ich eine US-Bonität für einen US-Immobilienkredit?", a: "Für eine Mietdeckungs-Finanzierung (DSCR) oft nicht. Der Kreditgeber prüft vor allem, ob die Miete die Rate deckt. Ein US-Score kann die Konditionen verbessern." },
      { f: "Wie viel Eigenkapital brauche ich?", a: "Laut Marktangaben 2026 meist 20 bis 35 Prozent des Kaufpreises, dazu Nebenkosten und Reserven in Höhe mehrerer Monatsraten. Die Höhe legt der Kreditgeber fest." },
      { f: "Kann ich die Anzahlung finanzieren?", a: "Kredite Dritter als Anzahlung lehnen Kreditgeber in der Regel ab. Sie erwarten eigene Mittel, die nachweisbar auf Ihrem Konto liegen. Die Herkunft geben Sie im Antrag an." },
      { f: "Muss ich zum Notartermin in die USA reisen?", a: "Häufig nicht. Viele Abschlüsse laufen über eine notarielle Vollmacht oder einen Online-Notar. Die Zahlung geht auf das Treuhandkonto der Title Company." },
      { f: "Was passiert beim Verkauf?", a: "Der Käufer behält nach FIRPTA einen Teil des Kaufpreises für die US-Steuer ein und führt ihn an die US-Steuerbehörde IRS ab. Die endgültige Steuer ergibt sich aus der US-Steuererklärung." },
    ],
    paket: "global_kapital",
    weiter: ["/business/wissen/finanzierungswege-usa", "/business/wissen/llc-gruenden", "/business/wissen/us-llc-steuern", "/business/wissen/bundesstaat-waehlen"],
    quellen: [QF.dscrHandbuch, QF.dscrProgramm, QF.firpta],
  },

  // ─────────────────────────────────────────────────────────────────────────
  // 19 · FINANZIERUNGSWEGE — was einer US-Gesellschaft offensteht, nach Grundlage und Zeitrahmen
  {
    pfad: "/business/wissen/finanzierungswege-usa",
    art: "wissen",
    seo: {
      titel: "Finanzierungswege einer US-Gesellschaft — FIAON Global",
      beschreibung: "Sechs Finanzierungswege einer US-Gesellschaft, von der Karte bis zur Objektfinanzierung, nach Grundlage und Zeitrahmen. Mit Quellen und Stand.",
    },
    stand: S,
    erschienen: ERSCHIENEN,
    kennung: "FG · 42",
    auge: "Wissen · Finanzierung",
    h1: "Finanzierungswege in den USA.",
    h1b: "Nach Grundlage und Zeitrahmen.",
    lead: "Einer US-Gesellschaft stehen in den USA sechs Finanzierungswege offen. Jeder beruht auf einer anderen Grundlage: auf Ihrer Person, auf dem Guthaben, auf dem Umsatz oder auf einer Sicherheit. Manche Wege kommen nach Tagen in Betracht, andere erst nach Jahren. Dieser Beitrag ordnet sie nach Grundlage und Zeitrahmen, damit Sie die Reihenfolge planen können.",
    ziffern: [
      { wert: "6 Wege", label: "von der Karte bis zur Objektfinanzierung" },
      { wert: "1 Regel", label: "über jeden Kredit entscheidet das Institut" },
    ],
    blick: [
      ["Früh und klein", "Persönliche Karten, Lieferantenkonten"],
      ["Nach Guthaben", "Firmenkarten, deren Rahmen dem Kontostand folgt"],
      ["Nach Umsatz", "Kredite von Zahlungsplattformen"],
      ["Nach Geschäftsjahren", "Kreditlinie der Bank, meist nach zwei Jahren"],
      ["Gegen Sicherheit", "Einlage, Haftung der Muttergesellschaft, Immobilie"],
      ["Wer entscheidet", "Das jeweilige Institut, über jeden Antrag"],
      ["Mit FIAON Global", "Anträge und Unterlagen vollständig vorbereitet"],
    ],
    kurz: "Einer US-Gesellschaft stehen sechs Finanzierungswege offen: persönliche Karten, Lieferantenkonten mit Zahlungsziel, Firmenkarten nach Guthaben, Plattformkredite nach Umsatz, die Kreditlinie der Bank und Finanzierung gegen Sicherheit. Karten und Lieferantenkonten decken laufende Ausgaben. Größere Beträge setzen Umsatz, Geschäftsjahre oder eine Sicherheit voraus, etwa eine Einlage, die Haftung der Muttergesellschaft oder eine Immobilie. Über jeden Kredit entscheidet das Institut.",
    bloecke: [
      {
        typ: "tabelle", id: "uebersicht", h2: "Die sechs Wege im Überblick",
        kopf: ["Weg", "Grundlage", "Üblicher Zeitrahmen", "Größenordnung"],
        zeilen: [
          ["Persönliche Karten", "Ihre persönliche Akte unter der Steuernummer ITIN oder der Sozialversicherungsnummer SSN", "Tage nach der Entscheidung des Herausgebers", "klein; steigt mit der Zahlungshistorie"],
          ["Lieferantenkonten (Net 30)", "Firmenakte, D-U-N-S-Nummer", "Wochen", "klein bis mittel"],
          ["Firmenkarten nach Guthaben", "Kontostand der Gesellschaft", "Tage", "folgt dem Guthaben"],
          ["Plattformkredite nach Umsatz", "Umsatz über eine Zahlungsplattform", "Tage", "folgt dem Umsatz"],
          ["Kreditlinie der Bank", "Geschäftsjahre, Umsatz oder Sicherheit", "Wochen", "mittel bis groß"],
          ["Finanzierung gegen Sicherheit", "Einlage, Haftung der Muttergesellschaft, Immobilie", "Wochen", "groß"],
        ],
        fuss: ["Übersicht nach Marktbeobachtung, Stand Oktober 2026. Bedingungen, Höhe und Zins legt jedes Institut selbst fest."],
      },
      {
        typ: "etappen", id: "reihenfolge", h2: "Die Reihenfolge in sechs Schritten",
        etappen: [
          { titel: "Gesellschaft und Konto", text: "Am Anfang stehen die LLC, ihre Steuernummer (EIN) und das Geschäftskonto. Firmenkarten und Zahlungsplattformen setzen ein Konto voraus." },
          { titel: "Stammdaten und D-U-N-S", text: "Name, Anschrift und Telefonnummer sind in jeder Unterlage gleich. Die Wirtschaftsauskunftei vergibt der Gesellschaft ihre Kennziffer, die D-U-N-S-Nummer." },
          { titel: "Lieferantenkonten", text: "Die Gesellschaft nutzt erste Konten mit Zahlungsziel und zahlt vor Fälligkeit. Aus diesen Zahlungen entsteht ihre Firmenbonität." },
          { titel: "Firmenkarten", text: "Zuerst kommen Firmenkarten in Betracht, deren Rahmen dem Guthaben folgt. Später folgen Karten mit persönlicher Haftung des Inhabers. Über jede Karte entscheidet der Herausgeber." },
          { titel: "Umsatz nachweisen", text: "US-Umsatz ist die Voraussetzung für Plattformkredite. Er ist auch die Grundlage jeder Entscheidung einer Bank." },
          { titel: "Bank und Sicherheiten", text: "Für große Beträge kommen drei Wege in Betracht: die Kreditlinie der Bank, die Haftung der Muttergesellschaft und die Objektfinanzierung." },
        ],
      },
      {
        typ: "text", id: "grenzen", h2: "Grenzen der Finanzierungswege",
        absaetze: [
          "Staatlich gestützte Kleinunternehmerkredite der US-Behörde SBA (Programme 7(a) und 504) stehen seit dem 1. März 2026 nur noch bestimmten Gesellschaften offen. Alle Eigentümer müssen US-Staatsbürger oder US-Staatsangehörige mit Hauptwohnsitz in den USA sein. Auch Inhaber einer Green Card sind ausgeschlossen. Manche Online-Kreditgeber vergeben Kredite nur an Inhaber mit Wohnsitz in den USA.",
          "Viele Kartenanträge in kurzer Zeit sind kein belegter Weg zu großen Beträgen. Die US-Handelsaufsicht FTC hat gegen einen Anbieter geklagt, der Unternehmern Finanzierungen in Aussicht stellte und stattdessen Kreditkarten beantragte. Diesem Anbieter ist das Finanzierungsgeschäft seit 2025 dauerhaft untersagt.",
        ],
      },
      {
        typ: "text", id: "kapital", h2: "Verwendung der Mittel",
        absaetze: [
          KAPITAL_FREI,
          "Kurzfristige Mittel mit hohen Kosten sind nur wirtschaftlich, wenn der Ertrag nachweisbar über den Kosten liegt. Für langfristige Wege zählen geordnete Zahlen der Gesellschaft. Die Bedingungen legt jedes Institut selbst fest.",
        ],
      },
      {
        typ: "text", id: "fiaon", h2: FIAON_H2,
        absaetze: [
          "Wir gründen Ihre Gesellschaft, halten ihre Stammdaten einheitlich und stellen ihre Unterlagen vollständig zusammen. Konto- und Kartenanträge bereiten wir vollständig vor; Sie stellen sie selbst.",
          `${FINANZIERUNG.satz} ${satz("S9")}`,
        ],
        punkte: [
          `${TEIL.bedingung}: ${INSTITUT} ${ROLLE}`,
          P.geldZurueck,
        ],
      },
      { typ: "paket", id: "mandat", h2: P.karteH2, lead: P.karteLead, paket: "global_kapital" },
      {
        typ: "hinweis", id: "wissen", h2: "Was Sie wissen müssen",
        punkte: [
          GLOBAL_PFLICHTHINWEIS.de[2],
          "Einen bestimmten Rahmen oder Zins kann kein Anbieter zusagen.",
          GLOBAL_PFLICHTHINWEIS.de[1],
        ],
      },
    ],
    fragen: [
      { f: "Welche Finanzierung steht einer neuen US-Gesellschaft zuerst offen?", a: "Zuerst kommen Firmenkarten in Betracht, deren Rahmen dem Guthaben folgt, und Lieferantenkonten mit Zahlungsziel. Kreditlinien der Bank setzen meist Geschäftsjahre, Umsatz oder eine Sicherheit voraus. Über jeden Antrag entscheidet das Institut." },
      { f: "Bekommt eine LLC aus Europa einen SBA-Kredit?", a: "Nein. Seit dem 1. März 2026 müssen alle direkten und indirekten Eigentümer US-Staatsbürger oder US-Staatsangehörige mit Hauptwohnsitz in den USA sein (SBA Procedural Notice 5000-876626). Auch eine Green Card genügt nicht." },
      { f: "Kann eine Muttergesellschaft in Europa für den Kredit der US-Gesellschaft haften?", a: "Ja, das ist ein üblicher Weg zu einer Kreditlinie der Bank. Die Bank prüft dann vor allem die Bilanz der Muttergesellschaft und entscheidet über den Antrag." },
      { f: "Beschafft FIAON den Kredit für meine US-Gesellschaft?", a: `Nein. ${ROLLE} Wir bereiten die Anträge vollständig vor und begleiten Ihre Gesellschaft bis zur Entscheidung. Den Antrag stellt Ihre Gesellschaft; es entscheidet das finanzierende Institut.` },
    ],
    paket: "global_kapital",
    weiter: ["/business/wissen/business-credit-usa", "/business/wissen/us-firmenkarte-beantragen", "/business/wissen/us-funding", "/business/firmenkarten-kapital"],
    quellen: [Q.duns, Q.paydex, QF.sbaKredite, QF.sbaRegel2026, Q.ftcSeek],
  },
];
