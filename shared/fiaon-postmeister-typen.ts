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
  | "angebot"          // Upgrade (die Bonitätsauskunft hat seit E-240 ihren eigenen Schritt)
  // 24.09.2026 (E-240): Der Knopf der Bonitätsauskunft — NUR mit der Adresse aus
  // auskunft_anbieten (Kauflink zur Bestätigungsseite oder Zahlungsseite einer
  // schon offenen Bestellung). Vorher lief die Auskunft über „angebot" mit der
  // Vorgabe /antrag: ein zahlender Kunde landete im Antrag für Neukunden.
  | "auskunft"
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
// 24.09.2026 (E-240): „auskunft" nur, wo ein Paket gebucht ist und Geld fließt
// (gemeldet, bezahlt, aktiv, Rate offen). NICHT bei „unbezahlt": Wer die erste
// Rate noch nicht gezahlt hat, bekommt kein zweites Produkt vor das erste
// gestellt. Bei rate_ueberfaellig bleibt die offene Rate ein Satz derselben Mail
// (Prüfung in pruefenUndAbschliessen), der Knopf gehört dann der Auskunft.
export const ERLAUBTE_SCHRITTE: Record<Kundenlage, SchrittArt[]> = {
  interessent: ["antrag", "termin", "rueckruf"],
  unbezahlt: ["zahlung", "termin", "rueckruf", "erledigt"],
  zahlung_gemeldet: ["zahlung", "auskunft", "rueckruf", "wartet_auf_uns", "erledigt"],
  bezahlt_ohne_startgespraech: ["startgespraech", "auskunft", "termin", "bereich", "rueckruf"],
  aktiv: ["bereich", "auskunft", "unterlagen", "termin", "angebot", "rueckruf", "erledigt"],
  rate_ueberfaellig: ["zahlung", "auskunft", "termin", "rueckruf"],
  gekuendigt: ["zahlung", "termin", "rueckruf", "erledigt"],
  bestreitet: ["rueckruf", "wartet_auf_uns"],
  gesperrt: ["erledigt"],
  fremd: ["erledigt", "wartet_auf_uns"],
  unklar: ["rueckruf", "wartet_auf_uns"],
};

/**
 * In welchen Lagen Mara die Bonitätsauskunft anbieten darf — abgeleitet aus
 * der Tabelle oben, damit Werkzeug (auskunft_anbieten), Prüfung und Prompt
 * nie zwei verschiedene Listen führen (24.09.2026, E-240).
 */
export const AUSKUNFT_LAGEN: Kundenlage[] = (Object.keys(ERLAUBTE_SCHRITTE) as Kundenlage[])
  .filter((l) => ERLAUBTE_SCHRITTE[l].includes("auskunft"));

/** Lagen, in denen ein Automat überhaupt selbst senden darf (Rest: Entwurf). */
export const AUTO_LAGEN: Kundenlage[] = [
  "interessent", "unbezahlt", "zahlung_gemeldet", "bezahlt_ohne_startgespraech", "aktiv",
  // 04.09.2026 (E-115, Justin: „der Agent soll vollständig einen Mitarbeiter
  // ersetzen"): Ratenrückstand ist der häufigste Fall im Postfach. Gedeckt durch
  // Belegpflicht, Einzugsschutz, Kontowechsel-Riegel und die Flags — jede
  // Beschwerde, jedes Bestreiten, jede Kündigung bleibt Entwurf.
  "rate_ueberfaellig",
  // 04.09.2026 (E-119b): gekündigt — Mara berichtet den gebuchten Stand (letzte
  // Rate, Vertragsende mit Zahlung). Die Kündigungs-Lampe hält nur noch, wenn die
  // Buchung fehlt oder eine zweite Lampe brennt.
  "gekuendigt",
];

/** Was der Kunde will — mehrere gleichzeitig sind erlaubt. */
// „auskunft" (24.09.2026, E-240): Der Kunde spricht über seine Bonitätsauskunft
// (hat keine, will eine, fragt nach Preis oder Lieferung). Eine eigene Kategorie,
// damit so eine Mail nicht als „sonstiges" beim Menschen landet (menschNoetig).
export const KATEGORIEN = [
  "zahlung", "zugang_login", "termin", "unterlagen", "status_frage", "neuinteresse",
  "vertrieb_komplex", "kuendigung", "beschwerde", "rechtlich", "abmeldung",
  "werbung_newsletter", "spam", "intern", "auskunft", "sonstiges",
] as const;
export type Kategorie = typeof KATEGORIEN[number];

/**
 * Warnlampen — jede einzelne verhindert den Auto-Versand. Ausnahme sind die
 * VERKAUFS-SIGNALE (VERKAUFS_FLAGS): Sie sagen Mara, was sie anbieten soll,
 * und halten nichts an.
 */
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
  // 24.09.2026 (E-240): „Ich hab keine." (Doris Hösl auf die Unterlagen-Mail) —
  // der Kunde hat keine Bonitätsauskunft. Kein Grund für einen Menschen: Mara
  // bietet sie an und informiert den Betreuer (auskunft_anbieten).
  auskunft_fehlt: boolean;
}
export const LEERE_FLAGS: Flags = {
  kuendigung: false, bestreitet: false, widerruf: false, beschwerde: false, rechtlich: false,
  stopp: false, zahlung_behauptet: false, rueckruf_wunsch: false, droht_anwalt: false, zahlungsunfaehig: false,
  auskunft_fehlt: false,
};

