// ═══════════════════════════════════════════════════════════════════════════
// TELEFONIE, DOKUMENTE, GESPRÄCHSBLATT — Routen
//
// Die Regeln stehen in den Bibliotheken. Hier steht, wer was darf — und die
// Twilio-Rückrufe, die von außen kommen.
// ═══════════════════════════════════════════════════════════════════════════

import { Router, type Request, type Response } from "express";
import { sqlPool } from "../lib/db-pool";
import { requireAgent, type AgentRequest } from "./fiaon-agent";
import { ensureRolleSpalte } from "./fiaon-vertrieb";
import {
  ansageText, einrichtungsStand, MAX_MINUTEN, offeneAnrufe, telefonBereit,
  twimlAusgehend, wahlProtokoll, wahlPruefen, zugangsAusweis,
} from "../lib/fiaon-softphone";
import { dokumentInhalt, dokumentStand, istDokumentArt } from "../lib/fiaon-dokumente";
import { gespraechsblatt } from "../lib/fiaon-gespraechsblatt";
import { anrufNachbereiten } from "../lib/fiaon-transkript";
import { ergebnisAnwenden, istErgebnis } from "../lib/fiaon-kontakt-ergebnis";
import { absoluteUrl } from "../fiaon-base-url";

const router = Router();

async function rolleVon(agentId: number): Promise<string> {
  await ensureRolleSpalte();
  const [a] = (await sqlPool`
    SELECT rolle, is_test_account FROM fiaon_agents WHERE id = ${agentId} AND active
  `) as any[];
  return String(a?.rolle || "agent");
}

/**
 * Darf dieses Konto NICHT telefonieren?
 *
 * ── ATTRAPPE ODER PRÜFKONTO (11.08.2026) ───────────────────────────────────
 * Eine Attrappe (`is_test_account`) hat keinen Menschen dahinter — sie darf
 * nicht wählen, weil am anderen Ende ein echter Kunde abhebt und ins Leere
 * spricht.
 *
 * Das PRÜFKONTO des Betreibers hat sehr wohl einen Menschen dahinter. Es
 * trägt beide Merkmale, und bis heute gewann das falsche: Der Betreiber
 * konnte über sein eigenes Konto nicht telefonieren.
 *
 * Die Regel ist nicht „ist es als Test markiert", sondern „sitzt jemand da".
 */
async function istTestkonto(agentId: number): Promise<boolean> {
  const [a] = (await sqlPool`
    SELECT is_test_account, pruefkonto FROM fiaon_agents WHERE id = ${agentId}
  `) as any[];
  return !!a?.is_test_account && !a?.pruefkonto;
}

/** Darf dieser Mensch diesen Kunden anfassen? Dieselbe Grenze wie beim Mailversand. */
async function darfAnKunde(agentId: number, rolle: string, personId: number): Promise<boolean> {
  if (rolle === "vertriebsleiter" || rolle === "admin") return true;
  if (rolle === "onboarding") {
    const [t] = (await sqlPool`
      SELECT 1 AS ok FROM fiaon_termine
      WHERE person_id = ${personId} AND agent_id = ${agentId} AND quelle = 'onboarding_call' LIMIT 1
    `) as any[];
    return !!t;
  }
  const [p] = (await sqlPool`
    SELECT 1 AS ok FROM fiaon_persons
    WHERE id = ${personId} AND assigned_agent_id = ${agentId} AND merged_into_person_id IS NULL
  `) as any[];
  return !!p;
}

// ═══════════════════════════════════════════════════════════════════════════
// SOFTPHONE
// ═══════════════════════════════════════════════════════════════════════════

/** GET /telefon/stand — was die Oberfläche wissen muss, bevor sie etwas zeigt. */
router.get("/telefon/stand", requireAgent, async (req: AgentRequest, res: Response) => {
  try {
    const stand = einrichtungsStand();
    res.json({
      ok: true,
      ...stand,
      // Die Liste der fehlenden Werte geht NUR an den Betreiber. Ein
      // Teammitglied braucht die Namen von Umgebungsvariablen nicht.
      fehlend: [],
      maxMinuten: MAX_MINUTEN,
      offene: await offeneAnrufe(req.agent!.id),
      testkonto: await istTestkonto(req.agent!.id),
    });
  } catch (err) {
    console.error("[TELEFON] stand:", err);
    res.status(500).json({ ok: false, error: "Serverfehler" });
  }
});

