// ═══════════════════════════════════════════════════════════════════════════
// TELEFONIE, DOKUMENTE, GESPRÄCHSBLATT — Routen
//
// Die Regeln stehen in den Bibliotheken. Hier steht, wer was darf — und die
// Twilio-Rückrufe, die von außen kommen.
// ═══════════════════════════════════════════════════════════════════════════

import { Router, type Request, type Response } from "express";
import { tageslauf } from "../lib/fiaon-crons";
import { sqlPool } from "../lib/db-pool";
import { requireAgent, type AgentRequest } from "./fiaon-agent";
import { ensureRolleSpalte } from "./fiaon-vertrieb";
import {
  ansageText, aufnahmeFrist, aufnahmenAufraeumen, einrichtungsStand, MAX_MINUTEN, offeneAnrufe, telefonBereit,
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
 * Das PRÜFKONTO des Vorgesetzten hat sehr wohl einen Menschen dahinter. Es
 * trägt beide Merkmale, und bis heute gewann das falsche: Der Vorgesetzte
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
      // Die Liste der fehlenden Werte geht NUR an den Vorgesetzten. Ein
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

    // ── DIE RICHTLINIE IST EINE WAND, KEIN HINWEIS ────────────────────────
    // Serverseitig geprüft, nicht in der Oberfläche versteckt. Wer ein
    // Gespräch ohne Hinweis aufzeichnet, macht sich nach § 201 StGB
    // persönlich strafbar — und FIAON hat die Aufzeichnung eingeschaltet.
    // Ein Knopf, den man in der Konsole umgehen kann, wäre hier keine
    // Absicherung, sondern eine Ausrede.
    const { darfWaehlen } = await import("../lib/fiaon-telefon-zusage");
    const richtlinie = await darfWaehlen(req.agent!.id);
    if (!richtlinie.erlaubt) {
      await wahlProtokoll({
        agentId: req.agent!.id, agentName: req.agent!.name, nummer: nummerRoh,
        personId, erlaubt: false, grund: "Telefon-Richtlinie nicht angenommen",
      });
      return res.status(412).json({
        ok: false, richtlinieOffen: true,
        neufassung: richtlinie.neufassung, error: richtlinie.grund,
      });
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
    const b = req.body as any;
    // Reihenfolge mit Absicht: `An` und `Ziel` sind unsere eigenen, nicht
    // reservierten Namen. `To` steht ganz hinten — Twilio setzt es bei
    // Browser-Anrufen selbst auf die Client-Identität und überschreibt dabei
    // einen gleichnamigen eigenen Parameter. Wer sich darauf verlässt,
    // bekommt eine leere Nummer.
    const an = String(b?.An || b?.Ziel || b?.PhoneNumber || b?.To || "");

    // ── WAS WIRKLICH ANKAM, WIRD AUFGESCHRIEBEN ─────────────────────────
    // Diese Route ist die einzige Stelle, an der man sieht, was Twilio
    // übergibt. Ohne diesen Vermerk bleibt „die To-Spalte ist leer" eine
    // Beobachtung ohne Ursache. Die Diagnose zeigt den letzten Aufruf.
    const { letztenTwimlAufrufMerken } = await import("../lib/fiaon-telefon-diagnose");
    await letztenTwimlAufrufMerken({
      an, roh: Object.fromEntries(
        Object.entries(b ?? {}).filter(([k]) => !/token|secret|signature/i.test(k)),
      ),
    }).catch(() => {});

    const pruefung = await wahlPruefen(an);
    res.type("text/xml");
    if (!pruefung.erlaubt) {
      console.error(`[TELEFON] TwiML ohne wählbare Nummer. Angekommen: ${JSON.stringify(Object.keys(b ?? {}))}`);
      return res.send(`<?xml version="1.0" encoding="UTF-8"?>
<Response><Say language="de-DE">${an
        ? "Diese Nummer darf nicht gewählt werden."
        : "Es wurde keine Rufnummer übergeben. Bitte im Verwaltungsbereich die Telefon-Diagnose öffnen."
      }</Say><Hangup/></Response>`);
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
               c.transkript_status, c.transkript_grund, c.zusammenfassung, c.transkript,
               (c.transkript IS NOT NULL) AS hat_transkript,
               -- Die Twilio-URL selbst kommt NIE ins Frontend: Sie ist ohne
               -- Ablauf gültig und öffnet mit Basic-Auth die Aufnahme. Nach
               -- außen geht nur, OB es eine gibt.
               (c.recording_url IS NOT NULL AND c.aufnahme_geloescht_am IS NULL) AS hat_aufnahme,
               c.aufnahme_geloescht_am, c.ohne_aufzeichnung_am,
               COALESCE(NULLIF(a.first_name, ''), a.name) AS agent
        FROM fiaon_calls c LEFT JOIN fiaon_agents a ON a.id = c.agent_id
        WHERE c.person_id = ${personId}
        ORDER BY c.beginn DESC LIMIT 50
      `,
      // Die Frist muss in der Akte stehen: „Diese Aufnahme wird am 12.11.
      // gelöscht" ist eine Information, „Aufnahmen werden irgendwann
      // gelöscht" ist keine.
      fristTage: await aufnahmeFrist(),
    });
  } catch (err) {
    console.error("[TELEFON] anrufe:", err);
    res.status(500).json({ ok: false, error: "Serverfehler" });
  }
});

/**
 * GET /telefon/:id/aufnahme — die Aufnahme abspielen.
 *
 * ── WARUM DIE TWILIO-URL NIE INS FRONTEND GEHÖRT ───────────────────────────
 * Sie ist unbefristet gültig und öffnet mit den Konto-Zugangsdaten die
 * Aufnahme eines Kundengesprächs. Wer sie einmal aus dem Netzwerkprotokoll
 * kopiert, kann das Gespräch morgen noch abspielen — auch wenn er längst
 * keinen Zugang mehr hat.
 *
 * Deshalb wird sie hier SERVERSEITIG geholt und der Datenstrom durchgereicht.
 * Die Rechteprüfung sitzt vor dem Abruf, und der Abruf wird protokolliert:
 * Wer ein Gespräch anhört, soll das nachvollziehbar tun.
 */
router.get("/telefon/:id/aufnahme", requireAgent, async (req: AgentRequest, res: Response) => {
  try {
    const id = Number(req.params.id);
    const [c] = (await sqlPool`
      SELECT c.id, c.recording_url, c.person_id, c.agent_id, c.aufnahme_geloescht_am
      FROM fiaon_calls c WHERE c.id = ${id}
    `) as any[];
    if (!c) return res.status(404).json({ ok: false, error: "Anruf nicht gefunden." });
    if (c.aufnahme_geloescht_am) {
      return res.status(410).json({
        ok: false,
        error: "Diese Aufnahme ist nach Ablauf der Aufbewahrungsfrist gelöscht worden.",
      });
    }
    if (!c.recording_url) {
      return res.status(404).json({ ok: false, error: "Zu diesem Anruf gibt es keine Aufnahme." });
    }

    const rolle = await rolleVon(req.agent!.id);
    if (c.person_id && !(await darfAnKunde(req.agent!.id, rolle, Number(c.person_id)))) {
      return res.status(403).json({ ok: false, error: "Nicht dein Kunde." });
    }

    const sid = process.env.TWILIO_ACCOUNT_SID || "";
    const tok = process.env.TWILIO_AUTH_TOKEN || "";
    if (!sid || !tok) {
      return res.status(503).json({ ok: false, error: "Telefonie ist nicht eingerichtet." });
    }
    const quelle = String(c.recording_url).endsWith(".mp3")
      ? String(c.recording_url)
      : `${c.recording_url}.mp3`;
    const r = await fetch(quelle, {
      headers: { Authorization: "Basic " + Buffer.from(`${sid}:${tok}`).toString("base64") },
      signal: AbortSignal.timeout(25_000),
    }).catch(() => null);
    if (!r || !r.ok || !r.body) {
      return res.status(502).json({
        ok: false,
        error: `Die Aufnahme war bei Twilio nicht abrufbar (HTTP ${r?.status ?? "keine Antwort"}).`,
      });
    }

    // Wer hört zu? Das gehört in die Akte.
    await sqlPool`
      INSERT INTO fiaon_contact_log (person_id, agent_id, agent_name, type, note, created_at)
      VALUES (${c.person_id ?? null}, ${req.agent!.id}, ${req.agent!.name}, 'system',
              ${`Aufnahme von Anruf ${id} angehört.`}, NOW())
    `.catch(() => {});

    res.setHeader("Content-Type", "audio/mpeg");
    // Kein Zwischenspeichern: Die Aufnahme kann jederzeit gelöscht werden, und
    // ein Browser-Cache würde sie überleben.
    res.setHeader("Cache-Control", "no-store, private");
    const { Readable } = await import("node:stream");
    Readable.fromWeb(r.body as any).pipe(res);
  } catch (err) {
    console.error("[TELEFON] aufnahme:", err);
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

/**
 * GET /admin/telefon/diagnose — die Kette Schritt für Schritt.
 *
 * Nur für den Vorgesetzten: Die Antwort nennt Kontonamen und Nummern.
 */
router.get("/admin/telefon/diagnose", async (_req: Request, res: Response) => {
  try {
    const { telefonDiagnose } = await import("../lib/fiaon-telefon-diagnose");
    res.json({ ok: true, ...(await telefonDiagnose()) });
  } catch (err) {
    console.error("[TELEFON] diagnose:", err);
    res.status(500).json({
      ok: false,
      error: `Die Diagnose selbst ist gescheitert: ${err instanceof Error ? err.message : String(err)}`,
    });
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// TELEFON-RICHTLINIE
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Der Satz, den das Team am Gesprächsbeginn vorliest.
 *
 * Änderbar in den Einstellungen — aber nie leer: Fällt der Eintrag weg, gilt
 * die Vorgabe. Ein leerer Pflichtsatz wäre schlimmer als ein unpassender.
 */
async function hinweisSatz(): Promise<string> {
  const { HINWEIS_VORGABE } = await import("../lib/fiaon-telefon-zusage");
  const [r] = (await sqlPool`
    SELECT value FROM fiaon_settings WHERE key = 'telefon_hinweis_satz'
  `.catch(() => [] as any[])) as any[];
  const v = String(r?.value ?? "").trim();
  return v.length > 10 ? v : HINWEIS_VORGABE;
}

/**
 * GET /telefon/suche — Kunden für die Wählanzeige.
 *
 * NUR im Sichtfeld der Rolle: Wer nur eigene Kunden betreut, findet auch nur
 * eigene. Eine Telefonsuche über den ganzen Bestand wäre selbst schon ein
 * Leck — man bekäme Namen und Rufnummern von Menschen, mit denen man nichts
 * zu tun hat.
 */
router.get("/telefon/suche", requireAgent, async (req: AgentRequest, res: Response) => {
  try {
    const q = String(req.query.q || "").trim();
    if (q.length < 2) return res.json({ ok: true, treffer: [] });
    const rolle = await rolleVon(req.agent!.id);
    const nurEigene = rolle === "agent" ? req.agent!.id : null;
    // Rufnummern mit und ohne Leerzeichen finden — der eine tippt 0176…,
    // der andere +49 176 …, und beide meinen denselben Menschen.
    const roh = q.replace(/[^0-9+]/g, "");
    const treffer = (await sqlPool`
      SELECT p.id AS person_id,
             TRIM(COALESCE(p.first_name, '') || ' ' || COALESCE(p.last_name, '')) AS name,
             COALESCE(p.primary_phone, '') AS nummer
      FROM fiaon_persons p
      WHERE p.merged_into_person_id IS NULL AND NOT p.is_blocked
        AND COALESCE(p.primary_phone, '') <> ''
        AND (${nurEigene}::int IS NULL OR p.assigned_agent_id = ${nurEigene}::int)
        AND (
          (COALESCE(p.first_name,'') || ' ' || COALESCE(p.last_name,'')) ILIKE ${`%${q}%`}
          OR (${roh.length >= 4} AND regexp_replace(COALESCE(p.primary_phone,''), '[^0-9+]', '', 'g') LIKE ${`%${roh}%`})
        )
      ORDER BY p.priority_tier NULLS LAST, p.last_name
      LIMIT 8
    `) as any[];
    res.json({
      ok: true,
      treffer: treffer.map((t) => ({
        personId: Number(t.person_id), name: String(t.name).trim() || "Ohne Namen",
        nummer: String(t.nummer),
      })),
    });
  } catch (err) {
    console.error("[TELEFON] suche:", err);
    res.status(500).json({ ok: false, error: "Serverfehler" });
  }
});

/**
 * POST /telefon/browser-fehler — was im Browser geworfen wurde.
 *
 * ── WARUM DAS DIE LETZTE LÜCKE SCHLIESST ───────────────────────────────────
 * Die Diagnose prüft neun Stellen — alle auf dem Server. Der zehnte Ort ist
 * der Browser des Nutzers, und dort konnte ich nie hineinsehen. Im Panel
 * stand „der Fehler nennt keinen Grund", und aus der Ferne war nicht zu
 * klären, WAS geworfen wurde: ein Mikrofon-Nein, ein Modulfehler, ein
 * Twilio-Code oder ein leeres Objekt.
 *
 * Jetzt schickt der Browser es her. Die Diagnose zeigt es als Schritt 10.
 */
router.post("/telefon/browser-fehler", requireAgent, async (req: AgentRequest, res: Response) => {
  try {
    const b = req.body ?? {};
    const eintrag = {
      am: new Date().toISOString(),
      agent: req.agent!.name,
      wo: String(b.wo ?? "unbekannt").slice(0, 40),
      name: b.name ? String(b.name).slice(0, 60) : null,
      code: b.code ?? null,
      message: b.message ? String(b.message).slice(0, 300) : null,
      description: b.description ? String(b.description).slice(0, 300) : null,
      explanation: b.explanation ? String(b.explanation).slice(0, 300) : null,
      causes: Array.isArray(b.causes) ? b.causes.slice(0, 4) : null,
      browser: String(b.browser ?? "").slice(0, 200),
      roh: String(b.roh ?? "").slice(0, 600),
    };
    await sqlPool`
      INSERT INTO fiaon_settings (key, value)
      VALUES ('telefon_letzter_browserfehler', ${JSON.stringify(eintrag)})
      ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value
    `;
    // Auch in die Serverkonsole: Beim nächsten Bericht steht es dort, ohne
    // dass jemand eine Diagnose öffnen muss.
    console.error(`[TELEFON] Browser-Fehler bei „${eintrag.wo}" (${eintrag.agent}): `
      + `${eintrag.name ?? "ohne Name"} ${eintrag.code ?? ""} ${eintrag.message ?? ""} `
      + `| ${eintrag.roh}`);
    res.json({ ok: true });
  } catch (err) {
    console.error("[TELEFON] browser-fehler:", err);
    res.status(500).json({ ok: false });
  }
});

