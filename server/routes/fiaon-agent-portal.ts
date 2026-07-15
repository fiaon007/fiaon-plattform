// ═══════════════════════════════════════════════════════════════════
// FIAON Agent-Portal — Motivations-Update (Pakete AG/AH/AJ/AK/AM/AN/AO)
// - GET /agent/dashboard   „Mein Tag": Heute/Woche-Verdienst, Tagesziele,
//                          Abschlüsse, Partner-Fortschritt (echte Werte)
// - GET /agent/feed        Aktivitäts-Feed: NUR echte Ereignisse (eigene
//                          Abschlüsse, anonymisierte Team-Abschlüsse,
//                          Meilensteine) + klar gekennzeichnete Benchmark-
//                          Impulse aus echten Systemdaten. KEINE fiktiven
//                          Agenten (Begründung: AGENT_REVAMP_AUDIT.md §5).
// - /agent/wunschgehalt    Wunschgehalt-Simulator — rechnet SERVERSEITIG mit
//                          echtem Satz + Partnerstatus-Zuschlag, gestaffelt
//                          über Meilenstein-Schwellen. Erzeugt NIE Einträge.
// - /agent/updates         Update-Center + Banner (Gelesen-Status pro Agent)
// - /agent/feedback        Verbesserungs-Tickets; Admin kann mit einmaliger
//                          Provisions-Gutschrift kind='feedback_bonus' danken
//                          (fließt ins normale Guthaben, voll auditiert)
// - /agent/first-steps     Erste-Schritte-Checkliste für neue Agents
// - Admin-Pflege: /admin/agent-updates, /admin/agent-feedback,
//                 /admin/agents/:id/daily-goals
// Regeln: Geld nur Integer-Cents, bestehende Engine wiederverwenden,
// blockAgentsFromAdmin (routes.ts) schützt die /admin-Routen serverseitig.
// ═══════════════════════════════════════════════════════════════════

import { Router } from "express";
import postgres from "postgres";
import { sendMakeWebhook } from "../make-webhook";
import {
  ensureAgentTables, getSettings, agentRateBp, commissionCents,
  partnerThresholds, partnerStatusFor, ownRevenueCents,
  requireAgent, logAgentEvent, type AgentRequest,
} from "./fiaon-agent";

const router = Router();
const sqlPool = postgres(process.env.DATABASE_URL!, { ssl: "require", max: 5 });

