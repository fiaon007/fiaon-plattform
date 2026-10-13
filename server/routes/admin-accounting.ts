import { Router, Request, Response, NextFunction } from "express";
import postgres from "postgres";
import { logger } from "../logger";
import { adminZugriff } from "../lib/fiaon-admin-wache";
import { readChef } from "./fiaon-chef-zugang";
import { sqlPool } from "../lib/db-pool";
import { UMSATZ_QUELLE_SQL } from "../lib/fiaon-umsatz-quelle";
import { liveKontostand } from "../lib/fiaon-banking";
import { umsatzBausteine, geldAbgleich } from "./fiaon-chef-zahlen";

const router = Router();

// Admin access check — accepts Passport-authenticated admins OR valid X-Admin-Token header.
// This matches the security model of the rest of the admin section (URL-based access).
// 06.09.2026: kein festes Kennwort mehr im Quelltext — Admin-Code, Chef-Token „inhaber“ oder ADMIN_TOKEN
// aus der Umgebung. Siehe lib/fiaon-admin-wache.ts.
// E-343 (13.10.2026): Die Seite steht im Chefbüro ab Stufe Geschäftsführung (chef-seiten.tsx „buchhaltung“) —
// der Server ließ nur den Inhaber durch, und die Seite zeigte der Geschäftsführung einen Ersatzwert.
router.use((req: Request, res: Response, next: NextFunction) => {
  const st = readChef(req)?.stufe;
  if (st === "inhaber" || st === "geschaeftsfuehrung") { next(); return; }
  adminZugriff(req, res, next);
});

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
// E-343 (13.10.2026): EINNAHMEN UND KONTOSTAND AUS DER WAHRHEIT
// Vorher: „Monat Einnahmen", „Einnahmen letzte 30T" und die Prognose lasen nur die
// Handtabelle accounting_entries (8 Zeilen, letzte 01.06., alles Entnahmen) → 0 €;
// der „Kontostand" 18.700 € war ein Handwert vom 25.05., als aktuell angezeigt.
// Jetzt: Einnahmen = UMSATZ_QUELLE_SQL / umsatzBausteine() (dieselbe Zahl wie das
// Chefbüro; Handeinträge „Einnahme" zählen dort nicht, sonst stünde Kundengeld doppelt).
// Kontostand = live von der Bank (Airwallex); geht das nicht, bleibt der Handwert —
// aber als „von Hand, Stand <Datum>" bezeichnet, daneben die gebuchten Bankeingänge.
// ============================================================================
interface Kontostand {
  cents: number; currency: string; note: string | null; updatedAt: string | null;
  quelle: "live" | "hand"; handCents: number; handUpdatedAt: string | null;
}

