// ═══════════════════════════════════════════════════════════════════
// FIAON Admin: Team-Steuerung (Paket K) + Auszahlungen (H2) + Skripte (I1)
// + Einstellungen (G1) + Storno/Erstattung (G3.5)
// Alle Routen liegen unter /admin/* — blockAgentsFromAdmin (fiaon-agent.ts)
// lehnt Requests mit Agent-Token serverseitig mit 403 ab.
// Nichts wird hart gelöscht (Soft-Delete-Prinzip).
// ═══════════════════════════════════════════════════════════════════

import { Router } from "express";
import postgres from "postgres";
import { randomBytes } from "crypto";
import { sendMakeWebhook } from "../make-webhook";
import {
  ensureAgentTables, getSettings, setSetting, agentRateBp,
  decryptSecret, hashToken, baseUrl, logAgentEvent,
  onCustomerRefunded,
} from "./fiaon-agent";

const router = Router();
const sqlPool = postgres(process.env.DATABASE_URL!, { ssl: "require", max: 5 });

const INVITE_TTL_MS = 48 * 60 * 60 * 1000;

// ═══════════════ AGENTS: Verwaltung + Onboarding (F1) ═══════════════

router.get("/admin/agents", async (_req, res) => {
  try {
    await ensureAgentTables();
    const settings = await getSettings();
    const agents = await sqlPool`
      SELECT a.id, a.name, a.first_name, a.last_name, a.email, a.phone, a.active, a.avatar,
             a.commission_rate_bp, a.monthly_goal_cents,
             a.bank_iban_masked, a.bank_updated_at, a.bank_change_ack,
             a.invite_expires_at, a.password_hash IS NOT NULL AS has_password,
             a.last_login_at, a.created_at,
             a.recruited_by, a.override_rate_bp, a.distribution_active,
             r.name AS recruited_by_name
      FROM fiaon_agents a
      LEFT JOIN fiaon_agents r ON r.id = a.recruited_by
      ORDER BY a.created_at ASC
    `;
    res.json({
      ok: true,
      data: agents,
      defaults: {
        commissionRateBp: Number(settings.default_commission_rate_bp),
        payoutMinCents: Number(settings.payout_min_cents),
      },
    });
  } catch (err) {
    console.error("[FIAON-TEAM] agents list:", err);
    res.status(500).json({ ok: false, error: "Serverfehler" });
  }
});

/** F1: Agent anlegen — OHNE Passwort. Erzeugt 48h-Einladungs-Token + Make `agent_invite`. */
router.post("/admin/agents", async (req, res) => {
  try {
    await ensureAgentTables();
    const { firstName, lastName, email, phone, commissionRateBp, monthlyGoalCents, recruitedBy, overrideRateBp, suggestionId } = req.body || {};
    if (!firstName || !lastName || !email) return res.status(400).json({ ok: false, error: "Vorname, Nachname und E-Mail erforderlich" });
    const rateBp = commissionRateBp != null && commissionRateBp !== "" ? Math.round(Number(commissionRateBp)) : null;
    if (rateBp != null && (isNaN(rateBp) || rateBp < 0 || rateBp > 10000)) return res.status(400).json({ ok: false, error: "Provisionssatz ungültig (0–100 %)" });
    const goal = monthlyGoalCents != null && monthlyGoalCents !== "" ? Math.round(Number(monthlyGoalCents)) : null;
    // Paket AE2: Werber (recruited_by) — nur Admin setzbar; Override-Satz pro Beziehung optional
    const recruiter = recruitedBy != null && recruitedBy !== "" ? Number(recruitedBy) : null;
    if (recruiter != null && (!Number.isInteger(recruiter) || recruiter <= 0)) return res.status(400).json({ ok: false, error: "Werber-ID ungültig" });
    const ovBp = overrideRateBp != null && overrideRateBp !== "" ? Math.round(Number(overrideRateBp)) : null;
    if (ovBp != null && (isNaN(ovBp) || ovBp < 0 || ovBp > 5000)) return res.status(400).json({ ok: false, error: "Override-Satz ungültig (0–50 %)" });
    const token = randomBytes(32).toString("hex");
    const name = `${String(firstName).trim()} ${String(lastName).trim()}`;
    const rows = await sqlPool`
      INSERT INTO fiaon_agents (name, first_name, last_name, email, phone, commission_rate_bp, monthly_goal_cents, invite_token_hash, invite_expires_at, recruited_by, override_rate_bp)
      VALUES (${name}, ${String(firstName).trim()}, ${String(lastName).trim()}, ${String(email).trim().toLowerCase()},
              ${phone ? String(phone).trim() : null}, ${rateBp}, ${goal},
              ${hashToken(token)}, ${new Date(Date.now() + INVITE_TTL_MS)}, ${recruiter}, ${ovBp})
      ON CONFLICT (email) DO NOTHING
      RETURNING id, name, email
    `;
    if (rows.length === 0) return res.status(409).json({ ok: false, error: "E-Mail bereits vergeben" });
    await logAgentEvent(rows[0].id, "invited", { by: "admin", recruited_by: recruiter });
    // Paket AE4: kam der Agent über einen Partner-Vorschlag → Anfrage als angenommen markieren
    if (suggestionId != null && Number(suggestionId) > 0) {
      await sqlPool`
        UPDATE fiaon_partner_suggestions
        SET status = 'angenommen', created_agent_id = ${rows[0].id}, decided_at = NOW()
        WHERE id = ${Number(suggestionId)} AND status = 'offen'
      `;
    }
    sendMakeWebhook("agent_invite", {
      email: rows[0].email,
      vorname: String(firstName).trim(),
      nachname: String(lastName).trim(),
      invite_url: `${baseUrl()}/agent/setup/${token}`,
      admin_name: "FIAON Admin",
    }).catch(() => {});
    console.log(`[FIAON-TEAM] Agent eingeladen: ${rows[0].email}`);
    res.json({ ok: true, agent: rows[0] });
  } catch (err) {
    console.error("[FIAON-TEAM] agent create:", err);
    res.status(500).json({ ok: false, error: "Serverfehler" });
  }
});

