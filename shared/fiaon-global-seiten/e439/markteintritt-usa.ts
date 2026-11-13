// ═══════════════════════════════════════════════════════════════════════════
// FIAON GLOBAL — WISSEN: MARKTEINTRITT USA (27.10.2026, E-439)
//
// Der Pfeiler für den Mittelstand und die Seite, auf der FIAON Global sich als
// Unternehmensberatung für die US-Expansion zeigt (Justin, 27.10.2026:
// „Unternehmensberatung DÜRFEN WIR VERWENDEN“). Recherche: .arbeit/recherche/kw_de.md, T4.
// Der Weg in zehn Schritten, vom Entschluss bis zum laufenden US-Geschäft, mit den
// belegten Kostenblöcken, den Meldungen in beiden Ländern und den typischen Fehlern.
//
// E-510 (13.11.2026, Sprachleitfaden FIAON Global, Baustein „Wissens-Artikel“ 7.4):
// erklären, nicht verkaufen. „Schritt“ statt „Etappe“ (der Baustein-Typ „etappen“ und
// die Anker bleiben), „Finanzierung“ statt „Kapital“ in Titeln. Feste Sätze (S1, S2,
// S3, S9, S10, der Rollen-Satz, die Übergangssätze, Schritt 2 der festen Erzählung)
// kommen aus shared/fiaon-global-saetze.ts und werden hier nicht getippt; jeder eigene
// Betrag kommt aus der Preisquelle. Was hier nie steht: ein „Team vor Ort“, ein
// Partnerstandort, ein Partner bei der Arbeit im Präsens, eine „Prüfung vor der
// Gründung“ als enthaltene Leistung (der Vertrag des einen Produkts trägt sie nicht),
// die D-U-N-S-Nummer als unsere Leistung (steht nicht im Vertrag; als Marktwissen
// bleibt sie), der Satz zum Einführungszeitraum bei Karten (hier ohne Quelle).
// In keiner Zeile, die Österreich oder die Schweiz nennt, stehen Konto, Karte oder
// Finanzierung (Leitfaden 5.12).
//
// Zweite Runde am selben Tag (Lektorat des ganzen Texts): Der Sachteil steht ohne FIAON —
// kein Partner, kein Honorar, kein Mandat vor dem Baustein „rollen“ (Ausnahme: die festen
// Sätze im Baustein „kapital“ bleiben, wo sie sind). FIAON steht im Schlussteil: Rollen,
// „Was FIAON Global dabei übernimmt“, Karte, Vermerke und die eine Frage dazu. Das Honorar
// zeigt die Karte „Ein Mandat“; ein eigener Betrag steht im Text dieser Datei nicht mehr.
// Gesetzliche Fristen Dritter bleiben als Ziffer (Zahl der Quelle).
//
// Neu belegt am 27.10.2026 an den amtlichen Texten: BE-13 (15 CFR 801.7 i. d. F.
// 90 FR 42534 vom 03.09.2025: volle Meldung erst bei Kosten über 40 Mio. $, sonst
// Claim for Exemption; Frist 45 Kalendertage; Pflicht auch ohne Anschreiben der BEA),
// § 605.0902 und § 212.0596 Florida Statutes 2026, South Dakota v. Wayfair,
// 37 CFR 2.6 und 2.11 (Marke), USCIS I-9 und E-2, IRS Publication 15 (2026),
// CBP Visa Waiver Program und ESTA, GAO B-338157 (SBA, gültig seit 01.03.2026),
// 26 U.S.C. § 11 (21 %), § 10 AO, § 1 KStG, § 138 Abs. 2 und 5 AO.
// Fachprüfung 27.10.2026: Quellen einzeln geöffnet; Florida-Jahresgebühr 138,75 $ =
// 50 $ (§ 605.0213) + 88,75 $ (§ 607.193), deshalb beide Quellen. Alle übrigen Zahlen
// kommen aus fakten.ts.
// Wortwand wie in wissen-finanzierung.ts: kein Bankname, kein „bis zu“, keine
// Empfehlung, keine Frist als Zusage; über jeden Kredit entscheidet das Institut.
// ═══════════════════════════════════════════════════════════════════════════
import type { GlobalQuelle, GlobalSeite } from "../typen";
// E-509 (12.11.2026): EIN Produkt statt vier Pakete — kein Paketname, Preis und Geld-zurück-Satz aus EIN_PRODUKT.
import { GLOBAL_KAPITAL_FREI, GLOBAL_PFLICHTHINWEIS } from "../../fiaon-global";
import { SCHRITTE_KOPF, SECHS_SCHRITTE, satz, weitererSatz } from "../../fiaon-global-saetze";
import { EIN_PRODUKT } from "../ein-produkt";
import { FAKTEN_STAND, IRS, MARKT, QUELLEN_IRS, QUELLEN_STAATEN, QUELLEN_WISSEN as Q, SCHWELLEN, STAAT } from "../fakten";

/** Tag der Erstveröffentlichung (E-439). */
const S = "2026-10-27";
/** Tag der letzten inhaltlichen Änderung (E-510, Sprachleitfaden). */
const STAND = "2026-11-13";
const KAPITAL_FREI = `${GLOBAL_KAPITAL_FREI.de.satz} ${GLOBAL_KAPITAL_FREI.de.steuer}`;
const P = EIN_PRODUKT.de;
/** Schritt 2 der festen Erzählung (Leitfaden 2.2) — Satz und „Ihr Teil“ wortgleich aus der einen Quelle. */
const UNTERLAGEN = SECHS_SCHRITTE.de.find((x) => x.nr === 2)!;
/** Die Namen der festen Teile eines Schritts: „Ihr Teil“, „Bedingung“ (Leitfaden 2.1). */
const TEIL = SCHRITTE_KOPF.de.teile;
/** „25.000 $“ aus „25.000 US-Dollar je Formular und Jahr“ — die Zahl bleibt in fakten.ts. */
const STRAFE_5472 = `${IRS.strafe5472.split(" ")[0]} $`;

