// ═══════════════════════════════════════════════════════════════════════════
// FIAON GLOBAL — DIE LEISTUNGEN AUF ENGLISCH (24.09.2026, E-234 · neu gefasst 13.11.2026, E-510)
// Die sechs Leistungsseiten aus ../leistungen.ts in britischem Englisch:
// US company formation, EIN and ITIN, US business bank account, financing and
// business credit cards, US compliance, in person in Miami. Gleicher Aufbau,
// gleiche Anker (ids bleiben deutsch), gleiche Quellen — scripts/pruef-global-en.ts
// hält beide Fassungen deckungsgleich.
//
// E-510 (13.11.2026): Jede Seite folgt dem Sprachleitfaden FIAON Global — was wir tun, unter
// welcher Bedingung, wer entscheidet. Die festen Sätze (S1 bis S17), die sechs Schritte, die Tabelle
// „Wer macht was“ und die Belege kommen aus shared/fiaon-global-saetze.ts (Feld en) und werden hier
// nie ein zweites Mal getippt. Ein Wort je Sache: engagement · client · fee · funding target ·
// the lender · proposal · fee calculator · annual administration. Kein Betrag ist getippt: Honorare
// aus SAETZE_BETRAEGE.en (Preisquelle), die Kurzform der Spanne aus EIN_PRODUKT.en.
//
// WAS HIER NIE STEHT: eine Zusage zu Konto, Karte oder Finanzierung, eine Dauer als Zusage, ein
// Zinssatz, ein Bankname, ein Steuerversprechen, ein Ort oder eine Anschrift einer Partnergesellschaft.
// Die Erstattung nach Ziffer 4 steht nur bei der Finanzierung. Die Frage zur Verwendung der Mittel
// kommt wortgleich aus GLOBAL_KAPITAL_FREI.en (eine Quelle).
// ═══════════════════════════════════════════════════════════════════════════
import { GLOBAL_PFLICHTHINWEIS, GLOBAL_KAPITAL_FREI } from "../../fiaon-global";
import {
  GELD_ZURUECK, SAETZE_BETRAEGE, SCHRITTE_KOPF, SECHS_SCHRITTE,
  beleg, satz, weitererSatz, type Schritt, type SchrittNr,
} from "../../fiaon-global-saetze";
import { EIN_PRODUKT } from "../ein-produkt";
import { IRS_EN, QUELLEN_RECHT_EN } from "../fakten-en";
import type { GlobalSeite } from "../typen";

const S = "2026-11-13";
const ERSCHIENEN = "2026-09-24";
/** The amounts from the price source — fee on engagement, minimum success fee, annual administration, range. */
const B = SAETZE_BETRAEGE.en;
/** “US$50,000 – US$1,000,000” — the short form of the range for the key figure. */
const RAHMEN_KURZ = EIN_PRODUKT.en.rahmenKurz;
const KOPF = SCHRITTE_KOPF.en;
/** One step of the fixed narrative (language guide 2.3) — sentence, condition and decision-maker from the one source. */
const schritt = (nr: SchrittNr): Schritt => SECHS_SCHRITTE.en.find((x) => x.nr === nr)!;
/** One row of the table “who does what” (language guide 2.4). */
const werZeile = (nr: SchrittNr): string[] => {
  const x = schritt(nr);
  return [`${x.nr} ${x.titel}`, x.werMachtWas.fiaon, x.werMachtWas.sie, x.entscheidet, x.werMachtWas.wennEsAusbleibt];
};
const WER_KOPF: string[] = [KOPF.spalten.schritt, KOPF.spalten.fiaon, KOPF.spalten.sie, KOPF.spalten.entscheidet, KOPF.spalten.wennEsAusbleibt];
/** First letter in upper case — for a phrase that starts a list item. */
const gross = (t: string): string => t.charAt(0).toUpperCase() + t.slice(1);
/** Without the final full stop — a fixed sentence as a line of a list whose lines end without one. */
const ohnePunkt = (t: string): string => t.replace(/\.$/, "");

/** Heading and first sentence of the card “One engagement” (language guide 7.2 and 8.2). */
const KARTE_H2 = "One engagement";
const EIN_MANDAT = "One engagement, one agreement, one dedicated contact.";
/** The fees in the “At a glance” row — the three due dates of S12 in the short form of the language guide (1.3, version A). */
const HONORAR_BLICK = `${B.honorarAuftrag} on engagement. On registration of your company, the success fee set by your funding target — at least ${B.erfolgMin}. From the second year, on request, ${B.jahresbetreuung} a year.`;
/** What is payable from the second year (agreement, clause 6(3)) — amount from the price source. */
const LAUFEND = `From the second year your company incurs running costs: the state fee, the registered agent and the annual US filing. With annual administration we handle these on request for ${B.jahresbetreuung} a year, state fee included; annual administration does not renew automatically.`;
/** The first annual US filing — wording of the agreement (clause 2), role as in guard rail 5. */
const US_MELDUNG = "the first annual US filing by a US certified public accountant (CPA) from our partner network";
/** The note on knowledge content (language guide 5.11). */
const VERMERK = "This page explains the fundamentals and does not replace a tax or legal review of your case.";
/** The passport in the ITIN application — the route the IRS allows, without naming a partner or a place. */
const PASS_WEG = "The IRS allows a Certifying Acceptance Agent authorised by it to verify your passport; you then do not have to send the original to the United States. We agree the route with you before the application is filed.";

