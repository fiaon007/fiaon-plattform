// ═══════════════════════════════════════════════════════════════════════════
// FIAON GLOBAL — WISSEN AUF ENGLISCH: GRÜNDUNG, STEUERNUMMERN, PRÄSENZ,
// STEUERN, STRUKTUR (24.09.2026, E-234)
//
// Die englischen Schwestern der sechs Praxis-Beiträge aus ../wissen-gruendung.ts:
// LLC gründen, EIN, ITIN, Registered Agent und Adresse, US-Steuererklärung,
// Tochter oder Zweigniederlassung. Britisches Englisch, dieselben Bausteine in
// derselben Reihenfolge, dieselben Anker (ids bleiben deutsch), dieselben Quellen
// mit englischen Titeln (QUELLEN_WISSEN_EN, QUELLEN_STAATEN_EN).
// Jeder Beitrag zeigt wie auf Deutsch, wie FIAON Global die Aufgabe übernimmt
// („How FIAON Global handles …“) — ein Auftrag, ein Festpreis, Team vor Ort,
// Partner mit Zulassung, ohne Superlative. Zahlen nur aus fakten-en.ts, Preise
// und Paketnamen nur aus shared/fiaon-global.ts. Wortgrenzen unverändert: kein
// „up to“, keine Frist mit Ziffer („within sixty days“), Geld zurück nur mit
// seinen Bedingungen, der Kapital-Satz nur mit dem Steuersatz daneben.
// Prüfstand: npx tsx scripts/pruef-global-en.ts shared/fiaon-global-seiten/en/wissen-gruendung.ts
// ═══════════════════════════════════════════════════════════════════════════
import {
  GLOBAL_GELD_ZURUECK, GLOBAL_INKLUSIVE, GLOBAL_KAPITAL_FREI, GLOBAL_LAUFEND, GLOBAL_PFLICHTHINWEIS,
  globalJahresbetreuungPreisText, globalPaket, globalPreisText,
} from "../../fiaon-global";
import {
  EIN_WEG_EN, FAKTEN_STAND_EN, FRISTEN_EN, IRS_EN, MARKT_EN, QUELLEN_STAATEN_EN, QUELLEN_WISSEN_EN as Q, SCHWELLEN_EN, STAAT_EN,
} from "../fakten-en";
import type { GlobalSeite } from "../typen";

const S = "2026-09-24";
const GELD_ZURUECK = `${GLOBAL_GELD_ZURUECK.en.text} ${GLOBAL_GELD_ZURUECK.en.bedingungen}`;
const KAPITAL_FREI = `${GLOBAL_KAPITAL_FREI.en.satz} ${GLOBAL_KAPITAL_FREI.en.steuer}`;
const STRUKTUR = globalPaket("global_struktur")?.en.name ?? "";
const KAPITAL = globalPaket("global_kapital")?.en.name ?? "";
const STRUKTUR_DAUER = globalPaket("global_struktur")?.en.dauerKurz ?? "";
const gross = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

