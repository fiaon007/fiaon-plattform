// ═══════════════════════════════════════════════════════════════════════════
// FIAON GLOBAL — WISSEN: US-LLC MIT WOHNSITZ IN DEUTSCHLAND (27.10.2026, E-439)
// FG · 47 · Thema T3 aus .arbeit/recherche/kw_de.md
//
// Die Pflichten-Seite (Abgrenzung: /business/wissen/us-llc-steuern bleibt die
// Frage „Spart sie Steuern?“). Geprüft am 27.10.2026 an den amtlichen Texten:
//   · gesetze-im-internet.de: §§ 10, 12, 20, 138, 141, 147, 379 AO; § 1 KStG;
//     § 2 GewStG; § 14 GewO; § 13d HGB; §§ 3a, 13b, 14, 14a, 19, 27 Abs. 38,
//     27a UStG; § 5 DDG.
//   · BFH, Beschluss vom 18.05.2021, I B 75/20 (acht Merkmale des Typenvergleichs
//     nach BMF-Schreiben vom 19.03.2004, Gesamtwürdigung, Merkmale ungleich gewichtig).
//   · IRS, Instructions for Form 5472 (Einlagen/Entnahmen meldepflichtig, Bücher,
//     Strafe auch bei fehlenden Aufzeichnungen).
// § 138 AO: Die Mitteilung nach Abs. 2 geht mit der Steuererklärung ein, spätestens
// 14 Monate nach Ablauf des Jahres (Abs. 5). Die Monatsfrist (Abs. 4) gilt nur für
// Abs. 1, 1a, 1b — Betriebseröffnung und steuerliche Erfassung. Viele Seiten
// verwechseln das.
// Nicht übernommen (nicht an der Primärquelle prüfbar am 27.10.2026, BMF-Server 503):
// Wortlaut von Art. 4 Abs. 3 DBA-USA; § 18i UStG nur ohne Begriffsbestimmung lesbar.
// Wortwand: keine Gestaltung, kein Steuervorteil, keine Steuersätze; kein „Nr. 1“
// (Superlativ-Prüfung) — Fundstellen deshalb als „Abs. 2 und 5“.
//
// Fach- und Rechtsprüfung 27.10.2026 (zweiter Durchgang, jede Quelle geöffnet):
//   · § 138 Abs. 2 Nr. 3 AO verlangt „Sitz UND Geschäftsleitung außerhalb“ — trifft
//     auf eine von hier geleitete LLC gerade nicht zu. Abs. 3 (Drittstaat-Gesellschaft)
//     nennt nur Körperschaft, Personenvereinigung, Vermögensmasse — „in jeder
//     Einordnung meldepflichtig“ war daraus nicht ableitbar. Text entsprechend korrigiert.
//   · DBA Art. 1 Abs. 7 und Art. 7 Abs. 1 an den IRS-Fassungen (Abkommen 1989,
//     Protokoll Berlin 01.06.2006) geprüft, weil die BMF-Server 503 meldeten.
//   · BOI-Meldung (FinCEN, 11.08.2026: U.S. companies befreit) als Zeile ergänzt.
// ═══════════════════════════════════════════════════════════════════════════
import type { GlobalQuelle, GlobalSeite } from "../typen";
// E-509 (12.11.2026): EIN Produkt statt vier Pakete — kein Paketname, Preise aus EIN_PRODUKT; die alte Geld-zurück-Zusage je
// Paket entfällt (auf dieser Seite geht es nicht um Kapital).
// E-510 (13.11.2026, Sprachleitfaden FIAON Global): Die festen Sätze und die Schritte 1 und 2 kommen aus
// shared/fiaon-global-saetze.ts. GLOBAL_ROLLEN und die Liste aus GLOBAL_JAHRESBETREUUNG stehen hier nicht mehr
// („unser US-CPA“, „Termine vor Ort“); die Leistungen der Jahresbetreuung stehen unten in der Rollenbezeichnung
// des Leitfadens. Der Steuerberater des Klienten heißt „Ihr Steuerberater“, nie „Kanzlei“.
// Zweiter Durchgang am selben Tag (der ganze Artikel neu gefasst, nicht nur die gemeldeten Stellen): FIAON steht nur
// noch im Merkblatt, in den Abschnitten „fiaon“ und „jahresbetreuung“, im Vermerk und in der letzten Frage — Tabellen,
// Karten und Reihenfolge stimmen ohne uns. Überschriften sind Sachtitel, kein Seitenblick auf andere Darstellungen,
// „Ihr Steuerberater“ durchgehend. Gesetzliche Fristen Dritter bleiben als Ziffer mit Fundstelle; Zahlen, Paragrafen
// und Quellen sind unverändert.
import { GLOBAL_PFLICHTHINWEIS, GLOBAL_NICHT_INKLUSIVE } from "../../fiaon-global";
import { SCHRITTE_KOPF, SECHS_SCHRITTE, satz, type Schritt, type SchrittNr } from "../../fiaon-global-saetze";
import { EIN_PRODUKT } from "../ein-produkt";
import { QUELLEN_WISSEN as Q, QUELLEN_IRS, QUELLEN_STAATEN, IRS, STAAT } from "../fakten";

const S = "2026-10-27";

/** Strafe der IRS ohne den Zusatz „je Formular und Jahr“ — für die Kennziffer. */
const STRAFE_5472 = IRS.strafe5472.split(" je ")[0];

