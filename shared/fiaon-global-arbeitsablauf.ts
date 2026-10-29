// ═══════════════════════════════════════════════════════════════════════════
// DER ARBEITSABLAUF JE GLOBAL-KUNDE (E-462, 29.10.2026)
//
// Justin: der komplette Ablauf je FIAON-Global-Kunde — US-LLC-Gründung über den
// Registered Agent bis zur ITIN — als Reiter im Chefbüro-Mandat, damit er und
// später ein Mitarbeiter genau danach arbeiten können.
//
// Diese Datei ist REIN (keine Datenbank, kein Netz, das „heute" kommt als
// Parameter) und die EINE Quelle für:
//   · die 8 Blöcke mit 20 Schritten (+ 3 Dinge, die vorher vom Kunden kommen),
//   · wer was tut („Du klickst/zahlst" oder „Team/System"),
//   · jedes Feld im Formular des Registered Agent mit dem genauen Wert,
//   · die Links (extern: neuer Tab; intern: Reiter des Mandats oder Chefbüro-Raum),
//   · den Stand je Schritt: aus der Fahrplan-Station (automatisch) oder als Haken
//     von Hand (fiaon_global_auftraege.arbeitsablauf_haken).
//
// Der Text ist INTERN (du-Form, ganz einfache Sätze, Fachwort kurz erklärt).
// Kundentexte entstehen woanders — immer gesiezt.
//
// Platzhalter in Werten und Links: {gesellschaft} {nameOhneEndung} {bundesstaat}
// {vorname} {nachname} {kunde} {kontaktMail} {telefon} {wohnadresse} {usTelefon}
// {heuteUs} {plus5Werktage} {sunbizName} {raAnschrift}. Fehlt ein Wert, zeigt die Seite eine
// Leerstelle — nie einen erfundenen Wert.
//
// E-465 (29.10.2026): Der Ablauf hängt am Bundesstaat der Gesellschaft — Register, Gebühr,
// Warenkorb-Summe, Eintragungszeit (Delaware mit Express), Jahrespflicht. ablaufBloecke(staat)
// baut ihn je Staat; ABLAUF_BLOECKE ist die Florida-Fassung (Schlüssel und Nummern sind in jedem
// Staat gleich — die Haken in der Datenbank passen immer). Zeiten aus shared/fiaon-global-bundesstaaten.ts.
// ═══════════════════════════════════════════════════════════════════════════

import { BUNDESSTAATEN, staatInfo, type StaatSchluessel } from "./fiaon-global-bundesstaaten";
import { EIN_WEG } from "./fiaon-global-seiten/fakten";

export type AblaufWer = "du" | "team" | "buchhaltung";
export const ABLAUF_WER_TEXT: Record<AblaufWer, string> = {
  du: "Du klickst/zahlst",
  team: "Team/System",
  buchhaltung: "Buchhaltung",
};

/** Die Anschrift des Registered Agent in Florida — Geschäftsadresse und Agent-Anschrift jeder Florida-LLC. */
export const ABLAUF_RA_ANSCHRIFT = "7901 4th St N, Ste 300, St. Petersburg, FL 33702";

export type AblaufReiter = "ueberblick" | "gesellschaft" | "akte" | "unterschriften" | "tresor" | "anfragen" | "fristen" | "verlauf";

export type AblaufLink =
  | { titel: string; url: string }
  | { titel: string; reiter: AblaufReiter }
  | { titel: string; pfad: string };

export interface AblaufFeld {
  /** Wie das Feld im Formular heißt (englisch, wie auf der Seite) oder was du tust. */
  feld: string;
  /** Der Wert — mit Platzhaltern. Ohne Kopieren-Knopf, wenn `kopieren: false`. */
  wert: string;
  kopieren?: false;
  /** Ein kurzer Satz dazu. */
  hinweis?: string;
}

export interface AblaufHinweis { ton: "warnung" | "info"; text: string }

/** Woher der Stand eines Schritts kommt. */
export type AblaufQuelle =
  | { art: "haken" }
  | { art: "station"; schluessel: string }
  | { art: "zahlung" }
  /** Station „Registered Agent" erledigt UND US-Geschäftsadresse eingetragen. */
  | { art: "agent_adresse" }
  /** Die US-Telefonnummer ist eingetragen (Station „US-Adresse und Telefonnummer"). */
  | { art: "us_telefon" }
  /** Warten auf die Eintragung: läuft, sobald die Gründung eingereicht ist; fertig, wenn eingetragen. */
  | { art: "eintragung_warten" };

export interface AblaufSchritt {
  nr: number;
  /** Fester Schlüssel — für die Haken in der Datenbank. Nie umbenennen. */
  key: string;
  titel: string;
  wer: AblaufWer;
  /** Was zu tun ist — ganz einfache Sätze. */
  text: string;
  felder?: AblaufFeld[];
  links?: AblaufLink[];
  hinweise?: AblaufHinweis[];
  quelle: AblaufQuelle;
  /** Erst, wenn diese Vorab-Dinge da sind (sonst „wartet auf den Kunden"). */
  braucht?: string[];
  /** E-462 Nachtrag (29.10.2026, Justin): erst, wenn die US-Nummer des Kunden eingetragen ist (Schritt 12). */
  brauchtUsTelefon?: boolean;
  /** Station, die der Knopf „Station öffnen" aufklappt (bei Station-Schritten automatisch). */
  station?: string;
}

export interface AblaufVorab { key: string; titel: string; text: string; /** Gilt auch als da, wenn diese Dokumentart im Tresor liegt. */ dokumentArt?: string }

export interface AblaufBlock { nr: number; titel: string; wann: string; text?: string; schritte: AblaufSchritt[] }