/** F1: Einladung erneut senden — neuer Token, alter verfällt sofort. */
router.post("/admin/agents/:id/reinvite", async (req, res) => {
  try {
    await ensureAgentTables();
    const token = randomBytes(32).toString("hex");
    const rows = await sqlPool`
      UPDATE fiaon_agents SET invite_token_hash = ${hashToken(token)}, invite_expires_at = ${new Date(Date.now() + INVITE_TTL_MS)}
      WHERE id = ${Number(req.params.id)} AND active = TRUE
      RETURNING id, email, first_name, last_name, name
    `;
    if (rows.length === 0) return res.status(404).json({ ok: false, error: "Agent nicht gefunden oder deaktiviert" });
    await logAgentEvent(rows[0].id, "invite_resent", {});
    sendMakeWebhook("agent_invite", {
      email: rows[0].email,
      vorname: rows[0].first_name || rows[0].name,
      nachname: rows[0].last_name || "",
      invite_url: `${baseUrl()}/agent/setup/${token}`,
      admin_name: "FIAON Admin",
    }).catch(() => {});
    res.json({ ok: true });
  } catch (err) {
    console.error("[FIAON-TEAM] reinvite:", err);
    res.status(500).json({ ok: false, error: "Serverfehler" });
  }
});

/** K: Einstellungen je Agent (Satz/Ziel/Stammdaten/aktiv). Satzänderung wirkt NUR auf künftige Provisionen. */
router.post("/admin/agents/:id/update", async (req, res) => {
  try {
    await ensureAgentTables();
    const id = Number(req.params.id);
    const { firstName, lastName, phone, commissionRateBp, monthlyGoalCents, active, recruitedBy, overrideRateBp, distributionActive } = req.body || {};
    const rateBp = commissionRateBp === null || commissionRateBp === "" || commissionRateBp === undefined ? null : Math.round(Number(commissionRateBp));
    if (rateBp != null && (isNaN(rateBp) || rateBp < 0 || rateBp > 10000)) return res.status(400).json({ ok: false, error: "Provisionssatz ungültig" });
    const goal = monthlyGoalCents === null || monthlyGoalCents === "" || monthlyGoalCents === undefined ? null : Math.round(Number(monthlyGoalCents));
    // Paket AE2: recruited_by nur Admin setzbar; Selbst-Werbung und Ketten-Setups abfangen
    const recruiter = recruitedBy === undefined ? undefined : (recruitedBy === null || recruitedBy === "" ? null : Number(recruitedBy));
    if (recruiter != null && (!Number.isInteger(recruiter) || recruiter <= 0 || recruiter === id)) return res.status(400).json({ ok: false, error: "Werber-ID ungültig (kein Selbstbezug)" });
    const ovBp = overrideRateBp === undefined ? undefined : (overrideRateBp === null || overrideRateBp === "" ? null : Math.round(Number(overrideRateBp)));
    if (ovBp != null && (isNaN(ovBp) || ovBp < 0 || ovBp > 5000)) return res.status(400).json({ ok: false, error: "Override-Satz ungültig (0–50 %)" });
    const rows = await sqlPool`
      UPDATE fiaon_agents SET
        first_name = COALESCE(${firstName ? String(firstName).trim() : null}, first_name),
        last_name = COALESCE(${lastName ? String(lastName).trim() : null}, last_name),
        name = COALESCE(${firstName && lastName ? `${String(firstName).trim()} ${String(lastName).trim()}` : null}, name),
        phone = ${phone ? String(phone).trim() : null},
        commission_rate_bp = ${rateBp},
        monthly_goal_cents = ${goal},
        active = COALESCE(${typeof active === "boolean" ? active : null}, active),
        recruited_by = ${recruiter === undefined ? sqlPool`recruited_by` : recruiter},
        override_rate_bp = ${ovBp === undefined ? sqlPool`override_rate_bp` : ovBp},
        distribution_active = COALESCE(${typeof distributionActive === "boolean" ? distributionActive : null}, distribution_active)
      WHERE id = ${id}
      RETURNING id, name, email, active, commission_rate_bp, monthly_goal_cents, recruited_by, override_rate_bp, distribution_active
    `;
    if (rows.length === 0) return res.status(404).json({ ok: false, error: "Agent nicht gefunden" });
    res.json({ ok: true, agent: rows[0] });
  } catch (err) {
    console.error("[FIAON-TEAM] agent update:", err);
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
    console.error("[FIAON-TEAM] toggle:", err);
    res.status(500).json({ ok: false, error: "Serverfehler" });
  }
});

/** F2: Passwort-Reset erzwingen — invalidiert ALLE Sessions (Epoch+1) + Reset-Mail (1h-Token). */
router.post("/admin/agents/:id/force-reset", async (req, res) => {
  try {
    await ensureAgentTables();
    const token = randomBytes(32).toString("hex");
    const rows = await sqlPool`
      UPDATE fiaon_agents SET
        session_epoch = session_epoch + 1,
        reset_token_hash = ${hashToken(token)},
        reset_expires_at = ${new Date(Date.now() + 60 * 60 * 1000)}
      WHERE id = ${Number(req.params.id)} AND active = TRUE
      RETURNING id, email, first_name, name
    `;
    if (rows.length === 0) return res.status(404).json({ ok: false, error: "Agent nicht gefunden oder deaktiviert" });
    await logAgentEvent(rows[0].id, "force_reset", { by: "admin" });
    sendMakeWebhook("agent_password_reset", {
      email: rows[0].email,
      vorname: rows[0].first_name || rows[0].name,
      reset_url: `${baseUrl()}/agent/passwort?token=${token}`,
      forced: true,
    }).catch(() => {});
    res.json({ ok: true });
  } catch (err) {
    console.error("[FIAON-TEAM] force-reset:", err);
    res.status(500).json({ ok: false, error: "Serverfehler" });
  }
});