/** GET /admin/telefon/einrichtung — die Karte in den Einstellungen. */
router.get("/admin/telefon/einrichtung", async (_req: Request, res: Response) => {
  try {
    res.json({ ok: true, ...einrichtungsStand(), ansage: await ansageText(), maxMinuten: MAX_MINUTEN });
  } catch (err) {
    console.error("[TELEFON] einrichtung:", err);
    res.status(500).json({ ok: false, error: "Serverfehler" });
  }
});

/**
 * POST /telefon/ausweis — der kurzlebige Zugang für das Browser-SDK.
 *
 * Vier Wände, in dieser Reihenfolge: eingerichtet, echte Rolle, kein
 * Testkonto, erlaubte Nummer. Jede Wahl wird protokolliert — auch die
 * abgelehnte, denn genau die will man später sehen.
 */
router.post("/telefon/ausweis", requireAgent, async (req: AgentRequest, res: Response) => {
  try {
    const rolle = await rolleVon(req.agent!.id);
    const nummerRoh = String(req.body?.nummer || "");
    const personId = req.body?.personId ? Number(req.body.personId) : null;

    const ablehnen = async (grund: string, code = 403) => {
      await wahlProtokoll({
        agentId: req.agent!.id, agentName: req.agent!.name, nummer: nummerRoh,
        personId, erlaubt: false, grund,
      });
      return res.status(code).json({ ok: false, error: grund });
    };

    if (!telefonBereit()) return ablehnen(einrichtungsStand().hinweis, 503);
    if (await istTestkonto(req.agent!.id)) {
      return ablehnen("Testkonten können nicht telefonieren.");
    }
    if (!["agent", "vertriebsleiter", "onboarding"].includes(rolle)) {
      return ablehnen("Deine Rolle darf nicht telefonieren.");
    }
    const pruefung = await wahlPruefen(nummerRoh);
    if (!pruefung.erlaubt) return ablehnen(pruefung.grund!, 400);
    if (personId && !(await darfAnKunde(req.agent!.id, rolle, personId))) {
      return ablehnen("Dieser Kunde wird von jemand anderem betreut.");
    }

    const ausweis = await zugangsAusweis(req.agent!.id);
    if (!ausweis.ok) return ablehnen(ausweis.grund!, 503);

    await wahlProtokoll({
      agentId: req.agent!.id, agentName: req.agent!.name, nummer: pruefung.nummer!,
      personId, erlaubt: true, grund: null,
    });
    // Der Anruf-Datensatz entsteht JETZT, nicht erst beim Rückruf von Twilio:
    // Bricht die Verbindung ab, bevor Twilio sich meldet, gäbe es sonst gar
    // keine Spur — und die Ergebnis-Pflicht liefe ins Leere.
    const [c] = (await sqlPool`
      INSERT INTO fiaon_calls (person_id, ref, agent_id, nummer, status)
      VALUES (${personId}, ${req.body?.ref ?? null}, ${req.agent!.id}, ${pruefung.nummer!}, 'gewaehlt')
      RETURNING id
    `) as any[];

    res.json({
      ok: true, token: ausweis.token, identitaet: ausweis.identitaet,
      nummer: pruefung.nummer, callId: Number(c.id), maxMinuten: MAX_MINUTEN,
    });
  } catch (err) {
    console.error("[TELEFON] ausweis:", err);
    res.status(500).json({ ok: false, error: "Serverfehler" });
  }
});

/**
 * POST /telefon/twiml — Twilio fragt, was zu tun ist.
 *
 * Kommt von außen. Deshalb wird die Nummer HIER noch einmal geprüft: Wer den
 * Ausweis abgreift, könnte sonst eine beliebige Nummer wählen.
 */
router.post("/telefon/twiml", async (req: Request, res: Response) => {
  try {
    const an = String((req.body as any)?.An || (req.body as any)?.To || "");
    const pruefung = await wahlPruefen(an);
    res.type("text/xml");
    if (!pruefung.erlaubt) {
      return res.send(`<?xml version="1.0" encoding="UTF-8"?>
<Response><Say language="de-DE">Diese Nummer darf nicht gewählt werden.</Say><Hangup/></Response>`);
    }
    res.send(twimlAusgehend({
      an: pruefung.nummer!,
      von: process.env.TWILIO_CALLER_ID || "",
      ansage: await ansageText(),
      aufnahmeCallback: absoluteUrl("/api/fiaon/telefon/aufnahme"),
      statusCallback: absoluteUrl("/api/fiaon/telefon/status"),
    }));
  } catch (err) {
    console.error("[TELEFON] twiml:", err);
    res.type("text/xml").send(`<?xml version="1.0" encoding="UTF-8"?>
<Response><Say language="de-DE">Es ist ein Fehler aufgetreten.</Say><Hangup/></Response>`);
  }
});

