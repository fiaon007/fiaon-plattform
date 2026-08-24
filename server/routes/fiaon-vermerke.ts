// ═══════════════════════════════════════════════════════════════════════════
// FIAON VERMERKE — Notizen und Aufgaben an der Person
//
// Bisher gab es zwei Wege, etwas festzuhalten: das Kontaktprotokoll (was am
// Telefon passiert ist) und den Kopf des Vorgesetzten. Was fehlte, war der
// Zettel an der Akte: „Rückruf am Freitag", „Unterlagen prüfen", „Vorsicht,
// zahlt immer spät" — mit Frist, mit Zuständigem, und mit einer Antwort auf die
// Frage, WER das sehen darf.
//
// EIN OBJEKT, ZWEI ARTEN
//   notiz    Information. Hat keinen Zustand, wird nie „erledigt".
//   aufgabe  Etwas ist zu tun. Hat Frist, Zuständigen und Zustand.
// Beides in einer Tabelle, weil beides derselbe Zettel an derselben Akte ist:
// So gibt es EINEN Strom je Person, EINE Sichtbarkeitslogik und keine zwei
// Ansichten, die man nebeneinander lesen muss.
//
// SICHTBARKEIT (die eigentliche Anforderung)
//   privat   Nur der Vorgesetzte. Kein Agent sieht das je.
//   team     Alle aktiven Agenten und der Vorgesetzte.
//   auswahl  Der Vorgesetzte und ausdrücklich benannte Agenten.
// Eine Aufgabe, die einem Agenten zugewiesen ist, sieht dieser Agent IMMER —
// unabhängig von der Sichtbarkeit. Eine Aufgabe, die ihr Zuständiger nicht
// lesen darf, wäre ein Widerspruch.
//
// Regeln, die aus der Praxis kommen:
//   · Frist ist optional. Eine erzwungene Frist führt zu Fantasiedaten.
//   · Nichts wird gelöscht, nur zurückgezogen (`entfernt_am`) — dieselbe Regel
//     wie überall sonst im System.
//   · Der Agent kann erledigen und wieder öffnen, aber nichts fremdes ändern.
// ═══════════════════════════════════════════════════════════════════════════

import { Router, type Request, type Response } from "express";
import { sqlPool } from "../lib/db-pool";
import { berlinToday } from "../lib/fiaon-time";
import { requireAgent, type AgentRequest } from "./fiaon-agent";
import { sendMakeWebhook } from "../make-webhook";
import { absoluteUrl } from "../fiaon-base-url";

const router = Router();

export type VermerkArt = "notiz" | "aufgabe";
export type VermerkSicht = "privat" | "team" | "auswahl";

