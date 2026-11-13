// ═══════════════════════════════════════════════════════════════════════════
// FIAON GLOBAL — KNOWLEDGE: MANY CARD APPLICATIONS AT ONCE (27.10.2026, E-439, FG · 45)
// Address and file name carry the search term “credit card stacking”; they stay.
//
// E-510 (13.11.2026, language guide): the search term appears on the page exactly ONCE,
// in quotation marks, as the name under which others market the practice (“In brief”) —
// the word wall allows one occurrence per page, and in English only the form
// credit card “stacking” passes it. Not in the H1 or the description: both also appear
// on other pages (“Read on”). The sequence of card applications no longer has a name of
// its own; the section about us is “What FIAON Global handles” and is built from the
// fixed sentences (steps 4 and 5, S7, S8, S9). The warning signs no longer describe our
// own fee (guide 5.6 no. 12). Sentence S16 is not released (reservation V3) — S12 stands.
// The introductory period without debit interest appears as ONE sentence of market knowledge.
//
// Full edit of the whole text (same day, second round): sentence structure as in the language guide, plain titles
// as headings. FIAON now appears only in the one “At a glance” row, the section about us, the notice and the
// question on fees; “does not lend and does not broker loans” comes solely from the fixed role sentence in the notice.
// In the section about us, cards come first, then financing with the refund in a paragraph of its own. Main heading,
// second line and eyebrow stay verbatim — the preview image is generated from them (scripts/og-business-bilder.ts).
//
// Die englische Schwester von ../../e439/kreditkarten-stacking.ts (Satellit zum
// Kapital-Pfeiler /en/business/knowledge/us-funding-for-foreign-owned-companies).
// Hauptsuchwort „credit card stacking“ (Titel, H1, Kurz, erster Absatz, H2), daneben
// business credit card stacking, credit stacking, hard inquiry.
// Britisches Englisch, dieselben Bausteine in derselben Reihenfolge, dieselben ids
// und dieselbe Zahl an Absätzen, Punkten, Zeilen, Karten, Etappen und Fragen;
// Quellen mit denselben Adressen (englische Titel aus QUELLEN_WISSEN_EN).
//
// Inhaltlich identisch mit der deutschen Fachprüfung vom 27.10.2026: Urteil
// FTC v. Seek Capital (C.D. Cal., 2:24-cv-09511, 16.09.2025), vereinbarte
// („stipulated“) Anordnung 01.10.2025, FTC-Mitteilung 17.11.2025; Bankschreiben
// 2022 („credit card stacking scheme“, Name der Bank bewusst weggelassen); Beispiel
// 40.000 $ → über 60.000 $; EO 14406 Sec. 3(a)(vi) als Hinweis an Finanzinstitute,
// nicht als Pflicht. Nicht übernommen wie im Deutschen: Die Werbung mit „loans/lines
// of credit“ hat das Gericht am 16.09.2025 NICHT als Täuschung festgestellt.
//
// Wortwand EN: kein „up to“, kein Bankname, kein Zinssatz als Zahl, kein
// „recommend“, „advice“ nur verneint, „personal guarantee“ als Fachbegriff,
// Firmenkarte = „business credit card“, Anfrage = „hard enquiry“ (US-Fachwort
// „hard inquiry“ einmal erklärt). Über jede Karte entscheidet der Herausgeber,
// FIAON vermittelt keine Kredite. „Business consultancy“ als Selbstbezeichnung (E-439).
// ═══════════════════════════════════════════════════════════════════════════
import type { GlobalQuelle, GlobalSeite } from "../../typen";
// E-509 (12.11.2026): EIN Produkt statt vier Pakete. Das Erfolgshonorar richtet sich nach dem Kapitalrahmen, den der Klient
// selbst wählt — „no success fee, no fee based on the limit“ ist gestrichen.
import { GLOBAL_KAPITAL_FREI, GLOBAL_PFLICHTHINWEIS } from "../../../fiaon-global";
import { SCHRITTE_KOPF, SECHS_SCHRITTE, beleg, satz } from "../../../fiaon-global-saetze";
import { EIN_PRODUKT } from "../../ein-produkt";
import { QUELLEN_WISSEN_EN as Q } from "../../fakten-en";

