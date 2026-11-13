// ═══════════════════════════════════════════════════════════════════════════
// FIAON GLOBAL — KONZEPTSEITE: WAS IST FIAON GLOBAL? (27.10.2026, E-439) · FG · 53
// neu gefasst am 13.11.2026 (E-510, Sprachleitfaden FIAON Global)
//
// Die Entitätsseite für Google und KI-Modelle (Recherche .arbeit/recherche/ki.md,
// Befund 5 und Abschnitt 5): die Positionierung ganz oben, ein Faktenkasten, die
// acht Anlaufstellen, die sechs Schritte, die Rollen, was FIAON Global nicht ist und
// wie ein Mandat beginnt. Selbstbezeichnung „Unternehmensberatung“ (Justin,
// 27.10.2026, Register E-439: „DÜRFEN WIR VERWENDEN ALS UK-GESELLSCHAFT“).
//
// E-510 (13.11.2026, Justin: „keine Magie, sondern knallharte Fakten“):
// · Die Positionierung (Leitfaden 1.1), der Definitionssatz (9.4), die sechs Schritte
//   (2.2, Schritt 5 in der Fassung „heute“), die festen Sätze S1 bis S17, die Belege
//   (6.2) und die Übergangssätze kommen aus shared/fiaon-global-saetze.ts — sie
//   werden hier nie ein zweites Mal getippt. Kein Betrag ist getippt (SAETZE_BETRAEGE).
// · Was hier NIE steht: ein Satz dazu, wer für eine Finanzierung einsteht (steht nur
//   im persönlichen Angebot und im Vertrag) · „nach positiver Prüfung“ (Vorbehalt V1)
//   · ein eigener Erklär-Satz zum Erfolgshonorar (V3 — es gelten die drei Zeilen aus
//   S12) · ein Partner bei der Arbeit im Präsens (V2 — nur die Rollenwörter
//   „Partner-Anwälte“, „US-Steuerberater (CPA) aus unserem Partnernetz“, „in eigener
//   Verantwortung“) · ein Ort oder Name einer Partnergesellschaft, ein „Team vor Ort“
//   · eine Dauer als Zusage · Österreich oder die Schweiz im selben Satz wie Konto,
//   Karte oder Finanzierung (Leitfaden 5.12 — deshalb nennen Positionierung und
//   Definition keine Länder) · die Presse-Zeile (sie steht einmal je Seite im
//   Vertrauens-Band der Vorlage, global-seite.tsx → GlobalVertrauen).
// · Nicht mehr auf der Seite, weil der Vertrag des einen Produkts es nicht nennt:
//   die D-U-N-S-Nummer als unsere Leistung, die Prüfung vor der Gründung durch einen
//   Partner-Steuerberater, ein Acceptance-Agent-Partner, „LLC oder Corporation“
//   (der Vertrag nennt die LLC), die Standorte Zürich und Miami.
//
// Fach- und Rechtsprüfung am 27.10.2026 (jede Quelle geöffnet): EIN aus dem Ausland
// per Telefon, Fax oder Post, nicht online (SS-4, 12/2025); CAA: Pass oder beglaubigte
// Kopie der ausstellenden Behörde (IRS-Seite, Stand 30.04.2026); Form 5472 bei
// meldepflichtigen Vorgängen, schon Einlage und Gründungskosten zählen (i5472);
// Registered Agent Pflicht in FL (§ 605.0113), DE (§ 18-104), WY (§ 17-28-101);
// § 138 Abs. 5 AO: Mitteilung mit der Steuererklärung.
// Selbst nachgeprüft am 27.10.2026:
// · Companies House: FIAON LTD, Company Number 17318250, Private limited Company,
//   Active, 128 City Road, London EC1V 2NX, eingetragen am 3. Juli 2026; Director
//   Justin Schwarzott (bestellt 03.07.2026).
// · § 5 Abs. 1 StBerG (Hilfe in Steuersachen nur durch Befugte), § 3 RDG
//   (Rechtsdienstleistungen nur, soweit erlaubt), § 27 Abs. 2 BAO (Ort der
//   Geschäftsleitung = Mittelpunkt der geschäftlichen Oberleitung).
// ═══════════════════════════════════════════════════════════════════════════
import type { GlobalSeite, GlobalQuelle } from "../typen";
import { GLOBAL_PFLICHTHINWEIS, GLOBAL_KAPITAL_FREI } from "../../fiaon-global";
import { GELD_ZURUECK, SAETZE_BETRAEGE, SCHRITTE_KOPF, beleg, satz, sechsSchritte, weitererSatz } from "../../fiaon-global-saetze";
import { EIN_PRODUKT } from "../ein-produkt";
import { FIAON_FIRMA as F } from "../../fiaon-firma";
import { QUELLEN_WISSEN as Q, QUELLEN_STAATEN, IRS } from "../fakten";

