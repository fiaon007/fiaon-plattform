// ═══════════════════════════════════════════════════════════════════════════
// DOKUMENTE & UNTERSCHRIFTEN — die Routen des Teams (22.10.2026)
//
// Zwei Türen, dieselben Funktionen (server/lib/fiaon-global-unterschrift.ts):
//   /chef/global/mandate/:ref/formulare…   Chefbüro (requireChef „leitung“)
//   /agent/global/auftraege/:ref/formulare… Office (zuständige Person, Vertriebsleitung, Chef —
//                                           globalOfficeZugriff; die Ansichts-Sitzung schreibt nie)
// Was: Übersicht mit Stand und fehlenden Angaben · Angaben speichern · Vorschau (PDF, nichts
// abgelegt) · Erzeugen · FIAON unterschreibt (Statement of Organizer) · zur Unterschrift
// bereitstellen · Prüfen (Prüfsumme + Siegel). Antworten an das Team: Du-Form.
// ═══════════════════════════════════════════════════════════════════════════
import { Router, type Request, type Response } from "express";
import { sqlPool } from "../lib/db-pool";
import { requireChef, readChef, type ChefRequest } from "./fiaon-chef-zugang";
import { requireAgent, type AgentRequest } from "./fiaon-agent";
import { hasAdminCode } from "./fiaon-admin-zugang";
import { globalBereichZustaendig } from "../lib/fiaon-global-bereich";
import { globalOfficeZugriff, globalDateinameKopf } from "../lib/fiaon-global-bereich-regeln";

const router = Router();
type Agent = { id: number; name: string };
const clientIp = (req: Request) => ((req.headers["x-forwarded-for"] as string) || "").split(",")[0].trim() || req.socket?.remoteAddress || "";
const ua = (req: Request) => String(req.headers["user-agent"] || "").slice(0, 300);

async function chefWer(req: Request): Promise<Agent> {
  const c = (req as ChefRequest).chef;
  if (c?.agentId) {
    const [a] = (await sqlPool`SELECT id, name FROM fiaon_agents WHERE id = ${c.agentId} LIMIT 1`.catch(() => [])) as any[];
    if (a) return { id: Number(a.id), name: String(a.name || "Chefbüro") };
  }
  return { id: 0, name: "Chefbüro" };
}
/** Office: dieselbe Wand wie die Global-Akte (globalOfficeZugriff). */
async function officeWer(req: AgentRequest, res: Response, schreibt: boolean): Promise<{ ref: string; agent: Agent } | null> {
  const ref = String(req.params.ref || "").trim();
  const ansicht = !!req.agent?.ansicht;
  const person = { agentId: req.agent?.id, rolle: req.agent?.rolle, chef: !ansicht && !!readChef(req), adminCode: !ansicht && hasAdminCode(req) };
  const zustaendig = ref ? await globalBereichZustaendig(ref) : undefined;
  if (!globalOfficeZugriff(person, zustaendig ?? null).erlaubt) { res.status(403).json({ ok: false, error: "Diesen Auftrag führt jemand anderes. Zugriff haben die zuständige Person und die Leitung." }); return null; }
  if (zustaendig === undefined) { res.status(404).json({ ok: false, error: "Diesen Auftrag gibt es nicht." }); return null; }
  if (schreibt && ansicht) { res.status(403).json({ ok: false, error: "In der Ansicht lässt sich nichts ändern." }); return null; }
  return { ref, agent: { id: req.agent!.id, name: req.agent!.name } };
}

type Tun = (ref: string, agent: Agent, req: Request, res: Response) => Promise<void>;
/** Beide Türen für eine Handlung. */
function beide(methode: "get" | "post", pfad: string, schreibt: boolean, tun: Tun) {
  router[methode](`/chef/global/mandate/:ref/${pfad}`, requireChef("leitung"), async (req: Request, res: Response) => {
    try { await tun(String(req.params.ref || "").trim().toUpperCase(), await chefWer(req), req, res); }
    catch (e) { console.error(`[GLOBAL-UNTERSCHRIFT] chef ${pfad}:`, e); if (!res.headersSent) res.status(500).json({ ok: false, error: "Serverfehler — bitte gleich noch einmal." }); }
  });
  router[methode](`/agent/global/auftraege/:ref/${pfad}`, requireAgent, async (req: AgentRequest, res: Response) => {
    try { const z = await officeWer(req, res, schreibt); if (!z) return; await tun(z.ref, z.agent, req, res); }
    catch (e) { console.error(`[GLOBAL-UNTERSCHRIFT] office ${pfad}:`, e); if (!res.headersSent) res.status(500).json({ ok: false, error: "Serverfehler — bitte gleich noch einmal." }); }
  });
}
function antwort(res: Response, erg: { ok: boolean; status?: number; error?: string } & Record<string, unknown>) {
  if (!erg.ok) return res.status(Number(erg.status) || 400).json({ ok: false, error: erg.error, ...(Array.isArray((erg as any).fehlend) ? { fehlend: (erg as any).fehlend } : {}) });
  const { ok: _ok, ...rest } = erg;
  return res.json({ ok: true, ...rest });
}
const L = () => import("../lib/fiaon-global-unterschrift");

beide("get", "formulare", false, async (ref, _agent, _req, res) => {
  const U = await L();
  await U.ergaenzungSicherstellen(ref);
  const u = await U.formulareUebersicht(ref);
  if (!u) { res.status(404).json({ ok: false, error: "Diesen Auftrag gibt es nicht." }); return; }
  res.setHeader("Cache-Control", "private, no-store");
  res.json({ ok: true, ...u });
});
beide("post", "formular-angaben", true, async (ref, agent, req, res) => { antwort(res, await (await L()).formularAngabenSpeichern(ref, req.body ?? {}, agent)); });
beide("get", "formulare/:art/vorschau", false, async (ref, _agent, req, res) => {
  const erg = await (await L()).formularVorschau(ref, req.params.art);
  if (!erg.ok) { antwort(res, erg); return; }
  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", `inline; filename="${globalDateinameKopf(erg.dateiname)}"`);
  res.setHeader("Cache-Control", "private, no-store");
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.end(erg.pdf);
});
beide("post", "formulare/:art/erzeugen", true, async (ref, agent, req, res) => { antwort(res, await (await L()).formularErzeugen(ref, req.params.art, agent)); });
beide("post", "formulare/:art/fiaon-unterschreibt", true, async (ref, agent, req, res) => {
  antwort(res, await (await L()).formularFiaonUnterschreibt(ref, req.params.art, agent, { ip: clientIp(req), userAgent: ua(req), bestaetigt: req.body?.bestaetigt === true }));
});
beide("post", "formulare/:art/freigeben", true, async (ref, agent, req, res) => { antwort(res, await (await L()).formularFreigeben(ref, req.params.art, agent, { mitteilen: req.body?.mitteilen === true })); });
beide("get", "dokument/:id/pruefen", false, async (ref, _agent, req, res) => { res.setHeader("Cache-Control", "private, no-store"); antwort(res, await (await L()).unterschriftPruefen(ref, req.params.id)); });

export default router;
