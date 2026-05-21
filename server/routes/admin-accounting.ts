import { Router } from "express";
import postgres from "postgres";
import { logger } from "../logger";
import { requireAdmin } from "../middleware/admin";

const router = Router();

// 🔒 All accounting routes require admin
router.use(requireAdmin);

// Lazy SQL client (reuses env var like other routes)
function getSql() {
  return postgres(process.env.DATABASE_URL!, { ssl: "require" });
}

// Determine if entry type adds to (+) or subtracts from (-) balance
function balanceDelta(entryType: string, amountCents: number): number {
  if (["income", "client_payment"].includes(entryType)) return amountCents;
  if (["expense_recurring", "expense_onetime", "withdrawal", "investment"].includes(entryType)) return -amountCents;
  return 0;
}

// ============================================================================
// ENSURE TABLES EXIST (idempotent boot-time setup)
// ============================================================================
async function ensureTables(sql: ReturnType<typeof getSql>) {
  await sql`
    CREATE TABLE IF NOT EXISTS accounting_balance (
      id SERIAL PRIMARY KEY,
      balance_cents BIGINT NOT NULL DEFAULT 5500000,
      currency VARCHAR(3) NOT NULL DEFAULT 'EUR',
      note TEXT,
      updated_at TIMESTAMP DEFAULT NOW() NOT NULL,
      updated_by VARCHAR
    )
  `;
  await sql`
    INSERT INTO accounting_balance (balance_cents, currency, note)
    SELECT 5500000, 'EUR', 'Startkontostand'
    WHERE NOT EXISTS (SELECT 1 FROM accounting_balance)
  `;
  await sql`
    CREATE TABLE IF NOT EXISTS accounting_entries (
      id SERIAL PRIMARY KEY,
      entry_type VARCHAR NOT NULL DEFAULT 'expense_onetime',
      category VARCHAR NOT NULL DEFAULT 'misc',
      title VARCHAR NOT NULL,
      description TEXT,
      amount_cents INTEGER NOT NULL,
      currency VARCHAR(3) NOT NULL DEFAULT 'EUR',
      entry_date DATE NOT NULL DEFAULT CURRENT_DATE,
      is_recurring BOOLEAN NOT NULL DEFAULT FALSE,
      frequency VARCHAR,
      status VARCHAR NOT NULL DEFAULT 'planned',
      payment_method VARCHAR,
      payment_reference VARCHAR,
      vendor VARCHAR,
      invoice_number VARCHAR,
      tags TEXT[],
      metadata JSONB,
      created_at TIMESTAMP DEFAULT NOW() NOT NULL,
      updated_at TIMESTAMP DEFAULT NOW() NOT NULL
    )
  `;
}

