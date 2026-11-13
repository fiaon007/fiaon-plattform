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
//
// E-510 (13.11.2026, language guide): the search term “US funding” appears only in the
// title, the H1, the lead, “In brief” and the first paragraph — elsewhere “financing”.
// The warning signs no longer describe our own fee (guide 5.6 no. 12): the warning sign
// is a fee that grows with every further card application, not a fee set by the chosen
// funding target. “Receives no fee based on the limit” is deleted (untrue since E-509);
// about ourselves only: fees and services are set out in full before the client signs
// (S12). Sentence S16 is not released (reservation V3). The one section about us is
// built from the fixed sentences (S5 in the version in force today, S1, S9, S12 and the
// line “If the financing does not arrive”) — shared/fiaon-global-saetze.ts.
// Never here: a “team on the ground”, a place for the partners, a duration as a promise (S15).
// ═══════════════════════════════════════════════════════════════════════════
import type { GlobalSeite, GlobalQuelle } from "../../typen";
// E-509 (12.11.2026): EIN Produkt statt vier Pakete. Das Erfolgshonorar richtet sich nach dem Kapitalrahmen, den der Klient
// selbst wählt — „no fee based on the limit“ (bis E-509 wahr) ist gestrichen.
import { GLOBAL_PFLICHTHINWEIS, GLOBAL_KAPITAL_FREI } from "../../../fiaon-global";
import { SCHRITTE_KOPF, SECHS_SCHRITTE, satz } from "../../../fiaon-global-saetze";
import { EIN_PRODUKT } from "../../ein-produkt";
import { QUELLEN_WISSEN_EN as Q, QUELLEN_RECHT_EN as R, IRS_EN } from "../../fakten-en";

