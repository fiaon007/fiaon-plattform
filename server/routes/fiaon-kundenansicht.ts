// ═══════════════════════════════════════════════════════════════════════════
// ALS-KUNDE-ANSICHT — die Routen
//
// Die Regeln (Token, Rechte, Nur-Lesen, Protokoll) stehen ALLE in
// server/lib/fiaon-kundenansicht.ts. Hier steht nur, wer was darf.
//
//   POST /admin/kunden/:ref/ansicht          Verwaltung — jedes Konto
//   POST /agent/vertrieb/person/:id/ansicht  Leitung — eigene und zugewiesene
//   GET  /kundenansicht/stand                Wer wird angesehen? (für Portal + Banner)
//   POST /kundenansicht/beenden              Zurück in die eigene Rolle
// ═══════════════════════════════════════════════════════════════════════════

import { Router, type Request, type Response } from "express";
import { sqlPool } from "../lib/db-pool";
import { requireAgent, type AgentRequest } from "./fiaon-agent";
import {
  KUNDENANSICHT_COOKIE, KUNDENANSICHT_MINUTEN,
  darfAnsehen, kontoBestellungVon, kundenDatenFuerAnsicht,
  kundenansichtProtokoll, kundenansichtTokenBauen, kundenansichtTokenPruefen,
} from "../lib/fiaon-kundenansicht";

const router = Router();

/** Das Cookie setzen — dieselben Eigenschaften wie bei der Mitarbeiter-Ansicht. */
function cookieSetzen(res: Response, token: string): void {
  res.cookie(KUNDENANSICHT_COOKIE, token, {
    httpOnly: true, sameSite: "lax", path: "/",
    maxAge: KUNDENANSICHT_MINUTEN * 60_000,
    // In Produktion nur über HTTPS. Lokal ohne, sonst kommt das Cookie nie an.
    secure: process.env.NODE_ENV === "production",
  });
}

