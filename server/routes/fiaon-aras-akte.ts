// ═══════════════════════════════════════════════════════════════════════════
// ARAS — Routen für die Akte und das Softphone (E-408 Scheibe 2)
//
// Akte (requireAgent + darfAnKunde — wer den Kunden betreut, und die Leitung):
//   GET  /agent/kunden/:personId/aras                         Lage: offen, bleibt bei dir, geplant, Verlauf, Sperre, Notiz, „geht/warum nicht“
//   POST /agent/kunden/:personId/aras/auftrag                 { punkte[], auftrag, wann, ab, benachrichtigen, abgeben } — reiht EINEN Anruf ein
//   …/aras/briefing*  der Auftrags-Chat („ARAS anrufen lassen“) — server/routes/fiaon-aras-briefing-chat.ts, unten eingehängt
//   POST /agent/kunden/:personId/aras/plan/:planId/zuruecknehmen
//   POST /agent/kunden/:personId/aras/schalter                { aus: boolean, grund } — „Aras für diesen Kunden aus“
//   POST /agent/kunden/:personId/aras/notiz                   { text } — „Was Aras wissen muss“
//   POST /agent/kunden/:personId/aras/anruf/:id/urteil        { daumen: hoch|runter, grund }
// Softphone (requireAgent):
//   POST /telefon/herzschlag                                  alle 60 s, solange das Softphone erreichbar ist (Übergabe nur an Erreichbare)
//   GET  /agent/aras/uebergabe/:callId                        wer ist dran, wenn Aras ins Softphone übergibt (Name, Kurzbriefing)
// Antworten { ok, … } / { ok:false, error }.
// ═══════════════════════════════════════════════════════════════════════════
import { Router, type Response } from "express";
import { requireAgent, type AgentRequest } from "./fiaon-agent";
import { darfAnKunde, rolleVon } from "../lib/fiaon-kundenzugriff";
import { sqlPool } from "../lib/db-pool";
import { arasAkteLage, arasAuftragGeben, arasAuftragZuruecknehmen, arasFuerPersonSchalten, arasNotizSetzen, arasAnrufUrteil } from "../lib/fiaon-aras-akte";
import { praesenzMelden } from "../lib/fiaon-softphone-praesenz";
import { laufendeSitzungen } from "../lib/fiaon-aras-bruecke";
import { AUFTRAG_WANN, type AuftragWann } from "../../shared/fiaon-aras";
// Der Auftrags-Chat („ARAS anrufen lassen“ öffnet einen kurzen Chat statt der Maske) — eigene Datei, dieselben Türen.
import briefingChat from "./fiaon-aras-briefing-chat";

const router = Router();
const fehler = (res: Response, status: number, text: string, extra: Record<string, unknown> = {}) => res.status(status).json({ ok: false, error: text, ...extra });
const text = (e: unknown) => String((e as Error)?.message ?? e).slice(0, 300);

async function zugang(req: AgentRequest, res: Response): Promise<{ personId: number; rolle: string } | null> {
  const personId = Number(req.params.personId);
  if (!Number.isInteger(personId) || personId <= 0) { fehler(res, 400, "Ungültiger Kunde."); return null; }
  const rolle = await rolleVon(req.agent!.id);
  if (!(await darfAnKunde(req.agent!.id, rolle, personId))) { fehler(res, 403, "Nicht dein Kunde."); return null; }
  return { personId, rolle };
}
const leitung = (rolle: string) => rolle === "admin" || rolle === "vertriebsleiter";

router.get("/agent/kunden/:personId/aras", requireAgent, async (req: AgentRequest, res: Response) => {
  try {
    const z = await zugang(req, res); if (!z) return;
    res.setHeader("Cache-Control", "no-store");
    const lage = await arasAkteLage(z.personId, req.agent!.id, leitung(z.rolle));
    if (!lage) return fehler(res, 404, "Diesen Kunden gibt es nicht.");
    res.json(lage);
  } catch (e) {
    console.error("[ARAS-AKTE] Lage:", e);
    fehler(res, 500, "Aras' Karte ließ sich nicht laden.");
  }
});

router.post("/agent/kunden/:personId/aras/auftrag", requireAgent, async (req: AgentRequest, res: Response) => {
  try {
    const z = await zugang(req, res); if (!z) return;
    const b = req.body ?? {};
    const wann: AuftragWann = (AUFTRAG_WANN as readonly string[]).includes(String(b.wann)) ? (String(b.wann) as AuftragWann) : "bald";
    const r = await arasAuftragGeben(z.personId, {
      punkte: Array.isArray(b.punkte) ? b.punkte.map(String).slice(0, 10) : [], auftrag: typeof b.auftrag === "string" ? b.auftrag : "",
      wann, ab: typeof b.ab === "string" ? b.ab : null, benachrichtigen: b.benachrichtigen !== false, abgeben: b.abgeben === true,
    }, req.agent!.id);
    if (!r.ok) return fehler(res, 409, r.grund ?? "Ließ sich nicht einplanen.", r.hinweise ? { hinweise: r.hinweise } : {});
    res.json({ ok: true, id: r.id, meldung: r.meldung });
  } catch (e) { fehler(res, 500, text(e)); }
});