// ── 0 · VORHER VOM KUNDEN ────────────────────────────────────────────────────
export const ABLAUF_VORAB: AblaufVorab[] = [
  { key: "v_taetigkeit", titel: "Tätigkeit in einem Satz", dokumentArt: "taetigkeitsbeschreibung",
    text: "Was macht die Firma? Ein Satz reicht, z. B. „Business consulting services“. Den brauchst du für die EIN (die Steuernummer der Firma)." },
  { key: "v_einverstanden", titel: "„Einverstanden“ zur Unterschrift",
    text: "Der Kunde schreibt schriftlich „Einverstanden“: Wir dürfen den EIN-Antrag (Formular SS-4) in seinem Auftrag unterschreiben. Ohne dieses Wort unterschreibst du nichts." },
  { key: "v_pass", titel: "Reisepass als PDF", dokumentArt: "reisepass",
    text: "Für die ITIN (die persönliche US-Steuernummer) später. Die Gründung selbst braucht den Pass nicht." },
];

// ── JE BUNDESSTAAT (E-465) ──────────────────────────────────────────────────────
// Florida: genau die Werte aus E-462 (Northwest-Warenkorb 79 + 0 + 100 + 125 = 304 $).
// Delaware: Staatsgebühr 110 $ (Certificate of Formation) → 289 $ ohne Express; Express des Staats
// (ein bis zwei Werktage) im Warenkorb dazubuchen — der Aufpreis steht dort.
// Wyoming: 100 $ + Kartengebühr des Staats (wenige Dollar) → 279 $ + Kartengebühr.
// Die Anschrift des Registered Agent kennen wir fest nur für Florida; in Delaware und Wyoming steht sie
// nach der Bestellung im Northwest-Konto (Leerstelle statt erfundener Anschrift).
export interface AblaufStaat {
  schluessel: StaatSchluessel; name: string;
  registerName: string; registerErklaerung: string; sucheTitel: string; sucheUrl: string; sucheText: string;
  articles: { wert: string; hinweis: string };
  staatGebuehr: string; summe: string; summeWarnung: string;
  expressHinweis: string | null;
  membersHinweis: string | null;
  eintragungWann: string; eintragungMara: string; pruefenTitel: string; pruefenText: string;
  jahrText: string; jahrFeld: string; jahrWert: string; jahrLinkTitel: string; jahrUrl: string;
  /** Feste Anschrift des Registered Agent (nur Florida) — sonst leer. */
  raAnschrift: string;
}
const SUNBIZ_SUCHE = "https://search.sunbiz.org/Inquiry/CorporationSearch/SearchResults?inquiryType=EntityName&searchTerm={sunbizName}";

