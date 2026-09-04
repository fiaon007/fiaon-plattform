// ═══════════════════════════════════════════════════════════════════════════
// POSTMEISTER v2 — die gemeinsamen Begriffe (02.09.2026, E-094)
//
// Diese Datei ist der Vertrag zwischen Server und Zentrale. Sie enthält KEINE
// Logik, die Geld bewegt, und keine Datenbankzugriffe — nur die Wörter, mit
// denen beide Seiten dasselbe meinen.
//
// DIE WICHTIGSTE ENTSCHEIDUNG STEHT HIER: Nicht die KI entscheidet, was ein
// Kunde bekommt, sondern seine LAGE. Die Lage rechnet der Server aus der Akte
// aus; sie bestimmt, welche Werkzeuge es überhaupt gibt und welcher nächste
// Schritt erlaubt ist. Ein Modell kann eine Kategorie erfinden — eine Lage
// nicht.
// ═══════════════════════════════════════════════════════════════════════════

/** Wo der Kunde gerade steht. Aus der Akte gerechnet, nie vom Modell gesetzt. */
export type Kundenlage =
  | "interessent"                 // kein Antrag, nur Interesse
  | "unbezahlt"                   // Antrag da, nichts bezahlt
  | "zahlung_gemeldet"            // sagt bezahlt zu haben, kein Geldeingang
  | "bezahlt_ohne_startgespraech" // bezahlt, Bereich wartet auf das Gespräch
  | "aktiv"                       // bezahlt, läuft, nichts überfällig
  | "rate_ueberfaellig"           // bezahlt, Rate offen und überfällig
  | "gekuendigt"                  // gekündigt, letzte Rate ggf. offen
  | "bestreitet"                  // bestreitet Bestellung/Forderung, widerruft
  | "gesperrt"                    // Werbesperre, DSGVO-Löschung, Kontosperre
  | "fremd"                       // kein Kunde (Bewerbung, Investor, Lieferant)
  | "unklar";                     // Person nicht sicher zuzuordnen

export const KUNDENLAGE_TEXT: Record<Kundenlage, string> = {
  interessent: "Interessent ohne Antrag",
  unbezahlt: "Antrag offen, noch nichts bezahlt",
  zahlung_gemeldet: "Zahlung gemeldet, Geld noch nicht da",
  bezahlt_ohne_startgespraech: "Bezahlt, wartet auf das Startgespräch",
  aktiv: "Aktiver Kunde",
  rate_ueberfaellig: "Rate überfällig",
  gekuendigt: "Gekündigt",
  bestreitet: "Bestreitet die Bestellung oder Forderung",
  gesperrt: "Gesperrt (Werbestopp, Löschung oder Kontosperre)",
  fremd: "Kein Kunde",
  unklar: "Person nicht sicher zuzuordnen",
};

/** Was am Ende einer Antwort stehen darf — genau eines davon. */
export type SchrittArt =
  | "zahlung"          // Zahlungsseite mit QR und Bankdaten
  | "termin"           // Terminlink zum Gespräch
  | "startgespraech"   // Einladung zum Startgespräch
  | "rueckruf"         // „Ihre Betreuerin ruft Sie an" (nur mit eingeplantem Rückruf)
  | "bereich"          // Link in den Kundenbereich (nur wenn freigeschaltet)
  | "unterlagen"       // Upload-Weg
  | "antrag"           // Antragsstrecke (Interessenten)
  | "angebot"          // Bonitätsauskunft, Lastschrift, Upgrade
  | "erledigt"         // nichts zu tun (Stopp gesetzt, Kündigung vermerkt)
  | "wartet_auf_uns";  // wir melden uns (nur mit Aufgabe im System)

