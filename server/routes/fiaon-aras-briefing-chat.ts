// ═══════════════════════════════════════════════════════════════════════════
// ARAS — Routen des Auftrags-Chats in der Akte (E-408, Akte-Steuerung, 20.10.2026)
//
// Eingehängt in server/routes/fiaon-aras-akte.ts (router.use) — dieselben Türen wie die Karte „ARAS“:
// requireAgent + darfAnKunde (wer den Kunden betreut, und die Leitung); einen Chat führt weiter, wer ihn begonnen hat (oder
// die Leitung).
//   POST /agent/kunden/:personId/aras/briefing                    { neu? } — öffnen (ein offener Chat läuft weiter)
//   POST /agent/kunden/:personId/aras/briefing/:id/antwort        { text, wert? } — deine Nachricht oder ein Knopf
//   POST /agent/kunden/:personId/aras/briefing/:id/karte          { karte } — „Ändern“ (Felder von Hand)
//   POST /agent/kunden/:personId/aras/briefing/:id/beauftragen    { wann, ab, benachrichtigen } — „Passt – ARAS anrufen lassen“
//   POST /agent/kunden/:personId/aras/briefing/:id/aktion         { aktion: mara | wieder_an | zuruecknehmen | schliessen }
//   GET  /agent/kunden/:personId/aras/briefings                   Aufträge aus dem Chat (für „Geplant“ und „Was ARAS gemacht hat“)
// Antworten { ok, briefing, … } / { ok:false, error, hinweise? }.
// ═══════════════════════════════════════════════════════════════════════════
import { Router, type Response } from "express";
import { requireAgent, type AgentRequest } from "./fiaon-agent";
import { darfAnKunde, rolleVon } from "../lib/fiaon-kundenzugriff";
import {
  BriefingFehler, briefingAgent, briefingAktion, briefingAntworten, briefingBeauftragen, briefingKarteSetzen, briefingStarten, briefingVerlauf,
  type BriefingAgent,
} from "../lib/fiaon-aras-briefing-chat";
import { istBriefingAktion } from "../../shared/fiaon-aras-briefing-chat";

const router = Router();

async function zugang(req: AgentRequest, res: Response): Promise<{ personId: number; agent: BriefingAgent } | null> {
  const personId = Number(req.params.personId);
  if (!Number.isInteger(personId) || personId <= 0) { res.status(400).json({ ok: false, error: "Ungültiger Kunde." }); return null; }
  const rolle = await rolleVon(req.agent!.id);
  if (!(await darfAnKunde(req.agent!.id, rolle, personId))) { res.status(403).json({ ok: false, error: "Nicht dein Kunde." }); return null; }
  return { personId, agent: await briefingAgent(req.agent!.id, String(req.agent!.name ?? `Agent ${req.agent!.id}`), rolle) };
}
const chatId = (req: AgentRequest): number => { const id = Number(req.params.id); return Number.isInteger(id) && id > 0 ? id : 0; };
function fehler(res: Response, e: unknown, wo: string): void {
  if (e instanceof BriefingFehler) { res.status(e.status).json({ ok: false, error: e.message, ...(e.hinweise.length ? { hinweise: e.hinweise } : {}) }); return; }
  console.error(`[ARAS-BRIEFING] ${wo}:`, e);
  res.status(500).json({ ok: false, error: "Der Chat hat gerade gehakt — bitte noch einmal." });
}

router.post("/agent/kunden/:personId/aras/briefing", requireAgent, async (req: AgentRequest, res: Response) => {
  try {
    const z = await zugang(req, res); if (!z) return;
    res.setHeader("Cache-Control", "no-store");
    res.json({ ok: true, briefing: await briefingStarten(z.personId, z.agent, { neu: req.body?.neu === true }) });
  } catch (e) { fehler(res, e, "starten"); }
});

router.post("/agent/kunden/:personId/aras/briefing/:id/antwort", requireAgent, async (req: AgentRequest, res: Response) => {
  try {
    const z = await zugang(req, res); if (!z) return;
    const id = chatId(req); if (!id) return void res.status(400).json({ ok: false, error: "Ungültiger Chat." });
    const b = await briefingAntworten(id, z.personId, z.agent, {
      text: typeof req.body?.text === "string" ? req.body.text : "", wert: typeof req.body?.wert === "string" ? req.body.wert : null,
    });
    res.json({ ok: true, briefing: b });
  } catch (e) { fehler(res, e, "antwort"); }
});

router.post("/agent/kunden/:personId/aras/briefing/:id/karte", requireAgent, async (req: AgentRequest, res: Response) => {
  try {
    const z = await zugang(req, res); if (!z) return;
    const id = chatId(req); if (!id) return void res.status(400).json({ ok: false, error: "Ungültiger Chat." });
    const r = await briefingKarteSetzen(id, z.personId, z.agent, req.body?.karte && typeof req.body.karte === "object" ? req.body.karte : {});
    if (!r.ok) return void res.status(409).json({ ok: false, error: "So gibt ARAS die Karte nicht weiter — bitte anders formulieren.", hinweise: r.hinweise, briefing: r.sicht });
    res.json({ ok: true, briefing: r.sicht });
  } catch (e) { fehler(res, e, "karte"); }
});

router.post("/agent/kunden/:personId/aras/briefing/:id/beauftragen", requireAgent, async (req: AgentRequest, res: Response) => {
  try {
    const z = await zugang(req, res); if (!z) return;
    const id = chatId(req); if (!id) return void res.status(400).json({ ok: false, error: "Ungültiger Chat." });
    const r = await briefingBeauftragen(id, z.personId, z.agent, { wann: req.body?.wann, ab: req.body?.ab, benachrichtigen: req.body?.benachrichtigen });
    if (!r.ok) return void res.status(409).json({ ok: false, error: r.grund ?? "Ließ sich nicht einplanen.", hinweise: r.hinweise, briefing: r.sicht });
    res.json({ ok: true, briefing: r.sicht, meldung: r.meldung });
  } catch (e) { fehler(res, e, "beauftragen"); }
});

router.post("/agent/kunden/:personId/aras/briefing/:id/aktion", requireAgent, async (req: AgentRequest, res: Response) => {
  try {
    const z = await zugang(req, res); if (!z) return;
    const id = chatId(req); if (!id) return void res.status(400).json({ ok: false, error: "Ungültiger Chat." });
    const aktion = String(req.body?.aktion ?? "");
    if (!istBriefingAktion(aktion)) return void res.status(400).json({ ok: false, error: "Unbekannter Knopf." });
    const r = await briefingAktion(id, z.personId, z.agent, aktion, undefined, undefined, typeof req.body?.text === "string" ? req.body.text.slice(0, 80) : "");
    res.status(r.ok ? 200 : 409).json({ ok: r.ok, briefing: r.sicht, meldung: r.meldung, ...(r.ok ? {} : { error: r.sicht.zeilen[r.sicht.zeilen.length - 1]?.text ?? "Ging nicht." }) });
  } catch (e) { fehler(res, e, "aktion"); }
});

router.get("/agent/kunden/:personId/aras/briefings", requireAgent, async (req: AgentRequest, res: Response) => {
  try {
    const z = await zugang(req, res); if (!z) return;
    res.setHeader("Cache-Control", "no-store");
    res.json({ ok: true, briefings: await briefingVerlauf(z.personId) });
  } catch (e) { fehler(res, e, "verlauf"); }
});

export default router;
