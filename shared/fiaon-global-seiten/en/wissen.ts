// ═══════════════════════════════════════════════════════════════════════════
// FIAON GLOBAL — WISSEN AUF ENGLISCH (24.09.2026, E-234)
// Die englischen Schwestern von ../wissen.ts: die Übersicht /en/business/knowledge
// und sechs Beiträge (Steuern, LLC oder Corporation, LLC oder GmbH, Form 5472,
// Bundesstaat, Anbieter prüfen). Britisches Englisch, dieselben Bausteine in
// derselben Reihenfolge, dieselben Anker (ids bleiben deutsch), dieselben Quellen
// mit englischen Titeln (QUELLEN_RECHT_EN). Der Mythos „tax-free" steht nur in
// Anführungszeichen — nie als Aussage; ein Steuermodell ist die US-Gesellschaft
// auch auf Englisch nicht.
// ═══════════════════════════════════════════════════════════════════════════
import { GLOBAL_KAPITAL_FREI, GLOBAL_PFLICHTHINWEIS, GLOBAL_ROLLEN } from "../../fiaon-global";
// E-509 (12.11.2026): ONE product instead of four packages — the partner sentence without “package”.
import { EIN_PRODUKT } from "../ein-produkt";
// E-510 (13.11.2026, language guide): fixed sentences from the one source (S2: applications, accounts and cards).
import { SCHRITTE_KOPF, SECHS_SCHRITTE, beleg, satz } from "../../fiaon-global-saetze";
import { GLOBAL_VERBUNDEN_EN } from "../../fiaon-global-partner";
import { FAKTEN_STAND_EN, IRS_EN, QUELLEN_IRS_EN, QUELLEN_RECHT_EN, QUELLEN_STAATEN_EN } from "../fakten-en";
import type { GlobalSeite } from "../typen";
import { bundesstaatWahlSeite } from "../bundesstaat-wahl";

/** Date of first publication (E-234). */
const ERSCHIENEN = "2026-09-24";
/** Date of the last change in substance (E-510, language guide). */
const S = "2026-11-13";
const QUELLE_AO10 = QUELLEN_RECHT_EN.ao10;
const QUELLE_AO138 = QUELLEN_RECHT_EN.ao138;
const QUELLE_KSTG1 = QUELLEN_RECHT_EN.kstg1;
const QUELLE_BMF = QUELLEN_RECHT_EN.bmf;
const QUELLE_DBG50 = QUELLEN_RECHT_EN.dbg50;
const QUELLE_ASTG = QUELLEN_RECHT_EN.astg7;
const QUELLE_GMBHG5 = QUELLEN_RECHT_EN.gmbhg5;
const QUELLE_I1120 = QUELLEN_RECHT_EN.i1120;
// 27.10.2026: Austria as a full column in "What applies where" — the same URLs as ../wissen.ts, English titles.
const RIS = "https://www.ris.bka.gv.at/NormDokument.wxe?Abfrage=Bundesnormen";
const QUELLE_BAO27 = { titel: "Section 27 Austrian Federal Fiscal Code (BAO) — registered office and place of management", url: `${RIS}&Gesetzesnummer=10003940&Paragraf=27` };
const QUELLE_KSTG_AT1 = { titel: "Section 1 Austrian Corporate Income Tax Act 1988 (KStG) — unlimited tax liability", url: `${RIS}&Gesetzesnummer=10004569&Paragraf=1` };
const QUELLE_EAS1159 = { titel: "Austrian Federal Ministry of Finance, EAS 1159 of 31 October 1997 — classification of the US LLC", url: "https://findok.bmf.gv.at/findok/resources/pdf/09ba647c-ba5c-473d-a01f-1bcf7b2fbf89/14179.1.X.X.pdf" };
const QUELLE_BAO120 = { titel: "Section 120 Austrian Federal Fiscal Code (BAO) — notification duties", url: `${RIS}&Gesetzesnummer=10003940&Paragraf=120` };
const QUELLE_BAO121 = { titel: "Section 121 Austrian Federal Fiscal Code (BAO) — time limit for notifications", url: `${RIS}&Gesetzesnummer=10003940&Paragraf=121` };
const QUELLE_KSTG_AT10A = { titel: "Section 10a Austrian Corporate Income Tax Act 1988 (KStG) — passive income of low-taxed corporations", url: `${RIS}&Gesetzesnummer=10004569&Paragraf=10a` };
const QUELLE_DBG49 = { titel: "Art. 49 Swiss Federal Direct Tax Act (DBG) — legal entities, foreign entities treated as equivalent", url: "https://www.fedlex.admin.ch/eli/cc/1991/1184_1184_1184/de#art_49" };
const QUELLE_DBG52 = { titel: "Art. 52 Swiss Federal Direct Tax Act (DBG) — scope of tax liability", url: "https://www.fedlex.admin.ch/eli/cc/1991/1184_1184_1184/de#art_52" };
const QUELLE_DBG124 = { titel: "Art. 124 Swiss Federal Direct Tax Act (DBG) — tax return", url: "https://www.fedlex.admin.ch/eli/cc/1991/1184_1184_1184/de#art_124" };