router.post("/agent/kunden/:personId/aras/plan/:planId/zuruecknehmen", requireAgent, async (req: AgentRequest, res: Response) => {
  try {
    const z = await zugang(req, res); if (!z) return;
    const r = await arasAuftragZuruecknehmen(z.personId, Number(req.params.planId), req.agent!.id, leitung(z.rolle));
    if (!r.ok) return fehler(res, 409, r.grund ?? "Ließ sich nicht zurücknehmen.");
    res.json({ ok: true, meldung: "Zurückgenommen — Aras ruft nicht an." });
  } catch (e) { fehler(res, 500, text(e)); }
});

router.post("/agent/kunden/:personId/aras/schalter", requireAgent, async (req: AgentRequest, res: Response) => {
  try {
    const z = await zugang(req, res); if (!z) return;
    const aus = req.body?.aus === true;
    await arasFuerPersonSchalten(z.personId, aus, typeof req.body?.grund === "string" ? req.body.grund : null, req.agent!.id, String(req.agent!.name ?? `Agent ${req.agent!.id}`));
    res.json({ ok: true, meldung: aus ? "Aras ruft diesen Kunden nicht mehr an — geplante Anrufe sind gestoppt." : "Aras darf diesen Kunden wieder anrufen." });
  } catch (e) { fehler(res, 500, text(e)); }
});

router.post("/agent/kunden/:personId/aras/notiz", requireAgent, async (req: AgentRequest, res: Response) => {
  try {
    const z = await zugang(req, res); if (!z) return;
    const r = await arasNotizSetzen(z.personId, String(req.body?.text ?? ""), String(req.agent!.name ?? `Agent ${req.agent!.id}`));
    if (!r.ok) return fehler(res, 409, r.grund ?? "Nicht gespeichert.", r.hinweise ? { hinweise: r.hinweise } : {});
    res.json({ ok: true, meldung: "Gespeichert — Aras weiß es beim nächsten Anruf." });
  } catch (e) { fehler(res, 500, text(e)); }
});

router.post("/agent/kunden/:personId/aras/anruf/:id/urteil", requireAgent, async (req: AgentRequest, res: Response) => {
  try {
    const z = await zugang(req, res); if (!z) return;
    const daumen = String(req.body?.daumen ?? "");
    if (daumen !== "hoch" && daumen !== "runter") return fehler(res, 400, "daumen: hoch oder runter.");
    const r = await arasAnrufUrteil(z.personId, Number(req.params.id), daumen, typeof req.body?.grund === "string" ? req.body.grund : null, String(req.agent!.name ?? `Agent ${req.agent!.id}`));
    if (!r.ok) return fehler(res, 404, r.grund ?? "Nicht gespeichert.");
    res.json({ ok: true });
  } catch (e) { fehler(res, 500, text(e)); }
});

// ── Softphone ──────────────────────────────────────────────────────────────
router.post("/telefon/herzschlag", requireAgent, async (req: AgentRequest, res: Response) => {
  try { await praesenzMelden(req.agent!.id); res.json({ ok: true }); } catch (e) { fehler(res, 500, text(e)); }
});

router.get("/agent/aras/uebergabe/:callId", requireAgent, async (req: AgentRequest, res: Response) => {
  try {
    const callId = Number(req.params.callId);
    if (!Number.isInteger(callId) || callId <= 0) return fehler(res, 400, "Ungültiger Anruf.");
    const [c] = (await sqlPool`
      SELECT c.id, c.person_id, c.nummer, aa.zusammenfassung, aa.uebergabe_agent_id, aa.spielart,
             COALESCE(NULLIF(TRIM(CONCAT_WS(' ', p.first_name, p.last_name)), ''), p.company_name) AS name
        FROM fiaon_calls c JOIN fiaon_aras_anruf aa ON aa.call_id = c.id LEFT JOIN fiaon_persons p ON p.id = c.person_id
       WHERE c.id = ${callId}`) as any[];
    if (!c) return fehler(res, 404, "Diesen Aras-Anruf gibt es nicht.");
    const rolle = await rolleVon(req.agent!.id);
    const meins = Number(c.uebergabe_agent_id) === req.agent!.id;
    if (c.person_id && !meins && !(await darfAnKunde(req.agent!.id, rolle, Number(c.person_id)))) return fehler(res, 403, "Nicht dein Kunde.");
    res.setHeader("Cache-Control", "no-store");
    // Das Gespräch läuft noch: die letzten Sätze aus dem Speicher (nie aus der Datenbank) — „Aras hat gerade mit … gesprochen“.
    const live = laufendeSitzungen().find((s) => s.callId === callId);
    res.json({
      ok: true, personId: c.person_id != null ? Number(c.person_id) : null, name: c.name ?? null, nummer: c.nummer ?? null,
      kurz: c.zusammenfassung ? String(c.zusammenfassung).slice(0, 300) : null, spielart: c.spielart,
      zeilen: live ? live.letzteZeilen.slice(-4) : [],
    });
  } catch (e) { fehler(res, 500, text(e)); }
});

router.use(briefingChat);

export default router;
