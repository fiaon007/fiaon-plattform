// ═══════════════════════════════════════════════════════════════════
// FIAON Finanz- & Sales-Analytics-Zentrale (Paket BD) — /admin/finanzen
//
// ALLE Kennzahlen werden serverseitig per SQL-Aggregat (GROUP BY / FILTER /
// SUM / COUNT) berechnet — NIE ganze Tabellen in den RAM (512MB-Limit).
// Zeitraum-Umschalter über from/to (ISO). Geld in Integer-Cents; die Anzeige
// (deutsches Format) übernimmt das Frontend.
//
// STRIKT ADDITIV: liest nur bestehende Tabellen (fiaon_applications,
// fiaon_commissions, fiaon_leads, fiaon_agents) + neue Werbebudget-Tabelle.
// ═══════════════════════════════════════════════════════════════════

import { Router, type Request, type Response } from "express";
import postgres from "postgres";
import { paidWhere, legacyPaidWhere, paidAtSql, revenueCentsSql, KPI_DEFS } from "../lib/fiaon-truth";

const router = Router();
const sqlPool = postgres(process.env.DATABASE_URL!, { ssl: "require", max: 3 });

const CENTS = revenueCentsSql();
// P2-D: DIE eine Wahrheit — zentrale Definition aus server/lib/fiaon-truth.ts.
const PAID = paidWhere();
const PAID_A = paidWhere("a");
const LEGACY = legacyPaidWhere();
const PAID_AT = paidAtSql();
const PAID_AT_A = paidAtSql("a");

