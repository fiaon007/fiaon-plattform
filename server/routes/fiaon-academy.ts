// ═══════════════════════════════════════════════════════════════════════════
// DIE ACADEMY FÜR DAS TEAM — ROLLEN-GEFILTERT, MIT FORTSCHRITT
//
// ── WAS NEU IST (28.08.2026) ───────────────────────────────────────────────
// Die Academy lief seit dem 26.08. nur in der Verwaltung: Der Betreiber teilt
// den Bildschirm und führt vor. Jetzt bekommt jeder Mitarbeiter SEINE Reise —
// unter „Mehr → Academy".
//
// Die Rollenfilterung war vorbereitet (`reisenFuerRolle` in
// `shared/fiaon-academy.ts`) und wird hier zum ersten Mal benutzt. Genau
// deshalb stand sie dort und nicht in der Seite: Eine Filterregel gehört an
// EINE Stelle, auch wenn sie zunächst nur einen Aufrufer hat.
//
//   agent          → Vertrieb
//   onboarding     → Onboarding
//   inkasso        → Forderungsmanagement
//   vertriebsleiter/admin → alle drei
//
// ── DER FORTSCHRITT ────────────────────────────────────────────────────────
// Je Mitarbeiter und Reise das höchste erreichte Kapitel. Er dient zwei
// Zwecken: Der Mitarbeiter sieht, wo er weitermachen kann, und die
// Vertriebsleitung sieht in der Team-Zentrale, wer die Einschulung durchhat.
//
// Bewusst NICHT als Prüfung oder Note: Wer eine Schulung als Test erlebt,
// klickt durch. Es steht nur da, wie weit jemand gekommen ist.
// ═══════════════════════════════════════════════════════════════════════════
import { Router, type Response } from "express";
import { sqlPool } from "../lib/db-pool";
import { REISEN, reisenFuerRolle, reise as reiseFinden } from "../../shared/fiaon-academy";
import { requireAgent, type AgentRequest } from "./fiaon-agent";

const router = Router();

/** Die Tabelle für den Fortschritt — idempotent, wie alle `ensure`-Funktionen. */
let sichergestellt = false;
async function ensureAcademyTabellen(): Promise<void> {
  if (sichergestellt) return;
  await sqlPool`
    CREATE TABLE IF NOT EXISTS fiaon_academy_fortschritt (
      agent_id      INTEGER NOT NULL,
      reise         VARCHAR(32) NOT NULL,
      -- Das HÖCHSTE erreichte Kapitel, nicht das letzte gesehene: Wer
      -- zurückblättert, verliert seinen Stand nicht.
      kapitel_max   INTEGER NOT NULL DEFAULT 0,
      kapitel_gesamt INTEGER NOT NULL DEFAULT 0,
      zuletzt_am    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      fertig_am     TIMESTAMPTZ,
      PRIMARY KEY (agent_id, reise)
    )
  `;
  sichergestellt = true;
}

/** Die Rolle eines Mitarbeiters — über die bestehende Funktion. */
async function rolle(agentId: number): Promise<string> {
  const { rolleVon } = await import("../lib/fiaon-kundenzugriff");
  return String(await rolleVon(agentId));
}

