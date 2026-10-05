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
import { sqlPool } from "../lib/db-pool";
import { paidWhere, legacyPaidWhere, paidAtSql, revenueCentsSql, KPI_DEFS } from "../lib/fiaon-truth";
import { geldSql } from "../lib/fiaon-mara-bilanz";
import { produktkategorieSql } from "../lib/fiaon-produktkategorie";
import { ALT_SCHRITTE, NEU_SCHRITTE, weicheStand } from "../lib/fiaon-antrag-weiche";
import { abgeschicktSql } from "@shared/fiaon-antrag-stand";
import { BUENDEL_WUNSCH_VERMERK } from "@shared/fiaon-auskunft-buendel";

const router = Router();

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
        -- „Antrag" heißt: Rechnung angefordert (oder weiter). Vorher stand hier
        -- die Bedingung „payment_reference IS NOT NULL"; seit 08.08.2026 hat jede
        -- Bestellung eine Referenz, und der Funnel hätte plötzlich jeden
        -- abgebrochenen Formularaufruf als Antrag gezählt.
        COUNT(*) FILTER (WHERE payment_status <> 'pending' OR claimed_paid_at IS NOT NULL OR payment_status = 'paid')::int AS antraege,
        COUNT(*) FILTER (WHERE payment_status <> 'pending' AND (claimed_paid_at IS NOT NULL OR payment_status = 'paid'))::int AS angekuendigt,
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

// ═══════════════ E-282 — ANTRAGSWEG: ALT GEGEN NEU (05.10.2026) ═══════════════
//
// Justin: „ich will später wissen, wie der Weg performt und wie das alte".
// Zwei Quellen, je Weg dieselbe Rechnung:
//
// 1. MESSUNG (fiaon_antrag_ereignisse): Sitzung = Zufallskennung je Tab. Gezählt
//    werden Sitzungen mit „geoeffnet" im Zeitraum; ihre Ereignisse bis einen Tag
//    nach Zeitraumende gehören dazu. Trichter = Sitzungen je Schritt, Abbruch =
//    letzter Schritt einer Sitzung ohne „angenommen", Feldfehler nur als
//    Feldname. Zuerst der Zeitraum über den Index (weg, am), dann einmal
//    MATERIALIZED — jede Kennzahl liest dieselbe kleine Menge.
// 2. ANTRÄGE (fiaon_applications), Kohorte „im Zeitraum angelegt": neu =
//    antrag_weg 'neu'; alt = antrag_weg leer, privat, Produkt „konto" und mit
//    Browserkennung (nur POST /application schreibt user_agent — Betreuer-
//    Anlage und Akte-Anker nicht; Faustregel aus dem Bestandsbericht, nicht
//    gegen jede Zeile geprüft). Bezahlt heißt: Rate 1 gebucht (geldSql, die
//    Geld-Wahrheit wie /chef/zahlen), bis heute. Ohne Testpersonen, ohne Dubletten.
//
// Vor Beginn der Messung (alter Weg vor dem 05.10.2026) zählt die Sitzungen
// hilfsweise fiaon_click_events auf /antrag — gekennzeichnet, denn dort steht
// nur, wer mindestens ein Paket gewählt oder einen Schritt gewechselt hat.

type Zaehler = Record<string, number>;

function schrittListe(
  reihe: { schritt: string; label: string }[], gezaehlt: Zaehler, abbruch: Zaehler, sitzungen: number,
): { schritt: string; label: string; sitzungen: number; anteil: number | null; abbruch: number }[] {
  // Unbekannte Namen (Browser mit anderer Liste) hinten anfügen statt verschweigen.
  const bekannt = new Set(reihe.map((r) => r.schritt));
  const fremd = Object.keys(gezaehlt).concat(Object.keys(abbruch))
    .filter((s, i, a) => !bekannt.has(s) && a.indexOf(s) === i).sort()
    .map((s) => ({ schritt: s, label: `${s} (unbekannt)` }));
  return reihe.concat(fremd).map((r) => ({
    schritt: r.schritt, label: r.label,
    sitzungen: gezaehlt[r.schritt] ?? 0,
    anteil: rate(gezaehlt[r.schritt] ?? 0, sitzungen),
    abbruch: abbruch[r.schritt] ?? 0,
  }));
}

