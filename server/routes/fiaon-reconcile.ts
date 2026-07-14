// ═══════════════════════════════════════════════════════════════════
// FIAON Kontoabgleich (Bank-Reconciliation) — /admin/reconcile*
//
// Gleicht die REALEN Kontoeingänge (Kontoauszug, z. B. Wise-CSV) mit den im
// System hinterlegten Kunden-Anträgen ab, damit ausschließlich EXAKTE
// Zahlungseingänge verbucht sind.
//
// STRIKTE REGELN (aus Anforderung):
// - NUR EINGÄNGE der Kunden (CREDIT + DEPOSIT). Ausgänge/Card/Top-ups werden
//   serverseitig ignoriert und NIE verbucht.
// - Verbuchen setzt NUR den Zahlungsstatus (payment_status='paid') per Direkt-SQL.
//   Es wird KEINE Provision erzeugt/abgezogen (onCustomerPaid wird NICHT aufgerufen) —
//   bestehende Kunden-/Zahlungs-/Provisionslogik bleibt unangetastet.
// - Nicht automatisch zuordenbare Eingänge lassen sich manuell einem Kunden
//   zuordnen (assign) oder als „nicht-Kunde" ignorieren.
// - Beträge in Integer-Cents; Idempotenz über die Bank-Transaktions-ID.
// ═══════════════════════════════════════════════════════════════════

import { Router, type Request, type Response } from "express";
import postgres from "postgres";

const router = Router();
const sqlPool = postgres(process.env.DATABASE_URL!, { ssl: "require", max: 3 });