/** GET /telefon/richtlinie — Text und eigener Stand. */
router.get("/telefon/richtlinie", requireAgent, async (req: AgentRequest, res: Response) => {
  try {
    const { zusageStand, zusageHash } = await import("../lib/fiaon-vertrieb-zusage");
    const { TELEFON_ZUSAGE_TEXT, TELEFON_ZUSAGE_VERSION, HINWEIS_VORGABE } =
      await import("../lib/fiaon-telefon-zusage");
    const stand = await zusageStand(req.agent!.id, "telefon", TELEFON_ZUSAGE_VERSION);
    res.json({
      ok: true, ...stand,
      text: TELEFON_ZUSAGE_TEXT,
      // Der Prüfwert belegt, dass der angezeigte Text derselbe ist, der
      // gespeichert wurde. Ohne ihn könnte man den Wortlaut später ändern
      // und behaupten, es sei immer so gewesen.
      pruefwert: zusageHash(TELEFON_ZUSAGE_TEXT).slice(0, 16),
      hinweisSatz: await hinweisSatz(),
      hinweisVorgabe: HINWEIS_VORGABE,
    });
  } catch (err) {
    console.error("[TELEFON] richtlinie:", err);
    res.status(500).json({ ok: false, error: "Serverfehler" });
  }
});

