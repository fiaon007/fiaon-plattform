// ═══════════════════════════════════════════════════════════════════════════
// FIAON GLOBAL — WISSEN AUF ENGLISCH: ANSCHRIFT UND TELEFON, US-IMMOBILIE,
// FINANZIERUNGSWEGE (20.10.2026, E-416)
//
// Die englischen Schwestern von ../wissen-finanzierung.ts. Britisches Englisch,
// dieselben Bausteine in derselben Reihenfolge, dieselben Anker (ids bleiben
// deutsch), dieselben Quellen-Adressen. „Firmenkarte" heißt „business credit
// card", die persönliche Haftung „personal guarantee", die Haftung einer
// Muttergesellschaft “liability of the parent company”. FIAON ist keine Bank,
// vergibt und vermittelt keine Kredite; über jeden Kredit entscheidet das Institut.
//
// E-510 (13.11.2026, language guide, building block “knowledge article” 7.4): one
// section per page, “What FIAON Global handles”, with “your part” and “who decides”;
// the fixed sentences (step 5 “Financing”, S1, S7, S9) come verbatim from
// shared/fiaon-global-saetze.ts. Never here: an account that WE open (the client
// submits the application, the institution decides), a name for the sequence of card
// applications, a commitment, speed as an argument. The refund sentence (S7) appears
// on the “financing routes” page only — it relates to financing within the chosen
// funding target, not to property loans, accounts or cards.
// ═══════════════════════════════════════════════════════════════════════════
import { GLOBAL_KAPITAL_FREI, GLOBAL_PFLICHTHINWEIS } from "../../fiaon-global";
import { SCHRITTE_KOPF, SECHS_SCHRITTE, satz } from "../../fiaon-global-saetze";
import { EIN_PRODUKT } from "../ein-produkt";
import { QUELLEN_WISSEN_EN as Q } from "../fakten-en";
import type { GlobalQuelle, GlobalSeite } from "../typen";

/** Date of first publication (E-416). */
const ERSCHIENEN = "2026-10-20";
/** Date of the last change in substance (E-510, language guide). */
const S = "2026-11-13";
const P = EIN_PRODUKT.en;
/** Step 5 of the fixed narrative (language guide 2.3, the version in force today) — verbatim from the one source. */
const FINANZIERUNG = SECHS_SCHRITTE.en.find((x) => x.nr === 5)!;
/** The names of the fixed parts of a step: “Your part”, “Condition” (language guide 2.1). */
const TEIL = SCHRITTE_KOPF.en.teile;
/** Heading of the one section about us (language guide 7.4). */
const FIAON_H2 = "What FIAON Global handles";
/** The decision sentence from S2: “Each institution makes its own decision on accounts, cards and limits.” */
const INSTITUT = satz("S2", "en").split(/(?<=\.)\s+/)[1];
/** The first two sentences of the role (S8): neither a bank nor a law firm; does not lend and does not broker loans. */
const ROLLE = satz("S8", "en").split(/(?<=\.)\s+/).slice(0, 2).join(" ");
const KAPITAL_FREI = `${GLOBAL_KAPITAL_FREI.en.satz} ${GLOBAL_KAPITAL_FREI.en.steuer}`;

