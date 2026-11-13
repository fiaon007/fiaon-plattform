// ═══════════════════════════════════════════════════════════════════════════
// FIAON GLOBAL — KNOWLEDGE: US MARKET ENTRY (27.10.2026, E-439, FG · 48)
//
// Die englische Schwester von ../../e439/markteintritt-usa.ts — der Pfeiler für den
// Mittelstand und die Seite, auf der FIAON Global sich als Unternehmensberatung
// („business consultancy“, Justin 27.10.2026) für die US-Expansion zeigt.
// Hauptsuchwort EN „US market entry“ (Titel, H1, Kurz, erster Absatz, H2); daneben
// US expansion, expand business to the US, US subsidiary German GmbH
// (Recherche .arbeit/recherche/kw_en.md, Abschnitte 4, 5.5 und 5.7).
//
// Britisches Englisch, inhaltlich identisch: dieselben Bausteine in derselben
// Reihenfolge, dieselben ids, gleich viele Absätze, Punkte, Zeilen, Etappen, Karten,
// Fragen, Blick-Zeilen und Kennziffern; Quellen mit denselben Adressen in derselben
// Reihenfolge (englische Titel). Zahlen aus fakten-en.ts, wo die deutsche Fassung
// fakten.ts liest; die übrigen Zahlen wie in der deutschen Fachprüfung vom 27.10.2026:
// BE-13 (15 CFR 801.7: 45 Kalendertage, volle Meldung erst über 40 Mio. $, sonst
// Claim for Exemption, Pflicht auch ohne Anschreiben der BEA), § 605.0902 und
// § 212.0596 Florida Statutes 2026 (100.000 $), South Dakota v. Wayfair (21.06.2018),
// 37 CFR 2.6 (350 $ je Klasse) und 2.11, USCIS I-9 und E-2, IRS Publication 15,
// CBP Visa Waiver Program (90 Tage) und ESTA, GAO B-338157 (SBA seit 01.03.2026),
// 26 U.S.C. § 11, § 10 AO, § 1 KStG, § 138 Abs. 2 und 5 AO (10 %, 150.000 €, 14 Monate).
//
// Wortwand EN: kein „up to“, kein Bankname, keine Frist mit Ziffer als Zusage, kein
// Zinssatz, kein „recommend“, „advice“ nur verneint, „personal guarantee“ als
// Fachbegriff, Firmenkarte = „business credit card“. Über Konto, Karte, Rahmen und
// Darlehen entscheidet das Institut; FIAON vermittelt keine Kredite.
// E-509 (12.11.2026): EIN Produkt statt vier Pakete — kein Paketname, Preis und Geld-zurück-Satz aus EIN_PRODUKT.
// ═══════════════════════════════════════════════════════════════════════════
import type { GlobalQuelle, GlobalSeite } from "../../typen";
import { GLOBAL_KAPITAL_FREI, GLOBAL_PFLICHTHINWEIS } from "../../../fiaon-global";
// E-510 (13.11.2026, Sprachleitfaden FIAON Global, Baustein „Wissens-Artikel“ 7.4): “step” statt “stage”, “financing”
// statt “capital” in Titeln, “engagement” statt “order”, “funding target” statt “capital range”. Feste Sätze (S1, S2, S3,
// S9, S10, Rollen-Satz, Übergangssätze, Schritt 2) kommen aus shared/fiaon-global-saetze.ts — hier nicht getippt.
// Nie hier: “team on the ground”, ein Partnerstandort, ein Partner bei der Arbeit im Präsens, eine “assessment before
// formation” als enthaltene Leistung, die D-U-N-S Number als unsere Leistung, der Satz zum Einführungszeitraum bei Karten.
// Zweite Runde am selben Tag (Lektorat des ganzen Texts, im selben Zug wie die deutsche Fassung): Der Sachteil steht ohne
// FIAON — kein Partner, keine Gebühr von uns, kein “engagement” vor dem Baustein „rollen“ (Ausnahme: die festen Sätze im
// Baustein „kapital“ bleiben, wo sie sind). FIAON steht im Schlussteil. Die Gebühr zeigt die Karte “One engagement”; ein
// eigener Betrag steht im Text dieser Datei nicht mehr. Gesetzliche Fristen Dritter bleiben als Ziffer (Zahl der Quelle).
import { SCHRITTE_KOPF, SECHS_SCHRITTE, satz, weitererSatz } from "../../../fiaon-global-saetze";
import { EIN_PRODUKT } from "../../ein-produkt";
import {
  FAKTEN_STAND_EN, IRS_EN, MARKT_EN, QUELLEN_IRS_EN, QUELLEN_RECHT_EN as R, QUELLEN_STAATEN_EN, QUELLEN_WISSEN_EN as Q, SCHWELLEN_EN, STAAT_EN,
} from "../../fakten-en";

