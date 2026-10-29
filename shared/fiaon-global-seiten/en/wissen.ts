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
import { GLOBAL_VERBUNDEN_EN } from "../../fiaon-global-partner";
import { FAKTEN_STAND_EN, IRS_EN, QUELLEN_IRS_EN, QUELLEN_RECHT_EN, QUELLEN_STAATEN_EN } from "../fakten-en";
import type { GlobalSeite } from "../typen";
import { bundesstaatWahlSeite } from "../bundesstaat-wahl";

const S = "2026-09-24";
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

export const WISSEN_EN: GlobalSeite[] = [
  // ─────────────────────────────────────────────────────────────────────────
  {
    pfad: "/en/business/knowledge",
    sprache: "en",
    schwester: "/business/wissen",
    art: "hub",
    seo: {
      titel: "US LLC guide: formation, EIN, bank account — FIAON Global",
      beschreibung: "28 articles on US companies: LLC, EIN and ITIN, address, bank account, credit score, business credit cards, US funding, tax — honest, with sources.",
    },
    stand: "2026-10-27",
    erschienen: S,
    kennung: "FG · 22",
    auge: "Knowledge",
    h1: "What to know before you form a US company.",
    h1b: "Explained honestly, with sources.",
    lead: "What business owners from Germany, Austria and Switzerland should know about a US company: formation, EIN and ITIN, US presence, bank account, cards, tax returns and structure. Every article cites its sources, states its as-of date and also says what a US company cannot do.",
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
      ["Tax", "Tax model or not, Form 5472, the US tax return"],
      ["Providers", "How to recognise reputable support"],
      ["Editorial team", "FIAON Global — sources at the end of every article"],
    ],
    kurz: `A US company is a tool for genuine business in the US and for building capital — not a tax model. ${KAPITAL} Anyone who manages the company from Germany, Austria or Switzerland generally pays tax on it at home, reports it to the tax office and files Form 5472 in the US every year. The articles here explain every step — from formation through tax numbers, account and cards to the tax return.`,
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
        typ: "verzeichnis", id: "funding", h2: "US funding and capital",
        eintraege: [
          { pfad: "/en/business/knowledge/us-funding-for-foreign-owned-companies", tag: "Guide" },
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
        typ: "pakete", id: "pakete", h2: "Everything from a single source",
        lead: "Every article here describes a task. FIAON Global handles all of them — formation, tax numbers, US presence, account and card applications, the compliance calendar and the first US filing, with a partner lawyer, partner tax adviser and US CPA — at a fixed price, with all fees for the services in the package included.",
      },
    ],
    fragen: [],
    weiter: ["/en/business/us-company-formation", "/en/business/costs", "/en/business/faq", "/en/business/package-finder"],
  },

  // ─────────────────────────────────────────────────────────────────────────
  {
    pfad: "/en/business/knowledge/us-llc-tax",
    sprache: "en",
    schwester: "/business/wissen/us-llc-steuern",
    art: "wissen",
    seo: {
      titel: "US LLC tax in Germany: the honest answer — FIAON Global",
      beschreibung: "Can a US LLC reduce your tax? For owners in Germany and Switzerland usually not: place of management, classification, reporting duties — with sources.",
    },
    // 27.10.2026: "What applies where" with Austria as a column of its own (sources RIS, Findok, Fedlex).
    stand: "2026-10-27",
    erschienen: S,
    kennung: "FG · 23",
    auge: "Knowledge · Tax",
    h1: "Does a US LLC reduce your tax?",
    h1b: "The honest answer.",
    lead: "“Tax-free with a US LLC” is one of the most persistent promises on the internet. As a rule, it does not hold true for business owners who live in Germany, Austria or Switzerland and work from there. Here is why — and what a US company is still good for.",
    ziffern: [
      { wert: "§ 10 AO", label: "The place of management decides" },
      { wert: "Art. 50 DBG", label: "place of effective management in Switzerland" },
      { wert: "Form 5472", label: "annual filing with the IRS" },
    ],
    blick: [
      ["In brief", "Managed from home = generally taxable at home"],
      ["Germany", "Place of management (§ 10 AO), classification (Typenvergleich), § 138 AO"],
      ["Switzerland", "Registered office or place of effective management (Art. 50 DBG)"],
      ["US", "Form 5472 filing duty, even without revenue"],
      ["What it is good for", "Business, account, cards and contracts in the US"],
      ["Capital", GLOBAL_KAPITAL_FREI.en.kurz],
      ["Review", "Before any formation, by our partner tax adviser"],
    ],
    kurz: `As a rule, no. A US LLC that a business owner manages from Germany, Austria or Switzerland has its place of management there — in Swiss terms, its place of effective management — and is taxable there. On top of that, there are reporting duties in both countries. A US company is worthwhile for genuine business in the US and for building capital — not for avoiding tax. ${KAPITAL}`,
    bloecke: [
      {
        typ: "text", id: "mythos", h2: "Where the promise comes from",
        absaetze: [
          "In the US, an LLC with a single foreign shareholder (member) is usually not treated as a separate taxable entity for tax purposes. If it has no business there, it often pays no federal tax on its profit in the US. States such as Wyoming also levy no corporate income tax of their own.",
          "Online, this quickly turns into “tax-free”. What gets overlooked is that the country in which the business owner lives and works has its own rules — and they are tied not to the company’s registered office but to where it is actually managed.",
        ],
      },
      {
        typ: "text", id: "deutschland", h2: "Germany: the place of management",
        absaetze: [
          "Under section 10 of the German Fiscal Code (AO), the place of management is the centre of the company’s top-level commercial direction. Anyone who takes the important decisions for their US company at a desk in Germany has its place of management in Germany. A corporation within the meaning of German tax law (Kapitalgesellschaft) whose place of management is in Germany is subject to unlimited corporate income tax there (section 1 of the German Corporate Income Tax Act, KStG) — on all of its income.",
          "Whether the tax office treats the LLC like a GmbH or like a partnership depends on a classification by comparison with German legal forms (Typenvergleich), based on the overall picture of its features (letter from the German Federal Ministry of Finance of 19 March 2004). How it is classified in the US plays no role in this. For low-taxed, passive income, the controlled foreign company rules (Hinzurechnungsbesteuerung) under the German Foreign Tax Act (AStG) may also apply.",
          "Then there is the notification: the formation of the company or the acquisition of the shareholding must be reported to the tax office under section 138 of the German Fiscal Code (AO), together with the tax return.",
        ],
      },
      {
        typ: "text", id: "schweiz", h2: "Switzerland and Austria",
        absaetze: [
          "In Switzerland, legal entities are taxable if their registered office or their place of effective management is located there (Art. 50 of the Swiss Federal Direct Tax Act, DBG). Here too: anyone who manages the US company from Switzerland must expect to be taxable in Switzerland.",
          "Austria likewise looks to the place of management. In all three countries, the same question is therefore decisive: where is the company actually managed?",
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
          "The row on unlimited tax liability assumes that the LLC is classified as a corporation or legal entity; in all three countries, this is decided by comparison with domestic legal forms.",
        ],
      },
      {
        typ: "karten", id: "wofuer", h2: "What a US company is good for", spalten: 3,
        karten: [
          { tag: "Good for", titel: "Business in the US", text: "Contracts with US customers, a US account, payments in US dollars, separate liability, a card history of its own in the US." },
          { tag: "Good for", titel: "Building capital — for Europe too", text: KAPITAL },
          { tag: "Not good for", titel: "Avoiding tax at home", text: "If it is managed from home, it is generally taxable there. Anyone promising “tax-free” is keeping quiet about the place of management." },
        ],
      },
      {
        typ: "hinweis", id: "wissen", h2: "What you need to know",
        punkte: [
          "This article explains the basics. Before formation, our partner tax adviser reviews your case under your engagement — the review is included in the fixed price of every package.",
          GLOBAL_PFLICHTHINWEIS.en[0],
          GLOBAL_PFLICHTHINWEIS.en[1],
        ],
      },
    ],
    fragen: [
      { f: "Do I have to pay tax on my US LLC in Germany?", a: "If you manage it from Germany, as a rule yes: its place of management is then in Germany (§ 10 AO). How the tax office classifies the LLC depends on a comparison with German legal forms (Typenvergleich)." },
      { f: "Is a Wyoming LLC “tax-free”?", a: "Wyoming levies no corporate income tax of its own. However, the company is taxable where it is managed — for business owners from Germany, Austria or Switzerland, that is generally at home." },
      { f: "Why do so many providers advertise a “tax-free” LLC?", a: "Because an LLC with a foreign shareholder often pays no federal tax in the US. That is true for the US, but it says nothing about tax liability in the home country — and that depends on the place of management." },
      { f: "So what is a US company actually good for?", a: `For genuine business in the US — contracts with US customers, a US account, payments in US dollars, separate liability, a card history of its own — and for building capital. ${KAPITAL}` },
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
      beschreibung: "LLC or C corporation: liability, taxation, investors, formalities and costs compared — and when each legal form suits your plans.",
    },
    stand: S,
    erschienen: S,
    kennung: "FG · 24",
    auge: "Knowledge · Legal form",
    h1: "LLC or corporation?",
    h1b: "The choice that shapes everything else.",
    lead: "Both legal forms limit liability. The difference lies in taxation, in the internal organisation and in who will come on board later. The choice shapes the account, the cards, the filings and every investor who comes along.",
    ziffern: [
      { wert: IRS_EN.koerperschaftsteuer, label: "Federal corporate income tax for corporations" },
      { wert: "2 forms", label: "both with limited liability" },
      { wert: "before formation", label: "reviewed by our partner tax adviser" },
    ],
    blick: [
      ["LLC", "Lean, flexible, usually not a separate taxable entity in the US"],
      ["Corporation", "Separate taxable entity, the standard for investors"],
      ["Liability", "Limited to the company’s assets in both cases"],
      ["Investors", "Generally expect a corporation"],
      ["Switching", "Possible later, but with effort"],
      ["Review", "Before formation, included in the fixed price"],
    ],
    kurz: `The LLC is the leaner form: flexibly governed by the operating agreement and, with a foreign shareholder (member), usually not a separate taxable entity in the US. The corporation is a separate taxable entity — subject to ${IRS_EN.koerperschaftsteuer} federal corporate income tax — and the standard when you plan to bring in investors or give employees a stake. For trading, services and building a card history, the LLC is usually the simpler choice.`,
    bloecke: [
      {
        typ: "tabelle", id: "vergleich", h2: "The comparison",
        kopf: ["", "LLC", "Corporation"],
        zeilen: [
          ["Liability", "limited to the company’s assets", "limited to the company’s assets"],
          ["Tax in the US", "with a foreign shareholder, usually not a separate taxable entity", `separate taxable entity, federal ${IRS_EN.koerperschaftsteuer}, plus state tax depending on the state`],
          ["Internal organisation", "operating agreement, freely drafted", "bylaws, board of directors, shares under fixed rules"],
          ["Investors", "rare", "the standard"],
          ["Employee participation", "possible, but unusual", "common through stock options"],
          ["Annual filing with the IRS", "Form 5472 with Form 1120 (as a cover sheet)", "Form 1120; if a foreign shareholder holds at least 25%, Form 5472 as well"],
          ["Running costs", "lower", "higher, for example because of the Delaware Franchise Tax"],
        ],
        fuss: ["Simplified overview; classification in the home country follows its own rules."],
      },
      {
        typ: "karten", id: "wann", h2: "When each form fits", spalten: 2,
        karten: [
          { tag: "LLC", titel: "Trading, services, card history", text: "When the company handles orders, sells goods or is meant to build its own banking and card history — and no investors are planned." },
          { tag: "Corporation", titel: "Investors, equity stakes, sale", text: "When you plan to bring in US investors, give employees shares or sell the business later." },
        ],
      },
      {
        typ: "text", id: "wechsel", h2: "Can you switch later?",
        absaetze: [
          "Yes — an LLC can be converted into a corporation. But the switch costs time, fees and a tax review in both countries. That is why it pays to ask the question seriously before formation: who should hold a stake in this company in three years’ time?",
        ],
      },
      {
        typ: "hinweis", id: "wissen", h2: "What you need to know",
        punkte: [
          "The choice of legal form has tax consequences in your home country. Our partner tax adviser reviews it before formation under your engagement.",
          GLOBAL_PFLICHTHINWEIS.en[1],
        ],
      },
    ],
    fragen: [
      { f: "What is the difference between an LLC and a corporation?", a: `Both limit liability. The LLC is more flexible and, with a foreign shareholder, usually not a separate taxable entity in the US; the corporation is a separate taxable entity (federal ${IRS_EN.koerperschaftsteuer}) and the standard for investors.` },
      { f: "Which legal form do I need for US investors?", a: "Generally a corporation, often in Delaware. Investors in the US know this form and expect it." },
      { f: "Can I convert an LLC into a corporation later?", a: "Yes, but with effort: fees, new documents and a tax review in both countries." },
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
      beschreibung: "US LLC or German GmbH: formation, share capital, notary, liability, tax and obligations compared — and why it is rarely an either-or question.",
    },
    stand: S,
    erschienen: S,
    kennung: "FG · 25",
    auge: "Knowledge · Legal form",
    h1: "LLC or GmbH?",
    h1b: "Rarely an either-or.",
    lead: "The LLC is seen as the “American GmbH” — faster to form, no notary, no share capital. That is true. But the question is rarely which of the two: the GmbH is made for business at home, the LLC for business in the US. Often the GmbH owns the LLC.",
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
      ["Typical", "GmbH at home, LLC as the US subsidiary"],
      ["Review", "Before formation, by our partner tax adviser"],
    ],
    kurz: "The GmbH is formed with a notary and entry in the commercial register and needs €25,000 in share capital; the LLC is filed with the state and needs neither a notary nor minimum capital. Both limit liability, and both are taxable where they are managed. For businesses with operations in both countries, the typical solution is not a choice but a structure: the GmbH at home as the shareholder of the LLC in the US.",
    bloecke: [
      {
        typ: "tabelle", id: "vergleich", h2: "The comparison",
        kopf: ["", "GmbH", "US LLC"],
        zeilen: [
          ["Formation", "notary and commercial register", "filing with the state"],
          ["Minimum capital", "€25,000, at least half paid in on formation", "none"],
          ["Constitution", "articles of association, notarised", "operating agreement, simple written form"],
          ["Liability", "limited to the company’s assets", "limited to the company’s assets"],
          ["Tax", "where it is managed", "where it is managed — plus US reporting duties"],
          ["Annually", "annual financial statements, publication", "state fee, registered agent, Form 5472"],
          ["Made for", "business in Germany", "business in the US"],
        ],
        fuss: ["Simplified overview. The entrepreneurial company (UG) has its own rules on share capital."],
      },
      {
        typ: "text", id: "struktur", h2: "The typical structure: GmbH and LLC",
        absaetze: [
          "Anyone who runs a business in Germany and is building business in the US generally does not form an LLC instead of the GmbH, but an LLC under the GmbH. The GmbH is the shareholder; the LLC enters into contracts in the US, holds the US account and builds its own history there.",
          "This keeps the liability and the figures of the US business separate. For tax purposes, it must be clarified where the LLC is managed and how it is classified — our partner tax adviser reviews this before formation. If a GmbH owns a Florida LLC, the GmbH also files its own tax return in Florida.",
        ],
      },
      {
        typ: "hinweis", id: "wissen", h2: "What you need to know",
        punkte: [
          "An LLC does not replace a GmbH for business in Germany — and vice versa.",
          GLOBAL_PFLICHTHINWEIS.en[0],
          "The GmbH’s shareholding in the LLC must be reported to the tax office under section 138 of the German Fiscal Code (AO).",
        ],
      },
    ],
    fragen: [
      { f: "Is an LLC the same as a GmbH?", a: "Not quite. Both limit liability, but the LLC needs neither a notary nor minimum capital, and its constitution — the operating agreement — can be drafted freely." },
      { f: "Can my GmbH form a US LLC?", a: "Yes. The GmbH becomes the shareholder of the LLC. We then need the GmbH’s commercial register extract and the passports of its managing directors." },
      { f: "Does an LLC pay less tax than a GmbH?", a: "As a rule, no. Both are taxable where they are managed; the LLC also brings reporting duties in the US with it." },
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
    erschienen: S,
    kennung: "FG · 26",
    auge: "Knowledge · Reporting duty",
    h1: "Form 5472.",
    h1b: "The filing no one can afford to forget.",
    lead: "If a US company belongs to a foreign shareholder, it reports its transactions with that shareholder to the IRS every year — with Form 5472 and a Form 1120 as a cover sheet. The filing is required even without revenue, and missing it is expensive.",
    ziffern: [
      { wert: "15 April", label: "Deadline, extendable to 15 October with Form 7004" },
      { wert: "$25,000", label: "Penalty per form per year" },
      { wert: "Fax or post", label: "not electronic" },
    ],
    blick: [
      ["Who", "US company that has a foreign shareholder and is not a separate taxable entity for tax purposes"],
      ["What", "Form 5472 with a pro forma Form 1120"],
      ["Reportable", "Contributions, withdrawals, loans, payments — including the contribution on formation"],
      ["Deadline", IRS_EN.frist5472],
      ["Filing", "By fax or post, not electronically"],
      ["Penalty", `${IRS_EN.strafe5472}, further amounts after a notice`],
    ],
    kurz: `Form 5472 reports the transactions between a US company and its foreign shareholder to the IRS. An LLC that is not a separate taxable entity for tax purposes files it with a pro forma Form 1120 — by 15 April, extendable to 15 October, by fax or post. Even the contribution on formation is reportable; the penalty for a missing filing is ${IRS_EN.strafe5472}.`,
    bloecke: [
      {
        typ: "text", id: "wer", h2: "Who must file",
        absaetze: [
          "Since 2017, the rule has been this: a US LLC that has a single foreign shareholder (member) and is not regarded as a separate taxable entity for tax purposes is treated like a corporation for this filing. Every year it files Form 5472 together with a Form 1120 that shows only its name, address and EIN — known as the pro forma Form 1120.",
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
        nach: "Because even the contribution on formation counts, the filing is practically always due in the first year — even without a single dollar of revenue. The company must also keep records that document these transactions.",
      },
      {
        typ: "etappen", id: "ablauf", h2: "How the filing works",
        etappen: [
          { titel: "Records", text: "Contributions, withdrawals and payments are recorded throughout the year — with supporting documents." },
          { titel: "Preparation by the US CPA", text: "The US CPA prepares Form 5472 and the pro forma Form 1120 from these records." },
          { titel: "Filing", text: "By 15 April, by fax or post to the IRS; extendable to 15 October with Form 7004." },
          { titel: "Record-keeping", text: "A copy and proof of filing are kept in your document room." },
        ],
      },
      {
        typ: "hinweis", id: "strafe", h2: "What a missed filing costs",
        punkte: [
          `For a missing or substantially incomplete filing, the IRS can impose ${IRS_EN.strafe5472} — likewise if the required records are missing.`,
          "If the filing is still outstanding more than ninety days after a notice from the IRS, a further $25,000 is added for each additional period of thirty days.",
          "At FIAON Global, the first annual filing is prepared by our US CPA — the fee is included in the fixed price of every package.",
        ],
      },
    ],
    fragen: [
      { f: "Who has to file Form 5472?", a: "A US company with a foreign shareholder — including an LLC that is not a separate taxable entity for tax purposes. It files Form 5472 with a pro forma Form 1120." },
      { f: "Is Form 5472 required if my LLC made no sales?", a: "Yes, as soon as there were reportable transactions — and even the contribution on formation counts." },
      { f: "Can I file Form 5472 electronically?", a: "Not for the pro forma Form 1120 with Form 5472. It is sent to the IRS by fax or post." },
      { f: "What is the penalty for not filing Form 5472?", a: `The IRS can impose ${IRS_EN.strafe5472}, and further amounts if the failure continues after a notice.` },
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
      beschreibung: "How to spot a reputable US formation provider: a registered contracting party, a fixed price, no tax or credit promises, partners admitted to practise.",
    },
    stand: S,
    erschienen: S,
    kennung: "FG · 28",
    auge: "Knowledge · Providers",
    h1: "Reputable or not?",
    h1b: "The checklist before you engage anyone.",
    lead: "“LLC” is a legal form — nothing more and nothing less. Many providers offer it, good and bad alike. Whether a provider is reputable comes down to eight points that you can check before engaging anyone. We apply the same list to ourselves.",
    ziffern: [
      { wert: "8 points", label: "to check before you engage anyone" },
      { wert: "2 minutes", label: "is all the register check takes" },
      { wert: "Companies House", label: "FIAON LTD No. 17318250" },
    ],
    blick: [
      ["Register", "Contracting party with a registration number you can check"],
      ["Price", "Fixed price with a schedule of services"],
      ["Tax", "No promises — mandatory notices instead"],
      ["Credit", "No commitment on limits, cards or loans"],
      ["Partners", "Tax advisers and lawyers admitted to practise, under your engagement"],
      ["Transparency", "Connected companies are named"],
    ],
    kurz: "You can recognise reputable support with your US formation by a contracting party with a registration number you can check and by a fixed price with a schedule of services. Further signs are clear mandatory notices on tax and filings, no commitments on tax, cards or credit, partners with their own professional admission — and connected companies that are named openly.",
    bloecke: [
      {
        typ: "etappen", id: "liste", h2: "The eight points",
        etappen: [
          { titel: "Who is your contracting party?", text: "Name, legal form, registered office and registration number must be in the contract — and listed in the register. If you cannot verify your contracting party, do not sign." },
          { titel: "Is there a fixed price with a schedule of services?", text: "What is included is set out in writing — including what is charged from the second year onwards. Subscriptions that only appear after signing are a warning sign." },
          { titel: "Are promises made about tax?", text: "“Tax-free” or “no tax” conceals the place of management. Reputable providers name the tax liability at home and the reporting duties." },
          { titel: "Are cards, limits or loans promised?", text: "The institution decides on the account, the card and the limit. Anyone who promises amounts is promising what they cannot deliver." },
          { titel: "Who answers tax and legal questions?", text: "Only tax advisers, US CPAs and lawyers admitted to practise — under your own engagement. A formation service itself is not permitted to do so." },
          { titel: "Are the US obligations spelled out?", text: "Form 5472, state fee, registered agent: anyone who does not mention them before the engagement leaves you alone with the most expensive deadline." },
          { titel: "Who has access to your money?", text: "The account holder is your company. A provider needs no power of attorney over your account and does not accept money on your behalf." },
          { titel: "Are connections disclosed openly?", text: "If partners have the same owner as the provider, that belongs on the website — not in the small print." },
        ],
      },
      {
        typ: "text", id: "fiaon", h2: "The same list for FIAON Global",
        absaetze: [
          "The contracting party on our side is FIAON LTD, registered at Companies House under number 17318250. The fixed price is set out in the contract with a schedule of services, and we name the running costs from the second year onwards in advance. We make no commitments on tax, and we commit to neither cards nor limits.",
          GLOBAL_ROLLEN.en.partner,
          GLOBAL_VERBUNDEN_EN,
        ],
      },
      {
        typ: "hinweis", id: "wissen", h2: "What you need to know",
        punkte: [
          "A legal form says nothing about reputability — neither an LLC nor a Ltd nor a GmbH.",
          "Check registration numbers yourself: at Companies House, in Zefix or in the German commercial register (Handelsregister).",
          GLOBAL_PFLICHTHINWEIS.en[2],
        ],
      },
    ],
    fragen: [
      { f: "How can I tell whether a US formation provider is reputable?", a: "By a contracting party with a registration number you can check, a fixed price with a schedule of services, clear mandatory notices and the absence of any commitments on tax, cards and credit." },
      { f: "Is an LLC inherently dubious?", a: "No. The LLC is an ordinary legal form in the US. What decides whether a provider is reputable is how it works — not what legal form it has." },
      { f: "How do I check FIAON’s registration number?", a: "At Companies House (England and Wales) under number 17318250. You will find Schwarzott Capital Partners AG in Zefix under CHE-102.119.428." },
    ],
    weiter: ["/en/business/partners", "/en/business/comparison", "/en/business/costs", "/en/business/knowledge/us-business-credit-card"],
    quellen: [
      { titel: "Companies House — FIAON LTD", url: "https://find-and-update.company-information.service.gov.uk/company/17318250" },
      { titel: "Zefix — Schwarzott Capital Partners AG", url: "https://www.zefix.ch/de/search/entity/list/firm/304048" },
    ],
  },
];
