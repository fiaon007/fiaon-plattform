// ═══════════════════════════════════════════════════════════════════════════
// DIE ADRESSE EINES REDAKTIONSARTIKELS DER BUSINESS-WELT (27.10.2026, E-439)
//
// Die Tagesartikel der Redaktion (fiaon_ratgeber, bereich = business) standen unter
// /ratgeber/<slug> — im Rahmen der Privatkunden, mit dem Bonitäts-Bild und ohne
// Sprache. Seit E-439 wohnen sie in der Business-Welt: deutsch unter
// /business/wissen/<slug>, englisch unter /en/business/knowledge/<slug>.
// /ratgeber/<slug> leitet für Business-Artikel dauerhaft (301) dorthin.
// Server (Vorrenderer, Sitemap, llms.txt) und Client (Links, Weiterleitung) rechnen
// den Pfad hier — an EINER Stelle.
// ═══════════════════════════════════════════════════════════════════════════
export type ArtikelSprache = "de" | "en";

export function businessArtikelPfad(slug: string, sprache: ArtikelSprache | string | null | undefined): string {
  return sprache === "en" ? `/en/business/knowledge/${slug}` : `/business/wissen/${slug}`;
}

/** Aus einer Adresse unter /business/wissen/<slug> oder /en/business/knowledge/<slug> → Slug und Sprache (sonst null). */
export function businessArtikelAusPfad(pfad: string): { slug: string; sprache: ArtikelSprache } | null {
  const m = /^\/(?:(en)\/business\/knowledge|business\/wissen)\/([a-z0-9][a-z0-9-]*)\/?$/.exec(pfad.split(/[?#]/)[0]);
  return m ? { slug: m[2], sprache: m[1] ? "en" : "de" } : null;
}
