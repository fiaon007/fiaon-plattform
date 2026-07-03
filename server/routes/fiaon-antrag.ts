import { Router } from "express";
import { db } from "../db";
import { fiaonApplications, fiaonClickEvents } from "@shared/schema";
import { eq } from "drizzle-orm";
import PDFDocument from "pdfkit";
import { ZipArchive } from "archiver";
import postgres from "postgres";
import Stripe from "stripe";
import multer from "multer";
import { randomBytes } from "crypto";
import { sendPaymentConfirmedEmail } from "../email/fiaon-payment-emails";
import { sendMakeWebhook, makePayloadFromRow } from "../make-webhook";

const router = Router();

// In-memory store for identity-verify tokens (15 min TTL)
const verifyTokens = new Map<string, { ref: string; expiresAt: number }>();
setInterval(() => {
  const now = Date.now();
  verifyTokens.forEach((v, k) => { if (v.expiresAt < now) verifyTokens.delete(k); });
}, 60_000);

// Configure multer for KYC document uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 25 * 1024 * 1024, // 25MB max per file
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'application/pdf') {
      cb(null, true);
    } else {
      cb(new Error('Only PDF files are allowed'));
    }
  },
});

// Create a single postgres connection pool for direct SQL queries
const sqlPool = postgres(process.env.DATABASE_URL!, { ssl: 'require', max: 10 });

// Initialize Stripe — nur noch für Legacy-Admin-Analytics (Umsatzhistorie, lesend).
// Sobald STRIPE_SECRET_KEY aus dem Deployment entfernt ist, ist stripe = null.
const stripe = process.env.STRIPE_SECRET_KEY 
  ? new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: '2023-10-16' as any })
  : null;

// ═══════════════════════════════════════════════════════════════════
// ZAHLUNG PER BANKÜBERWEISUNG (VORKASSE) — ersetzt Stripe komplett
// Siehe MIGRATION_INVENTORY.md
// ═══════════════════════════════════════════════════════════════════

export const FIAON_BANK_DETAILS = {
  recipient: "Fiaon Ltd",
  iban: "BE09905892763957",
  ibanDisplay: "BE09 9058 9276 3957",
  bic: "TRWIBEB1XXX",
};

// Serverseitige Preisliste — Beträge werden NIE vom Client übernommen.
const PACK_PRICES: Record<string, number> = {
  // Privat
  start: 7.99, pro: 59.99, ultra: 79.99, highend: 99.99,
  // Business
  business_starter: 49.99, business_pro: 99.99, business_ultra: 149.99, business_enterprise: 249.99,
};
const SCHUFA_PRICE = 74.0;
const PAYMENT_DUE_DAYS = 7;

// Zeichensatz ohne verwechselbare Zeichen: keine 0, 1, O, I, L
const PAYMENT_REF_CHARSET = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";

function randomPaymentCode(len = 6): string {
  const bytes = randomBytes(len);
  let out = "";
  for (let i = 0; i < len; i++) out += PAYMENT_REF_CHARSET[bytes[i] % PAYMENT_REF_CHARSET.length];
  return out;
}

async function generateUniquePaymentReference(): Promise<string> {
  for (let attempt = 0; attempt < 10; attempt++) {
    const candidate = `FIAON-${randomPaymentCode(6)}`;
    const existing = await sqlPool`SELECT 1 FROM fiaon_applications WHERE payment_reference = ${candidate} LIMIT 1`;
    if (existing.length === 0) return candidate;
  }
  throw new Error("Konnte keine eindeutige Zahlungsreferenz erzeugen");
}

// Auto-Migration der neuen Zahlungsspalten (idempotent)
let paymentColumnsEnsured = false;
async function ensurePaymentColumns(): Promise<void> {
  if (paymentColumnsEnsured) return;
  await sqlPool`
    ALTER TABLE fiaon_applications
    ADD COLUMN IF NOT EXISTS payment_reference VARCHAR,
    ADD COLUMN IF NOT EXISTS payment_due_date TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS amount_due NUMERIC(10,2),
    ADD COLUMN IF NOT EXISTS currency VARCHAR DEFAULT 'EUR',
    ADD COLUMN IF NOT EXISTS reminder_sent_at_24h TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS reminder_sent_at_72h TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS claimed_paid_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS welcome_sent_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS payment_email_sent_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS followup_sent_at TIMESTAMPTZ;
  `;
  await sqlPool`CREATE UNIQUE INDEX IF NOT EXISTS fiaon_app_payment_ref_idx ON fiaon_applications(payment_reference)`;
  paymentColumnsEnsured = true;
  console.log("[FIAON-PAYMENT] Zahlungsspalten sichergestellt");
}

function orderInfoFromRow(row: any) {
  return {
    email: row.email || row.contact_email || row.billing_email || "",
    firstName: row.first_name || row.contact_name?.split(" ")[0] || "",
    paymentReference: row.payment_reference,
    amountDue: String(row.amount_due),
    dueDate: new Date(row.payment_due_date),
    packName: row.pack_name,
  };
}

// Bestellung anlegen (nach Antragsabschluss). Idempotent pro ref.
// kind: "activation" (Standard, Betrag aus Paket) | "schufa" (74 € Einmalzahlung, eigene Bestellzeile)
router.post("/payment-order", async (req, res) => {
  try {
    await ensurePaymentColumns();
    const { ref: refInput, kind, email, firstName, lastName } = req.body || {};
    let ref: string | null = refInput || null;

    if (kind === "schufa") {
      // SCHUFA/Bonitätsauskunft: eigene Bestellzeile, unabhängig vom ABO
      ref = `FIAON-SCHUFA-${Date.now().toString(36).toUpperCase()}-${randomPaymentCode(4)}`;
      await sqlPool`
        INSERT INTO fiaon_applications (ref, type, status, first_name, last_name, email, pack_name, created_at, updated_at)
        VALUES (${ref}, 'schufa', 'submitted', ${firstName ?? null}, ${lastName ?? null}, ${email ?? null}, 'Bonitätsauskunft inkl. Handlungsplan', NOW(), NOW())
      `;
    }

    if (!ref) return res.status(400).json({ ok: false, error: "ref fehlt" });

    const rows = await sqlPool`
      SELECT ref, type, pack_key, pack_name, first_name, contact_name, email, contact_email, billing_email,
             payment_reference, payment_status, payment_due_date, amount_due, currency
      FROM fiaon_applications WHERE ref = ${ref} LIMIT 1
    `;
    if (rows.length === 0) return res.status(404).json({ ok: false, error: "Antrag nicht gefunden" });
    const app = rows[0];

    // Idempotenz: bestehende offene/gemeldete/bezahlte Bestellung wiederverwenden
    if (app.payment_reference && ["pending_payment", "claimed_paid", "paid"].includes(app.payment_status)) {
      return res.json({ ok: true, paymentReference: app.payment_reference, existing: true });
    }

    const amount = app.type === "schufa" ? SCHUFA_PRICE : PACK_PRICES[app.pack_key];
    if (!amount) return res.status(400).json({ ok: false, error: `Unbekanntes Paket: ${app.pack_key}` });

    const paymentReference = app.payment_reference || (await generateUniquePaymentReference());
    const dueDate = new Date(Date.now() + PAYMENT_DUE_DAYS * 24 * 60 * 60 * 1000);

    await sqlPool`
      UPDATE fiaon_applications SET
        payment_reference = ${paymentReference},
        payment_status = 'pending_payment',
        payment_due_date = ${dueDate},
        amount_due = ${amount.toFixed(2)},
        currency = 'EUR',
        reminder_sent_at_24h = NULL,
        reminder_sent_at_72h = NULL,
        updated_at = NOW()
      WHERE ref = ${ref}
    `;

    console.log(`[FIAON-PAYMENT] Bestellung angelegt: ${paymentReference} (ref=${ref}, ${amount.toFixed(2)} EUR, fällig ${dueDate.toISOString()})`);

    // Make-Webhook 'payment_details' — genau einmal beim Übergang nach pending_payment.
    // Atomarer Flag-Claim verhindert Doppelversand; Fehler blockieren den Flow nicht.
    try {
      const claimed = await sqlPool`
        UPDATE fiaon_applications SET payment_email_sent_at = NOW()
        WHERE ref = ${ref} AND payment_email_sent_at IS NULL
        RETURNING ref, first_name, last_name, contact_name, email, contact_email, billing_email, pack_name, payment_reference, amount_due
      `;
      if (claimed.length > 0) sendMakeWebhook("payment_details", makePayloadFromRow(claimed[0])).catch(() => {});
    } catch (whErr) {
      console.error("[MAKE-WEBHOOK] payment_details claim:", whErr);
    }

    res.json({ ok: true, paymentReference });
  } catch (err) {
    console.error("[FIAON-PAYMENT] payment-order:", err);
    res.status(500).json({ ok: false, error: "Bestellung konnte nicht angelegt werden" });
  }
});

// Öffentliche Zahlungsdaten für /zahlung/[payment_reference] — kein Login nötig,
// keine sensiblen Kundendaten außer Vorname.
router.get("/payment-order/:paymentRef", async (req, res) => {
  try {
    await ensurePaymentColumns();
    const rows = await sqlPool`
      SELECT payment_reference, payment_status, payment_due_date, amount_due, currency, first_name, pack_name
      FROM fiaon_applications WHERE payment_reference = ${req.params.paymentRef} LIMIT 1
    `;
    if (rows.length === 0) return res.status(404).json({ ok: false, error: "Bestellung nicht gefunden" });
    const r = rows[0];
    res.json({
      ok: true,
      paymentReference: r.payment_reference,
      status: r.payment_status,
      dueDate: r.payment_due_date,
      amountDue: String(r.amount_due),
      currency: r.currency || "EUR",
      firstName: r.first_name || "",
      packName: r.pack_name || "",
      bank: FIAON_BANK_DETAILS,
    });
  } catch (err) {
    console.error("[FIAON-PAYMENT] payment-order/:ref:", err);
    res.status(500).json({ ok: false, error: "Serverfehler" });
  }
});

// ── Admin: Zahlungsverwaltung (manuelle Freischaltung) ──────────────

router.get("/admin/payments", async (req, res) => {
  try {
    await ensurePaymentColumns();
    const allowed = ["pending_payment", "claimed_paid", "expired"];
    const status = allowed.includes(String(req.query.status)) ? String(req.query.status) : "pending_payment";
    const rows = await sqlPool`
      SELECT ref, type, payment_reference, payment_status, payment_due_date, amount_due, currency,
             first_name, last_name, contact_name, company_name, email, contact_email, billing_email,
             pack_name, updated_at, created_at,
             reminder_sent_at_24h, reminder_sent_at_72h, claimed_paid_at
      FROM fiaon_applications
      WHERE payment_status = ${status} AND payment_reference IS NOT NULL
      ORDER BY payment_due_date ASC NULLS LAST
    `;
    res.json({ ok: true, data: rows });
  } catch (err) {
    console.error("[FIAON-PAYMENT] admin/payments:", err);
    res.status(500).json({ ok: false, error: "Serverfehler" });
  }
});

// Kunde meldet "Ich habe die Überweisung getätigt" — reines Tracking.
// KRITISCH: Löst NIEMALS Freischaltung oder Willkommensmail aus.
router.post("/payment-order/:paymentRef/claim-paid", async (req, res) => {
  try {
    await ensurePaymentColumns();
    const rows = await sqlPool`
      UPDATE fiaon_applications SET
        payment_status = 'claimed_paid',
        claimed_paid_at = COALESCE(claimed_paid_at, NOW()),
        updated_at = NOW()
      WHERE payment_reference = ${req.params.paymentRef}
        AND payment_status IN ('pending_payment', 'claimed_paid')
      RETURNING payment_reference
    `;
    if (rows.length === 0) return res.status(404).json({ ok: false, error: "Bestellung nicht gefunden oder bereits abgeschlossen" });
    console.log(`[FIAON-PAYMENT] Zahlung gemeldet (claimed_paid): ${req.params.paymentRef}`);
    res.json({ ok: true });
  } catch (err) {
    console.error("[FIAON-PAYMENT] claim-paid:", err);
    res.status(500).json({ ok: false, error: "Serverfehler" });
  }
});

