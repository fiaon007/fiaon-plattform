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
import { SAETZE_BETRAEGE, SCHRITTE_KOPF, SECHS_SCHRITTE, beleg, satz, weitererSatz } from "../../fiaon-global-saetze";
import { EIN_PRODUKT } from "../ein-produkt";
import { FAKTEN_STAND, IRS, MARKT, QUELLEN_IRS, QUELLEN_STAATEN, QUELLEN_WISSEN as Q, SCHWELLEN, STAAT } from "../fakten";

/** Tag der Erstveröffentlichung (E-439). */
const S = "2026-10-27";
/** Tag der letzten inhaltlichen Änderung (E-510, Sprachleitfaden). */
const STAND = "2026-11-13";
const KAPITAL_FREI = `${GLOBAL_KAPITAL_FREI.de.satz} ${GLOBAL_KAPITAL_FREI.de.steuer}`;
const P = EIN_PRODUKT.de;
const B = SAETZE_BETRAEGE.de;
/** Schritt 2 der festen Erzählung (Leitfaden 2.2) — Satz und „Ihr Teil“ wortgleich aus der einen Quelle. */
const UNTERLAGEN = SECHS_SCHRITTE.de.find((x) => x.nr === 2)!;
/** Die Namen der festen Teile eines Schritts: „Ihr Teil“, „Bedingung“ (Leitfaden 2.1). */
const TEIL = SCHRITTE_KOPF.de.teile;
/** Wer Steuerfragen im Wohnsitzland verantwortet — dieselbe Zeile wie auf den Zielgruppen-Seiten. */
const STEUERFRAGEN = "Steuerfragen klären Partner-Steuerberater in eigener Verantwortung; die laufende Steuererklärung übernimmt Ihr Steuerberater.";
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
  h1b: "Die Unternehmensberatung für Ihren Weg — Schritt für Schritt.",
  lead: "Ein Markteintritt USA verläuft in zehn Schritten: zuerst das Vorhaben, dann Struktur und Bundesstaat, Gründung, Steuernummern, Konto und Zahlungswege, Verträge, Personal, die Meldungen in beiden Ländern und zuletzt die Finanzierung. Jeder Schritt steht hier mit Pflichten, Kosten und Quellen. Am Ende steht, was FIAON Global als Unternehmensberatung für Ihre US-Expansion übernimmt.",
  ziffern: [
    { wert: IRS.koerperschaftsteuer, label: "Bundessteuer auf den Gewinn einer US-Corporation" },
    { wert: "45 Tage", label: "Frist der BE-13-Meldung nach der Gründung" },
    { wert: STRAFE_5472, label: "Strafe je versäumter Form 5472 und Jahr" },
  ],
  blick: [
    ["Erste Frage", "Was soll in den USA geschehen: Vertrieb, Einkauf, Team, Projekte?"],
    ["Struktur", "LLC, Corporation oder Tochter Ihrer GmbH, AG oder Holding"],
    ["Steuern", "Der Ort der Geschäftsleitung zählt; Mitteilung nach § 138 AO"],
    ["US-Meldungen", "Form 5472 jährlich, BE-13 einmalig zur Gründung"],
    ["Finanzierung", "Schritt für Schritt: Konto, Karten, Umsatz, Bank — es entscheidet das jeweilige Institut"],
    ["Mit FIAON Global", `Ein Ansprechpartner statt acht. ${beleg("honorarVorab")}`],
  ],
  kurz: "Ein Markteintritt USA verläuft in zehn Schritten: Vorhaben klären, Struktur wählen (LLC, Corporation oder Tochter der eigenen GmbH), Bundesstaat, Gründung, Steuernummern, Geschäftskonto und Zahlungswege, Verträge und Marke, Personal, Steuern und Meldungen in beiden Ländern, Finanzierung. Wird die US-Gesellschaft vom Wohnsitzland aus geführt, bleibt sie dort steuerpflichtig; in den USA gelten jährliche Meldungen wie Form 5472 und einmalig die BE-13-Meldung an die Statistikbehörde BEA. FIAON Global gründet als Unternehmensberatung die Gesellschaft, holt jede Unterlage ein und beantragt die Steuernummern; über Eintragung und Nummern entscheiden Bundesstaat und US-Steuerbehörde.",
  bloecke: [
    {
      typ: "text", id: "fragen-vorab", h2: "Bevor Sie gründen: drei Fragen",
      absaetze: [
        "Die erste Frage lautet nicht „LLC oder Corporation?“, sondern: Was soll in den USA tatsächlich geschehen? Vertrieb aus Europa an US-Kunden, Einkauf oder Lager vor Ort, Projekte auf amerikanischen Baustellen, ein eigenes Team, Investoren am Tisch — jede Antwort führt zu einer anderen Struktur und zu anderen Pflichten. Wer ein Geschäft in den USA aufbauen will, beginnt deshalb mit einem klaren Bild des Vorhabens und mit Zahlen für die ersten Geschäftsjahre.",
        "Die zweite Frage: Wer führt die Gesellschaft, und von wo aus? Nach deutschem Recht ist eine Körperschaft unbeschränkt steuerpflichtig, wenn ihre Geschäftsleitung im Inland liegt (§ 1 KStG); Geschäftsleitung ist der Mittelpunkt der geschäftlichen Oberleitung (§ 10 AO). Eine US-Gesellschaft, die von einem Schreibtisch in München oder Hamburg aus gelenkt wird, ist deshalb kein Steuermodell, sondern auch hier steuerpflichtig. Diese Frage gehört vor die Gründung, nicht in die Nachbesserung danach. Österreich (§ 1 Abs. 2 KStG 1988) und die Schweiz (Art. 50 DBG) knüpfen die Steuerpflicht ebenfalls an Sitz oder Ort der Leitung.",
        "Die dritte Frage: Woher kommt das Kapital, und wann? Eine neue US-Gesellschaft hat keine Geschichte. Konto, Karten und Kredite kommen deshalb nacheinander in Betracht, und über jeden Antrag entscheidet das jeweilige Institut. Wer das einplant, finanziert die ersten Monate aus eigenen Mitteln oder aus dem Stammhaus und baut die US-Bonität parallel auf.",
        "Staatliche Anlaufstelle für ausländische Investoren ist das Programm SelectUSA des US-Handelsministeriums; über SelectUSA finden Sie auch die Wirtschaftsförderungen der Bundesstaaten und Regionen. Bestimmte Beteiligungen an US-Unternehmen und bestimmte Immobiliengeschäfte ausländischer Personen prüft zudem der Ausschuss CFIUS unter Vorsitz des US-Finanzministeriums auf ihre Folgen für die nationale Sicherheit. Ob ein Kauf oder eine Beteiligung darunter fällt, ist eine Rechtsfrage; sie liegt bei Partner-Anwälten in eigener Verantwortung.",
      ],
    },
    {
      typ: "etappen", id: "etappen", h2: "Der Markteintritt USA in zehn Schritten",
      lead: "Die Reihenfolge trägt Bedeutung: Jeder Schritt setzt den vorigen voraus. Wer eine US-Tochter gründen will, geht denselben Weg — nur mit der GmbH, AG oder Holding als Gesellschafterin.",
      etappen: [
        { titel: "Vorhaben", dauer: "vor der Gründung", text: "Was in den USA geschehen soll, wer die Gesellschaft führt und welche Mittel sie braucht — geklärt für beide Länder." },
        { titel: "Struktur", dauer: "vor der Gründung", text: "LLC, Corporation oder Tochter Ihrer GmbH, AG oder Holding: Haftung, Steuern und Meldungen hängen an dieser Wahl." },
        { titel: "Bundesstaat", dauer: "vor der Gründung", text: "Dort, wo das Geschäft stattfindet, oder dort, wo Kosten und Recht passen. Wer in einem zweiten Staat tätig wird, braucht dort eine Zulassung." },
        { titel: "Gründung", dauer: "Start", text: "Einreichung beim Bundesstaat, Registered Agent mit Anschrift im Staat, Operating Agreement oder Satzung vom Anwalt." },
        { titel: "Steuernummern", dauer: "mit der Gründung", text: "Die EIN der Gesellschaft — ohne sie kein Konto und keine Meldung; bei Bedarf Ihre persönliche ITIN mit Form W-7." },
        { titel: "Konto und Zahlungswege", dauer: "nach der EIN", text: "Geschäftskonto bei einem US-Institut und die Wege, auf denen Ihre US-Kunden zahlen. Das Institut entscheidet." },
        { titel: "Verträge und Marke", dauer: "vor dem ersten Auftrag", text: "Verträge nach US-Recht, auch mit der eigenen GmbH; der Schutz Ihrer Marke beim USPTO." },
        { titel: "Personal", dauer: "mit der ersten Einstellung", text: "Arbeitserlaubnis prüfen, Lohnsteuer abführen, in der Regel vierteljährlich an die IRS melden." },
        { titel: "Steuern und Meldungen", dauer: "jedes Jahr", text: "In den USA Form 5472, Steuererklärung und Staatsgebühr, einmalig BE-13; zu Hause die Mitteilung nach § 138 AO und Ihre Steuererklärung." },
        { titel: "Finanzierung in Schritten", dauer: "laufend", text: "Konto und Firmenkarten, dann Lieferantenkonten und Umsatz, später Bank und Sicherheiten. Über jede Finanzierung entscheidet das Institut." },
      ],
    },
    {
      typ: "text", id: "struktur", h2: "Struktur und Bundesstaat: die zwei Weichen",
      absaetze: [
        `Drei Wege stehen offen. Eine LLC ist schlank: ein Operating Agreement statt fester Organe, die Haftung auf die Gesellschaft beschränkt; steuerlich wird sie in den USA ohne Wahl nach Form 8832 nicht selbst besteuert — mit einem Gesellschafter gilt sie als „disregarded entity“, mit mehreren als Personengesellschaft. Eine Corporation ist ein eigenes Steuersubjekt mit ${IRS.koerperschaftsteuer} Bundessteuer auf den Gewinn (26 U.S.C. § 11) zuzüglich der Steuer des Staats, wo er eine erhebt (Florida: ${STAAT.florida.steuer}); sie gibt Anteile aus und kann so Investoren aufnehmen. Und Ihre GmbH, AG oder Holding kann Gesellschafterin einer US-Tochter sein — oder selbst als Zweigniederlassung tätig werden, dann allerdings mit voller Haftung für das US-Geschäft.`,
        `Beim Bundesstaat zählen drei Dinge: wo das Geschäft stattfindet, was der Staat jährlich verlangt und wer später investieren soll. Florida verlangt ${STAAT.florida.gruendung} zur Gründung und ${STAAT.florida.jahr} im Jahr; Delaware ${STAAT.delaware.gruendung} und als Jahressteuer der LLC ${STAAT.delaware.jahr}; Wyoming ${STAAT.wyoming.gruendung} und jährlich ${STAAT.wyoming.jahr}.`,
        "Wichtiger als die Gebühr ist der Ort des Geschäfts. Eine in einem anderen Staat gegründete LLC darf in Florida erst Geschäfte machen, wenn sie dort eine Zulassung (Certificate of Authority) erhalten hat (§ 605.0902 Florida Statutes). Wer in Delaware gründet und in Florida arbeitet, trägt also Gebühren und Jahresmeldungen in zwei Staaten.",
        `Gehört die US-Gesellschaft einer Kapitalgesellschaft, ändert sich auch die Steuer im Bundesstaat. ${STAAT.florida.llcSteuer}`,
      ],
    },
    {
      typ: "text", id: "konto", h2: "Konto und Zahlungswege: Geld in den USA bewegen",
      absaetze: [
        `Ohne EIN kein Geschäftskonto. Die EIN vergibt die IRS ohne Gebühr. Für das Konto einer LLC verlangen US-Institute in der Regel das Gründungsdokument, die EIN-Bestätigung, das Operating Agreement, die Pässe aller Gesellschafter ab ${SCHWELLEN.eigentuemer} und der Person, die die Gesellschaft lenkt, sowie eine nachvollziehbare Beschreibung des Geschäfts mit den erwarteten Zahlungsströmen. Die wirtschaftlich Berechtigten — wer mindestens ${SCHWELLEN.eigentuemer} hält, und eine Person, die die Gesellschaft lenkt — müssen die Institute nach US-Recht feststellen und prüfen (31 CFR 1010.230); ob sie ein Konto eröffnen, entscheiden sie selbst.`,
        `Die Einlagenversicherung der FDIC deckt bei einem versicherten Institut ${SCHWELLEN.fdic} je Einleger, Institut und Eigentumskategorie. Für Zahlungen Ihrer US-Kunden kommen Inlandsüberweisungen, Auslandsüberweisungen und Kartenzahlungen über einen Zahlungsdienstleister in Betracht. Jeder Zahlungsdienstleister prüft Gesellschaft, Vertreter und Geschäftsmodell eigenständig — Name, Anschrift und Telefonnummer sollten deshalb in jedem Antrag Zeichen für Zeichen gleich sein.`,
      ],
    },
    {
      typ: "tabelle", id: "kosten", h2: "Kostenblöcke beim Markteintritt USA",
      lead: "Was beim Staat, bei der IRS, beim Markenamt und am Markt anfällt — ohne Ihre Betriebskosten wie Personal, Miete und Versicherung.",
      kopf: ["Kostenblock", "Betrag", "Grundlage"],
      zeilen: [
        ["Gründung beim Bundesstaat", `Florida ${STAAT.florida.gruendung}, Delaware ${STAAT.delaware.gruendung}, Wyoming ${STAAT.wyoming.gruendung}`, "Gebührenordnung des Staats"],
        ["Jährliche Staatsgebühr", `Florida ${STAAT.florida.jahr}, Delaware ${STAAT.delaware.jahr} (LLC), Wyoming ${STAAT.wyoming.jahr}`, "Annual Report oder Annual Tax"],
        ["EIN der Gesellschaft", "keine Gebühr", "IRS"],
        ["Registered Agent", MARKT.agent, "veröffentlichte Preise mehrerer Anbieter"],
        ["Jährliche US-Meldung durch einen US-CPA", MARKT.cpa5472, "veröffentlichte Preise mehrerer Anbieter"],
        ["Markenanmeldung beim USPTO", "350 $ je Klasse, elektronisch, dazu mögliche Zuschläge", "37 CFR 2.6, zuzüglich Honorar des US-Anwalts"],
        ["Versäumte Form 5472", IRS.strafe5472, "Strafe der IRS"],
        ["Honorar von FIAON Global", `${B.honorarAuftrag} mit Ihrem Auftrag. Mit der Eintragung das Erfolgshonorar nach Ihrem Kapitalrahmen, mindestens ${B.erfolgMin}. Ab dem zweiten Jahr auf Wunsch ${B.jahresbetreuung} im Jahr.`, beleg("honorarVorab")],
      ],
      fuss: [
        "Staatsgebühren nach den amtlichen Gebührenordnungen, Stand September 2026; Delaware: Jahressteuer der LLC ab dem Steuerjahr 2026. Marktspannen sind veröffentlichte Preise mehrerer Anbieter im September 2026, keine amtlichen Werte.",
        "Nicht enthalten: Betriebskosten Ihrer US-Gesellschaft wie Lohnbuchhaltung, Versicherungen, Miete und Registrierungen für die Sales Tax.",
      ],
    },
    {
      typ: "text", id: "steuern", h2: "Steuern und Meldungen in beiden Ländern",
      absaetze: [
        `In den USA: Eine LLC, die ganz einer ausländischen Person gehört, und jede US-Corporation, an der eine ausländische Person mindestens 25 Prozent hält, melden ihre Geschäfte mit nahestehenden Personen jährlich auf Form 5472 — die LLC mit einer Pro-forma-Form 1120, auch im Jahr ohne Umsatz; schon Zahlungen des Inhabers zur Gründung zählen dazu. Fällig ist sie bei Kalenderjahr am ${IRS.frist5472}. Die Strafe für eine versäumte Meldung beträgt ${IRS.strafe5472} (IRS, Stand ${FAKTEN_STAND}).`,
        "Für viele neu ist die Meldung an die US-Statistikbehörde BEA (Bureau of Economic Analysis). Gründet oder erwirbt eine ausländische Person ein US-Unternehmen und hält daran mindestens 10 Prozent der Stimmrechte, ist die Meldung BE-13 Pflicht — auch dann, wenn die Behörde sich nie meldet, spätestens 45 Kalendertage nach Gründung oder Erwerb (15 CFR 801.7). Die ausführliche Meldung verlangt die BEA erst bei Kosten von mehr als 40 Mio. $; bei höchstens 40 Mio. $ genügt die kurze Freistellungserklärung (BE-13 Claim for Exemption). Die BOI-Meldung bei FinCEN dagegen entfällt für in den USA gegründete Gesellschaften seit August 2026 endgültig; manche Checklisten nennen sie noch als Pflicht.",
        "Verkaufen Sie an US-Kunden, kommt die Umsatzsteuer der Bundesstaaten hinzu, die Sales Tax. Seit der Entscheidung South Dakota v. Wayfair des Supreme Court vom 21. Juni 2018 dürfen Staaten sie auch von Händlern ohne Präsenz vor Ort verlangen. Florida etwa verpflichtet Händler zur Erhebung, deren steuerpflichtige Fernverkäufe nach Florida im vorigen Kalenderjahr zusammen 100.000 $ überschritten haben (§ 212.0596 Florida Statutes). Jeder Staat setzt eigene Schwellen.",
        "Zu Hause: Die Gründung oder der Erwerb einer Beteiligung an einer ausländischen Gesellschaft ist dem Finanzamt mitzuteilen (§ 138 Abs. 2 AO) — zusammen mit der Steuererklärung für das Jahr der Gründung, spätestens 14 Monate nach dessen Ablauf (§ 138 Abs. 5 AO). Bei einer Kapitalgesellschaft gilt das ab 10 Prozent Beteiligung oder ab Anschaffungskosten von mehr als 150.000 €; wird die US-Gesellschaft als Personengesellschaft eingeordnet, gilt keine Schwelle. Welcher Staat welche Gewinne besteuert, regelt das Doppelbesteuerungsabkommen zwischen Deutschland und den USA. Liefert die eigene GmbH Waren, Software oder Leistungen an die Tochter, müssen die Preise einem Fremdvergleich standhalten (§ 1 AStG). Österreich und die Schweiz haben eigene Regeln. " + STEUERFRAGEN,
      ],
    },
    {
      typ: "text", id: "personal", h2: "Verträge, Marke und Personal: die Grundzüge",
      absaetze: [
        "Mit der US-Gesellschaft schließen Sie Verträge nach US-Recht: mit Kunden, Lieferanten, Vermietern und Vertriebspartnern, und mit der eigenen GmbH, wenn sie an die Tochter liefert. Die Geschäfte zwischen Mutter und Tochter gehören zudem auf Form 5472. Diese Verträge entwirft ein US-Anwalt.",
        "Ihre Marke schützt erst die Eintragung beim US-Patent- und Markenamt (USPTO); der eingetragene Name einer Gesellschaft ist noch keine Marke. Wer Wohnsitz oder Sitz außerhalb der USA hat, muss sich bei der Anmeldung von einem Anwalt vertreten lassen, der vor dem USPTO zugelassen ist (37 CFR 2.11). Die Grundgebühr beträgt 350 $ je Klasse bei elektronischer Anmeldung (37 CFR 2.6). Den Namen prüfen Sie deshalb vor der Gründung, nicht nach dem Start.",
        "Wer in den USA Mitarbeiter einstellt, wird dort Arbeitgeber. Für jede Einstellung sind Identität und Arbeitserlaubnis mit Form I-9 zu prüfen (USCIS). Die Gesellschaft behält Lohnsteuer ein, führt sie mit den Beiträgen zu Social Security und Medicare ab, meldet in der Regel vierteljährlich mit Form 941 und stellt jedem Mitarbeiter Form W-2 aus (IRS Publication 15). Lohnbuchhaltung und Arbeitsrecht gehören in die Hand eines Lohnbüros und eines Anwalts für Arbeitsrecht in den USA.",
        "Für Gespräche, Messen und Termine reisen Staatsangehörige der Teilnehmerländer im Visa Waiver Program für geschäftliche Aufenthalte von höchstens 90 Tagen ohne Visum ein; ob sie so reisen dürfen, prüft vorab das elektronische System ESTA (CBP). Wer die US-Gesellschaft dauerhaft vor Ort führen will, braucht ein Visum. Für Investoren aus Vertragsstaaten kommt das E-2-Visum in Betracht; es setzt eine erhebliche Investition in ein echtes Unternehmen voraus — getätigt oder im Gange —, das der Investor aufbaut und lenkt (USCIS). Über jedes Visum entscheidet die US-Behörde. Ob es in Ihrem Fall in Betracht kommt, ist eine Rechtsfrage; sie liegt bei Partner-Anwälten für Einwanderungsrecht in eigener Verantwortung.",
      ],
    },
    {
      typ: "text", id: "kapital", h2: "Finanzierung in Schritten: die Wege einer jungen US-Gesellschaft",
      absaetze: [
        "Eine neue US-Gesellschaft hat keine Kredithistorie. Deshalb kommen die Finanzierungswege nacheinander in Betracht: Firmenkarten, deren Rahmen sich häufig am Kontoguthaben orientiert, Lieferantenkonten mit Zahlungsziel und die Kennziffer der Gesellschaft bei der Wirtschaftsauskunftei (D-U-N-S-Nummer), dann Kredite von Zahlungsplattformen nach Umsatz, später ein Kredit der Bank, etwa gestützt auf Sicherheiten der Muttergesellschaft. Persönliche US-Karten richten sich dagegen nach Ihrer persönlichen US-Kreditgeschichte, nicht nach der Gesellschaft.",
        "Staatlich gestützte Kleinunternehmerkredite der SBA (Programme 7(a) und 504) setzen seit dem 1. März 2026 voraus, dass alle direkten und indirekten Eigentümer US-Staatsbürger oder US-Staatsangehörige mit Hauptwohnsitz in den USA sind; Inhaber einer Green Card zählen nicht dazu (GAO B-338157). Eine Gesellschaft, an der Inhaber ohne US-Staatsangehörigkeit beteiligt sind, ist von diesen Programmen damit ausgeschlossen.",
        KAPITAL_FREI,
        `${satz("S9")} ${satz("S1")}`,
      ],
    },
    {
      typ: "karten", id: "fehler", h2: "Typische Fehler bei der Expansion in die USA", spalten: 3,
      lead: "Sechs Fehler, die sich vor der Gründung vermeiden lassen.",
      karten: [
        { tag: "Steuern", titel: "Die Geschäftsleitung vergessen", text: "Die US-Gesellschaft wird aus Europa gelenkt und trotzdem als rein amerikanisch behandelt. Der Ort der Geschäftsleitung entscheidet mit über die Steuerpflicht zu Hause." },
        { tag: "Bundesstaat", titel: "Gründen, wo man nicht arbeitet", text: "Gegründet in Delaware, tätig in Florida: Dann braucht die Gesellschaft auch die Zulassung in Florida, mit zweitem Registered Agent und zweiter Jahresmeldung." },
        { tag: "US-Meldung", titel: "Form 5472 ohne Umsatz übersehen", text: `Die Pflicht gilt auch im Jahr ohne Umsatz; schon Zahlungen des Inhabers zur Gründung zählen. Die Strafe der IRS für eine versäumte Meldung: ${IRS.strafe5472}.` },
        { tag: "Statistik", titel: "BE-13 nicht kennen", text: "Die Meldung an die BEA ist Pflicht, auch wenn die Behörde nie schreibt. Bei Kosten von höchstens 40 Mio. $ genügt die kurze Freistellungserklärung." },
        { tag: "Marke", titel: "Den Namen nicht prüfen", text: "Ein eingetragener Firmenname ist noch keine Marke. Kollidiert er mit einer US-Marke, kann nach dem Start eine Umbenennung nötig werden." },
        { tag: "Finanzierung", titel: "Kredite vor Umsatz einplanen", text: "Wer Kredite einplant, bevor die Gesellschaft Geschichte und Umsatz hat, rechnet mit Geld, über das noch kein Institut entschieden hat." },
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
        "Konto-, Karten- und Finanzierungsanträge vollständig vorbereitet",
        "Ein fester Ansprechpartner für Post, Anrufe und Termine Ihrer Gesellschaft",
      ],
      partner: [
        "Partner-Anwälte: Rechtsfragen, in eigener Verantwortung",
        "US-Steuerberater (CPA) aus unserem Partnernetz: die erste jährliche US-Meldung (Form 5472 mit Form 1120)",
        "Partner-Steuerberater im Wohnsitzland: Steuerfragen, in eigener Verantwortung",
      ],
      sie: [
        "Ziel und Zahlen Ihres US-Geschäfts festlegen",
        "Reisepass hochladen und die vorgelegten Unterlagen unterzeichnen; bei einer Tochter der Registerauszug der Muttergesellschaft",
        "Konto-, Karten- und Finanzierungsanträge selbst stellen — es entscheidet das jeweilige Institut",
        "Verträge mit Kunden, Lieferanten und Mitarbeitern schließen",
        "Die Steuererklärung zu Hause mit Ihrem Steuerberater",
      ],
    },
    {
      typ: "text", id: "fiaon", h2: "Was FIAON Global dabei übernimmt",
      absaetze: [
        "Ihr Mandat sieht die Gründung einer LLC vor. Soll Ihre GmbH die Anteile halten oder kommt für Ihr Vorhaben eine Corporation in Betracht, stimmen wir das vorab im Gespräch mit Ihnen ab.",
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
      typ: "karten", id: "vertiefung", h2: "Jeder Schritt im Detail", spalten: 3,
      karten: [
        { tag: "Struktur", titel: "Die Tochter in den USA", text: "Wenn Ihre GmbH, AG oder Holding Gesellschafterin wird: Ablauf und Unterlagen.", pfad: "/business/tochtergesellschaft-usa" },
        { tag: "Gründung", titel: "US-Firmengründung", text: "Anmeldung beim Bundesstaat, Unterlagen und Anträge für EIN und ITIN in einem Mandat.", pfad: "/business/us-firmengruendung" },
        { tag: "Bundesstaat", titel: "Welcher Bundesstaat?", text: "Delaware, Florida oder Wyoming: Zeiten, Kosten, Vor- und Nachteile.", pfad: "/business/wissen/bundesstaat-waehlen" },
        { tag: "Konto", titel: "Das US-Geschäftskonto", text: "Welche Unterlagen Institute verlangen und wie der Antrag entsteht.", pfad: "/business/us-geschaeftskonto" },
        { tag: "Pflichten", titel: "Ihre US-Pflichten", text: "Form 5472, Staatsgebühr, Registered Agent und die Meldung zu Hause im Kalender.", pfad: "/business/us-pflichten" },
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
        "Nicht enthalten sind: Visa, Lohnbuchhaltung, Verrechnungspreise, Registrierungen für die Sales Tax und Markenanmeldungen.",
        `FIAON vergibt und vermittelt keine Kredite. ${satz("S1")}`,
      ],
    },
  ],
  fragen: [
    { f: "Was kostet ein Markteintritt in den USA?", a: `Beim Bundesstaat kostet die Gründung in Florida ${STAAT.florida.gruendung}, in Delaware ${STAAT.delaware.gruendung}, in Wyoming ${STAAT.wyoming.gruendung}; dazu kommen jährlich Staatsgebühr, Registered Agent und die US-Meldung durch einen US-Steuerberater (CPA). Die großen Posten sind Ihre Betriebskosten — Personal, Miete, Versicherung — und die Mittel für die ersten Monate. Zum Honorar von FIAON Global: ${P.preisSatzKurz}` },
    { f: "Brauche ich für die US-Expansion eine eigene Gesellschaft?", a: "Nicht zwingend. Ihre GmbH kann als Zweigniederlassung tätig werden, haftet dann aber voll für das US-Geschäft. Eine eigene LLC oder Corporation trennt die Haftung vom Stammhaus und tritt Ihren US-Kunden als Vertragspartner vor Ort gegenüber. Was passt, hängt davon ab, was in den USA geschehen soll — das gehört vor der Gründung geklärt, mit Ihrem Steuerberater und einem US-Steuerberater (CPA)." },
    { f: "Ist eine US-Tochter in Deutschland steuerpflichtig?", a: "Sie kann es sein. Wird sie tatsächlich aus Deutschland geleitet, liegt ihre Geschäftsleitung im Inland (§ 10 AO); eine Corporation ist dann hier unbeschränkt körperschaftsteuerpflichtig (§ 1 KStG), bei einer LLC hängt die Besteuerung von ihrer Einordnung ab. Die Beteiligung ist dem Finanzamt nach § 138 AO mitzuteilen. Wie das Doppelbesteuerungsabkommen in Ihrem Fall greift, klären Partner-Steuerberater in eigener Verantwortung." },
    { f: "Was ist die BE-13-Meldung?", a: "Eine Pflichtmeldung an die US-Statistikbehörde BEA. Gründet oder erwirbt eine ausländische Person ein US-Unternehmen und hält daran mindestens 10 Prozent der Stimmrechte, ist sie spätestens 45 Kalendertage danach fällig, auch ohne Aufforderung (15 CFR 801.7). Bei Kosten von höchstens 40 Mio. $ genügt die kurze Freistellungserklärung." },
    { f: "Brauche ich ein Visum, um meine US-Gesellschaft zu führen?", a: "Für Gespräche und Termine reisen Staatsangehörige der Teilnehmerländer im Visa Waiver Program mit ESTA-Genehmigung für geschäftliche Aufenthalte von höchstens 90 Tagen ohne Visum ein. Wer die Gesellschaft dauerhaft vor Ort führen will, braucht ein Visum; für Investoren aus Vertragsstaaten kommt das E-2-Visum in Betracht. Über jedes Visum entscheidet die US-Behörde; Rechtsfragen dazu liegen bei Partner-Anwälten für Einwanderungsrecht in eigener Verantwortung. Visa sind in Ihrem Vertrag mit FIAON nicht enthalten." },
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
