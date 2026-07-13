// ═══════════════════════════════════════════════════════════════════
// FIAON Mitarbeiter-Portal (Rolle "Agent") — Vollausbau
// - Onboarding: Einladung (agent_invite), Passwort-Setup/-Reset (signierte Tokens)
// - Session-Epoch: Admin-Force-Reset invalidiert alle laufenden Sessions
// - Profil: Telefon, Avatar (client-seitig zugeschnitten), Bankdaten AES-256-GCM
//   verschlüsselt + maskiert + auditiert (Betrugsschutz-Banner beim Admin)
// - Attribution: Auto-Claim bei erster Aktion, 15-Min-Soft-Lock gegen Doppelanruf
// - Provisions-Engine: Satz wird am Eintrag EINGEFROREN, Beträge in Integer-Cents,
//   kaufmännische Rundung. Lebenszyklus bestaetigt → in_auszahlung → ausgezahlt;
//   Storno inkl. negativem Verrechnungs-Eintrag nach Auszahlung.
// - Auszahlungen: Antrag = NUR Anforderung, niemals Transaktion.
// - Skripte (Leitfäden) + Status→Kategorie-Mapping, Kalender + agent_callback_reminder.
// - Alle Admin-Endpoints in server/routes/fiaon-team.ts (Agent-403 via blockAgentsFromAdmin).
// ═══════════════════════════════════════════════════════════════════

import { Router, type Request, type Response, type NextFunction } from "express";
import postgres from "postgres";
import bcrypt from "bcryptjs";
import { createHmac, createHash, randomBytes, createCipheriv, createDecipheriv } from "crypto";
import PDFDocument from "pdfkit";
import { sendMakeWebhook, makePayloadFromRow } from "../make-webhook";
import { renderInvoicePdf, signInvoiceUrl, ensureInvoiceNumber } from "../fiaon-invoice";
import { fiaonBaseUrl } from "../fiaon-base-url";

const router = Router();
const sqlPool = postgres(process.env.DATABASE_URL!, { ssl: "require", max: 5 });

const AGENT_COOKIE = "fiaon_agent_token";
const TOKEN_TTL_MS = 12 * 60 * 60 * 1000; // 12h Schicht
const EMAIL_LOCK_MS = 10 * 60 * 1000; // 10-Minuten-Sperre pro Kunde
const SOFT_LOCK_MIN = 15; // „in Bearbeitung durch …" beim Öffnen eines unzugewiesenen Kunden
const INVITE_TTL_MS = 48 * 60 * 60 * 1000; // Einladung 48h
const RESET_TTL_MS = 60 * 60 * 1000; // Passwort-Reset 1h

function agentSecret(): string {
  return process.env.SESSION_SECRET || "fiaon-dev-agent-secret";
}

// Re-Export für Bestandsimporte (fiaon-team.ts) — einzige Quelle: fiaon-base-url.ts
export function baseUrl(): string {
  return fiaonBaseUrl();
}

// ── Geld: IMMER Integer-Cents, kaufmännische Rundung ─────────────────────────
// Math.round rundet für positive Werte halb auf (0,5 → 1) = kaufmännisch.
// Beispiel Testplan 6: 99,99 € × 15 % = 9999 × 1500 / 10000 = 1499,85 Cents → 1500 = 15,00 €.
export function eurToCents(v: string | number | null | undefined): number {
  const n = Number(v);
  if (!v || isNaN(n)) return 0;
  return Math.round(n * 100);
}

export function commissionCents(baseCents: number, rateBp: number): number {
  return Math.round((baseCents * rateBp) / 10000);
}

// ── Bankdaten-Verschlüsselung (AES-256-GCM, Server-Key aus SESSION_SECRET) ──
function bankKey(): Buffer {
  return createHash("sha256").update(`${agentSecret()}:fiaon-bank-v1`).digest();
}

export function encryptSecret(plain: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", bankKey(), iv);
  const data = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  return `v1:${iv.toString("base64")}:${cipher.getAuthTag().toString("base64")}:${data.toString("base64")}`;
}

export function decryptSecret(enc: string | null): string | null {
  if (!enc) return null;
  try {
    const [v, ivB64, tagB64, dataB64] = enc.split(":");
    if (v !== "v1") return null;
    const decipher = createDecipheriv("aes-256-gcm", bankKey(), Buffer.from(ivB64, "base64"));
    decipher.setAuthTag(Buffer.from(tagB64, "base64"));
    return Buffer.concat([decipher.update(Buffer.from(dataB64, "base64")), decipher.final()]).toString("utf8");
  } catch {
    return null;
  }
}

export function maskIban(iban: string): string {
  const clean = iban.replace(/\s+/g, "").toUpperCase();
  if (clean.length < 8) return "••••";
  return `${clean.slice(0, 4)} •••• •••• ${clean.slice(-4)}`;
}

// IBAN-Prüfsummen-Check (MOD-97-10, ISO 13616)
export function ibanChecksumValid(input: string): boolean {
  const iban = input.replace(/\s+/g, "").toUpperCase();
  if (!/^[A-Z]{2}[0-9]{2}[A-Z0-9]{11,30}$/.test(iban)) return false;
  const rearranged = iban.slice(4) + iban.slice(0, 4);
  let remainder = 0;
  for (const ch of rearranged) {
    const val = ch >= "A" ? String(ch.charCodeAt(0) - 55) : ch;
    for (const d of val) remainder = (remainder * 10 + Number(d)) % 97;
  }
  return remainder === 1;
}

// ── Passwort-Policy (F2): min. 10 Zeichen, Zahl, Groß- und Kleinbuchstabe ───
export function passwordPolicyError(pw: string): string | null {
  if (typeof pw !== "string" || pw.length < 10) return "Passwort: mindestens 10 Zeichen";
  if (!/[0-9]/.test(pw)) return "Passwort: mindestens eine Zahl";
  if (!/[a-z]/.test(pw)) return "Passwort: mindestens ein Kleinbuchstabe";
  if (!/[A-Z]/.test(pw)) return "Passwort: mindestens ein Großbuchstabe";
  return null;
}

export function hashToken(t: string): string {
  return createHash("sha256").update(t).digest("hex");
}