// ═══════════════════════════════════════════════════════════════════════════
// VERWALTUNG — jedes Konto
//
// Der Admin-Code-Schutz greift automatisch: Der Pfad beginnt mit /admin
// (siehe adminCodeGate in server/routes/fiaon-admin-zugang.ts).
// ═══════════════════════════════════════════════════════════════════════════
router.post("/admin/kunden/:ref/ansicht", async (req: Request, res: Response) => {
  try {
    const ref = String(req.params.ref || "").trim();
    const [a] = (await sqlPool`
      SELECT a.ref, a.person_id,
             COALESCE(NULLIF(TRIM(CONCAT_WS(' ', a.first_name, a.last_name)), ''),
                      a.company_name, a.contact_name, a.email, a.ref) AS name,
             COALESCE(NULLIF(a.first_name, ''), a.contact_name) AS vorname
      FROM fiaon_applications a
      WHERE (a.ref = ${ref} OR a.payment_reference = ${ref}) AND a.merged_into IS NULL
      LIMIT 1
    `) as any[];
    if (!a) return res.status(404).json({ ok: false, error: "Kunde nicht gefunden." });
    if (!a.person_id) {
      // Ein Antrag ohne Person hat kein Portal: Das Portal arbeitet mit einem
      // Menschen, nicht mit einer Formularzeile.
      return res.status(409).json({
        ok: false,
        error: "Zu dieser Bestellung gehört noch kein Kundenkonto — es gibt also kein Portal zum Ansehen.",
      });
    }

    // Das Token immer auf die KONTO-Bestellung ausstellen, nicht auf die
    // angeklickte: Wer auf einer Bonitäts-Bestellzeile steht und „Portal
    // ansehen" drückt, will das Portal des Menschen sehen.
    const konto = await kontoBestellungVon(Number(a.person_id));
    if (!konto) {
      return res.status(409).json({
        ok: false,
        error: "Dieser Mensch hat keine Paket-Bestellung — nur Zusatzprodukte. Ein Portal gibt es dafür nicht.",
      });
    }

    const token = kundenansichtTokenBauen(Number(a.person_id), konto.ref, "admin", 0);
    cookieSetzen(res, token);
    await kundenansichtProtokoll({
      ref: konto.ref, personId: Number(a.person_id), art: "admin",
      ansehenderId: 0, name: "Verwaltung",
    }, "gestartet");

    res.json({
      ok: true, token,
      url: "/als-kunde",
      name: String(a.name), vorname: a.vorname ?? null,
      minuten: KUNDENANSICHT_MINUTEN,
    });
  } catch (err) {
    console.error("[KUNDENANSICHT] admin start:", err);
    res.status(500).json({ ok: false, error: "Serverfehler" });
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// VERTRIEBSLEITUNG — eigene und zugewiesene
//
// `requireAgent` sorgt für die Anmeldung; `darfAnsehen` für die Grenze. Ein
// Agent ohne Leitungsrolle bekommt 403 mit einem Satz, der erklärt, warum —
// „Keine Berechtigung" allein bringt niemanden weiter.
// ═══════════════════════════════════════════════════════════════════════════
router.post("/agent/vertrieb/person/:id/ansicht", requireAgent,
  async (req: AgentRequest, res: Response) => {
    try {
      const personId = Number(req.params.id);
      if (!Number.isFinite(personId) || personId <= 0) {
        return res.status(400).json({ ok: false, error: "Ungültige Kundenkennung." });
      }
      const recht = await darfAnsehen("leitung", req.agent!.id, personId);
      if (!recht.erlaubt) return res.status(403).json({ ok: false, error: recht.grund });

      const konto = await kontoBestellungVon(personId);
      if (!konto) {
        return res.status(409).json({
          ok: false,
          error: "Dieser Mensch hat keine Paket-Bestellung — ein Portal gibt es dafür nicht.",
        });
      }

      const token = kundenansichtTokenBauen(personId, konto.ref, "leitung", req.agent!.id);
      cookieSetzen(res, token);
      await kundenansichtProtokoll({
        ref: konto.ref, personId, art: "leitung",
        ansehenderId: req.agent!.id, name: req.agent!.name,
      }, "gestartet");

      res.json({
        ok: true, token, url: "/als-kunde",
        name: konto.name, minuten: KUNDENANSICHT_MINUTEN,
      });
    } catch (err) {
      console.error("[KUNDENANSICHT] leitung start:", err);
      res.status(500).json({ ok: false, error: "Serverfehler" });
    }
  });

// ═══════════════════════════════════════════════════════════════════════════
// DER STAND — wer wird angesehen?
//
// Diese Route erfüllt zwei Aufgaben mit einer Antwort:
//   1. Die Zwischenseite /als-kunde holt sich damit die Kundendaten und legt
//      sie in `sessionStorage.fiaon_user` — danach sieht das Portal genau den
//      Zustand dieses Menschen, ohne dass eine Portalseite etwas wissen muss.
//   2. Der Banner fragt sie bei jedem Seitenaufruf, um Namen und Restzeit zu
//      zeigen. Läuft das Token ab, verschwindet der Banner nicht — die Antwort
//      sagt dann `aktiv: false`, und die Seite schickt zurück.
// ═══════════════════════════════════════════════════════════════════════════
router.get("/kundenansicht/stand", async (req: Request, res: Response) => {
  try {
    const tok = kundenansichtTokenPruefen(req.cookies?.[KUNDENANSICHT_COOKIE]);
    if (!tok) return res.json({ ok: true, aktiv: false });

    // ── DIE BINDUNG AN DEN ANSEHENDEN ────────────────────────────────────
    // Bei einer Leitung muss ihre Anmeldung noch gelten. Sonst wäre ein
    // weitergegebenes Cookie ein Dauerzugang in ein fremdes Konto — bis es
    // abläuft. Bei der Verwaltung prüft das Admin-Code-Gate an anderer Stelle;
    // hier wird geprüft, dass der Code noch anliegt.
    if (tok.art === "leitung") {
      const { verifyAgentToken, AGENT_COOKIE_NAME } = await import("./fiaon-agent");
      const eigen = verifyAgentToken(req.cookies?.[AGENT_COOKIE_NAME]);
      if (!eigen || Number(eigen.id) !== tok.ansehenderId) {
        res.clearCookie(KUNDENANSICHT_COOKIE, { path: "/" });
        return res.json({
          ok: true, aktiv: false,
          grund: "Die Ansicht ist an deine Anmeldung gebunden — bitte neu starten.",
        });
      }
    } else {
      const { hasAdminCode } = await import("./fiaon-admin-zugang");
      if (!hasAdminCode(req)) {
        res.clearCookie(KUNDENANSICHT_COOKIE, { path: "/" });
        return res.json({
          ok: true, aktiv: false,
          grund: "Die Ansicht ist an den Verwaltungszugang gebunden — bitte neu starten.",
        });
      }
    }

    const daten = await kundenDatenFuerAnsicht(tok.personId, tok.ref);
    if (!daten) return res.json({ ok: true, aktiv: false, grund: "Der Kunde ist nicht mehr auffindbar." });

    res.json({
      ok: true,
      aktiv: true,
      bis: new Date(tok.bis).toISOString(),
      art: tok.art,
      // Genau die Form, die der Login liefert (fiaon-antrag.ts POST /login).
      user: daten,
      name: [daten.firstName, daten.lastName].filter(Boolean).join(" ") || daten.ref,
      zurueck: tok.art === "admin" ? `/admin/kunde/${tok.ref}` : "/agent/vertrieb",
    });
  } catch (err) {
    console.error("[KUNDENANSICHT] stand:", err);
    res.status(500).json({ ok: false, error: "Serverfehler" });
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// BEENDEN
//
// Ausdrücklich von der Nur-Lesen-Wand ausgenommen (siehe `nurLesenWand`) —
// sonst käme man nicht mehr heraus, denn Beenden ist ein POST.
// ═══════════════════════════════════════════════════════════════════════════
router.post("/kundenansicht/beenden", async (req: Request, res: Response) => {
  try {
    const tok = kundenansichtTokenPruefen(req.cookies?.[KUNDENANSICHT_COOKIE]);
    res.clearCookie(KUNDENANSICHT_COOKIE, { path: "/" });
    if (tok) {
      let name = "Verwaltung";
      if (tok.art === "leitung") {
        const [ag] = (await sqlPool`SELECT name FROM fiaon_agents WHERE id = ${tok.ansehenderId}`) as any[];
        name = ag?.name ?? `Mitarbeiter ${tok.ansehenderId}`;
      }
      await kundenansichtProtokoll({
        ref: tok.ref, personId: tok.personId, art: tok.art,
        ansehenderId: tok.ansehenderId, name,
      }, "beendet");
    }
    res.json({
      ok: true,
      zurueck: tok?.art === "leitung" ? "/agent/vertrieb"
        : tok ? `/admin/kunde/${tok.ref}` : "/admin/kunden",
    });
  } catch (err) {
    console.error("[KUNDENANSICHT] beenden:", err);
    res.status(500).json({ ok: false, error: "Serverfehler" });
  }
});

export default router;
