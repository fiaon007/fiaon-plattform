// ═══════════════════════════════════════════════════════════════════════════
// ZUGANG DIGITAL ÜBERGEBEN — Regeln und Texte an EINEM Ort (08.10.2026)
//
// Justin: „Bau dafür eine Seite, alles soll sich auf der Plattform abspielen …
// das temporäre Passwort muss angezeigt werden, sonst kann sie sich nicht
// einloggen. Beim ersten Login muss es eh geändert werden — also digitalisieren."
//
// Bisher: ein Übergabe-PDF mit einem Handfeld für das Start-Passwort. Jetzt:
//   Chefbüro › Team › Team-Zentrale › Reiter „Zugang übergeben" (Leitung trägt
//   ein) → Einmal-Link /zugang/uebergabe#<Token> (48 Stunden) + sechsstelliger
//   Code (mündlich, getrennt vom Link) → Empfängerseite zeigt das Passwort erst
//   nach dem Code → „Ich habe meinen Zugang erhalten …" löscht es.
//
// Hier stehen nur Dinge, die Server, Chefbüro und Empfängerseite GEMEINSAM
// brauchen: Grenzen, die Prüfung der Eingabe, der Stand einer Übergabe und die
// Sätze der Empfängerseite (die Wortwand liest sie hier, scripts/pruef-wortwand-de.ts).
// Verschlüsselung und Datenbank: server/lib/fiaon-zugang-uebergabe.ts.
//
// Die Empfängerin oder der Empfänger wird gesiezt — wie im Übergabe-PDF, das die
// Vorlage ist. Keine Namen im Code: Wer übergibt und wer empfängt, trägt die
// Leitung ein (das Repo ist öffentlich).
// ═══════════════════════════════════════════════════════════════════════════

/** So lange gilt ein Link. Danach ist das Passwort gelöscht. */
export const UEBERGABE_GUELTIG_STUNDEN = 48;
/** Nach so vielen falschen Codes ist der Link gesperrt und das Passwort gelöscht. */
export const UEBERGABE_MAX_FEHLVERSUCHE = 3;
export const UEBERGABE_CODE_STELLEN = 6;
/** Die Empfängerseite. Das Token steht im Anker (#…) — der geht nie an einen Server, nie in ein Protokoll, nie in einen Referer. */
export const UEBERGABE_PFAD = "/zugang/uebergabe";

export type UebergabeStand =
  | "offen" | "angesehen" | "bestaetigt" | "abgelaufen" | "gesperrt" | "zurueckgezogen" | "ersetzt";

/** Die Zeitpunkte einer Übergabe, wie die Datenbank sie liefert (ISO-Text oder Date). */
export interface UebergabeZeiten {
  gueltig_bis: string | Date;
  angesehen_am?: string | Date | null;
  bestaetigt_am?: string | Date | null;
  gesperrt_am?: string | Date | null;
  geloescht_grund?: string | null;
}

const ms = (d: string | Date | null | undefined): number | null => (d == null ? null : new Date(d).getTime());

/**
 * Der eine Stand einer Übergabe. Reihenfolge = Vorrang: Was abgeschlossen ist
 * (bestätigt, gesperrt, zurückgezogen, ersetzt), bleibt es — auch nach Ablauf.
 */
export function uebergabeStandAus(z: UebergabeZeiten, jetztMs: number = Date.now()): UebergabeStand {
  if (z.bestaetigt_am) return "bestaetigt";
  if (z.gesperrt_am) return "gesperrt";
  if (z.geloescht_grund === "zurueckgezogen") return "zurueckgezogen";
  if (z.geloescht_grund === "ersetzt") return "ersetzt";
  if (z.geloescht_grund === "abgelaufen" || (ms(z.gueltig_bis) ?? 0) <= jetztMs) return "abgelaufen";
  if (z.angesehen_am) return "angesehen";
  return "offen";
}

