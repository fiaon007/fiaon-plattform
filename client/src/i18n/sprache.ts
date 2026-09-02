// ═══════════════════════════════════════════════════════════════════════════
// SPRACHE IM CLIENT — aus der Adresse, nie aus dem Speicher (02.09.2026)
//
// Die Sprache einer Seite steht in ihrer Adresse (/en/...). Der Client liest
// sie von dort — kein localStorage, keine automatische Weiterleitung (Google
// mag keine Sprachweiterleitungen, und ein Mensch, der bewusst /en öffnet,
// soll Englisch bekommen). Die Wahl merken wir uns nur für den leisen
// Hinweis „Read in English?" auf deutschen Seiten (kommt mit Scheibe 2).
// ═══════════════════════════════════════════════════════════════════════════
import { useLocation } from "wouter";
import { spracheVonPfad, type Sprache } from "@shared/fiaon-sprache";
import { schwesterPfad } from "@shared/fiaon-seo-seiten";

export function useSprache(): Sprache {
  const [pfad] = useLocation();
  return spracheVonPfad(pfad);
}

/** Wählt den Text zur Sprache — `S("Preise", "Pricing")`. */
export function useS() {
  const sprache = useSprache();
  return <T,>(de: T, en: T): T => (sprache === "en" ? en : de);
}

/** Ein Wörterbuch je Seite: { de: {...}, en: {...} } → die passende Hälfte. */
export function useWoerter<T extends Record<string, unknown>>(w: { de: T; en: T }): T {
  const sprache = useSprache();
  return sprache === "en" ? w.en : w.de;
}

/** Ein Link, in der aktuellen Sprache: die englische Schwester, wo es sie gibt — sonst die deutsche Seite. */
export function inSprache(pfad: string, sprache: Sprache): string {
  if (sprache === "de") return pfad;
  return schwesterPfad(pfad, "en") ?? pfad;
}
