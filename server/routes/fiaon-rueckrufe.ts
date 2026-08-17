// ═══════════════════════════════════════════════════════════════════════════
// RÜCKRUFE — Routen für Mitarbeiter und Betreiber
//
// Die Regeln stehen in `server/lib/fiaon-rueckruf.ts`. Hier ist nur die Tür.
// ═══════════════════════════════════════════════════════════════════════════

import { Router, type Request, type Response } from "express";
import { requireAgent, type AgentRequest } from "./fiaon-agent";
import {
  FRIST_STUNDEN, rueckrufAufnehmen, rueckrufErledigen, rueckrufListe, rueckrufZahlen,
  rueckrufeEskalieren,
} from "../lib/fiaon-rueckruf";
import { tageslauf } from "../lib/fiaon-crons";

const router = Router();

/** GET /agent/rueckrufe — meine offenen Rückrufe, dringendste zuerst. */
router.get("/agent/rueckrufe", requireAgent, async (req: AgentRequest, res: Response) => {
  try {
    const liste = await rueckrufListe({ agentId: req.agent!.id });
    res.json({
      ok: true, fristStunden: FRIST_STUNDEN, liste,
      offen: liste.filter((r) => r.status === "offen").length,
      ueberfaellig: liste.filter((r) => r.ueberfaellig).length,
    });
  } catch (err) {
    console.error("[RUECKRUFE] liste:", err);
    res.status(500).json({ ok: false, error: "Serverfehler" });
  }
});

/**
 * POST /agent/rueckrufe — ein Wunsch, den jemand am Telefon aufnimmt.
 *
 * Das ist der Fall aus dem Teamfeedback: „Kunde rief an, wird notiert." Ab
 * jetzt entsteht daraus eine Aufgabe mit Frist statt einer Notiz.
 */
router.post("/agent/rueckrufe", requireAgent, async (req: AgentRequest, res: Response) => {
  try {
    const anliegen = String(req.body?.anliegen || "").trim();
    if (anliegen.length < 10) {
      return res.status(400).json({
        ok: false,
        error: "Bitte schreiben, was der Kunde möchte (mindestens 10 Zeichen). "
          + "Wer später zurückruft, hat nur diesen Text.",
      });
    }
    const erg = await rueckrufAufnehmen({
      personId: req.body?.personId ? Number(req.body.personId) : null,
      ref: req.body?.ref ? String(req.body.ref) : null,
      quelle: "manuell",
      anliegen,
      kontakt: req.body?.kontakt ? String(req.body.kontakt).slice(0, 200) : null,
    });
    res.json({
      ok: true, ...erg,
      meldung: `Rückruf aufgenommen. Frist: ${FRIST_STUNDEN} Stunden.`
        + (erg.zustaendig ? "" : " Es gibt keinen Zuständigen — die Leitung übernimmt."),
    });
  } catch (err) {
    console.error("[RUECKRUFE] aufnehmen:", err);
    res.status(500).json({ ok: false, error: "Serverfehler" });
  }
});

/** POST /agent/rueckrufe/:id/erledigt — nur mit Ergebnis-Notiz. */
router.post("/agent/rueckrufe/:id/erledigt", requireAgent, async (req: AgentRequest, res: Response) => {
  try {
    const erg = await rueckrufErledigen(
      Number(req.params.id),
      { name: req.agent!.name, agentId: req.agent!.id },
      String(req.body?.notiz || ""),
    );
    if (!erg.ok) return res.status(400).json(erg);
    res.json({ ok: true, meldung: "Rückruf erledigt — das Ergebnis steht in der Akte." });
  } catch (err) {
    console.error("[RUECKRUFE] erledigen:", err);
    res.status(500).json({ ok: false, error: "Serverfehler" });
  }
});

/** GET /admin/rueckrufe — alle, für den Betreiber. */
router.get("/admin/rueckrufe", async (req: Request, res: Response) => {
  try {
    const [liste, zahlen] = await Promise.all([
      rueckrufListe({ nurOffen: String(req.query.alle || "") !== "1" }),
      rueckrufZahlen(),
    ]);
    res.json({
      ok: true, fristStunden: FRIST_STUNDEN, zahlen, liste,
      meldung: zahlen.ueberfaellig > 0
        ? `${zahlen.ueberfaellig} Rückruf(e) über der Frist von ${FRIST_STUNDEN} Stunden.`
        : `Alle ${zahlen.offen} Rückrufe in der Frist.`,
    });
  } catch (err) {
    console.error("[RUECKRUFE] admin:", err);
    res.status(500).json({ ok: false, error: "Serverfehler" });
  }
});

/** POST /admin/rueckrufe/eskalieren — von Hand anstoßen (der Lauf ist idempotent). */
router.post("/admin/rueckrufe/eskalieren", async (_req: Request, res: Response) => {
  try {
    res.json({ ok: true, ...(await rueckrufeEskalieren()) });
  } catch (err) {
    console.error("[RUECKRUFE] eskalieren:", err);
    res.status(500).json({ ok: false, error: "Serverfehler" });
  }
});

// ── DER TAGESLAUF ──────────────────────────────────────────────────────────
// Stündlich, weil eine 24-Stunden-Frist zu jeder Stunde reißen kann. Über
// `tageslauf` registriert: Auf einem Entwicklungsrechner läuft er nicht und
// verschickt keine Mails an echte Vorgesetzte (AGENTS.md, Vorfall 08.08.2026).
tageslauf("rueckruf-eskalation", () => {
  void rueckrufeEskalieren().catch((e) => console.error("[RUECKRUFE] Tageslauf:", e));
}, 60 * 60 * 1000);

export default router;
