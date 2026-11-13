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
// E-509 (12.11.2026): EIN Produkt statt vier Pakete — kein Paketname, der Preis aus EIN_PRODUKT; die alte Geld-zurück-Zusage
// je Paket entfällt (auf dieser Seite geht es nicht um Kapital).
import { GLOBAL_AGENT, GLOBAL_PFLICHTHINWEIS } from "../../../fiaon-global";
import { EIN_PRODUKT } from "../../ein-produkt";
import { QUELLEN_RECHT_EN as R, QUELLEN_WISSEN_EN as Q, SCHWELLEN_EN } from "../../fakten-en";
// E-510 (13.11.2026, language guide FIAON Global): one section “What FIAON Global handles” built from steps 1 and 2 of the
// fixed narrative; accounts with marketplaces and payment service providers are decided by the provider concerned (said there
// exactly once). No “team on the ground”, no partner location, no partner shown at work, no D-U-N-S Number as a service.
// Second round of the same rework: every visible text rewritten sentence by sentence, in step with the German page — statement,
// condition, decision-maker; plain headings of seven words at most; one word per thing (platform, seller, state, restriction).
// Approval rests with the platform concerned, said once per section. Tax questions appear in running text as a responsibility
// (“a matter for a US CPA”), never as a partner at work; the partners’ role is carried by the fixed role sentence in the notes
// block alone. The “not a tax scheme” sentence comes from the source of fixed sentences. Main heading and second line stay word
// for word (they are printed in the preview image). Facts, figures, sections of law, sources, anchors and blocks unchanged.
import { SCHRITTE_KOPF, SECHS_SCHRITTE, satz, type Schritt, type SchrittNr } from "../../../fiaon-global-saetze";

