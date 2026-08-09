// ═══════════════════════════════════════════════════════════════════
// Agent-Portal — Tageszeit in deutscher Geschäftszeit (Europe/Berlin)
//
// WARUM EIGENE DATEI: Diese Funktionen sind reine Rechnung ohne React und
// ohne Browser-Fenster. Nur so lassen sie sich mit FESTEN Uhrzeiten prüfen
// (scripts/gruss-test.ts) — inklusive Mitternacht und Zeitumstellung.
//
// DER BUG, DER HIER BEHOBEN IST (28.07.2026):
//   new Intl.DateTimeFormat("de-DE", { hour: "2-digit", hour12: false })
//     .format(new Date())            →  "09 Uhr"
//   Number("09 Uhr")                 →  NaN
// Mit NaN ist JEDER Vergleich falsch (NaN < 11 ist false), deshalb fiel die
// Bedingungskette bis zum letzten Zweig durch: um 09:30 Uhr stand „Guten
// Abend" auf der Startseite. Ein stiller Durchfall auf den letzten Zweig ist
// nie akzeptabel — er sieht wie ein Ergebnis aus, ist aber ein Fehler.
//
// Deshalb hier: formatToParts (liefert die Stunde OHNE Beiwerk), strenge
// Zahlenprüfung und ein ehrliches `null`, wenn die Stunde nicht bestimmbar
// ist. Aus `null` wird ein neutraler Gruß, keine geratene Tageszeit.
// ═══════════════════════════════════════════════════════════════════

/**
 * Stunde (0–23) in Europe/Berlin — oder `null`, wenn sie nicht sicher
 * bestimmbar ist. Kein Rückfall auf die Uhr des Betrachters: Ein Agent in
 * Wien und der Vorgesetzte in Bangkok sollen dieselbe Geschäftszeit sehen.
 *
 * `hourCycle: "h23"` verhindert die „24" mancher Laufzeitumgebungen um
 * Mitternacht; die Prüfung darunter fängt sie zusätzlich ab.
 */
export function berlinStunde(jetzt: Date = new Date()): number | null {
  try {
    if (!(jetzt instanceof Date) || Number.isNaN(jetzt.getTime())) return null;
    const teile = new Intl.DateTimeFormat("de-DE", {
      timeZone: "Europe/Berlin",
      hour: "2-digit",
      hourCycle: "h23",
    }).formatToParts(jetzt);
    const roh = teile.find((t) => t.type === "hour")?.value;
    if (roh == null) return null;
    // parseInt statt Number: "09" ist gültig, "09 Uhr" käme hier nie an,
    // aber ein unerwartetes Anhängsel darf trotzdem nicht zu NaN führen.
    const stunde = parseInt(roh, 10);
    if (!Number.isInteger(stunde) || stunde < 0 || stunde > 24) return null;
    return stunde === 24 ? 0 : stunde;
  } catch {
    return null;
  }
}

/**
 * Grenzen (bewusst festgeschrieben und geprüft):
 *   05:00–10:59  Guten Morgen
 *   11:00–17:59  Guten Tag
 *   18:00–04:59  Guten Abend
 * Nicht bestimmbare Stunde ⇒ „Hallo". Niemals stillschweigend „Abend".
 */
export function grussFuerStunde(stunde: number | null): string {
  if (stunde == null || !Number.isInteger(stunde) || stunde < 0 || stunde > 23) return "Hallo";
  if (stunde >= 5 && stunde < 11) return "Guten Morgen";
  if (stunde >= 11 && stunde < 18) return "Guten Tag";
  return "Guten Abend";
}

/** Fertiger Gruß für den Zeitpunkt (Standard: jetzt). */
export function gruss(jetzt: Date = new Date()): string {
  return grussFuerStunde(berlinStunde(jetzt));
}

const MONATE = [
  "Januar", "Februar", "März", "April", "Mai", "Juni",
  "Juli", "August", "September", "Oktober", "November", "Dezember",
];

/**
 * Monatsname in deutscher Zeit („Im Juli +127,50 €"). Hier ist `format()`
 * unbedenklich — bei `month: "long"` hängt de-DE nichts an. Der Rückfall
 * nutzt die Monats-Nummer, nicht den formatierten Text.
 */
export function monatName(jetzt: Date = new Date()): string {
  try {
    const teile = new Intl.DateTimeFormat("de-DE", {
      timeZone: "Europe/Berlin",
      month: "numeric",
    }).formatToParts(jetzt);
    const roh = teile.find((t) => t.type === "month")?.value;
    const nr = parseInt(roh || "", 10);
    if (Number.isInteger(nr) && nr >= 1 && nr <= 12) return MONATE[nr - 1];
  } catch {
    /* unten weiter */
  }
  const fallback = jetzt.getMonth();
  return Number.isInteger(fallback) ? MONATE[fallback] : "";
}