/** Date of first publication (E-439). */
const S = "2026-10-27";
/** Date of the last change in substance (E-510, language guide). */
const STAND = "2026-11-13";
const KAPITAL_FREI = `${GLOBAL_KAPITAL_FREI.en.satz} ${GLOBAL_KAPITAL_FREI.en.steuer}`;
const P = EIN_PRODUKT.en;
/** Step 2 of the fixed narrative (language guide 2.3) — sentence and “your part” from the one source. */
const UNTERLAGEN = SECHS_SCHRITTE.en.find((x) => x.nr === 2)!;
/** The names of the fixed parts of a step: “Your part”, “Condition” (language guide 2.1). */
const TEIL = SCHRITTE_KOPF.en.teile;
/** „$25,000“ aus „US$25,000 per form per year“ — die Zahl bleibt in fakten-en.ts. */
const STRAFE_5472 = IRS_EN.strafe5472.split(" ")[0].replace(/^US/, "");
/** Im Fließtext „per cent“ statt „%“ (britischer Satz), die Zahl selbst bleibt aus fakten-en.ts. */
const prozent = (x: string) => x.replace(/(\d)%/g, "$1 per cent");

/** Quellen dieses Beitrags — dieselben Adressen wie in der deutschen Fassung, englische Titel. */
const QUELLEN: Record<string, GlobalQuelle> = {
  selectusa: { titel: "U.S. Department of Commerce — SelectUSA", url: "https://www.trade.gov/selectusa" },
  cfius: { titel: "U.S. Department of the Treasury — Committee on Foreign Investment in the United States (CFIUS)", url: "https://www.cfius.gov/" },
  ao10: R.ao10,
  kstg1: R.kstg1,
  kstgAt1: { titel: "Section 1 Austrian Corporate Income Tax Act 1988 (KStG 1988) — unlimited and limited tax liability (RIS)", url: "https://www.ris.bka.gv.at/NormDokument.wxe?Abfrage=Bundesnormen&Gesetzesnummer=10004569&Paragraf=1" },
  dbg50: R.dbg50,
  fl6050902: { titel: "Florida Statutes 2026, § 605.0902 — authority of foreign LLCs to transact business", url: "https://www.flsenate.gov/Laws/Statutes/2026/605.0902" },
  be13: { titel: "15 CFR 801.7 — BE-13, survey of new foreign direct investment in the United States (BEA)", url: "https://www.law.cornell.edu/cfr/text/15/801.7" },
  wayfair: { titel: "Supreme Court of the United States — South Dakota v. Wayfair, Inc. (21 June 2018)", url: "https://www.law.cornell.edu/supremecourt/text/17-494" },
  fl2120596: { titel: "Florida Statutes 2026, § 212.0596 — taxation of remote sales", url: "https://www.flsenate.gov/Laws/Statutes/2026/212.0596" },
  marke211: { titel: "37 CFR 2.11 — requirement for representation of trademark applicants domiciled outside the US", url: "https://www.law.cornell.edu/cfr/text/37/2.11" },
  marke26: { titel: "37 CFR 2.6 — USPTO fees for trademark applications", url: "https://www.law.cornell.edu/cfr/text/37/2.6" },
  i9: { titel: "USCIS — Form I-9, Employment Eligibility Verification", url: "https://www.uscis.gov/i-9" },
  p15: { titel: "IRS — Publication 15, Employer’s Tax Guide", url: "https://www.irs.gov/publications/p15" },
  vwp: { titel: "U.S. Customs and Border Protection — Visa Waiver Program", url: "https://www.cbp.gov/travel/international-visitors/visa-waiver-program" },
  esta: { titel: "U.S. Customs and Border Protection — Electronic System for Travel Authorization (ESTA)", url: "https://www.cbp.gov/travel/international-visitors/esta" },
  usc11: { titel: "26 U.S.C. § 11 — tax imposed on corporations (21 per cent)", url: "https://www.law.cornell.edu/uscode/text/26/11" },
  e2: { titel: "USCIS — E-2 Treaty Investors", url: "https://www.uscis.gov/working-in-the-united-states/temporary-workers/e-2-treaty-investors" },
  gaoSba: { titel: "GAO B-338157 (1 July 2026) — SBA notices on the ownership rule for 7(a) and 504 loans", url: "https://www.gao.gov/products/b-338157" },
};

