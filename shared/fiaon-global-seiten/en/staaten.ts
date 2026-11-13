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
//
// E-510 (13.11.2026) — Wortlaut nach dem Sprachleitfaden, zusammen mit staaten.ts geändert:
// kein Satz über ein eigenes Team vor Ort, “Delaware is familiar to banks and investors.”, jede Dauer als
// Erfahrungswert mit Stand und Entscheider (nie in Titel, Beschreibung, H1, Lead oder Kennziffer), kein
// Honorar-Betrag auf diesen Seiten. Der Baustein „standorte“ der Florida-Seite ist wie in staaten.ts entfallen.
// Die Sätze je Staat kommen aus STAAT_SEITENTEXT (bundesstaat-wahl.ts), feste Sätze aus shared/fiaon-global-saetze.ts.
// ═══════════════════════════════════════════════════════════════════════════
import { GLOBAL_AGENT, GLOBAL_PFLICHTHINWEIS } from "../../fiaon-global";
import { globalEnPfad } from "../../fiaon-global-pfade";
import { FAKTEN_STAND_EN, IRS_EN, QUELLEN_STAATEN_EN, STAAT_EN } from "../fakten-en";
import type { GlobalBlock, GlobalSeite } from "../typen";
import { STAATEN_STAND_TEXT, STAATEN_ZUR_WAHL } from "../../fiaon-global-bundesstaaten";
import { beleg, satz, sechsSchritte, vierSchritte } from "../../fiaon-global-saetze";
import { STAAT_SEITENTEXT, staatEintragung } from "../bundesstaat-wahl";

/** Tag der Erstveröffentlichung der englischen Seiten. */
const S = "2026-09-24";
/** Tag der letzten inhaltlichen Änderung (E-510: Wortlaut nach dem Sprachleitfaden). */
const STAND_SEITE = "2026-11-13";
// E-465 (29.10.2026): Eintragungszeiten als Erfahrungswerte, Express und Delaware als Standard für neue Mandate.
const ZEIT = STAATEN_STAND_TEXT.en;
/** Heading of the “One engagement” block (E-509: one product instead of four packages; wording as in the style guide, 4.2 no. 46). */
const KARTE_H2 = "One engagement";

// Feste Wortlaute aus shared/fiaon-global-saetze.ts — hier nur zusammengesetzt, nie neu getippt.
/** What we do at formation, and who decides (short version, place 1). */
const GRUENDUNG = vierSchritte("en").schritte[0].text;
/** What the client does (step 1). */
const IHR_TEIL = sechsSchritte("en").schritte[0].ihrTeil;
/** The sentence on fees, without an amount. */
const HONORAR_VORAB = beleg("honorarVorab", "en");
/** Which state fees the first year includes (agreement, clause 2). */
const STAAT_ENTHALTEN = "The engagement with FIAON Global includes the state formation fee and the first annual report to the state.";

