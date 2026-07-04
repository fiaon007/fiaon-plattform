// ═══════════════════════════════════════════════════════════════════
// FIAON Admin-Kommandozentrale (Paket O) — Read-only-Endpoints für den Hub
// - /admin/hub/stats:      Tages-Kennzahlen für /admin (Kopfbereich)
// - /admin/search:         Globale Schnellsuche (Cmd+K) über Kunden + Agents
// - /admin/invoices:       Rechnungs-Übersicht (Nummernkreis, Download-Links)
// - /admin/system-status:  Base-URL, Make-Webhook-Diagnose, INVOICE_VAT_MODE
// - /admin/legal-review:   LEGAL_REVIEW_PACKAGE.md read-only anzeigen
// Agent-Tokens werden durch blockAgentsFromAdmin (fiaon-agent.ts, davor
// gemountet) mit 403 abgewiesen. Keine Logik-/Schreib-Endpoints hier.
// ═══════════════════════════════════════════════════════════════════

import { Router } from "express";
import postgres from "postgres";
import { readFile } from "fs/promises";
import path from "path";
import { getSettings } from "./fiaon-agent";
import { baseUrlDiagnostics } from "../fiaon-base-url";

const router = Router();
const sqlPool = postgres(process.env.DATABASE_URL!, { ssl: "require", max: 5 });

// ── O1: Tages-Kennzahlen ─────────────────────────────────────────────────────
router.get("/admin/hub/stats", async (_req, res) => {
  try {
    const [row] = await sqlPool`
      SELECT
        COUNT(*) FILTER (WHERE created_at::date = CURRENT_DATE AND merged_into IS NULL) AS today_new,
        COUNT(*) FILTER (WHERE payment_status = 'claimed_paid' AND merged_into IS NULL) AS claimed_count,
        COALESCE(SUM(amount_due) FILTER (WHERE payment_status = 'claimed_paid' AND merged_into IS NULL), 0) AS claimed_sum,
        COUNT(*) FILTER (WHERE payment_status = 'paid' AND completed_at::date = CURRENT_DATE AND merged_into IS NULL) AS today_paid_count,
        COALESCE(SUM(amount_due) FILTER (WHERE payment_status = 'paid' AND completed_at::date = CURRENT_DATE AND merged_into IS NULL), 0) AS today_paid_sum,
        COUNT(*) FILTER (WHERE invoice_number IS NOT NULL AND merged_into IS NULL) AS invoice_count
      FROM fiaon_applications
    `;
    const [payouts] = await sqlPool`
      SELECT COUNT(*) AS open FROM fiaon_payouts WHERE status = 'angefordert'
    `.catch(() => [{ open: 0 }] as any);
    const [agents] = await sqlPool`
      SELECT COUNT(*) FILTER (WHERE active) AS active,
             COUNT(*) FILTER (WHERE bank_change_ack = FALSE) AS bank_changes
      FROM fiaon_agents
    `.catch(() => [{ active: 0, bank_changes: 0 }] as any);
    res.json({
      ok: true,
      todayNew: Number(row.today_new),
      claimed: { count: Number(row.claimed_count), sum: Number(row.claimed_sum) },
      todayPaid: { count: Number(row.today_paid_count), sum: Number(row.today_paid_sum) },
      invoiceCount: Number(row.invoice_count),
      openPayouts: Number(payouts.open),
      activeAgents: Number(agents.active),
      bankChanges: Number(agents.bank_changes),
    });
  } catch (err) {
    console.error("[FIAON-HUB] stats:", err);
    res.status(500).json({ ok: false, error: "Serverfehler" });
  }
});

