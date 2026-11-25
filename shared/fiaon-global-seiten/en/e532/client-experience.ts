// ═══════════════════════════════════════════════════════════════════════════
// FIAON GLOBAL — CLIENT EXPERIENCE: THE ENGAGEMENT FROM THE INSIDE (25.11.2026, E-532) · FG · 54
// English sister of /business/erfahrungen — same blocks, same anchors. Portal names as in the English portal
// (“My engagement”, “Your company”, “Your vault”, “For you to do”, “History”). Fixed sentences from
// shared/fiaon-global-saetze.ts; no press line in the text (it sits in the trust band of the template).
// ═══════════════════════════════════════════════════════════════════════════
import type { GlobalSeite } from "../../typen";
import { GELD_ZURUECK, beleg, satz, weitererSatz } from "../../../fiaon-global-saetze";
import { globalEnPfad } from "../../../fiaon-global-pfade";
import { FIAON_FIRMA as F } from "../../../fiaon-firma";

const STAND = "2026-11-25";
/** Sentence S8 in its three sentences — only the second here: no loans. */
const KEINE_KREDITE = satz("S8", "en").split(/(?<=\.)\s+/)[1];

export const SEITE: GlobalSeite = {
  pfad: "/en/business/client-experience",
  sprache: "en",
  schwester: "/business/erfahrungen",
  art: "partner",
  seo: {
    titel: "FIAON reviews: inside your engagement — FIAON Global",
    beschreibung: "FIAON reviews: what clients of FIAON Global experience — introductory call, contract before signing, invoice, client portal and one dedicated contact.",
  },
  stand: STAND,
  erschienen: STAND,
  kennung: "FG · 54",
  auge: "FIAON Global · Client experience",
  h1: "How clients experience",
  h1b: "their engagement with FIAON Global.",
  lead: "Anyone searching for “FIAON reviews” wants to know what working with us is really like. This page shows it in order: from the introductory call through the contract to the portal “My engagement”, where you see which step of your company is under way.",
  ziffern: [
    { wert: "1 engagement", label: "one agreement, one dedicated contact" },
    { wert: "Portal", label: "“My engagement” — status, documents, history" },
    { wert: "Contract", label: "readable in full before you sign" },
  ],
  blick: [
    ["Introductory call", "Thirty minutes, free of charge and without obligation"],
    ["Proposal", "Personal, with your fee stated as an amount"],
    ["Signature", "Online, in your personal proposal"],
    ["Payment", `By invoice and bank transfer to ${F.name} — no subscription, no direct debit`],
    ["Portal", "“My engagement”: your company, your vault, for you to do, history"],
    ["News", "In the portal when you open it, and by e-mail"],
    ["Who decides", "The state, the US tax authority and the institution concerned"],
  ],
  kurz: `Clients of FIAON Global experience an engagement with one dedicated contact. You read your full contract before you sign, pay by invoice to ${F.name} and see in the portal “My engagement” which step is under way. ${weitererSatz("LEITSATZ", "en")}`,
  bloecke: [
    {
      typ: "etappen", id: "weg", h2: "The course of an engagement — from the client's point of view",
      lead: "Six steps, each with its condition. What you do yourself is stated alongside.",
      etappen: [
        { titel: "Introductory call", text: `Thirty minutes by phone, free of charge and without obligation. You describe your plans. ${beleg("fuerWenNicht", "en")}` },
        { titel: "Personal proposal", text: `${beleg("honorarVorab", "en")} In the proposal you read your full contract — in German, under German law.` },
        { titel: "Signature and invoice", text: `You sign online in your proposal. ${beleg("zahlung", "en")}` },
        { titel: "Checks before we start", text: beleg("pruefungVorBeginn", "en") },
        { titel: "Formation and tax numbers", text: `${weitererSatz("UEBERGANG-EINREICHUNG", "en")} In the portal you see which step is under way. ${satz("S3", "en")}` },
        { titel: "Support in the first year", text: `Active support in the first year is part of your engagement. ${weitererSatz("UEBERGANG-ASSISTENZ", "en")}` },
      ],
    },
    {
      typ: "karten", id: "portal", h2: "Your portal “My engagement”", spalten: 2,
      lead: "When work starts, you receive your access. Everything that concerns your company is there — for you to view at any time.",
      karten: [
        { tag: "Company", titel: "Your company", text: "Name, state, registration number, EIN and registered agent — as soon as they are settled." },
        { tag: "Vault", titel: "Your vault", text: "Formation documents and letters from the authorities are kept there for you as documents." },
        { tag: "Tasks", titel: "For you to do", text: "What we need from you — your passport or a signature, for example — is listed there with a short explanation." },
        { tag: "History", titel: "History and messages", text: "Each step appears in the history. The portal shows news when you open it and sends it to you by e-mail; you ask your contact questions directly in the portal." },
      ],
    },
    {
      typ: "text", id: "ansprechpartner", h2: "One dedicated contact",
      absaetze: [
        "When work starts, we name your contact. They know your engagement, coordinate the steps and answer your questions — by phone, by e-mail and in the portal.",
        `${weitererSatz("UEBERGANG-ASSISTENZ", "en")} ${weitererSatz("ROLLEN", "en")}`,
      ],
    },
    {
      typ: "karten", id: "sicherheit", h2: "What protects clients", spalten: 2,
      karten: [
        { tag: "Contract", titel: "Contract before you sign", text: "You read your full contract in your personal proposal before you sign.", pfad: globalEnPfad("/business/mustervertrag") },
        { tag: "Payment", titel: "By invoice only", text: `${beleg("zahlung", "en")} No subscription, no direct debit.` },
        { tag: "Ownership", titel: "Your company is yours", text: beleg("eigentum", "en") },
        { tag: "Refund", titel: GELD_ZURUECK.en.auge, text: satz("S7", "en") },
      ],
    },
    {
      typ: "text", id: "diskretion", h2: "References and discretion",
      absaetze: [
        "We name clients only with their written consent. Discretion is part of the engagement — towards prospective clients too.",
        "Who we work for and how you can check us without a reference is set out on the page “Engagements and references”.",
      ],
    },
    { typ: "hinweis", id: "grenzen", h2: "What you need to know", punkte: [satz("S3", "en"), satz("S2", "en"), satz("S10", "en"), KEINE_KREDITE] },
  ],
  fragen: [
    { f: "What do clients experience with FIAON Global?", a: `An engagement with one dedicated contact and clear steps. You read your full contract before you sign, pay by invoice to ${F.name} and see in the portal “My engagement” which step is under way. We name clients only with their written consent.` },
    { f: "How do I see what is happening in my engagement?", a: "In the portal “My engagement”: it shows your company, your vault with the documents, what is for you to do, and the history. The portal shows news when you open it and sends it to you by e-mail." },
    { f: "Who is my contact?", a: `When work starts, we name your dedicated contact. They coordinate your engagement and answer your questions by phone, by e-mail and in the portal. ${weitererSatz("ROLLEN", "en")}` },
    { f: "Why does FIAON not name its clients?", a: "Because we name clients only with their written consent. Anyone building a US company decides for themselves when their plans become public. How you can check us without a reference is set out on the page “Engagements and references”." },
    { f: "What applies if the financing does not come through?", a: satz("S7", "en") },
  ],
  weiter: ["/business/referenzen", "/business/ablauf", "/business/mustervertrag", "/business/presse"].map(globalEnPfad),
  quellen: [
    { titel: `Companies House (England and Wales): ${F.name}, No. ${F.companyNo}`, url: `https://find-and-update.company-information.service.gov.uk/company/${F.companyNo}` },
  ],
  schluss: { a: "Experience it yourself. ", b: "In the introductory call.", text: "Thirty minutes, free of charge and without obligation — with your dedicated contact." },
  prio: 0.7,
};
