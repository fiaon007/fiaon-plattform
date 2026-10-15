// ═══════════════════════════════════════════════════════════════════════════
// EIGENE BESUCHERMESSUNG — DIE ROUTEN (15.10.2026, E-378)
//
//   POST /besuch                  öffentlich: ein Seitenaufruf oder das Ende einer
//                                 Seite (client/src/lib/besuch.ts, sendBeacon)
//   GET  /chef/besucher           Chefbüro › Besucher: alles für die Seite, ein Abruf
//   GET  /chef/besucher/live      wer gerade da ist (die Seite fragt alle 30 s)
//
// Die Messung antwortet IMMER sofort mit 204 und arbeitet danach — ein Besucher
// wartet nie auf unsere Statistik. Fehler landen im Protokoll, höchstens einmal
// je Minute, damit ein Datenbank-Schluckauf das Protokoll nicht flutet.
// ═══════════════════════════════════════════════════════════════════════════
import { Router, type Request, type Response } from "express";
import { requireChef } from "./fiaon-chef-zugang";
import { aufrufClientIp } from "../lib/fiaon-global-angebot-aufrufe";
import { anfrageWirt, besuchAufnehmen, besuchAuswertung, besuchEnde, besuchLive, besuchZaehltNicht } from "../lib/fiaon-besuch";
import { besuchFilterAus, besuchNutzlast } from "@shared/fiaon-besuch";

const router = Router();

// ── Bremse je Anschluss ──────────────────────────────────────────────────────
// Großzügig: Hinter einer Mobilfunk-Adresse stehen oft Hunderte Menschen. Wer mehr als
// 600 Meldungen in zehn Minuten schickt, ist kein Mensch — er füllt nur die Messung nicht.
const FENSTER_MS = 10 * 60_000;
const JE_ANSCHLUSS = 600;
const zaehler = new Map<string, { n: number; bis: number }>();
export function besuchBremse(schluessel: string, jetzt = Date.now()): boolean {
  if (zaehler.size > 20_000) {
    zaehler.forEach((v, k) => { if (v.bis < jetzt) zaehler.delete(k); });
    if (zaehler.size > 20_000) for (const k of Array.from(zaehler.keys()).slice(0, 5000)) zaehler.delete(k);
  }
  const z = zaehler.get(schluessel);
  if (!z || z.bis < jetzt) { zaehler.set(schluessel, { n: 1, bis: jetzt + FENSTER_MS }); return true; }
  z.n++;
  return z.n <= JE_ANSCHLUSS;
}

let letzterFehler = 0;
function fehlerMelden(was: string, err: unknown) {
  if (Date.now() - letzterFehler < 60_000) return;
  letzterFehler = Date.now();
  console.error(`[BESUCH] ${was}:`, (err as any)?.message || err);
}

// ═══════════════════════════════════════════════════════════════════════════
// POST /besuch — öffentlich, ohne Cookie, ohne Antwortinhalt
// ═══════════════════════════════════════════════════════════════════════════
router.post("/besuch", (req: Request, res: Response) => {
  res.status(204).end();
  try {
    // Nur von unserer eigenen Seite: Ein fremdes Skript, das hierher schickt, zählt nicht.
    const herkunft = String(req.headers["sec-fetch-site"] || "");
    if (herkunft && herkunft !== "same-origin") return;
    if ((req as any).rawBody && String((req as any).rawBody).length > 2000) return;
    if (besuchZaehltNicht(req)) return;
    if (!besuchBremse(aufrufClientIp(req as any) || "unbekannt")) return;
    const n = besuchNutzlast(req.body, anfrageWirt(req));
    if (!n) return;
    const arbeit = n.art === "ende" ? besuchEnde(req, n) : besuchAufnehmen(req, n);
    void (arbeit as Promise<unknown>).catch((err) => fehlerMelden(n.art, err));
  } catch (err) {
    fehlerMelden("annehmen", err);
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// GET /chef/besucher — die Auswertung (Zeitraum, Vergleich, Filter)
// ═══════════════════════════════════════════════════════════════════════════
router.get("/chef/besucher", requireChef("leitung"), async (req: Request, res: Response) => {
  try {
    const q = req.query as Record<string, unknown>;
    const daten = await besuchAuswertung(String(q.z || "7"), q.von, q.bis, besuchFilterAus(q), q.vgl === "1");
    res.json({ ok: true, ...daten });
  } catch (err) {
    console.error("[BESUCH] Auswertung:", err);
    res.status(500).json({ ok: false, error: "Die Besucherzahlen ließen sich nicht laden." });
  }
});

router.get("/chef/besucher/live", requireChef("leitung"), async (_req: Request, res: Response) => {
  try {
    res.json({ ok: true, ...(await besuchLive()) });
  } catch (err) {
    fehlerMelden("live", err);
    res.status(500).json({ ok: false, error: "Serverfehler" });
  }
});

export default router;