/** Quellen dieses Beitrags, selbst abgerufen am 27.10.2026. */
const QUELLEN: Record<string, GlobalQuelle> = {
  selectusa: { titel: "U.S. Department of Commerce — SelectUSA", url: "https://www.trade.gov/selectusa" },
  cfius: { titel: "U.S. Department of the Treasury — Committee on Foreign Investment in the United States (CFIUS)", url: "https://www.cfius.gov/" },
  ao10: { titel: "§ 10 AO — Geschäftsleitung", url: "https://www.gesetze-im-internet.de/ao_1977/__10.html" },
  kstg1: { titel: "§ 1 KStG — Unbeschränkte Steuerpflicht", url: "https://www.gesetze-im-internet.de/kstg_1977/__1.html" },
  kstgAt1: { titel: "§ 1 KStG 1988 (Österreich) — Unbeschränkte und beschränkte Steuerpflicht (RIS)", url: "https://www.ris.bka.gv.at/NormDokument.wxe?Abfrage=Bundesnormen&Gesetzesnummer=10004569&Paragraf=1" },
  dbg50: { titel: "Art. 50 DBG (Schweiz) — Persönliche Zugehörigkeit juristischer Personen (fedlex)", url: "https://www.fedlex.admin.ch/eli/cc/1991/1184_1184_1184/de#art_50" },
  fl6050902: { titel: "Florida Statutes 2026, § 605.0902 — Zulassung auswärtiger LLCs", url: "https://www.flsenate.gov/Laws/Statutes/2026/605.0902" },
  be13: { titel: "15 CFR 801.7 — BE-13, Meldung neuer ausländischer Direktinvestitionen an die BEA", url: "https://www.law.cornell.edu/cfr/text/15/801.7" },
  wayfair: { titel: "Supreme Court — South Dakota v. Wayfair, Inc. (21.06.2018)", url: "https://www.law.cornell.edu/supremecourt/text/17-494" },
  fl2120596: { titel: "Florida Statutes 2026, § 212.0596 — Sales Tax bei Fernverkäufen", url: "https://www.flsenate.gov/Laws/Statutes/2026/212.0596" },
  marke211: { titel: "37 CFR 2.11 — Vertretungspflicht für Markenanmelder mit Sitz außerhalb der USA", url: "https://www.law.cornell.edu/cfr/text/37/2.11" },
  marke26: { titel: "37 CFR 2.6 — Gebühren des USPTO für Markenanmeldungen", url: "https://www.law.cornell.edu/cfr/text/37/2.6" },
  i9: { titel: "USCIS — Form I-9, Employment Eligibility Verification", url: "https://www.uscis.gov/i-9" },
  p15: { titel: "IRS — Publication 15, Employer’s Tax Guide", url: "https://www.irs.gov/publications/p15" },
  vwp: { titel: "U.S. Customs and Border Protection — Visa Waiver Program", url: "https://www.cbp.gov/travel/international-visitors/visa-waiver-program" },
  esta: { titel: "U.S. Customs and Border Protection — Electronic System for Travel Authorization (ESTA)", url: "https://www.cbp.gov/travel/international-visitors/esta" },
  usc11: { titel: "26 U.S.C. § 11 — Steuersatz der Corporation (21 Prozent)", url: "https://www.law.cornell.edu/uscode/text/26/11" },
  e2: { titel: "USCIS — E-2 Treaty Investors", url: "https://www.uscis.gov/working-in-the-united-states/temporary-workers/e-2-treaty-investors" },
  gaoSba: { titel: "GAO B-338157 (01.07.2026) — SBA-Mitteilungen zur Eigentümerregel bei 7(a)- und 504-Krediten", url: "https://www.gao.gov/products/b-338157" },
};

