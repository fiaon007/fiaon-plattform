// ═══════════════════════════════════════════════════════════════════
// FIAON — DIE OFFENE KUNDEN-KARTEI (27.07.2026)
//
// Ein einziger, gemeinsamer Bestand für alle Agenten. Leads UND Kunden liegen
// in derselben Kartei, für alle sichtbar, Kontaktdaten gesperrt. Der Agent
// übernimmt eine Akte per Doppelbestätigung, arbeitet sie ab, dokumentiert,
// nimmt die nächste — unbegrenzt oft. Kein Round-Robin, keine Zuteilung von
// oben, kein Deckel.
//
// ══ WAS DIESE DATEI NICHT TUT ══════════════════════════════════════════════
// Sie ändert AUSSCHLIESSLICH Sichtbarkeit, Zuweisung und Reihenfolge.
//   · KEIN sendMakeWebhook-Aufruf — kein einziger. Die E-Mail-Kette bleibt
//     unangetastet (siehe scripts/event-inventar.ts, Baseline vor dem Umbau).
//   · KEINE Provisions-, Stichtag- oder Attributionslogik. `onCustomerPaid`,
//     `commission_cutoff_at` und die Direktzahler-Regel bleiben wie sie sind.
//   · KEIN hartes Löschen. Jede Zustandsänderung landet in fiaon_kartei_events
//     UND im bestehenden Verlauf (fiaon_lead_log / fiaon_contact_log).
//
// ══ PERSONEN-MODELL (eine Person = eine Karte) ═════════════════════════════
// Identisch zur zentralen Kundenakte (fiaon-kunden.ts, D5/P1): Ein Antrag ist
// die Karte; ein Lead erzeugt nur dann eine eigene Karte, wenn es KEINEN
// Antrag derselben Person gibt (gleiche E-Mail oder gleiche letzte 9
// Telefonziffern). Karten-ID: "<ref>" für Anträge, "lead-<id>" für Lead-only.
// ═══════════════════════════════════════════════════════════════════

import { Router, type Request, type Response } from "express";
import { sqlPool } from "../lib/db-pool";
import { requireAgent, logAction, logAgentEvent, getSettings, setSetting, type AgentRequest } from "./fiaon-agent";
import { logLead } from "./fiaon-leads";

const router = Router();

// ── Zustände, die überhaupt Arbeitsvorrat sind ───────────────────────────────
/** Offene Lead-Status. `konvertiert`/`tot`/`kein_interesse` verlassen die Kartei. */
const OPEN_LEAD_STATUS = ["neu", "kontaktiert", "nicht_erreichbar"];
/**
 * Offene Bestellungen. `paid` fehlt bewusst: Zahlt jemand von allein, während
 * seine Karte frei liegt, verschwindet sie SOFORT — niemand kann ihn
 * nachträglich übernehmen und Provision beanspruchen (Direktzahler-Regel).
 */
const OPEN_PAYMENT_STATUS = ["pending_payment", "claimed_paid"];
/**
 * „Dokumentierter Kontakt" — dieselbe Definition wie im Phase-0-Report.
 * Bewusst OHNE `claim`/`system`: eine bloße Übernahme ist keine Betreuung.
 */
const CONTACT_TYPES = ["result", "note", "email_sent"];

