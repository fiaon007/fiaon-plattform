// ═══════════════════════════════════════════════════════════════════════════
// FIAON GLOBAL — DIE KOSTEN, ENGLISCH (24.09.2026, E-234)
// Britische Schwester von /business/kosten (kosten.ts), Adresse aus
// shared/fiaon-global-pfade.ts: /en/business/costs. Gleicher Aufbau, gleiche
// Anker (ids), dieselben Quellen. Zahlen Dritter aus fakten-en.ts (Stand und
// Quelle dort). Prüfstand: scripts/pruef-global-en.ts.
// E-509 (12.11.2026): EIN Produkt statt vier Pakete — Preise nur aus EIN_PRODUKT.en und verkaufPreis (wie im Deutschen).
// ═══════════════════════════════════════════════════════════════════════════
import { GLOBAL_KAPITAL_FREI, GLOBAL_LAUFEND } from "../../fiaon-global";
import { VERKAUF_KURS_VORGABE, verkaufEur, verkaufPreis, verkaufUsd } from "../../fiaon-global-verkauf";
import { EIN_PRODUKT } from "../ein-produkt";
import { globalEnPfad } from "../../fiaon-global-pfade";
import { FAKTEN_STAND_EN, IRS_EN, MARKT_EN, QUELLEN_IRS_EN, QUELLEN_STAATEN_EN, STAAT_EN } from "../fakten-en";
import type { GlobalSeite } from "../typen";
// E-465 (29.10.2026): registration times and express per state from the single source.
import { BUNDESSTAATEN, STAAT_WAHL_SATZ, STAATEN_STAND_TEXT } from "../../fiaon-global-bundesstaaten";

const P = EIN_PRODUKT.en;
const JAHRESBETREUUNG = P.jahres;
/** Examples for the success fee — calculated as in the configurator, at the fallback rate of the display. */
const BEISPIEL_RAHMEN = [50_000, 100_000, 150_000, 250_000, 500_000, 950_000];
const MONATE = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const KURS_TAG = VERKAUF_KURS_VORGABE.kursDatum.replace(/^(\d{4})-(\d{2})-(\d{2})$/, (_m, j, m, t) => `${Number(t)} ${MONATE[Number(m) - 1]} ${j}`);
const KURS = VERKAUF_KURS_VORGABE.kursUsdJeEur.toLocaleString("en-GB", { minimumFractionDigits: 4, maximumFractionDigits: 4 });

