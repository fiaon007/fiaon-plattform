// ═══════════════════════════════════════════════════════════════════════════
// STEUERN & PFLICHTEN — Wissen und Formulare des Global-Portals (E-341, 12.10.2026)
//
// Zwei Teile für den Bereich „steuern“ (Typen in shared/fiaon-global-fach.ts):
//   FACH_STEUERN_KAPITEL — zehn Kapitel Steuerwissen (US-Bund, Bundesstaat,
//                          Heimatland, Alltag) für eine Florida-LLC mit einem
//                          einzigen Inhaber aus Deutschland, Österreich oder
//                          der Schweiz.
//   FACH_FORMULARE       — die US-Formulare und -Pflichten, erklärt, mit dem,
//                          was FIAON dabei vorbereitet.
//
// RAHMEN: FIAON ist keine Steuerkanzlei (StBerG). Hier steht allgemeine
// Information und Ausfüllhilfe, keine Würdigung im Einzelfall und kein
// Steuerversprechen. Jedes Kapitel führt Einzelfragen zu „Einzelfall prüfen
// lassen“ bzw. zur Steuerkanzlei des Kunden.
//
// FAKTEN: deckungsgleich mit shared/fiaon-global-seiten/fakten.ts (geprüft
// 19./23.09.2026) — Florida 138,75 $ / 400 $ Verspätung, Strafe Form 5472
// 25.000 $, Frist 15. April / 15. Oktober, BOI-Befreiung für US-Gesellschaften
// (Übergangsregel März 2025, endgültig August 2026), SS-4 Zeile 9a.
// Was FIAON übernimmt, folgt dem Vertragstext der Jahresbetreuung
// (shared/fiaon-global.ts, GLOBAL_JAHRESBETREUUNG.de.vertrag) und der Seite
// „EIN und ITIN“ (shared/fiaon-global-seiten/leistungen.ts).
//
// WORTREGELN: Jeder deutsche Satz passiert die Hauswand und die Global-Regeln
// (scripts/pruef-global-fach.ts) — kein „bis zu“, keine Frist mit Ziffer,
// kein Bankname, keine Empfehlung, kein Steuerversprechen.
// ═══════════════════════════════════════════════════════════════════════════
import type { FachKapitel, FachFormular } from "./fiaon-global-fach";

const STAND = "Stand: Oktober 2026";

const Q = {
  smllc: { titel: "IRS — Single Member Limited Liability Companies", url: "https://www.irs.gov/businesses/small-businesses-self-employed/single-member-limited-liability-companies" },
  llc: { titel: "IRS — Limited Liability Company (LLC)", url: "https://www.irs.gov/businesses/small-businesses-self-employed/limited-liability-company-llc" },
  f8832: { titel: "IRS — About Form 8832", url: "https://www.irs.gov/forms-pubs/about-form-8832" },
  i5472: { titel: "IRS — Instructions for Form 5472", url: "https://www.irs.gov/instructions/i5472" },
  f5472: { titel: "IRS — About Form 5472", url: "https://www.irs.gov/forms-pubs/about-form-5472" },
  i1120: { titel: "IRS — Instructions for Form 1120", url: "https://www.irs.gov/instructions/i1120" },
  i7004: { titel: "IRS — Instructions for Form 7004", url: "https://www.irs.gov/instructions/i7004" },
  ein: { titel: "IRS — Employer Identification Number", url: "https://www.irs.gov/businesses/small-businesses-self-employed/employer-identification-number" },
  iss4: { titel: "IRS — Instructions for Form SS-4", url: "https://www.irs.gov/instructions/iss4" },
  einVerloren: { titel: "IRS — Lost or misplaced your EIN?", url: "https://www.irs.gov/businesses/employer-identification-number" },
  itin: { titel: "IRS — How to apply for an ITIN", url: "https://www.irs.gov/tin/itin/how-to-apply-for-an-itin" },
  iw7: { titel: "IRS — Instructions for Form W-7", url: "https://www.irs.gov/instructions/iw7" },
  iw8ben: { titel: "IRS — Instructions for Form W-8BEN", url: "https://www.irs.gov/instructions/iw8ben" },
  iw8bene: { titel: "IRS — Instructions for Form W-8BEN-E", url: "https://www.irs.gov/instructions/iw8bene" },
  iw9: { titel: "IRS — Instructions for the Requester of Form W-9", url: "https://www.irs.gov/instructions/iw9" },
  f1099nec: { titel: "IRS — About Form 1099-NEC", url: "https://www.irs.gov/forms-pubs/about-form-1099-nec" },
  i1099: { titel: "IRS — Instructions for Forms 1099-MISC and 1099-NEC", url: "https://www.irs.gov/instructions/i1099mec" },
  abkommen: { titel: "IRS — United States income tax treaties A to Z", url: "https://www.irs.gov/businesses/international-businesses/united-states-income-tax-treaties-a-to-z" },
  abkommenDe: { titel: "IRS — Germany tax treaty documents", url: "https://www.irs.gov/businesses/international-businesses/germany-tax-treaty-documents" },
  abkommenAt: { titel: "IRS — Austria tax treaty documents", url: "https://www.irs.gov/businesses/international-businesses/austria-tax-treaty-documents" },
  abkommenCh: { titel: "IRS — Switzerland tax treaty documents", url: "https://www.irs.gov/businesses/international-businesses/switzerland-tax-treaty-documents" },
  boi: { titel: "FinCEN — Beneficial Ownership Information", url: "https://www.fincen.gov/boi" },
  boiEnde: { titel: "FinCEN — Ende der BOI-Meldung für US-Gesellschaften (August 2026)", url: "https://www.fincen.gov/news/news-releases/fincen-permanently-ends-beneficial-ownership-reporting-requirements-millions" },
  fbar: { titel: "FinCEN — Report Foreign Bank and Financial Accounts (FBAR)", url: "https://www.fincen.gov/report-foreign-bank-and-financial-accounts" },
  sunbiz: { titel: "Florida Department of State — Division of Corporations (Sunbiz)", url: "https://dos.fl.gov/sunbiz/" },
  sunbizAr: { titel: "Sunbiz — Annual Report online einreichen", url: "https://services.sunbiz.org/Filings/AnnualReport/FilingStart" },
  flCorp: { titel: "Florida Department of Revenue — Corporate Income Tax", url: "https://floridarevenue.com/taxes/taxesfees/Pages/corporate.aspx" },
  flSales: { titel: "Florida Department of Revenue — Sales and Use Tax", url: "https://floridarevenue.com/taxes/taxesfees/Pages/sales_tax.aspx" },
  ao10: { titel: "§ 10 AO — Geschäftsleitung", url: "https://www.gesetze-im-internet.de/ao_1977/__10.html" },
  ao12: { titel: "§ 12 AO — Betriebstätte", url: "https://www.gesetze-im-internet.de/ao_1977/__12.html" },
  ao138: { titel: "§ 138 AO — Anzeigen über die Erwerbstätigkeit", url: "https://www.gesetze-im-internet.de/ao_1977/__138.html" },
  dba: { titel: "BMF — DBA Deutschland–USA mit Protokoll (Bekanntmachung 2008)", url: "https://www.bundesfinanzministerium.de/Content/DE/Standardartikel/Themen/Steuern/Internationales_Steuerrecht/Staatenbezogene_Informationen/Laender_A_Z/Verein_Staaten/2008-06-23-USA-Abkommen-DBA-Bekanntmachung.pdf?__blob=publicationFile&v=5" },
} as const;

