// ═══════════════════════════════════════════════════════════════════════════
// FIAON OFFICE — Arbeitszeiten, Präsenz, Provisionssatz (23.08.2026)
//
// Plan: 01_Plattform/MITARBEITER_OFFICE_PLAN_2026-08-23.md §4 (Raum 9), §5.
//   GET  /agent/arbeitszeiten          → { bloecke[], stundenProWoche, vollstaendig }
//   PUT  /agent/arbeitszeiten          { bloecke: [{ wochentag 1..7, von "09:00", bis "13:00" }] } ersetzt alles
//   GET  /agent/provision-satz         → { satz: 0.25 }   (Einstellung provision_satz, Vorgabe 25 %)
//   POST /agent/praesenz               { status: da|pause|telefon|weg } → Flur
//   GET  /agent/flur                   → wer ist da (alle aktiven Mitarbeiter mit letztem Status)
// ═══════════════════════════════════════════════════════════════════════════
import { Router, type Response } from "express";
import { sqlPool } from "../lib/db-pool";
import { requireAgent, getSettings, type AgentRequest } from "./fiaon-agent";

const router = Router();
export const MINDEST_STUNDEN_WOCHE = 15;
let geprueft = false;
async function ensureOfficeTabellen(): Promise<void> {
  if (geprueft) return;
  await sqlPool`
    CREATE TABLE IF NOT EXISTS fiaon_arbeitszeiten (
      id SERIAL PRIMARY KEY,
      agent_id INTEGER NOT NULL,
      wochentag SMALLINT NOT NULL CHECK (wochentag BETWEEN 1 AND 7),
      von TIME NOT NULL,
      bis TIME NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      CHECK (bis > von)
    )`;
  await sqlPool`CREATE INDEX IF NOT EXISTS fiaon_arbeitszeiten_agent_idx ON fiaon_arbeitszeiten (agent_id, wochentag)`;
  await sqlPool`
    CREATE TABLE IF NOT EXISTS fiaon_praesenz (
      agent_id INTEGER PRIMARY KEY,
      status VARCHAR NOT NULL DEFAULT 'weg',
      seit TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      zuletzt TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`;
  geprueft = true;
}

const zeit = (s: unknown): string | null => { const m = String(s || "").match(/^(\d{1,2}):(\d{2})$/); if (!m) return null; const h = Number(m[1]), mi = Number(m[2]); if (h > 23 || mi > 59) return null; return `${String(h).padStart(2, "0")}:${m[2]}`; };
const minuten = (t: string) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5));

export async function arbeitszeitenVon(agentId: number): Promise<{ bloecke: { wochentag: number; von: string; bis: string }[]; stundenProWoche: number; vollstaendig: boolean }> {
  await ensureOfficeTabellen();
  const rows = await sqlPool`SELECT wochentag, to_char(von, 'HH24:MI') AS von, to_char(bis, 'HH24:MI') AS bis FROM fiaon_arbeitszeiten WHERE agent_id = ${agentId} ORDER BY wochentag, von`;
  const bloecke = rows.map((r: any) => ({ wochentag: Number(r.wochentag), von: String(r.von), bis: String(r.bis) }));
  const stunden = bloecke.reduce((s, b) => s + (minuten(b.bis) - minuten(b.von)) / 60, 0);
  return { bloecke, stundenProWoche: Math.round(stunden * 10) / 10, vollstaendig: stunden >= MINDEST_STUNDEN_WOCHE };
}

router.get("/agent/arbeitszeiten", requireAgent, async (req: AgentRequest, res: Response) => {
  try { res.json({ ok: true, ...(await arbeitszeitenVon(req.agent!.id)), mindestStunden: MINDEST_STUNDEN_WOCHE }); }
  catch (err) { console.error("[OFFICE] arbeitszeiten:", err); res.status(500).json({ ok: false, error: "Serverfehler" }); }
});

