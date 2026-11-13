// ═══════════════════════════════════════════════════════════════════════════
// FIAON GLOBAL — WISSEN AUF ENGLISCH: KONTO, BONITÄT, BUSINESS CREDIT,
// FIRMENKARTEN (24.09.2026, E-234)
//
// Die englischen Schwestern von ../wissen-konto-karten.ts: vier Beiträge
// (US-Konto, US-Bonität, Business Credit, US-Firmenkarte). Britisches Englisch,
// dieselben Bausteine in derselben Reihenfolge, dieselben Anker (ids bleiben
// deutsch), dieselben Quellen mit englischen Titeln (QUELLEN_WISSEN_EN).
// Die Wortwand gilt hier am engsten: „Firmenkarte" heißt IMMER „business credit
// card" (nie „business card" — im Britischen die Visitenkarte), der
// Einführungszeitraum ist „without debit interest" (nie „0%"), die persönliche
// Haftung ist die „personal guarantee". Über Konto, Karte und Rahmen entscheidet
// das Institut bzw. der Herausgeber; FIAON ist keine Bank, vergibt und vermittelt
// keine Kredite. Der Fall FTC v. Seek Capital (Entscheidung 16.09.2025, Anordnung
// 01.10.2025, Mitteilung der FTC 17.11.2025) steht mit denselben Zahlen wie im
// Deutschen da.
//
// E-510 (13.11.2026, language guide, building block “knowledge article” 7.4): one
// section per page, “What FIAON Global handles” — what we do, your part, the
// condition (who decides). Steps 3 (accounts) and 4 (credit cards on request) and
// the fixed sentences come verbatim from shared/fiaon-global-saetze.ts. Never here:
// a name for the sequence of card applications, a commitment on an account, card or
// limit, an interest rate as a figure or an order of magnitude, a warning sign that
// would describe our own fee (guide 5.6 no. 12), sentence S16 (reservation V3), a
// “team on the ground”. The introductory period without debit interest appears as
// ONE sentence of market knowledge, with evidence (guide 7.4).
// ═══════════════════════════════════════════════════════════════════════════
import { GLOBAL_KAPITAL_FREI, GLOBAL_PFLICHTHINWEIS } from "../../fiaon-global";
import { SCHRITTE_KOPF, SECHS_SCHRITTE, beleg, satz, type Schritt, type SchrittNr } from "../../fiaon-global-saetze";
import { EIN_PRODUKT } from "../ein-produkt";
import { FAKTEN_STAND_EN, QUELLEN_WISSEN_EN as Q, SCHWELLEN_EN } from "../fakten-en";
import type { GlobalQuelle, GlobalSeite } from "../typen";

/** Date of first publication (E-234). */
const ERSCHIENEN = "2026-09-24";
/** Date of the last change in substance (E-510, language guide). */
const S = "2026-11-13";
const P = EIN_PRODUKT.en;
/** One step of the fixed narrative (language guide 2.3) — sentence, condition and “your part” from the one source. */
const schritt = (nr: SchrittNr): Schritt => SECHS_SCHRITTE.en.find((x) => x.nr === nr)!;
const KONTEN = schritt(3);
const KARTEN = schritt(4);
const FINANZIERUNG = schritt(5);
/** The names of the fixed parts of a step: “Your part”, “Condition” (language guide 2.1). */
const TEIL = SCHRITTE_KOPF.en.teile;
/** Heading of the one section about us (language guide 7.4). */
const FIAON_H2 = "What FIAON Global handles";
/** The decision sentence from S2: “Each institution makes its own decision on accounts, cards and limits.” */
const INSTITUT = satz("S2", "en").split(/(?<=\.)\s+/)[1];
/** The one sentence of market knowledge on the introductory period (language guide 7.4) — once per page, with evidence. */
const EINFUEHRUNG = "Some issuers offer introductory periods without debit interest; each issuer sets its own terms.";
// Der deutsche Titel trägt das Datum als „17.11.2025" — auf Englisch mit Monatsnamen (dieselbe Adresse).
const QUELLE_FTC_SEEK: GlobalQuelle = { titel: "FTC — Seek Capital and CEO permanently banned (17 November 2025)", url: Q.ftcSeek.url };