/** F3: Bankdaten-Änderungs-Banner quittieren (Betrugsschutz-Hinweis). */
router.post("/admin/agents/bank-changes/ack", async (_req, res) => {
  try {
    await ensureAgentTables();
    await sqlPool`UPDATE fiaon_agents SET bank_change_ack = TRUE WHERE bank_change_ack = FALSE`;
    res.json({ ok: true });
  } catch (err) {
    console.error("[FIAON-TEAM] bank ack:", err);
    res.status(500).json({ ok: false, error: "Serverfehler" });
  }
});

// ═══════════════ TEAM: Statistik (K) ═══════════════

router.get("/admin/team/stats", async (_req, res) => {
  try {
    await ensureAgentTables();
    const settings = await getSettings();
    const agents = await sqlPool`
      SELECT a.id, a.name, a.first_name, a.last_name, a.email, a.phone, a.active, a.avatar,
             a.commission_rate_bp, a.monthly_goal_cents, a.bank_iban_masked, a.bank_change_ack,
             a.invite_expires_at, a.password_hash IS NOT NULL AS has_password, a.last_login_at, a.created_at,
             a.recruited_by, a.override_rate_bp, a.distribution_active,
             r.name AS recruited_by_name
      FROM fiaon_agents a
      LEFT JOIN fiaon_agents r ON r.id = a.recruited_by
      ORDER BY a.created_at ASC
    `;
    const assigned = await sqlPool`
      SELECT assigned_agent_id AS id, COUNT(*) AS c FROM fiaon_applications
      WHERE assigned_agent_id IS NOT NULL AND merged_into IS NULL AND payment_status IN ('pending_payment','claimed_paid')
      GROUP BY assigned_agent_id
    `;
    const contacts = await sqlPool`
      SELECT agent_id AS id,
        COUNT(*) FILTER (WHERE created_at >= date_trunc('day', NOW())) AS today,
        COUNT(*) FILTER (WHERE created_at >= date_trunc('week', NOW())) AS week,
        COUNT(*) FILTER (WHERE type = 'result') AS results,
        COUNT(*) FILTER (WHERE type = 'result' AND outcome LIKE 'erreicht%') AS reached
      FROM fiaon_contact_log WHERE agent_id IS NOT NULL GROUP BY agent_id
    `;
    const commissions = await sqlPool`
      SELECT agent_id AS id,
        COUNT(*) FILTER (WHERE amount_cents > 0 AND status != 'storniert') AS conversions,
        COALESCE(SUM(base_amount_cents) FILTER (WHERE amount_cents > 0 AND status != 'storniert'), 0) AS revenue,
        COALESCE(SUM(amount_cents) FILTER (WHERE status = 'bestaetigt'), 0) AS confirmed,
        COALESCE(SUM(amount_cents) FILTER (WHERE status = 'in_auszahlung'), 0) AS in_payout,
        COALESCE(SUM(amount_cents) FILTER (WHERE status = 'ausgezahlt'), 0) AS paid_out
      FROM fiaon_commissions GROUP BY agent_id
    `;
    const byId = (rows: any[]) => Object.fromEntries(rows.map((r) => [r.id, r]));
    const aMap = byId(assigned), cMap = byId(contacts), kMap = byId(commissions);
    res.json({
      ok: true,
      defaults: { commissionRateBp: Number(settings.default_commission_rate_bp) },
      data: agents.map((ag: any) => {
        const c = cMap[ag.id] || {}, k = kMap[ag.id] || {};
        const results = Number(c.results || 0), reached = Number(c.reached || 0);
        return {
          ...ag,
          effective_rate_bp: agentRateBp(ag, settings),
          assigned_count: Number(aMap[ag.id]?.c || 0),
          contacts_today: Number(c.today || 0),
          contacts_week: Number(c.week || 0),
          reached_quote: results > 0 ? Math.round((reached / results) * 100) : null,
          conversions: Number(k.conversions || 0),
          revenue_cents: Number(k.revenue || 0),
          confirmed_cents: Number(k.confirmed || 0),
          in_payout_cents: Number(k.in_payout || 0),
          paid_out_cents: Number(k.paid_out || 0),
        };
      }),
    });
  } catch (err) {
    console.error("[FIAON-TEAM] stats:", err);
    res.status(500).json({ ok: false, error: "Serverfehler" });
  }
});

/** K: Detailansicht je Agent — Aktivitäts-Log (Kontakte + Konto-Ereignisse) + Provisions-Historie. */
router.get("/admin/team/agents/:id", async (req, res) => {
  try {
    await ensureAgentTables();
    const id = Number(req.params.id);
    const agents = await sqlPool`
      SELECT a.id, a.name, a.first_name, a.last_name, a.email, a.phone, a.active, a.avatar,
             a.commission_rate_bp, a.monthly_goal_cents, a.bank_iban_masked, a.bank_updated_at,
             a.invite_expires_at, a.password_hash IS NOT NULL AS has_password, a.last_login_at, a.created_at,
             a.recruited_by, a.override_rate_bp, a.distribution_active,
             r.name AS recruited_by_name
      FROM fiaon_agents a
      LEFT JOIN fiaon_agents r ON r.id = a.recruited_by
      WHERE a.id = ${id}
    `;
    if (agents.length === 0) return res.status(404).json({ ok: false, error: "Agent nicht gefunden" });
    const contactLog = await sqlPool`
      SELECT id, ref, type, outcome, note, scheduled_at, promised_date, created_at
      FROM fiaon_contact_log WHERE agent_id = ${id} ORDER BY created_at DESC LIMIT 200
    `;
    const events = await sqlPool`
      SELECT id, type, meta, created_at FROM fiaon_agent_events WHERE agent_id = ${id} ORDER BY created_at DESC LIMIT 200
    `;
    const commissions = await sqlPool`
      SELECT id, ref, payment_reference, pack_name, base_amount_cents, rate_bp, amount_cents, status, kind, note, created_at
      FROM fiaon_commissions WHERE agent_id = ${id} ORDER BY created_at DESC LIMIT 200
    `;
    const customers = await sqlPool`
      SELECT ref, first_name, last_name, contact_name, company_name, payment_status, amount_due, payment_reference
      FROM fiaon_applications
      WHERE assigned_agent_id = ${id} AND merged_into IS NULL AND payment_status IN ('pending_payment','claimed_paid')
      ORDER BY created_at DESC
    `;
    res.json({ ok: true, agent: agents[0], contactLog, events, commissions, customers });
  } catch (err) {
    console.error("[FIAON-TEAM] agent detail:", err);
    res.status(500).json({ ok: false, error: "Serverfehler" });
  }
});

