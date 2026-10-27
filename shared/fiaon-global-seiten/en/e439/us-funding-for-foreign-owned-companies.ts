// ═══════════════════════════════════════════════════════════════════════════
// FIAON GLOBAL — KNOWLEDGE: US FUNDING FOR FOREIGN-OWNED COMPANIES (27.10.2026, E-439) · FG · 43
//
// Die englische Schwester von ../../e439/us-funding.ts. Britisches Englisch, inhaltlich
// identisch: dieselben Bausteine in derselben Reihenfolge, dieselben ids, gleich viele
// Absätze, Punkte, Zeilen, Etappen, Karten und Fragen, dieselben Quellen-Adressen.
//
// Suchwort EN (Recherche .arbeit/recherche/kw_en.md, Abschnitte 4 und 5.1): Englisch
// meint „US funding“ meist Wagniskapital oder Fördermittel. Die Seite sagt das im ersten
// Absatz offen und führt auf das, was die DACH-Leser suchen: Kapital und Business Credit
// für eine US-Gesellschaft mit Eigentümern aus Europa — „US funding for foreign-owned
// companies“ in Titel, H1, Kurz-Antwort, erstem Absatz und einer H2.
//
// Zahlen und Fristen wie in der deutschen Fassung (geprüft am 27.10.2026): FTC v. Seek
// Capital (Entscheidung C.D. Cal. 16.09.2025, Vergleich 01.10.2025, Mitteilung 17.11.2025,
// $48,280,328), SBA Procedural Notice 5000-876626 (gültig ab 01.03.2026), Executive Order
// 14406 (19.05.2026), myFICO, Dun & Bradstreet (D-U-N-S, PAYDEX 1–100, ab 80 geringes Risiko),
// § 34c GewO, § 10 AO, § 1 KStG, § 138 AO, 18 U.S.C. § 1014, 12 CFR 1026.3.
// IRS-Dauern aus fakten-en.ts (IRS_EN), nie neu geschrieben.
//
// Wortgrenzen EN: kein „up to“, keine Frist mit Ziffer, kein Zinssatz, kein „recommend“,
// „advice“ nur verneint, kein „unsecured/without collateral“, „tax-free“ nur in Anführungs-
// zeichen als Mythos, kein „credit broker“ (§ 34c GewO deshalb mit „arranges loan agreements“).
// Firmenkarte = „business credit card“ (nie „business card“). Bürgschaft der Muttergesellschaft
// = „parent company surety“ (wie wissen-finanzierung.ts). Stammdaten = „company details“
// (kein „master data“). „Business consultancy“ als
// Selbstbezeichnung erlaubt seit E-439 (Justin, 27.10.2026). Paketpreise nur über „paket“.
// ═══════════════════════════════════════════════════════════════════════════
import type { GlobalSeite, GlobalQuelle } from "../../typen";
import { GLOBAL_PFLICHTHINWEIS, GLOBAL_KAPITAL_FREI, GLOBAL_GELD_ZURUECK, GLOBAL_ROLLEN, globalPaket } from "../../../fiaon-global";
import { QUELLEN_WISSEN_EN as Q, QUELLEN_RECHT_EN as R, IRS_EN } from "../../fakten-en";

const S = "2026-10-27";
const KAPITAL_FREI = `${GLOBAL_KAPITAL_FREI.en.satz} ${GLOBAL_KAPITAL_FREI.en.steuer}`;
const KAPITAL = globalPaket("global_kapital")?.en.name ?? "Global Capital";