/** POST /telefon/richtlinie — annehmen. */
router.post("/telefon/richtlinie", requireAgent, async (req: AgentRequest, res: Response) => {
  try {
    const { zusageSpeichern, istRoboterUnterschrift, zusageHash } =
      await import("../lib/fiaon-vertrieb-zusage");
    const { TELEFON_ZUSAGE_TEXT, TELEFON_ZUSAGE_VERSION } =
      await import("../lib/fiaon-telefon-zusage");

    const ip = String(req.headers["x-forwarded-for"] || req.ip || "").split(",")[0].trim();
    const ua = String(req.headers["user-agent"] || "");
    // Dieselbe Wand wie bei der Verpflichtungserklärung: Ein Rechtsnachweis,
    // den ein Skript erzeugen kann, ist keiner. Am 08.08.2026 hat ein
    // Browser-Test eine Erklärung echt angenommen.
    const roboter = istRoboterUnterschrift(ip || null, ua || null);
    if (roboter.roboter) {
      return res.status(403).json({ ok: false, error: `Annahme abgelehnt: ${roboter.grund}` });
    }
    if (String(req.body?.pruefwert || "") !== zusageHash(TELEFON_ZUSAGE_TEXT).slice(0, 16)) {
      return res.status(400).json({
        ok: false,
        error: "Der angezeigte Text passt nicht zur gespeicherten Fassung. Bitte die Seite neu laden.",
      });
    }
    // Der getippte Name ist Teil des Nachweises — wie bei der
    // Verpflichtungserklärung. Wer seinen Namen schreibt, hat gelesen.
    const getippt = String(req.body?.name || "").trim();
    if (getippt.length < 3) {
      return res.status(400).json({
        ok: false,
        error: "Bitte schreib deinen Namen in das Feld. Das ist die Unterschrift.",
      });
    }
    await zusageSpeichern({
      agentId: req.agent!.id, agentName: req.agent!.name, bereich: "telefon",
      version: TELEFON_ZUSAGE_VERSION, sollVersion: TELEFON_ZUSAGE_VERSION,
      text: TELEFON_ZUSAGE_TEXT, nameGetippt: getippt,
      gelesen: req.body?.gelesen === true,
      ip: ip || null, userAgent: ua || null,
    });
    console.log(`[TELEFON] Richtlinie angenommen: ${req.agent!.name} (${TELEFON_ZUSAGE_VERSION})`);
    res.json({ ok: true });
  } catch (err) {
    console.error("[TELEFON] richtlinie annehmen:", err);
    res.status(500).json({ ok: false, error: "Serverfehler" });
  }
});

