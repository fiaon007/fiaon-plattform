// ═══════════════════════════════════════════════════════════════════════════
// TERMINE — öffentliche Buchung und Agentensicht
//
// Zwei Welten in einer Datei, weil es dieselbe Sache ist:
//   ÖFFENTLICH  /api/fiaon/termin/... — kein Login, nur ein signiertes Token.
//               Der Kunde sieht freie Zeiten und bucht. Muster: die signierten
//               Rechnungs-Links (server/fiaon-invoice.ts).
//   AGENT       /api/fiaon/agent/termine/... — hinter requireAgent. Eigene
//               Termine sehen, Ergebnis dokumentieren, selbst welche anlegen.
//
// Die Regeln (Slots, Vorlauf, Besitzschutz, Doppelbuchung) stehen ALLE in
// server/lib/fiaon-termine.ts. Hier steht nur, wer was darf.
// ═══════════════════════════════════════════════════════════════════════════

import { Router, type Request, type Response } from "express";
import { sqlPool } from "../lib/db-pool";
import { requireAgent, type AgentRequest } from "./fiaon-agent";
import {
  buchungAnwenden, freieSlots, stornoLink, terminAbsagen, terminBuchen,
  terminTokenPruefen, verfuegbarkeitSetzen, verfuegbarkeitVon,
  berlinDatumText, berlinUhrzeit, TerminFehler,
  HORIZONT_TAGE, SLOT_MINUTEN, VORLAUF_STUNDEN,
} from "../lib/fiaon-termine";
import { versendenUndProtokollieren } from "../lib/fiaon-mail-log";

const router = Router();

