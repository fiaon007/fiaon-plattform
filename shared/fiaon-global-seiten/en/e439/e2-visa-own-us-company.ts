// ═══════════════════════════════════════════════════════════════════════════
// FIAON GLOBAL — KNOWLEDGE: E-2 VISA WITH YOUR OWN US COMPANY (27.10.2026, E-439, FG · 51)
//
// Die englische Schwester von ../../e439/e2-visum.ts — Grundzüge des E-2-Treaty-Investor-
// Visums für Staatsangehörige von Deutschland, Österreich und der Schweiz, strikt als
// Information. Hauptsuchwort EN „E-2 visa German citizens“ (Titel, H1, Kurz, Lead, eine H2);
// daneben E-2 visa Germany/Austria/Swiss citizens, E-2 visa minimum investment, E-2 visa LLC
// (Recherche .arbeit/recherche/kw_en.md, Abschnitt 5.2).
//
// Britisches Englisch, inhaltlich identisch: dieselben Bausteine in derselben Reihenfolge,
// dieselben ids, gleich viele Absätze, Punkte, Zeilen, Etappen, Karten, Fragen, Blick-Zeilen
// und Kennziffern; Quellen mit denselben Adressen in derselben Reihenfolge (englische Titel).
// Die Zahlen stehen wie in der deutschen Fachprüfung vom 27.10.2026 an den amtlichen Texten
// belegt: 9 FAM 402.9 (CT:VISA-2190 vom 17.02.2026), 22 CFR 41.51, 41.102 (14 bis 79 Jahre),
// 22.1 (315 $), 41.121, 8 U.S.C. § 1101(a)(15)(E), USCIS E-2 (zwei Jahre je Zulassung),
// CBP VWP (90 Tage), IRS Substantial Presence Test (31/183 Tage), § 6 AStG (7 von 12 Jahren).
// Die deutsche Fassung liest aus fakten.ts nur QUELLEN_WISSEN — hier QUELLEN_WISSEN_EN und
// QUELLEN_RECHT_EN (dieselben Adressen). GLOBAL_KAPITAL_FREI steht in der deutschen Fassung
// nicht; damit die Fassungen gleich gebaut bleiben, steht es hier auch nicht.
//
// Wortwand EN: kein „up to“, kein Bankname, keine Frist mit Ziffer als Zusage, kein
// Zinssatz, kein „recommend“, kein „advice“, kein „unsecured“ (Darlehen „solely on your
// personal signature“). Über Visum entscheidet das Konsulat, über Konto, Karte und Rahmen
// das Institut; FIAON vermittelt keine Kredite. Visa sind nicht Teil der Pakete.
// ═══════════════════════════════════════════════════════════════════════════
import type { GlobalQuelle, GlobalSeite } from "../../typen";
import { GLOBAL_GELD_ZURUECK, GLOBAL_PFLICHTHINWEIS, globalPaket } from "../../../fiaon-global";
import { QUELLEN_RECHT_EN as R, QUELLEN_WISSEN_EN as Q } from "../../fakten-en";

const S = "2026-10-27";
const GELD_ZURUECK = GLOBAL_GELD_ZURUECK.aktiv ? `${GLOBAL_GELD_ZURUECK.en.text} ${GLOBAL_GELD_ZURUECK.en.bedingungen}` : undefined;
const KAPITAL = globalPaket("global_kapital")?.en.name ?? "Global Capital";

