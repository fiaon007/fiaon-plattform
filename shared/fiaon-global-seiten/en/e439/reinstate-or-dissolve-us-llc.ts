// ═══════════════════════════════════════════════════════════════════════════
// FIAON GLOBAL — KNOWLEDGE: REINSTATE, HAND OVER OR DISSOLVE A US LLC
// (27.10.2026, E-439, FG · 50)
//
// Die englische Schwester von ../../e439/llc-retten-oder-aufloesen.ts. Für Inhaber
// einer LLC, die bei einem anderen Dienst gegründet wurde und still geworden ist.
// Hauptsuchwort „dissolve US LLC non-resident“ (Titel, H1, Kurz, erster Absatz, H2
// „Dissolve a US LLC as a non-resident: …“). Recherche: .arbeit/recherche/kw_en.md (5.3).
// Britisches Englisch, dieselben Bausteine in derselben Reihenfolge, dieselben ids
// und dieselbe Zahl an Absätzen, Punkten, Zeilen, Spalten, Etappen, Karten, Fragen,
// Blick-Zeilen und Ziffern; Quellen mit denselben Adressen in derselben Reihenfolge
// (englische Titel, fakten-en.ts wo vorhanden).
//
// Inhaltlich identisch mit der deutschen Fach- und Rechtsprüfung vom 27.10.2026:
//   · Florida Statutes 2026 § 605.0714/0715/0707/0114/0115/0212/0213, § 607.193.
//   · Wyoming Secretary of State: FAQ (60 Tage, zwei Jahre) und Gebührenordnung.
//   · Delaware Code Title 6 § 18-1107 bis 18-1109, § 18-104(d), § 18-203;
//     Gebührenordnung 01.08.2026; Title 8 § 510.
//   · IRS: Instructions for Form 5472 und 1120, Closing a Business, Delinquent
//     International Information Return Submission Procedures, Form 8822-B.
//   · 26 U.S.C. § 6038A(d), § 6501(c)(8); 26 CFR § 1.6038A-4(b).
//   · § 138 Abs. 2 und 5 AO, § 10 AO, § 1 KStG, § 16 Abs. 3 und § 17 Abs. 1, 4 EStG,
//     BMF-Schreiben vom 19.03.2004.
// Deutsche Rechtsbegriffe nur als erklärtes Stichwort („type comparison
// (Typenvergleich)“, „section 138 of the German Fiscal Code (AO)“).
//
// Wortwand EN: kein „up to“ („all annual tax owed, including that for the current year“
// statt „up to and including“),
// keine Frist mit Ziffer als Zusage (gesetzliche Fristen in Worten: „within thirty
// days“), kein „recommend“, „advice“ nicht verwendet, keine Strafbefreiung als Zusage,
// kein Steuermodell. „Business consultancy“ als Selbstbezeichnung (E-439).
// Wie im Deutschen ohne GLOBAL_KAPITAL_FREI (kein Kapital-Thema) und ohne
// GLOBAL_GELD_ZURUECK (Baustein „fiaon“ hat im Deutschen fünf Absätze ohne ihn).
// ═══════════════════════════════════════════════════════════════════════════
import type { GlobalQuelle, GlobalSeite } from "../../typen";
import { GLOBAL_PFLICHTHINWEIS, GLOBAL_ROLLEN, globalPaket } from "../../../fiaon-global";
import { QUELLEN_WISSEN_EN as Q, QUELLEN_RECHT_EN as R, QUELLEN_STAATEN_EN, STAAT_EN, IRS_EN } from "../../fakten-en";

const S = "2026-10-27";
const FL = STAAT_EN.florida;
const WY = STAAT_EN.wyoming;
const DL = STAAT_EN.delaware;

/** Erster Buchstabe groß — für Tabellenzellen, die mit einem Wert aus fakten-en.ts beginnen. */
const gross = (t: string) => t.charAt(0).toUpperCase() + t.slice(1);

/** IRS penalty without “per form per year” — for the key figure. */
const STRAFE_5472 = IRS_EN.strafe5472.split(" per ")[0];

const STRUKTUR = globalPaket("global_struktur")?.en.name ?? "Global Structure";

