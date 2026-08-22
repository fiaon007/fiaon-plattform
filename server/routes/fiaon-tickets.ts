// ═══════════════════════════════════════════════════════════════════════════
// ANLIEGEN (Tickets) — Hilfe im Kundenbereich als internes System (22.08.2026)
//
// Justin: „Wenn der Kunde bei Hilfe was schreibt, könnten wir ein internes
// Ticketsystem machen — besser als nur eine E-Mail." Ja. Ein Anliegen ist ein
// Datensatz mit Zustand, nicht eine Mail, die in einem Postfach versinkt.
//
// Der Kunde legt ein Anliegen an und sieht seine Anliegen samt Antworten. Die
// Antwort des Mitarbeiters steht beim Anliegen UND im Verlauf der Akte
// (fiaon_contact_log), damit der nächste Kollege sie findet. Zuständig ist der
// Betreuer der Person; ohne Betreuer landet es im Pool (agent_id NULL).
// ═══════════════════════════════════════════════════════════════════════════
import { Router, type Response } from "express";
import { sqlPool } from "../lib/db-pool";
import { requireKunde, type KundeRequest } from "../lib/fiaon-kunde-session";
import { requireAgent, type AgentRequest } from "./fiaon-agent";

const router = Router();
let bereit = false;
async function tabelle() {
  if (bereit) return;
  await sqlPool`
    CREATE TABLE IF NOT EXISTS fiaon_tickets (
      id SERIAL PRIMARY KEY,
      ref VARCHAR NOT NULL,
      person_id INTEGER,
      agent_id INTEGER,
      betreff VARCHAR NOT NULL,
      text TEXT NOT NULL,
      status VARCHAR NOT NULL DEFAULT 'offen',
      antwort TEXT,
      beantwortet_am TIMESTAMPTZ,
      beantwortet_von INTEGER,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`;
  await sqlPool`CREATE INDEX IF NOT EXISTS fiaon_tickets_ref_idx ON fiaon_tickets (ref, created_at DESC)`;
  await sqlPool`CREATE INDEX IF NOT EXISTS fiaon_tickets_offen_idx ON fiaon_tickets (status, agent_id)`;
  bereit = true;
}

/** GET /kunde/:ref/tickets — die eigenen Anliegen. */
router.get("/kunde/:ref/tickets", requireKunde, async (req: KundeRequest, res: Response) => {
  try {
    await tabelle();
    const rows = await sqlPool`
      SELECT id, betreff, text, status, antwort, beantwortet_am, created_at
      FROM fiaon_tickets WHERE ref = ${req.kundeRef!} ORDER BY created_at DESC LIMIT 50`;
    res.json({ ok: true, tickets: rows });
  } catch (err) { console.error("[TICKETS] liste:", err); res.status(500).json({ ok: false, error: "Anliegen konnten nicht geladen werden." }); }
});

/** POST /kunde/:ref/tickets — neues Anliegen. */
router.post("/kunde/:ref/tickets", requireKunde, async (req: KundeRequest, res: Response) => {
  try {
    await tabelle();
    const ref = req.kundeRef!;
    const betreff = String(req.body?.betreff || "").trim().slice(0, 160);
    const text = String(req.body?.text || "").trim().slice(0, 4000);
    if (betreff.length < 3 || text.length < 10) return res.status(400).json({ ok: false, error: "Bitte einen Betreff und mindestens einen Satz eingeben." });
    const [a] = (await sqlPool`SELECT a.person_id, p.assigned_agent_id FROM fiaon_applications a LEFT JOIN fiaon_persons p ON p.id = a.person_id WHERE a.ref = ${ref} AND a.merged_into IS NULL LIMIT 1`) as any[];
    const [t] = (await sqlPool`
      INSERT INTO fiaon_tickets (ref, person_id, agent_id, betreff, text)
      VALUES (${ref}, ${a?.person_id ?? null}, ${a?.assigned_agent_id ?? null}, ${betreff}, ${text}) RETURNING id, created_at`) as any[];
    // In die Akte — dort liest der Kollege ohnehin.
    await sqlPool`INSERT INTO fiaon_contact_log (ref, agent_id, agent_name, type, note, created_at)
      VALUES (${ref}, ${a?.assigned_agent_id ?? null}, 'Kunde', 'kunde_anliegen', ${`Anliegen #${t.id}: ${betreff}\n${text}`}, NOW())`.catch(() => {});
    res.json({ ok: true, id: t.id });
  } catch (err) { console.error("[TICKETS] neu:", err); res.status(500).json({ ok: false, error: "Das Anliegen konnte nicht gespeichert werden." }); }
});

/** GET /agent/tickets — offene Anliegen: eigene Kunden zuerst, dann der Pool. */
router.get("/agent/tickets", requireAgent, async (req: AgentRequest, res: Response) => {
  try {
    await tabelle();
    const { rolleVon } = await import("../lib/fiaon-kundenzugriff");
    const rolle = await rolleVon(req.agent!.id);
    const alle = rolle === "admin" || rolle === "vertriebsleiter";
    const rows = await sqlPool`
      SELECT t.id, t.ref, t.betreff, t.text, t.status, t.antwort, t.created_at, t.agent_id,
             TRIM(COALESCE(p.first_name,'') || ' ' || COALESCE(p.last_name,'')) AS kunde
      FROM fiaon_tickets t LEFT JOIN fiaon_persons p ON p.id = t.person_id
      WHERE t.status <> 'erledigt' AND (${alle} OR t.agent_id = ${req.agent!.id} OR t.agent_id IS NULL)
      ORDER BY (t.agent_id = ${req.agent!.id}) DESC, t.created_at ASC LIMIT 200`;
    res.json({ ok: true, tickets: rows });
  } catch (err) { console.error("[TICKETS] agent:", err); res.status(500).json({ ok: false, error: "Serverfehler" }); }
});

/** POST /agent/tickets/:id/antwort — beantworten (und optional erledigen). */
router.post("/agent/tickets/:id/antwort", requireAgent, async (req: AgentRequest, res: Response) => {
  try {
    await tabelle();
    const id = Number(req.params.id); const antwort = String(req.body?.antwort || "").trim().slice(0, 4000);
    const erledigt = req.body?.erledigt === true;
    if (antwort.length < 2) return res.status(400).json({ ok: false, error: "Antwort fehlt." });
    const [t] = (await sqlPool`UPDATE fiaon_tickets SET antwort = ${antwort}, beantwortet_am = NOW(), beantwortet_von = ${req.agent!.id},
      agent_id = COALESCE(agent_id, ${req.agent!.id}), status = ${erledigt ? "erledigt" : "beantwortet"}, updated_at = NOW()
      WHERE id = ${id} RETURNING ref, betreff`) as any[];
    if (!t) return res.status(404).json({ ok: false, error: "Anliegen nicht gefunden." });
    await sqlPool`INSERT INTO fiaon_contact_log (ref, agent_id, agent_name, type, note, created_at)
      VALUES (${t.ref}, ${req.agent!.id}, ${req.agent!.name}, 'kunde_anliegen_antwort', ${`Antwort auf Anliegen #${id} (${t.betreff}):\n${antwort}`}, NOW())`.catch(() => {});
    res.json({ ok: true });
  } catch (err) { console.error("[TICKETS] antwort:", err); res.status(500).json({ ok: false, error: "Serverfehler" }); }
});

export default router;