const S = "2026-10-27";
const P = EIN_PRODUKT.en;
/** Steps 1 and 2 of the fixed narrative (language guide 2.3) — from the one source, never retyped. */
const schritt = (nr: SchrittNr): Schritt => SECHS_SCHRITTE.en.find((x) => x.nr === nr)!;
const GRUENDUNG = schritt(1);
const UNTERLAGEN = schritt(2);
/** The names of the fixed parts of a step: “Your part”, “Condition” (language guide 2.1). */
const TEIL = SCHRITTE_KOPF.en.teile;
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
  stand: "2026-11-13",
  erschienen: S,
  kennung: "FG · 49",
  auge: "Knowledge · Platforms",
  h1: "Amazon seller, US LLC, non-resident.",
  h1b: "What Amazon, Stripe and PayPal check for your US LLC.",
  lead: "An Amazon seller with a US LLC and a non-resident owner goes through the platform’s checks: at registration and again later. The same applies to payments taken through Stripe, PayPal or Shopify. The platforms ask who owns the company, which tax number it holds and where the proceeds go. This article sets out the requirements, the appropriate tax form and the rules on sales tax. It also lists the reasons for which platforms restrict accounts.",
  ziffern: [
    { wert: AB25, label: "the ownership share from which Stripe and Shopify record every owner" },
    { wert: "180 days", label: "maximum age of the proof of address at Amazon" },
    { wert: "$20,000", label: "reporting threshold for Form 1099-K: more than this across more than 200 transactions in a year" },
  ],
  blick: [
    ["Whom the platform checks", `You, with your ID; at Stripe and Shopify, every owner holding ${AB25} or more; at Stripe, also one person with significant control`],
    ["Company", "Proof of registration and EIN; the name exactly as in the IRS records"],
    ["Account", "In your name or the company’s; Shopify Payments requires a US checking account"],
    ["Tax form", "Single-member LLC with an owner abroad: the owner’s W-8. Several members: the LLC’s W-9"],
    ["Sales tax", "Marketplace sales: the marketplace, where the state so provides. Your own shop: your company, once it passes the state’s threshold"],
    ["Who decides", "The platform concerned: on approval, reserves and restrictions"],
    ["With FIAON Global", "Formation, documents and the applications for the EIN and ITIN. You register with the platforms yourself"],
  ],
  kurz: "An Amazon seller with a US LLC and a non-resident owner faces five checks: owners, the company and its tax number (EIN), receiving account, tax form, and consistent addresses and documents. Stripe, PayPal and Shopify ask the same. A sole owner based abroad submits a Form W-8; the LLC does not submit a W-9. On marketplace sales, the marketplace remits sales tax where the state so provides; for your own shop, your company is responsible once it passes the state’s threshold. Approval rests with the platform concerned.",
  bloecke: [
    {
      typ: "text", id: "ueberblick", h2: "Amazon seller, US LLC, non-resident: five checks",
      absaetze: [
        "Marketplaces and payment services accept payments on behalf of their sellers and pass them on. This creates obligations towards regulators, card networks and the tax authorities. Stripe states that its requirements come from regulators and are meant to prevent abuse of the financial system. For an Amazon seller with a US LLC and a non-resident owner in Europe, the company is American and the owner is not. The documents must show both without contradiction.",
        "In essence, the platforms ask about the same five points:",
      ],
      punkte: [
        `Owners: your ID; at Stripe and Shopify, details of every owner holding ${AB25} or more; at Stripe, also of one person with significant control`,
        "Company: the state’s proof of registration and the EIN (the company’s tax number), under exactly the name held by the US tax authority, the IRS",
        "Proceeds: an account in the name of the company or of the owner",
        "Tax: tax number and tax details; at Amazon, the tax interview with Form W-8 or W-9",
        "Contact details: business address, residential address with recent proof, phone number and email address",
      ],
      nach: "Queries often arise from a contradiction between two documents. Examples are a name spelt differently, an address without matching proof or an account in a third party’s name.",
    },
    {
      typ: "tabelle", id: "plattformen", h2: "Amazon, Stripe, PayPal and Shopify compared",
      lead: "The requirements of the four platforms for a US company, according to their own help pages. Approval rests with the platform concerned.",
      kopf: ["Platform", "What it checks", "What applies"],
      zeilen: [
        ["Amazon (US seller account)", "ID, phone and email, an internationally chargeable credit card, a bank account with routing number, proof of business registration, proof of residential address, tax details; then identity verification by photo or video call", "Address as in the proof of registration; proof of address from the last 180 days; account in your name or the company’s"],
        ["Stripe", `The company, every person holding ${AB25} or more and one person with significant control: name, date of birth, address`, "Without a Social Security number (SSN) or a personal tax number (ITIN): a tax number from the country of residence and proof that there is no US tax liability. The business is not on the list of prohibited businesses; Stripe accepts restricted businesses only after additional review"],
        ["PayPal Business", "Tax details for reporting to the IRS; during reviews, business documents such as supplier details, invoices and bank statements", "Complete tax details; products and services within the Acceptable Use Policy; a sales trend that can be explained"],
        ["Shopify Payments (US)", `Name and EIN of the company; a physical business address in the US where the business operations primarily take place; a US checking account in US dollars that can receive ACH transfers; every owner holding ${AB25} or more`, "Name exactly as in the IRS records. Representatives without an SSN or ITIN who live outside the US verify their identity with a photograph of their valid passport"],
      ],
      fuss: ["Source: the platforms’ help pages, as at October 2026. Each platform sets its own requirements and may ask for further documents."],
    },
    {
      typ: "text", id: "amazon", h2: "Amazon seller registration with a US LLC",
      absaetze: [
        "By Amazon’s own account, businesses from Europe do not necessarily need a US company to sell on the US marketplace. Whether one makes sense depends, Amazon says, on your business and your sales strategy. For registration, Amazon lists the following details and documents. About you: a government-issued ID such as a passport, a phone number and an email address. For payment: an internationally chargeable credit card, plus bank account and routing numbers. About the business: proof of business registration and your tax details. For your residential address: proof from the last 180 days, such as a bank or credit card statement from Europe or the US. As the business address, you enter the address shown in the proof of registration.",
        "Identity verification comes next. You submit your ID and proof of address. You then take a photo of your face together with your ID or join a video call with an Amazon employee. For the video call, you have your ID and proof of address with you. Amazon requires colour scans or good-quality photos: all four corners are visible and the text is legible. According to Amazon, screenshots and blurred images are not sufficient.",
        "Registration includes a tax interview. From your answers, Amazon generates the appropriate tax form; the section on the tax form shows which one applies. Amazon pays your proceeds from the US marketplace to a US account or, through the Amazon Currency Converter, to an account in Europe. The account must be in your name or your company’s. The Professional seller account costs $39.99 a month plus selling fees. Amazon decides on approval.",
      ],
    },
    {
      typ: "text", id: "zahlungsdienste", h2: "Stripe, PayPal and Shopify: US LLC requirements",
      absaetze: [
        `For companies in the US, Stripe records one person with significant control and everyone who holds at least ${AB25}. Stripe asks for name, date of birth and address and, for US persons, the Social Security number (SSN). According to Stripe, the basis is US beneficial ownership law; banks verify their business customers under the same rule (31 CFR 1010.230). If representatives or owners have neither an SSN nor a personal tax number (ITIN), Stripe expects a tax number from their country of residence. It also expects documents showing that they are not liable to tax in the US. Stripe does not accept some industries and accepts others only after additional review. It attributes this to the law, the card networks and the banks Stripe works with. The governing document is its list of restricted and prohibited businesses.`,
        "PayPal Business asks for the tax details it needs for reporting to the IRS. If PayPal notices a change in selling patterns or a rise in buyer complaints, it may request documents about the business. Examples are supplier details, invoices and bank statements. PayPal may also limit the account; you can then no longer send or withdraw money, for example. The limitation applies until you have completed the steps PayPal sets out. PayPal gives the reason by email and in the account’s Resolution Centre. According to PayPal, an email with no matching entry there may not be genuine.",
        `In the US, Shopify Payments is open to individuals and sole proprietors only if they reside in the US. For an LLC, Shopify sets these requirements. First, the name exactly as in the IRS records, including punctuation and capitalisation. Second, the EIN; where needed, an IRS letter serves as evidence (SS-4 confirmation, Notice CP 575 or Letter 147C). Third, the physical business address in the US where the business operations primarily take place. Fourth, a full checking account with a US bank, in US dollars, that can receive ACH transfers. The LLC also lists every owner holding ${AB25} or more. Representatives who live outside the US and have neither an SSN nor an ITIN can instead submit a photograph of their valid passport. The payment service concerned decides on approval.`,
      ],
    },
    {
      typ: "tabelle", id: "formulare", h2: "W-9 or W-8: the appropriate tax form",
      lead: "The tax interview determines how the platform treats your company for IRS purposes. Two things count: the tax classification of the LLC and its owner.",
      kopf: ["Your LLC", "Form", "Who submits it"],
      zeilen: [
        ["Single-member LLC whose owner is an individual resident abroad", "W-8BEN; for income effectively connected with a US trade or business, W-8ECI", "The owner, with their own name and details, not the LLC"],
        ["Single-member LLC whose owner is a company abroad, such as a GmbH", "W-8BEN-E; for effectively connected income, W-8ECI", "The owner, not the LLC"],
        ["LLC with several members (a partnership for tax purposes)", "W-9", "The LLC itself, even if its members live abroad"],
        ["LLC taxed as a corporation", "W-9", "The LLC itself"],
      ],
      fuss: [
        "Form W-9 states this expressly: if the owner of a disregarded entity is a foreign person, the owner submits a Form W-8. This applies even if the owner holds a US tax number such as an ITIN.",
        "You state your LLC’s classification in the EIN application (line 9a of Form SS-4). Which income is effectively connected with a US trade or business depends on your business. That question is a matter for a US certified public accountant (CPA).",
      ],
    },
    {
      typ: "text", id: "meldungen", h2: "Form 1099-K: reporting and withholding",
      absaetze: [
        "Payment platforms and marketplaces report payments for goods and services to the IRS on Form 1099-K. Reporting applies when the payments in a year total more than $20,000 across more than 200 transactions. PayPal cites the One Big Beautiful Bill Act of 2025 as the basis; that Act restored this threshold. For card payments through a payment processor, there is no minimum. Some states set lower thresholds.",
        "That is why the platforms ask for your tax number and tax form and check that name and number match. Shopify may request an IRS letter if the EIN cannot be confirmed. If the details are missing, a payment service can withhold part of each payment. PayPal has withheld 24 per cent on accounts without tax details. That is the backup withholding rate, which Form W-9 also states.",
        "US reporting does not replace the tax return in your country of residence. If you manage the LLC from Germany, the centre of its top-level commercial management lies there. That is its place of management within the meaning of section 10 of the German Fiscal Code (AO). Depending on the classification, Germany then taxes either the company itself (section 1 of the German Corporate Income Tax Act, KStG) or its profit in your hands. You notify the tax office (Finanzamt) of the formation or the participation under section 138(2) AO, together with the tax return for the year in which it took place. How platform revenue is declared in Germany is a matter for a tax adviser. Your ongoing tax return stays with your own tax adviser.",
      ],
    },
    {
      typ: "text", id: "sales-tax", h2: "Sales tax: marketplace and your own shop",
      absaetze: [
        "Sales tax is the tax the US states levy on sales. Since the Supreme Court’s decision in South Dakota v. Wayfair of 21 June 2018, states may also require it from sellers with no physical presence in the state. South Dakota tied the obligation to deliveries into the state worth more than $100,000, or to at least 200 separate transactions, a year. Each state sets its own thresholds.",
        "For sales through marketplaces, the states have created rules of their own, usually known as marketplace facilitator rules. Florida is one example (section 212.05965 of the Florida Statutes). The marketplace confirms to its sellers in writing that it collects and remits sales tax on the sales made through it. The seller may then not collect the tax on those sales itself. It leaves those sales out of its own return.",
        "For your own shop, with Shopify, Stripe or PayPal as the payment route, this rule does not apply. Under Florida law, payment processors are expressly not marketplaces. In your own shop, your company itself is responsible once it exceeds a state’s threshold. In Florida, the threshold is taxable remote sales of more than $100,000 in the previous calendar year (section 212.0596 of the Florida Statutes). Only sales outside the marketplace count towards it (section 212.05965(4)). Whether and where your company has to register depends on the individual case. The same goes for whether goods held in a warehouse create obligations of their own in that state, for example under Fulfilment by Amazon (FBA). Both questions are a matter for a US CPA.",
      ],
    },
    {
      typ: "karten", id: "sperren", h2: "Typical reasons for restrictions", spalten: 3,
      lead: "The reasons for reviews, reserves and restrictions, as the platforms themselves state them.",
      karten: [
        { tag: "Core details", titel: "Differing spellings and addresses", text: "The name on the EIN letter differs from the one in the formation document, or the address in the application does not match the proof. Shopify requires the name exactly as in the IRS records. Amazon requires the address as in the proof of registration." },
        { tag: "Proof", titel: "Illegible or too old", text: "Cut-off corners, blurred photos or a proof of address older than 180 days. Amazon requires legible colour scans in which all four corners are visible." },
        { tag: "Industry", titel: "Restricted businesses", text: "Stripe does not accept gambling, weapons, debt relief and other industries, or accepts them only after additional review. PayPal limits accounts for breaches of its Acceptable Use Policy." },
        { tag: "Disputes", titel: "Chargebacks and complaints", text: "Stripe classifies accounts with a dispute rate above 0.75 per cent as high risk. PayPal reviews accounts with many buyer complaints and chargebacks." },
        { tag: "Revenue", titel: "Unexplained rise in sales", text: "A sudden rise in sales or a new type of product can result in PayPal limiting an account. Stripe may hold back part of the proceeds as a reserve, for example after a sharp rise without explanation or where delivery times are long." },
        { tag: "Tax", titel: "Missing tax details", text: "Without a confirmed tax number and a matching tax form, there is no basis for reporting to the IRS. PayPal has withheld 24 per cent of payments in such cases." },
      ],
    },
    {
      typ: "etappen", id: "reihenfolge", h2: "The sequence through to registration",
      lead: "Registration with the platforms comes last. By then, every detail and every document is in place.",
      etappen: [
        { titel: "Settle the name and the company", text: "The name reads identically, character for character, everywhere: in the formation document, on the EIN letter, on the account and on every platform. That includes the punctuation." },
        { titel: "Apply for the EIN", text: "The EIN is the company’s tax number. The IRS letter (CP 575 or Letter 147C) belongs with the documents. Shopify may ask for it if the number cannot be confirmed." },
        { titel: "Document the owners", text: `The operating agreement, the LLC’s governing document, names every member with their share. Together the shares total 100 per cent. Stripe and Shopify record every owner holding ${AB25} or more.` },
        { titel: "Determine the receiving account", text: "Amazon pays out only to an account in your name or the company’s. Shopify Payments requires a US checking account in US dollars that can receive ACH transfers. The institution concerned decides whether to open an account." },
        { titel: "Settle the tax form", text: "Before the tax interview, it is clear which form applies: W-8BEN, W-8BEN-E, W-8ECI or W-9. It is equally clear who signs it." },
        { titel: "Settle address and phone", text: "The business address matches your supporting documents, and you can be reached on the phone number. Both read the same in every application." },
        { titel: "Register with the platforms", text: "You register with the platforms last. You have your passport, a proof of address from the last 180 days and legible colour scans to hand. Amazon verifies identity by photo or video call. Approval rests with the platform concerned." },
      ],
    },
    {
      typ: "text", id: "fiaon", h2: "What FIAON Global handles",
      absaetze: [
        `${GRUENDUNG.satz} ${UNTERLAGEN.satz}`,
        "We keep your company’s name, address and telephone number identical in every document.",
      ],
      punkte: [
        `${TEIL.ihrTeil}: ${UNTERLAGEN.ihrTeil} You register with the platforms yourself.`,
        `Business account: ${satz("S2", "en")}`,
        `${TEIL.bedingung}: ${satz("S3", "en")} Approval of a seller or payment account rests with the platform concerned.`,
      ],
    },
    { typ: "paket", id: "mandat", h2: P.karteH2, lead: P.karteLead, paket: "global_banking" },
    {
      typ: "hinweis", id: "wissen", h2: "What you need to know",
      punkte: [
        "The platform concerned alone decides on approval, reserves and restrictions, even where the documents are complete. This page reflects the platforms’ help pages (as at October 2026). The version in force at the time of your registration governs.",
        "Not part of your engagement: accounts with marketplaces and payment services, sales tax registrations and ongoing bookkeeping.",
        GLOBAL_AGENT.en.anschrift,
        satz("S8", "en"),
        GLOBAL_PFLICHTHINWEIS.en[0],
        GLOBAL_PFLICHTHINWEIS.en[1],
        GLOBAL_PFLICHTHINWEIS.en[2],
      ],
    },
  ],
  fragen: [
    { f: "Can I sell on Amazon’s US marketplace as a non-resident from Germany?", a: "Yes. Amazon accepts sellers from Europe on its US marketplace. According to Amazon, a US company is not necessarily required for this. For registration, Amazon requires an ID such as a passport, an internationally chargeable credit card and a bank account. It also requires proof of business registration, proof of address from the last 180 days and your tax details. Identity verification by photo or video call follows. Amazon decides on approval." },
    { f: "Do I need a US LLC to sell in the US?", a: `Not necessarily. Amazon also accepts sellers from Europe without a US company. It pays the proceeds to an account in Europe via the Amazon Currency Converter. Shopify Payments in the US, by contrast, is open to individuals only if they reside in the US. An LLC there needs an EIN, a US checking account and a US business address. If you manage the LLC from Germany, it remains taxable there (section 10 AO, section 1 KStG). ${satz("S10", "en")}` },
    { f: "Does my US LLC give Amazon a W-9 or a W-8BEN?", a: "That depends on the tax classification of the LLC. If you own it alone and live abroad, you as the owner submit a Form W-8. That is W-8BEN or, for income effectively connected with a US trade or business, W-8ECI. This applies even if you have an ITIN. An LLC with several members, or one taxed as a corporation, submits a W-9 itself. The classification is stated in the EIN application. Whether income is effectively connected is a matter for a US CPA." },
    { f: "Can I use Stripe with a US LLC without an SSN?", a: `Stripe provides a route for this. If representatives or owners of a US company have neither an SSN nor an ITIN, Stripe expects a tax number from their country of residence. It also expects documents showing that they are not liable to tax in the US. In addition, Stripe records every person holding ${AB25} or more and one person with significant control, each with name, date of birth and address. Stripe decides on the account.` },
    { f: "Can I use Shopify Payments with a US LLC?", a: "Among other things, Shopify requires a full US checking account in US dollars that can receive ACH transfers. It also requires the physical business address in the US where the business operations primarily take place, and the company’s name exactly as in the IRS records. Representatives without an SSN or ITIN who live outside the US can submit a photograph of their valid passport. Individuals, by contrast, need US residence. Shopify decides on approval." },
    { f: "When do platforms report my sales to the IRS?", a: "The threshold for Form 1099-K is more than $20,000 across more than 200 transactions in a year. It applies to payments for goods and services through payment platforms and marketplaces. For card payments through a payment processor, there is no minimum. Some states set lower thresholds. How these reports fit with your returns is a matter for a US CPA." },
    { f: "Do I have to remit sales tax myself as an Amazon seller?", a: "For marketplace sales, the marketplace remits the sales tax where the state so provides. In Florida, it confirms to its sellers that it collects the tax. The seller may then not collect sales tax on those sales itself (section 212.05965 of the Florida Statutes). This does not apply to your own shop. There, your company itself is responsible once it passes a state’s threshold. In Florida, the threshold is more than $100,000 of remote sales outside the marketplace in the previous year." },
    { f: "Why do Stripe or PayPal restrict an account?", a: "The platforms state several reasons. These include businesses on the list of restricted industries, and many disputes and chargebacks. Stripe classifies a dispute rate above 0.75 per cent as high risk. Further reasons are a sudden rise in sales, new product types and long delivery times. Missing details are another. Stripe can hold back proceeds as a reserve; PayPal can limit the account until the matter is resolved. If Stripe closes an account, it gives the reason by email and offers a further review." },
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
