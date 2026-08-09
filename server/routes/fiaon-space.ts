// ═══════════════════════════════════════════════════════════════════════════
// FIAON SPACE — Routen
//
// Offen für JEDE Mitarbeiterrolle (requireAgent genügt). Anpinnen und Löschen
// dürfen nur Vertriebsleitung und Vorgesetzter — nicht aus Hierarchie, sondern
// weil ein angepinnter Post oben stehen bleibt, bis ihn jemand löst, und ein
// gelöschter Post aus dem Blick verschwindet. Beides sind Eingriffe in einen
// gemeinsamen Raum.
//
// Gelöscht wird WEICH (`geloescht_at`). Ein Beitrag, den jemand geschrieben
// hat, verschwindet aus dem Feed, aber nicht aus der Welt — sonst ließe sich
// hinterher nicht klären, was da eigentlich stand.
// ═══════════════════════════════════════════════════════════════════════════

import { Router, type Request, type Response } from "express";
import { sqlPool } from "../lib/db-pool";
import { requireAgent, type AgentRequest } from "./fiaon-agent";
import { ensureRolleSpalte } from "./fiaon-vertrieb";
import {
  HINWEIS_AM_FELD, REAKTIONEN, feedLesen, istReaktion, pruefeBeitrag, tageszahlen, ungelesen,
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
    const [ichZeile] = (await sqlPool`
      SELECT avatar FROM fiaon_agents WHERE id = ${req.agent!.id}
    `) as any[];
    const ichAvatar = ichZeile?.avatar || null;
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
      // ── DAS EIGENE GESICHT ────────────────────────────────────────────
      // Bis zum 11.08.2026 stand hier nur der Vorname — die Oberfläche
      // zeichnete daraus Initialen. Der Vorgesetzte hat ein Profilbild
      // hinterlegt und sah trotzdem „JS". Es war nie ein fehlendes Bild,
      // sondern ein nicht mitgeliefertes.
      ich: {
        id: req.agent!.id,
        vorname: req.agent!.first_name || req.agent!.name,
        name: req.agent!.name,
        avatar: ichAvatar,
        rolle: verwalten ? "vertriebsleiter" : "team",
      },
      // Gibt es noch mehr? Der Feed lädt sonst ewig weiter ins Leere.
      mehr: posts.length >= Math.min(100, Number(req.query.limit) || 25),
      // Echte Zahlen statt Hausordnung in der Seitenspalte.
      tageszahlen: vorId ? [] : await tageszahlen(req.agent!.id, false).catch(() => []),
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
/**
 * POST /agent/space/:id/kommentar — kommentieren oder auf einen Kommentar
 * antworten (`antwortAuf`).
 *
 * GENAU EINE VERSCHACHTELUNGSEBENE: Wer auf eine Antwort antwortet, hängt am
 * selben Elternteil. Tiefere Bäume sind auf 380 px unlesbar, und niemand
 * findet mehr, worauf sich etwas bezieht.
 */
router.post("/agent/space/:id/kommentar", requireAgent, async (req: AgentRequest, res: Response) => {
  try {
    const postId = Number(req.params.id);
    const text = String(req.body?.text ?? "").trim();
    const befund = pruefeBeitrag(text);
    if (!befund.erlaubt) return res.status(400).json({ ok: false, error: befund.grund });
    const [da] = (await sqlPool`SELECT id FROM fiaon_posts WHERE id = ${postId} AND geloescht_at IS NULL`) as any[];
    if (!da) return res.status(404).json({ ok: false, error: "Beitrag nicht gefunden." });
    // Auf welchen Kommentar wird geantwortet? Zeigt jemand auf eine ANTWORT,
    // hängen wir uns an deren Elternteil — eine Ebene, nicht mehr.
    let elternteil: number | null = null;
    if (req.body?.antwortAuf) {
      const [e] = (await sqlPool`
        SELECT id, antwort_auf FROM fiaon_post_kommentare
        WHERE id = ${Number(req.body.antwortAuf)} AND post_id = ${postId} AND geloescht_at IS NULL
      `) as any[];
      if (e) elternteil = e.antwort_auf ? Number(e.antwort_auf) : Number(e.id);
    }

    const [row] = (await sqlPool`
      INSERT INTO fiaon_post_kommentare (post_id, agent_id, text, antwort_auf)
      VALUES (${postId}, ${req.agent!.id}, ${text}, ${elternteil}) RETURNING id
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
 * POST /agent/space/:id/anpinnen — nur Leitung und Vorgesetzter.
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
        // Der Vorgesetzte kann die Entscheidung mitschicken: „diesen hier weg".
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

/** Wie lange darf ein Beitrag noch geändert werden? */
export const BEARBEITEN_MINUTEN = 15;

/**
 * PATCH /agent/space/:id — den eigenen Beitrag ändern.
 *
 * ── WARUM NUR 15 MINUTEN ───────────────────────────────────────────────────
 * Ein Tippfehler fällt einem in der ersten Minute auf. Wer nach zwei Stunden
 * ändert, ändert nicht mehr den Tippfehler, sondern die Aussage — und
 * womöglich, nachdem zehn Leute zugestimmt haben. Deren Zustimmung stünde
 * dann unter einem Text, den sie nie gelesen haben.
 *
 * Die geänderte Fassung trägt eine sichtbare Marke. Eine stille Änderung wäre
 * schlimmer als gar keine.
 */
router.patch("/agent/space/:id", requireAgent, async (req: AgentRequest, res: Response) => {
  try {
    const id = Number(req.params.id);
    const text = String(req.body?.text ?? "").trim();
    const befund = pruefeBeitrag(text);
    if (!befund.erlaubt) return res.status(400).json({ ok: false, error: befund.grund });

    const [post] = (await sqlPool`
      SELECT autor_agent_id, created_at FROM fiaon_posts
      WHERE id = ${id} AND geloescht_at IS NULL
    `) as any[];
    if (!post) return res.status(404).json({ ok: false, error: "Beitrag nicht gefunden." });
    if (Number(post.autor_agent_id) !== req.agent!.id) {
      return res.status(403).json({ ok: false, error: "Du kannst nur eigene Beiträge ändern." });
    }
    const alterMinuten = (Date.now() - new Date(post.created_at).getTime()) / 60_000;
    if (alterMinuten > BEARBEITEN_MINUTEN) {
      return res.status(400).json({
        ok: false,
        error: `Ein Beitrag lässt sich ${BEARBEITEN_MINUTEN} Minuten lang ändern. `
          + "Danach nicht mehr — andere haben ihn inzwischen gelesen. Du kannst ihn aber löschen.",
      });
    }
    await sqlPool`
      UPDATE fiaon_posts SET text = ${text}, bearbeitet_am = NOW(), updated_at = NOW()
      WHERE id = ${id}
    `;
    res.json({ ok: true });
  } catch (err) {
    console.error("[SPACE] bearbeiten:", err);
    res.status(500).json({ ok: false, error: "Serverfehler" });
  }
});

/**
 * DELETE /agent/space/kommentar/:id — den eigenen Kommentar zurücknehmen.
 *
 * Weich, wie überall: Der Text verschwindet aus dem Feed, die Zeile bleibt.
 * Antworten darauf bleiben stehen — sie gehören ihren Verfassern, nicht dem,
 * der den ersten Kommentar geschrieben hat.
 */
router.delete("/agent/space/kommentar/:id", requireAgent, async (req: AgentRequest, res: Response) => {
  try {
    const id = Number(req.params.id);
    const leitung = await darfVerwalten(req.agent!.id);
    const [k] = (await sqlPool`
      SELECT agent_id FROM fiaon_post_kommentare WHERE id = ${id} AND geloescht_at IS NULL
    `) as any[];
    if (!k) return res.status(404).json({ ok: false, error: "Kommentar nicht gefunden." });
    if (!leitung && Number(k.agent_id) !== req.agent!.id) {
      return res.status(403).json({ ok: false, error: "Du kannst nur eigene Kommentare löschen." });
    }
    await sqlPool`
      UPDATE fiaon_post_kommentare
      SET geloescht_at = NOW(), geloescht_von = ${req.agent!.name}
      WHERE id = ${id}
    `;
    res.json({ ok: true });
  } catch (err) {
    console.error("[SPACE] kommentar loeschen:", err);
    res.status(500).json({ ok: false, error: "Serverfehler" });
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// ADMIN-SPACE — /admin/space
//
// Der Vorgesetzte: „In Admin fehlt die komplette Space Seite? Ich muss als
// Admin ebenfalls über jeden Post sehen, interagieren können."
//
// Dieselben Bausteine, andere Tür. Der Admin hat KEIN Agent-Konto, also kann
// er die Agent-Routen nicht benutzen — sie hängen alle an `requireAgent`.
//
// ── WER IST DER ADMIN IM FEED? ─────────────────────────────────────────────
// Er hat keine Agenten-Kennung. Beiträge von ihm tragen `autor_typ = 'system'`
// (er postet als FIAON) oder `'leitung'` (er postet unter seinem eigenen
// Konto, falls er eines hat). Der Umschalter steht in der Oberfläche.
//
// Reaktionen brauchen eine Agenten-Kennung — die Tabelle verlangt sie. Der
// Admin reagiert deshalb über sein Prüfkonto, falls vorhanden. Gibt es keins,
// bleibt die Reaktion aus; das ist ehrlicher, als eine fremde Kennung zu
// missbrauchen.
// ═══════════════════════════════════════════════════════════════════════════

/** Das Konto, unter dem der Vorgesetzte im Feed auftritt. */
async function betreiberKonto(): Promise<{ id: number; name: string } | null> {
  const [a] = (await sqlPool`
    SELECT id, COALESCE(NULLIF(first_name, ''), name) AS name
    FROM fiaon_agents WHERE active AND pruefkonto ORDER BY id LIMIT 1
  `.catch(() => [] as any[])) as any[];
  return a ? { id: Number(a.id), name: String(a.name) } : null;
}

/** GET /admin/space — derselbe Feed, volle Sicht. */
router.get("/admin/space", async (req: Request, res: Response) => {
  try {
    const konto = await betreiberKonto();
    const vorId = Number(req.query.vor) || null;
    // Ohne Prüfkonto gibt es keine „eigene Reaktion" — dann ist 0 die
    // richtige Kennung: Sie gehört niemandem, also stimmt kein Vergleich.
    const posts = await feedLesen(konto?.id ?? 0, Math.min(100, Number(req.query.limit) || 25), sqlPool, vorId);
    res.json({
      ok: true, posts, darfVerwalten: true, alsAdmin: true,
      hinweis: HINWEIS_AM_FELD, reaktionen: REAKTIONEN,
      ich: { id: konto?.id ?? 0, vorname: "Vorgesetzter", name: "Vorgesetzter", avatar: null, rolle: "admin" },
      mehr: posts.length >= Math.min(100, Number(req.query.limit) || 25),
      kontoVorhanden: !!konto,
      tageszahlen: vorId ? [] : await tageszahlen(konto?.id ?? 0, true).catch(() => []),
    });
  } catch (err) {
    console.error("[SPACE] admin feed:", err);
    res.status(500).json({ ok: false, error: "Serverfehler" });
  }
});

/** POST /admin/space — als FIAON oder unter dem eigenen Konto schreiben. */
router.post("/admin/space", async (req: Request, res: Response) => {
  try {
    const text = String(req.body?.text ?? "").trim();
    const befund = pruefeBeitrag(text);
    if (!befund.erlaubt) return res.status(400).json({ ok: false, error: befund.grund });

    const alsFiaon = req.body?.alsFiaon !== false;
    const konto = await betreiberKonto();
    if (!alsFiaon && !konto) {
      return res.status(400).json({
        ok: false,
        error: "Für einen Beitrag unter eigenem Namen braucht es ein Prüfkonto. "
          + "Poste als FIAON — oder lege dir in der Team-Zentrale ein Konto an.",
      });
    }
    const [row] = (await sqlPool`
      INSERT INTO fiaon_posts (autor_agent_id, autor_typ, text)
      VALUES (${alsFiaon ? null : konto!.id}, ${alsFiaon ? "system" : "leitung"}, ${text})
      RETURNING id
    `) as any[];
    res.json({ ok: true, id: Number(row.id) });
  } catch (err) {
    console.error("[SPACE] admin schreiben:", err);
    res.status(500).json({ ok: false, error: "Serverfehler" });
  }
});

/** POST /admin/space/:id/reaktion */
router.post("/admin/space/:id/reaktion", async (req: Request, res: Response) => {
  try {
    const konto = await betreiberKonto();
    if (!konto) {
      return res.status(400).json({
        ok: false, error: "Zum Reagieren braucht es ein Prüfkonto — sonst gehört die Reaktion niemandem.",
      });
    }
    const art = String(req.body?.art ?? "");
    if (!istReaktion(art)) return res.status(400).json({ ok: false, error: "Unbekannte Reaktion." });
    const postId = Number(req.params.id);
    const [da] = (await sqlPool`
      SELECT art FROM fiaon_post_reaktionen WHERE post_id = ${postId} AND agent_id = ${konto.id}
    `) as any[];
    if (da?.art === art) {
      await sqlPool`DELETE FROM fiaon_post_reaktionen WHERE post_id = ${postId} AND agent_id = ${konto.id}`;
    } else {
      await sqlPool`
        INSERT INTO fiaon_post_reaktionen (post_id, agent_id, art) VALUES (${postId}, ${konto.id}, ${art})
        ON CONFLICT (post_id, agent_id) DO UPDATE SET art = ${art}
      `;
    }
    res.json({ ok: true });
  } catch (err) {
    console.error("[SPACE] admin reaktion:", err);
    res.status(500).json({ ok: false, error: "Serverfehler" });
  }
});

/** POST /admin/space/:id/kommentar */
router.post("/admin/space/:id/kommentar", async (req: Request, res: Response) => {
  try {
    const konto = await betreiberKonto();
    if (!konto) return res.status(400).json({ ok: false, error: "Zum Kommentieren braucht es ein Prüfkonto." });
    const text = String(req.body?.text ?? "").trim();
    const befund = pruefeBeitrag(text);
    if (!befund.erlaubt) return res.status(400).json({ ok: false, error: befund.grund });
    const postId = Number(req.params.id);
    let elternteil: number | null = null;
    if (req.body?.antwortAuf) {
      const [e] = (await sqlPool`
        SELECT id, antwort_auf FROM fiaon_post_kommentare
        WHERE id = ${Number(req.body.antwortAuf)} AND post_id = ${postId} AND geloescht_at IS NULL
      `) as any[];
      if (e) elternteil = e.antwort_auf ? Number(e.antwort_auf) : Number(e.id);
    }
    await sqlPool`
      INSERT INTO fiaon_post_kommentare (post_id, agent_id, text, antwort_auf)
      VALUES (${postId}, ${konto.id}, ${text}, ${elternteil})
    `;
    res.json({ ok: true });
  } catch (err) {
    console.error("[SPACE] admin kommentar:", err);
    res.status(500).json({ ok: false, error: "Serverfehler" });
  }
});

/** DELETE /admin/space/:id — Moderation. Immer protokolliert. */
router.delete("/admin/space/:id", async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id);
    await sqlPool`
      UPDATE fiaon_posts
      SET geloescht_at = NOW(), geloescht_grund = ${String(req.body?.grund || "Moderation durch den Vorgesetzten")},
          updated_at = NOW()
      WHERE id = ${id} AND geloescht_at IS NULL
    `;
    console.log(`[SPACE] Beitrag ${id} vom Vorgesetzter gelöscht`);
    res.json({ ok: true });
  } catch (err) {
    console.error("[SPACE] admin loeschen:", err);
    res.status(500).json({ ok: false, error: "Serverfehler" });
  }
});

/** POST /admin/space/:id/anpinnen — mit derselben Zwei-Grenze. */
router.post("/admin/space/:id/anpinnen", async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id);
    const an = req.body?.an !== false;
    if (an) {
      const belegt = (await sqlPool`
        SELECT id, LEFT(text, 90) AS anriss FROM fiaon_posts
        WHERE angepinnt AND geloescht_at IS NULL AND id <> ${id}
        ORDER BY angepinnt_am ASC NULLS FIRST, id ASC
      `) as any[];
      if (belegt.length >= PIN_GRENZE) {
        const weichen = Number(req.body?.weichen || 0);
        if (!weichen) {
          return res.status(409).json({
            ok: false, grenzeErreicht: true, grenze: PIN_GRENZE,
            angepinnte: belegt.map((b) => ({
              id: Number(b.id), anriss: String(b.anriss).replace(/\n+/g, " ").trim(),
            })),
            error: `Es sind schon ${PIN_GRENZE} Beiträge angepinnt. Welcher soll weichen?`,
          });
        }
        await sqlPool`
          UPDATE fiaon_posts SET angepinnt = FALSE, angepinnt_am = NULL WHERE id = ${weichen}
        `;
      }
    }
    await sqlPool`
      UPDATE fiaon_posts SET angepinnt = ${an}, angepinnt_am = ${an ? new Date() : null},
        angepinnt_von = ${an ? "Vorgesetzter" : null}, updated_at = NOW()
      WHERE id = ${id} AND geloescht_at IS NULL
    `;
    res.json({ ok: true, angepinnt: an });
  } catch (err) {
    console.error("[SPACE] admin anpinnen:", err);
    res.status(500).json({ ok: false, error: "Serverfehler" });
  }
});

export default router;
