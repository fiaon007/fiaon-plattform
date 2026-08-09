// ═══════════════════════════════════════════════════════════════════════════
// ERSTE SCHRITTE — Routen
//
// Manche Schritte werden ANGEKLICKT, andere ERKANNT. „Profil vervollständigen"
// hakt der Mensch ab; „erstes Ergebnis dokumentiert" liest der Server aus dem
// Kontaktprotokoll. Eine Checkliste, in der man sich selbst bescheinigt,
// gearbeitet zu haben, wäre wertlos für den Betreiber — und die Admin-Sicht
// lebt genau davon.
// ═══════════════════════════════════════════════════════════════════════════

import { Router, type Request, type Response } from "express";
import { sqlPool } from "../lib/db-pool";
import { requireAgent, type AgentRequest } from "./fiaon-agent";
import { ensureRolleSpalte } from "./fiaon-vertrieb";
import { streckeFuer } from "../../shared/fiaon-onboarding-schritte";

const router = Router();

/**
 * Automatisch erkannte Schritte.
 *
 * Getrennt von den angeklickten, weil sie eine andere Wahrheit sind: Der Klick
 * sagt „ich habe hingesehen", die Erkennung sagt „es ist passiert".
 */
async function automatisch(agentId: number): Promise<Record<string, string | null>> {
  const [a] = (await sqlPool`
    SELECT a.id, a.rolle, a.avatar, a.phone,
           (a.password_hash IS NOT NULL) AS hat_passwort,
           a.created_at AS beitritt,
           (SELECT MIN(accepted_at) FROM fiaon_vertrieb_zusagen z
             WHERE z.agent_id = a.id AND z.widerrufen_am IS NULL) AS zusage_am,
           (SELECT MIN(cl.created_at) FROM fiaon_contact_log cl
             WHERE cl.agent_id = a.id AND cl.type <> 'system') AS erstes_ergebnis,
           (SELECT MIN(created_at) FROM fiaon_agent_events e
             WHERE e.agent_id = a.id AND e.type = 'vertrag_unterschrieben') AS vertrag_am,
           (SELECT MIN(w.created_at) FROM fiaon_raten_arbeit w WHERE w.agent_id = a.id) AS erste_rate,
           (SELECT COUNT(*)::int FROM fiaon_agent_verfuegbarkeit v WHERE v.agent_id = a.id) AS zeiten,
           a.space_gesehen_am,
           (SELECT COUNT(*)::int FROM fiaon_persons p
             WHERE p.assigned_agent_id = a.id AND p.merged_into_person_id IS NULL) AS kunden
    FROM fiaon_agents a WHERE a.id = ${agentId}
  `) as any[];
  if (!a) return {};

  // ── DER VERTRAG ────────────────────────────────────────────────────────
  // Der Schritt sagt selbst: „Ohne Vertrag kein Zugang — das war der erste
  // Schritt und ist schon erledigt." Bis zum 11.08.2026 hing er trotzdem an
  // der Verpflichtungserklärung, die es für die Rolle „agent" gar nicht gibt.
  // Ergebnis: Ein Schritt, der behauptete, erledigt zu sein, und offen
  // dastand. Genau das hat der Betreiber beanstandet.
  //
  // Die richtige Ableitung steht im Text: WER ZUGANG HAT, HAT EINEN VERTRAG.
  // Zugang heißt, das Passwort ist gesetzt — die Einladung wurde angenommen.
  const vertrag = a.vertrag_am ?? a.zusage_am ?? (a.hat_passwort ? a.beitritt : null);
  const ergebnis = String(a.rolle) === "inkasso" ? (a.erste_rate ?? a.erstes_ergebnis) : a.erstes_ergebnis;

  return {
    vertrag: vertrag ? String(vertrag) : null,
    zusage: a.zusage_am ? String(a.zusage_am) : null,
    // Profil gilt als fertig, wenn Bild ODER Telefonnummer da ist — beides zu
    // verlangen hakt bei jedem, der kein Foto hochladen will.
    profil: a.avatar || a.phone ? "erkannt" : null,
    verfuegbarkeit: Number(a.zeiten) > 0 ? "erkannt" : null,
    erstes_ergebnis: ergebnis ? String(ergebnis) : null,
    // ── DER SPACE (11.08.2026) ──────────────────────────────────────────
    // Dieser Schritt liess sich bisher NUR von Hand abhaken, obwohl die
    // Spalte `space_gesehen_am` bei jedem Besuch gesetzt wird. Der Betreiber
    // war Dutzende Male dort und sah den Schritt trotzdem als offen.
    // Ein Häkchen, das man setzen muss, obwohl das System es längst weiss,
    // ist kein Häkchen, sondern eine Zumutung.
    space: a.space_gesehen_am ? String(a.space_gesehen_am) : null,
  };
}

