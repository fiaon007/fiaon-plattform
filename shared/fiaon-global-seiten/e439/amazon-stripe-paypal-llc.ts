// ═══════════════════════════════════════════════════════════════════════════
// FIAON GLOBAL — WISSEN: AMAZON, STRIPE UND PAYPAL MIT DER US-LLC (27.10.2026, E-439)
// FG · 49 · Thema T5 (mit T10 Sales Tax) aus .arbeit/recherche/kw_de.md
//
// Für Onlinehändler, Agenturen und Software: Was Marktplätze und Zahlungsdienste bei
// einer US-LLC mit Inhaber in Europa prüfen, welches Steuerformular die LLC abgibt,
// wann die Sales Tax Sache des Marktplatzes ist, was an die IRS gemeldet wird und
// woran Konten typischerweise hängen bleiben — jede Plattformregel aus der offiziellen
// Hilfeseite der Plattform, jede Steuerregel aus dem amtlichen Text.
//
// Selbst nachgeprüft am 27.10.2026:
// · Amazon: sell.amazon.com/sell/registration-guide (Unterlagenliste, fünf Schritte,
//   Identitätsprüfung per Foto oder Videotermin, Farbscans mit vier Ecken, Adressnachweis
//   aus den letzten 180 Tagen, Konto auf Ihren Namen oder den der Gesellschaft, Anschrift
//   wie im Registrierungsnachweis); sell.amazon.com/global-selling/europe-to-usa
//   (Reisepass, Adressnachweis aus Europa oder den USA, Steuerinterview erstellt das
//   Steuerformular, Amazon Currency Converter auf ein Konto in Europa); sell.amazon.com/sell
//   (Professional-Konto 39,99 $ im Monat zuzüglich Verkaufsgebühren).
// · Stripe: Vertreter/Eigentümer ohne SSN oder ITIN → Steuernummer des Wohnsitzlands und
//   Nachweis fehlender US-Steuerpflicht; Eigentümer ab 25 % und eine Person mit maßgeblicher
//   Kontrolle (Name, Geburtsdatum, Anschrift); Liste eingeschränkter Geschäfte; Rücklagen
//   (Streitfälle, lange Lieferzeiten, unerklärter Anstieg); mehr als 0,75 % Streitfälle =
//   hohes Risiko; Schließung mit E-Mail und erneuter Prüfung.
// · PayPal: 1099-K-Schwelle (One Big Beautiful Bill Act 2025), 24 % Einbehalt bei fehlenden
//   Steuerangaben, niedrigere Schwellen einzelner Staaten; Gründe für Kontoeinschränkungen.
// · Shopify Payments USA: Einzelpersonen nur mit Wohnsitz in den USA; Name exakt wie in den
//   IRS-Unterlagen; physische US-Geschäftsanschrift; US-Girokonto in USD mit ACH; Eigentümer
//   ab 25 %; Vertreter ohne SSN/ITIN mit Wohnsitz außerhalb der USA per Foto des Reisepasses.
// · IRS: Instructions W-8BEN und W-8ECI (Rev. 10/2021: bei der Einpersonen-LLC gibt der
//   ausländische Inhaber das Formular ab), Form W-9 (Rev. March 2024: „even if the foreign
//   person has a U.S. TIN“; Zeile 3b nur bei Formularen an eine Partnership,
//   24 % Backup Withholding), About Form W-8BEN-E, Understanding your Form 1099-K
//   (mehr als 20.000 $ in mehr als 200 Transaktionen; Kartenzahlungen ohne Mindestgrenze).
// · Florida Statutes 2026 § 212.05965 (Marketplace Provider erhebt und führt ab, der Händler
//   darf auf diese Verkäufe nicht selbst erheben) und § 212.0596 (mehr als 100.000 $
//   Fernverkäufe im Vorjahr); South Dakota v. Wayfair (21.06.2018).
// Bewusst weggelassen (nicht an einer frei lesbaren Primärquelle prüfbar am 27.10.2026):
// Amazons Liste der Staaten mit Marktplatz-Steuererhebung (Hilfeseite 503), die
// Angabe der Recherche, Stripe verlange bei Vertretern im Ausland nur den Reisepass (steht
// nicht auf der Stripe-Seite), ob Plattformen für ausländisch gehaltene Einpersonen-LLCs
// eine 1099-K ausstellen, und ob Lager in einem Staat dort Sales-Tax-Pflichten auslösen.
//
// Wortwand: keine Banknamen, kein „bis zu“, keine Frist mit Ziffer als Zusage, keine
// Empfehlung, kein Steuerversprechen; Marktplatz-Konten, Sales-Tax-Registrierungen und
// Buchhaltung sind NICHT Teil der Pakete (so auch /business/onlinehandel und
// /business/wissen/markteintritt-usa); die Agent-Anschrift ist keine Händleradresse
// (GLOBAL_AGENT.de.anschrift). „Unternehmensberatung“ als Selbstbezeichnung erlaubt seit
// E-439 (Justin, 27.10.2026).
//
// Fach- und Rechtsprüfung 27.10.2026 (jede Quelle erneut geöffnet), korrigiert:
// · W-9 Zeile 3b gilt nur für Formulare an eine Partnership, an der die LLC beteiligt ist —
//   nicht für Plattformen (fw9.pdf, Rev. 3-2024, „Line 3b“) → gestrichen.
// · Shopify: „photograph of a valid passport“ = Foto des Reisepasses, kein Passfoto; die
//   US-Anschrift muss die sein, „where the business operations primarily occur“.
// · Amazon: Europa-Seite sagt „may not be required to form a US company“ → so wiedergegeben.
// · PayPal (help545) nennt keinen Identitätsnachweis und kein „bis sie vorliegen“ → angepasst.
// · Florida § 212.05965 Abs. 1 (Zahlungsabwickler sind kein Marktplatz) und Abs. 4 (für die
//   Schwelle zählen nur Verkäufe außerhalb des Marktplatzes) ergänzt; § 138 Abs. 2/5 AO ergänzt.
// · „US-Logistiker verlangen oft einen US-Vertragspartner“ ohne Quelle → gestrichen.
// · „Plattformen identifizieren jeden Eigentümer ab 25 %“ galt nur für Stripe und Shopify → enger.
// · „das vorbereitete Geschäftskonto“ (klang nach Konto-Zusage) → „vorbereiteter Kontoantrag“.
// ═══════════════════════════════════════════════════════════════════════════
import type { GlobalSeite, GlobalQuelle } from "../typen";
// E-509 (12.11.2026): EIN Produkt statt vier Pakete — kein Paketname, der Preis aus EIN_PRODUKT; die alte Geld-zurück-Zusage
// je Paket entfällt (auf dieser Seite geht es nicht um Kapital).
import { GLOBAL_AGENT, GLOBAL_PFLICHTHINWEIS } from "../../fiaon-global";
import { EIN_PRODUKT } from "../ein-produkt";
import { QUELLEN_WISSEN as Q, SCHWELLEN } from "../fakten";
// E-510 (13.11.2026, Sprachleitfaden FIAON Global): ein Abschnitt „Was FIAON Global dabei übernimmt“ aus den Schritten 1 und 2
// der festen Erzählung; über Konten bei Marktplätzen und Zahlungsdienstleistern entscheidet der jeweilige Anbieter (dort genau
// einmal gesagt). Kein „Team vor Ort“, kein Partnerstandort, kein Partner bei der Arbeit im Präsens, keine D-U-N-S-Nummer als Leistung.
// Zweite Runde desselben Umbaus: jeder sichtbare Text Satz für Satz neu gefasst — Aussage, Bedingung, Entscheider; Sachtitel mit
// höchstens sechs Wörtern; ein Wort je Sache (Plattform, Händler, Bundesstaat, Einschränkung). Über die Zulassung entscheidet die
// jeweilige Plattform, einmal je Abschnitt gesagt. Steuerfragen stehen im Fließtext als Zuständigkeit („Sache eines Steuerberaters“),
// nie als Partner bei der Arbeit; die Rolle der Partner trägt allein der feste Satz zur Rolle im Hinweis-Baustein. Der Satz
// „kein Steuermodell“ kommt aus der Quelle der festen Sätze. Hauptüberschrift und zweite Zeile bleiben wortgleich (Vorschaubild).
// Fakten, Zahlen, Paragrafen, Quellen, Anker und Bausteine unverändert.
import { SCHRITTE_KOPF, SECHS_SCHRITTE, satz, type Schritt, type SchrittNr } from "../../fiaon-global-saetze";