export const WISSEN_GRUENDUNG_EN: GlobalSeite[] = [
  // ─────────────────────────────────────────────────────────────────────────
  // 1 · LLC GRÜNDEN — der Pfeiler: alle zehn Schritte in Reihenfolge
  {
    pfad: "/en/business/knowledge/form-a-us-llc",
    sprache: "en",
    schwester: "/business/wissen/llc-gruenden",
    art: "wissen",
    seo: {
      titel: "Form a US LLC from Germany: 10-step guide — FIAON Global",
      beschreibung: "Form a US LLC from Germany, Austria or Switzerland: ten steps from the initial review to Form 5472 — with costs, documents and deadlines.",
    },
    stand: S,
    erschienen: S,
    kennung: "FG · 30",
    auge: "Knowledge · Formation",
    h1: "Form a US LLC.",
    h1b: "Step by step, from Germany.",
    lead: "A US LLC can be formed entirely from abroad — without residence in the US, without travelling and without minimum capital. Filing with the state is the smallest part of it. Here are all ten steps in the right order: what each one costs, who handles it and where most founders get stuck.",
    ziffern: [
      { wert: "10 steps", label: "from the initial review to the first US filing" },
      { wert: `${STAAT_EN.wyoming.gruendung} – ${STAAT_EN.florida.gruendung}`, label: "state formation fee" },
      { wert: "No", label: "minimum capital, no notary, no travel" },
    ],
    blick: [
      ["Requirements", "Passport, home address, a clear plan — no US residence required"],
      ["Sequence", "Review, state, formation, EIN, account"],
      ["State fee", `Florida ${STAAT_EN.florida.gruendung}, Delaware ${STAAT_EN.delaware.gruendung}, Wyoming ${STAAT_EN.wyoming.gruendung}`],
      ["Duties in the US", "Registered agent, annual report to the state, Form 5472"],
      ["Duties at home", "Notification under section 138 AO, tax at the place of management"],
      ["Since August 2026", "No more BOI reporting for US companies"],
      ["With FIAON Global", "All ten steps from a single source, at a fixed price"],
    ],
    kurz: `You form a US LLC from Germany in ten steps: a tax review at home, the legal form, the state, the name, the registered agent, filing with the state, the operating agreement, the EIN from the IRS, the ITIN where there is a tax reason, then the account and the compliance calendar. The state fee ranges from ${STAAT_EN.wyoming.gruendung} (Wyoming) to ${STAAT_EN.florida.gruendung} (Florida). The effort lies not in the fees but in the order of the steps and the duties that follow — Form 5472 every year and the notification to the tax office.`,
    bloecke: [
      {
        typ: "text", id: "vorab", h2: "Before you form: two questions",
        absaetze: [
          "The first question is not “Which state?” but: what is the company meant to do? Contracts with US customers, sales through US marketplaces, an account in US dollars, a card history of its own, building capital — depending on the answer, a different legal form, state and structure will fit.",
          "The second question is asked by your home country: where is the company managed? Anyone who runs it from Germany, Austria or Switzerland is generally taxable there. This review belongs before formation, not after it — it also decides whether the LLC should belong to you personally or to your GmbH (a German, Austrian or Swiss limited liability company).",
        ],
      },
      {
        typ: "etappen", id: "schritte", h2: "The ten steps",
        lead: "In this order — each step requires the one before it.",
        etappen: [
          { titel: "Plan and tax review", dauer: "before anything else", text: "Clarify what the company is meant to do and where it will be managed. A tax adviser with US experience reviews how your home country classifies the LLC (in Germany by comparison with German legal forms, the Typenvergleich) and which notifications are required." },
          { titel: "Choose the legal form", text: "The LLC suits trading, services and building a card history of its own; the corporation suits businesses that want to bring in investors. An LLC can belong to one person, to several or to your GmbH — each variant has its own tax consequences." },
          { titel: "Choose the state", text: "Where will the business take place? Are investors coming in? Will you need appointments on site? The choice between Florida, Delaware and Wyoming follows from the answers. A company that does business in another state also registers there." },
          { titel: "Check the name", text: "Each name is granted only once in a state and carries the suffix “LLC” or “Limited Liability Company”. Check it in the state’s register and keep two alternative names ready." },
          { titel: "Appoint a registered agent", text: "Every LLC needs a registered agent in the state of formation with a physical address, who accepts official mail and lawsuits — from the first day and without interruption." },
          { titel: "File with the state", dauer: "online, usually quick", text: `The formation document goes to the state together with the fee: in Florida the Articles of Organization (${STAAT_EN.florida.gruendung}), in Delaware the Certificate of Formation (${STAAT_EN.delaware.gruendung}), in Wyoming the Articles of Organization (${STAAT_EN.wyoming.gruendung}). Once registered, the company exists.` },
          { titel: "Draw up the operating agreement", text: "The operating agreement governs ownership, management, profit distribution and succession. It is not filed, but every institution asks for it — and since 1 June 2026 so does the IRS, if an ITIN application is based on an interest in an LLC with several shareholders (members)." },
          { titel: "Apply for the EIN", dauer: "about four business days by fax", text: "You apply for the company’s tax number with Form SS-4 — without a US Social Security number by fax, post or phone, not online. No EIN means no account, no card application and no Form 5472." },
          { titel: "The ITIN, if there is a reason", text: "The personal US tax number is issued only with a tax reason (Form W-7). It is not needed for the EIN; for a personal credit history in the US it often is." },
          { titel: "Account, compliance calendar, notification at home", text: "Once the formation document, EIN and operating agreement are in place, the account application follows. Then the duties begin: the annual report to the state, Form 5472 by 15 April, the notification to the tax office under section 138 of the German Fiscal Code (AO)." },
        ],
      },
      {
        typ: "tabelle", id: "kosten", h2: "What formation costs",
        lead: "The state fees are modest. The real costs come from the agent, the contracts, the tax numbers and the annual filing — and from mistakes in the order of the steps.",
        kopf: ["Item", "Florida", "Delaware", "Wyoming"],
        zeilen: [
          ["State formation fee", STAAT_EN.florida.gruendung, STAAT_EN.delaware.gruendung, STAAT_EN.wyoming.gruendung],
          ["Annually to the state", STAAT_EN.florida.jahr, STAAT_EN.delaware.jahr, STAAT_EN.wyoming.jahr],
          ["Registered agent (market price)", MARKT_EN.agent, MARKT_EN.agent, MARKT_EN.agent],
          ["EIN from the IRS", "free", "free", "free"],
          ["Form 5472 by a US CPA (market price)", MARKT_EN.cpa5472, MARKT_EN.cpa5472, MARKT_EN.cpa5472],
        ],
        fuss: [
          `As of ${FAKTEN_STAND_EN}. State fees according to the official fee schedules; market prices are published prices from several providers, not official figures.`,
          "With FIAON Global, the state fee, the registered agent in the first year, both tax numbers and the first Form 5472 are included in the fixed price.",
        ],
      },
      {
        typ: "text", id: "boi", h2: "Since August 2026: no more BOI reporting",
        absaetze: [
          "Until 2025 the rule was that every new US company had to report its beneficial owners to the US authority FinCEN (Beneficial Ownership Information, BOI). For companies formed in the US, this duty has ended; the rule that took effect on 14 August 2026 made that final.",
          "Only foreign companies that register to do business in a state still have to report — a GmbH with a branch in the US, for example. For an LLC that you form in Florida, Delaware or Wyoming, the report no longer applies. Anyone who still uses penalties for a missed BOI report in their marketing is working with outdated information.",
        ],
      },
      {
        typ: "karten", id: "fehler", h2: "The six most common mistakes", spalten: 3,
        karten: [
          { tag: "Mistake", titel: "Form first, review later", text: "The tax question at home comes after formation. By then the structure is fixed — even if the LLC would have fitted better under the GmbH." },
          { tag: "Mistake", titel: "The cheapest state", text: "Anyone who does business in Florida and forms in Wyoming also registers in Florida — and pays in both states." },
          { tag: "Mistake", titel: "The agent’s address as head office", text: "Many institutions decline to open accounts for companies whose business address is a registered agent’s address or a PO box." },
          { tag: "Mistake", titel: "No operating agreement", text: "The account fails because of a document that should have been in place before formation: who holds an interest, who may act?" },
          { tag: "Mistake", titel: "Forgetting Form 5472", text: `Even the capital contribution at formation must be reported. The penalty for a missing filing: ${IRS_EN.strafe5472}.` },
          { tag: "Mistake", titel: "No notification to the tax office", text: "In Germany, you must notify the tax office of the formation or the interest under section 138 of the German Fiscal Code (AO) — with your next tax return." },
        ],
      },
      {
        typ: "text", id: "fiaon", h2: "How FIAON Global handles the ten steps",
        absaetze: [
          "Each step can be solved on its own. Together they are a project involving authorities in two countries, three professions and unforgiving deadlines. FIAON Global turns this into a single engagement: one dedicated contact, one fixed price, one document room in which every paper is kept.",
          "Our team in Miami files the formation and provides the registered agent, the US business address and the phone number. Our partner lawyer drafts the operating agreement, our partner tax adviser reviews the consequences in your home country before formation, and our US CPA prepares the first Form 5472. We prepare and file the EIN and ITIN applications; we fully prepare the first account and card application.",
          GELD_ZURUECK,
        ],
        punkte: [...GLOBAL_INKLUSIVE.en],
        nach: `${STRUKTUR} starts at ${globalPreisText("global_struktur", "en")}, one-off — support typically runs for ${STRUKTUR_DAUER}.`,
      },
      { typ: "paket", id: "paket", h2: "The right package", lead: `${STRUKTUR} covers all ten steps — from the kick-off call to the first Form 5472.`, paket: "global_struktur" },
      {
        typ: "hinweis", id: "wissen", h2: "What you need to know",
        punkte: [
          GLOBAL_PFLICHTHINWEIS.en[0],
          GLOBAL_PFLICHTHINWEIS.en[1],
          "An LLC does not replace a business model: institutions look at what the company does — not where it is registered.",
        ],
      },
    ],
    fragen: [
      { f: "As a German, can I set up an LLC in the United States?", a: "Yes. You can form an LLC entirely from Germany — without US residence, without travelling, without minimum capital and without US citizenship. What you need is a registered agent in the state of formation and the state fee." },
      { f: "How much does it cost to form an LLC?", a: `The state fee is ${STAAT_EN.wyoming.gruendung} in Wyoming, ${STAAT_EN.delaware.gruendung} in Delaware and ${STAAT_EN.florida.gruendung} in Florida. On top of that come the registered agent, the operating agreement and, every year, the state fee and Form 5472. With FIAON Global, the first year is included in the fixed price, starting at ${globalPreisText("global_struktur", "en")}.` },
      { f: "How long does it take to form an LLC?", a: `Registration with the state is usually quick online. The EIN (${IRS_EN.einDauer}), the ITIN and the account application take longer. With FIAON Global, support until the first account and card application typically takes ${STRUKTUR_DAUER}.` },
      { f: "Do I need a US address for my LLC?", a: "The LLC needs a registered agent with an address in the state of formation. For the account and contracts it also needs a business address; for many institutions the agent’s address is not enough for this." },
      { f: "Does a new LLC still have to file a BOI report?", a: "No, if it was formed in the US. Since 14 August 2026, US companies have been definitively exempt from BOI reporting; only foreign companies that register in a state still have to report." },
    ],
    paket: "global_struktur",
    weiter: ["/en/business/us-company-formation", "/en/business/knowledge/choosing-a-state", "/en/business/knowledge/applying-for-an-ein", "/en/business/knowledge/registered-agent-address"],
    quellen: [QUELLEN_STAATEN_EN.florida[0], QUELLEN_STAATEN_EN.delaware[0], QUELLEN_STAATEN_EN.wyoming[0], Q.ein, Q.boiEnde, Q.caa, Q.ao138],
    prio: 0.7,
  },

  // ─────────────────────────────────────────────────────────────────────────
  // 2 · EIN BEANTRAGEN — ohne SSN, Form SS-4 Zeile für Zeile
  {
    pfad: "/en/business/knowledge/applying-for-an-ein",
    sprache: "en",
    schwester: "/business/wissen/ein-beantragen",
    art: "wissen",
    seo: {
      titel: "Get an EIN without an SSN: Form SS-4 — FIAON Global",
      beschreibung: "Apply for an EIN for your LLC without an SSN: Form SS-4 line by line, fax, post or phone, timing and the typical mistakes — as of September 2026.",
    },
    stand: S,
    erschienen: S,
    kennung: "FG · 31",
    auge: "Knowledge · Tax number",
    h1: "Apply for your EIN.",
    h1b: "Without a Social Security number.",
    lead: "The EIN is your US company’s tax number — without it there is no account, no card application and no filing with the IRS. The online application remains closed to founders without a US Social Security number. Here is how you still get the number: with Form SS-4, by fax, post or phone.",
    ziffern: [
      { wert: "Free", label: "the EIN itself costs nothing at the IRS" },
      { wert: "About four business days", label: "by fax, about four weeks by post" },
      { wert: "9 digits", label: "in the format 12-3456789" },
    ],
    blick: [
      ["What", "Employer Identification Number — the company’s tax number"],
      ["When", "After registration with the state"],
      ["Form", "Form SS-4, signed on behalf of the company"],
      ["Routes without an SSN", "Fax, post or phone — not online"],
      ["Timing", gross(IRS_EN.einDauer)],
      ["Cost", "Free at the IRS"],
      ["With FIAON Global", "Prepared, filed, tracked — included in the fixed price"],
    ],
    kurz: `Without a US Social Security number, you apply for the EIN with Form SS-4 by fax, by post or — only for applicants from abroad — by phone with the IRS. The company must already be registered. Line 7b says “foreign” or “N/A” if the responsible party has neither an SSN nor an ITIN; an LLC with one foreign shareholder (member) notes “${EIN_WEG_EN.zeile9a}” in line 9a. Timing: ${IRS_EN.einDauer}.`,
    bloecke: [
      {
        typ: "text", id: "was", h2: "What the EIN is — and what you need it for",
        absaetze: [
          "The Employer Identification Number is the tax number of a US company: nine digits, issued by the US tax authority, the IRS. Despite its name, it is not only needed by those who employ staff. Institutions require it for every business account, card issuers for every application, and without it Form 5472 cannot be filed.",
          "An LLC with a single foreign shareholder (member) needs the EIN if only because it must file Form 5472 every year — under its own name and its own EIN.",
        ],
      },
      {
        typ: "text", id: "online", h2: "Why the online application does not work",
        absaetze: [
          "The IRS offers an online application that issues the number immediately. However, it requires the responsible party to have a valid SSN or ITIN. Founders from Germany, Austria or Switzerland generally have neither — they are left with fax, post and phone.",
          "Applying for an ITIN just for the EIN is not worthwhile: the EIN can be applied for without an ITIN, and the ITIN needs a tax reason of its own.",
        ],
      },
      {
        typ: "text", id: "verantwortlich", h2: "The responsible party",
        absaetze: [
          "The IRS wants to know who is behind the company: the “responsible party” — the person who ultimately owns or controls the company. Except for government entities, this must be an individual, not a company. If the LLC belongs to your GmbH, it is the individual who actually directs the GmbH and thus the LLC.",
          "If this person has neither an SSN nor an ITIN and cannot obtain one, line 7b says “foreign” or “N/A”. The IRS issues only one EIN per responsible party per day.",
        ],
      },
      {
        typ: "tabelle", id: "zeilen", h2: "Form SS-4: the lines that matter",
        lead: "For an LLC with one foreign shareholder (member). The remaining lines are largely self-explanatory.",
        kopf: ["Line", "What goes in", "Typical mistake"],
        zeilen: [
          ["1", "The name of the LLC, exactly as in the formation document — with “LLC”", "Abbreviations or spellings that differ from the register"],
          ["4a–5b", "The company’s mailing address and business address", "An address at which letters from the IRS reach nobody"],
          ["7a–7b", "Name of the responsible party; without an SSN or ITIN, “foreign” or “N/A”", "A company instead of an individual"],
          ["8a–8c", "LLC: yes, number of members, formed in the US", "The number differs from the operating agreement"],
          ["9a", `“Other” with the note “${EIN_WEG_EN.zeile9a}”`, "“Sole proprietor” ticked"],
          ["10", "Reason: new business, stating the activity", "An empty field"],
          ["11", "Date of formation", "The date of the application instead of the registration"],
          ["16–17", "Principal activity, described specifically", "“Other” without explanation"],
          ["Third Party Designee", "Who receives the number on your behalf and answers questions about the form", "No signature under the authorisation"],
        ],
        fuss: ["Based on the IRS Instructions for Form SS-4 (as of December 2025). The designee’s authority ends as soon as the EIN has been assigned and communicated."],
      },
      {
        typ: "karten", id: "wege", h2: "Three routes to the number", spalten: 3,
        karten: [
          { tag: "Fax", titel: "About four business days", text: `From abroad to ${EIN_WEG_EN.faxAusland}. Give a fax number for the reply — that way the number comes back by the same route.` },
          { tag: "Post", titel: "About four weeks", text: `To ${EIN_WEG_EN.post}. The slowest route — and the one with the most lost weeks if a detail is missing.` },
          { tag: "Phone", titel: "Only for applicants from abroad", text: `On ${EIN_WEG_EN.telefon}, ${EIN_WEG_EN.telefonZeit}. The call may be made by anyone who is authorised to sign for the company or authorised as designee.` },
        ],
      },
      {
        typ: "text", id: "danach", h2: "After the number is assigned",
        absaetze: [
          "The IRS confirms the number with a letter (CP 575). Keep it safe: institutions ask for it with the account application. If it is lost, the IRS confirms the number again on request (Letter 147C).",
          "If the address or the responsible party changes, report this to the IRS with Form 8822-B — within sixty days.",
        ],
      },
      {
        typ: "text", id: "fiaon", h2: "How FIAON Global handles the EIN",
        absaetze: [
          "With FIAON Global, the EIN is part of every package. We fill in Form SS-4, you sign, we file and track the application until the number is issued. We clarify any queries from the IRS with you, and the IRS letter is then kept in your document room — and the EIN goes straight into the account application and into your company’s compliance calendar.",
          GELD_ZURUECK,
        ],
      },
      { typ: "paket", id: "paket", h2: "The EIN in the package", lead: `Company, EIN, ITIN and the first account and card application — ${STRUKTUR} at a fixed price.`, paket: "global_struktur" },
      {
        typ: "hinweis", id: "wissen", h2: "What you need to know",
        punkte: [
          "The EIN is a tax number, not an approval: it says nothing about whether an institution will open an account.",
          GLOBAL_PFLICHTHINWEIS.en[1],
          "Whoever signs Form SS-4 declares to the IRS that the information is correct — spellings and figures must match the formation document.",
        ],
      },
    ],
    fragen: [
      { f: "Can I get an EIN without an SSN?", a: "Yes. Without an SSN or ITIN, you apply for the EIN with Form SS-4 by fax, by post or — as an applicant from abroad — by phone. Only the online application requires an SSN or ITIN." },
      { f: "How long does it take to get an EIN?", a: `${gross(IRS_EN.einDauer)}. By phone it is quickest, if all the details are to hand.` },
      { f: "Does it cost anything to get an EIN?", a: "Not at the IRS. Costs arise only if you engage someone — with FIAON Global, the EIN is included in the fixed price of every package." },
      { f: "Do I need an ITIN to apply for an EIN?", a: "No. If the responsible party has neither an SSN nor an ITIN, line 7b of Form SS-4 says “foreign” or “N/A”." },
      { f: "What if I have lost my EIN confirmation letter?", a: "The IRS confirms the number again on request (Letter 147C). Many institutions accept this confirmation in place of the original letter (CP 575)." },
    ],
    paket: "global_struktur",
    weiter: ["/en/business/ein-itin", "/en/business/knowledge/applying-for-an-itin", "/en/business/knowledge/form-a-us-llc", "/en/business/knowledge/us-bank-account-documents"],
    quellen: [Q.ss4, Q.ein, Q.smllc, Q.f8822b],
  },

  // ─────────────────────────────────────────────────────────────────────────
  // 3 · ITIN BEANTRAGEN — Form W-7, der steuerliche Grund, der Pass
  {
    pfad: "/en/business/knowledge/applying-for-an-itin",
    sprache: "en",
    schwester: "/business/wissen/itin-beantragen",
    art: "wissen",
    seo: {
      titel: "Apply for an ITIN from Germany: Form W-7 — FIAON Global",
      beschreibung: "Apply for an ITIN with Form W-7: who needs one, which tax reason qualifies, passport and acceptance agent, timing and expiry — as of September 2026.",
    },
    stand: S,
    erschienen: S,
    kennung: "FG · 32",
    auge: "Knowledge · Tax number",
    h1: "Apply for your ITIN.",
    h1b: "Only with a tax reason.",
    lead: "The ITIN is your personal tax number in the US. Many providers sell it as the key to accounts and cards — but the IRS issues it only for tax purposes and only with a stated reason. If you know this, you can submit an application that goes through rather than one that is returned weeks later.",
    ziffern: [
      { wert: "About seven weeks", label: "processing; nine to eleven in peak season and from abroad" },
      { wert: "Form W-7", label: "with passport and tax reason" },
      { wert: "Three years", label: "without a tax return — then it expires" },
    ],
    blick: [
      ["What", "Individual Taxpayer Identification Number — for people without an SSN"],
      ["Who", "Anyone who has to file a US tax return or qualifies for an exception"],
      ["Form", "Form W-7, as a rule with a tax return"],
      ["Passport", "Original, copy certified by the issuing authority, or verification by a CAA"],
      ["Timing", "About seven weeks; nine to eleven in peak season and from abroad"],
      ["Expiry", "After three tax years without a return"],
      ["With FIAON Global", "Reason reviewed, passport checked at the appointment, application tracked"],
    ],
    kurz: `You apply for the ITIN with Form W-7 to the IRS — as a rule together with a US tax return, and without one only if one of the IRS’s five exceptions applies. You need a tax reason; the ITIN is not needed for your company’s EIN. You send the passport as the original or as a copy certified by the issuing authority — or a Certifying Acceptance Agent checks it and returns it immediately. Processing takes ${IRS_EN.itinDauer}.`,
    bloecke: [
      {
        typ: "text", id: "was", h2: "What the ITIN is — and what it is not",
        absaetze: [
          "The IRS issues the Individual Taxpayer Identification Number to people who must be registered for tax in the US but cannot obtain a Social Security number. It has nine digits, begins with a 9 and serves tax purposes only.",
          "An ITIN is not a work permit, not a residence permit and not an entitlement to US Social Security benefits. Outside tax law, it is not a form of identification either.",
        ],
      },
      {
        typ: "text", id: "grund", h2: "The tax reason decides",
        absaetze: [
          "The IRS requires a reason with every application. The standard case: you submit Form W-7 together with a US tax return — for instance because, as a shareholder (member) of an LLC, you have to declare income from business in the US. Without a tax return, it works only if one of the IRS’s five exceptions applies.",
          "One of them concerns partners in a partnership — for tax purposes this includes the LLC with several shareholders — that holds assets in the US whose income is reportable and subject to withholding. Since 1 June 2026, an acceptance agent submits such applications together with the part of the partnership agreement that shows the partnership’s name and EIN and the applicant’s name and signature.",
          "The IRS does not issue an ITIN for credit purposes alone. An application based on that is returned — and costs weeks.",
        ],
      },
      {
        typ: "etappen", id: "ablauf", h2: "How the application works",
        etappen: [
          { titel: "Clarify the reason", text: "A US CPA reviews which tax return or which exception supports the application. No sound reason, no application." },
          { titel: "Complete Form W-7", text: "Tick the reason — for non-residents with a US tax return this is usually “b” — name as in the passport, address abroad, birth details, passport details. If an exception applies, its supporting documents are included." },
          { titel: "Have the passport checked", text: "The passport alone is sufficient proof of identity and nationality. It goes to the IRS as the original or as a copy certified by the issuing authority — or a Certifying Acceptance Agent checks it in person and returns it immediately." },
          { titel: "Submit", text: "With the tax return or proof of the exception to the IRS ITIN office in Austin, Texas — or via the acceptance agent." },
          { titel: "Notice", dauer: "about seven weeks", text: "The IRS notifies you of the number in writing (CP 565). Between mid-January and the end of April and for applications from abroad, it takes nine to eleven weeks." },
        ],
      },
      {
        typ: "tabelle", id: "pass", h2: "The passport: three routes",
        kopf: ["Route", "What you do", "Your passport"],
        zeilen: [
          ["Original by post", "Send the passport to the IRS with the application", "is in transit for the duration of the review"],
          ["Certified copy", "Copy certified by the authority that issued the passport", "stays with you"],
          ["Certifying Acceptance Agent", "Appointment with the CAA, who checks the passport and submits the application", "is returned immediately"],
        ],
        fuss: [
          "A notarised copy is not enough for the IRS — the certification must come from the issuing authority.",
          `Acceptance agents charge ${MARKT_EN.acceptanceAgent} for the check and submission (market price, ${FAKTEN_STAND_EN}).`,
        ],
      },
      {
        typ: "text", id: "verfall", h2: "When the ITIN expires",
        absaetze: [
          "An ITIN that does not appear on any US tax return for three consecutive tax years expires on 31 December of the third year. Thus all ITINs that were not used in the years 2022, 2023 and 2024 expired on 31 December 2025.",
          "You renew an expired ITIN with Form W-7 — with the same effort as for the first application. If you want to keep the number, you therefore need an ongoing tax reason.",
        ],
      },
      {
        typ: "karten", id: "karten", h2: "ITIN, account and cards", spalten: 2,
        karten: [
          { tag: "What is true", titel: "Some issuers ask for the ITIN", text: "In practice, the US credit bureaus track a personal credit history by SSN or ITIN. Some card issuers review applications with an ITIN, others require an SSN — each issuer decides this for itself." },
          { tag: "What is not true", titel: "“With an ITIN, cards follow”", text: "An ITIN is a prerequisite, not a commitment. The issuer decides on every application based on history, income and business." },
        ],
      },
      {
        typ: "text", id: "fiaon", h2: "How FIAON Global handles the ITIN",
        absaetze: [
          "The ITIN application is included in every FIAON Global package — with the step that many providers leave out: our US CPA first reviews whether the application holds up, and on what grounds. Without a sound reason, we file no application at all rather than send your passport off on a journey for weeks.",
          "The Certifying Acceptance Agent checks your passport at the appointment and returns it immediately. We submit the application with all enclosures, track it until the notice arrives and place it in your document room — coordinated with your company’s EIN and the first card application.",
        ],
      },
      { typ: "paket", id: "paket", h2: "The ITIN in the package", lead: `Both tax numbers, the company and the first account and card application — ${STRUKTUR} at a fixed price.`, paket: "global_struktur" },
      {
        typ: "hinweis", id: "wissen", h2: "What you need to know",
        punkte: [
          "The ITIN serves tax purposes only. Whoever applies for it takes on the duties on which the application is based — an annual US tax return, for instance.",
          GLOBAL_PFLICHTHINWEIS.en[2],
          "An ITIN does not replace an SSN: separate rules apply to work and social benefits in the US.",
        ],
      },
    ],
    fragen: [
      { f: "Do I need an ITIN for my LLC?", a: "Not for the company’s EIN. You need an ITIN personally if you have to file a tax return in the US or if one of the IRS exceptions applies." },
      { f: "How long does an ITIN application take?", a: `${gross(IRS_EN.itinDauer)}.` },
      { f: "Do I have to send my original passport to get an ITIN?", a: "Not necessarily. Instead of the original, a copy certified by the issuing authority will do, or a Certifying Acceptance Agent checks the passport and returns it immediately." },
      { f: "Can I apply for an ITIN just for a credit card?", a: "No. The IRS issues ITINs only for tax purposes; the application needs a tax return or an exception. Some card issuers ask for the ITIN — they still decide on the card themselves." },
      { f: "Does an ITIN expire?", a: "Yes, if it does not appear on any US tax return for three consecutive tax years — on 31 December of the third year. It is renewed with Form W-7." },
    ],
    paket: "global_struktur",
    weiter: ["/en/business/ein-itin", "/en/business/knowledge/applying-for-an-ein", "/en/business/knowledge/building-us-credit", "/en/business/knowledge/llc-tax-returns"],
    quellen: [Q.itin, Q.w7, Q.caa, Q.itinAusland, Q.itinUebersicht],
  },

  // ─────────────────────────────────────────────────────────────────────────
  // 4 · REGISTERED AGENT UND ADRESSE — die US-Präsenz
  {
    pfad: "/en/business/knowledge/registered-agent-address",
    sprache: "en",
    schwester: "/business/wissen/registered-agent-adresse",
    art: "wissen",
    seo: {
      titel: "Registered agent and US address for an LLC — FIAON Global",
      beschreibung: "Registered agent, business address, phone number: what an LLC needs by law, what institutions require and why a PO box is not enough.",
    },
    stand: S,
    erschienen: S,
    kennung: "FG · 33",
    auge: "Knowledge · US presence",
    h1: "Registered agent and address.",
    h1b: "Your company’s US presence.",
    lead: "Every LLC needs a registered agent in the state of formation from the first day — that is the law. For an account, cards and contracts it needs more: a business address that an institution accepts, and a phone number that someone answers. Three things that are often confused.",
    ziffern: [
      { wert: "Required", label: "in every state, without interruption" },
      { wert: "3 addresses", label: "agent, business address, mailing address" },
      { wert: "4th Friday in September", label: "dissolution in Florida if the annual report is missing" },
    ],
    blick: [
      ["Registered agent", "Accepts lawsuits and official mail — a legal requirement"],
      ["Agent’s address", "Physical, in the state of formation, not a PO box"],
      ["Business address", "Where the company can be reached — institutions check it"],
      ["Mailing address", "Where the IRS sends its letters"],
      ["Phone number", "A US number that someone answers"],
      ["If there is no agent", "Delinquent status with the state; in the worst case, dissolution"],
      ["With FIAON Global", "Agent, address and number included in the first year"],
    ],
    kurz: "The registered agent is the point to which courts and authorities in the state of formation deliver lawsuits and official documents. It needs a physical address in that state and must be reachable during business hours; every state requires one. Its address, however, is not a business address: for an account and cards, institutions require an address at which the company can actually be reached — a PO box is usually not enough for this.",
    bloecke: [
      {
        typ: "text", id: "agent", h2: "What the registered agent does",
        absaetze: [
          "In the US, a lawsuit is not delivered by post but handed over in person — “service of process”. So that this works for a company without an office in the state, every state requires a registered agent: a person or business with an address in the state that accepts lawsuits, letters from authorities and deadlines and passes them on without delay.",
          "Florida requires one in § 605.0113 of the Florida Statutes, Delaware in the Limited Liability Company Act, Wyoming with a physical address in the state. The agent appears with name and address in the public register.",
          "Only someone who lives in the state or has an office there that is staffed during business hours can act as their own agent. For founders from Europe, a commercial agent is the norm.",
        ],
      },
      {
        typ: "tabelle", id: "drei", h2: "Three addresses, three tasks",
        kopf: ["", "Registered agent", "Business address", "Mailing address"],
        zeilen: [
          ["Purpose", "Lawsuits and official mail", "The company’s place of business for institutions and customers", "Letters from the IRS and the states"],
          ["Required", "yes, in the state of formation", "in practice yes, for an account and contracts", "yes, on Form SS-4"],
          ["Where", "in the state of formation, physical", "where the company does business", "where mail reliably reaches you"],
          ["Public", "yes, in the register", "usually yes", "no"],
          ["Typical mistake", "Agent terminated, state not informed", "Agent’s address or PO box used as the place of business", "Letters from the IRS go nowhere"],
        ],
      },
      {
        typ: "text", id: "institute", h2: "Why institutions want a real address",
        absaetze: [
          "US institutions must verify the identity of every customer. For companies, this includes an address: the principal place of business, a local office or another physical location of business (31 CFR 1020.220). An address at which hundreds of companies are registered does not answer this question.",
          "That is why many institutions decline to open accounts for companies whose business address is a registered agent’s address, a PO box or a mere mailbox. Others accept a business address abroad if it fits the business. Each institution decides for itself which address is sufficient.",
        ],
      },
      {
        typ: "text", id: "telefon", h2: "The phone number",
        absaetze: [
          "Card issuers and institutions call — to confirm an application, with queries, in the case of unusual payments. A US number that rings out or only plays a recorded message costs you applications. The number belongs to the company, is reachable and is the same in all documents.",
        ],
      },
      {
        typ: "karten", id: "folgen", h2: "If there is no agent", spalten: 3,
        karten: [
          { tag: "Consequence", titel: "No service of process", text: "If the court cannot find an agent, many states provide for service via the Secretary of State. Anyone who never hears about it misses deadlines — which can end in a default judgment." },
          { tag: "Consequence", titel: "Loss of good standing", text: "Without an agent, the company is no longer “in good standing” with the state. Institutions and contracting parties check this status." },
          { tag: "Consequence", titel: "Administrative dissolution", text: "In Florida, the state can dissolve an LLC without a registered agent (§ 605.0714) — likewise if the annual report is missing: then on the fourth Friday in September." },
        ],
      },
      {
        typ: "text", id: "wechsel", h2: "Changing the agent",
        absaetze: [
          "A change is possible at any time: the new agent declares its consent, and the company reports the change to the state — usually with a separate form and for a fee. Only terminate the old agent once the new one is registered; any gap in between is a gap in service.",
          "If the agent’s name or address changes, this must also be entered in the register. In Florida the change must be reported within thirty days — otherwise administrative dissolution is a risk here too (§ 605.0714).",
        ],
      },
      {
        typ: "text", id: "fiaon", h2: "How FIAON Global handles your US presence",
        absaetze: [
          "With FIAON Global, the US presence is part of the package: registered agent, US business address and US phone number are included in the fixed price for the first year — provided by our team on the ground and aligned from the outset with the documents for the account and cards. Official mail and deadlines land in your document room and in your company’s compliance calendar.",
          GLOBAL_LAUFEND.en,
        ],
      },
      { typ: "paket", id: "paket", h2: "Your US presence in the package", lead: `Agent, address and phone number in the first year — with formation and tax numbers in ${STRUKTUR}.`, paket: "global_struktur" },
      {
        typ: "hinweis", id: "wissen", h2: "What you need to know",
        punkte: [
          "A US address does not move the place of management: for tax purposes, what counts is where the company is actually managed.",
          GLOBAL_PFLICHTHINWEIS.en[0],
          "If the company does business in another state, it generally needs its own registered agent there.",
        ],
      },
    ],
    fragen: [
      { f: "What is a registered agent?", a: "The point of contact that the law requires a US company to have in its state of formation: it accepts lawsuits and official documents and passes them on. Every state requires one." },
      { f: "Can I be my own registered agent?", a: "Only if you live in the state of formation or have an office there that is staffed during business hours. For founders from Europe, a commercial agent is the norm." },
      { f: "Can I use the registered agent’s address as my business address?", a: "Legally it is the agent’s address, not your place of business. Many institutions decline to open an account if this address is given as the business address; each institution decides for itself which address is sufficient." },
      { f: "How much does a registered agent cost?", a: `The market rate is ${MARKT_EN.agent}. With FIAON Global, the agent, US business address and phone number are included in the fixed price for the first year, and after that in the annual care plan for ${globalJahresbetreuungPreisText("en")} a year.` },
      { f: "What happens if my LLC has no registered agent?", a: "It loses its good standing with the state; if the defect persists, the state can dissolve it. Lawsuits may not reach you in time." },
    ],
    paket: "global_struktur",
    weiter: ["/en/business/us-company-formation", "/en/business/knowledge/form-a-us-llc", "/en/business/knowledge/us-bank-account-documents", "/en/business/florida"],
    quellen: [QUELLEN_STAATEN_EN.florida[3], Q.floridaAufloesung, Q.delawareAgent, QUELLEN_STAATEN_EN.wyoming[1], Q.cip],
  },

  // ─────────────────────────────────────────────────────────────────────────
  // 9 · DIE US-STEUERERKLÄRUNG DER LLC — welche Formulare, welche Fristen
  {
    pfad: "/en/business/knowledge/llc-tax-returns",
    sprache: "en",
    schwester: "/business/wissen/llc-steuererklaerung",
    art: "wissen",
    seo: {
      titel: "Foreign-owned LLC tax returns and deadlines — FIAON Global",
      beschreibung: "Pro forma 1120, 1040-NR, 1065, 1120-F, FBAR: which US returns your LLC must file, by structure — with deadlines and the double taxation agreement.",
    },
    stand: S,
    erschienen: S,
    kennung: "FG · 38",
    auge: "Knowledge · Tax return",
    h1: "Your LLC’s US tax return.",
    h1b: "Which forms, which deadlines.",
    lead: "“My LLC pays no tax in the US, so I do not have to file anything there” — this belief leads to penalties every year. Which returns an LLC files depends on who owns it, how it is classified and whether it does business in the US. Here is the overview that almost every founder is missing.",
    ziffern: [
      { wert: "15 April", label: "deadline for Form 5472 with Form 1120" },
      { wert: IRS_EN.koerperschaftsteuer, label: "federal tax on the profits of a corporation" },
      { wert: "$10,000", label: "foreign accounts combined — above this, the FBAR applies" },
    ],
    blick: [
      ["Single-member LLC without US business", "Form 5472 with pro forma Form 1120"],
      ["Single-member LLC with US business", "Plus Form 1040-NR (individual) or 1120-F (GmbH)"],
      ["Several shareholders", "Form 1065, withholding for foreign shareholders"],
      ["Corporation", `Form 1120, ${IRS_EN.koerperschaftsteuer} federal tax`],
      ["Accounts outside the US", `FBAR above ${SCHWELLEN_EN.fbar} in total`],
      ["Home country", "Tax return and section 138 AO — separately from the US"],
      ["With FIAON Global", "First filing by our US CPA included in the fixed price"],
    ],
    kurz: `Which US returns an LLC files depends on three questions: who owns it, how it is classified and whether it does business in the US. An LLC with one foreign shareholder (member) files Form 5472 with a pro forma Form 1120 every year (${IRS_EN.frist5472}). If it earns income from business in the US, the shareholder also declares that income personally — as an individual with Form 1040-NR, as a GmbH with Form 1120-F. An LLC with several shareholders files Form 1065, a corporation Form 1120. If the company holds accounts outside the US totalling more than ${SCHWELLEN_EN.fbar}, the FBAR is added.`,
    bloecke: [
      {
        typ: "tabelle", id: "uebersicht", h2: "The overview: which return, when",
        kopf: ["Structure", "Return", "Deadline for a calendar year"],
        zeilen: [
          ["LLC with one foreign shareholder, without business in the US", "Form 5472 with pro forma Form 1120", IRS_EN.frist5472],
          ["The same LLC with income from US business, owned by an individual", "in addition, the shareholder’s Form 1040-NR", FRISTEN_EN.f1040nr],
          ["The same LLC, owned by a GmbH", "in addition, the GmbH’s Form 1120-F", FRISTEN_EN.f1120f],
          ["LLC with several shareholders", "Form 1065 with statements of each shareholder’s share; withholding on the shares of foreign shareholders (Forms 8804, 8805)", FRISTEN_EN.f1065],
          ["Corporation, including an LLC that has elected corporate treatment on Form 8832", `Form 1120, federal tax ${IRS_EN.koerperschaftsteuer}; plus Form 5472 for a foreign shareholder with 25% or more`, "15 April, extendable to 15 October with Form 7004"],
          [`Any US company with foreign accounts above ${SCHWELLEN_EN.fbar}`, "FBAR (FinCEN Form 114) — to FinCEN, not to the IRS", FRISTEN_EN.fbar],
        ],
        fuss: ["Simplified overview based on the IRS and FinCEN instructions. The states require their own returns depending on the activity."],
      },
      {
        typ: "text", id: "geschaeft", h2: "The decisive question: business in the US?",
        absaetze: [
          "The US taxes foreigners mainly on income that is actually connected with a business in the US (“effectively connected income”). Whether such a business exists is decided by the facts: staff, an office or warehouse on site, agents with authority to conclude contracts, an ongoing activity in the US. Anyone who performs the work for US customers entirely in Europe generally earns no such income — anyone who operates a warehouse there or employs staff usually does.",
          "The double taxation agreement between Germany and the US draws a second line: the US may tax business profits only to the extent that they are attributable to a permanent establishment there (Articles 5 and 7). The US CPA clarifies whether the agreement applies in your case and what information the IRS requires for it.",
        ],
      },
      {
        typ: "text", id: "einzel", h2: "The single-member LLC without business in the US",
        absaetze: [
          "The most common case for founders from Germany, Austria and Switzerland: the LLC belongs to one person, is not classified as a separate taxable entity and has no income from business in the US. It then usually pays no US federal tax on its profit — but it still has to file: every year Form 5472 with a pro forma Form 1120, by fax or post, not electronically.",
          `Even the capital contribution at formation must be reported, as must every withdrawal and every loan between you and the company. The penalty for a missing filing is ${IRS_EN.strafe5472}. The company reports under its EIN; for a shareholder without a US tax number, the IRS permits a reference number.`,
        ],
      },
      {
        typ: "text", id: "mehrere", h2: "Several shareholders: the LLC as a partnership",
        absaetze: [
          `If the LLC has two or more shareholders, it is treated as a partnership for tax purposes. It files Form 1065 and informs each shareholder of their share. To the extent that its profit is connected with business in the US and is attributable to foreign shareholders, it withholds tax and pays it over — ${SCHWELLEN_EN.abzug1446} (Forms 8804, 8805, 8813) — even if it distributes nothing.`,
          "The shareholders then file their own US return and claim a credit for the tax withheld. Since June 2026, the ITIN they need for this has been applied for through the acceptance agent, together with an extract from the partnership agreement.",
        ],
      },
      {
        typ: "text", id: "corporation", h2: "The corporation",
        absaetze: [
          `A corporation — or an LLC that elects under Form 8832 to be treated as a corporation — is a separate taxable entity. It pays federal tax of ${IRS_EN.koerperschaftsteuer} on its profit; on top of that comes state tax, in Florida for example ${STAAT_EN.florida.steuer}.`,
          "If it distributes profits to a shareholder in Germany, the agreement limits the US withholding tax: 5 per cent for companies with at least 10 per cent of the voting rights, otherwise 15 per cent (Article 10). The corporation reports foreign shareholders with 25 per cent or more on Form 5472 as an attachment to its return.",
        ],
      },
      {
        typ: "text", id: "fbar", h2: "Accounts in Europe: the FBAR",
        absaetze: [
          `Under US law, a US company is a US person — even if it belongs to you and is transparent for tax purposes. If it holds accounts outside the US, such as a euro account with a European institution, and their combined balance exceeds ${SCHWELLEN_EN.fbar} at any time during the year, it reports these accounts annually to FinCEN (FBAR, FinCEN Form 114). The deadline is ${FRISTEN_EN.fbar}.`,
          `This particularly affects companies that bring capital to Europe. ${KAPITAL_FREI} That clarification also covers which filings this triggers in the US.`,
        ],
      },
      {
        typ: "text", id: "zuhause", h2: "And at home?",
        absaetze: [
          "Everything here concerns the US. Separately, the company is taxable where it is managed and must be reported to the tax office — in Germany under section 138 of the German Fiscal Code (AO). The tax adviser clarifies which returns are due at home and how tax paid in the US is credited; both sides must fit together.",
        ],
      },
      {
        typ: "text", id: "fiaon", h2: "How FIAON Global handles your deadlines",
        absaetze: [
          "In every FIAON Global package, our US CPA prepares the first annual US filing — Form 5472 with Form 1120 — and the fee is included in the fixed price. Every one of your company’s deadlines is in the compliance calendar: state, registered agent, IRS and, where needed, the FBAR. Before formation, our partner tax adviser reviews which returns are due at home, so that both sides fit together from the start.",
          GLOBAL_LAUFEND.en,
        ],
      },
      { typ: "paket", id: "paket", h2: "The first US filing in the package", lead: `Formation, tax numbers, compliance calendar and the first Form 5472 by our US CPA — ${STRUKTUR}.`, paket: "global_struktur" },
      {
        typ: "hinweis", id: "wissen", h2: "What you need to know",
        punkte: [
          GLOBAL_PFLICHTHINWEIS.en[0],
          GLOBAL_PFLICHTHINWEIS.en[1],
          "This overview does not replace the review of your case by the US CPA and your tax adviser at home.",
        ],
      },
    ],
    fragen: [
      { f: "Does my LLC have to file a tax return in the US?", a: "Yes, almost always. An LLC with one foreign shareholder files Form 5472 with a pro forma Form 1120 every year — even without revenue. With business in the US, further returns are added." },
      { f: "Does my LLC pay tax in the US?", a: `A single-member LLC without business in the US usually pays no US federal tax on its profit. With income from business in the US, the shareholder becomes taxable there, to the extent that the agreement allows; a corporation pays ${IRS_EN.koerperschaftsteuer} federal tax.` },
      { f: "When is my LLC’s US tax return due?", a: `Form 5472 with pro forma 1120 by ${IRS_EN.frist5472}. Form 1065 for several shareholders by ${FRISTEN_EN.f1065}, Form 1040-NR without US wages by 15 June.` },
      { f: "Does my LLC have to file an FBAR for its European bank account?", a: `Yes, if the company’s accounts outside the US together exceed ${SCHWELLEN_EN.fbar} at any time during the year. It then files the FBAR with FinCEN, by ${FRISTEN_EN.fbar}.` },
      { f: "Do I need an ITIN to file a US tax return?", a: "Anyone who files their own US return as an individual — Form 1040-NR, for example — needs an ITIN or SSN. For Form 5472, the company’s EIN is sufficient; for the shareholder, the IRS permits a reference number." },
    ],
    paket: "global_struktur",
    weiter: ["/en/business/us-compliance", "/en/business/knowledge/form-5472", "/en/business/knowledge/us-llc-tax", "/en/business/knowledge/subsidiary-or-branch"],
    quellen: [Q.i5472, Q.i1120, Q.i1040nr, Q.i1065, Q.i1120f, Q.abzug1446, Q.fbar, Q.dba],
  },

  // ─────────────────────────────────────────────────────────────────────────
  // 10 · TOCHTER ODER ZWEIGNIEDERLASSUNG — mit der GmbH in die USA
  {
    pfad: "/en/business/knowledge/subsidiary-or-branch",
    sprache: "en",
    schwester: "/business/wissen/tochter-oder-zweigniederlassung",
    art: "wissen",
    seo: {
      titel: "US subsidiary vs branch: a guide for GmbHs — FIAON Global",
      beschreibung: "Taking your GmbH to the US: a branch, or an LLC or corporation as a subsidiary — liability, tax, withholding tax and filings compared.",
    },
    stand: S,
    erschienen: S,
    kennung: "FG · 39",
    auge: "Knowledge · Structure",
    h1: "Subsidiary or branch?",
    h1b: "Taking your GmbH to the US.",
    lead: "Anyone expanding into the US with an existing business has three routes: the GmbH itself does business there, or it forms an LLC or a corporation as a subsidiary. The choice determines liability, tax in both countries, filings — and how seriously US institutions take the venture.",
    ziffern: [
      { wert: "3 routes", label: "branch, LLC, corporation" },
      { wert: "5%", label: "withholding tax under the agreement with at least 10% of the voting rights" },
      { wert: IRS_EN.koerperschaftsteuer, label: "federal tax of the US corporation" },
    ],
    blick: [
      ["Branch", "The GmbH itself in the US — full liability, Form 1120-F"],
      ["LLC as a subsidiary", "Separate liability; tax-transparent unless it makes an election"],
      ["Corporation as a subsidiary", "Separate taxable entity, the standard for banks and investors"],
      ["Agreement", "Withholding tax on dividends 5%; none under certain conditions"],
      ["Filings", "Form 5472, section 138 AO; for the branch, also BOI"],
      ["Review", "Before formation, in both countries"],
      ["With FIAON Global", "Structure reviewed, subsidiary formed, account prepared"],
    ],
    kurz: `A GmbH (German limited liability company) can do business in the US as a branch or form a subsidiary. The branch is legally the GmbH itself: it is fully liable and declares its US profits on Form 1120-F. An LLC as a subsidiary separates liability but, without an election under Form 8832, is transparent for tax purposes — profits from US business are then likewise attributed to the GmbH. A corporation as a subsidiary is a separate taxable entity (${IRS_EN.koerperschaftsteuer} federal tax); on dividends to the GmbH, the double taxation agreement limits withholding tax to 5 per cent and, under certain conditions, eliminates it entirely.`,
    bloecke: [
      {
        typ: "tabelle", id: "vergleich", h2: "The three routes compared",
        kopf: ["", "Branch", "LLC as a subsidiary", "Corporation as a subsidiary"],
        zeilen: [
          ["Legal status", "the GmbH itself, registered in the state", "a separate company", "a separate company"],
          ["Liability", "the GmbH is fully liable", "limited to the LLC", "limited to the corporation"],
          ["US tax", "the GmbH with Form 1120-F", "without an election: at the GmbH (Form 1120-F); with an election: like a corporation", `its own return, Form 1120, ${IRS_EN.koerperschaftsteuer} federal`],
          ["Profits sent back home", "Branch Profits Tax, limited by the agreement", "depending on the election, like a branch or a corporation", "withholding tax on dividends, limited by the agreement"],
          ["Filing", "BOI report as a foreign company", "Form 5472 with pro forma 1120", "Form 5472 as an attachment to Form 1120"],
          ["With US institutions", "account for a foreign company", "account for a US company", "account for a US company, the standard for loans"],
        ],
        fuss: ["Simplified overview. Classification in Germany follows the comparison with German legal forms (Typenvergleich) and may differ from the US classification."],
      },
      {
        typ: "text", id: "zweig", h2: "The branch: fast, but without a liability shield",
        absaetze: [
          `The GmbH registers in the state as a foreign company (“foreign qualification”) and does business there under its own name. This is quick to set up but draws everything into the GmbH: contracts, liability, litigation in the US. The GmbH files Form 1120-F every year — deadline ${FRISTEN_EN.f1120f}.`,
          "On profits of the branch that do not remain in the US, the US levies the Branch Profits Tax of 30 per cent; the agreement limits it to 5 per cent and excludes it for certain companies (Article 10, paragraphs 9 and 10). And unlike a US company, the GmbH, as a foreign company registered in a state, remains obliged to file a BOI report with FinCEN.",
        ],
      },
      {
        typ: "text", id: "llc", h2: "The LLC as a subsidiary: separate liability, transparent tax",
        absaetze: [
          `If the LLC belongs to the GmbH, liability is separated: creditors of the LLC do not reach through to the GmbH as long as the separation is genuinely maintained. For tax purposes, without an election the LLC is not a separate taxable entity in the US — its profits from US business are attributed to the GmbH, which then files Form 1120-F as if it had a branch. Form 5472 with a pro forma 1120 is also due every year. ${STAAT_EN.florida.llcSteuer}`,
          "With Form 8832, the LLC can elect to be treated as a corporation. In Germany, the classification is decided separately, by comparison with German legal forms (Typenvergleich); if the classification differs between the two countries, special rules apply. This question belongs before formation.",
        ],
      },
      {
        typ: "text", id: "corp", h2: "The corporation as a subsidiary: the standard for larger ventures",
        absaetze: [
          `The corporation is a separate taxable entity: it pays ${IRS_EN.koerperschaftsteuer} federal tax on its profit plus state tax and files Form 1120, with Form 5472 for the GmbH as its shareholder. US institutions and investors know this form best — for loans, leasing and larger facilities it is often the simplest route.`,
          "If the corporation distributes profits to the GmbH, the agreement limits the US withholding tax: 5 per cent if the GmbH holds at least 10 per cent of the voting rights; no withholding tax if it has held at least 80 per cent of the voting rights for twelve months and meets the requirements of the anti-abuse clause (Article 10, paragraph 3, and Article 28). How the dividend is treated for tax purposes at the level of the GmbH in Germany is governed by section 8b of the German Corporate Income Tax Act (KStG) — the tax adviser clarifies the details.",
        ],
      },
      {
        typ: "text", id: "verrechnung", h2: "Transfer prices: what flows between the GmbH and the subsidiary",
        absaetze: [
          "If the GmbH supplies goods, software or services to the subsidiary, the prices must be set as unrelated third parties would agree them. Both countries check this — the US under its own rules, Germany under the arm’s length principle (section 1 of the German Foreign Tax Act, AStG); the protocol to the agreement refers to the OECD guidelines. The subsidiary also reports each of these payments on Form 5472.",
          "Documenting this from the start spares you disputes in two countries.",
        ],
      },
      {
        typ: "etappen", id: "entscheidung", h2: "How the decision is made",
        etappen: [
          { titel: "What do you plan to do in the US?", text: "Sales from Europe, a team of your own on site, a warehouse, projects, investors — the more takes place in the US, the more likely it is that a subsidiary of your own will pay off." },
          { titel: "Who bears the risk?", text: "Contracts and liability in the US belong in a separate company if they could endanger the GmbH." },
          { titel: "Where do the profits flow?", text: "If they stay in the US, the tax there counts; if they flow back, withholding tax and the agreement count." },
          { titel: "Who do you want to bring on board later?", text: "US investors and larger loans usually require a corporation." },
          { titel: "Review in both countries", text: "The tax adviser at home and the US CPA review the structure together before formation." },
        ],
      },
      {
        typ: "text", id: "fiaon", h2: "How FIAON Global builds your US structure",
        absaetze: [
          "For a business, US formation is a structural decision, not a formality. FIAON Global therefore begins with the review: before formation, our partner tax adviser clarifies how the subsidiary is classified in Germany and which notifications are required; our US CPA looks at the US side. Only then does our team in Miami form the company — with formation documents by our partner lawyer, EIN, registered agent, address and phone number.",
          `After that, we prepare the subsidiary’s account and cards, maintain its compliance calendar and, with ${KAPITAL}, build up the history and the key-figures file that a US bank wants to see for a loan.`,
          KAPITAL_FREI,
        ],
      },
      { typ: "paket", id: "paket", h2: "The package for businesses", lead: `Formation, review in both countries, account, card ladder and the documents for a bank loan — ${KAPITAL}.`, paket: "global_kapital" },
      {
        typ: "hinweis", id: "wissen", h2: "What you need to know",
        punkte: [
          GLOBAL_PFLICHTHINWEIS.en[0],
          "A subsidiary is only as strong as its separation from the GmbH: its own accounts, its own contracts, its own bookkeeping.",
          GLOBAL_PFLICHTHINWEIS.en[2],
        ],
      },
    ],
    fragen: [
      { f: "Should my GmbH form an LLC or a corporation in the US?", a: "For sales and smaller ventures, the LLC is often sufficient: it separates liability but, without an election, is transparent for tax purposes. For investors, larger loans and profits that are meant to stay in the US, the corporation is usually the clearer form. The decision belongs before formation — reviewed by the tax adviser and the US CPA." },
      { f: "What is the difference between a subsidiary and a branch in the US?", a: "The branch is the GmbH itself, doing business in the US — it is fully liable. The subsidiary is a separate US company with its own liability, its own tax and its own filings." },
      { f: "What is the US withholding tax on dividends to a GmbH?", a: "Under the agreement, 5 per cent if the GmbH holds at least 10 per cent of the voting rights, otherwise 15 per cent. If it has held at least 80 per cent for twelve months and meets the conditions of the anti-abuse clause, no withholding tax is due." },
      { f: "Does a branch in the US have to file a BOI report?", a: "Yes. Since August 2026, only companies formed in the US are exempt; a GmbH that registers in a state remains obliged to report as a foreign company." },
      { f: "Do I have to report a US subsidiary to the German tax office?", a: "Yes. The formation or acquisition of an interest in a foreign company must be notified in Germany under section 138 of the German Fiscal Code (AO) — together with the tax return." },
    ],
    paket: "global_kapital",
    weiter: ["/en/business/us-subsidiary", "/en/business/knowledge/llc-vs-corporation", "/en/business/knowledge/llc-tax-returns", "/en/business/from-germany"],
    quellen: [Q.dba, Q.i1120f, Q.i5472, Q.f8832, Q.boi, Q.ao138, Q.astg1, Q.kstg8b],
  },
];