/** Darf der Link noch etwas zeigen? Nur „offen" und „angesehen". */
export function uebergabeLebt(stand: UebergabeStand): boolean {
  return stand === "offen" || stand === "angesehen";
}

/** Kann die Leitung „neu ausstellen" drücken? Bei allem, was nicht bestätigt ist. */
export function uebergabeNeuAusstellbar(stand: UebergabeStand): boolean {
  return stand !== "bestaetigt";
}

// ── Die Eingabe der Leitung ─────────────────────────────────────────────────
export interface UebergabeEingabe {
  name: string;
  rolle: string;
  zugang: string;
  anmeldeadresse: string;
  passwort: string;
  ansprechName: string;
  ansprechFunktion: string;
  ansprechEmail: string;
  ansprechTelefon: string;
}

export type UebergabeFeld = keyof UebergabeEingabe;

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Prüft die Eingabe. Die Meldung nennt NIE den Inhalt eines Feldes — vor allem
 * nie das Passwort. Das Passwort wird nicht verändert (auch nicht getrimmt):
 * Leerzeichen am Rand sind fast immer ein Kopierfehler und werden abgelehnt,
 * statt still entfernt.
 */
export function uebergabeEingabePruefen(roh: Partial<Record<UebergabeFeld, unknown>>):
  { ok: true; wert: UebergabeEingabe } | { ok: false; feld: UebergabeFeld; fehler: string } {
  const t = (v: unknown) => (typeof v === "string" ? v.trim() : "");
  const wert: UebergabeEingabe = {
    name: t(roh.name),
    rolle: t(roh.rolle),
    zugang: t(roh.zugang).toLowerCase(),
    anmeldeadresse: t(roh.anmeldeadresse),
    passwort: typeof roh.passwort === "string" ? roh.passwort : "",
    ansprechName: t(roh.ansprechName),
    ansprechFunktion: t(roh.ansprechFunktion),
    ansprechEmail: t(roh.ansprechEmail).toLowerCase(),
    ansprechTelefon: t(roh.ansprechTelefon),
  };
  const nein = (feld: UebergabeFeld, fehler: string) => ({ ok: false as const, feld, fehler });
  if (wert.name.length < 2 || wert.name.length > 80) return nein("name", "Bitte den Namen eintragen (2 bis 80 Zeichen).");
  if (wert.rolle.length > 80) return nein("rolle", "Die Rolle ist zu lang (höchstens 80 Zeichen).");
  if (!EMAIL.test(wert.zugang) || wert.zugang.length > 120) return nein("zugang", "Der Zugang muss eine E-Mail-Adresse sein.");
  if (wert.anmeldeadresse.length < 3 || wert.anmeldeadresse.length > 200 || /\s/.test(wert.anmeldeadresse)) {
    return nein("anmeldeadresse", "Bitte die Anmeldeadresse eintragen, z. B. mail.google.com.");
  }
  if (wert.passwort.length < 8) return nein("passwort", "Das Start-Passwort braucht mindestens 8 Zeichen.");
  if (wert.passwort.length > 128) return nein("passwort", "Das Start-Passwort ist zu lang (höchstens 128 Zeichen).");
  if (wert.passwort !== wert.passwort.trim()) return nein("passwort", "Das Start-Passwort beginnt oder endet mit einem Leerzeichen — bitte prüfen.");
  if (/[\r\n\t]/.test(wert.passwort)) return nein("passwort", "Das Start-Passwort enthält einen Zeilenumbruch — bitte prüfen.");
  if (wert.ansprechName.length < 2 || wert.ansprechName.length > 80) return nein("ansprechName", "Bitte die Ansprechperson eintragen.");
  if (wert.ansprechFunktion.length > 60) return nein("ansprechFunktion", "Die Funktion ist zu lang (höchstens 60 Zeichen).");
  if (wert.ansprechEmail && (!EMAIL.test(wert.ansprechEmail) || wert.ansprechEmail.length > 120)) {
    return nein("ansprechEmail", "Die E-Mail der Ansprechperson stimmt nicht.");
  }
  if (wert.ansprechTelefon.length > 40) return nein("ansprechTelefon", "Die Telefonnummer ist zu lang.");
  return { ok: true, wert };
}