/** Paket Z: Volle Auszahlungsdaten eines Agents — NUR Admin (Agent-Token ⇒ 403
 *  über blockAgentsFromAdmin). JEDER Abruf erzeugt einen Audit-Eintrag
 *  (bank_viewed_by_admin), damit die Einsicht in unmaskierte IBANs nachvollziehbar
 *  bleibt. Liefert zusätzlich die letzte Bankänderung (alt→neu, Zeit, IP) aus dem
 *  Audit-Log für den Betrugsschutz-Vergleich. */
router.get("/admin/team/agents/:id/bank", async (req, res) => {
  try {
    await ensureAgentTables();
    const id = Number(req.params.id);
    const rows = await sqlPool`
      SELECT bank_holder_enc, bank_iban_enc, bank_bic_enc, bank_iban_masked, bank_updated_at, bank_change_ack
      FROM fiaon_agents WHERE id = ${id}
    `;
    if (rows.length === 0) return res.status(404).json({ ok: false, error: "Agent nicht gefunden" });
    const r = rows[0];
    // Letzte Bankänderung aus dem Audit-Log (alt→neu + Herkunft, sofern vorhanden)
    const ev = await sqlPool`
      SELECT meta, created_at FROM fiaon_agent_events
      WHERE agent_id = ${id} AND type = 'bank_changed' ORDER BY created_at DESC LIMIT 1
    `;
    let lastChange: { oldIbanMasked: string | null; newIbanMasked: string | null; ip: string | null; at: string } | null = null;
    if (ev.length > 0) {
      let m: any = {};
      try { m = JSON.parse(ev[0].meta || "{}"); } catch { /* tolerant */ }
      lastChange = {
        oldIbanMasked: m.old_iban_masked ?? null,
        newIbanMasked: m.iban_masked ?? null,
        ip: m.ip ?? null,
        at: new Date(ev[0].created_at).toISOString(),
      };
    }
    // Audit: Admin hat die volle IBAN eingesehen (wer=Admin, wann, welcher Agent)
    const ip = String((req.headers["x-forwarded-for"] as string || "").split(",")[0].trim() || req.socket?.remoteAddress || "");
    await logAgentEvent(id, "bank_viewed_by_admin", { at: new Date().toISOString(), ip });
    res.json({
      ok: true,
      bank: {
        hasBank: !!r.bank_iban_enc,
        holder: decryptSecret(r.bank_holder_enc),
        ibanFull: decryptSecret(r.bank_iban_enc),
        ibanMasked: r.bank_iban_masked,
        bic: decryptSecret(r.bank_bic_enc),
        updatedAt: r.bank_updated_at,
        changeAck: r.bank_change_ack,
        lastChange,
      },
    });
  } catch (err) {
    console.error("[FIAON-TEAM] agent bank view:", err);
    res.status(500).json({ ok: false, error: "Serverfehler" });
  }
});

/** K: Kunden-Neuzuweisung — einzeln und als Massenaktion (toAgentId = null ⇒ Zuweisung entfernen). */
router.post("/admin/team/reassign", async (req, res) => {
  try {
    await ensureAgentTables();
    const refs: string[] = Array.isArray(req.body?.refs) ? req.body.refs.map(String) : [];
    const toAgentId = req.body?.toAgentId == null ? null : Number(req.body.toAgentId);
    if (refs.length === 0) return res.status(400).json({ ok: false, error: "Keine Kunden ausgewählt" });
    let toName = "—";
    if (toAgentId != null) {
      const t = await sqlPool`SELECT id, name FROM fiaon_agents WHERE id = ${toAgentId}`;
      if (t.length === 0) return res.status(404).json({ ok: false, error: "Ziel-Agent nicht gefunden" });
      toName = t[0].name;
    }
    const updated = await sqlPool`
      UPDATE fiaon_applications SET assigned_agent_id = ${toAgentId}, locked_by_agent_id = NULL, locked_until = NULL, updated_at = NOW()
      WHERE ref = ANY(${refs}) AND merged_into IS NULL
      RETURNING ref
    `;
    for (const r of updated) {
      await sqlPool`
        INSERT INTO fiaon_contact_log (ref, agent_id, agent_name, type, note)
        VALUES (${r.ref}, ${toAgentId}, ${toAgentId != null ? toName : "Admin"}, 'claim',
                ${toAgentId != null ? `Durch Admin zugewiesen an ${toName}` : "Zuweisung durch Admin entfernt"})
      `;
    }
    res.json({ ok: true, updated: updated.length });
  } catch (err) {
    console.error("[FIAON-TEAM] reassign:", err);
    res.status(500).json({ ok: false, error: "Serverfehler" });
  }
});

// Audit-Trail: alle Agent-Aktionen (bestehender Endpoint, jetzt hier)
router.get("/admin/agent-log", async (req, res) => {
  try {
    await ensureAgentTables();
    const ref = req.query.ref ? String(req.query.ref) : null;
    const rows = ref
      ? await sqlPool`SELECT * FROM fiaon_contact_log WHERE ref = ${ref} ORDER BY created_at DESC LIMIT 500`
      : await sqlPool`SELECT * FROM fiaon_contact_log ORDER BY created_at DESC LIMIT 500`;
    res.json({ ok: true, data: rows });
  } catch (err) {
    console.error("[FIAON-TEAM] agent-log:", err);
    res.status(500).json({ ok: false, error: "Serverfehler" });
  }
});

