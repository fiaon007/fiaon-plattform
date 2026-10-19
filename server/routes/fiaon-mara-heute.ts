// ═══════════════════════════════════════════════════════════════════════════
// MARA FÜHRT DEN BETRIEB — „MARA HEUTE“, DIE AMPEL, DIE STICHPROBE (E-406 B3, 19.10.2026)
//
// Keine neue Seite (Gedächtnis: keine-neuen-chef-seiten). Drei bestehende Räume bekommen je ein Stück:
//   · Lagezimmer (ChefLagezimmer.tsx → ChefMaraHeute.tsx): GET /chef/mara-heute (Stufe Leitung),
//     POST /chef/mara-heute/rueckgaengig (Stufe Inhaber) — gelbe Handlungen 24 h zurücknehmen.
//   · Mara-Steuerpult (ChefMara.tsx, Chip „Ampel“ → ChefMaraAmpel.tsx): GET/POST /chef/mara/ampel (Stufe Inhaber).
//   · Schulung (/agent/schulung, Trainerin und Vertriebsleitung): GET /agent/schulung/mara-stichprobe,
//     POST /agent/schulung/mara-stichprobe/:id.
// Läufe: die Stichprobe der Woche (montags, holt sich sonst beim ersten Öffnen selbst).
// Die Regeln stehen rein in shared/fiaon-mara-ampel.ts.
// ═══════════════════════════════════════════════════════════════════════════
import { Router, type Response } from "express";
import { sqlPool } from "../lib/db-pool";
import { requireChef, chefProtokoll, type ChefRequest } from "./fiaon-chef-zugang";
import { requireAgent, type AgentRequest } from "./fiaon-agent";
import { tageslauf } from "../lib/fiaon-crons";
import { MARA_AMPEL, STUFE_TEXT, ampelSetzenPruefen, aufstiegVorschlag, wocheBerlin, type AmpelKey, type AmpelStufe } from "@shared/fiaon-mara-ampel";

const router = Router();
const inhaber = requireChef("inhaber");

async function chefName(req: ChefRequest): Promise<string> {
  const id = req.chef?.agentId ?? null;
  if (id) {
    const [a] = (await sqlPool`SELECT name FROM fiaon_agents WHERE id = ${id} LIMIT 1`.catch(() => [])) as any[];
    if (a?.name && String(a.name).trim()) return String(a.name).trim().slice(0, 80);
  }
  return id ? `Chef #${id}` : "Inhaber";
}

// ── LAGEZIMMER: „MARA HEUTE“ ─────────────────────────────────────────────────
router.get("/chef/mara-heute", requireChef("leitung"), async (req: ChefRequest, res: Response) => {
  try {
    const { maraHeuteLesen } = await import("../lib/fiaon-mara-heute");
    const h = await maraHeuteLesen();
    res.setHeader("Cache-Control", "no-store");
    res.json({ ok: true, ...h, darfRueckgaengig: req.chef?.stufe === "inhaber" });
  } catch (err) {
    console.error("[MARA-HEUTE]", err);
    res.status(500).json({ ok: false, error: "„Mara heute“ ließ sich nicht laden." });
  }
});

router.post("/chef/mara-heute/rueckgaengig", inhaber, async (req: ChefRequest, res: Response) => {
  try {
    const art = String(req.body?.art ?? "");
    const id = String(req.body?.id ?? "");
    if (!["termin", "angaben", "mail_nicht_senden", "mail_senden"].includes(art)) return res.status(400).json({ ok: false, error: "Unbekannter Knopf." });
    const { rueckgaengigMachen } = await import("../lib/fiaon-mara-heute");
    const von = await chefName(req);
    const erg = await rueckgaengigMachen(art as any, id, von);
    void chefProtokoll(req, `mara_heute:${art}:${id}`, erg.text.slice(0, 200));
    res.status(erg.ok ? 200 : erg.status).json(erg.ok ? { ok: true, text: erg.text } : { ok: false, error: erg.text });
  } catch (err) {
    console.error("[MARA-HEUTE] rückgängig:", err);
    res.status(500).json({ ok: false, error: "Das ist abgebrochen — bitte noch einmal." });
  }
});

// ── STEUERPULT: DIE AMPEL ────────────────────────────────────────────────────
router.get("/chef/mara/ampel", inhaber, async (_req: ChefRequest, res: Response) => {
  try {
    const { ampelLesenMitVerlauf } = await import("../lib/fiaon-mara-ampel");
    const { ampelStichprobe } = await import("../lib/fiaon-mara-stichprobe");
    const a = await ampelLesenMitVerlauf();
    const stichprobe = await ampelStichprobe(a.stand).catch((e) => { console.warn("[MARA-AMPEL] Stichprobe:", String(e?.message ?? e).slice(0, 160)); return []; });
    res.setHeader("Cache-Control", "no-store");
    res.json({ ok: true, werkzeuge: MARA_AMPEL, stand: a.stand, verlauf: a.verlauf.slice(0, 8), geaendertAm: a.geaendertAm, stichprobe });
  } catch (err) {
    console.error("[MARA-AMPEL]", err);
    res.status(500).json({ ok: false, error: "Die Ampel ließ sich nicht laden." });
  }
});

/**
 * Eine Stufe setzen. Gelb → Grün ohne den Vorschlag der Stichprobe (4 Wochen unter 2 %) fragt einmal nach
 * (`trotzdem`): Justin entscheidet — die Stichprobe ist ein Vorschlag, kein Schloss.
 */
