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
import { GLOBAL_PFLICHTHINWEIS, globalPaket, globalPreisText } from "../../fiaon-global";
import { globalEnPfad } from "../../fiaon-global-pfade";
import { FAKTEN_STAND_EN, IRS_EN, QUELLEN_STAATEN_EN, STAAT_EN } from "../fakten-en";
import type { GlobalBlock, GlobalSeite } from "../typen";

const S = "2026-09-24";
const VIP = globalPaket("global_vip")!.en.name;
const AB_PREIS = globalPreisText("global_struktur", "en");

/** The three states compared — the same table on every state page. */
function vergleich(hervor: 1 | 2 | 3): GlobalBlock {
  return {
    typ: "tabelle", id: "vergleich", h2: "Florida, Delaware and Wyoming compared",
    lead: "The three states for an LLC side by side.",
    kopf: ["", "Florida", "Delaware", "Wyoming"],
    zeilen: [
      ["Formation", STAAT_EN.florida.gruendung, STAAT_EN.delaware.gruendung, STAAT_EN.wyoming.gruendung],
      ["Paid to the state each year", STAAT_EN.florida.jahr, STAAT_EN.delaware.jahr, STAAT_EN.wyoming.jahr],
      ["Deadline", "1 January to 1 May", "1 June", "Month of formation"],
      ["State tax", "5.5% for corporations", "depends on the activity", "no corporate or personal income tax"],
      ["Strength", "Team on the ground in Miami, business in Florida", "Corporate law, investors", "Lean, low running costs"],
    ],
    hervor,
    fuss: [`As of ${FAKTEN_STAND_EN}, amounts for LLCs. Delaware: ${STAAT_EN.delaware.jahrAlt}`],
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
    stand: S,
    erschienen: S,
    kennung: "FG · 19",
    auge: "Knowledge · US state",
    h1: "Florida.",
    h1b: "Home of our team on the ground.",
    lead: `Florida is where our team on the ground is based: Schwarzott Global LLC in Miami. For companies that do business in Florida, need in-person appointments or plan the kick-off in the ${VIP} package, it is the obvious choice — with clear fees and a fixed deadline in spring.`,
    ziffern: [
      { wert: STAAT_EN.florida.gruendung, label: "Forming an LLC" },
      { wert: STAAT_EN.florida.jahr, label: "Annual report, 1 January to 1 May" },
      { wert: "Miami", label: "Our team on the ground" },
    ],
    blick: [
      ["Formation", `${STAAT_EN.florida.gruendung} — ${STAAT_EN.florida.gruendungDetail}`],
      ["Each year", `${STAAT_EN.florida.jahr} ${STAAT_EN.florida.jahrName}, ${STAAT_EN.florida.jahrFrist}`],
      ["Late filing", STAAT_EN.florida.jahrVerzug],
      ["Registered agent", STAAT_EN.florida.agent],
      ["State tax", STAAT_EN.florida.steuer],
      ["On the ground", "Schwarzott Global LLC, 3119 Coral Way, Miami"],
    ],
    kurz: `Forming an LLC in Florida costs ${STAAT_EN.florida.gruendung} (${STAAT_EN.florida.gruendungDetail}). Every year, an annual report costing ${STAAT_EN.florida.jahr} is due between 1 January and 1 May; after 1 May, a further $400 is added. A registered agent with an address in Florida is mandatory. Florida is home to our team on the ground: Schwarzott Global LLC attends appointments in Miami.`,
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
      vergleich(1),
      {
        typ: "hinweis", id: "wissen", h2: "What you need to know",
        punkte: [
          `Anyone who files the annual report after 1 May pays ${STAAT_EN.florida.jahrVerzug.replace("after 1 May ", "")}. The deadline is in your compliance calendar.`,
          GLOBAL_PFLICHTHINWEIS.en[0],
          `Regardless of the state, the IRS requires Form 5472 with Form 1120 every year; failure to file can result in a penalty of ${IRS_EN.strafe5472}.`,
        ],
      },
      { typ: "paket", id: "paket", h2: "The right package", lead: `Formation in Florida with everything needed to get started — or with an in-person kick-off in the ${VIP} package.`, paket: "global_struktur" },
      { typ: "standorte", id: "standorte", h2: "Our team in Miami", lead: "Schwarzott Global LLC attends appointments on the ground; the contracting party is FIAON LTD." },
    ],
    fragen: [
      { f: "How much does a Florida LLC cost?", a: `Formation costs ${STAAT_EN.florida.gruendung}, and the annual report costs ${STAAT_EN.florida.jahr} a year. With FIAON Global, formation and the first year are included in the fixed price from ${AB_PREIS}.` },
      { f: "When is the Florida annual report due?", a: "Between 1 January and 1 May, starting in the year after formation. After 1 May, a late fee of $400 is added." },
      { f: "Does a Florida LLC pay corporate income tax?", a: "An LLC that is disregarded for tax purposes does not file its own Florida return. If it is owned by a corporation such as a GmbH, the owner files a Florida return; corporations pay 5.5% with a $50,000 exemption." },
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
      beschreibung: `Delaware LLC: ${STAAT_EN.delaware.gruendung} to form, ${STAAT_EN.delaware.jahr} annual tax from tax year 2026, due 1 June. When Delaware is the right fit — and when it is not.`,
    },
    stand: S,
    erschienen: S,
    kennung: "FG · 20",
    auge: "Knowledge · US state",
    h1: "Delaware.",
    h1b: "The state for investors.",
    lead: "Delaware is famous for its corporate law: dedicated courts for corporate disputes, a long-established body of case law, investors who know it. For a corporation with plans to bring in investors, that counts in its favour — for a small LLC it often does not, because the annual tax has just gone up.",
    ziffern: [
      { wert: STAAT_EN.delaware.gruendung, label: "Forming an LLC" },
      { wert: STAAT_EN.delaware.jahr, label: "Annual LLC tax from tax year 2026" },
      { wert: "1 June", label: "Annual tax deadline" },
    ],
    blick: [
      ["Formation", `${STAAT_EN.delaware.gruendung} (${STAAT_EN.delaware.gruendungDetail})`],
      ["Each year", `${STAAT_EN.delaware.jahr} ${STAAT_EN.delaware.jahrName}, due ${STAAT_EN.delaware.jahrFrist}`],
      ["Late payment", STAAT_EN.delaware.jahrVerzug],
      ["New", "from tax year 2026, $400 instead of $300"],
      ["Registered agent", STAAT_EN.delaware.agent],
      ["Corporation", "annual report $50, Franchise Tax from $175, due 1 March"],
    ],
    kurz: `Forming an LLC in Delaware costs ${STAAT_EN.delaware.gruendung}. Every year, an annual tax of ${STAAT_EN.delaware.jahr} is due on 1 June — from tax year 2026; before that it was $300. A registered agent with an office in Delaware is mandatory. Delaware is suited above all to corporations that want to take on investors.`,
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
        typ: "karten", id: "wann", h2: "When Delaware is the right fit — and when it is not", spalten: 2,
        karten: [
          { tag: "Good fit", titel: "Corporation with investors", text: "US investors, employee equity programmes, a later sale: this is where Delaware is the standard everyone knows." },
          { tag: "Rarely a fit", titel: "Small LLC without investors", text: "For an LLC that handles orders or builds up a card history, the annual tax of $400 is a cost that brings nothing in return." },
        ],
      },
      vergleich(2),
      {
        typ: "hinweis", id: "wissen", h2: "What you need to know",
        punkte: [
          `The annual LLC tax is due even if the company is dormant. If it is paid late, ${STAAT_EN.delaware.jahrVerzug.replace("if late, ", "")} is added.`,
          "A Delaware company that does business in another state generally has to register there as well — with separate fees.",
          GLOBAL_PFLICHTHINWEIS.en[0],
        ],
      },
      { typ: "paket", id: "paket", h2: "The right package", lead: "For corporations with plans to bring in investors: formation, EIN and coordination with a lawyer and a tax adviser.", paket: "global_struktur" },
    ],
    fragen: [
      { f: "How much does a Delaware LLC cost?", a: `Formation costs ${STAAT_EN.delaware.gruendung}, and the annual tax is ${STAAT_EN.delaware.jahr} — from tax year 2026, due on 1 June of the following year. Before that it was $300.` },
      { f: "Why do so many companies incorporate in Delaware?", a: "Because of its corporate law: dedicated courts for corporate disputes, a long-established body of case law and investors who know it. This matters above all for corporations with investors." },
      { f: "Does Delaware make sense for a small LLC?", a: "Rarely. For an LLC without plans to bring in investors, the annual tax is a cost that brings nothing in return; Florida or Wyoming are often a better fit." },
      { f: "Does a Delaware company have to register in other states?", a: "If it does business in another state, generally yes — with separate fees there." },
    ],
    paket: "global_struktur",
    weiter: ["/business/wissen/llc-oder-corporation", "/business/florida", "/business/wyoming", "/business/agenturen-software"].map(globalEnPfad),
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
    stand: S,
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
          `The annual report is due in the month of formation; ${STAAT_EN.wyoming.jahrVerzug}. The deadline is in your compliance calendar.`,
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
      { f: "Is Wyoming better than Delaware?", a: "For an LLC without investors, Wyoming is usually cheaper to maintain. For a corporation with plans to bring in investors, Delaware is the standard." },
    ],
    paket: "global_struktur",
    weiter: ["/business/wissen/us-llc-steuern", "/business/florida", "/business/delaware", "/business/wissen/bundesstaat-waehlen"].map(globalEnPfad),
    quellen: QUELLEN_STAATEN_EN.wyoming,
  },
];