const S = "2026-10-27";
const P = EIN_PRODUKT.de;
/** Schritt 1 und 2 der festen Erzählung (Leitfaden 2.2) — wortgleich aus der einen Quelle, nie getippt. */
const schritt = (nr: SchrittNr): Schritt => SECHS_SCHRITTE.de.find((x) => x.nr === nr)!;
const GRUENDUNG = schritt(1);
const UNTERLAGEN = schritt(2);
/** Die Namen der festen Teile eines Schritts: „Ihr Teil“, „Bedingung“ (Leitfaden 2.1). */
const TEIL = SCHRITTE_KOPF.de.teile;
/** „25 Prozent“ — die Eigentümerschwelle steht in fakten.ts. */
const AB25 = SCHWELLEN.eigentuemer;

/** Quellen dieses Beitrags (selbst abgerufen am 27.10.2026). */
const QUELLEN: Record<string, GlobalQuelle> = {
  amazonAnmeldung: { titel: "Amazon — Seller registration guide (Unterlagen, Schritte, Identitätsprüfung)", url: "https://sell.amazon.com/sell/registration-guide" },
  amazonEuropa: { titel: "Amazon — How to sell on Amazon USA from Europe", url: "https://sell.amazon.com/global-selling/europe-to-usa" },
  amazonPreis: { titel: "Amazon — Sell on Amazon (Professional-Verkäuferkonto)", url: "https://sell.amazon.com/sell" },
  stripeSteuernummer: { titel: "Stripe — Tax ID requirements for representatives and owners of US companies", url: "https://support.stripe.com/questions/business-rep-owner-tax-id-requirements-for-us-companies" },
  stripeEigentuemer: { titel: "Stripe — Beneficial ownership requirements: United States", url: "https://support.stripe.com/questions/beneficial-ownership-requirements-united-states" },
  stripeKyc: { titel: "Stripe — Know your customer obligations", url: "https://support.stripe.com/questions/know-your-customer-obligations" },
  stripeBranchen: { titel: "Stripe — Prohibited and restricted businesses", url: "https://stripe.com/legal/restricted-businesses" },
  stripeRuecklage: { titel: "Stripe — Reserves: frequently asked questions", url: "https://support.stripe.com/questions/reserves-frequently-asked-questions" },
  stripeRisiko: { titel: "Stripe — Credit account review process: frequently asked questions", url: "https://support.stripe.com/questions/credit-account-review-process-frequently-asked-questions" },
  stripeSchliessung: { titel: "Stripe — Why was my Stripe account closed?", url: "https://support.stripe.com/questions/why-was-my-stripe-account-closed" },
  paypal1099k: { titel: "PayPal — Current Form 1099-K reporting thresholds", url: "https://www.paypal.com/us/cshelp/article/current-form-1099-k-reporting-thresholds-2025-update-help1131" },
  paypalEinschraenkung: { titel: "PayPal — Why is my PayPal account limited?", url: "https://www.paypal.com/us/cshelp/article/why-is-my-paypal-account-limited-help534" },
  paypalGeschaeft: { titel: "PayPal — Why is PayPal requesting information about my business?", url: "https://securepayments.paypal.com/us/cshelp/article/why-is-paypal-requesting-information-about-my-business-help545" },
  shopifyUsa: { titel: "Shopify Help Center — Shopify Payments requirements in the United States", url: "https://help.shopify.com/en/manual/payments/shopify-payments/supported-countries/united-states/requirements" },
  w8ben: { titel: "IRS — Instructions for Form W-8BEN", url: "https://www.irs.gov/instructions/iw8ben" },
  w8eci: { titel: "IRS — Instructions for Form W-8ECI", url: "https://www.irs.gov/instructions/iw8eci" },
  w8bene: { titel: "IRS — About Form W-8BEN-E", url: "https://www.irs.gov/forms-pubs/about-form-w-8-ben-e" },
  w9: { titel: "IRS — Form W-9 (Rev. March 2024) mit Anleitung", url: "https://www.irs.gov/pub/irs-pdf/fw9.pdf" },
  f1099k: { titel: "IRS — Understanding your Form 1099-K", url: "https://www.irs.gov/businesses/understanding-your-form-1099-k" },
  fl21205965: { titel: "Florida Statutes 2026, § 212.05965 — Marketplace Provider und Marketplace Seller", url: "https://www.flsenate.gov/Laws/Statutes/2026/212.05965" },
  fl2120596: { titel: "Florida Statutes 2026, § 212.0596 — Sales Tax bei Fernverkäufen", url: "https://www.flsenate.gov/Laws/Statutes/2026/212.0596" },
  wayfair: { titel: "Supreme Court — South Dakota v. Wayfair, Inc. (21.06.2018)", url: "https://www.law.cornell.edu/supremecourt/text/17-494" },
  ao10: { titel: "§ 10 AO — Geschäftsleitung", url: "https://www.gesetze-im-internet.de/ao_1977/__10.html" },
  kstg1: { titel: "§ 1 KStG — Unbeschränkte Steuerpflicht", url: "https://www.gesetze-im-internet.de/kstg_1977/__1.html" },
};