/** Quellen dieses Beitrags — dieselben Adressen wie in der deutschen Fassung, englische Titel. */
const QUELLEN: Record<string, GlobalQuelle> = {
  fam: { titel: "U.S. Department of State — 9 FAM 402.9, Treaty Traders and Investors (E visas), version of 17 February 2026", url: "https://fam.state.gov/fam/09FAM/09FAM040209.html" },
  cfr4151: { titel: "22 CFR 41.51 — treaty trader, treaty investor", url: "https://www.law.cornell.edu/cfr/text/22/41.51" },
  usc1101: { titel: "8 U.S. Code § 1101(a)(15)(E) — treaty trader and treaty investor", url: "https://www.law.cornell.edu/uscode/text/8/1101" },
  uscisE2: { titel: "USCIS — E-2 Treaty Investors", url: "https://www.uscis.gov/working-in-the-united-states/temporary-workers/e-2-treaty-investors" },
  cfr41102: { titel: "22 CFR 41.102 — personal appearance and interview at the consulate", url: "https://www.law.cornell.edu/cfr/text/22/41.102" },
  cfr221: { titel: "22 CFR 22.1 — schedule of fees of the U.S. Department of State", url: "https://www.law.cornell.edu/cfr/text/22/22.1" },
  cfr41121: { titel: "22 CFR 41.121 — refusal of a nonimmigrant visa", url: "https://www.law.cornell.edu/cfr/text/22/41.121" },
  cbpVwp: { titel: "U.S. Customs and Border Protection — Visa Waiver Program", url: "https://www.cbp.gov/travel/international-visitors/visa-waiver-program" },
  irsSpt: { titel: "IRS — Substantial Presence Test", url: "https://www.irs.gov/individuals/international-taxpayers/substantial-presence-test" },
  irsResident: { titel: "IRS — Taxation of Resident Aliens", url: "https://www.irs.gov/individuals/international-taxpayers/taxation-of-resident-aliens" },
  astg6: { titel: "Section 6 German Foreign Tax Act (AStG) — taxation of capital gains on emigration", url: "https://www.gesetze-im-internet.de/astg/__6.html" },
  ao10: R.ao10,
  kstg1: R.kstg1,
};