// ============================================================================
// GET /api/admin/accounting/summary
// Returns: balance + aggregated KPIs + recent entries
// ============================================================================
router.get("/summary", async (_req, res) => {
  const sql = getSql();
  try {
    await ensureTables(sql);

    const [balanceRow] = await sql`
      SELECT balance_cents, currency, note, updated_at FROM accounting_balance ORDER BY id LIMIT 1
    `;

    // Monthly aggregations (current calendar month)
    const [monthly] = await sql`
      SELECT
        COALESCE(SUM(CASE WHEN entry_type IN ('expense_recurring','expense_onetime','withdrawal','investment') AND status != 'cancelled' THEN amount_cents ELSE 0 END), 0) AS total_out_cents,
        COALESCE(SUM(CASE WHEN entry_type IN ('income','client_payment') AND status != 'cancelled' THEN amount_cents ELSE 0 END), 0) AS total_in_cents
      FROM accounting_entries
      WHERE DATE_TRUNC('month', entry_date) = DATE_TRUNC('month', CURRENT_DATE)
    `;

    // Recurring monthly burn (annualized / 12 for yearly, x4 for quarterly)
    const recurring = await sql`
      SELECT amount_cents, frequency FROM accounting_entries
      WHERE is_recurring = TRUE AND status != 'cancelled'
    `;

    let monthlyBurnCents = 0;
    for (const r of recurring) {
      switch (r.frequency) {
        case "daily":    monthlyBurnCents += r.amount_cents * 30; break;
        case "weekly":   monthlyBurnCents += r.amount_cents * 4; break;
        case "monthly":  monthlyBurnCents += r.amount_cents; break;
        case "quarterly":monthlyBurnCents += Math.round(r.amount_cents / 3); break;
        case "yearly":   monthlyBurnCents += Math.round(r.amount_cents / 12); break;
        default:         monthlyBurnCents += r.amount_cents; break;
      }
    }

    // Category breakdown (current + upcoming month)
    const categoryBreakdown = await sql`
      SELECT category,
        SUM(amount_cents) AS total_cents,
        COUNT(*) AS count
      FROM accounting_entries
      WHERE entry_type IN ('expense_recurring','expense_onetime','withdrawal','investment')
        AND status != 'cancelled'
        AND entry_date >= CURRENT_DATE - INTERVAL '30 days'
      GROUP BY category
      ORDER BY total_cents DESC
    `;

    // Last 6 months cashflow
    const cashflow = await sql`
      SELECT
        TO_CHAR(DATE_TRUNC('month', entry_date), 'YYYY-MM') AS month,
        SUM(CASE WHEN entry_type IN ('expense_recurring','expense_onetime','withdrawal','investment') AND status != 'cancelled' THEN amount_cents ELSE 0 END) AS out_cents,
        SUM(CASE WHEN entry_type IN ('income','client_payment') AND status != 'cancelled' THEN amount_cents ELSE 0 END) AS in_cents
      FROM accounting_entries
      WHERE entry_date >= CURRENT_DATE - INTERVAL '6 months'
      GROUP BY DATE_TRUNC('month', entry_date)
      ORDER BY month ASC
    `;

    // Upcoming payments (next 30 days, planned)
    const upcoming = await sql`
      SELECT * FROM accounting_entries
      WHERE status = 'planned'
        AND entry_date BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '30 days'
      ORDER BY entry_date ASC
      LIMIT 5
    `;

    const balance = balanceRow?.balance_cents ?? 5500000;
    const runway = monthlyBurnCents > 0 ? Math.round(balance / monthlyBurnCents) : 999;

    res.json({
      balance: {
        cents: balance,
        currency: balanceRow?.currency ?? "EUR",
        note: balanceRow?.note,
        updatedAt: balanceRow?.updated_at,
      },
      kpis: {
        monthlyOutCents: Number(monthly.total_out_cents),
        monthlyInCents: Number(monthly.total_in_cents),
        monthlyBurnCents,
        runwayMonths: runway,
        netCents: Number(monthly.total_in_cents) - Number(monthly.total_out_cents),
      },
      categoryBreakdown: categoryBreakdown.map((r: any) => ({
        category: r.category,
        totalCents: Number(r.total_cents),
        count: Number(r.count),
      })),
      cashflow: cashflow.map((r: any) => ({
        month: r.month,
        outCents: Number(r.out_cents),
        inCents: Number(r.in_cents),
      })),
      upcoming,
    });
  } catch (err) {
    logger.error("[ACCOUNTING] summary error", err);
    res.status(500).json({ error: "Failed to load summary" });
  } finally {
    await sql.end();
  }
});

// ============================================================================
// GET /api/admin/accounting/entries
// ============================================================================
router.get("/entries", async (req, res) => {
  const sql = getSql();
  try {
    await ensureTables(sql);
    const { type, category, status, limit = "100", offset = "0" } = req.query as Record<string, string>;

    let entries;
    if (type && type !== "all" && category && category !== "all" && status && status !== "all") {
      entries = await sql`
        SELECT * FROM accounting_entries
        WHERE entry_type = ${type} AND category = ${category} AND status = ${status}
        ORDER BY entry_date DESC, created_at DESC
        LIMIT ${Number(limit)} OFFSET ${Number(offset)}
      `;
    } else if (type && type !== "all" && category && category !== "all") {
      entries = await sql`
        SELECT * FROM accounting_entries
        WHERE entry_type = ${type} AND category = ${category}
        ORDER BY entry_date DESC, created_at DESC
        LIMIT ${Number(limit)} OFFSET ${Number(offset)}
      `;
    } else if (type && type !== "all" && status && status !== "all") {
      entries = await sql`
        SELECT * FROM accounting_entries
        WHERE entry_type = ${type} AND status = ${status}
        ORDER BY entry_date DESC, created_at DESC
        LIMIT ${Number(limit)} OFFSET ${Number(offset)}
      `;
    } else if (category && category !== "all" && status && status !== "all") {
      entries = await sql`
        SELECT * FROM accounting_entries
        WHERE category = ${category} AND status = ${status}
        ORDER BY entry_date DESC, created_at DESC
        LIMIT ${Number(limit)} OFFSET ${Number(offset)}
      `;
    } else if (type && type !== "all") {
      entries = await sql`
        SELECT * FROM accounting_entries
        WHERE entry_type = ${type}
        ORDER BY entry_date DESC, created_at DESC
        LIMIT ${Number(limit)} OFFSET ${Number(offset)}
      `;
    } else if (category && category !== "all") {
      entries = await sql`
        SELECT * FROM accounting_entries
        WHERE category = ${category}
        ORDER BY entry_date DESC, created_at DESC
        LIMIT ${Number(limit)} OFFSET ${Number(offset)}
      `;
    } else if (status && status !== "all") {
      entries = await sql`
        SELECT * FROM accounting_entries
        WHERE status = ${status}
        ORDER BY entry_date DESC, created_at DESC
        LIMIT ${Number(limit)} OFFSET ${Number(offset)}
      `;
    } else {
      entries = await sql`
        SELECT * FROM accounting_entries
        ORDER BY entry_date DESC, created_at DESC
        LIMIT ${Number(limit)} OFFSET ${Number(offset)}
      `;
    }

    res.json({ entries });
  } catch (err) {
    logger.error("[ACCOUNTING] entries error", err);
    res.status(500).json({ error: "Failed to load entries" });
  } finally {
    await sql.end();
  }
});

