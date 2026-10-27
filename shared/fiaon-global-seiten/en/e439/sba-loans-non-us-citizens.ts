// ═══════════════════════════════════════════════════════════════════════════
// FIAON GLOBAL — KNOWLEDGE: SBA LOANS FOR NON-US CITIZENS (27.10.2026, E-439, FG · 44)
//
// Die englische Schwester von ../../e439/sba-kredit-auslaender.ts (Pfeiler zur
// SBA-Regel seit 01.03.2026, aus Sicht eines Eigentümers aus Deutschland,
// Österreich oder der Schweiz — und die Kapitalwege, die bleiben).
// Hauptsuchwort „SBA loan non-US citizen“ (Titel, H1, Kurz, erster Absatz, H2),
// daneben can a foreigner get an SBA loan, SBA loan green card holder 2026,
// business loan foreign-owned LLC (kw_en.md, Abschnitt 5.1).
//
// Britisches Englisch, dieselben Bausteine in derselben Reihenfolge, dieselben ids
// und dieselbe Zahl an Absätzen, Punkten, Zeilen, Spalten, Karten, Etappen, Fragen,
// Blick-Zeilen und Ziffern; Quellen mit denselben Adressen (englische Titel).
// Inhaltlich identisch mit der deutschen Fachprüfung vom 27.10.2026:
//   · SBA Procedural Notice 5000-876626 (11.02.2026, gültig ab 01.03.2026),
//     Absatz F und Anhang 3 „Ineligible Person“, Hauptwohnsitz nach IRS
//     Publication 523, R1-Übergang bis 28.02.2026 23:59 Uhr Ostküstenzeit,
//     Sechs-Monats-Rückblick, „limited guaranty“, Ehepartner/minderjährige Kinder.
//   · SBA Policy Notice 5000-876441 (02.02.2026; hebt 5000-872050 auf).
//   · GAO B-338157 (01.07.2026), SOP 50 10 8 (01.06.2025), Info Notice
//     5000-877673 (31.03.2026), rund 45 Mrd. $ im FJ 2025, 85 %/75 %, CDC ≤ 40 %.
//   · SBA Information Notice 5000-880695 → SOP 50 10 8.1 seit 01.10.2026,
//     504-Debenture 5 Mio. $ je Unternehmen, 5,5 Mio. $ je Projekt.
//   · 18 U.S.C. § 1014 → begrenzt auf Institute mit FDIC-Einlagensicherung.
//
// Wortwand EN: kein „up to“, kein Bankname, kein Zinssatz, kein „recommend“,
// „guarantee“ nur als „personal guarantee“ (die SBA-Bürgschaft heißt hier „backs“,
// die Zusatzbürgschaft mit dem SBA-Fachwort „limited guaranty“), kein „available“
// im Satz mit Kredit/Kapital. FIAON vermittelt keine Kredite, über jeden Kredit
// entscheidet das Institut. „Business consultancy“ als Selbstbezeichnung (E-439).
// Geld-zurück steht (wie im Deutschen) nicht auf dieser Seite.
// ═══════════════════════════════════════════════════════════════════════════
import type { GlobalQuelle, GlobalSeite } from "../../typen";
import { GLOBAL_KAPITAL_FREI, GLOBAL_PFLICHTHINWEIS, globalPaket } from "../../../fiaon-global";
import { IRS_EN, QUELLEN_WISSEN_EN as Q } from "../../fakten-en";

const S = "2026-10-27";
const KAPITAL_FREI = `${GLOBAL_KAPITAL_FREI.en.satz} ${GLOBAL_KAPITAL_FREI.en.steuer}`;
const KAPITAL = globalPaket("global_kapital")?.en.name ?? "Global Capital";

