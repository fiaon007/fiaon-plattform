// ═══════════════════════════════════════════════════════════════════
// FIAON Mitarbeiter-Portal (Rolle "Agent")
// - Eigener Login (bcrypt-Hash, HMAC-signiertes Cookie-Token, 12h)
// - Agent sieht AUSSCHLIESSLICH unbezahlte Kunden (pending_payment, claimed_paid)
// - Kontakt-Dokumentation: Notizen (append-only) + Kontakt-Ergebnisse + Termine
// - Ein-Klick-Mail via Make-Webhook `agent_payment_reminder` (10-Min-Sperre)
// - Jede Aktion wird mit Agent + Zeitstempel geloggt (Audit-Trail)
// - Serverseitige Rollentrennung: Agent-Token auf /admin-Routen ⇒ 403
// ═══════════════════════════════════════════════════════════════════

import { Router, type Request, type Response, type NextFunction } from "express";
import postgres from "postgres";
import bcrypt from "bcryptjs";
import { createHmac } from "crypto";
import PDFDocument from "pdfkit";
import { sendMakeWebhook, makePayloadFromRow } from "../make-webhook";
import { renderInvoicePdf, signInvoiceUrl, ensureInvoiceNumber } from "../fiaon-invoice";

const router = Router();
const sqlPool = postgres(process.env.DATABASE_URL!, { ssl: "require", max: 5 });

const AGENT_COOKIE = "fiaon_agent_token";
const TOKEN_TTL_MS = 12 * 60 * 60 * 1000; // 12h Schicht
const EMAIL_LOCK_MS = 10 * 60 * 1000; // 10-Minuten-Sperre pro Kunde

function agentSecret(): string {
  return process.env.SESSION_SECRET || "fiaon-dev-agent-secret";
}