// ── Schema (idempotent, additiv) ─────────────────────────────────────────────
let ensured = false;
export async function ensureKarteiTables(): Promise<void> {
  if (ensured) return;
  // Anträge bekommen dieselben Akten-Spalten, die Leads schon haben — damit die
  // Regel „eine aktive Akte" für BEIDE Kartenarten mit derselben Abfrage gilt.
  await sqlPool.unsafe(`
    ALTER TABLE fiaon_applications
      ADD COLUMN IF NOT EXISTS opened_by_agent_id INTEGER,
      ADD COLUMN IF NOT EXISTS opened_at TIMESTAMPTZ,
      ADD COLUMN IF NOT EXISTS kartei_claimed_at TIMESTAMPTZ
  `);
  await sqlPool.unsafe(`
    ALTER TABLE fiaon_leads
      ADD COLUMN IF NOT EXISTS kartei_claimed_at TIMESTAMPTZ
  `);
  await sqlPool`CREATE INDEX IF NOT EXISTS fiaon_apps_opened_idx ON fiaon_applications (opened_by_agent_id, opened_at)`;
  await sqlPool`CREATE INDEX IF NOT EXISTS fiaon_apps_kartei_claim_idx ON fiaon_applications (assigned_agent_id, kartei_claimed_at)`;
  await sqlPool`CREATE INDEX IF NOT EXISTS fiaon_leads_kartei_claim_idx ON fiaon_leads (assigned_agent_id, kartei_claimed_at)`;

  // Kartei-Audit: jede Übernahme, jede Rückgabe, jeder Admin-Eingriff.
  // Getrennt vom fachlichen Verlauf, damit der Admin „Rückläufer" und
  // „wer übernimmt wie viel" ohne Textsuche auswerten kann.
  await sqlPool`
    CREATE TABLE IF NOT EXISTS fiaon_kartei_events (
      id SERIAL PRIMARY KEY,
      kind VARCHAR NOT NULL,                -- 'lead' | 'app'
      target_id VARCHAR NOT NULL,           -- Lead-ID als Text oder Antrags-ref
      card_id VARCHAR NOT NULL,             -- Karten-ID (ref oder lead-<id>)
      agent_id INTEGER,                     -- betroffener Agent
      event VARCHAR NOT NULL,               -- claim | release_manual | release_auto |
                                            -- release_hoarding | release_admin |
                                            -- assign_admin | migration_release | migration_keep
      reason TEXT,
      actor VARCHAR,                        -- Klartext: Agentenname, "System", "Admin"
      meta JSONB,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;
  await sqlPool`CREATE INDEX IF NOT EXISTS fiaon_kartei_events_card_idx ON fiaon_kartei_events (card_id, created_at DESC)`;
  await sqlPool`CREATE INDEX IF NOT EXISTS fiaon_kartei_events_agent_idx ON fiaon_kartei_events (agent_id, event, created_at DESC)`;

  // ── Geschwindigkeit (Teil B) ────────────────────────────────────────────
  // Indizes aendern KEIN Ergebnis, nur den Weg dorthin. Sie decken genau die
  // Spalten ab, nach denen die Kartei filtert, sortiert und verknuepft.
  //
  // Der teuerste Teil der Kartei-Abfrage ist LEAD_HAS_NO_APP_SIBLING: fuer
  // JEDEN Lead wird geprueft, ob es einen Antrag derselben Person gibt —
  // ueber LOWER(TRIM(email)) und die letzten neun Ziffern der Rufnummer.
  // Ohne passende Ausdruck-Indizes ist das ein vollstaendiger Durchlauf durch
  // fiaon_applications pro Lead. Genau dafuer sind die beiden letzten Indizes.
  await sqlPool`CREATE INDEX IF NOT EXISTS fiaon_apps_kartei_filter_idx
    ON fiaon_applications (payment_status, merged_into, dismissed_at, created_at DESC)`;
  await sqlPool`CREATE INDEX IF NOT EXISTS fiaon_apps_agent_updated_idx
    ON fiaon_applications (assigned_agent_id, updated_at DESC)`;
  await sqlPool`CREATE INDEX IF NOT EXISTS fiaon_leads_kartei_filter_idx
    ON fiaon_leads (status, dismissed_at, converted_order_id, requeue_at, erstellt_am DESC)`;
  await sqlPool`CREATE INDEX IF NOT EXISTS fiaon_leads_agent_updated_idx
    ON fiaon_leads (assigned_agent_id, updated_at DESC)`;

  // Kontakt-Verlauf: beide Log-Tabellen werden je Karte zweimal angefasst
  // (dokumentierter Kontakt + faelliger Rueckruf).
  await sqlPool`CREATE INDEX IF NOT EXISTS fiaon_contact_log_ref_type_idx
    ON fiaon_contact_log (ref, type, voided_at, created_at DESC)`;
  await sqlPool`CREATE INDEX IF NOT EXISTS fiaon_contact_log_sched_idx
    ON fiaon_contact_log (ref, scheduled_at) WHERE scheduled_at IS NOT NULL`;
  await sqlPool`CREATE INDEX IF NOT EXISTS fiaon_lead_log_lead_type_idx
    ON fiaon_lead_log (lead_id, type, created_at DESC)`;
  await sqlPool`CREATE INDEX IF NOT EXISTS fiaon_lead_log_sched_idx
    ON fiaon_lead_log (lead_id, scheduled_at) WHERE scheduled_at IS NOT NULL`;

  // Dubletten-Erkennung: normalisierte E-Mail und normalisierte Rufnummer.
  // Die Ausdruecke muessen ZEICHENGLEICH mit der Abfrage sein, sonst nutzt
  // Postgres den Index nicht — deshalb wird APP_PHONE_SQL wiederverwendet.
  await sqlPool.unsafe(`
    CREATE INDEX IF NOT EXISTS fiaon_apps_norm_email_idx
      ON fiaon_applications (LOWER(TRIM(email))) WHERE merged_into IS NULL
  `);
  await sqlPool.unsafe(`
    CREATE INDEX IF NOT EXISTS fiaon_apps_norm_phone_idx
      ON fiaon_applications (RIGHT(COALESCE(${APP_PHONE_SQL},''), 9)) WHERE merged_into IS NULL
  `);
  await sqlPool.unsafe(`
    CREATE INDEX IF NOT EXISTS fiaon_leads_norm_email_idx
      ON fiaon_leads (LOWER(TRIM(email)))
  `);

  ensured = true;
  console.log("[FIAON-KARTEI] Kartei-Tabellen sichergestellt");
}

async function karteiEvent(
  card: { kind: "lead" | "app"; targetId: string; cardId: string },
  agentId: number | null,
  event: string,
  opts: { reason?: string | null; actor?: string; meta?: Record<string, unknown> } = {},
): Promise<void> {
  await sqlPool`
    INSERT INTO fiaon_kartei_events (kind, target_id, card_id, agent_id, event, reason, actor, meta)
    VALUES (${card.kind}, ${card.targetId}, ${card.cardId}, ${agentId}, ${event},
            ${opts.reason || null}, ${opts.actor || "System"},
            ${opts.meta ? sqlPool.json(opts.meta as any) : null})
  `.catch((err) => console.error("[FIAON-KARTEI] Audit-Write:", err));
}

// ── Karten-ID ────────────────────────────────────────────────────────────────
export interface CardRef {
  kind: "lead" | "app";
  targetId: string;
  cardId: string;
}

/** "lead-123" → Lead 123; alles andere → Antrags-ref. */
export function parseCardId(raw: string): CardRef | null {
  const id = String(raw || "").trim();
  if (!id) return null;
  const m = /^lead-(\d+)$/i.exec(id);
  if (m) return { kind: "lead", targetId: m[1], cardId: `lead-${m[1]}` };
  if (!/^[A-Za-z0-9_-]{4,64}$/.test(id)) return null;
  return { kind: "app", targetId: id, cardId: id };
}

// ── Gewichtung (baut auf queueWeights aus der Warteschlange auf) ─────────────
function karteiWeights(s: Record<string, string>) {
  const num = (v: string | undefined, d: number) => {
    const n = Number(v);
    return Number.isFinite(n) && n >= 0 ? n : d;
  };
  return {
    wFresh: num(s.queue_w_fresh, 40),
    wValue: num(s.queue_w_value, 25),
    wReact: num(s.queue_w_react, 50),
    wContact: num(s.queue_w_contact, 30),
    fairnessNth: Math.max(2, Math.min(10, num(s.queue_fairness_nth, 4))),
    hoardingDays: num(s.kartei_hoarding_days, 7),
    hoardingWarnDays: num(s.kartei_hoarding_warn_days, 2),
    autoReleaseMin: num(s.akte_auto_release_min, 30),
    requireFullContact: String(s.kartei_require_full_contact ?? "1") === "1",
  };
}

// ═══════════════════════════════════════════════════════════════════
// SQL-BAUSTEINE — die Kartei als eine Union aus Anträgen + Lead-only
// ═══════════════════════════════════════════════════════════════════

/** Telefon-Ziffern eines Antrags (identisch zu fiaon-kunden.ts). */
const APP_PHONE_SQL = `
  COALESCE(
    NULLIF(regexp_replace(COALESCE(a.phone_country_code,'') || COALESCE(a.phone,''), '\\D', '', 'g'), ''),
    NULLIF(regexp_replace(COALESCE(a.contact_phone,''), '\\D', '', 'g'), '')
  )`;

/**
 * Ein Lead erzeugt NUR dann eine Karte, wenn es keinen Antrag derselben Person
 * gibt. Exakt dieselbe Bedingung wie in der zentralen Kundenakte — dadurch ist
 * garantiert: Lead + Antrag derselben Person = EINE Karte.
 */
const LEAD_HAS_NO_APP_SIBLING = `
  NOT EXISTS (
    SELECT 1 FROM fiaon_applications a
    WHERE a.merged_into IS NULL AND (
      (COALESCE(l.email,'') <> '' AND LOWER(TRIM(a.email)) = LOWER(TRIM(l.email)))
      OR (LENGTH(regexp_replace(COALESCE(l.telefon,''),'\\D','','g')) >= 7
          AND RIGHT(regexp_replace(COALESCE(l.telefon,''),'\\D','','g'), 9)
            = RIGHT(COALESCE(${APP_PHONE_SQL},''), 9))
    )
  )`;

/**
 * Baut die vollständige Kartei als CTE. Enthält NUR neutrale Merkmale plus die
 * Felder, die für Sortierung und Zustand nötig sind — Name/Telefon/E-Mail
 * werden hier bewusst NICHT selektiert, sondern nur als boolesche „vorhanden"-
 * Flags. Damit können Kontaktdaten gar nicht erst versehentlich austreten.
 */
function karteiCte(w: ReturnType<typeof karteiWeights>): string {
  const appContactRule = w.requireFullContact
    ? `AND ${APP_PHONE_SQL} IS NOT NULL
       AND COALESCE(NULLIF(a.email,''), NULLIF(a.contact_email,''), NULLIF(a.billing_email,'')) IS NOT NULL`
    : `AND (${APP_PHONE_SQL} IS NOT NULL
           OR COALESCE(NULLIF(a.email,''), NULLIF(a.contact_email,''), NULLIF(a.billing_email,'')) IS NOT NULL)`;
  const leadContactRule = w.requireFullContact
    ? `AND COALESCE(l.telefon,'') <> '' AND COALESCE(l.email,'') <> ''
       AND (COALESCE(l.vorname,'') <> '' OR COALESCE(l.nachname,'') <> '')`
    : `AND (COALESCE(l.telefon,'') <> '' OR COALESCE(l.email,'') <> '')`;

  return `
    WITH kartei AS (
      -- ── Anträge (offene Bestellungen) ──────────────────────────────────
      SELECT
        'app'::varchar                       AS kind,
        a.ref                                AS target_id,
        a.ref                                AS card_id,
        a.created_at                         AS created_at,
        a.assigned_agent_id                  AS assigned_agent_id,
        a.opened_by_agent_id                 AS opened_by_agent_id,
        a.opened_at                          AS opened_at,
        a.kartei_claimed_at                  AS kartei_claimed_at,
        CASE a.payment_status
          WHEN 'claimed_paid' THEN 'angekuendigt'
          ELSE 'offener_antrag'
        END::varchar                         AS lifecycle,
        COALESCE(a.pack_name, '')::varchar   AS paket,
        COALESCE(a.amount_due, 0)::numeric   AS potenzial,
        NULL::varchar                        AS quelle,
        NULL::varchar                        AS kampagne,
        LEFT(COALESCE(NULLIF(a.zip,''), ''), 2)::varchar AS plz_gebiet,
        (${APP_PHONE_SQL} IS NOT NULL)       AS hat_telefon,
        (COALESCE(NULLIF(a.email,''), NULLIF(a.contact_email,''), NULLIF(a.billing_email,'')) IS NOT NULL) AS hat_email,
        (a.number_corrected_at IS NOT NULL)  AS nummer_korrigiert,
        (a.payment_status = 'claimed_paid')  AS zahlung_angekuendigt,
        EXISTS (
          SELECT 1 FROM fiaon_contact_log c
          WHERE c.ref = a.ref AND c.scheduled_at IS NOT NULL AND c.voided_at IS NULL
            AND c.done_at IS NULL AND c.scheduled_at <= NOW() AND c.scheduled_at > NOW() - INTERVAL '7 days'
        )                                    AS rueckruf_faellig,
        EXISTS (
          SELECT 1 FROM fiaon_contact_log c
          WHERE c.ref = a.ref AND c.type = ANY('{${CONTACT_TYPES.join(",")}}') AND c.voided_at IS NULL
        )                                    AS betreut,
        (SELECT MAX(c.created_at) FROM fiaon_contact_log c
          WHERE c.ref = a.ref AND c.type = ANY('{${CONTACT_TYPES.join(",")}}') AND c.voided_at IS NULL
        )                                    AS letzter_kontakt
      FROM fiaon_applications a
      WHERE a.merged_into IS NULL
        AND a.dismissed_at IS NULL
        AND a.payment_status = ANY('{${OPEN_PAYMENT_STATUS.join(",")}}')
        ${appContactRule}

      UNION ALL

      -- ── Lead-only (kein Antrag derselben Person) ────────────────────────
      SELECT
        'lead'::varchar                      AS kind,
        l.id::varchar                        AS target_id,
        'lead-' || l.id                      AS card_id,
        l.erstellt_am                        AS created_at,
        l.assigned_agent_id                  AS assigned_agent_id,
        l.opened_by_agent_id                 AS opened_by_agent_id,
        l.opened_at                          AS opened_at,
        l.kartei_claimed_at                  AS kartei_claimed_at,
        'lead'::varchar                      AS lifecycle,
        ''::varchar                          AS paket,
        0::numeric                           AS potenzial,
        l.quelle                             AS quelle,
        l.kampagne                           AS kampagne,
        ''::varchar                          AS plz_gebiet,
        (COALESCE(l.telefon,'') <> '')       AS hat_telefon,
        (COALESCE(l.email,'') <> '')         AS hat_email,
        (l.number_corrected_at IS NOT NULL
          AND (l.letzter_kontakt_am IS NULL OR l.number_corrected_at > l.letzter_kontakt_am)) AS nummer_korrigiert,
        FALSE                                AS zahlung_angekuendigt,
        EXISTS (
          SELECT 1 FROM fiaon_lead_log g
          WHERE g.lead_id = l.id AND g.scheduled_at IS NOT NULL
            AND g.scheduled_at <= NOW() AND g.scheduled_at > NOW() - INTERVAL '7 days'
        )                                    AS rueckruf_faellig,
        EXISTS (
          SELECT 1 FROM fiaon_lead_log g
          WHERE g.lead_id = l.id AND g.type = ANY('{${CONTACT_TYPES.join(",")}}')
        )                                    AS betreut,
        (SELECT MAX(g.created_at) FROM fiaon_lead_log g
          WHERE g.lead_id = l.id AND g.type = ANY('{${CONTACT_TYPES.join(",")}}')
        )                                    AS letzter_kontakt
      FROM fiaon_leads l
      WHERE l.status = ANY('{${OPEN_LEAD_STATUS.join(",")}}')
        AND l.dismissed_at IS NULL
        AND l.converted_order_id IS NULL
        AND (l.requeue_at IS NULL OR l.requeue_at <= NOW())
        ${leadContactRule}
        AND ${LEAD_HAS_NO_APP_SIBLING}
    )`;
}

/**
 * Serverseitiger Rang. Der Agent sieht den Score NIE — er nimmt oben weg.
 * Rosinenpicken ist ausgeschlossen, weil ohnehin keine Kontaktdaten sichtbar sind.
 *
 * Ehrliche Grenze: „Mail geöffnet/geklickt" ist NICHT enthalten — die Plattform
 * versendet über Make/Brevo und speichert keine Öffnungs-/Klick-Ereignisse.
 * Als Reaktionssignal zählen daher: fälliger Rückruf, „Zahlung angekündigt"
 * und eine vom Kunden selbst korrigierte Telefonnummer.
 */
const SCORE_SQL = `
  (
      $1::numeric * EXP(-EXTRACT(EPOCH FROM (NOW() - k.created_at)) / 86400.0 / 7.0)
    + $2::numeric * LEAST(1.0, k.potenzial / 500.0)
    + CASE WHEN k.rueckruf_faellig THEN $3::numeric ELSE 0 END
    + CASE WHEN k.zahlung_angekuendigt THEN $3::numeric * 0.8 ELSE 0 END
    + CASE WHEN k.nummer_korrigiert THEN $3::numeric * 0.6 ELSE 0 END
    + CASE WHEN LOWER(COALESCE(k.kampagne,'') || ' ' || COALESCE(k.quelle,'')) LIKE '%business%'
           THEN $2::numeric * 0.5 ELSE 0 END
    + CASE WHEN k.letzter_kontakt IS NULL THEN $4::numeric
           ELSE $4::numeric * LEAST(1, EXTRACT(EPOCH FROM (NOW() - k.letzter_kontakt)) / 86400.0 / 14.0) END
  )`;

// ═══════════════════════════════════════════════════════════════════
// MASKIERUNG — serverseitig, nicht im Frontend
// ═══════════════════════════════════════════════════════════════════

/**
 * Freie/vergebene Karte: Es wird ein NEUES Objekt gebaut, nie die Datenbankzeile
 * durchgereicht. Name, Telefon, E-Mail und Adresse existieren in dieser Antwort
 * schlicht nicht — auch nicht als leeres Feld. Die zugehörige SQL selektiert
 * sie bereits nicht (siehe karteiCte).
 */
function maskCard(k: any, viewerId: number): Record<string, unknown> {
  const assigned = k.assigned_agent_id ? Number(k.assigned_agent_id) : null;
  const mine = assigned === viewerId;
  return {
    cardId: k.card_id,
    kind: k.kind,
    zustand: assigned ? (mine ? "meine" : "vergeben") : "frei",
    bearbeiterName: assigned && !mine ? k.agent_name || "einem Kollegen" : null,
    // ── neutrale Merkmale (bewusst die einzigen sichtbaren) ──
    status: k.lifecycle,
    quelle: k.quelle || null,
    kampagne: k.kampagne || null,
    paket: k.paket || null,
    potenzialCents: k.potenzial != null ? Math.round(Number(k.potenzial) * 100) : null,
    region: k.plz_gebiet ? `PLZ ${k.plz_gebiet}…` : null,
    alterTage: k.created_at
      ? Math.max(0, Math.floor((Date.now() - new Date(k.created_at).getTime()) / 86_400_000))
      : null,
    hatTelefon: !!k.hat_telefon,
    hatEmail: !!k.hat_email,
    rueckrufFaellig: !!k.rueckruf_faellig,
    zahlungAngekuendigt: !!k.zahlung_angekuendigt,
    nummerKorrigiert: !!k.nummer_korrigiert,
    betreut: !!k.betreut,
    // Der Score wird NICHT ausgeliefert — sonst wird das Ranking gespielt.
  };
}

// ═══════════════════════════════════════════════════════════════════
// P1-C — AUTO-RELEASE der aktiven Akte (Deadlock-Schutz)
// P1-E — HORTUNGS-SCHUTZ (nie bearbeitete Akte geht zurück)
// Beides läuft lazy bei jedem Kartei-Abruf — kein zusätzlicher Cron.
// ═══════════════════════════════════════════════════════════════════

/**
 * Aktive Akte ohne dokumentiertes Ergebnis nach X Minuten freigeben.
 * WICHTIG: Nur `opened_at` wird genullt — die ZUWEISUNG bleibt. Der Agent
 * verliert also nichts, er kann nur wieder eine andere Akte aktiv setzen.
 */
async function autoReleaseActive(minutes: number): Promise<number> {
  if (minutes <= 0) return 0;
  const leads = await sqlPool`
    UPDATE fiaon_leads SET opened_at = NULL, updated_at = NOW()
    WHERE opened_at IS NOT NULL AND opened_at < NOW() - make_interval(mins => ${minutes})
      AND status = ANY(${OPEN_LEAD_STATUS})
    RETURNING id, opened_by_agent_id
  `;
  const apps = await sqlPool`
    UPDATE fiaon_applications SET opened_at = NULL, updated_at = NOW()
    WHERE opened_at IS NOT NULL AND opened_at < NOW() - make_interval(mins => ${minutes})
      AND payment_status = ANY(${OPEN_PAYMENT_STATUS})
    RETURNING ref, opened_by_agent_id
  `;
  const note = `Aktive Bearbeitung nach ${minutes} Min. ohne dokumentiertes Ergebnis automatisch beendet. Die Akte bleibt dir zugewiesen — du kannst jetzt die nächste öffnen.`;
  for (const r of leads) {
    await logLead(Number(r.id), { id: null, name: "System" }, "system", { note }).catch(() => {});
    await karteiEvent({ kind: "lead", targetId: String(r.id), cardId: `lead-${r.id}` }, r.opened_by_agent_id, "release_auto", { reason: note });
  }
  for (const r of apps) {
    await logAction(r.ref, { id: null as any, name: "System" }, "system", { note }).catch(() => {});
    await karteiEvent({ kind: "app", targetId: r.ref, cardId: r.ref }, r.opened_by_agent_id, "release_auto", { reason: note });
  }
  return leads.length + apps.length;
}

/**
 * P1-E: Übernommene, NIE bearbeitete Akte (kein dokumentierter Kontakt) geht
 * nach X Tagen zurück in die freie Kartei. Akten MIT dokumentierter Betreuung
 * bleiben beim Agenten — Beziehung und Provisionsanspruch sind geschützt.
 */
async function releaseHoardedCards(days: number): Promise<number> {
  if (days <= 0) return 0;
  const leads = await sqlPool`
    UPDATE fiaon_leads l SET assigned_agent_id = NULL, opened_at = NULL, kartei_claimed_at = NULL, updated_at = NOW()
    WHERE l.assigned_agent_id IS NOT NULL
      AND l.kartei_claimed_at IS NOT NULL
      AND l.kartei_claimed_at < NOW() - make_interval(days => ${days})
      AND l.status = ANY(${OPEN_LEAD_STATUS})
      AND l.dismissed_at IS NULL
      AND NOT EXISTS (
        SELECT 1 FROM fiaon_lead_log g WHERE g.lead_id = l.id AND g.type = ANY(${CONTACT_TYPES})
      )
    RETURNING l.id, l.assigned_agent_id AS was_agent_id
  `;
  const apps = await sqlPool`
    UPDATE fiaon_applications a SET assigned_agent_id = NULL, opened_at = NULL, kartei_claimed_at = NULL, updated_at = NOW()
    WHERE a.assigned_agent_id IS NOT NULL
      AND a.kartei_claimed_at IS NOT NULL
      AND a.kartei_claimed_at < NOW() - make_interval(days => ${days})
      AND a.payment_status = ANY(${OPEN_PAYMENT_STATUS})
      AND a.merged_into IS NULL AND a.dismissed_at IS NULL
      AND NOT EXISTS (
        SELECT 1 FROM fiaon_contact_log c WHERE c.ref = a.ref AND c.type = ANY(${CONTACT_TYPES}) AND c.voided_at IS NULL
      )
    RETURNING a.ref, a.assigned_agent_id AS was_agent_id
  `;
  const note = `Hortungs-Schutz: Die Akte wurde vor über ${days} Tagen übernommen, aber nie bearbeitet (kein dokumentierter Kontakt). Sie ist zurück in der offenen Kartei und kann von jedem übernommen werden.`;
  for (const r of leads) {
    await logLead(Number(r.id), { id: null, name: "System" }, "system", { note }).catch(() => {});
    await karteiEvent({ kind: "lead", targetId: String(r.id), cardId: `lead-${r.id}` }, r.was_agent_id, "release_hoarding", { reason: note });
  }
  for (const r of apps) {
    await logAction(r.ref, { id: null as any, name: "System" }, "system", { note }).catch(() => {});
    await karteiEvent({ kind: "app", targetId: r.ref, cardId: r.ref }, r.was_agent_id, "release_hoarding", { reason: note });
  }
  if (leads.length + apps.length > 0) {
    console.log(`[FIAON-KARTEI] Hortungs-Schutz: ${leads.length + apps.length} Akte(n) zurück in die Kartei`);
  }
  return leads.length + apps.length;
}

/** Wird vor jedem Kartei-Zugriff ausgeführt. Fehler dürfen nie blockieren. */
async function housekeeping(w: ReturnType<typeof karteiWeights>): Promise<void> {
  await autoReleaseActive(w.autoReleaseMin).catch((e) => console.error("[FIAON-KARTEI] auto-release:", e));
  await releaseHoardedCards(w.hoardingDays).catch((e) => console.error("[FIAON-KARTEI] hoarding:", e));
}

/** Die eine aktive Akte des Agenten (über beide Kartenarten hinweg). */
async function activeCardOf(agentId: number): Promise<CardRef | null> {
  const [lead] = await sqlPool`
    SELECT id FROM fiaon_leads
    WHERE opened_by_agent_id = ${agentId} AND opened_at IS NOT NULL AND status = ANY(${OPEN_LEAD_STATUS})
    ORDER BY opened_at DESC LIMIT 1
  `;
  if (lead) return { kind: "lead", targetId: String(lead.id), cardId: `lead-${lead.id}` };
  const [app] = await sqlPool`
    SELECT ref FROM fiaon_applications
    WHERE opened_by_agent_id = ${agentId} AND opened_at IS NOT NULL AND payment_status = ANY(${OPEN_PAYMENT_STATUS})
      AND merged_into IS NULL
    ORDER BY opened_at DESC LIMIT 1
  `;
  if (app) return { kind: "app", targetId: app.ref, cardId: app.ref };
  return null;
}

// ═══════════════════════════════════════════════════════════════════
// P1-A — DIE KARTEI: GET /agent/kartei?tab=frei|meine|alle
// Serverseitig paginiert und sortiert. Kontaktdaten werden NIE
// ausgeliefert — auch nicht im rohen Response (siehe karteiCte/maskCard).
// ═══════════════════════════════════════════════════════════════════
router.get("/agent/kartei", requireAgent, async (req: AgentRequest, res: Response) => {
  try {
    await ensureKarteiTables();
    const me = req.agent!.id;
    const w = karteiWeights(await getSettings());
    await housekeeping(w);

    const tab = ["frei", "meine", "alle"].includes(String(req.query.tab)) ? String(req.query.tab) : "frei";
    const limit = Math.min(100, Math.max(10, Number(req.query.limit) || 30));
    const offset = Math.max(0, Number(req.query.offset) || 0);
    // Suche in der freien Kartei ausschließlich über NEUTRALE Merkmale
    // (Quelle, Kampagne, Paket, Region) — niemals über Name/Telefon/E-Mail.
    const q = String(req.query.q || "").trim().slice(0, 80);

    // Die Platzhalter werden FORTLAUFEND vergeben, statt feste Nummern zu
    // verwenden. Vorher waren $5 (Agent) und $6 (Suche) fest verdrahtet und
    // wurden trotzdem immer mitgeschickt — im Tab „frei" ohne Suche kamen sie
    // im SQL aber nie vor. Postgres kann den Typ eines nie referenzierten
    // Parameters nicht bestimmen und bricht die gesamte Abfrage ab (42P18).
    // Der Zaehler lief weiter (er hat gar keine Parameter), die Liste nicht —
    // genau der Widerspruch „FREI: 768" ueber „Die Kartei ist gerade leer.".
    const params: any[] = [w.wFresh, w.wValue, w.wReact, w.wContact];
    const p = (value: unknown): string => `$${params.push(value)}`;

    const where: string[] = [];
    if (tab === "frei") where.push("k.assigned_agent_id IS NULL");
    else if (tab === "meine") where.push(`k.assigned_agent_id = ${p(me)}`);
    if (q) {
      const like = p(`%${q}%`);
      where.push(`(
        COALESCE(k.quelle,'') ILIKE ${like} OR COALESCE(k.kampagne,'') ILIKE ${like}
        OR COALESCE(k.paket,'') ILIKE ${like} OR COALESCE(k.plz_gebiet,'') ILIKE ${like}
        OR COALESCE(k.lifecycle,'') ILIKE ${like}
      )`);
    }
    const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";
    const limitPh = p(limit);
    const offsetPh = p(offset);

    const sql = `
      ${karteiCte(w)}
      SELECT k.*, ag.name AS agent_name, ${SCORE_SQL} AS score, COUNT(*) OVER() AS total_count
      FROM kartei k
      LEFT JOIN fiaon_agents ag ON ag.id = k.assigned_agent_id
      ${whereSql}
      ORDER BY score DESC, k.created_at DESC
      LIMIT ${limitPh} OFFSET ${offsetPh}
    `;
    const rows = await sqlPool.unsafe(sql, params);
    const total = rows.length > 0 ? Number(rows[0].total_count) : 0;
    let cards = rows.map((r: any) => maskCard(r, me));

    // P1-F Wartezeit-Ausgleich: In der FREIEN Kartei kommt jeder N-te Platz
    // aus dem ältesten Bestand, damit alte Einträge nicht ewig liegenbleiben.
    if (tab === "frei" && !q) {
      const oldest = await sqlPool.unsafe(
        `${karteiCte(w)}
         SELECT k.*, NULL::varchar AS agent_name FROM kartei k
         WHERE k.assigned_agent_id IS NULL
         ORDER BY k.created_at ASC
         LIMIT $1 OFFSET $2`,
        [Math.ceil(limit / w.fairnessNth), Math.floor(offset / w.fairnessNth)],
      );
      cards = interleaveFairness(cards, oldest.map((r: any) => maskCard(r, me)), w.fairnessNth, limit);
    }

    const active = await activeCardOf(me);
    res.json({
      ok: true,
      tab,
      cards,
      total,
      hasMore: offset + rows.length < total,
      activeCardId: active?.cardId || null,
      // Der Agent muss wissen, warum er gerade keine zweite Akte öffnen kann.
      autoReleaseMinutes: w.autoReleaseMin,
    });
  } catch (err) {
    console.error("[FIAON-KARTEI] liste:", err);
    res.status(500).json({ ok: false, error: "Serverfehler" });
  }
});

/** Jeder N-te Platz aus dem ältesten Bestand — ohne Dubletten in der Liste. */
function interleaveFairness(
  scored: Record<string, unknown>[],
  oldest: Record<string, unknown>[],
  nth: number,
  limit: number,
): Record<string, unknown>[] {
  const seen = new Set<string>();
  const out: Record<string, unknown>[] = [];
  let oldIdx = 0;
  for (let i = 0; i < scored.length && out.length < limit; i++) {
    if ((out.length + 1) % nth === 0) {
      while (oldIdx < oldest.length && seen.has(String(oldest[oldIdx].cardId))) oldIdx++;
      if (oldIdx < oldest.length) {
        const o = oldest[oldIdx++];
        seen.add(String(o.cardId));
        out.push(o);
        if (out.length >= limit) break;
      }
    }
    const s = scored[i];
    if (seen.has(String(s.cardId))) continue;
    seen.add(String(s.cardId));
    out.push(s);
  }
  return out;
}

// ═══════════════════════════════════════════════════════════════════
// P1-B — ÜBERNAHME (Doppelbestätigung im UI, atomar im Server)
//
// Das Rennen zweier Agenten um dieselbe Karte wird über
// `FOR UPDATE SKIP LOCKED` entschieden: Wer die Zeile zuerst sperrt,
// bekommt sie; der andere erhält 409 mit freundlichem Text.
//
// Die Übernahme ist der ZUWEISUNGS-Nachweis. Sie wird als Typ `claim`
// protokolliert und zählt damit — wie bisher — NICHT als dokumentierte
// Betreuung. Die Provisionslogik aus Phase 2 (Anspruch nur bei
// dokumentiertem Kontakt vor Zahlung) bleibt dadurch unverändert.
// ═══════════════════════════════════════════════════════════════════
router.post("/agent/kartei/:cardId/claim", requireAgent, async (req: AgentRequest, res: Response) => {
  try {
    await ensureKarteiTables();
    const me = req.agent!.id;
    const w = karteiWeights(await getSettings());
    await housekeeping(w);

    const card = parseCardId(req.params.cardId);
    if (!card) return res.status(400).json({ ok: false, error: "Karten-Nummer ungültig" });

    // P1-C: nur EINE Akte gleichzeitig in aktiver Bearbeitung.
    const active = await activeCardOf(me);
    if (active && active.cardId !== card.cardId) {
      return res.status(409).json({
        ok: false,
        code: "active_file",
        activeCardId: active.cardId,
        error: "Du hast bereits eine Akte in Bearbeitung. Dokumentiere zuerst ein Kontakt-Ergebnis oder schließe sie mit Begründung — danach ist die nächste sofort frei.",
      });
    }

    const claimed = card.kind === "lead"
      ? await claimLead(Number(card.targetId), me)
      : await claimApp(card.targetId, me);

    if (!claimed.ok) {
      return res.status(claimed.code).json({ ok: false, code: claimed.reason, error: claimed.error });
    }

    const note = `Akte aus der offenen Kartei übernommen durch ${req.agent!.name}. Ab jetzt sind alle Daten sichtbar; die Betreuung liegt bei ihm/ihr.`;
    if (card.kind === "lead") await logLead(Number(card.targetId), req.agent!, "claim", { note }).catch(() => {});
    else await logAction(card.targetId, req.agent!, "claim", { note }).catch(() => {});
    await karteiEvent(card, me, "claim", { actor: req.agent!.name, reason: note });
    await logAgentEvent(me, "kartei_claim", { card_id: card.cardId, kind: card.kind }).catch(() => {});
    console.log(`[FIAON-KARTEI] Übernahme ${card.cardId} durch #${me} (${req.agent!.name})`);

    res.json({ ok: true, cardId: card.cardId, kind: card.kind, targetId: card.targetId });
  } catch (err) {
    console.error("[FIAON-KARTEI] claim:", err);
    res.status(500).json({ ok: false, error: "Serverfehler" });
  }
});

