// ═══════════════════════════════════════════════════════════════════════════
// ARAS — Go-live mit echten Kunden (E-408, Koordination 20.10.2026 abends)
//
// Justin (20.10.2026): „… stelle sie live — sie soll bitte jeden Tag von 09:30 Uhr bis 21:00 Uhr arbeiten“. Start ist MORGEN,
// 21.10.2026 um 09:30 (Berlin) — nicht heute Abend. Der Takt prüft jede Minute; ab dem Startzeitpunkt setzt er die Einstellungen
// GENAU EINMAL und hinterlegt einen Merker in fiaon_settings — danach nie wieder (Justin kann alles im KI-Team umstellen, und
// der Go-live überschreibt es nicht noch einmal). Not-Aus und Leerlauf bleiben unberührt und jederzeit verfügbar.
//
// Stufe 1 (shared/fiaon-aras.ts STUFEN): 40 Anrufe am Tag, einer gleichzeitig, 20 € am Tag. Der automatische Aufstieg nach drei
// grünen Tagen bleibt, wie er ist (fiaon-aras-stufe.ts).
// ═══════════════════════════════════════════════════════════════════════════
import { sqlPool } from "./db-pool";
import { einstellungSetzen, arasEinstellungenVergessen } from "./fiaon-aras-plan";
import { FENSTER_VORGABE, SPIELARTEN, type Spielart } from "../../shared/fiaon-aras";

type Lauf = typeof sqlPool;

/** Ab wann (Berlin, Sommerzeit bis 25.10.2026). */
export const GOLIVE_AB = "2026-10-21T09:30:00+02:00";
/** Der Merker — steht er, läuft der Go-live nie wieder. */
export const GOLIVE_MERKER = "aras_golive_21_10";
/**
 * Nur „Willkommen nach Antrag“ und „Rate offen“ — alles andere aus (die Probe bleibt immer möglich). Dazu „termin“: das sind
 * NUR die Rückrufe, die ein Kunde in einem dieser Gespräche selbst bei ARAS bucht („rufen Sie mich um sechs an“) — ohne sie
 * hielte ARAS ihr „ich rufe Sie dann an“ nie (und Sonntag/Feiertag gelten genau diese gebuchten Rückrufe, Justin 20.10.).
 */
const AN: readonly Spielart[] = ["willkommen", "rate", "termin", "probe"];
export const GOLIVE_SPIELARTEN: Record<string, "an" | "aus"> = Object.fromEntries(SPIELARTEN.map((s) => [s, AN.includes(s) ? "an" : "aus"]));
/** Die Einstellungen des Go-live (Justin: Juni, ultra wienerisch, mehr Lachen und Gefühl, ein bisschen schneller). */
export const GOLIVE_WERTE: Readonly<Record<string, string>> = {
  aras_stufe: "1",
  aras_spielarten: JSON.stringify(GOLIVE_SPIELARTEN),
  aras_stimme: "juni",
  aras_dialekt: "oesterreichisch_stark",
  aras_tempo: "zuegig",
  aras_menschlich: "viel",
  aras_lachen: "an",
  aras_fenster: JSON.stringify(FENSTER_VORGABE),
  aras_parallel: "1",
  aras_tag_euro: "20",
  aras_vorbereiten: "klingeln",
  // Zuletzt: erst wenn alles andere steht, wählt ARAS.
  aras_an: "an",
};

/**
 * Einmal-Schalter. Liefert true, wenn er JETZT gelaufen ist. Erst der Merker (wer ihn setzt, gewinnt — auch bei zwei
 * Instanzen), dann die Werte über einstellungSetzen (dieselbe Prüfung und dasselbe Protokoll wie im KI-Team).
 */
export async function golivePruefen(lauf: Lauf = sqlPool, jetzt: Date = new Date()): Promise<boolean> {
  if (jetzt.getTime() < Date.parse(GOLIVE_AB)) return false;
  const gesetzt = (await lauf`
    INSERT INTO fiaon_settings (key, value, updated_at) VALUES (${GOLIVE_MERKER}, ${jetzt.toISOString()}, NOW())
    ON CONFLICT (key) DO NOTHING RETURNING key`) as any[];
  if (!gesetzt.length) return false;
  for (const [k, v] of Object.entries(GOLIVE_WERTE)) await einstellungSetzen(k, v, "go-live 21.10.2026", lauf);
  arasEinstellungenVergessen();
  console.log("[ARAS] Go-live: Stufe 1, Willkommen + Rate offen (+ gebuchte Rückrufe), Juni, Wienerisch ultra, Mo–Sa 09:30–21:00 — ARAS wählt.");
  return true;
}
