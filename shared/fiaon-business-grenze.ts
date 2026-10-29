// ═══════════════════════════════════════════════════════════════════════════
// DIE GRENZE DER BUSINESS-WELT — eine Regel für Browser und Server (E-459, 29.10.2026)
//
// Business ist alles unter /business und /en/business — und die Seiten, die außerhalb dieser Adressen ganz zur
// Business-Welt gehören: seit E-459 die Vertrauensseite „Ist FIAON seriös?“ (Justin 29.10.: „alles auf Business“).
// Bewusst eine winzige Datei: client/src/lib/bereich.ts lädt sie auf JEDER Seite (Kopf und Fuß schalten danach um);
// die Liste der Vorschaubilder (fiaon-og-business.ts, 26 KB) bleibt damit beim Server.
// ═══════════════════════════════════════════════════════════════════════════
import { SERIOES_PFAD } from "./fiaon-serioes";

/** Seiten außerhalb von /business, die ganz zur Business-Welt gehören (Adresse bleibt, Rahmen und Daten: FIAON Global). */
export const BUSINESS_EIGENE_PFADE: ReadonlySet<string> = new Set([SERIOES_PFAD.de, SERIOES_PFAD.en]);

/** Gehört die Adresse zur Business-Welt? */
export const istBusinessPfad = (pfad: string): boolean => {
  const p = (pfad.split(/[?#]/)[0].replace(/\/+$/, "") || "/").toLowerCase();
  return /^\/(en\/)?business(\/|$)/.test(p) || BUSINESS_EIGENE_PFADE.has(p);
};
