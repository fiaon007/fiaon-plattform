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
import postgres from "postgres";
import { sendMakeWebhook } from "../make-webhook";
import { fiaonBaseUrl } from "../fiaon-base-url";
import {
  requireAgent,
  getSettings,
  setSetting,
  normalizePhone,
  type AgentRequest,
} from "./fiaon-agent";

const router = Router();       // mount: /api/fiaon  (/admin/leads*, /agent/leads*)
const intakeRouter = Router(); // mount: /api/leads  (/intake)
const sqlPool = postgres(process.env.DATABASE_URL!, { ssl: "require", max: 3 });

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

async function logLead(
  leadId: number,
  actor: { id: number | null; name: string },
  type: string,
  fields: { outcome?: string | null; note?: string | null; scheduledAt?: string | null } = {},
): Promise<any> {
  const rows = await sqlPool`
    INSERT INTO fiaon_lead_log (lead_id, agent_id, agent_name, type, outcome, note, scheduled_at)
    VALUES (${leadId}, ${actor.id}, ${actor.name}, ${type}, ${fields.outcome || null}, ${fields.note || null},
            ${fields.scheduledAt ? new Date(fields.scheduledAt) : null})
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
      RETURNING id
    `;
    for (const r of rows) {
      await logLead(r.id, { id: null, name: "System" }, "system", {
        note: `Automatisch konvertiert — Antrag ${orderRef} angelegt (E-Mail/Telefon-Treffer). Raus aus Nachfass-/Anrufliste.`,
      });
    }
    if (rows.length) console.log(`[FIAON-LEADS] Auto-Konversion: ${rows.length} Lead(s) → ${orderRef}`);
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

/** Erschöpfte/übergrenzte Leads auf `tot` setzen (kein Versand mehr). */
async function markExhaustedLeadsDead(maxFollowups: number, planDays: number[]): Promise<number> {
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

// Stündlicher Nachfass-Lauf (fail-safe) + Lead-Verteilung
setInterval(() => {
  runLeadFollowups().catch((err) => console.error("[FIAON-LEADS] Followup-Cron:", err));
  distributeUnassignedLeads().catch((err) => console.error("[FIAON-LEADS] Verteilung-Cron:", err));
}, 60 * 60 * 1000);

// ═══════════════════════════════════════════════════════════════════
// BA2 — INTAKE-WEBHOOK  (POST /api/leads/intake, Secret-geschützt)
// ═══════════════════════════════════════════════════════════════════
/** CD: Intake-Versuch protokollieren (ohne sensible Daten). Fehler nie werfen. */
async function logIntake(status: string, quelle: string | null, detail: string | null): Promise<void> {
  try {
    await sqlPool`INSERT INTO fiaon_lead_intake_log (status, quelle, detail) VALUES (${status}, ${quelle}, ${detail})`;
  } catch (err) { console.error("[FIAON-LEADS] logIntake:", err); }
}

intakeRouter.post("/intake", async (req: Request, res: Response) => {
  try {
    await ensureLeadTables();
    const secret = process.env.LEAD_INTAKE_SECRET;
    if (!secret) { await logIntake("rejected_auth", null, "LEAD_INTAKE_SECRET nicht konfiguriert"); return res.status(503).json({ ok: false, error: "LEAD_INTAKE_SECRET nicht konfiguriert" }); }
    const provided = String(req.headers["x-lead-secret"] || req.query.secret || "").trim();
    if (provided !== secret) { await logIntake("rejected_auth", null, provided ? "Falsches Secret" : "Kein Secret gesendet"); return res.status(401).json({ ok: false, error: "Ungültiges Intake-Secret" }); }

    const b = req.body || {};
    const email = b.email ? String(b.email).trim().toLowerCase() : null;
    const telefon = b.telefon || b.phone ? normalizePhone(String(b.telefon || b.phone)) : null;
    if ((!email || !EMAIL_RE.test(email)) && (!telefon || telefon === "")) {
      await logIntake("invalid", String(b.quelle || b.source || "").slice(0, 120) || null, "E-Mail/Telefon fehlt");
      return res.status(400).json({ ok: false, error: "E-Mail oder Telefon erforderlich" });
    }
    const vorname = b.vorname || b.firstName || b.first_name || null;
    const nachname = b.nachname || b.lastName || b.last_name || null;
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
      await logIntake("ok", quelle, "Dublette aktualisiert");
      return res.json({ ok: true, id, deduped: true });
    }

    const inserted = await sqlPool`
      INSERT INTO fiaon_leads (vorname, nachname, email, telefon, quelle, kampagne, adset, status)
      VALUES (${vorname}, ${nachname}, ${email}, ${telefon || null}, ${quelle}, ${kampagne}, ${adset}, 'neu')
      RETURNING id
    `;
    const id = inserted[0].id;
    await logLead(id, { id: null, name: "System" }, "system", { note: `Lead eingegangen (Quelle: ${quelle}${kampagne ? `, Kampagne: ${kampagne}` : ""})` });

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
      // Neuen Lead fair verteilen (fire-and-forget)
      distributeUnassignedLeads().catch(() => {});
    }
    await logIntake(quelle === "test" ? "test" : "ok", quelle, "Lead angelegt");
    res.json({ ok: true, id, deduped: false });
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

// Agent-Anrufliste: eigene offene Leads + Hinweis, ob offene Kunden Vorrang haben.
router.get("/agent/leads", requireAgent, async (req: AgentRequest, res) => {
  try {
    await ensureLeadTables();
    const me = req.agent!.id;
    const leads = await sqlPool`
      SELECT id, vorname, nachname, email, telefon, quelle, kampagne, status,
             erstellt_am, letzter_kontakt_am, lead_reminder_count
      FROM fiaon_leads
      WHERE assigned_agent_id = ${me} AND status IN ('neu', 'kontaktiert', 'nicht_erreichbar')
      ORDER BY (status = 'neu') DESC, erstellt_am ASC
    `;
    // Priorisierung (BC1): offene Kunden-Anträge haben Vorrang.
    const [openCust] = await sqlPool`
      SELECT COUNT(*)::int AS c FROM fiaon_applications
      WHERE assigned_agent_id = ${me} AND payment_status IN ('pending_payment', 'claimed_paid') AND merged_into IS NULL
    `;
    res.json({ ok: true, data: leads, openCustomerCount: Number(openCust.c) });
  } catch (err) {
    console.error("[FIAON-LEADS] agent/leads:", err);
    res.status(500).json({ ok: false, error: "Serverfehler" });
  }
});

router.get("/agent/leads/:id", requireAgent, async (req: AgentRequest, res) => {
  try {
    await ensureLeadTables();
    const id = Number(req.params.id);
    const rows = await sqlPool`SELECT * FROM fiaon_leads WHERE id = ${id}`;
    if (rows.length === 0) return res.status(404).json({ ok: false, error: "Lead nicht gefunden" });
    const log = await sqlPool`SELECT id, type, outcome, note, agent_name, scheduled_at, created_at FROM fiaon_lead_log WHERE lead_id = ${id} ORDER BY created_at DESC`;
    const l = rows[0];
    const readOnly = !!(l.assigned_agent_id && l.assigned_agent_id !== req.agent!.id);
    res.json({ ok: true, lead: l, log, readOnly });
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
    const guard = await leadGuard(Number(req.params.id), req.agent!);
    if (guard.error) return res.status(guard.error.code).json({ ok: false, error: guard.error.msg });
    const id = Number(req.params.id);
    const entry = await logLead(id, req.agent!, "result", {
      outcome,
      note: note ? String(note).slice(0, 4000) : null,
      scheduledAt: scheduledAt || null,
    });
    const newStatus = LEAD_OUTCOMES[outcome];
    await sqlPool`UPDATE fiaon_leads SET status = ${newStatus}, letzter_kontakt_am = NOW(), updated_at = NOW() WHERE id = ${id} AND status NOT IN ('konvertiert')`;
    res.json({ ok: true, entry, claimed: guard.claimed || false });
  } catch (err) {
    console.error("[FIAON-LEADS] contact-result:", err);
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

    // Konvertierte Zeilen mit verknüpfter Order (Zahlungsstatus + Betrag) anreichern.
    const rows = await sqlPool`
      SELECT l.id, l.vorname, l.nachname, l.email, l.telefon, l.quelle, l.kampagne, l.status,
             l.assigned_agent_id, ag.name AS agent_name, l.converted_order_id, l.in_sequence,
             l.erstellt_am, l.letzter_kontakt_am, l.konvertiert_am, l.lead_reminder_count,
             a.payment_status, a.amount_due, a.pack_name, a.created_at AS order_created_at
      FROM fiaon_leads l
      LEFT JOIN fiaon_agents ag ON ag.id = l.assigned_agent_id
      LEFT JOIN fiaon_applications a ON a.ref = l.converted_order_id AND a.merged_into IS NULL
      WHERE (${status}::text IS NULL OR l.status = ${status})
        AND (${groupStatuses}::text[] IS NULL OR l.status = ANY(${groupStatuses}))
        AND (${q} = '' OR LOWER(COALESCE(l.vorname,'') || ' ' || COALESCE(l.nachname,'') || ' ' || COALESCE(l.email,'') || ' ' || COALESCE(l.telefon,'')) LIKE ${"%" + q + "%"})
      ORDER BY
        CASE WHEN ${sort} = 'status' THEN l.status END ASC,
        l.erstellt_am DESC
      LIMIT ${limit}
    `;
    const counts = await sqlPool`SELECT status, COUNT(*)::int AS c FROM fiaon_leads GROUP BY status`;
    const byStatus: Record<string, number> = {};
    for (const r of counts) byStatus[r.status] = Number(r.c);

    // BE3-Kennzahlen: X Leads → Y konvertiert → Z zahlend (Umsatz) + offene Leads.
    const [stats] = await sqlPool`
      SELECT
        COUNT(*)::int AS total,
        COUNT(*) FILTER (WHERE l.status = 'konvertiert')::int AS converted,
        COUNT(*) FILTER (WHERE l.status IN ('neu','kontaktiert','nicht_erreichbar'))::int AS open,
        COUNT(*) FILTER (WHERE a.payment_status = 'paid')::int AS paying,
        COALESCE(SUM(CASE WHEN a.payment_status = 'paid' THEN ROUND(COALESCE(a.amount_due::numeric,0)*100) ELSE 0 END),0)::bigint AS revenue_cents
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

router.get("/admin/leads/:id", async (req: Request, res: Response) => {
  try {
    await ensureLeadTables();
    const id = Number(req.params.id);
    const rows = await sqlPool`
      SELECT l.*, ag.name AS agent_name FROM fiaon_leads l
      LEFT JOIN fiaon_agents ag ON ag.id = l.assigned_agent_id WHERE l.id = ${id}
    `;
    if (rows.length === 0) return res.status(404).json({ ok: false, error: "Lead nicht gefunden" });
    const log = await sqlPool`SELECT id, type, outcome, note, agent_name, scheduled_at, created_at FROM fiaon_lead_log WHERE lead_id = ${id} ORDER BY created_at DESC`;
    res.json({ ok: true, lead: rows[0], log });
  } catch (err) {
    console.error("[FIAON-LEADS] admin/leads/:id:", err);
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
  res.json({
    ok: true,
    settings: {
      lead_followup_enabled: s.lead_followup_enabled,
      lead_followup_days: s.lead_followup_days,
      lead_followup_window_start: s.lead_followup_window_start,
      lead_followup_window_end: s.lead_followup_window_end,
      max_lead_followups: s.max_lead_followups,
      lead_distribution_enabled: s.lead_distribution_enabled,
    },
    withinWindow: withinHardWindow(),
    sentToday: Number(today.c),
  });
});

router.post("/admin/leads/settings", async (req: Request, res: Response) => {
  try {
    const allowed = ["lead_followup_enabled", "lead_followup_days", "lead_followup_window_start", "lead_followup_window_end", "max_lead_followups", "lead_distribution_enabled"];
    for (const key of allowed) {
      if (req.body?.[key] !== undefined) await setSetting(key, String(req.body[key]));
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

// Test-Lead: echter serverseitiger Aufruf des eigenen Intake-Endpoints (mit gültigem Secret).
router.post("/admin/leads/test-intake", async (_req: Request, res: Response) => {
  try {
    await ensureLeadTables();
    const secret = process.env.LEAD_INTAKE_SECRET;
    if (!secret) return res.status(503).json({ ok: false, error: "LEAD_INTAKE_SECRET nicht konfiguriert — Test nicht möglich" });
    const stamp = Date.now();
    const payload = { email: `test+${stamp}@fiaon-intake-test.de`, vorname: "Test", nachname: "Intake", quelle: "test", kampagne: "intake_test" };
    const r = await fetch(`${fiaonBaseUrl()}/api/leads/intake`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-lead-secret": secret },
      body: JSON.stringify(payload),
    });
    const json = await r.json().catch(() => null);
    res.json({ ok: r.ok && json?.ok, httpStatus: r.status, response: json });
  } catch (err: any) {
    console.error("[FIAON-LEADS] test-intake:", err);
    res.status(502).json({ ok: false, error: `Selbstaufruf fehlgeschlagen: ${err?.message || err}` });
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

// ── BB2 — Bulk „Follow-up an alle offenen Leads" (20/min, 8h-Dedupe) ─────────
const LEAD_BULK_BATCH = 20;
interface LeadBulkState { running: boolean; startedAt: string; finishedAt: string | null; planned: number; sent: number; errors: number; }
let leadBulkJob: LeadBulkState | null = null;

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

router.post("/admin/leads/followup-bulk/start", async (_req: Request, res: Response) => {
  try {
    await ensureLeadTables();
    if (leadBulkJob?.running) return res.status(409).json({ ok: false, error: "Es läuft bereits ein Bulk-Versand" });
    if (!withinHardWindow()) return res.status(400).json({ ok: false, error: "Versand nur zwischen 08:00 und 20:00 Uhr (Europa/Berlin) möglich" });
    const s = await getSettings();
    const max = Math.max(0, Math.round(Number(s.max_lead_followups)) || 5);
    const { eligible } = await leadBulkPreview();
    leadBulkJob = { running: true, startedAt: new Date().toISOString(), finishedAt: null, planned: eligible, sent: 0, errors: 0 };
    res.json({ ok: true, planned: eligible });

    (async () => {
      const job = leadBulkJob!;
      try {
        for (;;) {
          if (!withinHardWindow()) break;
          const batch = await claimLeadFollowupBatch(LEAD_BULK_BATCH, { maxFollowups: max, planDays: null });
          if (batch.length === 0) break;
          for (const l of batch) {
            const ok = await sendMakeWebhook("lead_followup", followupPayload(l));
            await logLead(l.id, { id: null, name: "Admin" }, "followup", { note: `Bulk-Nachfass #${l.lead_reminder_count} gesendet (Make: lead_followup)` });
            if (ok) job.sent++; else job.errors++;
          }
          if (batch.length < LEAD_BULK_BATCH) break;
          await new Promise((r) => setTimeout(r, 60_000));
        }
      } catch (err) {
        console.error("[FIAON-LEADS] Bulk-Job-Fehler:", err);
      } finally {
        job.running = false;
        job.finishedAt = new Date().toISOString();
        console.log(`[FIAON-LEADS] Bulk abgeschlossen: ${job.sent}/${job.planned} versendet, ${job.errors} Fehler`);
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
export default router;