export const SEITE: GlobalSeite = {
  pfad: "/business/wissen/amazon-stripe-paypal-llc",
  art: "wissen",
  seo: {
    titel: "Amazon Seller US LLC: was Plattformen prüfen — FIAON Global",
    beschreibung: "Amazon Seller US LLC: was Amazon, Stripe, PayPal und Shopify prüfen — Identität, EIN, Konto, W-8 oder W-9, Sales Tax und typische Sperrgründe.",
  },
  stand: "2026-11-13",
  erschienen: S,
  kennung: "FG · 49",
  auge: "Wissen · Plattformen",
  h1: "Amazon, Stripe, PayPal.",
  h1b: "Was die Plattformen bei Ihrer US-LLC prüfen.",
  lead: "Wer als Amazon Seller mit einer US LLC verkauft, durchläuft die Prüfung der Plattform: bei der Anmeldung und später erneut. Dasselbe gilt für Zahlungen über Stripe, PayPal und Shopify. Die Plattformen fragen, wem die Gesellschaft gehört, welche Steuernummer sie führt und wohin die Erlöse gehen. Dieser Artikel nennt die Anforderungen, das passende Steuerformular und die Regeln zur Sales Tax. Er nennt auch die Gründe, aus denen Plattformen Konten einschränken.",
  ziffern: [
    { wert: AB25, label: "ab diesem Anteil erfassen Stripe und Shopify jeden Eigentümer" },
    { wert: "180 Tage", label: "Höchstalter des Adressnachweises bei Amazon" },
    { wert: "20.000 $", label: "Meldeschwelle für Form 1099-K: mehr als dieser Betrag in mehr als 200 Transaktionen im Jahr" },
  ],
  blick: [
    ["Wen die Plattform prüft", `Sie mit Ihrem Ausweis; bei Stripe und Shopify jeden Eigentümer ab ${AB25}; bei Stripe zusätzlich eine Person mit maßgeblicher Kontrolle`],
    ["Gesellschaft", "Registrierungsnachweis und EIN; der Name exakt wie in den Unterlagen der IRS"],
    ["Konto", "Auf Ihren Namen oder den der Gesellschaft; Shopify Payments verlangt ein US-Girokonto"],
    ["Steuerformular", "Einpersonen-LLC mit Inhaber im Ausland: W-8 des Inhabers. Mehrere Gesellschafter: W-9 der LLC"],
    ["Sales Tax", "Marktplatz-Verkäufe: der Marktplatz, wo der Bundesstaat es so regelt. Eigener Shop: Ihre Gesellschaft, ab der Schwelle des Bundesstaats"],
    ["Wer entscheidet", "Die jeweilige Plattform: über Zulassung, Rücklagen und Einschränkungen"],
    ["Mit FIAON Global", "Gründung, Unterlagen sowie die Anträge für EIN und ITIN. Bei den Plattformen melden Sie sich selbst an"],
  ],
  kurz: "Bei einem Amazon Seller mit US LLC prüft die Plattform fünf Punkte: Eigentümer, die Gesellschaft mit ihrer Steuernummer (EIN), Auszahlungskonto, Steuerformular sowie stimmige Anschriften und Nachweise. Stripe, PayPal und Shopify fragen dasselbe ab. Gehört die LLC allein einer Person im Ausland, gibt der Inhaber ein Formular W-8 ab, nicht die LLC ein W-9. Die Sales Tax auf Marktplatz-Verkäufe führt der Marktplatz ab, wo der Bundesstaat es so regelt; im eigenen Shop ist Ihre Gesellschaft ab der Schwelle des Bundesstaats zuständig. Über die Zulassung entscheidet die jeweilige Plattform.",
  bloecke: [
    {
      typ: "text", id: "ueberblick", h2: "Amazon Seller US LLC: fünf Prüfpunkte",
      absaetze: [
        "Marktplätze und Zahlungsdienste nehmen Zahlungen für ihre Händler an und leiten sie weiter. Daraus folgen Pflichten gegenüber Aufsicht, Kartennetzen und Steuerbehörde. Nach Stripe stammen seine Anforderungen von den Aufsichtsbehörden und sollen den Missbrauch des Finanzsystems verhindern. Bei einer US-LLC mit Inhaber in Europa ist die Gesellschaft amerikanisch, der Inhaber ist es nicht. Die Unterlagen müssen beides ohne Widerspruch belegen.",
        "Die Plattformen fragen im Kern dieselben fünf Punkte ab:",
      ],
      punkte: [
        `Eigentümer: Ihr Ausweis; bei Stripe und Shopify Angaben zu jedem Eigentümer ab ${AB25}; bei Stripe zusätzlich zu einer Person mit maßgeblicher Kontrolle`,
        "Gesellschaft: der Registrierungsnachweis des Bundesstaats und die EIN (Steuernummer der Gesellschaft), mit genau dem Namen, den die US-Steuerbehörde IRS führt",
        "Auszahlung: ein Konto auf den Namen der Gesellschaft oder des Inhabers",
        "Steuern: Steuernummer und Steuerangaben; bei Amazon das Steuerinterview mit Formular W-8 oder W-9",
        "Erreichbarkeit: Geschäftsanschrift, Wohnanschrift mit aktuellem Nachweis, Telefonnummer und E-Mail-Adresse",
      ],
      nach: "Rückfragen entstehen oft aus einem Widerspruch zwischen zwei Unterlagen. Beispiele sind ein abweichend geschriebener Name, eine Anschrift ohne passenden Nachweis oder ein Konto auf den Namen eines Dritten.",
    },
    {
      typ: "tabelle", id: "plattformen", h2: "Amazon, Stripe, PayPal, Shopify im Vergleich",
      lead: "Die Anforderungen der vier Plattformen an eine US-Gesellschaft, nach ihren eigenen Hilfeseiten. Über die Zulassung entscheidet die jeweilige Plattform.",
      kopf: ["Plattform", "Was sie prüft", "Was dabei gilt"],
      zeilen: [
        ["Amazon (Verkäuferkonto USA)", "Ausweis, Telefon und E-Mail, international belastbare Kreditkarte, Konto mit Routingnummer, Registrierungsnachweis, Wohnadressnachweis, Steuerangaben; danach Identitätsprüfung per Foto oder Videotermin", "Anschrift wie im Registrierungsnachweis; Adressnachweis aus den letzten 180 Tagen; Konto auf Ihren Namen oder den der Gesellschaft"],
        ["Stripe", `Die Gesellschaft, jede Person ab ${AB25} und eine Person mit maßgeblicher Kontrolle: Name, Geburtsdatum, Anschrift`, "Ohne Sozialversicherungsnummer (SSN) oder persönliche Steuernummer (ITIN): Steuernummer aus dem Wohnsitzland und Nachweis, dass keine US-Steuerpflicht besteht. Das Geschäft steht nicht auf der Liste verbotener Branchen; eingeschränkte Branchen nimmt Stripe nur nach zusätzlicher Prüfung an"],
        ["PayPal Business", "Steuerangaben für die Meldung an die IRS; bei Prüfungen Geschäftsunterlagen wie Lieferantenangaben, Rechnungen und Kontoauszüge", "Vollständige Steuerangaben; Waren und Leistungen im Rahmen der Nutzungsrichtlinie; eine nachvollziehbare Entwicklung der Umsätze"],
        ["Shopify Payments (USA)", `Name und EIN der Gesellschaft; physische Geschäftsanschrift in den USA, an der das Geschäft hauptsächlich betrieben wird; US-Girokonto in US-Dollar mit ACH-Empfang; jeder Eigentümer ab ${AB25}`, "Name exakt wie in den IRS-Unterlagen. Vertreter ohne SSN oder ITIN mit Wohnsitz außerhalb der USA weisen sich mit einem Foto ihres gültigen Reisepasses aus"],
      ],
      fuss: ["Quelle: Hilfeseiten der Plattformen, Stand: Oktober 2026. Jede Plattform legt ihre Anforderungen selbst fest und kann weitere Unterlagen verlangen."],
    },
    {
      typ: "text", id: "amazon", h2: "Anmeldung als Amazon Seller mit US-LLC",
      absaetze: [
        "Unternehmen aus Europa brauchen für den US-Marktplatz nach Amazons eigener Darstellung nicht unbedingt eine US-Gesellschaft. Ob sie sinnvoll ist, hängt nach Amazon von Ihrem Geschäft und Ihrer Verkaufsstrategie ab. Für die Anmeldung nennt Amazon folgende Angaben und Unterlagen. Zur Person: einen amtlichen Ausweis wie den Reisepass, Telefonnummer und E-Mail-Adresse. Zur Zahlung: eine international belastbare Kreditkarte sowie Konto- und Routingnummer. Zum Unternehmen: einen Registrierungsnachweis und die Steuerangaben. Zur Wohnanschrift: einen Nachweis aus den letzten 180 Tagen, etwa einen Konto- oder Kreditkartenauszug aus Europa oder den USA. Als Geschäftsanschrift tragen Sie die Anschrift aus dem Registrierungsnachweis ein.",
        "Danach folgt die Identitätsprüfung. Sie reichen Ausweis und Adressnachweis ein. Anschließend machen Sie ein Foto von Gesicht und Ausweis oder führen einen Videotermin mit einem Amazon-Mitarbeiter. Zum Videotermin bringen Sie Ausweis und Adressnachweis mit. Amazon verlangt Farbscans oder Fotos in guter Qualität: Alle vier Ecken sind zu sehen, der Text ist lesbar. Bildschirmfotos und unscharfe Aufnahmen genügen nach Amazon nicht.",
        "Zur Anmeldung gehört ein Steuerinterview. Aus Ihren Angaben erstellt Amazon das passende Steuerformular; welches das ist, zeigt der Abschnitt zum Steuerformular. Ihre Erlöse vom US-Marktplatz zahlt Amazon auf ein US-Konto aus oder über den Amazon Currency Converter auf ein Konto in Europa. Das Konto muss auf Ihren Namen oder den Ihrer Gesellschaft lauten. Das Professional-Verkäuferkonto kostet 39,99 $ im Monat zuzüglich der Verkaufsgebühren. Über die Zulassung entscheidet Amazon.",
      ],
    },
    {
      typ: "text", id: "zahlungsdienste", h2: "Stripe, PayPal und Shopify mit US-LLC",
      absaetze: [
        `Stripe erfasst bei Gesellschaften in den USA eine Person mit maßgeblicher Kontrolle und jede Person, die mindestens ${AB25} hält. Stripe fragt Name, Geburtsdatum und Anschrift ab, bei US-Personen auch die Sozialversicherungsnummer (SSN). Grundlage ist nach Stripe das US-Recht zu wirtschaftlich Berechtigten; nach derselben Regel prüfen Banken ihre Firmenkunden (31 CFR 1010.230). Haben Vertreter oder Eigentümer weder SSN noch die persönliche Steuernummer ITIN, erwartet Stripe die Steuernummer aus ihrem Wohnsitzland. Hinzu kommen Unterlagen, nach denen sie in den USA nicht steuerpflichtig sind. Einige Branchen nimmt Stripe nicht an, andere nur nach zusätzlicher Prüfung. Stripe begründet das mit Gesetzen, Kartennetzen und den Banken, mit denen es arbeitet. Maßgeblich ist seine Liste eingeschränkter und verbotener Geschäfte.`,
        "PayPal Business fragt die Steuerangaben ab, die es für die Meldung an die IRS braucht. Bemerkt PayPal ein verändertes Verkaufsmuster oder mehr Käuferbeschwerden, kann es Unterlagen zum Geschäft anfordern. Das sind etwa Lieferantenangaben, Rechnungen und Kontoauszüge. PayPal kann das Konto außerdem einschränken; dann lässt sich zum Beispiel kein Geld senden oder abheben. Die Einschränkung gilt, bis die von PayPal genannten Schritte erledigt sind. Den Grund nennt PayPal per E-Mail und im Resolution Center des Kontos. Eine E-Mail ohne Eintrag im Resolution Center kann nach PayPal gefälscht sein.",
        `Shopify Payments steht in den USA Einzelpersonen und Einzelunternehmern nur mit Wohnsitz in den USA offen. Für eine LLC nennt Shopify diese Anforderungen. Erstens den Namen exakt wie in den IRS-Unterlagen, einschließlich Zeichensetzung und Groß- und Kleinschreibung. Zweitens die EIN; als Beleg dient bei Bedarf ein Schreiben der IRS (Bestätigung zum SS-4, Notice CP 575 oder Letter 147C). Drittens die physische Geschäftsanschrift in den USA, an der das Geschäft hauptsächlich betrieben wird. Viertens ein vollwertiges Girokonto bei einer US-Bank in US-Dollar, das ACH-Überweisungen empfangen kann. Die LLC gibt außerdem jeden Eigentümer ab ${AB25} an. Vertreter mit Wohnsitz außerhalb der USA ohne SSN und ITIN können stattdessen ein Foto ihres gültigen Reisepasses einreichen. Über die Zulassung entscheidet der jeweilige Zahlungsdienst.`,
      ],
    },
    {
      typ: "tabelle", id: "formulare", h2: "W-9 oder W-8: das passende Steuerformular",
      lead: "Das Steuerinterview legt fest, wie die Plattform Ihre Gesellschaft gegenüber der IRS führt. Maßgeblich sind die steuerliche Einordnung der LLC und ihr Inhaber.",
      kopf: ["Ihre LLC", "Formular", "Wer es abgibt"],
      zeilen: [
        ["Einpersonen-LLC, Inhaber ist eine Person mit Wohnsitz im Ausland", "W-8BEN; bei Einkünften, die effektiv mit einem US-Geschäft verbunden sind, W-8ECI", "Der Inhaber mit seinem Namen und seinen Angaben, nicht die LLC"],
        ["Einpersonen-LLC, Inhaberin ist eine Gesellschaft im Ausland, etwa eine GmbH", "W-8BEN-E; bei effektiv verbundenen Einkünften W-8ECI", "Die Inhaberin, nicht die LLC"],
        ["LLC mit mehreren Gesellschaftern (steuerlich eine Partnership)", "W-9", "Die LLC selbst, auch wenn ihre Gesellschafter im Ausland wohnen"],
        ["LLC, die als Corporation besteuert wird", "W-9", "Die LLC selbst"],
      ],
      fuss: [
        "Das Formular W-9 hält ausdrücklich fest: Ist der Inhaber einer steuerlich transparenten Gesellschaft eine ausländische Person, gibt er ein Formular W-8 ab. Das gilt auch, wenn er eine US-Steuernummer wie die ITIN hat.",
        "Die Einordnung Ihrer LLC geben Sie bereits im EIN-Antrag an (Zeile 9a des Formulars SS-4). Welche Einkünfte effektiv mit einem US-Geschäft verbunden sind, hängt von Ihrem Geschäft ab. Diese Frage ist Sache eines US-Steuerberaters (CPA).",
      ],
    },
    {
      typ: "text", id: "meldungen", h2: "Form 1099-K: Meldung und Einbehalt",
      absaetze: [
        "Zahlungsplattformen und Marktplätze melden Zahlungen für Waren und Leistungen auf Form 1099-K an die IRS. Die Meldung setzt ein, wenn die Zahlungen im Jahr mehr als 20.000 $ in mehr als 200 Transaktionen betragen. PayPal nennt als Grundlage den One Big Beautiful Bill Act von 2025; er hat diese Schwelle wiederhergestellt. Für Kartenzahlungen über einen Zahlungsabwickler gilt keine Mindestgrenze. Einzelne Bundesstaaten setzen niedrigere Schwellen.",
        "Deshalb fragen die Plattformen Steuernummer und Steuerformular ab und gleichen Name und Nummer ab. Shopify kann ein Schreiben der IRS anfordern, wenn sich die EIN nicht bestätigen lässt. Fehlen die Angaben, kann ein Zahlungsdienst einen Teil der Zahlungen einbehalten. PayPal hat bei Konten ohne Steuerangaben 24 Prozent einbehalten. Das ist der Satz des Backup Withholding, den auch das Formular W-9 nennt.",
        "Die US-Meldungen ersetzen die Steuererklärung im Wohnsitzland nicht. Führen Sie die LLC von Deutschland aus, liegt dort der Mittelpunkt ihrer geschäftlichen Oberleitung. Das ist ihre Geschäftsleitung im Sinne von § 10 AO. Deutschland besteuert dann je nach Einordnung die Gesellschaft selbst (§ 1 KStG) oder ihren Gewinn bei Ihnen. Die Gründung oder Beteiligung melden Sie dem Finanzamt nach § 138 Abs. 2 AO, zusammen mit der Steuererklärung für das Jahr, in dem sie stattfand. Wie die Plattform-Umsätze in Deutschland zu erklären sind, ist Sache eines Steuerberaters. Die laufende Steuererklärung bleibt bei Ihrem Steuerberater.",
      ],
    },
    {
      typ: "text", id: "sales-tax", h2: "Sales Tax: Marktplatz und eigener Shop",
      absaetze: [
        "Die Sales Tax ist die Verkaufssteuer der Bundesstaaten. Seit der Entscheidung South Dakota v. Wayfair des Supreme Court vom 21. Juni 2018 dürfen Bundesstaaten sie auch von Händlern ohne Präsenz vor Ort verlangen. South Dakota knüpfte die Pflicht an Lieferungen in den Staat von mehr als 100.000 $ oder an mindestens 200 einzelne Geschäfte im Jahr. Jeder Bundesstaat setzt eigene Schwellen.",
        "Für Verkäufe über Marktplätze haben die Bundesstaaten eigene Regeln geschaffen, im Englischen meist unter dem Begriff marketplace facilitator. Ein Beispiel ist Florida (§ 212.05965 Florida Statutes). Der Marktplatz bestätigt seinen Händlern schriftlich, dass er die Sales Tax auf die über ihn abgewickelten Verkäufe erhebt und abführt. Der Händler darf sie auf diese Verkäufe dann nicht selbst erheben. Er lässt diese Verkäufe aus seiner eigenen Erklärung heraus.",
        "Für den eigenen Shop mit Shopify, Stripe oder PayPal als Zahlungsweg gilt diese Regel nicht. Zahlungsabwickler sind nach dem Gesetz in Florida ausdrücklich keine Marktplätze. Im eigenen Shop ist Ihre Gesellschaft selbst zuständig, sobald sie die Schwelle eines Bundesstaats überschreitet. In Florida liegt die Schwelle bei steuerbaren Fernverkäufen von mehr als 100.000 $ im Vorjahr (§ 212.0596 Florida Statutes). Für diese Schwelle zählen nur die Verkäufe außerhalb des Marktplatzes (§ 212.05965 Abs. 4). Ob und wo sich Ihre Gesellschaft registrieren muss, hängt vom Einzelfall ab. Das gilt auch für die Frage, ob Ware in einem Lager dort eigene Pflichten auslöst, etwa beim Versand durch Amazon (FBA). Beide Fragen sind Sache eines US-Steuerberaters (CPA).",
      ],
    },
    {
      typ: "karten", id: "sperren", h2: "Typische Sperrgründe der Plattformen", spalten: 3,
      lead: "Die Gründe für Prüfungen, Rücklagen und Einschränkungen, wie die Plattformen sie selbst nennen.",
      karten: [
        { tag: "Stammdaten", titel: "Abweichende Schreibweisen und Anschriften", text: "Der Name im EIN-Schreiben weicht vom Gründungsdokument ab, oder die Anschrift im Antrag passt nicht zum Nachweis. Shopify verlangt den Namen exakt wie in den IRS-Unterlagen. Amazon verlangt die Anschrift wie im Registrierungsnachweis." },
        { tag: "Nachweis", titel: "Unlesbar oder zu alt", text: "Abgeschnittene Ecken, unscharfe Fotos oder ein Adressnachweis, der älter als 180 Tage ist. Amazon verlangt gut lesbare Farbscans, auf denen alle vier Ecken zu sehen sind." },
        { tag: "Branche", titel: "Eingeschränkte Geschäfte", text: "Glücksspiel, Waffen, Schuldenregulierung und weitere Branchen nimmt Stripe nicht oder nur nach zusätzlicher Prüfung an. PayPal schränkt Konten bei Verstößen gegen seine Nutzungsrichtlinie ein." },
        { tag: "Streitfälle", titel: "Rückbuchungen und Beschwerden", text: "Stripe stuft Konten mit mehr als 0,75 Prozent Streitfällen als hohes Risiko ein. PayPal prüft Konten mit vielen Käuferbeschwerden und Rückbuchungen." },
        { tag: "Umsatz", titel: "Umsatzanstieg ohne Erklärung", text: "Ein plötzlicher Anstieg der Umsätze oder eine neue Produktart kann bei PayPal zu einer Einschränkung führen. Stripe kann einen Teil der Erlöse als Rücklage zurückhalten, etwa bei einem starken Anstieg ohne Erklärung oder bei langen Lieferzeiten." },
        { tag: "Steuer", titel: "Fehlende Steuerangaben", text: "Ohne bestätigte Steuernummer und passendes Steuerformular fehlt die Grundlage für die Meldung an die IRS. PayPal hat in solchen Fällen 24 Prozent der Zahlungen einbehalten." },
      ],
    },
    {
      typ: "etappen", id: "reihenfolge", h2: "Die Reihenfolge bis zur Anmeldung",
      lead: "Die Anmeldung bei den Plattformen steht am Ende. Dann liegen jede Angabe und jede Unterlage vor.",
      etappen: [
        { titel: "Name und Gesellschaft festlegen", text: "Der Name lautet überall Zeichen für Zeichen gleich: im Gründungsdokument, im EIN-Schreiben, beim Konto und bei jeder Plattform. Das schließt die Zeichensetzung ein." },
        { titel: "EIN beantragen", text: "Die EIN ist die Steuernummer der Gesellschaft. Das Schreiben der IRS (CP 575 oder Letter 147C) gehört zu den Unterlagen. Shopify kann es anfordern, wenn sich die Nummer nicht bestätigen lässt." },
        { titel: "Eigentümer dokumentieren", text: `Das Operating Agreement, der Gesellschaftsvertrag der LLC, nennt jeden Gesellschafter mit seinem Anteil. Die Anteile ergeben zusammen 100 Prozent. Stripe und Shopify erfassen jeden Eigentümer ab ${AB25}.` },
        { titel: "Auszahlungskonto bestimmen", text: "Amazon zahlt nur auf ein Konto auf Ihren Namen oder den der Gesellschaft aus. Shopify Payments verlangt ein US-Girokonto in US-Dollar mit ACH-Empfang. Über die Eröffnung eines Kontos entscheidet das jeweilige Institut." },
        { titel: "Steuerformular klären", text: "Vor dem Steuerinterview steht fest, welches Formular gilt: W-8BEN, W-8BEN-E, W-8ECI oder W-9. Ebenso steht fest, wer es unterzeichnet." },
        { titel: "Anschrift und Telefon festlegen", text: "Die Geschäftsanschrift passt zu Ihren Nachweisen, und unter der Telefonnummer sind Sie erreichbar. Beide Angaben lauten in jedem Antrag gleich." },
        { titel: "Bei den Plattformen anmelden", text: "Zuletzt melden Sie sich bei den Plattformen an. Sie halten Reisepass, Adressnachweis aus den letzten 180 Tagen und gut lesbare Farbscans bereit. Amazon prüft die Identität per Foto oder Videotermin. Über die Zulassung entscheidet die jeweilige Plattform." },
      ],
    },
    {
      typ: "text", id: "fiaon", h2: "Was FIAON Global dabei übernimmt",
      absaetze: [
        `${GRUENDUNG.satz} ${UNTERLAGEN.satz}`,
        "Wir halten Name, Anschrift und Telefonnummer Ihrer Gesellschaft in jeder Unterlage gleich.",
      ],
      punkte: [
        `${TEIL.ihrTeil}: ${UNTERLAGEN.ihrTeil} Bei den Plattformen melden Sie sich selbst an.`,
        `Geschäftskonto: ${satz("S2", "de")}`,
        `${TEIL.bedingung}: ${satz("S3", "de")} Über die Zulassung eines Händler- oder Zahlungskontos entscheidet die jeweilige Plattform.`,
      ],
    },
    { typ: "paket", id: "mandat", h2: P.karteH2, lead: P.karteLead, paket: "global_banking" },
    {
      typ: "hinweis", id: "wissen", h2: "Was Sie wissen müssen",
      punkte: [
        "Über Zulassung, Rücklagen und Einschränkungen entscheidet allein die jeweilige Plattform, auch bei vollständigen Unterlagen. Diese Seite gibt die Hilfeseiten der Plattformen wieder (Stand: Oktober 2026). Maßgeblich ist die Fassung zum Zeitpunkt Ihrer Anmeldung.",
        "Nicht Teil Ihres Mandats sind Konten bei Marktplätzen und Zahlungsdiensten, Registrierungen für die Sales Tax und die laufende Buchhaltung.",
        GLOBAL_AGENT.de.anschrift,
        satz("S8", "de"),
        GLOBAL_PFLICHTHINWEIS.de[0],
        GLOBAL_PFLICHTHINWEIS.de[1],
        GLOBAL_PFLICHTHINWEIS.de[2],
      ],
    },
  ],
  fragen: [
    { f: "Kann ich als Deutscher auf dem US-Marktplatz von Amazon verkaufen?", a: "Ja. Amazon nimmt Händler aus Europa auf dem US-Marktplatz auf. Eine US-Gesellschaft ist dafür nach Amazon nicht unbedingt nötig. Für die Anmeldung verlangt Amazon einen Ausweis wie den Reisepass, eine international belastbare Kreditkarte und ein Konto. Hinzu kommen ein Registrierungsnachweis, ein Adressnachweis aus den letzten 180 Tagen und die Steuerangaben. Danach folgt die Identitätsprüfung per Foto oder Videotermin. Über die Zulassung entscheidet Amazon." },
    { f: "Brauche ich für den Verkauf in den USA eine US-LLC?", a: `Nicht zwingend. Amazon nimmt Händler aus Europa auch ohne US-Gesellschaft auf. Die Erlöse zahlt Amazon über den Amazon Currency Converter auf ein Konto in Europa aus. Shopify Payments in den USA steht Einzelpersonen dagegen nur mit Wohnsitz in den USA offen. Eine LLC braucht dort EIN, US-Girokonto und eine US-Geschäftsanschrift. Führen Sie die LLC aus Deutschland, bleibt sie dort steuerpflichtig (§ 10 AO, § 1 KStG). ${satz("S10", "de")}` },
    { f: "Gibt meine US-LLC bei Amazon ein W-9 oder ein W-8BEN ab?", a: "Das hängt von der steuerlichen Einordnung der LLC ab. Gehört sie Ihnen allein und wohnen Sie im Ausland, geben Sie als Inhaber ein Formular W-8 ab. Das ist W-8BEN oder, bei Einkünften mit effektiver Verbindung zu einem US-Geschäft, W-8ECI. Das gilt auch, wenn Sie eine ITIN haben. Eine LLC mit mehreren Gesellschaftern oder mit Besteuerung als Corporation gibt selbst ein W-9 ab. Die Einordnung steht im EIN-Antrag. Ob Einkünfte effektiv verbunden sind, ist Sache eines US-Steuerberaters (CPA)." },
    { f: "Kann ich Stripe mit einer US-LLC ohne SSN nutzen?", a: `Stripe sieht dafür einen Weg vor. Haben Vertreter oder Eigentümer einer US-Gesellschaft weder SSN noch ITIN, erwartet Stripe die Steuernummer aus ihrem Wohnsitzland. Hinzu kommen Unterlagen, nach denen sie in den USA nicht steuerpflichtig sind. Stripe erfasst außerdem jede Person ab ${AB25} und eine Person mit maßgeblicher Kontrolle, jeweils mit Name, Geburtsdatum und Anschrift. Über das Konto entscheidet Stripe.` },
    { f: "Kann ich Shopify Payments mit einer US-LLC nutzen?", a: "Shopify verlangt dafür unter anderem ein vollwertiges US-Girokonto in US-Dollar mit ACH-Empfang. Hinzu kommen die physische Geschäftsanschrift in den USA, an der das Geschäft hauptsächlich betrieben wird, und der Name der Gesellschaft exakt wie in den IRS-Unterlagen. Vertreter ohne SSN oder ITIN mit Wohnsitz außerhalb der USA können ein Foto ihres gültigen Reisepasses einreichen. Einzelpersonen brauchen dagegen einen Wohnsitz in den USA. Über die Zulassung entscheidet Shopify." },
    { f: "Ab wann melden Plattformen meine Umsätze an die IRS?", a: "Die Schwelle für Form 1099-K liegt bei mehr als 20.000 $ in mehr als 200 Transaktionen im Jahr. Sie gilt für Zahlungen für Waren und Leistungen über Zahlungsplattformen und Marktplätze. Für Kartenzahlungen über einen Zahlungsabwickler gilt keine Mindestgrenze. Einzelne Bundesstaaten setzen niedrigere Schwellen. Wie die Meldungen zu Ihren Erklärungen passen, ist Sache eines US-Steuerberaters (CPA)." },
    { f: "Muss ich als Amazon Seller selbst Sales Tax abführen?", a: "Für Marktplatz-Verkäufe führt der Marktplatz die Sales Tax ab, wo der Bundesstaat es so regelt. In Florida bestätigt er den Händlern die Erhebung. Der Händler darf auf diese Verkäufe dann keine Sales Tax selbst erheben (§ 212.05965 Florida Statutes). Für den eigenen Shop gilt das nicht. Dort ist Ihre Gesellschaft ab der Schwelle eines Bundesstaats selbst zuständig. In Florida liegt sie bei mehr als 100.000 $ Fernverkäufen im Vorjahr außerhalb des Marktplatzes." },
    { f: "Warum schränken Stripe oder PayPal ein Konto ein?", a: "Die Plattformen nennen dafür mehrere Gründe. Dazu zählen Geschäfte auf der Liste eingeschränkter Branchen, viele Streitfälle und Rückbuchungen. Stripe stuft mehr als 0,75 Prozent Streitfälle als hohes Risiko ein. Weitere Gründe sind ein plötzlicher Umsatzanstieg, neue Produktarten und lange Lieferzeiten. Auch fehlende Angaben zählen dazu. Stripe kann Erlöse als Rücklage zurückhalten; PayPal kann das Konto einschränken, bis der Sachverhalt geklärt ist. Schließt Stripe ein Konto, nennt es den Grund per E-Mail und bietet darin eine erneute Prüfung an." },
  ],
  paket: "global_banking",
  weiter: ["/business/onlinehandel", "/business/wissen/us-adresse-und-telefon", "/business/wissen/us-bankkonto-unterlagen", "/business/wissen/us-llc-wohnsitz-deutschland"],
  quellen: [
    QUELLEN.amazonAnmeldung, QUELLEN.amazonEuropa, QUELLEN.amazonPreis,
    QUELLEN.stripeSteuernummer, QUELLEN.stripeEigentuemer, QUELLEN.stripeKyc, QUELLEN.stripeBranchen, QUELLEN.stripeRuecklage, QUELLEN.stripeRisiko, QUELLEN.stripeSchliessung,
    QUELLEN.paypal1099k, QUELLEN.paypalEinschraenkung, QUELLEN.paypalGeschaeft,
    QUELLEN.shopifyUsa,
    QUELLEN.w8ben, QUELLEN.w8eci, QUELLEN.w8bene, QUELLEN.w9, QUELLEN.f1099k,
    QUELLEN.fl21205965, QUELLEN.fl2120596, QUELLEN.wayfair,
    Q.cdd, Q.ss4, QUELLEN.ao10, QUELLEN.kstg1, Q.ao138,
  ],
};
