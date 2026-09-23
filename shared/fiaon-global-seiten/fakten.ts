// ═══════════════════════════════════════════════════════════════════════════
// FIAON GLOBAL — ZAHLEN DRITTER, EINMAL GEPRÜFT (19.09.2026, E-191)
//
// Jede Gebühr, Frist und Strafe, die auf den Unterseiten steht, steht HIER —
// mit Quelle und Stand. Die Seiten lesen von hier; ändert ein Staat seine
// Gebühr, ändert sie sich an einer Stelle. Geprüft am 19.09.2026 an den
// amtlichen Texten (Florida Statutes 2026, Delaware Code und Gebührenordnung
// vom 01.08.2026, Wyoming Secretary of State, IRS-Anleitungen, FinCEN).
//
// ACHTUNG, frisch geändert:
// · Delaware: Jahressteuer der LLC 300 $ → 400 $ ab Steuerjahr 2026 (HB 400,
//   unterzeichnet 21.05.2026; erstmals fällig 01.06.2027). Die Info-Seiten
//   corp.delaware.gov/frtax zeigten am 19.09.2026 noch 300 $.
// · FinCEN: In den USA gegründete Gesellschaften sind seit 14.08.2026
//   endgültig von der BOI-Meldung befreit.
// Marktspannen (Registered Agent, US-CPA, Acceptance Agent) sind veröffent-
// lichte Preise mehrerer Anbieter im September 2026 — keine amtlichen Werte.
// ═══════════════════════════════════════════════════════════════════════════
import type { GlobalQuelle } from "./typen";

export const FAKTEN_STAND = "September 2026";

export const STAAT = {
  florida: {
    gruendung: "125 $", gruendungDetail: "100 $ für die Articles of Organization und 25 $ für die Benennung des Registered Agent",
    jahr: "138,75 $", jahrName: "Annual Report", jahrFrist: "1. Januar bis 1. Mai, erstmals im Jahr nach der Gründung", jahrVerzug: "nach dem 1. Mai zusätzlich 400 $",
    steuer: "5,5 % Körperschaftsteuer des Staats für Corporations, mit einem Freibetrag von 50.000 $",
    llcSteuer: "Eine LLC, die steuerlich nicht als eigenes Steuersubjekt gilt, gibt keine eigene Florida-Erklärung ab. Gehört sie einer Kapitalgesellschaft — etwa einer GmbH —, gibt diese eine Florida-Erklärung ab (Form F-1120).",
    agent: "Pflicht, mit Anschrift in Florida",
  },
  delaware: {
    gruendung: "110 $", gruendungDetail: "Certificate of Formation",
    jahr: "400 $", jahrName: "Annual Tax der LLC", jahrFrist: "1. Juni des Folgejahres", jahrVerzug: "bei Verzug 200 $ zuzüglich 1,5 % je Monat",
    jahrAlt: "Ab dem Steuerjahr 2026 (erstmals fällig am 1. Juni 2027); bis zum Steuerjahr 2025 betrug die Steuer 300 $.",
    corp: "Corporations: Annual Report 50 $ und Franchise Tax von mindestens 175 $ (Methode nach genehmigten Anteilen) oder 400 $ (Methode nach angenommenem Nennwert), fällig am 1. März",
    agent: "Pflicht, mit Büro in Delaware",
  },
  wyoming: {
    gruendung: "100 $", gruendungDetail: "Articles of Organization, online zuzüglich Kartengebühr",
    jahr: "mindestens 60 $", jahrName: "Annual Report mit License Tax", jahrFrist: "erster Tag des Monats, in dem die Gesellschaft gegründet wurde", jahrVerzug: "nach 60 Tagen Verzug droht die Auflösung durch den Staat",
    jahrDetail: "60 $ oder 0,02 % des in Wyoming gelegenen Vermögens — der höhere Wert",
    steuer: "Wyoming erhebt keine Körperschaftsteuer und keine Einkommensteuer des Staats",
    agent: "Pflicht, mit physischer Anschrift in Wyoming",
  },
} as const;

