// ═══════════════════════════════════════════════════════════════════════════
// FIAON GLOBAL — STANDORTE UND PARTNER, ENGLISCH (24.09.2026, E-234)
// Britische Schwester von /business/partner (partner.ts), Adresse aus
// shared/fiaon-global-pfade.ts: /en/business/partners. London · Zurich · Miami —
// Rolle und Aufgaben je Standort aus shared/fiaon-global-partner.ts (Feld en),
// der Satz zur Verbindung aus GLOBAL_VERBUNDEN_EN, Anschrift und Register der
// FIAON LTD aus shared/fiaon-firma.ts. Gleicher Aufbau, gleiche Anker (ids
// bleiben deutsch), dieselben Quellen (auch die Zefix-Adresse bleibt die
// deutsche). Die Verbindung über den Gründer steht auch hier offen auf der
// Seite. Keine der drei Gesellschaften ist eine Bank, vergibt oder vermittelt
// Kredite. Prüfstand: scripts/pruef-global-en.ts.
// ═══════════════════════════════════════════════════════════════════════════
import { GLOBAL_ROLLEN, globalPaket } from "../../fiaon-global";
import { GLOBAL_STANDORTE, GLOBAL_VERBUNDEN_EN } from "../../fiaon-global-partner";
import { globalEnPfad } from "../../fiaon-global-pfade";
import { FIAON_FIRMA } from "../../fiaon-firma";
import type { GlobalSeite } from "../typen";

const S = "2026-09-24";
const gross = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
const VIP = globalPaket("global_vip")?.en.name ?? "Global VIP";

export const PARTNER_SEITE_EN: GlobalSeite = {
  pfad: "/en/business/partners",
  sprache: "en",
  schwester: "/business/partner",
  art: "partner",
  seo: {
    titel: "Locations and partners: London, Zurich, Miami — FIAON Global",
    beschreibung: "FIAON LTD in London, Schwarzott Capital Partners AG in Zurich, Schwarzott Global LLC in Miami: who your contracting party is and who works on the ground.",
  },
  stand: S,
  erschienen: S,
  kennung: "FG · 18",
  auge: "Knowledge · Locations and partners",
  h1: "London, Zurich, Miami.",
  h1b: "Three locations, one contracting party.",
  lead: `Your contract is with ${FIAON_FIRMA.name} in London. In Zurich, Schwarzott Capital Partners AG supports the capital stage; in Miami, Schwarzott Global LLC works as our team on the ground. In addition, tax advisers, US CPAs and lawyers from our partner network act under your engagement.`,
  ziffern: [
    { wert: "London", label: `${FIAON_FIRMA.name} — contract, invoice, dedicated contact` },
    { wert: "Zurich", label: "Schwarzott Capital Partners AG — capital stage" },
    { wert: "Miami", label: "Schwarzott Global LLC — team on the ground" },
  ],
  blick: [
    ["Contracting party", `${FIAON_FIRMA.name}, ${FIAON_FIRMA.strasse}, London · Companies House No. ${FIAON_FIRMA.companyNo}`],
    ["Zurich", "Schwarzott Capital Partners AG, Schifflände 26 · UID CHE-102.119.428"],
    ["Miami", "Schwarzott Global LLC, 3119 Coral Way, Suite 200"],
    ["Partner network", "Tax advisers, US CPAs and lawyers — under your engagement, fees paid by FIAON"],
    ["Connected", "Through our founder Justin Schwarzott"],
    ["Not a bank", "None of the companies grants or arranges loans"],
  ],
  kurz: `FIAON Global works from three locations: ${FIAON_FIRMA.name} in London is your contracting party, Schwarzott Capital Partners AG in Zurich supports the capital stage, and Schwarzott Global LLC in Miami attends appointments as our team on the ground. All three companies are connected through our founder Justin Schwarzott. None of them is a bank or grants loans.`,
  bloecke: [
    { typ: "standorte", id: "standorte", h2: "The three locations", lead: "Who your contracting party is, who works for you on the ground and who supports the capital stage." },
    {
      typ: "karten", id: "aufgaben", h2: "Who does what", spalten: 3,
      karten: GLOBAL_STANDORTE.map((o) => ({ tag: o.en.stadt, titel: o.gesellschaft, text: `${o.en.rolle}. ${o.en.aufgaben.map(gross).join(". ")}.` })),
    },
    {
      typ: "text", id: "netz", h2: "The partner network",
      absaetze: [
        GLOBAL_ROLLEN.en.partner,
        "Tax advisers, US CPAs and lawyers act under your own engagement, because only those authorised to do so may answer tax and legal questions. FIAON handles coordination and preparation, and pays the fees for the services in your package.",
      ],
    },
    {
      typ: "hinweis", id: "offen", h2: "Full disclosure",
      punkte: [
        GLOBAL_VERBUNDEN_EN,
        GLOBAL_ROLLEN.en.fiaon,
        "None of the three companies is a bank, and none of them grants or arranges loans. Only the institution concerned decides on the account, the card, the limit and any loan.",
      ],
    },
  ],
  fragen: [
    { f: "Who is my contracting party at FIAON Global?", a: `${FIAON_FIRMA.name}, ${FIAON_FIRMA.strasse}, London, registered at ${FIAON_FIRMA.register} under number ${FIAON_FIRMA.companyNo}. Your contract is with this company, and it issues your invoice.` },
    { f: "What does Schwarzott Global LLC in Miami do?", a: `It is our team on the ground: it attends appointments with authorities and institutions, files documents, collects paperwork and hosts the kick-off of the ${VIP} package.` },
    { f: "What does Schwarzott Capital Partners AG in Zurich do?", a: "It supports the capital stage with key figures and documents for financing discussions and is the contact for companies from Switzerland. It is an investment and holding company, not a bank." },
    { f: "Are the partners independent of FIAON?", a: "No. Schwarzott Capital Partners AG and Schwarzott Global LLC are connected to FIAON through our founder Justin Schwarzott. We say so openly because it matters for your decision." },
  ],
  weiter: ["/business/miami", "/business/aus-der-schweiz", "/business/firmenkarten-kapital", "/business/us-firmengruendung"].map(globalEnPfad),
  quellen: [
    { titel: `Companies House — ${FIAON_FIRMA.name}`, url: `https://find-and-update.company-information.service.gov.uk/company/${FIAON_FIRMA.companyNo}` },
    { titel: "Zefix (Swiss Central Business Name Index) — Schwarzott Capital Partners AG", url: "https://www.zefix.ch/de/search/entity/list/firm/304048" },
  ],
};
