// ═══════════════════════════════════════════════════════════════════════════
// FIAON GLOBAL — KONZEPTSEITE: WAS IST FIAON GLOBAL? (27.10.2026, E-439) · FG · 53
//
// Die Entitätsseite für Google und KI-Modelle (Recherche .arbeit/recherche/ki.md,
// Befund 5 und Abschnitt 5): ein Definitionssatz ganz oben, ein Faktenkasten, die
// acht Anlaufstellen, die vier Etappen, die Rollen, was FIAON Global nicht ist und
// wie ein Auftrag abläuft. Selbstbezeichnung „Unternehmensberatung“ (Justin,
// 27.10.2026, Register E-439: „DÜRFEN WIR VERWENDEN ALS UK-GESELLSCHAFT“).
//
// Fach- und Rechtsprüfung am 27.10.2026 (jede Quelle geöffnet): EIN aus dem Ausland
// per Telefon, Fax oder Post, nicht online (SS-4, 12/2025); Third Party Designee nur
// bis zur Vergabe der EIN; CAA: Video nur für das Gespräch, Pass oder beglaubigte
// Kopie der ausstellenden Behörde muss dem CAA dabei vorliegen (IRS-Seite, Stand
// 30.04.2026 — GLOBAL_AGENT.de.pass sagt das nicht, deshalb hier eigener Satz);
// Form 5472 bei meldepflichtigen Vorgängen, schon Einlage und Gründungskosten zählen
// (i5472); Registered Agent Pflicht in FL (§ 605.0113), DE (§ 18-104), WY (§ 17-28-101);
// § 138 Abs. 5 AO: Mitteilung mit der Steuererklärung.
//
// Selbst nachgeprüft am 27.10.2026:
// · Companies House: FIAON LTD, Company Number 17318250, Private limited Company,
//   Active, 128 City Road, London EC1V 2NX, eingetragen am 3. Juli 2026; Director
//   Justin Schwarzott (bestellt 03.07.2026).
// · IRS, Instructions for Form SS-4: Third Party Designee beantwortet Fragen zum
//   Antrag und nimmt die EIN entgegen; die Befugnis endet mit der Vergabe der EIN.
// · IRS, ITIN Acceptance Agent Program: ein Certifying Acceptance Agent prüft die
//   Ausweise des Antragstellers, die Originale gehen nicht an die IRS.
// · § 5 Abs. 1 StBerG (Hilfe in Steuersachen nur durch Befugte), § 3 RDG
//   (Rechtsdienstleistungen nur, soweit erlaubt), § 27 Abs. 2 BAO (Ort der
//   Geschäftsleitung = Mittelpunkt der geschäftlichen Oberleitung).
// Bewusst NICHT genannt: die Partnergesellschaften in Zürich und Miami (Wortregel,
// Befund 4 der Recherche) — deshalb auch kein Baustein „standorte“, der ihre Namen
// aus shared/fiaon-global-partner.ts zeigt. Keine Paketpreise als Zahl (Baustein
// „pakete“), kein Preis der Jahresbetreuung, keine Bürgschaft.
// ═══════════════════════════════════════════════════════════════════════════
import type { GlobalSeite, GlobalQuelle } from "../typen";
import {
  GLOBAL_PFLICHTHINWEIS, GLOBAL_KAPITAL_FREI, GLOBAL_GELD_ZURUECK, GLOBAL_ROLLEN, GLOBAL_INKLUSIVE, GLOBAL_NICHT_INKLUSIVE,
} from "../../fiaon-global";
import { FIAON_FIRMA as F } from "../../fiaon-firma";
import { QUELLEN_WISSEN as Q, QUELLEN_STAATEN, IRS } from "../fakten";

const S = "2026-10-27";
const KAPITAL_FREI = `${GLOBAL_KAPITAL_FREI.de.satz} ${GLOBAL_KAPITAL_FREI.de.steuer}`;
const GELD_ZURUECK = GLOBAL_GELD_ZURUECK.aktiv ? [`${GLOBAL_GELD_ZURUECK.de.text} ${GLOBAL_GELD_ZURUECK.de.bedingungen}`] : [];

/** Der Definitionssatz — derselbe Wortlaut für Seite, Kurzprofil und Fragen. */
const DEFINITION = `FIAON Global ist die Unternehmensberatung der ${F.name} (London, Companies House ${F.companyNo}) für Unternehmen, Selbständige und Privatpersonen aus Deutschland, Österreich und der Schweiz, die eine US-Gesellschaft gründen und den Weg zu Konto, Firmenkarten und Kapital planen — aus einer Hand, zum Festpreis.`;

