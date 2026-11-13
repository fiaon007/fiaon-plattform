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
  satz, weitererSatz, type Schritt, type SchrittNr,
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
/** Limit of the telephone route under the IRS Instructions for Form SS-4 (E-510 round 2): only without a legal residence, principal place of business or office in the US. */
const TELEFON_GRENZE = "The IRS provides the telephone route only for applicants with no legal residence, principal place of business or principal office or agency in the US. If the application gives a business address in the US, which is the usual case for an LLC with a US address, the routes are fax or post.";
/** Processing time by fax, according to the IRS and in practice — the first part of IRS_EN.einDauer. */
const EIN_FAX = IRS_EN.einDauer.split("; ")[0];
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
    h1b: "In ten steps, from Germany.",
    lead: "You can form a US LLC from abroad, without residence in the US and without minimum capital. Filing with the state is one of ten steps. This article sets them out in sequence, with fees, responsibilities and common mistakes.",
    ziffern: [
      { wert: "10 steps", label: "from the tax classification at home to the first US filing" },
      { wert: `${STAAT_EN.wyoming.gruendung} – ${STAAT_EN.florida.gruendung}`, label: "state formation fee" },
      { wert: "No", label: "minimum capital, no notary appointment" },
    ],
    blick: [
      ["Requirements", "Passport, home address, a business purpose; no US residence required"],
      ["Sequence", "Tax classification, state, formation, EIN, account application"],
      ["State fee", `Florida ${STAAT_EN.florida.gruendung}, Delaware ${STAAT_EN.delaware.gruendung}, Wyoming ${STAAT_EN.wyoming.gruendung}`],
      ["Duties in the US", "Registered agent, annual report to the state, Form 5472"],
      ["Duties where you reside", "Notification under section 138 AO, tax at the place of management"],
      ["Since August 2026", "BOI reporting has ended for US companies"],
      ["With FIAON Global", "State filing, documents and tax number applications under one engagement"],
    ],
    kurz: `You form a US LLC from Germany in ten steps. First you settle the tax classification, the legal form, the state and the name. The registered agent, the state filing and the operating agreement follow, then the tax numbers, the account application and the compliance calendar. The state fee ranges from ${STAAT_EN.wyoming.gruendung} (Wyoming) to ${STAAT_EN.florida.gruendung} (Florida). The state fee and the Form 5472 filing recur every year.`,
    bloecke: [
      {
        typ: "text", id: "vorab", h2: "Before formation: two questions",
        absaetze: [
          "The first question concerns the purpose of the company. Examples are contracts with US customers, sales through US marketplaces and payments in US dollars. A payment record of its own in the United States can also be the purpose. Legal form, state and structure depend on the answer.",
          "The second question concerns the place of management. A company managed from Germany, Austria or Switzerland is generally taxable there. The tax classification therefore belongs before formation. It also determines whether the LLC should belong to you personally or to your GmbH (a German, Austrian or Swiss limited liability company).",
        ],
      },
      {
        typ: "etappen", id: "schritte", h2: "The ten steps",
        lead: `The sequence is fixed: each step requires the one before it. ${DAUERN}`,
        etappen: [
          { titel: "Plan and tax classification", dauer: "first", text: "You define what the company is for and where it will be managed. A tax adviser with US experience reviews how your country of residence classifies the LLC; in Germany this is a comparison with German legal forms (Typenvergleich). The adviser also identifies the notifications required." },
          { titel: "Choose the legal form", text: "The LLC suits trading, services and a payment record of its own in the United States. The corporation comes into consideration if investors are to join. An LLC can belong to one person, to several people or to your GmbH; each variant has its own tax consequences." },
          { titel: "Choose the state", text: "The choice between Delaware, Florida and Wyoming depends on four criteria. These are the time registration takes, the place of business, planned investors and appointments on site. A company that does business in another state also registers there." },
          { titel: "Check the name", text: "Each state grants a name only once. The name carries the suffix “LLC” or “Limited Liability Company”. Check it in the state’s register and keep two alternative names ready." },
          { titel: "Appoint a registered agent", text: "Every LLC needs a registered agent with a physical address in the state of formation. The agent accepts official mail and lawsuits. The requirement applies from the first day and without interruption." },
          { titel: "File with the state", dauer: "one or two business days to around two weeks, depending on the state", text: `The formation document goes to the state together with the fee. In Florida it is the Articles of Organization (${STAAT_EN.florida.gruendung}), in Delaware the Certificate of Formation (${STAAT_EN.delaware.gruendung}), in Wyoming the Articles of Organization (${STAAT_EN.wyoming.gruendung}). ${GRUENDUNG.bedingung} On registration, the company exists.` },
          { titel: "Draw up the operating agreement", text: "The operating agreement is the contract that governs the LLC internally. It sets out ownership, management, profit distribution and succession. You do not file it with the state; institutions generally ask for it. Since 1 June 2026 the US tax authority, the IRS, has also required it for certain ITIN applications. These are applications based on an interest in an LLC with several shareholders (members)." },
          { titel: "Apply for the EIN", dauer: "by fax or post", text: `The EIN (Employer Identification Number) is the company’s tax identification number. You apply for it with Form SS-4. Without a US Social Security number, the routes are fax or post, not online. ${TELEFON_GRENZE} Processing takes ${IRS_EN.einDauer}. The EIN is required for the account application, the card application and Form 5472, the annual filing with the IRS. The IRS decides on the EIN.` },
          { titel: "The ITIN, if there is a reason", text: "The ITIN is your personal US tax number. The IRS issues it only for a tax reason (Form W-7). It is not needed for the EIN. For a personal credit history in the US it often is." },
          { titel: "Account application, compliance calendar, notification to your tax office", text: "With the formation document, the EIN and the operating agreement, you submit the account application. The institution concerned decides on the account. The ongoing duties then begin: the annual report to the state, Form 5472 by 15 April and the notification under section 138 of the German Fiscal Code (AO)." },
        ],
      },
      {
        typ: "tabelle", id: "kosten", h2: "Costs of formation",
        lead: "The state fee is the smaller part of the costs. The larger part falls to the registered agent, the contracts, the tax numbers and the annual filing. Mistakes in the sequence cause additional costs.",
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
        ],
      },
      {
        typ: "text", id: "boi", h2: "BOI reporting ended in August 2026",
        absaetze: [
          "Until 2025, every new US company reported its beneficial owners to the US authority FinCEN (Beneficial Ownership Information, BOI). For companies formed in the US, this duty has ended. The rule that took effect on 14 August 2026 made that final.",
          "Foreign companies that register to do business in a state must still report. A GmbH with a branch in the US is one example. For an LLC that you form in Florida, Delaware or Wyoming, the report no longer applies. References to penalties for a missed BOI report reflect an outdated position for these companies.",
        ],
      },
      {
        typ: "karten", id: "fehler", h2: "Six common mistakes", spalten: 3,
        karten: [
          { tag: "Mistake", titel: "Form first, classify later", text: "The tax question in your country of residence comes only after formation. By then the structure is fixed, even if the LLC would have fitted better as a subsidiary of the GmbH." },
          { tag: "Mistake", titel: "Choosing the state by its fee", text: "Anyone who does business in Florida and forms in Wyoming also registers in Florida. The fees then arise in both states." },
          { tag: "Mistake", titel: "The agent’s address as head office", text: "Many institutions decline account applications where the business address is a registered agent’s address or a PO box." },
          { tag: "Mistake", titel: "No operating agreement", text: "Institutions generally ask for the operating agreement with the account application. It shows who holds an interest and who may act for the company. Without it, the application remains incomplete." },
          { tag: "Mistake", titel: "Form 5472 not filed", text: `Even the capital contribution at formation must be reported. The penalty for a missing filing is ${IRS_EN.strafe5472}.` },
          { tag: "Mistake", titel: "No notification to the tax office", text: "In Germany, you must notify the tax office of the formation or the interest under section 138 of the German Fiscal Code (AO). You do so with your next tax return." },
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
          "An LLC does not replace a business model. Institutions look at what the company does, not at the state in which it was formed.",
        ],
      },
    ],
    fragen: [
      { f: "As a German, can I set up an LLC in the US?", a: `Yes. Formation requires neither US residence nor US citizenship, and no minimum capital. You need a registered agent in the state of formation and the state fee. ${GRUENDUNG.bedingung}` },
      { f: "How much does it cost to form an LLC?", a: `The state fee is ${STAAT_EN.wyoming.gruendung} in Wyoming, ${STAAT_EN.delaware.gruendung} in Delaware and ${STAAT_EN.florida.gruendung} in Florida. The registered agent and the operating agreement come on top. The state fee and the Form 5472 filing recur every year.` },
      { f: "How long does it take to form an LLC?", a: `Registration currently takes one or two business days in Delaware (with express), around three business days in Wyoming and often around two weeks in Florida. The EIN, the ITIN and the account application take longer. ${satz("S15", "en")}` },
      { f: "Do I need a US address for my LLC?", a: "Yes. The LLC needs a registered agent with an address in the state of formation. For the account application and contracts it also needs a business address. For many institutions the agent’s address is not sufficient; each institution decides for itself which address it accepts." },
      { f: "Does a new LLC still have to file a BOI report?", a: "No, if it was formed in the US. Since 14 August 2026, US companies have been definitively exempt from BOI reporting. Foreign companies that register in a state must still report." },
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
    lead: "The EIN is your US company’s tax identification number. It is required for account and card applications and for every filing with the US tax authority, the IRS. The online application requires a US Social Security number (SSN) or an ITIN, the personal US tax number. Without either, you apply for the EIN with Form SS-4 by fax or post; by phone only if the company has no place of business or office in the US.",
    ziffern: [
      { wert: "No fee", label: "charged by the IRS for the EIN" },
      { wert: "3 routes", label: "fax, post, phone only without a US place of business; online only with an SSN or ITIN" },
      { wert: "9 digits", label: "in the format 12-3456789" },
    ],
    blick: [
      ["What", "Employer Identification Number, the company’s tax identification number"],
      ["When", "After registration with the state"],
      ["Form", "Form SS-4, signed on behalf of the company"],
      ["Routes without an SSN", "Fax or post; phone only without a place of business or office in the US; not online"],
      ["IRS processing time", gross(IRS_EN.einDauer)],
      ["Fee", "None at the IRS"],
      ["With FIAON Global", "Application prepared and filed; the US tax authority decides"],
    ],
    kurz: `Without a US Social Security number (SSN), you apply for the EIN with Form SS-4 to the IRS, the US tax authority. The routes are fax or post, and phone only without a place of business or office in the US. Registration of the company with the state comes first. If the responsible party has neither an SSN nor an ITIN, line 7b reads “foreign” or “N/A”. An LLC with one foreign shareholder (member) enters “${EIN_WEG_EN.zeile9a}” in line 9a.`,
    bloecke: [
      {
        typ: "text", id: "was", h2: "The EIN: purpose and use",
        absaetze: [
          "The Employer Identification Number (EIN) is the tax identification number of a US company. It has nine digits and is issued by the IRS. The name refers to employers, but companies without staff need it too. Institutions require it for every business account, card issuers for every application. Form 5472, the annual filing with the IRS, also requires the EIN.",
          "An LLC with a single foreign shareholder (member) files Form 5472 every year. For that reason alone it needs the EIN. It files under its own name and its own EIN.",
        ],
      },
      {
        typ: "text", id: "online", h2: "Online application: SSN or ITIN required",
        absaetze: [
          "The IRS offers an online application that issues the number in the same session. It requires the responsible party to have a valid SSN or ITIN. Founders from Germany, Austria or Switzerland generally have neither. Their routes are fax and post; phone only if the company has no place of business or office in the US.",
          "There is no need to apply for an ITIN solely for the EIN. The IRS issues the EIN without an ITIN, and the ITIN requires a tax reason of its own.",
        ],
      },
      {
        typ: "text", id: "verantwortlich", h2: "The responsible party",
        absaetze: [
          "The IRS requires the “responsible party” to be named. This is the person who ultimately owns or controls the company. Except for government entities, it must be an individual, not a company. If the LLC belongs to your GmbH, it is the individual who actually directs the GmbH and thus the LLC.",
          "If this person has neither an SSN nor an ITIN and is not eligible for one, line 7b reads “foreign” or “N/A”. The IRS issues only one EIN per responsible party per day.",
        ],
      },
      {
        typ: "tabelle", id: "zeilen", h2: "Form SS-4: the lines that matter",
        lead: "The table applies to an LLC with one foreign shareholder (member). The IRS Instructions for Form SS-4 explain the remaining lines of the form.",
        kopf: ["Line", "What goes in", "Typical mistake"],
        zeilen: [
          ["1", "The name of the LLC as in the formation document, with the suffix “LLC”", "Abbreviations or spellings that differ from the register"],
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
          { tag: "Fax", titel: "About four business days according to the IRS", text: `With a business address in the US, you fax the application to ${EIN_WEG_EN.faxInland}; without a place of business or office in the US, from abroad to ${EIN_WEG_EN.faxAusland}. Give a fax number for the reply; the IRS then returns the number by the same route. Processing time: ${EIN_FAX}.` },
          { tag: "Post", titel: "About four weeks according to the IRS", text: `With a business address in the US, the address is: ${EIN_WEG_EN.postInland}. Without a place of business or office in the US: ${EIN_WEG_EN.post}. If a detail is missing, the time for the query is added.` },
          { tag: "Phone", titel: "Only without a US place of business", text: `The IRS takes the application on ${EIN_WEG_EN.telefon}, ${EIN_WEG_EN.telefonZeit}. ${TELEFON_GRENZE} The call may be made by anyone authorised to sign for the company or authorised as designee.` },
        ],
      },
      {
        typ: "text", id: "danach", h2: "After the number is assigned",
        absaetze: [
          "The IRS confirms the number with a letter (CP 575). Keep it: institutions ask for it with the account application. If it is lost, the IRS confirms the number again on request (Letter 147C).",
          "If the address or the responsible party changes, report this to the IRS within sixty days with Form 8822-B.",
        ],
      },
      {
        typ: "text", id: "fiaon", h2: FIAON_H2,
        absaetze: [
          "The EIN application is part of your engagement. We prepare Form SS-4 and present it ready for your signature. We file it with the IRS and track the application. We clarify any queries from the IRS with you and place the IRS letter in your portal.",
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
          "The EIN is a tax number, not an approval. Whether an institution opens an account is for that institution to decide.",
          GLOBAL_PFLICHTHINWEIS.en[1],
          "Whoever signs Form SS-4 declares to the IRS that the information is correct. Spellings and figures must match the formation document.",
        ],
      },
    ],
    fragen: [
      { f: "Can I get an EIN without an SSN?", a: `Yes. Without an SSN or ITIN, you apply for the EIN with Form SS-4 by fax or by post. ${TELEFON_GRENZE} Only the online application requires an SSN or ITIN.` },
      { f: "How long does it take to get an EIN?", a: `${gross(IRS_EN.einDauer)}. ${TELEFON_GRENZE} ${satz("S15", "en")}` },
      { f: "Does it cost anything to get an EIN?", a: "The IRS charges no fee for the EIN. Costs arise only if you engage a service provider for the application." },
      { f: "Do I need an ITIN to apply for an EIN?", a: "No. If the responsible party has neither an SSN nor an ITIN, line 7b of Form SS-4 reads “foreign” or “N/A”." },
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
    lead: "The ITIN is your personal tax number in the US. The US tax authority, the IRS, issues it only for tax purposes and only with a stated reason. Creditworthiness alone is not a reason. An application with a sound reason and complete supporting documents avoids queries.",
    ziffern: [
      { wert: "Form W-7", label: "with passport and tax reason" },
      { wert: "5 exceptions", label: "allow an application without a US tax return" },
      { wert: "9 digits", label: "begins with a 9 and serves tax purposes only" },
    ],
    blick: [
      ["What", "Individual Taxpayer Identification Number, for people without a US Social Security number (SSN)"],
      ["Who", "Anyone who has to file a US tax return or qualifies for an exception"],
      ["Form", "Form W-7, as a rule with a tax return"],
      ["Passport", "Original, copy certified by the issuing authority, or verification by a Certifying Acceptance Agent (CAA)"],
      ["IRS processing time", gross(IRS_EN.itinDauer)],
      ["Expiry", "After three tax years without a return"],
      ["With FIAON Global", "ITIN check first; an application only with a sound reason"],
    ],
    kurz: "You apply for the ITIN with Form W-7 to the US tax authority, the IRS, as a rule together with a US tax return. Without a tax return, the application needs one of the IRS’s five exceptions. The ITIN is not needed for your company’s tax number (EIN). You send the passport as the original or as a copy certified by the issuing authority; alternatively, a Certifying Acceptance Agent (CAA) verifies it.",
    bloecke: [
      {
        typ: "text", id: "was", h2: "The ITIN: purpose and limits",
        absaetze: [
          "The IRS issues the Individual Taxpayer Identification Number (ITIN) to people who must be identified for tax purposes in the US. The condition is that they are not eligible for a US Social Security number (SSN). The ITIN has nine digits, begins with a 9 and serves tax purposes only.",
          "An ITIN confers no work permit, no residence permit and no entitlement to US Social Security benefits. Outside tax law, it does not serve as identification.",
        ],
      },
      {
        typ: "text", id: "grund", h2: "The tax reason decides",
        absaetze: [
          "The IRS requires a reason with every application. As a rule, you submit Form W-7 together with a US tax return. One example: as a shareholder (member) of an LLC, you declare income from business in the US. Without a tax return, the application is admissible only if one of the IRS’s five exceptions applies.",
          "One exception concerns partners in a partnership with assets in the US. The condition is that the income from those assets is reportable and subject to withholding. For tax purposes this includes the LLC with several shareholders. Since 1 June 2026, an acceptance agent encloses part of the partnership agreement with such applications. That part shows the partnership’s name and EIN and the applicant’s name and signature.",
          "The IRS does not issue an ITIN for credit purposes alone. It rejects an application that relies on that.",
        ],
      },
      {
        typ: "etappen", id: "ablauf", h2: "The application process",
        lead: DAUERN,
        etappen: [
          { titel: "Clarify the reason", text: "A US certified public accountant (CPA) reviews which tax return or which exception supports the application. Without a sound reason, no application is made." },
          { titel: "Complete Form W-7", text: "You tick the reason; for non-residents with a US tax return this is usually “b”. Then come your name as in the passport, your address abroad, birth details and passport details. If an exception applies, you enclose its supporting documents." },
          { titel: "Have the passport verified", text: "The passport alone is sufficient proof of identity and nationality. It goes to the IRS as the original or as a copy certified by the issuing authority. Alternatively, a Certifying Acceptance Agent (CAA) verifies it in person and returns it at the appointment." },
          { titel: "Submit", text: "The application goes to the IRS ITIN office in Austin, Texas, with the tax return or proof of the exception. Alternatively, the acceptance agent submits it." },
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
          "A notarised copy is not enough for the IRS. The certification must come from the issuing authority.",
          `Acceptance agents charge ${MARKT_EN.acceptanceAgent} for verification and submission (market rate, ${FAKTEN_STAND_EN}).`,
        ],
      },
      {
        typ: "text", id: "verfall", h2: "Expiry of the ITIN",
        absaetze: [
          "An ITIN that does not appear on any US tax return for three consecutive tax years expires on 31 December of the third year. Accordingly, all ITINs that were not used in the years 2022, 2023 and 2024 expired on 31 December 2025.",
          "You renew an expired ITIN with Form W-7. The effort is the same as for the first application. To keep the number, you therefore need an ongoing tax reason.",
        ],
      },
      {
        typ: "karten", id: "karten", h2: "ITIN, account and cards", spalten: 2,
        karten: [
          { tag: "Correct", titel: "Some issuers ask for the ITIN", text: "In practice, the US credit bureaus track a personal credit history by SSN or ITIN. Some card issuers consider applications with an ITIN, others require an SSN. Each issuer decides this for itself." },
          { tag: "Incorrect", titel: "“With an ITIN, cards follow”", text: "An ITIN is a prerequisite, not a commitment. The issuer decides on every application based on history, income and business." },
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
          "The ITIN serves tax purposes only. Whoever applies for it takes on the duties on which the application is based, an annual US tax return for instance.",
          KARTEN_HAFTUNG,
          "An ITIN does not replace an SSN. Separate rules apply to work and social benefits in the US.",
        ],
      },
    ],
    fragen: [
      { f: "Do I need an ITIN for my LLC?", a: "Not for the company’s EIN. You need an ITIN personally if you have to file a tax return in the US or if one of the IRS exceptions applies." },
      { f: "How long does an ITIN application take?", a: `${gross(IRS_EN.itinDauer)}. ${satz("S15", "en")}` },
      { f: "Do I have to send my original passport to get an ITIN?", a: "No, you do not have to send it to the US. A copy certified by the issuing authority is sufficient in place of the original. Alternatively, a Certifying Acceptance Agent authorised by the IRS verifies your passport." },
      { f: "Can I apply for an ITIN just for a credit card?", a: "No. The IRS issues ITINs only for tax purposes; the application needs a tax return or an exception. Some card issuers ask for the ITIN. The issuer decides on the card." },
      { f: "Does an ITIN expire?", a: "Yes, if it does not appear on any US tax return for three consecutive tax years. It then expires on 31 December of the third year. You renew it with Form W-7." },
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
    lead: "Every LLC needs a registered agent in the state of formation from the first day. Every state requires this. For an account application and contracts it also needs a business address that the institution concerned accepts. A phone number that someone answers is needed as well.",
    ziffern: [
      { wert: "Required", label: "in every state, without interruption" },
      { wert: "3 addresses", label: "agent, business address, mailing address" },
      { wert: "4th Friday in September", label: "dissolution in Florida if the annual report is missing" },
    ],
    blick: [
      ["Registered agent", "Accepts lawsuits and official mail; a legal requirement"],
      ["Agent’s address", "Physical, in the state of formation, not a PO box"],
      ["Business address", "Where the company can be reached; institutions check it"],
      ["Mailing address", "Where the US tax authority, the IRS, sends its letters"],
      ["Phone number", "A US number that someone answers"],
      ["Missing agent", "Delinquent status with the state; administrative dissolution is possible"],
      ["With FIAON Global", "Agent, address and number included in the first year"],
    ],
    kurz: "The registered agent is the point to which courts and authorities in the state of formation deliver lawsuits and official documents. The agent needs a physical address in that state and must be reachable during business hours. Every state requires one. The agent’s address is not a business address. For an account, institutions require an address at which the company can be reached; a PO box is usually not enough.",
    bloecke: [
      {
        typ: "text", id: "agent", h2: "The registered agent’s role",
        absaetze: [
          "In the US, a lawsuit is handed over in person (“service of process”), not delivered by post. Every state therefore requires a registered agent, including for companies without an office in the state. The agent is a person or business with an address in the state. The agent accepts lawsuits and letters from authorities and passes them on without delay.",
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
        typ: "text", id: "institute", h2: "Physical address: what institutions require",
        absaetze: [
          "US institutions must verify the identity of every customer. For companies, this includes an address: the principal place of business, a local office or another physical location of business (31 CFR 1020.220). An address shared by hundreds of companies does not serve this purpose.",
          "Many institutions therefore decline account applications where the business address is a registered agent’s address, a PO box or a mere mailbox. Others accept a business address abroad if it fits the business. Each institution decides for itself which address is sufficient.",
        ],
      },
      {
        typ: "text", id: "telefon", h2: "The phone number",
        absaetze: [
          "Card issuers and institutions call: to confirm an application, to raise queries and about unusual payments. If the US number rings out or only plays a recorded message, the query remains open. Each institution decides for itself how it handles that. The number should therefore belong to the company, be reachable and be the same in all documents.",
        ],
      },
      {
        typ: "karten", id: "folgen", h2: "Consequences of a missing agent", spalten: 3,
        karten: [
          { tag: "Consequence", titel: "No service of process", text: "If the court cannot find an agent, many states provide for service via the Secretary of State. Anyone who never hears about it misses deadlines. The result can be a default judgment." },
          { tag: "Consequence", titel: "Loss of good standing", text: "Without an agent, the company loses its “good standing” with the state. Institutions and contracting parties check this status." },
          { tag: "Consequence", titel: "Administrative dissolution", text: "In Florida, the state can dissolve an LLC without a registered agent (§ 605.0714). The same applies if the annual report is missing: dissolution then follows on the fourth Friday in September." },
        ],
      },
      {
        typ: "text", id: "wechsel", h2: "Changing the agent",
        absaetze: [
          "A change is possible at any time. The new agent declares its consent, and the company reports the change to the state. There is usually a separate form and a fee. Terminate the previous agent only once the new one appears in the register. Any gap in between interrupts service.",
          "If the agent’s name or address changes, this must also appear in the register. In Florida the change must be reported within thirty days. Otherwise the state can dissolve the company administratively (§ 605.0714).",
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
          "A US address does not move the place of management. For tax purposes, what counts is where the company is actually managed.",
          GLOBAL_PFLICHTHINWEIS.en[0],
          "If the company does business in another state, it generally needs its own registered agent there.",
        ],
      },
    ],
    fragen: [
      { f: "What is a registered agent?", a: "The registered agent is the point of contact that the law requires a US company to have in its state of formation. The agent accepts lawsuits and official documents and passes them on. Every state requires one." },
      { f: "Can I be my own registered agent?", a: "Only if you live in the state of formation or have an office there that is staffed during business hours. For founders from Europe, a commercial agent is the norm." },
      { f: "Can I use the registered agent’s address as my business address?", a: "Legally it is the agent’s address, not your place of business. Many institutions decline account applications that give this address as the business address. Each institution decides for itself which address is sufficient." },
      { f: "How much does a registered agent cost?", a: `Commercial agents charge ${MARKT_EN.agent}. This is a market rate, not an official figure (as at ${FAKTEN_STAND_EN}).` },
      { f: "What happens if my LLC has no registered agent?", a: "It loses its good standing with the state. If the defect persists, the state can dissolve it. Lawsuits may then not reach you in time." },
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
    h1b: "Forms and deadlines by structure.",
    lead: "An LLC generally files a tax return in the US even if it pays no tax there. Which forms apply depends on ownership, tax classification and business in the US. This overview sets out forms and deadlines by structure.",
    ziffern: [
      { wert: "15 April", label: "deadline for Form 5472 with Form 1120" },
      { wert: IRS_EN.koerperschaftsteuer, label: "federal tax on the profits of a corporation" },
      { wert: "$10,000", label: "foreign accounts combined; above this, the FBAR must be filed" },
    ],
    blick: [
      ["Single-member LLC without US business", "Form 5472 with pro forma Form 1120"],
      ["Single-member LLC with US business", "In addition, Form 1040-NR (individual) or 1120-F (GmbH)"],
      ["Several shareholders", "Form 1065, withholding for foreign shareholders"],
      ["Corporation", `Form 1120, ${IRS_EN.koerperschaftsteuer} federal tax`],
      ["Accounts outside the US", `FBAR above ${SCHWELLEN_EN.fbar} in total`],
      ["Country of residence", "Tax return and notification under section 138 AO, separately from the US"],
      ["With FIAON Global", `Included in the first year: ${US_MELDUNG}`],
    ],
    kurz: `An LLC with one foreign shareholder (member) files Form 5472 with a pro forma Form 1120 in the US every year (${IRS_EN.frist5472}). With income from business in the US, Form 1040-NR (individual) or Form 1120-F (GmbH) is added. An LLC with several shareholders files Form 1065; a corporation files Form 1120. With foreign accounts above ${SCHWELLEN_EN.fbar}, the FBAR report is added.`,
    bloecke: [
      {
        typ: "tabelle", id: "uebersicht", h2: "Overview: returns and deadlines",
        kopf: ["Structure", "Return", "Deadline for a calendar year"],
        zeilen: [
          ["LLC with one foreign shareholder, without business in the US", "Form 5472 with pro forma Form 1120", IRS_EN.frist5472],
          ["The same LLC with income from US business, owned by an individual", "in addition, the shareholder’s Form 1040-NR", FRISTEN_EN.f1040nr],
          ["The same LLC, owned by a GmbH", "in addition, the GmbH’s Form 1120-F", FRISTEN_EN.f1120f],
          ["LLC with several shareholders", "Form 1065 with statements of each shareholder’s share; withholding on the shares of foreign shareholders (Forms 8804, 8805)", FRISTEN_EN.f1065],
          ["Corporation, including an LLC that has elected corporate treatment on Form 8832", `Form 1120, federal tax ${IRS_EN.koerperschaftsteuer}; plus Form 5472 for a foreign shareholder with 25% or more`, "15 April, extendable to 15 October with Form 7004"],
          [`Any US company with foreign accounts above ${SCHWELLEN_EN.fbar}`, "FBAR (FinCEN Form 114); filed with the US authority FinCEN, not the IRS", FRISTEN_EN.fbar],
        ],
        fuss: ["Simplified overview based on the instructions of the US tax authority, the IRS, and of FinCEN. The states require their own returns depending on the activity."],
      },
      {
        typ: "text", id: "geschaeft", h2: "The decisive factor: business in the US",
        absaetze: [
          "The US taxes foreigners mainly on income that is actually connected with a business in the US (“effectively connected income”). Whether such a business exists is decided by the facts. They include staff, an office or warehouse on site, agents with authority to conclude contracts and an ongoing activity in the US. Anyone who performs the work for US customers entirely in Europe generally earns no such income. Anyone who operates a warehouse or employs staff in the US usually does.",
          "The double taxation agreement between Germany and the US contains a second condition. The US may tax business profits only to the extent that they are attributable to a permanent establishment in the US (Articles 5 and 7). A US certified public accountant (CPA) clarifies whether the agreement applies in your case and what information the IRS requires for it.",
        ],
      },
      {
        typ: "text", id: "einzel", h2: "The single-member LLC without US business",
        absaetze: [
          "This case is common among founders from Germany, Austria and Switzerland. The LLC belongs to one person and is not treated as a separate taxable entity. It has no income from business in the US. It then usually pays no US federal tax on its profit. It still files every year: Form 5472 with a pro forma Form 1120, by fax or post, not electronically.",
          `Even the capital contribution at formation must be reported, as must every withdrawal and every loan between you and the company. The penalty for a missing filing is ${IRS_EN.strafe5472}. The company reports under its EIN; for a shareholder without a US tax number, the IRS permits a reference number.`,
        ],
      },
      {
        typ: "text", id: "mehrere", h2: "Several shareholders: the LLC as a partnership",
        absaetze: [
          `If the LLC has two or more shareholders, it is treated as a partnership for tax purposes. It files Form 1065 and informs each shareholder of their share. On profit that is connected with business in the US and attributable to foreign shareholders, it withholds tax and pays it over. The rate is ${SCHWELLEN_EN.abzug1446} (Forms 8804, 8805, 8813). This applies even if it distributes nothing.`,
          "The shareholders then file their own US return and claim a credit for the tax withheld. They need an ITIN for this. Since June 2026, the acceptance agent applies for it with an extract from the partnership agreement.",
        ],
      },
      {
        typ: "text", id: "corporation", h2: "The corporation",
        absaetze: [
          `A corporation is a separate taxable entity. The same applies to an LLC that elects on Form 8832 to be treated as a corporation. It pays federal tax of ${IRS_EN.koerperschaftsteuer} on its profit. State tax is added, in Florida for example ${STAAT_EN.florida.steuer}.`,
          "If it distributes profits to a shareholder in Germany, the agreement limits the US withholding tax (Article 10). The rate is 5 per cent for companies with at least 10 per cent of the voting rights, otherwise 15 per cent. The corporation reports foreign shareholders with 25 per cent or more on Form 5472 as an attachment to its return.",
        ],
      },
      {
        typ: "text", id: "fbar", h2: "Accounts in Europe: the FBAR",
        absaetze: [
          `Under US law, a US company is a US person, even if it belongs to you and is transparent for tax purposes. If it holds accounts outside the US, such as a euro account with a European institution, a reporting duty can arise. If their combined balance exceeds ${SCHWELLEN_EN.fbar} at any time during the year, it reports these accounts annually to FinCEN (FBAR, FinCEN Form 114). The deadline is ${FRISTEN_EN.fbar}.`,
          "This mainly affects companies that transfer funds from the US to accounts in Europe. You clarify the tax treatment of such transfers and investments before the first transfer. The same applies to the filings they trigger in the US. This rests with a US CPA and your tax adviser in your country of residence.",
        ],
      },
      {
        typ: "text", id: "zuhause", h2: "Duties in your country of residence",
        absaetze: [
          "This article covers the duties in the US. Separately, the company is taxable where it is managed and must be reported to the tax office, in Germany under section 138 of the German Fiscal Code (AO). Your tax adviser clarifies which returns are due in your country of residence and how tax paid in the US is credited. The returns in both countries must be consistent with each other.",
        ],
      },
      {
        typ: "text", id: "fiaon", h2: FIAON_H2,
        absaetze: [
          `The first year of your engagement includes the compliance calendar. It also includes ${US_MELDUNG} (Form 5472 with Form 1120).`,
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
      { f: "Does my LLC have to file a tax return in the US?", a: "As a rule, yes. An LLC with one foreign shareholder files Form 5472 with a pro forma Form 1120 every year, even without revenue. With business in the US, further returns are added." },
      { f: "Does my LLC pay tax in the US?", a: `That depends on the structure. A single-member LLC without business in the US usually pays no US federal tax on its profit. With income from business in the US, the shareholder becomes taxable there, to the extent that the agreement allows. A corporation pays ${IRS_EN.koerperschaftsteuer} federal tax.` },
      { f: "When is my LLC’s US tax return due?", a: `Form 5472 with pro forma 1120 is due by ${IRS_EN.frist5472}. Form 1065 for several shareholders is due by ${FRISTEN_EN.f1065}, Form 1040-NR without US wages by 15 June.` },
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
    lead: "An existing business has three routes into the US: a branch, an LLC as a subsidiary or a corporation as a subsidiary. The choice determines liability, tax in both countries and filings.",
    ziffern: [
      { wert: "3 routes", label: "branch, LLC, corporation" },
      { wert: "5%", label: "withholding tax under the agreement with at least 10% of the voting rights" },
      { wert: IRS_EN.koerperschaftsteuer, label: "federal tax of the US corporation" },
    ],
    blick: [
      ["Branch", "The GmbH itself in the US; full liability, Form 1120-F"],
      ["LLC as a subsidiary", "Separate liability; tax-transparent unless it makes an election"],
      ["Corporation as a subsidiary", "Separate taxable entity; familiar to institutions and investors"],
      ["Agreement", "Withholding tax on dividends 5%; none under certain conditions"],
      ["Filings", "Form 5472, section 138 AO; for the branch, also the BOI report"],
      ["Tax classification", "Before formation, in both countries"],
      ["With FIAON Global", "Formation of an LLC under one engagement; you settle the structure beforehand"],
    ],
    kurz: `A GmbH (German limited liability company) can do business in the US as a branch or form a subsidiary. The branch is legally the GmbH itself; the GmbH is fully liable. An LLC as a subsidiary separates liability but is tax-transparent without an election on Form 8832. A corporation as a subsidiary is a separate taxable entity (${IRS_EN.koerperschaftsteuer} federal tax). The double taxation agreement limits withholding tax on dividends.`,
    bloecke: [
      {
        typ: "tabelle", id: "vergleich", h2: "The three routes compared",
        kopf: ["", "Branch", "LLC as a subsidiary", "Corporation as a subsidiary"],
        zeilen: [
          ["Legal status", "the GmbH itself, qualified as a foreign company in the state", "a separate company", "a separate company"],
          ["Liability", "the GmbH is fully liable", "limited to the LLC", "limited to the corporation"],
          ["US tax", "the GmbH with Form 1120-F", "without an election: at the GmbH (Form 1120-F); with an election: like a corporation", `its own return, Form 1120, ${IRS_EN.koerperschaftsteuer} federal`],
          ["Profits to the GmbH", "Branch Profits Tax, limited by the agreement", "depending on the election, like a branch or a corporation", "withholding tax on dividends, limited by the agreement"],
          ["Filing", "BOI report as a foreign company", "Form 5472 with pro forma 1120", "Form 5472 as an attachment to Form 1120"],
          ["With US institutions", "application as a foreign company", "application as a US company", "application as a US company; often the usual form for loans"],
        ],
        fuss: [
          "Simplified overview. Classification in Germany follows the comparison with German legal forms (Typenvergleich) and may differ from the US classification.",
          "Decisions on accounts and loans rest with the institution concerned.",
        ],
      },
      {
        typ: "text", id: "zweig", h2: "Branch: the GmbH itself is liable",
        absaetze: [
          `The GmbH registers in the state as a foreign company (“foreign qualification”) and does business there under its own name. Setting it up involves little effort. In return, contracts, liability and litigation in the US rest with the GmbH itself. The GmbH files Form 1120-F every year; the deadline is ${FRISTEN_EN.f1120f}.`,
          "On profits of the branch that do not remain in the US, the US levies the Branch Profits Tax of 30 per cent. The agreement limits it to 5 per cent and excludes it for certain companies (Article 10, paragraphs 9 and 10). Unlike a US company, the GmbH remains obliged to file a BOI report with the US authority FinCEN. The reason is its registration as a foreign company in a state.",
        ],
      },
      {
        typ: "text", id: "llc", h2: "The LLC as a subsidiary: tax-transparent",
        absaetze: [
          `If the LLC belongs to the GmbH, liability is separated. Creditors of the LLC have no recourse to the GmbH as long as the separation is maintained in practice. For tax purposes, without an election the LLC is not a separate taxable entity in the US. The US attributes its profits from US business to the GmbH. The GmbH then files Form 1120-F as if it had a branch. Form 5472 with a pro forma 1120 is also due every year. ${STAAT_EN.florida.llcSteuer}`,
          "With Form 8832, the LLC can elect to be treated as a corporation. In Germany, the classification is decided separately, by comparison with German legal forms (Typenvergleich). If the classification differs between the two countries, special rules apply. You settle this question before formation.",
        ],
      },
      {
        typ: "text", id: "corp", h2: "Corporation as subsidiary: a separate taxable entity",
        absaetze: [
          `The corporation is a separate taxable entity. It pays ${IRS_EN.koerperschaftsteuer} federal tax on its profit plus state tax. It files Form 1120, with Form 5472 for the GmbH as its shareholder. US institutions and investors are familiar with this form. For loans, leasing and larger facilities it is often the usual form. Each institution decides on any loan.`,
          "If the corporation distributes profits to the GmbH, the agreement limits the US withholding tax to 5 per cent. The condition is that the GmbH holds at least 10 per cent of the voting rights. No withholding tax is due if the GmbH has held at least 80 per cent of the voting rights for twelve months. It must also meet the requirements of the anti-abuse clause (Article 10, paragraph 3, and Article 28). Section 8b of the German Corporate Income Tax Act (KStG) governs the treatment of the dividend at the GmbH in Germany. Your tax adviser clarifies the details.",
        ],
      },
      {
        typ: "text", id: "verrechnung", h2: "Transfer pricing: GmbH and subsidiary",
        absaetze: [
          "If the GmbH supplies goods, software or services to the subsidiary, the transfer pricing must match what unrelated third parties would agree. Both countries check this: the US under its own rules, Germany under the arm’s length principle (section 1 of the German Foreign Tax Act, AStG). The protocol to the agreement refers to the OECD guidelines. The subsidiary also reports each of these payments on Form 5472.",
          "Documenting this from the start helps to prevent disputes in both countries.",
        ],
      },
      {
        typ: "etappen", id: "entscheidung", h2: "Five criteria for the decision",
        etappen: [
          { titel: "Activity in the US", text: "Examples are sales from Europe, staff of your own in the US, a warehouse, projects and investors. The more of this takes place in the US, the more a subsidiary of your own comes into consideration." },
          { titel: "Risk and liability", text: "Contracts and liability in the US belong in a separate company if they could endanger the GmbH." },
          { titel: "Use of profits", text: "If the profits stay in the US, the tax there counts. If they flow back to the GmbH, withholding tax and the agreement count." },
          { titel: "Investors and loans", text: "US investors usually require a corporation. For larger loans, institutions often expect one too. The institution concerned decides on any loan." },
          { titel: "Tax classification in both countries", text: "Your tax adviser and a US CPA review the structure together before formation." },
        ],
      },
      {
        typ: "text", id: "fiaon", h2: FIAON_H2,
        absaetze: [
          "Your engagement provides for the formation of an LLC. If you request your proposal through the fee calculator, you become a shareholder personally. If your GmbH is to hold the shares, we agree this with you in conversation. If a corporation comes into consideration for your plans, we also clarify that with you beforehand.",
          `${weitererSatz("UEBERGANG-EINREICHUNG", "en")} ${UNTERLAGEN.satz}`,
        ],
        punkte: [
          `${TEIL.ihrTeil}: You settle the structure before formation, with your tax adviser and a US CPA.`,
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
      { f: "Should my GmbH form an LLC or a corporation in the US?", a: "That depends on your plans. For sales and smaller ventures, the LLC is often sufficient: it separates liability but, without an election, is transparent for tax purposes. Investors usually expect a corporation, as do institutions for larger loans. It is also often the suitable form for profits that are meant to stay in the US. You take the decision before formation, with your tax adviser and a US CPA." },
      { f: "What is the difference between a US subsidiary and a branch?", a: "The branch is the GmbH itself, doing business in the US; the GmbH is fully liable. The subsidiary is a separate US company with its own liability, its own tax and its own filings." },
      { f: "What is the US withholding tax on dividends to a GmbH?", a: "Under the agreement it is 5 per cent if the GmbH holds at least 10 per cent of the voting rights, otherwise 15 per cent. If the GmbH has held at least 80 per cent for twelve months and meets the conditions of the anti-abuse clause, no withholding tax is due." },
      { f: "Does a branch in the US have to file a BOI report?", a: "Yes. Since August 2026, only companies formed in the US are exempt. A GmbH that registers in a state remains obliged to report as a foreign company." },
      { f: "Must I report a US subsidiary to the German tax office?", a: "Yes. In Germany, the formation or acquisition of an interest in a foreign company must be notified under section 138 of the German Fiscal Code (AO), together with the tax return." },
    ],
    paket: "global_kapital",
    weiter: ["/en/business/us-subsidiary", "/en/business/knowledge/llc-vs-corporation", "/en/business/knowledge/llc-tax-returns", "/en/business/from-germany"],
    quellen: [Q.dba, Q.i1120f, Q.i5472, Q.f8832, Q.boi, Q.ao138, Q.astg1, Q.kstg8b],
  },
];