// ── Tabellen (idempotent) ────────────────────────────────────────────────────
let tablesEnsured = false;
export async function ensureAgentTables(): Promise<void> {
  if (tablesEnsured) return;
  await sqlPool`
    CREATE TABLE IF NOT EXISTS fiaon_agents (
      id SERIAL PRIMARY KEY,
      name VARCHAR NOT NULL,
      email VARCHAR NOT NULL UNIQUE,
      password_hash VARCHAR NOT NULL,
      active BOOLEAN NOT NULL DEFAULT TRUE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;
  await sqlPool`
    CREATE TABLE IF NOT EXISTS fiaon_contact_log (
      id SERIAL PRIMARY KEY,
      ref VARCHAR NOT NULL,
      agent_id INTEGER,
      agent_name VARCHAR NOT NULL,
      type VARCHAR NOT NULL,            -- note | result | email_sent
      outcome VARCHAR,                  -- erreicht_zahlt_gleich | erreicht_zahlt_am | erreicht_abgelehnt | nicht_erreicht | mailbox | rueckruf_termin | nummer_falsch
      note TEXT,
      scheduled_at TIMESTAMPTZ,         -- Rückruf-/Termin-Zeitpunkt
      promised_date TIMESTAMPTZ,        -- "zahlt am [Datum]" / Zahlungs-Zusage
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;
  await sqlPool`CREATE INDEX IF NOT EXISTS fiaon_contact_log_ref_idx ON fiaon_contact_log(ref)`;
  tablesEnsured = true;
  console.log("[FIAON-AGENT] Agent-Tabellen sichergestellt");
}

// ── Token (HMAC-signiert, kein zusätzliches Paket nötig) ─────────────────────
function signAgentToken(agentId: number): string {
  const exp = Date.now() + TOKEN_TTL_MS;
  const payload = `${agentId}.${exp}`;
  const sig = createHmac("sha256", agentSecret()).update(`agent:${payload}`).digest("hex").slice(0, 40);
  return `${payload}.${sig}`;
}

function verifyAgentToken(token: string | undefined): number | null {
  if (!token) return null;
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const [idStr, expStr, sig] = parts;
  const exp = Number(expStr);
  if (!exp || exp < Date.now()) return null;
  const expected = createHmac("sha256", agentSecret()).update(`agent:${idStr}.${expStr}`).digest("hex").slice(0, 40);
  if (expected !== sig) return null;
  const id = Number(idStr);
  return Number.isInteger(id) && id > 0 ? id : null;
}

// ── Middleware ───────────────────────────────────────────────────────────────
interface AgentRequest extends Request {
  agent?: { id: number; name: string; email: string };
}

async function requireAgent(req: AgentRequest, res: Response, next: NextFunction) {
  try {
    await ensureAgentTables();
    const agentId = verifyAgentToken(req.cookies?.[AGENT_COOKIE]);
    if (!agentId) return res.status(401).json({ ok: false, error: "Nicht angemeldet" });
    const rows = await sqlPool`SELECT id, name, email, active FROM fiaon_agents WHERE id = ${agentId}`;
    if (rows.length === 0 || !rows[0].active) {
      return res.status(401).json({ ok: false, error: "Zugang deaktiviert" });
    }
    req.agent = { id: rows[0].id, name: rows[0].name, email: rows[0].email };
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

// ═══════════════ AGENT: Auth ═══════════════

router.post("/agent/login", async (req, res) => {
  try {
    await ensureAgentTables();
    const { email, password } = req.body || {};
    if (!email || !password) return res.status(400).json({ ok: false, error: "E-Mail und Passwort erforderlich" });
    const rows = await sqlPool`SELECT * FROM fiaon_agents WHERE LOWER(email) = ${String(email).trim().toLowerCase()}`;
    if (rows.length === 0 || !rows[0].active || !(await bcrypt.compare(password, rows[0].password_hash))) {
      return res.status(401).json({ ok: false, error: "Anmeldedaten ungültig oder Zugang deaktiviert" });
    }
    res.cookie(AGENT_COOKIE, signAgentToken(rows[0].id), {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      maxAge: TOKEN_TTL_MS,
      path: "/",
    });
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

// ═══════════════ AGENT: Kundenliste (NUR unbezahlte) ═══════════════

const AGENT_CUSTOMER_FIELDS = `
  ref, type, first_name, last_name, contact_name, company_name,
  COALESCE(NULLIF(email,''), NULLIF(contact_email,''), NULLIF(billing_email,'')) AS email,
  phone, phone_country_code, contact_phone,
  pack_name, pack_key, amount_due, currency, payment_reference, payment_status,
  payment_due_date, claimed_paid_at, promised_pay_date, agent_email_sent_at,
  invoice_number, created_at
`;

router.get("/agent/customers", requireAgent, async (_req: AgentRequest, res) => {
  try {
    // Sichtbarkeit: AUSSCHLIESSLICH pending_payment + claimed_paid (unbezahlt), keine merged-Altlasten.
    // paid/expired/cancelled verschwinden automatisch aus der Liste.
    const rows = await sqlPool.unsafe(`
      SELECT ${AGENT_CUSTOMER_FIELDS}
      FROM fiaon_applications
      WHERE payment_status IN ('pending_payment', 'claimed_paid')
        AND (merged_into IS NULL)
      ORDER BY (payment_status = 'claimed_paid') DESC, claimed_paid_at ASC NULLS LAST, created_at ASC
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
        WHERE ref = ANY(${refs}) AND scheduled_at IS NOT NULL AND scheduled_at > NOW() - INTERVAL '1 day'
        ORDER BY ref, scheduled_at ASC
      `;
      for (const a of appts) openAppointments[a.ref] = a.scheduled_at;
    }
    res.json({
      ok: true,
      data: rows.map((r: any) => ({
        ...r,
        last_contact: lastLogByRef[r.ref] || null,
        next_appointment: openAppointments[r.ref] || null,
      })),
    });
  } catch (err) {
    console.error("[FIAON-AGENT] customers:", err);
    res.status(500).json({ ok: false, error: "Serverfehler" });
  }
});

// Detail: Kunde + vollständige Kontakt-Historie
router.get("/agent/customers/:ref", requireAgent, async (req: AgentRequest, res) => {
  try {
    const rows = await sqlPool.unsafe(`
      SELECT ${AGENT_CUSTOMER_FIELDS}, street, zip, city
      FROM fiaon_applications
      WHERE ref = $1 AND payment_status IN ('pending_payment', 'claimed_paid') AND merged_into IS NULL
    `, [req.params.ref]);
    if (rows.length === 0) return res.status(404).json({ ok: false, error: "Kunde nicht gefunden oder bereits bezahlt" });
    const log = await sqlPool`
      SELECT id, type, outcome, note, agent_name, scheduled_at, promised_date, created_at
      FROM fiaon_contact_log WHERE ref = ${req.params.ref}
      ORDER BY created_at DESC
    `;
    res.json({ ok: true, data: rows[0], log });
  } catch (err) {
    console.error("[FIAON-AGENT] customer detail:", err);
    res.status(500).json({ ok: false, error: "Serverfehler" });
  }
});

// ═══════════════ AGENT: Notizen + Kontakt-Ergebnisse ═══════════════

// Freitext-Notiz (append-only: nach dem Speichern nicht editierbar — Audit-Sicherheit)
router.post("/agent/customers/:ref/notes", requireAgent, async (req: AgentRequest, res) => {
  try {
    const note = String(req.body?.note || "").trim();
    if (!note) return res.status(400).json({ ok: false, error: "Notiz darf nicht leer sein" });
    if (note.length > 4000) return res.status(400).json({ ok: false, error: "Notiz zu lang (max. 4000 Zeichen)" });
    const entry = await logAction(req.params.ref, req.agent!, "note", { note });
    res.json({ ok: true, entry });
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
    res.json({ ok: true, entry });
  } catch (err) {
    console.error("[FIAON-AGENT] contact-result:", err);
    res.status(500).json({ ok: false, error: "Serverfehler" });
  }
});

// ═══════════════ AGENT: Ein-Klick-Mail „Wie soeben besprochen" ═══════════════
// KEINE Direkt-Mail — feuert Make-Webhook `agent_payment_reminder` (eigener
// Router-Zweig + Brevo-Template in Make.com nötig, siehe MIGRATION_INVENTORY.md).

router.post("/agent/customers/:ref/send-payment-email", requireAgent, async (req: AgentRequest, res) => {
  try {
    // Doppelklick-/Spam-Schutz: 10-Minuten-Sperre pro Kunde (atomarer Claim)
    const claimed = await sqlPool`
      UPDATE fiaon_applications SET agent_email_sent_at = NOW()
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

// ═══════════════ ADMIN: Agent-Verwaltung + Audit-Trail ═══════════════
// (Auf /admin-Pfaden: blockAgentsFromAdmin verhindert Agent-Zugriff serverseitig.)

router.get("/admin/agents", async (_req, res) => {
  try {
    await ensureAgentTables();
    const agents = await sqlPool`SELECT id, name, email, active, created_at FROM fiaon_agents ORDER BY created_at ASC`;
    res.json({ ok: true, data: agents });
  } catch (err) {
    console.error("[FIAON-AGENT] admin list:", err);
    res.status(500).json({ ok: false, error: "Serverfehler" });
  }
});

router.post("/admin/agents", async (req, res) => {
  try {
    await ensureAgentTables();
    const { name, email, password } = req.body || {};
    if (!name || !email || !password) return res.status(400).json({ ok: false, error: "Name, E-Mail und Passwort erforderlich" });
    if (String(password).length < 8) return res.status(400).json({ ok: false, error: "Passwort: mindestens 8 Zeichen" });
    const hash = await bcrypt.hash(String(password), 10);
    const rows = await sqlPool`
      INSERT INTO fiaon_agents (name, email, password_hash)
      VALUES (${String(name).trim()}, ${String(email).trim().toLowerCase()}, ${hash})
      ON CONFLICT (email) DO NOTHING
      RETURNING id, name, email, active, created_at
    `;
    if (rows.length === 0) return res.status(409).json({ ok: false, error: "E-Mail bereits vergeben" });
    console.log(`[FIAON-AGENT] Zugang angelegt: ${rows[0].email}`);
    res.json({ ok: true, agent: rows[0] });
  } catch (err) {
    console.error("[FIAON-AGENT] admin create:", err);
    res.status(500).json({ ok: false, error: "Serverfehler" });
  }
});

router.post("/admin/agents/:id/toggle", async (req, res) => {
  try {
    const rows = await sqlPool`
      UPDATE fiaon_agents SET active = NOT active WHERE id = ${Number(req.params.id)}
      RETURNING id, name, email, active
    `;
    if (rows.length === 0) return res.status(404).json({ ok: false, error: "Agent nicht gefunden" });
    res.json({ ok: true, agent: rows[0] });
  } catch (err) {
    console.error("[FIAON-AGENT] admin toggle:", err);
    res.status(500).json({ ok: false, error: "Serverfehler" });
  }
});

router.post("/admin/agents/:id/reset-password", async (req, res) => {
  try {
    const { password } = req.body || {};
    if (!password || String(password).length < 8) return res.status(400).json({ ok: false, error: "Passwort: mindestens 8 Zeichen" });
    const hash = await bcrypt.hash(String(password), 10);
    const rows = await sqlPool`
      UPDATE fiaon_agents SET password_hash = ${hash} WHERE id = ${Number(req.params.id)}
      RETURNING id, name, email
    `;
    if (rows.length === 0) return res.status(404).json({ ok: false, error: "Agent nicht gefunden" });
    res.json({ ok: true });
  } catch (err) {
    console.error("[FIAON-AGENT] admin reset-password:", err);
    res.status(500).json({ ok: false, error: "Serverfehler" });
  }
});

// Audit-Trail: alle Agent-Aktionen (optional gefiltert nach ref/agent)
router.get("/admin/agent-log", async (req, res) => {
  try {
    await ensureAgentTables();
    const ref = req.query.ref ? String(req.query.ref) : null;
    const rows = ref
      ? await sqlPool`SELECT * FROM fiaon_contact_log WHERE ref = ${ref} ORDER BY created_at DESC LIMIT 500`
      : await sqlPool`SELECT * FROM fiaon_contact_log ORDER BY created_at DESC LIMIT 500`;
    res.json({ ok: true, data: rows });
  } catch (err) {
    console.error("[FIAON-AGENT] admin log:", err);
    res.status(500).json({ ok: false, error: "Serverfehler" });
  }
});

export default router;
