// ═══════════════════════════════════════════════════════════════════════════
// LAGEZIMMER — AUFGABEN, AMPEL, KARTEN, HAUSPUTZ (E-397, 19.10.2026)
//
// Justin am 19.10.2026: „Jeder hat dutzende, hunderte Aufgaben, aber niemand
// kann diese erledigen, weiß nicht wie, sie sind veraltet oder bereits erledigt."
// Keine neue Chefbüro-Seite (Gedächtnis: keine-neuen-chef-seiten) — das hier ist
// EINE Kachel im Lagezimmer (ChefLagezimmer.tsx, AufgabenLage):
//   · Ampel: System-Alarme (fiaon_system_alarme, eine Zeile je Alarm) und
//     Termintreue (fiaon_termin_treue) — statt 377 Meldungen als Aufträge.
//   · „Heute N Entscheidungen, etwa M Minuten“ — Maras Karten, gebündelt.
//   · „heikel neu“ mit Link auf den Filter „heikel“ in Meine Liste — statt Kopien.
//   · Woche für Woche: neu gegen erledigt (Mensch, System, Hausputz getrennt) —
//     das Ziel „jede Woche mindestens so viel erledigt wie neu“ wird messbar.
//   · Hausputz: Probelauf je Regel, Lauf (nur mit Freigabe), Zurückholen 30 Tage.
// Läufe: Karten sammeln (30 min), Probelauf (täglich), Hausputz (nur mit Freigabe).
// ═══════════════════════════════════════════════════════════════════════════
import { Router, type Response } from "express";
import { sqlPool } from "../lib/db-pool";
import { requireChef, chefProtokoll, type ChefRequest } from "./fiaon-chef-zugang";
import { tageslauf } from "../lib/fiaon-crons";
import { auftragDringend, HEIKLE_ARTEN } from "../../shared/fiaon-auftrag-arten";

const router = Router();

/** Termintreue: ab so vielen verpassten Terminen in 30 Tagen gelb bzw. rot (E-044: 3 = Warnung, 5 = Abmahnung prüfen). */
const TREUE_GELB = 3;
const TREUE_ROT = 5;

/** Montag der Berliner Woche als YYYY-MM-DD (SQL-Ausdruck für eine Zeitspalte). */
const WOCHE = (spalte: string) => `to_char(date_trunc('week', ${spalte} AT TIME ZONE 'Europe/Berlin'), 'YYYY-MM-DD')`;

async function termintreue(): Promise<{ verpasst7: number; verspaetet7: number; jeMitarbeiter: { agentId: number; name: string; verpasst7: number; verspaetet7: number; verpasst30: number; stufe: "gruen" | "gelb" | "rot" }[] }> {
  const rows = (await sqlPool`
    SELECT ag.id, ag.name,
           COUNT(*) FILTER (WHERE x.status = 'verpasst' AND x.beginn > NOW() - INTERVAL '7 days')::int AS verpasst7,
           COUNT(*) FILTER (WHERE x.status = 'verspaetet' AND x.beginn > NOW() - INTERVAL '7 days')::int AS verspaetet7,
           COUNT(*) FILTER (WHERE x.status = 'verpasst' AND x.beginn > NOW() - INTERVAL '30 days')::int AS verpasst30
      FROM fiaon_termin_treue x JOIN fiaon_agents ag ON ag.id = x.agent_id
     WHERE x.beginn > NOW() - INTERVAL '30 days' AND COALESCE(ag.active, TRUE) AND ag.zugang_gesperrt_am IS NULL
       AND NOT COALESCE(ag.is_test_account, FALSE)
     GROUP BY ag.id, ag.name
    HAVING COUNT(*) FILTER (WHERE x.status <> 'puenktlich') > 0
     ORDER BY 5 DESC, 3 DESC`.catch(() => [])) as any[];
  const je = rows.map((r) => {
    const v30 = Number(r.verpasst30), v7 = Number(r.verpasst7);
    return { agentId: Number(r.id), name: String(r.name), verpasst7: v7, verspaetet7: Number(r.verspaetet7), verpasst30: v30,
      stufe: (v30 >= TREUE_ROT ? "rot" : v30 >= TREUE_GELB || v7 > 0 ? "gelb" : "gruen") as "gruen" | "gelb" | "rot" };
  });
  return { verpasst7: je.reduce((n, x) => n + x.verpasst7, 0), verspaetet7: je.reduce((n, x) => n + x.verspaetet7, 0), jeMitarbeiter: je };
}

