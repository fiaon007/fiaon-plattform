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

/**
 * POST /chef/provisionen/override-nachtragen { trocken }   (01.10.2026)
 *
 * Bis zum 01.10. fiel bei Schalter AUS der Override des direkten Werbers ersatzlos
 * weg — vorgemerkt wurde nur die eigene Provision. Gemessen am 01.10.: 9 der 15
 * offenen Vormerkungen (24.09.–01.10.) hätten einen Override gehabt. Dieser Weg
 * trägt sie als Vormerkung nach — mit derselben Rechnung wie Buchen und Vormerken
 * (werberOverride in fiaon-agent.ts), damit Justin am 05.10. die vollständige
 * Liste vor sich hat. Bucht NICHTS, legt nur Vormerkungen an. Doppelt geht nicht
 * (vorhandene Override-Vormerkungen und -Provisionen werden übersprungen, dazu der
 * eindeutige Index je Zahlung, Mensch und Art). Vorgabe: trocken.
 */
router.post("/chef/provisionen/override-nachtragen", wache, async (req: ChefRequest, res: Response) => {
  try {
    const trocken = req.body?.trocken !== false;
    const { werberOverride, getSettings } = await import("./fiaon-agent");
    const { vormerken } = await import("../lib/fiaon-provision-automatik");
    const settings = await getSettings();
    const offen = (await vormerkungen("offen", 500)).filter((v) => v.kind === "own" && v.payment_reference);
    const liste: Array<{
      vormerkung: number; zahlung: string; betreuer: number; werber: number;
      betragEuro: number; satz: number; schonDa: boolean; angelegt: boolean;
    }> = [];
    for (const v of offen) {
      const [ag] = (await sqlPool`SELECT id, name, recruited_by, override_rate_bp FROM fiaon_agents WHERE id = ${v.agent_id}`) as any[];
      if (!ag) continue;
      const ov = await werberOverride(ag, settings, Number(v.base_amount_cents) || 0);
      if (!ov) continue;
      const [da] = (await sqlPool`
        SELECT 1 AS da FROM fiaon_provision_vormerkung
         WHERE payment_reference = ${v.payment_reference} AND agent_id = ${ov.werberId} AND kind = 'override' AND status <> 'verworfen'
        UNION ALL
        SELECT 1 FROM fiaon_commissions
         WHERE payment_reference = ${v.payment_reference} AND agent_id = ${ov.werberId} AND kind = 'override' AND status <> 'storniert'
        LIMIT 1`) as any[];
      const zeile = {
        vormerkung: Number(v.id), zahlung: String(v.payment_reference), betreuer: Number(v.agent_id), werber: ov.werberId,
        betragEuro: ov.cents / 100, satz: ov.bp / 100, schonDa: !!da, angelegt: false,
      };
      if (!da && !trocken) {
        zeile.angelegt = await vormerken({
          agentId: ov.werberId, ref: v.ref, zahlungsreferenz: v.payment_reference, paket: v.pack_name,
          basisCents: Number(v.base_amount_cents) || 0, satzBp: ov.bp, betragCents: ov.cents, art: "override",
          quelleAgentId: Number(v.agent_id),
          notiz: `Team-Umsatzbeteiligung: ${v.anlass} von ${ag.name} (Override nachgetragen am 01.10.2026)`,
          anlass: `${v.anlass} (Override, nachgetragen)`,
        });
      }
      liste.push(zeile);
    }
    if (!trocken) console.log(`[PROVISIONEN] ${wer(req)}: ${liste.filter((z) => z.angelegt).length} Override-Vormerkungen nachgetragen.`);
    const neu = liste.filter((z) => !z.schonDa);
    res.json({ ok: true, trocken, anzahl: neu.length, summeEuro: Math.round(neu.reduce((s, z) => s + z.betragEuro, 0) * 100) / 100, liste });
  } catch (err) {
    console.error("[PROVISIONEN] override-nachtragen:", err);
    res.status(500).json({ ok: false, error: "Der Nachtrag ist abgebrochen." });
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
