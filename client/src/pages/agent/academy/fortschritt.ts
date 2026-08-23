// ═══════════════════════════════════════════════════════════════════════════
// FIAON Academy — Fortschritt (23.08.2026, Plan §11)
// Hook `useAcademyFortschritt()` für Academy und Dashboard (Prozent, Urkunde),
// dazu die Aufrufe an /agent/academy/* (server/routes/fiaon-office-academy.ts).
// ═══════════════════════════════════════════════════════════════════════════
import { useCallback, useEffect, useState } from "react";
import { api } from "../shared";

export interface SchrittStand { kapitel: string; schritt: string; geoeffnet_am: string | null; bestanden: boolean; punkte: number | null; gesamt: number | null; zeit: number; ergebnis: any }
export interface KapitelStand { key: string; nr: number; titel: string; frei: boolean; fertigSchritte: number; gesamtSchritte: number; uebungenFertig: boolean; testBestanden: boolean; testPunkte: number | null; testGesamt: number | null; prozent: number }
export interface PruefungsLage { frei: boolean; laufend: { id: number; gestartetAm: string } | null; versucheDieseWoche: number; versucheFrei: number; sperreBis: string | null; letzte: { punkte: number; gesamt: number; bestanden: boolean; am: string; tabwechsel: number } | null; regeln: { fragen: number; sekundenJeFrage: number; sekundenGesamt: number; schwelle: number; sperreStunden: number; versucheJeWoche: number } }
export interface Zertifikat { nummer: string; bestandenAm: string; punkte: number; gesamt: number; pruefCode: string; stufe: string }
export interface Fortschritt { schritte: SchrittStand[]; kapitel: KapitelStand[]; prozent: number; pruefung: PruefungsLage; zertifikat: Zertifikat | null; testSchwelle: number }

export async function fortschrittLaden(): Promise<Fortschritt | null> {
  const r = await api("/agent/academy/fortschritt");
  return r.ok ? (r.json as Fortschritt) : null;
}

export async function schrittOeffnen(kapitel: string, schritt: string): Promise<{ ok: boolean; geoeffnetAm?: string; minSekunden?: number; error?: string }> {
  const r = await api("/agent/academy/fortschritt", { method: "POST", body: JSON.stringify({ kapitel, schritt, aktion: "oeffnen" }) });
  return r.ok ? { ok: true, geoeffnetAm: r.json.geoeffnetAm, minSekunden: r.json.minSekunden } : { ok: false, error: r.json?.error || "Nicht gespeichert." };
}

export async function schrittFertig(kapitel: string, schritt: string, daten?: { punkte?: number; gesamt?: number; ergebnis?: any }): Promise<{ ok: boolean; bestanden?: boolean; restSekunden?: number; error?: string; kapitel?: KapitelStand[]; prozent?: number }> {
  const r = await api("/agent/academy/fortschritt", { method: "POST", body: JSON.stringify({ kapitel, schritt, aktion: "fertig", ...(daten || {}) }) });
  if (r.ok) return { ok: true, bestanden: r.json.bestanden, kapitel: r.json.kapitel, prozent: r.json.prozent };
  return { ok: false, error: r.json?.error || "Nicht gespeichert.", restSekunden: r.json?.restSekunden };
}

/**
 * Fortschritt des eingeloggten Mitarbeiters – für die Academy selbst und für
 * das Dashboard („Academy 37 %“, Urkunde). Lädt einmal, `neu()` lädt nach.
 */
export function useAcademyFortschritt() {
  const [stand, setStand] = useState<Fortschritt | null>(null);
  const [laedt, setLaedt] = useState(true);
  const [fehler, setFehler] = useState<string | null>(null);
  const neu = useCallback(async () => {
    try { const f = await fortschrittLaden(); setStand(f); setFehler(f ? null : "Der Stand konnte nicht geladen werden."); }
    catch { setFehler("Keine Verbindung."); }
    finally { setLaedt(false); }
  }, []);
  useEffect(() => { neu(); }, [neu]);
  const prozent = stand?.prozent ?? 0;
  const zertifiziert = !!stand?.zertifikat;
  const naechstesKapitel = stand?.kapitel.find((k) => k.frei && !k.testBestanden) ?? null;
  return { stand, laedt, fehler, neu, prozent, zertifiziert, zertifikat: stand?.zertifikat ?? null, naechstesKapitel };
}