// ═══════════════════════════════════════════════════════════════════════════
// (A) ZEHN KAPITEL
// ═══════════════════════════════════════════════════════════════════════════
export const FACH_STEUERN_KAPITEL: FachKapitel[] = [
  // ── 1 ────────────────────────────────────────────────────────────────────
  {
    id: "steuern-us-besteuerung",
    bereich: "steuern",
    gruppe: "US-Bund",
    titel: "So wird Ihre LLC in den USA besteuert",
    kurz: "Eine LLC mit einem einzigen ausländischen Inhaber ist für die US-Bundessteuer in der Regel eine „disregarded entity“ — was das bedeutet und was nicht.",
    minuten: 4,
    abschnitte: [
      {
        titel: "Die Grundregel: steuerlich kein eigenes Subjekt",
        absaetze: [
          "Eine Limited Liability Company (LLC) ist zivilrechtlich eine eigene Gesellschaft: Sie schließt Verträge, führt ein eigenes Konto und haftet mit ihrem eigenen Vermögen. Für die US-Bundessteuer sieht die Steuerbehörde IRS das anders. Hat die LLC nur einen Inhaber und hat sie keine andere Einordnung gewählt, gilt sie als „disregarded entity“ — eine Einheit, die für die Einkommensteuer nicht als eigenes Steuersubjekt zählt.",
          "Einkünfte, Ausgaben und Vermögen der LLC werden steuerlich ihrem Inhaber zugerechnet. Gehört die LLC einer natürlichen Person, behandelt der IRS ihr Geschäft im Grundsatz wie das Geschäft dieser Person; gehört sie einer Gesellschaft, wie eine Niederlassung dieser Gesellschaft.",
        ],
        merke: "Zivilrechtlich eine eigene Gesellschaft, steuerlich in den USA im Grundsatz ein Teil des Inhabers — beides gilt gleichzeitig.",
      },
      {
        titel: "Die Wahl als Corporation",
        absaetze: [
          "Die Einordnung als disregarded entity ist der Standard, keine Pflicht. Mit Form 8832 kann eine LLC wählen, als Corporation besteuert zu werden. Dann gibt sie eine vollständige Körperschaftsteuererklärung auf Form 1120 ab und schuldet die Körperschaftsteuer des Bundes selbst. Eine solche Wahl hat Folgen in den USA und im Heimatland und lässt sich nicht beliebig wieder ändern.",
          "Dieses Kapitel beschreibt den häufigsten Fall bei FIAON Global: eine Florida-LLC mit einem einzigen Inhaber, der in Deutschland, Österreich oder der Schweiz lebt, ohne Wahl nach Form 8832.",
        ],
      },
      {
        titel: "Ausländischer Inhaber: die Sonderregel für die Meldung",
        absaetze: [
          "Für Inhaber ohne US-Steuerpflicht hätte die Grundregel eine Lücke: Die LLC wäre steuerlich unsichtbar, und der Inhaber gibt keine US-Erklärung ab. Deshalb behandelt der IRS seit dem Steuerjahr 2017 eine US-LLC in ausländischer Hand für einen bestimmten Zweck wie eine Corporation — für die Meldepflicht nach Section 6038A des Internal Revenue Code.",
          "Die LLC meldet jedes Jahr ihre Geschäfte mit dem Inhaber und mit ihm verbundenen Personen auf Form 5472, angeheftet an eine Pro-forma-Form 1120. Diese Pro-forma-Erklärung ist keine Steuererklärung im üblichen Sinn: Sie trägt im Wesentlichen Name, Anschrift und EIN der LLC und dient als Umschlag für Form 5472. Schon die Einlage bei der Gründung und Gründungskosten, die der Inhaber privat bezahlt hat, zählen nach den IRS-Anweisungen zu den meldepflichtigen Transaktionen.",
        ],
      },
      {
        titel: "Wann der Inhaber selbst in den USA erklären muss",
        absaetze: [
          "Ob auf den Gewinn der LLC US-Einkommensteuer anfällt, hängt nicht vom Gründungsort ab. Entscheidend ist, ob der Inhaber über die LLC einen Geschäftsbetrieb in den USA unterhält (trade or business) und ob Einkünfte tatsächlich damit verbunden sind (effectively connected income). Für Inhaber aus Deutschland, Österreich oder der Schweiz kommt das jeweilige Doppelbesteuerungsabkommen hinzu, das unter anderem auf eine Betriebsstätte in den USA abstellt.",
          "Liegen solche Einkünfte vor, kann der Inhaber selbst eine US-Erklärung als beschränkt Steuerpflichtiger abgeben müssen — als Person auf Form 1040-NR, als Gesellschaft auf Form 1120-F. Ob das bei Ihnen zutrifft, lässt sich nicht pauschal sagen; das gehört zur Einzelfallprüfung.",
        ],
        liste: [
          "Mitarbeiter, Büro oder Lager in den USA",
          "Vertreter in den USA, die für die LLC Verträge abschließen",
          "Grundbesitz in den USA oder Einkünfte daraus",
          "Wo die Leistungen der LLC tatsächlich erbracht werden",
        ],
      },
      {
        titel: "Was das für Sie heißt",
        absaetze: [
          "In den USA bedeutet die disregarded entity vor allem: keine eigene Körperschaftsteuer der LLC beim Bund, aber eine feste jährliche Meldepflicht. Wie die Einkünfte in Ihrem Heimatland behandelt werden, ist eine eigene Frage mit eigenen Regeln — dazu die Kapitel zu Deutschland, Österreich und der Schweiz.",
          "Eine US-LLC ist kein Steuermodell. Für die Besteuerung zählt, von wo aus sie tatsächlich geführt wird und wo ihre Leistungen entstehen, mehr als der Ort ihrer Gründung.",
        ],
      },
    ],
    umsetzen: [
      "Prüfen Sie im Dokumentenraum, ob für Ihre LLC eine Wahl nach Form 8832 vorliegt — ohne Wahl gilt sie bei einem einzigen Inhaber als disregarded entity.",
      "Halten Sie Einlagen, Entnahmen und alle Zahlungen zwischen Ihnen und der LLC von Anfang an getrennt und mit Beleg fest.",
      "Notieren Sie, ob die LLC in den USA Mitarbeiter, Räume, Lager oder Vertreter hat — diese Angaben braucht die Prüfung, ob US-Einkünfte vorliegen.",
      "Tragen Sie den 15. April als Termin für Form 5472 in Ihren Pflichtenkalender ein.",
      "Lassen Sie die Einordnung in den USA und im Heimatland vor größeren Geschäften von Ihrer Steuerkanzlei prüfen — oder nutzen Sie „Einzelfall prüfen lassen“.",
    ],
    quellen: [Q.smllc, Q.llc, Q.f8832, Q.i5472],
    stand: STAND,
  },

  // ── 2 ────────────────────────────────────────────────────────────────────
  {
    id: "steuern-form-5472",
    bereich: "steuern",
    gruppe: "US-Bund",
    titel: "Form 5472 und Pro-forma-Form 1120 — die wichtigste Pflicht",
    kurz: "Jedes Jahr meldet Ihre LLC dem IRS ihre Geldflüsse mit Ihnen als Inhaber — auch ohne Umsatz, und mit einer hohen Strafe bei Versäumnis.",
    minuten: 4,
    abschnitte: [
      {
        titel: "Wer abgeben muss",
        absaetze: [
          "Eine US-LLC mit einem einzigen ausländischen Inhaber, die als disregarded entity gilt, heißt in den IRS-Anweisungen „foreign-owned U.S. disregarded entity“. Sie gibt jedes Jahr Form 5472 ab, wenn es im Steuerjahr meldepflichtige Transaktionen mit dem Inhaber oder mit ihm verbundenen Personen gab. Auf Umsatz oder Gewinn kommt es dabei nicht an.",
          "Meldepflichtig ist nach den IRS-Anweisungen fast jeder Geldfluss zwischen Ihnen und der LLC: Einlagen und Entnahmen, Darlehen in beide Richtungen, Zahlungen für Leistungen, Mieten und Lizenzen — und auch Gründungskosten, die Sie persönlich für die LLC bezahlt haben.",
        ],
        merke: "Kein Umsatz heißt nicht: keine Meldung. Schon die Einlage bei der Gründung ist eine meldepflichtige Transaktion.",
      },
      {
        titel: "Was auf die Formulare gehört",
        absaetze: [
          "Die beiden Formulare gehören zusammen: Form 5472 enthält die Angaben, die Pro-forma-Form 1120 ist der Umschlag. Die IRS-Anweisungen zu Form 5472 beschreiben in einem eigenen Abschnitt, welche Felder eine foreign-owned U.S. disregarded entity ausfüllt.",
        ],
        liste: [
          "Pro-forma-Form 1120: Name, Anschrift und EIN der LLC, die wenigen weiteren Felder laut IRS-Anweisungen und oben der Vermerk „Foreign-owned U.S. DE“",
          "Form 5472: die LLC als meldende Gesellschaft mit EIN, Gründungsstaat und Vermögen",
          "Form 5472: der Inhaber mit Name, Anschrift, Wohnsitzland und Steuernummer des Heimatlands",
          "Form 5472: die Transaktionen des Jahres nach Art getrennt, in US-Dollar",
          "Die Unterschrift einer berechtigten Person auf Form 1120",
        ],
      },
      {
        titel: "Frist, Verlängerung, Einreichung",
        absaetze: [
          "Die Frist folgt der Form 1120: der fünfzehnte Tag des vierten Monats nach Ende des Steuerjahres, beim Kalenderjahr also der 15. April. Fällt der Tag auf ein Wochenende oder einen US-Feiertag, gilt der nächste Werktag. Mit Form 7004 verlängert sich die Abgabefrist um sechs Monate, beim Kalenderjahr auf den 15. Oktober; der Antrag muss bis zum ursprünglichen Termin eingereicht sein.",
          "Eingereicht wird nach den Anweisungen des IRS per Fax oder Post — die aktuellen Wege stehen in den Instructions for Form 5472 unter „Where to File“. Bewahren Sie den Sendebericht oder den Einlieferungsbeleg auf.",
        ],
      },
      {
        titel: "Was bei Versäumnis droht",
        absaetze: [
          "Laut IRS beträgt die Strafe für eine nicht oder nicht im Wesentlichen vollständig abgegebene Form 5472 25.000 US-Dollar je Formular und Jahr. Bleibt die Meldung nach einer Aufforderung des IRS weiter aus, können zusätzliche Strafen hinzukommen.",
          "Dieselbe Strafe kann gelten, wenn die vorgeschriebenen Aufzeichnungen fehlen. Die LLC muss deshalb das ganze Jahr über Unterlagen führen, aus denen sich die gemeldeten Transaktionen ergeben — nicht erst im April.",
        ],
      },
    ],
    umsetzen: [
      "Führen Sie für die LLC ein eigenes Geschäftskonto und trennen Sie private und geschäftliche Zahlungen konsequent.",
      "Sammeln Sie über das Jahr alle Einlagen, Entnahmen und Zahlungen zwischen Ihnen und der LLC mit Datum und Höhe in einer Liste.",
      "Bewahren Sie Belege für Gründungskosten auf, die Sie privat bezahlt haben.",
      "Klären Sie bis Anfang März, wer Form 5472 und die Pro-forma-Form 1120 erstellt — US-CPA, Steuerkanzlei oder die FIAON-Jahresbetreuung.",
      "Reichen Sie bei Bedarf Form 7004 vor dem 15. April ein.",
      "Legen Sie die unterschriebene Fassung und den Sendebericht in Ihren Dokumentenraum.",
    ],
    quellen: [Q.i5472, Q.f5472, Q.i1120, Q.i7004],
    stand: STAND,
  },

  // ── 3 ────────────────────────────────────────────────────────────────────
  {
    id: "steuern-ein-itin",
    bereich: "steuern",
    gruppe: "US-Bund",
    titel: "EIN und ITIN — wer braucht was",
    kurz: "Die EIN braucht jede LLC, die ITIN nur, wer persönlich einen steuerlichen Grund für eine US-Steuernummer hat.",
    minuten: 4,
    abschnitte: [
      {
        titel: "Die EIN: die Nummer der Gesellschaft",
        absaetze: [
          "Die Employer Identification Number (EIN) ist die Steuernummer einer US-Gesellschaft: neun Ziffern, vergeben vom IRS, ohne Gebühr. Trotz ihres Namens braucht sie nicht nur, wer Mitarbeiter beschäftigt. Institute fragen bei der Kontoeröffnung danach, US-Geschäftspartner für ihre Formulare — und eine LLC in ausländischer Hand gibt unter ihrer eigenen EIN jedes Jahr Form 5472 ab.",
        ],
      },
      {
        titel: "Der Antrag ohne SSN: Form SS-4",
        absaetze: [
          "Den Online-Antrag des IRS kann nur nutzen, wessen verantwortliche Person (responsible party) eine US-Sozialversicherungsnummer oder eine ITIN hat. Inhaber ohne diese Nummern stellen den Antrag mit Form SS-4 — per Fax oder Post, Antragsteller aus dem Ausland auch telefonisch. Für eine LLC in ausländischer Hand verlangen die SS-4-Anweisungen in Zeile 9a einen eigenen Vermerk: „Foreign-owned U.S. disregarded entity-Form 5472“.",
          "Die Bestätigung kommt als Schreiben CP 575. Geht es verloren, stellt der IRS auf Anfrage ein Ersatzschreiben aus, Letter 147C. Laut IRS dauert der Weg per Fax etwa vier Werktage, per Post etwa vier Wochen.",
        ],
      },
      {
        titel: "Die ITIN: eine persönliche Nummer — nur mit steuerlichem Grund",
        absaetze: [
          "Die Individual Taxpayer Identification Number (ITIN) erhält eine Person, die in den USA steuerlich erfasst werden muss, aber keine Sozialversicherungsnummer bekommen kann. Sie ist weder Arbeitserlaubnis noch Aufenthaltstitel, sondern allein eine Steuernummer.",
          "Nicht jeder LLC-Inhaber braucht eine ITIN. Für die EIN und für Form 5472 genügt die Nummer der Gesellschaft. Eine ITIN braucht, wer selbst eine US-Steuererklärung abgeben muss — etwa Form 1040-NR — oder wer für die Anwendung eines Doppelbesteuerungsabkommens eine US-Steuernummer angeben muss. Form W-7 fragt diesen Grund ausdrücklich ab.",
          "Manche Kartenherausgeber fragen bei der persönlichen Haftung des Inhabers nach einer US-Steuernummer. Der IRS vergibt die ITIN aber nur für steuerliche Zwecke; ein Kartenantrag allein ist kein Grund, den Form W-7 vorsieht.",
        ],
      },
      {
        titel: "Wie der ITIN-Antrag läuft",
        absaetze: [
          "Form W-7 wird in der Regel zusammen mit der US-Steuererklärung eingereicht, für die die Nummer gebraucht wird; ohne Erklärung nur, wenn eine der Ausnahmen aus den W-7-Anweisungen greift. Als Identitätsnachweis dient meist der Reisepass — im Original, als beglaubigte Kopie der ausstellenden Behörde oder geprüft durch einen Certifying Acceptance Agent, der den Pass im Termin sieht. Dann bleibt das Original bei Ihnen.",
          "Eine ITIN verfällt laut IRS, wenn sie drei Jahre hintereinander auf keiner US-Bundessteuererklärung verwendet wurde.",
        ],
        merke: "EIN: immer, für die Gesellschaft. ITIN: nur mit steuerlichem Grund, für Sie persönlich.",
      },
    ],
    umsetzen: [
      "Prüfen Sie im Dokumentenraum, ob das EIN-Schreiben Ihrer LLC (CP 575 oder Letter 147C) vorliegt.",
      "Vergleichen Sie Name und Anschrift der LLC auf dem EIN-Schreiben mit den Gründungsunterlagen.",
      "Melden Sie eine neue Anschrift oder eine neue verantwortliche Person dem IRS mit Form 8822-B.",
      "Klären Sie vor einem ITIN-Antrag mit Ihrer Steuerkanzlei oder über „Einzelfall prüfen lassen“, welcher steuerliche Grund bei Ihnen vorliegt.",
      "Halten Sie Ihren Reisepass gültig — ein ITIN-Antrag braucht ihn als Nachweis.",
    ],
    quellen: [Q.ein, Q.iss4, Q.einVerloren, Q.itin, Q.iw7],
    stand: STAND,
  },

  // ── 4 ────────────────────────────────────────────────────────────────────
  {
    id: "steuern-w-formulare",
    bereich: "steuern",
    gruppe: "Alltag",
    titel: "W-8BEN, W-8BEN-E, W-9 — welches Formular wann",
    kurz: "Wenn eine US-Stelle nach Ihrem Steuerstatus fragt: Bei einer Einzel-LLC füllt in der Regel der Inhaber aus, nicht die LLC.",
    minuten: 4,
    abschnitte: [
      {
        titel: "Wozu die Formulare dienen",
        absaetze: [
          "US-Zahlstellen — Kunden, Plattformen, Zahlungsdienstleister, Institute — müssen wissen, ob ihr Zahlungsempfänger eine US-Person ist. Davon hängt ab, ob sie Zahlungen dem IRS melden und ob sie Steuer einbehalten müssen. Die Antwort geben die W-Formulare. Sie gehen nicht an den IRS, sondern an die Stelle, die danach fragt.",
        ],
      },
      {
        titel: "Form W-9: für US-Personen",
        absaetze: [
          "W-9 ist das Formular für US-Personen: US-Staatsbürger, in den USA steuerlich Ansässige und US-Gesellschaften, die selbst Steuersubjekt sind. Die IRS-Anweisungen zu W-9 sind an dieser Stelle deutlich: Gehört eine disregarded entity einer ausländischen Person, gibt nicht die LLC eine W-9 ab, sondern der ausländische Inhaber das passende Formular W-8 — auch dann, wenn er eine US-Steuernummer hat.",
          "Ihre LLC braucht W-9 vor allem in der anderen Richtung: von den US-Dienstleistern, die sie bezahlt (dazu das Kapitel zu Form 1099-NEC).",
        ],
      },
      {
        titel: "Form W-8BEN: der Regelfall bei einer Einzel-LLC",
        absaetze: [
          "W-8BEN ist das Formular für ausländische natürliche Personen. Weil die LLC als disregarded entity steuerlich Ihnen zugerechnet wird, sind Sie als Inhaber für die Zahlstelle in der Regel der wirtschaftlich Berechtigte (beneficial owner). Sie füllen W-8BEN deshalb auf Ihren eigenen Namen aus: Name, Staatsangehörigkeit, Wohnsitzanschrift, die Steuernummer Ihres Wohnsitzlandes — in Deutschland die Steuer-Identifikationsnummer — und gegebenenfalls die Angaben zum Doppelbesteuerungsabkommen.",
          "Ein W-8BEN gilt in der Regel bis zum Ende des dritten Kalenderjahres nach dem Jahr der Unterschrift. Ändern sich Ihre Angaben, etwa durch einen Umzug in ein anderes Land, ist ein neues Formular fällig.",
        ],
      },
      {
        titel: "Form W-8BEN-E: wenn eine Gesellschaft der Empfänger ist",
        absaetze: [
          "W-8BEN-E ist das Gegenstück für ausländische Gesellschaften, etwa eine GmbH oder AG, mit zusätzlichen Angaben nach FATCA. Gehört Ihre US-LLC einer solchen Gesellschaft, gibt in der Regel diese Gesellschaft als Inhaberin W-8BEN-E ab.",
          "Die LLC selbst gibt als disregarded entity in der Regel kein eigenes W-8BEN-E ab; die IRS-Anweisungen nennen dafür nur eng gefasste Sonderfälle. Wenn eine Zahlstelle dennoch ein W-8BEN-E der LLC verlangt, lohnt die Rückfrage, wer als Empfänger gemeint ist.",
        ],
        merke: "Der Inhaber füllt aus, nicht die LLC — als Person W-8BEN, als Gesellschaft W-8BEN-E. W-9 ist für US-Personen.",
      },
    ],
    umsetzen: [
      "Fragen Sie bei jeder US-Stelle, die ein W-Formular verlangt, wer als Zahlungsempfänger gemeint ist — die LLC als Kontoinhaberin oder Sie als Inhaber.",
      "Halten Sie die Steuernummer Ihres Wohnsitzlandes bereit, in Deutschland die Steuer-Identifikationsnummer.",
      "Füllen Sie W-8BEN auf Ihren Namen aus und tragen Sie die LLC nur dort ein, wo die Zahlstelle oder die IRS-Anweisungen es vorsehen.",
      "Lassen Sie Angaben zum Doppelbesteuerungsabkommen im Formular von Ihrer Steuerkanzlei prüfen.",
      "Notieren Sie das Unterschriftsdatum jedes W-8BEN im Pflichtenkalender.",
      "Geben Sie bei einem Umzug in ein anderes Land allen Zahlstellen ein neues Formular.",
    ],
    quellen: [Q.iw8ben, Q.iw8bene, Q.iw9],
    stand: STAND,
  },

  // ── 5 ────────────────────────────────────────────────────────────────────
  {
    id: "steuern-florida",
    bereich: "steuern",
    gruppe: "Bundesstaat",
    titel: "Florida: Annual Report, Sales Tax, Corporate Income Tax",
    kurz: "Was der Bundesstaat Florida von Ihrer LLC verlangt — jedes Jahr der Annual Report, die Steuern nur in bestimmten Fällen.",
    minuten: 4,
    abschnitte: [
      {
        titel: "Der Annual Report: jedes Jahr, auch ohne Umsatz",
        absaetze: [
          "Jede Florida-LLC reicht jedes Jahr beim Florida Department of State, Division of Corporations („Sunbiz“), einen Annual Report ein — erstmals im Jahr nach der Gründung, jeweils zwischen dem 1. Januar und dem 1. Mai. Der Bericht bestätigt oder aktualisiert die Angaben im Register: Hauptanschrift, Postanschrift, Registered Agent und die vertretungsberechtigten Personen. Eingereicht wird online auf sunbiz.org.",
          "Die Gebühr für eine LLC beträgt laut Sunbiz 138,75 US-Dollar. Wer nach dem 1. Mai einreicht, zahlt laut Sunbiz zusätzlich 400 US-Dollar Verspätungsgebühr. Bleibt der Bericht ganz aus, löst der Staat die LLC von Amts wegen auf (administrative dissolution); sie verliert damit ihren aktiven Status. Eine Wiederherstellung (reinstatement) ist möglich, kostet aber zusätzlich.",
          "Der Annual Report ist keine Steuererklärung — er enthält weder Umsätze noch Gewinne.",
        ],
        merke: "Annual Report zwischen 1. Januar und 1. Mai — jedes Jahr, auch ohne Umsatz.",
      },
      {
        titel: "Keine Einkommensteuer für Personen, eine Steuer für Corporations",
        absaetze: [
          "Florida erhebt keine Einkommensteuer auf das Einkommen natürlicher Personen. Eine Körperschaftsteuer des Staats gibt es dagegen: die Florida Corporate Income Tax, laut Florida Department of Revenue mit 5,5 Prozent und einem Freibetrag.",
          "Sie betrifft Gesellschaften, die als Corporation besteuert werden. Eine LLC mit einem einzigen Inhaber, die als disregarded entity gilt, gibt in der Regel keine eigene Florida-Erklärung ab. Gehört sie einer Kapitalgesellschaft, etwa einer GmbH, kann diese Inhaberin in Florida erklärungspflichtig sein (Form F-1120). Hat die LLC per Form 8832 die Besteuerung als Corporation gewählt, gilt die Pflicht für sie selbst.",
        ],
      },
      {
        titel: "Sales Tax: nur, wenn steuerpflichtig verkauft wird",
        absaetze: [
          "Florida erhebt eine Umsatzsteuer auf den Verkauf und die Vermietung von Waren und bestimmten Dienstleistungen (Sales and Use Tax). Der Satz des Staats liegt laut Florida Department of Revenue bei 6 Prozent; viele Countys erheben einen Zuschlag (discretionary sales surtax).",
          "Wer in Florida steuerpflichtig verkauft oder vermietet, registriert sich vor dem ersten Verkauf beim Florida Department of Revenue, berechnet die Steuer, führt sie ab und erklärt sie regelmäßig. Auch Händler ohne Sitz in Florida können registrierungspflichtig werden, wenn ihre steuerpflichtigen Fernverkäufe nach Florida im Vorjahr eine Schwelle überschreiten, die das Department of Revenue nennt.",
          "Ob eine Leistung in Florida steuerpflichtig ist, regelt das Recht des Staats im Einzelnen. Eine LLC, die nichts an Kunden in Florida verkauft, ist in der Regel nicht betroffen — die Prüfung gehört trotzdem an den Anfang.",
        ],
      },
      {
        titel: "Mitarbeiter in Florida",
        absaetze: [
          "Beschäftigt die LLC Mitarbeiter in Florida, kommen weitere Pflichten hinzu, unter anderem die Reemployment Tax des Staats und die Lohnsteuer des Bundes. Das gehört in jedem Fall in die Einzelfallprüfung.",
        ],
      },
    ],
    umsetzen: [
      "Tragen Sie den 1. Mai als letzten Tag ohne Verspätungsgebühr in Ihren Pflichtenkalender ein.",
      "Prüfen Sie vor dem Annual Report im Register auf sunbiz.org, ob Anschrift, Registered Agent und Vertretungsberechtigte stimmen.",
      "Klären Sie, ob Ihre LLC an Kunden in Florida steuerpflichtige Waren oder Leistungen verkauft — falls ja, registrieren Sie sich vor dem ersten Verkauf.",
      "Klären Sie, ob Ihre LLC einer Kapitalgesellschaft gehört oder eine Wahl nach Form 8832 getroffen hat — dann kann die Corporate Income Tax eine Rolle spielen.",
      "Legen Sie die Eingangsbestätigung des Annual Report im Dokumentenraum ab.",
    ],
    quellen: [Q.sunbiz, Q.sunbizAr, Q.flCorp, Q.flSales],
    stand: STAND,
  },

  // ── 6 ────────────────────────────────────────────────────────────────────
  {
    id: "steuern-boi",
    bereich: "steuern",
    gruppe: "US-Bund",
    titel: "BOI-Meldung: warum Ihre Florida-LLC nicht meldet",
    kurz: "In den USA gegründete Gesellschaften sind von der Meldung ihrer wirtschaftlich Berechtigten an FinCEN ausgenommen — eine Florida-LLC gehört dazu.",
    minuten: 3,
    abschnitte: [
      {
        titel: "Was die BOI-Meldung war",
        absaetze: [
          "Mit dem Corporate Transparency Act sollte jede US-Gesellschaft der Behörde FinCEN (Financial Crimes Enforcement Network) ihre wirtschaftlich Berechtigten melden — Beneficial Ownership Information, kurz BOI. Die Pflicht sollte ab 2024 für neue und bestehende Gesellschaften gelten und hat viele Gründer verunsichert.",
        ],
      },
      {
        titel: "Was heute gilt",
        absaetze: [
          "Mit einer Übergangsregel (interim final rule) vom März 2025 hat FinCEN Gesellschaften, die in den USA gegründet wurden, von der Meldepflicht ausgenommen. Laut FinCEN gilt diese Ausnahme seit August 2026 endgültig. Meldepflichtig bleiben nur Gesellschaften ausländischen Rechts, die sich bei einem Bundesstaat für Geschäfte in den USA registriert haben — etwa eine GmbH mit registrierter Niederlassung.",
          "Eine LLC, die in Florida gegründet wurde, ist eine inländische Gesellschaft. Sie gibt deshalb keine BOI-Meldung ab — unabhängig davon, wo ihr Inhaber wohnt.",
          "Auch für die Gesellschaften, die weiter melden, hat FinCEN die Meldung verkleinert: Wirtschaftlich Berechtigte, die US-Personen sind, müssen sie nach der Übergangsregel nicht angeben.",
        ],
        merke: "In Florida gegründet heißt: in den USA gegründet — und damit keine BOI-Meldung.",
      },
      {
        titel: "Vorsicht bei Schreiben mit Gebühr",
        absaetze: [
          "Bis heute kursieren Schreiben und Mails, die für eine BOI-Meldung Gebühren verlangen oder mit Strafen drohen. FinCEN hat vor solchen Schreiben gewarnt und verlangt für die Meldung selbst keine Gebühr. Prüfen Sie jeden solchen Hinweis an der Seite von FinCEN, bevor Sie zahlen oder Daten herausgeben.",
          "Dazu kommt veraltetes Material: Viele Checklisten, Artikel und Angebote aus dem Jahr 2024 beschreiben die BOI-Meldung noch als Pflicht für jede LLC. Maßgeblich ist allein der aktuelle Stand auf der Seite von FinCEN.",
        ],
      },
      {
        titel: "Was unberührt bleibt",
        absaetze: [
          "Die Ausnahme betrifft nur die Meldung an FinCEN. Institute prüfen bei der Kontoeröffnung weiterhin, wer hinter einer Gesellschaft steht — das ist eine eigene Pflicht der Institute, unabhängig von der BOI-Regel. Auch alle Steuerpflichten bleiben bestehen: Form 5472, Annual Report in Florida und die Pflichten im Heimatland.",
        ],
      },
    ],
    umsetzen: [
      "Prüfen Sie den Gründungsstaat Ihrer Gesellschaft in der Gründungsurkunde — in den USA gegründet heißt: keine BOI-Meldung.",
      "Zahlen Sie keine Gebühr für eine BOI-Meldung, bevor Sie den Absender eines Schreibens geprüft haben.",
      "Geben Sie verdächtige Schreiben über „Einzelfall prüfen lassen“ an FIAON.",
      "Halten Sie die Angaben zu den wirtschaftlich Berechtigten für Institute trotzdem aktuell.",
      "Lassen Sie die Pflicht prüfen, falls eine Gesellschaft ausländischen Rechts zu Ihrer Struktur gehört und in einem Bundesstaat registriert ist.",
    ],
    quellen: [Q.boi, Q.boiEnde],
    stand: STAND,
  },

  // ── 7 ────────────────────────────────────────────────────────────────────
  {
    id: "steuern-1099-nec",
    bereich: "steuern",
    gruppe: "Alltag",
    titel: "Zahlungen an US-Dienstleister: Form 1099-NEC",
    kurz: "Wer in den USA selbständige Dienstleister bezahlt, meldet diese Zahlungen über einer Jahresschwelle — Grundlage ist die W-9 des Empfängers.",
    minuten: 4,
    abschnitte: [
      {
        titel: "Worum es geht",
        absaetze: [
          "Wer in den USA im Rahmen seines Geschäfts Dienstleister bezahlt, die keine Angestellten sind — Freiberufler, Einzelunternehmer, Personengesellschaften, Anwälte —, meldet diese Zahlungen dem IRS und dem Empfänger auf Form 1099-NEC (nonemployee compensation). Andere Zahlungsarten, etwa Mieten, gehören auf Form 1099-MISC.",
        ],
      },
      {
        titel: "Die W-9 vor der ersten Zahlung",
        absaetze: [
          "Damit gemeldet werden kann, braucht die zahlende Stelle Name, Anschrift und Steuernummer des Dienstleisters. Dafür fragt sie vor der ersten Zahlung eine Form W-9 ab. Aus der W-9 ergibt sich auch, ob der Empfänger eine Corporation ist — Zahlungen an Corporations sind in vielen Fällen nicht meldepflichtig, Zahlungen an Anwälte dagegen in der Regel schon.",
          "Liefert ein Dienstleister keine Steuernummer, kann die zahlende Stelle verpflichtet sein, einen Teil der Zahlung einzubehalten und an den IRS abzuführen (backup withholding). Die W-9 vorher abzufragen, vermeidet diese Lage.",
        ],
      },
      {
        titel: "Schwelle, Frist, Einreichung",
        absaetze: [
          "Meldepflichtig sind Zahlungen ab einer Jahresschwelle je Empfänger. Sie lag lange bei 600 US-Dollar; für Zahlungen ab dem 1. Januar 2026 hat der US-Gesetzgeber sie auf 2.000 US-Dollar angehoben. Den für Ihr Jahr geltenden Wert nennen die IRS-Anweisungen zu Form 1099-NEC.",
          "Form 1099-NEC geht bis 31. Januar des Folgejahres an den Empfänger und an den IRS. Wer im Jahr insgesamt zehn oder mehr Informationsmeldungen abgibt, muss laut IRS elektronisch einreichen; der IRS bietet dafür das Portal IRIS.",
        ],
      },
      {
        titel: "Die Besonderheiten Ihrer LLC",
        absaetze: [
          "Ob eine LLC in ausländischer Hand 1099-Formulare abgeben muss, hängt davon ab, wie ihre Tätigkeit und die einzelne Zahlung einzuordnen sind; die Regeln für ausländische Zahlende sind verwickelt. Das gehört in die Einzelfallprüfung.",
          "Zwei Abgrenzungen gelten allgemein: Zahlungen an Dienstleister außerhalb der USA gehören nicht auf Form 1099-NEC; für sie gelten eigene Regeln. Und Zahlungen per Kreditkarte oder über Zahlungsplattformen meldet in der Regel der Zahlungsabwickler auf Form 1099-K, nicht die zahlende LLC.",
        ],
        merke: "Erst die W-9, dann die Zahlung — so liegen im Januar alle Angaben für Form 1099-NEC vor.",
      },
    ],
    umsetzen: [
      "Fordern Sie von jedem US-Dienstleister vor der ersten Zahlung eine ausgefüllte Form W-9 an und legen Sie sie im Dokumentenraum ab.",
      "Führen Sie je Dienstleister eine Jahressumme der Zahlungen, getrennt nach Zahlungsweg.",
      "Prüfen Sie im Dezember, welche Empfänger die Schwelle für Ihr Jahr überschreiten.",
      "Klären Sie mit Ihrer Steuerkanzlei oder Ihrem US-CPA, ob Ihre LLC als Zahlende meldet.",
      "Reichen Sie Form 1099-NEC bis 31. Januar ein und geben Sie dem Empfänger seine Ausfertigung.",
    ],
    quellen: [Q.f1099nec, Q.i1099, Q.iw9],
    stand: STAND,
  },

  // ── 8 ────────────────────────────────────────────────────────────────────
  {
    id: "steuern-deutschland",
    bereich: "steuern",
    gruppe: "Heimatland",
    titel: "Deutschland: wie die LLC beim Finanzamt ankommt",
    kurz: "Typenvergleich, Doppelbesteuerungsabkommen, Ort der Geschäftsleitung und die Anzeige nach § 138 AO — die Fragen, die das Finanzamt stellt.",
    minuten: 5,
    abschnitte: [
      {
        titel: "Zwei Länder, zwei Sichtweisen",
        absaetze: [
          "Wie der IRS Ihre LLC einordnet, bindet das deutsche Finanzamt nicht. Deutschland ordnet ausländische Gesellschaften nach eigenen Regeln ein und vergleicht sie mit deutschen Rechtsformen (Typenvergleich). Maßgeblich sind die rechtliche Gestalt der LLC und vor allem ihr Operating Agreement — nicht die Einordnung als disregarded entity in den USA und nicht eine Wahl nach Form 8832.",
          "Die Finanzverwaltung hat die Merkmale in einem Schreiben des Bundesministeriums der Finanzen vom 19. März 2004 zur US-LLC beschrieben. Dazu zählen unter anderem: wer die Geschäfte führt, wie die Haftung geregelt ist, ob Anteile frei übertragbar sind, wie Gewinne zugeteilt und verteilt werden und ob die Gesellschaft auf unbestimmte Zeit besteht.",
        ],
      },
      {
        titel: "Zwei mögliche Ergebnisse",
        absaetze: [
          "Bei einer LLC mit einem einzigen Inhaber und einem schlanken Operating Agreement kommt die transparente Einordnung häufig vor; feststehend ist sie nicht. Das Ergebnis hängt vom Vertrag ab und gehört an den Anfang der Planung, nicht ans Ende.",
        ],
        liste: [
          "Die LLC entspricht einer Kapitalgesellschaft: Sie ist ein eigenes Steuersubjekt; Ausschüttungen werden bei Ihnen besteuert, und je nach Art der Einkünfte kann die Hinzurechnungsbesteuerung nach dem Außensteuergesetz eine Rolle spielen.",
          "Die LLC ist steuerlich transparent, vergleichbar einer Personengesellschaft oder einem eigenen Betrieb des Inhabers: Ihre Gewinne werden Ihnen unmittelbar zugerechnet, unabhängig davon, ob sie ausgeschüttet werden.",
        ],
      },
      {
        titel: "Das Doppelbesteuerungsabkommen",
        absaetze: [
          "Zwischen Deutschland und den USA gilt ein Doppelbesteuerungsabkommen (DBA), zuletzt geändert durch ein Protokoll von 2006. Es regelt, welcher Staat welche Einkünfte besteuern darf und wie eine doppelte Besteuerung vermieden wird. Unternehmensgewinne darf grundsätzlich der Staat besteuern, in dem das Unternehmen ansässig ist — es sei denn, es unterhält eine Betriebsstätte im anderen Staat. Für Gesellschaften, die ein Staat als transparent und der andere als eigenes Steuersubjekt behandelt, enthält das Abkommen eigene Regeln.",
        ],
      },
      {
        titel: "Ort der Geschäftsleitung und Betriebsstätte",
        absaetze: [
          "Für die Besteuerung zählt oft nicht, wo die LLC gegründet wurde, sondern von wo aus sie geführt wird. Geschäftsleitung ist nach § 10 der Abgabenordnung (AO) der Mittelpunkt der geschäftlichen Oberleitung — der Ort, an dem die wichtigen Entscheidungen fallen. Trifft der Inhaber sie in seinem Büro in Deutschland, kann die LLC dort ihre Geschäftsleitung haben; eine Stätte der Geschäftsleitung ist nach § 12 AO zugleich eine Betriebsstätte.",
          "Je nach Einordnung hat das unterschiedliche Folgen: Eine als Kapitalgesellschaft eingeordnete LLC mit Geschäftsleitung in Deutschland kann hier unbeschränkt körperschaftsteuerpflichtig sein; bei einer transparenten LLC werden die Gewinne der deutschen Betriebsstätte in Deutschland besteuert. In beiden Fällen kann Gewerbesteuer hinzukommen.",
        ],
        merke: "Eine US-LLC ist kein Steuermodell. Wird sie aus Deutschland geführt, ist sie in der Regel in Deutschland steuerpflichtig.",
      },
      {
        titel: "Die Anzeige nach § 138 Abs. 2 AO",
        absaetze: [
          "Wer in Deutschland wohnt, teilt dem Finanzamt bestimmte Auslandsbeziehungen mit — unter anderem die Gründung oder den Erwerb von Betrieben und Betriebsstätten im Ausland, Beteiligungen an ausländischen Personengesellschaften, bestimmte Beteiligungen an ausländischen Körperschaften und einen beherrschenden Einfluss auf eine Gesellschaft in einem Drittstaat wie den USA.",
          "Die Mitteilung geht zusammen mit der Steuererklärung für das Jahr ein, in dem der Vorgang stattfand, elektronisch auf dem amtlichen Weg. Form und Frist im Einzelnen nennt Ihre Steuerkanzlei. Ein Versäumnis kann mit einem Bußgeld geahndet werden.",
        ],
      },
    ],
    umsetzen: [
      "Legen Sie Ihrer Steuerkanzlei Operating Agreement, Gründungsurkunde und EIN-Schreiben vor — daran macht sie den Typenvergleich fest.",
      "Klären Sie die Einordnung möglichst vor der Gründung oder vor Änderungen am Operating Agreement.",
      "Dokumentieren Sie, wo und von wem die wichtigen Entscheidungen der LLC getroffen werden.",
      "Lassen Sie die Mitteilung nach § 138 Abs. 2 AO mit der Einkommensteuererklärung für das Gründungsjahr abgeben.",
      "Geben Sie Ihrer Steuerkanzlei jedes Jahr die Unterlagen zu Form 5472 — Einlagen, Entnahmen und Zahlungen sind dieselben Zahlen.",
      "Nutzen Sie „Einzelfall prüfen lassen“, wenn Ihre Steuerkanzlei noch nicht mit US-Gesellschaften gearbeitet hat.",
    ],
    quellen: [Q.ao138, Q.ao10, Q.ao12, Q.dba, Q.abkommenDe],
    stand: STAND,
  },

  // ── 9 ────────────────────────────────────────────────────────────────────
  {
    id: "steuern-oesterreich-schweiz",
    bereich: "steuern",
    gruppe: "Heimatland",
    titel: "Österreich und Schweiz: die gleichen Fragen, andere Stellen",
    kurz: "Für Inhaber in Österreich und der Schweiz gelten dieselben US-Pflichten; Einordnung und Meldungen zu Hause folgen dem Recht des Wohnsitzlandes.",
    minuten: 3,
    abschnitte: [
      {
        titel: "Die Fragen sind dieselben",
        absaetze: [
          "Für Inhaber in Österreich oder der Schweiz gelten die US-Pflichten aus den vorigen Kapiteln genauso: Form 5472 mit Pro-forma-Form 1120, Annual Report in Florida, W-8BEN gegenüber US-Zahlstellen. Unterschiedlich ist, wie das Wohnsitzland die LLC einordnet und welche Meldungen es verlangt. Vier Fragen stellen sich in jedem der drei Länder:",
        ],
        liste: [
          "Wie ordnet das Wohnsitzland die LLC ein — als eigenes Steuersubjekt oder als transparent?",
          "Wo liegt der Ort der Geschäftsleitung, und hat die LLC eine Betriebsstätte im Wohnsitzland?",
          "Was regelt das Doppelbesteuerungsabkommen mit den USA für Ihre Einkünfte?",
          "Welche Anzeigen, Erklärungen und Verzeichnisse verlangt das Wohnsitzland?",
        ],
      },
      {
        titel: "Österreich",
        absaetze: [
          "Auch Österreich ordnet ausländische Gesellschaften durch einen Typenvergleich mit inländischen Rechtsformen ein; die US-Einordnung ist dafür nicht maßgeblich. Zwischen Österreich und den USA gilt ein eigenes Doppelbesteuerungsabkommen. Wird die LLC aus Österreich geführt, stellt sich die Frage nach dem Ort der Geschäftsleitung wie in Deutschland. Welche Anzeige- und Erklärungspflichten gegenüber dem Finanzamt Österreich entstehen, klärt eine österreichische Steuerkanzlei.",
        ],
      },
      {
        titel: "Schweiz",
        absaetze: [
          "In der Schweiz kommen zur direkten Bundessteuer die Steuern von Kanton und Gemeinde hinzu; die Regeln unterscheiden sich je nach Kanton. Auch hier ist entscheidend, wie die Steuerverwaltung die LLC einordnet und von wo aus sie geführt wird. Zwischen der Schweiz und den USA gilt ein Doppelbesteuerungsabkommen.",
          "Die Beteiligung an der LLC gehört in der Regel in die Steuererklärung, etwa in das Wertschriftenverzeichnis; wie Einkünfte und Vermögen der LLC dort erfasst werden, hängt von der Einordnung ab.",
        ],
      },
      {
        titel: "Was Ihre Steuerkanzlei vor Ort braucht",
        absaetze: [
          "Die Würdigung im Wohnsitzland gehört in die Hand einer Steuerkanzlei vor Ort. Am meisten hilft ihr ein vollständiger Satz Unterlagen: Gründungsurkunde, Operating Agreement, EIN-Schreiben, die letzte Form 5472 und eine Aufstellung der Geldflüsse zwischen Ihnen und der LLC. All das liegt in Ihrem Dokumentenraum.",
        ],
        merke: "Andere Stellen, gleiche Grundfragen: Einordnung, Ort der Geschäftsleitung, Abkommen, Meldungen.",
      },
    ],
    umsetzen: [
      "Suchen Sie eine Steuerkanzlei in Ihrem Wohnsitzland, die mit US-Gesellschaften arbeitet, oder nutzen Sie „Einzelfall prüfen lassen“.",
      "Laden Sie Gründungsurkunde, Operating Agreement und EIN-Schreiben aus dem Dokumentenraum herunter und geben Sie sie Ihrer Steuerkanzlei.",
      "Klären Sie die Einordnung der LLC vor der ersten Steuererklärung nach der Gründung.",
      "Halten Sie fest, von wo aus Sie die LLC führen und wo die wichtigen Entscheidungen fallen.",
      "Fragen Sie Ihre Steuerkanzlei, welche Anzeigen und Verzeichnisse Ihr Wohnsitzland verlangt, und tragen Sie die Termine in den Pflichtenkalender ein.",
    ],
    quellen: [Q.abkommen, Q.abkommenAt, Q.abkommenCh],
    stand: STAND,
  },

  // ── 10 ───────────────────────────────────────────────────────────────────
  {
    id: "steuern-kalender",
    bereich: "steuern",
    gruppe: "Alltag",
    titel: "Der Steuerkalender Ihrer LLC über das Jahr",
    kurz: "Die wiederkehrenden Termine einer Florida-LLC mit ausländischem Inhaber — von Januar bis Dezember auf einen Blick.",
    minuten: 4,
    abschnitte: [
      {
        absaetze: [
          "Die meisten Pflichten Ihrer LLC kehren jedes Jahr zum selben Termin wieder. Der Überblick gilt für eine Florida-LLC mit einem einzigen ausländischen Inhaber und dem Kalenderjahr als Steuerjahr. Fällt ein US-Termin auf ein Wochenende oder einen Feiertag, gilt der nächste Werktag.",
          "Ihr Pflichtenkalender im Bereich zeigt die Termine Ihrer Gesellschaft. Die für Sie geltenden Fristen bestätigt Ihre Steuerkanzlei bzw. Ihr US-CPA.",
        ],
      },
      {
        titel: "Januar bis Mai",
        absaetze: [
          "Das erste Drittel des Jahres ist das dichteste: Hier liegen die Meldungen für das Vorjahr.",
        ],
        liste: [
          "Bis 31. Januar: Form 1099-NEC an Empfänger und IRS, falls Ihre LLC meldepflichtige Zahlungen an US-Dienstleister geleistet hat",
          "Ab 1. Januar: Annual Report in Florida möglich",
          "Februar und März: Unterlagen des Vorjahres zusammenstellen — Einlagen, Entnahmen, Zahlungen zwischen Ihnen und der LLC, Kontoauszüge",
          "Bis 15. April: Form 5472 mit Pro-forma-Form 1120 — oder Form 7004 für sechs Monate Aufschub",
          "Bis 15. April: FBAR an FinCEN, falls die LLC Konten außerhalb der USA hat, deren Höchststände zusammen mehr als 10.000 US-Dollar betrugen; der Termin verlängert sich automatisch auf den 15. Oktober",
          "Bis 1. Mai: Annual Report in Florida; danach laut Sunbiz mit Verspätungsgebühr, und ohne Bericht droht die Auflösung von Amts wegen",
        ],
      },
      {
        titel: "Juni bis Dezember",
        absaetze: [
          "In der zweiten Jahreshälfte stehen die verlängerten Fristen und die Erklärung im Wohnsitzland an.",
        ],
        liste: [
          "15. Juni: Termin für eine eigene US-Erklärung des Inhabers auf Form 1040-NR, falls eine solche Pflicht besteht und keine US-Löhne mit Steuerabzug bezogen werden",
          "Im Lauf des Jahres: Steuererklärung im Wohnsitzland, in Deutschland im Gründungsjahr mit der Mitteilung nach § 138 AO — Fristen je nach Land und danach, ob eine Steuerkanzlei die Erklärung erstellt",
          "15. Oktober: verlängerte Frist für Form 5472 mit Pro-forma-Form 1120, wenn Form 7004 rechtzeitig eingereicht wurde; ebenso für das FBAR",
          "Jahrestag der Gründung: Verlängerung des Registered Agent — bei FIAON Global erledigen wir sie für Sie",
          "Dezember: Jahressummen je US-Dienstleister prüfen, fehlende W-9 anfordern, Belege des Jahres vollständig ablegen",
        ],
      },
      {
        titel: "Laufend über das Jahr",
        absaetze: [
          "Einige Pflichten hängen nicht am Kalender, sondern an Ereignissen.",
        ],
        liste: [
          "Sales Tax in Florida: Erklärung und Zahlung im Rhythmus, den das Florida Department of Revenue festlegt — nur, wenn Ihre LLC dort registriert ist",
          "W-8BEN: neues Formular vor Ablauf der Gültigkeit oder nach einem Umzug in ein anderes Land",
          "Neue Anschrift oder neue verantwortliche Person: Form 8822-B an den IRS und Änderung im Register auf sunbiz.org",
          "Jede Zahlung zwischen Ihnen und der LLC: sofort mit Beleg ablegen — sie gehört auf die nächste Form 5472",
        ],
        merke: "Zwei Termine wiegen am schwersten: der 15. April für Form 5472 und der 1. Mai für den Annual Report in Florida.",
      },
    ],
    umsetzen: [
      "Öffnen Sie den Pflichtenkalender in Ihrem Bereich und prüfen Sie, ob alle Termine Ihrer LLC eingetragen sind.",
      "Legen Sie Anfang Januar fest, wer Form 5472 und den Annual Report übernimmt.",
      "Richten Sie sich eine Erinnerung für Februar ein, um die Unterlagen des Vorjahres zusammenzustellen.",
      "Geben Sie Ihrer Steuerkanzlei im Frühjahr die US-Unterlagen für die Erklärung im Wohnsitzland.",
      "Prüfen Sie im Dezember W-9, W-8BEN und die Jahressummen an US-Dienstleister.",
      "Bitten Sie Ihre Steuerkanzlei bzw. Ihren US-CPA, die für Sie geltenden Fristen zu bestätigen.",
    ],
    quellen: [Q.i1120, Q.i5472, Q.sunbiz, Q.fbar, Q.i1099],
    stand: STAND,
  },
];