// ═══════════════════════════════════════════════════════════════════════════
// GET /agent/academy — MEINE Reisen, mit Fortschritt
// ═══════════════════════════════════════════════════════════════════════════
router.get("/agent/academy", requireAgent, async (req: AgentRequest, res: Response) => {
  try {
    await ensureAcademyTabellen();
    const r = await rolle(req.agent!.id);
    const meine = reisenFuerRolle(r);

    const stand = (await sqlPool`
      SELECT reise, kapitel_max, kapitel_gesamt, zuletzt_am, fertig_am
      FROM fiaon_academy_fortschritt WHERE agent_id = ${req.agent!.id}
    `) as any[];
    const nachReise = new Map(stand.map((s) => [String(s.reise), s]));

    res.json({
      ok: true,
      rolle: r,
      reisen: meine.map((re) => {
        const s = nachReise.get(re.key);
        return {
          key: re.key, titel: re.titel, unterzeile: re.unterzeile,
          dauerMin: re.dauerMin, kapitelZahl: re.kapitel.length,
          ton: re.ton,
          fortschritt: {
            kapitel: Number(s?.kapitel_max ?? 0),
            gesamt: re.kapitel.length,
            fertig: !!s?.fertig_am,
            zuletztAm: s?.zuletzt_am ?? null,
          },
        };
      }),
      // Wer alle drei sieht, ist Leitung — das gehört gesagt, damit niemand
      // rätselt, warum er mehr sieht als der Kollege.
      hinweis: meine.length === REISEN.length
        ? "Du siehst alle drei Reisen, weil du in der Leitung bist."
        : `Deine Reise als ${r}. Die anderen Abteilungen haben eigene.`,
    });
  } catch (err) {
    console.error("[ACADEMY] laden:", err);
    res.status(500).json({ ok: false, error: "Serverfehler" });
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// GET /agent/academy/:reise — die Kapitel einer Reise
// ═══════════════════════════════════════════════════════════════════════════
router.get("/agent/academy/:reise", requireAgent, async (req: AgentRequest, res: Response) => {
  try {
    await ensureAcademyTabellen();
    const r = await rolle(req.agent!.id);
    const key = String(req.params.reise);

    // ── DIE WAND: NUR DIE EIGENE REISE ────────────────────────────────────
    // Sie steht im SERVER, nicht in der Anzeige. Ein Mitarbeiter, der die
    // Adresse einer fremden Reise eintippt, bekommt 404 — nicht die Reise.
    // (Das ist keine Geheimhaltung, sondern Klarheit: Wer die Inkasso-Reise
    // durchklickt, glaubt hinterher, sie sei seine Aufgabe.)
    const erlaubt = reisenFuerRolle(r).some((x) => x.key === key);
    if (!erlaubt) {
      return res.status(404).json({
        ok: false,
        error: "Diese Reise gehört zu einer anderen Abteilung. "
          + "Deine findest du unter „Mehr → Academy“.",
      });
    }

    const re = reiseFinden(key);
    if (!re) return res.status(404).json({ ok: false, error: "Reise nicht gefunden" });

    const [s] = (await sqlPool`
      SELECT kapitel_max, fertig_am FROM fiaon_academy_fortschritt
      WHERE agent_id = ${req.agent!.id} AND reise = ${key}
    `) as any[];

    res.json({
      ok: true,
      reise: {
        key: re.key, titel: re.titel, unterzeile: re.unterzeile,
        dauerMin: re.dauerMin, ton: re.ton, kapitel: re.kapitel,
      },
      fortschritt: {
        kapitel: Number(s?.kapitel_max ?? 0),
        gesamt: re.kapitel.length,
        fertig: !!s?.fertig_am,
      },
    });
  } catch (err) {
    console.error("[ACADEMY] reise:", err);
    res.status(500).json({ ok: false, error: "Serverfehler" });
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// POST /agent/academy/:reise/fortschritt — wie weit bin ich?
// ═══════════════════════════════════════════════════════════════════════════
router.post("/agent/academy/:reise/fortschritt", requireAgent, async (req: AgentRequest, res: Response) => {
  try {
    await ensureAcademyTabellen();
    const r = await rolle(req.agent!.id);
    const key = String(req.params.reise);
    if (!reisenFuerRolle(r).some((x) => x.key === key)) {
      return res.status(404).json({ ok: false, error: "Reise nicht gefunden" });
    }
    const re = reiseFinden(key);
    if (!re) return res.status(404).json({ ok: false, error: "Reise nicht gefunden" });

    const kapitel = Math.max(0, Math.min(re.kapitel.length, Number(req.body?.kapitel) || 0));

    // ── NUR NACH VORN ─────────────────────────────────────────────────────
    // `GREATEST`: Wer zurückblättert, verliert seinen Stand nicht. Sonst
    // stünde am Ende der Sitzung der Punkt, an dem jemand zuletzt geschaut
    // hat — und das wäre bei einer Wiederholung ein Rückschritt.
    await sqlPool`
      INSERT INTO fiaon_academy_fortschritt
        (agent_id, reise, kapitel_max, kapitel_gesamt, zuletzt_am, fertig_am)
      VALUES (${req.agent!.id}, ${key}, ${kapitel}, ${re.kapitel.length}, NOW(),
              ${kapitel >= re.kapitel.length ? new Date() : null})
      ON CONFLICT (agent_id, reise) DO UPDATE SET
        kapitel_max = GREATEST(fiaon_academy_fortschritt.kapitel_max, EXCLUDED.kapitel_max),
        kapitel_gesamt = EXCLUDED.kapitel_gesamt,
        zuletzt_am = NOW(),
        -- Einmal fertig bleibt fertig. Wer die Reise ein zweites Mal ansieht,
        -- hat sie nicht verlernt.
        fertig_am = COALESCE(fiaon_academy_fortschritt.fertig_am, EXCLUDED.fertig_am)
    `;
    res.json({ ok: true, kapitel, gesamt: re.kapitel.length });
  } catch (err) {
    console.error("[ACADEMY] fortschritt:", err);
    res.status(500).json({ ok: false, error: "Serverfehler" });
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// GET /admin/academy/stand — für die Team-Zentrale
// ═══════════════════════════════════════════════════════════════════════════
//
// Je Mensch: „Academy: Kapitel x/y". Kein Urteil, nur ein Stand — die
// Vertriebsleitung sieht, mit wem sie noch einmal durchgehen sollte.
router.get("/admin/academy/stand", async (_req, res: Response) => {
  try {
    await ensureAcademyTabellen();
    const { echteMitarbeiterSql } = await import("../lib/fiaon-mitarbeiter-sicht");
    const zeilen = (await sqlPool`
      SELECT a.id, a.name, a.rolle,
             f.reise, f.kapitel_max, f.kapitel_gesamt, f.fertig_am, f.zuletzt_am
      FROM fiaon_agents a
      LEFT JOIN fiaon_academy_fortschritt f ON f.agent_id = a.id
      WHERE a.active AND COALESCE(a.is_test_account, FALSE) = FALSE
      ORDER BY a.name, f.reise
    `) as any[];

    // Je Mensch zusammenfassen — und die Reisen nennen, die er sehen SOLL.
    const jeMensch = new Map<number, any>();
    for (const z of zeilen) {
      if (!jeMensch.has(Number(z.id))) {
        const soll = reisenFuerRolle(String(z.rolle));
        jeMensch.set(Number(z.id), {
          id: Number(z.id), name: z.name, rolle: z.rolle,
          sollReisen: soll.map((r) => ({ key: r.key, titel: r.titel, gesamt: r.kapitel.length })),
          stand: [] as any[],
        });
      }
      if (z.reise) {
        jeMensch.get(Number(z.id))!.stand.push({
          reise: z.reise, kapitel: Number(z.kapitel_max), gesamt: Number(z.kapitel_gesamt),
          fertig: !!z.fertig_am, zuletztAm: z.zuletzt_am,
        });
      }
    }

    const liste = Array.from(jeMensch.values()).map((m) => {
      // Ein Satz je Mensch, wie der Auftrag es verlangt: „Academy: Kapitel x/y".
      const eigene = m.stand.filter((s: any) =>
        m.sollReisen.some((r: any) => r.key === s.reise));
      const summeIst = eigene.reduce((n: number, s: any) => n + s.kapitel, 0);
      const summeSoll = m.sollReisen.reduce((n: number, r: any) => n + r.gesamt, 0);
      return {
        ...m,
        kurz: summeSoll === 0 ? "keine Reise zugeordnet"
          : `Academy: Kapitel ${summeIst}/${summeSoll}`
            + (eigene.length > 0 && eigene.every((s: any) => s.fertig) ? " · durch" : ""),
        angefangen: eigene.length > 0,
      };
    });

    res.json({
      ok: true,
      mitarbeiter: liste,
      // Die Zahl, die die Leitung interessiert: Wer hat noch nicht angefangen?
      nichtAngefangen: liste.filter((m) => !m.angefangen).map((m) => m.name),
      hinweis: `${liste.filter((m) => m.angefangen).length} von ${liste.length} `
        + "haben die Academy geöffnet.",
      _echteMitarbeiterSqlVorhanden: typeof echteMitarbeiterSql === "function",
    });
  } catch (err) {
    console.error("[ACADEMY] stand:", err);
    res.status(500).json({ ok: false, error: "Serverfehler" });
  }
});

export default router;
