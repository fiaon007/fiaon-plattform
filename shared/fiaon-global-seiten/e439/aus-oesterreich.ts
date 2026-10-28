// ═══════════════════════════════════════════════════════════════════════════
// FIAON GLOBAL — LÄNDERSEITE: US-FIRMA AUS ÖSTERREICH GRÜNDEN (27.10.2026, E-439)
//
// Die dritte DACH-Länderseite neben /business/aus-deutschland (FG · 15) und
// /business/aus-der-schweiz (FG · 16) — gleicher Aufbau, gleicher Ton, dazu was
// in Österreich eigen ist: Ort der Geschäftsleitung (§ 27 Abs. 2 BAO), unbe-
// schränkte Steuerpflicht (§ 1 Abs. 2 KStG), Typenvergleich nach der Verwaltungs-
// praxis des BMF (EAS 1413 vom 04.02.1999, Merkmale nach EAS 1107 vom 21.07.1997),
// DBA Österreich–USA (BGBl. III Nr. 6/1998: Art. 4 Abs. 3, Art. 5 Abs. 2, Art. 7,
// Art. 10), Anzeigepflicht (§§ 120, 121 BAO), Gewerberecht (§ 14 Abs. 4 GewO) und
// das Abkommen über Soziale Sicherheit (SSA, seit 01.11.1991).
// Alle Normen am 27.10.2026 im Original gelesen (RIS, findok, BMF-DBA-Liste,
// SSA POMS, 9 FAM 402.9). KStR-Randzahlen sind nicht zitiert, weil der Volltext
// in findok nicht abrufbar war — die Merkmale stehen deshalb mit EAS 1107.
//
// Wortwand: kein Steuermodell (Ort der Geschäftsleitung steht vorn), kein Bank-
// name, keine Preiszahl (Baustein "paket"), kein „Beratung/beraten“.
// Selbstbezeichnung (28.10.2026, E-454): Diese Seite nennt FIAON NIE „Unternehmens-
// beratung“ — weder im Text noch im Datenblock. In Österreich ist das ein regle-
// mentiertes Gewerbe (§ 94 Z 74 GewO), die Ausnahme steht so in E-439. Bis E-454
// stand das Wort hier einmal im Abschnitt "fiaon" (jetzt: Vertragspartner mit Sitz
// und Registernummer). Regel: OESTERREICH_REGEL in shared/fiaon-global-wortregeln.ts.
//
// Prüfung 27.10.2026 (Fach- und Rechtsprüfer): alle Quellen im Original gelesen;
// § 22 KStG in der Fassung ab 01.01.2028 (BGBl. I Nr. 62/2026: 24 % für Einkommens-
// teile über 1 Mio. €) ergänzt; DBA Art. 10 Abs. 2, Art. 22 Abs. 3 und Verständigungs-
// protokoll zu Art. 4 (LLC wie Personengesellschaft) im BGBl.-Text gelesen.
// ═══════════════════════════════════════════════════════════════════════════
import type { GlobalQuelle, GlobalSeite } from "../typen";
import { GLOBAL_GELD_ZURUECK, GLOBAL_PFLICHTHINWEIS } from "../../fiaon-global";
import { FIAON_FIRMA } from "../../fiaon-firma";
import { QUELLEN_WISSEN as Q, QUELLEN_STAATEN, IRS, SCHWELLEN, FRISTEN } from "../fakten";

const S = "2026-10-27";

