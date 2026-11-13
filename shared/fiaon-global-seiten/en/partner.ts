// ═══════════════════════════════════════════════════════════════════════════
// FIAON GLOBAL — VERTRAGSPARTNER UND PARTNER, ENGLISCH (24.09.2026, E-234; neu gefasst 13.11.2026, E-510)
// Britische Schwester von /business/partner (partner.ts), Adresse aus
// shared/fiaon-global-pfade.ts: /en/business/partners. Gleicher Aufbau, gleiche Anker (ids bleiben deutsch),
// dieselbe Quelle. Sagt Satz für Satz dasselbe wie die deutsche Seite.
//
// Seit dem Sprachleitfaden FIAON Global (Leitplanke 7, Abschnitte 4.1 und 5.11): “Schwarzott Group” steht ohne Ort,
// ohne Rolle, nur mit dem Satz S13 (GLOBAL_VERBUNDEN_EN); vor Ort heißt es “our partners in the United States”;
// Recht und Steuern liegen bei “partner lawyers” und “US certified public accountants (CPAs) from our partner
// network”, die “in their own professional capacity” arbeiten. Unser Vertrag heißt “agreement”, unser Papier
// “proposal”, das Produkt “engagement”. Der Baustein „standorte“ steht hier nicht mehr; aus
// shared/fiaon-global-partner.ts liest die Seite nur noch London. Feste Sätze aus shared/fiaon-global-saetze.ts,
// Firmendaten aus shared/fiaon-firma.ts. Prüfstand: scripts/pruef-global-en.ts.
// ═══════════════════════════════════════════════════════════════════════════
import { EIN_PRODUKT } from "../ein-produkt";
import { GLOBAL_STANDORTE, GLOBAL_VERBUNDEN_EN } from "../../fiaon-global-partner";
import { globalEnPfad } from "../../fiaon-global-pfade";
import { FIAON_FIRMA } from "../../fiaon-firma";
import { satz, weitererSatz } from "../../fiaon-global-saetze";
import type { GlobalSeite } from "../typen";

const S = "2026-09-24";
const FIRMA = FIAON_FIRMA.name;
const NR = FIAON_FIRMA.companyNo;
const gross = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
/** London — the contracting party. Role and tasks from the one source. */
const LONDON = GLOBAL_STANDORTE.find((o) => o.schluessel === "london")!;
/** Roles sentence (guide 5.11): who is responsible for legal and tax matters and who bears the fees. */
const ROLLEN = EIN_PRODUKT.en.partner;
/** Its second sentence: “FIAON bears their fees for the services in your agreement.” */
const HONORARE = ROLLEN.split(/(?<=\.)\s+/)[1] ?? "";
/** Transitional sentence (guide 5.11): states only what FIAON itself does. */
const EINREICHUNG = weitererSatz("UEBERGANG-EINREICHUNG", "en");

export const PARTNER_SEITE_EN: GlobalSeite = {
  pfad: "/en/business/partners",
  sprache: "en",
  schwester: "/business/partner",
  art: "partner",
  seo: {
    titel: "Contracting party and partner network — FIAON Global",
    beschreibung: `Your contracting party: ${FIRMA}, London, company number ${NR}. Legal and tax matters rest with partners acting in their own professional capacity.`,
  },
  stand: "2026-11-13",
  erschienen: S,
  kennung: "FG · 18",
  auge: "Knowledge · Contracting party and partners",
  h1: "One contracting party.",
  h1b: "Clear responsibilities.",
  lead: `Your agreement is with ${FIRMA} in London. ${ROLLEN}`,
  ziffern: [
    { wert: "London", label: `${FIRMA} — agreement, invoice, dedicated contact` },
    { wert: `No. ${NR}`, label: FIAON_FIRMA.register },
    { wert: "USA", label: "formation filed through our partners" },
  ],
  blick: [
    ["Contracting party", `${FIRMA}, ${FIAON_FIRMA.strasse}, London · Companies House No. ${NR}`],
    ["In the United States", EINREICHUNG],
    ["Legal and tax", "Partner lawyers and US certified public accountants (CPAs) from our partner network — in their own professional capacity"],
    ["Partners’ fees", "FIAON bears them for the services in your agreement"],
    ["Connected company", "Schwarzott Group — through our founder Justin Schwarzott"],
    ["Not a bank, not a law firm", "FIAON does not lend and does not broker loans"],
    ["Decided by", "Registration by the state; accounts, cards and financing by the institution concerned"],
  ],
  kurz: `Your agreement is with ${FIRMA} in London (Companies House No. ${NR}), which also issues your invoice. ${ROLLEN} ${GLOBAL_VERBUNDEN_EN}`,
  bloecke: [
    {
      typ: "karten", id: "aufgaben", h2: "Who is responsible for what", spalten: 3,
      karten: [
        { tag: "London", titel: FIRMA, text: `${LONDON.en.rolle}. ${LONDON.en.aufgaben.map(gross).join(". ")}.` },
        { tag: "USA", titel: "Our partners in the United States", text: `${EINREICHUNG} ${satz("S3", "en")}` },
        { tag: "Legal and tax", titel: "Partner network", text: "Partner lawyers and US certified public accountants (CPAs) from our partner network — in their own professional capacity." },
      ],
    },
    {
      typ: "text", id: "netz", h2: "The partner network",
      absaetze: [
        ROLLEN,
        "Only those authorised to do so may answer legal and tax questions. These matters therefore rest with the partners. FIAON coordinates and prepares.",
      ],
    },
    {
      typ: "hinweis", id: "offen", h2: "For context",
      punkte: [
        GLOBAL_VERBUNDEN_EN,
        `Neither ${FIRMA} nor Schwarzott Group is a bank; neither lends or brokers loans.`,
        satz("S2", "en"),
      ],
    },
  ],
  fragen: [
    { f: "Who is my contracting party at FIAON Global?", a: `${FIRMA}, ${FIAON_FIRMA.strasse}, London, registered at ${FIAON_FIRMA.register} under number ${NR}. Your agreement is with this company, and it issues your invoice.` },
    { f: "Who is responsible for legal and tax matters?", a: `${satz("S8", "en")} ${HONORARE}` },
    { f: "Who files the formation in the United States?", a: `${EINREICHUNG} ${satz("S3", "en")}` },
    { f: "Is Schwarzott Group independent of FIAON?", a: `No. ${GLOBAL_VERBUNDEN_EN}` },
  ],
  weiter: ["/business/miami", "/business/wissen/anbieter-pruefen", "/business/firmenkarten-kapital", "/business/us-firmengruendung"].map(globalEnPfad),
  quellen: [
    { titel: `Companies House — ${FIRMA}`, url: `https://find-and-update.company-information.service.gov.uk/company/${NR}` },
  ],
};
