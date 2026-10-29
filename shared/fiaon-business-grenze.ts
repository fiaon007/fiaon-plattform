// ═══════════════════════════════════════════════════════════════════════════
// DIE GRENZE DER BUSINESS-WELT — eine Regel für Browser und Server (E-459, 29.10.2026)
//
// Business ist alles unter /business und /en/business — und die Seiten, die außerhalb dieser Adressen ganz zur
// Business-Welt gehören: seit E-459 die Vertrauensseite „Ist FIAON seriös?“ (Justin 29.10.: „alles auf Business“),
// seit E-461 die Startseite selbst — „wenn man fiaon.com aufmacht sollte Business kommen nicht mehr Privat, wir
// tauschen es quasi aus“ (Justin 29.10.). / und /en sind FIAON Global; /business und /en/business leiten dauerhaft
// dorthin (server/routes.ts, UMGEZOGEN). Die Privat-Startseite wohnt seither unter PRIVAT_START.
// Bewusst eine winzige Datei: client/src/lib/bereich.ts lädt sie auf JEDER Seite (Kopf und Fuß schalten danach um);
// die Liste der Vorschaubilder (fiaon-og-business.ts, 26 KB) bleibt damit beim Server.
// ═══════════════════════════════════════════════════════════════════════════
import { SERIOES_PFAD } from "./fiaon-serioes";

/** Die Startseite von fiaon.com — seit E-461 FIAON Global (vorher /business und /en/business). */
export const BUSINESS_START = { de: "/", en: "/en" } as const;

/** Die Startseite für Privatkunden — seit E-461 eine eigene Adresse (vorher / und /en). */
export const PRIVAT_START = { de: "/privat", en: "/en/private" } as const;

/** Seiten außerhalb von /business, die ganz zur Business-Welt gehören (Adresse bleibt, Rahmen und Daten: FIAON Global). */
export const BUSINESS_EIGENE_PFADE: ReadonlySet<string> = new Set([BUSINESS_START.de, BUSINESS_START.en, SERIOES_PFAD.de, SERIOES_PFAD.en]);

/** Gehört die Adresse zur Business-Welt? */
export const istBusinessPfad = (pfad: string): boolean => {
  const p = (pfad.split(/[?#]/)[0].replace(/\/+$/, "") || "/").toLowerCase();
  return /^\/(en\/)?business(\/|$)/.test(p) || BUSINESS_EIGENE_PFADE.has(p);
};
