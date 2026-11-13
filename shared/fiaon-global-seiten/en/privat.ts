// ═══════════════════════════════════════════════════════════════════════════
// FIAON GLOBAL — FÜR PRIVATPERSONEN UND GRÜNDER, ENGLISCH (24.09.2026, E-234)
// Britische Schwester von /business/privatpersonen (privat.ts), Adresse aus
// shared/fiaon-global-pfade.ts: /en/business/private-individuals. Satz für Satz
// übersetzt, gleicher Aufbau, gleiche Anker (ids bleiben deutsch).
//
// Der SEO-Titel ist deckungsgleich mit GLOBAL_WOERTER.en.privat.metaTitel
// (client/src/i18n/global.ts) — die Seite selbst ist eine Startseite
// (business-privat.tsx), dieser Datensatz liefert Kopf, FAQ-Markup und Vorab-HTML.
// Widerruf mit seiner Bedingung: vierzehn Tage für Verbraucher, Beginn vor Fristende
// nur auf ausdrücklichen Wunsch, dann angemessener Anteil für Erbrachtes.
// Beträge, Jahresbetreuung, Pflichthinweise und der Kapital-Satz
// kommen aus den gemeinsamen Quellen — nie als Wortlaut hier. Wortgrenzen wie
// auf Deutsch (kein „up to", auch nicht in „up to that point"). Prüfstand:
// scripts/pruef-global-en.ts.
//
// E-510 (13.11.2026, Sprachleitfaden FIAON Global): engagement · fee · funding target · proposal · agreement ·
// fee calculator · “Request your proposal”; nie “order”, “offer”, “price”, “configurator”, “capital range”.
// Sagt Satz für Satz dasselbe wie privat.ts (dort steht, was sich warum geändert hat).
// ═══════════════════════════════════════════════════════════════════════════
import { GLOBAL_KAPITAL_FREI, GLOBAL_PFLICHTHINWEIS } from "../../fiaon-global";
import { EIN_PRODUKT } from "../ein-produkt";
import { globalEnPfad } from "../../fiaon-global-pfade";
import { QUELLEN_RECHT_EN } from "../fakten-en";
import { GELD_ZURUECK, SAETZE_BETRAEGE, SECHS_SCHRITTE, beleg, handlung, satz, weitererSatz } from "../../fiaon-global-saetze";
import type { GlobalSeite } from "../typen";

const S = "2026-09-24";

// E-509 (12.11.2026): ONE product, and everyone engages us as a person — amounts only from EIN_PRODUKT.en.
const P = EIN_PRODUKT.en;
const B = SAETZE_BETRAEGE.en;
/** Fees in three lines — always together (guide 1.3, 5.6); word for word as on the audience pages. */
const HONORAR_KURZ = `${B.honorarAuftrag} on engagement. On registration, the success fee set by your funding target — at least ${B.erfolgMin}. From the second year, on request, ${B.jahresbetreuung} a year.`;
/** Step 5 (financing): what applies if it does not arrive — the row from the table “who does what” (guide 2.4). */
const WENN_ES_AUSBLEIBT = SECHS_SCHRITTE.en.find((x) => x.nr === 5)!.werMachtWas.wennEsAusbleibt;

