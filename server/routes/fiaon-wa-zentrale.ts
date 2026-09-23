// ═══════════════════════════════════════════════════════════════════════════
// WHATSAPP-ZENTRALE — die Schnittstellen (23.09.2026, E-229)
//
// Nur Chefbüro, nur Stufe „inhaber" — wie Maras Steuerpult. Die Regeln selbst
// stehen in server/lib/fiaon-wa-zentrale.ts; hier wird nur gelesen, gestartet
// und eingestellt.
//
//   GET  /chef/wa-zentrale/lage       alles für die Seite in einem Zug
//   GET  /chef/wa-zentrale/vorschau   die nächsten Empfänger mit ihrem Text
//   POST /chef/wa-zentrale/start      „WhatsApp starten (n)" — Gruppe, Vorlage, Anzahl
//   POST /chef/wa-zentrale/stopp      den laufenden Versand anhalten
//   GET  /chef/wa-zentrale/lauf       der Stand des laufenden Versands
//   POST /chef/wa-zentrale/automatik  an/aus, Fenster, je Stunde, Gruppen, Vorlagen
//
// Der Takt der Automatik: alle 5 Minuten (Crons in server/routes.ts).
// ═══════════════════════════════════════════════════════════════════════════
import { Router, type Response } from "express";
import { requireChef, type ChefRequest } from "./fiaon-chef-zugang";
import {
  automatikSetzen, istGruppe, laufAbbrechen, laufStand, laufStarten, vorschau, zentraleLage, GRUPPEN,
} from "../lib/fiaon-wa-zentrale";

const router = Router();
const wache = requireChef("inhaber");
const wer = (req: ChefRequest) => (req.chef?.agentId ? `Chef #${req.chef.agentId}` : "Inhaber");

router.get("/chef/wa-zentrale/lage", wache, async (_req: ChefRequest, res: Response) => {
  try {
    res.setHeader("Cache-Control", "no-store");
    res.json({ ok: true, ...(await zentraleLage()) });
  } catch (e) {
    console.error("[WA-ZENTRALE] Lage:", e);
    res.status(500).json({ ok: false, error: "Die Lage ließ sich nicht laden." });
  }
});

router.get("/chef/wa-zentrale/vorschau", wache, async (req: ChefRequest, res: Response) => {
  try {
    const gruppe = String(req.query.gruppe || "");
    const vorlage = String(req.query.vorlage || "");
    if (!istGruppe(gruppe)) return res.status(400).json({ ok: false, error: "Unbekannte Gruppe." });
    if (!GRUPPEN[gruppe].vorlagen.includes(vorlage)) return res.status(400).json({ ok: false, error: "Diese Vorlage passt nicht zu dieser Gruppe." });
    const anzahl = Math.min(50, Math.max(1, Number(req.query.anzahl) || 10));
    res.json({ ok: true, empfaenger: await vorschau(gruppe, vorlage, anzahl) });
  } catch (e) {
    console.error("[WA-ZENTRALE] Vorschau:", e);
    res.status(500).json({ ok: false, error: "Die Vorschau ließ sich nicht laden." });
  }
});

router.post("/chef/wa-zentrale/start", wache, async (req: ChefRequest, res: Response) => {
  try {
    const gruppe = String(req.body?.gruppe || "");
    const vorlage = String(req.body?.vorlage || "");
    const anzahl = Number(req.body?.anzahl);
    if (!istGruppe(gruppe)) return res.status(400).json({ ok: false, error: "Unbekannte Gruppe." });
    if (!Number.isFinite(anzahl) || anzahl < 1) return res.status(400).json({ ok: false, error: "Bitte eine Anzahl ab 1 angeben." });
    const r = await laufStarten({ gruppe, vorlage, anzahl, quelle: "hand", von: wer(req) });
    if (!r.ok) return res.status(409).json({ ok: false, error: r.grund });
    console.log(`[WA-ZENTRALE] Versand von Hand gestartet durch ${wer(req)}: ${gruppe}, ${vorlage}, bis zu ${anzahl}`);
    res.json({ ok: true, lauf: r.lauf });
  } catch (e) {
    console.error("[WA-ZENTRALE] Start:", e);
    res.status(500).json({ ok: false, error: "Der Versand ließ sich nicht starten." });
  }
});

router.post("/chef/wa-zentrale/stopp", wache, (_req: ChefRequest, res: Response) => {
  res.json({ ok: true, angehalten: laufAbbrechen() });
});

router.get("/chef/wa-zentrale/lauf", wache, (_req: ChefRequest, res: Response) => {
  res.setHeader("Cache-Control", "no-store");
  res.json({ ok: true, lauf: laufStand() });
});

router.post("/chef/wa-zentrale/automatik", wache, async (req: ChefRequest, res: Response) => {
  try {
    const b = req.body || {};
    const r = await automatikSetzen({
      an: typeof b.an === "boolean" ? b.an : undefined,
      von: typeof b.von === "string" ? b.von : undefined,
      bis: typeof b.bis === "string" ? b.bis : undefined,
      jeStunde: b.jeStunde != null ? Number(b.jeStunde) : undefined,
      gruppen: Array.isArray(b.gruppen) ? b.gruppen : undefined,
      vorlagen: b.vorlagen && typeof b.vorlagen === "object" ? b.vorlagen : undefined,
    }, wer(req));
    if (!r.ok) return res.status(400).json({ ok: false, error: r.grund });
    res.json({ ok: true, automatik: r.automatik });
  } catch (e) {
    console.error("[WA-ZENTRALE] Automatik:", e);
    res.status(500).json({ ok: false, error: "Die Automatik ließ sich nicht speichern." });
  }
});

export default router;
