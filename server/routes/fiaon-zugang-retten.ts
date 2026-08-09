// ═══════════════════════════════════════════════════════════════════════════
// ZUGANG RETTEN — Routen
//
// Rechte: Betreiber und Vertriebsleitung. Jede Aktion wird protokolliert,
// jede verlangt eine Begründung. Das ist keine Bürokratie: Wer einem Kunden
// ein Passwort setzt, greift in dessen Konto ein, und in drei Wochen muss
// nachvollziehbar sein, warum.
// ═══════════════════════════════════════════════════════════════════════════

import { Router, type Request, type Response } from "express";
import { sqlPool } from "../lib/db-pool";
import { requireAgent, type AgentRequest } from "./fiaon-agent";
import { istVertriebsleiter } from "./fiaon-vertrieb";
import {
  einmalPasswortSetzen, passwortSetzen, setzLinkErzeugen, setzLinkPruefen,
  zugangFreischalten, zugangProtokoll, LINK_MINUTEN, EINMAL_STUNDEN,
} from "../lib/fiaon-zugang";
import { mailSenden } from "../lib/fiaon-mail-senden";

const router = Router();

/** Nur Betreiber und Vertriebsleitung. 403, nicht 404: Die Leitung DARF wissen, dass es das gibt. */
async function nurRettung(req: AgentRequest, res: Response, next: any) {
  if (!(await istVertriebsleiter(req.agent!.id))) {
    return res.status(403).json({ ok: false, error: "Zugangs-Werkzeuge sind der Vertriebsleitung vorbehalten." });
  }
  return next();
}

/**
 * POST /agent/zugang/:ref/setz-link — Link erzeugen und verschicken.
 *
 * Der Versand läuft über den bestehenden Weg `welcome`: Er trägt bereits den
 * Kontext „so kommst du in dein Konto" und ist als Zweig aktiv. Ein eigenes
 * Ereignis dafür anzulegen hieße, einen weiteren Make-Zweig und ein weiteres
 * Brevo-Template zu verlangen — für dieselbe Aussage.
 */
router.post("/agent/zugang/:ref/setz-link", requireAgent, nurRettung, async (req: AgentRequest, res: Response) => {
  try {
    const ref = String(req.params.ref);
    const grund = String(req.body?.grund || "").trim();
    if (grund.length < 5) return res.status(400).json({ ok: false, error: "Bitte kurz begründen." });

    const [a] = (await sqlPool`
      SELECT a.ref, a.person_id,
             COALESCE(NULLIF(a.email,''), NULLIF(a.contact_email,''), NULLIF(a.billing_email,'')) AS email
      FROM fiaon_applications a WHERE a.ref = ${ref} AND a.gdpr_deleted_at IS NULL
    `) as any[];
    if (!a) return res.status(404).json({ ok: false, error: "Bestellung nicht gefunden." });
    if (!a.email) return res.status(400).json({ ok: false, error: "Keine E-Mail hinterlegt." });

    const link = setzLinkErzeugen(ref);
    const versand = a.person_id
      ? await mailSenden({
          event: "welcome", personId: Number(a.person_id),
          zusatz: { login_url: link, passwort_link: link },
          akteur: { name: req.agent!.name, agentId: req.agent!.id, rolle: "vertriebsleiter" },
        })
      : { ok: false, status: "abgelehnt" as const, grund: "Keine Person zugeordnet", meldung: "" };

    await zugangProtokoll("zugang_setzlink", ref, req.agent!.name, grund, sqlPool);
    res.json({
      ok: true,
      link,
      gueltigMinuten: LINK_MINUTEN,
      versand: versand.ok ? "versandt" : "nicht versandt",
      grund: versand.ok ? null : versand.grund,
      hinweis: versand.ok
        ? `Der Link ist an ${a.email} unterwegs und gilt ${LINK_MINUTEN} Minuten.`
        : `Die Mail ging nicht raus (${versand.grund}). Der Link steht hier — du kannst ihn dem Kunden auch direkt durchgeben.`,
    });
  } catch (err) {
    console.error("[ZUGANG] setz-link:", err);
    res.status(500).json({ ok: false, error: "Serverfehler" });
  }
});

/** POST /agent/zugang/:ref/einmal-passwort — für den Telefonfall. */
router.post("/agent/zugang/:ref/einmal-passwort", requireAgent, nurRettung, async (req: AgentRequest, res: Response) => {
  try {
    const grund = String(req.body?.grund || "").trim();
    if (grund.length < 5) return res.status(400).json({ ok: false, error: "Bitte kurz begründen." });
    const erg = await einmalPasswortSetzen(String(req.params.ref), req.agent!.name, grund);
    if (!erg.ok) return res.status(400).json({ ok: false, error: erg.grund });
    res.json({
      ok: true,
      passwort: erg.passwort,
      gueltigBis: erg.gueltigBis,
      hinweis: `Gültig ${EINMAL_STUNDEN} Stunden. Der Kunde MUSS beim ersten Login ein eigenes Passwort setzen. `
        + "Dieses Passwort wird genau einmal angezeigt — schreib es dir jetzt auf oder lies es gleich vor.",
    });
  } catch (err) {
    console.error("[ZUGANG] einmal-passwort:", err);
    res.status(500).json({ ok: false, error: "Serverfehler" });
  }
});

/** POST /agent/zugang/:ref/freischalten */
router.post("/agent/zugang/:ref/freischalten", requireAgent, nurRettung, async (req: AgentRequest, res: Response) => {
  try {
    const erg = await zugangFreischalten(String(req.params.ref), req.agent!.name, String(req.body?.grund || ""));
    if (!erg.ok) return res.status(400).json({ ok: false, error: erg.grund });
    res.json({ ok: true, meldung: "Zugang freigeschaltet. Der Kunde kommt jetzt mit seinem Passwort hinein." });
  } catch (err) {
    console.error("[ZUGANG] freischalten:", err);
    res.status(500).json({ ok: false, error: "Serverfehler" });
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// ÖFFENTLICH — der Kunde löst den Link ein
// ═══════════════════════════════════════════════════════════════════════════

/** GET /zugang/:ref/pruefen — gilt dieser Link noch? */
router.get("/zugang/:ref/pruefen", async (req: Request, res: Response) => {
  const { exp, e, sig } = req.query as Record<string, string>;
  const p = setzLinkPruefen(String(req.params.ref), String(exp || ""), String(e || ""), String(sig || ""));
  res.status(p.gueltig ? 200 : 410).json({ ok: p.gueltig, error: p.grund });
});

/** POST /zugang/:ref/setzen — Passwort setzen und direkt eingeloggt sein. */
router.post("/zugang/:ref/setzen", async (req: Request, res: Response) => {
  try {
    const { exp, e, sig, passwort } = req.body || {};
    const p = setzLinkPruefen(String(req.params.ref), String(exp || ""), String(e || ""), String(sig || ""));
    if (!p.gueltig) return res.status(410).json({ ok: false, error: p.grund });

    const erg = await passwortSetzen(String(req.params.ref), String(passwort || ""));
    if (!erg.ok) return res.status(400).json({ ok: false, error: erg.grund });
    // `konto` trägt dieselben Felder wie eine erfolgreiche Anmeldung — die
    // Portalseite legt sie unverändert in ihre Sitzung. Kein zweiter Login.
    res.json({ ok: true, konto: erg.konto ?? null, hinweis: erg.grund ?? null });
  } catch (err) {
    console.error("[ZUGANG] setzen:", err);
    res.status(500).json({ ok: false, error: "Serverfehler" });
  }
});

export default router;