router.put("/agent/arbeitszeiten", requireAgent, async (req: AgentRequest, res: Response) => {
  try {
    await ensureOfficeTabellen();
    const roh = Array.isArray(req.body?.bloecke) ? req.body.bloecke : [];
    const bloecke: { wochentag: number; von: string; bis: string }[] = [];
    for (const b of roh) {
      const wt = Number(b?.wochentag); const von = zeit(b?.von); const bis = zeit(b?.bis);
      if (!Number.isInteger(wt) || wt < 1 || wt > 7 || !von || !bis || minuten(bis) <= minuten(von)) return res.status(400).json({ ok: false, error: "Ein Zeitblock ist ungültig (Wochentag 1–7, von < bis)." });
      bloecke.push({ wochentag: wt, von, bis });
    }
    // Überschneidungen je Tag zusammenfassen
    bloecke.sort((a, b) => a.wochentag - b.wochentag || minuten(a.von) - minuten(b.von));
    const sauber: typeof bloecke = [];
    for (const b of bloecke) { const l = sauber[sauber.length - 1]; if (l && l.wochentag === b.wochentag && minuten(b.von) <= minuten(l.bis)) { if (minuten(b.bis) > minuten(l.bis)) l.bis = b.bis; } else sauber.push({ ...b }); }
    await sqlPool.begin(async (tx) => {
      await tx`DELETE FROM fiaon_arbeitszeiten WHERE agent_id = ${req.agent!.id}`;
      for (const b of sauber) await tx`INSERT INTO fiaon_arbeitszeiten (agent_id, wochentag, von, bis) VALUES (${req.agent!.id}, ${b.wochentag}, ${b.von}::time, ${b.bis}::time)`;
    });
    res.json({ ok: true, ...(await arbeitszeitenVon(req.agent!.id)), mindestStunden: MINDEST_STUNDEN_WOCHE });
  } catch (err) { console.error("[OFFICE] arbeitszeiten speichern:", err); res.status(500).json({ ok: false, error: "Serverfehler" }); }
});

router.get("/agent/provision-satz", requireAgent, async (_req: AgentRequest, res: Response) => {
  try { const s = await getSettings(); const satz = Number(s.provision_satz); res.json({ ok: true, satz: Number.isFinite(satz) && satz > 0 && satz < 1 ? satz : 0.25 }); }
  catch { res.json({ ok: true, satz: 0.25 }); }
});

const PRAESENZ = new Set(["da", "pause", "telefon", "weg"]);
router.post("/agent/praesenz", requireAgent, async (req: AgentRequest, res: Response) => {
  try {
    await ensureOfficeTabellen();
    const status = String(req.body?.status || ""); if (!PRAESENZ.has(status)) return res.status(400).json({ ok: false, error: "Unbekannter Status" });
    await sqlPool`INSERT INTO fiaon_praesenz (agent_id, status, seit, zuletzt) VALUES (${req.agent!.id}, ${status}, NOW(), NOW())
      ON CONFLICT (agent_id) DO UPDATE SET status = EXCLUDED.status, seit = CASE WHEN fiaon_praesenz.status = EXCLUDED.status THEN fiaon_praesenz.seit ELSE NOW() END, zuletzt = NOW()`;
    res.json({ ok: true });
  } catch (err) { console.error("[OFFICE] praesenz:", err); res.status(500).json({ ok: false, error: "Serverfehler" }); }
});

router.get("/agent/flur", requireAgent, async (_req: AgentRequest, res: Response) => {
  try {
    await ensureOfficeTabellen();
    const rows = await sqlPool`
      SELECT a.id, a.name, a.avatar, a.rolle, COALESCE(p.status, 'weg') AS status, p.seit, p.zuletzt,
             (p.zuletzt IS NOT NULL AND p.zuletzt > NOW() - INTERVAL '20 minutes') AS frisch
      FROM fiaon_agents a LEFT JOIN fiaon_praesenz p ON p.agent_id = a.id
      WHERE COALESCE(a.active, TRUE) = TRUE AND COALESCE(a.is_test_account, FALSE) = FALSE
      ORDER BY (COALESCE(p.status,'weg') = 'da') DESC, a.name`;
    res.json({ ok: true, leute: rows.map((r: any) => ({ id: r.id, name: r.name, avatar: r.avatar, rolle: r.rolle, status: r.frisch ? r.status : "weg", seit: r.seit })) });
  } catch (err) { console.error("[OFFICE] flur:", err); res.status(500).json({ ok: false, error: "Serverfehler" }); }
});

export default router;
