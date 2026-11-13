// ═══════════════════════════════════════════════════════════════════════════
// FIAON GLOBAL — WISSEN AUF ENGLISCH: GRÜNDUNG, STEUERNUMMERN, PRÄSENZ,
// STEUERN, STRUKTUR (24.09.2026, E-234 · neu gefasst 13.11.2026, E-510)
//
// Die englischen Schwestern der sechs Wissens-Artikel aus ../wissen-gruendung.ts:
// LLC gründen, EIN, ITIN, Registered Agent und Adresse, US-Steuererklärung,
// Tochter oder Zweigniederlassung. Britisches Englisch, dieselben Bausteine in
// derselben Reihenfolge, dieselben Anker (ids bleiben deutsch), dieselben Quellen
// mit englischen Titeln (QUELLEN_WISSEN_EN, QUELLEN_STAATEN_EN).
//
// E-510 (13.11.2026): Jede Seite folgt dem Sprachleitfaden FIAON Global, Baustein
// „Wissens-Artikel“ (7.4) — erklären, nicht verkaufen. Je Seite EIN Abschnitt
// “What FIAON Global handles” (höchstens 120 Wörter): was wir tun, “Your part”,
// “Condition” (wer entscheidet). Die festen Sätze, die Schritte 1 und 2 der festen
// Erzählung und die Übergangssätze kommen aus shared/fiaon-global-saetze.ts — nie
// ein zweites Mal getippt. Kernwörter: engagement · client · fee · proposal.
// Zahlen Dritter nur aus fakten-en.ts, der eine Betrag (annual administration) aus
// der Preisquelle (SAETZE_BETRAEGE).
//
// WAS HIER NIE STEHT: der Satz zur Erstattung nach Ziffer 4 (gilt nur für die
// Finanzierung), eine Zusage zu Konto, Karte oder Finanzierung, „registered“ als
// unsere Leistung (eintragen kann nur der Bundesstaat), eine Dauer als Zusage,
// ein “team on the ground”, ein Partner bei der Arbeit im Präsens, „up to“, eine
// Frist mit Ziffer („within sixty days“), ein Steuerversprechen.
// Prüfstand: npx tsx scripts/pruef-global-en.ts shared/fiaon-global-seiten/en/wissen-gruendung.ts
// Wortwand:  npx tsx scripts/pruef-global-leitfaden.ts shared/fiaon-global-seiten/en/wissen-gruendung.ts
// ═══════════════════════════════════════════════════════════════════════════
import { GLOBAL_PFLICHTHINWEIS } from "../../fiaon-global";
import {
  SAETZE_BETRAEGE, SCHRITTE_KOPF, SECHS_SCHRITTE,
  beleg, satz, weitererSatz, type Schritt, type SchrittNr,
} from "../../fiaon-global-saetze";
import { EIN_PRODUKT } from "../ein-produkt";
import {
  EIN_WEG_EN, FAKTEN_STAND_EN, FRISTEN_EN, IRS_EN, MARKT_EN, QUELLEN_STAATEN_EN, QUELLEN_WISSEN_EN as Q, SCHWELLEN_EN, STAAT_EN,
} from "../fakten-en";
import type { GlobalSeite } from "../typen";

/** Date of first publication (E-234). */
const ERSCHIENEN = "2026-09-24";
/** Date of the last change in substance (E-510, language guide). */
const S = "2026-11-13";
const P = EIN_PRODUKT.en;
const gross = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** One step of the fixed narrative (language guide 2.3) — sentence, condition and “your part” from the one source. */
const schritt = (nr: SchrittNr): Schritt => SECHS_SCHRITTE.en.find((x) => x.nr === nr)!;
const GRUENDUNG = schritt(1);
const UNTERLAGEN = schritt(2);
/** The names of the fixed parts of a step: “Your part”, “Condition” (language guide 2.1). */
const TEIL = SCHRITTE_KOPF.en.teile;
/** Heading of the one section about us (language guide 7.4). */
const FIAON_H2 = "What FIAON Global handles";
/** S15 with the date of the figures — in every block that states a duration (language guide 5.5). */
const DAUERN = `${satz("S15", "en")} As at ${FAKTEN_STAND_EN}.`;
/** The decision sentence from S2: “Each institution makes its own decision on accounts, cards and limits.” */
const INSTITUT = satz("S2", "en").split(/(?<=\.)\s+/)[1];
/** Liability for business credit cards (S11) with the decision sentence. */
const KARTEN_HAFTUNG = `${satz("S11", "en")} ${INSTITUT}`;
/** What is payable from the second year (agreement, clause 6(3)) — amount from the price source. */
const LAUFEND = `From the second year your company incurs running costs: the state fee, the registered agent and the annual US filing. With annual administration we handle these on request for ${SAETZE_BETRAEGE.en.jahresbetreuung} a year, state fee included; it does not renew automatically.`;
/** The first annual US filing — wording of the agreement (clause 2), role as in guard rail 5. */
const US_MELDUNG = "the first annual US filing by a US certified public accountant (CPA) from our partner network";