/** Quellen dieses Beitrags mit englischen Titeln — dieselben Adressen wie im Deutschen (geprüft am 27.10.2026). */
const QUELLEN: Record<string, GlobalQuelle> = {
  fl0707: { titel: "Florida Statutes 2026, § 605.0707 — articles of dissolution", url: "https://www.flsenate.gov/Laws/Statutes/2026/605.0707" },
  fl0715: { titel: "Florida Statutes 2026, § 605.0715 — reinstatement after administrative dissolution", url: "https://www.flsenate.gov/Laws/Statutes/2026/605.0715" },
  fl0114: { titel: "Florida Statutes 2026, § 605.0114 — change of registered agent", url: "https://www.flsenate.gov/Laws/Statutes/2026/605.0114" },
  fl0115: { titel: "Florida Statutes 2026, § 605.0115 — resignation of registered agent", url: "https://www.flsenate.gov/Laws/Statutes/2026/605.0115" },
  deAufloesung: { titel: "Delaware Code, Title 6, Chapter 18, Subchapter II — certificate of cancellation (§ 18-203)", url: "https://delcode.delaware.gov/title6/c018/sc02/index.html" },
  de510: { titel: "Delaware Code, Title 8, Chapter 5 — § 510, charter void for corporations", url: "https://delcode.delaware.gov/title8/c005/index.html" },
  irsSchliessen: { titel: "IRS — Closing a business", url: "https://www.irs.gov/businesses/small-businesses-self-employed/closing-a-business" },
  irsNachholen: { titel: "IRS — Delinquent international information return submission procedures", url: "https://www.irs.gov/individuals/international-taxpayers/delinquent-international-information-return-submission-procedures" },
  usc6038A: { titel: "26 U.S. Code § 6038A — Information with respect to certain foreign-owned corporations", url: "https://www.law.cornell.edu/uscode/text/26/6038A" },
  cfr6038A4: { titel: "26 CFR § 1.6038A-4 — monetary penalty, reasonable cause", url: "https://www.law.cornell.edu/cfr/text/26/1.6038A-4" },
  usc6501: { titel: "26 U.S. Code § 6501 — Limitations on assessment and collection", url: "https://www.law.cornell.edu/uscode/text/26/6501" },
  estg16: { titel: "Section 16 German Income Tax Act (EStG) — sale and discontinuation of a business", url: "https://www.gesetze-im-internet.de/estg/__16.html" },
  estg17: { titel: "Section 17 German Income Tax Act (EStG) — sale and liquidation of shares in corporations", url: "https://www.gesetze-im-internet.de/estg/__17.html" },
};

