// ═══════════════════════════════════════════════════════════════════════════
// FIAON GLOBAL — DIE KOSTEN, ENGLISCH (24.09.2026, E-234)
// Britische Schwester von /business/kosten (kosten.ts), Adresse aus
// shared/fiaon-global-pfade.ts: /en/business/costs. Gleicher Aufbau, gleiche
// Anker (ids), dieselben Quellen. Zahlen Dritter aus fakten-en.ts (Stand und
// Quelle dort). Prüfstand: scripts/pruef-global-en.ts.
// E-509 (12.11.2026): EIN Produkt statt vier Pakete — Beträge nur aus der Preisquelle und verkaufPreis (wie im Deutschen).
// E-510 (13.11.2026): nach dem Sprachleitfaden (Abschnitt 7.5). Ein Wort je Sache: engagement · fee · funding target ·
// the lender · annual administration · priority handling · fee calculator. Die Honorare stehen immer in drei Zeilen
// (fester Satz S12), “at least” statt “from”. Feste Sätze, Beträge und die Erstattung kommen aus
// shared/fiaon-global-saetze.ts — hier wird keiner davon getippt. Kein Wort zur Bürgschaft.
// ═══════════════════════════════════════════════════════════════════════════
import { GLOBAL_KAPITAL_FREI } from "../../fiaon-global";
import { VERKAUF_KURS_VORGABE, verkaufEur, verkaufPreis, verkaufUsd } from "../../fiaon-global-verkauf";
import { VERKAUF_RAHMEN } from "../../fiaon-global-verkauf-preise";
import { GELD_ZURUECK, SAETZE_BETRAEGE, SECHS_SCHRITTE, beleg, satz, weitererSatz } from "../../fiaon-global-saetze";
import { EIN_PRODUKT } from "../ein-produkt";
import { globalEnPfad } from "../../fiaon-global-pfade";
import { FAKTEN_STAND_EN, IRS_EN, MARKT_EN, QUELLEN_IRS_EN, QUELLEN_STAATEN_EN, STAAT_EN } from "../fakten-en";
import type { GlobalSeite } from "../typen";
// E-465 (29.10.2026): registration times and express per state from the single source.
import { BUNDESSTAATEN, STAATEN_STAND_TEXT } from "../../fiaon-global-bundesstaaten";

/** The amounts from the price source — never typed. */
const B = SAETZE_BETRAEGE.en;
/** From ein-produkt.ts, so that every page says the same: the list “included in the first year”, the line on the success fee (from S12) and the heading of the card “One engagement”. */
const P = EIN_PRODUKT.en;
/** Examples for the success fee — calculated as in the fee calculator, at the fallback rate of the display. First and last value from the price source. */
const BEISPIEL_RAHMEN = [VERKAUF_RAHMEN.minUsd, 100_000, 150_000, 250_000, 500_000, VERKAUF_RAHMEN.selbstMaxUsd];
const MONATE = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const KURS_TAG = VERKAUF_KURS_VORGABE.kursDatum.replace(/^(\d{4})-(\d{2})-(\d{2})$/, (_m, j, m, t) => `${Number(t)} ${MONATE[Number(m) - 1]} ${j}`);
const KURS = VERKAUF_KURS_VORGABE.kursUsdJeEur.toLocaleString("en-GB", { minimumFractionDigits: 4, maximumFractionDigits: 4 });

/** The fees in three lines — fixed sentence S12, word for word. */
const S12 = satz("S12", "en");
/** The fees in short form (guide 1.3, answer to “What does it cost — and when?”) — for answers in which S12 would be too long. */
const HONORAR_KURZ = `${B.honorarAuftrag} on engagement. On registration of your company, the success fee set by your funding target — at least ${B.erfolgMin}. From the second year, on request, ${B.jahresbetreuung} a year.`;
/** Step 5 (financing): what applies if it does not come about — from the table “who does what”. */
const WENN_ES_AUSBLEIBT = SECHS_SCHRITTE.en.find((s) => s.nr === 5)?.werMachtWas.wennEsAusbleibt ?? satz("S7", "en");
/** “$60 to $400” — the range of the annual state fee, built from fakten-en.ts. */
const JAHR_SPANNE = `${STAAT_EN.wyoming.jahr.replace(/^at least /, "")} to ${STAAT_EN.delaware.jahr}`;
const GRUENDUNG_SPANNE = `${STAAT_EN.wyoming.gruendung} to ${STAAT_EN.florida.gruendung}`;