export const IRS = {
  einDauer: "per Fax etwa vier Werktage, per Post etwa vier Wochen",
  itinDauer: "etwa sieben Wochen; zwischen Mitte Januar und Ende April sowie bei Anträgen aus dem Ausland neun bis elf Wochen",
  strafe5472: "25.000 US-Dollar je Formular und Jahr",
  frist5472: "15. April, mit Form 7004 verlängerbar bis 15. Oktober",
  koerperschaftsteuer: "21 %",
} as const;

export const MARKT = {
  agent: "meist 100 bis 300 $ im Jahr",
  cpa5472: "etwa 700 bis 2.000 $ im Jahr",
  acceptanceAgent: "etwa 150 bis 400 €",
} as const;

export const QUELLEN_STAATEN: Record<"florida" | "delaware" | "wyoming", GlobalQuelle[]> = {
  florida: [
    { titel: "Florida Statutes 2026, § 605.0213 — Gebühren", url: "https://www.flsenate.gov/Laws/Statutes/2026/605.0213" },
    { titel: "Florida Statutes 2026, § 605.0212 — Annual Report", url: "https://www.flsenate.gov/Laws/Statutes/2026/605.0212" },
    { titel: "Florida Statutes 2026, § 607.193 — Zusatzgebühr Annual Report", url: "https://www.flsenate.gov/Laws/Statutes/2026/607.193" },
    { titel: "Florida Statutes 2026, § 605.0113 — Registered Agent", url: "https://www.flsenate.gov/Laws/Statutes/2026/605.0113" },
    { titel: "Florida Department of Revenue — Corporate Income Tax", url: "https://floridarevenue.com/taxes/taxesfees/Pages/corporate.aspx" },
  ],
  delaware: [
    { titel: "Delaware Division of Corporations — Gebührenordnung August 2026", url: "https://corpfiles.delaware.gov/Fee_Schedule/AugustFee2026.pdf" },
    { titel: "Delaware Code, Title 6, Chapter 18, Subchapter XI — Annual Tax", url: "https://delcode.delaware.gov/title6/c018/sc11/index.html" },
    { titel: "Delaware Division of Corporations — Alternative Entity Tax", url: "https://corp.delaware.gov/alt-entitytaxinstructions/" },
    { titel: "Delaware Division of Corporations — Franchise Taxes", url: "https://corp.delaware.gov/paytaxes/" },
  ],
  wyoming: [
    { titel: "Wyoming Secretary of State — Gebührenordnung", url: "https://sos.wyo.gov/Business/Docs/BusinessFees.pdf" },
    { titel: "Wyoming Secretary of State — Fragen zu Unternehmen", url: "https://sos.wyo.gov/faqs.aspx?root=BUS" },
    { titel: "Wyoming Secretary of State — Annual Report", url: "https://wyobiz.wyo.gov/Business/AnnualReport.aspx" },
    { titel: "Tax Foundation — Wyoming", url: "https://taxfoundation.org/location/wyoming/" },
  ],
};

export const QUELLEN_IRS: GlobalQuelle[] = [
  { titel: "IRS — Employer Identification Number", url: "https://www.irs.gov/businesses/small-businesses-self-employed/employer-identification-number" },
  { titel: "IRS — Instructions for Form SS-4", url: "https://www.irs.gov/instructions/iss4" },
  { titel: "IRS — How to apply for an ITIN", url: "https://www.irs.gov/tin/itin/how-to-apply-for-an-itin" },
  { titel: "IRS — Instructions for Form W-7", url: "https://www.irs.gov/instructions/iw7" },
  { titel: "IRS — Instructions for Form 5472", url: "https://www.irs.gov/instructions/i5472" },
  { titel: "IRS — Instructions for Form 7004", url: "https://www.irs.gov/instructions/i7004" },
];

