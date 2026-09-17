// ═══════════════════════════════════════════════════════════════════════════
// FIAON GLOBAL — WOHIN EIN KNOPF FÜHRT (17.09.2026, E-188)
//
// ── WARUM DIESE DATEI ──────────────────────────────────────────────────────
// Bis heute zeigten elf Stellen auf /business-antrag — die Startseite, die
// Preisseite, das Firmen-Cockpit, die Info-Mail, das Wissen des Assistenten.
// Zwei davon schrieben den Paket-Parameter „pack", der Antrag las „package":
// Die Vorauswahl war tot, und niemand hat es gemerkt, weil jede Stelle ihren
// Link selbst zusammensetzte.
//
// Seit E-188 gibt es für Unternehmen zwei Wege, und beide beginnen auf der
// Seite /business: DIREKT BEAUFTRAGEN (/business/start?paket=…) oder ERST
// SPRECHEN (/business#gespraech). Wer darauf verlinkt, holt den Pfad hier —
// ändert sich der Weg, ändert er sich an einer Stelle.
//
// ── ENGLISCH ───────────────────────────────────────────────────────────────
// /en/business ist die englische Seite. Einen englischen Auftragsweg gibt es
// (noch) nicht als eigene Adresse; englische Leser landen deshalb bei den
// Paketen der englischen Seite und gehen von dort weiter. Kommt
// /en/business/start, ist es HIER eine Zeile.
// ═══════════════════════════════════════════════════════════════════════════
import { globalPaket } from "./fiaon-global";

export type GlobalSprache = "de" | "en";

/** Die Seite FIAON Global. */
export function globalSeitePfad(sprache: GlobalSprache = "de"): string {
  return sprache === "en" ? "/en/business" : "/business";
}

/** Die Pakete auf der Seite. */
export function globalPaketePfad(sprache: GlobalSprache = "de"): string {
  return `${globalSeitePfad(sprache)}#pakete`;
}

/** „Erst sprechen" — der Kalender auf der Seite. */
export function globalGespraechPfad(sprache: GlobalSprache = "de"): string {
  return `${globalSeitePfad(sprache)}#gespraech`;
}

/**
 * „Direkt beauftragen" — mit vorgewähltem Paket, wenn der Schlüssel stimmt.
 * Ein unbekannter Schlüssel führt zum Auftrag ohne Vorauswahl, nie ins Leere.
 */
export function globalStartPfad(key?: unknown, sprache: GlobalSprache = "de"): string {
  if (sprache === "en") return globalPaketePfad("en");
  const g = globalPaket(key);
  return g ? `/business/start?paket=${encodeURIComponent(g.key)}` : "/business/start";
}

/** Dasselbe als vollständige Adresse — für Mails, WhatsApp und die Zwischenablage. */
export function globalStartUrl(key?: unknown): string {
  return `https://fiaon.com${globalStartPfad(key, "de")}`;
}

export const GLOBAL_SEITE_URL = "https://fiaon.com/business";
export const GLOBAL_GESPRAECH_URL = "https://fiaon.com/business#gespraech";
