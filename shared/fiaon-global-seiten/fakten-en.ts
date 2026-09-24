// ═══════════════════════════════════════════════════════════════════════════
// FIAON GLOBAL — ZAHLEN DRITTER AUF ENGLISCH (24.09.2026, E-234)
//
// Dieselben Werte wie fakten.ts, britisches Englisch (Datum „1 May", Beträge
// „$125" und „€2,499", „per cent" im Fließtext, „%" in Tabellen). Ändert sich
// eine Gebühr, ändert sie sich in BEIDEN Dateien — scripts/pruef-global-seiten.ts
// gleicht die Ziffern beider Fassungen ab.
// Wortgrenzen wie überall in FIAON Global: kein „up to" (außer der VIP-Zahl),
// keine Frist mit Ziffer als Zusage, keine Zusage zu Konto, Karte oder Rahmen.
// ═══════════════════════════════════════════════════════════════════════════
import type { GlobalQuelle } from "./typen";
import { QUELLEN_IRS, QUELLEN_WISSEN } from "./fakten";

export const FAKTEN_STAND_EN = "September 2026";

export const STAAT_EN = {
  florida: {
    gruendung: "$125", gruendungDetail: "$100 for the Articles of Organization and $25 for designating the registered agent",
    jahr: "$138.75", jahrName: "annual report", jahrFrist: "1 January to 1 May, first in the year after formation", jahrVerzug: "after 1 May an additional $400",
    steuer: "5.5% state corporate income tax for corporations, with a $50,000 exemption",
    llcSteuer: "An LLC that is disregarded for tax purposes does not file its own Florida return. If it is owned by a corporation — a German GmbH, for instance — the owner files a Florida return (Form F-1120).",
    agent: "required, with an address in Florida",
  },
  delaware: {
    gruendung: "$110", gruendungDetail: "Certificate of Formation",
    jahr: "$400", jahrName: "annual LLC tax", jahrFrist: "1 June of the following year", jahrVerzug: "if late, $200 plus 1.5% per month",
    jahrAlt: "From tax year 2026 (first due on 1 June 2027); until tax year 2025 the tax was $300.",
    corp: "Corporations: annual report $50 and franchise tax of at least $175 (authorised shares method) or $400 (assumed par value capital method), due on 1 March",
    agent: "required, with an office in Delaware",
  },
  wyoming: {
    gruendung: "$100", gruendungDetail: "Articles of Organization, plus a card fee when filed online",
    jahr: "at least $60", jahrName: "annual report with License Tax", jahrFrist: "first day of the month in which the company was formed", jahrVerzug: "after 60 days in arrears the state may dissolve the company",
    jahrDetail: "$60 or 0.02% of the assets located in Wyoming — whichever is higher",
    steuer: "Wyoming levies no corporate income tax and no state income tax",
    agent: "required, with a physical address in Wyoming",
  },
} as const;

export const IRS_EN = {
  einDauer: "about four business days by fax, about four weeks by post",
  itinDauer: "about seven weeks; between mid-January and the end of April and for applications from abroad, nine to eleven weeks",
  strafe5472: "US$25,000 per form per year",
  frist5472: "15 April, extendable to 15 October with Form 7004",
  koerperschaftsteuer: "21%",
} as const;

export const MARKT_EN = {
  agent: "usually $100 to $300 a year",
  cpa5472: "about $700 to $2,000 a year",
  acceptanceAgent: "about €150 to €400",
} as const;

export const EIN_WEG_EN = {
  telefon: "+1 267-941-1099",
  telefonZeit: "Monday to Friday, 6 a.m. to 11 p.m. Eastern Time",
  faxAusland: "+1 304-707-9471",
  post: "Internal Revenue Service, Attn: EIN International Operation, Cincinnati, OH 45999",
  zeile9a: "Foreign-owned U.S. disregarded entity-Form 5472",
} as const;

export const FRISTEN_EN = {
  f1065: "15 March",
  f1040nr: "15 June if no US wages subject to withholding are received",
  f1120f: "15 April with an office in the US, otherwise 15 June",
  fbar: "15 April, automatically extended to 15 October",
} as const;

export const SCHWELLEN_EN = {
  fbar: "US$10,000",
  fdic: "US$250,000",
  eigentuemer: "25 per cent",
  abzug1446: "37 per cent for individuals, 21 per cent for companies",
} as const;

