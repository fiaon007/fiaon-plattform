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
// /en/business ist die englische Seite, /en/business/start der englische
// Auftrag — dieselbe Strecke, die Sprache kommt aus der Adresse.
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
 * `art: "privat"` (19.09.2026, E-191) öffnet den Auftrag gleich für eine Privatperson.
 */
export function globalStartPfad(key?: unknown, sprache: GlobalSprache = "de", art?: "privat"): string {
  const basis = sprache === "en" ? "/en/business/start" : "/business/start";
  const g = globalPaket(key);
  const q = [g ? `paket=${encodeURIComponent(g.key)}` : null, art === "privat" ? "art=privat" : null].filter(Boolean);
  return q.length ? `${basis}?${q.join("&")}` : basis;
}

/** Dasselbe als vollständige Adresse — für Mails, WhatsApp und die Zwischenablage. */
export function globalStartUrl(key?: unknown): string {
  return `https://fiaon.com${globalStartPfad(key, "de")}`;
}

/**
 * „Mein Auftrag" — die Seite des Firmenkunden nach dem Kauf: Stand, Etappen,
 * Vertrag, Rechnung, Dokumentenraum, Pflichtenkalender. Kein Login; der Zugang
 * ist das signierte Token aus server/lib/fiaon-global-auftrag.ts
 * (globalTokenErzeugen), gebunden an die Antragsnummer. Englisch geführte
 * Aufträge öffnen die englische Seite (/en/business/auftrag/…).
 */
export function globalMeinAuftragPfad(ref: string, token: string, sprache: GlobalSprache = "de"): string {
  return `${globalSeitePfad(sprache)}/auftrag/${encodeURIComponent(ref)}?t=${encodeURIComponent(token)}`;
}

/** Derselbe Auftrag im Office — die Seite der zuständigen Person. */
export function globalOfficeAuftragPfad(ref: string): string {
  return `/agent/global/${encodeURIComponent(ref)}`;
}

export const GLOBAL_SEITE_URL = "https://fiaon.com/business";
export const GLOBAL_GESPRAECH_URL = "https://fiaon.com/business#gespraech";