type ClaimResult = { ok: true } | { ok: false; code: number; reason: string; error: string };

const RACE_LOST = "Diese Akte wurde gerade von jemand anderem übernommen. Die nächste liegt schon oben in der Kartei.";

async function claimLead(id: number, agentId: number): Promise<ClaimResult> {
  const rows = await sqlPool`
    WITH pick AS (
      SELECT l.id FROM fiaon_leads l
      WHERE l.id = ${id}
        AND l.assigned_agent_id IS NULL
        AND l.status = ANY(${OPEN_LEAD_STATUS})
        AND l.dismissed_at IS NULL
        AND l.converted_order_id IS NULL
      FOR UPDATE SKIP LOCKED
    )
    UPDATE fiaon_leads l SET
      assigned_agent_id = ${agentId},
      opened_by_agent_id = ${agentId},
      opened_at = NOW(),
      kartei_claimed_at = NOW(),
      requeue_at = NULL,
      updated_at = NOW()
    FROM pick WHERE l.id = pick.id
    RETURNING l.id
  `;
  if (rows.length > 0) return { ok: true };
  const [cur] = await sqlPool`SELECT assigned_agent_id, status FROM fiaon_leads WHERE id = ${id}`;
  if (!cur) return { ok: false, code: 404, reason: "not_found", error: "Diese Akte gibt es nicht (mehr)." };
  if (cur.assigned_agent_id && Number(cur.assigned_agent_id) === agentId) return { ok: true };
  if (cur.assigned_agent_id) return { ok: false, code: 409, reason: "race_lost", error: RACE_LOST };
  return { ok: false, code: 409, reason: "gone", error: "Diese Akte ist nicht mehr in der Kartei (bezahlt, storniert oder zusammengeführt)." };
}

