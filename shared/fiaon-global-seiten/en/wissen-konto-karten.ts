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
// keine Kredite. Der Fall FTC v. Seek Capital (17.11.2025) steht mit denselben
// Zahlen wie im Deutschen da.
// ═══════════════════════════════════════════════════════════════════════════
import { GLOBAL_KAPITAL_FREI, GLOBAL_PFLICHTHINWEIS, GLOBAL_ROLLEN, globalPaket } from "../../fiaon-global";
import { FAKTEN_STAND_EN, QUELLEN_WISSEN_EN as Q, SCHWELLEN_EN } from "../fakten-en";
import type { GlobalQuelle, GlobalSeite } from "../typen";

const S = "2026-09-24";
const KAPITAL_FREI = `${GLOBAL_KAPITAL_FREI.en.satz} ${GLOBAL_KAPITAL_FREI.en.steuer}`;
const BANKING = globalPaket("global_banking")?.en.name ?? "Global Banking";
const KAPITAL = globalPaket("global_kapital")?.en.name ?? "Global Capital";
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
    erschienen: S,
    kennung: "FG · 34",
    auge: "Knowledge · Account",
    h1: "The LLC’s US account.",
    h1b: "What institutions want to see.",
    lead: "An application for a US business account rarely fails because of the company itself; it fails because of the documents: a missing document, an address that does not match, a business nobody understands. Here is what institutions require, why they are obliged to require it — and what an application that holds up first time looks like.",
    ziffern: [
      { wert: "7 documents", label: "that almost every institution requires" },
      { wert: "25%", label: "every shareholder with this share or more is identified" },
      { wert: "$250,000", label: "deposit insurance per institution and category (FDIC)" },
    ],
    blick: [
      ["Prerequisite", "Registered company with an EIN"],
      ["Institutions’ duty", "Verify identity, record owners holding 25% or more"],
      ["Core documents", "Formation document, EIN letter, operating agreement, passports"],
      ["Most common reason for refusal", "Unclear business, unsuitable address"],
      ["Deposit insurance", "$250,000 per depositor, institution and category"],
      ["Who decides", "The institution alone"],
      ["With FIAON Global", "Application fully prepared, support with follow-up questions"],
    ],
    kurz: `For an LLC’s account, US institutions require the formation document, the IRS confirmation of the EIN, the operating agreement, the passports of all shareholders holding ${SCHWELLEN_EN.eigentuemer} or more and of the person who controls the company, proof of address, and a clear description of the business with the expected payment flows. Institutions must collect this information under US law; they decide for themselves whether, and on what terms, they open an account.`,
    bloecke: [
      {
        typ: "text", id: "warum", h2: "Why institutions ask so many questions",
        absaetze: [
          "Every US institution must verify the identity of its customer before opening an account (Customer Identification Program, 31 CFR 1020.220): name, address and an identification number. For people without US citizenship this is, for example, the passport number together with the country of issuance; for companies, the EIN and a physical place of business.",
          `Then there are the beneficial owners (31 CFR 1010.230): every person who holds at least ${SCHWELLEN_EN.eigentuemer}, and one person who exercises significant control over the company. Since February 2026, institutions no longer have to re-verify this information each time a further account is opened; they verify it at the first account opening and whenever doubts arise — the initial verification remains.`,
        ],
      },
      {
        typ: "tabelle", id: "unterlagen", h2: "The seven documents",
        kopf: ["Document", "Purpose", "What matters"],
        zeilen: [
          ["Articles of Organization", "Proof that the company exists", "the version registered by the state, name exactly as in the application"],
          ["EIN confirmation (CP 575 or Letter 147C)", "The company’s tax number", "name and address as in the formation document"],
          ["Operating agreement", "Who holds interests and who may act", "signed, interests total 100%"],
          ["Passports", "Identity of shareholders holding 25% or more and of the controlling person", "valid, clearly legible, names as in the operating agreement"],
          ["Proof of address", "Residential address of those involved", "current and in the person’s name"],
          ["Business description", "What the company does", "customers, products, countries, expected revenue and payment channels"],
          ["Source of the first deposit", "Where the first money comes from", "bank statement or proof of the deposit"],
        ],
        fuss: ["Some institutions additionally require a Certificate of Good Standing, a website or first contracts."],
      },
      {
        typ: "karten", id: "ablehnung", h2: "Why applications fail", spalten: 3,
        karten: [
          { tag: "Reason", titel: "A business nobody understands", text: "A vague “services” label with no clients, no website, no contracts: the institution cannot assess the risk and declines." },
          { tag: "Reason", titel: "Addresses that do not match", text: "Residence, business address and the address on the EIN letter differ from one another — or the business address is that of a registered agent." },
          { tag: "Reason", titel: "Gaps in the operating agreement", text: "No signature, interests that do not add up, a shareholder missing: the information on the owners cannot be verified." },
          { tag: "Reason", titel: "Higher-risk industries", text: "Institutions scrutinise some activities more strictly or will not consider them at all — that is their decision, not a question of the documents." },
          { tag: "Reason", titel: "Links to sanctioned countries", text: "Payments or persons involved with links to sanctioned countries almost always lead to refusal." },
          { tag: "Reason", titel: "Contradictions in the interview", text: "Anyone who writes one thing in the application and says another in the interview loses the institution’s trust — often for good." },
        ],
      },
      {
        typ: "tabelle", id: "art", h2: "Bank or financial platform?",
        kopf: ["", "Bank", "Financial platform"],
        zeilen: [
          ["Opening", "sometimes only with an in-person appointment", "usually entirely online"],
          ["Who holds the account", "the bank itself", "usually a partner bank in the background"],
          ["Deposit insurance", "through the FDIC, if the bank is insured", "only through the partner bank and only under its conditions"],
          ["Later: cards and loans", "often from a single source", "often cards only"],
        ],
        fuss: ["General overview; each institution sets its own services and terms."],
      },
      {
        typ: "text", id: "sicherung", h2: "What deposit insurance covers",
        absaetze: [
          `US deposit insurance through the FDIC protects ${SCHWELLEN_EN.fdic} per depositor, per insured institution and per ownership category. An LLC or corporation with its own business forms a separate category — its balance is not added to your personal accounts at the same institution.`,
          "The insurance applies only if an insured institution fails. A financial platform is not itself a bank; whether and how balances held there are protected depends on the partner bank and on the platform’s terms.",
        ],
      },
      {
        typ: "etappen", id: "weg", h2: "How a well-prepared application works",
        etappen: [
          { titel: "Gather the documents", text: "All seven documents, with identical names and addresses, in one file." },
          { titel: "Describe the business", text: "Two paragraphs a stranger can understand: what, for whom, in which countries, with what revenue and which payment channels." },
          { titel: "Choose the institution", text: "Based on your business, currencies, online opening and later cards — not on advertising." },
          { titel: "Application and follow-up questions", text: "Follow-up questions almost always come. Those who answer them quickly and consistently have the best prospects." },
          { titel: "Opening and first deposit", text: "Once the account is approved, the first deposit follows — with proof of where the money comes from. For an LLC with a foreign shareholder (member), it is also a reportable transaction for Form 5472." },
        ],
      },
      {
        typ: "text", id: "fiaon", h2: "How FIAON Global gets your account under way",
        absaetze: [
          "At FIAON Global, the account application does not begin with a form but with your business. We write the business description with you, compile all documents with identical details, choose the institution to suit your plans and prepare the application in full. We support you through the institution’s follow-up questions; if an institution requires an in-person appointment, our team in Miami goes with you.",
          `The account is the start of the card ladder: with ${BANKING}, we then plan the sequence of further issuers and prepare every application.`,
          GLOBAL_ROLLEN.en.fiaon,
        ],
      },
      { typ: "paket", id: "paket", h2: "Account and card ladder in one package", lead: `From the first account application to a planned sequence of further issuers — ${BANKING}.`, paket: "global_banking" },
      {
        typ: "hinweis", id: "wissen", h2: "What you need to know",
        punkte: [
          "The institution alone decides on every account — even when the documents are complete.",
          `If your US company holds accounts outside the US totalling more than ${SCHWELLEN_EN.fbar}, it must report them to FinCEN every year (FBAR).`,
          GLOBAL_PFLICHTHINWEIS.en[1],
        ],
      },
    ],
    fragen: [
      { f: "Can I open a US bank account for my LLC without travelling to the US?", a: "Often, yes. Many institutions open accounts online for companies whose shareholders are abroad; some require an in-person appointment. Each institution sets which routes it offers." },
      { f: "What documents do I need for a US business bank account?", a: "The formation document, the EIN confirmation, the operating agreement, the passports of all shareholders holding 25 per cent or more and of the controlling person, proof of address, a business description and proof of the source of the first deposit." },
      { f: "Do I need an SSN or ITIN for my LLC’s bank account?", a: "The company needs its EIN. For shareholders without an SSN, the passport is sufficient for many institutions; some ask for an ITIN." },
      { f: "Why was my US bank account application rejected?", a: "Usually because of an unclearly described business, contradictory information or an address the institution does not accept. Institutions often do not give their reasons — which is why a complete first application matters." },
      { f: "Are deposits in a US business bank account insured?", a: `At an FDIC-insured institution, deposits are protected in the amount of ${SCHWELLEN_EN.fdic} per depositor, institution and ownership category. With financial platforms, protection depends on the partner bank.` },
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
      beschreibung: "Why SCHUFA does not count in the US, how the FICO Score is made up, what you need for a first score and how a US credit history grows.",
    },
    stand: S,
    erschienen: S,
    kennung: "FG · 35",
    auge: "Knowledge · Credit in the US",
    h1: "Credit in the US.",
    h1b: "It starts at zero.",
    lead: "In Germany, SCHUFA has known your payment history for decades. In the US, nobody knows you — to the credit bureaus there, you are a blank slate. That is not a black mark, but it is a starting point. Here is how a US credit history comes about and in which order it grows.",
    ziffern: [
      { wert: "300 – 850", label: "Range of the FICO Score" },
      { wert: "6 months", label: "Minimum age of an account for a first score" },
      { wert: "35%", label: "Weight of payment history" },
    ],
    blick: [
      ["Starting point", "SCHUFA data does not count in the US"],
      ["The credit bureaus", "Equifax, Experian, TransUnion"],
      ["The score", "FICO, 300 to 850, from five factors"],
      ["First score", "One account, at least six months old, recently reported"],
      ["Key", "SSN or ITIN for the personal file"],
      ["What works", "Pay on time, use only a small part of your limits, plan applications"],
      ["With FIAON Global", "Sequence planned, every application prepared"],
    ],
    kurz: "Your SCHUFA data does not count in the US; a US credit history starts at zero. A first FICO Score can be generated once an account has existed for at least six months and has been reported in the last six months. The score (300 to 850) follows five factors: payment history 35 per cent, utilisation 30, length of history 15, new accounts 10 and credit mix 10. Those who pay on time, use only a small part of their limits and plan their applications build the history fastest.",
    bloecke: [
      {
        typ: "text", id: "null", h2: "Why you start at zero in the US",
        absaetze: [
          "Credit bureaus work nationally. SCHUFA in Germany, KSV1870 in Austria or CRIF in Switzerland do not report to the US credit bureaus Equifax, Experian and TransUnion. A long, clean payment history in Europe therefore does not, as a rule, count for your first US application — but neither does an old entry.",
          "In practice, the US credit bureaus keep personal files by Social Security number or ITIN, together with name, address and date of birth. Without one of these numbers, there is rarely a file to which payments can be linked.",
        ],
      },
      {
        typ: "tabelle", id: "faktoren", h2: "What the FICO Score is made of",
        kopf: ["Factor", "Weight", "What counts"],
        zeilen: [
          ["Payment history", "35%", "on-time payments, every late payment, collections"],
          ["Utilisation", "30%", "how much of your limits you use — usually reported on the statement date"],
          ["Length of history", "15%", "how long your accounts have existed"],
          ["New accounts", "10%", "how many accounts you have recently opened or applied for"],
          ["Credit mix", "10%", "cards, instalment loans, mortgages"],
        ],
        fuss: ["Weighting according to FICO for the population as a whole; it differs for people with short credit histories."],
      },
      {
        typ: "etappen", id: "aufbau", h2: "The order in which your history is built",
        etappen: [
          { titel: "Number and address", text: "An ITIN or SSN, a US address, a phone number — identical in every application." },
          { titel: "The first account", text: "A personal card with a small limit, often against a deposit (a secured card). Each issuer decides for itself whether a business credit card appears in your personal file." },
          { titel: "Six months of patience", text: "Only after six months of reporting is there a first FICO Score. During this time only one thing counts: every bill paid on time and in full." },
          { titel: "Keep utilisation low", text: "Use only a small part of your limits and pay before the statement date — what is reported is usually the balance on that day." },
          { titel: "Expand carefully", text: "As your history grows, further accounts follow — planned and with gaps between applications, because every enquiry is recorded and every new account lowers the average age of your accounts." },
        ],
      },
      {
        typ: "karten", id: "irrwege", h2: "What does not help", spalten: 3,
        karten: [
          { tag: "Wrong turn", titel: "Many applications at once", text: "Every enquiry is recorded, every new account lowers the average age of your accounts. A series of refusals is the slowest route." },
          { tag: "Wrong turn", titel: "Bought history", text: "Offers to be added, for a fee, as an authorised user on other people’s cards are risky: issuers can close such accounts, and the benefit is uncertain." },
          { tag: "Wrong turn", titel: "“Credit repair” paid up front", text: "Nobody can have accurate entries removed. The US Federal Trade Commission (FTC) expressly warns against services that promise this." },
        ],
      },
      {
        typ: "text", id: "einsicht", h2: "Checking your US file yourself",
        absaetze: [
          "Each of the three credit bureaus shows you your file free of charge via AnnualCreditReport.com, their joint service — by law once a year, and now permanently every week. The prerequisite is that a file exists: with an SSN or ITIN and a US address.",
          "If you find an error — someone else’s account, an incorrect late payment, an old address — have it corrected directly with the credit bureau. This costs nothing and requires no service provider.",
        ],
      },
      {
        typ: "text", id: "firma", h2: "Personal and business history",
        absaetze: [
          "Alongside your personal file, your company can build its own history with the business credit bureaus — with its own identifier and its own score. With a young company, however, card issuers almost always look first at the person behind it: a personal guarantee is the rule, and so your personal history counts.",
          "Both histories grow best together: on-time payments by the company, a clean personal file, no hasty applications.",
        ],
      },
      {
        typ: "text", id: "fiaon", h2: "How FIAON Global helps build your US history",
        absaetze: [
          "A US credit history does not come from a trick but from a plan: the right numbers, identical details, the right first application, then patience and sequence. That is exactly FIAON Global’s card ladder. We make sure that your ITIN, address and phone number are right from the start, plan the sequence of issuers, prepare every application in full and each month review with you where you stand.",
          "The issuer decides on every limit. Our task is to ensure that it sees your applications complete, consistent and at the right time.",
        ],
      },
      { typ: "paket", id: "paket", h2: "The card ladder in one package", lead: `Company, tax numbers, first card and the planned sequence of further issuers — ${BANKING}.`, paket: "global_banking" },
      {
        typ: "hinweis", id: "wissen", h2: "What you need to know",
        punkte: [
          "Nobody can promise a particular score or limit — the score follows the data that issuers report.",
          GLOBAL_PFLICHTHINWEIS.en[2],
          "The ITIN serves tax purposes; whoever holds one takes on the obligations that come with it.",
        ],
      },
    ],
    fragen: [
      { f: "Does my SCHUFA record count in the US?", a: "No. US credit bureaus do not use SCHUFA data; your US credit history starts at zero — without any benefit from good entries, but also without any disadvantage from old ones." },
      { f: "How do I get a US credit score without an SSN?", a: "Through the ITIN: in practice, credit bureaus keep personal files by SSN or ITIN. A first FICO Score can be generated once an account has existed for at least six months and has been reported in the last six months." },
      { f: "How long does it take to build a US credit history?", a: "A first score comes after about six months. A robust history that supports larger limits grows over years — with on-time payments and few, planned applications." },
      { f: "What credit utilisation should I aim for?", a: "As low as possible. Utilisation accounts for around 30 per cent of the FICO Score; what is reported is usually the balance on the statement date." },
      { f: "Does a business credit card help my personal credit score?", a: "Each issuer decides for itself: some report business credit cards in the personal file, some only when payments are late, some not at all." },
    ],
    paket: "global_banking",
    weiter: ["/en/business/us-business-credit-cards", "/en/business/knowledge/us-business-credit", "/en/business/knowledge/applying-for-an-itin", "/en/business/knowledge/us-business-credit-card"],
    quellen: [Q.ficoFaktoren, Q.ficoMindest, Q.ftcAuskunft, Q.ftcCredit, Q.itinUebersicht],
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
    erschienen: S,
    kennung: "FG · 36",
    auge: "Knowledge · Business credit",
    h1: "Business credit.",
    h1b: "Your company’s creditworthiness.",
    lead: "Alongside your personal file, your US company can build its own credit history — with business credit bureaus, with its own identifier and its own score. It is the route by which a company eventually becomes creditworthy in its own right. It runs in stages, and it begins not with cards but with core company data.",
    ziffern: [
      { wert: "9 digits", label: "D-U-N-S Number, free of charge" },
      { wert: "80 – 100", label: "PAYDEX: low risk" },
      { wert: "3 bureaus", label: "Dun & Bradstreet, Experian, Equifax" },
    ],
    blick: [
      ["What", "The company’s own credit file with business credit bureaus"],
      ["Key", "D-U-N-S Number from Dun & Bradstreet, free of charge"],
      ["Scores", "PAYDEX (1–100), Experian Intelliscore Plus (1–100)"],
      ["What counts", "On-time payments to suppliers and issuers"],
      ["Foundation", "Consistent core data everywhere"],
      ["Limitation", "With young companies, the personal guarantee counts first"],
      ["With FIAON Global", "Core data, sequence, key-figures file"],
    ],
    kurz: "Business credit is your company’s credit history with the US business credit bureaus Dun & Bradstreet, Experian and Equifax. The basis is the free D-U-N-S Number; what is assessed above all is on-time payment to suppliers and issuers — with Dun & Bradstreet’s PAYDEX on a scale of 1 to 100, where 80 and above counts as low risk. With young companies, card issuers nevertheless almost always require the owner’s personal guarantee; the company’s own history grows over years.",
    bloecke: [
      {
        typ: "text", id: "zwei", h2: "Two files, two worlds",
        absaetze: [
          "For you personally, Equifax, Experian and TransUnion keep a file that a FICO Score summarises. For your company there is a second, separate world: business credit bureaus that record payment behaviour, core data, public registers and owners. Card issuers, suppliers, landlords and insurers make enquiries there.",
          "The file on your company only becomes meaningful once business partners report payments to it. Until then it is thin — and to an institution a thin file is hardly better than none.",
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
        fuss: [`According to the bureaus’ own information, as of ${FAKTEN_STAND_EN}. The providers change scales and models from time to time.`],
      },
      {
        typ: "tabelle", id: "paydex", h2: "What the PAYDEX means",
        kopf: ["PAYDEX", "Risk of late payment", "What it means"],
        zeilen: [
          ["80 – 100", "low", "the company pays on time or early"],
          ["50 – 79", "medium", "payments are sometimes late"],
          ["0 – 49", "high", "payments are regularly late"],
        ],
        fuss: ["Bands according to Dun & Bradstreet. A score only arises once enough payment experiences have been reported."],
      },
      {
        typ: "etappen", id: "aufbau", h2: "Five stages to a history of your own",
        etappen: [
          { titel: "Standardise core data", text: "Name, address, phone number, EIN and website are identical everywhere — in the state register, with the IRS, with the institution, with suppliers and with the credit bureaus." },
          { titel: "Obtain a D-U-N-S Number", text: "Free of charge from Dun & Bradstreet. Check there, too, whether your company is already listed, and correct any differing details." },
          { titel: "Business account and first card", text: "The account shows revenue, the first business credit card the first on-time payments. Each issuer decides for itself whether it reports to business credit bureaus." },
          { titel: "Suppliers that report", text: "Genuine business relationships with payment terms — for office supplies, software, logistics or goods — whose payment experiences reach the credit bureaus." },
          { titel: "Time and figures", text: "Pay on time, build revenue and reserves, keep the accounts in good order. For a later bank loan, what counts in the end is key figures, not scores alone." },
        ],
      },
      {
        typ: "karten", id: "warnung", h2: "What to beware of", spalten: 3,
        karten: [
          { tag: "Caution", titel: "Supplier accounts with no real business behind them", text: "Some providers sell accounts with payment terms that are meant only to serve the score. Anything that does not reflect genuine business will not hold up under an institution’s review." },
          { tag: "Caution", titel: "Promised limits", text: "Anyone who promises your company a credit limit of a particular amount is promising something only an institution can decide." },
          { tag: "Caution", titel: "Cards instead of loans", text: "In 2025 the US Federal Trade Commission (FTC) permanently banned a provider from offering financing: it had promised loans and, for high fees, applied for credit cards." },
        ],
      },
      {
        typ: "text", id: "fiaon", h2: "How FIAON Global builds your company’s history",
        absaetze: [
          "A company’s history cannot be bought — but it can be planned. FIAON Global lays the foundation at formation: identical core data in all registers and applications, EIN, US address and phone number, an account that fits the business. We then plan the sequence of issuers, prepare every application and review with you, month by month, what the credit bureaus know about your company.",
          `With ${KAPITAL}, we take this route through to the key-figures file for a later bank loan — in ongoing coordination with our partner lawyer and partner tax adviser.`,
          KAPITAL_FREI,
        ],
      },
      { typ: "paket", id: "paket", h2: "The whole route in one package", lead: `Core data, a card ladder across several issuers and the documents for a bank loan — ${KAPITAL}.`, paket: "global_kapital" },
      {
        typ: "hinweis", id: "wissen", h2: "What you need to know",
        punkte: [
          "Credit bureaus set the scores, institutions set the limits. Nobody can promise a particular value.",
          GLOBAL_PFLICHTHINWEIS.en[2],
          "With young companies, the company’s own history does not replace the personal guarantee.",
        ],
      },
    ],
    fragen: [
      { f: "What is a D-U-N-S Number?", a: "Dun & Bradstreet’s nine-digit identifier for businesses, assigned per location. It is free of charge and the basis for the PAYDEX and for your company’s file with Dun & Bradstreet." },
      { f: "What is a good PAYDEX score?", a: "At 80 or above, the risk of late payment is considered low; from 50 to 79, medium; below 50, high." },
      { f: "How long does it take to build business credit?", a: "A PAYDEX only exists once enough payment experiences have been reported — usually after a few months with several business partners. A history that holds up without a personal guarantee takes years." },
      { f: "Do I need business credit for a business credit card?", a: "With young companies, issuers mainly check the owner’s personal history and require a personal guarantee from the owner. The company’s own history gains weight over the years." },
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
      beschreibung: "US business credit card for an LLC: what issuers check, what a personal guarantee means, when the introductory period ends and how to spot rip-offs.",
    },
    stand: S,
    erschienen: S,
    kennung: "FG · 37",
    auge: "Knowledge · Business credit cards",
    h1: "The US business credit card.",
    h1b: "How issuers decide.",
    lead: "In the US, business credit cards are the usual first step into credit for a young company — and the most popular advertising promise online. Between “high limits for every LLC” and reality lies the issuer’s review. Here is what the issuer checks, what you sign and how to recognise dubious offers.",
    ziffern: [
      { wert: "personal", label: "liability of the owner, as a rule, alongside the company" },
      { wert: "Reg Z", label: "consumer protection applies only partly to business credit cards" },
      { wert: "November 2025", label: "the FTC permanently banned a provider from the business" },
    ],
    blick: [
      ["Who decides", "The issuer — by its own rules"],
      ["What it checks", "Personal history, income, business, documents"],
      ["Liability", "A personal guarantee from the owner is the rule"],
      ["Introductory period", "No debit interest for a limited time — then the standard rate applies"],
      ["Consumer protection", "Only limited for business credit cards"],
      ["Warning signs", "Promised limits, fees tied to the limit, “loans” instead of cards"],
      ["With FIAON Global", "Sequence planned, every application prepared, fixed price"],
    ],
    kurz: "The issuer decides whether to issue a US business credit card. For a young company it mainly checks the owner’s personal credit history in the US, income, business and documents, and it generally requires the owner’s personal guarantee. An introductory period without debit interest ends on a fixed date; after that the standard interest rate applies to the outstanding balance. Because most consumer protection rules do not apply to business credit cards, it pays to read the terms closely — and to be wary of anyone who promises limits.",
    bloecke: [
      {
        typ: "text", id: "pruefung", h2: "What an issuer checks",
        absaetze: ["A new company has no history, no balance sheet, no revenue over several years. The issuer therefore looks at what it can check:"],
        punkte: [
          "the owner’s personal credit history in the US — via SSN or ITIN",
          "the owner’s income and the company’s revenue, where there is any",
          "the documents: formation, EIN, address, phone number, account",
          "the business: what the company does and whether it matches the information given",
          "the number of applications and new accounts in recent months",
        ],
        nach: "Without a personal US history, the routes are narrower: some issuers consider applications with an ITIN, some only with an SSN, some require an existing account with them. Which issuers these are changes over time — and each issuer decides this for itself.",
      },
      {
        typ: "text", id: "haftung", h2: "Personal guarantee: what you sign",
        absaetze: [
          "With almost every business credit card for a young company, the owner signs a personal guarantee: if the company does not pay, the owner is personally liable. The limited liability of the LLC then offers no protection.",
          "That is no argument against the card, but it is an argument for treating it like a personal loan: spend only what the company can safely repay.",
        ],
      },
      {
        typ: "text", id: "einfuehrung", h2: "The introductory period without debit interest",
        absaetze: [
          "Many US business credit cards offer new customers an introductory period without debit interest on purchases. That is credit for a limited time, not free money: the period ends on a fixed date, after which the standard interest rate applies to the outstanding balance — for cards, usually a double-digit rate.",
          "Anyone using an introductory period therefore needs a plan for when it ends: repayment from the business, not from the next card. Fees, for example for cash withdrawals or for balance transfers from other cards, are often not covered by the introductory period and cost money from day one.",
        ],
      },
      {
        typ: "tabelle", id: "schutz", h2: "Personal card and business credit card: the difference in protection",
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
        typ: "text", id: "stapeln", h2: "“Card stacking” — and an FTC case",
        absaetze: [
          "A model advertised online applies for several cards with introductory periods at once and sells this as “financing” — for high fees. The risk lies entirely with the business owner: many enquiries at once, high utilisation, a personal guarantee for every card and all introductory periods ending at the same time.",
          "A case brought by the US Federal Trade Commission (FTC) shows how this can end: in November 2025 a provider and its chief executive were permanently banned from offering financing to business owners. The provider had promised loans and lines of credit and instead, for fees of several thousand dollars, applied for credit cards; the court regarded this as deception. The settlement is for US$48.28 million, partly suspended because the defendants are unable to pay.",
        ],
      },
      {
        typ: "karten", id: "warnzeichen", h2: "Six warning signs in a provider", spalten: 3,
        karten: [
          { tag: "Warning sign", titel: "A limit is promised", text: "The issuer decides on every limit. Anyone who promises an amount is promising something they cannot deliver." },
          { tag: "Warning sign", titel: "Fees as a percentage of the limit", text: "Anyone who earns from the limit earns from every further application — even if it harms you." },
          { tag: "Warning sign", titel: "A “loan” that is a card", text: "Cards are cards. Anyone who talks of loans or a line of credit and means card applications is deceiving you." },
          { tag: "Warning sign", titel: "Many applications in one day", text: "A series of applications weighs on your history and makes every further decision harder." },
          { tag: "Warning sign", titel: "Not a word about liability", text: "Anyone who does not mention the personal guarantee is concealing the most important thing about any business credit card." },
          { tag: "Warning sign", titel: "Reviews prohibited", text: "Clauses that prohibit customers from posting negative reviews are not permitted in the US — and a clear signal." },
        ],
      },
      {
        typ: "text", id: "fiaon", h2: "How FIAON Global guides you to your first card — and beyond",
        absaetze: [
          "FIAON Global turns the card application into a plan instead of a gamble. We lay the foundation — company, EIN, ITIN, address, phone number, account — choose the first issuer to suit your history, prepare the application in full and plan the card ladder: further issuers in the right order, with gaps between applications, supported in a monthly review.",
          "We work at a fixed price that is set before the engagement — with no fee based on the limit and no share of the capital. The issuer decides on every limit; the capital range of your package is your goal, not a promise.",
          KAPITAL_FREI,
        ],
      },
      { typ: "paket", id: "paket", h2: "The card ladder in one package", lead: `First card, planned follow-up applications, monthly review — ${BANKING} at a fixed price.`, paket: "global_banking" },
      {
        typ: "hinweis", id: "wissen", h2: "What you need to know",
        punkte: [
          GLOBAL_PFLICHTHINWEIS.en[2],
          "An introductory period without debit interest ends on a fixed date; after that the issuer’s standard interest rate applies.",
          "FIAON is not a bank, does not lend and does not broker credit.",
        ],
      },
    ],
    fragen: [
      { f: "Can my LLC apply for a US business credit card?", a: "Yes. Whether a card is issued is decided by the issuer: with young companies it mainly checks the owner’s personal history in the US and requires the owner’s personal guarantee. Without an SSN or ITIN, the routes are narrow." },
      { f: "Am I personally liable for my LLC’s business credit card?", a: "As a rule, yes. With young companies, almost all issuers require a personal guarantee from the owner; the LLC’s limited liability then does not apply." },
      { f: "What happens when the introductory period without debit interest ends?", a: "It ends on a fixed date. After that, the issuer’s standard interest rate applies to the outstanding balance — for cards, usually a double-digit rate." },
      { f: "Does US consumer protection apply to business credit cards?", a: "Only to a limited extent. For cards used for business purposes, the rules of Regulation Z that apply are mainly those on the issuance of the card and on liability for unauthorised use; the protections of the CARD Act, for example on interest rate increases, generally do not apply." },
      { f: "How do I spot dubious business credit card providers?", a: "Watch for promised limits, fees as a percentage of the limit, “loans” that turn out to be card applications, many applications at once and contracts that prohibit reviews." },
    ],
    paket: "global_banking",
    weiter: ["/en/business/us-business-credit-cards", "/en/business/knowledge/building-us-credit", "/en/business/knowledge/us-business-credit", "/en/business/knowledge/checking-providers"],
    quellen: [Q.regZ3, Q.regZ12, QUELLE_FTC_SEEK, Q.ftcSeekUrteil],
  },
];
