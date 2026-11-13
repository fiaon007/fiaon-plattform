// ═══════════════════════════════════════════════════════════════════════════
// FIAON GLOBAL — FÜR WEN, ENGLISCHE FASSUNG (24.09.2026, E-234 · neu gefasst 13.11.2026, E-510)
// Die sechs Seiten aus zielgruppen.ts in britischem Englisch: vier
// Unternehmensformen (Mittelstand, Onlinehandel, Agenturen und Software, Bau und
// Immobilien) und zwei Herkunftsländer (Deutschland, Schweiz). Gleicher Aufbau,
// gleiche Aussagen, gleiche Bedingungen, gleiche Anker (ids bleiben deutsch),
// Adressen aus shared/fiaon-global-pfade.ts.
//
// E-510 (13.11.2026): nach dem Sprachleitfaden FIAON Global neu geschrieben, nicht Wort für Wort übersetzt.
// Ein Wort je Sache: engagement · client · fee · funding target · the lender · proposal · initial call.
// Feste Sätze, die Schritte und jeder Betrag kommen aus shared/fiaon-global-saetze.ts — hier wird keiner getippt.
// „At a glance“ trägt die vier Antworten der 30-Sekunden-Probe (We handle · Fees · You · Decided by).
// Die Schweiz-Seite nennt Konto und Karte weder in Titel, Beschreibung, H1 noch im Blickfang; im Fließtext steht nur
// der eine Satz dazu (satz("S2", "en", "CH")). Keine Seite nennt einen Ort der Partnergesellschaft.
//
// Deutsche Gesetze behalten ihren Namen mit englischer Erklärung beim ersten
// Vorkommen („section 10 of the German Fiscal Code (AO)"). Wortgrenzen wie auf Deutsch: kein
// „up to", kein Bankname, kein „broker" als Leistung, kein Steuerversprechen; über jede
// Finanzierung entscheidet das Institut. Prüfstände: scripts/pruef-global-leitfaden.ts, scripts/pruef-global-en.ts.
// ═══════════════════════════════════════════════════════════════════════════
import { GLOBAL_AGENT, GLOBAL_KAPITAL_FREI, GLOBAL_PFLICHTHINWEIS } from "../../fiaon-global";
import { globalEnPfad } from "../../fiaon-global-pfade";
import {
  GELD_ZURUECK, SAETZE_BETRAEGE, SECHS_SCHRITTE, beleg, satz, vierSchritte, weitererSatz, type SatzLand,
} from "../../fiaon-global-saetze";
import { QUELLEN_RECHT_EN } from "../fakten-en";
import type { GlobalSeite } from "../typen";

// „stand“ = Tag der letzten inhaltlichen Änderung (E-510), „erschienen“ bleibt der Tag der Erstveröffentlichung.
const ERSCHIENEN = "2026-09-24";
const S = "2026-11-13";
const B = SAETZE_BETRAEGE.en;

// ── “At a glance”: the rows that read the same on several pages ───────────────────────────────────────────────────
/** Fees in three lines — always together: on engagement · on registration · from the second year (style guide 1.3, 5.6). */
const Z_HONORAR: [string, string] = ["Fees", `${B.honorarAuftrag} on engagement. On registration, the success fee set by your funding target — at least ${B.erfolgMin}. From the second year, on request, ${B.jahresbetreuung} a year.`];
const Z_UEBERNEHMEN: [string, string] = ["We handle", "Formation, documents, the EIN and ITIN applications; prepared applications for accounts, credit cards on request and financing"];
const Z_SELBST: [string, string] = ["You", "Choose the name, upload your passport, sign; submit the applications to the institutions yourself"];
const Z_ENTSCHEIDET: [string, string] = ["Decided by", "The state and the US tax authority; accounts, cards and financing by the institution concerned"];
/** What applies if the financing does not arrive — the row from the table “who does what” (style guide 2.4), directly below “Decided by”. */
const Z_AUSBLEIBT: [string, string] = [GELD_ZURUECK.en.auge, SECHS_SCHRITTE.en.find((x) => x.nr === 5)!.werMachtWas.wennEsAusbleibt];
/** Switzerland: the first view without accounts, cards or financing (style guide 1.3, version B). */
const Z_UEBERNEHMEN_CH: [string, string] = ["We handle", "Formation, documents, the EIN and ITIN applications; US deadlines and filings in the first year"];
const Z_SELBST_CH: [string, string] = ["You", "Choose the name, upload your passport, sign"];
const Z_ENTSCHEIDET_CH: [string, string] = ["Decided by", "Registration by the state; the EIN and the ITIN by the US tax authority"];

