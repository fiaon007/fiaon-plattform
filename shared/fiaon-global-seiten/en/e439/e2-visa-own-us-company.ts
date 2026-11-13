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
// das Institut; FIAON vermittelt keine Kredite. Visa sind nicht Teil des Auftrags.
// E-509 (12.11.2026): EIN Produkt statt vier Pakete — kein „Global VIP“ mehr (kein Preis, kein Reiseversprechen); ab 1 Mio.
// US-Dollar Kapitalrahmen persönlich in Miami. Die alte Geld-zurück-Zusage je Paket entfällt.
// Runde zwei zum Sprachleitfaden: jeder sichtbare Text neu geschrieben (britisch, nicht Wort für Wort übersetzt) — im selben
// Zug wie die deutsche Fassung. Fakten, Zahlen, Fundstellen und Quellen unverändert. Die Sachabschnitte erklären das Recht
// ohne FIAON; FIAON steht erst ab dem Baustein „rollen“. Im Fließtext „an immigration lawyer“ (der Beruf), bei FIAON
// „partner lawyers“ (die Rolle, nie bei der Arbeit). Kein Satz stellt ein Visum in Aussicht: Es entscheidet die US-Behörde.
// ═══════════════════════════════════════════════════════════════════════════
import type { GlobalQuelle, GlobalSeite } from "../../typen";
import { GLOBAL_PFLICHTHINWEIS } from "../../../fiaon-global";
import { EIN_PRODUKT } from "../../ein-produkt";
import { QUELLEN_RECHT_EN as R, QUELLEN_WISSEN_EN as Q } from "../../fakten-en";
import { SCHRITTE_KOPF, SECHS_SCHRITTE, satz, weitererSatz, type Schritt, type SchrittNr } from "../../../fiaon-global-saetze";

