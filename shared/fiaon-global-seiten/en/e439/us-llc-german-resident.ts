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
// E-509 (12.11.2026): EIN Produkt statt vier Pakete — kein Paketname, Preise aus EIN_PRODUKT; die alte Geld-zurück-Zusage je
// Paket entfällt (auf dieser Seite geht es nicht um Kapital).
// E-510 (13.11.2026, language guide FIAON Global): the fixed sentences and steps 1 and 2 come from
// shared/fiaon-global-saetze.ts. GLOBAL_ROLLEN and the list from GLOBAL_JAHRESBETREUUNG are no longer used here
// (“our US CPA”, “appointments on the ground”); the services of annual administration are listed below with the
// role names of the language guide.
// Second pass on the same day (the whole article redrafted, not only the flagged passages): FIAON now appears only in
// the fact box, in the sections “fiaon” and “jahresbetreuung”, in the note and in the last question — tables, cards and
// sequence hold without us. Headings are plain titles, no sideways glance at other accounts, “your tax adviser”
// throughout. Statutory deadlines of third parties stay as figures with their reference; figures, sections and
// sources are unchanged. Written afresh in British English, same structure and statements as the German page.
import { GLOBAL_PFLICHTHINWEIS, GLOBAL_NICHT_INKLUSIVE } from "../../../fiaon-global";
import { SCHRITTE_KOPF, SECHS_SCHRITTE, satz, type Schritt, type SchrittNr } from "../../../fiaon-global-saetze";
import { EIN_PRODUKT } from "../../ein-produkt";
import { QUELLEN_WISSEN_EN as Q, QUELLEN_RECHT_EN as R, QUELLEN_IRS_EN, QUELLEN_STAATEN_EN, IRS_EN, STAAT_EN } from "../../fakten-en";

const S = "2026-10-27";

/** IRS penalty without “per form per year” — for the key figure. */
const STRAFE_5472 = IRS_EN.strafe5472.split(" per ")[0];

