// ═══════════════════════════════════════════════════════════════════════════
// FIAON GLOBAL — COUNTRY PAGE: US COMPANY FROM AUSTRIA (27.10.2026, E-439, FG · 46)
//
// Die englische Schwester von ../../e439/aus-oesterreich.ts — die dritte DACH-
// Länderseite neben /en/business/from-germany und /en/business/from-switzerland.
// Hauptsuchwort „US company from Austria“ (Titel, H1, Kurz, erster Absatz, H2),
// daneben US LLC from Austria, US LLC Austria tax, E-2 visa Austria.
// Britisches Englisch, dieselben Bausteine in derselben Reihenfolge, dieselben ids
// und dieselbe Zahl an Absätzen, Punkten, Zeilen, Etappen, Fragen, Blick-Zeilen
// und Ziffern; Quellen mit denselben Adressen (englische Titel).
//
// Inhaltlich identisch mit der deutschen Fachprüfung vom 27.10.2026: § 27 Abs. 2 BAO,
// § 1 Abs. 1 und 2 KStG, § 22 KStG (23 %, ab 01.01.2028 24 % über 1 Mio. €,
// BGBl. I Nr. 62/2026), EAS 1413 und EAS 1107, BFG RV/6100084/2013, § 1175 ABGB,
// DBA Österreich–USA (Art. 4 Abs. 3, Art. 5 Abs. 2, Art. 7 Abs. 1, Art. 10 Abs. 2,
// Art. 22 Abs. 3, Verständigungsprotokoll zu Art. 4), § 27a EStG (27,5 %), §§ 120,
// 121 BAO, § 10a KStG, § 14 Abs. 4 GewO, SSA seit 01.11.1991, 9 FAM 402.9.
// Deutsche/österreichische Normen stehen als erklärtes Stichwort („section 27(2)
// of the Austrian Federal Fiscal Code (BAO)“), „Typenvergleich“ einmal erklärt als
// „comparison of legal types“.
//
// Wortwand EN: kein Steuermodell (Ort der Geschäftsleitung steht vorn), kein „up to“,
// kein Bankname, keine Preiszahl (Baustein "paket"), kein „recommend“, „advice“ nie,
// „personal guarantee“ als Fachbegriff, Firmenkarte = „business credit card“.
// Selbstbezeichnung (28.10.2026, E-454): wie im Deutschen nie „business consultancy“ —
// weder im Text noch im Datenblock (AT § 94 Z 74 GewO, Ausnahme aus E-439). Bis E-454
// stand das Wort einmal im Abschnitt "fiaon"; Regel: OESTERREICH_REGEL in
// shared/fiaon-global-wortregeln.ts.
// ═══════════════════════════════════════════════════════════════════════════
import type { GlobalQuelle, GlobalSeite } from "../../typen";
import { GLOBAL_GELD_ZURUECK, GLOBAL_PFLICHTHINWEIS, globalPaket } from "../../../fiaon-global";
import { FIAON_FIRMA } from "../../../fiaon-firma";
import { QUELLEN_WISSEN_EN as Q, QUELLEN_STAATEN_EN, IRS_EN, SCHWELLEN_EN, FRISTEN_EN } from "../../fakten-en";

const S = "2026-10-27";
const GELD_ZURUECK = GLOBAL_GELD_ZURUECK.aktiv ? [`${GLOBAL_GELD_ZURUECK.en.text} ${GLOBAL_GELD_ZURUECK.en.bedingungen}`] : [];
const STRUKTUR = globalPaket("global_struktur")?.en.name ?? "Global Structure";
const BANKING = globalPaket("global_banking")?.en.name ?? "Global Banking";

