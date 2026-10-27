// ═══════════════════════════════════════════════════════════════════════════
// FIAON GLOBAL — KNOWLEDGE: AMAZON, STRIPE AND PAYPAL WITH A US LLC (27.10.2026, E-439, FG · 49)
//
// Die englische Schwester von ../../e439/amazon-stripe-paypal-llc.ts — für Onlinehändler,
// Agenturen und Software: was Marktplätze und Zahlungsdienste bei einer US-LLC mit Inhaber
// in Europa prüfen, welches Steuerformular die LLC abgibt, wann die Sales Tax Sache des
// Marktplatzes ist, was an die IRS gemeldet wird und woran Konten hängen bleiben.
// Hauptsuchwort EN „Amazon seller US LLC non-resident“ (Titel, H1, Lead, Kurz, erster Absatz,
// H2 des ersten Bausteins); Recherche .arbeit/recherche/kw_en.md, Abschnitte 4 und 5.5.
//
// Britisches Englisch, inhaltlich identisch: dieselben Bausteine in derselben Reihenfolge,
// dieselben ids, gleich viele Absätze, Punkte, Zeilen, Spalten, Etappen, Karten, Fragen,
// Blick-Zeilen und Kennziffern; Quellen mit denselben Adressen in derselben Reihenfolge
// (englische Titel). Die Eigentümerschwelle kommt aus fakten-en.ts (SCHWELLEN_EN), die
// übrigen Zahlen wie in der deutschen Fach- und Rechtsprüfung vom 27.10.2026:
// Amazon (Adressnachweis 180 Tage, Professional-Konto 39,99 $), IRS Form 1099-K (mehr als
// 20.000 $ in mehr als 200 Transaktionen), 24 % Backup Withholding (fw9.pdf, Rev. 3-2024),
// Stripe (mehr als 0,75 % Streitfälle = hohes Risiko), Florida Statutes 2026 § 212.05965
// und § 212.0596 (100.000 $), South Dakota v. Wayfair (21.06.2018), § 10 AO, § 1 KStG,
// § 138 Abs. 2 AO. Bewusst weggelassen wie im Deutschen (siehe dort).
//
// Kein Kapital-Thema → GLOBAL_KAPITAL_FREI wie im Deutschen nicht verwendet (gleiche Zahl
// der Absätze); Geld-zurück nur mit seinen Bedingungen. „business consultancy“ als
// Selbstbezeichnung seit E-439 (Justin, 27.10.2026).
//
// Wortwand EN: kein „up to“, kein Bankname, keine Frist mit Ziffer als Zusage, kein
// „recommend“, „advice“ nur verneint, keine Konto- oder Kartenzusage; Marktplatz-Konten,
// Sales-Tax-Registrierungen und Buchhaltung sind NICHT Teil der Pakete; die Agent-Anschrift
// ist keine Händleradresse (GLOBAL_AGENT.en.anschrift). PayPal-Begriff „Resolution Centre“
// und „Fulfilment by Amazon“ in der britischen Schreibung der UK-Seiten beider Anbieter;
// „checking account“ bleibt als Begriff für das US-Konto (so bei Shopify).
//
// Gleichlauf- und Sprachprüfung 27.10.2026 (gegen die deutsche Fassung, Satz für Satz):
// · „master data“ → „core details“ (Germanismus „Stammdaten“, wie in den Schwestern der Runde).
// · „aus einem Guss“ war „from a single source“ (falscher Sinn) → „all of a piece“.
// · PayPal „nachvollziehbare Entwicklung der Umsätze“ → „a sales trend that can be explained“.
// · H1 als Dreiklang wie im Deutschen („Amazon seller, US LLC, non-resident.“), Suchwort in
//   Kurz und erstem Absatz als natürlicher Satz statt als Wortkette.
// · Passiv- und Germanismus-Sätze geglättet (Identitätsprüfung, Steuerinterview, Sales Tax,
//   Florida, Etappen, FIAON-Absätze, Fragen); Zahlen, Quellen, Aussagen unverändert.
// ═══════════════════════════════════════════════════════════════════════════
import type { GlobalQuelle, GlobalSeite } from "../../typen";
import { GLOBAL_AGENT, GLOBAL_GELD_ZURUECK, GLOBAL_PFLICHTHINWEIS, GLOBAL_ROLLEN } from "../../../fiaon-global";
import { QUELLEN_RECHT_EN as R, QUELLEN_WISSEN_EN as Q, SCHWELLEN_EN } from "../../fakten-en";

