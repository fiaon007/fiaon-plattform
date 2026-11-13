// ═══════════════════════════════════════════════════════════════════════════
// FIAON GLOBAL — KNOWLEDGE: US LLC DISADVANTAGES FOR NON-RESIDENTS (27.10.2026, E-439, FG · 52)
//
// Die englische Schwester von ../../e439/nachteile-us-llc.ts — die Gegenrede
// zu Darstellungen, die nur Vorteile nennen. Abgrenzung wie im Deutschen:
// /en/business/knowledge/us-llc-tax bleibt die Frage „Does it save tax?“ (nein),
// /en/business/knowledge/us-llc-german-resident die Pflichten im Einzelnen — hier steht
// die Abwägung: Nachteile, Strafen, wann die LLC nicht passt, wann sie sinnvoll ist.
// Hauptsuchwort EN „US LLC disadvantages for non-residents“ (Titel, H1, Lead, Kurz,
// erste H2); Recherche .arbeit/recherche/kritik.md Zeile 8 und kw_de.md T15.
//
// Britisches Englisch, inhaltlich identisch: dieselben Bausteine in derselben
// Reihenfolge, dieselben ids, gleich viele Absätze, Punkte, Zeilen, Karten, Fragen,
// Blick-Zeilen und Kennziffern; Quellen mit denselben Adressen in derselben
// Reihenfolge (englische Titel). Zahlen aus fakten-en.ts, wo die deutsche Fassung
// fakten.ts liest; die übrigen Zahlen wie in der deutschen Fachprüfung vom 27.10.2026:
// § 138 Abs. 2 und 5 AO (10 %, 150.000 €, 14 Monate), § 379 Abs. 2 und 7 AO
// (höchstens 25.000 €), Form 5472 (nach 90 Tagen ab Mitteilung je angefangene 30 Tage
// weitere 25.000 $), SBA Procedural Notice 5000-876626 (seit 01.03.2026), Florida
// § 605.0714 (dritter/vierter Freitag im September, sechzig Tage), EO 14406 Sec. 3(a)(vi).
// Gleichlauf- und Sprachprüfung 27.10.2026: Bausteine, ids, Anzahlen, Quellen-URLs und
// Zahlen gegen die deutsche Fassung abgeglichen; Germanismen geglättet („On top come“,
// „What speaks for“, „tax firm“), § 42 AO ohne „tax advantage“ („more favourable tax outcome“).
//
// Wortwand EN: kein „up to“, kein Bankname, keine Frist mit Ziffer als Zusage, kein
// Zinssatz, kein „recommend“, „advice“ nur verneint, „personal guarantee“ als
// Fachbegriff, Firmenkarte = „business credit card“, „tax-free“ nur in Anführungszeichen
// (Mythos), kein „tax advantage“ (§ 42 AO als „advantage in tax“). Über Konto, Karte,
// Rahmen und Darlehen entscheidet das Institut; FIAON vermittelt keine Kredite.
// Paketpreise nur über den Baustein „paket“. „Business consultancy“ als
// Selbstbezeichnung erlaubt seit E-439 (Justin, 27.10.2026).
// ═══════════════════════════════════════════════════════════════════════════
import type { GlobalQuelle, GlobalSeite } from "../../typen";
// E-509 (12.11.2026): EIN Produkt statt vier Pakete — kein Paketname.
// E-510 (13.11.2026, language guide FIAON Global): ONE section about us (“What FIAON Global handles”, 120 words at most:
// what we do · your part · condition), built like the German page. Fixed sentences (S2, S3, S8, S10, “your part” of steps 1
// and 2) come from shared/fiaon-global-saetze.ts. No longer here: the refund sentence (it applies to financing only), the
// fee lines (they are on the card “One engagement”), a “review before formation” as an included service, a “team on the
// ground”, a partner location, a partner shown at work in the present tense. The factual part is unchanged.
// Second pass on the same day: every visible text rewritten (statement · condition · decision-maker, short active
// sentences, one word per thing, each technical term explained once). Headings are plain titles without their own
// numbering — the template counts in Roman numerals. The factual part no longer names FIAON: the at-a-glance row
// “With FIAON Global” is now “Makes sense”, and the answer to “Is a US LLC worth it?” points to the reader’s own tax
// adviser. The sentence on who decides appears once per section.
import { GLOBAL_PFLICHTHINWEIS, GLOBAL_KAPITAL_FREI, GLOBAL_NICHT_INKLUSIVE } from "../../../fiaon-global";
import { SCHRITTE_KOPF, SECHS_SCHRITTE, satz } from "../../../fiaon-global-saetze";
import { EIN_PRODUKT } from "../../ein-produkt";
import {
  QUELLEN_WISSEN_EN as Q, QUELLEN_RECHT_EN as R, QUELLEN_STAATEN_EN, STAAT_EN, IRS_EN, MARKT_EN, SCHWELLEN_EN, FRISTEN_EN, FAKTEN_STAND_EN,
} from "../../fakten-en";