/** Der Vorname für die Anrede — das erste Wort des eingetragenen Namens. */
export function uebergabeVorname(name: string): string {
  return String(name || "").trim().split(/\s+/)[0] || "";
}

/** Steht hinter der Anmeldeadresse ein Google-Konto? Dann nennt Schritt 3 den Google-Weg. */
export function uebergabeIstGoogle(anmeldeadresse: string): boolean {
  return /(^|\.)google\.com\b|gmail\.com\b/i.test(String(anmeldeadresse || ""));
}

// ── Die Sätze der Empfängerseite ────────────────────────────────────────────
// Vorlage: das Übergabe-PDF (Gestaltung und Wortlaut), verallgemeinert — die
// Rolle, der Zugang und die Ansprechperson kommen aus der Eingabe der Leitung.
export const ZUGANG_UEBERGABE_TEXTE = {
  seitenTitel: "Ihr Zugang · FIAON",
  vertraulich: "Vertraulich · nur für Sie",
  auge: "Übergabe durch die Geschäftsleitung",

  codeTitel: "Ihr Zugang liegt bereit.",
  codeSatz: "Geben Sie den sechsstelligen Übergabe-Code ein, den Sie persönlich erhalten haben. Link und Code kommen bewusst getrennt.",
  codeFeld: "Übergabe-Code",
  codeKnopf: "Zugang öffnen",
  codePrueft: "Wird geprüft …",
  codeUnvollstaendig: "Bitte alle sechs Ziffern eingeben.",
  codeFalsch: (rest: number) => (rest === 1
    ? "Dieser Code stimmt nicht. Ein Versuch bleibt — danach wird der Link gesperrt."
    : `Dieser Code stimmt nicht. Es bleiben ${rest} Versuche.`),
  gilt: (bis: string) => `Dieser Link gilt bis ${bis}.`,

  willkommen: (vorname: string) => (vorname ? `Willkommen im Team, ${vorname}.` : "Willkommen im Team."),
  unter: (rolle: string) => (rolle ? `Ihr persönlicher Zugang — ${rolle}.` : "Ihr persönlicher Zugang."),
  metaFuer: "Für",
  metaVon: "Übergeben von",
  metaBis: "Gültig bis",

  zugangTitel: "Ihr Zugang",
  feldZugang: "Zugang",
  feldAnmeldung: "Anmeldung",
  feldPasswort: "Start-Passwort",
  anzeigen: "Anzeigen",
  verbergen: "Verbergen",
  kopieren: "Kopieren",
  kopiert: "Kopiert",
  kopierenGeht: "Kopieren ist hier nicht möglich — bitte abschreiben.",
  passwortHinweis: "Das Start-Passwort gilt nur für die erste Anmeldung. Es wird gelöscht, sobald Sie unten bestätigen — spätestens mit Ablauf dieses Links.",

  schritteTitel: "Erste Anmeldung — in drei Schritten",
  schritt1: (adresse: string) => `Öffnen Sie ${adresse} und melden Sie sich mit Ihrem Zugang und dem Start-Passwort an.`,
  schritt2: "Vergeben Sie gleich ein eigenes Passwort: mindestens zwölf Zeichen, nur für diesen Zugang, und notieren Sie es nirgends offen.",
  schritt3: (google: boolean) => (google
    ? "Schalten Sie die Bestätigung in zwei Schritten ein (Google-Konto → Sicherheit → Bestätigung in zwei Schritten), am besten mit der App Google Authenticator."
    : "Schalten Sie die Bestätigung in zwei Schritten ein (in den Sicherheitseinstellungen des Kontos), am besten mit einer Authenticator-App."),

  sicherTitel: "Damit Ihre Arbeit sicher bleibt",
  sicher: [
    "Geben Sie Ihr Passwort an niemanden weiter, auch nicht an Kolleginnen und Kollegen. FIAON fragt Sie nie per E-Mail oder Telefon danach.",
    "Leiten Sie keine E-Mails an private Postfächer weiter und speichern Sie keine Belege auf privaten Geräten.",
    "Kunden- und Zahlungsdaten bleiben vertraulich und werden nur für die Arbeit bei FIAON verwendet.",
    "Sperren Sie Ihren Bildschirm, wenn Sie Ihren Platz verlassen. Wirkt eine E-Mail seltsam (Zahlungsaufforderung, Link zur Anmeldung), öffnen Sie nichts und fragen Sie zuerst nach.",
  ],

  ansprechTitel: "Ihre Ansprechperson",
  ansprechSatz: "bei allen Fragen zu Ihrem Zugang und zu Ihren Aufgaben.",

  bestaetigenKnopf: "Ich habe meinen Zugang erhalten und das Passwort geändert",
  bestaetigenLaeuft: "Wird bestätigt …",
  bestaetigenSatz: "Mit diesem Klick wird das Start-Passwort hier endgültig gelöscht, und der Link ist abgeschlossen.",
  bestaetigenFrage: "Haben Sie sich angemeldet und ein eigenes Passwort vergeben? Danach ist das Start-Passwort hier nicht mehr abrufbar.",
  bestaetigenJa: "Ja, bestätigen",
  bestaetigenNein: "Noch nicht",

  fertigTitel: (vorname: string) => (vorname ? `Danke, ${vorname}. Ihr Zugang ist übergeben.` : "Danke. Ihr Zugang ist übergeben."),
  fertigSatz: (wann: string) => `Bestätigt am ${wann}. Das Start-Passwort ist gelöscht, dieser Link ist abgeschlossen. Sie können das Fenster schließen.`,

  // Zustände, in denen der Link nichts mehr zeigt
  laedt: "Einen Moment — der Link wird geprüft.",
  abgelaufenTitel: "Dieser Link ist abgelaufen.",
  abgelaufenSatz: "Er galt 48 Stunden, das Start-Passwort ist gelöscht. Bitte wenden Sie sich an die Person, die Ihnen den Zugang übergeben hat — sie stellt einen neuen aus.",
  gesperrtTitel: "Dieser Link ist gesperrt.",
  gesperrtSatz: "Der Übergabe-Code wurde dreimal falsch eingegeben. Zu Ihrem Schutz ist das Start-Passwort gelöscht. Bitte lassen Sie sich einen neuen Zugang ausstellen.",
  bestaetigtTitel: "Diese Übergabe ist abgeschlossen.",
  bestaetigtSatz: "Der Empfang wurde bestätigt, das Start-Passwort ist gelöscht.",
  zurueckTitel: "Dieser Link gilt nicht mehr.",
  zurueckSatz: "Die Geschäftsleitung hat ihn zurückgezogen oder durch einen neuen ersetzt. Bitte verwenden Sie den neuen Link.",
  unbekanntTitel: "Dieser Link ist ungültig.",
  unbekanntSatz: "Bitte prüfen Sie, ob Sie ihn vollständig geöffnet haben — am besten über den QR-Code oder durch Kopieren des ganzen Links.",
  zuVieleTitel: "Zu viele Versuche von diesem Gerät.",
  zuVieleSatz: (minuten: number) => `Bitte warten Sie ${minuten} ${minuten === 1 ? "Minute" : "Minuten"} und versuchen Sie es dann noch einmal.`,
  fehlerTitel: "Das hat gerade nicht geklappt.",
  verbindung: "Keine Verbindung. Bitte versuchen Sie es gleich noch einmal.",
  fuss: "FIAON LTD · Vertraulich",
} as const;
