// ═══════════════════════════════════════════════════════════════════
// FIAON Admin: Team-Steuerung (Paket K) + Auszahlungen (H2) + Skripte (I1)
// + Einstellungen (G1) + Storno/Erstattung (G3.5)
// Alle Routen liegen unter /admin/* — blockAgentsFromAdmin (fiaon-agent.ts)
// lehnt Requests mit Agent-Token serverseitig mit 403 ab.
// Nichts wird hart gelöscht (Soft-Delete-Prinzip).
// ═══════════════════════════════════════════════════════════════════

import { Router, type Request, type Response } from "express";
import { sqlPool } from "../lib/db-pool";
import { randomBytes } from "crypto";
import { sendMakeWebhook } from "../make-webhook";
import {
  ensureAgentTables, getSettings, setSetting, agentRateBp,
  decryptSecret, hashToken, baseUrl, logAgentEvent,
  onCustomerRefunded, onCustomerPaid, searchCustomersAndLeads,
  eurToCents, commissionCents,
} from "./fiaon-agent";

const router = Router();

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
             -- Testkonten müssen erkennbar sein: Wer eine Aufgabe zuweist, soll
             -- kein Testkonto in der Auswahl sehen.
             COALESCE(a.is_test_account, FALSE) AS is_test_account,
             COALESCE(a.rolle, 'agent') AS rolle,
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
    // ── ROLLE UND VERGÜTUNG KOMMEN MIT DER EINLADUNG (11.08.2026) ────────
    // Vorher wurde jeder als „agent" angelegt und musste danach von Hand
    // umgestellt werden — ein Schritt, den man vergisst. Dann sitzt jemand in
    // der falschen Rolle und sieht Daten, die ihn nichts angehen.
    const ROLLEN_ERLAUBT = ["agent", "vertriebsleiter", "onboarding", "inkasso"];
    const rolleNeu = ROLLEN_ERLAUBT.includes(String(req.body?.rolle))
      ? String(req.body.rolle) : "agent";
    const MODELLE_ERLAUBT = ["provision", "stunden", "fest", "fest_plus_provision"];
    const modell = MODELLE_ERLAUBT.includes(String(req.body?.verguetungsmodell))
      ? String(req.body.verguetungsmodell) : null;
    const ganzeCent = (v: unknown): number | null => {
      if (v == null || v === "") return null;
      const n = Math.round(Number(v));
      return Number.isFinite(n) && n >= 0 && n < 100_000_000 ? n : null;
    };
    const festgehalt = ganzeCent(req.body?.festgehaltCents);
    const stundensatz = ganzeCent(req.body?.stundensatzCents);
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
      INSERT INTO fiaon_agents (name, first_name, last_name, email, phone, commission_rate_bp, monthly_goal_cents, invite_token_hash, invite_expires_at, recruited_by, override_rate_bp,
                                rolle, verguetungsmodell, festgehalt_cents, startdatum, gehalt_ab)
      VALUES (${name}, ${String(firstName).trim()}, ${String(lastName).trim()}, ${String(email).trim().toLowerCase()},
              ${phone ? String(phone).trim() : null}, ${rateBp}, ${goal},
              ${hashToken(token)}, ${new Date(Date.now() + INVITE_TTL_MS)}, ${recruiter}, ${ovBp},
              ${rolleNeu}, ${modell}, ${festgehalt},
              ${req.body?.startdatum || null}, ${req.body?.startdatum || null})
      ON CONFLICT (email) DO NOTHING
      RETURNING id, name, email
    `;
    if (rows.length === 0) return res.status(409).json({ ok: false, error: "E-Mail bereits vergeben" });
    await logAgentEvent(rows[0].id, "invited", {
      by: "admin", recruited_by: recruiter, rolle: rolleNeu, modell, festgehalt_cents: festgehalt,
    });
    // Stundensatz liegt in einer eigenen Spalte, die es nicht überall gibt —
    // deshalb getrennt und fehlertolerant.
    if (stundensatz != null) {
      await sqlPool`UPDATE fiaon_agents SET stundensatz_cents = ${stundensatz} WHERE id = ${rows[0].id}`
        .catch(() => {});
    }
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

/**
 * Rolle setzen: 'agent', 'vertriebsleiter' oder 'onboarding'.
 *
 * Nur der Betreiber darf das — der Endpunkt haengt unter /admin und damit hinter
 * dem Zugangs-Gate. Ein Vertriebsleiter kann seine eigene Rolle NICHT aendern und
 * auch keine fremde: In /agent/vertrieb gibt es dafuer keinen Endpunkt.
 *
 * Damit erledigt sich die Bitte "ich will keine SQL-Befehle ausfuehren muessen":
 * Die Umschaltung sitzt in der Team-Uebersicht.
 */
router.post("/admin/agents/:id/rolle", async (req, res) => {
  try {
    await ensureAgentTables();
    await sqlPool`ALTER TABLE fiaon_agents ADD COLUMN IF NOT EXISTS rolle TEXT NOT NULL DEFAULT 'agent'`;
    const id = Number(req.params.id);
    const rolle = String(req.body?.rolle || "").trim();
    const ROLLEN = ["agent", "vertriebsleiter", "onboarding", "inkasso"];
    if (!ROLLEN.includes(rolle)) {
      return res.status(400).json({ ok: false, error: `Rolle muss eine von diesen sein: ${ROLLEN.join(", ")}` });
    }
    const [vorher] = await sqlPool`SELECT rolle, name, is_test_account, pruefkonto FROM fiaon_agents WHERE id = ${id}`;
    if (!vorher) return res.status(404).json({ ok: false, error: "Mitarbeiter nicht gefunden" });
    // Das PRÜFKONTO des Betreibers ist ausgenommen: Es soll jede Rolle
    // annehmen können, sonst lässt sich keine davon prüfen. Für Attrappen
    // bleibt die Sperre — ein Konto ohne Menschen dahinter mit Zugriff auf
    // alle Kundendaten wäre ein Datenleck mit Ansage.
    if (vorher.is_test_account && !vorher.pruefkonto && rolle !== "agent") {
      // Ein Testkonto mit Zugriff auf ALLE echten Kundendaten waere ein
      // Datenleck mit Ansage.
      return res.status(400).json({ ok: false, error: `Ein Testkonto kann keine erhöhte Rolle bekommen (${rolle}).` });
    }
    const rows = await sqlPool`
      UPDATE fiaon_agents SET rolle = ${rolle} WHERE id = ${id}
      RETURNING id, name, rolle
    `;
    // Rollenwechsel ist eine Rechtevergabe — sie gehoert protokolliert.
    await sqlPool`
      INSERT INTO fiaon_agent_events (agent_id, type, meta, actor)
      VALUES (${id}, 'rolle_geaendert',
              ${JSON.stringify({ alt: vorher.rolle, neu: rolle })}, 'admin')
    `.catch(() => {});
    console.log(`[FIAON-TEAM] Rolle von ${vorher.name}: ${vorher.rolle} → ${rolle}`);
    res.json({
      ok: true, agent: rows[0],
      meldung: rolle === "vertriebsleiter"
        ? `${vorher.name} sieht ab jetzt den Bereich „Vertrieb“: alle Kunden, zuweisen und korrigieren. Zahlungen buchen und Provisionen bleiben bei dir.`
        : rolle === "onboarding"
          ? `${vorher.name} führt ab jetzt die Startgespräche.`
          : rolle === "inkasso"
            // Der zweite Satz ist wichtig: Der Bereich öffnet sich erst nach
            // der Verpflichtungserklärung. Ohne diesen Hinweis wundert sich
            // der Betreiber, warum die Rolle „nicht wirkt".
            ? `${vorher.name} arbeitet ab jetzt im Forderungsmanagement und sieht ausschließlich `
              + `bezahlte Kunden mit laufender Ratenzahlung. Der Bereich öffnet sich, sobald die `
              + `Verpflichtungserklärung angenommen ist. Trag als Nächstes Stundensatz und Prämie ein — `
              + `ohne bestätigte Vergütung wird keine Prämie gebucht.`
            : `${vorher.name} ist wieder normaler Mitarbeiter und sieht nur die eigenen Kunden.`,
    });
  } catch (err) {
    console.error("[FIAON-TEAM] rolle:", err);
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
/**
 * GET /admin/agents/:id/loesch-vorschau — was passiert mit diesem Menschen?
 *
 * Dieselbe Einteilung wie bei Kunden (server/lib/fiaon-loeschen.ts):
 *
 *   ENDGÜLTIG      Wer nie eine Provision gebucht bekam und keine Auszahlung
 *                  hatte, hinterlässt keine Buchhaltungsspur. Er darf ganz weg.
 *   ANONYMISIERT   Wer Provisionen oder Auszahlungen hat, gehört in die
 *                  Buchhaltung — zehn Jahre, § 147 AO. Die PERSON verschwindet,
 *                  die BUCHUNG bleibt lesbar und dem Konto zugeordnet.
 *
 * Nicht der Klickende entscheidet, sondern der Zustand der Daten.
 */
router.get("/admin/agents/:id/loesch-vorschau", async (req, res) => {
  try {
    const id = Number(req.params.id);
    const [a] = await sqlPool`
      SELECT id, name, email, active, rolle,
             (SELECT COUNT(*)::int FROM fiaon_commissions c WHERE c.agent_id = a.id) AS provisionen,
             (SELECT COALESCE(SUM(c.amount_cents), 0)::bigint FROM fiaon_commissions c WHERE c.agent_id = a.id) AS provision_cents,
             (SELECT COUNT(*)::int FROM fiaon_payouts p WHERE p.agent_id = a.id) AS auszahlungen,
             (SELECT COUNT(*)::int FROM fiaon_persons p WHERE p.assigned_agent_id = a.id
               AND p.merged_into_person_id IS NULL) AS kunden,
             (SELECT COUNT(*)::int FROM fiaon_contact_log cl WHERE cl.agent_id = a.id) AS kontakte
      FROM fiaon_agents a WHERE a.id = ${id}
    `;
    if (!a) return res.status(404).json({ ok: false, error: "Mitarbeiter nicht gefunden" });

    const hatGeld = Number(a.provisionen) > 0 || Number(a.auszahlungen) > 0;
    const art = hatGeld ? "anonymisiert" : "endgueltig";
    const begruendung = hatGeld
      ? `${a.provisionen} Provisionszeilen (${(Number(a.provision_cents) / 100).toFixed(2).replace(".", ",")} €) `
        + `und ${a.auszahlungen} Auszahlungen — die Person wird anonymisiert, die Buchungen bleiben `
        + "aufbewahrungspflichtig lesbar (§ 147 AO, zehn Jahre)."
      : "Keine Provision, keine Auszahlung — darf vollständig verschwinden.";

    const hinweise: string[] = [begruendung];
    if (Number(a.kunden) > 0) {
      hinweise.push(`${a.kunden} Kunden hängen an diesem Konto. Sie werden freigegeben und `
        + "über die normale Verteilung neu zugeteilt — sie verschwinden nicht.");
    }
    if (Number(a.kontakte) > 0) {
      hinweise.push(`${a.kontakte} Verlaufseinträge bleiben in den Kundenakten stehen. `
        + "Der Name wird darin durch „Ehemaliger Mitarbeiter“ ersetzt — eine Akte ohne "
        + "Vorgeschichte wäre für den nächsten Betreuer wertlos.");
    }
    res.json({
      ok: true, name: a.name, art, begruendung, hinweise,
      bestaetigung: `${a.name} löschen`,
      kunden: Number(a.kunden), provisionen: Number(a.provisionen),
    });
  } catch (err) {
    console.error("[FIAON-TEAM] loesch-vorschau:", err);
    res.status(500).json({ ok: false, error: "Serverfehler" });
  }
});

/** POST /admin/agents/:id/loeschen — ausführen. */
router.post("/admin/agents/:id/loeschen", async (req, res) => {
  try {
    const id = Number(req.params.id);
    const bestaetigung = String(req.body?.bestaetigung || "").trim();
    const [a] = await sqlPool`
      SELECT id, name, email,
             (SELECT COUNT(*)::int FROM fiaon_commissions c WHERE c.agent_id = a.id) AS provisionen,
             (SELECT COUNT(*)::int FROM fiaon_payouts p WHERE p.agent_id = a.id) AS auszahlungen
      FROM fiaon_agents a WHERE a.id = ${id}
    `;
    if (!a) return res.status(404).json({ ok: false, error: "Mitarbeiter nicht gefunden" });
    if (bestaetigung !== `${a.name} löschen`) {
      return res.status(400).json({
        ok: false, error: `Bitte zur Bestätigung genau eintippen: „${a.name} löschen“`,
      });
    }

    const hatGeld = Number(a.provisionen) > 0 || Number(a.auszahlungen) > 0;

    const erg = await sqlPool.begin(async (tx) => {
      // Kunden ZUERST freigeben — in beiden Fällen. Ein Kunde, der an einem
      // gelöschten Konto hängt, taucht in keiner Liste mehr auf.
      const frei = (await tx`
        UPDATE fiaon_persons SET assigned_agent_id = NULL, updated_at = NOW()
        WHERE assigned_agent_id = ${id} RETURNING id
      `) as any[];

      // Das Protokoll VOR der Änderung — sonst fehlt es, wenn danach etwas
      // schiefgeht.
      await tx`
        INSERT INTO fiaon_agent_events (agent_id, type, meta, actor, reason)
        VALUES (${id}, ${hatGeld ? "geloescht_anonymisiert" : "geloescht_endgueltig"},
                ${JSON.stringify({ name: a.name, email: a.email, kundenFreigegeben: frei.length })},
                'Betreiber', ${String(req.body?.grund || "Ohne Angabe")})
      `;

      if (hatGeld) {
        // Der Name in den Kundenakten bleibt lesbar als Rolle, nicht als
        // Person: Eine Akte ohne Vorgeschichte ist für den Nachfolger wertlos.
        await tx`
          UPDATE fiaon_contact_log SET agent_name = 'Ehemaliger Mitarbeiter' WHERE agent_id = ${id}
        `;
        await tx`
          UPDATE fiaon_agents SET
            name = ${`Gelöscht #${id}`}, first_name = 'Gelöscht', last_name = ${`#${id}`},
            email = ${`geloescht-${id}@anonym.invalid`}, phone = NULL, avatar = NULL,
            bank_holder_enc = NULL, bank_iban_enc = NULL, bank_bic_enc = NULL, bank_iban_masked = NULL,
            password_hash = NULL, invite_token_hash = NULL,
            active = FALSE, distribution_active = FALSE, rolle = 'agent',
            -- Sitzungen entwerten: Ein gelöschtes Konto darf nicht weiter
            -- angemeldet bleiben, bis das Token abläuft.
            session_epoch = COALESCE(session_epoch, 0) + 1
          WHERE id = ${id}
        `;
        return { art: "anonymisiert", kunden: frei.length };
      }

      // Endgültig: von innen nach außen.
      await tx`DELETE FROM fiaon_onboarding_schritte WHERE agent_id = ${id}`;
      await tx`DELETE FROM fiaon_team_nachrichten WHERE agent_id = ${id}`;
      await tx`DELETE FROM fiaon_stunden WHERE agent_id = ${id}`;
      await tx`DELETE FROM fiaon_vertrieb_zusagen WHERE agent_id = ${id}`;
      await tx`UPDATE fiaon_contact_log SET agent_id = NULL, agent_name = 'Ehemaliger Mitarbeiter' WHERE agent_id = ${id}`;
      await tx`UPDATE fiaon_agents SET recruited_by = NULL WHERE recruited_by = ${id}`;
      await tx`DELETE FROM fiaon_agent_verfuegbarkeit WHERE agent_id = ${id}`;
      await tx`DELETE FROM fiaon_agents WHERE id = ${id}`;
      return { art: "endgueltig", kunden: frei.length };
    });

    console.log(`[FIAON-TEAM] ${a.name} (#${id}) ${erg.art}, ${erg.kunden} Kunden freigegeben`);
    res.json({
      ok: true, ...erg,
      meldung: erg.art === "endgueltig"
        ? `${a.name} vollständig entfernt.${erg.kunden ? ` ${erg.kunden} Kunden wurden freigegeben.` : ""}`
        : `${a.name} anonymisiert — die Provisionen bleiben für die Buchhaltung lesbar.`
          + `${erg.kunden ? ` ${erg.kunden} Kunden wurden freigegeben.` : ""}`,
    });
  } catch (err) {
    console.error("[FIAON-TEAM] loeschen:", err);
    res.status(500).json({ ok: false, error: "Serverfehler" });
  }
});

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
             -- Rolle und Testkonto-Merkmal MÜSSEN hier mitkommen: Die
             -- Team-Übersicht wird aus /admin/team/stats gespeist, nicht aus
             -- /admin/agents. Fehlten sie, zeigte die Rollen-Umschaltung nach
             -- dem Speichern weiterhin „Mitarbeiter" an — gespeichert war die
             -- Rolle längst, nur sah man es nirgends.
             COALESCE(a.rolle, 'agent') AS rolle,
             COALESCE(a.is_test_account, FALSE) AS is_test_account,
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
      defaults: {
        commissionRateBp: Number(settings.default_commission_rate_bp),
        payoutMaxRetainedCents: Number(settings.payout_max_retained_cents),
      },
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
             -- Die Detail-Schublade zeigt die Rollen-Umschaltung. Ohne diese
             -- beiden Felder stand dort immer „Mitarbeiter", egal was in der
             -- Datenbank stand: Gespeichert wurde korrekt, sichtbar war es nie.
             COALESCE(a.rolle, 'agent') AS rolle,
             COALESCE(a.is_test_account, FALSE) AS is_test_account,
             r.name AS recruited_by_name
      FROM fiaon_agents a
      LEFT JOIN fiaon_agents r ON r.id = a.recruited_by
      WHERE a.id = ${id}
    `;
    if (agents.length === 0) return res.status(404).json({ ok: false, error: "Agent nicht gefunden" });
    // Nachweis der Verpflichtungserklärung. Er gehört sichtbar dorthin, wo die
    // Rolle vergeben wird — ein Nachweis, den nur die Datenbank kennt, ist im
    // Ernstfall keiner: Niemand sucht ihn dort, und niemand merkt, wenn er fehlt.
    const zusagen = await sqlPool`
      SELECT version, name_getippt, accepted_at, ip
      FROM fiaon_vertrieb_zusagen WHERE agent_id = ${id}
      ORDER BY id DESC LIMIT 5
    `.catch(() => [] as any[]);
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
    res.json({ ok: true, agent: agents[0], vertriebZusagen: zusagen, contactLog, events, commissions, customers });
  } catch (err) {
    console.error("[FIAON-TEAM] agent detail:", err);
    res.status(500).json({ ok: false, error: "Serverfehler" });
  }
});

/**
 * Paket DB: Manuelle Provisions-Buchung (Korrektur/Nachtrag) — positiv ODER negativ.
 * Anwendungsfall: Zahlung lief über eine unzugewiesene Dublette (Kontoabgleich
 * bucht bewusst KEINE Provision) → Admin trägt die Provision bewusst nach.
 * Pflicht-Begründung, Audit-Eintrag, kind='manuell' — fließt ins normale
 * Guthaben (Status 'bestaetigt'), KEINE automatische Auszahlung.
 */
router.post("/admin/agents/:id/commissions/manual", async (req, res) => {
  try {
    await ensureAgentTables();
    const id = Number(req.params.id);
    const amountCents = Math.round(Number(req.body?.amountCents));
    const reason = String(req.body?.reason || "").trim().slice(0, 500);
    const refRaw = String(req.body?.ref || "").trim();
    if (isNaN(amountCents) || amountCents === 0 || Math.abs(amountCents) > 1_000_000) {
      return res.status(400).json({ ok: false, error: "Betrag ungültig (±0,01 € bis ±10.000,00 €, nicht 0)" });
    }
    if (!reason) return res.status(400).json({ ok: false, error: "Begründung ist Pflicht" });
    const agents = await sqlPool`SELECT id, name FROM fiaon_agents WHERE id = ${id}`;
    if (agents.length === 0) return res.status(404).json({ ok: false, error: "Agent nicht gefunden" });
    // Optionaler Kundenbezug: ref validieren + Paketname übernehmen
    let ref = `MANUELL-${Date.now().toString(36).toUpperCase()}`;
    let packName: string | null = "Manuelle Provisions-Buchung";
    if (refRaw) {
      const apps = await sqlPool`SELECT ref, pack_name, payment_reference FROM fiaon_applications WHERE ref = ${refRaw} OR payment_reference = ${refRaw} LIMIT 1`;
      if (apps.length === 0) return res.status(404).json({ ok: false, error: `Kunde '${refRaw}' nicht gefunden — Feld leer lassen für Buchung ohne Kundenbezug` });
      ref = apps[0].ref;
      packName = apps[0].pack_name || packName;
    }
    const rows = await sqlPool`
      INSERT INTO fiaon_commissions (agent_id, ref, pack_name, base_amount_cents, rate_bp, amount_cents, status, kind, note)
      VALUES (${id}, ${ref}, ${packName}, ${Math.abs(amountCents)}, 0, ${amountCents}, 'bestaetigt', 'manuell',
              ${`Manuelle Buchung durch Admin: ${reason}`})
      RETURNING id
    `;
    await logAgentEvent(id, "commission_manual", { commission_id: rows[0].id, ref, amount_cents: amountCents, reason });
    if (refRaw) {
      await sqlPool`
        INSERT INTO fiaon_contact_log (ref, agent_id, agent_name, type, note)
        VALUES (${ref}, NULL, 'Admin', 'system',
                ${`Provision manuell gebucht für ${agents[0].name}: ${(amountCents / 100).toFixed(2)} € — ${reason}`})
      `;
    }
    console.log(`[FIAON-TEAM] Manuelle Provision #${rows[0].id}: ${(amountCents / 100).toFixed(2)} € → Agent ${id} (${reason})`);
    res.json({ ok: true, commissionId: rows[0].id });
  } catch (err) {
    console.error("[FIAON-TEAM] manual commission:", err);
    res.status(500).json({ ok: false, error: "Serverfehler" });
  }
});

