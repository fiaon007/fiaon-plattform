// ═══════════════════════════════════════════════════════════════════════════
// FIAON GLOBAL — DIE LEISTUNGEN AUF ENGLISCH (24.09.2026, E-234)
// Die sechs Leistungsseiten aus ../leistungen.ts in britischem Englisch:
// US company formation, EIN and ITIN, US business bank account, business
// credit cards and capital, US compliance, Global VIP Miami. Gleicher Aufbau,
// gleiche Anker (ids bleiben deutsch), gleiche Quellen — scripts/pruef-global-en.ts
// hält beide Fassungen deckungsgleich.
// Preise, Kapitalrahmen, Dauer und Paketnamen kommen aus shared/fiaon-global.ts
// (Feld en) — nie als zweite Zahl hier. Die Sätze zum Kapital (GLOBAL_KAPITAL_FREI)
// stehen immer mit dem Satz zum Partner-Steuerberater, Geld zurück immer mit
// seinen Bedingungen. Kein „up to" außer der VIP-Zahl, kein Bankname, keine
// Frist mit Ziffer, keine Zusage zu Konto, Karte oder Rahmen.
// ═══════════════════════════════════════════════════════════════════════════
import {
  GLOBAL_PFLICHTHINWEIS, GLOBAL_ROLLEN, GLOBAL_INKLUSIVE, GLOBAL_LAUFEND, GLOBAL_VIP_REISE, GLOBAL_GELD_ZURUECK, GLOBAL_KAPITAL_FREI,
  globalPaket, globalPreisText, globalPlanungText, globalKapitalSpanne, globalJahresbetreuungPreisText,
  type GlobalSchluessel,
} from "../../fiaon-global";
import { GLOBAL_UNTERLAGEN_EN } from "../../fiaon-global-bereich";
import { IRS_EN, QUELLEN_RECHT_EN } from "../fakten-en";
import type { GlobalSeite } from "../typen";

const S = "2026-09-24";
const name = (k: GlobalSchluessel) => globalPaket(k)!.en.name;
const dauer = (k: GlobalSchluessel) => globalPaket(k)?.en.dauer ?? "";
const dauerKurz = (k: GlobalSchluessel) => globalPaket(k)?.en.dauerKurz ?? "";
const gross = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
const klein = (s: string) => s.charAt(0).toLowerCase() + s.slice(1);

const STRUKTUR = name("global_struktur");
const BANKING = name("global_banking");
const KAPITAL = name("global_kapital");
const VIP = name("global_vip");
const VIP_RAHMEN = globalPlanungText("global_vip", "en");
const JAHRESBETREUUNG = globalJahresbetreuungPreisText("en");
const KAPITAL_FREI = `${GLOBAL_KAPITAL_FREI.en.satz} ${GLOBAL_KAPITAL_FREI.en.steuer}`;
// Die fünf Unterlagen mitten im Satz: klein beginnend, mit Semikolon getrennt (die Zeilen enthalten selbst Kommas).
const UNTERLAGEN_IM_SATZ = GLOBAL_UNTERLAGEN_EN.map(klein).join("; ");

