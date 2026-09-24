// ═══════════════════════════════════════════════════════════════════════════
// FIAON GLOBAL — FÜR PRIVATPERSONEN UND GRÜNDER, ENGLISCH (24.09.2026, E-234)
// Britische Schwester von /business/privatpersonen (privat.ts), Adresse aus
// shared/fiaon-global-pfade.ts: /en/business/private-individuals. Satz für Satz
// übersetzt, gleicher Aufbau, gleiche Anker (ids bleiben deutsch).
//
// Der SEO-Titel ist deckungsgleich mit GLOBAL_WOERTER.en.privat.metaTitel
// (client/src/i18n/global.ts) — die Seite selbst ist eine Startseite
// (business-privat.tsx), dieser Datensatz liefert Kopf, FAQ-Markup und Vorab-HTML.
// Widerruf offen gesagt: vierzehn Tage für Verbraucher, Beginn vor Fristende
// nur auf ausdrücklichen Wunsch, dann angemessener Anteil für Erbrachtes.
// Paketnamen, Preise, Jahresbetreuung, Pflichthinweise und der Kapital-Satz
// kommen aus den gemeinsamen Quellen — nie als Wortlaut hier. Wortgrenzen wie
// auf Deutsch (kein „up to", auch nicht in „up to that point"). Prüfstand:
// scripts/pruef-global-en.ts.
// ═══════════════════════════════════════════════════════════════════════════
import { GLOBAL_KAPITAL_FREI, GLOBAL_PFLICHTHINWEIS, globalJahresbetreuungPreisText, globalPaket, globalPreisText, type GlobalSchluessel } from "../../fiaon-global";
import { globalEnPfad } from "../../fiaon-global-pfade";
import { QUELLEN_RECHT_EN } from "../fakten-en";
import type { GlobalSeite } from "../typen";

const S = "2026-09-24";

/** Der englische Paketname aus der einen Quelle. */
const name = (k: GlobalSchluessel): string => globalPaket(k)?.en.name ?? k;
/** „from €2,499" — der Einstiegspreis aus dem Katalog. */
const AB = `from ${globalPreisText("global_struktur", "en")}`;