/** Eigene Quellen dieses Beitrags (geprüft am 27.10.2026) — dieselben Adressen wie in der deutschen Fassung. */
const QUELLEN: Record<string, GlobalQuelle> = {
  sbaNotice: {
    titel: "SBA Procedural Notice 5000-876626 — ownership, citizenship and residency requirements for 7(a) and 504 loans (effective 1 March 2026)",
    url: "https://www.sba.gov/document/procedural-notice-5000-876626-revised-applicant-ownership-citizenship-residency-requirements-7a-504-loans",
  },
  eo14406: {
    titel: "The White House — Executive Order 14406, Restoring Integrity to America’s Financial System (19 May 2026)",
    url: "https://www.whitehouse.gov/presidential-actions/2026/05/restoring-integrity-to-americas-financial-system/",
  },
  usc1014: { titel: "18 U.S. Code § 1014 — False statements in loan and credit applications", url: "https://www.law.cornell.edu/uscode/text/18/1014" },
  gewo34c: { titel: "Section 34c German Trade Regulation Code (GewO) — licence requirement, including for loan intermediaries", url: "https://www.gesetze-im-internet.de/gewo/__34c.html" },
  ao10: R.ao10,
  kstg1: R.kstg1,
  paydexRisiko: { titel: "Dun & Bradstreet — Business Credit Scores and Ratings (PAYDEX risk classes)", url: "https://www.dnb.com/en-us/smb/resources/credit-scores/db-credit-scores-ratings.html" },
};