/** Date of first publication (E-439). */
const S = "2026-10-27";
const P = EIN_PRODUKT.en;
/** Step 4 (credit cards on request) and step 5 (financing) of the fixed narrative — verbatim from the one source. */
const KARTEN = SECHS_SCHRITTE.en.find((x) => x.nr === 4)!;
const FINANZIERUNG = SECHS_SCHRITTE.en.find((x) => x.nr === 5)!;
/** The names of the fixed parts of a step: “Your part”, “Condition” (language guide 2.1). */
const TEIL = SCHRITTE_KOPF.en.teile;

/** Quellen dieses Beitrags, die noch nicht in fakten-en.ts stehen — dieselben Adressen wie im Deutschen. */
const QUELLEN: Record<string, GlobalQuelle> = {
  ficoAnfragen: { titel: "myFICO — Credit checks: what are credit inquiries and how do they affect your FICO Score", url: "https://www.myfico.com/credit-education/credit-reports/credit-checks-and-inquiries" },
  cfpbAnfrage: { titel: "Consumer Financial Protection Bureau — What is a credit inquiry?", url: "https://www.consumerfinance.gov/ask-cfpb/what-is-a-credit-inquiry-en-1317/" },
  usc1014: { titel: "18 U.S. Code § 1014 — Loan and credit applications generally", url: "https://www.law.cornell.edu/uscode/text/18/1014" },
  eo14406: { titel: "The White House — Executive Order 14406, Restoring Integrity to America’s Financial System (19 May 2026)", url: "https://www.whitehouse.gov/presidential-actions/2026/05/restoring-integrity-to-americas-financial-system/" },
  gewo34c: { titel: "Section 34c German Trade Regulation Act (GewO) — licence requirement, including for arranging loan agreements", url: "https://www.gesetze-im-internet.de/gewo/__34c.html" },
  regZ3Auslegung: { titel: "CFPB — Regulation Z § 1026.3 with official interpretation (comment 3-1: § 1026.12(a) and (b) apply to all credit cards)", url: "https://www.consumerfinance.gov/rules-policy/regulations/1026/3/" },
};