/** Neu gegen erledigt je Woche (Aufträge + „Zu tun“), erledigt getrennt nach Mensch, System (Ereignis) und Hausputz. */
async function wochen(): Promise<{ ab: string; neu: number; mensch: number; system: number; hausputz: number }[]> {
  const rows = (await sqlPool.unsafe(`
    WITH ereignisse AS (
      SELECT ${WOCHE("created_at")} AS woche, 1 AS neu, 0 AS mensch, 0 AS system, 0 AS hausputz FROM fiaon_betreiber_todos WHERE created_at > NOW() - INTERVAL '35 days'
      UNION ALL
      SELECT ${WOCHE("erledigt_am")}, 0, (COALESCE(erledigt_art, 'hand') IN ('hand', 'verwaltung'))::int, (erledigt_art = 'auto')::int, (erledigt_art = 'hausputz')::int
        FROM fiaon_betreiber_todos WHERE status = 'erledigt' AND erledigt_am > NOW() - INTERVAL '35 days'
      UNION ALL
      SELECT ${WOCHE("created_at")}, 1, 0, 0, 0 FROM fiaon_vermerke WHERE art = 'aufgabe' AND created_at > NOW() - INTERVAL '35 days'
      UNION ALL
      SELECT ${WOCHE("erledigt_am")}, 0, (erledigt_art IS NULL OR erledigt_art = 'hand')::int, (erledigt_art = 'auto')::int, (erledigt_art = 'hausputz')::int
        FROM fiaon_vermerke WHERE art = 'aufgabe' AND status = 'erledigt' AND erledigt_am > NOW() - INTERVAL '35 days'
    )
    SELECT woche, SUM(neu)::int AS neu, SUM(mensch)::int AS mensch, SUM(system)::int AS system, SUM(hausputz)::int AS hausputz
      FROM ereignisse GROUP BY woche ORDER BY woche DESC LIMIT 5`).catch(() => [])) as any[];
  return rows.map((r) => ({ ab: String(r.woche), neu: Number(r.neu), mensch: Number(r.mensch), system: Number(r.system), hausputz: Number(r.hausputz) }));
}

/** Was offen ist — Aufträge und „Zu tun“, mit Anteil jung (< 7 Tage) und Anteil dringend (ehrliche Priorität). */
async function offenStand(): Promise<{ gesamt: number; auftraege: number; vermerke: number; beiJustin: number; jungProzent: number; dringendProzent: number; heikelNeu24h: number; heikelOffen: number }> {
  const t = (await sqlPool`
    SELECT art, quelle, prioritaet, zustaendig_art, COALESCE(eingang_am, created_at) AS eing, created_at
      FROM fiaon_betreiber_todos WHERE status <> 'erledigt'`) as any[];
  const [v] = (await sqlPool`
    SELECT COUNT(*)::int AS n, COUNT(*) FILTER (WHERE fuer_betreiber OR zustaendig_agent_id IS NULL)::int AS justin,
           COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '7 days')::int AS jung
      FROM fiaon_vermerke WHERE art = 'aufgabe' AND status = 'offen' AND entfernt_am IS NULL`) as any[];
  const jetzt = Date.now();
  const jungA = t.filter((x) => jetzt - new Date(x.eing).getTime() < 7 * 864e5).length;
  const dringend = t.filter((x) => auftragDringend({ art: x.art, quelle: x.quelle, prioritaet: Number(x.prioritaet) })).length;
  const heikel = t.filter((x) => HEIKLE_ARTEN.includes(x.art));
  const gesamt = t.length + Number(v?.n || 0);
  return {
    gesamt, auftraege: t.length, vermerke: Number(v?.n || 0),
    beiJustin: t.filter((x) => x.zustaendig_art !== "agent").length + Number(v?.justin || 0),
    jungProzent: gesamt ? Math.round(((jungA + Number(v?.jung || 0)) / gesamt) * 1000) / 10 : 0,
    dringendProzent: t.length ? Math.round((dringend / t.length) * 1000) / 10 : 0,
    heikelNeu24h: heikel.filter((x) => jetzt - new Date(x.created_at).getTime() < 864e5).length,
    heikelOffen: heikel.length,
  };
}