// ── The “One engagement” block — heading above the card ───────────────────────────────────────────────────────────
const KARTE_H2 = "One engagement";
const KARTE_LEAD = `One engagement, one agreement, one dedicated contact. ${beleg("honorarVorab", "en")}`;

/** The condition of step 6 in one sentence (“This requires annual administration to be in place.”) — read from the six steps, not typed. */
const JAHRESBETREUUNG_BEDINGUNG = ((b: string) => b.slice(0, b.indexOf(". ") + 1))(SECHS_SCHRITTE.en.find((x) => x.nr === 6)!.bedingung);

/**
 * The steps in brief (style guide 2.5), shortened by country (5.12): four narrow places, hence the short texts.
 * Refinancing and increase also carry their condition (2.7). Switzerland: without “Accounts — cards”. What applies if the
 * financing does not arrive stands in “At a glance” — on the Switzerland page, whose first view names no financing, as a
 * margin note directly beside the steps (S7).
 */
const kurzSchritte = (land: SatzLand): { titel: string; text: string }[] =>
  vierSchritte("en", land).schritte.map((x) => ({ titel: x.titel, text: x.nr === 4 ? `${x.text} ${JAHRESBETREUUNG_BEDINGUNG}` : x.text }));

/** Responsibility for tax questions — says who is responsible, not what a partner is currently doing (style guide 5.11). */
const STEUERFRAGEN = "Tax questions rest with partner tax advisers acting in their own professional capacity";

