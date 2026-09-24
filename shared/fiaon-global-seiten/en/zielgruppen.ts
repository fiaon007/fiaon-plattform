// ═══════════════════════════════════════════════════════════════════════════
// FIAON GLOBAL — FÜR WEN, ENGLISCHE FASSUNG (24.09.2026, E-234)
// Die sechs Seiten aus zielgruppen.ts in britischem Englisch: vier
// Unternehmensformen (Mittelstand, Onlinehandel, Agenturen und Software, Bau und
// Immobilien) und zwei Herkunftsländer (Deutschland, Schweiz). Satz für Satz
// übersetzt, gleicher Aufbau, gleiche Anker (ids bleiben deutsch), Adressen aus
// shared/fiaon-global-pfade.ts.
//
// Deutsche Gesetze behalten ihren Namen mit englischer Erklärung beim ersten
// Vorkommen („section 10 of the German Fiscal Code (AO)"). Paketnamen, Preise,
// Kapitalrahmen, Pflichthinweise und der Satz zur Verbindung kommen aus den
// gemeinsamen Quellen — nie als Wortlaut hier. Wortgrenzen wie auf Deutsch: kein
// „up to", kein Bankname, kein „broker", kein Steuerversprechen; über jede
// Finanzierung entscheidet das Institut. Prüfstand: scripts/pruef-global-en.ts.
// ═══════════════════════════════════════════════════════════════════════════
import { GLOBAL_KAPITAL_FREI, GLOBAL_PFLICHTHINWEIS, globalPaket, globalPlanungText, globalPreisText, type GlobalSchluessel } from "../../fiaon-global";
import { GLOBAL_VERBUNDEN_EN } from "../../fiaon-global-partner";
import { globalEnPfad } from "../../fiaon-global-pfade";
import { QUELLEN_RECHT_EN } from "../fakten-en";
import type { GlobalSeite } from "../typen";

const S = "2026-09-24";

/** Der englische Paketname aus der einen Quelle. */
const name = (k: GlobalSchluessel): string => globalPaket(k)?.en.name ?? k;
/** „from €2,499" — der Einstiegspreis aus dem Katalog. */
const AB = `from ${globalPreisText("global_struktur", "en")}`;