const S = "2026-10-27";

/** „US$25,000“ aus „US$25,000 per form per year“ — für Kennziffer und Blick; die Zahl bleibt in fakten-en.ts. */
const STRAFE_5472 = IRS_EN.strafe5472.split(" per ")[0];

/** Im Fließtext „per cent“ statt „%“ (britischer Satz), die Zahl selbst bleibt aus fakten-en.ts. */
const prozent = (x: string) => x.replace(/(\d)%/g, "$1 per cent");

const P = EIN_PRODUKT.en;
/** “Your part” and “Condition”, and steps 1 and 2 of the fixed narrative (language guide 2.1, 2.3). */
const TEIL = SCHRITTE_KOPF.en.teile;
const GRUENDUNG = SECHS_SCHRITTE.en.find((x) => x.nr === 1)!;
const UNTERLAGEN = SECHS_SCHRITTE.en.find((x) => x.nr === 2)!;
/** The first annual US filing — wording of the agreement (clause 2), role as in guard rail 5. */
const US_MELDUNG = "the first annual US filing by a US certified public accountant (CPA) from our partner network";
/** From the second year (language guide 5.6) — without an amount; that is on the card “One engagement”. */
const JAHRESBETREUUNG = "From the second year you may continue with annual administration; it does not renew automatically.";

/** Who deals with tax questions — the same wording as on the country pages (en/zielgruppen.ts). */
const STEUERFRAGEN = "Tax questions rest with partner tax advisers acting in their own professional capacity";
/** The capital is not tied to the US (Justin, 19.09.2026) — the sentence from the one source, plus who deals with tax questions. */
// Both sentences belong together (checked by scripts/pruef-global-en.ts): one source, word for word as in the agreement.
const KAPITAL_FREI = `${GLOBAL_KAPITAL_FREI.en.satz} ${GLOBAL_KAPITAL_FREI.en.steuer}`;


const NICHT_INKLUSIVE = GLOBAL_NICHT_INKLUSIVE.en[1].charAt(0).toLowerCase() + GLOBAL_NICHT_INKLUSIVE.en[1].slice(1);

/** Our own drawback first (language guide 3.1, rule 10) — the same sentence as on the costs page. */
const EHRLICH = "If you need only a company and coordinate everything yourself, you pay less than with us.";