/** Quellen dieses Beitrags — dieselben Adressen wie im Deutschen, englische Titel. */
const QUELLEN: Record<string, GlobalQuelle> = {
  policy: { titel: "SBA Policy Notice 5000-876441 — Citizenship and Residency Requirements (published 2 February 2026, effective 1 March 2026)", url: "https://www.sba.gov/document/policy-notice-5000-876441-update-sop-50-10-8-citizenship-residency-requirements-recission-procedural-notice-5000-872050" },
  procedural: { titel: "SBA Procedural Notice 5000-876626 — Revised Applicant Ownership, Citizenship, and Residency Requirements for 7(a) and 504 Loans (11 February 2026)", url: "https://www.sba.gov/document/procedural-notice-5000-876626-revised-applicant-ownership-citizenship-residency-requirements-7a-504-loans" },
  proceduralText: { titel: "SBA Procedural Notice 5000-876626 — full text (SBA PDF)", url: "https://legacy.sba.gov/sites/default/files/2026-02/Procedural%20Notice%205000-876626%20-%20Revised%20Applicant%20Ownership%20Citizenship%20and%20Residency%20%20OFA%202.11.pdf" },
  sop81: { titel: "SBA Information Notice 5000-880695 — Issuance of SOP 50 10 8.1 (published 14 August 2026, effective 1 October 2026)", url: "https://www.sba.gov/document/information-notice-5000-880695-issuance-sop-50-10-81" },
  sop: { titel: "SBA SOP 50 10 — Lender and Development Company Loan Programs (version 8.1, effective 1 October 2026)", url: "https://www.sba.gov/document/sop-50-10-lender-development-company-loan-programs" },
  fuenfProzent: { titel: "SBA Procedural Notice 5000-872050 — five per cent exception (19 December 2025, rescinded)", url: "https://www.sba.gov/document/procedural-notice-5000-872050-procedural-notice-5000-872050-update-sop-50-10-8-citizenship-residency-requirements" },
  gao: { titel: "GAO B-338157 — Applicability of the Congressional Review Act to SBA Notices (1 July 2026)", url: "https://www.gao.gov/products/b-338157" },
  gaoText: { titel: "GAO B-338157 — full text of the decision (PDF)", url: "https://www.gao.gov/assets/890/886932.pdf" },
  sba7a: { titel: "U.S. Small Business Administration — 7(a) Loans", url: "https://www.sba.gov/loans/7a-loans/" },
  sba504: { titel: "U.S. Small Business Administration — 504 Loans", url: "https://www.sba.gov/loans/504-loans/" },
  p523: { titel: "IRS Publication 523 — Selling Your Home (Main Home)", url: "https://www.irs.gov/publications/p523" },
  usc1014: { titel: "18 U.S. Code § 1014 — False statements in loan and credit applications", url: "https://www.law.cornell.edu/uscode/text/18/1014" },
};