export const KOSTEN_EN: GlobalSeite[] = [
  {
    pfad: "/en/business/costs",
    sprache: "en",
    schwester: "/business/kosten",
    art: "preise",
    seo: {
      titel: "US LLC formation costs and annual fees — FIAON Global",
      beschreibung: "What a US LLC costs: state fees in Delaware, Florida and Wyoming, running costs from the second year and our fees — with sources and dates.",
    },
    stand: "2026-11-13",
    erschienen: "2026-09-24",
    kennung: "FG · 07",
    auge: "Fees and process · Costs",
    h1: "What a US LLC costs.",
    h1b: "One-off and running costs, with sources.",
    lead: "The state charges little to form a US company. Most of the cost lies in the registered agent, the annual US filing and the tax advisers. This page sets out every amount: our fees, what they cover in the first year and what falls due from the second year.",
    // The fees stand in the eye-catcher in full: three amounts, each with the point at which it falls due (guide 5.6).
    ziffern: [
      { wert: B.honorarAuftrag, label: "on engagement: formation and administration in the first year" },
      { wert: `at least ${B.erfolgMin}`, label: "success fee, due on registration of your company" },
      { wert: `${B.jahresbetreuung} a year`, label: "annual administration from the second year, on request" },
    ],
    blick: [
      ["State, one-off", `Delaware ${STAAT_EN.delaware.gruendung} · Florida ${STAAT_EN.florida.gruendung} · Wyoming ${STAAT_EN.wyoming.gruendung}`],
      ["State, annual", `Delaware ${STAAT_EN.delaware.jahr} · Florida ${STAAT_EN.florida.jahr} · Wyoming ${STAAT_EN.wyoming.jahr}`],
      ["IRS", "No fee from the US tax authority for the EIN or the ITIN"],
      ["We handle", "Formation, documents and the EIN and ITIN applications; we prepare your applications for accounts, credit cards on request and financing in full"],
      ["You", "Choose the name, upload your passport and sign; you submit the applications to the institution and the card issuer yourself"],
      ["Who decides", "The state on registration, the US tax authority on the EIN and the ITIN, the institution concerned on accounts, cards and financing"],
      ["Refund", WENN_ES_AUSBLEIBT],
      ["Fees in full", "All fees are stated in full in your proposal before you sign"],
    ],
    kurz: `State fees for forming a US LLC range from ${STAAT_EN.wyoming.gruendung} (Wyoming) to ${STAAT_EN.florida.gruendung} (Florida); the US tax authority, the IRS, issues the EIN and the ITIN without a fee. ${S12}`,
    bloecke: [
      {
        typ: "tabelle", id: "festpreise", h2: "What does it cost to form a US LLC with FIAON Global?",
        lead: `One engagement: ${weitererSatz("PRODUKTNAME", "en")}. ${weitererSatz("ZAHLUNG", "en")}`,
        kopf: ["When", "What", "Amount"],
        zeilen: [
          ["On engagement", "Formation and administration in the first year", B.honorarAuftrag],
          ["On engagement, on request", "Priority handling: precedence at each step", B.fastTrack],
          ["On registration of your company", "Success fee set by your funding target", `at least ${B.erfolgMin}`],
          ["From the second year, on request", "Annual administration; it does not renew automatically", `${B.jahresbetreuung} a year`],
        ],
        hervor: 2,
        fuss: [`${weitererSatz("HONORAR-SCHLUSS", "en")} ${beleg("honorarVorab", "en")}`],
      },
      {
        typ: "tabelle", id: "erfolgshonorar", h2: "The success fee by funding target",
        lead: P.erfolg,
        kopf: ["Funding target", "Success fee", "First year in total"],
        zeilen: BEISPIEL_RAHMEN.map((usd) => { const p = verkaufPreis(usd, VERKAUF_KURS_VORGABE.kursUsdJeEur); return [verkaufUsd(usd, "en"), verkaufEur(p.erfolgCents, "en"), verkaufEur(p.erstesJahrCents, "en")]; }),
        hervor: 1,
        fuss: [
          `Examples without priority handling, converted at the European Central Bank reference rate of ${KURS_TAG} (€1 = US$${KURS}). The fee calculator shows the schedule of fees for your funding target.`,
          // The figure for the funding target never stands alone: S9 and S1 in the same view (guide 5.8).
          `${satz("S9", "en")} ${satz("S1", "en")}`,
          weitererSatz("MIAMI", "en"),
          // Wortlaut aus GLOBAL_KAPITAL_FREI — Kapital-Satz nur zusammen mit dem Satz zum Partner-Steuerberater.
          `${GLOBAL_KAPITAL_FREI.en.satz} ${GLOBAL_KAPITAL_FREI.en.steuer}`,
        ],
      },
      {
        typ: "text", id: "enthalten", h2: "First year: included and not included",
        absaetze: [`Your fees cover the following services in the first year. ${weitererSatz("ROLLEN", "en")}`],
        punkte: [...P.enthalten],
        nach: "Not included: the charges and interest of card issuers and institutions, the cost of the loan, and taxes. Available on request: annual administration from the second year and priority handling. You submit the applications to the institution and the card issuer yourself.",
      },
      {
        typ: "tabelle", id: "staaten", h2: "What the states charge",
        lead: "The three states in which we form companies — amounts for an LLC.",
        kopf: ["", "Delaware", "Florida", "Wyoming"],
        zeilen: [
          ["Formation", STAAT_EN.delaware.gruendung, STAAT_EN.florida.gruendung, STAAT_EN.wyoming.gruendung],
          ["Annual", `${STAAT_EN.delaware.jahr} (${STAAT_EN.delaware.jahrName})`, `${STAAT_EN.florida.jahr} (${STAAT_EN.florida.jahrName})`, `${STAAT_EN.wyoming.jahr} (${STAAT_EN.wyoming.jahrName})`],
          ["Deadline", STAAT_EN.delaware.jahrFrist, "1 January to 1 May", "Month of formation"],
          ["If late", STAAT_EN.delaware.jahrVerzug, STAAT_EN.florida.jahrVerzug, STAAT_EN.wyoming.jahrVerzug],
          ["Registered agent", "Required", "Required", "Required"],
          [`Registration, based on experience (as at ${STAATEN_STAND_TEXT.en})`, BUNDESSTAATEN.delaware.eintragungKurz.en, BUNDESSTAATEN.florida.eintragungKurz.en, BUNDESSTAATEN.wyoming.eintragungKurz.en],
          ["Express", BUNDESSTAATEN.delaware.express.kurz.en, BUNDESSTAATEN.florida.express.kurz.en, BUNDESSTAATEN.wyoming.express.kurz.en],
        ],
        fuss: [
          `Source: the fee schedules and statutes of the three states (sources at the end of this page). As at ${FAKTEN_STAND_EN}. ${STAAT_EN.florida.gruendung} in Florida = ${STAAT_EN.florida.gruendungDetail}.`,
          `Delaware: ${STAAT_EN.delaware.jahrAlt}`,
          `Wyoming: ${STAAT_EN.wyoming.jahrDetail}.`,
          `Registration times: as at ${STAATEN_STAND_TEXT.en}. ${satz("S15", "en")}`,
          "Different amounts apply to corporations; the details are on the states’ own websites.",
        ],
      },
      {
        typ: "tabelle", id: "laufend", h2: "Running costs from the second year",
        lead: `From the second year your company incurs running costs: the state fee, the registered agent and the annual US filing. Under annual administration we cover these items for ${B.jahresbetreuung} a year; it does not renew automatically.`,
        kopf: ["Item", "Amount", "Note"],
        zeilen: [
          ["State fee or tax", JAHR_SPANNE, "depending on the state, see above"],
          ["Registered agent", MARKT_EN.agent, "required by law"],
          ["Form 5472 with Form 1120", MARKT_EN.cpa5472, "by a US certified public accountant (CPA); mandatory even without revenue"],
          ["Tax adviser in your country of residence", "at their own rates", "tax return and reporting of the shareholding"],
          ["FIAON Global annual administration", `${B.jahresbetreuung} a year`, "on request: state fee, registered agent, US business address, US telephone number and Form 5472 included"],
        ],
        fuss: [`Registered agent and US CPA: figures published by several providers, as at ${FAKTEN_STAND_EN} — not official figures. Annual administration covers every item except the tax adviser in your country of residence.`],
      },
      {
        typ: "tabelle", id: "selbst", h2: "Organised yourself or under one engagement",
        lead: "For context: what each authority or provider charges separately. If you need only a company and coordinate everything yourself, you pay less than with us; coordination and risk then remain with you.",
        kopf: ["Item", "Organised yourself", "FIAON Global"],
        zeilen: [
          ["State formation fee", GRUENDUNG_SPANNE, "included"],
          ["Registered agent, first year", MARKT_EN.agent.replace(" a year", ""), "included"],
          ["US business address and US telephone number", "depending on the provider", "included, first year"],
          ["EIN", "no fee, but your own time and effort", "application included"],
          ["ITIN via an acceptance agent", MARKT_EN.acceptanceAgent, "application included, following our ITIN check"],
          ["Operating agreement", "a template or a lawyer, at their own rates", "included"],
          ["Tax questions clarified beforehand", "a tax adviser, at their own rates", "rest with partner tax advisers; FIAON bears their fees"],
          ["First Form 5472 by a US certified public accountant (CPA)", MARKT_EN.cpa5472.replace(" a year", ""), "included"],
          ["Preparation of the account and card applications", "your time", "included; the institution concerned decides"],
        ],
        hervor: 2,
        fuss: [`State and IRS fees: official figures, as at ${FAKTEN_STAND_EN}. Other items: market ranges.`],
      },
      {
        // The refund in its medium form (guide 5.7) — only for financing, with the start of the period, clause 4 and the lender sentence (both in S7).
        typ: "text", id: "geld-zurueck", h2: GELD_ZURUECK.en.auge,
        absaetze: [satz("S7", "en")],
        punkte: [...GELD_ZURUECK.en.mittel],
        nach: "This does not apply to accounts and cards.",
      },
      {
        typ: "hinweis", id: "wissen", h2: "What you need to know",
        punkte: [
          "Ongoing bookkeeping, sales tax registrations in the United States and the tax return in your country of residence are not part of your engagement.",
          `For a missed Form 5472, the US tax authority, the IRS, can impose a penalty of ${IRS_EN.strafe5472} — the costliest item is the one that is forgotten.`,
          `State fees change: with effect from tax year 2026, Delaware has raised the annual LLC tax from $300 to ${STAAT_EN.delaware.jahr}.`,
          "We form in Delaware, Florida or Wyoming. Unless you specify otherwise, we form in Delaware; Delaware is familiar to banks and investors.",
        ],
      },
      { typ: "pakete", id: "mandat", h2: P.karteH2, lead: "The fee calculator shows the schedule of fees for your funding target." },
    ],
    fragen: [
      { f: "How much does it cost to form an LLC in the US?", a: `The state charges ${STAAT_EN.wyoming.gruendung} (Wyoming), ${STAAT_EN.delaware.gruendung} (Delaware) or ${STAAT_EN.florida.gruendung} (Florida). In addition, you pay market rates for a registered agent, a US business address, an operating agreement and the annual US filing. Our fees: ${HONORAR_KURZ}` },
      { f: "What are the running costs of a US LLC?", a: `Three items a year. The state fee or tax: ${JAHR_SPANNE} depending on the state. The registered agent: market rate ${MARKT_EN.agent}. The filing with the US tax authority by a US certified public accountant (CPA): market rate ${MARKT_EN.cpa5472}. Under annual administration we cover these items for ${B.jahresbetreuung} a year; it does not renew automatically.` },
      { f: "How much does an EIN or ITIN cost?", a: `The US tax authority, the IRS, charges nothing. If you apply for the ITIN through an acceptance agent, the market rate is ${MARKT_EN.acceptanceAgent}. With FIAON Global both applications are included in the fee; we apply for the ITIN following our ITIN check. The US tax authority decides on both numbers.` },
      { f: "What is not included in the fee?", a: `Not included: the charges and interest of card issuers and institutions, the cost of the loan, and taxes. Available on request: annual administration from the second year (${B.jahresbetreuung} a year) and priority handling (${B.fastTrack}). Ongoing bookkeeping and the tax return in your country of residence are likewise not part of your engagement. Your agreement sets out what the fee covers.` },
      { f: "What do I pay, and when?", a: S12 },
      { f: "Why is the fee higher than the state fee?", a: "Because it covers more than the state filing: your company’s documents, its US office in the first year and the EIN and ITIN applications. It also covers the first US filing and fully prepared account and card applications; the institution concerned decides on each of them. FIAON bears the partners’ fees for the services in your agreement." },
    ],
    weiter: ["/business/delaware", "/business/florida", "/business/wyoming", "/business/wissen/bundesstaat-waehlen", "/business/vergleich", "/business/ablauf", "/business/privatpersonen", "/business/us-pflichten"].map(globalEnPfad),
    quellen: [...QUELLEN_STAATEN_EN.florida.slice(0, 2), QUELLEN_STAATEN_EN.delaware[0], QUELLEN_STAATEN_EN.delaware[1], QUELLEN_STAATEN_EN.wyoming[0], QUELLEN_STAATEN_EN.wyoming[1], QUELLEN_IRS_EN[0], QUELLEN_IRS_EN[2], QUELLEN_IRS_EN[4]],
  },
];
