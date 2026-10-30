// ═══════════════════════════════════════════════════════════════════════════
// FIAON GLOBAL — DIE BUNDESSTAATEN AUF ENGLISCH (24.09.2026, E-234)
// Florida, Delaware, Wyoming — die britisch-englischen Schwestern von
// staaten.ts (/en/business/florida, /delaware, /wyoming). Gleicher Aufbau,
// gleiche Anker, gleiche Quellen; Beträge und Fristen aus fakten-en.ts
// (dieselben Werte wie fakten.ts, Stand September 2026).
// Wo die deutsche Fassung Sätze mit .replace() aus fakten.ts kürzt, kürzt die
// englische genauso aus fakten-en.ts — eine Quelle je Betrag.
// US-Eigennamen bleiben amerikanisch: Articles of Organization, Certificate of
// Formation, License Tax, Franchise Tax, Authorized Shares Method.
// ═══════════════════════════════════════════════════════════════════════════
import { GLOBAL_AGENT, GLOBAL_PFLICHTHINWEIS, globalPaket, globalPreisText } from "../../fiaon-global";
import { globalEnPfad } from "../../fiaon-global-pfade";
import { FAKTEN_STAND_EN, IRS_EN, QUELLEN_STAATEN_EN, STAAT_EN } from "../fakten-en";
import type { GlobalBlock, GlobalSeite } from "../typen";
import { BUNDESSTAATEN, STAATEN_STAND, STAATEN_STAND_TEXT, STAATEN_ZUR_WAHL } from "../../fiaon-global-bundesstaaten";

const S = "2026-09-24";
// E-465 (29.10.2026): honest registration times, express and Delaware as the standard for new engagements.
const S465 = STAATEN_STAND;
const ZEIT = STAATEN_STAND_TEXT.en;
const DE_ = BUNDESSTAATEN.delaware, FL_ = BUNDESSTAATEN.florida, WY_ = BUNDESSTAATEN.wyoming;
const VIP = globalPaket("global_vip")!.en.name;
const AB_PREIS = globalPreisText("global_struktur", "en");

/** The three states compared — the same table on every state page (E-465: order Delaware, Florida, Wyoming; registration and express). */
function vergleich(hervor: 1 | 2 | 3): GlobalBlock {
  return {
    typ: "tabelle", id: "vergleich", h2: "Delaware, Florida and Wyoming compared",
    lead: `The three states for an LLC side by side — registration times as of ${ZEIT}, experience rather than a commitment.`,
    kopf: ["", ...STAATEN_ZUR_WAHL.map((b) => b.name)],
    zeilen: [
      ["Registration", ...STAATEN_ZUR_WAHL.map((b) => b.eintragungKurz.en)],
      ["Express", ...STAATEN_ZUR_WAHL.map((b) => b.express.kurz.en)],
      ["Formation", STAAT_EN.delaware.gruendung, STAAT_EN.florida.gruendung, STAAT_EN.wyoming.gruendung],
      ["Paid to the state each year", STAAT_EN.delaware.jahr, STAAT_EN.florida.jahr, STAAT_EN.wyoming.jahr],
      ["Deadline", "1 June", "1 January to 1 May", "Month of formation"],
      ["State tax", "depends on the activity", "5.5% for corporations", "no corporate or personal income tax"],
      ["Strength", "Speed with express, reputation with banks and investors", "Team on the ground in Miami, business in Florida", "Lean, low running costs"],
    ],
    hervor,
    fuss: [`Times as of ${ZEIT}, amounts as of ${FAKTEN_STAND_EN} for LLCs. Delaware: ${STAAT_EN.delaware.jahrAlt}`],
  };
}