/** Tag der Erstveröffentlichung (E-439). */
const S = "2026-10-27";
/** Tag der letzten inhaltlichen Änderung (E-510, Sprachleitfaden) — erschienen bleibt der 27.10. */
const STAND = "2026-11-13";
const P = EIN_PRODUKT.de;
/** Die Beträge aus der Preisquelle — nie getippt. */
const B = SAETZE_BETRAEGE.de;
/** Die sechs Schritte, wortgleich aus der Quelle der festen Sätze (Schritt 5 in der Fassung „heute“). */
const SCHRITTE = sechsSchritte("de").schritte;
const KOPF = SCHRITTE_KOPF.de;

/** Die Positionierung in einem Satz (Leitfaden 1.1) — steht wörtlich im Kopf der Seite. */
const POSITIONIERUNG = weitererSatz("POSITIONIERUNG");
/** Der Definitionssatz (Leitfaden 9.4) — derselbe Wortlaut für Kurzprofil, Fragen, Datenblock und /llms.txt. */
const DEFINITION = weitererSatz("DEFINITION");
/** Der Rollen-Satz zu den Partnern (Leitfaden 5.11) und sein zweiter Satz: wer die Honorare trägt. */
const ROLLEN = weitererSatz("ROLLEN");
const HONORARE_DER_PARTNER = ROLLEN.split(/(?<=\.)\s+/)[1];
/** Satz S8, in seinen drei Sätzen: keine Bank, keine Kanzlei · keine Kredite · Recht und Steuern bei Partnern. */
const [KEINE_BANK, KEINE_KREDITE, RECHT_UND_STEUERN] = satz("S8").split(/(?<=\.)\s+/);
/** Das Honorar in Kurzform (Leitfaden 1.3, Antwort „Was kostet es — und wann?“) — immer alle drei Teile. */
const HONORAR = `${B.honorarAuftrag} mit Ihrem Auftrag. Mit der Eintragung Ihrer Gesellschaft das Erfolgshonorar nach Ihrem Kapitalrahmen, mindestens ${B.erfolgMin}. Ab dem zweiten Jahr auf Wunsch ${B.jahresbetreuung} im Jahr.`;
/** Der Reisepass im ITIN-Antrag — der Weg, den die IRS zulässt, ohne einen Partner beim Namen oder Ort zu nennen. */
const PASS_WEG = "Die IRS lässt zu, dass ein von ihr zugelassener Certifying Acceptance Agent Ihren Reisepass bestätigt; das Original müssen Sie dann nicht in die USA senden. Den Weg stimmen wir vor dem Antrag mit Ihnen ab.";
/** Der Miami-Satz mit seinem Bezug (Leitfaden 5.8) — ausgeschrieben, weil er hier ohne die Spanne des Kapitalrahmens steht. */
const MIAMI = "Ab einem Kapitalrahmen von 1 Mio. US-Dollar begleiten wir Sie persönlich in Miami.";
/** Wofür die Mittel einer Finanzierung eingesetzt werden dürfen (Justin, 19.09.2026) — mit dem Institut und der Zuständigkeit für Steuerfragen. */
const MITTEL_IN_EUROPA = "Die Mittel aus einer Finanzierung sind nicht an die USA gebunden. Ihre Gesellschaft kann sie nach Europa überweisen oder dort investieren, im Rahmen der Bedingungen des finanzierenden Instituts. Für die steuerliche Einordnung von Überweisungen und Investitionen sind Partner-Steuerberater zuständig; sie arbeiten in eigener Verantwortung.";

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
  wyAgent: { titel: "Wyoming Statutes § 17-28-101 — Registered Office und Registered Agent (Wyoming Legislature)", url: "https://statutes.wyoleg.gov/NXT/gateway.dll/2022%20Wyoming%20Statutes/2022%20Titles/898/1039" },
};

