// ═══════════════════════════════════════════════════════════════════════════
// VORLAGE: MARAS NACHARBEIT NACH DEM ANRUF (E-406 C2, 19.10.2026) — Absender „FIAON Welcome"
//
// Ein Ereignis (mara_nacharbeit), drei Fassungen — gewählt über die Nutzlast `nacharbeit_art`
// (nacharbeitBaustein, im Motor wie auskunftAngebotBaustein). So bleibt es im Protokoll, im Mailwerk und in der
// Frequenzbremse EIN Ereignis. Die vierte Art („Unterlagen“) nimmt die bestehende Unterlagen-Bitte mit dem
// Upload-Link ohne Anmeldung (documents_change_request über unterlagenAnfrageSenden) — keine zweite Fassung.
//
// Schreibregeln (siehe konto.ts) und hier zusätzlich:
// · {{params.mitarbeiter}} / {{params.mitarbeiter_dat}} tragen die Nennform des Kollegen, der das Gespräch geführt
//   hat („Herr Stripling“ / „Herrn Stripling“, ohne Anrede der volle Name — E-265), nie den Vornamen.
// · Keine Bankdaten im Text (Wortwand): der Knopf führt auf SEINE Zahlungsseite mit QR-Code und Bankdaten.
// · Kein Karten-Block, kein Bank-Satz (E-281/E-373) — das ist eine Bestätigung, kein Verkauf.
// · Maras Zeilen der Zusammenfassung kommen fertig maskiert (…_html, htmlSicher in shared/fiaon-mara-nacharbeit-text.ts)
//   und sind vorher geprüft (nacharbeitTextPruefen); ein leerer Absatz entfällt im Motor von selbst.
// ═══════════════════════════════════════════════════════════════════════════
import type { MailBaustein } from "../geruest";

const ZUSAGE: MailBaustein = {
  betreff: "Wie besprochen: Ihre Zahlung über {{params.betrag}} €",
  preheader: "Betrag, Tag und Verwendungszweck auf einen Blick — und Ihre Zahlungsseite.",
  titel: "Danke für das Gespräch",
  absaetze: [
    "{{params.einstieg}}, vielen Dank für das Gespräch mit {{params.mitarbeiter_dat}}. Wie besprochen überweisen Sie den offenen Betrag {{params.zusage_wann}} — hier alles auf einen Blick:",
    "Über den Knopf unten finden Sie unsere Bankdaten und einen QR-Code für Ihre Banking-App. Bitte geben Sie den Verwendungszweck an — dann ordnen wir Ihre Zahlung sofort zu.",
  ],
  daten: [
    { label: "Betrag", wert: "{{params.betrag}} €" },
    { label: "Zahlung", wert: "{{params.zusage_tag}}" },
    { label: "Verwendungszweck", wert: "{{params.verwendungszweck}}" },
  ],
  knopf: { text: "Zahlungsseite öffnen", url: "{{params.zahlung_url}}" },
  fussnote: "Hat sich etwas geändert? Antworten Sie einfach auf diese Mail.",
};

const TERMIN: MailBaustein = {
  betreff: "Ihr Rückruf: {{params.termin_datum}}, {{params.termin_uhrzeit}}",
  preheader: "Wie besprochen — {{params.mitarbeiter}} ruft Sie zur vereinbarten Zeit an.",
  titel: "Ihr Rückruf steht",
  absaetze: [
    "{{params.einstieg}}, vielen Dank für das Gespräch. Wie besprochen ruft <b>{{params.mitarbeiter}}</b> Sie zur vereinbarten Zeit zurück:",
    "Sie brauchen nichts vorzubereiten — halten Sie einfach Ihr Telefon bereit.",
  ],
  daten: [
    { label: "Datum", wert: "{{params.termin_datum}}" },
    { label: "Uhrzeit", wert: "{{params.termin_uhrzeit}}" },
    { label: "Es ruft Sie an", wert: "{{params.mitarbeiter}}" },
  ],
  fussnote: "Passt die Zeit doch nicht? Antworten Sie kurz auf diese Mail, dann finden wir eine neue.",
};

const GESPRAECH: MailBaustein = {
  betreff: "Unser Gespräch — kurz zusammengefasst",
  preheader: "Das Wichtigste aus Ihrem Gespräch mit {{params.mitarbeiter_dat}}.",
  titel: "Kurz zusammengefasst",
  absaetze: [
    "{{params.einstieg}}, vielen Dank für das Gespräch mit {{params.mitarbeiter_dat}}. Hier noch einmal das Wichtigste:",
    "{{params.absatz1_html}}",
    "{{params.absatz2_html}}",
    "{{params.absatz3_html}}",
  ],
  fussnote: "Fehlt etwas oder stimmt etwas nicht? Antworten Sie einfach auf diese Mail.",
};

/** Im Mailwerk und in der Galerie steht die Zahlungszusage (mit Knopf) — Versand und Vorschau nehmen nacharbeitBaustein. */
export const NACHARBEIT_VORLAGEN: Record<string, MailBaustein> = {
  mara_nacharbeit: ZUSAGE,
};

/** Die Fassung zur Nutzlast: nacharbeit_art „termin“, „gespraech“ — sonst die Zahlungszusage. */
export function nacharbeitBaustein(payload: Record<string, unknown>): MailBaustein {
  const art = String((payload as any)?.nacharbeit_art ?? "");
  if (art === "termin") return TERMIN;
  if (art === "gespraech") return GESPRAECH;
  return ZUSAGE;
}
