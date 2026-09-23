// ═══════════════════════════════════════════════════════════════════════════
// DER TAGESBERICHT — ROUTEN (23.09.2026, E-216)
//
// Drei für den Mitarbeiter, zwei für die Leitung. Die Regeln stehen alle in
// server/lib/fiaon-tagesbericht.ts; hier wird nur bedient.
// ═══════════════════════════════════════════════════════════════════════════
import { Router, type Response } from "express";
import { requireAgent, type AgentRequest } from "./fiaon-agent";
import { requireChef, type ChefRequest } from "./fiaon-chef-zugang";
import {
  aufzeichnungFuer, kundenFuerAuswahl, berichtAbgeben, berichtFuer, faelligFuer,
  berichteFuerLeitung, fehlendeBerichte, SPERRE_AB,
} from "../lib/fiaon-tagesbericht";
import { ERGEBNISSE, ERGEBNIS_TEXT } from "../lib/fiaon-kontakt-ergebnis";

const router = Router();

/** Was das System über heute weiß — plus die Auswahl zum Nachtragen. */
router.get("/agent/tagesbericht", requireAgent, async (req: AgentRequest, res: Response) => {
  try {
    const tag = /^\d{4}-\d{2}-\d{2}$/.test(String(req.query.tag ?? "")) ? String(req.query.tag) : undefined;
    const [aufzeichnung, kunden, stand] = await Promise.all([
      aufzeichnungFuer(req.agent!.id, tag),
      kundenFuerAuswahl(req.agent!.id),
      faelligFuer(req.agent!.id),
    ]);
    const vorhanden = await berichtFuer(req.agent!.id, aufzeichnung.tag);
    res.json({
      ok: true,
      aufzeichnung,
      kunden,
      stand,
      sperreAb: SPERRE_AB,
      // Nur die Ergebnisse, die ein Gespräch bedeuten — „nicht erreicht" trägt
      // niemand nachträglich ein, und die Raten-Ergebnisse gehören in die Akte.
      ergebnisse: (ERGEBNISSE as readonly string[])
        .filter((e) => e.startsWith("erreicht") || e === "rueckruf_termin")
        .map((e) => ({ wert: e, text: (ERGEBNIS_TEXT as Record<string, string>)[e] ?? e })),
      bereits: vorhanden
        ? {
          abgegebenAm: vorhanden.abgegeben_am, anrufeSelbst: vorhanden.anrufe_selbst,
          gut: vorhanden.gut, schlecht: vorhanden.schlecht, verbesserung: vorhanden.verbesserung,
          stimmung: vorhanden.stimmung,
        }
        : null,
    });
  } catch (err) {
    console.error("[TAGESBERICHT] laden:", err);
    res.status(500).json({ ok: false, error: "Der Tagesbericht ließ sich nicht laden." });
  }
});

/** Abgeben. Alles Nachgetragene geht zusätzlich den normalen Weg. */
router.post("/agent/tagesbericht", requireAgent, async (req: AgentRequest, res: Response) => {
  try {
    const tag = /^\d{4}-\d{2}-\d{2}$/.test(String(req.body?.tag ?? "")) ? String(req.body.tag) : undefined;
    const aufz = await aufzeichnungFuer(req.agent!.id, tag);
    const erg = await berichtAbgeben({ id: req.agent!.id, name: req.agent!.name }, aufz.tag, {
      anrufeSelbst: Number(req.body?.anrufeSelbst ?? 0),
      nachgetragen: Array.isArray(req.body?.nachgetragen)
        ? req.body.nachgetragen
          .map((n: any) => ({ personId: Number(n?.personId), ergebnis: String(n?.ergebnis ?? "") }))
          .filter((n: any) => Number.isFinite(n.personId) && n.personId > 0 && n.ergebnis)
        : [],
      zusagen: Array.isArray(req.body?.zusagen)
        ? req.body.zusagen
          .map((z: any) => ({ personId: Number(z?.personId), datum: String(z?.datum ?? "") }))
          .filter((z: any) => Number.isFinite(z.personId) && z.personId > 0 && z.datum)
        : [],
      gut: String(req.body?.gut ?? "").trim().slice(0, 2000) || null,
      schlecht: String(req.body?.schlecht ?? "").trim().slice(0, 2000) || null,
      verbesserung: String(req.body?.verbesserung ?? "").trim().slice(0, 2000) || null,
      stimmung: req.body?.stimmung != null ? Number(req.body.stimmung) : null,
    });
    res.json(erg);
  } catch (err) {
    console.error("[TAGESBERICHT] abgeben:", err);
    res.status(500).json({ ok: false, error: "Der Bericht ließ sich nicht speichern." });
  }
});

/** Für die Leiste im Office: Ist heute etwas fällig? */
router.get("/agent/tagesbericht/faellig", requireAgent, async (req: AgentRequest, res: Response) => {
  try {
    res.json({ ok: true, ...(await faelligFuer(req.agent!.id)), sperreAb: SPERRE_AB });
  } catch (err) {
    res.json({ ok: true, faellig: false, abgegeben: false, tag: "", abUm: null, gestern: { tag: "", fehlt: false }, sperreAb: SPERRE_AB });
  }
});

// ── Die Leitung ───────────────────────────────────────────────────────────
const wache = requireChef("leitung");

router.get("/chef/tagesberichte", wache, async (req: ChefRequest, res: Response) => {
  try {
    const tage = Math.min(Math.max(Number(req.query.tage) || 7, 1), 60);
    const { sqlPool } = await import("../lib/db-pool");
    const [z] = (await sqlPool`
      SELECT (NOW() AT TIME ZONE 'Europe/Berlin')::date::text AS heute,
             ((NOW() AT TIME ZONE 'Europe/Berlin')::date - ${tage}::int)::text AS von`) as any[];
    const berichte = await berichteFuerLeitung(String(z.von), String(z.heute));
    const fehlen = await fehlendeBerichte(String(z.heute));
    const gestern = await fehlendeBerichte(String(new Date(new Date(`${z.heute}T12:00:00Z`).getTime() - 86400000).toISOString().slice(0, 10)));
    res.json({
      ok: true, von: z.von, bis: z.heute, sperreAb: SPERRE_AB,
      berichte: berichte.map((b) => ({
        id: Number(b.id), agent: b.agent_name, tag: String(b.tag).slice(0, 10),
        aufzeichnung: typeof b.aufzeichnung === "string" ? JSON.parse(b.aufzeichnung) : b.aufzeichnung,
        anrufeSelbst: Number(b.anrufe_selbst || 0),
        nachgetragen: (typeof b.nachgetragen === "string" ? JSON.parse(b.nachgetragen) : b.nachgetragen ?? []).length,
        zusagen: (typeof b.zusagen === "string" ? JSON.parse(b.zusagen) : b.zusagen ?? []).length,
        gut: b.gut, schlecht: b.schlecht, verbesserung: b.verbesserung, stimmung: b.stimmung,
        abgegebenAm: b.abgegeben_am,
      })),
      fehlenHeute: fehlen, fehlenGestern: gestern,
    });
  } catch (err) {
    console.error("[TAGESBERICHT] Leitung:", err);
    res.status(500).json({ ok: false, error: "Die Berichte ließen sich nicht laden." });
  }
});

export default router;