export const SEITE: GlobalSeite = {
  pfad: "/en/business/knowledge/credit-card-stacking",
  sprache: "en",
  schwester: "/business/wissen/kreditkarten-stacking",
  art: "wissen",
  seo: {
    titel: "Credit card “stacking”: the risks — FIAON Global",
    beschreibung: "Many card applications in a short period for a US LLC: the effect on your credit file and liability, the US ruling on Seek Capital, an orderly build-up.",
  },
  stand: "2026-11-13",
  erschienen: S,
  kennung: "FG · 45",
  auge: "Knowledge · Business credit cards",
  h1: "Many card applications at once.",
  h1b: "Credit file, liability and a US ruling.",
  lead: "Some providers apply for many credit cards in a short period and present the combined card limits as start-up capital. In some cases their fee grows with every further card application. This article sets out the consequences for your credit file and your liability. It reports what a US federal court found in the Seek Capital case, brought by the US trade regulator, the Federal Trade Commission (FTC). It closes with the sequence in which creditworthiness is built.",
  ziffern: [
    { wert: "$48.28m", label: "in fees customers paid to Seek Capital, as found by the court" },
    { wert: "35%", label: "weight of payment history in the FICO Score (myFICO)" },
    { wert: "1 year", label: "how long a hard enquiry counts in the FICO Score (myFICO)" },
  ],
  blick: [
    ["What it is", "Many card applications in a short period; the combined card limits serve as start-up capital"],
    ["Who is liable", "As a rule, the owner personally, for each card separately"],
    ["What it costs", "The issuers’ interest and charges; with some providers, a fee that grows with every card application"],
    ["Effect on your file", "Many hard enquiries, young accounts, high utilisation"],
    ["The case", "FTC v. Seek Capital: permanently banned from the financing business since October 2025"],
    ["Who decides", "Each issuer, on the card and the limit"],
    ["With FIAON Global", "On request, we prepare each application individually; you submit it yourself"],
  ],
  kurz: "Credit card “stacking” is what providers call many card applications to different issuers in a short period, with the combined card limits used as start-up capital. In substance it is personal credit: as a rule, the owner is personally liable for business credit cards, and every review appears as a hard enquiry in the credit file. Following a lawsuit by the US Federal Trade Commission (FTC), one provider that deceived its customers in this way has been permanently banned from the financing business since 2025. The issuer decides on every card and every limit.",
  bloecke: [
    {
      typ: "text", id: "begriff", h2: "The practice: many applications at once",
      absaetze: [
        "The applicant submits applications to several card issuers in a short period — often personally and for the US company at the same time. The limits of the approved cards are then added together and used as start-up capital. Applicants often choose cards with an introductory period for this purpose.",
        "On German-language websites, providers sell the model under English names as financing for the US LLC, sometimes also as a “line of credit”. It comes as a course, as a membership or as a service that submits the applications in the customer’s name. The advertising promises capital without a bank. These are credit cards, and the following applies to each:",
      ],
      punkte: [
        "Every card is a separate credit agreement with its own issuer, its own terms and its own statement.",
        "For business credit cards, the owner is as a rule personally liable — for each card separately.",
        "Some issuers offer introductory periods without debit interest; each issuer sets its own terms.",
        "Each issuer decides for itself on issuing the card, the limit and the interest rate, based on its own review; a provider’s plan does not bind it.",
      ],
      nach: "Holding several cards is not unusual in itself. The risk arises when three things coincide: many applications in a short period, limits drawn in full and repayment deferred to the end of the introductory periods.",
    },
    {
      typ: "tabelle", id: "seek", h2: "Seek Capital: the court’s findings",
      lead: "Seek Capital advertised business financing to founders and small business owners. What it applied for on their behalf was exclusively credit cards, relying on a notarised power of attorney from its customers. In September 2025 a US federal court ruled in the FTC’s favour on most points.",
      kopf: ["Seek’s claim or contract term", "The court’s finding"],
      zeilen: [
        ["Special, direct relationships with lenders; no payment from them", "No relationships existed that gave customers an advantage. Lenders paid Seek for referring customers. Banks called on Seek in writing to stop its application practice. In 2022 one US bank described it as a scheme of serial credit card applications."],
        ["Cards that work like a line of credit", "The cards did no more than ordinary credit cards. They gave no access to cash, for example, as a line of credit does."],
        ["“No interest for the first twelve to eighteen months”", "Seek also applied for cards without such an introductory period. For one customer it applied for at least ten cards, many of them without the advertised terms. A later clarification does not cure the initial deception."],
        ["“No fee until funded”", "Seek charged early-termination fees before any financing had been approved. It pressed customers to sign and told them they did not need to read the contract."],
        ["“No hard enquiries”, no harm to the score", "The card applications triggered hard enquiries. The defendants conceded that such enquiries can lower the score."],
        ["Contract clause against negative reviews", "The clause barred customers for three years from publishing negative reviews or complaints about Seek online. That violates the Consumer Review Fairness Act."],
      ],
      fuss: [
        "FTC v. Seek Capital, LLC et al., U.S. District Court for the Central District of California, case no. 2:24-cv-09511, ruling of 16 September 2025; final order of 1 October 2025; FTC press release of 17 November 2025.",
        "In this ruling, the court did not finally decide whether advertising “loans” and “lines of credit” for what were purely card applications was misleading. US courts have classified credit cards as lines of credit and as revolving credit. Customers were nonetheless surprised to find that their “financing” consisted of credit cards.",
      ],
    },
    {
      typ: "text", id: "verbot", h2: "Fees, liability, ban: the outcome",
      absaetze: [
        "Seek charged a fee as a percentage of the card limits it obtained for its customers. It added application fees and fees for expedited processing. It also charged for negotiating with banks and for early termination. By its own account, Seek in practice obtained around 115 per cent of the amount named in the contract as the funding proposal. The fee grew with the higher limit. One customer wanted $40,000 for a trailer for his haulage business; his invoice showed more than $60,000 in limits. The court left open whether this was unfair, because the contract allowed for an uplift. In total, customers paid $48,280,328.57 to Seek, net of credits, refunds and chargebacks.",
        "The final order of 1 October 2025 is a stipulated order, agreed with the FTC. It permanently bans Seek Capital and its founder from marketing or offering credit, loans or other business financing. The same applies to debt relief and credit repair. The monetary judgment is for $48,280,328 and is partly suspended because the defendants are unable to pay it in full. In September the court had already held the founder personally liable for injunctive relief and for payment.",
        "For the customers, this means: the fees stayed with the provider. The cards, the enquiries in their files and the personal liability for every balance stayed with them.",
      ],
    },
    {
      typ: "tabelle", id: "akte", h2: "Many applications and your credit file",
      lead: "The FICO Score summarises your personal credit file in five categories of data. Many card applications in a short period affect almost all of them.",
      kopf: ["Data", "Weight", "Effect of many applications in a short period"],
      zeilen: [
        ["Payment history", "35%", "stays unblemished as long as you pay every statement on time; a cash shortfall affects many accounts at once"],
        ["Amounts owed and utilisation", "30%", "rises when you draw the limits as capital and the cards appear in your personal file"],
        ["Length of history", "15%", "falls: many new accounts lower the average age"],
        ["New credit", "10%", "many enquiries and new accounts in a short period are treated as a higher risk"],
        ["Credit mix", "10%", "barely changes: they remain cards"],
      ],
      fuss: ["Weights according to myFICO. How much each category counts can vary from person to person. For most people, one additional enquiry costs fewer than five points; according to myFICO, many enquiries signal a higher risk. Hard enquiries can stay in the file for two years and count in the FICO Score for one year."],
    },
    {
      typ: "text", id: "ende", h2: "Hard enquiries and expiring introductory periods",
      absaetze: [
        "When an issuer reviews your file for a card application, a hard enquiry appears there (in US credit reports: a hard inquiry). According to the US Consumer Financial Protection Bureau (CFPB), such enquiries affect the score. Most models assess how often and how recently someone has applied for credit. A single enquiry carries little weight. FICO, however, treats many new accounts in a short period as a sign of higher risk. Every further issuer sees them before it decides.",
        "Timing adds to this. If you open many cards in the same weeks, their introductory periods also end in the same weeks. After that, the standard interest rate of the issuer concerned applies to every outstanding balance. Anyone who then wants to move the balances needs new cards. Each brings a new enquiry, and the file is by now fully utilised.",
        "If the business is not yet generating revenue, the owner repays the balances from private means. Many cards in a short period are therefore personal credit of the owner, not financing for the company.",
      ],
    },
    {
      typ: "text", id: "recht", h2: "Liability and law: United States and Germany",
      absaetze: [
        "For business credit cards issued to young companies, issuers as a rule require the owner to accept personal liability (a “personal guarantee”). If the company fails to pay a statement, the owner is liable personally. The LLC’s limited liability then offers no protection. With several cards, this applies to each one.",
        "The consumer protection rules of US Regulation Z do not apply to credit extended primarily for business purposes (12 CFR 1026.3(a)). For business credit cards, the main rules that still apply are those on issuing a card and on liability for unauthorised use (12 CFR 1026.12(a) and (b); official interpretation of § 1026.3, comment 3-1). Anything beyond that is set out in the card agreement. The issuer sets its terms.",
        "Anyone who knowingly makes false statements in an application to a federally insured institution commits a crime under 18 U.S.C. § 1014. One example is stating revenue or income as higher than it is. The statute provides for a fine of not more than one million US dollars, imprisonment of not more than thirty years, or both. Executive Order 14406 of 19 May 2026 instructs the US Department of the Treasury to alert financial institutions to warning signs. Under it, using a personal tax number (ITIN) instead of a Social Security number (SSN) for credit products can count as a risk factor where US immigration status is unverified. Such a risk factor calls for enhanced review.",
        "In Germany, anyone who arranges the conclusion of loan agreements on a commercial basis needs a licence from the competent authority. The basis is section 34c(1), first sentence, no. 2 of the German Trade Regulation Act (GewO). Anyone selling you financing should be able to say whether they arrange loans and under which licence.",
      ],
    },
    {
      typ: "tabelle", id: "vergleich", h2: "Serial applications or an orderly build-up",
      lead: "An orderly build-up uses the same products in a different sequence and with a different aim. The aim is a payment record that grows with every statement paid on time.",
      kopf: ["", "Serial applications", "Orderly build-up"],
      hervor: 2,
      zeilen: [
        ["Applications", "many in a short period", "few, in an orderly sequence and spaced apart"],
        ["Who submits the application", "sometimes a provider, by power of attorney", "you yourself, with complete documents"],
        ["Basis", "the combined limit", "real revenue and statements paid on time"],
        ["Utilisation", "high, because the limits serve as capital", "low"],
        ["Introductory periods", "end at roughly the same time", "end at staggered dates; repayment is planned from the business"],
        ["File after one year", "many enquiries, young accounts, high balances", "a growing record of on-time payments"],
        ["Fee", "with some providers, grows with every card application", "stated as an amount before you sign"],
        ["Who decides", "each issuer", "each issuer"],
      ],
      fuss: ["Simplified comparison."],
    },
    {
      typ: "karten", id: "warnzeichen", h2: "Warning signs of unsound offers", spalten: 3,
      karten: [
        { tag: "Warning sign", titel: "A fee that grows with each application", text: "Anyone who earns from every further card has an incentive to keep applying — even if the applications harm your file. Seek Capital charged a fee on the card limits obtained. By its own account, Seek obtained higher limits than the contract proposed as financing." },
        { tag: "Warning sign", titel: "Special relationships with banks", text: "The provider advertises “direct contacts” and terms that others do not receive. In the Seek case no such relationships existed; banks demanded in writing that the application practice stop. Every issuer reviews applications by its own rules." },
        { tag: "Warning sign", titel: "Limit and interest promised in advance", text: "The limit, the interest rate and any introductory period are set by the issuer alone. No provider can keep a commitment on them. An amount you choose yourself is a target, not a commitment." },
        { tag: "Warning sign", titel: "“No fee until funded”", text: "Seek advertised that it would charge no fee until financing was in place. In fact it charged exit fees before any financing had been approved. The contract must state when a fee falls due. Read also what an exit costs before you sign." },
        { tag: "Warning sign", titel: "“No hard enquiry”", text: "When an issuer reviews your file for a card application, that is, as a rule, a hard enquiry. In court, Seek pointed to a pre-check with no effect on the score. The card applications themselves triggered hard enquiries." },
        { tag: "Warning sign", titel: "Time pressure, power of attorney, gag clause", text: "Three things came together in the Seek case: time pressure before signing, serial credit applications by power of attorney and a clause against negative reviews." },
      ],
    },
    {
      typ: "etappen", id: "leiter", h2: "Creditworthiness: the orderly build-up",
      lead: "Creditworthiness is built in steps. Each builds on the previous one. The issuer decides on every card.",
      etappen: [
        { titel: "Core data and foundations", text: "The starting point is the company, its tax identification number (EIN) and your ITIN. Then come a US address, a US telephone number, a business account and a D-U-N-S Number. The core data are identical in every register and every application." },
        { titel: "A first card that suits your history", text: "You start with an issuer whose requirements suit your file. You submit the complete application yourself." },
        { titel: "Pay on time, keep utilisation low", text: "You pay every statement in full and on time and keep utilisation low. This creates the payment history that FICO weights most heavily." },
        { titel: "Spacing between applications", text: "Further issuers follow in an orderly sequence when your file allows it. The applications are spread over several months." },
        { titel: "Revenue and supplier accounts", text: "Real revenue through the business account and suppliers with payment terms also build the company’s own credit file." },
        { titel: "Loan and collateral", text: "For larger amounts, what counts is financial years on record, key figures and collateral. Orderly accounts are the basis for a later loan. The lender decides on it." },
      ],
    },
    {
      typ: "text", id: "fiaon", h2: "What FIAON Global handles",
      // Cards first (their step with “Your part” and its condition), then financing in a paragraph of its own
      // (its step with the sentence on the funding target and the refund) — the refund does not extend to cards.
      absaetze: [
        `${KARTEN.satz} We prepare each card application individually and in full, not in series. You sign with each issuer yourself.`,
      ],
      punkte: [
        `${TEIL.ihrTeil}: ${KARTEN.ihrTeil}`,
        `Fees: ${beleg("honorarVorab", "en")}`,
        `${TEIL.bedingung}: ${KARTEN.bedingung}`,
      ],
      nach: `${FINANZIERUNG.satz} ${satz("S9", "en")} ${P.geldZurueck}`,
    },
    { typ: "paket", id: "mandat", h2: P.karteH2, lead: P.karteLead, paket: "global_kapital" },
    {
      typ: "hinweis", id: "wissen", h2: "What you need to know",
      punkte: [
        GLOBAL_PFLICHTHINWEIS.en[2],
        "An introductory period ends on a fixed date; after that the issuer’s standard interest rate applies to the outstanding balance.",
        `${satz("S8", "en")} FIAON makes no commitment on any limit. ${satz("S9", "en")}`,
        GLOBAL_PFLICHTHINWEIS.en[0],
        "This article sets out the legal position and the Seek Capital case according to the sources cited (as at October 2026). It does not replace a tax or legal review of your case.",
      ],
    },
  ],
  fragen: [
    { f: "What does applying for many credit cards at once involve?", a: "The applicant applies for many credit cards from different issuers in a short period and uses their combined limits as start-up capital. They are cards, not loans, and each has its own terms. The owner is, as a rule, personally liable for business credit cards. When an issuer checks the credit file for an application, a hard enquiry appears there." },
    { f: "Is it legal in the US to apply for many credit cards at once?", a: "Applying for several cards is not prohibited in itself. Knowingly false statements in credit applications are a crime (18 U.S.C. § 1014). The FTC pursues deceptive promises by providers: Seek Capital has been permanently barred from business financing since October 2025. Banks take a critical view of serial applications. In 2022 one US bank demanded in writing that Seek stop its application practice. Each card issuer makes its own decision." },
    { f: "What was the outcome of the FTC case against Seek Capital?", a: "At the FTC’s request, a US federal court found in September 2025 that Seek Capital had deceived customers with several claims. They concerned relationships with lenders, a line-of-credit function of the cards and periods without interest. Added to these were the claims “no fee until funded” and “no hard enquiries”. Since October 2025, Seek and its founder have been permanently barred from business financing. The $48.28 million monetary judgment is partly suspended." },
    { f: "How much do hard enquiries affect the score?", a: "According to myFICO, one additional enquiry costs most people fewer than five points. Hard enquiries can stay in the file for two years and count in the FICO Score for one year. Many new accounts in a short period, by contrast, are seen as a sign of higher risk. Every further issuer sees them before it decides." },
    { f: "Am I personally liable for my US LLC’s credit cards?", a: "As a rule, yes. For business credit cards issued to young companies, issuers require a personal guarantee from the owner. The LLC’s limited liability then offers you no protection. With several cards, this applies to each one." },
    { f: "Can a US LLC obtain credit cards if its owner lives in Europe?", a: "Each issuer decides. With young companies, it usually reviews the owner’s personal US history via SSN or ITIN. It also requires a personal guarantee from the owner. Under Executive Order 14406 of 19 May 2026, using an ITIN instead of an SSN without verified US immigration status can count as a risk factor. Such a risk factor calls for enhanced review. A carefully prepared file therefore counts for more than the number of applications." },
    { f: "What does FIAON Global cost — is there a success fee?", a: `Yes. ${P.preisSatz} ${satz("S4", "en")}` },
    { f: GLOBAL_KAPITAL_FREI.en.frage, a: GLOBAL_KAPITAL_FREI.en.antwort },
  ],
  paket: "global_kapital",
  weiter: ["/en/business/knowledge/us-funding-for-foreign-owned-companies", "/en/business/knowledge/us-business-credit-card", "/en/business/knowledge/building-us-credit", "/en/business/knowledge/checking-providers"],
  quellen: [Q.ftcSeek, Q.ftcSeekUrteil, Q.ficoFaktoren, QUELLEN.ficoAnfragen, QUELLEN.cfpbAnfrage, Q.regZ3, QUELLEN.regZ3Auslegung, Q.regZ12, QUELLEN.usc1014, QUELLEN.eo14406, QUELLEN.gewo34c],
};