/** Die Angaben je Staat; Unbekanntes oder leer → Florida (Bestand: alle Mandate vor E-465 sind Florida). */
export function ablaufStaat(roh: unknown): AblaufStaat {
  const b = staatInfo(roh) ?? BUNDESSTAATEN.florida;
  if (b.schluessel === "delaware") return {
    schluessel: "delaware", name: "Delaware",
    registerName: "Division of Corporations", registerErklaerung: "Die Division of Corporations ist das Firmenregister von Delaware.",
    sucheTitel: "Delaware-Namenssuche", sucheUrl: b.register.sucheUrl,
    sucheText: "Die Division of Corporations ist das Firmenregister von Delaware. Öffne die Namenssuche (Entity Search) und tippe den Namen ein. Ist er frei, setzt du die Station „Name geprüft“ auf erledigt.",
    articles: { wert: "Standard Articles", hinweis: "110 $ (Gebühr des Staats) — in Delaware heißt das Dokument Certificate of Formation" },
    staatGebuehr: "110 $", summe: "289 $ (ohne Express)", summeWarnung: "Andere Summe als 289 $ (ohne Express)? Dann nicht bezahlen — erst prüfen, was dazugekommen ist.",
    expressHinweis: "Express: Delaware trägt mit der Eilbearbeitung des Staats in der Regel in ein bis zwei Werktagen ein. Buche sie im Warenkorb dazu (Expedite), wenn der Vertrag Fast-Track hat oder die Leitung es freigibt — der Aufpreis steht im Warenkorb. Ohne Express dauert es derzeit rund zehn Werktage.",
    membersHinweis: "Delaware verlangt diese Angabe nicht; fragt das Formular danach, bleibt es bei unserem Standard wie gezeigt.",
    eintragungWann: "Mit Express Tag 1–2 · sonst rund zehn Werktage",
    eintragungMara: "eingereicht; Delaware trägt mit Express in der Regel in ein bis zwei Werktagen ein, sonst in rund zehn Werktagen",
    pruefenTitel: "Register in Delaware täglich prüfen",
    pruefenText: "Schau jeden Tag in der Namenssuche von Delaware (Entity Search), ob die Firma schon eingetragen ist.",
    jahrText: "Jedes Jahr: die Formulare 5472 und 1120 bis 15.04. (über TAXUSA). Die Jahressteuer in Delaware (400 $) bis 01.06. (über Northwest). Der Registered Agent verlängert sich von selbst. Hake ab, wenn die Fristen in der Akte stehen.",
    jahrFeld: "Jahressteuer Delaware", jahrWert: "bis 01.06. (400 $)", jahrLinkTitel: "Delaware-Jahressteuer", jahrUrl: b.register.jahresUrl,
    raAnschrift: "",
  };
  if (b.schluessel === "wyoming") return {
    schluessel: "wyoming", name: "Wyoming",
    registerName: "wyobiz", registerErklaerung: "wyobiz ist das Firmenregister von Wyoming.",
    sucheTitel: "Wyoming-Namenssuche", sucheUrl: b.register.sucheUrl,
    sucheText: "wyobiz ist das Firmenregister von Wyoming. Öffne die Suche (Filing Search) und tippe den Namen ein. Ist er frei, setzt du die Station „Name geprüft“ auf erledigt.",
    articles: { wert: "Standard Articles", hinweis: "100 $ (Gebühr des Staats, dazu eine kleine Kartengebühr)" },
    staatGebuehr: "100 $ + Kartengebühr", summe: "279 $ + Kartengebühr des Staats", summeWarnung: "Deutlich andere Summe als 279 $ plus die kleine Kartengebühr? Dann nicht bezahlen — erst prüfen, was dazugekommen ist.",
    expressHinweis: null,
    membersHinweis: "Wyoming verlangt diese Angabe nicht; fragt das Formular danach, bleibt es bei unserem Standard wie gezeigt. Wyoming braucht dafür eine Kontaktperson (in der Regel der Kunde) — die Station „Registered Agent“ fragt danach.",
    eintragungWann: "Rund drei Werktage, oft schneller",
    eintragungMara: "eingereicht; Wyoming trägt in der Regel in rund drei Werktagen ein",
    pruefenTitel: "Register in Wyoming täglich prüfen",
    pruefenText: "Schau jeden Tag bei wyobiz (Filing Search), ob die Firma schon eingetragen ist.",
    jahrText: "Jedes Jahr: die Formulare 5472 und 1120 bis 15.04. (über TAXUSA). Der Jahresbericht in Wyoming bis zum 1. Tag des Gründungsmonats (mindestens 60 $, über Northwest). Der Registered Agent verlängert sich von selbst. Hake ab, wenn die Fristen in der Akte stehen.",
    jahrFeld: "Jahresbericht Wyoming", jahrWert: "1. Tag des Gründungsmonats (ab 60 $)", jahrLinkTitel: "Wyoming-Jahresbericht", jahrUrl: b.register.jahresUrl,
    raAnschrift: "",
  };
  return {
    schluessel: "florida", name: "Florida",
    registerName: "Sunbiz", registerErklaerung: "Sunbiz ist das Firmenregister von Florida.",
    sucheTitel: "Sunbiz-Namenssuche", sucheUrl: SUNBIZ_SUCHE,
    sucheText: "Sunbiz ist das Firmenregister von Florida. Suche den Namen. Ist er frei, setzt du die Station „Name geprüft“ auf erledigt.",
    articles: { wert: "Standard Articles", hinweis: "125 $ (Gebühr des Staats)" },
    staatGebuehr: "125 $", summe: "304 $", summeWarnung: "Andere Summe als 304 $? Dann nicht bezahlen — erst prüfen, was dazugekommen ist.",
    expressHinweis: null,
    membersHinweis: null,
    eintragungWann: "derzeit bis rund zwei Wochen",
    eintragungMara: "eingereicht; Florida trägt derzeit langsamer ein — oft rund zwei Wochen, die Gründungsunterlagen folgen danach",
    pruefenTitel: "Sunbiz täglich prüfen",
    pruefenText: "Schau jeden Tag bei Sunbiz, ob die Firma schon eingetragen ist. Florida braucht derzeit oft rund zwei Wochen, einen Express gibt es nicht.",
    jahrText: "Jedes Jahr: die Formulare 5472 und 1120 bis 15.04. (über TAXUSA). Der Jahresbericht in Florida zwischen 01.01. und 01.05. (über Northwest). Der Registered Agent verlängert sich von selbst. Hake ab, wenn die Fristen in der Akte stehen.",
    jahrFeld: "Jahresbericht Florida", jahrWert: "01.01.–01.05.", jahrLinkTitel: "Florida-Jahresbericht", jahrUrl: "https://services.sunbiz.org/Filings/AnnualReport/FilingStart",
    raAnschrift: ABLAUF_RA_ANSCHRIFT,
  };
}