const QF: Record<string, GlobalQuelle> = {
  ps1583: { titel: "USPS — PS Form 1583, Application for Delivery of Mail Through Agent", url: "https://about.usps.com/forms/ps1583.pdf" },
  dmm508: { titel: "USPS — Domestic Mail Manual 508, Commercial Mail Receiving Agencies", url: "https://pe.usps.com/text/dmm300/508.htm" },
  logingovTelefon: { titel: "Login.gov — Verifying your identity with a phone number", url: "https://login.gov/help/verify-your-identity/phone-number" },
  usc1014: { titel: "18 U.S. Code § 1014 — False statements in loan and credit applications", url: "https://www.law.cornell.edu/uscode/text/18/1014" },
  firpta: { titel: "IRS — FIRPTA Withholding", url: "https://www.irs.gov/individuals/international-taxpayers/firpta-withholding" },
  dscrHandbuch: { titel: "Market overview of foreign national financing 2026 (a broker's handbook)", url: "https://www.americamortgages.com/2026-foreign-national-mortgage-handbook/" },
  dscrProgramm: { titel: "Foreign national DSCR programme description (lender, 2026)", url: "https://admortgage.com/programs/foreign-nationals/" },
  dscrZinsen: { titel: "DSCR rates for foreign investors (market observation, August 2026)", url: "https://homeabroadinc.com/mortgages/dscr-loan-interest-rates/" },
  sbaKredite: { titel: "U.S. Small Business Administration — Loans", url: "https://www.sba.gov/funding-programs/loans" },
  sbaRegel2026: { titel: "U.S. GAO, B-338157 — SBA citizenship and residency requirements for 7(a) and 504 loans (Notices 5000-876441, 5000-876626)", url: "https://www.gao.gov/products/b-338157" },
};

