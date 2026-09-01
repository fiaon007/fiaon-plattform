// ═══════════════════════════════════════════════════════════════════════════
// FIAON ACADEMY — DER LEHRPLAN (Gerüst) · 23.08.2026 · Plan §11
//
// Die Ausbildung zum Bonitätsmanager: zehn Kapitel, je Kapitel Schritte, am
// Ende die Abschlussprüfung. Hier steht nur das GERÜST — Schlüssel, Titel,
// Art und Mindestlesezeit je Schritt. Die Inhalte liegen in
// client/src/pages/agent/academy/kapitel-*.ts, der Prüfungspool im Server.
//
// Warum das Gerüst in shared/ liegt: Der Server misst die Lesezeit und schaltet
// Kapitel frei. Er muss wissen, welche Schritte es gibt und wie lange ein
// Schritt mindestens dauert — ohne den Inhalt zu kennen. Eine zweite Liste im
// Server wäre die zweite Wahrheit.
// ═══════════════════════════════════════════════════════════════════════════

/** Art eines Schritts. Text-Arten gelten nach Mindestlesezeit als gelesen,
 *  Übungs-Arten erst mit einem Ergebnis (Trainer, Simulator, Rechner, Fall …). */
export type SchrittArt =
  | "text" | "leitfaden" | "zeitleiste" | "rundgang" | "wortpruefer"
  | "einwand" | "simulator" | "rechner" | "uebung" | "fall" | "test";

export const UEBUNGS_ARTEN: ReadonlySet<SchrittArt> = new Set<SchrittArt>(["zeitleiste", "rundgang", "wortpruefer", "einwand", "simulator", "rechner", "uebung", "fall"]);

export interface LehrplanSchritt { key: string; titel: string; art: SchrittArt; /** Sekunden, die zwischen Öffnen und „Weiter“ mindestens vergehen müssen. */ minSekunden: number }
export interface LehrplanKapitel { key: string; nr: number; titel: string; untertitel: string; /** Geschätzte Dauer in Minuten (Lesen + Übungen). */ dauerMin: number; schritte: LehrplanSchritt[] }

/** Bestanden-Schwelle für Kapiteltests (Anteil richtiger Antworten). */
export const TEST_SCHWELLE = 0.8;
/** Bestanden-Schwelle für die Abschlussprüfung. */
export const PRUEFUNG_SCHWELLE = 0.85;
/** Fragen je Prüfungsdurchlauf. */
export const PRUEFUNG_FRAGEN = 25;
/** Sekunden je Prüfungsfrage. */
export const PRUEFUNG_SEKUNDEN_JE_FRAGE = 45;
/** Gesamtzeit der Prüfung in Sekunden. */
export const PRUEFUNG_SEKUNDEN_GESAMT = 20 * 60;
/** Wiederholung frühestens nach … Stunden. */
export const PRUEFUNG_SPERRE_STUNDEN = 24;
/** Höchstens … Versuche je sieben Tage. */
export const PRUEFUNG_VERSUCHE_JE_WOCHE = 3;
/** Provisionsaufschlag für zertifizierte Bonitätsmanager (Basis + 0,05). */
export const ZERTIFIKAT_PROVISIONS_BONUS = 0.05;
export const ZERTIFIKAT_STUFE = "Zertifizierter Bonitätsmanager";

const t = (key: string, titel: string, minSekunden: number, art: SchrittArt = "text"): LehrplanSchritt => ({ key, titel, art, minSekunden });
const test = (): LehrplanSchritt => ({ key: "test", titel: "Kapiteltest", art: "test", minSekunden: 0 });