// ── Tabellen & Spalten (idempotent, gleiches Muster wie fiaon-agent.ts) ──────
let portalTablesEnsured = false;
async function ensurePortalTables(): Promise<void> {
  if (portalTablesEnsured) return;
  await ensureAgentTables();
  // AM: Updates fürs Agent-Portal (Admin gepflegt, ohne Deploy)
  await sqlPool`
    CREATE TABLE IF NOT EXISTS fiaon_agent_updates (
      id SERIAL PRIMARY KEY,
      title VARCHAR NOT NULL,
      body TEXT NOT NULL,
      published BOOLEAN NOT NULL DEFAULT FALSE,
      published_at TIMESTAMPTZ,
      deleted_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;
  await sqlPool`
    CREATE TABLE IF NOT EXISTS fiaon_agent_update_reads (
      update_id INTEGER NOT NULL,
      agent_id INTEGER NOT NULL,
      read_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      PRIMARY KEY (update_id, agent_id)
    )
  `;
  // AN: Feedback-Tickets mit optionaler einmaliger Provisions-Gutschrift
  await sqlPool`
    CREATE TABLE IF NOT EXISTS fiaon_agent_feedback (
      id SERIAL PRIMARY KEY,
      agent_id INTEGER NOT NULL,
      category VARCHAR NOT NULL,          -- verbesserung | bug | idee | sonstiges
      title VARCHAR NOT NULL,
      description TEXT NOT NULL,
      screenshot TEXT,                    -- optionaler Screenshot (DataURL)
      status VARCHAR NOT NULL DEFAULT 'offen',  -- offen | geprueft | umgesetzt | abgelehnt
      admin_comment TEXT,
      reward_cents INTEGER,               -- einmalige Gutschrift (gesetzt = bereits honoriert)
      reward_commission_id INTEGER,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;
  await sqlPool`CREATE INDEX IF NOT EXISTS fiaon_agent_feedback_agent_idx ON fiaon_agent_feedback(agent_id, created_at)`;
  // AG/AK/AO: Ziel- und Onboarding-Felder am Agent
  await sqlPool.unsafe(`
    ALTER TABLE fiaon_agents
      ADD COLUMN IF NOT EXISTS desired_salary_cents INTEGER,
      ADD COLUMN IF NOT EXISTS daily_goal_cents INTEGER,
      ADD COLUMN IF NOT EXISTS daily_contacts_goal INTEGER,
      ADD COLUMN IF NOT EXISTS first_steps TEXT
  `);
  portalTablesEnsured = true;
  console.log("[FIAON-AGENT-PORTAL] Update-/Feedback-/Ziel-Tabellen sichergestellt");
}

// Defaults für Tagesziele (Admin pro Agent überschreibbar)
const DEFAULT_DAILY_GOAL_CENTS = 3000; // 30,00 €
const DEFAULT_DAILY_CONTACTS = 15;

// ═══════════════ AG — Dashboard „Mein Tag" (echte Werte, Cents) ═══════════════

router.get("/agent/dashboard", requireAgent, async (req: AgentRequest, res) => {
  try {
    await ensurePortalTables();
    const me = req.agent!.id;
    const settings = await getSettings();

    const agentRows = await sqlPool`
      SELECT commission_rate_bp, monthly_goal_cents, daily_goal_cents, daily_contacts_goal, desired_salary_cents
      FROM fiaon_agents WHERE id = ${me}
    `;
    const a = agentRows[0];

    // Verdienst heute / diese Woche / Vorwoche (alle nicht-stornierten Einträge:
    // eigene Provision + Team-Beteiligung + Feedback-Boni — wie das Guthaben)
    const sums = await sqlPool`
      SELECT
        COALESCE(SUM(amount_cents) FILTER (WHERE created_at >= date_trunc('day', NOW())), 0) AS today,
        COALESCE(SUM(amount_cents) FILTER (WHERE created_at >= date_trunc('week', NOW())), 0) AS week,
        COALESCE(SUM(amount_cents) FILTER (WHERE created_at >= date_trunc('week', NOW()) - INTERVAL '7 days'
                                             AND created_at <  date_trunc('week', NOW())), 0) AS prev_week,
        COALESCE(SUM(amount_cents) FILTER (WHERE created_at >= date_trunc('month', NOW())), 0) AS month
      FROM fiaon_commissions WHERE agent_id = ${me} AND status != 'storniert'
    `;

    // Aktivität heute: dokumentierte Kontakte (Anruf-Ergebnisse + Zahlungs-Mails)
    const activity = await sqlPool`
      SELECT COUNT(*)::int AS c FROM fiaon_contact_log
      WHERE agent_id = ${me} AND type IN ('result', 'email_sent') AND voided_at IS NULL AND created_at >= date_trunc('day', NOW())
    `;

    // Abschlüsse (eigene, positiv, nicht storniert): Monat gesamt, heute, bester Tag
    const deals = await sqlPool`
      SELECT
        COUNT(*) FILTER (WHERE created_at >= date_trunc('month', NOW()))::int AS month_deals,
        COUNT(*) FILTER (WHERE created_at >= date_trunc('day', NOW()))::int AS today_deals
      FROM fiaon_commissions
      WHERE agent_id = ${me} AND kind = 'own' AND amount_cents > 0 AND status != 'storniert'
    `;
    const bestDay = await sqlPool`
      SELECT COALESCE(MAX(c), 0)::int AS best FROM (
        SELECT COUNT(*)::int AS c FROM fiaon_commissions
        WHERE agent_id = ${me} AND kind = 'own' AND amount_cents > 0 AND status != 'storniert'
          AND created_at >= date_trunc('month', NOW())
        GROUP BY date_trunc('day', created_at)
      ) t
    `;

    // AG3: „Meine Abschlüsse" — chronologisch, mit Kundenname/Paket
    const closes = await sqlPool`
      SELECT c.id, c.ref, c.pack_name, c.amount_cents, c.kind, c.status, c.created_at,
             ap.first_name, ap.last_name, ap.contact_name, ap.company_name
      FROM fiaon_commissions c
      LEFT JOIN fiaon_applications ap ON ap.ref = c.ref
      WHERE c.agent_id = ${me} AND c.amount_cents > 0 AND c.status != 'storniert'
      ORDER BY c.created_at DESC LIMIT 12
    `;

    // AG4: Partner-Fortschritt (bestehende Engine, keine Neu-Erfindung)
    const thresholds = partnerThresholds(settings);
    const revenue = await ownRevenueCents(me);
    const status = partnerStatusFor(revenue, thresholds);
    const next = thresholds.find((t) => revenue < t.minCents) || null;
    let prizes: Record<string, { title: string; description?: string }> = {};
    try { prizes = JSON.parse(settings.partner_prizes || "{}"); } catch { /* leer */ }

    res.json({
      ok: true,
      todayCents: Number(sums[0].today),
      weekCents: Number(sums[0].week),
      prevWeekCents: Number(sums[0].prev_week),
      monthCents: Number(sums[0].month),
      monthlyGoalCents: a.monthly_goal_cents,
      dailyGoalCents: a.daily_goal_cents ?? DEFAULT_DAILY_GOAL_CENTS,
      dailyContactsGoal: a.daily_contacts_goal ?? DEFAULT_DAILY_CONTACTS,
      todayContacts: Number(activity[0].c),
      monthDeals: Number(deals[0].month_deals),
      todayDeals: Number(deals[0].today_deals),
      bestDayDeals: Number(bestDay[0].best),
      closes,
      partner: {
        status,
        revenueCents: revenue,
        next: next
          ? { key: next.key, label: next.label, minCents: next.minCents, remainingCents: next.minCents - revenue, prize: prizes[next.key] || null }
          : null,
      },
      desiredSalaryCents: a.desired_salary_cents,
    });
  } catch (err) {
    console.error("[FIAON-AGENT-PORTAL] dashboard:", err);
    res.status(500).json({ ok: false, error: "Serverfehler" });
  }
});

// ═══════════════ AH — Aktivitäts-Feed (ehrlich, wird mit mehr Agents dichter) ═══════════════

// Kuratierte, seriöse Erfolgs-Texte — deterministisch pro Eintrag rotiert (id % n)
const SUCCESS_LINES = [
  "Abschluss bestätigt. Starke Arbeit.",
  "Sauber abgeschlossen — genau so geht Vertrieb.",
  "Ein weiterer bestätigter Abschluss. Weiter so.",
  "Abschluss verbucht. Konstanz zahlt sich aus.",
  "Bestätigt. Dein Einsatz zahlt direkt auf dein Guthaben ein.",
];

router.get("/agent/feed", requireAgent, async (req: AgentRequest, res) => {
  try {
    await ensurePortalTables();
    const me = req.agent!.id;

    // 1) Eigene Ereignisse (echt): Abschlüsse, Team-Beteiligung, Feedback-Boni
    const own = await sqlPool`
      SELECT c.id, c.pack_name, c.amount_cents, c.kind, c.created_at,
             ap.first_name, ap.last_name, ap.contact_name, ap.company_name
      FROM fiaon_commissions c
      LEFT JOIN fiaon_applications ap ON ap.ref = c.ref
      WHERE c.agent_id = ${me} AND c.amount_cents > 0 AND c.status != 'storniert'
        AND c.created_at >= NOW() - INTERVAL '30 days'
      ORDER BY c.created_at DESC LIMIT 15
    `;
    // 2) Team-Bewegung (echt, anonymisiert): Abschlüsse ANDERER Agents — ohne
    //    Namen, ohne Betrag. Wird automatisch dichter, sobald mehr Agents aktiv sind.
    const team = await sqlPool`
      SELECT c.id, c.pack_name, c.created_at
      FROM fiaon_commissions c
      WHERE c.agent_id != ${me} AND c.kind = 'own' AND c.amount_cents > 0 AND c.status != 'storniert'
        AND c.created_at >= NOW() - INTERVAL '14 days'
      ORDER BY c.created_at DESC LIMIT 10
    `;
    // 3) Eigene Meilenstein-Ereignisse (echt, aus dem Audit-Log)
    const milestones = await sqlPool`
      SELECT id, type, meta, created_at FROM fiaon_agent_events
      WHERE agent_id = ${me} AND type IN ('milestone_reached', 'feedback_rewarded')
        AND created_at >= NOW() - INTERVAL '60 days'
      ORDER BY created_at DESC LIMIT 5
    `;

    type FeedEvent = { id: string; type: string; title: string; sub: string | null; amountCents: number | null; at: string; highlight: boolean };
    const events: FeedEvent[] = [];

    for (const c of own) {
      const kunde = c.company_name || [c.first_name, c.last_name].filter(Boolean).join(" ") || c.contact_name || null;
      const pack = (c.pack_name || "").replace(/\n/g, " ").trim();
      if (c.kind === "feedback_bonus") {
        events.push({
          id: `own-${c.id}`, type: "feedback_bonus",
          title: "Danke für deinen Beitrag — Feedback-Bonus gutgeschrieben.",
          sub: "Dein Vorschlag hat das System verbessert.",
          amountCents: Number(c.amount_cents), at: c.created_at, highlight: true,
        });
      } else if (c.kind === "override") {
        events.push({
          id: `own-${c.id}`, type: "override",
          title: "Team-Umsatzbeteiligung gutgeschrieben.",
          sub: pack ? `Abschluss aus deinem Team · ${pack}` : "Abschluss aus deinem Team",
          amountCents: Number(c.amount_cents), at: c.created_at, highlight: false,
        });
      } else {
        events.push({
          id: `own-${c.id}`, type: "own_deal",
          title: SUCCESS_LINES[Number(c.id) % SUCCESS_LINES.length],
          sub: [kunde, pack].filter(Boolean).join(" · ") || null,
          amountCents: Number(c.amount_cents), at: c.created_at, highlight: true,
        });
      }
    }
    for (const t of team) {
      const pack = (t.pack_name || "").replace(/\n/g, " ").trim();
      events.push({
        id: `team-${t.id}`, type: "team_deal",
        title: pack ? `Ein Kollege aus dem Vertrieb hat gerade ${pack} abgeschlossen.` : "Ein Kollege aus dem Vertrieb hat gerade abgeschlossen.",
        sub: null, amountCents: null, at: t.created_at, highlight: false,
      });
    }
    for (const m of milestones) {
      if (m.type !== "milestone_reached") continue;
      let label = "Meilenstein";
      try { label = JSON.parse(m.meta || "{}").milestone || label; } catch { /* Fallback */ }
      const nice: Record<string, string> = { senior: "Senior Partner", executive: "Executive Partner", managing: "Managing Partner" };
      events.push({
        id: `ms-${m.id}`, type: "milestone",
        title: `Meilenstein erreicht: ${nice[label] || label}.`,
        sub: "Dein Provisionssatz für künftige Abschlüsse ist gestiegen.",
        amountCents: null, at: m.created_at, highlight: true,
      });
    }
    events.sort((x, y) => new Date(y.at).getTime() - new Date(x.at).getTime());

    // 4) Benchmark-/Ziel-Impulse — ausdrücklich als Statistik gekennzeichnet,
    //    ausschließlich aus ECHTEN Systemdaten. Keine Personen, keine Erfindung.
    const bench = await sqlPool`
      SELECT
        COUNT(*) FILTER (WHERE created_at >= date_trunc('week', NOW()))::int AS team_week,
        COUNT(*) FILTER (WHERE agent_id = ${me} AND created_at >= date_trunc('week', NOW()))::int AS my_week,
        COUNT(*) FILTER (WHERE agent_id = ${me} AND created_at >= date_trunc('day', NOW()))::int AS my_today
      FROM fiaon_commissions
      WHERE kind = 'own' AND amount_cents > 0 AND status != 'storniert'
    `;
    // Beste Wochenleistung EINES Agents in den letzten 8 Wochen (echter Top-Wert)
    const topWeek = await sqlPool`
      SELECT COALESCE(MAX(c), 0)::int AS top FROM (
        SELECT agent_id, date_trunc('week', created_at) AS w, COUNT(*)::int AS c
        FROM fiaon_commissions
        WHERE kind = 'own' AND amount_cents > 0 AND status != 'storniert'
          AND created_at >= NOW() - INTERVAL '8 weeks'
        GROUP BY agent_id, date_trunc('week', created_at)
      ) t
    `;
    const myBestDay = await sqlPool`
      SELECT COALESCE(MAX(c), 0)::int AS best FROM (
        SELECT COUNT(*)::int AS c FROM fiaon_commissions
        WHERE agent_id = ${me} AND kind = 'own' AND amount_cents > 0 AND status != 'storniert'
          AND created_at >= date_trunc('month', NOW())
        GROUP BY date_trunc('day', created_at)
      ) t
    `;

    const impulses: { id: string; text: string }[] = [];
    const top = Number(topWeek[0].top);
    const myWeek = Number(bench[0].my_week);
    const myToday = Number(bench[0].my_today);
    const best = Number(myBestDay[0].best);
    const teamWeek = Number(bench[0].team_week);
    if (top > 0 && top > myWeek) {
      impulses.push({ id: "top-week", text: `Beste Wochenleistung im Team (letzte 8 Wochen): ${top} Abschlüsse — du stehst diese Woche bei ${myWeek}.` });
    }
    if (best > 0 && best > myToday) {
      impulses.push({ id: "best-day", text: `Dein bester Tag diesen Monat: ${best} ${best === 1 ? "Abschluss" : "Abschlüsse"}. Heute: ${myToday}.` });
    } else if (best > 0 && myToday >= best && myToday > 0) {
      impulses.push({ id: "best-day", text: `Heute läuft es: ${myToday} Abschlüsse — das ist dein Bestwert diesen Monat.` });
    }
    if (teamWeek > 0) {
      impulses.push({ id: "team-week", text: `Der Vertrieb hat diese Woche zusammen ${teamWeek} ${teamWeek === 1 ? "Abschluss" : "Abschlüsse"} erreicht.` });
    }

    res.json({ ok: true, events: events.slice(0, 25), impulses });
  } catch (err) {
    console.error("[FIAON-AGENT-PORTAL] feed:", err);
    res.status(500).json({ ok: false, error: "Serverfehler" });
  }
});

// ═══════════════ AK — Wunschgehalt-Simulator (serverseitig, gestaffelt) ═══════════════

/** Verbleibende Werktage (Mo–Fr) im laufenden Monat, INKLUSIVE heute. */
function workdaysLeftInMonth(now: Date): number {
  const year = now.getFullYear();
  const month = now.getMonth();
  const last = new Date(year, month + 1, 0).getDate();
  let n = 0;
  for (let d = now.getDate(); d <= last; d++) {
    const wd = new Date(year, month, d).getDay();
    if (wd !== 0 && wd !== 6) n++;
  }
  return Math.max(1, n);
}

router.get("/agent/wunschgehalt", requireAgent, async (req: AgentRequest, res) => {
  try {
    await ensurePortalTables();
    const me = req.agent!.id;
    const settings = await getSettings();

    const agentRows = await sqlPool`
      SELECT commission_rate_bp, desired_salary_cents FROM fiaon_agents WHERE id = ${me}
    `;
    const desired = agentRows[0].desired_salary_cents as number | null;
    const baseRateBp = agentRateBp(agentRows[0] as any, settings);

    // Monatsverdienst bisher (alle nicht-stornierten Einträge, wie Guthaben-Logik)
    const month = await sqlPool`
      SELECT COALESCE(SUM(amount_cents), 0) AS s FROM fiaon_commissions
      WHERE agent_id = ${me} AND status != 'storniert' AND created_at >= date_trunc('month', NOW())
    `;
    const monthCents = Number(month[0].s);

    // Ø-Abschlusswert: eigene bisherige Abschlüsse; Fallback: Ø bezahlter
    // Bestellungen im System; letzter Fallback: Ø offener Bestellwerte.
    let avgDealCents = 0;
    let avgSource: "eigene Abschlüsse" | "Systemdurchschnitt" | "offene Bestellungen" = "eigene Abschlüsse";
    const ownAvg = await sqlPool`
      SELECT COALESCE(AVG(base_amount_cents), 0) AS a, COUNT(*)::int AS c FROM fiaon_commissions
      WHERE agent_id = ${me} AND kind = 'own' AND amount_cents > 0 AND status != 'storniert'
    `;
    if (Number(ownAvg[0].c) >= 1) {
      avgDealCents = Math.round(Number(ownAvg[0].a));
    } else {
      const paidAvg = await sqlPool`
        SELECT COALESCE(AVG(ROUND(amount_due::numeric * 100)), 0) AS a, COUNT(*)::int AS c
        FROM fiaon_applications WHERE payment_status = 'paid' AND payment_reference IS NOT NULL AND amount_due IS NOT NULL AND merged_into IS NULL
      `;
      if (Number(paidAvg[0].c) >= 1) {
        avgDealCents = Math.round(Number(paidAvg[0].a));
        avgSource = "Systemdurchschnitt";
      } else {
        const openAvg = await sqlPool`
          SELECT COALESCE(AVG(ROUND(amount_due::numeric * 100)), 0) AS a
          FROM fiaon_applications
          WHERE payment_status IN ('pending_payment','claimed_paid') AND amount_due IS NOT NULL AND merged_into IS NULL
        `;
        avgDealCents = Math.round(Number(openAvg[0].a));
        avgSource = "offene Bestellungen";
      }
    }

    if (desired == null || desired <= 0) {
      return res.json({ ok: true, desiredCents: null, sim: null, monthCents });
    }

    const remainingCents = Math.max(0, desired - monthCents);
    const now = new Date();
    const workdays = workdaysLeftInMonth(now);

    let sim: any = null;
    if (remainingCents === 0) {
      sim = { achieved: true, dealsNeeded: 0, perWorkday: 0, todayTarget: 0, workdaysLeft: workdays, avgDealCents, avgSource, segments: [] as any[] };
    } else if (avgDealCents > 0) {
      // Gestaffelte Rechnung: kumulierter EIGENumsatz wächst mit jedem simulierten
      // Abschluss; überschreitet er eine Meilenstein-Schwelle, steigt der Satz
      // (+bonusBp) für die FOLGENDEN Abschlüsse — exakt wie onCustomerPaid()
      // (Zuschlag auf Basis des Umsatzes VOR dem jeweiligen Abschluss).
      const thresholds = partnerThresholds(settings);
      let revenue = await ownRevenueCents(me);
      let earned = 0;
      let deals = 0;
      const segments: { rateBp: number; deals: number; label: string }[] = [];
      while (earned < remainingCents && deals < 5000) {
        const status = partnerStatusFor(revenue, thresholds);
        const rateBp = baseRateBp + status.bonusBp;
        earned += commissionCents(avgDealCents, rateBp);
        revenue += avgDealCents;
        deals++;
        const seg = segments[segments.length - 1];
        if (seg && seg.rateBp === rateBp) seg.deals++;
        else segments.push({ rateBp, deals: 1, label: status.label });
      }
      // Heutige Abschlüsse anrechnen: Tagespensum minus bereits Geschafftes
      const todayDeals = await sqlPool`
        SELECT COUNT(*)::int AS c FROM fiaon_commissions
        WHERE agent_id = ${me} AND kind = 'own' AND amount_cents > 0 AND status != 'storniert'
          AND created_at >= date_trunc('day', NOW())
      `;
      const perWorkday = Math.ceil(deals / workdays);
      sim = {
        achieved: false,
        dealsNeeded: deals,
        perWorkday,
        todayTarget: Math.max(0, perWorkday - Number(todayDeals[0].c)),
        workdaysLeft: workdays,
        avgDealCents,
        avgSource,
        segments,
      };
    }

    res.json({
      ok: true,
      desiredCents: desired,
      monthCents,
      remainingCents,
      baseRateBp,
      sim,
    });
  } catch (err) {
    console.error("[FIAON-AGENT-PORTAL] wunschgehalt:", err);
    res.status(500).json({ ok: false, error: "Serverfehler" });
  }
});

router.post("/agent/wunschgehalt", requireAgent, async (req: AgentRequest, res) => {
  try {
    await ensurePortalTables();
    const raw = req.body?.amountCents;
    let cents: number | null = null;
    if (raw != null && raw !== "") {
      cents = Math.round(Number(raw));
      if (isNaN(cents) || cents < 0 || cents > 100_000_000) {
        return res.status(400).json({ ok: false, error: "Betrag ungültig (0 – 1.000.000 €)" });
      }
      if (cents === 0) cents = null;
    }
    await sqlPool`UPDATE fiaon_agents SET desired_salary_cents = ${cents} WHERE id = ${req.agent!.id}`;
    await logAgentEvent(req.agent!.id, "desired_salary_set", { amount_cents: cents });
    res.json({ ok: true, desiredCents: cents });
  } catch (err) {
    console.error("[FIAON-AGENT-PORTAL] wunschgehalt save:", err);
    res.status(500).json({ ok: false, error: "Serverfehler" });
  }
});

// ═══════════════ AM — Update-Center (Agent-Seite) ═══════════════

// Banner-Status: ungelesene veröffentlichte Updates (leichtgewichtig, für die Shell)
router.get("/agent/updates/state", requireAgent, async (req: AgentRequest, res) => {
  try {
    await ensurePortalTables();
    const rows = await sqlPool`
      SELECT COUNT(*)::int AS unread, MAX(u.published_at) AS latest
      FROM fiaon_agent_updates u
      LEFT JOIN fiaon_agent_update_reads r ON r.update_id = u.id AND r.agent_id = ${req.agent!.id}
      WHERE u.published = TRUE AND u.deleted_at IS NULL AND r.update_id IS NULL
    `;
    res.json({ ok: true, unread: Number(rows[0].unread), latest: rows[0].latest });
  } catch (err) {
    console.error("[FIAON-AGENT-PORTAL] updates state:", err);
    res.status(500).json({ ok: false, error: "Serverfehler" });
  }
});

router.get("/agent/updates", requireAgent, async (req: AgentRequest, res) => {
  try {
    await ensurePortalTables();
    const rows = await sqlPool`
      SELECT u.id, u.title, u.body, u.published_at, r.read_at
      FROM fiaon_agent_updates u
      LEFT JOIN fiaon_agent_update_reads r ON r.update_id = u.id AND r.agent_id = ${req.agent!.id}
      WHERE u.published = TRUE AND u.deleted_at IS NULL
      ORDER BY u.published_at DESC
    `;
    res.json({ ok: true, data: rows });
  } catch (err) {
    console.error("[FIAON-AGENT-PORTAL] updates:", err);
    res.status(500).json({ ok: false, error: "Serverfehler" });
  }
});

// Alle veröffentlichten Updates als gelesen markieren (Banner verschwindet)
router.post("/agent/updates/read", requireAgent, async (req: AgentRequest, res) => {
  try {
    await ensurePortalTables();
    await sqlPool`
      INSERT INTO fiaon_agent_update_reads (update_id, agent_id)
      SELECT u.id, ${req.agent!.id} FROM fiaon_agent_updates u
      WHERE u.published = TRUE AND u.deleted_at IS NULL
      ON CONFLICT (update_id, agent_id) DO NOTHING
    `;
    res.json({ ok: true });
  } catch (err) {
    console.error("[FIAON-AGENT-PORTAL] updates read:", err);
    res.status(500).json({ ok: false, error: "Serverfehler" });
  }
});

// ═══════════════ AN — Feedback (Agent-Seite) ═══════════════

const FEEDBACK_CATEGORIES = new Set(["verbesserung", "bug", "idee", "sonstiges"]);

router.get("/agent/feedback", requireAgent, async (req: AgentRequest, res) => {
  try {
    await ensurePortalTables();
    const rows = await sqlPool`
      SELECT id, category, title, description, status, admin_comment, reward_cents, created_at, updated_at
      FROM fiaon_agent_feedback WHERE agent_id = ${req.agent!.id}
      ORDER BY created_at DESC LIMIT 50
    `;
    const rewards = await sqlPool`
      SELECT COALESCE(SUM(reward_cents), 0) AS s FROM fiaon_agent_feedback
      WHERE agent_id = ${req.agent!.id} AND reward_cents IS NOT NULL
    `;
    res.json({ ok: true, data: rows, rewardTotalCents: Number(rewards[0].s) });
  } catch (err) {
    console.error("[FIAON-AGENT-PORTAL] feedback list:", err);
    res.status(500).json({ ok: false, error: "Serverfehler" });
  }
});

router.post("/agent/feedback", requireAgent, async (req: AgentRequest, res) => {
  try {
    await ensurePortalTables();
    const category = String(req.body?.category || "").trim();
    const title = String(req.body?.title || "").trim().slice(0, 160);
    const description = String(req.body?.description || "").trim().slice(0, 6000);
    const screenshot = req.body?.screenshot ? String(req.body.screenshot) : null;
    if (!FEEDBACK_CATEGORIES.has(category)) return res.status(400).json({ ok: false, error: "Kategorie ungültig" });
    if (!title) return res.status(400).json({ ok: false, error: "Titel erforderlich" });
    if (!description) return res.status(400).json({ ok: false, error: "Beschreibung erforderlich" });
    if (screenshot) {
      if (!/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(screenshot)) {
        return res.status(400).json({ ok: false, error: "Screenshot: ungültiges Bildformat" });
      }
      const bytes = Math.floor((screenshot.length - screenshot.indexOf(",") - 1) * 0.75);
      if (bytes > 1_500_000) return res.status(400).json({ ok: false, error: "Screenshot zu groß (max. 1,5 MB)" });
    }
    // Spam-Bremse: max. 10 offene Tickets pro Agent
    const open = await sqlPool`
      SELECT COUNT(*)::int AS c FROM fiaon_agent_feedback WHERE agent_id = ${req.agent!.id} AND status = 'offen'
    `;
    if (Number(open[0].c) >= 10) return res.status(429).json({ ok: false, error: "Bitte warte, bis deine offenen Einreichungen geprüft wurden" });
    const rows = await sqlPool`
      INSERT INTO fiaon_agent_feedback (agent_id, category, title, description, screenshot)
      VALUES (${req.agent!.id}, ${category}, ${title}, ${description}, ${screenshot})
      RETURNING id, created_at
    `;
    await logAgentEvent(req.agent!.id, "feedback_submitted", { feedback_id: rows[0].id, category, title });
    console.log(`[FIAON-FEEDBACK] Ticket #${rows[0].id} von Agent ${req.agent!.id}: ${title}`);
    res.json({ ok: true, feedback: rows[0] });
  } catch (err) {
    console.error("[FIAON-AGENT-PORTAL] feedback create:", err);
    res.status(500).json({ ok: false, error: "Serverfehler" });
  }
});

// ═══════════════ AO — Erste-Schritte-Checkliste (neue Agents) ═══════════════

router.get("/agent/first-steps", requireAgent, async (req: AgentRequest, res) => {
  try {
    await ensurePortalTables();
    const me = req.agent!.id;
    const agent = await sqlPool`
      SELECT phone, avatar, bank_iban_masked, first_steps FROM fiaon_agents WHERE id = ${me}
    `;
    let manual: Record<string, boolean> = {};
    try { manual = JSON.parse(agent[0].first_steps || "{}"); } catch { /* leer */ }
    const activity = await sqlPool`
      SELECT
        COUNT(*) FILTER (WHERE type = 'result')::int AS calls,
        COUNT(*) FILTER (WHERE type = 'note')::int AS notes
      FROM fiaon_contact_log WHERE agent_id = ${me}
    `;
    const steps = [
      { key: "profil", label: "Profil vervollständigen (Telefon oder Foto)", done: !!(agent[0].phone || agent[0].avatar) },
      { key: "iban", label: "Auszahlungsdaten (IBAN) hinterlegen", done: !!agent[0].bank_iban_masked },
      { key: "skripte", label: "Gesprächsskripte lesen", done: !!manual.skripte },
      { key: "anruf", label: "Ersten Kunden anrufen und Ergebnis dokumentieren", done: Number(activity[0].calls) > 0 },
      { key: "notiz", label: "Erste Notiz zu einem Kunden speichern", done: Number(activity[0].notes) > 0 },
    ];
    res.json({ ok: true, steps, dismissed: !!manual.dismissed, allDone: steps.every((s) => s.done) });
  } catch (err) {
    console.error("[FIAON-AGENT-PORTAL] first-steps:", err);
    res.status(500).json({ ok: false, error: "Serverfehler" });
  }
});

router.post("/agent/first-steps", requireAgent, async (req: AgentRequest, res) => {
  try {
    await ensurePortalTables();
    const key = String(req.body?.key || "");
    if (!["skripte", "dismiss"].includes(key)) return res.status(400).json({ ok: false, error: "Ungültiger Schritt" });
    const agent = await sqlPool`SELECT first_steps FROM fiaon_agents WHERE id = ${req.agent!.id}`;
    let manual: Record<string, boolean> = {};
    try { manual = JSON.parse(agent[0].first_steps || "{}"); } catch { /* leer */ }
    if (key === "dismiss") manual.dismissed = true;
    else manual[key] = true;
    await sqlPool`UPDATE fiaon_agents SET first_steps = ${JSON.stringify(manual)} WHERE id = ${req.agent!.id}`;
    res.json({ ok: true });
  } catch (err) {
    console.error("[FIAON-AGENT-PORTAL] first-steps save:", err);
    res.status(500).json({ ok: false, error: "Serverfehler" });
  }
});

// ═══════════════ ADMIN — Agent-Updates pflegen (AM3) ═══════════════
// blockAgentsFromAdmin (routes.ts) lehnt Agent-Tokens auf /admin/* mit 403 ab.

router.get("/admin/agent-updates", async (_req, res) => {
  try {
    await ensurePortalTables();
    const rows = await sqlPool`
      SELECT u.id, u.title, u.body, u.published, u.published_at, u.created_at, u.updated_at,
             (SELECT COUNT(*)::int FROM fiaon_agent_update_reads r WHERE r.update_id = u.id) AS read_count
      FROM fiaon_agent_updates u WHERE u.deleted_at IS NULL
      ORDER BY COALESCE(u.published_at, u.created_at) DESC
    `;
    const agents = await sqlPool`SELECT COUNT(*)::int AS c FROM fiaon_agents WHERE active = TRUE`;
    res.json({ ok: true, data: rows, activeAgents: Number(agents[0].c) });
  } catch (err) {
    console.error("[FIAON-AGENT-PORTAL] admin updates:", err);
    res.status(500).json({ ok: false, error: "Serverfehler" });
  }
});

router.post("/admin/agent-updates", async (req, res) => {
  try {
    await ensurePortalTables();
    const title = String(req.body?.title || "").trim().slice(0, 160);
    const body = String(req.body?.body || "").trim().slice(0, 10000);
    const publish = !!req.body?.publish;
    if (!title) return res.status(400).json({ ok: false, error: "Titel erforderlich" });
    if (!body) return res.status(400).json({ ok: false, error: "Beschreibung erforderlich" });
    const rows = await sqlPool`
      INSERT INTO fiaon_agent_updates (title, body, published, published_at)
      VALUES (${title}, ${body}, ${publish}, ${publish ? new Date() : null})
      RETURNING id
    `;
    console.log(`[FIAON-AGENT-PORTAL] Update #${rows[0].id} angelegt (${publish ? "veröffentlicht" : "Entwurf"})`);
    res.json({ ok: true, id: rows[0].id });
  } catch (err) {
    console.error("[FIAON-AGENT-PORTAL] admin update create:", err);
    res.status(500).json({ ok: false, error: "Serverfehler" });
  }
});

router.patch("/admin/agent-updates/:id", async (req, res) => {
  try {
    await ensurePortalTables();
    const id = Number(req.params.id);
    const cur = await sqlPool`SELECT id, published FROM fiaon_agent_updates WHERE id = ${id} AND deleted_at IS NULL`;
    if (cur.length === 0) return res.status(404).json({ ok: false, error: "Update nicht gefunden" });
    const title = req.body?.title != null ? String(req.body.title).trim().slice(0, 160) : null;
    const body = req.body?.body != null ? String(req.body.body).trim().slice(0, 10000) : null;
    const published = req.body?.published != null ? !!req.body.published : null;
    if (title !== null && !title) return res.status(400).json({ ok: false, error: "Titel darf nicht leer sein" });
    await sqlPool`
      UPDATE fiaon_agent_updates SET
        title = COALESCE(${title}, title),
        body = COALESCE(${body}, body),
        published = COALESCE(${published}, published),
        published_at = CASE
          WHEN ${published} = TRUE AND published_at IS NULL THEN NOW()
          WHEN ${published} = FALSE THEN NULL
          ELSE published_at END,
        updated_at = NOW()
      WHERE id = ${id}
    `;
    res.json({ ok: true });
  } catch (err) {
    console.error("[FIAON-AGENT-PORTAL] admin update edit:", err);
    res.status(500).json({ ok: false, error: "Serverfehler" });
  }
});

router.delete("/admin/agent-updates/:id", async (req, res) => {
  try {
    await ensurePortalTables();
    await sqlPool`UPDATE fiaon_agent_updates SET deleted_at = NOW(), published = FALSE WHERE id = ${Number(req.params.id)}`;
    res.json({ ok: true });
  } catch (err) {
    console.error("[FIAON-AGENT-PORTAL] admin update delete:", err);
    res.status(500).json({ ok: false, error: "Serverfehler" });
  }
});

// ═══════════════ ADMIN — Agent-Feedback + Provisions-Dankeschön (AN2) ═══════════════

router.get("/admin/agent-feedback", async (_req, res) => {
  try {
    await ensurePortalTables();
    const rows = await sqlPool`
      SELECT f.id, f.agent_id, f.category, f.title, f.description, f.screenshot IS NOT NULL AS has_screenshot,
             f.status, f.admin_comment, f.reward_cents, f.created_at, f.updated_at,
             a.name AS agent_name, a.email AS agent_email
      FROM fiaon_agent_feedback f
      JOIN fiaon_agents a ON a.id = f.agent_id
      ORDER BY (f.status = 'offen') DESC, f.created_at DESC
      LIMIT 200
    `;
    res.json({ ok: true, data: rows });
  } catch (err) {
    console.error("[FIAON-AGENT-PORTAL] admin feedback:", err);
    res.status(500).json({ ok: false, error: "Serverfehler" });
  }
});

router.get("/admin/agent-feedback/:id/screenshot", async (req, res) => {
  try {
    await ensurePortalTables();
    const rows = await sqlPool`SELECT screenshot FROM fiaon_agent_feedback WHERE id = ${Number(req.params.id)}`;
    if (rows.length === 0 || !rows[0].screenshot) return res.status(404).json({ ok: false, error: "Kein Screenshot" });
    res.json({ ok: true, screenshot: rows[0].screenshot });
  } catch (err) {
    console.error("[FIAON-AGENT-PORTAL] admin feedback screenshot:", err);
    res.status(500).json({ ok: false, error: "Serverfehler" });
  }
});

const FEEDBACK_STATUS = new Set(["offen", "geprueft", "umgesetzt", "abgelehnt"]);

router.patch("/admin/agent-feedback/:id", async (req, res) => {
  try {
    await ensurePortalTables();
    const id = Number(req.params.id);
    const status = req.body?.status != null ? String(req.body.status) : null;
    const comment = req.body?.adminComment != null ? String(req.body.adminComment).trim().slice(0, 2000) : null;
    if (status !== null && !FEEDBACK_STATUS.has(status)) return res.status(400).json({ ok: false, error: "Status ungültig" });
    const rows = await sqlPool`
      UPDATE fiaon_agent_feedback SET
        status = COALESCE(${status}, status),
        admin_comment = COALESCE(${comment}, admin_comment),
        updated_at = NOW()
      WHERE id = ${id}
      RETURNING id
    `;
    if (rows.length === 0) return res.status(404).json({ ok: false, error: "Ticket nicht gefunden" });
    res.json({ ok: true });
  } catch (err) {
    console.error("[FIAON-AGENT-PORTAL] admin feedback edit:", err);
    res.status(500).json({ ok: false, error: "Serverfehler" });
  }
});

/**
 * Einmalige Provisions-Gutschrift als Dankeschön (AN2): erzeugt einen
 * regulären Provisionseintrag kind='feedback_bonus' (status 'bestaetigt'),
 * der ins normale Guthaben/Auszahlung fließt. KEINE automatische Auszahlung —
 * der Admin bestätigt bewusst; pro Ticket maximal EINE Gutschrift.
 */
router.post("/admin/agent-feedback/:id/reward", async (req, res) => {
  try {
    await ensurePortalTables();
    const id = Number(req.params.id);
    const amountCents = Math.round(Number(req.body?.amountCents));
    if (isNaN(amountCents) || amountCents < 100 || amountCents > 500_000) {
      return res.status(400).json({ ok: false, error: "Betrag ungültig (1,00 € – 5.000,00 €)" });
    }
    const tickets = await sqlPool`
      SELECT f.id, f.agent_id, f.title, f.reward_commission_id, a.name AS agent_name, a.email AS agent_email, a.first_name
      FROM fiaon_agent_feedback f JOIN fiaon_agents a ON a.id = f.agent_id
      WHERE f.id = ${id}
    `;
    if (tickets.length === 0) return res.status(404).json({ ok: false, error: "Ticket nicht gefunden" });
    const t = tickets[0];
    if (t.reward_commission_id) return res.status(409).json({ ok: false, error: "Dieses Feedback wurde bereits honoriert" });

    const commission = await sqlPool`
      INSERT INTO fiaon_commissions (agent_id, ref, pack_name, base_amount_cents, rate_bp, amount_cents, status, kind, note)
      VALUES (${t.agent_id}, ${`FEEDBACK-${t.id}`}, ${"Feedback-Dankeschön"}, ${amountCents}, 0, ${amountCents}, 'bestaetigt', 'feedback_bonus',
              ${`Einmalige Gutschrift für Feedback #${t.id}: "${t.title}"`})
      RETURNING id
    `;
    await sqlPool`
      UPDATE fiaon_agent_feedback SET reward_cents = ${amountCents}, reward_commission_id = ${commission[0].id},
        status = CASE WHEN status = 'offen' THEN 'umgesetzt' ELSE status END, updated_at = NOW()
      WHERE id = ${t.id}
    `;
    await logAgentEvent(t.agent_id, "feedback_rewarded", { feedback_id: t.id, amount_cents: amountCents, commission_id: commission[0].id });
    // Betreiber-TODO (dokumentiert): Make-Zweig 'agent_feedback_rewarded' + Brevo-Template
    sendMakeWebhook("agent_feedback_rewarded", {
      email: t.agent_email,
      vorname: t.first_name || t.agent_name,
      betrag_eur: (amountCents / 100).toFixed(2),
      feedback_titel: t.title,
    }).catch(() => {});
    console.log(`[FIAON-FEEDBACK] Bonus ${(amountCents / 100).toFixed(2)} € für Ticket #${t.id} → Agent ${t.agent_id}`);
    res.json({ ok: true, commissionId: commission[0].id });
  } catch (err) {
    console.error("[FIAON-AGENT-PORTAL] admin feedback reward:", err);
    res.status(500).json({ ok: false, error: "Serverfehler" });
  }
});

// ═══════════════ ADMIN — Tagesziele pro Agent (AG1) ═══════════════

router.get("/admin/agent-daily-goals", async (_req, res) => {
  try {
    await ensurePortalTables();
    const rows = await sqlPool`
      SELECT id, name, email, daily_goal_cents, daily_contacts_goal
      FROM fiaon_agents WHERE active = TRUE ORDER BY name ASC
    `;
    res.json({
      ok: true,
      data: rows,
      defaults: { dailyGoalCents: DEFAULT_DAILY_GOAL_CENTS, dailyContactsGoal: DEFAULT_DAILY_CONTACTS },
    });
  } catch (err) {
    console.error("[FIAON-AGENT-PORTAL] daily goals list:", err);
    res.status(500).json({ ok: false, error: "Serverfehler" });
  }
});

router.patch("/admin/agents/:id/daily-goals", async (req, res) => {
  try {
    await ensurePortalTables();
    const id = Number(req.params.id);
    const goal = req.body?.dailyGoalCents;
    const contacts = req.body?.dailyContactsGoal;
    let goalCents: number | null = null;
    if (goal != null && goal !== "") {
      goalCents = Math.round(Number(goal));
      if (isNaN(goalCents) || goalCents < 0 || goalCents > 10_000_000) return res.status(400).json({ ok: false, error: "Tagesziel ungültig" });
      if (goalCents === 0) goalCents = null;
    }
    let contactsGoal: number | null = null;
    if (contacts != null && contacts !== "") {
      contactsGoal = Math.round(Number(contacts));
      if (isNaN(contactsGoal) || contactsGoal < 0 || contactsGoal > 500) return res.status(400).json({ ok: false, error: "Kontaktziel ungültig" });
      if (contactsGoal === 0) contactsGoal = null;
    }
    const rows = await sqlPool`
      UPDATE fiaon_agents SET daily_goal_cents = ${goalCents}, daily_contacts_goal = ${contactsGoal}
      WHERE id = ${id} RETURNING id
    `;
    if (rows.length === 0) return res.status(404).json({ ok: false, error: "Agent nicht gefunden" });
    res.json({ ok: true });
  } catch (err) {
    console.error("[FIAON-AGENT-PORTAL] daily goals:", err);
    res.status(500).json({ ok: false, error: "Serverfehler" });
  }
});

export default router;