export const PRIVAT_SEITE_EN: GlobalSeite = {
  pfad: "/en/business/private-individuals",
  sprache: "en",
  schwester: "/business/privatpersonen",
  art: "zielgruppe",
  seo: {
    titel: "Form a US company as a private individual — FIAON Global",
    beschreibung: "No business of your own needed: as a private individual or founder, you engage FIAON Global directly — US company, EIN, ITIN and account at a fixed price.",
  },
  stand: S,
  erschienen: S,
  kennung: "FG · 29",
  auge: "Who it is for · Private individuals and founders",
  h1: "No company needed.",
  h1b: "You can also engage us as a private individual.",
  lead: "You do not need an existing business to engage FIAON Global. As a private individual, as a founder or as a business owner ordering privately, you become the shareholder of your US company yourself — with the same fixed price, the same team on the ground and the same partners.",
  ziffern: [
    { wert: AB, label: "Fixed price — the final price for private individuals" },
    { wert: "Your name", label: "on the contract and invoice" },
    { wert: "You yourself", label: "as the shareholder of the US company" },
  ],
  blick: [
    ["Client", "You personally — your name and address instead of company details"],
    ["Shareholder", "You yourself; later your holding company if you wish"],
    ["Documents", "Passport, proof of address, preferred company name, description of the activity"],
    ["Price", `${AB} — final price, all fees included`],
    ["Withdrawal", "Statutory right of withdrawal for consumers; we start before the period ends only at your request"],
    ["Contracting party", "FIAON LTD, London"],
  ],
  kurz: "Yes — you can also engage FIAON Global as a private individual. You do not need a company of your own: you personally become the shareholder of the US company, and the contract and invoice are issued in your name. For private individuals the fixed prices are final prices. If you act as a consumer, the statutory fourteen-day right of withdrawal applies; we begin before the period expires only if you expressly request it.",
  bloecke: [
    {
      typ: "karten", id: "fuer-wen", h2: "Who this suits", spalten: 3,
      karten: [
        { tag: "Founder", titel: "You are starting something new", text: "The US company is your first business or the start of a new venture — you order in your own name." },
        { tag: "Business owner", titel: "You order privately", text: "You already run a business but want to hold the US company personally — not through your company." },
        { tag: "Private individual", titel: "You want your own US business", text: "Customers, contracts or a project in the US — and a company of your own for it, without first forming a company in your home country." },
      ],
    },
    {
      typ: "etappen", id: "ablauf", h2: "How to order as a private individual",
      etappen: [
        { titel: "Choose a package", text: "The same four packages, the same fixed prices — as final prices for you." },
        { titel: "Select “Private individual”", text: "When you order, you select “Private individual” and enter your name and address. No register extract or company details are needed." },
        { titel: "Withdrawal instructions and your request to start", text: "You read the withdrawal instructions. If you want us to begin immediately, you confirm this expressly — otherwise we begin once the withdrawal period has expired." },
        { titel: "Sign", text: "You receive the contract and invoice in your name by email, together with the withdrawal instructions and the model withdrawal form." },
      ],
    },
    {
      typ: "tabelle", id: "unterschied", h2: "Private individual or business — what changes",
      kopf: ["", "As a private individual", "As a business"],
      zeilen: [
        ["Party to the contract", "You personally", "Your business"],
        ["Shareholder of the US company", "You yourself", "Your business or you"],
        ["Documents", "Passport, proof of address, preferred company name, activity", "in addition, a register extract or shareholder list"],
        ["Price shown", "Final price", "plus VAT where applicable"],
        ["Right of withdrawal", "fourteen days by law if you are a consumer", "no statutory right"],
        ["Services", "the same", "the same"],
      ],
      hervor: 1,
    },
    {
      typ: "text", id: "steuern", h2: "Tax — the same rules apply to private individuals",
      absaetze: [
        "If you hold a US company privately and manage it from your home country, it is generally taxed there. In Germany the shareholding must be reported to the tax office under section 138 of the German Fiscal Code (AO); how the income is categorised depends on the activity and on the classification of the company by comparison with German legal forms (Typenvergleich).",
        "Our partner tax adviser reviews this before formation — for private individuals too, included in the fixed price. Your own tax adviser handles the ongoing tax return.",
      ],
    },
    {
      typ: "hinweis", id: "wissen", h2: "What you need to know",
      punkte: [
        "Right of withdrawal: if you act as a consumer, you can withdraw from the engagement within fourteen days without giving any reason. If you have requested that we begin before the period expires, you pay a reasonable amount for the services provided until you withdraw. Once the engagement has been fully performed, the right of withdrawal lapses.",
        GLOBAL_PFLICHTHINWEIS.en[0],
        GLOBAL_PFLICHTHINWEIS.en[2],
      ],
    },
    // Wie im Deutschen (E-196): Privatpersonen wählen aus allen vier Paketen.
    { typ: "pakete", id: "pakete", h2: "All four packages — for private individuals too", lead: "The same packages and fixed prices as for businesses, as final prices for you — all fees and our partners’ fees included." },
  ],
  fragen: [
    { f: "Can I form a US company as a private individual?", a: "Yes. You need neither a company of your own nor a residence in the US. You personally become the shareholder of the US company; the contract and invoice are issued in your name." },
    { f: "Do I need a company to engage FIAON Global?", a: "No. When you order, you select “Private individual” and enter your name and address. No register extract or company details are needed." },
    { f: "Do I have a right of withdrawal as a private individual?", a: "If you act as a consumer, yes — the statutory fourteen-day right of withdrawal from the conclusion of the contract. We begin before it expires only at your express request; in that case, if you withdraw, you pay a reasonable amount for what has already been provided." },
    { f: "Does the fixed price also apply to private individuals?", a: `Yes, as a final price — for all four packages, ${AB} for ${name("global_struktur")}, including all fees and partner fees for the package.` },
    { f: "Which packages can I choose as a private individual?", a: `All four: ${name("global_struktur")} for a clean start; ${name("global_banking")}, ${name("global_kapital")} and ${name("global_vip")} if you are planning the card ladder and, later, a bank loan.` },
    // Wie auf /business: Das Kapital ist nicht an die USA gebunden (GLOBAL_KAPITAL_FREI).
    { f: GLOBAL_KAPITAL_FREI.en.frage, a: GLOBAL_KAPITAL_FREI.en.antwort },
    { f: "What does the company cost from the second year onwards?", a: `${globalJahresbetreuungPreisText("en")} a year with the annual care plan, all fees included — registered agent, US address and phone number, the annual US filing and the annual report to the state including the state fee. The plan does not renew automatically.` },
    { f: "Can I transfer the US company to my business later?", a: "In principle, yes. A transfer has tax consequences in both countries; please check this with your tax adviser beforehand." },
    { f: "Do I have to travel to the US?", a: `As a rule, no. Our team on the ground in Miami files the documents and attends appointments; you sign digitally. If you would like to experience the set-up in person, choose ${name("global_vip")} — flights and hotel for the kick-off in Miami are included in its fixed price.` },
    { f: "Which documents do I need as a private individual?", a: "Your passport, proof of address, three variants of the name you want for the company and a short description of the planned activity." },
  ],
  paket: "global_struktur",
  auftraggeber: "privat",
  weiter: ["/business/us-firmengruendung", "/business/kosten", "/business/wissen/llc-gruenden", "/business/paket-finder"].map(globalEnPfad),
  quellen: [
    { titel: "Section 355 German Civil Code (BGB) — right of withdrawal in consumer contracts", url: "https://www.gesetze-im-internet.de/bgb/__355.html" },
    { titel: "Section 356 German Civil Code (BGB) — right of withdrawal in distance contracts", url: "https://www.gesetze-im-internet.de/bgb/__356.html" },
    { titel: "Section 357a German Civil Code (BGB) — compensation for value", url: "https://www.gesetze-im-internet.de/bgb/__357a.html" },
    QUELLEN_RECHT_EN.ao138,
  ],
};