export const KOSTEN_EN: GlobalSeite[] = [
  {
    pfad: "/en/business/costs",
    sprache: "en",
    schwester: "/business/kosten",
    art: "preise",
    seo: {
      titel: "US LLC formation costs and annual fees — FIAON Global",
      beschreibung: "What a US LLC costs: state fees in Florida, Delaware and Wyoming, running costs from year two and the price of FIAON Global — with sources.",
    },
    stand: "2026-11-12",
    erschienen: "2026-09-24",
    kennung: "FG · 07",
    auge: "Prices and process · Costs",
    h1: "What a US company costs.",
    h1b: "One-off and annual — stated openly.",
    lead: "The state charges little for a US company. The expensive part is what nobody mentions in advance: the registered agent, the annual filing, the tax adviser, the US CPA. This page sets out everything — the price of FIAON Global, what it includes and what is due from the second year onwards.",
    ziffern: [
      { wert: P.preis, label: P.preisLabel },
      { wert: `${STAAT_EN.wyoming.gruendung} to ${STAAT_EN.florida.gruendung}`, label: "State formation fee for an LLC" },
      { wert: "from year two", label: "State, registered agent, US filing — listed in advance" },
    ],
    blick: [
      ["Price", `${P.preis} with your order · success fee on registration · ${P.jahres} a year from year two`],
      ["Included", "State fee, registered agent, address, phone and assistance in the first year, EIN, ITIN, lawyer, US accountant"],
      ["State, one-off", `Florida ${STAAT_EN.florida.gruendung} · Delaware ${STAAT_EN.delaware.gruendung} · Wyoming ${STAAT_EN.wyoming.gruendung}`],
      ["State, annual", `Florida ${STAAT_EN.florida.jahr} · Delaware ${STAAT_EN.delaware.jahr} · Wyoming ${STAAT_EN.wyoming.jahr}`],
      ["IRS", "EIN and ITIN free of charge"],
      ["Final prices", "All amounts are final prices"],
    ],
    kurz: `Forming a US LLC costs ${STAAT_EN.wyoming.gruendung} (Wyoming) to ${STAAT_EN.florida.gruendung} (Florida) in state fees; the IRS issues the EIN and ITIN free of charge. Each year, costs arise for the state fee or tax, the registered agent (market rate: ${MARKT_EN.agent}) and the IRS filing by a US CPA (market rate: ${MARKT_EN.cpa5472}). With FIAON Global, the first year is included in the price of ${P.preis} — with a lawyer and a US accountant from our partner network.`,
    bloecke: [
      {
        typ: "tabelle", id: "festpreise", h2: "The price",
        lead: `One order: ${P.name}. No subscription, no monthly instalment.`,
        kopf: ["When", "What", "Price"],
        zeilen: [
          ["With your order", "Formation with active management in the first year", P.preis],
          ["With your order, on request", "Fast track: priority at every step", P.fastTrack],
          ["On registration", "Success fee according to your capital range, surety included", "see below"],
          ["From the second year, on request", "Annual care", `${P.jahres} a year`],
        ],
        hervor: 2,
        fuss: [
          "All amounts are final prices. You choose the capital range yourself; the financing institution decides on the financing.",
          // Wortlaut aus GLOBAL_KAPITAL_FREI — Kapital-Satz nur zusammen mit dem Satz zum Partner-Steuerberater.
          `${GLOBAL_KAPITAL_FREI.en.satz} ${GLOBAL_KAPITAL_FREI.en.steuer}`,
        ],
      },
      {
        typ: "tabelle", id: "erfolgshonorar", h2: "The success fee by capital range",
        lead: P.erfolg,
        kopf: ["Capital range", "Success fee", "First year in total"],
        zeilen: BEISPIEL_RAHMEN.map((usd) => { const p = verkaufPreis(usd, VERKAUF_KURS_VORGABE.kursUsdJeEur); return [verkaufUsd(usd, "en"), verkaufEur(p.erfolgCents, "en"), verkaufEur(p.erstesJahrCents, "en")]; }),
        hervor: 1,
        fuss: [
          `Examples without fast track, converted at the European Central Bank reference rate of ${KURS_TAG} (€1 = US$${KURS}). The configurator shows your exact price.`,
          "From US$1 million we work with you in person in Miami; below that, everything runs remotely.",
        ],
      },
      {
        typ: "text", id: "enthalten", h2: "What the price includes",
        absaetze: ["You pay one price. We bear our partners’ fees for the services in your order:"],
        punkte: [...P.enthalten],
        nach: "Legal and tax work is done by lawyers and US accountants from our partner network, each under their own mandate. You file the applications to banks and card issuers yourself; we prepare every one in full.",
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
          [`Registration (as of ${STAATEN_STAND_TEXT.en})`, BUNDESSTAATEN.florida.eintragungKurz.en, BUNDESSTAATEN.delaware.eintragungKurz.en, BUNDESSTAATEN.wyoming.eintragungKurz.en],
          ["Express", BUNDESSTAATEN.florida.express.kurz.en, BUNDESSTAATEN.delaware.express.kurz.en, BUNDESSTAATEN.wyoming.express.kurz.en],
        ],
        fuss: [
          `As of ${FAKTEN_STAND_EN}; registration times as of ${STAATEN_STAND_TEXT.en}, experience rather than a commitment. ${STAAT_EN.florida.gruendung} in Florida = ${STAAT_EN.florida.gruendungDetail}.`,
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
        typ: "tabelle", id: "selbst", h2: "Organised yourself — or from one source",
        lead: "What each authority or provider would charge separately. If you need only one company and coordinate everything yourself, you pay less than with us — and bear every risk alone.",
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
          "Ongoing bookkeeping, sales tax registrations in the US and the tax return in your home country are not part of your order.",
          `For a missed Form 5472, the IRS can impose a penalty of ${IRS_EN.strafe5472} — the most expensive item is the forgotten one.`,
          "State fees change: with effect from tax year 2026, Delaware has raised the annual LLC tax from $300 to $400.",
          STAAT_WAHL_SATZ.en,
        ],
      },
      { typ: "pakete", id: "mandat", h2: P.karteH2, lead: P.karteLead },
    ],
    fragen: [
      { f: "How much does it cost to form an LLC in the US?", a: `The state charges ${STAAT_EN.wyoming.gruendung} (Wyoming), ${STAAT_EN.delaware.gruendung} (Delaware) or ${STAAT_EN.florida.gruendung} (Florida). On top of that come the registered agent, address, lawyer, tax adviser and US CPA. With FIAON Global all of this is included in the price of ${P.preis}.` },
      { f: "What are the running costs of a US LLC?", a: `Each year, you pay the state fee or tax ($60 to $400 depending on the state), the registered agent (market rate: ${MARKT_EN.agent}) and a US CPA for the IRS filing (market rate: ${MARKT_EN.cpa5472}).` },
      { f: "How much does an EIN or ITIN cost?", a: `The IRS charges nothing. If you apply for the ITIN through an acceptance agent, the market rate is ${MARKT_EN.acceptanceAgent}. With FIAON Global both applications are included in the price.` },
      { f: "Are there any hidden costs?", a: `No. What the price covers is set out in the contract. If you wish, the annual care plan covers your company’s running costs from the second year for ${JAHRESBETREUUNG} a year, all fees included; bookkeeping and the tax return in your home country are not part of your order.` },
      { f: "What do I pay, and when?", a: P.preisSatzKurz },
      { f: "Why is the price higher than the state fee?", a: "Because it covers everyone who works on your company: registered agent, address, phone, assistance, lawyer, US accountant, the EIN and ITIN applications and the preparation of the account and card applications — coordinated by one contact." },
    ],
    weiter: ["/business/wissen/bundesstaat-waehlen", "/business/vergleich", "/business/ablauf", "/business/privatpersonen", "/business/us-pflichten"].map(globalEnPfad),
    quellen: [...QUELLEN_STAATEN_EN.florida.slice(0, 2), QUELLEN_STAATEN_EN.delaware[0], QUELLEN_STAATEN_EN.delaware[1], QUELLEN_STAATEN_EN.wyoming[0], QUELLEN_STAATEN_EN.wyoming[1], QUELLEN_IRS_EN[0], QUELLEN_IRS_EN[2], QUELLEN_IRS_EN[4]],
  },
];
