// ═══════════════════════════════════════════════════════════════════════════
// FIAON Agent — MEINE KUNDEN (person-scoped)
//
// Der Nachfolger der offenen Kartei. Der Unterschied ist nicht die Oberfläche,
// sondern die Autorisierung: Ein Agent sieht ausschliesslich die Personen, die
// ihm gehören. Die Prüfung passiert bei JEDEM Zugriff serverseitig gegen
// `fiaon_persons.assigned_agent_id` — nicht über einen Filter im Frontend, den
// man umgehen kann, indem man eine andere ID in die URL schreibt.
//
// ══ 404 UND NICHT 403 ═════════════════════════════════════════════════════
// Fragt Agent A eine Person von Agent B ab, ist die Antwort 404. Ein 403 würde
// bestätigen, dass diese Person existiert — und damit über einen simplen
// Durchlauf der IDs verraten, wie viele Kunden das Unternehmen hat und welche
// IDs belegt sind. Für den Agenten existiert eine fremde Person nicht.
//
// ══ NULL SICHTBARKEIT FREMDER AGENTEN ═════════════════════════════════════
// Keine Antwort dieser Datei enthält den Namen eines anderen Agenten, eine
// Gesamtzahl über alle Agenten oder eine Rangliste. Der Agent sieht seinen
// eigenen Bestand, sonst nichts.
//
// ══ DER KONTAKTVERLAUF HÄNGT AN DER BESTELLUNG ════════════════════════════
// `fiaon_contact_log.ref` zeigt auf eine Antragszeile, nicht auf die Person.
// Gelesen wird deshalb über ALLE Antragszeilen der Person (ein Kunde mit acht
// Bestellungen hat einen Verlauf, nicht acht), geschrieben wird an die jüngste.
//
// ══ WARUM DAS PRÄFIX /agent/crm ═══════════════════════════════════════════
// `GET /agent/dashboard` existiert bereits im Agentenportal
// (`fiaon-agent-portal.ts`) und wird vom laufenden Frontend benutzt. Router
// werden auf demselben Pfad in Registrierungsreihenfolge abgearbeitet — eine
// zweite Route desselben Namens wäre entweder unerreichbar oder würde die
// bestehende verdrängen und die Agenten sofort arbeitsunfähig machen.
// Deshalb liegt die neue Oberfläche unter einem eigenen Präfix.
// ═══════════════════════════════════════════════════════════════════════════

import { Router, type Response } from "express";
import { sqlPool } from "../lib/db-pool";
import { requireAgent, type AgentRequest } from "./fiaon-agent";
import { hinweisFuer, type TierGrund } from "../lib/tier-hinweise";
import { sendMakeWebhook, makePayloadFromRow } from "../make-webhook";
import { signInvoiceUrl } from "../fiaon-invoice";

const router = Router();

/** Ab so vielen Zahlungsdetail-Versänden warnt die Karte. */
const RECHNUNG_WARNUNG_AB = 3;
/** Ohne Aktivität so lange → Eskalation. */
const ESKALATION_TAGE = 7;

// ───────────────────────────────────────────────────────────────────────────
// Gemeinsame Bausteine
// ───────────────────────────────────────────────────────────────────────────

/**
 * Die Person, WENN sie diesem Agenten gehört — sonst null.
 *
 * Der Besitz steht in der WHERE-Bedingung, nicht in einer nachgelagerten
 * Prüfung. Damit kann keine Abfrage versehentlich fremde Daten laden, auch
 * nicht, wenn später jemand die Prüfung zu vergessen versucht.
 */
async function meinePerson(personId: number, agentId: number) {
  const [p] = await sqlPool`
    SELECT p.id, p.priority_tier, p.tier_reason, p.promised_payment_date,
           p.follow_up_date, p.unreachable_count, p.invoice_sent_count,
           p.is_blocked, p.assigned_at, p.primary_phone, p.primary_email,
           COALESCE(NULLIF(TRIM(CONCAT_WS(' ', p.first_name, p.last_name)), ''),
                    p.company_name, p.contact_name, p.primary_email) AS name,
           -- Für den Handlungshinweis bei abgebrochenen Anträgen
           (SELECT a.status FROM fiaon_applications a
             WHERE a.person_id = p.id AND a.merged_into IS NULL
             ORDER BY a.created_at DESC LIMIT 1) AS letzter_status,
           -- Ziel für Schreibvorgänge in den Kontaktverlauf
           (SELECT a.ref FROM fiaon_applications a
             WHERE a.person_id = p.id AND a.merged_into IS NULL
             ORDER BY a.created_at DESC LIMIT 1) AS schreib_ref
    FROM fiaon_persons p
    WHERE p.id = ${personId}
      AND p.assigned_agent_id = ${agentId}
      AND p.merged_into_person_id IS NULL
  `;
  return p ?? null;
}