/** Österreichische und weitere Primärquellen dieser Seite (gelesen am 27.10.2026). */
const QUELLEN: Record<string, GlobalQuelle> = {
  kstg1: { titel: "§ 1 KStG 1988 — Unbeschränkte und beschränkte Steuerpflicht (RIS)", url: "https://www.ris.bka.gv.at/NormDokument.wxe?Abfrage=Bundesnormen&Gesetzesnummer=10004569&Paragraf=1" },
  kstg22: { titel: "§ 22 KStG 1988 — Steuersatz (RIS)", url: "https://www.ris.bka.gv.at/NormDokument.wxe?Abfrage=Bundesnormen&Gesetzesnummer=10004569&Paragraf=22" },
  kstg22ab2028: { titel: "§ 22 KStG 1988 in der Fassung ab 01.01.2028, BGBl. I Nr. 62/2026 (RIS)", url: "https://www.ris.bka.gv.at/NormDokument.wxe?Abfrage=Bundesnormen&Gesetzesnummer=10004569&Paragraf=22&FassungVom=2028-01-01" },
  kstg10a: { titel: "§ 10a KStG 1988 — Hinzurechnungsbesteuerung (RIS)", url: "https://www.ris.bka.gv.at/NormDokument.wxe?Abfrage=Bundesnormen&Gesetzesnummer=10004569&Paragraf=10a" },
  bao27: { titel: "§ 27 BAO — Sitz und Ort der Geschäftsleitung (RIS)", url: "https://www.ris.bka.gv.at/NormDokument.wxe?Abfrage=Bundesnormen&Gesetzesnummer=10003940&Paragraf=27" },
  bao120: { titel: "§ 120 BAO — Anzeigepflichten (RIS)", url: "https://www.ris.bka.gv.at/NormDokument.wxe?Abfrage=Bundesnormen&Gesetzesnummer=10003940&Paragraf=120" },
  bao121: { titel: "§ 121 BAO — Frist für Anzeigen (RIS)", url: "https://www.ris.bka.gv.at/NormDokument.wxe?Abfrage=Bundesnormen&Gesetzesnummer=10003940&Paragraf=121" },
  estg27a: { titel: "§ 27a EStG 1988 — Besondere Steuersätze für Einkünfte aus Kapitalvermögen (RIS)", url: "https://www.ris.bka.gv.at/NormDokument.wxe?Abfrage=Bundesnormen&Gesetzesnummer=10004570&Paragraf=27a" },
  abgb1175: { titel: "§ 1175 ABGB — Begriff der Gesellschaft (RIS)", url: "https://www.ris.bka.gv.at/NormDokument.wxe?Abfrage=Bundesnormen&Gesetzesnummer=10001622&Paragraf=1175" },
  gewo14: { titel: "§ 14 GewO 1994 — Ausländische Personen und Rechtsträger (RIS)", url: "https://www.ris.bka.gv.at/NormDokument.wxe?Abfrage=Bundesnormen&Gesetzesnummer=10007517&Paragraf=14" },
  eas1413: { titel: "BMF, EAS 1413 vom 04.02.1999 — Steuerliche Behandlung einer US-Limited Liability Company (findok)", url: "https://findok.bmf.gv.at/findok/resources/pdf/1691f422-2c75-4ed3-9271-ed18e5cce2b7/30137.1.1.0.pdf" },
  eas1107: { titel: "BMF, EAS 1107 vom 21.07.1997 — Vergleichbarkeit einer „Bermuda Exempted Company“ mit einer österreichischen Kapitalgesellschaft (findok)", url: "https://findok.bmf.gv.at/findok/resources/pdf/de9ce4b1-e9eb-449c-be04-12ade25c050e/14433.1.1.0.pdf" },
  bfgTyp: { titel: "Bundesfinanzgericht, RV/6100084/2013 — Typenvergleich ausländischer Rechtsgebilde (findok)", url: "https://findok.bmf.gv.at/findok/resources/pdf/f6dec8ad-9fb4-4ca4-b298-20611ef4c0c8/100742.pdf" },
  dbaText: { titel: "DBA Österreich–USA, BGBl. III Nr. 6/1998 (Abkommenstext, RIS)", url: "https://www.ris.bka.gv.at/Dokumente/BgblPdf/1998_6_3/1998_6_3.pdf" },
  dbaListe: { titel: "BMF — Liste der Doppelbesteuerungsabkommen (USA: unterzeichnet 31.05.1996, in Kraft 01.02.1998)", url: "https://www.bmf.gv.at/themen/steuern/internationales-steuerrecht/doppelbesteuerungsabkommen/dba-liste.html" },
  ssaAustria: { titel: "U.S. Social Security Administration — Totalization Agreement with Austria (POMS)", url: "https://secure.ssa.gov/poms.nsf/lnx/0302001650" },
  famE2: { titel: "U.S. Department of State — 9 FAM 402.9, E-Visa und Liste der Vertragsstaaten", url: "https://fam.state.gov/fam/09FAM/09FAM040209.html" },
};

const GELD_ZURUECK = GLOBAL_GELD_ZURUECK.aktiv ? [`${GLOBAL_GELD_ZURUECK.de.text} ${GLOBAL_GELD_ZURUECK.de.bedingungen}`] : [];

