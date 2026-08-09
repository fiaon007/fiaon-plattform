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
    const vorId = Number(req.query.vor) || null;
    const posts = await feedLesen(
      req.agent!.id, Math.min(100, Number(req.query.limit) || 25), sqlPool, vorId,
    );
    const verwalten = await darfVerwalten(req.agent!.id);
    // Erst lesen, DANN als gesehen markieren: Sonst wäre die Ungelesen-Zahl
    // beim ersten Laden schon null und der Feed könnte nicht zeigen, was neu ist.
    // Beim NACHLADEN nicht: Wer seite drei holt, hat seite eins längst gesehen,
    // und ein erneutes Markieren würde die Marke für neue Beiträge löschen,
    // die währenddessen oben erschienen sind.
    if (!vorId) {
      await sqlPool`UPDATE fiaon_agents SET space_gesehen_am = NOW() WHERE id = ${req.agent!.id}`;
    }
    res.json({
      ok: true,
      posts,
      darfVerwalten: verwalten,
      hinweis: HINWEIS_AM_FELD,
      reaktionen: REAKTIONEN,
      ich: { id: req.agent!.id, vorname: req.agent!.first_name || req.agent!.name },
      // Gibt es noch mehr? Der Feed lädt sonst ewig weiter ins Leere.
      mehr: posts.length >= Math.min(100, Number(req.query.limit) || 25),
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

    // ── Bild ──────────────────────────────────────────────────────────────
    // Kommt als Daten-URL aus dem Browser, dort schon verkleinert. Die Grenze
    // hier ist die zweite Wand: Ein Browser, der die Verkleinerung überspringt
    // (oder ein direkter Aufruf), soll keine 20-MB-Datei in die Datenbank
    // legen.
    let bild: Buffer | null = null;
    let bildTyp: string | null = null;
    const roh = String(req.body?.bild || "");
    if (roh.startsWith("data:image/")) {
      const treffer = /^data:(image\/(?:jpeg|png|webp));base64,(.+)$/.exec(roh);
      if (!treffer) {
        return res.status(400).json({ ok: false, error: "Nur JPEG, PNG oder WebP." });
      }
      bild = Buffer.from(treffer[2], "base64");
      bildTyp = treffer[1];
      if (bild.length > 2_500_000) {
        return res.status(400).json({
          ok: false,
          error: "Das Bild ist zu groß (über 2,5 MB nach der Verkleinerung). Nimm ein kleineres.",
        });
      }
    }

    // ── Akten-Chip ────────────────────────────────────────────────────────
    // Der Verweis wird gegen das SICHTFELD geprüft, nicht gegen die Eingabe:
    // Wer eine fremde Referenz errät, kann sie trotzdem nicht anhängen.
    let akteRef: string | null = null;
    let aktePerson: number | null = null;
    if (req.body?.akteRef) {
      const [pr] = (await sqlPool`
        SELECT a.ref, a.person_id, p.assigned_agent_id
        FROM fiaon_applications a
        LEFT JOIN fiaon_persons p ON p.id = a.person_id
        WHERE a.ref = ${String(req.body.akteRef)} AND a.merged_into IS NULL
          AND a.gdpr_deleted_at IS NULL
      `) as any[];
      if (!pr) return res.status(400).json({ ok: false, error: "Diese Akte gibt es nicht." });
      if (!leitung && Number(pr.assigned_agent_id) !== req.agent!.id) {
        return res.status(403).json({
          ok: false,
          error: "Du kannst nur Akten anhängen, die du selbst betreust.",
        });
      }
      akteRef = String(pr.ref);
      aktePerson = pr.person_id ? Number(pr.person_id) : null;
    }

    const [row] = (await sqlPool`
      INSERT INTO fiaon_posts (autor_agent_id, autor_typ, text, bild, bild_typ, akte_ref, akte_person)
      VALUES (${req.agent!.id}, ${leitung ? "leitung" : "team"}, ${text},
              ${bild}, ${bildTyp}, ${akteRef}, ${aktePerson})
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

/** Höchstens zwei gleichzeitig. Drei angepinnte Beiträge pinnen gar nichts. */
export const PIN_GRENZE = 2;

/**
 * POST /agent/space/:id/anpinnen — nur Leitung und Betreiber.
 *
 * ── WARUM EINE GRENZE ──────────────────────────────────────────────────────
 * Ein angepinnter Beitrag bleibt oben, bis ihn jemand löst. In der Praxis löst
 * ihn niemand. Nach drei Monaten stehen sieben Beiträge oben, der Feed beginnt
 * unter der Falzlinie, und „angepinnt" heißt nichts mehr.
 *
 * Zwei ist die Zahl, bei der man beim Verdrängen noch weiß, was man verdrängt.
 * Ist die Grenze erreicht, LÖST DAS SYSTEM NICHTS VON SELBST — es fragt, welcher
 * weichen soll. Ein automatisch verdrängter Beitrag wäre eine stille Änderung
 * an etwas, das jemand ausdrücklich hochgehalten hat.
 */
router.post("/agent/space/:id/anpinnen", requireAgent, async (req: AgentRequest, res: Response) => {
  try {
    if (!(await darfVerwalten(req.agent!.id))) {
      return res.status(403).json({ ok: false, error: "Nur die Vertriebsleitung kann Beiträge anpinnen." });
    }
    const id = Number(req.params.id);
    const an = req.body?.an !== false;

    if (an) {
      const belegt = (await sqlPool`
        SELECT id, LEFT(text, 90) AS anriss, angepinnt_am
        FROM fiaon_posts
        WHERE angepinnt AND geloescht_at IS NULL AND id <> ${id}
        ORDER BY angepinnt_am ASC NULLS FIRST, id ASC
      `) as any[];

      if (belegt.length >= PIN_GRENZE) {
        // Der Betreiber kann die Entscheidung mitschicken: „diesen hier weg".
        const weichen = Number(req.body?.weichen || 0);
        if (!weichen) {
          return res.status(409).json({
            ok: false,
            grenzeErreicht: true,
            grenze: PIN_GRENZE,
            angepinnte: belegt.map((b) => ({
              id: Number(b.id), anriss: String(b.anriss).replace(/\n+/g, " ").trim(),
              seit: b.angepinnt_am,
            })),
            error: `Es sind schon ${PIN_GRENZE} Beiträge angepinnt. Welcher soll weichen?`,
          });
        }
        if (!belegt.some((b) => Number(b.id) === weichen)) {
          return res.status(400).json({ ok: false, error: "Der zu lösende Beitrag ist nicht angepinnt." });
        }
        await sqlPool`
          UPDATE fiaon_posts SET angepinnt = FALSE, angepinnt_am = NULL, updated_at = NOW()
          WHERE id = ${weichen}
        `;
      }
    }

    await sqlPool`
      UPDATE fiaon_posts SET
        angepinnt = ${an},
        angepinnt_am = ${an ? new Date() : null},
        angepinnt_von = ${an ? req.agent!.name : null},
        updated_at = NOW()
      WHERE id = ${id} AND geloescht_at IS NULL
    `;
    res.json({ ok: true, angepinnt: an });
  } catch (err) {
    console.error("[SPACE] anpinnen:", err);
    res.status(500).json({ ok: false, error: "Serverfehler" });
  }
});

/**
 * GET /agent/space/bild/:id — das Bild eines Beitrags.
 *
 * Einzeln abgeholt, nicht in der Feed-Antwort: Zwanzig Beiträge mit je einem
 * Bild wären sonst ein zweistelliger Megabyte-Block bei jedem Seitenaufruf.
 */
router.get("/agent/space/bild/:id", requireAgent, async (req: AgentRequest, res: Response) => {
  try {
    const [p] = (await sqlPool`
      SELECT bild, bild_typ FROM fiaon_posts
      WHERE id = ${Number(req.params.id)} AND geloescht_at IS NULL AND bild IS NOT NULL
    `) as any[];
    if (!p) return res.status(404).end();
    res.setHeader("Content-Type", String(p.bild_typ || "image/jpeg"));
    // Ein Beitragsbild ändert sich nie — es darf im Browser liegen bleiben.
    res.setHeader("Cache-Control", "private, max-age=86400");
    res.send(Buffer.from(p.bild));
  } catch (err) {
    console.error("[SPACE] bild:", err);
    res.status(500).end();
  }
});

/**
 * GET /agent/space/akte-suche — Kunden für den Akten-Chip.
 *
 * Sucht ausschließlich im Sichtfeld der Rolle. Wer nur eigene Kunden betreut,
 * kann auch nur eigene anhängen — sonst wäre die Suche selbst schon ein Leck.
 */
router.get("/agent/space/akte-suche", requireAgent, async (req: AgentRequest, res: Response) => {
  try {
    const { empfaengerSuche } = await import("../lib/fiaon-zentrale");
    await ensureRolleSpalte();
    const [a] = (await sqlPool`SELECT rolle FROM fiaon_agents WHERE id = ${req.agent!.id}`) as any[];
    const rolle = String(a?.rolle || "agent");
    const nurEigene = rolle === "agent" ? req.agent!.id : null;
    const treffer = await empfaengerSuche(String(req.query.q || ""), nurEigene);
    res.json({
      ok: true,
      // NUR Referenz und Name — der Name bleibt im Suchfeld des Schreibenden
      // und landet NICHT im Beitrag.
      treffer: treffer.slice(0, 8).map((t: any) => ({
        personId: t.personId, ref: t.ref ?? null, name: t.name,
      })).filter((t: any) => t.ref),
    });
  } catch (err) {
    console.error("[SPACE] akte-suche:", err);
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