// ═══════════════ PAKET EB — Provisions-Nachbuchung (Nachbuchungs-Center) ═══════════════
//
// Kontext: Zahlungen über den Kontoabgleich (applyTxn) setzen bewusst KEINE
// Provision (dokumentierte Entscheidung). Dadurch existieren bezahlte, einem
// Agent zugewiesene Bestellungen OHNE Provisionseintrag. Dieses Center findet
// sie AUTOMATISCH (kein hartcodiertes Ref-Array) und bucht die reguläre Provision
// über den bestehenden Abschluss-Hook onCustomerPaid — idempotent, mit Audit.
//
// Betrag: bezahlte Bestellung → sonst Donor (superseded Schwester, gleiche
// E-Mail) → sonst zugehöriger Bankeingang (fiaon_bank_txns.matched_ref). Bei
// NULL-Betrag wird die Bestellung als „Betrag unklar" markiert und ist NICHT
// sammelbuchbar — nur einzeln mit manueller Betragseingabe.

/** Findet alle bezahlten Bestellungen ohne positive Provision + belastbaren
 *  Betrag inkl. Quellenangabe. P2-B: auch FÄLLE OHNE zugewiesenen Agent —
 *  mit Vorschlag aus der dokumentierten Betreuung (letzter Agenten-Kontakt).
 *  Entscheidung trifft IMMER der Betreiber, nichts wird automatisch gebucht.
 *  Nur SELECT (kein Schreibzugriff). */
