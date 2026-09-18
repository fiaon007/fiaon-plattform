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