export const WISSEN_KONTO_KARTEN_EN: GlobalSeite[] = [
  // ─────────────────────────────────────────────────────────────────────────
  // 5 · DAS US-KONTO DER LLC — Unterlagen, Regeln, Ablehnungsgründe
  {
    pfad: "/en/business/knowledge/us-bank-account-documents",
    sprache: "en",
    schwester: "/business/wissen/us-bankkonto-unterlagen",
    art: "wissen",
    seo: {
      titel: "US bank account for your LLC: the documents — FIAON Global",
      beschreibung: "Which documents US institutions require to open an LLC bank account, why they ask, why applications fail and what deposit insurance covers.",
    },
    stand: S,
    erschienen: ERSCHIENEN,
    kennung: "FG · 34",
    auge: "Knowledge · Account",
    h1: "The LLC’s US account.",
    h1b: "The documents institutions require.",
    lead: "An application for a US business account rarely fails because of the company. As a rule, it fails on the documents: one is missing, an address differs or the business description is unclear. This article sets out the documents, their legal basis and what a complete application contains.",
    ziffern: [
      { wert: "7 documents", label: "that almost every institution requires" },
      { wert: "25%", label: "from this share, the institution identifies every shareholder" },
      { wert: "$250,000", label: "deposit insurance per depositor, institution and category (FDIC)" },
    ],
    blick: [
      ["Prerequisite", "Registered company with an EIN"],
      ["Institutions’ duty", "Verify identity, record owners holding 25% or more"],
      ["Core documents", "Formation document, EIN confirmation, operating agreement, passports"],
      ["Common reasons for refusal", "Unclear business description, differing address"],
      ["Deposit insurance", "$250,000 per depositor, institution and category"],
      ["Who decides", "The institution concerned"],
      ["With FIAON Global", "Application prepared in full, support with follow-up questions; you submit it yourself"],
    ],
    kurz: `For an LLC’s account, US institutions require the formation document, the EIN confirmation from the US tax authority, the IRS, and the operating agreement. They also require the passports of all shareholders holding ${SCHWELLEN_EN.eigentuemer} or more and of the person who controls the company, together with proof of address. The institution further requires a description of the business with the expected payment flows. Institutions collect this information under US law. The decision on the account and its terms rests with the institution concerned.`,
    bloecke: [
      {
        typ: "text", id: "warum", h2: "The institutions’ duty to identify",
        absaetze: [
          "Every US institution must verify the identity of its customer before opening an account (Customer Identification Program, 31 CFR 1020.220). It collects name, address and an identification number. For people without US citizenship this is, for example, the passport number together with the country of issuance. For companies, it is the EIN and a physical place of business.",
          `For companies, the institution also records the beneficial owners (31 CFR 1010.230). These are every person who holds at least ${SCHWELLEN_EN.eigentuemer} and one person who exercises significant control over the company. Since February 2026, institutions have had to verify this information only at the first account opening and where doubts arise, no longer for each further account.`,
        ],
      },
      {
        typ: "tabelle", id: "unterlagen", h2: "The seven documents",
        kopf: ["Document", "Purpose", "Requirement"],
        zeilen: [
          ["Formation document (Articles of Organization)", "Proof that the company exists", "the version registered by the state; name exactly as in the application"],
          ["EIN confirmation (CP 575 or Letter 147C)", "The company’s tax number", "name and address as in the formation document"],
          ["Operating agreement (the LLC’s governing agreement)", "Who holds interests and who may act", "signed; the interests total 100%"],
          ["Passports", "Identity of shareholders holding 25% or more and of the controlling person", "valid, legible, names as in the operating agreement"],
          ["Proof of address", "Residential address of those involved", "current and in the person’s name"],
          ["Business description", "What the company does", "customers, products, countries, expected revenue and payment channels"],
          ["Proof of the first deposit", "Source of the funds", "bank statement or proof of the deposit"],
        ],
        fuss: ["Some institutions additionally require a Certificate of Good Standing, a website or first contracts."],
      },
      {
        typ: "karten", id: "ablehnung", h2: "Common reasons for refusal", spalten: 3,
        karten: [
          { tag: "Reason", titel: "Unclear business description", text: "A vague “services” label with no clients, no website and no contracts is not enough. The institution cannot then assess the risk and declines." },
          { tag: "Reason", titel: "Differing addresses", text: "Residence, business address and the address on the EIN confirmation differ from one another. Or the business address is that of a registered agent, the agent for service of process required in the state." },
          { tag: "Reason", titel: "Gaps in the operating agreement", text: "The signature is missing, the interests do not add up or a shareholder is not named. The institution cannot then verify the information on the owners." },
          { tag: "Reason", titel: "Higher-risk industries", text: "Institutions scrutinise some activities more strictly and do not accept others. That decision rests with the institution, whatever the documents." },
          { tag: "Reason", titel: "Links to sanctioned countries", text: "Payments or persons involved with links to sanctioned countries almost always lead to refusal." },
          { tag: "Reason", titel: "Contradictions in the interview", text: "If what you say in the interview differs from the application, the institution treats it as a contradiction. A refusal on this ground is often final." },
        ],
      },
      {
        typ: "tabelle", id: "art", h2: "Bank and financial platform compared",
        kopf: ["", "Bank", "Financial platform"],
        zeilen: [
          ["Opening", "sometimes only with an in-person appointment", "usually entirely online"],
          ["Who holds the account", "the bank itself", "usually a bank working with the platform"],
          ["Deposit insurance", "through the FDIC, if the bank is insured", "only through the bank holding the account, and only on its terms"],
          ["Cards and loans", "often from the same institution", "often cards only"],
        ],
        fuss: ["General overview; each institution sets its own services and terms."],
      },
      {
        typ: "text", id: "sicherung", h2: "What deposit insurance covers",
        absaetze: [
          `US deposit insurance through the FDIC protects ${SCHWELLEN_EN.fdic} per depositor, per insured institution and per ownership category. An LLC or corporation with its own business forms a separate category. The FDIC does not add its balance to your personal accounts at the same institution.`,
          "The insurance applies only if an insured institution fails. A financial platform is not itself a bank. Whether and how balances held there are protected depends on the bank holding the account and on the platform’s terms.",
        ],
      },
      {
        typ: "etappen", id: "weg", h2: "A complete application, step by step",
        etappen: [
          { titel: "Assemble the documents", text: "You assemble all seven documents. Names and addresses match in every one of them." },
          { titel: "Describe the business", text: "Two paragraphs are enough if an outsider can understand them. They state the activity, the customers, the countries, the expected revenue and the payment channels." },
          { titel: "Choose the institution", text: "What matters is your business, the currencies you need and how the account is opened. Check also whether the institution issues cards at a later date." },
          { titel: "Application and follow-up questions", text: "The institution almost always has follow-up questions. Answer each one in full and consistently with the application. The institution decides on the application." },
          { titel: "Opening and first deposit", text: "Once the institution has approved the account, the first deposit follows, with proof of the source of the funds. For an LLC with a foreign shareholder (member), the deposit is also a reportable transaction for Form 5472." },
        ],
      },
      {
        typ: "text", id: "fiaon", h2: FIAON_H2,
        absaetze: [
          `${KONTEN.satz} We write the business description with you and compile the documents with matching details. We support you through the institution’s follow-up questions. If an institution requires an in-person appointment, we prepare it with you.`,
        ],
        punkte: [
          `${TEIL.bedingung}: ${KONTEN.bedingung}`,
          `Cards: ${satz("S4", "en")}`,
        ],
      },
      { typ: "paket", id: "mandat", h2: "The account applications in your engagement", lead: P.karteLead, paket: "global_banking" },
      {
        typ: "hinweis", id: "wissen", h2: "What you need to know",
        punkte: [
          "The institution decides on every account, even when the documents are complete.",
          `If your US company holds accounts outside the US totalling more than ${SCHWELLEN_EN.fbar}, it reports them every year to the US authority FinCEN (FBAR).`,
          GLOBAL_PFLICHTHINWEIS.en[1],
        ],
      },
    ],
    fragen: [
      { f: "Can I open a US bank account for my LLC without travelling to the US?", a: "With many institutions, yes. They open accounts online for companies whose shareholders are abroad. Some institutions require an in-person appointment. Each institution sets its own opening process." },
      { f: "What documents do I need for a US business bank account?", a: "As a rule, seven: the formation document, the EIN confirmation, the operating agreement, passports, proof of address, a business description and proof of the first deposit. Passports are required for all shareholders holding 25 per cent or more and for the controlling person. Each institution decides which further documents it requires." },
      { f: "Do I need an SSN or ITIN for my LLC’s bank account?", a: "The company needs its tax identification number (EIN). For shareholders without a US Social Security number (SSN), many institutions accept the passport. Some institutions ask for the personal tax identification number (ITIN)." },
      { f: "Why was my US bank account application rejected?", a: "Common reasons are an unclear business description, contradictory information or an address the institution does not accept. Institutions often do not give their reasons. A complete first application therefore matters." },
      { f: "Are deposits in a US business bank account insured?", a: `At an FDIC-insured institution, deposit insurance protects ${SCHWELLEN_EN.fdic} per depositor, institution and ownership category. With financial platforms, protection depends on the bank holding the account.` },
    ],
    paket: "global_banking",
    weiter: ["/en/business/us-business-bank-account", "/en/business/knowledge/applying-for-an-ein", "/en/business/knowledge/registered-agent-address", "/en/business/knowledge/us-business-credit-card"],
    quellen: [Q.cip, Q.cdd, Q.cddAusnahme, Q.fdic, Q.fbar],
  },

  // ─────────────────────────────────────────────────────────────────────────
  // 6 · US-BONITÄT AUFBAUEN — der persönliche Credit Score
  {
    pfad: "/en/business/knowledge/building-us-credit",
    sprache: "en",
    schwester: "/business/wissen/us-bonitaet-aufbauen",
    art: "wissen",
    seo: {
      titel: "Build US credit from scratch: the FICO Score — FIAON Global",
      beschreibung: "Why SCHUFA does not count in the US, how the FICO Score is made up, what a first score requires and how a US credit history is built.",
    },
    // 27.10.2026: wie die deutsche Schwester — Abschnitt „schufa-usa“, EO 14406 Sec. 3(a)(vi) im Abschnitt „null“, eine Frage.
    stand: S,
    erschienen: ERSCHIENEN,
    kennung: "FG · 35",
    auge: "Knowledge · Credit in the US",
    h1: "Credit in the US.",
    h1b: "It starts at zero.",
    lead: "Credit in the US is built on the data held by the US credit bureaus; SCHUFA data does not enter their files. Anyone coming from Europe therefore starts without a credit file. This article explains how a US credit history comes about and the sequence in which you build it.",
    ziffern: [
      { wert: "300 – 850", label: "Range of the FICO Score" },
      { wert: "6 months", label: "Minimum age of an account for a first score" },
      { wert: "35%", label: "Weight of payment history" },
    ],
    blick: [
      ["Starting point", "SCHUFA data does not count in the US"],
      ["The credit bureaus", "Equifax, Experian, TransUnion"],
      ["The score", "FICO, 300 to 850, from five factors"],
      ["First score", "One account, at least six months old, reported in the last six months"],
      ["Identifier for the credit file", "SSN or ITIN"],
      ["What counts", "Pay on time, keep utilisation low, plan applications"],
      ["With FIAON Global", "Sequence planned, applications prepared in full; the issuer decides"],
    ],
    kurz: "You build US credit from scratch: SCHUFA data does not count in the US. A first FICO Score can be generated once an account has existed for at least six months and has been reported in the last six months. The score runs from 300 to 850. Five factors determine it: payment history (35 per cent), utilisation (30), length of history (15), new accounts (10) and credit mix (10). What counts is on-time payment, low utilisation of your limits and a small number of planned applications.",
    bloecke: [
      {
        typ: "text", id: "null", h2: "Credit bureaus work nationally",
        absaetze: [
          "Credit bureaus work nationally. SCHUFA in Germany, KSV1870 in Austria and CRIF in Switzerland do not report to the US credit bureaus Equifax, Experian and TransUnion. An unblemished credit history in Europe therefore does not, as a rule, count for your first US application. An old entry does not count there either.",
          "In practice, the US credit bureaus keep personal credit files by Social Security number (SSN) or by personal tax identification number (ITIN). Name, address and date of birth are added. Without one of these numbers, there is rarely a file to which payments can be linked.",
          "On 19 May 2026, one further point was added for the ITIN. Executive Order 14406, “Restoring Integrity to America’s Financial System”, instructs the US Secretary of the Treasury to describe warning signs to financial institutions in an advisory. These include the use of an ITIN to obtain credit products or open deposit accounts where lawful immigration status has not been verified. The Executive Order states that the ITIN facilitates tax compliance. Its use in place of a Social Security number or a valid work-authorised visa may, however, be identified as a risk factor requiring enhanced due diligence. The enhanced due diligence is intended to ensure that an account is not used to facilitate employment without work authorisation. If you apply with an ITIN, expect follow-up questions.",
        ],
      },
      {
        typ: "text", id: "schufa-usa", h2: "SCHUFA data in the US",
        absaetze: [
          "SCHUFA data does not count in the US. Credit data from other countries does not transfer to the US system. This applies to entries held by SCHUFA in Germany, by KSV1870 in Austria and by CRIF in Switzerland. Your US credit file starts at zero. Attaching a SCHUFA report to an application does not change this: FICO calculates the score solely from the data in your US credit file.",
          "There is one limited exception: a service for people who have moved to the US. It allows them to bring their foreign credit history into a US application. The service lists Germany, Austria and Switzerland among the countries whose credit data it reads. According to its technical documentation, it relies on CRIF data in all three countries; the documentation does not name SCHUFA or KSV1870.",
          "Individual US institutions, including card issuers, use this service. Each issuer decides for itself for which countries it actually offers this route and how it assesses the data. The route does not replace a US credit file. A first FICO Score requires an account that is at least six months old and was reported to a US credit bureau in the last six months. Building your history therefore always begins with your first US account.",
        ],
      },
      {
        typ: "tabelle", id: "faktoren", h2: "The five factors of the FICO Score",
        kopf: ["Factor", "Weight", "What counts"],
        zeilen: [
          ["Payment history", "35%", "on-time payments, every late payment, collections"],
          ["Utilisation", "30%", "the share of your limits you use; usually reported on the statement date"],
          ["Length of history", "15%", "how long your accounts have existed"],
          ["New accounts", "10%", "how many accounts you have recently opened or applied for"],
          ["Credit mix", "10%", "cards, instalment loans, mortgages"],
        ],
        fuss: ["Weighting according to FICO for the population as a whole; it differs for people with short credit histories."],
      },
      {
        typ: "etappen", id: "aufbau", h2: "The sequence of building credit",
        etappen: [
          { titel: "Number and address", text: "You need an ITIN or SSN, a US address and a telephone number. The details match in every application." },
          { titel: "The first account", text: "The first account is usually a personal card with a small limit, often against a deposit (a secured card). Each issuer decides for itself whether a business credit card appears in your personal credit file." },
          { titel: "Six months of reporting", text: "A first FICO Score can only be generated after six months of reporting. During this time you pay every bill on time and in full." },
          { titel: "Low utilisation", text: "Use only a small part of your limits and pay before the statement date. Issuers usually report the balance on that day." },
          { titel: "Further accounts at intervals", text: "Further accounts follow to a plan, with intervals between applications. The credit bureau records every enquiry, and every new account lowers the average age of your accounts." },
        ],
      },
      {
        typ: "karten", id: "irrwege", h2: "Three common misconceptions", spalten: 3,
        karten: [
          { tag: "Misconception", titel: "Many applications in a short time", text: "The credit bureau records every enquiry, and every new account lowers the average age of your accounts. Several refusals in succession weigh on the credit file further." },
          { tag: "Misconception", titel: "Bought history", text: "Some providers add you, for a fee, as an authorised user on other people’s cards. Issuers can close such accounts; the benefit is uncertain." },
          { tag: "Misconception", titel: "“Credit repair” paid up front", text: "Nobody can have accurate entries removed. The US Federal Trade Commission (FTC) warns against services that promise this." },
        ],
      },
      {
        typ: "text", id: "einsicht", h2: "Access to your US credit file",
        absaetze: [
          "Each of the three credit bureaus shows you your credit file free of charge. The law provides for one report a year. Via AnnualCreditReport.com, the bureaus’ joint service, a report is now permanently available every week. Online access requires an SSN. With an ITIN, you request your file in writing by post from each bureau. Enclose a copy of your passport and proof of address, and state that your number is an ITIN, not an SSN.",
          "You have errors corrected directly with the credit bureau, for example someone else’s account, an incorrect late payment or an old address. The correction is free of charge and requires no service provider.",
        ],
      },
      {
        typ: "text", id: "firma", h2: "Personal and business credit history",
        absaetze: [
          "Alongside your personal credit file, your company can build its own credit history with the business credit bureaus, with its own identifier and its own score. With a young company, however, card issuers almost always assess the owner first. A personal guarantee is the rule; your personal credit history therefore counts.",
          "Both histories develop side by side: through on-time payments by the company, an accurate personal credit file and a small number of planned applications.",
        ],
      },
      {
        typ: "text", id: "fiaon", h2: FIAON_H2,
        absaetze: [
          `We apply for your ITIN following our ITIN check; the US tax authority decides on the ITIN. ${KARTEN.satz} We prepare each application individually and in full. We plan the sequence of applications with you.`,
        ],
        punkte: [
          `${TEIL.ihrTeil}: ${KARTEN.ihrTeil}`,
          `${TEIL.bedingung}: ${KARTEN.bedingung}`,
        ],
      },
      { typ: "paket", id: "mandat", h2: "The card applications in your engagement", lead: P.karteLead, paket: "global_banking" },
      {
        typ: "hinweis", id: "wissen", h2: "What you need to know",
        punkte: [
          "Nobody can promise a particular score or limit. The score follows the data that issuers report.",
          GLOBAL_PFLICHTHINWEIS.en[2],
          "The ITIN serves tax purposes. Whoever holds one takes on the obligations that come with it.",
        ],
      },
    ],
    fragen: [
      { f: "Does my SCHUFA record count in the US?", a: "No. US credit bureaus do not use SCHUFA data. Your US credit history starts at zero: without any benefit from good entries and without any disadvantage from old ones." },
      { f: "How do I get a US credit score without an SSN?", a: "Through the ITIN. In practice, credit bureaus keep personal credit files by SSN or ITIN. A first FICO Score can be generated once an account has existed for at least six months and has been reported in the last six months." },
      { f: "What does Executive Order 14406 change for applications with an ITIN?", a: "It instructs the US Secretary of the Treasury to describe warning signs to financial institutions. These include the use of an ITIN instead of a Social Security number or a work-authorised visa for account and credit applications where lawful immigration status has not been verified. Such use may be identified as a risk factor requiring enhanced due diligence. Expect follow-up questions. The institution decides on every application." },
      { f: "How long does it take to build a US credit history?", a: "A first score comes after about six months. A credit history on which issuers base higher limits develops over years. It requires on-time payments and a small number of planned applications." },
      { f: "What credit utilisation should I aim for?", a: "As low as possible. Utilisation accounts for around 30 per cent of the FICO Score. Issuers usually report the balance on the statement date." },
      { f: "Does a business credit card help my personal credit score?", a: "Each issuer decides for itself. Some report business credit cards in the personal credit file, some only when payments are late, some not at all." },
    ],
    paket: "global_banking",
    weiter: ["/en/business/us-business-credit-cards", "/en/business/knowledge/us-business-credit", "/en/business/knowledge/applying-for-an-itin", "/en/business/knowledge/us-business-credit-card"],
    quellen: [
      Q.ficoFaktoren, Q.ficoMindest, Q.ftcAuskunft, Q.ftcCredit, Q.itinUebersicht,
      { titel: "Experian — 8 ways to build credit if you’re new to the US (26 May 2026)", url: "https://www.experian.com/blogs/ask-experian/how-to-build-credit-when-new-to-us/" },
      { titel: "Nova Credit — Credit Passport: countries of origin and users", url: "https://www.novacredit.com/company" },
      { titel: "Nova Credit — Credit Passport API v4: credit bureaus by country", url: "https://docs.novacredit.com/credit-passport/v4" },
      { titel: "The White House — Executive Order 14406, “Restoring Integrity to America’s Financial System” (19 May 2026)", url: "https://www.whitehouse.gov/presidential-actions/2026/05/restoring-integrity-to-americas-financial-system/" },
    ],
  },

  // ─────────────────────────────────────────────────────────────────────────
  // 7 · BUSINESS CREDIT — die Bonität der Gesellschaft
  {
    pfad: "/en/business/knowledge/us-business-credit",
    sprache: "en",
    schwester: "/business/wissen/business-credit-usa",
    art: "wissen",
    seo: {
      titel: "Build US business credit: D-U-N-S, PAYDEX — FIAON Global",
      beschreibung: "Building US business credit: D-U-N-S Number, PAYDEX, Experian, Equifax, supplier accounts — and what issuers check when a company is young.",
    },
    stand: S,
    erschienen: ERSCHIENEN,
    kennung: "FG · 36",
    auge: "Knowledge · Business credit",
    h1: "Business credit.",
    h1b: "Your company’s creditworthiness.",
    lead: "Business credit is your US company’s own credit history with the business credit bureaus, with its own identifier and its own score. Over the years, it allows a company to become creditworthy in its own right. It is built in a set sequence and begins with the company’s core data.",
    ziffern: [
      { wert: "9 digits", label: "D-U-N-S Number, issued free of charge" },
      { wert: "80 – 100", label: "PAYDEX: low risk" },
      { wert: "3 bureaus", label: "Dun & Bradstreet, Experian, Equifax" },
    ],
    blick: [
      ["What", "The company’s own credit file with business credit bureaus"],
      ["Identifier", "D-U-N-S Number from Dun & Bradstreet, free of charge"],
      ["Scores", "PAYDEX (1–100), Experian Intelliscore Plus (1–100)"],
      ["What counts", "On-time payments to suppliers and issuers"],
      ["Foundation", "Matching core data in every register and application"],
      ["Limitation", "With young companies, the personal guarantee counts first"],
      ["With FIAON Global", "Matching core data; applications prepared in full, the institution decides"],
    ],
    kurz: "Business credit is your company’s credit history with the US business credit bureaus Dun & Bradstreet, Experian and Equifax. The basis is the D-U-N-S Number, which Dun & Bradstreet issues free of charge. The bureaus assess above all on-time payment to suppliers and issuers. Dun & Bradstreet’s PAYDEX runs from 1 to 100; 80 and above counts as low risk. With young companies, card issuers almost always require the owner’s personal guarantee. The company’s own history develops over years.",
    bloecke: [
      {
        typ: "text", id: "zwei", h2: "Personal file and company file",
        absaetze: [
          "For you personally, Equifax, Experian and TransUnion keep a credit file that a FICO Score summarises. For your company, business credit bureaus keep a second, separate file. They record payment behaviour, core data, public registers and owners. Card issuers, suppliers, landlords and insurers consult this file.",
          "The file on your company only becomes meaningful once business partners report payments. Until then it contains few entries. Such a file tells an institution little more than no file at all.",
        ],
      },
      {
        typ: "tabelle", id: "auskunfteien", h2: "The three business credit bureaus",
        kopf: ["", "Dun & Bradstreet", "Experian", "Equifax"],
        zeilen: [
          ["Identifier", "D-U-N-S Number, nine digits, per location", "the company’s own identifier", "the company’s own identifier"],
          ["Well-known score", "PAYDEX, 1 to 100", "Intelliscore Plus, 1 to 100", "own scores"],
          ["What it measures", "how promptly the company pays its suppliers", "the risk of serious late payment", "payment behaviour and risk of default"],
          ["Entry", "created and maintained free of charge", "arises from reports and registers", "arises from reports and registers"],
        ],
        fuss: [`According to the bureaus’ own information, as at ${FAKTEN_STAND_EN}. The bureaus change their score ranges and models from time to time.`],
      },
      {
        typ: "tabelle", id: "paydex", h2: "The PAYDEX and its bands",
        kopf: ["PAYDEX", "Risk of late payment", "Meaning"],
        zeilen: [
          ["80 – 100", "low", "the company pays on time or early"],
          ["50 – 79", "medium", "payments are sometimes late"],
          ["0 – 49", "high", "payments are regularly late"],
        ],
        fuss: ["Bands according to Dun & Bradstreet. A score only arises once enough payment experiences have been reported."],
      },
      {
        typ: "etappen", id: "aufbau", h2: "Building business credit in five steps",
        etappen: [
          { titel: "Align the core data", text: "Name, address, telephone number, EIN and website match everywhere: in the state register, with the IRS, with the institution, with suppliers and with the credit bureaus." },
          { titel: "Set up a D-U-N-S Number", text: "Dun & Bradstreet issues the number free of charge. Check there whether your company is already listed, and correct any differing details." },
          { titel: "Business account and first card", text: "The account shows revenue; the first business credit card shows the first on-time payments. Each issuer decides for itself whether it reports to business credit bureaus." },
          { titel: "Suppliers that report", text: "Genuine business relationships with payment terms are suitable, for example for office supplies, software, logistics or goods. The supplier must report its payment experiences to the credit bureaus." },
          { titel: "Time and key figures", text: "Pay on time, build revenue and reserves, and keep proper accounts. For a later bank loan, what counts is the company’s key figures, not scores alone." },
        ],
      },
      {
        typ: "karten", id: "warnung", h2: "Three warning signs in a provider", spalten: 3,
        karten: [
          { tag: "Warning sign", titel: "Supplier accounts without real business", text: "Some providers sell accounts with payment terms that are meant only to serve the score. An account without genuine business does not withstand an institution’s review." },
          { tag: "Warning sign", titel: "Promised limits", text: "The institution decides on a credit limit. A provider that promises your company a particular amount cannot honour that promise itself." },
          { tag: "Warning sign", titel: "Cards instead of loans", text: "Following action by the US Federal Trade Commission (FTC), a provider has been permanently banned from offering financing since 2025. It had advertised business financing and, for high fees, applied for credit cards." },
        ],
      },
      {
        typ: "text", id: "fiaon", h2: FIAON_H2,
        absaetze: [
          "We lay the foundation at formation: we use the same core data in every document and application, apply for the EIN and provide a US business address and a US telephone number. We prepare account and card applications in full; you submit them yourself.",
          `${FINANZIERUNG.satz} ${satz("S9", "en")}`,
        ],
        punkte: [
          `${TEIL.bedingung}: ${INSTITUT}`,
          P.geldZurueck,
        ],
      },
      { typ: "paket", id: "mandat", h2: P.karteH2, lead: P.karteLead, paket: "global_kapital" },
      {
        typ: "hinweis", id: "wissen", h2: "What you need to know",
        punkte: [
          "Credit bureaus set the scores, institutions set the limits. Nobody can promise a particular value.",
          GLOBAL_PFLICHTHINWEIS.en[2],
          "With young companies, the company’s own history does not replace the owner’s personal guarantee.",
        ],
      },
    ],
    fragen: [
      { f: "What is a D-U-N-S Number?", a: "The D-U-N-S Number is Dun & Bradstreet’s nine-digit identifier for businesses, assigned per location. Dun & Bradstreet issues it free of charge. It is the basis for the PAYDEX and for your company’s file with Dun & Bradstreet." },
      { f: "What is a good PAYDEX score?", a: "At 80 or above, the risk of late payment is considered low; from 50 to 79, medium; below 50, high." },
      { f: "How long does it take to build business credit?", a: "A PAYDEX only exists once enough payment experiences have been reported. This is usually the case after a few months with several business partners. A history that satisfies issuers without a personal guarantee takes years to develop." },
      { f: "Do I need business credit for a business credit card?", a: "With young companies, issuers mainly check the owner’s personal credit history and require a personal guarantee from the owner. The company’s own history gains weight over the years." },
      // 19.09.2026 (Justin): the capital is not tied to the US — wording from GLOBAL_KAPITAL_FREI (one source); since E-510 as a question instead of in the section about us.
      { f: GLOBAL_KAPITAL_FREI.en.frage, a: GLOBAL_KAPITAL_FREI.en.antwort },
    ],
    paket: "global_kapital",
    weiter: ["/en/business/us-business-credit-cards", "/en/business/knowledge/building-us-credit", "/en/business/knowledge/us-business-credit-card", "/en/business/knowledge/us-bank-account-documents"],
    quellen: [Q.duns, Q.paydex, Q.experian, QUELLE_FTC_SEEK],
  },

  // ─────────────────────────────────────────────────────────────────────────
  // 8 · DIE US-FIRMENKARTE — Prüfung, Haftung, Einführungszeitraum, Warnzeichen
  {
    pfad: "/en/business/knowledge/us-business-credit-card",
    sprache: "en",
    schwester: "/business/wissen/us-firmenkarte-beantragen",
    art: "wissen",
    seo: {
      titel: "US business credit card: checks and liability — FIAON Global",
      beschreibung: "US business credit card for an LLC: what issuers check, what a personal guarantee means, when the introductory period ends, how to spot unsound offers.",
    },
    stand: S,
    erschienen: ERSCHIENEN,
    kennung: "FG · 37",
    auge: "Knowledge · Business credit cards",
    h1: "The US business credit card.",
    h1b: "How issuers decide.",
    lead: "A US business credit card is the usual first credit for a young company. The issuer decides on every application after its own review; online advertising of “high limits for every LLC” does not change that. This article sets out what the issuer checks, what you sign and how to recognise unsound offers.",
    ziffern: [
      { wert: "personal", label: "liability of the owner, as a rule, alongside the company" },
      { wert: "Reg Z", label: "consumer protection applies only partly to business credit cards" },
      { wert: "October 2025", label: "permanent ban on a provider (FTC v. Seek Capital)" },
    ],
    blick: [
      ["Who decides", "The issuer, by its own rules"],
      ["What it checks", "Personal credit history, income, business, documents"],
      ["Liability", "A personal guarantee from the owner is the rule"],
      ["Introductory period", "Ends on a fixed date — then the issuer’s standard interest rate applies"],
      ["Consumer protection", "Only limited for business credit cards"],
      ["Warning signs", "Promised limits, a fee per card application, “loans” instead of cards"],
      ["With FIAON Global", "Each application prepared individually — on request, at no additional fee from FIAON"],
    ],
    kurz: "The issuer decides whether to issue a US business credit card. For a young company it mainly checks the owner’s personal US credit history, income, business and documents, and generally requires the owner’s personal guarantee. An introductory period ends on a fixed date; after that the issuer’s standard interest rate applies to the outstanding balance. Most consumer protection rules do not apply to business credit cards; the card agreement is what counts. No provider can promise a limit.",
    bloecke: [
      {
        typ: "text", id: "pruefung", h2: "What an issuer checks",
        absaetze: ["A new company has neither a credit history nor a balance sheet nor revenue over several years. The issuer therefore checks what is available:"],
        punkte: [
          "the owner’s personal credit history in the US, via SSN or ITIN",
          "the owner’s income and the company’s revenue, where there is any",
          "the documents: formation, EIN, address, telephone number, account",
          "the business: what the company does and whether it matches the information given",
          "the number of applications and new accounts in recent months",
        ],
        nach: "Without a personal US credit history, fewer issuers come into consideration. Some consider applications with an ITIN, some only with an SSN, some require an existing account with the issuer itself. These requirements change; each issuer sets them itself.",
      },
      {
        typ: "text", id: "haftung", h2: "Personal guarantee: what you sign",
        absaetze: [
          "With almost every business credit card for a young company, the owner signs a personal guarantee. If the company does not pay, the owner is personally liable. The limited liability of the LLC offers no protection in that case.",
          "Treat the card, therefore, like a personal loan. Spend only what the company can safely repay.",
        ],
      },
      {
        typ: "text", id: "einfuehrung", h2: "The introductory period and its end",
        absaetze: [
          `${EINFUEHRUNG} Such a period is credit for a limited time. It ends on a fixed date; after that the issuer’s standard interest rate applies to the outstanding balance.`,
          "Anyone using an introductory period therefore plans for its end: repayment comes from the business, not from the next card. Fees, for example for cash withdrawals or for balance transfers from other cards, are often not covered by the introductory period. They are charged from the first day.",
        ],
        nach: "Evidence: in FTC v. Seek Capital the court found that the provider had also applied for cards without such an introductory period (ruling of 16 September 2025, see Sources).",
      },
      {
        typ: "tabelle", id: "schutz", h2: "Protection: personal and business credit cards",
        kopf: ["", "Card for personal purposes", "Card for business purposes"],
        zeilen: [
          ["Rules of the Truth in Lending Act (Regulation Z)", "apply in full", "apply only to the issuance of the card and to liability for unauthorised use"],
          ["Protection under the CARD Act, e.g. on interest rate increases", "yes", "generally no"],
          ["Liability for unauthorised use", "limited by law", "limited by law; may be agreed differently where a business has ten or more cards"],
          ["Who sets the terms", "law and contract", "mainly the contract"],
        ],
        fuss: ["Based on 12 CFR 1026.3 and 1026.12 (Regulation Z) with the official commentary; simplified overview."],
      },
      {
        typ: "text", id: "stapeln", h2: "Serial applications: an FTC case",
        absaetze: [
          "For high fees, some providers apply for several cards with introductory periods within a short period and describe this as “financing”. The business owner bears the risk: many enquiries within a short period, high utilisation and a personal guarantee for every card. In addition, all introductory periods end at the same time.",
          "A case brought by the US Federal Trade Commission (FTC) shows the consequences. A provider had advertised business financing and applied solely for credit cards on its customers’ behalf, for fees of several thousand dollars. In September 2025 a US federal court found that it had deceived its customers in doing so. The deception concerned, among other things, its relationships with lenders, its fees and hard enquiries with credit bureaus. Since October 2025 the provider and its founder have been permanently banned from offering financing to business owners. The monetary judgment is for US$48.28 million. It is partly suspended because the defendants are unable to pay it in full.",
        ],
      },
      {
        typ: "karten", id: "warnzeichen", h2: "Six warning signs in a provider", spalten: 3,
        karten: [
          { tag: "Warning sign", titel: "A limit is promised", text: "The issuer decides on every limit. A provider that promises an amount cannot honour that promise itself." },
          { tag: "Warning sign", titel: "A fee that grows with every card application", text: "A provider that earns from every further card has an incentive to make further applications, even if they harm your credit file. Ask for the fee and a schedule of services in writing before you sign." },
          { tag: "Warning sign", titel: "A “loan” that is a card", text: "A credit card is not a loan. Anyone who announces a “loan” or a “line of credit” and then makes card applications conceals what you are signing." },
          { tag: "Warning sign", titel: "Many applications in one day", text: "A series of applications weighs on your credit file and makes every further decision by an issuer harder." },
          { tag: "Warning sign", titel: "No mention of liability", text: "Anyone who does not mention the personal guarantee conceals an essential obligation under any business credit card." },
          { tag: "Warning sign", titel: "Reviews prohibited", text: "Clauses that prohibit customers from posting negative reviews are not permitted in the US. A contract containing such a clause is a warning sign." },
        ],
      },
      {
        typ: "text", id: "fiaon", h2: FIAON_H2,
        absaetze: [
          `${KARTEN.satz} We prepare each card application individually and in full. We do not prepare serial applications.`,
        ],
        punkte: [
          `${TEIL.ihrTeil}: ${KARTEN.ihrTeil}`,
          `${TEIL.bedingung}: ${KARTEN.bedingung}`,
          `Fees: ${beleg("honorarVorab", "en")}`,
        ],
      },
      { typ: "paket", id: "mandat", h2: "The card applications in your engagement", lead: P.karteLead, paket: "global_banking" },
      {
        typ: "hinweis", id: "wissen", h2: "What you need to know",
        punkte: [
          GLOBAL_PFLICHTHINWEIS.en[2],
          "An introductory period ends on a fixed date; after that the issuer’s standard interest rate applies.",
          satz("S8", "en"),
        ],
      },
    ],
    fragen: [
      { f: "Can my LLC apply for a US business credit card?", a: "Yes. The issuer decides whether to issue a card. With young companies it mainly checks the owner’s personal US credit history and requires the owner’s personal guarantee. Without an SSN or ITIN, only a few issuers come into consideration." },
      { f: "Am I personally liable for my LLC’s business credit card?", a: "As a rule, yes. With young companies, almost all issuers require a personal guarantee from the owner. The LLC’s limited liability does not protect you in that case." },
      { f: "What happens when the introductory period ends?", a: "It ends on a fixed date. After that, the issuer’s standard interest rate applies to the outstanding balance. Each issuer sets the rate and the terms itself." },
      { f: "Does US consumer protection apply to business credit cards?", a: "Only to a limited extent. For cards used for business purposes, the rules of Regulation Z that apply are mainly those on the issuance of the card and on liability for unauthorised use. The protections of the CARD Act, for example on interest rate increases, generally do not apply." },
      { f: "How do I spot dubious business credit card providers?", a: "By six warning signs: promised limits, a fee that grows with every card application and “loans” that are card applications. Others are many applications in one day, no mention of the personal guarantee and a ban on reviews in the contract." },
    ],
    paket: "global_banking",
    weiter: ["/en/business/us-business-credit-cards", "/en/business/knowledge/building-us-credit", "/en/business/knowledge/us-business-credit", "/en/business/knowledge/checking-providers"],
    quellen: [Q.regZ3, Q.regZ12, QUELLE_FTC_SEEK, Q.ftcSeekUrteil],
  },
];