// Forecast-Kennzahlen: offen / erwartet (unbestätigt) / bestätigt + Bestätigungsquote
router.get("/admin/payments/stats", async (_req, res) => {
  try {
    await ensurePaymentColumns();
    const [stats] = await sqlPool`
      SELECT
        COUNT(*) FILTER (WHERE payment_status = 'pending_payment')                      AS pending_count,
        COALESCE(SUM(amount_due) FILTER (WHERE payment_status = 'pending_payment'), 0)  AS pending_sum,
        COUNT(*) FILTER (WHERE payment_status = 'claimed_paid')                         AS claimed_count,
        COALESCE(SUM(amount_due) FILTER (WHERE payment_status = 'claimed_paid'), 0)     AS claimed_sum,
        COUNT(*) FILTER (WHERE payment_status = 'paid')                                 AS paid_count,
        COALESCE(SUM(amount_due) FILTER (WHERE payment_status = 'paid'), 0)             AS paid_sum,
        COUNT(*) FILTER (WHERE claimed_paid_at IS NOT NULL)                             AS claims_total,
        COUNT(*) FILTER (WHERE claimed_paid_at IS NOT NULL AND payment_status = 'paid') AS claims_confirmed
      FROM fiaon_applications
      WHERE payment_reference IS NOT NULL
    `;
    const claimsTotal = Number(stats.claims_total);
    res.json({
      ok: true,
      pending: { count: Number(stats.pending_count), sum: Number(stats.pending_sum) },
      claimed: { count: Number(stats.claimed_count), sum: Number(stats.claimed_sum) },
      paid: { count: Number(stats.paid_count), sum: Number(stats.paid_sum) },
      confirmationRate: claimsTotal > 0 ? Math.round((Number(stats.claims_confirmed) / claimsTotal) * 100) : null,
    });
  } catch (err) {
    console.error("[FIAON-PAYMENT] admin/payments/stats:", err);
    res.status(500).json({ ok: false, error: "Serverfehler" });
  }
});

// Als bezahlt markieren → Freischaltung (Logik des früheren Stripe-Webhooks) + Willkommensmail
router.post("/admin/payments/:paymentRef/mark-paid", async (req, res) => {
  try {
    await ensurePaymentColumns();
    const rows = await sqlPool`
      UPDATE fiaon_applications SET
        payment_status = 'paid',
        status = 'payment_completed',
        completed_at = COALESCE(completed_at, NOW()),
        updated_at = NOW()
      WHERE payment_reference = ${req.params.paymentRef}
      RETURNING ref, payment_reference, payment_due_date, amount_due, first_name, contact_name, email, contact_email, billing_email, pack_name
    `;
    if (rows.length === 0) return res.status(404).json({ ok: false, error: "Bestellung nicht gefunden" });

    console.log(`[FIAON-PAYMENT] Als bezahlt markiert: ${req.params.paymentRef} (ref=${rows[0].ref})`);
    sendPaymentConfirmedEmail(orderInfoFromRow(rows[0])).catch(() => {});
    res.json({ ok: true, data: rows[0] });
  } catch (err) {
    console.error("[FIAON-PAYMENT] mark-paid:", err);
    res.status(500).json({ ok: false, error: "Serverfehler" });
  }
});

// Abgelaufene Bestellung reaktivieren: neue 7-Tage-Frist + Template 1 erneut
router.post("/admin/payments/:paymentRef/reactivate", async (req, res) => {
  try {
    await ensurePaymentColumns();
    const dueDate = new Date(Date.now() + PAYMENT_DUE_DAYS * 24 * 60 * 60 * 1000);
    const rows = await sqlPool`
      UPDATE fiaon_applications SET
        payment_status = 'pending_payment',
        payment_due_date = ${dueDate},
        reminder_sent_at_24h = NULL,
        reminder_sent_at_72h = NULL,
        updated_at = NOW()
      WHERE payment_reference = ${req.params.paymentRef} AND payment_status = 'expired'
      RETURNING ref, payment_reference, payment_due_date, amount_due, first_name, contact_name, email, contact_email, billing_email, pack_name
    `;
    if (rows.length === 0) return res.status(404).json({ ok: false, error: "Keine abgelaufene Bestellung mit dieser Referenz gefunden" });

    console.log(`[FIAON-PAYMENT] Reaktiviert: ${req.params.paymentRef} (neue Frist ${dueDate.toISOString()})`);
    // Neue Frist → Make erneut informieren (payment_details) + Follow-up-Zyklus zurücksetzen
    await sqlPool`
      UPDATE fiaon_applications SET payment_email_sent_at = NOW(), followup_sent_at = NULL
      WHERE payment_reference = ${req.params.paymentRef}
    `;
    sendMakeWebhook("payment_details", makePayloadFromRow(rows[0])).catch(() => {});
    res.json({ ok: true, data: rows[0] });
  } catch (err) {
    console.error("[FIAON-PAYMENT] reactivate:", err);
    res.status(500).json({ ok: false, error: "Serverfehler" });
  }
});

// ── Reminder & Ablauf (24h / 72h / expired) ─────────────────────────

// Direkte 24h/72h-Reminder-Mails wurden entfernt — Follow-up-Mails laufen über Make ('followup_48h').
async function runPaymentReminders(): Promise<{ expired: number; followupsSent: number }> {
  await ensurePaymentColumns();
  const result = { expired: 0, followupsSent: 0 };

  // 1) Abgelaufene Bestellungen schließen
  const expiredRows = await sqlPool`
    UPDATE fiaon_applications SET payment_status = 'expired', updated_at = NOW()
    WHERE payment_status = 'pending_payment' AND payment_due_date < NOW()
    RETURNING payment_reference
  `;
  result.expired = expiredRows.length;
  if (expiredRows.length) console.log(`[FIAON-PAYMENT] Abgelaufen: ${expiredRows.map((r: any) => r.payment_reference).join(", ")}`);

  // 2) Make-Webhook 'followup_48h': unbestätigte Zahlungen (pending_payment ODER claimed_paid),
  //    älter als 48h (Bestellzeitpunkt = due_date minus 7 Tage, d. h. due_date < NOW() + 5 Tage),
  //    noch kein Follow-up gesendet. Atomarer Flag-Claim verhindert Doppelversand.
  const followupRows = await sqlPool`
    UPDATE fiaon_applications SET followup_sent_at = NOW(), updated_at = NOW()
    WHERE payment_status IN ('pending_payment', 'claimed_paid')
      AND followup_sent_at IS NULL
      AND payment_due_date < NOW() + INTERVAL '5 days'
    RETURNING ref, payment_reference, amount_due, first_name, last_name, contact_name, email, contact_email, billing_email, pack_name
  `;
  for (const r of followupRows) {
    await sendMakeWebhook("followup_48h", makePayloadFromRow(r));
    result.followupsSent++;
  }

  return result;
}

// Stündlicher Reminder-Lauf (fail-safe)
setInterval(() => {
  runPaymentReminders().catch((err) => console.error("[FIAON-PAYMENT] Reminder-Cron:", err));
}, 60 * 60 * 1000);

// Manueller Trigger für Tests / Admin
router.post("/admin/payments/run-reminders", async (_req, res) => {
  try {
    const result = await runPaymentReminders();
    res.json({ ok: true, ...result });
  } catch (err) {
    console.error("[FIAON-PAYMENT] run-reminders:", err);
    res.status(500).json({ ok: false, error: "Serverfehler" });
  }
});

// ── Stillgelegte Stripe-Endpoints (410 Gone, nicht 500) ─────────────

router.post("/create-payment-intent", (_req, res) => {
  res.status(410).json({
    error: "Kartenzahlung wurde eingestellt. Aktivierung erfolgt per Banküberweisung – Zugang nach Zahlungseingang.",
    gone: true,
  });
});

// Stillgelegter Stripe-Webhook — Zahlungseingang wird jetzt manuell über
// /admin/payments (mark-paid) verbucht. 410 Gone statt 500.
router.post("/stripe-webhook", (_req, res) => {
  res.status(410).json({
    error: "Stripe-Integration wurde eingestellt. Aktivierung erfolgt per Banküberweisung.",
    gone: true,
  });
});