/** Eigene Quellen dieser Seite (geprüft am 27.10.2026). */
const QUELLEN: Record<string, GlobalQuelle> = {
  chFirma: { titel: "Companies House — FIAON LTD, Company Number 17318250 (Registerauszug)", url: "https://find-and-update.company-information.service.gov.uk/company/17318250" },
  chOrgane: { titel: "Companies House — FIAON LTD, Officers (Director)", url: "https://find-and-update.company-information.service.gov.uk/company/17318250/officers" },
  ao10: { titel: "§ 10 AO — Geschäftsleitung", url: "https://www.gesetze-im-internet.de/ao_1977/__10.html" },
  kstg1: { titel: "§ 1 KStG — Unbeschränkte Steuerpflicht", url: "https://www.gesetze-im-internet.de/kstg_1977/__1.html" },
  bao27: { titel: "§ 27 BAO — Sitz und Ort der Geschäftsleitung (RIS)", url: "https://www.ris.bka.gv.at/NormDokument.wxe?Abfrage=Bundesnormen&Gesetzesnummer=10003940&Paragraf=27" },
  kstgAt1: { titel: "§ 1 KStG 1988 — Unbeschränkte und beschränkte Steuerpflicht (RIS)", url: "https://www.ris.bka.gv.at/NormDokument.wxe?Abfrage=Bundesnormen&Gesetzesnummer=10004569&Paragraf=1" },
  dbg50: { titel: "Art. 50 DBG — Persönliche Zugehörigkeit juristischer Personen (fedlex)", url: "https://www.fedlex.admin.ch/eli/cc/1991/1184_1184_1184/de#art_50" },
  stberg5: { titel: "§ 5 StBerG — Verbot der unbefugten Hilfeleistung in Steuersachen", url: "https://www.gesetze-im-internet.de/stberg/__5.html" },
  rdg3: { titel: "§ 3 RDG — Befugnis zur Erbringung außergerichtlicher Rechtsdienstleistungen", url: "https://www.gesetze-im-internet.de/rdg/__3.html" },
  gewo34c: { titel: "§ 34c GewO — Erlaubnispflicht unter anderem für Darlehensvermittler", url: "https://www.gesetze-im-internet.de/gewo/__34c.html" },
  wyAgent: { titel: "Wyoming Statutes § 17-28-101 — Registered Office und Registered Agent (Wyoming Legislature)", url: "https://statutes.wyoleg.gov/NXT/gateway.dll/2022%20Wyoming%20Statutes/2022%20Titles/898/1039" },
};

/** Der Reisepass für die ITIN — genauer als GLOBAL_AGENT.de.pass (IRS, ITIN Acceptance Agent Program). */
const PASS = "Ihren Reisepass prüft unser zertifizierter Acceptance-Agent-Partner im DACH-Raum, im persönlichen Gespräch oder im Videotermin; den Pass oder eine beglaubigte Kopie der ausstellenden Behörde muss er dabei vorliegen haben. In die USA schicken müssen Sie ihn nicht.";