/** Messung eines Wegs aus fiaon_antrag_ereignisse — eine Abfrage, ein Indexbereich. */
async function wegMessung(weg: "alt" | "neu", from: Date, to: Date) {
  const spaet = new Date(to.getTime() + 864e5);
  const [z] = (await sqlPool.unsafe(`
    WITH e AS MATERIALIZED (
      SELECT id, sitzung, schritt, ereignis, detail, geraet, am
        FROM fiaon_antrag_ereignisse
       WHERE weg = $1 AND am >= $2 AND am <= $4
    ),
    s AS MATERIALIZED (
      SELECT DISTINCT sitzung FROM e WHERE ereignis = 'geoeffnet' AND am <= $3
    ),
    es AS MATERIALIZED (
      SELECT e.* FROM e JOIN s ON s.sitzung = e.sitzung WHERE e.ereignis <> 'weiche'
    ),
    fertig AS (
      SELECT sitzung, MIN(am) AS am FROM es WHERE ereignis = 'angenommen' GROUP BY sitzung
    ),
    letzte AS (
      SELECT DISTINCT ON (sitzung) sitzung, schritt
        FROM es WHERE ereignis = 'schritt' AND schritt IS NOT NULL
       ORDER BY sitzung, am DESC, id DESC
    )
    SELECT
      (SELECT COUNT(*) FROM s)::int AS sitzungen,
      (SELECT COUNT(*) FROM fertig)::int AS angenommen,
      (SELECT COUNT(*) FROM e WHERE ereignis = 'weiche' AND am <= $3)::int AS zuteilungen,
      (SELECT percentile_cont(0.5) WITHIN GROUP (ORDER BY (EXTRACT(EPOCH FROM (f.am - o.am)) / 60.0)::float8)
         FROM fertig f
         JOIN (SELECT sitzung, MIN(am) AS am FROM es WHERE ereignis = 'geoeffnet' GROUP BY sitzung) o ON o.sitzung = f.sitzung
        WHERE f.am >= o.am) AS median_minuten,
      (SELECT COALESCE(json_object_agg(t.schritt, t.n), '{}'::json) FROM (
         SELECT schritt, COUNT(DISTINCT sitzung)::int AS n
           FROM es WHERE ereignis = 'schritt' AND schritt IS NOT NULL GROUP BY schritt) t) AS trichter,
      (SELECT COALESCE(json_agg(json_build_object('schritt', t.schritt, 'n', t.n)), '[]'::json) FROM (
         SELECT l.schritt, COUNT(*)::int AS n
           FROM s LEFT JOIN letzte l ON l.sitzung = s.sitzung
          WHERE NOT EXISTS (SELECT 1 FROM fertig f WHERE f.sitzung = s.sitzung)
          GROUP BY l.schritt) t) AS abbruch,
      (SELECT COALESCE(json_agg(json_build_object('schritt', t.schritt, 'feld', t.feld, 'anzahl', t.n) ORDER BY t.n DESC, t.feld), '[]'::json) FROM (
         SELECT schritt, detail AS feld, COUNT(*)::int AS n
           FROM es WHERE ereignis = 'fehler' AND detail IS NOT NULL
          GROUP BY schritt, detail
          ORDER BY n DESC, detail
          LIMIT 10) t) AS fehler,
      (SELECT COALESCE(json_agg(json_build_object('geraet', t.geraet, 'sitzungen', t.n) ORDER BY t.n DESC), '[]'::json) FROM (
         SELECT COALESCE(x.g, 'unbekannt') AS geraet, COUNT(*)::int AS n
           FROM (SELECT sitzung, MAX(geraet) AS g FROM es GROUP BY sitzung) x
          GROUP BY 1) t) AS geraete
  `, [weg, from, to, spaet])) as any[];
  const abbruchRoh: { schritt: string | null; n: number }[] = z?.abbruch ?? [];
  const abbruch: Zaehler = {};
  let abbruchOhneSchritt = 0;
  for (const a of abbruchRoh) {
    if (a.schritt) abbruch[a.schritt] = Number(a.n);
    else abbruchOhneSchritt += Number(a.n);
  }
  const median = z?.median_minuten;
  return {
    sitzungen: Number(z?.sitzungen ?? 0),
    angenommen: Number(z?.angenommen ?? 0),
    zuteilungen: Number(z?.zuteilungen ?? 0),
    medianMinuten: median == null ? null : Math.round(Number(median) * 10) / 10,
    trichterRoh: (z?.trichter ?? {}) as Zaehler,
    abbruch, abbruchOhneSchritt,
    fehler: ((z?.fehler ?? []) as any[]).map((f) => ({ schritt: f.schritt ?? null, feld: String(f.feld), anzahl: Number(f.anzahl) })),
    geraete: ((z?.geraete ?? []) as any[]).map((g) => ({ geraet: String(g.geraet), sitzungen: Number(g.sitzungen) })),
  };
}