const S = "2026-10-27";
const GELD_ZURUECK = GLOBAL_GELD_ZURUECK.aktiv ? [`${GLOBAL_GELD_ZURUECK.en.text} ${GLOBAL_GELD_ZURUECK.en.bedingungen}`] : [];
/** „25 per cent“ — die Eigentümerschwelle steht in fakten-en.ts. */
const AB25 = SCHWELLEN_EN.eigentuemer;

/** Quellen dieses Beitrags — dieselben Adressen wie in der deutschen Fassung, englische Titel. */
const QUELLEN: Record<string, GlobalQuelle> = {
  amazonAnmeldung: { titel: "Amazon — Seller registration guide (documents, steps, identity verification)", url: "https://sell.amazon.com/sell/registration-guide" },
  amazonEuropa: { titel: "Amazon — How to sell on Amazon USA from Europe", url: "https://sell.amazon.com/global-selling/europe-to-usa" },
  amazonPreis: { titel: "Amazon — Sell on Amazon (Professional seller account)", url: "https://sell.amazon.com/sell" },
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
  shopifyUsa: { titel: "Shopify — Shopify Payments requirements in the United States", url: "https://help.shopify.com/en/manual/payments/shopify-payments/supported-countries/united-states/requirements" },
  w8ben: { titel: "IRS — Instructions for Form W-8BEN", url: "https://www.irs.gov/instructions/iw8ben" },
  w8eci: { titel: "IRS — Instructions for Form W-8ECI", url: "https://www.irs.gov/instructions/iw8eci" },
  w8bene: { titel: "IRS — About Form W-8BEN-E", url: "https://www.irs.gov/forms-pubs/about-form-w-8-ben-e" },
  w9: { titel: "IRS — Form W-9 (Rev. March 2024) with instructions", url: "https://www.irs.gov/pub/irs-pdf/fw9.pdf" },
  f1099k: { titel: "IRS — Understanding your Form 1099-K", url: "https://www.irs.gov/businesses/understanding-your-form-1099-k" },
  fl21205965: { titel: "Florida Statutes 2026, § 212.05965 — marketplace providers and marketplace sellers", url: "https://www.flsenate.gov/Laws/Statutes/2026/212.05965" },
  fl2120596: { titel: "Florida Statutes 2026, § 212.0596 — taxation of remote sales", url: "https://www.flsenate.gov/Laws/Statutes/2026/212.0596" },
  wayfair: { titel: "Supreme Court of the United States — South Dakota v. Wayfair, Inc. (21 June 2018)", url: "https://www.law.cornell.edu/supremecourt/text/17-494" },
  ao10: R.ao10,
  kstg1: R.kstg1,
};

