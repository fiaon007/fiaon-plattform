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
//   · welche Finanzierungswege einer US-Gesellschaft offenstehen, nach Tempo.
// Wortwand wie in wissen-konto-karten.ts: kein Bankname, kein „bis zu“, keine
// Empfehlung, keine Zusage; über jeden Kredit entscheidet das Institut, FIAON
// vermittelt keine Kredite. Marktzahlen nur mit Quelle und Stand.
//
// E-510 (13.11.2026, Sprachleitfaden FIAON Global, Baustein „Wissens-Artikel“ 7.4):
// je Seite EIN Abschnitt „Was FIAON Global dabei übernimmt“ mit „Sie selbst“ und
// „wer entscheidet“; die festen Sätze (Schritt 5 „Finanzierung“, S1, S7, S9) kommen
// wortgleich aus shared/fiaon-global-saetze.ts. Nie hier: ein Konto, das WIR eröffnen
// (den Antrag stellt der Klient, es entscheidet das Institut), ein Name für die Abfolge
// der Kartenanträge, eine Zusage, Tempo als Argument. Der Satz zur Erstattung (S7)
// steht nur auf der Seite „Finanzierungswege“ — er gilt für die Finanzierung im
// gewählten Kapitalrahmen, nicht für Objektkredite, Konto oder Karten.
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
      beschreibung: "Wohnadresse, Postadresse, Postannahmestelle: wie US-Banken Anschrift und Telefonnummer prüfen und warum beides überall gleich sein muss.",
    },
    stand: S,
    erschienen: ERSCHIENEN,
    kennung: "FG · 40",
    auge: "Wissen · US-Präsenz",
    h1: "Anschrift und Telefon.",
    h1b: "Die Bank prüft beides.",
    lead: "Viele Sperren und Ablehnungen in den USA haben einen stillen Grund: Die Anschrift ist eine Postannahmestelle, die Telefonnummer läuft nicht auf den Antragsteller, oder die Angaben wechseln von Antrag zu Antrag. Hier steht, was Institute an Anschrift und Telefonnummer prüfen und wie beides von Anfang an stimmt.",
    ziffern: [
      { wert: "3 Arten", label: "Wohnadresse, Postadresse, Agent-Adresse" },
      { wert: "1 Anschrift", label: "in jedem Antrag dieselbe" },
    ],
    blick: [
      ["Wohnadresse", "Wo Sie wohnen — für persönliche Karten erwartet"],
      ["Postadresse", "Wo Ihre Post ankommt — offen als solche angeben"],
      ["Agent-Adresse", "Für die Gesellschaft im Register, nicht für Ihre Person"],
      ["Postannahmestelle", "In den Postdaten als CMRA markiert, braucht PS Form 1583"],
      ["Telefon", "Echte Mobilfunknummer auf Ihren Namen, keine Internetnummer"],
      ["Mit FIAON Global", "Jede Anschrift wird vor dem ersten Antrag geprüft"],
    ],
    kurz: "US-Institute gleichen Anschrift und Telefonnummer mit Postdaten und Mobilfunkdaten ab. Eine Postannahmestelle (CMRA) ist in den Postdaten markiert, Gewerbeadressen erscheinen als Gewerbe, nicht als Wohnung. Die Telefonnummer sollte eine echte Mobilfunknummer auf Ihren Namen sein, mit derselben Anschrift wie bei der Bank. Wer eine Anschrift wählt und dabei bleibt, vermeidet die häufigste stille Ursache für Sperren.",
    bloecke: [
      {
        typ: "text", id: "arten", h2: "Drei Arten von Anschrift",
        absaetze: [
          "Die Wohnadresse ist der Ort, an dem Sie tatsächlich wohnen. Persönliche Kartenanträge fragen fast immer nach ihr. Wer in Deutschland, Österreich oder der Schweiz wohnt, gibt dort wahrheitsgemäß seine europäische Wohnadresse an.",
          "Die Postadresse (Mailing Address) ist der Ort, an dem Ihre Post ankommt. Viele Institute erlauben eine abweichende Postadresse, wenn sie offen als solche benannt ist. Die Adresse des Registered Agent schließlich gehört der Gesellschaft: Sie steht im Register des Bundesstaats und nimmt amtliche Post an, sie ist keine Anschrift für Ihre Person.",
          "Nimmt ein Dienst gewerblich Post für andere an, ist er nach den Regeln der US-Post eine Postannahmestelle (Commercial Mail Receiving Agency, CMRA). Er braucht dafür von jedem Kunden das notariell beglaubigte Formular PS Form 1583.",
        ],
      },
      {
        typ: "tabelle", id: "pruefung", h2: "Was Institute an einer Anschrift sehen",
        lead: "Banken und Kartenherausgeber prüfen Anschriften mit Adressdaten, die auf der Datenbank der US-Post aufbauen. Drei Merkmale sind dabei entscheidend.",
        kopf: ["Merkmal", "Was es heißt", "Folge im Antrag"],
        zeilen: [
          ["CMRA", "die Anschrift ist eine gewerbliche Postannahmestelle", "gilt als Postfach-Anschrift, oft abgelehnt oder geprüft"],
          ["Wohnung oder Gewerbe", "die Post stellt dort an Haushalte oder an Firmen zu", "eine Gewerbeadresse ist keine Wohnadresse"],
          ["Zustellbarkeit", "die Anschrift existiert genau so, mit Hausnummer und Einheit", "eine unvollständige Anschrift findet keine Akte"],
        ],
        fuss: ["Viele virtuelle Büros und Postfachdienste sind in den Postdaten als CMRA markiert, auch wenn die Anschrift eine Suite-Nummer trägt."],
      },
      {
        typ: "text", id: "telefon", h2: "Die Telefonnummer: richtig registriert",
        absaetze: [
          "Zur Identitätsprüfung gleichen viele Institute Ihre Telefonnummer mit den Daten des Mobilfunkanbieters ab: Läuft die Nummer auf Ihren Namen, stimmt die Anschrift, wie lange gibt es die Nummer schon, ist es ein Vertrag, eine Prepaid-Karte oder eine Internetnummer?",
          "Internetnummern (VoIP) werden häufig abgelehnt, Prepaid-Nummern lassen sich oft keinem Namen zuordnen. Am verlässlichsten ist eine echte Mobilfunknummer mit Vertrag auf Ihren Namen, mit genau derselben Anschrift wie bei der Bank. Je länger Sie die Nummer behalten, desto stärker wird sie als Merkmal.",
        ],
      },
      {
        typ: "etappen", id: "reihenfolge", h2: "In dieser Reihenfolge stimmt es",
        etappen: [
          { titel: "Anschrift wählen und prüfen", text: "Vor dem ersten Antrag klären: Wohnung oder Gewerbe, CMRA oder nicht, vollständig zustellbar." },
          { titel: "Telefonnummer anlegen", text: "Mobilfunkvertrag auf Ihren Namen, im Konto genau die gewählte Anschrift." },
          { titel: "Überall gleich schreiben", text: "Name wie im Reisepass, Anschrift Zeichen für Zeichen identisch in jedem Antrag." },
          { titel: "Dabei bleiben", text: "Jeder Wechsel verteilt Ihre Akte auf mehrere Anschriften. Eine Anschrift über Jahre trägt am besten." },
          { titel: "Post lesbar machen", text: "Kartenbriefe, Auskünfte und Behördenpost kommen per Post. Ein Dienst, der scannt und weiterleitet, hält Sie aus Europa erreichbar." },
        ],
      },
      {
        typ: "karten", id: "irrwege", h2: "Was nicht hilft", spalten: 3,
        karten: [
          { tag: "Irrweg", titel: "Wechselnde Anschriften", text: "Vier Anschriften in zwei Jahren zersplittern die Akte. Die Auskunftei ordnet Zahlungen dann nicht sicher zu." },
          { tag: "Irrweg", titel: "Nachbearbeitete Belege", text: "Eine Rechnung, die vom Original abweicht, ist für jedes Institut ein Ablehnungsgrund und kann strafbar sein. Es zählen nur Originale." },
          { tag: "Irrweg", titel: "Falscher Wohnsitz", text: "Eine Postadresse als Wohnung auszugeben, ist im US-Kreditantrag eine Falschangabe. Offen benannt ist dieselbe Anschrift unproblematisch." },
        ],
      },
      {
        typ: "text", id: "fiaon", h2: FIAON_H2,
        absaetze: [
          "Vor jedem Antrag prüfen wir die US-Anschrift in den Postdaten: CMRA oder nicht, Wohnung oder Gewerbe, vollständig zustellbar. Name, Anschrift und Telefonnummer führen wir in Ihrer Akte, damit sie in jedem Antrag übereinstimmen. Registered Agent, US-Geschäftsadresse und US-Telefonnummer Ihrer Gesellschaft sind im ersten Jahr Ihres Mandats enthalten.",
        ],
        punkte: [
          `${TEIL.ihrTeil}: Die Wahl der Anschrift treffen Sie; die Anträge stellen Sie selbst.`,
          `${TEIL.bedingung}: Ob ein Institut eine Anschrift akzeptiert, entscheidet das Institut.`,
        ],
      },
      { typ: "paket", id: "mandat", h2: "Die US-Präsenz in Ihrem Mandat", lead: P.karteLead, paket: "global_banking" },
      {
        typ: "hinweis", id: "wissen", h2: "Was Sie wissen müssen",
        punkte: [
          "Ob ein Institut eine Anschrift akzeptiert, entscheidet allein das Institut.",
          "Die Adresse des Registered Agent ist für amtliche Post der Gesellschaft bestimmt, nicht als Anschrift Ihrer Person.",
          GLOBAL_PFLICHTHINWEIS.de[2],
        ],
      },
    ],
    fragen: [
      { f: "Kann ich die Adresse meines Registered Agent bei der Bank angeben?", a: "Für die Gesellschaft steht sie im Register. Als Anschrift Ihrer Person ist sie nicht gedacht, und viele Institute lehnen sie für Konto- und Kartenanträge ab." },
      { f: "Was ist eine CMRA?", a: "Eine Commercial Mail Receiving Agency, also ein Dienst, der gewerblich Post für andere annimmt. Er braucht von jedem Kunden das Formular PS Form 1583 und ist in den Postdaten als solcher markiert." },
      { f: "Warum wird meine US-Telefonnummer nicht akzeptiert?", a: "Häufig ist es eine Internetnummer (VoIP), eine Prepaid-Nummer ohne Namen oder eine Nummer, deren Anschrift nicht zu Ihren Bankdaten passt. Eine Mobilfunknummer mit Vertrag auf Ihren Namen löst das meist." },
      { f: "Darf ich eine US-Postadresse angeben, obwohl ich in Europa wohne?", a: "Ja, wenn Sie sie offen als Postadresse angeben und Ihre Wohnadresse wahrheitsgemäß nennen. Eine Postadresse als Wohnung auszugeben, ist eine Falschangabe." },
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
      beschreibung: "Wie Ausländer eine US-Immobilie finanzieren: Mietdeckung statt Einkommen, Eigenkapital, Reserven, Herkunft der Mittel, Abschluss aus der Ferne, FIRPTA.",
    },
    stand: S,
    erschienen: ERSCHIENEN,
    kennung: "FG · 41",
    auge: "Wissen · Immobilien in den USA",
    h1: "Eine US-Immobilie finanzieren.",
    h1b: "Die Miete trägt den Kredit.",
    lead: "Für ausländische Investoren gibt es in den USA eine eigene Art der Objektfinanzierung: Der Kreditgeber prüft vor allem, ob die Miete die Rate deckt, nicht Ihr Einkommen oder eine US-Bonität. Hier steht, wie diese Finanzierung aufgebaut ist, welches Eigenkapital der Markt erwartet und was Sie vor dem Kauf wissen müssen.",
    ziffern: [
      { wert: "1,0", label: "Mietdeckung: Miete deckt die Rate" },
      { wert: "20 – 35 %", label: "Eigenkapital laut Marktangaben 2026" },
      { wert: "21 – 45 Tage", label: "Dauer ab vollständigem Antrag laut Marktangaben 2026" },
    ],
    blick: [
      ["Was zählt", "Die Mieteinnahme des Objekts (DSCR)"],
      ["Wer kauft", "In der Regel eine US-LLC, der Inhaber haftet persönlich"],
      ["Eigenkapital", "20 bis 35 Prozent, je nach Bonität und Objekt"],
      ["Reserven", "Mehrere Monatsraten, oft auch auf Konten im Ausland"],
      ["Abschluss", "Häufig per notarieller Vollmacht oder Online-Notar"],
      ["Verkauf", "Der Käufer behält einen Teil für die US-Steuer ein (FIRPTA)"],
      ["Mit FIAON Global", "Gesellschaft, Unterlagen und Reihenfolge vorbereitet"],
    ],
    kurz: "Ausländer finanzieren US-Mietobjekte meist über eine Mietdeckungs-Finanzierung (DSCR): Der Kreditgeber prüft, ob die Miete die Rate deckt, und verlangt laut Marktangaben 2026 rund 20 bis 35 Prozent Eigenkapital sowie Reserven in Höhe mehrerer Monatsraten. Gekauft wird meist über eine US-LLC, der Inhaber haftet persönlich. Das Eigenkapital muss aus eigenen, belegten Mitteln stammen. Beim späteren Verkauf behält der Käufer einen Teil des Preises für die US-Steuer ein.",
    bloecke: [
      {
        typ: "text", id: "dscr", h2: "Mietdeckung statt Einkommen",
        absaetze: [
          "Die verbreitete Finanzierung für ausländische Investoren heißt DSCR-Kredit (Debt Service Coverage Ratio). Der Kreditgeber teilt die erwartete Miete durch die monatliche Belastung aus Zins, Tilgung, Steuern und Versicherung. Liegt das Ergebnis bei 1,0 oder darüber, deckt die Miete die Rate.",
          "Ein Einkommensnachweis aus Europa ist dafür meist nicht nötig, eine US-Bonität oft auch nicht. Manche Programme verlangen eine ausländische Kreditauskunft oder einen Bankbrief. Ein vorhandener US-Score kann die Konditionen verbessern.",
        ],
      },
      {
        typ: "tabelle", id: "eckwerte", h2: "Das Marktbild 2026",
        lead: "Werte aus Programmbeschreibungen und Marktübersichten von Kreditgebern und Vermittlern, Stand Oktober 2026. Jeder Kreditgeber setzt eigene Bedingungen.",
        kopf: ["Merkmal", "Übliche Spanne"],
        zeilen: [
          ["Eigenkapital beim Kauf", "20 – 35 % des Kaufpreises"],
          ["Zins", "legt allein der Kreditgeber fest — nach Objekt, Eigenkapital und Mietdeckung"],
          ["Mietdeckung (DSCR)", "meist mindestens 1,0"],
          ["Reserven", "6 – 12 Monatsraten, oft im Ausland zulässig"],
          ["Herkunft der Anzahlung", "eigenes Konto, 60 – 90 Tage vorher, belegt"],
          ["Kreditgröße", "ca. 100.000 $ – 5 Mio. $"],
          ["Dauer", "21 – 45 Tage ab vollständigem Antrag"],
        ],
        fuss: ["Marktangaben, keine Zusage. Über Kredit, Höhe und Zins entscheidet allein der Kreditgeber."],
      },
      {
        typ: "etappen", id: "weg", h2: "Der Weg zum Objekt, aus der Ferne",
        etappen: [
          { titel: "Gesellschaft", text: "Eine US-LLC mit EIN hält das Objekt; Sie haften als Inhaber persönlich für den Kredit." },
          { titel: "Eigenkapital belegen", text: "Anzahlung, Nebenkosten und Reserven liegen nachweisbar auf eigenen Konten. Kredite Dritter als Anzahlung lehnen Kreditgeber in der Regel ab." },
          { titel: "Objekt und Mietgutachten", text: "Der Gutachter schätzt Wert und Marktmiete; daraus ergibt sich die Mietdeckung." },
          { titel: "Finanzierungszusage", text: "Der Kreditgeber prüft Unterlagen, Objekt und Herkunft der Mittel." },
          { titel: "Abschluss", text: "Häufig per notarieller Vollmacht oder Online-Notar; das Geld läuft über das Treuhandkonto der Title Company." },
          { titel: "Verwaltung", text: "Eine örtliche Hausverwaltung vermietet und betreut; die Miete fließt auf das Konto der Gesellschaft." },
        ],
      },
      {
        typ: "karten", id: "varianten", h2: "Drei Arten der Objektfinanzierung", spalten: 3,
        karten: [
          { tag: "Langfristig", titel: "Mietobjekt halten", text: "DSCR-Kredit mit langer Laufzeit, oft dreißig Jahre; die Miete trägt die Rate. Der übliche Weg für Investoren aus dem Ausland." },
          { tag: "Kurzfristig", titel: "Kaufen und sanieren", text: "Kurzfristige Objektkredite (Hard Money) für Kauf und Sanierung, deutlich teurer als ein langfristiger Objektkredit und mit Gebühren. Für einen klaren Ausstieg gedacht." },
          { tag: "Verhandelt", titel: "Verkäuferfinanzierung", text: "Der Verkäufer stundet einen Teil des Preises. Bedingungen sind frei verhandelt; der Vertrag gehört in die Hand eines US-Anwalts." },
        ],
      },
      {
        typ: "text", id: "eigenkapital", h2: "Woher das Eigenkapital kommt",
        absaetze: [
          "Kreditgeber wollen sehen, dass Anzahlung und Reserven Ihnen gehören und seit einiger Zeit auf Ihrem Konto liegen. Wer Eigenkapital zu Hause beschafft, etwa durch die Beleihung einer eigenen Immobilie, setzt es als eigene Mittel ein, sobald es auf dem eigenen Konto liegt und die Herkunft belegt ist. Ob ein Kreditgeber so beschafftes Eigenkapital akzeptiert, klären Sie vorher schriftlich und geben es offen an.",
          KAPITAL_FREI,
        ],
      },
      {
        typ: "text", id: "fiaon", h2: FIAON_H2,
        absaetze: [
          "Wir gründen die Gesellschaft, die das Objekt hält, beantragen die EIN, bereiten den Kontoantrag vollständig vor und stellen die Unterlagen zusammen, die Kreditgeber verlangen. Steuerfragen zu Struktur, Mieteinnahmen und Verkauf klären Partner-Steuerberater vor dem Kauf, in eigener Verantwortung.",
        ],
        punkte: [
          `${TEIL.ihrTeil}: Konto- und Kreditantrag stellen Sie selbst; den Darlehensvertrag schließt Ihre Gesellschaft im eigenen Namen.`,
          `${TEIL.bedingung}: ${ROLLE} Über jede Finanzierung entscheidet der Kreditgeber.`,
        ],
      },
      { typ: "paket", id: "mandat", h2: "Die Gesellschaft für Ihr Objekt", lead: P.karteLead, paket: "global_kapital" },
      {
        typ: "hinweis", id: "wissen", h2: "Was Sie wissen müssen",
        punkte: [
          "Beim Verkauf behält der Käufer nach FIRPTA in der Regel 15 Prozent des Preises für die US-Steuer ein, bei selbst genutzten Objekten bis 1 Mio. $ teils weniger. Zu viel Einbehaltenes holt die Steuererklärung zurück.",
          "Hält eine Person das Objekt direkt, kann in den USA Erbschaftsteuer anfallen; die Struktur klären Partner-Steuerberater vor dem Kauf, in eigener Verantwortung.",
          "Marktzahlen sind keine Zusage. Über Kredit, Höhe und Zins entscheidet allein der Kreditgeber.",
          GLOBAL_PFLICHTHINWEIS.de[0],
        ],
      },
    ],
    fragen: [
      { f: "Brauche ich eine US-Bonität für einen US-Immobilienkredit?", a: "Für eine Mietdeckungs-Finanzierung (DSCR) oft nicht. Der Kreditgeber prüft vor allem, ob die Miete die Rate deckt. Ein US-Score kann die Konditionen verbessern." },
      { f: "Wie viel Eigenkapital brauche ich?", a: "Laut Marktangaben 2026 meist 20 bis 35 Prozent des Kaufpreises, dazu Nebenkosten und Reserven in Höhe mehrerer Monatsraten." },
      { f: "Kann ich die Anzahlung finanzieren?", a: "Kredite Dritter als Anzahlung lehnen Kreditgeber in der Regel ab. Eigene Mittel, die nachweisbar auf Ihrem Konto liegen, sind der verlässliche Weg; die Herkunft geben Sie offen an." },
      { f: "Muss ich zum Notartermin in die USA reisen?", a: "Häufig nicht. Viele Abschlüsse laufen über eine notarielle Vollmacht oder einen Online-Notar; das Geld geht auf das Treuhandkonto der Title Company." },
      { f: "Was passiert beim Verkauf?", a: "Der Käufer behält nach FIRPTA einen Teil des Preises für die US-Steuer ein und führt ihn an die IRS ab. Mit der Steuererklärung wird abgerechnet." },
    ],
    paket: "global_kapital",
    weiter: ["/business/wissen/finanzierungswege-usa", "/business/wissen/llc-gruenden", "/business/wissen/us-llc-steuern", "/business/wissen/bundesstaat-waehlen"],
    quellen: [QF.dscrHandbuch, QF.dscrProgramm, QF.firpta],
  },

  // ─────────────────────────────────────────────────────────────────────────
  // 19 · FINANZIERUNGSWEGE — was einer US-Gesellschaft offensteht, nach Tempo
  {
    pfad: "/business/wissen/finanzierungswege-usa",
    art: "wissen",
    seo: {
      titel: "Finanzierungswege einer US-Gesellschaft — FIAON Global",
      beschreibung: "Karten, Lieferantenkonten, Firmenkarten nach Guthaben, Plattformkredite, Kreditlinie, Objektfinanzierung: was einer US-Gesellschaft offensteht.",
    },
    stand: S,
    erschienen: ERSCHIENEN,
    kennung: "FG · 42",
    auge: "Wissen · Finanzierung",
    h1: "Finanzierungswege in den USA.",
    h1b: "Nach Grundlage und Zeitrahmen.",
    lead: "Einer US-Gesellschaft stehen mehrere Finanzierungswege offen. Manche öffnen sich nach Tagen, andere erst nach Jahren; manche hängen an Ihrer Person, andere am Konto, am Umsatz oder an einer Sicherheit. Hier steht, welcher Weg worauf beruht, damit Sie die Reihenfolge planen können.",
    ziffern: [
      { wert: "6 Wege", label: "von der Karte bis zur Objektfinanzierung" },
      { wert: "1 Regel", label: "über jeden Kredit entscheidet das Institut" },
    ],
    blick: [
      ["Früh und klein", "Persönliche Karten, Lieferantenkonten"],
      ["Nach Guthaben", "Firmenkarten, deren Rahmen dem Kontostand folgt"],
      ["Nach Umsatz", "Kredite von Zahlungsplattformen"],
      ["Mit Geschichte", "Kreditlinie der Bank, meist nach zwei Jahren"],
      ["Mit Sicherheit", "Einlage, Bürgschaft der Muttergesellschaft, Immobilie"],
      ["Mit FIAON Global", "Reihenfolge geplant, Unterlagen vorbereitet"],
    ],
    kurz: "Einer US-Gesellschaft stehen sechs Finanzierungswege offen: persönliche Karten, Lieferantenkonten mit Zahlungsziel, Firmenkarten nach Guthaben, umsatzbasierte Kredite von Zahlungsplattformen, eine Kreditlinie der Bank und die Finanzierung gegen Sicherheiten wie Einlage, Bürgschaft der Muttergesellschaft oder Immobilie. Karten und Lieferantenkonten tragen den Alltag; größere Beträge brauchen Umsatz, Geschichte oder eine Sicherheit. Über jeden Kredit entscheidet das Institut.",
    bloecke: [
      {
        typ: "tabelle", id: "uebersicht", h2: "Die sechs Wege im Überblick",
        kopf: ["Weg", "Grundlage", "Üblicher Zeitrahmen", "Größenordnung"],
        zeilen: [
          ["Persönliche Karten", "Ihre persönliche Akte (ITIN oder SSN)", "Tage nach Zusage", "klein, wächst mit der Historie"],
          ["Lieferantenkonten (Net 30)", "Firmenakte, D-U-N-S-Nummer", "Wochen", "klein bis mittel"],
          ["Firmenkarten nach Guthaben", "Kontostand der Gesellschaft", "Tage", "folgt dem Guthaben"],
          ["Plattformkredite nach Umsatz", "Umsatz über eine Zahlungsplattform", "Tage", "folgt dem Umsatz"],
          ["Kreditlinie der Bank", "Geschäftsjahre, Umsatz oder Sicherheit", "Wochen", "mittel bis groß"],
          ["Finanzierung gegen Sicherheit", "Einlage, Bürgschaft der Muttergesellschaft, Immobilie", "Wochen", "groß"],
        ],
        fuss: ["Übersicht nach Marktbeobachtung, Stand Oktober 2026. Bedingungen, Höhe und Zins legt jedes Institut selbst fest."],
      },
      {
        typ: "etappen", id: "reihenfolge", h2: "Die Reihenfolge, die trägt",
        etappen: [
          { titel: "Gesellschaft und Konto", text: "LLC, EIN, Geschäftskonto. Ohne Konto keine Firmenkarte und keine Plattform." },
          { titel: "Stammdaten und D-U-N-S", text: "Name, Anschrift, Telefon überall identisch; die Gesellschaft bekommt ihre Kennziffer bei der Wirtschaftsauskunftei." },
          { titel: "Lieferantenkonten", text: "Erste Konten mit Zahlungsziel, früh bezahlt. Daraus entsteht die Firmenbonität." },
          { titel: "Firmenkarten", text: "Zuerst nach Guthaben, später mit persönlicher Haftung des Inhabers." },
          { titel: "Umsatz zeigen", text: "Echter US-Umsatz öffnet Plattformkredite und ist die Grundlage jeder Bankentscheidung." },
          { titel: "Bank und Sicherheiten", text: "Kreditlinie, Bürgschaft der Muttergesellschaft, Objektfinanzierung: die Wege für große Beträge." },
        ],
      },
      {
        typ: "text", id: "grenzen", h2: "Wo die Grenzen liegen",
        absaetze: [
          "Staatlich gestützte Kleinunternehmerkredite der SBA (Programme 7(a) und 504) stehen seit dem 1. März 2026 nur Gesellschaften offen, deren Eigentümer ausnahmslos US-Staatsbürger oder US-Staatsangehörige mit Hauptwohnsitz in den USA sind — auch Inhaber einer Green Card sind ausgeschlossen. Manche Online-Kreditgeber vergeben Kredite nur an Inhaber mit Wohnsitz in den USA.",
          "Große Beträge allein über viele Kartenanträge in kurzer Zeit aufzubauen, ist kein belegter Weg. Auf Klage der US-Handelsaufsicht FTC ist einem Anbieter, der Unternehmern Finanzierungen in Aussicht stellte und stattdessen Kreditkarten beantragte, seit 2025 das Finanzierungsgeschäft dauerhaft untersagt.",
        ],
      },
      {
        typ: "text", id: "kapital", h2: "Wofür das Kapital eingesetzt werden kann",
        absaetze: [
          KAPITAL_FREI,
          "Kurzfristige Mittel mit hohen Kosten tragen sich nur, wenn der Ertrag nachweisbar darüber liegt. Für langfristige Wege zählen geordnete Zahlen der Gesellschaft; die Bedingungen legt jedes Institut selbst fest.",
        ],
      },
      {
        typ: "text", id: "fiaon", h2: FIAON_H2,
        absaetze: [
          "Wir legen die Grundlage, auf der Institute entscheiden: die Gründung, einheitliche Stammdaten und vollständige Unterlagen. Konto- und Kartenanträge bereiten wir vollständig vor; die Anträge stellen Sie selbst.",
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
          "Einen bestimmten Rahmen oder Zins kann niemand zusagen.",
          GLOBAL_PFLICHTHINWEIS.de[1],
        ],
      },
    ],
    fragen: [
      { f: "Welche Finanzierung steht einer neuen US-Gesellschaft zuerst offen?", a: "Firmenkarten, deren Rahmen sich am Guthaben orientiert, und Lieferantenkonten mit Zahlungsziel. Kreditlinien der Bank setzen meist Geschäftsjahre, Umsatz oder eine Sicherheit voraus. Über jeden Antrag entscheidet das Institut." },
      { f: "Bekommt eine LLC aus Europa einen SBA-Kredit?", a: "Nein. Seit dem 1. März 2026 müssen alle direkten und indirekten Eigentümer US-Staatsbürger oder US-Staatsangehörige mit Hauptwohnsitz in den USA sein (SBA Procedural Notice 5000-876626); auch eine Green Card genügt nicht." },
      { f: "Kann eine Muttergesellschaft in Europa für die US-Gesellschaft bürgen?", a: "Ja, das ist ein üblicher Weg zu einer Kreditlinie. Die Bank prüft dann vor allem die Bilanz der Muttergesellschaft." },
      { f: "Beschafft FIAON den Kredit für meine US-Gesellschaft?", a: `Nein. ${ROLLE} Wir bereiten die Anträge vollständig vor und begleiten Ihre Gesellschaft bis zur Entscheidung; es entscheidet das finanzierende Institut.` },
    ],
    paket: "global_kapital",
    weiter: ["/business/wissen/business-credit-usa", "/business/wissen/us-firmenkarte-beantragen", "/business/wissen/us-funding", "/business/firmenkarten-kapital"],
    quellen: [Q.duns, Q.paydex, QF.sbaKredite, QF.sbaRegel2026, Q.ftcSeek],
  },
];