async function claimApp(ref: string, agentId: number): Promise<ClaimResult> {
  const rows = await sqlPool`
    WITH pick AS (
      SELECT a.ref FROM fiaon_applications a
      WHERE a.ref = ${ref}
        AND a.assigned_agent_id IS NULL
        AND a.payment_status = ANY(${OPEN_PAYMENT_STATUS})
        AND a.merged_into IS NULL
        AND a.dismissed_at IS NULL
      FOR UPDATE SKIP LOCKED
    )
    UPDATE fiaon_applications a SET
      assigned_agent_id = ${agentId},
      opened_by_agent_id = ${agentId},
      opened_at = NOW(),
      kartei_claimed_at = NOW(),
      locked_by_agent_id = NULL,
      locked_until = NULL,
      updated_at = NOW()
    FROM pick WHERE a.ref = pick.ref
    RETURNING a.ref
  `;
  if (rows.length > 0) return { ok: true };
  const [cur] = await sqlPool`SELECT assigned_agent_id, payment_status, merged_into FROM fiaon_applications WHERE ref = ${ref}`;
  if (!cur) return { ok: false, code: 404, reason: "not_found", error: "Diese Akte gibt es nicht (mehr)." };
  if (cur.assigned_agent_id && Number(cur.assigned_agent_id) === agentId) return { ok: true };
  if (cur.assigned_agent_id) return { ok: false, code: 409, reason: "race_lost", error: RACE_LOST };
  if (cur.payment_status === "paid") {
    return {
      ok: false, code: 409, reason: "self_paid",
      error: "Dieser Kunde hat inzwischen selbst bezahlt — die Akte hat die Kartei verlassen. (Direktzahler: keine nachträgliche Übernahme.)",
    };
  }
  return { ok: false, code: 409, reason: "gone", error: "Diese Akte ist nicht mehr in der Kartei (storniert oder zusammengeführt)." };
}