/** Anträge beider Wege — Kohorte „im Zeitraum angelegt", je Paket gezählt (Summen bildet der Aufrufer). */
async function wegAntraege(from: Date, to: Date) {
  return (await sqlPool.unsafe(`
    WITH x AS MATERIALIZED (
      SELECT a.ref, a.person_id, a.created_at,
             CASE WHEN a.antrag_weg = 'neu' THEN 'neu' ELSE 'alt' END AS weg,
             COALESCE(NULLIF(LOWER(TRIM(a.pack_key)), ''), 'ohne') AS paket,
             ${abgeschicktSql("a")} AS abgeschickt,
             (a.kunden_pin_gesetzt_am IS NOT NULL) AS pin
        FROM fiaon_applications a
        LEFT JOIN fiaon_persons p ON p.id = a.person_id
       WHERE a.created_at >= $1 AND a.created_at <= $2
         AND a.merged_into IS NULL
         AND a.ref NOT LIKE 'FIAON-TEST%' AND a.ref NOT LIKE 'FIA-DEV-%'
         AND p.ist_test_am IS NULL
         AND (
           a.antrag_weg = 'neu'
           OR (a.antrag_weg IS NULL AND a.type = 'private'
               AND COALESCE(a.user_agent, '') <> ''
               AND ${produktkategorieSql("a")} = 'konto')
         )
    ),
    g AS (${geldSql()}),
    g1 AS (
      SELECT ref, SUM(cents)::bigint AS cents
        FROM g WHERE art = 'rate1' AND ref IN (SELECT ref FROM x)
       GROUP BY ref
    ),
    y AS MATERIALIZED (
      SELECT x.*, g1.cents, (g1.ref IS NOT NULL) AS bezahlt,
             (x.abgeschickt AND (
               EXISTS (SELECT 1 FROM fiaon_contact_log c
                        WHERE c.ref = x.ref AND c.voided_at IS NULL AND c.note LIKE $3)
               OR EXISTS (SELECT 1 FROM fiaon_antrag_ereignisse ae
                           WHERE ae.ref = x.ref AND ae.ereignis = 'auskunft_gewaehlt')
             )) AS auskunft,
             (x.person_id IS NOT NULL AND EXISTS (
               SELECT 1 FROM fiaon_termine t
                WHERE t.person_id = x.person_id
                  AND COALESCE(t.herkunft, '') LIKE 'antrag%'
                  AND t.created_at >= (x.created_at AT TIME ZONE 'UTC')
             )) AS termin
        FROM x LEFT JOIN g1 ON g1.ref = x.ref
    )
    SELECT weg, paket,
           COUNT(*)::int AS angelegt,
           COUNT(*) FILTER (WHERE abgeschickt)::int AS abgeschickt,
           COUNT(*) FILTER (WHERE bezahlt)::int AS bezahlt,
           COALESCE(SUM(cents), 0)::bigint AS umsatz_cents,
           COUNT(*) FILTER (WHERE auskunft)::int AS auskunft,
           COUNT(*) FILTER (WHERE termin)::int AS termin,
           COUNT(*) FILTER (WHERE pin)::int AS pin
      FROM y
     GROUP BY weg, paket
  `, [from, to, `${BUENDEL_WUNSCH_VERMERK}%`])) as any[];
}

/** Sitzungen des alten Wegs vor Beginn der Messung — hilfsweise aus dem Klick-Protokoll. */
async function altSitzungenHilfsweise(from: Date, to: Date): Promise<{ anzahl: number; von: string; bis: string } | null> {
  const [erste] = (await sqlPool`
    SELECT MIN(am) AS am FROM fiaon_antrag_ereignisse WHERE weg = 'alt' AND ereignis = 'geoeffnet'`) as any[];
  const messungAb = erste?.am ? new Date(erste.am) : null;
  if (messungAb && messungAb <= from) return null;
  const bis = messungAb && messungAb < to ? messungAb : to;
  const [z] = (await sqlPool`
    SELECT COUNT(DISTINCT session_id)::int AS n
      FROM fiaon_click_events
     WHERE page = '/antrag' AND created_at >= ${from} AND created_at < ${bis}
       AND COALESCE(session_id, '') <> ''`) as any[];
  return { anzahl: Number(z?.n ?? 0), von: from.toISOString(), bis: bis.toISOString() };
}