export const LEISTUNGEN_EN: GlobalSeite[] = [
  // ─────────────────────────────────────────────────────────────────────────
  {
    pfad: "/en/business/us-company-formation",
    sprache: "en",
    schwester: "/business/us-firmengruendung",
    art: "leistung",
    seo: {
      titel: "US company formation for non-residents — FIAON Global",
      beschreibung: "Your US company from Germany or Switzerland: LLC or corporation, EIN, ITIN, registered agent and address. Fixed price, all fees included.",
    },
    stand: S,
    erschienen: S,
    kennung: "FG · 01",
    auge: "Service · US company formation",
    h1: "US company formation.",
    h1b: "With a team on the ground, at a fixed price.",
    lead: "We form your LLC or corporation in the US, apply for the EIN and ITIN and provide the registered agent, US business address and phone number — from Germany, Austria or Switzerland, without you having to travel. One contact, one contract, one fixed price.",
    ziffern: [
      { wert: `from ${globalPreisText("global_struktur", "en")}`, label: "Fixed price, one-off — all fees included" },
      { wert: "around eight weeks", label: `Support with ${STRUKTUR}, in our experience` },
      { wert: "3 locations", label: "London · Zurich · Miami" },
    ],
    blick: [
      ["Legal form", "LLC or corporation — decided before formation, reviewed by our partner tax adviser"],
      ["State", "Chosen according to your plans, your customers and your partners in the US"],
      ["You need", "Passport, proof of address, preferred name, description of the business activity — for companies, the commercial register extract as well"],
      ["Support", `${dauer("global_struktur")} (${STRUKTUR})`],
      ["Fixed price", `from ${globalPreisText("global_struktur", "en")}, one-off — state fees and partner fees included`],
      ["Contracting party", "FIAON LTD, London · on the ground: Schwarzott Global LLC, Miami"],
    ],
    kurz: "A US company can be formed entirely from abroad — without living in the US, without travelling and without minimum capital. FIAON handles the formation, tax numbers, registered agent, address and phone number, as well as coordination with the lawyer, tax adviser and US CPA — at a fixed price. As a rule, the company remains taxable where it is actually managed.",
    bloecke: [
      {
        typ: "text", id: "was-es-ist", h2: "What a US company is — and what it is not",
        absaetze: [
          "The limited liability company (LLC) comes closest to the German GmbH: the company is liable for its debts with its own assets; you as a shareholder (member) are generally not personally liable. Unlike a GmbH, it needs no minimum capital and no appointment with a notary; its articles are called the operating agreement and set out who decides and who is entitled to the profit.",
          "The corporation is closer to a German Aktiengesellschaft (stock corporation). It suits businesses that want to bring in investors or give shares to employees, or where a US bank or business partner expressly expects a corporation.",
          "A US company is not a tax scheme. If it is managed from Germany, Austria or Switzerland, it generally remains taxable there. It makes sense for businesses that want to sell, buy or conclude contracts in the US, or build their own banking and card history there for their capital needs.",
          KAPITAL_FREI,
        ],
      },
      {
        typ: "tabelle", id: "llc-corporation", h2: "LLC or corporation — the differences",
        lead: "Our partner tax adviser reviews which form suits your plans before formation. The essentials:",
        kopf: ["", "LLC", "Corporation"],
        zeilen: [
          ["Liability", "limited to the company’s assets", "limited to the company’s assets"],
          ["Taxation in the US", "An LLC with one foreign shareholder (member) is generally not treated there as a separate taxable entity", "The company pays federal corporate income tax and, depending on the state, a state tax of its own"],
          ["Internal organisation", "operating agreement, freely structured", "bylaws, board of directors, shares under fixed rules"],
          ["Investors and employee shares", "possible, but less common", "the usual route"],
          ["Suitable for", "trading, services, holding companies, building your own card history", "growth with investors, employee participation"],
        ],
        fuss: ["The tax office in your home country classifies the company under its own rules — in Germany, by comparison with German legal forms (Typenvergleich). The partner tax adviser clarifies this in advance as well."],
      },
      {
        typ: "etappen", id: "ablauf", h2: "How the formation works",
        lead: "Five steps, one sequence. Durations are based on our experience — authorities set their own pace.",
        etappen: [
          { titel: "Kick-off call and review", dauer: "in the first week", text: "Your contact clarifies your plans, the legal form and the state. Before formation, our partner tax adviser reviews how the company will be treated in your home country and which filings are required there." },
          { titel: "Documents and name", dauer: "as soon as everything is in", text: `You upload five documents to your document room: ${UNTERLAGEN_IM_SATZ}. The state registers each name only once — hence three variants.` },
          { titel: "Formation and operating agreement", dauer: "typically a few weeks", text: "Our team on the ground files the formation with the state and provides the registered agent, US business address and phone number. Our partner lawyer drafts the operating agreement." },
          { titel: "EIN and ITIN", dauer: "depending on the IRS", text: "We prepare the applications and file them. The EIN is issued to your company, the ITIN to you personally — both are issued by the US tax authority, the IRS, on its own timeline." },
          { titel: "Account, card and compliance calendar", dauer: "once documents are complete", text: "We prepare the first account and card application in full and enter every deadline of your company in the compliance calendar. Our US CPA prepares the first annual US filing." },
        ],
      },
      {
        typ: "rollen", id: "wer-was-tut", h2: "Who does what",
        lead: GLOBAL_ROLLEN.en.fiaon,
        fiaon: ["Coordination of everyone involved, one contact", "Formation, registered agent, address and phone", "EIN and ITIN applications", "Account and card application prepared", "Compliance calendar and document room"],
        partner: ["Partner tax adviser: review before formation", "Partner lawyer: operating agreement", "US CPA: first annual US filing", "Schwarzott Global LLC, Miami: appointments and filings on the ground"],
        sie: ["Upload five documents", "Decide on the legal form and name", "Sign the applications", "Report your company in your home country — with your tax adviser"],
      },
      {
        typ: "text", id: "inklusive", h2: "What the fixed price includes",
        absaetze: ["You pay one price. We pay everyone who works on your company:"],
        punkte: [...GLOBAL_INKLUSIVE.en],
        nach: GLOBAL_LAUFEND.en,
      },
      {
        typ: "hinweis", id: "wissen", h2: "What you need to know before formation",
        punkte: [...GLOBAL_PFLICHTHINWEIS.en, `${GLOBAL_GELD_ZURUECK.en.titel}: ${GLOBAL_GELD_ZURUECK.en.text} ${GLOBAL_GELD_ZURUECK.en.bedingungen}`],
      },
      { typ: "paket", id: "paket", h2: "The right package", lead: "Formation, tax numbers and the first account and card application — everything a US company needs to get started.", paket: "global_struktur" },
      { typ: "standorte", id: "standorte", h2: "Three locations, one contract", lead: "Your contracting party is based in London, the partners in Zurich and Miami." },
    ],
    fragen: [
      { f: "Can I form a US company without living in the US?", a: "Yes. To form an LLC or corporation you need neither residence nor citizenship in the US. The address required by law in the state is provided by the registered agent; we provide the business address and phone number." },
      { f: "Do I have to travel to the US to form the company?", a: `No. Our team on the ground files and attends appointments; you sign digitally. Those who would like to experience the kick-off in person choose the ${VIP} package — flights and hotel for the kick-off in Miami are included in its fixed price.` },
      { f: "LLC or corporation — which one suits me?", a: "For trading, services and building your own card history, the LLC is usually the simpler form. A corporation suits businesses that want to bring in investors or give shares to employees. Our partner tax adviser reviews this for your case before formation." },
      { f: "How long does it take to form a US company?", a: `The company itself is usually in place after a few weeks. In our experience, support in the ${STRUKTUR} package takes around eight weeks, because the EIN and ITIN depend on the US tax authority, which sets its own timelines.` },
      { f: "How much does it cost to form a US company with FIAON?", a: `The ${STRUKTUR} package costs ${globalPreisText("global_struktur", "en")} one-off, including state fees, the registered agent, address and phone for the first year, and the fees of our partner lawyer, partner tax adviser and US CPA. From the second year, your company’s running costs apply; the breakdown is on the “Costs” page.` },
      { f: "Can a US company reduce my tax bill?", a: `No. If the company is managed from Germany, Austria or Switzerland, it is generally taxable there, and annual filing duties apply in the US on top. A US company is worthwhile for real business in the US and for building capital — not as a tax scheme. ${KAPITAL_FREI}` },
    ],
    paket: "global_struktur",
    weiter: ["/en/business/knowledge/form-a-us-llc", "/en/business/ein-itin", "/en/business/costs", "/en/business/private-individuals"],
    quellen: [
      { titel: "IRS — Limited Liability Company (LLC)", url: "https://www.irs.gov/businesses/small-businesses-self-employed/limited-liability-company-llc" },
      { titel: "IRS — Single Member Limited Liability Companies", url: "https://www.irs.gov/businesses/small-businesses-self-employed/single-member-limited-liability-companies" },
    ],
  },

  // ─────────────────────────────────────────────────────────────────────────
  {
    pfad: "/en/business/ein-itin",
    sprache: "en",
    schwester: "/business/ein-itin",
    art: "leistung",
    seo: {
      titel: "Apply for an EIN and ITIN as a non-resident — FIAON Global",
      beschreibung: "EIN for your US company, ITIN for you personally: we clarify the tax reason, prepare both applications and file them with the IRS.",
    },
    stand: S,
    erschienen: S,
    kennung: "FG · 02",
    auge: "Service · US tax numbers",
    h1: "EIN and ITIN.",
    h1b: "The two numbers you cannot do without.",
    lead: "The EIN is the tax number of your US company, the ITIN your personal US tax number. Without an EIN there is no business account and no US filing; without an ITIN, generally no personal credit history in the US. We prepare both applications and file them.",
    ziffern: [
      { wert: "in every package", label: "EIN and ITIN: applications prepared and filed" },
      { wert: "without an SSN", label: "The EIN does not require a US Social Security number" },
      { wert: "IRS", label: "Both numbers are issued by the US tax authority" },
    ],
    blick: [
      ["EIN", "Tax number of the company — Form SS-4, free of charge at the IRS"],
      ["ITIN", "Personal tax number — Form W-7 with a verified passport"],
      ["ITIN requirement", "A tax reason that the IRS recognises — we check it before applying"],
      ["Your passport", "Verified at an appointment with a Certifying Acceptance Agent — the original stays with you"],
      ["IRS processing time", "EIN by fax about four working days · ITIN seven weeks, from abroad nine to eleven weeks"],
      ["In the package", `From ${STRUKTUR}, at no extra charge`],
    ],
    kurz: "Your company receives the EIN (Employer Identification Number) from the US tax authority, the IRS — free of charge and without a US Social Security number. You personally receive the ITIN (Individual Taxpayer Identification Number) if there is a tax reason; it is applied for with Form W-7 and a verified passport. FIAON prepares both applications and files them; the IRS makes the decision.",
    bloecke: [
      {
        typ: "tabelle", id: "vergleich", h2: "EIN and ITIN compared",
        kopf: ["", "EIN", "ITIN"],
        zeilen: [
          ["For whom", "your US company", "you as an individual"],
          ["Purpose", "account, filings, invoices, contracts", "personal tax obligations and credit history in the US"],
          ["Form", "SS-4", "W-7"],
          ["Requirement", "a company that has been formed", "a tax reason that the IRS recognises"],
          ["IRS fee", "none", "none"],
          ["IRS processing time", "fax about four working days, post about four weeks", "about seven weeks, from abroad nine to eleven"],
        ],
        fuss: ["Processing times according to the IRS (as of 2026): EIN by fax about four working days, by post about four weeks; ITIN about seven weeks, and between mid-January and the end of April as well as for applications from abroad nine to eleven weeks."],
      },
      {
        typ: "text", id: "ein", h2: "The EIN — the number of your company",
        absaetze: [
          "Every US company needs an EIN: for the business account, for invoices to US customers, for the annual filing with the IRS and for every contract in which a US partner asks for a tax number.",
          "The IRS online procedure requires a US tax number for the responsible party. Shareholders without such a number apply for the EIN in writing with Form SS-4 — we take care of that: we complete the form, have you sign it, file it and place the IRS confirmation in your document room.",
        ],
      },
      {
        typ: "text", id: "itin", h2: "The ITIN — your personal US tax number",
        absaetze: [
          "The ITIN is intended for people who have to be registered for tax in the US but cannot obtain a Social Security number. It is not a work permit and not a residence permit, but solely a tax number.",
          "It matters for US business credit cards because, where the owner gives a personal guarantee, an issuer assesses the person — and needs a US tax number to do so. The IRS, however, only issues the ITIN where there is a tax reason: as a rule it is applied for together with a US tax return, or under one of the exceptions the IRS allows. Before applying, we clarify with our US CPA whether a reason applies in your case, and which one; we do not file an application without a sound reason.",
          "You do not have to send your passport to the US: a Certifying Acceptance Agent verifies it at an appointment and files the application — the original stays with you.",
        ],
      },
      {
        typ: "etappen", id: "ablauf", h2: "How the applications work",
        etappen: [
          { titel: "Company formed", text: "The EIN can only be applied for once the company is registered with the state." },
          { titel: "SS-4 prepared and filed", text: "We complete the form, you sign, we file. The IRS confirmation is then placed in your document room." },
          { titel: "Reason for the ITIN checked", text: "Our US CPA checks which tax reason applies. Without a sound reason we do not file an application at all, rather than let it fail." },
          { titel: "W-7 with a verified passport", text: "The Certifying Acceptance Agent verifies your passport at the appointment; the application goes to the IRS with the required attachments, and we follow it through to the decision." },
        ],
      },
      {
        typ: "hinweis", id: "wissen", h2: "What you need to know",
        punkte: [
          "Both numbers are issued by the IRS alone, on its own timeline. FIAON prepares and files — the decision is not FIAON’s to make.",
          "The ITIN requires a tax reason. Wanting an account or a card is not in itself a reason that the IRS recognises.",
          "An ITIN is neither a credit card nor a credit limit. It is a prerequisite for an issuer to be able to assess you at all.",
        ],
      },
      { typ: "paket", id: "paket", h2: "The right package", lead: `EIN and ITIN are included in every package — from ${STRUKTUR}.`, paket: "global_struktur" },
    ],
    fragen: [
      { f: "Do I need a US Social Security number to get an EIN?", a: "No. Shareholders without a US tax number apply for the EIN in writing with Form SS-4. The IRS online procedure is only open to applicants with a US tax number." },
      { f: "How much does the IRS charge for an EIN?", a: "Nothing. The IRS charges no fee for the EIN. At FIAON Global, preparation and filing are included in the fixed price of every package." },
      { f: "What do I need an ITIN for?", a: "For personal tax obligations in the US — and so that a US issuer can assess you as a person if you give a personal guarantee for a business credit card. The IRS only issues the ITIN where there is a tax reason." },
      { f: "Will I automatically get a credit card with an ITIN?", a: "No. The ITIN is a tax number. Whether an issuer issues a card, and with what limit, is decided by the issuer itself under its own rules." },
      { f: "Do I have to send my passport to the US?", a: "No. A Certifying Acceptance Agent verifies your passport at an appointment and files the application. The original stays with you." },
      { f: "How long does it take to get an ITIN?", a: "According to the IRS, about seven weeks; between mid-January and the end of April and for applications from abroad, nine to eleven weeks. FIAON cannot speed this up — we make sure the application is complete, because incomplete applications are the most common reason for delays." },
    ],
    paket: "global_struktur",
    weiter: ["/en/business/knowledge/applying-for-an-ein", "/en/business/knowledge/applying-for-an-itin", "/en/business/us-company-formation", "/en/business/us-compliance"],
    quellen: [
      { titel: "IRS — Employer Identification Number", url: "https://www.irs.gov/businesses/small-businesses-self-employed/employer-identification-number" },
      { titel: "IRS — Form SS-4", url: "https://www.irs.gov/forms-pubs/about-form-ss-4" },
      { titel: "IRS — Individual Taxpayer Identification Number (ITIN)", url: "https://www.irs.gov/tin/itin/individual-taxpayer-identification-number-itin" },
      { titel: "IRS — Form W-7", url: "https://www.irs.gov/forms-pubs/about-form-w-7" },
    ],
  },

  // ─────────────────────────────────────────────────────────────────────────
  {
    pfad: "/en/business/us-business-bank-account",
    sprache: "en",
    schwester: "/business/us-geschaeftskonto",
    art: "leistung",
    seo: {
      titel: "US business bank account from Germany — FIAON Global",
      beschreibung: "A US business bank account for your LLC or corporation: documents compiled, application fully prepared, support with every query. The institution decides.",
    },
    stand: S,
    erschienen: S,
    kennung: "FG · 03",
    auge: "Service · US business bank account",
    h1: "The US business bank account.",
    h1b: "Prepared before the institution asks.",
    lead: "A US business bank account for your company stands or falls on the documents. We compile them in full, prepare the application and support you through every query from the institution — online or, where necessary, with our team on the ground.",
    ziffern: [
      { wert: "in every package", label: "First account and card application fully prepared" },
      { wert: "no power of attorney", label: "FIAON never has access to your account" },
      { wert: "Miami", label: "Appointments on the ground with our team, where an institution requires them" },
    ],
    blick: [
      ["Account holder", "Your US company — not FIAON"],
      ["Requirements", "Company formed, EIN, operating agreement, US business address"],
      ["How", "Online or with an appointment on the ground, depending on the institution"],
      ["FIAON", "Documents, application, queries, appointments — no power of attorney over your money"],
      ["Decision", "The institution alone, under its own rules"],
      ["In the package", `From ${STRUKTUR}: the first application · from ${BANKING}: every further one`],
    ],
    kurz: "A US company can open a business account in the US once it is registered and has an EIN. Institutions require the formation documents, the EIN confirmation, the operating agreement, the shareholders’ identity documents and a clear, credible description of the business. FIAON prepares these documents and the application in full; whether and on what terms an account is opened is decided by the institution.",
    bloecke: [
      {
        typ: "text", id: "unterlagen", h2: "What an institution wants to see",
        absaetze: ["The list is similar at most institutions. If one item is missing or two documents contradict each other, the application stalls — which is why we check everything before anything is submitted:"],
        punkte: [
          "Formation documents of the company (Articles of Organization or Incorporation)",
          "Confirmation of the EIN by the IRS",
          "Operating agreement or bylaws",
          "Passports of the shareholders and the managing directors",
          "US business address and phone number",
          "A clear description of the business: what, for whom, with which payment flows",
        ],
      },
      {
        typ: "karten", id: "wege", h2: "Online or on the ground", spalten: 2,
        karten: [
          { tag: "Online", titel: "Opening remotely", text: "Many institutions open accounts for companies with shareholders abroad entirely online. We prepare the application so that queries remain the exception." },
          { tag: "On the ground", titel: "Appointment at the branch", text: `Some institutions require an in-person appointment. In that case our team in Miami accompanies you — in the ${VIP} package as a fixed part of the kick-off.` },
        ],
      },
      {
        typ: "text", id: "ablehnung", h2: "Why accounts are declined",
        absaetze: ["The most common reasons are not coincidences but gaps that can be closed beforehand:"],
        punkte: [
          "The business model cannot be understood from the documents.",
          "There is no recognisable connection to the US — customers, suppliers or contracts.",
          "Names, addresses or shareholdings do not match across two documents.",
          "Payment flows touch countries or sectors that the institution does not serve.",
        ],
        nach: "We identify such gaps before the application — not after the refusal.",
      },
      {
        typ: "hinweis", id: "wissen", h2: "What you need to know",
        punkte: [
          "The institution concerned alone decides on the account, card and limit.",
          "FIAON does not name any institutions on this page: their requirements change, and which one fits depends on your plans. In the kick-off call we tell you the current position.",
          "The account holder is your company. FIAON receives no power of attorney over your account and never accepts money on your behalf.",
        ],
      },
      { typ: "paket", id: "paket", h2: "The right package", lead: `The first account and card application is included in every package. Further applications are supported by ${BANKING}.`, paket: "global_banking" },
    ],
    fragen: [
      { f: "Can I open a US business bank account from Germany?", a: "Yes — for your US company. The requirements are a registered company, an EIN and complete documents. Whether an institution opens the account is its own decision." },
      { f: "Do I have to travel to the US to open the account?", a: "Often not: many institutions open accounts online for shareholders abroad. If an institution requires an appointment, our team in Miami accompanies you." },
      { f: "What documents do I need to open a US business bank account?", a: "Usually formation documents, EIN confirmation, operating agreement, passports, US business address and a clear description of the business. We compile them and check them for contradictions." },
      { f: "Why does FIAON not name any banks?", a: "Because the institutions’ requirements change constantly and the right choice depends on your plans. We discuss which institutions currently come into question in the kick-off call." },
      { f: "Does FIAON have access to my account?", a: "No. The account holder is your company. FIAON receives no power of attorney and never accepts money on your behalf." },
    ],
    paket: "global_banking",
    weiter: ["/en/business/knowledge/us-bank-account-documents", "/en/business/us-business-credit-cards", "/en/business/ein-itin", "/en/business/knowledge/registered-agent-address"],
  },

  // ─────────────────────────────────────────────────────────────────────────
  {
    pfad: "/en/business/us-business-credit-cards",
    sprache: "en",
    schwester: "/business/firmenkarten-kapital",
    art: "leistung",
    seo: {
      titel: "US business credit cards and building capital — FIAON Global",
      beschreibung: "The card ladder: first US business credit card, planned applications, key figures for a bank loan. The capital range is your goal; the institution decides.",
    },
    stand: S,
    erschienen: S,
    kennung: "FG · 04",
    auge: "Service · Business credit cards and capital",
    h1: "Business credit cards and capital.",
    h1b: "Built up step by step.",
    lead: "Capital from US institutions is not built with a single application but through a history: the first business credit card, statements paid on time, further issuers in a well-planned order — and later, possibly, a bank loan. We plan the sequence and prepare every application.",
    ziffern: [
      { wert: globalKapitalSpanne("en"), label: "Capital range per package — your goal; the institution decides on every limit" },
      { wert: "four stages", label: "Formation, first card, card ladder, bank loan" },
      { wert: "Zurich", label: "Capital stage with Schwarzott Capital Partners AG" },
    ],
    blick: [
      ["Capital range", `${globalKapitalSpanne("en")} — depending on the package, as a goal`],
      ["First card", "Usually a small limit, no cash deposit, with a personal guarantee from the owner"],
      ["Card ladder", "Further issuers after a few months of statements paid on time"],
      ["Bank loan", `With an established history — key-figures file from ${KAPITAL}`],
      ["Use", `${GLOBAL_KAPITAL_FREI.en.kurz} — our partner tax adviser clarifies the tax treatment in advance`],
      ["FIAON", "Plans, prepares, supports — neither grants nor arranges loans"],
      ["Decision", "The institution concerned alone"],
    ],
    kurz: "US business credit cards and credit limits grow out of a history: a new company usually starts with a card with a small limit, backed by the owner’s personal guarantee. Paying on time over a few months opens the door to further issuers, and an established history may later make a bank loan possible. FIAON plans this sequence and prepares every application; the institution decides on every limit.",
    bloecke: [
      {
        typ: "etappen", id: "leiter", h2: "The card ladder in four stages",
        lead: "Durations are based on our experience. How quickly a stage goes is determined by the institutions — and by whether you pay on time.",
        etappen: [
          { titel: "Formation and documents", dauer: "typically a few weeks", text: "Company, EIN, ITIN, US address and phone number — without them, no issuer reviews an application." },
          { titel: "The first business credit card", dauer: "once documents are complete", text: "The first application to a US issuer — usually with a small limit and no cash deposit, but with a personal guarantee from the owner." },
          { titel: "The card ladder", dauer: "after a few months", text: "Paying on time opens the door to further issuers. We plan the sequence and prepare every application; each issuer decides for itself whether to approve and on what terms." },
          { titel: "The bank loan", dauer: "with an established history", text: "With a history across several issuers, a loan from a US bank may become an option. We prepare the key figures and documents; you submit the application, and the bank reviews it under its own rules." },
        ],
      },
      {
        typ: "tabelle", id: "kapitalrahmen", h2: "The capital range per package",
        lead: "The capital range is the goal you are aiming for. It determines the duration and depth of our support — it is not an outcome that FIAON can promise.",
        kopf: ["Package", "Capital range", "Support", "Fixed price"],
        zeilen: (["global_struktur", "global_banking", "global_kapital", "global_vip"] as const).map((k) => [
          name(k), globalPlanungText(k, "en"), gross(dauerKurz(k)), globalPreisText(k, "en"),
        ]),
        hervor: 1,
        fuss: ["The institution concerned alone decides on the account, card, limit and loan."],
      },
      // 19.09.2026 — Justin: „Das Kapital muss NICHT in den USA ausgegeben werden." Wortlaut aus GLOBAL_KAPITAL_FREI.en.
      {
        typ: "text", id: "europa", h2: "Usable in the US and in Europe",
        absaetze: [GLOBAL_KAPITAL_FREI.en.satz, GLOBAL_KAPITAL_FREI.en.steuer],
      },
      {
        typ: "text", id: "wovon", h2: "What a limit depends on",
        absaetze: ["Issuers and banks decide under their own rules. Their assessment almost always takes into account:"],
        punkte: [
          "the length and punctuality of previous statement payments",
          "the company’s revenue and payment flows",
          "a clear, credible business with a link to the US",
          "the creditworthiness of the owner who gives the personal guarantee",
          "complete, consistent documents",
        ],
        nach: "You can influence the first three points — and that is exactly where our planning starts.",
      },
      {
        typ: "karten", id: "grenzen", h2: "What FIAON does — and does not do", spalten: 2,
        karten: [
          { tag: "FIAON does", titel: "Plan, prepare, support", text: "Sequence of issuers, complete applications, key-figures file for a later loan, monthly review with your dedicated contact." },
          { tag: "FIAON does not", titel: "Promise, lend, arrange", text: "FIAON is not a bank, does not lend, does not arrange loans and does not promise any limit. Every decision is made by the institution." },
        ],
      },
      {
        typ: "hinweis", id: "wissen", h2: "What you need to know",
        punkte: [
          "US business credit cards generally require a personal guarantee from the owner. The person giving the personal guarantee is personally liable for the statement balance.",
          "A capital range is a goal, not a promise. The figure sets the direction of the support; the institution decides on every limit.",
          "Some issuers offer introductory periods without debit interest; each issuer sets the terms itself and can change them.",
        ],
      },
      { typ: "paket", id: "paket", h2: "The right package", lead: `${KAPITAL} supports you across several issuers through to the bank loan — with a key-figures file and priority for appointments on the ground.`, paket: "global_kapital" },
      { typ: "standorte", id: "standorte", h2: "The capital stage", lead: "Schwarzott Capital Partners AG in Zurich supports the capital stage: key figures and documents for financing discussions." },
    ],
    fragen: [
      { f: "What will my credit limit be?", a: "That is decided by the issuer under its own rules. The capital range per package is your goal and sets the direction of our support — it is not a promise." },
      { f: GLOBAL_KAPITAL_FREI.en.frage, a: GLOBAL_KAPITAL_FREI.en.antwort },
      { f: "Do I need collateral for the first business credit card?", a: "The first card usually requires no cash deposit, but a personal guarantee from the owner. The personal guarantee is the issuer’s security." },
      { f: "Does FIAON arrange loans?", a: "No. FIAON is not a bank, does not lend and does not arrange loans. We plan the sequence, prepare applications and documents and support you; the institution makes the decision." },
      { f: `What does “${VIP_RAHMEN}” mean for the ${VIP} package?`, a: "It is the upper limit of the capital range that this package supports — your goal, not a promise. The institution concerned decides on every limit." },
      { f: "How long does it take to build up capital?", a: `In our experience: ${dauerKurz("global_struktur")} with ${STRUKTUR}, ${dauerKurz("global_banking")} with ${BANKING}, ${dauerKurz("global_kapital")} with ${KAPITAL}. How quickly it goes is determined by the institutions and by whether you pay on time.` },
    ],
    paket: "global_kapital",
    weiter: ["/en/business/knowledge/us-business-credit-card", "/en/business/knowledge/us-business-credit", "/en/business/knowledge/building-us-credit", "/en/business/us-business-bank-account"],
  },

  // ─────────────────────────────────────────────────────────────────────────
  {
    pfad: "/en/business/us-compliance",
    sprache: "en",
    schwester: "/business/us-pflichten",
    art: "leistung",
    seo: {
      titel: "US LLC compliance and Form 5472 — FIAON Global",
      beschreibung: "Form 5472 with Form 1120, annual report, registered agent: we keep your US company’s compliance calendar; our US CPA prepares the first filing.",
    },
    stand: S,
    erschienen: S,
    kennung: "FG · 05",
    auge: "Service · US compliance",
    h1: "Your US compliance duties.",
    h1b: "In the calendar, not at the back of your mind.",
    lead: "A US company has obligations even when it has no revenue: the annual filing with the IRS, the state fee, the registered agent — and the filing in your home country. We keep the calendar; our US CPA prepares the first filing.",
    ziffern: [
      { wert: "Form 5472", label: "with Form 1120 — annually, even without revenue" },
      { wert: "15 April", label: "IRS deadline for companies whose tax year is the calendar year" },
      { wert: "in the package", label: "First annual US filing by our US CPA" },
    ],
    blick: [
      ["IRS", "Form 5472 with Form 1120 for companies with a foreign shareholder"],
      ["State", "Annual report or annual fee, with its own deadline depending on the state"],
      ["Registered agent", "Annually — without one, no valid address in the state"],
      ["Home country", "Notification of the shareholding and tax return — with your tax adviser"],
      ["In the package", `First US filing by US CPA · compliance calendar from ${BANKING}`],
      ["From year two", `Annual care plan: ${JAHRESBETREUUNG} a year, all fees included`],
    ],
    kurz: "A US company with a foreign shareholder (member) must file Form 5472 together with Form 1120 with the IRS every year — even without revenue. On top of this come the state’s annual report or annual fee and the registered agent. In the home country, the shareholding must be reported, and the company is generally taxed there. FIAON keeps the compliance calendar; our US CPA prepares the first annual US filing within the fixed price.",
    bloecke: [
      {
        typ: "tabelle", id: "kalender", h2: "A US company’s duties over the year",
        kopf: ["Duty", "Filed with", "Deadline", "Who handles it"],
        zeilen: [
          ["Form 5472 with Form 1120", "IRS, by fax or post", "15 April, with Form 7004 until 15 October", "US CPA (first year in the package)"],
          ["Annual report or annual tax", "State", "Florida 1 January to 1 May · Delaware 1 June · Wyoming in the month of formation", "FIAON in the compliance calendar"],
          ["Registered agent", "State", "annually", "in the package for the first year"],
          ["Notification of the shareholding (Germany: section 138 of the German Fiscal Code, AO)", "Tax office in the home country", "with the tax return, no later than fourteen months after the end of the year", "Your tax adviser"],
          ["Tax return of the company", "Tax office in the home country", "under local law", "Your tax adviser"],
        ],
        fuss: ["IRS deadline for companies whose tax year is the calendar year. State deadlines for LLCs; amounts and details on the state pages and under “Costs”.", "Companies formed in the US have been exempt from reporting beneficial ownership information (BOI) to FinCEN since 14 August 2026."],
      },
      {
        typ: "text", id: "form-5472", h2: "Form 5472 — the filing no one can afford to forget",
        absaetze: [
          "If a US company is owned by a foreign shareholder (member), it reports its transactions with that shareholder to the IRS every year: contributions, withdrawals, loans, services paid for. This is done on Form 5472, filed together with a Form 1120 which, for such a company, serves only as a cover sheet.",
          `The filing is mandatory even if the company has had no revenue — the contribution at formation is already a reportable transaction. It is not filed electronically but by fax or post. For a missing or substantially incomplete filing, the IRS can impose a penalty of ${IRS_EN.strafe5472}; if the filing is still not made after a notice, further amounts are added.`,
        ],
      },
      {
        typ: "text", id: "heimat", h2: "Your obligations in your home country",
        absaetze: [
          "In Germany, the formation or acquisition of a shareholding in a foreign company must be reported to the tax office (section 138 of the German Fiscal Code, AO) — together with the tax return, no later than fourteen months after the end of the year. Anyone who fails to report risks a fine of no more than €25,000 (section 379 AO). The tax office classifies the US company by comparison with German legal forms (Typenvergleich).",
          "Switzerland and Austria have their own rules. In all three countries, a company managed from within the country is generally taxable there. Our partner tax adviser clarifies this before formation — your own tax adviser handles the ongoing tax return.",
        ],
      },
      {
        typ: "hinweis", id: "wissen", h2: "What you need to know",
        punkte: [
          "Deadlines and penalties are set by the authorities, not by FIAON. The compliance calendar reminds you in good time; responsibility for the company remains with you.",
          GLOBAL_LAUFEND.en,
          "Ongoing bookkeeping and the tax return in your home country are not part of the packages; your tax adviser handles them.",
        ],
      },
      { typ: "paket", id: "paket", h2: "The right package", lead: `${BANKING} keeps the compliance calendar for all US filings and deadlines — and supports further account and card applications.`, paket: "global_banking" },
    ],
    fragen: [
      { f: "Do I have to file Form 5472 if my LLC had no revenue?", a: "Yes. The obligation does not depend on revenue but on the company being owned by a foreign shareholder: it must report its transactions with that shareholder, and contributions at formation already count." },
      { f: "What happens if I miss the Form 5472 deadline?", a: `The IRS can impose a penalty of ${IRS_EN.strafe5472}, with further amounts if the failure continues after a notice. That is why the deadline is in the compliance calendar and our US CPA prepares the first filing.` },
      { f: "Who prepares the annual US filing?", a: `In the first year, our US CPA — the fee is included in the fixed price. From the second year, the annual care plan takes this over for ${JAHRESBETREUUNG} a year, all fees included.` },
      { f: "Do I have to report the US company to my tax office?", a: "In Germany, yes: under section 138 of the German Fiscal Code (AO), together with the tax return. Austria and Switzerland have their own rules; our partner tax adviser tells you what they are before formation." },
      { f: "What does a US company cost from the second year onwards?", a: `The state fee, the registered agent and the annual US filing. With the annual care plan we take care of all of this for ${JAHRESBETREUUNG} a year, all fees included; the individual amounts per state are on the “Costs” page.` },
    ],
    paket: "global_banking",
    weiter: ["/en/business/knowledge/llc-tax-returns", "/en/business/knowledge/form-5472", "/en/business/knowledge/registered-agent-address", "/en/business/from-germany"],
    quellen: [
      { titel: "IRS — Instructions for Form 5472", url: "https://www.irs.gov/instructions/i5472" },
      { titel: "IRS — About Form 7004", url: "https://www.irs.gov/forms-pubs/about-form-7004" },
      QUELLEN_RECHT_EN.ao138,
    ],
  },

  // ─────────────────────────────────────────────────────────────────────────
  {
    pfad: "/en/business/miami",
    sprache: "en",
    schwester: "/business/miami",
    art: "leistung",
    seo: {
      titel: `${VIP}: an in-person kick-off in Miami — FIAON Global`,
      beschreibung: `Your US company with a kick-off in Miami: meeting authorities and banks together with our team, flights and hotel included. Capital range ${VIP_RAHMEN}.`,
    },
    stand: S,
    erschienen: S,
    kennung: "FG · 06",
    auge: `Service · ${VIP}`,
    h1: `${VIP}.`,
    h1b: "The in-person kick-off in Miami.",
    lead: `For business owners who want to sit at the table themselves: your US company with everything in ${KAPITAL} — and a kick-off on the ground in Miami, including appointments with authorities and banks alongside our team and our management. Flights and hotel for the kick-off are included in the fixed price.`,
    ziffern: [
      { wert: VIP_RAHMEN, label: "Capital range — your goal; the institution decides" },
      { wert: globalPreisText("global_vip", "en"), label: "Fixed price, one-off — flights and hotel included" },
      { wert: "Miami", label: "Kick-off with Schwarzott Global LLC" },
    ],
    blick: [
      ["Included", `Everything in ${KAPITAL} — from formation to the key-figures file`],
      ["On the ground", "Appointments with authorities and banks together with our team"],
      ["Support", "Accompanied by FIAON’s management"],
      ["Travel", "Flights and hotel for one person named by you, booked in your name"],
      ["Capital range", `${VIP_RAHMEN} — as a goal`],
      ["Fixed price", `${globalPreisText("global_vip", "en")}, one-off`],
    ],
    kurz: `${VIP} is the package with a kick-off on the ground: your US company with everything in ${KAPITAL}, plus appointments with authorities and banks in Miami together with our team and our management. FIAON bears the cost of flights and hotel for the kick-off — booked in your name; FIAON does not sell travel. The capital range of this package reaches ${VIP_RAHMEN}; the institution decides on every limit.`,
    bloecke: [
      {
        typ: "text", id: "warum", h2: "Why on the ground",
        absaetze: [
          "Most formations do not require any travel. But if you are building a larger structure, approaching several institutions or simply want to see for yourself who you are working with, you benefit from a kick-off on the ground: conversations become shorter, queries disappear, and you get to know the people who support your company in the US.",
          "The choice of Miami is no coincidence: this is where our team on the ground, Schwarzott Global LLC, is based, and it is from here that the team attends appointments with authorities and institutions.",
        ],
      },
      {
        typ: "etappen", id: "auftakt", h2: "The kick-off in four steps",
        etappen: [
          { titel: "Preparation from afar", text: "Documents, formation and tax numbers proceed as in every package. Your contact agrees travel dates, class of travel and hotel with you before booking." },
          { titel: "Arrival in Miami", text: "Flights and hotel are booked, in your name and at FIAON’s expense. Our team picks you up for the first appointment." },
          { titel: "Appointments on the ground", text: "Appointments with authorities and banks together with our team, and a working session with the management on the card ladder and the capital stage." },
          { titel: `Continuing as in ${KAPITAL}`, text: "After the kick-off, we support you across several issuers through to the key-figures file for a bank loan — with priority for all appointments on the ground." },
        ],
      },
      {
        typ: "hinweis", id: "reise", h2: "The trip — clearly arranged",
        punkte: [
          GLOBAL_VIP_REISE.en,
          "FIAON is not a tour operator and does not sell travel. FIAON bears the cost of a business trip that is booked in the Client’s name.",
          "Even after an appointment on the ground, the institution concerned alone decides on the account, card, limit and loan.",
        ],
      },
      { typ: "paket", id: "paket", h2: "The package", lead: `Everything in ${KAPITAL}, the kick-off in Miami, support from our management.`, paket: "global_vip" },
      { typ: "standorte", id: "standorte", h2: "Your team in Miami", lead: "Your contracting party is FIAON LTD in London; Schwarzott Global LLC works on the ground." },
    ],
    fragen: [
      { f: `Whose travel is included in the ${VIP} package?`, a: "Flights and hotel for the kick-off are included for one person named by you. If further people would like to travel with you, we agree this with you separately in advance." },
      { f: "Is this a package holiday?", a: "No. FIAON bears the cost of a business trip booked in your name. FIAON is not a tour operator and does not sell travel." },
      { f: "When does the kick-off take place?", a: "Once payment has been received and as soon as the documents are complete. We agree travel dates, class of travel and hotel with you before anything is booked." },
      { f: `What does the capital range of ${VIP_RAHMEN} mean?`, a: `It is the upper limit of the capital range that this package supports — your goal, not a promise. The institution concerned decides on every limit. ${KAPITAL_FREI}` },
      { f: "Do I need to travel at all to form the company?", a: `No. Every formation with FIAON Global can also be handled entirely remotely. ${VIP} is the choice for business owners who want to experience the build-up in person.` },
    ],
    paket: "global_vip",
    weiter: ["/en/business/us-business-credit-cards", "/en/business/partners", "/en/business/florida", "/en/business/costs"],
  },
];