// ═══════════════════════════════════════════════════════════════════
// P1-C/D — AKTE SCHLIESSEN bzw. BEWUSST ZURÜCKGEBEN
// „schliessen" beendet nur die aktive Bearbeitung (Akte bleibt meine).
// „zurueckgeben" gibt die Akte wirklich in die freie Kartei zurück.
// Beides mit Begründung, beides protokolliert — kein stiller Verlust.
// ═══════════════════════════════════════════════════════════════════
router.post("/agent/kartei/:cardId/release", requireAgent, async (req: AgentRequest, res: Response) => {
  try {
    await ensureKarteiTables();
    const me = req.agent!.id;
    const card = parseCardId(req.params.cardId);
    if (!card) return res.status(400).json({ ok: false, error: "Karten-Nummer ungültig" });
    const mode = String(req.body?.mode || "schliessen");
    if (!["schliessen", "zurueckgeben"].includes(mode)) {
      return res.status(400).json({ ok: false, error: "Unbekannte Rückgabe-Art" });
    }
    const reason = String(req.body?.reason || "").trim().slice(0, 500);
    if (reason.length < 3) {
      return res.status(400).json({ ok: false, error: "Bitte kurz begründen (z. B. „Feierabend“ oder „passt nicht zu mir“)." });
    }

    const giveBack = mode === "zurueckgeben";
    const rows = card.kind === "lead"
      ? await sqlPool`
          UPDATE fiaon_leads SET
            opened_at = NULL,
            assigned_agent_id = CASE WHEN ${giveBack} THEN NULL ELSE assigned_agent_id END,
            kartei_claimed_at = CASE WHEN ${giveBack} THEN NULL ELSE kartei_claimed_at END,
            updated_at = NOW()
          WHERE id = ${Number(card.targetId)} AND assigned_agent_id = ${me}
          RETURNING id
        `
      : await sqlPool`
          UPDATE fiaon_applications SET
            opened_at = NULL,
            assigned_agent_id = CASE WHEN ${giveBack} THEN NULL ELSE assigned_agent_id END,
            kartei_claimed_at = CASE WHEN ${giveBack} THEN NULL ELSE kartei_claimed_at END,
            updated_at = NOW()
          WHERE ref = ${card.targetId} AND assigned_agent_id = ${me}
          RETURNING ref
        `;
    if (rows.length === 0) {
      return res.status(404).json({ ok: false, error: "Diese Akte gehört dir nicht (mehr)." });
    }

    const note = giveBack
      ? `Akte bewusst an die offene Kartei zurückgegeben durch ${req.agent!.name}. Begründung: ${reason}`
      : `Aktive Bearbeitung beendet durch ${req.agent!.name} (kein Kontakt-Ergebnis). Begründung: ${reason}. Die Akte bleibt zugewiesen.`;
    if (card.kind === "lead") await logLead(Number(card.targetId), req.agent!, "system", { note }).catch(() => {});
    else await logAction(card.targetId, req.agent!, "system", { note }).catch(() => {});
    await karteiEvent(card, me, "release_manual", { actor: req.agent!.name, reason: note, meta: { mode } });

    res.json({ ok: true, mode });
  } catch (err) {
    console.error("[FIAON-KARTEI] release:", err);
    res.status(500).json({ ok: false, error: "Serverfehler" });
  }
});