export const SEITE: GlobalSeite = {
  pfad: "/business/wissen/markteintritt-usa",
  art: "wissen",
  seo: {
    titel: "Markteintritt USA: Schritt für Schritt — FIAON Global",
    beschreibung: "Markteintritt USA für den Mittelstand: Struktur, Bundesstaat, Konto, Steuern in beiden Ländern, Personal, Finanzierung — Schritte, Kosten, Quellen.",
  },
  stand: STAND,
  erschienen: S,
  kennung: "FG · 48",
  auge: "Wissen · Unternehmensberatung USA",
  h1: "Markteintritt USA.",
  h1b: "Zehn Schritte, mit Kosten und Quellen.",
  lead: "Ein Markteintritt USA verläuft in zehn Schritten, vom Vorhaben bis zur Finanzierung. Jeder Schritt steht hier mit seinen Pflichten, Kosten und Quellen. Am Ende steht, was FIAON Global als Unternehmensberatung für Ihre US-Expansion übernimmt.",
  ziffern: [
    { wert: IRS.koerperschaftsteuer, label: "Bundessteuer auf den Gewinn einer US-Corporation" },
    { wert: "45 Tage", label: "Frist der BE-13-Meldung nach der Gründung" },
    { wert: STRAFE_5472, label: "Strafe der IRS je versäumter Form 5472 und Jahr" },
  ],
  blick: [
    ["Ausgangspunkt", "Das Vorhaben: Vertrieb, Einkauf, Team oder Projekte in den USA"],
    ["Struktur", "LLC, Corporation oder Tochter Ihrer GmbH, AG oder Holding"],
    ["Steuern", "Es zählt der Ort der Geschäftsleitung; Mitteilung nach § 138 AO"],
    ["US-Meldungen", "Form 5472 jährlich, BE-13 einmalig zur Gründung"],
    ["Finanzierung", "Nacheinander: Konto, Firmenkarten, Umsatz, Bankkredit. Es entscheidet das jeweilige Institut."],
    ["Kosten", "Staatsgebühren, Registered Agent, jährliche US-Meldung und Marke — mit Quelle und Stand"],
  ],
  kurz: "Ein Markteintritt USA verläuft in zehn Schritten, vom Vorhaben über die Gründung bis zur Finanzierung. Vor der Gründung werden Struktur und Bundesstaat festgelegt: LLC, Corporation oder Tochter der eigenen GmbH. Wird die US-Gesellschaft vom Wohnsitzland aus geführt, bleibt sie dort steuerpflichtig. In den USA gelten jährliche Meldungen wie Form 5472 und einmalig die BE-13-Meldung an die Statistikbehörde BEA.",
  bloecke: [
    {
      typ: "text", id: "fragen-vorab", h2: "Drei Fragen vor der Gründung",
      absaetze: [
        "Die erste Frage vor dem Markteintritt: Was soll in den USA geschehen? In Betracht kommen der Vertrieb aus Europa an US-Kunden, Einkauf oder Lager in den USA und Projekte auf amerikanischen Baustellen. Auch ein eigenes Team oder die Aufnahme von Investoren kann Teil des Vorhabens sein. Jede Antwort führt zu einer anderen Struktur und zu anderen Pflichten. Wer ein Geschäft in den USA aufbauen will, beginnt deshalb mit einer Beschreibung des Vorhabens und mit Zahlen für die ersten Geschäftsjahre.",
        "Die zweite Frage: Wer führt die Gesellschaft, und von wo aus? Nach deutschem Recht ist eine Körperschaft unbeschränkt steuerpflichtig, wenn ihre Geschäftsleitung im Inland liegt (§ 1 KStG). Geschäftsleitung ist der Mittelpunkt der geschäftlichen Oberleitung (§ 10 AO). Eine US-Gesellschaft, die von München oder Hamburg aus geführt wird, ist deshalb auch in Deutschland steuerpflichtig. Diese Frage klären Sie vor der Gründung. Österreich (§ 1 Abs. 2 KStG 1988) und die Schweiz (Art. 50 DBG) knüpfen die Steuerpflicht ebenfalls an Sitz oder Ort der Leitung.",
        "Die dritte Frage: Woher kommen die Mittel, und wann? Eine neue US-Gesellschaft hat keine Kredithistorie. Konto, Firmenkarten und Kredite kommen deshalb nacheinander in Betracht. Über jeden Antrag entscheidet das jeweilige Institut. Wer das einplant, finanziert die ersten Monate aus eigenen Mitteln oder aus dem Stammhaus. Parallel dazu baut die Gesellschaft ihre Bonität in den USA auf.",
        "Staatliche Anlaufstelle für ausländische Investoren ist das Programm SelectUSA des US-Handelsministeriums. Über SelectUSA finden Sie auch die Wirtschaftsförderungen der Bundesstaaten und Regionen. Der Ausschuss CFIUS prüft bestimmte Beteiligungen an US-Unternehmen und bestimmte Immobiliengeschäfte ausländischer Personen. Den Vorsitz hat das US-Finanzministerium; Maßstab sind die Folgen für die nationale Sicherheit. Ob ein Kauf oder eine Beteiligung darunter fällt, ist eine Rechtsfrage für einen Anwalt.",
      ],
    },
    {
      typ: "etappen", id: "etappen", h2: "Der Markteintritt USA in zehn Schritten",
      lead: "Die Reihenfolge hat einen Grund: Jeder Schritt setzt den vorigen voraus. Wer eine US-Tochter gründen will, geht dieselben Schritte; Gesellschafterin ist dann die GmbH, AG oder Holding.",
      etappen: [
        { titel: "Vorhaben", dauer: "vor der Gründung", text: "Sie klären, was in den USA geschehen soll, wer die Gesellschaft führt und welche Mittel sie braucht — für beide Länder." },
        { titel: "Struktur", dauer: "vor der Gründung", text: "Zur Wahl stehen LLC, Corporation oder eine Tochter Ihrer GmbH, AG oder Holding. Die Wahl bestimmt Haftung, Steuern und Meldungen." },
        { titel: "Bundesstaat", dauer: "vor der Gründung", text: "Maßgeblich sind der Ort des Geschäfts, die Kosten und das Recht des Staats. Wer in einem zweiten Staat tätig wird, braucht dort eine Zulassung." },
        { titel: "Gründung", dauer: "Start", text: "Sie reichen die Gründung beim Bundesstaat ein und benennen einen Registered Agent mit Anschrift im Staat; er nimmt amtliche Post entgegen. Den Gesellschaftsvertrag entwirft ein Anwalt: das Operating Agreement der LLC oder die Satzung. Über die Eintragung entscheidet der Bundesstaat." },
        { titel: "Steuernummern", dauer: "mit der Gründung", text: "Die EIN ist die Steuernummer der Gesellschaft; Konto und Meldungen setzen sie voraus. Bei Bedarf kommt die ITIN hinzu, Ihre persönliche US-Steuernummer (Form W-7). Über beide entscheidet die US-Steuerbehörde IRS." },
        { titel: "Konto und Zahlungswege", dauer: "nach der EIN", text: "Die Gesellschaft beantragt ein Geschäftskonto bei einem US-Institut und richtet die Zahlungswege für ihre US-Kunden ein. Über das Konto entscheidet das Institut." },
        { titel: "Verträge und Marke", dauer: "vor dem ersten Verkauf", text: "Verträge folgen US-Recht, auch die mit der eigenen GmbH. Ihre Marke schützt die Eintragung beim US-Markenamt USPTO." },
        { titel: "Personal", dauer: "mit der ersten Einstellung", text: "Der Arbeitgeber prüft die Arbeitserlaubnis, führt Lohnsteuer ab und meldet in der Regel vierteljährlich an die IRS." },
        { titel: "Steuern und Meldungen", dauer: "jedes Jahr", text: "In den USA: Form 5472, Steuererklärung und Staatsgebühr, einmalig die BE-13-Meldung. In Deutschland: die Mitteilung nach § 138 AO und Ihre Steuererklärung." },
        { titel: "Finanzierung", dauer: "laufend", text: "Zuerst Konto und Firmenkarten, dann Lieferantenkonten und Umsatz, später der Bankkredit mit Sicherheiten. Über jede Finanzierung entscheidet das Institut." },
      ],
    },
    {
      typ: "text", id: "struktur", h2: "Struktur und Bundesstaat: zwei Entscheidungen",
      absaetze: [
        `Drei Strukturen kommen in Betracht. Die LLC hat ein Operating Agreement statt fester Organe; die Haftung ist auf die Gesellschaft beschränkt. Ohne Wahl nach Form 8832 wird sie in den USA nicht selbst besteuert. Mit einem Gesellschafter gilt sie als „disregarded entity“, mit mehreren als Personengesellschaft. Die Corporation ist ein eigenes Steuersubjekt mit ${IRS.koerperschaftsteuer} Bundessteuer auf den Gewinn (26 U.S.C. § 11). Hinzu kommt die Steuer des Staats, wo er eine erhebt (Florida: ${STAAT.florida.steuer}). Die Corporation gibt Anteile aus und kann so Investoren aufnehmen. Die dritte Struktur: Ihre GmbH, AG oder Holding wird Gesellschafterin einer US-Tochter. Wird sie stattdessen selbst als Zweigniederlassung tätig, haftet sie voll für das US-Geschäft.`,
        `Beim Bundesstaat zählen drei Punkte: der Ort des Geschäfts, die jährlichen Gebühren und die späteren Investoren. Florida verlangt ${STAAT.florida.gruendung} zur Gründung und ${STAAT.florida.jahr} im Jahr. Delaware verlangt ${STAAT.delaware.gruendung} und als Jahressteuer der LLC ${STAAT.delaware.jahr}. Wyoming verlangt ${STAAT.wyoming.gruendung} und jährlich ${STAAT.wyoming.jahr}.`,
        "Wichtiger als die Gebühr ist der Ort des Geschäfts. Eine LLC aus einem anderen Staat darf in Florida erst Geschäfte machen, wenn sie dort zugelassen ist (Certificate of Authority, § 605.0902 Florida Statutes). Wer in Delaware gründet und in Florida arbeitet, trägt deshalb Gebühren und Jahresmeldungen in zwei Staaten.",
        `Gehört die US-Gesellschaft einer Kapitalgesellschaft, ändert sich auch die Steuer im Bundesstaat. ${STAAT.florida.llcSteuer}`,
      ],
    },
    {
      typ: "text", id: "konto", h2: "US-Geschäftskonto und Zahlungswege",
      absaetze: [
        `Ein Geschäftskonto setzt die EIN voraus; die IRS vergibt sie ohne Gebühr. Für das Konto einer LLC verlangen US-Institute in der Regel das Gründungsdokument, die EIN-Bestätigung und das Operating Agreement. Hinzu kommen die Pässe aller Gesellschafter ab ${SCHWELLEN.eigentuemer} und der Person, die die Gesellschaft lenkt. Außerdem verlangen die Institute eine nachvollziehbare Beschreibung des Geschäfts mit den erwarteten Zahlungsströmen. Nach US-Recht müssen sie die wirtschaftlich Berechtigten feststellen und prüfen (31 CFR 1010.230). Dazu zählen jeder Inhaber von mindestens ${SCHWELLEN.eigentuemer} und eine Person, die die Gesellschaft lenkt. Über die Eröffnung entscheidet das jeweilige Institut.`,
        `Die Einlagenversicherung der FDIC deckt bei einem versicherten Institut ${SCHWELLEN.fdic} je Einleger, Institut und Eigentumskategorie. Für Zahlungen Ihrer US-Kunden kommen Inlandsüberweisungen, Auslandsüberweisungen und Kartenzahlungen über einen Zahlungsdienstleister in Betracht. Jeder Zahlungsdienstleister prüft Gesellschaft, Vertreter und Geschäftsmodell eigenständig. Name, Anschrift und Telefonnummer sollten deshalb in jedem Antrag dieselbe Schreibweise haben.`,
      ],
    },
    {
      typ: "tabelle", id: "kosten", h2: "Kostenblöcke beim Markteintritt USA",
      lead: "Die Tabelle zeigt, was beim Staat, bei der IRS, beim Markenamt und am Markt anfällt. Ihre Betriebskosten wie Personal, Miete und Versicherung kommen hinzu.",
      kopf: ["Kostenblock", "Betrag", "Grundlage"],
      zeilen: [
        ["Gründung beim Bundesstaat", `Florida ${STAAT.florida.gruendung}, Delaware ${STAAT.delaware.gruendung}, Wyoming ${STAAT.wyoming.gruendung}`, "Gebührenordnung des Staats"],
        ["Jährliche Staatsgebühr", `Florida ${STAAT.florida.jahr}, Delaware ${STAAT.delaware.jahr} (LLC), Wyoming ${STAAT.wyoming.jahr}`, "Annual Report oder Annual Tax"],
        ["EIN der Gesellschaft", "keine Gebühr", "IRS"],
        ["Registered Agent", MARKT.agent, "veröffentlichte Angaben mehrerer Anbieter"],
        ["Jährliche US-Meldung durch einen US-Steuerberater (CPA)", MARKT.cpa5472, "veröffentlichte Angaben mehrerer Anbieter"],
        ["Markenanmeldung beim USPTO", "350 $ je Klasse, elektronisch, dazu mögliche Zuschläge", "37 CFR 2.6, zuzüglich Honorar des US-Anwalts"],
        ["Versäumte Form 5472", IRS.strafe5472, "Strafe der IRS"],
      ],
      fuss: [
        "Staatsgebühren nach den amtlichen Gebührenordnungen, Stand September 2026. Delaware: Jahressteuer der LLC ab dem Steuerjahr 2026. Marktspannen: veröffentlichte Angaben mehrerer Anbieter, Stand September 2026 — keine amtlichen Werte.",
        "In der Tabelle nicht enthalten: Betriebskosten Ihrer US-Gesellschaft wie Lohnbuchhaltung, Versicherungen, Miete und Registrierungen für die Sales Tax.",
      ],
    },
    {
      typ: "text", id: "steuern", h2: "Steuern und Meldungen in beiden Ländern",
      absaetze: [
        `In den USA: Auf Form 5472 melden zwei Arten von Gesellschaften jährlich ihre Geschäfte mit nahestehenden Personen. Die erste ist die LLC, die ganz einer ausländischen Person gehört. Die zweite ist jede US-Corporation, an der eine ausländische Person mindestens 25 Prozent hält. Die LLC reicht die Meldung mit einer Pro-forma-Form 1120 ein, auch im Jahr ohne Umsatz. Schon Zahlungen des Inhabers zur Gründung zählen dazu. Fällig ist die Meldung bei Kalenderjahr am ${IRS.frist5472}. Die Strafe für eine versäumte Meldung beträgt ${IRS.strafe5472} (IRS, Stand ${FAKTEN_STAND}).`,
        "Hinzu kommt die Meldung BE-13 an die US-Statistikbehörde BEA (Bureau of Economic Analysis). Sie ist Pflicht, wenn eine ausländische Person ein US-Unternehmen gründet oder erwirbt und daran mindestens 10 Prozent der Stimmrechte hält. Die Frist endet 45 Kalendertage nach Gründung oder Erwerb; die Pflicht besteht auch ohne Aufforderung der Behörde (15 CFR 801.7). Die ausführliche Meldung verlangt die BEA erst bei Kosten von mehr als 40 Mio. $. Bei höchstens 40 Mio. $ genügt die kurze Freistellungserklärung (BE-13 Claim for Exemption). Die Meldung der wirtschaftlich Berechtigten an die Behörde FinCEN (BOI-Meldung) entfällt dagegen seit August 2026 endgültig für Gesellschaften, die in den USA gegründet sind. Manche Checklisten nennen sie noch als Pflicht.",
        "Verkaufen Sie an US-Kunden, kommt die Sales Tax hinzu, die Umsatzsteuer der Bundesstaaten. Grundlage ist die Entscheidung South Dakota v. Wayfair des Supreme Court vom 21. Juni 2018. Seither dürfen Staaten die Steuer auch von Händlern ohne Präsenz im Staat verlangen. Florida verpflichtet Händler zur Erhebung, wenn ihre steuerpflichtigen Fernverkäufe nach Florida im vorigen Kalenderjahr zusammen 100.000 $ überschritten haben (§ 212.0596 Florida Statutes). Jeder Staat setzt eigene Schwellen.",
        "In Deutschland: Wer eine ausländische Gesellschaft gründet oder eine Beteiligung an einer solchen erwirbt, muss das dem Finanzamt mitteilen (§ 138 Abs. 2 AO). Die Mitteilung reichen Sie mit der Steuererklärung für das Jahr der Gründung ein, spätestens 14 Monate nach dessen Ablauf (§ 138 Abs. 5 AO). Bei einer Kapitalgesellschaft mit Sitz und Geschäftsleitung außerhalb Deutschlands gilt das ab 10 Prozent Beteiligung oder ab Anschaffungskosten von mehr als 150.000 €; wer erstmals beherrschenden Einfluss erlangt, meldet unabhängig davon (§ 138 Abs. 2 Nr. 4 AO). Wird die US-Gesellschaft als Personengesellschaft eingeordnet, gilt keine Schwelle. Welcher Staat welche Gewinne besteuert, regelt das Doppelbesteuerungsabkommen zwischen Deutschland und den USA. Liefert die eigene GmbH Waren, Software oder Leistungen an die Tochter, müssen die Preise einem Fremdvergleich standhalten (§ 1 AStG). Österreich und die Schweiz haben eigene Regeln. Welche Regel in Ihrem Fall gilt, ist eine Steuerfrage für Ihren Steuerberater im Wohnsitzland.",
      ],
    },
    {
      typ: "text", id: "personal", h2: "Verträge, Marke und Personal: die Grundzüge",
      absaetze: [
        "Die US-Gesellschaft schließt ihre Verträge nach US-Recht: mit Kunden, Lieferanten, Vermietern und Vertriebspartnern. Liefert die eigene GmbH an die Tochter, schließen beide ebenfalls einen Vertrag. Die Geschäfte zwischen Mutter und Tochter gehören zudem auf Form 5472. Verträge nach US-Recht sind Sache eines US-Anwalts.",
        "Ihre Marke schützt erst die Eintragung beim US-Patent- und Markenamt (USPTO). Der eingetragene Name einer Gesellschaft ist noch keine Marke. Anmelder mit Wohnsitz oder Sitz außerhalb der USA müssen sich von einem Anwalt vertreten lassen, der vor dem USPTO zugelassen ist (37 CFR 2.11). Die Grundgebühr beträgt 350 $ je Klasse bei elektronischer Anmeldung (37 CFR 2.6). Den Namen prüfen Sie deshalb vor der Gründung.",
        "Wer in den USA Mitarbeiter einstellt, wird dort Arbeitgeber. Bei jeder Einstellung prüft der Arbeitgeber Identität und Arbeitserlaubnis mit Form I-9 (USCIS). Die Gesellschaft behält Lohnsteuer ein und führt sie mit den Beiträgen zu Social Security und Medicare ab. Sie meldet in der Regel vierteljährlich mit Form 941 und stellt jedem Mitarbeiter Form W-2 aus (IRS Publication 15). Lohnbuchhaltung und Arbeitsrecht sind Sache eines Lohnbüros und eines Anwalts für Arbeitsrecht in den USA.",
        "Für Gespräche, Messen und Termine reisen Staatsangehörige der Teilnehmerländer im Visa Waiver Program ohne Visum ein. Das gilt für geschäftliche Aufenthalte von höchstens 90 Tagen. Ob sie so reisen dürfen, prüft vorab das elektronische System ESTA (CBP). Wer die US-Gesellschaft dauerhaft in den USA führen will, braucht ein Visum. Für Investoren aus Vertragsstaaten kommt das E-2-Visum in Betracht. Es setzt eine erhebliche Investition in ein echtes Unternehmen voraus, getätigt oder im Gange, das der Investor aufbaut und lenkt (USCIS). Über jedes Visum entscheidet die US-Behörde. Ob es in Ihrem Fall in Betracht kommt, ist eine Rechtsfrage für einen Anwalt für Einwanderungsrecht.",
      ],
    },
    {
      typ: "text", id: "kapital", h2: "Finanzierungswege einer neuen US-Gesellschaft",
      absaetze: [
        "Eine neue US-Gesellschaft hat keine Kredithistorie. Die Finanzierungswege kommen deshalb nacheinander in Betracht. Am Anfang stehen Firmenkarten, deren Rahmen sich häufig am Kontoguthaben orientiert. Es folgen Lieferantenkonten mit Zahlungsziel und die Kennziffer der Gesellschaft bei der Wirtschaftsauskunftei (D-U-N-S-Nummer). Danach kommen Kredite von Zahlungsplattformen nach Umsatz in Betracht. Später folgt ein Kredit der Bank, etwa gestützt auf Sicherheiten der Muttergesellschaft. Persönliche US-Karten richten sich nach Ihrer persönlichen US-Kreditgeschichte, nicht nach der Gesellschaft.",
        "Staatlich gestützte Kleinunternehmerkredite der SBA (Programme 7(a) und 504) folgen seit dem 1. März 2026 einer Eigentümerregel. Alle direkten und indirekten Eigentümer müssen US-Staatsbürger oder US-Staatsangehörige mit Hauptwohnsitz in den USA sein; Inhaber einer Green Card zählen nicht dazu (GAO B-338157). Eine Gesellschaft mit Inhabern ohne US-Staatsangehörigkeit ist von diesen Programmen damit ausgeschlossen.",
        KAPITAL_FREI,
        `${satz("S9")} ${satz("S1")}`,
      ],
    },
    {
      typ: "karten", id: "fehler", h2: "Expansion in die USA: typische Fehler", spalten: 3,
      lead: "Sechs Fehler, die sich vor der Gründung vermeiden lassen.",
      karten: [
        { tag: "Steuern", titel: "Ort der Geschäftsleitung übersehen", text: "Die US-Gesellschaft wird aus Europa geführt und dennoch als rein amerikanisch behandelt. Der Ort der Geschäftsleitung bestimmt die Steuerpflicht im Wohnsitzland mit." },
        { tag: "Bundesstaat", titel: "Gründen, wo das Geschäft nicht stattfindet", text: "Wer in Delaware gründet und in Florida tätig ist, braucht auch dort eine Zulassung. Hinzu kommen ein zweiter Registered Agent und eine zweite Jahresmeldung." },
        { tag: "US-Meldung", titel: "Form 5472 ohne Umsatz übersehen", text: `Die Pflicht gilt auch im Jahr ohne Umsatz. Schon Zahlungen des Inhabers zur Gründung zählen. Die Strafe der IRS für eine versäumte Meldung beträgt ${IRS.strafe5472}.` },
        { tag: "Statistik", titel: "BE-13-Meldung versäumen", text: "Die Meldung an die BEA ist Pflicht, auch ohne Aufforderung der Behörde. Bei Kosten von höchstens 40 Mio. $ genügt die kurze Freistellungserklärung." },
        { tag: "Marke", titel: "Den Namen nicht prüfen", text: "Ein eingetragener Firmenname ist noch keine Marke. Kollidiert er mit einer US-Marke, kann nach dem Start eine Umbenennung nötig werden." },
        { tag: "Finanzierung", titel: "Kredite vor Umsatz einplanen", text: "Über jeden Kredit entscheidet das Institut. Solange die Gesellschaft weder Kredithistorie noch Umsatz hat, ist diese Entscheidung offen." },
      ],
    },
    {
      typ: "rollen", id: "rollen", h2: "Wer was verantwortet",
      lead: weitererSatz("ROLLEN"),
      fiaon: [
        "Anmeldung beim Bundesstaat über unsere Partner in den USA, Staatsgebühr enthalten",
        "Registered Agent, US-Geschäftsadresse und US-Telefonnummer im ersten Jahr",
        "Anträge für EIN und ITIN (die ITIN nach unserem ITIN-Check)",
        "Pflichtenkalender und erste Jahresmeldung beim Bundesstaat",
        "Vollständig vorbereitete Anträge für Konten, Kreditkarten auf Wunsch und Finanzierung",
        "Ein fester Ansprechpartner für Post, Anrufe und Termine Ihrer Gesellschaft",
      ],
      partner: [
        "Partner-Anwälte: Rechtsfragen, in eigener Verantwortung",
        "US-Steuerberater (CPA) aus unserem Partnernetz: die erste jährliche US-Meldung (Form 5472 mit Form 1120)",
        "Partner-Steuerberater im Wohnsitzland: Steuerfragen, in eigener Verantwortung",
      ],
      sie: [
        "Ziel und Zahlen Ihres US-Geschäfts festlegen",
        "Reisepass hochladen und die vorgelegten Unterlagen unterzeichnen; bei einer Tochter zusätzlich den Registerauszug der Muttergesellschaft einreichen",
        "Verträge mit Kunden, Lieferanten und Mitarbeitern schließen",
        "Die Steuererklärung im Wohnsitzland, mit Ihrem Steuerberater",
        "Konto-, Karten- und Finanzierungsanträge selbst stellen — es entscheidet das jeweilige Institut",
      ],
    },
    {
      typ: "text", id: "fiaon", h2: "Was FIAON Global dabei übernimmt",
      absaetze: [
        "Als Unternehmensberatung gründet FIAON Global in Ihrem Mandat eine LLC. Soll Ihre GmbH die Anteile halten oder kommt eine Corporation in Betracht, stimmen wir das vorab im Gespräch mit Ihnen ab.",
        `${weitererSatz("UEBERGANG-EINREICHUNG")} ${UNTERLAGEN.satz}`,
      ],
      punkte: [
        `Konto, Karten und Finanzierung: ${satz("S2")}`,
        `${TEIL.ihrTeil}: ${UNTERLAGEN.ihrTeil}`,
        `${TEIL.bedingung}: ${satz("S3")}`,
      ],
      nach: P.geldZurueck,
    },
    {
      typ: "karten", id: "vertiefung", h2: "Die Schritte im Einzelnen", spalten: 3,
      karten: [
        { tag: "Struktur", titel: "Die Tochter in den USA", text: "Wenn Ihre GmbH, AG oder Holding Gesellschafterin wird: Ablauf und Unterlagen.", pfad: "/business/tochtergesellschaft-usa" },
        { tag: "Gründung", titel: "US-Firmengründung", text: "Anmeldung beim Bundesstaat, Unterlagen und Anträge für EIN und ITIN in einem Mandat.", pfad: "/business/us-firmengruendung" },
        { tag: "Bundesstaat", titel: "Wahl des Bundesstaats", text: "Delaware, Florida oder Wyoming: Zeiten, Kosten, Vor- und Nachteile.", pfad: "/business/wissen/bundesstaat-waehlen" },
        { tag: "Konto", titel: "Das US-Geschäftskonto", text: "Welche Unterlagen Institute verlangen und wie der Antrag entsteht. Über das Konto entscheidet das Institut.", pfad: "/business/us-geschaeftskonto" },
        { tag: "Pflichten", titel: "Ihre US-Pflichten", text: "Form 5472, Staatsgebühr, Registered Agent und die Meldung im Wohnsitzland in einem Kalender.", pfad: "/business/us-pflichten" },
        { tag: "Miami", titel: "Persönlich in Miami", text: weitererSatz("MIAMI"), pfad: "/business/miami" },
      ],
    },
    {
      typ: "verzeichnis", id: "weiterlesen-etappen", h2: "Zum Nachlesen je Schritt",
      eintraege: [
        { pfad: "/business/wissen/llc-oder-corporation", tag: "Struktur" },
        { pfad: "/business/ein-itin", tag: "Steuernummern" },
        { pfad: "/business/wissen/us-bankkonto-unterlagen", tag: "Konto" },
        { pfad: "/business/wissen/form-5472", tag: "Meldungen" },
        { pfad: "/business/wissen/finanzierungswege-usa", tag: "Finanzierung" },
        { pfad: "/business/kosten", tag: "Kosten" },
      ],
    },
    { typ: "paket", id: "mandat", h2: P.karteH2, lead: P.karteLead, paket: "global_banking" },
    {
      typ: "hinweis", id: "wissen", h2: "Was Sie wissen müssen",
      punkte: [
        satz("S10"),
        GLOBAL_PFLICHTHINWEIS.de[0],
        GLOBAL_PFLICHTHINWEIS.de[1],
        GLOBAL_PFLICHTHINWEIS.de[2],
        "In Ihrem Mandat nicht enthalten sind: Visa, Lohnbuchhaltung, Verrechnungspreise, Registrierungen für die Sales Tax und Markenanmeldungen.",
        `FIAON vergibt und vermittelt keine Kredite. ${satz("S1")}`,
      ],
    },
  ],
  fragen: [
    { f: "Was kostet ein Markteintritt in den USA?", a: `Beim Bundesstaat kostet die Gründung in Florida ${STAAT.florida.gruendung}, in Delaware ${STAAT.delaware.gruendung} und in Wyoming ${STAAT.wyoming.gruendung}. Jährlich kommen die Staatsgebühr, der Registered Agent und die US-Meldung durch einen US-Steuerberater (CPA) hinzu. Die großen Posten sind Ihre Betriebskosten wie Personal, Miete und Versicherung sowie die Mittel für die ersten Monate.` },
    { f: "Brauche ich für die US-Expansion eine eigene Gesellschaft?", a: "Nein, nicht zwingend. Ihre GmbH kann als Zweigniederlassung tätig werden; sie haftet dann voll für das US-Geschäft. Eine eigene LLC oder Corporation trennt die Haftung vom Stammhaus. Sie ist Vertragspartnerin Ihrer US-Kunden in den USA. Welche Struktur passt, hängt vom Vorhaben ab. Klären Sie das vor der Gründung mit Ihrem Steuerberater und einem US-Steuerberater (CPA)." },
    { f: "Ist eine US-Tochter in Deutschland steuerpflichtig?", a: "Sie kann es sein. Wird sie tatsächlich aus Deutschland geleitet, liegt ihre Geschäftsleitung im Inland (§ 10 AO). Eine Corporation ist dann in Deutschland unbeschränkt körperschaftsteuerpflichtig (§ 1 KStG). Bei einer LLC hängt die Besteuerung von ihrer Einordnung ab. Die Beteiligung teilen Sie dem Finanzamt nach § 138 AO mit. Wie das Doppelbesteuerungsabkommen in Ihrem Fall greift, ist eine Steuerfrage für Ihren Steuerberater." },
    { f: "Was ist die BE-13-Meldung?", a: "Sie ist eine Pflichtmeldung an die US-Statistikbehörde BEA. Sie gilt, wenn eine ausländische Person ein US-Unternehmen gründet oder erwirbt und daran mindestens 10 Prozent der Stimmrechte hält. Fällig ist sie spätestens 45 Kalendertage danach, auch ohne Aufforderung (15 CFR 801.7). Bei Kosten von höchstens 40 Mio. $ genügt die kurze Freistellungserklärung." },
    { f: "Brauche ich ein Visum, um meine US-Gesellschaft zu führen?", a: "Für Gespräche und Termine nicht: Staatsangehörige der Teilnehmerländer reisen im Visa Waiver Program mit ESTA-Genehmigung ohne Visum ein. Das gilt für geschäftliche Aufenthalte von höchstens 90 Tagen. Wer die Gesellschaft dauerhaft in den USA führen will, braucht ein Visum. Für Investoren aus Vertragsstaaten kommt das E-2-Visum in Betracht. Über jedes Visum entscheidet die US-Behörde. Rechtsfragen dazu sind Sache eines Anwalts für Einwanderungsrecht." },
    { f: "Was übernimmt FIAON Global als Unternehmensberatung?", a: `${weitererSatz("UEBERGANG-EINREICHUNG")} ${UNTERLAGEN.satz} Für Konto, Karten und Finanzierung gilt: ${satz("S2")} ${weitererSatz("ROLLEN")}` },
    { f: GLOBAL_KAPITAL_FREI.de.frage, a: GLOBAL_KAPITAL_FREI.de.antwort },
  ],
  paket: "global_banking",
  weiter: ["/business/wissen/tochter-oder-zweigniederlassung", "/business/wissen/us-llc-wohnsitz-deutschland", "/business/wissen/e2-visum", "/business/wissen/us-funding"],
  quellen: [
    QUELLEN.selectusa,
    QUELLEN.cfius,
    QUELLEN.ao10,
    QUELLEN.kstg1,
    QUELLEN.kstgAt1,
    QUELLEN.dbg50,
    Q.ao138,
    Q.dba,
    Q.astg1,
    Q.f8832,
    Q.smllc,
    QUELLEN.usc11,
    Q.i1120,
    Q.i5472,
    QUELLEN_IRS[5],
    QUELLEN_STAATEN.florida[0],
    QUELLEN_STAATEN.florida[1],
    QUELLEN_STAATEN.florida[2],
    QUELLEN_STAATEN.florida[4],
    QUELLEN_STAATEN.delaware[0],
    QUELLEN_STAATEN.delaware[1],
    QUELLEN_STAATEN.wyoming[0],
    QUELLEN_STAATEN.wyoming[1],
    QUELLEN.fl6050902,
    Q.ein,
    Q.w7,
    Q.cdd,
    Q.fdic,
    QUELLEN.be13,
    Q.boiEnde,
    QUELLEN.wayfair,
    QUELLEN.fl2120596,
    QUELLEN.marke211,
    QUELLEN.marke26,
    QUELLEN.i9,
    QUELLEN.p15,
    QUELLEN.vwp,
    QUELLEN.esta,
    QUELLEN.e2,
    Q.duns,
    QUELLEN.gaoSba,
  ],
};