async function backfillCandidates(): Promise<any[]> {
  await ensureAgentTables();
  const rows = await sqlPool`
    SELECT
      a.ref, a.payment_reference, a.pack_name, a.assigned_agent_id,
      COALESCE(NULLIF(TRIM(CONCAT_WS(' ', a.first_name, a.last_name)), ''), a.company_name, a.contact_name, a.email) AS customer_name,
      COALESCE(NULLIF(a.email,''), NULLIF(a.contact_email,''), NULLIF(a.billing_email,'')) AS email,
      COALESCE(a.completed_at, a.claimed_paid_at, a.updated_at) AS paid_at,
      a.commission_basis,
      suggested.agent_id AS suggested_agent_id, suggested.agent_name AS suggested_agent_name,
      ag.name AS agent_name, ag.commission_rate_bp AS agent_rate_bp,
      -- belastbarer Betrag (Cents) + Quelle
      CASE
        WHEN a.amount_due IS NOT NULL THEN ROUND(a.amount_due::numeric * 100)
        WHEN donor.amount_due IS NOT NULL THEN ROUND(donor.amount_due::numeric * 100)
        WHEN bank.amount_cents IS NOT NULL THEN bank.amount_cents
        ELSE NULL
      END AS amount_cents,
      CASE
        WHEN a.amount_due IS NOT NULL THEN 'order'
        WHEN donor.amount_due IS NOT NULL THEN 'donor'
        WHEN bank.amount_cents IS NOT NULL THEN 'bank'
        ELSE 'none'
      END AS amount_source,
      donor.ref AS donor_ref
    FROM fiaon_applications a
    LEFT JOIN fiaon_agents ag ON ag.id = a.assigned_agent_id
    LEFT JOIN LATERAL (
      SELECT s.ref, s.amount_due
      FROM fiaon_applications s
      WHERE s.payment_status = 'superseded' AND s.amount_due IS NOT NULL
        AND s.email IS NOT NULL AND LOWER(TRIM(s.email)) = LOWER(TRIM(a.email))
      ORDER BY s.updated_at DESC LIMIT 1
    ) donor ON TRUE
    LEFT JOIN LATERAL (
      SELECT t.amount_cents FROM fiaon_bank_txns t
      WHERE t.matched_ref = a.ref AND t.applied = TRUE
      ORDER BY t.booked_at DESC NULLS LAST, t.id DESC LIMIT 1
    ) bank ON TRUE
    LEFT JOIN LATERAL (
      -- P2-B: Betreuungs-Vorschlag = letzter dokumentierter Agenten-Kontakt
      -- (Kunden-Log + Lead-Log; Notizen/Akte-Öffnen zählen nicht)
      SELECT x.agent_id, x.agent_name FROM (
        SELECT c.agent_id, c.agent_name, c.created_at
        FROM fiaon_contact_log c
        WHERE c.ref = a.ref AND c.agent_id IS NOT NULL AND c.voided_at IS NULL
          AND c.type IN ('result', 'email_sent')
        UNION ALL
        SELECT g.agent_id, g.agent_name, g.created_at
        FROM fiaon_lead_log g JOIN fiaon_leads l ON l.id = g.lead_id
        WHERE l.converted_order_id = a.ref AND g.agent_id IS NOT NULL
          AND g.type IN ('result', 'email_sent')
      ) x ORDER BY x.created_at DESC LIMIT 1
    ) suggested ON TRUE
    WHERE a.payment_status = 'paid'
      AND a.merged_into IS NULL
      AND (a.assigned_agent_id IS NOT NULL OR suggested.agent_id IS NOT NULL)
      AND COALESCE(a.commission_basis, '') <> 'direktzahler'
      AND NOT EXISTS (
        SELECT 1 FROM fiaon_commissions c
        WHERE c.ref = a.ref AND c.amount_cents > 0 AND c.status != 'storniert'
      )
    ORDER BY paid_at DESC NULLS LAST
  `;
  const settings = await getSettings();
  return rows.map((r: any) => {
    const rateBp = agentRateBp({ commission_rate_bp: r.agent_rate_bp }, settings);
    const amountCents = r.amount_cents != null ? Number(r.amount_cents) : null;
    const estimateCents = amountCents != null ? commissionCents(amountCents, rateBp) : null;
    // P2-B: Fall ohne zugewiesenen Agent → Vorschlag aus dokumentierter Betreuung.
    const agentId = r.assigned_agent_id ?? r.suggested_agent_id ?? null;
    const agentName = r.agent_name ?? (r.suggested_agent_name ? `${r.suggested_agent_name} (Vorschlag aus Betreuung)` : null);
    return {
      ref: r.ref,
      payment_reference: r.payment_reference,
      pack_name: r.pack_name,
      customer_name: r.customer_name,
      email: r.email,
      paid_at: r.paid_at,
      agent_id: agentId,
      agent_name: agentName,
      agent_suggested: r.assigned_agent_id == null && r.suggested_agent_id != null,
      rate_bp: rateBp,
      amount_cents: amountCents,
      amount_source: r.amount_source,
      donor_ref: r.donor_ref,
      estimated_commission_cents: estimateCents,
      status: amountCents != null && amountCents > 0 ? "nachbuchbar" : "betrag_unklar",
    };
  });
}

