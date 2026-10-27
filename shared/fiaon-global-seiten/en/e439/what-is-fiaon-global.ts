// ═══════════════════════════════════════════════════════════════════════════
// FIAON GLOBAL — CONCEPT PAGE: WHAT IS FIAON GLOBAL? (27.10.2026, E-439) · FG · 53
//
// Die englische Schwester von ../../e439/was-ist-fiaon-global.ts — die Entitätsseite
// für Google und KI-Modelle (Recherche .arbeit/recherche/ki.md, Befund 5 und
// Abschnitt 5): ein Definitionssatz ganz oben, ein Faktenkasten, die acht
// Anlaufstellen, die vier Etappen, die Rollen, was FIAON Global nicht ist und wie ein
// Auftrag abläuft. Selbstbezeichnung „business consultancy“ (= Unternehmensberatung,
// Justin 27.10.2026, E-439/E-439). Hauptsuchwort EN „FIAON Global“ (Titel, H1, Kurz,
// erster Absatz, mehrere H2).
//
// Britisches Englisch, inhaltlich identisch: dieselben Bausteine in derselben
// Reihenfolge, dieselben ids, gleich viele Absätze, Punkte, Zeilen, Spalten, Etappen,
// Fragen, Blick-Zeilen und Kennziffern; Quellen mit denselben Adressen in derselben
// Reihenfolge (englische Titel). Zahlen aus fakten-en.ts, wo die deutsche Fassung
// fakten.ts liest. Fach- und Rechtsprüfung wie in der deutschen Fassung vom 27.10.2026
// (SS-4 12/2025: EIN aus dem Ausland per Telefon, Fax oder Post; Third Party Designee
// bis zur Vergabe der EIN; CAA-Seite der IRS: Pass oder beglaubigte Kopie liegt dem CAA
// im Gespräch vor; i5472; Registered Agent FL § 605.0113, DE § 18-104, WY § 17-28-101;
// § 138 Abs. 5 AO; § 5 StBerG, § 3 RDG, § 34c GewO; § 27 Abs. 2 BAO; Art. 50 DBG;
// Companies House: FIAON LTD, 17318250, eingetragen am 3. Juli 2026).
//
// Bewusst NICHT genannt: die Partnergesellschaften in Zürich und Miami, Anbieter-
// namen, Paketpreise als Zahl (Baustein „pakete“), der Preis der Jahresbetreuung,
// eine Bürgschaft. Wortwand EN: kein „up to“, kein Bankname, keine Frist mit Ziffer
// als Zusage, kein Zinssatz, kein „recommend“, „advice“ nur verneint, „personal
// guarantee“ als Fachbegriff, Firmenkarte = „business credit card“, kein „credit
// broker“ (→ „loan intermediary“). Über Konto, Karte, Rahmen und Darlehen entscheidet
// das Institut; FIAON vermittelt keine Kredite; keine US-Gesellschaft als Steuermodell.
// ═══════════════════════════════════════════════════════════════════════════
import type { GlobalSeite, GlobalQuelle } from "../../typen";
import {
  GLOBAL_PFLICHTHINWEIS, GLOBAL_KAPITAL_FREI, GLOBAL_GELD_ZURUECK, GLOBAL_ROLLEN, GLOBAL_INKLUSIVE, GLOBAL_NICHT_INKLUSIVE, globalPaket,
} from "../../../fiaon-global";
import { FIAON_FIRMA as F } from "../../../fiaon-firma";
import { QUELLEN_WISSEN_EN as Q, QUELLEN_STAATEN_EN, QUELLEN_RECHT_EN as R, IRS_EN } from "../../fakten-en";

const S = "2026-10-27";
const KAPITAL_FREI = `${GLOBAL_KAPITAL_FREI.en.satz} ${GLOBAL_KAPITAL_FREI.en.steuer}`;
const GELD_ZURUECK = GLOBAL_GELD_ZURUECK.aktiv ? [`${GLOBAL_GELD_ZURUECK.en.text} ${GLOBAL_GELD_ZURUECK.en.bedingungen}`] : [];

/** Paketnamen auf Englisch — aus dem Katalog, nie von Hand. */
const STRUKTUR = globalPaket("global_struktur")?.en.name ?? "Global Structure";
const BANKING = globalPaket("global_banking")?.en.name ?? "Global Banking";
const KAPITAL = globalPaket("global_kapital")?.en.name ?? "Global Capital";
const VIP = globalPaket("global_vip")?.en.name ?? "Global VIP";