// ═══════════════════════════════════════════════════════════════════
// P1-E — STATUS + VORWARNUNG (Kopfkarte im Portal)
// „3 Akten laufen in 2 Tagen zurück" — bevor es passiert.
// ═══════════════════════════════════════════════════════════════════
router.get("/agent/kartei/status", requireAgent, async (req: AgentRequest, res: Response) => {
  try {
    await ensureKarteiTables();
    const me = req.agent!.id;
    const w = karteiWeights(await getSettings());
    await housekeeping(w);

    const active = await activeCardOf(me);
    const [frei] = await sqlPool.unsafe(
      `${karteiCte(w)} SELECT COUNT(*)::int AS c FROM kartei k WHERE k.assigned_agent_id IS NULL`,
      [],
    );
    const [meine] = await sqlPool.unsafe(
      `${karteiCte(w)} SELECT COUNT(*)::int AS c FROM kartei k WHERE k.assigned_agent_id = $1`,
      [me],
    );

    // Rückläufer-Vorwarnung: übernommen, nie bearbeitet, Frist läuft bald ab.
    let warnCount = 0;
    let warnInDays: number | null = null;
    if (w.hoardingDays > 0) {
      const cutoff = Math.max(0, w.hoardingDays - w.hoardingWarnDays);
      const [lw] = await sqlPool`
        SELECT COUNT(*)::int AS c,
               MIN(l.kartei_claimed_at) AS oldest
        FROM fiaon_leads l
        WHERE l.assigned_agent_id = ${me} AND l.kartei_claimed_at IS NOT NULL
          AND l.kartei_claimed_at < NOW() - make_interval(days => ${cutoff})
          AND l.status = ANY(${OPEN_LEAD_STATUS}) AND l.dismissed_at IS NULL
          AND NOT EXISTS (SELECT 1 FROM fiaon_lead_log g WHERE g.lead_id = l.id AND g.type = ANY(${CONTACT_TYPES}))
      `;
      const [aw] = await sqlPool`
        SELECT COUNT(*)::int AS c,
               MIN(a.kartei_claimed_at) AS oldest
        FROM fiaon_applications a
        WHERE a.assigned_agent_id = ${me} AND a.kartei_claimed_at IS NOT NULL
          AND a.kartei_claimed_at < NOW() - make_interval(days => ${cutoff})
          AND a.payment_status = ANY(${OPEN_PAYMENT_STATUS}) AND a.merged_into IS NULL AND a.dismissed_at IS NULL
          AND NOT EXISTS (SELECT 1 FROM fiaon_contact_log c WHERE c.ref = a.ref AND c.type = ANY(${CONTACT_TYPES}) AND c.voided_at IS NULL)
      `;
      warnCount = Number(lw.c) + Number(aw.c);
      const oldest = [lw.oldest, aw.oldest].filter(Boolean).map((d: any) => new Date(d).getTime());
      if (oldest.length > 0) {
        const deadline = Math.min(...oldest) + w.hoardingDays * 86_400_000;
        warnInDays = Math.max(0, Math.ceil((deadline - Date.now()) / 86_400_000));
      }
    }

    res.json({
      ok: true,
      activeCardId: active?.cardId || null,
      freieKarten: Number(frei?.c || 0),
      meineKarten: Number(meine?.c || 0),
      ruecklaeufer: { anzahl: warnCount, inTagen: warnInDays, fristTage: w.hoardingDays },
      autoReleaseMinutes: w.autoReleaseMin,
    });
  } catch (err) {
    console.error("[FIAON-KARTEI] status:", err);
    res.status(500).json({ ok: false, error: "Serverfehler" });
  }
});

// ═══════════════════════════════════════════════════════════════════
// P1-D — „MEINE KUNDEN": alles, was ich je übernommen habe
// Nichts verschwindet — auch bezahlt/abgeschlossen/abgelaufen bleibt.
// Gemergte Akten bleiben sichtbar MIT Verweis auf den Gewinner-Datensatz,
// damit „mein Kunde ist weg" nicht mehr passieren kann.
// ═══════════════════════════════════════════════════════════════════
const MEINE_FILTER: Record<string, string> = {
  offen: `a.payment_status = 'pending_payment'`,
  angekuendigt: `a.payment_status = 'claimed_paid'`,
  bezahlt: `a.payment_status = 'paid'`,
  abgelaufen: `a.payment_status = 'expired'`,
  storniert: `a.payment_status = 'cancelled'`,
};

