// ═══════════════════════════════════════════════════════════════════════════
// FIAON GLOBAL — HONORAR UND ABLAUF AUF ENGLISCH (24.09.2026, E-234)
// Die britisch-englischen Schwestern von preise.ts: Ablauf (/en/business/process),
// und Vergleich (/en/business/comparison). /en/business/package-finder leitet seit E-509 dauerhaft auf /en/business/start.
// Gleicher Aufbau, gleiche Anker (ids bleiben deutsch). Prüfstand: scripts/pruef-global-en.ts.
// E-509 (12.11.2026): ONE product instead of four packages — amounts only from the price source.
// E-510 (13.11.2026): nach dem Sprachleitfaden. The process counts the SIX steps in their fixed order — formation, documents,
// accounts, credit cards on request, financing, refinancing and increase — word for word from shared/fiaon-global-saetze.ts.
// Proposal, signature, invoice and passport stand before them under “Your engagement begins”, without step numbers.
// Timings only as experience, with the party that decides (fixed sentence S15). One word per thing: engagement · client · fee ·
// funding target · the lender · proposal · fee calculator. No word on the surety; partners only with their responsibility.
// ═══════════════════════════════════════════════════════════════════════════
import { GLOBAL_PFLICHTHINWEIS } from "../../fiaon-global";
import { globalEnPfad } from "../../fiaon-global-pfade";
import { globalMenuePunkt } from "../../fiaon-global-menue";
import { SAETZE_BETRAEGE, SCHRITTE_KOPF, satz, sechsSchritte, weitererSatz } from "../../fiaon-global-saetze";
import { STAATEN_STAND_TEXT } from "../../fiaon-global-bundesstaaten";
import type { GlobalSeite } from "../typen";
import { EIN_PRODUKT } from "../ein-produkt";

const S = "2026-11-13";
const ERSCHIENEN = "2026-09-24";
/** The amounts from the price source — never typed. */
const B = SAETZE_BETRAEGE.en;
/** The six steps, word for word from the source of the fixed sentences. */
const SCHRITTE = sechsSchritte("en").schritte;
const KOPF = SCHRITTE_KOPF.en;
/** The fees in short form (guide 1.3, answer to “What does it cost — and when?”). */
const HONORAR_KURZ = `${B.honorarAuftrag} on engagement. On registration of your company, the success fee set by your funding target — at least ${B.erfolgMin}. From the second year, on request, ${B.jahresbetreuung} a year.`;
/** The same as one line for “At a glance” — always all three parts. */
const HONORAR_ZEILE = `${B.honorarAuftrag} on engagement · success fee on registration, at least ${B.erfolgMin} · from the second year, on request, ${B.jahresbetreuung} a year`;
/** The card “One engagement” at the end of both pages — heading and introduction as on every page (ein-produkt.ts). */
const KARTE = { h2: EIN_PRODUKT.en.karteH2, lead: EIN_PRODUKT.en.karteLead };
/** The name of the costs page as it stands in the menu — for the reference in the footnote of the table. */
const KOSTEN_SEITE = globalMenuePunkt(globalEnPfad("/business/kosten"))?.titel ?? "Costs at a glance";
/** Timings per step, based on experience (table “How long it takes”) — never a deadline, always with the party that decides. */
const ERFAHRUNG: Record<number, string> = {
  1: "registration takes a few days to around two weeks, depending on the state",
  2: "EIN and ITIN on the US tax authority’s own timeline",
  3: "after review by the institution concerned",
  4: "after review by the card issuer",
  5: "the aim and the conditions are set out in your agreement",
  6: "from the eighteenth month, with annual administration in place",
};