export const WISSEN_GRUENDUNG_EN: GlobalSeite[] = [
  // ─────────────────────────────────────────────────────────────────────────
  // 1 · LLC GRÜNDEN — der Überblick: alle zehn Schritte in Reihenfolge
  {
    pfad: "/en/business/knowledge/form-a-us-llc",
    sprache: "en",
    schwester: "/business/wissen/llc-gruenden",
    art: "wissen",
    seo: {
      titel: "Form a US LLC from Germany: 10-step guide — FIAON Global",
      beschreibung: "Form a US LLC from Germany: ten steps from the tax classification at home to Form 5472 — fees, documents and duties, with sources and dates.",
    },
    stand: S,
    erschienen: ERSCHIENEN,
    kennung: "FG · 30",
    auge: "Knowledge · Formation",
    h1: "Form a US LLC.",
    h1b: "Step by step, from Germany.",
    lead: "A US LLC can be formed from abroad — without residence in the US and without minimum capital. Filing with the state is the smallest part. Here are the ten steps in sequence: costs, responsibilities and common mistakes.",
    ziffern: [
      { wert: "10 steps", label: "from the tax classification at home to the first US filing" },
      { wert: `${STAAT_EN.wyoming.gruendung} – ${STAAT_EN.florida.gruendung}`, label: "state formation fee" },
      { wert: "No", label: "minimum capital, no notary appointment" },
    ],
    blick: [
      ["Requirements", "Passport, home address, a clear plan — no US residence required"],
      ["Sequence", "Tax classification, state, formation, EIN, account application"],
      ["State fee", `Florida ${STAAT_EN.florida.gruendung}, Delaware ${STAAT_EN.delaware.gruendung}, Wyoming ${STAAT_EN.wyoming.gruendung}`],
      ["Duties in the US", "Registered agent, annual report to the state, Form 5472"],
      ["Duties where you reside", "Notification under section 138 AO, tax at the place of management"],
      ["Since August 2026", "No more BOI reporting for US companies"],
      ["With FIAON Global", "State filing, documents and tax number applications under one engagement"],
    ],
    kurz: `You form a US LLC from Germany in ten steps. Before formation come tax classification, legal form, state and name. Then follow the registered agent, the state filing, the operating agreement, the EIN and, where applicable, the ITIN, then the account application and the compliance calendar. The state fee ranges from ${STAAT_EN.wyoming.gruendung} (Wyoming) to ${STAAT_EN.florida.gruendung} (Florida); the state fee and Form 5472 recur every year.`,
    bloecke: [
      {
        typ: "text", id: "vorab", h2: "Before you form: two questions",
        absaetze: [
          "The first question is not “Which state?” but: what is the company for? Contracts with US customers, sales through US marketplaces, payments in US dollars, a payment record of its own in the United States — depending on the answer, a different legal form, state and structure will fit.",
          "The second question is put by your country of residence: where is the company managed? Anyone who runs it from Germany, Austria or Switzerland is generally taxable there. This classification belongs before formation, not after it. It also determines whether the LLC should belong to you personally or to your GmbH (a German, Austrian or Swiss limited liability company).",
        ],
      },
      {
        typ: "etappen", id: "schritte", h2: "The ten steps",
        lead: `In this sequence — each step requires the one before it. ${DAUERN}`,
        etappen: [
          { titel: "Plan and tax classification", dauer: "before anything else", text: "Clarify what the company is for and where it will be managed. A tax adviser with US experience reviews how your country of residence classifies the LLC (in Germany by comparison with German legal forms, the Typenvergleich) and which notifications are required." },
          { titel: "Choose the legal form", text: "The LLC suits trading, services and a payment record of its own in the United States; the corporation suits businesses that intend to bring in investors. An LLC can belong to one person, to several or to your GmbH — each variant has its own tax consequences." },
          { titel: "Choose the state", text: "How long may registration take? Where will the business take place? Are investors coming in? Will you need appointments on site? The choice between Delaware, Florida and Wyoming follows from the answers. A company that does business in another state also registers there." },
          { titel: "Check the name", text: "Each name is granted only once in a state and carries the suffix “LLC” or “Limited Liability Company”. Check it in the state’s register and keep two alternative names ready." },
          { titel: "Appoint a registered agent", text: "Every LLC needs a registered agent in the state of formation with a physical address, who accepts official mail and lawsuits — from the first day and without interruption." },
          { titel: "File with the state", dauer: "one or two business days to around two weeks, depending on the state", text: `The formation document goes to the state together with the fee: in Florida the Articles of Organization (${STAAT_EN.florida.gruendung}), in Delaware the Certificate of Formation (${STAAT_EN.delaware.gruendung}), in Wyoming the Articles of Organization (${STAAT_EN.wyoming.gruendung}). ${GRUENDUNG.bedingung} Once it is registered, the company exists.` },
          { titel: "Draw up the operating agreement", text: "The operating agreement governs ownership, management, profit distribution and succession. It is not filed, but institutions generally ask for it. Since 1 June 2026 so does the IRS, if an ITIN application is based on an interest in an LLC with several shareholders (members)." },
          { titel: "Apply for the EIN", dauer: "the same day by phone, often around two weeks by fax at present", text: "You apply for the company’s tax identification number with Form SS-4 — without a US Social Security number by fax, post or phone, not online. The EIN is required for the account application, the card application and Form 5472; the US tax authority, the IRS, decides on it." },
          { titel: "The ITIN, if there is a reason", text: "The personal US tax number is issued only with a tax reason (Form W-7). It is not needed for the EIN; for a personal credit history in the US it often is." },
          { titel: "Account application, compliance calendar, notification to your tax office", text: "Once the formation document, EIN and operating agreement are in place, the account application follows; the institution concerned decides on the account. Then the duties begin: the annual report to the state, Form 5472 by 15 April, the notification to the tax office under section 138 of the German Fiscal Code (AO)." },
        ],
      },
      {
        typ: "tabelle", id: "kosten", h2: "What formation costs",
        lead: "The state fees are modest. The larger costs come from the agent, the contracts, the tax numbers and the annual filing — and from mistakes in the sequence.",
        kopf: ["Item", "Florida", "Delaware", "Wyoming"],
        zeilen: [
          ["State formation fee", STAAT_EN.florida.gruendung, STAAT_EN.delaware.gruendung, STAAT_EN.wyoming.gruendung],
          ["Annually to the state", STAAT_EN.florida.jahr, STAAT_EN.delaware.jahr, STAAT_EN.wyoming.jahr],
          ["Registered agent (market rate)", MARKT_EN.agent, MARKT_EN.agent, MARKT_EN.agent],
          ["EIN from the IRS", "no fee", "no fee", "no fee"],
          ["Form 5472 by a US CPA (market rate)", MARKT_EN.cpa5472, MARKT_EN.cpa5472, MARKT_EN.cpa5472],
        ],
        fuss: [
          `As at ${FAKTEN_STAND_EN}. State fees according to the official fee schedules; market rates are figures published by several providers, not official figures.`,
          `Included in the first year of your engagement with FIAON Global: the state fee, the registered agent, the EIN and ITIN applications and ${US_MELDUNG}. ${beleg("honorarVorab", "en")}`,
        ],
      },
      {
        typ: "text", id: "boi", h2: "Since August 2026: no more BOI reporting",
        absaetze: [
          "Until 2025 the rule was that every new US company had to report its beneficial owners to the US authority FinCEN (Beneficial Ownership Information, BOI). For companies formed in the US, this duty has ended; the rule that took effect on 14 August 2026 made that final.",
          "Only foreign companies that register to do business in a state still have to report — a GmbH with a branch in the US, for example. For an LLC that you form in Florida, Delaware or Wyoming, the report no longer applies. References to penalties for a missed BOI report reflect an outdated position for these companies.",
        ],
      },
      {
        typ: "karten", id: "fehler", h2: "Six common mistakes", spalten: 3,
        karten: [
          { tag: "Mistake", titel: "Form first, classify later", text: "The tax question in your country of residence comes after formation. By then the structure is fixed — even if the LLC would have fitted better under the GmbH." },
          { tag: "Mistake", titel: "The state with the lowest fee", text: "Anyone who does business in Florida and forms in Wyoming also registers in Florida — and pays in both states." },
          { tag: "Mistake", titel: "The agent’s address as head office", text: "Many institutions decline to open accounts for companies whose business address is a registered agent’s address or a PO box." },
          { tag: "Mistake", titel: "No operating agreement", text: "The account application fails because of a document that should have been in place at formation: who holds an interest, who may act?" },
          { tag: "Mistake", titel: "Form 5472 not filed", text: `Even the capital contribution at formation must be reported. The penalty for a missing filing: ${IRS_EN.strafe5472}.` },
          { tag: "Mistake", titel: "No notification to the tax office", text: "In Germany, you must notify the tax office of the formation or the interest under section 138 of the German Fiscal Code (AO) — with your next tax return." },
        ],
      },
      {
        typ: "text", id: "fiaon", h2: FIAON_H2,
        absaetze: [
          `${GRUENDUNG.satz} ${UNTERLAGEN.satz}`,
        ],
        punkte: [
          `${TEIL.ihrTeil}: ${GRUENDUNG.ihrTeil} ${UNTERLAGEN.ihrTeil}`,
          `Accounts and cards: ${satz("S2", "en")}`,
          `${TEIL.bedingung}: ${satz("S3", "en")}`,
        ],
      },
      { typ: "paket", id: "mandat", h2: P.karteH2, lead: P.karteLead, paket: "global_struktur" },
      {
        typ: "hinweis", id: "wissen", h2: "What you need to know",
        punkte: [
          GLOBAL_PFLICHTHINWEIS.en[0],
          GLOBAL_PFLICHTHINWEIS.en[1],
          "An LLC does not replace a business model: institutions look at what the company does — not at the state in which it was formed.",
        ],
      },
    ],
    fragen: [
      { f: "As a German, can I set up an LLC in the US?", a: `Yes. For the formation itself you need neither US residence nor US citizenship, and no minimum capital. What you need is a registered agent in the state of formation and the state fee. ${GRUENDUNG.bedingung}` },
      { f: "How much does it cost to form an LLC?", a: `The state fee is ${STAAT_EN.wyoming.gruendung} in Wyoming, ${STAAT_EN.delaware.gruendung} in Delaware and ${STAAT_EN.florida.gruendung} in Florida. In addition, there are the registered agent, the operating agreement and, every year, the state fee and Form 5472. As to FIAON Global’s fees: ${beleg("honorarVorab", "en")}` },
      { f: "How long does it take to form an LLC?", a: `Registration with the state currently takes one or two business days (Delaware with express), around three business days (Wyoming) or often around two weeks (Florida). The EIN, the ITIN and the account application take longer. ${satz("S15", "en")}` },
      { f: "Do I need a US address for my LLC?", a: "The LLC needs a registered agent with an address in the state of formation. For the account application and contracts it also needs a business address; for many institutions the agent’s address is not sufficient. Each institution decides for itself which address it accepts." },
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
      beschreibung: "Apply for an EIN for your LLC without an SSN: Form SS-4 line by line, the routes by fax, post or phone and typical mistakes — with sources and dates.",
    },
    stand: S,
    erschienen: ERSCHIENEN,
    kennung: "FG · 31",
    auge: "Knowledge · Tax number",
    h1: "Apply for your EIN.",
    h1b: "Without a Social Security number.",
    lead: "The EIN is your US company’s tax identification number — required for account and card applications and for every filing with the IRS. The online application requires a US Social Security number or an ITIN. Without one, you apply with Form SS-4: by fax, post or phone.",
    ziffern: [
      { wert: "No fee", label: "the IRS charges no fee for the EIN" },
      { wert: "3 routes", label: "fax, post or phone — not online without an SSN" },
      { wert: "9 digits", label: "in the format 12-3456789" },
    ],
    blick: [
      ["What", "Employer Identification Number — the company’s tax identification number"],
      ["When", "After registration with the state"],
      ["Form", "Form SS-4, signed on behalf of the company"],
      ["Routes without an SSN", "Fax, post or phone — not online"],
      ["IRS processing time", gross(IRS_EN.einDauer)],
      ["Fee", "None at the IRS"],
      ["With FIAON Global", "Application prepared and filed — the US tax authority decides"],
    ],
    kurz: `Without a US Social Security number, you apply for the EIN with Form SS-4 by fax, by post or, as an applicant from abroad, by phone. The company must first be registered with the state. Line 7b says “foreign” or “N/A” if the responsible party has neither an SSN nor an ITIN. An LLC with one foreign shareholder (member) notes “${EIN_WEG_EN.zeile9a}” in line 9a.`,
    bloecke: [
      {
        typ: "text", id: "was", h2: "The EIN: purpose and use",
        absaetze: [
          "The Employer Identification Number is the tax identification number of a US company: nine digits, issued by the US tax authority, the IRS. Despite its name, it is not only needed by those who employ staff. Institutions require it for every business account, card issuers for every application, and without it Form 5472 cannot be filed.",
          "An LLC with a single foreign shareholder (member) needs the EIN if only because it must file Form 5472 every year. It files under its own name and its own EIN.",
        ],
      },
      {
        typ: "text", id: "online", h2: "Online application: SSN or ITIN required",
        absaetze: [
          "The IRS offers an online application that issues the number in the same session. However, it requires the responsible party to have a valid SSN or ITIN. Founders from Germany, Austria or Switzerland generally have neither — they are left with fax, post and phone.",
          "There is no need to apply for an ITIN just for the EIN. The EIN can be applied for without an ITIN, and the ITIN needs a tax reason of its own.",
        ],
      },
      {
        typ: "text", id: "verantwortlich", h2: "The responsible party",
        absaetze: [
          "The IRS wants to know who is behind the company: the “responsible party” — the person who ultimately owns or controls the company. Except for government entities, this must be an individual, not a company. If the LLC belongs to your GmbH, it is the individual who actually directs the GmbH and thus the LLC.",
          "If this person has neither an SSN nor an ITIN and is not eligible for one, line 7b says “foreign” or “N/A”. The IRS issues only one EIN per responsible party per day.",
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
        fuss: ["Based on the IRS Instructions for Form SS-4 (as at December 2025). The designee’s authority ends as soon as the EIN has been assigned and communicated."],
      },
      {
        typ: "karten", id: "wege", h2: "Three routes to the number", spalten: 3,
        lead: DAUERN,
        karten: [
          { tag: "Fax", titel: "About four business days according to the IRS", text: `From abroad to ${EIN_WEG_EN.faxAusland}. Give a fax number for the reply — that way the number comes back by the same route. In practice it often takes around two weeks at present.` },
          { tag: "Post", titel: "About four weeks", text: `To ${EIN_WEG_EN.post}. The longest of the three routes; if a detail is missing, the time for the query is added.` },
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
        typ: "text", id: "fiaon", h2: FIAON_H2,
        absaetze: [
          "The EIN application is part of your engagement. We prepare Form SS-4, present it ready for your signature, file it with the IRS and track the application. We clarify any queries from the IRS with you and place the IRS letter in your portal.",
        ],
        punkte: [
          `${TEIL.ihrTeil}: ${UNTERLAGEN.ihrTeil}`,
          `${TEIL.bedingung}: ${satz("S3", "en")}`,
        ],
      },
      { typ: "paket", id: "mandat", h2: "The EIN in your engagement", lead: P.karteLead, paket: "global_struktur" },
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
      { f: "Can I get an EIN without an SSN?", a: "Yes. Without an SSN or ITIN, you apply for the EIN with Form SS-4 by fax, by post or, as an applicant from abroad, by phone. Only the online application requires an SSN or ITIN." },
      { f: "How long does it take to get an EIN?", a: `${gross(IRS_EN.einDauer)}. The telephone application is the shortest route if all the details are to hand. ${satz("S15", "en")}` },
      { f: "Does it cost anything to get an EIN?", a: "Not at the IRS. Costs arise only if you engage someone. With FIAON Global, the EIN application is part of your engagement." },
      { f: "Do I need an ITIN to apply for an EIN?", a: "No. If the responsible party has neither an SSN nor an ITIN, line 7b of Form SS-4 says “foreign” or “N/A”." },
      { f: "What if I have lost my EIN confirmation letter?", a: "The IRS confirms the number again on request (Letter 147C). Many institutions accept this confirmation in place of the original letter (CP 575)." },
    ],
    paket: "global_struktur",
    weiter: ["/en/business/ein-itin", "/en/business/knowledge/applying-for-an-itin", "/en/business/knowledge/form-a-us-llc", "/en/business/knowledge/us-bank-account-documents"],
    quellen: [Q.ss4, Q.ein, Q.smllc, Q.f8822b],
  },

  // ─────────────────────────────────────────────────────────────────────────
  // 3 · ITIN BEANTRAGEN — Form W-7, der steuerliche Grund, der Reisepass
  {
    pfad: "/en/business/knowledge/applying-for-an-itin",
    sprache: "en",
    schwester: "/business/wissen/itin-beantragen",
    art: "wissen",
    seo: {
      titel: "Apply for an ITIN from Germany: Form W-7 — FIAON Global",
      beschreibung: "Apply for an ITIN with Form W-7: who needs one, which tax reason qualifies, passport and acceptance agent, expiry — with sources and dates.",
    },
    stand: S,
    erschienen: ERSCHIENEN,
    kennung: "FG · 32",
    auge: "Knowledge · Tax number",
    h1: "Apply for your ITIN.",
    h1b: "Only with a tax reason.",
    lead: "The ITIN is your personal tax number in the US. The IRS issues it only for tax purposes and only with a stated reason; it is not issued for credit purposes alone. An application with a sound reason and complete supporting documents avoids queries.",
    ziffern: [
      { wert: "Form W-7", label: "with passport and tax reason" },
      { wert: "5 exceptions", label: "only then without a US tax return" },
      { wert: "9 digits", label: "begins with a 9 and serves tax purposes only" },
    ],
    blick: [
      ["What", "Individual Taxpayer Identification Number — for people without an SSN"],
      ["Who", "Anyone who has to file a US tax return or qualifies for an exception"],
      ["Form", "Form W-7, as a rule with a tax return"],
      ["Passport", "Original, copy certified by the issuing authority, or verification by a CAA"],
      ["IRS processing time", "About seven weeks; nine to eleven in peak season and from abroad"],
      ["Expiry", "After three tax years without a return"],
      ["With FIAON Global", "ITIN check first; an application only with a sound reason"],
    ],
    kurz: "You apply for the ITIN with Form W-7 to the IRS, as a rule together with a US tax return. Without one, this is possible only if one of the IRS’s five exceptions applies. The ITIN is not needed for your company’s EIN. You send the passport as the original or as a copy certified by the issuing authority, or a Certifying Acceptance Agent verifies it.",
    bloecke: [
      {
        typ: "text", id: "was", h2: "The ITIN: purpose and limits",
        absaetze: [
          "The IRS issues the Individual Taxpayer Identification Number to people who must be registered for tax in the US but are not eligible for a Social Security number. It has nine digits, begins with a 9 and serves tax purposes only.",
          "An ITIN is not a work permit, not a residence permit and not an entitlement to US Social Security benefits. Outside tax law, it is not a form of identification either.",
        ],
      },
      {
        typ: "text", id: "grund", h2: "The tax reason decides",
        absaetze: [
          "The IRS requires a reason with every application. The standard case: you submit Form W-7 together with a US tax return — for instance because, as a shareholder (member) of an LLC, you have to declare income from business in the US. Without a tax return, this is possible only if one of the IRS’s five exceptions applies.",
          "One of them concerns partners in a partnership that holds assets in the US whose income is reportable and subject to withholding. For tax purposes this includes the LLC with several shareholders. Since 1 June 2026, an acceptance agent submits such applications together with the part of the partnership agreement that shows the partnership’s name and EIN and the applicant’s name and signature.",
          "The IRS does not issue an ITIN for credit purposes alone. It rejects an application that relies on that.",
        ],
      },
      {
        typ: "etappen", id: "ablauf", h2: "The application process",
        lead: DAUERN,
        etappen: [
          { titel: "Clarify the reason", text: "A US certified public accountant (CPA) reviews which tax return or which exception supports the application. No sound reason, no application." },
          { titel: "Complete Form W-7", text: "Tick the reason (for non-residents with a US tax return this is usually “b”), name as in the passport, address abroad, birth details, passport details. If an exception applies, its supporting documents are included." },
          { titel: "Have the passport verified", text: "The passport alone is sufficient proof of identity and nationality. It goes to the IRS as the original or as a copy certified by the issuing authority. Alternatively, a Certifying Acceptance Agent verifies it in person and returns it at the appointment." },
          { titel: "Submit", text: "With the tax return or proof of the exception to the IRS ITIN office in Austin, Texas — or via the acceptance agent." },
          { titel: "Notice", dauer: "about seven weeks", text: "The IRS notifies you of the number in writing (CP 565). Between mid-January and the end of April and for applications from abroad, it takes nine to eleven weeks." },
        ],
      },
      {
        typ: "tabelle", id: "pass", h2: "The passport: three routes",
        kopf: ["Route", "What you do", "Your passport"],
        zeilen: [
          ["Original by post", "Send the passport to the IRS with the application", "is in transit while the application is processed"],
          ["Certified copy", "Copy certified by the authority that issued the passport", "stays with you"],
          ["Certifying Acceptance Agent", "Appointment with the CAA, who verifies the passport and submits the application", "is returned at the appointment"],
        ],
        fuss: [
          "A notarised copy is not enough for the IRS — the certification must come from the issuing authority.",
          `Acceptance agents charge ${MARKT_EN.acceptanceAgent} for verification and submission (market rate, ${FAKTEN_STAND_EN}).`,
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
          { tag: "What is true", titel: "Some issuers ask for the ITIN", text: "In practice, the US credit bureaus track a personal credit history by SSN or ITIN. Some card issuers consider applications with an ITIN, others require an SSN — each issuer decides this for itself." },
          { tag: "What is not true", titel: "“With an ITIN, cards follow”", text: "An ITIN is a prerequisite, not a commitment. The issuer decides on every application based on history, income and business." },
        ],
      },
      {
        typ: "text", id: "fiaon", h2: FIAON_H2,
        absaetze: [
          `${weitererSatz("UEBERGANG-ITIN", "en")} Without a sound reason, we file no application. Where there is one, we prepare Form W-7 with all enclosures, file the application and track it until the notice arrives.`,
          "We agree with you before the application is filed which of the three routes your passport takes.",
        ],
        punkte: [
          `${TEIL.ihrTeil}: ${UNTERLAGEN.ihrTeil}`,
          `From your agreement: ${UNTERLAGEN.werMachtWas.wennEsAusbleibt}`,
          `${TEIL.bedingung}: ${UNTERLAGEN.bedingung}`,
        ],
      },
      { typ: "paket", id: "mandat", h2: "The ITIN in your engagement", lead: P.karteLead, paket: "global_struktur" },
      {
        typ: "hinweis", id: "wissen", h2: "What you need to know",
        punkte: [
          "The ITIN serves tax purposes only. Whoever applies for it takes on the duties on which the application is based — an annual US tax return, for instance.",
          KARTEN_HAFTUNG,
          "An ITIN does not replace an SSN: separate rules apply to work and social benefits in the US.",
        ],
      },
    ],
    fragen: [
      { f: "Do I need an ITIN for my LLC?", a: "Not for the company’s EIN. You need an ITIN personally if you have to file a tax return in the US or if one of the IRS exceptions applies." },
      { f: "How long does an ITIN application take?", a: `${gross(IRS_EN.itinDauer)}. ${satz("S15", "en")}` },
      { f: "Do I have to send my original passport to get an ITIN?", a: "You do not have to send it to the US. Instead of the original, a copy certified by the issuing authority is sufficient — or a Certifying Acceptance Agent authorised by the IRS verifies your passport." },
      { f: "Can I apply for an ITIN just for a credit card?", a: "No. The IRS issues ITINs only for tax purposes; the application needs a tax return or an exception. Some card issuers ask for the ITIN — they decide on the card themselves." },
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
    erschienen: ERSCHIENEN,
    kennung: "FG · 33",
    auge: "Knowledge · US presence",
    h1: "Registered agent and address.",
    h1b: "Your company’s US presence.",
    lead: "Every LLC needs a registered agent in the state of formation from the first day — that is the law. For an account application and contracts it needs more: a business address that the institution concerned accepts, and a phone number that someone answers.",
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
    kurz: "The registered agent is the point to which courts and authorities in the state of formation deliver lawsuits and official documents. It needs a physical address in that state and must be reachable during business hours; every state requires one. Its address is not a business address: for an account, institutions require an address at which the company can be reached — a PO box is usually not enough.",
    bloecke: [
      {
        typ: "text", id: "agent", h2: "What the registered agent does",
        absaetze: [
          "In the US, a lawsuit is not delivered by post but handed over in person — “service of process”. So that this works for a company without an office in the state, every state requires a registered agent. This is a person or business with an address in the state; the agent accepts lawsuits and letters from authorities and passes them on without delay.",
          "Florida requires one in § 605.0113 of the Florida Statutes, Delaware in the Limited Liability Company Act, Wyoming with a physical address in the state. The agent appears with name and address in the public register.",
          "Only someone who lives in the state or has an office there that is staffed during business hours can act as their own agent. For founders from Europe, a commercial agent is the norm.",
        ],
      },
      {
        typ: "tabelle", id: "drei", h2: "Three addresses, three tasks",
        kopf: ["", "Registered agent", "Business address", "Mailing address"],
        zeilen: [
          ["Purpose", "Lawsuits and official mail", "The company’s place of business for institutions and customers", "Letters from the IRS and the states"],
          ["Required", "yes, in the state of formation", "in practice yes, for an account application and contracts", "yes, on Form SS-4"],
          ["Where", "in the state of formation, physical", "where the company does business", "where mail reliably reaches you"],
          ["Public", "yes, in the register", "usually yes", "no"],
          ["Typical mistake", "Agent terminated, state not informed", "Agent’s address or PO box used as the place of business", "Letters from the IRS reach nobody"],
        ],
      },
      {
        typ: "text", id: "institute", h2: "Why institutions require a physical address",
        absaetze: [
          "US institutions must verify the identity of every customer. For companies, this includes an address: the principal place of business, a local office or another physical location of business (31 CFR 1020.220). An address at which hundreds of companies are registered does not answer this question.",
          "That is why many institutions decline to open accounts for companies whose business address is a registered agent’s address, a PO box or a mere mailbox. Others accept a business address abroad if it fits the business. Each institution decides for itself which address is sufficient.",
        ],
      },
      {
        typ: "text", id: "telefon", h2: "The phone number",
        absaetze: [
          "Card issuers and institutions call — to confirm an application, with queries, in the case of unusual payments. If the US number rings out or only plays a recorded message, the query remains open; each institution decides for itself how it deals with that. The number belongs to the company, is reachable and is the same in all documents.",
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
          "A change is possible at any time: the new agent declares its consent, and the company reports the change to the state — usually with a separate form and for a fee. Only terminate the old agent once the new one appears in the register; any gap in between is a gap in service.",
          "If the agent’s name or address changes, this must also be entered in the register. In Florida the change must be reported within thirty days — otherwise administrative dissolution is a risk here too (§ 605.0714).",
        ],
      },
      {
        typ: "text", id: "fiaon", h2: FIAON_H2,
        absaetze: [
          `The registered agent, the US business address and the US telephone number are included in the first year of your engagement. We place service of process and official mail in your portal in digital form; the deadlines appear in your company’s compliance calendar. ${weitererSatz("UEBERGANG-ASSISTENZ", "en")}`,
          LAUFEND,
        ],
        punkte: [
          `${TEIL.ihrTeil}: ${UNTERLAGEN.ihrTeil}`,
          `${TEIL.bedingung}: Each institution decides for itself which address it accepts for an account.`,
        ],
      },
      { typ: "paket", id: "mandat", h2: "The US presence in your engagement", lead: P.karteLead, paket: "global_struktur" },
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
      { f: "How much does a registered agent cost?", a: `The market rate is ${MARKT_EN.agent}. With FIAON Global, the registered agent, the US business address and the US telephone number are included in the first year of your engagement. From the second year they form part of annual administration for ${SAETZE_BETRAEGE.en.jahresbetreuung} a year; it does not renew automatically.` },
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
      beschreibung: "Pro forma 1120, 1040-NR, 1065, 1120-F, FBAR: which US returns your LLC files, by structure — with deadlines, sources and dates.",
    },
    stand: S,
    erschienen: ERSCHIENEN,
    kennung: "FG · 38",
    auge: "Knowledge · Tax return",
    h1: "Your LLC’s US tax return.",
    h1b: "Which forms, which deadlines.",
    lead: "Even an LLC that pays no tax in the US generally files returns there. Which ones depends on ownership, tax classification and business in the US. This overview sets out forms and deadlines by structure.",
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
      ["Country of residence", "Tax return and section 138 AO — separately from the US"],
      ["With FIAON Global", "The first annual US filing is included in the first year"],
    ],
    kurz: `An LLC with one foreign shareholder (member) files Form 5472 with a pro forma Form 1120 in the US every year (${IRS_EN.frist5472}). With income from business in the US, Form 1040-NR (individual) or Form 1120-F (GmbH) is added. Several shareholders file Form 1065; a corporation files Form 1120. With foreign accounts above ${SCHWELLEN_EN.fbar}, the FBAR is added.`,
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
        typ: "text", id: "geschaeft", h2: "The decisive factor: business in the US",
        absaetze: [
          "The US taxes foreigners mainly on income that is actually connected with a business in the US (“effectively connected income”). Whether such a business exists is decided by the facts: staff, an office or warehouse on site, agents with authority to conclude contracts, an ongoing activity in the US. Anyone who performs the work for US customers entirely in Europe generally earns no such income — anyone who operates a warehouse there or employs staff usually does.",
          "The double taxation agreement between Germany and the US draws a second line. The US may tax business profits only to the extent that they are attributable to a permanent establishment there (Articles 5 and 7). A US certified public accountant (CPA) clarifies whether the agreement applies in your case and what information the IRS requires for it.",
        ],
      },
      {
        typ: "text", id: "einzel", h2: "The single-member LLC without US business",
        absaetze: [
          "A common case for founders from Germany, Austria and Switzerland: the LLC belongs to one person and is not classified as a separate taxable entity. It has no income from business in the US. It then usually pays no US federal tax on its profit. It still has to file: every year Form 5472 with a pro forma Form 1120, by fax or post, not electronically.",
          `Even the capital contribution at formation must be reported, as must every withdrawal and every loan between you and the company. The penalty for a missing filing is ${IRS_EN.strafe5472}. The company reports under its EIN; for a shareholder without a US tax number, the IRS permits a reference number.`,
        ],
      },
      {
        typ: "text", id: "mehrere", h2: "Several shareholders: the LLC as a partnership",
        absaetze: [
          `If the LLC has two or more shareholders, it is treated as a partnership for tax purposes. It files Form 1065 and informs each shareholder of their share. To the extent that its profit is connected with business in the US and is attributable to foreign shareholders, it withholds tax and pays it over: ${SCHWELLEN_EN.abzug1446} (Forms 8804, 8805, 8813). This applies even if it distributes nothing.`,
          "The shareholders then file their own US return and claim a credit for the tax withheld. Since June 2026, the ITIN they need for this has been applied for through the acceptance agent, together with an extract from the partnership agreement.",
        ],
      },
      {
        typ: "text", id: "corporation", h2: "The corporation",
        absaetze: [
          `A corporation is a separate taxable entity; the same applies to an LLC that elects under Form 8832 to be treated as a corporation. It pays federal tax of ${IRS_EN.koerperschaftsteuer} on its profit; state tax is added, in Florida for example ${STAAT_EN.florida.steuer}.`,
          "If it distributes profits to a shareholder in Germany, the agreement limits the US withholding tax. The rate is 5 per cent for companies with at least 10 per cent of the voting rights, otherwise 15 per cent (Article 10). The corporation reports foreign shareholders with 25 per cent or more on Form 5472 as an attachment to its return.",
        ],
      },
      {
        typ: "text", id: "fbar", h2: "Accounts in Europe: the FBAR",
        absaetze: [
          `Under US law, a US company is a US person — even if it belongs to you and is transparent for tax purposes. If it holds accounts outside the US, such as a euro account with a European institution, a reporting duty can arise. If their combined balance exceeds ${SCHWELLEN_EN.fbar} at any time during the year, it reports these accounts annually to FinCEN (FBAR, FinCEN Form 114). The deadline is ${FRISTEN_EN.fbar}.`,
          "This particularly affects companies that transfer funds from the US to accounts in Europe. How such transfers and investments are treated for tax purposes should be clarified before the first transfer. The same applies to the filings they trigger in the US. This rests with a US CPA and your tax adviser in your country of residence.",
        ],
      },
      {
        typ: "text", id: "zuhause", h2: "Duties in your country of residence",
        absaetze: [
          "Everything here concerns the US. Separately, the company is taxable where it is managed and must be reported to the tax office — in Germany under section 138 of the German Fiscal Code (AO). Your tax adviser clarifies which returns are due in your country of residence and how tax paid in the US is credited; both sides must fit together.",
        ],
      },
      {
        typ: "text", id: "fiaon", h2: FIAON_H2,
        absaetze: [
          `Included in the first year of your engagement: the compliance calendar and ${US_MELDUNG} (Form 5472 with Form 1120).`,
          LAUFEND,
        ],
        punkte: [
          `${TEIL.ihrTeil}: Your tax return and the notification in your country of residence rest with you and your tax adviser.`,
          `${TEIL.bedingung}: Taxation is decided by the US tax authority and by the tax office in your country of residence.`,
        ],
      },
      { typ: "paket", id: "mandat", h2: "The first US filing in your engagement", lead: P.karteLead, paket: "global_struktur" },
      {
        typ: "hinweis", id: "wissen", h2: "What you need to know",
        punkte: [
          GLOBAL_PFLICHTHINWEIS.en[0],
          GLOBAL_PFLICHTHINWEIS.en[1],
          "This overview does not replace the review of your case by a US CPA and your tax adviser in your country of residence.",
        ],
      },
    ],
    fragen: [
      { f: "Does my LLC have to file a tax return in the US?", a: "Yes, almost always. An LLC with one foreign shareholder files Form 5472 with a pro forma Form 1120 every year — even without revenue. With business in the US, further returns are added." },
      { f: "Does my LLC pay tax in the US?", a: `A single-member LLC without business in the US usually pays no US federal tax on its profit. With income from business in the US, the shareholder becomes taxable there, to the extent that the agreement allows; a corporation pays ${IRS_EN.koerperschaftsteuer} federal tax.` },
      { f: "When is my LLC’s US tax return due?", a: `Form 5472 with pro forma 1120 by ${IRS_EN.frist5472}. Form 1065 for several shareholders by ${FRISTEN_EN.f1065}, Form 1040-NR without US wages by 15 June.` },
      { f: "Does my LLC have to file an FBAR for European accounts?", a: `Yes, if the company’s accounts outside the US together exceed ${SCHWELLEN_EN.fbar} at any time during the year. It then files the FBAR with FinCEN, by ${FRISTEN_EN.fbar}.` },
      { f: "Do I need an ITIN to file a US tax return?", a: "Anyone who files their own US return as an individual, Form 1040-NR for example, needs an ITIN or SSN. For Form 5472, the company’s EIN is sufficient; for the shareholder, the IRS permits a reference number." },
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
    erschienen: ERSCHIENEN,
    kennung: "FG · 39",
    auge: "Knowledge · Structure",
    h1: "Subsidiary or branch.",
    h1b: "Taking your GmbH to the US.",
    lead: "Anyone expanding into the US with an existing business has three routes: the GmbH itself does business there, or it forms an LLC or a corporation as a subsidiary. The choice determines liability, tax in both countries and filings.",
    ziffern: [
      { wert: "3 routes", label: "branch, LLC, corporation" },
      { wert: "5%", label: "withholding tax under the agreement with at least 10% of the voting rights" },
      { wert: IRS_EN.koerperschaftsteuer, label: "federal tax of the US corporation" },
    ],
    blick: [
      ["Branch", "The GmbH itself in the US — full liability, Form 1120-F"],
      ["LLC as a subsidiary", "Separate liability; tax-transparent unless it makes an election"],
      ["Corporation as a subsidiary", "Separate taxable entity, familiar to banks and investors"],
      ["Agreement", "Withholding tax on dividends 5%; none under certain conditions"],
      ["Filings", "Form 5472, section 138 AO; for the branch, also BOI"],
      ["Tax classification", "Before formation, in both countries"],
      ["With FIAON Global", "Formation of an LLC under one engagement — you settle the structure beforehand"],
    ],
    kurz: `A GmbH (German limited liability company) can do business in the US as a branch or form a subsidiary. The branch is legally the GmbH itself and is fully liable. An LLC as a subsidiary separates liability but is tax-transparent without an election under Form 8832. A corporation as a subsidiary is a separate taxable entity (${IRS_EN.koerperschaftsteuer} federal tax); the double taxation agreement limits withholding tax on dividends.`,
    bloecke: [
      {
        typ: "tabelle", id: "vergleich", h2: "The three routes compared",
        kopf: ["", "Branch", "LLC as a subsidiary", "Corporation as a subsidiary"],
        zeilen: [
          ["Legal status", "the GmbH itself, registered in the state", "a separate company", "a separate company"],
          ["Liability", "the GmbH is fully liable", "limited to the LLC", "limited to the corporation"],
          ["US tax", "the GmbH with Form 1120-F", "without an election: at the GmbH (Form 1120-F); with an election: like a corporation", `its own return, Form 1120, ${IRS_EN.koerperschaftsteuer} federal`],
          ["Profits to the GmbH", "Branch Profits Tax, limited by the agreement", "depending on the election, like a branch or a corporation", "withholding tax on dividends, limited by the agreement"],
          ["Filing", "BOI report as a foreign company", "Form 5472 with pro forma 1120", "Form 5472 as an attachment to Form 1120"],
          ["With US institutions", "application as a foreign company", "application as a US company", "application as a US company; the usual form for loans"],
        ],
        fuss: [
          "Simplified overview. Classification in Germany follows the comparison with German legal forms (Typenvergleich) and may differ from the US classification.",
          "Decisions on accounts and loans rest with the institution concerned.",
        ],
      },
      {
        typ: "text", id: "zweig", h2: "The branch: no separation of liability",
        absaetze: [
          `The GmbH registers in the state as a foreign company (“foreign qualification”) and does business there under its own name. Setting it up involves little effort, but everything sits in the GmbH: contracts, liability, litigation in the US. The GmbH files Form 1120-F every year — deadline ${FRISTEN_EN.f1120f}.`,
          "On profits of the branch that do not remain in the US, the US levies the Branch Profits Tax of 30 per cent. The agreement limits it to 5 per cent and excludes it for certain companies (Article 10, paragraphs 9 and 10). And unlike a US company, the GmbH, as a foreign company registered in a state, remains obliged to file a BOI report with FinCEN.",
        ],
      },
      {
        typ: "text", id: "llc", h2: "The LLC as a subsidiary: tax-transparent",
        absaetze: [
          `If the LLC belongs to the GmbH, liability is separated: creditors of the LLC do not reach through to the GmbH as long as the separation is genuinely maintained. For tax purposes, without an election the LLC is not a separate taxable entity in the US. Its profits from US business are attributed to the GmbH, which then files Form 1120-F as if it had a branch. Form 5472 with a pro forma 1120 is also due every year. ${STAAT_EN.florida.llcSteuer}`,
          "With Form 8832, the LLC can elect to be treated as a corporation. In Germany, the classification is decided separately, by comparison with German legal forms (Typenvergleich); if the classification differs between the two countries, special rules apply. This question belongs before formation.",
        ],
      },
      {
        typ: "text", id: "corp", h2: "Corporation as subsidiary: a separate taxable entity",
        absaetze: [
          `The corporation is a separate taxable entity: it pays ${IRS_EN.koerperschaftsteuer} federal tax on its profit plus state tax. It files Form 1120, with Form 5472 for the GmbH as its shareholder. US institutions and investors are familiar with this form; for loans, leasing and larger facilities it is often the usual one. Each institution decides on any loan.`,
          "If the corporation distributes profits to the GmbH, the agreement limits the US withholding tax to 5 per cent if the GmbH holds at least 10 per cent of the voting rights. No withholding tax is due if the GmbH has held at least 80 per cent of the voting rights for twelve months and meets the requirements of the anti-abuse clause (Article 10, paragraph 3, and Article 28). The tax treatment of the dividend at the level of the GmbH in Germany is governed by section 8b of the German Corporate Income Tax Act (KStG); the tax adviser clarifies the details.",
        ],
      },
      {
        typ: "text", id: "verrechnung", h2: "Transfer pricing: GmbH and subsidiary",
        absaetze: [
          "If the GmbH supplies goods, software or services to the subsidiary, the prices must be set as unrelated third parties would agree them. Both countries check this — the US under its own rules, Germany under the arm’s length principle (section 1 of the German Foreign Tax Act, AStG). The protocol to the agreement refers to the OECD guidelines. The subsidiary also reports each of these payments on Form 5472.",
          "Documenting this from the start helps to prevent disputes in both countries.",
        ],
      },
      {
        typ: "etappen", id: "entscheidung", h2: "Five criteria for the decision",
        etappen: [
          { titel: "Activity in the US", text: "Sales from Europe, staff of your own in the US, a warehouse, projects, investors — the more takes place in the US, the more a subsidiary of your own comes into consideration." },
          { titel: "Risk and liability", text: "Contracts and liability in the US belong in a separate company if they could endanger the GmbH." },
          { titel: "Use of profits", text: "If they stay in the US, the tax there counts; if they flow back, withholding tax and the agreement count." },
          { titel: "Investors and loans", text: "US investors usually require a corporation; for larger loans, institutions often expect one too." },
          { titel: "Tax classification in both countries", text: "Your tax adviser and a US CPA review the structure together before formation." },
        ],
      },
      {
        typ: "text", id: "fiaon", h2: FIAON_H2,
        absaetze: [
          "Your engagement provides for the formation of an LLC. If your GmbH is to hold the shares, or if a corporation comes into consideration for your plans, we agree that with you in a call beforehand.",
          `${weitererSatz("UEBERGANG-EINREICHUNG", "en")} ${UNTERLAGEN.satz}`,
        ],
        punkte: [
          `${TEIL.ihrTeil}: You settle the structure with your tax adviser and a US CPA before formation.`,
          `${TEIL.bedingung}: ${satz("S3", "en")}`,
        ],
      },
      { typ: "paket", id: "mandat", h2: "One engagement — for businesses too", lead: P.karteLead, paket: "global_kapital" },
      {
        typ: "hinweis", id: "wissen", h2: "What you need to know",
        punkte: [
          GLOBAL_PFLICHTHINWEIS.en[0],
          "The separation of liability between a subsidiary and the GmbH depends on its being maintained in practice: its own accounts, its own contracts, its own bookkeeping.",
          KARTEN_HAFTUNG,
        ],
      },
    ],
    fragen: [
      { f: "Should my GmbH form an LLC or a corporation in the US?", a: "For sales and smaller ventures, the LLC is often sufficient: it separates liability but, without an election, is transparent for tax purposes. Investors and, for larger loans, institutions usually expect a corporation; it is also often the clearer form for profits that are meant to stay in the US. The decision belongs before formation — with your tax adviser and a US CPA." },
      { f: "What is the difference between a US subsidiary and a branch?", a: "The branch is the GmbH itself, doing business in the US — it is fully liable. The subsidiary is a separate US company with its own liability, its own tax and its own filings." },
      { f: "What is the US withholding tax on dividends to a GmbH?", a: "Under the agreement, 5 per cent if the GmbH holds at least 10 per cent of the voting rights, otherwise 15 per cent. If it has held at least 80 per cent for twelve months and meets the conditions of the anti-abuse clause, no withholding tax is due." },
      { f: "Does a branch in the US have to file a BOI report?", a: "Yes. Since August 2026, only companies formed in the US are exempt; a GmbH that registers in a state remains obliged to report as a foreign company." },
      { f: "Must I report a US subsidiary to the German tax office?", a: "Yes. The formation or acquisition of an interest in a foreign company must be notified in Germany under section 138 of the German Fiscal Code (AO) — together with the tax return." },
    ],
    paket: "global_kapital",
    weiter: ["/en/business/us-subsidiary", "/en/business/knowledge/llc-vs-corporation", "/en/business/knowledge/llc-tax-returns", "/en/business/from-germany"],
    quellen: [Q.dba, Q.i1120f, Q.i5472, Q.f8832, Q.boi, Q.ao138, Q.astg1, Q.kstg8b],
  },
];
