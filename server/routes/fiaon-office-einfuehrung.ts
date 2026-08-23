// ═══════════════════════════════════════════════════════════════════════════
// FIAON OFFICE — Einführungs-Rundgang: Gesehen-Merker (23.08.2026, Plan §4/§11)
//
// Der geführte Rundgang (client/src/components/agent/Einfuehrung.tsx) öffnet
// sich beim ERSTEN Login automatisch. Ob jemand ihn schon gesehen hat, ist
// eine Eigenschaft des KONTOS, nicht des Browsers — deshalb liegt der Merker
// hier und nicht (nur) im localStorage. localStorage ist nur der schnelle
// Cache, damit nicht jeder Seitenwechsel den Server fragt.
//
//   GET  /agent/einfuehrung   → { ok, gesehen, zeit }
//   POST /agent/einfuehrung   → merkt „gesehen“ (beim Abschluss ODER beim
//                               Überspringen — beides heißt: nicht mehr
//                               automatisch zeigen; neu starten geht immer
//                               über More bzw. die Raumliste)
//
// Tabelle fiaon_agent_flags ist bewusst allgemein (agent_id, flag, wert,
// zeit): weitere Einmal-Hinweise können denselben Ort nutzen, ohne dass je
// Hinweis eine neue Tabelle entsteht. Datenbank ist Produktion — nur
// CREATE TABLE IF NOT EXISTS, nichts Bestehendes wird angefasst.
// ═══════════════════════════════════════════════════════════════════════════
import { Router, type Response } from "express";
import { sqlPool } from "../lib/db-pool";
import { requireAgent, type AgentRequest } from "./fiaon-agent";

const router = Router();
const FLAG = "einfuehrung_gesehen";

let geprueft = false;
async function ensureFlagsTabelle(): Promise<void> {
  if (geprueft) return;
  await sqlPool`
    CREATE TABLE IF NOT EXISTS fiaon_agent_flags (
      agent_id INTEGER NOT NULL,
      flag VARCHAR NOT NULL,
      wert VARCHAR NOT NULL DEFAULT 'ja',
      zeit TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      PRIMARY KEY (agent_id, flag)
    )`;
  geprueft = true;
}

/** GET /agent/einfuehrung — hat dieses Konto den Rundgang schon gesehen? */
router.get("/agent/einfuehrung", requireAgent, async (req: AgentRequest, res: Response) => {
  try {
    await ensureFlagsTabelle();
    const rows = (await sqlPool`
      SELECT wert, zeit FROM fiaon_agent_flags
      WHERE agent_id = ${req.agent!.id} AND flag = ${FLAG}
    `) as any[];
    res.json({ ok: true, gesehen: rows.length > 0, zeit: rows[0]?.zeit ?? null });
  } catch (err) {
    console.error("[OFFICE-EINFUEHRUNG]", err);
    res.status(500).json({ ok: false, error: "Serverfehler" });
  }
});

/** POST /agent/einfuehrung — „gesehen“ merken (idempotent). */
router.post("/agent/einfuehrung", requireAgent, async (req: AgentRequest, res: Response) => {
  try {
    await ensureFlagsTabelle();
    await sqlPool`
      INSERT INTO fiaon_agent_flags (agent_id, flag, wert)
      VALUES (${req.agent!.id}, ${FLAG}, 'ja')
      ON CONFLICT (agent_id, flag) DO UPDATE SET wert = 'ja', zeit = NOW()
    `;
    res.json({ ok: true });
  } catch (err) {
    console.error("[OFFICE-EINFUEHRUNG] merken:", err);
    res.status(500).json({ ok: false, error: "Serverfehler" });
  }
});

export default router;
