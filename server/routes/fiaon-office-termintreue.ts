// ═══════════════════════════════════════════════════════════════════════════
// FIAON OFFICE — TERMINTREUE (23.08.2026)
//
// Plan: 01_Plattform/MITARBEITER_OFFICE_PLAN_2026-08-23.md §16 (E-044).
//
// EINE WAHRHEIT, SERVERSEITIG
// Ob ein Termin pünktlich angerufen wurde, entscheidet nicht der Mitarbeiter
// und nicht der Browser, sondern der Abgleich zweier Zeitstempel, die beide
// schon existieren: `fiaon_termine.beginn` (wann das Gespräch beginnen sollte)
// und `fiaon_calls.beginn` (wann tatsächlich gewählt wurde).
//
//   Anrufstart ≤ Beginn + 2 Min   → puenktlich
//   Anrufstart ≤ Beginn + 15 Min  → verspaetet   (wird der Leitung gemeldet)
//   kein Anruf bis Beginn +15 Min → verpasst     (wird der Leitung gemeldet)
//
// Gezählt werden auch Anrufe bis 10 Minuten VOR dem Beginn — wer früher wählt,
// ist nicht unpünktlich.
//
// ESKALATION (Zähler je Mitarbeiter, verpasste gesamt):
//   bei 3 → Warnung an die Leitung + Vermerk (Aufgabe) an den Mitarbeiter
//   bei 5 → Betreiber-Todo Priorität 1 „Abmahnung/Trennung prüfen (E-044)"
// KEINE automatische Deaktivierung — die Entscheidung bleibt beim Menschen.
//
// Läufe: `tageslauf("termintreue-bewerten", …, 10 Minuten)`. Bewertet werden
// Termine mit status='gebucht', deren Beginn zwischen 20 Minuten und 24 Stunden
// zurückliegt und die noch keine Bewertungszeile haben. Abgesagte Termine
// (status='abgesagt', `abgesagt_am`) fallen durch den Status-Filter heraus.
//
// Routen:
//   GET /agent/termintreue → { puenktlich, verspaetet, verpasst, letzte[] }
//                            der letzten 30 Tage (Karte auf dem Dashboard)
// ═══════════════════════════════════════════════════════════════════════════
import { Router, type Response } from "express";
import { sqlPool } from "../lib/db-pool";
import { requireAgent, type AgentRequest } from "./fiaon-agent";
import { tageslauf } from "../lib/fiaon-crons";
import { berlinDatumText, berlinUhrzeit } from "../lib/fiaon-termine";

const router = Router();

/** Bis wie viele Sekunden nach Beginn gilt ein Anruf als pünktlich? */
const PUENKTLICH_SEK = 2 * 60;
/** Bis wie viele Sekunden nach Beginn gilt er als verspätet (danach: verpasst)? */
const VERSPAETET_SEK = 15 * 60;
/** Wie viele Minuten VOR dem Beginn zählt ein Anruf schon zum Termin? */
const VORLAUF_MIN = 10;

let geprueft = false;
export async function ensureTreueTabelle(): Promise<void> {
  if (geprueft) return;
  await sqlPool`
    CREATE TABLE IF NOT EXISTS fiaon_termin_treue (
      termin_id INTEGER PRIMARY KEY,
      agent_id INTEGER NOT NULL,
      person_id INTEGER NOT NULL,
      beginn TIMESTAMPTZ NOT NULL,
      anruf_id INTEGER,
      delta_sek INTEGER,
      status VARCHAR NOT NULL CHECK (status IN ('puenktlich', 'verspaetet', 'verpasst')),
      bewertet_am TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`;
  await sqlPool`CREATE INDEX IF NOT EXISTS fiaon_termin_treue_agent_idx
    ON fiaon_termin_treue (agent_id, status, beginn)`;
  geprueft = true;
}

/**
 * Der Prüf-Lauf: bewertet alle fälligen Termine und meldet Verstöße.
 *
 * Frühestens 20 Minuten nach Beginn — vorher ist das 15-Minuten-Fenster noch
 * nicht sicher zu Ende (der Anruf könnte gerade erst in der Datenbank landen).
 * Spätestens 24 Stunden danach — ältere Termine ohne Zeile stammen aus der
 * Zeit vor diesem System und werden nicht rückwirkend bestraft.
 */