export const PREISE_UND_ABLAUF_EN: GlobalSeite[] = [
  // ─────────────────────────────────────────────────────────────────────────
  {
    pfad: "/en/business/process",
    sprache: "en",
    schwester: "/business/ablauf",
    art: "preise",
    seo: {
      titel: "How to form a US company: the six steps — FIAON Global",
      beschreibung: "Forming a US company in six steps: what we do, what you do yourself and who decides. Timings are based on experience; they are not deadlines.",
    },
    stand: S,
    erschienen: ERSCHIENEN,
    kennung: "FG · 08",
    auge: "Fees and process · Process",
    h1: "How a US company is formed.",
    h1b: "Six steps, one sequence.",
    lead: "From formation through to the lender’s decision: at every point you can see who acts, who decides and what follows next. Your portal shows the current status.",
    ziffern: [
      { wert: "6 steps", label: "each with its condition" },
      { wert: "1 engagement", label: "one agreement, one dedicated contact" },
      { wert: "1 portal", label: "status, documents and compliance calendar" },
    ],
    blick: [
      ["Your proposal", "Request your proposal or arrange a call"],
      ["Agreement", "Signed online; agreement and invoice by email"],
      ["Work begins", "Once your payment and your passport have been received"],
      ["You", "Choose the name, upload your passport and sign; you submit the applications to the institutions yourself"],
      ["Who decides", "The state, the US tax authority and the institution concerned"],
      ["Status", "At any time in your portal: current step, documents, compliance calendar"],
      ["Timings", "Based on experience, not deadlines — set by authorities and institutions"],
    ],
    kurz: `Your engagement begins with your proposal: you request it in the fee calculator or arrange a call first, and you sign online. Once your payment and your passport have been received, six steps follow: formation, documents, accounts, credit cards on request, financing, and refinancing and increase. Registration is decided by the state, the EIN and the ITIN by the US tax authority, and accounts, cards and financing by the institution concerned. ${satz("S15", "en")}`,
    bloecke: [
      {
        // Proposal, signature, invoice and passport stand BEFORE the six steps — without step numbers of their own (guide 2.1).
        typ: "text", id: "beginn", h2: "Your engagement begins",
        absaetze: ["Four things are in place before the first step begins:"],
        punkte: [
          "Your proposal: you request it in the fee calculator or arrange a call first — thirty minutes, free of charge.",
          "Your signature: you read your complete agreement in your personal proposal, choose the name of your company and sign online. The agreement is in German; your contracting party is FIAON LTD, London.",
          `Your invoice: you receive the agreement and the invoice by email, together with access to your portal. ${weitererSatz("ZAHLUNG", "en")}`,
          "Your passport: you upload it once you have signed. We begin once your payment and your passport have been received.",
        ],
      },
      {
        typ: "etappen", id: "schritte", h2: KOPF.h2, lead: KOPF.lead,
        etappen: SCHRITTE.map((s) => ({ titel: s.titel, text: `${s.satz} ${s.bedingung} ${KOPF.teile.ihrErgebnis}: ${s.ihrErgebnis}` })),
      },
      {
        // The table “who does what — and what applies if something does not come about” (guide 2.4), in full. The column
        // “Partners” appears publicly only once the partners are confirmed; until then their responsibility is stated below.
        typ: "tabelle", id: "wer", h2: "Who acts, who decides",
        lead: "For each step: what FIAON does, what you do yourself, who decides — and what applies if it does not come about.",
        kopf: [KOPF.spalten.schritt, KOPF.spalten.fiaon, KOPF.spalten.sie, KOPF.spalten.entscheidet, KOPF.spalten.wennEsAusbleibt],
        zeilen: SCHRITTE.map((s) => [`${s.nr} ${s.titel}`, s.werMachtWas.fiaon, s.werMachtWas.sie, s.entscheidet, s.werMachtWas.wennEsAusbleibt]),
        fuss: [weitererSatz("ROLLEN", "en")],
      },
      {
        typ: "tabelle", id: "dauer", h2: "How long it takes",
        lead: satz("S15", "en"),
        kopf: ["Step", "Based on experience", "Who decides"],
        zeilen: SCHRITTE.map((s) => [`${s.nr} ${s.titel}`, ERFAHRUNG[s.nr] ?? "", s.entscheidet]),
        hervor: 1,
        fuss: [`Registration times: as at ${STAATEN_STAND_TEXT.en}; the figures for each state are on the page “${KOSTEN_SEITE}”.`],
      },
      {
        typ: "hinweis", id: "wissen", h2: "What you need to know",
        punkte: [...GLOBAL_PFLICHTHINWEIS.en, satz("S7", "en")],
      },
      { typ: "pakete", id: "mandat", h2: KARTE.h2, lead: KARTE.lead },
    ],
    fragen: [
      { f: "How long does it take to form my US company?", a: `${satz("S15", "en")} The timings for each step are set out above in the table “How long it takes”, together with who decides in each case.` },
      { f: "When does the work begin?", a: "Once your payment and your passport have been received. From then on you can see the status in your portal at any time." },
      { f: "Where can I see the status of my engagement?", a: "In your portal: current step, next action, documents and compliance calendar. You are given access together with the agreement and the invoice." },
      { f: "What do I have to do myself?", a: `You choose the name, upload your passport and sign the documents we present. ${satz("S2", "en")}` },
    ],
    weiter: ["/business/kosten", "/business/vergleich", "/business/us-firmengruendung", "/business/privatpersonen"].map(globalEnPfad),
  },

  // E-509 (12.11.2026): /en/business/package-finder is gone — the fee calculator /en/business/start is the new finder;
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
    auge: "Fees and process · Comparison",
    h1: "US LLC formation: yourself or a service.",
    h1b: "Three routes compared.",
    lead: "You can form a US company yourself, through a formation service or with FIAON Global. The difference lies not in the formation itself but in everything that follows: taxes, filings, accounts, cards — and who coordinates it all.",
    ziffern: [
      { wert: "3 routes", label: "yourself, formation service, FIAON Global" },
      { wert: "8 points of contact", label: "if you form the company yourself, you approach each one separately" },
      { wert: "1 engagement", label: "with FIAON Global: one agreement for all steps" },
    ],
    blick: [
      ["Yourself", "Third-party fees only; coordination and risk stay with you"],
      ["Service", "Formation handled; taxes, accounts, cards stay with you"],
      ["FIAON Global", "Formation, documents, applications under one engagement"],
      ["What matters", "Who coordinates the lawyer, the tax adviser, the US CPA and the applications to the institutions?"],
      ["For context", "If you need only the formation, you pay less with a formation service"],
      ["Fees", HONORAR_ZEILE],
    ],
    kurz: "Anyone who forms a US company themselves pays only the fees. They approach eight parties separately: the state, the registered agent, the US tax authority, a lawyer, a tax adviser, a US certified public accountant (CPA), banks and card issuers. A formation service handles the formation but usually leaves taxes, accounts and cards to you. FIAON Global brings formation, documents and the preparation of your applications together under one engagement; FIAON bears the partners’ fees for the services in your agreement. You submit the applications yourself; each institution decides.",
    bloecke: [
      {
        typ: "tabelle", id: "vergleich", h2: "The three routes compared",
        kopf: ["", "Form it yourself", "Formation service", "FIAON Global"],
        zeilen: [
          ["Formation with the state", "yourself", "included", "included"],
          ["Registered agent and address", "arrange it yourself", "usually included, often renewing annually", "first year included"],
          ["EIN", "apply yourself", "often included", "application included"],
          ["ITIN", "yourself, with an acceptance agent", "rarely included", "application included, following our ITIN check"],
          ["Tax questions clarified beforehand", "arrange it yourself", "not included", "rest with partner tax advisers"],
          ["Operating agreement", "a template, or instruct a lawyer yourself", "usually a template", "included"],
          ["First US filing (Form 5472)", "yourself, or engage a US CPA", "often at extra cost", "included"],
          ["Account and card applications", "yourself", "rarely", "fully prepared"],
          ["One dedicated contact", "no", "no", "yes"],
        ],
        hervor: 3,
        fuss: [
          "“Formation service” describes the usual offering on the market; individual providers may differ.",
          satz("S2", "en"),
        ],
      },
      {
        typ: "karten", id: "wann", h2: "When each route fits", spalten: 3,
        karten: [
          { tag: "Yourself", titel: "If you have the time and the experience", text: "If you know the US forms, have a tax adviser with US experience and need only a company, this route costs you the least." },
          { tag: "Formation service", titel: "If only the formation matters", text: "If you need only the formation and plan neither accounts nor credit cards nor financing, you pay less with a formation service." },
          { tag: "FIAON Global", titel: "If documents and applications have to fit together", text: "For business owners whose plans warrant a US company of their own. Under one engagement: formation, documents and fully prepared applications for accounts, credit cards on request and financing. The institution concerned decides on each application." },
        ],
      },
      {
        typ: "text", id: "unterschied", h2: "The real difference",
        absaetze: [
          "Formation with the state is a single form. What makes a US company expensive is what comes afterwards: a missed Form 5472, an account application with inconsistent documents, card applications without an orderly sequence. Or a tax liability in your country of residence that nobody clarified beforehand.",
          weitererSatz("ROLLEN", "en"),
        ],
        // On every page that mentions financing: the sentence on what applies if it does not arrive (S7, with the start of the period, clause 4 and the lender).
        nach: `On financing: ${satz("S7", "en")}`,
      },
      { typ: "pakete", id: "mandat", h2: KARTE.h2, lead: KARTE.lead },
    ],
    fragen: [
      { f: "Is FIAON Global more expensive than a formation service?", a: `Yes, if you need only the formation. Our fees: ${HONORAR_KURZ} In the first year they also cover your company’s documents, its US office, the EIN and ITIN applications and the first US filing.` },
      { f: "Can I form the company myself and instruct FIAON only for accounts and cards?", a: `Where you already have a US company, we do not form a new one. ${weitererSatz("UNTERLAGEN-ZUERST", "en")} Account and card applications require documents that are consistent from the outset; the institution concerned decides on each application.` },
      { f: "Does FIAON name its competitors?", a: "No. The comparison describes the usual offering on the market, not individual providers." },
    ],
    weiter: ["/business/kosten", "/business/ablauf", "/business/wissen/anbieter-pruefen", "/business/us-firmengruendung"].map(globalEnPfad),
  },
];
