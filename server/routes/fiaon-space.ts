// ═══════════════════════════════════════════════════════════════════════════
// FIAON SPACE — Routen
//
// Offen für JEDE Mitarbeiterrolle (requireAgent genügt). Anpinnen und Löschen
// dürfen nur Vertriebsleitung und Betreiber — nicht aus Hierarchie, sondern
// weil ein angepinnter Post oben stehen bleibt, bis ihn jemand löst, und ein
// gelöschter Post aus dem Blick verschwindet. Beides sind Eingriffe in einen
// gemeinsamen Raum.
//
// Gelöscht wird WEICH (`geloescht_at`). Ein Beitrag, den jemand geschrieben
// hat, verschwindet aus dem Feed, aber nicht aus der Welt — sonst ließe sich
// hinterher nicht klären, was da eigentlich stand.
// ═══════════════════════════════════════════════════════════════════════════

import { Router, type Response } from "express";
import { sqlPool } from "../lib/db-pool";
import { requireAgent, type AgentRequest } from "./fiaon-agent";
import { ensureRolleSpalte } from "./fiaon-vertrieb";
import {
  HINWEIS_AM_FELD, REAKTIONEN, feedLesen, istReaktion, pruefeBeitrag, ungelesen,
} from "../lib/fiaon-space";

const router = Router();

async function darfVerwalten(agentId: number): Promise<boolean> {
  await ensureRolleSpalte();
  const [a] = (await sqlPool`SELECT rolle FROM fiaon_agents WHERE id = ${agentId} AND active`) as any[];
  return String(a?.rolle || "agent") === "vertriebsleiter";
}

/** GET /agent/space — der Feed. Markiert den Besuch als gesehen. */
router.get("/agent/space", requireAgent, async (req: AgentRequest, res: Response) => {
  try {
    const posts = await feedLesen(req.agent!.id, Math.min(100, Number(req.query.limit) || 40));
    const verwalten = await darfVerwalten(req.agent!.id);
    // Erst lesen, DANN als gesehen markieren: Sonst wäre die Ungelesen-Zahl
    // beim ersten Laden schon null und der Feed könnte nicht zeigen, was neu ist.
    await sqlPool`UPDATE fiaon_agents SET space_gesehen_am = NOW() WHERE id = ${req.agent!.id}`;
    res.json({
      ok: true,
      posts,
      darfVerwalten: verwalten,
      hinweis: HINWEIS_AM_FELD,
      reaktionen: REAKTIONEN,
      ich: { id: req.agent!.id, vorname: req.agent!.first_name || req.agent!.name },
    });
  } catch (err) {
    console.error("[SPACE] feed:", err);
    res.status(500).json({ ok: false, error: "Serverfehler" });
  }
});

/** GET /agent/space/ungelesen — die Zahl für die Menü-Marke. */
router.get("/agent/space/ungelesen", requireAgent, async (req: AgentRequest, res: Response) => {
  try {
    res.json({ ok: true, anzahl: await ungelesen(req.agent!.id) });
  } catch (err) {
    // Eine Marke, die klemmt, darf das Menü nicht mitreißen.
    res.json({ ok: true, anzahl: 0 });
  }
});

/** POST /agent/space — schreiben. */
router.post("/agent/space", requireAgent, async (req: AgentRequest, res: Response) => {
  try {
    const text = String(req.body?.text ?? "").trim();
    const befund = pruefeBeitrag(text);
    if (!befund.erlaubt) return res.status(400).json({ ok: false, error: befund.grund });

    const leitung = await darfVerwalten(req.agent!.id);
    const [row] = (await sqlPool`
      INSERT INTO fiaon_posts (autor_agent_id, autor_typ, text)
      VALUES (${req.agent!.id}, ${leitung ? "leitung" : "team"}, ${text})
      RETURNING id
    `) as any[];
    res.json({ ok: true, id: Number(row.id) });
  } catch (err) {
    console.error("[SPACE] schreiben:", err);
    res.status(500).json({ ok: false, error: "Serverfehler" });
  }
});