// ═══════════════════════════════════════════════════════════════════════════
// (B) DIE US-FORMULARE UND -PFLICHTEN, ERKLÄRT
// ═══════════════════════════════════════════════════════════════════════════
const FIAON_MELDUNG =
  "Ist die Meldung Teil Ihres Pakets oder Ihrer Jahresbetreuung, erstellt sie ein US-CPA aus dem Partnernetz von FIAON. Sonst stellt FIAON die Angaben aus Ihrer Akte zusammen und erinnert Sie an die Frist; Unterschrift und Einreichung liegen bei Ihnen bzw. Ihrer Steuerkanzlei.";

export const FACH_FORMULARE: FachFormular[] = [
  {
    id: "form-5472",
    nummer: "Form 5472",
    titel: "Meldung der Transaktionen mit dem ausländischen Inhaber",
    wer: "Jede US-LLC mit einem einzigen ausländischen Inhaber, die als disregarded entity gilt (foreign-owned U.S. disregarded entity)",
    wann: "Bis 15. April für das Vorjahr (beim Kalenderjahr); mit Form 7004 bis 15. Oktober",
    folgen: "Laut IRS 25.000 US-Dollar Strafe je Formular und Jahr, wenn die Meldung fehlt oder nicht im Wesentlichen vollständig ist; bleibt sie nach Aufforderung des IRS weiter aus, können zusätzliche Strafen hinzukommen.",
    was: "Die LLC meldet dem IRS ihre Transaktionen mit dem Inhaber und mit ihm verbundenen Personen — Einlagen, Entnahmen, Darlehen, Zahlungen für Leistungen und vom Inhaber bezahlte Kosten. Form 5472 wird an eine Pro-forma-Form 1120 angeheftet und ist auch ohne Umsatz abzugeben, sobald es eine solche Transaktion gab.",
    schritte: [
      "Alle Geldflüsse zwischen Inhaber und LLC des Jahres mit Datum und Höhe in US-Dollar zusammenstellen",
      "Angaben zur LLC (Name, Anschrift, EIN, Gründungsstaat) und zum Inhaber (Name, Anschrift, Wohnsitzland, Steuernummer des Heimatlands) eintragen",
      "Die Transaktionen nach Art in die dafür vorgesehenen Zeilen eintragen",
      "Form 5472 an die Pro-forma-Form 1120 heften und die 1120 unterschreiben",
      "Nach den Anweisungen des IRS per Fax oder Post einreichen und den Beleg aufbewahren",
    ],
    fiaon: FIAON_MELDUNG,
    quelle: Q.i5472,
  },
  {
    id: "form-1120-pro-forma",
    nummer: "Form 1120 (pro forma)",
    titel: "Umschlag-Erklärung für Form 5472",
    wer: "Jede foreign-owned U.S. disregarded entity, die Form 5472 abgibt",
    wann: "Zusammen mit Form 5472: bis 15. April, mit Form 7004 bis 15. Oktober",
    was: "Form 1120 ist eigentlich die Körperschaftsteuererklärung einer Corporation. Eine LLC in ausländischer Hand füllt sie nur als Umschlag aus: Name, Anschrift und EIN sowie die wenigen Felder, die die IRS-Anweisungen zu Form 5472 für diesen Fall nennen, dazu oben der Vermerk „Foreign-owned U.S. DE“. Eine Steuer wird damit nicht berechnet.",
    schritte: [
      "Aktuelle Form 1120 und die Anweisungen zu Form 5472 (Abschnitt zu foreign-owned U.S. DEs) bereitlegen",
      "Nur die dort genannten Felder ausfüllen und oben „Foreign-owned U.S. DE“ vermerken",
      "Form 5472 anheften",
      "Von einer berechtigten Person unterschreiben lassen",
      "Nach den Anweisungen des IRS per Fax oder Post einreichen",
    ],
    fiaon: FIAON_MELDUNG,
    quelle: Q.i5472,
  },
  {
    id: "form-7004",
    nummer: "Form 7004",
    titel: "Fristverlängerung für Form 1120 mit Form 5472",
    wer: "Jede LLC, die Form 5472 mit Pro-forma-Form 1120 nicht bis 15. April abgeben kann",
    wann: "Bis 15. April, dem ursprünglichen Termin; die Abgabefrist verlängert sich um sechs Monate auf den 15. Oktober",
    folgen: "Ohne rechtzeitig eingereichte Form 7004 bleibt es beim 15. April — mit den Strafen, die für Form 5472 gelten.",
    was: "Mit Form 7004 verlängert sich die Abgabefrist der Form 1120 und damit der angehefteten Form 5472 um sechs Monate. Die Verlängerung wird ohne Begründung gewährt, wenn das Formular richtig und rechtzeitig eingeht. Sie gilt für die Abgabe, nicht für eine Zahlung.",
    schritte: [
      "Name, Anschrift und EIN der LLC eintragen",
      "Den Formularcode für Form 1120 laut den Anweisungen zu Form 7004 wählen",
      "Den Einreichungsweg nach den Anweisungen zu Form 7004 und Form 5472 wählen",
      "Bis 15. April einreichen und den Beleg aufbewahren",
      "Den 15. Oktober als neue Frist im Pflichtenkalender vermerken",
    ],
    fiaon: "FIAON erinnert Sie vor dem 15. April an die Wahl zwischen Abgabe und Verlängerung und stellt die Angaben aus Ihrer Akte bereit; Unterschrift und Einreichung liegen bei Ihnen, Ihrer Steuerkanzlei oder dem US-CPA, der die Meldung erstellt.",
    quelle: Q.i7004,
  },
  {
    id: "form-ss-4",
    nummer: "Form SS-4",
    titel: "Antrag auf die EIN der Gesellschaft",
    wer: "Jede neue US-LLC; Inhaber ohne US-Sozialversicherungsnummer oder ITIN beantragen schriftlich statt online",
    wann: "Direkt nach der Gründung — vor der Kontoeröffnung und vor der ersten US-Meldung",
    was: "Mit Form SS-4 beantragt die LLC beim IRS ihre Employer Identification Number (EIN). Ohne US-Sozialversicherungsnummer oder ITIN der verantwortlichen Person ist der Online-Antrag nicht möglich; der Antrag geht per Fax oder Post, aus dem Ausland auch telefonisch. Für eine LLC in ausländischer Hand verlangen die Anweisungen in Zeile 9a den Vermerk „Foreign-owned U.S. disregarded entity-Form 5472“.",
    schritte: [
      "Gründungsurkunde und Anschrift der LLC bereitlegen",
      "Form SS-4 mit Name der LLC, Anschrift, verantwortlicher Person und Gründungsdatum ausfüllen",
      "In Zeile 9a den Vermerk für foreign-owned disregarded entities eintragen",
      "Unterschreiben und per Fax oder Post an die Stelle schicken, die die SS-4-Anweisungen für Antragsteller aus dem Ausland nennen",
      "Das Bestätigungsschreiben CP 575 im Dokumentenraum ablegen",
    ],
    fiaon: "FIAON füllt Form SS-4 aus Ihren Gründungsdaten aus, lässt sie von Ihnen unterschreiben, reicht sie ein und legt die Bestätigung des IRS in Ihren Dokumentenraum. Über die Vergabe entscheidet der IRS.",
    quelle: Q.iss4,
  },
  {
    id: "cp-575-147c",
    nummer: "CP 575 / Letter 147C",
    titel: "Bestätigung der EIN durch den IRS",
    wer: "Jede LLC mit EIN — Institute und Zahlstellen verlangen das Schreiben häufig als Nachweis",
    wann: "CP 575 kommt einmalig nach der Vergabe der EIN; Letter 147C fordern Sie an, wenn CP 575 fehlt",
    was: "CP 575 ist das Schreiben, mit dem der IRS die EIN bestätigt. Ein verlorenes CP 575 ersetzt der IRS auf Anfrage durch Letter 147C. Beide nennen Name und EIN der Gesellschaft so, wie der IRS sie gespeichert hat — deshalb lohnt der Abgleich mit den Gründungsunterlagen.",
    schritte: [
      "Prüfen, ob CP 575 im Dokumentenraum liegt und ob Name und Anschrift stimmen",
      "Fehlt es: den IRS unter der Nummer anrufen, die er auf seiner Seite zur verlorenen EIN nennt, und Letter 147C anfordern",
      "Beim Anruf als verantwortliche Person oder als bevollmächtigte Person auftreten — der IRS gibt die Auskunft nur Berechtigten",
      "Das Schreiben per Fax oder Post entgegennehmen und im Dokumentenraum ablegen",
    ],
    fiaon: "FIAON legt das EIN-Schreiben Ihrer LLC im Dokumentenraum ab und bereitet bei Bedarf die Anforderung von Letter 147C vor; den Anruf beim IRS führt die verantwortliche Person oder eine bevollmächtigte Person.",
    quelle: Q.einVerloren,
  },
  {
    id: "form-w-7",
    nummer: "Form W-7",
    titel: "Antrag auf eine persönliche ITIN",
    wer: "Personen ohne Anspruch auf eine US-Sozialversicherungsnummer, die für einen steuerlichen Zweck eine US-Steuernummer brauchen — nicht jeder LLC-Inhaber",
    wann: "In der Regel zusammen mit der US-Steuererklärung, für die die Nummer gebraucht wird",
    was: "Mit Form W-7 beantragen Sie persönlich die Individual Taxpayer Identification Number. Das Formular fragt den steuerlichen Grund ab, etwa eine eigene US-Steuererklärung oder die Anwendung eines Doppelbesteuerungsabkommens. Ohne einen Grund aus der Liste des Formulars vergibt der IRS keine ITIN. Eine ITIN verfällt laut IRS, wenn sie drei Jahre hintereinander auf keiner US-Bundessteuererklärung steht.",
    schritte: [
      "Mit Steuerkanzlei oder US-CPA klären, welcher Grund aus Form W-7 vorliegt",
      "Form W-7 ausfüllen und die Steuererklärung oder den Nachweis für eine Ausnahme beilegen",
      "Identität nachweisen: Pass im Original, beglaubigte Kopie der ausstellenden Behörde oder Prüfung durch einen Certifying Acceptance Agent",
      "Den Antrag an die Stelle schicken, die die W-7-Anweisungen nennen, oder über den Acceptance Agent einreichen",
      "Den ITIN-Bescheid im Dokumentenraum ablegen",
    ],
    fiaon: "FIAON klärt vor dem Antrag mit dem US-CPA, ob ein steuerlicher Grund vorliegt, bereitet Form W-7 vor und reicht sie über einen Certifying Acceptance Agent ein — Ihr Pass bleibt dabei bei Ihnen. Einen Antrag ohne tragfähigen Grund stellt FIAON nicht. Über die Vergabe entscheidet der IRS.",
    quelle: Q.iw7,
  },
  {
    id: "form-w-8ben",
    nummer: "Form W-8BEN",
    titel: "Nachweis des ausländischen Status — für Sie als Person",
    wer: "Sie als ausländischer Inhaber einer Einzel-LLC, wenn eine US-Zahlstelle nach dem Steuerstatus fragt",
    wann: "Auf Anfrage der Zahlstelle vor der ersten Zahlung; gültig in der Regel bis zum Ende des dritten Kalenderjahres nach der Unterschrift",
    folgen: "Ohne gültiges Formular wendet die Zahlstelle die Vermutungsregeln des IRS an — das kann zu einem Steuereinbehalt führen.",
    was: "W-8BEN bescheinigt einer US-Zahlstelle, dass der wirtschaftlich Berechtigte eine ausländische natürliche Person ist. Weil eine Einzel-LLC steuerlich ihrem Inhaber zugerechnet wird, gibt bei einem ausländischen Inhaber in der Regel er selbst W-8BEN ab — und nicht die LLC eine W-9. Das Formular geht an die Zahlstelle, nicht an den IRS.",
    schritte: [
      "Name, Staatsangehörigkeit und Wohnsitzanschrift eintragen",
      "Die Steuernummer des Wohnsitzlandes eintragen, in Deutschland die Steuer-Identifikationsnummer",
      "Angaben zum Doppelbesteuerungsabkommen nur nach Prüfung durch Ihre Steuerkanzlei ausfüllen",
      "Unterschreiben, datieren und an die anfragende Stelle geben",
      "Das Unterschriftsdatum im Pflichtenkalender notieren",
    ],
    fiaon: "FIAON stellt Ihre Angaben aus der Akte für das Formular zusammen und erinnert Sie vor Ablauf der Gültigkeit; ausfüllen und unterschreiben Sie selbst.",
    quelle: Q.iw8ben,
  },
  {
    id: "form-w-8ben-e",
    nummer: "Form W-8BEN-E",
    titel: "Nachweis des ausländischen Status — für Gesellschaften",
    wer: "Ausländische Gesellschaften, etwa eine GmbH oder AG — auch als Inhaberin einer US-LLC",
    wann: "Auf Anfrage der Zahlstelle vor der ersten Zahlung; gültig in der Regel wie W-8BEN",
    folgen: "Ohne gültiges Formular wendet die Zahlstelle die Vermutungsregeln des IRS an — das kann zu einem Steuereinbehalt führen.",
    was: "W-8BEN-E ist das Gegenstück zu W-8BEN für Gesellschaften, mit zusätzlichen Angaben nach FATCA. Eine Einzel-LLC als disregarded entity gibt in der Regel kein eigenes W-8BEN-E ab; gehört sie einer ausländischen Gesellschaft, gibt diese Inhaberin das Formular ab. Die IRS-Anweisungen nennen für die LLC selbst nur eng gefasste Sonderfälle.",
    schritte: [
      "Klären, wer wirtschaftlich Berechtigter ist: die Gesellschaft als Inhaberin oder eine natürliche Person",
      "Name, Gründungsland und Anschrift der Gesellschaft eintragen",
      "Den Status nach Chapter 3 und nach FATCA (Chapter 4) wählen — diesen Teil prüft Ihre Steuerkanzlei",
      "Unterschreiben und an die anfragende Stelle geben",
    ],
    fiaon: "FIAON stellt die Angaben zur Gesellschaft aus Ihrer Akte zusammen; den Status nach FATCA wählt und verantwortet Ihre Steuerkanzlei.",
    quelle: Q.iw8bene,
  },
  {
    id: "form-w-9",
    nummer: "Form W-9",
    titel: "Abfrage der Steuernummer von US-Personen",
    wer: "US-Personen — vor allem die US-Dienstleister, die Ihre LLC bezahlt; nicht Sie als ausländischer Inhaber",
    wann: "Vor der ersten Zahlung an einen US-Dienstleister",
    folgen: "Fehlt die Steuernummer eines US-Empfängers, kann die zahlende Stelle zum Einbehalt verpflichtet sein (backup withholding).",
    was: "Mit W-9 bestätigt eine US-Person ihre Steuernummer. Ihre LLC braucht W-9 vor allem von den US-Dienstleistern, die sie bezahlt, als Grundlage für Form 1099-NEC. Laut den IRS-Anweisungen gibt eine disregarded entity mit ausländischem Inhaber selbst keine W-9 ab; der Inhaber gibt das passende Formular W-8.",
    schritte: [
      "Vor der ersten Zahlung W-9 beim US-Dienstleister anfordern",
      "Prüfen, ob Name, Steuernummer und Einordnung ausgefüllt und unterschrieben sind",
      "Die W-9 im Dokumentenraum ablegen",
      "Fragt eine US-Stelle Ihre LLC nach einer W-9: vor dem Ausfüllen klären, ob stattdessen W-8BEN gilt",
    ],
    fiaon: "Die W-9 Ihrer Dienstleister legen Sie im Dokumentenraum ab; FIAON stellt sie zum Jahresende mit Ihren Zahlungsdaten zusammen. Ob Ihre LLC meldet, klärt Ihre Steuerkanzlei.",
    quelle: Q.iw9,
  },
  {
    id: "form-1099-nec",
    nummer: "Form 1099-NEC",
    titel: "Meldung von Zahlungen an US-Dienstleister",
    wer: "US-Zahlende, die im Rahmen ihres Geschäfts selbständige Dienstleister bezahlen — ob Ihre LLC dazugehört, ist im Einzelfall zu klären",
    wann: "Bis 31. Januar des Folgejahres an den Empfänger und an den IRS",
    folgen: "Laut IRS werden für verspätete, fehlende oder fehlerhafte Informationsmeldungen Strafen je Formular fällig, gestaffelt nach der Verspätung.",
    was: "Form 1099-NEC meldet Vergütungen an selbständige US-Dienstleister, die im Jahr die Schwelle je Empfänger überschreiten; für Zahlungen ab 2026 liegt sie bei 2.000 US-Dollar. Grundlage sind Name, Anschrift und Steuernummer aus der W-9 des Empfängers. Zahlungen per Kreditkarte oder über Zahlungsplattformen meldet in der Regel der Zahlungsabwickler auf Form 1099-K.",
    schritte: [
      "Jahressummen je US-Dienstleister ermitteln, getrennt nach Zahlungsweg",
      "Mit der Schwelle aus den aktuellen IRS-Anweisungen vergleichen",
      "Je Empfänger ein Formular mit den Angaben aus der W-9 ausfüllen",
      "Bis 31. Januar an Empfänger und IRS geben — ab zehn Meldungen im Jahr elektronisch, etwa über IRIS",
      "Kopien im Dokumentenraum ablegen",
    ],
    fiaon: "FIAON stellt die Zahlungen an US-Dienstleister aus Ihren Unterlagen zusammen und erinnert Sie an den 31. Januar; ob Ihre LLC meldet und wer einreicht, klären Sie mit Ihrer Steuerkanzlei bzw. Ihrem US-CPA.",
    quelle: Q.i1099,
  },
  {
    id: "florida-annual-report",
    nummer: "Annual Report (Florida)",
    titel: "Jahresbericht beim Bundesstaat Florida",
    wer: "Jede Florida-LLC, ab dem Jahr nach der Gründung",
    wann: "Jedes Jahr zwischen 1. Januar und 1. Mai",
    folgen: "Laut Sunbiz 400 US-Dollar Verspätungsgebühr nach dem 1. Mai; bleibt der Bericht aus, löst der Staat die LLC von Amts wegen auf (administrative dissolution).",
    was: "Der Annual Report bestätigt oder aktualisiert die Angaben der LLC im Register des Florida Department of State: Anschrift, Registered Agent und vertretungsberechtigte Personen. Die Gebühr beträgt laut Sunbiz 138,75 US-Dollar. Der Bericht ist keine Steuererklärung.",
    schritte: [
      "Auf sunbiz.org die Angaben der LLC im Register prüfen",
      "Den Annual Report online aufrufen und die Dokumentennummer der LLC eingeben",
      "Angaben bestätigen oder ändern und den Namen der unterzeichnenden Person eintragen",
      "Die Gebühr online bezahlen",
      "Die Bestätigung im Dokumentenraum ablegen",
    ],
    fiaon: "Mit gebuchter Jahresbetreuung reicht FIAON den Annual Report einschließlich der Staatsgebühr ein. Ohne sie stellt FIAON die Angaben aus Ihrer Akte zusammen und erinnert Sie an den 1. Mai; eingereicht wird dann von Ihnen.",
    quelle: Q.sunbiz,
    staaten: ["FL"],
  },
  {
    id: "florida-sales-tax",
    nummer: "Sales and Use Tax (Florida)",
    titel: "Umsatzsteuer des Bundesstaats Florida",
    wer: "LLCs, die in Florida steuerpflichtige Waren oder Leistungen verkaufen oder vermieten — und Fernverkäufer über der Schwelle des Staats",
    wann: "Registrierung vor dem ersten steuerpflichtigen Verkauf; Erklärungen im Rhythmus, den das Florida Department of Revenue festlegt",
    folgen: "Laut Florida Department of Revenue fallen bei verspäteter Erklärung oder Zahlung Strafen und Zinsen an.",
    was: "Florida erhebt auf steuerpflichtige Verkäufe eine Sales Tax von 6 Prozent, dazu in vielen Countys einen Zuschlag. Wer steuerpflichtig verkauft, registriert sich beim Florida Department of Revenue, berechnet die Steuer, führt sie ab und erklärt sie regelmäßig — auch für Zeiträume ohne Umsatz.",
    schritte: [
      "Klären, ob Ihre Waren oder Leistungen in Florida steuerpflichtig sind und ob die LLC dort verkauft",
      "Vor dem ersten Verkauf online beim Florida Department of Revenue registrieren",
      "Die Steuer je Verkauf mit dem Satz von Staat und County berechnen",
      "Erklärung und Zahlung im zugeteilten Rhythmus elektronisch einreichen",
      "Belege und Erklärungen aufbewahren",
    ],
    fiaon: "FIAON stellt die Angaben zur LLC aus Ihrer Akte für die Registrierung zusammen und erinnert Sie an die Termine; ob Ihre Umsätze steuerpflichtig sind, klärt Ihre Steuerkanzlei. Erklärung und Zahlung reichen Sie bzw. Ihre Buchhaltung ein.",
    quelle: Q.flSales,
    staaten: ["FL"],
  },
  {
    id: "boi-hinweis",
    nummer: "BOI Report (FinCEN)",
    titel: "Meldung der wirtschaftlich Berechtigten — für Florida-LLCs entfallen",
    wer: "Nur Gesellschaften ausländischen Rechts, die sich bei einem Bundesstaat für Geschäfte registriert haben — nicht Ihre Florida-LLC",
    wann: "Für in den USA gegründete Gesellschaften kein Termin — die Pflicht entfällt",
    was: "Seit der Übergangsregel von FinCEN vom März 2025 sind Gesellschaften, die in den USA gegründet wurden, von der BOI-Meldung ausgenommen; laut FinCEN gilt das seit August 2026 endgültig. Eine Florida-LLC ist eine inländische Gesellschaft und meldet nicht, gleich wo ihr Inhaber wohnt. FinCEN verlangt für die Meldung keine Gebühr; Schreiben, die eine Gebühr fordern, verdienen Vorsicht.",
    schritte: [
      "Den Gründungsstaat der Gesellschaft prüfen: in den USA gegründet heißt keine BOI-Meldung",
      "Schreiben, die eine BOI-Gebühr verlangen, nicht bezahlen, bevor der Absender geprüft ist",
      "Den aktuellen Stand bei Bedarf auf fincen.gov/boi nachlesen",
      "Gehört eine Gesellschaft ausländischen Rechts mit Registrierung in einem Bundesstaat zu Ihrer Struktur: die Pflicht prüfen lassen",
    ],
    fiaon: "FIAON verfolgt den Stand der BOI-Regel. Schreiben, die Sie dazu erhalten, können Sie über „Einzelfall prüfen lassen“ an FIAON geben.",
    quelle: Q.boi,
  },
];