router.get("/chef/aufgaben-lage", requireChef("leitung"), async (_req: ChefRequest, res: Response) => {
  try {
    const { alarmTafel } = await import("../lib/fiaon-system-alarme");
    const { tagesLastLesen } = await import("../lib/fiaon-mara-entscheidungen");
    const { hausputzStand } = await import("../lib/fiaon-hausputz");
    const [alarme, treue, karten, woche, offen, hausputz] = await Promise.all([
      alarmTafel(24).catch(() => []), termintreue(), tagesLastLesen().catch(() => null), wochen(), offenStand(), hausputzStand().catch(() => null),
    ]);
    const aktiv = alarme.filter((a) => !a.vorbeiAm);
    const farbe = aktiv.some((a) => a.stufe === "rot") || treue.jeMitarbeiter.some((m) => m.stufe === "rot") ? "rot"
      : aktiv.length || treue.jeMitarbeiter.some((m) => m.stufe === "gelb") ? "gelb" : "gruen";
    res.setHeader("Cache-Control", "no-store");
    res.json({ ok: true, stand: new Date().toISOString(), ampel: { farbe, alarme, termintreue: treue }, karten, offen, woche, hausputz });
  } catch (err) {
    console.error("[AUFGABEN-LAGE]", err);
    res.status(500).json({ ok: false, error: "Die Aufgaben-Lage ließ sich nicht laden." });
  }
});

/** Probelauf jetzt (nur zählen). */
router.post("/chef/hausputz/probelauf", requireChef("inhaber"), async (req: ChefRequest, res: Response) => {
  try {
    const { hausputzProbelauf } = await import("../lib/fiaon-hausputz");
    const zahlen = await hausputzProbelauf();
    void chefProtokoll(req, "hausputz:probelauf", `${zahlen.vorher.gesamt} → ${zahlen.nachher.gesamt}`);
    res.json({ ok: true, zahlen });
  } catch (err) {
    console.error("[HAUSPUTZ] Probelauf:", err);
    res.status(500).json({ ok: false, error: "Der Probelauf ist abgebrochen." });
  }
});

/** Zurückholen — eine Regel eines Laufs (oder alles), 30 Tage lang. */
router.post("/chef/hausputz/zurueck", requireChef("inhaber"), async (req: ChefRequest, res: Response) => {
  try {
    const laufId = Number(req.body?.laufId);
    if (!Number.isInteger(laufId) || laufId <= 0) return res.status(400).json({ ok: false, error: "Welcher Lauf?" });
    const regel = req.body?.regel ? String(req.body.regel).slice(0, 40) : null;
    const { hausputzZurueckholen } = await import("../lib/fiaon-hausputz");
    const von = req.chef?.agentId ? String(((await sqlPool`SELECT name FROM fiaon_agents WHERE id = ${req.chef.agentId}`) as any[])[0]?.name || "Chefbüro") : "Chefbüro";
    const erg = await hausputzZurueckholen({ laufId, regel }, von);
    void chefProtokoll(req, `hausputz:zurueck:${laufId}`, `${regel ?? "alle Regeln"}: ${erg.zurueck}`);
    res.json({ ok: true, ...erg });
  } catch (err) {
    console.error("[HAUSPUTZ] Zurückholen:", err);
    res.status(500).json({ ok: false, error: "Das Zurückholen ist abgebrochen." });
  }
});

// ── DIE LÄUFE (nur im Betrieb, CRONS_AN) ─────────────────────────────────────
// Maras Karten: alle 30 Minuten sammeln — die Zahl „Heute N Entscheidungen“ stimmt, auch wenn niemand den Reiter öffnet.
tageslauf("entscheidungen-sammeln", async () => {
  const { entscheidungenSammelnWennFaellig } = await import("../lib/fiaon-mara-entscheidungen");
  const l = entscheidungenSammelnWennFaellig();
  if (l) await l;
}, 30 * 60_000, { beimStartNach: 3 * 60_000 });

// Der Probelauf: täglich (und kurz nach jedem Start) — zählt je Regel, ändert nichts.
tageslauf("hausputz-probelauf", async () => {
  const { hausputzProbelauf } = await import("../lib/fiaon-hausputz");
  await hausputzProbelauf();
}, 60 * 60_000, { beimStartNach: 4 * 60_000, alleXStunden: 20 });

// Der Hausputz: NUR mit Freigabe (HAUSPUTZ_FREIGABE, nach Justins „go“), genau einmal je Freigabe.
tageslauf("hausputz-lauf", async () => {
  const { hausputzAusfuehren, HAUSPUTZ_FREIGABE } = await import("../lib/fiaon-hausputz");
  if (!HAUSPUTZ_FREIGABE) return;
  await hausputzAusfuehren(HAUSPUTZ_FREIGABE);
}, 30 * 60_000, { beimStartNach: 6 * 60_000 });

export default router;