/**
 * Was in welcher Lage erlaubt ist. Die Reihenfolge ist die Rangfolge: Was
 * vorne steht, ist der beste nächste Schritt.
 *
 * WARUM ALS TABELLE UND NICHT IM PROMPT: Ein Prompt ist eine Bitte. Diese
 * Tabelle ist eine Wand — der Server prüft die Antwort dagegen. Sechs
 * Automatenantworten haben unbezahlte Kunden in einen Kundenbereich
 * geschickt, den sie gar nicht öffnen können (Analyse 02.09.).
 */
// 04.09.2026 (E-119): „rueckruf" in allen Lagen erlaubt — ein Rückruf ist überall
// ein ehrlicher nächster Schritt; vorher wich das Modell auf „termin" ohne Adresse aus.
export const ERLAUBTE_SCHRITTE: Record<Kundenlage, SchrittArt[]> = {
  interessent: ["antrag", "termin", "rueckruf"],
  unbezahlt: ["zahlung", "termin", "rueckruf", "erledigt"],
  zahlung_gemeldet: ["zahlung", "rueckruf", "wartet_auf_uns", "erledigt"],
  bezahlt_ohne_startgespraech: ["startgespraech", "termin", "bereich", "rueckruf"],
  aktiv: ["bereich", "unterlagen", "termin", "angebot", "rueckruf", "erledigt"],
  rate_ueberfaellig: ["zahlung", "termin", "rueckruf"],
  gekuendigt: ["zahlung", "termin", "rueckruf", "erledigt"],
  bestreitet: ["rueckruf", "wartet_auf_uns"],
  gesperrt: ["erledigt"],
  fremd: ["erledigt", "wartet_auf_uns"],
  unklar: ["rueckruf", "wartet_auf_uns"],
};

/** Lagen, in denen ein Automat überhaupt selbst senden darf (Rest: Entwurf). */
export const AUTO_LAGEN: Kundenlage[] = [
  "interessent", "unbezahlt", "zahlung_gemeldet", "bezahlt_ohne_startgespraech", "aktiv",
  // 04.09.2026 (E-115, Justin: „der Agent soll vollständig einen Mitarbeiter
  // ersetzen"): Ratenrückstand ist der häufigste Fall im Postfach. Gedeckt durch
  // Belegpflicht, Einzugsschutz, Kontowechsel-Riegel und die Flags — jede
  // Beschwerde, jedes Bestreiten, jede Kündigung bleibt Entwurf.
  "rate_ueberfaellig",
];

/** Was der Kunde will — mehrere gleichzeitig sind erlaubt. */
export const KATEGORIEN = [
  "zahlung", "zugang_login", "termin", "unterlagen", "status_frage", "neuinteresse",
  "vertrieb_komplex", "kuendigung", "beschwerde", "rechtlich", "abmeldung",
  "werbung_newsletter", "intern", "sonstiges",
] as const;
export type Kategorie = typeof KATEGORIEN[number];

/** Warnlampen. Jede einzelne verhindert den Auto-Versand. */
export interface Flags {
  kuendigung: boolean;
  bestreitet: boolean;
  widerruf: boolean;
  beschwerde: boolean;
  rechtlich: boolean;
  stopp: boolean;
  zahlung_behauptet: boolean;
  rueckruf_wunsch: boolean;
  droht_anwalt: boolean;
  zahlungsunfaehig: boolean;
}
export const LEERE_FLAGS: Flags = {
  kuendigung: false, bestreitet: false, widerruf: false, beschwerde: false, rechtlich: false,
  stopp: false, zahlung_behauptet: false, rueckruf_wunsch: false, droht_anwalt: false, zahlungsunfaehig: false,
};

/** Was mit einer Mail geschah. */
export type Aktion =
  | "entwurf"          // Antwort liegt als Gmail-Entwurf und in der Werkbank
  | "gesendet"         // aus der Werkbank freigegeben
  | "auto_beantwortet" // vom Automaten gesendet
  | "geordnet"         // eingeordnet, keine Antwort nötig
  | "ignoriert"        // Automat/Lieferant/eigene Post — nie beantworten
  | "vorgeordnet"      // nur geordnet (Aufhol-Phase 1), wird noch beantwortet
  | "fehler";          // technisch gescheitert, wird wiederholt

