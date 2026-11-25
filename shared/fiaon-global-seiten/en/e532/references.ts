// ═══════════════════════════════════════════════════════════════════════════
// FIAON GLOBAL — ENGAGEMENTS AND REFERENCES: WHO WE WORK FOR (25.11.2026, E-532) · FG · 56
// English sister of /business/referenzen — same blocks, same anchors, same count (as of 25.11.2026). Client names
// NEVER appear in this public source code; once clients consent in writing, the page reads them from the database.
// ═══════════════════════════════════════════════════════════════════════════
import type { GlobalSeite } from "../../typen";
import { beleg, satz, weitererSatz } from "../../../fiaon-global-saetze";
import { globalEnPfad } from "../../../fiaon-global-pfade";
import { FIAON_FIRMA as F } from "../../../fiaon-firma";

const STAND = "2026-11-25";
const STAND_TEXT = "25 November 2026";

export const SEITE: GlobalSeite = {
  pfad: "/en/business/references",
  sprache: "en",
  schwester: "/business/referenzen",
  art: "partner",
  seo: {
    titel: "Engagements and references: who we work for — FIAON Global",
    beschreibung: "Who FIAON Global works for: companies, founders and private individuals with a US company. We name references only with their written consent.",
  },
  stand: STAND,
  erschienen: STAND,
  kennung: "FG · 56",
  auge: "FIAON Global · Engagements and references",
  h1: "Who we work for.",
  h1b: "Names only with consent.",
  lead: "FIAON Global works for companies, founders and private individuals building a US company. This page shows who the engagement is designed for, what our engagements look like today — and why we name clients only with their consent.",
  ziffern: [
    { wert: "Delaware · Florida", label: `States of our clients' companies, as of ${STAND_TEXT}` },
    { wert: "DE · CH", label: `Our clients' countries of residence, as of ${STAND_TEXT}` },
    { wert: "1 contract", label: "per engagement, with one dedicated contact" },
  ],
  blick: [
    ["Who for", "Companies, founders and private individuals with plans in the United States"],
    ["Engagement", "One contract, one dedicated contact"],
    ["States", `Delaware and Florida (as of ${STAND_TEXT})`],
    ["Clients' residence", `Germany and Switzerland (as of ${STAND_TEXT})`],
    ["References", "Only with the client's written consent"],
    ["Not suitable", "Plans without genuine business activity"],
  ],
  kurz: `FIAON Global works for companies, founders and private individuals building a US company. As of ${STAND_TEXT}, our clients live in Germany and in Switzerland; we form their companies in Delaware and Florida. We name clients only with their written consent.`,
  bloecke: [
    {
      typ: "karten", id: "fuerwen", h2: "Who the engagement is designed for", spalten: 3,
      karten: [
        { tag: "SMEs", titel: "A subsidiary in the United States", text: "For companies entering the US market with a company of their own.", pfad: globalEnPfad("/business/tochtergesellschaft-usa") },
        { tag: "E-commerce", titel: "E-commerce and brands", text: "For retailers and brands selling to customers in the United States.", pfad: globalEnPfad("/business/onlinehandel") },
        { tag: "Service providers", titel: "Agencies and software", text: "For agencies and software firms with clients in the United States.", pfad: globalEnPfad("/business/agenturen-software") },
        { tag: "Projects", titel: "Construction and property", text: "For projects and properties in the United States.", pfad: globalEnPfad("/business/bau-immobilien") },
        { tag: "Private", titel: "Individuals and founders", text: "For anyone instructing us without a company of their own.", pfad: globalEnPfad("/business/privatpersonen") },
        { tag: "Miami", titel: "In person in Miami", text: weitererSatz("MIAMI", "en"), pfad: globalEnPfad("/business/miami") },
      ],
    },
    {
      typ: "tabelle", id: "profil", h2: "Our engagements at a glance",
      lead: "The profile of our current engagements — without names, with a date.",
      kopf: ["Item", `As of ${STAND_TEXT}`],
      zeilen: [
        ["Clients' residence", "Germany, Switzerland"],
        ["States of the companies", "Delaware, Florida"],
        ["Contract", "Signed online, in German, under German law"],
        ["Payment", `By invoice to ${F.name}`],
      ],
      fuss: ["Counted are signed engagements that have not been cancelled. We name clients only with their written consent."],
    },
    {
      typ: "text", id: "diskretion", h2: "Why we name clients only with their consent",
      absaetze: [
        "Anyone building a US company is often planning a market entry or a new structure and decides for themselves when that becomes public. That is why we name clients only with their written consent — with their name, their sector and, if they wish, a sentence on their experience.",
        "Clients who consent appear on this page. They can withdraw their consent at any time; we then remove the entry.",
      ],
    },
    {
      typ: "karten", id: "pruefen", h2: "How to check us without a reference", spalten: 2,
      karten: [
        { tag: "Register", titel: "Check the register entry", text: `Companies House · No. ${F.companyNo} — open to the public, no account needed; the link is listed under the sources below.` },
        { tag: "Contract", titel: "Contract before you sign", text: "You read your full contract in your personal proposal before you sign.", pfad: globalEnPfad("/business/mustervertrag") },
        { tag: "Payment", titel: "By invoice only", text: `${beleg("zahlung", "en")} The bank details are on the page “Is FIAON legit?”.` },
        { tag: "Checklist", titel: "Spotting reputable providers", text: "The questions to ask any provider before you instruct them — including us.", pfad: globalEnPfad("/business/wissen/anbieter-pruefen") },
      ],
    },
    { typ: "hinweis", id: "nicht", h2: "Who the engagement is not suitable for", punkte: [beleg("fuerWenNicht", "en"), satz("S10", "en"), satz("S2", "en")] },
  ],
  fragen: [
    { f: "Who does FIAON Global work for?", a: `For companies, founders and private individuals building a US company. As of ${STAND_TEXT}, our clients live in Germany and in Switzerland; we form their companies in Delaware and Florida. We name clients only with their written consent.` },
    { f: "Why does FIAON not name references?", a: "Because we name clients only with their written consent. Anyone building a US company decides for themselves when their plans become public. Clients who consent appear on this page." },
    { f: "How can I check FIAON without a reference?", a: `By the register entry of ${F.name} at Companies House (No. ${F.companyNo}), by the full contract you read before signing, and by the payment: ${beleg("zahlung", "en")}` },
    { f: "Is the engagement suitable for every plan?", a: `No. ${beleg("fuerWenNicht", "en")}` },
  ],
  weiter: ["/business/erfahrungen", "/business/wissen/anbieter-pruefen", "/business/tochtergesellschaft-usa", "/business/presse"].map(globalEnPfad),
  quellen: [
    { titel: `Companies House (England and Wales): ${F.name}, No. ${F.companyNo}`, url: `https://find-and-update.company-information.service.gov.uk/company/${F.companyNo}` },
  ],
  schluss: { a: "Check us. ", b: "Then let us talk.", text: "Thirty minutes, free of charge and without obligation — with your dedicated contact." },
  prio: 0.6,
};