const S = "2026-10-27";
const P = EIN_PRODUKT.en;
/** Steps 1 and 2 of the fixed narrative (language guide 2.3) — sentence and “your part” from the one source, never retyped (E-510). */
const schritt = (nr: SchrittNr): Schritt => SECHS_SCHRITTE.en.find((x) => x.nr === nr)!;
const GRUENDUNG = schritt(1);
const UNTERLAGEN = schritt(2);
/** The names of the fixed parts of a step: “Your part”, “Condition” (language guide 2.1). */
const TEIL = SCHRITTE_KOPF.en.teile;
/** The role sentence from the foot of every page, its first two sentences: not a bank, not a law firm · no lending — imported, never retyped. */
const [KEINE_BANK, KEINE_KREDITE] = satz("S8", "en").split(/(?<=\.)\s+/);

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
    beschreibung: "E-2 visa for German, Austrian and Swiss citizens: requirements, costs, the application, duration and family. The US consulate decides.",
  },
  stand: "2026-11-13",
  erschienen: S,
  kennung: "FG · 51",
  auge: "Knowledge · US investor visa",
  h1: "The E-2 visa for German citizens.",
  h1b: "Requirements, application and decision.",
  lead: "The E-2 visa (E-2 Treaty Investor) allows nationals of certain treaty countries to develop and direct a business in the US. It requires a substantial investment in that business. Germany, Austria and Switzerland are treaty countries, so German citizens can apply, as can Austrian and Swiss citizens. This page sets out the requirements under the US State Department’s Foreign Affairs Manual, the application process, duration and family. The US authority alone decides on every application.",
  ziffern: [
    { wert: "50%", label: "minimum share of the business owned by nationals of the treaty country" },
    { wert: "2 years", label: "maximum stay per admission; the number of extensions is not limited" },
    { wert: "5 years", label: "period within which the business should generally generate more than a minimal living" },
  ],
  blick: [
    ["What it is", "A visa for investors from treaty countries; a temporary stay, not a Green Card"],
    ["Treaty countries", "Germany, Austria and Switzerland are among them"],
    ["Investment", "Substantial in relation to the cost of the business; your own funds at risk"],
    ["Business", "Real, operating and more than marginal"],
    ["Control", "As a rule, at least 50 per cent ownership or operational control"],
    ["Family", "Spouse and unmarried children under 21"],
    ["Who decides", "The US consulate on the visa; the border authority, CBP, on admission"],
    ["FIAON Global handles", "Formation, documents and the EIN and ITIN applications; the visa application is not part of the engagement"],
  ],
  kurz: "The E-2 visa is a US visa for investors from treaty countries; German citizens can apply, as can Austrian and Swiss citizens. The US State Department’s Foreign Affairs Manual (9 FAM 402.9) requires a substantial investment of your own funds that is at risk and irrevocably committed. The business must be real and operating and generate more than a minimal living for your family. Nationals of the treaty country own at least 50 per cent of it; you direct it and declare your intention to depart. There is no fixed minimum amount. The US consulate alone decides.",
  bloecke: [
    {
      typ: "text", id: "was-es-ist", h2: "The E-2 visa: classification and limits",
      absaetze: [
        "The E-2 visa is a visa for a temporary stay. US immigration law provides it for nationals of a country with which the United States has concluded a treaty of commerce and navigation. It is meant for the investor who wants to develop and direct a business. The investor has invested a substantial amount in that business, or is actively investing it (8 U.S.C. § 1101(a)(15)(E)(ii)). Equivalent agreements count as well (22 CFR 41.51(b)(5)). Under the regulation, employees of the same nationality can also receive an E-2 visa: as executives, as supervisors or with skills essential to the business (22 CFR 41.51(b)(2)).",
        "It is not a Green Card. Anyone applying for the visa declares the intention to leave the US when the status ends. Applicants do not have to keep a residence in their home country. Under the State Department’s manual, they may sell their home and move their household to the US (9 FAM 402.9-4(C)).",
        "Owning a US company does not, in itself, give you the right to live or work in the US. Nor does the ITIN change your immigration status or permit you to work; it is your personal tax number with the US tax authority, the IRS. For meetings, trade fairs and appointments, the Visa Waiver Program applies. Under it, nationals of participating countries travel without a visa, using ESTA, for business stays of no more than 90 days. Anyone who wants to build and run the company on site over the long term needs a visa. For investors from treaty countries, the E-2 visa is the category to consider.",
      ],
    },
    {
      typ: "tabelle", id: "vertragsstaaten", h2: "E-2 visa: German, Austrian and Swiss citizens",
      lead: "The US State Department lists all three countries as treaty countries, each for E-1 (trade) and E-2 (investment).",
      kopf: ["Nationality", "E-1 in force since", "E-2 in force since"],
      zeilen: [
        ["Germany", "14 July 1956", "14 July 1956"],
        ["Austria", "27 May 1931", "27 May 1931"],
        ["Switzerland", "8 November 1855", "8 November 1855"],
      ],
      fuss: [
        "Source: 9 FAM 402.9-10, version of 17 February 2026. Nationality is what counts. Residence and the place where the company was formed do not (9 FAM 402.9-4(B)). The law names one exception: anyone who acquired their nationality through an investment and has never held E status must have lived in that country continuously for at least three years at some point before applying (8 U.S.C. § 1101(a)(15)(E)).",
        "If you hold two nationalities, you choose one of them for the business. The owner and all E employees then apply under that nationality. Shares held by Green Card holders do not count towards the nationality of the business.",
      ],
    },
    {
      typ: "tabelle", id: "voraussetzungen", h2: "E-2 visa: the nine requirements",
      lead: "In an E-2 application, the consulate examines nine points. The manual lists them in this sequence (9 FAM 402.9-6(A)). The burden of proof lies with the applicant (9 FAM 402.9-2).",
      kopf: ["Requirement", "What the consulate examines", "Reference"],
      zeilen: [
        ["Treaty country", "A qualifying treaty exists between the US and your country", "9 FAM 402.9-4(A), 402.9-10"],
        ["Nationality", "Investor and business have the nationality of the treaty country; for the business, the owners count, at least 50 per cent", "9 FAM 402.9-4(B), 402.9-6(F)"],
        ["Investment", "Your own funds, at risk, irrevocably committed, from a lawful source", "9 FAM 402.9-6(B); 22 CFR 41.51(b)(7)"],
        ["Real business", "Active and profit-oriented, produces goods or services, meets the local legal requirements; not a company that exists only on paper", "9 FAM 402.9-6(C); 22 CFR 41.51(b)(8)"],
        ["Substantial amount", "In proportion to the cost of the business; no fixed minimum amount", "9 FAM 402.9-6(D)"],
        ["Not marginal", "More than a minimal living for the family, or a significant economic contribution", "9 FAM 402.9-6(E); 22 CFR 41.51(b)(10)"],
        ["Develop and direct", "As a rule, at least 50 per cent ownership by the investor or operational control", "9 FAM 402.9-6(F); 22 CFR 41.51(b)(11)"],
        ["Senior position", "Executive or supervisory position, or skills essential to the operation", "9 FAM 402.9-7(B), 402.9-7(C)"],
        ["Intention to depart", "The intention to leave the US when the status ends", "9 FAM 402.9-4(C)"],
      ],
      fuss: ["An office of your own is not a requirement. The consulate may take it into account in its decision (9 FAM 402.9-4(D))."],
    },
    {
      typ: "text", id: "investition", h2: "The investment: what “substantial” means",
      absaetze: [
        "There is no fixed dollar amount above which an investment counts as substantial. The State Department’s manual says so expressly (9 FAM 402.9-6(D)). The consulate measures the amount invested against the cost of the business; the manual calls this an inverted sliding scale. The lower the cost of the business, the higher your share of it must be. For a business with high costs, a smaller share can suffice. As an example, the manual cites a business with start-up costs of $100,000 that you finance entirely yourself: as a rule, that counts as substantial. Conversely, an investment of $10 million in a business costing $100 million can suffice by virtue of its size alone. For a new business, the cost is what it takes to make the business operational. Neither the regulation (22 CFR 41.51) nor the manual sets a minimum sum.",
        "The funds must belong to you and be under your control. They may come from savings, gifts, an inheritance or other lawful sources. A loan secured by your own assets counts as well, for instance by a mortgage on your own property. So does a loan granted solely on your personal signature. Loans secured by the assets of the business do not count, even where private security is provided in addition. Such loans lack the element of risk (9 FAM 402.9-6(B)). Whether a loan from an institution to your company counts therefore depends on what secures it. The consulate assesses this; classifying your case beforehand is a matter for an immigration lawyer. You document the source of the funds in full.",
        "Invested means at risk and committed. A bank balance that you could withdraw at any time is not enough. Nor is a mere intention. Anyone still in the process of investing must be close to starting actual business operations. Signing contracts or searching for sites is not enough. A purchase made conditional on the visa can suffice if the funds are held in escrow and released when the visa is issued. Rent and leases for premises or equipment count only in the amount of one monthly payment. A year’s rent counts only if it has been paid in advance. Equipment and inventory count at their purchase price, provided they serve the business and not private purposes.",
      ],
    },
    {
      typ: "text", id: "unternehmen", h2: "The business: real, operating, not marginal",
      absaetze: [
        "The business must be real and operating and must produce goods or services. Undeveloped land does not qualify, nor do shares you merely hold without directing the business. The same applies to a company that exists only on paper and to non-profit organisations (9 FAM 402.9-6(C)). For a new business, the consulate must be satisfied that it will become such an enterprise once the visa is issued. The business must also meet the legal requirements for doing business in the place where it operates (22 CFR 41.51(b)(8)).",
        "A business is marginal if it cannot, now or in the future, generate more than a minimal living for the investor and their family. A business that can make a significant economic contribution, now or in the future, is not marginal. As a rule, it should be able to reach that future income within five years of the start of normal business operations (22 CFR 41.51(b)(10)). The file therefore includes a credible business plan with figures and evidence of the first steps.",
        "As a rule, you show control through at least 50 per cent ownership. Operational control can also suffice, for example through a managerial position or another corporate arrangement. A title without actual control does not. Where two equal partners hold 50 per cent each, the manual generally recognises joint control if both retain full management rights. With more than two equal partners, ownership alone does not establish control (9 FAM 402.9-6(F)). The state of formation, whether Florida, Delaware or Wyoming, does not change the nationality of the business. Nationality follows the owners (9 FAM 402.9-4(B)).",
      ],
    },
    {
      typ: "karten", id: "laender", h2: "Your US company by country of residence", spalten: 3,
      lead: "Formation, filings and tax also depend on your country of residence.",
      karten: [
        { tag: "Germany", titel: "US company from Germany", text: "Formation, notification under section 138 AO and tax liability in Germany.", pfad: "/en/business/from-germany" },
        { tag: "Austria", titel: "US company from Austria", text: "Formation and the rules for entrepreneurs from Austria.", pfad: "/en/business/from-austria" },
        { tag: "Switzerland", titel: "US company from Switzerland", text: "Formation and obligations for entrepreneurs from Switzerland.", pfad: "/en/business/from-switzerland" },
      ],
    },
    {
      typ: "etappen", id: "ablauf", h2: "The application in six steps",
      lead: "Anyone who is outside the US applies at the US consulate or embassy. An application to USCIS with Form I-129 requires that you are already lawfully in the US in another nonimmigrant status.",
      etappen: [
        { titel: "Build the company", dauer: "before applying", text: "Formation with the state, the company’s tax identification number (EIN) and the operating agreement, the company agreement that sets out ownership. In addition, the application for a business account; the institution concerned decides on the account." },
        { titel: "Make the investment", dauer: "before applying", text: "Pay in and commit the funds: contracts, invoices, equipment and inventory. Every transaction is documented and attributable to the company." },
        { titel: "Compile the file", dauer: "before applying", text: "Evidence of nationality, ownership, investment and source of funds, plus the business plan. The manual lists possible documents (9 FAM 402.9-11(B)). Unverified figures that rest solely on your own statements are generally not enough (9 FAM 402.9-6(D))." },
        { titel: "Form DS-160", dauer: "online", text: "The investor answers the questions of Form DS-156-E directly within the DS-160. Employees also submit Form DS-156-E." },
        { titel: "Interview at the consulate", dauer: "in person", text: "Applicants aged between 14 and 79 generally attend an interview in person (22 CFR 41.102). The consulate may request any further document." },
        { titel: "Decision and entry", dauer: "after the interview", text: "The consulate decides on the visa. With a visa, you seek admission at the border; there the border authority, CBP, decides whether to admit you." },
      ],
    },
    {
      typ: "text", id: "laufzeit", h2: "Duration, extension and family",
      absaetze: [
        "The visa and the length of stay each have their own period. The visa in your passport determines the date until which you may enter the US. Its validity depends on the State Department’s reciprocity schedule for your nationality. How long you may stay is determined by your admission on entry: a maximum of two years the first time. Extensions are possible for a maximum of two years each; their number is not limited (USCIS). If you travel abroad and re-enter, you are generally given a new two-year period, provided the border authority admits you.",
        "The requirements continue to apply for as long as the status lasts. The business must remain active and more than marginal, and its nationality must be preserved. The intention to leave at the end of the status remains part of every application. Once the investment has been recognised as substantial, this point is generally not re-examined as long as the ownership stays the same (9 FAM 402.9-6(D)). Some consulates keep a registry of businesses they have already recognised. There, a review is generally scheduled at least every five years (9 FAM 402.9-7(D)).",
        "Spouses and unmarried children under 21 can receive the same status. Their nationality does not have to match yours. Your spouse may work in the US: the authorisation follows from the status, and their arrival record (Form I-94) carries the annotation E-2S. Children with the annotation E-2Y may not work (9 FAM 402.9-9). Employees of the company can receive an E-2 visa if they share your nationality. They come as executives, as supervisors or with essential skills.",
      ],
    },
    {
      typ: "text", id: "grenzen", h2: "E-2 visa: refusal and the Green Card",
      absaetze: [
        "If the consulate refuses a visa, the refusal must rest on a legal basis. The consulate tells you the reason, unless the law precludes disclosure. It also says whether the reason can be overcome. The consulate reviews every refusal internally (22 CFR 41.121). If a ground can be remedied with further evidence, you can submit that evidence. In an E-2 application, such evidence concerns the points on this page: committed funds, their documented source and the business plan. The plan shows that the business will be more than marginal. Every point therefore belongs in the file, documented, before the interview takes place.",
        "The law lists the E-2 visa among the nonimmigrant categories (8 U.S.C. § 1101(a)(15)(E)). It does not turn into a Green Card of its own accord. Anyone who is at the same time the beneficiary of an immigrant petition must satisfy the consulate that they intend to leave the US at the end of their stay (9 FAM 402.9-4(C)). Anyone who wishes to emigrate permanently clarifies this question with an immigration lawyer before forming the company.",
      ],
    },
    {
      typ: "text", id: "steuern", h2: "Tax when you move: two countries",
      absaetze: [
        "A visa is not a tax scheme. As long as you manage your US company from Germany, its place of management is there (section 10 of the German Fiscal Code, AO). If it is treated as a corporation, it has unlimited corporate income tax liability there (section 1 of the German Corporate Income Tax Act, KStG). You report your shareholding to the tax office with your tax return (section 138 AO).",
        "If you move to the US, you are generally treated as tax resident there if you meet the Substantial Presence Test. The test requires at least 31 days in the current year and 183 days over three years. The days of the two preceding years count for only one third and one sixth respectively. The IRS names exceptions, for example where you have a closer connection to another country. Residents are subject to US tax on their worldwide income (IRS).",
        "In Germany, moving away can itself trigger tax. This affects anyone who holds shares in a corporation within the meaning of section 17 of the German Income Tax Act (EStG). A further condition is unlimited tax liability for at least seven of the last twelve years. On departure, the law treats such a person as if they had sold the shares (section 6 of the German Foreign Tax Act, AStG). Depending on its classification, the shares in your US company may be among them. The double taxation agreement governs which country taxes which income. Austria and Switzerland have their own rules. Tax questions belong with a tax adviser before the move.",
      ],
    },
    {
      typ: "rollen", id: "rollen", h2: "E-2 visa: who is responsible for what",
      lead: "The company, the visa application and the decision each rest with a different party.",
      fiaon: [
        "Filing of the US company with the state, state fee included",
        "Operating agreement and formation documents; EIN and ITIN applications (the ITIN following our ITIN check)",
        "Registered agent, US business address and US telephone number in the first year",
        "The first annual US filing for your company",
        "Account applications and, on request, credit card applications: each prepared in full",
        "Your company’s documents, organised in your portal",
      ],
      partner: [
        weitererSatz("ROLLEN", "en"),
        "Tax questions in your country of residence, including ahead of a planned move: partner tax advisers, acting in their own professional capacity",
        "The visa application and questions of immigration law: partner immigration lawyers, acting in their own professional capacity; you agree the fee for this with the lawyer directly",
      ],
      sie: [
        "The investment from your own documented funds",
        "Business plan and decisions within the business",
        "Submitting the applications to the institutions yourself; each institution makes its own decision on accounts, cards and limits",
        "Form DS-160 and the interview at the consulate; the consulate decides on the visa",
      ],
    },
    {
      typ: "text", id: "fiaon", h2: "What FIAON Global handles",
      absaetze: [
        `${GRUENDUNG.satz} ${UNTERLAGEN.satz}`,
        "The operating agreement sets out ownership and management. The consulate examines both in an E-2 visa application.",
      ],
      punkte: [
        `${TEIL.ihrTeil}: ${GRUENDUNG.ihrTeil} ${UNTERLAGEN.ihrTeil}`,
        "Visa: the application is not part of your engagement. Questions of immigration law rest with partner lawyers acting in their own professional capacity.",
        `${TEIL.bedingung}: ${satz("S3", "en")} The US authority alone decides on the visa.`,
      ],
    },
    { typ: "paket", id: "mandat", h2: P.karteH2, lead: `${P.karteLead} ${weitererSatz("MIAMI", "en")}`, paket: "global_vip" },
    {
      typ: "hinweis", id: "wissen", h2: "What you need to know",
      punkte: [
        "The US authority alone decides on every application: the consulate or, for an application made inside the US, USCIS. The border authority decides on admission at entry. No one can make a binding promise about a visa, its duration or an extension.",
        "The visa application is not part of your engagement. FIAON provides no legal services, including in immigration law. The application and the individual case rest with partner immigration lawyers, who act in their own professional capacity. You agree the fee for this with the lawyer directly.",
        "A US company gives no right to live or work in the US. The ITIN does not permit work either.",
        GLOBAL_PFLICHTHINWEIS.en[0],
        GLOBAL_PFLICHTHINWEIS.en[1],
        `${KEINE_BANK} ${KEINE_KREDITE} ${satz("S9", "en")} ${satz("S1", "en")}`,
        "The regulations are stated as at October 2026. Rules and fees may change. This page explains the fundamentals and does not replace a tax or legal review of your case.",
      ],
    },
  ],
  fragen: [
    { f: "What are the requirements for the E-2 visa?", a: "The US State Department’s manual names nine points (9 FAM 402.9-6). They include nationality of a treaty country, a substantial investment of your own funds at risk and a business that is real, operating and more than marginal. Nationals of the treaty country own at least 50 per cent of the business. You direct the business and declare the intention to leave the US when your status ends. The burden of proof lies with the applicant." },
    { f: "Can German, Austrian and Swiss citizens apply for an E-2 visa?", a: "Yes. Germany, Austria and Switzerland appear in the US State Department’s list of treaty countries, each for E-1 and E-2. Nationality is what counts, not residence. The consulate decides on every application." },
    { f: "How much do I need to invest for an E-2 visa?", a: "There is no fixed minimum amount. The consulate measures the amount invested against the cost of the business: the lower that cost, the higher your share of it must be. Where start-up costs are $100,000 and you finance them entirely yourself, the manual generally treats the investment as substantial." },
    { f: "Is a US LLC enough for the E-2 visa?", a: "An LLC can be the business within the meaning of the rules, but forming it is not enough on its own. In addition, the rules require a committed investment, an active business that is more than marginal, and your control. Owning a company gives no right to live or work in the US." },
    { f: "How long is the E-2 visa valid?", a: "Each admission at entry is for a maximum of two years. Extensions of a maximum of two years each are possible; their number is not limited. How long the visa in your passport is valid depends on the reciprocity schedule for your nationality. The E-2 visa is not a Green Card and does not turn into one of its own accord." },
    { f: "Can my spouse work on an E-2 visa?", a: "Yes. The spouse of an E-2 investor is authorised to work by virtue of their status; the arrival record carries the annotation E-2S. Unmarried children under 21 can receive the same status but may not work." },
    { f: "What does the application at the consulate cost?", a: "The State Department’s fee schedule sets an application fee of $315 for E visas (22 CFR 22.1, as at October 2026). Depending on nationality, an issuance fee based on reciprocity may be added. Further statutory fees are possible. You agree an immigration lawyer’s fee with the lawyer directly." },
    { f: "Does FIAON handle the visa application?", a: "No. The visa application is not part of your engagement. FIAON Global forms the US company and assembles its documents. Questions of immigration law rest with partner lawyers, who act in their own professional capacity. The US authority alone decides on the visa." },
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