export const WISSEN_FINANZIERUNG_EN: GlobalSeite[] = [
  // ─────────────────────────────────────────────────────────────────────────
  // 17 · US ADDRESS AND PHONE
  {
    pfad: "/en/business/knowledge/us-address-and-phone",
    sprache: "en",
    schwester: "/business/wissen/us-adresse-und-telefon",
    art: "wissen",
    seo: {
      titel: "US address and phone for the bank — FIAON Global",
      beschreibung: "How US institutions check your address and phone number: residential address, mailing address, mail receiving agency (CMRA). With sources.",
    },
    stand: S,
    erschienen: ERSCHIENEN,
    kennung: "FG · 40",
    auge: "Knowledge · US presence",
    h1: "US address and phone.",
    h1b: "The institution checks both.",
    lead: "US institutions match an applicant's US address and phone number against postal data and mobile carrier data. Common causes of declined applications and account freezes are a mail receiving agency used as the address, a phone number not in the applicant's name, and changing details. This article explains what institutions check and the sequence in which to proceed.",
    ziffern: [
      { wert: "3 types", label: "residential, mailing, agent address" },
      { wert: "1 address", label: "the same in every application" },
    ],
    blick: [
      ["Residential address", "Where you actually live; personal card applications ask for it"],
      ["Mailing address", "Where your post arrives; stated as a mailing address"],
      ["Agent address", "Belongs to the company and appears on the state register"],
      ["Mail receiving agency", "Flagged as a CMRA in postal data; needs PS Form 1583"],
      ["Phone", "Mobile number on a contract, in your name"],
      ["Who decides", "The institution concerned, on each application"],
      ["With FIAON Global", "We check the US address before the first application"],
    ],
    kurz: "US institutions match your US address and phone number against postal data and mobile carrier data. A commercial mail receiving agency (CMRA) is flagged in postal data, and a business address shows as commercial. A suitable phone number is a mobile number on a contract in your name, with the same address as at the institution. Keeping one address in every application avoids a common cause of account freezes. The institution decides on each application.",
    bloecke: [
      {
        typ: "text", id: "arten", h2: "Three kinds of address",
        absaetze: [
          "Your residential address is where you actually live. Personal credit card applications almost always ask for it. If you live in Europe, you state your European residential address there, truthfully.",
          "Your mailing address is where your post arrives. Many institutions accept a different mailing address if you state it as a mailing address. The registered agent's address belongs to the company. The registered agent receives the company's official post in its state; the agent's address appears on the state register. It is not an address for you personally.",
          "A service that accepts post for others on a commercial basis is, under US postal rules, a commercial mail receiving agency (CMRA). It needs a notarised PS Form 1583 from every customer.",
        ],
      },
      {
        typ: "tabelle", id: "pruefung", h2: "What institutions see in an address",
        lead: "Banks and card issuers check addresses with address data built on the US postal database. Three attributes determine how an address is classified.",
        kopf: ["Attribute", "What it means", "Effect on the application"],
        zeilen: [
          ["CMRA", "the address is a commercial mail receiving agency", "treated as a mailbox address; institutions often decline it or examine it separately"],
          ["Residential or commercial", "the post office delivers there to households or to businesses", "a commercial address does not count as a residential address"],
          ["Deliverability", "the address exists exactly as written, with number and unit", "an incomplete address cannot be matched to a credit file"],
        ],
        fuss: ["Many virtual offices and mailbox services are flagged as a CMRA in postal data, even when the address includes a suite number."],
      },
      {
        typ: "text", id: "telefon", h2: "The phone number in mobile carrier data",
        absaetze: [
          "To verify your identity, many institutions match your phone number against the mobile carrier's records. Those records show the account holder's name and address, the age of the number and the type of line. The type is a contract, a prepaid card or an internet number.",
          "Institutions often decline internet numbers (VoIP). Prepaid numbers often cannot be matched to a name. A reliable choice is a mobile number on a contract in your name, with the same address as at the institution. The longer you keep the number, the more it counts as an identity signal.",
        ],
      },
      {
        typ: "etappen", id: "reihenfolge", h2: "The sequence in five steps",
        etappen: [
          { titel: "Choose and check the address", text: "Before the first application, you establish three attributes: residential or commercial, CMRA or not, fully deliverable." },
          { titel: "Set up the phone number", text: "You take out a mobile contract in your name. You register the chosen address with the mobile carrier." },
          { titel: "Write it the same everywhere", text: "Your name appears as in your passport. The address is identical, character for character, in every application." },
          { titel: "Keep the address", text: "Every change spreads your file across several addresses. With one address over years, the file stays complete." },
          { titel: "Receive and read your post", text: "Card letters, credit reports and official post arrive by post. A service that scans and forwards each item makes it readable in Europe." },
        ],
      },
      {
        typ: "karten", id: "irrwege", h2: "Three errors with addresses and documents", spalten: 3,
        karten: [
          { tag: "Error", titel: "Changing addresses", text: "Four addresses in two years split the file. The credit bureau can then no longer match payments reliably." },
          { tag: "Error", titel: "Edited documents", text: "An invoice that differs from the original is grounds for refusal at any institution. Submitting it can be a criminal offence. Only originals count." },
          { tag: "Error", titel: "A false residence", text: "Presenting a mailing address as your home is a false statement in a US credit application. Stated as a mailing address, the same address is not a false statement." },
        ],
      },
      {
        typ: "text", id: "fiaon", h2: FIAON_H2,
        absaetze: [
          "Before each application, we check the US address against postal data for three attributes: CMRA, residential or commercial, deliverability. We record your name, address and phone number on your file so that they match in every application. The registered agent, US business address and US telephone number of your company are included in the first year of your engagement.",
        ],
        punkte: [
          `${TEIL.ihrTeil}: You choose the address and submit each application yourself.`,
          `${TEIL.bedingung}: Whether an address is accepted is for the institution concerned to decide.`,
        ],
      },
      { typ: "paket", id: "mandat", h2: "The US presence in your engagement", lead: P.karteLead, paket: "global_banking" },
      {
        typ: "hinweis", id: "wissen", h2: "What you need to know",
        punkte: [
          "You give your residential address truthfully in every application. You declare a mailing address as a mailing address.",
          "The registered agent's address is meant for the company's official post. It is not an address for you personally.",
          GLOBAL_PFLICHTHINWEIS.en[2],
        ],
      },
    ],
    fragen: [
      { f: "Can I give my registered agent's address to the bank?", a: "The registered agent's address appears on the register for the company. It is not an address for you personally. Many institutions decline it for account and card applications." },
      { f: "What is a CMRA?", a: "A CMRA (commercial mail receiving agency) is a service that accepts post for others on a commercial basis. It needs PS Form 1583 from every customer. In postal data it is flagged as a CMRA." },
      { f: "Why is my US phone number not accepted?", a: "Common reasons are an internet number (VoIP), a prepaid number with no name attached, or an address that differs from the details you gave the institution. A mobile number on a contract in your name usually resolves this. The institution decides." },
      { f: "May I give a US mailing address although I live in Europe?", a: "Many institutions allow this if you state it as a mailing address and give your residential address truthfully. Presenting a mailing address as your home is a false statement." },
    ],
    paket: "global_banking",
    weiter: ["/en/business/knowledge/registered-agent-address", "/en/business/knowledge/us-bank-account-documents", "/en/business/knowledge/building-us-credit", "/en/business/knowledge/us-business-credit-card"],
    quellen: [QF.ps1583, QF.dmm508, QF.logingovTelefon, Q.cip, QF.usc1014],
  },

  // ─────────────────────────────────────────────────────────────────────────
  // 18 · FINANCING A US PROPERTY
  {
    pfad: "/en/business/knowledge/financing-us-property",
    sprache: "en",
    schwester: "/business/wissen/us-immobilie-finanzieren",
    art: "wissen",
    seo: {
      titel: "Financing a US property as a foreigner — FIAON Global",
      beschreibung: "How foreigners finance a US property: rent coverage, equity, reserves, source of funds, closing by power of attorney, FIRPTA. With sources.",
    },
    stand: S,
    erschienen: ERSCHIENEN,
    kennung: "FG · 41",
    auge: "Knowledge · Property in the US",
    h1: "Financing a US property.",
    h1b: "The rent covers the instalment.",
    lead: "Anyone financing a US property as a foreigner in order to let it usually relies on a particular kind of property financing. The lender mainly checks whether the rent covers the instalment, and less your income or a US credit history. This article explains how that financing is structured, the usual equity and what to settle before the purchase.",
    ziffern: [
      { wert: "1.0", label: "rent coverage: rent covers the instalment" },
      { wert: "20 – 35%", label: "equity according to 2026 market data" },
    ],
    blick: [
      ["What counts", "The property's rental income (DSCR)"],
      ["Buyer", "Usually a US LLC, with a personal guarantee from the owner"],
      ["Equity", "20 to 35 per cent, depending on credit and property"],
      ["Reserves", "Several monthly instalments, often also in accounts abroad"],
      ["Closing", "Often by notarised power of attorney or remote online notary"],
      ["Sale", "The buyer withholds part of the sale price for US tax (FIRPTA)"],
      ["Who decides", "The lender, on the loan, its amount and its rate"],
      ["With FIAON Global", "We form the company and compile its documents"],
    ],
    kurz: "Foreigners usually finance a US property for letting with rent-coverage financing (DSCR): the lender checks whether the rent covers the instalment. According to 2026 market data, it expects around 20 to 35 per cent equity from your own, documented funds, plus reserves of several monthly instalments. The buyer is usually a US LLC, with a personal guarantee from the owner. On a later sale, the buyer withholds part of the sale price for US tax. The lender decides on the loan.",
    bloecke: [
      {
        typ: "text", id: "dscr", h2: "Rent coverage instead of income",
        absaetze: [
          "The usual financing for investors from abroad is called a DSCR loan (debt service coverage ratio). The lender divides the expected rent by the monthly cost. That cost comprises interest and repayment, plus taxes and insurance. If the result is 1.0 or higher, the rent covers the instalment.",
          "Lenders usually do not ask for proof of income from Europe, and often not for a US credit history either. Some programmes ask for a credit report from abroad or a bank reference letter. An existing US score can improve the terms.",
        ],
      },
      {
        typ: "tabelle", id: "eckwerte", h2: "Market data 2026",
        lead: "The figures come from programme descriptions and market overviews of lenders and brokers, as at October 2026. Each lender sets its own conditions.",
        kopf: ["Attribute", "Usual range"],
        zeilen: [
          ["Equity on purchase", "20 – 35% of the purchase price"],
          ["Interest", "set by the lender alone — depending on the property, equity and rent coverage"],
          ["Rent coverage (DSCR)", "usually at least 1.0"],
          ["Reserves", "6 – 12 monthly instalments, often allowed abroad"],
          ["Source of the deposit", "own account, 60 – 90 days beforehand, documented"],
          ["Loan size", "approx. US$100,000 – US$5 million"],
          ["Duration", "21 – 45 days from complete application"],
        ],
        fuss: ["Market data, not a commitment. The lender alone decides on the loan, its amount and its rate."],
      },
      {
        typ: "etappen", id: "weg", h2: "The process in six steps",
        etappen: [
          { titel: "Company", text: "A US LLC with an EIN, the company's tax identification number, holds the property. As owner, you give a personal guarantee for the loan." },
          { titel: "Document the equity", text: "Deposit, closing costs and reserves are held verifiably in your own accounts. Lenders usually decline third-party loans as the deposit." },
          { titel: "Property and rent appraisal", text: "The appraiser estimates value and market rent. This gives the rent coverage." },
          { titel: "The lender's decision", text: "The lender checks the documents, the property and the source of funds. It then decides on the loan." },
          { titel: "Closing", text: "The closing often takes place by notarised power of attorney or remote online notary. Payment runs through the title company's escrow account." },
          { titel: "Management", text: "A local property manager lets and looks after the property. The rent goes to the company's account." },
        ],
      },
      {
        typ: "karten", id: "varianten", h2: "Three kinds of property financing", spalten: 3,
        karten: [
          { tag: "Long term", titel: "Holding a rental", text: "A DSCR loan with a long term, often thirty years. The rent covers the instalment. This is the usual form for investors from abroad." },
          { tag: "Short term", titel: "Purchase and renovation", text: "Short-term property loans (hard money) finance purchase and renovation. They cost considerably more than a long-term property loan, and fees are added. They are intended for projects whose repayment is settled from the outset." },
          { tag: "Negotiated", titel: "Seller financing", text: "The seller defers part of the purchase price. The parties negotiate the terms freely. The contract is a matter for a US lawyer." },
        ],
      },
      {
        typ: "text", id: "eigenkapital", h2: "Source of the equity",
        absaetze: [
          "Lenders require evidence that the deposit and reserves are yours and have been in your account for some time. You may also raise the funds for them in your country of residence, for example by borrowing against a property you own. You use them as your own funds once they are in your account and their source is documented. Clarify in writing beforehand whether a lender accepts equity raised this way. You state the source in the application.",
          KAPITAL_FREI,
        ],
      },
      {
        typ: "text", id: "fiaon", h2: FIAON_H2,
        absaetze: [
          "We form the company that holds the property and apply for its EIN. We prepare the account application in full and compile the documents lenders require. Tax questions on structure, rental income and sale rest with partner tax advisers acting in their own professional capacity. They are to be settled before the purchase.",
        ],
        punkte: [
          `${TEIL.ihrTeil}: You submit the account application and the loan application yourself; your company enters into the loan agreement in its own name.`,
          `${TEIL.bedingung}: ${ROLLE} The decision on property financing rests with the lender.`,
        ],
      },
      { typ: "paket", id: "mandat", h2: "The company for your property", lead: P.karteLead, paket: "global_kapital" },
      {
        typ: "hinweis", id: "wissen", h2: "What you need to know",
        punkte: [
          "On a sale, the buyer generally withholds 15 per cent of the sale price for US tax under FIRPTA. For owner-occupied property priced at US$1 million or less, it is in some cases less. You reclaim any excess withheld through the US tax return.",
          "If an individual holds the property directly, US estate tax may apply. The tax aspects of the structure need to be clarified before the purchase.",
          "Market figures are not a commitment. The lender alone decides on the loan, its amount and its rate.",
          GLOBAL_PFLICHTHINWEIS.en[0],
        ],
      },
    ],
    fragen: [
      { f: "Do I need US credit for a US property loan?", a: "For rent-coverage financing (DSCR), often not. The lender mainly checks whether the rent covers the instalment. A US score can improve the terms." },
      { f: "How much equity do I need?", a: "According to 2026 market data, usually 20 to 35 per cent of the purchase price, plus closing costs and reserves of several monthly instalments. The lender sets the amount." },
      { f: "Can I finance the deposit?", a: "Lenders usually decline third-party loans as the deposit. They expect your own funds, verifiably held in your account. You state their source in the application." },
      { f: "Do I have to travel to the US for the closing?", a: "Often not. Many closings run through a notarised power of attorney or a remote online notary. Payment goes to the title company's escrow account." },
      { f: "What happens when I sell?", a: "Under FIRPTA, the buyer withholds part of the sale price for US tax and pays it to the US tax authority, the IRS. The final tax follows from the US tax return." },
    ],
    paket: "global_kapital",
    weiter: ["/en/business/knowledge/us-financing-routes", "/en/business/knowledge/form-a-us-llc", "/en/business/knowledge/us-llc-tax", "/en/business/knowledge/choosing-a-state"],
    quellen: [QF.dscrHandbuch, QF.dscrProgramm, QF.firpta],
  },

  // ─────────────────────────────────────────────────────────────────────────
  // 19 · US FINANCING ROUTES
  {
    pfad: "/en/business/knowledge/us-financing-routes",
    sprache: "en",
    schwester: "/business/wissen/finanzierungswege-usa",
    art: "wissen",
    seo: {
      titel: "Financing routes for a US company — FIAON Global",
      beschreibung: "Six financing routes for a US company, from the card to property financing, set out by basis and time frame. With sources and date.",
    },
    stand: S,
    erschienen: ERSCHIENEN,
    kennung: "FG · 42",
    auge: "Knowledge · Financing",
    h1: "Financing routes in the US.",
    h1b: "By basis and time frame.",
    lead: "A US company has six financing routes open to it in the US. Each rests on a different basis: on you personally, on the account balance, on revenue or on collateral. Some routes come into consideration after days, others only after years. This article sets them out by basis and time frame, so that you can plan the sequence.",
    ziffern: [
      { wert: "6 routes", label: "from the card to property financing" },
      { wert: "1 rule", label: "the institution decides on every loan" },
    ],
    blick: [
      ["Early and small", "Personal cards, supplier accounts"],
      ["By balance", "Business credit cards whose limit follows the account balance"],
      ["By revenue", "Loans from payment platforms"],
      ["By years in business", "A bank credit line, usually after two years"],
      ["Against collateral", "Deposit, liability of the parent company, property"],
      ["Who decides", "The institution concerned, on each application"],
      ["With FIAON Global", "Applications and documents prepared in full"],
    ],
    kurz: "A US company has six financing routes: personal cards, supplier accounts with payment terms, balance-based business credit cards, revenue-based platform loans, a bank credit line and financing against collateral. Cards and supplier accounts cover running expenses. Larger amounts require revenue, years in business or collateral, such as a deposit, liability assumed by the parent company or a property. The institution decides on every loan.",
    bloecke: [
      {
        typ: "tabelle", id: "uebersicht", h2: "The six routes at a glance",
        kopf: ["Route", "Basis", "Usual time frame", "Size"],
        zeilen: [
          ["Personal cards", "your personal credit file, held under your tax identification number (ITIN) or Social Security number (SSN)", "days after the card issuer's decision", "small; rises with your payment record"],
          ["Supplier accounts (Net 30)", "company credit file, D-U-N-S number", "weeks", "small to medium"],
          ["Balance-based business credit cards", "the company's account balance", "days", "follows the balance"],
          ["Revenue-based platform loans", "revenue through a payment platform", "days", "follows the revenue"],
          ["Bank credit line", "years in business, revenue or collateral", "weeks", "medium to large"],
          ["Financing against collateral", "deposit, liability of the parent company, property", "weeks", "large"],
        ],
        fuss: ["Overview based on market observation, as at October 2026. Each institution sets its own conditions, amount and rate."],
      },
      {
        typ: "etappen", id: "reihenfolge", h2: "The sequence in six steps",
        etappen: [
          { titel: "Company and account", text: "The starting point is the LLC, its tax identification number (EIN) and the business account. Business credit cards and payment platforms require an account." },
          { titel: "Core data and D-U-N-S", text: "Name, address and phone number are the same in every document. The business credit bureau assigns the company its identifier, the D-U-N-S number." },
          { titel: "Supplier accounts", text: "The company uses its first accounts with payment terms and pays before the due date. These payments form its business credit record." },
          { titel: "Business credit cards", text: "The first cards to consider are those whose limit follows the balance. Cards with a personal guarantee from the owner follow later. Each card issuer makes its own decision." },
          { titel: "Evidence of revenue", text: "US revenue is the requirement for platform loans. It is also the basis of every decision by a bank." },
          { titel: "Bank and collateral", text: "Three routes come into consideration for large amounts: the bank credit line, liability assumed by the parent company and property financing." },
        ],
      },
      {
        typ: "text", id: "grenzen", h2: "Limits of the financing routes",
        absaetze: [
          "Since 1 March 2026, government-backed small business loans from the US agency SBA (the 7(a) and 504 programmes) have been open to certain companies only. All owners must be US citizens or US nationals with their principal residence in the United States. Green card holders are excluded as well. Some online lenders lend only to owners resident in the US.",
          "Many card applications in a short period are not a route to large amounts that is supported by evidence. The US Federal Trade Commission (FTC) took action against a provider that held out financing to business owners and applied for credit cards instead. That provider has been permanently banned from the financing business since 2025.",
        ],
      },
      {
        typ: "text", id: "kapital", h2: "Use of the funds",
        absaetze: [
          KAPITAL_FREI,
          "Short-term funds at high cost make economic sense only if the return demonstrably exceeds the cost. For long-term routes, orderly company figures count. Each institution sets its own terms.",
        ],
      },
      {
        typ: "text", id: "fiaon", h2: FIAON_H2,
        absaetze: [
          "We form your company, keep its core data consistent and compile its documents in full. We prepare account and card applications in full; you submit them yourself.",
          `${FINANZIERUNG.satz} ${satz("S9", "en")}`,
        ],
        punkte: [
          `${TEIL.bedingung}: ${INSTITUT} ${ROLLE}`,
          P.geldZurueck,
        ],
      },
      { typ: "paket", id: "mandat", h2: P.karteH2, lead: P.karteLead, paket: "global_kapital" },
      {
        typ: "hinweis", id: "wissen", h2: "What you need to know",
        punkte: [
          GLOBAL_PFLICHTHINWEIS.en[2],
          "No provider can promise a particular limit or rate.",
          GLOBAL_PFLICHTHINWEIS.en[1],
        ],
      },
    ],
    fragen: [
      { f: "Which financing is open to a new US company first?", a: "The first to consider are business credit cards whose limit follows the balance, and supplier accounts with payment terms. Bank credit lines usually require years in business, revenue or collateral. The institution decides on every application." },
      { f: "Can an LLC from Europe get an SBA loan?", a: "No. Since 1 March 2026, every direct and indirect owner must be a US citizen or US national with a principal residence in the United States (SBA Procedural Notice 5000-876626). A green card is not enough." },
      { f: "Can a parent company in Europe accept liability for the US company's loan?", a: "Yes, this is a common route to a bank credit line. The bank then mainly assesses the parent company's balance sheet and decides on the application." },
      { f: "Does FIAON arrange the loan for my US company?", a: `No. ${ROLLE} We prepare the applications in full and support your company through to the decision. Your company submits the application; the lender decides.` },
    ],
    paket: "global_kapital",
    weiter: ["/en/business/knowledge/us-business-credit", "/en/business/knowledge/us-business-credit-card", "/en/business/knowledge/us-funding-for-foreign-owned-companies", "/en/business/us-business-credit-cards"],
    quellen: [Q.duns, Q.paydex, QF.sbaKredite, QF.sbaRegel2026, Q.ftcSeek],
  },
];
