// ═══════════════════════════════════════════════════════════════════════════
// ARAS — „Ja zum Anruf“ in der Akte (E-408 Scheibe 3, 22.10.2026)
//
// Eingehängt in server/routes/fiaon-aras-akte.ts (router.use) — dieselben Türen wie die Karte „ARAS“:
// requireAgent + darfAnKunde (wer den Kunden betreut, und die Leitung).
//   GET  /agent/kunden/:personId/aras/ja                 Lage: das aktuelle Ja (oder sein Widerruf), darf Mara fragen?, Gespräch
//   POST /agent/kunden/:personId/aras/ja/eintragen       { bestaetigt: true } — „Ja zum Anruf eintragen“ (Art „chef“)
//   POST /agent/kunden/:personId/aras/ja/widerrufen      {} — „Ja widerrufen“
//   POST /agent/kunden/:personId/aras/ja/mara-fragt      {} — „Mara fragt nach dem Ja“ (nur bei offenem WhatsApp-Fenster)
// Antworten { ok, … } / { ok:false, error }. Die Regeln stehen in server/lib/fiaon-ja-zum-anruf.ts.
// ═══════════════════════════════════════════════════════════════════════════
import { Router, type Response } from "express";
import { requireAgent, type AgentRequest } from "./fiaon-agent";
import { darfAnKunde, rolleVon } from "../lib/fiaon-kundenzugriff";
import { jaLage, jaEintragen, jaWiderrufen, maraFragtNachDemJa } from "../lib/fiaon-ja-zum-anruf";

const router = Router();
const fehler = (res: Response, status: number, text: string) => res.status(status).json({ ok: false, error: text });

async function zugang(req: AgentRequest, res: Response): Promise<{ personId: number; agentId: number; agentName: string } | null> {
  const personId = Number(req.params.personId);
  if (!Number.isInteger(personId) || personId <= 0) { fehler(res, 400, "Ungültiger Kunde."); return null; }
  const rolle = await rolleVon(req.agent!.id);
  if (!(await darfAnKunde(req.agent!.id, rolle, personId))) { fehler(res, 403, "Nicht dein Kunde."); return null; }
  return { personId, agentId: req.agent!.id, agentName: String(req.agent!.name ?? `Agent ${req.agent!.id}`) };
}

router.get("/agent/kunden/:personId/aras/ja", requireAgent, async (req: AgentRequest, res: Response) => {
  try {
    const z = await zugang(req, res); if (!z) return;
    res.setHeader("Cache-Control", "no-store");
    const lage = await jaLage(z.personId, z.agentId);
    if (!lage) return fehler(res, 404, "Diesen Kunden gibt es nicht.");
    res.json(lage);
  } catch (e) {
    console.error("[JA-ZUM-ANRUF] Lage:", e);
    fehler(res, 500, "„Ja zum Anruf“ ließ sich nicht laden.");
  }
});

router.post("/agent/kunden/:personId/aras/ja/eintragen", requireAgent, async (req: AgentRequest, res: Response) => {
  try {
    const z = await zugang(req, res); if (!z) return;
    // Nur ein echtes true zählt — kein „true“ als Text, kein fehlendes Häkchen.
    const r = await jaEintragen({ ...z, bestaetigt: req.body?.bestaetigt });
    if (!r.ok) return fehler(res, r.status, r.grund);
    res.json({ ok: true, id: r.id, meldung: r.meldung });
  } catch (e) {
    console.error("[JA-ZUM-ANRUF] Eintragen:", e);
    fehler(res, 500, "Nicht gespeichert — bitte noch einmal.");
  }
});

router.post("/agent/kunden/:personId/aras/ja/widerrufen", requireAgent, async (req: AgentRequest, res: Response) => {
  try {
    const z = await zugang(req, res); if (!z) return;
    const r = await jaWiderrufen(z);
    if (!r.ok) return fehler(res, r.status, r.grund);
    res.json({ ok: true, anzahl: r.anzahl, meldung: r.meldung });
  } catch (e) {
    console.error("[JA-ZUM-ANRUF] Widerrufen:", e);
    fehler(res, 500, "Nicht widerrufen — bitte noch einmal.");
  }
});

router.post("/agent/kunden/:personId/aras/ja/mara-fragt", requireAgent, async (req: AgentRequest, res: Response) => {
  try {
    const z = await zugang(req, res); if (!z) return;
    const r = await maraFragtNachDemJa(z);
    if (!r.ok) return fehler(res, r.status, r.grund);
    res.json({ ok: true, meldung: r.meldung });
  } catch (e) {
    console.error("[JA-ZUM-ANRUF] Mara fragt:", e);
    fehler(res, 500, "Mara konnte gerade nicht fragen — bitte noch einmal.");
  }
});

export default router;