// Track click events
router.post("/track", async (req, res) => {
  try {
    const { event, data, ref, sessionId, page } = req.body;
    const ip = (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() || req.socket.remoteAddress || "";
    await db.insert(fiaonClickEvents).values({
      event, data, applicationRef: ref || null, sessionId: sessionId || null, page: page || null, ip, userAgent: req.headers["user-agent"] || "",
    });
    res.json({ ok: true });
  } catch (err) {
    console.error("[FIAON-TRACK]", err);
    res.json({ ok: false });
  }
});

// Save/update application
router.post("/application", async (req, res) => {
  try {
    console.log("[FIAON-APP] Received application save request. Body keys:", Object.keys(req.body), "password in body:", 'password' in req.body, "password value:", req.body.password);

    // Neue Zahlungs-/Webhook-Spalten müssen vor dem Drizzle-SELECT existieren
    await ensurePaymentColumns();
    
    const { 
      ref, type, status, currentStep, packKey, packName, 
      // Private customer fields
      firstName, lastName, birthDay, birthMonth, birthYear, phone, phoneCountryCode, street, zip, city, country, nationality, employment, employer, employedSince, income, rent, debts, housing,
      // Password for login
      password,
      // Business customer fields
      companyName, legalForm, taxId, establishedYear, contactFirstName, contactLastName, contactEmail, contactPhone, businessType, industry, annualRevenue, employees, monthlyExpenses, billingEmail,
      // Common fields
      wantedLimit, purpose, billing, addon, nfc, approvedLimit, email, iban, billingMethod, salaryReceiptDay, ag1, ag2, ag3 
    } = req.body;
    
    const ip = (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() || req.socket.remoteAddress || "";
    const birthdate = birthDay && birthMonth && birthYear ? `${birthYear}-${String(birthMonth).padStart(2, "0")}-${String(birthDay).padStart(2, "0")}` : null;
    const contactName = contactFirstName && contactLastName ? `${contactFirstName} ${contactLastName}` : contactFirstName || contactLastName || null;

    // Auto-run migration for new fields if they don't exist
    try {
      const sql = postgres(process.env.DATABASE_URL!, { ssl: 'require' });
      const columns = await sql`
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_name = 'fiaon_applications' 
        AND table_schema = 'public'
        AND column_name IN ('phone_country_code', 'salary_receipt_day', 'password')
      `;
      
      const columnNames = columns.map(c => c.column_name);
      console.log("[FIAON-APP] Existing columns:", columnNames);
      
      const needsMigration = !columnNames.includes('phone_country_code') || 
                             !columnNames.includes('salary_receipt_day') || 
                             !columnNames.includes('password');
      
      if (needsMigration) {
        console.log("[FIAON-APP] Running auto-migration for phoneCountryCode, salaryReceiptDay, and password...");
        await sql`
          ALTER TABLE fiaon_applications 
          ADD COLUMN IF NOT EXISTS phone_country_code VARCHAR,
          ADD COLUMN IF NOT EXISTS salary_receipt_day VARCHAR,
          ADD COLUMN IF NOT EXISTS password VARCHAR;
        `;
        console.log("[FIAON-APP] Auto-migration completed successfully");
      }
      await sql.end();
    } catch (migrateErr) {
      console.error("[FIAON-APP] Auto-migration failed:", migrateErr);
      // Continue with the application save even if migration fails
    }

    // Auto-run migration for business fields if type is business
    if (type === "business") {
      try {
        const sql = postgres(process.env.DATABASE_URL!, { ssl: 'require' });
        const columns = await sql`
          SELECT column_name 
          FROM information_schema.columns 
          WHERE table_name = 'fiaon_applications' 
          AND table_schema = 'public'
          AND column_name = 'company_name'
        `;
        
        if (columns.length === 0) {
          console.log("[FIAON-APP] Running auto-migration for business fields...");
          await sql`
            ALTER TABLE fiaon_applications 
            ADD COLUMN IF NOT EXISTS company_name VARCHAR,
            ADD COLUMN IF NOT EXISTS legal_form VARCHAR,
            ADD COLUMN IF NOT EXISTS tax_id VARCHAR,
            ADD COLUMN IF NOT EXISTS established_year VARCHAR,
            ADD COLUMN IF NOT EXISTS contact_name VARCHAR,
            ADD COLUMN IF NOT EXISTS contact_email VARCHAR,
            ADD COLUMN IF NOT EXISTS contact_phone VARCHAR,
            ADD COLUMN IF NOT EXISTS business_type VARCHAR,
            ADD COLUMN IF NOT EXISTS industry VARCHAR,
            ADD COLUMN IF NOT EXISTS annual_revenue INTEGER,
            ADD COLUMN IF NOT EXISTS employees INTEGER,
            ADD COLUMN IF NOT EXISTS monthly_expenses INTEGER,
            ADD COLUMN IF NOT EXISTS billing_email VARCHAR;
          `;
          await sql`
            CREATE INDEX IF NOT EXISTS fiaon_app_type_idx ON fiaon_applications(type);
          `;
          console.log("[FIAON-APP] Auto-migration completed successfully");
        }
        await sql.end();
      } catch (migrateErr) {
        console.error("[FIAON-APP] Auto-migration failed:", migrateErr);
        // Continue with the application save even if migration fails
      }
    }

    // Try update first
    const existing = await db.select().from(fiaonApplications).where(eq(fiaonApplications.ref, ref)).limit(1);
    
    const values: any = {
      ref, type: type || "private", status: status || "started", currentStep: currentStep || 0,
      packKey, packName,
      // Private customer fields
      firstName, lastName, birthdate, phone, phoneCountryCode, street, zip, city, country, nationality,
      employment, employer, employedSince, income: income || null, rent: rent || null, debts: debts || null, housing,
      // Password for login
      password,
      // Business customer fields
      companyName, legalForm, taxId, establishedYear, contactName, contactEmail, contactPhone, businessType, industry, annualRevenue: annualRevenue || null, employees: employees || null, monthlyExpenses: monthlyExpenses || null, billingEmail,
      // Common fields
      wantedLimit: wantedLimit || null, purpose, billing, addon, nfc,
      approvedLimit: approvedLimit || null, email, iban, billingMethod, salaryReceiptDay,
      consentAgb: ag1 || false, consentSchufa: ag2 || false, consentContract: ag3 || false,
      ip, userAgent: req.headers["user-agent"] || "",
      updatedAt: new Date(),
    };

    console.log("[FIAON-APP] Saving application with ref:", ref, "status:", status, "password length:", password?.length, "email:", email);

    if (existing.length > 0) {
      console.log("[FIAON-APP] Updating existing application via direct SQL only to prevent password overwrite");
      
      // Use direct SQL for ALL fields to prevent Drizzle from overwriting password
      // Convert undefined to null to avoid UNDEFINED_VALUE error
      await sqlPool`
        UPDATE fiaon_applications 
        SET 
          type = ${values.type ?? null},
          status = ${values.status ?? null},
          current_step = ${values.currentStep ?? null},
          pack_key = ${values.packKey ?? null},
          pack_name = ${values.packName ?? null},
          first_name = COALESCE(NULLIF(${values.firstName ?? ''}, ''), first_name),
          last_name = COALESCE(NULLIF(${values.lastName ?? ''}, ''), last_name),
          birthdate = ${values.birthdate ?? null},
          phone = ${values.phone ?? null},
          phone_country_code = ${values.phoneCountryCode ?? null},
          street = ${values.street ?? null},
          zip = ${values.zip ?? null},
          city = ${values.city ?? null},
          country = ${values.country ?? null},
          nationality = ${values.nationality ?? null},
          employment = ${values.employment ?? null},
          employer = ${values.employer ?? null},
          employed_since = ${values.employedSince ?? null},
          income = ${values.income ?? null},
          rent = ${values.rent ?? null},
          debts = ${values.debts ?? null},
          housing = ${values.housing ?? null},
          password = ${password ?? null},
          company_name = ${values.companyName ?? null},
          legal_form = ${values.legalForm ?? null},
          tax_id = ${values.taxId ?? null},
          established_year = ${values.establishedYear ?? null},
          contact_name = ${values.contactName ?? null},
          contact_email = ${values.contactEmail ?? null},
          contact_phone = ${values.contactPhone ?? null},
          business_type = ${values.businessType ?? null},
          industry = ${values.industry ?? null},
          annual_revenue = ${values.annualRevenue ?? null},
          employees = ${values.employees ?? null},
          monthly_expenses = ${values.monthlyExpenses ?? null},
          billing_email = ${values.billingEmail ?? null},
          wanted_limit = ${values.wantedLimit ?? null},
          purpose = ${values.purpose ?? null},
          billing = ${values.billing ?? null},
          addon = ${values.addon ?? null},
          nfc = ${values.nfc ?? null},
          approved_limit = ${values.approvedLimit ?? null},
          email = COALESCE(NULLIF(${values.email ?? ''}, ''), email),
          iban = ${values.iban ?? null},
          billing_method = ${values.billingMethod ?? null},
          salary_receipt_day = ${values.salaryReceiptDay ?? null},
          consent_agb = ${values.consentAgb ?? null},
          consent_schufa = ${values.consentSchufa ?? null},
          consent_contract = ${values.consentContract ?? null},
          ip = ${values.ip ?? null},
          user_agent = ${values.userAgent ?? null},
          updated_at = ${values.updatedAt ?? null},
          utm = ${JSON.stringify({ password })}::jsonb
        WHERE ref = ${ref}
      `;
      console.log("[FIAON-APP] Direct SQL update completed");
      
      // Verify password was actually saved in utm field
      const verify = await sqlPool`SELECT utm, email, status FROM fiaon_applications WHERE ref = ${ref}`;
      console.log("[FIAON-APP] Password verification query result:", verify);
    } else {
      console.log("[FIAON-APP] Inserting new application");
      await db.insert(fiaonApplications).values(values);
      console.log("[FIAON-APP] Insert completed");
      
      // Direct SQL update for password to ensure it's saved in utm field
      if (password) {
        await sqlPool`UPDATE fiaon_applications SET utm = ${JSON.stringify({ password })}::jsonb, status = ${status}, email = ${email} WHERE ref = ${ref}`;
        console.log("[FIAON-APP] Password updated via direct SQL after insert in utm field");
        
        const verify = await sqlPool`SELECT utm, email, status FROM fiaon_applications WHERE ref = ${ref}`;
        console.log("[FIAON-APP] Password verification query result:", verify);
      }
    }

    // Make-Webhook 'welcome' — genau einmal, sobald der E-Mail-Schritt abgeschlossen ist
    // (erste Speicherung mit E-Mail-Adresse). Atomarer Flag-Claim: Vor/Zurück-Navigation
    // oder parallele Saves lösen NICHT erneut aus. Fehler blockieren den Antrag nicht.
    try {
      await ensurePaymentColumns();
      const claimed = await sqlPool`
        UPDATE fiaon_applications SET welcome_sent_at = NOW()
        WHERE ref = ${ref} AND welcome_sent_at IS NULL
          AND COALESCE(NULLIF(email, ''), NULLIF(contact_email, ''), NULLIF(billing_email, '')) IS NOT NULL
        RETURNING ref, first_name, last_name, contact_name, email, contact_email, billing_email, pack_name, payment_reference, amount_due
      `;
      if (claimed.length > 0) sendMakeWebhook("welcome", makePayloadFromRow(claimed[0])).catch(() => {});
    } catch (whErr) {
      console.error("[MAKE-WEBHOOK] welcome claim:", whErr);
    }

    res.json({ ok: true, ref });
  } catch (err) {
    console.error("[FIAON-APP]", err);
    res.status(500).json({ ok: false, error: String(err) });
  }
});

// Login endpoint for fiaon applications
router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    
    console.log("[FIAON-LOGIN] Login attempt for email:", email, "password length:", password?.length);
    
    if (!email || !password) {
      return res.status(400).json({ ok: false, error: "Email und Passwort erforderlich" });
    }
    
    // Find application by email using direct SQL with same pool as save
    const apps = await sqlPool`SELECT *, utm::text as utm_string FROM fiaon_applications WHERE email = ${email} ORDER BY created_at DESC LIMIT 1`;
    
    console.log("[FIAON-LOGIN] Found apps:", apps.length);
    
    if (apps.length === 0) {
      return res.status(401).json({ ok: false, error: "Ungültige Anmeldedaten" });
    }
    
    const app = apps[0];
    console.log("[FIAON-LOGIN] RAW DB ROW:", JSON.stringify(app));
    
    // Extract password from utm JSON field with brute-force parsing
    let storedPassword = null;

    if (app.password) {
      storedPassword = app.password;
    } else {
      // Nutze den garantierten Text-String aus der DB
      const rawUtmData = app.utm_string || app.utm;

      if (rawUtmData) {
        try {
          const utmObj = typeof rawUtmData === 'string' ? JSON.parse(rawUtmData) : rawUtmData;
          storedPassword = utmObj.password;
        } catch (parseError) {
          console.error("[FIAON-LOGIN] UTM JSON Parse Error:", parseError);
        }
      }
    }

    console.log(`[FIAON-LOGIN] Extracted Password: ${storedPassword} | Input: ${password} | Match: ${storedPassword === password}`);
    
    // Check password
    if (!storedPassword || storedPassword !== password) {
      return res.status(401).json({ ok: false, error: "Ungültige Anmeldedaten" });
    }
    
    // Check if application is completed
    if (app.status !== "completed") {
      return res.status(403).json({ ok: false, error: "Antrag noch nicht abgeschlossen" });
    }
    
    // Return success with application data
    res.json({ 
      ok: true, 
      ref: app.ref,
      firstName: app.first_name,
      lastName: app.last_name,
      email: app.email,
      packName: app.pack_name,
      approvedLimit: app.approved_limit,
    });
  } catch (err) {
    console.error("[FIAON-LOGIN]", err);
    res.status(500).json({ ok: false, error: "Serverfehler" });
  }
});

// Upload KYC documents
router.post("/upload-kyc", (req, res, next) => {
  upload.fields([
    { name: 'bankStatement', maxCount: 1 },
    { name: 'idCard', maxCount: 1 },
    { name: 'schufaDoc', maxCount: 1 },
  ])(req, res, (err) => {
    if (err) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({ error: "Datei zu groß. Bitte laden Sie eine PDF unter 25 MB hoch." });
      }
      return res.status(400).json({ error: err.message || "Upload-Fehler" });
    }
    next();
  });
}, async (req, res) => {
  try {
    const { ref } = req.body;
    const files = req.files as { [fieldname: string]: Express.Multer.File[] };
    
    if (!ref) {
      return res.status(400).json({ error: "Referenznummer fehlt" });
    }
    
    // Get application
    const apps = await sqlPool`
      SELECT * FROM fiaon_applications 
      WHERE ref = ${ref}
      ORDER BY created_at DESC 
      LIMIT 1
    `;
    
    if (apps.length === 0) {
      return res.status(404).json({ error: "Antrag nicht gefunden" });
    }
    
    // Prepare update values
    const updates: string[] = [];
    const values: any = {};
    
    if (files.bankStatement && files.bankStatement[0]) {
      updates.push('bank_statement_pdf = $bankStatementPdf');
      values.bankStatementPdf = files.bankStatement[0].buffer;
    }
    
    if (files.idCard && files.idCard[0]) {
      updates.push('id_card_pdf = $idCardPdf');
      values.idCardPdf = files.idCard[0].buffer;
    }

    if (files.schufaDoc && files.schufaDoc[0]) {
      updates.push('schufa_pdf = $schufaPdf');
      values.schufaPdf = files.schufaDoc[0].buffer;
    }
    
    if (updates.length === 0) {
      return res.status(400).json({ error: "Keine Dokumente hochgeladen" });
    }
    
    // Add timestamp
    updates.push('documents_uploaded_at = NOW()');
    
    // Check if both documents are now present
    const currentApp = apps[0];
    const hasBankStatement = files.bankStatement || currentApp.bank_statement_pdf;
    const hasIdCard = files.idCard || currentApp.id_card_pdf;
    
    if (hasBankStatement && hasIdCard) {
      updates.push("status = 'documents_submitted'");
    }

    // Build dynamic SQL update
    let sql = 'UPDATE fiaon_applications SET ';
    const params: any[] = [];
    let paramIndex = 1;
    
    if (values.bankStatementPdf) {
      sql += `bank_statement_pdf = $${paramIndex++}, `;
      params.push(values.bankStatementPdf);
    }
    
    if (values.idCardPdf) {
      sql += `id_card_pdf = $${paramIndex++}, `;
      params.push(values.idCardPdf);
    }

    if (values.schufaPdf) {
      sql += `schufa_pdf = $${paramIndex++}, `;
      params.push(values.schufaPdf);
    }
    
    sql += `documents_uploaded_at = NOW()`;
    
    if (hasBankStatement && hasIdCard) {
      sql += `, status = 'documents_submitted'`;
    }
    
    sql += ` WHERE ref = $${paramIndex}`;
    params.push(ref);
    
    // Execute update
    await sqlPool.unsafe(sql, params);

    // Reset reupload flags and kycStatus when re-uploading after changes_requested
    let newKycStatus = currentApp.kyc_status;
    if (currentApp.kyc_status === 'changes_requested') {
      const newBankFlag = files.bankStatement ? false : !!(currentApp.reupload_bank_statement);
      const newIdFlag   = files.idCard        ? false : !!(currentApp.reupload_id_card);
      newKycStatus = (newBankFlag || newIdFlag) ? 'changes_requested' : 'pending';
      await sqlPool`
        UPDATE fiaon_applications SET
          kyc_status              = ${newKycStatus},
          reupload_bank_statement = ${newBankFlag},
          reupload_id_card        = ${newIdFlag},
          updated_at              = NOW()
        WHERE ref = ${ref}
      `.catch(() => {});
    }

    console.log(`[FIAON-KYC] Documents uploaded for ${ref}, kycStatus=${newKycStatus}`);
    
    const hasSchufa = !!(files.schufaDoc || currentApp.schufa_pdf);
    res.json({ 
      ok: true, 
      message: "Dokumente erfolgreich hochgeladen",
      hasBankStatement: !!hasBankStatement,
      hasIdCard: !!hasIdCard,
      hasSchufa,
      allDocumentsUploaded: !!(hasBankStatement && hasIdCard),
      kycStatus: newKycStatus,
      reuploadBankStatement: files.bankStatement ? false : !!(currentApp.reupload_bank_statement),
      reuploadIdCard: files.idCard ? false : !!(currentApp.reupload_id_card),
    });
  } catch (err) {
    console.error("[FIAON-KYC]", err);
    res.status(500).json({ error: "Fehler beim Hochladen der Dokumente" });
  }
});

