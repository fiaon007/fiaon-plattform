// ═══════════════════════════════════════════════════════════════════════════
// TERMINE IM EIGENEN KALENDER — FORM UND SÄTZE (29.09.2026, E-263)
//
// Eine Stelle für die Sätze, die an vier Orten stehen: Einrichtungsseite
// /kalender/<token> (Server-HTML), Mitarbeiter-Blatt im Calendar, Chef-Karte im
// Mara-Steuerpult und die Termin-Mail. Vier Fassungen würden auseinanderlaufen
// — und dann verspricht die Mail etwas anderes als die Seite.
//
// EHRLICH (Bauplan E-263 §0): Ein Abo holt jede Kalender-App SELBST ab, in
// ihrem eigenen Takt. Apple (iPhone/Mac) nach Minuten, Google nur alle paar
// Stunden — nicht einstellbar.
//
// ABO ODER KNOPF, NIE BEIDES (Gegenprüfung 29.09.2026): Ein abonnierter Kalender
// ist ein eigener Kalender. Trägt man denselben Termin zusätzlich über den Knopf
// in der Mail ein, steht er zweimal da — Apple und Google führen über
// Kalendergrenzen nichts zusammen. Deshalb: Läuft das Abo, zeigt die Mail keine
// Einzelknöpfe mehr, und kein Satz empfiehlt sie „für heute".
// ═══════════════════════════════════════════════════════════════════════════

export type KalenderAboUmfang = "eigene" | "team";
/** Wer zuletzt abgerufen hat — aus dem User-Agent abgeleitet, nie der User-Agent selbst. */
export type KalenderClient = "apple" | "google" | "outlook" | "andere";

export interface KalenderAboLinks {
  /** Die Einrichtungsseite (https) — der Weg aus Mails und zum Weitergeben an sich selbst. */
  seite: string;
  /** webcal://…/kalender/<token>.ics — iPhone und Mac öffnen damit „Abonnieren". */
  webcal: string;
  /** Google „per URL hinzufügen" (calendar.google.com/calendar/r?cid=webcal://…). */
  google: string;
  /** Die Abo-Adresse als https — für Outlook und alles andere („Link kopieren"). */
  ics: string;
}

export interface KalenderAboSicht {
  umfang: KalenderAboUmfang;
  links: KalenderAboLinks;
  erstelltAm: string;
  zuletztAbgerufenAm: string | null;
  abrufe: number;
  client: KalenderClient | null;
  /** Abruf in den letzten 48 Stunden — dann „aktiv". */
  aktiv: boolean;
}

/** Ab wann ein Abo als „aktiv" gilt: zuletzt abgerufen vor höchstens … Stunden. */
export const KALENDER_ABO_AKTIV_STUNDEN = 48;

export const KALENDER_CLIENT_TEXT: Record<KalenderClient, string> = {
  apple: "Apple Kalender",
  google: "Google Kalender",
  outlook: "Outlook",
  andere: "einer Kalender-App",
};