// ============================================================================
// POST /api/admin/accounting/entries
// Auto-adjusts balance when status === 'paid'
// ============================================================================
router.post("/entries", async (req, res) => {
  const sql = getSql();
  try {
    await ensureTables(sql);
    const {
      entry_type, category, title, description, amount_cents,
      currency = "EUR", entry_date, is_recurring = false, frequency,
      status = "planned", payment_method, payment_reference, vendor, invoice_number, tags,
    } = req.body;

    if (!title || !amount_cents || !entry_type) {
      return res.status(400).json({ error: "title, amount_cents, entry_type required" });
    }

    const cents = Number(amount_cents);

    const [entry] = await sql`
      INSERT INTO accounting_entries
        (entry_type, category, title, description, amount_cents, currency, entry_date,
         is_recurring, frequency, status, payment_method, payment_reference, vendor, invoice_number, tags)
      VALUES
        (${entry_type}, ${category ?? "misc"}, ${title}, ${description ?? null}, ${cents},
         ${currency}, ${entry_date ?? new Date().toISOString().split("T")[0]},
         ${is_recurring}, ${frequency ?? null}, ${status},
         ${payment_method ?? null}, ${payment_reference ?? null}, ${vendor ?? null},
         ${invoice_number ?? null}, ${tags ?? null})
      RETURNING *
    `;

    // Auto-adjust balance if this is a paid transaction
    if (status === "paid") {
      const delta = balanceDelta(entry_type, cents);
      if (delta !== 0) {
        await sql`
          UPDATE accounting_balance
          SET balance_cents = balance_cents + ${delta}, updated_at = NOW()
          WHERE id = (SELECT id FROM accounting_balance ORDER BY id LIMIT 1)
        `;
      }
    }

    res.status(201).json({ entry });
  } catch (err) {
    logger.error("[ACCOUNTING] create entry error", err);
    res.status(500).json({ error: "Failed to create entry" });
  } finally {
    await sql.end();
  }
});