let geprueft = false;
export async function ensureVermerkTabelle(): Promise<void> {
  if (geprueft) return;
  await sqlPool`
    CREATE TABLE IF NOT EXISTS fiaon_vermerke (
      id SERIAL PRIMARY KEY,
      art VARCHAR NOT NULL DEFAULT 'notiz',
      -- Bezug: Antrag (ref) ODER Lead (lead_id). Beide leer = allgemeiner Vermerk.
      ref VARCHAR,
      lead_id INTEGER,
      text TEXT NOT NULL,
      -- Sichtbarkeit
      sicht VARCHAR NOT NULL DEFAULT 'privat',
      sicht_agenten INTEGER[] NOT NULL DEFAULT '{}',
      -- Aufgabe
      zustaendig_agent_id INTEGER,
      fuer_betreiber BOOLEAN NOT NULL DEFAULT FALSE,
      faellig_am DATE,
      dringend BOOLEAN NOT NULL DEFAULT FALSE,
      status VARCHAR NOT NULL DEFAULT 'offen',
      erledigt_am TIMESTAMPTZ,
      erledigt_von VARCHAR,
      -- Urheber
      autor_art VARCHAR NOT NULL DEFAULT 'admin',
      autor_agent_id INTEGER,
      autor_name VARCHAR NOT NULL DEFAULT 'Verwaltung',
      -- Rückzug statt Löschen
      entfernt_am TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;
  await sqlPool`CREATE INDEX IF NOT EXISTS fiaon_vermerke_ref_idx ON fiaon_vermerke (ref)`;
  await sqlPool`CREATE INDEX IF NOT EXISTS fiaon_vermerke_agent_idx ON fiaon_vermerke (zustaendig_agent_id, status)`;
  await sqlPool`CREATE INDEX IF NOT EXISTS fiaon_vermerke_faellig_idx ON fiaon_vermerke (status, faellig_am)`;
  geprueft = true;
}

// ── Hilfen ───────────────────────────────────────────────────────────────────
function text(v: unknown, max = 4000): string {
  return String(v ?? "").trim().slice(0, max);
}

/** Frist prüfen. Optional; wenn gesetzt, muss sie lesbar sein. */
function pruefeFrist(v: unknown): { datum: string | null; fehler?: string } {
  const s = text(v, 10);
  if (!s) return { datum: null };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return { datum: null, fehler: "Frist unlesbar (erwartet JJJJ-MM-TT)." };
  return { datum: s };
}

/** Zahlenliste aus dem Body — für die Auswahl bestimmter Agenten. */
function agentenListe(v: unknown): number[] {
  if (!Array.isArray(v)) return [];
  return Array.from(new Set(v.map((x) => Number(x)).filter((n) => Number.isInteger(n) && n > 0)));
}

/**
 * Anzeigename der Person, auf die sich ein Vermerk bezieht. Ein Vermerk ohne
 * erkennbaren Bezug ist im Alltag wertlos — der Agent muss wissen, um WEN es
 * geht, ohne erst die Akte zu öffnen.
 */
const NAME_SQL = `COALESCE(
  NULLIF(TRIM(a.company_name), ''),
  NULLIF(TRIM(CONCAT_WS(' ', a.first_name, a.last_name)), ''),
  NULLIF(TRIM(a.contact_name), ''),
  a.ref
)`;

const AUSWAHL = `
  v.id, v.art, v.ref, v.lead_id, v.text, v.sicht, v.sicht_agenten,
  v.zustaendig_agent_id, v.fuer_betreiber, v.faellig_am, v.dringend,
  v.status, v.erledigt_am, v.erledigt_von,
  v.autor_art, v.autor_agent_id, v.autor_name, v.created_at, v.updated_at
`;

function abbilden(r: any) {
  const faellig = r.faellig_am ? new Date(r.faellig_am).toISOString().slice(0, 10) : null;
  const heute = berlinToday();
  return {
    id: Number(r.id),
    art: r.art as VermerkArt,
    ref: r.ref || null,
    leadId: r.lead_id != null ? Number(r.lead_id) : null,
    kunde: r.kunde_name || null,
    akte: r.ref ? `/admin/kunde/${encodeURIComponent(r.ref)}` : r.lead_id ? `/admin/kunde/lead-${r.lead_id}` : null,
    text: r.text,
    sicht: r.sicht as VermerkSicht,
    sichtAgenten: Array.isArray(r.sicht_agenten) ? r.sicht_agenten.map((n: any) => Number(n)) : [],
    zustaendigAgentId: r.zustaendig_agent_id != null ? Number(r.zustaendig_agent_id) : null,
    zustaendigName: r.zustaendig_name || null,
    fuerBetreiber: !!r.fuer_betreiber,
    faelligAm: faellig,
    // Überfällig wird SERVERSEITIG bestimmt (Berliner Tagesgrenze) — sonst
    // rechnet jedes Gerät mit seiner eigenen Zeitzone.
    ueberfaellig: !!(faellig && r.status === "offen" && faellig < heute),
    heuteFaellig: !!(faellig && r.status === "offen" && faellig === heute),
    dringend: !!r.dringend,
    status: r.status as "offen" | "erledigt",
    erledigtAm: r.erledigt_am || null,
    erledigtVon: r.erledigt_von || null,
    autorArt: r.autor_art,
    autorName: r.autor_name,
    createdAt: r.created_at,
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// BETREIBER
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Liste. `ref`/`lead` = Vermerke einer Person (für Akte und Detailfenster),
 * sonst alles. `nur=meine` zeigt die eigenen offenen Aufgaben.
 */
router.get("/admin/vermerke", async (req: Request, res: Response) => {
  try {
    await ensureVermerkTabelle();
    const ref = text(req.query.ref, 120);
    const leadId = Number(req.query.lead) || null;
    const nur = text(req.query.nur, 20);
    const status = text(req.query.status, 20);
    const limit = Math.min(300, Math.max(1, Number(req.query.limit) || 200));

    const bedingungen: string[] = ["v.entfernt_am IS NULL"];
    if (ref) bedingungen.push(`v.ref = $1`);
    else if (leadId) bedingungen.push(`v.lead_id = ${leadId}`);
    if (nur === "meine") bedingungen.push(`v.art = 'aufgabe' AND v.fuer_betreiber = TRUE`);
    if (nur === "aufgaben") bedingungen.push(`v.art = 'aufgabe'`);
    if (status === "offen") bedingungen.push(`v.status = 'offen'`);
    if (status === "erledigt") bedingungen.push(`v.status = 'erledigt'`);

    const rows = await sqlPool.unsafe(`
      SELECT ${AUSWAHL},
             ${NAME_SQL} AS kunde_name,
             ag.name AS zustaendig_name
      FROM fiaon_vermerke v
      LEFT JOIN fiaon_applications a ON a.ref = v.ref
      LEFT JOIN fiaon_agents ag ON ag.id = v.zustaendig_agent_id
      WHERE ${bedingungen.join(" AND ")}
      ORDER BY (v.status = 'offen') DESC,
               v.faellig_am ASC NULLS LAST,
               v.created_at DESC
      LIMIT ${limit}
    `, ref ? [ref] : []);

    res.json({ ok: true, vermerke: rows.map(abbilden) });
  } catch (err) {
    console.error("[FIAON-VERMERK] liste:", err);
    res.status(500).json({ ok: false, error: "Serverfehler" });
  }
});

/** Zähler für Dashboard und Navigation. */
export async function vermerkZahlen(): Promise<{ offen: number; ueberfaellig: number; heute: number; zugewiesen: number }> {
  await ensureVermerkTabelle();
  const heute = berlinToday();
  const [z] = await sqlPool`
    SELECT
      COUNT(*) FILTER (WHERE art = 'aufgabe' AND status = 'offen' AND fuer_betreiber)::int AS offen,
      COUNT(*) FILTER (WHERE art = 'aufgabe' AND status = 'offen' AND fuer_betreiber AND faellig_am < ${heute}::date)::int AS ueberfaellig,
      COUNT(*) FILTER (WHERE art = 'aufgabe' AND status = 'offen' AND fuer_betreiber AND faellig_am = ${heute}::date)::int AS heute,
      COUNT(*) FILTER (WHERE art = 'aufgabe' AND status = 'offen' AND zustaendig_agent_id IS NOT NULL)::int AS zugewiesen
    FROM fiaon_vermerke WHERE entfernt_am IS NULL
  `;
  return {
    offen: Number(z.offen), ueberfaellig: Number(z.ueberfaellig),
    heute: Number(z.heute), zugewiesen: Number(z.zugewiesen),
  };
}

router.get("/admin/vermerke/zahlen", async (_req, res) => {
  try {
    res.json({ ok: true, ...(await vermerkZahlen()) });
  } catch (err) {
    console.error("[FIAON-VERMERK] zahlen:", err);
    res.status(500).json({ ok: false, error: "Serverfehler" });
  }
});

/** Anlegen. */
router.post("/admin/vermerke", async (req: Request, res: Response) => {
  try {
    await ensureVermerkTabelle();
    const b = req.body || {};
    const inhalt = text(b.text);
    if (inhalt.length < 2) return res.status(400).json({ ok: false, error: "Bitte einen Text eingeben." });

    const art: VermerkArt = b.art === "aufgabe" ? "aufgabe" : "notiz";
    const frist = pruefeFrist(b.faelligAm);
    if (frist.fehler) return res.status(400).json({ ok: false, error: frist.fehler });

    const sicht: VermerkSicht = b.sicht === "team" ? "team" : b.sicht === "auswahl" ? "auswahl" : "privat";
    let agenten = sicht === "auswahl" ? agentenListe(b.sichtAgenten) : [];
    const zustaendig = Number(b.zustaendigAgentId) || null;
    // Eine Aufgabe für einen Agenten MUSS für ihn sichtbar sein. Ohne diese
    // Zeile könnte man jemandem eine Aufgabe geben, die er nie zu sehen bekommt.
    if (art === "aufgabe" && zustaendig && sicht === "auswahl" && !agenten.includes(zustaendig)) {
      agenten = [...agenten, zustaendig];
    }
    if (sicht === "auswahl" && agenten.length === 0) {
      return res.status(400).json({ ok: false, error: "Bitte mindestens eine Person auswählen." });
    }
    // Zuständigkeit: entweder ein Agent oder der Vorgesetzte selbst. Eine Aufgabe
    // ohne Zuständigen erledigt niemand.
    const fuerBetreiber = art === "aufgabe" && !zustaendig;

    const [row] = await sqlPool`
      INSERT INTO fiaon_vermerke
        (art, ref, lead_id, text, sicht, sicht_agenten, zustaendig_agent_id, fuer_betreiber,
         faellig_am, dringend, autor_art, autor_name)
      VALUES (${art}, ${text(b.ref, 120) || null}, ${Number(b.leadId) || null}, ${inhalt},
              ${sicht}, ${agenten}, ${zustaendig}, ${fuerBetreiber},
              ${frist.datum}, ${b.dringend === true}, 'admin', 'Verwaltung')
      RETURNING id
    `;

    // Zugewiesene Aufgabe: Der Agent erfährt davon. Eine Aufgabe, die erst beim
    // nächsten Portal-Besuch auffällt, ist bei einer Frist von morgen wertlos.
    if (art === "aufgabe" && zustaendig) {
      const [ag] = await sqlPool`SELECT name, first_name, email FROM fiaon_agents WHERE id = ${zustaendig}`;
      let kunde: string | null = null;
      if (b.ref) {
        const [k] = await sqlPool.unsafe(
          `SELECT ${NAME_SQL} AS n FROM fiaon_applications a WHERE a.ref = $1`, [text(b.ref, 120)],
        );
        kunde = k?.n || null;
      }
      if (ag?.email) {
        sendMakeWebhook("aufgabe_zugewiesen", {
          email: ag.email,
          vorname: ag.first_name || ag.name,
          aufgabe: inhalt,
          kunde,
          faellig_am: frist.datum,
          faellig_am_text: frist.datum
            ? new Date(`${frist.datum}T12:00:00Z`).toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric" })
            : null,
          dringend: b.dringend === true,
          portal_url: absoluteUrl("/agent/aufgaben"),
        }).catch(() => {});
      }
      await sqlPool`
        INSERT INTO fiaon_agent_events (agent_id, type, meta)
        VALUES (${zustaendig}, 'aufgabe_zugewiesen', ${JSON.stringify({ vermerk_id: row.id, ref: b.ref || null, faellig_am: frist.datum })})
      `.catch(() => {});
    }

    // Im Kundenverlauf sichtbar machen — die Akte soll die Wahrheit zeigen.
    if (b.ref) {
      await sqlPool`
        INSERT INTO fiaon_contact_log (ref, agent_id, agent_name, type, note)
        VALUES (${text(b.ref, 120)}, NULL, 'Verwaltung', 'system',
                ${`${art === "aufgabe" ? "Aufgabe" : "Notiz"} angelegt: ${inhalt.slice(0, 200)}`})
      `.catch(() => {});
    }

    res.json({ ok: true, id: Number(row.id) });
  } catch (err) {
    console.error("[FIAON-VERMERK] anlegen:", err);
    res.status(500).json({ ok: false, error: "Serverfehler" });
  }
});

/** Ändern: Text, Frist, Dringlichkeit, Sichtbarkeit, Zuständigkeit, Zustand. */
router.patch("/admin/vermerke/:id", async (req: Request, res: Response) => {
  try {
    await ensureVermerkTabelle();
    const id = Number(req.params.id);
    const b = req.body || {};
    const [alt] = await sqlPool`SELECT * FROM fiaon_vermerke WHERE id = ${id} AND entfernt_am IS NULL`;
    if (!alt) return res.status(404).json({ ok: false, error: "Vermerk nicht gefunden" });

    const frist = b.faelligAm !== undefined ? pruefeFrist(b.faelligAm) : { datum: alt.faellig_am, fehler: undefined };
    if (frist.fehler) return res.status(400).json({ ok: false, error: frist.fehler });

    const neuerStatus = b.status === "erledigt" ? "erledigt" : b.status === "offen" ? "offen" : alt.status;
    const sicht = b.sicht === "team" || b.sicht === "auswahl" || b.sicht === "privat" ? b.sicht : alt.sicht;
    const agenten = b.sichtAgenten !== undefined ? agentenListe(b.sichtAgenten) : alt.sicht_agenten;

    await sqlPool`
      UPDATE fiaon_vermerke SET
        text = ${b.text !== undefined ? text(b.text) : alt.text},
        faellig_am = ${frist.datum},
        dringend = ${b.dringend !== undefined ? b.dringend === true : alt.dringend},
        sicht = ${sicht},
        sicht_agenten = ${agenten},
        zustaendig_agent_id = ${b.zustaendigAgentId !== undefined ? (Number(b.zustaendigAgentId) || null) : alt.zustaendig_agent_id},
        fuer_betreiber = ${b.zustaendigAgentId !== undefined ? !Number(b.zustaendigAgentId) : alt.fuer_betreiber},
        status = ${neuerStatus},
        erledigt_am = ${neuerStatus === "erledigt" ? (alt.erledigt_am || new Date()) : null},
        erledigt_von = ${neuerStatus === "erledigt" ? (alt.erledigt_von || "Verwaltung") : null},
        updated_at = NOW()
      WHERE id = ${id}
    `;
    res.json({ ok: true });
  } catch (err) {
    console.error("[FIAON-VERMERK] aendern:", err);
    res.status(500).json({ ok: false, error: "Serverfehler" });
  }
});

/** Zurückziehen (kein echtes Löschen — dieselbe Regel wie überall). */
router.delete("/admin/vermerke/:id", async (req: Request, res: Response) => {
  try {
    await ensureVermerkTabelle();
    await sqlPool`UPDATE fiaon_vermerke SET entfernt_am = NOW(), updated_at = NOW() WHERE id = ${Number(req.params.id)}`;
    res.json({ ok: true });
  } catch (err) {
    console.error("[FIAON-VERMERK] entfernen:", err);
    res.status(500).json({ ok: false, error: "Serverfehler" });
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// AGENT — sieht nur, was für ihn bestimmt ist
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Der Sichtbarkeitsfilter. EINE Stelle, an der entschieden wird, was ein Agent
 * sehen darf — dupliziert man diese Regel, weicht eine Kopie irgendwann ab und
 * ein privater Vermerk landet im Portal.
 */
const AGENT_SICHT = `
  v.entfernt_am IS NULL AND (
    v.zustaendig_agent_id = $1
    OR v.sicht = 'team'
    OR (v.sicht = 'auswahl' AND $1 = ANY(v.sicht_agenten))
  )
`;

router.get("/agent/vermerke", requireAgent, async (req: AgentRequest, res: Response) => {
  try {
    await ensureVermerkTabelle();
    const id = req.agent!.id;
    const ref = text(req.query.ref, 120);
    const rows = await sqlPool.unsafe(`
      SELECT ${AUSWAHL}, ${NAME_SQL} AS kunde_name, ag.name AS zustaendig_name
      FROM fiaon_vermerke v
      LEFT JOIN fiaon_applications a ON a.ref = v.ref
      LEFT JOIN fiaon_agents ag ON ag.id = v.zustaendig_agent_id
      WHERE ${AGENT_SICHT} ${ref ? "AND v.ref = $2" : ""}
      ORDER BY (v.status = 'offen') DESC, v.faellig_am ASC NULLS LAST, v.created_at DESC
      LIMIT 200
    `, ref ? [id, ref] : [id]);
    // Die Akte-Links des Vorgesetzten dürfen nicht ins Agent-Portal gelangen —
    // der Agent hat keinen Zugriff auf /admin.
    res.json({
      ok: true,
      vermerke: rows.map((r: any) => {
        const v = abbilden(r);
        return { ...v, akte: null, meins: v.zustaendigAgentId === id };
      }),
    });
  } catch (err) {
    console.error("[FIAON-VERMERK] agent-liste:", err);
    res.status(500).json({ ok: false, error: "Serverfehler" });
  }
});

/** Zähler für das Agent-Portal (Navigations-Badge). */
router.get("/agent/vermerke/zahlen", requireAgent, async (req: AgentRequest, res: Response) => {
  try {
    await ensureVermerkTabelle();
    const id = req.agent!.id;
    const heute = berlinToday();
    const [z] = await sqlPool`
      SELECT
        COUNT(*) FILTER (WHERE art = 'aufgabe' AND status = 'offen' AND zustaendig_agent_id = ${id})::int AS offen,
        COUNT(*) FILTER (WHERE art = 'aufgabe' AND status = 'offen' AND zustaendig_agent_id = ${id} AND faellig_am < ${heute}::date)::int AS ueberfaellig,
        COUNT(*) FILTER (WHERE art = 'aufgabe' AND status = 'offen' AND zustaendig_agent_id = ${id} AND faellig_am = ${heute}::date)::int AS heute
      FROM fiaon_vermerke WHERE entfernt_am IS NULL
    `;
    // Aufträge der Leitung (E-028) zählen mit — sie liegen auf derselben Seite.
    // E-029 (24.08.2026): VORHER kam hier nur EINE Zahl, und die zählte auch die
    // Aufträge mit, die auf Justins Antwort warten — eine Marke für Arbeit, die
    // der Mitarbeiter gar nicht tun kann. NACHHER liefert agentAuftraegeLage die
    // ehrliche Aufteilung: „auftraege" ist nur, was wirklich bei ihm liegt;
    // „auftraegeWartet" und „auftraegeNeu" sind Anzeige, keine Marke.
    const lage = await (await import("./fiaon-betreiber-todo"))
      .agentAuftraegeLage(id).catch(() => ({ offen: 0, wartet: 0, neu: 0, frageAnMich: 0 }));
    res.json({
      ok: true, offen: Number(z.offen), ueberfaellig: Number(z.ueberfaellig), heute: Number(z.heute),
      auftraege: lage.offen, auftraegeWartet: lage.wartet, auftraegeNeu: lage.neu, auftraegeFrageAnMich: lage.frageAnMich,
    });
  } catch (err) {
    console.error("[FIAON-VERMERK] agent-zahlen:", err);
    res.status(500).json({ ok: false, error: "Serverfehler" });
  }
});

/** Erledigen / wieder öffnen — nur die EIGENE Aufgabe. */
router.post("/agent/vermerke/:id/status", requireAgent, async (req: AgentRequest, res: Response) => {
  try {
    await ensureVermerkTabelle();
    const id = Number(req.params.id);
    const agent = req.agent!;
    const erledigt = req.body?.status !== "offen";
    const rows = await sqlPool`
      UPDATE fiaon_vermerke SET
        status = ${erledigt ? "erledigt" : "offen"},
        erledigt_am = ${erledigt ? new Date() : null},
        erledigt_von = ${erledigt ? agent.name : null},
        updated_at = NOW()
      WHERE id = ${id} AND art = 'aufgabe' AND zustaendig_agent_id = ${agent.id} AND entfernt_am IS NULL
      RETURNING id, ref, text
    `;
    // 404 statt 403: Eine fremde Aufgabe soll nicht einmal ihre Existenz
    // bestätigen — dieselbe Regel wie bei fremden Kundenakten.
    if (rows.length === 0) return res.status(404).json({ ok: false, error: "Aufgabe nicht gefunden" });

    if (rows[0].ref) {
      await sqlPool`
        INSERT INTO fiaon_contact_log (ref, agent_id, agent_name, type, note)
        VALUES (${rows[0].ref}, ${agent.id}, ${agent.name}, 'system',
                ${`Aufgabe ${erledigt ? "erledigt" : "wieder geöffnet"}: ${String(rows[0].text).slice(0, 200)}`})
      `.catch(() => {});
    }
    res.json({ ok: true });
  } catch (err) {
    console.error("[FIAON-VERMERK] agent-status:", err);
    res.status(500).json({ ok: false, error: "Serverfehler" });
  }
});

export default router;