router.post("/chef/mara/ampel", inhaber, async (req: ChefRequest, res: Response) => {
  try {
    const werkzeug = String(req.body?.werkzeug ?? "");
    const stufe = String(req.body?.stufe ?? "");
    const fehler = ampelSetzenPruefen(werkzeug, stufe);
    if (fehler) return res.status(400).json({ ok: false, error: fehler });
    const { ampelLesenMitVerlauf, ampelSpeichern } = await import("../lib/fiaon-mara-ampel");
    const jetzt = await ampelLesenMitVerlauf();
    const vorher = jetzt.stand[werkzeug as AmpelKey];
    if (vorher === "gelb" && stufe === "gruen" && req.body?.trotzdem !== true) {
      const { quotenLesen } = await import("../lib/fiaon-mara-stichprobe");
      const { quoten } = await quotenLesen();
      const auf = aufstiegVorschlag("gelb", quoten.find((q) => q.werkzeug === werkzeug)?.wochen ?? []);
      if (!auf.vorschlag) return res.status(409).json({ ok: false, code: "AUFSTIEG_FEHLT", error: `Die Stichprobe schlägt Grün noch nicht vor: ${auf.grund}` });
    }
    const von = await chefName(req);
    const erg = await ampelSpeichern(werkzeug as AmpelKey, stufe as AmpelStufe, von);
    const w = MARA_AMPEL.find((x) => x.key === werkzeug);
    void chefProtokoll(req, `mara_ampel:${werkzeug}`, `${STUFE_TEXT[vorher]} → ${STUFE_TEXT[stufe as AmpelStufe]}${req.body?.trotzdem === true ? " (trotz Stichprobe)" : ""}`);
    console.log(`[MARA-AMPEL] ${von}: ${w?.label ?? werkzeug} ${vorher} → ${stufe}`);
    res.json({ ok: true, stand: erg.stand, verlauf: erg.verlauf.slice(0, 8) });
  } catch (err) {
    console.error("[MARA-AMPEL] setzen:", err);
    res.status(500).json({ ok: false, error: "Nicht gespeichert — bitte noch einmal." });
  }
});

// ── SCHULUNG: DIE STICHPROBE ─────────────────────────────────────────────────
/** Trainerin (E-161), Vertriebsleitung und Verwaltung — dieselbe Regel wie die Leitungs-Fassung der Schulung. */
async function darfStichprobe(req: AgentRequest): Promise<boolean> {
  if (req.agent?.trainer) return true;
  const [a] = (await sqlPool`SELECT COALESCE(rolle, 'agent') AS rolle FROM fiaon_agents WHERE id = ${req.agent!.id}`.catch(() => [])) as any[];
  return ["vertriebsleiter", "admin"].includes(String(a?.rolle));
}

router.get("/agent/schulung/mara-stichprobe", requireAgent, async (req: AgentRequest, res: Response) => {
  try {
    if (!(await darfStichprobe(req))) return res.status(403).json({ ok: false, error: "Nur für die Schulungsleitung." });
    const { stichprobeZiehenWennFaellig, stichprobeLesen, quotenLesen } = await import("../lib/fiaon-mara-stichprobe");
    const gezogen = await stichprobeZiehenWennFaellig().catch((e) => { console.warn("[MARA-STICHPROBE] ziehen:", String(e?.message ?? e).slice(0, 160)); return null; });
    const woche = gezogen?.woche ?? wocheBerlin();
    const [faelle, q] = await Promise.all([stichprobeLesen(woche), quotenLesen()]);
    res.setHeader("Cache-Control", "no-store");
    res.json({
      ok: true, woche, faelle, wochen: q.wochen.slice(0, 4), quoten: q.quoten, laufend: q.laufend,
      werkzeuge: MARA_AMPEL.map((w) => ({ key: w.key, label: w.label })),
    });
  } catch (err) {
    console.error("[MARA-STICHPROBE]", err);
    res.status(500).json({ ok: false, error: "Die Stichprobe ließ sich nicht laden." });
  }
});

router.post("/agent/schulung/mara-stichprobe/:id", requireAgent, async (req: AgentRequest, res: Response) => {
  try {
    if (!(await darfStichprobe(req))) return res.status(403).json({ ok: false, error: "Nur für die Schulungsleitung." });
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ ok: false, error: "Ungültiger Fall." });
    const { stichprobeBewerten } = await import("../lib/fiaon-mara-stichprobe");
    const erg = await stichprobeBewerten(id, req.body?.urteil, req.body?.grund, { name: String(req.agent!.name ?? `#${req.agent!.id}`), id: req.agent!.id });
    res.status(erg.ok ? 200 : erg.status).json(erg.ok ? { ok: true, fall: erg.fall } : { ok: false, error: erg.error });
  } catch (err) {
    console.error("[MARA-STICHPROBE] bewerten:", err);
    res.status(500).json({ ok: false, error: "Nicht gespeichert — bitte noch einmal." });
  }
});

// ── DER LAUF: die Stichprobe der Woche (montags; sonst holt sie sich beim ersten Öffnen selbst) ──
tageslauf("mara-stichprobe", async () => {
  const { stichprobeZiehenWennFaellig } = await import("../lib/fiaon-mara-stichprobe");
  await stichprobeZiehenWennFaellig();
}, 60 * 60_000, { beimStartNach: 7 * 60_000, alleXStunden: 12 });

export default router;
