// ═══════════════════════════════════════════════════════════════════════════
// FIAON GLOBAL — WISSEN AUF ENGLISCH: ANSCHRIFT UND TELEFON, US-IMMOBILIE,
// FINANZIERUNGSWEGE (20.10.2026, E-416)
//
// Die englischen Schwestern von ../wissen-finanzierung.ts. Britisches Englisch,
// dieselben Bausteine in derselben Reihenfolge, dieselben Anker (ids bleiben
// deutsch), dieselben Quellen-Adressen. „Firmenkarte" heißt „business credit
// card", die persönliche Haftung „personal guarantee". FIAON ist keine Bank,
// vergibt und vermittelt keine Kredite; über jeden Kredit entscheidet das Institut.
// ═══════════════════════════════════════════════════════════════════════════
import { GLOBAL_KAPITAL_FREI, GLOBAL_PFLICHTHINWEIS } from "../../fiaon-global";
import { QUELLEN_WISSEN_EN as Q } from "../fakten-en";
import type { GlobalQuelle, GlobalSeite } from "../typen";

const S = "2026-10-20";
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
  sbaRegel2026: { titel: "SBA Procedural Notice 5000-876626 — ownership, citizenship and residency for 7(a) and 504 loans (effective 1 March 2026)", url: "https://www.naggl.org/wp-content/uploads/2026/05/5000-876626.pdf" },
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
      beschreibung: "Residential, mailing or mail receiving agency: how US banks check your address and phone number, and why both must match everywhere.",
    },
    stand: S,
    erschienen: S,
    kennung: "FG · 40",
    auge: "Knowledge · US presence",
    h1: "Address and phone.",
    h1b: "The bank checks both.",
    lead: "Many account freezes and declined applications in the US have a quiet cause: the address is a mail receiving agency, the phone number is not in the applicant's name, or the details change from one application to the next. Here is what institutions check about your address and phone number, and how to get both right from day one.",
    ziffern: [
      { wert: "3 types", label: "residential, mailing, agent address" },
      { wert: "1 address", label: "the same in every application" },
    ],
    blick: [
      ["Residential address", "Where you live — expected for personal cards"],
      ["Mailing address", "Where your post arrives — state it openly as such"],
      ["Agent address", "For the company on the register, not for you personally"],
      ["Mail receiving agency", "Flagged as a CMRA in postal data, needs PS Form 1583"],
      ["Phone", "A genuine mobile number in your name, not an internet number"],
      ["With FIAON Global", "Every address is checked before the first application"],
    ],
    kurz: "US institutions match your address and phone number against postal data and mobile carrier data. A commercial mail receiving agency (CMRA) is flagged in postal data, and business addresses show as commercial, not residential. Your phone number should be a genuine mobile number in your name, with the same address as at the bank. Choosing one address and keeping it avoids the most common quiet cause of account freezes.",
    bloecke: [
      {
        typ: "text", id: "arten", h2: "Three kinds of address",
        absaetze: [
          "Your residential address is where you actually live. Personal credit card applications almost always ask for it. If you live in Germany, Austria or Switzerland, you state your European residential address there, truthfully.",
          "Your mailing address is where your post arrives. Many institutions accept a different mailing address if it is openly stated as such. The registered agent's address, finally, belongs to the company: it is on the state register and receives official post; it is not an address for you personally.",
          "Any service that accepts post for others on a commercial basis is, under US postal rules, a commercial mail receiving agency (CMRA). It needs a notarised PS Form 1583 from every customer.",
        ],
      },
      {
        typ: "tabelle", id: "pruefung", h2: "What institutions see in an address",
        lead: "Banks and card issuers check addresses with address data built on the US postal database. Three attributes are decisive.",
        kopf: ["Attribute", "What it means", "Effect on the application"],
        zeilen: [
          ["CMRA", "the address is a commercial mail receiving agency", "treated as a mailbox address, often declined or reviewed"],
          ["Residential or commercial", "the post office delivers there to households or to businesses", "a commercial address is not a residential address"],
          ["Deliverability", "the address exists exactly as written, with number and unit", "an incomplete address matches no credit file"],
        ],
        fuss: ["Many virtual offices and mailbox services are flagged as a CMRA in postal data, even when the address carries a suite number."],
      },
      {
        typ: "text", id: "telefon", h2: "The phone number: properly registered",
        absaetze: [
          "To verify your identity, many institutions match your phone number against the mobile carrier's records: is the number in your name, does the address match, how long has the number existed, is it a contract, a prepaid card or an internet number?",
          "Internet numbers (VoIP) are often rejected, and prepaid numbers often cannot be matched to a name. The most reliable choice is a genuine mobile number on a contract in your name, with exactly the same address as at the bank. The longer you keep the number, the stronger it becomes as an identity signal.",
        ],
      },
      {
        typ: "etappen", id: "reihenfolge", h2: "The order that gets it right",
        etappen: [
          { titel: "Choose and check the address", text: "Before the first application, establish: residential or commercial, CMRA or not, fully deliverable." },
          { titel: "Set up the phone number", text: "A mobile contract in your name, with exactly the chosen address on the account." },
          { titel: "Write it the same everywhere", text: "Name as in your passport, address identical character for character in every application." },
          { titel: "Keep it", text: "Every change spreads your file across several addresses. One address over years carries the most weight." },
          { titel: "Make your post readable", text: "Card letters, credit reports and official post arrive by mail. A service that scans and forwards keeps you reachable from Europe." },
        ],
      },
      {
        typ: "karten", id: "irrwege", h2: "What does not help", spalten: 3,
        karten: [
          { tag: "Dead end", titel: "Changing addresses", text: "Four addresses in two years fragment the file. The credit bureau can then no longer match payments reliably." },
          { tag: "Dead end", titel: "Edited documents", text: "An invoice that differs from the original is grounds for refusal at any institution and can be a criminal offence. Only originals count." },
          { tag: "Dead end", titel: "A false residence", text: "Presenting a mailing address as your home is a false statement in a US credit application. Stated openly, the same address is unproblematic." },
        ],
      },
      {
        typ: "text", id: "fiaon", h2: "How FIAON Global keeps your address and phone clean",
        absaetze: [
          "Before any application goes out, we check every US address against postal data: CMRA or not, residential or commercial, fully deliverable. We make sure your name, address and phone number are identical in every application and keep them on your file, so nobody writes them differently later.",
          "You choose the address. We tell you openly how an institution will see it.",
        ],
      },
      { typ: "paket", id: "paket", h2: "US presence in the package", lead: "Registered agent, US business address and US phone number for the first year, plus prepared account and card applications — Global Banking.", paket: "global_banking" },
      {
        typ: "hinweis", id: "wissen", h2: "What you need to know",
        punkte: [
          "Whether an institution accepts an address is solely the institution's decision.",
          "The registered agent's address is meant for the company's official post, not as your personal address.",
          GLOBAL_PFLICHTHINWEIS.en[2],
        ],
      },
    ],
    fragen: [
      { f: "Can I give my registered agent's address to the bank?", a: "It is on the register for the company. It is not meant as your personal address, and many institutions decline it for account and card applications." },
      { f: "What is a CMRA?", a: "A commercial mail receiving agency, a service that accepts post for others on a commercial basis. It needs PS Form 1583 from every customer and is flagged as such in postal data." },
      { f: "Why is my US phone number not accepted?", a: "Often it is an internet number (VoIP), a prepaid number with no name attached, or a number whose address does not match your bank details. A mobile number on a contract in your name usually solves this." },
      { f: "May I give a US mailing address although I live in Europe?", a: "Yes, if you state it openly as a mailing address and give your residential address truthfully. Presenting a mailing address as your home is a false statement." },
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
      beschreibung: "How foreigners finance a US property: rent coverage instead of income, equity, reserves, source of funds, closing from abroad, FIRPTA.",
    },
    stand: S,
    erschienen: S,
    kennung: "FG · 41",
    auge: "Knowledge · Property in the US",
    h1: "Financing a US property.",
    h1b: "The rent carries the loan.",
    lead: "For foreign investors, the US has its own kind of property financing: the lender mainly checks whether the rent covers the instalment, not your income or a US credit history. Here is how it works, what equity the market expects and what you need to know before you buy.",
    ziffern: [
      { wert: "1.0", label: "rent coverage: rent covers the instalment" },
      { wert: "20 – 35%", label: "equity according to 2026 market data" },
      { wert: "21 – 45 days", label: "from complete application to funding" },
    ],
    blick: [
      ["What counts", "The property's rental income (DSCR)"],
      ["Who buys", "Usually a US LLC, with a personal guarantee from the owner"],
      ["Equity", "20 to 35 percent, depending on credit and property"],
      ["Reserves", "Several monthly instalments, often also in accounts abroad"],
      ["Closing", "Often by notarised power of attorney or remote online notary"],
      ["Sale", "The buyer withholds part of the price for US tax (FIRPTA)"],
      ["With FIAON Global", "Company, documents and sequence prepared"],
    ],
    kurz: "Foreigners usually finance US rental properties with rent-coverage financing (DSCR): the lender checks whether the rent covers the instalment and, according to 2026 market data, asks for around 20 to 35 percent equity plus reserves of several monthly instalments. The buyer is usually a US LLC, with a personal guarantee from the owner. The equity must come from your own, documented funds. When you sell later, the buyer withholds part of the price for US tax.",
    bloecke: [
      {
        typ: "text", id: "dscr", h2: "Rent coverage instead of income",
        absaetze: [
          "The common financing for foreign investors is called a DSCR loan (debt service coverage ratio). The lender divides the expected rent by the monthly cost of interest, repayment, taxes and insurance. If the result is 1.0 or higher, the rent covers the instalment.",
          "Proof of income from Europe is usually not needed, and often a US credit history is not either. Some programmes ask for a foreign credit report or a bank reference letter. An existing US score can improve the terms.",
        ],
      },
      {
        typ: "tabelle", id: "eckwerte", h2: "The 2026 market picture",
        lead: "Figures from programme descriptions and market overviews of lenders and brokers, as of October 2026. Each lender sets its own conditions.",
        kopf: ["Attribute", "Usual range"],
        zeilen: [
          ["Equity on purchase", "20 – 35% of the price"],
          ["Interest, 30-year fixed", "approx. 6.9 – 9.5% p.a."],
          ["Rent coverage (DSCR)", "usually at least 1.0"],
          ["Reserves", "6 – 12 monthly instalments, often allowed abroad"],
          ["Source of the deposit", "own account, 60 – 90 days beforehand, documented"],
          ["Loan size", "approx. $100,000 – $5 million"],
          ["Duration", "21 – 45 days from complete application"],
        ],
        fuss: ["Market data, not a commitment. The lender alone decides on the loan, its amount and its rate."],
      },
      {
        typ: "etappen", id: "weg", h2: "The route to the property, from abroad",
        etappen: [
          { titel: "Company", text: "A US LLC with an EIN holds the property; as owner you give a personal guarantee for the loan." },
          { titel: "Document the equity", text: "Deposit, closing costs and reserves sit verifiably in your own accounts. Lenders usually decline third-party loans as the deposit." },
          { titel: "Property and rent appraisal", text: "The appraiser estimates value and market rent; this gives the rent coverage." },
          { titel: "Loan approval", text: "The lender checks the documents, the property and the source of funds." },
          { titel: "Closing", text: "Often by notarised power of attorney or remote online notary; the money runs through the title company's escrow account." },
          { titel: "Management", text: "A local property manager lets and looks after the property; the rent flows to the company's account." },
        ],
      },
      {
        typ: "karten", id: "varianten", h2: "Three kinds of property financing", spalten: 3,
        karten: [
          { tag: "Long term", titel: "Holding a rental", text: "A DSCR loan with a long term, often thirty years; the rent carries the instalment. The usual route for investors from abroad." },
          { tag: "Short term", titel: "Buy and renovate", text: "Short-term property loans (hard money) for purchase and renovation, according to market data approx. 8 to 15 percent interest plus fees. Expensive, meant for a clear exit." },
          { tag: "Negotiated", titel: "Seller financing", text: "The seller defers part of the price. Terms are freely negotiated; the contract belongs in the hands of a US lawyer." },
        ],
      },
      {
        typ: "text", id: "eigenkapital", h2: "Where the equity comes from",
        absaetze: [
          "Lenders want to see that the deposit and reserves are yours and have been in your account for some time. If you raise equity at home, for example by borrowing against a property you own, you use it as your own funds once it is in your own account and its source is documented. Clarify in writing beforehand whether a lender accepts equity raised this way, and disclose it openly.",
          KAPITAL_FREI,
        ],
      },
      {
        typ: "text", id: "fiaon", h2: "How FIAON Global prepares the purchase",
        absaetze: [
          "We form the company that holds the property, apply for the EIN, open the account and put together the documents lenders want to see. Our partner tax adviser clarifies the tax questions on structure, rental income and sale with you before the purchase.",
          "FIAON is not a bank and neither grants nor brokers loans. The lender decides on every financing.",
        ],
      },
      { typ: "paket", id: "paket", h2: "The company for your property", lead: "Company, tax numbers, account and the documents prepared for lenders — Global Capital.", paket: "global_kapital" },
      {
        typ: "hinweis", id: "wissen", h2: "What you need to know",
        punkte: [
          "On a sale, the buyer generally withholds 15 percent of the price for US tax under FIRPTA, in some cases less for owner-occupied property priced at $1 million or less. Any excess withheld is recovered through the tax return.",
          "If an individual holds the property directly, US estate tax may apply; the partner tax adviser clarifies the right structure before the purchase.",
          "Market figures are not a commitment. The lender alone decides on the loan, its amount and its rate.",
          GLOBAL_PFLICHTHINWEIS.en[0],
        ],
      },
    ],
    fragen: [
      { f: "Do I need US credit for a US property loan?", a: "For rent-coverage financing (DSCR), often not. The lender mainly checks whether the rent covers the instalment. A US score can improve the terms." },
      { f: "How much equity do I need?", a: "According to 2026 market data, usually 20 to 35 percent of the price, plus closing costs and reserves of several monthly instalments." },
      { f: "Can I finance the deposit?", a: "Lenders usually decline third-party loans as the deposit. Your own funds, verifiably held in your account, are the reliable route; you disclose their source openly." },
      { f: "Do I have to travel to the US for the closing?", a: "Often not. Many closings run through a notarised power of attorney or a remote online notary; the money goes to the title company's escrow account." },
      { f: "What happens when I sell?", a: "Under FIRPTA, the buyer withholds part of the price for US tax and pays it to the IRS. The tax return settles the final amount." },
    ],
    paket: "global_kapital",
    weiter: ["/en/business/knowledge/us-financing-routes", "/en/business/knowledge/form-a-us-llc", "/en/business/knowledge/us-llc-tax", "/en/business/knowledge/choosing-a-state"],
    quellen: [QF.dscrHandbuch, QF.dscrProgramm, QF.dscrZinsen, QF.firpta],
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
      beschreibung: "Cards, supplier accounts, balance-based business credit cards, platform loans, credit lines, property financing: what is open to a US company.",
    },
    stand: "2026-10-27",
    erschienen: S,
    kennung: "FG · 42",
    auge: "Knowledge · Financing",
    h1: "Financing routes in the US.",
    h1b: "By speed and basis.",
    lead: "A US company has more than one route to capital. Some open after days, others only after years; some depend on you personally, others on the account, on revenue or on collateral. Here is what each route rests on, so you can plan the sequence.",
    ziffern: [
      { wert: "6 routes", label: "from the card to property financing" },
      { wert: "1 rule", label: "the institution decides on every loan" },
    ],
    blick: [
      ["Fast and small", "Personal cards, supplier accounts"],
      ["By balance", "Business credit cards whose limit follows the account balance"],
      ["By revenue", "Loans from payment platforms"],
      ["With a track record", "A bank credit line, usually after two years"],
      ["With collateral", "Deposit, parent company surety, property"],
      ["With FIAON Global", "Sequence planned, documents prepared"],
    ],
    kurz: "A US company has six financing routes: personal cards, supplier accounts with payment terms, business credit cards based on the account balance, revenue-based loans from payment platforms, a bank credit line, and financing against collateral such as a deposit, a parent company surety or a property. Cards and supplier accounts carry day-to-day business; larger amounts need revenue, a track record or collateral. The institution decides on every loan.",
    bloecke: [
      {
        typ: "tabelle", id: "uebersicht", h2: "The six routes at a glance",
        kopf: ["Route", "Basis", "Speed", "Order of magnitude"],
        zeilen: [
          ["Personal cards", "your personal credit file (ITIN or SSN)", "days after approval", "small, grows with your history"],
          ["Supplier accounts (Net 30)", "company credit file, D-U-N-S number", "weeks", "small to medium"],
          ["Balance-based business credit cards", "the company's account balance", "days", "follows the balance"],
          ["Revenue-based platform loans", "revenue through a payment platform", "days", "follows the revenue"],
          ["Bank credit line", "years in business, revenue or collateral", "weeks", "medium to large"],
          ["Financing against collateral", "deposit, parent company surety, property", "weeks", "large"],
        ],
        fuss: ["Overview based on market observation, as of October 2026. Each institution sets its own conditions, amount and rate."],
      },
      {
        typ: "etappen", id: "reihenfolge", h2: "The sequence that holds",
        etappen: [
          { titel: "Company and account", text: "LLC, EIN, business account. No account, no business credit card and no platform." },
          { titel: "Master data and D-U-N-S", text: "Name, address and phone identical everywhere; the company receives its identifier at the business credit bureau." },
          { titel: "Supplier accounts", text: "First accounts with payment terms, paid early. This builds the company's credit history." },
          { titel: "Business credit cards", text: "First based on the balance, later with a personal guarantee from the owner." },
          { titel: "Show revenue", text: "Genuine US revenue opens platform loans and is the basis of every bank decision." },
          { titel: "Bank and collateral", text: "Credit line, parent company surety, property financing: the routes for large amounts." },
        ],
      },
      {
        typ: "text", id: "grenzen", h2: "Where the limits are",
        absaetze: [
          "Since 1 March 2026, government-backed SBA small business loans (the 7(a) and 504 programmes) have only been open to companies whose owners are all US citizens or US nationals with their principal residence in the United States — green card holders are excluded as well. Some online lenders only lend to owners resident in the US.",
          "Building large amounts through stacked cards alone is not a proven route. In 2025 the US Federal Trade Commission ruled against a provider that promised business owners financing and applied for credit cards instead.",
        ],
      },
      {
        typ: "text", id: "kapital", h2: "What the capital can be used for",
        absaetze: [
          KAPITAL_FREI,
          "Expensive short-term money only pays off if the return demonstrably exceeds it. Clean company figures open cheaper routes than any haste.",
        ],
      },
      {
        typ: "text", id: "fiaon", h2: "What FIAON Global does",
        absaetze: [
          "We build the foundation institutions decide on: company, account, consistent master data, identifier, supplier accounts, complete documents. We plan the sequence of applications and prepare each one.",
          "FIAON is not a bank, neither grants nor brokers loans and receives no fee based on any limit. The institution decides on every loan.",
        ],
      },
      { typ: "paket", id: "paket", h2: "The whole route in the package", lead: "Company, account, card ladder and the documents for bank and lenders — Global Capital.", paket: "global_kapital" },
      {
        typ: "hinweis", id: "wissen", h2: "What you need to know",
        punkte: [
          GLOBAL_PFLICHTHINWEIS.en[2],
          "Nobody can promise a particular limit or rate.",
          GLOBAL_PFLICHTHINWEIS.en[1],
        ],
      },
    ],
    fragen: [
      { f: "Which financing does a new US company get fastest?", a: "Business credit cards whose limit follows the balance, and supplier accounts with payment terms. Bank credit lines usually require years in business, revenue or collateral." },
      { f: "Can an LLC from Europe get an SBA loan?", a: "No. Since 1 March 2026, every direct and indirect owner must be a US citizen or US national with a principal residence in the United States (SBA Procedural Notice 5000-876626); a green card is not enough." },
      { f: "Can a parent company in Europe stand surety for the US company?", a: "Yes, this is a common route to a credit line. The bank then mainly assesses the parent company's balance sheet." },
      { f: "Does FIAON arrange the loan for my US company?", a: "No. FIAON is not a bank and neither grants nor brokers loans. We prepare the company, documents and sequence; the institution decides." },
    ],
    paket: "global_kapital",
    weiter: ["/en/business/knowledge/us-business-credit", "/en/business/knowledge/us-business-credit-card", "/en/business/knowledge/financing-us-property", "/en/business/us-business-credit-cards"],
    quellen: [Q.duns, Q.paydex, QF.sbaKredite, QF.sbaRegel2026, Q.ftcSeek],
  },
];