// Check KYC document status
router.get("/kyc-status/:ref", async (req, res) => {
  try {
    const { ref } = req.params;

    // Ensure profile + schufa columns exist
    await sqlPool`ALTER TABLE fiaon_applications ADD COLUMN IF NOT EXISTS profile_completed_at TIMESTAMP, ADD COLUMN IF NOT EXISTS admin_profile_note TEXT, ADD COLUMN IF NOT EXISTS profile_changes_requested BOOLEAN DEFAULT FALSE, ADD COLUMN IF NOT EXISTS schufa_pdf BYTEA`.catch(() => {});

    const apps = await sqlPool`
      SELECT
        CASE WHEN bank_statement_pdf IS NOT NULL THEN true ELSE false END as has_bank_statement,
        CASE WHEN id_card_pdf IS NOT NULL THEN true ELSE false END as has_id_card,
        CASE WHEN schufa_pdf IS NOT NULL THEN true ELSE false END as has_schufa,
        documents_uploaded_at,
        status,
        kyc_status,
        account_status,
        admin_note,
        admin_reviewed_at,
        reupload_bank_statement,
        reupload_id_card,
        admin_profile_note,
        profile_changes_requested,
        profile_completed_at
      FROM fiaon_applications
      WHERE ref = ${ref}
      LIMIT 1
    `;

    if (apps.length === 0) {
      return res.status(404).json({ error: "Antrag nicht gefunden" });
    }

    const app = apps[0];
    res.json({
      hasBankStatement: app.has_bank_statement,
      hasIdCard: app.has_id_card,
      documentsUploadedAt: app.documents_uploaded_at,
      status: app.status,
      kycStatus: app.kyc_status ?? 'pending',
      accountStatus: app.account_status ?? 'pending',
      adminNote: app.admin_note ?? null,
      adminReviewedAt: app.admin_reviewed_at ?? null,
      reuploadBankStatement: app.reupload_bank_statement ?? false,
      reuploadIdCard: app.reupload_id_card ?? false,
      hasSchufa: app.has_schufa ?? false,
      adminProfileNote: app.admin_profile_note ?? null,
      profileChangesRequested: app.profile_changes_requested ?? false,
      profileCompletedAt: app.profile_completed_at ?? null,
    });
  } catch (err) {
    console.error("[FIAON-KYC-STATUS]", err);
    res.status(500).json({ error: "Fehler beim Abrufen des Status" });
  }
});

// ── GET /profile/:ref — Vollständiges Kundenprofil ──────────────────────────
router.get("/profile/:ref", async (req, res) => {
  try {
    const { ref } = req.params;
    // Auto-migrate profile fields
    await sqlPool`
      ALTER TABLE fiaon_applications
      ADD COLUMN IF NOT EXISTS moved_recently BOOLEAN DEFAULT FALSE,
      ADD COLUMN IF NOT EXISTS previous_street VARCHAR,
      ADD COLUMN IF NOT EXISTS previous_zip VARCHAR,
      ADD COLUMN IF NOT EXISTS previous_city VARCHAR,
      ADD COLUMN IF NOT EXISTS previous_country VARCHAR,
      ADD COLUMN IF NOT EXISTS passport_number VARCHAR,
      ADD COLUMN IF NOT EXISTS passport_expiry DATE,
      ADD COLUMN IF NOT EXISTS has_additional_income BOOLEAN DEFAULT FALSE,
      ADD COLUMN IF NOT EXISTS additional_income_sources TEXT,
      ADD COLUMN IF NOT EXISTS additional_income_amount INTEGER,
      ADD COLUMN IF NOT EXISTS expenses_food INTEGER,
      ADD COLUMN IF NOT EXISTS expenses_transport INTEGER,
      ADD COLUMN IF NOT EXISTS expenses_insurance INTEGER,
      ADD COLUMN IF NOT EXISTS expenses_loans INTEGER,
      ADD COLUMN IF NOT EXISTS expenses_subscriptions INTEGER,
      ADD COLUMN IF NOT EXISTS expenses_other INTEGER,
      ADD COLUMN IF NOT EXISTS profile_completed_at TIMESTAMP,
      ADD COLUMN IF NOT EXISTS admin_profile_note TEXT,
      ADD COLUMN IF NOT EXISTS profile_changes_requested BOOLEAN DEFAULT FALSE
    `.catch(() => {});

    const apps = await sqlPool`SELECT * FROM fiaon_applications WHERE ref = ${ref} LIMIT 1`;
    if (apps.length === 0) return res.status(404).json({ ok: false, error: "Antrag nicht gefunden" });
    const a = apps[0];
    res.json({
      ok: true,
      firstName: a.first_name, lastName: a.last_name,
      birthdate: a.birthdate, nationality: a.nationality,
      email: a.email, phone: a.phone, phoneCountryCode: a.phone_country_code,
      street: a.street, zip: a.zip, city: a.city, country: a.country, housing: a.housing,
      income: a.income, rent: a.rent, debts: a.debts,
      employment: a.employment, employer: a.employer, employedSince: a.employed_since,
      wantedLimit: a.wanted_limit, purpose: a.purpose, billing: a.billing,
      billingMethod: a.billing_method, salaryReceiptDay: a.salary_receipt_day,
      iban: a.iban, packName: a.pack_name, packKey: a.pack_key,
      approvedLimit: a.approved_limit, accountStatus: a.account_status, kycStatus: a.kyc_status,
      movedRecently: a.moved_recently ?? false,
      previousStreet: a.previous_street ?? '', previousZip: a.previous_zip ?? '',
      previousCity: a.previous_city ?? '', previousCountry: a.previous_country ?? 'Deutschland',
      passportNumber: a.passport_number ?? '', passportExpiry: a.passport_expiry ? String(a.passport_expiry).slice(0,10) : '',
      hasAdditionalIncome: a.has_additional_income ?? false,
      additionalIncomeSources: a.additional_income_sources ?? '',
      additionalIncomeAmount: a.additional_income_amount ?? '',
      expensesFood: a.expenses_food ?? '', expensesTransport: a.expenses_transport ?? '',
      expensesInsurance: a.expenses_insurance ?? '', expensesLoans: a.expenses_loans ?? '',
      expensesSubscriptions: a.expenses_subscriptions ?? '', expensesOther: a.expenses_other ?? '',
      profileCompletedAt: a.profile_completed_at,
      adminProfileNote: a.admin_profile_note ?? null,
      profileChangesRequested: a.profile_changes_requested ?? false,
    });
  } catch (err) {
    console.error("[FIAON-PROFILE-GET]", err);
    res.status(500).json({ ok: false, error: "Fehler beim Laden" });
  }
});

// ── PATCH /profile/:ref — Profil-Ergänzungen speichern ──────────────────────
router.patch("/profile/:ref", async (req, res) => {
  try {
    const { ref } = req.params;
    const { movedRecently, previousStreet, previousZip, previousCity, previousCountry,
      passportNumber, passportExpiry, hasAdditionalIncome,
      additionalIncomeSources, additionalIncomeAmount,
      expensesFood, expensesTransport, expensesInsurance,
      expensesLoans, expensesSubscriptions, expensesOther } = req.body;
    const toInt = (v: any) => (v !== '' && v != null) ? parseInt(String(v)) : null;
    await sqlPool`
      UPDATE fiaon_applications SET
        moved_recently             = ${!!movedRecently},
        previous_street            = ${previousStreet || null},
        previous_zip               = ${previousZip || null},
        previous_city              = ${previousCity || null},
        previous_country           = ${previousCountry || null},
        passport_number            = ${passportNumber || null},
        passport_expiry            = ${passportExpiry || null},
        has_additional_income      = ${!!hasAdditionalIncome},
        additional_income_sources  = ${additionalIncomeSources || null},
        additional_income_amount   = ${toInt(additionalIncomeAmount)},
        expenses_food              = ${toInt(expensesFood)},
        expenses_transport         = ${toInt(expensesTransport)},
        expenses_insurance         = ${toInt(expensesInsurance)},
        expenses_loans             = ${toInt(expensesLoans)},
        expenses_subscriptions     = ${toInt(expensesSubscriptions)},
        expenses_other             = ${toInt(expensesOther)},
        profile_completed_at       = NOW(),
        profile_changes_requested  = FALSE,
        updated_at                 = NOW()
      WHERE ref = ${ref}
    `;
    console.log(`[FIAON-PROFILE-PATCH] ${ref} — Profil aktualisiert`);
    res.json({ ok: true });
  } catch (err) {
    console.error("[FIAON-PROFILE-PATCH]", err);
    res.status(500).json({ ok: false, error: "Fehler beim Speichern" });
  }
});

// Admin: review application — set kyc_status, account_status, admin_note
router.patch("/admin/applications/:ref/review", async (req, res) => {
  try {
    const { ref } = req.params;
    const { kycStatus, accountStatus, adminNote, reuploadBankStatement, reuploadIdCard, adminProfileNote, profileChangesRequested, schufaStatus, adminSchufaNote } = req.body;

    const validKyc = ['pending', 'approved', 'changes_requested'];
    const validAccount = ['pending', 'active', 'suspended'];

    if (kycStatus && !validKyc.includes(kycStatus)) {
      return res.status(400).json({ error: "Ungültiger kycStatus" });
    }
    if (accountStatus && !validAccount.includes(accountStatus)) {
      return res.status(400).json({ error: "Ungültiger accountStatus" });
    }

    // Ensure all columns exist (idempotent migration)
    await sqlPool`
      ALTER TABLE fiaon_applications
      ADD COLUMN IF NOT EXISTS kyc_status VARCHAR DEFAULT 'pending',
      ADD COLUMN IF NOT EXISTS account_status VARCHAR DEFAULT 'pending',
      ADD COLUMN IF NOT EXISTS admin_note TEXT,
      ADD COLUMN IF NOT EXISTS admin_reviewed_at TIMESTAMP,
      ADD COLUMN IF NOT EXISTS reupload_bank_statement BOOLEAN DEFAULT false,
      ADD COLUMN IF NOT EXISTS reupload_id_card BOOLEAN DEFAULT false
    `.catch(() => {});

    // When approving docs, always clear reupload flags
    const clearReupload = kycStatus === 'approved';
    const setReuploadBank = reuploadBankStatement !== undefined
      ? !!reuploadBankStatement
      : (clearReupload ? false : null);
    const setReuploadId = reuploadIdCard !== undefined
      ? !!reuploadIdCard
      : (clearReupload ? false : null);

    // Also migrate profile + schufa review columns if needed
    await sqlPool`ALTER TABLE fiaon_applications ADD COLUMN IF NOT EXISTS admin_profile_note TEXT, ADD COLUMN IF NOT EXISTS profile_changes_requested BOOLEAN DEFAULT FALSE, ADD COLUMN IF NOT EXISTS schufa_status VARCHAR DEFAULT 'pending', ADD COLUMN IF NOT EXISTS admin_schufa_note TEXT`.catch(() => {});

    await sqlPool`
      UPDATE fiaon_applications SET
        kyc_status                 = COALESCE(${kycStatus ?? null}, kyc_status),
        account_status             = COALESCE(${accountStatus ?? null}, account_status),
        admin_note                 = ${adminNote !== undefined ? (adminNote || null) : null},
        admin_reviewed_at          = NOW(),
        reupload_bank_statement    = COALESCE(${setReuploadBank}, reupload_bank_statement),
        reupload_id_card           = COALESCE(${setReuploadId}, reupload_id_card),
        admin_profile_note         = ${adminProfileNote !== undefined ? (adminProfileNote || null) : null},
        profile_changes_requested  = COALESCE(${profileChangesRequested ?? null}, profile_changes_requested),
        schufa_status              = COALESCE(${schufaStatus ?? null}, schufa_status),
        admin_schufa_note          = ${adminSchufaNote !== undefined ? (adminSchufaNote || null) : null},
        updated_at                 = NOW()
      WHERE ref = ${ref}
    `;

    console.log(`[FIAON-REVIEW] ${ref} → kycStatus=${kycStatus} accountStatus=${accountStatus} reuploadBank=${setReuploadBank} reuploadId=${setReuploadId}`);
    res.json({ ok: true });
  } catch (err) {
    console.error("[FIAON-REVIEW]", err);
    res.status(500).json({ error: "Fehler beim Review-Update" });
  }
});