export const SEITE: GlobalSeite = {
  pfad: "/en/business/knowledge/sba-loans-non-us-citizens",
  sprache: "en",
  schwester: "/business/wissen/sba-kredit-auslaender",
  art: "wissen",
  seo: {
    titel: "SBA loan as a non-US citizen: the 2026 rule — FIAON Global",
    beschreibung: "SBA loan as a non-US citizen: since 1 March 2026, 7(a) and 504 loans go only to US owners living in the US. What applies and which capital routes remain.",
  },
  stand: S,
  erschienen: S,
  kennung: "FG · 44",
  auge: "Knowledge · Capital",
  h1: "SBA loan as a non-US citizen.",
  h1b: "This door is closed. Other routes remain.",
  lead: "Since 1 March 2026, loans from the 7(a) and 504 programmes of the US Small Business Administration (SBA) have been open only to companies whose owners are, without exception, US citizens or US nationals with their principal residence in the US. Green card holders are excluded too. This article sets out exactly what the rule says, what it means for entrepreneurs from Germany, Austria and Switzerland, and which routes to capital remain open to a US company.",
  ziffern: [
    { wert: "1 March 2026", label: "since then the stricter SBA rule has applied" },
    { wert: "100%", label: "of owners: US citizens or US nationals with principal residence in the US" },
    { wert: "about $45bn", label: "in SBA-backed 7(a) and 504 loans in fiscal year 2025" },
  ],
  blick: [
    ["In force since", "1 March 2026 (Procedural Notice 5000-876626), since 1 October 2026 part of SOP 50 10 8.1"],
    ["Applies to", "All variants of 7(a) as well as 504"],
    ["Eligible", "Only US citizens and US nationals with principal residence in the US"],
    ["Excluded", "Residence abroad, green card, visa, foreign parent company"],
    ["What remains", "Business credit, business credit cards, bank loan against collateral, equity, home bank"],
    ["Who decides", "The institution alone, on every loan"],
    ["With FIAON Global", "One point of contact, every application prepared, fixed price"],
  ],
  kurz: "No — if you live in Germany, Austria or Switzerland, your US company cannot obtain an SBA loan, whether you are a non-US citizen or a US citizen. Since 1 March 2026, 100 per cent of the direct and indirect owners must be US citizens or US nationals with their principal residence in the US (SBA Procedural Notice 5000-876626, part of SOP 50 10 8.1 since 1 October 2026); a green card, a visa, residence abroad or a foreign parent company rules out 7(a) and 504. What remains open is business credit and business credit cards, a bank loan against collateral, equity and your home bank in Europe — the institution decides on every loan.",
  bloecke: [
    {
      typ: "text", id: "regel", h2: "SBA loan as a non-US citizen: the rule since 1 March 2026",
      absaetze: [
        "For anyone considering an SBA loan as a non-US citizen, it helps to start with how the programmes work. In its 7(a) and 504 programmes, the Small Business Administration (SBA) does not lend the money itself. It backs loans that banks and other approved lenders make to small and medium-sized businesses: if a loan defaults, the lender and the SBA share the loss according to the portion the SBA has backed. Which businesses may enter these programmes is set out in its standard operating procedure, SOP 50 10. Since 1 October 2026, version 8.1 has applied to every application that receives an SBA loan number on or after that day.",
        "On 2 February 2026 the SBA tightened the ownership rule with Policy Notice 5000-876441, and on 11 February 2026 it wrote the change into its procedures with Procedural Notice 5000-876626. Since 1 March 2026, the core sentence has read, in substance: SBA financing is open only to applicants whose direct and indirect owners — and any guarantors the SBA requires — are 100 per cent US citizens or US nationals with their principal residence in the United States, its territories or possessions. The new SOP 50 10 8.1 contains this sentence in the same wording.",
        "Two additions settle the matter for entrepreneurs from the German-speaking region. Every company that holds a direct or indirect stake must be organised in the US. And the SBA determines principal residence according to IRS Publication 523: each person has only one principal residence. For someone with several homes, what counts above all is where they spend most of their time; the other factors are the address used for post, on the electoral roll, on tax returns and on the driving licence, and proximity to work, bank and family.",
      ],
      punkte: [
        "The lender must record all direct and indirect owners in the SBA's system and confirm, to the best of its knowledge, that neither any of them nor any required guarantor is ineligible.",
        "The applicant, too, confirms with its signature that none of its direct or indirect owners or guarantors is ineligible.",
        "Interests held by spouses and minor children are added together.",
        "An ineligible person who held a stake in the six months before the SBA loan number is assigned makes the company ineligible — unless they have fully divested their interest before then.",
      ],
    },
    {
      typ: "tabelle", id: "wer", h2: "Who may be an owner from March 2026 — and who may not",
      lead: "Appendix 3 of the procedures lists who counts as an “Ineligible Person” — and states expressly that the list is not exhaustive. For owners from Germany, Austria and Switzerland, five of these groups are decisive.",
      kopf: ["Owner", "SBA loan possible?", "Reference in SOP 50 10 8.1"],
      zeilen: [
        ["US citizen with principal residence in the US", "yes", "Paragraph F, item 1"],
        ["Naturalised US citizen with principal residence in the US", "yes, without additional verification", "Paragraph F, item 3"],
        ["Non-citizen US national with principal residence in the US", "yes, with proof of status", "Paragraph F, item 2"],
        ["German, Austrian and Swiss nationals without US citizenship", "no", "Appendix 3, item 3"],
        ["US citizen with principal residence in Germany, Austria or Switzerland", "no", "Appendix 3, item 4"],
        ["Green card holder, including one with conditional status", "no", "Appendix 3, item 7"],
        ["Visa holder, for example on an E-2 visa", "no", "Appendix 3, item 2"],
        ["GmbH, AG or other company organised outside the US as a shareholder", "no", "Appendix 3, item 5"],
      ],
      hervor: 1,
      fuss: [
        "Source: SBA SOP 50 10 8.1 (in force since 1 October 2026), Section A, Chapter 1, Paragraph F and Appendix 3 — identical in wording to Procedural Notice 5000-876626 of 11 February 2026. Non-citizen US nationals include, for example, people born in American Samoa.",
        "One exception concerns guarantors only: if the lender requires a limited guaranty (the SBA's term for additional security limited in amount), an ineligible person may also provide it. That person may not be an owner.",
      ],
    },
    {
      typ: "text", id: "programme", h2: "What this means for 7(a) and 504",
      absaetze: [
        "The 7(a) programme is the SBA's main route for business loans. A lender makes the loan and the SBA backs part of it: for most variants, no more than 85 per cent on loans of $150,000 or less and no more than 75 per cent above that. The maximum for a 7(a) loan is $5 million, and it can be used for working capital, machinery and equipment, real estate, the refinancing of existing debt and the purchase of a business. The notice also expressly amends the application documents for the 7(a) Small, SBA Express, CAPLines, Export Express, Export Working Capital and International Trade variants — the ownership rule applies to all of them.",
        "The 504 programme provides long-term finance for major fixed assets: land, buildings and machinery with a remaining useful life of at least ten years. A private lender, a Certified Development Company (CDC) and the business owner share the financing; the CDC's share is no more than 40 per cent, and the SBA backs that share in full. That share is capped at $5 million per business, or $5.5 million per project for manufacturers and certain energy projects. The same ownership rule applies to 504 as to 7(a).",
        "A figure from a decision of the US Government Accountability Office (GAO) shows how much weight both programmes carry: in fiscal year 2025 the SBA backed 7(a) and 504 loans totalling about $45 billion to more than 85,000 small businesses. Loans approved before 1 March 2026 may continue to be serviced; according to an SBA notice of 31 March 2026, however, they may not be increased if the company does not meet the new rule.",
      ],
    },
    {
      typ: "etappen", id: "verlauf", h2: "How the rule came about",
      lead: "For owners living in Europe, an SBA loan was barely within reach even before 2026. The new rule has closed the last exceptions as well.",
      etappen: [
        { titel: "Standard operating procedure SOP 50 10 8", dauer: "1 June 2025", text: "All owners must be US citizens, US nationals or green card holders, with their principal residence in the US. Anyone living in Germany, Austria or Switzerland is therefore already excluded." },
        { titel: "Five per cent exception", dauer: "19 December 2025", text: "Procedural Notice 5000-872050 allows foreign nationals residing outside the US, US citizens and green card holders with their principal residence abroad, and holders of a conditional green card to hold no more than five per cent of the shares between them — for loans the SBA approves on or after 1 January 2026." },
        { titel: "Policy Notice 5000-876441", dauer: "2 February 2026", text: "The SBA announces that from 1 March 2026 the five per cent exception will end and green card holders may no longer hold any stake." },
        { titel: "Procedural Notice 5000-876626", dauer: "11 February 2026", text: "The change becomes part of the procedures. The SBA still processes applications under non-delegated processing with green card owners that had reached review status R1 in its system by 11.59 pm Eastern Time on 28 February 2026." },
        { titel: "The rule applies", dauer: "1 March 2026", text: "From this day, what counts under delegated processing is the date the SBA loan number is assigned; under non-delegated processing, it is the date on which the application reaches status R1 in the SBA's system. Since then, only companies that are 100 per cent US-owned have been eligible." },
        { titel: "Decision of the US Government Accountability Office", dauer: "1 July 2026", text: "In B-338157 the GAO finds that both notices are a rule within the meaning of the Congressional Review Act and should have been submitted to Congress and the Comptroller General, the head of the GAO, before taking effect. The SBA had submitted no such report and did not respond in substance to the GAO's enquiry." },
        { titel: "New version: SOP 50 10 8.1", dauer: "1 October 2026", text: "The SBA incorporates both notices into the new version of its procedures. It applies to every application that receives an SBA loan number on or after this day; the ownership rule appears there in the same wording." },
        { titel: "Today", dauer: "As of 27 October 2026", text: "The rule is being applied. We have found no repeal by the SBA and no resolution by Congress." },
      ],
    },
    {
      typ: "karten", id: "wege", h2: "Capital for your US LLC: the routes that remain", spalten: 3,
      lead: "This does not rule out a US loan for a foreign-owned company — it simply no longer runs through the SBA. Each route rests on something different, and the institution decides on every one.",
      karten: [
        { tag: "Business credit", titel: "Build business credit", text: "A D-U-N-S Number from the business credit bureau, first supplier accounts with payment terms, paid early: this creates the company's own credit profile, which lenders can review.", pfad: "/en/business/knowledge/us-business-credit" },
        { tag: "Business credit cards", titel: "Cards based on balance and history", text: "Some business credit cards set the limit by reference to the company's account balance. As a rule they require the owner's personal guarantee; each issuer sets the terms itself.", pfad: "/en/business/knowledge/us-business-credit-card" },
        { tag: "Bank", titel: "Loan against collateral", text: "Without the SBA, the bank bears the default risk alone. It then looks at years of trading, revenue and collateral: a deposit, the parent company standing as guarantor, or a property.", pfad: "/en/business/knowledge/us-financing-routes" },
        { tag: "Equity", titel: "Contribution or shareholder loan", text: "You or your parent company fund the US company directly. If the LLC belongs solely to a foreign owner, it reports every contribution and every loan on the annual Form 5472.", pfad: "/en/business/us-subsidiary" },
        { tag: "Europe", titel: "Your home bank", text: "Your bank in Germany, Austria or Switzerland has known your figures for years. A loan to you or your GmbH can flow into the US company as capital." },
        { tag: "Property", titel: "Financing a property", text: "For rental properties, there are financing options that mainly assess whether the rent covers the instalments — with equity and reserves from your own funds.", pfad: "/en/business/knowledge/financing-us-property" },
      ],
    },
    {
      typ: "tabelle", id: "vergleich", h2: "With and without the SBA: what changes for the bank",
      lead: "For many banks the SBA loan was attractive because the agency carries part of the risk. If that part falls away, the bank's question does not change — its yardstick does.",
      kopf: ["", "SBA loan (7(a) or 504)", "Bank loan without the SBA"],
      zeilen: [
        ["Who bears the default risk", "lender and SBA, under the programme's rules", "the bank alone"],
        ["Owners", "only US citizens and US nationals with principal residence in the US", "set by each bank"],
        ["What is reviewed", "the SBA's rules and the bank's own review", "the bank's own review: years of trading, revenue, collateral"],
        ["Maximum amount", "7(a): $5 million; 504: CDC share $5 million per business", "set by each bank"],
        ["For owners resident in Europe", "excluded", "possible if the bank agrees"],
      ],
      hervor: 2,
      fuss: ["General overview, as of October 2026. Each institution sets its own terms, amounts and collateral."],
    },
    {
      typ: "text", id: "europa", h2: "Equity and home bank: the route through Europe",
      absaetze: [
        "For many entrepreneurs from the German-speaking region, the strongest capital lies not in the US but at home: in their own GmbH, in reserves, in a banking relationship built up over many years. The US company can be funded from these resources — as a contribution that increases its equity, or as a loan from the shareholder to its subsidiary.",
        `Both have consequences that need to be clarified in advance. In Germany, a loan between you or your GmbH and the US company is subject to the arm's length principle: if terms that independent third parties would not have agreed reduce your income, that income is assessed for tax as it would have been between independent parties (section 1 of the German Foreign Tax Act, AStG). In the US, an LLC owned solely by a foreign owner reports every contribution, every distribution and every loan between itself and that owner on Form 5472; anyone who fails to do so risks a penalty of ${IRS_EN.strafe5472}.`,
        KAPITAL_FREI,
      ],
    },
    {
      typ: "text", id: "vorsicht", h2: "Beware when “funding” is meant to replace the SBA loan",
      absaetze: [
        "Where an official route closes, offers spring up that promise fast capital without a review — often with sample limits in dollars and stacked credit cards. On 17 November 2025, the US Federal Trade Commission (FTC) announced that the provider Seek Capital and its chief executive had been permanently banned from the business financing industry to settle the FTC's allegations. According to the FTC, the company had advertised special relationships with lenders and favourable terms, but then charged business owners thousands of dollars merely to open credit cards, costing those affected millions and damaging their creditworthiness.",
        "The benchmark that follows from this applies to every provider, including us: state fees in advance, claim no relationship with lenders that does not exist, commit to no limit, and explain openly how each application affects the credit file.",
      ],
    },
    {
      typ: "text", id: "fiaon", h2: "How FIAON Global takes over your route to capital",
      absaetze: [
        "It begins with an honest assessment: we set your ownership structure against the SBA's published rules and record in writing the routes on which we plan to build your capital. For owners living in Germany, Austria or Switzerland, that currently means no SBA loan — and therefore building on the routes that remain from the very start. If a legal question remains open in an individual case, our partner lawyers clarify it under your engagement.",
        `From then on: one point of contact instead of eight. With your power of attorney, we submit all applications for you — formation of the company, EIN, preparation of your ITIN, the D-U-N-S Number, the ongoing filings. We provide the registered agent, a US business address and a US phone number for the first year. You submit account, card and credit applications yourself, fully prepared by us and with the same details in every application. We plan the order in which to approach the institutions, put together the key-figures file for your home bank and prepare the documents a bank wants to see for a loan against collateral. If an institution requires an appointment in person, our team on the ground in Miami is at your side; in the ${KAPITAL} package, your appointments take priority.`,
        "Our partner tax adviser clarifies with you whether a contribution or a shareholder loan is the right form and how your structure at home is treated for tax purposes; our US CPA prepares the annual Form 5472, and our partner lawyers draw up the operating agreement and formation documents. All of them act under your engagement, and FIAON bears their fees for the services in the package. All package fees are included in the fixed price. Our team is based in Miami, our partner location is Zurich, and your contracting party is FIAON LTD in London. From the second year onwards you can choose the annual care plan; it is optional.",
        "FIAON Global is a business consultancy for the move to the US, not a bank: we neither grant nor broker loans, and we commit to no limit.",
      ],
    },
    { typ: "paket", id: "paket", h2: "The whole route to capital in one package", lead: `Company, tax identification numbers, business credit, account, business credit cards step by step and the documents for a bank loan — ${KAPITAL}. The capital range of the package is your goal, not a commitment.`, paket: "global_kapital" },
    {
      typ: "hinweis", id: "wissen", h2: "What you need to know",
      punkte: [
        "FIAON is not a bank, does not grant credit, does not broker credit and does not commit to any limit. The institution alone decides on the account, the card, the limit and the loan; the capital range of a package is a goal.",
        "Whether the SBA rule will stand remains a political question. What counts is the version in force on the day of your application — and that is the version the lender checks.",
        "An ownership structure that exists only on paper, such as a US citizen acting as a nominee owner, would be a false statement. 18 U.S.C. § 1014 makes knowingly false statements in loan applications a crime, including those made to institutions with FDIC deposit insurance.",
        GLOBAL_PFLICHTHINWEIS.en[0],
        GLOBAL_PFLICHTHINWEIS.en[2],
      ],
    },
  ],
  fragen: [
    { f: "Can I get an SBA loan as a non-US citizen?", a: "No, not if you live in Germany, Austria or Switzerland. Since 1 March 2026, all direct and indirect owners must be US citizens or US nationals with their principal residence in the US. This applies to 7(a) and 504 (SBA Procedural Notice 5000-876626)." },
    { f: "Can green card holders still get an SBA loan?", a: "No. Since 1 March 2026, green card holders, including those with conditional status, may not hold any stake in a company applying for a 7(a) or 504 loan. Only applications under non-delegated processing that had reached review status R1 by 11.59 pm Eastern Time on 28 February 2026 were still processed by the SBA." },
    { f: "I am a US citizen but live in Germany. Can I get an SBA loan?", a: "No. US citizens and US nationals whose principal residence is outside the US are also ineligible. The SBA determines principal residence according to IRS Publication 523: what counts is the home in which you spend most of your time." },
    { f: "Can my GmbH apply for an SBA loan for its US subsidiary?", a: "No. Every company that holds a direct or indirect stake in the applicant must be organised in the US. A GmbH, AG or foundation from Europe as a shareholder rules out the application." },
    { f: "Does an E-2 visa with a home in Miami help?", a: "Not for the SBA loan. Visa holders are expressly listed as ineligible persons, even if they live in the US. The E-2 visa can matter for your work in the US, but it does not open the SBA route. Whether it is an option for you is assessed by immigration lawyers case by case." },
    { f: "Is it enough if a US partner holds the majority?", a: "No. The rule requires 100 per cent; a single ineligible owner is enough to exclude the company. It can only be considered if that person has fully divested their stake before the SBA loan number is assigned. An owner on paper only would be a false statement." },
    { f: "Did the GAO decision repeal the rule?", a: "No. On 1 July 2026, the US Government Accountability Office (GAO) found that the notices are a rule within the meaning of the Congressional Review Act and should have been submitted to Congress. As of 27 October 2026, we have found no repeal. On the contrary: since 1 October 2026, the rule has been part of the new version of the procedures, SOP 50 10 8.1." },
    { f: "What financing remains for my US LLC instead?", a: "Business credit with a D-U-N-S Number and supplier accounts, business credit cards, a bank loan against collateral such as a deposit, the parent company standing as guarantor or a property, equity, and loans from your home bank in Europe. The institution decides on every loan; FIAON prepares the route and every application." },
  ],
  paket: "global_kapital",
  weiter: ["/en/business/knowledge/us-financing-routes", "/en/business/knowledge/us-business-credit", "/en/business/knowledge/us-funding-for-foreign-owned-companies", "/en/business/knowledge/e2-visa-own-us-company"],
  quellen: [
    QUELLEN.procedural,
    QUELLEN.proceduralText,
    QUELLEN.sop81,
    QUELLEN.sop,
    QUELLEN.policy,
    QUELLEN.fuenfProzent,
    QUELLEN.gao,
    QUELLEN.gaoText,
    QUELLEN.sba7a,
    QUELLEN.sba504,
    QUELLEN.p523,
    Q.i5472,
    Q.astg1,
    Q.ao138,
    Q.duns,
    Q.ftcSeek,
    QUELLEN.usc1014,
  ],
};