let ensured = false;
async function ensureTable(): Promise<void> {
  if (ensured) return;
  await sqlPool`
    CREATE TABLE IF NOT EXISTS fiaon_bank_txns (
      id SERIAL PRIMARY KEY,
      txn_id VARCHAR UNIQUE,                 -- Bank-Transaktions-ID (Idempotenz)
      booked_at TIMESTAMPTZ,
      amount_cents INTEGER NOT NULL,         -- immer positiv (Eingang)
      currency VARCHAR NOT NULL DEFAULT 'EUR',
      payer_name VARCHAR,
      reference_raw TEXT,                    -- Original-Referenz/Beschreibung
      extracted_ref VARCHAR,                 -- automatisch erkannte FIAON-Referenz
      matched_ref VARCHAR,                   -- zugeordnete Antrags-Referenz (auto/manuell)
      match_status VARCHAR NOT NULL DEFAULT 'unmatched', -- matched | unmatched | manual | ignored
      amount_ok BOOLEAN,                     -- Eingang == amount_due des Antrags?
      applied BOOLEAN NOT NULL DEFAULT FALSE,-- als bezahlt verbucht?
      applied_at TIMESTAMPTZ,
      note TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;
  await sqlPool`CREATE INDEX IF NOT EXISTS fiaon_bank_txns_status_idx ON fiaon_bank_txns (match_status)`;
  await sqlPool`CREATE INDEX IF NOT EXISTS fiaon_bank_txns_matched_idx ON fiaon_bank_txns (matched_ref)`;
  await sqlPool`CREATE INDEX IF NOT EXISTS fiaon_bank_txns_booked_idx ON fiaon_bank_txns (booked_at)`;
  ensured = true;
}

/** FIAON-Referenz aus einem freien Verwendungszweck extrahieren (6-stelliger Code). */
export function extractRef(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const up = String(raw).toUpperCase();
  const idx = up.indexOf("FIAON");
  if (idx === -1) return null;
  const after = up.slice(idx + 5).replace(/[^A-Z0-9]/g, "");
  if (after.length < 6) return null;
  return `FIAON-${after.slice(0, 6)}`;
}

/** Sucht den Antrag zu einer (normalisierten) Referenz. */
async function findApp(ref: string): Promise<any | null> {
  const norm = ref.toUpperCase().replace(/[^A-Z0-9]/g, "");
  const rows = await sqlPool`
    SELECT ref, amount_due, currency, payment_status, first_name, last_name, contact_name, email
    FROM fiaon_applications
    WHERE merged_into IS NULL AND UPPER(REGEXP_REPLACE(ref, '[^A-Za-z0-9]', '', 'g')) = ${norm}
    ORDER BY created_at ASC LIMIT 1
  `;
  return rows.length ? rows[0] : null;
}

function appAmountCents(app: any): number {
  return Math.round(Number(app.amount_due || 0) * 100);
}

// ═══════════════ Import (Kontoauszug-Zeilen → Ledger, idempotent) ═══════════════
interface BankRow {
  txnId?: string; dateTime?: string; amount?: number | string; currency?: string;
  description?: string; reference?: string; payerName?: string;
  transactionType?: string; detailsType?: string;
}

router.post("/admin/reconcile/import", async (req: Request, res: Response) => {
  try {
    await ensureTable();
    const rows: BankRow[] = Array.isArray(req.body?.rows) ? req.body.rows : [];
    if (rows.length === 0) return res.status(400).json({ ok: false, error: "Keine Zeilen" });
    if (rows.length > 10000) return res.status(400).json({ ok: false, error: "Zu viele Zeilen (max. 10000)" });

    let imported = 0, matched = 0, unmatched = 0, skipped = 0;
    for (const r of rows) {
      const amount = Number(r.amount);
      const type = String(r.transactionType || "").toUpperCase();
      const details = String(r.detailsType || "").toUpperCase();
      // NUR Kunden-Eingänge: CREDIT + DEPOSIT + positiver Betrag. Alles andere ignorieren.
      if (!Number.isFinite(amount) || amount <= 0 || type !== "CREDIT" || details !== "DEPOSIT") { skipped++; continue; }
      const txnId = String(r.txnId || "").trim();
      if (!txnId) { skipped++; continue; }

      const cents = Math.round(amount * 100);
      const currency = String(r.currency || "EUR").toUpperCase().slice(0, 3);
      const refRaw = String(r.reference || r.description || "");
      const extracted = extractRef(refRaw) || extractRef(r.payerName);
      let bookedAt: Date | null = null;
      if (r.dateTime) { const d = new Date(r.dateTime); if (!isNaN(d.getTime())) bookedAt = d; }

      let matchStatus = "unmatched";
      let matchedRef: string | null = null;
      let amountOk: boolean | null = null;
      if (extracted) {
        const app = await findApp(extracted);
        if (app) { matchStatus = "matched"; matchedRef = app.ref; amountOk = appAmountCents(app) === cents; }
      }

      // Idempotent: bestehende manuelle Zuordnung / Verbuchung NICHT überschreiben.
      await sqlPool`
        INSERT INTO fiaon_bank_txns
          (txn_id, booked_at, amount_cents, currency, payer_name, reference_raw, extracted_ref, matched_ref, match_status, amount_ok)
        VALUES
          (${txnId}, ${bookedAt}, ${cents}, ${currency}, ${r.payerName || null}, ${refRaw}, ${extracted}, ${matchedRef}, ${matchStatus}, ${amountOk})
        ON CONFLICT (txn_id) DO UPDATE SET
          amount_cents = EXCLUDED.amount_cents,
          currency = EXCLUDED.currency,
          payer_name = EXCLUDED.payer_name,
          reference_raw = EXCLUDED.reference_raw,
          extracted_ref = EXCLUDED.extracted_ref,
          -- automatische Felder nur aktualisieren, solange nicht manuell/verbucht
          matched_ref = CASE WHEN fiaon_bank_txns.match_status IN ('manual','ignored') OR fiaon_bank_txns.applied
                             THEN fiaon_bank_txns.matched_ref ELSE EXCLUDED.matched_ref END,
          match_status = CASE WHEN fiaon_bank_txns.match_status IN ('manual','ignored') OR fiaon_bank_txns.applied
                              THEN fiaon_bank_txns.match_status ELSE EXCLUDED.match_status END,
          amount_ok = EXCLUDED.amount_ok,
          updated_at = NOW()
      `;
      imported++;
      if (matchStatus === "matched") matched++; else unmatched++;
    }
    res.json({ ok: true, imported, matched, unmatched, skipped });
  } catch (err) {
    console.error("[FIAON-RECONCILE] import:", err);
    res.status(500).json({ ok: false, error: "Serverfehler beim Import" });
  }
});

// ═══════════════ Liste (Ledger + verknüpfter Antrag) ═══════════════
router.get("/admin/reconcile/list", async (req: Request, res: Response) => {
  try {
    await ensureTable();
    const status = typeof req.query.status === "string" ? req.query.status : null;
    const q = typeof req.query.q === "string" ? req.query.q.trim().toLowerCase() : "";
    const limit = Math.min(1000, Math.max(1, Number(req.query.limit) || 500));
    const rows = await sqlPool`
      SELECT t.id, t.txn_id, t.booked_at, t.amount_cents, t.currency, t.payer_name, t.reference_raw,
             t.extracted_ref, t.matched_ref, t.match_status, t.amount_ok, t.applied, t.applied_at, t.note,
             a.payment_status, a.amount_due,
             COALESCE(NULLIF(TRIM(CONCAT_WS(' ', a.first_name, a.last_name)), ''), a.contact_name, a.email) AS customer_name
      FROM fiaon_bank_txns t
      LEFT JOIN fiaon_applications a ON a.ref = t.matched_ref AND a.merged_into IS NULL
      WHERE (${status}::text IS NULL OR t.match_status = ${status})
        AND (${q} = '' OR LOWER(COALESCE(t.payer_name,'') || ' ' || COALESCE(t.reference_raw,'') || ' ' || COALESCE(t.matched_ref,'')) LIKE ${"%" + q + "%"})
      ORDER BY t.booked_at DESC NULLS LAST, t.id DESC
      LIMIT ${limit}
    `;
    res.json({ ok: true, data: rows });
  } catch (err) {
    console.error("[FIAON-RECONCILE] list:", err);
    res.status(500).json({ ok: false, error: "Serverfehler" });
  }
});

// ═══════════════ Zusammenfassung (exakte Bank-Aufstellung, brutto) ═══════════════
router.get("/admin/reconcile/summary", async (_req: Request, res: Response) => {
  try {
    await ensureTable();
    const [s] = await sqlPool`
      SELECT
        COUNT(*)::int AS total_count,
        COALESCE(SUM(amount_cents),0)::bigint AS total_cents,
        COUNT(*) FILTER (WHERE match_status IN ('matched','manual'))::int AS matched_count,
        COALESCE(SUM(amount_cents) FILTER (WHERE match_status IN ('matched','manual')),0)::bigint AS matched_cents,
        COUNT(*) FILTER (WHERE match_status = 'unmatched')::int AS unmatched_count,
        COALESCE(SUM(amount_cents) FILTER (WHERE match_status = 'unmatched'),0)::bigint AS unmatched_cents,
        COUNT(*) FILTER (WHERE applied)::int AS applied_count,
        COALESCE(SUM(amount_cents) FILTER (WHERE applied),0)::bigint AS applied_cents,
        COUNT(*) FILTER (WHERE match_status IN ('matched','manual') AND amount_ok = FALSE)::int AS discrepancy_count,
        COUNT(*) FILTER (WHERE match_status = 'ignored')::int AS ignored_count
      FROM fiaon_bank_txns
    `;
    res.json({
      ok: true,
      summary: {
        totalCount: Number(s.total_count), totalCents: Number(s.total_cents),
        matchedCount: Number(s.matched_count), matchedCents: Number(s.matched_cents),
        unmatchedCount: Number(s.unmatched_count), unmatchedCents: Number(s.unmatched_cents),
        appliedCount: Number(s.applied_count), appliedCents: Number(s.applied_cents),
        discrepancyCount: Number(s.discrepancy_count), ignoredCount: Number(s.ignored_count),
      },
    });
  } catch (err) {
    console.error("[FIAON-RECONCILE] summary:", err);
    res.status(500).json({ ok: false, error: "Serverfehler" });
  }
});

// ═══════════════ Antragssuche (für manuelle Zuordnung) ═══════════════
router.get("/admin/reconcile/search", async (req: Request, res: Response) => {
  try {
    const q = typeof req.query.q === "string" ? req.query.q.trim().toLowerCase() : "";
    if (q.length < 2) return res.json({ ok: true, data: [] });
    const rows = await sqlPool`
      SELECT ref, amount_due, currency, payment_status,
             COALESCE(NULLIF(TRIM(CONCAT_WS(' ', first_name, last_name)), ''), contact_name, email) AS customer_name, email
      FROM fiaon_applications
      WHERE merged_into IS NULL
        AND LOWER(COALESCE(ref,'') || ' ' || COALESCE(first_name,'') || ' ' || COALESCE(last_name,'') || ' ' || COALESCE(contact_name,'') || ' ' || COALESCE(email,'')) LIKE ${"%" + q + "%"}
      ORDER BY created_at DESC LIMIT 20
    `;
    res.json({ ok: true, data: rows });
  } catch (err) {
    console.error("[FIAON-RECONCILE] search:", err);
    res.status(500).json({ ok: false, error: "Serverfehler" });
  }
});

// ═══════════════ Manuelle Zuordnung eines Eingangs zu einem Kunden ═══════════════
router.post("/admin/reconcile/:id/assign", async (req: Request, res: Response) => {
  try {
    await ensureTable();
    const id = Number(req.params.id);
    const ref = String(req.body?.ref || "").trim();
    if (!ref) return res.status(400).json({ ok: false, error: "Antrags-Referenz erforderlich" });
    const app = await findApp(ref);
    if (!app) return res.status(404).json({ ok: false, error: "Antrag nicht gefunden" });
    const [txn] = await sqlPool`SELECT amount_cents FROM fiaon_bank_txns WHERE id = ${id}`;
    if (!txn) return res.status(404).json({ ok: false, error: "Eingang nicht gefunden" });
    const amountOk = appAmountCents(app) === Number(txn.amount_cents);
    await sqlPool`
      UPDATE fiaon_bank_txns SET matched_ref = ${app.ref}, match_status = 'manual', amount_ok = ${amountOk}, updated_at = NOW()
      WHERE id = ${id}
    `;
    res.json({ ok: true, matchedRef: app.ref, amountOk });
  } catch (err) {
    console.error("[FIAON-RECONCILE] assign:", err);
    res.status(500).json({ ok: false, error: "Serverfehler" });
  }
});

// ═══════════════ Als „kein Kunde" ignorieren ═══════════════
router.post("/admin/reconcile/:id/ignore", async (req: Request, res: Response) => {
  try {
    await ensureTable();
    await sqlPool`UPDATE fiaon_bank_txns SET match_status = 'ignored', updated_at = NOW() WHERE id = ${Number(req.params.id)} AND applied = FALSE`;
    res.json({ ok: true });
  } catch (err) {
    console.error("[FIAON-RECONCILE] ignore:", err);
    res.status(500).json({ ok: false, error: "Serverfehler" });
  }
});

/**
 * Verbucht EINEN Bank-Eingang: setzt den zugeordneten Antrag auf `paid`
 * (Direkt-SQL, KEINE Provision). Optional wird `amount_due` exakt an den
 * Bankeingang angeglichen (syncAmount). Idempotent.
 */
async function applyTxn(id: number, syncAmount: boolean): Promise<{ ok: boolean; error?: string; ref?: string }> {
  const [txn] = await sqlPool`SELECT * FROM fiaon_bank_txns WHERE id = ${id}`;
  if (!txn) return { ok: false, error: "Eingang nicht gefunden" };
  if (txn.match_status === "ignored") return { ok: false, error: "Eingang ist als ignoriert markiert" };
  if (!txn.matched_ref) return { ok: false, error: "Kein Kunde zugeordnet" };

  const receivedCents = Number(txn.amount_cents);
  const eur = (receivedCents / 100).toFixed(2);
  // NUR Zahlungsstatus setzen — KEIN onCustomerPaid, KEINE Provision.
  const updated = await sqlPool`
    UPDATE fiaon_applications SET
      payment_status = 'paid',
      status = CASE WHEN status = 'payment_completed' THEN status ELSE 'payment_completed' END,
      account_status = CASE WHEN account_status = 'suspended' THEN account_status ELSE 'active' END,
      claimed_paid_at = COALESCE(claimed_paid_at, ${txn.booked_at}, NOW()),
      completed_at = COALESCE(completed_at, ${txn.booked_at}, NOW()),
      updated_at = NOW()
    WHERE ref = ${txn.matched_ref} AND merged_into IS NULL
    RETURNING ref
  `;
  if (updated.length === 0) return { ok: false, error: "Antrag nicht gefunden/zusammengeführt" };
  // Optional: Betrag exakt an den Bankeingang angleichen (Kunden-EINGANG, brutto).
  if (syncAmount) {
    await sqlPool`UPDATE fiaon_applications SET amount_due = ${eur}::numeric, updated_at = NOW() WHERE ref = ${txn.matched_ref} AND merged_into IS NULL`;
  }
  await sqlPool`UPDATE fiaon_bank_txns SET applied = TRUE, applied_at = NOW(), updated_at = NOW() WHERE id = ${id}`;
  console.log(`[FIAON-RECONCILE] verbucht: ${txn.matched_ref} ← Bank ${txn.txn_id} (${eur} ${txn.currency})${syncAmount ? " [Betrag synchronisiert]" : ""}`);
  // Paket DB (Root-Cause-Fix): identische Nacharbeit wie mark-paid —
  // 1. Schwester-Dubletten sofort superseden (stoppt Erinnerungs-Kette) inkl.
  //    Attributions-Übertrag auf die bezahlte Bestellung (Agent behält Sicht).
  // 2. Bezahlt-Bestätigung an den Kunden (Make 'payment_confirmed', 1×-Claim).
  // Weiterhin bewusst KEIN onCustomerPaid — Provision beim Kontoabgleich nur
  // per manueller Admin-Buchung (/admin/agents/:id/commissions/manual).
  try {
    const antrag = await import("./fiaon-antrag");
    await antrag.supersedeSisterOrders(txn.matched_ref);
    await antrag.sendPaymentConfirmedOnce(txn.matched_ref);
  } catch (e) {
    console.error("[FIAON-RECONCILE] Nacharbeit (supersede/confirmed):", e);
  }
  return { ok: true, ref: txn.matched_ref };
}

router.post("/admin/reconcile/:id/apply", async (req: Request, res: Response) => {
  try {
    await ensureTable();
    const r = await applyTxn(Number(req.params.id), req.body?.syncAmount === true);
    if (!r.ok) return res.status(400).json({ ok: false, error: r.error });
    res.json({ ok: true, ref: r.ref });
  } catch (err) {
    console.error("[FIAON-RECONCILE] apply:", err);
    res.status(500).json({ ok: false, error: "Serverfehler" });
  }
});

// Bulk: alle zugeordneten, noch nicht verbuchten Eingänge verbuchen.
router.post("/admin/reconcile/apply-matched", async (req: Request, res: Response) => {
  try {
    await ensureTable();
    const syncAmount = req.body?.syncAmount === true;
    const onlyAmountOk = req.body?.onlyAmountOk === true;
    const rows = await sqlPool`
      SELECT id FROM fiaon_bank_txns
      WHERE applied = FALSE AND match_status IN ('matched','manual') AND matched_ref IS NOT NULL
        AND (${onlyAmountOk} = FALSE OR amount_ok = TRUE)
      ORDER BY id ASC
    `;
    let applied = 0; const errors: string[] = [];
    for (const row of rows) {
      const r = await applyTxn(Number(row.id), syncAmount);
      if (r.ok) applied++; else errors.push(`#${row.id}: ${r.error}`);
    }
    res.json({ ok: true, applied, total: rows.length, errors });
  } catch (err) {
    console.error("[FIAON-RECONCILE] apply-matched:", err);
    res.status(500).json({ ok: false, error: "Serverfehler" });
  }
});

export default router;
