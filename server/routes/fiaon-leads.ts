// ═══════════════════════════════════════════════════════════════════
// FIAON Lead-Management (Pakete BA/BB/BC)
// - BA: Lead-Datenmodell (fiaon_leads) + Intake-Webhook + Auto-Konversion
//        (Antrag mit passender E-Mail/Telefon konvertiert offenen Lead) + Backfill.
// - BB: Nachfass-Automatik (Make-Event lead_followup), 8h-Dedupe, Obergrenze,
//        Versandfenster, Not-Aus, Bulk-Versand (20/min).
// - BC: Agent-Anrufliste (getrennt von Kunden), Round-Robin-Verteilung.
//
// STRIKT ADDITIV: nutzt bestehende Bausteine (sendMakeWebhook, normalizePhone,
// getSettings/setSetting, requireAgent, berlinHour-Muster) — verändert KEINE
// bestehende Kunden-/Zahlungs-/Provisionslogik. Die Make-Sequenz „FIAON Lead #1"
// bleibt unangetastet; hier kommt nur EIN paralleler Intake-Aufruf an.
// ═══════════════════════════════════════════════════════════════════

import { Router, type Request, type Response, type NextFunction } from "express";
import { sqlPool } from "../lib/db-pool";
import { sendMakeWebhook } from "../make-webhook";
import { fiaonBaseUrl } from "../fiaon-base-url";
import { parseBerlinInput, pruefeTerminZukunft } from "../lib/fiaon-time";
// P1-C Dauerschutz: Ein Lead ist derselbe Mensch wie der spätere Antrag.
// Ohne diese Bindung zerfällt er in Lead- und Kundenkarte, und der Agent, der
// ihn gewonnen hat, verliert ihn nach dem Antrag aus der Ansicht.
import { bindePersonAnLead } from "../fiaon-person-model";
import { nameTeilen } from "../lib/fiaon-name";
import { waehlbareNummer } from "../lib/fiaon-telefon";
import {
  requireAgent,
  getSettings,
  setSetting,
  normalizePhone,
  type AgentRequest,
} from "./fiaon-agent";
import { tageslauf } from "../lib/fiaon-crons";

const router = Router();       // mount: /api/fiaon  (/admin/leads*, /agent/leads*)
const intakeRouter = Router(); // mount: /api/leads  (/intake)

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const OPEN_STATUSES = ["neu", "kontaktiert", "nicht_erreichbar"] as const;

