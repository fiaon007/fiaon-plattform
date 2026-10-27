// ═══════════════════════════════════════════════════════════════════════════
// FIAON GLOBAL — KNOWLEDGE: US LLC DISADVANTAGES FOR NON-RESIDENTS (27.10.2026, E-439, FG · 52)
//
// Die englische Schwester von ../../e439/nachteile-us-llc.ts — die ehrliche Gegenrede
// zu den Vorteil-Seiten der „tax-free“-Szene. Abgrenzung wie im Deutschen:
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
import { GLOBAL_PFLICHTHINWEIS, GLOBAL_KAPITAL_FREI, GLOBAL_GELD_ZURUECK, GLOBAL_ROLLEN, GLOBAL_NICHT_INKLUSIVE, globalPaket } from "../../../fiaon-global";
import {
  QUELLEN_WISSEN_EN as Q, QUELLEN_RECHT_EN as R, QUELLEN_STAATEN_EN, STAAT_EN, IRS_EN, MARKT_EN, SCHWELLEN_EN, FRISTEN_EN, FAKTEN_STAND_EN,
} from "../../fakten-en";

const S = "2026-10-27";

/** „US$25,000“ aus „US$25,000 per form per year“ — für Kennziffer und Blick; die Zahl bleibt in fakten-en.ts. */
const STRAFE_5472 = IRS_EN.strafe5472.split(" per ")[0];

/** Im Fließtext „per cent“ statt „%“ (britischer Satz), die Zahl selbst bleibt aus fakten-en.ts. */
const prozent = (x: string) => x.replace(/(\d)%/g, "$1 per cent");

const STRUKTUR = globalPaket("global_struktur")?.en.name ?? "Global Structure";

const KAPITAL_FREI = `${GLOBAL_KAPITAL_FREI.en.satz} ${GLOBAL_KAPITAL_FREI.en.steuer}`;

const GELD_ZURUECK = GLOBAL_GELD_ZURUECK.aktiv ? [`${GLOBAL_GELD_ZURUECK.en.text} ${GLOBAL_GELD_ZURUECK.en.bedingungen}`] : [];

const NICHT_INKLUSIVE = GLOBAL_NICHT_INKLUSIVE.en[1].charAt(0).toLowerCase() + GLOBAL_NICHT_INKLUSIVE.en[1].slice(1);