export const SEITE: GlobalSeite = {
  pfad: "/business/aus-oesterreich",
  art: "land",
  seo: {
    titel: "US-Firma aus Österreich gründen — FIAON Global",
    beschreibung: "US-Firma aus Österreich gründen: Ort der Geschäftsleitung, Typenvergleich der LLC, DBA und Meldungen — ehrlich erklärt, mit Quellen.",
  },
  stand: S,
  erschienen: S,
  kennung: "FG · 46",
  auge: "Für wen · Aus Österreich",
  h1: "Aus Österreich in die USA.",
  h1b: "Mit allem, was in Österreich gilt.",
  lead: "Eine US-Firma aus Österreich zu gründen, ist rechtlich unkompliziert — Wohnsitz oder Staatsbürgerschaft in den USA brauchen Sie dafür nicht. Entscheidend ist, was danach in Österreich gilt: wo die Gesellschaft geleitet wird, wie das Finanzamt die LLC einordnet und was zu melden ist. Das prüft unser Partner-Steuerberater in Ihrem Mandat vor der Gründung; alle Anträge in den USA stellen wir mit Ihrer Vollmacht für Sie.",
  ziffern: [
    { wert: "§ 27 BAO", label: "Ort der Geschäftsleitung entscheidet über die Steuerpflicht" },
    { wert: "EAS 1413", label: "BMF: Einordnung der LLC nur im Einzelfall" },
    { wert: "DBA 1996", label: "Abkommen Österreich–USA, in Kraft seit 1. Februar 1998" },
  ],
  blick: [
    ["Steuerpflicht", "Bei Geschäftsleitung in Österreich unbeschränkt (§ 1 Abs. 2 KStG, § 27 BAO)"],
    ["Einordnung", "Typenvergleich im Einzelfall — die US-Einordnung ist nicht entscheidend (EAS 1413)"],
    ["Abkommen", "DBA Österreich–USA, unterzeichnet am 31. Mai 1996 in Wien"],
    ["Anzeige", "Neue Umstände binnen einem Monat beim Finanzamt (§§ 120, 121 BAO)"],
    ["Tätigkeit in Österreich", "Gewerberecht und Sozialversicherung vorab klären"],
    ["Mit FIAON Global", "Alle Anträge für Sie, Prüfung vor der Gründung im Festpreis"],
  ],
  kurz: "Wer in Österreich lebt, kann eine US-Firma gründen — ohne Wohnsitz und ohne Staatsbürgerschaft in den USA. Wird die Gesellschaft von Österreich aus geleitet, liegt der Mittelpunkt ihrer geschäftlichen Oberleitung hier (§ 27 Abs. 2 BAO), und ihre Gewinne werden in der Regel in Österreich besteuert — bei der Gesellschaft (§ 1 Abs. 2 KStG) oder bei Ihnen. Ob die LLC wie eine GmbH oder transparent behandelt wird, entscheidet ein Typenvergleich im Einzelfall (BMF, EAS 1413). Eine US-Firma aus Österreich ist damit kein Steuermodell, sondern ein Zugang zum US-Markt.",
  bloecke: [
    {
      typ: "text", id: "gruenden", h2: "US-Firma aus Österreich gründen: was vorher feststeht",
      absaetze: [
        "Wer eine US-Firma aus Österreich gründen will, braucht dafür weder einen Wohnsitz noch eine Staatsbürgerschaft in den USA — gleich, ob Sie eine LLC gründen oder eine Corporation. Gegründet wird beim Bundesstaat, nicht beim Bund; jede Gesellschaft braucht einen Registered Agent mit Anschrift im Gründungsstaat, und die US-Steuerbehörde vergibt die Steuernummer der Gesellschaft, die EIN. Für Gesellschafter ohne US-Sozialversicherungsnummer ist das kein Hindernis: Im Antrag steht dann „foreign“ statt der Nummer, und ausländische Antragsteller beantragen die EIN telefonisch, per Fax oder per Post — " + IRS.einDauer + ".",
        "Die Frage, die über den Erfolg entscheidet, stellt sich nicht in Wyoming, Florida oder Delaware, sondern in Österreich: Wo wird die Gesellschaft tatsächlich geleitet, wie ordnet das Finanzamt die LLC ein, und was ist zu melden? Diese drei Punkte gehören vor die Gründung — weil das Operating Agreement, der Gesellschaftsvertrag der LLC, das Ergebnis des Typenvergleichs mitbestimmt.",
      ],
      punkte: [
        "Gültiger Reisepass jedes Gesellschafters",
        "Aktueller Adressnachweis aus Österreich",
        "Gründet Ihre GmbH mit: ein aktueller Firmenbuchauszug",
        "Eine kurze, klare Beschreibung des Geschäfts in den USA",
      ],
    },
    {
      typ: "text", id: "geschaeftsleitung", h2: "Der Ort der Geschäftsleitung — wo die Steuerpflicht entsteht",
      absaetze: [
        "Als Ort der Geschäftsleitung gilt nach § 27 Abs. 2 BAO der Ort, an dem sich der Mittelpunkt der geschäftlichen Oberleitung befindet — dort, wo die wichtigen Entscheidungen fallen. Körperschaften, die im Inland ihre Geschäftsleitung oder ihren Sitz haben, sind unbeschränkt steuerpflichtig, und zwar mit allen in- und ausländischen Einkünften (§ 1 Abs. 2 KStG). Als Körperschaft gelten dabei auch ausländische Rechtsgebilde, die einer inländischen juristischen Person des privaten Rechts vergleichbar sind. Die Körperschaftsteuer beträgt 23 % (§ 22 Abs. 1 KStG); in der Fassung, die ab 1. Januar 2028 gilt, steigt der Satz für Einkommensteile über 1 Million Euro auf 24 %.",
        "Das Doppelbesteuerungsabkommen zwischen Österreich und den USA, unterzeichnet am 31. Mai 1996 und in Kraft seit 1. Februar 1998, ordnet eine Gesellschaft, die in beiden Staaten als ansässig gilt, dem Staat zu, nach dessen Recht sie gegründet wurde (Art. 4 Abs. 3). Für Österreich heißt das nicht, dass es außen vor bleibt: Als Betriebsstätte gilt nach dem Abkommen insbesondere ein Ort der Leitung (Art. 5 Abs. 2), und Gewinne, die einer Betriebsstätte in Österreich zuzurechnen sind, darf Österreich besteuern (Art. 7 Abs. 1). Ist die LLC in den USA steuerlich transparent, bestimmt das Abkommen die Ansässigkeit wie bei einer Personengesellschaft — nach ihren Gesellschaftern (Verständigungsprotokoll zu Art. 4).",
        "Für die meisten Unternehmer bedeutet das: Wer seine US-Gesellschaft vom Schreibtisch in Wien, Graz oder Linz aus führt, versteuert ihre Gewinne in der Regel in Österreich. Das ist kein Nachteil der US-Gesellschaft — es ist nur kein Steuermodell.",
      ],
    },
    {
      typ: "text", id: "typenvergleich", h2: "LLC-Besteuerung in Österreich: der Typenvergleich",
      absaetze: [
        "Das österreichische Recht kennt keine LLC. Ob eine US-LLC einer österreichischen Kapitalgesellschaft vergleichbar ist, lässt sich nach Auffassung des Finanzministeriums nicht allgemein beantworten, sondern nur im Einzelfall anhand aller Gegebenheiten (EAS 1413 vom 4. Februar 1999). Wie die Gesellschaft in den USA besteuert wird — etwa nach einer Wahl auf Form 8832 —, ist dafür nicht entscheidend. Das Bundesfinanzgericht formuliert es ebenso: Ausländische Rechtsgebilde werden aus dem Blickwinkel des österreichischen Rechts eingeordnet.",
        "Als Merkmale einer Kapitalgesellschaft nennt das Finanzministerium unter Verweis auf die Fachliteratur eigene Rechtspersönlichkeit, ein starres, vom Ergebnis unabhängiges Gesellschaftskapital, die Beteiligung anderer Personen am Kapital, die Beschränkung der Haftung und eine Willensbildung unter Mitwirkung der Gesellschafter (EAS 1107). Ist die LLC einer Personengesellschaft vergleichbar, gilt sie als transparent: Nicht die Gesellschaft, sondern ihre Gesellschafter werden besteuert.",
        "Gehört die LLC nur Ihnen, kann sie keiner Personengesellschaft entsprechen, denn eine Gesellschaft setzt in Österreich zwei oder mehr Personen voraus (§ 1175 ABGB). Sie wird dann entweder wie eine Kapitalgesellschaft behandelt — oder, wenn ihr deren Merkmale fehlen, nicht als eigenes Steuersubjekt, denn körperschaftsteuerpflichtig sind nur Körperschaften (§ 1 Abs. 1 KStG); ihr Ergebnis wird dann Ihnen persönlich zugerechnet. Welche Merkmale vorliegen, bestimmen das Gesellschaftsrecht des Gründungsstaats und das Operating Agreement.",
        "Das Finanzministerium weist ausdrücklich darauf hin, dass die Analyse der Gesellschaftsstruktur im Rahmen der erhöhten Mitwirkungspflicht bei Auslandsbeziehungen von Ihrer Seite kommen muss — und dass eine Einordnung ohne nähere Prüfung zu einem Konflikt mit der Besteuerung in den USA führen kann (EAS 1413). Deshalb prüft unser Partner-Steuerberater die Einordnung, bevor das Operating Agreement geschrieben wird.",
      ],
    },
    {
      typ: "tabelle", id: "ueberblick", h2: "Österreich und die USA: was wo gilt",
      lead: "Die wichtigsten Regeln beider Seiten nebeneinander — als Landkarte für das Gespräch mit dem Partner-Steuerberater, nicht als Ersatz dafür.",
      kopf: ["Frage", "In Österreich", "In den USA"],
      zeilen: [
        ["Wer ist steuerpflichtig?", "Körperschaften mit Geschäftsleitung oder Sitz im Inland, mit allen Einkünften (§ 1 Abs. 2 KStG)", "Die LLC ohne eigene Wahl: mit einem Gesellschafter steuerlich unbeachtlich, mit mehreren wie eine Personengesellschaft"],
        ["Wie wird die LLC eingeordnet?", "Typenvergleich im Einzelfall; die Einordnung in den USA ist nicht entscheidend (EAS 1413)", "Nach US-Bundessteuerrecht; auf Antrag mit Form 8832 als Corporation"],
        ["Steuersatz der Gesellschaft", "23 % Körperschaftsteuer, wenn sie als Körperschaft gilt (§ 22 Abs. 1 KStG); ab 2028 für Einkommensteile über 1 Mio. € 24 %", `${IRS.koerperschaftsteuer} Bundes-Körperschaftsteuer, wenn sie als Corporation besteuert wird`],
        ["Ausschüttungen an Sie", "Besonderer Steuersatz von 27,5 % für Einkünfte aus Kapitalvermögen (§ 27a Abs. 1 EStG); US-Quellensteuer rechnet Österreich nach dem DBA an (Art. 22 Abs. 3)", "Wird die LLC als Corporation besteuert: Quellensteuer nach dem DBA höchstens 15 %; 5 %, wenn eine Gesellschaft — etwa Ihre GmbH — unmittelbar mindestens 10 % der stimmberechtigten Anteile hält (Art. 10 Abs. 2)"],
        ["Mehrere Gesellschafter", "Gilt die LLC als transparent, werden die Gewinnanteile den Gesellschaftern zugerechnet", `Form 1065 bis ${FRISTEN.f1065}; Steuerabzug auf US-Geschäftsgewinne, die auf ausländische Gesellschafter entfallen: ${SCHWELLEN.abzug1446}`],
        ["Jährliche Pflicht", "Steuererklärung mit allen Einkünften; Anzeige neuer Umstände binnen einem Monat (§§ 120, 121 BAO)", `Ein-Personen-LLC: Form 5472 mit Form 1120, Frist ${IRS.frist5472}`],
      ],
      fuss: [
        `Stand Oktober 2026. Die Strafe für eine fehlende oder unvollständige Form 5472 beträgt ${IRS.strafe5472}.`,
        "Ob und wie diese Regeln in Ihrem Fall greifen, prüft vor der Gründung ein in Österreich befugter Steuerberater aus unserem Partnernetz — auf Ihr Mandat.",
      ],
    },
    {
      typ: "text", id: "meldungen", h2: "Meldepflichten in Österreich und in den USA",
      absaetze: [
        "In Österreich zeigen Sie dem Finanzamt alle Umstände an, die eine persönliche Abgabepflicht für Einkommen-, Körperschaft- oder Umsatzsteuer begründen, ändern oder beenden (§ 120 Abs. 1 BAO). Wer einen gewerblichen Betrieb oder eine sonstige selbständige Erwerbstätigkeit beginnt, meldet das dem zuständigen Finanzamt (§ 120 Abs. 2 BAO) — jeweils binnen einem Monat ab dem Ereignis (§ 121 BAO). Die Einkünfte aus der US-Gesellschaft gehören in Ihre österreichische Steuererklärung; ob als Gewinnanteil oder als Ausschüttung, folgt aus dem Typenvergleich.",
        `In den USA gibt eine Ein-Personen-LLC mit ausländischem Eigentümer Form 5472 zusammen mit Form 1120 ab, sobald es Vorgänge zwischen ihr und ihrem Eigentümer gibt — schon die Einlage bei der Gründung zählt dazu, Umsatz ist keine Voraussetzung; Frist ist der ${IRS.frist5472}. Fehlt die Meldung oder ist sie unvollständig, droht eine Strafe von ${IRS.strafe5472}. Die Meldung wirtschaftlich Berechtigter an FinCEN entfällt seit August 2026 für Gesellschaften, die in den USA gegründet wurden.`,
        "Gründet eine österreichische GmbH die US-Gesellschaft, kommen eigene Fragen hinzu. Gilt die US-Gesellschaft als Körperschaft und hält die GmbH mehr als die Hälfte der Stimmrechte oder des Kapitals, können der GmbH Passiveinkünfte der US-Gesellschaft — etwa Zinsen oder Lizenzgebühren — hinzugerechnet werden: wenn mehr als ein Drittel der Einkünfte der US-Gesellschaft passiv ist, ihre tatsächliche Steuerbelastung im Ausland unter 15 % liegt und sie keine wesentliche wirtschaftliche Tätigkeit entfaltet (§ 10a KStG).",
      ],
    },
    {
      typ: "text", id: "gewerbe", h2: "Gewerberecht und Sozialversicherung: zwei Hinweise",
      absaetze: [
        "Soll die US-Gesellschaft selbst in Österreich tätig werden, gilt die Gewerbeordnung. Ausländische Rechtsträger, die im Inland weder Sitz noch Niederlassung haben, dürfen hier kein Gewerbe ausüben, soweit Staatsverträge nichts anderes vorsehen (§ 14 Abs. 4 GewO). Ob Ihr Vorhaben eine Niederlassung und eine Gewerbeberechtigung in Österreich braucht, klärt im Einzelfall ein Anwalt — auf Wunsch einer unserer Partner-Anwälte in Ihrem Mandat —, bevor die Gesellschaft hier auftritt.",
        "Zwischen Österreich und den USA gilt seit 1. November 1991 ein Abkommen über Soziale Sicherheit. Es sorgt dafür, dass dieselbe Tätigkeit nur in einem der beiden Systeme versichert ist. Wo Sie als Gesellschafter oder Geschäftsführer versichert sind, hängt von Ihrer Rolle und Ihrer Tätigkeit ab — das gehört vor der Gründung in das Gespräch mit dem Steuerberater.",
        "Und falls Sie später selbst in den USA am Aufbau mitarbeiten wollen: Österreich ist Vertragsstaat für die E-1- und E-2-Visa, in der Liste des US-Außenministeriums jeweils seit 27. Mai 1931. Ob die Voraussetzungen vorliegen, klären Anwälte für US-Einwanderungsrecht; über jedes Visum entscheidet allein das Konsulat.",
      ],
    },
    {
      typ: "text", id: "konto-karte", h2: "US-Konto und US-Kreditkarte als Österreicher",
      absaetze: [
        `Für ein US-Geschäftskonto kommt es auf vollständige Unterlagen an. Institute müssen bei der Kontoeröffnung jede Person identifizieren, der ${SCHWELLEN.eigentuemer} oder mehr der Gesellschaft gehören, dazu eine Person, die sie leitet; für die Gesellschaft selbst verlangen sie Dokumente, die ihr Bestehen belegen, und ihre Steuernummer. Bei Ihnen als Ausländer kann an die Stelle einer US-Steuernummer die Nummer Ihres Reisepasses treten. In der Regel liegen deshalb Gründungsunterlagen, EIN, Operating Agreement und Reisepass auf dem Tisch. Über das Konto entscheidet allein das Institut.`,
        "Eine US-Kreditkarte für Ihre Gesellschaft können Sie auch aus Österreich beantragen; ob und mit welchem Rahmen sie ausgegeben wird, entscheidet allein der Herausgeber. Firmenkarten setzen in der Regel Ihre persönliche Haftung voraus. Für einen FICO Score braucht Ihre US-Kreditauskunft ein Konto, das seit mindestens sechs Monaten besteht und in den letzten sechs Monaten gemeldet wurde. Einführungszeiträume ohne Sollzins bieten manche Herausgeber an; die Bedingungen legt jeder Herausgeber selbst fest.",
        "Konto-, Karten- und Kreditanträge stellen Sie selbst — wir bereiten sie vollständig vor, im Paket Global Struktur den ersten Konto- und Kartenantrag, ab Global Banking jeden weiteren, damit Name, Anschrift, Telefonnummer und Unterlagen in jedem Antrag übereinstimmen.",
      ],
    },
    {
      typ: "etappen", id: "ablauf", h2: "Ihre US-Firma aus Österreich in fünf Etappen",
      lead: "Die Reihenfolge trägt: Erst wird geklärt, wie Österreich die Gesellschaft sieht, dann wird gegründet.",
      etappen: [
        { titel: "Prüfung vor der Gründung", dauer: "vor jedem Antrag", text: "Ein in Österreich befugter Partner-Steuerberater klärt auf Ihr Mandat den Ort der Geschäftsleitung, die Einordnung im Typenvergleich und Ihre Pflichten in Österreich." },
        { titel: "Gründung und Operating Agreement", dauer: "nach der Prüfung", text: "Unser Team gründet die Gesellschaft beim Bundesstaat; unser Partner-Anwalt schreibt das Operating Agreement passend zum Ergebnis der Prüfung." },
        { titel: "EIN, ITIN und D-U-N-S", dauer: "EIN: " + IRS.einDauer, text: "Wir beantragen die EIN, bereiten die ITIN vor, soweit die Voraussetzungen der US-Steuerbehörde vorliegen, und beantragen die D-U-N-S-Nummer der Gesellschaft — eine neunstellige Kennung nur für Unternehmen, die kostenlos vergeben wird." },
        { titel: "Konto und erste Karte", dauer: "nach der EIN", text: "Wir bereiten den Konto- und den ersten Kartenantrag vollständig vor; stellen müssen Sie beide selbst. Über beide entscheidet allein das Institut." },
        { titel: "Meldungen", dauer: "jährlich", text: "Die erste US-Meldung reicht unser US-CPA ein. Ihre Steuererklärung in Österreich übernimmt Ihr Steuerberater — mit der Prüfung vor der Gründung als Grundlage." },
      ],
    },
    {
      typ: "rollen", id: "rollen", h2: "Wer was übernimmt",
      lead: "Ein Ansprechpartner statt acht — und klare Grenzen, wer was verantwortet.",
      fiaon: [
        "Alle Anträge mit Ihrer Vollmacht: Gründung, EIN, ITIN-Vorbereitung, D-U-N-S, Meldungen",
        "Registered Agent, US-Geschäftsadresse und US-Telefonnummer im ersten Jahr",
        "Konto- und Kartenanträge vollständig vorbereitet",
        "Termine vor Ort durch unser Team in Miami",
      ],
      partner: [
        "Partner-Steuerberater: Prüfung vor der Gründung, auf Ihr Mandat",
        "Partner-Anwalt: Operating Agreement und Gründungsunterlagen",
        "US-CPA: erste jährliche US-Meldung",
        "Deren Honorare für die Leistungen des Pakets trägt FIAON",
      ],
      sie: [
        "Reisepass, Adressnachweis und eine klare Beschreibung des Geschäfts",
        "Konto-, Karten- und Kreditanträge selbst stellen",
        "Laufende Steuererklärung in Österreich mit Ihrem Steuerberater",
      ],
    },
    {
      typ: "text", id: "fiaon", h2: "So übernimmt FIAON Global Ihre US-Firma aus Österreich",
      absaetze: [
        "Ein Ansprechpartner statt acht: Mit Ihrer Vollmacht stellen wir alle Anträge für Sie — die Gründung beim Bundesstaat, die EIN bei der US-Steuerbehörde, die Vorbereitung der ITIN, soweit deren Voraussetzungen vorliegen, die D-U-N-S-Nummer und die jährlichen US-Meldungen. Registered Agent, US-Geschäftsadresse und US-Telefonnummer stellen wir für das erste Jahr. Konto-, Karten- und Kreditanträge stellen Sie selbst, von uns vollständig vorbereitet; darüber entscheidet allein das Institut.",
        "Vor der Gründung prüft ein in Österreich befugter Partner-Steuerberater auf Ihr Mandat, wo der Ort der Geschäftsleitung liegen wird und wie Österreich Ihre LLC im Typenvergleich einordnen dürfte. Das Ergebnis fließt in das Operating Agreement, das unser Partner-Anwalt schreibt. Die erste US-Meldung — Form 5472 mit Form 1120 — reicht unser US-CPA ein. Die Honorare dieser Partner für die Leistungen Ihres Pakets trägt FIAON; alle Gebühren des Pakets sind im Festpreis enthalten.",
        `Ihr Vertragspartner ist die ${FIAON_FIRMA.name} mit Sitz in London (Companies House ${FIAON_FIRMA.companyNo}). Unser Team in Miami nimmt Termine bei Behörden und Instituten vor Ort wahr, unser Partnerstandort ist Zürich. Ab dem zweiten Jahr können Sie die Jahresbetreuung dazunehmen — freiwillig.`,
        ...GELD_ZURUECK,
      ],
    },
    {
      typ: "hinweis", id: "wissen", h2: "Was Sie wissen müssen",
      punkte: [
        "Eine US-Gesellschaft ist kein Steuermodell. Wird sie von Österreich aus geleitet, ist sie in der Regel hier steuerpflichtig — wer anderes verspricht, verschweigt den Ort der Geschäftsleitung.",
        GLOBAL_PFLICHTHINWEIS.de[0],
        GLOBAL_PFLICHTHINWEIS.de[1],
        GLOBAL_PFLICHTHINWEIS.de[2],
        "FIAON ist keine Bank, vergibt keine Kredite, vermittelt keine Kredite und sagt keinen Rahmen zu. Über Konto, Karte, Rahmen und Darlehen entscheidet allein das Institut.",
        "Die Prüfung vor der Gründung ist im Festpreis enthalten; die laufende Steuererklärung in Österreich übernimmt Ihr Steuerberater.",
      ],
    },
    { typ: "paket", id: "paket", h2: "Das passende Paket", lead: "Gründung, Steuernummern, die Prüfung vor der Gründung und die erste US-Meldung: Global Struktur.", paket: "global_struktur" },
  ],
  fragen: [
    { f: "Kann ich als Österreicher eine US-Firma gründen?", a: "Ja, ohne Wohnsitz und ohne Staatsbürgerschaft in den USA. Sie brauchen einen gültigen Reisepass und einen Adressnachweis; gründet Ihre GmbH mit, zusätzlich deren Firmenbuchauszug. Mit Ihrer Vollmacht stellen wir alle Anträge in den USA für Sie." },
    { f: "Muss ich meine US-LLC in Österreich versteuern?", a: "In der Regel ja, wenn Sie sie von Österreich aus leiten: Der Ort der Geschäftsleitung liegt dann hier (§ 27 Abs. 2 BAO). Gilt die LLC als Körperschaft, ist sie unbeschränkt steuerpflichtig (§ 1 Abs. 2 KStG); gilt sie als transparent, wird ihr Ergebnis Ihnen zugerechnet. Unser Partner-Steuerberater prüft Ihren Fall vor der Gründung." },
    { f: "Wie wird eine US-LLC in Österreich besteuert?", a: "Das hängt vom Typenvergleich ab: Entspricht die LLC einer Kapitalgesellschaft und wird sie von Österreich aus geleitet, fällt hier Körperschaftsteuer an; Ausschüttungen an Sie unterliegen dem besonderen Satz von 27,5 %. Ist sie transparent, werden die Gewinne direkt bei Ihnen besteuert. Die Einordnung in den USA ist dafür nicht entscheidend (EAS 1413)." },
    { f: "Brauche ich für die US-LLC einen Wohnsitz in den USA?", a: "Nein. Die Gesellschaft braucht einen Registered Agent mit Anschrift im Gründungsstaat; Sie selbst können in Österreich wohnen bleiben. Registered Agent, US-Geschäftsadresse und US-Telefonnummer sind im ersten Jahr in unseren Paketen enthalten." },
    { f: "Kann ich als Österreicher eine US-Kreditkarte beantragen?", a: "Beantragen können Sie eine US-Firmenkarte für Ihre Gesellschaft auch aus Österreich; ob und mit welchem Rahmen sie ausgegeben wird, entscheidet allein der Herausgeber. Firmenkarten setzen in der Regel Ihre persönliche Haftung voraus. Den ersten Antrag bereiten wir vollständig vor; stellen müssen Sie ihn selbst." },
    { f: "Muss ich die US-Gesellschaft dem österreichischen Finanzamt melden?", a: "In der Regel ja. Umstände, die eine Abgabepflicht begründen oder ändern, und den Beginn einer gewerblichen oder selbständigen Tätigkeit zeigen Sie dem Finanzamt an — binnen einem Monat ab dem Ereignis (§§ 120, 121 BAO). Die Einkünfte gehören in Ihre Steuererklärung." },
    { f: "Darf meine US-Gesellschaft in Österreich tätig werden?", a: "Ausländische Rechtsträger ohne Sitz oder Niederlassung in Österreich dürfen hier kein Gewerbe ausüben, soweit Staatsverträge nichts anderes vorsehen (§ 14 Abs. 4 GewO). Ob Sie eine Niederlassung und eine Gewerbeberechtigung brauchen, klärt im Einzelfall ein Anwalt — auf Wunsch einer unserer Partner-Anwälte in Ihrem Mandat." },
  ],
  paket: "global_struktur",
  weiter: ["/business/aus-deutschland", "/business/aus-der-schweiz", "/business/wissen/us-llc-steuern", "/business/wissen/e2-visum"],
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
    QUELLEN_STAATEN.florida[3],
    Q.delawareAgent,
  ],
};