// ============================================================================
// PATCH /api/admin/accounting/entries/:id
// Handles balance delta when amount or status changes
// ============================================================================
router.patch("/entries/:id", async (req, res) => {
  const sql = getSql();
  try {
    const { id } = req.params;
    const allowedFields = [
      "entry_type","category","title","description","amount_cents","currency",
      "entry_date","is_recurring","frequency","status","payment_method",
      "payment_reference","vendor","invoice_number","tags",
    ];

    // Fetch current state before update
    const [old] = await sql`SELECT * FROM accounting_entries WHERE id = ${Number(id)}`;
    if (!old) return res.status(404).json({ error: "Entry not found" });

    const validKeys = Object.keys(req.body).filter(k => allowedFields.includes(k));
    if (validKeys.length === 0) {
      return res.status(400).json({ error: "No valid fields to update" });
    }

    const filteredFields: Record<string, any> = {};
    for (const k of validKeys) filteredFields[k] = req.body[k];

    const [entry] = await sql`
      UPDATE accounting_entries
      SET ${sql(filteredFields, ...validKeys)}, updated_at = NOW()
      WHERE id = ${Number(id)}
      RETURNING *
    `;

    // Compute balance delta: reverse old paid effect, apply new paid effect
    const wasP = old.status === "paid";
    const isNowP = entry.status === "paid";
    const oldDelta = wasP ? balanceDelta(old.entry_type, Number(old.amount_cents)) : 0;
    const newDelta = isNowP ? balanceDelta(entry.entry_type, Number(entry.amount_cents)) : 0;
    const netDelta = newDelta - oldDelta;

    if (netDelta !== 0) {
      await sql`
        UPDATE accounting_balance
        SET balance_cents = balance_cents + ${netDelta}, updated_at = NOW()
        WHERE id = (SELECT id FROM accounting_balance ORDER BY id LIMIT 1)
      `;
    }

    res.json({ entry });
  } catch (err) {
    logger.error("[ACCOUNTING] update entry error", err);
    res.status(500).json({ error: "Failed to update entry" });
  } finally {
    await sql.end();
  }
});

// ============================================================================
// DELETE /api/admin/accounting/entries/:id
// Reverses balance delta if the entry was paid
// ============================================================================
router.delete("/entries/:id", async (req, res) => {
  const sql = getSql();
  try {
    const { id } = req.params;
    const [old] = await sql`SELECT * FROM accounting_entries WHERE id = ${Number(id)}`;

    await sql`DELETE FROM accounting_entries WHERE id = ${Number(id)}`;

    // Reverse balance effect if it was a paid transaction
    if (old && old.status === "paid") {
      const reverseDelta = -balanceDelta(old.entry_type, Number(old.amount_cents));
      if (reverseDelta !== 0) {
        await sql`
          UPDATE accounting_balance
          SET balance_cents = balance_cents + ${reverseDelta}, updated_at = NOW()
          WHERE id = (SELECT id FROM accounting_balance ORDER BY id LIMIT 1)
        `;
      }
    }

    res.json({ ok: true });
  } catch (err) {
    logger.error("[ACCOUNTING] delete entry error", err);
    res.status(500).json({ error: "Failed to delete entry" });
  } finally {
    await sql.end();
  }
});

// ============================================================================
// POST /api/admin/accounting/balance
// Update the company balance
// ============================================================================
router.post("/balance", async (req, res) => {
  const sql = getSql();
  try {
    await ensureTables(sql);
    const { balance_cents, note } = req.body;
    if (balance_cents === undefined) {
      return res.status(400).json({ error: "balance_cents required" });
    }

    const existing = await sql`SELECT id FROM accounting_balance LIMIT 1`;

    let row;
    if (existing.length > 0) {
      [row] = await sql`
        UPDATE accounting_balance
        SET balance_cents = ${Number(balance_cents)}, note = ${note ?? null}, updated_at = NOW()
        WHERE id = ${existing[0].id}
        RETURNING *
      `;
    } else {
      [row] = await sql`
        INSERT INTO accounting_balance (balance_cents, currency, note)
        VALUES (${Number(balance_cents)}, 'EUR', ${note ?? null})
        RETURNING *
      `;
    }

    res.json({ balance: row });
  } catch (err) {
    logger.error("[ACCOUNTING] update balance error", err);
    res.status(500).json({ error: "Failed to update balance" });
  } finally {
    await sql.end();
  }
});