/** Signale, die nichts anhalten — Anlass für ein Angebot, nicht für einen Menschen. */
export const VERKAUFS_FLAGS: (keyof Flags)[] = ["auskunft_fehlt"];

/**
 * Die Lampen, bei denen Mara NICHTS verkauft: Wer kündigt, bestreitet, sich
 * beschwert, „Stopp" schreibt oder nicht zahlen kann, bekommt eine Antwort auf
 * sein Anliegen — kein Angebot (24.09.2026, E-240).
 */
export const KEIN_VERKAUF_FLAGS: (keyof Flags)[] = [
  "kuendigung", "bestreitet", "widerruf", "beschwerde", "rechtlich", "stopp", "droht_anwalt", "zahlungsunfaehig",
];

/** Die brennenden Warnlampen — ohne Verkaufs-Signale. Rein, für Server und Prüfstand. */
export function warnlampen(f: Partial<Record<keyof Flags, unknown>> | null | undefined): (keyof Flags)[] {
  return (Object.keys(f ?? {}) as (keyof Flags)[]).filter((k) => !!(f as any)[k] && !VERKAUFS_FLAGS.includes(k));
}

/** Was mit einer Mail geschah. */
export type Aktion =
  | "entwurf"          // Antwort liegt als Gmail-Entwurf und in der Werkbank
  | "gesendet"         // aus der Werkbank freigegeben
  | "auto_beantwortet" // vom Automaten gesendet
  | "geordnet"         // eingeordnet, keine Antwort nötig
  | "ignoriert"        // Automat/Lieferant/eigene Post — nie beantworten
  | "vorgeordnet"      // nur geordnet (Aufhol-Phase 1), wird noch beantwortet
  | "fehler"           // technisch gescheitert, wird nach Zeitplan wiederholt (15 min, 2 h, 24 h)
  // 11.09.2026 (E-184): Nur der VERSAND scheiterte — die fertige Antwort bleibt
  // in der Zeile und wird nachgeholt (versandNachholen), nie neu erzeugt.
  | "versand_wartet"          // Antwort fertig, Gmail-Versand scheiterte, nächster Versuch steht (naechster_versuch_am)
  | "versand_fehlgeschlagen"; // vier Versuche vorbei — Aufgabe beim Betreuer, von Hand sendbar

/**
 * Absender, die NIE eine Antwort bekommen. Geprüft wird der Host nach dem
 * letzten @ — exakt oder als Subdomain, niemals als Teilstring: sonst sperrt
 * „google" auch „mail.google-partner-beratung.de" (Fund der Prüfer 02.09.).
 *
 * 18.09.2026: „googlemail.com" stand hier — das ist Gmail für Privatleute
 * (89 Kunden). Acht echte Antworten („Re: Ihre Monatsrate 2 …") wurden als
 * „Dienstleister" verworfen (Team-Feedback, Priorität 6).
 */
export const AUTOMATEN_DOMAENEN = [
  "stripe.com", "airwallex.com", "gocardless.com", "amazon.de", "amazon.com", "amazonses.com",
  "dhl.de", "dpd.de", "gls-group.eu", "hermesworld.com", "ups.com", "deutschepost.de",
  "brevo.com", "sendinblue.com", "make.com", "integromat.com", "google.com",
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
  /** Vertragsschluss (Bestelldatum), Wohnort und Land — für Härte-Stufe und Widerruf (E-135). */
  vertrag?: { geschlossenAm: string | null; ort: string | null; land: string | null; agbStand: string | null } | null;
  /** Karte: Reihenfolge, drei Bedingungen mit Stand, Einladung, Bankentscheidung (E-135). */
  karte?: any;
  kuendigung: { am: string | null; letzteRate: number | null; vertragEnde: string | null } | null;
  sperren: { werbung: string | null; anrufe: boolean; konto: string | null };
  offeneAufgaben: number;
  /** Stand der Bonitätsauskunft (24.09.2026, E-240) — null ohne Person oder bei FIAON Global. */
  auskunft?: AuskunftDossier | null;
}

/**
 * Die Bonitätsauskunft, wie Mara sie in der Akte liest (24.09.2026, E-240).
 * Stufe und Preis rechnet der Server (server/lib/fiaon-auskunft.ts) — Mara
 * nennt nie einen Preis aus dem Gedächtnis.
 */
export interface AuskunftDossier {
  stufe: "bezahlt" | "offen" | "dokument" | "nichts";
  /** „firma" bei laufendem FIAON-Business-Paket (Firmen-Auskunft), sonst „privat" — Gegenlesen E-240. */
  art?: "privat" | "firma";
  /** Was die Stufe für die Antwort heißt, in einem Satz an Mara. */
  bedeutung: string;
  land: "DE" | "AT" | "CH";
  /** „SCHUFA-Auskunft" (DE), „KSV-Auskunft" (AT), „Bonitätsauskunft" (CH). */
  wort: string;
  /** „SCHUFA, CRIF und Creditreform Boniversum" — bei wem angefragt wird. */
  auskunfteien: string;
  preis: { fuerIhn: string; betragZahl: string; mitPaket: boolean; einzeln: string; kundenpreis: string };
  offen: { verwendungszweck: string | null; betrag: string; gemeldet: boolean; seit: string } | null;
}

/** Antwort der Postfach-Liste. */
export interface PostfachAntwort {
  ok: boolean;
  zeilen: PostfachZeile[];
  gesamt: number;
  cursor: string | null;
  zaehler: Record<string, number>;
}
