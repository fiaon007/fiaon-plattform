// ═══════════════════════════════════════════════════════════════════════════
// /api/fiaon/vertrag-bestaetigen/:token — VERTRAG FÜR JEDEN ABSCHLUSSWEG (19.10.2026, E-398)
//
// Die Seite /vertrag-bestaetigen/<Link>: Bestellungen ohne /antrag-neu
// (Betreuer-Anlage, alter Antrag) bekommen denselben Vertrag zum Unterschreiben
// bzw. — im Bestand, nach Justins „go“ — zum Bestätigen. Der Link ist die Tür
// (signiert, 60 Tage); was passiert, steht in server/lib/fiaon-vertrag-bestaetigen.ts.
// ═══════════════════════════════════════════════════════════════════════════
import { Router, type Request, type Response } from "express";
import { istRoboterUnterschrift } from "../lib/fiaon-vertrieb-zusage";
import { bestaetigenTokenLesen, bestaetigenStand, vertragVorschau, bestaetigenAnnehmen } from "../lib/fiaon-vertrag-bestaetigen";

const router = Router();

function kundenIp(req: Request): string {
  if (req.ip) return String(req.ip).replace(/^::ffff:/, "");
  const weiter = String(req.headers["x-forwarded-for"] || "").split(",").map((x) => x.trim()).filter(Boolean);
  return weiter.length ? weiter[weiter.length - 1] : (req.socket?.remoteAddress || "");
}

/** Wie in /antrag-neu: Der lokale Prüfstand (Datenbank auf derselben Maschine) darf aus dem eigenen Browser annehmen. */
function pruefstandErlaubt(): boolean {
  if (process.env.PRUEFSTAND_ROBOTER_ERLAUBT !== "1") return false;
  try {
    const host = new URL(String(process.env.DATABASE_URL || "")).hostname;
    return host === "127.0.0.1" || host === "localhost" || host === "::1";
  } catch { return false; }
}

const UNGUELTIG = "Dieser Link ist nicht (mehr) gültig. Bitte schreiben Sie uns an support@fiaon.com — wir schicken Ihnen einen neuen.";

router.get("/vertrag-bestaetigen/:token/stand", async (req: Request, res: Response) => {
  try {
    const ref = bestaetigenTokenLesen(String(req.params.token));
    if (!ref) return res.status(404).json({ ok: false, error: UNGUELTIG });
    res.json(await bestaetigenStand(ref));
  } catch (e) {
    console.error("[VERTRAG-BESTAETIGEN] stand:", e);
    res.status(500).json({ ok: false, error: "Der Vertrag konnte gerade nicht geladen werden." });
  }
});

router.get("/vertrag-bestaetigen/:token/vertrag", async (req: Request, res: Response) => {
  try {
    const ref = bestaetigenTokenLesen(String(req.params.token));
    if (!ref) return res.status(404).json({ ok: false, error: UNGUELTIG });
    const html = await vertragVorschau(ref, { limit: req.query.limit, sofort: String(req.query.sofort || "") === "1" });
    if (!html) return res.status(404).json({ ok: false });
    res.json({ ok: true, html });
  } catch (e) {
    console.error("[VERTRAG-BESTAETIGEN] vertrag:", e);
    res.status(500).json({ ok: false, error: "Der Vertrag konnte gerade nicht geladen werden." });
  }
});

router.post("/vertrag-bestaetigen/:token/annehmen", async (req: Request, res: Response) => {
  try {
    const ref = bestaetigenTokenLesen(String(req.params.token));
    if (!ref) return res.status(404).json({ ok: false, error: UNGUELTIG });
    const ip = kundenIp(req);
    const ua = String(req.headers["user-agent"] ?? "");
    const roboter = istRoboterUnterschrift(ip, ua);
    const pruefstand = roboter.roboter && pruefstandErlaubt();
    if (roboter.roboter && !pruefstand) {
      console.warn(`[VERTRAG-BESTAETIGEN] ${ref}: abgewiesen — ${roboter.grund}`);
      return res.status(403).json({ ok: false, error: "Die Annahme ist nur direkt im Browser möglich." });
    }
    const b = req.body ?? {};
    const erg = await bestaetigenAnnehmen(ref, {
      limit: b.limit, sofort: b.sofort === true, hakenAgb: b.hakenAgb === true, knopf: String(b.knopf ?? ""),
      fassungen: b.fassungen ?? {}, unterschrift: b.unterschrift ?? null, ip, userAgent: ua, pruefstand,
    });
    if (!erg.ok) return res.status(erg.status).json(erg);
    res.json(erg);
  } catch (e) {
    console.error("[VERTRAG-BESTAETIGEN] annehmen:", e);
    res.status(500).json({ ok: false, error: "Die Annahme konnte gerade nicht gespeichert werden. Bitte versuchen Sie es gleich noch einmal." });
  }
});

export default router;
