// ═══════════════════════════════════════════════════════════════════════════
// FIAON GLOBAL — KNOWLEDGE: US LLC, GERMAN RESIDENT (27.10.2026, E-439, FG · 47)
//
// Die englische Schwester von ../../e439/us-llc-wohnsitz-deutschland.ts (die
// Pflichten-Seite; „Spart sie Steuern?“ bleibt /en/business/knowledge/us-llc-tax).
// Hauptsuchwort „US LLC German resident“ (Titel, H1, Kurz, erster Absatz, H2).
// Britisches Englisch, dieselben Bausteine in derselben Reihenfolge, dieselben ids
// und dieselbe Zahl an Absätzen, Punkten, Zeilen, Karten, Etappen und Fragen;
// Quellen mit denselben Adressen (englische Titel, fakten-en.ts wo vorhanden).
//
// Inhaltlich identisch mit der deutschen Fach- und Rechtsprüfung vom 27.10.2026:
//   · § 138 AO: Mitteilung nach Abs. 2 mit der Steuererklärung, spätestens 14 Monate
//     nach Ablauf des Jahres (Abs. 5); die Monatsfrist (Abs. 4) gilt nur für Abs. 1,
//     1a, 1b. Abs. 2 Nr. 3 verlangt „Sitz UND Geschäftsleitung außerhalb“ — trifft auf
//     eine von hier geleitete LLC nicht zu. Bußgeld höchstens 25.000 € (§ 379 Abs. 2, 7).
//   · BFH, Beschluss vom 18.05.2021, I B 75/20 (acht Merkmale, Gesamtbild).
//   · DBA Art. 1 Abs. 7 und Art. 7 Abs. 1 an den IRS-Fassungen geprüft.
//   · BOI-Meldung (FinCEN, August 2026: US-Gesellschaften befreit).
// Deutsche Rechtsbegriffe nur als erklärtes Stichwort („type comparison
// (Typenvergleich)“, „section 138 of the German Fiscal Code (AO)“); der Pflichtvermerk
// auf Rechnungen bleibt im deutschen Wortlaut, weil er so auf der Rechnung steht.
//
// Wortwand EN: kein „up to“ („at most“ für die Bußgeldgrenze), keine Frist mit Ziffer
// als Zusage („no later than 14 months“), kein „recommend“, „advice“ nur verneint,
// kein „tax-free/tax saving“, kein Steuermodell. „Business consultancy“ als
// Selbstbezeichnung (E-439). Kein Kapital-Thema → GLOBAL_KAPITAL_FREI wie im Deutschen
// nicht verwendet.
// ═══════════════════════════════════════════════════════════════════════════
import type { GlobalQuelle, GlobalSeite } from "../../typen";
import { GLOBAL_PFLICHTHINWEIS, GLOBAL_ROLLEN, GLOBAL_JAHRESBETREUUNG, GLOBAL_NICHT_INKLUSIVE, GLOBAL_GELD_ZURUECK, globalPaket } from "../../../fiaon-global";
import { QUELLEN_WISSEN_EN as Q, QUELLEN_RECHT_EN as R, QUELLEN_IRS_EN, QUELLEN_STAATEN_EN, IRS_EN, STAAT_EN } from "../../fakten-en";

const S = "2026-10-27";

/** IRS penalty without “per form per year” — for the key figure. */
const STRAFE_5472 = IRS_EN.strafe5472.split(" per ")[0];

const GELD_ZURUECK = GLOBAL_GELD_ZURUECK.aktiv ? [`${GLOBAL_GELD_ZURUECK.en.text} ${GLOBAL_GELD_ZURUECK.en.bedingungen}`] : [];
const STRUKTUR = globalPaket("global_struktur")?.en.name ?? "Global Structure";
const NICHT_IM_PREIS = GLOBAL_NICHT_INKLUSIVE.en[1].charAt(0).toLowerCase() + GLOBAL_NICHT_INKLUSIVE.en[1].slice(1);