async function kontostand(sql: ReturnType<typeof getSql>): Promise<Kontostand> {
  const [hand] = await sql`SELECT balance_cents, currency, note, updated_at FROM accounting_balance ORDER BY id LIMIT 1`;
  const handCents = Number(hand?.balance_cents ?? 5500000);
  const handUpdatedAt = hand?.updated_at ? new Date(hand.updated_at).toISOString() : null;
  const live = await liveKontostand().catch((e: unknown) => ({ ok: false as const, grund: String((e as Error)?.message || e).slice(0, 80) }));
  if (live.ok && "cents" in live && live.cents != null) {
    const unterwegs = Number((live as any).schwebendCents || 0);
    return {
      cents: live.cents, currency: "EUR", quelle: "live", handCents, handUpdatedAt,
      note: `Live von der Bank (Airwallex)${unterwegs > 0 ? ` · davon unterwegs ${(unterwegs / 100).toLocaleString("de-DE", { minimumFractionDigits: 2 })} €` : ""}`,
      updatedAt: (live as any).stand ?? new Date().toISOString(),
    };
  }
  return {
    cents: handCents, currency: hand?.currency ?? "EUR", quelle: "hand", handCents, handUpdatedAt,
    note: [`Von Hand eingetragen — kein Live-Kontostand${live.grund ? ` (${live.grund})` : ""}`, hand?.note].filter(Boolean).join(" · "),
    updatedAt: handUpdatedAt,
  };
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

    // E-343: Kontostand (live oder klar als Handwert), Einnahmen aus der einen Quelle, Bankeingänge daneben.
    const [konto, umsatz, abgleich] = await Promise.all([kontostand(sql), umsatzBausteine(), geldAbgleich()]);

    // Ausgaben des laufenden Berliner Monats (Handtabelle) — Einnahmen kommen aus umsatz.monatCents.
    const [monthly] = await sql`
      SELECT
        COALESCE(SUM(CASE WHEN entry_type IN ('expense_recurring','expense_onetime','withdrawal','investment') AND status != 'cancelled' THEN amount_cents ELSE 0 END), 0) AS total_out_cents
      FROM accounting_entries
      WHERE DATE_TRUNC('month', entry_date) = DATE_TRUNC('month', (NOW() AT TIME ZONE 'Europe/Berlin')::date)
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

    // Cashflow der letzten 6 Berliner Monate: Ausgaben aus der Handtabelle, Einnahmen (E-343) aus umsatz.verlauf.
    const cashflowOut = await sql`
      SELECT TO_CHAR(m, 'YYYY-MM') AS month,
        COALESCE((SELECT SUM(e.amount_cents) FROM accounting_entries e
           WHERE DATE_TRUNC('month', e.entry_date) = m
             AND e.entry_type IN ('expense_recurring','expense_onetime','withdrawal','investment') AND e.status != 'cancelled'), 0) AS out_cents
      FROM generate_series(DATE_TRUNC('month', (NOW() AT TIME ZONE 'Europe/Berlin')::date) - INTERVAL '5 months',
                           DATE_TRUNC('month', (NOW() AT TIME ZONE 'Europe/Berlin')::date), INTERVAL '1 month') AS m
      ORDER BY m ASC
    `;
    const inJeMonat = new Map(umsatz.verlauf.map((v): [string, number] => [v.monat, v.ratenCents + v.auskunftCents + v.globalCents]));
    const cashflow = cashflowOut.map((r: any) => ({ month: String(r.month), out_cents: r.out_cents, in_cents: inJeMonat.get(String(r.month)) ?? 0 }));

    // Upcoming payments (next 30 days, planned)
    const upcoming = await sql`
      SELECT * FROM accounting_entries
      WHERE status = 'planned'
        AND entry_date BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '30 days'
      ORDER BY entry_date ASC
      LIMIT 5
    `;

    const balance = konto.cents;
    const runway = monthlyBurnCents > 0 ? Math.round(balance / monthlyBurnCents) : 999;
    const monthlyInCents = umsatz.monatCents;

    res.json({
      balance: konto,
      kpis: {
        monthlyOutCents: Number(monthly.total_out_cents),
        monthlyInCents,
        monthlyInCount: umsatz.monatAnzahl,
        // Gegenprobe: was die Bank diesen Monat als Kundengeld gebucht hat (ohne „kein Kundengeld").
        bankInMonthCents: abgleich.monat.bankCents,
        bankInMonthCount: abgleich.monat.bankAnzahl,
        monthlyBurnCents,
        runwayMonths: runway,
        netCents: monthlyInCents - Number(monthly.total_out_cents),
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

    const konto = await kontostand(sql);
    const currentBalance = konto.cents;

    // E-343: Einnahmen der letzten 60 Berliner Tage aus der einen Quelle (heute eingeschlossen) —
    // vorher Handeinträge „Einnahme" (es gab keine → immer „keine Daten").
    const [ein] = (await sqlPool.unsafe(`
      WITH q AS (${UMSATZ_QUELLE_SQL}),
      t AS (SELECT (am AT TIME ZONE 'Europe/Berlin')::date AS tag, cents FROM q),
      h AS (SELECT (NOW() AT TIME ZONE 'Europe/Berlin')::date AS heute)
      SELECT COALESCE(SUM(t.cents) FILTER (WHERE t.tag > h.heute - 30 AND t.tag <= h.heute), 0)::bigint AS last30,
             COALESCE(SUM(t.cents) FILTER (WHERE t.tag > h.heute - 60 AND t.tag <= h.heute - 30), 0)::bigint AS prev30,
             COUNT(DISTINCT t.tag) FILTER (WHERE t.tag > h.heute - 30 AND t.tag <= h.heute)::int AS tage30
        FROM t CROSS JOIN h`)) as any[];

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

    const last30Total = Number(ein?.last30 ?? 0);
    const prev30Total = Number(ein?.prev30 ?? 0);
    if (last30Total === 0 && prev30Total === 0) {
      return res.json({
        hasData: false,
        message: "Keine gebuchten Zahlungen in den letzten 60 Tagen.",
        projectedBalance30d: currentBalance - monthlyBurnCents,
        monthlyBurnCents,
      });
    }

    // Growth rate (capped for sanity)
    let growthRate = 0;
    if (prev30Total > 0) {
      growthRate = Math.min(Math.max((last30Total - prev30Total) / prev30Total, -0.9), 5);
    }

    // Days with income in last 30
    const incomeDays = Number(ein?.tage30 ?? 0);
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
      balanceSource: konto.quelle,
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