/** Die Karten-Antwort. Enthält alles, was die Oberfläche zum Handeln braucht. */
function kartePayload(p: any, letzteAktivitaet?: any) {
  const h = hinweisFuer(p.tier_reason as TierGrund, p.letzter_status);
  return {
    personId: p.id,
    name: p.name,
    telefon: p.primary_phone || null,
    email: p.primary_email || null,
    tier: p.priority_tier,
    tierGrund: p.tier_reason,
    titel: h.titel,
    hinweis: h.hinweis,
    zusagedatum: p.promised_payment_date,
    wiedervorlage: p.follow_up_date,
    nichtErreicht: p.unreachable_count,
    rechnungVersandt: p.invoice_sent_count,
    // Die Warnung entsteht hier, nicht im Frontend: Sie ist eine fachliche
    // Regel und muss überall dieselbe sein.
    rechnungWarnung: p.invoice_sent_count >= RECHNUNG_WARNUNG_AB
      ? `Bereits ${p.invoice_sent_count}× versandt. Ein weiterer Versand ersetzt kein Gespräch — ruf an.`
      : null,
    gesperrt: p.is_blocked,
    seit: p.assigned_at,
    letzteAktivitaet: letzteAktivitaet
      ? {
          am: letzteAktivitaet.created_at,
          art: letzteAktivitaet.type,
          ergebnis: letzteAktivitaet.outcome,
          notiz: letzteAktivitaet.note,
        }
      : null,
  };
}

/** Jüngster Kontaktverlauf-Eintrag über die ganze Bestell-Familie der Person. */
async function letzteAktivitaetVon(personId: number) {
  const [a] = await sqlPool`
    SELECT c.created_at, c.type, c.outcome, c.note
    FROM fiaon_contact_log c
    JOIN fiaon_applications ap ON ap.ref = c.ref
    WHERE ap.person_id = ${personId} AND c.voided_at IS NULL
    ORDER BY c.created_at DESC
    LIMIT 1
  `;
  return a ?? null;
}

// ───────────────────────────────────────────────────────────────────────────
// GET /agent/dashboard — die Zahlen des eigenen Bestands
// ───────────────────────────────────────────────────────────────────────────
router.get("/agent/crm/dashboard", requireAgent, async (req: AgentRequest, res: Response) => {
  try {
    const agentId = req.agent!.id;
    const [z] = await sqlPool`
      SELECT
        -- Heute fällig: Zusage auf heute ODER Wiedervorlage auf heute/früher
        count(*) FILTER (
          WHERE NOT is_blocked AND priority_tier IN (1, 2)
            AND (promised_payment_date = CURRENT_DATE
                 OR (follow_up_date IS NOT NULL AND follow_up_date <= CURRENT_DATE))
        )::int AS heute_faellig,
        -- Zahlung gemeldet, Geld fehlt: Tier 1 ohne Zusagedatum
        count(*) FILTER (
          WHERE NOT is_blocked AND priority_tier = 1 AND promised_payment_date IS NULL
        )::int AS ohne_datum,
        -- Überfällig: Zusagedatum liegt in der Vergangenheit
        count(*) FILTER (
          WHERE NOT is_blocked AND promised_payment_date IS NOT NULL
            AND promised_payment_date < CURRENT_DATE
        )::int AS ueberfaellig,
        count(*) FILTER (WHERE NOT is_blocked AND priority_tier = 1)::int AS tier1,
        count(*) FILTER (WHERE NOT is_blocked AND priority_tier = 2)::int AS tier2,
        count(*) FILTER (WHERE NOT is_blocked AND priority_tier = 3)::int AS tier3,
        count(*) FILTER (WHERE is_blocked)::int AS gesperrt,
        count(*)::int AS gesamt
      FROM fiaon_persons
      WHERE assigned_agent_id = ${agentId} AND merged_into_person_id IS NULL
    `;

    // Eskalation: seit ESKALATION_TAGE keine dokumentierte Aktivität.
    const [esk] = await sqlPool`
      SELECT count(*)::int AS anzahl
      FROM fiaon_persons p
      WHERE p.assigned_agent_id = ${agentId}
        AND p.merged_into_person_id IS NULL
        AND NOT p.is_blocked
        AND p.priority_tier IN (1, 2)
        AND COALESCE((
          SELECT MAX(c.created_at) FROM fiaon_contact_log c
          JOIN fiaon_applications ap ON ap.ref = c.ref
          WHERE ap.person_id = p.id AND c.voided_at IS NULL AND c.agent_id IS NOT NULL
        ), p.assigned_at, NOW() - INTERVAL '99 days') < NOW() - (${ESKALATION_TAGE} || ' days')::interval
    `;

    // Abschlussquote 30 Tage: eigene Kunden, die in diesem Zeitraum bezahlt haben.
    // Bewusst nur der EIGENE Wert — kein Vergleich mit anderen Agenten.
    const [conv] = await sqlPool`
      SELECT
        count(DISTINCT p.id) FILTER (WHERE a.payment_status = 'paid'
                                       AND a.updated_at > NOW() - INTERVAL '30 days')::int AS bezahlt,
        count(DISTINCT p.id)::int AS betreut
      FROM fiaon_persons p
      LEFT JOIN fiaon_applications a ON a.person_id = p.id AND a.merged_into IS NULL
      WHERE p.assigned_agent_id = ${agentId} AND p.merged_into_person_id IS NULL
    `;

    res.json({
      ok: true,
      agent: { vorname: req.agent!.first_name || req.agent!.name },
      zahlen: {
        heuteFaellig: z.heute_faellig,
        ohneDatum: z.ohne_datum,
        ueberfaellig: z.ueberfaellig,
        eskalation: esk?.anzahl ?? 0,
        tier1: z.tier1,
        tier2: z.tier2,
        tier3: z.tier3,
        gesperrt: z.gesperrt,
        gesamt: z.gesamt,
        abschlussquote30Tage: conv?.betreut ? Math.round((conv.bezahlt / conv.betreut) * 100) : 0,
        abschluesse30Tage: conv?.bezahlt ?? 0,
      },
      eskalationNachTagen: ESKALATION_TAGE,
    });
  } catch (err) {
    console.error("[AGENT-KUNDEN] dashboard:", err);
    res.status(500).json({ ok: false, error: "Serverfehler" });
  }
});