// ── DIE 8 BLÖCKE ─────────────────────────────────────────────────────────────
/** Der Ablauf für den Staat der Gesellschaft (E-465). Schlüssel und Nummern sind in jedem Staat gleich. */
export function ablaufBloecke(staatRoh?: unknown): AblaufBlock[] {
  const S = ablaufStaat(staatRoh);
  return [
  {
    nr: 1, titel: "Geld ist bankbestätigt", wann: "Tag 0",
    text: "Erst wenn das Geld auf dem Konto ist (Airwallex) und die Zahlungsbestätigung raus ist, sprichst du mit dem Kunden.",
    schritte: [
      { nr: 1, key: "s01_zahlung", titel: "Zahlung buchen — Auftrag „gestartet“", wer: "buchhaltung", quelle: { art: "zahlung" },
        text: "Die Buchhaltung bucht den Eingang. Danach steht der Auftrag auf „gestartet“. Den Kunden informierst du erst danach.",
        links: [{ titel: "Geschäftskonto (Zubuchen)", pfad: "/chef/s/konto" }, { titel: "Zahlungsverwaltung", pfad: "/chef/s/zahlungen-verwalten" }],
        hinweise: [{ ton: "warnung", text: "Kein Kundenkontakt, bevor die Zahlungsbestätigung raus ist." }] },
      { nr: 2, key: "s02_akte", titel: "Akte vollständig, Portal freischalten", wer: "team", quelle: { art: "haken" },
        text: "Personendaten aus dem Vertrag übernehmen. Unterlagen in den Tresor (der Datei-Ordner der Akte) legen. Dann das neue Portal für den Kunden freischalten.",
        links: [{ titel: "Akte komplett", reiter: "akte" }, { titel: "Tresor", reiter: "tresor" }] },
      { nr: 3, key: "s03_name", titel: S.schluessel === "florida" ? "Name bei Sunbiz prüfen" : `Name im Register von ${S.name} prüfen`, wer: "team", quelle: { art: "station", schluessel: "name" },
        text: S.sucheText,
        felder: [{ feld: "Suchbegriff (ohne LLC)", wert: "{sunbizName}" }],
        links: [{ titel: S.sucheTitel, url: S.sucheUrl }] },
    ],
  },
  {
    nr: 2, titel: "Gründung beim Registered Agent", wann: "Tag 0 · ca. 10 Min.",
    text: "Registered Agent = die Firma, die für die LLC amtliche Post annimmt (Northwest). Du klickst, die Werte stehen hier. Die Gründung (Formation) bestellst du sofort nach dem Zahlungseingang. Das EIN-Formular erst, wenn Tätigkeit und „Einverstanden“ da sind.",
    schritte: [
      { nr: 4, key: "s04_bestellen", titel: "Neue Firma anlegen", wer: "du", quelle: { art: "haken" },
        text: "Im Northwest-Konto: Hire Us › Start a new business. Dann Bundesstaat, Rechtsform und Name wählen und „Add to Account“ klicken.",
        felder: [
          { feld: "Menü", wert: "Hire Us › Start a new business", kopieren: false },
          { feld: "State", wert: "{bundesstaat}" },
          { feld: "Entity type", wert: "LLC" },
          { feld: "Name (ohne Endung)", wert: "{nameOhneEndung}" },
          { feld: "Suffix", wert: "LLC" },
          { feld: "Dann", wert: "Add to Account", kopieren: false },
        ],
        links: [{ titel: "Northwest-Konto (Login)", url: "https://www.northwestregisteredagent.com/login" }, { titel: "Northwest-Startseite", url: "https://www.northwestregisteredagent.com/" }] },
      { nr: 5, key: "s05_paket", titel: "Paket wählen", wer: "du", quelle: { art: "haken" },
        text: "Wähle genau dieses Paket. „Standard Articles“ sind die normalen Gründungsunterlagen. Das Häkchen beim Registered Agent bleibt an.",
        felder: [
          { feld: "Paket", wert: "Business Formation Package Without SSN" },
          { feld: "Articles", wert: S.articles.wert, hinweis: S.articles.hinweis },
          { feld: "Registered Agent", wert: "Häkchen AN", kopieren: false },
          { feld: "Dann", wert: "Next", kopieren: false },
        ],
        ...(S.expressHinweis ? { hinweise: [{ ton: "info" as const, text: S.expressHinweis }] } : {}) },
      { nr: 6, key: "s06_cart", titel: "Warenkorb prüfen und bezahlen", wer: "du", quelle: { art: "haken" },
        text: "Prüfe jede Zeile im Warenkorb (Cart). Stimmt die Summe, gehst du zum Checkout und bezahlst. Buche nichts dazu.",
        felder: [
          { feld: "Formation Package", wert: "79 $", kopieren: false },
          { feld: "Registered Agent", wert: "frei (0 $)", kopieren: false },
          { feld: "EIN", wert: "100 $", kopieren: false },
          { feld: `Staat (${S.name})`, wert: S.staatGebuehr, kopieren: false },
          { feld: "Summe", wert: S.summe, kopieren: false },
        ],
        hinweise: [
          { ton: "warnung", text: S.summeWarnung },
          { ton: "info", text: "Nach dem Bezahlen öffnet Northwest zuerst das EIN-Formular. Fehlen US-Nummer, Tätigkeit oder „Einverstanden“: nichts eintragen, „Back to Filing Orders“ klicken und die Gründung (Schritt 8) öffnen. Bezahlt ist beides schon." },
        ] },
      { nr: 7, key: "s07_ein_formular", titel: "EIN-Formular ausfüllen", wer: "du", quelle: { art: "haken" }, braucht: ["v_taetigkeit", "v_einverstanden"], brauchtUsTelefon: true,
        text: "EIN = die Steuernummer der Firma. Erst ausfüllen, wenn drei Dinge da sind: US-Nummer (Schritt 12), Tätigkeit und „Einverstanden“ — dann in einem Rutsch, 3 Minuten. Responsible Party (die verantwortliche Person) ist der Kunde. Alle 5 Kästchen bleiben leer. Unterschreiben darfst du nur mit dem schriftlichen „Einverstanden“ des Kunden.",
        felder: [
          { feld: "Responsible Party", wert: "{kunde}", hinweis: "der Kunde selbst" },
          { feld: "First name", wert: "{vorname}" },
          { feld: "Last name", wert: "{nachname}" },
          { feld: "Kontakt-E-Mail", wert: "{kontaktMail}" },
          { feld: "Telefon (Kunde)", wert: "{telefon}" },
          { feld: "Wohnadresse (Kunde)", wert: "{wohnadresse}" },
          { feld: "ITIN", wert: "No" },
          { feld: "State", wert: "{bundesstaat}" },
          { feld: "Purpose", wert: "Tätigkeit des Kunden (Vorab-Satz)", kopieren: false, hinweis: "z. B. „Business consulting services“" },
          { feld: "Start Date", wert: "{heuteUs}", hinweis: "heute" },
          { feld: "Members", wert: "1" },
          { feld: "Firmen-Telefon", wert: "{usTelefon}", hinweis: "seine US-Nummer aus Schritt 12" },
          { feld: "Die 5 Kästchen", wert: "alle leer", kopieren: false },
          { feld: "Principal Address", wert: "Use our address" },
          { feld: "Mailing Address", wert: "Use our address" },
          { feld: "Unterschrift", wert: "nur mit „Einverstanden“ des Kunden", kopieren: false },
          { feld: "Dann", wert: "Save / Submit", kopieren: false },
        ],
        hinweise: [{ ton: "info", text: "Fehlt noch etwas davon? Dann mach erst Schritt 8 (Gründung) — das EIN-Formular kommt danach. Die EIN beantragt Northwest ohnehin erst nach der Eintragung, es geht kein Tag verloren." }] },
      { nr: 8, key: "s08_formation", titel: "Formation-Formular absenden", wer: "du", quelle: { art: "station", schluessel: "articles" },
        text: "Formation = die Gründung selbst. Fülle das Formular so aus und klicke „Submit“. Danach setzt du die Station „Gründung eingereicht“ auf erledigt.",
        felder: [
          { feld: "Effective Date", wert: "Upon Filing" },
          { feld: "Principal Address", wert: "Free Identity — use our address" },
          { feld: "Mailing Address", wert: "Same as Principal" },
          { feld: "Members on State Record", wert: "Yes" },
          { feld: "Management", wert: "Member Managed" },
          { feld: "Member", wert: "{kunde}", hinweis: "Individual (Privatperson)" },
          { feld: "Member-Adresse", wert: "Using Our Address" },
          { feld: "Attorney-Häkchen", wert: "AUS", kopieren: false },
          { feld: "Dann", wert: "Submit", kopieren: false },
        ],
        hinweise: [
          { ton: "warnung", text: `Meldung „may be unavailable“? Das ist nur eine Unschärfe der Suche. Prüfe den Namen vorher selbst bei ${S.registerName}.` },
          ...(S.membersHinweis ? [{ ton: "info" as const, text: `Members on State Record: ${S.membersHinweis}` }] : []),
        ],
        links: [{ titel: S.sucheTitel, url: S.sucheUrl }] },
    ],
  },
  {
    nr: 3, titel: "Direkt danach im System", wann: "Tag 0 · 5 Min.",
    schritte: [
      { nr: 9, key: "s09_agent_adresse", titel: "Stationen „Registered Agent“ und „US-Adresse“", wer: "team", quelle: { art: "agent_adresse" }, station: "agent",
        text: "Setze die Station „Registered Agent“ auf erledigt, mit Anschrift. Trage die US-Geschäftsadresse an der Station „US-Adresse und Telefonnummer“ ein. Der Kunde sieht beides sofort im Portal und im Fenster „Neu für Sie“.",
        felder: [
          { feld: "Anschrift Registered Agent", wert: S.raAnschrift || "{raAnschrift}", ...(S.raAnschrift ? {} : { hinweis: "steht nach der Bestellung im Northwest-Konto (Registered Agent)" }) },
          { feld: "US-Geschäftsadresse", wert: S.raAnschrift || "{raAnschrift}" },
        ] },
      { nr: 10, key: "s10_notiz", titel: "Akte-Notiz, CRM-Aufgabe, Wiedervorlage", wer: "team", quelle: { art: "haken" },
        text: "Notiz in die Akte: Rechnungsnummer und Betrag der Bestellung. Im Geschäftspartner-CRM eine Aufgabe „Eintragung prüfen“ in 5 Werktagen anlegen. Dazu die Wiedervorlage (Erinnerung im Kalender und in der Liste).",
        felder: [{ feld: "Aufgabe fällig", wert: "{plus5Werktage}", hinweis: "+5 Werktage" }],
        links: [{ titel: "Notiz schreiben (Verlauf)", reiter: "verlauf" }, { titel: "Geschäftspartner-CRM", pfad: "/chef/s/global-auftraege?reiter=partner" }] },
      { nr: 11, key: "s11_mara", titel: "Mara-Entwurf an den Kunden", wer: "team", quelle: { art: "haken" },
        text: `Mara schreibt einen Entwurf (gesiezt, im Faden des Kunden): ${S.eintragungMara} — ohne Zusage, der Staat entscheidet. Dazu seine US-Adresse. Fehlt noch das „Einverstanden“, bittet sie darum.`,
        links: [{ titel: "Anfragen (Faden)", reiter: "anfragen" }] },
    ],
  },
  {
    nr: 4, titel: "US-Nummer", wann: "Tag 0–1",
    schritte: [
      { nr: 12, key: "s12_tello", titel: "Tello-eSIM auf den Kunden", wer: "du", quelle: { art: "us_telefon" }, station: "adresse",
        text: "Am besten gleich am Tag 0 — das EIN-Formular (Schritt 7) braucht die Nummer. eSIM = eine Handy-Karte zum Herunterladen. Kaufe sie bei Tello auf den Namen des Kunden. Das QR-PDF legst du in den Tresor. Die Nummer trägst du an der Station „US-Adresse und Telefonnummer“ ein. Dann schreibt Mara einen Entwurf mit Anleitung.",
        felder: [{ feld: "Name auf der eSIM", wert: "{kunde}" }],
        links: [{ titel: "Tello", url: "https://tello.com" }, { titel: "Tresor", reiter: "tresor" }] },
    ],
  },
  {
    nr: 5, titel: "Eintragung", wann: S.eintragungWann,
    schritte: [
      { nr: 13, key: "s13_sunbiz_pruefen", titel: S.pruefenTitel, wer: "team", quelle: { art: "eintragung_warten" }, station: "eingetragen",
        text: S.pruefenText,
        links: [{ titel: S.sucheTitel, url: S.sucheUrl }],
        hinweise: [{ ton: "warnung", text: "Steht die Bestellung bei Northwest länger als 1 Werktag auf „Processing“? Dann schreib einen Entwurf an unsere Ansprechpartnerin dort: „please submit today“." }] },
      { nr: 14, key: "s14_eingetragen", titel: "Eingetragen: Articles in den Tresor", wer: "team", quelle: { art: "station", schluessel: "eingetragen" },
        text: "Articles of Organization = die Gründungsurkunde. Lade sie bei Northwest unter Documents herunter und lege sie in den Tresor (Art „Gründungsurkunde“). Setze die Station „eingetragen“ mit Document Number (Registernummer) und Datum.",
        links: [{ titel: "Tresor", reiter: "tresor" }] },
      { nr: 15, key: "s15_operating_agreement", titel: "Operating Agreement unterschreiben lassen", wer: "team", quelle: { art: "station", schluessel: "operating_agreement" },
        text: "Operating Agreement = der Gesellschaftsvertrag der LLC. Der Kunde unterschreibt ihn digital im Portal.",
        links: [{ titel: "Dokumente & Unterschriften", reiter: "unterschriften" }] },
    ],
  },
  {
    nr: 6, titel: "EIN", wann: "Fax oft rund 2 Wochen · Brief 4–5 Wochen später",
    schritte: [
      { nr: 16, key: "s16_ein", titel: "EIN-Brief in den Tresor", wer: "team", quelle: { art: "station", schluessel: "ein" },
        text: "Northwest beantragt die EIN von selbst (per Fax bei der Steuerbehörde IRS) — in jedem Staat gleich, erst nach der Eintragung. Die Nummer kommt derzeit oft nach rund zwei Wochen, der EIN-Brief vier bis fünf Wochen später. Kommt der EIN-Brief, legst du ihn in den Tresor (Art „EIN-Bestätigung“) und setzt die Station „EIN“.",
        hinweise: [{ ton: "info", text: `Eilt es (z. B. Konto für eine Finanzierung)? Antragsteller aus dem Ausland bekommen die EIN per Telefon noch im Gespräch: ${EIN_WEG.telefon}, ${EIN_WEG.telefonZeit}. Anrufen darf, wer für die Gesellschaft unterschreibt (der Kunde) oder als Designee im Formular SS-4 befugt ist.` }],
        links: [{ titel: "Tresor", reiter: "tresor" }] },
    ],
  },
  {
    nr: 7, titel: "Konto, Adresse, Steuern", wann: "Danach",
    schritte: [
      { nr: 17, key: "s17_konto", titel: "US-Geschäftskonto (Mercury)", wer: "team", quelle: { art: "station", schluessel: "konto" },
        text: "Das Geschäftskonto der LLC bei Mercury, mit Code-App zur Anmeldung. Eine private US-Adresse ist freiwillig: Die bucht der Kunde selbst über den Cloud-Residents-Link.",
        links: [{ titel: "Mercury", url: "https://mercury.com" }] },
      { nr: 18, key: "s18_rechnung", titel: "Erste US-Rechnung der LLC", wer: "team", quelle: { art: "haken" },
        text: "Die LLC schreibt ihre erste Rechnung. Das ist der Steuergrund für die ITIN (die persönliche US-Steuernummer)." },
      { nr: 19, key: "s19_itin", titel: "ITIN über TAXUSA", wer: "team", quelle: { art: "station", schluessel: "itin" },
        text: "TAXUSA macht die Steuerformulare. Ablauf: DPA (Vereinbarung mit TAXUSA) unterschreiben, Daten und Pass schicken, dann W-7 (ITIN-Antrag) zusammen mit der 1040-NR (Steuererklärung für Nicht-US-Bürger). Das geht ab Januar des Folgejahres. Die IRS braucht 9–11 Wochen.",
        felder: [
          { feld: "ITIN-Paket", wert: "699 $", kopieren: false },
          { feld: "1040-NR", wert: "677 $", kopieren: false },
          { feld: "5472 + 1120", wert: "547 $", kopieren: false, hinweis: "Jahresmeldung der LLC" },
          { feld: "8833", wert: "199 $", kopieren: false },
          { feld: "Wann", wert: "ITIN mit der 1040-NR, ab Januar des Folgejahres", kopieren: false },
          { feld: "Dauer IRS", wert: "9–11 Wochen", kopieren: false },
        ],
        links: [{ titel: "TAXUSA", url: "https://form5472.online" }, { titel: "IRS: ITIN", url: "https://www.irs.gov/individuals/individual-taxpayer-identification-number" }] },
      { nr: 20, key: "s20_jaehrlich", titel: "Jedes Jahr: Pflichten", wer: "team", quelle: { art: "haken" },
        text: S.jahrText,
        felder: [
          { feld: "5472 / 1120", wert: "bis 15.04.", kopieren: false },
          { feld: S.jahrFeld, wert: S.jahrWert, kopieren: false },
        ],
        links: [{ titel: "Fristen", reiter: "fristen" }, { titel: S.jahrLinkTitel, url: S.jahrUrl }, { titel: "TAXUSA", url: "https://form5472.online" }] },
    ],
  },
  ];
}
/** Die Florida-Fassung (Bestand und Rückfall) — Schlüssel und Nummern gelten für jeden Staat. */
export const ABLAUF_BLOECKE: AblaufBlock[] = ablaufBloecke("Florida");