let budgetEnsured = false;
async function ensureBudgetTable(): Promise<void> {
  if (budgetEnsured) return;
  await sqlPool`
    CREATE TABLE IF NOT EXISTS fiaon_ad_spend (
      id SERIAL PRIMARY KEY,
      campaign VARCHAR,                 -- NULL = Gesamt/übergreifend
      amount_cents INTEGER NOT NULL,
      period_start DATE NOT NULL,
      period_end DATE NOT NULL,
      note TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;
  await sqlPool`CREATE INDEX IF NOT EXISTS fiaon_ad_spend_period_idx ON fiaon_ad_spend (period_start)`;
  budgetEnsured = true;
}

/** Zeitraum aus Query — Default: letzte 30 Tage. Immer serverseitig geparst. */
function parseRange(req: Request): { from: Date; to: Date } {
  const now = new Date();
  const toRaw = typeof req.query.to === "string" ? new Date(req.query.to) : now;
  const fromRaw = typeof req.query.from === "string" ? new Date(req.query.from) : new Date(now.getTime() - 30 * 864e5);
  const to = isNaN(toRaw.getTime()) ? now : toRaw;
  const from = isNaN(fromRaw.getTime()) ? new Date(to.getTime() - 30 * 864e5) : fromRaw;
  return { from, to };
}

function rate(a: number, b: number): number | null {
  return b > 0 ? Math.round((a / b) * 1000) / 10 : null; // 1 Dezimalstelle
}
/** Wie rate(), aber sichtbar auf 0–100 % gedeckelt (CA: keine unmöglichen Werte). */
function rateCapped(a: number, b: number): number | null {
  const r = rate(a, b);
  return r === null ? null : Math.min(100, Math.max(0, r));
}

// ═══════════════ BD1–BD2 + BD5 — Übersicht (Funnel, Umsatz, CAC, Zeitreihen) ═══════════════
router.get("/admin/finance/overview", async (req: Request, res: Response) => {
  try {
    await ensureBudgetTable();
    const { from, to } = parseRange(req);

    // ── BD1/CA: Zwei getrennte Funnels (serverseitig aggregiert) ──
    //
    // LEAD-FUNNEL: NUR Leads und ihre daraus konvertierten Anträge (converted_order_id).
    // Jede Stufe ist eine echte Teilmenge der vorherigen ⇒ Raten immer 0–100 %.
    // Direktkunden ohne Lead tauchen hier NICHT auf und verzerren die Quote nicht.
    // P2-D/ehrlich: „kontaktiert" (status <> 'neu') entsteht durch Massenmail und heißt
    // deshalb jetzt ANGESCHRIEBEN. Echter Kontakt = dokumentiertes Agenten-Ergebnis (Lead-Log).
    const [lf] = await sqlPool.unsafe(`
      SELECT
        COUNT(*)::int AS leads,
        COUNT(*) FILTER (WHERE l.status <> 'neu')::int AS angeschrieben,
        COUNT(*) FILTER (WHERE EXISTS (
          SELECT 1 FROM fiaon_lead_log g WHERE g.lead_id = l.id AND g.agent_id IS NOT NULL AND g.type = 'result'
        ))::int AS kontaktiert_echt,
        COUNT(*) FILTER (WHERE l.status = 'konvertiert')::int AS antraege,
        COUNT(*) FILTER (WHERE a.claimed_paid_at IS NOT NULL OR (${PAID_A}))::int AS angekuendigt,
        COUNT(*) FILTER (WHERE ${PAID_A})::int AS bezahlt
      FROM fiaon_leads l
      LEFT JOIN fiaon_applications a ON a.ref = l.converted_order_id AND a.merged_into IS NULL
      WHERE l.erstellt_am >= $1 AND l.erstellt_am <= $2
    `, [from, to]).then((r: any) => [r[0]]);
    // GESAMT-FUNNEL (inkl. Direktkunden): ALLE Anträge im Zeitraum. Stufen kumulativ
    // definiert (Antrag ⊇ angekündigt ⊇ bezahlt) ⇒ Raten immer 0–100 %.
    const [gf] = await sqlPool.unsafe(`
      SELECT
        COUNT(*) FILTER (WHERE payment_reference IS NOT NULL OR claimed_paid_at IS NOT NULL OR payment_status = 'paid')::int AS antraege,
        COUNT(*) FILTER (WHERE payment_reference IS NOT NULL AND (claimed_paid_at IS NOT NULL OR payment_status = 'paid'))::int AS angekuendigt,
        COUNT(*) FILTER (WHERE ${PAID})::int AS bezahlt
      FROM fiaon_applications
      WHERE merged_into IS NULL AND created_at >= $1 AND created_at <= $2
    `, [from, to]).then((r: any) => [r[0]]);
    const leadFunnel = {
      leads: Number(lf.leads),
      // "kontaktiert" bleibt als Feldname für Abwärtskompatibilität = ANGESCHRIEBEN
      kontaktiert: Number(lf.angeschrieben), angeschrieben: Number(lf.angeschrieben),
      kontaktiertEcht: Number(lf.kontaktiert_echt),
      antraege: Number(lf.antraege),
      angekuendigt: Number(lf.angekuendigt), bezahlt: Number(lf.bezahlt),
    };
    const gesamtFunnel = {
      antraege: Number(gf.antraege), angekuendigt: Number(gf.angekuendigt), bezahlt: Number(gf.bezahlt),
    };
    const funnel = {
      // Zwei klar beschriftete Sichten
      lead: leadFunnel,
      gesamt: gesamtFunnel,
    };
    const funnelRates = {
      lead: {
        leadToKontaktiert: rateCapped(leadFunnel.kontaktiert, leadFunnel.leads),
        kontaktiertToAntrag: rateCapped(leadFunnel.antraege, leadFunnel.kontaktiert),
        antragToAngekuendigt: rateCapped(leadFunnel.angekuendigt, leadFunnel.antraege),
        angekuendigtToBezahlt: rateCapped(leadFunnel.bezahlt, leadFunnel.angekuendigt),
        gesamtLeadToBezahlt: rateCapped(leadFunnel.bezahlt, leadFunnel.leads),
        // CE: „Konvertiert %" identisch definiert wie /admin/leads (konvertierte ÷ gesamt).
        konvertiertPct: rateCapped(leadFunnel.antraege, leadFunnel.leads),
      },
      gesamt: {
        antragToAngekuendigt: rateCapped(gesamtFunnel.angekuendigt, gesamtFunnel.antraege),
        angekuendigtToBezahlt: rateCapped(gesamtFunnel.bezahlt, gesamtFunnel.angekuendigt),
        antragToBezahlt: rateCapped(gesamtFunnel.bezahlt, gesamtFunnel.antraege),
      },
    };

    // ── BD2: Umsatz — NUR die eine Wahrheit, Zeit-Anker completed_at (nie updated_at) ──
    const [rev] = await sqlPool.unsafe(`
      SELECT
        COALESCE(SUM(${CENTS}), 0)::bigint AS umsatz_cents,
        COUNT(*)::int AS bezahlt_count
      FROM fiaon_applications
      WHERE ${PAID}
        AND ${PAID_AT} >= $1 AND ${PAID_AT} <= $2
    `, [from, to]);
    const umsatzCents = Number(rev.umsatz_cents);
    const bezahltCount = Number(rev.bezahlt_count);

    const [comm] = await sqlPool`
      SELECT COALESCE(SUM(amount_cents), 0)::bigint AS prov_cents
      FROM fiaon_commissions
      WHERE status <> 'storniert' AND created_at >= ${from} AND created_at <= ${to}
    `;
    const provCents = Number(comm.prov_cents);
    const nettoCents = umsatzCents - provCents;
    const aovCents = bezahltCount > 0 ? Math.round(umsatzCents / bezahltCount) : 0;

    // Umsatz je Paket-Tier
    const perTier = await sqlPool.unsafe(`
      SELECT COALESCE(pack_name, '—') AS pack, COUNT(*)::int AS c, COALESCE(SUM(${CENTS}), 0)::bigint AS cents
      FROM fiaon_applications
      WHERE ${PAID}
        AND ${PAID_AT} >= $1 AND ${PAID_AT} <= $2
      GROUP BY pack_name ORDER BY cents DESC
    `, [from, to]);

    // Bestand (all-time bezahlt) + Alt-Bestand GETRENNT ausgewiesen (ehrlich, D3)
    const [stock] = await sqlPool.unsafe(`
      SELECT
        COUNT(*) FILTER (WHERE ${PAID})::int AS c,
        COUNT(*) FILTER (WHERE ${LEGACY})::int AS legacy_c,
        COUNT(*) FILTER (WHERE ${LEGACY} AND (amount_due IS NULL OR amount_due = 0))::int AS legacy_no_amount
      FROM fiaon_applications
    `).then((r: any) => [r[0]]);

    // ── BD2: CAC / Lead-Kosten (nur wenn Budget eingetragen) ──
    const [spendRow] = await sqlPool`
      SELECT COALESCE(SUM(amount_cents), 0)::bigint AS spend_cents
      FROM fiaon_ad_spend WHERE period_start >= ${from}::date AND period_start <= ${to}::date
    `;
    const spendCents = Number(spendRow.spend_cents);
    const hasBudget = spendCents > 0;
    const cacCents = hasBudget && bezahltCount > 0 ? Math.round(spendCents / bezahltCount) : null;
    const leadCostCents = hasBudget && leadFunnel.leads > 0 ? Math.round(spendCents / leadFunnel.leads) : null;
    // LTV konservativ: Ø-Abschlusswert × angenommene Laufzeit (transparent ausgewiesen)
    const assumedLifetimeMonths = 12;
    const ltvCents = aovCents * assumedLifetimeMonths;
    const ltvCacRatio = cacCents && cacCents > 0 ? Math.round((ltvCents / cacCents) * 10) / 10 : null;

    // ── BD5: Zeitreihen (Tagesreihen, aggregiert) ──
    const revSeries = await sqlPool.unsafe(`
      SELECT (${PAID_AT} AT TIME ZONE 'Europe/Berlin')::date AS d,
             COALESCE(SUM(${CENTS}), 0)::bigint AS cents, COUNT(*)::int AS c
      FROM fiaon_applications
      WHERE ${PAID}
        AND ${PAID_AT} >= $1 AND ${PAID_AT} <= $2
      GROUP BY d ORDER BY d
    `, [from, to]);
    const leadSeries = await sqlPool`
      SELECT (erstellt_am AT TIME ZONE 'Europe/Berlin')::date AS d, COUNT(*)::int AS c
      FROM fiaon_leads WHERE erstellt_am >= ${from} AND erstellt_am <= ${to}
      GROUP BY d ORDER BY d
    `;

    res.json({
      ok: true,
      range: { from: from.toISOString(), to: to.toISOString() },
      funnel, funnelRates,
      revenue: {
        umsatzCents, provisionenCents: provCents, nettoCents,
        margePct: umsatzCents > 0 ? Math.round((nettoCents / umsatzCents) * 1000) / 10 : null,
        bezahltCount, aovCents,
        perTier: perTier.map((r: any) => ({ pack: r.pack, count: Number(r.c), cents: Number(r.cents) })),
        bestandCount: Number(stock.c),
        // Alt-Import (D3): getrennt ausgewiesen, fließt NIE in Umsatz/Funnel
        altbestandCount: Number(stock.legacy_c),
        altbestandOhneBetrag: Number(stock.legacy_no_amount),
      },
      cac: { hasBudget, spendCents, cacCents, leadCostCents, ltvCents, assumedLifetimeMonths, ltvCacRatio },
      kpiDefs: KPI_DEFS,
      series: {
        revenue: revSeries.map((r: any) => ({ date: r.d, cents: Number(r.cents), count: Number(r.c) })),
        leads: leadSeries.map((r: any) => ({ date: r.d, count: Number(r.c) })),
      },
    });
  } catch (err) {
    console.error("[FIAON-FINANCE] overview:", err);
    res.status(500).json({ ok: false, error: "Serverfehler" });
  }
});

// ═══════════════ BD3 — Quellen-/Kampagnen-Attribution ═══════════════
router.get("/admin/finance/attribution", async (req: Request, res: Response) => {
  try {
    await ensureBudgetTable();
    const { from, to } = parseRange(req);
    // Leads + Konversionen je Quelle/Kampagne, Umsatz aus verknüpften bezahlten Anträgen.
    const rows = await sqlPool.unsafe(`
      SELECT
        COALESCE(NULLIF(l.kampagne, ''), l.quelle, '—') AS bucket,
        l.quelle AS quelle,
        COUNT(*)::int AS leads,
        COUNT(*) FILTER (WHERE l.status = 'konvertiert')::int AS konversionen,
        COALESCE(SUM(CASE WHEN ${PAID_A} THEN ${revenueCentsSql("a")} ELSE 0 END), 0)::bigint AS umsatz_cents
      FROM fiaon_leads l
      LEFT JOIN fiaon_applications a ON a.ref = l.converted_order_id
      WHERE l.erstellt_am >= $1 AND l.erstellt_am <= $2
      GROUP BY bucket, l.quelle
      ORDER BY leads DESC
    `, [from, to]);

    // Kampagnen-Budget (für CAC je Kampagne)
    const spend = await sqlPool`
      SELECT campaign, COALESCE(SUM(amount_cents),0)::bigint AS cents
      FROM fiaon_ad_spend WHERE period_start >= ${from}::date AND period_start <= ${to}::date
      GROUP BY campaign
    `;
    const spendMap: Record<string, number> = {};
    for (const s of spend) spendMap[s.campaign || "__gesamt__"] = Number(s.cents);

    const data = rows.map((r: any) => {
      const leads = Number(r.leads);
      const konv = Number(r.konversionen);
      const spendCents = spendMap[r.bucket] ?? null;
      return {
        bucket: r.bucket,
        quelle: r.quelle,
        leads,
        konversionen: konv,
        conversionRate: rate(konv, leads),
        umsatzCents: Number(r.umsatz_cents),
        spendCents,
        cacCents: spendCents && konv > 0 ? Math.round(spendCents / konv) : null,
      };
    });
    res.json({ ok: true, data, range: { from: from.toISOString(), to: to.toISOString() } });
  } catch (err) {
    console.error("[FIAON-FINANCE] attribution:", err);
    res.status(500).json({ ok: false, error: "Serverfehler" });
  }
});

// ═══════════════ BD4 — Team-/Sales-Performance ═══════════════
router.get("/admin/finance/team", async (req: Request, res: Response) => {
  try {
    const { from, to } = parseRange(req);
    const rows = await sqlPool.unsafe(`
      SELECT ag.id, ag.name,
        (SELECT COUNT(*) FROM fiaon_leads l WHERE l.assigned_agent_id = ag.id AND l.erstellt_am >= $1 AND l.erstellt_am <= $2)::int AS leads,
        (SELECT COUNT(*) FROM fiaon_leads l WHERE l.assigned_agent_id = ag.id AND l.status = 'konvertiert' AND l.konvertiert_am >= $1 AND l.konvertiert_am <= $2)::int AS lead_konversionen,
        (SELECT COUNT(*) FROM fiaon_applications a WHERE a.assigned_agent_id = ag.id AND a.created_at >= $1 AND a.created_at <= $2 AND a.merged_into IS NULL)::int AS kunden,
        (SELECT COUNT(*) FROM fiaon_applications a WHERE a.assigned_agent_id = ag.id AND ${PAID_A} AND ${PAID_AT_A} >= $1 AND ${PAID_AT_A} <= $2)::int AS abschluesse,
        (SELECT COALESCE(SUM(${revenueCentsSql("a")}),0) FROM fiaon_applications a WHERE a.assigned_agent_id = ag.id AND ${PAID_A} AND ${PAID_AT_A} >= $1 AND ${PAID_AT_A} <= $2)::bigint AS umsatz_cents,
        (SELECT COALESCE(SUM(c.amount_cents),0) FROM fiaon_commissions c WHERE c.agent_id = ag.id AND c.status <> 'storniert' AND c.created_at >= $1 AND c.created_at <= $2)::bigint AS provision_cents
      FROM fiaon_agents ag
      WHERE ag.active = TRUE
      ORDER BY umsatz_cents DESC
    `, [from, to]);
    const data = rows.map((r: any) => {
      const leads = Number(r.leads), kunden = Number(r.kunden), abschluesse = Number(r.abschluesse);
      return {
        id: r.id, name: r.name,
        leads, leadKonversionen: Number(r.lead_konversionen),
        kunden, abschluesse,
        kontaktquote: rate(abschluesse, kunden),
        umsatzCents: Number(r.umsatz_cents),
        provisionCents: Number(r.provision_cents),
      };
    });
    res.json({ ok: true, data, range: { from: from.toISOString(), to: to.toISOString() } });
  } catch (err) {
    console.error("[FIAON-FINANCE] team:", err);
    res.status(500).json({ ok: false, error: "Serverfehler" });
  }
});

// ═══════════════ P2-D Selbstcheck: „bezahlt" muss überall identisch sein ═══════════════
// Rechnet die Bezahlt-Zahl mit der Definition JEDER Ansicht nach. Nach Phase 2
// nutzen alle dieselbe zentrale Definition — weicht hier je etwas ab, ist ein
// Copy-Paste-SQL zurückgekommen. Leads „Zahlend" ist bewusst eine Teilmenge
// (nur Lead-Konversionen) und wird getrennt ausgewiesen.
router.get("/admin/truth-check", async (_req: Request, res: Response) => {
  try {
    const [r] = await sqlPool.unsafe(`
      SELECT
        (SELECT COUNT(*) FROM fiaon_applications WHERE payment_status = 'paid' AND payment_reference IS NOT NULL AND merged_into IS NULL)::int AS zahlungszentrale,
        (SELECT COUNT(*) FROM fiaon_applications WHERE ${PAID})::int AS finanzen_bestand,
        (SELECT COUNT(*) FROM fiaon_applications WHERE ${LEGACY})::int AS altbestand,
        (SELECT COUNT(DISTINCT a.ref) FROM fiaon_leads l JOIN fiaon_applications a ON a.ref = l.converted_order_id WHERE ${PAID_A})::int AS leads_zahlend
    `);
    const identical = Number(r.zahlungszentrale) === Number(r.finanzen_bestand);
    res.json({
      ok: true,
      identical,
      bezahlt: Number(r.finanzen_bestand),
      ansichten: {
        zahlungszentrale: Number(r.zahlungszentrale),
        finanzenBestand: Number(r.finanzen_bestand),
        leadsZahlend: Number(r.leads_zahlend),
      },
      altbestand: Number(r.altbestand),
      hinweis: identical
        ? "Alle Ansichten nutzen die eine Wahrheit. Leads-Zahlend ist eine gekennzeichnete Teilmenge (nur Lead-Konversionen)."
        : "ABWEICHUNG — eine Ansicht nutzt nicht die zentrale Definition!",
      definition: KPI_DEFS.bezahlt,
    });
  } catch (err) {
    console.error("[FIAON-FINANCE] truth-check:", err);
    res.status(500).json({ ok: false, error: "Serverfehler" });
  }
});

// ═══════════════ CAC-Budget (BD2) — Werbebudget eintragen/verwalten ═══════════════
router.get("/admin/finance/budget", async (_req: Request, res: Response) => {
  try {
    await ensureBudgetTable();
    const rows = await sqlPool`SELECT id, campaign, amount_cents, period_start, period_end, note, created_at FROM fiaon_ad_spend ORDER BY period_start DESC`;
    res.json({ ok: true, data: rows });
  } catch (err) {
    console.error("[FIAON-FINANCE] budget list:", err);
    res.status(500).json({ ok: false, error: "Serverfehler" });
  }
});

router.post("/admin/finance/budget", async (req: Request, res: Response) => {
  try {
    await ensureBudgetTable();
    const { campaign, amountEur, periodStart, periodEnd, note } = req.body || {};
    const cents = Math.round(Number(amountEur) * 100);
    if (!Number.isFinite(cents) || cents < 0) return res.status(400).json({ ok: false, error: "Betrag ungültig" });
    if (!periodStart || !periodEnd) return res.status(400).json({ ok: false, error: "Zeitraum erforderlich" });
    const rows = await sqlPool`
      INSERT INTO fiaon_ad_spend (campaign, amount_cents, period_start, period_end, note)
      VALUES (${campaign || null}, ${cents}, ${periodStart}, ${periodEnd}, ${note || null})
      RETURNING id
    `;
    res.json({ ok: true, id: rows[0].id });
  } catch (err) {
    console.error("[FIAON-FINANCE] budget add:", err);
    res.status(500).json({ ok: false, error: "Serverfehler" });
  }
});

router.delete("/admin/finance/budget/:id", async (req: Request, res: Response) => {
  try {
    await ensureBudgetTable();
    await sqlPool`DELETE FROM fiaon_ad_spend WHERE id = ${Number(req.params.id)}`;
    res.json({ ok: true });
  } catch (err) {
    console.error("[FIAON-FINANCE] budget delete:", err);
    res.status(500).json({ ok: false, error: "Serverfehler" });
  }
});

// ═══════════════ BD5 — CSV-Export je Ansicht ═══════════════
function toCsv(headers: string[], rows: (string | number | null)[][]): string {
  const esc = (v: string | number | null) => {
    const s = v === null || v === undefined ? "" : String(v);
    return /[",\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return [headers.join(";"), ...rows.map((r) => r.map(esc).join(";"))].join("\n");
}
function eur(cents: number): string {
  return (cents / 100).toFixed(2).replace(".", ",");
}

router.get("/admin/finance/export/:view.csv", async (req: Request, res: Response) => {
  try {
    await ensureBudgetTable();
    const { from, to } = parseRange(req);
    const view = req.params.view;
    let csv = "";
    if (view === "attribution") {
      const rows = await sqlPool.unsafe(`
        SELECT COALESCE(NULLIF(l.kampagne,''), l.quelle, '—') AS bucket, l.quelle AS quelle,
          COUNT(*)::int AS leads, COUNT(*) FILTER (WHERE l.status='konvertiert')::int AS konv,
          COALESCE(SUM(CASE WHEN ${PAID_A} THEN ${revenueCentsSql("a")} ELSE 0 END),0)::bigint AS cents
        FROM fiaon_leads l LEFT JOIN fiaon_applications a ON a.ref = l.converted_order_id
        WHERE l.erstellt_am >= $1 AND l.erstellt_am <= $2 GROUP BY bucket, l.quelle ORDER BY leads DESC
      `, [from, to]);
      csv = toCsv(["Kampagne/Quelle", "Quelle", "Leads", "Konversionen", "Conversion-Rate %", "Umsatz EUR"],
        rows.map((r: any) => [r.bucket, r.quelle, Number(r.leads), Number(r.konv), rate(Number(r.konv), Number(r.leads)) ?? "", eur(Number(r.cents))]));
    } else if (view === "team") {
      const rows = await sqlPool.unsafe(`
        SELECT ag.name,
          (SELECT COUNT(*) FROM fiaon_leads l WHERE l.assigned_agent_id=ag.id AND l.erstellt_am>=$1 AND l.erstellt_am<=$2)::int AS leads,
          (SELECT COUNT(*) FROM fiaon_applications a WHERE a.assigned_agent_id=ag.id AND ${PAID_A} AND ${PAID_AT_A}>=$1 AND ${PAID_AT_A}<=$2)::int AS abschluesse,
          (SELECT COALESCE(SUM(${revenueCentsSql("a")}),0) FROM fiaon_applications a WHERE a.assigned_agent_id=ag.id AND ${PAID_A} AND ${PAID_AT_A}>=$1 AND ${PAID_AT_A}<=$2)::bigint AS umsatz,
          (SELECT COALESCE(SUM(c.amount_cents),0) FROM fiaon_commissions c WHERE c.agent_id=ag.id AND c.status<>'storniert' AND c.created_at>=$1 AND c.created_at<=$2)::bigint AS prov
        FROM fiaon_agents ag WHERE ag.active=TRUE ORDER BY umsatz DESC
      `, [from, to]);
      csv = toCsv(["Mitarbeiter", "Leads", "Abschlüsse", "Umsatz EUR", "Provision EUR"],
        rows.map((r: any) => [r.name, Number(r.leads), Number(r.abschluesse), eur(Number(r.umsatz)), eur(Number(r.prov))]));
    } else {
      // Default: bezahlte Umsätze (Buchhaltung)
      const rows = await sqlPool.unsafe(`
        SELECT ref, payment_reference, invoice_number, pack_name, ${CENTS}::bigint AS cents,
          (${PAID_AT} AT TIME ZONE 'Europe/Berlin')::date AS d
        FROM fiaon_applications
        WHERE ${PAID} AND ${PAID_AT}>=$1 AND ${PAID_AT}<=$2
        ORDER BY d
      `, [from, to]);
      csv = toCsv(["Referenz", "Zahlungsreferenz", "Rechnungsnr.", "Paket", "Betrag EUR", "Datum"],
        rows.map((r: any) => [r.ref, r.payment_reference, r.invoice_number, r.pack_name, eur(Number(r.cents)), r.d]));
    }
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="fiaon-${view}.csv"`);
    res.send("\uFEFF" + csv); // BOM für Excel/Umlaute
  } catch (err) {
    console.error("[FIAON-FINANCE] export:", err);
    res.status(500).json({ ok: false, error: "Serverfehler" });
  }
});

export default router;