export const ZIELGRUPPEN_EN: GlobalSeite[] = [
  // ─────────────────────────────────────────────────────────────────────────
  {
    pfad: "/en/business/us-subsidiary",
    sprache: "en",
    schwester: "/business/tochtergesellschaft-usa",
    art: "zielgruppe",
    seo: {
      titel: "Set up a US subsidiary for SMEs — FIAON Global",
      beschreibung: "A US subsidiary for SMEs: when it is appropriate, LLC or corporation, reporting duties at home. Formation and tax numbers under one engagement.",
    },
    stand: S,
    erschienen: ERSCHIENEN,
    kennung: "FG · 11",
    auge: "Who it is for · SMEs",
    h1: "A subsidiary in the United States.",
    h1b: "For genuine US business.",
    lead: "Customers in the US, a supplier in Texas, a project in Florida: companies with genuine US business form their own company there. We form your US subsidiary, apply for its tax identification numbers and prepare your account applications; each institution decides on the account.",
    ziffern: [
      { wert: "Liability", label: "for the US business kept separate from the parent company" },
      { wert: "§ 138 AO", label: "notification of the shareholding to the tax office in Germany" },
      { wert: "Three states", label: "Delaware, Florida or Wyoming — your choice" },
    ],
    blick: [
      ["Shareholder", "Your GmbH, AG or holding company — or you personally"],
      Z_UEBERNEHMEN,
      Z_HONORAR,
      Z_SELBST,
      Z_ENTSCHEIDET,
      Z_AUSBLEIBT,
    ],
    kurz: "Your company sets up a US subsidiary when it sells, buys, signs contracts or has staff working in the US. The shareholder is usually the GmbH, AG or holding company in the home country. FIAON Global forms the company, applies for the EIN and prepares the account application. The state, the US tax authority and the institution concerned decide on registration, the tax number and the account.",
    bloecke: [
      {
        typ: "text", id: "wann", h2: "Reasons for a US subsidiary",
        absaetze: ["A company of your own in the US is worthwhile when genuine business develops there — not as a formality. Typical reasons are:"],
        punkte: [
          "US customers require a contracting party based in the US",
          "Purchasing, warehousing or manufacturing in the US",
          "Projects on site, for example in construction or plant engineering",
          "Employees or sales partners in the US",
          "Liability for the US business is to be kept separate from the parent company",
        ],
        nach: beleg("fuerWenNicht", "en"),
      },
      {
        typ: "karten", id: "form", h2: "LLC or corporation for the subsidiary", spalten: 2,
        karten: [
          { tag: "LLC", titel: "Lean and flexible", text: "An operating agreement instead of fixed corporate bodies, no minimum capital rules. This is the form your engagement provides for." },
          { tag: "Corporation", titel: "When third parties are to hold shares", text: "The usual form when US investors, joint venture partners or employees are to take a stake. Whether it is an option for your plans is something we discuss in the initial call." },
        ],
      },
      {
        typ: "etappen", id: "ablauf", h2: "The process for your US subsidiary",
        etappen: [
          { titel: "Initial call", text: "You outline your plans, group structure and timetable." },
          { titel: "Your documents", text: "Commercial register extract of the parent company, passports of the managing directors, name and business activity of the subsidiary." },
          { titel: "Formation and tax number", text: `${weitererSatz("UEBERGANG-EINREICHUNG", "en")} We prepare the operating agreement and the EIN application. The state and the US tax authority decide.` },
          { titel: "Account and obligations", text: "We prepare the account application in full. You submit it yourself. The institution decides. Your compliance calendar lists US filings and state fees." },
        ],
      },
      {
        typ: "hinweis", id: "wissen", h2: "What you need to know",
        punkte: [
          "If the US subsidiary is in fact managed from Germany, Austria or Switzerland, it may be taxable there. Clarify with your tax adviser before formation who manages the subsidiary, and from where.",
          "A shareholding in a foreign company must be reported to the tax office — in Germany under section 138 of the German Fiscal Code (AO). If a Florida LLC is owned by a GmbH or AG, that company also files its own tax return in Florida (Form F-1120).",
          "Transfer pricing between parent and subsidiary, payroll in the US and visas are not part of your engagement.",
        ],
      },
      { typ: "paket", id: "mandat", h2: KARTE_H2, lead: KARTE_LEAD, paket: "global_banking" },
    ],
    fragen: [
      { f: "Can my GmbH own a US LLC or corporation?", a: "Yes. A GmbH, AG or holding company can be the shareholder of an LLC or corporation just as a natural person can. In that case we need the commercial register extract of the parent company. If you request your proposal via the fee calculator, you personally become the shareholder; if your GmbH is to hold the shares, we agree this with you in a call." },
      { f: "Is a US subsidiary taxed in the US?", a: `That depends on the legal form, the activity and the place of management. ${STEUERFRAGEN}; your tax adviser handles the ongoing tax return.` },
      { f: "Does FIAON also handle visas for employees?", a: "No. Visas, payroll and transfer pricing are not part of your engagement." },
      { f: "How long does it take to set up a US subsidiary?", a: "That is determined by the authorities: registration is decided by the state, the EIN by the US tax authority. We therefore do not commit to a deadline." },
    ],
    paket: "global_banking",
    weiter: ["/business/wissen/tochter-oder-zweigniederlassung", "/business/wissen/markteintritt-usa", "/business/aus-deutschland", "/business/us-pflichten"].map(globalEnPfad),
  },

  // ─────────────────────────────────────────────────────────────────────────
  {
    pfad: "/en/business/e-commerce",
    sprache: "en",
    schwester: "/business/onlinehandel",
    art: "zielgruppe",
    seo: {
      titel: "US company for e-commerce sellers & brands — FIAON Global",
      beschreibung: "A US company for e-commerce sellers and brands: what the EIN and a US address are for, and what sales tax requires. Formation under one engagement.",
    },
    stand: S,
    erschienen: ERSCHIENEN,
    kennung: "FG · 12",
    auge: "Who it is for · E-commerce",
    h1: "A US company for e-commerce sellers.",
    h1b: "EIN, US address, sales tax.",
    lead: "Marketplaces, payment providers and logistics companies in the US often expect a US company with an EIN and a US address. We form your company, apply for its tax identification numbers and prepare your account applications and, on request, your card applications; each institution makes its own decision.",
    ziffern: [
      { wert: "EIN", label: "your company’s US tax number; the US tax authority decides" },
      { wert: "Sales tax", label: "levied by the states, each with its own thresholds" },
      { wert: "US address", label: "for the state filings — not a seller or warehouse address" },
    ],
    blick: [
      ["For", "Own brands, online shops, sellers on US marketplaces"],
      Z_UEBERNEHMEN,
      Z_HONORAR,
      Z_SELBST,
      Z_ENTSCHEIDET,
      Z_AUSBLEIBT,
      ["Not included", "Bookkeeping, sales tax registrations, marketplace accounts"],
    ],
    kurz: "A company of your own is not a requirement for selling to customers in the US. Many marketplaces, payment providers and logistics companies do, however, expect an EIN and a US address. FIAON Global forms the company, applies for the EIN and prepares your account applications; each institution decides on the account. Sales taxes, bookkeeping and tax liability in your country of residence are matters for your tax adviser and a US certified public accountant (CPA).",
    bloecke: [
      {
        typ: "text", id: "warum", h2: "US company for e-commerce: the reasons",
        absaetze: ["A company of your own is not a requirement for selling to US customers. In practice, these reasons speak for it:"],
        punkte: [
          "Marketplaces and payment providers in the US often ask for an EIN and a US address at registration",
          "Proceeds in US dollars are credited to a US account without currency conversion",
          "US logistics companies and warehouses often require a US contracting party",
          "Liability for the US business lies with the US company",
        ],
        nach: "You submit the application for a US account yourself; the institution concerned decides.",
      },
      {
        typ: "hinweis", id: "steuern", h2: "Obligations when selling in the US",
        punkte: [
          "Sales tax: in the US the states levy their own sales taxes with their own thresholds. Whether and where your company has to register is something you clarify with a US certified public accountant (CPA). It is not part of your engagement.",
          `${GLOBAL_AGENT.en.anschrift} Parcels cannot be accepted there.`,
          GLOBAL_PFLICHTHINWEIS.en[0],
          GLOBAL_PFLICHTHINWEIS.en[1],
        ],
      },
      {
        typ: "karten", id: "passt", h2: "Suitable — and not suitable", spalten: 2,
        karten: [
          { tag: "Good fit", titel: "Brands with genuine US business", text: "You already sell to US customers or are starting there with a warehouse, a marketplace or your own shop. You wish to handle payments in the US through a company of your own." },
          { tag: "Not a fit", titel: "Anyone forming a company purely for tax reasons", text: `If the company is managed from Germany, Austria or Switzerland, it is generally taxable there. ${satz("S10", "en")}` },
        ],
      },
      { typ: "paket", id: "mandat", h2: KARTE_H2, lead: KARTE_LEAD, paket: "global_banking" },
    ],
    fragen: [
      { f: "Do I need a US company to sell to US customers?", a: "No, not necessarily. Many marketplaces, payment providers and logistics companies do, however, expect a US company with an EIN and a US address." },
      { f: "Does my US company have to pay sales tax?", a: "That depends on the state and your sales there. The states levy their own sales taxes with their own thresholds; you clarify this with a US certified public accountant (CPA)." },
      { f: "Is bookkeeping included?", a: "No. What is included is the first annual US filing by a US certified public accountant (CPA) from our partner network, not ongoing bookkeeping." },
      { f: "Does a US LLC lower my taxes?", a: `No. ${satz("S10", "en")} If the company is managed from there, it is generally taxable there.` },
    ],
    paket: "global_banking",
    weiter: ["/business/us-geschaeftskonto", "/business/wissen/us-bankkonto-unterlagen", "/business/us-pflichten", "/business/wissen/amazon-stripe-paypal-llc"].map(globalEnPfad),
  },

  // ─────────────────────────────────────────────────────────────────────────
  {
    pfad: "/en/business/agencies-software",
    sprache: "en",
    schwester: "/business/agenturen-software",
    art: "zielgruppe",
    seo: {
      titel: "US company for agencies and software firms — FIAON Global",
      beschreibung: "A US company for agencies, software firms and service providers with US clients: tax number, tax form, legal form. Formation under one engagement.",
    },
    stand: S,
    erschienen: ERSCHIENEN,
    kennung: "FG · 13",
    auge: "Who it is for · Agencies and software",
    h1: "A US company for agencies and software.",
    h1b: "For contracts with US clients.",
    lead: "Purchasing departments in the US ask suppliers for a US tax number and a tax form. We form your US company, apply for the EIN and prepare your account application; each institution decides on the account.",
    ziffern: [
      { wert: "EIN", label: "the US tax number US clients ask for" },
      { wert: "W-9 or W-8", label: "the tax form US clients require from suppliers" },
      { wert: "LLC or corporation", label: "depending on your client and investor plans" },
    ],
    blick: [
      ["For", "Agencies, software companies, service providers and freelance professionals with US clients, founders with US investors"],
      Z_UEBERNEHMEN,
      Z_HONORAR,
      Z_SELBST,
      Z_ENTSCHEIDET,
      Z_AUSBLEIBT,
    ],
    kurz: "With a US company, service providers issue invoices to their US clients from the US and provide a US tax number when signing contracts. Anyone wishing to approach investors in the US generally forms a corporation. FIAON Global forms your company (LLC), applies for the EIN and prepares the account application; each institution decides on the account.",
    bloecke: [
      {
        typ: "text", id: "warum", h2: "US company for US clients: the reasons",
        absaetze: [
          "Purchasing departments in the US work with fixed procedures: a supplier with a US tax number, the right tax form, payment by US bank transfer. A foreign service provider often does not fit this procedure — a US company does.",
          "In addition, there is liability: contracts under US law with US clients rest with the US company, not with your company at home.",
        ],
      },
      {
        typ: "karten", id: "form", h2: "LLC or corporation", spalten: 2,
        karten: [
          { tag: "LLC", titel: "For service providers", text: "Lean, without fixed corporate bodies. Suitable when the US company handles client work and does not take on investors. This is the form your engagement provides for." },
          { tag: "Corporation", titel: "For founders with US investors", text: "Investors in the US generally expect a corporation. Whether it is an option for your plans is something we discuss in the initial call." },
        ],
      },
      {
        typ: "hinweis", id: "wissen", h2: "What you need to know",
        punkte: [
          GLOBAL_PFLICHTHINWEIS.en[0],
          "If you or your employees work in the US, visas and US employment law must be taken into account. Neither is part of your engagement.",
          "Your engagement includes your company’s operating agreement, not your client contracts. Have a US lawyer check those.",
        ],
      },
      { typ: "paket", id: "mandat", h2: KARTE_H2, lead: KARTE_LEAD, paket: "global_struktur" },
    ],
    fragen: [
      { f: "Why do US clients ask for a US tax number?", a: "US companies ask suppliers for a tax number and a tax form (W-9 or W-8) because they report payments to the tax authority. With a US company of your own and an EIN, you answer this request as a US business. Which form your company completes is something you clarify with a US certified public accountant (CPA)." },
      { f: "Do I need a corporation for US investors?", a: "Generally yes. Investors in the US usually expect a corporation. Your engagement provides for an LLC; whether a corporation is an option for your plans is something we discuss in the initial call." },
      { f: "Does FIAON review my client contracts?", a: "No. Your engagement includes the operating agreement and formation documents for your company. Have a US lawyer check your client contracts; FIAON is not a law firm." },
    ],
    paket: "global_struktur",
    weiter: ["/business/us-firmengruendung", "/business/wissen/llc-oder-corporation", "/business/delaware", "/business/wissen/llc-steuererklaerung"].map(globalEnPfad),
  },

  // ─────────────────────────────────────────────────────────────────────────
  {
    pfad: "/en/business/construction-property",
    sprache: "en",
    schwester: "/business/bau-immobilien",
    art: "zielgruppe",
    seo: {
      titel: "US company for construction and property — FIAON Global",
      beschreibung: "Projects and properties in the US through a company of your own: formation, tax numbers, prepared applications. The lender decides on any financing.",
    },
    stand: S,
    erschienen: ERSCHIENEN,
    kennung: "FG · 14",
    auge: "Who it is for · Construction and property",
    h1: "A US company for construction and property.",
    h1b: "One company per project.",
    lead: "Anyone who builds, refurbishes or holds property in the US usually places each project in a company of its own. We form it, apply for its tax identification numbers and prepare every application for accounts and financing; the institution concerned decides.",
    ziffern: [
      { wert: "Per project", label: "a company of its own, usually an LLC" },
      { wert: "Every application", label: "for the financing, fully prepared" },
      { wert: "The lender", label: "decides on any financing" },
    ],
    blick: [
      ["For", "Construction companies, project developers, property holders"],
      Z_UEBERNEHMEN,
      Z_HONORAR,
      Z_SELBST,
      Z_ENTSCHEIDET,
      ["Funding target", `${B.rahmen}. ${satz("S9", "en")} ${weitererSatz("MIAMI", "en")}`],
      Z_AUSBLEIBT,
    ],
    kurz: "For projects and properties in the US, a separate company is usually formed for each project, most often an LLC. FIAON Global forms it, applies for the EIN and prepares the applications for accounts and financing in full. All financing decisions rest with the lender; FIAON does not lend and does not broker loans.",
    bloecke: [
      {
        typ: "text", id: "warum", h2: "One company per project",
        absaetze: [
          "In the US it is customary to hold each construction project and each property in a company of its own. This separates liability and figures for each project; each property can be valued and sold on its own.",
          `${weitererSatz("UEBERGANG-EINREICHUNG", "en")} ${weitererSatz("UEBERGANG-ASSISTENZ", "en")}`,
        ],
      },
      {
        typ: "etappen", id: "ablauf", h2: "The process in brief", lead: "The same process applies to each project company.",
        etappen: kurzSchritte("DE"),
      },
      {
        typ: "hinweis", id: "wissen", h2: "What you need to know",
        punkte: [
          `FIAON does not lend and does not broker loans. ${satz("S1", "en")}`,
          satz("S11", "en"),
          "Acquiring property in the US brings its own tax and reporting obligations. You clarify these with a US certified public accountant (CPA) and your tax adviser.",
          GLOBAL_PFLICHTHINWEIS.en[0],
        ],
      },
      { typ: "paket", id: "mandat", h2: KARTE_H2, lead: KARTE_LEAD, paket: "global_kapital" },
    ],
    fragen: [
      { f: "Do I need a separate company for each project?", a: "It is not mandatory, but customary: one company per project separates liability and figures. Whether it suits your plans is something we discuss in the initial call." },
      { f: "Does FIAON finance my project?", a: `No. FIAON does not lend and does not broker loans; we prepare the applications in full and support your company through to the decision. ${satz("S1", "en")} ${satz("S5-C", "en")}` },
      { f: GLOBAL_KAPITAL_FREI.en.frage, a: GLOBAL_KAPITAL_FREI.en.antwort },
      { f: "Do I have to travel to the US for formation and applications?", a: `Not for the formation or your company’s tax identification number. Whether an institution requires you to attend in person for an account, a card or financing is for that institution to decide. ${weitererSatz("MIAMI", "en")}` },
    ],
    paket: "global_kapital",
    weiter: ["/business/firmenkarten-kapital", "/business/miami", "/business/wissen/us-immobilie-finanzieren", "/business/wissen/business-credit-usa"].map(globalEnPfad),
  },

  // ─────────────────────────────────────────────────────────────────────────
  {
    pfad: "/en/business/from-germany",
    sprache: "en",
    schwester: "/business/aus-deutschland",
    art: "land",
    seo: {
      titel: "Forming a US company from Germany — FIAON Global",
      beschreibung: "A US company from Germany, the tax rules: place of management, the section 138 AO notification, how the LLC is classified — with sources.",
    },
    stand: S,
    erschienen: ERSCHIENEN,
    kennung: "FG · 15",
    auge: "Who it is for · From Germany",
    h1: "A US company from Germany.",
    h1b: "Tax liability and notification.",
    lead: "You can form a US company from Germany without being resident in the US. At home, a company is generally taxable where it is managed, and the shareholding must be reported to the tax office.",
    ziffern: [
      { wert: "§ 138 AO", label: "notification of the foreign shareholding" },
      { wert: "§ 10 AO", label: "place of management" },
      { wert: "Typenvergleich", label: "how the tax office classifies the LLC" },
    ],
    blick: [
      ["Tax liability", "Where the company is actually managed (section 10 AO, section 1 KStG)"],
      Z_UEBERNEHMEN,
      Z_HONORAR,
      Z_SELBST,
      Z_ENTSCHEIDET,
      Z_AUSBLEIBT,
      ["Ongoing", "Tax return at home with your tax adviser"],
    ],
    kurz: "Entrepreneurs from Germany can form a US LLC or corporation without being resident in the US. If the company is managed from Germany, its place of management is in Germany (section 10 of the German Fiscal Code, AO) and it is generally taxable there. The shareholding must be reported to the tax office under section 138 AO. The tax office decides how to treat an LLC by comparing it with German legal forms (Typenvergleich).",
    bloecke: [
      {
        typ: "text", id: "geschaeftsleitung", h2: "Place of management — the decisive point",
        absaetze: [
          "Under section 10 of the German Fiscal Code (AO), the place of management is the centre of the company’s top-level management — where the important decisions are made. A corporation (Kapitalgesellschaft) whose place of management is in Germany is subject to unlimited corporate income tax liability there (section 1 of the German Corporate Income Tax Act, KStG). This applies even if its registered office is in the US.",
          "For most entrepreneurs this means: if you run your US company from your desk in Germany, it is taxed in Germany. In the US, the annual filing obligations apply in addition. That is not a drawback of the US company — it simply is not a tax scheme.",
        ],
      },
      {
        typ: "text", id: "typenvergleich", h2: "The Typenvergleich: how the LLC is classified",
        absaetze: [
          "German tax law has no category for the LLC. The tax office therefore examines whether its characteristics correspond more closely to a corporation such as the GmbH or to a partnership. This is the so-called Typenvergleich, a classification by comparison with German legal forms. The German Federal Ministry of Finance set out the criteria for the US LLC in a dedicated letter (BMF letter of 19 March 2004). The classification in the US, the so-called check-the-box election, plays no part in this.",
          `The outcome depends on the operating agreement: who decides, how profits are distributed and whether shares are transferable. The classification should therefore be clarified before the operating agreement is drafted. ${STEUERFRAGEN}.`,
        ],
      },
      {
        typ: "text", id: "meldung", h2: "The notification under section 138 AO",
        absaetze: [
          "Anyone who forms or acquires a shareholding in a company abroad must report this to the tax office. The duty applies from ten per cent, or with acquisition costs of more than €150,000. For companies in third countries such as the US, this also applies as soon as you first have a controlling influence. The notification is made electronically together with the income tax or corporate income tax return, no later than fourteen months after the end of the year. Anyone who fails to make the notification risks a fine not exceeding €25,000 (section 379 AO).",
        ],
      },
      {
        typ: "hinweis", id: "wissen", h2: "What you need to know",
        punkte: [
          satz("S10", "en"),
          `${STEUERFRAGEN}; your tax adviser handles the ongoing tax return.`,
          GLOBAL_PFLICHTHINWEIS.en[1],
        ],
      },
      { typ: "paket", id: "mandat", h2: KARTE_H2, lead: KARTE_LEAD, paket: "global_struktur" },
    ],
    fragen: [
      { f: "Can I form a US LLC as a German citizen?", a: "Yes, without residence and without citizenship in the US. You need a passport, proof of address and, if a company is to be the shareholder, its commercial register extract." },
      { f: "Do I have to pay tax on my US LLC in Germany?", a: `Generally yes, if you manage it from Germany: its place of management is then in Germany (section 10 AO). ${STEUERFRAGEN}.` },
      { f: "Do I have to report the US company to my tax office?", a: "Yes. Under section 138 AO, forming or acquiring a shareholding in a foreign company must be reported. This is done electronically with the tax return, no later than fourteen months after the end of the year. Failure to do so can be punished with a fine." },
      { f: "How does the German tax office classify an LLC?", a: "By means of a Typenvergleich: depending on the operating agreement, like a corporation or like a partnership. The classification should therefore be clarified before the operating agreement is drafted." },
    ],
    paket: "global_struktur",
    weiter: ["/business/wissen/us-llc-steuern", "/business/wissen/llc-oder-gmbh", "/business/wissen/llc-gruenden", "/business/wissen/us-llc-wohnsitz-deutschland"].map(globalEnPfad),
    quellen: [
      QUELLEN_RECHT_EN.ao10,
      QUELLEN_RECHT_EN.ao138,
      QUELLEN_RECHT_EN.kstg1,
      { titel: "Section 379 German Fiscal Code (AO) — endangering tax revenue", url: "https://www.gesetze-im-internet.de/ao_1977/__379.html" },
      QUELLEN_RECHT_EN.bmf,
    ],
  },

  // ─────────────────────────────────────────────────────────────────────────
  // SWITZERLAND (style guide 5.12, 2.8): accounts and cards never in title, description, H1 or first view; in running text
  // only the one sentence satz("S2", "en", "CH"). No place and no role of the partner company on this page.
  {
    pfad: "/en/business/from-switzerland",
    sprache: "en",
    schwester: "/business/aus-der-schweiz",
    art: "land",
    seo: {
      titel: "Forming a US company from Switzerland — FIAON Global",
      beschreibung: "A US company from Switzerland: place of effective management, tax liability and filings — formation and tax numbers under one engagement.",
    },
    stand: S,
    erschienen: ERSCHIENEN,
    kennung: "FG · 16",
    auge: "Who it is for · From Switzerland",
    h1: "A US company from Switzerland.",
    h1b: "Effective management.",
    lead: "You do not need to be resident in the US to own a US company. We form your US company, assemble every document, apply for the tax identification numbers and handle the US deadlines and filings in the first year.",
    ziffern: [
      { wert: "Art. 50 DBG", label: "tax liability where the registered office or effective management is in Switzerland" },
      { wert: "Form 5472", label: "annual US filing, even without revenue" },
      { wert: "FIAON LTD", label: "your contracting party, registered office in London" },
    ],
    blick: [
      ["Tax liability", "If the registered office or place of effective management is in Switzerland (Art. 50 DBG)"],
      Z_UEBERNEHMEN_CH,
      Z_HONORAR,
      Z_SELBST_CH,
      Z_ENTSCHEIDET_CH,
      ["Ongoing", "Tax return in Switzerland with your fiduciary (Treuhand) firm"],
    ],
    kurz: "Companies and entrepreneurs from Switzerland can form a US company without being resident in the US. If the company is in fact managed from Switzerland, it is subject to unlimited tax liability there under Art. 50 of the Swiss Federal Direct Tax Act (DBG). FIAON Global forms the company, assembles every document and applies for the tax identification numbers. Registration is decided by the state; the EIN and the ITIN by the US tax authority.",
    bloecke: [
      {
        typ: "text", id: "verwaltung", h2: "The place of effective management",
        absaetze: [
          "Swiss law links the tax liability of a legal entity to its registered office or the place of its effective management (Art. 50 DBG). If you run your US company from Switzerland, you must therefore expect it to be taxable in Switzerland.",
          `How the company is classified in Switzerland, and which obligations follow from that, should be clarified before formation. ${STEUERFRAGEN}; your fiduciary firm handles the ongoing return.`,
        ],
      },
      {
        typ: "etappen", id: "ablauf", h2: "The process in brief",
        etappen: kurzSchritte("CH"),
      },
      {
        typ: "hinweis", id: "wissen", h2: "What you need to know",
        punkte: [
          satz("S10", "en", "CH"),
          GLOBAL_PFLICHTHINWEIS.en[1],
          satz("S2", "en", "CH"),
          satz("S7", "en", "CH"),
        ],
      },
      { typ: "paket", id: "mandat", h2: KARTE_H2, lead: KARTE_LEAD, paket: "global_struktur" },
    ],
    fragen: [
      { f: "Can I form a US LLC as a Swiss entrepreneur?", a: "Yes, without residence in the US. You need a passport, proof of address and, if a company is to be the shareholder, its commercial register extract." },
      { f: "Is my US company taxable in Switzerland?", a: `Generally yes, if it is in fact managed from Switzerland (Art. 50 DBG). ${STEUERFRAGEN}; your fiduciary firm handles the ongoing return.` },
      { f: "Who is my contracting party?", a: `FIAON LTD, with its registered office in London. ${weitererSatz("ZAHLUNG", "en")}` },
    ],
    paket: "global_struktur",
    weiter: ["/business/us-pflichten", "/business/wissen/us-llc-steuern", "/business/aus-oesterreich", "/business/us-firmengruendung"].map(globalEnPfad),
    quellen: [QUELLEN_RECHT_EN.dbg50],
  },
];