export const STAATEN_EN: GlobalSeite[] = [
  // ─────────────────────────────────────────────────────────────────────────
  {
    pfad: "/en/business/florida",
    sprache: "en",
    schwester: "/business/florida",
    art: "staat",
    seo: {
      titel: "Form a Florida LLC: costs and requirements — FIAON Global",
      beschreibung: `Florida LLC: ${STAAT_EN.florida.gruendung} to form, ${STAAT_EN.florida.jahr} annual report due by 1 May, registered agent with a Florida address. Our team on the ground is based in Miami.`,
    },
    stand: S465,
    erschienen: S,
    kennung: "FG · 19",
    auge: "Knowledge · US state",
    h1: "Florida.",
    h1b: "Home of our team on the ground.",
    lead: `Florida is where our team on the ground is based: Schwarzott Group in Miami. For companies that do business in Florida, need in-person appointments or plan the kick-off in the ${VIP} package, it is the obvious choice — with clear fees and a fixed deadline in spring. At present, though, Florida is registering more slowly than usual: often around two weeks, with no express option.`,
    ziffern: [
      { wert: STAAT_EN.florida.gruendung, label: "Forming an LLC" },
      { wert: STAAT_EN.florida.jahr, label: "Annual report, 1 January to 1 May" },
      { wert: "Miami", label: "Our team on the ground" },
    ],
    blick: [
      ["Registration", `around two weeks at present, no express (as of ${ZEIT})`],
      ["Formation", `${STAAT_EN.florida.gruendung} — ${STAAT_EN.florida.gruendungDetail}`],
      ["Each year", `${STAAT_EN.florida.jahr} ${STAAT_EN.florida.jahrName}, ${STAAT_EN.florida.jahrFrist}`],
      ["Late filing", STAAT_EN.florida.jahrVerzug],
      ["Registered agent", STAAT_EN.florida.agent],
      ["State tax", STAAT_EN.florida.steuer],
      ["On the ground", "Schwarzott Group, Miami"],
    ],
    kurz: `Forming an LLC in Florida costs ${STAAT_EN.florida.gruendung} (${STAAT_EN.florida.gruendungDetail}). Every year, an annual report costing ${STAAT_EN.florida.jahr} is due between 1 January and 1 May; after 1 May, a further $400 is added. A registered agent with an address in Florida is mandatory. Florida is home to our team on the ground: Schwarzott Group attends appointments in Miami.`,
    bloecke: [
      {
        typ: "tabelle", id: "fakten", h2: "Florida in figures",
        kopf: ["", "Florida"],
        zeilen: [
          ["Forming an LLC", `${STAAT_EN.florida.gruendung} (${STAAT_EN.florida.gruendungDetail})`],
          ["Annual report", `${STAAT_EN.florida.jahr}, ${STAAT_EN.florida.jahrFrist}`],
          ["Late filing", STAAT_EN.florida.jahrVerzug],
          ["Registered agent", STAAT_EN.florida.agent],
          ["State tax", STAAT_EN.florida.steuer],
          ["LLC owned by a GmbH or AG", "the owning company files its own Florida tax return (Form F-1120)"],
        ],
        fuss: [`As of ${FAKTEN_STAND_EN}; sources at the end of the page.`],
      },
      {
        typ: "text", id: "wann", h2: "When Florida is the right fit",
        absaetze: ["Florida is not a state you choose for tax reasons, nor one for investors — it is the state for companies that actually do business there. Florida is the right fit if:"],
        punkte: [
          "your customers, suppliers or projects are in Florida",
          "you need in-person appointments — with authorities or institutions",
          `you want to attend the kick-off in person in Miami (${VIP})`,
          "you want a company with a team nearby",
        ],
        nach: STAAT_EN.florida.llcSteuer,
      },
      vergleich(2),
      {
        typ: "hinweis", id: "wissen", h2: "What you need to know",
        punkte: [
          `Registration: ${FL_.eintragung.en} If time matters, form in Delaware with express or in Wyoming.`,
          `Anyone who files the annual report after 1 May pays ${STAAT_EN.florida.jahrVerzug.replace("after 1 May ", "")}. The deadline is in your compliance calendar.`,
          GLOBAL_PFLICHTHINWEIS.en[0],
          `Regardless of the state, the IRS requires Form 5472 with Form 1120 every year; failure to file can result in a penalty of ${IRS_EN.strafe5472}.`,
        ],
      },
      { typ: "paket", id: "paket", h2: "The right package", lead: `Formation in Florida with everything needed to get started — or with an in-person kick-off in the ${VIP} package.`, paket: "global_struktur" },
      { typ: "standorte", id: "standorte", h2: "Our team in Miami", lead: "Schwarzott Group attends appointments on the ground; the contracting party is FIAON LTD." },
    ],
    fragen: [
      { f: "How much does a Florida LLC cost?", a: `Formation costs ${STAAT_EN.florida.gruendung}, and the annual report costs ${STAAT_EN.florida.jahr} a year. With FIAON Global, formation and the first year are included in the fixed price from ${AB_PREIS}.` },
      { f: "When is the Florida annual report due?", a: "Between 1 January and 1 May, starting in the year after formation. After 1 May, a late fee of $400 is added." },
      { f: "Does a Florida LLC pay corporate income tax?", a: "An LLC that is disregarded for tax purposes does not file its own Florida return. If it is owned by a corporation such as a GmbH, the owner files a Florida return; corporations pay 5.5% with a $50,000 exemption." },
      { f: "How long does formation take in Florida?", a: FL_.eintragung.en },
      { f: "Do I need a Florida address for my LLC?", a: "The company needs a registered agent with an address in Florida. We provide the registered agent in the first year, as well as the business address." },
    ],
    paket: "global_struktur",
    weiter: ["/business/miami", "/business/delaware", "/business/wyoming", "/business/wissen/bundesstaat-waehlen"].map(globalEnPfad),
    quellen: QUELLEN_STAATEN_EN.florida,
  },

  // ─────────────────────────────────────────────────────────────────────────
  {
    pfad: "/en/business/delaware",
    sprache: "en",
    schwester: "/business/delaware",
    art: "staat",
    seo: {
      titel: "Form a Delaware LLC: costs and requirements — FIAON Global",
      beschreibung: `Delaware LLC: registered in one or two business days with express, ${STAAT_EN.delaware.gruendung} to form, ${STAAT_EN.delaware.jahr} annual tax due 1 June. When it fits.`,
    },
    stand: S465,
    erschienen: S,
    kennung: "FG · 20",
    auge: "Knowledge · US state",
    h1: "Delaware.",
    h1b: "Fast, predictable, well known.",
    lead: "Delaware is famous for its corporate law: dedicated courts for corporate disputes, a long-established body of case law, banks and investors who know it. On top of that, Delaware is currently the fastest route you can plan on: with the state’s express service an LLC usually stands after one or two business days. The other side is the annual tax of $400.",
    ziffern: [
      { wert: STAAT_EN.delaware.gruendung, label: "Forming an LLC" },
      { wert: STAAT_EN.delaware.jahr, label: "Annual LLC tax from tax year 2026" },
      { wert: "1–2 business days", label: `Registration with express (as of ${ZEIT})` },
    ],
    blick: [
      ["Registration", `one or two business days with express (as of ${ZEIT})`],
      ["Formation", `${STAAT_EN.delaware.gruendung} (${STAAT_EN.delaware.gruendungDetail})`],
      ["Each year", `${STAAT_EN.delaware.jahr} ${STAAT_EN.delaware.jahrName}, due ${STAAT_EN.delaware.jahrFrist}`],
      ["Late payment", STAAT_EN.delaware.jahrVerzug],
      ["New", "from tax year 2026, $400 instead of $300"],
      ["Registered agent", STAAT_EN.delaware.agent],
      ["Corporation", "annual report $50, Franchise Tax from $175, due 1 March"],
    ],
    kurz: `Forming an LLC in Delaware costs ${STAAT_EN.delaware.gruendung}. Every year, an annual tax of ${STAAT_EN.delaware.jahr} is due on 1 June — from tax year 2026; before that it was $300. A registered agent with an office in Delaware is mandatory. With the state’s express service an LLC in Delaware is usually registered after one or two business days — which is why Delaware is our standard for new engagements.`,
    bloecke: [
      {
        typ: "tabelle", id: "fakten", h2: "Delaware in figures",
        kopf: ["", "Delaware"],
        zeilen: [
          ["Forming an LLC", `${STAAT_EN.delaware.gruendung} (${STAAT_EN.delaware.gruendungDetail})`],
          ["Annual LLC tax", `${STAAT_EN.delaware.jahr}, due ${STAAT_EN.delaware.jahrFrist}`],
          ["Late payment", STAAT_EN.delaware.jahrVerzug],
          ["Registered agent", STAAT_EN.delaware.agent],
          ["Corporation", STAAT_EN.delaware.corp.replace("Corporations: ", "")],
        ],
        fuss: [STAAT_EN.delaware.jahrAlt, `As of ${FAKTEN_STAND_EN}; sources at the end of the page.`],
      },
      {
        typ: "karten", id: "wann", h2: "When Delaware is the right fit — and when it is not", spalten: 3,
        karten: [
          { tag: "Good fit", titel: "A fast, predictable start", text: "With the state’s express service the company usually stands after one or two business days — very reliably. Banks and lenders know Delaware." },
          { tag: "Good fit", titel: "Corporation with investors", text: "US investors, employee equity programmes, a later sale: this is where Delaware is the standard everyone knows." },
          { tag: "Less of a fit", titel: "When every dollar of upkeep counts", text: "The annual tax of $400 is the highest of the three states. If low running costs matter most, Wyoming is cheaper." },
        ],
      },
      vergleich(1),
      {
        typ: "hinweis", id: "wissen", h2: "What you need to know",
        punkte: [
          `Registration: ${DE_.eintragung.en} The state decides on registration.`,
          `The annual LLC tax is due even if the company is dormant. If it is paid late, ${STAAT_EN.delaware.jahrVerzug.replace("if late, ", "")} is added.`,
          "A Delaware company that does business in another state generally has to register there as well — with separate fees.",
          GLOBAL_PFLICHTHINWEIS.en[0],
        ],
      },
      { typ: "paket", id: "paket", h2: "The right package", lead: "Formation in Delaware with everything needed to get started — including as a corporation with plans to bring in investors.", paket: "global_struktur" },
    ],
    fragen: [
      { f: "How much does a Delaware LLC cost?", a: `Formation costs ${STAAT_EN.delaware.gruendung}, and the annual tax is ${STAAT_EN.delaware.jahr} — from tax year 2026, due on 1 June of the following year. Before that it was $300.` },
      { f: "Why do so many companies incorporate in Delaware?", a: "Because of its corporate law: dedicated courts for corporate disputes, a long-established body of case law and investors who know it. This matters above all for corporations with investors." },
      { f: "How quickly is an LLC registered in Delaware?", a: DE_.eintragung.en },
      { f: "Does Delaware make sense for a small LLC as well?", a: "Often, yes: Delaware is currently the fastest route you can plan on, and banks and lenders know it. The other side is the annual tax of $400 — if low running costs matter most, Wyoming is cheaper." },
      { f: "Does a Delaware company have to register in other states?", a: "If it does business in another state, generally yes — with separate fees there." },
    ],
    paket: "global_struktur",
    weiter: ["/business/wissen/bundesstaat-waehlen", "/business/wissen/llc-oder-corporation", "/business/florida", "/business/wyoming"].map(globalEnPfad),
    quellen: QUELLEN_STAATEN_EN.delaware,
  },

  // ─────────────────────────────────────────────────────────────────────────
  {
    pfad: "/en/business/wyoming",
    sprache: "en",
    schwester: "/business/wyoming",
    art: "staat",
    seo: {
      titel: "Form a Wyoming LLC: costs and requirements — FIAON Global",
      beschreibung: `Wyoming LLC: ${STAAT_EN.wyoming.gruendung} to form, License Tax from $60 a year, due in the month of formation, no state corporate income tax. When it fits — and what it is not.`,
    },
    stand: S465,
    erschienen: S,
    kennung: "FG · 21",
    auge: "Knowledge · US state",
    h1: "Wyoming.",
    h1b: "Lean and inexpensive to maintain.",
    lead: "Wyoming is the state of low fees: $100 to form, from $60 a year, no state corporate or personal income tax. For an LLC that does not operate in any particular state, it is often the leanest solution — but it is not a tax model for entrepreneurs from Germany, Austria or Switzerland.",
    ziffern: [
      { wert: STAAT_EN.wyoming.gruendung, label: "Forming an LLC" },
      { wert: "from $60", label: "License Tax per year" },
      { wert: "none", label: "State corporate and personal income tax" },
    ],
    blick: [
      ["Registration", `around three business days, often sooner (as of ${ZEIT})`],
      ["Formation", `${STAAT_EN.wyoming.gruendung} (${STAAT_EN.wyoming.gruendungDetail})`],
      ["Each year", `annual report with License Tax: ${STAAT_EN.wyoming.jahrDetail}`],
      ["Deadline", STAAT_EN.wyoming.jahrFrist],
      ["Late filing", STAAT_EN.wyoming.jahrVerzug],
      ["Registered agent", STAAT_EN.wyoming.agent],
      ["State tax", STAAT_EN.wyoming.steuer],
    ],
    kurz: `Forming an LLC in Wyoming costs ${STAAT_EN.wyoming.gruendung}. Every year, an annual report with License Tax is due in the month of formation — $60 or 0.02% of the assets in Wyoming, whichever is higher. Wyoming levies no corporate income tax and no state income tax. The company nevertheless remains taxable where it is actually managed.`,
    bloecke: [
      {
        typ: "tabelle", id: "fakten", h2: "Wyoming in figures",
        kopf: ["", "Wyoming"],
        zeilen: [
          ["Forming an LLC", `${STAAT_EN.wyoming.gruendung} (${STAAT_EN.wyoming.gruendungDetail})`],
          ["Annual report", `${STAAT_EN.wyoming.jahrDetail}, ${STAAT_EN.wyoming.jahrFrist}`],
          ["Late filing", STAAT_EN.wyoming.jahrVerzug],
          ["Registered agent", STAAT_EN.wyoming.agent],
          ["State tax", STAAT_EN.wyoming.steuer],
        ],
        fuss: [`As of ${FAKTEN_STAND_EN}; sources at the end of the page.`],
      },
      {
        typ: "text", id: "wann", h2: "When Wyoming is the right fit",
        absaetze: [
          "Wyoming is the right fit if your LLC does not operate in any particular state — for example, a company that does business online or builds up a card history — and you want to keep its running costs low.",
          "It does not work as a tax model: although Wyoming levies no corporate income tax of its own, the company remains taxable where it is managed, and its reporting obligations to the IRS remain unchanged.",
        ],
      },
      vergleich(3),
      {
        typ: "hinweis", id: "wissen", h2: "What you need to know",
        punkte: [
          `Registration: ${WY_.eintragung.en}`,
          WY_.nachteile.en[0],
          `The annual report is due in the month of formation; ${STAAT_EN.wyoming.jahrVerzug}. The deadline is in your compliance calendar.`,
          GLOBAL_AGENT.en.kontakt,
          GLOBAL_PFLICHTHINWEIS.en[0],
          `Regardless of the state, the IRS requires Form 5472 with Form 1120 every year; failure to file can result in a penalty of ${IRS_EN.strafe5472}.`,
        ],
      },
      { typ: "paket", id: "paket", h2: "The right package", lead: "Formation in Wyoming with everything needed to get started.", paket: "global_struktur" },
    ],
    fragen: [
      { f: "How much does a Wyoming LLC cost?", a: `Formation costs ${STAAT_EN.wyoming.gruendung}; each year, the annual report costs at least $60 in License Tax. With FIAON Global, formation and the first year are included in the fixed price from ${AB_PREIS}.` },
      { f: "Does a Wyoming LLC pay any tax?", a: "Wyoming levies no corporate income tax and no state income tax. However, the company is taxable where it is managed — for entrepreneurs from Germany, Austria or Switzerland, usually in their home country." },
      { f: "When is the Wyoming annual report due?", a: "On the first day of the month in which the company was formed. If the report is more than sixty days overdue, the state may dissolve the company." },
      { f: "Is Wyoming better than Delaware?", a: "Cheaper to maintain and similarly fast. Delaware has the stronger reputation with banks and lenders and is even more predictable with express; some institutions look more closely at Wyoming companies with no business in the state." },
      { f: "How quickly is an LLC registered in Wyoming?", a: WY_.eintragung.en },
    ],
    paket: "global_struktur",
    weiter: ["/business/wissen/us-llc-steuern", "/business/florida", "/business/delaware", "/business/wissen/bundesstaat-waehlen"].map(globalEnPfad),
    quellen: QUELLEN_STAATEN_EN.wyoming,
  },
];
