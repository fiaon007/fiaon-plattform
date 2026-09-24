// ═══════════════════════════════════════════════════════════════════════════
// FIAON GLOBAL — DIE KOSTEN, ENGLISCH (24.09.2026, E-234)
// Britische Schwester von /business/kosten (kosten.ts), Adresse aus
// shared/fiaon-global-pfade.ts: /en/business/costs. Gleicher Aufbau, gleiche
// Anker (ids), dieselben Quellen. Zahlen Dritter aus fakten-en.ts (Stand und
// Quelle dort), Preise nur über globalPreisText(…, "en"), Jahresbetreuung über
// globalJahresbetreuungPreisText("en"). Prüfstand: scripts/pruef-global-en.ts.
// ═══════════════════════════════════════════════════════════════════════════
import {
  GLOBAL_INKLUSIVE, GLOBAL_KAPITAL_FREI, GLOBAL_LAUFEND, GLOBAL_PAKETE,
  globalJahresbetreuungPreisText, globalPaket, globalPlanungText, globalPreisText,
} from "../../fiaon-global";
import { globalEnPfad } from "../../fiaon-global-pfade";
import { FAKTEN_STAND_EN, IRS_EN, MARKT_EN, QUELLEN_IRS_EN, QUELLEN_STAATEN_EN, STAAT_EN } from "../fakten-en";
import type { GlobalSeite } from "../typen";

const gross = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
const STRUKTUR_PREIS = globalPreisText("global_struktur", "en");
const JAHRESBETREUUNG = globalJahresbetreuungPreisText("en");
const VIP_NAME = globalPaket("global_vip")?.en.name ?? "";

