// ═══════════════════════════════════════════════════════════════════════════
// FIAON GLOBAL — PREISE UND ABLAUF AUF ENGLISCH (24.09.2026, E-234)
// Die britisch-englischen Schwestern von preise.ts: Ablauf (/en/business/process),
// Paket-Finder (/en/business/package-finder) und Vergleich (/en/business/comparison).
// Gleicher Aufbau, gleiche Anker (ids bleiben deutsch), gleiche Zahlen — Paketnamen,
// Preise und Kapitalrahmen kommen aus shared/fiaon-global.ts, die Adressen aus
// shared/fiaon-global-pfade.ts. Prüfstand: scripts/pruef-global-en.ts.
// ═══════════════════════════════════════════════════════════════════════════
import {
  GLOBAL_PAKETE, GLOBAL_PFLICHTHINWEIS, GLOBAL_GELD_ZURUECK, GLOBAL_ROLLEN,
  globalPaket, globalPreisText, globalPlanungText, globalKapitalSpanne,
} from "../../fiaon-global";
import { GLOBAL_ETAPPEN } from "../../fiaon-global-bereich";
import { globalEnPfad } from "../../fiaon-global-pfade";
import type { GlobalSeite } from "../typen";

const S = "2026-09-24";
const gross = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
const name = (key: string) => globalPaket(key)?.en.name ?? key;