/** Quellen dieses Beitrags mit englischen Titeln — dieselben Adressen wie im Deutschen (geprüft am 27.10.2026). */
const QUELLEN: Record<string, GlobalQuelle> = {
  ao10: R.ao10,
  ao12: { titel: "Section 12 German Fiscal Code (AO) — permanent establishment", url: "https://www.gesetze-im-internet.de/ao_1977/__12.html" },
  ao20: { titel: "Section 20 German Fiscal Code (AO) — local jurisdiction for corporations", url: "https://www.gesetze-im-internet.de/ao_1977/__20.html" },
  ao141: { titel: "Section 141 German Fiscal Code (AO) — bookkeeping obligation of certain taxpayers", url: "https://www.gesetze-im-internet.de/ao_1977/__141.html" },
  ao147: { titel: "Section 147 German Fiscal Code (AO) — rules for keeping records", url: "https://www.gesetze-im-internet.de/ao_1977/__147.html" },
  ao379: { titel: "Section 379 German Fiscal Code (AO) — endangering tax revenue", url: "https://www.gesetze-im-internet.de/ao_1977/__379.html" },
  kstg1: R.kstg1,
  gewstg2: { titel: "Section 2 German Trade Tax Act (GewStG) — subject of the tax", url: "https://www.gesetze-im-internet.de/gewstg/__2.html" },
  gewo14: { titel: "Section 14 German Trade Regulation Act (GewO) — duty to notify", url: "https://www.gesetze-im-internet.de/gewo/__14.html" },
  hgb13d: { titel: "Section 13d German Commercial Code (HGB) — branches of companies with their registered office abroad", url: "https://www.gesetze-im-internet.de/hgb/__13d.html" },
  ustg3a: { titel: "Section 3a German VAT Act (UStG) — place of supply of services", url: "https://www.gesetze-im-internet.de/ustg_1980/__3a.html" },
  ustg13b: { titel: "Section 13b German VAT Act (UStG) — recipient of the supply as the person liable for the tax", url: "https://www.gesetze-im-internet.de/ustg_1980/__13b.html" },
  ustg14: { titel: "Section 14 German VAT Act (UStG) — issuing invoices", url: "https://www.gesetze-im-internet.de/ustg_1980/__14.html" },
  ustg14a: { titel: "Section 14a German VAT Act (UStG) — additional invoicing obligations in special cases", url: "https://www.gesetze-im-internet.de/ustg_1980/__14a.html" },
  ustg18: { titel: "Section 18 German VAT Act (UStG) — taxation procedure (advance returns)", url: "https://www.gesetze-im-internet.de/ustg_1980/__18.html" },
  ustg19: { titel: "Section 19 German VAT Act (UStG) — exemption for small businesses", url: "https://www.gesetze-im-internet.de/ustg_1980/__19.html" },
  ustg27: { titel: "Section 27 German VAT Act (UStG) — general transitional provisions (subsection 38: electronic invoices)", url: "https://www.gesetze-im-internet.de/ustg_1980/__27.html" },
  ustg27a: { titel: "Section 27a German VAT Act (UStG) — VAT identification number", url: "https://www.gesetze-im-internet.de/ustg_1980/__27a.html" },
  ddg5: { titel: "Section 5 German Digital Services Act (DDG) — general information obligations", url: "https://www.gesetze-im-internet.de/ddg/__5.html" },
  bmf: R.bmf,
  bfh: { titel: "German Federal Fiscal Court (BFH), order of 18 May 2021, I B 75/20 — classification of a US LLC", url: "https://www.bundesfinanzhof.de/en/entscheidungen/entscheidungen-online/decision-detail/STRE202150148/" },
  dbaIrs: { titel: "IRS — Germany Tax Treaty Documents (1989 convention, protocol of 1 June 2006)", url: "https://www.irs.gov/businesses/international-businesses/germany-tax-treaty-documents" },
};
const QL = QUELLEN;

