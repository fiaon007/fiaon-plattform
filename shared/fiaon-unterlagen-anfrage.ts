// ═══════════════════════════════════════════════════════════════════════════
// UNTERLAGEN MIT EINEM KLICK ANFORDERN — DIE REGELN (E-IT-D, 08.10.2026, Punkt 4c)
//
// Justin, 08.10.2026: „Fehlt Ausweis oder Kontoauszug: 1 Klick in der Akte →
// Mail (und, wenn das 24-h-Fenster offen ist, WhatsApp-Text über den
// bestehenden Weg) an den Kunden ‚Bitte laden Sie … hoch' mit 1-Klick-Upload-
// Link OHNE Login: signiert, 14 Tage gültig, mehrfach nutzbar, nur Upload der
// angeforderten Kategorie(n), Datei landet im Profil (gleiche Ablage wie
// Portal-Upload) und erscheint bei uns; Drossel und Protokoll wie (2)."
//
// Drossel wie (2): höchstens drei Anfragen je Kunde und Tag, mindestens 15
// Minuten Abstand. Protokoll: wer, wann, an welche Adresse/Nummer, mit welchem
// Ergebnis je Kanal (fiaon_unterlagen_anfragen, Migration 100).
// ═══════════════════════════════════════════════════════════════════════════

export const LINK_GUELTIG_TAGE = 14;
export const ANFRAGEN_JE_TAG = 3;
export const ANFRAGE_ABSTAND_MINUTEN = 15;
/** Upload über den Link (Punkt 3: 50 MB je Datei, 20 Dateien je Kategorie). */
export const LINK_DATEI_MAX_MB = 50;
export const LINK_DATEIEN_JE_ART = 20;
/**
 * Gegenprüfung 08.10.: 20 × 50 MB × drei Arten wären 3 GB je Anfrage im Speicher —
 * ohne Anmeldung. Deshalb eine Obergrenze je Anfrage (Content-Length und Zähler im
 * Strom), höchstens vier Uploads gleichzeitig und eine Obergrenze je Unterlage in
 * der Akte (die Spalte wächst mit jedem Anhängen).
 */
export const LINK_ANFRAGE_MAX_MB = 120;
export const LINK_UPLOADS_GLEICHZEITIG = 4;
export const LINK_UNTERLAGE_MAX_MB = 150;

/** Was sich über den Link hochladen lässt — dieselben Arten wie die Akte (fiaon-dokumente.ts). */
export type LinkArt = "ausweis" | "kontoauszug" | "schufa";
export const LINK_ARTEN: readonly LinkArt[] = ["ausweis", "kontoauszug", "schufa"];
export function istLinkArt(v: unknown): v is LinkArt {
  return v === "ausweis" || v === "kontoauszug" || v === "schufa";
}

export const LINK_ART_TEXT: Record<LinkArt, { titel: string; anleitung: string }> = {
  ausweis: {
    titel: "Ausweis",
    anleitung: "Personalausweis: Vorder- und Rückseite. Reisepass: die Seite mit Foto und Daten. Ein Aufenthaltstitel gilt nur zusammen mit dem Reisepass. Alle vier Ecken im Bild, gut lesbar.",
  },
  kontoauszug: {
    titel: "Kontoauszüge",
    anleitung: "Die Kontoauszüge der letzten drei Monate vom Girokonto, auf dem Ihr Einkommen eingeht — am besten als PDF aus dem Online-Banking. Mehrere Dateien auf einmal sind möglich.",
  },
  schufa: {
    titel: "Bonitätsauskunft",
    anleitung: "Ihre vollständige Auskunft (alle Seiten) als PDF oder gut lesbare Fotos.",
  },
};

/** Die Drossel — reine Regel (Prüfstand). `anfragen` = erfolgreiche Anfragen dieser Person (Zeitpunkte). */
export function anfrageDrossel(anfragen: readonly Date[], jetzt: Date, tagBeginn: Date): { erlaubt: boolean; grund: string | null; wiederAb: Date | null } {
  const heute = anfragen.filter((d) => d.getTime() >= tagBeginn.getTime());
  if (heute.length >= ANFRAGEN_JE_TAG) {
    return { erlaubt: false, grund: `Heute gingen schon ${heute.length} Anfragen an diesen Kunden — höchstens ${ANFRAGEN_JE_TAG} je Tag.`, wiederAb: null };
  }
  const letzte = anfragen.reduce<Date | null>((m, d) => (!m || d > m ? d : m), null);
  if (letzte && jetzt.getTime() - letzte.getTime() < ANFRAGE_ABSTAND_MINUTEN * 60_000) {
    const ab = new Date(letzte.getTime() + ANFRAGE_ABSTAND_MINUTEN * 60_000);
    return { erlaubt: false, grund: `Die letzte Anfrage ist keine ${ANFRAGE_ABSTAND_MINUTEN} Minuten her — wieder möglich ab ${ab.toLocaleTimeString("de-DE", { timeZone: "Europe/Berlin", hour: "2-digit", minute: "2-digit" })} Uhr.`, wiederAb: ab };
  }
  return { erlaubt: true, grund: null, wiederAb: null };
}

/** Der Hinweis für die Mail: „Bitte laden Sie … hoch" aus den fertigen Sätzen je Art. */
export function bitteSatz(posten: readonly string[]): string {
  const p = posten.map((x) => String(x ?? "").trim()).filter(Boolean);
  if (!p.length) return "";
  const liste = p.length === 1 ? p[0] : `${p.slice(0, -1).join(", ")} sowie ${p[p.length - 1]}`;
  return `${liste.charAt(0).toUpperCase()}${liste.slice(1)}.`;
}

/** Der Absatz in der Mail unter dem Knopf (documents_change_request, {{params.upload_satz}}). */
export function uploadSatz(gueltigBis: Date, knopf: string | null = null): string {
  const bis = gueltigBis.toLocaleDateString("de-DE", { timeZone: "Europe/Berlin", day: "2-digit", month: "2-digit", year: "numeric" });
  // Nachprüfung 08.10.: Ist der Hauptknopf ein Angebot oder Zahlungslink, nennt der Satz den zweiten Knopf beim Namen.
  const wo = knopf ? `Über den Knopf „${knopf}“ weiter unten` : "Über den Knopf";
  return `${wo} laden Sie die Unterlagen direkt hoch — ohne Anmeldung, als PDF oder Foto, gut lesbar und mit allen vier Ecken im Bild. Der Link gilt bis ${bis} und lässt sich mehrfach nutzen.`;
}

/** Der WhatsApp-Text im offenen 24-Stunden-Fenster — kurz, gesiezt, ohne Zahlen, ohne Werbung. */
export function whatsappText(vorname: string | null, posten: readonly string[], link: string): string {
  const anrede = vorname ? `Guten Tag ${vorname}, ` : "Guten Tag, ";
  return `${anrede}für Ihre Akte fehlt uns noch: ${bitteSatz(posten)} Sie können es hier ohne Anmeldung hochladen: ${link}`;
}