/** POST /agent/space/:id/reaktion — eine Marke setzen, wechseln oder abwählen. */
router.post("/agent/space/:id/reaktion", requireAgent, async (req: AgentRequest, res: Response) => {
  try {
    const postId = Number(req.params.id);
    const art = req.body?.art;
    if (art === null || art === "") {
      await sqlPool`DELETE FROM fiaon_post_reaktionen WHERE post_id = ${postId} AND agent_id = ${req.agent!.id}`;
      return res.json({ ok: true, meine: null });
    }
    if (!istReaktion(art)) return res.status(400).json({ ok: false, error: "Unbekannte Marke." });
    const [da] = (await sqlPool`SELECT id FROM fiaon_posts WHERE id = ${postId} AND geloescht_at IS NULL`) as any[];
    if (!da) return res.status(404).json({ ok: false, error: "Beitrag nicht gefunden." });
    // Eine Reaktion je Mensch und Beitrag: Wer eine andere Marke wählt,
    // ersetzt die eigene. Der eindeutige Index macht daraus ein Update.
    await sqlPool`
      INSERT INTO fiaon_post_reaktionen (post_id, agent_id, art)
      VALUES (${postId}, ${req.agent!.id}, ${art})
      ON CONFLICT (post_id, agent_id) DO UPDATE SET art = EXCLUDED.art, created_at = NOW()
    `;
    res.json({ ok: true, meine: art });
  } catch (err) {
    console.error("[SPACE] reaktion:", err);
    res.status(500).json({ ok: false, error: "Serverfehler" });
  }
});

/** POST /agent/space/:id/kommentar */
router.post("/agent/space/:id/kommentar", requireAgent, async (req: AgentRequest, res: Response) => {
  try {
    const postId = Number(req.params.id);
    const text = String(req.body?.text ?? "").trim();
    const befund = pruefeBeitrag(text);
    if (!befund.erlaubt) return res.status(400).json({ ok: false, error: befund.grund });
    const [da] = (await sqlPool`SELECT id FROM fiaon_posts WHERE id = ${postId} AND geloescht_at IS NULL`) as any[];
    if (!da) return res.status(404).json({ ok: false, error: "Beitrag nicht gefunden." });
    const [row] = (await sqlPool`
      INSERT INTO fiaon_post_kommentare (post_id, agent_id, text)
      VALUES (${postId}, ${req.agent!.id}, ${text}) RETURNING id
    `) as any[];
    res.json({ ok: true, id: Number(row.id) });
  } catch (err) {
    console.error("[SPACE] kommentar:", err);
    res.status(500).json({ ok: false, error: "Serverfehler" });
  }
});

/** POST /agent/space/:id/anpinnen — nur Leitung. */
router.post("/agent/space/:id/anpinnen", requireAgent, async (req: AgentRequest, res: Response) => {
  try {
    if (!(await darfVerwalten(req.agent!.id))) {
      return res.status(403).json({ ok: false, error: "Nur die Vertriebsleitung kann Beiträge anpinnen." });
    }
    const an = req.body?.an !== false;
    await sqlPool`
      UPDATE fiaon_posts SET angepinnt = ${an}, updated_at = NOW()
      WHERE id = ${Number(req.params.id)} AND geloescht_at IS NULL
    `;
    res.json({ ok: true, angepinnt: an });
  } catch (err) {
    console.error("[SPACE] anpinnen:", err);
    res.status(500).json({ ok: false, error: "Serverfehler" });
  }
});

/**
 * DELETE /agent/space/:id — weich löschen.
 *
 * Die Leitung darf jeden Beitrag entfernen, jeder andere nur den eigenen. Wer
 * sich vertippt hat, soll das selbst geradeziehen können, ohne jemanden zu
 * fragen — aber niemand soll fremde Beiträge verschwinden lassen.
 */
router.delete("/agent/space/:id", requireAgent, async (req: AgentRequest, res: Response) => {
  try {
    const id = Number(req.params.id);
    const leitung = await darfVerwalten(req.agent!.id);
    const [post] = (await sqlPool`SELECT autor_agent_id FROM fiaon_posts WHERE id = ${id} AND geloescht_at IS NULL`) as any[];
    if (!post) return res.status(404).json({ ok: false, error: "Beitrag nicht gefunden." });
    if (!leitung && Number(post.autor_agent_id) !== req.agent!.id) {
      return res.status(403).json({ ok: false, error: "Du kannst nur eigene Beiträge löschen." });
    }
    await sqlPool`
      UPDATE fiaon_posts SET geloescht_at = NOW(), geloescht_von = ${req.agent!.id}, updated_at = NOW()
      WHERE id = ${id}
    `;
    res.json({ ok: true });
  } catch (err) {
    console.error("[SPACE] loeschen:", err);
    res.status(500).json({ ok: false, error: "Serverfehler" });
  }
});

export default router;