router.get("/agent/kartei/meine", requireAgent, async (req: AgentRequest, res: Response) => {
  try {
    await ensureKarteiTables();
    const me = req.agent!.id;
    const filter = String(req.query.filter || "").trim();
    const q = String(req.query.q || "").trim().slice(0, 80);
    const limit = Math.min(100, Math.max(10, Number(req.query.limit) || 40));
    const offset = Math.max(0, Number(req.query.offset) || 0);

    // Eigene Akten: VOLLE Daten — der Agent hat sie übernommen und betreut sie.
    //
    // Auch hier gilt: fortlaufende Platzhalter statt fester Nummern. Vorher
    // wurde $2 (Suchtext) immer mitgeschickt, aber ohne Suchbegriff nie im SQL
    // referenziert — dieselbe 42P18-Falle wie in der Kartei-Liste. Die beiden
    // Abfragen (Antraege und Leads) bekommen bewusst EIGENE Parameterlisten,
    // weil sie unterschiedliche Bedingungen enthalten.
    const params: any[] = [me];
    const p = (value: unknown): string => `$${params.push(value)}`;

    const appWhere = [`a.assigned_agent_id = $1`];
    if (filter && MEINE_FILTER[filter]) appWhere.push(MEINE_FILTER[filter]);
    if (q) {
      const like = p(`%${q}%`);
      appWhere.push(`(
        a.ref ILIKE ${like} OR a.payment_reference ILIKE ${like} OR a.email ILIKE ${like}
        OR a.first_name ILIKE ${like} OR a.last_name ILIKE ${like}
        OR (COALESCE(a.first_name,'') || ' ' || COALESCE(a.last_name,'')) ILIKE ${like}
        OR a.company_name ILIKE ${like} OR a.phone ILIKE ${like}
      )`);
    }
    const appLimit = p(limit);
    const appOffset = p(offset);
    const apps = await sqlPool.unsafe(
      `SELECT 'app' AS kind, a.ref AS card_id, a.ref, a.payment_reference, a.payment_status,
              a.first_name, a.last_name, a.company_name, a.contact_name,
              COALESCE(NULLIF(a.email,''), NULLIF(a.contact_email,''), NULLIF(a.billing_email,'')) AS email,
              COALESCE(a.phone_country_code,'') || COALESCE(a.phone,'') AS phone,
              a.pack_name, a.amount_due, a.created_at, a.updated_at, a.promised_pay_date,
              a.merged_into, a.superseded_by, a.dismissed_at, a.kartei_claimed_at,
              (SELECT MAX(c.created_at) FROM fiaon_contact_log c
                WHERE c.ref = a.ref AND c.type = ANY('{${CONTACT_TYPES.join(",")}}') AND c.voided_at IS NULL) AS letzter_kontakt,
              (SELECT MIN(c.scheduled_at) FROM fiaon_contact_log c
                WHERE c.ref = a.ref AND c.scheduled_at IS NOT NULL AND c.done_at IS NULL
                  AND c.voided_at IS NULL AND c.scheduled_at > NOW() - INTERVAL '1 day') AS naechster_termin,
              COUNT(*) OVER() AS total_count
       FROM fiaon_applications a
       WHERE ${appWhere.join(" AND ")}
       ORDER BY a.updated_at DESC NULLS LAST, a.created_at DESC
       LIMIT ${appLimit} OFFSET ${appOffset}`,
      params,
    );

    // Lead-Akten (nur wenn kein Antrags-Filter aktiv ist).
    let leads: any[] = [];
    if (!filter || filter === "lead" || filter === "tot" || filter === "rueckruf") {
      const leadParams: any[] = [me];
      const lp = (value: unknown): string => `$${leadParams.push(value)}`;
      const leadWhere = [`l.assigned_agent_id = $1`];
      if (filter === "tot") leadWhere.push(`l.status IN ('tot','kein_interesse')`);
      if (filter === "rueckruf") {
        leadWhere.push(`EXISTS (SELECT 1 FROM fiaon_lead_log g WHERE g.lead_id = l.id AND g.scheduled_at IS NOT NULL AND g.scheduled_at > NOW() - INTERVAL '1 day')`);
      }
      if (q) {
        const like = lp(`%${q}%`);
        leadWhere.push(`(
          l.vorname ILIKE ${like} OR l.nachname ILIKE ${like} OR l.email ILIKE ${like} OR l.telefon ILIKE ${like}
          OR (COALESCE(l.vorname,'') || ' ' || COALESCE(l.nachname,'')) ILIKE ${like}
        )`);
      }
      const leadLimit = lp(limit);
      const leadOffset = lp(offset);
      leads = await sqlPool.unsafe(
        `SELECT 'lead' AS kind, 'lead-' || l.id AS card_id, l.id AS lead_id, l.status,
                l.vorname AS first_name, l.nachname AS last_name, l.email, l.telefon AS phone,
                l.quelle, l.kampagne, l.erstellt_am AS created_at, l.updated_at, l.kartei_claimed_at,
                l.converted_order_id,
                (SELECT MAX(g.created_at) FROM fiaon_lead_log g
                  WHERE g.lead_id = l.id AND g.type = ANY('{${CONTACT_TYPES.join(",")}}')) AS letzter_kontakt,
                (SELECT MIN(g.scheduled_at) FROM fiaon_lead_log g
                  WHERE g.lead_id = l.id AND g.scheduled_at IS NOT NULL AND g.scheduled_at > NOW() - INTERVAL '1 day') AS naechster_termin
         FROM fiaon_leads l
         WHERE ${leadWhere.join(" AND ")}
         ORDER BY l.updated_at DESC NULLS LAST, l.erstellt_am DESC
         LIMIT ${leadLimit} OFFSET ${leadOffset}`,
        leadParams,
      );
    }

    res.json({
      ok: true,
      total: apps.length > 0 ? Number(apps[0].total_count) : 0,
      kunden: apps.map((a: any) => ({
        cardId: a.card_id,
        kind: "app",
        ref: a.ref,
        name: [a.first_name, a.last_name].filter(Boolean).join(" ") || a.company_name || a.contact_name || a.ref,
        email: a.email,
        phone: a.phone || null,
        status: a.payment_status,
        paket: a.pack_name,
        betrag: a.amount_due,
        paymentReference: a.payment_reference,
        zusageAm: a.promised_pay_date,
        letzterKontakt: a.letzter_kontakt,
        naechsterTermin: a.naechster_termin,
        // Der häufigste „mein Kunde ist verschwunden"-Fall: sichtbar machen.
        zusammengefuehrtMit: a.merged_into || null,
        ersetztDurch: a.superseded_by || null,
        aussortiertAm: a.dismissed_at || null,
        uebernommenAm: a.kartei_claimed_at,
        createdAt: a.created_at,
      })),
      leads: leads.map((l: any) => ({
        cardId: l.card_id,
        kind: "lead",
        leadId: l.lead_id,
        name: [l.first_name, l.last_name].filter(Boolean).join(" ") || l.email || l.phone || `Lead #${l.lead_id}`,
        email: l.email,
        phone: l.phone,
        status: l.status,
        quelle: l.quelle,
        kampagne: l.kampagne,
        letzterKontakt: l.letzter_kontakt,
        naechsterTermin: l.naechster_termin,
        konvertiertZu: l.converted_order_id || null,
        uebernommenAm: l.kartei_claimed_at,
        createdAt: l.created_at,
      })),
    });
  } catch (err) {
    console.error("[FIAON-KARTEI] meine:", err);
    res.status(500).json({ ok: false, error: "Serverfehler" });
  }
});

// ═══════════════════════════════════════════════════════════════════
// P1-H — ADMIN-GEGENSEITE
// Übersicht, Einstellungen, Notausgang. BEWUSST OHNE Zeit-/Anwesenheits-
// überwachung: gezählt werden nur Ergebnisse (Übernahmen, dokumentierte
// Kontakte, Rückläufer) — keine Online-Zeiten, keine Aktivitätsprotokolle
// (Scheinselbstständigkeit/DSGVO, wie in Phase 4 festgelegt).
// ═══════════════════════════════════════════════════════════════════
router.get("/admin/kartei", async (_req: Request, res: Response) => {
  try {
    await ensureKarteiTables();
    const settings = await getSettings();
    const w = karteiWeights(settings);

    const [gesamt] = await sqlPool.unsafe(
      `${karteiCte(w)}
       SELECT COUNT(*) FILTER (WHERE k.assigned_agent_id IS NULL)::int AS frei,
              COUNT(*) FILTER (WHERE k.assigned_agent_id IS NOT NULL)::int AS vergeben,
              COUNT(*) FILTER (WHERE k.opened_at IS NOT NULL)::int AS in_bearbeitung,
              COUNT(*)::int AS gesamt
       FROM kartei k`,
      [],
    );

    const jeAgent = await sqlPool.unsafe(
      `${karteiCte(w)}
       SELECT ag.id, ag.name, ag.active,
              COUNT(k.card_id)::int AS karten,
              COUNT(k.card_id) FILTER (WHERE k.betreut)::int AS betreut,
              COUNT(k.card_id) FILTER (WHERE NOT k.betreut)::int AS unbearbeitet
       FROM fiaon_agents ag
       LEFT JOIN kartei k ON k.assigned_agent_id = ag.id
       GROUP BY ag.id, ag.name, ag.active
       ORDER BY karten DESC, ag.name ASC`,
      [],
    );

    // Ergebnis-Kennzahlen der letzten 30 Tage — keine Zeitüberwachung.
    const aktivitaet = await sqlPool`
      SELECT e.agent_id, ag.name,
             COUNT(*) FILTER (WHERE e.event = 'claim')::int AS uebernahmen,
             COUNT(*) FILTER (WHERE e.event = 'release_hoarding')::int AS ruecklaeufer,
             COUNT(*) FILTER (WHERE e.event = 'release_manual')::int AS rueckgaben
      FROM fiaon_kartei_events e
      LEFT JOIN fiaon_agents ag ON ag.id = e.agent_id
      WHERE e.created_at > NOW() - INTERVAL '30 days' AND e.agent_id IS NOT NULL
      GROUP BY e.agent_id, ag.name
      ORDER BY uebernahmen DESC
    `;

    const letzteRuecklaeufer = await sqlPool`
      SELECT e.card_id, e.kind, e.event, e.reason, e.created_at, ag.name AS agent_name
      FROM fiaon_kartei_events e
      LEFT JOIN fiaon_agents ag ON ag.id = e.agent_id
      WHERE e.event IN ('release_hoarding', 'release_admin', 'release_manual')
      ORDER BY e.created_at DESC
      LIMIT 50
    `;

    res.json({
      ok: true,
      gesamt,
      jeAgent,
      aktivitaet,
      letzteRuecklaeufer,
      einstellungen: {
        queue_w_fresh: w.wFresh,
        queue_w_value: w.wValue,
        queue_w_react: w.wReact,
        queue_w_contact: w.wContact,
        queue_fairness_nth: w.fairnessNth,
        akte_auto_release_min: w.autoReleaseMin,
        kartei_hoarding_days: w.hoardingDays,
        kartei_hoarding_warn_days: w.hoardingWarnDays,
        kartei_require_full_contact: w.requireFullContact ? 1 : 0,
      },
    });
  } catch (err) {
    console.error("[FIAON-KARTEI] admin:", err);
    res.status(500).json({ ok: false, error: "Serverfehler" });
  }
});