// ───────────────────────────────────────────────────────────────────────────
// GET /agent/kunden — die eigene Liste, filterbar
//   tier=1|2|3   reason=<tier_reason>   state=heute|ohne_datum|ueberfaellig|offen
//   q=<Suche über Name, E-Mail, Telefon>
// ───────────────────────────────────────────────────────────────────────────
router.get("/agent/crm/kunden", requireAgent, async (req: AgentRequest, res: Response) => {
  try {
    const agentId = req.agent!.id;
    const tier = req.query.tier ? Number(req.query.tier) : null;
    const reason = req.query.reason ? String(req.query.reason) : null;
    const state = req.query.state ? String(req.query.state) : null;
    const q = req.query.q ? String(req.query.q).trim() : "";

    const rows = await sqlPool`
      SELECT p.id, p.priority_tier, p.tier_reason, p.promised_payment_date,
             p.follow_up_date, p.unreachable_count, p.invoice_sent_count,
             p.is_blocked, p.assigned_at, p.primary_phone, p.primary_email,
             COALESCE(NULLIF(TRIM(CONCAT_WS(' ', p.first_name, p.last_name)), ''),
                      p.company_name, p.contact_name, p.primary_email) AS name,
             (SELECT a.status FROM fiaon_applications a
               WHERE a.person_id = p.id AND a.merged_into IS NULL
               ORDER BY a.created_at DESC LIMIT 1) AS letzter_status,
             (SELECT MAX(c.created_at) FROM fiaon_contact_log c
               JOIN fiaon_applications ap ON ap.ref = c.ref
               WHERE ap.person_id = p.id AND c.voided_at IS NULL) AS letzte_am
      FROM fiaon_persons p
      WHERE p.assigned_agent_id = ${agentId}
        AND p.merged_into_person_id IS NULL
        AND (${tier}::int IS NULL OR p.priority_tier = ${tier}::int)
        AND (${reason}::text IS NULL OR p.tier_reason = ${reason}::text)
        AND (
          ${state}::text IS NULL
          OR (${state}::text = 'heute' AND NOT p.is_blocked
              AND (p.promised_payment_date = CURRENT_DATE
                   OR (p.follow_up_date IS NOT NULL AND p.follow_up_date <= CURRENT_DATE)))
          OR (${state}::text = 'ohne_datum' AND NOT p.is_blocked
              AND p.priority_tier = 1 AND p.promised_payment_date IS NULL)
          OR (${state}::text = 'ueberfaellig' AND NOT p.is_blocked
              AND p.promised_payment_date IS NOT NULL AND p.promised_payment_date < CURRENT_DATE)
          OR (${state}::text = 'offen' AND NOT p.is_blocked)
        )
        AND (
          ${q}::text = ''
          OR COALESCE(NULLIF(TRIM(CONCAT_WS(' ', p.first_name, p.last_name)), ''),
                      p.company_name, p.contact_name, '') ILIKE '%' || ${q}::text || '%'
          OR COALESCE(p.primary_email, '') ILIKE '%' || ${q}::text || '%'
          OR COALESCE(p.primary_phone, '') ILIKE '%' || ${q}::text || '%'
        )
      ORDER BY
        p.is_blocked ASC,
        p.priority_tier ASC,
        p.promised_payment_date ASC NULLS LAST,
        p.follow_up_date ASC NULLS LAST,
        p.id ASC
      LIMIT 300
    `;

    res.json({
      ok: true,
      anzahl: rows.length,
      kunden: (rows as any[]).map((p) => ({
        ...kartePayload(p),
        letzteAktivitaet: p.letzte_am ? { am: p.letzte_am } : null,
      })),
    });
  } catch (err) {
    console.error("[AGENT-KUNDEN] liste:", err);
    res.status(500).json({ ok: false, error: "Serverfehler" });
  }
});