/**
 * Absender, die NIE eine Antwort bekommen. Geprüft wird der Host nach dem
 * letzten @ — exakt oder als Subdomain, niemals als Teilstring: sonst sperrt
 * „google" auch „mail.google-partner-beratung.de" (Fund der Prüfer 02.09.).
 */
export const AUTOMATEN_DOMAENEN = [
  "stripe.com", "airwallex.com", "gocardless.com", "amazon.de", "amazon.com", "amazonses.com",
  "dhl.de", "dpd.de", "gls-group.eu", "hermesworld.com", "ups.com", "deutschepost.de",
  "brevo.com", "sendinblue.com", "make.com", "integromat.com", "google.com", "googlemail.com",
  "twilio.com", "render.com", "paypal.com", "paypal.de", "klarna.com", "sumup.com",
  "notify.microsoft.com", "atlassian.net", "github.com", "openai.com", "anthropic.com",
  "linkedin.com", "xing.com", "facebook.com", "meta.com", "tiktok.com", "docusign.net",
] as const;

/** Ein Beleg: dieser Satz stützt sich auf dieses Feld dieses Werkzeugs. */
export interface Beleg { satz: string; werkzeug: string; feld: string; wert?: string | null }

/** Der nächste Schritt — genau einer je Antwort. */
export interface NaechsterSchritt { art: SchrittArt; url: string | null; text: string }

/** Eine Zeile in der Postfach-Ansicht. */
export interface PostfachZeile {
  id: number;
  postfach: string;
  threadId: string;
  von: string;
  vonName: string;
  betreff: string;
  empfangenAm: string;
  /** Klartext der letzten Kundennachricht, ohne zitierte Vorgeschichte. */
  text: string;
  zusammenfassung: string | null;
  kategorien: Kategorie[];
  flags: Flags;
  kundenlage: Kundenlage | null;
  dringend: boolean;
  aktion: Aktion;
  personId: number | null;
  ref: string | null;
  kundeName: string | null;
  betreuer: string | null;
  antwort: string | null;
  antwortHtml: string | null;
  belege: Beleg[];
  handlungen: { werkzeug: string; ergebnis: string; am: string }[];
  naechsterSchritt: NaechsterSchritt | null;
  gesendetAm: string | null;
  entwurfGeprueftAm: string | null;
  nachrichtenImThread: number;
}

/** Die Akte, wie die Zentrale sie neben der Mail zeigt. */
export interface AkteKurz {
  personId: number | null;
  name: string | null;
  anrede: string | null;
  /** Sprachvermerk aus der Akte (02.09.2026) — von Hand gesetzt, ISO-Kürzel. */
  sprache: string | null;
  /** Der Freitext daneben: „versteht mündlich, aber nicht schriftlich". */
  spracheNotiz: string | null;
  email: string | null;
  telefon: string | null;
  betreuer: string | null;
  kundenlage: Kundenlage;
  lageGrund: string;
  bestellungen: { ref: string; paket: string | null; status: string; betrag: string | null; referenz: string | null; angelegt: string | null }[];
  raten: { nr: number; betrag: string; status: string; faellig: string | null; bezahlt: string | null; mahnstufe: number | null; referenz: string | null }[];
  termine: { beginn: string; status: string; betreuer: string | null; art: string | null }[];
  verlauf: { am: string; art: string; wer: string | null; text: string }[];
  mails: { am: string; richtung: "ein" | "aus"; betreff: string; kurz: string | null }[];
  kuendigung: { am: string | null; letzteRate: number | null; vertragEnde: string | null } | null;
  sperren: { werbung: string | null; anrufe: boolean; konto: string | null };
  offeneAufgaben: number;
}

/** Antwort der Postfach-Liste. */
export interface PostfachAntwort {
  ok: boolean;
  zeilen: PostfachZeile[];
  gesamt: number;
  cursor: string | null;
  zaehler: Record<string, number>;
}