/** Austrian and further primary sources of this page — the same addresses as the German page (read on 27.10.2026). */
const QUELLEN: Record<string, GlobalQuelle> = {
  kstg1: { titel: "Section 1 Austrian Corporate Income Tax Act 1988 (KStG) — unlimited and limited tax liability (RIS)", url: "https://www.ris.bka.gv.at/NormDokument.wxe?Abfrage=Bundesnormen&Gesetzesnummer=10004569&Paragraf=1" },
  kstg22: { titel: "Section 22 Austrian Corporate Income Tax Act 1988 (KStG) — tax rate (RIS)", url: "https://www.ris.bka.gv.at/NormDokument.wxe?Abfrage=Bundesnormen&Gesetzesnummer=10004569&Paragraf=22" },
  kstg22ab2028: { titel: "Section 22 KStG 1988 as applicable from 1 January 2028, Federal Law Gazette I No. 62/2026 (RIS)", url: "https://www.ris.bka.gv.at/NormDokument.wxe?Abfrage=Bundesnormen&Gesetzesnummer=10004569&Paragraf=22&FassungVom=2028-01-01" },
  kstg10a: { titel: "Section 10a KStG 1988 — controlled foreign company taxation (RIS)", url: "https://www.ris.bka.gv.at/NormDokument.wxe?Abfrage=Bundesnormen&Gesetzesnummer=10004569&Paragraf=10a" },
  bao27: { titel: "Section 27 Austrian Federal Fiscal Code (BAO) — registered office and place of management (RIS)", url: "https://www.ris.bka.gv.at/NormDokument.wxe?Abfrage=Bundesnormen&Gesetzesnummer=10003940&Paragraf=27" },
  bao120: { titel: "Section 120 Austrian Federal Fiscal Code (BAO) — notification duties (RIS)", url: "https://www.ris.bka.gv.at/NormDokument.wxe?Abfrage=Bundesnormen&Gesetzesnummer=10003940&Paragraf=120" },
  bao121: { titel: "Section 121 Austrian Federal Fiscal Code (BAO) — deadline for notifications (RIS)", url: "https://www.ris.bka.gv.at/NormDokument.wxe?Abfrage=Bundesnormen&Gesetzesnummer=10003940&Paragraf=121" },
  estg27a: { titel: "Section 27a Austrian Income Tax Act 1988 (EStG) — special tax rates for investment income (RIS)", url: "https://www.ris.bka.gv.at/NormDokument.wxe?Abfrage=Bundesnormen&Gesetzesnummer=10004570&Paragraf=27a" },
  abgb1175: { titel: "Section 1175 Austrian Civil Code (ABGB) — definition of a partnership (RIS)", url: "https://www.ris.bka.gv.at/NormDokument.wxe?Abfrage=Bundesnormen&Gesetzesnummer=10001622&Paragraf=1175" },
  gewo14: { titel: "Section 14 Austrian Trade Regulation Act 1994 (GewO) — foreign persons and legal entities (RIS)", url: "https://www.ris.bka.gv.at/NormDokument.wxe?Abfrage=Bundesnormen&Gesetzesnummer=10007517&Paragraf=14" },
  eas1413: { titel: "Austrian Federal Ministry of Finance, EAS 1413 of 4 February 1999 — tax treatment of a US limited liability company (findok)", url: "https://findok.bmf.gv.at/findok/resources/pdf/1691f422-2c75-4ed3-9271-ed18e5cce2b7/30137.1.1.0.pdf" },
  eas1107: { titel: "Austrian Federal Ministry of Finance, EAS 1107 of 21 July 1997 — comparability of a Bermuda exempted company with an Austrian corporation (findok)", url: "https://findok.bmf.gv.at/findok/resources/pdf/de9ce4b1-e9eb-449c-be04-12ade25c050e/14433.1.1.0.pdf" },
  bfgTyp: { titel: "Austrian Federal Fiscal Court, RV/6100084/2013 — comparison of legal types for foreign legal entities (findok)", url: "https://findok.bmf.gv.at/findok/resources/pdf/f6dec8ad-9fb4-4ca4-b298-20611ef4c0c8/100742.pdf" },
  dbaText: { titel: "Austria–United States double taxation treaty, Federal Law Gazette III No. 6/1998 (treaty text, RIS)", url: "https://www.ris.bka.gv.at/Dokumente/BgblPdf/1998_6_3/1998_6_3.pdf" },
  dbaListe: { titel: "Austrian Federal Ministry of Finance — list of double taxation treaties (US: signed 31 May 1996, in force 1 February 1998)", url: "https://www.bmf.gv.at/themen/steuern/internationales-steuerrecht/doppelbesteuerungsabkommen/dba-liste.html" },
  ssaAustria: { titel: "U.S. Social Security Administration — Totalization Agreement with Austria (POMS)", url: "https://secure.ssa.gov/poms.nsf/lnx/0302001650" },
  famE2: { titel: "U.S. Department of State — 9 FAM 402.9, E visas and list of treaty countries", url: "https://fam.state.gov/fam/09FAM/09FAM040209.html" },
};