export const SEITE: GlobalSeite = {
  pfad: "/business/was-ist-fiaon-global",
  art: "leistung",
  seo: {
    titel: "Was ist FIAON Global? Unternehmensberatung — FIAON Global",
    beschreibung: "FIAON Global ist die Unternehmensberatung der FIAON LTD, London, für Ihre US-Gesellschaft: ein Mandat, klare Rollen, Honorar vorab — mit Quellen.",
  },
  stand: STAND,
  erschienen: S,
  kennung: "FG · 53",
  auge: "FIAON Global · Wer wir sind",
  h1: "Was ist FIAON Global?",
  h1b: "Die Unternehmensberatung für Ihre US-Gesellschaft.",
  lead: `${POSITIONIERUNG} Diese Seite nennt Ihren Vertragspartner, die sechs Schritte des Mandats und wer worüber entscheidet.`,
  ziffern: [
    { wert: "1 Mandat", label: "ein Vertrag, ein fester Ansprechpartner" },
    { wert: F.companyNo, label: `Nr. der ${F.name} im Companies House (England und Wales)` },
    { wert: "6 Schritte", label: "jeder mit seiner Bedingung" },
  ],
  blick: [
    ["Was", `Unternehmensberatung der ${F.name} für US-Gesellschaften`],
    ["Vertragspartner", `${F.name}, London · Companies House Nr. ${F.companyNo}`],
    ["Wir übernehmen", "Gründung, Unterlagen und Steuernummern; vollständig vorbereitete Anträge für Konten, Kreditkarten auf Wunsch und Finanzierung"],
    ["Sie selbst", "Namen wählen, Reisepass hochladen, unterzeichnen; die Anträge bei den Instituten stellen Sie selbst"],
    ["Wer entscheidet", "Der Bundesstaat, die US-Steuerbehörde und das jeweilige Institut"],
    ["Honorar", HONORAR],
    [GELD_ZURUECK.de.auge, satz("S7")],
  ],
  kurz: `FIAON Global ist die Unternehmensberatung der ${F.name}, London (Companies House Nr. ${F.companyNo}). Wir gründen Ihre US-Gesellschaft, holen jede Unterlage ein und beantragen die Steuernummern. Ihre Anträge für Konten, auf Wunsch Kreditkarten und Finanzierung bereiten wir vollständig vor; Sie stellen sie selbst. Es entscheiden der Bundesstaat, die US-Steuerbehörde und das jeweilige Institut. ${KEINE_BANK}`,
  bloecke: [
    {
      typ: "text", id: "definition", h2: "FIAON Global: der Gedanke dahinter",
      absaetze: [
        "Wer vom Ausland aus eine US-Gesellschaft aufbaut, hat es in der Regel mit acht Stellen zu tun — vom Bundesstaat bis zum Kartenherausgeber. Jede Stelle hat eigene Formulare, eigene Fristen und eigene Rückfragen. FIAON Global fasst diese Arbeit in einem Mandat zusammen. Sie haben einen festen Ansprechpartner, und jede Zuständigkeit ist benannt.",
        `FIAON Global ist der Geschäftsbereich der ${F.name} für US-Gesellschaften. Ihr Vertragspartner ist in jedem Fall die ${F.name} mit Sitz in London. ${weitererSatz("UEBERGANG-EINREICHUNG")} Wir arbeiten auf Deutsch und auf Englisch, für Klienten mit Wohnsitz oder Sitz in Deutschland, Österreich und der Schweiz.`,
      ],
    },
    {
      typ: "tabelle", id: "fakten", h2: "Die Fakten zu FIAON Global",
      lead: "Die Angaben zum Unternehmen — jede mit der Quelle, an der Sie sie selbst prüfen können.",
      kopf: ["Merkmal", "Angabe"],
      zeilen: [
        ["Name", `FIAON Global — der Geschäftsbereich der ${F.name} für US-Gesellschaften`],
        ["Was es ist", "Unternehmensberatung für US-Gesellschaften: Gründung, laufende Betreuung und Begleitung bis zur Entscheidung über die Finanzierung"],
        ["Vertragspartner", `${F.name}, Private Limited Company, England und Wales`],
        ["Register", `Companies House, Nr. ${F.companyNo}, Eintrag vom 3. Juli 2026`],
        ["Sitz", `${F.strasse}, ${F.ortZeile}, Vereinigtes Königreich`],
        ["Geschäftsführung", `${F.director}, Director und Gründer`],
        ["In den USA", `${weitererSatz("UEBERGANG-EINREICHUNG")} ${MIAMI}`],
        ["Für wen", "Unternehmen, Selbständige und Privatpersonen mit Wohnsitz oder Sitz in Deutschland, Österreich oder der Schweiz"],
        ["Was gegründet wird", "US-Gesellschaft (LLC) in Delaware, Florida oder Wyoming"],
        ["Sprachen", "Deutsch und Englisch"],
        ["Mandat", `Ein Mandat: ${P.name}`],
        ["Honorar", HONORAR],
        ["Kontakt", `${F.email} · ${F.telefon}`],
      ],
      fuss: [`Registerangaben laut Companies House, abgerufen am 27. Oktober 2026. ${beleg("honorarVorab")}`],
    },
    {
      typ: "tabelle", id: "anlaufstellen", h2: "Ein Ansprechpartner statt acht Anlaufstellen",
      lead: "Acht Stellen, mit denen eine US-Gesellschaft aus dem Ausland in der Regel zu tun hat. Die letzte Spalte zeigt, wer was übernimmt, wenn Sie FIAON Global das Mandat erteilen.",
      kopf: ["Anlaufstelle", "Worum es geht", "Ohne FIAON Global", "Mit FIAON Global"],
      zeilen: [
        ["Bundesstaat", "Gründung der Gesellschaft, staatliche Gebühr", "Gründungsdienst suchen oder selbst einreichen", "wir melden Ihre Gesellschaft an, Staatsgebühr enthalten; über die Eintragung entscheidet der Bundesstaat"],
        ["Registered Agent", "vorgeschriebene Zustellanschrift im Bundesstaat, dazu US-Geschäftsadresse und US-Telefonnummer", "eigener Vertrag, eigene Jahresgebühr", "im ersten Jahr enthalten; Post, Anrufe und Termine koordiniert Ihr Ansprechpartner"],
        ["US-Steuerbehörde (IRS)", "EIN der Gesellschaft (Formular SS-4), ITIN für Sie persönlich (Formular W-7)", "englische Formulare; aus dem Ausland nur per Telefon, Fax oder Post, nicht online", "wir beantragen die EIN und, nach unserem ITIN-Check, die ITIN; es entscheidet die IRS"],
        ["Anwalt", "Operating Agreement und Gründungsunterlagen", "eigener Auftrag, eigenes Honorar", "Operating Agreement und Gründungsunterlagen sind enthalten; Rechtsfragen liegen bei Partner-Anwälten, in eigener Verantwortung"],
        ["Steuerberater im Wohnsitzland", "Steuerpflicht im Wohnsitzland, Meldung der Gründung", "eigener Auftrag, eigenes Honorar", "Steuerfragen liegen bei Partner-Steuerberatern, in eigener Verantwortung; Ihre Steuererklärung bleibt bei Ihrem Steuerberater"],
        ["US-Steuerberater (CPA)", "jährliche US-Meldung (Form 5472 mit Form 1120)", "eigener Auftrag, jedes Jahr neu", "die erste jährliche US-Meldung ist enthalten, danach mit der Jahresbetreuung"],
        ["Institute", "privates US-Konto und Geschäftskonto", "Institut suchen, Unterlagen sammeln, beantragen", "wir bereiten jeden Antrag vollständig vor; Sie stellen ihn selbst, es entscheidet das jeweilige Institut"],
        ["Kartenherausgeber", "Kreditkarten, privat und für Ihre Gesellschaft", "jeder Antrag für sich", "auf Wunsch bereiten wir jeden Antrag vor, ohne zusätzliches Honorar von FIAON; es entscheidet der Herausgeber"],
      ],
      hervor: 3,
      fuss: [
        "Für Lieferanten und Institute zählt außerdem die D-U-N-S-Nummer von Dun & Bradstreet: neun Ziffern, ohne Gebühr vergeben.",
        "Florida, Delaware und Wyoming schreiben jeder Gesellschaft einen Registered Agent mit Anschrift im Bundesstaat vor.",
      ],
    },
    {
      // Die sechs Schritte der festen Erzählung (Leitfaden 2.2): Satz, Bedingung und „Ihr Ergebnis“ — ohne Dauer. „Ihr Teil“ steht im Baustein „rollen“ darunter.
      typ: "etappen", id: "etappen", h2: KOPF.h2,
      lead: KOPF.lead,
      etappen: SCHRITTE.map((s) => ({ titel: s.titel, text: `${s.satz} ${s.bedingung} ${KOPF.teile.ihrErgebnis}: ${s.ihrErgebnis}` })),
    },
    {
      typ: "rollen", id: "rollen", h2: "Wer was verantwortet",
      lead: ROLLEN,
      fiaon: [
        "meldet Ihre Gesellschaft beim Bundesstaat an, Staatsgebühr enthalten",
        "holt die Unterlagen ein und beantragt EIN und ITIN (die ITIN nach unserem ITIN-Check)",
        "stellt Registered Agent, US-Geschäftsadresse und US-Telefonnummer im ersten Jahr",
        "bereitet jeden Antrag für Konten, Kreditkarten auf Wunsch und Finanzierung vollständig vor",
        "führt den Pflichtenkalender und reicht die erste Jahresmeldung beim Bundesstaat ein",
        "trägt die Honorare der Partner für die Leistungen Ihres Vertrags",
      ],
      partner: [
        "Partner-Anwälte: Rechtsfragen, in eigener Verantwortung",
        "US-Steuerberater (CPA) aus unserem Partnernetz: die erste jährliche US-Meldung",
        "Partner-Steuerberater: Steuerfragen im Wohnsitzland, in eigener Verantwortung",
      ],
      sie: [
        "wählen den Namen, laden Ihren Reisepass hoch und unterzeichnen die vorgelegten Unterlagen",
        "stellen die Anträge bei Institut und Kartenherausgeber selbst",
        "wählen Ihren Kapitalrahmen; Ihre Gesellschaft entscheidet über jedes Angebot des Instituts",
        "melden die Gründung beim Finanzamt — in Deutschland nach § 138 AO, mit Ihrem Steuerberater",
      ],
    },
    {
      typ: "text", id: "fiaon", h2: "Was FIAON Global übernimmt",
      absaetze: [
        "FIAON Global arbeitet nach einem Grundsatz: ein Mandat, ein Vertrag, ein fester Ansprechpartner. Ihr Ansprechpartner führt Ihr Mandat vom Angebot bis zum letzten Schritt. Jede Unterlage legen wir Ihnen unterschriftsreif vor. Den Stand zeigt Ihr Portal.",
        `Die EIN Ihrer Gesellschaft beantragen wir mit dem Formular SS-4. ${weitererSatz("UEBERGANG-ITIN")} ${PASS_WEG} ${satz("S3")}`,
        `Zu Konten und Karten: ${satz("S2")} Jede Angabe in einem Antrag bleibt Ihre eigene. Name, Anschrift und Telefonnummer stehen in jedem Formular in derselben Schreibweise. ${beleg("keinZugriff")}`,
        `Zur Finanzierung: ${satz("S9")} ${satz("S7")}`,
        `${RECHT_UND_STEUERN} ${HONORARE_DER_PARTNER} Der Grund für diese Trennung ist das Berufsrecht: Hilfe in Steuersachen darf in Deutschland geschäftsmäßig nur leisten, wer dazu befugt ist (§ 5 StBerG). Für außergerichtliche Rechtsdienstleistungen gilt Entsprechendes (§ 3 RDG).`,
        `${satz("S12")} ${weitererSatz("ZAHLUNG")}`,
        MITTEL_IN_EUROPA,
      ],
    },
    {
      typ: "text", id: "einordnung", h2: "Unternehmensberatung statt Gründungsdienst: die Einordnung",
      absaetze: [
        "Ein Gründungsdienst meldet die Gesellschaft beim Bundesstaat an und stellt meist den Registered Agent. Danach folgen die Steuernummern bei der IRS, das Operating Agreement und die erste jährliche US-Meldung. Hinzu kommen die Steuerpflicht im Wohnsitzland und die Anträge bei Instituten und Kartenherausgebern.",
        "FIAON Global arbeitet deshalb als Unternehmensberatung: ein Mandat für Gründung, Unterlagen und die Vorbereitung Ihrer Anträge, mit einem festen Ansprechpartner. Wer nur die Gründung braucht, zahlt bei einem Gründungsdienst weniger. Unser Honorar umfasst auch die Aufgaben danach, von den Steuernummern bis zur ersten jährlichen US-Meldung.",
        `Diese Aufgaben sind keine Formsache. Eine LLC, die ganz einem Eigentümer aus dem Ausland gehört, reicht Form 5472 mit Form 1120 bei der IRS ein. Das gilt für jedes Jahr mit meldepflichtigen Vorgängen zwischen ihr und ihrem Eigentümer, auch ohne Umsatz. Dazu zählen schon die Einlage und bezahlte Gründungskosten. Entspricht das Geschäftsjahr dem Kalenderjahr, ist die Frist der ${IRS.frist5472}. Fehlt die Meldung, kann die IRS eine Strafe von ${IRS.strafe5472} festsetzen. Deshalb ist die erste jährliche US-Meldung in Ihrem Mandat enthalten.`,
      ],
    },
    {
      typ: "text", id: "inklusive", h2: "Im ersten Jahr enthalten",
      absaetze: ["Mit Ihrem Auftrag sind im ersten Jahr enthalten:"],
      punkte: [...P.enthalten],
      nach: `Nicht enthalten sind Gebühren und Zinsen der Herausgeber und Institute, die Kosten des Darlehens und Steuern. Auf Wunsch kommen hinzu: die Jahresbetreuung ab dem zweiten Jahr (${B.jahresbetreuung} im Jahr) und Fast-Track, der Vorrang in allen Schritten (${B.fastTrack}). Steuererklärungen in Ihrem Wohnsitzland bleiben bei Ihrem Steuerberater.`,
    },
    {
      // Angebot, Unterschrift, Rechnung und Reisepass stehen VOR den sechs Schritten — sie zählen nicht als Schritte (Leitfaden 2.1).
      typ: "etappen", id: "auftrag", h2: "Ihr Mandat beginnt",
      lead: "Bevor der erste der sechs Schritte beginnt, liegen vier Dinge vor.",
      etappen: [
        { titel: "Ihr Angebot", text: "Sie fordern es im Honorarrechner an oder vereinbaren zuerst ein Gespräch: dreißig Minuten, kostenfrei und ohne Verpflichtung." },
        { titel: "Ihre Unterschrift", text: `Sie lesen Ihren vollständigen Vertrag in Ihrem persönlichen Angebot, wählen den Namen Ihrer Gesellschaft und unterzeichnen online. Vertragspartner ist die ${F.name}, London.` },
        { titel: "Ihre Rechnung", text: `Vertrag und Rechnung erhalten Sie per E-Mail, dazu den Zugang zu Ihrem Portal. ${weitererSatz("ZAHLUNG")}` },
        { titel: "Ihr Reisepass", text: "Sie laden ihn nach der Unterschrift hoch. Nach Eingang Ihrer Zahlung und Ihres Reisepasses beginnen wir." },
      ],
    },
    {
      typ: "text", id: "pruefen", h2: "FIAON Global Erfahrungen: selbst prüfen",
      absaetze: [
        "Erfahrungsberichte sind ein Anhaltspunkt. Verlässlicher ist, was Sie selbst prüfen können, bevor Sie unterzeichnen:",
      ],
      punkte: [
        `der Vertragspartner im Register: ${F.name}, Companies House Nr. ${F.companyNo}, Eintrag vom 3. Juli 2026, Sitz ${F.strasse} in London — öffentlich einsehbar`,
        `die Geschäftsführung: Director ist ${F.director}, im selben Register geführt`,
        "der Vertrag: Sie lesen ihn vollständig in Ihrem persönlichen Angebot, bevor Sie unterzeichnen — auf Deutsch",
        "das Honorar: Es steht als Betrag in Ihrem Angebot, bevor Sie unterzeichnen",
        `die Zahlung: ${beleg("zahlung")}`,
        "die Grenzen: Was FIAON Global nicht ist, steht auf dieser Seite und in Ihrem Vertrag",
      ],
      nach: "Dieselben Punkte können Sie bei jedem Anbieter prüfen. Eine Zusage zu Rahmen oder Zinsen kann kein Anbieter halten: Darüber entscheidet das jeweilige Institut.",
    },
    {
      typ: "zitat", id: "kurzprofil",
      text: DEFINITION,
      quelle: "Kurzprofil von FIAON Global zum Zitieren · Stand: November 2026",
    },
    { typ: "pakete", id: "mandat", h2: P.karteH2, lead: P.karteLead },
    {
      typ: "hinweis", id: "nicht", h2: "Was FIAON Global nicht ist",
      lead: "Diese Grenzen stehen fest, bevor Sie unterzeichnen.",
      punkte: [
        `Keine Bank: FIAON führt keine Konten und gibt keine Karten aus. ${beleg("keinZugriff")} Über Konto, Karte und Finanzierung entscheidet das jeweilige Institut.`,
        `Kein Kreditvermittler: ${KEINE_KREDITE} ${satz("S9")} ${satz("S1")}`,
        `Kein Steuermodell: ${satz("S10")} Wird die Gesellschaft aus dem Wohnsitzland geführt, ist auch sie dort steuerpflichtig: in Deutschland nach § 10 AO und § 1 KStG. In Österreich zählt der Ort der Geschäftsleitung (§ 27 Abs. 2 BAO, § 1 KStG 1988), in der Schweiz die tatsächliche Verwaltung (Art. 50 DBG).`,
        `Keine Kanzlei: FIAON leistet keine Hilfe in Steuersachen und keine Rechtsdienstleistungen. ${RECHT_UND_STEUERN}`,
        "Keine Zusage zu Zinsen: Gebühren und Zinsen legt jeder Herausgeber und jedes Institut selbst fest.",
        GLOBAL_PFLICHTHINWEIS.de[0],
        GLOBAL_PFLICHTHINWEIS.de[1],
        GLOBAL_PFLICHTHINWEIS.de[2],
      ],
    },
  ],
  fragen: [
    { f: "Was ist FIAON Global?", a: DEFINITION },
    { f: "Ist FIAON Global eine Bank oder ein Kreditvermittler?", a: `Nein. ${KEINE_BANK} ${KEINE_KREDITE} ${satz("S2")} ${satz("S9")} ${satz("S1")}` },
    { f: "Wer steht hinter FIAON Global?", a: `Vertragspartner ist die ${F.name}, eine Private Limited Company mit Sitz ${F.strasse} in London. Sie ist eingetragen im Companies House unter Nr. ${F.companyNo}, seit dem 3. Juli 2026. Director ist ${F.director}. Den Eintrag können Sie ohne Anmeldung einsehen.` },
    { f: "Was kostet FIAON Global?", a: satz("S12") },
    { f: "Spart man mit einer US-Gesellschaft über FIAON Global Steuern?", a: `Nein. ${satz("S10")} Die Gründung melden Sie dem Finanzamt, in Deutschland nach § 138 AO mit Ihrer Steuererklärung. ${beleg("fuerWenNicht")}` },
    { f: "Was unterscheidet FIAON Global von einem Gründungsdienst?", a: "Ein Gründungsdienst meldet die Gesellschaft beim Bundesstaat an. FIAON Global arbeitet in einem Mandat: Gründung, Unterlagen und Steuernummern, dazu vollständig vorbereitete Anträge für Konten, Kreditkarten auf Wunsch und Finanzierung. Über jeden Antrag entscheidet das jeweilige Institut. Wer nur die Gründung braucht, zahlt bei einem Gründungsdienst weniger." },
    { f: "Muss ich für FIAON Global in die USA reisen?", a: `Für die Gründung und die Steuernummer Ihrer Gesellschaft nicht. ${weitererSatz("UEBERGANG-EINREICHUNG")} ${PASS_WEG} Ob Ihre Anwesenheit nötig ist, entscheidet das jeweilige Institut. ${MIAMI}` },
    { f: GLOBAL_KAPITAL_FREI.de.frage, a: `Nein. ${MITTEL_IN_EUROPA}` },
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
  ],
};