/**
 * POST /telefon/:id/ohne-aufzeichnung — der Kunde hat widersprochen.
 *
 * Stoppt die laufende Twilio-Aufnahme SOFORT und vermerkt es am Anruf. Das
 * Gespräch läuft weiter — man legt nicht auf, weil jemand nicht aufgezeichnet
 * werden will.
 */
router.post("/telefon/:id/ohne-aufzeichnung", requireAgent, async (req: AgentRequest, res: Response) => {
  try {
    const id = Number(req.params.id);
    const [c] = (await sqlPool`
      SELECT id, twilio_sid, agent_id FROM fiaon_calls WHERE id = ${id}
    `) as any[];
    if (!c) return res.status(404).json({ ok: false, error: "Anruf nicht gefunden." });
    if (Number(c.agent_id) !== req.agent!.id) {
      return res.status(403).json({ ok: false, error: "Das ist nicht dein Anruf." });
    }

    // Twilio anweisen, die Aufnahme zu beenden. Schlägt das fehl, wird der
    // Vermerk TROTZDEM gesetzt: Der Wille des Kunden ist festgehalten, auch
    // wenn die Technik gerade klemmt — und der Vermerk ist der Nachweis.
    let gestoppt = false;
    if (c.twilio_sid && process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN) {
      const kopf = "Basic " + Buffer.from(
        `${process.env.TWILIO_ACCOUNT_SID}:${process.env.TWILIO_AUTH_TOKEN}`,
      ).toString("base64");
      const r = await fetch(
        `https://api.twilio.com/2010-04-01/Accounts/${process.env.TWILIO_ACCOUNT_SID}`
        + `/Calls/${c.twilio_sid}/Recordings.json`,
        { headers: { Authorization: kopf }, signal: AbortSignal.timeout(8000) },
      ).catch(() => null);
      const j = await r?.json().catch(() => null) as any;
      for (const rec of j?.recordings ?? []) {
        await fetch(
          `https://api.twilio.com/2010-04-01/Accounts/${process.env.TWILIO_ACCOUNT_SID}`
          + `/Recordings/${rec.sid}.json`,
          {
            method: "POST", headers: { Authorization: kopf, "Content-Type": "application/x-www-form-urlencoded" },
            body: "Status=stopped", signal: AbortSignal.timeout(8000),
          },
        ).catch(() => null);
        gestoppt = true;
      }
    }

    await sqlPool`
      UPDATE fiaon_calls
      SET ohne_aufzeichnung_am = NOW(),
          transkript_status = 'entfaellt',
          transkript_grund = 'Der Kunde hat der Aufzeichnung widersprochen.',
          updated_at = NOW()
      WHERE id = ${id}
    `;
    console.log(`[TELEFON] Aufnahme auf Kundenwunsch beendet (Anruf ${id}, Twilio ${gestoppt ? "gestoppt" : "nicht erreicht"})`);
    res.json({
      ok: true, gestoppt,
      meldung: gestoppt
        ? "Die Aufnahme ist beendet. Am Anruf steht, dass der Kunde widersprochen hat."
        : "Am Anruf steht, dass der Kunde widersprochen hat. Die Aufnahme konnte nicht "
          + "bestätigt gestoppt werden — bitte dem Vorgesetzten Bescheid geben.",
    });
  } catch (err) {
    console.error("[TELEFON] ohne-aufzeichnung:", err);
    res.status(500).json({ ok: false, error: "Serverfehler" });
  }
});

