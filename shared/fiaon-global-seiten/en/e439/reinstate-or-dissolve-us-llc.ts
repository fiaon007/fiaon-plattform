// ═══════════════════════════════════════════════════════════════════════════
// FIAON GLOBAL — KNOWLEDGE: REINSTATE, HAND OVER OR DISSOLVE A US LLC
// (27.10.2026, E-439, FG · 50)
//
// Die englische Schwester von ../../e439/llc-retten-oder-aufloesen.ts. Für Inhaber
// einer LLC, die bei einem anderen Dienst gegründet wurde und still geworden ist.
// Hauptsuchwort „dissolve US LLC non-resident“ (Titel, H1, Kurz, erster Absatz, erste
// Frage; H2 „Dissolve a US LLC: the six steps“). Recherche: .arbeit/recherche/kw_en.md (5.3).
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
// GLOBAL_GELD_ZURUECK.
//
// E-510 (13.11.2026, language guide FIAON Global): ONE section about us (“What FIAON
// Global handles”: what we do · your part · condition), built like the German page. The
// fixed sentences come from shared/fiaon-global-saetze.ts (personal route: “We review
// your documents first. You then receive your proposal.”, S8) and
// are not typed here. No “team on the ground”, no partner location, no partner shown at
// work in the present tense; our own charge is a fee, our paper a proposal. The factual
// part (statutes, fees and deadlines of third parties with sources) is unchanged.
// Second pass on the same day (the whole article, sentence by sentence): statement,
// condition, decision-maker; short main clauses; plain titles instead of a question.
// “Rescue” is “reinstate” throughout (as in the path). Statutory deadlines are written
// as words. FIAON appears only in the summary box, the section “fiaon”, the card, the
// last question and the notice; “we first clarify” is gone, and the partner tax adviser
// sentence now sits in the section “fiaon” instead of the factual part. Figures,
// statutes, fees and sources are unchanged.
// ═══════════════════════════════════════════════════════════════════════════
import type { GlobalQuelle, GlobalSeite } from "../../typen";
// E-509 (12.11.2026): EIN Produkt statt vier Pakete — kein Paketname. Für eine bestehende Gesellschaft steht das Honorar nach der
// Prüfung der Unterlagen im persönlichen Angebot (E-506): “proposal”, “fee”.
import { GLOBAL_PFLICHTHINWEIS } from "../../../fiaon-global";
import { SCHRITTE_KOPF, beleg, satz, weitererSatz } from "../../../fiaon-global-saetze";
import { EIN_PRODUKT } from "../../ein-produkt";
import { QUELLEN_WISSEN_EN as Q, QUELLEN_RECHT_EN as R, QUELLEN_STAATEN_EN, STAAT_EN, IRS_EN } from "../../fakten-en";

const S = "2026-10-27";
const FL = STAAT_EN.florida;
const WY = STAAT_EN.wyoming;
const DL = STAAT_EN.delaware;

/** Erster Buchstabe groß — für Tabellenzellen, die mit einem Wert aus fakten-en.ts beginnen. */
const gross = (t: string) => t.charAt(0).toUpperCase() + t.slice(1);

/** IRS penalty without “per form per year” — for the key figure. */
const STRAFE_5472 = IRS_EN.strafe5472.split(" per ")[0];