/** POST /telefon/status — Twilio meldet Ende und Dauer. */
router.post("/telefon/status", async (req: Request, res: Response) => {
  try {
    const b = req.body as any;
    const sid = String(b?.CallSid || "");
    const dauer = Number(b?.DialCallDuration ?? b?.CallDuration ?? 0);
    const status = String(b?.DialCallStatus || b?.CallStatus || "");
    if (sid) {
      await sqlPool`
        UPDATE fiaon_calls
        SET twilio_sid = COALESCE(twilio_sid, ${sid}),
            ende = NOW(), dauer_sek = ${dauer || null},
            status = ${status === "completed" ? "beendet" : status === "no-answer" || status === "busy" ? "abgelehnt" : "fehlgeschlagen"},
            updated_at = NOW()
        WHERE twilio_sid = ${sid}
           OR id = (SELECT id FROM fiaon_calls WHERE twilio_sid IS NULL AND status = 'gewaehlt'
                     ORDER BY beginn DESC LIMIT 1)
      `;
    }
    res.type("text/xml").send('<?xml version="1.0" encoding="UTF-8"?><Response/>');
  } catch (err) {
    console.error("[TELEFON] status:", err);
    res.type("text/xml").send('<?xml version="1.0" encoding="UTF-8"?><Response/>');
  }
});

/** POST /telefon/aufnahme — Twilio meldet die fertige Aufnahme. */
router.post("/telefon/aufnahme", async (req: Request, res: Response) => {
  try {
    const b = req.body as any;
    const sid = String(b?.CallSid || "");
    const url = String(b?.RecordingUrl || "");
    if (sid && url) {
      const [c] = (await sqlPool`
        UPDATE fiaon_calls
        SET recording_url = ${`${url}.mp3`}, recording_sid = ${String(b?.RecordingSid || "")},
            dauer_sek = COALESCE(dauer_sek, ${Number(b?.RecordingDuration ?? 0) || null}),
            updated_at = NOW()
        WHERE twilio_sid = ${sid}
        RETURNING id
      `) as any[];
      // Nachbereitung im Hintergrund: Der Rückruf von Twilio darf nicht
      // minutenlang offen bleiben, sonst wiederholt Twilio ihn.
      if (c) {
        void anrufNachbereiten(Number(c.id)).catch((e) =>
          console.error("[TELEFON] Nachbereitung:", e));
      }
    }
    res.json({ ok: true });
  } catch (err) {
    console.error("[TELEFON] aufnahme:", err);
    res.json({ ok: true });
  }
});

/**
 * POST /telefon/:id/ergebnis — das Gespräch dokumentieren.
 *
 * Läuft durch `ergebnisAnwenden` — denselben Weg wie der Handeintrag in der
 * Kundenliste. Kein zweiter Weg, der eines Tages anders rechnet.
 */
router.post("/telefon/:id/ergebnis", requireAgent, async (req: AgentRequest, res: Response) => {
  try {
    const id = Number(req.params.id);
    const ergebnis = String(req.body?.ergebnis || "");
    if (!istErgebnis(ergebnis)) return res.status(400).json({ ok: false, error: "Unbekanntes Ergebnis." });

    const [c] = (await sqlPool`
      SELECT id, person_id, ref, agent_id FROM fiaon_calls WHERE id = ${id}
    `) as any[];
    if (!c) return res.status(404).json({ ok: false, error: "Anruf nicht gefunden." });
    if (Number(c.agent_id) !== req.agent!.id) {
      return res.status(403).json({ ok: false, error: "Das ist nicht dein Anruf." });
    }

    let ref = c.ref as string | null;
    if (!ref && c.person_id) {
      const [a] = (await sqlPool`
        SELECT ref FROM fiaon_applications
        WHERE person_id = ${c.person_id} AND merged_into IS NULL AND archived_at IS NULL
        ORDER BY created_at DESC LIMIT 1
      `) as any[];
      ref = a?.ref ?? null;
    }

    const wirkung = c.person_id || ref
      ? await ergebnisAnwenden({
          ref, personId: c.person_id ?? null, ergebnis: ergebnis as any,
          zusageDatum: req.body?.zusageDatum || null,
          terminDatum: req.body?.terminDatum || null,
        })
      : { meldung: "Ergebnis festgehalten.", wiedervorlage: null, zusage: null, gesperrt: false };

    await sqlPool`
      UPDATE fiaon_calls SET ergebnis = ${ergebnis}, ergebnis_am = NOW(), updated_at = NOW()
      WHERE id = ${id}
    `;
    res.json({ ok: true, ...wirkung, offene: await offeneAnrufe(req.agent!.id) });
  } catch (err) {
    console.error("[TELEFON] ergebnis:", err);
    res.status(500).json({ ok: false, error: "Serverfehler" });
  }
});