// Download KYC document
router.get("/document/:ref/:type", async (req, res) => {
  try {
    const { ref, type } = req.params;

    if (type !== "bank-statement" && type !== "id-card") {
      return res.status(400).json({ error: "Ungültiger Dokumenttyp" });
    }

    const apps = await sqlPool`
      SELECT
        bank_statement_pdf,
        id_card_pdf
      FROM fiaon_applications
      WHERE ref = ${ref}
      LIMIT 1
    `;

    if (apps.length === 0) {
      return res.status(404).json({ error: "Antrag nicht gefunden" });
    }

    const app = apps[0];
    const buffer = type === "bank-statement" ? app.bank_statement_pdf : app.id_card_pdf;

    if (!buffer) {
      return res.status(404).json({ error: "Dokument nicht gefunden" });
    }

    const filename = type === "bank-statement" ? "Kontoauszüge.pdf" : "Ausweis.pdf";
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.send(buffer);
  } catch (err) {
    console.error("[FIAON-DOCUMENT-DOWNLOAD]", err);
    res.status(500).json({ error: "Fehler beim Herunterladen des Dokuments" });
  }
});

// Create test user (admin only) — always creates a fresh unique user
router.post("/admin/create-test-user", async (req, res) => {
  try {
    const ts = Date.now();
    const testRef = `FIA-DEV-${ts}`;
    const testEmail = `dev.test.${ts}@fiaon-internal.dev`;
    const testPassword = "DevTest123!";

    await sqlPool`
      INSERT INTO fiaon_applications (
        ref, type, status, current_step, pack_key, pack_name,
        first_name, last_name, birthdate, phone, phone_country_code,
        street, zip, city, country, nationality,
        employment, employer, employed_since, income, rent, debts, housing,
        wanted_limit, purpose, billing, addon, nfc,
        approved_limit, email, iban, billing_method, salary_receipt_day,
        consent_agb, consent_schufa, consent_contract,
        ip, user_agent, utm, created_at, updated_at
      ) VALUES (
        ${testRef}, 'private', 'approved', 5, 'standard', 'FIAON Standard',
        'Dev', 'User', '1985-03-15', '+491701234567', '+49',
        'Musterstraße 42', '10115', 'Berlin', 'Deutschland', 'deutsch',
        'Angestellt', 'Tech Solutions GmbH', '2020-01-01', 65000, 1200, 0, 'Miete',
        10000, 'Allgemeine Nutzung', 'Vollzahlung', false, true,
        10000, ${testEmail}, 'DE89 3704 0044 0532 0130 00', 'SEPA', 15,
        true, true, true,
        '127.0.0.1', 'Mozilla/5.0 (Test)', ${JSON.stringify({ password: testPassword })}, NOW(), NOW()
      )
    `;

    console.log("[FIAON-ADMIN] Dev-User erstellt:", testEmail);
    return res.json({ ok: true, ref: testRef, email: testEmail, password: testPassword, firstName: "Dev", lastName: "User", packName: "FIAON Standard", approvedLimit: 10000 });
  } catch (err) {
    console.error("[FIAON-ADMIN]", err);
    res.status(500).json({ error: "Fehler beim Erstellen des Dev-Users" });
  }
});