// ═══════════════ EINSTELLUNGEN (G1 + I2-Mapping) ═══════════════

router.get("/admin/settings", async (_req, res) => {
  try {
    const settings = await getSettings();
    res.json({
      ok: true,
      settings: {
        defaultCommissionRateBp: Number(settings.default_commission_rate_bp),
        payoutMinCents: Number(settings.payout_min_cents),
        scriptStatusMap: JSON.parse(settings.script_status_map || "{}"),
        // Paket V2: tägliche Reminder-Engine
        maxReminders: Number(settings.max_reminders),
        reminderWindowStart: Number(settings.reminder_window_start),
        reminderWindowEnd: Number(settings.reminder_window_end),
        reminderEngineEnabled: settings.reminder_engine_enabled === "1",
        // Paket AE1: automatische Kundenverteilung
        distributionEnabled: settings.distribution_enabled === "1",
        distributionCap: Number(settings.distribution_cap),
        // Paket AE2/AE3: Partner-Programm
        partnerOverrideBp: Number(settings.partner_override_bp),
        partnerThresholds: JSON.parse(settings.partner_thresholds || "[]"),
        partnerPrizes: JSON.parse(settings.partner_prizes || "{}"),
      },
    });
  } catch (err) {
    console.error("[FIAON-TEAM] settings:", err);
    res.status(500).json({ ok: false, error: "Serverfehler" });
  }
});

router.post("/admin/settings", async (req, res) => {
  try {
    await ensureAgentTables();
    const { defaultCommissionRateBp, payoutMinCents, scriptStatusMap,
            maxReminders, reminderWindowStart, reminderWindowEnd, reminderEngineEnabled } = req.body || {};
    if (defaultCommissionRateBp != null) {
      const v = Math.round(Number(defaultCommissionRateBp));
      if (isNaN(v) || v < 0 || v > 10000) return res.status(400).json({ ok: false, error: "Standard-Provisionssatz ungültig" });
      await setSetting("default_commission_rate_bp", String(v));
    }
    if (payoutMinCents != null) {
      const v = Math.round(Number(payoutMinCents));
      if (isNaN(v) || v < 0) return res.status(400).json({ ok: false, error: "Mindestbetrag ungültig" });
      await setSetting("payout_min_cents", String(v));
    }
    if (scriptStatusMap != null && typeof scriptStatusMap === "object") {
      await setSetting("script_status_map", JSON.stringify(scriptStatusMap));
    }
    // Paket V2: Reminder-Engine-Einstellungen (Versand bleibt IMMER auf 08–20 Uhr Berlin begrenzt)
    if (maxReminders != null) {
      const v = Math.round(Number(maxReminders));
      if (isNaN(v) || v < 0 || v > 30) return res.status(400).json({ ok: false, error: "Max. Erinnerungen ungültig (0–30)" });
      await setSetting("max_reminders", String(v));
    }
    if (reminderWindowStart != null) {
      const v = Math.round(Number(reminderWindowStart));
      if (isNaN(v) || v < 8 || v > 19) return res.status(400).json({ ok: false, error: "Versandfenster-Beginn ungültig (8–19 Uhr)" });
      await setSetting("reminder_window_start", String(v));
    }
    if (reminderWindowEnd != null) {
      const v = Math.round(Number(reminderWindowEnd));
      if (isNaN(v) || v < 9 || v > 20) return res.status(400).json({ ok: false, error: "Versandfenster-Ende ungültig (9–20 Uhr)" });
      await setSetting("reminder_window_end", String(v));
    }
    if (reminderEngineEnabled != null) {
      await setSetting("reminder_engine_enabled", reminderEngineEnabled ? "1" : "0");
    }
    // Paket AE1: Verteilung an/aus + Obergrenze
    const { distributionEnabled, distributionCap, partnerOverrideBp, partnerThresholds: pThresholds, partnerPrizes: pPrizes } = req.body || {};
    if (distributionEnabled != null) {
      await setSetting("distribution_enabled", distributionEnabled ? "1" : "0");
    }
    if (distributionCap != null) {
      const v = Math.round(Number(distributionCap));
      if (isNaN(v) || v < 0 || v > 10000) return res.status(400).json({ ok: false, error: "Verteilungs-Obergrenze ungültig" });
      await setSetting("distribution_cap", String(v));
    }
    // Paket AE2: Standard-Override-Satz
    if (partnerOverrideBp != null) {
      const v = Math.round(Number(partnerOverrideBp));
      if (isNaN(v) || v < 0 || v > 5000) return res.status(400).json({ ok: false, error: "Override-Satz ungültig (0–50 %)" });
      await setSetting("partner_override_bp", String(v));
    }
    // Paket AE3: Meilenstein-Schwellen + Zuschläge + Prämien (Admin-Pflege)
    if (Array.isArray(pThresholds)) {
      const clean = pThresholds
        .filter((t: any) => t && t.key && Number(t.minCents) > 0)
        .map((t: any) => ({ key: String(t.key), label: String(t.label || t.key), minCents: Math.round(Number(t.minCents)), bonusBp: Math.max(0, Math.min(5000, Math.round(Number(t.bonusBp) || 0))) }));
      if (clean.length > 0) await setSetting("partner_thresholds", JSON.stringify(clean));
    }
    if (pPrizes != null && typeof pPrizes === "object" && !Array.isArray(pPrizes)) {
      const clean: Record<string, { title: string; description: string }> = {};
      for (const [k, v] of Object.entries(pPrizes as Record<string, any>)) {
        if (v && typeof v.title === "string") clean[k] = { title: v.title.slice(0, 200), description: String(v.description || "").slice(0, 1000) };
      }
      await setSetting("partner_prizes", JSON.stringify(clean));
    }
    res.json({ ok: true });
  } catch (err) {
    console.error("[FIAON-TEAM] settings save:", err);
    res.status(500).json({ ok: false, error: "Serverfehler" });
  }
});

// ═══════════ PAKET AE4 — Partner-Anfragen (Admin) ═══════════

