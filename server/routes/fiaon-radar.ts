// ═══════════════════════════════════════════════════════════════════════════
// FIRMEN-RADAR — DIE WEGE FÜRS CHEFBÜRO (19.09.2026)
//
// Justin: „… aber nicht bei Nikita, Admin!" Alles hier liegt hinter
// requireChef("geschaeftsfuehrung") — das Office der Mitarbeiter sieht den Radar
// nicht. Die Arbeit steht in server/lib/fiaon-radar.ts; hier wird nur geprüft,
// wer fragt, und was zurückgeht.
// ═══════════════════════════════════════════════════════════════════════════
import { Router, type Response } from "express";
import { requireChef, type ChefRequest } from "./fiaon-chef-zugang";
import {
  RadarFehler, radarUebersicht, radarFirma, radarSucheStarten, radarLauf, radarFirmaManuell, radarScannen,
  radarMailSchreiben, radarMailAendern, radarMailAusgeben, radarStatusSetzen, radarSperren, radarPostfachPruefen,
} from "../lib/fiaon-radar";
import { alsRadarLand } from "@shared/fiaon-radar";

const router = Router();
const wache = requireChef("geschaeftsfuehrung");

function fehler(res: Response, e: any) {
  if (e instanceof RadarFehler) return res.status(e.status).json({ ok: false, error: e.message });
  console.error("[RADAR]", e);
  return res.status(500).json({ ok: false, error: "Der Radar ist gerade gestolpert — bitte noch einmal versuchen." });
}
const idAus = (roh: unknown): number => {
  const n = Number(roh);
  if (!Number.isInteger(n) || n <= 0) throw new RadarFehler("Ungültige Firma.", 400);
  return n;
};

router.get("/chef/radar", wache, async (req: ChefRequest, res: Response) => {
  try {
    res.json({ ok: true, ...(await radarUebersicht({ tag: String(req.query.tag ?? "") || null, bereich: String(req.query.bereich ?? "") || null, status: String(req.query.status ?? "") || null, suche: String(req.query.suche ?? "") || null })) });
  } catch (e) { fehler(res, e); }
});

router.post("/chef/radar/suchen", wache, async (req: ChefRequest, res: Response) => {
  try {
    const laufId = await radarSucheStarten({
      bereich: String(req.body?.bereich ?? ""), land: alsRadarLand(req.body?.land), stichwort: req.body?.stichwort ? String(req.body.stichwort) : null,
      anzahl: Number(req.body?.anzahl) || 10, von: req.chef?.agentId ?? null,
    });
    res.json({ ok: true, laufId });
  } catch (e) { fehler(res, e); }
});

router.get("/chef/radar/lauf/:id", wache, async (req: ChefRequest, res: Response) => {
  try {
    const l = await radarLauf(idAus(req.params.id));
    if (!l) return res.status(404).json({ ok: false, error: "Lauf nicht gefunden." });
    res.json({ ok: true, lauf: l });
  } catch (e) { fehler(res, e); }
});

router.post("/chef/radar/manuell", wache, async (req: ChefRequest, res: Response) => {
  try {
    const id = await radarFirmaManuell({ website: String(req.body?.website ?? ""), bereich: String(req.body?.bereich ?? ""), von: req.chef?.agentId ?? null });
    res.json({ ok: true, id });
  } catch (e) { fehler(res, e); }
});

router.get("/chef/radar/firma/:id", wache, async (req: ChefRequest, res: Response) => {
  try {
    const f = await radarFirma(idAus(req.params.id));
    if (!f) return res.status(404).json({ ok: false, error: "Firma nicht gefunden." });
    res.json({ ok: true, firma: f });
  } catch (e) { fehler(res, e); }
});

router.post("/chef/radar/firma/:id/scannen", wache, async (req: ChefRequest, res: Response) => {
  try { res.json({ ok: true, scan: await radarScannen(idAus(req.params.id)) }); } catch (e) { fehler(res, e); }
});

router.post("/chef/radar/firma/:id/mail", wache, async (req: ChefRequest, res: Response) => {
  try { res.json({ ok: true, mail: await radarMailSchreiben(idAus(req.params.id), { hinweis: req.body?.hinweis ? String(req.body.hinweis) : null }) }); } catch (e) { fehler(res, e); }
});

router.put("/chef/radar/firma/:id/mail", wache, async (req: ChefRequest, res: Response) => {
  try {
    res.json({ ok: true, mail: await radarMailAendern(idAus(req.params.id), { betreff: String(req.body?.betreff ?? ""), koerper: String(req.body?.koerper ?? ""), ps: req.body?.ps != null ? String(req.body.ps) : undefined }) });
  } catch (e) { fehler(res, e); }
});

router.post("/chef/radar/firma/:id/ausgeben", wache, async (req: ChefRequest, res: Response) => {
  try {
    const art = req.body?.art === "senden" ? "senden" : "entwurf";
    // Senden nur mit ausdrücklicher Bestätigung aus der Oberfläche.
    if (art === "senden" && req.body?.bestaetigt !== true) throw new RadarFehler("Bitte den Versand bestätigen.");
    res.json(await radarMailAusgeben(idAus(req.params.id), { art, postfach: String(req.body?.postfach ?? ""), an: req.body?.an ? String(req.body.an) : null, von: req.chef?.agentId ?? null }));
  } catch (e) { fehler(res, e); }
});

router.post("/chef/radar/firma/:id/status", wache, async (req: ChefRequest, res: Response) => {
  try {
    await radarStatusSetzen(idAus(req.params.id), { status: String(req.body?.status ?? "") as any, notiz: req.body?.notiz != null ? String(req.body.notiz).slice(0, 1000) : null });
    res.json({ ok: true });
  } catch (e) { fehler(res, e); }
});

router.post("/chef/radar/sperren", wache, async (req: ChefRequest, res: Response) => {
  try {
    await radarSperren({ wert: String(req.body?.wert ?? ""), grund: req.body?.grund ? String(req.body.grund).slice(0, 200) : null, von: req.chef?.agentId ?? null });
    res.json({ ok: true });
  } catch (e) { fehler(res, e); }
});

router.get("/chef/radar/postfach/:adresse", wache, async (req: ChefRequest, res: Response) => {
  try { res.json(await radarPostfachPruefen(String(req.params.adresse))); } catch (e) { fehler(res, e); }
});

export default router;