export const ABLAUF_SCHRITTE: AblaufSchritt[] = ABLAUF_BLOECKE.flatMap((b) => b.schritte);

/** Alle Schlüssel, die von Hand abgehakt werden dürfen (Vorab + Schritte ohne Station). Die Route prüft dagegen. */
export const ABLAUF_HAKEN_KEYS: string[] = [
  ...ABLAUF_VORAB.map((v) => v.key),
  ...ABLAUF_SCHRITTE.filter((s) => s.quelle.art === "haken").map((s) => s.key),
];
export function ablaufHakenErlaubt(key: unknown): key is string {
  return typeof key === "string" && ABLAUF_HAKEN_KEYS.includes(key);
}
export function ablaufTitel(key: string): string {
  const s = ABLAUF_SCHRITTE.find((x) => x.key === key);
  if (s) return `Schritt ${s.nr} „${s.titel}“`;
  const v = ABLAUF_VORAB.find((x) => x.key === key);
  return v ? `Vorab „${v.titel}“` : key;
}

// ── WERTE JE KUNDE ───────────────────────────────────────────────────────────
export interface AblaufWerteEin {
  gesellschaftName?: string | null;
  bundesstaatName?: string | null;
  vorname?: string | null;
  nachname?: string | null;
  telefon?: string | null;
  wohnadresse?: string | null;
  usTelefon?: string | null;
  /** Für {heuteUs} und {plus5Werktage}. */
  jetzt?: Date;
  /** E-465: Anschrift des Registered Agent, wenn bekannt (sonst Florida-Anschrift bei Florida, sonst Leerstelle). */
  raAnschrift?: string | null;
}