// ───────────────────────────────────────────────────────────────────────────
// GET /agent/kunden/:personId — Detail mit Verlauf. Fremde Person → 404.
// ───────────────────────────────────────────────────────────────────────────
router.get("/agent/crm/kunden/:personId", requireAgent, async (req: AgentRequest, res: Response) => {
  try {
    const personId = Number(req.params.personId);
    if (!Number.isFinite(personId)) return res.status(404).json({ ok: false, error: "Kunde nicht gefunden" });

    const p = await meinePerson(personId, req.agent!.id);
    if (!p) return res.status(404).json({ ok: false, error: "Kunde nicht gefunden" });

    const verlauf = await sqlPool`
      SELECT c.id, c.created_at, c.type, c.outcome, c.note, c.promised_date,
             c.agent_name, c.ref
      FROM fiaon_contact_log c
      JOIN fiaon_applications ap ON ap.ref = c.ref
      WHERE ap.person_id = ${personId} AND c.voided_at IS NULL
      ORDER BY c.created_at DESC
      LIMIT 100
    `;

    const bestellungen = await sqlPool`
      SELECT ref, payment_reference, pack_name, amount_due, payment_status, created_at
      FROM fiaon_applications
      WHERE person_id = ${personId} AND merged_into IS NULL
      ORDER BY created_at DESC
    `;

    res.json({
      ok: true,
      kunde: kartePayload(p, (verlauf as any[])[0]),
      verlauf: (verlauf as any[]).map((v) => ({
        id: v.id,
        am: v.created_at,
        art: v.type,
        ergebnis: v.outcome,
        notiz: v.note,
        zusagedatum: v.promised_date,
        // Der Name des eintragenden Agenten bleibt sichtbar: Es ist der
        // eigene Verlauf, und bei Übernahmen ist die Vorgeschichte nötig.
        von: v.agent_name,
      })),
      bestellungen: (bestellungen as any[]).map((b) => ({
        ref: b.ref,
        zahlungsreferenz: b.payment_reference,
        produkt: b.pack_name ? String(b.pack_name).split("\n")[0].trim() : null,
        betragCents: b.amount_due != null ? Math.round(Number(b.amount_due) * 100) : null,
        status: b.payment_status,
        am: b.created_at,
      })),
    });
  } catch (err) {
    console.error("[AGENT-KUNDEN] detail:", err);
    res.status(500).json({ ok: false, error: "Serverfehler" });
  }
});

