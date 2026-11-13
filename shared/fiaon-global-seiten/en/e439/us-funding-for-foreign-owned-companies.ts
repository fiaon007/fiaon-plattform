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
// Firmenkarte = „business credit card“ (nie „business card“). Haftung der Muttergesellschaft
// = „liability of a parent company“ (wie wissen-finanzierung.ts). Stammdaten = „company details“
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
//
// Second editing round (same day, same guide): every visible text rewritten — statement, condition,
// decision-maker. We speak about ourselves only in the section “fiaon”, in the notice block and in the one
// question about us; the sentences about us under the legal rules, in the “At a glance” box and at the end of
// the court case have moved there. Side-swipes at other providers have given way to criteria. One word per
// thing: “warning sign” (not “warning signal”). Security given to a bank by a parent company is called
// “liability of a parent company”, as in wissen-finanzierung.ts — the other word for it no longer appears
// in any visible text of this page.
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
    beschreibung: "Financing for foreign-owned US companies: three levels (ITIN credit, business credit, collateral), their sequence and the warning signs. With sources.",
  },
  stand: "2026-11-13",
  erschienen: S,
  kennung: "FG · 43",
  auge: "Knowledge · Financing",
  h1: "US funding for foreign-owned companies.",
  h1b: "What it is — and what is reputable.",
  lead: `In the German-speaking market, “US funding” stands for financing through a US company of your own. This article explains the three levels on which US funding for foreign-owned companies rests, their sequence and the features of a reputable offer. ${satz("S1", "en")}`,
  ziffern: [
    { wert: "3 levels", label: "personal US credit, the company’s credit, collateral" },
    { wert: "1 March 2026", label: "since then, SBA loans only if all owners are US citizens residing in the US" },
    { wert: "$48.28 million", label: "monetary judgment against a provider, FTC v. Seek Capital 2025" },
  ],
  blick: [
    ["The term", "Financing through a US company of your own"],
    ["Level 1", "Personal US credit through the ITIN"],
    ["Level 2", "The company’s credit: EIN, D-U-N-S Number, supplier accounts"],
    ["Level 3", "Collateral for larger sums: deposit, parent company, assets"],
    ["Excluded", "SBA loans for owners from Europe, since 1 March 2026"],
    ["Who decides", "The institution concerned — on the account, card, limit and loan"],
    ["You yourself", "You submit every application yourself; business credit cards generally require your personal guarantee"],
  ],
  kurz: "In the German-speaking market, US funding for foreign-owned companies means financing through a US company of your own. It rests on three levels: personal US credit through the ITIN, the company’s credit and collateral. A credit history develops over months and years. A reputable offer states fees and services in writing beforehand, explains the personal guarantee and promises neither a limit nor an interest rate. The institution decides on every loan.",
  bloecke: [
    {
      typ: "text", id: "begriff", h2: "The term in the German-speaking market",
      absaetze: [
        "In English, “US funding” usually means grants or venture capital. In the German-speaking market, the term means financing through a US company of your own, usually an LLC — in other words, US funding for foreign-owned companies. Business owners form the company and apply through it for financing from US institutions. The term covers four things that rest on different foundations:",
      ],
      punkte: [
        "Business credit cards — credit cards in the company’s name, generally with a personal guarantee from the owner",
        "Business credit — the company’s credit history with commercial credit bureaus; supplier credit and, later, credit lines can develop from it",
        "A banking relationship backed by collateral — credit lines and loans against a deposit, the liability of a parent company or other assets",
        "Equity — funds that owners or investors contribute to the company",
      ],
      nach: "The US company is the legal vehicle for the financing, not its source. Capital arises when an institution approves an application on the basis of track record, revenue or collateral. Cards are the first of three levels. Each approval rests with the institution concerned.",
    },
    {
      typ: "tabelle", id: "ebenen", h2: "The three levels of financing",
      lead: "Each level has its own basis and supports a different range of amounts. The levels build on one another; none replaces another.",
      kopf: ["Level", "Basis", "Requirements", "What develops from it", "Who decides"],
      zeilen: [
        ["1 · Personal US credit", "your credit file with Equifax, Experian and TransUnion", "ITIN or SSN, US address, US phone number", "first cards with a small limit; larger limits require a credit history", "the card issuer"],
        ["2 · The company’s credit", "the company’s file with commercial credit bureaus", "EIN, D-U-N-S Number, business account, supplier accounts", "supplier credit, business credit cards, later credit lines", "supplier, issuer, bank"],
        ["3 · Collateral", "assets an institution can have recourse to", "deposit, liability of a parent company, securities account, property", "larger credit lines and loans", "the bank, after its own review"],
      ],
      fuss: ["Simplified overview. Each institution sets its own terms, amounts and interest and decides on every loan."],
    },
    {
      typ: "text", id: "ebene1", h2: "Level 1: personal US credit with ITIN",
      absaetze: [
        "The three nationwide US credit bureaus, Equifax, Experian and TransUnion, keep their own files. Your entries with SCHUFA, KSV1870 or CRIF do not appear there; as a rule, your credit history in the US starts with no entries. Without a Social Security number (SSN), you apply for the ITIN. The US tax authority, the IRS, issues this nine-digit tax processing number to people who cannot obtain an SSN. A FICO Score can exist at the earliest on two conditions: at least one account is six months old or older, and at least one account has been reported to a credit bureau within the last six months.",
        "With a young company, card issuers assess the owner personally and generally require the owner’s personal guarantee. In addition, there is Executive Order 14406 of 19 May 2026. It instructs the US Treasury to warn institutions about misuse. It names the use of an ITIN instead of an SSN as a possible risk factor requiring enhanced due diligence. This concerns credit and account applications by applicants whose residence status has not been verified. Each institution decides for itself how to apply the directive. Anyone applying with an ITIN should expect questions from the institution and should answer them with complete, consistent information.",
      ],
    },
    {
      typ: "text", id: "ebene2", h2: "Level 2: the company’s business credit",
      absaetze: [
        "Alongside your personal file, the company can develop a credit history of its own with commercial credit bureaus such as Dun & Bradstreet and Experian. It rests on three things: the EIN, consistent company details and the nine-digit D-U-N-S Number. The EIN is the company’s tax identification number, issued by the IRS. Consistent means that name, address and phone number are written identically everywhere. Dun & Bradstreet issues the D-U-N-S Number free of charge.",
        "The file is built from supplier accounts on payment terms: suppliers report their payment experience to the bureaus. Dun & Bradstreet’s PAYDEX rates payment punctuality from 1 to 100; a score of 80 or above is considered to indicate a low risk of late payment. Only payment experiences that suppliers report to Dun & Bradstreet feed into the score.",
        "For context: a company’s creditworthiness develops over years. With young companies, the owner’s personal guarantee generally remains in place. For a bank credit line, revenue, financial statements and reserves count; a score alone is not enough. The bank decides.",
      ],
    },
    {
      typ: "text", id: "ebene3", h2: "Level 3: collateral for larger sums",
      absaetze: [
        "In the US, as in Europe, larger amounts require collateral. A bank can grant a credit line against a deposit held with it, against a securities account or against a property. A further form of security is liability assumed by a parent company in Europe for the loan; the bank then mainly assesses that company’s balance sheet. In addition, there is the equity the owners contribute to the company. The bank decides which security is sufficient.",
        "For companies with owners from Europe, the SBA’s government-backed small business loans have been excluded since 1 March 2026. Under Procedural Notice 5000-876626, the 7(a) and 504 programmes require all direct and indirect owners to be US citizens or US nationals with their principal residence in the US. Green card holders are excluded, as are US citizens whose principal residence is abroad. Every company involved must be organised in the US; a GmbH or AG as a shareholder rules out the loan. Offering an SBA loan to an LLC with owners from Europe is at odds with this rule.",
      ],
    },
    {
      typ: "etappen", id: "reihenfolge", h2: "The sequence in practice",
      lead: `Financing generally comes about in this sequence. ${satz("S15", "en")}`,
      etappen: [
        { titel: "Formation and EIN", dauer: "first weeks", text: `You form the company in the appropriate state, with a registered agent (the required address for service in that state) and an operating agreement (the LLC’s company agreement). You apply to the IRS for the EIN from abroad: ${IRS_EN.einDauer}. You report the formation to your tax office at home; in Germany under section 138 of the German Fiscal Code (AO), together with the tax return.` },
        { titel: "ITIN and US address", dauer: "in parallel", text: `You apply for the ITIN with Form W-7 and set up a US address and a US phone number. Both are written identically in every application. For the ITIN, the IRS quotes ${IRS_EN.itinDauer}.` },
        { titel: "Account and company details", dauer: "after the EIN", text: "The company applies for a business account and the D-U-N-S Number. Its company details are the same with every organisation involved. Payment platforms pay out to the account, and revenue becomes visible there. The institution concerned decides on the account." },
        { titel: "First card and supplier accounts", dauer: "first months", text: "A first card application follows, along with supplier accounts arising from your actual business. You pay every statement on time and use only a small share of each limit. The card issuer decides on the card." },
        { titel: "First score, further issuers", dauer: "from about six months", text: "Once an account is six months old and reported, the file meets the minimum requirements for a FICO Score. Further applications follow in an orderly sequence and at intervals. Every enquiry appears in the file. FICO treats several new accounts in a short period as a higher risk." },
        { titel: "Revenue and financial statements", dauer: "ongoing", text: "The company earns revenue through the US account, keeps orderly financial statements and builds reserves. Payment platforms and banks examine these in every significant decision." },
        { titel: "Bank and collateral", dauer: "with a longer track record", text: "A credit line or a loan requires years of trading, revenue or collateral. You submit the application yourself. The bank reviews it under its own rules and decides." },
      ],
    },
    {
      typ: "text", id: "seek", h2: "The case FTC v. Seek Capital",
      absaetze: [
        "In one case, a US court has recorded which advertising claims about financing are deceptive. In November 2024, the FTC, the US trade regulator, sued a provider that promised founders business financing. The U.S. District Court for the Central District of California gave its decision on 16 September 2025. According to its findings, the company applied exclusively for credit cards — by notarised power of attorney in its customers’ names. In some cases it applied for more credit than the customers had expressly authorised. It charged fees as a percentage of the card limits obtained. Added to these were application fees, surcharges for expedited processing and cancellation fees for leaving before “funding”. In total, customers paid the provider around $48.28 million.",
        "Even without a trial, the court found five advertising claims deceptive. They concerned special relationships with lenders, cards “with a line-of-credit function” and periods “without interest”. The others were “no fee until funding” and the statement that the score would not suffer. The card applications did, however, trigger hard enquiries. A standard-form contract also barred customers from posting negative reviews for three years; according to the court, this too violated US law. The court left open whether the promise of “loans and lines of credit” was itself deceptive. The reason: credit cards can legally count as a line of credit.",
        "The final order of 1 October 2025 is a settlement with the FTC. It permanently bans the provider and its founder from offering loans and business financing. The FTC announced this on 17 November 2025. The monetary judgment of $48,280,328 is partially suspended because the defendants are unable to pay it. Every financing offer can be tested against the points of this decision.",
      ],
    },
    {
      typ: "karten", id: "warnzeichen", h2: "Warning signs of unsound offers", spalten: 3,
      karten: [
        { tag: "Warning sign", titel: "A fee that grows with each application", text: "Where the fee grows with every further card, the provider earns from every further application — including one that harms your file. Many applications in a short period lead to many hard enquiries. FICO treats several new accounts in a short period as a higher risk, especially with a short history. In addition, all introductory periods end at the same time." },
        { tag: "Warning sign", titel: "Claimed lender relationships", text: "This means the claim that the provider’s own contacts at banks give its customers an advantage. The institution decides on every application under its own rules. In FTC v. Seek Capital, the court found such a claim deceptive." },
        { tag: "Warning sign", titel: "Interest promises", text: "A provider that commits to a period without interest or to a fixed interest rate promises something only the issuer sets. Some issuers offer introductory periods without debit interest; each issuer sets its own terms." },
        { tag: "Warning sign", titel: "“Tax-free” promises", text: "A US company managed from Germany, Austria or Switzerland remains taxable there. The word “tax-free” passes over the tax law in the country of residence. In Germany, for instance, this is section 10 of the German Fiscal Code (AO) and section 1 of the Corporate Income Tax Act (KStG). The reporting duty under section 138 AO applies in addition." },
        { tag: "Warning sign", titel: "A promised limit", text: "The institution decides on every limit. A provider therefore cannot keep a commitment to a particular amount. You choose a target yourself; it is not a commitment." },
        { tag: "Warning sign", titel: "SBA loans for non-US owners", text: "Since 1 March 2026, SBA loans under the 7(a) and 504 programmes have required all owners to be US citizens or US nationals with their principal residence in the US. Offering such a loan to owners from Europe is at odds with this rule." },
      ],
    },
    {
      typ: "tabelle", id: "pruefliste", h2: "Checklist: ten questions for any offer",
      lead: "A reputable offer answers these ten questions in writing. Where an answer is not given, that counts as a warning sign.",
      kopf: ["Question to the provider", "Reputable answer", "Warning sign"],
      zeilen: [
        ["Who exactly is the contracting party?", "name, legal form, register entry and address are stated in the contract", "only a brand or a messenger channel, no legal entity"],
        // E-509/E-510: our success fee is set by the funding target the client chooses and is stated as an amount in the proposal. The warning
        // sign is therefore a fee that grows with every further card application (guide 5.6 no. 12) — never “a fee based on the limit”.
        ["What does it cost in total?", "fees and services are set out in writing before you sign", "a fee that grows with every card application; costs that are not stated"],
        ["Who decides on credit and limits?", "the institution concerned", "“limits you can count on thanks to contacts at banks”"],
        ["Is interest promised?", "no — each issuer sets its own terms", "long periods without interest, fixed interest rates"],
        ["Who makes account, card and credit applications?", "you yourself, with fully prepared documents", "the provider, by power of attorney, in your name"],
        ["How many applications, at what intervals?", "an orderly sequence, applications spaced out", "many applications on a single day"],
        ["What happens to your credit?", "the provider explains hard enquiries and new accounts", "“your score will not suffer”"],
        ["Who is liable for the cards?", "the provider spells out the owner’s personal guarantee", "no statement on liability"],
        ["What applies to tax?", "taxable in your country of residence; a tax adviser reviews your case before formation", "“tax-free” or “no tax office involved”"],
        ["Are you free to post reviews of the provider?", "yes, without restriction", "clauses against negative reviews"],
      ],
      fuss: ["The questions follow the points the court objected to in FTC v. Seek Capital and the notices at the end of this page."],
    },
    {
      typ: "text", id: "recht", h2: "Three legal rules for every financing offer",
      absaetze: [
        "The first rule applies in Germany. Anyone who commercially arranges the conclusion of loan agreements needs a licence from the competent authority (section 34c(1), first sentence, no. 2 of the German Trade Regulation Code, GewO).",
        "The second rule applies in the US. Knowingly false statements intended to influence a credit decision by a bank with US deposit insurance or by the SBA are a criminal offence (18 U.S.C. § 1014). Examples are an invented revenue figure, an embellished business description or a false purpose. You sign the application yourself, even where a provider prepares it.",
        "The third rule concerns business credit cards: US consumer protection applies to them only to a limited extent. Credit for business purposes is exempt from most of the rules of Regulation Z (12 CFR 1026.3). What counts above all is the issuer’s contract.",
        "How these rules apply in your case rests with partner lawyers and partner tax advisers, who act in their own professional capacity.",
      ],
    },
    {
      typ: "text", id: "fiaon", h2: "What FIAON Global handles",
      absaetze: [
        `We form your US company and apply for the EIN and, following our ITIN check, the ITIN. In the first year we provide the registered agent, a US business address and a US telephone number. ${satz("S2", "en")} ${ROLLE} The checklist on this page applies to us as well.`,
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
        `${satz("S9", "en")} No provider can keep a commitment on a limit, a score or an interest rate.`,
        "Every card application generally leaves an enquiry in your file; new accounts lower the average age of your credit history.",
        GLOBAL_PFLICHTHINWEIS.en[0],
        GLOBAL_PFLICHTHINWEIS.en[1],
        GLOBAL_PFLICHTHINWEIS.en[2],
      ],
    },
  ],
  fragen: [
    { f: "What does the market mean by financing through a US company?", a: "It means four things: business credit cards, business credit, a banking relationship backed by collateral, and equity — each through a US company of your own. The financing rests on three levels: personal US credit, the company’s credit and collateral. It develops over months and years. The institution decides on every loan." },
    { f: "Is financing through a US company legitimate?", a: "The route itself is legal and common. Warning signs are promised limits or interest rates and a fee that grows with every card application. The same applies to claimed relationships with lenders and to the word “tax-free”. Following action by the US trade regulator, the FTC, such a provider has been permanently banned from the financing business since 2025." },
    { f: "Can my US LLC get an SBA loan if I live in Europe?", a: "No. Since 1 March 2026, all direct and indirect owners must be US citizens or US nationals with their principal residence in the US (SBA Procedural Notice 5000-876626). A green card is not sufficient. A GmbH or AG as a shareholder also rules out the loan." },
    { f: "How much capital can a US company raise?", a: "There is no fixed amount. The company is the legal vehicle; capital arises when institutions approve on the basis of track record, revenue or collateral. Cards usually have smaller limits. Larger sums require revenue, a credit history or collateral. The institution concerned decides on the amount." },
    { f: "Can a foreigner get a US business loan?", a: "SBA loans have been excluded since 1 March 2026. Other routes are not tied to nationality: business credit cards with a personal guarantee, supplier credit built on business credit, and credit lines against collateral. A deposit, liability assumed by a parent company or other assets can serve as collateral. Whether, and on what terms, is for the institution concerned to decide." },
    { f: "How long does it take until financing is possible?", a: `Formation and the EIN are subject to the processing times of the state and the US tax authority. A FICO Score can exist at the earliest after six months with a reported account. A company’s creditworthiness develops over years. Bank credit lines usually require years of trading, revenue or collateral. No provider can commit to capital by a fixed date; that is for the institutions to decide. ${satz("S15", "en")}` },
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
