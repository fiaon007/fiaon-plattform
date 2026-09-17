// ═══════════════════════════════════════════════════════════════════════════
// DER MERKER FÜR DEN RAUM „GLOBAL" IN DER OFFICE-LEISTE (17.09.2026, E-188)
//
// Den Raum /agent/global sieht nur, wem der Server den Zugriff bestätigt
// (zuständige Person, Vertriebsleitung, Leitung). Die Leiste (OfficeShell) baut
// sich mit jeder Seite neu auf — ohne Merker fragte sie bei jedem Klick im
// Office den Server. Zehn Minuten reichen: Wechselt die Leitung die zuständige
// Person, sieht die neue den Raum spätestens dann, oder sofort nach dem Neuladen.
//
// Bewusst eine eigene, winzige Datei OHNE Importe: OfficeShell steckt in jeder
// Mitarbeiterseite. Läge der Merker in global-logik.ts, zöge die Leiste den
// Paketkatalog und den Leitfaden in jede Seite des Office mit.
// ═══════════════════════════════════════════════════════════════════════════
const MERKER = "fiaon_global_zugriff";
const MERKER_MS = 10 * 60_000;
export function globalZugriffLesen(email: string | undefined | null): boolean | null {
  try {
    const roh = JSON.parse(window.sessionStorage.getItem(MERKER) || "null");
    if (!roh || roh.email !== String(email || "") || Date.now() - Number(roh.am) > MERKER_MS) return null;
    return roh.ja === true;
  } catch { return null; }
}
export function globalZugriffMerken(email: string | undefined | null, ja: boolean): void {
  try { window.sessionStorage.setItem(MERKER, JSON.stringify({ email: String(email || ""), ja, am: Date.now() })); } catch { /* ohne Merker fragt die Leiste eben erneut */ }
}