export const SEITE: GlobalSeite = {
  pfad: "/en/business/knowledge/reinstate-or-dissolve-us-llc",
  sprache: "en",
  schwester: "/business/wissen/llc-retten-oder-aufloesen",
  art: "wissen",
  seo: {
    titel: "Dissolve or rescue a US LLC as a non-resident — FIAON Global",
    beschreibung: "Missed annual report, no Form 5472, agent resigned: how a non-resident can reinstate, hand over or cleanly dissolve a US LLC — with primary sources.",
  },
  stand: S,
  erschienen: S,
  kennung: "FG · 50",
  auge: "Knowledge · Existing LLC",
  h1: "Dissolve or rescue a US LLC as a non-resident.",
  h1b: "Review first, then decide.",
  lead: "Many entrepreneurs from Germany, Austria and Switzerland formed a US LLC through an online service — and then it went quiet: no annual report, no Form 5472, the registered agent resigned, IRS letters going to an old address. This guide sets out what applies in Florida, Wyoming and Delaware in that situation, how you can dissolve, reinstate or hand over such a US LLC as a non-resident, and what the IRS expects along the way.",
  ziffern: [
    { wert: STRAFE_5472, label: "possible penalty for each missing Form 5472, per year" },
    { wert: "2 years", label: "to reinstate in Wyoming" },
    { wert: "4th Friday in September", label: "dissolution in Florida without an annual report" },
  ],
  blick: [
    ["First step", "Establish the status in the state register and the position with the IRS"],
    ["Rescue", "Reinstatement with all outstanding reports and fees"],
    ["Hand over", "New registered agent, new address on file with the IRS"],
    ["Dissolve", "Dissolution with the state, final return, closing the EIN account"],
    ["Legacy issues", "Missing Forms 5472 stay open — even after cancellation"],
    ["At home", "Notification under section 138 AO and the tax consequences of dissolution"],
    ["With FIAON Global", "Review, catching up, handover or dissolution — one contact instead of eight"],
  ],
  kurz: `To dissolve a US LLC as a non-resident, you file the dissolution with the state (Articles of Dissolution in Florida and Wyoming, a Certificate of Cancellation in Delaware), file the last return with the IRS as a final return and have the EIN account closed by letter. If the state has already dissolved the LLC administratively, it can be reinstated: in Florida at any time, in Wyoming only in the first two years. No cancellation cures missed Forms 5472; the IRS can assess ${IRS_EN.strafe5472}, and the IRS alone decides on a reasonable cause statement submitted later.`,
  bloecke: [
    {
      typ: "text", id: "lage", h2: "When it has gone quiet: three routes for an existing LLC",
      absaetze: [
        "For non-residents who want to dissolve or rescue a US LLC, the situation is often the same. The company was formed cheaply through an online service, the registered agent was included for the first year, and after that no more mail arrived. The annual report to the state is missing, the annual filing with the IRS was never made, and the address the IRS has on file belongs to a service you no longer have anything to do with.",
        "There are three routes for such a company. You rescue it if it is still needed — because an account, a merchant account or contracts depend on it, for instance. You place it in new hands if it is to carry on, but without the old service. Or you dissolve it cleanly if it no longer serves a purpose. Which route fits depends on two questions: what does the state register show, and what is missing at the IRS?",
        "Doing nothing is usually the most expensive choice. Administrative dissolution by the state does not make a company disappear: in Florida, for example, it continues to exist for the purpose of winding up, and its outstanding filings with the IRS remain open in every state.",
      ],
    },
    {
      typ: "tabelle", id: "staaten", h2: "LLC administrative dissolution: Florida, Wyoming and Delaware",
      lead: "Each state sets its own rules for the annual report, administrative dissolution and reinstatement. The rules of the three states at a glance, as at October 2026.",
      kopf: ["", "Florida", "Wyoming", "Delaware"],
      zeilen: [
        ["Annual duty", `${gross(FL.jahrName)}: ${FL.jahr}; deadline: ${FL.jahrFrist}`, `${gross(WY.jahrName)}: ${WY.jahr}; deadline: ${WY.jahrFrist}`, `${gross(DL.jahrName)}: ${DL.jahr}; deadline: ${DL.jahrFrist}`],
        ["If late", gross(FL.jahrVerzug), "Delinquent from the second day of the following month", `${gross(DL.jahrVerzug)}; the LLC loses its “good standing” status`],
        ["Administrative dissolution", "On the fourth Friday in September if the annual report is missing; if the agent or fees are missing, 60 days after the state’s notice", "60 days after the annual report falls due", "Cancellation if the annual tax remains unpaid for three years; earlier if the agent resigns and no new agent is designated within thirty days"],
        ["Reinstatement", "At any time; $100 plus all outstanding fees — if the missing annual report was the reason, the $400 supplemental fee does not apply; takes effect retroactively to the date of dissolution", "Only in the first two years after dissolution; $100 plus any outstanding License Tax, $350 if the registered agent was missing", "Certificate of Revival, $220 plus the outstanding annual tax with penalties and interest; takes effect as if the LLC had never been cancelled"],
        ["Voluntary dissolution", "Articles of Dissolution, $25", "Articles of Dissolution, $60", "Certificate of Cancellation after winding up, $220 plus all annual tax owed, including that for the current year"],
        ["New registered agent", "Statement of Change with the new agent’s written acceptance, $25", "Designation of agent and address, $5", "Change of agent, $50"],
      ],
      fuss: [
        `State fees under statute and the states’ fee schedules, as at October 2026. Delaware: ${DL.jahrAlt}`,
        "For corporations in Delaware, the corresponding status is called “void”: the charter becomes void if franchise tax or the annual report remains outstanding for one year (8 Del. C. § 510).",
      ],
    },
    {
      typ: "text", id: "aufgeloest", h2: "What a dissolved LLC may still do",
      absaetze: [
        "In Florida, an LLC that the state has dissolved administratively continues to exist — but only in order to be wound up. It may wind up its affairs, realise and distribute its assets and notify creditors — nothing more (§ 605.0714). Its registered agent remains authorised to accept service of process.",
        "In day-to-day business this has tangible consequences. Banks, payment platforms and counterparties can check the status in the register at any time; a company listed there as dissolved or delinquent cannot demonstrate good standing. In Delaware, an LLC that has not paid its annual tax cannot obtain a certificate of good standing and cannot maintain an action in the state’s courts. In Florida, a company without an annual report can neither bring nor defend an action in court until the report has been filed and the fees paid (§ 605.0212).",
        "In Florida, the name is reserved against use by others for one year after dissolution. If another company has taken it after that, reinstatement is only possible under a new name (§ 605.0715). If you want to keep your company, you lose room for manoeuvre with every month.",
      ],
    },
    {
      typ: "etappen", id: "reinstatement", h2: "Reactivating an LLC: reinstatement step by step",
      lead: "Restoring a dissolved LLC is called reinstatement; in Delaware, revival. In Florida it expressly takes effect retroactively to the date of dissolution (§ 605.0715); in Delaware, the company is then treated as if it had never been cancelled (6 Del. C. § 18-1109).",
      etappen: [
        { titel: "Register extract and deadlines", text: "Status, date of and reason for dissolution, outstanding annual reports — all from the state register. In Wyoming, the date decides whether reinstatement is still possible: it is open only in the first two years." },
        { titel: "Secure the registered agent", text: "No agent, no reinstatement. In Florida, the agent co-signs the application; a new agent confirms in writing that it accepts the appointment (§ 605.0114)." },
        { titel: "Application with all details", text: "Florida requires the name, the address of the principal office and the mailing address, the date of formation, the EIN and at least one person authorised to manage the company. All outstanding fees and penalties are charged at the rates in force on the date of the application." },
        { titel: "Clarify the position with the IRS", text: "Which years are missing, which address does the IRS write to, who is recorded as the responsible party? The company reports changes on Form 8822-B; a change of responsible party must reach the IRS within sixty days." },
        { titel: "Catch up on filings", text: `Missing Forms 5472 with a pro forma Form 1120 for every open year, each with a reasonable cause statement. After that, every deadline goes into the compliance calendar: the annual report to the state and Form 5472 by ${IRS_EN.frist5472}.` },
      ],
    },
    {
      typ: "text", id: "agent", h2: "Registered agent resigned: what matters now",
      absaetze: [
        "If a registered agent resigns, it files a statement with the state. In Florida, it sends the company a copy to its current mailing address; its appointment ends on the 31st day after the filing, or earlier once a successor has been filed (§ 605.0115). In Delaware, it must notify the company in writing at least thirty days before filing (§ 18-104(d)). If the mailing address is with the old service itself, the notice may not reach the owner.",
        "Without an agent, time runs against the company. In Florida, a missing agent is a ground for administrative dissolution in its own right. In Delaware, the LLC is cancelled if no new agent is designated within thirty days of the resignation being filed (§ 18-104(d)). If Wyoming dissolves the LLC for this reason, reinstatement costs $350 instead of $100.",
        "The change itself is simple if it happens in time: the new agent accepts the appointment in writing, and the company files the change with the state — in Florida with a Statement of Change. Only then do you end the old service. At the same time, the address on file with the IRS should be updated so that the authority’s letters reach you.",
      ],
    },
    {
      typ: "text", id: "form5472", h2: "Catching up on Form 5472: penalty, reasonable cause, limitation period",
      absaetze: [
        `If an LLC has a single foreign owner, it reports its transactions with that owner to the IRS every year — on Form 5472 with a pro forma Form 1120, even without revenue. For every year in which the filing is missing, the IRS can assess ${IRS_EN.strafe5472}, and likewise if the required records are missing (26 U.S.C. § 6038A(d)). Under the IRS instructions, a substantially incomplete Form 5472 is treated as not filed. If the filing is still outstanding more than 90 days after a notice from the IRS, a further $25,000 is added for each additional 30-day period or part of one. Neither the statute nor the IRS instructions set a ceiling.`,
        "Cancellation by the state does not end these obligations. The IRS closes the EIN account only once all required returns have been filed and all taxes paid. And as long as the information is missing, the clock does not run out either: the period in which the IRS can assess tax for the year concerned ends no earlier than three years after it has received the information; if the failure was due to reasonable cause, this applies only to the related items (26 U.S.C. § 6501(c)(8)). A missing Form 5472 therefore does not go away by waiting.",
        "For catching up, the IRS has its own procedure for delinquent international information returns. It is open to anyone who is not under examination, is not the subject of a criminal investigation and has not yet been contacted by the IRS about these returns. Each return can be accompanied by a statement of reasons, the reasonable cause statement. The IRS states plainly that penalties may be assessed under the normal rules, even without the statement being considered at first; it may then be necessary to respond to IRS notices and submit the statement again.",
        "Whether a penalty is waived is decided by the IRS case by case. Under the regulations on § 6038A, a failure is excused if the company acted in good faith and for reasonable cause; it sets out the facts in writing, under penalties of perjury. For small companies with gross receipts of no more than US$20 million a year that were unaware of the requirement, have limited contact with the United States and comply promptly and fully with all IRS requirements, the IRS applies this exception liberally (26 CFR § 1.6038A-4(b)). Even so, nobody can commit to a particular outcome.",
        "Filing is on paper or by fax: a foreign-owned LLC cannot file Form 5472 electronically. The pro forma Form 1120 carries the note “Foreign-owned U.S. DE” across the top, and only the name, the address and items B and E are completed. In the final year, the “Final return” box in item E is ticked.",
      ],
    },
    {
      typ: "etappen", id: "aufloesen", h2: "Dissolve a US LLC as a non-resident: the order that holds",
      lead: "A clean dissolution closes three files: the one with the state, the one with the IRS and the one with your tax office at home. The order decides whether anything remains open at the end.",
      etappen: [
        { titel: "Stocktake", text: "Status in the register, outstanding annual reports and fees, missing filings with the IRS, accounts, merchant accounts and ongoing contracts in the company’s name." },
        { titel: "Resolution and winding up", text: "The members resolve to dissolve in line with the operating agreement. Then the company is wound up: collect receivables, settle liabilities, close accounts, distribute the remaining assets to the members." },
        { titel: "Filings with the IRS", text: "Catch up on all open years and file the return for the last year as a final return. If the LLC has several members, it files Form 1065 as its final return, with a “final K-1” for each member. If it has elected on Form 8832 to be classified as a corporation, Form 966 is also required." },
        { titel: "Dissolution with the state", text: "In Florida, Articles of Dissolution (§ 605.0707); in Wyoming, Articles of Dissolution; in Delaware, once winding up is complete, the Certificate of Cancellation (§ 18-203), together with all annual tax owed, including that for the current year (§ 18-1107). If the company has already been dissolved administratively, we first clarify with the state and, where needed, with a partner lawyer which route is open." },
        { titel: "Close the EIN account", text: "A letter to the IRS in Cincinnati, OH 45999, with the company’s full name, EIN, address and the reason, plus a copy of the notice that assigned the EIN, if you still have it. The IRS closes the account only once all required returns have been filed and all taxes paid." },
        { titel: "Finish at home", text: "Clarify the tax consequences of the dissolution, submit the notification under section 138 AO and keep all documents — for the limitation periods in the US and at home." },
      ],
    },
    {
      typ: "text", id: "dach", h2: "The consequences in Germany, Austria and Switzerland",
      absaetze: [
        "What applied to formation also applies to the end. A US company that is managed from the German-speaking countries is taxable there — in Germany, because its place of management is in Germany (section 10 of the German Fiscal Code, AO), which can make the company subject to unlimited corporate income tax liability (section 1 of the German Corporate Income Tax Act, KStG). Its dissolution is therefore not a purely American matter.",
        "The notification to the tax office also covers the end. Under section 138(2), first sentence, no. 2 AO, giving up an interest in a foreign partnership must be reported; no. 3 covers the acquisition and disposal of interests in foreign corporations where this results in a holding of at least 10 per cent or the acquisition costs of all holdings exceed €150,000. The notification is made with the tax return for the year, and no later than 14 months after the end of that year (section 138(5) AO).",
        "For tax purposes, what matters is how the tax office classifies the LLC: as a corporation or as a partnership, based on a type comparison (Typenvergleich); the classification chosen in the US does not decide this (German Federal Ministry of Finance, letter of 19 March 2004). If it counts as a corporation, its dissolution is treated as a sale for a member who holds the shares privately and held at least 1 per cent at some point in the last five years (section 17(1) and (4) of the German Income Tax Act, EStG). If it counts as a partnership carrying on a commercial business, the winding up may be taxable as the discontinuation of that business (section 16(3) EStG). Austria and Switzerland have their own rules.",
        "Our partner tax adviser clarifies with you what applies in your case before the dissolution is filed with the state. A dissolution that nobody at home knows about is only half done.",
      ],
    },
    {
      typ: "karten", id: "wege", h2: "Rescue, hand over or dissolve?", spalten: 3,
      karten: [
        { tag: "Rescue", titel: "The company is still needed", text: "An account, a merchant account, contracts or a trademark depend on it. Then secure the agent and the status first, and catch up on the filings after that." },
        { tag: "Hand over", titel: "It should carry on, without the old service", text: "A new registered agent via a change filing, a new address with the IRS, a compliance calendar — and someone who keeps track of it every year." },
        { tag: "Dissolve", titel: "It no longer serves a purpose", text: "First outstanding filings and fees, then winding up, then dissolution with the state and the letter to the IRS. Doing nothing is not a dissolution." },
      ],
    },
    {
      typ: "text", id: "fiaon", h2: "How FIAON Global takes over your existing LLC",
      absaetze: [
        "FIAON Global is a business consultancy for entrepreneurs from Germany, Austria and Switzerland with a US company. Our principle also applies to a company formed elsewhere: one contact instead of eight. You give us what you have — formation documents, the EIN letter, letters from the IRS and the state — and we handle all dealings with the state and the IRS.",
        "First we review: status in the register, registered agent, outstanding annual reports and fees, which years are missing at the IRS, which address the IRS writes to and which accounts and platforms depend on the company. You receive the result in writing — the routes that are open, the state fees and our fixed price — before anything is filed. The legal and tax consequences of each route are clarified by our partner lawyer and partner tax adviser under your engagement.",
        "Then we catch up on everything outstanding. With your power of attorney, we file the applications on your behalf: reinstatement, change of registered agent, overdue annual reports, changes with the IRS on Form 8822-B. The outstanding Forms 5472 with pro forma Form 1120 are prepared by our US CPA under your engagement, with a reasonable cause statement for each year; our partner tax adviser clarifies the consequences at home. Partner tax advisers, US CPAs and partner lawyers act under your engagement, and their fees for the agreed services are included in the fixed price.",
        "If the company is to go, we dissolve it cleanly: winding up according to plan, dissolution with the state — only on your instruction in text form —, the final return to the IRS and the letter on the EIN account. You close accounts with banks and payment platforms yourself; we prepare every step for this. Afterwards, every document and every letter from the authorities is in your document room.",
        "Your contracting party is FIAON LTD in London; our team on the ground in Miami attends appointments for you, and Zurich is our partner location. If the company is to carry on, we keep track of deadlines and filings every year on request — through the annual care plan, voluntary and without automatic renewal.",
      ],
    },
    { typ: "paket", id: "paket", h2: "Starting afresh, properly set up", lead: `If you want to form a new company after the clean-up: company, EIN, preparation of the ITIN, registered agent, a US address and US phone number for the first year and the first annual US filing by our US CPA — ${STRUKTUR}.`, paket: "global_struktur" },
    {
      typ: "hinweis", id: "wissen", h2: "What you need to know",
      punkte: [
        "Cancellation by the state does not end outstanding obligations with the IRS. Missing Forms 5472 remain open, and the period for an assessment ends no earlier than three years after the information is received.",
        "Whether the IRS assesses a penalty or refrains from doing so is decided by the IRS alone. A reasonable cause statement can help; nobody can commit to the outcome.",
        "The state decides on reinstatement. In Wyoming it is ruled out after two years; in Florida, a name that has since been taken may make a new name necessary.",
        "FIAON has no control over your company’s accounts or balances. You close accounts with banks and payment platforms yourself.",
        `${GLOBAL_ROLLEN.en.fiaon} What applies legally and for tax purposes in an individual case is clarified by the partner lawyer and partner tax adviser under your engagement.`,
        GLOBAL_PFLICHTHINWEIS.en[0],
        GLOBAL_PFLICHTHINWEIS.en[1],
      ],
    },
  ],
  fragen: [
    { f: "How do I dissolve a US LLC as a non-resident?", a: "In three steps: catch up on outstanding annual reports, fees and filings and wind up the company; then file the dissolution with the state (Articles of Dissolution in Florida and Wyoming, a Certificate of Cancellation in Delaware); finally, file the final return with the IRS and send a letter asking the IRS to close the EIN account." },
    { f: "What does it cost to dissolve a US LLC?", a: `With the state itself, little: $25 in Florida, $60 in Wyoming, $220 in Delaware plus all annual tax owed, including that for the current year (as at October 2026). It becomes expensive when years are missing: outstanding annual reports, fees and above all missed Forms 5472, for which the IRS can assess ${IRS_EN.strafe5472}.` },
    { f: "Can I reinstate a dissolved LLC?", a: "In many cases, yes. Florida allows reinstatement at any time, for $100 plus all outstanding fees; it takes effect retroactively to the date of dissolution. Wyoming allows it only in the first two years. Delaware restores a cancelled LLC with a Certificate of Revival, for $220 plus the outstanding annual tax with penalties and interest." },
    { f: "I forgot to file Form 5472 — what now?", a: `Catch up, for every open year with a pro forma Form 1120 and a reasonable cause statement. If the IRS has not yet contacted you about these returns and you are neither under examination nor under criminal investigation, you can use the IRS procedure for delinquent international information returns. The penalty of ${IRS_EN.strafe5472} can still be assessed; the IRS decides on the statement.` },
    { f: "Do I need to have the EIN cancelled when I dissolve the LLC?", a: "In the words of the IRS, the EIN remains the company’s permanent tax identification number. What is closed is its account with the IRS: by letter to the IRS in Cincinnati with the name, EIN, address and the reason. That is only possible once all returns have been filed and all taxes paid." },
    { f: "My registered agent has resigned — what now?", a: "Designate a new agent promptly. In Florida, the old agent’s appointment ends on the 31st day after its resignation is filed; without an agent, administrative dissolution looms. In Delaware, the LLC is cancelled if no successor is filed within thirty days. The new agent accepts the appointment in writing, and the company files the change with the state." },
    { f: "What do I have to report in Germany when I dissolve the LLC?", a: "That depends on the classification. Giving up an interest in a foreign partnership must be reported under section 138(2) AO, as must the disposal of an interest in a foreign corporation above the statutory thresholds — with the tax return, no later than 14 months after the end of the year. The partner tax adviser clarifies the tax consequences in advance." },
    { f: "Does FIAON Global also take over an LLC that was formed elsewhere?", a: "Yes. We first review the register, the registered agent and the position with the IRS and give you the routes and a fixed price in writing. After that, we make the applications with your power of attorney, our US CPA catches up on outstanding filings under your engagement, and we file a dissolution only on your instruction in text form." },
  ],
  paket: "global_struktur",
  weiter: ["/en/business/knowledge/form-5472", "/en/business/knowledge/registered-agent-address", "/en/business/knowledge/us-llc-german-resident", "/en/business/knowledge/us-llc-disadvantages"],
  quellen: [
    Q.floridaAufloesung,
    QUELLEN.fl0715,
    QUELLEN.fl0707,
    QUELLEN.fl0114,
    QUELLEN.fl0115,
    QUELLEN_STAATEN_EN.florida[0],
    QUELLEN_STAATEN_EN.florida[1],
    QUELLEN_STAATEN_EN.florida[2],
    QUELLEN_STAATEN_EN.wyoming[0],
    QUELLEN_STAATEN_EN.wyoming[1],
    QUELLEN_STAATEN_EN.delaware[0],
    QUELLEN_STAATEN_EN.delaware[1],
    Q.delawareAgent,
    QUELLEN.deAufloesung,
    QUELLEN.de510,
    Q.i5472,
    Q.i1120,
    QUELLEN.usc6038A,
    QUELLEN.cfr6038A4,
    QUELLEN.usc6501,
    QUELLEN.irsNachholen,
    QUELLEN.irsSchliessen,
    Q.f8822b,
    Q.ao138,
    R.ao10,
    R.kstg1,
    QUELLEN.estg17,
    QUELLEN.estg16,
    R.bmf,
  ],
};
