// ═══════════════════════════════════════════════════════════════════════════
// „WIR RUFEN AN" — DER EINE SATZ
//
// ── DAS PROBLEM ────────────────────────────────────────────────────────────
// Wer heute einen Termin bucht, erwartet einen Link. Videokonferenzen haben
// diese Erwartung gesetzt: Man bucht, bekommt eine Adresse, klickt zur
// vereinbarten Zeit. Bei FIAON ruft ein Mensch am Telefon an — und wer das
// nicht ausdrücklich liest, sitzt vor seinem Rechner und wartet auf einen Link,
// während das Telefon klingelt und nicht abgenommen wird.
//
// Das ist kein hypothetischer Fall: Ein No-Show, dessen Ursache eine falsche
// Erwartung ist, kostet den Termin, die Mitarbeiterzeit und beim Kunden das
// Vertrauen — er glaubt, WIR hätten uns nicht gemeldet.
//
// ── DESHALB STEHT DER SATZ HIER UND NICHT VIERMAL IM QUELLTEXT ─────────────
// Er erscheint an vier Stellen: Buchungsseite, Startgespräch-Tafel,
// Bestätigungsansicht und in der E-Mail (als Variable für Brevo). Vier
// Fassungen desselben Satzes würden auseinanderlaufen, und dann verspricht die
// Mail etwas anderes als die Seite.
//
// ── WORTWAHL ───────────────────────────────────────────────────────────────
// „ruft dich an" (nicht „kontaktiert dich"), „halte dein Telefon bereit"
// (nicht „bitte sei erreichbar"). Und ausdrücklich kein „Meeting", kein
// „Termin-Link", kein „Einladung" — jedes dieser Wörter trägt die Erwartung
// wieder herein, die der Satz ausräumen soll.
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Der Satz für Portal und Mail.
 *
 * @param vorname Vorname des Mitarbeiters. Fehlt er, tritt „Dein
 *   Ansprechpartner" ein — niemals ein leerer Platz, denn „ ruft dich an"
 *   liest sich wie ein Fehler.
 */
export function anrufHinweis(vorname?: string | null): string {
  const wer = String(vorname || "").trim() || "Dein Ansprechpartner";
  return `${wer} ruft dich zur vereinbarten Zeit an — halte dein Telefon bereit.`;
}

/**
 * Die kurze Fassung für enge Stellen (unter einem gewählten Slot, in Listen).
 *
 * Sie sagt dasselbe in weniger Worten und lässt das „halte dein Telefon
 * bereit" weg — dort, wo drei Zeilen Text die Auswahl erschlagen würden.
 */
export function anrufHinweisKurz(vorname?: string | null): string {
  const wer = String(vorname || "").trim() || "Dein Ansprechpartner";
  return `${wer} ruft dich an`;
}

/**
 * Der Zusatz zur Absage — er gehört in dieselbe Zeile wie der Anruf-Hinweis.
 *
 * Ein Termin, den man nicht absagen kann, wird nicht abgesagt, sondern
 * verpasst. Und ein verpasster Termin ist teurer als ein abgesagter: Der
 * Mitarbeiter wartet, der Kunde schämt sich, und die Wiedereinladung kostet
 * eine weitere Runde.
 */
/**
 * Dieselben Sätze in der Sie-Form — für alles, was als E-MAIL rausgeht
 * (05.09.2026). Die Mailvorlagen sprechen den Kunden mit „Sie" an; der
 * Du-Satz aus der Terminseite stand bisher mitten in einem Sie-Absatz
 * („halten Sie Ihr Telefon bereit. Daniel ruft dich an — halte dein Telefon
 * bereit."). Justin: „Wir schreiben immer in Sie-Form."
 */
export function anrufHinweisSie(name?: string | null): string {
  const wer = String(name || "").trim() || "Ihr Ansprechpartner";
  return `${wer} ruft Sie zur vereinbarten Zeit an — halten Sie bitte Ihr Telefon bereit.`;
}
export const ABSAGE_HINWEIS_SIE =
  "Passt es doch nicht? Über den Link in dieser E-Mail können Sie jederzeit "
  + "absagen oder eine andere Zeit wählen.";

export const ABSAGE_HINWEIS =
  "Passt es doch nicht? Über den Link in der Bestätigungs-E-Mail kannst du "
  + "jederzeit absagen oder eine andere Zeit wählen.";

/** Wörter, die diese Texte NICHT enthalten dürfen — der Prüfstand geht damit drüber. */
export const VERBOTENE_WORTE = [
  "meeting", "video", "zoom", "teams", "link zum gespräch", "termin-link",
  "einwählen", "beitreten", "raum", "konferenz",
] as const;

/** Prüft einen Text auf falsche Erwartungen. Gibt die Verstöße zurück. */
export function erwartungsHygiene(text: string): string[] {
  const t = text.toLowerCase();
  return VERBOTENE_WORTE.filter((w) => t.includes(w));
}