// ───────────────────────────────────────────────────────────────────────────
// POST /agent/kunden/:personId/aktivitaet
//   art: erreicht | nicht_erreicht | blockiert | notiz
// ───────────────────────────────────────────────────────────────────────────
router.post("/agent/crm/kunden/:personId/aktivitaet", requireAgent, async (req: AgentRequest, res: Response) => {
  try {
    const personId = Number(req.params.personId);
    const art = String(req.body?.art || "").trim();
    const notiz = req.body?.notiz ? String(req.body.notiz).trim() : null;
    const wiedervorlage = req.body?.wiedervorlage ? String(req.body.wiedervorlage) : null;

    const erlaubt = ["erreicht", "nicht_erreicht", "blockiert", "notiz"];
    if (!erlaubt.includes(art)) {
      return res.status(400).json({ ok: false, error: `Unbekannte Aktivität. Erlaubt: ${erlaubt.join(", ")}` });
    }

    const p = await meinePerson(personId, req.agent!.id);
    if (!p) return res.status(404).json({ ok: false, error: "Kunde nicht gefunden" });
    if (!p.schreib_ref) {
      return res.status(400).json({
        ok: false,
        error: "Zu diesem Kunden gibt es keine Bestellung, an der der Verlauf hängen könnte.",
      });
    }

    // Ergebnis-Werte des bestehenden Verlaufs weiterverwenden, damit alte und
    // neue Einträge in derselben Auswertung zusammenpassen.
    const outcome =
      art === "erreicht" ? "erreicht_zahlt_gleich" :
      art === "nicht_erreicht" ? "nicht_erreicht" :
      art === "blockiert" ? "erreicht_abgelehnt" : null;

    await sqlPool.begin(async (tx) => {
      await tx`
        INSERT INTO fiaon_contact_log (ref, agent_id, agent_name, type, outcome, note, created_at)
        VALUES (${p.schreib_ref}, ${req.agent!.id}, ${req.agent!.name},
                ${art === "notiz" ? "note" : "result"}, ${outcome}, ${notiz}, NOW())
      `;

      if (art === "nicht_erreicht") {
        await tx`
          UPDATE fiaon_persons
             SET unreachable_count = unreachable_count + 1,
                 follow_up_date = COALESCE(${wiedervorlage}::date, CURRENT_DATE + 1),
                 updated_at = NOW()
           WHERE id = ${personId}
        `;
      } else if (art === "blockiert") {
        // Gesperrt heißt: aus jeder Anrufliste. Wiedervorlage wird gelöscht,
        // sonst käme der Kunde über die Tagesliste zurück.
        await tx`
          UPDATE fiaon_persons
             SET is_blocked = TRUE, follow_up_date = NULL, updated_at = NOW()
           WHERE id = ${personId}
        `;
      } else if (wiedervorlage) {
        await tx`
          UPDATE fiaon_persons
             SET follow_up_date = ${wiedervorlage}::date, updated_at = NOW()
           WHERE id = ${personId}
        `;
      } else if (art === "erreicht") {
        // Erreicht ohne Zusagedatum: morgen erneut ansehen, damit der Fall
        // nicht aus der Tagesliste verschwindet.
        await tx`
          UPDATE fiaon_persons
             SET follow_up_date = CURRENT_DATE + 1, updated_at = NOW()
           WHERE id = ${personId} AND follow_up_date IS NULL
        `;
      }
    });

    const neu = await meinePerson(personId, req.agent!.id);
    res.json({ ok: true, kunde: kartePayload(neu, await letzteAktivitaetVon(personId)) });
  } catch (err) {
    console.error("[AGENT-KUNDEN] aktivitaet:", err);
    res.status(500).json({ ok: false, error: "Serverfehler" });
  }
});

// ───────────────────────────────────────────────────────────────────────────
// POST /agent/kunden/:personId/zusage — Datum ist Pflicht
// ───────────────────────────────────────────────────────────────────────────
router.post("/agent/crm/kunden/:personId/zusage", requireAgent, async (req: AgentRequest, res: Response) => {
  try {
    const personId = Number(req.params.personId);
    const datum = req.body?.datum ? String(req.body.datum).trim() : "";

    // Ohne Datum keine Zusage. Eine Zusage „irgendwann" ist keine Zusage und
    // würde den Kunden aus jeder Tagesliste nehmen, ohne etwas zu vereinbaren.
    if (!datum) {
      return res.status(400).json({
        ok: false,
        error: "Bitte ein konkretes Zahlungsdatum angeben — ohne Datum lässt sich nicht nachfassen.",
      });
    }
    const geprueft = new Date(datum);
    if (isNaN(geprueft.getTime())) {
      return res.status(400).json({ ok: false, error: "Das Datum ist nicht lesbar. Bitte im Format JJJJ-MM-TT angeben." });
    }

    const p = await meinePerson(personId, req.agent!.id);
    if (!p) return res.status(404).json({ ok: false, error: "Kunde nicht gefunden" });
    if (!p.schreib_ref) {
      return res.status(400).json({ ok: false, error: "Zu diesem Kunden gibt es keine Bestellung." });
    }

    await sqlPool.begin(async (tx) => {
      await tx`
        INSERT INTO fiaon_contact_log (ref, agent_id, agent_name, type, outcome, note, promised_date, created_at)
        VALUES (${p.schreib_ref}, ${req.agent!.id}, ${req.agent!.name}, 'result',
                'erreicht_zahlt_am',
                ${req.body?.notiz ? String(req.body.notiz).trim() : null},
                ${datum}::date, NOW())
      `;
      // Die Wiedervorlage folgt der Zusage: einen Tag danach nachfassen.
      await tx`
        UPDATE fiaon_persons
           SET promised_payment_date = ${datum}::date,
               follow_up_date = ${datum}::date + 1,
               updated_at = NOW()
         WHERE id = ${personId}
      `;
    });

    const neu = await meinePerson(personId, req.agent!.id);
    res.json({ ok: true, kunde: kartePayload(neu, await letzteAktivitaetVon(personId)) });
  } catch (err) {
    console.error("[AGENT-KUNDEN] zusage:", err);
    res.status(500).json({ ok: false, error: "Serverfehler" });
  }
});

