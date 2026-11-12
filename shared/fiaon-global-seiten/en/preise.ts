// ═══════════════════════════════════════════════════════════════════════════
// FIAON GLOBAL — PREISE UND ABLAUF AUF ENGLISCH (24.09.2026, E-234)
// Die britisch-englischen Schwestern von preise.ts: Ablauf (/en/business/process),
// und Vergleich (/en/business/comparison). /en/business/package-finder leitet seit E-509 dauerhaft auf /en/business/start.
// Gleicher Aufbau, gleiche Anker (ids bleiben deutsch). Prüfstand: scripts/pruef-global-en.ts.
// E-509 (12.11.2026): ONE product instead of four packages — prices only from EIN_PRODUKT.en (../ein-produkt.ts).
// ═══════════════════════════════════════════════════════════════════════════
import { GLOBAL_PFLICHTHINWEIS } from "../../fiaon-global";
import { globalEnPfad } from "../../fiaon-global-pfade";
import type { GlobalSeite } from "../typen";
import { EIN_PRODUKT } from "../ein-produkt";

const S = "2026-11-12";
const ERSCHIENEN = "2026-09-24";
const P = EIN_PRODUKT.en;

export const PREISE_UND_ABLAUF_EN: GlobalSeite[] = [
  // ─────────────────────────────────────────────────────────────────────────
  {
    pfad: "/en/business/process",
    sprache: "en",
    schwester: "/business/ablauf",
    art: "preise",
    seo: {
      titel: "How to form a US company: the eight steps — FIAON Global",
      beschreibung: "From your offer to financing: eight steps and clear responsibilities. Timings based on experience — authorities and institutions set their own pace.",
    },
    stand: S,
    erschienen: ERSCHIENEN,
    kennung: "FG · 08",
    auge: "Prices and process · Process",
    h1: "The process.",
    h1b: "Eight steps, one sequence.",
    lead: "From your offer to financing: at every stage you know who is handling what, what comes next and how long it usually takes, in our experience. You can see the status at any time in “My order”.",
    ziffern: [
      { wert: "8 steps", label: "from your offer to financing" },
      { wert: "1 order", label: "formation, US office, accounts, cards and capital" },
      { wert: "1 contact", label: "from day one" },
    ],
    blick: [
      ["Start", "Build your offer yourself or talk to us first"],
      ["Contract", "Signed online; contract and invoice sent by email"],
      ["Work begins", "When your payment and your passport have arrived"],
      ["Your part", "Your passport, the name of your company, your signatures"],
      ["Status", "At any time in “My order”, with stage and next step"],
      ["Duration", "Experience-based estimates — authorities and institutions set their own pace"],
    ],
    kurz: "An engagement with FIAON Global begins in the configurator or with a call. You sign online; as soon as your payment and your passport have arrived, we file your company and apply for the EIN and the ITIN. Your US office, accounts and cards follow, and we stay with you through to financing. The company is usually in place after a few weeks; authorities and institutions decide on tax numbers, accounts, cards and financing on their own timeline.",
    bloecke: [
      {
        typ: "etappen", id: "schritte", h2: "The eight steps",
        etappen: [
          { titel: "Build your offer", text: "In the configurator you choose what matters to you and your capital range, and you see your price. Or you first speak to your contact for thirty minutes." },
          { titel: "Contract and invoice", text: "On your offer page you choose the term and the name of your company and sign online. You receive the contract and the invoice immediately by email, together with access to “My order”. The contracting party is FIAON LTD in London." },
          { titel: "Payment and passport", text: "Work begins when your payment and your passport have arrived. You upload the passport straight after signing." },
          { titel: "Formation", text: "We check the name in the register, file your company with the state and provide the operating agreement and the formation documents. The state decides on the registration." },
          { titel: "Tax numbers", text: "We apply for your company’s EIN and — once our ITIN check confirms the requirements — for your ITIN. The US tax authority decides on both numbers on its own timeline." },
          { titel: "Your US office", text: "Registered agent, US business address, US phone number and assistance for post, calls and appointments — included in the first year." },
          { titel: "Accounts and cards", text: "We fully prepare the applications for your personal US account, personal US cards, the business account and the company credit card. You file the applications yourself; each institution decides on accounts, cards and limits." },
          { titel: "Capital", text: "We prepare every application for the financing within your capital range and stay with your company through to payout. The financing institution decides on the financing." },
        ],
      },
      {
        typ: "tabelle", id: "dauer", h2: "How long it takes",
        lead: "Experience-based estimates, not deadlines. How quickly things move depends on the authorities, the institutions and how complete your documents are.",
        kopf: ["Step", "In our experience", "Who decides"],
        zeilen: [
          ["Registration of the company", "a few days to around two weeks, depending on the state", "the state"],
          ["EIN and ITIN", "on the US tax authority’s own timeline", "the US tax authority"],
          ["Accounts and cards", "after the review by each institution", "the institution"],
          ["Financing", "the aim and the conditions are set out in your agreement", "the financing institution"],
        ],
        hervor: 1,
      },
      {
        typ: "rollen", id: "wer", h2: "Who does what, and when",
        fiaon: ["Offer, contract and coordination", "Filings with the state and with the US tax authority", "Account and card applications fully prepared", "Compliance calendar and “My order”"],
        partner: ["Partner lawyer: operating agreement and formation documents", "US accountant (CPA): first annual US filing", "Partner tax adviser: clarifies beforehand how transfers are treated"],
        sie: ["Upload your passport", "Make decisions and sign", "Submit applications to issuers and banks", "Pay your statements on time — this builds your history"],
      },
      {
        typ: "hinweis", id: "wissen", h2: "What you need to know",
        punkte: [...GLOBAL_PFLICHTHINWEIS.en, P.geldZurueck],
      },
      { typ: "pakete", id: "mandat", h2: P.karteH2, lead: P.karteLead },
    ],
    fragen: [
      { f: "How long until my US company is up and running?", a: "Usually a few weeks once your payment and your passport have arrived. The EIN and the ITIN are issued by the US tax authority on its own timeline." },
      { f: "When does the work begin?", a: "When your payment and your passport have arrived. After that you can see the status at any time in “My order”." },
      { f: "How can I track the progress of my order?", a: "In “My order”: stage, next step, documents and compliance calendar — you are given access together with the contract and the invoice." },
      { f: "What do I have to do myself?", a: "Upload your passport, make decisions and sign. You submit applications to issuers and banks yourself — fully prepared by us." },
    ],
    weiter: ["/business/kosten", "/business/vergleich", "/business/us-firmengruendung", "/business/privatpersonen"].map(globalEnPfad),
  },

  // E-509 (12.11.2026): /en/business/package-finder is gone — the configurator /en/business/start is the new finder;
  // the old address redirects there permanently (301, GLOBAL_UMGEZOGEN in shared/fiaon-global-pfade.ts).

  // ─────────────────────────────────────────────────────────────────────────
  {
    pfad: "/en/business/comparison",
    sprache: "en",
    schwester: "/business/vergleich",
    art: "preise",
    seo: {
      titel: "Form a US company yourself or use a service? — FIAON Global",
      beschreibung: "Form it yourself, use a formation service or choose FIAON Global: what each includes, who coordinates and who takes care of taxes and filings.",
    },
    stand: S,
    erschienen: ERSCHIENEN,
    kennung: "FG · 10",
    auge: "Prices and process · Comparison",
    h1: "Yourself, a service or FIAON Global?",
    h1b: "Three routes to a US company.",
    lead: "You can form a US company yourself, through a formation service or with FIAON Global. The difference lies not in the formation itself but in everything that follows: taxes, filings, account, cards — and who coordinates it all.",
    ziffern: [
      { wert: "3 routes", label: "yourself, formation service, FIAON Global" },
      { wert: "8 points of contact", label: "if you form the company yourself, you deal with each one separately" },
      { wert: "1 contract", label: "with FIAON Global, for everything" },
    ],
    blick: [
      ["Yourself", "Low state fees, but you deal with every office separately — and carry every risk yourself"],
      ["Formation service", "The company is formed quickly; taxes, account and cards remain your responsibility"],
      ["FIAON Global", "One contact, one contract, one price — partner fees included"],
      ["What matters", "Who coordinates the tax adviser, US CPA, lawyer and institutions?"],
      ["In fairness", "If all you need is a company, you pay less with a service"],
      ["Price", `${P.preis} with your order at FIAON Global`],
    ],
    kurz: "Anyone who forms a US company themselves pays only the fees, but deals separately with the state, the registered agent, the IRS, a lawyer, a tax adviser, a US CPA, banks and issuers. A formation service handles the formation but usually leaves taxes, account and cards to the client. FIAON Global coordinates everything in one place — with one contract and the partner fees included in the price.",
    bloecke: [
      {
        typ: "tabelle", id: "vergleich", h2: "The three routes compared",
        kopf: ["", "Form it yourself", "Formation service", "FIAON Global"],
        zeilen: [
          ["Formation with the state", "yourself", "included", "included"],
          ["Registered agent and address", "book it yourself", "usually included, often as a subscription", "first year included"],
          ["EIN", "apply yourself", "often included", "included"],
          ["ITIN", "yourself, with an acceptance agent", "rarely included", "included"],
          ["Tax questions clarified beforehand", "arrange it yourself", "not included", "by our partner tax adviser"],
          ["Operating agreement by a lawyer", "template, or instruct a lawyer yourself", "usually a template", "by our partner lawyer"],
          ["First US filing (Form 5472)", "yourself, or engage a US CPA", "often at extra cost", "included, by our US CPA"],
          ["Account and card applications", "yourself", "rarely", "fully prepared"],
          ["One contact for everything", "no", "no", "yes"],
        ],
        hervor: 3,
        fuss: ["“Formation service” describes the usual offering on the market; individual providers may differ."],
      },
      {
        typ: "karten", id: "wann", h2: "When each route fits", spalten: 3,
        karten: [
          { tag: "Yourself", titel: "If you have the time — and the experience", text: "Anyone who knows the US forms, has a tax adviser with US experience and needs only one company will find doing it themselves the cheapest route." },
          { tag: "Formation service", titel: "If only the company matters", text: "Anyone who is not planning an account, cards or building capital is well served by a pure formation service." },
          { tag: "FIAON Global", titel: "If everything has to fit together", text: "For anyone who wants the company, tax numbers, account, cards and capital coordinated by a single party — with the partner fees included in the price." },
        ],
      },
      {
        typ: "text", id: "unterschied", h2: "The real difference",
        absaetze: [
          "Formation with the state is a single form. What makes a US company expensive is what comes afterwards: a missed Form 5472, an account that fails on inconsistent documents, card applications without a plan, a tax liability in your home country that nobody checked beforehand.",
          P.partner,
        ],
      },
      { typ: "pakete", id: "mandat", h2: P.karteH2, lead: P.karteLead },
    ],
    fragen: [
      { f: "Is FIAON Global more expensive than a formation service?", a: `Yes, if you only need the company. In return, the price of ${P.preis} includes the operating agreement by the lawyer, EIN, ITIN, address, phone number and assistance in the first year, the first US filing and the preparation of the account and card applications.` },
      { f: "Can I form the company myself and engage FIAON only for the account and cards?", a: "If you already have a US company, we take it over instead of forming a new one: we first review its documents and then give you your offer. Account and card applications only succeed with documents that fit together from the start." },
      { f: "Does FIAON name its competitors?", a: "No. The comparison describes the usual offering on the market, not individual providers." },
    ],
    weiter: ["/business/kosten", "/business/ablauf", "/business/wissen/anbieter-pruefen", "/business/us-firmengruendung"].map(globalEnPfad),
  },
];