// ── Tabellen & Migrationen (idempotent) ──────────────────────────────────────
let tablesEnsured = false;
export async function ensureAgentTables(): Promise<void> {
  if (tablesEnsured) return;
  await sqlPool`
    CREATE TABLE IF NOT EXISTS fiaon_agents (
      id SERIAL PRIMARY KEY,
      name VARCHAR NOT NULL,
      email VARCHAR NOT NULL UNIQUE,
      password_hash VARCHAR,
      active BOOLEAN NOT NULL DEFAULT TRUE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;
  // F/G/H: Konto-, Provisions- und Onboarding-Felder
  await sqlPool`ALTER TABLE fiaon_agents ALTER COLUMN password_hash DROP NOT NULL`;
  await sqlPool.unsafe(`
    ALTER TABLE fiaon_agents
      ADD COLUMN IF NOT EXISTS first_name VARCHAR,
      ADD COLUMN IF NOT EXISTS last_name VARCHAR,
      ADD COLUMN IF NOT EXISTS phone VARCHAR,
      ADD COLUMN IF NOT EXISTS avatar TEXT,
      ADD COLUMN IF NOT EXISTS commission_rate_bp INTEGER,
      ADD COLUMN IF NOT EXISTS monthly_goal_cents INTEGER,
      ADD COLUMN IF NOT EXISTS bank_holder_enc TEXT,
      ADD COLUMN IF NOT EXISTS bank_iban_enc TEXT,
      ADD COLUMN IF NOT EXISTS bank_bic_enc TEXT,
      ADD COLUMN IF NOT EXISTS bank_iban_masked VARCHAR,
      ADD COLUMN IF NOT EXISTS bank_updated_at TIMESTAMPTZ,
      ADD COLUMN IF NOT EXISTS bank_change_ack BOOLEAN NOT NULL DEFAULT TRUE,
      ADD COLUMN IF NOT EXISTS invite_token_hash VARCHAR,
      ADD COLUMN IF NOT EXISTS invite_expires_at TIMESTAMPTZ,
      ADD COLUMN IF NOT EXISTS reset_token_hash VARCHAR,
      ADD COLUMN IF NOT EXISTS reset_expires_at TIMESTAMPTZ,
      ADD COLUMN IF NOT EXISTS session_epoch INTEGER NOT NULL DEFAULT 0,
      ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMPTZ,
      ADD COLUMN IF NOT EXISTS recruited_by INTEGER,
      ADD COLUMN IF NOT EXISTS override_rate_bp INTEGER,
      ADD COLUMN IF NOT EXISTS distribution_active BOOLEAN NOT NULL DEFAULT TRUE
  `);
  await sqlPool`
    CREATE TABLE IF NOT EXISTS fiaon_contact_log (
      id SERIAL PRIMARY KEY,
      ref VARCHAR NOT NULL,
      agent_id INTEGER,
      agent_name VARCHAR NOT NULL,
      type VARCHAR NOT NULL,            -- note | result | email_sent | claim | system
      outcome VARCHAR,
      note TEXT,
      scheduled_at TIMESTAMPTZ,
      promised_date TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;
  await sqlPool.unsafe(`
    ALTER TABLE fiaon_contact_log
      ADD COLUMN IF NOT EXISTS done_at TIMESTAMPTZ,
      ADD COLUMN IF NOT EXISTS reminder_sent_at TIMESTAMPTZ
  `);
  await sqlPool`CREATE INDEX IF NOT EXISTS fiaon_contact_log_ref_idx ON fiaon_contact_log(ref)`;
  await sqlPool`CREATE INDEX IF NOT EXISTS fiaon_contact_log_agent_idx ON fiaon_contact_log(agent_id, created_at)`;
  // G2: Attribution + Soft-Lock am Kunden
  await sqlPool.unsafe(`
    ALTER TABLE fiaon_applications
      ADD COLUMN IF NOT EXISTS assigned_agent_id INTEGER,
      ADD COLUMN IF NOT EXISTS locked_by_agent_id INTEGER,
      ADD COLUMN IF NOT EXISTS locked_until TIMESTAMPTZ,
      ADD COLUMN IF NOT EXISTS refunded_at TIMESTAMPTZ
  `);
  await sqlPool`CREATE INDEX IF NOT EXISTS fiaon_applications_assigned_idx ON fiaon_applications(assigned_agent_id)`;
  // G3: Provisionseinträge — Satz + Basis werden EINGEFROREN (Integer-Cents/Basispunkte)
  await sqlPool`
    CREATE TABLE IF NOT EXISTS fiaon_commissions (
      id SERIAL PRIMARY KEY,
      agent_id INTEGER NOT NULL,
      ref VARCHAR NOT NULL,
      payment_reference VARCHAR,
      pack_name VARCHAR,
      base_amount_cents INTEGER NOT NULL,
      rate_bp INTEGER NOT NULL,
      amount_cents INTEGER NOT NULL,     -- kann negativ sein (Storno-Verrechnung)
      status VARCHAR NOT NULL DEFAULT 'bestaetigt',  -- bestaetigt | in_auszahlung | ausgezahlt | storniert
      payout_id INTEGER,
      note TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;
  await sqlPool`CREATE INDEX IF NOT EXISTS fiaon_commissions_agent_idx ON fiaon_commissions(agent_id, status)`;
  await sqlPool`CREATE INDEX IF NOT EXISTS fiaon_commissions_ref_idx ON fiaon_commissions(ref)`;
  // Paket AE2: Provisionstyp 'own' | 'override' (Team-Umsatzbeteiligung, EXAKT eine Ebene)
  await sqlPool.unsafe(`
    ALTER TABLE fiaon_commissions
      ADD COLUMN IF NOT EXISTS kind VARCHAR NOT NULL DEFAULT 'own',
      ADD COLUMN IF NOT EXISTS source_agent_id INTEGER
  `);
  // Paket AE3: Partner-Programm — erreichte Meilensteine + Prämien-Aufgaben für den Admin
  await sqlPool`
    CREATE TABLE IF NOT EXISTS fiaon_partner_milestones (
      id SERIAL PRIMARY KEY,
      agent_id INTEGER NOT NULL,
      milestone_key VARCHAR NOT NULL,      -- senior | executive | managing
      achieved_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      prize_status VARCHAR NOT NULL DEFAULT 'offen',  -- offen | erledigt
      prize_done_at TIMESTAMPTZ,
      UNIQUE (agent_id, milestone_key)
    )
  `;
  // Paket AE4: „Partner vorschlagen“ — kontrollierter Rekrutierungs-Flow (KEIN Auto-Anlegen)
  await sqlPool`
    CREATE TABLE IF NOT EXISTS fiaon_partner_suggestions (
      id SERIAL PRIMARY KEY,
      agent_id INTEGER NOT NULL,           -- vorschlagender Agent
      first_name VARCHAR NOT NULL,
      last_name VARCHAR NOT NULL,
      email VARCHAR NOT NULL,
      phone VARCHAR,
      reason TEXT,
      status VARCHAR NOT NULL DEFAULT 'offen',  -- offen | angenommen | abgelehnt
      decision_reason TEXT,
      created_agent_id INTEGER,            -- bei Annahme: der angelegte Agent
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      decided_at TIMESTAMPTZ
    )
  `;
  // H: Auszahlungs-Anforderungen (Bankdaten-Snapshot verschlüsselt)
  await sqlPool`
    CREATE TABLE IF NOT EXISTS fiaon_payouts (
      id SERIAL PRIMARY KEY,
      agent_id INTEGER NOT NULL,
      amount_cents INTEGER NOT NULL,
      status VARCHAR NOT NULL DEFAULT 'angefordert', -- angefordert | ausgezahlt | abgelehnt
      bank_holder_enc TEXT,
      bank_iban_enc TEXT,
      bank_bic_enc TEXT,
      iban_masked VARCHAR,
      reject_reason TEXT,
      requested_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      processed_at TIMESTAMPTZ
    )
  `;
  // I: Gesprächsvorlagen/Skripte (Soft-Delete)
  await sqlPool`
    CREATE TABLE IF NOT EXISTS fiaon_scripts (
      id SERIAL PRIMARY KEY,
      title VARCHAR NOT NULL,
      category VARCHAR NOT NULL,
      content_html TEXT,
      file_data TEXT,
      file_name VARCHAR,
      file_mime VARCHAR,
      sort_order INTEGER NOT NULL DEFAULT 0,
      active BOOLEAN NOT NULL DEFAULT TRUE,
      deleted_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;
  // Einstellungen (Key-Value) + Agent-Ereignisse (Audit ohne Kundenbezug)
  await sqlPool`
    CREATE TABLE IF NOT EXISTS fiaon_settings (
      key VARCHAR PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;
  await sqlPool`
    CREATE TABLE IF NOT EXISTS fiaon_agent_events (
      id SERIAL PRIMARY KEY,
      agent_id INTEGER NOT NULL,
      type VARCHAR NOT NULL,   -- invited | invite_resent | password_set | password_reset_requested | password_changed | force_reset | bank_changed | phone_changed | avatar_changed | payout_requested | payout_paid | payout_rejected | commission_created | commission_cancelled | login
      meta TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;
  await sqlPool`CREATE INDEX IF NOT EXISTS fiaon_agent_events_agent_idx ON fiaon_agent_events(agent_id, created_at)`;
  tablesEnsured = true;
  console.log("[FIAON-AGENT] Agent-/Provisions-Tabellen sichergestellt");
}

// ── Einstellungen mit Defaults ───────────────────────────────────────────────
const SETTING_DEFAULTS: Record<string, string> = {
  default_commission_rate_bp: "1500", // 15,00 %
  payout_min_cents: "5000",           // 50,00 €
  script_status_map: "{}",            // z. B. {"pending_payment":"Eröffnung","claimed_paid":"Abschluss"}
  // Paket V: tägliche Reminder-Engine (payment_reminder)
  max_reminders: "6",                 // Obergrenze automatischer Erinnerungen pro Bestellung
  reminder_window_start: "10",        // Versandfenster-Beginn (Stunde, Europe/Berlin)
  reminder_window_end: "11",          // Versandfenster-Ende (exklusiv)
  reminder_engine_enabled: "1",       // Not-Aus-Schalter ("1" = an)
  // Paket AE1: automatische Kundenverteilung (Round-Robin auf aktive Agents)
  distribution_enabled: "1",          // Verteilung an/aus
  distribution_cap: "50",             // Obergrenze offener zugewiesener Kunden pro Agent
  distribution_last_agent_id: "0",    // Rotations-Zeiger (intern)
  // Paket AE2: Standard-Override-Satz für Werber (pro Beziehung überschreibbar)
  partner_override_bp: "500",         // 5,00 %
  // Paket AE3: Partner-Programm — Meilenstein-Schwellen (kumulierter bestätigter
  // EIGENumsatz in Cents) + Provisions-Zuschlag in Basispunkten. Admin-editierbar.
  partner_thresholds: JSON.stringify([
    { key: "senior", label: "Senior Partner", minCents: 2_500_000, bonusBp: 200 },
    { key: "executive", label: "Executive Partner", minCents: 7_500_000, bonusBp: 400 },
    { key: "managing", label: "Managing Partner", minCents: 20_000_000, bonusBp: 600 },
  ]),
  // Sachprämien je Meilenstein (Titel/Beschreibung; KEINE automatische Geldbuchung)
  partner_prizes: JSON.stringify({
    senior: { title: "Business-Dinner mit der Geschäftsführung", description: "Persönliche Einladung nach Erreichen des Meilensteins." },
    executive: { title: "MacBook Pro oder iPhone Pro Max", description: "Gerät nach Wahl — Auslieferung über das Admin-Team." },
    managing: { title: "Reise-Voucher 3.000 € + Einladung zum Führungskreis-Event", description: "Voucher und Event-Einladung werden persönlich übergeben." },
  }),
};

export async function getSettings(): Promise<Record<string, string>> {
  await ensureAgentTables();
  const rows = await sqlPool`SELECT key, value FROM fiaon_settings`;
  const out = { ...SETTING_DEFAULTS };
  for (const r of rows) out[r.key] = r.value;
  return out;
}

export async function setSetting(key: string, value: string): Promise<void> {
  await sqlPool`
    INSERT INTO fiaon_settings (key, value, updated_at) VALUES (${key}, ${value}, NOW())
    ON CONFLICT (key) DO UPDATE SET value = ${value}, updated_at = NOW()
  `;
}

export function agentRateBp(agentRow: { commission_rate_bp: number | null }, settings: Record<string, string>): number {
  return agentRow.commission_rate_bp ?? Number(settings.default_commission_rate_bp) ?? 1500;
}

// ── Token mit Session-Epoch (Force-Reset invalidiert laufende Sessions) ─────
function signAgentToken(agentId: number, epoch: number): string {
  const exp = Date.now() + TOKEN_TTL_MS;
  const payload = `${agentId}.${epoch}.${exp}`;
  const sig = createHmac("sha256", agentSecret()).update(`agent2:${payload}`).digest("hex").slice(0, 40);
  return `${payload}.${sig}`;
}

function verifyAgentToken(token: string | undefined): { id: number; epoch: number } | null {
  if (!token) return null;
  const parts = token.split(".");
  if (parts.length !== 4) return null;
  const [idStr, epochStr, expStr, sig] = parts;
  const exp = Number(expStr);
  if (!exp || exp < Date.now()) return null;
  const expected = createHmac("sha256", agentSecret()).update(`agent2:${idStr}.${epochStr}.${expStr}`).digest("hex").slice(0, 40);
  if (expected !== sig) return null;
  const id = Number(idStr);
  const epoch = Number(epochStr);
  return Number.isInteger(id) && id > 0 && Number.isInteger(epoch) ? { id, epoch } : null;
}

export function issueAgentCookie(res: Response, agentId: number, epoch: number): void {
  res.cookie(AGENT_COOKIE, signAgentToken(agentId, epoch), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: TOKEN_TTL_MS,
    path: "/",
  });
}

// ── Middleware ───────────────────────────────────────────────────────────────
export interface AgentRequest extends Request {
  agent?: { id: number; name: string; email: string; first_name: string | null };
}

async function requireAgent(req: AgentRequest, res: Response, next: NextFunction) {
  try {
    await ensureAgentTables();
    const tok = verifyAgentToken(req.cookies?.[AGENT_COOKIE]);
    if (!tok) return res.status(401).json({ ok: false, error: "Nicht angemeldet" });
    const rows = await sqlPool`SELECT id, name, email, first_name, active, session_epoch FROM fiaon_agents WHERE id = ${tok.id}`;
    if (rows.length === 0 || !rows[0].active) {
      return res.status(401).json({ ok: false, error: "Zugang deaktiviert" });
    }
    // Session-Epoch-Vergleich: nach Force-Reset sind alte Tokens ungültig
    if (Number(rows[0].session_epoch) !== tok.epoch) {
      return res.status(401).json({ ok: false, error: "Sitzung abgelaufen — bitte neu anmelden" });
    }
    req.agent = { id: rows[0].id, name: rows[0].name, email: rows[0].email, first_name: rows[0].first_name };
    next();
  } catch (err) {
    console.error("[FIAON-AGENT] auth:", err);
    res.status(500).json({ ok: false, error: "Serverfehler" });
  }
}

/**
 * Rollentrennung serverseitig: Requests MIT gültigem Agent-Token auf
 * Admin-Routen werden mit 403 abgelehnt (nicht nur im UI versteckt).
 * In server/routes.ts VOR den fiaon-Routern auf /api/fiaon eingehängt.
 */
export function blockAgentsFromAdmin(req: Request, res: Response, next: NextFunction) {
  if (req.path.startsWith("/admin") && verifyAgentToken((req as any).cookies?.[AGENT_COOKIE])) {
    return res.status(403).json({ ok: false, error: "Kein Zugriff: Agent-Rolle hat keine Admin-Berechtigung" });
  }
  next();
}

async function logAction(ref: string, agent: { id: number; name: string }, type: string, fields: {
  outcome?: string | null; note?: string | null; scheduledAt?: string | null; promisedDate?: string | null;
} = {}): Promise<any> {
  const rows = await sqlPool`
    INSERT INTO fiaon_contact_log (ref, agent_id, agent_name, type, outcome, note, scheduled_at, promised_date)
    VALUES (${ref}, ${agent.id}, ${agent.name}, ${type}, ${fields.outcome || null}, ${fields.note || null},
            ${fields.scheduledAt ? new Date(fields.scheduledAt) : null}, ${fields.promisedDate ? new Date(fields.promisedDate) : null})
    RETURNING *
  `;
  return rows[0];
}

export async function logAgentEvent(agentId: number, type: string, meta?: Record<string, unknown>): Promise<void> {
  await sqlPool`
    INSERT INTO fiaon_agent_events (agent_id, type, meta)
    VALUES (${agentId}, ${type}, ${meta ? JSON.stringify(meta) : null})
  `;
}

// ═══════════════ PROVISIONS-ENGINE (G3) — nur serverseitig ═══════════════

// ── Paket AE3: Partner-Programm (Meilensteine, KEINE „Level“) ────────────────
export type PartnerThreshold = { key: string; label: string; minCents: number; bonusBp: number };

export function partnerThresholds(settings: Record<string, string>): PartnerThreshold[] {
  try {
    const arr = JSON.parse(settings.partner_thresholds || "[]");
    if (Array.isArray(arr) && arr.length > 0) {
      return arr
        .filter((t: any) => t && t.key && Number(t.minCents) > 0)
        .map((t: any) => ({ key: String(t.key), label: String(t.label || t.key), minCents: Number(t.minCents), bonusBp: Number(t.bonusBp) || 0 }))
        .sort((a: PartnerThreshold, b: PartnerThreshold) => a.minCents - b.minCents);
    }
  } catch { /* Fallback unten */ }
  return JSON.parse(SETTING_DEFAULTS.partner_thresholds);
}

/**
 * Kumulierter bestätigter EIGENumsatz (Kundenumsatz der eigenen Abschlüsse).
 * Overrides (kind='override') zählen NICHT für den Partnerstatus — Status
 * entsteht ausschließlich aus Eigenleistung. Clawbacks (negative Einträge)
 * mindern den Umsatz wieder.
 */
export async function ownRevenueCents(agentId: number): Promise<number> {
  const rows = await sqlPool`
    SELECT COALESCE(SUM(CASE WHEN amount_cents > 0 THEN base_amount_cents ELSE -base_amount_cents END), 0) AS s
    FROM fiaon_commissions
    WHERE agent_id = ${agentId} AND kind = 'own' AND status != 'storniert'
  `;
  return Math.max(0, Number(rows[0].s));
}

/** Aktueller Partnerstatus aus Eigenumsatz: höchster erreichter Meilenstein (oder Basis „Partner“). */
export function partnerStatusFor(revenueCents: number, thresholds: PartnerThreshold[]): { key: string; label: string; bonusBp: number } {
  let current = { key: "partner", label: "Partner", bonusBp: 0 };
  for (const t of thresholds) {
    if (revenueCents >= t.minCents) current = { key: t.key, label: t.label, bonusBp: t.bonusBp };
  }
  return current;
}

/**
 * Hook aus mark-paid (fiaon-antrag.ts): legt beim Übergang zu `paid` den festen
 * Provisionseintrag an — Satz des Agents wird JETZT eingefroren. Idempotent.
 *
 * Paket AE3: Der Provisionssatz enthält den Meilenstein-Zuschlag des Partner-
 * Programms (auf Basis des Eigenumsatzes VOR diesem Abschluss) — Einfrier-
 * Prinzip bleibt: spätere Statuswechsel ändern bestehende Einträge NIE.
 *
 * Paket AE2 — HARTE REGEL: Team-Umsatzbeteiligung (Override) gibt es für EXAKT
 * EINE Ebene: den direkten Werber (recruited_by) des abschließenden Agents.
 * KEINE Ketten, KEINE Mehrfach-Ebenen, KEINE Rekursion — wirbt der Geworbene
 * später selbst jemanden, erhält NUR er dessen Override, nicht der ursprüngliche
 * Werber. Rechtlicher Grund: klare Abgrenzung zu unzulässigen mehrstufigen
 * Vertriebssystemen. Diese Regel ist bewusst und darf nicht aufgeweicht werden.
 */
export async function onCustomerPaid(ref: string): Promise<void> {
  await ensureAgentTables();
  const apps = await sqlPool`
    SELECT ref, payment_reference, pack_name, amount_due, assigned_agent_id
    FROM fiaon_applications WHERE ref = ${ref} AND assigned_agent_id IS NOT NULL
  `;
  if (apps.length === 0) return; // kein zugewiesener Agent → keine Provision
  const app = apps[0];
  // Idempotenz: pro Kunde maximal EIN positiver, nicht-stornierter Eintrag (own + override zusammen)
  const existing = await sqlPool`
    SELECT id FROM fiaon_commissions WHERE ref = ${ref} AND amount_cents > 0 AND status != 'storniert'
  `;
  if (existing.length > 0) return;
  const agents = await sqlPool`SELECT id, name, commission_rate_bp, recruited_by, override_rate_bp FROM fiaon_agents WHERE id = ${app.assigned_agent_id}`;
  if (agents.length === 0) return;
  const settings = await getSettings();
  const thresholds = partnerThresholds(settings);
  // Meilenstein-Zuschlag auf Basis des Eigenumsatzes VOR diesem Abschluss
  const revenueBefore = await ownRevenueCents(app.assigned_agent_id);
  const statusBefore = partnerStatusFor(revenueBefore, thresholds);
  const rateBp = agentRateBp(agents[0] as any, settings) + statusBefore.bonusBp;
  const baseCents = eurToCents(app.amount_due);
  const amountCents = commissionCents(baseCents, rateBp);
  if (amountCents <= 0) return;
  await sqlPool`
    INSERT INTO fiaon_commissions (agent_id, ref, payment_reference, pack_name, base_amount_cents, rate_bp, amount_cents, status, kind,
                                   note)
    VALUES (${app.assigned_agent_id}, ${ref}, ${app.payment_reference}, ${app.pack_name}, ${baseCents}, ${rateBp}, ${amountCents}, 'bestaetigt', 'own',
            ${statusBefore.bonusBp > 0 ? `inkl. ${statusBefore.bonusBp / 100} Prozentpunkte ${statusBefore.label}-Zuschlag` : null})
  `;
  await logAgentEvent(app.assigned_agent_id, "commission_created", { ref, amount_cents: amountCents, rate_bp: rateBp });
  console.log(`[FIAON-COMMISSION] bestätigt: ${ref} → Agent ${app.assigned_agent_id}, ${(amountCents / 100).toFixed(2)} € (${rateBp / 100} %)`);

  // ── Paket AE2: Override für den direkten Werber — EXAKT EINE EBENE (s. o.) ──
  if (agents[0].recruited_by) {
    const recruiter = await sqlPool`SELECT id, name FROM fiaon_agents WHERE id = ${agents[0].recruited_by}`;
    if (recruiter.length > 0) {
      // Override-Satz: pro Beziehung am GEWORBENEN Agent hinterlegt (override_rate_bp),
      // sonst globaler Default. Basis ist der KUNDENumsatz, nicht die Provision.
      const overrideBp = agents[0].override_rate_bp ?? Number(settings.partner_override_bp) ?? 500;
      const overrideCents = commissionCents(baseCents, overrideBp);
      if (overrideCents > 0) {
        await sqlPool`
          INSERT INTO fiaon_commissions (agent_id, ref, payment_reference, pack_name, base_amount_cents, rate_bp, amount_cents, status, kind, source_agent_id, note)
          VALUES (${recruiter[0].id}, ${ref}, ${app.payment_reference}, ${app.pack_name}, ${baseCents}, ${overrideBp}, ${overrideCents}, 'bestaetigt', 'override', ${app.assigned_agent_id},
                  ${`Team-Umsatzbeteiligung: Abschluss von ${agents[0].name}`})
        `;
        await logAgentEvent(recruiter[0].id, "override_created", { ref, amount_cents: overrideCents, rate_bp: overrideBp, source_agent_id: app.assigned_agent_id });
        console.log(`[FIAON-OVERRIDE] ${ref}: Werber ${recruiter[0].id} erhält ${(overrideCents / 100).toFixed(2)} € (${overrideBp / 100} % vom Kundenumsatz, eine Ebene)`);
      }
    }
  }

  // ── Paket AE3: Meilenstein-Erreichung prüfen (nach diesem Abschluss) ──
  try {
    const revenueAfter = await ownRevenueCents(app.assigned_agent_id);
    for (const t of thresholds) {
      if (revenueBefore < t.minCents && revenueAfter >= t.minCents) {
        const inserted = await sqlPool`
          INSERT INTO fiaon_partner_milestones (agent_id, milestone_key)
          VALUES (${app.assigned_agent_id}, ${t.key})
          ON CONFLICT (agent_id, milestone_key) DO NOTHING
          RETURNING id
        `;
        if (inserted.length > 0) {
          await logAgentEvent(app.assigned_agent_id, "milestone_reached", { milestone: t.key, revenue_cents: revenueAfter });
          console.log(`[FIAON-PARTNER] Meilenstein erreicht: Agent ${app.assigned_agent_id} → ${t.label} (${(revenueAfter / 100).toFixed(2)} € Eigenumsatz)`);
        }
      }
    }
  } catch (err) {
    console.error("[FIAON-PARTNER] Meilenstein-Check:", err);
  }
}

/**
 * Storno/Erstattung (G3.5): Provision stornieren; war sie bereits ausgezahlt,
 * entsteht ein NEGATIVER Verrechnungs-Eintrag (mindert künftiges Guthaben).
 */
export async function onCustomerRefunded(ref: string): Promise<{ cancelled: number; clawback: number }> {
  await ensureAgentTables();
  const result = { cancelled: 0, clawback: 0 };
  const rows = await sqlPool`
    SELECT * FROM fiaon_commissions WHERE ref = ${ref} AND amount_cents > 0 AND status != 'storniert'
  `;
  for (const c of rows) {
    if (c.status === "ausgezahlt") {
      // bereits ausgezahlt → negativer Saldo-Eintrag, Original bleibt (Buchhaltungs-Spur)
      // Paket AE2: Verrechnungs-Eintrag erbt kind/source — Override-Clawback trifft den Werber
      await sqlPool`
        INSERT INTO fiaon_commissions (agent_id, ref, payment_reference, pack_name, base_amount_cents, rate_bp, amount_cents, status, kind, source_agent_id, note)
        VALUES (${c.agent_id}, ${ref}, ${c.payment_reference}, ${c.pack_name}, ${c.base_amount_cents}, ${c.rate_bp}, ${-c.amount_cents}, 'bestaetigt', ${c.kind || "own"}, ${c.source_agent_id || null},
                ${`Storno nach Auszahlung — Verrechnung mit künftigen Provisionen (Ursprung #${c.id})`})
      `;
      result.clawback++;
    } else {
      const wasPayout = c.payout_id;
      await sqlPool`UPDATE fiaon_commissions SET status = 'storniert', payout_id = NULL, updated_at = NOW(), note = COALESCE(note, 'Zahlung erstattet/storniert') WHERE id = ${c.id}`;
      result.cancelled++;
      // hing an offener Auszahlung → Betrag neu berechnen, ggf. Anforderung schließen
      if (wasPayout) {
        const sum = await sqlPool`SELECT COALESCE(SUM(amount_cents),0) AS s FROM fiaon_commissions WHERE payout_id = ${wasPayout} AND status = 'in_auszahlung'`;
        const newAmount = Number(sum[0].s);
        if (newAmount <= 0) {
          await sqlPool`UPDATE fiaon_payouts SET status = 'abgelehnt', reject_reason = 'Alle Positionen storniert (Erstattung)', processed_at = NOW() WHERE id = ${wasPayout} AND status = 'angefordert'`;
        } else {
          await sqlPool`UPDATE fiaon_payouts SET amount_cents = ${newAmount} WHERE id = ${wasPayout} AND status = 'angefordert'`;
        }
      }
    }
    await logAgentEvent(c.agent_id, "commission_cancelled", { ref, amount_cents: c.amount_cents, was_status: c.status });
  }
  return result;
}

// ═══════════════ PAKET AC — Stammdaten-Korrektur (Agent + Admin) ═══════════════

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/** Telefon-Normalisierung: 0049/0-Präfixe → +49…, nur Ziffern; leere Eingabe erlaubt. */
export function normalizePhone(raw: string): string | null {
  let p = String(raw || "").replace(/[\s\-()./]/g, "");
  if (!p) return "";
  if (p.startsWith("00")) p = "+" + p.slice(2);
  if (p.startsWith("0")) p = "+49" + p.slice(1);
  if (!/^\+\d{7,15}$/.test(p)) return null;
  return p;
}

/**
 * Gemeinsamer Kern für Agent- und Admin-Bearbeitung der Kundenstammdaten
 * (Vorname, Nachname, E-Mail, Telefon). NIEMALS Paket/Betrag/Status/Referenz —
 * diese Felder werden hier bewusst nicht einmal gelesen.
 *
 * E-Mail-Änderung zieht den Kunden-Login automatisch mit: der Login sucht den
 * Antrag PER E-MAIL (fiaon-antrag.ts POST /login), das Passwort liegt am selben
 * Datensatz (utm.password) — beides ändert sich in EINEM atomaren UPDATE.
 *
 * Jede Feldänderung erzeugt einen Audit-Eintrag in fiaon_contact_log
 * (type 'edit', „E-Mail korrigiert durch …: alt → neu") für die Kunden-Timeline.
 */
export async function updateCustomerContact(
  ref: string,
  body: any,
  actor: { id: number | null; name: string },
): Promise<{
  error?: { code: number; msg: string };
  changes?: Array<{ field: string; from: string; to: string }>;
  duplicate?: { ref: string; payment_status: string; name: string } | null;
  loginEmailChanged?: boolean;
}> {
  const rows = await sqlPool`
    SELECT ref, first_name, last_name, email, phone, phone_country_code, contact_phone, utm::text AS utm_string, password
    FROM fiaon_applications WHERE ref = ${ref} AND merged_into IS NULL
  `;
  if (rows.length === 0) return { error: { code: 404, msg: "Kunde nicht gefunden" } };
  const cur = rows[0];

  // Explizite Abwehr: Versuche, geschützte Felder zu ändern, werden hart abgelehnt (Testplan AC).
  const FORBIDDEN = ["packName", "pack_name", "packKey", "pack_key", "amountDue", "amount_due", "paymentStatus", "payment_status", "paymentReference", "payment_reference", "status", "ref"];
  for (const k of FORBIDDEN) {
    if (body[k] !== undefined) return { error: { code: 403, msg: `Feld '${k}' darf hier nicht geändert werden` } };
  }

  const firstName = body.firstName !== undefined ? String(body.firstName).trim() : null;
  const lastName = body.lastName !== undefined ? String(body.lastName).trim() : null;
  const emailRaw = body.email !== undefined ? String(body.email).trim().toLowerCase() : null;
  const phoneRaw = body.phone !== undefined ? String(body.phone) : null;

  if (firstName !== null && !firstName) return { error: { code: 400, msg: "Vorname darf nicht leer sein" } };
  if (lastName !== null && !lastName) return { error: { code: 400, msg: "Nachname darf nicht leer sein" } };
  if (emailRaw !== null && !EMAIL_RE.test(emailRaw)) return { error: { code: 400, msg: "E-Mail-Format ungültig" } };
  let phone: string | null = null;
  if (phoneRaw !== null) {
    phone = normalizePhone(phoneRaw);
    if (phone === null) return { error: { code: 400, msg: "Telefonnummer ungültig — bitte mit Vorwahl (+49 …)" } };
  }

  const changes: Array<{ field: string; from: string; to: string }> = [];
  if (firstName !== null && firstName !== (cur.first_name || "")) changes.push({ field: "Vorname", from: cur.first_name || "—", to: firstName });
  if (lastName !== null && lastName !== (cur.last_name || "")) changes.push({ field: "Nachname", from: cur.last_name || "—", to: lastName });
  if (emailRaw !== null && emailRaw !== String(cur.email || "").trim().toLowerCase()) changes.push({ field: "E-Mail", from: cur.email || "—", to: emailRaw });
  const curPhone = `${cur.phone_country_code || ""}${cur.phone || ""}` || cur.contact_phone || "";
  if (phone !== null && phone !== curPhone) changes.push({ field: "Telefon", from: curPhone || "—", to: phone || "—" });
  if (changes.length === 0) return { changes: [], duplicate: null, loginEmailChanged: false };

  // Duplikat-Warnung (Paket AC5): Kollision mit anderem Kunden derselben E-Mail?
  let duplicate: { ref: string; payment_status: string; name: string } | null = null;
  if (emailRaw !== null && changes.some((c) => c.field === "E-Mail")) {
    const dup = await sqlPool`
      SELECT ref, payment_status, first_name, last_name, contact_name FROM fiaon_applications
      WHERE LOWER(TRIM(email)) = ${emailRaw} AND ref != ${ref} AND merged_into IS NULL
      ORDER BY created_at DESC LIMIT 1
    `;
    if (dup.length > 0) {
      duplicate = {
        ref: dup[0].ref,
        payment_status: dup[0].payment_status,
        name: [dup[0].first_name, dup[0].last_name].filter(Boolean).join(" ") || dup[0].contact_name || dup[0].ref,
      };
    }
  }

  // Atomares UPDATE — E-Mail + Login wandern zusammen (Passwort bleibt am Datensatz).
  await sqlPool`
    UPDATE fiaon_applications SET
      first_name = ${firstName !== null ? firstName : cur.first_name},
      last_name = ${lastName !== null ? lastName : cur.last_name},
      email = ${emailRaw !== null ? emailRaw : cur.email},
      phone = ${phone !== null ? (phone || null) : cur.phone},
      phone_country_code = ${phone !== null ? "" : cur.phone_country_code},
      updated_at = NOW()
    WHERE ref = ${ref}
  `;

  // Audit: ein Timeline-Eintrag pro geändertem Feld (alt → neu, Akteur, Zeit)
  for (const c of changes) {
    await sqlPool`
      INSERT INTO fiaon_contact_log (ref, agent_id, agent_name, type, note)
      VALUES (${ref}, ${actor.id}, ${actor.name}, 'edit',
              ${`${c.field} korrigiert durch ${actor.name}: ${c.from} → ${c.to}`})
    `;
  }

  // Hat der Kunde bereits ein Konto mit Passwort? → Hinweis „meldet sich künftig mit neuer E-Mail an"
  let hasPassword = Boolean(cur.password);
  if (!hasPassword && cur.utm_string) {
    try { hasPassword = Boolean(JSON.parse(cur.utm_string)?.password); } catch { /* ignorieren */ }
  }
  const loginEmailChanged = hasPassword && changes.some((c) => c.field === "E-Mail");

  console.log(`[FIAON-CONTACT-EDIT] ${ref} durch ${actor.name}: ${changes.map((c) => c.field).join(", ")}${duplicate ? ` (DUBLETTE mit ${duplicate.ref})` : ""}`);
  return { changes, duplicate, loginEmailChanged };
}

// ═══════════════ PAKET AE1 — Automatische Kundenverteilung (Round-Robin) ═══════════════

/**
 * Verteilt unzugewiesene offene Bestellungen fair auf alle aktiven Agents mit
 * distribution_active=TRUE. Rotations-Zeiger in fiaon_settings; Obergrenze
 * offener zugewiesener Kunden pro Agent (distribution_cap, 0 = unbegrenzt).
 * Läuft nach jeder Bestellanlage + stündlich (fail-safe). Bestehendes
 * Auto-Claim für Altbestände und manuelle Admin-Neuzuweisung bleiben erhalten.
 */
export async function distributeUnassignedOrders(): Promise<number> {
  await ensureAgentTables();
  const settings = await getSettings();
  if (settings.distribution_enabled !== "1") return 0;
  const cap = Math.max(0, Math.round(Number(settings.distribution_cap) || 0));

  const agents = await sqlPool`
    SELECT id, name FROM fiaon_agents WHERE active = TRUE AND distribution_active = TRUE ORDER BY id ASC
  `;
  if (agents.length === 0) return 0;

  const counts = await sqlPool`
    SELECT assigned_agent_id, COUNT(*)::int AS c FROM fiaon_applications
    WHERE payment_status IN ('pending_payment', 'claimed_paid') AND merged_into IS NULL AND assigned_agent_id IS NOT NULL
    GROUP BY assigned_agent_id
  `;
  const openBy: Record<number, number> = {};
  for (const r of counts) openBy[Number(r.assigned_agent_id)] = Number(r.c);

  const orders = await sqlPool`
    SELECT ref FROM fiaon_applications
    WHERE payment_status IN ('pending_payment', 'claimed_paid')
      AND merged_into IS NULL AND assigned_agent_id IS NULL AND payment_reference IS NOT NULL
    ORDER BY created_at ASC
  `;
  if (orders.length === 0) return 0;

  // Rotations-Start: nach dem zuletzt bedienten Agent weiterdrehen
  const lastId = Number(settings.distribution_last_agent_id) || 0;
  let idx = agents.findIndex((a: any) => Number(a.id) > lastId);
  if (idx === -1) idx = 0;

  let assigned = 0;
  let lastAssignedAgent = lastId;
  for (const o of orders) {
    // nächsten Agent mit freier Kapazität im Ring suchen
    let chosen: any = null;
    for (let step = 0; step < agents.length; step++) {
      const cand = agents[(idx + step) % agents.length];
      if (cap === 0 || (openBy[Number(cand.id)] || 0) < cap) {
        chosen = cand;
        idx = (idx + step + 1) % agents.length;
        break;
      }
    }
    if (!chosen) break; // alle Agents voll → Rest bleibt unzugewiesen (Auto-Claim greift weiter)
    const updated = await sqlPool`
      UPDATE fiaon_applications SET assigned_agent_id = ${chosen.id}, updated_at = NOW()
      WHERE ref = ${o.ref} AND assigned_agent_id IS NULL
      RETURNING ref
    `;
    if (updated.length === 0) continue; // Race: parallel geclaimt
    openBy[Number(chosen.id)] = (openBy[Number(chosen.id)] || 0) + 1;
    lastAssignedAgent = Number(chosen.id);
    assigned++;
    await sqlPool`
      INSERT INTO fiaon_contact_log (ref, agent_id, agent_name, type, note)
      VALUES (${o.ref}, NULL, 'System', 'system', ${`Automatisch zugewiesen an ${chosen.name} (Rotationsverteilung)`})
    `;
  }
  if (assigned > 0) {
    await setSetting("distribution_last_agent_id", String(lastAssignedAgent));
    console.log(`[FIAON-VERTEILUNG] ${assigned} Bestellung(en) per Rotation zugewiesen`);
  }
  return assigned;
}

// Stündlicher fail-safe Lauf (zusätzlich zum Hook nach Bestellanlage)
setInterval(() => {
  distributeUnassignedOrders().catch((err) => console.error("[FIAON-VERTEILUNG] Cron:", err));
}, 60 * 60 * 1000);

// ═══════════════ KALENDER-ERINNERUNGEN (J2) — stündlicher Cron ═══════════════

/** Termine der nächsten 60 Minuten → Make `agent_callback_reminder` (einmalig, atomarer Claim). */
export async function runCallbackReminders(): Promise<number> {
  await ensureAgentTables();
  const claimed = await sqlPool`
    UPDATE fiaon_contact_log SET reminder_sent_at = NOW()
    WHERE scheduled_at BETWEEN NOW() AND NOW() + INTERVAL '60 minutes'
      AND done_at IS NULL AND reminder_sent_at IS NULL AND agent_id IS NOT NULL
    RETURNING id, ref, agent_id, scheduled_at
  `;
  let sent = 0;
  for (const entry of claimed) {
    const agents = await sqlPool`SELECT email, first_name, name FROM fiaon_agents WHERE id = ${entry.agent_id} AND active = TRUE`;
    if (agents.length === 0) continue;
    const apps = await sqlPool`SELECT first_name, last_name, contact_name, company_name FROM fiaon_applications WHERE ref = ${entry.ref}`;
    const a = apps[0] || {};
    const kunde = a.company_name || [a.first_name, a.last_name].filter(Boolean).join(" ") || a.contact_name || entry.ref;
    await sendMakeWebhook("agent_callback_reminder", {
      email: agents[0].email,
      agent_email: agents[0].email,
      vorname: agents[0].first_name || agents[0].name,
      kunde_name: kunde,
      referenz: entry.ref,
      termin_zeit: new Date(entry.scheduled_at).toISOString(),
    });
    sent++;
  }
  if (sent) console.log(`[FIAON-AGENT] Rückruf-Erinnerungen versendet: ${sent}`);
  return sent;
}

// Anbindung an den bestehenden Stunden-Rhythmus (fail-safe, unabhängig vom Payment-Cron)
setInterval(() => {
  runCallbackReminders().catch((err) => console.error("[FIAON-AGENT] Reminder-Cron:", err));
}, 60 * 60 * 1000);

// ═══════════════ AGENT: Auth (Login + Setup + Reset) ═══════════════

router.post("/agent/login", async (req, res) => {
  try {
    await ensureAgentTables();
    const { email, password } = req.body || {};
    if (!email || !password) return res.status(400).json({ ok: false, error: "E-Mail und Passwort erforderlich" });
    const rows = await sqlPool`SELECT * FROM fiaon_agents WHERE LOWER(email) = ${String(email).trim().toLowerCase()}`;
    if (rows.length === 0 || !rows[0].active || !rows[0].password_hash || !(await bcrypt.compare(password, rows[0].password_hash))) {
      return res.status(401).json({ ok: false, error: "Anmeldedaten ungültig oder Zugang deaktiviert" });
    }
    await sqlPool`UPDATE fiaon_agents SET last_login_at = NOW() WHERE id = ${rows[0].id}`;
    logAgentEvent(rows[0].id, "login").catch(() => {});
    issueAgentCookie(res, rows[0].id, Number(rows[0].session_epoch));
    console.log(`[FIAON-AGENT] Login: ${rows[0].name} (${rows[0].email})`);
    res.json({ ok: true, agent: { name: rows[0].name, email: rows[0].email } });
  } catch (err) {
    console.error("[FIAON-AGENT] login:", err);
    res.status(500).json({ ok: false, error: "Serverfehler" });
  }
});

router.post("/agent/logout", (_req, res) => {
  res.clearCookie(AGENT_COOKIE, { path: "/" });
  res.json({ ok: true });
});

router.get("/agent/me", requireAgent, (req: AgentRequest, res) => {
  res.json({ ok: true, agent: req.agent });
});

// F2: Einladungs-Token prüfen (Setup-Seite lädt Name zur Begrüßung)
router.get("/agent/setup/validate", async (req, res) => {
  try {
    await ensureAgentTables();
    const token = String(req.query.token || "");
    if (!token) return res.status(400).json({ ok: false, error: "Token fehlt" });
    const rows = await sqlPool`
      SELECT id, first_name, name, email FROM fiaon_agents
      WHERE invite_token_hash = ${hashToken(token)} AND invite_expires_at > NOW() AND active = TRUE
    `;
    if (rows.length === 0) return res.status(410).json({ ok: false, error: "Einladung ungültig oder abgelaufen — bitte neue Einladung anfordern" });
    res.json({ ok: true, firstName: rows[0].first_name || rows[0].name, email: rows[0].email });
  } catch (err) {
    console.error("[FIAON-AGENT] setup validate:", err);
    res.status(500).json({ ok: false, error: "Serverfehler" });
  }
});

// F2: Passwort festlegen (einmaliger Token, danach direkt eingeloggt)
router.post("/agent/setup", async (req, res) => {
  try {
    await ensureAgentTables();
    const { token, password } = req.body || {};
    if (!token) return res.status(400).json({ ok: false, error: "Token fehlt" });
    const policyErr = passwordPolicyError(String(password || ""));
    if (policyErr) return res.status(400).json({ ok: false, error: policyErr });
    const hash = await bcrypt.hash(String(password), 10);
    // Atomar: Token einlösen + entwerten (einmalige Nutzung)
    const rows = await sqlPool`
      UPDATE fiaon_agents SET
        password_hash = ${hash},
        invite_token_hash = NULL, invite_expires_at = NULL,
        last_login_at = NOW()
      WHERE invite_token_hash = ${hashToken(String(token))} AND invite_expires_at > NOW() AND active = TRUE
      RETURNING id, name, email, session_epoch
    `;
    if (rows.length === 0) return res.status(410).json({ ok: false, error: "Einladung ungültig oder abgelaufen" });
    await logAgentEvent(rows[0].id, "password_set");
    issueAgentCookie(res, rows[0].id, Number(rows[0].session_epoch));
    console.log(`[FIAON-AGENT] Passwort-Setup abgeschlossen: ${rows[0].email}`);
    res.json({ ok: true, agent: { name: rows[0].name, email: rows[0].email } });
  } catch (err) {
    console.error("[FIAON-AGENT] setup:", err);
    res.status(500).json({ ok: false, error: "Serverfehler" });
  }
});

// F2: Passwort vergessen — IMMER dieselbe Antwort (Anti-Enumeration)
router.post("/agent/forgot-password", async (req, res) => {
  try {
    await ensureAgentTables();
    const email = String(req.body?.email || "").trim().toLowerCase();
    if (email) {
      const rows = await sqlPool`SELECT id, first_name, name, email FROM fiaon_agents WHERE LOWER(email) = ${email} AND active = TRUE`;
      if (rows.length > 0) {
        const token = randomBytes(32).toString("hex");
        await sqlPool`
          UPDATE fiaon_agents SET reset_token_hash = ${hashToken(token)}, reset_expires_at = ${new Date(Date.now() + RESET_TTL_MS)}
          WHERE id = ${rows[0].id}
        `;
        await logAgentEvent(rows[0].id, "password_reset_requested");
        sendMakeWebhook("agent_password_reset", {
          email: rows[0].email,
          vorname: rows[0].first_name || rows[0].name,
          reset_url: `${baseUrl()}/agent/passwort?token=${token}`,
        }).catch(() => {});
      }
    }
    // Keine Auskunft, ob die E-Mail existiert
    res.json({ ok: true, message: "Falls ein Konto existiert, wurde eine E-Mail versendet." });
  } catch (err) {
    console.error("[FIAON-AGENT] forgot:", err);
    res.json({ ok: true, message: "Falls ein Konto existiert, wurde eine E-Mail versendet." });
  }
});

// F2: Passwort per Reset-Token setzen (1h gültig, invalidiert alte Sessions)
router.post("/agent/reset-password", async (req, res) => {
  try {
    await ensureAgentTables();
    const { token, password } = req.body || {};
    if (!token) return res.status(400).json({ ok: false, error: "Token fehlt" });
    const policyErr = passwordPolicyError(String(password || ""));
    if (policyErr) return res.status(400).json({ ok: false, error: policyErr });
    const hash = await bcrypt.hash(String(password), 10);
    const rows = await sqlPool`
      UPDATE fiaon_agents SET
        password_hash = ${hash},
        reset_token_hash = NULL, reset_expires_at = NULL,
        session_epoch = session_epoch + 1,
        last_login_at = NOW()
      WHERE reset_token_hash = ${hashToken(String(token))} AND reset_expires_at > NOW() AND active = TRUE
      RETURNING id, name, email, session_epoch
    `;
    if (rows.length === 0) return res.status(410).json({ ok: false, error: "Link ungültig oder abgelaufen — bitte erneut anfordern" });
    await logAgentEvent(rows[0].id, "password_changed", { via: "reset" });
    issueAgentCookie(res, rows[0].id, Number(rows[0].session_epoch));
    res.json({ ok: true, agent: { name: rows[0].name, email: rows[0].email } });
  } catch (err) {
    console.error("[FIAON-AGENT] reset:", err);
    res.status(500).json({ ok: false, error: "Serverfehler" });
  }
});

// ═══════════════ AGENT: Profil (F3) ═══════════════

router.get("/agent/profile", requireAgent, async (req: AgentRequest, res) => {
  try {
    const rows = await sqlPool`
      SELECT id, name, first_name, last_name, email, phone, avatar,
             bank_iban_masked, bank_holder_enc IS NOT NULL AS has_bank,
             monthly_goal_cents, created_at, last_login_at
      FROM fiaon_agents WHERE id = ${req.agent!.id}
    `;
    const r = rows[0];
    res.json({
      ok: true,
      profile: {
        id: r.id,
        firstName: r.first_name,
        lastName: r.last_name,
        name: r.name,
        email: r.email,
        phone: r.phone,
        avatar: r.avatar,
        ibanMasked: r.bank_iban_masked,
        hasBank: r.has_bank,
        bankHolder: r.has_bank ? decryptSecret((await sqlPool`SELECT bank_holder_enc FROM fiaon_agents WHERE id = ${r.id}`)[0].bank_holder_enc) : null,
        monthlyGoalCents: r.monthly_goal_cents,
        createdAt: r.created_at,
      },
    });
  } catch (err) {
    console.error("[FIAON-AGENT] profile:", err);
    res.status(500).json({ ok: false, error: "Serverfehler" });
  }
});

// Telefonnummer (selbst änderbar; E-Mail/Name nur durch Admin)
router.post("/agent/profile/phone", requireAgent, async (req: AgentRequest, res) => {
  try {
    const phone = String(req.body?.phone || "").trim().slice(0, 40);
    await sqlPool`UPDATE fiaon_agents SET phone = ${phone || null} WHERE id = ${req.agent!.id}`;
    await logAgentEvent(req.agent!.id, "phone_changed", { phone });
    res.json({ ok: true });
  } catch (err) {
    console.error("[FIAON-AGENT] phone:", err);
    res.status(500).json({ ok: false, error: "Serverfehler" });
  }
});

// Profilbild: Client schneidet quadratisch zu + verkleinert auf 256px (Canvas),
// Server validiert Format + Größe (Roh-Upload-Limit 2 MB greift clientseitig).
router.post("/agent/profile/avatar", requireAgent, async (req: AgentRequest, res) => {
  try {
    const dataUrl = String(req.body?.avatar || "");
    if (dataUrl === "") {
      await sqlPool`UPDATE fiaon_agents SET avatar = NULL WHERE id = ${req.agent!.id}`;
      await logAgentEvent(req.agent!.id, "avatar_changed", { removed: true });
      return res.json({ ok: true });
    }
    if (!/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(dataUrl)) {
      return res.status(400).json({ ok: false, error: "Ungültiges Bildformat" });
    }
    const bytes = Math.floor((dataUrl.length - dataUrl.indexOf(",") - 1) * 0.75);
    if (bytes > 600 * 1024) return res.status(400).json({ ok: false, error: "Bild zu groß — bitte erneut versuchen" });
    await sqlPool`UPDATE fiaon_agents SET avatar = ${dataUrl} WHERE id = ${req.agent!.id}`;
    await logAgentEvent(req.agent!.id, "avatar_changed", { bytes });
    res.json({ ok: true });
  } catch (err) {
    console.error("[FIAON-AGENT] avatar:", err);
    res.status(500).json({ ok: false, error: "Serverfehler" });
  }
});

// Passwort ändern (altes Passwort erforderlich)
router.post("/agent/profile/password", requireAgent, async (req: AgentRequest, res) => {
  try {
    const { oldPassword, newPassword } = req.body || {};
    const rows = await sqlPool`SELECT password_hash, session_epoch FROM fiaon_agents WHERE id = ${req.agent!.id}`;
    if (!rows[0].password_hash || !(await bcrypt.compare(String(oldPassword || ""), rows[0].password_hash))) {
      return res.status(401).json({ ok: false, error: "Aktuelles Passwort ist falsch" });
    }
    const policyErr = passwordPolicyError(String(newPassword || ""));
    if (policyErr) return res.status(400).json({ ok: false, error: policyErr });
    const hash = await bcrypt.hash(String(newPassword), 10);
    const updated = await sqlPool`
      UPDATE fiaon_agents SET password_hash = ${hash}, session_epoch = session_epoch + 1
      WHERE id = ${req.agent!.id} RETURNING session_epoch
    `;
    await logAgentEvent(req.agent!.id, "password_changed", { via: "profile" });
    // eigene Sitzung nahtlos fortsetzen (neues Cookie mit neuer Epoch)
    issueAgentCookie(res, req.agent!.id, Number(updated[0].session_epoch));
    res.json({ ok: true });
  } catch (err) {
    console.error("[FIAON-AGENT] password change:", err);
    res.status(500).json({ ok: false, error: "Serverfehler" });
  }
});

// Auszahlungsdaten: IBAN-Prüfsumme validieren, AES-256-GCM verschlüsselt speichern,
// maskiert anzeigen; jede Änderung → Audit + Admin-Hinweis (bank_change_ack = FALSE).
router.post("/agent/profile/bank", requireAgent, async (req: AgentRequest, res) => {
  try {
    const holder = String(req.body?.holder || "").trim().slice(0, 120);
    const ibanRaw = String(req.body?.iban || "").replace(/\s+/g, "").toUpperCase();
    const bic = String(req.body?.bic || "").trim().toUpperCase().slice(0, 11);
    if (!holder) return res.status(400).json({ ok: false, error: "Kontoinhaber erforderlich" });
    if (!ibanChecksumValid(ibanRaw)) return res.status(400).json({ ok: false, error: "IBAN ungültig (Prüfsumme fehlgeschlagen)" });
    if (bic && !/^[A-Z]{6}[A-Z0-9]{2}([A-Z0-9]{3})?$/.test(bic)) return res.status(400).json({ ok: false, error: "BIC ungültig" });
    const masked = maskIban(ibanRaw);
    // Alt-IBAN (maskiert) + IP für den Betrugsschutz-Trail festhalten (ändert NICHT,
    // was der Agent sieht — nur der Admin-Audit gewinnt alt→neu + Herkunft).
    const prev = await sqlPool`SELECT bank_iban_masked FROM fiaon_agents WHERE id = ${req.agent!.id}`;
    const oldMasked = prev[0]?.bank_iban_masked || null;
    const ip = String((req.headers["x-forwarded-for"] as string || "").split(",")[0].trim() || req.socket?.remoteAddress || "");
    await sqlPool`
      UPDATE fiaon_agents SET
        bank_holder_enc = ${encryptSecret(holder)},
        bank_iban_enc = ${encryptSecret(ibanRaw)},
        bank_bic_enc = ${bic ? encryptSecret(bic) : null},
        bank_iban_masked = ${masked},
        bank_updated_at = NOW(),
        bank_change_ack = FALSE
      WHERE id = ${req.agent!.id}
    `;
    await logAgentEvent(req.agent!.id, "bank_changed", { old_iban_masked: oldMasked, iban_masked: masked, ip });
    res.json({ ok: true, ibanMasked: masked });
  } catch (err) {
    console.error("[FIAON-AGENT] bank:", err);
    res.status(500).json({ ok: false, error: "Serverfehler" });
  }
});

// ═══════════════ AGENT: Kundenliste (NUR unbezahlte) ═══════════════

// Alle Felder mit a.-Präfix — Queries joinen fiaon_agents (Namens-Kollisionen: first_name, email, phone, created_at)
const AGENT_CUSTOMER_FIELDS = `
  a.ref, a.type, a.first_name, a.last_name, a.contact_name, a.company_name,
  COALESCE(NULLIF(a.email,''), NULLIF(a.contact_email,''), NULLIF(a.billing_email,'')) AS email,
  a.phone, a.phone_country_code, a.contact_phone,
  a.pack_name, a.pack_key, a.amount_due, a.currency, a.payment_reference, a.payment_status,
  a.payment_due_date, a.claimed_paid_at, a.promised_pay_date, a.agent_email_sent_at,
  a.invoice_number, a.created_at
`;

router.get("/agent/customers", requireAgent, async (req: AgentRequest, res) => {
  try {
    // Sichtbarkeit: AUSSCHLIESSLICH pending_payment + claimed_paid, keine merged-Altlasten.
    // G2: Arbeitsliste = unzugewiesene + eigene Kunden; von Kollegen betreute Kunden
    // erscheinen NUR read-only in der Sektion „Von Kollegen betreut".
    const rows = await sqlPool.unsafe(`
      SELECT ${AGENT_CUSTOMER_FIELDS},
        a.assigned_agent_id, a.locked_by_agent_id, a.locked_until,
        ag.name AS assigned_agent_name, lg.name AS locked_by_name
      FROM fiaon_applications a
      LEFT JOIN fiaon_agents ag ON ag.id = a.assigned_agent_id
      LEFT JOIN fiaon_agents lg ON lg.id = a.locked_by_agent_id
      WHERE a.payment_status IN ('pending_payment', 'claimed_paid')
        AND (a.merged_into IS NULL)
      ORDER BY (a.payment_status = 'claimed_paid') DESC, a.claimed_paid_at ASC NULLS LAST, a.created_at ASC
    `);
    const refs = rows.map((r: any) => r.ref);
    let lastLogByRef: Record<string, any> = {};
    let openAppointments: Record<string, string> = {};
    if (refs.length > 0) {
      const logs = await sqlPool`
        SELECT DISTINCT ON (ref) ref, type, outcome, note, agent_name, scheduled_at, created_at
        FROM fiaon_contact_log WHERE ref = ANY(${refs})
        ORDER BY ref, created_at DESC
      `;
      for (const l of logs) lastLogByRef[l.ref] = l;
      const appts = await sqlPool`
        SELECT DISTINCT ON (ref) ref, scheduled_at FROM fiaon_contact_log
        WHERE ref = ANY(${refs}) AND scheduled_at IS NOT NULL AND done_at IS NULL AND scheduled_at > NOW() - INTERVAL '1 day'
        ORDER BY ref, scheduled_at ASC
      `;
      for (const a of appts) openAppointments[a.ref] = a.scheduled_at;
    }
    const me = req.agent!.id;
    const now = Date.now();
    const enrich = (r: any) => ({
      ...r,
      last_contact: lastLogByRef[r.ref] || null,
      next_appointment: openAppointments[r.ref] || null,
      locked_by_name: r.locked_by_agent_id && r.locked_by_agent_id !== me && r.locked_until && new Date(r.locked_until).getTime() > now ? r.locked_by_name : null,
    });
    const worklist = rows.filter((r: any) => !r.assigned_agent_id || r.assigned_agent_id === me).map(enrich);
    const colleagues = rows.filter((r: any) => r.assigned_agent_id && r.assigned_agent_id !== me).map(enrich);
    res.json({ ok: true, data: worklist, colleagues });
  } catch (err) {
    console.error("[FIAON-AGENT] customers:", err);
    res.status(500).json({ ok: false, error: "Serverfehler" });
  }
});

/**
 * G2-Guard für Aktionen: Kunde muss unbezahlt sein; ist er einem KOLLEGEN
 * zugewiesen → 403; hält ein Kollege gerade den Soft-Lock → 423.
 * Unzugewiesene Kunden werden bei der ersten Aktion automatisch geclaimt.
 */
async function claimOrGuard(ref: string, agent: { id: number; name: string }): Promise<{ error?: { code: number; msg: string }; claimed?: boolean }> {
  const rows = await sqlPool`
    SELECT ref, assigned_agent_id, locked_by_agent_id, locked_until FROM fiaon_applications
    WHERE ref = ${ref} AND payment_status IN ('pending_payment', 'claimed_paid') AND merged_into IS NULL
  `;
  if (rows.length === 0) return { error: { code: 404, msg: "Kunde nicht gefunden oder bereits bezahlt" } };
  const r = rows[0];
  if (r.assigned_agent_id && r.assigned_agent_id !== agent.id) {
    return { error: { code: 403, msg: "Dieser Kunde wird von einem Kollegen betreut (nur Lesezugriff)" } };
  }
  if (!r.assigned_agent_id && r.locked_by_agent_id && r.locked_by_agent_id !== agent.id && r.locked_until && new Date(r.locked_until) > new Date()) {
    return { error: { code: 423, msg: "Kunde ist gerade in Bearbeitung durch einen Kollegen" } };
  }
  if (!r.assigned_agent_id) {
    // Auto-Claim: atomar, nur wenn weiterhin unzugewiesen
    const claimed = await sqlPool`
      UPDATE fiaon_applications SET assigned_agent_id = ${agent.id}, locked_by_agent_id = NULL, locked_until = NULL, updated_at = NOW()
      WHERE ref = ${ref} AND assigned_agent_id IS NULL
      RETURNING ref
    `;
    if (claimed.length === 0) return { error: { code: 403, msg: "Kunde wurde soeben einem Kollegen zugewiesen" } };
    await logAction(ref, agent, "claim", { note: `Automatisch zugewiesen an ${agent.name} (erste dokumentierte Aktion)` });
    return { claimed: true };
  }
  return {};
}

// Detail: Kunde + Historie + passende Gesprächsleitfäden (I2).
// Öffnen eines UNZUGEWIESENEN Kunden setzt den 15-Min-Soft-Lock (G2).
router.get("/agent/customers/:ref", requireAgent, async (req: AgentRequest, res) => {
  try {
    const me = req.agent!.id;
    const rows = await sqlPool.unsafe(`
      SELECT ${AGENT_CUSTOMER_FIELDS}, a.street, a.zip, a.city,
        a.assigned_agent_id, a.locked_by_agent_id, a.locked_until,
        ag.name AS assigned_agent_name, lg.name AS locked_by_name
      FROM fiaon_applications a
      LEFT JOIN fiaon_agents ag ON ag.id = a.assigned_agent_id
      LEFT JOIN fiaon_agents lg ON lg.id = a.locked_by_agent_id
      WHERE a.ref = $1 AND a.payment_status IN ('pending_payment', 'claimed_paid') AND a.merged_into IS NULL
    `, [req.params.ref]);
    if (rows.length === 0) return res.status(404).json({ ok: false, error: "Kunde nicht gefunden oder bereits bezahlt" });
    const r: any = rows[0];
    const readOnly = !!(r.assigned_agent_id && r.assigned_agent_id !== me);
    const foreignLock = !r.assigned_agent_id && r.locked_by_agent_id && r.locked_by_agent_id !== me && r.locked_until && new Date(r.locked_until) > new Date();
    // Soft-Lock setzen/verlängern (nur wenn unzugewiesen und nicht fremd-gelockt)
    if (!r.assigned_agent_id && !foreignLock) {
      await sqlPool`
        UPDATE fiaon_applications SET locked_by_agent_id = ${me}, locked_until = NOW() + make_interval(mins => ${SOFT_LOCK_MIN})
        WHERE ref = ${req.params.ref} AND assigned_agent_id IS NULL
      `;
    }
    const log = await sqlPool`
      SELECT id, type, outcome, note, agent_name, scheduled_at, promised_date, done_at, created_at
      FROM fiaon_contact_log WHERE ref = ${req.params.ref}
      ORDER BY created_at DESC
    `;
    // I2: Kontext-Skripte gemäß Status→Kategorie-Mapping
    const settings = await getSettings();
    let contextScripts: any[] = [];
    try {
      const map = JSON.parse(settings.script_status_map || "{}");
      const category = map[r.payment_status];
      if (category) {
        contextScripts = await sqlPool`
          SELECT id, title, category, content_html, file_name FROM fiaon_scripts
          WHERE active = TRUE AND deleted_at IS NULL AND category = ${category}
          ORDER BY sort_order ASC, id ASC
        `;
      }
    } catch {}
    res.json({
      ok: true,
      data: { ...r, locked_by_name: foreignLock ? r.locked_by_name : null },
      log,
      readOnly: readOnly || !!foreignLock,
      contextScripts,
    });
  } catch (err) {
    console.error("[FIAON-AGENT] customer detail:", err);
    res.status(500).json({ ok: false, error: "Serverfehler" });
  }
});

// ═══════════════ PAKET AC — Agent: Stammdaten korrigieren ═══════════════
// Editierbar: Vorname, Nachname, E-Mail, Telefon. NICHT editierbar (Server
// lehnt hart ab): Paket, Betrag, Zahlungsstatus, Referenz. Antwort enthält
// duplicate (Dubletten-Warnung) + loginEmailChanged (Hinweis-Dialog).
router.patch("/agent/customers/:ref/contact-data", requireAgent, async (req: AgentRequest, res) => {
  try {
    const guard = await claimOrGuard(req.params.ref, req.agent!);
    if (guard.error) return res.status(guard.error.code).json({ ok: false, error: guard.error.msg });
    const result = await updateCustomerContact(req.params.ref, req.body || {}, { id: req.agent!.id, name: req.agent!.name });
    if (result.error) return res.status(result.error.code).json({ ok: false, error: result.error.msg });
    res.json({ ok: true, changes: result.changes, duplicate: result.duplicate, loginEmailChanged: result.loginEmailChanged });
  } catch (err) {
    console.error("[FIAON-AGENT] contact-data:", err);
    res.status(500).json({ ok: false, error: "Serverfehler" });
  }
});

// ═══════════════ AGENT: Notizen + Kontakt-Ergebnisse ═══════════════

// Freitext-Notiz (append-only). Erste Aktion an unzugewiesenem Kunden = Auto-Claim (G2).
router.post("/agent/customers/:ref/notes", requireAgent, async (req: AgentRequest, res) => {
  try {
    const note = String(req.body?.note || "").trim();
    if (!note) return res.status(400).json({ ok: false, error: "Notiz darf nicht leer sein" });
    if (note.length > 4000) return res.status(400).json({ ok: false, error: "Notiz zu lang (max. 4000 Zeichen)" });
    const guard = await claimOrGuard(req.params.ref, req.agent!);
    if (guard.error) return res.status(guard.error.code).json({ ok: false, error: guard.error.msg });
    const entry = await logAction(req.params.ref, req.agent!, "note", { note });
    res.json({ ok: true, entry, claimed: guard.claimed || false });
  } catch (err) {
    console.error("[FIAON-AGENT] note:", err);
    res.status(500).json({ ok: false, error: "Serverfehler" });
  }
});

const VALID_OUTCOMES = new Set([
  "erreicht_zahlt_gleich", "erreicht_zahlt_am", "erreicht_abgelehnt",
  "nicht_erreicht", "mailbox", "rueckruf_termin", "nummer_falsch",
]);

// Kontakt-Ergebnis (je Klick ein neuer Log-Eintrag; Termin-/Zusage-Daten optional)
router.post("/agent/customers/:ref/contact-result", requireAgent, async (req: AgentRequest, res) => {
  try {
    const { outcome, scheduledAt, promisedDate, note } = req.body || {};
    if (!VALID_OUTCOMES.has(outcome)) return res.status(400).json({ ok: false, error: "Ungültiges Kontakt-Ergebnis" });
    if (outcome === "rueckruf_termin" && !scheduledAt) return res.status(400).json({ ok: false, error: "Termin-Datum erforderlich" });
    if (outcome === "erreicht_zahlt_am" && !promisedDate) return res.status(400).json({ ok: false, error: "Zusage-Datum erforderlich" });
    const guard = await claimOrGuard(req.params.ref, req.agent!);
    if (guard.error) return res.status(guard.error.code).json({ ok: false, error: guard.error.msg });

    const entry = await logAction(req.params.ref, req.agent!, "result", {
      outcome,
      note: note ? String(note).slice(0, 4000) : null,
      scheduledAt: scheduledAt || null,
      promisedDate: promisedDate || null,
    });

    // Zahlungs-Zusage am Antrag speichern (sichtbar auch im Admin)
    if (promisedDate || outcome === "erreicht_zahlt_gleich") {
      const promised = promisedDate ? new Date(promisedDate) : new Date();
      await sqlPool`UPDATE fiaon_applications SET promised_pay_date = ${promised}, updated_at = NOW() WHERE ref = ${req.params.ref}`;
    }
    res.json({ ok: true, entry, claimed: guard.claimed || false });
  } catch (err) {
    console.error("[FIAON-AGENT] contact-result:", err);
    res.status(500).json({ ok: false, error: "Serverfehler" });
  }
});

// ═══════════════ AGENT: Ein-Klick-Mail „Wie soeben besprochen" ═══════════════
// KEINE Direkt-Mail — feuert Make-Webhook `agent_payment_reminder`.

router.post("/agent/customers/:ref/send-payment-email", requireAgent, async (req: AgentRequest, res) => {
  try {
    const guard = await claimOrGuard(req.params.ref, req.agent!);
    if (guard.error) return res.status(guard.error.code).json({ ok: false, error: guard.error.msg });
    // Paket AD2 (doppelter Boden): keine Agent-Mail an E-Mail-Adressen mit
    // bezahlter Schwester-Bestellung — außer der Admin hat den Zweitkauf-Override gesetzt.
    const paidSister = await sqlPool`
      SELECT p.ref FROM fiaon_applications c
      JOIN fiaon_applications p ON LOWER(TRIM(p.email)) = LOWER(TRIM(c.email)) AND p.ref != c.ref
      WHERE c.ref = ${req.params.ref} AND c.allow_reminders_despite_paid = FALSE
        AND c.email IS NOT NULL AND TRIM(c.email) != ''
        AND p.payment_status = 'paid'
      LIMIT 1
    `;
    if (paidSister.length > 0) {
      return res.status(409).json({ ok: false, error: "Kunde hat bereits eine bezahlte Bestellung (Dublette) — keine Zahlungs-Mail. Admin kann in der Detailansicht einen echten Zweitkauf freigeben." });
    }
    // Doppelklick-/Spam-Schutz: 10-Minuten-Sperre pro Kunde (atomarer Claim)
    // last_reminder_at: kanalübergreifende 20h-Dedupe (Paket V) — die Agent-Mail
    // zählt wie Engine/Bulk als Erinnerung, damit der Kunde nicht doppelt am Tag hört.
    const claimed = await sqlPool`
      UPDATE fiaon_applications SET agent_email_sent_at = NOW(), last_reminder_at = NOW()
      WHERE ref = ${req.params.ref}
        AND payment_status IN ('pending_payment', 'claimed_paid')
        AND (agent_email_sent_at IS NULL OR agent_email_sent_at < NOW() - INTERVAL '10 minutes')
      RETURNING ref, first_name, last_name, contact_name, email, contact_email, billing_email,
                pack_name, payment_reference, amount_due, agent_email_sent_at
    `;
    if (claimed.length === 0) {
      const row = await sqlPool`SELECT agent_email_sent_at FROM fiaon_applications WHERE ref = ${req.params.ref}`;
      const lockedUntil = row[0]?.agent_email_sent_at
        ? new Date(new Date(row[0].agent_email_sent_at).getTime() + EMAIL_LOCK_MS).toISOString()
        : null;
      return res.status(429).json({ ok: false, error: "E-Mail wurde vor Kurzem gesendet (10-Minuten-Sperre)", lockedUntil });
    }

    const payload = {
      ...makePayloadFromRow(claimed[0]),
      agent_name: req.agent!.name,
      invoice_url: claimed[0].payment_reference ? signInvoiceUrl(claimed[0].payment_reference) : null,
    };
    sendMakeWebhook("agent_payment_reminder", payload).catch(() => {});
    await logAction(req.params.ref, req.agent!, "email_sent", { note: "Zahlungsdaten-Mail (Make: agent_payment_reminder) ausgelöst" });

    res.json({ ok: true, lockedUntil: new Date(Date.now() + EMAIL_LOCK_MS).toISOString() });
  } catch (err) {
    console.error("[FIAON-AGENT] send-payment-email:", err);
    res.status(500).json({ ok: false, error: "Serverfehler" });
  }
});

// ═══════════════ AGENT: Rechnung (Download) ═══════════════

router.get("/agent/customers/:ref/invoice.pdf", requireAgent, async (req: AgentRequest, res) => {
  try {
    const rows = await sqlPool`
      SELECT * FROM fiaon_applications
      WHERE ref = ${req.params.ref} AND payment_status IN ('pending_payment', 'claimed_paid') AND merged_into IS NULL
    `;
    if (rows.length === 0) return res.status(404).json({ ok: false, error: "Kunde nicht gefunden" });
    let row = rows[0];
    if (!row.invoice_number) {
      await ensureInvoiceNumber(sqlPool, row.ref);
      row = (await sqlPool`SELECT * FROM fiaon_applications WHERE ref = ${req.params.ref}`)[0];
    }
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `inline; filename="${row.invoice_number || "FIAON-Rechnung"}.pdf"`);
    const doc = new PDFDocument({ size: "A4", margin: 50 });
    doc.pipe(res);
    renderInvoicePdf(doc, row);
    doc.end();
  } catch (err) {
    console.error("[FIAON-AGENT] invoice:", err);
    if (!res.headersSent) res.status(500).json({ ok: false, error: "Serverfehler" });
  }
});

// ═══════════════ AGENT: Verdienst (G4) ═══════════════

router.get("/agent/earnings", requireAgent, async (req: AgentRequest, res) => {
  try {
    const me = req.agent!.id;
    const settings = await getSettings();
    const agentRow = await sqlPool`SELECT commission_rate_bp, monthly_goal_cents FROM fiaon_agents WHERE id = ${me}`;
    const rateBp = agentRateBp(agentRow[0] as any, settings);
    // Potenziell (Anzeige, kein Anspruch): zugewiesene, noch unbezahlte Kunden × Satz
    const potential = await sqlPool`
      SELECT COALESCE(SUM(ROUND(ROUND(COALESCE(amount_due::numeric,0) * 100) * ${rateBp} / 10000.0)),0) AS s, COUNT(*) AS c
      FROM fiaon_applications
      WHERE assigned_agent_id = ${me} AND payment_status IN ('pending_payment','claimed_paid') AND merged_into IS NULL
    `;
    const sums = await sqlPool`
      SELECT status, COALESCE(SUM(amount_cents),0) AS s, COUNT(*) AS c
      FROM fiaon_commissions WHERE agent_id = ${me} GROUP BY status
    `;
    const byStatus: Record<string, { sum: number; count: number }> = {};
    for (const r of sums) byStatus[r.status] = { sum: Number(r.s), count: Number(r.c) };
    // Monatsziel-Fortschritt: nicht-stornierte Einträge dieses Kalendermonats
    const month = await sqlPool`
      SELECT COALESCE(SUM(amount_cents),0) AS s FROM fiaon_commissions
      WHERE agent_id = ${me} AND status != 'storniert' AND created_at >= date_trunc('month', NOW())
    `;
    const entries = await sqlPool`
      SELECT c.id, c.ref, c.payment_reference, c.pack_name, c.base_amount_cents, c.rate_bp, c.amount_cents,
             c.status, c.note, c.created_at, c.kind,
             a.first_name, a.last_name, a.contact_name, a.company_name
      FROM fiaon_commissions c
      LEFT JOIN fiaon_applications a ON a.ref = c.ref
      WHERE c.agent_id = ${me} ORDER BY c.created_at DESC LIMIT 50
    `;
    // Paket AE2: Team-Umsatzbeteiligung getrennt ausweisen (fließt ins selbe Guthaben)
    const overrides = await sqlPool`
      SELECT COALESCE(SUM(amount_cents),0) AS s, COUNT(*) FILTER (WHERE amount_cents > 0) AS c
      FROM fiaon_commissions WHERE agent_id = ${me} AND kind = 'override' AND status != 'storniert'
    `;
    res.json({
      ok: true,
      rateBp,
      potentialCents: Number(potential[0].s),
      potentialCount: Number(potential[0].c),
      confirmedCents: byStatus.bestaetigt?.sum || 0,
      inPayoutCents: byStatus.in_auszahlung?.sum || 0,
      paidOutCents: byStatus.ausgezahlt?.sum || 0,
      monthCents: Number(month[0].s),
      monthlyGoalCents: agentRow[0].monthly_goal_cents,
      overrideCents: Number(overrides[0].s),
      overrideCount: Number(overrides[0].c),
      entries,
    });
  } catch (err) {
    console.error("[FIAON-AGENT] earnings:", err);
    res.status(500).json({ ok: false, error: "Serverfehler" });
  }
});

// ═══════════════ AGENT: Auszahlung (H1) ═══════════════
// Der Antrag erzeugt AUSSCHLIESSLICH eine Anforderung — NIEMALS eine Transaktion.

router.get("/agent/payouts", requireAgent, async (req: AgentRequest, res) => {
  try {
    const me = req.agent!.id;
    const settings = await getSettings();
    const balance = await sqlPool`
      SELECT COALESCE(SUM(amount_cents),0) AS s FROM fiaon_commissions
      WHERE agent_id = ${me} AND status = 'bestaetigt'
    `;
    const bank = await sqlPool`SELECT bank_iban_masked FROM fiaon_agents WHERE id = ${me}`;
    const history = await sqlPool`
      SELECT id, amount_cents, status, iban_masked, reject_reason, requested_at, processed_at
      FROM fiaon_payouts WHERE agent_id = ${me} ORDER BY requested_at DESC LIMIT 50
    `;
    res.json({
      ok: true,
      balanceCents: Number(balance[0].s),
      minCents: Number(settings.payout_min_cents),
      hasBank: !!bank[0]?.bank_iban_masked,
      ibanMasked: bank[0]?.bank_iban_masked || null,
      history,
    });
  } catch (err) {
    console.error("[FIAON-AGENT] payouts:", err);
    res.status(500).json({ ok: false, error: "Serverfehler" });
  }
});

router.post("/agent/payouts/request", requireAgent, async (req: AgentRequest, res) => {
  try {
    const me = req.agent!.id;
    const settings = await getSettings();
    const minCents = Number(settings.payout_min_cents);
    const agentRows = await sqlPool`SELECT bank_holder_enc, bank_iban_enc, bank_bic_enc, bank_iban_masked FROM fiaon_agents WHERE id = ${me}`;
    if (!agentRows[0]?.bank_iban_enc) return res.status(400).json({ ok: false, error: "Bitte zuerst Auszahlungsdaten (IBAN) im Profil hinterlegen" });
    // Nur EINE offene Anforderung gleichzeitig
    const open = await sqlPool`SELECT id FROM fiaon_payouts WHERE agent_id = ${me} AND status = 'angefordert'`;
    if (open.length > 0) return res.status(409).json({ ok: false, error: "Es läuft bereits eine Auszahlungs-Anforderung" });
    // IMMER volles verfügbares Guthaben (keine Teilbeträge)
    const rows = await sqlPool`SELECT id, amount_cents FROM fiaon_commissions WHERE agent_id = ${me} AND status = 'bestaetigt'`;
    const total = rows.reduce((s: number, r: any) => s + Number(r.amount_cents), 0);
    if (total < minCents) return res.status(400).json({ ok: false, error: `Mindestbetrag ${(minCents / 100).toFixed(2)} € nicht erreicht` });
    const payout = await sqlPool`
      INSERT INTO fiaon_payouts (agent_id, amount_cents, bank_holder_enc, bank_iban_enc, bank_bic_enc, iban_masked)
      VALUES (${me}, ${total}, ${agentRows[0].bank_holder_enc}, ${agentRows[0].bank_iban_enc}, ${agentRows[0].bank_bic_enc}, ${agentRows[0].bank_iban_masked})
      RETURNING id, amount_cents, requested_at
    `;
    await sqlPool`
      UPDATE fiaon_commissions SET status = 'in_auszahlung', payout_id = ${payout[0].id}, updated_at = NOW()
      WHERE agent_id = ${me} AND status = 'bestaetigt'
    `;
    await logAgentEvent(me, "payout_requested", { payout_id: payout[0].id, amount_cents: total });
    console.log(`[FIAON-PAYOUT] Anforderung #${payout[0].id}: Agent ${me}, ${(total / 100).toFixed(2)} €`);
    res.json({ ok: true, payout: payout[0] });
  } catch (err) {
    console.error("[FIAON-AGENT] payout request:", err);
    res.status(500).json({ ok: false, error: "Serverfehler" });
  }
});

// ═══════════════ PAKET AE3/AE4 — Partner-Programm (Agent-Seite) ═══════════════

router.get("/agent/partner-program", requireAgent, async (req: AgentRequest, res) => {
  try {
    const me = req.agent!.id;
    const settings = await getSettings();
    const thresholds = partnerThresholds(settings);
    let prizes: Record<string, { title: string; description?: string }> = {};
    try { prizes = JSON.parse(settings.partner_prizes || "{}"); } catch { /* leer */ }

    const revenue = await ownRevenueCents(me);
    const status = partnerStatusFor(revenue, thresholds);
    const next = thresholds.find((t) => revenue < t.minCents) || null;

    const milestones = await sqlPool`
      SELECT milestone_key, achieved_at, prize_status FROM fiaon_partner_milestones WHERE agent_id = ${me} ORDER BY achieved_at ASC
    `;

    // „Mein Team“: geworbene Agents — anonym aggregiert (Anzahl, Abschlüsse, Umsatz),
    // plus eigene Team-Umsatzbeteiligung. EXAKT eine Ebene (AE2).
    const team = await sqlPool`
      SELECT COUNT(*)::int AS members FROM fiaon_agents WHERE recruited_by = ${me} AND active = TRUE
    `;
    const teamRevenue = await sqlPool`
      SELECT COUNT(*) FILTER (WHERE c.amount_cents > 0)::int AS deals,
             COALESCE(SUM(CASE WHEN c.amount_cents > 0 THEN c.base_amount_cents ELSE -c.base_amount_cents END),0) AS revenue
      FROM fiaon_commissions c
      JOIN fiaon_agents a ON a.id = c.agent_id
      WHERE a.recruited_by = ${me} AND c.kind = 'own' AND c.status != 'storniert'
    `;
    const myOverride = await sqlPool`
      SELECT COALESCE(SUM(amount_cents),0) AS s FROM fiaon_commissions
      WHERE agent_id = ${me} AND kind = 'override' AND status != 'storniert'
    `;

    const suggestions = await sqlPool`
      SELECT id, first_name, last_name, status, created_at, decided_at FROM fiaon_partner_suggestions
      WHERE agent_id = ${me} ORDER BY created_at DESC LIMIT 20
    `;

    res.json({
      ok: true,
      status,
      revenueCents: revenue,
      next: next ? { key: next.key, label: next.label, minCents: next.minCents, bonusBp: next.bonusBp, remainingCents: next.minCents - revenue } : null,
      thresholds: thresholds.map((t) => ({ ...t, prize: prizes[t.key] || null })),
      milestones,
      team: {
        members: Number(team[0].members),
        deals: Number(teamRevenue[0].deals),
        revenueCents: Math.max(0, Number(teamRevenue[0].revenue)),
        overrideCents: Number(myOverride[0].s),
      },
      suggestions,
    });
  } catch (err) {
    console.error("[FIAON-AGENT] partner-program:", err);
    res.status(500).json({ ok: false, error: "Serverfehler" });
  }
});

// Paket AE4: „Partner vorschlagen“ — erzeugt AUSSCHLIESSLICH eine Admin-Anfrage.
// BEWUSSTE DESIGN-ENTSCHEIDUNG: Es gibt KEINE Prämie/Bonus für das Vorschlagen
// selbst — der Werber profitiert ausschließlich über den umsatzbasierten
// Override (AE2), sobald der Geworbene tatsächlich verkauft.
router.post("/agent/partner-suggestions", requireAgent, async (req: AgentRequest, res) => {
  try {
    const { firstName, lastName, email, phone, reason } = req.body || {};
    if (!firstName || !lastName || !email) return res.status(400).json({ ok: false, error: "Vorname, Nachname und E-Mail erforderlich" });
    if (!EMAIL_RE.test(String(email).trim().toLowerCase())) return res.status(400).json({ ok: false, error: "E-Mail-Format ungültig" });
    const phoneNorm = phone ? normalizePhone(String(phone)) : "";
    if (phoneNorm === null) return res.status(400).json({ ok: false, error: "Telefonnummer ungültig" });
    // Doppelte offene Vorschläge für dieselbe E-Mail vermeiden
    const open = await sqlPool`
      SELECT id FROM fiaon_partner_suggestions WHERE LOWER(email) = ${String(email).trim().toLowerCase()} AND status = 'offen'
    `;
    if (open.length > 0) return res.status(409).json({ ok: false, error: "Für diese E-Mail liegt bereits ein offener Vorschlag vor" });
    const rows = await sqlPool`
      INSERT INTO fiaon_partner_suggestions (agent_id, first_name, last_name, email, phone, reason)
      VALUES (${req.agent!.id}, ${String(firstName).trim()}, ${String(lastName).trim()},
              ${String(email).trim().toLowerCase()}, ${phoneNorm || null}, ${reason ? String(reason).trim().slice(0, 2000) : null})
      RETURNING id, created_at
    `;
    await logAgentEvent(req.agent!.id, "partner_suggested", { suggestion_id: rows[0].id, email: String(email).trim().toLowerCase() });
    console.log(`[FIAON-PARTNER] Vorschlag #${rows[0].id} von Agent ${req.agent!.id}`);
    res.json({ ok: true, suggestion: rows[0] });
  } catch (err) {
    console.error("[FIAON-AGENT] partner-suggestion:", err);
    res.status(500).json({ ok: false, error: "Serverfehler" });
  }
});

// ═══════════════ AGENT: Skripte (I2) ═══════════════

router.get("/agent/scripts", requireAgent, async (_req: AgentRequest, res) => {
  try {
    await ensureAgentTables();
    const scripts = await sqlPool`
      SELECT id, title, category, content_html, file_name, file_mime, updated_at
      FROM fiaon_scripts WHERE active = TRUE AND deleted_at IS NULL
      ORDER BY category ASC, sort_order ASC, id ASC
    `;
    const settings = await getSettings();
    res.json({ ok: true, data: scripts, statusMap: JSON.parse(settings.script_status_map || "{}") });
  } catch (err) {
    console.error("[FIAON-AGENT] scripts:", err);
    res.status(500).json({ ok: false, error: "Serverfehler" });
  }
});

router.get("/agent/scripts/:id/file", requireAgent, async (req: AgentRequest, res) => {
  try {
    const rows = await sqlPool`
      SELECT file_data, file_name, file_mime FROM fiaon_scripts
      WHERE id = ${Number(req.params.id)} AND active = TRUE AND deleted_at IS NULL
    `;
    if (rows.length === 0 || !rows[0].file_data) return res.status(404).json({ ok: false, error: "Datei nicht gefunden" });
    const buf = Buffer.from(rows[0].file_data, "base64");
    res.setHeader("Content-Type", rows[0].file_mime || "application/pdf");
    res.setHeader("Content-Disposition", `inline; filename="${(rows[0].file_name || "skript.pdf").replace(/[^\w.\-]/g, "_")}"`);
    res.send(buf);
  } catch (err) {
    console.error("[FIAON-AGENT] script file:", err);
    res.status(500).json({ ok: false, error: "Serverfehler" });
  }
});

// ═══════════════ AGENT: Kalender (J1) ═══════════════

router.get("/agent/calendar", requireAgent, async (req: AgentRequest, res) => {
  try {
    const me = req.agent!.id;
    const from = req.query.from ? new Date(String(req.query.from)) : new Date(Date.now() - 14 * 24 * 3600 * 1000);
    const to = req.query.to ? new Date(String(req.query.to)) : new Date(Date.now() + 28 * 24 * 3600 * 1000);
    // Eigene Rückruf-Termine + Zahlungs-Zusagen; Überfälliges (bis 14 Tage) bleibt sichtbar
    const rows = await sqlPool`
      SELECT l.id, l.ref, l.outcome, l.scheduled_at, l.promised_date, l.done_at, l.note, l.created_at,
             a.first_name, a.last_name, a.contact_name, a.company_name, a.payment_status,
             a.phone, a.phone_country_code, a.contact_phone
      FROM fiaon_contact_log l
      JOIN fiaon_applications a ON a.ref = l.ref
      WHERE l.agent_id = ${me} AND l.done_at IS NULL
        AND (
          (l.scheduled_at IS NOT NULL AND l.scheduled_at BETWEEN ${from} AND ${to})
          OR (l.promised_date IS NOT NULL AND l.scheduled_at IS NULL AND l.promised_date BETWEEN ${from} AND ${to})
        )
      ORDER BY COALESCE(l.scheduled_at, l.promised_date) ASC
    `;
    res.json({ ok: true, data: rows });
  } catch (err) {
    console.error("[FIAON-AGENT] calendar:", err);
    res.status(500).json({ ok: false, error: "Serverfehler" });
  }
});

// Termin erledigen (aus Kalender) — erzeugt Log-Eintrag
router.post("/agent/calendar/:logId/done", requireAgent, async (req: AgentRequest, res) => {
  try {
    const rows = await sqlPool`
      UPDATE fiaon_contact_log SET done_at = NOW()
      WHERE id = ${Number(req.params.logId)} AND agent_id = ${req.agent!.id} AND done_at IS NULL
      RETURNING ref, scheduled_at, promised_date
    `;
    if (rows.length === 0) return res.status(404).json({ ok: false, error: "Termin nicht gefunden" });
    await logAction(rows[0].ref, req.agent!, "note", { note: "Termin als erledigt markiert" });
    res.json({ ok: true });
  } catch (err) {
    console.error("[FIAON-AGENT] calendar done:", err);
    res.status(500).json({ ok: false, error: "Serverfehler" });
  }
});

// Termin verschieben — erzeugt Log-Eintrag, Reminder wird erneut fällig
router.post("/agent/calendar/:logId/reschedule", requireAgent, async (req: AgentRequest, res) => {
  try {
    const newAt = req.body?.scheduledAt ? new Date(String(req.body.scheduledAt)) : null;
    if (!newAt || isNaN(newAt.getTime())) return res.status(400).json({ ok: false, error: "Neuer Zeitpunkt erforderlich" });
    const rows = await sqlPool`
      UPDATE fiaon_contact_log SET scheduled_at = ${newAt}, promised_date = CASE WHEN scheduled_at IS NULL THEN ${newAt} ELSE promised_date END, reminder_sent_at = NULL
      WHERE id = ${Number(req.params.logId)} AND agent_id = ${req.agent!.id} AND done_at IS NULL
      RETURNING ref
    `;
    if (rows.length === 0) return res.status(404).json({ ok: false, error: "Termin nicht gefunden" });
    await logAction(rows[0].ref, req.agent!, "note", { note: `Termin verschoben auf ${newAt.toLocaleString("de-DE")}` });
    res.json({ ok: true });
  } catch (err) {
    console.error("[FIAON-AGENT] calendar reschedule:", err);
    res.status(500).json({ ok: false, error: "Serverfehler" });
  }
});

export default router;