/**
 * Ein Schritt, der auf eine Seite zeigt, gilt als erledigt, sobald man dort
 * WAR. Nicht als „gelesen und verstanden" — das kann keine Software prüfen —
 * sondern als „hingegangen".
 *
 * Der Besuch wird von der Seite selbst gemeldet (POST .../besucht). Er landet
 * in derselben Tabelle wie das Abhaken von Hand: Für die Auswertung ist es
 * derselbe Vorgang, nur ohne Klick.
 */
export async function besuchVermerken(
  agentId: number, schluessel: string,
): Promise<void> {
  await sqlPool`
    INSERT INTO fiaon_onboarding_schritte (agent_id, schluessel)
    VALUES (${agentId}, ${schluessel})
    ON CONFLICT (agent_id, schluessel) DO NOTHING
  `;
}

/** GET /agent/erste-schritte */
router.get("/agent/erste-schritte", requireAgent, async (req: AgentRequest, res: Response) => {
  try {
    await ensureRolleSpalte();
    const [a] = (await sqlPool`
      SELECT rolle, COALESCE(NULLIF(first_name, ''), name) AS vorname, created_at
      FROM fiaon_agents WHERE id = ${req.agent!.id}
    `) as any[];
    const rolle = String(a?.rolle || "agent");
    const strecke = streckeFuer(rolle);

    // ── Willkommens-Post im Space ────────────────────────────────────────
    // HIER und nicht bei der Einladung: Eine Einladung ist eine Absicht, ein
    // erster Aufruf dieser Seite ist ein Mensch, der wirklich da ist. Wer
    // Eingeladene begrüßt, begrüßt auch die, die nie erscheinen.
    //
    // `autoPost` ist über den Schlüssel idempotent — bei jedem weiteren Aufruf
    // passiert nichts. Es stehen KEINE Kundendaten darin.
    try {
      const { autoPost } = await import("../lib/fiaon-space");
      const rolleText: Record<string, string> = {
        agent: "Vertrieb", vertriebsleiter: "Vertriebsleitung",
        onboarding: "Onboarding", inkasso: "Forderungsmanagement",
      };
      await autoPost("neuzugang", `agent-${req.agent!.id}`,
        `${String(a?.vorname || req.agent!.name)} ist neu im Team — ${rolleText[rolle] ?? rolle}.\n\n`
        + "Sagt kurz hallo, wenn ihr euch über den Weg klickt.");
    } catch (e) {
      // Ein fehlender Begrüßungspost darf die Einarbeitung nicht aufhalten.
      console.error("[ERSTE-SCHRITTE] Space-Post:", e);
    }

    const geklickt = (await sqlPool`
      SELECT schluessel, erledigt_am FROM fiaon_onboarding_schritte WHERE agent_id = ${req.agent!.id}
    `) as any[];
    const auto = await automatisch(req.agent!.id);

    const schritte = strecke.schritte.map((s) => {
      const k = geklickt.find((g) => g.schluessel === s.schluessel);
      const erkannt = auto[s.schluessel] ?? null;
      return {
        ...s,
        erledigt: !!k || !!erkannt,
        erledigtAm: k?.erledigt_am ?? (erkannt && erkannt !== "erkannt" ? erkannt : null),
        // Woher das Häkchen kommt, gehört sichtbar dazu — ein automatisch
        // erkannter Schritt lässt sich nicht wegklicken und soll auch nicht
        // aussehen, als hätte man ihn abgehakt.
        quelle: erkannt ? "erkannt" : k ? "geklickt" : null,
      };
    });

    const fertig = schritte.filter((s) => s.erledigt).length;
    res.json({
      ok: true, rolle, vorname: String(a?.vorname || ""),
      begruessung: strecke.begruessung,
      schritte, karten: strecke.karten, ersteAufgabe: strecke.ersteAufgabe,
      fertig, gesamt: schritte.length,
      // Die Tafel zeigt sich von selbst, solange etwas offen ist — aber sie
      // blockiert nichts, und wer sie wegklickt, sieht sie erst wieder, wenn
      // er sie im Profil öffnet.
      abgeschlossen: fertig >= schritte.length,
    });
  } catch (err) {
    console.error("[ERSTE-SCHRITTE]", err);
    res.status(500).json({ ok: false, error: "Serverfehler" });
  }
});