/** GET /telefon/person/:personId/anrufe — für die Akte. */
router.get("/telefon/person/:personId/anrufe", requireAgent, async (req: AgentRequest, res: Response) => {
  try {
    const personId = Number(req.params.personId);
    const rolle = await rolleVon(req.agent!.id);
    if (!(await darfAnKunde(req.agent!.id, rolle, personId))) {
      return res.status(403).json({ ok: false, error: "Nicht dein Kunde." });
    }
    res.json({
      ok: true,
      anrufe: await sqlPool`
        SELECT c.id, c.nummer, c.beginn, c.dauer_sek, c.status, c.ergebnis, c.ergebnis_am,
               c.transkript_status, c.transkript_grund, c.zusammenfassung,
               (c.transkript IS NOT NULL) AS hat_transkript,
               COALESCE(NULLIF(a.first_name, ''), a.name) AS agent
        FROM fiaon_calls c LEFT JOIN fiaon_agents a ON a.id = c.agent_id
        WHERE c.person_id = ${personId}
        ORDER BY c.beginn DESC LIMIT 50
      `,
    });
  } catch (err) {
    console.error("[TELEFON] anrufe:", err);
    res.status(500).json({ ok: false, error: "Serverfehler" });
  }
});

/** POST /telefon/:id/nachbereiten — Transkript nachholen. */
router.post("/telefon/:id/nachbereiten", requireAgent, async (req: AgentRequest, res: Response) => {
  try {
    const erg = await anrufNachbereiten(Number(req.params.id));
    res.json({ ok: erg.ok, grund: erg.grund ?? null });
  } catch (err) {
    console.error("[TELEFON] nachbereiten:", err);
    res.status(500).json({ ok: false, error: "Serverfehler" });
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// DOKUMENTE
// ═══════════════════════════════════════════════════════════════════════════

/** GET /dokumente/:personId — der Stand. Für alle Rollen; Inhalte nicht. */
router.get("/dokumente/:personId", requireAgent, async (req: AgentRequest, res: Response) => {
  try {
    const personId = Number(req.params.personId);
    const rolle = await rolleVon(req.agent!.id);
    if (!(await darfAnKunde(req.agent!.id, rolle, personId))) {
      return res.status(403).json({ ok: false, error: "Nicht dein Kunde." });
    }
    const stand = await dokumentStand({ personId, rolle }, sqlPool);
    if (!stand) return res.json({ ok: true, stand: null });
    res.json({ ok: true, stand });
  } catch (err) {
    console.error("[DOK] stand:", err);
    res.status(500).json({ ok: false, error: "Serverfehler" });
  }
});

/** GET /admin/dokumente/:ref — Betreiberansicht mit Inhalten. */
router.get("/admin/dokumente/:ref", async (req: Request, res: Response) => {
  try {
    const stand = await dokumentStand({ ref: String(req.params.ref), rolle: "admin" }, sqlPool);
    res.json({ ok: true, stand });
  } catch (err) {
    console.error("[DOK] admin stand:", err);
    res.status(500).json({ ok: false, error: "Serverfehler" });
  }
});

/**
 * GET /admin/dokumente/:ref/:art/datei — der Inhalt.
 *
 * Hinter dem Admin-Code-Gate. Die Rollenprüfung steckt zusätzlich in
 * `dokumentInhalt` — eine Route, die man versehentlich woanders mountet,
 * gibt trotzdem nichts heraus.
 */
router.get("/admin/dokumente/:ref/:art/datei", async (req: Request, res: Response) => {
  try {
    const art = String(req.params.art);
    if (!istDokumentArt(art)) return res.status(400).json({ ok: false, error: "Unbekannte Dokumentart." });
    const erg = await dokumentInhalt(String(req.params.ref), art, "admin");
    if (!erg.ok) return res.status(erg.code).json({ ok: false, error: erg.grund });
    res.setHeader("Content-Type", erg.typ);
    res.setHeader("Content-Disposition", `inline; filename="${req.params.ref}-${art}"`);
    // Kein Zwischenspeicher: Ein Ausweis hat in keinem Proxy etwas verloren.
    res.setHeader("Cache-Control", "no-store, private");
    res.send(erg.daten);
  } catch (err) {
    console.error("[DOK] datei:", err);
    res.status(500).json({ ok: false, error: "Serverfehler" });
  }
});

/**
 * GET /agent/dokumente/:personId/:art/datei — für Team und Leitung.
 *
 * Antwortet ausdrücklich mit 403 und dem Wortlaut aus der
 * Verpflichtungserklärung. Bis heute stand diese Grenze NUR im Text der
 * Erklärung; jetzt steht sie im Code.
 */
router.get("/agent/dokumente/:personId/:art/datei", requireAgent, async (req: AgentRequest, res: Response) => {
  try {
    const art = String(req.params.art);
    if (!istDokumentArt(art)) return res.status(400).json({ ok: false, error: "Unbekannte Dokumentart." });
    const rolle = await rolleVon(req.agent!.id);
    const [p] = (await sqlPool`
      SELECT ref FROM fiaon_applications
      WHERE person_id = ${Number(req.params.personId)} AND merged_into IS NULL
      ORDER BY created_at DESC LIMIT 1
    `) as any[];
    if (!p) return res.status(404).json({ ok: false, error: "Keine Bestellung gefunden." });
    const erg = await dokumentInhalt(String(p.ref), art, rolle);
    if (!erg.ok) return res.status(erg.code).json({ ok: false, error: erg.grund });
    res.setHeader("Content-Type", erg.typ);
    res.setHeader("Cache-Control", "no-store, private");
    res.send(erg.daten);
  } catch (err) {
    console.error("[DOK] agent datei:", err);
    res.status(500).json({ ok: false, error: "Serverfehler" });
  }
});

/** POST /dokumente/:personId/anfordern — über die Registry, mit Zustandsprüfung. */
router.post("/dokumente/:personId/anfordern", requireAgent, async (req: AgentRequest, res: Response) => {
  try {
    const personId = Number(req.params.personId);
    const rolle = await rolleVon(req.agent!.id);
    if (!(await darfAnKunde(req.agent!.id, rolle, personId))) {
      return res.status(403).json({ ok: false, error: "Nicht dein Kunde." });
    }
    const art = String(req.body?.art || "");
    // Zwei Ereignisse aus der bestehenden Registry — keine neuen erfinden.
    const event = art === "schufa" ? "schufa_requested" : "documents_change_request";
    const { mailSenden } = await import("../lib/fiaon-mail-senden");
    const erg = await mailSenden({
      event, personId,
      zusatz: req.body?.notiz ? { grund: String(req.body.notiz) } : {},
      akteur: { name: req.agent!.name, agentId: req.agent!.id, rolle: rolle as any },
    });
    res.json(erg);
  } catch (err) {
    console.error("[DOK] anfordern:", err);
    res.status(500).json({ ok: false, error: "Serverfehler" });
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// GESPRÄCHSBLATT
// ═══════════════════════════════════════════════════════════════════════════

router.get("/gespraechsblatt/:personId", requireAgent, async (req: AgentRequest, res: Response) => {
  try {
    const personId = Number(req.params.personId);
    const rolle = await rolleVon(req.agent!.id);
    if (!(await darfAnKunde(req.agent!.id, rolle, personId))) {
      return res.status(403).json({
        ok: false,
        error: "Dieser Kunde wird von jemand anderem betreut — ein Gesprächsblatt gibt es nur zu eigenen Kunden.",
      });
    }
    const blatt = await gespraechsblatt(personId);
    if (!blatt) return res.status(404).json({ ok: false, error: "Person nicht gefunden." });
    await sqlPool`
      INSERT INTO fiaon_gespraechsblatt_log (person_id, agent_id, akteur, aus_cache)
      VALUES (${personId}, ${req.agent!.id}, ${req.agent!.name}, ${blatt.ausCache})
    `.catch(() => {});
    res.json({ ok: true, blatt });
  } catch (err) {
    console.error("[BLATT]", err);
    res.status(500).json({ ok: false, error: "Serverfehler" });
  }
});

export default router;
