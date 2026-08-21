// ═══════════════════════════════════════════════════════════════════════════
// DIE ZUSTIMMUNGSSEITE — ÖFFENTLICH, MIT SIGNIERTEM TOKEN
//
// Kein Login: Der Kunde steht noch im Antrag und hat oft gar keinen Zugang.
// Ohne den HMAC ist der Link wertlos, und er gilt 30 Tage.
//
// Die Regeln (was fehlt, was geschrieben werden darf, wer schreiben darf)
// stehen ALLE in `server/lib/fiaon-zustimmung.ts`. Hier steht nur, wer was darf
// — dieselbe Aufteilung wie bei `fiaon-termin.ts`.
// ═══════════════════════════════════════════════════════════════════════════

import { Router, type Request, type Response } from "express";
import {
  zustimmungTokenPruefen, zustimmungsLage, zustimmungFesthalten, ZUSTIMMUNG_TAGE,
} from "../lib/fiaon-zustimmung";

const router = Router();

/** Die Adresse des Anfragenden — hinter Render steht ein Proxy davor. */
function absenderIp(req: Request): string | null {
  const weiter = String(req.headers["x-forwarded-for"] || "").split(",")[0].trim();
  return weiter || req.ip || null;
}

/** GET /zustimmung/:token — was fehlt noch? */
router.get("/zustimmung/:token", async (req: Request, res: Response) => {
  try {
    const geprueft = zustimmungTokenPruefen(req.params.token);
    if (!geprueft) {
      return res.status(400).json({ ok: false, error: "Dieser Link ist ungültig." });
    }
    if (geprueft.abgelaufen) {
      return res.status(410).json({
        ok: false,
        error: `Dieser Link ist abgelaufen — er gilt ${ZUSTIMMUNG_TAGE} Tage. `
          + "Melde dich kurz bei uns, dann schicken wir dir sofort einen neuen.",
      });
    }
    const lage = await zustimmungsLage(geprueft.ref);
    if (!lage) return res.status(404).json({ ok: false, error: "Wir finden diesen Vorgang nicht." });
    res.json({ ok: true, lage });
  } catch (err) {
    console.error("[ZUSTIMMUNG] lage:", err);
    res.status(500).json({ ok: false, error: "Serverfehler" });
  }
});

/** POST /zustimmung/:token — die Erklärungen festhalten. */
router.post("/zustimmung/:token", async (req: Request, res: Response) => {
  try {
    const geprueft = zustimmungTokenPruefen(req.params.token);
    if (!geprueft) return res.status(400).json({ ok: false, error: "Dieser Link ist ungültig." });
    if (geprueft.abgelaufen) {
      return res.status(410).json({ ok: false, error: "Dieser Link ist abgelaufen." });
    }
    const lage = await zustimmungsLage(geprueft.ref);
    if (!lage) return res.status(404).json({ ok: false, error: "Wir finden diesen Vorgang nicht." });
    if (lage.fertig) return res.json({ ok: true, lage, meldung: "Es war schon alles bestätigt." });

    // ── ALLE ODER KEINE ──────────────────────────────────────────────────
    // Die Antragsstrecke verlangt es genauso („Bitte allen Bedingungen
    // zustimmen"). Ein Vertrag ohne Vertragsannahme wäre keiner.
    const gewaehlt: string[] = Array.isArray(req.body?.spalten)
      ? req.body.spalten.map((s: unknown) => String(s)) : [];
    const fehlt = lage.spalten.filter((s) => !gewaehlt.includes(s));
    if (fehlt.length > 0) {
      return res.status(400).json({
        ok: false,
        error: "Bitte allen Punkten zustimmen — sonst kommt der Vertrag nicht zustande.",
      });
    }

    const erg = await zustimmungFesthalten(geprueft.ref, lage.spalten, {
      ip: absenderIp(req),
      userAgent: req.headers["user-agent"] ? String(req.headers["user-agent"]) : null,
    });
    if (!erg.ok) return res.status(400).json({ ok: false, error: erg.grund });

    res.json({
      ok: true,
      lage: await zustimmungsLage(geprueft.ref),
      meldung: "Danke — deine Bestätigung ist gespeichert.",
    });
  } catch (err) {
    console.error("[ZUSTIMMUNG] festhalten:", err);
    res.status(500).json({ ok: false, error: "Serverfehler" });
  }
});

export default router;