router.get("/admin/team/partner-suggestions", async (_req, res) => {
  try {
    await ensureAgentTables();
    const rows = await sqlPool`
      SELECT s.id, s.first_name, s.last_name, s.email, s.phone, s.reason, s.status,
             s.decision_reason, s.created_at, s.decided_at, s.created_agent_id,
             a.name AS suggested_by_name, a.id AS suggested_by_id
      FROM fiaon_partner_suggestions s
      LEFT JOIN fiaon_agents a ON a.id = s.agent_id
      ORDER BY (s.status = 'offen') DESC, s.created_at DESC
      LIMIT 200
    `;
    res.json({ ok: true, data: rows });
  } catch (err) {
    console.error("[FIAON-TEAM] partner-suggestions:", err);
    res.status(500).json({ ok: false, error: "Serverfehler" });
  }
});

// Ablehnen (mit optionalem Grund). Der Kandidat wird NICHT automatisch informiert.
// Annahme läuft über den normalen Agent-Anlege-Flow (POST /admin/agents mit
// recruitedBy + suggestionId) — recruited_by wird dort automatisch gesetzt.
router.post("/admin/team/partner-suggestions/:id/reject", async (req, res) => {
  try {
    await ensureAgentTables();
    const rows = await sqlPool`
      UPDATE fiaon_partner_suggestions
      SET status = 'abgelehnt', decision_reason = ${req.body?.reason ? String(req.body.reason).slice(0, 1000) : null}, decided_at = NOW()
      WHERE id = ${Number(req.params.id)} AND status = 'offen'
      RETURNING id
    `;
    if (rows.length === 0) return res.status(404).json({ ok: false, error: "Anfrage nicht gefunden oder bereits entschieden" });
    res.json({ ok: true });
  } catch (err) {
    console.error("[FIAON-TEAM] suggestion reject:", err);
    res.status(500).json({ ok: false, error: "Serverfehler" });
  }
});

// ═══════════ PAKET AE3 — Meilenstein-Prämien (Admin-Aufgaben) ═══════════

router.get("/admin/team/milestones", async (_req, res) => {
  try {
    await ensureAgentTables();
    const settings = await getSettings();
    let prizes: Record<string, { title: string }> = {};
    try { prizes = JSON.parse(settings.partner_prizes || "{}"); } catch { /* leer */ }
    const rows = await sqlPool`
      SELECT m.id, m.agent_id, m.milestone_key, m.achieved_at, m.prize_status, m.prize_done_at, a.name AS agent_name
      FROM fiaon_partner_milestones m
      LEFT JOIN fiaon_agents a ON a.id = m.agent_id
      ORDER BY (m.prize_status = 'offen') DESC, m.achieved_at DESC
      LIMIT 200
    `;
    res.json({ ok: true, data: rows.map((r: any) => ({ ...r, prize_title: prizes[r.milestone_key]?.title || null })) });
  } catch (err) {
    console.error("[FIAON-TEAM] milestones:", err);
    res.status(500).json({ ok: false, error: "Serverfehler" });
  }
});

router.post("/admin/team/milestones/:id/done", async (req, res) => {
  try {
    const rows = await sqlPool`
      UPDATE fiaon_partner_milestones SET prize_status = 'erledigt', prize_done_at = NOW()
      WHERE id = ${Number(req.params.id)} AND prize_status = 'offen'
      RETURNING id, agent_id, milestone_key
    `;
    if (rows.length === 0) return res.status(404).json({ ok: false, error: "Aufgabe nicht gefunden oder bereits erledigt" });
    await logAgentEvent(rows[0].agent_id, "milestone_prize_delivered", { milestone: rows[0].milestone_key });
    res.json({ ok: true });
  } catch (err) {
    console.error("[FIAON-TEAM] milestone done:", err);
    res.status(500).json({ ok: false, error: "Serverfehler" });
  }
});

// ═══════════════ AUSZAHLUNGEN: Admin (H2) ═══════════════

router.get("/admin/payouts", async (_req, res) => {
  try {
    await ensureAgentTables();
    const payouts = await sqlPool`
      SELECT p.*, a.name AS agent_name, a.email AS agent_email
      FROM fiaon_payouts p JOIN fiaon_agents a ON a.id = p.agent_id
      ORDER BY (p.status = 'angefordert') DESC, p.requested_at DESC
      LIMIT 200
    `;
    const entries = await sqlPool`
      SELECT payout_id, id, ref, payment_reference, pack_name, amount_cents, rate_bp, status, created_at
      FROM fiaon_commissions WHERE payout_id IS NOT NULL ORDER BY created_at ASC
    `;
    const byPayout: Record<number, any[]> = {};
    for (const e of entries) {
      (byPayout[e.payout_id] ||= []).push(e);
    }
    res.json({
      ok: true,
      data: payouts.map((p: any) => ({
        ...p,
        // Volle IBAN NUR hier (Admin-Auszahlungsansicht), aus verschlüsseltem Snapshot
        iban_full: p.status === "angefordert" ? decryptSecret(p.bank_iban_enc) : null,
        holder: decryptSecret(p.bank_holder_enc),
        bic: decryptSecret(p.bank_bic_enc),
        bank_holder_enc: undefined, bank_iban_enc: undefined, bank_bic_enc: undefined,
        entries: byPayout[p.id] || [],
      })),
    });
  } catch (err) {
    console.error("[FIAON-TEAM] payouts:", err);
    res.status(500).json({ ok: false, error: "Serverfehler" });
  }
});