export const PREISE_UND_ABLAUF_EN: GlobalSeite[] = [
  // ─────────────────────────────────────────────────────────────────────────
  {
    pfad: "/en/business/process",
    sprache: "en",
    schwester: "/business/ablauf",
    art: "preise",
    seo: {
      titel: "How to form a US company: the eight steps — FIAON Global",
      beschreibung: "From the first call to the card ladder: eight steps, four stages, clear responsibilities. Timings based on experience — authorities set their own pace.",
    },
    stand: S,
    erschienen: S,
    kennung: "FG · 08",
    auge: "Prices and process · Process",
    h1: "The process.",
    h1b: "Eight steps, one sequence.",
    lead: "From the first call to the card ladder: at every stage you know who is handling what, what comes next and how long it usually takes, in our experience. You can see the status at any time in “My order”.",
    ziffern: [
      { wert: "8 steps", label: "from the first call to the bank" },
      { wert: "4 stages", label: "formation, first card, card ladder, bank loan" },
      { wert: "1 contact", label: "from day one" },
    ],
    blick: [
      ["Start", "Arrange a call or order directly"],
      ["Contract", "Signed on screen; contract and invoice sent by email"],
      ["Work begins", "When your payment is received"],
      ["Your part", "Five documents, decisions, signatures"],
      ["Status", "At any time in “My order”, with stage and next step"],
      ["Duration", "Experience-based estimates per package — authorities and institutions set their own pace"],
    ],
    kurz: "An engagement with FIAON Global begins with a call or a direct order on screen. Once your payment has been received, the kick-off call and the documents come next, followed by the review by the partner tax adviser, the formation with EIN and ITIN, and then the account and cards. The company is usually in place after a few weeks; depending on the package, support lasts from around eight weeks to six months or longer.",
    bloecke: [
      {
        typ: "etappen", id: "schritte", h2: "The eight steps",
        etappen: [
          { titel: "Call or direct order", text: "Thirty minutes with your contact — or order directly: choose a package, enter your company details, sign the contract on screen." },
          { titel: "Contract and invoice", text: "You receive both immediately by email, together with access to “My order”. The contracting party is FIAON LTD in London." },
          { titel: "Payment received", text: "Work begins when your payment is received. Your contact then gets in touch to arrange the kick-off call." },
          { titel: "Kick-off call and documents", text: "The legal form, the state and the name are decided; you upload five documents to your document room." },
          { titel: "Review by the tax adviser", text: "Before formation, our partner tax adviser reviews how your company will be treated in your home country and which filings are due there." },
          { titel: "Formation", text: GLOBAL_ETAPPEN[1].en.text.replace(" on this page", " in “My order”") },
          { titel: "Cards", text: GLOBAL_ETAPPEN[2].en.text },
          { titel: "Bank", text: GLOBAL_ETAPPEN[4].en.text },
        ],
      },
      {
        typ: "tabelle", id: "dauer", h2: "How long support lasts",
        lead: "Experience-based estimates, not deadlines. How quickly things move depends on the authorities, the institutions and how complete your documents are.",
        kopf: ["Package", "Support", "Capital range", "Fixed price"],
        zeilen: GLOBAL_PAKETE.map((p) => [p.en.name, gross(p.en.dauerKurz), globalPlanungText(p.key, "en"), globalPreisText(p.key, "en")]),
        hervor: 1,
      },
      {
        typ: "rollen", id: "wer", h2: "Who does what, and when",
        fiaon: ["Kick-off call, plan and coordination", "Filings with the state and with the IRS", "Preparation of account and card applications", "Compliance calendar and document room"],
        partner: ["Partner tax adviser: review before formation", "Partner lawyer: operating agreement", "US CPA: first annual US filing", "Schwarzott Global LLC: appointments on the ground in Miami"],
        sie: ["Upload documents", "Make decisions and sign", "Submit applications to issuers and banks", "Pay your statements on time — this builds your history"],
      },
      {
        typ: "hinweis", id: "wissen", h2: "What you need to know",
        punkte: [...GLOBAL_PFLICHTHINWEIS.en, `${GLOBAL_GELD_ZURUECK.en.titel}: ${GLOBAL_GELD_ZURUECK.en.text} ${GLOBAL_GELD_ZURUECK.en.bedingungen}`],
      },
      { typ: "pakete", id: "pakete", h2: "The four packages", lead: "Each package is an engagement at a fixed price — all fees and our partners’ charges included." },
    ],
    fragen: [
      { f: "How long until my US company is up and running?", a: "Usually a few weeks once your documents are complete. The EIN and the ITIN are issued by the US tax authority on its own timeline." },
      { f: "When does the work begin?", a: "When your payment is received. Your contact then gets in touch to arrange the kick-off call." },
      { f: "How can I track the progress of my order?", a: "In “My order”: stage, next step, documents and compliance calendar — you are given access together with the contract and the invoice." },
      { f: "What do I have to do myself?", a: "Upload five documents, make decisions and sign. You submit applications to issuers and banks yourself — fully prepared by us." },
    ],
    weiter: ["/business/kosten", "/business/paket-finder", "/business/us-firmengruendung", "/business/privatpersonen"].map(globalEnPfad),
  },

  // ─────────────────────────────────────────────────────────────────────────
  {
    pfad: "/en/business/package-finder",
    sprache: "en",
    schwester: "/business/paket-finder",
    art: "werkzeug",
    seo: {
      titel: "US company formation packages: which fits? — FIAON Global",
      beschreibung: "Four questions on goal, capital range, time and support — the package finder shows which FIAON Global package fits you. No sign-up.",
    },
    stand: S,
    erschienen: S,
    kennung: "FG · 09",
    auge: "Prices and process · Package finder",
    h1: "Which package fits?",
    h1b: "Four questions, one clear answer.",
    lead: "Answer four questions about your plans. The package finder shows which package is the closest fit — and why. No sign-up, and your answers are not stored.",
    ziffern: [
      { wert: "4 questions", label: "goal, capital range, time, support" },
      { wert: "1 minute", label: "no sign-up" },
      { wert: globalKapitalSpanne("en"), label: "target capital range for each package" },
    ],
    blick: [
      // 19.09.2026: nicht mehr „Ihr Ziel in den USA" — das Kapital ist nicht an die USA gebunden (GLOBAL_KAPITAL_FREI).
      ["Question 1", "What is your goal with the US company?"],
      ["Question 2", "Which capital range are you aiming for?"],
      ["Question 3", "How much time will you give the set-up?"],
      ["Question 4", "How would you like to be supported?"],
      ["Result", "The right package and the reasons why — order now or talk to us first"],
      ["Data", "Your answers stay in your browser"],
    ],
    kurz: `The package finder matches your plans to one of the four packages: ${name("global_struktur")} for formation and the first card, ${name("global_banking")} for the card ladder, ${name("global_kapital")} through to the bank loan, ${name("global_vip")} with the kick-off on site in Miami. The result is a guide; in a call, your contact checks whether it fits your case.`,
    bloecke: [
      { typ: "finder", id: "finder", h2: "Four questions", lead: "For each question, choose the answer that comes closest to your plans." },
      { typ: "pakete", id: "pakete", h2: "All four packages", lead: "Fixed price, one-off — all fees and our partners’ charges included." },
    ],
    fragen: [
      { f: "Is the result binding?", a: "No. The package finder is a guide. Your contact checks in a call whether the package fits your case — or you order directly." },
      { f: "Are my answers stored?", a: "No. The answers stay in your browser and are not transmitted to FIAON." },
      { f: "Can I upgrade to a larger package later?", a: "Talk to your contact. A switch to a different package is agreed separately — with a new contract that states what has already been done." },
    ],
    weiter: ["/business/kosten", "/business/vergleich", "/business/firmenkarten-kapital", "/business/ablauf"].map(globalEnPfad),
  },

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
    erschienen: S,
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
      ["FIAON Global", "One contact, one contract, one fixed price — partner fees included"],
      ["What matters", "Who coordinates the tax adviser, US CPA, lawyer and institutions?"],
      ["In fairness", "If all you need is a company, you pay less with a service"],
      ["Fixed price", `from ${globalPreisText("global_struktur", "en")} with FIAON Global`],
    ],
    kurz: "Anyone who forms a US company themselves pays only the fees, but deals separately with the state, the registered agent, the IRS, a lawyer, a tax adviser, a US CPA, banks and issuers. A formation service handles the formation but usually leaves taxes, account and cards to the client. FIAON Global coordinates everything in one place, at a fixed price that includes the partner fees.",
    bloecke: [
      {
        typ: "tabelle", id: "vergleich", h2: "The three routes compared",
        kopf: ["", "Form it yourself", "Formation service", "FIAON Global"],
        zeilen: [
          ["Formation with the state", "yourself", "included", "included"],
          ["Registered agent and address", "book it yourself", "usually included, often as a subscription", "first year included"],
          ["EIN", "apply yourself", "often included", "included"],
          ["ITIN", "yourself, with an acceptance agent", "rarely included", "included"],
          ["Review by a tax adviser before formation", "arrange it yourself", "not included", "included"],
          ["Operating agreement by a lawyer", "template, or instruct a lawyer yourself", "usually a template", "by our partner lawyer"],
          ["First US filing (Form 5472)", "yourself, or engage a US CPA", "often at extra cost", "included, by our US CPA"],
          ["Account and card applications", "yourself", "rarely", `prepared; from ${name("global_banking")} onwards, each additional one too`],
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
          { tag: "FIAON Global", titel: "If everything has to fit together", text: "For anyone who wants the company, tax numbers, account, cards and capital coordinated by a single party — with partner fees included in the fixed price." },
        ],
      },
      {
        typ: "text", id: "unterschied", h2: "The real difference",
        absaetze: [
          "Formation with the state is a single form. What makes a US company expensive is what comes afterwards: a missed Form 5472, an account that fails on inconsistent documents, a card ladder without a plan, a tax liability in your home country that nobody checked beforehand.",
          GLOBAL_ROLLEN.en.partner,
        ],
      },
      { typ: "pakete", id: "pakete", h2: "The four packages", lead: "Fixed price, one-off — everything needed for your package is included." },
    ],
    fragen: [
      { f: "Is FIAON Global more expensive than a formation service?", a: `Yes, if you only need the company. In return, the fixed price from ${globalPreisText("global_struktur", "en")} includes the review by the tax adviser, the operating agreement by the lawyer, EIN, ITIN, the first US filing and the preparation of the account and card applications.` },
      { f: "Can I form the company myself and engage FIAON only for the account and cards?", a: "No. The packages begin with the formation, because account and card applications only succeed with documents that fit together from the start." },
      { f: "Does FIAON name its competitors?", a: "No. The comparison describes the usual offering on the market, not individual providers." },
    ],
    weiter: ["/business/kosten", "/business/paket-finder", "/business/wissen/anbieter-pruefen", "/business/us-firmengruendung"].map(globalEnPfad),
  },
];