export const SEITE: GlobalSeite = {
  pfad: "/business/was-ist-fiaon-global",
  art: "leistung",
  seo: {
    titel: "Was ist FIAON Global? Unternehmensberatung — FIAON Global",
    beschreibung: "FIAON Global ist die Unternehmensberatung der FIAON LTD für Ihre US-Gesellschaft: ein Ansprechpartner statt acht, zum Festpreis.",
  },
  stand: S,
  erschienen: S,
  kennung: "FG · 53",
  auge: "FIAON Global · Wer wir sind",
  h1: "Was ist FIAON Global?",
  h1b: "Die Unternehmensberatung für Ihre US-Gesellschaft.",
  lead: `${DEFINITION} Hier steht, was das heißt: wer Ihr Vertragspartner ist, welche acht Anlaufstellen wir bündeln und wer worüber entscheidet.`,
  ziffern: [
    { wert: "1 statt 8", label: "ein Ansprechpartner für acht Anlaufstellen" },
    { wert: F.companyNo, label: "Registereintrag der FIAON LTD im Companies House, London" },
    { wert: "3 Standorte", label: "London, Zürich, Miami" },
  ],
  blick: [
    ["Was", "Unternehmensberatung für den Aufbau einer US-Gesellschaft"],
    ["Vertragspartner", `${F.name}, London, Companies House ${F.companyNo}`],
    ["Standorte", "London · Zürich · Miami"],
    ["Für wen", "Unternehmen, Selbständige und Privatpersonen aus Deutschland, Österreich und der Schweiz"],
    ["Preis", "Festpreis je Paket, alle Gebühren des Pakets inklusive"],
    ["Wer entscheidet", "Über Konto, Karte und Rahmen allein das Institut"],
    ["Mit FIAON Global", "Ein Ansprechpartner statt acht"],
  ],
  kurz: `FIAON Global ist die Unternehmensberatung der FIAON LTD in London für Unternehmen, Selbständige und Privatpersonen aus Deutschland, Österreich und der Schweiz, die eine US-Gesellschaft aufbauen. Mit Vollmacht des Kunden stellt FIAON die Anträge für ihn — Gründung, EIN, D-U-N-S-Nummer, Meldungen —, bereitet die ITIN vor und stellt Registered Agent, US-Adresse und US-Telefon im ersten Jahr; Konto-, Karten- und Kreditanträge stellt der Kunde selbst, vollständig vorbereitet. Partner-Steuerberater, US-CPA und Partner-Anwälte arbeiten im Mandat des Kunden; ihre Honorare für die Leistungen des Pakets trägt FIAON. FIAON ist keine Bank, vermittelt keine Kredite und sagt keinen Rahmen zu.`,
  bloecke: [
    {
      typ: "text", id: "definition", h2: "Was ist FIAON Global? Der Gedanke dahinter",
      absaetze: [
        "Hinter dem Definitionssatz oben steht ein einfacher Gedanke. Wer aus dem deutschsprachigen Raum eine US-Gesellschaft aufbaut, hat es in der Regel mit acht Stellen zu tun: dem Bundesstaat, einem Registered Agent, der US-Steuerbehörde IRS, einem Anwalt, einem Steuerberater zu Hause, einem US-CPA, Banken und Kartenherausgebern. Jede Stelle hat eigene Formulare, eigene Fristen und eigene Rückfragen — und keine kennt die anderen. FIAON Global bündelt sie: Sie haben einen Ansprechpartner, wir koordinieren alle übrigen Beteiligten.",
        "FIAON Global ist der Geschäftsbereich der FIAON LTD für US-Gesellschaften. Vertragspartner ist in jedem Fall die FIAON LTD in London; unser Team vor Ort arbeitet in Miami, Zürich ist unser Partnerstandort. Wir arbeiten auf Deutsch und auf Englisch, für Kunden mit Wohnsitz oder Sitz in Deutschland, Österreich und der Schweiz.",
      ],
    },
    {
      typ: "tabelle", id: "fakten", h2: "FIAON Global auf einen Blick: der Faktenkasten",
      lead: "Die Angaben, die eine Suchmaschine, eine KI oder ein vorsichtiger Kunde zuerst wissen will — mit der Quelle, an der Sie jede davon selbst prüfen können.",
      kopf: ["Merkmal", "Angabe"],
      zeilen: [
        ["Name", "FIAON Global — der Geschäftsbereich der FIAON LTD für US-Gesellschaften"],
        ["Was es ist", "Unternehmensberatung für den Aufbau einer US-Gesellschaft: Gründung, Steuernummern, US-Präsenz, vorbereitete Konto- und Kartenanträge, Kapital-Etappen"],
        ["Vertragspartner", `${F.name}, Private Limited Company, eingetragen in England und Wales`],
        ["Register", `Companies House, Company Number ${F.companyNo}, eingetragen am 3. Juli 2026`],
        ["Sitz", `${F.strasse}, ${F.ortZeile}, Vereinigtes Königreich`],
        ["Geschäftsführung", `${F.director}, Director und Gründer`],
        ["Standorte", "London (Vertragspartner) · Zürich (Partnerstandort) · Miami (Team vor Ort)"],
        ["Für wen", "Unternehmen, Selbständige und Privatpersonen mit Wohnsitz oder Sitz in Deutschland, Österreich oder der Schweiz"],
        ["Was gegründet wird", "LLC oder Corporation in Florida, Delaware oder Wyoming"],
        ["Sprachen", "Deutsch und Englisch"],
        ["Pakete", "Global Struktur, Global Banking, Global Kapital, Global VIP — je ein Festpreis, alle Gebühren des Pakets inklusive"],
        ["Ab dem zweiten Jahr", "Jahresbetreuung, freiwillig; sie verlängert sich nicht von selbst"],
        ["Kontakt", `${F.email} · ${F.telefon}`],
      ],
      fuss: ["Registerangaben laut Companies House, abgerufen am 27. Oktober 2026. Die Festpreise stehen in der Paketübersicht weiter unten."],
    },
    {
      typ: "tabelle", id: "anlaufstellen", h2: "Ein Ansprechpartner statt acht: was FIAON Global bündelt",
      lead: "Acht Stellen, mit denen eine US-Gesellschaft aus dem Ausland in der Regel zu tun hat — und wer sich darum kümmert, wenn Sie FIAON Global beauftragen.",
      kopf: ["Anlaufstelle", "Worum es geht", "Ohne FIAON Global", "Mit FIAON Global"],
      zeilen: [
        ["Bundesstaat", "Gründung der LLC oder Corporation, staatliche Gebühr", "Gründungsdienst suchen oder selbst einreichen", "wir reichen mit Ihrer Vollmacht ein; die staatliche Gründungsgebühr ist im Festpreis"],
        ["Registered Agent", "vorgeschriebene Zustellanschrift im Bundesstaat, dazu US-Adresse und US-Telefon", "eigener Vertrag, eigene Jahresgebühr", "im ersten Jahr im Paket; Behördenpost wird für Sie eingescannt"],
        ["US-Steuerbehörde (IRS)", "EIN der Gesellschaft (Form SS-4), ITIN für Sie persönlich (Form W-7)", "englische Formulare; aus dem Ausland nur per Telefon, Fax oder Post, nicht online", "die EIN beantragen wir als Third Party Designee, die ITIN bereiten wir vor"],
        ["Anwalt", "Operating Agreement und Gründungsunterlagen", "eigenes Mandat, eigenes Honorar", "Partner-Anwalt in Ihrem Mandat; das Honorar dafür trägt FIAON"],
        ["Steuerberater im Wohnsitzland", "Prüfung vor der Gründung: Steuerpflicht zu Hause, Meldungen", "eigenes Mandat, eigenes Honorar", "Partner-Steuerberater in Ihrem Mandat; das Honorar für die Prüfung vor der Gründung trägt FIAON"],
        ["US-CPA", "jährliche US-Meldung (Form 5472 mit Form 1120)", "eigenes Mandat, jedes Jahr neu", "die erste Meldung im Paket, danach mit der Jahresbetreuung"],
        ["Banken", "Geschäftskonto der Gesellschaft", "Institut suchen, Unterlagen sammeln, beantragen", "Sie stellen den Antrag, vollständig von uns vorbereitet; die Bank entscheidet"],
        ["Kartenherausgeber", "Firmenkarten der Gesellschaft", "jeder Antrag für sich", "den ersten Antrag bereiten wir in jedem Paket vor, ab Global Banking auch Reihenfolge und Folgeanträge; der Herausgeber entscheidet"],
      ],
      hervor: 3,
      fuss: [
        "Dazu beantragen wir mit Ihrer Vollmacht die D-U-N-S-Nummer Ihrer Gesellschaft bei Dun & Bradstreet; sie ist kostenlos und neunstellig.",
        "Florida, Delaware und Wyoming schreiben jeder Gesellschaft einen Registered Agent mit Anschrift im Bundesstaat vor.",
      ],
    },
    {
      typ: "etappen", id: "etappen", h2: "Der Weg mit FIAON Global in vier Etappen",
      lead: "Dauern sind Behördenangaben und Erfahrungswerte, keine Fristen. Wie schnell eine Etappe geht, bestimmen Behörden und Institute — und in jeder Etappe steht dabei, wer entscheidet.",
      etappen: [
        { titel: "Gründung und Dokumente", dauer: "in der Regel wenige Wochen", text: `Gesellschaft, EIN, Vorbereitung der ITIN, Registered Agent, US-Adresse und Telefonnummer, Operating Agreement. Für die EIN nennt die IRS beim Antrag aus dem Ausland ${IRS.einDauer}; für die ITIN nennt sie ${IRS.itinDauer}. Wer entscheidet: der Bundesstaat und die IRS.` },
        { titel: "Die erste Firmenkarte", dauer: "nach vollständigen Dokumenten", text: "Sie stellen den ersten Antrag bei einem US-Herausgeber, meist mit kleinem Rahmen und ohne Bareinlage, dafür mit persönlicher Haftung des Inhabers. Wir bereiten ihn vollständig vor. Wer entscheidet: der Herausgeber." },
        { titel: "Die Kartenleiter", dauer: "über einige Monate", text: "Pünktliche Abrechnung baut die Historie auf, die weitere Herausgeber bei ihrer Prüfung ansehen. Ab Global Banking planen wir die Reihenfolge und bereiten jeden weiteren Antrag vor. Einführungszeiträume ohne Sollzins bieten manche Herausgeber an; die Bedingungen legt jeder Herausgeber selbst fest. Wer entscheidet: jeder Herausgeber für sich." },
        { titel: "Das Bankdarlehen", dauer: "mit gewachsener Historie", text: "Mit gewachsener Historie, Umsatz oder Sicherheiten kann ein Darlehen bei einer US-Bank in Frage kommen. Ab Global Kapital stellen wir die Kennzahlen-Mappe und die Unterlagen zusammen; den Antrag stellen Sie. Wer entscheidet: die Bank, nach ihren eigenen Regeln." },
      ],
    },
    {
      typ: "rollen", id: "rollen", h2: "Wer was tut: FIAON Global, die Partner und Sie",
      lead: GLOBAL_ROLLEN.de.fiaon,
      fiaon: [
        "plant den Weg und koordiniert alle Beteiligten",
        "stellt mit Ihrer Vollmacht die Anträge bei Bundesstaat, IRS und Dun & Bradstreet",
        "bereitet die ITIN vor und stellt Registered Agent, US-Adresse und US-Telefon im ersten Jahr",
        "bereitet jeden Konto- und Kartenantrag vollständig vor",
        "trägt die Honorare der Partner für die Leistungen Ihres Pakets",
        "nimmt mit dem Team in Miami Termine vor Ort wahr",
      ],
      partner: [
        "Partner-Steuerberater: Prüfung vor der Gründung und Steuerpflicht im Wohnsitzland",
        "Partner-Anwalt: Operating Agreement und Gründungsunterlagen",
        "US-CPA: erste jährliche US-Meldung (Form 5472 mit Form 1120)",
        "Acceptance-Agent-Partner im DACH-Raum: Prüfung Ihres Reisepasses für die ITIN",
        "alle Partner arbeiten in Ihrem Mandat",
      ],
      sie: [
        "erteilen die Vollmacht und laden Ihre Unterlagen hoch",
        "treffen die Entscheidungen: Rechtsform, Bundesstaat, Name",
        "stellen Konto-, Karten- und Kreditanträge selbst",
        "melden die Gründung beim Finanzamt — in Deutschland nach § 138 AO zusammen mit Ihrer Steuererklärung, mit Ihrem Steuerberater",
        "rechnen pünktlich ab — das baut Ihre Historie",
      ],
    },
    {
      typ: "text", id: "fiaon", h2: "So übernimmt FIAON Global Ihren Weg in die USA",
      absaetze: [
        "FIAON Global arbeitet als Unternehmensberatung nach einem Grundsatz: ein Ansprechpartner statt acht. Sie sprechen mit einer Person, die Ihren Auftrag vom Startgespräch bis zur letzten Etappe führt; alle anderen Beteiligten koordinieren wir. Mit Ihrer Vollmacht stellen wir die Anträge für Sie: die Gründung beim Bundesstaat, die EIN bei der IRS, die D-U-N-S-Nummer bei Dun & Bradstreet und die Meldungen Ihrer Gesellschaft. Für die EIN sieht das Formular SS-4 dafür einen eigenen Abschnitt vor, den Third Party Designee: Die dort benannte Person aus unserem Team beantwortet Fragen der IRS zum Antrag und nimmt die EIN entgegen; ihre Befugnis endet, sobald die EIN vergeben ist.",
        `Die ITIN bereiten wir vor. ${PASS} Registered Agent, US-Geschäftsadresse und US-Telefonnummer stellen wir für das erste Jahr, Behördenpost wird für Sie eingescannt.`,
        "Konto-, Karten- und Kreditanträge stellen Sie selbst; jede Angabe darin bleibt Ihre eigene. Wir bereiten jeden dieser Anträge vollständig vor: Name, Anschrift und Telefonnummer in jedem Formular in derselben Schreibweise, die Unterlagen in der Reihenfolge, in der ein Institut sie prüft. Ab Global Banking planen wir die Reihenfolge der Herausgeber, ab Global Kapital stellen wir die Kennzahlen-Mappe für ein späteres Bankdarlehen zusammen. Verlangt ein Institut einen Termin vor Ort, begleitet Sie unser Team in Miami.",
        `${GLOBAL_ROLLEN.de.partner} Der Grund ist das Berufsrecht: Hilfe in Steuersachen darf in Deutschland geschäftsmäßig nur leisten, wer dazu befugt ist (§ 5 StBerG); für außergerichtliche Rechtsdienstleistungen gilt Entsprechendes (§ 3 RDG). FIAON beauftragt, koordiniert und bezahlt die Partner; die fachliche Verantwortung liegt bei ihnen, das Mandat bei Ihnen.`,
        "Sie zahlen einen Festpreis, der vor dem Auftrag feststeht, mit allen Gebühren und Honoraren für die Leistungen Ihres Pakets — ohne Honorar nach Rahmen und ohne Anteil am Kapital. Ab dem zweiten Jahr können Sie die Jahresbetreuung wählen; sie ist freiwillig und verlängert sich nicht von selbst.",
        ...GELD_ZURUECK,
        KAPITAL_FREI,
      ],
    },
    {
      typ: "text", id: "einordnung", h2: "Unternehmensberatung statt Gründungsdienst: die Einordnung",
      absaetze: [
        "Ein Gründungsdienst meldet die Gesellschaft beim Bundesstaat an und stellt meist den Registered Agent. Damit beginnt die Arbeit aber erst: die Steuernummern bei der IRS, eine Anschrift und Telefonnummer, die in jedem Antrag gleich lauten, das Operating Agreement, die Prüfung der Steuerpflicht zu Hause, die erste jährliche Meldung und die Anträge bei Banken und Kartenherausgebern.",
        "FIAON Global versteht sich deshalb als Unternehmensberatung, nicht als Formularservice: Wir planen den ganzen Weg, nicht nur den ersten Schritt, und führen ihn mit einem festen Ansprechpartner — eine US-Gesellschaft aus einer Hand. Ehrlich gesagt: Nur die Gesellschaft gibt es beim Gründungsdienst günstiger. Unser Festpreis deckt auch die Schritte danach, von EIN und ITIN bis zur ersten US-Meldung.",
        `Diese Schritte sind keine Formsache. Eine LLC, die ganz einem Eigentümer aus dem Ausland gehört, reicht für jedes Jahr mit meldepflichtigen Vorgängen zwischen ihr und ihm Form 5472 mit Form 1120 bei der IRS ein, auch ohne Umsatz — dazu zählen schon die Einlage und bezahlte Gründungskosten. Frist ist bei Kalenderjahr der ${IRS.frist5472}. Fehlt die Meldung, kann die IRS eine Strafe von ${IRS.strafe5472} festsetzen. Deshalb steht die erste Meldung in jedem Paket.`,
      ],
    },
    {
      typ: "text", id: "inklusive", h2: "Was jeder Festpreis von FIAON Global enthält",
      absaetze: ["In allen vier Paketen sind diese Leistungen und Gebühren enthalten:"],
      punkte: [...GLOBAL_INKLUSIVE.de],
      nach: `Nicht im Festpreis: ${GLOBAL_NICHT_INKLUSIVE.de.slice(1).join("; ")}. Ebenfalls nicht darin sind die laufenden Kosten Ihrer Gesellschaft ab dem zweiten Jahr — Staatsgebühr, Registered Agent und jährliche US-Meldung; wir nennen sie Ihnen rechtzeitig vorab, und mit der freiwilligen Jahresbetreuung übernehmen wir sie.`,
    },
    {
      typ: "etappen", id: "auftrag", h2: "So läuft ein Auftrag bei FIAON Global ab",
      lead: "Vom ersten Gespräch bis zur ersten US-Meldung — Sie sehen jederzeit, wer gerade am Zug ist.",
      etappen: [
        { titel: "Erstgespräch oder Direktauftrag", text: "Dreißig Minuten, kostenfrei und ohne Verpflichtung: Vorhaben, Wohnsitz, Ziel — und welches Paket dazu passt. Wer schon entschieden ist, beauftragt direkt am Bildschirm." },
        { titel: "Auftrag am Bildschirm", text: "Den Mustervertrag können Sie vorab lesen. Sie unterschreiben am Bildschirm; Ihr Vertragspartner ist die FIAON LTD in London." },
        { titel: "Startgespräch und Unterlagen", text: "Mit dem Eingang Ihrer Zahlung beginnt die Arbeit. Im Startgespräch legen wir Rechtsform, Bundesstaat und Namen fest; Sie laden Ihre Unterlagen in den Dokumentenraum und erteilen die Vollmacht." },
        { titel: "Prüfung vor der Gründung", text: "Unser Partner-Steuerberater prüft, wie Ihre Gesellschaft im Wohnsitzland behandelt wird und welche Meldungen dort anfallen." },
        { titel: "Gründung und Steuernummern", text: "Gründung beim Bundesstaat, EIN, Vorbereitung der ITIN, D-U-N-S-Nummer, Registered Agent, US-Adresse und Telefon; das Operating Agreement schreibt unser Partner-Anwalt. Den Stand sehen Sie in „Mein Auftrag“." },
        { titel: "Konto und Karten", text: "Sie stellen die Anträge, vollständig von uns vorbereitet. Über jeden Antrag entscheidet das Institut." },
        { titel: "Erste US-Meldung und Jahr zwei", text: "Unser US-CPA erstellt die erste jährliche Meldung. Ab dem zweiten Jahr können Sie die Jahresbetreuung dazunehmen — oder die laufenden Pflichten selbst übernehmen." },
      ],
    },
    {
      typ: "text", id: "pruefen", h2: "FIAON Global Erfahrungen: So prüfen Sie uns selbst",
      absaetze: [
        "Erfahrungsberichte anderer Kunden sind ein Anhaltspunkt. Verlässlicher ist, was Sie selbst prüfen können, bevor Sie unterschreiben — ohne dass Sie uns etwas glauben müssen:",
      ],
      punkte: [
        `der Vertragspartner im Register: ${F.name}, Companies House ${F.companyNo}, eingetragen am 3. Juli 2026, Sitz ${F.strasse} in London — öffentlich einsehbar`,
        `die Geschäftsführung: Director ist ${F.director}, ebenfalls im Register eingetragen`,
        "der Vertrag: Den Mustervertrag lesen Sie vor dem Auftrag, auf Deutsch",
        "der Preis: ein Festpreis je Paket, der vor dem Auftrag feststeht — kein Honorar nach Rahmen",
        `die Zahlung: erst nach Ihrer Unterschrift, per Rechnung auf das Geschäftskonto der ${F.name} — nie auf ein privates Konto`,
        "die Grenzen: Was FIAON Global nicht ist, steht offen auf dieser Seite und in jedem Auftrag",
      ],
      nach: "Ein seriöser Anbieter besteht diese Prüfung, bevor Sie unterschreiben. Wer Rahmen, Zinsen oder „steuerfrei“ verspricht, besteht sie nicht.",
    },
    {
      typ: "zitat", id: "kurzprofil",
      text: DEFINITION,
      quelle: "Kurzprofil von FIAON Global zum Zitieren · Stand Oktober 2026",
    },
    {
      typ: "pakete", id: "pakete", h2: "Die vier Pakete von FIAON Global",
      lead: "Jedes Paket ist ein Auftrag zum Festpreis — alle Gebühren und die Honorare unserer Partner für die Leistungen des Pakets inklusive. Der Kapitalrahmen je Paket ist Ihr Ziel; über jeden Rahmen entscheidet das Institut.",
    },
    {
      typ: "hinweis", id: "nicht", h2: "Was FIAON Global nicht ist",
      lead: "Diese Grenzen sagen wir vor dem Auftrag, nicht danach.",
      punkte: [
        "Keine Bank: FIAON führt keine Konten, gibt keine Karten aus und vergibt keine Kredite. Über Konto, Karte, Rahmen und Darlehen entscheidet allein das jeweilige Institut.",
        "Kein Kreditvermittler: Wer in Deutschland gewerbsmäßig Darlehen vermittelt, braucht dafür eine Erlaubnis (§ 34c GewO). FIAON vermittelt keine Kredite, erhält kein Honorar nach Rahmen und sagt keinen Rahmen zu. Der Kapitalrahmen eines Pakets ist ein Ziel, auf das wir gemeinsam hinarbeiten — keine Zusage.",
        "Kein Steuermodell: Eine US-Gesellschaft, die aus dem deutschsprachigen Raum geführt wird, bleibt dort steuerpflichtig — in Deutschland etwa nach § 10 AO und § 1 KStG, in Österreich nach dem Ort der Geschäftsleitung (§ 27 Abs. 2 BAO, § 1 KStG 1988), in der Schweiz nach der tatsächlichen Verwaltung (Art. 50 DBG).",
        "Keine Kanzlei: FIAON leistet keine Hilfe in Steuersachen und keine Rechtsdienstleistungen. Das tun Partner-Steuerberater, US-CPA und Partner-Anwälte in Ihrem Mandat.",
        "Kein Zinsversprechen: Einführungszeiträume ohne Sollzins bieten manche Herausgeber an; die Bedingungen legt jeder Herausgeber selbst fest.",
        GLOBAL_PFLICHTHINWEIS.de[0],
        GLOBAL_PFLICHTHINWEIS.de[1],
        GLOBAL_PFLICHTHINWEIS.de[2],
      ],
    },
  ],
  fragen: [
    { f: "Was ist FIAON Global?", a: DEFINITION },
    { f: "Ist FIAON Global eine Bank oder ein Kreditvermittler?", a: "Nein. FIAON ist keine Bank, vergibt keine Kredite, vermittelt keine Kredite und sagt keinen Rahmen zu. Über Konto, Karte, Rahmen und Darlehen entscheidet allein das jeweilige Institut. Konto-, Karten- und Kreditanträge stellen Sie selbst; FIAON bereitet sie vollständig vor. Der Kapitalrahmen eines Pakets ist ein Ziel, keine Zusage." },
    { f: "Wer steht hinter FIAON Global?", a: `Vertragspartner ist die ${F.name}, eine Private Limited Company mit Sitz ${F.strasse} in London, eingetragen beim Companies House am 3. Juli 2026 (${F.companyNo}). Director ist ${F.director}. Unser Team vor Ort arbeitet in Miami, Zürich ist unser Partnerstandort.` },
    { f: "Was kostet FIAON Global?", a: "Jedes der vier Pakete hat einen Festpreis, der vor dem Auftrag feststeht — alle Gebühren und Partner-Honorare für die Leistungen des Pakets inklusive. Die Preise stehen in der Paketübersicht auf dieser Seite. Ab dem zweiten Jahr fallen die laufenden Kosten der Gesellschaft an; dafür gibt es die freiwillige Jahresbetreuung." },
    { f: "Spart man mit einer US-Gesellschaft über FIAON Global Steuern?", a: "Nein, und das sagen wir offen. Eine US-Gesellschaft, die aus Deutschland, Österreich oder der Schweiz geführt wird, bleibt dort steuerpflichtig; die Gründung ist dem Finanzamt zu melden, in Deutschland nach § 138 AO mit der Steuererklärung. Eine US-Gesellschaft ist ein Werkzeug für echtes Geschäft in den USA und für den Aufbau einer Historie bei Instituten, kein Steuermodell. Wie Ihre Gesellschaft behandelt wird, prüft unser Partner-Steuerberater vor der Gründung." },
    { f: "Was unterscheidet FIAON Global von einem Gründungsdienst?", a: "Ein Gründungsdienst meldet die Gesellschaft an. FIAON Global übernimmt als Unternehmensberatung den ganzen Weg: Gründung, EIN, Vorbereitung der ITIN, D-U-N-S-Nummer, Registered Agent, US-Adresse und Telefon im ersten Jahr, Steuerberater, Anwalt und US-CPA im Mandat und vorbereitete Konto- und Kartenanträge — mit einem Ansprechpartner. Nur die Gesellschaft gibt es beim Gründungsdienst günstiger." },
    { f: "Muss ich für FIAON Global in die USA reisen?", a: "In der Regel nicht. Gründung, Steuernummern und Meldungen laufen aus der Ferne; Ihren Reisepass prüft unser Acceptance-Agent-Partner im DACH-Raum, persönlich oder im Videotermin, bei dem ihm der Pass oder eine beglaubigte Kopie der ausstellenden Behörde vorliegt. Verlangt ein Institut einen Termin vor Ort, begleitet Sie unser Team in Miami. Wer den Auftakt persönlich in Miami erleben möchte, wählt das Paket Global VIP." },
    { f: GLOBAL_KAPITAL_FREI.de.frage, a: GLOBAL_KAPITAL_FREI.de.antwort },
  ],
  weiter: ["/business/ablauf", "/business/vergleich", "/business/wissen/us-funding", "/business/wissen/us-llc-steuern"],
  quellen: [
    QUELLEN.chFirma,
    QUELLEN.chOrgane,
    Q.ss4,
    Q.w7,
    Q.caa,
    Q.i5472,
    Q.duns,
    QUELLEN_STAATEN.florida[3],
    Q.delawareAgent,
    QUELLEN.wyAgent,
    QUELLEN.ao10,
    QUELLEN.kstg1,
    Q.ao138,
    QUELLEN.bao27,
    QUELLEN.kstgAt1,
    QUELLEN.dbg50,
    QUELLEN.stberg5,
    QUELLEN.rdg3,
    QUELLEN.gewo34c,
  ],
};
