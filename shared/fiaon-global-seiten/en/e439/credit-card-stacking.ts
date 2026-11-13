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
    beschreibung: "Many credit card applications in a short time for a US LLC: what providers promise, what a US court found in the Seek Capital case, what a file can bear.",
  },
  stand: "2026-11-13",
  erschienen: S,
  kennung: "FG · 45",
  auge: "Knowledge · Business credit cards",
  h1: "Many card applications at once.",
  h1b: "Credit file, liability and a US ruling.",
  lead: "Some providers apply for many credit cards within a short time and present the combined limits as start-up capital — sometimes for a fee that grows with every further card application. This article sets out what happens to your credit file and to your liability, what a US federal court found in the Seek Capital case brought by the US trade regulator, the Federal Trade Commission (FTC), and in which order creditworthiness is built.",
  ziffern: [
    { wert: "$48.28m", label: "in fees paid by customers to Seek Capital" },
    { wert: "35%", label: "weight of payment history in the FICO Score" },
    { wert: "1 year", label: "how long a hard enquiry counts in the FICO Score" },
  ],
  blick: [
    ["What it is", "Many card applications in a short time, the limits used as start-up capital"],
    ["Who is liable", "As a rule, the owner personally — for each card separately"],
    ["What it costs", "Sometimes a fee that grows with every card application; plus the issuers’ interest and charges"],
    ["Traces in your file", "Many hard enquiries, young accounts, high utilisation"],
    ["The benchmark", "FTC v. Seek Capital: permanent ban since October 2025"],
    ["Who decides", "Each issuer for itself, on the card and the limit"],
    ["With FIAON Global", "Each application prepared individually — on request; you submit it yourself"],
  ],
  kurz: "Applying for many credit cards from different issuers within a short time and using their combined limits as start-up capital is marketed online as credit card “stacking”. In substance it is personal credit: for business credit cards the owner is, as a rule, personally liable, every review is recorded as a hard enquiry in the credit file, and the introductory periods end at roughly the same time. Following a lawsuit by the US Federal Trade Commission (FTC), a provider that applied for cards in return for high fees while claiming relationships with lenders and periods without interest has been permanently banned from the financing business since 2025. Creditworthiness is built in steps: only a few applications, spaced apart, statements paid on time, real revenue. The issuer decides on every card and every limit.",
  bloecke: [
    {
      typ: "text", id: "begriff", h2: "The practice: many applications at once",
      absaetze: [
        "Applications are submitted to several card issuers within a short time, often for yourself personally and for the US company at the same time. The limits of the approved cards are added together and spent as start-up capital, frequently on cards chosen for an introductory period.",
        "On the German-language web, the model is sold under English names as financing for the US LLC, sometimes also as a “line of credit”: as a course, as a membership or as a service that submits the applications in the customer’s name. The promise sounds like capital without a bank. In reality these are cards — with everything that goes with them:",
      ],
      punkte: [
        "Every card is a separate credit agreement with its own issuer, its own terms and its own statement.",
        "Each issuer decides for itself on issuing the card, the limit and the interest rate — based on its own review, not on a provider’s plan.",
        "For business credit cards, the owner is as a rule personally liable, and for each card separately.",
        "Some issuers offer introductory periods without debit interest; each issuer sets its own terms.",
      ],
      nach: "Holding several cards is nothing unusual in itself. It becomes risky when many applications are made at once, the limits are drawn down in full and repayment is pushed back to the end of the introductory periods.",
    },
    {
      typ: "tabelle", id: "seek", h2: "The Seek Capital case: what the court found",
      lead: "Seek Capital advertised business financing to founders and small business owners and applied exclusively for credit cards on their behalf — relying on a notarised power of attorney from its customers. In September 2025 a US federal court ruled in the FTC’s favour on most points.",
      kopf: ["Seek’s promises and contract", "What the court found"],
      zeilen: [
        ["Special, direct relationships with lenders — and no money from them", "There were no relationships that gave customers an advantage. Seek was paid by lenders for referring customers. Banks called on Seek in writing to stop its application practice; in 2022 one US bank described it as a scheme of serial credit card applications."],
        ["Cards that work like a line of credit", "The cards could do no more than ordinary credit cards — for example, they gave no access to cash as a line of credit does."],
        ["“No interest for the first twelve to eighteen months”", "Seek also applied for cards without such an introductory period — for one customer at least ten cards, many of them without the advertised terms. A later clarification does not cure the initial deception."],
        ["“No fee until funded”", "Seek charged early-termination fees before any financing had even been approved. Customers were pressed to sign and told they did not need to read the contract."],
        ["“No hard enquiries”, no harm to the score", "The card applications triggered hard enquiries. The defendants conceded that such enquiries can lower the score."],
        ["Contract clause against negative reviews", "For three years, customers were not allowed to publish negative reviews or complaints about Seek online — a violation of the Consumer Review Fairness Act."],
      ],
      fuss: [
        "FTC v. Seek Capital, LLC et al., U.S. District Court for the Central District of California, case no. 2:24-cv-09511, ruling of 16 September 2025; final order of 1 October 2025; FTC press release of 17 November 2025.",
        "In this ruling, the court did not finally decide whether advertising “loans” and “lines of credit” for what were purely card applications was misleading: US courts have classified credit cards as lines of credit and as revolving credit. Customers were nonetheless surprised to find that their “financing” consisted of credit cards.",
      ],
    },
    {
      typ: "text", id: "verbot", h2: "Fees, liability, ban: how the case ended",
      absaetze: [
        "Seek charged a fee as a percentage of the card limits it obtained for its customers. On top of that came application fees, as well as fees for expedited processing, for negotiating with banks and for early termination. By its own account, Seek in practice obtained around 115 per cent of the amount named in the contract as the funding proposal — and the fee grew with the higher limit. One customer wanted $40,000 for a trailer for his haulage business; his invoice showed more than $60,000 in limits. The court left open whether this was unfair, because the contract allowed for an uplift. In total, customers paid $48,280,328.57 to Seek, net of credits, refunds and chargebacks.",
        "Under the final order of 1 October 2025 — a stipulated order, agreed with the FTC — Seek Capital and its founder are permanently banned from marketing or offering credit, loans or other business financing, debt relief or credit repair. The monetary judgment is for $48,280,328 and is partly suspended because the defendants are unable to pay it in full. In September the court had already held the founder personally liable for injunctive relief and for payment.",
        "For the customers, the upshot is this: the fees stayed with the provider. The cards, the enquiries in their files and the personal liability for every balance stayed with them.",
      ],
    },
    {
      typ: "tabelle", id: "akte", h2: "What many applications leave in your credit file",
      lead: "The FICO Score summarises your personal credit file in five categories of data. Many card applications in a short time touch almost all of them.",
      kopf: ["Data", "Weight", "Effect of many applications in a short time"],
      zeilen: [
        ["Payment history", "35%", "stays clean as long as every statement is paid on time — but a cash squeeze hits many accounts at once"],
        ["Amounts owed and utilisation", "30%", "rises when the limits are used up as capital and the cards appear in your personal file"],
        ["Length of history", "15%", "falls: many new accounts lower the average age"],
        ["New credit", "10%", "many enquiries and new accounts in a short time are treated as a higher risk"],
        ["Credit mix", "10%", "barely changes: they are still cards"],
      ],
      fuss: ["Weights according to myFICO; how much each category counts can vary from person to person. For most people, one additional enquiry costs fewer than five points; according to myFICO, many enquiries signal a higher risk. Hard enquiries can stay in the file for two years and count in the FICO Score for one year."],
    },
    {
      typ: "text", id: "ende", h2: "Hard enquiries and the shared end date",
      absaetze: [
        "Every card application for which an issuer reviews your file is recorded there as a hard enquiry (in US credit reports: a hard inquiry). The US Consumer Financial Protection Bureau (CFPB) explains that such enquiries affect the score because most models look at how often and how recently someone has applied for credit. A single enquiry carries little weight. FICO, however, treats many new accounts in a short time as a sign of higher risk — and every further issuer sees them before it decides.",
        "Then there is the calendar. Anyone who opens many cards in the same weeks has introductory periods that end in the same weeks. After that, the standard interest rate of the issuer concerned applies to every outstanding balance. Anyone who then wants to transfer the balances needs new cards — with new enquiries, in a file that is by now fully utilised.",
        "If the money has gone into a business that is not yet generating revenue, repayment comes out of your own pocket. This is where it becomes clear: many cards at once are not financing for the company but personal credit of the owner.",
      ],
    },
    {
      typ: "text", id: "recht", h2: "Liability and law: what applies in the US and in Germany",
      absaetze: [
        "For business credit cards issued to young companies, issuers as a rule require the owner to accept personal liability (a “personal guarantee”). If the company fails to pay a statement, the owner is liable personally; the LLC’s limited liability then offers no protection. With several cards, this applies to every single one.",
        "The consumer protection rules of US Regulation Z do not apply to credit extended primarily for business purposes (12 CFR 1026.3(a)). For business credit cards, the main rules that still apply are those on issuing a card and on liability for unauthorised use (12 CFR 1026.12(a) and (b); official interpretation of § 1026.3, comment 3-1). Anything beyond that is set out in the card agreement — whose terms the issuer sets.",
        "Anyone who knowingly makes false statements in an application to a federally insured institution — for example by inflating revenue or income — commits a crime under 18 U.S.C. § 1014; the statute provides for a fine of not more than one million US dollars, imprisonment of not more than thirty years, or both. Executive Order 14406 of 19 May 2026 also instructs the US Department of the Treasury to alert financial institutions to warning signs: under it, using an ITIN instead of an SSN to obtain credit products can, without verified US immigration status, be treated as a risk factor that calls for enhanced review.",
        "In Germany, anyone who, on a commercial basis, arranges the conclusion of loan agreements needs a licence from the competent authority (section 34c(1), first sentence, no. 2 of the German Trade Regulation Act, GewO). A provider selling you financing should be able to say whether it arranges loans — and if so, under which licence. FIAON does not lend and does not broker loans.",
      ],
    },
    {
      typ: "tabelle", id: "vergleich", h2: "Serial applications or a planned build-up",
      lead: "A planned build-up uses the same products, but in a different order and with a different aim: a history that grows with every statement paid on time, instead of a limit that is used up all at once.",
      kopf: ["", "Serial applications", "Planned build-up"],
      hervor: 2,
      zeilen: [
        ["Applications", "many in a short time", "few, spaced apart and planned"],
        ["Who submits the application", "sometimes a provider, by power of attorney", "you yourself, fully prepared"],
        ["Basis", "the combined limit", "real revenue and statements paid on time"],
        ["Utilisation", "high — the limits are the capital", "kept low"],
        ["Introductory periods", "end together", "staggered, with a plan for repayment from the business"],
        ["File after one year", "many enquiries, young accounts, high balances", "a growing history of on-time payments"],
        ["Fee", "with some providers, growing with every card application", "with FIAON Global: fees and services are set out in full before you sign"],
        ["Who decides", "each issuer", "each issuer"],
      ],
      fuss: ["Simplified comparison. The issuer decides on every card and every limit."],
    },
    {
      typ: "karten", id: "warnzeichen", h2: "How to spot unsound offers", spalten: 3,
      karten: [
        { tag: "Warning sign", titel: "A fee that grows with every card application", text: "Anyone who earns from every further card has an incentive to keep applying — even if the applications harm your file. Seek Capital charged a fee on the card limits obtained and, by its own account, obtained higher limits than the contract proposed as financing." },
        { tag: "Warning sign", titel: "Special relationships with banks", text: "“Direct contacts” and terms not otherwise on offer: in the Seek case, they did not exist — instead, banks demanded in writing that the application practice stop. Every issuer reviews applications by its own rules." },
        { tag: "Warning sign", titel: "Limit and interest promised in advance", text: "The amount, the interest rate and any introductory period are set by the issuer alone, after its review. Anyone who commits to them is committing to what they cannot deliver. You may choose a target yourself — it is not a commitment." },
        { tag: "Warning sign", titel: "“No fee until funded”", text: "Read what falls due if you pull out. Seek advertised that no fee would be charged until financing was in place, and charged exit fees before any financing had been approved. When a fee falls due must be in the contract before you sign." },
        { tag: "Warning sign", titel: "“No hard enquiry”", text: "A card application that involves a review of your file is, as a rule, a hard enquiry. In court, Seek pointed to a pre-check with no effect on the score — the card applications themselves triggered hard enquiries." },
        { tag: "Warning sign", titel: "Haste, power of attorney, gag clause", text: "Time pressure before signing, credit applications in series by power of attorney and a clause against negative reviews all appeared side by side in the Seek case." },
      ],
    },
    {
      typ: "etappen", id: "leiter", h2: "The build-up in six steps",
      lead: "Creditworthiness is built in steps. Each builds on the previous one; the issuer decides on every card.",
      etappen: [
        { titel: "Lay the foundation", text: "Company, EIN, ITIN, US address and US phone number, business account and D-U-N-S Number — with identical core data in every register and every application." },
        { titel: "A first card that suits your history", text: "An issuer whose review criteria suit your file. The application is fully prepared; you submit it yourself." },
        { titel: "Pay on time, keep utilisation low", text: "Pay every statement in full and on time, and keep utilisation low. This creates the payment history that FICO weights most heavily." },
        { titel: "Spacing between applications", text: "Further issuers follow in a planned order when your file can support it — not all in the same month." },
        { titel: "Revenue and supplier accounts", text: "Real revenue through the business account and suppliers with payment terms also build your company’s own file." },
        { titel: "Bank and collateral", text: "For larger amounts, what counts is financial years on record, key figures and collateral. Orderly accounts are the basis for a later bank loan; the bank decides." },
      ],
    },
    {
      typ: "text", id: "fiaon", h2: "What FIAON Global handles",
      absaetze: [
        `${KARTEN.satz} We prepare each card application individually and in full; we do not prepare serial applications. Nobody signs in your name with a card issuer.`,
        `${FINANZIERUNG.satz} ${satz("S9", "en")}`,
      ],
      punkte: [
        `${TEIL.ihrTeil}: ${KARTEN.ihrTeil}`,
        `${TEIL.bedingung}: ${KARTEN.bedingung}`,
        `Fees: ${beleg("honorarVorab", "en")}`,
        P.geldZurueck,
      ],
    },
    { typ: "paket", id: "mandat", h2: P.karteH2, lead: P.karteLead, paket: "global_kapital" },
    {
      typ: "hinweis", id: "wissen", h2: "What you need to know",
      punkte: [
        GLOBAL_PFLICHTHINWEIS.en[2],
        "An introductory period ends on a fixed date; after that the issuer’s standard interest rate applies to the outstanding balance.",
        `${satz("S8", "en")} FIAON makes no commitment on any limit. ${satz("S9", "en")}`,
        GLOBAL_PFLICHTHINWEIS.en[0],
        "This article sets out the legal position and the Seek Capital case according to the sources cited, as of October 2026; it does not replace a tax or legal review of your case.",
      ],
    },
  ],
  fragen: [
    { f: "What does applying for many credit cards at once involve?", a: "Many credit cards are applied for from different issuers within a short time, and their combined limits are used as start-up capital. They are cards, not loans: each has its own terms, the owner is as a rule personally liable for business credit cards, and every review is recorded in the credit file." },
    { f: "Is it legal in the US to apply for many credit cards at once?", a: "Applying for several cards is not prohibited in itself. Knowingly false statements in credit applications are a crime (18 U.S.C. § 1014); the FTC pursues deceptive promises by providers — Seek Capital has been permanently barred from business financing since October 2025. Banks take a critical view of such series of applications: in 2022 one US bank demanded in writing that Seek stop its application practice. The issuer decides on every card." },
    { f: "What was the outcome of the FTC case against Seek Capital?", a: "At the FTC’s request, a US federal court found in September 2025 that Seek Capital had deceived customers about relationships with lenders, a line-of-credit function of the cards, periods without interest, “no fee until funded” and “no hard enquiries”. Since October 2025, Seek and its founder have been permanently barred from business financing; the $48.28 million monetary judgment is partly suspended." },
    { f: "How much do hard enquiries affect the score?", a: "According to myFICO, one additional enquiry costs most people fewer than five points. Hard enquiries can stay in the file for two years and count in the FICO Score for one year. Many new accounts in a short time, by contrast, are seen as a sign of higher risk — and every further issuer sees them before it decides." },
    { f: "Am I personally liable for my US LLC’s credit cards?", a: "As a rule, yes. For business credit cards issued to young companies, issuers require a personal guarantee from the owner; the LLC’s limited liability then offers no protection. With several cards, this applies to each card separately." },
    { f: "Can a US LLC obtain credit cards if its owner lives in Europe?", a: "Each issuer decides. With young companies, it usually reviews the owner’s personal US history via SSN or ITIN and requires a personal guarantee. Under Executive Order 14406 of 19 May 2026, using an ITIN instead of an SSN without verified US immigration status can also be treated as a risk factor calling for enhanced review. A carefully prepared file therefore counts for more than the number of applications." },
    { f: "What does FIAON Global cost — is there a success fee?", a: `Yes. ${P.preisSatz} We prepare credit card applications on request, at no additional fee from FIAON.` },
    { f: GLOBAL_KAPITAL_FREI.en.frage, a: GLOBAL_KAPITAL_FREI.en.antwort },
  ],
  paket: "global_kapital",
  weiter: ["/en/business/knowledge/us-funding-for-foreign-owned-companies", "/en/business/knowledge/us-business-credit-card", "/en/business/knowledge/building-us-credit", "/en/business/knowledge/checking-providers"],
  quellen: [Q.ftcSeek, Q.ftcSeekUrteil, Q.ficoFaktoren, QUELLEN.ficoAnfragen, QUELLEN.cfpbAnfrage, Q.regZ3, QUELLEN.regZ3Auslegung, Q.regZ12, QUELLEN.usc1014, QUELLEN.eo14406, QUELLEN.gewo34c],
};
