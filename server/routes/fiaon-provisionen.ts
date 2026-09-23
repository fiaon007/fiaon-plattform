// ═══════════════════════════════════════════════════════════════════════════
// /chef/s/provisionen — die Provisionsautomatik (23.09.2026)
//
// Justin: „Stelle es einstweilen ab, dass die Provision den Mitarbeitern
// automatisch gebucht wird — und mach mir eine eigene Seite dafür."
//
// Der Schalter steht hier, und daneben steht, was er kostet: jede Provision,
// die seit dem Abschalten entstanden WÄRE, mit Mensch, Betrag und Anlass.
// Buchen oder verwerfen — ein Klick, und die Spur bleibt.
// ═══════════════════════════════════════════════════════════════════════════
import { Router, type Response } from "express";
import { requireChef, type ChefRequest } from "./fiaon-chef-zugang";
import { sqlPool } from "../lib/db-pool";
import {
  automatikAn, automatikSetzen, vormerkungen, vormerkungZahlen, nachbuchen, verwerfen,
} from "../lib/fiaon-provision-automatik";

const router = Router();
const wache = requireChef("geschaeftsfuehrung");
const wer = (req: ChefRequest) => (req.chef?.agentId ? `Chef #${req.chef.agentId}` : "Leitung");

router.get("/chef/provisionen/stand", wache, async (req: ChefRequest, res: Response) => {
  try {
    const status = ["offen", "gebucht", "verworfen"].includes(String(req.query.status)) ? String(req.query.status) : "offen";
    const [zahlen, liste, letzte] = await Promise.all([
      vormerkungZahlen(),
      vormerkungen(status, 200),
      sqlPool`
        SELECT c.id, c.agent_id, a.name AS agent_name, c.ref, c.amount_cents, c.rate_bp, c.kind, c.status, c.created_at
          FROM fiaon_commissions c LEFT JOIN fiaon_agents a ON a.id = c.agent_id
         ORDER BY c.id DESC LIMIT 15`.catch(() => []),
    ]);
    res.json({
      ok: true,
      an: await automatikAn(),
      zahlen,
      status,
      vormerkungen: (liste as any[]).map((v) => ({
        id: Number(v.id), agent: v.agent_name ?? `#${v.agent_id}`, kunde: String(v.kunde || "").trim() || null,
        ref: v.ref, zahlung: v.payment_reference, paket: v.pack_name,
        betragEuro: Number(v.amount_cents || 0) / 100, satz: Number(v.rate_bp || 0) / 100,
        basisEuro: Number(v.base_amount_cents || 0) / 100, art: v.kind, quelle: v.quelle_name ?? null,
        anlass: v.anlass, notiz: v.note ?? null, am: v.created_at,
        erledigtAm: v.erledigt_am ?? null, erledigtVon: v.erledigt_von ?? null,
      })),
      letzteBuchungen: (letzte as any[]).map((c) => ({
        id: Number(c.id), agent: c.agent_name ?? `#${c.agent_id}`, ref: c.ref,
        betragEuro: Number(c.amount_cents || 0) / 100, art: c.kind, status: c.status, am: c.created_at,
      })),
    });
  } catch (err) {
    console.error("[PROVISIONEN] stand:", err);
    res.status(500).json({ ok: false, error: "Der Stand ließ sich nicht laden." });
  }
});

/** Die Automatik an- oder abschalten. */
router.post("/chef/provisionen/automatik", wache, async (req: ChefRequest, res: Response) => {
  try {
    const an = req.body?.an === true;
    await automatikSetzen(an, wer(req));
    res.json({ ok: true, an });
  } catch (err) {
    res.status(500).json({ ok: false, error: "Der Schalter ließ sich nicht setzen." });
  }
});

/** Eine Vormerkung buchen. */
router.post("/chef/provisionen/buchen", wache, async (req: ChefRequest, res: Response) => {
  const id = Number(req.body?.id);
  if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ ok: false, error: "Ungültig." });
  const erg = await nachbuchen(id, wer(req));
  res.status(erg.ok ? 200 : 409).json(erg.ok ? { ok: true, hinweis: erg.grund ?? null } : { ok: false, error: erg.grund });
});

/** Alle offenen Vormerkungen auf einmal buchen — mit Bestätigung im Browser. */
router.post("/chef/provisionen/alle-buchen", wache, async (req: ChefRequest, res: Response) => {
  try {
    const offen = await vormerkungen("offen", 500);
    let gebucht = 0;
    for (const v of offen) {
      const e = await nachbuchen(Number(v.id), wer(req));
      if (e.ok) gebucht++;
    }
    console.log(`[PROVISIONEN] ${wer(req)} hat ${gebucht} Vormerkungen gebucht.`);
    res.json({ ok: true, gebucht });
  } catch (err) {
    res.status(500).json({ ok: false, error: "Das Nachbuchen ist abgebrochen." });
  }
});

/** Eine Vormerkung verwerfen. */
router.post("/chef/provisionen/verwerfen", wache, async (req: ChefRequest, res: Response) => {
  const id = Number(req.body?.id);
  if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ ok: false, error: "Ungültig." });
  const ok = await verwerfen(id, wer(req), String(req.body?.grund ?? ""));
  res.status(ok ? 200 : 409).json(ok ? { ok: true } : { ok: false, error: "Diese Vormerkung ist nicht mehr offen." });
});

export default router;