export const SEITE: GlobalSeite = {
  pfad: "/en/business/knowledge/amazon-stripe-paypal-us-llc",
  sprache: "en",
  schwester: "/business/wissen/amazon-stripe-paypal-llc",
  art: "wissen",
  seo: {
    titel: "Amazon seller US LLC non-resident: checks — FIAON Global",
    beschreibung: "Amazon seller US LLC as a non-resident: what Amazon, Stripe, PayPal and Shopify check — ID, EIN, account, W-8 or W-9, sales tax and common restrictions.",
  },
  stand: S,
  erschienen: S,
  kennung: "FG · 49",
  auge: "Knowledge · Platforms",
  h1: "Amazon seller, US LLC, non-resident.",
  h1b: "What Amazon, Stripe and PayPal check for your US LLC.",
  lead: "Anyone who starts out as an Amazon seller with a US LLC as a non-resident, or takes payments through Stripe, PayPal or Shopify, will be checked — thoroughly, and not just once. The platforms want to know who owns the company, which tax number it operates under and where the proceeds go. This page sets out what they require, which tax form your LLC submits, when sales tax is the marketplace’s responsibility and where accounts typically get held up.",
  ziffern: [
    { wert: AB25, label: "the ownership share from which Stripe and Shopify record every owner" },
    { wert: "180 days", label: "the maximum age of the proof of address Amazon accepts" },
    { wert: "$20,000", label: "more than this across more than 200 payments, and the platform reports on Form 1099-K" },
  ],
  blick: [
    ["Who is checked", `You, with your ID; at Stripe and Shopify every owner holding ${AB25} or more, at Stripe also the person who controls the company`],
    ["Company", "Proof of registration and EIN — the name exactly as the IRS has it on record"],
    ["Account", "In your name or the company’s; Shopify Payments only with a US checking account"],
    ["Tax form", "Single-member LLC, owner abroad: the owner’s W-8; several members: the LLC’s W-9"],
    ["Sales tax", "On the marketplace, the marketplace remits it where the state so provides — in your own shop, your company does, once it passes the state’s threshold"],
    ["Who decides", "The platform alone — on approval, reserves and restrictions"],
    ["With FIAON Global", "Company, EIN, documents and core details — all of a piece"],
  ],
  kurz: `For an Amazon seller with a US LLC and a non-resident owner — and equally at Stripe, PayPal and Shopify — the platforms check five things: who stands behind the company (Stripe and Shopify record every owner holding ${AB25} or more, Stripe also the controlling person), that the company exists with its EIN, where the proceeds go, which tax form applies and whether addresses and documents match. If the LLC belongs solely to one person abroad, the owner submits a Form W-8; the LLC does not submit a W-9. On marketplace sales, the marketplace remits sales tax where the state so provides; for your own shop, your company is responsible once it exceeds a state’s threshold.`,
  bloecke: [
    {
      typ: "text", id: "ueberblick", h2: "Amazon seller, US LLC, non-resident owner: what every platform wants to know",
      absaetze: [
        "Marketplaces and payment services accept payments on behalf of their sellers and pass them on. That gives them obligations towards regulators, card networks and the tax authorities. Stripe states that its requirements come from regulators and are meant to prevent abuse of the financial system. For an Amazon seller with a US LLC and a non-resident owner in Europe, two worlds meet: the company is American, the people behind it are not — and the documents have to make the two fit together.",
        "At heart, every platform’s questions revolve around the same five things:",
      ],
      punkte: [
        `Who stands behind the company: your ID, plus at Stripe and Shopify details of every owner holding ${AB25} or more, and at Stripe of the person who controls the company`,
        "That the company exists: the state’s proof of registration and the EIN, under exactly the name the IRS has on record",
        "Where the proceeds go: an account in the name of the company or of the owner",
        "How the company is classified for tax purposes: tax number and tax details — at Amazon, in the tax interview with Form W-8 or W-9",
        "How the company can be reached: business address, residential address with recent proof, phone number and email address",
      ],
      nach: "Often the stumbling block is not a missing document but a contradiction between two: a name spelt differently, an address that does not match the proof, an account in a third party’s name.",
    },
    {
      typ: "tabelle", id: "plattformen", h2: "Amazon, Stripe, PayPal and Shopify compared",
      lead: "What the four major platforms ask of a US company, according to their own help pages.",
      kopf: ["Platform", "What it checks", "What matters"],
      zeilen: [
        ["Amazon (US seller account)", "ID, phone and email, an internationally chargeable credit card, a bank account with routing number, proof of business registration, proof of residential address, tax details; then identity verification by photo or video call", "Address as in the proof of registration, proof of address from the last 180 days, account in your name or the company’s"],
        ["Stripe", `The company, every person holding ${AB25} or more and one person with significant control: name, date of birth, address`, "Without an SSN or ITIN: a tax number from the country of residence and proof that there is no US tax liability; the business must not be on the list of prohibited businesses, and restricted businesses are accepted only after additional review"],
        ["PayPal Business", "Tax details for reporting to the IRS; during reviews, business documents such as supplier details, invoices and bank statements", "Complete tax details, products and services within the Acceptable Use Policy, a sales trend that can be explained"],
        ["Shopify Payments (US)", `Name and EIN of the company, a physical business address in the US where the business operations primarily take place, a US checking account in US dollars that can receive ACH transfers, every owner holding ${AB25} or more`, "Name exactly as in the IRS records; representatives without an SSN or ITIN who live outside the US verify their identity with a photograph of their valid passport"],
      ],
      fuss: ["Based on the platforms’ help pages, as of October 2026. Each platform sets its own requirements and may ask for further documents."],
    },
    {
      typ: "text", id: "amazon", h2: "Registering as an Amazon seller with a US LLC",
      absaetze: [
        "By Amazon’s own account, businesses from Europe do not necessarily need a US company to sell on the US marketplace; whether one makes sense, Amazon says, depends on your business and your sales strategy. For registration, Amazon lists: a government-issued ID such as a passport, a phone number and email address, an internationally chargeable credit card, bank account and routing numbers, proof of business registration, proof of residential address from the last 180 days — such as a bank or credit card statement, from Europe or from the US — and your tax details. As the business address, you enter the address shown in the proof of registration.",
        "Identity verification comes next. You submit your ID and proof of address and then either take a photo of your face together with your ID or join a video call with an Amazon employee, bringing your ID and proof of address with you. Amazon requires colour scans or good-quality photos in which all four corners are visible and the text is legible — no screenshots and no blurred images.",
        "Registration includes a tax interview, from which Amazon generates the appropriate tax form for you — which form that is, we explain below. Your proceeds from the US marketplace go to a US account or, via the Amazon Currency Converter, to an account in Europe; the account must be in your name or your company’s. The Professional seller account costs $39.99 a month plus selling fees.",
      ],
    },
    {
      typ: "text", id: "zahlungsdienste", h2: "Stripe, PayPal Business and Shopify with a US LLC",
      absaetze: [
        `For companies in the US, Stripe records one person with significant control and everyone who holds at least ${AB25} — with name, date of birth, address and, for US persons, their Social Security number. Stripe bases this on US beneficial ownership law — the same rule under which banks verify their business customers (31 CFR 1010.230). If representatives or owners have neither an SSN nor an ITIN, Stripe expects a tax number from their country of residence and documents confirming that they are not liable to tax in the US. Some industries Stripe does not accept at all, or only after additional review, because the law, the card networks and its partner banks require this; what counts is its list of restricted and prohibited businesses.`,
        "PayPal Business asks for the tax details it needs for reporting to the IRS. If PayPal notices a change in selling patterns or an increase in buyer complaints, it may request documents about the business — such as supplier details, invoices and bank statements — and limit the account; you may then, for example, no longer be able to send or withdraw money until you have completed the steps PayPal sets out. PayPal gives the reason by email and in the account’s Resolution Centre; according to PayPal, an email with no matching entry there may not be genuine.",
        `In the US, Shopify Payments is open to individuals and sole proprietors only if they reside in the US. For an LLC, the requirements are: the name exactly as in the IRS records, down to punctuation and capitalisation; the EIN, evidenced where necessary by an IRS letter (SS-4 confirmation, Notice CP 575 or Letter 147C); the physical business address in the US where the business operations primarily take place; and a full checking account with a US bank, in US dollars, that can receive ACH transfers. Every owner holding ${AB25} or more must be listed. Representatives who live outside the US and have neither an SSN nor an ITIN can instead submit a photograph of their valid passport.`,
      ],
    },
    {
      typ: "tabelle", id: "formulare", h2: "W-9 or W-8: which tax form your LLC submits",
      lead: "The tax interview determines how the platform treats your company for IRS purposes. What counts is how the LLC is classified for tax purposes — and who owns it.",
      kopf: ["Your LLC", "Form", "Who submits it"],
      zeilen: [
        ["Single-member LLC whose owner is an individual resident abroad", "W-8BEN; for income effectively connected with a US trade or business, W-8ECI", "The owner, not the LLC — with their own name and details"],
        ["Single-member LLC whose owner is a company abroad, such as a GmbH", "W-8BEN-E; for effectively connected income, W-8ECI", "The owner, not the LLC"],
        ["LLC with several members (a partnership for tax purposes)", "W-9", "The LLC itself, even if its members live abroad"],
        ["LLC taxed as a corporation", "W-9", "The LLC itself"],
      ],
      fuss: [
        "Form W-9 says so expressly: if the owner of a disregarded entity is a foreign person, the owner submits a Form W-8 — even if they hold a US tax number such as an ITIN.",
        "You already state your LLC’s classification in the EIN application (line 9a of Form SS-4). Which income is effectively connected with a US trade or business, on the other hand, depends on your business; a US CPA acting under your engagement reviews this for your case.",
      ],
    },
    {
      typ: "text", id: "meldungen", h2: "Form 1099-K and withholding: what platforms report to the IRS",
      absaetze: [
        "Payment platforms and marketplaces report payments for goods and services to the IRS on Form 1099-K if, in a year, they total more than $20,000 across more than 200 transactions. PayPal cites as the basis the One Big Beautiful Bill Act of 2025, which restored this threshold. For card payments through a payment processor there is no minimum, and some states set lower thresholds.",
        "That is why the platforms ask for your tax number and tax form and check that name and number match; Shopify, for example, may request an IRS letter if the EIN cannot be confirmed. If the details are missing, a payment service can withhold part of each payment: PayPal has withheld 24 per cent on accounts without tax details — the backup withholding rate that Form W-9 also states.",
        "US reporting does not replace your tax return at home. If you manage the LLC from Germany, the centre of its top-level commercial management lies there — its place of management within the meaning of section 10 of the German Fiscal Code (AO); depending on the classification, Germany then taxes either the company itself (section 1 of the German Corporate Income Tax Act, KStG) or its profit in your hands. You notify the tax office (Finanzamt) of the formation or the participation under section 138(2) AO, together with the tax return for the year in which it took place. How the platform revenue is to be declared at home is reviewed with you by our partner tax adviser before formation.",
      ],
    },
    {
      typ: "text", id: "sales-tax", h2: "Sales tax: what the marketplace takes on — and what stays with your own shop",
      absaetze: [
        "Sales tax is the tax the US states levy on sales. Since the Supreme Court’s decision in South Dakota v. Wayfair of 21 June 2018, states may also require it from sellers with no physical presence in the state. South Dakota tied the obligation to deliveries into the state worth more than $100,000, or to at least 200 separate transactions, a year; each state sets its own thresholds.",
        "For sales through marketplaces, the states have created rules of their own, usually known as marketplace facilitator rules. Take Florida: the marketplace confirms to its sellers in writing that it collects and remits sales tax on the sales made through it — the seller may then not collect tax on those sales itself and leaves them out of its own return (section 212.05965 of the Florida Statutes).",
        "In your own shop — with Shopify, Stripe or PayPal at the checkout — this relief does not apply; under Florida law, payment processors are expressly not marketplaces. There, your company itself is responsible as soon as it exceeds a state’s threshold; in Florida, that is the case with taxable remote sales of more than $100,000 in the previous calendar year (section 212.0596 of the Florida Statutes), and only sales outside the marketplace count towards this threshold (section 212.05965(4)). A US CPA reviews for your case whether and where your company has to register — including whether goods held in a warehouse, for example under Fulfilment by Amazon (FBA), create obligations of their own in that state.",
      ],
    },
    {
      typ: "karten", id: "sperren", h2: "Typical reasons for restrictions — and what triggers them", spalten: 3,
      lead: "What the platforms themselves name as reasons for reviews, reserves and restrictions.",
      karten: [
        { tag: "Core details", titel: "Two spellings, two addresses", text: "The name on the EIN letter differs from the one in the formation document; the address in the application does not match the proof. Shopify requires the name exactly as in the IRS records, Amazon the address as in the proof of registration." },
        { tag: "Proof", titel: "Illegible or too old", text: "Cut-off corners, blurred photos, a proof of address older than 180 days: Amazon requires legible colour scans in which all four corners are visible." },
        { tag: "Industry", titel: "Restricted businesses", text: "Stripe does not accept gambling, weapons, debt relief and other industries, or accepts them only after additional review; PayPal limits accounts for breaches of its Acceptable Use Policy." },
        { tag: "Disputes", titel: "Chargebacks and complaints", text: "Stripe classifies accounts with a dispute rate above 0.75 per cent as high risk; PayPal reviews accounts with many buyer complaints and chargebacks." },
        { tag: "Revenue", titel: "Unexplained jumps", text: "A sudden rise in sales or an entirely new type of product can lead PayPal to limit an account; Stripe may hold back part of the proceeds as a reserve if volume rises sharply without explanation or delivery times are long." },
        { tag: "Tax", titel: "Missing tax details", text: "Without a confirmed tax number and a matching tax form, there is no basis for reporting to the IRS. PayPal has withheld 24 per cent of payments in such cases." },
      ],
    },
    {
      typ: "etappen", id: "reihenfolge", h2: "In this order, everything fits together",
      lead: "If you register with the platforms last, you already have every answer to hand when you sign up.",
      etappen: [
        { titel: "Settle the name and the company", text: "A name that reads identically, character for character, in the formation document, the EIN letter, the account and on every platform — down to the punctuation." },
        { titel: "Apply for the EIN", text: "The EIN is the company’s tax number. The IRS letter (CP 575 or Letter 147C) belongs in the file; Shopify, for example, may ask for it if the number cannot be confirmed." },
        { titel: "Document the owners", text: `The operating agreement names every member with their share; together the shares total 100 per cent. Everyone holding ${AB25} or more is recorded by Stripe and Shopify.` },
        { titel: "Account in the company’s name", text: "Amazon pays out only to an account in your name or the company’s; Shopify Payments requires a US checking account in US dollars that can receive ACH transfers." },
        { titel: "Settle the tax form", text: "Before the tax interview, it is clear whether W-8BEN, W-8BEN-E, W-8ECI or W-9 is correct — and who signs it." },
        { titel: "Settle address and phone", text: "A business address that matches your supporting documents and a phone number on which you can be reached — the same in every application." },
        { titel: "Register with the platforms", text: "Only now do you register — with your passport, a proof of address from the last 180 days and legible colour scans, and ready for a video call." },
      ],
    },
    {
      typ: "text", id: "fiaon", h2: "How FIAON Global lays the foundation for your platforms",
      absaetze: [
        "FIAON Global is a business consultancy for entrepreneurs from Germany, Austria and Switzerland who are building a US company. Our principle: one contact instead of eight. With your power of attorney, we submit every application on your behalf — formation in the state, EIN, preparation of the ITIN, D-U-N-S number and the first annual US filing — and provide the registered agent, US address and US phone number for the first year. You make account, card and credit applications yourself; we prepare each of them in full.",
        "In concrete terms, for the platforms this means: before formation, we settle the core details with you — company name, members and shares, business address, phone number, contact person — and keep them identical in every document. In your document room, the formation document, EIN letter and operating agreement are filed and ready for when Amazon, Stripe, PayPal or Shopify asks for them. We prepare the application for the LLC’s business account in full so that your proceeds can go to an account in the company’s name; the institution decides on the account. The tax classification, which determines W-8 or W-9, is set in the EIN application we file for you; how your platform business is to be treated at home is reviewed by our partner tax adviser before formation.",
        "You register with the platforms yourself, because identity verification is personal. You go in with a complete file and know beforehand which answer belongs where. With Global Banking, we also keep a compliance calendar for your US filings and deadlines and go through what is coming up with you every month.",
        GLOBAL_ROLLEN.en.partner,
        "You pay a fixed price, agreed before the engagement begins, with all of the package’s fees included. The contracting party is FIAON LTD in London; our team on the ground in Miami attends appointments with you, and Zurich is our partner location. From the second year, you can choose the annual care plan — on a voluntary basis.",
        ...GELD_ZURUECK,
      ],
    },
    { typ: "paket", id: "paket", h2: "The foundation for US trade in one package", lead: "Company, EIN, registered agent, US address and US phone for the first year, the fully prepared account application, a compliance calendar for US filings and a dedicated contact — Global Banking.", paket: "global_banking" },
    {
      typ: "hinweis", id: "wissen", h2: "What you need to know",
      punkte: [
        "Each platform alone decides on approval, reserves and restrictions — even where the documents are complete. This page reflects the platforms’ help pages as of October 2026; what counts is the version in force at the time of your registration.",
        "Accounts with marketplaces and payment services, sales tax registrations and ongoing bookkeeping are not part of the packages; we can name partners for these.",
        GLOBAL_AGENT.en.anschrift,
        "FIAON is not a bank, does not grant loans, does not arrange loans and does not commit to any limit. The institution concerned alone decides on the account, card, limit and loan.",
        GLOBAL_PFLICHTHINWEIS.en[0],
        GLOBAL_PFLICHTHINWEIS.en[1],
        GLOBAL_PFLICHTHINWEIS.en[2],
      ],
    },
  ],
  fragen: [
    { f: "Can I sell on Amazon’s US marketplace as a non-resident from Germany?", a: "Yes, Amazon accepts sellers from Europe on its US marketplace; according to Amazon, a US company is not necessarily required for this. Registration requires an ID such as a passport, an internationally chargeable credit card, a bank account, proof of business registration, proof of address from the last 180 days and your tax details; identity verification by photo or video call follows. Amazon decides on approval." },
    { f: "Do I need a US LLC at all to sell in the US?", a: "Not necessarily. Amazon also accepts sellers from Europe without a US company and pays out via the Amazon Currency Converter to an account in Europe. Shopify Payments in the US, by contrast, is open to individuals only if they reside in the US; an LLC there needs an EIN, a US checking account and a US business address. If the LLC is managed from Germany, it remains taxable there (section 10 AO, section 1 KStG) — it is not a tax model." },
    { f: "Does my US LLC give Amazon a W-9 or a W-8BEN?", a: "That depends on the LLC’s classification. If you own it alone, you as the owner submit a Form W-8 — W-8BEN or, for income effectively connected with a US trade or business, W-8ECI — even if you have an ITIN. An LLC with several members, or one taxed as a corporation, submits a W-9 itself. The classification is stated in the EIN application; whether income is effectively connected is for a US CPA acting under your engagement to clarify." },
    { f: "Can I use Stripe with a US LLC without an SSN?", a: `Stripe provides a route for this: if representatives or owners of a US company have neither an SSN nor an ITIN, Stripe expects a tax number from their country of residence and documents showing that they are not liable to tax in the US. In addition, Stripe records every person holding ${AB25} or more and one person with significant control, with name, date of birth and address. Stripe decides on the account.` },
    { f: "Can I use Shopify Payments with a US LLC?", a: "Shopify lists a full US checking account in US dollars that can receive ACH transfers, the physical business address in the US where the business operations primarily take place, and the company’s name exactly as in the IRS records. Representatives without an SSN or ITIN who live outside the US can submit a photograph of their valid passport. Individuals, by contrast, need US residence. Shopify decides on approval." },
    { f: "When do platforms report my sales to the IRS?", a: "Payment platforms and marketplaces issue Form 1099-K when payments for goods and services in a year total more than $20,000 across more than 200 transactions. For card payments through a payment processor there is no minimum, and some states set lower thresholds. The US CPA clarifies how these reports fit with your returns." },
    { f: "Do I have to remit sales tax myself as an Amazon seller?", a: "For marketplace sales, the marketplace takes this on where the state so provides. In Florida, it confirms to its sellers that it collects the tax, and the seller may not collect sales tax on those sales itself (section 212.05965 of the Florida Statutes). This does not apply to your own shop: there, your company itself becomes responsible once it passes a state’s threshold — in Florida, more than $100,000 of remote sales outside the marketplace in the previous year." },
    { f: "Why do Stripe or PayPal restrict an account?", a: "The platforms name the reasons themselves: businesses on the list of restricted industries, many disputes and chargebacks (Stripe classifies a dispute rate above 0.75 per cent as high risk), sudden jumps in sales, new product types, long delivery times and missing details. Stripe can hold back proceeds as a reserve, and PayPal can limit the account until the matter is resolved. If Stripe closes an account, it gives the reason by email and offers a further review." },
  ],
  paket: "global_banking",
  weiter: ["/en/business/e-commerce", "/en/business/knowledge/us-address-and-phone", "/en/business/knowledge/us-bank-account-documents", "/en/business/knowledge/us-llc-german-resident"],
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
