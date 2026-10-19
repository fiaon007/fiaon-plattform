// ═══════════════════════════════════════════════════════════════════════════
// „HEUTE DRAN“ — die Türen (E-406 A, 19.10.2026)
//
//   GET /agent/heute-dran        die Liste des angemeldeten Mitarbeiters (Schreibtisch)
//   GET /admin/team/heute-dran   eine Zeile je Mitarbeiter für die Leitung (Chefbüro › Team)
//
// Beide nur lesend. Rechnen und Regeln: server/lib/fiaon-heute-dran.ts und
// shared/fiaon-heute-dran.ts. /admin/* liegt hinter dem Admin-Tor (adminCodeGate)
// und ist für Mitarbeiter-Sitzungen gesperrt (blockAgentsFromAdmin).
// ═══════════════════════════════════════════════════════════════════════════
import { Router, type Response } from "express";
import { requireAgent, type AgentRequest } from "./fiaon-agent";
import { heuteDranPlan, personAusPlan } from "../lib/fiaon-heute-dran";
import { RUECKSTAU_ZEILEN, type HeuteZeile } from "@shared/fiaon-heute-dran";

const router = Router();

/** Was die Oberfläche je Zeile braucht — ohne interne Felder. */
function zeileAusgabe(z: HeuteZeile) {
  return {
    schluessel: z.schluessel, quelle: z.quelle, name: z.name, grund: z.grund, weitere: z.weitere,
    betragCents: z.betragCents, ziel: z.ziel, zeit: z.zeit, stufe: z.stufe, verteilt: z.verteilt, erledigt: z.erledigt,
    vertretungFuer: z.vertretungFuer,
  };
}

router.get("/agent/heute-dran", requireAgent, async (req: AgentRequest, res: Response) => {
  try {
    const stand = await heuteDranPlan();
    const p = personAusPlan(stand, req.agent!.id);
    if (!p) {
      return res.json({
        ok: true, stand: stand.stand, fehlend: stand.fehlend, person: null,
        hinweis: "Für dieses Konto gibt es heute keine Tagesliste.",
      });
    }
    res.json({
      ok: true, stand: stand.stand, fehlend: stand.fehlend,
      person: {
        name: p.name, minuten: p.minuten, kapazitaet: p.kapazitaet, zahlen: p.zahlen, hinweis: p.hinweis,
        offen: p.offen.map(zeileAusgabe),
        erledigt: p.erledigt.map(zeileAusgabe),
        rueckstau: p.rueckstau.slice(0, RUECKSTAU_ZEILEN).map(zeileAusgabe),
        rueckstauGesamt: p.rueckstau.length,
      },
    });
  } catch (err) {
    console.error("[HEUTE-DRAN] agent:", err);
    res.status(500).json({ ok: false, error: "Die Liste „Heute dran“ konnte gerade nicht geladen werden." });
  }
});

router.get("/admin/team/heute-dran", async (_req, res: Response) => {
  try {
    const stand = await heuteDranPlan();
    res.json({
      ok: true, stand: stand.stand, fehlend: stand.fehlend,
      zeilen: stand.plan.personen.map((p) => ({
        agentId: p.agentId, name: p.name, minuten: p.minuten, kapazitaet: p.kapazitaet,
        heuteDran: p.zahlen.heuteDran, erledigt: p.zahlen.erledigt, rueckstau: p.zahlen.rueckstau,
        dringend: p.zahlen.dringend, weitergegeben: p.weitergegeben,
      })),
      ohneZustaendigen: stand.plan.ohneZustaendigen.length,
      beiGeschaeftsfuehrung: stand.plan.beiGeschaeftsfuehrung,
    });
  } catch (err) {
    console.error("[HEUTE-DRAN] leitung:", err);
    res.status(500).json({ ok: false, error: "„Heute dran“ konnte gerade nicht geladen werden." });
  }
});

export default router;