/** Quellen der Bundesstaaten mit englischen Titeln — dieselben Adressen wie QUELLEN_STAATEN. */
export const QUELLEN_STAATEN_EN: Record<"florida" | "delaware" | "wyoming", GlobalQuelle[]> = {
  florida: [
    { titel: "Florida Statutes 2026, § 605.0213 — fees", url: "https://www.flsenate.gov/Laws/Statutes/2026/605.0213" },
    { titel: "Florida Statutes 2026, § 605.0212 — annual report", url: "https://www.flsenate.gov/Laws/Statutes/2026/605.0212" },
    { titel: "Florida Statutes 2026, § 607.193 — supplemental annual report fee", url: "https://www.flsenate.gov/Laws/Statutes/2026/607.193" },
    { titel: "Florida Statutes 2026, § 605.0113 — registered agent", url: "https://www.flsenate.gov/Laws/Statutes/2026/605.0113" },
    { titel: "Florida Department of Revenue — Corporate Income Tax", url: "https://floridarevenue.com/taxes/taxesfees/Pages/corporate.aspx" },
  ],
  delaware: [
    { titel: "Delaware Division of Corporations — fee schedule August 2026", url: "https://corpfiles.delaware.gov/Fee_Schedule/AugustFee2026.pdf" },
    { titel: "Delaware Code, Title 6, Chapter 18, Subchapter XI — annual tax", url: "https://delcode.delaware.gov/title6/c018/sc11/index.html" },
    { titel: "Delaware Division of Corporations — Alternative Entity Tax", url: "https://corp.delaware.gov/alt-entitytaxinstructions/" },
    { titel: "Delaware Division of Corporations — Franchise Taxes", url: "https://corp.delaware.gov/paytaxes/" },
  ],
  wyoming: [
    { titel: "Wyoming Secretary of State — fee schedule", url: "https://sos.wyo.gov/Business/Docs/BusinessFees.pdf" },
    { titel: "Wyoming Secretary of State — business FAQs", url: "https://sos.wyo.gov/faqs.aspx?root=BUS" },
    { titel: "Wyoming Secretary of State — annual report", url: "https://wyobiz.wyo.gov/Business/AnnualReport.aspx" },
    { titel: "Tax Foundation — Wyoming", url: "https://taxfoundation.org/location/wyoming/" },
  ],
};

export const QUELLEN_IRS_EN: GlobalQuelle[] = QUELLEN_IRS;

/** Die Quellen der Praxis-Beiträge mit englischen Titeln, wo der deutsche Titel deutsch war. */
export const QUELLEN_WISSEN_EN = {
  ...QUELLEN_WISSEN,
  boiEnde: { titel: "FinCEN — end of BOI reporting for US companies (August 2026)", url: QUELLEN_WISSEN.boiEnde.url },
  cdd: { titel: "31 CFR 1010.230 — beneficial ownership requirements", url: QUELLEN_WISSEN.cdd.url },
  cddAusnahme: { titel: "FinCEN — exceptive relief order on account-by-account verification (13 February 2026)", url: QUELLEN_WISSEN.cddAusnahme.url },
  ftcSeekUrteil: { titel: "FTC v. Seek Capital — summary judgment ruling", url: QUELLEN_WISSEN.ftcSeekUrteil.url },
  regZ3: { titel: "12 CFR 1026.3 — exemptions from Regulation Z", url: QUELLEN_WISSEN.regZ3.url },
  regZ12: { titel: "12 CFR 1026.12 — issuance of cards, liability for unauthorised use", url: QUELLEN_WISSEN.regZ12.url },
  dba: { titel: "Germany–United States double taxation agreement with protocol (2008 publication)", url: QUELLEN_WISSEN.dba.url },
  ao138: { titel: "Section 138 German Fiscal Code (AO) — notifications about gainful activity", url: QUELLEN_WISSEN.ao138.url },
  ftcSeek: { titel: "FTC — Seek Capital and CEO permanently banned (17 November 2025)", url: QUELLEN_WISSEN.ftcSeek.url },
  astg1: { titel: "Section 1 German Foreign Tax Act (AStG) — arm's length principle", url: QUELLEN_WISSEN.astg1.url },
  kstg8b: { titel: "Section 8b German Corporate Income Tax Act (KStG) — participations in other corporations", url: QUELLEN_WISSEN.kstg8b.url },
  delawareAgent: { titel: "Delaware Code, Title 6, Chapter 18, Subchapter I — registered agent", url: QUELLEN_WISSEN.delawareAgent.url },
  floridaAufloesung: { titel: "Florida Statutes 2026, § 605.0714 — administrative dissolution", url: QUELLEN_WISSEN.floridaAufloesung.url },
} as const;

/** Die Rechtsquellen aus wissen.ts mit englischen Titeln (dieselben Adressen). */
export const QUELLEN_RECHT_EN = {
  ao10: { titel: "Section 10 German Fiscal Code (AO) — place of management", url: "https://www.gesetze-im-internet.de/ao_1977/__10.html" },
  ao138: { titel: "Section 138 German Fiscal Code (AO) — notifications about gainful activity", url: "https://www.gesetze-im-internet.de/ao_1977/__138.html" },
  kstg1: { titel: "Section 1 German Corporate Income Tax Act (KStG) — unlimited tax liability", url: "https://www.gesetze-im-internet.de/kstg_1977/__1.html" },
  bmf: { titel: "German Federal Ministry of Finance, letter of 19 March 2004 on the US LLC (KStH 2022, Annex 10)", url: "https://usth.bundesfinanzministerium.de/ksth/2022/B-Anlagen/Anlage-10/inhalt.html" },
  dbg50: { titel: "Art. 50 Swiss Federal Direct Tax Act (DBG) — personal affiliation", url: "https://www.fedlex.admin.ch/eli/cc/1991/1184_1184_1184/de#art_50" },
  astg7: { titel: "Section 7 German Foreign Tax Act (AStG) — controlled foreign company rules", url: "https://www.gesetze-im-internet.de/astg/__7.html" },
  gmbhg5: { titel: "Section 5 German Limited Liability Companies Act (GmbHG) — share capital", url: "https://www.gesetze-im-internet.de/gmbhg/__5.html" },
  i1120: { titel: "IRS — Instructions for Form 1120", url: "https://www.irs.gov/instructions/i1120" },
} as const;