/** H2: „Als überwiesen markieren" — setzt Einträge auf ausgezahlt + Make `agent_payout_done`. */
router.post("/admin/payouts/:id/mark-paid", async (req, res) => {
  try {
    await ensureAgentTables();
    const id = Number(req.params.id);
    const rows = await sqlPool`
      UPDATE fiaon_payouts SET status = 'ausgezahlt', processed_at = NOW()
      WHERE id = ${id} AND status = 'angefordert'
      RETURNING *
    `;
    if (rows.length === 0) return res.status(404).json({ ok: false, error: "Anforderung nicht gefunden oder bereits verarbeitet" });
    await sqlPool`UPDATE fiaon_commissions SET status = 'ausgezahlt', updated_at = NOW() WHERE payout_id = ${id} AND status = 'in_auszahlung'`;
    const agent = await sqlPool`SELECT email, first_name, name FROM fiaon_agents WHERE id = ${rows[0].agent_id}`;
    await logAgentEvent(rows[0].agent_id, "payout_paid", { payout_id: id, amount_cents: rows[0].amount_cents });
    sendMakeWebhook("agent_payout_done", {
      email: agent[0].email,
      vorname: agent[0].first_name || agent[0].name,
      betrag: (rows[0].amount_cents / 100).toFixed(2),
      iban_masked: rows[0].iban_masked,
    }).catch(() => {});
    console.log(`[FIAON-PAYOUT] Überwiesen markiert: #${id} (${(rows[0].amount_cents / 100).toFixed(2)} €)`);
    res.json({ ok: true });
  } catch (err) {
    console.error("[FIAON-TEAM] payout mark-paid:", err);
    res.status(500).json({ ok: false, error: "Serverfehler" });
  }
});

/** H2: „Ablehnen mit Grund" — Einträge zurück auf bestaetigt + Make `agent_payout_rejected`. */
router.post("/admin/payouts/:id/reject", async (req, res) => {
  try {
    await ensureAgentTables();
    const id = Number(req.params.id);
    const reason = String(req.body?.reason || "").trim();
    if (!reason) return res.status(400).json({ ok: false, error: "Ablehnungsgrund erforderlich" });
    const rows = await sqlPool`
      UPDATE fiaon_payouts SET status = 'abgelehnt', reject_reason = ${reason}, processed_at = NOW()
      WHERE id = ${id} AND status = 'angefordert'
      RETURNING *
    `;
    if (rows.length === 0) return res.status(404).json({ ok: false, error: "Anforderung nicht gefunden oder bereits verarbeitet" });
    await sqlPool`UPDATE fiaon_commissions SET status = 'bestaetigt', payout_id = NULL, updated_at = NOW() WHERE payout_id = ${id} AND status = 'in_auszahlung'`;
    const agent = await sqlPool`SELECT email, first_name, name FROM fiaon_agents WHERE id = ${rows[0].agent_id}`;
    await logAgentEvent(rows[0].agent_id, "payout_rejected", { payout_id: id, reason });
    sendMakeWebhook("agent_payout_rejected", {
      email: agent[0].email,
      vorname: agent[0].first_name || agent[0].name,
      betrag: (rows[0].amount_cents / 100).toFixed(2),
      grund: reason,
    }).catch(() => {});
    res.json({ ok: true });
  } catch (err) {
    console.error("[FIAON-TEAM] payout reject:", err);
    res.status(500).json({ ok: false, error: "Serverfehler" });
  }
});