/** Liste der nachbuchbaren Fälle (Auto-Erkennung). */
router.get("/admin/commission-backfill/candidates", async (_req, res) => {
  try {
    const candidates = await backfillCandidates();
    const bookable = candidates.filter((c) => c.status === "nachbuchbar");
    res.json({
      ok: true,
      candidates,
      summary: {
        total: candidates.length,
        bookable: bookable.length,
        unclear: candidates.length - bookable.length,
        bookableCommissionCents: bookable.reduce((s, c) => s + (c.estimated_commission_cents || 0), 0),
      },
    });
  } catch (err) {
    console.error("[FIAON-BACKFILL] candidates:", err);
    res.status(500).json({ ok: false, error: "Serverfehler" });
  }
});

/** Reine Zahl für die Dashboard-Warnkachel (Selbstcheck). */
router.get("/admin/commission-backfill/count", async (_req, res) => {
  try {
    const [row] = await sqlPool`
      SELECT COUNT(*)::int AS c
      FROM fiaon_applications a
      WHERE a.payment_status = 'paid' AND a.merged_into IS NULL AND a.assigned_agent_id IS NOT NULL
        AND NOT EXISTS (
          SELECT 1 FROM fiaon_commissions c
          WHERE c.ref = a.ref AND c.amount_cents > 0 AND c.status != 'storniert'
        )
    `;
    res.json({ ok: true, count: Number(row.c) });
  } catch (err) {
    console.error("[FIAON-BACKFILL] count:", err);
    res.status(500).json({ ok: false, error: "Serverfehler" });
  }
});