// ── O3: Globale Schnellsuche (Cmd+K) ─────────────────────────────────────────
// Kunden: Name / E-Mail / Referenz / Zahlungsreferenz / Telefon.
// Agents: Name / E-Mail. (Kunden-IBANs existieren nicht — Kunden zahlen an UNS;
// Agent-IBANs sind verschlüsselt und damit bewusst nicht durchsuchbar.)
router.get("/admin/search", async (req, res) => {
  try {
    const q = String(req.query.q || "").trim();
    if (q.length < 2) return res.json({ ok: true, results: [] });
    const like = `%${q}%`;
    const customers = await sqlPool`
      SELECT ref, payment_reference, payment_status, amount_due,
             first_name, last_name, contact_name, company_name, email, contact_email
      FROM fiaon_applications
      WHERE merged_into IS NULL AND (
        ref ILIKE ${like} OR payment_reference ILIKE ${like}
        OR first_name ILIKE ${like} OR last_name ILIKE ${like}
        OR company_name ILIKE ${like} OR contact_name ILIKE ${like}
        OR email ILIKE ${like} OR contact_email ILIKE ${like}
        OR phone ILIKE ${like}
        OR (first_name || ' ' || last_name) ILIKE ${like}
      )
      ORDER BY updated_at DESC NULLS LAST
      LIMIT 8
    `;
    const agents = await sqlPool`
      SELECT id, name, email FROM fiaon_agents
      WHERE name ILIKE ${like} OR email ILIKE ${like}
      LIMIT 4
    `.catch(() => [] as any);

    const results = [
      ...customers.map((c: any) => ({
        type: "kunde",
        label: c.company_name || [c.first_name, c.last_name].filter(Boolean).join(" ") || c.contact_name || c.ref,
        sub: `${c.payment_reference || c.ref}${c.email || c.contact_email ? ` · ${c.email || c.contact_email}` : ""}`,
        status: c.payment_status,
        url: c.payment_reference
          ? `/admin/zahlungen?ref=${encodeURIComponent(c.payment_reference)}`
          : `/admin/zahlungen?ref=${encodeURIComponent(c.ref)}`,
      })),
      ...agents.map((a: any) => ({
        type: "agent",
        label: a.name,
        sub: a.email,
        status: null,
        url: `/admin/team`,
      })),
    ];
    res.json({ ok: true, results });
  } catch (err) {
    console.error("[FIAON-HUB] search:", err);
    res.status(500).json({ ok: false, error: "Serverfehler" });
  }
});

// ── Rechnungs-Übersicht ──────────────────────────────────────────────────────
router.get("/admin/invoices", async (req, res) => {
  try {
    const q = String(req.query.q || "").trim();
    const like = `%${q}%`;
    const rows = q.length >= 2
      ? await sqlPool`
          SELECT ref, payment_reference, invoice_number, invoice_date, amount_due, payment_status,
                 first_name, last_name, contact_name, company_name, email, contact_email
          FROM fiaon_applications
          WHERE invoice_number IS NOT NULL AND merged_into IS NULL
            AND (invoice_number ILIKE ${like} OR payment_reference ILIKE ${like} OR ref ILIKE ${like}
                 OR first_name ILIKE ${like} OR last_name ILIKE ${like} OR company_name ILIKE ${like}
                 OR email ILIKE ${like} OR contact_email ILIKE ${like})
          ORDER BY invoice_number DESC
          LIMIT 200
        `
      : await sqlPool`
          SELECT ref, payment_reference, invoice_number, invoice_date, amount_due, payment_status,
                 first_name, last_name, contact_name, company_name, email, contact_email
          FROM fiaon_applications
          WHERE invoice_number IS NOT NULL AND merged_into IS NULL
          ORDER BY invoice_number DESC
          LIMIT 200
        `;
    res.json({ ok: true, data: rows });
  } catch (err) {
    console.error("[FIAON-HUB] invoices:", err);
    res.status(500).json({ ok: false, error: "Serverfehler" });
  }
});

// ── System-Status (Diagnose, read-only) ──────────────────────────────────────
router.get("/admin/system-status", async (_req, res) => {
  try {
    const settings = await getSettings();
    let makeLastEvents: Record<string, string> = {};
    try {
      makeLastEvents = JSON.parse(settings.make_last_events || "{}");
    } catch {}
    res.json({
      ok: true,
      baseUrl: baseUrlDiagnostics(),
      makeWebhookConfigured: Boolean(process.env.MAKE_WEBHOOK_URL),
      makeLastEvents,
      invoiceVatMode: (process.env.INVOICE_VAT_MODE || "none").toLowerCase(),
      defaults: {
        commissionRateBp: Number(settings.default_commission_rate_bp),
        payoutMinCents: Number(settings.payout_min_cents),
      },
    });
  } catch (err) {
    console.error("[FIAON-HUB] system-status:", err);
    res.status(500).json({ ok: false, error: "Serverfehler" });
  }
});

// ── Rechtstexte-Review-Status (read-only Anzeige der Review-Datei) ───────────
router.get("/admin/legal-review", async (_req, res) => {
  try {
    const filePath = path.resolve(process.cwd(), "LEGAL_REVIEW_PACKAGE.md");
    const content = await readFile(filePath, "utf-8").catch(() => null);
    res.json({ ok: true, content, exists: content != null });
  } catch (err) {
    console.error("[FIAON-HUB] legal-review:", err);
    res.status(500).json({ ok: false, error: "Serverfehler" });
  }
});

export default router;
