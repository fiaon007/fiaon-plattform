// ═══════════════════════════════════════════════════════════════════════════
// BONI-AMPEL — Route für die Akte der Mitarbeiter (21.09.2026, E-202)
//
// Die Telefonkartei bekommt die Ampel mit jeder Karte; die Mitarbeiter lesen
// sie hier, für EINEN Kunden, hinter derselben Tür wie der Rest der Akte
// (requireAgent + darfAnKunde).
// ═══════════════════════════════════════════════════════════════════════════

import { Router, type Response } from "express";
import { requireAgent, type AgentRequest } from "./fiaon-agent";
import { boniAmpelFuerPerson } from "../lib/fiaon-boni-ampel";

const router = Router();

/** GET /agent/kunden/:personId/boni-ampel */
router.get("/agent/kunden/:personId/boni-ampel", requireAgent, async (req: AgentRequest, res: Response) => {
  const personId = Number(req.params.personId);
  if (!Number.isInteger(personId) || personId <= 0) return res.status(400).json({ ok: false, error: "Ungültige Kundenkennung." });
  try {
    const { rolleVon, darfAnKunde } = await import("../lib/fiaon-kundenzugriff");
    const rolle = req.agent?.rolle || await rolleVon(req.agent!.id);
    if (!(await darfAnKunde(req.agent!.id, rolle, personId))) {
      return res.status(403).json({ ok: false, error: "Dieser Kunde wird von jemand anderem betreut." });
    }
    const ampel = await boniAmpelFuerPerson(personId);
    if (!ampel) return res.status(404).json({ ok: false, error: "Kunde nicht gefunden." });
    res.json({ ok: true, ampel });
  } catch (e: any) {
    console.error("[BONI-AMPEL] agent:", e);
    res.status(500).json({ ok: false, error: "Serverfehler" });
  }
});

export default router;
