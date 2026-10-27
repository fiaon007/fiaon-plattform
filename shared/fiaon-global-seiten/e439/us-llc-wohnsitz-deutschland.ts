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
import { GLOBAL_PFLICHTHINWEIS, GLOBAL_ROLLEN, GLOBAL_JAHRESBETREUUNG, GLOBAL_NICHT_INKLUSIVE, GLOBAL_GELD_ZURUECK } from "../../fiaon-global";
import { QUELLEN_WISSEN as Q, QUELLEN_IRS, QUELLEN_STAATEN, IRS, STAAT } from "../fakten";

const S = "2026-10-27";

/** Strafe der IRS ohne den Zusatz „je Formular und Jahr“ — für die Kennziffer. */
const STRAFE_5472 = IRS.strafe5472.split(" je ")[0];

const GELD_ZURUECK = GLOBAL_GELD_ZURUECK.aktiv ? [`${GLOBAL_GELD_ZURUECK.de.text} ${GLOBAL_GELD_ZURUECK.de.bedingungen}`] : [];

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
    beschreibung: "US-LLC, Wohnsitz in Deutschland: Finanzamt, Meldung nach § 138 AO, Gewerbe, Umsatzsteuer auf Rechnungen, Buchführung — mit Fundstellen erklärt.",
  },
  stand: S,
  erschienen: S,
  kennung: "FG · 47",
  auge: "Wissen · Steuern und Pflichten",
  h1: "US-LLC mit Wohnsitz in Deutschland.",
  h1b: "Anmelden, melden, richtig abrechnen.",
  lead: "Wer mit Wohnsitz in Deutschland eine US-LLC führt, hat Pflichten in zwei Ländern. Die amerikanische Seite ist überschaubar: Form 5472, Registered Agent, Jahresmeldung beim Bundesstaat. Die deutsche Seite fragt mehr: Finanzamt, Meldung nach § 138 AO, Gewerbe, Umsatzsteuer auf Rechnungen, Buchführung. Hier steht, was das Gesetz verlangt, jeweils mit Fundstelle — und welchen Teil FIAON Global mit Partner-Steuerberater, Partner-Anwalt und US-CPA für Sie übernimmt.",
  ziffern: [
    { wert: "14 Monate", label: "spätestens: Meldung nach § 138 AO, mit der Steuererklärung" },
    { wert: "1 Monat", label: "für Betriebseröffnung und steuerliche Erfassung" },
    { wert: STRAFE_5472, label: "Strafe der IRS je versäumter Form 5472" },
  ],
  blick: [
    ["Steuerpflicht", "Wo die LLC geleitet wird (§ 10 AO), meist also in Deutschland"],
    ["Einordnung", "Typenvergleich: wie eine Kapitalgesellschaft oder transparent"],
    ["Meldung", "§ 138 AO mit der Steuererklärung, spätestens nach 14 Monaten"],
    ["Rechnungen", "Von hier geleitet: in der Regel mit deutscher Umsatzsteuer"],
    ["USA", "Form 5472 mit Form 1120, jährlich, auch ohne Umsatz"],
    ["Mit FIAON Global", "Ein Ansprechpartner statt acht, Prüfung vor der Gründung im Festpreis"],
  ],
  kurz: "Führen Sie eine US-LLC mit Wohnsitz in Deutschland, liegt ihre Geschäftsleitung in der Regel hier (§ 10 AO). Dann ist in Deutschland zu versteuern: je nach Typenvergleich die Gesellschaft selbst, wie eine GmbH, oder ihr Gewinn bei Ihnen als Gesellschafter. Die Gründung melden Sie dem Finanzamt in der Regel nach § 138 Abs. 2 AO mit der Steuererklärung, spätestens 14 Monate nach Ablauf des Jahres. Und weil die LLC von hier aus geleitet wird, gilt sie umsatzsteuerlich nicht als im Ausland ansässig (§ 13b Abs. 7 UStG): Rechnungen an deutsche Unternehmen tragen dann in der Regel deutsche Umsatzsteuer statt des Reverse-Charge-Hinweises.",
  bloecke: [
    {
      typ: "text", id: "geschaeftsleitung", h2: "US-LLC mit Wohnsitz in Deutschland: wo die Steuerpflicht entsteht",
      absaetze: [
        "Für das deutsche Steuerrecht zählt nicht, wo die LLC eingetragen ist, sondern von wo aus sie geleitet wird. Geschäftsleitung ist nach § 10 AO der Mittelpunkt der geschäftlichen Oberleitung — der Ort, an dem die wichtigen Entscheidungen fallen. Wer allein in Deutschland wohnt und dort über Verträge, Preise und Zahlungen seiner LLC entscheidet, hat ihre Geschäftsleitung in aller Regel in Deutschland. Daran ändert eine Anschrift in Wyoming, Florida oder Delaware nichts.",
        "Wie die LLC dann besteuert wird, entscheidet ein Typenvergleich: Das Finanzamt prüft, ob sie nach ihrem rechtlichen Aufbau eher einer deutschen Kapitalgesellschaft oder einer Personengesellschaft entspricht. Die Merkmale hat das Bundesministerium der Finanzen im Schreiben vom 19. März 2004 beschrieben. Der Bundesfinanzhof zählt acht auf: zentralisierte Geschäftsführung und Vertretung, beschränkte Haftung, freie Übertragbarkeit der Anteile, Gewinnzuteilung durch Ausschüttungsbeschluss, Kapitalaufbringung, unbegrenzte Lebensdauer, Gewinnverteilung und formale Gründungsvoraussetzungen. Entscheidend ist das Gesamtbild, und die Merkmale wiegen nicht gleich schwer (Beschluss vom 18. Mai 2021, I B 75/20). Ob die LLC in den USA als transparent gilt, spielt für den Typenvergleich keine Rolle, und auch die Zahl der Gesellschafter ist dafür unerheblich.",
        "Daraus folgen zwei Wege. Entspricht die LLC einer Kapitalgesellschaft, ist sie mit Geschäftsleitung im Inland selbst unbeschränkt körperschaftsteuerpflichtig, und zwar mit sämtlichen Einkünften (§ 1 Abs. 1 und 2 KStG); zuständig ist das Finanzamt, in dessen Bezirk die Geschäftsleitung liegt (§ 20 Abs. 1 AO). Was sie an Sie ausschüttet, wird bei Ihnen besteuert. Im Fall des Bundesfinanzhofs — eine LLC aus Colorado, deren Alleingesellschafter und Geschäftsführer nach Deutschland gezogen war, womit auch ihre Geschäftsleitung hier lag — sah das Gericht im Eilverfahren keine ernstlichen Zweifel, dass auf eine Überweisung vom Gesellschaftskonto an ihn Kapitalertragsteuer anzumelden war. Ist die LLC dagegen steuerlich transparent, wird ihr Gewinn Ihnen unmittelbar zugerechnet, ob er ausgeschüttet wird oder nicht.",
        "Welcher Weg für Ihre LLC gilt, hängt vor allem vom Operating Agreement und vom Recht des Bundesstaats ab. Der Typenvergleich gehört deshalb vor die Gründung, nicht in die erste Steuererklärung.",
      ],
    },
    {
      typ: "tabelle", id: "pflichten", h2: "Die Pflichten in Deutschland und in den USA auf einen Blick",
      lead: "Welche Zeile Sie betrifft, hängt von der Einordnung der LLC und von Ihrer Tätigkeit ab. Die Übersicht nimmt das Kalenderjahr als Wirtschaftsjahr an.",
      kopf: ["Pflicht", "Grundlage", "Frist", "Wer sie erledigt"],
      zeilen: [
        ["Eröffnung eines Betriebs oder einer Betriebsstätte anzeigen (Gewerbeanzeige)", "§ 138 Abs. 1 AO, § 14 GewO", "mit dem Beginn; nach der AO innerhalb eines Monats", "Sie, vorbereitet mit Ihrer Steuerkanzlei"],
        ["Auskünfte zur steuerlichen Erfassung, elektronisch", "§ 138 Abs. 1b und 4 AO", "innerhalb eines Monats nach dem meldepflichtigen Ereignis", "Ihre Steuerkanzlei"],
        ["Mitteilung der Gründung oder Beteiligung im Ausland", "§ 138 Abs. 2 und 5 AO", "mit der Steuererklärung, spätestens 14 Monate nach Ablauf des Jahres", "Ihre Steuerkanzlei, mit den Unterlagen aus Ihrem Dokumentenraum"],
        ["Umsatzsteuer: Rechnungen und Voranmeldungen", "§§ 13b, 14, 14a, 18 UStG", "laufend; Voranmeldung bis zum zehnten Tag nach Ablauf des Voranmeldungszeitraums", "Ihre Buchhaltung und Steuerkanzlei"],
        ["Steuererklärungen in Deutschland", "§ 1 KStG und § 2 GewStG, oder Ihre Einkommensteuer", "jährlich", "Ihre Steuerkanzlei"],
        ["Form 5472 mit Form 1120 an die IRS", "IRS, Instructions for Form 5472", IRS.frist5472, "unser US-CPA, im ersten Jahr im Paket"],
        ["Jahresmeldung beim Bundesstaat", "Recht des Bundesstaats", `je nach Staat, in Florida ${STAAT.florida.jahrFrist}`, "FIAON, ab dem zweiten Jahr mit der Jahresbetreuung"],
        ["Meldung der wirtschaftlich Berechtigten (BOI) an FinCEN", "FinCEN, Regel vom August 2026", "entfällt für in den USA gegründete Gesellschaften", "niemand"],
      ],
      fuss: ["Die laufende Buchhaltung und die Steuererklärungen in Deutschland sind nicht Teil der Pakete. Welche Pflichten im Einzelfall greifen, prüft der Steuerberater."],
    },
    {
      typ: "text", id: "meldung", h2: "§ 138 AO: die Meldung der US-LLC — 14 Monate, nicht ein Monat",
      absaetze: [
        "Wer in Deutschland wohnt, teilt dem Finanzamt bestimmte Beziehungen ins Ausland mit (§ 138 Abs. 2 AO). Welcher Fall die US-LLC erfasst, hängt von ihrer Einordnung ab. Wird sie wie eine Kapitalgesellschaft eingeordnet, ist sie eine Drittstaat-Gesellschaft: eine Körperschaft mit Sitz oder Geschäftsleitung außerhalb von EU und EFTA (Abs. 3). Dafür genügt ihr Sitz in den USA. Wer allein oder mit nahestehenden Personen erstmals einen beherrschenden oder bestimmenden Einfluss auf eine solche Gesellschaft ausüben kann, meldet das (Nr. 4) — als Alleingesellschafter ist das regelmäßig der Fall. Wird die LLC als transparent eingeordnet, kommt der Erwerb einer Beteiligung an einer ausländischen Personengesellschaft in Betracht (Nr. 2).",
        "Eine oft zitierte Regel greift dagegen meist nicht: Die Grenze von zehn Prozent oder 150.000 Euro Anschaffungskosten (Nr. 3) gilt für Beteiligungen an Gesellschaften mit Sitz und Geschäftsleitung außerhalb Deutschlands. Wird die LLC von hier aus geleitet, liegt ihre Geschäftsleitung im Inland. Welche Nummer in Ihrem Fall greift, prüft der Steuerberater; auf seine Liste gehört die Meldung in jedem Fall.",
        "Gemeldet wird zusammen mit der Einkommen-, Körperschaft- oder Feststellungserklärung für das Jahr, in dem die Gründung stattfand — spätestens 14 Monate nach Ablauf dieses Jahres (§ 138 Abs. 5 AO). Wer keine solche Erklärung abgeben muss, meldet spätestens 14 Monate nach Ende des Kalenderjahres, in dem die Gründung lag.",
        "Manche Darstellungen nennen für diese Meldung eine Frist von einem Monat. Die gilt für etwas anderes: für die Mitteilung, dass ein Betrieb oder eine Betriebsstätte eröffnet wird, und für die Auskünfte zur steuerlichen Erfassung (§ 138 Abs. 1, 1b und 4 AO). Wer die Meldung nach Absatz 2 vorsätzlich oder leichtfertig nicht, unvollständig oder verspätet abgibt, riskiert ein Bußgeld von höchstens 25.000 Euro (§ 379 Abs. 2 und 7 AO).",
      ],
    },
    {
      typ: "text", id: "gewerbe", h2: "Gewerbeanmeldung und Betriebsstätte: ein Hinweis",
      absaetze: [
        "Die Stätte der Geschäftsleitung ist nach § 12 Satz 2 AO eine Betriebsstätte. Wer seine LLC aus dem Arbeitszimmer in Deutschland leitet, unterhält damit in der Regel eine Betriebsstätte im Inland, auch ohne Büro mit Firmenschild.",
        "Daraus ergeben sich drei Fragen, die vor dem Start beantwortet sein sollten. Die erste ist die Gewerbeanzeige: Wer ein stehendes Gewerbe, eine Zweigniederlassung oder eine unselbständige Zweigstelle beginnt, zeigt das gleichzeitig der zuständigen Behörde an (§ 14 Abs. 1 GewO); steuerlich ist die Eröffnung einer Betriebsstätte der Gemeinde mitzuteilen (§ 138 Abs. 1 AO). Die zweite ist die Gewerbesteuer: Sie erfasst jeden stehenden Gewerbebetrieb, soweit für ihn im Inland eine Betriebsstätte unterhalten wird; die Tätigkeit von Kapitalgesellschaften gilt stets und in vollem Umfang als Gewerbebetrieb (§ 2 Abs. 1 und 2 GewStG). Ob die zweite Regel Ihre LLC erfasst, hängt wieder von ihrer Einordnung ab. Die dritte ist das Handelsregister: Hat ein Unternehmen mit Sitz im Ausland eine Zweigniederlassung in Deutschland, wird sie bei dem Gericht angemeldet, in dessen Bezirk sie besteht (§ 13d Abs. 1 HGB).",
        "Ob Ihre Tätigkeit ein Gewerbe ist oder ein freier Beruf, dessen Aufnahme nur dem Finanzamt mitgeteilt wird, und ob aus der Betriebsstätte eine eintragungspflichtige Zweigniederlassung wird, hängt vom Einzelfall ab. Diese Fragen gehören in die Prüfung vor der Gründung.",
      ],
    },
    {
      typ: "text", id: "rechnungen", h2: "US-LLC und Rechnungen: Umsatzsteuer oder Reverse Charge?",
      absaetze: [
        "Erbringt Ihre LLC eine Dienstleistung an ein Unternehmen in Deutschland, wird sie grundsätzlich an dem Ort ausgeführt, von dem aus der Kunde sein Unternehmen betreibt (§ 3a Abs. 2 UStG). Die Leistung fällt also unter das deutsche Umsatzsteuerrecht. Offen ist nur, wer die Steuer schuldet.",
        "Für Leistungen eines im Ausland ansässigen Unternehmers schuldet der Kunde die Steuer selbst (§ 13b Abs. 2 und 5 UStG). Die Rechnung weist dann keine Umsatzsteuer aus und trägt den Hinweis „Steuerschuldnerschaft des Leistungsempfängers“ (§ 14a Abs. 5 UStG). Im Ausland ansässig ist eine Gesellschaft aber grundsätzlich nur, wenn sie im Inland weder Sitz noch Geschäftsleitung noch eine an der Leistung beteiligte Betriebsstätte hat (§ 13b Abs. 7 UStG). Wird die LLC von Deutschland aus geleitet, trifft das in der Regel nicht zu: Dann schuldet die LLC die Umsatzsteuer selbst, weist sie auf der Rechnung aus und übermittelt Voranmeldungen, jeweils bis zum zehnten Tag nach Ablauf des Voranmeldungszeitraums (§ 18 Abs. 1 UStG).",
        "Die Umsatzsteuer-Identifikationsnummer erteilt das Bundeszentralamt für Steuern auf Antrag (§ 27a Abs. 1 UStG). Liegt der Gesamtumsatz im Vorjahr bei höchstens 25.000 Euro und im laufenden Jahr bei höchstens 100.000 Euro, kann für einen im Inland ansässigen Unternehmer die Kleinunternehmerregelung greifen; seine Umsätze sind dann von der Umsatzsteuer befreit. Er kann auf die Regelung verzichten, ist an den Verzicht aber mindestens fünf Kalenderjahre gebunden (§ 19 Abs. 1 und 3 UStG). Für Leistungen an Privatkunden gilt als Ort grundsätzlich der Ort, von dem aus Ihr Unternehmen betrieben wird (§ 3a Abs. 1 UStG); für viele Leistungen gelten Sonderregeln.",
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
      nach: "Leistet die LLC an ein anderes Unternehmen und sind beide im Inland ansässig — dazu zählt die Geschäftsleitung —, ist die Rechnung grundsätzlich als elektronische Rechnung in einem strukturierten Format auszustellen (§ 14 Abs. 2 UStG). Übergangsweise sind Papier oder, mit Zustimmung des Kunden, andere elektronische Formate erlaubt: für Umsätze bis Ende 2026 allgemein, im Jahr 2027 noch bei einem Gesamtumsatz im Vorjahr von höchstens 800.000 Euro (§ 27 Abs. 38 UStG).",
    },
    {
      typ: "tabelle", id: "umsatzsteuer", h2: "Wer auf der Rechnung die Umsatzsteuer schuldet",
      lead: "Dienstleistung der LLC an ein Unternehmen in Deutschland — drei typische Lagen.",
      kopf: ["Lage der LLC", "Wer schuldet die Steuer?", "Was auf der Rechnung steht"],
      zeilen: [
        ["Im Inland weder Sitz noch Geschäftsleitung noch eine beteiligte Betriebsstätte", "der Kunde (§ 13b Abs. 2 und 5 UStG)", "keine Umsatzsteuer, dafür „Steuerschuldnerschaft des Leistungsempfängers“"],
        ["Von Deutschland aus geleitet", "die LLC selbst, weil sie nicht im Ausland ansässig ist (§ 13b Abs. 7 UStG)", "Steuersatz und Steuerbetrag, Steuernummer oder USt-IdNr."],
        ["Von Deutschland aus geleitet, Umsatz innerhalb der Kleinunternehmergrenzen", "niemand, solange die Regelung gilt (§ 19 UStG)", "der Hinweis auf die Steuerbefreiung"],
      ],
      fuss: ["Vereinfachte Übersicht für Dienstleistungen. Warenlieferungen, Leistungen an Privatkunden und Leistungen in andere EU-Staaten folgen eigenen Regeln; welche Lage auf Sie zutrifft, prüft der Steuerberater im Einzelfall."],
    },
    {
      typ: "text", id: "buchfuehrung", h2: "Buchführung: zwei Länder, dieselben Zahlen",
      absaetze: [
        "In Deutschland sind gewerbliche Unternehmer buchführungspflichtig, wenn ihr Gesamtumsatz im Kalenderjahr 800.000 Euro oder ihr Gewinn im Wirtschaftsjahr 80.000 Euro übersteigt (§ 141 Abs. 1 AO); die Pflicht beginnt mit dem Wirtschaftsjahr, das auf den Hinweis des Finanzamts folgt (§ 141 Abs. 2 AO). Ob für Ihre LLC schon unterhalb dieser Grenzen eine Bilanz nötig ist und wie ihr Gewinn zu ermitteln ist, hängt von ihrer Einordnung ab. Bücher und Jahresabschlüsse sind zehn Jahre aufzubewahren, Buchungsbelege acht Jahre (§ 147 Abs. 3 AO).",
        `In den USA verlangt die IRS dauerhafte Bücher und Aufzeichnungen, die die Richtigkeit der Meldung belegen, einschließlich der Geschäfte zwischen der LLC und Ihnen. Auf Form 5472 erscheinen unter anderem Einlagen in die Gesellschaft und Entnahmen aus ihr. Wer Form 5472 nicht rechtzeitig einreicht oder die Aufzeichnungen nicht führt, riskiert eine Strafe von ${IRS.strafe5472}.`,
        "Praktisch heißt das: ein Konto der LLC, auf dem nur Geschäftliches läuft, und eine Buchhaltung, aus der die Kanzlei in Deutschland und der US-CPA dieselben Zahlen lesen. Was in Deutschland als Ausschüttung oder Entnahme gebucht wird, muss zu dem passen, was auf Form 5472 steht.",
      ],
    },
    {
      typ: "text", id: "dba", h2: "Das Doppelbesteuerungsabkommen: was es regelt — und was nicht",
      absaetze: [
        "Zwischen Deutschland und den USA gilt ein Abkommen zur Vermeidung der Doppelbesteuerung in der Fassung des Protokolls von 2006. Es verteilt Besteuerungsrechte, es schafft keine neuen. Gewerbliche Gewinne eines Unternehmens darf grundsätzlich der Staat besteuern, in dem es ansässig ist; der andere Staat nur, soweit das Unternehmen dort durch eine Betriebsstätte tätig ist und die Gewinne ihr zuzurechnen sind (Art. 7).",
        "Für Gesellschaften, die ein Staat als steuerlich transparent behandelt, enthält das Abkommen eine eigene Regel: Einkünfte, die über sie bezogen werden, gelten als Einkünfte einer in einem Staat ansässigen Person, soweit dieser Staat sie nach seinem Steuerrecht so behandelt (Art. 1 Abs. 7). Genau das betrifft die LLC häufig: Die IRS behandelt eine LLC mit nur einem Gesellschafter nicht als eigenes Steuersubjekt, solange sie nichts anderes wählt — in Deutschland entscheidet der Typenvergleich. Wie das Abkommen auf Ihre LLC anzuwenden ist, prüfen Steuerberater und US-CPA gemeinsam; beide Seiten müssen zusammenpassen.",
        "Was das Abkommen nicht leistet: Es macht aus einer Gesellschaft, die von Deutschland aus geleitet wird, keine Gesellschaft, die nur in den USA steuerpflichtig ist. Eine US-LLC ist kein Steuermodell.",
      ],
    },
    {
      typ: "karten", id: "alltag", h2: "Was im Alltag dazugehört", spalten: 3,
      karten: [
        { tag: "Website", titel: "Impressum", text: "Wer geschäftsmäßig, in der Regel gegen Entgelt digitale Dienste anbietet, etwa eine Website, nennt leicht erkennbar Name und Anschrift, unter der er niedergelassen ist, Rechtsform, Vertretungsberechtigte, das Register mit Nummer, E-Mail und, falls vorhanden, die USt-IdNr. (§ 5 DDG). Die Anschrift des Registered Agent ist dafür nicht gedacht." },
        { tag: "Konto", titel: "Getrennte Zahlungen", text: "Zahlungen Ihrer Kunden gehen auf das Konto der LLC, nicht auf Ihr privates Konto. Das hält die Bücher in beiden Ländern sauber und macht Einlagen und Entnahmen nachvollziehbar — genau die Zahlen, die Form 5472 verlangt." },
        { tag: "Unterlagen", titel: "Griffbereit für die Kanzlei", text: "Gründungsurkunde, Operating Agreement und EIN-Bestätigung braucht Ihre Steuerkanzlei für Typenvergleich und Meldung. Bei FIAON Global liegen sie von Anfang an in Ihrem Dokumentenraum." },
      ],
    },
    {
      typ: "etappen", id: "reihenfolge", h2: "In dieser Reihenfolge: von der Idee bis zur ersten Rechnung",
      etappen: [
        { titel: "Prüfung vor der Gründung", text: "Ort der Geschäftsleitung, Einordnung nach dem Typenvergleich, Meldung nach § 138 AO, Gewerbe und Umsatzsteuer werden geklärt, bevor etwas unterschrieben ist." },
        { titel: "Operating Agreement", text: "Der Vertrag der LLC wird auf das Ergebnis des Typenvergleichs abgestimmt. Bei FIAON Global schreibt ihn unser Partner-Anwalt." },
        { titel: "Gründung und EIN", text: "Eintragung beim Bundesstaat, Registered Agent, EIN bei der IRS. Danach kann die Gesellschaft Verträge schließen und ein Konto beantragen." },
        { titel: "Anmeldung in Deutschland", text: "Anzeige der Betriebsstätte, Auskünfte zur steuerlichen Erfassung, Antrag auf die USt-IdNr. — jeweils so, wie es die Prüfung ergeben hat." },
        { titel: "Erste Rechnung", text: "Mit allen Pflichtangaben und der richtigen Umsatzsteuer, ausgestellt im Namen der LLC und bezahlt auf ihr Konto." },
        { titel: "Erstes Jahresende", text: "Steuererklärung in Deutschland mit der Meldung nach § 138 AO; Form 5472 mit Form 1120 an die IRS." },
      ],
    },
    {
      typ: "text", id: "fiaon", h2: "So übernimmt FIAON Global die Pflichten auf beiden Seiten",
      absaetze: [
        "FIAON Global ist eine Unternehmensberatung für den Weg in die USA, mit einem Grundsatz: ein Ansprechpartner statt acht. Mit Ihrer Vollmacht stellen wir die Anträge für Sie — Gründung, EIN, die Vorbereitung der ITIN, D-U-N-S-Nummer, Meldungen, Registered Agent, US-Adresse und US-Telefon im ersten Jahr. Nur Konto-, Karten- und Kreditanträge stellen Sie selbst; wir bereiten sie vollständig vor. FIAON ist keine Bank, vergibt und vermittelt keine Kredite; über Konto, Karte, Rahmen und Darlehen entscheidet allein das Institut.",
        `Für die deutsche Seite gilt: Ihren Fall prüft vor der Gründung unser Partner-Steuerberater — Ort der Geschäftsleitung, Einordnung nach dem Typenvergleich, Meldung nach § 138 AO. Auf dieses Ergebnis hin schreibt unser Partner-Anwalt das Operating Agreement. Die erste US-Meldung, Form 5472 mit Form 1120, übernimmt unser US-CPA. ${GLOBAL_ROLLEN.de.partner}`,
        "So beginnt Ihre Steuerkanzlei nicht bei null: Ergebnis der Prüfung, Gründungsurkunde, Operating Agreement und EIN-Bestätigung liegen geordnet in Ihrem Dokumentenraum, wenn die erste Erklärung mit der Meldung nach § 138 AO ansteht. Unser Team vor Ort in Miami erledigt die Termine in den USA, Partnerstandort ist Zürich, Vertragspartner die FIAON LTD in London. Sie zahlen einen Festpreis, alle Gebühren des Pakets inklusive.",
        ...GELD_ZURUECK,
      ],
    },
    {
      typ: "text", id: "jahresbetreuung", h2: "Ab dem zweiten Jahr: die Jahresbetreuung",
      absaetze: [GLOBAL_JAHRESBETREUUNG.de.lead],
      punkte: [...GLOBAL_JAHRESBETREUUNG.de.leistungen],
      nach: `${GLOBAL_JAHRESBETREUUNG.de.bedingungen} Die laufende Buchhaltung und die Steuererklärungen in Deutschland bleiben bei Ihrer Steuerkanzlei.`,
    },
    { typ: "paket", id: "paket", h2: "Der saubere Start, beide Seiten im Blick", lead: "Gründung, EIN, Registered Agent, Operating Agreement durch unseren Partner-Anwalt, Prüfung vor der Gründung durch unseren Partner-Steuerberater und die erste US-Meldung — Global Struktur.", paket: "global_struktur" },
    {
      typ: "hinweis", id: "wissen", h2: "Was Sie wissen müssen",
      punkte: [
        "Dieser Beitrag erklärt die gesetzlichen Grundlagen, Stand Oktober 2026. Er ersetzt nicht die Prüfung Ihres Falls; die übernimmt der Steuerberater auf Ihr Mandat.",
        GLOBAL_PFLICHTHINWEIS.de[0],
        GLOBAL_PFLICHTHINWEIS.de[1],
        `Nicht im Festpreis: ${GLOBAL_NICHT_INKLUSIVE.de[1]}.`,
        GLOBAL_ROLLEN.de.fiaon,
        "Eine US-LLC ist kein Steuermodell: Wer sie von Deutschland aus leitet, versteuert sie in der Regel hier.",
      ],
    },
  ],
  fragen: [
    { f: "Muss ich meine US-LLC beim Finanzamt anmelden?", a: "Wenn Sie sie von Deutschland aus leiten, in der Regel ja. Die Stätte der Geschäftsleitung ist eine Betriebsstätte (§ 12 AO); ihre Eröffnung teilen Sie der Gemeinde mit, die Auskünfte zur steuerlichen Erfassung gehen elektronisch ans Finanzamt, nach der AO jeweils innerhalb eines Monats (§ 138 Abs. 1, 1b und 4 AO). Unabhängig davon melden Sie die Gründung in der Regel nach § 138 Abs. 2 AO mit der Steuererklärung." },
    { f: "Bis wann muss ich die US-LLC nach § 138 AO melden?", a: "Mit der Einkommen-, Körperschaft- oder Feststellungserklärung für das Jahr der Gründung, spätestens 14 Monate nach Ablauf dieses Jahres (§ 138 Abs. 5 AO). Die oft genannte Monatsfrist gilt nur für die Eröffnung eines Betriebs und die steuerliche Erfassung. Eine vorsätzlich oder leichtfertig versäumte Meldung kann ein Bußgeld von höchstens 25.000 Euro nach sich ziehen (§ 379 AO)." },
    { f: "Brauche ich für meine US-LLC eine Gewerbeanmeldung?", a: "Das hängt von der Tätigkeit ab. Wer ein stehendes Gewerbe, eine Zweigniederlassung oder eine unselbständige Zweigstelle beginnt, zeigt das gleichzeitig an (§ 14 GewO), und die Leitung von Deutschland aus begründet in der Regel eine Betriebsstätte. Ob Ihre Tätigkeit ein Gewerbe oder ein freier Beruf ist, klärt der Steuerberater im Einzelfall." },
    { f: "Darf meine US-LLC deutschen Kunden Rechnungen ohne Umsatzsteuer schreiben?", a: "Nur, wenn der Kunde die Steuer schuldet (Reverse Charge) oder eine Befreiung greift. Reverse Charge setzt voraus, dass die LLC im Inland weder Sitz noch Geschäftsleitung noch eine an der Leistung beteiligte Betriebsstätte hat (§ 13b Abs. 7 UStG). Wird sie von hier aus geleitet, schuldet sie die Umsatzsteuer in der Regel selbst — es sei denn, die Kleinunternehmerregelung greift (§ 19 UStG)." },
    { f: "Welches Finanzamt ist für meine US-LLC zuständig?", a: "Wird die LLC wie eine Kapitalgesellschaft eingeordnet, das Finanzamt, in dessen Bezirk sich ihre Geschäftsleitung befindet (§ 20 Abs. 1 AO), bei einer Leitung von zu Hause also das Finanzamt an Ihrem Ort. Wird sie transparent eingeordnet, fließt ihr Gewinn in Ihre eigene Steuererklärung." },
    { f: "Muss meine US-LLC in Deutschland Bücher führen?", a: "Gewerbliche Unternehmer sind buchführungspflichtig, wenn der Umsatz 800.000 Euro im Kalenderjahr oder der Gewinn 80.000 Euro im Wirtschaftsjahr übersteigt (§ 141 AO). Ob für Ihre LLC schon früher eine Bilanz nötig ist, hängt von ihrer Einordnung ab. Aufbewahrt werden Bücher zehn Jahre, Buchungsbelege acht Jahre (§ 147 AO)." },
    { f: "Schützt mich das Doppelbesteuerungsabkommen vor der deutschen Steuer?", a: "Nein. Das Abkommen zwischen Deutschland und den USA verteilt Besteuerungsrechte und vermeidet, dass derselbe Gewinn zweimal besteuert wird. Wird die LLC von Deutschland aus geleitet, bleibt sie hier in der Regel steuerpflichtig. Für steuerlich transparente Gesellschaften enthält es eine eigene Regel (Art. 1 Abs. 7)." },
    { f: "Was übernimmt FIAON Global, was meine Steuerkanzlei?", a: "Wir übernehmen die US-Seite und die Koordination: Gründung, EIN, Registered Agent, Operating Agreement durch unseren Partner-Anwalt, die erste Form 5472 durch unseren US-CPA und die Prüfung vor der Gründung durch unseren Partner-Steuerberater. Laufende Buchhaltung und Steuererklärungen in Deutschland, mit der Meldung nach § 138 AO, macht Ihre Steuerkanzlei — mit den Unterlagen aus Ihrem Dokumentenraum." },
  ],
  paket: "global_struktur",
  weiter: ["/business/wissen/us-llc-steuern", "/business/aus-deutschland", "/business/wissen/llc-steuererklaerung", "/business/wissen/nachteile-us-llc"],
  quellen: [
    QL.ao10, Q.ao138, QL.ao379, QL.ao12, QL.ao20, QL.kstg1, QL.bmf, QL.bfh, QL.gewo14, QL.gewstg2, QL.hgb13d,
    QL.ustg3a, QL.ustg13b, QL.ustg14, QL.ustg14a, QL.ustg18, QL.ustg19, QL.ustg27, QL.ustg27a, QL.ao141, QL.ao147, QL.ddg5,
    Q.dba, QL.dbaIrs, Q.i5472, Q.i1120, QUELLEN_IRS[5], Q.smllc, QUELLEN_STAATEN.florida[1], Q.boiEnde,
  ],
};