export const LEHRPLAN: LehrplanKapitel[] = [
  { key: "fiaon", nr: 1, titel: "Was FIAON ist", untertitel: "Vision, Zielgruppe, was wir sind – und was wir nicht sind.", dauerMin: 50, schritte: [
    t("vision", "Bonität als Weg, nicht als Urteil", 120),
    t("drei-schichten", "Einsicht, Aktion, Zugang – die drei Schichten", 150),
    t("zielgruppe", "Wer zu uns kommt – und warum", 150),
    t("nicht", "Was FIAON nicht ist", 120),
    t("ton", "Marke und Ton: Kunden siezen, Kollegen duzen", 120),
    t("wortpruefer", "Übung: Der Wortwächter", 0, "wortpruefer"),
    t("team", "Wer bei FIAON was macht", 90),
    test(),
  ] },
  { key: "plattform", nr: 2, titel: "Die Plattform, Raum für Raum", untertitel: "Was der Kunde sieht, was du siehst, was im Hintergrund läuft.", dauerMin: 80, schritte: [
    t("antrag", "Die Antragsstrecke auf fiaon.com", 180),
    t("pakete", "Pakete und Preise – aus dem Katalog", 120),
    t("kundenbereich", "Der Kundenbereich: Mein Bereich", 180),
    t("rundgang", "Rundgang: Das Demo-Konto FIAON-DEMO", 0, "rundgang"),
    t("ratgeber", "Ratgeber und kostenlose Werkzeuge", 120),
    t("kontakt", "Kontakt, KI-Assistent, Dringend melden", 90),
    t("office", "Das Office: deine Räume", 180),
    t("hintergrund", "Was im Hintergrund passiert", 150),
    test(),
  ] },
  { key: "ablauf", nr: 3, titel: "Der Ablauf Tag für Tag", untertitel: "Vom Lead bis zur Auszahlung deiner Provision.", dauerMin: 70, schritte: [
    t("zeitleiste", "Die Zeitleiste: Lead → Kunde → Rate → Provision", 0, "zeitleiste"),
    t("lead-klassen", "Lead-Klassen A, B, C", 150),
    t("zahlung", "Zahlung: Überweisung, Lastschrift, Kontoabgleich", 150),
    t("startgespraech", "Das Startgespräch – die Agenda", 180),
    t("raten", "Raten und der Zahlungsmotor", 150),
    t("provision", "Deine Provision: 25 % jeder bezahlten Rate", 150),
    test(),
  ] },
  { key: "recht", nr: 4, titel: "Rechtswissen – Grundlagen", untertitel: "DSGVO, § 31 BDSG, Fristen, Inkasso – mit den Rechnern.", dauerMin: 120, schritte: [
    t("dsgvo", "Deine Rechte-Landkarte: Art. 15, 16, 17, 21, 22, 77, 82 DSGVO", 210),
    t("bdsg31", "§ 31 BDSG: Wann eine Forderung gemeldet werden darf", 180),
    t("loeschfristen", "Löschfristen: 3 Jahre, 18 Monate, 6 Monate, 12 Monate", 180),
    t("rechner-loeschfrist", "Rechner: Löschfrist", 0, "rechner"),
    t("verjaehrung", "Verjährung: 3 Jahre ab Jahresende, 30 Jahre mit Titel", 150),
    t("rechner-verjaehrung", "Rechner: Verjährung", 0, "rechner"),
    t("inkasso", "Inkasso: Kosten, Grenzen, Pflichten", 180),
    t("rechner-inkassokosten", "Rechner: Inkassokosten", 0, "rechner"),
    t("basiskonto", "Basiskonto: ein Rechtsanspruch", 90),
    t("grenze", "Die Grenze: Fakten erklären, nicht beraten", 150),
    test(),
  ] },
  { key: "gespraech", nr: 5, titel: "Das Gespräch", untertitel: "Leitfäden, Einwände, Wortregeln – und ein Simulator.", dauerMin: 180, schritte: [
    t("haltung", "Grundhaltung: Wir sprechen mit Menschen", 120),
    t("stufe-a", "Leitfaden Stufe A: „Ich habe bezahlt“ – Willkommen, Karte, Termin", 180, "leitfaden"),
    t("stufe-b", "Leitfaden Stufe B: Antrag fertig, nicht bezahlt", 180, "leitfaden"),
    t("stufe-c", "Leitfaden Stufe C: Facebook-Lead – Vertrag am Telefon", 210, "leitfaden"),
    t("rueckruf", "Leitfaden: Der Rückruf", 150, "leitfaden"),
    t("startgespraech", "Leitfaden: Das Startgespräch", 180, "leitfaden"),
    t("zahlungserinnerung", "Leitfaden: Die Reaktivierung – weich, mit Entschuldigung", 180, "leitfaden"),
    t("wortregeln", "Wortregeln im Gespräch", 120),
    t("einwand", "Einwand-Trainer", 0, "einwand"),
    t("simulator", "Anruf-Simulator: Sprich mit einem KI-Kunden", 0, "simulator"),
    test(),
  ] },
  { key: "schufa", nr: 6, titel: "SCHUFA – Deutschland", untertitel: "Wie die Auskunftei arbeitet, was rechtswidrig ist, wie man es angreift.", dauerMin: 150, schritte: [
    t("wer", "Wer die SCHUFA ist", 180),
    t("daten", "Woher die Daten kommen", 180),
    t("score", "Das Score-Verfahren: Basisscore, Branchenscores", 210),
    t("eugh", "7. Dezember 2023: Zwei Urteile aus Luxemburg", 210),
    t("fristen", "Die Verhaltensregeln: Lösch- und Prüffristen", 210),
    t("rechtswidrig", "Was rechtswidrig ist – und warum", 240),
    t("wege", "Widerspruch und Löschung, Schritt für Schritt", 240),
    t("insider", "Insider-Wissen mit Quelle", 180),
    t("sagen", "Was ich dem Kunden sage – und was ich nie sage", 120),
    test(),
  ] },
  { key: "oesterreich", nr: 7, titel: "Österreich – KSV1870 und CRIF", untertitel: "Zwei Auskunfteien, die Warnliste der Banken, österreichisches Recht.", dauerMin: 80, schritte: [
    t("system", "Das System in Österreich", 150),
    t("ksv", "KSV1870: der Kreditschutzverband", 180),
    t("crif", "CRIF und die Warnliste der Banken", 150),
    t("rechte", "Deine Rechte-Landkarte für Österreich", 180),
    t("wege", "Richtigstellung und Löschung in Österreich", 180),
    t("sagen", "Was ich dem Kunden sage – und was ich nie sage", 120),
    test(),
  ] },
  { key: "schweiz", nr: 8, titel: "Schweiz – Betreibungsregister, CRIF, Intrum", untertitel: "Das Amt am Wohnort ist der größte Hebel.", dauerMin: 80, schritte: [
    t("system", "Das System in der Schweiz", 150),
    t("betreibung", "Das Betreibungsregister: Zahlungsbefehl, Rechtsvorschlag, Auszug", 210),
    t("crif-intrum", "CRIF und Intrum", 150),
    t("rechte", "Deine Rechte-Landkarte für die Schweiz (DSG 2023)", 180),
    t("wege", "Nichtbekanntgabe, Rückzug, Berichtigung", 180),
    t("sagen", "Was ich dem Kunden sage – und was ich nie sage", 120),
    test(),
  ] },
  { key: "werkzeuge", nr: 9, titel: "Werkzeuge des Mitarbeiters", untertitel: "Pipeline, Akte, Calendar, Wallet, Tickets – mit geführten Übungen im Office.", dauerMin: 90, schritte: [
    t("pipeline", "Übung: Die Pipeline lesen", 0, "uebung"),
    t("akte", "Übung: Eine Akte führen", 0, "uebung"),
    t("calendar", "Übung: Calendar und Availability", 0, "uebung"),
    t("wallet", "Übung: Wallet und Earnings verstehen", 0, "uebung"),
    t("tickets", "Übung: Tickets und Inbox", 0, "uebung"),
    t("softphone", "Das Telefon im Office", 150),
    test(),
  ] },
  { key: "situationen", nr: 10, titel: "Reale Situationen", untertitel: "Fälle aus echten Akten – du entscheidest, dann kommt die Auflösung.", dauerMin: 80, schritte: [
    t("fall-1", "Fall 1: 79,99 € statt 74 €", 0, "fall"),
    t("fall-2", "Fall 2: „Ich will kündigen.“", 0, "fall"),
    t("fall-3", "Fall 3: Zwei Anträge, ein Mensch", 0, "fall"),
    t("fall-4", "Fall 4: „Ich habe überwiesen.“", 0, "fall"),
    t("fall-5", "Fall 5: Rate 14 Tage offen", 0, "fall"),
    t("fall-6", "Fall 6: „Können Sie mir den Eintrag garantiert löschen?“", 0, "fall"),
    t("fall-7", "Fall 7: Der Inkassobrief mit 210 €", 0, "fall"),
    t("fall-8", "Fall 8: „Ich dachte, das war einmalig.“", 0, "fall"),
    t("fall-9", "Fall 9: Restschuldbefreiung vor zwei Jahren", 0, "fall"),
    t("fall-10", "Fall 10: Kunde aus Wien", 0, "fall"),
    t("fall-11", "Fall 11: Der Kunde, der lange gewartet hat", 0, "fall"),
    test(),
  ] },
];

export function lehrplanKapitel(key: string): LehrplanKapitel | null { return LEHRPLAN.find((k) => k.key === key) ?? null; }
export function lehrplanSchritt(kapitel: string, schritt: string): LehrplanSchritt | null { return lehrplanKapitel(kapitel)?.schritte.find((s) => s.key === schritt) ?? null; }
/** Alle Schritte ohne die Tests — das ist die Grundlage für den Prozentwert. */
export const SCHRITTE_GESAMT = LEHRPLAN.reduce((n, k) => n + k.schritte.length, 0);