router.get("/admin/finance/antrag-vergleich", async (req: Request, res: Response) => {
  try {
    const { from, to } = parseRange(req);
    const [mAlt, mNeu, antraege, hilfsweise, weiche] = await Promise.all([
      wegMessung("alt", from, to),
      wegMessung("neu", from, to),
      wegAntraege(from, to),
      altSitzungenHilfsweise(from, to),
      weicheStand(),
    ]);

    const zusammen = (weg: "alt" | "neu") => {
      const zeilen = antraege.filter((r: any) => r.weg === weg);
      const summe = (k: string) => zeilen.reduce((s: number, r: any) => s + Number(r[k] ?? 0), 0);
      return {
        angelegt: summe("angelegt"), abgeschickt: summe("abgeschickt"), bezahlt: summe("bezahlt"),
        umsatzErsteRatenCents: summe("umsatz_cents"), auskunft: summe("auskunft"), termin: summe("termin"),
        pinGesetzt: weg === "neu" ? summe("pin") : null,
        pakete: zeilen
          .map((r: any) => ({ paket: String(r.paket), angelegt: Number(r.angelegt), abgeschickt: Number(r.abgeschickt), bezahlt: Number(r.bezahlt) }))
          .sort((a: any, b: any) => b.angelegt - a.angelegt),
      };
    };

    const wegBauen = (weg: "alt" | "neu", m: Awaited<ReturnType<typeof wegMessung>>) => {
      const a = zusammen(weg);
      const hilfe = weg === "alt" && hilfsweise && hilfsweise.anzahl > 0 ? hilfsweise : null;
      const basis = m.sitzungen + (hilfe?.anzahl ?? 0);
      return {
        sitzungen: m.sitzungen,
        sitzungenHilfsweise: hilfe,
        sitzungenBasis: basis,
        angenommenSitzungen: m.angenommen,
        medianMinutenBisAbschicken: m.medianMinuten,
        trichter: schrittListe(weg === "alt" ? ALT_SCHRITTE : NEU_SCHRITTE, m.trichterRoh, m.abbruch, m.sitzungen),
        abbruchOhneSchritt: m.abbruchOhneSchritt,
        fehler: m.fehler,
        geraete: m.geraete,
        ...a,
        quoten: {
          angelegtJeSitzung: rate(a.angelegt, basis),
          abgeschicktJeAngelegt: rate(a.abgeschickt, a.angelegt),
          bezahltJeAbgeschickt: rate(a.bezahlt, a.abgeschickt),
          bezahltJeSitzung: rate(a.bezahlt, basis),
        },
      };
    };

    res.json({
      ok: true,
      zeitraum: { von: from.toISOString(), bis: to.toISOString() },
      alt: wegBauen("alt", mAlt),
      neu: wegBauen("neu", mNeu),
      weiche: { ...weiche, zuteilungen: { alt: mAlt.zuteilungen, neu: mNeu.zuteilungen } },
      definitionen: {
        sitzungen: "Browser-Tabs, in denen der Antrag im Zeitraum geöffnet wurde (Messung je Tab, ohne Inhalte, ohne IP).",
        hilfsweise: "Vor Beginn der Messung: verschiedene Sitzungen im Klick-Protokoll auf /antrag. Dort steht nur, wer ein Paket gewählt oder einen Schritt gewechselt hat — die Zahl ist zu klein, die Quoten je Sitzung sind zu hoch.",
        angelegt: "Anträge, die im Zeitraum angelegt wurden. Alt: vom Kunden selbst über /antrag (ab Schritt 1), ohne Betreuer-Anlagen. Neu: über /antrag-neu. Ohne Testpersonen und Dubletten.",
        abgeschickt: "Antrag abgeschickt (Vertrag angenommen) — dieselbe Regel wie überall (abgeschicktSql).",
        bezahlt: "Erste Rate gebucht, bis heute — die Geld-Wahrheit wie /chef/zahlen. Gemeldete Zahlungen zählen nicht.",
        umsatz: "Summe der gebuchten ersten Raten dieser Anträge.",
        auskunft: "Abgeschickte Anträge mit dazubestellter Bonitätsauskunft.",
        termin: "Anträge, deren Person nach der Anlage einen Termin über die Antragsstrecke gebucht hat.",
        pin: "Nur neuer Weg: persönliche FIAON-PIN festgelegt (zum Erkennen am Telefon — keine Karten-PIN).",
        median: "Median der Minuten vom Öffnen bis zum Annehmen des Vertrags, je Sitzung (nur Sitzungen mit Annahme).",
        trichter: "Sitzungen, die den Schritt gesehen haben, in Prozent der geöffneten Sitzungen. Abbruch = letzter gesehener Schritt einer Sitzung ohne Annahme.",
      },
    });
  } catch (err) {
    console.error("[FIAON-FINANCE] antrag-vergleich:", err);
    res.status(500).json({ ok: false, error: "Der Vergleich konnte nicht berechnet werden (Serverfehler)." });
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
        (SELECT COUNT(*) FROM fiaon_applications WHERE payment_status = 'paid' AND NOT COALESCE(alt_bestand, FALSE) AND merged_into IS NULL)::int AS zahlungszentrale,
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