const KAPITAL = `${GLOBAL_KAPITAL_FREI.en.satz} ${GLOBAL_KAPITAL_FREI.en.steuer}`;
// Second pass under the language guide (knowledge articles): every article explains and holds true without us. Each article
// carries exactly one paragraph about us, at the end (“What FIAON Global handles”, with “Your part” and “Condition”), built
// from the fixed sentences.
/** Step one of the fixed narrative (formation) and the names of its parts — verbatim from the one source. */
const [GRUENDUNG] = SECHS_SCHRITTE.en;
const TEIL = SCHRITTE_KOPF.en.teile;
/** Heading of the one paragraph about us. */
const FIAON_TITEL = "What FIAON Global handles";
/** Responsibility for tax questions — as a role, never as a partner’s activity. */
const STEUERFRAGEN = "Tax questions rest with partner tax advisers acting in their own professional capacity.";
/** The second sentence of the roles sentence: who bears the partners’ fees. */
const [, HONORARE_DER_PARTNER] = EIN_PRODUKT.en.partner.split(/(?<=\.)\s+/);
/** The paragraph about us in the two legal-form articles: formation, your part, condition, responsibility for tax questions. */
const FIAON_GRUENDUNG = `${FIAON_TITEL}: ${GRUENDUNG.satz} ${TEIL.ihrTeil}: ${GRUENDUNG.ihrTeil} ${TEIL.bedingung}: ${GRUENDUNG.bedingung} ${STEUERFRAGEN}`;
/** The fixed sentences on applications, accounts and cards and on the tax scheme — fetched once each, verbatim everywhere. */
const ANTRAEGE = satz("S2", "en");
const KEIN_STEUERMODELL = satz("S10", "en");