const P = EIN_PRODUKT.en;
/** Steps 1 and 2 of the fixed narrative (language guide 2.3) — sentence and “your part” from the one source, never retyped. */
const schritt = (nr: SchrittNr): Schritt => SECHS_SCHRITTE.en.find((x) => x.nr === nr)!;
const GRUENDUNG = schritt(1);
const UNTERLAGEN = schritt(2);
/** The names of the fixed parts of a step: “Your part”, “Condition” (language guide 2.1). */
const TEIL = SCHRITTE_KOPF.en.teile;
/** Responsibility for tax questions — the same wording as on the country pages (en/zielgruppen.ts). */
const STEUERFRAGEN = "Tax questions rest with partner tax advisers acting in their own professional capacity";
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
    beschreibung: "US LLC, German resident: tax office, section 138 AO notification, trade registration, VAT and bookkeeping — each duty with its legal reference.",
  },
  stand: "2026-11-13",
  erschienen: S,
  kennung: "FG · 47",
  auge: "Knowledge · Tax and obligations",
  h1: "US LLC, German resident.",
  h1b: "Register, report, invoice correctly.",
  lead: "If you run a US LLC as a German resident, you have obligations in two countries. In the United States they include Form 5472, the registered agent (the address for service in the state) and the annual report. In Germany they concern the tax office, the notification under section 138 of the German Fiscal Code (AO) and trade registration. They also include VAT on invoices and bookkeeping. This article states each obligation with its legal reference.",
  ziffern: [
    { wert: "14 months", label: "at the latest: notification under section 138 AO, with the tax return" },
    { wert: "1 month", label: "for opening a business and registering for tax" },
    { wert: STRAFE_5472, label: "penalty set by the US tax authority, the IRS, for each missed Form 5472" },
  ],
  blick: [
    ["Tax liability", "At the place of management (section 10 AO), as a rule in Germany"],
    ["Classification", "Type comparison: like a corporation or transparent"],
    ["Notification", "Section 138 AO with the tax return, 14 months at the latest"],
    ["Invoices", "If managed from Germany, as a rule with German VAT"],
    ["USA", "Form 5472 with Form 1120, every year, even without revenue"],
    ["With FIAON Global", "Formation, documents and the EIN and ITIN applications; US deadlines and filings in the first year"],
  ],
  kurz: "If you run a US LLC as a German resident, its place of management is, as a rule, in Germany (section 10 AO). Its profit is then taxed in Germany: depending on the type comparison, at the level of the company or in your hands as a member. As a rule, you report the formation to the tax office under section 138(2) AO with your tax return, no later than 14 months after the end of the year. Invoices to German businesses generally carry German VAT, because the LLC does not count as established abroad (section 13b(7) of the German VAT Act, UStG).",
  bloecke: [
    {
      typ: "text", id: "geschaeftsleitung", h2: "US LLC, German resident: tax liability",
      absaetze: [
        "For a US LLC whose owner is a German resident, German tax law looks to the place from which the LLC is managed. The state in which it is registered does not settle the question. Under section 10 of the German Fiscal Code (AO), the place of management is the centre of top-level business management, that is, the place where the important decisions are taken. If you live only in Germany and decide there on your LLC’s contracts, prices and payments, its place of management is, as a rule, in Germany. An address in Wyoming, Florida or Delaware does not change that.",
        "How the LLC is taxed depends on the type comparison (Typenvergleich). The tax office examines whether, by its legal structure, it is closer to a German corporation (Kapitalgesellschaft) or to a partnership. The criteria are set out in the letter of the German Federal Ministry of Finance of 19 March 2004. The Federal Fiscal Court (BFH) names eight: centralised management and representation, limited liability, free transferability of shares, allocation of profit by a distribution resolution, contribution of capital, unlimited duration, distribution of profit and formal requirements for formation. The overall picture is decisive; the criteria carry different weight (order of 18 May 2021, I B 75/20). Whether the LLC is treated as transparent for tax purposes in the US is irrelevant to the type comparison. The same applies to the number of members.",
        "Two cases follow from this. If the LLC corresponds to a corporation and its place of management is in Germany, it is itself subject to unlimited corporate income tax liability. The liability covers all of its income (section 1(1) and (2) of the German Corporate Income Tax Act, KStG). The competent tax office is the one in whose district the place of management lies (section 20(1) AO). Distributions to you are taxed in your hands. The Federal Fiscal Court had to decide on a Colorado LLC. Its sole member and manager had moved to Germany, which put its place of management in Germany as well. In interim proceedings, the court saw no serious doubt that withholding tax on investment income (Kapitalertragsteuer) had to be declared on a transfer from the company account to him. If, by contrast, the LLC is transparent for tax purposes, its profit is attributed to you directly, whether or not it is distributed.",
        "Which case applies to your LLC depends above all on the operating agreement, the LLC’s governing contract, and on the law of the state. The type comparison should therefore be settled before formation.",
      ],
    },
    {
      typ: "tabelle", id: "pflichten", h2: "Obligations in Germany and the US",
      lead: "Which row applies to you depends on how the LLC is classified and on your activity. The overview assumes a financial year that matches the calendar year.",
      kopf: ["Obligation", "Legal basis", "Deadline", "Who fulfils it"],
      zeilen: [
        ["Give notice of the opening of a business or permanent establishment (trade notification, Gewerbeanzeige)", "Section 138(1) AO, section 14 GewO", "when you start; under the AO within one month", "You, with your tax adviser"],
        ["Information for tax registration, submitted electronically", "Section 138(1b) and (4) AO", "within one month of the event that triggers the duty", "Your tax adviser"],
        ["Notification of a formation or participation abroad", "Section 138(2) and (5) AO", "with the tax return, no later than 14 months after the end of the year", "Your tax adviser, with the LLC’s formation documents"],
        ["VAT: invoices and advance returns", "Sections 13b, 14, 14a, 18 UStG", "ongoing; advance return by the tenth day after the end of the advance return period", "Your bookkeeper and your tax adviser"],
        ["Tax returns in Germany", "Section 1 KStG and section 2 GewStG, or your income tax", "every year", "Your tax adviser"],
        ["Form 5472 with Form 1120 to the IRS", "IRS, Instructions for Form 5472", IRS_EN.frist5472, "a US certified public accountant (CPA)"],
        ["Annual report to the state", "State law", `depending on the state; in Florida ${STAAT_EN.florida.jahrFrist}`, "the company itself or a service provider it instructs"],
        ["Beneficial ownership (BOI) report to FinCEN", "FinCEN, rule of August 2026", "does not apply to companies formed in the US", "nobody"],
      ],
      fuss: ["Which obligations apply in your case is for your tax adviser to clarify."],
    },
    {
      typ: "text", id: "meldung", h2: "Section 138 AO: the 14-month deadline",
      absaetze: [
        "If you live in Germany, you must notify the tax office of certain relationships abroad (section 138(2) AO). Which case covers the US LLC depends on its classification. If it is classified like a corporation, it is a third-country company: a corporate body with its registered office or place of management outside the EU and EFTA (section 138(3) AO). Its registered office in the US is enough for that. The duty to report falls on anyone who, alone or together with related persons, can for the first time exercise a controlling or decisive influence over such a company (no. 4). For a sole member, that is normally the case. If the LLC is classified as transparent, the relevant case may instead be the acquisition of an interest in a foreign partnership (no. 2).",
        "The threshold of ten per cent or €150,000 in acquisition costs (no. 3) covers holdings in companies whose registered office and place of management are both outside Germany. If the LLC is managed from Germany, its place of management is in Germany; the threshold then usually does not apply. Which of these cases applies to you is for your tax adviser to determine; either way, the notification belongs on their list.",
        "You file the notification together with the income tax, corporate income tax or partnership return (Feststellungserklärung) for the year of formation. The latest date is 14 months after the end of that year (section 138(5) AO). If you do not have to file such a return, you report no later than 14 months after the end of the calendar year of formation.",
        "The one-month deadline applies to two other notices: the opening of a business or permanent establishment, and the information for tax registration (section 138(1), (1b) and (4) AO). It does not apply to the notification under subsection 2. Where that notification is intentionally or with gross negligence not submitted, or is submitted incompletely or late, the law provides for an administrative fine of at most €25,000 (section 379(2) and (7) AO).",
      ],
    },
    {
      typ: "text", id: "gewerbe", h2: "Trade registration and permanent establishment",
      absaetze: [
        "Under the second sentence of section 12 AO, the place of management is a permanent establishment. If you manage your LLC from a study in Germany, you therefore maintain, as a rule, a permanent establishment in Germany. A separate office is not required for that.",
        "This raises three questions that should be settled before the business starts. First, the trade notification. Anyone who begins a standing trade (stehendes Gewerbe), a branch or a dependent branch office must notify the competent authority at the same time (section 14(1) of the German Trade Regulation Act, GewO). For tax purposes, the opening of a permanent establishment must be reported to the municipality (section 138(1) AO). Second, trade tax. It covers every standing commercial business for which a permanent establishment is maintained in Germany. The activity of corporations always counts in full as a commercial business (section 2(1) and (2) of the German Trade Tax Act, GewStG). Whether this second rule applies to your LLC depends on its classification. Third, the commercial register. The German branch of a company with its registered office abroad is registered with the court in whose district the branch is located (section 13d(1) of the German Commercial Code, HGB).",
        "Two points depend on the individual case. The first is whether your activity is a trade or a liberal profession, whose commencement is reported only to the tax office. The second is whether the permanent establishment becomes a branch that must be entered in the register. Both questions should be settled before formation.",
      ],
    },
    {
      typ: "text", id: "rechnungen", h2: "Invoices: VAT or reverse charge",
      absaetze: [
        "A service to a business is generally supplied at the place from which the customer runs its business (section 3a(2) of the German VAT Act, UStG). If your LLC supplies a business in Germany, the service is therefore subject to German VAT law. What remains to be determined is who owes the tax.",
        "For services supplied by a business established abroad, the customer owes the tax itself; this procedure is known as reverse charge (section 13b(2) and (5) UStG). The invoice then shows no VAT and carries the note “Steuerschuldnerschaft des Leistungsempfängers” (section 14a(5) UStG). A company is, however, generally established abroad only if it has in Germany neither its registered office, nor its place of management, nor a permanent establishment involved in the service (section 13b(7) UStG). If the LLC is managed from Germany, that is usually not the case. The LLC then owes the VAT itself and shows it on the invoice. It submits each advance return by the tenth day after the end of the advance return period (section 18(1) UStG).",
        "The VAT identification number is issued by the Federal Central Tax Office on application (section 27a(1) UStG). The small-business scheme (Kleinunternehmerregelung) may apply to a business established in Germany. It requires total turnover of no more than €25,000 in the previous year and no more than €100,000 in the current year. The supplies of that business are then exempt from VAT. The business can waive the scheme, but is then bound by the waiver for at least five calendar years (section 19(1) and (3) UStG). For services to private customers, the place of supply is generally the place from which your business is run (section 3a(1) UStG). Special rules apply to many services.",
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
      nach: "If the LLC supplies another business and both are established in Germany, the invoice must generally be issued as an electronic invoice in a structured format (section 14(2) UStG). The place of management is sufficient for a business to be established in Germany. During a transition period, paper or, with the customer’s consent, other electronic formats are permitted (section 27(38) UStG). This applies generally to supplies until the end of 2026, and in 2027 still where total turnover in the previous year was no more than €800,000.",
    },
    {
      typ: "tabelle", id: "umsatzsteuer", h2: "Who owes the VAT",
      lead: "Three cases for a service supplied by the LLC to a business in Germany.",
      kopf: ["Position of the LLC", "Who owes the tax", "What the invoice shows"],
      zeilen: [
        ["In Germany, neither registered office nor place of management nor a permanent establishment involved in the service", "the customer (section 13b(2) and (5) UStG)", "no VAT, but the reverse charge note “Steuerschuldnerschaft des Leistungsempfängers”"],
        ["Managed from Germany", "the LLC itself, because it is not established abroad (section 13b(7) UStG)", "tax rate and amount of tax, tax number or VAT identification number"],
        ["Managed from Germany, turnover within the small-business thresholds", "nobody, as long as the scheme applies (section 19 UStG)", "the note on the tax exemption"],
      ],
      fuss: ["Simplified overview for services. Supplies of goods, services to private customers and services to other EU states follow their own rules. Which case applies to you is for your tax adviser to clarify."],
    },
    {
      typ: "text", id: "buchfuehrung", h2: "Bookkeeping: two countries, the same figures",
      absaetze: [
        "In Germany, commercial businesses must keep books if their total turnover in the calendar year exceeds €800,000 or their profit in the financial year exceeds €80,000 (section 141(1) AO). The duty begins with the financial year that follows the tax office’s notice (section 141(2) AO). Whether your LLC needs a balance sheet even below these thresholds, and how its profit is to be determined, depends on its classification. Books and annual financial statements must be kept for ten years, accounting vouchers for eight years (section 147(3) AO).",
        `In the US, the IRS requires permanent books and records that establish the correctness of the filing. These include the transactions between the LLC and you. Form 5472 lists, among other things, contributions to the company and distributions from it. If Form 5472 is not filed on time or the records are not kept, the IRS can impose a penalty of ${IRS_EN.strafe5472}.`,
        "Two things follow in practice. The LLC keeps an account for business payments only. Its bookkeeping gives your tax adviser in Germany and the US CPA the same figures. What is recorded in Germany as a distribution or withdrawal must match the entries on Form 5472.",
      ],
    },
    {
      typ: "text", id: "dba", h2: "The double taxation agreement: scope and limits",
      absaetze: [
        "Germany and the United States are bound by a double taxation agreement, as amended by the 2006 protocol. It allocates taxing rights; it does not create new ones. As a rule, a company’s business profits may be taxed by the state in which it is resident. The other state may tax them only to the extent that the company carries on business there through a permanent establishment and the profits are attributable to it (Article 7).",
        "For entities that a state treats as transparent for tax purposes, the agreement contains a rule of its own (Article 1(7)). Income derived through them is treated as income of a resident of a state to the extent that this state treats it as such under its tax law. This rule often concerns the LLC. The IRS does not treat a single-member LLC as a taxpayer separate from its owner unless it elects otherwise. In Germany, the type comparison decides. How the agreement applies to your LLC is for your tax adviser and a US CPA to clarify together; the treatment in the two countries has to be consistent.",
        "A company that is managed from Germany generally remains taxable in Germany under the agreement as well. A US LLC is not a tax scheme.",
      ],
    },
    {
      typ: "karten", id: "alltag", h2: "Obligations in day-to-day business", spalten: 3,
      karten: [
        { tag: "Website", titel: "Legal notice (Impressum)", text: "Anyone who offers digital services on a business basis, usually for payment, has information duties (section 5 of the German Digital Services Act, DDG); a website is one example. The name, the legal form and the persons authorised to represent the company must be stated in an easily recognisable way. Added to these are the address at which the business is established, the register with its number, an email address and, where one exists, the VAT identification number. The registered agent’s address is not meant for this." },
        { tag: "Account", titel: "Separate payments", text: "Your customers’ payments go to the LLC’s account, not to your private account. The books in both countries then remain unambiguous, and contributions and withdrawals can be evidenced. Form 5472 asks for these figures." },
        { tag: "Documents", titel: "Documents for your tax adviser", text: "Your tax adviser needs the formation document, the operating agreement and the EIN confirmation for the type comparison and the notification to the tax office. Keep these documents complete and to hand." },
      ],
    },
    {
      typ: "etappen", id: "reihenfolge", h2: "The sequence through to the first invoice",
      etappen: [
        { titel: "Clarification before formation", text: "Before you sign anything, you clarify five points with your tax adviser: place of management, classification under the type comparison, the notification under section 138 AO, trade registration and VAT." },
        { titel: "Operating agreement", text: "The LLC’s governing contract is aligned with the outcome of the type comparison. It helps to determine how the tax office classifies the company." },
        { titel: "Formation and EIN", text: "Filing with the state, designation of the registered agent, application to the IRS for the company’s tax identification number (EIN). Once it is registered and holds its EIN, the company can enter into contracts and apply for an account; the institution concerned decides on the account." },
        { titel: "Registration in Germany", text: "Notice of the permanent establishment, information for tax registration and application for the VAT identification number. Each follows the outcome of the clarification before formation." },
        { titel: "First invoice", text: "The LLC issues it in its own name, with all mandatory details and the correct VAT. The customer pays into the LLC’s account." },
        { titel: "First year-end", text: "In Germany: the tax return with the notification under section 138 AO. In the US: Form 5472 with Form 1120 to the IRS." },
      ],
    },
    {
      typ: "text", id: "fiaon", h2: "What FIAON Global handles",
      absaetze: [
        `${GRUENDUNG.satz} ${UNTERLAGEN.satz}`,
        "Included in the first year: the first annual report to the state and the first annual US filing (Form 5472 with Form 1120).",
      ],
      punkte: [
        `${TEIL.ihrTeil}: ${GRUENDUNG.ihrTeil} ${UNTERLAGEN.ihrTeil}`,
        `German side: ${STEUERFRAGEN}; your tax adviser handles your ongoing tax return, including the notification under section 138 AO.`,
        `${TEIL.bedingung}: ${satz("S3", "en")}`,
      ],
    },
    {
      typ: "text", id: "jahresbetreuung", h2: "From the second year: annual administration",
      absaetze: [`Administration in the first year is included in your engagement. From the second year your company incurs running costs: the state fee, the registered agent and the annual US filing. With annual administration we handle these on request for ${P.jahres} a year, state fee included.`],
      punkte: [
        "Registered agent and US business address",
        "US telephone number",
        "Annual US filing (Form 5472 with Form 1120) by a US certified public accountant (CPA) from our partner network",
        "Annual report to the state, state fee included",
        "Compliance calendar with the US deadlines",
        "Your dedicated contact",
      ],
      nach: "We invoice annual administration yearly in advance; it does not renew automatically. Ongoing bookkeeping and the tax returns in Germany stay with your tax adviser.",
    },
    { typ: "paket", id: "mandat", h2: P.karteH2, lead: P.karteLead, paket: "global_struktur" },
    {
      typ: "hinweis", id: "wissen", h2: "What you need to know",
      punkte: [
        `This article explains the legal basis as at October 2026. It does not replace a tax or legal review of your case. ${STEUERFRAGEN}; your tax adviser handles your ongoing tax return.`,
        GLOBAL_PFLICHTHINWEIS.en[0],
        GLOBAL_PFLICHTHINWEIS.en[1],
        `Not included in your engagement: ${NICHT_IM_PREIS}.`,
        satz("S8", "en"),
        `${satz("S10", "en")} If the LLC is managed from Germany, its profit is, as a rule, taxable in Germany.`,
      ],
    },
  ],
  fragen: [
    { f: "Do I have to register my US LLC with the German tax office?", a: "As a rule, yes, if you manage the LLC from Germany. The place of management is a permanent establishment (section 12 AO). You notify the municipality of its opening; the information for tax registration goes to the tax office electronically. The AO requires each within one month (section 138(1), (1b) and (4) AO). You generally report the formation itself under section 138(2) AO with your tax return." },
    { f: "By when do I have to report the US LLC under section 138 AO?", a: "You report with the income tax, corporate income tax or partnership return for the year of formation, no later than 14 months after the end of that year (section 138(5) AO). The one-month deadline applies only to opening a business and to tax registration. Where the report is missed intentionally or with gross negligence, the law provides for an administrative fine of at most €25,000 (section 379 AO)." },
    { f: "Do I need a trade registration for my US LLC?", a: "That depends on your activity. Anyone who begins a standing trade, a branch or a dependent branch office gives notice at the same time (section 14 GewO). Managing the LLC from Germany generally creates a permanent establishment. Whether your activity is a trade or a liberal profession is for your tax adviser to clarify." },
    { f: "May my US LLC invoice German customers without VAT?", a: "Only if the customer owes the tax (reverse charge) or an exemption applies. Reverse charge requires that the LLC has in Germany neither its registered office, nor its place of management, nor a permanent establishment involved in the service (section 13b(7) UStG). If it is managed from Germany, it generally owes the VAT itself. The position differs where the small-business scheme applies (section 19 UStG)." },
    { f: "Which tax office is responsible for my US LLC?", a: "If the LLC is classified like a corporation, the competent tax office is the one in whose district its place of management lies (section 20(1) AO). If you manage the LLC from home, that is the tax office where you live. If it is classified as transparent, its profit forms part of your own tax return." },
    { f: "Does my US LLC have to keep books in Germany?", a: "Commercial businesses must keep books if turnover exceeds €800,000 in the calendar year or profit exceeds €80,000 in the financial year (section 141 AO). Whether your LLC needs a balance sheet earlier depends on its classification. Books must be kept for ten years, accounting vouchers for eight years (section 147 AO)." },
    { f: "Does the double taxation agreement protect me from German tax?", a: "No. The agreement between Germany and the US allocates taxing rights and prevents the same profit from being taxed twice. If the LLC is managed from Germany, it generally remains taxable in Germany. For entities that are transparent for tax purposes, the agreement contains a rule of its own (Article 1(7))." },
    { f: "What does FIAON Global handle, and what does my tax adviser handle?", a: `We form the LLC, prepare the formation documents including the operating agreement, and apply for the EIN and the ITIN. The registered agent and the first annual US filing are included in the first year. Your tax adviser handles ongoing bookkeeping and tax returns in Germany, including the section 138 AO notification; the documents for this are in your portal once the company is registered. ${satz("S3", "en")}` },
  ],
  paket: "global_struktur",
  weiter: ["/en/business/knowledge/us-llc-tax", "/en/business/from-germany", "/en/business/knowledge/llc-tax-returns", "/en/business/knowledge/us-llc-disadvantages"],
  quellen: [
    QL.ao10, Q.ao138, QL.ao379, QL.ao12, QL.ao20, QL.kstg1, QL.bmf, QL.bfh, QL.gewo14, QL.gewstg2, QL.hgb13d,
    QL.ustg3a, QL.ustg13b, QL.ustg14, QL.ustg14a, QL.ustg18, QL.ustg19, QL.ustg27, QL.ustg27a, QL.ao141, QL.ao147, QL.ddg5,
    Q.dba, QL.dbaIrs, Q.i5472, Q.i1120, QUELLEN_IRS_EN[5], Q.smllc, QUELLEN_STAATEN_EN.florida[1], Q.boiEnde,
  ],
};