/** The three states compared — the same table on every state page (E-465: order Delaware, Florida, Wyoming; registration and express). */
function vergleich(hervor: 1 | 2 | 3): GlobalBlock {
  return {
    typ: "tabelle", id: "vergleich", h2: "Delaware, Florida and Wyoming compared",
    lead: `The three states for an LLC side by side. Registration times as at ${ZEIT}: based on experience, not deadlines. The state decides.`,
    kopf: ["", ...STAATEN_ZUR_WAHL.map((b) => b.name)],
    zeilen: [
      ["Registration", ...STAATEN_ZUR_WAHL.map((b) => b.eintragungKurz.en)],
      ["Express", ...STAATEN_ZUR_WAHL.map((b) => b.express.kurz.en)],
      ["Formation", STAAT_EN.delaware.gruendung, STAAT_EN.florida.gruendung, STAAT_EN.wyoming.gruendung],
      ["Paid to the state each year", STAAT_EN.delaware.jahr, STAAT_EN.florida.jahr, STAAT_EN.wyoming.jahr],
      ["Deadline", "1 June", "1 January to 1 May", "Month of formation"],
      ["State tax", "depends on the activity", "5.5% for corporations", "no corporate or personal income tax"],
      ["Strength", "Express service; familiar to banks and investors", "Business and appointments in Florida", "Low running costs"],
    ],
    hervor,
    fuss: [`Times as at ${ZEIT}, amounts as at ${FAKTEN_STAND_EN} for LLCs. Delaware: ${STAAT_EN.delaware.jahrAlt}`, satz("S15", "en")],
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
      beschreibung: `Florida LLC: ${STAAT_EN.florida.gruendung} state formation fee, ${STAAT_EN.florida.jahr} annual report due by 1 May, registered agent with a Florida address. With sources and dates.`,
    },
    stand: STAND_SEITE,
    erschienen: S,
    kennung: "FG · 19",
    auge: "Knowledge · US state",
    h1: "Florida LLC.",
    h1b: "For business and appointments in the state.",
    lead: "Florida suits companies that operate there: with customers, projects or appointments in the state. The fees are set by statute, and the annual report has a fixed deadline in spring. At present Florida takes longer than usual to register a company, and the state offers no express service.",
    ziffern: [
      { wert: STAAT_EN.florida.gruendung, label: "State formation fee for an LLC" },
      { wert: STAAT_EN.florida.jahr, label: "Annual report, 1 January to 1 May" },
      { wert: "No express", label: `Florida offers no expedited service (as at ${ZEIT})` },
    ],
    blick: [
      ["Registration", `based on experience: around two weeks at present, no express (as at ${ZEIT}); the state decides`],
      ["Formation", `${STAAT_EN.florida.gruendung} — ${STAAT_EN.florida.gruendungDetail}`],
      ["Each year", `${STAAT_EN.florida.jahr} ${STAAT_EN.florida.jahrName}, ${STAAT_EN.florida.jahrFrist}`],
      ["Late filing", STAAT_EN.florida.jahrVerzug],
      ["Registered agent", STAAT_EN.florida.agent],
      ["State tax", STAAT_EN.florida.steuer],
      ["LLC owned by a GmbH or AG", "the owning company files its own Florida tax return (Form F-1120)"],
    ],
    kurz: `Forming an LLC in Florida costs ${STAAT_EN.florida.gruendung} in state fees. Every year, an annual report costing ${STAAT_EN.florida.jahr} is due between 1 January and 1 May; after 1 May, a further $400 is added. A registered agent with an address in Florida is mandatory. Registration often takes around two weeks at present, with no express service (based on experience, as at ${ZEIT}); the state decides.`,
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
        fuss: [`As at ${FAKTEN_STAND_EN}; sources at the end of the page.`],
      },
      {
        typ: "text", id: "wann", h2: "When Florida is the right fit",
        absaetze: ["Florida is not a state chosen for tax reasons, nor one chosen for investors. It is the state for companies that operate there. Florida is the right fit if:"],
        punkte: [
          "your customers, suppliers or projects are in Florida",
          "your company has an office, a warehouse or employees in Florida",
          "you need in-person appointments — with authorities or institutions",
          "you wish to use an institution with branches in Florida",
        ],
        nach: STAAT_EN.florida.llcSteuer,
      },
      vergleich(2),
      {
        typ: "hinweis", id: "wissen", h2: "What you need to know",
        punkte: [
          `Registration: ${staatEintragung("florida", "en")} With a fixed timetable, Delaware with express or Wyoming are the options to consider.`,
          `Anyone who files the annual report after 1 May pays ${STAAT_EN.florida.jahrVerzug.replace("after 1 May ", "")}. The deadline is in your compliance calendar.`,
          GLOBAL_PFLICHTHINWEIS.en[0],
          `Regardless of the state, the IRS requires Form 5472 with Form 1120 every year; failure to file can result in a penalty of ${IRS_EN.strafe5472}.`,
        ],
      },
      { typ: "paket", id: "mandat", h2: KARTE_H2, lead: `${GRUENDUNG} ${IHR_TEIL} In the fee calculator, Delaware is the state provided for; we agree a formation in Florida with you in a call.`, paket: "global_struktur" },
    ],
    fragen: [
      { f: "How much does a Florida LLC cost?", a: `Formation costs ${STAAT_EN.florida.gruendung} in state fees, and the annual report costs ${STAAT_EN.florida.jahr} a year. ${STAAT_ENTHALTEN} ${HONORAR_VORAB}` },
      { f: "When is the Florida annual report due?", a: "Between 1 January and 1 May, starting in the year after formation. After 1 May, a late fee of $400 is added." },
      { f: "Does a Florida LLC pay corporate income tax?", a: "An LLC that is disregarded for tax purposes does not file its own Florida return. If it is owned by a corporation such as a GmbH, the owner files a Florida return; corporations pay 5.5% with a $50,000 exemption." },
      { f: "How long does formation take in Florida?", a: staatEintragung("florida", "en") },
      { f: "Do I need a Florida address for my LLC?", a: "The company needs a registered agent with an address in Florida. We provide the registered agent and the US business address in the first year." },
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
      beschreibung: `Delaware LLC: ${STAAT_EN.delaware.gruendung} state formation fee, ${STAAT_EN.delaware.jahr} annual tax due 1 June, state express service for an official fee. When Delaware fits — with sources and dates.`,
    },
    stand: STAND_SEITE,
    erschienen: S,
    kennung: "FG · 20",
    auge: "Knowledge · US state",
    h1: "Delaware LLC.",
    h1b: "Familiar to banks and investors.",
    lead: `Delaware is known for its corporate law: a dedicated court for corporate disputes and an extensive body of case law. Delaware is familiar to banks and investors. The state offers an express service for registration; the drawback is the annual tax of ${STAAT_EN.delaware.jahr}.`,
    ziffern: [
      { wert: STAAT_EN.delaware.gruendung, label: "State formation fee for an LLC" },
      { wert: STAAT_EN.delaware.jahr, label: "Annual LLC tax from tax year 2026" },
      { wert: "Express", label: `Expedited state service for an official fee (as at ${ZEIT})` },
    ],
    blick: [
      ["Registration", `based on experience: one or two business days with express (as at ${ZEIT}); the state decides`],
      ["Formation", `${STAAT_EN.delaware.gruendung} (${STAAT_EN.delaware.gruendungDetail})`],
      ["Each year", `${STAAT_EN.delaware.jahr} ${STAAT_EN.delaware.jahrName}, due ${STAAT_EN.delaware.jahrFrist}`],
      ["Late payment", STAAT_EN.delaware.jahrVerzug],
      ["New", `from tax year 2026, ${STAAT_EN.delaware.jahr} instead of $300`],
      ["Registered agent", STAAT_EN.delaware.agent],
      ["Corporation", "annual report $50, Franchise Tax of at least $175, due 1 March"],
    ],
    kurz: `Forming an LLC in Delaware costs ${STAAT_EN.delaware.gruendung}. Every year, an annual tax of ${STAAT_EN.delaware.jahr} is due on 1 June. A registered agent with an office in Delaware is mandatory. With the state’s express service, registration usually takes one or two business days (based on experience, as at ${ZEIT}); the state decides. Delaware is our standard for new engagements.`,
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
        fuss: [STAAT_EN.delaware.jahrAlt, `As at ${FAKTEN_STAND_EN}; sources at the end of the page.`],
      },
      {
        typ: "karten", id: "wann", h2: "When Delaware fits — and when not", spalten: 3,
        karten: [
          { tag: "Good fit", titel: "A fixed timetable", text: "Delaware offers an express service for registration; the timings based on experience are set out in the comparison. Delaware is familiar to banks and investors." },
          { tag: "Good fit", titel: "Corporation with investors", text: "US investors, employee equity programmes, a later sale: for these, a corporation in Delaware is generally chosen." },
          { tag: "Less of a fit", titel: "When low running costs matter", text: `The annual tax of ${STAAT_EN.delaware.jahr} is the highest of the three states. If low running costs matter most, Wyoming is lower, with ${STAAT_EN.wyoming.jahr} in License Tax a year.` },
        ],
      },
      vergleich(1),
      {
        typ: "hinweis", id: "wissen", h2: "What you need to know",
        punkte: [
          `Registration: ${staatEintragung("delaware", "en")}`,
          `The annual LLC tax is due even if the company is dormant. If it is paid late, ${STAAT_EN.delaware.jahrVerzug.replace("if late, ", "")} is added.`,
          "A Delaware company that does business in another state generally has to register there as well — with separate fees.",
          GLOBAL_PFLICHTHINWEIS.en[0],
        ],
      },
      { typ: "paket", id: "mandat", h2: KARTE_H2, lead: `${GRUENDUNG} ${IHR_TEIL}`, paket: "global_struktur" },
    ],
    fragen: [
      { f: "How much does a Delaware LLC cost?", a: `Formation costs ${STAAT_EN.delaware.gruendung} in state fees, and the annual tax is ${STAAT_EN.delaware.jahr} — from tax year 2026, due on 1 June of the following year. Before that it was $300.` },
      { f: "Why do so many companies incorporate in Delaware?", a: "Because of its corporate law: a dedicated court for corporate disputes, an extensive body of case law and investors to whom Delaware is familiar. This matters above all for corporations with investors." },
      { f: "How long does registration take in Delaware?", a: staatEintragung("delaware", "en") },
      { f: "Does Delaware make sense for a small LLC as well?", a: `Often, yes: the state offers an express service, and Delaware is familiar to banks and investors. The drawback is the annual tax of ${STAAT_EN.delaware.jahr}. If low running costs matter most, Wyoming is lower.` },
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
      beschreibung: `Wyoming LLC: ${STAAT_EN.wyoming.gruendung} state formation fee, License Tax of ${STAAT_EN.wyoming.jahr} a year, no state corporate income tax, not a tax scheme. With sources and dates.`,
    },
    stand: STAND_SEITE,
    erschienen: S,
    kennung: "FG · 21",
    auge: "Knowledge · US state",
    h1: "Wyoming LLC.",
    h1b: "Low running costs.",
    lead: `Wyoming is the state of low fees: ${STAAT_EN.wyoming.gruendung} to form, ${STAAT_EN.wyoming.jahr} a year, no state corporate or personal income tax. For an LLC that does not operate in any particular state, these are the lowest running costs of the three states. It is not a tax scheme for business owners from Germany, Austria or Switzerland.`,
    ziffern: [
      { wert: STAAT_EN.wyoming.gruendung, label: "State formation fee for an LLC" },
      { wert: STAAT_EN.wyoming.jahr, label: "License Tax per year" },
      { wert: "none", label: "State corporate and personal income tax" },
    ],
    blick: [
      ["Registration", `based on experience: around three business days (as at ${ZEIT}); the state decides`],
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
        fuss: [`As at ${FAKTEN_STAND_EN}; sources at the end of the page.`],
      },
      {
        typ: "text", id: "wann", h2: "When Wyoming is the right fit",
        absaetze: [
          "Wyoming is the right fit if your LLC does not operate in any particular state and you want to keep its running costs low. That applies, for example, to a company that does its business online or is building a payment record in the United States.",
          "It does not work as a tax scheme: although Wyoming levies no corporate income tax of its own, the company remains taxable where it is managed, and its reporting obligations to the IRS remain unchanged.",
        ],
      },
      vergleich(3),
      {
        typ: "hinweis", id: "wissen", h2: "What you need to know",
        punkte: [
          `Registration: ${staatEintragung("wyoming", "en")}`,
          STAAT_SEITENTEXT.wyoming.nachteile.en[0],
          `The annual report is due in the month of formation; ${STAAT_EN.wyoming.jahrVerzug}. The deadline is in your compliance calendar.`,
          "Wyoming requires a contact person with an address and telephone number for every company — usually you yourself as the owner. We file these details confidentially; they are not publicly visible.",
          GLOBAL_PFLICHTHINWEIS.en[0],
          `Regardless of the state, the IRS requires Form 5472 with Form 1120 every year; failure to file can result in a penalty of ${IRS_EN.strafe5472}.`,
        ],
      },
      { typ: "paket", id: "mandat", h2: KARTE_H2, lead: `${GRUENDUNG} ${IHR_TEIL} In the fee calculator, Delaware is the state provided for; we agree a formation in Wyoming with you in a call.`, paket: "global_struktur" },
    ],
    fragen: [
      { f: "How much does a Wyoming LLC cost?", a: `Formation costs ${STAAT_EN.wyoming.gruendung} in state fees; each year, the annual report costs ${STAAT_EN.wyoming.jahr} in License Tax. ${STAAT_ENTHALTEN} ${HONORAR_VORAB}` },
      { f: "Does a Wyoming LLC pay any tax?", a: "Wyoming levies no corporate income tax and no state income tax. However, the company is taxable where it is managed — for business owners from Germany, Austria or Switzerland, usually in their home country." },
      { f: "When is the Wyoming annual report due?", a: "On the first day of the month in which the company was formed. If the report is more than sixty days overdue, the state may dissolve the company." },
      { f: "Is Wyoming better than Delaware?", a: `Wyoming has the lower running costs: ${STAAT_EN.wyoming.jahr} in License Tax a year compared with ${STAAT_EN.delaware.jahr} in annual tax in Delaware. Delaware is familiar to banks and investors; some institutions look more closely at Wyoming companies with no business in the state. The registration times of both states are set out in the comparison, based on experience.` },
      { f: "How long does registration take in Wyoming?", a: staatEintragung("wyoming", "en") },
    ],
    paket: "global_struktur",
    weiter: ["/business/wissen/us-llc-steuern", "/business/florida", "/business/delaware", "/business/wissen/bundesstaat-waehlen"].map(globalEnPfad),
    quellen: QUELLEN_STAATEN_EN.wyoming,
  },
];