/** Aufzählungspunkte im Satz: erster Buchstabe klein. */
const klein = (x: string) => x.charAt(0).toLowerCase() + x.slice(1);

/** The definition — the same wording for the page, the short profile and the questions. */
const DEFINITION = `FIAON Global is the business consultancy of ${F.name} (London, Companies House ${F.companyNo}) for businesses, the self-employed and private individuals from Germany, Austria and Switzerland who are forming a US company and planning the route to an account, business credit cards and capital — under one roof, at a fixed price.`;

/** Eigene Quellen dieser Seite — dieselben Adressen wie in der deutschen Fassung, englische Titel. */
const QUELLEN: Record<string, GlobalQuelle> = {
  chFirma: { titel: "Companies House — FIAON LTD, company number 17318250 (register entry)", url: "https://find-and-update.company-information.service.gov.uk/company/17318250" },
  chOrgane: { titel: "Companies House — FIAON LTD, officers (director)", url: "https://find-and-update.company-information.service.gov.uk/company/17318250/officers" },
  bao27: { titel: "Section 27 Austrian Federal Fiscal Code (BAO) — seat and place of management (RIS)", url: "https://www.ris.bka.gv.at/NormDokument.wxe?Abfrage=Bundesnormen&Gesetzesnummer=10003940&Paragraf=27" },
  kstgAt1: { titel: "Section 1 Austrian Corporate Income Tax Act 1988 (KStG 1988) — unlimited and limited tax liability (RIS)", url: "https://www.ris.bka.gv.at/NormDokument.wxe?Abfrage=Bundesnormen&Gesetzesnummer=10004569&Paragraf=1" },
  stberg5: { titel: "Section 5 German Tax Consultancy Act (StBerG) — prohibition of unauthorised assistance in tax matters", url: "https://www.gesetze-im-internet.de/stberg/__5.html" },
  rdg3: { titel: "Section 3 German Legal Services Act (RDG) — authorisation to provide out-of-court legal services", url: "https://www.gesetze-im-internet.de/rdg/__3.html" },
  gewo34c: { titel: "Section 34c German Trade Regulation Act (GewO) — licence requirement, among others for loan intermediaries", url: "https://www.gesetze-im-internet.de/gewo/__34c.html" },
  wyAgent: { titel: "Wyoming Statutes § 17-28-101 — registered office and registered agent (Wyoming Legislature)", url: "https://statutes.wyoleg.gov/NXT/gateway.dll/2022%20Wyoming%20Statutes/2022%20Titles/898/1039" },
};

/** The passport for the ITIN — more precise than GLOBAL_AGENT.en.pass (IRS, ITIN Acceptance Agent Program). */
const PASS = "Our certified acceptance agent partner in the DACH region checks your passport, in person or in a video appointment; they must have the passport, or a copy certified by the issuing authority, in front of them while doing so. You do not have to send it to the US.";