export const SEITE: GlobalSeite = {
  pfad: "/en/business/knowledge/us-llc-german-resident",
  sprache: "en",
  schwester: "/business/wissen/us-llc-wohnsitz-deutschland",
  art: "wissen",
  seo: {
    titel: "US LLC German resident: the obligations — FIAON Global",
    beschreibung: "US LLC, German resident: tax office, section 138 AO notification, trade registration, VAT on invoices and bookkeeping — with legal references.",
  },
  stand: S,
  erschienen: S,
  kennung: "FG · 47",
  auge: "Knowledge · Tax and obligations",
  h1: "US LLC, German resident.",
  h1b: "Register, report, invoice correctly.",
  lead: "If you run a US LLC as a German resident, you have obligations in two countries. The US side is manageable: Form 5472, a registered agent, the annual report to the state. The German side demands more: tax office, the notification under section 138 of the German Fiscal Code (AO), trade registration, VAT on invoices, bookkeeping. Below is what the law requires, each point with its legal reference — and which part FIAON Global takes on for you with our partner tax adviser, partner lawyer and US CPA.",
  ziffern: [
    { wert: "14 months", label: "at the latest: notification under section 138 AO, with the tax return" },
    { wert: "1 month", label: "for opening a business and registering for tax" },
    { wert: STRAFE_5472, label: "IRS penalty for each missed Form 5472" },
  ],
  blick: [
    ["Tax liability", "Where the LLC is managed (section 10 AO) — usually in Germany"],
    ["Classification", "Type comparison: like a corporation or transparent"],
    ["Notification", "Section 138 AO with the tax return, 14 months at the latest"],
    ["Invoices", "Managed from Germany: as a rule with German VAT"],
    ["USA", "Form 5472 with Form 1120, every year, even without revenue"],
    ["With FIAON Global", "One contact instead of eight; review before formation included in the fixed price"],
  ],
  kurz: "If you run a US LLC as a German resident, its place of management is, as a rule, in Germany (section 10 AO). Tax is then due in Germany: depending on the type comparison, either on the company itself, like a GmbH, or on its profit in your hands as a member. As a rule, you report the formation to the tax office under section 138(2) AO with your tax return, no later than 14 months after the end of the year. And because the LLC is managed from Germany, it does not count as established abroad for VAT purposes (section 13b(7) of the German VAT Act, UStG): invoices to German businesses then generally carry German VAT instead of the reverse charge note.",
  bloecke: [
    {
      typ: "text", id: "geschaeftsleitung", h2: "US LLC, German resident: where tax liability arises",
      absaetze: [
        "For a US LLC whose owner is a German resident, German tax law asks not where the LLC is registered, but where it is managed from. Under section 10 of the German Fiscal Code (AO), the place of management is the centre of top-level business management — the place where the important decisions are taken. If you live only in Germany and take the decisions on your LLC’s contracts, prices and payments there, its place of management will, as a rule, be in Germany. An address in Wyoming, Florida or Delaware does not change that.",
        "How the LLC is then taxed is decided by a type comparison (Typenvergleich): the tax office examines whether, by its legal structure, it is closer to a German corporation (Kapitalgesellschaft) or to a partnership. The German Federal Ministry of Finance set out the criteria in its letter of 19 March 2004. The Federal Fiscal Court (BFH) lists eight: centralised management and representation, limited liability, free transferability of shares, allocation of profit by a distribution resolution, contribution of capital, unlimited duration, distribution of profit and formal requirements for formation. What counts is the overall picture, and the criteria do not carry equal weight (order of 18 May 2021, I B 75/20). Whether the LLC is treated as transparent in the US plays no part in the type comparison, and the number of members is irrelevant too.",
        "Two routes follow from this. If the LLC corresponds to a corporation and its place of management is in Germany, it is itself subject to unlimited corporate income tax liability on all of its income (section 1(1) and (2) of the German Corporate Income Tax Act, KStG); the competent tax office is the one in whose district the place of management lies (section 20(1) AO). What it distributes to you is taxed in your hands. In the Federal Fiscal Court’s case — a Colorado LLC whose sole member and manager had moved to Germany, which put its place of management in Germany as well — the court, in interim proceedings, saw no serious doubt that withholding tax on investment income (Kapitalertragsteuer) had to be declared on a transfer from the company account to him. If, on the other hand, the LLC is transparent for tax purposes, its profit is attributed to you directly, whether it is distributed or not.",
        "Which route applies to your LLC depends above all on the operating agreement and on the law of the state. The type comparison therefore belongs before formation, not in the first tax return.",
      ],
    },
    {
      typ: "tabelle", id: "pflichten", h2: "Obligations in Germany and the US at a glance",
      lead: "Which row applies to you depends on how the LLC is classified and on your activity. The overview assumes that the financial year is the calendar year.",
      kopf: ["Obligation", "Legal basis", "Deadline", "Who handles it"],
      zeilen: [
        ["Give notice of the opening of a business or permanent establishment (trade notification, Gewerbeanzeige)", "Section 138(1) AO, section 14 GewO", "when you start; under the AO within one month", "You, prepared with your tax adviser"],
        ["Information for tax registration, submitted electronically", "Section 138(1b) and (4) AO", "within one month of the event that triggers the duty", "Your tax adviser"],
        ["Notification of a formation or participation abroad", "Section 138(2) and (5) AO", "with the tax return, no later than 14 months after the end of the year", "Your tax adviser, with the documents from your document room"],
        ["VAT: invoices and advance returns", "Sections 13b, 14, 14a, 18 UStG", "ongoing; advance return by the tenth day after the end of the advance return period", "Your bookkeeper and tax adviser"],
        ["Tax returns in Germany", "Section 1 KStG and section 2 GewStG, or your income tax", "every year", "Your tax adviser"],
        ["Form 5472 with Form 1120 to the IRS", "IRS, Instructions for Form 5472", IRS_EN.frist5472, "our US CPA, included in the package for the first year"],
        ["Annual report to the state", "State law", `depending on the state; in Florida ${STAAT_EN.florida.jahrFrist}`, "FIAON, from the second year with the annual care plan"],
        ["Beneficial ownership (BOI) report to FinCEN", "FinCEN, rule of August 2026", "does not apply to companies formed in the US", "nobody"],
      ],
      fuss: ["Ongoing bookkeeping and the tax returns in Germany are not part of the packages. Which obligations apply in an individual case is for the tax adviser to review."],
    },
    {
      typ: "text", id: "meldung", h2: "Section 138 AO: reporting the US LLC — 14 months, not one month",
      absaetze: [
        "If you live in Germany, you must notify the tax office of certain relationships abroad (section 138(2) AO). Which case covers the US LLC depends on its classification. If it is classified like a corporation, it is a third-country company: a corporate body with its registered office or place of management outside the EU and EFTA (section 138(3) AO). Its registered office in the US is enough for that. Anyone who, alone or together with related persons, can for the first time exercise a controlling or decisive influence over such a company must report it (no. 4) — for a sole member, that is normally the case. If the LLC is classified as transparent, the relevant case may instead be the acquisition of an interest in a foreign partnership (no. 2).",
        "A frequently cited rule, by contrast, usually does not apply: the threshold of ten per cent or €150,000 in acquisition costs (no. 3) covers holdings in companies whose registered office and place of management are both outside Germany. If the LLC is managed from Germany, its place of management is in Germany. Which of these cases applies to you is for the tax adviser to determine; either way, the notification belongs on their list.",
        "The notification is filed together with the income tax, corporate income tax or partnership return (Feststellungserklärung) for the year in which the formation took place — no later than 14 months after the end of that year (section 138(5) AO). If you do not have to file such a return, you report no later than 14 months after the end of the calendar year in which the formation took place.",
        "Some accounts give a deadline of one month for this notification. That deadline applies to something else: to the notice that a business or permanent establishment is being opened, and to the information for tax registration (section 138(1), (1b) and (4) AO). Anyone who intentionally or with gross negligence fails to submit the notification under subsection 2, or submits it incompletely or late, risks an administrative fine of at most €25,000 (section 379(2) and (7) AO).",
      ],
    },
    {
      typ: "text", id: "gewerbe", h2: "Trade registration and permanent establishment: a note",
      absaetze: [
        "Under the second sentence of section 12 AO, the place of management is a permanent establishment. If you manage your LLC from a study in Germany, you therefore, as a rule, maintain a permanent establishment in Germany, even without an office with a nameplate on the door.",
        "This raises three questions that should be answered before you start. The first is the trade notification: anyone who begins a standing trade (stehendes Gewerbe), a branch or a dependent branch office must notify the competent authority at the same time (section 14(1) of the German Trade Regulation Act, GewO); for tax purposes, the opening of a permanent establishment must be reported to the municipality (section 138(1) AO). The second is trade tax: it covers every standing commercial business for which a permanent establishment is maintained in Germany; the activity of corporations always counts in full as a commercial business (section 2(1) and (2) of the German Trade Tax Act, GewStG). Whether this second rule applies to your LLC depends, once again, on its classification. The third is the commercial register: if a company with its registered office abroad has a branch in Germany, the branch is registered with the court in whose district it is located (section 13d(1) of the German Commercial Code, HGB).",
        "Whether your activity is a trade or a liberal profession, whose commencement is only reported to the tax office, and whether the permanent establishment becomes a branch that must be entered in the register, depend on the individual case. These questions belong in the review before formation.",
      ],
    },
    {
      typ: "text", id: "rechnungen", h2: "US LLC and invoices: VAT or reverse charge?",
      absaetze: [
        "If your LLC provides a service to a business in Germany, the service is generally supplied at the place from which the customer runs its business (section 3a(2) of the German VAT Act, UStG). The service therefore falls under German VAT law. The only open question is who owes the tax.",
        "For services supplied by a business established abroad, the customer owes the tax itself (section 13b(2) and (5) UStG). The invoice then shows no VAT and carries the reverse charge note “Steuerschuldnerschaft des Leistungsempfängers” (section 14a(5) UStG). A company is, however, generally only established abroad if it has neither its registered office nor its place of management nor a permanent establishment involved in the service in Germany (section 13b(7) UStG). If the LLC is managed from Germany, that is usually not the case: the LLC then owes the VAT itself, shows it on the invoice and submits advance returns, each by the tenth day after the end of the advance return period (section 18(1) UStG).",
        "The VAT identification number is issued by the Federal Central Tax Office on application (section 27a(1) UStG). If total turnover was no more than €25,000 in the previous year and is no more than €100,000 in the current year, the small-business scheme (Kleinunternehmerregelung) may apply to a business established in Germany; its supplies are then exempt from VAT. The business can waive the scheme, but is then bound by the waiver for at least five calendar years (section 19(1) and (3) UStG). For services to private customers, the place of supply is generally the place from which your business is run (section 3a(1) UStG); special rules apply to many services.",
        "Every invoice needs the mandatory details under section 14(4) UStG, including:",
      ],
      punkte: [
        "the full name and full address of the LLC and of the customer",
        "the LLC’s tax number or VAT identification number",
        "the date of issue and a sequential invoice number that is assigned only once",
        "the type and extent of the service and the time at which it was provided",
        "the consideration, the tax rate and the amount of tax — or, in the case of an exemption, a note to that effect",
        "for reverse charge, instead of the tax, the note “Steuerschuldnerschaft des Leistungsempfängers” (section 14a(5) UStG)",
      ],
      nach: "If the LLC supplies another business and both are established in Germany — which includes the place of management — the invoice must generally be issued as an electronic invoice in a structured format (section 14(2) UStG). During a transition period, paper or, with the customer’s consent, other electronic formats are permitted: generally for supplies until the end of 2026, and in 2027 still where total turnover in the previous year was no more than €800,000 (section 27(38) UStG).",
    },
    {
      typ: "tabelle", id: "umsatzsteuer", h2: "Who owes the VAT on the invoice",
      lead: "A service by the LLC to a business in Germany — three typical situations.",
      kopf: ["Position of the LLC", "Who owes the tax?", "What the invoice shows"],
      zeilen: [
        ["In Germany, neither registered office nor place of management nor a permanent establishment involved in the service", "the customer (section 13b(2) and (5) UStG)", "no VAT, but the reverse charge note “Steuerschuldnerschaft des Leistungsempfängers”"],
        ["Managed from Germany", "the LLC itself, because it is not established abroad (section 13b(7) UStG)", "tax rate and amount of tax, tax number or VAT identification number"],
        ["Managed from Germany, turnover within the small-business thresholds", "nobody, as long as the scheme applies (section 19 UStG)", "the note on the tax exemption"],
      ],
      fuss: ["Simplified overview for services. Supplies of goods, services to private customers and services to other EU states follow their own rules; which situation applies to you is for the tax adviser to review in the individual case."],
    },
    {
      typ: "text", id: "buchfuehrung", h2: "Bookkeeping: two countries, the same figures",
      absaetze: [
        "In Germany, commercial businesses must keep books if their total turnover in the calendar year exceeds €800,000 or their profit in the financial year exceeds €80,000 (section 141(1) AO); the duty begins with the financial year that follows the tax office’s notice (section 141(2) AO). Whether your LLC needs a balance sheet even below these thresholds, and how its profit is to be determined, depends on its classification. Books and annual financial statements must be kept for ten years, accounting vouchers for eight years (section 147(3) AO).",
        `In the US, the IRS requires permanent books and records that establish the correctness of the filing, including the transactions between the LLC and you. Form 5472 shows, among other things, contributions to the company and distributions from it. Anyone who does not file Form 5472 on time or does not keep the records risks a penalty of ${IRS_EN.strafe5472}.`,
        "In practice this means an LLC account that is used only for business, and bookkeeping from which your tax adviser in Germany and the US CPA work with the same figures. What is booked in Germany as a distribution or withdrawal must match what appears on Form 5472.",
      ],
    },
    {
      typ: "text", id: "dba", h2: "The double taxation agreement: what it governs — and what it does not",
      absaetze: [
        "Germany and the United States are bound by a double taxation agreement, as amended by the 2006 protocol. It allocates taxing rights; it does not create new ones. As a rule, a company’s business profits may be taxed by the state in which it is resident; the other state may tax them only if the company carries on business there through a permanent establishment and the profits are attributable to it (Article 7).",
        "For entities that a state treats as transparent for tax purposes, the agreement contains a rule of its own: income derived through them is treated as income of a resident of a state to the extent that this state treats it as such under its tax law (Article 1(7)). That often affects the LLC: the IRS does not treat a single-member LLC as a taxpayer separate from its owner unless it elects otherwise — in Germany, the type comparison decides. How the agreement applies to your LLC is examined jointly by the tax adviser and the US CPA; both sides have to fit together.",
        "What the agreement does not do: it does not turn a company managed from Germany into a company that is taxable only in the US. A US LLC is not a tax model.",
      ],
    },
    {
      typ: "karten", id: "alltag", h2: "What day-to-day business involves", spalten: 3,
      karten: [
        { tag: "Website", titel: "Legal notice (Impressum)", text: "Anyone who offers digital services on a business basis, usually for payment — a website, for instance — must state in an easily recognisable way the name and the address at which they are established, the legal form, the persons authorised to represent the company, the register with its number, an email address and, where one exists, the VAT identification number (section 5 of the German Digital Services Act, DDG). The registered agent’s address is not meant for this." },
        { tag: "Account", titel: "Separate payments", text: "Your customers’ payments go to the LLC’s account, not to your private account. That keeps the books clean in both countries and makes contributions and withdrawals traceable — exactly the figures that Form 5472 asks for." },
        { tag: "Documents", titel: "To hand for your tax adviser", text: "Your tax adviser needs the formation document, the operating agreement and the EIN confirmation for the type comparison and the notification. With FIAON Global, they are in your document room from the very start." },
      ],
    },
    {
      typ: "etappen", id: "reihenfolge", h2: "In this order: from the idea to the first invoice",
      etappen: [
        { titel: "Review before formation", text: "Place of management, classification under the type comparison, the notification under section 138 AO, trade registration and VAT are clarified before anything is signed." },
        { titel: "Operating agreement", text: "The LLC’s agreement is aligned with the outcome of the type comparison. With FIAON Global, our partner lawyer drafts it." },
        { titel: "Formation and EIN", text: "Filing with the state, registered agent, EIN from the IRS. After that, the company can enter into contracts and apply for an account." },
        { titel: "Registration in Germany", text: "Notice of the permanent establishment, information for tax registration, application for the VAT identification number — each as the review has determined." },
        { titel: "First invoice", text: "With all mandatory details and the correct VAT, issued in the LLC’s name and paid into its account." },
        { titel: "First year-end", text: "Tax return in Germany with the notification under section 138 AO; Form 5472 with Form 1120 to the IRS." },
      ],
    },
    {
      typ: "text", id: "fiaon", h2: "How FIAON Global takes on the obligations on both sides",
      absaetze: [
        "FIAON Global is a business consultancy for the route to the United States, built on one principle: one contact instead of eight. With your power of attorney, we make the applications for you — formation, the EIN, preparation of the ITIN, the D-U-N-S Number, filings, the registered agent, and a US address and US phone number for the first year. You make only the account, card and credit applications yourself; we prepare them in full. FIAON is not a bank and neither grants nor arranges loans; the institution alone decides on the account, card, credit limit and loan.",
        `On the German side: before formation, our partner tax adviser reviews your case — place of management, classification under the type comparison, the notification under section 138 AO. Based on that result, our partner lawyer drafts the operating agreement. Our US CPA handles the first US filing, Form 5472 with Form 1120. ${GLOBAL_ROLLEN.en.partner}`,
        "So your tax adviser does not start from scratch: the result of the review, the formation document, the operating agreement and the EIN confirmation are already filed in order in your document room when the first return with the section 138 AO notification is due. Our team on the ground in Miami handles appointments in the US, Zurich is our partner location, and your contracting party is FIAON LTD in London. You pay a fixed price, with all package fees included.",
        ...GELD_ZURUECK,
      ],
    },
    {
      typ: "text", id: "jahresbetreuung", h2: "From the second year: the annual care plan",
      absaetze: [GLOBAL_JAHRESBETREUUNG.en.lead],
      punkte: [...GLOBAL_JAHRESBETREUUNG.en.leistungen],
      nach: `${GLOBAL_JAHRESBETREUUNG.en.bedingungen} Ongoing bookkeeping and the tax returns in Germany stay with your tax adviser.`,
    },
    { typ: "paket", id: "paket", h2: "A clean start, with both sides in view", lead: `Formation, EIN, registered agent, an operating agreement by our partner lawyer, the review before formation by our partner tax adviser and the first US filing — ${STRUKTUR}.`, paket: "global_struktur" },
    {
      typ: "hinweis", id: "wissen", h2: "What you need to know",
      punkte: [
        "This article explains the legal basis as at October 2026. It does not replace a review of your case; that is carried out by the tax adviser under your engagement.",
        GLOBAL_PFLICHTHINWEIS.en[0],
        GLOBAL_PFLICHTHINWEIS.en[1],
        `Not included in the fixed price: ${NICHT_IM_PREIS}.`,
        GLOBAL_ROLLEN.en.fiaon,
        "A US LLC is not a tax model: if you manage it from Germany, it is, as a rule, taxed in Germany.",
      ],
    },
  ],
  fragen: [
    { f: "Do I have to register my US LLC with the German tax office?", a: "If you manage it from Germany, as a rule yes. The place of management is a permanent establishment (section 12 AO); you notify the municipality of its opening, and the information for tax registration goes to the tax office electronically — under the AO, each within one month (section 138(1), (1b) and (4) AO). Separately, you generally report the formation under section 138(2) AO with your tax return." },
    { f: "By when do I have to report the US LLC under section 138 AO?", a: "With the income tax, corporate income tax or partnership return for the year of formation, no later than 14 months after the end of that year (section 138(5) AO). The one-month deadline that is often quoted applies only to opening a business and to tax registration. Failing to report intentionally or with gross negligence can lead to an administrative fine of at most €25,000 (section 379 AO)." },
    { f: "Do I need a trade registration for my US LLC?", a: "That depends on the activity. Anyone who begins a standing trade, a branch or a dependent branch office gives notice at the same time (section 14 GewO), and managing the LLC from Germany generally creates a permanent establishment. Whether your activity is a trade or a liberal profession is for the tax adviser to clarify in the individual case." },
    { f: "May my US LLC invoice German customers without VAT?", a: "Only if the customer owes the tax (reverse charge) or an exemption applies. Reverse charge requires that the LLC has neither its registered office nor its place of management nor a permanent establishment involved in the service in Germany (section 13b(7) UStG). If it is managed from Germany, it generally owes the VAT itself — unless the small-business scheme applies (section 19 UStG)." },
    { f: "Which tax office is responsible for my US LLC?", a: "If the LLC is classified like a corporation, the tax office in whose district its place of management is located (section 20(1) AO) — so if you manage it from home, the tax office where you live. If it is classified as transparent, its profit goes into your own tax return." },
    { f: "Does my US LLC have to keep books in Germany?", a: "Commercial businesses must keep books if turnover exceeds €800,000 in the calendar year or profit exceeds €80,000 in the financial year (section 141 AO). Whether your LLC needs a balance sheet earlier depends on its classification. Books must be kept for ten years, accounting vouchers for eight years (section 147 AO)." },
    { f: "Does the double taxation agreement protect me from German tax?", a: "No. The agreement between Germany and the US allocates taxing rights and prevents the same profit from being taxed twice. If the LLC is managed from Germany, it generally remains taxable in Germany. For entities that are transparent for tax purposes, it contains a rule of its own (Article 1(7))." },
    { f: "What does FIAON Global handle, and what does my tax adviser handle?", a: "We take on the US side and the coordination: formation, the EIN, the registered agent, the operating agreement by our partner lawyer, the first Form 5472 by our US CPA and the review before formation by our partner tax adviser. Ongoing bookkeeping and tax returns in Germany, including the section 138 AO notification, are handled by your tax adviser — with the documents from your document room." },
  ],
  paket: "global_struktur",
  weiter: ["/en/business/knowledge/us-llc-tax", "/en/business/from-germany", "/en/business/knowledge/llc-tax-returns", "/en/business/knowledge/us-llc-disadvantages"],
  quellen: [
    QL.ao10, Q.ao138, QL.ao379, QL.ao12, QL.ao20, QL.kstg1, QL.bmf, QL.bfh, QL.gewo14, QL.gewstg2, QL.hgb13d,
    QL.ustg3a, QL.ustg13b, QL.ustg14, QL.ustg14a, QL.ustg18, QL.ustg19, QL.ustg27, QL.ustg27a, QL.ao141, QL.ao147, QL.ddg5,
    Q.dba, QL.dbaIrs, Q.i5472, Q.i1120, QUELLEN_IRS_EN[5], Q.smllc, QUELLEN_STAATEN_EN.florida[1], Q.boiEnde,
  ],
};