export async function termintreueBewerten(): Promise<void> {
  await ensureTreueTabelle();
  const termine = (await sqlPool`
    SELECT t.id, t.agent_id, t.person_id, t.beginn,
           COALESCE(a.name, 'Unbekannt') AS mitarbeiter,
           COALESCE(NULLIF(TRIM(CONCAT_WS(' ', p.first_name, p.last_name)), ''),
                    p.company_name, p.contact_name, 'Ohne Namen') AS kunde
    FROM fiaon_termine t
    JOIN fiaon_persons p ON p.id = t.person_id
    LEFT JOIN fiaon_agents a ON a.id = t.agent_id
    WHERE t.status = 'gebucht'
      AND t.abgesagt_am IS NULL
      AND t.agent_id IS NOT NULL
      AND t.beginn BETWEEN NOW() - INTERVAL '24 hours' AND NOW() - INTERVAL '20 minutes'
      AND p.merged_into_person_id IS NULL
      AND NOT EXISTS (SELECT 1 FROM fiaon_termin_treue x WHERE x.termin_id = t.id)
    ORDER BY t.beginn ASC
    LIMIT 200
  `) as any[];
  if (termine.length === 0) return;

  const { ensureTodoTabelle } = await import("./fiaon-betreiber-todo");
  await ensureTodoTabelle();
  const { ensureVermerkTabelle } = await import("./fiaon-vermerke");
  await ensureVermerkTabelle();

  for (const t of termine) {
    // Der ERSTE Anruf desselben Mitarbeiters an diese Person im Fenster
    // Beginn−10 Min bis Beginn+15 Min. Der erste, nicht der letzte: Es zählt,
    // wann er sich gemeldet hat, nicht wann er zuletzt aufgelegt hat.
    const [anruf] = (await sqlPool`
      SELECT id, beginn FROM fiaon_calls
      WHERE agent_id = ${t.agent_id} AND person_id = ${t.person_id}
        AND beginn BETWEEN ${t.beginn}::timestamptz - (${VORLAUF_MIN} || ' minutes')::interval
                       AND ${t.beginn}::timestamptz + (${VERSPAETET_SEK} || ' seconds')::interval
      ORDER BY beginn ASC
      LIMIT 1
    `) as any[];

    const deltaSek = anruf
      ? Math.round((new Date(anruf.beginn).getTime() - new Date(t.beginn).getTime()) / 1000)
      : null;
    const status = anruf
      ? (deltaSek! <= PUENKTLICH_SEK ? "puenktlich" : "verspaetet")
      : "verpasst";

    // ON CONFLICT DO NOTHING + RETURNING: Läuft der Lauf doppelt (zwei
    // Prozesse), gewinnt genau einer — nur der meldet auch.
    const eingefuegt = (await sqlPool`
      INSERT INTO fiaon_termin_treue (termin_id, agent_id, person_id, beginn, anruf_id, delta_sek, status)
      VALUES (${t.id}, ${t.agent_id}, ${t.person_id}, ${t.beginn}, ${anruf?.id ?? null}, ${deltaSek}, ${status})
      ON CONFLICT (termin_id) DO NOTHING
      RETURNING termin_id
    `) as any[];
    if (eingefuegt.length === 0 || status === "puenktlich") continue;

    // ── DIE MELDUNG AN DIE LEITUNG ────────────────────────────────────────
    const wannText = `${berlinDatumText(t.beginn)} um ${berlinUhrzeit(t.beginn)} Uhr`;
    const verzug = status === "verpasst"
      ? "kein Anruf bis 15 Minuten nach Beginn"
      : `Anruf ${Math.round(deltaSek! / 60)} Minuten nach Beginn`;
    const titel = status === "verpasst"
      ? `Termin verpasst: ${t.mitarbeiter} – ${t.kunde} (${wannText})`
      : `Termin verspätet: ${t.mitarbeiter} – ${t.kunde} (${wannText})`;
    const body = [
      `Termintreue-Prüfung (E-044):`,
      `Mitarbeiter: ${t.mitarbeiter}`,
      `Kunde: ${t.kunde}`,
      `Termin: ${wannText}`,
      `Verzug: ${verzug}`,
    ].join("\n");
    await sqlPool`
      INSERT INTO fiaon_betreiber_todos (schluessel, titel, text, bereich, prioritaet, faellig_am, quelle, letzte_aktivitaet)
      VALUES (${`termintreue-termin-${t.id}`}, ${titel}, ${body}, 'termintreue',
              ${status === "verpasst" ? 1 : 2}, CURRENT_DATE, 'termintreue', NOW())
      ON CONFLICT (schluessel) DO NOTHING
    `.catch((e) => console.error("[TERMINTREUE] Meldung nicht geschrieben:", e));

    if (status !== "verpasst") continue;

    // ── DER ZÄHLER (verpasste gesamt, je Mitarbeiter) ─────────────────────
    const [z] = (await sqlPool`
      SELECT COUNT(*)::int AS n FROM fiaon_termin_treue
      WHERE agent_id = ${t.agent_id} AND status = 'verpasst'
    `) as any[];
    const n = Number(z?.n || 0);

    if (n === 3) {
      await sqlPool`
        INSERT INTO fiaon_betreiber_todos (schluessel, titel, text, bereich, prioritaet, faellig_am, quelle, letzte_aktivitaet)
        VALUES (${`termintreue-warnung3-${t.agent_id}`},
                ${`Warnung an Mitarbeiter: ${t.mitarbeiter} hat 3 Termine verpasst`},
                ${`${t.mitarbeiter} hat den dritten Termin verpasst (zuletzt: ${t.kunde}, ${wannText}). Der Mitarbeiter hat einen Vermerk erhalten. Ab 5 verpassten Terminen folgt die Eskalation (E-044).`},
                'termintreue', 2, CURRENT_DATE, 'termintreue', NOW())
        ON CONFLICT (schluessel) DO NOTHING
      `.catch((e) => console.error("[TERMINTREUE] Warnung nicht geschrieben:", e));
      // Der Vermerk an den Mitarbeiter selbst — als Aufgabe, die er sieht
      // (zugewiesene Aufgaben sind immer sichtbar, fiaon-vermerke.ts).
      await sqlPool`
        INSERT INTO fiaon_vermerke (art, text, sicht, sicht_agenten, zustaendig_agent_id,
                                    fuer_betreiber, dringend, status, autor_art, autor_name, faellig_am)
        VALUES ('aufgabe',
                ${`Warnung Termintreue: Du hast 3 Termine verpasst (kein Anruf bis 15 Minuten nach Beginn). Verpasste Termine werden der Leitung gemeldet – ab 5 endet die Zusammenarbeit. Bitte nimm deine Termine wahr oder sage sie rechtzeitig ab.`},
                'auswahl', ARRAY[${t.agent_id}]::int[], ${t.agent_id},
                FALSE, TRUE, 'offen', 'admin', 'System', CURRENT_DATE)
      `.catch((e) => console.error("[TERMINTREUE] Vermerk nicht geschrieben:", e));
    }

    if (n === 5) {
      await sqlPool`
        INSERT INTO fiaon_betreiber_todos (schluessel, titel, text, bereich, prioritaet, faellig_am, quelle, letzte_aktivitaet)
        VALUES (${`termintreue-eskalation5-${t.agent_id}`},
                ${`5 verpasste Termine – Abmahnung/Trennung prüfen (E-044): ${t.mitarbeiter}`},
                ${`${t.mitarbeiter} hat den fünften Termin verpasst (zuletzt: ${t.kunde}, ${wannText}). Laut E-044: Abmahnung bzw. Trennung prüfen. Keine automatische Deaktivierung – die Entscheidung liegt bei der Leitung.`},
                'termintreue', 1, CURRENT_DATE, 'termintreue', NOW())
        ON CONFLICT (schluessel) DO NOTHING
      `.catch((e) => console.error("[TERMINTREUE] Eskalation nicht geschrieben:", e));
    }
  }
}