export const ZIELGRUPPEN_EN: GlobalSeite[] = [
  // ─────────────────────────────────────────────────────────────────────────
  {
    pfad: "/en/business/us-subsidiary",
    sprache: "en",
    schwester: "/business/tochtergesellschaft-usa",
    art: "zielgruppe",
    seo: {
      titel: "Set up a US subsidiary for SMEs — FIAON Global",
      beschreibung: "US subsidiary for SMEs: formation, EIN, account, compliance calendar in one place. With a partner tax adviser, lawyer and team on the ground. Fixed price.",
    },
    stand: S,
    erschienen: S,
    kennung: "FG · 11",
    auge: "Who it is for · SMEs",
    h1: "The subsidiary in the US.",
    h1b: "For companies with real US business.",
    lead: "Customers in the US, a supplier in Texas, a project in Florida: anyone doing business there will sooner or later need a company of their own in the US. We form your US subsidiary, obtain the tax numbers, prepare the account application and keep the compliance calendar — coordinated with your tax adviser at home.",
    ziffern: [
      { wert: AB, label: "Fixed price, one-off, all fees included" },
      { wert: "LLC or corporation", label: "reviewed before formation" },
      { wert: "Miami", label: "appointments on the ground with our team" },
    ],
    blick: [
      ["Shareholder", "Your GmbH, AG or holding company — or you personally"],
      ["Legal form", "LLC or corporation, depending on the group structure and your plans"],
      ["Coordination", "With your tax adviser and our partner tax adviser"],
      ["Account", "Application for the subsidiary fully prepared"],
      ["Obligations", "US filings in the calendar, the notification at home with your tax adviser"],
      ["Contracting party", "FIAON LTD, London"],
    ],
    kurz: "Your company sets up a US subsidiary when it sells, buys, signs contracts or has staff working in the US. The shareholder is usually the GmbH, AG or holding company in the home country. FIAON Global handles the formation, EIN, registered agent, address and the preparation of the account application; our partner tax adviser reviews the tax coordination between the two countries before formation.",
    bloecke: [
      {
        typ: "text", id: "wann", h2: "When a US subsidiary makes sense",
        absaetze: ["A company of your own in the US is worthwhile when real business develops there — not as a formality. Typical reasons are:"],
        punkte: [
          "US customers require a contracting party based in the US",
          "Purchasing, warehousing or manufacturing in the US",
          "Projects on site, for example in construction or plant engineering",
          "Employees or sales partners in the US",
          "You want to keep liability for the US business separate from the parent company",
        ],
        nach: "If there is no such reason, we tell you so in the first call.",
      },
      {
        typ: "karten", id: "form", h2: "LLC or corporation for the subsidiary", spalten: 2,
        karten: [
          { tag: "LLC", titel: "Lean and flexible", text: "An operating agreement instead of fixed corporate bodies, no minimum capital rules. Often the simpler form for entering the US market." },
          { tag: "Corporation", titel: "When shares are to change hands", text: "The usual form when US investors, joint venture partners or employees are to take a stake." },
        ],
      },
      {
        typ: "etappen", id: "ablauf", h2: "How your US subsidiary is set up",
        etappen: [
          { titel: "Coordination", text: "Kick-off call with you, review by our partner tax adviser, together with your own tax adviser if you wish." },
          { titel: "Resolution and documents", text: "Commercial register extract of the parent company, passports of the managing directors, name and description of the subsidiary’s business activities." },
          { titel: "Formation and EIN", text: "Filing with the state by our team on the ground, operating agreement or bylaws by our partner lawyer, EIN from the IRS." },
          { titel: "Account and obligations", text: "Account application fully prepared, compliance calendar for US filings and state fees." },
        ],
      },
      {
        typ: "hinweis", id: "wissen", h2: "What you need to know",
        punkte: [
          "If the US subsidiary is in fact managed from Germany, Austria or Switzerland, it may be taxable there. Who manages the subsidiary, and from where, is therefore part of the review before formation.",
          "A shareholding in a foreign company must be reported to the tax office — in Germany under section 138 of the German Fiscal Code (AO). If a Florida LLC is owned by a GmbH or AG, that company also files its own tax return in Florida (Form F-1120).",
          "Transfer prices between parent and subsidiary, payroll in the US and visas are not part of the packages; we can name partners for these.",
        ],
      },
      { typ: "paket", id: "paket", h2: "The right package", lead: `For the subsidiary with an account and the card ladder: ${name("global_banking")}.`, paket: "global_banking" },
    ],
    fragen: [
      { f: "Can my GmbH own a US LLC or corporation?", a: "Yes. A GmbH, AG or holding company can be the shareholder of an LLC or corporation just as a natural person can. In that case we need the commercial register extract of the parent company." },
      { f: "Is a US subsidiary taxed in the US?", a: "That depends on the legal form, the activity and the place of management. Our partner tax adviser reviews this before formation; your tax adviser handles the ongoing tax return." },
      { f: "Does FIAON also handle visas for employees?", a: "No. Visas, payroll and transfer prices are not part of the packages. On request, we can name partners for these." },
      { f: "How long does it take to set up a US subsidiary?", a: "The company is usually in place after a few weeks, once the documents are complete. The IRS issues the EIN on its own timeline." },
    ],
    paket: "global_banking",
    weiter: ["/business/wissen/tochter-oder-zweigniederlassung", "/business/wissen/llc-oder-corporation", "/business/aus-deutschland", "/business/us-pflichten"].map(globalEnPfad),
  },

  // ─────────────────────────────────────────────────────────────────────────
  {
    pfad: "/en/business/e-commerce",
    sprache: "en",
    schwester: "/business/onlinehandel",
    art: "zielgruppe",
    seo: {
      titel: "US company for e-commerce sellers & brands — FIAON Global",
      beschreibung: "Selling online in the US with your own company: EIN, US account, address and compliance calendar from a single source — honest about taxes and sales tax.",
    },
    stand: S,
    erschienen: S,
    kennung: "FG · 12",
    auge: "Who it is for · E-commerce",
    h1: "E-commerce in the US.",
    h1b: "With a company of your own on the ground.",
    lead: "Marketplaces, payment providers and logistics companies in the US prefer to work with US companies: with an EIN, a US account and a US address. We build this structure for your brand — and tell you openly which obligations come with selling in the US.",
    ziffern: [
      { wert: AB, label: "Fixed price, one-off" },
      { wert: "EIN, account, address", label: "the basic set-up for trading in the US" },
      { wert: "Compliance calendar", label: `in ${name("global_banking")} and above` },
    ],
    blick: [
      ["For", "Own brands, online shops, sellers on US marketplaces"],
      ["What you get", "US company, EIN, US address, account and card application"],
      ["Sales tax", "In the US the states levy their own sales taxes — you check this with a US CPA"],
      ["At home", "Taxable where the company is managed"],
      ["Not included", "Bookkeeping, sales tax registrations, marketplace accounts"],
      ["Fixed price", `${AB}, all fees included`],
    ],
    kurz: "If you sell to customers in the US, you benefit from a US company of your own with an EIN, a US account and a US address — many marketplaces, payment providers and logistics companies expect exactly that. FIAON Global builds this structure. The states’ sales taxes, bookkeeping and tax liability in your home country remain matters for your tax adviser and a US CPA.",
    bloecke: [
      {
        typ: "text", id: "warum", h2: "Why a US company for e-commerce",
        absaetze: ["A company of your own is not a must for selling to US customers, but it is often the simpler route:"],
        punkte: [
          "Marketplaces and payment providers in the US usually work more smoothly with US companies that have an EIN",
          "Payouts in US dollars to a US account save currency conversion and waiting time",
          "US logistics companies and warehouses often require a US contracting party",
          "Liability for the US business lies with the US company",
        ],
      },
      {
        typ: "hinweis", id: "steuern", h2: "What selling in the US involves",
        punkte: [
          "Sales tax: in the US the states levy their own sales taxes with their own thresholds. Whether and where your company has to register is something you check with a US CPA — this is not part of the packages.",
          GLOBAL_PFLICHTHINWEIS.en[0],
          GLOBAL_PFLICHTHINWEIS.en[1],
        ],
      },
      {
        typ: "karten", id: "passt", h2: "Who it fits — and who it does not", spalten: 2,
        karten: [
          { tag: "Good fit", titel: "Brands with real US business", text: "You already sell to US customers or are starting there with a warehouse, a marketplace or your own shop — and want an account, cards and payments in the US." },
          { tag: "Not a fit", titel: "Anyone who wants to form a company purely for tax reasons", text: "A US company that is managed from Germany, Austria or Switzerland is generally taxable there. It does not work as a tax model." },
        ],
      },
      { typ: "paket", id: "paket", h2: "The right package", lead: `With an account, further card applications and a compliance calendar: ${name("global_banking")}.`, paket: "global_banking" },
    ],
    fragen: [
      { f: "Do I need a US company to sell to US customers?", a: "Not necessarily. Many marketplaces, payment providers and logistics companies do, however, work more easily with a US company that has an EIN, a US account and a US address." },
      { f: "Does my US company have to pay sales tax?", a: "That depends on the state and your sales there. The states levy their own sales taxes with their own thresholds; you check this with a US CPA." },
      { f: "Is bookkeeping included?", a: "No. The packages include the first annual US filing by our US CPA, not ongoing bookkeeping." },
      { f: "Does a US LLC lower my taxes?", a: "Generally not. If the company is managed from Germany, Austria or Switzerland, it is taxable there." },
    ],
    paket: "global_banking",
    weiter: ["/business/us-geschaeftskonto", "/business/wissen/us-bankkonto-unterlagen", "/business/us-pflichten", "/business/wyoming"].map(globalEnPfad),
  },

  // ─────────────────────────────────────────────────────────────────────────
  {
    pfad: "/en/business/agencies-software",
    sprache: "en",
    schwester: "/business/agenturen-software",
    art: "zielgruppe",
    seo: {
      titel: "US company for agencies and software firms — FIAON Global",
      beschreibung: "Agencies, software firms and service providers with US clients: US company, EIN, account, contracts with US partners — from a single source, fixed price.",
    },
    stand: S,
    erschienen: S,
    kennung: "FG · 13",
    auge: "Who it is for · Agencies and software",
    h1: "Agencies and software.",
    h1b: "Contracts with US clients on an equal footing.",
    lead: "US clients prefer to sign with a US company: US invoice, US account, US tax number. We build this structure for agencies, software companies and service providers — and, for founders who want to approach investors in the US, the appropriate corporation.",
    ziffern: [
      { wert: AB, label: "Fixed price, one-off" },
      { wert: "LLC or corporation", label: "depending on your client and investor plans" },
      { wert: "EIN", label: "US clients ask for a US tax number" },
    ],
    blick: [
      ["For", "Agencies, software companies, service providers and freelance professionals with US clients, founders with US investors"],
      ["What you get", "US company, EIN, US address and phone number, account application"],
      ["Investors", "Anyone approaching US investors usually forms a corporation"],
      ["Contracts", "US clients ask for a tax number and a tax form (W-9 or W-8)"],
      ["At home", "Taxable where the company is managed"],
      ["Fixed price", `${AB}, all fees included`],
    ],
    kurz: "With a US company, service providers with US clients issue invoices from the US, receive payments into a US account and provide a US tax number when signing contracts. If you want to approach investors in the US, you generally form a corporation. FIAON Global handles the formation, EIN, address and the preparation of the account application.",
    bloecke: [
      {
        typ: "text", id: "warum", h2: "Why US clients prefer a US company",
        absaetze: [
          "Purchasing departments in the US work with fixed procedures: a supplier with a US tax number, the right tax form, payment by US bank transfer. A foreign service provider often does not fit this pattern — a US company does.",
          "Then there is liability: contracts under US law with US clients sit with the US company, not with your company at home.",
        ],
      },
      {
        typ: "karten", id: "form", h2: "LLC or corporation", spalten: 2,
        karten: [
          { tag: "LLC", titel: "For service providers", text: "Lean, without fixed corporate bodies. Suitable when the US company handles client work and does not take on investors." },
          { tag: "Corporation", titel: "For founders with US investors", text: "Investors in the US generally expect a corporation. Before formation, we review with you which state suits this." },
        ],
      },
      {
        typ: "hinweis", id: "wissen", h2: "What you need to know",
        punkte: [
          GLOBAL_PFLICHTHINWEIS.en[0],
          "If you or your employees work in the US, visas and US employment law must be taken into account. Neither is part of the packages.",
          "Contracts with US clients are reviewed by a US lawyer; the packages include your company’s operating agreement, not your client contracts.",
        ],
      },
      { typ: "paket", id: "paket", h2: "The right package", lead: `The company, tax numbers and the first account and card application: ${name("global_struktur")}.`, paket: "global_struktur" },
    ],
    fragen: [
      { f: "Why do US clients ask for a US tax number?", a: "US companies ask suppliers for a tax number and a tax form (W-9 or W-8) because they report payments to the tax authority. With a US company of your own and an EIN, you can answer this request as a US business; our US CPA clarifies which form your company completes." },
      { f: "Do I need a corporation for US investors?", a: "Generally yes. Investors in the US usually expect a corporation. We review the right choice before formation." },
      { f: "Does FIAON review my client contracts?", a: "No. The packages include the operating agreement drafted by our partner lawyer. Client contracts are reviewed by a US lawyer under your own engagement." },
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
      beschreibung: "Projects and properties in the US through a company of your own: formation, EIN, account, key figures for financing talks — team on the ground in Miami.",
    },
    stand: S,
    erschienen: S,
    kennung: "FG · 14",
    auge: "Who it is for · Construction and property",
    h1: "Construction and property.",
    h1b: "Projects in the US, properly structured.",
    lead: "If you build, refurbish or hold properties in the US, you put each project into a company of its own. We form it, obtain the tax numbers, prepare the account application and key figures — and, with our team in Miami and Schwarzott Capital Partners AG in Zurich, support the capital stage.",
    ziffern: [
      { wert: globalPlanungText("global_kapital", "en"), label: `capital range in ${name("global_kapital")}, as a target` },
      { wert: "Miami", label: "team on the ground for appointments" },
      { wert: "Key-figures file", label: `for financing discussions, in ${name("global_kapital")} and above` },
    ],
    blick: [
      ["For", "Construction companies, project developers, property holders"],
      ["Structure", "One company per project or property — usually an LLC"],
      ["Capital", "Key figures and documents for financing discussions"],
      ["On the ground", "Appointments in Miami with Schwarzott Global LLC"],
      ["Decision", "The institution decides on any financing"],
      ["Package", `${name("global_kapital")} or ${name("global_vip")}`],
    ],
    kurz: "For projects and properties in the US, a separate company is usually formed for each project, most often an LLC. FIAON Global forms it, applies for the EIN and prepares the account application and a key-figures file for financing discussions. The institution concerned decides on any financing; FIAON neither grants nor arranges loans.",
    bloecke: [
      {
        typ: "text", id: "warum", h2: "One company per project",
        absaetze: [
          "In the US it is customary to hold each construction project and each property in a company of its own. This separates liability, makes financing and sales simpler and keeps the figures for each project clean.",
          "For companies from Germany, Austria or Switzerland there is a further point: a team on the ground that attends appointments and files documents saves travel — and Schwarzott Capital Partners AG in Zurich, whose business includes property investments abroad, supports the capital stage.",
        ],
      },
      {
        typ: "etappen", id: "ablauf", h2: "From project to financing",
        etappen: [
          { titel: "Project company", text: "Formation, EIN, registered agent, operating agreement — a separate company for each project." },
          { titel: "Account and cards", text: "An account for the project company, a card ladder for running expenses." },
          { titel: "Key-figures file", text: "Project figures, costs, timetable and documents, prepared for financing discussions." },
          { titel: "Financing discussion", text: "You submit the application to the institution; the institution makes the decision according to its own rules." },
        ],
      },
      {
        typ: "hinweis", id: "wissen", h2: "What you need to know",
        punkte: [
          "FIAON is not a bank, does not grant loans and does not arrange them. The institution concerned decides on any financing.",
          "Acquiring property in the US brings its own tax and reporting obligations. You check these with a US CPA and your tax adviser.",
          GLOBAL_PFLICHTHINWEIS.en[0],
        ],
      },
      { typ: "paket", id: "paket", h2: "The right package", lead: `${name("global_kapital")} supports you through to the key-figures file for a bank loan — with priority for appointments on the ground.`, paket: "global_kapital" },
      { typ: "standorte", id: "standorte", h2: "Miami and Zurich", lead: "Appointments on the ground with Schwarzott Global LLC, the capital stage with Schwarzott Capital Partners AG." },
    ],
    fragen: [
      { f: "Do I need a separate company for each project?", a: "It is customary: one company per project separates liability and figures and makes financing and selling easier. Whether it suits your case is something we clarify in the kick-off call." },
      { f: "Does FIAON finance my project?", a: "No. FIAON does not grant loans and does not arrange them. We prepare key figures and documents for financing discussions; the decision lies with the institution." },
      { f: GLOBAL_KAPITAL_FREI.en.frage, a: GLOBAL_KAPITAL_FREI.en.antwort },
      { f: "Can your team attend appointments in the US for me?", a: `Yes. Our team in Miami attends appointments with authorities and institutions. In the ${name("global_vip")} package you can travel there yourself for the kick-off if you wish.` },
    ],
    paket: "global_kapital",
    weiter: ["/business/firmenkarten-kapital", "/business/miami", "/business/florida", "/business/wissen/business-credit-usa"].map(globalEnPfad),
  },

  // ─────────────────────────────────────────────────────────────────────────
  {
    pfad: "/en/business/from-germany",
    sprache: "en",
    schwester: "/business/aus-deutschland",
    art: "land",
    seo: {
      titel: "Set up a US company from Germany: tax rules — FIAON Global",
      beschreibung: "A US LLC or corporation from Germany: tax at the place of management, the section 138 AO notification, how the LLC is classified — explained honestly.",
    },
    stand: S,
    erschienen: S,
    kennung: "FG · 15",
    auge: "Who it is for · From Germany",
    h1: "From Germany to the US.",
    h1b: "With everything the tax office needs to know.",
    lead: "Forming a US company from Germany is straightforward. What matters is what applies at home afterwards: a company is generally taxable where it is managed, and the shareholding must be reported to the tax office. Our partner tax adviser reviews this before formation.",
    ziffern: [
      { wert: "§ 138 AO", label: "notification of the foreign shareholding" },
      { wert: "§ 10 AO", label: "place of management" },
      { wert: "Typenvergleich", label: "how the tax office classifies the LLC" },
    ],
    blick: [
      ["Tax liability", "Where the company is actually managed (section 10 AO, section 1 KStG)"],
      ["Classification", "Typenvergleich: like a GmbH or like a partnership?"],
      ["Notification", "Shareholding in a foreign company under section 138 AO"],
      ["Before formation", "Review by our partner tax adviser — included in the fixed price"],
      ["Ongoing", "Tax return at home with your tax adviser"],
      ["Fixed price", `${AB}, all fees included`],
    ],
    kurz: "Entrepreneurs from Germany can form a US LLC or corporation without being resident in the US. If the company is managed from Germany, its place of management is in Germany (section 10 of the German Fiscal Code, AO) and it is generally taxable there. The shareholding must be reported to the tax office under section 138 AO. The tax office decides how to treat an LLC by comparing it with German legal forms (Typenvergleich).",
    bloecke: [
      {
        typ: "text", id: "geschaeftsleitung", h2: "Place of management — the decisive point",
        absaetze: [
          "Under section 10 of the German Fiscal Code (AO), the place of management is the centre of the company’s top-level management — where the important decisions are made. A corporation (Kapitalgesellschaft) whose place of management is in Germany is subject to unlimited corporate income tax liability in Germany (section 1 of the German Corporate Income Tax Act, KStG), even if its registered office is in the US.",
          "For most entrepreneurs this means: if you run your US company from your desk in Germany, it is taxed in Germany. In the US, the annual filing obligations come on top. That is not a drawback of the US company — it simply is not a tax model.",
        ],
      },
      {
        typ: "text", id: "typenvergleich", h2: "The Typenvergleich: how the LLC is classified",
        absaetze: [
          "German tax law has no category for the LLC. The tax office therefore examines its characteristics to determine whether it corresponds more closely to a corporation such as the GmbH or to a partnership — the so-called Typenvergleich, a classification by comparison with German legal forms. The German Federal Ministry of Finance set out the criteria for the US LLC in a dedicated letter (BMF letter of 19 March 2004); the classification in the US, the so-called check-the-box election, plays no part in this.",
          "The outcome depends on the operating agreement: who decides, how profits are distributed, whether shares are transferable. That is why our partner tax adviser reviews the classification before the operating agreement is drafted.",
        ],
      },
      {
        typ: "text", id: "meldung", h2: "The notification under section 138 AO",
        absaetze: [
          "Anyone who forms or acquires a shareholding in a company abroad — of ten per cent or more, or with acquisition costs of more than €150,000 — must report this to the tax office. For companies in third countries such as the US, this also applies as soon as you first have a controlling influence. The notification is made electronically together with the income tax or corporate income tax return, no later than fourteen months after the end of the year. Anyone who fails to make the notification risks a fine not exceeding €25,000 (section 379 AO).",
        ],
      },
      {
        typ: "hinweis", id: "wissen", h2: "What you need to know",
        punkte: [
          "A US company is not a way to avoid taxes in Germany. Anyone who promises that is keeping quiet about the place of management.",
          "The review before formation by our partner tax adviser is included in the fixed price; your tax adviser handles the ongoing tax return.",
          GLOBAL_PFLICHTHINWEIS.en[1],
        ],
      },
      { typ: "paket", id: "paket", h2: "The right package", lead: `Formation, tax numbers and the review before formation: ${name("global_struktur")}.`, paket: "global_struktur" },
    ],
    fragen: [
      { f: "Can I form a US LLC as a German citizen?", a: "Yes, without residence and without citizenship in the US. You need a passport, proof of address and, if a company is to be the shareholder, its commercial register extract." },
      { f: "Do I have to pay tax on my US LLC in Germany?", a: "Generally yes, if you manage it from Germany: its place of management is then in Germany (section 10 AO). Our partner tax adviser reviews your case before formation." },
      { f: "Do I have to report the US company to my tax office?", a: "Yes. Under section 138 AO, forming or acquiring a shareholding in a foreign company must be reported — electronically with the tax return, no later than fourteen months after the end of the year. Failure to do so can be punished with a fine." },
      { f: "How does the German tax office classify an LLC?", a: "By means of a Typenvergleich: depending on the operating agreement, like a corporation or like a partnership. That is why the classification is reviewed before the operating agreement is drafted." },
    ],
    paket: "global_struktur",
    weiter: ["/business/wissen/us-llc-steuern", "/business/wissen/llc-oder-gmbh", "/business/wissen/llc-gruenden", "/business/privatpersonen"].map(globalEnPfad),
    quellen: [
      QUELLEN_RECHT_EN.ao10,
      QUELLEN_RECHT_EN.ao138,
      QUELLEN_RECHT_EN.kstg1,
      { titel: "Section 379 German Fiscal Code (AO) — endangering tax revenue", url: "https://www.gesetze-im-internet.de/ao_1977/__379.html" },
      QUELLEN_RECHT_EN.bmf,
    ],
  },

  // ─────────────────────────────────────────────────────────────────────────
  {
    pfad: "/en/business/from-switzerland",
    sprache: "en",
    schwester: "/business/aus-der-schweiz",
    art: "land",
    seo: {
      titel: "Set up a US company from Switzerland — FIAON Global",
      beschreibung: "A US company from Switzerland: place of effective management, tax liability, a partner in Zurich — formation, EIN and account in one place, fixed price.",
    },
    stand: S,
    erschienen: S,
    kennung: "FG · 16",
    auge: "Who it is for · From Switzerland",
    h1: "From Switzerland to the US.",
    h1b: "With a partner in Zurich.",
    lead: "For companies from Switzerland, the route to the US is short: we form your US company, obtain the tax numbers and prepare the account application — with Schwarzott Capital Partners AG in Zurich as our local partner and our team in Miami.",
    ziffern: [
      { wert: "Zurich", label: "Local partner: Schwarzott Capital Partners AG" },
      { wert: "Art. 50 DBG", label: "tax liability at the place of effective management" },
      { wert: AB, label: "Fixed price, one-off" },
    ],
    blick: [
      ["Tax liability", "If the registered office or place of effective management is in Switzerland (Art. 50 DBG)"],
      ["Partner", "Schwarzott Capital Partners AG, Schifflände 26, Zurich"],
      ["On the ground in the US", "Schwarzott Global LLC, Miami"],
      ["Before formation", "Review by our partner tax adviser — included in the fixed price"],
      ["Ongoing", "Tax return in Switzerland with your fiduciary (Treuhand) firm"],
      ["Contracting party", "FIAON LTD, London"],
    ],
    kurz: "Companies and entrepreneurs from Switzerland can form a US company without being resident in the US. If the company is in fact managed from Switzerland, it is subject to unlimited tax liability in Switzerland under Art. 50 of the Swiss Federal Direct Tax Act (DBG). FIAON Global handles the formation, EIN, registered agent and the preparation of the account application — with a partner in Zurich and a team in Miami.",
    bloecke: [
      {
        typ: "text", id: "verwaltung", h2: "The place of effective management",
        absaetze: [
          "Swiss law links the tax liability of a legal entity to its registered office or the place of its effective management (Art. 50 DBG). If you run your US company from Switzerland, you must therefore expect it to be taxable in Switzerland.",
          "How the company is classified in Switzerland and which obligations follow from that is reviewed by our partner tax adviser before formation; your fiduciary firm handles the ongoing return.",
        ],
      },
      {
        typ: "text", id: "zuerich", h2: "A partner in Zurich",
        absaetze: [
          "Schwarzott Capital Partners AG, based at Schifflände in Zurich, supports the capital stage for FIAON Global and is the contact for companies from Switzerland. It is a holding and investment company — not a bank, and it does not grant loans.",
        ],
      },
      {
        typ: "hinweis", id: "wissen", h2: "What you need to know",
        punkte: [
          "A US company is not a way to avoid taxes in Switzerland if it is managed from Switzerland.",
          GLOBAL_PFLICHTHINWEIS.en[1],
          GLOBAL_PFLICHTHINWEIS.en[2],
          GLOBAL_VERBUNDEN_EN,
        ],
      },
      { typ: "paket", id: "paket", h2: "The right package", lead: `Formation, tax numbers and the review before formation: ${name("global_struktur")}.`, paket: "global_struktur" },
      { typ: "standorte", id: "standorte", h2: "Zurich, Miami, London", lead: "Partner in Zurich, team in Miami, contracting party in London." },
    ],
    fragen: [
      { f: "Can I form a US LLC as a Swiss entrepreneur?", a: "Yes, without residence in the US. You need a passport, proof of address and, if a company is to be the shareholder, its commercial register extract." },
      { f: "Is my US company taxable in Switzerland?", a: "Generally yes, if it is in fact managed from Switzerland (Art. 50 DBG). Our partner tax adviser reviews your case before formation." },
      { f: "Who is my contracting party?", a: "FIAON LTD in London. Schwarzott Capital Partners AG in Zurich and Schwarzott Global LLC in Miami are partners of FIAON Global." },
    ],
    paket: "global_struktur",
    weiter: ["/business/partner", "/business/wissen/us-llc-steuern", "/business/aus-deutschland", "/business/us-firmengruendung"].map(globalEnPfad),
    quellen: [QUELLEN_RECHT_EN.dbg50],
  },
];
