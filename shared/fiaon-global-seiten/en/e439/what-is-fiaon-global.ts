// ═══════════════════════════════════════════════════════════════════════════
// FIAON GLOBAL — CONCEPT PAGE: WHAT IS FIAON GLOBAL? (27.10.2026, E-439) · FG · 53
// neu gefasst am 13.11.2026 (E-510, Sprachleitfaden FIAON Global)
//
// Die englische Schwester von ../../e439/was-ist-fiaon-global.ts — die Entitätsseite
// für Google und KI-Modelle: die Positionierung ganz oben, ein Faktenkasten, die acht
// Anlaufstellen, die sechs Schritte, die Rollen, was FIAON Global nicht ist und wie
// ein Mandat beginnt. Selbstbezeichnung „business consultancy“ (= Unternehmens-
// beratung, Justin 27.10.2026, E-439). Hauptsuchwort EN „FIAON Global“ (Titel, H1,
// Kurz, erster Absatz, mehrere H2).
//
// Britisches Englisch, inhaltlich identisch: dieselben Bausteine in derselben
// Reihenfolge, dieselben ids, gleich viele Absätze, Punkte, Zeilen, Spalten, Schritte,
// Fragen, Blick-Zeilen und Kennziffern; Quellen mit denselben Adressen in derselben
// Reihenfolge (englische Titel). Zahlen aus fakten-en.ts, wo die deutsche Fassung
// fakten.ts liest.
//
// E-510 (13.11.2026): Die Positionierung (Leitfaden 1.1), der Definitionssatz (9.4),
// die sechs Schritte (2.3, Schritt 5 in der Fassung „heute“), die festen Sätze S1 bis
// S17, die Belege (6.2) und die Übergangssätze kommen aus
// shared/fiaon-global-saetze.ts — nie ein zweites Mal getippt; kein Betrag ist
// getippt (SAETZE_BETRAEGE). Ein Wort je Sache: engagement · client · fee · funding
// target · the lender · proposal · fee calculator · annual administration · step.
// Was hier NIE steht: wer für eine Finanzierung einsteht (nur im persönlichen Angebot
// und im Vertrag) · “subject to satisfactory due diligence” (Vorbehalt V1) · ein
// eigener Erklär-Satz zum Erfolgshonorar (V3) · ein Partner bei der Arbeit im Präsens
// (V2 — nur die Rollenwörter) · Ort oder Name einer Partnergesellschaft, ein „team on
// the ground“ · eine Dauer als Zusage · Austria oder Switzerland im selben Satz wie
// accounts, cards oder financing · die Presse-Zeile (steht einmal je Seite im
// Vertrauens-Band der Vorlage). Wortwand EN: kein „up to“, kein Bankname, keine Frist
// mit Ziffer, kein Zinssatz, kein „recommend“, kein „advice“, „personal guarantee“
// nur als Fachbegriff, kein „credit broker“ / „loan broker“ (auch nicht verneint —
// es heißt “does not broker loans”).
// ═══════════════════════════════════════════════════════════════════════════
import type { GlobalSeite, GlobalQuelle } from "../../typen";
import { GLOBAL_PFLICHTHINWEIS, GLOBAL_KAPITAL_FREI } from "../../../fiaon-global";
import { GELD_ZURUECK, SAETZE_BETRAEGE, SCHRITTE_KOPF, beleg, satz, sechsSchritte, weitererSatz } from "../../../fiaon-global-saetze";
import { EIN_PRODUKT } from "../../ein-produkt";
import { FIAON_FIRMA as F } from "../../../fiaon-firma";
import { QUELLEN_WISSEN_EN as Q, QUELLEN_STAATEN_EN, QUELLEN_RECHT_EN as R, IRS_EN } from "../../fakten-en";

/** Day of first publication (E-439). */
const S = "2026-10-27";
/** Day of the last change in substance (E-510, style guide) — first published remains 27 October. */
const STAND = "2026-11-13";
const P = EIN_PRODUKT.en;
/** The amounts from the price source — never typed. */
const B = SAETZE_BETRAEGE.en;
/** The six steps, word for word from the source of the fixed sentences (step 5 in today’s version). */
const SCHRITTE = sechsSchritte("en").schritte;
const KOPF = SCHRITTE_KOPF.en;