const P = EIN_PRODUKT.en;
/** The names of the fixed parts: “Your part”, “Condition” (language guide 2.1). */
const TEIL = SCHRITTE_KOPF.en.teile;
/** The personal route for an existing company (language guide 2.6) — fixed wording. */
const UNTERLAGEN_ZUERST = weitererSatz("UNTERLAGEN-ZUERST", "en");
/** Who deals with tax questions — the same wording as on the country pages (en/zielgruppen.ts). */
const STEUERFRAGEN = "Tax questions rest with partner tax advisers acting in their own professional capacity";

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
    titel: "Dissolve or reinstate a non-resident US LLC — FIAON Global",
    beschreibung: "Dissolve or reinstate a US LLC as a non-resident: what applies in Florida, Wyoming and Delaware, the statutory deadlines and the IRS rules on Form 5472.",
  },
  stand: "2026-11-13",
  erschienen: S,
  kennung: "FG · 50",
  auge: "Knowledge · Existing LLC",
  h1: "Dissolve or reinstate a non-resident US LLC.",
  h1b: "Review first, then decide.",
  lead: "This page explains how owners from Germany, Austria and Switzerland dissolve or reinstate a US LLC as non-residents. The usual cause is a missing annual report, a missing Form 5472 or the resignation of the registered agent. It sets out what applies in Florida, Wyoming and Delaware, which deadline the statute sets and which authority decides.",
  ziffern: [
    { wert: STRAFE_5472, label: "penalty the IRS may assess for each missing Form 5472, per year" },
    { wert: "2 years", label: "period for reinstatement in Wyoming" },
    { wert: "4th Friday in September", label: "dissolution in Florida if the annual report is missing" },
  ],
  blick: [
    ["First step", "Establish the status in the state register and the position with the IRS"],
    ["Reinstate", "Reinstatement with all outstanding reports and fees; the state decides"],
    ["Hand over", "New registered agent, new address on file with the IRS"],
    ["Dissolve", "Dissolution with the state, final return to the IRS, closure of the EIN account"],
    ["Open filings", "Missing Forms 5472 remain open after cancellation; the IRS decides on penalties"],
    ["Country of residence", "Notification under section 138 AO and the tax consequences of dissolution"],
    ["With FIAON Global", UNTERLAGEN_ZUERST],
  ],
  kurz: `To dissolve a US LLC as a non-resident, you file the dissolution with the state, file a final return with the IRS and have the EIN account closed by letter. After administrative dissolution, reinstatement is possible: in Florida at any time, in Wyoming only in the first two years. Missing Forms 5472 remain open after cancellation; the IRS can assess ${IRS_EN.strafe5472}.`,
  bloecke: [
    {
      typ: "text", id: "lage", h2: "An existing LLC: three routes",
      absaetze: [
        "For non-residents who want to dissolve or reinstate a US LLC, the starting point is often the same. A formation service filed the LLC and provided the registered agent for the first year. The registered agent is the statutory recipient of service of process in the state. Since then, the annual report to the state and the annual filing with the US tax authority, the IRS, have been missing. The IRS still holds the address of the former service.",
        "There are three routes for such a company. You reinstate it if it is still needed, for example for an account, a merchant account or current contracts. You hand its administration over to a new service if the LLC is to continue without the former one. You dissolve it if it no longer serves a purpose. Which route is open follows from two findings: the status in the state register and the filings missing at the IRS.",
        "All of these obligations continue until they are met. An LLC that Florida has dissolved administratively continues to exist for the purpose of winding up. Outstanding filings with the IRS remain open in every state.",
      ],
    },
    {
      typ: "tabelle", id: "staaten", h2: "LLC administrative dissolution in three states",
      lead: "Administrative dissolution means that the state dissolves the LLC of its own motion. Each state sets its own rules for the annual report, dissolution and reinstatement. The table covers Florida, Wyoming and Delaware, as at October 2026.",
      kopf: ["", "Florida", "Wyoming", "Delaware"],
      zeilen: [
        ["Annual duty", `${gross(FL.jahrName)}: ${FL.jahr}; deadline: ${FL.jahrFrist}`, `${gross(WY.jahrName)}: ${WY.jahr}; deadline: ${WY.jahrFrist}`, `${gross(DL.jahrName)}: ${DL.jahr}; deadline: ${DL.jahrFrist}`],
        ["If late", gross(FL.jahrVerzug), "Delinquent from the second day of the following month", `${gross(DL.jahrVerzug)}; the LLC loses its “good standing” status`],
        ["Administrative dissolution", "On the fourth Friday in September if the annual report is missing; if the registered agent or fees are missing, sixty days after the state’s notice", "Sixty days after the annual report falls due", "Cancellation if the annual tax remains unpaid for three years; likewise if the registered agent resigns and no new agent is designated within thirty days"],
        ["Reinstatement", "At any time; $100 plus all outstanding fees; if the missing annual report was the reason, the $400 supplemental fee does not apply; takes effect retroactively to the date of dissolution", "Only in the first two years after dissolution; $100 plus any outstanding License Tax; $350 if the registered agent was missing", "Certificate of Revival, $220 plus the outstanding annual tax with penalties and interest; takes effect as if the LLC had never been cancelled"],
        ["Voluntary dissolution", "Articles of Dissolution, $25", "Articles of Dissolution, $60", "Certificate of Cancellation after winding up, $220 plus all annual tax owed, including that for the current year"],
        ["New registered agent", "Statement of Change with the new agent’s written acceptance, $25", "Designation of agent and address, $5", "Change of agent, $50"],
      ],
      fuss: [
        `State fees under the statute and fee schedule of each state, as at October 2026. Delaware: ${DL.jahrAlt}`,
        "For corporations in Delaware, this status is called “void”. The charter becomes void if the corporation leaves franchise tax or the annual report outstanding for one year (8 Del. C. § 510).",
      ],
    },
    {
      typ: "text", id: "aufgeloest", h2: "What a dissolved LLC may still do",
      absaetze: [
        "If Florida dissolves an LLC administratively, the LLC continues to exist only for the purpose of winding up. It may still wind up its affairs, realise and distribute its assets and notify its creditors (§ 605.0714). The registered agent remains authorised to accept service of process.",
        "The status appears in the public register. Institutions, payment service providers and counterparties can check it there. An LLC listed as dissolved or delinquent cannot demonstrate good standing. In Delaware, an LLC that has not paid its annual tax receives no certificate of good standing and cannot maintain an action in the state’s courts. In Florida, an LLC without an annual report can neither bring nor defend an action until the report has been filed and the fees paid (§ 605.0212).",
        "In Florida, the name remains reserved against use by others for one year after dissolution. If another company holds the name after that, reinstatement is possible only under a new name (§ 605.0715). To keep the name, the one-year period therefore applies.",
      ],
    },
    {
      typ: "etappen", id: "reinstatement", h2: "Reactivating an LLC: reinstatement in five steps",
      lead: "Restoring a dissolved LLC is called reinstatement; in Delaware, revival. The state decides on the application. In Florida, reinstatement takes effect retroactively to the date of dissolution (§ 605.0715). In Delaware, the LLC is then treated as if it had never been cancelled (6 Del. C. § 18-1109).",
      etappen: [
        { titel: "Register extract and deadlines", text: "The state register shows the status, the date of and reason for dissolution and the outstanding annual reports. In Wyoming, the date of dissolution determines whether reinstatement is still open: it is possible only in the first two years." },
        { titel: "Designate the registered agent", text: "Reinstatement requires a registered agent. In Florida, the agent co-signs the application. A new agent confirms in writing that it accepts the appointment (§ 605.0114)." },
        { titel: "Application with all details", text: "In the application, Florida requires the name of the LLC, the address of the principal office and the mailing address. It also requires the date of formation, the EIN and at least one person authorised to manage the company. The EIN is the company’s tax identification number with the IRS. All outstanding fees and penalties are charged at the rates in force on the date of the application." },
        { titel: "Clarify the position with the IRS", text: "Three points need to be clarified: the missing years, the address on file with the IRS and the responsible party on record there. The company reports changes on Form 8822-B. A change of responsible party must reach the IRS within sixty days." },
        { titel: "Catch up on filings", text: `For every open year, the company files Form 5472 with a pro forma Form 1120, each with a reasonable cause statement. After that, two dates go into the compliance calendar: the annual report to the state and Form 5472 by ${IRS_EN.frist5472}.` },
      ],
    },
    {
      typ: "text", id: "agent", h2: "Registered agent resigned: deadlines and replacement",
      absaetze: [
        "If a registered agent resigns, it files a statement with the state. In Florida, it sends the company a copy to its current mailing address. Its appointment ends on the thirty-first day after the filing, or earlier once a successor has been filed (§ 605.0115). In Delaware, it must notify the company in writing at least thirty days before filing (§ 18-104(d)). If the mailing address is that of the former service, the notice may not reach the owner.",
        "Without a registered agent, statutory deadlines run. In Florida, a missing agent is a ground for administrative dissolution in its own right. Delaware cancels the LLC if no new agent is designated within thirty days of the resignation being filed (§ 18-104(d)). If Wyoming dissolves the LLC for this reason, reinstatement costs $350 instead of $100.",
        "The change has two steps. The new agent accepts the appointment in writing. The company files the change with the state, in Florida with a Statement of Change. You end the contract with the former service only after that. At the same time, you report the new address to the IRS so that its letters reach you.",
      ],
    },
    {
      typ: "text", id: "form5472", h2: "Late Form 5472: penalty, reasonable cause, limitation",
      absaetze: [
        `If an LLC has a single foreign owner, it reports its transactions with that owner to the IRS every year. It does so on Form 5472 with a pro forma Form 1120, even without revenue. If the filing is missing, the IRS can assess ${IRS_EN.strafe5472}; the same applies if the required records are missing (26 U.S.C. § 6038A(d)). Under the IRS instructions, a substantially incomplete Form 5472 is treated as not filed. If the filing is still outstanding more than ninety days after a notice from the IRS, a further $25,000 is added for each additional thirty-day period or part of one. Neither the statute nor the IRS instructions set a ceiling.`,
        "These obligations continue after cancellation by the state. The IRS closes the EIN account only once all required returns have been filed and all taxes paid. The period for assessing tax for the year concerned also does not expire while the information is missing: it ends no earlier than three years after the IRS has received the information. If the failure was due to reasonable cause, this applies only to the related items (26 U.S.C. § 6501(c)(8)). A missing Form 5472 therefore remains open until it is filed.",
        "For late filing, the IRS has its own procedure for delinquent international information returns. It is open on three conditions: no examination under way, no criminal investigation and no contact yet from the IRS about these returns. Each return may be accompanied by a reasonable cause statement. According to the IRS, penalties may still be assessed under the normal rules, even without the statement being considered at first. It may then be necessary to respond to IRS notices and submit the statement again.",
        "Whether a penalty is waived is decided by the IRS case by case. Under the regulations on § 6038A, a failure is excused if the company acted in good faith and for reasonable cause. It sets out the facts in writing, under penalties of perjury. The IRS applies this exception liberally to small companies with gross receipts of no more than US$20 million a year. The conditions: they were unaware of the requirement, have limited contact with the United States and comply promptly and fully with all IRS requirements (26 CFR § 1.6038A-4(b)). Nobody can commit to a particular outcome.",
        "The company files on paper or by fax: a foreign-owned LLC cannot file Form 5472 electronically. The pro forma Form 1120 carries the note “Foreign-owned U.S. DE” across the top. Only the name, the address and items B and E are completed. In the final year, the company ticks the “Final return” box in item E.",
      ],
    },
    {
      typ: "etappen", id: "aufloesen", h2: "Dissolve a US LLC: the six steps",
      lead: "A complete dissolution ends in three places: with the state, with the IRS and with the tax office in your country of residence. The sequence determines whether obligations remain open afterwards.",
      etappen: [
        { titel: "Stocktake", text: "It starts with a list: the status in the register, outstanding annual reports and fees, and missing filings with the IRS. Added to this are accounts, merchant accounts and current contracts in the company’s name." },
        { titel: "Resolution and winding up", text: "The members resolve to dissolve in line with the operating agreement, the LLC’s governing document. The company is then wound up: it collects receivables, settles liabilities and closes its accounts. It distributes the remaining assets to the members." },
        { titel: "Filings with the IRS", text: "The company catches up on all open years and files the return for the last year as a final return. If the LLC has several members, this is Form 1065, with a “final K-1” for each member. If it has elected on Form 8832 to be classified as a corporation, Form 966 is also required." },
        { titel: "Dissolution with the state", text: "Florida and Wyoming require Articles of Dissolution (Florida: § 605.0707). Delaware requires the Certificate of Cancellation once winding up is complete (§ 18-203), together with all annual tax owed, including that for the current year (§ 18-1107). If the LLC has already been dissolved administratively, the first step is to clarify with the state which route is open." },
        { titel: "Close the EIN account", text: "The company writes to the IRS in Cincinnati, OH 45999. The letter states the company’s full name, the EIN, the address and the reason. If the notice that assigned the EIN is still available, a copy is enclosed. The IRS closes the account only once all required returns have been filed and all taxes paid." },
        { titel: "Completion in the country of residence", text: "Three points remain: clarify the tax consequences of the dissolution, submit the notification under section 138 AO and keep all documents. They are kept for as long as limitation periods run in the US and in the country of residence." },
      ],
    },
    {
      typ: "text", id: "dach", h2: "The consequences in Germany, Austria and Switzerland",
      absaetze: [
        "Dissolving a US company also has consequences in the country of residence. If the company is managed from a German-speaking country, it is taxable there. In Germany, this follows from the place of management (section 10 of the German Fiscal Code, AO). The company can then be subject to unlimited corporate income tax liability (section 1 of the German Corporate Income Tax Act, KStG).",
        "The duty to notify the tax office also covers the end of the holding. Under section 138(2), first sentence, no. 2 AO, giving up an interest in a foreign partnership must be reported. No. 3 covers the acquisition and disposal of interests in foreign corporations. It applies where this results in a holding of at least 10 per cent or the acquisition costs of all holdings exceed €150,000. The notification is made with the tax return for the year, no later than fourteen months after the end of that year (section 138(5) AO).",
        "For tax purposes, what matters is how the tax office classifies the LLC: as a corporation or as a partnership. It decides on the basis of a type comparison (Typenvergleich); the classification chosen in the US is not decisive (German Federal Ministry of Finance, letter of 19 March 2004). For a corporation, the dissolution is treated as a sale for certain members (section 17(1) and (4) of the German Income Tax Act, EStG). This concerns a member who holds the shares privately and held at least 1 per cent at some point in the last five years. For a partnership carrying on a commercial business, the winding up may be taxable as the discontinuation of that business (section 16(3) EStG). Austria and Switzerland have their own rules.",
        "A tax adviser in your country of residence clarifies the consequences in your case before the dissolution is filed with the state.",
      ],
    },
    {
      typ: "karten", id: "wege", h2: "The three routes compared", spalten: 3,
      karten: [
        { tag: "Reinstate", titel: "The company is still needed", text: "Accounts, contracts or a trademark are in the company’s name. The registered agent and reinstatement come first, the missing filings after that." },
        { tag: "Hand over", titel: "Continuing without the former service", text: "The company designates a new registered agent by a change filing and reports the new address to the IRS. A compliance calendar records the annual dates and the person responsible." },
        { tag: "Dissolve", titel: "The company no longer serves a purpose", text: "The sequence: outstanding filings and fees, winding up, dissolution with the state, letter to the IRS. Inaction does not replace any of these steps." },
      ],
    },
    {
      typ: "text", id: "fiaon", h2: "What FIAON Global handles",
      absaetze: [
        `${UNTERLAGEN_ZUERST} It sets out the open routes, the state fees and your fee before we file anything.`,
        `With your power of attorney, we file what you instruct. With the state, that is reinstatement, change of registered agent and outstanding annual reports; with the IRS, changes on Form 8822-B. We file a dissolution only on your instruction in text form. Outstanding Forms 5472 rest with a US certified public accountant (CPA) from our partner network. Legal questions rest with partner lawyers acting in their own professional capacity. ${STEUERFRAGEN}; your tax return remains with your own tax adviser.`,
      ],
      punkte: [
        `${TEIL.ihrTeil}: you hand over the formation documents, the EIN letter and official correspondence. You close the company’s accounts yourself.`,
        `${TEIL.bedingung}: the state decides on reinstatement and dissolution; the IRS on penalties and the EIN account.`,
      ],
    },
    { typ: "paket", id: "mandat", h2: "A new formation in one engagement", lead: `For a new formation after dissolution: ${P.karteLead.charAt(0).toLowerCase()}${P.karteLead.slice(1)}`, paket: "global_struktur" },
    {
      typ: "hinweis", id: "wissen", h2: "What you need to know",
      punkte: [
        "Outstanding obligations with the IRS continue after cancellation by the state. Missing Forms 5472 remain open. The period for an assessment ends no earlier than three years after the information is received.",
        "The IRS alone decides on a penalty. The company may enclose a reasonable cause statement; nobody can commit to the outcome.",
        "The state decides on reinstatement. Wyoming rules it out after two years. In Florida, a name that has since been taken may require a new name.",
        `${beleg("keinZugriff", "en")} You therefore close accounts with institutions and payment service providers yourself.`,
        `${satz("S8", "en")} This page explains the fundamentals and does not replace a tax or legal review of your case.`,
        GLOBAL_PFLICHTHINWEIS.en[0],
        GLOBAL_PFLICHTHINWEIS.en[1],
      ],
    },
  ],
  fragen: [
    { f: "How do I dissolve a US LLC as a non-resident?", a: "In this sequence. First, you catch up on outstanding annual reports, fees and filings and wind up the company. Second, you file the dissolution with the state: Articles of Dissolution in Florida and Wyoming, a Certificate of Cancellation in Delaware. Third, you file the final return with the IRS and ask by letter for the EIN account to be closed." },
    { f: "What does it cost to dissolve a US LLC?", a: `The state fee is $25 in Florida, $60 in Wyoming and $220 in Delaware. In Delaware, all annual tax owed is added, including that for the current year (as at October 2026). Annual reports and fees from earlier years may also be outstanding. For missing Forms 5472, the IRS can assess ${IRS_EN.strafe5472}.` },
    { f: "Can I reinstate a dissolved LLC?", a: "In many cases, yes; the state decides. Florida allows reinstatement at any time, for $100 plus all outstanding fees. In Florida, it takes effect retroactively to the date of dissolution. Wyoming allows it only in the first two years. Delaware restores a cancelled LLC with a Certificate of Revival, for $220 plus the outstanding annual tax with penalties and interest." },
    { f: "I forgot to file Form 5472 — what now?", a: `You file it late, for every open year with a pro forma Form 1120 and a reasonable cause statement. The IRS has a procedure for delinquent international information returns. The conditions: you are not under examination, you are not under criminal investigation and the IRS has not yet contacted you about these returns. The IRS can still assess the penalty of ${IRS_EN.strafe5472}. The IRS decides on the statement.` },
    { f: "Do I need to have the EIN cancelled when I dissolve the LLC?", a: "The EIN cannot be cancelled: according to the IRS, it remains the company’s permanent tax identification number. On request, the IRS closes the EIN account. The request is a letter to the IRS in Cincinnati with the name, EIN, address and the reason. The IRS closes the account only once all returns have been filed and all taxes paid." },
    { f: "My registered agent has resigned — what now?", a: "You designate a new registered agent before the state’s deadline expires. In Florida, the previous agent’s appointment ends on the thirty-first day after its resignation is filed. Without an agent, Florida may dissolve the company administratively. Delaware cancels the LLC if no successor is designated within thirty days. The new agent accepts the appointment in writing, and the company files the change with the state." },
    { f: "What do I have to report in Germany when I dissolve the LLC?", a: "That depends on how the LLC is classified. Under section 138(2) AO, you report giving up an interest in a foreign partnership. The same applies to the disposal of an interest in a foreign corporation above the statutory thresholds. The notification is made with the tax return, no later than fourteen months after the end of the year. The classification in your case is a matter for a tax adviser." },
    { f: "Does FIAON Global also take over an LLC that was formed elsewhere?", a: `Yes. ${UNTERLAGEN_ZUERST} It sets out the open routes, the state fees and your fee. After that, we file what you instruct, with your power of attorney; a dissolution only on your instruction in text form. Outstanding filings with the IRS rest with a US certified public accountant (CPA) from our partner network. The state decides on reinstatement and dissolution. If the company is to carry on, you may continue with annual administration from the second year; it does not renew automatically.` },
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