/** POST /agent/erste-schritte/:schluessel — abhaken. */
/**
 * POST /agent/erste-schritte/besucht/:schluessel
 *
 * Meldet, dass die Zielseite eines Schritts geöffnet wurde. Absichtlich eine
 * eigene Adresse und nicht dieselbe wie das Abhaken: Der Aufruf kommt
 * automatisch beim Laden einer Seite, und ein automatischer Aufruf soll nie
 * versehentlich etwas abhaken können, was gar nicht gemeint war.
 */
router.post("/agent/erste-schritte/besucht/:schluessel", requireAgent, async (req: AgentRequest, res: Response) => {
  try {
    const schluessel = String(req.params.schluessel);
    // Nur Schritte, die es in der Strecke dieser Rolle wirklich gibt.
    const [a] = (await sqlPool`SELECT rolle FROM fiaon_agents WHERE id = ${req.agent!.id}`) as any[];
    const erlaubt = streckeFuer(String(a?.rolle || "agent")).schritte
      .filter((sc) => !sc.automatisch && sc.ziel)
      .map((sc) => sc.schluessel);
    if (!erlaubt.includes(schluessel)) return res.json({ ok: true, vermerkt: false });
    await besuchVermerken(req.agent!.id, schluessel);
    res.json({ ok: true, vermerkt: true });
  } catch (err) {
    console.error("[ERSTE-SCHRITTE] besucht:", err);
    res.json({ ok: true, vermerkt: false });
  }
});

router.post("/agent/erste-schritte/:schluessel", requireAgent, async (req: AgentRequest, res: Response) => {
  try {
    await sqlPool`
      INSERT INTO fiaon_onboarding_schritte (agent_id, schluessel)
      VALUES (${req.agent!.id}, ${String(req.params.schluessel)})
      ON CONFLICT (agent_id, schluessel) DO NOTHING
    `;
    res.json({ ok: true });
  } catch (err) {
    console.error("[ERSTE-SCHRITTE] abhaken:", err);
    res.status(500).json({ ok: false, error: "Serverfehler" });
  }
});

/**
 * GET /admin/erste-schritte — wer hängt?
 *
 * Nur für Menschen, die in den letzten 90 Tagen dazugekommen sind. Bei einem
 * Kollegen aus dem Vorjahr ist die Checkliste keine Information mehr, sondern
 * Rauschen.
 */
router.get("/admin/erste-schritte", async (_req: Request, res: Response) => {
  try {
    await ensureRolleSpalte();
    const agenten = (await sqlPool`
      SELECT id, COALESCE(NULLIF(first_name, ''), name) AS vorname, name, rolle, created_at, last_login_at
      FROM fiaon_agents
      WHERE active AND (NOT is_test_account OR pruefkonto) AND created_at > NOW() - INTERVAL '90 days'
      ORDER BY created_at DESC
    `) as any[];

    const zeilen = [];
    for (const a of agenten) {
      const strecke = streckeFuer(String(a.rolle || "agent"));
      const geklickt = (await sqlPool`
        SELECT schluessel FROM fiaon_onboarding_schritte WHERE agent_id = ${a.id}
      `) as any[];
      const auto = await automatisch(Number(a.id));
      const fertig = strecke.schritte.filter(
        (s) => geklickt.some((g) => g.schluessel === s.schluessel) || auto[s.schluessel],
      ).length;
      zeilen.push({
        id: a.id, name: a.name, vorname: a.vorname, rolle: a.rolle,
        seit: a.created_at, letzterLogin: a.last_login_at,
        vertrag: !!auto.vertrag, zusage: !!auto.zusage,
        fertig, gesamt: strecke.schritte.length,
        ersteDokumentation: auto.erstes_ergebnis && auto.erstes_ergebnis !== "erkannt"
          ? auto.erstes_ergebnis : null,
        // Der Punkt der ganzen Ansicht: Wer ist seit über einer Woche da und
        // hat noch nichts dokumentiert?
        haengt: !auto.erstes_ergebnis
          && new Date(a.created_at).getTime() < Date.now() - 7 * 86_400_000,
      });
    }
    res.json({ ok: true, neue: zeilen });
  } catch (err) {
    console.error("[ERSTE-SCHRITTE] admin:", err);
    res.status(500).json({ ok: false, error: "Serverfehler" });
  }
});

export default router;