/** The positioning in one sentence (guide 1.1) — stands word for word in the head of the page. */
const POSITIONIERUNG = weitererSatz("POSITIONIERUNG", "en");
/** The definition (guide 9.4) — the same wording for the short profile, the questions, structured data and /llms.txt. */
const DEFINITION = weitererSatz("DEFINITION", "en");
/** The roles sentence on the partners (guide 5.11) and its second sentence: who bears their fees. */
const ROLLEN = weitererSatz("ROLLEN", "en");
const HONORARE_DER_PARTNER = ROLLEN.split(/(?<=\.)\s+/)[1];
/** Sentence S8 in its three sentences: not a bank, not a law firm · no lending, no brokering · legal and tax matters with partners. */
const [KEINE_BANK, KEINE_KREDITE, RECHT_UND_STEUERN] = satz("S8", "en").split(/(?<=\.)\s+/);
/** The fees in short form (guide 1.3, answer to “What does it cost — and when?”) — always all three parts. */
const HONORAR = `${B.honorarAuftrag} on engagement. On registration of your company, the success fee set by your funding target — at least ${B.erfolgMin}. From the second year, on request, ${B.jahresbetreuung} a year.`;
/** The passport in the ITIN application — the route the IRS allows, without naming a partner or a place. */
const PASS_WEG = "The IRS allows a Certifying Acceptance Agent authorised by it to verify your passport; you then do not have to send the original to the United States. We agree the route with you before the application is filed.";
/** The Miami sentence with its reference (guide 5.8) — written out, because here it stands without the range of the funding target. */
const MIAMI = "From a funding target of US$1 million, we work with you in person in Miami.";
/** What the funds from a financing may be used for (Justin, 19.09.2026) — with the lender and the responsibility for tax questions. */
const MITTEL_IN_EUROPA = "The funds from a financing are not tied to the United States. Your company may transfer them to Europe or invest them there, within the terms set by the lender. The tax treatment of transfers and investments rests with partner tax advisers acting in their own professional capacity.";

/** Eigene Quellen dieser Seite — dieselben Adressen wie in der deutschen Fassung, englische Titel. */
const QUELLEN: Record<string, GlobalQuelle> = {
  chFirma: { titel: "Companies House — FIAON LTD, company number 17318250 (register entry)", url: "https://find-and-update.company-information.service.gov.uk/company/17318250" },
  chOrgane: { titel: "Companies House — FIAON LTD, officers (director)", url: "https://find-and-update.company-information.service.gov.uk/company/17318250/officers" },
  bao27: { titel: "Section 27 Austrian Federal Fiscal Code (BAO) — seat and place of management (RIS)", url: "https://www.ris.bka.gv.at/NormDokument.wxe?Abfrage=Bundesnormen&Gesetzesnummer=10003940&Paragraf=27" },
  kstgAt1: { titel: "Section 1 Austrian Corporate Income Tax Act 1988 (KStG 1988) — unlimited and limited tax liability (RIS)", url: "https://www.ris.bka.gv.at/NormDokument.wxe?Abfrage=Bundesnormen&Gesetzesnummer=10004569&Paragraf=1" },
  stberg5: { titel: "Section 5 German Tax Consultancy Act (StBerG) — prohibition of unauthorised assistance in tax matters", url: "https://www.gesetze-im-internet.de/stberg/__5.html" },
  rdg3: { titel: "Section 3 German Legal Services Act (RDG) — authorisation to provide out-of-court legal services", url: "https://www.gesetze-im-internet.de/rdg/__3.html" },
  wyAgent: { titel: "Wyoming Statutes § 17-28-101 — registered office and registered agent (Wyoming Legislature)", url: "https://statutes.wyoleg.gov/NXT/gateway.dll/2022%20Wyoming%20Statutes/2022%20Titles/898/1039" },
};

