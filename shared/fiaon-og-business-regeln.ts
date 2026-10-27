// ═══════════════════════════════════════════════════════════════════════════
// VORSCHAUBILDER DER BUSINESS-WELT — DIE REGELN (27.10.2026, E-439)
//
// Justin: „Jeder Link, den wir vom Business teilen, soll darauf aufbauen und so aussehen.“
// Jede Business-Adresse bekommt ein eigenes 1200×630-Bild (scripts/og-business-bilder.ts);
// die Liste steht in shared/fiaon-og-business.ts (GENERIERT). Hier steht nur, wie aus
// einem Pfad ein Dateiname und eine Bildadresse wird — Server, Skript und Prüfstand
// lesen dieselbe Regel.
// Redaktionsartikel, die nach dem letzten Skriptlauf erschienen sind, tragen das
// Redaktionsbild ihrer Sprache — nie das Bonitäts-Bild aus index.html.
// ═══════════════════════════════════════════════════════════════════════════
import { OG_BUSINESS } from "./fiaon-og-business";

/** Cache-Bruch: bei neuer Bildfassung hochzählen (Plattformen wie LinkedIn halten Bilder sonst Tage). */
export const OG_BUSINESS_VERSION = 1;

/** Die zwei Pseudo-Pfade des Redaktionsbilds (keine Seite, nur ein Bild). */
export const OG_BUSINESS_REDAKTION = { de: "/business/wissen/~redaktion", en: "/en/business/knowledge/~redaktion" } as const;

/** Schlüssel eines Redaktionsartikels (fiaon_ratgeber, bereich business) in der Bildliste. */
export const ogArtikelSchluessel = (slug: string) => `artikel:${slug}`;

/** „/en/business/knowledge/form-a-us-llc“ → „en--business--knowledge--form-a-us-llc“; „artikel:x“ → „artikel--x“. */
export function ogDateiName(pfad: string): string {
  return pfad.replace(/^artikel:/, "artikel/").replace(/^\/+|\/+$/g, "").replace(/~/g, "").replace(/\//g, "--") || "start";
}

/** Bildadresse + Alternativtext für eine Business-Adresse — null, wenn es (noch) kein eigenes Bild gibt. */
export function ogBusinessBild(pfad: string): { url: string; alt: string } | null {
  const e = OG_BUSINESS[pfad.split(/[?#]/)[0]];
  return e ? { url: `https://fiaon.com/og/business/${e.datei}.jpg?v=${OG_BUSINESS_VERSION}`, alt: e.alt } : null;
}

/** Für Redaktionsartikel (bereich business): eigenes Bild, sonst das Redaktionsbild der Sprache. */
export function ogBusinessArtikelBild(slug: string, sprache: "de" | "en"): { url: string; alt: string } | null {
  return ogBusinessBild(ogArtikelSchluessel(slug)) ?? ogBusinessBild(OG_BUSINESS_REDAKTION[sprache]);
}

/** Gehört die Adresse zur Business-Welt? (Dieselbe Grenze wie client/src/lib/bereich.ts.) */
export const istBusinessPfad = (pfad: string) => /^\/(en\/)?business(\/|$)/.test(pfad.split(/[?#]/)[0]);
