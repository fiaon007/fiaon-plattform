// ═══════════════════════════════════════════════════════════════════════════
// NAMEN SAUBER — eine Funktion, alle Schreibwege
//
// ── DER BEFUND (19.08.2026) ────────────────────────────────────────────────
// GEMESSEN: 1.247 Vornamen und 1.122 Nachnamen tragen Leerraum am Rand —
// „Violeta ", „Bertolasi ", „Martin ". Im Portal steht deshalb „Guten Abend,
// Vitor Manuel ." mit einem hängenden Punkt, und in jeder Anrede jeder Mail
// dasselbe.
//
// ── WOHER ES KOMMT ─────────────────────────────────────────────────────────
// Von Menschen. Wer ein Formular ausfüllt, tippt manchmal ein Leerzeichen
// hinterher, oder er kopiert seinen Namen aus einem anderen Dokument und nimmt
// das Leerzeichen mit. Das ist normal und darf keinen Schaden anrichten.
//
// ── WARUM SERVERSEITIG UND NICHT IM FORMULAR ───────────────────────────────
// Ein `trim()` im Formularfeld hilft für dieses Formular. Es gibt vier
// Antragsstrecken, mehrere Editoren in Verwaltung und Vertrieb, einen
// Lead-Import und eine Selbstauskunft-Strecke. Wer im Formular trimmt, hat den
// nächsten Weg schon vergessen — und den Import sowieso.
//
// Die Wand steht deshalb an der SCHREIBSTELLE. Und zwar als eine Funktion, die
// jeder Weg aufruft, nicht als `trim()` an dreißig Stellen: Eine davon würde
// vergessen, und niemand könnte sagen, welche.
//
// ── KEIN ALIAS FÜR REINES TRIMMEN ──────────────────────────────────────────
// Wenn sich außer Leerraum nichts ändert, ist „Violeta " nicht ein anderer Name
// als „Violeta" — es ist derselbe Name, sauber geschrieben. Einen Alias dafür
// anzulegen würde die Alias-Liste mit Rauschen füllen und die echten Fälle
// (Heirat, Schreibvariante) unlesbar machen.
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Ein Name, wie er in die Datenbank gehört.
 *
 * Leerraum am Rand weg, mehrfache Leerzeichen innen zu einem, Umbrüche und
 * Tabulatoren zu Leerzeichen. Sonst NICHTS: keine Großschreibung, keine
 * Umlautersetzung, keine Kürzung.
 *
 * ── WARUM NICHT MEHR ─────────────────────────────────────────────────────
 * Weil ein Name dem Menschen gehört. „mcdonald" zu „McDonald" zu verbessern
 * trifft bei „mcdonald" richtig und bei „Mcdonald" (so im Pass) falsch — und
 * eine falsche Verbesserung am eigenen Namen ist ärgerlicher als eine fehlende.
 * Leerraum ist die einzige Änderung, die niemandem seinen Namen wegnimmt.
 *
 * `null` und Leerstrings kommen als `null` zurück: Ein Feld, in dem nur ein
 * Leerzeichen stand, ist leer und soll auch so gespeichert werden — sonst
 * zählen Abfragen es als gefüllt.
 */
export function nameSauber(wert: string | null | undefined): string | null {
  if (wert == null) return null;
  const sauber = String(wert)
    .replace(/[\r\n\t]+/g, " ")
    .replace(/ {2,}/g, " ")
    .trim();
  return sauber === "" ? null : sauber;
}

/**
 * Wie `nameSauber`, gibt aber einen Leerstring statt `null` zurück.
 *
 * Für Schreibwege, die zwischen „nicht angegeben" (`null`) und „ausdrücklich
 * geleert" (`''`) unterscheiden — etwa `COALESCE(NULLIF(${wert}, ''), spalte)`,
 * das einen bestehenden Wert behalten soll, wenn nichts Neues kommt.
 */
export function nameSauberOderLeer(wert: string | null | undefined): string {
  return nameSauber(wert) ?? "";
}

/** Braucht dieser Wert eine Reinigung? Für Prüfstände und Messungen. */
export function brauchtReinigung(wert: string | null | undefined): boolean {
  if (wert == null) return false;
  const roh = String(wert);
  return roh !== (nameSauber(roh) ?? "");
}

/**
 * Mehrere Namensfelder auf einmal — der bequeme Weg für Schreibstellen.
 *
 * Nimmt ein Objekt und gibt es zurück, wobei die genannten Schlüssel gereinigt
 * sind. Alles andere bleibt unberührt.
 *
 * ── WARUM DAS BEQUEM SEIN MUSS ───────────────────────────────────────────
 * Eine Regel, die an jeder Schreibstelle fünf Zeilen kostet, wird umgangen.
 * Ein Aufruf, der in eine Zeile passt, wird benutzt.
 */
export function namenfelderSaeubern<T extends Record<string, any>>(
  daten: T, felder: readonly (keyof T)[],
): T {
  const raus: any = { ...daten };
  for (const f of felder) {
    if (f in raus) raus[f] = nameSauber(raus[f]);
  }
  return raus as T;
}

/** Die Namensfelder einer Bestellung — damit sie nicht jede Stelle neu aufzählt. */
export const NAMENSFELDER_BESTELLUNG = [
  "firstName", "lastName", "contactName", "companyName",
] as const;

/** Dieselben Felder in der Schreibweise der Datenbank. */
export const NAMENSSPALTEN = [
  "first_name", "last_name", "contact_name", "company_name",
] as const;