/** Quellen dieses Beitrags — dieselben Adressen wie in der deutschen Fassung, englische Titel. */
const QUELLEN: Record<string, GlobalQuelle> = {
  ao10: R.ao10,
  ao42: { titel: "Section 42 German Fiscal Code (AO) — abuse of legal arrangements", url: "https://www.gesetze-im-internet.de/ao_1977/__42.html" },
  ao379: { titel: "Section 379 German Fiscal Code (AO) — endangering tax revenue", url: "https://www.gesetze-im-internet.de/ao_1977/__379.html" },
  kstg1: R.kstg1,
  ustg13b: { titel: "Section 13b German VAT Act (UStG) — recipient of the supply as the person liable for tax", url: "https://www.gesetze-im-internet.de/ustg_1980/__13b.html" },
  bmf: R.bmf,
  bfh: { titel: "German Federal Fiscal Court (BFH), order of 18 May 2021, I B 75/20 — classification of a US LLC", url: "https://www.bundesfinanzhof.de/en/entscheidungen/entscheidungen-online/decision-detail/STRE202150148/" },
  kstg1at: { titel: "Section 1 Austrian Corporate Income Tax Act 1988 (KStG 1988) — unlimited and limited tax liability (RIS)", url: "https://www.ris.bka.gv.at/NormDokument.wxe?Abfrage=Bundesnormen&Gesetzesnummer=10004569&Paragraf=1" },
  bao27: { titel: "Section 27 Austrian Federal Fiscal Code (BAO) — registered office and place of management (RIS)", url: "https://www.ris.bka.gv.at/NormDokument.wxe?Abfrage=Bundesnormen&Gesetzesnummer=10003940&Paragraf=27" },
  bao120: { titel: "Section 120 Austrian Federal Fiscal Code (BAO) — duties of notification (RIS)", url: "https://www.ris.bka.gv.at/NormDokument.wxe?Abfrage=Bundesnormen&Gesetzesnummer=10003940&Paragraf=120" },
  bao121: { titel: "Section 121 Austrian Federal Fiscal Code (BAO) — deadline for notifications (RIS)", url: "https://www.ris.bka.gv.at/NormDokument.wxe?Abfrage=Bundesnormen&Gesetzesnummer=10003940&Paragraf=121" },
  eas1413: { titel: "Austrian Federal Ministry of Finance, EAS 1413 of 4 February 1999 — tax treatment of a US limited liability company (Findok)", url: "https://findok.bmf.gv.at/findok/resources/pdf/1691f422-2c75-4ed3-9271-ed18e5cce2b7/30137.1.1.0.pdf" },
  dbg50: R.dbg50,
  usc1361: { titel: "26 U.S. Code § 1361 — S corporation defined", url: "https://www.law.cornell.edu/uscode/text/26/1361" },
  irsFbar: { titel: "IRS — Report of Foreign Bank and Financial Accounts (FBAR)", url: "https://www.irs.gov/businesses/small-businesses-self-employed/report-of-foreign-bank-and-financial-accounts-fbar" },
  eo14406: { titel: "The White House — Executive Order 14406, Restoring Integrity to America’s Financial System (19 May 2026)", url: "https://www.whitehouse.gov/presidential-actions/2026/05/restoring-integrity-to-americas-financial-system/" },
  fl605715: { titel: "Florida Statutes 2026, § 605.0715 — reinstatement following administrative dissolution", url: "https://www.flsenate.gov/Laws/Statutes/2026/605.0715" },
  e2: { titel: "USCIS — E-2 Treaty Investors", url: "https://www.uscis.gov/working-in-the-united-states/temporary-workers/e-2-treaty-investors" },
  fl605304: { titel: "Florida Statutes 2026, § 605.0304 — liability of members and managers", url: "https://www.flsenate.gov/Laws/Statutes/2026/605.0304" },
  sba: { titel: "SBA Procedural Notice 5000-876626 — Revised Applicant Ownership, Citizenship, and Residency Requirements for 7(a) and 504 Loans (effective 1 March 2026)", url: "https://legacy.sba.gov/sites/default/files/2026-02/Procedural%20Notice%205000-876626%20-%20Revised%20Applicant%20Ownership%20Citizenship%20and%20Residency%20%20OFA%202.11.pdf" },
};
const QL = QUELLEN;