/** Bucht die Provision für EINE Bestellung über onCustomerPaid (idempotent).
 *  Fehlt der Betrag, kann er einmalig manuell gesetzt werden (manualAmountCents),
 *  sonst wird die belastbare Quelle (Donor/Bank) automatisch ergänzt. Jede
 *  Betrags-Ergänzung + Buchung wird im Kontakt-Log protokolliert (Audit). */
async function bookRef(ref: string, manualAmountCents?: number, agentIdOverride?: number): Promise<{ ok: boolean; error?: string; alreadyBooked?: boolean; amountCents?: number; source?: string }> {
  // Bereits gebucht? → idempotent, nichts tun.
  const existing = await sqlPool`
    SELECT id FROM fiaon_commissions WHERE ref = ${ref} AND amount_cents > 0 AND status != 'storniert'
  `;
  if (existing.length > 0) return { ok: true, alreadyBooked: true };

  const apps = await sqlPool`
    SELECT ref, amount_due, assigned_agent_id, email
    FROM fiaon_applications
    WHERE ref = ${ref} AND payment_status = 'paid' AND merged_into IS NULL
  `;
  if (apps.length === 0) return { ok: false, error: "Bezahlte Bestellung nicht gefunden" };
  const app = apps[0];
  // P2-B: Fall ohne Agent → Admin-Entscheid mit explizitem Agent (Vorschlag aus
  // Betreuung); die Zuweisung wird dabei gesetzt und im Audit protokolliert.
  if (!app.assigned_agent_id && agentIdOverride) {
    await sqlPool`
      UPDATE fiaon_applications SET assigned_agent_id = ${agentIdOverride}, updated_at = NOW()
      WHERE ref = ${ref} AND assigned_agent_id IS NULL
    `;
    await sqlPool`
      INSERT INTO fiaon_contact_log (ref, agent_id, agent_name, type, note)
      VALUES (${ref}, NULL, 'Admin', 'system',
              ${`Agent #${agentIdOverride} per Admin-Entscheid zugewiesen (Nachbuchungs-Center, Vorschlag aus dokumentierter Betreuung)`})
    `;
    app.assigned_agent_id = agentIdOverride;
  }
  if (!app.assigned_agent_id) return { ok: false, error: "Bestellung ist keinem Agent zugewiesen — zuerst Zuordnung reparieren" };

  // Betrag sicherstellen: vorhanden? sonst manuell? sonst Donor/Bank.
  let amountCents = eurToCents(app.amount_due);
  let source = "order";
  if (amountCents <= 0) {
    if (manualAmountCents && manualAmountCents > 0) {
      amountCents = Math.round(manualAmountCents);
      source = "manuell";
    } else {
      const [donor] = await sqlPool`
        SELECT amount_due FROM fiaon_applications
        WHERE payment_status = 'superseded' AND amount_due IS NOT NULL
          AND email IS NOT NULL AND LOWER(TRIM(email)) = LOWER(TRIM(${app.email}))
        ORDER BY updated_at DESC LIMIT 1
      `;
      if (donor?.amount_due != null) { amountCents = eurToCents(donor.amount_due); source = "donor"; }
      else {
        const [bank] = await sqlPool`
          SELECT amount_cents FROM fiaon_bank_txns
          WHERE matched_ref = ${ref} AND applied = TRUE
          ORDER BY booked_at DESC NULLS LAST, id DESC LIMIT 1
        `;
        if (bank?.amount_cents != null) { amountCents = Number(bank.amount_cents); source = "bank"; }
      }
    }
    if (amountCents <= 0) return { ok: false, error: "Betrag unklar — bitte manuell eingeben" };
    // Betrag am Antrag ergänzen (Buchhaltungs-Spur), damit onCustomerPaid + Anzeige stimmen.
    await sqlPool`UPDATE fiaon_applications SET amount_due = ${(amountCents / 100).toFixed(2)}::numeric, updated_at = NOW() WHERE ref = ${ref} AND amount_due IS NULL`;
    const srcLabel = source === "manuell" ? "manueller Eingabe" : source === "donor" ? "Dubletten-Bestellung" : "Bankeingang";
    await sqlPool`
      INSERT INTO fiaon_contact_log (ref, agent_id, agent_name, type, note)
      VALUES (${ref}, NULL, 'Admin', 'system',
              ${`Betrag ergänzt aus ${srcLabel}: ${(amountCents / 100).toFixed(2)} € (Nachbuchung Dubletten-Bug)`})
    `;
  }

  // Reguläre Provision über den bestehenden Hook (eingefrorener Satz + Override + Meilenstein).
  // P2-B: Nachbuchung = dokumentierte ADMIN-ENTSCHEIDUNG — übersteuert die
  // Betreuungs-Prüfung bewusst (forceAgentId), z. B. für Altfälle vor Stichtag.
  await onCustomerPaid(ref, { forceAgentId: Number(app.assigned_agent_id), forceReason: "Admin-Entscheidung im Nachbuchungs-Center" });
  // Verifizieren, dass genau ein positiver Eintrag entstand.
  const after = await sqlPool`SELECT id FROM fiaon_commissions WHERE ref = ${ref} AND amount_cents > 0 AND status != 'storniert'`;
  if (after.length === 0) return { ok: false, error: "Provision konnte nicht gebucht werden (Satz/Betrag = 0?)" };
  await sqlPool`
    INSERT INTO fiaon_contact_log (ref, agent_id, agent_name, type, note)
    VALUES (${ref}, NULL, 'Admin', 'system',
            ${`Provision nachgebucht (Nachbuchung Dubletten-Bug) — Betragsquelle: ${source}`})
  `;
  return { ok: true, amountCents, source };
}

router.post("/admin/commission-backfill/:ref/book", async (req, res) => {
  try {
    await ensureAgentTables();
    const manual = req.body?.manualAmountCents != null ? Math.round(Number(req.body.manualAmountCents)) : undefined;
    if (manual != null && (!Number.isFinite(manual) || manual <= 0 || manual > 5_000_000)) {
      return res.status(400).json({ ok: false, error: "Betrag ungültig (0,01 € bis 50.000,00 €)" });
    }
    const agentOverride = req.body?.agentId != null ? Number(req.body.agentId) : undefined;
    const result = await bookRef(String(req.params.ref), manual, agentOverride);
    if (!result.ok) return res.status(400).json(result);
    console.log(`[FIAON-BACKFILL] gebucht: ${req.params.ref}${result.alreadyBooked ? " (bereits vorhanden)" : ` (${result.source})`}`);
    res.json(result);
  } catch (err) {
    console.error("[FIAON-BACKFILL] book:", err);
    res.status(500).json({ ok: false, error: "Serverfehler" });
  }
});

/** Bucht alle EINDEUTIGEN Fälle (Betrag bekannt). „Betrag unklar" wird bewusst
 *  übersprungen — diese nur einzeln mit manueller Eingabe. */
router.post("/admin/commission-backfill/book-all", async (_req, res) => {
  try {
    const candidates = await backfillCandidates();
    const bookable = candidates.filter((c) => c.status === "nachbuchbar");
    let booked = 0, skipped = 0, failed = 0;
    const results: any[] = [];
    for (const c of bookable) {
      // Sammelbuchung bucht NUR bereits zugewiesene Fälle — Vorschläge (agent_suggested)
      // brauchen die bewusste Einzel-Entscheidung des Betreibers.
      if (c.agent_suggested) { skipped++; continue; }
      const r = await bookRef(c.ref);
      if (r.ok && !r.alreadyBooked) { booked++; results.push({ ref: c.ref, ok: true, amountCents: r.amountCents, source: r.source }); }
      else if (r.ok && r.alreadyBooked) { skipped++; }
      else { failed++; results.push({ ref: c.ref, ok: false, error: r.error }); }
    }
    console.log(`[FIAON-BACKFILL] Sammelbuchung: ${booked} gebucht, ${skipped} bereits vorhanden, ${failed} fehlgeschlagen`);
    res.json({ ok: true, booked, skipped, failed, unclear: candidates.length - bookable.length, results });
  } catch (err) {
    console.error("[FIAON-BACKFILL] book-all:", err);
    res.status(500).json({ ok: false, error: "Serverfehler" });
  }
});

/**
 * Paket DC: Globale Admin-Suche über Kunden UND Leads — serverseitig, indexierbar.
 * Telefon normalisiert (+49/0049/0/Formatierung egal), Namen tokenisiert
 * (Reihenfolge egal), E-Mail/Referenz-Teilstrings. Gleiche Engine wie /agent/search.
 */
router.get("/admin/customer-search", async (req, res) => {
  try {
    const q = String(req.query.q || "").trim();
    if (q.length < 2) return res.json({ ok: true, customers: [], leads: [], mode: "leer" });
    const result = await searchCustomersAndLeads(q, { agentId: null, limit: Number(req.query.limit) || 30 });
    res.json({ ok: true, ...result });
  } catch (err) {
    console.error("[FIAON-TEAM] customer-search:", err);
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
        payoutMaxRetainedCents: Number(settings.payout_max_retained_cents),
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
    const { defaultCommissionRateBp, payoutMinCents, payoutMaxRetainedCents, scriptStatusMap,
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
    // Obergrenze Guthaben (Maximum Retained Balance) — reine Timing-Regel: darüber
    // zahlt FIAON den Überschuss aus, kein Anspruchseinbehalt. Muss ≥ Mindestbetrag sein.
    if (payoutMaxRetainedCents != null) {
      const v = Math.round(Number(payoutMaxRetainedCents));
      if (isNaN(v) || v <= 0) return res.status(400).json({ ok: false, error: "Obergrenze ungültig" });
      const curMin = Number((await getSettings()).payout_min_cents);
      if (Number.isFinite(curMin) && v < curMin) return res.status(400).json({ ok: false, error: "Obergrenze darf nicht unter dem Mindestbetrag liegen" });
      await setSetting("payout_max_retained_cents", String(v));
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
    // Prompt 2 E: automatische Provisions-Abrechnung (Gutschrift-PDF) — zieht
    // ausschließlich die Werte der Commission-Engine + dieses Auszahlungssatzes.
    const { generateCommissionStatement } = await import("./fiaon-onboarding");
    generateCommissionStatement(id).catch((e) => console.error("[FIAON-TEAM] statement gen:", e));
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

// ═══════════════════════════════════════════════════════════════════════════
// WIRTSCHAFTLICHKEIT — nur für den Betreiber
//
// Diese Routen liegen unter /admin/, und /admin/ ist durch den Zugangscode
// geschützt (siehe server/routes.ts: adminGate). Die Vertriebsleitung kommt
// über /agent/ herein und erreicht sie nicht.
//
// Zusätzlich gilt: Das FESTGEHALT taucht in KEINER anderen Antwort auf. Wer
// die Mitarbeiterliste über /agent/ abruft, bekommt die Spalte nicht — auch
// nicht als null. Was nicht mitgeliefert wird, kann nicht durchsickern.
// ═══════════════════════════════════════════════════════════════════════════

/** GET /admin/team/wirtschaftlichkeit/:id */
router.get("/admin/team/wirtschaftlichkeit/:id", async (req: Request, res: Response) => {
  try {
    const { wirtschaftlichkeit } = await import("../lib/fiaon-wirtschaftlichkeit");
    res.json({ ok: true, ...(await wirtschaftlichkeit(Number(req.params.id))) });
  } catch (err) {
    console.error("[TEAM] wirtschaftlichkeit:", err);
    res.status(500).json({ ok: false, error: "Serverfehler" });
  }
});

/** GET /admin/team/wirtschaftlichkeit — die Summenzeile im Kopf. */
router.get("/admin/team/wirtschaftlichkeit", async (_req: Request, res: Response) => {
  try {
    const { teamWirtschaftlichkeit } = await import("../lib/fiaon-wirtschaftlichkeit");
    res.json({ ok: true, ...(await teamWirtschaftlichkeit()) });
  } catch (err) {
    console.error("[TEAM] team-wirtschaftlichkeit:", err);
    res.status(500).json({ ok: false, error: "Serverfehler" });
  }
});

/** PUT /admin/team/agents/:id/verguetung — Festgehalt, Modell, Ziel. */
router.put("/admin/team/agents/:id/verguetung", async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id);
    const cents = (v: unknown): number | null => {
      if (v === "" || v == null) return null;
      const n = Math.round(Number(String(v).replace(",", ".")) * 100);
      return Number.isFinite(n) && n >= 0 ? n : null;
    };
    const modell = String(req.body?.modell || "");
    const ERLAUBT = ["provision", "stunden", "fest", "fest_plus_provision"];
    if (modell && !ERLAUBT.includes(modell)) {
      return res.status(400).json({ ok: false, error: "Unbekanntes Vergütungsmodell." });
    }
    const [alt] = (await sqlPool`
      SELECT festgehalt_cents, name FROM fiaon_agents WHERE id = ${id}
    `) as any[];
    if (!alt) return res.status(404).json({ ok: false, error: "Mitarbeiter nicht gefunden." });

    const neu = cents(req.body?.festgehalt);
    await sqlPool`
      UPDATE fiaon_agents SET
        festgehalt_cents = ${neu},
        gehalt_ab = ${req.body?.gehaltAb || null},
        monatsziel_cents = ${cents(req.body?.monatsziel)},
        verguetungsmodell = ${modell || null},
        startdatum = ${req.body?.startdatum || null}
      WHERE id = ${id}
    `;
    // Eine Gehaltsänderung ist eine Vertragsänderung. Sie gehört protokolliert
    // — mit den Beträgen, damit später niemand raten muss.
    await sqlPool`
      INSERT INTO fiaon_agent_events (agent_id, type, meta, actor)
      VALUES (${id}, 'verguetung_geaendert',
              ${JSON.stringify({ alt: alt.festgehalt_cents, neu, modell })}, 'admin')
    `.catch(() => {});
    console.log(`[TEAM] Vergütung ${alt.name}: ${alt.festgehalt_cents ?? "—"} → ${neu ?? "—"} Cent (${modell || "unverändert"})`);
    res.json({ ok: true });
  } catch (err) {
    console.error("[TEAM] verguetung:", err);
    res.status(500).json({ ok: false, error: "Serverfehler" });
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// ALS-MITARBEITER-ANSICHT
//
// Nur unter /admin/ erreichbar — die Vertriebsleitung kommt über /agent/
// herein und sieht diese Routen nie. Sie führt Menschen, sie überwacht sie
// nicht.
// ═══════════════════════════════════════════════════════════════════════════

/** POST /admin/team/ansicht/:id — Ansicht starten. */
router.post("/admin/team/ansicht/:id", async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id);
    const [a] = (await sqlPool`
      SELECT id, COALESCE(NULLIF(first_name, ''), name) AS vorname, name, active
      FROM fiaon_agents WHERE id = ${id}
    `) as any[];
    if (!a) return res.status(404).json({ ok: false, error: "Mitarbeiter nicht gefunden." });
    if (!a.active) {
      return res.status(400).json({
        ok: false,
        error: "Das Konto ist deaktiviert. Eine Ansicht darauf zeigte eine Anmeldeseite, sonst nichts.",
      });
    }
    const { ansichtTokenBauen, ANSICHT_COOKIE, ANSICHT_MINUTEN, ansichtProtokoll } =
      await import("../lib/fiaon-ansicht");
    res.cookie(ANSICHT_COOKIE, ansichtTokenBauen(id), {
      httpOnly: true, sameSite: "lax", path: "/",
      secure: process.env.NODE_ENV === "production",
      maxAge: ANSICHT_MINUTEN * 60_000,
    });
    await ansichtProtokoll(id, "gestartet");
    res.json({
      ok: true, vorname: a.vorname, name: a.name, minuten: ANSICHT_MINUTEN,
      ziel: "/agent/start",
    });
  } catch (err) {
    console.error("[TEAM] ansicht start:", err);
    res.status(500).json({ ok: false, error: "Serverfehler" });
  }
});

export default router;