export const SEITE: GlobalSeite = {
  pfad: "/en/business/from-austria",
  sprache: "en",
  schwester: "/business/aus-oesterreich",
  art: "land",
  seo: {
    titel: "Forming a US company from Austria — FIAON Global",
    beschreibung: "Forming a US company from Austria: place of management, how the LLC is classified, the tax treaty and filings — explained honestly, with sources.",
  },
  stand: S,
  erschienen: S,
  kennung: "FG · 46",
  auge: "Who it is for · From Austria",
  h1: "Your US company from Austria.",
  h1b: "With everything that applies in Austria.",
  lead: "Forming a US company from Austria is legally straightforward — you do not need residence or citizenship in the US to do it. What matters is what applies in Austria afterwards: where the company is managed, how the tax office classifies the LLC and what has to be reported. Our partner tax adviser reviews this under your engagement before formation; we submit all applications in the US for you, with your power of attorney.",
  ziffern: [
    { wert: "§ 27 BAO", label: "The place of management decides on tax liability" },
    { wert: "EAS 1413", label: "Austrian Ministry of Finance: the LLC is classified case by case only" },
    { wert: "Treaty 1996", label: "Austria–US tax treaty, in force since 1 February 1998" },
  ],
  blick: [
    ["Tax liability", "Unlimited if the company is managed in Austria (section 1(2) KStG, section 27 BAO)"],
    ["Classification", "Comparison of legal types case by case — the US classification is not decisive (EAS 1413)"],
    ["Treaty", "Austria–US double taxation treaty, signed in Vienna on 31 May 1996"],
    ["Notification", "Report new circumstances to the tax office within one month (sections 120 and 121 BAO)"],
    ["Activity in Austria", "Clarify trade law and social security in advance"],
    ["With FIAON Global", "All applications for you, review before formation included in the fixed price"],
  ],
  kurz: "Anyone who lives in Austria can form a US company — without residence or citizenship in the US. If the company is managed from Austria, the centre of its overall business management lies in Austria (section 27(2) of the Austrian Federal Fiscal Code, BAO), and its profits are generally taxed in Austria — at the level of the company (section 1(2) of the Austrian Corporate Income Tax Act, KStG) or in your hands. Whether the LLC is treated like a GmbH or as transparent is decided by a comparison of legal types (Typenvergleich) in the individual case (Austrian Ministry of Finance, EAS 1413). A US company from Austria is therefore not a tax model but a way into the US market.",
  bloecke: [
    {
      typ: "text", id: "gruenden", h2: "Forming a US company from Austria: what is settled first",
      absaetze: [
        "If you want to form a US company from Austria, you need neither residence nor citizenship in the US — whether you form an LLC or a corporation. Companies are formed with a state, not with the federal government; every company needs a registered agent with an address in the state of formation, and the US tax authority, the IRS, issues the company’s tax number, the EIN. For owners without a US Social Security Number this is no obstacle: the application then says “foreign” instead of the number, and foreign applicants apply for the EIN by telephone, fax or post — " + IRS_EN.einDauer + ".",
        "The question that decides success does not arise in Wyoming, Florida or Delaware but in Austria: where is the company actually managed, how does the tax office classify the LLC, and what has to be reported? These three points belong before formation — because the operating agreement, the LLC’s company agreement, helps determine the outcome of the comparison of legal types.",
      ],
      punkte: [
        "A valid passport for each owner",
        "Recent proof of address in Austria",
        "If your GmbH is a co-founder: a recent extract from the Austrian commercial register (Firmenbuch)",
        "A short, clear description of the business in the US",
      ],
    },
    {
      typ: "text", id: "geschaeftsleitung", h2: "The place of management — where tax liability arises",
      absaetze: [
        "Under section 27(2) of the Austrian Federal Fiscal Code (BAO), the place of management is the place where the centre of the overall business management is located — where the important decisions are made. Corporate bodies with their management or registered office in Austria are subject to unlimited tax liability, on all their Austrian and foreign income (section 1(2) of the Austrian Corporate Income Tax Act, KStG). Foreign legal entities that are comparable to an Austrian legal person under private law also count as corporate bodies. Corporate income tax is 23 per cent (section 22(1) KStG); in the version that applies from 1 January 2028, the rate rises to 24 per cent for the part of income above €1 million.",
        "The double taxation treaty between Austria and the US, signed on 31 May 1996 and in force since 1 February 1998, assigns a company that counts as resident in both states to the state under whose law it was formed (Article 4(3)). That does not leave Austria out: under the treaty, the term permanent establishment includes in particular a place of management (Article 5(2)), and Austria may tax profits attributable to a permanent establishment in Austria (Article 7(1)). If the LLC is transparent for tax purposes in the US, the treaty determines its residence as it would for a partnership — by reference to its members (memorandum of understanding on Article 4).",
        "For most entrepreneurs this means: if you run your US company from a desk in Vienna, Graz or Linz, its profits are generally taxed in Austria. That is not a drawback of the US company — it simply means it is not a tax model.",
      ],
    },
    {
      typ: "text", id: "typenvergleich", h2: "How Austria taxes a US LLC: the comparison of legal types",
      absaetze: [
        "Austrian law has no LLC as a legal form. In the view of the Ministry of Finance, whether a US LLC is comparable to an Austrian corporation cannot be answered in general terms, only case by case on the basis of all the circumstances (EAS 1413 of 4 February 1999). How the company is taxed in the US — for example after an election on Form 8832 — is not decisive here. The Federal Fiscal Court puts it the same way: foreign legal entities are classified from the perspective of Austrian law.",
        "Citing the specialist literature, the Ministry of Finance lists the features of a corporation: separate legal personality, fixed share capital that does not depend on the company’s results, participation of other persons in the capital, limited liability and decision-making with the involvement of the shareholders (EAS 1107). If the LLC is comparable to a partnership, it counts as transparent: it is not the company that is taxed but its members.",
        "If the LLC belongs to you alone, it cannot correspond to a partnership, because in Austria a partnership requires two or more persons (section 1175 of the Austrian Civil Code, ABGB). It is then treated either like a corporation — or, if it lacks the features of one, not as a taxable entity in its own right, because only corporate bodies are subject to corporate income tax (section 1(1) KStG); its result is then attributed to you personally. Which features are present is determined by the company law of the state of formation and by the operating agreement.",
        "The Ministry of Finance expressly points out that, under the heightened duty to cooperate in cross-border matters, the analysis of the company’s structure has to come from you — and that classifying it without closer examination can lead to a conflict with taxation in the US (EAS 1413). That is why our partner tax adviser reviews the classification before the operating agreement is written.",
      ],
    },
    {
      typ: "tabelle", id: "ueberblick", h2: "Austria and the US: what applies where",
      lead: "The key rules on both sides, side by side — as a map for the conversation with the partner tax adviser, not as a substitute for it.",
      kopf: ["Question", "In Austria", "In the US"],
      zeilen: [
        ["Who is taxable?", "Corporate bodies with management or registered office in Austria, on all their income (section 1(2) KStG)", "An LLC without an election of its own: disregarded for tax purposes with one member, treated as a partnership with several"],
        ["How is the LLC classified?", "Comparison of legal types case by case; the US classification is not decisive (EAS 1413)", "Under US federal tax law; by election on Form 8832, as a corporation"],
        ["Tax rate of the company", "23% corporate income tax if it counts as a corporate body (section 22(1) KStG); from 2028, 24% for the part of income above €1m", `${IRS_EN.koerperschaftsteuer} federal corporate income tax if it is taxed as a corporation`],
        ["Distributions to you", "Special tax rate of 27.5% for investment income (section 27a(1) EStG); Austria credits US withholding tax under the treaty (Art. 22(3))", "If the LLC is taxed as a corporation: withholding tax under the treaty of no more than 15%; 5% if a company — your GmbH, for example — directly holds at least 10% of the voting shares (Art. 10(2))"],
        ["Several members", "If the LLC counts as transparent, the shares of profit are attributed to the members", `Form 1065 by ${FRISTEN_EN.f1065}; withholding on US business profits allocable to foreign members: ${SCHWELLEN_EN.abzug1446}`],
        ["Annual duty", "Tax return covering all income; notification of new circumstances within one month (sections 120 and 121 BAO)", `Single-member LLC: Form 5472 with Form 1120, deadline ${IRS_EN.frist5472}`],
      ],
      fuss: [
        `As of October 2026. The penalty for a missing or incomplete Form 5472 is ${IRS_EN.strafe5472}.`,
        "Whether and how these rules apply in your case is reviewed before formation by a tax adviser from our partner network who is authorised in Austria — engaged by you.",
      ],
    },
    {
      typ: "text", id: "meldungen", h2: "Reporting duties in Austria and the US",
      absaetze: [
        "In Austria, you notify the tax office of all circumstances that establish, change or end a personal liability to income tax, corporate income tax or VAT (section 120(1) BAO). Anyone who starts a commercial business or another self-employed activity reports this to the competent tax office (section 120(2) BAO) — in each case within one month of the event (section 121 BAO). The income from the US company belongs in your Austrian tax return; whether as a share of profit or as a distribution follows from the comparison of legal types.",
        `In the US, a single-member LLC with a foreign owner files Form 5472 together with Form 1120 as soon as there are transactions between it and its owner — even the contribution at formation counts, and revenue is not a requirement; the deadline is ${IRS_EN.frist5472}. If the filing is missing or incomplete, the company faces a penalty of ${IRS_EN.strafe5472}. Since August 2026, companies formed in the US no longer have to report their beneficial owners to FinCEN.`,
        "If an Austrian GmbH forms the US company, further questions arise. If the US company counts as a corporate body and the GmbH holds more than half of the voting rights or the capital, passive income of the US company — such as interest or royalties — can be attributed to the GmbH if more than one third of the US company’s income is passive, its actual tax burden abroad is below 15 per cent and it carries on no substantive economic activity (section 10a KStG).",
      ],
    },
    {
      typ: "text", id: "gewerbe", h2: "Trade law and social security: two notes",
      absaetze: [
        "If the US company itself is to operate in Austria, the Trade Regulation Act applies. Foreign legal entities that have neither a registered office nor an establishment in Austria may not carry on a trade here unless international treaties provide otherwise (section 14(4) of the Austrian Trade Regulation Act, GewO). Whether your plans require an establishment and a trade licence in Austria is clarified case by case by a lawyer — on request, one of our partner lawyers acting under your engagement — before the company operates here.",
        "An agreement on social security has been in force between Austria and the US since 1 November 1991. It ensures that the same work is insured in only one of the two systems. Where you are insured as a shareholder or managing director depends on your role and your activity — this belongs in the conversation with the tax adviser before formation.",
        "And should you later wish to help build the business in the US yourself: Austria is a treaty country for E-1 and E-2 visas, listed by the US Department of State for both since 27 May 1931. Whether the requirements are met is clarified by US immigration lawyers; the consulate alone decides on every visa.",
      ],
    },
    {
      typ: "text", id: "konto-karte", h2: "A US account and a US credit card as an Austrian",
      absaetze: [
        `For a US business account, complete documents are what matters. When an account is opened, institutions must identify every person who owns ${SCHWELLEN_EN.eigentuemer} or more of the company, plus one person who manages it; for the company itself, they require documents that prove its existence, and its tax number. As a foreign national, you can give your passport number in place of a US tax number. As a rule, the formation documents, EIN, operating agreement and passport are therefore on the table. The institution alone decides on the account.`,
        "You can also apply for a US credit card for your company from Austria; whether it is issued, and with what limit, is decided by the issuer alone. Business credit cards generally require a personal guarantee from you. For a FICO Score, your US credit file needs an account that has been open for at least six months and has been reported in the last six months. Some issuers offer introductory periods without debit interest; each issuer sets the terms itself.",
        `You submit account, card and credit applications yourself — we prepare them in full, in the ${STRUKTUR} package the first account and card application, from ${BANKING} onwards every further one, so that name, address, telephone number and documents match in every application.`,
      ],
    },
    {
      typ: "etappen", id: "ablauf", h2: "Your US company from Austria in five stages",
      lead: "The sequence is what makes it work: first comes clarity on how Austria will view the company, then the formation.",
      etappen: [
        { titel: "Review before formation", dauer: "before any application", text: "Engaged by you, a partner tax adviser authorised in Austria clarifies the place of management, the classification under the comparison of legal types and your obligations in Austria." },
        { titel: "Formation and operating agreement", dauer: "after the review", text: "Our team forms the company with the state; our partner lawyer drafts the operating agreement to match the outcome of the review." },
        { titel: "EIN, ITIN and D-U-N-S", dauer: "EIN: " + IRS_EN.einDauer, text: "We apply for the EIN, prepare the ITIN where the IRS requirements are met, and apply for the company’s D-U-N-S Number — a nine-digit identifier for businesses only, issued free of charge." },
        { titel: "Account and first card", dauer: "after the EIN", text: "We prepare the account application and the first card application in full; you have to submit both yourself. The institution alone decides on both." },
        { titel: "Filings", dauer: "annually", text: "Our US CPA files the first US return. Your tax return in Austria is handled by your tax adviser — with the review before formation as its basis." },
      ],
    },
    {
      typ: "rollen", id: "rollen", h2: "Who does what",
      lead: "One point of contact instead of eight — and clear lines on who is responsible for what.",
      fiaon: [
        "All applications with your power of attorney: formation, EIN, ITIN preparation, D-U-N-S, filings",
        "Registered agent, US business address and US phone number for the first year",
        "Account and card applications fully prepared",
        "Appointments on the ground by our team in Miami",
      ],
      partner: [
        "Partner tax adviser: review before formation, under your engagement",
        "Partner lawyer: operating agreement and formation documents",
        "US CPA: first annual US filing",
        "FIAON pays their fees for the services in the package",
      ],
      sie: [
        "Passport, proof of address and a clear description of the business",
        "Submit account, card and credit applications yourself",
        "Ongoing tax return in Austria with your tax adviser",
      ],
    },
    {
      typ: "text", id: "fiaon", h2: "How FIAON Global handles your US company from Austria",
      absaetze: [
        "One point of contact instead of eight: with your power of attorney, we submit all applications for you — the formation with the state, the EIN with the IRS, the preparation of the ITIN where its requirements are met, the D-U-N-S Number and the annual US filings. We provide the registered agent, US business address and US phone number for the first year. You submit account, card and credit applications yourself, fully prepared by us; the institution alone decides on them.",
        "Before formation, a partner tax adviser authorised in Austria, engaged by you, reviews where the place of management will be and how Austria is likely to classify your LLC under the comparison of legal types. The result goes into the operating agreement drafted by our partner lawyer. Our US CPA files the first US return — Form 5472 with Form 1120. FIAON pays these partners’ fees for the services in your package; all fees of the package are included in the fixed price.",
        `Your contracting party is ${FIAON_FIRMA.name}, based in London (Companies House ${FIAON_FIRMA.companyNo}). Our team in Miami attends appointments with authorities and institutions on the ground; our partner location is Zurich. From the second year, you can add the annual care plan if you wish — it is voluntary.`,
        ...GELD_ZURUECK,
      ],
    },
    {
      typ: "hinweis", id: "wissen", h2: "What you need to know",
      punkte: [
        "A US company is not a tax model. If it is managed from Austria, it is generally taxable in Austria — anyone who promises otherwise is leaving out the place of management.",
        GLOBAL_PFLICHTHINWEIS.en[0],
        GLOBAL_PFLICHTHINWEIS.en[1],
        GLOBAL_PFLICHTHINWEIS.en[2],
        "FIAON is not a bank, does not grant loans, does not broker loans and does not commit to any limit. The institution alone decides on the account, card, limit and loans.",
        "The review before formation is included in the fixed price; your ongoing tax return in Austria is handled by your tax adviser.",
      ],
    },
    { typ: "paket", id: "paket", h2: "The right package", lead: `Formation, tax numbers, the review before formation and the first US filing: ${STRUKTUR}.`, paket: "global_struktur" },
  ],
  fragen: [
    { f: "Can I form a US company as an Austrian?", a: "Yes, without residence or citizenship in the US. You need a valid passport and proof of address; if your GmbH is a co-founder, also its extract from the Austrian commercial register (Firmenbuch). With your power of attorney, we submit all applications in the US for you." },
    { f: "Do I have to pay tax on my US LLC in Austria?", a: "Generally yes, if you manage it from Austria: the place of management then lies in Austria (section 27(2) BAO). If the LLC counts as a corporate body, it is subject to unlimited tax liability (section 1(2) KStG); if it counts as transparent, its result is attributed to you. Our partner tax adviser reviews your case before formation." },
    { f: "How is a US LLC taxed in Austria?", a: "That depends on the comparison of legal types: if the LLC corresponds to a corporation and is managed from Austria, corporate income tax is due here; distributions to you are subject to the special rate of 27.5 per cent. If it is transparent, the profits are taxed directly in your hands. The US classification does not decide the question (EAS 1413)." },
    { f: "Do I need a residence in the US for the US LLC?", a: "No. The company needs a registered agent with an address in the state of formation; you can continue to live in Austria. The registered agent, US business address and US phone number are included in our packages for the first year." },
    { f: "Can I apply for a US credit card as an Austrian?", a: "You can apply for a US business credit card for your company from Austria too; whether it is issued, and with what limit, is decided by the issuer alone. Business credit cards generally require a personal guarantee from you. We prepare the first application in full; you have to submit it yourself." },
    { f: "Do I have to report the US company to the Austrian tax office?", a: "Generally yes. You notify the tax office of circumstances that establish or change a liability to tax, and of the start of a commercial or self-employed activity — within one month of the event (sections 120 and 121 BAO). The income belongs in your tax return." },
    { f: "May my US company operate in Austria?", a: "Foreign legal entities without a registered office or establishment in Austria may not carry on a trade here unless international treaties provide otherwise (section 14(4) GewO). Whether you need an establishment and a trade licence is clarified case by case by a lawyer — on request, one of our partner lawyers acting under your engagement." },
  ],
  paket: "global_struktur",
  weiter: ["/en/business/from-germany", "/en/business/from-switzerland", "/en/business/knowledge/us-llc-tax", "/en/business/knowledge/e2-visa-own-us-company"],
  quellen: [
    QUELLEN.bao27,
    QUELLEN.kstg1,
    QUELLEN.kstg22,
    QUELLEN.kstg22ab2028,
    QUELLEN.eas1413,
    QUELLEN.eas1107,
    QUELLEN.bfgTyp,
    QUELLEN.abgb1175,
    QUELLEN.dbaText,
    QUELLEN.dbaListe,
    QUELLEN.estg27a,
    QUELLEN.bao120,
    QUELLEN.bao121,
    QUELLEN.kstg10a,
    QUELLEN.gewo14,
    QUELLEN.ssaAustria,
    QUELLEN.famE2,
    Q.ein,
    Q.ss4,
    Q.i5472,
    Q.smllc,
    Q.f8832,
    Q.i1065,
    Q.abzug1446,
    Q.boiEnde,
    Q.cip,
    Q.cdd,
    Q.ficoMindest,
    Q.duns,
    QUELLEN_STAATEN_EN.florida[3],
    Q.delawareAgent,
  ],
};