/** Der Satz, den wir auch im Gespräch sagen (Ehrlichkeits-Signal, Auftrag E-439). */
const EHRLICH = "If all you need is the company itself, a formation-only service will cost you less — and we tell you so when we speak, too.";

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
    beschreibung: "US LLC disadvantages for non-residents: tax at home, filings in two countries, annual costs, penalties — and when an LLC still makes sense.",
  },
  stand: S,
  erschienen: S,
  kennung: "FG · 52",
  auge: "Knowledge · Before formation",
  h1: "US LLC disadvantages for non-residents.",
  h1b: "Stated plainly, with sources.",
  lead: "Anyone planning to form a US LLC usually reads only about the advantages. Here are the US LLC disadvantages for non-residents, each with its source: tax liability that stays at home, filing duties in two countries, running costs every year, penalties for non-compliance and difficult access to banking and cards without a US history. We also set out the cases in which an LLC is not the right fit — and those in which it makes sense.",
  ziffern: [
    { wert: STRAFE_5472, label: "IRS penalty for each missed Form 5472" },
    { wert: "14 months", label: "at the latest: notification under section 138 AO, with the tax return" },
    { wert: "§ 10 AO", label: "German Fiscal Code: the place of management determines tax liability" },
  ],
  blick: [
    ["Tax liability", "Stays where the LLC is managed — usually at home"],
    ["Filings", "Form 5472 to the IRS; section 138 AO notification to the tax office"],
    ["Running costs", "State fee, registered agent, US CPA — every year"],
    ["Penalties", `${STRAFE_5472} per missed Form 5472`],
    ["Banking and cards", "No credit score at first without a US history; a personal guarantee is usual"],
    ["Not a fit", "Without real business in the US, purely for tax reasons"],
    ["With FIAON Global", "One point of contact instead of eight; a review before formation"],
  ],
  kurz: `The main US LLC disadvantages for non-residents: if you run the company from Germany, Austria or Switzerland, it generally remains taxable there (section 10 of the German Fiscal Code, AO; section 1(2) of the Austrian KStG 1988; Art. 50 of the Swiss DBG). Added to this are filing duties in two countries — Form 5472 to the IRS, where a missed filing can cost ${STRAFE_5472} per form, and in Germany the notification under section 138 AO — as well as running costs for state fees, a registered agent and a US CPA, and difficult access to banking and cards without a US history. An LLC makes sense for real business in the US, not as a tax model.`,
  bloecke: [
    {
      typ: "text", id: "steuerpflicht", h2: "The first of the US LLC disadvantages for non-residents: tax liability stays at home",
      absaetze: [
        "A widespread misconception surrounds the US LLC: its reputation as a “tax-free” company. Only part of that is true: the IRS generally does not treat an LLC with a single foreign member as a separate taxpayer, and without a business in the US there is often no federal tax to pay there. That says nothing about tax in your country of residence.",
        "Germany looks to the place of management, the centre of the company’s top-level commercial direction (section 10 AO). If you take your LLC’s important decisions at a desk in Germany, its place of management is in Germany. If the LLC is classified as comparable to a corporation, it is then subject to unlimited corporate income tax in Germany on all of its income (section 1 of the German Corporate Income Tax Act, KStG); if it is classified as transparent, its profit is attributed to you directly. Austria likewise looks to the place of management or registered office in Austria (section 1(2) KStG 1988 together with section 27 of the Austrian Federal Fiscal Code, BAO), Switzerland to the registered office or effective management (Art. 50 of the Swiss Federal Direct Tax Act, DBG).",
        "The double taxation agreement between Germany and the United States does not change this in principle. It allocates taxing rights and prevents the same profit from being taxed twice; it does not turn a company managed from Germany into one that is taxable only in the US. Then there is section 42 AO: tax law cannot be circumvented by abusing legal arrangements. Where an inappropriate arrangement leads to a more favourable tax outcome than the law provides for, the tax arises as it would under an appropriate arrangement — unless non-tax reasons are shown that are significant in view of the overall circumstances.",
        "VAT follows the place of management, too. A business with its registered office, place of management or a permanent establishment in Germany is not treated as established abroad for VAT purposes (section 13b(7) of the German VAT Act, UStG) — and that includes an LLC managed from Germany. Invoices to German businesses then generally carry German VAT instead of a note that the customer owes the tax (reverse charge).",
      ],
    },
    {
      typ: "tabelle", id: "ueberblick", h2: "Advantages and disadvantages of a US LLC at a glance",
      lead: "The case for and against a US LLC, each seen from the perspective of a business owner resident in Germany, Austria or Switzerland.",
      kopf: ["Topic", "Advantage", "Disadvantage"],
      zeilen: [
        ["Formation", `Quick and manageable: filing fee ${STAAT_EN.wyoming.gruendung} in Wyoming, ${STAAT_EN.florida.gruendung} in Florida`, "Formation is the smallest cost; the duties recur every year"],
        ["Tax", "Often no federal tax in the US, as long as there is no business there", "Managed from home, generally taxable at home (section 10 AO)"],
        ["Filings", "BOI reporting no longer required for companies formed in the US (FinCEN, August 2026)", "Form 5472 to the IRS as soon as money moves between you and the LLC — even without revenue; plus the notification under section 138 AO to the tax office"],
        ["Classification", "Elective: transparent or taxed as a corporation", "The IRS and the tax office classify independently of each other; the results can diverge"],
        ["Liability", "As a rule, the company — not the member — is liable for the company’s debts (in Florida, § 605.0304)", "For business credit cards, issuers generally require your personal guarantee"],
        ["Banking and cards", "A US account can make it easier to receive payments from US customers in US dollars", "Without a US credit history, no score at first; SBA programmes closed; each institution decides for itself"],
        ["Costs", "Manageable state fees", "The state fee, registered agent and US CPA every year, plus your own tax adviser at home"],
        ["Residence", "Can form part of the basis for an investor visa if a real business with a substantial investment stands behind it — a US immigration lawyer assesses this", "The company alone confers no right to live or work in the US"],
      ],
      fuss: ["Simplified overview, as of October 2026. Whether a point is an advantage or a disadvantage for you depends on your business; the tax position is assessed case by case by the tax adviser."],
    },
    {
      typ: "text", id: "meldepflichten", h2: "The second disadvantage: filing duties in two countries",
      absaetze: [
        `In the US, a single-member LLC with a foreign owner is treated as a corporation for the purposes of the reporting requirements under section 6038A. It files Form 5472, attached to a simplified (pro forma) Form 1120, for every year in which there is a reportable transaction between the LLC and you. This expressly includes payments at formation, contributions to the company and distributions from it — no revenue and no account are needed for the duty to arise. For a calendar-year company, the deadline is ${IRS_EN.frist5472}. The duty also includes keeping books that support these figures.`,
        "In Germany, the interest in the LLC must be notified to the tax office (section 138(2) AO): depending on its classification, as an interest in a foreign partnership or in a foreign corporation (for a corporation, from a holding of ten per cent or acquisition costs of more than €150,000), and also where you first gain a controlling influence over a company outside the EU and EFTA. The notification is submitted with the tax return for the year of formation, no later than 14 months after the end of that year (section 138(5) AO). If the LLC is managed from Germany, a notification under section 138(1) AO may also be required: the opening of a commercial business or a permanent establishment is reported to the municipality, which informs the tax office. In Austria, you must notify the tax office within one month of any circumstances that give rise to or change a tax liability (sections 120 and 121 BAO).",
        `If the LLC holds accounts outside the US — a euro account in Europe, for example — a third filing may be required. For the FBAR, a limited liability company formed in the US also counts as a US person. If the total value of its foreign accounts exceeds ${SCHWELLEN_EN.fbar} during the year, the report to FinCEN is due; the deadline is ${FRISTEN_EN.fbar}.`,
        "Each of these filings is simple on its own. The disadvantage is that they fall due in two countries, with different authorities and on different dates — and that the figures have to be consistent across both countries.",
      ],
    },
    {
      typ: "tabelle", id: "kosten", h2: "The third disadvantage: running costs every year",
      lead: "What an LLC costs from the second year onwards, even if it has no revenue. The state fees come from the official fee schedules; the other figures are published prices from several providers.",
      kopf: ["Item", "Amount", "When"],
      zeilen: [
        ["Annual report, Florida", STAAT_EN.florida.jahr, STAAT_EN.florida.jahrFrist],
        ["Annual report with License Tax, Wyoming", `${STAAT_EN.wyoming.jahr} (${STAAT_EN.wyoming.jahrDetail})`, STAAT_EN.wyoming.jahrFrist],
        ["Annual LLC tax, Delaware", STAAT_EN.delaware.jahr, STAAT_EN.delaware.jahrFrist],
        ["Registered agent", MARKT_EN.agent, "every year; Florida, Wyoming and Delaware require one"],
        ["US CPA for Form 5472 with Form 1120", MARKT_EN.cpa5472, "every year, by the IRS deadline"],
        ["Your tax adviser in Germany, Austria or Switzerland", "according to time spent", "every year, with your tax return"],
      ],
      fuss: [
        `Delaware: ${STAAT_EN.delaware.jahrAlt}`,
        `Registered agent and US CPA: market ranges, as of ${FAKTEN_STAND_EN}, not official figures. Ongoing bookkeeping and sales tax registrations in individual states may be needed in addition.`,
      ],
    },
    {
      typ: "text", id: "einordnung", h2: "The fourth disadvantage: two countries, two classifications",
      absaetze: [
        `In the US, an LLC with one member is disregarded as separate from its owner for tax purposes (disregarded entity); an LLC with two or more members is treated as a partnership. Either can elect, on Form 8832, to be taxed as a corporation. The LLC then pays federal corporate income tax of ${prozent(IRS_EN.koerperschaftsteuer)} on its profit taxable in the US and files a full Form 1120.`,
        `A partnership has duties of its own: Form 1065, due on ${FRISTEN_EN.f1065} for a calendar-year partnership. If it earns income from a business in the US, it withholds tax on its foreign partners’ share (section 1446) — ${SCHWELLEN_EN.abzug1446} — and the partner files a US return of their own (as an individual: Form 1040-NR). Another route often described in American guides is also closed: an S corporation may not have a shareholder who is a non-resident alien (26 U.S.C. § 1361(b)(1)(C)).`,
        "In Germany, the US classification does not matter. The tax office examines, in a comparison of legal types (Typenvergleich), whether the LLC’s legal structure corresponds more closely to a corporation or to a partnership. The criteria are set out in the German Federal Ministry of Finance letter of 19 March 2004; what matters is the overall picture, and the criteria do not carry equal weight (Federal Fiscal Court, BFH, order of 18 May 2021, I B 75/20). Austria also classifies the LLC case by case by comparing legal types; there, too, the US classification is not decisive (Austrian Ministry of Finance, EAS 1413). Many of these criteria are governed by the operating agreement — anyone who copies it from a template without review shapes the classification without realising it.",
        "The disadvantage lies in the interplay. If the LLC is transparent in the US and a corporation in Germany, or the other way round, the tax adviser and the US CPA have to align both sides so that the same figures are reported consistently in both countries. The double taxation agreement contains a specific rule for such companies (Art. 1(7)).",
      ],
    },
    {
      typ: "text", id: "bank", h2: "The fifth disadvantage: banking and cards without a US history",
      absaetze: [
        `Before opening any account, a US bank collects and verifies a name, an address and an identification number. For foreign nationals, that can be a passport number together with the issuing country; for the company, the rule requires a principal place of business, a local office or another physical location (31 CFR 1020.220). Then there are the beneficial owners: anyone holding ${SCHWELLEN_EN.eigentuemer} or more is identified (31 CFR 1010.230). Whether an account is opened, and on what terms, is for each institution alone to decide.`,
        "For cards, credit history is what counts. A FICO Score only exists once at least one account has been open for six months or longer and has been reported to the credit bureau within the last six months. Anyone new to the US therefore has no score at first. With Executive Order 14406 of 19 May 2026, the President also directed the US Treasury to alert banks to red flags. These include the use of an ITIN for account or credit applications by applicants without verified immigration status in the US; on this basis, an ITIN in place of a Social Security number may count as a risk factor that triggers enhanced review.",
        "Nor are the 7(a) and 504 loan programmes backed by the Small Business Administration (SBA) open to an LLC whose owner lives in Germany, Austria or Switzerland: since 1 March 2026, the business must be 100 per cent owned, directly and indirectly, by US citizens or US nationals whose principal residence is in the US (SBA Procedural Notice 5000-876626).",
        `${GLOBAL_PFLICHTHINWEIS.en[2]} The LLC’s limited liability does not protect you against obligations for which you are personally liable.`,
      ],
    },
    {
      typ: "tabelle", id: "strafen", h2: "The sixth disadvantage: penalties for non-compliance",
      lead: "Each duty is manageable on its own. It becomes expensive when one of them is missed.",
      kopf: ["Failure", "Consequence", "Legal basis"],
      zeilen: [
        ["Form 5472 not filed or filed late, records not kept", `${IRS_EN.strafe5472}; if the failure continues for more than 90 days after an IRS notice, a further US$25,000 for each 30-day period or part of one`, "IRS, Instructions for Form 5472"],
        ["Notification under section 138(2) AO not made, incomplete or late, intentionally or recklessly", "A fine not exceeding €25,000", "Section 379(2) and (7) AO"],
        ["Annual report in Florida", `${STAAT_EN.florida.jahrVerzug}; if the report is still missing on the third Friday in September, the LLC is administratively dissolved on the fourth Friday in September`, "Florida Statutes, §§ 607.193 and 605.0714"],
        ["Annual report in Wyoming", STAAT_EN.wyoming.jahrVerzug, "Wyoming Secretary of State"],
        ["Annual tax in Delaware", STAAT_EN.delaware.jahrVerzug, "Delaware Code, Title 6, § 18-1107"],
        ["No registered agent", "in Florida a ground for administrative dissolution; once notice has been given, there are sixty days to remedy it", "Florida Statutes, § 605.0714"],
      ],
      fuss: ["As of October 2026; state fees and consequences according to the states’ official information, checked in October 2026. In Florida, a dissolved LLC can be reinstated — on payment of all outstanding fees and penalties (Florida Statutes, § 605.0715)."],
    },
    {
      typ: "karten", id: "nicht-passt", h2: "When a US LLC is not the right fit", spalten: 3,
      lead: "Six situations in which the disadvantages of an LLC generally outweigh its benefits.",
      karten: [
        { tag: "Not a fit", titel: "No business in the US", text: "Without US customers, US contracts or US platforms, the LLC has no real role to play. All it then brings you is duties and costs in two countries." },
        { tag: "Not a fit", titel: "Tax as the only motive", text: "Anyone forming the LLC mainly to pay less tax at home is building on a misunderstanding: it is taxable where it is managed (section 10 AO). An inappropriate arrangement that mainly serves tax purposes and has no significant non-tax reasons may also be treated as abuse under section 42 AO.", pfad: "/en/business/knowledge/us-llc-tax" },
        { tag: "Not a fit", titel: "Customers only in the DACH region", text: "An LLC managed from Germany generally charges German VAT when invoicing German businesses (section 13b(7) UStG). For purely domestic business it usually brings no benefit — only a second set of duties." },
        { tag: "Not a fit", titel: "A right of residence as the goal", text: "An LLC alone does not entitle you to live or work in the US. The E-2 visa, for example, requires the nationality of a treaty country and a substantial investment in a real business that can earn more than a minimal living. Whether a visa is an option in your case is for a US immigration lawyer alone to assess.", pfad: "/en/business/knowledge/e2-visa-own-us-company" },
        { tag: "Not a fit", titel: "No capacity for the duties", text: "Form 5472, the annual report to the state, the registered agent, the tax return at home: anyone unwilling to set aside time or budget for these is running precisely the risk of the penalties in the table above." },
        { tag: "Not a fit", titel: "The wish for anonymity", text: `Banks identify anyone who holds ${SCHWELLEN_EN.eigentuemer} or more, and the tax office learns of the company through the notification under section 138 AO. An LLC is no hiding place.` },
      ],
    },
    {
      typ: "text", id: "sinnvoll", h2: "When a US LLC makes sense",
      absaetze: [
        "The disadvantages weigh less heavily when the company has real work to do in the US. Filings and costs are then the price of access that is not available any other way. Typical situations:",
      ],
      punkte: [
        "You have customers in the US who expect a US contracting party, a US invoice and payments in US dollars.",
        "You sell through US platforms or payment services that require a US company with an EIN and a US account.",
        "You are building a team, a warehouse or an office in the US, or your company needs a subsidiary to enter the US market.",
        "You want to build up a US credit profile and a card history for the company over several years — with everything that goes with it: patience, clean figures and a personal guarantee on the first cards.",
        `You want to apply for accounts, cards or financing for the company in the US — the institution concerned alone decides on the account, the card, the limit and any loan. ${KAPITAL_FREI}`,
        "You are planning an investment in a real US business that may later form part of a visa application; whether that holds up in your case is for a US immigration lawyer to assess.",
      ],
      nach: "One disadvantage still listed on many websites has fallen away: since August 2026, companies formed in the US no longer have to file a BOI report with FinCEN.",
    },
    { typ: "zitat", id: "ehrlich", text: EHRLICH, quelle: "FIAON Global" },
    {
      typ: "text", id: "fiaon", h2: "How FIAON Global takes on the duties that come with an LLC",
      absaetze: [
        "FIAON Global is a business consultancy for your route into the US, founded on one principle: one point of contact instead of eight. Many of the disadvantages of a US LLC are a matter not of law but of organisation — eight parties, two countries, different deadlines. With your power of attorney, we file the applications on your behalf: formation, the EIN, preparation of the ITIN, the D-U-N-S Number, filings, the registered agent, a US address and a US phone number for the first year. You submit only the account, card and credit applications yourself; we prepare them in full.",
        `Before the company is formed, our partner tax adviser, acting under your engagement, reviews your case: the place of management, the classification under the comparison of legal types, the notification under section 138 AO — and whether the LLC suits your plans from a tax perspective. On that basis, our partner lawyer drafts the operating agreement; our US CPA takes on the first Form 5472 with Form 1120. ${GLOBAL_ROLLEN.en.partner}`,
        "You pay a fixed price, with all fees for the package included. Our team on the ground in Miami handles appointments in the US; our partner location is Zurich, and your contracting party is FIAON LTD in London. From the second year onwards, you may choose to add the annual care plan: we then take care of the registered agent, the US address and US phone number, the annual report to the state including the state fee, and the US filing through our US CPA — with a compliance calendar, so that you keep every deadline in view.",
        "And if it is already clear in our first conversation that an LLC does not suit your plans — because there is no business in the US, for example — we tell you so before you engage us. If you need only the company itself, without the review, the partners and the support, you are better served, at lower cost, by a formation-only service.",
        ...GELD_ZURUECK,
      ],
    },
    { typ: "paket", id: "paket", h2: "A clean start, every duty in view", lead: `Formation, EIN and ITIN, registered agent, US address and US phone number for the first year, the operating agreement by our partner lawyer, the review before formation by our partner tax adviser, the first US filing by our US CPA and the first account and card application, fully prepared — ${STRUKTUR}.`, paket: "global_struktur" },
    {
      typ: "hinweis", id: "wissen", h2: "What you need to know",
      punkte: [
        "This article explains the legal position as of October 2026. It is no substitute for a review of your case, which the tax adviser carries out under your engagement; questions on visas and residence are for a US immigration lawyer.",
        GLOBAL_PFLICHTHINWEIS.en[0],
        GLOBAL_PFLICHTHINWEIS.en[1],
        `Not included in the fixed price: ${NICHT_INKLUSIVE}.`,
        GLOBAL_ROLLEN.en.fiaon,
        "FIAON neither grants nor arranges loans. A US LLC is not a tax model: if you manage it from home, it is generally taxed there.",
      ],
    },
  ],
  fragen: [
    { f: "What are the disadvantages of a US LLC for business owners from Germany?", a: `Five above all: tax liability stays in Germany if the LLC is managed from there (section 10 AO). There are filing duties in two countries — Form 5472 to the IRS and the notification under section 138 AO to the tax office. Each year brings costs for the state fee, the registered agent and a US CPA. Without a US history, accounts and cards are harder to obtain. And missed filings are costly: ${STRAFE_5472} for each missing Form 5472.` },
    { f: "Is a US LLC worth it?", a: "If it has real business in the US — US customers, US platforms, a team or a market entry — the advantages can outweigh the disadvantages. As a pure tax model it is not worth it: if you run it from home, you remain taxable there and also carry duties and costs in the US. The tax adviser reviews your case before formation." },
    { f: "Is a US LLC “tax-free”?", a: "No. An LLC with a foreign member often pays no federal tax in the US as long as it has no business there. But it is taxable where it is managed: in Germany under section 10 AO, in Austria under section 1(2) KStG 1988, in Switzerland under Art. 50 DBG." },
    { f: "What does a US LLC cost every year?", a: `The state fee (${STAAT_EN.florida.jahr} in Florida, ${STAAT_EN.wyoming.jahr} in Wyoming, ${STAAT_EN.delaware.jahr} in Delaware), the registered agent (market prices ${MARKT_EN.agent}) and the US CPA for Form 5472 (${MARKT_EN.cpa5472}). There is also your own tax adviser at home. These costs arise even without revenue.` },
    { f: "What happens if I do not file Form 5472?", a: `The IRS can impose a penalty of ${IRS_EN.strafe5472}, and the same applies if the required records are missing. If the failure continues for more than 90 days after its notice, a further US$25,000 is added for each 30-day period or part of one. The duty does not depend on revenue: even payments at formation, contributions and distributions are reportable.` },
    { f: "Can I get a US account and credit cards with a US LLC?", a: "That is decided solely by the institution concerned. Without a US history there is no FICO Score at first, business credit cards generally require your personal guarantee, and under Executive Order 14406 an ITIN instead of a Social Security number may count as a red flag that triggers enhanced review. Complete, consistent documents therefore count for more than the number of applications." },
    { f: "Can I live and work in the US with a US LLC?", a: "Not on the strength of the company alone; that requires a visa. The E-2 investor visa, for example, requires the nationality of a treaty country and a substantial investment in a real business that can earn more than a minimal living. Whether it is an option in your case is assessed by a US immigration lawyer." },
    { f: "When does a US LLC not fit?", a: `When there is no business in the US, when the tax motive is the real reason, when the customers are only in Germany, Austria or Switzerland, or when there is neither time nor budget for the annual duties. ${EHRLICH}` },
  ],
  paket: "global_struktur",
  weiter: ["/en/business/knowledge/us-llc-tax", "/en/business/knowledge/llc-vs-gmbh", "/en/business/knowledge/us-llc-german-resident", "/en/business/package-finder"],
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