/** „Müller-Lüdenscheidt" → „muellerluedenscheidt" — für js+<name>@fiaon.com. */
export function ablaufMailName(nachname: string | null | undefined): string {
  return String(nachname ?? "").toLowerCase()
    .replace(/ä/g, "ae").replace(/ö/g, "oe").replace(/ü/g, "ue").replace(/ß/g, "ss")
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]/g, "");
}

/** „Muster Holding LLC" / „Muster Holding, L.L.C." → „Muster Holding". */
export function ablaufNameOhneEndung(name: string | null | undefined): string {
  return String(name ?? "").trim().replace(/[,\s]+(L\.?\s?L\.?\s?C\.?|Limited Liability Company)\s*$/i, "").trim();
}

function berlinTag(d: Date): { j: number; m: number; t: number } {
  const teile = new Intl.DateTimeFormat("en-US", { timeZone: "Europe/Berlin", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(d);
  const n = (typ: string) => Number(teile.find((p) => p.type === typ)?.value ?? 0);
  return { j: n("year"), m: n("month"), t: n("day") };
}
const zwei = (n: number) => String(n).padStart(2, "0");

/** Heute + n Werktage (Mo–Fr), als TT.MM.JJJJ — Berliner Kalendertag. */
export function ablaufPlusWerktage(jetzt: Date, n: number): string {
  const { j, m, t } = berlinTag(jetzt);
  const d = new Date(Date.UTC(j, m - 1, t, 12));
  let rest = n;
  while (rest > 0) { d.setUTCDate(d.getUTCDate() + 1); const w = d.getUTCDay(); if (w !== 0 && w !== 6) rest--; }
  return `${zwei(d.getUTCDate())}.${zwei(d.getUTCMonth() + 1)}.${d.getUTCFullYear()}`;
}

/** Die Werte für die Platzhalter. Leerer String = unbekannt (die Seite zeigt eine Leerstelle). */
export function ablaufWerte(e: AblaufWerteEin): Record<string, string> {
  const jetzt = e.jetzt ?? new Date();
  const { j, m, t } = berlinTag(jetzt);
  const vorname = String(e.vorname ?? "").trim();
  const nachname = String(e.nachname ?? "").trim();
  const mailName = ablaufMailName(nachname);
  const gesellschaft = String(e.gesellschaftName ?? "").trim();
  const ohne = ablaufNameOhneEndung(gesellschaft);
  return {
    gesellschaft,
    nameOhneEndung: ohne,
    sunbizName: ohne,
    bundesstaat: String(e.bundesstaatName ?? "").trim() || "Florida",
    raAnschrift: String(e.raAnschrift ?? "").trim() || ablaufStaat(String(e.bundesstaatName ?? "").trim() || "Florida").raAnschrift,
    vorname, nachname,
    kunde: [vorname, nachname].filter(Boolean).join(" "),
    kontaktMail: mailName ? `js+${mailName}@fiaon.com` : "",
    telefon: String(e.telefon ?? "").trim(),
    wohnadresse: String(e.wohnadresse ?? "").trim().replace(/\s*\n\s*/g, ", "),
    usTelefon: String(e.usTelefon ?? "").trim(),
    heuteUs: `${zwei(m)}/${zwei(t)}/${j}`,
    plus5Werktage: ablaufPlusWerktage(jetzt, 5),
  };
}

export const ABLAUF_LEERSTELLE: Record<string, string> = {
  gesellschaft: "Name der Gesellschaft", nameOhneEndung: "Name ohne LLC", sunbizName: "Name ohne LLC", bundesstaat: "Bundesstaat",
  vorname: "Vorname", nachname: "Nachname", kunde: "Vor- und Nachname", kontaktMail: "js+nachname@fiaon.com",
  telefon: "Telefon des Kunden", wohnadresse: "Wohnadresse des Kunden", usTelefon: "US-Nummer (falls da)",
  heuteUs: "MM/TT/JJJJ", plus5Werktage: "heute + 5 Werktage", raAnschrift: "Anschrift aus dem Northwest-Konto",
};

/**
 * Setzt die Werte ein. `fehlt` = true, wenn mindestens ein Platzhalter leer blieb (dann kein Kopieren-Knopf).
 * Für URLs mit `url: true` — die Werte werden url-codiert.
 */
export function ablaufEinsetzen(vorlage: string, werte: Record<string, string> | null, opt: { url?: boolean } = {}): { text: string; fehlt: boolean } {
  let fehlt = false;
  const text = vorlage.replace(/\{(\w+)\}/g, (_, k: string) => {
    const w = werte?.[k] ?? "";
    if (!w) { fehlt = true; return opt.url ? "" : `‹${ABLAUF_LEERSTELLE[k] ?? k}›`; }
    return opt.url ? encodeURIComponent(w) : w;
  });
  return { text, fehlt };
}

// ── DER STAND JE SCHRITT ─────────────────────────────────────────────────────
export type AblaufZustand = "erledigt" | "in_arbeit" | "offen" | "wartet";
export interface AblaufHaken { am: string; von: string }
export interface AblaufStandEin {
  status: string;
  bezahltAm?: string | null;
  schritte: ReadonlyArray<{ schluessel?: unknown; status?: unknown; datum?: unknown }>;
  plus?: { usAdresse?: string | null; usTelefon?: string | null } | null;
  /** Dokumentarten im Tresor (ohne gelöschte und ohne „bitte neu"). */
  dokumentArten?: ReadonlyArray<string>;
  haken: Record<string, AblaufHaken | undefined>;
}
export interface AblaufSchrittStand {
  key: string; zustand: AblaufZustand; datum: string | null; von: string | null;
  /** Kurzer Satz, woher der Stand kommt. */
  quelle: string;
  /** Station (Fahrplan), die „Station öffnen" aufklappt. */
  station: string | null;
}
export interface AblaufStand {
  vorab: Record<string, { da: boolean; datum: string | null; von: string | null; ausTresor: boolean }>;
  schritte: AblaufSchrittStand[];
  erledigt: number; gesamt: number;
  /** Der nächste offene Schritt (wartende übersprungen), sonst null. */
  naechster: string | null;
}

const STATION_TEXT: Record<string, string> = { offen: "offen", in_arbeit: "in Arbeit", beantragt: "beantragt", erledigt: "erledigt", entfaellt: "entfällt" };

export function ablaufStand(e: AblaufStandEin): AblaufStand {
  const station = new Map(e.schritte.map((s) => [String(s.schluessel ?? ""), { status: String(s.status ?? "offen"), datum: s.datum ? String(s.datum) : null }]));
  const st = (k: string) => station.get(k) ?? { status: "offen", datum: null };
  const arten = new Set(e.dokumentArten ?? []);
  const vorab: AblaufStand["vorab"] = {};
  for (const v of ABLAUF_VORAB) {
    const h = e.haken[v.key];
    const ausTresor = !!v.dokumentArt && arten.has(v.dokumentArt);
    vorab[v.key] = { da: !!h || ausTresor, datum: h?.am ?? null, von: h?.von ?? null, ausTresor };
  }
  const bezahlt = ["bezahlt", "gestartet", "abgeschlossen"].includes(e.status);
  const schritte = ABLAUF_SCHRITTE.map((s): AblaufSchrittStand => {
    const q = s.quelle;
    let zustand: AblaufZustand = "offen"; let datum: string | null = null; let von: string | null = null; let quelle = "";
    let stationKey: string | null = s.station ?? null;
    if (q.art === "haken") {
      const h = e.haken[s.key];
      if (h) { zustand = "erledigt"; datum = h.am; von = h.von; }
      quelle = h ? "von Hand abgehakt" : "von Hand abhaken";
    } else if (q.art === "zahlung") {
      if (bezahlt) { zustand = "erledigt"; datum = e.bezahltAm ?? null; }
      quelle = bezahlt ? `Auftrag: ${e.status === "bezahlt" ? "bezahlt" : e.status}` : "Zahlung noch offen";
    } else if (q.art === "station") {
      stationKey = q.schluessel;
      const x = st(q.schluessel);
      zustand = x.status === "erledigt" || x.status === "entfaellt" ? "erledigt" : x.status === "in_arbeit" || x.status === "beantragt" ? "in_arbeit" : "offen";
      datum = x.datum; quelle = `Station: ${STATION_TEXT[x.status] ?? x.status}`;
    } else if (q.art === "agent_adresse") {
      const agent = st("agent"); const agentFertig = agent.status === "erledigt" || agent.status === "entfaellt";
      const adresse = !!String(e.plus?.usAdresse ?? "").trim();
      zustand = agentFertig && adresse ? "erledigt" : agentFertig || adresse || agent.status === "in_arbeit" ? "in_arbeit" : "offen";
      datum = agentFertig ? agent.datum : null;
      quelle = `Agent ${agentFertig ? "erledigt" : "offen"} · US-Adresse ${adresse ? "eingetragen" : "fehlt"}`;
    } else if (q.art === "us_telefon") {
      const tel = !!String(e.plus?.usTelefon ?? "").trim();
      zustand = tel ? "erledigt" : "offen";
      quelle = tel ? "US-Nummer eingetragen" : "US-Nummer fehlt";
    } else if (q.art === "eintragung_warten") {
      const ein = st("eingetragen"); const art = st("articles");
      if (ein.status === "erledigt" || ein.status === "entfaellt") { zustand = "erledigt"; datum = ein.datum; quelle = "eingetragen"; }
      else if (art.status === "erledigt") { zustand = "in_arbeit"; quelle = "Gründung eingereicht — warten"; }
      else quelle = "erst nach der Gründung";
    }
    const fehlt = [
      ...(s.braucht ?? []).filter((k) => !vorab[k]?.da).map((k) => ABLAUF_VORAB.find((v) => v.key === k)?.titel ?? k),
      ...(s.brauchtUsTelefon && !String(e.plus?.usTelefon ?? "").trim() ? ["US-Nummer (Schritt 12)"] : []),
    ];
    if (zustand !== "erledigt" && fehlt.length) { zustand = "wartet"; quelle = `wartet auf: ${fehlt.join(", ")}`; }
    return { key: s.key, zustand, datum, von, quelle, station: stationKey };
  });
  const erledigt = schritte.filter((s) => s.zustand === "erledigt").length;
  const naechster = schritte.find((s) => s.zustand === "in_arbeit" || s.zustand === "offen")?.key ?? null;
  return { vorab, schritte, erledigt, gesamt: schritte.length, naechster };
}
