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
// Darlehen entscheidet das Institut; FIAON vermittelt keine Kredite. Paketpreise nur
// über den Baustein „paket“.
// ═══════════════════════════════════════════════════════════════════════════
import type { GlobalQuelle, GlobalSeite } from "../../typen";
import { GLOBAL_GELD_ZURUECK, GLOBAL_KAPITAL_FREI, GLOBAL_PFLICHTHINWEIS, globalPaket } from "../../../fiaon-global";
import {
  IRS_EN, MARKT_EN, QUELLEN_IRS_EN, QUELLEN_RECHT_EN as R, QUELLEN_STAATEN_EN, QUELLEN_WISSEN_EN as Q, SCHWELLEN_EN, STAAT_EN,
} from "../../fakten-en";

const S = "2026-10-27";
const KAPITAL_FREI = `${GLOBAL_KAPITAL_FREI.en.satz} ${GLOBAL_KAPITAL_FREI.en.steuer}`;
const GELD_ZURUECK = GLOBAL_GELD_ZURUECK.aktiv ? `${GLOBAL_GELD_ZURUECK.en.text} ${GLOBAL_GELD_ZURUECK.en.bedingungen}` : undefined;
const BANKING = globalPaket("global_banking")?.en.name ?? "Global Banking";
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
    beschreibung: "US market entry for mid-sized companies: structure, state, account, tax in both countries, staff and capital — stages, costs and sources.",
  },
  stand: S,
  erschienen: S,
  kennung: "FG · 48",
  auge: "Knowledge · US business consultancy",
  h1: "US market entry.",
  h1b: "The business consultancy for your route into the US — step by step.",
  lead: "A US market entry succeeds in stages, not in a single step: first the assessment, then structure and state, formation, tax numbers, account and payment routes, contracts, staff, the filings in both countries and finally the capital. Here you will find each stage with its duties, costs and sources — and what FIAON Global takes on as a business consultancy for your US expansion.",
  ziffern: [
    { wert: IRS_EN.koerperschaftsteuer, label: "federal tax on the profit of a US corporation" },
    { wert: "45 days", label: "deadline for the BE-13 filing after formation" },
    { wert: STRAFE_5472, label: "penalty per missed Form 5472 per year" },
  ],
  blick: [
    ["First question", "What do you want to do in the US: sales, purchasing, a team, projects?"],
    ["Structure", "LLC, corporation or a subsidiary of your GmbH, AG or holding company"],
    ["Tax", "The place of management counts; notification under section 138 AO"],
    ["US filings", "Form 5472 every year, BE-13 once on formation"],
    ["Capital", "In stages: account, cards, revenue, bank"],
    ["With FIAON Global", "One contact instead of eight, at a fixed price"],
  ],
  kurz: "A US market entry runs in ten stages: assessment of the plan, choice of structure (LLC, corporation or a subsidiary of your own GmbH), state, formation, tax numbers, business account and payment routes, contracts and trademark, staff, tax and filings in both countries, capital. If the US company is managed from Germany, Austria or Switzerland, it remains taxable there; in the US, annual filings such as Form 5472 apply, plus a one-off BE-13 filing with the statistics agency BEA. As a business consultancy, FIAON Global makes the applications with your power of attorney and coordinates tax advisers, US CPAs and lawyers acting under your engagement.",
  bloecke: [
    {
      typ: "text", id: "fragen-vorab", h2: "Before you form a company: three questions",
      absaetze: [
        "The first question of a US market entry is not “LLC or corporation?” but: what do you actually want to do in the US? Sales from Europe to US customers, purchasing or a warehouse on site, projects on American construction sites, a team of your own, investors at the table — each answer leads to a different structure and to different duties. Anyone who wants to build a business in the US therefore starts with a clear picture of the plan and with figures for the first financial years.",
        "The second question: who manages the company, and from where? Under German law, a corporation is subject to unlimited tax liability if its place of management is in Germany (section 1 of the German Corporate Income Tax Act, KStG); the place of management is the centre of its top-level business management (section 10 of the German Fiscal Code, AO). A US company run from a desk in Munich or Hamburg is therefore no tax shelter: it is taxable in Germany as well. This belongs in the assessment before formation, not in remedial work afterwards. Austria (section 1(2) of the Austrian Corporate Income Tax Act 1988, KStG 1988) and Switzerland (Art. 50 of the Federal Direct Tax Act, DBG) likewise link tax liability to the registered office or the place of management.",
        "The third question: where does the capital come from, and when? A new US company has no history. Account, cards and credit open up one after another. Anyone who plans for this finances the first months from their own funds or from the parent company and builds US creditworthiness in parallel.",
        "The US government’s point of contact for foreign investors is SelectUSA, a programme of the US Department of Commerce; through SelectUSA you will also find the economic development organisations of the states and regions. In addition, the Committee on Foreign Investment in the United States (CFIUS), chaired by the US Department of the Treasury, reviews certain investments in US businesses and certain real estate transactions by foreign persons for their national security implications. Before signing, the partner lawyer clarifies whether a purchase or an investment falls within its scope.",
      ],
    },
    {
      typ: "etappen", id: "etappen", h2: "The US market entry in ten stages",
      lead: "The order matters: each stage builds on the one before. Anyone who wants to form a US subsidiary takes the same route — only with the GmbH, AG or holding company as the shareholder.",
      etappen: [
        { titel: "Assessment", dauer: "before formation", text: "What you want to do in the US, who manages the company and what capital it needs — assessed for both countries." },
        { titel: "Structure", dauer: "before formation", text: "LLC, corporation or a subsidiary of your GmbH, AG or holding company: liability, tax and filings depend on this choice." },
        { titel: "State", dauer: "before formation", text: "Where the business is done, or where the costs and the legal framework suit you. A company that becomes active in a second state needs authority to do business there." },
        { titel: "Formation", dauer: "start", text: "Filing with the state, a registered agent with an address in the state, an operating agreement or bylaws drafted by the lawyer." },
        { titel: "Tax numbers", dauer: "with formation", text: "The company’s EIN — without it, no account and no filing; if needed, your personal ITIN with Form W-7." },
        { titel: "Account and payment routes", dauer: "after the EIN", text: "A business account with a US institution and the routes by which your US customers pay. The institution decides." },
        { titel: "Contracts and trademark", dauer: "before the first order", text: "Contracts under US law, including with your own GmbH; protecting your trademark with the USPTO." },
        { titel: "Staff", dauer: "with the first hire", text: "Verify work authorisation, withhold and pay over payroll tax, usually report to the IRS every quarter." },
        { titel: "Tax and filings", dauer: "every year", text: "In the US, Form 5472, tax return and state fee, plus BE-13 once; at home, the notification under section 138 AO and your tax return." },
        { titel: "Capital in stages", dauer: "ongoing", text: "Account and business credit cards, then supplier accounts and revenue, later the bank and collateral. Every financing decision rests with the institution." },
      ],
    },
    {
      typ: "text", id: "struktur", h2: "Structure and state: the two decisions that set the course",
      absaetze: [
        `Three routes are open. An LLC is lean: an operating agreement rather than mandatory corporate bodies, with liability limited to the company; for US tax purposes it is not taxed itself unless it elects otherwise on Form 8832 — with one member it counts as a “disregarded entity”, with several as a partnership. A corporation is a taxpayer in its own right, with ${prozent(IRS_EN.koerperschaftsteuer)} federal tax on its profit (26 U.S.C. § 11) plus the state’s tax where the state levies one (Florida: ${prozent(STAAT_EN.florida.steuer)}); it issues shares and can therefore bring in investors. And your GmbH, AG or holding company can be the shareholder of a US subsidiary — or do business itself as a branch, in which case it is fully liable for the US business.`,
        `When it comes to the state, three things count: where the business takes place, what the state charges each year and who is to invest later. Florida charges ${STAAT_EN.florida.gruendung} for formation and ${STAAT_EN.florida.jahr} a year; Delaware ${STAAT_EN.delaware.gruendung}, and ${STAAT_EN.delaware.jahr} as the LLC’s annual tax; Wyoming ${STAAT_EN.wyoming.gruendung}, and ${STAAT_EN.wyoming.jahr} a year.`,
        "More important than the fee is where the business is actually done. An LLC formed in another state may only do business in Florida once it has obtained authority there (Certificate of Authority, section 605.0902 of the Florida Statutes). Anyone who forms in Delaware and works in Florida therefore pays fees and files annual reports in two states.",
        `If the US company is owned by a corporation, the tax at state level changes too. ${STAAT_EN.florida.llcSteuer}`,
      ],
    },
    {
      typ: "text", id: "konto", h2: "Account and payment routes: moving money in the US",
      absaetze: [
        `No EIN, no business account. The IRS issues the EIN free of charge. For an LLC’s account, US institutions generally ask for the formation document, the EIN confirmation, the operating agreement, the passports of all members holding ${SCHWELLEN_EN.eigentuemer} or more and of the person who controls the company, and a clear description of the business with the expected payment flows. Under US law, institutions must identify and verify the beneficial owners — anyone holding at least ${SCHWELLEN_EN.eigentuemer}, and one person who controls the company (31 CFR 1010.230); whether they open an account is for them alone to decide.`,
        `FDIC deposit insurance covers ${SCHWELLEN_EN.fdic} per depositor, per insured institution and per ownership category. For payments from your US customers, the options are domestic transfers, international transfers and card payments through a payment service provider. Every payment service provider reviews the company, its representatives and the business model independently — name, address and phone number should therefore be identical, character for character, in every application.`,
      ],
    },
    {
      typ: "tabelle", id: "kosten", h2: "The costs of a US market entry at a glance",
      lead: "What the state, the IRS, the trademark office and the market charge — excluding your operating costs such as staff, rent and insurance.",
      kopf: ["Cost item", "Amount", "Basis"],
      zeilen: [
        ["Formation with the state", `Florida ${STAAT_EN.florida.gruendung}, Delaware ${STAAT_EN.delaware.gruendung}, Wyoming ${STAAT_EN.wyoming.gruendung}`, "the state’s fee schedule"],
        ["Annual state fee", `Florida ${STAAT_EN.florida.jahr}, Delaware ${STAAT_EN.delaware.jahr} (LLC), Wyoming ${STAAT_EN.wyoming.jahr}`, "annual report or annual tax"],
        ["The company’s EIN", "no fee", "IRS"],
        ["Registered agent", MARKT_EN.agent, "published prices of several providers"],
        ["Annual US filing by a US CPA", MARKT_EN.cpa5472, "published prices of several providers"],
        ["Trademark application with the USPTO", "$350 per class, filed electronically, plus possible surcharges", "37 CFR 2.6, plus the US attorney’s fee"],
        ["Missed Form 5472", IRS_EN.strafe5472, "IRS penalty"],
        ["Your package with FIAON Global", "fixed price, all fees of the package included", "see the package on this page"],
      ],
      fuss: [
        "State fees according to the official fee schedules, as at September 2026; Delaware: the LLC’s annual tax from tax year 2026. Market ranges are published prices of several providers in September 2026, not official figures.",
        "Not included: operating costs of your US company such as payroll, insurance, rent and sales tax registrations.",
      ],
    },
    {
      typ: "text", id: "steuern", h2: "Tax and filings in both countries",
      absaetze: [
        `In the US: an LLC wholly owned by a foreign person, and every US corporation in which a foreign person holds at least 25 per cent, report their transactions with related parties on Form 5472 every year — the LLC with a pro forma Form 1120, even in a year without revenue; even payments by the owner to fund the formation count. With the calendar year as the tax year, it is due on ${IRS_EN.frist5472}. Anyone who misses it risks ${IRS_EN.strafe5472}.`,
        "The filing with the BEA (Bureau of Economic Analysis), the US statistics agency, is new to many. If a foreign person forms or acquires a US business and holds at least 10 per cent of the voting rights in it, the BE-13 filing is mandatory — even if the agency never gets in touch — no later than 45 calendar days after formation or acquisition (15 CFR 801.7). The BEA only requires the full report where the costs exceed $40 million; at $40 million or less, the short claim for exemption is sufficient (BE-13 Claim for Exemption). By contrast, beneficial ownership (BOI) reporting to FinCEN ended permanently in August 2026 for companies formed in the US; some checklists still list it as a duty.",
        "If you sell to US customers, state sales tax is added. Since the Supreme Court’s decision in South Dakota v. Wayfair of 21 June 2018, states may also require it from sellers without a physical presence in the state. Florida, for instance, obliges sellers to collect it if their taxable remote sales into Florida exceeded a total of $100,000 in the previous calendar year (section 212.0596 of the Florida Statutes). Each state sets its own thresholds.",
        "At home: the formation of a foreign company, or the acquisition of an interest in one, must be notified to the tax office (section 138(2) of the German Fiscal Code, AO) — together with the tax return for the year of formation, no later than 14 months after the end of that year (section 138(5) AO). If the US company is a corporation, this applies from a shareholding of 10 per cent or from acquisition costs of more than €150,000; if it is classified as a partnership, no threshold applies. Which country taxes which profits is governed by the double taxation agreement between Germany and the US. If your own GmbH supplies goods, software or services to the subsidiary, the prices must meet the arm’s length standard (section 1 of the German Foreign Tax Act, AStG). Austria and Switzerland have their own rules — our partner tax advisers review them under your engagement.",
      ],
    },
    {
      typ: "text", id: "personal", h2: "Contracts, trademark and staff: the essentials",
      absaetze: [
        "With the US company you conclude contracts under US law: with customers, suppliers, landlords and sales partners, and with your own GmbH if it supplies the subsidiary. The transactions between parent and subsidiary also belong on Form 5472. These contracts are drafted by a US lawyer.",
        "Your trademark is only protected once it is registered with the US Patent and Trademark Office (USPTO); a registered company name is not in itself a trademark. Applicants whose domicile or registered office is outside the US must be represented in the application by an attorney admitted to practise before the USPTO (37 CFR 2.11). The basic fee is $350 per class for an electronic application (37 CFR 2.6). You should therefore check the name before formation, not after the launch.",
        "Anyone who hires staff in the US becomes an employer there. For every hire, identity and work authorisation must be verified with Form I-9 (USCIS). The company withholds income tax, pays it over together with the Social Security and Medicare contributions, generally reports quarterly on Form 941 and issues every employee a Form W-2 (IRS Publication 15). Payroll and employment law belong in the hands of specialists on the ground.",
        "For meetings, trade fairs and appointments, nationals of participating countries may travel without a visa under the Visa Waiver Program for business stays of no more than 90 days; whether they may travel this way is checked in advance through the electronic system ESTA (CBP). Anyone who wants to run the US company on the ground permanently needs a visa. For investors from treaty countries, the E-2 visa may be an option; it requires a substantial investment in a real and operating enterprise — made or in the process of being made — that the investor develops and directs (USCIS). A partner immigration lawyer reviews, under your engagement, whether it is an option in your case.",
      ],
    },
    {
      typ: "text", id: "kapital", h2: "Capital in stages: what a young US company can expect",
      absaetze: [
        "A new US company has no credit history. Its financing routes therefore open up one after another: business credit cards, whose limit is often based on the account balance; supplier accounts with payment terms and the company’s identifier with a business credit bureau (the D-U-N-S Number); then revenue-based loans from payment platforms; later a credit line from the bank, backed for instance by collateral from the parent company. Personal US cards, by contrast, depend on your personal US credit history, not on the company.",
        "Since 1 March 2026, small business loans backed by the SBA (the 7(a) and 504 programmes) have required all direct and indirect owners to be US citizens or US nationals with their principal residence in the US; green card holders do not qualify (GAO B-338157). A company with owners who are not US nationals is therefore excluded from these programmes.",
        KAPITAL_FREI,
        "Some issuers offer introductory periods without debit interest; each issuer sets the terms itself. FIAON is not a bank, does not grant loans, does not arrange loans and does not commit to any limit. The institution alone decides on the account, card, limit and loan; the capital range of a package is your goal, not a promise.",
      ],
    },
    {
      typ: "karten", id: "fehler", h2: "Common mistakes when expanding into the US", spalten: 3,
      lead: "Six mistakes that are easy to avoid before formation.",
      karten: [
        { tag: "Tax", titel: "Forgetting the place of management", text: "The US company is run from Europe and yet treated as purely American. Where it is managed helps determine its tax liability at home." },
        { tag: "State", titel: "Forming where you do not work", text: "Formed in Delaware, active in Florida: the company then also needs authority in Florida, with a second registered agent and a second annual report." },
        { tag: "US filing", titel: "Overlooking Form 5472 without revenue", text: `The duty also applies in a year without revenue; even payments by the owner to fund the formation count. Anyone who misses it risks ${IRS_EN.strafe5472}.` },
        { tag: "Statistics", titel: "Not knowing about BE-13", text: "The filing with the BEA is mandatory, even if the agency never writes. With costs of $40 million or less, the short claim for exemption is sufficient." },
        { tag: "Trademark", titel: "Not checking the name", text: "A registered company name is not in itself a trademark. If it conflicts with a US trademark, a change of name may be needed after the launch." },
        { tag: "Capital", titel: "Planning on credit before revenue", text: "Anyone who plans on credit before the company has a history and revenue is counting on money that no institution has decided on yet." },
      ],
    },
    {
      typ: "rollen", id: "rollen", h2: "What you do yourself, what the team on the ground takes on",
      lead: "One contact instead of eight: this is how the work is shared in a market entry.",
      fiaon: [
        "Formation with the state under your power of attorney",
        "Registered agent, US business address and US phone number for the first year",
        "EIN application and D-U-N-S Number, ITIN application prepared",
        "Compliance calendar with all US filings and deadlines",
        "Account and card applications fully prepared, appointments on the ground in Miami",
        "Coordination of all partners through a dedicated contact",
      ],
      partner: [
        "Partner tax adviser: assessment before formation",
        "US CPA: the first annual US filing (Form 5472 with Form 1120)",
        "Partner lawyer: operating agreement and formation documents",
        "All of them act under your engagement; FIAON pays their fees for the services in the package",
      ],
      sie: [
        "Set the goal and the figures for your US business",
        "Power of attorney and documents: passport and, for a subsidiary, the parent company’s commercial register extract",
        "Sign and submit account, card and credit applications yourself",
        "Conclude contracts with customers, suppliers and employees",
        "The tax return at home, with your tax adviser",
      ],
    },
    {
      typ: "text", id: "fiaon", h2: "How FIAON Global handles your US market entry",
      absaetze: [
        "FIAON Global is your business consultancy for the route into the US: one contact instead of eight. With your power of attorney, we make the applications for you — formation with the state, the EIN, the D-U-N-S Number and your company’s filings — and prepare the ITIN. We provide the registered agent, US business address and US phone number for the first year. You make only the account, card and credit applications yourself, and we prepare each of them in full.",
        "Law and tax are handled by partner tax advisers, US CPAs and partner lawyers acting under your engagement; FIAON pays their fees for the services in your package. Our team on the ground in Miami attends appointments with authorities and institutions, complemented by our partner location in Zurich; your contracting party is FIAON LTD in London. You pay a fixed price, with all fees of the package included; from the second year onwards, the annual care plan is voluntary.",
      ],
      nach: GELD_ZURUECK,
    },
    {
      typ: "karten", id: "vertiefung", h2: "Each stage in detail", spalten: 3,
      karten: [
        { tag: "Structure", titel: "The subsidiary in the US", text: "When your GmbH, AG or holding company becomes the shareholder: process and documents.", pfad: "/en/business/us-subsidiary" },
        { tag: "Formation", titel: "US company formation", text: "LLC or corporation with a team on the ground, EIN and ITIN, at a fixed price.", pfad: "/en/business/us-company-formation" },
        { tag: "State", titel: "Which state?", text: "Florida, Delaware or Wyoming: three questions decide.", pfad: "/en/business/knowledge/choosing-a-state" },
        { tag: "Account", titel: "The US business bank account", text: "Which documents institutions ask for and how the application comes together.", pfad: "/en/business/us-business-bank-account" },
        { tag: "Duties", titel: "Your US duties", text: "Form 5472, state fee, registered agent and the filing at home, all in the calendar.", pfad: "/en/business/us-compliance" },
        { tag: "On the ground", titel: "Global VIP in Miami", text: "The kick-off in person on the ground, with appointments alongside our team.", pfad: "/en/business/miami" },
      ],
    },
    {
      typ: "verzeichnis", id: "weiterlesen-etappen", h2: "Further reading by stage",
      eintraege: [
        { pfad: "/en/business/knowledge/llc-vs-corporation", tag: "Structure" },
        { pfad: "/en/business/ein-itin", tag: "Tax numbers" },
        { pfad: "/en/business/knowledge/us-bank-account-documents", tag: "Account" },
        { pfad: "/en/business/knowledge/form-5472", tag: "Filings" },
        { pfad: "/en/business/knowledge/us-financing-routes", tag: "Capital" },
        { pfad: "/en/business/costs", tag: "Costs" },
      ],
    },
    { typ: "paket", id: "paket", h2: "The package for your market entry", lead: `Company, tax numbers, registered agent, US address and US phone number for the first year, prepared account and card applications, compliance calendar and a dedicated contact — ${BANKING}.`, paket: "global_banking" },
    {
      typ: "hinweis", id: "wissen", h2: "What you need to know",
      punkte: [
        GLOBAL_PFLICHTHINWEIS.en[0],
        GLOBAL_PFLICHTHINWEIS.en[1],
        GLOBAL_PFLICHTHINWEIS.en[2],
        "Visas, payroll, transfer pricing, sales tax registrations and trademark applications are not part of the packages; we can name partners for these.",
        "FIAON is not a bank and neither grants nor arranges loans. The capital range of a package is your goal, not a promise.",
      ],
    },
  ],
  fragen: [
    { f: "What does a US market entry cost?", a: `Little at state level: formation costs ${STAAT_EN.florida.gruendung} in Florida, ${STAAT_EN.delaware.gruendung} in Delaware and ${STAAT_EN.wyoming.gruendung} in Wyoming; on top come the annual state fee, the registered agent and the US filing by a US CPA. The large items are your operating costs — staff, rent, insurance — and the capital for the first months. With FIAON Global, all fees of the package are included in the fixed price.` },
    { f: "Do I need a company of my own for US expansion?", a: "Not necessarily. Your GmbH can do business as a branch, but is then fully liable for the US business. A separate LLC or corporation keeps liability apart from the parent company and gives your US customers a contracting party on the ground. What fits depends on what you want to do in the US — the assessment before formation clarifies this." },
    { f: "Is a US subsidiary taxable in Germany?", a: "It can be. If it is actually managed from Germany, its place of management is in Germany (section 10 AO); a corporation is then subject to unlimited corporate income tax in Germany (section 1 KStG), while for an LLC the taxation depends on its classification. The interest must be notified to the tax office under section 138 AO. How the double taxation agreement applies is reviewed by our partner tax adviser before formation." },
    { f: "What is the BE-13 filing?", a: "A mandatory filing with the US statistics agency BEA. If a foreign person forms or acquires a US business and holds at least 10 per cent of the voting rights in it, the filing is due no later than 45 calendar days afterwards, even without a request (15 CFR 801.7). With costs of $40 million or less, the short claim for exemption is sufficient." },
    { f: "Do I need a visa to run my US company?", a: "For meetings and appointments, nationals of participating countries travel under the Visa Waiver Program with ESTA approval for business stays of no more than 90 days without a visa. Anyone who wants to run the company on the ground permanently needs a visa; for investors from treaty countries, the E-2 visa may be an option. The individual case is reviewed by a partner immigration lawyer under your engagement; visas are not part of the packages." },
    { f: "What does FIAON Global take on as a business consultancy?", a: "With your power of attorney, we make the applications for you: formation, EIN, D-U-N-S Number and your company’s filings; we prepare the ITIN. We provide the registered agent, US address and US phone number for the first year. You make account, card and credit applications yourself, fully prepared by us. Law and tax are handled by our partners under your engagement; FIAON pays their fees for the services in the package." },
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