// ── Tabellen sicherstellen (idempotent, wie bestehende ensure*-Muster) ───────
let leadTablesEnsured = false;
export async function ensureLeadTables(): Promise<void> {
  if (leadTablesEnsured) return;
  await sqlPool`
    CREATE TABLE IF NOT EXISTS fiaon_leads (
      id SERIAL PRIMARY KEY,
      vorname VARCHAR,
      nachname VARCHAR,
      email VARCHAR,                       -- normalisiert (lowercase, getrimmt)
      telefon VARCHAR,                      -- normalisiert (+49…)
      quelle VARCHAR NOT NULL DEFAULT 'facebook_lead_ads',
      kampagne VARCHAR,
      adset VARCHAR,
      status VARCHAR NOT NULL DEFAULT 'neu', -- neu | kontaktiert | nicht_erreichbar | konvertiert | kein_interesse | tot
      assigned_agent_id INTEGER,
      converted_order_id VARCHAR,           -- fiaon_applications.ref
      konvertiert_am TIMESTAMPTZ,
      letzter_kontakt_am TIMESTAMPTZ,
      last_lead_reminder_at TIMESTAMPTZ,
      lead_reminder_count INTEGER NOT NULL DEFAULT 0,
      erstellt_am TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;
  await sqlPool`CREATE INDEX IF NOT EXISTS fiaon_leads_email_idx ON fiaon_leads (LOWER(email))`;
  await sqlPool`CREATE INDEX IF NOT EXISTS fiaon_leads_telefon_idx ON fiaon_leads (telefon)`;
  await sqlPool`CREATE INDEX IF NOT EXISTS fiaon_leads_status_idx ON fiaon_leads (status)`;
  await sqlPool`CREATE INDEX IF NOT EXISTS fiaon_leads_assigned_idx ON fiaon_leads (assigned_agent_id)`;
  await sqlPool`CREATE INDEX IF NOT EXISTS fiaon_leads_created_idx ON fiaon_leads (erstellt_am)`;
  await sqlPool`
    CREATE TABLE IF NOT EXISTS fiaon_lead_log (
      id SERIAL PRIMARY KEY,
      lead_id INTEGER NOT NULL,
      agent_id INTEGER,
      agent_name VARCHAR NOT NULL,
      type VARCHAR NOT NULL,              -- note | result | system | edit | followup | email_sent
      outcome VARCHAR,
      note TEXT,
      scheduled_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;
  await sqlPool`CREATE INDEX IF NOT EXISTS fiaon_lead_log_lead_idx ON fiaon_lead_log (lead_id, created_at)`;

  // Paket CD: Intake-Diagnose — jeder eingehende Intake-Versuch (auch abgelehnte).
  await sqlPool`
    CREATE TABLE IF NOT EXISTS fiaon_lead_intake_log (
      id SERIAL PRIMARY KEY,
      status VARCHAR NOT NULL,            -- ok | rejected_auth | invalid | test
      quelle VARCHAR,
      detail VARCHAR,                     -- ohne sensible Daten
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;
  await sqlPool`CREATE INDEX IF NOT EXISTS fiaon_lead_intake_log_idx ON fiaon_lead_intake_log (created_at)`;

  // Paket BE: Import-/Sequenz-Steuerung (idempotent nachrüsten).
  // in_sequence=FALSE ⇒ Lead wird NICHT automatisch angeschrieben (importierte
  // Alt-Leads starten die Nachfass-Sequenz erst nach bewusstem Opt-in).
  await sqlPool`ALTER TABLE fiaon_leads ADD COLUMN IF NOT EXISTS in_sequence BOOLEAN NOT NULL DEFAULT TRUE`;
  await sqlPool`ALTER TABLE fiaon_leads ADD COLUMN IF NOT EXISTS import_id VARCHAR`;
  // P2-C Arbeitswarteschlange: „Akte öffnen" = dokumentierte Übernahme.
  // opened_at gesetzt = Akte ist OFFEN (max. 1 pro Agent); nach Kontakt-Ergebnis
  // wird opened_at genullt, opened_by_agent_id bleibt als „zuletzt bearbeitet von".
  // requeue_at = Wiedervorlage (Lead taucht erst danach wieder in der Queue auf).
  await sqlPool.unsafe(`
    ALTER TABLE fiaon_leads
      ADD COLUMN IF NOT EXISTS opened_by_agent_id INTEGER,
      ADD COLUMN IF NOT EXISTS opened_at TIMESTAMPTZ,
      ADD COLUMN IF NOT EXISTS requeue_at TIMESTAMPTZ,
      ADD COLUMN IF NOT EXISTS number_corrected_at TIMESTAMPTZ
  `);
  // Ticket #15: „Aus meiner Liste entfernen" — Lead verlässt die Arbeitswarteschlange,
  // bleibt aber VOLLSTÄNDIG in der DB (Direktive: kein Lead wird je gelöscht). Grund +
  // wer/wann werden protokolliert; im Admin unter dem Filter „Aussortiert" jederzeit
  // zurückholbar. KEIN hartes Löschen — das bleibt echten DSGVO-Anfragen vorbehalten.
  await sqlPool.unsafe(`
    ALTER TABLE fiaon_leads
      ADD COLUMN IF NOT EXISTS dismissed_at TIMESTAMPTZ,
      ADD COLUMN IF NOT EXISTS dismissed_by INTEGER,
      ADD COLUMN IF NOT EXISTS dismissed_reason VARCHAR
  `);
  await sqlPool`CREATE INDEX IF NOT EXISTS fiaon_leads_opened_idx ON fiaon_leads (opened_by_agent_id, opened_at)`;
  await sqlPool`CREATE INDEX IF NOT EXISTS fiaon_leads_dismissed_idx ON fiaon_leads (dismissed_at)`;
  await sqlPool`CREATE INDEX IF NOT EXISTS fiaon_leads_import_idx ON fiaon_leads (import_id)`;
  await sqlPool`
    CREATE TABLE IF NOT EXISTS fiaon_lead_imports (
      import_id VARCHAR PRIMARY KEY,
      admin_name VARCHAR,
      source VARCHAR,
      campaign VARCHAR,
      add_to_sequence BOOLEAN NOT NULL DEFAULT FALSE,
      total INTEGER NOT NULL DEFAULT 0,
      imported INTEGER NOT NULL DEFAULT 0,
      converted INTEGER NOT NULL DEFAULT 0,
      updated INTEGER NOT NULL DEFAULT 0,
      skipped INTEGER NOT NULL DEFAULT 0,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;
  leadTablesEnsured = true;
  console.log("[FIAON-LEADS] Lead-Tabellen sichergestellt");

  // CB: Einmalige Migration des Standard-Sendefensters auf 09–18 Uhr.
  // Greift nur, wenn noch der alte, enge Default (10→11) gespeichert ist —
  // eine bewusst gewählte andere Einstellung bleibt unangetastet.
  try {
    const s = await getSettings();
    if (s.lead_followup_window_migrated_v2 !== "1") {
      if (s.lead_followup_window_start === "10" && s.lead_followup_window_end === "11") {
        await setSetting("lead_followup_window_start", "9");
        await setSetting("lead_followup_window_end", "18");
        console.log("[FIAON-LEADS] Sendefenster migriert: 10–11 → 09–18 Uhr");
      }
      await setSetting("lead_followup_window_migrated_v2", "1");
    }
  } catch (err) {
    console.error("[FIAON-LEADS] Fenster-Migration:", err);
  }
}

export async function logLead(
  leadId: number,
  actor: { id: number | null; name: string },
  type: string,
  fields: { outcome?: string | null; note?: string | null; scheduledAt?: string | null } = {},
): Promise<any> {
  const rows = await sqlPool`
    INSERT INTO fiaon_lead_log (lead_id, agent_id, agent_name, type, outcome, note, scheduled_at)
    VALUES (${leadId}, ${actor.id}, ${actor.name}, ${type}, ${fields.outcome || null}, ${fields.note || null},
            ${parseBerlinInput(fields.scheduledAt)})
    RETURNING *
  `;
  return rows[0];
}

function leadName(l: any): string {
  return [l.vorname, l.nachname].filter(Boolean).join(" ") || l.email || l.telefon || `Lead #${l.id}`;
}
function antragUrl(leadId: number): string {
  return `${fiaonBaseUrl()}/antrag?lead=${leadId}`;
}

// ── Zeit-Fenster (identisch zur bestehenden Payment-Engine) ──────────────────
function berlinHour(): number {
  const parts = new Intl.DateTimeFormat("de-DE", { timeZone: "Europe/Berlin", hour: "2-digit", hour12: false }).formatToParts(new Date());
  const h = parseInt(parts.find((p) => p.type === "hour")?.value || "", 10);
  return Number.isFinite(h) ? h % 24 : new Date().getUTCHours();
}
function withinHardWindow(): boolean {
  const h = berlinHour();
  return h >= 8 && h < 20;
}

// ── Paket CF: Zeitplan (mehrere feste Sendezeiten + Wochentage) ──────────────
const SCHEDULE_TICK_MIN = 5; // Cron-Granularität in Minuten (Sendezeit-Toleranzfenster)
const WEEKDAY_LABELS = ["", "Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"]; // ISO 1..7

/** Aktuelle Zeit in Europe/Berlin als Date mit lokalen Feldern (Std/Min/Wochentag). */
function berlinNow(): Date {
  return new Date(new Date().toLocaleString("en-US", { timeZone: "Europe/Berlin" }));
}
function isoWeekday(d: Date): number { return d.getDay() === 0 ? 7 : d.getDay(); } // 1=Mo … 7=So

/** "09:15,19:10" → [{h,m,key}], sanitisiert & sortiert. */
function parseTimes(raw: string): { h: number; m: number; key: string }[] {
  const out = String(raw || "").split(",").map((s) => s.trim()).filter(Boolean).map((s) => {
    const [hh, mm] = s.split(":");
    const h = parseInt(hh, 10); const m = parseInt(mm, 10);
    if (!Number.isFinite(h) || !Number.isFinite(m)) return null;
    const H = Math.min(23, Math.max(0, h)); const M = Math.min(59, Math.max(0, m));
    return { h: H, m: M, key: `${String(H).padStart(2, "0")}:${String(M).padStart(2, "0")}` };
  }).filter(Boolean) as { h: number; m: number; key: string }[];
  const uniq = Array.from(new Map(out.map((t) => [t.key, t])).values());
  return uniq.sort((a, b) => (a.h * 60 + a.m) - (b.h * 60 + b.m));
}
/** "1,2,3,4,5,6" → [1..7] ISO-Wochentage, Default Mo–Sa. */
function parseWeekdays(raw: string): number[] {
  const ds = String(raw ?? "").split(",").map((s) => parseInt(s.trim(), 10)).filter((n) => n >= 1 && n <= 7);
  return ds.length ? Array.from(new Set(ds)).sort((a, b) => a - b) : [1, 2, 3, 4, 5, 6];
}

/** Nächster automatischer Lauf als deutscher Klartext ("heute 19:10 Uhr" / "morgen 09:15 Uhr" / "Mo 09:15 Uhr"). */
function nextRunLabel(settings: Record<string, string>): string | null {
  if (settings.lead_followup_enabled !== "1") return null;
  const times = parseTimes(settings.lead_followup_times);
  const wds = parseWeekdays(settings.lead_followup_weekdays);
  if (!times.length) return null;
  const now = berlinNow();
  for (let d = 0; d < 8; d++) {
    const cand = new Date(now); cand.setDate(now.getDate() + d);
    if (!wds.includes(isoWeekday(cand))) continue;
    for (const t of times) {
      const slot = new Date(cand); slot.setHours(t.h, t.m, 0, 0);
      if (slot.getTime() > now.getTime()) {
        const prefix = d === 0 ? "heute" : d === 1 ? "morgen" : WEEKDAY_LABELS[isoWeekday(cand)];
        return `${prefix} ${t.key} Uhr`;
      }
    }
  }
  return null;
}

/** Prüft, ob JETZT ein konfigurierter Sendezeitpunkt fällig ist (an aktivem Wochentag, ohne Doppellauf). */
async function maybeRunScheduledFollowups(): Promise<void> {
  const s = await getSettings();
  if (s.lead_followup_enabled !== "1") return;
  const now = berlinNow();
  if (!parseWeekdays(s.lead_followup_weekdays).includes(isoWeekday(now))) return;
  const nowMin = now.getHours() * 60 + now.getMinutes();
  const due = parseTimes(s.lead_followup_times).find((t) => {
    const tm = t.h * 60 + t.m;
    return nowMin >= tm && nowMin < tm + SCHEDULE_TICK_MIN;
  });
  if (!due) return;
  const slotKey = `${now.getFullYear()}-${now.getMonth() + 1}-${now.getDate()} ${due.key}`;
  if (s.lead_followup_last_run_slot === slotKey) return; // schon gelaufen für diesen Zeitpunkt
  await setSetting("lead_followup_last_run_slot", slotKey);
  console.log(`[FIAON-LEADS] Geplanter Nachfass-Lauf (${slotKey}) startet`);
  await runLeadFollowups({ force: true });
}
/** Nachfass-Plan (Tage nach Lead-Anlage) aus Einstellungen, aufsteigend, sanitisiert. */
function followupDays(settings: Record<string, string>): number[] {
  const raw = String(settings.lead_followup_days || "1,2,4,7");
  const days = raw.split(",").map((s) => Math.round(Number(s.trim()))).filter((n) => Number.isFinite(n) && n >= 0);
  const uniq = Array.from(new Set(days)).sort((a, b) => a - b);
  return uniq.length ? uniq : [1, 2, 4, 7];
}

// ═══════════════════════════════════════════════════════════════════
// BA3 — AUTO-KONVERSION (aus dem Antrags-Endpoint aufgerufen, additiv)
// ═══════════════════════════════════════════════════════════════════
/**
 * Konvertiert offene Leads, die per E-Mail ODER Telefon zum Antrag passen.
 * Fire-and-forget aus fiaon-antrag.ts; wirft nie in den Antragsflow zurück.
 */
export async function convertLeadsForContact(
  emailRaw: string | null | undefined,
  phoneRaw: string | null | undefined,
  orderRef: string,
): Promise<number> {
  try {
    await ensureLeadTables();
    const email = emailRaw ? String(emailRaw).trim().toLowerCase() : null;
    const phone = phoneRaw ? normalizePhone(String(phoneRaw)) : null;
    if ((!email || !EMAIL_RE.test(email)) && !phone) return 0;

    const rows = await sqlPool`
      UPDATE fiaon_leads SET
        status = 'konvertiert',
        converted_order_id = ${orderRef},
        konvertiert_am = NOW(),
        letzter_kontakt_am = NOW(),
        updated_at = NOW()
      WHERE status IN ('neu', 'kontaktiert', 'nicht_erreichbar')
        AND (
          (${email}::text IS NOT NULL AND email IS NOT NULL AND LOWER(TRIM(email)) = ${email})
          OR (${phone}::text IS NOT NULL AND ${phone} <> '' AND telefon = ${phone})
        )
      RETURNING id, assigned_agent_id
    `;
    for (const r of rows) {
      await logLead(r.id, { id: null, name: "System" }, "system", {
        note: `Automatisch konvertiert — Antrag ${orderRef} angelegt (E-Mail/Telefon-Treffer). Raus aus Nachfass-/Anrufliste.`,
      });
    }
    if (rows.length) console.log(`[FIAON-LEADS] Auto-Konversion: ${rows.length} Lead(s) → ${orderRef}`);

    // ── P2-B (D2-Root-Cause-Fix): ATTRIBUTION FOLGT DER BETREUUNG. ──
    // Der betreuende Lead-Agent wird auf die Bestellung ÜBERTRAGEN (nur wenn
    // dort noch keiner steht — bestehende Zuweisungen werden nie überschrieben).
    // Der Provisions-ANSPRUCH entsteht davon unabhängig erst durch dokumentierte
    // Betreuung (onCustomerPaid prüft Kontakt-Ergebnisse, nicht die Zuweisung).
    try {
      const donor = rows.find((r: any) => r.assigned_agent_id);
      if (donor) {
        const upd = await sqlPool`
          UPDATE fiaon_applications SET assigned_agent_id = ${donor.assigned_agent_id}, updated_at = NOW()
          WHERE ref = ${orderRef} AND assigned_agent_id IS NULL AND merged_into IS NULL
          RETURNING ref
        `;
        if (upd.length > 0) {
          await sqlPool`
            INSERT INTO fiaon_contact_log (ref, agent_id, agent_name, type, note)
            VALUES (${orderRef}, NULL, 'System', 'system',
                    ${`Zuweisung vom Lead #${donor.id} übernommen (P2-B: Attribution folgt der Betreuung, Agent #${donor.assigned_agent_id})`})
          `;
          console.log(`[FIAON-LEADS] Attribution übertragen: Lead #${donor.id} → ${orderRef} (Agent ${donor.assigned_agent_id})`);
        }
      } else if (rows.length > 0) {
        // Rückrichtung: Lead ohne Agent erbt den Bestell-Agenten — behebt die
        // dauerhaften „Agent —"-Zeilen bei konvertierten Leads (D2, 144 Fälle).
        const [order] = await sqlPool`
          SELECT assigned_agent_id FROM fiaon_applications WHERE ref = ${orderRef} AND merged_into IS NULL
        `;
        if (order?.assigned_agent_id) {
          const ids = rows.map((r: any) => r.id);
          await sqlPool`
            UPDATE fiaon_leads SET assigned_agent_id = ${order.assigned_agent_id}, updated_at = NOW()
            WHERE id = ANY(${ids}) AND assigned_agent_id IS NULL
          `;
        }
      }
    } catch (attrErr) {
      console.error("[FIAON-LEADS] Attributions-Übertrag:", attrErr);
    }
    return rows.length;
  } catch (err) {
    console.error("[FIAON-LEADS] convertLeadsForContact:", err);
    return 0;
  }
}

// ═══════════════════════════════════════════════════════════════════
// BC2 — LEAD-VERTEILUNG (Round-Robin, gleiche Engine wie Kunden)
// ═══════════════════════════════════════════════════════════════════
export async function distributeUnassignedLeads(): Promise<number> {
  // ── OFFENE KARTEI: ABGESCHALTET ──────────────────────────────────────────
  // Pfad 7 der Phase-0-Diagnose (SYSTEM_DIAGNOSE.md, Abschnitt „Offene Kartei")
  // war die Wurzel des Chaos: Die Rotation hat Leads an Agenten verteilt, ohne
  // dass jemand gearbeitet hat — 2.054 von 2.502 zugewiesenen Akten hatten nie
  // einen dokumentierten Kontakt. Zuweisung entsteht ab jetzt AUSSCHLIESSLICH
  // durch die bewusste Übernahme aus der offenen Kartei (fiaon-kartei.ts).
  //
  // Die Funktion bleibt als No-Op bestehen, damit alle bestehenden Aufrufer
  // (Intake, Cron, Admin-Buttons) unverändert weiterlaufen.
  return 0;
}

/** Alte Rotations-Implementierung — bewusst inaktiv, nur als Beleg erhalten. */
async function distributeUnassignedLeadsLegacy(): Promise<number> {
  await ensureLeadTables();
  const settings = await getSettings();
  if (settings.lead_distribution_enabled !== "1") return 0;

  const agents = await sqlPool`
    SELECT id, name FROM fiaon_agents WHERE active = TRUE AND distribution_active = TRUE ORDER BY id ASC
  `;
  if (agents.length === 0) return 0;

  const leads = await sqlPool`
    SELECT id FROM fiaon_leads
    WHERE status IN ('neu', 'kontaktiert', 'nicht_erreichbar') AND assigned_agent_id IS NULL
    ORDER BY erstellt_am ASC
  `;
  if (leads.length === 0) return 0;

  const lastId = Number(settings.lead_distribution_last_agent_id) || 0;
  let idx = agents.findIndex((a: any) => Number(a.id) > lastId);
  if (idx === -1) idx = 0;

  let assigned = 0;
  let lastAssignedAgent = lastId;
  for (const l of leads) {
    const chosen = agents[idx % agents.length];
    idx = (idx + 1) % agents.length;
    const updated = await sqlPool`
      UPDATE fiaon_leads SET assigned_agent_id = ${chosen.id}, updated_at = NOW()
      WHERE id = ${l.id} AND assigned_agent_id IS NULL
      RETURNING id
    `;
    if (updated.length === 0) continue;
    lastAssignedAgent = Number(chosen.id);
    assigned++;
    await logLead(l.id, { id: null, name: "System" }, "system", { note: `Automatisch zugewiesen an ${chosen.name} (Rotationsverteilung)` });
  }
  if (assigned > 0) {
    await setSetting("lead_distribution_last_agent_id", String(lastAssignedAgent));
    console.log(`[FIAON-LEADS] ${assigned} Lead(s) per Rotation zugewiesen`);
  }
  return assigned;
}

// ═══════════════════════════════════════════════════════════════════
// BB1 — NACHFASS-ENGINE (lead_followup)
// ═══════════════════════════════════════════════════════════════════
const LEAD_BATCH = 50;

/** Atomarer Batch-Claim fälliger Leads (stempelt last_lead_reminder_at + count + status). */
async function claimLeadFollowupBatch(
  limit: number,
  opts: { maxFollowups: number; planDays: number[] | null },
): Promise<any[]> {
  // planDays=null → Bulk (ohne Tagesplan, nur 8h-Dedupe + Obergrenze).
  const planClause = opts.planDays
    ? "AND (" + opts.planDays.map((d, i) => `(l.lead_reminder_count = ${i} AND l.erstellt_am <= NOW() - INTERVAL '${Number(d)} days')`).join(" OR ") + ")"
    : "";
  const max = Math.max(0, Math.round(opts.maxFollowups));
  const lim = Math.max(1, Math.round(limit));
  const sql = `
    UPDATE fiaon_leads SET
      last_lead_reminder_at = NOW(),
      lead_reminder_count = COALESCE(lead_reminder_count, 0) + 1,
      letzter_kontakt_am = NOW(),
      status = CASE WHEN status = 'neu' THEN 'kontaktiert' ELSE status END,
      updated_at = NOW()
    WHERE id IN (
      SELECT l.id FROM fiaon_leads l
      WHERE l.status IN ('neu', 'kontaktiert', 'nicht_erreichbar')
        AND l.in_sequence = TRUE
        AND COALESCE(NULLIF(l.email, ''), NULLIF(l.telefon, '')) IS NOT NULL
        AND (l.last_lead_reminder_at IS NULL OR l.last_lead_reminder_at < NOW() - INTERVAL '8 hours')
        AND COALESCE(l.lead_reminder_count, 0) < ${max}
        ${planClause}
      ORDER BY l.erstellt_am ASC
      LIMIT ${lim}
      FOR UPDATE SKIP LOCKED
    )
    RETURNING id, vorname, nachname, email, telefon, quelle, lead_reminder_count
  `;
  return sqlPool.unsafe(sql);
}

function followupPayload(l: any) {
  return {
    email: l.email || "",
    vorname: l.vorname || null,
    nachname: l.nachname || null,
    telefon: l.telefon || null,
    lead_id: l.id,
    followup_number: Number(l.lead_reminder_count || 1),
    quelle: l.quelle || null,
    antrag_url: antragUrl(l.id),
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// DIE ABLÖSUNG DURCH DIE EWIGE STRECKE (18.08.2026)
//
// ── DER AUFTRAG ──────────────────────────────────────────────────────────
// „Leads ohne Antrag bekommen eine E-Mail-Strecke, die NIE endet."
//
// ── WARUM DIE ALTE STRECKE DAFÜR IM WEG STAND ────────────────────────────
// Zwei Dinge hätten die ewige Strecke sofort abgewürgt:
//
//   1. `markExhaustedLeadsDead` setzt nach sechs Mails `status = 'tot'`. Die
//      ewige Strecke überspringt tote Leads — sie hätte also genau die
//      verloren, für die sie gebaut wurde.
//   2. `runLeadFollowups` würde WEITER senden. Zwei Motoren an einer Liste
//      heißt: derselbe Mensch bekommt zwei Mails am selben Morgen.
//
// GEMESSEN vorher: 1.483 Leads standen bei Mail 8 — am Ende der Strecke.
// 2.700 lebende Leads ohne Antrag warteten auf eine Fortsetzung.
//
// ── DIE LÖSUNG: EIN SCHALTER, KEIN LÖSCHEN ───────────────────────────────
// `lead_strecke_ewig` (Vorgabe „1") legt fest, wer fährt. Ist er an, hält sich
// die alte Strecke still und der Tageslauf delegiert. Ist er aus, läuft alles
// wie vorher. Der alte Motor bleibt vollständig erhalten — als Rückfall, den
// der Betreiber in den Einstellungen umlegen kann, ohne einen Entwickler.
// ═══════════════════════════════════════════════════════════════════════════

/** Fährt die ewige Strecke? Nur dann hält sich der alte Motor still. */
async function ewigeStreckeAn(): Promise<boolean> {
  const s = await getSettings();
  return String(s.lead_strecke_ewig ?? "1") === "1";
}

/** Erschöpfte/übergrenzte Leads auf `tot` setzen (kein Versand mehr). */
async function markExhaustedLeadsDead(maxFollowups: number, planDays: number[]): Promise<number> {
  // ── DIE EWIGE STRECKE KENNT KEIN „TOT" ─────────────────────────────────
  // Sie hört auf, wenn ein Antrag kommt, wenn jemand zahlt, wenn er sich
  // abmeldet oder wenn die Adresse nicht existiert — nicht, weil eine Zahl
  // erreicht ist.
  if (await ewigeStreckeAn()) return 0;
  const lastDay = planDays.length ? planDays[planDays.length - 1] : 7;
  const rows = await sqlPool`
    UPDATE fiaon_leads SET status = 'tot', updated_at = NOW()
    WHERE status IN ('neu', 'kontaktiert', 'nicht_erreichbar')
      AND in_sequence = TRUE
      AND (
        COALESCE(lead_reminder_count, 0) >= ${Math.round(maxFollowups)}
        OR (COALESCE(lead_reminder_count, 0) >= ${planDays.length}
            AND erstellt_am <= NOW() - INTERVAL '${Number(lastDay) + 3} days')
      )
    RETURNING id
  `;
  for (const r of rows) {
    await logLead(r.id, { id: null, name: "System" }, "system", { note: "Nachfass-Plan ausgeschöpft — Status auf „tot“ gesetzt (kein Versand mehr)." });
  }
  return rows.length;
}

export async function runLeadFollowups(opts: { force?: boolean } = {}): Promise<{ sent: number; markedDead: number; skippedWindow: boolean }> {
  await ensureLeadTables();
  const result = { sent: 0, markedDead: 0, skippedWindow: false };
  const settings = await getSettings();

  const maxFollowups = Math.max(0, Math.round(Number(settings.max_lead_followups)) || 5);
  const planDays = followupDays(settings);

  // „Tot"-Markierung läuft immer (unabhängig vom Fenster)
  result.markedDead = await markExhaustedLeadsDead(maxFollowups, planDays);

  // ── DELEGATION AN DIE EWIGE STRECKE ────────────────────────────────────
  // Sie bringt ihre eigene Kadenz, ihre eigene Rotation und ihre eigenen
  // Stopps mit. Der alte Batch-Weg darf danach nicht mehr laufen, sonst
  // bekommt derselbe Mensch zwei Mails.
  if (String(settings.lead_strecke_ewig ?? "1") === "1") {
    if (settings.lead_followup_enabled !== "1") {
      result.skippedWindow = true;
      return result;
    }
    // Das Sendefenster gilt weiter: Eine Strecke, die um 3 Uhr morgens
    // schreibt, wirkt maschinell — und sie ist es dann auch.
    if (!opts.force && !withinHardWindow()) {
      result.skippedWindow = true;
      return result;
    }
    const { streckeTageslauf } = await import("../lib/fiaon-lead-strecke");
    const erg = await streckeTageslauf();
    result.sent = erg.versandt;
    return result;
  }

  if (settings.lead_followup_enabled !== "1") {
    result.skippedWindow = true;
    return result;
  }
  const winStart = Math.min(19, Math.max(8, Math.round(Number(settings.lead_followup_window_start)) || 10));
  const winEnd = Math.min(20, Math.max(winStart + 1, Math.round(Number(settings.lead_followup_window_end)) || winStart + 1));
  const hour = berlinHour();
  const inWindow = hour >= winStart && hour < winEnd;
  if ((!opts.force && !inWindow) || !withinHardWindow()) {
    result.skippedWindow = true;
    return result;
  }

  for (;;) {
    const batch = await claimLeadFollowupBatch(LEAD_BATCH, { maxFollowups, planDays });
    if (batch.length === 0) break;
    for (const l of batch) {
      await sendMakeWebhook("lead_followup", followupPayload(l));
      await logLead(l.id, { id: null, name: "System" }, "followup", { note: `Nachfass #${l.lead_reminder_count} gesendet (Make: lead_followup)` });
      result.sent++;
    }
    if (batch.length < LEAD_BATCH) break;
  }
  if (result.sent) console.log(`[FIAON-LEADS] Nachfass-Engine: ${result.sent} lead_followup gesendet`);
  return result;
}

// ═══════════════════════════════════════════════════════════════════════════
// DIESER LAUF GING AN DER BREMSE VORBEI — bis zum 17.08.2026
//
// ── DER BEFUND ─────────────────────────────────────────────────────────────
// Hier stand ein nacktes `setInterval` ohne jede Prüfung. Von sieben
// zeitgesteuerten Läufen im Haus war dieser der einzige, der auf einem
// ENTWICKLUNGSRECHNER losgelaufen wäre — und er verschickt Lead-Nachfassmails
// und verteilt Leads an Menschen.
//
// Genau das ist der Vorfall vom 08.08.2026, wegen dem `CRONS_AN` existiert: Ein
// `npm run dev` gegen die Produktionsdatenbank markierte 26 echte Kunden als
// angeschrieben, ohne dass eine Mail rausging. Die Bremse wurde daraufhin
// gebaut — an dieser Stelle aber nie eingehängt.
//
// Dass es nie passiert ist, liegt an der Sendezeit-Prüfung in
// `maybeRunScheduledFollowups`: Sie schickt nur zu konfigurierten Zeiten. Das
// ist Glück, keine Absicherung. Und `distributeUnassignedLeads` hätte auf einem
// Entwicklungsrechner jederzeit echte Leads an echte Menschen verteilt.
//
// Ab jetzt über die EINE Registratur — dort steht die Bremse einmal.
// ═══════════════════════════════════════════════════════════════════════════
tageslauf("lead-nachfass-und-verteilung", () => {
  maybeRunScheduledFollowups().catch((err) => console.error("[FIAON-LEADS] Followup-Cron:", err));
  distributeUnassignedLeads().catch((err) => console.error("[FIAON-LEADS] Verteilung-Cron:", err));
}, SCHEDULE_TICK_MIN * 60 * 1000);

// ═══════════════════════════════════════════════════════════════════
// BA2 — INTAKE-WEBHOOK  (POST /api/leads/intake, Secret-geschützt)
// ═══════════════════════════════════════════════════════════════════
/** CD: Intake-Versuch protokollieren (ohne sensible Daten). Fehler nie werfen. */
async function logIntake(status: string, quelle: string | null, detail: string | null): Promise<void> {
  try {
    await sqlPool`INSERT INTO fiaon_lead_intake_log (status, quelle, detail) VALUES (${status}, ${quelle}, ${detail})`;
  } catch (err) { console.error("[FIAON-LEADS] logIntake:", err); }
  // P5: abgelehnte/ungültige Intakes zusätzlich als Diagnose-Ereignis (non-blocking).
  // 'ok'/'test' erzeugen bewusst KEIN Ereignis (kein Rauschen).
  if (status === "rejected_auth" || status === "invalid") {
    import("../lib/fiaon-diagnostics")
      .then((d) => d.logDiagnostic({
        severity: status === "rejected_auth" ? "kritisch" : "warnung",
        category: "lead",
        code: `lead_intake_${status}`,
        message: status === "rejected_auth"
          ? `Lead-Eingang abgewiesen (Authentifizierung): ${detail || "unbekannt"}. Make kann gerade KEINE Leads einliefern.`
          : `Lead-Eingang ungültig (${detail || "Pflichtfeld fehlt"}), Quelle ${quelle || "?"}.`,
        hint: status === "rejected_auth"
          ? "Das Intake-Secret stimmt nicht oder fehlt. LEAD_INTAKE_SECRET im Deployment und im Make-Header 'x-lead-secret' abgleichen."
          : "Der eingelieferte Datensatz hatte weder gültige E-Mail noch Telefon. Feld-Mapping im Make-Szenario prüfen.",
        link: "/admin/leads",
      }))
      .catch(() => {});
  }
}

type IntakeResult =
  | { ok: true; id: number; deduped: boolean; personId: number | null; neuAngelegt: boolean; mehrdeutig?: number[] }
  | { ok: false; code: number; error: string };

/**
 * Telefon beim Eingang normalisieren — mit Länderkenntnis, wenn sie mitkommt.
 *
 * `normalizePhone` macht aus einer führenden Null hart „+49". Für einen
 * österreichischen Lead („0664…") ist das die falsche Nummer. Kommt ein Land mit
 * (Make kann es aus dem Formular mitschicken), wird dessen Vorwahl benutzt;
 * ohne Angabe bleibt +49 — eine deutsche Mobilnummer nach Österreich zu
 * verschieben wäre der umgekehrte Fehler, und ohne Anhaltspunkt ist Raten
 * schlechter als die bekannte Mehrheit.
 */
function intakeTelefon(roh: unknown, land: unknown): string | null {
  const nummer = String(roh ?? "").trim();
  if (!nummer) return null;
  const erkannt = waehlbareNummer([{ nummer }], land);
  if (erkannt.waehlbar) return erkannt.waehlbar;
  return normalizePhone(nummer);
}

/**
 * Kern-Ingest: normalisieren, deduplizieren, anlegen/aktualisieren, ggf. konvertieren + verteilen.
 * IN-PROCESS nutzbar — sowohl vom Intake-Webhook als auch vom Test-Lead, OHNE HTTP-Selbstaufruf.
 * (Fix Paket 4: der Test-Lead scheiterte zuvor am Self-Fetch auf fiaonBaseUrl + Secret.)
 */
async function processIntake(b: any): Promise<IntakeResult> {
  await ensureLeadTables();
  const email = b.email ? String(b.email).trim().toLowerCase() : null;
  const land = b.land ?? b.country ?? b.laendercode ?? null;
  const telefon = b.telefon || b.phone ? intakeTelefon(b.telefon || b.phone, land) : null;
  if ((!email || !EMAIL_RE.test(email)) && (!telefon || telefon === "")) {
    await logIntake("invalid", String(b.quelle || b.source || "").slice(0, 120) || null, "E-Mail/Telefon fehlt");
    return { ok: false, code: 400, error: "E-Mail oder Telefon erforderlich" };
  }

  // ── NAMEN TRENNEN (08.08.2026) ─────────────────────────────────────────────
  // Der Facebook-Fluss schickt den VOLLEN Namen im Feld `vorname` (in Make ist
  // `vollständiger_name` darauf gemappt). Ergebnis im Bestand: 3 155 Leads mit
  // leerem Nachnamen und „Axel Conrad" im Vornamensfeld — und ein halbblinder
  // Dubletten-Vergleich, weil derselbe Mensch mit getrenntem Namen wie ein
  // anderer aussieht.
  const rohVorname = b.vorname || b.firstName || b.first_name
    || b.name || b.full_name || b.vollstaendiger_name || b["vollständiger_name"] || null;
  const rohNachname = b.nachname || b.lastName || b.last_name || null;
  const teile = nameTeilen(rohVorname, rohNachname);
  const vorname = teile.vorname;
  const nachname = teile.nachname;
  const quelle = String(b.quelle || b.source || "facebook_lead_ads").slice(0, 120);
  const kampagne = b.kampagne || b.campaign || null;
  const adset = b.adset || b.ad_set || null;

  // Idempotenz: gleiche E-Mail (oder Telefon) innerhalb 24h → Update statt Insert
  const existing = await sqlPool`
    SELECT id, status FROM fiaon_leads
    WHERE erstellt_am > NOW() - INTERVAL '24 hours'
      AND (
        (${email}::text IS NOT NULL AND email IS NOT NULL AND LOWER(TRIM(email)) = ${email})
        OR (${telefon}::text IS NOT NULL AND ${telefon} <> '' AND telefon = ${telefon})
      )
    ORDER BY erstellt_am DESC LIMIT 1
  `;
  if (existing.length > 0) {
    const id = existing[0].id;
    await sqlPool`
      UPDATE fiaon_leads SET
        vorname = COALESCE(NULLIF(${vorname}::text, ''), vorname),
        nachname = COALESCE(NULLIF(${nachname}::text, ''), nachname),
        email = COALESCE(${email}, email),
        telefon = COALESCE(NULLIF(${telefon}::text, ''), telefon),
        kampagne = COALESCE(NULLIF(${kampagne}::text, ''), kampagne),
        adset = COALESCE(NULLIF(${adset}::text, ''), adset),
        updated_at = NOW()
      WHERE id = ${id}
    `;
    await logLead(id, { id: null, name: "System" }, "system", { note: `Intake-Aktualisierung (Dublette innerhalb 24h, Quelle: ${quelle})` });
    await logIntake(quelle === "test" ? "test" : "ok", quelle, "Dublette aktualisiert");
    // Die Aktualisierung kann eine E-Mail ergänzt haben, die der Lead vorher
    // nicht hatte. Dann ist jetzt erst erkennbar, zu wem er gehört.
    const zuordnung = await bindePersonAnLead(id).catch((e) => {
      console.error("[FIAON-PERSON] Zuordnung nach Lead-Aktualisierung:", e);
      return null;
    });
    return {
      ok: true, id, deduped: true,
      personId: zuordnung?.personId ?? null,
      neuAngelegt: !!zuordnung?.angelegt,
      ...(zuordnung?.mehrdeutig ? { mehrdeutig: zuordnung.mehrdeutig } : {}),
    };
  }

  const inserted = await sqlPool`
    INSERT INTO fiaon_leads (vorname, nachname, email, telefon, quelle, kampagne, adset, status)
    VALUES (${vorname}, ${nachname}, ${email}, ${telefon || null}, ${quelle}, ${kampagne}, ${adset}, 'neu')
    RETURNING id
  `;
  const id = inserted[0].id;
  await logLead(id, { id: null, name: "System" }, "system", { note: `Lead eingegangen (Quelle: ${quelle}${kampagne ? `, Kampagne: ${kampagne}` : ""})` });

  // ══ P1-C DAUERSCHUTZ: Lead an seine Person binden ══════════════════════
  // Kennt das System diese Adresse oder Nummer bereits, wird der Lead an die
  // BESTEHENDE Person gehängt — auch wenn diese aus einem Antrag stammt. Genau
  // das hält den Übergang Lead → Antrag zusammen: Agent, Verlauf und
  // Betreuungsnachweis bleiben an einer Akte statt auf zwei Karten zu zerfallen.
  // Der Eingang hängt sich nur an eine EINDEUTIG erkannte Person. Trifft er
  // mehrere, entsteht eine eigene Person und das Paar liegt sofort auf dem
  // Dubletten-Arbeitsplatz — falsches Zusammenlegen ist teurer als eine Dublette.
  const zuordnung = await bindePersonAnLead(id, { beiMehrdeutigkeit: "neu" }).catch((e) => {
    console.error("[FIAON-PERSON] Zuordnung nach Lead-Eingang:", e);
    return null;
  });
  if (zuordnung && !zuordnung.angelegt) {
    // Derselbe Mensch klickt ein zweites Mal auf die Anzeige. Das ist EIN Mensch
    // mit hohem Interesse, kein zweiter Kunde — der Verlauf hält es fest und die
    // Einstufung wird neu berechnet, damit er nach oben rückt.
    await logLead(id, { id: null, name: "System" }, "system", {
      note: `Lead erneut eingegangen (Quelle: ${quelle}${kampagne ? `, Kampagne: ${kampagne}` : ""}) — `
        + `bereits bekannte Person #${zuordnung.personId}, kein neuer Kunde angelegt`,
    }).catch(() => {});
    const { personTierAktualisieren } = await import("../lib/tier");
    await personTierAktualisieren(sqlPool, { personId: zuordnung.personId }).catch(() => {});
  }

  // Falls bereits ein Antrag mit dieser E-Mail/Telefon existiert → sofort konvertieren
  const already = await sqlPool`
    SELECT ref FROM fiaon_applications
    WHERE payment_status IN ('pending_payment', 'claimed_paid', 'paid') AND merged_into IS NULL
      AND (
        (${email}::text IS NOT NULL AND email IS NOT NULL AND LOWER(TRIM(email)) = ${email})
        OR (${telefon}::text IS NOT NULL AND ${telefon} <> '' AND phone = ${telefon})
      )
    ORDER BY created_at DESC LIMIT 1
  `;
  if (already.length > 0) {
    await convertLeadsForContact(email, telefon, already[0].ref);
  } else {
    distributeUnassignedLeads().catch(() => {}); // fair verteilen (fire-and-forget)
  }
  await logIntake(quelle === "test" ? "test" : "ok", quelle,
    zuordnung && !zuordnung.angelegt ? "Lead angelegt, bestehende Person" : "Lead angelegt");
  return {
    ok: true, id, deduped: false,
    personId: zuordnung?.personId ?? null,
    neuAngelegt: !!zuordnung?.angelegt,
    ...(zuordnung?.mehrdeutig ? { mehrdeutig: zuordnung.mehrdeutig } : {}),
  };
}

intakeRouter.post("/intake", async (req: Request, res: Response) => {
  try {
    await ensureLeadTables();
    const secret = process.env.LEAD_INTAKE_SECRET;
    if (!secret) { await logIntake("rejected_auth", null, "LEAD_INTAKE_SECRET nicht konfiguriert"); return res.status(503).json({ ok: false, error: "LEAD_INTAKE_SECRET nicht konfiguriert" }); }
    const provided = String(req.headers["x-lead-secret"] || req.query.secret || "").trim();
    if (provided !== secret) { await logIntake("rejected_auth", null, provided ? "Falsches Secret" : "Kein Secret gesendet"); return res.status(401).json({ ok: false, error: "Ungültiges Intake-Secret" }); }

    const result = await processIntake(req.body || {});
    if (!result.ok) return res.status(result.code).json({ ok: false, error: result.error });
    // `id` und `deduped` bleiben — bestehende Make-Szenarien dürfen nicht brechen.
    // Neu sind `personId` und `neuAngelegt`: Damit ist in der Make-Historie
    // nachvollziehbar, ob ein Eingang einen neuen Menschen erzeugt hat oder an
    // einen bekannten gegangen ist.
    res.json({
      ok: true,
      id: result.id,
      deduped: result.deduped,
      personId: result.personId,
      neuAngelegt: result.neuAngelegt,
      ...(result.mehrdeutig ? { mehrdeutig: result.mehrdeutig } : {}),
    });
  } catch (err) {
    console.error("[FIAON-LEADS] intake:", err);
    res.status(500).json({ ok: false, error: "Serverfehler" });
  }
});

// ═══════════════════════════════════════════════════════════════════
// AGENT-ANRUFLISTE (BC1) — mount /api/fiaon, requireAgent
// ═══════════════════════════════════════════════════════════════════

/** Guard: Lead muss offen sein; Kollegen-Zuweisung ⇒ 403; unzugewiesen ⇒ Auto-Claim. */
async function leadGuard(id: number, agent: { id: number; name: string }): Promise<{ error?: { code: number; msg: string }; lead?: any; claimed?: boolean }> {
  const rows = await sqlPool`SELECT * FROM fiaon_leads WHERE id = ${id}`;
  if (rows.length === 0) return { error: { code: 404, msg: "Lead nicht gefunden" } };
  const l = rows[0];
  if (["konvertiert", "tot", "kein_interesse"].includes(l.status)) {
    return { error: { code: 409, msg: "Lead ist nicht mehr offen" } };
  }
  if (l.assigned_agent_id && l.assigned_agent_id !== agent.id) {
    return { error: { code: 403, msg: "Dieser Lead wird von einem Kollegen betreut" } };
  }
  if (!l.assigned_agent_id) {
    const claimed = await sqlPool`
      UPDATE fiaon_leads SET assigned_agent_id = ${agent.id}, updated_at = NOW()
      WHERE id = ${id} AND assigned_agent_id IS NULL RETURNING *
    `;
    if (claimed.length > 0) return { lead: claimed[0], claimed: true };
  }
  return { lead: l, claimed: false };
}

// ═════════════ P2-C — ARBEITSWARTESCHLANGE (statt 826-Zeilen-Friedhof) ═══════════
// Prinzip: Kontaktdaten sind VERDECKT, bis der Agent die Akte öffnet
// (dokumentierte Übernahme). Nur EINE offene Akte gleichzeitig — die nächste
// erst nach dokumentiertem Kontakt-Ergebnis. Reihenfolge kommt vom Server
// (Score, Gewichte im Admin konfigurierbar) + Fairness-Beimischung aus dem
// Alt-Bestand. Der Agent sieht den Score bewusst NICHT (sonst wird gespielt).

function queueWeights(s: Record<string, string>) {
  const num = (v: string | undefined, d: number) => {
    const n = Number(v);
    return Number.isFinite(n) && n >= 0 ? n : d;
  };
  return {
    wFresh: num(s.queue_w_fresh, 40),      // Frische (neue Leads höher)
    wValue: num(s.queue_w_value, 25),      // Paket-/Umsatzpotenzial (Business-Kampagnen)
    wReact: num(s.queue_w_react, 50),      // Reaktionssignal (fälliger Rückruf-Termin)
    wContact: num(s.queue_w_contact, 30),  // Kontakthistorie (nie kontaktiert > lange her)
    fairnessNth: Math.max(2, Math.min(10, num(s.queue_fairness_nth, 4))), // jeder N-te aus Alt-Bestand
  };
}

// ── V2 (Phase 2B) DEADLOCK-SCHUTZ: Eine offene Akte ohne Kontakt-Ergebnis wird
// nach X Minuten (Setting akte_auto_release_min, Default 30, 0 = nie) automatisch
// freigegeben — Lead zurück in die Queue, Historie und Übernahme-Protokoll bleiben.
// Läuft lazy bei jedem Queue-Abruf/Akte-Öffnen (kein eigener Cron nötig).
async function autoReleaseStaleAktes(): Promise<void> {
  const s = await getSettings();
  const min = Number(s.akte_auto_release_min);
  const minutes = Number.isFinite(min) && min >= 0 ? min : 30;
  if (minutes === 0) return;
  const released = await sqlPool`
    UPDATE fiaon_leads SET opened_at = NULL, updated_at = NOW()
    WHERE opened_at IS NOT NULL AND opened_at < NOW() - make_interval(mins => ${minutes})
      AND status IN ('neu', 'kontaktiert', 'nicht_erreichbar')
    RETURNING id
  `;
  for (const r of released) {
    await logLead(Number(r.id), { id: null, name: "System" }, "system", {
      note: `Akte automatisch freigegeben: ${minutes} Min. ohne dokumentiertes Kontakt-Ergebnis (Deadlock-Schutz). Lead ist zurück in der Warteschlange.`,
    }).catch(() => {});
  }
}

/** Maskierte Queue-Zeile — KEINE Kontaktdaten, nur neutrale Merkmale. */
function maskQueueRow(l: any): any {
  return {
    id: l.id,
    quelle: l.quelle || null,
    kampagne: l.kampagne || null,
    status: l.status,
    erstellt_am: l.erstellt_am,
    letzter_kontakt_am: l.letzter_kontakt_am,
    lead_reminder_count: l.lead_reminder_count,
    callback_due: !!l.callback_due,
    hat_email: !!l.hat_email,
    hat_telefon: !!l.hat_telefon,
    number_corrected: !!l.number_corrected, // #23: Nummer vom Kunden korrigiert → erneut anrufen
  };
}

router.get("/agent/leads", requireAgent, async (req: AgentRequest, res) => {
  try {
    await ensureLeadTables();
    await autoReleaseStaleAktes();
    const me = req.agent!.id;
    const limit = Math.min(100, Math.max(10, Number(req.query.limit) || 50));
    const offset = Math.max(0, Number(req.query.offset) || 0);
    const w = queueWeights(await getSettings());

    // Aktive Akte (max. 1): voller Datensatz — der Agent hat sie übernommen.
    const activeRows = await sqlPool`
      SELECT * FROM fiaon_leads
      WHERE opened_by_agent_id = ${me} AND opened_at IS NOT NULL
        AND status IN ('neu', 'kontaktiert', 'nicht_erreichbar')
      ORDER BY opened_at DESC LIMIT 1
    `;
    const active = activeRows[0] || null;

    // Serverseitiger Score (Agent sieht ihn nicht):
    //  Frische:        exponentiell fallend mit Alter (Halbwertszeit ~7 Tage)
    //  Potenzial:      Business-Kampagne/-Quelle = höherwertiges Interesse
    //  Reaktion:       fälliger, dokumentierter Rückruf-Termin → stark nach oben
    //  Kontakthistorie: nie kontaktiert am höchsten, sonst wächst mit Abstand
    const scored = await sqlPool.unsafe(`
      SELECT l.id, l.quelle, l.kampagne, l.status, l.erstellt_am, l.letzter_kontakt_am,
             l.lead_reminder_count,
             (l.email IS NOT NULL AND l.email <> '') AS hat_email,
             (l.telefon IS NOT NULL AND l.telefon <> '') AS hat_telefon,
             (l.number_corrected_at IS NOT NULL AND (l.letzter_kontakt_am IS NULL OR l.number_corrected_at > l.letzter_kontakt_am)) AS number_corrected,
             EXISTS (
               SELECT 1 FROM fiaon_lead_log g
               WHERE g.lead_id = l.id AND g.scheduled_at IS NOT NULL
                 AND g.scheduled_at <= NOW() AND g.scheduled_at > NOW() - INTERVAL '7 days'
             ) AS callback_due,
             (
               $2::numeric * EXP(-EXTRACT(EPOCH FROM (NOW() - l.erstellt_am)) / 86400.0 / 7.0)
               + CASE WHEN LOWER(COALESCE(l.kampagne,'') || ' ' || COALESCE(l.quelle,'')) LIKE '%business%' THEN $3::numeric ELSE 0 END
               + CASE WHEN EXISTS (
                   SELECT 1 FROM fiaon_lead_log g
                   WHERE g.lead_id = l.id AND g.scheduled_at IS NOT NULL
                     AND g.scheduled_at <= NOW() AND g.scheduled_at > NOW() - INTERVAL '7 days'
                 ) THEN $4::numeric ELSE 0 END
               + CASE WHEN l.letzter_kontakt_am IS NULL THEN $5::numeric
                      ELSE $5::numeric * LEAST(1, EXTRACT(EPOCH FROM (NOW() - l.letzter_kontakt_am)) / 86400.0 / 14.0) END
               -- #23: frisch vom Kunden korrigierte Nummer → ganz nach oben (erneut anrufen)
               + CASE WHEN l.number_corrected_at IS NOT NULL AND (l.letzter_kontakt_am IS NULL OR l.number_corrected_at > l.letzter_kontakt_am) THEN 100000 ELSE 0 END
             ) AS score
      FROM fiaon_leads l
      WHERE l.assigned_agent_id = $1 AND l.status IN ('neu', 'kontaktiert', 'nicht_erreichbar')
        AND l.dismissed_at IS NULL
        AND (l.requeue_at IS NULL OR l.requeue_at <= NOW())
        AND (l.opened_at IS NULL OR l.opened_by_agent_id <> $1)
        -- Ticket #15/Sichtbarkeitsregel: nur vollständige Leads (E-Mail + Name + Telefon) in der Queue
        AND COALESCE(l.telefon, '') <> '' AND COALESCE(l.email, '') <> ''
        AND (COALESCE(l.vorname, '') <> '' OR COALESCE(l.nachname, '') <> '')
      ORDER BY score DESC, l.erstellt_am DESC
      LIMIT $6 OFFSET $7
    `, [me, w.wFresh, w.wValue, w.wReact, w.wContact, limit, offset]);

    // Fairness-Beimischung: jeder N-te Slot kommt aus dem ÄLTESTEN Bestand,
    // damit alte Leads nicht ewig liegenbleiben (Anteil im Admin einstellbar).
    const fairCount = Math.ceil(scored.length / w.fairnessNth);
    const oldest = await sqlPool`
      SELECT l.id, l.quelle, l.kampagne, l.status, l.erstellt_am, l.letzter_kontakt_am,
             l.lead_reminder_count,
             (l.email IS NOT NULL AND l.email <> '') AS hat_email,
             (l.telefon IS NOT NULL AND l.telefon <> '') AS hat_telefon,
             FALSE AS callback_due
      FROM fiaon_leads l
      WHERE l.assigned_agent_id = ${me} AND l.status IN ('neu', 'kontaktiert', 'nicht_erreichbar')
        AND l.dismissed_at IS NULL
        AND (l.requeue_at IS NULL OR l.requeue_at <= NOW())
        AND (l.opened_at IS NULL OR l.opened_by_agent_id <> ${me})
        AND COALESCE(l.telefon, '') <> '' AND COALESCE(l.email, '') <> ''
        AND (COALESCE(l.vorname, '') <> '' OR COALESCE(l.nachname, '') <> '')
      ORDER BY COALESCE(l.letzter_kontakt_am, l.erstellt_am) ASC
      LIMIT ${fairCount} OFFSET ${offset > 0 ? Math.floor(offset / w.fairnessNth) : 0}
    `;
    const seen = new Set<number>();
    const queue: any[] = [];
    let oldIdx = 0;
    for (let i = 0; i < scored.length && queue.length < limit; i++) {
      // jeder N-te Slot: Alt-Bestand einmischen
      if ((queue.length + 1) % w.fairnessNth === 0 && oldIdx < oldest.length) {
        const o = oldest[oldIdx++];
        if (!seen.has(Number(o.id))) { seen.add(Number(o.id)); queue.push(maskQueueRow(o)); }
      }
      const s = scored[i];
      if (!seen.has(Number(s.id))) { seen.add(Number(s.id)); queue.push(maskQueueRow(s)); }
    }

    const [tot] = await sqlPool`
      SELECT COUNT(*)::int AS c FROM fiaon_leads
      WHERE assigned_agent_id = ${me} AND status IN ('neu', 'kontaktiert', 'nicht_erreichbar')
        AND dismissed_at IS NULL
        AND (requeue_at IS NULL OR requeue_at <= NOW())
        AND COALESCE(telefon, '') <> '' AND COALESCE(email, '') <> ''
        AND (COALESCE(vorname, '') <> '' OR COALESCE(nachname, '') <> '')
    `;
    // Priorisierung (BC1): offene Kunden-Anträge haben Vorrang.
    const [openCust] = await sqlPool`
      SELECT COUNT(*)::int AS c FROM fiaon_applications
      WHERE assigned_agent_id = ${me} AND payment_status IN ('pending_payment', 'claimed_paid') AND merged_into IS NULL
    `;
    res.json({
      ok: true,
      active,
      queue,
      total: Number(tot.c),
      hasMore: offset + scored.length < Number(tot.c),
      openCustomerCount: Number(openCust.c),
      // Abwärtskompatibilität: alte Clients lasen `data` — maskiert, ohne Kontaktdaten.
      data: queue,
    });
  } catch (err) {
    console.error("[FIAON-LEADS] agent/leads:", err);
    res.status(500).json({ ok: false, error: "Serverfehler" });
  }
});

// P2-C: „Akte öffnen" — dokumentierte Übernahme. Erst dadurch werden die
// Kontaktdaten sichtbar; gleichzeitig der Nachweis-Baustein für P2-B.
router.post("/agent/leads/:id/open", requireAgent, async (req: AgentRequest, res) => {
  try {
    await ensureLeadTables();
    await autoReleaseStaleAktes();
    const me = req.agent!.id;
    const id = Number(req.params.id);
    // V2: Leads ohne jegliche Kontaktdaten gehören nicht in die Bearbeitung —
    // der Agent könnte die Akte nie mit einem Ergebnis schließen.
    const cd = await sqlPool`SELECT COALESCE(telefon,'') <> '' OR COALESCE(email,'') <> '' AS hat FROM fiaon_leads WHERE id = ${id}`;
    if (cd.length > 0 && !cd[0].hat) {
      return res.status(409).json({ ok: false, error: "Dieser Lead hat weder Telefon noch E-Mail — er kann nicht bearbeitet werden und steht nicht in der Warteschlange." });
    }
    // Regel: nur EINE offene Akte — die nächste erst nach Kontakt-Ergebnis.
    const open = await sqlPool`
      SELECT id FROM fiaon_leads
      WHERE opened_by_agent_id = ${me} AND opened_at IS NOT NULL
        AND status IN ('neu', 'kontaktiert', 'nicht_erreichbar')
      LIMIT 1
    `;
    if (open.length > 0 && Number(open[0].id) !== id) {
      // Ticket #14: Ein Rückruf ist echte Arbeit und darf nicht an der „nur eine
      // offene Akte"-Regel scheitern. Mit parkCurrent=true wird die aktuelle Akte
      // zurück in die Warteschlange geparkt (kein Ergebnis, kein Datenverlust),
      // damit der Rückruf sofort bearbeitet werden kann.
      if (req.body?.parkCurrent) {
        await sqlPool`
          UPDATE fiaon_leads SET opened_at = NULL, updated_at = NOW()
          WHERE id = ${Number(open[0].id)} AND opened_by_agent_id = ${me}
        `;
        await logLead(Number(open[0].id), req.agent!, "system", {
          note: `Akte geparkt (zurück in die Warteschlange), um einen Rückruf zu bearbeiten (Lead #${id}). Kein Kontakt-Ergebnis — Historie unverändert.`,
        }).catch(() => {});
      } else {
        return res.status(409).json({
          ok: false,
          error: `Du hast bereits eine offene Akte (#${open[0].id}). Dokumentiere zuerst das Kontakt-Ergebnis — dann kannst du die nächste öffnen.`,
          openLeadId: Number(open[0].id),
        });
      }
    }
    const rows = await sqlPool`
      UPDATE fiaon_leads SET
        opened_by_agent_id = ${me},
        opened_at = COALESCE(opened_at, NOW()),
        assigned_agent_id = COALESCE(assigned_agent_id, ${me}),
        updated_at = NOW()
      WHERE id = ${id}
        AND status IN ('neu', 'kontaktiert', 'nicht_erreichbar')
        AND (assigned_agent_id IS NULL OR assigned_agent_id = ${me})
        AND (opened_at IS NULL OR opened_by_agent_id = ${me})
      RETURNING *
    `;
    if (rows.length === 0) {
      return res.status(409).json({ ok: false, error: "Akte nicht verfügbar — nicht mehr offen oder von einem Kollegen übernommen." });
    }
    // Audit: Übernahme protokollieren (zählt NICHT als Kontakt → kein Provisions-Anspruch).
    await logLead(id, req.agent!, "claim", { note: `Akte übernommen durch ${req.agent!.name} (Kontaktdaten sichtbar)` });
    const log = await sqlPool`SELECT id, type, outcome, note, agent_name, scheduled_at, created_at FROM fiaon_lead_log WHERE lead_id = ${id} ORDER BY created_at DESC`;
    res.json({ ok: true, lead: rows[0], log });
  } catch (err) {
    console.error("[FIAON-LEADS] open:", err);
    res.status(500).json({ ok: false, error: "Serverfehler" });
  }
});

router.get("/agent/leads/:id", requireAgent, async (req: AgentRequest, res) => {
  try {
    await ensureLeadTables();
    const id = Number(req.params.id);
    const rows = await sqlPool`SELECT * FROM fiaon_leads WHERE id = ${id}`;
    if (rows.length === 0) return res.status(404).json({ ok: false, error: "Lead nicht gefunden" });
    const l = rows[0];
    // P2-C: Kontaktdaten bleiben VERDECKT, bis der Agent die Akte übernommen hat
    // (Gleichbehandlung aller Leads — niemand wird übersprungen). Bereits
    // übernommene Akten (auch geschlossene) bleiben für den Bearbeiter sichtbar.
    const openedByMe = Number(l.opened_by_agent_id) === req.agent!.id;
    if (!openedByMe && ["neu", "kontaktiert", "nicht_erreichbar"].includes(l.status)) {
      return res.json({ ok: true, lead: maskQueueRow(l), log: [], readOnly: true, masked: true });
    }
    const log = await sqlPool`SELECT id, type, outcome, note, agent_name, scheduled_at, created_at FROM fiaon_lead_log WHERE lead_id = ${id} ORDER BY created_at DESC`;
    const readOnly = !!(l.assigned_agent_id && l.assigned_agent_id !== req.agent!.id);
    res.json({ ok: true, lead: l, log, readOnly, masked: false });
  } catch (err) {
    console.error("[FIAON-LEADS] agent/leads/:id:", err);
    res.status(500).json({ ok: false, error: "Serverfehler" });
  }
});

router.post("/agent/leads/:id/notes", requireAgent, async (req: AgentRequest, res) => {
  try {
    const note = String(req.body?.note || "").trim();
    if (!note) return res.status(400).json({ ok: false, error: "Notiz darf nicht leer sein" });
    if (note.length > 4000) return res.status(400).json({ ok: false, error: "Notiz zu lang (max. 4000 Zeichen)" });
    const guard = await leadGuard(Number(req.params.id), req.agent!);
    if (guard.error) return res.status(guard.error.code).json({ ok: false, error: guard.error.msg });
    const entry = await logLead(Number(req.params.id), req.agent!, "note", { note });
    res.json({ ok: true, entry, claimed: guard.claimed || false });
  } catch (err) {
    console.error("[FIAON-LEADS] note:", err);
    res.status(500).json({ ok: false, error: "Serverfehler" });
  }
});

const LEAD_OUTCOMES: Record<string, string | null> = {
  erreicht_interesse: "kontaktiert",
  erreicht_kein_interesse: "kein_interesse",
  nicht_erreicht: "kontaktiert",
  mailbox: "kontaktiert",
  rueckruf_termin: "kontaktiert",
  nummer_falsch: "nicht_erreichbar",
};

router.post("/agent/leads/:id/contact-result", requireAgent, async (req: AgentRequest, res) => {
  try {
    const { outcome, scheduledAt, note } = req.body || {};
    if (!(outcome in LEAD_OUTCOMES)) return res.status(400).json({ ok: false, error: "Ungültiges Kontakt-Ergebnis" });
    if (outcome === "rueckruf_termin" && !scheduledAt) return res.status(400).json({ ok: false, error: "Termin-Datum erforderlich" });
    // Vergangener Termin = Wiedervorlage, die nie faellig wird (siehe fiaon-time.ts).
    const terminFehler = pruefeTerminZukunft(outcome, scheduledAt);
    if (terminFehler) return res.status(400).json({ ok: false, error: terminFehler });
    const guard = await leadGuard(Number(req.params.id), req.agent!);
    if (guard.error) return res.status(guard.error.code).json({ ok: false, error: guard.error.msg });
    const id = Number(req.params.id);
    const entry = await logLead(id, req.agent!, "result", {
      outcome,
      note: note ? String(note).slice(0, 4000) : null,
      scheduledAt: scheduledAt || null,
    });
    const newStatus = LEAD_OUTCOMES[outcome];
    // P2-C: Kontakt-Ergebnis SCHLIESST die Akte (nächste Akte wird frei) und
    // setzt die Wiedervorlage: nicht erreicht/Mailbox → +4 h zurück in die Queue;
    // Rückruf-Termin → Wiedervorlage zum Termin; Nummer falsch → +24 h.
    // Historie bleibt vollständig (Direktive: kein Lead wird je entfernt).
    // Ticket #13: Rückruf-Termin als Berlin-Wandzeit interpretieren (kein naives
    // ::timestamptz, das sonst die Server-Session-Zeitzone/UTC verwenden würde).
    const rueckrufAt = outcome === "rueckruf_termin" ? parseBerlinInput(scheduledAt) : null;
    const requeueSql =
      rueckrufAt ? sqlPool`${rueckrufAt}`
      : outcome === "nicht_erreicht" || outcome === "mailbox" ? sqlPool`NOW() + INTERVAL '4 hours'`
      : outcome === "nummer_falsch" ? sqlPool`NOW() + INTERVAL '24 hours'`
      : sqlPool`NULL`;
    await sqlPool`
      UPDATE fiaon_leads SET
        status = ${newStatus},
        letzter_kontakt_am = NOW(),
        opened_at = NULL,
        requeue_at = ${requeueSql},
        updated_at = NOW()
      WHERE id = ${id} AND status NOT IN ('konvertiert')
    `;
    // #23: „Falsche Nummer" → optionale Selbst-Update-Mail (nur wenn E-Mail da,
    // max. 1×/Tag). Genau die „nur E-Mail, keine Nummer"-Leads werden so wieder
    // anrufbar. Fire-and-forget; blockiert das Kontakt-Ergebnis nie.
    let numberUpdateMail: { sent: boolean; reason?: string } | undefined;
    if (outcome === "nummer_falsch") {
      const [l] = await sqlPool`SELECT email, vorname FROM fiaon_leads WHERE id = ${id}`;
      const { maybeSendNumberUpdateMail } = await import("../fiaon-number-update");
      numberUpdateMail = await maybeSendNumberUpdateMail("lead", String(id), { email: l?.email, firstName: l?.vorname });
    }
    res.json({ ok: true, entry, claimed: guard.claimed || false, akteClosed: true, numberUpdateMail });
  } catch (err) {
    console.error("[FIAON-LEADS] contact-result:", err);
    res.status(500).json({ ok: false, error: "Serverfehler" });
  }
});

// ── V2 (Phase 2B): „Akte schließen ohne Ergebnis" — der Agent darf sich nie
// ausgesperrt fühlen. Kurze Begründung Pflicht, alles im Audit-Log; zählt
// NICHT als Kontakt (kein Provisions-Anspruch, kein letzter_kontakt_am).
router.post("/agent/leads/:id/close-akte", requireAgent, async (req: AgentRequest, res) => {
  try {
    const me = req.agent!.id;
    const id = Number(req.params.id);
    const reason = String(req.body?.reason || "").trim();
    if (reason.length < 3) return res.status(400).json({ ok: false, error: "Bitte kurz begründen (z. B. „Feierabend“, „Kunde legte auf“)." });
    const rows = await sqlPool`
      UPDATE fiaon_leads SET opened_at = NULL, updated_at = NOW()
      WHERE id = ${id} AND opened_by_agent_id = ${me} AND opened_at IS NOT NULL
      RETURNING id
    `;
    if (rows.length === 0) return res.status(404).json({ ok: false, error: "Keine offene Akte von dir unter dieser Nummer." });
    await logLead(id, req.agent!, "system", {
      note: `Akte ohne Kontakt-Ergebnis geschlossen durch ${req.agent!.name}. Begründung: ${reason.slice(0, 500)}. Lead ist zurück in der Warteschlange.`,
    });
    res.json({ ok: true });
  } catch (err) {
    console.error("[FIAON-LEADS] close-akte:", err);
    res.status(500).json({ ok: false, error: "Serverfehler" });
  }
});

// ── Ticket #15: „Aus meiner Liste entfernen" ──────────────────────────────────
// Geschäftsleitungs-Direktive: Kein Lead wird je gelöscht/deaktiviert (außer echte
// DSGVO-Anfrage → Admin). Das echte Bedürfnis der Agentin ist „aus meinem Weg" —
// nicht „löschen". Der Lead verlässt die Arbeitswarteschlange, bleibt vollständig
// in der DB (Historie erhalten), mit Grund + wer/wann protokolliert. Im Admin unter
// „Aussortiert" jederzeit zurückholbar.
const DISMISS_REASONS = new Set(["keine_telefonnummer", "nummer_ungueltig", "kein_interesse", "dublette", "sonstiges"]);
const DISMISS_REASON_LABEL: Record<string, string> = {
  keine_telefonnummer: "keine Telefonnummer",
  nummer_ungueltig: "Nummer ungültig",
  kein_interesse: "kein Interesse",
  dublette: "Dublette",
  sonstiges: "sonstiges",
};
router.post("/agent/leads/:id/dismiss", requireAgent, async (req: AgentRequest, res) => {
  try {
    await ensureLeadTables();
    const me = req.agent!.id;
    const id = Number(req.params.id);
    const reason = String(req.body?.reason || "").trim();
    if (!DISMISS_REASONS.has(reason)) {
      return res.status(400).json({ ok: false, error: "Bitte einen Grund wählen (keine Telefonnummer, Nummer ungültig, kein Interesse, Dublette)." });
    }
    // Nur eigene bzw. unzugewiesene Leads dürfen aussortiert werden (kein Eingriff in Kollegen-Bestand).
    const rows = await sqlPool`
      UPDATE fiaon_leads SET
        dismissed_at = NOW(),
        dismissed_by = ${me},
        dismissed_reason = ${reason},
        opened_at = NULL,
        assigned_agent_id = COALESCE(assigned_agent_id, ${me}),
        updated_at = NOW()
      WHERE id = ${id}
        AND (assigned_agent_id IS NULL OR assigned_agent_id = ${me})
        AND dismissed_at IS NULL
      RETURNING id
    `;
    if (rows.length === 0) {
      return res.status(409).json({ ok: false, error: "Lead nicht gefunden, bereits aussortiert oder von einem Kollegen betreut." });
    }
    await logLead(id, req.agent!, "system", {
      note: `Aus der Arbeitsliste entfernt (Grund: ${DISMISS_REASON_LABEL[reason]}) durch ${req.agent!.name}. Der Lead bleibt vollständig gespeichert und ist im Admin unter „Aussortiert" jederzeit zurückholbar.`,
    });
    res.json({ ok: true });
  } catch (err) {
    console.error("[FIAON-LEADS] dismiss:", err);
    res.status(500).json({ ok: false, error: "Serverfehler" });
  }
});

// Stammdaten-Korrektur (Zahlendreher), mit Audit — analog Kundendaten-Korrektur.
router.patch("/agent/leads/:id/contact-data", requireAgent, async (req: AgentRequest, res) => {
  const guard = await leadGuard(Number(req.params.id), req.agent!);
  if (guard.error) return res.status(guard.error.code).json({ ok: false, error: guard.error.msg });
  return updateLeadContact(Number(req.params.id), req.body, req.agent!, res);
});

async function updateLeadContact(id: number, body: any, actor: { id: number | null; name: string }, res: Response) {
  try {
    const rows = await sqlPool`SELECT vorname, nachname, email, telefon FROM fiaon_leads WHERE id = ${id}`;
    if (rows.length === 0) return res.status(404).json({ ok: false, error: "Lead nicht gefunden" });
    const cur = rows[0];
    const vorname = body.vorname !== undefined ? String(body.vorname).trim() : null;
    const nachname = body.nachname !== undefined ? String(body.nachname).trim() : null;
    const email = body.email !== undefined ? String(body.email).trim().toLowerCase() : null;
    const phoneRaw = body.telefon !== undefined ? String(body.telefon) : null;
    if (email !== null && email !== "" && !EMAIL_RE.test(email)) return res.status(400).json({ ok: false, error: "E-Mail-Format ungültig" });
    let telefon: string | null = null;
    if (phoneRaw !== null) {
      telefon = normalizePhone(phoneRaw);
      if (telefon === null) return res.status(400).json({ ok: false, error: "Telefonnummer ungültig — bitte mit Vorwahl (+49 …)" });
    }
    const changes: Array<{ field: string; from: string; to: string }> = [];
    if (vorname !== null && vorname !== (cur.vorname || "")) changes.push({ field: "Vorname", from: cur.vorname || "—", to: vorname });
    if (nachname !== null && nachname !== (cur.nachname || "")) changes.push({ field: "Nachname", from: cur.nachname || "—", to: nachname });
    if (email !== null && email !== (cur.email || "")) changes.push({ field: "E-Mail", from: cur.email || "—", to: email });
    if (telefon !== null && telefon !== (cur.telefon || "")) changes.push({ field: "Telefon", from: cur.telefon || "—", to: telefon || "—" });
    if (changes.length === 0) return res.json({ ok: true, changes: [] });

    await sqlPool`
      UPDATE fiaon_leads SET
        vorname = ${vorname !== null ? vorname : cur.vorname},
        nachname = ${nachname !== null ? nachname : cur.nachname},
        email = ${email !== null ? email : cur.email},
        telefon = ${telefon !== null ? (telefon || null) : cur.telefon},
        updated_at = NOW()
      WHERE id = ${id}
    `;
    for (const c of changes) {
      await logLead(id, actor, "edit", { note: `${c.field} korrigiert durch ${actor.name}: ${c.from} → ${c.to}` });
    }
    res.json({ ok: true, changes });
  } catch (err) {
    console.error("[FIAON-LEADS] updateLeadContact:", err);
    res.status(500).json({ ok: false, error: "Serverfehler" });
  }
}

// „Zum Antrag bewegen" — schickt dem Lead den Antrags-Link (Make: lead_application_link).
router.post("/agent/leads/:id/move-to-application", requireAgent, async (req: AgentRequest, res) => {
  try {
    const guard = await leadGuard(Number(req.params.id), req.agent!);
    if (guard.error) return res.status(guard.error.code).json({ ok: false, error: guard.error.msg });
    const l = guard.lead;
    if (!l.email && !l.telefon) return res.status(400).json({ ok: false, error: "Kein Kontaktweg (E-Mail/Telefon) hinterlegt" });
    await sendMakeWebhook("lead_application_link", {
      email: l.email || "",
      vorname: l.vorname || null,
      telefon: l.telefon || null,
      lead_id: l.id,
      agent_name: req.agent!.name,
      antrag_url: antragUrl(l.id),
    });
    await sqlPool`UPDATE fiaon_leads SET status = CASE WHEN status = 'neu' THEN 'kontaktiert' ELSE status END, letzter_kontakt_am = NOW(), updated_at = NOW() WHERE id = ${l.id}`;
    await logLead(l.id, req.agent!, "email_sent", { note: "Antrags-Link an Lead gesendet (Make: lead_application_link)" });
    res.json({ ok: true, antragUrl: antragUrl(l.id) });
  } catch (err) {
    console.error("[FIAON-LEADS] move-to-application:", err);
    res.status(500).json({ ok: false, error: "Serverfehler" });
  }
});

// ═══════════════════════════════════════════════════════════════════
// ADMIN — Lead-Management (mount /api/fiaon, hinter blockAgentsFromAdmin)
// ═══════════════════════════════════════════════════════════════════

router.get("/admin/leads", async (req: Request, res: Response) => {
  try {
    await ensureLeadTables();
    const status = typeof req.query.status === "string" ? req.query.status : null;
    // BE3: gruppierte Filter-Chips (Alle · Offen · Konvertiert · Tot/Kein Interesse)
    const group = typeof req.query.group === "string" ? req.query.group : null;
    const q = typeof req.query.q === "string" ? req.query.q.trim().toLowerCase() : "";
    const sort = req.query.sort === "status" ? "status" : "datum";
    const limit = Math.min(500, Math.max(1, Number(req.query.limit) || 200));
    const groupStatuses =
      group === "offen" ? ["neu", "kontaktiert", "nicht_erreichbar"]
      : group === "konvertiert" ? ["konvertiert"]
      : group === "tot" ? ["tot", "kein_interesse"]
      : null;
    // Ticket #15: eigener Filter „Aussortiert" (aus einer Agenten-Liste entfernt,
    // aber nie gelöscht). In allen anderen Ansichten werden aussortierte Leads
    // ausgeblendet, damit sie die normalen Listen nicht überfrachten.
    const dismissedView = group === "aussortiert";

    // Konvertierte Zeilen mit verknüpfter Order (Zahlungsstatus + Betrag) anreichern.
    const rows = await sqlPool`
      SELECT l.id, l.vorname, l.nachname, l.email, l.telefon, l.quelle, l.kampagne, l.status,
             l.assigned_agent_id, ag.name AS agent_name, l.converted_order_id, l.in_sequence,
             l.erstellt_am, l.letzter_kontakt_am, l.konvertiert_am, l.lead_reminder_count,
             l.opened_at, l.opened_by_agent_id, og.name AS opened_by_name,
             l.dismissed_at, l.dismissed_reason, l.dismissed_by, dg.name AS dismissed_by_name,
             a.payment_status, a.amount_due, a.pack_name, a.created_at AS order_created_at
      FROM fiaon_leads l
      LEFT JOIN fiaon_agents ag ON ag.id = l.assigned_agent_id
      LEFT JOIN fiaon_agents og ON og.id = l.opened_by_agent_id
      LEFT JOIN fiaon_agents dg ON dg.id = l.dismissed_by
      LEFT JOIN fiaon_applications a ON a.ref = l.converted_order_id AND a.merged_into IS NULL
      WHERE (${status}::text IS NULL OR l.status = ${status})
        AND (${groupStatuses}::text[] IS NULL OR l.status = ANY(${groupStatuses}))
        AND ((${dismissedView})::boolean = (l.dismissed_at IS NOT NULL))
        AND (${q} = '' OR LOWER(COALESCE(l.vorname,'') || ' ' || COALESCE(l.nachname,'') || ' ' || COALESCE(l.email,'') || ' ' || COALESCE(l.telefon,'')) LIKE ${"%" + q + "%"})
      ORDER BY
        CASE WHEN ${sort} = 'status' THEN l.status END ASC,
        l.erstellt_am DESC
      LIMIT ${limit}
    `;
    const counts = await sqlPool`SELECT status, COUNT(*)::int AS c FROM fiaon_leads WHERE dismissed_at IS NULL GROUP BY status`;
    const byStatus: Record<string, number> = {};
    for (const r of counts) byStatus[r.status] = Number(r.c);
    const [dismissedCount] = await sqlPool`SELECT COUNT(*)::int AS c FROM fiaon_leads WHERE dismissed_at IS NOT NULL`;
    byStatus.aussortiert = Number(dismissedCount.c);

    // BE3-Kennzahlen: X Leads → Y konvertiert → Z zahlend (Umsatz) + offene Leads.
    const [stats] = await sqlPool`
      SELECT
        COUNT(*)::int AS total,
        COUNT(*) FILTER (WHERE l.status = 'konvertiert')::int AS converted,
        COUNT(*) FILTER (WHERE l.status IN ('neu','kontaktiert','nicht_erreichbar'))::int AS open,
        -- P2-D: "Zahlend" = die EINE Wahrheit (paid + Referenz), identisch zu Finanzen/Zahlungszentrale
        COUNT(*) FILTER (WHERE a.payment_status = 'paid' AND NOT COALESCE(a.alt_bestand, FALSE))::int AS paying,
        COALESCE(SUM(CASE WHEN a.payment_status = 'paid' AND NOT COALESCE(a.alt_bestand, FALSE) THEN ROUND(COALESCE(a.amount_due::numeric,0)*100) ELSE 0 END),0)::bigint AS revenue_cents
      FROM fiaon_leads l
      LEFT JOIN fiaon_applications a ON a.ref = l.converted_order_id AND a.merged_into IS NULL
    `;
    const total = Number(stats.total);
    const converted = Number(stats.converted);
    res.json({
      ok: true,
      data: rows,
      counts: byStatus,
      stats: {
        total,
        converted,
        convertedPct: total > 0 ? Math.round((converted / total) * 1000) / 10 : null,
        open: Number(stats.open),
        paying: Number(stats.paying),
        revenueCents: Number(stats.revenue_cents),
      },
    });
  } catch (err) {
    console.error("[FIAON-LEADS] admin/leads:", err);
    res.status(500).json({ ok: false, error: "Serverfehler" });
  }
});

// WICHTIG: numerischer Constraint (\d+), sonst matcht diese Route auch die
// literalen Pfade /admin/leads/settings und /admin/leads/intake-diagnostics
// (Express prüft in Registrierungsreihenfolge) → NaN-„Lead" → 404 → Panels
// laden nie und bleiben unsichtbar (Ursache des CB/CD-Sichtbarkeitsfehlers).
router.get("/admin/leads/:id(\\d+)", async (req: Request, res: Response) => {
  try {
    await ensureLeadTables();
    const id = Number(req.params.id);
    const rows = await sqlPool`
      SELECT l.*, ag.name AS agent_name, og.name AS opened_by_name, dg.name AS dismissed_by_name FROM fiaon_leads l
      LEFT JOIN fiaon_agents ag ON ag.id = l.assigned_agent_id
      LEFT JOIN fiaon_agents og ON og.id = l.opened_by_agent_id
      LEFT JOIN fiaon_agents dg ON dg.id = l.dismissed_by
      WHERE l.id = ${id}
    `;
    if (rows.length === 0) return res.status(404).json({ ok: false, error: "Lead nicht gefunden" });
    const log = await sqlPool`SELECT id, type, outcome, note, agent_name, scheduled_at, created_at FROM fiaon_lead_log WHERE lead_id = ${id} ORDER BY created_at DESC`;
    res.json({ ok: true, lead: rows[0], log });
  } catch (err) {
    console.error("[FIAON-LEADS] admin/leads/:id:", err);
    res.status(500).json({ ok: false, error: "Serverfehler" });
  }
});

// ── V2 (Phase 2B) ADMIN-NOTAUSGANG: jede blockierte Akte freigeben — z. B. wenn
// ein Agent im Urlaub/nicht erreichbar ist. Lead zurück in die Warteschlange,
// Historie bleibt, Freigabe wird protokolliert.
router.post("/admin/leads/:id/release-akte", async (req: Request, res: Response) => {
  try {
    await ensureLeadTables();
    const id = Number(req.params.id);
    const rows = await sqlPool`
      UPDATE fiaon_leads l SET opened_at = NULL, updated_at = NOW()
      FROM fiaon_agents ag
      WHERE l.id = ${id} AND l.opened_at IS NOT NULL AND ag.id = l.opened_by_agent_id
      RETURNING l.id, ag.name AS agent_name
    `;
    if (rows.length === 0) return res.status(404).json({ ok: false, error: "Keine offene Akte unter dieser Nummer." });
    await logLead(id, { id: null, name: "Admin" }, "system", {
      note: `Akte durch Admin freigegeben (war offen bei ${rows[0].agent_name}). Lead ist zurück in der Warteschlange.`,
    });
    res.json({ ok: true, releasedFrom: rows[0].agent_name });
  } catch (err) {
    console.error("[FIAON-LEADS] release-akte:", err);
    res.status(500).json({ ok: false, error: "Serverfehler" });
  }
});

// Ticket #15: aussortierten Lead wieder in die Arbeit zurückholen (Admin).
router.post("/admin/leads/:id/restore", async (req: Request, res: Response) => {
  try {
    await ensureLeadTables();
    const id = Number(req.params.id);
    const rows = await sqlPool`
      UPDATE fiaon_leads SET dismissed_at = NULL, dismissed_by = NULL, dismissed_reason = NULL, requeue_at = NULL, updated_at = NOW()
      WHERE id = ${id} AND dismissed_at IS NOT NULL
      RETURNING id
    `;
    if (rows.length === 0) return res.status(404).json({ ok: false, error: "Kein aussortierter Lead unter dieser Nummer." });
    await logLead(id, { id: null, name: "Admin" }, "system", {
      note: "Lead durch Admin zurückgeholt (nicht mehr aussortiert) — steht wieder in der Arbeitswarteschlange.",
    });
    res.json({ ok: true });
  } catch (err) {
    console.error("[FIAON-LEADS] restore:", err);
    res.status(500).json({ ok: false, error: "Serverfehler" });
  }
});

router.post("/admin/leads/:id/assign", async (req: Request, res: Response) => {
  try {
    await ensureLeadTables();
    const id = Number(req.params.id);
    const agentId = req.body?.agentId === null || req.body?.agentId === undefined ? null : Number(req.body.agentId);
    if (agentId !== null) {
      const a = await sqlPool`SELECT name FROM fiaon_agents WHERE id = ${agentId} AND active = TRUE`;
      if (a.length === 0) return res.status(400).json({ ok: false, error: "Agent nicht gefunden/inaktiv" });
      await sqlPool`UPDATE fiaon_leads SET assigned_agent_id = ${agentId}, updated_at = NOW() WHERE id = ${id}`;
      await logLead(id, { id: null, name: "Admin" }, "system", { note: `Manuell zugewiesen an ${a[0].name}` });
    } else {
      await sqlPool`UPDATE fiaon_leads SET assigned_agent_id = NULL, updated_at = NOW() WHERE id = ${id}`;
      await logLead(id, { id: null, name: "Admin" }, "system", { note: "Zuweisung entfernt (zur Neuverteilung freigegeben)" });
    }
    res.json({ ok: true });
  } catch (err) {
    console.error("[FIAON-LEADS] assign:", err);
    res.status(500).json({ ok: false, error: "Serverfehler" });
  }
});

// ── Paket CC: Admin-Lead-Aktionen (Bearbeiten/Ergebnis/Notiz/Status/Versand) ──
const ADMIN_ACTOR = { id: null as number | null, name: "Admin" };

router.post("/admin/leads/:id/notes", async (req: Request, res: Response) => {
  try {
    await ensureLeadTables();
    const note = String(req.body?.note || "").trim();
    if (!note) return res.status(400).json({ ok: false, error: "Notiz darf nicht leer sein" });
    if (note.length > 4000) return res.status(400).json({ ok: false, error: "Notiz zu lang (max. 4000 Zeichen)" });
    const exists = await sqlPool`SELECT id FROM fiaon_leads WHERE id = ${Number(req.params.id)}`;
    if (exists.length === 0) return res.status(404).json({ ok: false, error: "Lead nicht gefunden" });
    const entry = await logLead(Number(req.params.id), ADMIN_ACTOR, "note", { note });
    res.json({ ok: true, entry });
  } catch (err) {
    console.error("[FIAON-LEADS] admin note:", err);
    res.status(500).json({ ok: false, error: "Serverfehler" });
  }
});

router.post("/admin/leads/:id/contact-result", async (req: Request, res: Response) => {
  try {
    await ensureLeadTables();
    const { outcome, scheduledAt, note } = req.body || {};
    if (!(outcome in LEAD_OUTCOMES)) return res.status(400).json({ ok: false, error: "Ungültiges Kontakt-Ergebnis" });
    if (outcome === "rueckruf_termin" && !scheduledAt) return res.status(400).json({ ok: false, error: "Termin-Datum erforderlich" });
    const id = Number(req.params.id);
    const exists = await sqlPool`SELECT id FROM fiaon_leads WHERE id = ${id}`;
    if (exists.length === 0) return res.status(404).json({ ok: false, error: "Lead nicht gefunden" });
    const entry = await logLead(id, ADMIN_ACTOR, "result", {
      outcome, note: note ? String(note).slice(0, 4000) : null, scheduledAt: scheduledAt || null,
    });
    const newStatus = LEAD_OUTCOMES[outcome];
    // „Kein Interesse" nimmt den Lead aus der Automatik (in_sequence=FALSE).
    await sqlPool`
      UPDATE fiaon_leads SET status = ${newStatus},
        in_sequence = CASE WHEN ${newStatus} IN ('kein_interesse') THEN FALSE ELSE in_sequence END,
        letzter_kontakt_am = NOW(), updated_at = NOW()
      WHERE id = ${id} AND status <> 'konvertiert'
    `;
    res.json({ ok: true, entry });
  } catch (err) {
    console.error("[FIAON-LEADS] admin contact-result:", err);
    res.status(500).json({ ok: false, error: "Serverfehler" });
  }
});

router.patch("/admin/leads/:id/contact-data", async (req: Request, res: Response) => {
  await ensureLeadTables();
  return updateLeadContact(Number(req.params.id), req.body, ADMIN_ACTOR, res);
});

const ADMIN_STATUSES = ["neu", "kontaktiert", "nicht_erreichbar", "kein_interesse", "tot"] as const;
router.post("/admin/leads/:id/status", async (req: Request, res: Response) => {
  try {
    await ensureLeadTables();
    const status = String(req.body?.status || "");
    if (!ADMIN_STATUSES.includes(status as any)) return res.status(400).json({ ok: false, error: "Ungültiger Status" });
    const id = Number(req.params.id);
    const rows = await sqlPool`SELECT status FROM fiaon_leads WHERE id = ${id}`;
    if (rows.length === 0) return res.status(404).json({ ok: false, error: "Lead nicht gefunden" });
    if (rows[0].status === "konvertiert") return res.status(409).json({ ok: false, error: "Konvertierte Leads können nicht geändert werden" });
    // Tot/Kein-Interesse raus aus der Automatik; Reaktivierung nimmt wieder auf.
    await sqlPool`
      UPDATE fiaon_leads SET status = ${status},
        in_sequence = CASE WHEN ${status} IN ('tot','kein_interesse') THEN FALSE ELSE TRUE END,
        updated_at = NOW()
      WHERE id = ${id}
    `;
    await logLead(id, ADMIN_ACTOR, "system", { note: `Status manuell auf „${status}" gesetzt (Admin)` });
    res.json({ ok: true });
  } catch (err) {
    console.error("[FIAON-LEADS] admin status:", err);
    res.status(500).json({ ok: false, error: "Serverfehler" });
  }
});

// P3 (Lead ↔ Antrag derselben Person): einen offenen Lead an einen bereits
// bezahlten/aktiven KUNDEN anhängen — der Lead wird auf 'konvertiert' gesetzt und
// verlässt die Anruf-Warteschlange (kein Doppelanruf), bleibt aber vollständig in
// der DB (Historie/Provisionsspur intakt). Berührt KEINE Zahlung/Provision des
// Kunden. Rückholbar über Status-Reset (Admin).
router.post("/admin/leads/:id/attach-to-order", async (req: Request, res: Response) => {
  try {
    await ensureLeadTables();
    const id = Number(req.params.id);
    const orderRef = String(req.body?.ref || "").trim();
    if (!orderRef) return res.status(400).json({ ok: false, error: "Kunden-Referenz (ref) erforderlich" });
    const leadRows = await sqlPool`SELECT id, status, converted_order_id FROM fiaon_leads WHERE id = ${id}`;
    if (leadRows.length === 0) return res.status(404).json({ ok: false, error: "Lead nicht gefunden" });
    // Zielkunde muss existieren und darf keine Dublette sein.
    const app = await sqlPool`SELECT ref, payment_status FROM fiaon_applications WHERE ref = ${orderRef} AND merged_into IS NULL`;
    if (app.length === 0) return res.status(404).json({ ok: false, error: "Kunde/Antrag nicht gefunden" });
    await sqlPool`
      UPDATE fiaon_leads SET
        status = 'konvertiert',
        converted_order_id = ${orderRef},
        konvertiert_am = COALESCE(konvertiert_am, NOW()),
        in_sequence = FALSE,
        updated_at = NOW()
      WHERE id = ${id}
    `;
    await logLead(id, ADMIN_ACTOR, "system", {
      note: `Lead als konvertiert mit bestehendem Kunden ${orderRef} verknüpft (Dubletten-Bereinigung) — verlässt die Anruf-Warteschlange, kein Doppelanruf. Zahlung/Provision unberührt.`,
    });
    await sqlPool`
      INSERT INTO fiaon_contact_log (ref, agent_id, agent_name, type, note)
      VALUES (${orderRef}, NULL, 'Admin', 'system',
              ${`Offener Lead #${id} als dieselbe Person erkannt und verknüpft (aus /admin/dubletten). Kein weiterer Anruf über diesen Lead.`})
    `.catch(() => {});
    console.log(`[FIAON-LEADS] attach-to-order: Lead #${id} → ${orderRef} (${app[0].payment_status})`);
    res.json({ ok: true, ref: orderRef });
  } catch (err) {
    console.error("[FIAON-LEADS] admin attach-to-order:", err);
    res.status(500).json({ ok: false, error: "Serverfehler" });
  }
});

// „Zahlungslink/Antrag senden" — Make lead_application_link, 10-Min-Sperre gegen Doppelversand.
router.post("/admin/leads/:id/send-application-link", async (req: Request, res: Response) => {
  try {
    await ensureLeadTables();
    const id = Number(req.params.id);
    const rows = await sqlPool`SELECT * FROM fiaon_leads WHERE id = ${id}`;
    if (rows.length === 0) return res.status(404).json({ ok: false, error: "Lead nicht gefunden" });
    const l = rows[0];
    if (!l.email && !l.telefon) return res.status(400).json({ ok: false, error: "Kein Kontaktweg (E-Mail/Telefon) hinterlegt" });
    const recent = await sqlPool`
      SELECT id FROM fiaon_lead_log WHERE lead_id = ${id} AND type = 'email_sent' AND created_at > NOW() - INTERVAL '10 minutes' LIMIT 1
    `;
    if (recent.length > 0) return res.status(429).json({ ok: false, error: "Bereits in den letzten 10 Minuten gesendet" });
    await sendMakeWebhook("lead_application_link", {
      email: l.email || "", vorname: l.vorname || null, telefon: l.telefon || null,
      lead_id: l.id, agent_name: "Admin", antrag_url: antragUrl(l.id),
    });
    await sqlPool`UPDATE fiaon_leads SET status = CASE WHEN status = 'neu' THEN 'kontaktiert' ELSE status END, letzter_kontakt_am = NOW(), updated_at = NOW() WHERE id = ${id}`;
    await logLead(id, ADMIN_ACTOR, "email_sent", { note: "Antrags-/Zahlungslink an Lead gesendet (Make: lead_application_link)" });
    res.json({ ok: true, antragUrl: antragUrl(l.id) });
  } catch (err) {
    console.error("[FIAON-LEADS] admin send-application-link:", err);
    res.status(500).json({ ok: false, error: "Serverfehler" });
  }
});

// „Follow-up jetzt senden" — manuell EIN lead_followup für genau diesen Lead (8h-Dedupe).
router.post("/admin/leads/:id/send-followup", async (req: Request, res: Response) => {
  try {
    await ensureLeadTables();
    const id = Number(req.params.id);
    const rows = await sqlPool`SELECT * FROM fiaon_leads WHERE id = ${id}`;
    if (rows.length === 0) return res.status(404).json({ ok: false, error: "Lead nicht gefunden" });
    const l = rows[0];
    if (["konvertiert", "tot", "kein_interesse"].includes(l.status)) return res.status(409).json({ ok: false, error: "Lead ist nicht mehr offen" });
    if (!l.email && !l.telefon) return res.status(400).json({ ok: false, error: "Kein Kontaktweg hinterlegt" });
    if (l.last_lead_reminder_at && Date.now() - new Date(l.last_lead_reminder_at).getTime() < 8 * 3600 * 1000) {
      return res.status(429).json({ ok: false, error: "Dedupe: letzter Nachfass < 8 Stunden her" });
    }
    const updated = await sqlPool`
      UPDATE fiaon_leads SET last_lead_reminder_at = NOW(), lead_reminder_count = COALESCE(lead_reminder_count,0)+1,
        letzter_kontakt_am = NOW(), status = CASE WHEN status = 'neu' THEN 'kontaktiert' ELSE status END, updated_at = NOW()
      WHERE id = ${id} RETURNING id, vorname, nachname, email, telefon, quelle, lead_reminder_count
    `;
    await sendMakeWebhook("lead_followup", followupPayload(updated[0]));
    await logLead(id, ADMIN_ACTOR, "followup", { note: `Manueller Nachfass #${updated[0].lead_reminder_count} gesendet (Admin, Make: lead_followup)` });
    res.json({ ok: true });
  } catch (err) {
    console.error("[FIAON-LEADS] admin send-followup:", err);
    res.status(500).json({ ok: false, error: "Serverfehler" });
  }
});

router.post("/admin/leads/distribute", async (_req: Request, res: Response) => {
  try {
    const assigned = await distributeUnassignedLeads();
    res.json({ ok: true, assigned });
  } catch (err) {
    console.error("[FIAON-LEADS] distribute:", err);
    res.status(500).json({ ok: false, error: "Serverfehler" });
  }
});

// BA3 — Rückwirkender Abgleich (einmaliger Migrationslauf, KEINE Mails).
router.post("/admin/leads/backfill-convert", async (_req: Request, res: Response) => {
  try {
    await ensureLeadTables();
    const rows = await sqlPool`
      WITH matched AS (
        SELECT l.id AS lead_id, (
          SELECT a.ref FROM fiaon_applications a
          WHERE a.merged_into IS NULL AND a.payment_status IN ('pending_payment','claimed_paid','paid')
            AND (
              (l.email IS NOT NULL AND a.email IS NOT NULL AND LOWER(TRIM(a.email)) = LOWER(TRIM(l.email)))
              OR (l.telefon IS NOT NULL AND l.telefon <> '' AND a.phone = l.telefon)
            )
          ORDER BY a.created_at ASC LIMIT 1
        ) AS ref
        FROM fiaon_leads l
        WHERE l.status IN ('neu','kontaktiert','nicht_erreichbar')
      )
      UPDATE fiaon_leads l SET
        status = 'konvertiert', converted_order_id = m.ref, konvertiert_am = NOW(), updated_at = NOW()
      FROM matched m
      WHERE l.id = m.lead_id AND m.ref IS NOT NULL
      RETURNING l.id, l.converted_order_id
    `;
    for (const r of rows) {
      await logLead(r.id, { id: null, name: "System" }, "system", { note: `Rückwirkend konvertiert — Antrag ${r.converted_order_id} (Migrationslauf, ohne Mail)` });
    }
    console.log(`[FIAON-LEADS] Backfill-Konversion: ${rows.length} Lead(s) gematcht`);
    res.json({ ok: true, converted: rows.length });
  } catch (err) {
    console.error("[FIAON-LEADS] backfill-convert:", err);
    res.status(500).json({ ok: false, error: "Serverfehler" });
  }
});

// ═══════════════════════════════════════════════════════════════════
// BE1/BE2 — ALT-LEAD-IMPORT (Datei/Paste → gemappte Zeilen, batchweise)
//
// Verarbeitung ist zeilen-/batchweise (kein Full-File/Full-Table-Load).
// Das Frontend parst Datei/Paste, mappt Spalten und sendet Zeilen in Batches
// an diesen Endpoint. Dreifaches Dubletten-Handling (Datei→Lead→Kunde) greift
// pro Zeile; Import löst NIE Mails aus (in_sequence nur bei Opt-in TRUE).
// ═══════════════════════════════════════════════════════════════════

interface ImportRow {
  vorname?: string; nachname?: string; email?: string; telefon?: string;
  quelle?: string; kampagne?: string; erstellt_am?: string;
}

async function findConvertedOrderRef(email: string | null, phone: string | null): Promise<string | null> {
  const rows = await sqlPool`
    SELECT ref FROM fiaon_applications
    WHERE merged_into IS NULL AND payment_status IN ('pending_payment','claimed_paid','paid')
      AND (
        (${email}::text IS NOT NULL AND LOWER(TRIM(COALESCE(email,''))) = ${email})
        OR (${email}::text IS NOT NULL AND LOWER(TRIM(COALESCE(contact_email,''))) = ${email})
        OR (${email}::text IS NOT NULL AND LOWER(TRIM(COALESCE(billing_email,''))) = ${email})
        OR (${phone}::text IS NOT NULL AND ${phone} <> '' AND phone = ${phone})
      )
    ORDER BY created_at ASC LIMIT 1
  `;
  return rows.length ? rows[0].ref : null;
}

router.post("/admin/leads/import", async (req: Request, res: Response) => {
  try {
    await ensureLeadTables();
    const b = req.body || {};
    const importId = String(b.importId || "").trim().slice(0, 80);
    const rows: ImportRow[] = Array.isArray(b.rows) ? b.rows : [];
    if (!importId) return res.status(400).json({ ok: false, error: "importId erforderlich" });
    if (rows.length === 0) return res.status(400).json({ ok: false, error: "Keine Zeilen im Batch" });
    if (rows.length > 1000) return res.status(400).json({ ok: false, error: "Batch zu groß (max. 1000 Zeilen)" });

    const defaultSource = String(b.defaultSource || "import").slice(0, 120) || "import";
    const defaultCampaign = b.defaultCampaign ? String(b.defaultCampaign).slice(0, 200) : null;
    const addToSequence = b.addToSequence === true;
    const adminName = String(b.adminName || "Admin").slice(0, 120);

    let imported = 0, converted = 0, updated = 0;
    const skipped: Array<{ email?: string; telefon?: string; reason: string }> = [];

    for (const raw of rows) {
      const vorname = raw.vorname ? String(raw.vorname).trim().slice(0, 200) : null;
      const nachname = raw.nachname ? String(raw.nachname).trim().slice(0, 200) : null;
      let email: string | null = raw.email ? String(raw.email).trim().toLowerCase() : null;
      if (email && !EMAIL_RE.test(email)) email = null;
      const phone = raw.telefon ? normalizePhone(String(raw.telefon)) : null;
      if (!email && !phone) {
        skipped.push({ email: raw.email, telefon: raw.telefon, reason: "Weder gültige E-Mail noch Telefon" });
        continue;
      }
      const quelle = (raw.quelle ? String(raw.quelle).trim() : "").slice(0, 120) || defaultSource;
      const kampagne = (raw.kampagne ? String(raw.kampagne).trim().slice(0, 200) : null) || defaultCampaign;
      let createdAt: Date | null = null;
      if (raw.erstellt_am) { const d = new Date(raw.erstellt_am); if (!isNaN(d.getTime())) createdAt = d; }

      // Dublette gegen bestehenden Lead (E-Mail ODER Telefon).
      const existing = await sqlPool`
        SELECT id, status FROM fiaon_leads
        WHERE (${email}::text IS NOT NULL AND email IS NOT NULL AND LOWER(TRIM(email)) = ${email})
           OR (${phone}::text IS NOT NULL AND ${phone} <> '' AND telefon = ${phone})
        ORDER BY erstellt_am ASC LIMIT 1
      `;
      const orderRef = await findConvertedOrderRef(email, phone);

      if (existing.length > 0) {
        const id = existing[0].id;
        const alreadyConverted = existing[0].status === "konvertiert";
        if (orderRef && !alreadyConverted) {
          await sqlPool`
            UPDATE fiaon_leads SET
              vorname = COALESCE(vorname, ${vorname}), nachname = COALESCE(nachname, ${nachname}),
              email = COALESCE(email, ${email}), telefon = COALESCE(NULLIF(telefon,''), ${phone}),
              kampagne = COALESCE(kampagne, ${kampagne}), import_id = COALESCE(import_id, ${importId}),
              status = 'konvertiert', converted_order_id = ${orderRef}, konvertiert_am = NOW(),
              in_sequence = FALSE, updated_at = NOW()
            WHERE id = ${id}
          `;
          await logLead(id, { id: null, name: adminName }, "system", { note: `Import: bereits Kunde (Antrag ${orderRef}) → als konvertiert markiert` });
          converted++;
        } else {
          await sqlPool`
            UPDATE fiaon_leads SET
              vorname = COALESCE(vorname, ${vorname}), nachname = COALESCE(nachname, ${nachname}),
              email = COALESCE(email, ${email}), telefon = COALESCE(NULLIF(telefon,''), ${phone}),
              kampagne = COALESCE(kampagne, ${kampagne}), import_id = COALESCE(import_id, ${importId}),
              updated_at = NOW()
            WHERE id = ${id}
          `;
          updated++;
        }
        continue;
      }

      // Neuer Lead — bei Bestandskunden-Treffer sofort konvertiert anlegen.
      if (orderRef) {
        const ins = await sqlPool`
          INSERT INTO fiaon_leads (vorname, nachname, email, telefon, quelle, kampagne, status,
                                   converted_order_id, konvertiert_am, in_sequence, import_id, erstellt_am)
          VALUES (${vorname}, ${nachname}, ${email}, ${phone || null}, ${quelle}, ${kampagne}, 'konvertiert',
                  ${orderRef}, NOW(), FALSE, ${importId}, COALESCE(${createdAt}::timestamptz, NOW()))
          RETURNING id
        `;
        await logLead(ins[0].id, { id: null, name: adminName }, "system", { note: `Import: bereits Kunde (Antrag ${orderRef}) → als konvertiert angelegt (Quelle ${quelle})` });
        converted++;
      } else {
        const ins = await sqlPool`
          INSERT INTO fiaon_leads (vorname, nachname, email, telefon, quelle, kampagne, status,
                                   in_sequence, import_id, erstellt_am)
          VALUES (${vorname}, ${nachname}, ${email}, ${phone || null}, ${quelle}, ${kampagne}, 'neu',
                  ${addToSequence}, ${importId}, COALESCE(${createdAt}::timestamptz, NOW()))
          RETURNING id
        `;
        await logLead(ins[0].id, { id: null, name: adminName }, "system", { note: `Import (Quelle ${quelle}${kampagne ? `, Kampagne ${kampagne}` : ""})${addToSequence ? " — Nachfass-Sequenz aktiv" : " — ohne Sequenz"}` });
        imported++;
      }
    }

    // Import-Protokoll (Audit) server-autoritativ hochzählen.
    await sqlPool`
      INSERT INTO fiaon_lead_imports (import_id, admin_name, source, campaign, add_to_sequence, total, imported, converted, updated, skipped)
      VALUES (${importId}, ${adminName}, ${defaultSource}, ${defaultCampaign}, ${addToSequence},
              ${rows.length}, ${imported}, ${converted}, ${updated}, ${skipped.length})
      ON CONFLICT (import_id) DO UPDATE SET
        total = fiaon_lead_imports.total + EXCLUDED.total,
        imported = fiaon_lead_imports.imported + EXCLUDED.imported,
        converted = fiaon_lead_imports.converted + EXCLUDED.converted,
        updated = fiaon_lead_imports.updated + EXCLUDED.updated,
        skipped = fiaon_lead_imports.skipped + EXCLUDED.skipped,
        updated_at = NOW()
    `;

    res.json({ ok: true, imported, converted, updated, skipped });
  } catch (err) {
    console.error("[FIAON-LEADS] import:", err);
    res.status(500).json({ ok: false, error: "Serverfehler beim Import" });
  }
});

// BE2 — importierte Leads bewusst in die Nachfass-Sequenz aufnehmen (Opt-in nach Import).
router.post("/admin/leads/enable-sequence", async (req: Request, res: Response) => {
  try {
    await ensureLeadTables();
    const importId = req.body?.importId ? String(req.body.importId).slice(0, 80) : null;
    const rows = await sqlPool`
      UPDATE fiaon_leads SET in_sequence = TRUE, updated_at = NOW()
      WHERE in_sequence = FALSE AND status IN ('neu','kontaktiert','nicht_erreichbar')
        AND (${importId}::text IS NULL OR import_id = ${importId})
      RETURNING id
    `;
    console.log(`[FIAON-LEADS] Sequenz aktiviert für ${rows.length} importierte Lead(s)`);
    res.json({ ok: true, activated: rows.length });
  } catch (err) {
    console.error("[FIAON-LEADS] enable-sequence:", err);
    res.status(500).json({ ok: false, error: "Serverfehler" });
  }
});

// BB/CB — Nachfass-Engine: Einstellungen lesen/schreiben + Tageskennzahl
router.get("/admin/leads/settings", async (_req: Request, res: Response) => {
  await ensureLeadTables();
  const s = await getSettings();
  // CB3: „Heute versendete Lead-Follow-ups" (Berlin-Tag) aus dem Lead-Log.
  const [today] = await sqlPool`
    SELECT COUNT(*)::int AS c FROM fiaon_lead_log
    WHERE type = 'followup'
      AND (created_at AT TIME ZONE 'Europe/Berlin')::date = (NOW() AT TIME ZONE 'Europe/Berlin')::date
  `;
  const qw = queueWeights(s);
  res.json({
    ok: true,
    settings: {
      lead_followup_enabled: s.lead_followup_enabled,
      lead_followup_days: s.lead_followup_days,
      lead_followup_window_start: s.lead_followup_window_start,
      lead_followup_window_end: s.lead_followup_window_end,
      max_lead_followups: s.max_lead_followups,
      lead_distribution_enabled: s.lead_distribution_enabled,
      lead_followup_times: parseTimes(s.lead_followup_times).map((t) => t.key).join(","),
      lead_followup_weekdays: parseWeekdays(s.lead_followup_weekdays).join(","),
      // P2-C: Warteschlangen-Gewichte (Frische/Potenzial/Reaktion/Kontakthistorie) + Fairness
      queue_w_fresh: String(qw.wFresh),
      queue_w_value: String(qw.wValue),
      queue_w_react: String(qw.wReact),
      queue_w_contact: String(qw.wContact),
      queue_fairness_nth: String(qw.fairnessNth),
      // V2 (Phase 2B): Auto-Freigabe offener Akten (Minuten, 0 = nie)
      akte_auto_release_min: s.akte_auto_release_min ?? "30",
      // V1 (Phase 2B): Stichtag der neuen Provisionsregel — NUR ANZEIGE.
      // Setzen erfolgt bewusst einmalig per Scharfstellungs-Skript, nicht per Formular.
      commission_cutoff_at: s.commission_cutoff_at ?? "",
    },
    withinWindow: withinHardWindow(),
    sentToday: Number(today.c),
    nextRunLabel: nextRunLabel(s),
  });
});

router.post("/admin/leads/settings", async (req: Request, res: Response) => {
  try {
    const b = req.body || {};
    // Zeitplan sanitisieren, damit nur gültige Sendezeiten/Wochentage gespeichert werden.
    if (b.lead_followup_times !== undefined) {
      const times = parseTimes(String(b.lead_followup_times)).slice(0, 6).map((t) => t.key);
      if (times.length === 0) return res.status(400).json({ ok: false, error: "Mindestens eine gültige Sendezeit (HH:MM) angeben." });
      await setSetting("lead_followup_times", times.join(","));
    }
    if (b.lead_followup_weekdays !== undefined) {
      const wds = parseWeekdays(String(b.lead_followup_weekdays));
      await setSetting("lead_followup_weekdays", wds.join(","));
    }
    const allowed = [
      "lead_followup_enabled", "lead_followup_days", "lead_followup_window_start", "lead_followup_window_end",
      "max_lead_followups", "lead_distribution_enabled",
      // P2-C: Warteschlangen-Gewichtung + Fairness-Anteil (Admin-konfigurierbar)
      "queue_w_fresh", "queue_w_value", "queue_w_react", "queue_w_contact", "queue_fairness_nth",
      // V2 (Phase 2B): Auto-Freigabe offener Akten. commission_cutoff_at ist hier
      // bewusst NICHT erlaubt — der Stichtag darf nicht versehentlich verstellt werden.
      "akte_auto_release_min",
    ];
    for (const key of allowed) {
      if (b[key] !== undefined) await setSetting(key, String(b[key]));
    }
    res.json({ ok: true });
  } catch (err) {
    console.error("[FIAON-LEADS] settings:", err);
    res.status(500).json({ ok: false, error: "Serverfehler" });
  }
});

router.post("/admin/leads/run-followups", async (_req: Request, res: Response) => {
  try {
    const result = await runLeadFollowups({ force: true });
    res.json({ ok: true, ...result });
  } catch (err) {
    console.error("[FIAON-LEADS] run-followups:", err);
    res.status(500).json({ ok: false, error: "Serverfehler" });
  }
});

// ═══════════════════════════════════════════════════════════════════
// Paket CD — Intake-Diagnose + Test-Lead-Simulation
// ═══════════════════════════════════════════════════════════════════
router.get("/admin/leads/intake-diagnostics", async (_req: Request, res: Response) => {
  try {
    await ensureLeadTables();
    const [last] = await sqlPool`
      SELECT status, quelle, created_at FROM fiaon_lead_intake_log
      WHERE status IN ('ok','test') ORDER BY created_at DESC LIMIT 1
    `;
    const [c] = await sqlPool`
      SELECT
        COUNT(*) FILTER (WHERE status IN ('ok','test') AND created_at > NOW() - INTERVAL '24 hours')::int AS ok_24h,
        COUNT(*) FILTER (WHERE status IN ('ok','test') AND created_at > NOW() - INTERVAL '7 days')::int AS ok_7d,
        COUNT(*) FILTER (WHERE status = 'rejected_auth' AND created_at > NOW() - INTERVAL '7 days')::int AS rejected_7d,
        COUNT(*) FILTER (WHERE status = 'invalid' AND created_at > NOW() - INTERVAL '7 days')::int AS invalid_7d
      FROM fiaon_lead_intake_log
    `;
    const recentRejected = await sqlPool`
      SELECT status, detail, created_at FROM fiaon_lead_intake_log
      WHERE status IN ('rejected_auth','invalid') ORDER BY created_at DESC LIMIT 10
    `;
    res.json({
      ok: true,
      secretConfigured: Boolean(process.env.LEAD_INTAKE_SECRET),
      lastIntake: last || null,
      counts: { ok24h: Number(c.ok_24h), ok7d: Number(c.ok_7d), rejected7d: Number(c.rejected_7d), invalid7d: Number(c.invalid_7d) },
      recentRejected,
      doc: {
        intakeUrl: `${fiaonBaseUrl()}/api/leads/intake`,
        secretHeader: "x-lead-secret",
        payloadFields: ["email", "vorname", "nachname", "telefon", "quelle", "kampagne"],
      },
    });
  } catch (err) {
    console.error("[FIAON-LEADS] intake-diagnostics:", err);
    res.status(500).json({ ok: false, error: "Serverfehler" });
  }
});

// Test-Lead: legt direkt in-process (ohne HTTP-Selbstaufruf, ohne Secret, unabhängig vom
// Sendefenster) einen klar markierten Test-Lead über dieselbe Ingest-Logik wie der Webhook an.
router.post("/admin/leads/test-intake", async (_req: Request, res: Response) => {
  try {
    await ensureLeadTables();
    const stamp = Date.now();
    const payload = {
      email: `test+${stamp}@fiaon-intake-test.de`,
      vorname: "TEST",
      nachname: `Test-Lead ${new Date().toLocaleString("de-DE", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}`,
      telefon: null,
      quelle: "test",
      kampagne: "intake_test",
    };
    const result = await processIntake(payload);
    if (!result.ok) return res.status(result.code).json({ ok: false, error: result.error });
    res.json({ ok: true, id: result.id, deduped: result.deduped, lead: payload });
  } catch (err: any) {
    console.error("[FIAON-LEADS] test-intake:", err);
    res.status(500).json({ ok: false, error: `Test-Lead fehlgeschlagen: ${err?.message || err}` });
  }
});

// Test-Leads (quelle='test') wieder entfernen.
router.delete("/admin/leads/test-leads", async (_req: Request, res: Response) => {
  try {
    await ensureLeadTables();
    const ids = await sqlPool`SELECT id FROM fiaon_leads WHERE quelle = 'test'`;
    if (ids.length > 0) {
      const idList = ids.map((r: any) => Number(r.id));
      await sqlPool`DELETE FROM fiaon_lead_log WHERE lead_id = ANY(${idList})`;
      await sqlPool`DELETE FROM fiaon_leads WHERE id = ANY(${idList})`;
    }
    await sqlPool`DELETE FROM fiaon_lead_intake_log WHERE status = 'test'`;
    res.json({ ok: true, deleted: ids.length });
  } catch (err) {
    console.error("[FIAON-LEADS] delete test-leads:", err);
    res.status(500).json({ ok: false, error: "Serverfehler" });
  }
});

// ── BB2/CF — Bulk-Versand (20/min, 8h-Dedupe, Obergrenze) ────────────────────
// Zwei Modi:
//   "eligible" = nur Leads in der Sequenz (in_sequence=TRUE) — die JETZT dran sind.
//   "all"      = ALLE offenen Leads inkl. importierter Alt-Leads (in_sequence egal);
//                beim Versand werden sie in die Sequenz aufgenommen (in_sequence=TRUE).
// Dedupe (8h), Obergrenze (max_lead_followups) und "konvertiert/tot raus" gelten in BEIDEN Modi.
const LEAD_BULK_BATCH = 20; // = 20 Mails/Minute (ein Batch pro 60s) → Drosselung für Zustellbarkeit
type BulkMode = "eligible" | "all";
interface LeadBulkState { running: boolean; mode: BulkMode; startedAt: string; finishedAt: string | null; planned: number; sent: number; errors: number; }
let leadBulkJob: LeadBulkState | null = null;

/** Vorschau „Jetzt versendbare" (nur Sequenz-Leads). */
async function leadBulkPreview(): Promise<{ eligible: number; skipped: number }> {
  const s = await getSettings();
  const max = Math.max(0, Math.round(Number(s.max_lead_followups)) || 5);
  const [row] = await sqlPool`
    SELECT
      COUNT(*) FILTER (WHERE COALESCE(lead_reminder_count,0) < ${max}
        AND (last_lead_reminder_at IS NULL OR last_lead_reminder_at < NOW() - INTERVAL '8 hours'))::int AS eligible,
      COUNT(*) FILTER (WHERE last_lead_reminder_at IS NOT NULL AND last_lead_reminder_at >= NOW() - INTERVAL '8 hours')::int AS skipped
    FROM fiaon_leads
    WHERE status IN ('neu','kontaktiert','nicht_erreichbar')
      AND in_sequence = TRUE
      AND COALESCE(NULLIF(email,''), NULLIF(telefon,'')) IS NOT NULL
  `;
  return { eligible: Number(row.eligible), skipped: Number(row.skipped) };
}

/** Vorschau „Allen offenen" (alle offenen Leads, inkl. importierte Alt-Leads). */
async function leadBulkPreviewAll(): Promise<{ openTotal: number; eligible: number; skipped: number; importedNeverContacted: number; overCap: number }> {
  const s = await getSettings();
  const max = Math.max(0, Math.round(Number(s.max_lead_followups)) || 5);
  const [row] = await sqlPool`
    SELECT
      COUNT(*)::int AS open_total,
      COUNT(*) FILTER (WHERE COALESCE(lead_reminder_count,0) < ${max}
        AND (last_lead_reminder_at IS NULL OR last_lead_reminder_at < NOW() - INTERVAL '8 hours'))::int AS eligible,
      COUNT(*) FILTER (WHERE last_lead_reminder_at IS NOT NULL AND last_lead_reminder_at >= NOW() - INTERVAL '8 hours')::int AS skipped,
      COUNT(*) FILTER (WHERE import_id IS NOT NULL AND COALESCE(lead_reminder_count,0) = 0)::int AS imported_never,
      COUNT(*) FILTER (WHERE COALESCE(lead_reminder_count,0) >= ${max})::int AS over_cap
    FROM fiaon_leads
    WHERE status IN ('neu','kontaktiert','nicht_erreichbar')
      AND COALESCE(NULLIF(email,''), NULLIF(telefon,'')) IS NOT NULL
  `;
  return {
    openTotal: Number(row.open_total),
    eligible: Number(row.eligible),
    skipped: Number(row.skipped),
    importedNeverContacted: Number(row.imported_never),
    overCap: Number(row.over_cap),
  };
}

/** Batch-Claim für Modus "all": ALLE offenen Leads (in_sequence egal) → nimmt sie in die Sequenz auf. */
async function claimAllOpenBatch(limit: number, maxFollowups: number): Promise<any[]> {
  const max = Math.max(0, Math.round(maxFollowups));
  const lim = Math.max(1, Math.round(limit));
  const sql = `
    UPDATE fiaon_leads SET
      last_lead_reminder_at = NOW(),
      lead_reminder_count = COALESCE(lead_reminder_count, 0) + 1,
      letzter_kontakt_am = NOW(),
      in_sequence = TRUE,
      status = CASE WHEN status = 'neu' THEN 'kontaktiert' ELSE status END,
      updated_at = NOW()
    WHERE id IN (
      SELECT l.id FROM fiaon_leads l
      WHERE l.status IN ('neu', 'kontaktiert', 'nicht_erreichbar')
        AND COALESCE(NULLIF(l.email, ''), NULLIF(l.telefon, '')) IS NOT NULL
        AND (l.last_lead_reminder_at IS NULL OR l.last_lead_reminder_at < NOW() - INTERVAL '8 hours')
        AND COALESCE(l.lead_reminder_count, 0) < ${max}
      ORDER BY l.erstellt_am ASC
      LIMIT ${lim}
      FOR UPDATE SKIP LOCKED
    )
    RETURNING id, vorname, nachname, email, telefon, quelle, lead_reminder_count
  `;
  return sqlPool.unsafe(sql);
}

router.get("/admin/leads/followup-bulk/preview", async (_req: Request, res: Response) => {
  try {
    await ensureLeadTables();
    const p = await leadBulkPreview();
    res.json({ ok: true, ...p, withinWindow: withinHardWindow(), jobRunning: Boolean(leadBulkJob?.running) });
  } catch (err) {
    console.error("[FIAON-LEADS] bulk preview:", err);
    res.status(500).json({ ok: false, error: "Serverfehler" });
  }
});

router.get("/admin/leads/followup-bulk/preview-all", async (_req: Request, res: Response) => {
  try {
    await ensureLeadTables();
    const p = await leadBulkPreviewAll();
    res.json({ ok: true, ...p, withinWindow: withinHardWindow(), jobRunning: Boolean(leadBulkJob?.running) });
  } catch (err) {
    console.error("[FIAON-LEADS] bulk preview-all:", err);
    res.status(500).json({ ok: false, error: "Serverfehler" });
  }
});

router.post("/admin/leads/followup-bulk/start", async (req: Request, res: Response) => {
  try {
    await ensureLeadTables();
    if (leadBulkJob?.running) return res.status(409).json({ ok: false, error: "Es läuft bereits ein Bulk-Versand" });
    const mode: BulkMode = req.body?.mode === "all" ? "all" : "eligible";
    // "eligible" respektiert das harte Fenster; "all" wird bewusst vom Vorgesetzter ausgelöst → kein Fensterzwang.
    if (mode === "eligible" && !withinHardWindow()) return res.status(400).json({ ok: false, error: "Automatischer Versand nur zwischen 08:00 und 20:00 Uhr (Europa/Berlin) möglich" });
    const s = await getSettings();
    const max = Math.max(0, Math.round(Number(s.max_lead_followups)) || 5);
    const planned = mode === "all" ? (await leadBulkPreviewAll()).eligible : (await leadBulkPreview()).eligible;
    if (planned === 0) return res.status(400).json({ ok: false, error: "Aktuell sind keine Leads versendbar (alle kürzlich kontaktiert, konvertiert oder am Limit)." });
    leadBulkJob = { running: true, mode, startedAt: new Date().toISOString(), finishedAt: null, planned, sent: 0, errors: 0 };
    res.json({ ok: true, mode, planned });

    (async () => {
      const job = leadBulkJob!;
      try {
        for (;;) {
          if (mode === "eligible" && !withinHardWindow()) break; // "all" läuft durch (Drosselung schützt)
          const batch = mode === "all"
            ? await claimAllOpenBatch(LEAD_BULK_BATCH, max)
            : await claimLeadFollowupBatch(LEAD_BULK_BATCH, { maxFollowups: max, planDays: null });
          if (batch.length === 0) break;
          for (const l of batch) {
            const ok = await sendMakeWebhook("lead_followup", followupPayload(l));
            await logLead(l.id, { id: null, name: "Admin" }, "followup", { note: `Bulk-Nachfass (${mode === "all" ? "alle offenen" : "versendbare"}) #${l.lead_reminder_count} gesendet (Make: lead_followup)` });
            if (ok) job.sent++; else job.errors++;
          }
          if (batch.length < LEAD_BULK_BATCH) break;
          await new Promise((r) => setTimeout(r, 60_000)); // 20/Minute
        }
      } catch (err) {
        console.error("[FIAON-LEADS] Bulk-Job-Fehler:", err);
      } finally {
        job.running = false;
        job.finishedAt = new Date().toISOString();
        console.log(`[FIAON-LEADS] Bulk (${job.mode}) abgeschlossen: ${job.sent}/${job.planned} versendet, ${job.errors} Fehler`);
      }
    })();
  } catch (err) {
    console.error("[FIAON-LEADS] bulk start:", err);
    res.status(500).json({ ok: false, error: "Serverfehler" });
  }
});

router.get("/admin/leads/followup-bulk/status", async (_req: Request, res: Response) => {
  res.json({ ok: true, job: leadBulkJob });
});

export { intakeRouter };
// ═══════════════════════════════════════════════════════════════════════════
// DIE ABMELDUNG — öffentlich, ein Klick, ohne Rückfrage
//
// ── WARUM DAS ZUR EWIGEN STRECKE GEHÖRT ────────────────────────────────────
// Eine Strecke, die nie endet, MUSS einen Ausgang haben. Ohne ihn ist sie
// rechtlich angreifbar und praktisch respektlos: Der einzige Weg, sie zu
// beenden, wäre eine Beschwerde — oder der Spam-Knopf, der jede andere Mail
// des Hauses mit hinunterzieht.
//
// ── KEIN „BESTÄTIGEN SIE NOCH EINMAL" ──────────────────────────────────────
// Wer abbestellt, hat sich entschieden. Eine Zwischenseite mit „Sind Sie
// sicher?" ist ein Versuch, ihn umzustimmen — und genau das erzeugt die
// Beschwerde, die man vermeiden wollte.
//
// ── WARUM EIN ZUFALLSSCHLÜSSEL UND KEINE KENNUNG ───────────────────────────
// Stünde die Lead-Nummer im Link, könnte jemand durch Hochzählen fremde
// Menschen abmelden. Der Schlüssel ist ein Zufallswert je Lead.
// ═══════════════════════════════════════════════════════════════════════════

router.get("/abmelden/:schluessel", async (req: Request, res: Response) => {
  try {
    const schluessel = String(req.params.schluessel || "").trim();
    if (schluessel.length < 20) return res.status(404).json({ ok: false, error: "Unbekannter Link." });
    const [lead] = (await sqlPool`
      SELECT id, vorname, email, abgemeldet_am FROM fiaon_leads
      WHERE abmelde_schluessel = ${schluessel}
    `) as any[];
    // Ein unbekannter Schlüssel bekommt dieselbe Antwort wie ein bekannter:
    // Sonst ließe sich über die Antwort prüfen, ob eine Adresse bei uns liegt.
    if (!lead) return res.json({ ok: true, schonAbgemeldet: false });
    res.json({
      ok: true,
      vorname: lead.vorname ?? null,
      schonAbgemeldet: lead.abgemeldet_am != null,
    });
  } catch (err) {
    console.error("[LEAD-STRECKE] Abmelde-Auskunft:", err);
    res.status(500).json({ ok: false, error: "Serverfehler" });
  }
});

router.post("/abmelden/:schluessel", async (req: Request, res: Response) => {
  try {
    const schluessel = String(req.params.schluessel || "").trim();
    if (schluessel.length < 20) return res.status(404).json({ ok: false, error: "Unbekannter Link." });
    const grund = String(req.body?.grund || "").trim().slice(0, 500) || null;

    const zeilen = (await sqlPool`
      UPDATE fiaon_leads SET
        abgemeldet_am = COALESCE(abgemeldet_am, NOW()),
        abgemeldet_grund = COALESCE(abgemeldet_grund, ${grund}),
        -- BEIDE Motoren stoppen: die ewige Strecke und den alten Nachfass.
        strecke_stopp = COALESCE(strecke_stopp, 'abgemeldet'),
        strecke_stopp_am = COALESCE(strecke_stopp_am, NOW()),
        in_sequence = FALSE,
        updated_at = NOW()
      WHERE abmelde_schluessel = ${schluessel}
      RETURNING id, email
    `) as any[];
    if (zeilen.length === 0) {
      // Auch hier: keine Auskunft darüber, ob der Schlüssel existiert.
      return res.json({ ok: true });
    }
    await logLead(zeilen[0].id, { id: null, name: "System" }, "system", {
      note: `Abmeldung über den Link in der E-Mail${grund ? `: ${grund}` : ""}. Strecke beendet.`,
    }).catch(() => {});
    console.log(`[LEAD-STRECKE] Abmeldung: Lead ${zeilen[0].id}`);
    res.json({ ok: true });
  } catch (err) {
    console.error("[LEAD-STRECKE] Abmeldung:", err);
    res.status(500).json({ ok: false, error: "Serverfehler" });
  }
});

// ── DIE KENNZAHLEN DER STRECKE ────────────────────────────────────────────
// „Manche kommen erst bei Mail 20" ist eine Behauptung, bis man sie zählt.
router.get("/admin/leads/strecke", async (_req: Request, res: Response) => {
  try {
    const { streckeZahlen } = await import("../lib/fiaon-lead-strecke");
    const { kadenzText, VARIANTEN } = await import("../../shared/fiaon-lead-strecke");
    const z = await streckeZahlen();
    res.json({ ok: true, ...z, kadenz: kadenzText(), varianten: VARIANTEN.length });
  } catch (err) {
    console.error("[LEAD-STRECKE] Zahlen:", err);
    res.status(500).json({ ok: false, error: "Serverfehler" });
  }
});

// ── DIE STRECKE VON HAND ANSTOSSEN ────────────────────────────────────────
router.post("/admin/leads/strecke/lauf", async (req: Request, res: Response) => {
  try {
    const hoechstens = Math.min(500, Math.max(1, Math.round(Number(req.body?.hoechstens)) || 200));
    const { streckeTageslauf } = await import("../lib/fiaon-lead-strecke");
    const erg = await streckeTageslauf({ hoechstens });
    res.json({ ok: true, ...erg });
  } catch (err) {
    console.error("[LEAD-STRECKE] Handlauf:", err);
    res.status(500).json({ ok: false, error: "Serverfehler" });
  }
});

export default router;