const P = EIN_PRODUKT.de;
/** Schritt 1 und 2 der festen Erzählung (Leitfaden 2.2) — Satz und „Ihr Teil“ wortgleich aus der einen Quelle, nie getippt. */
const schritt = (nr: SchrittNr): Schritt => SECHS_SCHRITTE.de.find((x) => x.nr === nr)!;
const GRUENDUNG = schritt(1);
const UNTERLAGEN = schritt(2);
/** Die Namen der festen Teile eines Schritts: „Ihr Teil“, „Bedingung“ (Leitfaden 2.1). */
const TEIL = SCHRITTE_KOPF.de.teile;
/** Zuständigkeit für Steuerfragen — derselbe Wortlaut wie auf den Länderseiten (zielgruppen.ts). */
const STEUERFRAGEN = "Steuerfragen liegen bei Partner-Steuerberatern, die in eigener Verantwortung arbeiten";
/** Was nicht zum Mandat gehört — aus der einen Liste, nach dem Doppelpunkt klein geschrieben (wie im englischen Zwilling). */
const NICHT_IM_MANDAT = GLOBAL_NICHT_INKLUSIVE.de[1].replace(/^./, (anfang) => anfang.toLowerCase());

/** Quellen dieses Beitrags (geprüft am 27.10.2026). */
const QUELLEN: Record<string, GlobalQuelle> = {
  ao10: { titel: "§ 10 AO — Geschäftsleitung", url: "https://www.gesetze-im-internet.de/ao_1977/__10.html" },
  ao12: { titel: "§ 12 AO — Betriebstätte", url: "https://www.gesetze-im-internet.de/ao_1977/__12.html" },
  ao20: { titel: "§ 20 AO — Örtliche Zuständigkeit für Körperschaften", url: "https://www.gesetze-im-internet.de/ao_1977/__20.html" },
  ao141: { titel: "§ 141 AO — Buchführungspflicht bestimmter Steuerpflichtiger", url: "https://www.gesetze-im-internet.de/ao_1977/__141.html" },
  ao147: { titel: "§ 147 AO — Ordnungsvorschriften für die Aufbewahrung von Unterlagen", url: "https://www.gesetze-im-internet.de/ao_1977/__147.html" },
  ao379: { titel: "§ 379 AO — Steuergefährdung", url: "https://www.gesetze-im-internet.de/ao_1977/__379.html" },
  kstg1: { titel: "§ 1 KStG — Unbeschränkte Steuerpflicht", url: "https://www.gesetze-im-internet.de/kstg_1977/__1.html" },
  gewstg2: { titel: "§ 2 GewStG — Steuergegenstand", url: "https://www.gesetze-im-internet.de/gewstg/__2.html" },
  gewo14: { titel: "§ 14 GewO — Anzeigepflicht", url: "https://www.gesetze-im-internet.de/gewo/__14.html" },
  hgb13d: { titel: "§ 13d HGB — Zweigniederlassungen von Unternehmen mit Sitz im Ausland", url: "https://www.gesetze-im-internet.de/hgb/__13d.html" },
  ustg3a: { titel: "§ 3a UStG — Ort der sonstigen Leistung", url: "https://www.gesetze-im-internet.de/ustg_1980/__3a.html" },
  ustg13b: { titel: "§ 13b UStG — Leistungsempfänger als Steuerschuldner", url: "https://www.gesetze-im-internet.de/ustg_1980/__13b.html" },
  ustg14: { titel: "§ 14 UStG — Ausstellung von Rechnungen", url: "https://www.gesetze-im-internet.de/ustg_1980/__14.html" },
  ustg14a: { titel: "§ 14a UStG — Zusätzliche Pflichten bei der Ausstellung von Rechnungen in besonderen Fällen", url: "https://www.gesetze-im-internet.de/ustg_1980/__14a.html" },
  ustg18: { titel: "§ 18 UStG — Besteuerungsverfahren (Voranmeldung)", url: "https://www.gesetze-im-internet.de/ustg_1980/__18.html" },
  ustg19: { titel: "§ 19 UStG — Steuerbefreiung für Kleinunternehmer", url: "https://www.gesetze-im-internet.de/ustg_1980/__19.html" },
  ustg27: { titel: "§ 27 UStG — Allgemeine Übergangsvorschriften (Abs. 38: elektronische Rechnung)", url: "https://www.gesetze-im-internet.de/ustg_1980/__27.html" },
  ustg27a: { titel: "§ 27a UStG — Umsatzsteuer-Identifikationsnummer", url: "https://www.gesetze-im-internet.de/ustg_1980/__27a.html" },
  ddg5: { titel: "§ 5 DDG — Allgemeine Informationspflichten", url: "https://www.gesetze-im-internet.de/ddg/__5.html" },
  bmf: { titel: "BMF-Schreiben vom 19.03.2004 zur US-LLC (KStH 2022, Anlage 10)", url: "https://usth.bundesfinanzministerium.de/ksth/2022/B-Anlagen/Anlage-10/inhalt.html" },
  bfh: { titel: "BFH, Beschluss vom 18.05.2021, I B 75/20 — Einordnung einer US-LLC", url: "https://www.bundesfinanzhof.de/en/entscheidungen/entscheidungen-online/decision-detail/STRE202150148/" },
  dbaIrs: { titel: "IRS — Germany Tax Treaty Documents (Abkommen 1989, Protokoll vom 01.06.2006)", url: "https://www.irs.gov/businesses/international-businesses/germany-tax-treaty-documents" },
};
const QL = QUELLEN;

