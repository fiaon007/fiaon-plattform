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
// Geld-zurück steht (wie im Deutschen) nur als fester Satz (P.geldZurueck) im Abschnitt über uns.
// Runde zwei des Sprachleitfadens: jeder sichtbare Text neu gefasst (kurze Sätze, Sachtitel, FIAON nur im
// Abschnitt „fiaon“ und im Vermerk „wissen“). Der Satz “Owners whose principal residence is outside the United
// States are excluded from SBA loans.” bleibt wörtlich. Der Kapital-Satz (GLOBAL_KAPITAL_FREI) steht im Vermerk.
// ═══════════════════════════════════════════════════════════════════════════
import type { GlobalQuelle, GlobalSeite } from "../../typen";
// E-509 (12.11.2026): EIN Produkt statt vier Pakete — kein Paketname, Honorar und Kapitalrahmen aus EIN_PRODUKT.
// E-510 (13.11.2026, language guide): the one section about us is “What FIAON Global handles”, built from the fixed sentences
// (step 5 in the version in force today, S7, S8, S9) — shared/fiaon-global-saetze.ts. The guarantors of an SBA loan and a parent
// company standing as guarantor are market knowledge; no sentence says that FIAON or a connected company stands as guarantor.
// Never here: “through to payout” (it is: through to the lender’s decision), a partner at work in the present tense, a place for
// the partners, a country in the section on accounts, cards and financing.
import { GLOBAL_KAPITAL_FREI, GLOBAL_PFLICHTHINWEIS } from "../../../fiaon-global";
import { SCHRITTE_KOPF, SECHS_SCHRITTE, satz } from "../../../fiaon-global-saetze";
import { EIN_PRODUKT } from "../../ein-produkt";
import { IRS_EN, QUELLEN_WISSEN_EN as Q } from "../../fakten-en";

