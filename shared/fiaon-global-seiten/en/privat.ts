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
import { GLOBAL_KAPITAL_FREI, GLOBAL_PFLICHTHINWEIS } from "../../fiaon-global";
import { EIN_PRODUKT } from "../ein-produkt";
import { globalEnPfad } from "../../fiaon-global-pfade";
import { QUELLEN_RECHT_EN } from "../fakten-en";
import type { GlobalSeite } from "../typen";

const S = "2026-09-24";

// E-509 (12.11.2026): ONE product, and everyone orders as a person — prices only from EIN_PRODUKT.en.
const P = EIN_PRODUKT.en;

export const PRIVAT_SEITE_EN: GlobalSeite = {
  pfad: "/en/business/private-individuals",
  sprache: "en",
  schwester: "/business/privatpersonen",
  art: "zielgruppe",
  seo: {
    titel: "Form a US company as a private individual — FIAON Global",
    beschreibung: "No company needed: as a private individual or founder, engage FIAON Global directly — US company, EIN, ITIN and account application in one order.",
  },
  stand: "2026-11-12",
  erschienen: S,
  kennung: "FG · 29",
  auge: "Who it is for · Private individuals and founders",
  // 06.10.2026 (E-293): H1 und Lead deckungsgleich mit der sichtbaren Startseite (GLOBAL_WOERTER.en.privat).
  h1: "Your own US company.",
  h1b: "No company needed — in one order.",
  lead: "You become the shareholder yourself: we form the company, apply for the EIN and ITIN and prepare account and card applications — contract and invoice are in your name.",
  ziffern: [
    { wert: P.preis, label: "with your order — final price" },
    { wert: "Your name", label: "on the contract and invoice" },
    { wert: "You yourself", label: "as the shareholder of the US company" },
  ],
  blick: [
    ["Client", "You personally — your name and address instead of company details"],
    ["Shareholder", "You yourself; later your holding company if you wish"],
    ["Documents", "Your passport — you upload it after signing"],
    ["Price", `${P.preis} with your order — final price; success fee on registration`],
    ["Withdrawal", "Statutory fourteen-day right of withdrawal; we begin at once because you expressly request it"],
    ["Contracting party", "FIAON LTD, London"],
  ],
  kurz: "Yes — you engage FIAON Global as a person. You do not need a company of your own: you personally become the shareholder of the US company, and the contract and invoice are issued in your name. All amounts are final prices. The statutory fourteen-day right of withdrawal applies; by signing, you expressly request that we begin at once.",
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
        { titel: "Build your offer", text: "In the configurator you choose what matters to you and your capital range, and you see your price — as a final price." },
        { titel: "Enter your details", text: "On your offer page you enter your date of birth and address and choose the name of your company. No register extract or company details are needed." },
        { titel: "Withdrawal instructions and start", text: "You read the agreement with the withdrawal instructions. By signing, you expressly request that we begin at once." },
        { titel: "Sign", text: "You receive the contract and invoice in your name by email, together with the withdrawal instructions and the model withdrawal form. You then upload your passport." },
      ],
    },
    {
      typ: "tabelle", id: "unterschied", h2: "You personally — what that means",
      kopf: ["", "How it is arranged"],
      zeilen: [
        ["Party to the contract", "You personally"],
        ["Shareholder of the US company", "You yourself, alone"],
        ["Documents", "Your passport, after signing"],
        ["Price shown", "Final prices"],
        ["Right of withdrawal", "fourteen days by law"],
        ["Your business as shareholder", "we agree this with you in a call"],
      ],
      hervor: 1,
    },
    {
      typ: "text", id: "steuern", h2: "Tax — the same rules apply to private individuals",
      absaetze: [
        "If you hold a US company privately and manage it from your home country, it is generally taxed there. In Germany the shareholding must be reported to the tax office under section 138 of the German Fiscal Code (AO); how the income is categorised depends on the activity and on the classification of the company by comparison with German legal forms (Typenvergleich).",
        "Our partner tax adviser clarifies with you beforehand how transfers and investments are treated. Your own tax adviser handles the ongoing tax return.",
      ],
    },
    {
      typ: "hinweis", id: "wissen", h2: "What you need to know",
      punkte: [
        "Right of withdrawal: you can withdraw from the engagement within fourteen days without giving any reason. Because you request that we begin before the period expires, you then pay a reasonable amount for the services provided until you withdraw. Once the engagement has been fully performed, the right of withdrawal lapses.",
        GLOBAL_PFLICHTHINWEIS.en[0],
        GLOBAL_PFLICHTHINWEIS.en[2],
      ],
    },
    // Wie im Deutschen: seit E-509 ein Produkt, die Karte „One mandate“.
    { typ: "pakete", id: "mandat", h2: P.karteH2, lead: P.karteLead },
  ],
  fragen: [
    { f: "Can I form a US company as a private individual?", a: "Yes. You need neither a company of your own nor a residence in the US. You personally become the shareholder of the US company; the contract and invoice are issued in your name." },
    { f: "Do I need a company to engage FIAON Global?", a: "No. You order as a person: on your offer page you enter your name, date of birth and address. No register extract or company details are needed." },
    { f: "Do I have a right of withdrawal as a private individual?", a: "Yes — the statutory fourteen-day right of withdrawal from the conclusion of the contract. By signing, you request that we begin at once; in that case, if you withdraw, you pay a reasonable amount for what has already been provided." },
    { f: "What does it cost?", a: P.preisSatzKurz },
    { f: "Which capital range can I choose?", a: P.rahmenSatz },
    // Wie auf /business: Das Kapital ist nicht an die USA gebunden (GLOBAL_KAPITAL_FREI).
    { f: GLOBAL_KAPITAL_FREI.en.frage, a: GLOBAL_KAPITAL_FREI.en.antwort },
    { f: "What does the company cost from the second year onwards?", a: `${P.jahres} a year with the annual care plan, all fees included — registered agent, US address and phone number, the annual US filing and the annual report to the state including the state fee. The plan does not renew automatically.` },
    { f: "Can I transfer the US company to my business later?", a: "In principle, yes. A transfer has tax consequences in both countries; please check this with your tax adviser beforehand." },
    { f: "Do I have to travel to the US?", a: "No. Our partners in the US take care of what has to happen on the ground; you sign online. From a capital range of US$1 million we meet you in person in Miami." },
    { f: "Which documents do I need as a private individual?", a: "Your passport — you upload it after signing. You choose the name of your company on your offer page. If an authority or an institution requires further documents, we tell you which." },
  ],
  paket: "global_struktur",
  auftraggeber: "privat",
  weiter: ["/business/us-firmengruendung", "/business/kosten", "/business/wissen/llc-gruenden", "/business/ablauf"].map(globalEnPfad),
  quellen: [
    { titel: "Section 355 German Civil Code (BGB) — right of withdrawal in consumer contracts", url: "https://www.gesetze-im-internet.de/bgb/__355.html" },
    { titel: "Section 356 German Civil Code (BGB) — right of withdrawal in distance contracts", url: "https://www.gesetze-im-internet.de/bgb/__356.html" },
    { titel: "Section 357a German Civil Code (BGB) — compensation for value", url: "https://www.gesetze-im-internet.de/bgb/__357a.html" },
    QUELLEN_RECHT_EN.ao138,
  ],
};