export const KOSTEN_EN: GlobalSeite[] = [
  {
    pfad: "/en/business/costs",
    sprache: "en",
    schwester: "/business/kosten",
    art: "preise",
    seo: {
      titel: "US LLC formation costs and annual fees — FIAON Global",
      beschreibung: "What a US LLC costs: state fees in Florida, Delaware and Wyoming, running costs from year two and the FIAON Global fixed price — with sources.",
    },
    stand: "2026-09-24",
    erschienen: "2026-09-24",
    kennung: "FG · 07",
    auge: "Prices and process · Costs",
    h1: "What a US company costs.",
    h1b: "One-off and annual — stated openly.",
    lead: "The state charges little for a US company. The expensive part is what nobody mentions in advance: the registered agent, the annual filing, the tax adviser, the US CPA. This page sets out everything — the FIAON Global fixed price, what it includes and what is due from the second year onwards.",
    ziffern: [
      { wert: `from ${STRUKTUR_PREIS}`, label: "Fixed price, one-off — first year included" },
      { wert: `${STAAT_EN.wyoming.gruendung} to ${STAAT_EN.florida.gruendung}`, label: "State formation fee for an LLC" },
      { wert: "from year two", label: "State, registered agent, US filing — listed in advance" },
    ],
    blick: [
      ["Fixed price", `${GLOBAL_PAKETE.map((p) => globalPreisText(p.key, "en")).join(" · ")}`],
      ["Included", "State fee, registered agent and address in the first year, EIN, ITIN, lawyer, tax adviser, US CPA"],
      ["State, one-off", `Florida ${STAAT_EN.florida.gruendung} · Delaware ${STAAT_EN.delaware.gruendung} · Wyoming ${STAAT_EN.wyoming.gruendung}`],
      ["State, annual", `Florida ${STAAT_EN.florida.jahr} · Delaware ${STAAT_EN.delaware.jahr} · Wyoming ${STAAT_EN.wyoming.jahr}`],
      ["IRS", "EIN and ITIN free of charge"],
      ["VAT", "Companies: plus VAT where applicable · Private individuals: final prices"],
    ],
    kurz: `Forming a US LLC costs ${STAAT_EN.wyoming.gruendung} (Wyoming) to ${STAAT_EN.florida.gruendung} (Florida) in state fees; the IRS issues the EIN and ITIN free of charge. Each year, costs arise for the state fee or tax, the registered agent (market rate: ${MARKT_EN.agent}) and the IRS filing by a US CPA (market rate: ${MARKT_EN.cpa5472}). With FIAON Global, the first year is included in the fixed price from ${STRUKTUR_PREIS} — with a lawyer, a tax adviser and a US CPA.`,
    bloecke: [
      {
        typ: "tabelle", id: "festpreise", h2: "The fixed prices",
        lead: "Every package is a support engagement at a fixed price, paid once. No subscription, no monthly instalment.",
        kopf: ["Package", "Fixed price", "Capital range", "Support"],
        zeilen: GLOBAL_PAKETE.map((p) => [p.en.name, globalPreisText(p.key, "en"), globalPlanungText(p.key, "en"), gross(p.en.dauerKurz)]),
        hervor: 1,
        fuss: [
          "Companies: plus VAT where applicable. Private individuals: final prices. The capital range is your goal; the institution concerned decides on every limit.",
          // Wortlaut aus GLOBAL_KAPITAL_FREI — Kapital-Satz nur zusammen mit dem Satz zum Partner-Steuerberater.
          `${GLOBAL_KAPITAL_FREI.en.satz} ${GLOBAL_KAPITAL_FREI.en.steuer}`,
        ],
      },
      {
        typ: "text", id: "enthalten", h2: "What the fixed price includes",
        absaetze: ["You pay one price. We pay everyone who works on your company — in each of the four packages:"],
        punkte: [...GLOBAL_INKLUSIVE.en],
        nach: `Beyond this, the larger packages include further card applications, the compliance calendar, the key-figures file and, in the ${VIP_NAME} package, flights and hotel for the kick-off in Miami.`,
      },
      {
        typ: "tabelle", id: "staaten", h2: "What the states charge",
        lead: "The three states people ask about most often — amounts for an LLC.",
        kopf: ["", "Florida", "Delaware", "Wyoming"],
        zeilen: [
          ["Formation", STAAT_EN.florida.gruendung, STAAT_EN.delaware.gruendung, STAAT_EN.wyoming.gruendung],
          ["Annual", `${STAAT_EN.florida.jahr} (${STAAT_EN.florida.jahrName})`, `${STAAT_EN.delaware.jahr} (${STAAT_EN.delaware.jahrName})`, `${STAAT_EN.wyoming.jahr} (${STAAT_EN.wyoming.jahrName})`],
          ["Deadline", "1 January to 1 May", STAAT_EN.delaware.jahrFrist, "Month of formation"],
          ["If late", STAAT_EN.florida.jahrVerzug, STAAT_EN.delaware.jahrVerzug, "dissolution possible after sixty days"],
          ["Registered agent", "Required", "Required", "Required"],
        ],
        fuss: [
          `As of ${FAKTEN_STAND_EN}. ${STAAT_EN.florida.gruendung} in Florida = ${STAAT_EN.florida.gruendungDetail}.`,
          `Delaware: ${STAAT_EN.delaware.jahrAlt}`,
          `Wyoming: ${STAAT_EN.wyoming.jahrDetail}.`,
          "Different amounts apply to corporations; the details are on the states’ own websites.",
        ],
      },
      {
        typ: "tabelle", id: "laufend", h2: "Annual costs from the second year onwards",
        lead: GLOBAL_LAUFEND.en,
        kopf: ["Item", "Amount", "Note"],
        zeilen: [
          ["State fee or tax", "$60 to $400", "depending on the state, see above"],
          ["Registered agent", MARKT_EN.agent, "required by law"],
          ["Form 5472 with Form 1120", MARKT_EN.cpa5472, "by a US CPA, mandatory even without revenue"],
          ["Tax adviser in your home country", "at their own rates", "tax return and reporting of the shareholding"],
          ["FIAON Global annual care plan", `${JAHRESBETREUUNG} a year`, "state fee, registered agent, address, phone and Form 5472 included"],
        ],
        fuss: [`Registered agent and US CPA: published prices of several providers, September 2026 — not official figures. With the annual care plan, we cover every item except the tax adviser in your home country — for ${JAHRESBETREUUNG} a year, all fees included (as of 19 September 2026).`],
      },
      {
        typ: "tabelle", id: "selbst", h2: "Organised yourself — or included in the fixed price",
        lead: "What each authority or provider would charge separately. If you need only one company and coordinate everything yourself, you pay less than our fixed price — and bear every risk alone.",
        kopf: ["Item", "Organised yourself", "FIAON Global"],
        zeilen: [
          ["State formation fee", `${STAAT_EN.wyoming.gruendung} to ${STAAT_EN.florida.gruendung}`, "included"],
          ["Registered agent, first year", MARKT_EN.agent.replace(" a year", ""), "included"],
          ["US address and phone number", "depending on the provider", "included, first year"],
          ["EIN", "no fee, but your own time and effort", "included"],
          ["ITIN via an acceptance agent", MARKT_EN.acceptanceAgent, "included"],
          ["Operating agreement by a lawyer", "at their own rates", "included"],
          ["Review by a tax adviser", "at their own rates", "included"],
          ["First Form 5472 by a US CPA", MARKT_EN.cpa5472.replace(" a year", ""), "included"],
          ["Account and card application, coordination", "your time", "included"],
        ],
        hervor: 2,
        fuss: [`State and IRS fees: official figures, as of ${FAKTEN_STAND_EN}. Other items: market ranges.`],
      },
      {
        typ: "hinweis", id: "wissen", h2: "What you need to know",
        punkte: [
          "Ongoing bookkeeping, sales tax registrations in the US and the tax return in your home country are not part of the packages.",
          `For a missed Form 5472, the IRS can impose a penalty of ${IRS_EN.strafe5472} — the most expensive item is the forgotten one.`,
          "State fees change: with effect from tax year 2026, Delaware has raised the annual LLC tax from $300 to $400.",
        ],
      },
      { typ: "pakete", id: "pakete", h2: "The four packages", lead: "Fixed price, one-off — all fees and our partners’ professional fees included." },
    ],
    fragen: [
      { f: "How much does it cost to form an LLC in the US?", a: `The state charges ${STAAT_EN.wyoming.gruendung} (Wyoming), ${STAAT_EN.delaware.gruendung} (Delaware) or ${STAAT_EN.florida.gruendung} (Florida). On top of that come the registered agent, address, lawyer, tax adviser and US CPA. With FIAON Global all of this is included in the fixed price from ${STRUKTUR_PREIS}.` },
      { f: "What are the running costs of a US LLC?", a: `Each year, you pay the state fee or tax ($60 to $400 depending on the state), the registered agent (market rate: ${MARKT_EN.agent}) and a US CPA for the IRS filing (market rate: ${MARKT_EN.cpa5472}).` },
      { f: "How much does an EIN or ITIN cost?", a: `The IRS charges nothing. If you apply for the ITIN through an acceptance agent, the market rate is ${MARKT_EN.acceptanceAgent}. With FIAON Global both applications are included in the fixed price.` },
      { f: "Are there any hidden costs?", a: `No. What the fixed price covers is set out in the contract. If you wish, the annual care plan covers your company’s running costs from the second year for ${JAHRESBETREUUNG} a year, all fees included; bookkeeping and the tax return in your home country are not part of the packages.` },
      { f: "Is VAT included in the fixed price?", a: "For companies, VAT is added to the prices where applicable. For private individuals, the fixed prices are final prices." },
      { f: "Why is the fixed price higher than the state fee?", a: "Because it covers everyone who works on your company: registered agent, address, phone, lawyer, tax adviser, US CPA, the EIN and ITIN applications and the preparation of the account and card applications — coordinated by one contact." },
    ],
    weiter: ["/business/vergleich", "/business/paket-finder", "/business/privatpersonen", "/business/us-pflichten"].map(globalEnPfad),
    quellen: [...QUELLEN_STAATEN_EN.florida.slice(0, 2), QUELLEN_STAATEN_EN.delaware[0], QUELLEN_STAATEN_EN.delaware[1], QUELLEN_STAATEN_EN.wyoming[0], QUELLEN_STAATEN_EN.wyoming[1], QUELLEN_IRS_EN[0], QUELLEN_IRS_EN[2], QUELLEN_IRS_EN[4]],
  },
];
