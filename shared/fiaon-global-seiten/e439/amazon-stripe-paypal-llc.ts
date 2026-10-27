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
import { GLOBAL_AGENT, GLOBAL_GELD_ZURUECK, GLOBAL_PFLICHTHINWEIS, GLOBAL_ROLLEN } from "../../fiaon-global";
import { QUELLEN_WISSEN as Q, SCHWELLEN } from "../fakten";

const S = "2026-10-27";
const GELD_ZURUECK = GLOBAL_GELD_ZURUECK.aktiv ? [`${GLOBAL_GELD_ZURUECK.de.text} ${GLOBAL_GELD_ZURUECK.de.bedingungen}`] : [];
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
  stand: S,
  erschienen: S,
  kennung: "FG · 49",
  auge: "Wissen · Plattformen",
  h1: "Amazon, Stripe, PayPal.",
  h1b: "Was die Plattformen bei Ihrer US-LLC prüfen.",
  lead: "Wer als Amazon Seller mit einer US LLC startet oder über Stripe, PayPal und Shopify Zahlungen annimmt, wird geprüft — gründlich und nicht nur einmal. Die Plattformen wollen wissen, wem die Gesellschaft gehört, unter welcher Steuernummer sie läuft und wohin die Erlöse gehen. Hier steht, was sie verlangen, welches Steuerformular Ihre LLC abgibt, wann die Sales Tax Sache des Marktplatzes ist und woran Konten hängen bleiben.",
  ziffern: [
    { wert: AB25, label: "ab diesem Anteil erfassen Stripe und Shopify jeden Eigentümer" },
    { wert: "180 Tage", label: "so jung muss der Adressnachweis für Amazon sein" },
    { wert: "20.000 $", label: "mehr als dieser Betrag in mehr als 200 Zahlungen: ab dann meldet die Plattform per Form 1099-K" },
  ],
  blick: [
    ["Wer geprüft wird", `Sie mit Ausweis; bei Stripe und Shopify jeder Eigentümer ab ${AB25}, bei Stripe dazu die lenkende Person`],
    ["Gesellschaft", "Registrierungsnachweis und EIN — Name exakt wie bei der IRS"],
    ["Konto", "Auf Ihren Namen oder den der Gesellschaft; Shopify Payments nur mit US-Girokonto"],
    ["Steuerformular", "Einpersonen-LLC, Inhaber im Ausland: W-8 des Inhabers; mehrere Gesellschafter: W-9 der LLC"],
    ["Sales Tax", "Auf dem Marktplatz führt sie, wo der Staat es so regelt, der Marktplatz ab — im eigenen Shop Ihre Gesellschaft, ab der Schwelle des Staats"],
    ["Wer entscheidet", "Allein die Plattform — über Zulassung, Rücklagen und Einschränkungen"],
    ["Mit FIAON Global", "Gesellschaft, EIN, Unterlagen und Stammdaten aus einem Guss"],
  ],
  kurz: `Als Amazon Seller mit US LLC — und ebenso bei Stripe, PayPal und Shopify — prüfen die Plattformen fünf Dinge: wer hinter der Gesellschaft steht (Stripe und Shopify erfassen jeden Eigentümer ab ${AB25}, Stripe dazu die lenkende Person), dass die Gesellschaft mit ihrer EIN besteht, wohin die Erlöse gehen, welches Steuerformular gilt und ob Anschriften und Nachweise zusammenpassen. Gehört die LLC allein einer Person im Ausland, gibt der Inhaber ein Formular W-8 ab, nicht die LLC ein W-9. Die Sales Tax auf Marktplatz-Verkäufe führt dort, wo der Staat es so regelt, der Marktplatz ab; für den eigenen Shop ist Ihre Gesellschaft zuständig, sobald sie die Schwelle eines Staats überschreitet.`,
  bloecke: [
    {
      typ: "text", id: "ueberblick", h2: "Amazon Seller US LLC: was alle Plattformen wissen wollen",
      absaetze: [
        "Marktplätze und Zahlungsdienste nehmen Zahlungen für ihre Händler an und leiten sie weiter. Damit tragen sie Pflichten gegenüber Aufsicht, Kartennetzen und Steuerbehörde. Stripe schreibt, seine Anforderungen kämen von den Aufsichtsbehörden und sollten den Missbrauch des Finanzsystems verhindern. Bei einer US-LLC mit Inhaber in Europa kommen zwei Welten zusammen: Die Gesellschaft ist amerikanisch, die Menschen dahinter sind es nicht — und beides muss in den Unterlagen zusammenpassen.",
        "Im Kern kreisen die Fragen aller Plattformen um dieselben fünf Dinge:",
      ],
      punkte: [
        `Wer hinter der Gesellschaft steht: Ihr Ausweis, dazu bei Stripe und Shopify Angaben zu jedem Eigentümer ab ${AB25} und bei Stripe zu der Person, die die Gesellschaft lenkt`,
        "Dass die Gesellschaft besteht: der Registrierungsnachweis des Bundesstaats und die EIN mit genau dem Namen, den die IRS führt",
        "Wohin die Erlöse gehen: ein Konto auf den Namen der Gesellschaft oder des Inhabers",
        "Wie die Gesellschaft steuerlich einzuordnen ist: Steuernummer und Steuerangaben, bei Amazon im Steuerinterview mit Formular W-8 oder W-9",
        "Wie die Gesellschaft erreichbar ist: Geschäftsanschrift, Wohnanschrift mit aktuellem Nachweis, Telefonnummer und E-Mail-Adresse",
      ],
      nach: "Ein Stolperstein ist oft kein fehlendes Dokument, sondern ein Widerspruch zwischen zweien: ein Name in anderer Schreibweise, eine Anschrift, die nicht zum Nachweis passt, ein Konto auf einen dritten Namen.",
    },
    {
      typ: "tabelle", id: "plattformen", h2: "Amazon, Stripe, PayPal und Shopify im Vergleich",
      lead: "Was die vier großen Plattformen nach ihren eigenen Hilfeseiten bei einer US-Gesellschaft abfragen.",
      kopf: ["Plattform", "Was sie prüft", "Worauf es ankommt"],
      zeilen: [
        ["Amazon (Verkäuferkonto USA)", "Ausweis, Telefon und E-Mail, international belastbare Kreditkarte, Konto mit Routingnummer, Registrierungsnachweis, Wohnadressnachweis, Steuerangaben; danach Identitätsprüfung per Foto oder Videotermin", "Anschrift wie im Registrierungsnachweis, Adressnachweis aus den letzten 180 Tagen, Konto auf Ihren Namen oder den der Gesellschaft"],
        ["Stripe", `Die Gesellschaft, jede Person ab ${AB25} und eine Person mit maßgeblicher Kontrolle: Name, Geburtsdatum, Anschrift`, "Ohne SSN oder ITIN: Steuernummer aus dem Wohnsitzland und Nachweis, dass keine US-Steuerpflicht besteht; Geschäft nicht auf der Liste verbotener Branchen, eingeschränkte Branchen nur nach zusätzlicher Prüfung"],
        ["PayPal Business", "Steuerangaben für die Meldung an die IRS; bei Prüfungen Geschäftsunterlagen wie Lieferantenangaben, Rechnungen und Kontoauszüge", "Vollständige Steuerangaben, ein Angebot im Rahmen der Nutzungsrichtlinie, eine nachvollziehbare Entwicklung der Umsätze"],
        ["Shopify Payments (USA)", `Name und EIN der Gesellschaft, physische Geschäftsanschrift in den USA, an der das Geschäft hauptsächlich betrieben wird, US-Girokonto in US-Dollar mit ACH-Empfang, jeder Eigentümer ab ${AB25}`, "Name exakt wie in den IRS-Unterlagen; Vertreter ohne SSN oder ITIN mit Wohnsitz außerhalb der USA weisen sich mit einem Foto ihres gültigen Reisepasses aus"],
      ],
      fuss: ["Nach den Hilfeseiten der Plattformen, Stand Oktober 2026. Jede Plattform legt ihre Anforderungen selbst fest und kann weitere Unterlagen verlangen."],
    },
    {
      typ: "text", id: "amazon", h2: "Die Anmeldung als Amazon Seller mit US-LLC",
      absaetze: [
        "Für den US-Marktplatz brauchen Unternehmen aus Europa nach Amazons eigener Darstellung nicht unbedingt eine US-Gesellschaft; ob eine sinnvoll ist, hängt nach Amazon von Ihrem Geschäft und Ihrer Verkaufsstrategie ab. Für die Anmeldung nennt Amazon: einen amtlichen Ausweis wie den Reisepass, Telefonnummer und E-Mail-Adresse, eine international belastbare Kreditkarte, Konto- und Routingnummer, einen Registrierungsnachweis des Unternehmens, einen Wohnadressnachweis aus den letzten 180 Tagen — etwa einen Konto- oder Kreditkartenauszug, aus Europa oder aus den USA — und die Steuerangaben. Als Geschäftsanschrift tragen Sie die Anschrift ein, die im Registrierungsnachweis steht.",
        "Danach folgt die Identitätsprüfung. Sie reichen Ausweis und Adressnachweis ein und machen entweder ein Foto von Gesicht und Ausweis oder führen einen Videotermin mit einem Amazon-Mitarbeiter, zu dem Sie Ausweis und Adressnachweis mitbringen. Amazon verlangt Farbscans oder Fotos in guter Qualität, auf denen alle vier Ecken zu sehen sind und der Text lesbar ist — keine Bildschirmfotos und keine unscharfen Aufnahmen.",
        "Zur Anmeldung gehört ein Steuerinterview, aus dem Amazon das passende Steuerformular für Sie erstellt — welches das ist, steht weiter unten. Ihre Erlöse vom US-Marktplatz gehen auf ein US-Konto oder, über den Amazon Currency Converter, auf ein Konto in Europa; das Konto muss auf Ihren Namen oder den Ihrer Gesellschaft lauten. Das Professional-Verkäuferkonto kostet 39,99 $ im Monat zuzüglich der Verkaufsgebühren.",
      ],
    },
    {
      typ: "text", id: "zahlungsdienste", h2: "Stripe, PayPal Business und Shopify mit der US-LLC",
      absaetze: [
        `Stripe erfasst bei Gesellschaften in den USA eine Person mit maßgeblicher Kontrolle und alle Personen, die mindestens ${AB25} halten — mit Name, Geburtsdatum, Anschrift und, bei US-Personen, der Sozialversicherungsnummer. Stripe beruft sich dafür auf das US-Recht zu wirtschaftlich Berechtigten — dieselbe Regel, nach der auch Banken ihre Firmenkunden prüfen (31 CFR 1010.230). Haben Vertreter oder Eigentümer weder SSN noch ITIN, erwartet Stripe die Steuernummer aus ihrem Wohnsitzland und Unterlagen, die bestätigen, dass sie in den USA nicht steuerpflichtig sind. Manche Branchen nimmt Stripe gar nicht oder nur nach zusätzlicher Prüfung an, weil Gesetze sowie Kartennetze und Partnerbanken es so verlangen; maßgeblich ist seine Liste eingeschränkter und verbotener Geschäfte.`,
        "PayPal Business fragt die Steuerangaben ab, die es für die Meldung an die IRS braucht. Bemerkt PayPal ein verändertes Verkaufsmuster oder mehr Käuferbeschwerden, kann es Unterlagen zum Geschäft anfordern — etwa Lieferantenangaben, Rechnungen und Kontoauszüge — und das Konto einschränken; dann lässt sich etwa kein Geld mehr senden oder abheben, bis die Schritte erledigt sind, die PayPal dafür nennt. Den Grund nennt PayPal per E-Mail und im Resolution Center des Kontos; eine E-Mail, zu der dort kein Eintrag steht, kann nach PayPal gefälscht sein.",
        `Shopify Payments steht in den USA Einzelpersonen und Einzelunternehmern nur mit Wohnsitz in den USA offen. Für eine LLC gilt: der Name exakt wie in den IRS-Unterlagen, bis zur Zeichensetzung und Groß- und Kleinschreibung; die EIN, notfalls belegt durch ein Schreiben der IRS (Bestätigung zum SS-4, Notice CP 575 oder Letter 147C); die physische Geschäftsanschrift in den USA, an der das Geschäft hauptsächlich betrieben wird, und ein vollwertiges Girokonto bei einer US-Bank in US-Dollar, das ACH-Überweisungen empfangen kann. Jeder Eigentümer ab ${AB25} wird angegeben. Vertreter mit Wohnsitz außerhalb der USA, die weder SSN noch ITIN haben, können stattdessen ein Foto ihres gültigen Reisepasses einreichen.`,
      ],
    },
    {
      typ: "tabelle", id: "formulare", h2: "W-9 oder W-8: welches Steuerformular Ihre LLC abgibt",
      lead: "Im Steuerinterview entscheidet sich, wie die Plattform Ihre Gesellschaft gegenüber der IRS führt. Maßgeblich ist, wie die LLC steuerlich eingeordnet ist — und wem sie gehört.",
      kopf: ["Ihre LLC", "Formular", "Wer es abgibt"],
      zeilen: [
        ["Einpersonen-LLC, Inhaber ist eine Person mit Wohnsitz im Ausland", "W-8BEN; bei Einkünften, die effektiv mit einem US-Geschäft verbunden sind, W-8ECI", "Der Inhaber, nicht die LLC — mit seinem Namen und seinen Angaben"],
        ["Einpersonen-LLC, Inhaberin ist eine Gesellschaft im Ausland, etwa eine GmbH", "W-8BEN-E; bei effektiv verbundenen Einkünften W-8ECI", "Die Inhaberin, nicht die LLC"],
        ["LLC mit mehreren Gesellschaftern (steuerlich eine Partnership)", "W-9", "Die LLC selbst, auch wenn ihre Gesellschafter im Ausland wohnen"],
        ["LLC, die als Corporation besteuert wird", "W-9", "Die LLC selbst"],
      ],
      fuss: [
        "Das Formular W-9 sagt ausdrücklich: Ist der Inhaber einer steuerlich transparenten Gesellschaft eine ausländische Person, gibt er ein Formular W-8 ab — auch dann, wenn er eine US-Steuernummer wie eine ITIN hat.",
        "Die Einordnung Ihrer LLC geben Sie schon im EIN-Antrag an (Zeile 9a des Formulars SS-4). Welche Einkünfte effektiv mit einem US-Geschäft verbunden sind, hängt dagegen an Ihrem Geschäft; das prüft ein US-CPA in Ihrem Mandat für Ihren Fall.",
      ],
    },
    {
      typ: "text", id: "meldungen", h2: "Form 1099-K und Einbehalt: was Plattformen an die IRS melden",
      absaetze: [
        "Zahlungsplattformen und Marktplätze melden Zahlungen für Waren und Leistungen auf Form 1099-K an die IRS, wenn sie im Jahr mehr als 20.000 $ in mehr als 200 Transaktionen betragen. PayPal nennt als Grundlage den One Big Beautiful Bill Act von 2025, der diese Schwelle wiederhergestellt hat. Für Kartenzahlungen über einen Zahlungsabwickler gibt es keine Mindestgrenze, und einzelne Bundesstaaten setzen niedrigere Schwellen.",
        "Deshalb fragen die Plattformen Steuernummer und Steuerformular ab und gleichen Name und Nummer ab; Shopify etwa kann ein Schreiben der IRS anfordern, wenn sich die EIN nicht bestätigen lässt. Fehlen die Angaben, kann ein Zahlungsdienst Zahlungen kürzen: PayPal hat bei Konten ohne Steuerangaben 24 Prozent einbehalten — den Satz des Backup Withholding, den auch das Formular W-9 nennt.",
        "Die US-Meldungen ersetzen nicht die Steuererklärung zu Hause. Führen Sie die LLC von Deutschland aus, liegt hier der Mittelpunkt ihrer geschäftlichen Oberleitung — ihre Geschäftsleitung im Sinne von § 10 AO; zu versteuern ist dann in Deutschland je nach Einordnung die Gesellschaft selbst (§ 1 KStG) oder ihr Gewinn bei Ihnen. Die Gründung oder Beteiligung melden Sie dem Finanzamt nach § 138 Abs. 2 AO, zusammen mit der Steuererklärung für das Jahr, in dem sie stattfand. Wie die Plattform-Umsätze zu Hause zu erklären sind, prüft unser Partner-Steuerberater vor der Gründung mit Ihnen.",
      ],
    },
    {
      typ: "text", id: "sales-tax", h2: "Sales Tax: was der Marktplatz übernimmt — und was beim eigenen Shop bleibt",
      absaetze: [
        "Die Sales Tax ist die Verkaufssteuer der Bundesstaaten. Seit der Entscheidung South Dakota v. Wayfair des Supreme Court vom 21. Juni 2018 dürfen Staaten sie auch von Händlern ohne Präsenz vor Ort verlangen. South Dakota knüpfte die Pflicht an Lieferungen in den Staat von mehr als 100.000 $ oder an mindestens 200 einzelne Geschäfte im Jahr; jeder Staat setzt eigene Schwellen.",
        "Für Verkäufe über Marktplätze haben die Staaten eigene Regeln geschaffen, im Englischen meist unter dem Begriff marketplace facilitator. Florida etwa: Der Marktplatz bestätigt seinen Händlern schriftlich, dass er die Sales Tax auf die über ihn abgewickelten Verkäufe erhebt und abführt — der Händler darf sie auf diese Verkäufe dann nicht selbst erheben und lässt sie aus seiner eigenen Erklärung heraus (§ 212.05965 Florida Statutes).",
        "Im eigenen Shop — mit Shopify, Stripe oder PayPal an der Kasse — gilt diese Entlastung nicht; Zahlungsabwickler sind nach dem Gesetz in Florida ausdrücklich keine Marktplätze. Dort ist Ihre Gesellschaft selbst zuständig, sobald sie die Schwelle eines Staats überschreitet; in Florida ist das bei steuerbaren Fernverkäufen von mehr als 100.000 $ im Vorjahr der Fall (§ 212.0596 Florida Statutes), und für diese Schwelle zählen nur die Verkäufe außerhalb des Marktplatzes (§ 212.05965 Abs. 4). Ob und wo sich Ihre Gesellschaft registrieren muss — auch, ob Ware in einem Lager, etwa beim Versand durch Amazon (FBA), dort eigene Pflichten auslöst —, prüft ein US-CPA für Ihren Fall.",
      ],
    },
    {
      typ: "karten", id: "sperren", h2: "Typische Sperrgründe — und was sie auslöst", spalten: 3,
      lead: "Was die Plattformen selbst als Gründe für Prüfungen, Rücklagen und Einschränkungen nennen.",
      karten: [
        { tag: "Stammdaten", titel: "Zwei Schreibweisen, zwei Anschriften", text: "Der Name im EIN-Schreiben weicht vom Gründungsdokument ab, die Anschrift im Antrag passt nicht zum Nachweis. Shopify verlangt den Namen exakt wie in den IRS-Unterlagen, Amazon die Anschrift wie im Registrierungsnachweis." },
        { tag: "Nachweis", titel: "Unlesbar oder zu alt", text: "Abgeschnittene Ecken, unscharfe Fotos, ein Adressnachweis älter als 180 Tage: Amazon verlangt gut lesbare Farbscans, auf denen alle vier Ecken zu sehen sind." },
        { tag: "Branche", titel: "Eingeschränkte Geschäfte", text: "Glücksspiel, Waffen, Schuldenregulierung und weitere Branchen nimmt Stripe nicht oder nur nach zusätzlicher Prüfung an; PayPal schränkt Konten bei Verstößen gegen seine Nutzungsrichtlinie ein." },
        { tag: "Streitfälle", titel: "Rückbuchungen und Beschwerden", text: "Stripe stuft Konten mit mehr als 0,75 Prozent Streitfällen als hohes Risiko ein; PayPal prüft Konten mit vielen Käuferbeschwerden und Rückbuchungen." },
        { tag: "Umsatz", titel: "Sprünge ohne Erklärung", text: "Ein plötzlicher Anstieg der Umsätze oder eine ganz neue Produktart kann bei PayPal zu einer Einschränkung führen; Stripe kann bei einem unerklärten starken Anstieg oder langen Lieferzeiten einen Teil der Erlöse als Rücklage zurückhalten." },
        { tag: "Steuer", titel: "Fehlende Steuerangaben", text: "Ohne bestätigte Steuernummer und passendes Steuerformular fehlt die Grundlage für die Meldung an die IRS. PayPal hat in solchen Fällen 24 Prozent der Zahlungen einbehalten." },
      ],
    },
    {
      typ: "etappen", id: "reihenfolge", h2: "In dieser Reihenfolge passt alles zusammen",
      lead: "Wer die Plattformen zuletzt anmeldet, hat bei der Anmeldung jede Antwort schon in der Hand.",
      etappen: [
        { titel: "Name und Gesellschaft festlegen", text: "Ein Name, der in Gründungsdokument, EIN-Schreiben, Konto und jeder Plattform Zeichen für Zeichen gleich lautet — bis zur Zeichensetzung." },
        { titel: "EIN beantragen", text: "Die EIN ist die Steuernummer der Gesellschaft. Das Schreiben der IRS (CP 575 oder Letter 147C) gehört in die Mappe; Shopify etwa kann es anfordern, wenn sich die Nummer nicht bestätigen lässt." },
        { titel: "Eigentümer dokumentieren", text: `Das Operating Agreement nennt jeden Gesellschafter mit seinem Anteil; zusammen ergeben sie 100 Prozent. Jeder ab ${AB25} wird bei Stripe und Shopify erfasst.` },
        { titel: "Konto auf den Namen der Gesellschaft", text: "Amazon zahlt nur auf ein Konto auf Ihren Namen oder den der Gesellschaft aus; Shopify Payments verlangt ein US-Girokonto in US-Dollar mit ACH-Empfang." },
        { titel: "Steuerformular klären", text: "Vor dem Steuerinterview steht fest, ob W-8BEN, W-8BEN-E, W-8ECI oder W-9 richtig ist — und wer es unterschreibt." },
        { titel: "Anschrift und Telefon festlegen", text: "Eine Geschäftsanschrift, die zu Ihren Nachweisen passt, und eine Telefonnummer, unter der Sie erreichbar sind — in jedem Antrag dieselben." },
        { titel: "Plattformen anmelden", text: "Erst jetzt die Anmeldung: mit Reisepass, Adressnachweis aus den letzten 180 Tagen, gut lesbaren Farbscans und der Bereitschaft zum Videotermin." },
      ],
    },
    {
      typ: "text", id: "fiaon", h2: "So übernimmt FIAON Global das Fundament für Ihre Plattformen",
      absaetze: [
        "FIAON Global ist eine Unternehmensberatung für Unternehmer aus Deutschland, Österreich und der Schweiz, die eine US-Gesellschaft aufbauen. Unser Grundsatz: ein Ansprechpartner statt acht. Mit Ihrer Vollmacht stellen wir alle Anträge für Sie — Gründung im Bundesstaat, EIN, die Vorbereitung der ITIN, D-U-N-S-Nummer und die erste jährliche US-Meldung — und stellen Registered Agent, US-Adresse und US-Telefonnummer für das erste Jahr. Konto-, Karten- und Kreditanträge stellen Sie selbst; wir bereiten jeden davon vollständig vor.",
        "Für die Plattformen heißt das konkret: Vor der Gründung legen wir mit Ihnen die Stammdaten fest — Name der Gesellschaft, Gesellschafter und Anteile, Geschäftsanschrift, Telefonnummer, Ansprechperson — und halten sie in jedem Dokument gleich. In Ihrem Dokumentenraum liegen Gründungsdokument, EIN-Schreiben und Operating Agreement geordnet bereit, wenn Amazon, Stripe, PayPal oder Shopify sie abfragen. Den Antrag für das Geschäftskonto der LLC bereiten wir vollständig vor, damit Ihre Erlöse auf ein Konto auf den Namen der Gesellschaft gehen können; über das Konto entscheidet das Institut. Die steuerliche Einordnung, aus der sich W-8 oder W-9 ergibt, steht mit dem EIN-Antrag fest, den wir für Sie stellen; wie Ihr Plattformgeschäft zu Hause zu behandeln ist, prüft unser Partner-Steuerberater vor der Gründung.",
        "Die Anmeldung bei den Plattformen nehmen Sie selbst vor, denn die Identitätsprüfung ist persönlich. Sie gehen mit einer vollständigen Mappe hinein und wissen vorher, welche Antwort wohin gehört. Mit Global Banking führen wir zudem einen Pflichtenkalender für Ihre US-Meldungen und Fristen und gehen jeden Monat mit Ihnen durch, was ansteht.",
        GLOBAL_ROLLEN.de.partner,
        "Sie zahlen einen Festpreis, der vor dem Auftrag feststeht, mit allen Gebühren des Pakets. Vertragspartner ist die FIAON LTD in London; unser Team vor Ort in Miami nimmt Termine mit Ihnen wahr, Zürich ist unser Partnerstandort. Ab dem zweiten Jahr können Sie die Jahresbetreuung wählen — freiwillig.",
        ...GELD_ZURUECK,
      ],
    },
    { typ: "paket", id: "paket", h2: "Das Fundament für den US-Handel im Paket", lead: "Gesellschaft, EIN, Registered Agent, US-Adresse und US-Telefon für das erste Jahr, der vollständig vorbereitete Kontoantrag, Pflichtenkalender für US-Meldungen und ein fester Ansprechpartner — Global Banking.", paket: "global_banking" },
    {
      typ: "hinweis", id: "wissen", h2: "Was Sie wissen müssen",
      punkte: [
        "Über Zulassung, Rücklagen und Einschränkungen entscheidet allein die jeweilige Plattform — auch bei vollständigen Unterlagen. Diese Seite gibt die Hilfeseiten der Plattformen mit Stand Oktober 2026 wieder; maßgeblich ist die Fassung zum Zeitpunkt Ihrer Anmeldung.",
        "Konten bei Marktplätzen und Zahlungsdiensten, Registrierungen für die Sales Tax und die laufende Buchhaltung sind nicht Teil der Pakete; wir nennen Ihnen Partner dafür.",
        GLOBAL_AGENT.de.anschrift,
        "FIAON ist keine Bank, vergibt keine Kredite, vermittelt keine Kredite und sagt keinen Rahmen zu. Über Konto, Karte, Rahmen und Darlehen entscheidet allein das jeweilige Institut.",
        GLOBAL_PFLICHTHINWEIS.de[0],
        GLOBAL_PFLICHTHINWEIS.de[1],
        GLOBAL_PFLICHTHINWEIS.de[2],
      ],
    },
  ],
  fragen: [
    { f: "Kann ich als Deutscher auf dem US-Marktplatz von Amazon verkaufen?", a: "Ja, Amazon nimmt Verkäufer aus Europa auf dem US-Marktplatz auf; eine US-Gesellschaft ist dafür nach Amazon nicht unbedingt nötig. Für die Anmeldung braucht es einen Ausweis wie den Reisepass, eine international belastbare Kreditkarte, ein Konto, einen Registrierungsnachweis, einen Adressnachweis aus den letzten 180 Tagen und die Steuerangaben; danach folgt die Identitätsprüfung per Foto oder Videotermin. Über die Zulassung entscheidet Amazon." },
    { f: "Brauche ich für den Verkauf in den USA überhaupt eine US-LLC?", a: "Nicht zwingend. Amazon nimmt Verkäufer aus Europa auch ohne US-Gesellschaft auf und zahlt über den Amazon Currency Converter auf ein Konto in Europa aus. Shopify Payments in den USA steht Einzelpersonen dagegen nur mit Wohnsitz in den USA offen; eine LLC braucht dort EIN, US-Girokonto und eine US-Geschäftsanschrift. Wird die LLC aus Deutschland geführt, bleibt sie hier steuerpflichtig (§ 10 AO, § 1 KStG) — sie ist kein Steuermodell." },
    { f: "Gibt meine US-LLC bei Amazon ein W-9 oder ein W-8BEN ab?", a: "Das hängt an der Einordnung der LLC. Gehört sie Ihnen allein, geben Sie als Inhaber ein Formular W-8 ab — W-8BEN oder, bei Einkünften, die effektiv mit einem US-Geschäft verbunden sind, W-8ECI —, auch wenn Sie eine ITIN haben. Eine LLC mit mehreren Gesellschaftern oder mit Besteuerung als Corporation gibt selbst ein W-9 ab. Die Einordnung steht im EIN-Antrag; ob Einkünfte effektiv verbunden sind, klärt ein US-CPA in Ihrem Mandat." },
    { f: "Kann ich Stripe mit einer US-LLC ohne SSN nutzen?", a: `Stripe sieht dafür einen Weg vor: Haben Vertreter oder Eigentümer einer US-Gesellschaft weder SSN noch ITIN, erwartet Stripe die Steuernummer aus ihrem Wohnsitzland und Unterlagen, die zeigen, dass sie in den USA nicht steuerpflichtig sind. Daneben erfasst Stripe jede Person ab ${AB25} und eine Person mit maßgeblicher Kontrolle mit Name, Geburtsdatum und Anschrift. Über das Konto entscheidet Stripe.` },
    { f: "Kann ich Shopify Payments mit einer US-LLC nutzen?", a: "Shopify nennt dafür ein vollwertiges US-Girokonto in US-Dollar mit ACH-Empfang, die physische Geschäftsanschrift in den USA, an der das Geschäft hauptsächlich betrieben wird, und den Namen der Gesellschaft exakt wie in den IRS-Unterlagen. Vertreter ohne SSN oder ITIN mit Wohnsitz außerhalb der USA können ein Foto ihres gültigen Reisepasses einreichen. Einzelpersonen brauchen dagegen einen Wohnsitz in den USA. Über die Zulassung entscheidet Shopify." },
    { f: "Ab wann melden Plattformen meine Umsätze an die IRS?", a: "Zahlungsplattformen und Marktplätze stellen Form 1099-K aus, wenn die Zahlungen für Waren und Leistungen im Jahr mehr als 20.000 $ in mehr als 200 Transaktionen betragen. Für Kartenzahlungen über einen Zahlungsabwickler gibt es keine Mindestgrenze, und einzelne Bundesstaaten setzen niedrigere Schwellen. Wie die Meldungen zu Ihren Erklärungen passen, klärt der US-CPA." },
    { f: "Muss ich als Amazon Seller selbst Sales Tax abführen?", a: "Für Marktplatz-Verkäufe übernimmt das, wo der Staat es so regelt, der Marktplatz. In Florida bestätigt er den Händlern die Erhebung, und der Händler darf auf diese Verkäufe keine Sales Tax selbst erheben (§ 212.05965 Florida Statutes). Für den eigenen Shop gilt das nicht: Dort wird Ihre Gesellschaft ab der Schwelle eines Staats selbst zuständig, in Florida bei mehr als 100.000 $ Fernverkäufen im Vorjahr außerhalb des Marktplatzes." },
    { f: "Warum schränken Stripe oder PayPal ein Konto ein?", a: "Die Plattformen nennen selbst: Geschäfte auf der Liste eingeschränkter Branchen, viele Streitfälle und Rückbuchungen — Stripe stuft mehr als 0,75 Prozent Streitfälle als hohes Risiko ein —, plötzliche Umsatzsprünge, neue Produktarten, lange Lieferzeiten und fehlende Angaben. Stripe kann Erlöse als Rücklage halten, PayPal das Konto bis zur Klärung einschränken. Schließt Stripe ein Konto, nennt es den Grund per E-Mail und bietet darin eine erneute Prüfung an." },
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