export const PRIVAT_SEITE_EN: GlobalSeite = {
  pfad: "/en/business/private-individuals",
  sprache: "en",
  schwester: "/business/privatpersonen",
  art: "zielgruppe",
  seo: {
    titel: "Form a US company as a private individual — FIAON Global",
    beschreibung: "No company needed: you engage FIAON Global as a person. We form your US company, apply for the EIN and prepare your account applications.",
  },
  stand: "2026-11-13",
  erschienen: S,
  kennung: "FG · 29",
  auge: "Who it is for · Private individuals and founders",
  // 06.10.2026 (E-293): H1 und Lead deckungsgleich mit der sichtbaren Startseite (GLOBAL_WOERTER.en.privat).
  h1: "Your own US company.",
  h1b: "No company needed — under one engagement.",
  lead: "You become the shareholder yourself; the agreement and invoice are in your name. We form your US company, apply for the EIN and, following our ITIN check, your ITIN, and prepare your account applications — on request, your credit card applications too. You submit the applications yourself; each institution decides.",
  ziffern: [
    { wert: P.preis, label: P.preisLabel },
    { wert: "Your name", label: "on the agreement and invoice" },
    { wert: "You yourself", label: "as the shareholder of the US company" },
  ],
  blick: [
    ["Client", "You personally — your name and address instead of company details"],
    ["Shareholder", "You yourself; later your holding company if you wish"],
    ["Documents", "Your passport — you upload it after signing"],
    ["We handle", "Formation, documents, the EIN and ITIN applications; prepared applications for accounts, credit cards on request and financing"],
    ["You", "Choose the name, upload your passport, sign; submit the applications to the institutions yourself"],
    ["Decided by", "The state and the US tax authority; accounts, cards and financing by the institution concerned"],
    [GELD_ZURUECK.en.auge, WENN_ES_AUSBLEIBT],
    ["Fees", HONORAR_KURZ],
    ["Withdrawal", "Fourteen days by law. If you request that we begin before the period expires and then withdraw, you pay a reasonable amount for what has been provided by then"],
    ["Contracting party", "FIAON LTD, London"],
  ],
  kurz: "Yes — you engage FIAON Global as a person. You do not need a company of your own: you personally become the shareholder of the US company, and the agreement and invoice are issued in your name. All fees are stated in full; nothing is added. The statutory fourteen-day right of withdrawal applies; by signing, you expressly request that we begin before the withdrawal period expires.",
  bloecke: [
    {
      typ: "karten", id: "fuer-wen", h2: "Who this suits", spalten: 3,
      karten: [
        { tag: "Founder", titel: "You are starting something new", text: "The US company is your first business or the start of a new venture — you engage us in your own name." },
        { tag: "Business owner", titel: "You engage us personally", text: "You already run a business but want to hold the US company personally — not through your company." },
        { tag: "Private individual", titel: "You want your own US business", text: "Customers, contracts or a project in the US — and a company of your own for it, without first forming a company in your home country." },
      ],
    },
    {
      typ: "etappen", id: "ablauf", h2: "How to instruct us as a private individual",
      etappen: [
        { titel: handlung("angebot", "en"), text: "In the fee calculator you enter your details and see your schedule of fees in advance." },
        { titel: "Enter your details", text: "On your proposal page you enter your date of birth and address and choose the name of your company. No register extract or company details are needed." },
        { titel: "Withdrawal instructions and start", text: "You read the agreement with the withdrawal instructions. By signing, you expressly request that we begin before the withdrawal period expires." },
        { titel: "Agreement, invoice, passport", text: "You receive the agreement and invoice in your name by email, together with the withdrawal instructions and the model withdrawal form. You then upload your passport." },
      ],
    },
    {
      typ: "tabelle", id: "unterschied", h2: "You personally — what that means",
      kopf: ["", "How it is arranged"],
      zeilen: [
        ["Party to the agreement", "You personally"],
        ["Shareholder of the US company", "You yourself, alone"],
        ["Documents", "Your passport, after signing"],
        ["Fees", "Stated in full; nothing is added"],
        ["Right of withdrawal", "fourteen days by law"],
        ["Your business as shareholder", "we agree this with you in a call"],
      ],
      hervor: 1,
    },
    {
      typ: "text", id: "steuern", h2: "Tax — the same rules apply to private individuals",
      absaetze: [
        `${satz("S10", "en")} If you hold a US company privately and manage it from your home country, it is generally taxed there. In Germany the shareholding must be reported to the tax office under section 138 of the German Fiscal Code (AO); how the income is categorised depends on the activity and on the classification of the company by comparison with German legal forms (Typenvergleich).`,
        "Tax matters in your country of residence rest with partner tax advisers, who act in their own professional capacity. Your own tax adviser handles the ongoing tax return.",
      ],
    },
    {
      typ: "hinweis", id: "wissen", h2: "What you need to know",
      punkte: [
        "Right of withdrawal: you can withdraw from your agreement within fourteen days without giving any reason. Because you request that we begin before the period expires, you then pay a reasonable amount for the services provided until you withdraw. Once the agreement has been fully performed, the right of withdrawal lapses.",
        GLOBAL_PFLICHTHINWEIS.en[0],
        GLOBAL_PFLICHTHINWEIS.en[2],
        // Who the engagement is not suited to (guide 3.1 rule 10, 6.2) — as on the service pages, the last point.
        beleg("fuerWenNicht", "en"),
      ],
    },
    // Wie im Deutschen: seit E-509 ein Produkt, die Karte „One engagement“.
    { typ: "pakete", id: "mandat", h2: P.karteH2, lead: P.karteLead },
  ],
  fragen: [
    { f: "Can I form a US company as a private individual?", a: "Yes. You need neither a company of your own nor a residence in the US. You personally become the shareholder of the US company; the agreement and invoice are issued in your name." },
    { f: "Do I need a company to engage FIAON Global?", a: "No. You engage us as a person: on your proposal page you enter your name, date of birth and address. No register extract or company details are needed." },
    { f: "Do I have a right of withdrawal as a private individual?", a: "Yes — the statutory fourteen-day right of withdrawal from the conclusion of the agreement. By signing, you request that we begin before the withdrawal period expires; in that case, if you withdraw, you pay a reasonable amount for what has already been provided." },
    { f: "What does it cost?", a: P.preisSatzKurz },
    { f: "Which funding target can I choose?", a: P.rahmenSatz },
    // Wie auf /business: Das Kapital ist nicht an die USA gebunden (GLOBAL_KAPITAL_FREI).
    { f: GLOBAL_KAPITAL_FREI.en.frage, a: GLOBAL_KAPITAL_FREI.en.antwort },
    { f: "What does the company cost from the second year onwards?", a: `With annual administration, ${P.jahres} a year, on request. It includes the state fee, the registered agent, a US business address, a US telephone number and the annual US filing (Form 5472). Annual administration does not renew automatically. The tax adviser in your country of residence is not included.` },
    { f: "Can I transfer the US company to my business later?", a: "In principle, yes. A transfer has tax consequences in both countries; please check this with your tax adviser beforehand." },
    { f: "Do I have to travel to the United States?", a: `Not for the formation or your company’s tax identification number. Whether an institution requires you to attend in person for an account, a card or financing is for that institution to decide. ${weitererSatz("MIAMI", "en")}` },
    { f: "Which documents do I need as a private individual?", a: "Your passport — you upload it after signing. You choose the name of your company on your proposal page. If an authority or an institution requires further documents, we tell you which." },
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