export const KALENDER_TEXT = {
  /** Der ehrliche Satz zum Tempo — Seite, Blatt, Karte, Rundgang. */
  tempo: "Apple (iPhone, Mac) holt neue Termine nach Minuten ab. Google holt ein Abo nur alle paar Stunden "
    + "(typisch 8 bis 24) — das lässt sich nicht einstellen. Was gerade ansteht, zeigt immer das Portal (Calendar).",
  /** Abo und Mail-Knopf schließen sich aus (siehe oben). */
  nichtDoppelt: "Mit Abo bitte keinen Termin zusätzlich über den Knopf in der Termin-Mail eintragen — sonst steht er doppelt.",
  /** Was NICHT im Kalender steht (Datensparsamkeit, E-263). */
  ohne: "Im Kalender stehen Name, Uhrzeit, Art und der Link zur Akte — keine Telefonnummer, keine Notiz, keine Beträge. "
    + "Angerufen wird über das FIAON-Telefon in der Akte.",
  /** Apple: ohne diese Einstellung kein Alarm 10 Minuten vorher. */
  apple: "Beim Abonnieren auf dem iPhone „Hinweise entfernen“ AUS lassen — sonst meldet sich der Termin nicht 10 Minuten vorher.",
  /**
   * Google übernimmt Erinnerungen aus einem abonnierten Kalender nicht; Benachrichtigungen für „Weitere
   * Kalender" sind aus, bis man sie je Kalender einstellt (Gegenprüfung 29.09.2026 — am Gerät noch zu prüfen).
   */
  googleWecker: "Google übernimmt die Erinnerung aus einem Abo nicht: Beim FIAON-Kalender einmal unter Einstellungen → "
    + "Benachrichtigungen „10 Minuten vorher“ setzen.",
  /** Google am Handy kann keine Abos anlegen. */
  googleHandy: "Google: einmal am Computer hinzufügen (die Google-App am Handy kann keine Abos anlegen) — danach steht es auch auf dem Handy.",
  /** Der Link ist persönlich. */
  persoenlich: "Der Link ist persönlich: Wer ihn hat, sieht die Termine. Neuer Link = der alte hört sofort auf.",
  /**
   * Bestätigung vor „Neuen Link erzeugen". Ein toter Link liefert einen LEEREN Kalender (keine 404):
   * Eine Kalender-App behält bei einem Abruffehler den letzten Stand eingefroren — bei einem leeren
   * Kalender leert sie sich wirklich. Das alte Abo bleibt dann als leerer Kalender stehen.
   */
  neuFrage: "Der alte Link hört sofort auf — ein Kalender, der ihn abonniert hat, wird beim nächsten Abruf leer "
    + "(Apple nach Minuten, Google nach Stunden). Danach mit dem neuen Link einmal neu abonnieren und das alte, leere Abo im Kalender löschen.",
  /** Bestätigung vor „Abo beenden". */
  endeFrage: "Der Link hört sofort auf. Beim nächsten Abruf wird der FIAON-Kalender leer (Apple nach Minuten, Google nach Stunden) "
    + "— danach kannst du ihn im Kalender löschen.",
  /** Der Satz in der Termin-Mail, wenn das Abo läuft. */
  mailAktiv: "Dein Kalender-Abo ist aktiv — dieser Termin kommt von selbst (Apple in Minuten, Google kann Stunden brauchen). "
    + "Bitte nicht zusätzlich eintragen, sonst steht er doppelt.",
  /** Google dedupliziert nicht. */
  googleEinmal: "Google: bitte nur einmal klicken — jeder Klick legt einen eigenen Eintrag an.",
  /** Chef: zwei Abos, jeder Termin genau einmal. */
  chefBeide: "Für alle Termine beide abonnieren: „Meine Termine“ und „Termine des Teams“ überschneiden sich nicht — jeder Termin steht genau einmal im Kalender.",
} as const;

/** Klasse aus dem User-Agent. `null` = ein Browser (kein Kalender-Abruf, zählt nicht). */
export function kalenderClientAus(userAgent: string | null | undefined): KalenderClient | null {
  const ua = String(userAgent ?? "");
  if (/Google-Calendar-Importer|Google-Calendar|GoogleCalendar/i.test(ua)) return "google";
  if (/dataaccessd|CalendarAgent|iOS\/\d|macOS\/\d|Mac OS X\/\d|iCal\//i.test(ua)) return "apple";
  if (/Microsoft Outlook|Outlook-iOS|Outlook-Android|Microsoft Office|Exchange/i.test(ua)) return "outlook";
  // Ein gewöhnlicher Browser, der die .ics-Datei öffnet, ist kein Abo — er soll „aktiv" nicht vortäuschen.
  if (/Mozilla\//.test(ua) && !/Thunderbird|Evolution|DAVx|Lightning/i.test(ua)) return null;
  return "andere";
}

/** „vor 12 Min.", „vor 3 Std.", „vor 2 Tagen". */
export function vorWann(iso: string, jetzt: Date = new Date()): string {
  const min = Math.max(0, Math.round((jetzt.getTime() - new Date(iso).getTime()) / 60_000));
  if (min < 1) return "gerade eben";
  if (min < 60) return `vor ${min} Min.`;
  const std = Math.round(min / 60);
  if (std < 48) return `vor ${std} Std.`;
  return `vor ${Math.round(std / 24)} Tagen`;
}

/** Der Zustand in einem Satz: „Aktiv — zuletzt abgerufen vor 12 Min. von Apple Kalender. Du musst nichts tun." */
export function kalenderZustandSatz(s: Pick<KalenderAboSicht, "aktiv" | "zuletztAbgerufenAm" | "client">, jetzt: Date = new Date()): string {
  if (!s.zuletztAbgerufenAm) return "Noch nicht abonniert — noch kein Kalender hat diesen Link abgerufen.";
  const von = s.client ? ` von ${KALENDER_CLIENT_TEXT[s.client]}` : "";
  if (s.aktiv) return `Aktiv — zuletzt abgerufen ${vorWann(s.zuletztAbgerufenAm, jetzt)}${von}. Du musst nichts tun.`;
  return `Seit ${vorWann(s.zuletztAbgerufenAm, jetzt).replace(/^vor /, "")} nicht mehr abgerufen${von} — ist das Abo im Kalender noch da?`;
}
