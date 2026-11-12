// ═══════════════════════════════════════════════════════════════════════════
// FIAON GLOBAL — VERKAUFSMOTOR: PREISE UND KAPITALRAHMEN ALS BLATT OHNE IMPORTE (Register E-509, 12.11.2026)
//
// Diese Datei importiert NICHTS. So kann jede Stelle sie lesen, ohne einen Kreis zu schließen — auch die
// Suchmaschinen-Tabelle (shared/fiaon-seo-seiten.ts) und die Seitentexte. shared/fiaon-global-verkauf.ts reicht alles
// von hier weiter; dort stehen Erfolgshonorar (Staffel aus E-505), Weiche, Eingabeprüfung und Texte.
// ═══════════════════════════════════════════════════════════════════════════
export type VerkaufSprache = "de" | "en";

// ── PREISE — EINE QUELLE ──
// Gründung mit aktiver Betreuung im ersten Jahr, Fast-Track (wählbar) und Jahresbetreuung ab dem zweiten Jahr: die Preise,
// zu denen seit November 2026 jedes Kapital-Angebot angelegt wird. KAPITAL_C_VORGABEN bleibt unberührt (dort steht der
// Rückfall für Bestandsangebote). Das Erfolgshonorar steht NICHT hier: Es folgt der Staffel aus E-505.
export const VERKAUF_PREISE = {
  gruendungCents: 279_900,
  fastTrackCents: 49_900,
  jahresCents: 69_900,
} as const;

/**
 * Der Kapitalrahmen des Reglers. Bis `selbstMaxUsd` schließt der Kunde selbst ab; `maxUsd` (1 Mio.) ist der Miami-Fall —
 * Justin: „ab 1 Mio sollte man persönlich in Miami sein, der Rest ist remote abwickelbar“. `schrittUsd` ist das Raster des
 * Vertragsmotors (kapitalCRahmenGueltig): Jeder Rasterpunkt des Konfigurators liegt darauf.
 */
export const VERKAUF_RAHMEN = {
  minUsd: 50_000,
  maxUsd: 1_000_000,
  selbstMaxUsd: 950_000,
  schrittUsd: 10_000,
  startUsd: 150_000,
} as const;

/** „2.799 €“ / „€2,799“ — ganze Euro. */
export function verkaufEur(cents: number, s: VerkaufSprache = "de"): string {
  const euro = Math.round(cents / 100);
  return s === "en" ? `€${euro.toLocaleString("en-GB")}` : `${euro.toLocaleString("de-DE")} €`;
}
/** „150.000 US-$“ / „US$150,000“ */
export function verkaufUsd(usd: number, s: VerkaufSprache = "de"): string {
  return s === "en" ? `US$${Math.round(usd).toLocaleString("en-GB")}` : `${Math.round(usd).toLocaleString("de-DE")} US-$`;
}