// ═══════════════════════════════════════════════════════════════════════════
// ZEHN PRAXIS-BEITRÄGE (23.09.2026, E-231) — Wege, Fristen und Schwellen der
// US-Behörden, geprüft am 23.09.2026 an den amtlichen Texten: Instructions for
// Form SS-4 (12/2025), W-7, 1065, 1040-NR, 1120-F, Partnership Withholding,
// FinCEN (BOI-Regel vom 11.08.2026, CDD-Ausnahme vom 13.02.2026, FBAR), FDIC,
// Regulation Z, myFICO, Dun & Bradstreet, FTC (Seek Capital, 17.11.2025).
// ═══════════════════════════════════════════════════════════════════════════
export const EIN_WEG = {
  telefon: "+1 267-941-1099",
  telefonZeit: "Montag bis Freitag von 6 bis 23 Uhr Ostküstenzeit",
  faxAusland: "+1 304-707-9471",
  post: "Internal Revenue Service, Attn: EIN International Operation, Cincinnati, OH 45999",
  zeile9a: "Foreign-owned U.S. disregarded entity-Form 5472",
} as const;

/** Fristen bei Kalenderjahr als Steuerjahr. */
export const FRISTEN = {
  f1065: "15. März",
  f1040nr: "15. Juni, wenn keine US-Löhne mit Steuerabzug bezogen werden",
  f1120f: "15. April mit Büro in den USA, sonst 15. Juni",
  fbar: "15. April, automatisch verlängert bis 15. Oktober",
} as const;

export const SCHWELLEN = {
  fbar: "10.000 US-Dollar",
  fdic: "250.000 US-Dollar",
  eigentuemer: "25 Prozent",
  abzug1446: "37 Prozent für Personen, 21 Prozent für Gesellschaften",
} as const;