export const SEITE: GlobalSeite = {
  pfad: "/en/business/knowledge/us-funding-for-foreign-owned-companies",
  sprache: "en",
  schwester: "/business/wissen/us-funding",
  art: "wissen",
  seo: {
    titel: "US funding for foreign-owned companies — FIAON Global",
    beschreibung: "US funding for foreign-owned companies: three levels (ITIN credit, business credit, collateral), an honest sequence and the signs of dubious programmes.",
  },
  stand: S,
  erschienen: S,
  kennung: "FG · 43",
  auge: "Knowledge · Capital",
  h1: "US funding for foreign-owned companies.",
  h1b: "What it is — and what is reputable.",
  lead: "In the German-speaking market, “US funding” means capital through your own US company — business credit cards, business credit, a banking relationship backed by collateral, and equity. The term is often sold with promises no provider can keep. Here is what US funding for foreign-owned companies really rests on, in what order it grows and how to recognise a reputable offer.",
  ziffern: [
    { wert: "3 levels", label: "personal credit, the company’s credit, collateral" },
    { wert: "1 March 2026", label: "since then, SBA loans only if all owners are US citizens residing in the US" },
    { wert: "$48.28 million", label: "monetary judgment against a funding provider, FTC 2025" },
  ],
  blick: [
    ["What it means", "Capital through a US company, not through you as a person in Europe"],
    ["Level 1", "Personal US credit through the ITIN"],
    ["Level 2", "The company’s credit: EIN, D-U-N-S Number, supplier accounts"],
    ["Level 3", "Collateral for larger sums: deposit, parent company, assets"],
    ["Closed", "SBA loans for owners from Europe, since 1 March 2026"],
    ["Who decides", "The institution alone — on the account, card, limit and loan"],
    ["With FIAON Global", "One contact instead of eight: structure, credit, prepared applications — at a fixed price"],
  ],
  kurz: "US funding for foreign-owned companies, as the term is used in the German-speaking market, means building capital through your own US company: business credit cards, business credit, a banking relationship backed by collateral, and equity. It grows on three levels — personal US credit through the ITIN, the company’s credit through the EIN, D-U-N-S Number and supplier accounts, and collateral for larger sums — and takes months to years, not weeks. A reputable offer states its fees up front, promises neither a limit nor an interest rate, explains the personal guarantee and says: the institution alone decides on every loan.",
  bloecke: [
    {
      typ: "text", id: "begriff", h2: "What “US funding” means in the German-speaking market",
      absaetze: [
        "In English, “US funding” usually means grants or venture capital. In the German-speaking market, the term stands for something else: entrepreneurs form a US company, usually an LLC, and use it to build access to capital from US institutions — in other words, US funding for foreign-owned companies. Capital through a US company covers four things that are often mentioned in the same breath but work quite differently:",
      ],
      punkte: [
        "Business credit cards — credit cards in the company’s name, generally with a personal guarantee from the owner",
        "Business credit — the company’s own credit history with commercial credit bureaus, from which supplier credit and later credit lines develop",
        "A banking relationship backed by collateral — credit lines and loans against a deposit, a parent company surety or other assets",
        "Equity — funds from the owners or from investors that are contributed to the company",
      ],
      nach: "The US company is the vessel, not the source: capital only arises when an institution approves on the basis of track record, revenue or collateral. A “US funding LLC” that generates capital by itself does not exist. Many programmes sell US funding with credit cards as the complete solution; cards, however, are only the first layer.",
    },
    {
      typ: "tabelle", id: "ebenen", h2: "The three levels of US funding for foreign-owned companies",
      lead: "Each level rests on a different basis and carries a different order of magnitude. The levels build on one another; none replaces another.",
      kopf: ["Level", "Basis", "Key", "What it carries", "Who decides"],
      zeilen: [
        ["1 · Personal US credit", "your credit file with Equifax, Experian and TransUnion", "ITIN or SSN, US address, US phone number", "first cards with a small limit, larger ones later", "the card issuer"],
        ["2 · The company’s credit", "the company’s file with commercial credit bureaus", "EIN, D-U-N-S Number, business account, supplier accounts", "supplier credit, business credit cards, later credit lines", "supplier, issuer, bank"],
        ["3 · Collateral", "assets an institution can have recourse to", "deposit, parent company surety, securities account, property", "larger credit lines and loans", "the bank, after its own review"],
      ],
      fuss: ["Simplified overview. Each institution sets its own terms, amounts and interest; the institution alone decides on every loan."],
    },
    {
      typ: "text", id: "ebene1", h2: "Level 1: your personal US credit with an ITIN",
      absaetze: [
        "Your entries with SCHUFA, KSV1870 or CRIF do not appear in the files of the three nationwide US credit bureaus, Equifax, Experian and TransUnion; as a rule, your credit history there starts with no entries at all. Without a Social Security number (SSN), the route runs through the ITIN, the nine-digit tax processing number that the IRS issues to people who cannot obtain an SSN. A FICO Score can be calculated at the earliest once at least one account is six months old or older and at least one account has been reported to a credit bureau within the last six months.",
        "This level matters more than many programmes admit: with a young company, card issuers look at the person behind it and generally require a personal guarantee. There is also a new directive: Executive Order 14406 of 19 May 2026 instructs the US Treasury to warn institutions about misuse. It names the use of an ITIN instead of an SSN in credit and account applications, by applicants whose residence status has not been verified, as a possible risk factor requiring enhanced due diligence. Each institution decides for itself how to put this into practice. Anyone applying with an ITIN should expect follow-up questions — and answer them with complete, consistent information.",
      ],
    },
    {
      typ: "text", id: "ebene2", h2: "Level 2: business credit in the US — your company’s creditworthiness",
      absaetze: [
        "Alongside your personal file, the company can build its own credit history with commercial credit bureaus such as Dun & Bradstreet and Experian. It rests on the EIN issued by the IRS, consistent company details — name, address and phone number identical everywhere — and the nine-digit D-U-N-S Number, which Dun & Bradstreet issues free of charge.",
        "The file is filled by supplier accounts on payment terms, where the supplier reports its payment experience to the bureaus. Dun & Bradstreet’s PAYDEX rates payment punctuality on a scale from 1 to 100; a score of 80 or above is considered to indicate a low risk of late payment. Only payment experiences that suppliers actually report to Dun & Bradstreet feed into the score.",
        "We are open about the limits of this level: a company’s creditworthiness takes years to grow. For young companies it does not replace the personal guarantee, and for a bank credit line what ultimately counts is revenue, financial statements and reserves — not a score alone.",
      ],
    },
    {
      typ: "text", id: "ebene3", h2: "Level 3: collateral for larger sums",
      absaetze: [
        "In the US, as in Europe, larger amounts come from collateral. A bank can grant a credit line against a deposit held with it, against a surety from a parent company in Europe — in which case it mainly assesses that company’s balance sheet — against a securities account or against a property. In addition, there is the equity the owners contribute to the company.",
        "One route has been closed to companies with owners from Europe since 1 March 2026: under Procedural Notice 5000-876626, government-backed small business loans from the SBA’s 7(a) and 504 programmes require all direct and indirect owners to be US citizens or US nationals with their principal residence in the US. Green card holders are excluded too, as are US citizens whose principal residence is abroad. In addition, every company involved must be organised in the US — a GmbH or AG as a shareholder also rules out the loan. Anyone who holds out the prospect of an SBA loan for your Europe-owned LLC either does not know the rule or is keeping quiet about it.",
      ],
    },
    {
      typ: "etappen", id: "reihenfolge", h2: "A realistic sequence — no promises",
      lead: "This is how US funding grows in practice. The durations are official figures and practical experience, not a promise; how quickly each stage moves is determined by authorities, credit bureaus and institutions.",
      etappen: [
        { titel: "Structure", dauer: "first weeks", text: `A company in the appropriate state, a registered agent, an operating agreement and the EIN from the IRS — when applying from abroad, ${IRS_EN.einDauer}. At home, the formation is reported to the tax office; in Germany under section 138 of the German Fiscal Code (AO), together with the tax return.` },
        { titel: "Identity and presence", dauer: "in parallel", text: `ITIN with Form W-7, US address and US phone number, written identically in every application. For the ITIN, the IRS quotes ${IRS_EN.itinDauer}.` },
        { titel: "Account and company details", dauer: "after the EIN", text: "The company’s business account, the D-U-N-S Number, consistent company details across every organisation involved. The account is the foundation for everything else: payment platforms pay out to it, and revenue becomes visible there." },
        { titel: "First card and supplier accounts", dauer: "first months", text: "A well-prepared first card application and supplier accounts arising from your actual business. Every statement paid on time, only a small share of each limit used." },
        { titel: "First score, further issuers", dauer: "from about six months", text: "Once an account is six months old and reported, the file meets the minimum requirements for a FICO Score. Further applications follow to a plan and at intervals: every enquiry appears in the file, and FICO treats several new accounts in a short period as a higher risk." },
        { titel: "Revenue and financial statements", dauer: "ongoing", text: "Genuine revenue through the US account, clean figures, reserves. Payment platforms and banks look at these in every significant decision." },
        { titel: "Bank and collateral", dauer: "with an established track record", text: "A credit line or loan on the basis of years of trading, revenue or collateral. You make the application; the bank reviews it under its own rules and makes the decision alone." },
      ],
    },
    {
      typ: "text", id: "seek", h2: "A case from the US trade regulator: FTC v. Seek Capital",
      absaetze: [
        "A US court has recorded in detail what US funding must not look like. In November 2024, the FTC, the US trade regulator, sued a provider that promised founders business financing. According to the decision of the U.S. District Court for the Central District of California of 16 September 2025, the company in fact applied exclusively for credit cards — by notarised power of attorney in its customers’ names, sometimes for more credit than they had expressly authorised. It charged fees as a percentage of the card limits obtained, plus application fees, surcharges for expedited processing and cancellation fees for leaving before “funding”. In total, around $48.28 million flowed from customers to the provider.",
        "Even without a trial, the court found five advertising claims deceptive: special relationships with lenders, cards “with a line-of-credit function”, periods “without interest”, “no fee until funding” and the statement that the score would not suffer — although the card applications triggered hard enquiries. A standard-form contract also barred customers from posting negative reviews for three years; according to the court, this too violated US law. The court left open whether the promise of “loans and lines of credit” was itself deceptive, because credit cards can legally count as a line of credit.",
        "Under the final order of 1 October 2025, a settlement with the FTC, the provider and its chief executive are permanently banned from offering loans and business financing; the FTC announced this on 17 November 2025. The monetary judgment of $48,280,328 is partially suspended because the defendants are unable to pay it. The case sets out, point by point, the standard against which every funding programme must be measured — FIAON included.",
      ],
    },
    {
      typ: "karten", id: "warnzeichen", h2: "Warning signs of dubious funding programmes", spalten: 3,
      karten: [
        { tag: "Warning sign", titel: "Fees for card stacking", text: "Fees as a percentage of the limits obtained turn every further application into business for the provider — even when it harms your file. Many applications at once mean many hard enquiries; FICO treats several new accounts in a short period as a higher risk, especially with a short history — and all introductory periods end at the same time." },
        { tag: "Warning sign", titel: "Claimed lender relationships", text: "“Our banks give our clients more”: the institution decides on every application under its own rules. The court in the FTC case found this very claim deceptive." },
        { tag: "Warning sign", titel: "Interest promises", text: "Anyone promising “interest-free” or a fixed interest rate is promising what only an issuer can set. Some issuers offer introductory periods without debit interest; each issuer sets the terms itself." },
        { tag: "Warning sign", titel: "“Tax-free” promises", text: "A US company managed from Germany, Austria or Switzerland remains taxable there. Anyone selling “tax-free” conceals the tax law at home — in Germany, for instance, section 10 of the German Fiscal Code (AO) and section 1 of the Corporate Income Tax Act (KStG) — and the reporting duty under section 138 AO." },
        { tag: "Warning sign", titel: "A limit as a figure", text: "Sample limits in dollars, “six figures in a year”: the issuer decides on every limit. Anyone who holds out the prospect of a specific amount is promising something they cannot deliver." },
        { tag: "Warning sign", titel: "SBA loans for non-US owners", text: "Since 1 March 2026, companies whose owners are not, without exception, US citizens or US nationals with their principal residence in the US have been excluded from SBA loans under the 7(a) and 504 programmes. Anyone still offering them is working with outdated knowledge." },
      ],
    },
    {
      typ: "tabelle", id: "pruefliste", h2: "Checklist: how to tell whether a US funding offer is reputable",
      lead: "Ten questions that a reputable offer answers in writing. If an answer is not forthcoming, that is an answer in itself.",
      kopf: ["Question to the provider", "Reputable answer", "Warning signal"],
      zeilen: [
        ["Who exactly is the contracting party?", "name, legal form, register entry and address are stated in the contract", "only a brand, a messenger channel, no legal entity"],
        ["What does it cost, in full?", "fixed price up front, all fees stated", "fee as a percentage of the limit, fees in the small print"],
        ["Who decides on credit and limits?", "the institution alone", "“assured limits thanks to our contacts at banks”"],
        ["Is interest promised?", "no — each issuer sets the terms itself", "“interest-free” for a long time, fixed interest rates"],
        ["Who makes account, card and credit applications?", "you yourself, with fully prepared documents", "the provider, by power of attorney, in your name"],
        ["How many applications, at what intervals?", "a planned sequence, applications spaced out", "many applications on a single day"],
        ["What happens to your credit?", "hard enquiries and new accounts are explained openly", "“your score won’t suffer”"],
        ["Who is liable for the cards?", "the owner’s personal guarantee is spelt out", "not a word about it"],
        ["What about tax?", "taxable at home, review by a tax adviser before formation", "“tax-free” or “no tax office involved”"],
        ["Are you free to post reviews of the provider?", "yes, without restriction", "clauses against negative reviews"],
      ],
      fuss: ["The questions draw on what the court objected to in FTC v. Seek Capital and on FIAON Global’s mandatory notices."],
    },
    {
      typ: "text", id: "recht", h2: "Three legal rules that affect every funding offer",
      absaetze: [
        "In Germany, anyone who commercially arranges the conclusion of loan agreements needs a licence from the competent authority (section 34c(1), first sentence, no. 2 of the German Trade Regulation Code, GewO). FIAON Global does not arrange loans and receives no fee based on the limit; we build the foundation on which institutions decide.",
        "In the US, knowingly false statements intended to influence a credit decision by a bank with US deposit insurance or by the SBA are a criminal offence (18 U.S.C. § 1014). An invented revenue figure, an embellished business description, a false purpose: whatever a provider “optimises”, you are the one who signs.",
        "And for business credit cards, US consumer protection applies only to a limited extent. Credit for business purposes is exempt from most of the rules of Regulation Z (12 CFR 1026.3); what counts above all is the issuer’s contract.",
        "The partner lawyers and partner tax advisers acting under your engagement clarify how these rules apply in your case — FIAON is not a law firm.",
      ],
    },
    {
      typ: "text", id: "fiaon", h2: "How FIAON Global handles the route to US funding",
      absaetze: [
        "FIAON Global is a business consultancy for entrepreneurs from Germany, Austria and Switzerland who are building a US company. Our principle: one contact instead of eight. With your power of attorney, we submit every application on your behalf — formation in the state, the EIN, preparation of the ITIN, the D-U-N-S Number and the first annual US filing — and provide the registered agent, US address and US phone number for the first year. You make account, card and credit applications yourself; we prepare each of them in full.",
        "This is how we guide you along the route to US funding, in the right order: first the structure, then building credit on both levels, then fully prepared applications that you make yourself, and the key-figures file for a later bank loan. The institution decides on every application. The capital range of your package is a goal we work towards together, not a promise.",
        GLOBAL_ROLLEN.en.partner,
        "You pay a fixed price, agreed before the engagement begins, with all of the package’s fees included — no fee based on the limit and no share of the capital. Your contracting party is FIAON LTD in London; our team on the ground in Miami handles appointments and filings, and Zurich is our partner location. From the second year onwards you can choose the annual care plan — voluntary and without automatic renewal.",
        `${GLOBAL_GELD_ZURUECK.en.text} ${GLOBAL_GELD_ZURUECK.en.bedingungen}`,
        KAPITAL_FREI,
      ],
    },
    {
      typ: "karten", id: "vertiefen", h2: "Each level in detail", spalten: 3,
      karten: [
        { tag: "Service", titel: "Business credit cards and building capital", text: "FIAON Global’s card ladder and the capital range for each package as a goal.", pfad: "/en/business/us-business-credit-cards" },
        { tag: "Level 1", titel: "Building US credit", text: "How the FICO Score comes about and what a first score requires.", pfad: "/en/business/knowledge/building-us-credit" },
        { tag: "Level 1", titel: "Applying for an ITIN", text: "Form W-7 from abroad, documents and processing time.", pfad: "/en/business/knowledge/applying-for-an-itin" },
        { tag: "Level 2", titel: "Business credit", text: "D-U-N-S Number, PAYDEX and supplier accounts.", pfad: "/en/business/knowledge/us-business-credit" },
        { tag: "Cards", titel: "Applying for a US business credit card", text: "The issuer’s review, personal guarantee, introductory period.", pfad: "/en/business/knowledge/us-business-credit-card" },
        { tag: "Level 3", titel: "Financing routes", text: "Six routes for a US company, by speed and basis.", pfad: "/en/business/knowledge/us-financing-routes" },
        { tag: "SBA", titel: "SBA loans for non-US citizens", text: "The rule since 1 March 2026 and the routes that remain.", pfad: "/en/business/knowledge/sba-loans-non-us-citizens" },
        { tag: "Caution", titel: "Credit card stacking", text: "What lies behind the promise of stacked cards.", pfad: "/en/business/knowledge/credit-card-stacking" },
        { tag: "Checklist", titel: "Checking providers", text: "How to recognise a reputable LLC formation provider.", pfad: "/en/business/knowledge/checking-providers" },
      ],
    },
    { typ: "paket", id: "paket", h2: "The whole route in one package", lead: `Structure, support across several issuers, prepared applications and the key-figures file for a later bank loan — ${KAPITAL}.`, paket: "global_kapital" },
    {
      typ: "hinweis", id: "wissen", h2: "What you need to know",
      punkte: [
        "FIAON is not a bank, does not grant loans, does not arrange loans and does not commit to any limit. The institution concerned alone decides on the account, card, limit and loan.",
        "The capital range of a package is a goal, not a promise. Nobody can promise a specific limit, score or interest rate.",
        "Every card application generally leaves an enquiry in your file; new accounts lower the average age of your credit history.",
        GLOBAL_PFLICHTHINWEIS.en[0],
        GLOBAL_PFLICHTHINWEIS.en[1],
        GLOBAL_PFLICHTHINWEIS.en[2],
      ],
    },
  ],
  fragen: [
    { f: "What is US funding?", a: "In the German-speaking market, building capital through your own US company: business credit cards, business credit, a banking relationship backed by collateral, and equity. It rests on three levels — personal US credit, the company’s credit, collateral — and grows over months and years. The institution decides on every loan." },
    { f: "Is US funding legitimate?", a: "The route itself is legal and common. Dubious programmes are those that promise limits or interest rates, charge fees as a percentage of card limits, claim relationships with lenders or sell “tax-free” structures. In 2025 the US trade regulator FTC had such a provider permanently banned from the business." },
    { f: "Can my US LLC get an SBA loan if I live in Europe?", a: "No. Since 1 March 2026, all direct and indirect owners must be US citizens or US nationals with their principal residence in the US (SBA Procedural Notice 5000-876626). A green card is not enough either, and a GmbH or AG as a shareholder also rules out the loan." },
    { f: "How much capital can a US funding LLC raise?", a: "Nobody can name a fixed amount. The company is the vessel; capital arises when institutions approve on the basis of track record, revenue or collateral. Cards usually carry smaller limits; larger sums need revenue, a history or collateral." },
    { f: "Can a foreigner get a US business loan?", a: "SBA loans have been excluded since 1 March 2026. Routes that are not tied to nationality remain open: business credit cards with a personal guarantee, supplier credit built on business credit, credit lines against a deposit, a parent company surety or assets. Whether, and on what terms, is decided solely by the institution concerned under its own rules." },
    { f: "How long does it take to build up US funding?", a: "The company and EIN are usually in place after a few weeks. A FICO Score can exist at the earliest after six months with a reported account; solid business credit grows over years. Bank credit lines usually require years of trading, revenue or collateral. Anyone who holds out the prospect of capital within a few weeks is promising something only institutions can decide." },
    { f: "Does FIAON Global raise the capital?", a: "No. FIAON is not a bank, does not grant loans and does not arrange loans. As a business consultancy, we make every application concerning your company with your power of attorney and prepare every account, card and credit application in full; you make those yourself, and the institution decides. The capital range of your package is a goal, not a promise." },
    { f: GLOBAL_KAPITAL_FREI.en.frage, a: GLOBAL_KAPITAL_FREI.en.antwort },
  ],
  paket: "global_kapital",
  weiter: ["/en/business/knowledge/us-financing-routes", "/en/business/knowledge/sba-loans-non-us-citizens", "/en/business/knowledge/credit-card-stacking", "/en/business/us-business-credit-cards"],
  quellen: [
    Q.ftcSeek,
    Q.ftcSeekUrteil,
    QUELLEN.sbaNotice,
    QUELLEN.eo14406,
    Q.ftcAuskunft,
    Q.ficoMindest,
    Q.ficoFaktoren,
    Q.itinUebersicht,
    Q.itin,
    Q.ss4,
    Q.duns,
    Q.paydex,
    QUELLEN.paydexRisiko,
    Q.experian,
    Q.regZ3,
    QUELLEN.usc1014,
    QUELLEN.gewo34c,
    QUELLEN.ao10,
    QUELLEN.kstg1,
    Q.ao138,
  ],
};