export const WISSEN_EN: GlobalSeite[] = [
  // ─────────────────────────────────────────────────────────────────────────
  {
    pfad: "/en/business/knowledge",
    sprache: "en",
    schwester: "/business/wissen",
    art: "hub",
    seo: {
      titel: "US LLC guide: formation, EIN, bank account — FIAON Global",
      beschreibung: "28 articles on US companies: LLC, EIN and ITIN, address, bank account, credit score, business credit cards, financing, tax — with sources and dates.",
    },
    // 13.11.2026 (E-510): wording as in the language guide — sources and dates instead of assurances, “financing” instead of jargon.
    stand: "2026-11-13",
    erschienen: ERSCHIENEN,
    kennung: "FG · 22",
    auge: "Knowledge",
    h1: "What to know before formation.",
    h1b: "Stated plainly, with sources.",
    lead: "The articles explain the US company for business owners from Germany, Austria and Switzerland: formation, tax identification numbers and ongoing obligations. Every article cites its sources, states its as-of date and names the limits of the legal form.",
    ziffern: [
      { wert: "28 articles", label: "Formation, tax numbers, account, cards, financing, tax" },
      { wert: "3 states", label: "Delaware, Florida, Wyoming" },
      { wert: FAKTEN_STAND_EN, label: "all figures as of this date" },
    ],
    blick: [
      ["Formation", "The ten-step guide, state, legal form, structure"],
      ["Tax numbers", "EIN without an SSN, ITIN with Form W-7"],
      ["US presence", "Registered agent, business address, phone number"],
      ["Account and cards", "Documents, credit score, business credit, business credit cards, financing, property"],
      ["Tax", "Tax liability in your country of residence, Form 5472, the US tax return"],
      ["Providers", "The checklist in eight points"],
      ["Editorial team", "FIAON Global — sources at the end of every article"],
    ],
    kurz: `A US company serves business in the US and the financing of your plans. ${KAPITAL} ${KEIN_STEUERMODELL} If the company is managed from your country of residence, it is generally taxable there. You report the formation to the tax office; in the US, the company files Form 5472 every year. The articles explain the process from formation to the tax return.`,
    bloecke: [
      {
        typ: "verzeichnis", id: "gruendung", h2: "Before formation",
        eintraege: [
          { pfad: "/en/business/knowledge/form-a-us-llc", tag: "Guide" },
          { pfad: "/en/business/knowledge/choosing-a-state", tag: "State" },
          { pfad: "/en/business/knowledge/llc-vs-corporation", tag: "Legal form" },
          { pfad: "/en/business/knowledge/llc-vs-gmbh", tag: "Legal form" },
          { pfad: "/en/business/knowledge/subsidiary-or-branch", tag: "Structure" },
          { pfad: "/en/business/knowledge/checking-providers", tag: "Providers" },
          { pfad: "/en/business/knowledge/us-market-entry", tag: "Market entry" },
          { pfad: "/en/business/knowledge/us-llc-disadvantages", tag: "Trade-offs" },
        ],
      },
      {
        typ: "verzeichnis", id: "steuernummern", h2: "Tax numbers and US presence",
        eintraege: [
          { pfad: "/en/business/knowledge/applying-for-an-ein", tag: "Tax number" },
          { pfad: "/en/business/knowledge/applying-for-an-itin", tag: "Tax number" },
          { pfad: "/en/business/knowledge/registered-agent-address", tag: "US presence" },
          { pfad: "/en/business/knowledge/us-address-and-phone", tag: "US presence" },
        ],
      },
      {
        typ: "verzeichnis", id: "konto-karten", h2: "Account, credit history, cards and financing",
        eintraege: [
          { pfad: "/en/business/knowledge/us-bank-account-documents", tag: "Account" },
          { pfad: "/en/business/knowledge/building-us-credit", tag: "Credit history" },
          { pfad: "/en/business/knowledge/us-business-credit", tag: "Business credit" },
          { pfad: "/en/business/knowledge/us-business-credit-card", tag: "Business credit cards" },
          { pfad: "/en/business/knowledge/us-financing-routes", tag: "Financing" },
          { pfad: "/en/business/knowledge/financing-us-property", tag: "Property" },
        ],
      },
      {
        typ: "verzeichnis", id: "funding", h2: "Financing in the United States",
        eintraege: [
          { pfad: "/en/business/knowledge/us-funding-for-foreign-owned-companies", tag: "Overview" },
          { pfad: "/en/business/knowledge/credit-card-stacking", tag: "Warning signs" },
          { pfad: "/en/business/knowledge/sba-loans-non-us-citizens", tag: "SBA" },
        ],
      },
      {
        typ: "verzeichnis", id: "steuern", h2: "Tax and obligations",
        eintraege: [
          { pfad: "/en/business/knowledge/us-llc-tax", tag: "Tax" },
          { pfad: "/en/business/knowledge/llc-tax-returns", tag: "Tax return" },
          { pfad: "/en/business/knowledge/form-5472", tag: "Reporting duty" },
          { pfad: "/en/business/knowledge/us-llc-german-resident", tag: "Germany" },
        ],
      },
      {
        typ: "verzeichnis", id: "praxis", h2: "Selling, visas, existing companies",
        eintraege: [
          { pfad: "/en/business/knowledge/amazon-stripe-paypal-us-llc", tag: "Platforms" },
          { pfad: "/en/business/knowledge/e2-visa-own-us-company", tag: "Visa" },
          { pfad: "/en/business/knowledge/reinstate-or-dissolve-us-llc", tag: "Existing LLC" },
        ],
      },
      {
        typ: "verzeichnis", id: "staaten", h2: "The states",
        eintraege: [
          { pfad: "/en/business/florida", tag: "State" },
          { pfad: "/en/business/delaware", tag: "State" },
          { pfad: "/en/business/wyoming", tag: "State" },
        ],
      },
      {
        typ: "verzeichnis", id: "laender", h2: "By home country",
        eintraege: [
          { pfad: "/en/business/from-germany", tag: "Germany" },
          { pfad: "/en/business/from-switzerland", tag: "Switzerland" },
          { pfad: "/en/business/from-austria", tag: "Austria" },
          { pfad: "/en/business/partners", tag: "Locations" },
        ],
      },
      {
        typ: "pakete", id: "mandat", h2: EIN_PRODUKT.en.karteH2,
        lead: `Every article describes a task. Under one engagement, FIAON Global handles the formation, the EIN and ITIN applications and the US presence. The first year also includes the compliance calendar and the first annual US filing. On accounts and cards: ${ANTRAEGE} ${EIN_PRODUKT.en.partner}`,
      },
    ],
    fragen: [],
    weiter: ["/en/business/us-company-formation", "/en/business/costs", "/en/business/faq", "/en/business/process"],
  },

  // ─────────────────────────────────────────────────────────────────────────
  {
    pfad: "/en/business/knowledge/us-llc-tax",
    sprache: "en",
    schwester: "/business/wissen/us-llc-steuern",
    art: "wissen",
    seo: {
      titel: "US LLC tax in Germany: what applies where — FIAON Global",
      beschreibung: "US LLC and tax: where the company is taxable, how the tax office classifies it and which reporting duties apply. With sources and as-of date.",
    },
    // 27.10.2026: "What applies where" with Austria as a column of its own (sources RIS, Findok, Fedlex).
    // 13.11.2026 (E-510): wording as in the language guide; tax questions rest with partner tax advisers acting in their own professional capacity.
    stand: "2026-11-13",
    erschienen: ERSCHIENEN,
    kennung: "FG · 23",
    auge: "Knowledge · Tax",
    h1: "US LLC and tax.",
    h1b: "Generally taxable where it is managed.",
    lead: "US LLC and tax: what usually counts is the place from which the company is managed. For business owners who live in Germany, Austria or Switzerland and work from there, that place is generally their country of residence. This article sets out the rules for each country, the reporting duties and the purpose of a US company.",
    ziffern: [
      { wert: "§ 10 AO", label: "The place of management decides" },
      { wert: "Art. 50 DBG", label: "place of effective management in Switzerland" },
      { wert: "Form 5472", label: "annual filing with the IRS" },
    ],
    blick: [
      ["Principle", "As a rule, taxable where the company is managed"],
      ["Germany", "Place of management (§ 10 AO), classification (Typenvergleich), § 138 AO"],
      ["Switzerland", "Registered office or place of effective management (Art. 50 DBG)"],
      ["US", "Form 5472 filing duty, even without revenue"],
      ["Purpose", "Business, contracts, account and cards in the US"],
      ["Financing", GLOBAL_KAPITAL_FREI.en.kurz],
      ["Tax questions", "To be clarified with a tax adviser before formation"],
    ],
    kurz: `As a rule, a US LLC is taxable where it is managed. If you manage it from your country of residence, its place of management is there — in Swiss terms, its place of effective management. Reporting duties apply in your country of residence and in the US. ${KEIN_STEUERMODELL} The company serves business in the US and the financing of your plans. ${KAPITAL}`,
    bloecke: [
      {
        typ: "text", id: "mythos", h2: "Tax treatment in the US",
        absaetze: [
          "In the US, an LLC with a single foreign shareholder (member) is usually not treated as a separate taxable entity. If it has no business there, it often pays no federal tax on its profit in the US. States such as Wyoming also levy no corporate income tax of their own.",
          "This is the origin of the claim that a US LLC is “tax-free”. The claim describes the position in the US only. The country in which the business owner lives and works applies its own rules. Those rules look to the place from which the company is actually managed.",
        ],
      },
      {
        typ: "text", id: "deutschland", h2: "Germany: the place of management",
        absaetze: [
          "Under section 10 of the German Fiscal Code (AO), the place of management is the centre of the company’s top-level commercial direction. Anyone who takes the important decisions for their US company in Germany has its place of management in Germany. A corporation within the meaning of German tax law (Kapitalgesellschaft) with its place of management in Germany is subject to unlimited corporate income tax there. This covers all of its income (section 1 of the German Corporate Income Tax Act, KStG).",
          "The tax office treats the LLC either like a GmbH or like a partnership. This follows from a comparison with German legal forms (Typenvergleich), based on the overall picture of its features (letter from the German Federal Ministry of Finance of 19 March 2004). Its classification in the US plays no role. For low-taxed, passive income, the controlled foreign company rules (Hinzurechnungsbesteuerung) under the German Foreign Tax Act (AStG) may also apply.",
          "There is also the notification under section 138 of the German Fiscal Code (AO). You report the formation of the company or the acquisition of the shareholding to the tax office, together with the tax return.",
        ],
      },
      {
        typ: "text", id: "schweiz", h2: "Switzerland and Austria",
        absaetze: [
          "In Switzerland, legal entities are taxable if their registered office or their place of effective management is located there (Art. 50 of the Swiss Federal Direct Tax Act, DBG). Anyone who manages the US company from Switzerland must expect to be taxable in Switzerland.",
          "Austria likewise looks to the place of management. In all three countries, the same factor is therefore decisive: the place from which the company is actually managed.",
        ],
      },
      {
        typ: "tabelle", id: "uebersicht", h2: "What applies where",
        kopf: ["", "US", "Germany", "Austria", "Switzerland"],
        zeilen: [
          ["Connecting factor (place of management)", "Legal form and business in the US", "Place of management: the centre of top-level commercial direction (§ 10 AO)", "Place of management: the centre of top-level commercial direction (§ 27(2) BAO)", "Registered office or place of effective management in Switzerland (Art. 50 DBG)"],
          ["Unlimited tax liability of the company", "without business in the US, often no federal tax on the profit", "Place of management or registered office in Germany: on all income (§ 1 KStG)", "Place of management or registered office in Austria: on all domestic and foreign income (§ 1(2) KStG 1988)", "Registered office or place of effective management in Switzerland: unlimited, but not covering businesses, permanent establishments and real estate abroad (Art. 52(1) DBG)"],
          ["Classification of the LLC", "usually not a separate taxable entity", "Typenvergleich (comparison with German legal forms) based on the overall picture; the US classification plays no role (letter of 19 March 2004)", "Typenvergleich based on structure and economic role; the treatment in the US is not decisive (Austrian Ministry of Finance, EAS 1159)", "treated as equivalent to the Swiss legal entity it most closely resembles in law or in fact (Art. 49(3) DBG)"],
          ["Reporting the shareholding", "Form 5472 with Form 1120, annually", "Report the formation or acquisition to the tax office, with the tax return (§ 138(2) and (5) AO)", "Notify circumstances that establish or change personal tax liability within one month (§§ 120, 121 BAO); whether the shareholding is covered is to be checked case by case", "File the tax return in full, with the required enclosures (Art. 124(2) DBG); a separate report is to be checked case by case"],
          ["Attribution of low-taxed companies' income", "to be checked case by case", "only if the company has neither its place of management nor its registered office in Germany: low-taxed, passive income is taxable in the hands of the controlling shareholder (§ 7 AStG)", "Passive income of low-taxed foreign corporations is attributed to a controlling corporation (§ 10a KStG 1988); for individuals, to be checked case by case", "to be checked case by case"],
          ["Who reviews it", "US CPA", "Tax adviser", "Tax adviser", "Fiduciary or tax adviser"],
        ],
        fuss: [
          "Simplified overview; in the individual case, the activity, the legal form and the double taxation agreement decide.",
          "The row on unlimited tax liability assumes that the LLC is classified as a corporation or legal entity. In all three countries, this is decided by comparison with domestic legal forms.",
        ],
      },
      {
        typ: "karten", id: "wofuer", h2: "What a US company is for", spalten: 3,
        karten: [
          { tag: "Suited to", titel: "Business in the US", text: "Contracts with US customers, payments in US dollars and separate liability. Added to these are a US account and a payment record in the United States. The decision on the account rests with the institution concerned." },
          { tag: "Suited to", titel: "Financing — for Europe too", text: `${satz("S1", "en")} ${KAPITAL}` },
          { tag: "Not suited to", titel: "Avoiding tax in your country of residence", text: "If the company is managed from your country of residence, it is generally taxable there. The claim “tax-free” leaves the place of management out of account." },
        ],
      },
      {
        typ: "hinweis", id: "wissen", h2: "What you need to know",
        punkte: [
          "This article explains the basics and does not replace a tax or legal review of your case.",
          GLOBAL_PFLICHTHINWEIS.en[0],
          GLOBAL_PFLICHTHINWEIS.en[1],
          `${FIAON_TITEL}: ${STEUERFRAGEN} ${HONORARE_DER_PARTNER} ${TEIL.ihrTeil}: Your tax return and the report in your country of residence remain with you and your own tax adviser. ${TEIL.bedingung}: The US tax authority and the tax office in your country of residence decide on taxation.`,
        ],
      },
    ],
    fragen: [
      { f: "Do I have to pay tax on my US LLC in Germany?", a: "As a rule yes, if you manage the company from Germany. Its place of management is then in Germany (§ 10 AO). How the tax office classifies the LLC is decided by a comparison with German legal forms (Typenvergleich)." },
      { f: "Is a Wyoming LLC “tax-free”?", a: "Wyoming levies no corporate income tax of its own. The company is taxable where it is managed. For business owners from Germany, Austria or Switzerland, that is generally the country of residence." },
      { f: "Why is the US LLC often described as “tax-free”?", a: "An LLC with a foreign shareholder often pays no federal tax in the US. That holds for the US. Tax liability in the country of residence depends on the place of management." },
      { f: "What is a US company suited to?", a: `Business in the US: contracts with US customers, payments in US dollars and separate liability. Added to these are a US account, a payment record in the United States and the financing of your plans. Decisions on accounts, cards and financing rest with the institution concerned. ${KAPITAL}` },
    ],
    weiter: ["/en/business/from-germany", "/en/business/from-switzerland", "/en/business/knowledge/form-5472", "/en/business/knowledge/llc-tax-returns"],
    quellen: [
      QUELLE_AO10, QUELLE_KSTG1, QUELLE_BMF, QUELLE_ASTG, QUELLE_AO138,
      QUELLE_BAO27, QUELLE_KSTG_AT1, QUELLE_EAS1159, QUELLE_BAO120, QUELLE_BAO121, QUELLE_KSTG_AT10A,
      QUELLE_DBG49, QUELLE_DBG50, QUELLE_DBG52, QUELLE_DBG124,
      QUELLEN_IRS_EN[4],
    ],
  },

  // ─────────────────────────────────────────────────────────────────────────
  {
    pfad: "/en/business/knowledge/llc-vs-corporation",
    sprache: "en",
    schwester: "/business/wissen/llc-oder-corporation",
    art: "wissen",
    seo: {
      titel: "LLC vs C corp: which one fits your plans? — FIAON Global",
      beschreibung: "LLC or C corporation compared: liability, taxation, investors, formalities and running costs. With sources and as-of date.",
    },
    stand: S,
    erschienen: ERSCHIENEN,
    kennung: "FG · 24",
    auge: "Knowledge · Legal form",
    h1: "LLC or corporation.",
    h1b: "Same liability, different taxation.",
    lead: "LLC or corporation: both legal forms limit liability. They differ in taxation, in their internal organisation and in their suitability for investors. The choice affects the account and cards, the filings and later equity stakes.",
    ziffern: [
      { wert: IRS_EN.koerperschaftsteuer, label: "Federal corporate income tax for corporations" },
      { wert: "2 forms", label: "both with limited liability" },
      { wert: "before formation", label: "clarify the tax consequences in your country of residence" },
    ],
    blick: [
      ["LLC", "Freely structured, usually not a separate taxable entity in the US"],
      ["Corporation", "Separate taxable entity, the usual form for investors"],
      ["Liability", "Limited to the company’s assets in both cases"],
      ["Investors", "Generally expect a corporation"],
      ["Switching", "Possible later, with effort in both countries"],
      ["Tax questions", "To be clarified with a tax adviser before formation"],
    ],
    kurz: `LLC or corporation: for trading, services and a payment record in the United States, the LLC usually fits. The corporation is the usual form when you plan to bring in investors or give employees shares. The LLC sets its internal organisation freely in the operating agreement, its constitution. With a foreign shareholder (member), it is usually not a separate taxable entity in the US. The corporation is a separate taxable entity and pays ${IRS_EN.koerperschaftsteuer} federal corporate income tax.`,
    bloecke: [
      {
        typ: "tabelle", id: "vergleich", h2: "LLC and corporation compared",
        kopf: ["", "LLC", "Corporation"],
        zeilen: [
          ["Liability", "limited to the company’s assets", "limited to the company’s assets"],
          ["Tax in the US", "with a foreign shareholder, usually not a separate taxable entity", `separate taxable entity, federal ${IRS_EN.koerperschaftsteuer}, plus state tax depending on the state`],
          ["Internal organisation", "operating agreement, freely drafted", "bylaws, board of directors, shares under fixed rules"],
          ["Investors", "rare", "usual"],
          ["Employee participation", "possible, but unusual", "common through stock options"],
          ["Annual filing with the IRS", "Form 5472 with Form 1120 (as a cover sheet)", "Form 1120; if a foreign shareholder holds at least 25%, Form 5472 as well"],
          ["Running costs", "lower", "higher, for example because of the Delaware Franchise Tax"],
        ],
        fuss: ["Simplified overview; classification in the country of residence follows its own rules."],
      },
      {
        typ: "karten", id: "wann", h2: "When each form fits", spalten: 2,
        karten: [
          { tag: "LLC", titel: "Trading, services, payment record", text: "Usually suitable if the company handles orders, sells goods or builds a payment record in the United States and no investors are planned." },
          { tag: "Corporation", titel: "Investors, equity stakes, sale", text: "Usually suitable if US investors are to come in, employees are to receive shares or the business is to be sold later." },
        ],
      },
      {
        typ: "text", id: "wechsel", h2: "Switching legal form later",
        absaetze: [
          "An LLC can be converted into a corporation. The switch costs time and fees; the tax position must also be clarified in both countries. One question therefore belongs before formation: who is to hold a stake in the company in three years’ time.",
        ],
      },
      {
        typ: "hinweis", id: "wissen", h2: "What you need to know",
        punkte: [
          "The choice of legal form has tax consequences in your country of residence. These questions belong with a tax adviser before formation.",
          GLOBAL_PFLICHTHINWEIS.en[1],
          FIAON_GRUENDUNG,
        ],
      },
    ],
    fragen: [
      { f: "What is the difference between an LLC and a corporation?", a: `Both limit liability. The LLC is freely structured and, with a foreign shareholder, usually not a separate taxable entity in the US. The corporation is a separate taxable entity (federal ${IRS_EN.koerperschaftsteuer}) and the usual form for investors.` },
      { f: "Which legal form do I need for US investors?", a: "Generally a corporation, often in Delaware. Investors in the US know this form and expect it." },
      { f: "Can I convert an LLC into a corporation later?", a: "Yes. The switch involves fees, new documents and clarification of the tax position in both countries." },
    ],
    weiter: ["/en/business/delaware", "/en/business/knowledge/llc-vs-gmbh", "/en/business/us-company-formation", "/en/business/knowledge/form-a-us-llc"],
    quellen: [QUELLE_I1120, QUELLEN_IRS_EN[4], QUELLEN_STAATEN_EN.delaware[3]],
  },

  // ─────────────────────────────────────────────────────────────────────────
  {
    pfad: "/en/business/knowledge/llc-vs-gmbh",
    sprache: "en",
    schwester: "/business/wissen/llc-oder-gmbh",
    art: "wissen",
    seo: {
      titel: "US LLC vs GmbH: the comparison — FIAON Global",
      beschreibung: "US LLC or German GmbH compared: formation, share capital, notary, liability, tax and obligations. Plus the usual structure combining both, with sources.",
    },
    stand: S,
    erschienen: ERSCHIENEN,
    kennung: "FG · 25",
    auge: "Knowledge · Legal form",
    h1: "LLC or GmbH.",
    h1b: "Two legal forms for two markets.",
    lead: "LLC or GmbH: the LLC is formed without a notary and without minimum capital, the GmbH with both. The GmbH is designed for business in Germany, the LLC for business in the US. In many cases the GmbH is the shareholder of the LLC.",
    ziffern: [
      { wert: "€25,000", label: "Share capital of a GmbH (§ 5 GmbHG)" },
      { wert: "no", label: "minimum capital and no notary for the LLC" },
      { wert: "often both", label: "the GmbH as shareholder of the LLC" },
    ],
    blick: [
      ["GmbH", "Notary, commercial register, €25,000 share capital"],
      ["LLC", "Filing with the state, no minimum capital"],
      ["Liability", "Limited to the company’s assets in both cases"],
      ["Tax", "Both taxed where they are managed"],
      ["Usual structure", "GmbH in Germany, LLC as the US subsidiary"],
      ["Tax questions", "To be clarified with a tax adviser before formation"],
    ],
    kurz: "LLC or GmbH: the GmbH is formed with a notary and entry in the commercial register and needs €25,000 in share capital. The LLC is formed by filing with the state, with neither a notary nor minimum capital. Both limit liability. Both are taxable where they are managed. Businesses operating in both countries usually combine the two: the GmbH in Germany is the shareholder of the LLC in the US.",
    bloecke: [
      {
        typ: "tabelle", id: "vergleich", h2: "GmbH and LLC compared",
        kopf: ["", "GmbH", "US LLC"],
        zeilen: [
          ["Formation", "notary and commercial register", "filing with the state"],
          ["Minimum capital", "€25,000, at least half paid in on formation", "none"],
          ["Constitution", "articles of association, notarised", "operating agreement, in writing, without a notary"],
          ["Liability", "limited to the company’s assets", "limited to the company’s assets"],
          ["Tax", "where it is managed", "where it is managed — plus US reporting duties"],
          ["Annually", "annual financial statements, publication", "state fee, registered agent, Form 5472"],
          ["Designed for", "business in Germany", "business in the US"],
        ],
        fuss: ["Simplified overview. The entrepreneurial company (UG) has its own rules on share capital."],
      },
      {
        typ: "text", id: "struktur", h2: "The usual structure: GmbH and LLC",
        absaetze: [
          "Anyone who runs a business in Germany and is building business in the US generally forms an LLC under the GmbH. The GmbH is the shareholder. The LLC enters into contracts in the US, holds the US account and builds a payment record there. The decision on the account rests with the institution concerned.",
          "This keeps the liability and the figures of the US business separate. For tax purposes, what matters is where the LLC is managed and how the tax office classifies it. These questions belong with a tax adviser before formation. If a GmbH owns a Florida LLC, the GmbH also files its own tax return in Florida.",
        ],
      },
      {
        typ: "hinweis", id: "wissen", h2: "What you need to know",
        punkte: [
          "The GmbH remains the form for business in Germany, the LLC the form for business in the US.",
          GLOBAL_PFLICHTHINWEIS.en[0],
          "The GmbH reports its shareholding in the LLC to the tax office under section 138 of the German Fiscal Code (AO).",
          FIAON_GRUENDUNG,
        ],
      },
    ],
    fragen: [
      { f: "Is an LLC the same as a GmbH?", a: "Not quite. Both limit liability. The LLC needs neither a notary nor minimum capital, and its constitution, the operating agreement, can be drafted freely." },
      { f: "Can my GmbH form a US LLC?", a: "Yes. The GmbH becomes the shareholder of the LLC. The documents then include the GmbH’s commercial register extract and the passports of its managing directors. If you request your proposal via the fee calculator, you personally become the shareholder. If your GmbH, AG or holding company is to hold the shares, we agree this with you in a call." },
      { f: "Does an LLC pay less tax than a GmbH?", a: "As a rule, no. Both are taxable where they are managed. The LLC also brings reporting duties in the US." },
    ],
    weiter: ["/en/business/us-subsidiary", "/en/business/knowledge/llc-vs-corporation", "/en/business/knowledge/subsidiary-or-branch", "/en/business/knowledge/us-llc-tax"],
    quellen: [QUELLE_GMBHG5, QUELLE_AO10, QUELLE_AO138, QUELLEN_STAATEN_EN.florida[4]],
  },

  // ─────────────────────────────────────────────────────────────────────────
  {
    pfad: "/en/business/knowledge/form-5472",
    sprache: "en",
    schwester: "/business/wissen/form-5472",
    art: "wissen",
    seo: {
      titel: "Form 5472 for LLCs: deadline, penalty, filing — FIAON Global",
      beschreibung: "Form 5472 with a pro forma Form 1120: who must file, what to report, the 15 April deadline, the $25,000 penalty — required even without revenue.",
    },
    stand: S,
    erschienen: ERSCHIENEN,
    kennung: "FG · 26",
    auge: "Knowledge · Reporting duty",
    h1: "Form 5472.",
    h1b: "An annual filing, even without revenue.",
    lead: "With Form 5472, a US company reports its transactions with its foreign shareholder to the US tax authority, the IRS, every year. A Form 1120 serves as the cover sheet. The filing is required even without revenue; the IRS can impose a penalty if it is missed.",
    ziffern: [
      { wert: "15 April", label: "Deadline, extendable to 15 October with Form 7004" },
      { wert: "$25,000", label: "Penalty per form per year" },
      { wert: "Fax or post", label: "not electronic" },
    ],
    blick: [
      ["Who", "US company that has a foreign shareholder and is not a separate taxable entity"],
      ["What", "Form 5472 with a pro forma Form 1120"],
      ["Reportable", "Contributions, withdrawals, loans, payments — including the contribution on formation"],
      ["Deadline", IRS_EN.frist5472],
      ["Filing", "By fax or post, not electronically"],
      ["Penalty", `${IRS_EN.strafe5472}, further amounts after a notice`],
    ],
    kurz: `Form 5472 reports the transactions between a US company and its foreign shareholder to the IRS. An LLC that is not a separate taxable entity files it with a pro forma Form 1120. The deadline is 15 April, extendable to 15 October; the filing goes to the IRS by fax or post. Even the contribution on formation is reportable. For a missing filing, the IRS can impose ${IRS_EN.strafe5472}.`,
    bloecke: [
      {
        typ: "text", id: "wer", h2: "Who must file",
        absaetze: [
          "A separate rule has applied since 2017 to US LLCs with a single foreign shareholder (member). If the LLC is not regarded as a separate taxable entity, it is treated like a corporation for this filing. Every year it files Form 5472 together with a Form 1120. That form shows only its name, address and EIN, the company’s tax identification number, and is known as the pro forma Form 1120.",
          "Corporations with a foreign shareholder also report on Form 5472, in their case as an attachment to their regular tax return.",
        ],
      },
      {
        typ: "text", id: "was", h2: "What must be reported",
        absaetze: ["The company reports its transactions with its foreign shareholder or with persons related to that shareholder, for example:"],
        punkte: [
          "the contribution on formation and every further contribution",
          "withdrawals and distributions",
          "loans in either direction",
          "payments for services, goods or rights",
        ],
        nach: "Even the contribution on formation counts. As a rule, the filing is therefore due in the first year, even without revenue. The company must also keep records that document these transactions.",
      },
      {
        typ: "etappen", id: "ablauf", h2: "The filing process",
        etappen: [
          { titel: "Records", text: "The company records contributions, withdrawals and payments throughout the year, each with a supporting document." },
          { titel: "Preparation by the US CPA", text: "A US certified public accountant (CPA) prepares Form 5472 and the pro forma Form 1120 from these records." },
          { titel: "Filing", text: "By 15 April, by fax or post to the IRS; extendable to 15 October with Form 7004." },
          { titel: "Record-keeping", text: "A copy and the proof of filing form part of the company’s records." },
        ],
      },
      {
        typ: "hinweis", id: "strafe", h2: "Penalties for a missed filing",
        punkte: [
          `For a missing or substantially incomplete filing, the IRS can impose ${IRS_EN.strafe5472}. The same applies if the required records are missing.`,
          "If the filing is still outstanding more than ninety days after a notice from the IRS, a further $25,000 is added for each additional period of thirty days.",
          `${FIAON_TITEL}: The first year of your engagement includes the first annual US filing by a US certified public accountant (CPA) from our partner network. We place a copy and the proof of filing in your portal. ${TEIL.ihrTeil}: You record your company’s contributions, withdrawals and payments with supporting documents. ${TEIL.bedingung}: The IRS decides on extensions and penalties.`,
        ],
      },
    ],
    fragen: [
      { f: "Who has to file Form 5472?", a: "A US company with a foreign shareholder. This includes an LLC that is not a separate taxable entity. It files Form 5472 with a pro forma Form 1120." },
      { f: "Is Form 5472 required if my LLC made no sales?", a: "Yes, as soon as there were reportable transactions. Even the contribution on formation counts." },
      { f: "Can I file Form 5472 electronically?", a: "No. The pro forma Form 1120 with Form 5472 goes to the IRS by fax or post." },
      { f: "What is the penalty for not filing Form 5472?", a: `The IRS can impose ${IRS_EN.strafe5472}. If the failure continues after a notice, further amounts are added.` },
    ],
    weiter: ["/en/business/us-compliance", "/en/business/knowledge/llc-tax-returns", "/en/business/knowledge/us-llc-tax", "/en/business/knowledge/applying-for-an-ein"],
    quellen: [QUELLEN_IRS_EN[4], QUELLEN_IRS_EN[5], QUELLE_I1120],
  },

  // ─────────────────────────────────────────────────────────────────────────
  // E-465 (29.10.2026): FG · 27 entsteht für DE und EN aus shared/fiaon-global-seiten/bundesstaat-wahl.ts
  // (Zeiten, Express, Vor- und Nachteile aus shared/fiaon-global-bundesstaaten.ts).
  bundesstaatWahlSeite("en"),

  // ─────────────────────────────────────────────────────────────────────────
  {
    pfad: "/en/business/knowledge/checking-providers",
    sprache: "en",
    schwester: "/business/wissen/anbieter-pruefen",
    art: "wissen",
    seo: {
      titel: "Is your LLC formation provider reputable? — FIAON Global",
      // E-510 (13.11.2026): “fee” instead of “price”; about ourselves only: fees and services are set out in full before you sign (language guide 5.6 no. 12).
      beschreibung: "How to spot a reputable US formation provider: a contracting party on the register, a fee set in advance, no tax or credit promises, admitted partners.",
    },
    stand: "2026-11-13",
    erschienen: ERSCHIENEN,
    kennung: "FG · 28",
    auge: "Knowledge · Providers",
    h1: "Recognising a reputable LLC provider.",
    h1b: "Eight points before you sign.",
    lead: "Whether an LLC provider is reputable shows in eight points. You can check each of them yourself before you sign. The LLC itself is an ordinary legal form in the US. We apply the same list to ourselves.",
    ziffern: [
      { wert: "8 points", label: "to check before you sign" },
      { wert: "Three registers", label: "Companies House, Zefix, German commercial register" },
      { wert: "Companies House", label: "FIAON LTD, company number 17318250" },
    ],
    blick: [
      ["Register", "Contracting party with a registration number you can check"],
      ["Fee", "Set in advance, with a schedule of services"],
      ["Tax", "Mandatory notices in place of promises"],
      ["Credit", "The institution decides on limits, cards and loans"],
      ["Partners", "Tax advisers and lawyers admitted to practise, in their own professional capacity"],
      ["Connections", "Connected companies are named"],
    ],
    kurz: "You can recognise a reputable LLC provider by features that can be checked before you sign. The contracting party has a registration number you can verify. The fee is set in advance, with a schedule of services. Mandatory notices on tax and filings are stated openly on the website. The provider makes no commitments on tax, cards or credit. Tax and legal questions rest with partners who hold their own professional admission; connected companies are named.",
    bloecke: [
      {
        typ: "etappen", id: "liste", h2: "The eight points",
        etappen: [
          { titel: "Contracting party on the register", text: "Name, legal form, registered office and registration number are in the contract and can be found in the register. Without a contracting party you can verify, there is no basis for a contract." },
          { titel: "Fee and schedule of services in advance", text: "The contract states in writing what is included and what is charged from the second year. Recurring charges that only appear after signing are a warning sign." },
          { titel: "Statements on tax", text: "The claims “tax-free” or “no tax” leave the place of management out of account. A reputable provider names the tax liability in your country of residence and the reporting duties." },
          { titel: "Commitments on cards and loans", text: "The institution concerned decides on the account, the card and the limit. No provider can therefore commit to an amount. A target that you choose yourself is not a commitment." },
          { titel: "Responsibility for tax and legal questions", text: "Tax and legal questions are answered only by tax advisers, US certified public accountants (CPAs) and lawyers admitted to practise, in their own professional capacity. A formation service itself is not permitted to answer them." },
          { titel: "The US obligations", text: "A reputable provider names Form 5472, the state fee and the registered agent before you sign. For a missed filing, the IRS can impose a penalty." },
          { titel: "Access to your money", text: "The account holder is your company. A provider needs no power of attorney over your account and does not accept money on your behalf." },
          { titel: "Connections disclosed", text: "If partners have the same owner as the provider, its website says so openly." },
        ],
      },
      {
        typ: "text", id: "fiaon", h2: "The same list for FIAON Global",
        absaetze: [
          `Your contracting party is FIAON LTD, registered in England and Wales, company number 17318250. Fees and services are set out in full before you sign; we name the running costs from the second year in advance. ${KEIN_STEUERMODELL}`,
          `${ANTRAEGE} ${satz("S1", "en")} ${beleg("keinZugriff", "en")}`,
          EIN_PRODUKT.en.partner,
          GLOBAL_VERBUNDEN_EN,
        ],
      },
      {
        typ: "hinweis", id: "wissen", h2: "What you need to know",
        punkte: [
          "A provider’s legal form says nothing about the way it operates. That applies to the LLC, the Ltd and the GmbH.",
          "Check registration numbers yourself: at Companies House, in Zefix or in the German commercial register (Handelsregister).",
          GLOBAL_PFLICHTHINWEIS.en[2],
        ],
      },
    ],
    fragen: [
      { f: "How can I tell whether a US formation provider is reputable?", a: "By a contracting party with a registration number you can check and by a fee set in advance, with a schedule of services. Added to these are mandatory notices on tax and filings. A reputable provider makes no commitments on tax, cards or credit." },
      { f: "Is an LLC inherently dubious?", a: "No. The LLC is an ordinary legal form in the US. What matters is the way a provider operates, not its legal form." },
      { f: "How do I check FIAON’s registration number?", a: "At Companies House (England and Wales) under company number 17318250." },
    ],
    weiter: ["/en/business/partners", "/en/business/comparison", "/en/business/costs", "/en/business/knowledge/us-business-credit-card"],
    quellen: [
      { titel: "Companies House — FIAON LTD", url: "https://find-and-update.company-information.service.gov.uk/company/17318250" },
      { titel: "Zefix — Swiss Central Business Name Index", url: "https://www.zefix.ch/de/search/entity/welcome" },
    ],
  },
];