/**
 * POST /admin/telefon/aufnahmen-aufraeumen — der Löschlauf von Hand.
 *
 * Ohne `--schreiben` gibt es nur die Vorschau. Ein Lauf, der beim ersten
 * Klick löscht, ist bei unumkehrbaren Vorgängen die falsche Voreinstellung.
 */
router.post("/admin/telefon/aufnahmen-aufraeumen", async (req: Request, res: Response) => {
  try {
    const erg = await aufnahmenAufraeumen(req.body?.schreiben !== true);
    res.json({ ok: true, ...erg });
  } catch (err) {
    console.error("[TELEFON] aufraeumen:", err);
    res.status(500).json({ ok: false, error: "Serverfehler" });
  }
});

/** GET /admin/telefon/frist — die Frist lesen. POST — setzen. */
router.get("/admin/telefon/frist", async (_req: Request, res: Response) => {
  const { aufnahmenAufraeumen: lauf } = await import("../lib/fiaon-softphone");
  const vorschau = await lauf(true).catch(() => null);
  res.json({ ok: true, tage: await aufnahmeFrist(), faellig: vorschau?.faellig ?? 0 });
});

router.post("/admin/telefon/frist", async (req: Request, res: Response) => {
  const n = Number(req.body?.tage);
  if (!Number.isFinite(n) || n < 7 || n > 365) {
    return res.status(400).json({
      ok: false,
      error: "Die Frist muss zwischen 7 und 365 Tagen liegen. Unter 7 Tagen kann man keine "
        + "Beschwerde mehr prüfen; über 365 wäre es kein Ablauf, sondern ein Archiv.",
    });
  }
  await sqlPool`
    INSERT INTO fiaon_settings (key, value) VALUES ('aufnahme_frist_tage', ${String(Math.round(n))})
    ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value
  `;
  res.json({ ok: true, tage: Math.round(n) });
});

// ═══════════════════════════════════════════════════════════════════════════
// DER TAGESLAUF
//
// Einmal am Tag löschen, was älter als die Frist ist. Über `tageslauf()`
// registriert — die eine Tür, die im Nicht-Produktionsbetrieb zu bleibt.
// Ein Löschlauf, der auf einem Entwicklungsrechner gegen die Produktion
// läuft, wäre unumkehrbarer Schaden.
// ═══════════════════════════════════════════════════════════════════════════
tageslauf("aufnahmen-aufraeumen", () => {
  void aufnahmenAufraeumen(false).then((e) => {
    if (e.geloescht > 0 || e.fehler > 0) {
      console.log(`[TELEFON] Tageslauf: ${e.geloescht} Aufnahmen gelöscht (Frist ${e.frist} Tage), ${e.fehler} Fehler.`);
    }
  }).catch((err) => console.error("[TELEFON] Tageslauf Aufnahmen:", err));
}, 24 * 60 * 60 * 1000);

export default router;
