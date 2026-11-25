// ═══════════════════════════════════════════════════════════════════════════
// FIAON GLOBAL — PRESS AND MEDIA (25.11.2026, E-532) · FG · 55
// English sister of /business/presse — same blocks, same anchors. The press line is NOT in the text; the template
// sets it exactly once per page in the trust band (guide 6.1 and 6.3). The definition sentence (guide 9.4) is the
// short profile — the same wording as in the data block and /llms.txt.
// ═══════════════════════════════════════════════════════════════════════════
import type { GlobalSeite } from "../../typen";
import { beleg, satz, weitererSatz } from "../../../fiaon-global-saetze";
import { globalEnPfad } from "../../../fiaon-global-pfade";
import { FIAON_FIRMA as F } from "../../../fiaon-firma";

const STAND = "2026-11-25";
const DEFINITION = weitererSatz("DEFINITION", "en");
/** “What FIAON is — and what it is not: not a bank, …” → only the list after the colon. */
const ROLLE = beleg("rolle", "en").split(": ")[1].replace(/\.$/, "");

export const SEITE: GlobalSeite = {
  pfad: "/en/business/press",
  sprache: "en",
  schwester: "/business/presse",
  art: "partner",
  seo: {
    titel: "FIAON press: press contact and facts — FIAON Global",
    beschreibung: "Press and media at FIAON Global: the company in a few sentences, the verifiable facts about FIAON LTD, London, and the direct route for enquiries.",
  },
  stand: STAND,
  erschienen: STAND,
  kennung: "FG · 55",
  auge: "FIAON Global · Press",
  h1: "Press and media.",
  h1b: "Facts for your reporting.",
  lead: "For editors reporting on FIAON Global: the company in a few sentences, the verifiable facts and the direct route to us. We answer enquiries in writing.",
  ziffern: [
    { wert: F.companyNo, label: "Companies House (England and Wales)" },
    { wert: "DE · EN", label: "Enquiries in German and English" },
    { wert: "London", label: `Registered office of ${F.name}` },
  ],
  blick: [
    ["Company", `${F.name}, London — FIAON Global is its business consultancy for US companies`],
    ["Register", `Companies House (England and Wales), No. ${F.companyNo}, incorporated on 3 July 2026`],
    ["Founder", `${F.director}, Director of ${F.name}`],
    ["Registered office", `${F.strasse}, ${F.ortZeile}, ${F.land}`],
    ["Press contact", `${F.email}, subject “Press”`],
    ["Phone", `${F.telefon}, weekdays`],
    ["Languages", "German and English"],
  ],
  kurz: DEFINITION,
  bloecke: [
    {
      typ: "text", id: "kurzprofil", h2: "FIAON Global in a few sentences",
      absaetze: [
        DEFINITION,
        `${F.name} is a private limited company under the law of England and Wales with its registered office in London. The Director is the founder, ${F.director}.`,
        "We work in German and in English, for companies, founders and private individuals building a US company.",
      ],
    },
    {
      typ: "tabelle", id: "fakten", h2: "Facts for editors",
      lead: "The details about the company — verifiable in the register and in the documents every client receives before signing.",
      kopf: ["Item", "Detail"],
      zeilen: [
        ["Name", `FIAON Global — the business consultancy of ${F.name} for US companies`],
        ["Legal form", "Private limited company, England and Wales"],
        ["Register", `Companies House, No. ${F.companyNo}, incorporated on 3 July 2026`],
        ["Registered office", `${F.strasse}, ${F.ortZeile}, ${F.land}`],
        ["Management", `${F.director} (Director), founder`],
        ["Activity", "Formation of US companies, ongoing administration and support until the decision on their financing"],
        ["What FIAON is not", ROLLE],
        ["Payment", weitererSatz("ZAHLUNG", "en")],
      ],
    },
    {
      typ: "text", id: "anfragen", h2: "How to reach us",
      absaetze: [
        `Send press enquiries to ${F.email} with the subject “Press” — ideally with your topic and your deadline. We reply in writing and tell you who is available for an interview.`,
        `Phone: ${F.telefon} (weekdays, German and English). Post: ${F.name}, ${F.strasse}, ${F.ortZeile}, ${F.land}.`,
      ],
    },
    {
      typ: "hinweis", id: "hinweise", h2: "Notes for reporting",
      punkte: [
        `FIAON is spelt F-I-A-O-N. The web address is fiaon.com, and the contracting party is ${F.name} in London.`,
        satz("S8", "en"),
        "We name clients only with their written consent.",
      ],
    },
    {
      typ: "karten", id: "mehr", h2: "More about FIAON Global", spalten: 3,
      karten: [
        { tag: "Profile", titel: "What is FIAON Global?", text: "The business consultancy, its responsibilities and the facts, with sources.", pfad: globalEnPfad("/business/was-ist-fiaon-global") },
        { tag: "Client experience", titel: "The engagement from the inside", text: "Introductory call, contract, invoice, portal and one dedicated contact.", pfad: globalEnPfad("/business/erfahrungen") },
        { tag: "Contracting party", titel: "Contracting party and partners", text: `${F.name} in London and who is responsible for what.`, pfad: globalEnPfad("/business/partner") },
      ],
    },
  ],
  fragen: [
    { f: "What is FIAON Global?", a: DEFINITION },
    { f: "Who is behind FIAON?", a: `${F.name}, registered office ${F.strasse}, ${F.ortZeile}, registered with Companies House (England and Wales) under No. ${F.companyNo}. The Director is the founder, ${F.director}.` },
    { f: "How do I reach FIAON with a press enquiry?", a: `By e-mail to ${F.email} with the subject “Press”, or by phone on weekdays on ${F.telefon}. We reply in writing, in German or English.` },
    { f: "Is FIAON a bank?", a: `No. ${satz("S8", "en")}` },
  ],
  weiter: ["/business/was-ist-fiaon-global", "/business/erfahrungen", "/business/referenzen", "/business/partner"].map(globalEnPfad),
  quellen: [
    { titel: `Companies House (England and Wales): ${F.name}, No. ${F.companyNo}`, url: `https://find-and-update.company-information.service.gov.uk/company/${F.companyNo}` },
  ],
  schluss: { a: "Your enquiry. ", b: "Our answer, in writing.", text: `Write to ${F.email} — subject “Press”.` },
  prio: 0.5,
};