// ───────────────────────────────────────────────────────────────────────────
// POST /agent/kunden/:personId/rechnung — Zahlungsdetails erneut senden
//
// Benutzt den BESTEHENDEN Versandweg (`payment_details` über Make, mit
// signiertem Rechnungslink). Kein zweiter Mailpfad.
// ───────────────────────────────────────────────────────────────────────────
router.post("/agent/crm/kunden/:personId/rechnung", requireAgent, async (req: AgentRequest, res: Response) => {
  try {
    const personId = Number(req.params.personId);
    const p = await meinePerson(personId, req.agent!.id);
    if (!p) return res.status(404).json({ ok: false, error: "Kunde nicht gefunden" });

    // Die Bestellung, um die es geht: die jüngste noch offene.
    const [bestellung] = await sqlPool`
      SELECT ref, payment_reference, amount_due, first_name, last_name, contact_name,
             email, contact_email, billing_email, pack_name, payment_status
      FROM fiaon_applications
      WHERE person_id = ${personId} AND merged_into IS NULL
        AND payment_status IN ('pending_payment', 'claimed_paid', 'expired')
      ORDER BY created_at DESC
      LIMIT 1
    `;
    if (!bestellung) {
      return res.status(400).json({
        ok: false,
        error: "Dieser Kunde hat keine offene Bestellung — es gibt keine Zahlungsdetails zu senden.",
      });
    }
    const empfaenger = bestellung.email || bestellung.contact_email || bestellung.billing_email;
    if (!empfaenger) {
      return res.status(400).json({ ok: false, error: "Für diesen Kunden ist keine E-Mail-Adresse hinterlegt." });
    }

    await sqlPool.begin(async (tx) => {
      await tx`
        UPDATE fiaon_persons
           SET invoice_sent_count = invoice_sent_count + 1, updated_at = NOW()
         WHERE id = ${personId}
      `;
      await tx`
        INSERT INTO fiaon_contact_log (ref, agent_id, agent_name, type, note, created_at)
        VALUES (${bestellung.ref}, ${req.agent!.id}, ${req.agent!.name}, 'email_sent',
                ${`Zahlungsdetails erneut versandt (${bestellung.payment_reference || bestellung.ref})`}, NOW())
      `;
    });

    // Fire-and-forget wie überall: Ein Ausfall bei Make darf den Zähler und den
    // Verlauf nicht zurückdrehen — der Agent hat die Aktion ausgelöst.
    sendMakeWebhook("payment_details", {
      ...makePayloadFromRow(bestellung),
      invoice_url: bestellung.payment_reference ? signInvoiceUrl(bestellung.payment_reference) : null,
    }).catch((e) => console.error("[AGENT-KUNDEN] payment_details:", e));

    const neu = await meinePerson(personId, req.agent!.id);
    res.json({
      ok: true,
      kunde: kartePayload(neu, await letzteAktivitaetVon(personId)),
      versandtAn: empfaenger,
      warnung: neu.invoice_sent_count >= RECHNUNG_WARNUNG_AB
        ? `Das war der ${neu.invoice_sent_count}. Versand. Weitere Mails bringen erfahrungsgemäß nichts — ruf an.`
        : null,
    });
  } catch (err) {
    console.error("[AGENT-KUNDEN] rechnung:", err);
    res.status(500).json({ ok: false, error: "Serverfehler" });
  }
});

export default router;
