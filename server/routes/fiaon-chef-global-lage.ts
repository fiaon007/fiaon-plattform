// ═══════════════════════════════════════════════════════════════════════════
// CHEFBÜRO › GLOBAL-LAGE — die Routen (E-508, 12.11.2026)
//
// Justin: „Ich will am besten über die Plattform ALLES managen, einstellen, aktiv werden können.“
//
// Eine Lese-Route (die ganze Lage in einer Antwort) und vier kleine Schreibwege; dazu die News (Scheibe 2). Keiner davon sendet eine Mail,
// bucht Geld oder stellt eine Rechnung — der Meilenstein mit Teil-2-Rechnung bleibt beim bestehenden Knopf im
// Reiter „Angebote“. Wand: requireChef; Fixkosten sieht und setzt, wer auch den Raum „Geld“ betreten darf.
// Mount: /api/fiaon.
// ═══════════════════════════════════════════════════════════════════════════
import { Router, type Request, type Response } from "express";
import { sqlPool } from "../lib/db-pool";
import { requireChef, chefProtokoll, type ChefRequest } from "./fiaon-chef-zugang";
import {
  globalLageLesen, lageNotizSchreiben, lageWiedervorlageErledigen, lageFixkostenSetzen, lageGueltigkeitSetzen, type LageWer,
} from "../lib/fiaon-chef-global-lage";

const router = Router();

/** Wer im Chefbüro handelt — mit Namen, für Verlauf und Notiz. */
async function wer(req: Request): Promise<LageWer> {
  const c = (req as ChefRequest).chef;
  if (c?.agentId) {
    const [a] = (await sqlPool`SELECT id, name FROM fiaon_agents WHERE id = ${c.agentId} LIMIT 1`.catch(() => [])) as any[];
    if (a) return { id: Number(a.id), name: String(a.name || "Chefbüro") };
  }
  return { id: null, name: "Chefbüro" };
}
function antwort(res: Response, erg: { ok: boolean; status?: number; error?: string } & Record<string, unknown>) {
  if (!erg.ok) return res.status(Number(erg.status) || 400).json({ ok: false, error: erg.error });
  const { ok: _ok, ...rest } = erg;
  return res.json({ ok: true, ...rest });
}
function fehler(res: Response, wo: string, err: unknown) {
  console.error(`[GLOBAL-LAGE] ${wo}:`, err);
  if (!res.headersSent) res.status(500).json({ ok: false, error: "Serverfehler — bitte gleich noch einmal versuchen." });
}

// ── Lesen: die ganze Lage ────────────────────────────────────────────────────
router.get("/chef/global-lage", requireChef("leitung"), async (req: ChefRequest, res: Response) => {
  try {
    res.setHeader("Cache-Control", "private, no-store");
    res.json(await globalLageLesen({ stufe: req.chef!.stufe, woche: req.query.woche }));
  } catch (e) { fehler(res, "lesen", e); }
});

// ── Gesprächsnotiz und/oder Wiedervorlage ────────────────────────────────────
router.post("/chef/global-lage/notiz", requireChef("leitung"), async (req: ChefRequest, res: Response) => {
  try {
    const erg = await lageNotizSchreiben(req.body ?? {}, await wer(req));
    if (erg.ok) void chefProtokoll(req, `global-lage:${String(req.body?.bezugArt ?? "")}:${String(req.body?.bezugId ?? "")}`, "Notiz/Wiedervorlage");
    antwort(res, erg);
  } catch (e) { fehler(res, "notiz", e); }
});
router.post("/chef/global-lage/wiedervorlage/:id/erledigt", requireChef("leitung"), async (req: ChefRequest, res: Response) => {
  try { antwort(res, await lageWiedervorlageErledigen(Number(req.params.id), await wer(req))); }
  catch (e) { fehler(res, "wiedervorlage", e); }
});

// ── Fixkosten je Monat: die Zahl nennt der Inhaber selbst ────────────────────
router.post("/chef/global-lage/fixkosten", requireChef("inhaber"), async (req: ChefRequest, res: Response) => {
  try {
    const erg = await lageFixkostenSetzen(req.body?.betrag);
    if (erg.ok) void chefProtokoll(req, "global-lage:fixkosten", `neu ${erg.cents} Cent`);
    antwort(res, erg);
  } catch (e) { fehler(res, "fixkosten", e); }
});

// ── „Gültig bis“ eines Angebots verlängern (ändert nur das Datum) ────────────
router.post("/chef/global-lage/angebot/:id/gueltigkeit", requireChef("geschaeftsfuehrung"), async (req: ChefRequest, res: Response) => {
  try {
    const erg = await lageGueltigkeitSetzen(Number(req.params.id), req.body?.gueltigBis, await wer(req));
    if (erg.ok) void chefProtokoll(req, `angebot:${req.params.id}`, `Gültigkeit bis ${erg.gueltigBis}`);
    antwort(res, erg);
  } catch (e) { fehler(res, "gueltigkeit", e); }
});

// ═══════════════════════════════════════════════════════════════════════════
// NEWS (E-508 Scheibe 2): amtliche Meldungen mit deutscher Kurzfassung — lesen ab Leitung, steuern ab Geschäftsführung
// ═══════════════════════════════════════════════════════════════════════════
router.get("/chef/global-news", requireChef("leitung"), async (req: ChefRequest, res: Response) => {
  try {
    res.setHeader("Cache-Control", "private, no-store");
    const { newsLesen } = await import("../lib/fiaon-chef-news");
    res.json(await newsLesen(req.chef!.stufe));
  } catch (e) { fehler(res, "news lesen", e); }
});
router.post("/chef/global-news/abrufen", requireChef("geschaeftsfuehrung"), async (_req: ChefRequest, res: Response) => {
  try { const { newsJetzt } = await import("../lib/fiaon-chef-news"); antwort(res, await newsJetzt()); }
  catch (e) { fehler(res, "news abrufen", e); }
});
router.post("/chef/global-news/:id/ausblenden", requireChef("geschaeftsfuehrung"), async (req: ChefRequest, res: Response) => {
  try { const { newsAusblenden } = await import("../lib/fiaon-chef-news"); antwort(res, await newsAusblenden(Number(req.params.id), (await wer(req)).name)); }
  catch (e) { fehler(res, "news ausblenden", e); }
});

export default router;
