// ═══════════════════════════════════════════════════════════════════════════
// FIAON GLOBAL — DER VERKAUFSMOTOR: ÖFFENTLICHE ROUTEN (Register E-509, 12.11.2026)
//
//   GET  /api/fiaon/global/verkauf        Einstellung für Startseite und Konfigurator + Zeit-Siegel (nie im Zwischenspeicher)
//   POST /api/fiaon/global/verkauf/start  der Konfigurator schickt ab → Angebot (Selbstabschluss) oder Anfrage
//
// Logik, Schutz und Mails: server/lib/fiaon-global-verkauf.ts. Regeln und Texte: shared/fiaon-global-verkauf.ts.
// ═══════════════════════════════════════════════════════════════════════════
import { Router, type Request, type Response } from "express";
import { aufrufClientIp } from "../lib/fiaon-global-angebot-aufrufe";
import { readChef } from "./fiaon-chef-zugang";
import { hasAdminCode } from "./fiaon-admin-zugang";
import { verkaufSeitenSicht, verkaufStarten } from "../lib/fiaon-global-verkauf";
import { VERKAUF_TEXTE } from "@shared/fiaon-global-verkauf";

const router = Router();

function ohneSpeicher(res: Response): void {
  res.setHeader("Cache-Control", "private, no-store");
}
function istLeitung(req: Request): boolean {
  try { return !!readChef(req) || hasAdminCode(req); } catch { return false; }
}

router.get("/verkauf", (_req: Request, res: Response) => {
  ohneSpeicher(res);
  try { res.json(verkaufSeitenSicht()); }
  catch (err) { console.error("[FIAON-VERKAUF] Sicht:", err); res.status(500).json({ ok: false }); }
});

router.post("/verkauf/start", async (req: Request, res: Response) => {
  ohneSpeicher(res);
  const en = String(req.body?.sprache ?? "").toLowerCase().startsWith("en");
  try {
    const erg = await verkaufStarten(req.body || {}, { ip: aufrufClientIp(req as any), userAgent: String(req.headers["user-agent"] ?? ""), leitung: istLeitung(req) });
    res.status(erg.status).json(erg.body);
  } catch (err) {
    console.error("[FIAON-VERKAUF] start:", err);
    res.status(500).json({ ok: false, error: VERKAUF_TEXTE[en ? "en" : "de"].konfig.fehler.netz });
  }
});

export default router;