export const SEITE: GlobalSeite = {
  pfad: "/en/business/knowledge/us-llc-disadvantages",
  sprache: "en",
  schwester: "/business/wissen/nachteile-us-llc",
  art: "wissen",
  seo: {
    titel: "US LLC disadvantages for non-residents — FIAON Global",
    beschreibung: "US LLC disadvantages for non-residents: tax in your home country, filings in two countries, annual costs. Plus penalties — and when an LLC makes sense.",
  },
  stand: "2026-11-13",
  erschienen: S,
  kennung: "FG · 52",
  auge: "Knowledge · Before formation",
  h1: "US LLC disadvantages for non-residents.",
  h1b: "Stated plainly, with sources.",
  lead: "The US LLC disadvantages for non-residents should be clear before you form the company. This page sets out six and gives the source for each. Tax liability stays in your country of residence, filings fall due in two countries, and costs arise every year. Added to these are two tax classifications, access to accounts and cards without a US history, and penalties for non-compliance. The page closes with the cases in which an LLC does not fit and the cases in which it makes sense.",
  ziffern: [
    { wert: STRAFE_5472, label: "IRS penalty for each missed Form 5472" },
    { wert: "14 months", label: "Notification under section 138 AO: with the tax return, by this deadline at the latest" },
    { wert: "§ 10 AO", label: "German Fiscal Code: the place of management determines tax liability" },
  ],
  blick: [
    ["Tax liability", "Arises where the LLC is managed: generally in your country of residence"],
    ["Filings", "Form 5472 to the IRS; section 138 AO notification to the tax office"],
    ["Running costs", "State fee, registered agent and US certified public accountant (CPA), every year"],
    ["Penalties", `${STRAFE_5472} per missed Form 5472`],
    ["Accounts and cards", "No credit score at first without a US history; each institution decides"],
    ["Not a fit", "Without business in the US, or for tax reasons alone"],
    ["Makes sense", "For business in the US: customers, platforms, market entry"],
  ],
  kurz: `The US LLC disadvantages for non-residents in brief: if you run the company from Germany, Austria or Switzerland, it generally remains taxable there (section 10 of the German Fiscal Code, AO; section 1(2) of the Austrian KStG 1988; Art. 50 of the Swiss DBG). Filings are required in two countries: in Germany the notification under section 138 AO, in the US Form 5472 to the US tax authority, the IRS. If the form is missing, the IRS can impose a penalty of ${IRS_EN.strafe5472}. Costs arise every year. An LLC makes sense for business in the US, not as a tax scheme.`,
  bloecke: [
    {
      typ: "text", id: "steuerpflicht", h2: "US LLC disadvantages for non-residents: tax liability",
      absaetze: [
        "The US LLC is widely described as a “tax-free” company. Part of that is true: the IRS generally does not treat an LLC with only one foreign member as a separate taxpayer. Without a business in the US, there is often no federal tax to pay there. That says nothing about tax in your country of residence.",
        "Germany looks to the place of management, the centre of the company’s top-level commercial direction (section 10 AO). If you take your LLC’s important decisions in Germany, its place of management is in Germany. If the tax office classifies the LLC as comparable to a corporation, it is subject to unlimited corporate income tax in Germany on all of its income (section 1 of the German Corporate Income Tax Act, KStG). If it classifies the LLC as transparent for tax purposes, it attributes the profit to you directly. Austria likewise looks to the place of management or registered office in Austria (section 1(2) KStG 1988 together with section 27 of the Austrian Federal Fiscal Code, BAO). Switzerland looks to the registered office or effective management (Art. 50 of the Swiss Federal Direct Tax Act, DBG).",
        "The double taxation agreement between Germany and the United States does not change this in principle. It allocates taxing rights and prevents the same profit from being taxed twice. It does not make a company managed from Germany taxable in the US alone. Section 42 AO applies as well: tax law cannot be circumvented by abusing legal arrangements. Where an inappropriate arrangement leads to a more favourable tax outcome than the law provides for, the tax arises as it would under an appropriate arrangement. This does not apply if the taxpayer shows non-tax reasons; they must be significant in view of the overall circumstances.",
        "VAT also follows the place of management. A business with its registered office, place of management or a permanent establishment in Germany is not treated as established abroad for VAT purposes (section 13b(7) of the German VAT Act, UStG). That includes an LLC managed from Germany. Its invoices to German businesses then generally carry German VAT instead of a note that the recipient owes the tax (reverse charge).",
      ],
    },
    {
      typ: "tabelle", id: "ueberblick", h2: "Advantages and disadvantages of a US LLC",
      lead: "Eight topics, each with its advantage and its disadvantage — from the perspective of a business owner resident in Germany, Austria or Switzerland.",
      kopf: ["Topic", "Advantage", "Disadvantage"],
      zeilen: [
        ["Formation", `Filing fee ${STAAT_EN.wyoming.gruendung} in Wyoming, ${STAAT_EN.florida.gruendung} in Florida`, "Formation is the smallest item; the duties fall due every year"],
        ["Tax", "Often no federal tax in the US, as long as there is no business there", "Managed from your country of residence, generally taxable there (section 10 AO)"],
        ["Filings", "No beneficial ownership information (BOI) report any longer for companies formed in the US (FinCEN, August 2026)", "Form 5472 to the IRS as soon as money moves between you and the LLC, even without revenue; plus the notification under section 138 AO to the tax office"],
        ["Classification", "Elective in the US: transparent for tax purposes or taxed as a corporation", "The IRS and the tax office classify independently of each other; the results can differ"],
        ["Liability", "As a rule, the company is liable for its debts, not the member (in Florida, § 605.0304)", "For business credit cards, issuers generally require your personal guarantee"],
        ["Accounts and cards", "A US account can make it easier to receive payments from US customers in US dollars", "Without a US credit history, no score at first; the government-backed SBA loan programmes are not open; each institution decides for itself"],
        ["Costs", "Manageable state fees, set officially (amounts in the table below)", "Every year: state fee, registered agent and US certified public accountant (CPA); plus your tax adviser in your country of residence"],
        ["Residence", "Can form part of an application for an investor visa if there is a real business with a substantial investment; a US immigration lawyer assesses this", "The company alone confers no right to live or work in the US"],
      ],
      fuss: ["Simplified overview, as at October 2026. Whether a point is an advantage or a disadvantage for you depends on your business. Your tax adviser assesses the tax position case by case."],
    },
    {
      typ: "text", id: "meldepflichten", h2: "Filing duties in two countries",
      absaetze: [
        `In the US, a single-member LLC with a foreign owner is treated as a corporation for the reporting requirements under section 6038A. It files Form 5472, attached to a simplified (pro forma) Form 1120. The duty applies to every year with a reportable transaction between the LLC and you. That already includes payments at formation, contributions to the company and distributions from it. The duty does not require revenue or an account. For a calendar-year company, the deadline is ${IRS_EN.frist5472}. The LLC also keeps books that support these figures.`,
        "In Germany, you notify the tax office of your interest in the LLC (section 138(2) AO). Depending on its classification, this is an interest in a foreign partnership or in a foreign corporation. For a corporation, the duty applies from a holding of ten per cent or acquisition costs of more than €150,000. It also applies where you first gain a controlling influence over a company outside the EU and EFTA. You submit the notification with the tax return for the year of formation, no later than fourteen months after the end of that year (section 138(5) AO). If you manage the LLC from Germany, a notification under section 138(1) AO may also be required. The notice that a commercial business or a permanent establishment has opened goes to the municipality, which informs the tax office. In Austria, you notify the tax office within one month of any circumstances that give rise to or change a tax liability (sections 120 and 121 BAO).",
        `If the LLC holds accounts outside the US, such as a euro account in Europe, a third filing may be required. This is the FBAR, the report of foreign bank and financial accounts. A limited liability company formed in the US also counts as a US person for this purpose. If the total value of its foreign accounts exceeds ${SCHWELLEN_EN.fbar} during the year, the report to the US authority FinCEN is due. The deadline is ${FRISTEN_EN.fbar}.`,
        "Each of these filings is manageable on its own. The disadvantage lies in the total: two countries, several authorities, different dates. The figures have to match in both countries.",
      ],
    },
    {
      typ: "tabelle", id: "kosten", h2: "Running costs every year",
      lead: "An LLC bears these costs from the second year onwards, even without revenue. The state fees come from the official fee schedules. The other figures are market ranges published by several providers.",
      kopf: ["Item", "Amount", "When"],
      zeilen: [
        ["Annual report (yearly state filing), Florida", STAAT_EN.florida.jahr, STAAT_EN.florida.jahrFrist],
        ["Annual report with License Tax, Wyoming", `${STAAT_EN.wyoming.jahr} (${STAAT_EN.wyoming.jahrDetail})`, STAAT_EN.wyoming.jahrFrist],
        ["Annual LLC tax, Delaware", STAAT_EN.delaware.jahr, STAAT_EN.delaware.jahrFrist],
        ["Registered agent (required address for service in the state)", MARKT_EN.agent, "every year; Florida, Wyoming and Delaware require one"],
        ["US CPA for Form 5472 with Form 1120", MARKT_EN.cpa5472, "every year, by the IRS deadline"],
        ["Your tax adviser in Germany, Austria or Switzerland", "according to time spent", "every year, with your tax return"],
      ],
      fuss: [
        `Delaware: ${STAAT_EN.delaware.jahrAlt}`,
        `Registered agent and US CPA: market ranges, as at ${FAKTEN_STAND_EN}, not official figures. Depending on your business, ongoing bookkeeping and sales tax registrations in individual states are added.`,
      ],
    },
    {
      typ: "text", id: "einordnung", h2: "Two countries, two classifications",
      absaetze: [
        `In the US, an LLC with one member is not separate from its owner for tax purposes (disregarded entity). An LLC with two or more members is treated as a partnership. Either can elect, on Form 8832, to be taxed as a corporation. The LLC then pays federal corporate income tax of ${prozent(IRS_EN.koerperschaftsteuer)} on its profit taxable in the US. It also files a full Form 1120.`,
        `A partnership has duties of its own. It files Form 1065, due on ${FRISTEN_EN.f1065} for a calendar-year partnership. If it earns income from a business in the US, it withholds tax on its foreign partners’ share (section 1446). The withholding rate is ${SCHWELLEN_EN.abzug1446}. The partner then files a US return of their own, as an individual on Form 1040-NR. The S corporation, which American guides often mention, is not an option. It may not have a shareholder who is a non-resident alien (26 U.S.C. § 1361(b)(1)(C)).`,
        "In Germany, the US classification is not decisive. The tax office examines, in a comparison of legal types (Typenvergleich), whether the LLC’s legal structure corresponds more closely to a corporation or to a partnership. The criteria are set out in the German Federal Ministry of Finance letter of 19 March 2004. What matters is the overall picture; the criteria carry different weight (Federal Fiscal Court, BFH, order of 18 May 2021, I B 75/20). Austria also classifies the LLC case by case by comparing legal types; there, too, the US classification is not decisive (Austrian Ministry of Finance, EAS 1413). Many of these criteria are governed by the operating agreement, the contract that governs the LLC. Anyone who adopts it unchanged from a template also fixes criteria for the classification.",
        "The disadvantage lies in the interaction of the two classifications. The LLC can be transparent for tax purposes in the US and a corporation in Germany, or the other way round. The tax adviser and the US CPA then have to align both sides so that both countries receive the same figures. The double taxation agreement contains a specific rule for such companies (Art. 1(7)).",
      ],
    },
    {
      typ: "text", id: "bank", h2: "Accounts and cards without a US history",
      absaetze: [
        `Before opening any account, a US bank collects a name, an address and an identification number and verifies these details. For foreign nationals, that can be a passport number together with the issuing country. For the company, the rule requires a principal place of business, a local office or another physical location (31 CFR 1020.220). The bank also identifies the beneficial owners: anyone holding ${SCHWELLEN_EN.eigentuemer} or more (31 CFR 1010.230).`,
        "For cards, credit history in the US is what counts. A FICO Score (a credit score) exists only on two conditions. At least one account has been open for six months or longer, and it has been reported to the credit bureau within the last six months. Anyone new to the US therefore has no score at first. With Executive Order 14406 of 19 May 2026, the President also directed the US Treasury to alert banks to red flags. One red flag for banks is the use of an ITIN (the personal US tax number) for account or credit applications by applicants without verified immigration status in the US. On this basis, an ITIN in place of a Social Security number may count as a risk factor that triggers enhanced review by the institution.",
        "The Small Business Administration (SBA), a US federal agency, backs the 7(a) and 504 loan programmes. They are not open to an LLC whose owner lives outside the US. Since 1 March 2026, the business must be 100 per cent owned, directly and indirectly, by US citizens or US nationals whose principal residence is in the US (SBA Procedural Notice 5000-876626).",
        `${GLOBAL_PFLICHTHINWEIS.en[2]} The LLC’s limited liability does not protect you against obligations for which you are personally liable.`,
      ],
    },
    {
      typ: "tabelle", id: "strafen", h2: "Penalties for non-compliance",
      lead: "Six duties and the consequence if one is missed. The legal basis is in the last column.",
      kopf: ["Failure", "Consequence", "Legal basis"],
      zeilen: [
        ["Form 5472 not filed or filed late, records not kept", `${IRS_EN.strafe5472}; if the failure continues for more than ninety days after an IRS notice, a further US$25,000 for each thirty-day period or part of one`, "IRS, Instructions for Form 5472"],
        ["Notification under section 138(2) AO not made, incomplete or late, intentionally or recklessly", "A fine not exceeding €25,000", "Section 379(2) and (7) AO"],
        ["Annual report in Florida", `${STAAT_EN.florida.jahrVerzug}; if the report is still missing on the third Friday in September, the state administratively dissolves the LLC on the fourth Friday in September`, "Florida Statutes, §§ 607.193 and 605.0714"],
        ["Annual report in Wyoming", STAAT_EN.wyoming.jahrVerzug, "Wyoming Secretary of State"],
        ["Annual tax in Delaware", STAAT_EN.delaware.jahrVerzug, "Delaware Code, Title 6, § 18-1107"],
        ["No registered agent", "in Florida a ground for administrative dissolution; once notice has been given, there are sixty days to remedy the defect", "Florida Statutes, § 605.0714"],
      ],
      fuss: ["As at October 2026. State fees and consequences according to the states’ official information. In Florida, a dissolved LLC can be reinstated on payment of all outstanding fees and penalties (Florida Statutes, § 605.0715)."],
    },
    {
      typ: "karten", id: "nicht-passt", h2: "When a US LLC does not fit", spalten: 3,
      lead: "Six cases in which the disadvantages of an LLC generally outweigh its benefits.",
      karten: [
        { tag: "Not a fit", titel: "No business in the US", text: "Without US customers, US contracts or US platforms, the LLC has no function. What remains are duties and costs in two countries." },
        { tag: "Not a fit", titel: "Tax as the only reason", text: "Anyone forming the LLC mainly to pay less tax in their country of residence starts from a false assumption. The LLC is taxable where it is managed (section 10 AO). If an inappropriate arrangement mainly serves tax purposes and significant non-tax reasons are lacking, it may be treated as abuse under section 42 AO.", pfad: "/en/business/knowledge/us-llc-tax" },
        { tag: "Not a fit", titel: "Customers only in German-speaking countries", text: "An LLC managed from Germany generally charges German VAT when invoicing German businesses (section 13b(7) UStG). For purely domestic business, it adds duties in the US, usually without a benefit." },
        { tag: "Not a fit", titel: "Right of residence as the goal", text: "An LLC alone does not entitle you to live or work in the US. The E-2 visa, for example, requires the nationality of a treaty country and a substantial investment in a real business. The business must be able to earn more than a minimal living. Whether a visa is an option in your case is for a US immigration lawyer to assess.", pfad: "/en/business/knowledge/e2-visa-own-us-company" },
        { tag: "Not a fit", titel: "Duties without time and budget", text: "The annual duties take time and money: Form 5472, the annual report to the state, the tax return in your country of residence. The registered agent is a further item. Anyone who plans for neither time nor money risks the penalties in the table above." },
        { tag: "Not a fit", titel: "Anonymity as the goal", text: `Banks identify anyone who holds ${SCHWELLEN_EN.eigentuemer} or more. The tax office learns of the company through the notification under section 138 AO. An LLC therefore offers no anonymity.` },
      ],
    },
    {
      typ: "text", id: "sinnvoll", h2: "When a US LLC makes sense",
      absaetze: [
        "The disadvantages weigh less when the company carries on business in the US. Filings and costs are then set against a benefit. Six typical cases:",
      ],
      punkte: [
        "You have customers in the US who expect a US contracting party, a US invoice and payments in US dollars.",
        "You sell through US platforms or payment services that require a US company with a tax number (EIN) and a US account.",
        "You are building a team, a warehouse or an office in the US, or your company needs a subsidiary to enter the US market.",
        "You want to build the company’s credit standing and payment record in the United States over several years. That takes time, orderly figures and, as a rule, your personal guarantee on the first cards.",
        "You are planning an investment in a real US business that may later form part of a visa application. Whether that is sufficient in your case is for a US immigration lawyer to assess.",
        `You want to apply for accounts, cards or financing for the company in the US. The institution concerned decides on each application. ${KAPITAL_FREI}`,
      ],
      nach: "One disadvantage found in older descriptions no longer applies: since August 2026, companies formed in the US no longer file a BOI report with FinCEN.",
    },
    { typ: "zitat", id: "ehrlich", text: EHRLICH, quelle: "FIAON Global" },
    {
      typ: "text", id: "fiaon", h2: "What FIAON Global handles",
      absaetze: [
        `We form your US company, assemble every document and apply for the tax numbers. Included in the first year: the compliance calendar, the first annual state report and ${US_MELDUNG} (Form 5472 with Form 1120).`,
        JAHRESBETREUUNG,
      ],
      punkte: [
        `${TEIL.ihrTeil}: ${GRUENDUNG.ihrTeil} ${UNTERLAGEN.ihrTeil}`,
        `Accounts and cards: ${satz("S2", "en")}`,
        `${TEIL.bedingung}: ${satz("S3", "en")}`,
      ],
    },
    { typ: "paket", id: "mandat", h2: P.karteH2, lead: P.karteLead, paket: "global_struktur" },
    {
      typ: "hinweis", id: "wissen", h2: "What you need to know",
      punkte: [
        `This page explains the fundamentals (as at October 2026) and does not replace a tax or legal review of your case. ${STEUERFRAGEN}. Questions on visas and residence are for a US immigration lawyer.`,
        GLOBAL_PFLICHTHINWEIS.en[0],
        GLOBAL_PFLICHTHINWEIS.en[1],
        `Not included in your engagement: ${NICHT_INKLUSIVE}.`,
        satz("S8", "en"),
        satz("S10", "en"),
      ],
    },
  ],
  fragen: [
    { f: "What are the disadvantages of a US LLC for business owners from Germany?", a: `Five above all. Tax liability stays in Germany if you manage the LLC from there (section 10 AO). Filing duties arise in two countries: Form 5472 to the IRS and the notification under section 138 AO to the tax office. Each year brings costs for the state fee, the registered agent and a US CPA. Without a US history there is no credit score at first; each institution decides on accounts and cards. For a missed filing, the IRS can assess ${STRAFE_5472} for each missing Form 5472.` },
    { f: "Is a US LLC worth it?", a: "With business in the US, the advantages can outweigh the disadvantages, for example with US customers, US platforms or a market entry with a team. As a tax scheme it is not worth it. If you run it from your country of residence, you remain taxable there and also carry duties and costs in the US. Your tax adviser assesses your individual case." },
    { f: "Is a US LLC “tax-free”?", a: "No. An LLC with a foreign member often pays no federal tax in the US as long as it has no business there. It is taxable where it is managed. That follows in Germany from section 10 AO, in Austria from section 1(2) KStG 1988, in Switzerland from Art. 50 DBG." },
    { f: "What does a US LLC cost every year?", a: `Three items in the US: the state fee, the registered agent (${MARKT_EN.agent}) and the US CPA for Form 5472 (${MARKT_EN.cpa5472}). The last two figures are market ranges, as at ${FAKTEN_STAND_EN}. The state fee is ${STAAT_EN.florida.jahr} in Florida, ${STAAT_EN.wyoming.jahr} in Wyoming and ${STAAT_EN.delaware.jahr} in Delaware. Your tax adviser in your country of residence is a further cost. These costs arise even without revenue.` },
    { f: "What happens if I do not file Form 5472?", a: `The IRS can impose a penalty of ${IRS_EN.strafe5472}. The same applies if the required records are missing. If the failure continues for more than ninety days after its notice, a further US$25,000 is added for each thirty-day period or part of one. The duty does not depend on revenue: payments at formation, contributions and distributions are already reportable.` },
    { f: "Can I get a US account and credit cards with a US LLC?", a: "The institution concerned decides. Without a US history there is no FICO Score at first. Issuers generally require your personal guarantee for business credit cards. Under Executive Order 14406, an ITIN instead of a Social Security number may count as a red flag that triggers enhanced review by the institution. Complete documents without contradictions therefore count for more than the number of applications." },
    { f: "Can I live and work in the US with a US LLC?", a: "No, the company alone does not entitle you to do so; you need a visa. The E-2 investor visa, for example, requires the nationality of a treaty country and a substantial investment in a real business. The business must be able to earn more than a minimal living. Whether the visa is an option in your case is for a US immigration lawyer to assess." },
    { f: "When does a US LLC not fit?", a: `When there is no business in the US, or when tax is the only reason. Likewise when the customers are only in Germany, Austria or Switzerland, or when time and budget for the annual duties are lacking. ${EHRLICH}` },
  ],
  paket: "global_struktur",
  weiter: ["/en/business/knowledge/us-llc-tax", "/en/business/knowledge/llc-vs-gmbh", "/en/business/knowledge/us-llc-german-resident", "/en/business/costs"],
  quellen: [
    QL.ao10, QL.kstg1, Q.ao138, QL.ao379, QL.ao42, QL.ustg13b, QL.bmf, QL.bfh,
    QL.kstg1at, QL.bao27, QL.bao120, QL.bao121, QL.eas1413, QL.dbg50, Q.dba,
    Q.i5472, Q.smllc, Q.f8832, Q.i1120, Q.i1065, Q.abzug1446, Q.i1040nr, QL.usc1361,
    QL.irsFbar, Q.fbar, Q.boiEnde,
    Q.cip, Q.cdd, Q.ficoMindest, QL.eo14406, QL.sba, QL.e2,
    QUELLEN_STAATEN_EN.florida[0], QUELLEN_STAATEN_EN.florida[1], QUELLEN_STAATEN_EN.florida[2], QUELLEN_STAATEN_EN.florida[3], QL.fl605304, Q.floridaAufloesung, QL.fl605715,
    QUELLEN_STAATEN_EN.wyoming[0], QUELLEN_STAATEN_EN.wyoming[1], QUELLEN_STAATEN_EN.wyoming[2], QUELLEN_STAATEN_EN.delaware[0], QUELLEN_STAATEN_EN.delaware[1], Q.delawareAgent,
  ],
};