/** Date of first publication (E-439). */
const S = "2026-10-27";
const KAPITAL_FREI = `${GLOBAL_KAPITAL_FREI.en.satz} ${GLOBAL_KAPITAL_FREI.en.steuer}`;
const P = EIN_PRODUKT.en;
/** Step 5 of the fixed narrative (language guide 2.3, the version in force today) — verbatim from the one source. */
const FINANZIERUNG = SECHS_SCHRITTE.en.find((x) => x.nr === 5)!;
/** The names of the fixed parts of a step: “Your part”, “Condition” (language guide 2.1). */
const TEIL = SCHRITTE_KOPF.en.teile;
/** The first two sentences of the role (S8): neither a bank nor a law firm; does not lend and does not broker loans. */
const ROLLE = satz("S8", "en").split(/(?<=\.)\s+/).slice(0, 2).join(" ");

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
    beschreibung: "SBA loan as a non-US citizen: since 1 March 2026, 7(a) and 504 loans go only to US owners living in the US. The rule and the alternatives, with sources.",
  },
  stand: "2026-11-13",
  erschienen: S,
  kennung: "FG · 44",
  auge: "Knowledge · Financing",
  h1: "SBA loan as a non-US citizen.",
  h1b: "Excluded since March 2026. Alternatives remain.",
  lead: "An SBA loan as a non-US citizen has been ruled out since 1 March 2026. Under its 7(a) and 504 programmes, the US Small Business Administration (SBA) admits only companies whose owners are all US citizens or US nationals with principal residence in the US. Green card holders are excluded as well. This article explains the rule, its consequences for owners resident in Europe and the financing routes that remain for a US company.",
  ziffern: [
    { wert: "1 March 2026", label: "since then the stricter SBA ownership rule has applied" },
    { wert: "100%", label: "of owners: US citizens or US nationals with principal residence in the US" },
    { wert: "about $45bn", label: "in 7(a) and 504 loans backed by the SBA in fiscal year 2025, according to the GAO" },
  ],
  blick: [
    ["In force since", "1 March 2026 (Procedural Notice 5000-876626), since 1 October 2026 part of SOP 50 10 8.1"],
    ["Applies to", "7(a) in all its variants, and 504"],
    ["Eligible", "Only US citizens and US nationals with principal residence in the US"],
    ["Excluded", "Residence abroad, green card, visa, foreign parent company"],
    ["What remains", "Business credit, business credit cards, bank loan against collateral, equity, home bank"],
    ["Who decides", "On every loan, the institution concerned"],
    ["With FIAON Global", "Every application prepared in full, support through to the lender’s decision"],
  ],
  kurz: "No. An SBA loan as a non-US citizen has been ruled out since 1 March 2026. Under 7(a) and 504, 100 per cent of the direct and indirect owners must be US citizens or US nationals with their principal residence in the US. Source: SBA Procedural Notice 5000-876626, part of SOP 50 10 8.1 since 1 October 2026. What remains is business credit, a bank loan against collateral and equity. The institution decides on every loan.",
  bloecke: [
    {
      typ: "text", id: "regel", h2: "SBA loans for non-US citizens: the rule",
      absaetze: [
        "Anyone considering an SBA loan as a non-US citizen should first know how the programmes work. Banks and other approved lenders make the loans under the 7(a) and 504 programmes to small and medium-sized businesses. The Small Business Administration (SBA) backs a portion of these loans. If a loan defaults, the lender and the SBA share the loss according to that portion. The SBA's standard operating procedure, SOP 50 10, sets out which businesses are eligible. Since 1 October 2026, version 8.1 has applied to every application that receives an SBA loan number on or after that day.",
        "On 2 February 2026 the SBA tightened the ownership rule with Policy Notice 5000-876441. On 11 February 2026 it wrote the change into its procedures with Procedural Notice 5000-876626. Since 1 March 2026 the core sentence has read, in substance, as follows. SBA financing goes only to applicants whose direct and indirect owners are 100 per cent US citizens or US nationals. Each owner's principal residence must be in the United States, its territories or possessions. The same requirements apply to every guarantor the SBA requires. SOP 50 10 8.1 contains the core sentence in the same wording.",
        "Two additions bear directly on owners from Europe. First, every company that holds a direct or indirect stake must be organised in the US. Second, the SBA determines principal residence according to IRS Publication 523: each person has only one. Where someone has several homes, what counts above all is where they spend most of their time. Other factors are the address used (post, electoral roll, tax returns, driving licence) and proximity to work, bank and family.",
      ],
      punkte: [
        "The lender must record all direct and indirect owners in the SBA's system. It confirms, to the best of its knowledge, that no owner and no required guarantor is ineligible.",
        "The applicant, too, confirms with its signature that none of its direct or indirect owners or guarantors is ineligible.",
        "The SBA adds together interests held by spouses and minor children.",
        "If an ineligible person held a stake in the six months before the SBA loan number is assigned, the company is ineligible. This does not apply if that person fully divested the interest beforehand.",
      ],
    },
    {
      typ: "tabelle", id: "wer", h2: "Eligible and ineligible owners",
      lead: "The table shows who may be an owner since 1 March 2026. Appendix 3 of the procedures lists who counts as an “Ineligible Person”; the list is expressly not exhaustive. For owners from Germany, Austria and Switzerland, five of these groups are decisive.",
      kopf: ["Owner", "Eligible as owner", "Reference in SOP 50 10 8.1"],
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
        "Source: SBA SOP 50 10 8.1 (in force since 1 October 2026), Section A, Chapter 1, Paragraph F and Appendix 3. The wording is identical to Procedural Notice 5000-876626 of 11 February 2026. Non-citizen US nationals include, for example, people born in American Samoa.",
        "One exception concerns guarantors only: if the lender requires a limited guaranty (the SBA's term for additional security limited in amount), an ineligible person may also provide it. That person may not be an owner.",
      ],
    },
    {
      typ: "text", id: "programme", h2: "Consequences for 7(a) and 504",
      absaetze: [
        "The 7(a) programme is the SBA's main programme for business loans. A lender makes the loan and the SBA backs part of it. For most variants, that is no more than 85 per cent on loans of $150,000 or less and no more than 75 per cent above that. The maximum for a 7(a) loan is $5 million. Permitted uses are working capital, machinery and equipment, real estate, the refinancing of existing debt and the purchase of a business. The notice also expressly amends the application documents for the 7(a) Small, SBA Express, CAPLines, Export Express, Export Working Capital and International Trade variants. The ownership rule therefore applies to all of them.",
        "The 504 programme provides long-term finance for major fixed assets: land, buildings and machinery with a remaining useful life of at least ten years. A private lender, a Certified Development Company (CDC) and the business owner share the financing. The CDC's share is no more than 40 per cent, and the SBA backs that share in full. It is capped at $5 million per business, or $5.5 million per project for manufacturers and certain energy projects. The same ownership rule applies to 504 as to 7(a).",
        "The US Government Accountability Office (GAO) states the size of both programmes in its decision. In fiscal year 2025 the SBA backed 7(a) and 504 loans totalling about $45 billion to more than 85,000 small businesses. Loans approved before 1 March 2026 may continue to be serviced. According to an SBA notice of 31 March 2026, they may not be increased if the company does not meet the new rule.",
      ],
    },
    {
      typ: "etappen", id: "verlauf", h2: "Origin of the rule",
      lead: "For owners resident in Europe, an SBA loan was barely within reach even before 2026. The new rule has removed the remaining exceptions.",
      etappen: [
        { titel: "Standard operating procedure SOP 50 10 8", dauer: "1 June 2025", text: "All owners must be US citizens, US nationals or green card holders, with their principal residence in the US. Anyone living in Germany, Austria or Switzerland is therefore already excluded." },
        { titel: "Five per cent exception", dauer: "19 December 2025", text: "Procedural Notice 5000-872050 allows three groups to hold no more than five per cent of the shares between them. These are foreign nationals residing outside the US, US citizens and green card holders with their principal residence abroad, and holders of a conditional green card. The exception applies to loans the SBA approves on or after 1 January 2026." },
        { titel: "Policy Notice 5000-876441", dauer: "2 February 2026", text: "The SBA announces that from 1 March 2026 the five per cent exception will end and green card holders may no longer hold any stake." },
        { titel: "Procedural Notice 5000-876626", dauer: "11 February 2026", text: "The change becomes part of the procedures. A transitional arrangement applies to applications with green card owners under non-delegated processing. The SBA still processes them if they had reached review status R1 in its system by 11.59 pm Eastern Time on 28 February 2026." },
        { titel: "Entry into force", dauer: "1 March 2026", text: "Under delegated processing, the rule applies to every SBA loan number assigned on or after this day. Under non-delegated processing, the relevant date is the day on which the application reaches status R1 in the SBA's system. Since then, only companies that are 100 per cent US-owned have been eligible." },
        { titel: "Decision of the US Government Accountability Office", dauer: "1 July 2026", text: "In B-338157 the GAO finds that both notices are a rule within the meaning of the Congressional Review Act. The SBA should have submitted them to Congress and to the Comptroller General, the head of the GAO, before they took effect. It had submitted no such report and did not respond in substance to the GAO's enquiry." },
        { titel: "New version: SOP 50 10 8.1", dauer: "1 October 2026", text: "The SBA incorporates both notices into the new version of its procedures. It applies to every application that receives an SBA loan number on or after this day. The ownership rule appears there in the same wording." },
        { titel: "Still in force", dauer: "As at 27 October 2026", text: "The rule remains in force. No repeal by the SBA and no resolution of Congress is apparent as at this date." },
      ],
    },
    {
      typ: "karten", id: "wege", h2: "Financing routes without the SBA", spalten: 3,
      lead: "A US loan for a foreign-owned company remains possible after March 2026, but not through the SBA. Each of the six routes rests on a different basis. Decisions on cards and loans rest with the institution concerned.",
      karten: [
        { tag: "Business credit", titel: "Business credit: the company's credit profile", text: "The basis is a D-U-N-S Number from the business credit bureau and first supplier accounts with payment terms. If the company pays early, a credit profile of its own emerges, which lenders can assess.", pfad: "/en/business/knowledge/us-business-credit" },
        { tag: "Business credit cards", titel: "Card limits based on account balance", text: "Some issuers set the card limit by reference to the company's account balance. As a rule they require the owner's personal guarantee. Each issuer sets its own terms.", pfad: "/en/business/knowledge/us-business-credit-card" },
        { tag: "Bank", titel: "Loan against collateral", text: "Without the SBA, the bank bears the default risk alone. It assesses years of trading, revenue and collateral. Collateral may be a deposit, liability assumed by the parent company, or a property.", pfad: "/en/business/knowledge/us-financing-routes" },
        { tag: "Equity", titel: "Contribution or shareholder loan", text: "You or your parent company fund the US company from your own resources. If the LLC belongs solely to a foreign owner, it reports every contribution and every loan on the annual Form 5472.", pfad: "/en/business/us-subsidiary" },
        { tag: "Europe", titel: "Home bank in your country of residence", text: "Your home bank knows your figures from your existing banking relationship. With a loan to you or your GmbH, you may fund the US company." },
        { tag: "Property", titel: "Financing rental property", text: "For rental properties, some lenders mainly assess whether the rent covers the instalments. They require equity and reserves from your own funds.", pfad: "/en/business/knowledge/financing-us-property" },
      ],
    },
    {
      typ: "tabelle", id: "vergleich", h2: "Bank loan with and without the SBA",
      lead: "With an SBA loan, the agency carries part of the default risk. Without that portion, the bank bears the risk alone and sets its own yardstick.",
      kopf: ["", "SBA loan (7(a) or 504)", "Bank loan without the SBA"],
      zeilen: [
        ["Default risk", "lender and SBA, under the programme's rules", "the bank alone"],
        ["Owners", "only US citizens and US nationals with principal residence in the US", "set by each bank"],
        ["What the bank assesses", "the SBA's rules and its own criteria", "its own criteria: years of trading, revenue, collateral"],
        ["Maximum amount", "7(a): $5 million; 504: CDC share $5 million per business", "set by each bank"],
        ["For owners resident in Europe", "excluded", "possible if the bank agrees"],
      ],
      hervor: 2,
      fuss: ["General overview, as at October 2026. Each institution sets its own terms, amounts and collateral."],
    },
    {
      typ: "text", id: "europa", h2: "Equity and home bank in Europe",
      absaetze: [
        "Many entrepreneurs from the German-speaking region hold their funds in their country of residence: in their own GmbH, in reserves and in the relationship with their home bank. They may use these funds to capitalise the US company. Two forms are open to them: a contribution that increases its equity, or a loan from the shareholder to its subsidiary.",
        `Both forms have consequences that need to be settled before any payment. In Germany, a loan between you or your GmbH and the US company is subject to the arm's length principle (section 1 of the German Foreign Tax Act, AStG). If terms that independent third parties would not have agreed reduce your income, the tax office assesses that income as it would between independent parties. In the US, a reporting duty applies to an LLC owned solely by a foreign owner. It reports every contribution, every distribution and every loan between itself and that owner on Form 5472. Anyone who fails to file risks a penalty of ${IRS_EN.strafe5472}.`,
      ],
    },
    {
      typ: "text", id: "vorsicht", h2: "Substitutes for the SBA loan",
      absaetze: [
        "Some providers hold out capital without any review by an institution, often with promised limits and card applications in series. On 17 November 2025, the US Federal Trade Commission (FTC) announced one such case. The provider Seek Capital and its chief executive have been permanently banned from the business financing industry to settle the FTC's allegations. According to the FTC, the company had advertised special relationships with lenders and favourable terms. It then charged business owners thousands of dollars merely to open credit cards. This cost those affected millions and damaged their creditworthiness.",
        "Four requirements for every provider follow from this. It states fees and services in writing in advance. It claims no relationship with lenders that does not exist and commits to no limit. It explains how each application affects the credit file.",
      ],
    },
    {
      typ: "text", id: "fiaon", h2: "What FIAON Global handles",
      absaetze: [
        "Owners whose principal residence is outside the United States are excluded from SBA loans. We form your US company and apply for the EIN and, following our ITIN check, the ITIN. We prepare account and card applications in full; you submit them yourself.",
        `${FINANZIERUNG.satz} ${satz("S9", "en")}`,
      ],
      punkte: [
        `${TEIL.ihrTeil}: ${FINANZIERUNG.ihrTeil}`,
        "Tax: tax questions on contributions, shareholder loans and structure rest with partner tax advisers, who act in their own professional capacity.",
        `${TEIL.bedingung}: ${ROLLE}`,
        P.geldZurueck,
      ],
    },
    { typ: "paket", id: "mandat", h2: P.karteH2, lead: `${P.karteLead} ${satz("S9", "en")}`, paket: "global_kapital" },
    {
      typ: "hinweis", id: "wissen", h2: "What you need to know",
      punkte: [
        `${satz("S8", "en")} FIAON makes no commitment on any limit.`,
        "Whether the SBA rule will stand remains a political question. What counts is the version in force on the day of your application. The lender checks that version.",
        "An ownership structure that exists only on paper, such as a US citizen acting as a nominee owner, would be a false statement. 18 U.S.C. § 1014 makes knowingly false statements in loan applications a crime, including those made to institutions with FDIC deposit insurance.",
        KAPITAL_FREI,
        GLOBAL_PFLICHTHINWEIS.en[0],
        GLOBAL_PFLICHTHINWEIS.en[2],
      ],
    },
  ],
  fragen: [
    { f: "Can I get an SBA loan as a non-US citizen?", a: "No. Since 1 March 2026, all direct and indirect owners must be US citizens or US nationals with their principal residence in the US. This applies to 7(a) and 504 (SBA Procedural Notice 5000-876626). Anyone living in Germany, Austria or Switzerland does not meet the residence requirement." },
    { f: "Can green card holders still get an SBA loan?", a: "No. Since 1 March 2026, green card holders may not hold any stake in a company applying for a 7(a) or 504 loan. This includes holders with conditional status. The SBA still processed only applications under non-delegated processing that had reached review status R1 by 11.59 pm Eastern Time on 28 February 2026." },
    { f: "I am a US citizen but live in Germany. Can I get an SBA loan?", a: "No. US citizens and US nationals whose principal residence is outside the US are also ineligible. The SBA determines principal residence according to IRS Publication 523: what counts above all is the home in which you spend most of your time." },
    { f: "Can my GmbH apply for an SBA loan for its US subsidiary?", a: "No. Every company that holds a direct or indirect stake in the applicant must be organised in the US. A GmbH, AG or foundation from Europe as a shareholder rules out the application." },
    { f: "Does an E-2 visa with a home in Miami help?", a: "No, not for the SBA loan. Visa holders are expressly listed as ineligible persons, even if they live in the US. The E-2 visa can matter for your work in the US. It does not change the SBA's ownership rule. Whether it is an option for you is for immigration lawyers to assess case by case." },
    { f: "Is it enough if a US partner holds the majority?", a: "No. The rule requires 100 per cent; a single ineligible owner excludes the company. It becomes eligible only once that person has fully divested the stake before the SBA loan number is assigned. An owner on paper only would be a false statement." },
    { f: "Did the GAO decision repeal the rule?", a: "No. On 1 July 2026, the US Government Accountability Office (GAO) found that the notices are a rule within the meaning of the Congressional Review Act. The SBA should have submitted them to Congress. No repeal is apparent as at 27 October 2026. Since 1 October 2026, the rule has been part of SOP 50 10 8.1, the current version of the procedures." },
    { f: "What financing remains for my US LLC instead?", a: "In the US, what remains is business credit with a D-U-N-S Number and supplier accounts, business credit cards and a bank loan against collateral. From Europe, equity and loans from your home bank may be added. Collateral may be a deposit, liability assumed by the parent company, or a property. Decisions on cards and loans rest with the institution concerned." },
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