// Alle 10 Minuten. Kein `alleXStunden`: Der Lauf grenzt seine Arbeit selbst
// über das Zeitfenster und die vorhandenen Bewertungszeilen ein.
tageslauf("termintreue-bewerten", () => {
  void termintreueBewerten().catch((e) => console.error("[TERMINTREUE] Lauf:", e));
}, 10 * 60_000, { beimStartNach: 90_000 });

/** GET /agent/termintreue — die eigene Bilanz der letzten 30 Tage. */
router.get("/agent/termintreue", requireAgent, async (req: AgentRequest, res: Response) => {
  try {
    await ensureTreueTabelle();
    const id = req.agent!.id;
    const [z] = (await sqlPool`
      SELECT COUNT(*) FILTER (WHERE status = 'puenktlich')::int AS puenktlich,
             COUNT(*) FILTER (WHERE status = 'verspaetet')::int AS verspaetet,
             COUNT(*) FILTER (WHERE status = 'verpasst')::int AS verpasst
      FROM fiaon_termin_treue
      WHERE agent_id = ${id} AND beginn > NOW() - INTERVAL '30 days'
    `) as any[];
    const letzte = (await sqlPool`
      SELECT x.termin_id, x.beginn, x.status, x.delta_sek,
             COALESCE(NULLIF(TRIM(CONCAT_WS(' ', p.first_name, p.last_name)), ''),
                      p.company_name, p.contact_name, 'Ohne Namen') AS kunde
      FROM fiaon_termin_treue x
      JOIN fiaon_persons p ON p.id = x.person_id
      WHERE x.agent_id = ${id} AND x.beginn > NOW() - INTERVAL '30 days'
      ORDER BY x.beginn DESC
      LIMIT 10
    `) as any[];
    res.json({
      ok: true,
      puenktlich: Number(z?.puenktlich || 0),
      verspaetet: Number(z?.verspaetet || 0),
      verpasst: Number(z?.verpasst || 0),
      letzte: letzte.map((r) => ({
        terminId: Number(r.termin_id),
        beginn: new Date(r.beginn).toISOString(),
        status: String(r.status),
        deltaSek: r.delta_sek == null ? null : Number(r.delta_sek),
        kunde: String(r.kunde),
      })),
    });
  } catch (err) {
    console.error("[TERMINTREUE] agent-bilanz:", err);
    res.status(500).json({ ok: false, error: "Serverfehler" });
  }
});

export default router;
