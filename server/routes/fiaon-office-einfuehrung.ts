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

// ═══════════════════════════════════════════════════════════════════════════
// DIE RUNDGÄNGE JE RAUM — 24.08.2026
//
// Justin: „JEDE Seite, die man öffnet, soll eine Einführung geben und
// genauestens beschreiben, wofür was ist, wie was geht — und mach es
// realitätsnah. Jede Seite braucht einen dezenten Button, dass man das immer
// wieder abspielen kann."
//
// VORHER gab es EINEN Rundgang fürs ganze Office, einmalig beim ersten Login.
// Wer drei Wochen später zum ersten Mal in den Bestand-Raum kam, bekam nichts.
// NACHHER hat jeder Raum seinen eigenen Rundgang; gemerkt wird je Raum.
//
// Der Merker gehört zum KONTO, nicht zum Browser — wer das Gerät wechselt,
// soll den Rundgang nicht noch einmal vorgesetzt bekommen. Genutzt wird
// dieselbe allgemeine Tabelle wie oben (fiaon_agent_flags), mit dem Präfix
// „rundgang_". Eine eigene Tabelle je Hinweis wäre Verschwendung.
//
//   GET  /agent/rundgaenge        → { ok, gesehen: ["bestand", "pipeline"] }
//   POST /agent/rundgaenge/:raum  → merkt diesen Raum als gesehen
//   DELETE /agent/rundgaenge      → alle wieder auf ungesehen (für „nochmal
//                                   von vorn", z. B. beim Einlernen)
// ═══════════════════════════════════════════════════════════════════════════
const RUNDGANG_PRAEFIX = "rundgang_";
/** Nur Kleinbuchstaben, Ziffern und Bindestrich — kein Raumname aus dem Netz
 *  darf zu einem beliebigen Flag werden. */
const RAUM_MUSTER = /^[a-z0-9-]{1,40}$/;

router.get("/agent/rundgaenge", requireAgent, async (req: AgentRequest, res: Response) => {
  try {
    await ensureFlagsTabelle();
    const rows = (await sqlPool`
      SELECT flag FROM fiaon_agent_flags
      WHERE agent_id = ${req.agent!.id} AND flag LIKE ${RUNDGANG_PRAEFIX + "%"}
    `) as any[];
    res.json({ ok: true, gesehen: rows.map((r) => String(r.flag).slice(RUNDGANG_PRAEFIX.length)) });
  } catch (err) {
    console.error("[OFFICE-RUNDGANG] lesen:", err);
    // Ein Fehler hier darf keine Seite blockieren: Im Zweifel gilt „noch
    // nicht gesehen" nicht — sonst poppt bei einer Störung überall der
    // Rundgang auf. Lieber einmal zu wenig zeigen als überall stören.
    res.json({ ok: true, gesehen: [] as string[], fehler: true });
  }
});

router.post("/agent/rundgaenge/:raum", requireAgent, async (req: AgentRequest, res: Response) => {
  try {
    const raum = String(req.params.raum || "").trim().toLowerCase();
    if (!RAUM_MUSTER.test(raum)) return res.status(400).json({ ok: false, error: "Unbekannter Raum." });
    await ensureFlagsTabelle();
    await sqlPool`
      INSERT INTO fiaon_agent_flags (agent_id, flag, wert)
      VALUES (${req.agent!.id}, ${RUNDGANG_PRAEFIX + raum}, 'ja')
      ON CONFLICT (agent_id, flag) DO UPDATE SET wert = 'ja', zeit = NOW()
    `;
    res.json({ ok: true });
  } catch (err) {
    console.error("[OFFICE-RUNDGANG] merken:", err);
    res.status(500).json({ ok: false, error: "Serverfehler" });
  }
});

router.delete("/agent/rundgaenge", requireAgent, async (req: AgentRequest, res: Response) => {
  try {
    await ensureFlagsTabelle();
    await sqlPool`
      DELETE FROM fiaon_agent_flags
      WHERE agent_id = ${req.agent!.id} AND flag LIKE ${RUNDGANG_PRAEFIX + "%"}
    `;
    res.json({ ok: true });
  } catch (err) {
    console.error("[OFFICE-RUNDGANG] zuruecksetzen:", err);
    res.status(500).json({ ok: false, error: "Serverfehler" });
  }
});

export default router;