/** H2: CSV-Export für die Buchhaltung (eine Auszahlung inkl. Positionen). */
router.get("/admin/payouts/:id/export.csv", async (req, res) => {
  try {
    await ensureAgentTables();
    const id = Number(req.params.id);
    const payouts = await sqlPool`
      SELECT p.*, a.name AS agent_name, a.email AS agent_email
      FROM fiaon_payouts p JOIN fiaon_agents a ON a.id = p.agent_id WHERE p.id = ${id}
    `;
    if (payouts.length === 0) return res.status(404).json({ ok: false, error: "Nicht gefunden" });
    const p = payouts[0];
    const entries = await sqlPool`
      SELECT ref, payment_reference, pack_name, base_amount_cents, rate_bp, amount_cents, created_at
      FROM fiaon_commissions WHERE payout_id = ${id} ORDER BY created_at ASC
    `;
    const esc = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;
    const eur = (c: number) => (c / 100).toFixed(2).replace(".", ",");
    const lines = [
      ["Auszahlung", `#${p.id}`].join(";"),
      ["Agent", p.agent_name, p.agent_email].map(esc).join(";"),
      ["Kontoinhaber", decryptSecret(p.bank_holder_enc) || ""].map(esc).join(";"),
      ["IBAN", decryptSecret(p.bank_iban_enc) || p.iban_masked || ""].map(esc).join(";"),
      ["BIC", decryptSecret(p.bank_bic_enc) || ""].map(esc).join(";"),
      ["Status", p.status, "Beantragt", new Date(p.requested_at).toLocaleString("de-DE"), "Verarbeitet", p.processed_at ? new Date(p.processed_at).toLocaleString("de-DE") : ""].map(esc).join(";"),
      "",
      ["Kunde-Referenz", "Zahlungsreferenz", "Paket", "Basis (EUR)", "Satz (%)", "Provision (EUR)", "Entstanden"].map(esc).join(";"),
      ...entries.map((e: any) =>
        [e.ref, e.payment_reference || "", (e.pack_name || "").replace(/\n/g, " "), eur(e.base_amount_cents), (e.rate_bp / 100).toFixed(2).replace(".", ","), eur(e.amount_cents), new Date(e.created_at).toLocaleDateString("de-DE")].map(esc).join(";"),
      ),
      "",
      ["Gesamt (EUR)", eur(p.amount_cents)].map(esc).join(";"),
    ];
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="FIAON-Auszahlung-${id}.csv"`);
    res.send("\uFEFF" + lines.join("\r\n"));
  } catch (err) {
    console.error("[FIAON-TEAM] payout export:", err);
    res.status(500).json({ ok: false, error: "Serverfehler" });
  }
});

// ═══════════════ STORNO / ERSTATTUNG (G3.5) ═══════════════

router.post("/admin/payments/:paymentRef/refund", async (req, res) => {
  try {
    await ensureAgentTables();
    const reason = String(req.body?.reason || "").trim();
    const rows = await sqlPool`
      UPDATE fiaon_applications SET payment_status = 'refunded', refunded_at = NOW(), updated_at = NOW()
      WHERE payment_reference = ${req.params.paymentRef} AND payment_status = 'paid'
      RETURNING ref, payment_reference, amount_due
    `;
    if (rows.length === 0) return res.status(404).json({ ok: false, error: "Keine bezahlte Bestellung mit dieser Referenz gefunden" });
    const commission = await onCustomerRefunded(rows[0].ref);
    await sqlPool`
      INSERT INTO fiaon_contact_log (ref, agent_id, agent_name, type, note)
      VALUES (${rows[0].ref}, NULL, 'Admin', 'system', ${`Zahlung storniert/erstattet${reason ? ` — Grund: ${reason}` : ""}`})
    `;
    console.log(`[FIAON-PAYMENT] Erstattet: ${req.params.paymentRef} (Provisionen: ${commission.cancelled} storniert, ${commission.clawback} Verrechnung)`);
    res.json({ ok: true, commission });
  } catch (err) {
    console.error("[FIAON-TEAM] refund:", err);
    res.status(500).json({ ok: false, error: "Serverfehler" });
  }
});

// ═══════════════ SKRIPTE: Admin-Verwaltung (I1) ═══════════════

function sanitizeHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/\son\w+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, "")
    .replace(/javascript:/gi, "")
    .slice(0, 100000);
}

router.get("/admin/scripts", async (_req, res) => {
  try {
    await ensureAgentTables();
    const rows = await sqlPool`
      SELECT id, title, category, content_html, file_name, file_mime, sort_order, active, updated_at, created_at
      FROM fiaon_scripts WHERE deleted_at IS NULL
      ORDER BY category ASC, sort_order ASC, id ASC
    `;
    res.json({ ok: true, data: rows });
  } catch (err) {
    console.error("[FIAON-TEAM] scripts:", err);
    res.status(500).json({ ok: false, error: "Serverfehler" });
  }
});

router.post("/admin/scripts", async (req, res) => {
  try {
    await ensureAgentTables();
    const { title, category, contentHtml, fileDataUrl, fileName } = req.body || {};
    if (!title || !category) return res.status(400).json({ ok: false, error: "Titel und Kategorie erforderlich" });
    let fileData: string | null = null, fileMime: string | null = null;
    if (fileDataUrl) {
      const m = String(fileDataUrl).match(/^data:(application\/pdf);base64,([A-Za-z0-9+/=]+)$/);
      if (!m) return res.status(400).json({ ok: false, error: "Nur PDF-Dateien erlaubt" });
      if (m[2].length * 0.75 > 10 * 1024 * 1024) return res.status(400).json({ ok: false, error: "Datei zu groß (max. 10 MB)" });
      fileData = m[2];
      fileMime = m[1];
    }
    const maxSort = await sqlPool`SELECT COALESCE(MAX(sort_order),0) AS m FROM fiaon_scripts WHERE category = ${String(category).trim()} AND deleted_at IS NULL`;
    const rows = await sqlPool`
      INSERT INTO fiaon_scripts (title, category, content_html, file_data, file_name, file_mime, sort_order)
      VALUES (${String(title).trim()}, ${String(category).trim()}, ${contentHtml ? sanitizeHtml(String(contentHtml)) : null},
              ${fileData}, ${fileName ? String(fileName).slice(0, 200) : null}, ${fileMime}, ${Number(maxSort[0].m) + 1})
      RETURNING id, title, category, sort_order, active
    `;
    res.json({ ok: true, script: rows[0] });
  } catch (err) {
    console.error("[FIAON-TEAM] script create:", err);
    res.status(500).json({ ok: false, error: "Serverfehler" });
  }
});

router.post("/admin/scripts/:id/update", async (req, res) => {
  try {
    const { title, category, contentHtml, active } = req.body || {};
    const rows = await sqlPool`
      UPDATE fiaon_scripts SET
        title = COALESCE(${title ? String(title).trim() : null}, title),
        category = COALESCE(${category ? String(category).trim() : null}, category),
        content_html = ${contentHtml ? sanitizeHtml(String(contentHtml)) : null},
        active = COALESCE(${typeof active === "boolean" ? active : null}, active),
        updated_at = NOW()
      WHERE id = ${Number(req.params.id)} AND deleted_at IS NULL
      RETURNING id, title, category, active
    `;
    if (rows.length === 0) return res.status(404).json({ ok: false, error: "Skript nicht gefunden" });
    res.json({ ok: true, script: rows[0] });
  } catch (err) {
    console.error("[FIAON-TEAM] script update:", err);
    res.status(500).json({ ok: false, error: "Serverfehler" });
  }
});

/** I1: Sortierung per Drag&Drop — Client sendet die neue ID-Reihenfolge. */
router.post("/admin/scripts/reorder", async (req, res) => {
  try {
    const ids: number[] = Array.isArray(req.body?.ids) ? req.body.ids.map(Number) : [];
    if (ids.length === 0) return res.status(400).json({ ok: false, error: "Keine IDs" });
    for (let i = 0; i < ids.length; i++) {
      await sqlPool`UPDATE fiaon_scripts SET sort_order = ${i + 1}, updated_at = NOW() WHERE id = ${ids[i]}`;
    }
    res.json({ ok: true });
  } catch (err) {
    console.error("[FIAON-TEAM] script reorder:", err);
    res.status(500).json({ ok: false, error: "Serverfehler" });
  }
});

// Soft-Delete (Prinzip: nichts hart löschen)
router.post("/admin/scripts/:id/delete", async (req, res) => {
  try {
    const rows = await sqlPool`
      UPDATE fiaon_scripts SET deleted_at = NOW(), active = FALSE, updated_at = NOW()
      WHERE id = ${Number(req.params.id)} AND deleted_at IS NULL RETURNING id
    `;
    if (rows.length === 0) return res.status(404).json({ ok: false, error: "Skript nicht gefunden" });
    res.json({ ok: true });
  } catch (err) {
    console.error("[FIAON-TEAM] script delete:", err);
    res.status(500).json({ ok: false, error: "Serverfehler" });
  }
});

export default router;