// ============================================================================
// GET /api/admin/accounting/prediction
// AI-driven 30-day income & balance forecast
// ============================================================================
router.get("/prediction", async (req, res) => {
  const sql = getSql();
  try {
    await ensureTables(sql);

    const [balRow] = await sql`SELECT balance_cents FROM accounting_balance ORDER BY id LIMIT 1`;
    const currentBalance = Number(balRow?.balance_cents ?? 5500000);

    // Income entries over the last 60 days (paid only)
    const incomeRows = await sql`
      SELECT entry_date::text AS day, SUM(amount_cents) AS total
      FROM accounting_entries
      WHERE entry_type IN ('income','client_payment')
        AND status = 'paid'
        AND entry_date >= CURRENT_DATE - INTERVAL '60 days'
      GROUP BY entry_date
      ORDER BY entry_date ASC
    `;

    // Monthly burn (recurring costs)
    const recurringRows = await sql`
      SELECT amount_cents, frequency FROM accounting_entries
      WHERE is_recurring = TRUE AND status != 'cancelled'
    `;
    let monthlyBurnCents = 0;
    for (const r of recurringRows) {
      switch (r.frequency) {
        case "daily":     monthlyBurnCents += Number(r.amount_cents) * 30; break;
        case "weekly":    monthlyBurnCents += Number(r.amount_cents) * 4;  break;
        case "monthly":   monthlyBurnCents += Number(r.amount_cents);      break;
        case "quarterly": monthlyBurnCents += Math.round(Number(r.amount_cents) / 3); break;
        case "yearly":    monthlyBurnCents += Math.round(Number(r.amount_cents) / 12); break;
        default:          monthlyBurnCents += Number(r.amount_cents); break;
      }
    }

    if (incomeRows.length === 0) {
      return res.json({
        hasData: false,
        message: "Noch keine Einnahmen erfasst. Trage Einnahmen mit Status 'Bezahlt' ein, um Prognosen zu erhalten.",
        projectedBalance30d: currentBalance - monthlyBurnCents,
        monthlyBurnCents,
      });
    }

    // Split into last 30 vs prior 30 days
    const now = Date.now();
    const ms30 = 30 * 24 * 60 * 60 * 1000;
    const last30 = incomeRows.filter(r => new Date(r.day).getTime() >= now - ms30);
    const prev30 = incomeRows.filter(r => new Date(r.day).getTime() < now - ms30);

    const last30Total = last30.reduce((s, r) => s + Number(r.total), 0);
    const prev30Total = prev30.reduce((s, r) => s + Number(r.total), 0);

    // Growth rate (capped for sanity)
    let growthRate = 0;
    if (prev30Total > 0) {
      growthRate = Math.min(Math.max((last30Total - prev30Total) / prev30Total, -0.9), 5);
    }

    // Days with income in last 30
    const incomeDays = last30.length;
    const avgPerDay = incomeDays > 0 ? last30Total / 30 : 0; // avg over full 30d window
    const projectedIncome30d = Math.round(last30Total * (1 + growthRate));
    const projectedBalance30d = currentBalance + projectedIncome30d - monthlyBurnCents;

    // Build trend label
    let trendLabel = "Stabil";
    let trendEmoji = "→";
    if (growthRate > 0.3) { trendLabel = "Stark wachsend"; trendEmoji = "↑↑"; }
    else if (growthRate > 0.05) { trendLabel = "Wachsend"; trendEmoji = "↑"; }
    else if (growthRate < -0.3) { trendLabel = "Stark rückläufig"; trendEmoji = "↓↓"; }
    else if (growthRate < -0.05) { trendLabel = "Leicht rückläufig"; trendEmoji = "↓"; }

    // Smart message
    const pct = Math.round(Math.abs(growthRate) * 100);
    let smartMessage = "";
    if (growthRate > 0.05) {
      smartMessage = `Einnahmen wachsen ${pct}% vs. Vormonat — bei diesem Tempo erreichst du in 30 Tagen voraussichtlich ${(projectedBalance30d / 100).toLocaleString("de-DE", { minimumFractionDigits: 2 })} EUR.`;
    } else if (growthRate < -0.05) {
      smartMessage = `Einnahmen sinken um ${pct}% vs. Vormonat — prüfe Kundenpipeline. Prognose: ${(projectedBalance30d / 100).toLocaleString("de-DE", { minimumFractionDigits: 2 })} EUR in 30 Tagen.`;
    } else {
      smartMessage = `Stabile Einnahmen. Voraussichtlicher Kontostand in 30 Tagen: ${(projectedBalance30d / 100).toLocaleString("de-DE", { minimumFractionDigits: 2 })} EUR.`;
    }

    res.json({
      hasData: true,
      currentBalance,
      last30IncomeCents: last30Total,
      prev30IncomeCents: prev30Total,
      growthRate: Math.round(growthRate * 100) / 100,
      growthPct: Math.round(growthRate * 100),
      trendLabel,
      trendEmoji,
      avgDailyIncomeCents: Math.round(avgPerDay),
      projectedIncome30d,
      monthlyBurnCents,
      projectedBalance30d,
      smartMessage,
      incomeDaysLast30: incomeDays,
    });
  } catch (err) {
    logger.error("[ACCOUNTING] prediction error", err);
    res.status(500).json({ error: "Failed to compute prediction" });
  } finally {
    await sql.end();
  }
});

export default router;