/** Date of first publication (E-439). */
const S = "2026-10-27";
const P = EIN_PRODUKT.en;
/** Step 5 of the fixed narrative (language guide 2.3, the version in force today) — verbatim from the one source. */
const FINANZIERUNG = SECHS_SCHRITTE.en.find((x) => x.nr === 5)!;
/** The names of the fixed parts of a step: “Your part”, “Condition” (language guide 2.1). */
const TEIL = SCHRITTE_KOPF.en.teile;
/** The first two sentences of the role (S8): neither a bank nor a law firm; does not lend and does not broker loans. */
const ROLLE = satz("S8", "en").split(/(?<=\.)\s+/).slice(0, 2).join(" ");

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
    beschreibung: "Financing for foreign-owned US companies: three levels (ITIN credit, business credit, collateral), a realistic sequence and the warning signs.",
  },
  stand: "2026-11-13",
  erschienen: S,
  kennung: "FG · 43",
  auge: "Knowledge · Financing",
  h1: "US funding for foreign-owned companies.",
  h1b: "What it is — and what is reputable.",
  lead: "In the German-speaking market, “US funding” means capital through your own US company — business credit cards, business credit, a banking relationship backed by collateral, and equity. The term is often sold with promises no provider can keep. Here is what US funding for foreign-owned companies really rests on, in what order it grows and how to recognise a reputable offer.",
  ziffern: [
    { wert: "3 levels", label: "personal credit, the company’s credit, collateral" },
    { wert: "1 March 2026", label: "since then, SBA loans only if all owners are US citizens residing in the US" },
    { wert: "$48.28 million", label: "monetary judgment against a provider, FTC v. Seek Capital 2025" },
  ],
  blick: [
    ["What it means", "Capital through a US company, not through you as a person in Europe"],
    ["Level 1", "Personal US credit through the ITIN"],
    ["Level 2", "The company’s credit: EIN, D-U-N-S Number, supplier accounts"],
    ["Level 3", "Collateral for larger sums: deposit, parent company, assets"],
    ["Closed", "SBA loans for owners from Europe, since 1 March 2026"],
    ["Who decides", "The institution alone — on the account, card, limit and loan"],
    ["With FIAON Global", "Formation, fully prepared applications, support through to the lender’s decision"],
  ],
  kurz: "US funding for foreign-owned companies, as the term is used in the German-speaking market, means financing through your own US company: business credit cards, business credit, a banking relationship backed by collateral, and equity. It rests on three levels — personal US credit through the ITIN, the company’s credit through the EIN, D-U-N-S Number and supplier accounts, and collateral for larger sums; a credit history grows over months and years. A reputable offer states fees and services in writing up front, promises neither a limit nor an interest rate, explains the personal guarantee and says: the institution alone decides on every loan.",
  bloecke: [
    {
      typ: "text", id: "begriff", h2: "What the term means in the German-speaking market",
      absaetze: [
        "In English, “US funding” usually means grants or venture capital. In the German-speaking market, the term stands for something else: entrepreneurs form a US company, usually an LLC, and use it to build access to capital from US institutions — in other words, US funding for foreign-owned companies. Capital through a US company covers four things that are often mentioned in the same breath but work quite differently:",
      ],
      punkte: [
        "Business credit cards — credit cards in the company’s name, generally with a personal guarantee from the owner",
        "Business credit — the company’s own credit history with commercial credit bureaus, from which supplier credit and later credit lines develop",
        "A banking relationship backed by collateral — credit lines and loans against a deposit, a parent company surety or other assets",
        "Equity — funds from the owners or from investors that are contributed to the company",
      ],
      nach: "The US company is the legal vehicle, not the source: capital only arises when an institution approves on the basis of track record, revenue or collateral. A company that generates capital by itself does not exist. Many providers sell credit cards as the complete solution; cards, however, are only the first level.",
    },
    {
      typ: "tabelle", id: "ebenen", h2: "The three levels of financing",
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
        "This level matters more than many providers say: with a young company, card issuers look at the person behind it and generally require a personal guarantee. There is also a new directive: Executive Order 14406 of 19 May 2026 instructs the US Treasury to warn institutions about misuse. It names the use of an ITIN instead of an SSN in credit and account applications, by applicants whose residence status has not been verified, as a possible risk factor requiring enhanced due diligence. Each institution decides for itself how to put this into practice. Anyone applying with an ITIN should expect follow-up questions — and answer them with complete, consistent information.",
      ],
    },
    {
      typ: "text", id: "ebene2", h2: "Level 2: business credit in the US — your company’s creditworthiness",
      absaetze: [
        "Alongside your personal file, the company can build its own credit history with commercial credit bureaus such as Dun & Bradstreet and Experian. It rests on the EIN issued by the IRS, consistent company details — name, address and phone number identical everywhere — and the nine-digit D-U-N-S Number, which Dun & Bradstreet issues free of charge.",
        "The file is filled by supplier accounts on payment terms, where the supplier reports its payment experience to the bureaus. Dun & Bradstreet’s PAYDEX rates payment punctuality on a scale from 1 to 100; a score of 80 or above is considered to indicate a low risk of late payment. Only payment experiences that suppliers actually report to Dun & Bradstreet feed into the score.",
        "For context: a company’s creditworthiness takes years to grow. For young companies it does not replace the personal guarantee, and for a bank credit line what ultimately counts is revenue, financial statements and reserves — not a score alone.",
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
      lead: `This is how the financing comes about in practice. ${satz("S15", "en")}`,
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
        "A US court has recorded in detail how financing must not be offered. In November 2024, the FTC, the US trade regulator, sued a provider that promised founders business financing. According to the decision of the U.S. District Court for the Central District of California of 16 September 2025, the company in fact applied exclusively for credit cards — by notarised power of attorney in its customers’ names, sometimes for more credit than they had expressly authorised. It charged fees as a percentage of the card limits obtained, plus application fees, surcharges for expedited processing and cancellation fees for leaving before “funding”. In total, around $48.28 million flowed from customers to the provider.",
        "Even without a trial, the court found five advertising claims deceptive: special relationships with lenders, cards “with a line-of-credit function”, periods “without interest”, “no fee until funding” and the statement that the score would not suffer — although the card applications triggered hard enquiries. A standard-form contract also barred customers from posting negative reviews for three years; according to the court, this too violated US law. The court left open whether the promise of “loans and lines of credit” was itself deceptive, because credit cards can legally count as a line of credit.",
        "Under the final order of 1 October 2025, a settlement with the FTC, the provider and its founder are permanently banned from offering loans and business financing; the FTC announced this on 17 November 2025. The monetary judgment of $48,280,328 is partially suspended because the defendants are unable to pay it. The case sets out, point by point, the standard against which every financing offer must be measured — FIAON included.",
      ],
    },
    {
      typ: "karten", id: "warnzeichen", h2: "Warning signs of unsound offers", spalten: 3,
      karten: [
        { tag: "Warning sign", titel: "A fee that grows with every card application", text: "A fee on every further card turns every further application into business for the provider — even when it harms your file. Many applications at once mean many hard enquiries; FICO treats several new accounts in a short period as a higher risk, especially with a short history — and all introductory periods end at the same time." },
        { tag: "Warning sign", titel: "Claimed lender relationships", text: "The claim that the provider’s own contacts at banks bring customers an advantage: the institution decides on every application under its own rules. The court in the FTC case found this very claim deceptive." },
        { tag: "Warning sign", titel: "Interest promises", text: "Anyone who commits to a period without interest or to a fixed interest rate is committing to what only an issuer can set. Some issuers offer introductory periods without debit interest; each issuer sets its own terms." },
        { tag: "Warning sign", titel: "“Tax-free” promises", text: "A US company managed from Germany, Austria or Switzerland remains taxable there. Anyone selling “tax-free” conceals the tax law at home — in Germany, for instance, section 10 of the German Fiscal Code (AO) and section 1 of the Corporate Income Tax Act (KStG) — and the reporting duty under section 138 AO." },
        { tag: "Warning sign", titel: "A promised limit", text: "The institution decides on every limit. Anyone who commits to an amount is committing to what they cannot deliver. You may choose a target yourself — it is not a commitment." },
        { tag: "Warning sign", titel: "SBA loans for non-US owners", text: "Since 1 March 2026, companies whose owners are not, without exception, US citizens or US nationals with their principal residence in the US have been excluded from SBA loans under the 7(a) and 504 programmes. Anyone still offering them is working with outdated knowledge." },
      ],
    },
    {
      typ: "tabelle", id: "pruefliste", h2: "Checklist: ten questions for any offer",
      lead: "Ten questions that a reputable offer answers in writing. If an answer is not forthcoming, that is an answer in itself.",
      kopf: ["Question to the provider", "Reputable answer", "Warning signal"],
      zeilen: [
        ["Who exactly is the contracting party?", "name, legal form, register entry and address are stated in the contract", "only a brand, a messenger channel, no legal entity"],
        // E-509/E-510: our success fee is set by the funding target the client chooses and is stated as an amount in the proposal. The warning
        // signal is therefore a fee that grows with every further card application (guide 5.6 no. 12) — never “a fee based on the limit”.
        ["What does it cost, in full?", "fees and services are set out in writing before you sign", "a fee that grows with every card application; costs in the small print"],
        ["Who decides on credit and limits?", "the institution alone", "“limits you can count on thanks to contacts at banks”"],
        ["Is interest promised?", "no — each issuer sets its own terms", "long periods without interest, fixed interest rates"],
        ["Who makes account, card and credit applications?", "you yourself, with fully prepared documents", "the provider, by power of attorney, in your name"],
        ["How many applications, at what intervals?", "a planned sequence, applications spaced out", "many applications on a single day"],
        ["What happens to your credit?", "hard enquiries and new accounts are explained", "“your score won’t suffer”"],
        ["Who is liable for the cards?", "the owner’s personal guarantee is spelt out", "not a word about it"],
        ["What about tax?", "taxable at home, review by a tax adviser before formation", "“tax-free” or “no tax office involved”"],
        ["Are you free to post reviews of the provider?", "yes, without restriction", "clauses against negative reviews"],
      ],
      fuss: ["The questions draw on what the court objected to in FTC v. Seek Capital and on FIAON Global’s mandatory notices."],
    },
    {
      typ: "text", id: "recht", h2: "Three legal rules for every financing offer",
      absaetze: [
        "In Germany, anyone who commercially arranges the conclusion of loan agreements needs a licence from the competent authority (section 34c(1), first sentence, no. 2 of the German Trade Regulation Code, GewO). FIAON does not lend and does not broker loans. We prepare applications in full; the institution decides on every application. Fees and services are set out in full before you sign.",
        "In the US, knowingly false statements intended to influence a credit decision by a bank with US deposit insurance or by the SBA are a criminal offence (18 U.S.C. § 1014). An invented revenue figure, an embellished business description, a false purpose: whatever a provider “optimises”, you are the one who signs.",
        "And for business credit cards, US consumer protection applies only to a limited extent. Credit for business purposes is exempt from most of the rules of Regulation Z (12 CFR 1026.3); what counts above all is the issuer’s contract.",
        "Partner lawyers and partner tax advisers clarify how these rules apply in your case, in their own professional capacity — FIAON is not a law firm.",
      ],
    },
    {
      typ: "text", id: "fiaon", h2: "What FIAON Global handles",
      absaetze: [
        "We form your US company, apply for the EIN and, following our ITIN check, the ITIN, and provide the registered agent, a US business address and a US telephone number in the first year. We prepare account and card applications in full; you submit the applications yourself.",
        satz("S5", "en"),
      ],
      punkte: [
        `${TEIL.bedingung}: ${satz("S9", "en")} ${satz("S1", "en")}`,
        `Fees: ${P.preisSatz}`,
        `${FINANZIERUNG.ausbleiben!.titel}: ${FINANZIERUNG.ausbleiben!.text}`,
      ],
    },
    {
      typ: "karten", id: "vertiefen", h2: "Each level in detail", spalten: 3,
      karten: [
        { tag: "Service", titel: "Financing and business credit cards", text: "Prepared applications and support through to the lender’s decision.", pfad: "/en/business/us-business-credit-cards" },
        { tag: "Level 1", titel: "Building US credit", text: "How the FICO Score comes about and what a first score requires.", pfad: "/en/business/knowledge/building-us-credit" },
        { tag: "Level 1", titel: "Applying for an ITIN", text: "Form W-7 from abroad, documents and processing time.", pfad: "/en/business/knowledge/applying-for-an-itin" },
        { tag: "Level 2", titel: "Business credit", text: "D-U-N-S Number, PAYDEX and supplier accounts.", pfad: "/en/business/knowledge/us-business-credit" },
        { tag: "Cards", titel: "Applying for a US business credit card", text: "The issuer’s review, personal guarantee, introductory period.", pfad: "/en/business/knowledge/us-business-credit-card" },
        { tag: "Level 3", titel: "Financing routes", text: "Six routes for a US company, by basis and time frame.", pfad: "/en/business/knowledge/us-financing-routes" },
        { tag: "SBA", titel: "SBA loans for non-US citizens", text: "The rule since 1 March 2026 and the routes that remain.", pfad: "/en/business/knowledge/sba-loans-non-us-citizens" },
        { tag: "Caution", titel: "Many card applications at once", text: "Credit file, liability and what a US court found on serial applications.", pfad: "/en/business/knowledge/credit-card-stacking" },
        { tag: "Checklist", titel: "Checking providers", text: "How to recognise a reputable LLC formation provider.", pfad: "/en/business/knowledge/checking-providers" },
      ],
    },
    { typ: "paket", id: "mandat", h2: P.karteH2, lead: P.karteLead, paket: "global_kapital" },
    {
      typ: "hinweis", id: "wissen", h2: "What you need to know",
      punkte: [
        `${satz("S8", "en")} FIAON makes no commitment on any limit.`,
        `${satz("S9", "en")} Nobody can promise a specific limit, score or interest rate.`,
        "Every card application generally leaves an enquiry in your file; new accounts lower the average age of your credit history.",
        GLOBAL_PFLICHTHINWEIS.en[0],
        GLOBAL_PFLICHTHINWEIS.en[1],
        GLOBAL_PFLICHTHINWEIS.en[2],
      ],
    },
  ],
  fragen: [
    { f: "What does the market mean by financing through a US company?", a: "Business credit cards, business credit, a banking relationship backed by collateral, and equity — taken up through your own US company. The financing rests on three levels — personal US credit, the company’s credit, collateral — and grows over months and years. The institution decides on every loan." },
    { f: "Is financing through a US company legitimate?", a: "The route itself is legal and common. Unsound offers are those that promise limits or interest rates, charge a fee that grows with every card application, claim relationships with lenders or sell “tax-free” structures. Following action by the US trade regulator, the FTC, such a provider has been permanently banned from the financing business since 2025." },
    { f: "Can my US LLC get an SBA loan if I live in Europe?", a: "No. Since 1 March 2026, all direct and indirect owners must be US citizens or US nationals with their principal residence in the US (SBA Procedural Notice 5000-876626). A green card is not enough either, and a GmbH or AG as a shareholder also rules out the loan." },
    { f: "How much capital can a US company raise?", a: "Nobody can name a fixed amount. The company is the legal vehicle; capital arises when institutions approve on the basis of track record, revenue or collateral. Cards usually carry smaller limits; larger sums need revenue, a history or collateral." },
    { f: "Can a foreigner get a US business loan?", a: "SBA loans have been excluded since 1 March 2026. Routes that are not tied to nationality remain open: business credit cards with a personal guarantee, supplier credit built on business credit, credit lines against a deposit, a parent company surety or assets. Whether, and on what terms, is decided solely by the institution concerned under its own rules." },
    { f: "How long does it take until financing is possible?", a: `Formation and the EIN are subject to the processing times of the state and the US tax authority. A FICO Score can exist at the earliest after six months with a reported account; solid business credit grows over years. Bank credit lines usually require years of trading, revenue or collateral. Anyone who commits to capital by a fixed date is committing to something only institutions can decide. ${satz("S15", "en")}` },
    { f: "Does FIAON Global raise the capital?", a: `No. ${ROLLE} ${FINANZIERUNG.satz} Your company submits the applications itself. ${satz("S9", "en")} ${satz("S1", "en")}` },
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