export const LEISTUNGEN_EN: GlobalSeite[] = [
  // ─────────────────────────────────────────────────────────────────────────
  {
    pfad: "/en/business/us-company-formation",
    sprache: "en",
    schwester: "/business/us-firmengruendung",
    art: "leistung",
    seo: {
      titel: "US company formation for non-residents — FIAON Global",
      beschreibung: "US company formation under one engagement: we file your LLC and apply for the EIN and ITIN. The state and the US tax authority make the decisions.",
    },
    stand: S,
    erschienen: ERSCHIENEN,
    kennung: "FG · 01",
    auge: "Service · US company formation",
    h1: "US company formation.",
    h1b: "Filed and documented.",
    lead: `We form your US company (LLC) in Delaware, Florida or Wyoming, assemble every document and apply for the tax identification numbers. ${satz("S3", "en")}`,
    ziffern: [
      { wert: B.honorarAuftrag, label: `on engagement — formation and the first year. On registration: success fee, at least ${B.erfolgMin}. From the second year, on request: annual administration.` },
      { wert: "3 states", label: "Delaware, Florida or Wyoming — registration is decided by the state" },
      { wert: "one engagement", label: "one agreement, one dedicated contact" },
    ],
    blick: [
      ["We handle", "State filing, formation documents, registered agent, US business address and US telephone number, EIN and ITIN applications"],
      ["You", "Choose the name, upload your passport, sign the documents"],
      ["Decided by", "The state on registration; the US tax authority on the EIN and the ITIN"],
      ["Fees", HONORAR_BLICK],
      ["Legal form", "LLC — as your engagement provides; the corporation is compared below"],
      ["State", "Delaware, Florida or Wyoming — Delaware through the fee calculator; we agree Florida or Wyoming with you in a call"],
      ["Contracting party", "FIAON LTD, London — registered in England and Wales"],
    ],
    kurz: "A US company (LLC) can be formed from abroad — without residence in the United States and without minimum capital. FIAON Global files it with the state, assembles every document and applies for the EIN and ITIN, under one engagement. Registration is decided by the state; the tax identification numbers by the US tax authority. As a rule, the company remains taxable where it is actually managed.",
    bloecke: [
      {
        typ: "text", id: "was-es-ist", h2: "What a US company is — and is not",
        absaetze: [
          "The limited liability company (LLC) comes closest to the German GmbH: the company is liable for its debts with its own assets; you as a shareholder (member) are generally not personally liable. Unlike a GmbH, it needs no minimum capital and no appointment with a notary; its articles are called the operating agreement and set out who decides and who is entitled to the profit.",
          "The corporation is closer to a German Aktiengesellschaft (stock corporation). It suits businesses that want to bring in investors or give shares to employees, or where an institution or business partner expressly expects a corporation.",
          `${satz("S10", "en")} If the company is managed from there, it is generally taxable there. It makes sense for businesses that sell, purchase or conclude contracts in the United States and need a banking relationship and payment record of their own there.`,
        ],
      },
      {
        typ: "tabelle", id: "llc-corporation", h2: "LLC or corporation — the differences",
        lead: "Your engagement provides for an LLC. For context, the essentials of both legal forms:",
        kopf: ["", "LLC", "Corporation"],
        zeilen: [
          ["Liability", "limited to the company’s assets", "limited to the company’s assets"],
          ["Taxation in the US", "An LLC with one foreign shareholder (member) is generally not treated there as a separate taxable entity", "The company pays federal corporate income tax and, depending on the state, a state tax of its own"],
          ["Internal organisation", "operating agreement, freely structured", "bylaws, board of directors, shares under fixed rules"],
          ["Investors and employee shares", "possible, but less common", "the usual route"],
          ["Suitable for", "trading, services, holding companies", "growth with investors, employee participation"],
        ],
        fuss: [`The tax office in your country of residence classifies the company under its own rules — in Germany, by comparison with German legal forms (Typenvergleich). ${VERMERK}`],
      },
      {
        typ: "etappen", id: "ablauf", h2: "The formation process",
        lead: KOPF.lead,
        etappen: [
          { titel: "Your engagement begins", text: "You request your proposal, read your complete agreement and sign online. We begin once your payment has been received." },
          { titel: "Name and passport", text: "You choose the name of your company and upload your passport. We check the register to see whether the name is available; the state registers each name only once." },
          { titel: schritt(1).titel, dauer: `Decided by ${schritt(1).entscheidet}`, text: `${schritt(1).satz} ${weitererSatz("UEBERGANG-EINREICHUNG", "en")}` },
          { titel: schritt(2).titel, dauer: `Decided by ${schritt(2).entscheidet}`, text: `${schritt(2).satz} ${schritt(2).werMachtWas.wennEsAusbleibt}` },
          { titel: "Accounts, cards, financing", dauer: "Decided by each institution", text: "We then prepare your account applications, your credit card applications on request and the applications for financing in full. You submit the applications yourself." },
        ],
      },
      {
        typ: "rollen", id: "wer-was-tut", h2: "Who is responsible for what",
        lead: weitererSatz("ROLLEN", "en"),
        fiaon: [
          "State filing through our partners in the United States, state fee included",
          "Registered agent, US business address and US telephone number in the first year",
          "EIN and ITIN applications (the ITIN following our ITIN check)",
          "Compliance calendar and the first annual report to the state",
          "One dedicated contact for your company’s post, calls and appointments",
        ],
        partner: [
          "Partner lawyers: legal questions, in their own professional capacity",
          "US certified public accountant (CPA) from our partner network: the first annual US filing",
        ],
        sie: [
          "Choose the name of your company",
          "Upload your passport",
          "Sign the documents presented to you",
          "Report your company in your country of residence — with your tax adviser",
        ],
      },
      {
        typ: "text", id: "inklusive", h2: "Included in the first year",
        absaetze: ["On engagement, the first year includes:"],
        punkte: [
          "State filing, state fee included",
          "Operating agreement and formation documents",
          "EIN and ITIN applications (the ITIN following our ITIN check)",
          "Registered agent, US business address and US telephone number",
          ohnePunkt(weitererSatz("UEBERGANG-ASSISTENZ", "en")),
          gross(US_MELDUNG),
          "Compliance calendar and the first annual report to the state, state fee included",
          "Fully prepared applications for your accounts and, on request, your credit cards — each institution decides",
          ohnePunkt(schritt(5).ihrErgebnis),
          `Not included: charges and interest of card issuers and institutions, the cost of the loan, taxes, annual administration from the second year and priority handling (${B.fastTrack}, on request)`,
        ],
        nach: LAUFEND,
      },
      {
        typ: "hinweis", id: "wissen", h2: "What you need to know before formation",
        punkte: [...GLOBAL_PFLICHTHINWEIS.en, beleg("fuerWenNicht", "en")],
      },
      { typ: "paket", id: "mandat", h2: KARTE_H2, lead: `${EIN_MANDAT} ${beleg("honorarVorab", "en")}`, paket: "global_struktur" },
    ],
    fragen: [
      { f: "Can I form a US company without living in the US?", a: "Yes. To form an LLC you need neither residence nor citizenship in the United States. The address required by law in the state is provided by the registered agent; the US business address and US telephone number are included in the first year. Registration is decided by the state." },
      { f: "Do I have to travel to the US to form the company?", a: `Not for the formation or your company’s tax identification number. Whether an institution requires you to attend in person for an account, a card or financing is for that institution to decide. ${weitererSatz("MIAMI", "en")}` },
      { f: "LLC or corporation — which one suits me?", a: `Your engagement provides for an LLC; for trading and services it is usually the leaner form. A corporation suits businesses that want to bring in investors or give shares to employees. ${VERMERK}` },
      { f: "How long does it take to form a US company?", a: `${satz("S15", "en")} Our timings for each step are on the “Process” page.` },
      { f: "How much does it cost to form a US company with FIAON?", a: satz("S12", "en") },
      { f: "Is a US company a tax scheme?", a: `No. ${satz("S10", "en")} If the company is managed from there, it is generally taxable there, and annual filing duties apply in the United States in addition.` },
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
      beschreibung: "EIN for your US company, ITIN for you personally: we prepare both applications and file them. The IRS decides on both numbers.",
    },
    stand: S,
    erschienen: ERSCHIENEN,
    kennung: "FG · 02",
    auge: "Service · US tax identification numbers",
    h1: "EIN and ITIN.",
    h1b: "Applied for, not promised.",
    lead: "The EIN is the tax identification number of your US company, the ITIN your personal US tax identification number. We prepare both applications and file them; we apply for the ITIN only where the requirements are met. The US tax authority, the IRS, decides on both numbers.",
    ziffern: [
      { wert: "included", label: "EIN and ITIN applications — prepared and filed, part of your engagement" },
      { wert: "without an SSN", label: "The EIN does not require a US Social Security number" },
      { wert: "IRS", label: "The US tax authority decides on both numbers" },
    ],
    blick: [
      ["We handle", "ITIN check, both applications prepared and filed"],
      ["You", "Upload your passport, sign the forms"],
      ["Decided by", "The US tax authority, the IRS — on both numbers, on its own timeline"],
      ["Fees", `Part of your engagement; the IRS charges no fee. ${HONORAR_BLICK}`],
      ["EIN", "Tax identification number of the company — Form SS-4"],
      ["ITIN", "Personal tax identification number — Form W-7 with proof of identity"],
      ["ITIN requirement", "A tax reason that the IRS recognises — we check before applying that one exists (ITIN check)"],
    ],
    kurz: "The US tax authority, the IRS, issues the EIN (Employer Identification Number) to your company — without a fee and without a US Social Security number. It issues the ITIN (Individual Taxpayer Identification Number) to you personally where there is a tax reason; the application is made on Form W-7 with proof of identity. FIAON Global prepares both applications and files them; the IRS decides.",
    bloecke: [
      {
        typ: "tabelle", id: "vergleich", h2: "EIN and ITIN compared",
        kopf: ["", "EIN", "ITIN"],
        zeilen: [
          ["For whom", "your US company", "you as an individual"],
          ["Purpose", "account, filings, invoices, contracts", "personal tax obligations and credit history in the US"],
          ["Form", "SS-4", "W-7"],
          ["Requirement", "a registered company", "a tax reason that the IRS recognises"],
          ["IRS fee", "none", "none"],
          ["Decided by", "the IRS", "the IRS"],
          ["IRS processing time", "fax about four working days, post about four weeks", "about seven weeks, from abroad nine to eleven weeks"],
          // E-465 (29.10.2026): current practice next to the IRS figure.
          ["In practice at present", "closer to six to eight weeks by fax", "as stated by the IRS"],
        ],
        fuss: [
          "Processing times according to the IRS (as at 2026): EIN by fax about four working days, by post about four weeks; ITIN about seven weeks, and between mid-January and the end of April as well as for applications from abroad nine to eleven weeks.",
          `The row “In practice at present” gives timings based on experience (as at November 2026). ${satz("S15", "en")}`,
        ],
      },
      {
        typ: "text", id: "ein", h2: "The EIN — the number of your company",
        absaetze: [
          "Every US company needs an EIN: for the business account, for invoices to US customers, for the annual filing with the IRS and for every contract in which a US partner asks for a tax number.",
          "The IRS online procedure requires a US tax number for the responsible party. Shareholders without such a number apply for the EIN in writing on Form SS-4. We complete it, present it to you for signature and file it. You then find the IRS confirmation in your portal.",
        ],
      },
      {
        typ: "text", id: "itin", h2: "The ITIN — your personal US tax number",
        absaetze: [
          "The ITIN is intended for people who have to be recorded for tax purposes in the US but cannot be issued a Social Security number. It is not a work permit and not a residence permit, but solely a tax number.",
          `It matters for business credit cards because the card issuer, which decides on the card, assesses the person where the owner gives a personal guarantee — and generally asks for a US tax number to do so. The IRS issues the ITIN only where there is a tax reason: as a rule it is applied for together with a US tax return, or under one of the exceptions the IRS allows. ${weitererSatz("UEBERGANG-ITIN", "en")} Without a sound reason we do not file an application. ${schritt(2).werMachtWas.wennEsAusbleibt}`,
          PASS_WEG,
        ],
      },
      {
        typ: "etappen", id: "ablauf", h2: "The application process",
        etappen: [
          { titel: "Company registered", text: "The EIN can only be applied for once the state has registered the company." },
          { titel: "SS-4 prepared and filed", text: "We complete the form, you sign, we file. The IRS decides on the EIN; you find its confirmation in your portal." },
          { titel: "ITIN check", text: `${weitererSatz("UEBERGANG-ITIN", "en")} Without a sound reason we do not file an application.` },
          { titel: "W-7 with proof of identity", text: "The application goes to the IRS with your verified passport and the required attachments. We follow it through to the decision; the IRS decides." },
        ],
      },
      {
        typ: "hinweis", id: "wissen", h2: "What you need to know",
        punkte: [
          "Both numbers are issued by the IRS alone, on its own timeline. FIAON prepares and files — the decision is not FIAON’s to make.",
          "The ITIN requires a tax reason. Wanting an account or a card is not in itself a reason that the IRS recognises.",
          "An ITIN is neither a credit card nor a credit limit. It is generally the prerequisite for a card issuer to assess your application; each card issuer makes its own decision.",
        ],
      },
      { typ: "paket", id: "mandat", h2: KARTE_H2, lead: "The EIN and ITIN applications are part of your engagement.", paket: "global_struktur" },
    ],
    fragen: [
      { f: "Do I need a US Social Security number to get an EIN?", a: "No. Shareholders without a US tax number apply for the EIN in writing on Form SS-4. The IRS online procedure is only open to applicants with a US tax number." },
      { f: "How much does the IRS charge for an EIN?", a: "Nothing. The IRS charges no fee for the EIN. Preparing and filing the application is part of your engagement with FIAON Global." },
      { f: "What do I need an ITIN for?", a: "For personal tax obligations in the US — and so that a card issuer can assess you as a person if you give a personal guarantee for a business credit card. The IRS issues the ITIN only where there is a tax reason." },
      { f: "Will I automatically get a credit card with an ITIN?", a: "No. The ITIN is a tax number. Whether a card issuer issues a card, and with what limit, is decided by the issuer itself under its own rules." },
      { f: "Do I have to send my passport to the US?", a: `As a rule, no. ${PASS_WEG}` },
      { f: "How long does it take to get an ITIN?", a: "According to the IRS, about seven weeks; between mid-January and the end of April and for applications from abroad, nine to eleven weeks. FIAON cannot shorten this — we make sure the application is complete, because incomplete applications delay processing." },
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
      beschreibung: "US business bank account for your LLC: we assemble the documents and prepare the application. You submit it yourself; the institution decides.",
    },
    stand: S,
    erschienen: ERSCHIENEN,
    kennung: "FG · 03",
    auge: "Service · US business bank account",
    h1: "The US business bank account.",
    h1b: "Prepared by us, decided by the institution.",
    lead: `Every US account rests on complete documents without contradictions. We assemble them and support you until the institution has decided. ${satz("S2", "en")}`,
    ziffern: [
      { wert: "prepared", label: "Every account application, in full — you submit it yourself" },
      { wert: "no authority", label: beleg("keinZugriff", "en") },
      { wert: "the institution", label: "decides on every account, under its own rules" },
    ],
    blick: [
      ["We handle", "Assembling the documents, preparing the application in full, supporting you with queries"],
      ["You", "Submit and sign the application"],
      ["Decided by", "The institution concerned alone, under its own rules"],
      ["Fees", `Part of your engagement; you bear the institution’s charges. ${HONORAR_BLICK}`],
      ["Account holder", "Your US company — not FIAON"],
      ["Requirements", "Registered company, EIN, operating agreement, US business address"],
      ["In your engagement", "Personal account and business account: every application prepared; credit card applications on request"],
    ],
    kurz: "A US company can apply for a business account in the United States once it is registered and has an EIN. Institutions require formation documents, the EIN confirmation, the operating agreement, identity documents of the shareholders and a clear description of the business. FIAON Global prepares these documents and the application in full; you submit the application yourself. Whether, and on what terms, an account is opened is for the institution to decide.",
    bloecke: [
      {
        typ: "text", id: "unterlagen", h2: "What an institution wants to see",
        absaetze: ["The list is similar at most institutions. If one item is missing or two documents contradict each other, the application stalls — which is why we check the documents against one another before you submit the application:"],
        punkte: [
          "Formation documents of the company (Articles of Organization or Incorporation)",
          "Confirmation of the EIN by the IRS",
          "Operating agreement or bylaws",
          "Passports of the shareholders and the managing directors",
          "US business address and phone number",
          "A clear description of the business: what, for whom, with which payment flows",
        ],
        nach: "The institution decides on the application.",
      },
      {
        typ: "karten", id: "wege", h2: "Online or on site", spalten: 2,
        karten: [
          { tag: "Online", titel: "Application online", text: "Some institutions accept applications online from companies with shareholders abroad. We prepare the application in full; whether an institution allows this route is for the institution to decide." },
          { tag: "On site", titel: "Appointment at the branch", text: `Other institutions require you to attend in person. We prepare the appointment with you. ${weitererSatz("MIAMI", "en")}` },
        ],
      },
      {
        typ: "text", id: "ablehnung", h2: "Why accounts are declined",
        absaetze: ["Typical reasons are gaps in the documents that can be identified before the application:"],
        punkte: [
          "The business model cannot be understood from the documents.",
          "There is no recognisable connection to the US — customers, suppliers or contracts.",
          "Names, addresses or shareholdings do not match across two documents.",
          "Payment flows touch countries or sectors that the institution does not serve.",
        ],
        nach: "We identify such gaps before the application — not after the refusal. The decision rests with the institution.",
      },
      {
        typ: "hinweis", id: "wissen", h2: "What you need to know",
        punkte: [
          satz("S2", "en"),
          "FIAON does not name any institutions on this page: their requirements change, and which one fits depends on your plans. Your dedicated contact tells you which institutions may be considered.",
          `The account holder is your company. ${beleg("keinZugriff", "en")}`,
        ],
      },
      { typ: "paket", id: "mandat", h2: KARTE_H2, lead: "Preparing your account applications is part of your engagement — personal and business.", paket: "global_banking" },
    ],
    fragen: [
      { f: "Can I open a US business bank account from Germany?", a: "You can apply for one for your US company. The requirements are a registered company, an EIN and complete documents. Whether an institution opens the account is its own decision." },
      { f: "Do I have to travel to the US to open the account?", a: `Whether an institution requires you to attend in person is for the institution to decide. Some accept applications online. ${weitererSatz("MIAMI", "en")}` },
      { f: "What documents do I need to open a US business bank account?", a: "Usually formation documents, EIN confirmation, operating agreement, passports, US business address and a clear description of the business. We assemble them and check them for contradictions." },
      { f: "Why does FIAON not name any banks?", a: "Because the institutions’ requirements change and the choice depends on your plans. Your dedicated contact tells you which institutions may be considered; you submit the application yourself." },
      { f: "Does FIAON have access to my account?", a: `No. The account holder is your company. ${beleg("keinZugriff", "en")}` },
    ],
    paket: "global_banking",
    weiter: ["/en/business/knowledge/us-bank-account-documents", "/en/business/us-business-credit-cards", "/en/business/ein-itin", "/en/business/knowledge/registered-agent-address"],
  },

  // ─────────────────────────────────────────────────────────────────────────
  // E-510: the new version of this page (language guide 8.6) — financing first, then credit cards as an addition on
  // request, then the review of refinancing and an increase from the eighteenth month. The address stays; the anchor of
  // the process is “ablauf”. While reservation V1 is open, the version “today” stands everywhere (step 5).
  {
    pfad: "/en/business/us-business-credit-cards",
    sprache: "en",
    schwester: "/business/firmenkarten-kapital",
    art: "leistung",
    seo: {
      titel: "US financing and business credit cards — FIAON Global",
      beschreibung: "Financing for your US company: fully prepared applications and support through to the lender’s decision. Business credit cards on request.",
    },
    stand: S,
    erschienen: ERSCHIENEN,
    kennung: "FG · 04",
    auge: "Service · Financing and business credit cards",
    h1: "Financing and business credit cards.",
    h1b: "Prepared and supported.",
    lead: "You choose the funding target your company is to take up. We prepare every application in full and support your company through to the lender’s decision. On request, we also prepare your credit card applications — at no additional fee from FIAON.",
    ziffern: [
      { wert: RAHMEN_KURZ, label: satz("S9", "en") },
      { wert: "Decision", label: satz("S1", "en") },
      { wert: "Miami", label: weitererSatz("MIAMI", "en") },
    ],
    blick: [
      ["Funding target", `${B.rahmen} — you choose it yourself; from US$1 million, in person in Miami`],
      ["We handle", "Fully prepared applications, support through to the decision"],
      ["You", "Choose the funding target, submit the applications, decide on any financing offer from the lender"],
      ["Decided by", "The lender; for cards, the card issuer"],
      ["Fees", "Success fee on registration, stated as an amount in your proposal; cards at no additional fee from FIAON"],
      [KOPF.spalten.wennEsAusbleibt, schritt(5).werMachtWas.wennEsAusbleibt],
    ],
    kurz: "FIAON Global supports your US company through to the decision on its financing. You choose the funding target; we prepare every application in full and support your company until the lender has decided. We prepare credit card applications on request, at no additional fee from FIAON. Decisions on financing, cards and limits rest with the institution concerned alone.",
    bloecke: [
      {
        typ: "etappen", id: "ablauf", h2: "The process through to financing",
        lead: satz("S15", "en"),
        etappen: [
          { titel: "Choose the funding target", text: `You choose the funding target your company is to take up: ${B.rahmen}. ${weitererSatz("MIAMI", "en")} A funding target is a goal, not a promise.` },
          { titel: "Before work begins", text: "We verify your identity and screen your details against the applicable sanctions lists (clause 8 of your agreement)." },
          { titel: "Applications", text: "We prepare every application in full and support your company. Your company submits the application itself." },
          { titel: "Decision and loan agreement", text: `${satz("S1", "en")} Your company enters into the loan agreement in its own name.` },
        ],
      },
      {
        typ: "text", id: "wovon", h2: "What the decision depends on",
        absaetze: ["Lenders and card issuers decide under their own rules. As a rule, their decision takes into account:"],
        punkte: [
          "the company’s revenue and payment flows",
          "a credible business with a link to the United States",
          "the length and punctuality of previous payments",
          "the creditworthiness of the owner who gives the personal guarantee",
          "complete documents without contradictions",
        ],
        nach: "Complete documents without contradictions are our part of the work.",
      },
      {
        typ: "tabelle", id: "verantwortung", h2: "Who is responsible for what",
        kopf: WER_KOPF,
        zeilen: [werZeile(4), werZeile(5), werZeile(6)],
        fuss: ["The clause numbers in brackets refer to your agreement."],
      },
      {
        typ: "text", id: "ausbleiben", h2: GELD_ZURUECK.en.auge,
        absaetze: [],
        punkte: [...GELD_ZURUECK.en.mittel],
        nach: `The conditions are set out in clause 4 of your agreement. This does not apply to accounts and cards. ${satz("S1", "en")}`,
      },
      {
        typ: "text", id: "karten", h2: "Business credit cards — on request",
        absaetze: [
          satz("S4", "en"),
          `${satz("S11", "en")} The person giving the personal guarantee is personally liable for the statement balance. The card issuer sets its own charges and interest, which you bear.`,
          "We prepare each card application individually and in full; you submit the applications yourself. We do not prepare serial applications.",
        ],
        nach: "The fundamentals are explained in the knowledge article on the US business credit card; you find it under “Read on”.",
      },
      {
        typ: "text", id: "achtzehnter-monat", h2: "From the eighteenth month",
        absaetze: [satz("S6", "en")],
      },
      {
        typ: "text", id: "honorar", h2: "Your fees",
        absaetze: [satz("S12", "en")],
        nach: "Not included: the charges and interest of card issuers and institutions, the cost of the loan and taxes.",
      },
      {
        typ: "karten", id: "grenzen", h2: "What FIAON does — and does not do", spalten: 2,
        lead: satz("S9", "en"),
        karten: [
          { tag: "FIAON does", titel: "Prepare and support", text: "Fully prepared applications for financing and, on request, for credit cards. Support for your company through to the lender’s decision." },
          { tag: "FIAON does not", titel: "Promise, lend, broker", text: `${satz("S8", "en")} FIAON makes no commitment on any limit; that decision rests with the institution concerned. ${beleg("keinZugriff", "en")}` },
        ],
      },
      { typ: "paket", id: "mandat", h2: KARTE_H2, lead: `${EIN_MANDAT} ${beleg("honorarVorab", "en")}`, paket: "global_kapital" },
    ],
    fragen: [
      { f: "Does FIAON promise financing?", a: `No. Every financing decision rests with the lender alone. FIAON does not lend and does not broker loans; we prepare the applications in full and support your company through to the decision. ${satz("S9", "en")} ${satz("S5-C", "en")}` },
      { f: "How large can the funding target be?", a: `${B.rahmen}. ${weitererSatz("MIAMI", "en")} ${satz("S9", "en")} ${satz("S1", "en")}` },
      { f: "Who is liable for a business credit card?", a: `${satz("S11", "en")} The person giving the personal guarantee is personally liable for the statement balance. The card issuer decides what security it requires.` },
      { f: GLOBAL_KAPITAL_FREI.en.frage, a: GLOBAL_KAPITAL_FREI.en.antwort },
      { f: "What happens from the eighteenth month?", a: `${satz("S6", "en")} ${weitererSatz("SCHRITT-6-TAKT", "en")}` },
    ],
    paket: "global_kapital",
    weiter: ["/en/business/knowledge/us-business-credit-card", "/en/business/knowledge/us-business-credit", "/en/business/knowledge/building-us-credit", "/en/business/knowledge/us-funding-for-foreign-owned-companies"],
  },

  // ─────────────────────────────────────────────────────────────────────────
  {
    pfad: "/en/business/us-compliance",
    sprache: "en",
    schwester: "/business/us-pflichten",
    art: "leistung",
    seo: {
      titel: "US LLC compliance and Form 5472 — FIAON Global",
      beschreibung: "Form 5472 with Form 1120, annual report, registered agent: we keep your US company’s compliance calendar. The authorities set deadlines and penalties.",
    },
    stand: S,
    erschienen: ERSCHIENEN,
    kennung: "FG · 05",
    auge: "Service · US compliance",
    h1: "Your US compliance duties.",
    h1b: "Every deadline in the compliance calendar.",
    lead: "A US company has obligations even when it has no revenue: the annual filing with the IRS, the state fee, the registered agent — and the filing in your country of residence. We keep the compliance calendar and remind you in good time. Deadlines and penalties are set by the authorities.",
    ziffern: [
      { wert: "Form 5472", label: "with Form 1120 — annually, even without revenue" },
      { wert: "15 April", label: "IRS deadline for companies whose tax year is the calendar year" },
      { wert: "included", label: `In the first year: ${US_MELDUNG}` },
    ],
    blick: [
      ["We handle", "Compliance calendar, a reminder of every deadline, the first annual report to the state"],
      ["You", "Notification of the shareholding and the tax return in your country of residence — with your tax adviser"],
      ["Decided by", "Deadlines and penalties are set by the IRS, the state and the tax office"],
      ["Fees", `Part of your engagement in the first year. ${HONORAR_BLICK}`],
      ["IRS", "Form 5472 with Form 1120 for companies with a foreign shareholder"],
      ["State", "Annual report or annual fee, with its own deadline depending on the state"],
      ["Registered agent", "Annually — without one, no valid address in the state"],
    ],
    kurz: "A US company with a foreign shareholder (member) must file Form 5472 together with Form 1120 with the IRS every year — even without revenue. The state’s annual report or annual fee and the registered agent come in addition. In the country of residence, the shareholding must be reported; if the company is managed from there, it is generally taxable there. FIAON Global keeps the compliance calendar; the first annual US filing is included in the first year.",
    bloecke: [
      {
        typ: "tabelle", id: "kalender", h2: "A US company’s duties over the year",
        kopf: ["Duty", "Filed with", "Deadline", "Who handles it"],
        zeilen: [
          ["Form 5472 with Form 1120", "IRS, by fax or post", "15 April, with Form 7004 until 15 October", "US CPA from our partner network (first year included)"],
          ["Annual report or annual tax", "State", "Florida 1 January to 1 May · Delaware 1 June · Wyoming in the month of formation", "FIAON (first year included, state fee included)"],
          ["Registered agent", "State", "annually", "included in the first year"],
          ["Notification of the shareholding (Germany: section 138 of the German Fiscal Code, AO)", "Tax office in the country of residence", "with the tax return, no later than fourteen months after the end of the year", "Your tax adviser"],
          ["Tax return of the company", "Tax office in the country of residence", "under local law", "Your tax adviser"],
        ],
        fuss: ["IRS deadline for companies whose tax year is the calendar year. State deadlines for LLCs; amounts and details on the state pages and under “Costs”.", "Companies formed in the US have been exempt from reporting beneficial ownership information (BOI) to FinCEN since 14 August 2026."],
      },
      {
        typ: "text", id: "form-5472", h2: "Form 5472 — the mandatory annual filing",
        absaetze: [
          "If a US company is owned by a foreign shareholder (member), it reports its transactions with that shareholder to the IRS every year: contributions, withdrawals, loans, services paid for. This is done on Form 5472, filed together with a Form 1120 which, for such a company, serves only as a cover sheet.",
          `The filing is mandatory even if the company has had no revenue — the contribution at formation is already a reportable transaction. It is not filed electronically but by fax or post. For a missing or substantially incomplete filing, the IRS can impose a penalty of ${IRS_EN.strafe5472}; if the filing is still not made after a notice, further amounts are added.`,
        ],
      },
      {
        typ: "text", id: "heimat", h2: "Your obligations in your country of residence",
        absaetze: [
          "In Germany, the formation or acquisition of a shareholding in a foreign company must be reported to the tax office (section 138 of the German Fiscal Code, AO) — together with the tax return, no later than fourteen months after the end of the year. Anyone who fails to report risks a fine of no more than €25,000 (section 379 AO). The tax office classifies the US company by comparison with German legal forms (Typenvergleich).",
          `Switzerland and Austria have their own rules. In all three countries, a company managed from within the country is generally taxable there. Your tax adviser in your country of residence handles the notification and the ongoing tax return. ${VERMERK}`,
        ],
      },
      {
        typ: "hinweis", id: "wissen", h2: "What you need to know",
        punkte: [
          "Deadlines and penalties are set by the authorities, not by FIAON. The compliance calendar reminds you in good time; responsibility for the company remains with you.",
          LAUFEND,
          "Ongoing bookkeeping and the tax return in your country of residence are not part of your engagement; your tax adviser handles them.",
        ],
      },
      { typ: "paket", id: "mandat", h2: KARTE_H2, lead: "The compliance calendar for all US filings and deadlines is part of your engagement.", paket: "global_banking" },
    ],
    fragen: [
      { f: "Do I have to file Form 5472 if my LLC had no revenue?", a: "Yes. The obligation does not depend on revenue but on the company being owned by a foreign shareholder: it must report its transactions with that shareholder, and contributions at formation already count." },
      { f: "What happens if I miss the Form 5472 deadline?", a: `The IRS can impose a penalty of ${IRS_EN.strafe5472}, with further amounts if the failure continues after a notice. That is why the deadline is in your compliance calendar, and we remind you in good time.` },
      { f: "Who prepares the annual US filing?", a: `In the first year, a US certified public accountant (CPA) from our partner network; FIAON bears the fee for it. From the second year, the filing is part of annual administration, which you may continue with for ${B.jahresbetreuung} a year; it does not renew automatically.` },
      { f: "Do I have to report the US company to my tax office?", a: "In Germany, yes: under section 138 of the German Fiscal Code (AO), together with the tax return. Austria and Switzerland have their own rules; your tax adviser in your country of residence tells you what they are." },
      { f: "What does a US company cost from the second year onwards?", a: `The state fee, the registered agent and the annual US filing. With annual administration we handle these on request for ${B.jahresbetreuung} a year, state fee included; annual administration does not renew automatically. The individual amounts per state are on the “Costs” page.` },
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
      titel: "In person in Miami: from US$1 million — FIAON Global",
      beschreibung: "From a funding target of US$1 million, we work with you in person in Miami. All financing decisions rest with the lender.",
    },
    stand: S,
    erschienen: ERSCHIENEN,
    kennung: "FG · 06",
    auge: "Service · Miami",
    h1: "In person in Miami.",
    h1b: "From a funding target of US$1 million.",
    lead: `${weitererSatz("MIAMI", "en")} You receive your proposal after our call; we agree the date and the arrangements with you. ${satz("S1", "en")}`,
    ziffern: [
      { wert: "from US$1m", label: satz("S9", "en") },
      { wert: "in person", label: "Your appointment with FIAON’s management" },
      { wert: "Your proposal", label: "You receive it in person, after our call" },
    ],
    blick: [
      ["Who it is for", "Funding target from US$1 million"],
      ["We handle", "The call, your personal proposal, preparing the appointments in Miami"],
      ["You", "Send your enquiry in the fee calculator, plan the trip, submit the applications yourself"],
      ["Decided by", "The institution concerned on accounts, cards and financing — also after an appointment in Miami"],
      ["Fees", "Stated as amounts in your personal proposal before you sign"],
      ["Your route there", "Enquiry in the fee calculator — we contact you and agree the date"],
    ],
    kurz: "From a funding target of US$1 million, FIAON Global works with you in person in Miami. You send your enquiry in the fee calculator; we contact you, discuss your plans and agree the date with you. You receive your proposal in person. You submit the applications yourself; decisions on accounts, cards and financing rest with the institution concerned.",
    bloecke: [
      {
        typ: "text", id: "warum", h2: "Why in person",
        absaetze: [
          "No trip is needed for the formation or your company’s tax identification number. With a funding target from US$1 million, we speak with you in person: about your plans, the documents and the applications your company submits.",
          "Whether an institution requires you to attend in person for an account, a card or financing is for that institution to decide. We prepare appointments in Miami with our partners in the United States.",
        ],
      },
      {
        typ: "etappen", id: "auftakt", h2: "The route to your appointment in Miami",
        etappen: [
          { titel: "Enquiry in the fee calculator", text: "You move the slider to US$1 million and send your enquiry. We contact you." },
          { titel: "Call and proposal", text: "We discuss your plans and agree the date. You receive your proposal in person; you read your complete agreement before you sign." },
          { titel: "Appointments in Miami", text: "A working session with FIAON’s management. We prepare appointments with institutions together with our partners in the United States; each institution decides on every application." },
          { titel: "Afterwards: your engagement", text: "After the appointment, your engagement follows the same process as any other: from formation through to the lender’s decision. You see the status in your portal." },
        ],
      },
      {
        typ: "hinweis", id: "reise", h2: "The trip — what applies",
        punkte: [
          "We agree the date, the trip and the arrangements in Miami with you beforehand.",
          "FIAON is not a tour operator and does not sell travel.",
          "Even after an appointment in Miami, the institution concerned alone decides on the account, card, limit and financing.",
        ],
      },
      { typ: "paket", id: "mandat", h2: KARTE_H2, lead: `${EIN_MANDAT} ${beleg("honorarVorab", "en")}`, paket: "global_vip" },
    ],
    fragen: [
      { f: "From when do we meet in person?", a: `${weitererSatz("MIAMI", "en")} You then receive your proposal after our call.` },
      { f: "Is FIAON selling me a trip?", a: "No. FIAON is not a tour operator and does not sell travel. We agree the date, the trip and the arrangements in Miami with you beforehand." },
      { f: "When does the appointment take place?", a: "After our call — we agree it with you." },
      { f: "What does the funding target mean?", a: `It is the amount of financing you set as the target for your company. ${satz("S9", "en")} ${satz("S1", "en")}` },
      { f: "Do I need to travel at all to form the company?", a: "Not for the formation or your company’s tax identification number. Whether an institution requires you to attend in person for an account, a card or financing is for that institution to decide." },
    ],
    paket: "global_vip",
    weiter: ["/en/business/us-business-credit-cards", "/en/business/partners", "/en/business/florida", "/en/business/costs"],
  },
];