export const SEITE: GlobalSeite = {
  pfad: "/business/wissen/us-llc-wohnsitz-deutschland",
  art: "wissen",
  seo: {
    titel: "US-LLC mit Wohnsitz in Deutschland: Pflichten — FIAON Global",
    beschreibung: "US-LLC mit Wohnsitz in Deutschland: Finanzamt, Meldung nach § 138 AO, Gewerbe, Umsatzsteuer und Buchführung — jede Pflicht mit Fundstelle.",
  },
  stand: "2026-11-13",
  erschienen: S,
  kennung: "FG · 47",
  auge: "Wissen · Steuern und Pflichten",
  h1: "US-LLC mit Wohnsitz in Deutschland.",
  h1b: "Anmelden, melden, richtig abrechnen.",
  lead: "Wer eine US-LLC mit Wohnsitz in Deutschland führt, hat Pflichten in zwei Ländern. In den USA zählen dazu Form 5472, der Registered Agent (die Zustellanschrift im Bundesstaat) und die Jahresmeldung. In Deutschland betreffen sie das Finanzamt, die Meldung nach § 138 AO und das Gewerbe. Hinzu kommen die Umsatzsteuer auf Rechnungen und die Buchführung. Dieser Beitrag nennt jede Pflicht mit ihrer Fundstelle.",
  ziffern: [
    { wert: "14 Monate", label: "spätestens: Meldung nach § 138 AO, mit der Steuererklärung" },
    { wert: "1 Monat", label: "für Betriebseröffnung und steuerliche Erfassung" },
    { wert: STRAFE_5472, label: "Strafe der US-Steuerbehörde IRS je versäumter Form 5472" },
  ],
  blick: [
    ["Steuerpflicht", "Am Ort der Geschäftsleitung (§ 10 AO), in der Regel in Deutschland"],
    ["Einordnung", "Typenvergleich: wie eine Kapitalgesellschaft oder transparent"],
    ["Meldung", "§ 138 AO mit der Steuererklärung, spätestens nach 14 Monaten"],
    ["Rechnungen", "Bei Leitung aus Deutschland in der Regel mit deutscher Umsatzsteuer"],
    ["USA", "Form 5472 mit Form 1120, jährlich, auch ohne Umsatz"],
    ["Mit FIAON Global", "Gründung, Unterlagen und Anträge für EIN und ITIN; im ersten Jahr die Fristen und Meldungen in den USA"],
  ],
  kurz: "Wer eine US-LLC mit Wohnsitz in Deutschland führt, hat ihre Geschäftsleitung in der Regel in Deutschland (§ 10 AO). Der Gewinn wird dann hier besteuert: je nach Typenvergleich bei der Gesellschaft oder bei Ihnen als Gesellschafter. Die Gründung melden Sie dem Finanzamt in der Regel nach § 138 Abs. 2 AO mit der Steuererklärung, spätestens 14 Monate nach Ablauf des Jahres. Rechnungen an deutsche Unternehmen tragen in der Regel deutsche Umsatzsteuer, weil die LLC nicht als im Ausland ansässig gilt (§ 13b Abs. 7 UStG).",
  bloecke: [
    {
      typ: "text", id: "geschaeftsleitung", h2: "US-LLC mit Wohnsitz in Deutschland: Steuerpflicht",
      absaetze: [
        "Für das deutsche Steuerrecht ist maßgeblich, von wo aus die LLC geleitet wird. In welchem Bundesstaat sie eingetragen ist, entscheidet darüber nicht. Geschäftsleitung ist nach § 10 AO der Mittelpunkt der geschäftlichen Oberleitung, also der Ort, an dem die wichtigen Entscheidungen fallen. Wer allein in Deutschland wohnt und dort über Verträge, Preise und Zahlungen seiner LLC entscheidet, hat ihre Geschäftsleitung in der Regel in Deutschland. Eine Anschrift in Wyoming, Florida oder Delaware ändert daran nichts.",
        "Wie die LLC besteuert wird, richtet sich nach dem Typenvergleich. Das Finanzamt prüft, ob sie nach ihrem rechtlichen Aufbau eher einer deutschen Kapitalgesellschaft oder einer Personengesellschaft entspricht. Die Merkmale beschreibt das Schreiben des Bundesministeriums der Finanzen vom 19. März 2004. Der Bundesfinanzhof nennt acht: zentralisierte Geschäftsführung und Vertretung, beschränkte Haftung, freie Übertragbarkeit der Anteile, Gewinnzuteilung durch Ausschüttungsbeschluss, Kapitalaufbringung, unbegrenzte Lebensdauer, Gewinnverteilung und formale Gründungsvoraussetzungen. Maßgeblich ist das Gesamtbild; die Merkmale haben unterschiedliches Gewicht (Beschluss vom 18. Mai 2021, I B 75/20). Ob die LLC in den USA als steuerlich transparent gilt, ist für den Typenvergleich unerheblich. Dasselbe gilt für die Zahl der Gesellschafter.",
        "Daraus ergeben sich zwei Fälle. Entspricht die LLC einer Kapitalgesellschaft und liegt ihre Geschäftsleitung im Inland, ist sie selbst unbeschränkt körperschaftsteuerpflichtig, mit sämtlichen Einkünften (§ 1 Abs. 1 und 2 KStG). Zuständig ist das Finanzamt, in dessen Bezirk die Geschäftsleitung liegt (§ 20 Abs. 1 AO). Ausschüttungen an Sie werden bei Ihnen besteuert. Der Bundesfinanzhof hatte über eine LLC aus Colorado zu entscheiden. Ihr Alleingesellschafter und Geschäftsführer war nach Deutschland gezogen; damit lag auch ihre Geschäftsleitung hier. Das Gericht sah im Eilverfahren keine ernstlichen Zweifel, dass auf eine Überweisung vom Gesellschaftskonto an ihn Kapitalertragsteuer anzumelden war. Ist die LLC dagegen steuerlich transparent, wird ihr Gewinn Ihnen unmittelbar zugerechnet, unabhängig von einer Ausschüttung.",
        "Welcher Fall für Ihre LLC gilt, hängt vor allem vom Operating Agreement, dem Gesellschaftsvertrag der LLC, und vom Recht des Bundesstaats ab. Der Typenvergleich sollte deshalb vor der Gründung geklärt sein.",
      ],
    },
    {
      typ: "tabelle", id: "pflichten", h2: "Pflichten in Deutschland und den USA",
      lead: "Welche Zeile Sie betrifft, hängt von der Einordnung der LLC und von Ihrer Tätigkeit ab. Die Übersicht geht vom Kalenderjahr als Wirtschaftsjahr aus.",
      kopf: ["Pflicht", "Grundlage", "Frist", "Wer sie erfüllt"],
      zeilen: [
        ["Eröffnung eines Betriebs oder einer Betriebsstätte anzeigen (Gewerbeanzeige)", "§ 138 Abs. 1 AO, § 14 GewO", "mit dem Beginn; nach der AO innerhalb eines Monats", "Sie, mit Ihrem Steuerberater"],
        ["Auskünfte zur steuerlichen Erfassung, elektronisch", "§ 138 Abs. 1b und 4 AO", "innerhalb eines Monats nach dem meldepflichtigen Ereignis", "Ihr Steuerberater"],
        ["Mitteilung der Gründung oder Beteiligung im Ausland", "§ 138 Abs. 2 und 5 AO", "mit der Steuererklärung, spätestens 14 Monate nach Ablauf des Jahres", "Ihr Steuerberater, mit den Gründungsunterlagen der LLC"],
        ["Umsatzsteuer: Rechnungen und Voranmeldungen", "§§ 13b, 14, 14a, 18 UStG", "laufend; Voranmeldung bis zum zehnten Tag nach Ablauf des Voranmeldungszeitraums", "Ihre Buchhaltung und Ihr Steuerberater"],
        ["Steuererklärungen in Deutschland", "§ 1 KStG und § 2 GewStG, oder Ihre Einkommensteuer", "jährlich", "Ihr Steuerberater"],
        ["Form 5472 mit Form 1120 an die IRS", "IRS, Instructions for Form 5472", IRS.frist5472, "ein US-Steuerberater (CPA)"],
        ["Jahresmeldung beim Bundesstaat", "Recht des Bundesstaats", `je nach Staat, in Florida ${STAAT.florida.jahrFrist}`, "die Gesellschaft selbst oder ein von ihr beauftragter Dienstleister"],
        ["Meldung der wirtschaftlich Berechtigten (BOI) an FinCEN", "FinCEN, Regel vom August 2026", "entfällt für in den USA gegründete Gesellschaften", "niemand"],
      ],
      fuss: ["Welche Pflichten in Ihrem Fall gelten, klärt Ihr Steuerberater."],
    },
    {
      typ: "text", id: "meldung", h2: "§ 138 AO: Meldefrist 14 Monate",
      absaetze: [
        "Wer in Deutschland wohnt, teilt dem Finanzamt bestimmte Beziehungen ins Ausland mit (§ 138 Abs. 2 AO). Welcher Fall die US-LLC erfasst, hängt von ihrer Einordnung ab. Wird sie wie eine Kapitalgesellschaft eingeordnet, ist sie eine Drittstaat-Gesellschaft: eine Körperschaft mit Sitz oder Geschäftsleitung außerhalb von EU und EFTA (Abs. 3). Dafür genügt ihr Sitz in den USA. Meldepflichtig ist, wer allein oder mit nahestehenden Personen erstmals einen beherrschenden oder bestimmenden Einfluss auf eine solche Gesellschaft ausüben kann (Nr. 4). Bei einem Alleingesellschafter ist das regelmäßig der Fall. Wird die LLC als transparent eingeordnet, kommt der Erwerb einer Beteiligung an einer ausländischen Personengesellschaft in Betracht (Nr. 2).",
        "Die Grenze von zehn Prozent oder 150.000 Euro Anschaffungskosten (Nr. 3) gilt für Beteiligungen an Gesellschaften mit Sitz und Geschäftsleitung außerhalb Deutschlands. Wird die LLC von Deutschland aus geleitet, liegt ihre Geschäftsleitung im Inland; diese Grenze greift dann meist nicht. Welche Nummer in Ihrem Fall gilt, klärt Ihr Steuerberater; die Meldung gehört in jedem Fall auf seine Liste.",
        "Sie melden zusammen mit der Einkommen-, Körperschaft- oder Feststellungserklärung für das Jahr der Gründung, spätestens 14 Monate nach Ablauf dieses Jahres (§ 138 Abs. 5 AO). Wer keine solche Erklärung abgeben muss, meldet spätestens 14 Monate nach Ende des Kalenderjahres der Gründung.",
        "Eine Frist von einem Monat gilt für zwei andere Mitteilungen: die Eröffnung eines Betriebs oder einer Betriebsstätte und die Auskünfte zur steuerlichen Erfassung (§ 138 Abs. 1, 1b und 4 AO). Für die Meldung nach Absatz 2 gilt sie nicht. Wird diese Meldung vorsätzlich oder leichtfertig nicht, unvollständig oder verspätet abgegeben, sieht das Gesetz ein Bußgeld von höchstens 25.000 Euro vor (§ 379 Abs. 2 und 7 AO).",
      ],
    },
    {
      typ: "text", id: "gewerbe", h2: "Gewerbeanmeldung und Betriebsstätte",
      absaetze: [
        "Die Stätte der Geschäftsleitung ist nach § 12 Satz 2 AO eine Betriebsstätte. Wer seine LLC aus dem Arbeitszimmer in Deutschland leitet, unterhält damit in der Regel eine Betriebsstätte im Inland. Ein eigenes Büro ist dafür nicht erforderlich.",
        "Daraus ergeben sich drei Fragen, die vor Beginn der Tätigkeit geklärt sein sollten. Erstens die Gewerbeanzeige: Wer ein stehendes Gewerbe, eine Zweigniederlassung oder eine unselbständige Zweigstelle beginnt, zeigt das gleichzeitig der zuständigen Behörde an (§ 14 Abs. 1 GewO). Steuerlich ist die Eröffnung einer Betriebsstätte der Gemeinde mitzuteilen (§ 138 Abs. 1 AO). Zweitens die Gewerbesteuer: Sie erfasst jeden stehenden Gewerbebetrieb, soweit für ihn im Inland eine Betriebsstätte unterhalten wird. Die Tätigkeit von Kapitalgesellschaften gilt stets und in vollem Umfang als Gewerbebetrieb (§ 2 Abs. 1 und 2 GewStG). Ob diese zweite Regel Ihre LLC erfasst, hängt von ihrer Einordnung ab. Drittens das Handelsregister: Die deutsche Zweigniederlassung eines Unternehmens mit Sitz im Ausland wird bei dem Gericht angemeldet, in dessen Bezirk sie besteht (§ 13d Abs. 1 HGB).",
        "Zwei Punkte hängen vom Einzelfall ab. Der erste: ob Ihre Tätigkeit ein Gewerbe ist oder ein freier Beruf, dessen Aufnahme nur dem Finanzamt mitgeteilt wird. Der zweite: ob aus der Betriebsstätte eine eintragungspflichtige Zweigniederlassung wird. Beide Fragen sollten vor der Gründung geklärt sein.",
      ],
    },
    {
      typ: "text", id: "rechnungen", h2: "Rechnungen: Umsatzsteuer oder Reverse Charge",
      absaetze: [
        "Eine Dienstleistung an ein Unternehmen wird grundsätzlich an dem Ort ausgeführt, von dem aus der Kunde sein Unternehmen betreibt (§ 3a Abs. 2 UStG). Leistet Ihre LLC an ein Unternehmen in Deutschland, unterliegt die Leistung damit dem deutschen Umsatzsteuerrecht. Zu klären bleibt, wer die Steuer schuldet.",
        "Für Leistungen eines im Ausland ansässigen Unternehmers schuldet der Kunde die Steuer selbst; das Verfahren heißt Reverse Charge (§ 13b Abs. 2 und 5 UStG). Die Rechnung weist dann keine Umsatzsteuer aus und trägt den Hinweis „Steuerschuldnerschaft des Leistungsempfängers“ (§ 14a Abs. 5 UStG). Im Ausland ansässig ist eine Gesellschaft aber grundsätzlich nur, wenn sie im Inland weder Sitz noch Geschäftsleitung noch eine an der Leistung beteiligte Betriebsstätte hat (§ 13b Abs. 7 UStG). Wird die LLC von Deutschland aus geleitet, trifft das in der Regel nicht zu. Dann schuldet die LLC die Umsatzsteuer selbst und weist sie auf der Rechnung aus. Ihre Voranmeldungen übermittelt sie jeweils bis zum zehnten Tag nach Ablauf des Voranmeldungszeitraums (§ 18 Abs. 1 UStG).",
        "Die Umsatzsteuer-Identifikationsnummer (USt-IdNr.) erteilt das Bundeszentralamt für Steuern auf Antrag (§ 27a Abs. 1 UStG). Für einen im Inland ansässigen Unternehmer kann die Kleinunternehmerregelung greifen. Voraussetzung ist ein Gesamtumsatz von höchstens 25.000 Euro im Vorjahr und höchstens 100.000 Euro im laufenden Jahr. Seine Umsätze sind dann von der Umsatzsteuer befreit. Er kann auf die Regelung verzichten, ist an den Verzicht aber mindestens fünf Kalenderjahre gebunden (§ 19 Abs. 1 und 3 UStG). Für Leistungen an Privatkunden gilt als Ort grundsätzlich der Ort, von dem aus Ihr Unternehmen betrieben wird (§ 3a Abs. 1 UStG). Für viele Leistungen gelten Sonderregeln.",
        "Jede Rechnung braucht die Pflichtangaben nach § 14 Abs. 4 UStG, darunter:",
      ],
      punkte: [
        "vollständiger Name und vollständige Anschrift der LLC und des Kunden",
        "Steuernummer oder Umsatzsteuer-Identifikationsnummer der LLC",
        "Ausstellungsdatum und eine fortlaufende, einmalig vergebene Rechnungsnummer",
        "Art und Umfang der Leistung und der Zeitpunkt, zu dem sie erbracht wurde",
        "Entgelt, Steuersatz und Steuerbetrag — im Fall einer Steuerbefreiung der Hinweis darauf",
        "bei Reverse Charge statt der Steuer die Angabe „Steuerschuldnerschaft des Leistungsempfängers“ (§ 14a Abs. 5 UStG)",
      ],
      nach: "Leistet die LLC an ein anderes Unternehmen und sind beide im Inland ansässig, ist die Rechnung grundsätzlich als elektronische Rechnung in einem strukturierten Format auszustellen (§ 14 Abs. 2 UStG). Für die Ansässigkeit im Inland genügt die Geschäftsleitung. Übergangsweise sind Papier oder, mit Zustimmung des Kunden, andere elektronische Formate erlaubt (§ 27 Abs. 38 UStG). Das gilt für Umsätze bis Ende 2026 allgemein, im Jahr 2027 noch bei einem Gesamtumsatz im Vorjahr von höchstens 800.000 Euro.",
    },
    {
      typ: "tabelle", id: "umsatzsteuer", h2: "Wer die Umsatzsteuer schuldet",
      lead: "Drei Fälle für eine Dienstleistung der LLC an ein Unternehmen in Deutschland.",
      kopf: ["Lage der LLC", "Wer die Steuer schuldet", "Was auf der Rechnung steht"],
      zeilen: [
        ["Im Inland weder Sitz noch Geschäftsleitung noch eine beteiligte Betriebsstätte", "der Kunde (§ 13b Abs. 2 und 5 UStG)", "keine Umsatzsteuer, dafür „Steuerschuldnerschaft des Leistungsempfängers“"],
        ["Von Deutschland aus geleitet", "die LLC selbst, weil sie nicht im Ausland ansässig ist (§ 13b Abs. 7 UStG)", "Steuersatz und Steuerbetrag, Steuernummer oder USt-IdNr."],
        ["Von Deutschland aus geleitet, Umsatz innerhalb der Kleinunternehmergrenzen", "niemand, solange die Regelung gilt (§ 19 UStG)", "der Hinweis auf die Steuerbefreiung"],
      ],
      fuss: ["Vereinfachte Übersicht für Dienstleistungen. Warenlieferungen, Leistungen an Privatkunden und Leistungen in andere EU-Staaten folgen eigenen Regeln. Welcher Fall auf Sie zutrifft, klärt Ihr Steuerberater."],
    },
    {
      typ: "text", id: "buchfuehrung", h2: "Buchführung: zwei Länder, dieselben Zahlen",
      absaetze: [
        "In Deutschland sind gewerbliche Unternehmer buchführungspflichtig, wenn ihr Gesamtumsatz im Kalenderjahr 800.000 Euro oder ihr Gewinn im Wirtschaftsjahr 80.000 Euro übersteigt (§ 141 Abs. 1 AO). Die Pflicht beginnt mit dem Wirtschaftsjahr, das auf den Hinweis des Finanzamts folgt (§ 141 Abs. 2 AO). Ob für Ihre LLC schon unterhalb dieser Grenzen eine Bilanz nötig ist und wie ihr Gewinn zu ermitteln ist, hängt von ihrer Einordnung ab. Bücher und Jahresabschlüsse sind zehn Jahre aufzubewahren, Buchungsbelege acht Jahre (§ 147 Abs. 3 AO).",
        `In den USA verlangt die IRS dauerhafte Bücher und Aufzeichnungen, die die Richtigkeit der Meldung belegen. Dazu gehören die Geschäfte zwischen der LLC und Ihnen. Form 5472 nennt unter anderem Einlagen in die Gesellschaft und Entnahmen aus ihr. Wird Form 5472 nicht rechtzeitig eingereicht oder fehlen die Aufzeichnungen, kann die IRS eine Strafe von ${IRS.strafe5472} festsetzen.`,
        "Für die Praxis folgt daraus zweierlei. Die LLC führt ein Konto nur für geschäftliche Zahlungen. Die Buchhaltung der LLC liefert Ihrem Steuerberater in Deutschland und dem US-Steuerberater (CPA) dieselben Zahlen. Was in Deutschland als Ausschüttung oder Entnahme erfasst ist, muss mit den Angaben auf Form 5472 übereinstimmen.",
      ],
    },
    {
      typ: "text", id: "dba", h2: "Das Doppelbesteuerungsabkommen: Reichweite und Grenzen",
      absaetze: [
        "Zwischen Deutschland und den USA gilt ein Abkommen zur Vermeidung der Doppelbesteuerung in der Fassung des Protokolls von 2006. Es verteilt Besteuerungsrechte, es schafft keine neuen. Gewerbliche Gewinne eines Unternehmens darf grundsätzlich der Staat besteuern, in dem es ansässig ist. Der andere Staat darf sie nur besteuern, soweit das Unternehmen dort durch eine Betriebsstätte tätig ist und die Gewinne ihr zuzurechnen sind (Art. 7).",
        "Für Gesellschaften, die ein Staat als steuerlich transparent behandelt, enthält das Abkommen eine eigene Regel (Art. 1 Abs. 7). Einkünfte, die über sie bezogen werden, gelten als Einkünfte einer in einem Staat ansässigen Person, soweit dieser Staat sie nach seinem Steuerrecht so behandelt. Diese Regel betrifft die LLC häufig. Die IRS behandelt eine LLC mit nur einem Gesellschafter nicht als eigenes Steuersubjekt, solange sie nichts anderes wählt. In Deutschland entscheidet der Typenvergleich. Wie das Abkommen auf Ihre LLC anzuwenden ist, klären Ihr Steuerberater und ein US-Steuerberater (CPA) gemeinsam; die Behandlung in beiden Ländern muss zueinander passen.",
        "Eine Gesellschaft, die von Deutschland aus geleitet wird, bleibt in der Regel auch nach dem Abkommen in Deutschland steuerpflichtig. Eine US-LLC ist kein Steuermodell.",
      ],
    },
    {
      typ: "karten", id: "alltag", h2: "Pflichten im laufenden Betrieb", spalten: 3,
      karten: [
        { tag: "Website", titel: "Impressum", text: "Wer geschäftsmäßig digitale Dienste anbietet, in der Regel gegen Entgelt, hat Informationspflichten (§ 5 DDG); das gilt etwa für eine Website. Leicht erkennbar anzugeben sind Name, Rechtsform und Vertretungsberechtigte. Hinzu kommen die Anschrift der Niederlassung, das Register mit Nummer, die E-Mail-Adresse und, falls vorhanden, die USt-IdNr. Die Anschrift des Registered Agent ist dafür nicht gedacht." },
        { tag: "Konto", titel: "Getrennte Zahlungen", text: "Zahlungen Ihrer Kunden gehen auf das Konto der LLC, nicht auf Ihr privates Konto. So bleiben die Bücher in beiden Ländern eindeutig, und Einlagen und Entnahmen lassen sich belegen. Diese Angaben verlangt Form 5472." },
        { tag: "Unterlagen", titel: "Unterlagen für Ihren Steuerberater", text: "Gründungsurkunde, Operating Agreement und EIN-Bestätigung braucht Ihr Steuerberater für den Typenvergleich und die Meldung an das Finanzamt. Halten Sie diese Unterlagen vollständig bereit." },
      ],
    },
    {
      typ: "etappen", id: "reihenfolge", h2: "Die Reihenfolge bis zur ersten Rechnung",
      etappen: [
        { titel: "Klärung vor der Gründung", text: "Bevor Sie etwas unterzeichnen, klären Sie mit Ihrem Steuerberater fünf Punkte: Ort der Geschäftsleitung, Einordnung nach dem Typenvergleich, Meldung nach § 138 AO, Gewerbe und Umsatzsteuer." },
        { titel: "Operating Agreement", text: "Der Gesellschaftsvertrag der LLC wird auf das Ergebnis des Typenvergleichs abgestimmt. Er bestimmt mit, wie das Finanzamt die Gesellschaft einordnet." },
        { titel: "Gründung und EIN", text: "Anmeldung beim Bundesstaat, Benennung des Registered Agent, Antrag auf die Steuernummer der Gesellschaft (EIN) bei der IRS. Nach Eintragung und EIN kann die Gesellschaft Verträge schließen und ein Konto beantragen; über das Konto entscheidet das jeweilige Institut." },
        { titel: "Anmeldung in Deutschland", text: "Anzeige der Betriebsstätte, Auskünfte zur steuerlichen Erfassung und Antrag auf die USt-IdNr. Maßgeblich ist jeweils das Ergebnis der Klärung vor der Gründung." },
        { titel: "Erste Rechnung", text: "Die LLC stellt sie im eigenen Namen aus, mit allen Pflichtangaben und der zutreffenden Umsatzsteuer. Der Kunde zahlt auf das Konto der LLC." },
        { titel: "Erstes Jahresende", text: "In Deutschland: Steuererklärung mit der Meldung nach § 138 AO. In den USA: Form 5472 mit Form 1120 an die IRS." },
      ],
    },
    {
      typ: "text", id: "fiaon", h2: "Was FIAON Global dabei übernimmt",
      absaetze: [
        `${GRUENDUNG.satz} ${UNTERLAGEN.satz}`,
        "Im ersten Jahr enthalten: die erste Jahresmeldung beim Bundesstaat und die erste jährliche US-Meldung (Form 5472 mit Form 1120).",
      ],
      punkte: [
        `${TEIL.ihrTeil}: ${GRUENDUNG.ihrTeil} ${UNTERLAGEN.ihrTeil}`,
        `Deutsche Seite: ${STEUERFRAGEN}; die laufende Steuererklärung mit der Meldung nach § 138 AO übernimmt Ihr Steuerberater.`,
        `${TEIL.bedingung}: ${satz("S3", "de")}`,
      ],
    },
    {
      typ: "text", id: "jahresbetreuung", h2: "Ab dem zweiten Jahr: die Jahresbetreuung",
      absaetze: [`Die Betreuung im ersten Jahr ist in Ihrem Mandat enthalten. Ab dem zweiten Jahr fallen die laufenden Kosten Ihrer Gesellschaft an: Staatsgebühr, Registered Agent und die jährliche US-Meldung. Mit der Jahresbetreuung übernehmen wir das auf Wunsch für ${P.jahres} im Jahr, Staatsgebühr enthalten.`],
      punkte: [
        "Registered Agent und US-Geschäftsadresse",
        "US-Telefonnummer",
        "Jährliche US-Meldung (Form 5472 mit Form 1120) durch einen US-Steuerberater (CPA) aus unserem Partnernetz",
        "Jahresmeldung beim Bundesstaat, Staatsgebühr enthalten",
        "Pflichtenkalender mit den US-Fristen",
        "Ihr fester Ansprechpartner",
      ],
      nach: "Wir berechnen die Jahresbetreuung jährlich im Voraus; sie verlängert sich nicht von selbst. Die laufende Buchhaltung und die Steuererklärungen in Deutschland bleiben bei Ihrem Steuerberater.",
    },
    { typ: "paket", id: "mandat", h2: P.karteH2, lead: P.karteLead, paket: "global_struktur" },
    {
      typ: "hinweis", id: "wissen", h2: "Was Sie wissen müssen",
      punkte: [
        `Dieser Beitrag erklärt die gesetzlichen Grundlagen mit Stand Oktober 2026. Er ersetzt keine steuerliche oder rechtliche Prüfung Ihres Falls. ${STEUERFRAGEN}; die laufende Steuererklärung übernimmt Ihr Steuerberater.`,
        GLOBAL_PFLICHTHINWEIS.de[0],
        GLOBAL_PFLICHTHINWEIS.de[1],
        `Nicht in Ihrem Mandat enthalten: ${NICHT_IM_MANDAT}.`,
        satz("S8", "de"),
        `${satz("S10", "de")} Wird die LLC von Deutschland aus geleitet, ist ihr Gewinn in der Regel in Deutschland zu versteuern.`,
      ],
    },
  ],
  fragen: [
    { f: "Muss ich meine US-LLC beim Finanzamt anmelden?", a: "In der Regel ja, wenn Sie die LLC von Deutschland aus leiten. Die Stätte der Geschäftsleitung ist eine Betriebsstätte (§ 12 AO). Ihre Eröffnung teilen Sie der Gemeinde mit; die Auskünfte zur steuerlichen Erfassung gehen elektronisch an das Finanzamt. Beides verlangt die AO jeweils innerhalb eines Monats (§ 138 Abs. 1, 1b und 4 AO). Die Gründung selbst melden Sie in der Regel nach § 138 Abs. 2 AO mit der Steuererklärung." },
    { f: "Bis wann muss ich die US-LLC nach § 138 AO melden?", a: "Sie melden mit der Einkommen-, Körperschaft- oder Feststellungserklärung für das Jahr der Gründung, spätestens 14 Monate nach Ablauf dieses Jahres (§ 138 Abs. 5 AO). Die Frist von einem Monat gilt nur für die Eröffnung eines Betriebs und die steuerliche Erfassung. Für eine vorsätzlich oder leichtfertig versäumte Meldung sieht das Gesetz ein Bußgeld von höchstens 25.000 Euro vor (§ 379 AO)." },
    { f: "Brauche ich für meine US-LLC eine Gewerbeanmeldung?", a: "Das hängt von Ihrer Tätigkeit ab. Wer ein stehendes Gewerbe, eine Zweigniederlassung oder eine unselbständige Zweigstelle beginnt, zeigt das gleichzeitig an (§ 14 GewO). Die Leitung von Deutschland aus begründet in der Regel eine Betriebsstätte. Ob Ihre Tätigkeit ein Gewerbe oder ein freier Beruf ist, klärt Ihr Steuerberater." },
    { f: "Darf meine US-LLC deutschen Kunden Rechnungen ohne Umsatzsteuer schreiben?", a: "Nur, wenn der Kunde die Steuer schuldet (Reverse Charge) oder eine Befreiung greift. Reverse Charge setzt voraus, dass die LLC im Inland weder Sitz noch Geschäftsleitung noch eine an der Leistung beteiligte Betriebsstätte hat (§ 13b Abs. 7 UStG). Wird sie von Deutschland aus geleitet, schuldet sie die Umsatzsteuer in der Regel selbst. Anders ist es, wenn die Kleinunternehmerregelung greift (§ 19 UStG)." },
    { f: "Welches Finanzamt ist für meine US-LLC zuständig?", a: "Wird die LLC wie eine Kapitalgesellschaft eingeordnet, ist das Finanzamt zuständig, in dessen Bezirk ihre Geschäftsleitung liegt (§ 20 Abs. 1 AO). Leiten Sie die LLC von zu Hause aus, ist es das Finanzamt an Ihrem Ort. Wird sie als transparent eingeordnet, geht ihr Gewinn in Ihre eigene Steuererklärung ein." },
    { f: "Muss meine US-LLC in Deutschland Bücher führen?", a: "Gewerbliche Unternehmer sind buchführungspflichtig, wenn der Umsatz 800.000 Euro im Kalenderjahr oder der Gewinn 80.000 Euro im Wirtschaftsjahr übersteigt (§ 141 AO). Ob für Ihre LLC schon früher eine Bilanz nötig ist, hängt von ihrer Einordnung ab. Bücher sind zehn Jahre aufzubewahren, Buchungsbelege acht Jahre (§ 147 AO)." },
    { f: "Schützt mich das Doppelbesteuerungsabkommen vor der deutschen Steuer?", a: "Nein. Das Abkommen zwischen Deutschland und den USA verteilt Besteuerungsrechte und vermeidet, dass derselbe Gewinn zweimal besteuert wird. Wird die LLC von Deutschland aus geleitet, bleibt sie in der Regel in Deutschland steuerpflichtig. Für steuerlich transparente Gesellschaften enthält das Abkommen eine eigene Regel (Art. 1 Abs. 7)." },
    { f: "Was übernimmt FIAON Global, was mein Steuerberater?", a: `Wir gründen die LLC, bereiten die Gründungsunterlagen mit dem Operating Agreement vor und beantragen EIN und ITIN. Im ersten Jahr sind der Registered Agent und die erste jährliche US-Meldung enthalten. Laufende Buchhaltung und Steuererklärungen in Deutschland, mit der Meldung nach § 138 AO, übernimmt Ihr Steuerberater; die Unterlagen dafür liegen nach der Eintragung in Ihrem Portal. ${satz("S3", "de")}` },
  ],
  paket: "global_struktur",
  weiter: ["/business/wissen/us-llc-steuern", "/business/aus-deutschland", "/business/wissen/llc-steuererklaerung", "/business/wissen/nachteile-us-llc"],
  quellen: [
    QL.ao10, Q.ao138, QL.ao379, QL.ao12, QL.ao20, QL.kstg1, QL.bmf, QL.bfh, QL.gewo14, QL.gewstg2, QL.hgb13d,
    QL.ustg3a, QL.ustg13b, QL.ustg14, QL.ustg14a, QL.ustg18, QL.ustg19, QL.ustg27, QL.ustg27a, QL.ao141, QL.ao147, QL.ddg5,
    Q.dba, QL.dbaIrs, Q.i5472, Q.i1120, QUELLEN_IRS[5], Q.smllc, QUELLEN_STAATEN.florida[1], Q.boiEnde,
  ],
};