/**
 * Einstellungen der Kartei. Bewusst eine EIGENE Route mit Whitelist und
 * Wertebereichen — die allgemeine Einstellungs-Route kennt nur ihre festen
 * Felder und würde beliebige Schlüssel stillschweigend verwerfen.
 */
const SETTING_RANGE: Record<string, { min: number; max: number }> = {
  queue_w_fresh: { min: 0, max: 1000 },
  queue_w_value: { min: 0, max: 1000 },
  queue_w_react: { min: 0, max: 1000 },
  queue_w_contact: { min: 0, max: 1000 },
  queue_fairness_nth: { min: 2, max: 10 },
  akte_auto_release_min: { min: 0, max: 1440 },
  kartei_hoarding_days: { min: 0, max: 365 },
  kartei_hoarding_warn_days: { min: 0, max: 90 },
  kartei_require_full_contact: { min: 0, max: 1 },
};

router.post("/admin/kartei/settings", async (req: Request, res: Response) => {
  try {
    await ensureKarteiTables();
    const body = req.body || {};
    const changed: string[] = [];
    for (const [key, range] of Object.entries(SETTING_RANGE)) {
      if (body[key] === undefined || body[key] === null || body[key] === "") continue;
      const v = Math.round(Number(body[key]));
      if (!Number.isFinite(v) || v < range.min || v > range.max) {
        return res.status(400).json({ ok: false, error: `Wert für ${key} ungültig (erlaubt: ${range.min}–${range.max}).` });
      }
      await setSetting(key, String(v));
      changed.push(`${key}=${v}`);
    }
    if (changed.length > 0) console.log(`[FIAON-KARTEI] Einstellungen geändert: ${changed.join(", ")}`);
    res.json({ ok: true, changed: changed.length });
  } catch (err) {
    console.error("[FIAON-KARTEI] settings:", err);
    res.status(500).json({ ok: false, error: "Serverfehler" });
  }
});

/** Admin gibt eine Akte frei — Ausnahme, immer protokolliert. */
router.post("/admin/kartei/:cardId/release", async (req: Request, res: Response) => {
  try {
    await ensureKarteiTables();
    const card = parseCardId(req.params.cardId);
    if (!card) return res.status(400).json({ ok: false, error: "Karten-Nummer ungültig" });
    const reason = String(req.body?.reason || "").trim().slice(0, 500) || "Freigabe durch Admin";

    // Vorherigen Bearbeiter merken — RETURNING liefert nach dem UPDATE den NEUEN Wert.
    const [before] = card.kind === "lead"
      ? await sqlPool`SELECT assigned_agent_id FROM fiaon_leads WHERE id = ${Number(card.targetId)}`
      : await sqlPool`SELECT assigned_agent_id FROM fiaon_applications WHERE ref = ${card.targetId}`;
    if (!before) return res.status(404).json({ ok: false, error: "Akte nicht gefunden" });
    const wasAgent = before.assigned_agent_id ? Number(before.assigned_agent_id) : null;

    const rows = card.kind === "lead"
      ? await sqlPool`
          UPDATE fiaon_leads SET assigned_agent_id = NULL, opened_at = NULL, kartei_claimed_at = NULL, updated_at = NOW()
          WHERE id = ${Number(card.targetId)} RETURNING id
        `
      : await sqlPool`
          UPDATE fiaon_applications SET assigned_agent_id = NULL, opened_at = NULL, kartei_claimed_at = NULL, updated_at = NOW()
          WHERE ref = ${card.targetId} RETURNING ref
        `;
    if (rows.length === 0) return res.status(404).json({ ok: false, error: "Akte nicht gefunden" });

    const note = `Akte durch Admin in die offene Kartei zurückgegeben. Grund: ${reason}`;
    if (card.kind === "lead") await logLead(Number(card.targetId), { id: null, name: "Admin" }, "system", { note }).catch(() => {});
    else await logAction(card.targetId, { id: null as any, name: "Admin" }, "system", { note }).catch(() => {});
    await karteiEvent(card, wasAgent, "release_admin", { actor: "Admin", reason: note });
    res.json({ ok: true });
  } catch (err) {
    console.error("[FIAON-KARTEI] admin release:", err);
    res.status(500).json({ ok: false, error: "Serverfehler" });
  }
});

/** Admin weist eine Akte gezielt zu — Ausnahme, immer protokolliert. */
router.post("/admin/kartei/:cardId/assign", async (req: Request, res: Response) => {
  try {
    await ensureKarteiTables();
    const card = parseCardId(req.params.cardId);
    if (!card) return res.status(400).json({ ok: false, error: "Karten-Nummer ungültig" });
    const agentId = Number(req.body?.agentId);
    if (!Number.isFinite(agentId) || agentId <= 0) return res.status(400).json({ ok: false, error: "Agent erforderlich" });
    const reason = String(req.body?.reason || "").trim().slice(0, 500) || "Gezielte Zuweisung durch Admin";

    const [agent] = await sqlPool`SELECT id, name FROM fiaon_agents WHERE id = ${agentId} AND active = TRUE`;
    if (!agent) return res.status(400).json({ ok: false, error: "Agent nicht gefunden oder inaktiv" });

    const rows = card.kind === "lead"
      ? await sqlPool`
          UPDATE fiaon_leads SET assigned_agent_id = ${agentId}, kartei_claimed_at = NOW(), updated_at = NOW()
          WHERE id = ${Number(card.targetId)} RETURNING id
        `
      : await sqlPool`
          UPDATE fiaon_applications SET assigned_agent_id = ${agentId}, kartei_claimed_at = NOW(), updated_at = NOW()
          WHERE ref = ${card.targetId} RETURNING ref
        `;
    if (rows.length === 0) return res.status(404).json({ ok: false, error: "Akte nicht gefunden" });

    const note = `Akte durch Admin gezielt an ${agent.name} zugewiesen (Ausnahme). Grund: ${reason}`;
    if (card.kind === "lead") await logLead(Number(card.targetId), { id: null, name: "Admin" }, "system", { note }).catch(() => {});
    else await logAction(card.targetId, { id: null as any, name: "Admin" }, "system", { note }).catch(() => {});
    await karteiEvent(card, agentId, "assign_admin", { actor: "Admin", reason: note });
    res.json({ ok: true, agentName: agent.name });
  } catch (err) {
    console.error("[FIAON-KARTEI] admin assign:", err);
    res.status(500).json({ ok: false, error: "Serverfehler" });
  }
});

/**
 * Nur für scripts/kartei-verify.ts: gibt die ECHTE Kartei-Abfrage heraus, damit
 * die Maskierungs-Prüfung nicht an einer Kopie vorbeiläuft. Kein Router, keine
 * Route — von außen nicht erreichbar.
 */
export const __karteiCteForTests = karteiCte;
export const __scoreSqlForTests = SCORE_SQL;

export default router;
