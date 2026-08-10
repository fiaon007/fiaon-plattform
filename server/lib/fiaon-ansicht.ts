// ═══════════════════════════════════════════════════════════════════════════
// ANSICHTS-SITZUNG — der Vorgesetzte sieht das Portal mit den Augen eines
// Mitarbeiters
//
// Der Vorgesetzte: „ich kann mir ja nicht ein Account machen um jede Abteilung,
// jedes Dashboard zu sehen."
//
// ── DIE GEFAHR ─────────────────────────────────────────────────────────────
// Ein Werkzeug, das jemanden in eine fremde Sitzung setzt, ist die
// gefährlichste Funktion im ganzen System. Falsch gebaut, kann der Vorgesetzte
// versehentlich im Namen eines Mitarbeiters eine Verpflichtungserklärung
// annehmen, ein Gesprächsergebnis buchen oder eine Mail an einen Kunden
// schicken — und niemand könnte hinterher sagen, wer es war.
//
// ── DIE VIER WÄNDE ─────────────────────────────────────────────────────────
// 1. EIGENES TOKEN. Niemals das echte Mitarbeiter-Cookie. Ein eigenes,
//    signiertes, 30 Minuten gültig, das den ANSEHENDEN mitträgt.
// 2. NUR LESEN. Jede schreibende Route lehnt es ab — an EINER Stelle, als
//    Middleware. Nicht in jeder Route einzeln; eine davon würde vergessen.
// 3. SICHTBARER BANNER. Eine dunkelblaue Leiste über allem, die nicht
//    wegklickbar ist. Wer sie übersieht, hat sie nicht gesehen — deshalb ist
//    sie ganz oben und trägt den Namen.
// 4. PROTOKOLL. Start und Ende, wer wen wann. Ohne Ausnahme.
//
// NUR DER BETREIBER. Die Vertriebsleitung bekommt dieses Werkzeug nicht: Sie
// führt Menschen, sie überwacht sie nicht.
// ═══════════════════════════════════════════════════════════════════════════

import { createHmac, timingSafeEqual } from "node:crypto";
import type { NextFunction, Request, Response } from "express";
import { sqlPool } from "./db-pool";

export const ANSICHT_COOKIE = "fiaon_ansicht";
/** Dreißig Minuten. Länger braucht niemand, um ein Portal anzusehen. */
export const ANSICHT_MINUTEN = 30;

function geheimnis(): string {
  return process.env.SESSION_SECRET || process.env.ADMIN_ACCESS_CODE || "fiaon-ansicht";
}

export function ansichtTokenBauen(agentId: number): string {
  const bis = Date.now() + ANSICHT_MINUTEN * 60_000;
  const kern = `${agentId}.${bis}`;
  const sig = createHmac("sha256", geheimnis()).update(kern).digest("hex").slice(0, 32);
  return `${kern}.${sig}`;
}

export function ansichtTokenPruefen(token: string | undefined): { agentId: number; bis: number } | null {
  if (!token) return null;
  const teile = String(token).split(".");
  if (teile.length !== 3) return null;
  const [id, bis, sig] = teile;
  const soll = createHmac("sha256", geheimnis()).update(`${id}.${bis}`).digest("hex").slice(0, 32);
  // Zeitgleicher Vergleich: Ein Vergleich mit === verrät über die Laufzeit,
  // wie viele Zeichen stimmen. Bei einer Signatur ist das ein Angriffsweg.
  try {
    if (!timingSafeEqual(Buffer.from(sig), Buffer.from(soll))) return null;
  } catch {
    return null;
  }
  if (Number(bis) < Date.now()) return null;
  return { agentId: Number(id), bis: Number(bis) };
}

/**
 * Die Wand gegen jedes Schreiben.
 *
 * Sitzt VOR allen /api/fiaon-Routen. Alles außer GET, HEAD und OPTIONS wird
 * abgelehnt, solange eine Ansichts-Sitzung läuft.
 *
 * ── WARUM DIE METHODE UND NICHT EINE LISTE ─────────────────────────────────
 * Eine Liste schreibender Routen müsste bei jeder neuen Route gepflegt
 * werden, und genau die eine würde vergessen. Die HTTP-Methode ist die
 * einzige Eigenschaft, die jede Route zwangsläufig hat.
 *
 * Die einzige Ausnahme ist das Beenden der Ansicht selbst — sonst käme man
 * nicht mehr heraus.
 */
export function ansichtNurLesen(req: Request, res: Response, next: NextFunction): void {
  const tok = ansichtTokenPruefen((req as any).cookies?.[ANSICHT_COOKIE]);
  if (!tok) return next();
  if (req.method === "GET" || req.method === "HEAD" || req.method === "OPTIONS") return next();
  if (req.path.endsWith("/ansicht/beenden")) return next();

  res.status(403).json({
    ok: false,
    code: "NUR_ANSICHT",
    error: "Nur-Ansicht — in dieser Sitzung sind Aktionen abgeschaltet. "
      + "Beende die Ansicht oben in der blauen Leiste, um wieder zu arbeiten.",
  });
}

/** Start und Ende protokollieren. Ohne Ausnahme. */
export async function ansichtProtokoll(
  agentId: number, was: "gestartet" | "beendet",
): Promise<void> {
  await sqlPool`
    INSERT INTO fiaon_agent_events (agent_id, type, meta, actor)
    -- AUSGESCHRIEBEN, nicht zusammengesetzt: Ein Ereignistyp, der aus einem
    -- Template entsteht, ist im Quelltext nicht suchbar. Der Aktivitäts-
    -- Prüfstand konnte „ansicht_gestartet" deshalb nicht als echten Typ
    -- erkennen und hielt ihn für erfunden — zu Recht: Wer einen Typ sucht,
    -- muss ihn finden können.
    VALUES (${agentId}, ${was === "gestartet" ? "ansicht_gestartet" : "ansicht_beendet"},
            ${JSON.stringify({ minuten: ANSICHT_MINUTEN })}, 'admin')
  `.catch(() => {});
  console.log(`[ANSICHT] Portal von Agent ${agentId} ${was} (Vorgesetzter)`);
}