export const SEITE: GlobalSeite = {
  pfad: "/en/business/knowledge/us-market-entry",
  sprache: "en",
  schwester: "/business/wissen/markteintritt-usa",
  art: "wissen",
  seo: {
    titel: "US market entry: step by step — FIAON Global",
    beschreibung: "US market entry for mid-sized companies: structure, state, account, tax in both countries, staff and financing — steps, costs and sources.",
  },
  stand: STAND,
  erschienen: S,
  kennung: "FG · 48",
  auge: "Knowledge · US business consultancy",
  h1: "US market entry.",
  h1b: "Ten steps, with costs and sources.",
  lead: "A US market entry runs in ten steps, from the plan to financing. Each step is set out here with its duties, costs and sources. The closing section states what FIAON Global handles as a business consultancy for your US expansion.",
  ziffern: [
    { wert: IRS_EN.koerperschaftsteuer, label: "federal tax on the profit of a US corporation" },
    { wert: "45 days", label: "deadline for the BE-13 filing after formation" },
    { wert: STRAFE_5472, label: "IRS penalty per missed Form 5472 per year" },
  ],
  blick: [
    ["Starting point", "The plan: sales, purchasing, a team or projects in the US"],
    ["Structure", "LLC, corporation or a subsidiary of your GmbH, AG or holding company"],
    ["Tax", "The place of management counts; notification under section 138 AO"],
    ["US filings", "Form 5472 every year, BE-13 once on formation"],
    ["Financing", "In sequence: account, business credit cards, revenue, bank loan. Each institution makes its own decision."],
    ["Costs", "State fees, registered agent, annual US filing and trademark — with source and date"],
  ],
  kurz: "A US market entry runs in ten steps, from the plan through formation to financing. Structure and state are settled before formation: LLC, corporation or a subsidiary of your own GmbH. A US company managed from your country of residence remains taxable there. In the US, annual filings such as Form 5472 apply, plus a one-off BE-13 filing with the statistics agency BEA.",
  bloecke: [
    {
      typ: "text", id: "fragen-vorab", h2: "Three questions before formation",
      absaetze: [
        "The first question before a US market entry: what is to happen in the US? The options include sales from Europe to US customers, purchasing or a warehouse in the US, and projects on American construction sites. A team of your own or bringing in investors may also be part of the plan. Each answer leads to a different structure and to different duties. Anyone who wants to build a business in the US therefore starts with a description of the plan and with figures for the first financial years.",
        "The second question: who manages the company, and from where? Under German law, a corporation is subject to unlimited tax liability if its place of management is in Germany (section 1 of the German Corporate Income Tax Act, KStG). The place of management is the centre of its top-level business management (section 10 of the German Fiscal Code, AO). A US company managed from Munich or Hamburg is therefore taxable in Germany as well. You settle this question before formation. Austria and Switzerland likewise link tax liability to the registered office or the place of management. The provisions are section 1(2) of the Austrian Corporate Income Tax Act 1988 (KStG 1988) and Art. 50 of the Federal Direct Tax Act (DBG).",
        "The third question: where do the funds come from, and when? A new US company has no credit history. Account, business credit cards and loans therefore come into consideration one after another. Each institution decides on every application. Anyone who plans for this finances the first months from their own funds or from the parent company. In parallel, the company builds its creditworthiness in the US.",
        "The US government’s point of contact for foreign investors is SelectUSA, a programme of the US Department of Commerce. Through SelectUSA you also reach the economic development organisations of the states and regions. The Committee on Foreign Investment in the United States (CFIUS) reviews certain investments in US businesses and certain real estate transactions by foreign persons. It is chaired by the US Department of the Treasury; the test is the effect on national security. Whether a purchase or an investment falls within its scope is a legal question for a lawyer.",
      ],
    },
    {
      typ: "etappen", id: "etappen", h2: "The US market entry in ten steps",
      lead: "The sequence has a reason: each step builds on the one before. Anyone forming a US subsidiary takes the same steps; the shareholder is then the GmbH, AG or holding company.",
      etappen: [
        { titel: "The plan", dauer: "before formation", text: "You settle what is to happen in the US, who manages the company and what funds it needs — for both countries." },
        { titel: "Structure", dauer: "before formation", text: "The options are an LLC, a corporation or a subsidiary of your GmbH, AG or holding company. The choice determines liability, tax and filings." },
        { titel: "State", dauer: "before formation", text: "What counts is where the business is done, the costs and the law of the state. A company that becomes active in a second state needs authority to do business there." },
        { titel: "Formation", dauer: "start", text: "You file the formation with the state and appoint a registered agent with an address in the state; the agent receives official post. A lawyer drafts the company agreement: the LLC’s operating agreement or the bylaws. Registration is decided by the state." },
        { titel: "Tax numbers", dauer: "with formation", text: "The EIN is the company’s tax number; the account and the filings require it. Where needed, the ITIN is added, your personal US tax number (Form W-7). Both are decided by the US tax authority, the IRS." },
        { titel: "Account and payment routes", dauer: "after the EIN", text: "The company applies for a business account with a US institution and sets up the payment routes for its US customers. The institution decides on the account." },
        { titel: "Contracts and trademark", dauer: "before the first sale", text: "Contracts follow US law, including those with your own GmbH. Your trademark is protected by registration with the US trademark office, the USPTO." },
        { titel: "Staff", dauer: "with the first hire", text: "The employer verifies work authorisation, withholds and pays over payroll tax, and generally reports to the IRS every quarter." },
        { titel: "Tax and filings", dauer: "every year", text: "In the US: Form 5472, tax return and state fee, plus the one-off BE-13 filing. In Germany: the notification under section 138 AO and your tax return." },
        { titel: "Financing", dauer: "ongoing", text: "First the account and business credit cards, then supplier accounts and revenue, later a bank loan with collateral. Every financing decision rests with the lender." },
      ],
    },
    {
      typ: "text", id: "struktur", h2: "Structure and state: two decisions",
      absaetze: [
        `Three structures come into consideration. An LLC has an operating agreement rather than mandatory corporate bodies; liability is limited to the company. Unless it elects otherwise on Form 8832, it is not taxed itself for US tax purposes. With one member it counts as a “disregarded entity”, with several as a partnership. A corporation is a taxpayer in its own right, with ${prozent(IRS_EN.koerperschaftsteuer)} federal tax on its profit (26 U.S.C. § 11). The state’s tax is added where the state levies one (Florida: ${prozent(STAAT_EN.florida.steuer)}). A corporation issues shares and can therefore bring in investors. The third structure: your GmbH, AG or holding company becomes the shareholder of a US subsidiary. If it does business itself as a branch instead, it is fully liable for the US business.`,
        `For the state, three points count: where the business is done, what the state charges each year and who is to invest later. Florida charges ${STAAT_EN.florida.gruendung} for formation and ${STAAT_EN.florida.jahr} a year. Delaware charges ${STAAT_EN.delaware.gruendung} for formation and ${STAAT_EN.delaware.jahr} as the LLC’s annual tax. Wyoming charges ${STAAT_EN.wyoming.gruendung} for formation and ${STAAT_EN.wyoming.jahr} a year.`,
        "More important than the fee is where the business is done. An LLC formed in another state may do business in Florida only once it has been granted authority there (Certificate of Authority, section 605.0902 of the Florida Statutes). Anyone who forms in Delaware and works in Florida therefore pays fees and files annual reports in two states.",
        `If the US company is owned by a corporation, the tax at state level changes too. ${STAAT_EN.florida.llcSteuer}`,
      ],
    },
    {
      typ: "text", id: "konto", h2: "US business account and payment routes",
      absaetze: [
        `A business account requires the EIN; the IRS issues it without a fee. For an LLC’s account, US institutions generally ask for the formation document, the EIN confirmation and the operating agreement. They also ask for the passports of all members holding ${SCHWELLEN_EN.eigentuemer} or more and of the person who controls the company. In addition, the institutions ask for a clear description of the business with the expected payment flows. Under US law, they must identify and verify the beneficial owners (31 CFR 1010.230). These are every holder of at least ${SCHWELLEN_EN.eigentuemer} and one person who controls the company. Whether an account is opened is for each institution to decide.`,
        `FDIC deposit insurance covers ${SCHWELLEN_EN.fdic} per depositor, per insured institution and per ownership category. Payments from your US customers may arrive as domestic transfers, international transfers or card payments through a payment service provider. Every payment service provider reviews the company, its representatives and the business model independently. Name, address and telephone number should therefore be written the same way in every application.`,
      ],
    },
    {
      typ: "tabelle", id: "kosten", h2: "Costs of a US market entry",
      lead: "The table shows what the state, the IRS, the trademark office and the market charge. Your operating costs such as staff, rent and insurance come on top.",
      kopf: ["Cost item", "Amount", "Basis"],
      zeilen: [
        ["Formation with the state", `Florida ${STAAT_EN.florida.gruendung}, Delaware ${STAAT_EN.delaware.gruendung}, Wyoming ${STAAT_EN.wyoming.gruendung}`, "the state’s fee schedule"],
        ["Annual state fee", `Florida ${STAAT_EN.florida.jahr}, Delaware ${STAAT_EN.delaware.jahr} (LLC), Wyoming ${STAAT_EN.wyoming.jahr}`, "annual report or annual tax"],
        ["The company’s EIN", "no fee", "IRS"],
        ["Registered agent", MARKT_EN.agent, "figures published by several providers"],
        ["Annual US filing by a US certified public accountant (CPA)", MARKT_EN.cpa5472, "figures published by several providers"],
        ["Trademark application with the USPTO", "$350 per class, filed electronically, plus possible surcharges", "37 CFR 2.6, plus the US attorney’s fee"],
        ["Missed Form 5472", IRS_EN.strafe5472, "IRS penalty"],
      ],
      fuss: [
        "State fees according to the official fee schedules, as at September 2026. Delaware: the LLC’s annual tax from tax year 2026. Market ranges: figures published by several providers, as at September 2026 — not official figures.",
        "Not shown in the table: operating costs of your US company such as payroll, insurance, rent and sales tax registrations.",
      ],
    },
    {
      typ: "text", id: "steuern", h2: "Tax and filings in both countries",
      absaetze: [
        `In the US: two kinds of company report their transactions with related parties on Form 5472 every year. The first is an LLC wholly owned by a foreign person. The second is every US corporation in which a foreign person holds at least 25 per cent. The LLC files the form with a pro forma Form 1120, even in a year without revenue. Even payments by the owner to fund the formation count. With the calendar year as the tax year, the filing is due on ${IRS_EN.frist5472}. The penalty for a missed filing is ${IRS_EN.strafe5472} (IRS, as at ${FAKTEN_STAND_EN}).`,
        "A further filing, the BE-13, goes to the BEA (Bureau of Economic Analysis), the US statistics agency. It is mandatory where a foreign person forms or acquires a US business and holds at least 10 per cent of the voting rights in it. The deadline is 45 calendar days after formation or acquisition; the duty applies even without a request from the agency (15 CFR 801.7). The BEA requires the full report only where the costs exceed $40 million. At $40 million or less, the short claim for exemption is sufficient (BE-13 Claim for Exemption). By contrast, beneficial ownership (BOI) reporting to FinCEN ended permanently in August 2026 for companies formed in the US. Some checklists still list it as a duty.",
        "If you sell to US customers, state sales tax is added. The basis is the Supreme Court’s decision in South Dakota v. Wayfair of 21 June 2018. Since then, states may also require the tax from sellers without a physical presence in the state. Florida obliges sellers to collect it if their taxable remote sales into Florida exceeded a total of $100,000 in the previous calendar year (section 212.0596 of the Florida Statutes). Each state sets its own thresholds.",
        "In Germany: anyone who forms a foreign company, or acquires an interest in one, must notify the tax office (section 138(2) of the German Fiscal Code, AO). You submit the notification with the tax return for the year of formation, no later than 14 months after the end of that year (section 138(5) AO). If the US company is a corporation whose registered office and place of management are outside Germany, this applies from a shareholding of 10 per cent or from acquisition costs of more than €150,000; anyone who first obtains a controlling influence reports regardless (section 138(2) no. 4 AO). If it is classified as a partnership, no threshold applies. Which country taxes which profits is governed by the double taxation agreement between Germany and the US. If your own GmbH supplies goods, software or services to the subsidiary, the prices must meet the arm’s length standard (section 1 of the German Foreign Tax Act, AStG). Austria and Switzerland have their own rules. Which rule applies in your case is a tax question for your tax adviser in your country of residence.",
      ],
    },
    {
      typ: "text", id: "personal", h2: "Contracts, trademark and staff: the essentials",
      absaetze: [
        "The US company concludes its contracts under US law: with customers, suppliers, landlords and sales partners. If your own GmbH supplies the subsidiary, the two also conclude a contract. The transactions between parent and subsidiary also belong on Form 5472. Contracts under US law are a matter for a US lawyer.",
        "Your trademark is only protected once it is registered with the US Patent and Trademark Office (USPTO). A registered company name is not in itself a trademark. Applicants whose domicile or registered office is outside the US must be represented by an attorney admitted to practise before the USPTO (37 CFR 2.11). The basic fee is $350 per class for an electronic application (37 CFR 2.6). You therefore check the name before formation.",
        "Anyone who hires staff in the US becomes an employer there. For every hire, the employer verifies identity and work authorisation with Form I-9 (USCIS). The company withholds income tax and pays it over together with the Social Security and Medicare contributions. It generally reports quarterly on Form 941 and issues every employee a Form W-2 (IRS Publication 15). Payroll and employment law are matters for a payroll provider and an employment lawyer in the United States.",
        "For meetings, trade fairs and appointments, nationals of participating countries travel without a visa under the Visa Waiver Program. This applies to business stays of no more than 90 days. Whether they may travel this way is checked in advance through the electronic system ESTA (CBP). Anyone who wants to run the US company permanently from within the US needs a visa. For investors from treaty countries, the E-2 visa may be an option. It requires a substantial investment in a real and operating enterprise, made or in the process of being made, which the investor develops and directs (USCIS). The US authorities decide on every visa. Whether it is an option in your case is a legal question for an immigration lawyer.",
      ],
    },
    {
      typ: "text", id: "kapital", h2: "Financing routes for a new US company",
      absaetze: [
        "A new US company has no credit history. Its financing routes therefore come into consideration one after another. First come business credit cards, whose limit is often based on the account balance. Supplier accounts with payment terms follow, together with the company’s identifier with a business credit bureau (the D-U-N-S Number). Revenue-based loans from payment platforms come next. A bank loan follows later, backed for instance by collateral from the parent company. Personal US cards depend on your personal US credit history, not on the company.",
        "Since 1 March 2026, small business loans backed by the SBA (the 7(a) and 504 programmes) have been subject to an ownership rule. All direct and indirect owners must be US citizens or US nationals with their principal residence in the US; green card holders do not qualify (GAO B-338157). A company with owners who are not US nationals is therefore excluded from these programmes.",
        KAPITAL_FREI,
        `${satz("S9", "en")} ${satz("S1", "en")}`,
      ],
    },
    {
      typ: "karten", id: "fehler", h2: "Common mistakes when expanding into the US", spalten: 3,
      lead: "Six mistakes that can be avoided before formation.",
      karten: [
        { tag: "Tax", titel: "Overlooking the place of management", text: "The US company is managed from Europe and yet treated as purely American. The place of management helps determine tax liability in the country of residence." },
        { tag: "State", titel: "Forming where the business is not done", text: "A company formed in Delaware and active in Florida also needs authority in Florida. A second registered agent and a second annual report are added." },
        { tag: "US filing", titel: "Overlooking Form 5472 without revenue", text: `The duty also applies in a year without revenue. Even payments by the owner to fund the formation count. The IRS penalty for a missed filing is ${IRS_EN.strafe5472}.` },
        { tag: "Statistics", titel: "Missing the BE-13 filing", text: "The filing with the BEA is mandatory, even without a request from the agency. With costs of $40 million or less, the short claim for exemption is sufficient." },
        { tag: "Trademark", titel: "Not checking the name", text: "A registered company name is not in itself a trademark. If it conflicts with a US trademark, a change of name may be needed after the launch." },
        { tag: "Financing", titel: "Planning on loans before revenue", text: "The lender decides on every loan. As long as the company has neither a credit history nor revenue, that decision is open." },
      ],
    },
    {
      typ: "rollen", id: "rollen", h2: "Who is responsible for what",
      lead: weitererSatz("ROLLEN", "en"),
      fiaon: [
        "State filing through our partners in the United States, state fee included",
        "Registered agent, US business address and US telephone number in the first year",
        "EIN and ITIN applications (the ITIN following our ITIN check)",
        "Compliance calendar and the first annual report to the state",
        "Fully prepared applications for accounts, credit cards on request and financing",
        "One dedicated contact for your company’s post, calls and appointments",
      ],
      partner: [
        "Partner lawyers: legal questions, in their own professional capacity",
        "US certified public accountant (CPA) from our partner network: the first annual US filing (Form 5472 with Form 1120)",
        "Partner tax advisers in your country of residence: tax questions, in their own professional capacity",
      ],
      sie: [
        "Set the goal and the figures for your US business",
        "Upload your passport and sign the documents presented to you; for a subsidiary, also submit the parent company’s commercial register extract",
        "Conclude contracts with customers, suppliers and employees",
        "The tax return in your country of residence, with your tax adviser",
        "Submit account, card and financing applications yourself — each institution makes its own decision",
      ],
    },
    {
      typ: "text", id: "fiaon", h2: "What FIAON Global handles",
      absaetze: [
        "As a business consultancy, FIAON Global forms an LLC as part of your engagement. If your GmbH is to hold the shares, or if a corporation comes into consideration, we agree that with you in a call beforehand.",
        `${weitererSatz("UEBERGANG-EINREICHUNG", "en")} ${UNTERLAGEN.satz}`,
      ],
      punkte: [
        `Accounts, cards and financing: ${satz("S2", "en")}`,
        `${TEIL.ihrTeil}: ${UNTERLAGEN.ihrTeil}`,
        `${TEIL.bedingung}: ${satz("S3", "en")}`,
      ],
      nach: P.geldZurueck,
    },
    {
      typ: "karten", id: "vertiefung", h2: "The steps in detail", spalten: 3,
      karten: [
        { tag: "Structure", titel: "The subsidiary in the US", text: "When your GmbH, AG or holding company becomes the shareholder: process and documents.", pfad: "/en/business/us-subsidiary" },
        { tag: "Formation", titel: "US company formation", text: "State filing, documents and the EIN and ITIN applications under one engagement.", pfad: "/en/business/us-company-formation" },
        { tag: "State", titel: "Choosing the state", text: "Delaware, Florida or Wyoming: times, costs, advantages and drawbacks.", pfad: "/en/business/knowledge/choosing-a-state" },
        { tag: "Account", titel: "The US business bank account", text: "Which documents institutions ask for and how the application comes together. The institution decides on the account.", pfad: "/en/business/us-business-bank-account" },
        { tag: "Duties", titel: "Your US duties", text: "Form 5472, state fee, registered agent and the filing in your country of residence, in one calendar.", pfad: "/en/business/us-compliance" },
        { tag: "Miami", titel: "In person in Miami", text: weitererSatz("MIAMI", "en"), pfad: "/en/business/miami" },
      ],
    },
    {
      typ: "verzeichnis", id: "weiterlesen-etappen", h2: "Further reading by step",
      eintraege: [
        { pfad: "/en/business/knowledge/llc-vs-corporation", tag: "Structure" },
        { pfad: "/en/business/ein-itin", tag: "Tax numbers" },
        { pfad: "/en/business/knowledge/us-bank-account-documents", tag: "Account" },
        { pfad: "/en/business/knowledge/form-5472", tag: "Filings" },
        { pfad: "/en/business/knowledge/us-financing-routes", tag: "Financing" },
        { pfad: "/en/business/costs", tag: "Costs" },
      ],
    },
    { typ: "paket", id: "mandat", h2: P.karteH2, lead: P.karteLead, paket: "global_banking" },
    {
      typ: "hinweis", id: "wissen", h2: "What you need to know",
      punkte: [
        satz("S10", "en"),
        GLOBAL_PFLICHTHINWEIS.en[0],
        GLOBAL_PFLICHTHINWEIS.en[1],
        GLOBAL_PFLICHTHINWEIS.en[2],
        "Not included in your engagement: visas, payroll, transfer pricing, sales tax registrations and trademark applications.",
        `FIAON does not lend and does not broker loans. ${satz("S1", "en")}`,
      ],
    },
  ],
  fragen: [
    { f: "What does a US market entry cost?", a: `At state level, formation costs ${STAAT_EN.florida.gruendung} in Florida, ${STAAT_EN.delaware.gruendung} in Delaware and ${STAAT_EN.wyoming.gruendung} in Wyoming. Each year, the state fee, the registered agent and the US filing by a US certified public accountant (CPA) are added. The large items are your operating costs such as staff, rent and insurance, and the funds for the first months.` },
    { f: "Do I need a company of my own for US expansion?", a: "No, not necessarily. Your GmbH can do business as a branch; it is then fully liable for the US business. A separate LLC or corporation keeps liability apart from the parent company. It is the contracting party for your US customers in the US. Which structure fits depends on your plan. Settle this before formation with your tax adviser and a US CPA." },
    { f: "Is a US subsidiary taxable in Germany?", a: "It can be. If it is actually managed from Germany, its place of management is in Germany (section 10 AO). A corporation is then subject to unlimited corporate income tax in Germany (section 1 KStG). For an LLC, the taxation depends on its classification. You notify the tax office of the interest under section 138 AO. How the double taxation agreement applies in your case is a tax question for your tax adviser." },
    { f: "What is the BE-13 filing?", a: "It is a mandatory filing with the US statistics agency BEA. It applies where a foreign person forms or acquires a US business and holds at least 10 per cent of the voting rights in it. It is due no later than 45 calendar days afterwards, even without a request (15 CFR 801.7). With costs of $40 million or less, the short claim for exemption is sufficient." },
    { f: "Do I need a visa to run my US company?", a: "Not for meetings and appointments: nationals of participating countries travel without a visa under the Visa Waiver Program with ESTA approval. This applies to business stays of no more than 90 days. Anyone who wants to run the company permanently from within the US needs a visa. For investors from treaty countries, the E-2 visa may be an option. The US authorities decide on every visa. Legal questions on this are a matter for an immigration lawyer." },
    { f: "What does FIAON Global handle as a business consultancy?", a: `${weitererSatz("UEBERGANG-EINREICHUNG", "en")} ${UNTERLAGEN.satz} For accounts, cards and financing: ${satz("S2", "en")} ${weitererSatz("ROLLEN", "en")}` },
    { f: GLOBAL_KAPITAL_FREI.en.frage, a: GLOBAL_KAPITAL_FREI.en.antwort },
  ],
  paket: "global_banking",
  weiter: ["/en/business/knowledge/subsidiary-or-branch", "/en/business/knowledge/us-llc-german-resident", "/en/business/knowledge/e2-visa-own-us-company", "/en/business/knowledge/us-funding-for-foreign-owned-companies"],
  quellen: [
    QUELLEN.selectusa,
    QUELLEN.cfius,
    QUELLEN.ao10,
    QUELLEN.kstg1,
    QUELLEN.kstgAt1,
    QUELLEN.dbg50,
    Q.ao138,
    Q.dba,
    Q.astg1,
    Q.f8832,
    Q.smllc,
    QUELLEN.usc11,
    Q.i1120,
    Q.i5472,
    QUELLEN_IRS_EN[5],
    QUELLEN_STAATEN_EN.florida[0],
    QUELLEN_STAATEN_EN.florida[1],
    QUELLEN_STAATEN_EN.florida[2],
    QUELLEN_STAATEN_EN.florida[4],
    QUELLEN_STAATEN_EN.delaware[0],
    QUELLEN_STAATEN_EN.delaware[1],
    QUELLEN_STAATEN_EN.wyoming[0],
    QUELLEN_STAATEN_EN.wyoming[1],
    QUELLEN.fl6050902,
    Q.ein,
    Q.w7,
    Q.cdd,
    Q.fdic,
    QUELLEN.be13,
    Q.boiEnde,
    QUELLEN.wayfair,
    QUELLEN.fl2120596,
    QUELLEN.marke211,
    QUELLEN.marke26,
    QUELLEN.i9,
    QUELLEN.p15,
    QUELLEN.vwp,
    QUELLEN.esta,
    QUELLEN.e2,
    Q.duns,
    QUELLEN.gaoSba,
  ],
};