export const QUELLEN_WISSEN = {
  ss4: QUELLEN_IRS[1],
  ein: QUELLEN_IRS[0],
  itin: QUELLEN_IRS[2],
  w7: QUELLEN_IRS[3],
  i5472: QUELLEN_IRS[4],
  i1120: { titel: "IRS — Instructions for Form 1120", url: "https://www.irs.gov/instructions/i1120" },
  i1065: { titel: "IRS — Instructions for Form 1065", url: "https://www.irs.gov/instructions/i1065" },
  i1040nr: { titel: "IRS — Instructions for Form 1040-NR", url: "https://www.irs.gov/instructions/i1040nr" },
  i1120f: { titel: "IRS — Instructions for Form 1120-F", url: "https://www.irs.gov/instructions/i1120f" },
  f8822b: { titel: "IRS — About Form 8822-B", url: "https://www.irs.gov/forms-pubs/about-form-8822-b" },
  f8832: { titel: "IRS — About Form 8832", url: "https://www.irs.gov/forms-pubs/about-form-8832" },
  smllc: { titel: "IRS — Single Member Limited Liability Companies", url: "https://www.irs.gov/businesses/small-businesses-self-employed/single-member-limited-liability-companies" },
  abzug1446: { titel: "IRS — Partnership Withholding", url: "https://www.irs.gov/individuals/international-taxpayers/partnership-withholding" },
  caa: { titel: "IRS — ITIN Acceptance Agent Program", url: "https://www.irs.gov/individuals/itin-acceptance-agent-program" },
  itinAusland: { titel: "IRS — Obtaining an ITIN from abroad", url: "https://www.irs.gov/individuals/international-taxpayers/obtaining-an-itin-from-abroad" },
  itinUebersicht: { titel: "IRS — Individual Taxpayer Identification Number (ITIN)", url: "https://www.irs.gov/tin/itin/individual-taxpayer-identification-number-itin" },
  boi: { titel: "FinCEN — Beneficial Ownership Information", url: "https://www.fincen.gov/boi" },
  boiEnde: { titel: "FinCEN — Ende der BOI-Meldung für US-Gesellschaften (August 2026)", url: "https://www.fincen.gov/news/news-releases/fincen-permanently-ends-beneficial-ownership-reporting-requirements-millions" },
  cip: { titel: "31 CFR 1020.220 — Customer Identification Program", url: "https://www.ecfr.gov/current/title-31/subtitle-B/chapter-X/part-1020/subpart-B/section-1020.220" },
  cdd: { titel: "31 CFR 1010.230 — Wirtschaftlich Berechtigte", url: "https://www.ecfr.gov/current/title-31/subtitle-B/chapter-X/part-1010/subpart-B/section-1010.230" },
  cddAusnahme: { titel: "FinCEN — Ausnahme zur Prüfung je Konto (13.02.2026)", url: "https://www.fincen.gov/system/files/2026-02/FinCEN-Order-CCDExceptiveRelief.pdf" },
  fdic: { titel: "FDIC — Understanding Deposit Insurance", url: "https://www.fdic.gov/resources/deposit-insurance/understanding-deposit-insurance" },
  fbar: { titel: "FinCEN — Report Foreign Bank and Financial Accounts (FBAR)", url: "https://www.fincen.gov/report-foreign-bank-and-financial-accounts" },
  ficoFaktoren: { titel: "myFICO — What's in my FICO Scores", url: "https://www.myfico.com/credit-education/whats-in-your-credit-score" },
  ficoMindest: { titel: "myFICO — Minimum requirements for a FICO Score", url: "https://www.myfico.com/credit-education/faq/scores/fico-score-requirements" },
  ftcAuskunft: { titel: "FTC — Free credit reports", url: "https://consumer.ftc.gov/articles/free-credit-reports" },
  ftcCredit: { titel: "FTC — Fixing your credit FAQs", url: "https://consumer.ftc.gov/articles/fixing-your-credit-faqs" },
  duns: { titel: "Dun & Bradstreet — D-U-N-S Number", url: "https://www.dnb.com/en-us/smb/duns.html" },
  paydex: { titel: "Dun & Bradstreet — What is a PAYDEX Score", url: "https://www.dnb.com/en-us/smb/resources/credit-scores/what-is-paydex-score.html" },
  experian: { titel: "Experian — Business credit score", url: "https://www.experian.com/small-business/business-credit-score" },
  ftcSeek: { titel: "FTC — Seek Capital and CEO permanently banned (17.11.2025)", url: "https://www.ftc.gov/news-events/news/press-releases/2025/11/seek-capital-ceo-are-permanently-banned-providing-business-financing-other-services-settle-ftc" },
  ftcSeekUrteil: { titel: "FTC v. Seek Capital — Entscheidung des Gerichts", url: "https://www.ftc.gov/system/files/ftc_gov/pdf/SeekCapital-SummaryJudgmentRuling.pdf" },
  regZ3: { titel: "12 CFR 1026.3 — Ausnahmen von Regulation Z", url: "https://www.ecfr.gov/current/title-12/chapter-X/part-1026/subpart-A/section-1026.3" },
  regZ12: { titel: "12 CFR 1026.12 — Ausgabe von Karten, Haftung bei Missbrauch", url: "https://www.ecfr.gov/current/title-12/chapter-X/part-1026/subpart-B/section-1026.12" },
  dba: { titel: "DBA Deutschland–USA mit Protokoll (Bekanntmachung 2008)", url: "https://www.bundesfinanzministerium.de/Content/DE/Standardartikel/Themen/Steuern/Internationales_Steuerrecht/Staatenbezogene_Informationen/Laender_A_Z/Verein_Staaten/2008-06-23-USA-Abkommen-DBA-Bekanntmachung.pdf?__blob=publicationFile&v=5" },
  ao138: { titel: "§ 138 AO — Anzeigen über die Erwerbstätigkeit", url: "https://www.gesetze-im-internet.de/ao_1977/__138.html" },
  astg1: { titel: "§ 1 AStG — Fremdvergleich", url: "https://www.gesetze-im-internet.de/astg/__1.html" },
  kstg8b: { titel: "§ 8b KStG — Beteiligung an anderen Körperschaften", url: "https://www.gesetze-im-internet.de/kstg_1977/__8b.html" },
  delawareAgent: { titel: "Delaware Code, Title 6, Chapter 18, Subchapter I — Registered Agent", url: "https://delcode.delaware.gov/title6/c018/sc01/index.html" },
  floridaAufloesung: { titel: "Florida Statutes 2026, § 605.0714 — Auflösung von Amts wegen", url: "https://www.flsenate.gov/Laws/Statutes/2026/605.0714" },
} as const;