export const SEITE: GlobalSeite = {
  pfad: "/en/business/what-is-fiaon-global",
  sprache: "en",
  schwester: "/business/was-ist-fiaon-global",
  art: "leistung",
  seo: {
    titel: "What is FIAON Global? Business consultancy — FIAON Global",
    beschreibung: "FIAON Global is the business consultancy of FIAON LTD for your US company: one point of contact instead of eight, at a fixed price.",
  },
  stand: S,
  erschienen: S,
  kennung: "FG · 53",
  auge: "FIAON Global · Who we are",
  h1: "What is FIAON Global?",
  h1b: "The business consultancy for your US company.",
  lead: `${DEFINITION} This page explains what that means: who your contracting party is, which eight points of contact we bring together and who decides what.`,
  ziffern: [
    { wert: "1 instead of 8", label: "one point of contact for eight parties" },
    { wert: F.companyNo, label: "FIAON LTD’s entry at Companies House, London" },
    { wert: "3 locations", label: "London, Zurich, Miami" },
  ],
  blick: [
    ["What", "Business consultancy for building a US company"],
    ["Contracting party", `${F.name}, London, Companies House ${F.companyNo}`],
    ["Locations", "London · Zurich · Miami"],
    ["For whom", "Businesses, the self-employed and private individuals from Germany, Austria and Switzerland"],
    ["Price", "Fixed price per package, all package fees included"],
    ["Who decides", "The institution alone decides on account, card and limit"],
    ["With FIAON Global", "One point of contact instead of eight"],
  ],
  kurz: `FIAON Global is the business consultancy of FIAON LTD in London for businesses, the self-employed and private individuals from Germany, Austria and Switzerland who are building a US company. With the client’s power of attorney, FIAON files the applications on their behalf (formation, EIN, D-U-N-S Number, filings), prepares the ITIN and provides the registered agent, US address and US phone number in the first year; the client files account, card and credit applications themselves, fully prepared. Partner tax advisers, US CPAs and partner lawyers act under the client’s engagement; FIAON pays their fees for the services in the package. FIAON is not a bank, does not arrange loans and does not commit to any limit.`,
  bloecke: [
    {
      typ: "text", id: "definition", h2: "What is FIAON Global? The idea behind it",
      absaetze: [
        "Behind the definition above lies a simple idea. Anyone from the German-speaking region who builds a US company usually deals with eight parties: the state, a registered agent, the US tax authority (IRS), a lawyer, a tax adviser at home, a US CPA, banks and card issuers. Each has its own forms, its own deadlines and its own queries — and none of them knows the others. FIAON Global brings them together: you have one point of contact, and we coordinate everyone else involved.",
        "FIAON Global is the division of FIAON LTD for US companies. Your contracting party is FIAON LTD in London in all cases; our team on the ground works in Miami, and Zurich is our partner location. We work in German and in English, for clients resident or registered in Germany, Austria and Switzerland.",
      ],
    },
    {
      typ: "tabelle", id: "fakten", h2: "FIAON Global at a glance: the fact box",
      lead: "The details a search engine, an AI system or a cautious client wants to know first — with the source where you can check each of them yourself.",
      kopf: ["Feature", "Detail"],
      zeilen: [
        ["Name", "FIAON Global — the division of FIAON LTD for US companies"],
        ["What it is", "Business consultancy for building a US company: formation, tax numbers, US presence, prepared account and card applications, capital stages"],
        ["Contracting party", `${F.name}, private limited company, registered in England and Wales`],
        ["Register", `Companies House, company number ${F.companyNo}, incorporated on 3 July 2026`],
        ["Registered office", `${F.strasse}, ${F.ortZeile}, United Kingdom`],
        ["Management", `${F.director}, director and founder`],
        ["Locations", "London (contracting party) · Zurich (partner location) · Miami (team on the ground)"],
        ["For whom", "Businesses, the self-employed and private individuals resident or registered in Germany, Austria or Switzerland"],
        ["What is formed", "LLC or corporation in Florida, Delaware or Wyoming"],
        ["Languages", "German and English"],
        ["Packages", `${STRUKTUR}, ${BANKING}, ${KAPITAL}, ${VIP} — each at a fixed price, all package fees included`],
        ["From the second year", "Annual care plan, optional; it does not renew automatically"],
        ["Contact", `${F.email} · ${F.telefon}`],
      ],
      fuss: ["Register details as shown at Companies House, retrieved on 27 October 2026. The fixed prices are listed in the package overview further down this page."],
    },
    {
      typ: "tabelle", id: "anlaufstellen", h2: "One point of contact instead of eight: what FIAON Global brings together",
      lead: "Eight parties that a US company owned from abroad usually deals with — and who takes care of each of them when you engage FIAON Global.",
      kopf: ["Party", "What it is about", "Without FIAON Global", "With FIAON Global"],
      zeilen: [
        ["State", "Formation of the LLC or corporation, state fee", "find a formation service or file yourself", "we file with your power of attorney; the state formation fee is included in the fixed price"],
        ["Registered agent", "mandatory address for service of process in the state, plus a US address and US phone number", "separate contract, separate annual fee", "included in the package for the first year; official mail is scanned for you"],
        ["US tax authority (IRS)", "EIN for the company (Form SS-4), ITIN for you personally (Form W-7)", "English-language forms; from abroad only by phone, fax or post, not online", "we apply for the EIN as third party designee and prepare the ITIN"],
        ["Lawyer", "Operating agreement and formation documents", "separate engagement, separate fee", "partner lawyer under your engagement; FIAON pays the fee for this"],
        ["Tax adviser in your country of residence", "Review before formation: tax liability at home, notifications", "separate engagement, separate fee", "partner tax adviser under your engagement; FIAON pays the fee for the review before formation"],
        ["US CPA", "Annual US filing (Form 5472 with Form 1120)", "separate engagement, renewed every year", "the first filing is included in the package, later ones with the annual care plan"],
        ["Banks", "The company’s business account", "find an institution, gather the documents, apply", "you file the application, fully prepared by us; the bank decides"],
        ["Card issuers", "The company’s business credit cards", "each application separately", `we prepare the first application in every package; from ${BANKING} onwards we also plan the sequence and prepare the follow-up applications; the issuer decides`],
      ],
      hervor: 3,
      fuss: [
        "With your power of attorney we also apply to Dun & Bradstreet for your company’s D-U-N-S Number; it is free of charge and has nine digits.",
        "Florida, Delaware and Wyoming each require every company to have a registered agent with an address in the state.",
      ],
    },
    {
      typ: "etappen", id: "etappen", h2: "The route with FIAON Global in four stages",
      lead: "Durations are figures published by the authorities or drawn from experience, not deadlines. How quickly a stage moves depends on authorities and institutions — and each stage shows who decides.",
      etappen: [
        { titel: "Formation and documents", dauer: "usually a few weeks", text: `Company, EIN, ITIN preparation, registered agent, US address and phone number, operating agreement. For an EIN applied for from abroad the IRS gives ${IRS_EN.einDauer}; for the ITIN it gives ${IRS_EN.itinDauer}. Who decides: the state and the IRS.` },
        { titel: "The first business credit card", dauer: "once the documents are complete", text: "You file the first application with a US issuer, usually with a small limit and no cash deposit, but with a personal guarantee from the owner. We prepare it in full. Who decides: the issuer." },
        { titel: "The card ladder", dauer: "over several months", text: `Settling your statements on time builds the history that other issuers look at when they review an application. From ${BANKING} onwards we plan the sequence and prepare every further application. Introductory periods without debit interest are offered by some issuers; each issuer sets the terms itself. Who decides: each issuer for itself.` },
        { titel: "The bank loan", dauer: "with an established history", text: `With an established history, revenue or collateral, a loan from a US bank may become an option. From ${KAPITAL} onwards we compile the key-figures file and the documents; you file the application. Who decides: the bank, under its own rules.` },
      ],
    },
    {
      typ: "rollen", id: "rollen", h2: "Who does what: FIAON Global, the partners and you",
      lead: GLOBAL_ROLLEN.en.fiaon,
      fiaon: [
        "plans the route and coordinates everyone involved",
        "files the applications with the state, the IRS and Dun & Bradstreet with your power of attorney",
        "prepares the ITIN and provides the registered agent, US address and US phone number in the first year",
        "prepares every account and card application in full",
        "pays the partners’ fees for the services in your package",
        "attends appointments on the ground with the team in Miami",
      ],
      partner: [
        "Partner tax adviser: review before formation and tax liability in your country of residence",
        "Partner lawyer: operating agreement and formation documents",
        "US CPA: first annual US filing (Form 5472 with Form 1120)",
        "Acceptance agent partner in the DACH region: checking your passport for the ITIN",
        "all partners act under your engagement",
      ],
      sie: [
        "grant the power of attorney and upload your documents",
        "make the decisions: legal form, state, name",
        "file account, card and credit applications yourself",
        "report the formation to the tax office — in Germany under section 138 of the German Fiscal Code (AO) together with your tax return, with your tax adviser",
        "settle your statements on time — that builds your history",
      ],
    },
    {
      typ: "text", id: "fiaon", h2: "How FIAON Global takes over your route to the US",
      absaetze: [
        "FIAON Global works as a business consultancy on one principle: one point of contact instead of eight. You speak to one person who leads your engagement from the kick-off meeting to the last stage; we coordinate everyone else involved. With your power of attorney we file the applications for you: the formation with the state, the EIN with the IRS, the D-U-N-S Number with Dun & Bradstreet and your company’s filings. For the EIN, Form SS-4 has a dedicated section for this, the third party designee: the person from our team named there answers the IRS’s questions about the application and receives the EIN; their authority ends as soon as the EIN has been assigned.",
        `We prepare the ITIN. ${PASS} We provide the registered agent, US business address and US phone number for the first year, and official mail is scanned for you.`,
        `You file account, card and credit applications yourself; every statement in them remains your own. We prepare each of these applications in full: name, address and phone number spelt the same way on every form, the documents in the order in which an institution reviews them. From ${BANKING} onwards we plan the sequence of issuers, and from ${KAPITAL} onwards we compile the key-figures file for a later bank loan. If an institution requires an appointment in person, our team in Miami accompanies you.`,
        `${GLOBAL_ROLLEN.en.partner} The reason is professional regulation: in Germany, only those who are authorised to do so may provide assistance in tax matters on a business basis (section 5 of the German Tax Consultancy Act, StBerG); the same applies to out-of-court legal services (section 3 of the German Legal Services Act, RDG). FIAON engages, coordinates and pays the partners; the professional responsibility lies with them, the engagement with you.`,
        "You pay a fixed price that is set before the engagement, with all fees and charges for the services in your package — no fee based on the limit and no share in the capital. From the second year you can choose the annual care plan; it is optional and does not renew automatically.",
        ...GELD_ZURUECK,
        KAPITAL_FREI,
      ],
    },
    {
      typ: "text", id: "einordnung", h2: "Business consultancy rather than formation service: where FIAON Global stands",
      absaetze: [
        "A formation service registers the company with the state and usually provides the registered agent. But that is only where the work begins: the tax numbers with the IRS, an address and phone number that read the same on every application, the operating agreement, the review of tax liability at home, the first annual filing and the applications to banks and card issuers.",
        "FIAON Global therefore sees itself as a business consultancy, not a form-filling service: we plan the whole route, not just the first step, and lead it with a dedicated contact — a US company under one roof. To be candid: the company on its own is cheaper from a formation service. Our fixed price also covers the steps that follow, from the EIN and ITIN to the first US filing.",
        `These steps are not a formality. An LLC wholly owned by a single foreign owner files Form 5472 with Form 1120 with the IRS for every year with reportable transactions between the company and its owner, even without revenue — and even the capital contribution and formation costs paid count as such transactions. For a calendar year the deadline is ${IRS_EN.frist5472}. If the filing is not made, the IRS can impose a penalty of ${IRS_EN.strafe5472}. That is why the first filing is part of every package.`,
      ],
    },
    {
      typ: "text", id: "inklusive", h2: "What every FIAON Global fixed price includes",
      absaetze: ["All four packages include these services and fees:"],
      punkte: [...GLOBAL_INKLUSIVE.en],
      nach: `Not included in the fixed price: ${GLOBAL_NICHT_INKLUSIVE.en.slice(1).map(klein).join("; ")}. Also not included are your company’s running costs from the second year — the state fee, the registered agent and the annual US filing; we tell you about them well in advance, and with the optional annual care plan we take care of them.`,
    },
    {
      typ: "etappen", id: "auftrag", h2: "How an engagement with FIAON Global works",
      lead: "From the first conversation to the first US filing — you can see at any time whose turn it is.",
      etappen: [
        { titel: "Initial call or direct engagement", text: "Thirty minutes, free of charge and without obligation: your plans, your residence, your goal — and which package fits. If you have already made up your mind, you can engage us directly on screen." },
        { titel: "Engagement on screen", text: "You can read the model contract in advance. You sign on screen; your contracting party is FIAON LTD in London." },
        { titel: "Kick-off and documents", text: "Work begins once your payment has been received. In the kick-off meeting we settle the legal form, the state and the name; you upload your documents to the document room and grant the power of attorney." },
        { titel: "Review before formation", text: "Our partner tax adviser reviews how your company will be treated in your country of residence and which notifications are due there." },
        { titel: "Formation and tax numbers", text: "Formation with the state, EIN, ITIN preparation, D-U-N-S Number, registered agent, US address and phone number; our partner lawyer drafts the operating agreement. You can follow the progress in “My order”." },
        { titel: "Account and cards", text: "You file the applications, fully prepared by us. The institution decides on every application." },
        { titel: "First US filing and year two", text: "Our US CPA prepares the first annual filing. From the second year you can add the annual care plan — or take over the ongoing duties yourself." },
      ],
    },
    {
      typ: "text", id: "pruefen", h2: "FIAON Global reviews: how to check us yourself",
      absaetze: [
        "Reviews from other clients are one point of reference. More reliable is what you can check yourself before you sign — without having to take our word for anything:",
      ],
      punkte: [
        `the contracting party in the register: ${F.name}, Companies House ${F.companyNo}, incorporated on 3 July 2026, registered office at ${F.strasse} in London — open to public inspection`,
        `the management: the director is ${F.director}, also entered in the register`,
        "the contract: you read the model contract before the engagement, in English",
        "the price: a fixed price per package, set before the engagement — no fee based on the limit",
        `the payment: only after your signature, by invoice to the business account of ${F.name} — never to a private account`,
        "the limits: this page and every engagement state openly what FIAON Global is not",
      ],
      nach: "A reputable provider passes this check before you sign. Anyone who promises limits, interest rates or “tax-free” status does not.",
    },
    {
      typ: "zitat", id: "kurzprofil",
      text: DEFINITION,
      quelle: "Short profile of FIAON Global for citation · as of October 2026",
    },
    {
      typ: "pakete", id: "pakete", h2: "The four FIAON Global packages",
      lead: "Each package is an engagement at a fixed price, including all fees and our partners’ fees for the services in the package. The capital range of each package is your goal; the institution decides on every limit.",
    },
    {
      typ: "hinweis", id: "nicht", h2: "What FIAON Global is not",
      lead: "We state these limits before the engagement, not afterwards.",
      punkte: [
        "Not a bank: FIAON does not provide accounts, does not issue cards and does not grant loans. The institution concerned alone decides on the account, the card, the limit and the loan.",
        "Not a loan intermediary: anyone in Germany who arranges loans on a commercial basis needs a licence to do so (section 34c of the German Trade Regulation Act, GewO). FIAON does not arrange loans, receives no fee based on the limit and does not commit to any limit. The capital range of a package is a goal we work towards together — not a commitment.",
        "Not a tax model: a US company that is managed from the German-speaking region remains taxable there — in Germany, for instance, under section 10 of the German Fiscal Code (AO) and section 1 of the German Corporate Income Tax Act (KStG), in Austria according to the place of management (section 27(2) of the Federal Fiscal Code, BAO; section 1 KStG 1988), in Switzerland according to the place of effective management (Art. 50 of the Federal Direct Tax Act, DBG).",
        "Not a law firm: FIAON provides no assistance in tax matters and no legal services. These are provided by partner tax advisers, US CPAs and partner lawyers under your engagement.",
        "No promise on interest: introductory periods without debit interest are offered by some issuers; each issuer sets the terms itself.",
        GLOBAL_PFLICHTHINWEIS.en[0],
        GLOBAL_PFLICHTHINWEIS.en[1],
        GLOBAL_PFLICHTHINWEIS.en[2],
      ],
    },
  ],
  fragen: [
    { f: "What is FIAON Global?", a: DEFINITION },
    { f: "Is FIAON Global a bank or a loan intermediary?", a: "No. FIAON is not a bank, does not grant loans, does not arrange loans and does not commit to any limit. The institution concerned alone decides on the account, the card, the limit and the loan. You file account, card and credit applications yourself; FIAON prepares them in full. The capital range of a package is a goal, not a commitment." },
    { f: "Who is behind FIAON Global?", a: `Your contracting party is ${F.name}, a private limited company with its registered office at ${F.strasse} in London, registered at Companies House on 3 July 2026 (company number ${F.companyNo}). The director is ${F.director}. Our team on the ground works in Miami, and Zurich is our partner location.` },
    { f: "What does FIAON Global cost?", a: "Each of the four packages has a fixed price that is set before the engagement — all fees and partner fees for the services in the package included. The prices are shown in the package overview on this page. From the second year your company incurs running costs; the optional annual care plan takes care of them." },
    { f: "Does a US company set up through FIAON Global lower my taxes?", a: `No, and we say so openly. A US company managed from Germany, Austria or Switzerland remains taxable there; its formation must be reported to the tax office, in Germany under section 138 of the German Fiscal Code (AO) with the tax return. A US company is a tool for real business in the US and for building a history with institutions, not a tax model. Before formation, our partner tax adviser reviews how your company will be treated.` },
    { f: "How does FIAON Global differ from a formation service?", a: "A formation service registers the company. As a business consultancy, FIAON Global takes over the whole route: formation, EIN, ITIN preparation, D-U-N-S Number, registered agent, US address and phone in the first year, tax adviser, lawyer and US CPA under your engagement, and prepared account and card applications — with one point of contact. Only the company on its own is cheaper from a formation service." },
    { f: "Do I have to travel to the US for FIAON Global?", a: `Usually not. Formation, tax numbers and filings are handled remotely; our acceptance agent partner in the DACH region checks your passport in person or by video, with the passport or a copy certified by the issuing authority in front of them. If an institution requires an appointment in person, our team in Miami accompanies you. If you would like to experience the kick-off in person in Miami, choose the ${VIP} package.` },
    { f: GLOBAL_KAPITAL_FREI.en.frage, a: GLOBAL_KAPITAL_FREI.en.antwort },
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
    QUELLEN.gewo34c,
  ],
};