// Generate and download contract PDF
router.get("/contract/:ref", async (req, res) => {
  try {
    const { ref } = req.params;
    
    // Get application data
    const apps = await db.select().from(fiaonApplications).where(eq(fiaonApplications.ref, ref)).limit(1);
    if (apps.length === 0) {
      return res.status(404).json({ error: "Antrag nicht gefunden" });
    }
    
    const app = apps[0];
    
    // Create PDF
    const doc = new PDFDocument({ size: 'A4', margin: 50 });
    
    // Set response headers
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="FIAON_Vertrag_${ref}.pdf"`);
    
    // Pipe PDF to response
    doc.pipe(res);
    
    // Header
    doc.fontSize(24).font('Helvetica-Bold').text('FIAON Kreditkartenvertrag', { align: 'center' });
    doc.moveDown();
    doc.fontSize(10).font('Helvetica').text(`Vertragsnummer: ${ref}`, { align: 'center' });
    doc.text(`Datum: ${new Date().toLocaleDateString('de-DE')}`, { align: 'center' });
    doc.moveDown(2);
    
    // Vertragsparteien
    doc.fontSize(14).font('Helvetica-Bold').text('§1 Vertragsparteien');
    doc.moveDown(0.5);
    doc.fontSize(10).font('Helvetica');
    doc.text('Kreditgeber:', { continued: true }).font('Helvetica-Bold').text(' FIAON Financial Services GmbH');
    doc.font('Helvetica').text('Musterstraße 123, 10115 Berlin');
    doc.moveDown();
    doc.text('Kreditnehmer:', { continued: true }).font('Helvetica-Bold').text(` ${app.firstName || ''} ${app.lastName || ''}`);
    if (app.street) doc.font('Helvetica').text(`${app.street}, ${app.zip || ''} ${app.city || ''}`);
    if (app.birthdate) doc.text(`Geburtsdatum: ${new Date(app.birthdate).toLocaleDateString('de-DE')}`);
    doc.moveDown(1.5);
    
    // Vertragsgegenstand
    doc.fontSize(14).font('Helvetica-Bold').text('§2 Vertragsgegenstand');
    doc.moveDown(0.5);
    doc.fontSize(10).font('Helvetica');
    doc.text(`Der Kreditgeber stellt dem Kreditnehmer eine ${app.packName || 'FIAON'} Kreditkarte mit folgenden Konditionen zur Verfügung:`);
    doc.moveDown(0.5);
    doc.list([
      `Kreditlimit: bis zu ${app.approvedLimit ? (app.approvedLimit.toLocaleString('de-DE') + ' €') : 'individuell festgelegt'}`,
      `Monatliche Grundgebühr: gemäß Preisverzeichnis`,
      `Verwendungszweck: ${app.purpose || 'allgemeine Nutzung'}`,
      `Abrechnungsart: ${app.billing || 'Vollzahlung'}`,
      `NFC kontaktlos: ${app.nfc || 'aktiviert'}`
    ]);
    doc.moveDown(1.5);
    
    // Kreditkonditionen
    doc.fontSize(14).font('Helvetica-Bold').text('§3 Kreditkonditionen');
    doc.moveDown(0.5);
    doc.fontSize(10).font('Helvetica');
    doc.text('3.1 Der Kreditnehmer kann die Kreditkarte im Rahmen des vereinbarten Kreditlimits nutzen.');
    doc.text('3.2 Die Abrechnung erfolgt monatlich zum Ende des Abrechnungszeitraums.');
    doc.text('3.3 Bei Vollzahlung fallen keine Sollzinsen an. Bei Teilzahlung gelten die Konditionen gemäß Preisverzeichnis.');
    doc.moveDown(1.5);
    
    // Zahlungsbedingungen
    doc.fontSize(14).font('Helvetica-Bold').text('§4 Zahlungsbedingungen');
    doc.moveDown(0.5);
    doc.fontSize(10).font('Helvetica');
    if (app.billingMethod === 'iban' && app.iban) {
      doc.text(`4.1 Die Abbuchung erfolgt per SEPA-Lastschrift von folgendem Konto:`);
      doc.text(`IBAN: ${app.iban}`);
    } else {
      doc.text('4.1 Die Abrechnung erfolgt per Papierrechnung.');
    }
    doc.text('4.2 Die Zahlung ist innerhalb von 14 Tagen nach Rechnungsstellung fällig.');
    doc.moveDown(1.5);
    
    // Kündigungsrecht
    doc.fontSize(14).font('Helvetica-Bold').text('§5 Kündigungsrecht');
    doc.moveDown(0.5);
    doc.fontSize(10).font('Helvetica');
    doc.text('5.1 Beide Vertragsparteien können diesen Vertrag jederzeit mit einer Frist von 4 Wochen kündigen.');
    doc.text('5.2 Die Kündigung bedarf der Schriftform.');
    doc.moveDown(1.5);
    
    // Datenschutz
    doc.fontSize(14).font('Helvetica-Bold').text('§6 Datenschutz');
    doc.moveDown(0.5);
    doc.fontSize(10).font('Helvetica');
    doc.text('6.1 Der Kreditgeber verarbeitet personenbezogene Daten gemäß DSGVO.');
    doc.text('6.2 Eine Bonitätsprüfung bei der SCHUFA wurde durchgeführt.');
    doc.moveDown(2);
    
    // Unterschriften
    doc.fontSize(12).font('Helvetica-Bold').text('Vertragsannahme');
    doc.moveDown(0.5);
    doc.fontSize(10).font('Helvetica');
    doc.text(`Der Kreditnehmer ${app.firstName || ''} ${app.lastName || ''} bestätigt hiermit:`);
    doc.moveDown(0.5);
    doc.list([
      app.consentAgb ? '✓ AGB und Datenschutzerklärung akzeptiert' : '☐ AGB und Datenschutzerklärung',
      app.consentSchufa ? '✓ Einwilligung zur Bonitätsprüfung erteilt' : '☐ Einwilligung zur Bonitätsprüfung',
      app.consentContract ? '✓ Vertrag verbindlich angenommen' : '☐ Vertrag angenommen'
    ]);
    doc.moveDown(2);
    
    doc.text(`Ort, Datum: Berlin, ${new Date().toLocaleDateString('de-DE')}`);
    doc.moveDown(2);
    doc.text('_'.repeat(40));
    doc.text('Unterschrift Kreditnehmer (digital bestätigt)');
    
    // Footer
    doc.fontSize(8).text('\n\nFIAON Financial Services GmbH | Musterstraße 123 | 10115 Berlin | info@fiaon.de | www.fiaon.de', { align: 'center' });
    
    // Finalize PDF
    doc.end();
    
  } catch (err) {
    console.error('[FIAON-CONTRACT-PDF]', err);
    res.status(500).json({ error: 'PDF-Generierung fehlgeschlagen' });
  }
});

// ── Helper: render a contract PDF for one application (snake_case DB row) ──
function renderContractPdf(doc: PDFKit.PDFDocument, a: any) {
  const acceptedAt = a.completed_at || a.submitted_at || a.updated_at || a.created_at;
  const acceptedDate = acceptedAt ? new Date(acceptedAt) : new Date();
  const dateStr = acceptedDate.toLocaleDateString('de-DE');
  const timeStr = acceptedDate.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });

  // Header
  doc.fontSize(24).font('Helvetica-Bold').text('FIAON Kreditkartenvertrag', { align: 'center' });
  doc.moveDown();
  doc.fontSize(10).font('Helvetica').text(`Vertragsnummer: ${a.ref}`, { align: 'center' });
  doc.text(`Datum: ${dateStr}`, { align: 'center' });
  doc.moveDown(2);

  // Vertragsparteien
  doc.fontSize(14).font('Helvetica-Bold').text('§1 Vertragsparteien');
  doc.moveDown(0.5);
  doc.fontSize(10).font('Helvetica');
  doc.text('Kreditgeber:', { continued: true }).font('Helvetica-Bold').text(' FIAON Financial Services GmbH');
  doc.font('Helvetica').text('Musterstraße 123, 10115 Berlin');
  doc.moveDown();
  doc.text('Kreditnehmer:', { continued: true }).font('Helvetica-Bold').text(` ${a.first_name || ''} ${a.last_name || ''}`);
  if (a.street) doc.font('Helvetica').text(`${a.street}, ${a.zip || ''} ${a.city || ''}`);
  if (a.birthdate) doc.font('Helvetica').text(`Geburtsdatum: ${new Date(a.birthdate).toLocaleDateString('de-DE')}`);
  if (a.email) doc.font('Helvetica').text(`E-Mail: ${a.email}`);
  doc.moveDown(1.5);

  // Vertragsgegenstand
  doc.fontSize(14).font('Helvetica-Bold').text('§2 Vertragsgegenstand');
  doc.moveDown(0.5);
  doc.fontSize(10).font('Helvetica');
  doc.text(`Der Kreditgeber stellt dem Kreditnehmer eine ${a.pack_name || 'FIAON'} Kreditkarte mit folgenden Konditionen zur Verfügung:`);
  doc.moveDown(0.5);
  doc.list([
    `Kreditlimit: bis zu ${a.approved_limit ? (Number(a.approved_limit).toLocaleString('de-DE') + ' €') : 'individuell festgelegt'}`,
    `Monatliche Grundgebühr: gemäß Preisverzeichnis`,
    `Verwendungszweck: ${a.purpose || 'allgemeine Nutzung'}`,
    `Abrechnungsart: ${a.billing || 'Vollzahlung'}`,
    `NFC kontaktlos: ${a.nfc || 'aktiviert'}`,
  ]);
  doc.moveDown(1.5);

  // Kreditkonditionen
  doc.fontSize(14).font('Helvetica-Bold').text('§3 Kreditkonditionen');
  doc.moveDown(0.5);
  doc.fontSize(10).font('Helvetica');
  doc.text('3.1 Der Kreditnehmer kann die Kreditkarte im Rahmen des vereinbarten Kreditlimits nutzen.');
  doc.text('3.2 Die Abrechnung erfolgt monatlich zum Ende des Abrechnungszeitraums.');
  doc.text('3.3 Bei Vollzahlung fallen keine Sollzinsen an. Bei Teilzahlung gelten die Konditionen gemäß Preisverzeichnis.');
  doc.moveDown(1.5);

  // Zahlungsbedingungen
  doc.fontSize(14).font('Helvetica-Bold').text('§4 Zahlungsbedingungen');
  doc.moveDown(0.5);
  doc.fontSize(10).font('Helvetica');
  if (a.billing_method === 'iban' && a.iban) {
    doc.text('4.1 Die Abbuchung erfolgt per SEPA-Lastschrift von folgendem Konto:');
    doc.text(`IBAN: ${a.iban}`);
  } else {
    doc.text('4.1 Die Abrechnung erfolgt per Papierrechnung.');
  }
  doc.text('4.2 Die Zahlung ist innerhalb von 14 Tagen nach Rechnungsstellung fällig.');
  doc.moveDown(1.5);

  // Kündigungsrecht
  doc.fontSize(14).font('Helvetica-Bold').text('§5 Kündigungsrecht');
  doc.moveDown(0.5);
  doc.fontSize(10).font('Helvetica');
  doc.text('5.1 Beide Vertragsparteien können diesen Vertrag jederzeit mit einer Frist von 4 Wochen kündigen.');
  doc.text('5.2 Die Kündigung bedarf der Schriftform.');
  doc.moveDown(1.5);

  // Datenschutz
  doc.fontSize(14).font('Helvetica-Bold').text('§6 Datenschutz');
  doc.moveDown(0.5);
  doc.fontSize(10).font('Helvetica');
  doc.text('6.1 Der Kreditgeber verarbeitet personenbezogene Daten gemäß DSGVO.');
  doc.text('6.2 Eine Bonitätsprüfung bei der SCHUFA wurde durchgeführt.');
  doc.moveDown(2);

  // Vertragsannahme + digitaler Nachweis
  doc.fontSize(12).font('Helvetica-Bold').text('Vertragsannahme');
  doc.moveDown(0.5);
  doc.fontSize(10).font('Helvetica');
  doc.text(`Der Kreditnehmer ${a.first_name || ''} ${a.last_name || ''} bestätigt hiermit:`);
  doc.moveDown(0.5);
  doc.list([
    a.consent_agb ? '✓ AGB und Datenschutzerklärung akzeptiert' : '☐ AGB und Datenschutzerklärung',
    a.consent_schufa ? '✓ Einwilligung zur Bonitätsprüfung erteilt' : '☐ Einwilligung zur Bonitätsprüfung',
    a.consent_contract ? '✓ Vertrag verbindlich angenommen' : '☐ Vertrag angenommen',
  ]);
  doc.moveDown(2);

  doc.text(`Ort, Datum: Berlin, ${dateStr}`);
  doc.moveDown(2);
  doc.text('_'.repeat(40));
  doc.text('Unterschrift Kreditnehmer (digital bestätigt)');
  doc.moveDown(1);

  // Digitaler Akzeptanz-Nachweis (Audit-Trail)
  doc.fontSize(8).font('Helvetica-Bold').text('Digitaler Akzeptanz-Nachweis:');
  doc.fontSize(8).font('Helvetica');
  doc.text(`Bestätigt am ${dateStr} um ${timeStr} Uhr`);
  if (a.ip) doc.text(`IP-Adresse: ${a.ip}`);
  if (a.user_agent) doc.text(`Gerät/Browser: ${String(a.user_agent).slice(0, 160)}`);

  // Footer
  doc.fontSize(8).text('\n\nFIAON Financial Services GmbH | Musterstraße 123 | 10115 Berlin | info@fiaon.de | www.fiaon.de', { align: 'center' });
}

// ── CSV escaping helper ──
function csvCell(v: any): string {
  const s = v == null ? '' : String(v);
  return /[";\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

// Admin: download ALL contract acceptances as ZIP (one PDF per customer + CSV audit list)
router.get("/admin/contracts/download-all", async (req, res) => {
  try {
    const apps = await sqlPool`
      SELECT
        ref, first_name, last_name, birthdate, street, zip, city, email,
        pack_name, approved_limit, purpose, billing, nfc, iban, billing_method,
        consent_agb, consent_schufa, consent_contract,
        ip, user_agent, submitted_at, completed_at, created_at, updated_at, status
      FROM fiaon_applications
      WHERE consent_contract = TRUE
      ORDER BY created_at ASC
    `;

    if (apps.length === 0) {
      return res.status(404).json({ error: "Keine Vertragsakzeptierungen gefunden" });
    }

    const dateTag = new Date().toISOString().slice(0, 10);
    res.setHeader("Content-Type", "application/zip");
    res.setHeader("Content-Disposition", `attachment; filename="FIAON_Vertraege_${dateTag}.zip"`);

    const archive = new ZipArchive({ zlib: { level: 6 } });
    archive.on("error", (err: Error) => {
      console.error("[FIAON-CONTRACTS-ZIP] Archiver error:", err);
      try { res.end(); } catch { }
    });
    archive.pipe(res);

    // 1) CSV audit list of all acceptances (BOM for Excel, semicolon-separated)
    const csvHeader = [
      "Vertragsnummer", "Vorname", "Nachname", "E-Mail", "Paket", "Limit (EUR)",
      "AGB akzeptiert", "SCHUFA-Einwilligung", "Vertrag akzeptiert",
      "IP-Adresse", "Ger\u00e4t/Browser", "Antrag erstellt", "Abgeschlossen am", "Status",
    ].join(";");
    const csvRows = apps.map((a: any) => [
      csvCell(a.ref), csvCell(a.first_name), csvCell(a.last_name), csvCell(a.email),
      csvCell(a.pack_name), csvCell(a.approved_limit ?? ""),
      a.consent_agb ? "Ja" : "Nein", a.consent_schufa ? "Ja" : "Nein", a.consent_contract ? "Ja" : "Nein",
      csvCell(a.ip), csvCell(a.user_agent),
      a.created_at ? new Date(a.created_at).toLocaleString("de-DE") : "",
      (a.completed_at || a.submitted_at) ? new Date(a.completed_at || a.submitted_at).toLocaleString("de-DE") : "",
      csvCell(a.status),
    ].join(";"));
    const csv = "\uFEFF" + csvHeader + "\r\n" + csvRows.join("\r\n");
    archive.append(csv, { name: "Vertragsakzeptierungen_Uebersicht.csv" });

    // 2) One contract PDF per customer
    for (const a of apps) {
      const doc = new PDFDocument({ size: "A4", margin: 50 });
      const safeName = [a.last_name, a.first_name].filter(Boolean).join("_").replace(/[^a-zA-Z0-9äöüÄÖÜß_-]/g, "") || "Kunde";
      archive.append(doc as any, { name: `Vertraege/FIAON_Vertrag_${a.ref}_${safeName}.pdf` });
      renderContractPdf(doc, a);
      doc.end();
    }

    await archive.finalize();
    console.log(`[FIAON-CONTRACTS-ZIP] ${apps.length} Verträge als ZIP exportiert`);
  } catch (err) {
    console.error("[FIAON-CONTRACTS-ZIP]", err);
    if (!res.headersSent) {
      res.status(500).json({ error: "Fehler beim Erstellen des ZIP-Archivs" });
    }
  }
});

// Run migration endpoint (temporary for setup)
router.post("/run-migration", async (req, res) => {
  try {
    if (!process.env.DATABASE_URL) {
      return res.status(500).json({ ok: false, error: "DATABASE_URL not set" });
    }
    
    const sql = postgres(process.env.DATABASE_URL, { ssl: 'require' });
    
    // Check if columns already exist
    const columns = await sql`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'fiaon_applications' 
      AND table_schema = 'public'
      AND column_name = 'company_name'
    `;
    
    if (columns.length > 0) {
      await sql.end();
      return res.json({ ok: true, message: "Migration already run - business fields exist" });
    }
    
    // Run migration
    await sql`
      ALTER TABLE fiaon_applications 
      ADD COLUMN IF NOT EXISTS company_name VARCHAR,
      ADD COLUMN IF NOT EXISTS legal_form VARCHAR,
      ADD COLUMN IF NOT EXISTS tax_id VARCHAR,
      ADD COLUMN IF NOT EXISTS established_year VARCHAR,
      ADD COLUMN IF NOT EXISTS contact_name VARCHAR,
      ADD COLUMN IF NOT EXISTS contact_email VARCHAR,
      ADD COLUMN IF NOT EXISTS contact_phone VARCHAR,
      ADD COLUMN IF NOT EXISTS business_type VARCHAR,
      ADD COLUMN IF NOT EXISTS industry VARCHAR,
      ADD COLUMN IF NOT EXISTS annual_revenue INTEGER,
      ADD COLUMN IF NOT EXISTS employees INTEGER,
      ADD COLUMN IF NOT EXISTS monthly_expenses INTEGER,
      ADD COLUMN IF NOT EXISTS billing_email VARCHAR;
    `;
    
    // Create index
    await sql`
      CREATE INDEX IF NOT EXISTS fiaon_app_type_idx ON fiaon_applications(type);
    `;
    
    await sql.end();
    res.json({ ok: true, message: "Migration completed successfully" });
  } catch (err) {
    console.error("[FIAON-MIGRATION]", err);
    res.status(500).json({ ok: false, error: String(err) });
  }
});

// ============================================================
// ADMIN ENDPOINTS — Lean list (no bytea PDFs) for Dashboard UI
// ============================================================

// Admin: list applications, newest first, without heavy bytea columns
// Robust: uses SELECT * and strips bytea client-side, so it works even if
// individual migrations (KYC / stripe fields) haven't been run in this env.
router.get("/admin/applications", async (_req, res) => {
  try {
    const rows = await sqlPool`
      SELECT *
      FROM fiaon_applications
      ORDER BY created_at DESC NULLS LAST, id DESC
    `;

    const HEAVY_COLS = new Set(["bank_statement_pdf", "id_card_pdf", "schufa_pdf"]);
    const data = rows.map((row: any) => {
      const out: any = {};
      for (const [k, v] of Object.entries(row)) {
        if (HEAVY_COLS.has(k)) continue;
        out[k] = v;
      }
      // Add boolean presence flags without shipping the bytea
      out.has_bank_statement_pdf = row.bank_statement_pdf != null;
      out.has_id_card_pdf = row.id_card_pdf != null;
      out.has_schufa_pdf = row.schufa_pdf != null;
      return out;
    });

    // Detect duplicate groups by email (case-insensitive, trimmed)
    const emailMap = new Map<string, any[]>();
    for (const app of data) {
      const email = (app.email || '').trim().toLowerCase();
      if (!email) continue;
      if (!emailMap.has(email)) emailMap.set(email, []);
      emailMap.get(email)!.push(app);
    }
    const duplicateGroups: { email: string; count: number; refs: string[] }[] = [];
    emailMap.forEach((apps, email) => {
      if (apps.length > 1) {
        duplicateGroups.push({ email, count: apps.length, refs: apps.map((a: any) => a.ref) });
      }
    });

    console.log(`[FIAON-ADMIN-APPS] returning ${data.length} applications, ${duplicateGroups.length} duplicate groups`);
    res.json({ ok: true, data, count: data.length, duplicateGroups });
  } catch (err: any) {
    console.error("[FIAON-ADMIN-APPS] ERROR:", err?.message || err);
    res.status(500).json({
      ok: false,
      error: "Failed to fetch applications",
      detail: String(err?.message || err),
    });
  }
});

// Admin: merge duplicate applications into a single record.
// Keeps the "primary" ref (newest with most data), deletes the others.
// Requires explicit confirmation from admin (reviewed = true).
router.post("/admin/applications/merge", async (req, res) => {
  try {
    const { primaryRef, duplicateRefs, reviewed } = req.body;

    if (!reviewed) {
      return res.status(400).json({ ok: false, error: "Zusammenführung muss von einem MA geprüft werden (reviewed=true)" });
    }
    if (!primaryRef || !Array.isArray(duplicateRefs) || duplicateRefs.length === 0) {
      return res.status(400).json({ ok: false, error: "primaryRef und duplicateRefs[] erforderlich" });
    }

    // Fetch all records
    const allRefs = [primaryRef, ...duplicateRefs];
    const rows = await sqlPool`
      SELECT * FROM fiaon_applications WHERE ref = ANY(${allRefs})
    `;
    if (rows.length < 2) {
      return res.status(404).json({ ok: false, error: "Nicht genug Datensätze zum Zusammenführen gefunden" });
    }

    const primary = rows.find((r: any) => r.ref === primaryRef);
    if (!primary) {
      return res.status(404).json({ ok: false, error: "Primary-Datensatz nicht gefunden" });
    }

    const SKIP = new Set(["id", "ref", "created_at", "bank_statement_pdf", "id_card_pdf", "schufa_pdf"]);
    const duplicates = rows.filter((r: any) => r.ref !== primaryRef);

    // Merge: for each column, if primary is null/empty, take the first non-null from duplicates
    const updates: Record<string, any> = {};
    for (const dup of duplicates) {
      for (const [col, val] of Object.entries(dup as Record<string, any>)) {
        if (SKIP.has(col)) continue;
        const pVal = (primary as Record<string, any>)[col];
        const isEmpty = pVal === null || pVal === undefined || pVal === '';
        if (isEmpty && val !== null && val !== undefined && val !== '') {
          if (!(col in updates)) updates[col] = val;
        }
      }
    }

    // Also merge KYC docs: if primary has no doc but a dup does, copy it
    for (const docCol of ["bank_statement_pdf", "id_card_pdf", "schufa_pdf"]) {
      if ((primary as any)[docCol] == null) {
        const donor = duplicates.find((d: any) => d[docCol] != null);
        if (donor) updates[docCol] = (donor as any)[docCol];
      }
    }

    // Apply merged fields to primary
    if (Object.keys(updates).length > 0) {
      const setClauses = Object.entries(updates)
        .map(([col], i) => `${col} = $${i + 2}`)
        .join(", ");
      const vals = Object.values(updates);
      await sqlPool.unsafe(
        `UPDATE fiaon_applications SET ${setClauses}, updated_at = NOW() WHERE ref = $1`,
        [primaryRef, ...vals]
      );
    }

    // Delete duplicates
    const dupRefs = duplicateRefs.filter((r: string) => r !== primaryRef);
    if (dupRefs.length > 0) {
      await sqlPool`DELETE FROM fiaon_applications WHERE ref = ANY(${dupRefs})`;
    }

    console.log(`[FIAON-MERGE] Merged ${dupRefs.length} duplicates into ${primaryRef}. Fields updated: ${Object.keys(updates).join(', ') || 'none'}`);
    res.json({ ok: true, mergedInto: primaryRef, deleted: dupRefs, fieldsUpdated: Object.keys(updates) });
  } catch (err: any) {
    console.error("[FIAON-MERGE] ERROR:", err?.message || err);
    res.status(500).json({ ok: false, error: "Merge fehlgeschlagen", detail: String(err?.message || err) });
  }
});

// Admin: stream a KYC document PDF inline
router.get("/admin/applications/:ref/document/:type", async (req, res) => {
  try {
    const { ref, type } = req.params;
    const column =
      type === "bank_statement" ? "bank_statement_pdf" :
      type === "id_card" ? "id_card_pdf" :
      type === "schufa" ? "schufa_pdf" : null;

    if (!column) {
      return res.status(400).json({ error: "Invalid document type" });
    }

    const rows = await sqlPool`
      SELECT ${sqlPool.unsafe(column)} AS doc
      FROM fiaon_applications
      WHERE ref = ${ref}
      LIMIT 1
    `;
    if (rows.length === 0 || !rows[0].doc) {
      return res.status(404).json({ error: "Document not found" });
    }

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `inline; filename="${ref}_${type}.pdf"`);
    res.send(rows[0].doc);
  } catch (err) {
    console.error("[FIAON-ADMIN-DOC]", err);
    res.status(500).json({ error: "Failed to fetch document" });
  }
});

// POST /api/fiaon/verify-identity — prüft Name + Geb. + Email, gibt Token zurück
router.post("/verify-identity", async (req, res) => {
  try {
    const { firstName, lastName, birthDay, birthMonth, birthYear, email } = req.body;
    if (!firstName || !lastName || !email || !birthDay || !birthMonth || !birthYear) {
      return res.status(400).json({ ok: false, error: "Alle Felder ausfüllen" });
    }

    const trimEmail = email.trim().toLowerCase();
    const birthdate = `${birthYear}-${String(birthMonth).padStart(2, "0")}-${String(birthDay).padStart(2, "0")}`;

    const apps = await sqlPool`
      SELECT ref, first_name, last_name, email, birthdate, status
      FROM fiaon_applications
      WHERE LOWER(TRIM(email)) = ${trimEmail}
        AND status = 'completed'
      ORDER BY created_at DESC
      LIMIT 1
    `;

    if (apps.length === 0) {
      return res.status(401).json({ ok: false, error: "Kein Konto mit dieser E-Mail gefunden" });
    }

    const app = apps[0];
    const nameMatch =
      app.first_name?.trim().toLowerCase() === firstName.trim().toLowerCase() &&
      app.last_name?.trim().toLowerCase() === lastName.trim().toLowerCase();
    const dateMatch = app.birthdate && app.birthdate.startsWith(birthdate);

    if (!nameMatch || !dateMatch) {
      return res.status(401).json({ ok: false, error: "Die Angaben stimmen nicht überein" });
    }

    const token = randomBytes(32).toString("hex");
    verifyTokens.set(token, { ref: app.ref, expiresAt: Date.now() + 15 * 60 * 1000 });

    console.log("[FIAON-VERIFY-IDENTITY] Identity verified for ref:", app.ref);
    return res.json({ ok: true, token });
  } catch (err) {
    console.error("[FIAON-VERIFY-IDENTITY]", err);
    return res.status(500).json({ ok: false, error: "Serverfehler" });
  }
});

// POST /api/fiaon/reset-password-direct — setzt Passwort nach Identity-Verify
router.post("/reset-password-direct", async (req, res) => {
  try {
    const { token, newPassword } = req.body;
    if (!token || !newPassword || newPassword.length < 8) {
      return res.status(400).json({ ok: false, error: "Ungültige Anfrage oder Passwort zu kurz" });
    }

    const entry = verifyTokens.get(token);
    if (!entry || entry.expiresAt < Date.now()) {
      verifyTokens.delete(token);
      return res.status(401).json({ ok: false, error: "Sitzung abgelaufen. Bitte erneut verifizieren." });
    }

    const { ref } = entry;
    await sqlPool`
      UPDATE fiaon_applications
      SET password = ${newPassword},
          utm = ${JSON.stringify({ password: newPassword })}::jsonb,
          updated_at = NOW()
      WHERE ref = ${ref}
    `;

    verifyTokens.delete(token);
    console.log("[FIAON-RESET-DIRECT] Password reset for ref:", ref);
    return res.json({ ok: true });
  } catch (err) {
    console.error("[FIAON-RESET-DIRECT]", err);
    return res.status(500).json({ ok: false, error: "Serverfehler" });
  }
});

// ═══════════════════════════════════════════════════════════════════
// STRIPE SYNC: Full revenue & transaction sync
// ═══════════════════════════════════════════════════════════════════

router.get("/admin/stripe/revenue", async (_req, res) => {
  try {
    if (!stripe) return res.status(500).json({ ok: false, error: "Stripe not configured" });

    // Fetch ALL charges from Stripe (paginated)
    const allCharges: any[] = [];
    let hasMore = true;
    let startingAfter: string | undefined;
    while (hasMore) {
      const params: any = { limit: 100, expand: ['data.customer'] };
      if (startingAfter) params.starting_after = startingAfter;
      const batch = await stripe.charges.list(params);
      allCharges.push(...batch.data);
      hasMore = batch.has_more;
      if (batch.data.length > 0) startingAfter = batch.data[batch.data.length - 1].id;
    }

    // Fetch ALL subscriptions
    const allSubs: any[] = [];
    hasMore = true;
    startingAfter = undefined;
    while (hasMore) {
      const params: any = { limit: 100, status: 'all' };
      if (startingAfter) params.starting_after = startingAfter;
      const batch = await stripe.subscriptions.list(params);
      allSubs.push(...batch.data);
      hasMore = batch.has_more;
      if (batch.data.length > 0) startingAfter = batch.data[batch.data.length - 1].id;
    }

    // Map charges to our applications by stripe_customer_id
    const apps = await sqlPool`
      SELECT ref, email, first_name, last_name, stripe_customer_id, stripe_subscription_id, payment_status, pack_name
      FROM fiaon_applications
      WHERE stripe_customer_id IS NOT NULL OR email IS NOT NULL
    `;

    // Build email→ref and customer_id→ref lookup maps
    const customerToApp: Record<string, any> = {};
    const emailToApp: Record<string, any> = {};
    for (const app of apps) {
      if (app.stripe_customer_id) customerToApp[app.stripe_customer_id] = app;
      if (app.email) emailToApp[app.email.trim().toLowerCase()] = app;
    }

    // Process charges into structured data
    const transactions: any[] = [];
    let totalRevenue = 0;
    let totalRefunded = 0;
    let failedCount = 0;
    const monthlyRevenue: Record<string, number> = {};

    for (const charge of allCharges) {
      const custId = typeof charge.customer === 'string' ? charge.customer : charge.customer?.id;
      const custEmail = charge.billing_details?.email || charge.receipt_email || (typeof charge.customer === 'object' ? charge.customer?.email : null);
      const matchedApp = (custId && customerToApp[custId]) || (custEmail && emailToApp[custEmail.trim().toLowerCase()]) || null;

      const amountEur = (charge.amount || 0) / 100;
      const refundedEur = (charge.amount_refunded || 0) / 100;
      const created = new Date(charge.created * 1000);
      const monthKey = `${created.getFullYear()}-${String(created.getMonth() + 1).padStart(2, '0')}`;

      if (charge.status === 'succeeded' && !charge.refunded) {
        totalRevenue += amountEur;
        monthlyRevenue[monthKey] = (monthlyRevenue[monthKey] || 0) + amountEur;
      }
      if (charge.refunded || charge.amount_refunded > 0) {
        totalRefunded += refundedEur;
      }
      if (charge.status === 'failed') {
        failedCount++;
      }

      transactions.push({
        id: charge.id,
        amount: amountEur,
        amountRefunded: refundedEur,
        currency: charge.currency,
        status: charge.status,
        refunded: charge.refunded,
        paid: charge.paid,
        failureMessage: charge.failure_message,
        failureCode: charge.failure_code,
        description: charge.description,
        created: created.toISOString(),
        monthKey,
        customerEmail: custEmail,
        customerId: custId,
        matchedRef: matchedApp?.ref || null,
        matchedName: matchedApp ? [matchedApp.first_name, matchedApp.last_name].filter(Boolean).join(' ') : null,
        matchedPackage: matchedApp?.pack_name || null,
        paymentMethod: charge.payment_method_details?.type || null,
        receiptUrl: charge.receipt_url,
      });
    }

    // Sort monthly revenue
    const monthlyArr = Object.entries(monthlyRevenue)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([month, amount]) => ({ month, amount }));

    // Subscription summary
    const activeSubs = allSubs.filter(s => s.status === 'active' || s.status === 'trialing');
    const canceledSubs = allSubs.filter(s => s.status === 'canceled');
    const pastDueSubs = allSubs.filter(s => s.status === 'past_due');

    // MRR calculation (from active subs)
    let mrr = 0;
    for (const sub of activeSubs) {
      const item = sub.items?.data?.[0];
      if (item?.price?.unit_amount && item?.price?.recurring?.interval === 'month') {
        mrr += item.price.unit_amount / 100;
      } else if (item?.price?.unit_amount && item?.price?.recurring?.interval === 'year') {
        mrr += item.price.unit_amount / 100 / 12;
      }
    }

    // Annual target
    const annualTarget = 100000;
    const progressPercent = Math.min(100, Math.round((totalRevenue / annualTarget) * 100));

    console.log(`[STRIPE-REVENUE] ${transactions.length} charges, €${totalRevenue.toFixed(2)} total, ${failedCount} failed, MRR €${mrr.toFixed(2)}`);

    res.json({
      ok: true,
      summary: {
        totalRevenue: Math.round(totalRevenue * 100) / 100,
        totalRefunded: Math.round(totalRefunded * 100) / 100,
        netRevenue: Math.round((totalRevenue - totalRefunded) * 100) / 100,
        totalCharges: allCharges.length,
        successfulCharges: allCharges.filter(c => c.status === 'succeeded').length,
        failedCharges: failedCount,
        mrr: Math.round(mrr * 100) / 100,
        arr: Math.round(mrr * 12 * 100) / 100,
        annualTarget,
        progressPercent,
        activeSubs: activeSubs.length,
        canceledSubs: canceledSubs.length,
        pastDueSubs: pastDueSubs.length,
        totalSubs: allSubs.length,
      },
      monthlyRevenue: monthlyArr,
      transactions: transactions.sort((a, b) => b.created.localeCompare(a.created)),
      subscriptions: allSubs.map(s => ({
        id: s.id,
        status: s.status,
        customerId: s.customer,
        currentPeriodStart: s.current_period_start ? new Date(s.current_period_start * 1000).toISOString() : null,
        currentPeriodEnd: s.current_period_end ? new Date(s.current_period_end * 1000).toISOString() : null,
        canceledAt: s.canceled_at ? new Date(s.canceled_at * 1000).toISOString() : null,
        amount: s.items?.data?.[0]?.price?.unit_amount ? s.items.data[0].price.unit_amount / 100 : 0,
        interval: s.items?.data?.[0]?.price?.recurring?.interval || null,
        metadata: s.metadata,
      })),
    });
  } catch (err: any) {
    console.error("[STRIPE-REVENUE] ERROR:", err?.message || err);
    res.status(500).json({ ok: false, error: "Stripe-Abfrage fehlgeschlagen", detail: String(err?.message || err) });
  }
});

// Stripe Sync: Update payment_status for all apps based on actual Stripe data
router.post("/admin/stripe/sync", async (_req, res) => {
  try {
    if (!stripe) return res.status(500).json({ ok: false, error: "Stripe not configured" });

    // Get all apps with stripe_customer_id
    const apps = await sqlPool`
      SELECT ref, stripe_customer_id, stripe_subscription_id, payment_status
      FROM fiaon_applications
      WHERE stripe_customer_id IS NOT NULL
    `;

    let updated = 0;
    let failed = 0;

    for (const app of apps) {
      try {
        // Check charges for this customer
        const charges = await stripe.charges.list({ customer: app.stripe_customer_id, limit: 10 });
        const hasSuccessful = charges.data.some(c => c.status === 'succeeded' && c.paid);
        const hasFailed = charges.data.some(c => c.status === 'failed');

        let newStatus = app.payment_status;
        if (hasSuccessful) {
          newStatus = 'paid';
        } else if (hasFailed && !hasSuccessful) {
          newStatus = 'failed';
        }

        if (newStatus !== app.payment_status) {
          await sqlPool`
            UPDATE fiaon_applications
            SET payment_status = ${newStatus}, updated_at = NOW()
            WHERE ref = ${app.ref}
          `;
          updated++;
        }
      } catch (e) {
        failed++;
      }
    }

    console.log(`[STRIPE-SYNC] Synced ${apps.length} apps: ${updated} updated, ${failed} failed`);
    res.json({ ok: true, total: apps.length, updated, failed });
  } catch (err: any) {
    console.error("[STRIPE-SYNC] ERROR:", err?.message || err);
    res.status(500).json({ ok: false, error: "Sync fehlgeschlagen", detail: String(err?.message || err) });
  }
});

// Per-user Stripe transactions
router.get("/admin/applications/:ref/transactions", async (req, res) => {
  try {
    if (!stripe) return res.status(500).json({ ok: false, error: "Stripe not configured" });
    const { ref } = req.params;

    const apps = await sqlPool`
      SELECT stripe_customer_id FROM fiaon_applications WHERE ref = ${ref} LIMIT 1
    `;
    if (apps.length === 0 || !apps[0].stripe_customer_id) {
      return res.json({ ok: true, transactions: [], message: "Kein Stripe-Kunde verknüpft" });
    }

    const customerId = apps[0].stripe_customer_id;
    const charges = await stripe.charges.list({ customer: customerId, limit: 100 });

    const transactions = charges.data.map(c => ({
      id: c.id,
      amount: (c.amount || 0) / 100,
      amountRefunded: (c.amount_refunded || 0) / 100,
      currency: c.currency,
      status: c.status,
      paid: c.paid,
      refunded: c.refunded,
      failureMessage: c.failure_message,
      failureCode: c.failure_code,
      description: c.description,
      created: new Date(c.created * 1000).toISOString(),
      receiptUrl: c.receipt_url,
      paymentMethod: c.payment_method_details?.type || null,
    }));

    res.json({ ok: true, transactions, customerId });
  } catch (err: any) {
    console.error("[STRIPE-USER-TX] ERROR:", err?.message || err);
    res.status(500).json({ ok: false, error: "Transaktionen konnten nicht geladen werden" });
  }
});

// ═══════════════════════════════════════════════════════════════════
// STRIPE AI INSIGHTS: KI-gestützte Umsatz-Prognosen & Churn-Analyse
// ═══════════════════════════════════════════════════════════════════

router.get("/admin/stripe/ai-insights", async (_req, res) => {
  try {
    if (!stripe) return res.status(500).json({ ok: false, error: "Stripe not configured" });

    // ── Collect live data ──────────────────────────────────────────
    const [chargesBatch, subsBatch] = await Promise.all([
      stripe.charges.list({ limit: 100 }),
      stripe.subscriptions.list({ limit: 100, status: 'all' }),
    ]);

    const charges = chargesBatch.data;
    const subs = subsBatch.data;

    const activeSubs = subs.filter(s => s.status === 'active' || s.status === 'trialing');
    const pastDueSubs = subs.filter(s => s.status === 'past_due');
    const canceledSubs = subs.filter(s => s.status === 'canceled');

    // Monthly revenue map
    const monthly: Record<string, number> = {};
    let totalRevenue = 0;
    for (const c of charges) {
      if (c.status !== 'succeeded' || c.refunded) continue;
      const d = new Date(c.created * 1000);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      monthly[key] = (monthly[key] || 0) + (c.amount / 100);
      totalRevenue += c.amount / 100;
    }
    const monthlyArr = Object.entries(monthly).sort(([a], [b]) => a.localeCompare(b)).map(([m, v]) => ({ month: m, revenue: v }));

    // ── Compute statistical forecast ──────────────────────────────
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonthKey = `${currentYear}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const monthsThisYear = monthlyArr.filter(m => m.month.startsWith(String(currentYear)));
    const revenueThisYear = monthsThisYear.reduce((s, m) => s + m.revenue, 0);
    const monthsElapsed = now.getMonth() + 1;
    const monthsRemaining = 12 - monthsElapsed;
    const avgMonthly = monthsElapsed > 0 ? revenueThisYear / monthsElapsed : 0;

    // Growth rate: last 3 months vs 3 months before that
    const last3 = monthlyArr.slice(-3).reduce((s, m) => s + m.revenue, 0);
    const prev3 = monthlyArr.slice(-6, -3).reduce((s, m) => s + m.revenue, 0);
    const growthRate = prev3 > 0 ? ((last3 - prev3) / prev3) * 100 : 0;

    // Linear projection: extrapolate to year end
    const projectedYearEnd = revenueThisYear + avgMonthly * monthsRemaining;
    const annualTarget = 100000;
    const gapToTarget = Math.max(0, annualTarget - revenueThisYear);
    const neededPerMonth = monthsRemaining > 0 ? gapToTarget / monthsRemaining : 0;

    // MRR
    let mrr = 0;
    for (const sub of activeSubs) {
      const item = sub.items?.data?.[0];
      if (item?.price?.unit_amount) {
        if (item.price.recurring?.interval === 'month') mrr += item.price.unit_amount / 100;
        else if (item.price.recurring?.interval === 'year') mrr += item.price.unit_amount / 100 / 12;
      }
    }

    const churnRisk = pastDueSubs.length;
    const churnedThisYear = canceledSubs.filter(s => s.canceled_at && new Date(s.canceled_at * 1000).getFullYear() === currentYear).length;

    // ── AI narrative (GPT-4 / Gemini) ─────────────────────────────
    let aiText: string | null = null;
    let aiError: string | null = null;

    const aiPrompt = `Du bist ein hochpräziser Finanzanalyst für ARAS AI – ein Fintech-Unternehmen.

Analysiere folgende Stripe-Umsatzdaten und gib eine strukturierte Analyse auf Deutsch:

**Umsatz ${currentYear} bisher:** €${revenueThisYear.toFixed(0)}
**Jahresziel:** €${annualTarget.toLocaleString()}
**Verbleibende Monate:** ${monthsRemaining}
**Ø Monatsumsatz:** €${avgMonthly.toFixed(0)}
**MRR (aktive Abos):** €${mrr.toFixed(0)}
**Wachstumsrate (letzte 3 vs. vorherige 3 Monate):** ${growthRate.toFixed(1)}%
**Aktive Abos:** ${activeSubs.length}
**Überfällige Abos (Churn-Risiko):** ${churnRisk}
**Gekündigte Abos ${currentYear}:** ${churnedThisYear}
**Lineare Prognose Jahresende:** €${projectedYearEnd.toFixed(0)}
**Monatsumsatz je Monat:** ${monthlyArr.map(m => `${m.month}: €${m.revenue.toFixed(0)}`).join(', ')}

Gib deine Analyse als JSON mit folgender Struktur zurück (kein Markdown, nur reines JSON):
{
  "headline": "kurzer Executive Summary (1 Satz, prägnant)",
  "forecast": "Prognose ob Jahresziel erreichbar, mit konkreter Zahl",
  "churn": "Churn-Risikoanalyse und was zu tun ist",
  "growth": "Wachstumsanalyse und Trend",
  "actions": ["Handlungsempfehlung 1", "Handlungsempfehlung 2", "Handlungsempfehlung 3"],
  "sentiment": "positive" | "neutral" | "negative"
}`;

    try {
      const openai = process.env.OPENAI_API_KEY ? new (await import('openai')).default({ apiKey: process.env.OPENAI_API_KEY }) : null;
      const geminiKey = process.env.GOOGLE_GEMINI_API_KEY;

      if (openai) {
        const resp = await openai.chat.completions.create({
          model: 'gpt-4',
          messages: [
            { role: 'system', content: 'Du bist ein präziser Finanzanalyst. Antworte immer als reines JSON ohne Markdown-Formatierung.' },
            { role: 'user', content: aiPrompt }
          ],
          temperature: 0.4,
          max_tokens: 600,
        });
        aiText = resp.choices[0]?.message?.content || null;
      } else if (geminiKey) {
        const { GoogleGenerativeAI } = await import('@google/generative-ai');
        const genai = new GoogleGenerativeAI(geminiKey);
        const model = genai.getGenerativeModel({ model: 'gemini-pro' });
        const result = await model.generateContent(aiPrompt);
        aiText = result.response.text() || null;
      }
    } catch (e: any) {
      aiError = e?.message || 'AI nicht verfügbar';
    }

    let aiInsights: any = null;
    if (aiText) {
      try {
        const jsonMatch = aiText.match(/\{[\s\S]*\}/);
        if (jsonMatch) aiInsights = JSON.parse(jsonMatch[0]);
      } catch { aiInsights = null; }
    }

    res.json({
      ok: true,
      computed: {
        revenueThisYear: Math.round(revenueThisYear * 100) / 100,
        projectedYearEnd: Math.round(projectedYearEnd * 100) / 100,
        avgMonthly: Math.round(avgMonthly * 100) / 100,
        growthRate: Math.round(growthRate * 10) / 10,
        monthsRemaining,
        gapToTarget: Math.round(gapToTarget * 100) / 100,
        neededPerMonth: Math.round(neededPerMonth * 100) / 100,
        mrr: Math.round(mrr * 100) / 100,
        churnRisk,
        churnedThisYear,
        activeSubs: activeSubs.length,
        canceledSubs: canceledSubs.length,
        pastDueSubs: pastDueSubs.length,
      },
      aiInsights,
      aiError,
    });
  } catch (err: any) {
    console.error("[STRIPE-AI-INSIGHTS] ERROR:", err?.message || err);
    res.status(500).json({ ok: false, error: "AI-Analyse fehlgeschlagen", detail: String(err?.message || err) });
  }
});

export default router;