export const SEITE: GlobalSeite = {
  pfad: "/en/business/knowledge/e2-visa-own-us-company",
  sprache: "en",
  schwester: "/business/wissen/e2-visum",
  art: "wissen",
  seo: {
    titel: "E-2 visa for German citizens: your US company — FIAON Global",
    beschreibung: "E-2 visa for German, Austrian and Swiss citizens: requirements, costs, the consulate process, duration, family and the role of your US company.",
  },
  stand: S,
  erschienen: S,
  kennung: "FG · 51",
  auge: "Knowledge · US investor visa",
  h1: "The E-2 visa for German citizens.",
  h1b: "Your US company as the foundation.",
  lead: "The E-2 visa (E-2 Treaty Investor) allows nationals of certain treaty countries to develop and direct a business in the US in which they have invested a substantial amount. Germany, Austria and Switzerland are among them, so German citizens can apply, as can Austrian and Swiss citizens. This page sets out the requirements under the US State Department’s Foreign Affairs Manual, the process at the consulate, duration and family — and how a properly built US company forms the foundation.",
  ziffern: [
    { wert: "50%", label: "minimum share of the business that must be owned by nationals of the treaty country" },
    { wert: "2 years", label: "maximum stay per admission, extendable with no limit on the number of extensions" },
    { wert: "5 years", label: "generally the period within which the business should generate more than a minimal living" },
  ],
  blick: [
    ["What it is", "A visa for investors from treaty countries, not a Green Card"],
    ["Treaty countries", "Germany, Austria and Switzerland"],
    ["Investment", "Substantial in relation to the cost, your own capital at risk"],
    ["Business", "Real, operating and more than marginal"],
    ["Control", "As a rule, at least 50 per cent ownership or operational control"],
    ["Family", "Spouse and unmarried children under 21"],
    ["With FIAON Global", "Company, EIN and well-ordered records with your power of attorney; the partner lawyer applies for the visa"],
  ],
  kurz: "The E-2 visa is open to nationals of treaty countries. Germany, Austria and Switzerland are among them, so German citizens can apply for it, as can Austrian and Swiss citizens. Under the US State Department’s Foreign Affairs Manual (9 FAM 402.9), you need a substantial investment of your own funds that is at risk and irrevocably committed; a real, operating business that generates more than a minimal living for your family; at least 50 per cent of the business owned by nationals of the treaty country; your control of the business; and the intention to leave the US when your status ends. There is no fixed minimum amount. You apply at the US consulate, which alone decides.",
  bloecke: [
    {
      typ: "text", id: "was-es-ist", h2: "What the E-2 visa is — and what it is not",
      absaetze: [
        "The E-2 visa is a visa for a temporary stay. US immigration law provides it for nationals of a country with which the United States has concluded a treaty of commerce and navigation — specifically for the investor who wants to develop and direct a business in which they have invested, or are actively investing, a substantial amount (8 U.S.C. § 1101(a)(15)(E)(ii)). Equivalent agreements count as well (22 CFR 41.51(b)(5)). Under the regulation, employees of the same nationality can also receive an E-2 visa if they work in an executive or supervisory role or bring skills essential to the business (22 CFR 41.51(b)(2)).",
        "It is not a Green Card. Anyone applying for the visa must declare the intention to leave the US when the status ends. They do not have to keep a residence at home for this: under the State Department’s manual, they may sell their home and move their household to the US (9 FAM 402.9-4(C)).",
        "Owning a US company does not, in itself, give you the right to live or work in the US. Nor does the ITIN, your personal tax number with the IRS, change your immigration status or permit you to work. For meetings, trade fairs and appointments, nationals of participating countries travel without a visa under the Visa Waiver Program, using ESTA, for business stays of no more than 90 days. Anyone who wants to build and run the company on the ground over the long term needs a visa — for investors from treaty countries, the E-2 visa is the one to consider.",
      ],
    },
    {
      typ: "tabelle", id: "vertragsstaaten", h2: "E-2 visa for German, Austrian and Swiss citizens",
      lead: "All three countries appear in the US State Department’s list of treaty countries, each for E-1 (trade) and E-2 (investment).",
      kopf: ["Nationality", "E-1 in force since", "E-2 in force since"],
      zeilen: [
        ["Germany", "14 July 1956", "14 July 1956"],
        ["Austria", "27 May 1931", "27 May 1931"],
        ["Switzerland", "8 November 1855", "8 November 1855"],
      ],
      fuss: [
        "Source: 9 FAM 402.9-10, version of 17 February 2026. What counts is nationality — not residence, and not the place where the company was formed (9 FAM 402.9-4(B)). The law names one exception: anyone who acquired their nationality through an investment and has never held E status must, at some point before applying, have lived in that country continuously for at least three years (8 U.S.C. § 1101(a)(15)(E)).",
        "If you hold two nationalities, you choose one of them for the business; the owner and all E employees then apply under that nationality. Shares held by Green Card holders do not count towards the nationality of the business.",
      ],
    },
    {
      typ: "tabelle", id: "voraussetzungen", h2: "E-2 visa requirements at a glance",
      lead: "The consulate examines these nine points in an E-2 application; the manual lists them in this order (9 FAM 402.9-6(A)). The burden of proof lies with the applicant (9 FAM 402.9-2).",
      kopf: ["Requirement", "What the consulate examines", "Reference"],
      zeilen: [
        ["Treaty country", "A qualifying treaty exists between the US and your country", "9 FAM 402.9-4(A), 402.9-10"],
        ["Nationality", "Investor and business have the nationality of the treaty country; for the business, nationality follows its owners — at least 50 per cent", "9 FAM 402.9-4(B), 402.9-6(F)"],
        ["Investment", "Your own funds, at risk, irrevocably committed, from a lawful source", "9 FAM 402.9-6(B); 22 CFR 41.51(b)(7)"],
        ["Real business", "Active and profit-oriented, produces goods or services, meets the local legal requirements; not a company that exists only on paper", "9 FAM 402.9-6(C); 22 CFR 41.51(b)(8)"],
        ["Substantial amount", "In proportion to the cost of the business; no fixed minimum amount", "9 FAM 402.9-6(D)"],
        ["Not marginal", "More than a minimal living for the family, or a significant economic contribution", "9 FAM 402.9-6(E); 22 CFR 41.51(b)(10)"],
        ["Develop and direct", "As a rule, at least 50 per cent ownership by the investor or operational control", "9 FAM 402.9-6(F); 22 CFR 41.51(b)(11)"],
        ["Senior position", "Executive or supervisory position, or skills essential to the operation", "9 FAM 402.9-7(B), 402.9-7(C)"],
        ["Intention to depart", "The intention to leave the US when the status ends", "9 FAM 402.9-4(C)"],
      ],
      fuss: ["An office of your own is not a requirement, but it can play a part in the assessment (9 FAM 402.9-4(D))."],
    },
    {
      typ: "text", id: "investition", h2: "The investment: what “substantial” means",
      absaetze: [
        "There is no fixed dollar amount above which an investment counts as substantial. The State Department’s manual says so expressly (9 FAM 402.9-6(D)). The test is proportional: the amount of your investment is measured against the cost of the business, on what works like an inverted sliding scale. The less expensive the business, the higher your share of the cost must be; for a very expensive business, a smaller share can suffice. As an example, the manual cites a business with start-up costs of $100,000 that you finance entirely yourself — as a rule, that counts as substantial. At the other end, an investment of $10 million in a business costing $100 million can be sufficient by virtue of its size alone. For a new business, the cost is what it takes to make the business operational. Fixed minimum sums circulating online appear neither in the regulation (22 CFR 41.51) nor in the manual.",
        "The funds must belong to you and be under your control. They may come from savings, gifts, an inheritance or other lawful sources, including a loan secured by your own assets — a mortgage on your own property, for instance — or a loan granted solely on your personal signature. Loans secured by the assets of the business, by contrast, do not count, even if private security is provided in addition: they lack the element of risk (9 FAM 402.9-6(B)). Whether a credit line that your company obtains from an institution can count therefore depends on what secures it — the partner lawyer examines this case by case. You document the source of the funds in full, without gaps.",
        "Invested means at risk and committed. A balance in an account that you could withdraw at any time is not enough; nor is a mere intention. Anyone still in the process of investing must be close to starting actual business operations; signing contracts or searching for sites is not enough. A purchase made conditional on the visa can suffice if the funds are held in escrow and released when the visa is issued. Rent and leases for premises or equipment count only in the amount of one monthly payment, and a year’s rent only if it has been paid in advance; equipment and inventory count at their purchase price, provided they serve the business and not private purposes.",
      ],
    },
    {
      typ: "text", id: "unternehmen", h2: "The business: real, operating, more than marginal",
      absaetze: [
        "The business must be a real, operating enterprise that produces goods or services. Undeveloped land, shares you merely hold without directing the business, or a company that exists only on paper do not qualify, nor do non-profit organisations (9 FAM 402.9-6(C)). For a new business, the consulate must be satisfied that it will become such an enterprise once the visa is issued. To that end, the business must meet the legal requirements for doing business in the place where it operates (22 CFR 41.51(b)(8)).",
        "A business is marginal if it cannot, now or in the future, generate more than a minimal living for the investor and their family. A business that can make a significant economic contribution, now or in the future, is not marginal. That future income should, as a rule, be achievable within five years of the start of normal business operations (22 CFR 41.51(b)(10)). This is why every file needs a credible business plan with figures and evidence of the first steps.",
        "As a rule, you show control through at least 50 per cent ownership. Operational control through a managerial position or another corporate arrangement can also suffice; a mere title without actual control does not. Where two equal partners hold 50 per cent each, the manual generally recognises joint control if both retain full management rights; with more than two equal partners, ownership alone does not establish control (9 FAM 402.9-6(F)). Where you formed the company — Florida, Delaware or Wyoming — makes no difference to the nationality of the business: it follows the owners (9 FAM 402.9-4(B)).",
      ],
    },
    {
      typ: "karten", id: "laender", h2: "Your US company by country of origin", spalten: 3,
      lead: "Formation, filings and tax also depend on where you live today.",
      karten: [
        { tag: "Germany", titel: "US company from Germany", text: "Formation, notification under section 138 AO and tax liability at home.", pfad: "/en/business/from-germany" },
        { tag: "Austria", titel: "US company from Austria", text: "The route for Austrian entrepreneurs and the rules that apply there.", pfad: "/en/business/from-austria" },
        { tag: "Switzerland", titel: "US company from Switzerland", text: "Formation and obligations for entrepreneurs from Switzerland.", pfad: "/en/business/from-switzerland" },
      ],
    },
    {
      typ: "etappen", id: "ablauf", h2: "The process at the consulate in six steps",
      lead: "From Germany, Austria or Switzerland, the route runs through the US consulate or embassy. The USCIS route with Form I-129 is open only if you are already lawfully in the US in another nonimmigrant status; anyone who is abroad cannot use it.",
      etappen: [
        { titel: "Build the company", dauer: "before applying", text: "Formation with the state, EIN, an operating agreement with clear ownership, an application for a business account — the institution decides on the account." },
        { titel: "Make the investment", dauer: "before applying", text: "Pay in and commit the funds: contracts, invoices, equipment, inventory — all documented and attributable to the company." },
        { titel: "Compile the file", dauer: "before applying", text: "Evidence of nationality, ownership, investment and source of funds, plus the business plan; the manual lists possible documents (9 FAM 402.9-11(B)). Unverified figures that rest solely on your own statements are generally not enough (9 FAM 402.9-6(D))." },
        { titel: "Form DS-160", dauer: "online", text: "The investor answers the questions of Form DS-156-E directly within the DS-160; employees also submit Form DS-156-E." },
        { titel: "Interview at the consulate", dauer: "in person", text: "Applicants aged between 14 and 79 generally attend an interview in person (22 CFR 41.102). The consulate may request any further documents." },
        { titel: "Decision and entry", dauer: "after the interview", text: "With the visa, you seek admission at the border, where the border authority, CBP, decides whether to admit you." },
      ],
    },
    {
      typ: "text", id: "laufzeit", h2: "Duration, extension and family",
      absaetze: [
        "Two periods need to be distinguished. The visa in your passport determines how long you can use it to enter the US; how long it is issued for depends on the State Department’s reciprocity schedule for your nationality. How long you may stay is determined by your admission on entry: a maximum of two years the first time. Extensions are possible for a maximum of two years each, with no limit on their number (USCIS). If you travel abroad and re-enter, you will generally be given a new two-year period, provided the border authority admits you.",
        "The requirements continue to apply. The business must remain active and more than marginal, its nationality must be preserved, and the intention to leave at the end of the status remains part of every review. Once the investment has been recognised as substantial, this point is generally not re-examined as long as the ownership does not change (9 FAM 402.9-6(D)). Some consulates keep a registry of businesses that have already been recognised; at those consulates, a review is generally scheduled at least every five years (9 FAM 402.9-7(D)).",
        "Spouses and unmarried children under 21 can receive the same status; their nationality does not have to match yours. Your spouse may work in the US — the authorisation follows from the status, and their arrival record (Form I-94) carries the annotation E-2S for this purpose. Children with the annotation E-2Y may not work (9 FAM 402.9-9). Employees of the company can receive an E-2 visa if they share your nationality and come as an executive, a supervisor or with essential skills.",
      ],
    },
    {
      typ: "text", id: "grenzen", h2: "E-2 visa refused — and what about the Green Card?",
      absaetze: [
        "If the consulate refuses a visa, the refusal must rest on a legal basis. The consulate tells you the reason, unless the law precludes disclosure, and says whether there is a way to overcome it; every refusal is reviewed within the consulate (22 CFR 41.121). If a ground can be remedied with further evidence, you can submit that evidence. In an E-2 application, such evidence concerns the points on this page: committed funds, their documented source and a business plan showing that the business will be more than marginal. That is why every point belongs in the file, documented, before the interview.",
        "The E-2 visa is a visa for a temporary stay; the law lists it among the nonimmigrant categories (8 U.S.C. § 1101(a)(15)(E)). It does not turn into a Green Card of its own accord. Anyone who is at the same time the beneficiary of an immigrant petition must satisfy the consulate that they intend to leave the US at the end of their stay (9 FAM 402.9-4(C)). Anyone who wishes to emigrate permanently should therefore clarify their route with the partner immigration lawyer before the company is set up for a visa.",
      ],
    },
    {
      typ: "text", id: "steuern", h2: "Tax when you move: two countries, one review beforehand",
      absaetze: [
        "A visa is not a tax model. As long as you manage your US company from Germany, its place of management is there (section 10 of the German Fiscal Code, AO), and it has unlimited corporate income tax liability there if it is treated as a corporation (section 1 of the German Corporate Income Tax Act, KStG). Your shareholding must be reported to the tax office with your tax return (section 138 AO).",
        "If you move to the US, you will generally be treated as tax resident there if you meet the Substantial Presence Test: at least 31 days in the current year and 183 days over three years, with the days of the two preceding years counting for only one third and one sixth respectively. The IRS itself names exceptions, for example where you have a closer connection to another country. Residents are subject to US tax on their worldwide income (IRS).",
        "In Germany, moving away can itself trigger tax: anyone who has been subject to unlimited tax liability for at least seven of the last twelve years and holds shares in a corporation within the meaning of section 17 of the German Income Tax Act (EStG) is treated on departure as if they had sold them (section 6 of the German Foreign Tax Act, AStG). Depending on its classification, your US company may be among them. Which country taxes which income is governed by the double taxation agreement. Austria and Switzerland have their own rules — all of this belongs on the desk of our partner tax adviser before the move, not afterwards.",
      ],
    },
    {
      typ: "rollen", id: "rollen", h2: "Who does what on the way to the E-2 visa",
      lead: "One contact instead of eight — and a clear line when it comes to the visa.",
      fiaon: [
        "Formation of the US company with your power of attorney, with ownership and management clearly set out from the start",
        "EIN, D-U-N-S Number, the company’s filings; ITIN application prepared",
        "Registered agent, US business address and US phone number for the first year",
        "Account and card applications prepared in full",
        "Formation documents and records filed in order in the document room, ready for the lawyer’s file",
      ],
      partner: [
        "Partner lawyer: operating agreement and formation documents",
        "Partner tax adviser: review before formation, including with a view to a planned move",
        "US CPA: the first annual US filing",
        "Partner immigration lawyer: the visa application under your own engagement, not part of the packages",
      ],
      sie: [
        "The investment from your own documented funds",
        "Business plan and decisions within the business",
        "Signing and submitting account, card and credit applications yourself",
        "Form DS-160 and the interview at the consulate",
      ],
    },
    {
      typ: "text", id: "fiaon", h2: "How FIAON Global takes care of the foundation for your E-2 visa",
      absaetze: [
        "FIAON Global is the business consultancy for your route into the US: one contact instead of eight. With your power of attorney, we file the applications for you — formation with the state, the EIN, the D-U-N-S Number and your company’s filings — and prepare your ITIN application. We provide the registered agent, US business address and US phone number for the first year. You submit only account, card and credit applications yourself; we prepare each of them in full.",
        "With a later E-2 visa in mind, we build the company so that it can be documented: ownership and management are clearly set out from the start in the operating agreement drafted by our partner lawyer; the company’s name, address and core data match across all documents; and every record is filed in order in your document room. Whether the investment and the business suffice for a visa is decided by the consulate. Partner tax advisers, US CPAs and partner lawyers act under your engagement; FIAON pays their fees for the services in your package.",
        "The visa application itself is made by a partner immigration lawyer under your own engagement — it is not part of the packages. We make the introduction and, with your consent, pass on the company’s documents. With Global VIP, the set-up begins in person in Miami: our team on the ground accompanies your appointments with authorities and banks, complemented by our partner location in Zurich and your contracting party, FIAON LTD in London. You pay a fixed price that includes all fees of the package; from the second year onwards, the annual care plan is optional.",
      ],
      nach: GELD_ZURUECK,
    },
    { typ: "paket", id: "paket", h2: "Global VIP: your set-up in Miami, accompanied in person", lead: `Everything in ${KAPITAL}, plus the kick-off in person in Miami, appointments with authorities and banks together with our team, and support from our management — Global VIP.`, paket: "global_vip" },
    {
      typ: "hinweis", id: "wissen", h2: "What you need to know",
      punkte: [
        "Only the consulate decides on a visa, and only the border authority on admission at entry. No one can make a binding promise about a visa, its duration or an extension.",
        "The visa application is not part of the packages. The application and the individual case belong in the hands of a partner immigration lawyer, who acts under your engagement and agrees their fee with you.",
        "A US company gives no right to live or work in the US; the ITIN does not permit work either.",
        GLOBAL_PFLICHTHINWEIS.en[0],
        GLOBAL_PFLICHTHINWEIS.en[1],
        "FIAON is not a bank and neither grants nor arranges loans. The capital range of a package is a goal, not a promise.",
        "This page reflects the regulations as of October 2026; rules and fees may change.",
      ],
    },
  ],
  fragen: [
    { f: "What are the requirements for the E-2 visa?", a: "Nationality of a treaty country, a substantial investment of your own funds at risk, a real, operating business that is more than marginal, at least 50 per cent of the business in the hands of nationals of the treaty country, your control of the business and the intention to leave the US when your status ends (9 FAM 402.9-6). The burden of proof lies with the applicant." },
    { f: "Can German, Austrian and Swiss citizens apply for an E-2 visa?", a: "Yes. Germany, Austria and Switzerland appear in the US State Department’s list of treaty countries, each for E-1 and E-2. What counts is nationality, not residence. The consulate decides on each individual application." },
    { f: "How much do I need to invest for an E-2 visa?", a: "There is no fixed minimum amount. The consulate measures your investment against the cost of the business: the less expensive the business, the higher your share must be. According to the manual, a business with start-up costs of $100,000 that you finance entirely yourself generally counts as substantial." },
    { f: "Is a US LLC enough for the E-2 visa?", a: "An LLC can be the business, but forming it is not enough on its own. You need a committed investment, an active business that is more than marginal, and your control. Owning a company gives no right to live or work in the US." },
    { f: "How long is the E-2 visa valid?", a: "Each time you enter, you are admitted for a maximum of two years; extensions of a maximum of two years each are possible, with no limit on their number. How long the visa in your passport is valid depends on the reciprocity schedule for your nationality. The E-2 visa is not a Green Card, and it does not turn into one of its own accord." },
    { f: "Can my spouse work on an E-2 visa?", a: "Yes. The spouse of an E-2 investor is authorised to work by virtue of their status; the arrival record carries the annotation E-2S. Unmarried children under 21 receive the same status but may not work." },
    { f: "What does the application at the consulate cost?", a: "The State Department’s fee schedule sets an application fee of $315 for E visas (22 CFR 22.1, as of October 2026). Depending on nationality, an issuance fee based on reciprocity may be added; further statutory fees are possible. You agree the immigration lawyer’s fee with them." },
    { f: "Does FIAON handle the visa application?", a: "No. Visas are not part of the packages. FIAON Global builds the US company that forms the foundation and puts its documents in order; the application is made by a partner immigration lawyer under your engagement." },
  ],
  paket: "global_vip",
  weiter: ["/en/business/miami", "/en/business/knowledge/us-market-entry", "/en/business/knowledge/us-llc-german-resident", "/en/business/from-austria"],
  quellen: [
    QUELLEN.fam,
    QUELLEN.cfr4151,
    QUELLEN.usc1101,
    QUELLEN.uscisE2,
    QUELLEN.cfr41102,
    QUELLEN.cfr221,
    QUELLEN.cfr41121,
    QUELLEN.cbpVwp,
    Q.itinUebersicht,
    QUELLEN.irsSpt,
    QUELLEN.irsResident,
    QUELLEN.astg6,
    QUELLEN.ao10,
    QUELLEN.kstg1,
    Q.ao138,
    Q.dba,
  ],
};