// ───────────────────────────────────────────────────────────────────────────
// Gemeinsam: Bestätigungsmail nach einer Buchung
// ───────────────────────────────────────────────────────────────────────────
async function bestaetigungSenden(buchung: Awaited<ReturnType<typeof terminBuchen>>): Promise<void> {
  const [p] = (await sqlPool`
    SELECT COALESCE(NULLIF(p.first_name, ''), p.contact_name) AS vorname, p.last_name AS nachname,
           COALESCE(NULLIF(p.primary_email, ''), (
             SELECT NULLIF(COALESCE(a.email, a.contact_email, a.billing_email), '')
             FROM fiaon_applications a
             WHERE a.person_id = p.id AND a.merged_into IS NULL AND a.gdpr_deleted_at IS NULL
             ORDER BY a.created_at DESC LIMIT 1
           )) AS email,
           (SELECT a2.ref FROM fiaon_applications a2
             WHERE a2.person_id = p.id AND a2.merged_into IS NULL AND a2.archived_at IS NULL
             ORDER BY a2.created_at DESC LIMIT 1) AS ref
    FROM fiaon_persons p WHERE p.id = ${buchung.personId}
  `) as any[];
  if (!p) return;
  await versendenUndProtokollieren(
    "termin_bestaetigung",
    {
      email: String(p.email || ""),
      vorname: p.vorname || null,
      nachname: p.nachname || null,
      agent_vorname: buchung.agentVorname,
      termin_datum: buchung.datumText,
      termin_uhrzeit: buchung.uhrzeit,
      storno_link: stornoLink(buchung.stornoToken),
    },
    {
      personId: buchung.personId,
      verlaufRef: p.ref || null,
      verlaufText: `Terminbestätigung versandt (${buchung.datumText} um ${buchung.uhrzeit} Uhr).`,
    },
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// ÖFFENTLICH — kein Login
// ═══════════════════════════════════════════════════════════════════════════

/** GET /termin/:token — freie Slots für diese Person. */
router.get("/termin/:token", async (req: Request, res: Response) => {
  try {
    const geprueft = terminTokenPruefen(req.params.token);
    if (!geprueft) return res.status(404).json({ ok: false, error: "Dieser Link ist ungültig." });
    if (geprueft.abgelaufen) {
      return res.status(410).json({ ok: false, error: "abgelaufen", hinweis: "Dieser Link ist nicht mehr gültig. Ihr Ansprechpartner meldet sich bei Ihnen." });
    }

    const [person] = (await sqlPool`
      SELECT p.id, COALESCE(NULLIF(p.first_name, ''), p.contact_name) AS vorname,
             p.is_blocked, p.merged_into_person_id
      FROM fiaon_persons p WHERE p.id = ${geprueft.personId}
    `) as any[];
    if (!person || person.merged_into_person_id) {
      return res.status(404).json({ ok: false, error: "Dieser Link ist ungültig." });
    }

    // Schon einen Termin? Dann zeigt die Seite ihn statt einer neuen Auswahl.
    const [bestehend] = (await sqlPool`
      SELECT t.id, t.beginn, t.storno_token,
             COALESCE(NULLIF(ag.first_name, ''), ag.name) AS agent_vorname
      FROM fiaon_termine t LEFT JOIN fiaon_agents ag ON ag.id = t.agent_id
      WHERE t.person_id = ${person.id} AND t.status = 'gebucht' AND t.beginn > NOW()
      ORDER BY t.beginn ASC LIMIT 1
    `) as any[];

    const auskunft = await freieSlots(person.id);
    res.json({
      ok: true,
      vorname: person.vorname || null,
      betreuer: auskunft.betreuer,
      slotMinuten: SLOT_MINUTEN,
      vorlaufStunden: VORLAUF_STUNDEN,
      horizontTage: HORIZONT_TAGE,
      termin: bestehend
        ? {
            beginn: bestehend.beginn,
            datumText: berlinDatumText(bestehend.beginn),
            uhrzeit: berlinUhrzeit(bestehend.beginn),
            agentVorname: bestehend.agent_vorname,
            stornoToken: bestehend.storno_token,
          }
        : null,
      slots: auskunft.slots,
    });
  } catch (err) {
    console.error("[TERMIN] slots:", err);
    res.status(500).json({ ok: false, error: "Serverfehler" });
  }
});

/** POST /termin/:token/buchen — der Kunde bucht. */
router.post("/termin/:token/buchen", async (req: Request, res: Response) => {
  try {
    const geprueft = terminTokenPruefen(req.params.token);
    if (!geprueft || geprueft.abgelaufen) {
      return res.status(404).json({ ok: false, error: "Dieser Link ist ungültig oder abgelaufen." });
    }
    const { beginn, agentId, quelle } = req.body || {};
    if (!beginn || !agentId) return res.status(400).json({ ok: false, error: "Bitte einen Termin auswählen." });

    // Der Kunde darf nur Slots buchen, die ihm auch angeboten wurden — sonst
    // ließe sich der Besitzschutz umgehen, indem man einen fremden Agenten
    // in die Anfrage schreibt.
    const auskunft = await freieSlots(geprueft.personId);
    const erlaubt = auskunft.slots.some(
      (s) => s.beginn === new Date(beginn).toISOString() && s.agentId === Number(agentId),
    );
    if (!erlaubt) {
      return res.status(409).json({ ok: false, error: "Dieser Termin ist nicht mehr frei. Bitte wählen Sie einen anderen." });
    }

    const buchung = await terminBuchen({
      personId: geprueft.personId,
      agentId: Number(agentId),
      beginn: String(beginn),
      quelle: quelle === "onboarding" ? "onboarding" : "nichterreicht_mail",
    });
    await buchungAnwenden(buchung);
    await bestaetigungSenden(buchung);

    res.json({
      ok: true,
      termin: {
        datumText: buchung.datumText, uhrzeit: buchung.uhrzeit,
        agentVorname: buchung.agentVorname, stornoToken: buchung.stornoToken,
      },
    });
  } catch (err) {
    if (err instanceof TerminFehler) return res.status(409).json({ ok: false, error: err.message, code: err.code });
    console.error("[TERMIN] buchen:", err);
    res.status(500).json({ ok: false, error: "Serverfehler" });
  }
});

/** POST /termin/absagen/:stornoToken — Absage durch den Kunden. */
router.post("/termin/absagen/:stornoToken", async (req: Request, res: Response) => {
  try {
    const token = String(req.params.stornoToken || "");
    // Kein Format-Rätsel: Ein Storno-Token ist 48 Hex-Zeichen. Alles andere
    // spart der Datenbank die Anfrage.
    if (!/^[0-9a-f]{48}$/.test(token)) {
      return res.status(404).json({ ok: false, error: "Dieser Absage-Link ist ungültig." });
    }
    const ergebnis = await terminAbsagen(token, "kunde");
    if (!ergebnis.ok) {
      return res.status(404).json({ ok: false, error: "Dieser Termin wurde bereits abgesagt oder liegt zurück." });
    }
    // Umbuchen = absagen und neu buchen. Der frische Link kommt gleich mit,
    // damit der Kunde nicht in einer Sackgasse steht.
    const { terminLink } = await import("../lib/fiaon-termine");
    res.json({ ok: true, neuBuchen: terminLink(Number(ergebnis.termin.person_id)) });
  } catch (err) {
    console.error("[TERMIN] absagen:", err);
    res.status(500).json({ ok: false, error: "Serverfehler" });
  }
});

/**
 * GET /termin/onboarding/:paymentRef — Buchungs-Token nach Antragsabschluss.
 *
 * Die Bestätigungsseite kennt nur die Zahlungsreferenz, nicht die Person. Statt
 * dort ein Token zu erzeugen (was jeder mit einer fremden Referenz könnte),
 * liefert der Server es — und nur für Bestellungen, die es wirklich gibt.
 */
router.get("/termin/onboarding/:paymentRef", async (req: Request, res: Response) => {
  try {
    const [row] = (await sqlPool`
      SELECT a.person_id FROM fiaon_applications a
      WHERE (a.payment_reference = ${req.params.paymentRef} OR a.ref = ${req.params.paymentRef})
        AND a.merged_into IS NULL AND a.gdpr_deleted_at IS NULL
      ORDER BY a.created_at DESC LIMIT 1
    `) as any[];
    if (!row?.person_id) return res.json({ ok: true, token: null });
    const { terminTokenErzeugen } = await import("../lib/fiaon-termine");
    res.json({ ok: true, token: terminTokenErzeugen(Number(row.person_id)) });
  } catch (err) {
    console.error("[TERMIN] onboarding:", err);
    res.status(500).json({ ok: false, error: "Serverfehler" });
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// AGENT
// ═══════════════════════════════════════════════════════════════════════════

/** GET /agent/termine — die eigenen Termine (heute und die nächsten Tage). */
router.get("/agent/termine", requireAgent, async (req: AgentRequest, res: Response) => {
  try {
    const rows = (await sqlPool`
      SELECT t.id, t.person_id, t.beginn, t.dauer_min, t.status, t.quelle, t.notiz,
             COALESCE(NULLIF(TRIM(CONCAT_WS(' ', p.first_name, p.last_name)), ''),
                      p.company_name, p.contact_name, p.primary_email) AS name,
             p.primary_phone, p.priority_tier, p.tier_reason
      FROM fiaon_termine t
      JOIN fiaon_persons p ON p.id = t.person_id
      WHERE t.agent_id = ${req.agent!.id} AND p.merged_into_person_id IS NULL
        AND t.status IN ('gebucht', 'verpasst')
        AND t.beginn > NOW() - INTERVAL '14 days'
      ORDER BY t.beginn ASC
      LIMIT 200
    `) as any[];
    res.json({
      ok: true,
      termine: rows.map((t) => ({
        id: Number(t.id),
        personId: Number(t.person_id),
        name: t.name,
        telefon: t.primary_phone,
        beginn: t.beginn,
        datumText: berlinDatumText(t.beginn),
        uhrzeit: berlinUhrzeit(t.beginn),
        dauerMin: Number(t.dauer_min),
        status: t.status,
        quelle: t.quelle,
        notiz: t.notiz,
        tier: Number(t.priority_tier),
        tierGrund: t.tier_reason,
        heute: berlinDatumText(t.beginn) === berlinDatumText(new Date()),
      })),
    });
  } catch (err) {
    console.error("[TERMIN] agent liste:", err);
    res.status(500).json({ ok: false, error: "Serverfehler" });
  }
});

/**
 * POST /agent/termine/:id/ergebnis — erledigt oder nicht erschienen.
 *
 * „Nicht erschienen" zählt wie ein erfolgloser Anrufversuch: Der Kunde hat
 * einen Termin ausgemacht und ist nicht drangegangen — das ist dasselbe
 * Signal, und es muss in denselben Zähler. Sonst könnte jemand zehn Termine
 * platzen lassen, ohne dass die Automatik es je bemerkt.
 */
router.post("/agent/termine/:id/ergebnis", requireAgent, async (req: AgentRequest, res: Response) => {
  try {
    const id = Number(req.params.id);
    const { ergebnis, notiz } = req.body || {};
    if (!["erledigt", "verpasst"].includes(String(ergebnis))) {
      return res.status(400).json({ ok: false, error: "Ergebnis muss 'erledigt' oder 'verpasst' sein." });
    }
    const [termin] = (await sqlPool`
      SELECT id, person_id, beginn FROM fiaon_termine
      WHERE id = ${id} AND agent_id = ${req.agent!.id} AND status = 'gebucht'
    `) as any[];
    if (!termin) return res.status(404).json({ ok: false, error: "Termin nicht gefunden." });

    await sqlPool`
      UPDATE fiaon_termine SET status = ${String(ergebnis)}, erledigt_am = NOW(),
             notiz = ${notiz ? String(notiz).slice(0, 4000) : null}, updated_at = NOW()
      WHERE id = ${id}
    `;

    let hinweis = "Termin als erledigt vermerkt.";
    if (ergebnis === "verpasst") {
      await sqlPool`
        UPDATE fiaon_persons SET unreachable_count = unreachable_count + 1, updated_at = NOW()
        WHERE id = ${termin.person_id}
      `;
      const { automatikNachFehlversuch } = await import("../lib/fiaon-nicht-erreicht");
      const wirkung = await automatikNachFehlversuch(Number(termin.person_id));
      hinweis = `Nicht erschienen — zählt als erfolgloser Versuch.${wirkung.hinweis ? ` ${wirkung.hinweis}` : ""}`;
    } else {
      const { erreichtZuruecksetzen } = await import("../lib/fiaon-nicht-erreicht");
      await erreichtZuruecksetzen(Number(termin.person_id));
    }

    const [ref] = (await sqlPool`
      SELECT ref FROM fiaon_applications
      WHERE person_id = ${termin.person_id} AND merged_into IS NULL AND archived_at IS NULL
      ORDER BY created_at DESC LIMIT 1
    `) as any[];
    if (ref) {
      await sqlPool`
        INSERT INTO fiaon_contact_log (ref, agent_id, agent_name, type, note, created_at)
        VALUES (${ref.ref}, ${req.agent!.id}, ${req.agent!.name}, 'system',
                ${`Termin ${berlinDatumText(termin.beginn)} um ${berlinUhrzeit(termin.beginn)} Uhr: ${ergebnis === "erledigt" ? "erledigt" : "Kunde nicht erschienen"}.${notiz ? ` ${String(notiz).slice(0, 500)}` : ""}`},
                NOW())
      `.catch(() => {});
    }
    res.json({ ok: true, hinweis });
  } catch (err) {
    console.error("[TERMIN] ergebnis:", err);
    res.status(500).json({ ok: false, error: "Serverfehler" });
  }
});

/** POST /agent/termine — der Agent legt selbst einen Termin an. */
router.post("/agent/termine", requireAgent, async (req: AgentRequest, res: Response) => {
  try {
    const { personId, beginn } = req.body || {};
    if (!personId || !beginn) return res.status(400).json({ ok: false, error: "Kunde und Zeitpunkt fehlen." });

    // Nur eigene Kunden. Ein Termin bei einem fremden Kunden wäre eine
    // Zuständigkeitsübernahme durch die Hintertür.
    const [person] = (await sqlPool`
      SELECT id, assigned_agent_id FROM fiaon_persons
      WHERE id = ${Number(personId)} AND merged_into_person_id IS NULL
    `) as any[];
    if (!person) return res.status(404).json({ ok: false, error: "Kunde nicht gefunden." });
    if (person.assigned_agent_id && Number(person.assigned_agent_id) !== req.agent!.id) {
      return res.status(403).json({ ok: false, error: "Dieser Kunde wird von einem Kollegen betreut." });
    }

    const buchung = await terminBuchen({
      personId: Number(personId), agentId: req.agent!.id,
      beginn: String(beginn), quelle: "agent_manuell",
    });
    await buchungAnwenden(buchung);
    await bestaetigungSenden(buchung);
    res.json({ ok: true, termin: { datumText: buchung.datumText, uhrzeit: buchung.uhrzeit } });
  } catch (err) {
    if (err instanceof TerminFehler) return res.status(409).json({ ok: false, error: err.message, code: err.code });
    console.error("[TERMIN] agent buchen:", err);
    res.status(500).json({ ok: false, error: "Serverfehler" });
  }
});

/** POST /agent/termine/:id/absagen */
router.post("/agent/termine/:id/absagen", requireAgent, async (req: AgentRequest, res: Response) => {
  try {
    const [termin] = (await sqlPool`
      SELECT storno_token FROM fiaon_termine
      WHERE id = ${Number(req.params.id)} AND agent_id = ${req.agent!.id} AND status = 'gebucht'
    `) as any[];
    if (!termin?.storno_token) return res.status(404).json({ ok: false, error: "Termin nicht gefunden." });
    await terminAbsagen(String(termin.storno_token), "agent");
    res.json({ ok: true });
  } catch (err) {
    console.error("[TERMIN] agent absagen:", err);
    res.status(500).json({ ok: false, error: "Serverfehler" });
  }
});

/** GET /agent/verfuegbarkeit — die eigenen Zeiten. */
router.get("/agent/verfuegbarkeit", requireAgent, async (req: AgentRequest, res: Response) => {
  try {
    const [eigene] = (await sqlPool`
      SELECT COUNT(*)::int AS n FROM fiaon_agent_verfuegbarkeit WHERE agent_id = ${req.agent!.id}
    `) as any[];
    res.json({
      ok: true,
      fenster: await verfuegbarkeitVon(req.agent!.id),
      vorgabe: Number(eigene.n) === 0,
      slotMinuten: SLOT_MINUTEN,
    });
  } catch (err) {
    console.error("[TERMIN] verfuegbarkeit:", err);
    res.status(500).json({ ok: false, error: "Serverfehler" });
  }
});

/** PUT /agent/verfuegbarkeit — eigene Zeiten setzen. */
router.put("/agent/verfuegbarkeit", requireAgent, async (req: AgentRequest, res: Response) => {
  try {
    const fenster = Array.isArray(req.body?.fenster) ? req.body.fenster : [];
    // Die Klammer liegt hier, nicht in der Bibliothek: Löschen und Neuschreiben
    // müssen zusammen gelingen, sonst stünde ein Agent kurz ohne Zeiten da.
    await sqlPool.begin(async (tx) => { await verfuegbarkeitSetzen(req.agent!.id, fenster, tx as any); });
    res.json({ ok: true, fenster: await verfuegbarkeitVon(req.agent!.id) });
  } catch (err) {
    console.error("[TERMIN] verfuegbarkeit setzen:", err);
    res.status(500).json({ ok: false, error: "Serverfehler" });
  }
});

/**
 * PUT /vertrieb/verfuegbarkeit — die Vertriebsleitung setzt die Zeiten für alle.
 *
 * Bewusst „für alle, die noch nichts Eigenes haben" plus ausdrücklich
 * überschreibbar: Sonst würde ein gut gemeinter Klick die individuellen Zeiten
 * von vier Leuten wortlos plattmachen.
 */
router.put("/vertrieb/verfuegbarkeit", requireAgent, async (req: AgentRequest, res: Response) => {
  try {
    const [ich] = (await sqlPool`SELECT rolle FROM fiaon_agents WHERE id = ${req.agent!.id}`) as any[];
    if (String(ich?.rolle) !== "vertriebsleiter") {
      return res.status(403).json({ ok: false, error: "Nur die Vertriebsleitung darf Teamzeiten setzen." });
    }
    const fenster = Array.isArray(req.body?.fenster) ? req.body.fenster : [];
    const auchUeberschreiben = req.body?.auchUeberschreiben === true;

    const agenten = (await sqlPool`
      SELECT a.id FROM fiaon_agents a
      WHERE a.active AND NOT a.is_test_account
        AND (${auchUeberschreiben}::boolean
             OR NOT EXISTS (SELECT 1 FROM fiaon_agent_verfuegbarkeit v WHERE v.agent_id = a.id))
    `) as any[];
    await sqlPool.begin(async (tx) => {
      for (const a of agenten) await verfuegbarkeitSetzen(Number(a.id), fenster, tx as any);
    });
    res.json({ ok: true, gesetzt: agenten.length });
  } catch (err) {
    console.error("[TERMIN] team verfuegbarkeit:", err);
    res.status(500).json({ ok: false, error: "Serverfehler" });
  }
});

export default router;