export const SEITE: GlobalSeite = {
  pfad: "/en/business/what-is-fiaon-global",
  sprache: "en",
  schwester: "/business/was-ist-fiaon-global",
  art: "leistung",
  seo: {
    titel: "What is FIAON Global? Business consultancy — FIAON Global",
    beschreibung: "FIAON Global is the business consultancy of FIAON LTD, London, for your US company: one engagement, clear roles, fees in advance — stated with sources.",
  },
  stand: STAND,
  erschienen: S,
  kennung: "FG · 53",
  auge: "FIAON Global · Who we are",
  h1: "What is FIAON Global?",
  h1b: "The business consultancy for your US company.",
  lead: `${POSITIONIERUNG} This page names your contracting party, the six steps of the engagement and who decides what.`,
  ziffern: [
    { wert: "1 engagement", label: "one agreement, one dedicated contact" },
    { wert: F.companyNo, label: `company number of ${F.name}, registered in England and Wales` },
    { wert: "6 steps", label: "each with its condition" },
  ],
  blick: [
    ["What", `Business consultancy of ${F.name} for US companies`],
    ["Contracting party", `${F.name}, London · registered in England and Wales, company number ${F.companyNo}`],
    ["We handle", "Formation, documents and tax identification numbers; fully prepared applications for accounts, credit cards on request and financing"],
    ["You", "Choose the name, upload your passport and sign; you submit the applications to the institutions yourself"],
    ["Who decides", "The state, the US tax authority and the institution concerned"],
    ["Fees", HONORAR],
    [GELD_ZURUECK.en.auge, satz("S7", "en")],
  ],
  kurz: `FIAON Global is the business consultancy of ${F.name}, London (company number ${F.companyNo}). We form your US company, assemble every document and apply for the tax identification numbers. We prepare your applications for accounts, credit cards on request and financing in full; you submit them yourself. Decisions rest with the state, the US tax authority and the institution concerned. ${KEINE_BANK}`,
  bloecke: [
    {
      typ: "text", id: "definition", h2: "FIAON Global: the idea behind it",
      absaetze: [
        "Anyone building a US company from abroad usually deals with eight parties — from the state to the card issuer. Each has its own forms, its own deadlines and its own queries. FIAON Global brings this work together under one engagement. You have one dedicated contact, and every responsibility is named.",
        `FIAON Global is the division of ${F.name} for US companies. Your contracting party is always ${F.name}, with its registered office in London. ${weitererSatz("UEBERGANG-EINREICHUNG", "en")} We work in German and in English, for clients resident or based in Germany, Austria and Switzerland.`,
      ],
    },
    {
      typ: "tabelle", id: "fakten", h2: "The facts about FIAON Global",
      lead: "The details of the company — each with the source where you can check it yourself.",
      kopf: ["Feature", "Detail"],
      zeilen: [
        ["Name", `FIAON Global — the division of ${F.name} for US companies`],
        ["What it is", "Business consultancy for US companies: formation, ongoing administration and support through to the lender’s decision on financing"],
        ["Contracting party", `${F.name}, private limited company, England and Wales`],
        ["Register", `Companies House, company number ${F.companyNo}, incorporated on 3 July 2026`],
        ["Registered office", `${F.strasse}, ${F.ortZeile}, United Kingdom`],
        ["Management", `${F.director}, Director and founder`],
        ["In the United States", `${weitererSatz("UEBERGANG-EINREICHUNG", "en")} ${MIAMI}`],
        ["For whom", "Businesses, the self-employed and private individuals resident or based in Germany, Austria or Switzerland"],
        ["What is formed", "US company (LLC) in Delaware, Florida or Wyoming"],
        ["Languages", "German and English"],
        ["Engagement", `One engagement: ${P.name}`],
        ["Fees", HONORAR],
        ["Contact", `${F.email} · ${F.telefon}`],
      ],
      fuss: [`Register details as shown at Companies House, retrieved on 27 October 2026. ${beleg("honorarVorab", "en")}`],
    },
    {
      typ: "tabelle", id: "anlaufstellen", h2: "One dedicated contact instead of eight parties",
      lead: "Eight parties that a US company owned from abroad usually deals with. The last column shows who handles what once you instruct FIAON Global.",
      kopf: ["Party", "What it is about", "Without FIAON Global", "With FIAON Global"],
      zeilen: [
        ["State", "Formation of the company, state fee", "find a formation service or file yourself", "we file your company, state fee included; registration is decided by the state"],
        ["Registered agent", "mandatory address for service in the state, plus a US business address and US telephone number", "separate contract, separate annual fee", "included in the first year; your dedicated contact coordinates post, calls and appointments"],
        ["US tax authority (IRS)", "EIN for the company (Form SS-4), ITIN for you personally (Form W-7)", "English-language forms; from abroad only by phone, fax or post, not online", "we apply for the EIN and, following our ITIN check, for the ITIN; the IRS decides"],
        ["Lawyer", "Operating agreement and formation documents", "separate instruction, separate fee", "operating agreement and formation documents are included; legal matters rest with partner lawyers, in their own professional capacity"],
        ["Tax adviser in your country of residence", "Tax liability in your country of residence, reporting the formation", "separate instruction, separate fee", "tax questions rest with partner tax advisers acting in their own professional capacity; your tax return remains with your own tax adviser"],
        ["US certified public accountant (CPA)", "Annual US filing (Form 5472 with Form 1120)", "separate instruction, renewed every year", "the first annual US filing is included, later ones with annual administration"],
        ["Institutions", "Personal US account and business account", "find an institution, gather the documents, apply", "we prepare every application in full; you submit it yourself, and the institution concerned decides"],
        ["Card issuers", "Credit cards, personal and for your company", "each application separately", "on request we prepare every application, at no additional fee from FIAON; the card issuer decides"],
      ],
      hervor: 3,
      fuss: [
        "Suppliers and institutions also look at the D-U-N-S Number issued by Dun & Bradstreet: nine digits, issued without a fee.",
        "Florida, Delaware and Wyoming each require every company to have a registered agent with an address in the state.",
      ],
    },
    {
      // The six steps of the fixed narrative (guide 2.3): sentence, condition and “Your outcome” — no timings. “Your part” is in the block “rollen” below.
      typ: "etappen", id: "etappen", h2: KOPF.h2,
      lead: KOPF.lead,
      etappen: SCHRITTE.map((s) => ({ titel: s.titel, text: `${s.satz} ${s.bedingung} ${KOPF.teile.ihrErgebnis}: ${s.ihrErgebnis}` })),
    },
    {
      typ: "rollen", id: "rollen", h2: "Who is responsible for what",
      lead: ROLLEN,
      fiaon: [
        "files your company with the state, state fee included",
        "assembles the documents and applies for the EIN and the ITIN (the ITIN following our ITIN check)",
        "provides the registered agent, US business address and US telephone number in the first year",
        "prepares every application for accounts, credit cards on request and financing in full",
        "keeps the compliance calendar and files the first annual report with the state",
        "bears the partners’ fees for the services in your agreement",
      ],
      partner: [
        "Partner lawyers: legal matters, in their own professional capacity",
        "US certified public accountant (CPA) from our partner network: the first annual US filing",
        "Partner tax advisers: tax questions in your country of residence, in their own professional capacity",
      ],
      sie: [
        "choose the name, upload your passport and sign the documents presented to you",
        "submit the applications to the institution and the card issuer yourself",
        "choose your funding target; your company decides on any financing offer from the lender",
        "report the formation to the tax office — in Germany under section 138 of the German Fiscal Code (AO), with your tax adviser",
      ],
    },
    {
      typ: "text", id: "fiaon", h2: "What FIAON Global handles",
      absaetze: [
        "FIAON Global works on one principle: one engagement, one agreement, one dedicated contact. Your contact leads your engagement from the proposal to the last step. We present every document ready for your signature. Your portal shows the current status.",
        `We apply for your company’s EIN on Form SS-4. ${weitererSatz("UEBERGANG-ITIN", "en")} ${PASS_WEG} ${satz("S3", "en")}`,
        `On accounts and cards: ${satz("S2", "en")} Every statement in an application remains your own. Name, address and telephone number are spelt the same way on every form. ${beleg("keinZugriff", "en")}`,
        `On financing: ${satz("S9", "en")} ${satz("S7", "en")}`,
        `${RECHT_UND_STEUERN} ${HONORARE_DER_PARTNER} The reason for this separation is professional regulation. In Germany, assistance in tax matters may be provided on a business basis only by those authorised to do so (section 5 of the German Tax Consultancy Act, StBerG). The same applies to out-of-court legal services (section 3 of the German Legal Services Act, RDG).`,
        `${satz("S12", "en")} ${weitererSatz("ZAHLUNG", "en")}`,
        MITTEL_IN_EUROPA,
      ],
    },
    {
      typ: "text", id: "einordnung", h2: "Business consultancy or formation service: the distinction",
      absaetze: [
        "A formation service files the company with the state and usually provides the registered agent. What follows are the tax identification numbers with the IRS, the operating agreement and the first annual US filing. Added to these are tax liability in your country of residence and the applications to institutions and card issuers.",
        "FIAON Global therefore works as a business consultancy: one engagement for formation, documents and the preparation of your applications, with one dedicated contact. Formation alone costs less with a formation service. Our fee also covers the tasks that follow, from the tax identification numbers to the first annual US filing.",
        `These tasks are not a formality. An LLC wholly owned by a single foreign owner files Form 5472 with Form 1120 with the IRS. This applies to every year with reportable transactions between the company and its owner, even without revenue. The capital contribution and formation costs paid already count as such transactions. Where the tax year is the calendar year, the deadline is ${IRS_EN.frist5472}. If the filing is not made, the IRS can impose a penalty of ${IRS_EN.strafe5472}. That is why the first annual US filing is included in your engagement.`,
      ],
    },
    {
      typ: "text", id: "inklusive", h2: "Included in the first year",
      absaetze: ["On engagement, the first year includes:"],
      punkte: [...P.enthalten],
      nach: `Not included: the charges and interest of card issuers and institutions, the cost of the loan, and taxes. Available on request: annual administration from the second year (${B.jahresbetreuung} a year) and priority handling (${B.fastTrack}). Tax returns in your country of residence remain with your own tax adviser.`,
    },
    {
      // Proposal, signature, invoice and passport stand BEFORE the six steps — they do not count as steps (guide 2.1).
      typ: "etappen", id: "auftrag", h2: "Your engagement begins",
      lead: "Four things are in place before the first of the six steps begins.",
      etappen: [
        { titel: "Your proposal", text: "You request it in the fee calculator or arrange a call first: thirty minutes, free of charge and without obligation." },
        { titel: "Your signature", text: `You read your complete agreement in your personal proposal, choose the name of your company and sign online. The agreement is in German; your contracting party is ${F.name}, London.` },
        { titel: "Your invoice", text: `You receive the agreement and the invoice by email, together with access to your portal. ${weitererSatz("ZAHLUNG", "en")}` },
        { titel: "Your passport", text: "You upload it once you have signed. We begin once your payment and your passport have been received." },
      ],
    },
    {
      typ: "text", id: "pruefen", h2: "FIAON Global reviews: check us yourself",
      absaetze: [
        "Reviews are one point of reference. More reliable is what you can check yourself before you sign:",
      ],
      punkte: [
        `the contracting party in the register: ${F.name}, Companies House, company number ${F.companyNo}, incorporated on 3 July 2026, registered office at ${F.strasse} in London — open to public inspection`,
        `the management: the Director is ${F.director}, entered in the same register`,
        "the agreement: you read it in full in your personal proposal before you sign; it is in German",
        "the fees: they are stated as amounts in your proposal before you sign",
        `the payment: ${beleg("zahlung", "en")}`,
        "the limits: this page and your agreement state what FIAON Global is not",
      ],
      nach: "You can check the same points with any provider. No provider can honour a commitment on limits or interest: each institution makes its own decision.",
    },
    {
      typ: "zitat", id: "kurzprofil",
      text: DEFINITION,
      quelle: "Short profile of FIAON Global for citation · as at November 2026",
    },
    { typ: "pakete", id: "mandat", h2: P.karteH2, lead: P.karteLead },
    {
      typ: "hinweis", id: "nicht", h2: "What FIAON Global is not",
      lead: "These limits are fixed before you sign.",
      punkte: [
        `Not a bank: FIAON holds no accounts and issues no cards. ${beleg("keinZugriff", "en")} Decisions on accounts, cards and financing rest with the institution concerned.`,
        `Does not broker loans: ${KEINE_KREDITE} ${satz("S9", "en")} ${satz("S1", "en")}`,
        `Not a tax scheme: ${satz("S10", "en")} If the company is managed from your country of residence, it is taxable there as well: in Germany under section 10 AO and section 1 KStG. In Austria the place of management is decisive (section 27(2) BAO, section 1 KStG 1988); in Switzerland, the place of effective management (Art. 50 DBG).`,
        `Not a law firm: FIAON provides no assistance in tax matters and no legal services. ${RECHT_UND_STEUERN}`,
        "No commitment on interest: each card issuer and each institution sets its own charges and interest.",
        GLOBAL_PFLICHTHINWEIS.en[0],
        GLOBAL_PFLICHTHINWEIS.en[1],
        GLOBAL_PFLICHTHINWEIS.en[2],
      ],
    },
  ],
  fragen: [
    { f: "What is FIAON Global?", a: DEFINITION },
    { f: "Is FIAON Global a bank, or does it broker loans?", a: `No. ${KEINE_BANK} ${KEINE_KREDITE} ${satz("S2", "en")} ${satz("S9", "en")} ${satz("S1", "en")}` },
    { f: "Who is behind FIAON Global?", a: `Your contracting party is ${F.name}, a private limited company with its registered office at ${F.strasse} in London. It is registered in England and Wales under company number ${F.companyNo} and was incorporated on 3 July 2026. The Director is ${F.director}. You can view the entry without an account.` },
    { f: "What does FIAON Global cost?", a: satz("S12", "en") },
    { f: "Does a US company set up through FIAON Global lower my taxes?", a: `No. ${satz("S10", "en")} You report the formation to the tax office, in Germany under section 138 of the German Fiscal Code (AO) with your tax return. ${beleg("fuerWenNicht", "en")}` },
    { f: "How does FIAON Global differ from a formation service?", a: "A formation service files the company with the state. FIAON Global works under one engagement: formation, documents and tax identification numbers, plus fully prepared applications for accounts, credit cards on request and financing. Each institution makes its own decision on every application. Formation alone costs less with a formation service." },
    { f: "Do I have to travel to the US for FIAON Global?", a: `Not for the formation or for your company’s tax identification number. ${weitererSatz("UEBERGANG-EINREICHUNG", "en")} ${PASS_WEG} Whether you need to attend in person is for the institution concerned to decide. ${MIAMI}` },
    { f: GLOBAL_KAPITAL_FREI.en.frage, a: `No. ${MITTEL_IN_EUROPA}` },
  ],
  weiter: ["/en/business/process", "/en/business/comparison", "/en/business/knowledge/us-funding-for-foreign-owned-companies", "/en/business/knowledge/us-llc-tax"],
  quellen: [
    QUELLEN.chFirma,
    QUELLEN.chOrgane,
    Q.ss4,
    Q.w7,
    Q.caa,
    Q.i5472,
    Q.duns,
    QUELLEN_STAATEN_EN.florida[3],
    Q.delawareAgent,
    QUELLEN.wyAgent,
    R.ao10,
    R.kstg1,
    Q.ao138,
    QUELLEN.bao27,
    QUELLEN.kstgAt1,
    R.dbg50,
    QUELLEN.stberg5,
    QUELLEN.rdg3,
  ],
};
