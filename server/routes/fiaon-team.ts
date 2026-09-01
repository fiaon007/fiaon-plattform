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
import {
  echteMitarbeiterSql, nurTestkontenSql, testkontenZaehlen, istTestkontoSql,
} from "../lib/fiaon-mitarbeiter-sicht";
import { katalogpreisCents } from "../lib/fiaon-massgebliche-bestellung";
import { BELEGT_GEFUEHRT_SQL, NUMMER_PASST_SQL } from "../lib/fiaon-anruf-pruefung";
import { abrechnungZustand } from "./fiaon-abrechnungen";

const router = Router();

const INVITE_TTL_MS = 48 * 60 * 60 * 1000;

// ═══════════════ AGENTS: Verwaltung + Onboarding (F1) ═══════════════

router.get("/admin/agents", async (_req, res) => {
  // Die Grenze wird VOR der Abfrage entschieden, nicht mitten im
  // Template-Literal: Ein mehrzeiliger Ausdruck dort ist schwer zu lesen und
  // war schon zweimal die Ursache eines Syntaxfehlers.
  const nurTest = String(_req.query?.test ?? "") === "1";
  const kontenGrenze = nurTest ? nurTestkontenSql() : echteMitarbeiterSql();
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
      -- ══════════════════════════════════════════════════════════════════
      -- TESTKONTEN GEHÖREN NICHT INS TEAM-BILD
      --
      -- GEMESSEN am 17.08.2026: 49 Mitarbeiter-Konten, davon 43 Testkonten
      -- aus Prüfständen und Knopf-Durchgängen — und 6 echte Menschen. Der
      -- Betreiber sah 11 Karten und musste seine Leute suchen.
      --
      -- Die Grenze steht in der WHERE-Bedingung, nicht in der Oberfläche:
      -- Sonst holt die Abfrage die Zeilen, die Anzeige wirft sie weg, und
      -- jede Kennzahl hat schon mitgezählt.
      --
      -- „?test=1“ zeigt sie ausdrücklich — sie sind nicht verboten, nur
      -- nicht im Weg.
      -- ══════════════════════════════════════════════════════════════════
      WHERE ${sqlPool.unsafe(kontenGrenze)}
      ORDER BY a.created_at ASC
    `;
    // ══════════════════════════════════════════════════════════════════════
    // DER TELEFONIE-NACHWEIS JE MITARBEITER (31.08.2026)
    //
    // ── WOZU ──────────────────────────────────────────────────────────────
    // Gemeldet war „von 158 Anrufen kamen 2 durch". Die 7-Tage-Messung ergab
    // 55 bis 64 Prozent Annahmequote — die Meldung bestätigte sich NICHT. Sie
    // ergab aber etwas anderes: Bei Nikita liegen 49 von 123 angenommenen
    // Gesprächen unter fünf Sekunden (40 %), bei Daniel 14 von 24 (58 %), bei
    // Lucas 17 von 357 (5 %).
    //
    // Zwei Erklärungen passen auf dieselbe Zahl: ein stummes Mikrofon oder ein
    // Gesprächseinstieg, bei dem Menschen auflegen. Die Stumm-Marke
    // (`transkript_grund LIKE '%stumm_verdacht%'`) läuft seit dem 31.08.2026 —
    // in drei Tagen ist die Frage entschieden.
    //
    // ── WARUM HIER UND NICHT IN EINEM SKRIPT ──────────────────────────────
    // Ein Skript, das ein Mensch aufrufen muss, wird beim zweiten Mal
    // vergessen. Diese Zeile steht dort, wo die Leitung ihre Leute ohnehin
    // ansieht.
    const telefonie = (await sqlPool`
      SELECT c.agent_id,
             COUNT(*)::int AS versuche,
             COUNT(*) FILTER (WHERE c.status = 'beendet')::int AS angenommen,
             COUNT(*) FILTER (WHERE c.status = 'beendet'
                                AND COALESCE(c.dauer_sek, 0) BETWEEN 1 AND 4)::int AS unter_5s,
             COUNT(*) FILTER (WHERE c.transkript_grund LIKE '%stumm_verdacht%')::int AS stumm,
             ROUND(AVG(c.dauer_sek) FILTER (WHERE c.status = 'beendet'
                                              AND c.dauer_sek > 0))::int AS schnitt_sek
      FROM fiaon_calls c
      WHERE c.beginn > NOW() - INTERVAL '7 days' AND c.richtung = 'raus'
      GROUP BY c.agent_id
    `) as any[];
    const telefonieJeAgent: Record<string, any> = {};
    for (const t of telefonie) {
      const versuche = Number(t.versuche);
      const angenommen = Number(t.angenommen);
      telefonieJeAgent[String(t.agent_id)] = {
        versuche,
        angenommen,
        annahmeQuote: versuche > 0 ? Math.round((angenommen / versuche) * 100) : 0,
        unter5s: Number(t.unter_5s),
        // Die Quote der Kurzgespräche bezieht sich auf die ANGENOMMENEN, nicht
        // auf die Versuche: Ein nicht angenommener Anruf kann nicht kurz sein.
        unter5sQuote: angenommen > 0 ? Math.round((Number(t.unter_5s) / angenommen) * 100) : 0,
        stumm: Number(t.stumm),
        schnittSek: Number(t.schnitt_sek ?? 0),
      };
    }

    res.json({
      ok: true,
      data: agents,
      telefonie: telefonieJeAgent,
      // Ohne diesen Satz liest jemand „0 stumm" als „alles gut", obwohl es
      // „wir zählen erst seit heute" heißt.
      telefonieHinweis: "Die Stumm-Marke wird seit dem 31.08.2026 geschrieben. Eine 0 "
        + "heißt hier „noch nicht gemessen“, nicht „kein stummer Anruf“. "
        + "Kurzgespräche unter 5 s sind ein Hinweis, kein Beweis: Wer abhebt und "
        + "sofort auflegt, sieht in den Daten genauso aus wie einer, der nichts hört.",
      // Damit die Zentrale einen Filter mit Zähler zeichnen kann.
      testkonten: await testkontenZaehlen(),
      nurTest,
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
 * Nur der Vorgesetzte darf das — der Endpunkt haengt unter /admin und damit hinter
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
    // Das PRÜFKONTO des Vorgesetzten ist ausgenommen: Es soll jede Rolle
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
            // der Vorgesetzte, warum die Rolle „nicht wirkt".
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
                'Vorgesetzter', ${String(req.body?.grund || "Ohne Angabe")})
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

// ═══════════════════════════════════════════════════════════════════════════
// TESTKONTO-MARKE SETZEN ODER AUFHEBEN
//
// ── DER BEFUND (30.08.2026) ────────────────────────────────────────────────
// Beim Aufräumen nach einem Prüfstandslauf fiel auf: `Justin Schwarzott` trägt
// ZWEIMAL die Marke `is_test_account` (Agent 2 und 7) — beides echte Konten des
// Betreibers, angelegt am 04.07.2026.
//
// Die Folge ist nicht harmlos: JEDE Team-Ansicht filtert über
// `echteMitarbeiterSql()`. Diese beiden Konten fallen also aus der
// Team-Zentrale, aus den Kennzahlen und aus der Verteilung heraus — sie
// existieren, aber sie kommen nirgends vor.
//
// ── WARUM EIN SCHALTER UND KEIN SKRIPT ────────────────────────────────────
// Ein Skript hätte die zwei Zeilen in einer Minute korrigiert. Aber die Marke
// wird weiter gesetzt — von jedem Prüfstand, der ein Konto stilllegt — und
// irgendwann trifft es wieder ein echtes Konto. Ein Skript, das ein Mensch
// aufrufen muss, wird beim zweiten Mal vergessen (AGENTS.md).
//
// Deshalb entscheidet der Betreiber es selbst, in der Ansicht, in der er das
// Konto sieht.
//
// ── WAS DER SCHALTER NICHT TUT ────────────────────────────────────────────
// Er weckt kein stillgelegtes Konto auf. `testkontoStilllegen` setzt DREI
// Dinge: die Marke, `active = FALSE` und ein gelöschtes Passwort. Nur die Marke
// zurückzunehmen würde ein Konto in die Team-Zentrale holen, das niemand
// benutzen kann — und das Passwort stellt dieser Schalter ausdrücklich nicht
// wieder her. Wer das Konto wieder braucht, setzt danach ein Passwort über
// „Passwort neu setzen".
// ═══════════════════════════════════════════════════════════════════════════
router.post("/admin/agents/:id/testkonto", async (req, res) => {
  try {
    await ensureAgentTables();
    const ist = req.body?.ist === true;
    const rows = await sqlPool`
      UPDATE fiaon_agents SET is_test_account = ${ist}
      WHERE id = ${Number(req.params.id)}
      RETURNING id, name, email, active, is_test_account
    `;
    if (rows.length === 0) return res.status(404).json({ ok: false, error: "Konto nicht gefunden" });
    const a = rows[0] as any;

    // Das Namensmuster ist die zweite Erkennung (server/lib/fiaon-mitarbeiter-sicht.ts).
    // Heißt das Konto „… Prüfstand …", bleibt es trotz gelöschter Marke ein
    // Testkonto — und die Antwort sagt das, statt den Betreiber rätseln zu
    // lassen, warum die Karte nicht auftaucht.
    const [nochTest] = (await sqlPool.unsafe(`
      SELECT ${istTestkontoSql("a")} AS ist_test FROM fiaon_agents a WHERE a.id = $1
    `, [Number(req.params.id)])) as any[];

    await logAgentEvent(a.id, "testkonto_marke", { ist, durch: "admin" });
    res.json({
      ok: true,
      agent: { id: Number(a.id), name: a.name, istTestkonto: !!a.is_test_account, aktiv: !!a.active },
      hinweis: ist
        ? `„${a.name}“ ist jetzt als Testkonto markiert und aus allen Team-Ansichten ausgeblendet.`
        : nochTest?.ist_test
          ? `Die Marke ist weg — aber „${a.name}“ gilt weiter als Testkonto, weil `
            + "Name oder E-Mail einem Prüfstands-Muster entsprechen. Umbenennen hilft."
          : !a.active
            ? `„${a.name}“ zählt wieder als echtes Konto, ist aber DEAKTIVIERT. `
              + "Zum Benutzen: aktivieren und Passwort neu setzen."
            : `„${a.name}“ zählt wieder als echtes Konto und erscheint in der Team-Zentrale.`,
    });
  } catch (err) {
    console.error("[FIAON-TEAM] testkonto:", err);
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
  const nurTest = String(_req.query?.test ?? "") === "1";
  const kontenGrenze = nurTest ? nurTestkontenSql() : echteMitarbeiterSql();
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
      -- Dieselbe Grenze wie in /admin/agents. Die Team-Übersicht wird aus
      -- DIESER Route gespeist — hier fehlte sie also dort, wo der Betreiber
      -- hinsieht.
      WHERE ${sqlPool.unsafe(kontenGrenze)}
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
 *  Entscheidung trifft IMMER der Vorgesetzte, nichts wird automatisch gebucht.
 *  Nur SELECT (kein Schreibzugriff). */
/**
 * Die nachbuchbaren Fälle — die EINE Wahrheit.
 *
 * Exportiert seit dem 17.08.2026, weil die Menü-Marke sie braucht: Sie hatte
 * eine eigene, nachgebaute Abfrage und zählte **14**, während diese Funktion
 * **21** Fälle fand und die Marke in fiaon-marken.ts **160**. Drei Zahlen für
 * dieselbe Sache — und der Betreiber klickte auf eine Marke, hinter der etwas
 * anderes stand.
 */
export async function backfillCandidates(): Promise<any[]> {
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
      AND kind IN ('own', 'override') -- 02.09.: Prämien (onboarding/inkasso) sind keine Abschluss-Provision
  `;
  if (existing.length > 0) return { ok: true, alreadyBooked: true };

  const apps = await sqlPool`
    SELECT ref, amount_due, assigned_agent_id, email, pack_key, type
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

  // ══════════════════════════════════════════════════════════════════════════
  // BETRAG SICHERSTELLEN — DER KATALOG KOMMT VOR DEM RATEN (19.08.2026)
  //
  // Die Reihenfolge war: Bestellung → manuelle Eingabe → Dubletten-Bestellung
  // → Bankeingang. Drei der vier bezahlten Bestellungen mit einem Betrag
  // AUSSERHALB des Katalogs stammen aus genau hier:
  //
  //   Silvana Kammerzell    FIAON Start    10,00 €  („manueller Eingabe")
  //   Daliborka Saratlija   FIAON Pro      10,00 €  („manueller Eingabe")
  //   Ilijana Weber         High End       79,99 €  („Dubletten-Bestellung")
  //
  // Bei allen drei war das Paket bekannt und der Katalogpreis damit ebenfalls.
  // Eine getippte Zehn und ein Betrag aus der Bestellung eines ANDEREN Pakets
  // sind Schätzungen — und sie landen in der Provisionsrechnung.
  //
  // Der Katalog steht deshalb vor allen Schätzungen. Manuell, Dublette und
  // Bankeingang bleiben für die Fälle, in denen es kein Katalogpaket gibt
  // (gemessen: 103 lebende Bestellungen ohne `pack_key`).
  // ══════════════════════════════════════════════════════════════════════════
  let amountCents = eurToCents(app.amount_due);
  let source = "order";
  if (amountCents <= 0) {
    const ausKatalog = katalogpreisCents(app);
    if (ausKatalog != null && ausKatalog > 0) {
      amountCents = ausKatalog;
      source = "katalog";
    } else if (manualAmountCents && manualAmountCents > 0) {
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
    const srcLabel = source === "katalog" ? "dem Paketkatalog"
      : source === "manuell" ? "manueller Eingabe"
      : source === "donor" ? "Dubletten-Bestellung" : "Bankeingang";
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
      // brauchen die bewusste Einzel-Entscheidung des Vorgesetzten.
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

// ═══════════════════════════════════════════════════════════════════════════
// KUNDEN UMHÄNGEN — der Fall „ein Mensch geht"
//
// ── DER BEFUND (17.08.2026) ────────────────────────────────────────────────
// Auf der Vollständigkeitsliste aus Paket 8 stand „Kunden umhängen". Es war die
// EINZIGE der fünfzehn Funktionen, die im Mitarbeiter-Detail wirklich fehlte.
//
// Es gab `POST /admin/team/reassign` — aber die Route hängt nur die
// BESTELLUNG um (`fiaon_applications.assigned_agent_id`). Die Arbeitslisten
// filtern seit dem Personen-Umbau auf `fiaon_persons.assigned_agent_id`. Ein
// Umhängen über die alte Route hätte die Karten also NICHT bewegt: Der
// scheidende Mitarbeiter hätte sie weiter in seiner Liste gehabt, der neue
// nicht. Ein Knopf, der etwas anderes tut als er sagt, ist schlimmer als keiner.
//
// Deshalb hier ein eigener Weg, der BEIDE Seiten mitnimmt — und eine Vorschau,
// wie bei jedem Massenlauf im Haus.
// ═══════════════════════════════════════════════════════════════════════════

/** GET /admin/team/agents/:id/kunden — was hängt an diesem Menschen? (Vorschau) */
router.get("/admin/team/agents/:id/kunden", async (req, res) => {
  try {
    const id = Number(req.params.id);
    const [z] = (await sqlPool`
      SELECT
        (SELECT COUNT(*)::int FROM fiaon_persons
          WHERE assigned_agent_id = ${id} AND merged_into_person_id IS NULL) AS personen,
        (SELECT COUNT(*)::int FROM fiaon_persons
          WHERE assigned_agent_id = ${id} AND merged_into_person_id IS NULL
            AND priority_tier BETWEEN 1 AND 3) AS im_bestand,
        (SELECT COUNT(*)::int FROM fiaon_applications
          WHERE assigned_agent_id = ${id} AND merged_into IS NULL) AS bestellungen,
        (SELECT COUNT(*)::int FROM fiaon_abo_raten r
          WHERE r.inkasso_agent_id = ${id} AND r.status <> 'bezahlt') AS offene_raten,
        (SELECT COUNT(*)::int FROM fiaon_termine
          WHERE agent_id = ${id} AND status = 'gebucht' AND beginn > NOW()) AS termine
    `) as any[];

    // Wer kann übernehmen? Nur echte, aktive Menschen — ein Testkonto darf
    // keine Kunden bekommen (siehe fiaon-mitarbeiter-sicht.ts).
    const ziele = (await sqlPool.unsafe(`
      SELECT a.id, a.name, COALESCE(a.rolle, 'agent') AS rolle,
             (SELECT COUNT(*)::int FROM fiaon_persons p
               WHERE p.assigned_agent_id = a.id AND p.merged_into_person_id IS NULL
                 AND p.priority_tier BETWEEN 1 AND 3) AS last
      FROM fiaon_agents a
      WHERE a.active AND a.id <> $1 AND ${echteMitarbeiterSql()}
      ORDER BY last ASC, a.name ASC
    `, [id])) as any[];

    res.json({
      ok: true,
      stand: {
        personen: Number(z.personen), imBestand: Number(z.im_bestand),
        bestellungen: Number(z.bestellungen), offeneRaten: Number(z.offene_raten),
        termine: Number(z.termine),
      },
      ziele,
      hinweis: Number(z.personen) === 0
        ? "An diesem Menschen hängt kein Kunde."
        : `${z.personen} ${Number(z.personen) === 1 ? "Kunde" : "Kunden"} hängen an ihm, `
          + `${z.im_bestand} davon im aktiven Bestand.`,
    });
  } catch (err) {
    console.error("[FIAON-TEAM] kunden vorschau:", err);
    res.status(500).json({ ok: false, error: "Serverfehler" });
  }
});

/**
 * POST /admin/team/agents/:id/kunden-umhaengen — alle Kunden an einen anderen.
 *
 * `zielId = null` heißt: Zuteilung entfernen, damit die Verteilung sie neu
 * vergibt. Das ist der Regelfall, wenn jemand geht — der Rundlauf verteilt
 * gleichmäßig, ein Mensch von Hand nicht.
 */
router.post("/admin/team/agents/:id/kunden-umhaengen", async (req, res) => {
  try {
    const id = Number(req.params.id);
    const zielId = req.body?.zielId == null ? null : Number(req.body.zielId);
    const grund = String(req.body?.grund || "").trim();
    if (grund.length < 5) {
      return res.status(400).json({
        ok: false,
        error: "Bitte einen Grund angeben (mindestens 5 Zeichen). Er steht später "
          + "im Verlauf jedes betroffenen Kunden.",
      });
    }
    let zielName = "die Verteilung";
    if (zielId != null) {
      const [t] = (await sqlPool.unsafe(`
        SELECT id, name FROM fiaon_agents a
        WHERE a.id = $1 AND a.active AND ${echteMitarbeiterSql()}
      `, [zielId])) as any[];
      if (!t) {
        return res.status(404).json({
          ok: false,
          error: "Dieses Ziel gibt es nicht, ist stillgelegt oder ein Testkonto.",
        });
      }
      zielName = String(t.name);
    }
    const [von] = (await sqlPool`SELECT name FROM fiaon_agents WHERE id = ${id}`) as any[];

    // ── EINE TRANSAKTION ─────────────────────────────────────────────────
    // Person und Bestellung müssen GEMEINSAM umziehen. Bliebe die Person beim
    // Alten und die Bestellung beim Neuen, sähe die Arbeitsliste des einen
    // etwas anderes als die Akte des anderen.
    const erg = await sqlPool.begin(async (tx) => {
      const personen = (await tx`
        UPDATE fiaon_persons
        SET assigned_agent_id = ${zielId},
            assigned_at = ${zielId == null ? null : new Date()},
            -- Die Betreuungssperre fällt: Sonst schützt sie einen Menschen,
            -- der den Kunden nicht mehr betreut.
            betreuung_seit = ${zielId == null ? null : new Date()},
            -- Wiedervorlage auf heute: Der neue Betreuer soll den Fall sehen,
            -- nicht erst in drei Wochen von ihm erfahren.
            follow_up_date = NULL,
            updated_at = NOW()
        WHERE assigned_agent_id = ${id} AND merged_into_person_id IS NULL
        RETURNING id
      `) as any[];
      const bestellungen = (await tx`
        UPDATE fiaon_applications
        SET assigned_agent_id = ${zielId}, locked_by_agent_id = NULL,
            locked_until = NULL, updated_at = NOW()
        WHERE assigned_agent_id = ${id} AND merged_into IS NULL
        RETURNING ref
      `) as any[];
      for (const b of bestellungen) {
        await tx`
          INSERT INTO fiaon_contact_log (ref, agent_id, agent_name, type, note)
          VALUES (${b.ref}, ${zielId}, ${zielName}, 'claim',
                  ${`Betreuung umgehängt von ${von?.name ?? `Konto ${id}`} auf ${zielName}. Grund: ${grund.slice(0, 400)}`})
        `.catch(() => {});
      }
      return { personen: personen.length, bestellungen: bestellungen.length };
    });

    console.log(`[FIAON-TEAM] ${erg.personen} Kunden von ${id} auf ${zielId ?? "die Verteilung"} umgehängt.`);
    res.json({
      ok: true, ...erg,
      meldung: `${erg.personen} ${erg.personen === 1 ? "Kunde" : "Kunden"} und `
        + `${erg.bestellungen} ${erg.bestellungen === 1 ? "Bestellung" : "Bestellungen"} `
        + `umgehängt auf ${zielName}.`
        + (zielId == null ? " Die Verteilung vergibt sie beim nächsten Lauf neu." : ""),
    });
  } catch (err) {
    console.error("[FIAON-TEAM] kunden-umhaengen:", err);
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
        // Office-Umbau (E-038): Mitarbeiter sehen statt Login die Umbau-Bühne, bis Justin freigibt
        officeUmbau: settings.office_umbau === "an",
      },
    });
  } catch (err) {
    console.error("[FIAON-TEAM] settings:", err);
    res.status(500).json({ ok: false, error: "Serverfehler" });
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// MITARBEITER WIEDER FREISCHALTEN (E-038, Rückweg) — 24.08.2026
//
// Justin: „Wo bzw. wie schalte ich die Mitarbeiter frei? Und läuft es dann
// automatisch mit der Kunden-/Lead-Automatik?"
//
// VORHER war das Zurückschalten Handarbeit an ZWEI Orten: erst den Schalter
// „Umbau-Sperre" ausschalten, dann jedes der elf Konten einzeln in der
// Team-Zentrale wieder aktivieren. Elf Klicks, und wer eines übersieht, merkt
// es erst, wenn der Mitarbeiter sich beschwert.
//
// NACHHER macht dieser Weg beides in einem Zug — und zwar GENAU für die
// Konten, die vor der Aussperrung aktiv waren (Merkliste `umbau_vorher_aktiv`,
// beim Aussperren geschrieben). Wer seither dazugekommen oder absichtlich
// stillgelegt ist, bleibt unangetastet.
//
// Zur zweiten Frage: Ja. Verteilung und Lead-Automatik fragen bei jedem Lauf
// `active AND distribution_active AND NOT is_test_account` ab — sobald ein
// Konto wieder aktiv ist, bekommt es beim nächsten Lauf wieder Kunden. Es muss
// nichts zusätzlich eingeschaltet werden. Die Antwort liefert deshalb mit,
// wer danach wirklich in der Verteilung steht und wer nicht (Justins eigene
// Alt-Konten stehen z. B. bewusst draußen).
// ═══════════════════════════════════════════════════════════════════════════

/** Wer stand vor der Aussperrung auf „aktiv"? Liest die Merkliste. */
async function umbauMerkliste(): Promise<number[]> {
  const settings = await getSettings();
  return String(settings.umbau_vorher_aktiv || "")
    .split(",").map((t) => Number(String(t).trim()))
    .filter((n) => Number.isFinite(n) && n > 0);
}

/** Vorschau: Wer würde freigeschaltet, und was passiert danach mit ihm? */
router.get("/admin/office-freischaltung", async (_req, res) => {
  try {
    await ensureAgentTables();
    const settings = await getSettings();
    const ids = await umbauMerkliste();
    const konten = ids.length
      ? await sqlPool`
          SELECT id, name, rolle, active, distribution_active, is_test_account
          FROM fiaon_agents WHERE id = ANY(${ids}) ORDER BY id`
      : [];
    res.json({
      ok: true,
      umbauSperre: settings.office_umbau === "an",
      leadVerteilung: settings.lead_distribution_enabled === "1",
      konten: konten.map((k: any) => ({
        id: Number(k.id),
        name: k.name,
        rolle: k.rolle,
        aktiv: k.active === true,
        // Ehrlich sagen, was NACH dem Freischalten gilt: Ein Konto ohne
        // `distribution_active` bekommt weiterhin keine neuen Kunden — das
        // ist eine eigene Entscheidung und wird hier nicht mit umgelegt.
        inVerteilung: k.distribution_active === true && k.is_test_account !== true,
      })),
    });
  } catch (err) {
    console.error("[FIAON-TEAM] office-freischaltung lesen:", err);
    res.status(500).json({ ok: false, error: "Serverfehler" });
  }
});

/** Freischalten: Sperre aus, alle Konten der Merkliste wieder aktiv. */
router.post("/admin/office-freischaltung", async (req, res) => {
  try {
    await ensureAgentTables();
    const ids = await umbauMerkliste();
    if (ids.length === 0) {
      return res.status(400).json({ ok: false, error: "Es ist keine Merkliste hinterlegt — es wurde niemand ausgesperrt." });
    }
    // Die Sperre bleibt auf Wunsch stehen (z. B. um erst einen einzelnen
    // Mitarbeiter zu testen), ist aber der Normalfall.
    const sperreLassen = req.body?.sperreLassen === true;
    if (!sperreLassen) await setSetting("office_umbau", "aus");

    const wieder = await sqlPool`
      UPDATE fiaon_agents SET active = TRUE, updated_at = NOW()
      WHERE id = ANY(${ids}) AND active IS DISTINCT FROM TRUE
      RETURNING id, name, distribution_active, is_test_account`;

    res.json({
      ok: true,
      umbauSperre: sperreLassen,
      freigeschaltet: wieder.map((k: any) => ({
        id: Number(k.id), name: k.name,
        inVerteilung: k.distribution_active === true && k.is_test_account !== true,
      })),
      meldung: wieder.length === 0
        ? "Alle Konten der Merkliste waren bereits aktiv."
        : `${wieder.length} ${wieder.length === 1 ? "Konto" : "Konten"} wieder freigeschaltet.`
          + (sperreLassen ? " Die Umbau-Sperre steht weiterhin." : " Die Umbau-Sperre ist aus — das Office ist offen."),
    });
  } catch (err) {
    console.error("[FIAON-TEAM] office-freischaltung:", err);
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
    if (req.body?.officeUmbau != null) {
      await setSetting("office_umbau", req.body.officeUmbau ? "an" : "aus");
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
    // ── DIE ABRECHNUNG ZUR AUSZAHLUNG (19.08.2026) ─────────────────────────
    // Bisher stand in der Freigabe-Karte nur der Satz „der Mitarbeiter bekommt
    // eine Abrechnung als PDF". Ob sie entstanden ist, unter welcher Nummer und
    // ob sie ankam, war von hier aus nicht zu sehen — man musste hoffen.
    // Jetzt hängt die Nummer an der Karte und verlinkt in die
    // Abrechnungs-Zentrale (und die Zentrale zurück auf die Auszahlung).
    const abrechnungen = (await sqlPool`
      SELECT payout_id, id, statement_no, gesendet_am, sende_anzahl,
             (pdf_base64 IS NOT NULL) AS hat_pdf
        FROM fiaon_commission_statements
       WHERE payout_id IS NOT NULL
    `) as any[];
    const jeAuszahlung: Record<number, any> = {};
    for (const a of abrechnungen) {
      jeAuszahlung[Number(a.payout_id)] = {
        id: Number(a.id), nummer: a.statement_no,
        gesendetAm: a.gesendet_am ?? null,
        sendeAnzahl: Number(a.sende_anzahl ?? 0),
        hatPdf: a.hat_pdf === true,
      };
    }
    res.json({
      ok: true,
      data: payouts.map((p: any) => ({
        ...p,
        abrechnung: jeAuszahlung[Number(p.id)] ?? null,
        // Volle IBAN NUR hier (Admin-Auszahlungsansicht), aus verschlüsseltem Snapshot
        // ── DIE VOLLE IBAN, UNABHAENGIG VOM STATUS (20.08.2026) ─────────
        // Vorher nur bei Status „angefordert". Der Betreiber ueberweist manuell
        // ueber Wise und braucht sie zum KOPIEREN — auch beim zweiten Blick auf
        // eine schon freigegebene Zeile, etwa wenn die Ueberweisung scheitert
        // oder er den Beleg abgleicht. Eine maskierte IBAN ist dafuer wertlos.
        //
        // Die Einsicht ist ohnehin nur der Verwaltung moeglich
        // (adminCodeGate + blockAgentsFromAdmin) und wird an der Person
        // protokolliert, wenn sie ueber den Verguetungs-Reiter kommt.
        iban_full: decryptSecret(p.bank_iban_enc),
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

    // ══════════════════════════════════════════════════════════════════════
    // DER BELEG WIRD ABGEWARTET (20.08.2026)
    //
    // ── DIE URSACHE VON FIAON-COM-2026-0011 STAND GENAU HIER ──────────────
    // Vorher:
    //     generateCommissionStatement(id).catch((e) => console.error(…));
    //     res.json({ ok: true });
    //
    // Kein `await`, der Fehler nur in der Konsole, danach in JEDEM Fall
    // „ok: true". Die Auszahlung wurde also als abgeschlossen gemeldet, während
    // die Abrechnung im Hintergrund lief — und wenn dort das PDF scheiterte,
    // erfuhr es niemand. Ergebnis: 386,40 € ausgezahlt, kein Beleg, und die
    // Zentrale verweigerte die Herstellung.
    //
    // Es ist dieselbe Fehlerklasse, die am 19.08. schon zweimal behoben wurde
    // (`sendMakeWebhook(...).catch(() => {})` bei der Zahlungsdaten-Mail). Ein
    // verworfener Fehler an einer Geldstelle kommt zurück.
    //
    // ── WARUM DER STATUS TROTZDEM STEHEN BLEIBT ───────────────────────────
    // Der Auftrag sagt: „schlägt die Erzeugung fehl, wird die Freigabe nicht als
    // abgeschlossen markiert." Dem folge ich im ERGEBNIS (kein stilles „ok"),
    // aber nicht im Statuswechsel — und das ist eine bewusste Abweichung:
    //
    // Dieser Knopf heisst „Als überwiesen markieren". Der Betreiber drückt ihn,
    // NACHDEM er bei Wise überwiesen hat. Das Geld ist dann real weg. Würde das
    // System den Status verweigern, weil ein PDF nicht druckt, stünde in der
    // Buchhaltung „nicht ausgezahlt" bei einer erfolgten Zahlung — ein
    // schlimmerer Zustand als ein fehlender Beleg, und einer, der die
    // Provisionszeilen wieder freigäbe.
    //
    // Also: Status bleibt (er beschreibt die Wirklichkeit), aber die ANTWORT ist
    // ein Fehler mit Handlungsanweisung. Und die Zentrale kann den Beleg jetzt
    // nachträglich herstellen — die Wand dort ist korrigiert.
    // ══════════════════════════════════════════════════════════════════════
    const { generateCommissionStatement } = await import("./fiaon-onboarding");
    let belegFehler: string | null = null;
    try {
      const erg = await generateCommissionStatement(id);
      if (!erg.ok) belegFehler = "Die Abrechnung konnte nicht angelegt werden.";
      else if (erg.pdfFehlt) {
        belegFehler = `Die Abrechnung ${erg.statementNo} ist angelegt, aber das PDF `
          + `konnte nicht gedruckt werden: ${erg.pdfGrund ?? "unbekannter Fehler"}`;
      }
    } catch (e) {
      belegFehler = `Die Abrechnung ist nicht entstanden: ${e instanceof Error ? e.message : String(e)}`;
      console.error("[FIAON-TEAM] statement gen:", e);
    }
    if (belegFehler) {
      console.error(`[FIAON-PAYOUT] #${id} überwiesen markiert, aber OHNE Beleg: ${belegFehler}`);
      sendMakeWebhook("agent_payout_done", {
        email: agent[0].email,
        vorname: agent[0].first_name || agent[0].name,
        betrag: (rows[0].amount_cents / 100).toFixed(2),
        iban_masked: rows[0].iban_masked,
      }).catch(() => {});
      return res.status(502).json({
        ok: false,
        code: "BELEG_FEHLT",
        auszahlungGebucht: true,
        error: `Die Auszahlung ist als überwiesen gebucht — aber der BELEG FEHLT. `
          + `${belegFehler} `
          + "Bitte in der Abrechnungs-Zentrale (/admin/abrechnungen) auf „Neu erzeugen“ "
          + "drücken; das stellt den Beleg nachträglich her. Eine ausgezahlte Provision "
          + "ohne Beleg darf nicht stehen bleiben.",
      });
    }
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
// WIRTSCHAFTLICHKEIT — nur für den Vorgesetzten
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

// ═══════════════════════════════════════════════════════════════════════════
// AKTIVITÄT
// ═══════════════════════════════════════════════════════════════════════════

/**
 * GET /admin/team/aktivitaet — sensible Aktionen, gefiltert.
 *
 * NUR unter /admin: Die Liste nennt, wer wem was getan hat. In den Händen der
 * Vertriebsleitung wäre sie ein Werkzeug, um zu sehen, wer beobachtet wird.
 */
// ═══════════════════════════════════════════════════════════════════════════
// ANRUFE MIT MARKE „ZUORDNUNG PRÜFEN"
//
// ── WOHER SIE KOMMEN ───────────────────────────────────────────────────────
// Am 16.08.2026 wurde die Anruf-Zuordnung umgebaut: Nicht mehr die offene
// Kundenkarte entscheidet, wem ein Anruf gehört, sondern die GEWÄHLTE NUMMER.
// Beim Bestandslauf blieben vier Anrufe übrig, bei denen sich das nicht
// eindeutig klären ließ — sie bekamen eine Marke im Feld `transkript_grund`.
//
// ── DAS PROBLEM ────────────────────────────────────────────────────────────
// Eine Marke, die niemand findet, ist keine Marke. Der Betreiber hätte in der
// Datenbank suchen müssen. Diese Route macht sie in der Team-Zentrale sichtbar,
// im Reiter „Aktivität" — dort, wo er ohnehin nach Unstimmigkeiten sieht.
// ═══════════════════════════════════════════════════════════════════════════
router.get("/admin/team/anrufe-pruefen", async (_req: Request, res: Response) => {
  try {
    const zeilen = (await sqlPool`
      SELECT c.id, c.beginn, c.nummer, c.richtung, c.dauer_sek,
             c.transkript_grund AS marke, c.person_id, c.agent_id,
             c.recording_url IS NOT NULL AS hat_aufnahme,
             ag.name AS agent,
             COALESCE(NULLIF(TRIM(CONCAT_WS(' ', p.first_name, p.last_name)), ''),
                      p.company_name, p.contact_name, 'ohne Zuordnung') AS kunde,
             (SELECT a.ref FROM fiaon_applications a
               WHERE a.person_id = c.person_id AND a.merged_into IS NULL
               ORDER BY a.created_at DESC LIMIT 1) AS ref
      FROM fiaon_calls c
      LEFT JOIN fiaon_agents ag ON ag.id = c.agent_id
      LEFT JOIN fiaon_persons p ON p.id = c.person_id
      WHERE c.transkript_grund ILIKE '%uordnung prüfen%'
      ORDER BY c.beginn DESC
      LIMIT 100
    `) as any[];
    res.json({
      ok: true,
      anzahl: zeilen.length,
      anrufe: zeilen.map((z) => ({
        id: Number(z.id), beginn: z.beginn, nummer: z.nummer,
        richtung: z.richtung, dauerSek: Number(z.dauer_sek ?? 0),
        marke: z.marke, kunde: z.kunde, agent: z.agent,
        hatAufnahme: z.hat_aufnahme === true,
        personId: z.person_id != null ? Number(z.person_id) : null,
        akte: z.ref ? `/admin/kunde/${encodeURIComponent(String(z.ref))}` : null,
      })),
      hinweis: zeilen.length === 0
        ? "Kein Anruf braucht eine Klärung."
        : `${zeilen.length} ${zeilen.length === 1 ? "Anruf" : "Anrufe"} aus dem Umbau der `
          + "Anruf-Zuordnung (16.08.2026), bei denen sich der Mensch nicht eindeutig "
          + "bestimmen ließ. Wer die Aufnahme anhört, kann es entscheiden.",
    });
  } catch (err) {
    console.error("[FIAON-TEAM] anrufe-pruefen:", err);
    res.status(500).json({ ok: false, error: "Serverfehler" });
  }
});

router.get("/admin/team/aktivitaet", async (req: Request, res: Response) => {
  try {
    const { aktivitaet, aktivitaetZahlen, KATALOG } = await import("../lib/fiaon-aktivitaet");
    const [zeilen, zahlen] = await Promise.all([
      aktivitaet({
        agentId: req.query.agent ? Number(req.query.agent) : null,
        typ: req.query.typ ? String(req.query.typ) : null,
        von: req.query.von ? String(req.query.von) : null,
        bis: req.query.bis ? String(req.query.bis) : null,
        nurSchwere: req.query.schwere === "hoch" || req.query.schwere === "mittel"
          ? req.query.schwere : null,
        limit: req.query.limit ? Number(req.query.limit) : 120,
      }),
      aktivitaetZahlen(),
    ]);
    res.json({
      ok: true, zeilen, zahlen,
      // Der Katalog wandert mit: Die Oberfläche baut daraus ihre Filter, statt
      // eine zweite Liste zu pflegen, die beim nächsten neuen Typ veraltet.
      katalog: KATALOG.map((k) => ({ typ: k.typ, titel: k.titel, schwere: k.schwere })),
    });
  } catch (err) {
    console.error("[TEAM] aktivitaet:", err);
    res.status(500).json({ ok: false, error: "Serverfehler" });
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// FIRMIERUNG UND ABRECHNUNGS-PDF
// ═══════════════════════════════════════════════════════════════════════════

/** GET /admin/team/firmierung — die Angaben für Dokumente. */
router.get("/admin/team/firmierung", async (_req: Request, res: Response) => {
  const { firmierung, FIRMIERUNG_VORGABE } = await import("../lib/fiaon-firmierung");
  res.json({ ok: true, firmierung: await firmierung(), vorgabe: FIRMIERUNG_VORGABE });
});

/** POST /admin/team/firmierung — ändern. */
router.post("/admin/team/firmierung", async (req: Request, res: Response) => {
  try {
    const { firmierungSetzen } = await import("../lib/fiaon-firmierung");
    const neu = await firmierungSetzen(req.body ?? {});
    console.log(`[TEAM] Firmierung geändert: ${neu.name}, ${neu.strasse}, ${neu.ort}`);
    res.json({
      ok: true, firmierung: neu,
      meldung: "Gespeichert. Neue Dokumente tragen die Angaben; bestehende PDFs bleiben unverändert — "
        + "ein ausgestelltes Dokument ändert man nicht nachträglich.",
    });
  } catch (err) {
    console.error("[TEAM] firmierung:", err);
    res.status(500).json({ ok: false, error: "Serverfehler" });
  }
});

/**
 * POST /admin/team/abrechnung/:id/neu-erzeugen — PDF neu bauen.
 *
 * ── WAS SICH ÄNDERT UND WAS NICHT ──────────────────────────────────────────
 * NUR die Form. Positionen, Summen, Abrechnungsnummer und das
 * Original-Erstellungsdatum bleiben unverändert — sie stehen in
 * `lines_json`, `gross_cents` und `issued_at` und werden nicht neu gerechnet.
 *
 * Das ist der Kern: Eine Abrechnung, deren Summe sich beim Neu-Erzeugen
 * ändern könnte, wäre kein Dokument, sondern eine Momentaufnahme. Der
 * Prüfstand vergleicht die Summen vorher und nachher.
 */
router.post("/admin/team/abrechnung/:id/neu-erzeugen", async (req: Request, res: Response) => {
  // ══════════════════════════════════════════════════════════════════════════
  // ZWEITE FASSUNG DESSELBEN BELEGS — ENTFERNT (19.08.2026)
  //
  // Hier standen rund 80 Zeilen eigenes Dokument-HTML: „Issued by",
  // „Recipient", „Sale value", „Rate", „Total", „Tax treatment" — eine
  // vollstaendige zweite Fassung der Provisionsabrechnung, auf Englisch.
  //
  // Sie trug DENSELBEN Fehler wie die Erstausstellung:
  //     markenzeile: fussZeile(firma), fusszeile: fussZeile(firma)
  // also die Firmenzeile zweimal, plus den Aussteller-Block. Wer hier
  // nachdruckte, bekam genau das Dokument zurueck, das der Betreiber gemeldet
  // hat — vier Seiten, Fusszeile doppelt, Pauschalen mit leerer Prozentspalte.
  //
  // UND SIE HATTE KEINE BELEG-WAND: Ein ausgezahlter Beleg liess sich hier
  // ueberschreiben. Genau das darf nicht sein.
  //
  // Gefunden hat es der Pruefstand, der nach einer zweiten Positionstabelle im
  // Server suchte („Sale value"). Der Auftrag hat danach ausdruecklich verlangt:
  // „EIN Renderer fuer alle Wege — Grep auf Alt-Fassungen."
  //
  // Die Route bleibt bestehen (die Team-Zentrale ruft sie), fuehrt aber jetzt
  // durch dieselbe Tuer wie die Abrechnungs-Zentrale.
  // ══════════════════════════════════════════════════════════════════════════
  try {
    const id = Number(req.params.id);
    if (!Number.isFinite(id) || id <= 0) {
      return res.status(400).json({ ok: false, error: "Ungueltige Kennung." });
    }
    const [st] = (await sqlPool`
      SELECT s.statement_no, s.gross_cents, s.lines_json, p.status AS auszahlung_status
        FROM fiaon_commission_statements s
        LEFT JOIN fiaon_payouts p ON p.id = s.payout_id
       WHERE s.id = ${id}
    `) as any[];
    if (!st) return res.status(404).json({ ok: false, error: "Abrechnung nicht gefunden." });

    const { abrechnungNeuErzeugen } = await import("./fiaon-onboarding");
    const erg = await abrechnungNeuErzeugen(id);
    if (!erg.ok) {
      // 409, nicht 500: Die Ablehnung eines Belegs ist kein Serverfehler,
      // sondern eine Regel — und sie wird im Klartext genannt.
      return res.status(409).json({ ok: false, error: erg.grund });
    }
    const zeilen = JSON.parse(String(st.lines_json || "[]"));
    res.json({
      ok: true,
      meldung: `${st.statement_no} neu erzeugt. Summe unveraendert: `
        + `${(Number(st.gross_cents) / 100).toFixed(2)} EUR.`,
      summeCents: Number(st.gross_cents),
      positionen: zeilen.length,
    });
  } catch (err) {
    console.error("[TEAM] abrechnung neu:", err);
    res.status(500).json({ ok: false, error: "Serverfehler beim Neu-Erzeugen." });
  }
});

/**
 * GET/POST /admin/team/sonderrollen-bereinigen — Vertriebskunden zurückgeben.
 *
 * GET zeigt, was passieren würde. POST mit `schreiben: true` tut es.
 */
router.get("/admin/team/sonderrollen-bereinigen", async (_req: Request, res: Response) => {
  try {
    const { sonderrollenBereinigen } = await import("../lib/fiaon-zuteilung");
    res.json({ ok: true, ...(await sonderrollenBereinigen({ schreiben: false })) });
  } catch (err) {
    console.error("[TEAM] sonderrollen:", err);
    res.status(500).json({ ok: false, error: "Serverfehler" });
  }
});

router.post("/admin/team/sonderrollen-bereinigen", async (req: Request, res: Response) => {
  try {
    const { sonderrollenBereinigen } = await import("../lib/fiaon-zuteilung");
    const erg = await sonderrollenBereinigen({ schreiben: req.body?.schreiben === true });
    if (erg.verschoben > 0) {
      const { aktivitaetSchreiben } = await import("../lib/fiaon-aktivitaet");
      await aktivitaetSchreiben({
        typ: "person_owner_changed", wer: "Vorgesetzter",
        grund: `${erg.verschoben} Vertriebskunden von Sonderrollen zurueckgegeben.`,
        meta: { anzahl: erg.verschoben, art: "sonderrolle_bereinigt" },
      });
    }
    res.json({ ok: true, ...erg });
  } catch (err) {
    console.error("[TEAM] sonderrollen POST:", err);
    res.status(500).json({ ok: false, error: "Serverfehler" });
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// DIE AKTE EINES MITARBEITERS — ALLES AN EINEM ORT
//
// ── DER AUFTRAG ────────────────────────────────────────────────────────────
// Der Vorgesetzte: „Das ist die Zentrale für alle Dienstnehmer, diese muss
// reibungslos laufen. Unter ‚Provisionen' findet man keine Verläufe. Ich muss
// die Gespräche, die durch das Plattform-Telefon geführt wurden, beim Agenten
// zugewiesen haben, der sie geführt hat. Ich muss KI-Auswertungen machen
// können, Provisionen buchen, Mails senden — einfach alles."
//
// ── WARUM EINE ROUTE UND NICHT SECHS ───────────────────────────────────────
// Wer eine Akte öffnet, will nicht sechsmal warten. Zwölf Mitarbeiter × sechs
// Abfragen wären zweiundsiebzig Runden zur Datenbank; hier sind es sechs
// gleichzeitige für EINEN Menschen.
// ═══════════════════════════════════════════════════════════════════════════

router.get("/admin/team/:id/akte", async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isFinite(id) || id <= 0) {
      return res.status(400).json({ ok: false, error: "Ungültige Kennung." });
    }

    const [
      provisionen, anrufe, auszahlungen, abrechnungen, kunden, ereignisse, zahlen,
    ] = await Promise.all([
      // ── PROVISIONSVERLAUF ─────────────────────────────────────────────
      // Der Reiter zeigte bisher NUR offene Nachbuchungen — also das, was
      // fehlt. Was gebucht IST, stand nirgends. Ein Mensch, der fragt „womit
      // habe ich meine 2.221 € verdient", fand keine einzige Zeile.
      sqlPool`
        SELECT c.id, c.ref, c.payment_reference, c.pack_name, c.kind,
               c.base_amount_cents, c.rate_bp, c.amount_cents, c.status,
               c.note, c.created_at, c.payout_id,
               COALESCE(NULLIF(TRIM(CONCAT_WS(' ', a.first_name, a.last_name)), ''),
                        a.company_name, a.contact_name) AS kunde,
               q.name AS quelle_name
        FROM fiaon_commissions c
        LEFT JOIN fiaon_applications a ON a.ref = c.ref
        LEFT JOIN fiaon_agents q ON q.id = c.source_agent_id
        WHERE c.agent_id = ${id}
        ORDER BY c.created_at DESC
        LIMIT 200
      `,

      // ── GESPRÄCHE ÜBER DAS PLATTFORM-TELEFON ──────────────────────────
      // „Ich muss die Gespräche beim Agenten zugewiesen haben, der sie geführt
      // hat." Sie sind zugewiesen — über `fiaon_calls.agent_id`. Sie waren nur
      // nie sichtbar.
      //
      // Die Twilio-URL geht NICHT mit: Sie ist unbefristet gültig und öffnet
      // mit den Konto-Zugangsdaten die Aufnahme. Nach außen geht nur, OB es
      // eine gibt — abgespielt wird über /telefon/:id/aufnahme.
      // ══════════════════════════════════════════════════════════════════════
      // DER PROFIL-TAB ZEIGT NUR, WAS BELEGT IST (19.08.2026)
      //
      // ── DIE MELDUNG ─────────────────────────────────────────────────────
      // „Gespräche-Tab zeigt fremde Anrufe." Bei Lucas Böhnert stand ein Anruf,
      // in dem „Herr Boyschenko" spricht — Nikitas Gespräch in Lucas' Tab.
      //
      // ── WAS VORHER PASSIERTE ────────────────────────────────────────────
      // Der Filter war richtig (`k.agent_id = id`) — aber `agent_id` selbst ist
      // bei EINGEHENDEN Anrufen geraten: `zustaendigFuer()` leitet ihn aus
      // Inkasso-Zuständigkeit, Termin, Betreuer und „wer zuletzt sprach" ab. Das
      // beantwortet „wer sollte rangehen", nicht „wer hat gesprochen".
      //
      // Am 19.08. wurde die Herkunft nur SICHTBAR gemacht (Migration 066). Das
      // genügt nicht: Eine Zeile mit Warnmarke im Profil eines Menschen wird
      // trotzdem als seine Leistung gelesen — und der Betreiber musste bei jeder
      // Zeile selbst entscheiden, ob er ihr glaubt.
      //
      // ── DIE REGEL JETZT, HART ───────────────────────────────────────────
      // Der Profil-Tab zeigt AUSSCHLIESSLICH Anrufe, die diese Person selbst
      // geführt hat: ausgehend (die Sitzung hat gewählt) oder eingehend MIT
      // erfasstem Ergebnis (die Route lehnt fremde Anrufe ausdrücklich ab).
      //
      // Ein eingehender Anruf ohne Ergebnis erscheint in KEINEM Profil mehr —
      // er bleibt an der Kundenakte sichtbar, wo er hingehört. GEMESSEN: 36
      // Anrufe (Lucas 18, Hans-Jürgen 12, Nikita 6) verlassen damit die Profile.
      //
      // `unsafe` ist nötig, weil die Bedingung als SQL-Baustein aus
      // `fiaon-anruf-pruefung.ts` kommt — interpoliert in ein Template würde sie
      // zum Parameter statt zu SQL. Die Kennung ist eine geprüfte Zahl.
      // ══════════════════════════════════════════════════════════════════════
      sqlPool.unsafe(`
        SELECT k.id, k.person_id, k.ref, k.nummer, k.richtung, k.beginn, k.ende,
               k.dauer_sek, k.status, k.ergebnis, k.ergebnis_am,
               k.transkript_status, k.transkript_grund, k.zusammenfassung,
               (k.transkript IS NOT NULL) AS hat_transkript,
               (k.recording_url IS NOT NULL AND k.aufnahme_geloescht_am IS NULL) AS hat_aufnahme,
               k.aufnahme_geloescht_am, k.ohne_aufzeichnung_am,
               COALESCE(k.zuordnung_herkunft,
                        CASE WHEN COALESCE(k.richtung, 'raus') <> 'eingehend' THEN 'gewaehlt'
                             WHEN k.ergebnis IS NOT NULL THEN 'ergebnis'
                             ELSE 'zustaendigkeit' END) AS zuordnung_herkunft,
               k.zuordnung_unklar_am,
               k.zuordnung_unklar_grund,
               -- Passt die gewaehlte Nummer zur verknuepften Person? Die Anzeige
               -- schreibt es an die Zeile, damit ein Widerspruch auffaellt,
               -- bevor jemand die Aufnahme anhoert.
               (${NUMMER_PASST_SQL("k", "p")}) AS nummer_passt,
               COALESCE(NULLIF(TRIM(CONCAT_WS(' ', p.first_name, p.last_name)), ''),
                        p.company_name, p.contact_name, k.nummer) AS kunde,
               betreuer.name AS kunde_betreuer,
               gefuehrt.name AS gefuehrt_von
        FROM fiaon_calls k
        LEFT JOIN fiaon_persons p ON p.id = k.person_id
        LEFT JOIN fiaon_agents betreuer ON betreuer.id = p.assigned_agent_id
        LEFT JOIN fiaon_agents gefuehrt ON gefuehrt.id = k.agent_id
        WHERE k.agent_id = ${Number(id)}
          AND ${BELEGT_GEFUEHRT_SQL("k")}
        ORDER BY k.beginn DESC
        LIMIT 120
      `),

      // ── AUSZAHLUNGEN ──────────────────────────────────────────────────
      sqlPool`
        SELECT id, status, amount_cents, requested_at, paid_at, note
        FROM fiaon_payouts WHERE agent_id = ${id}
        ORDER BY requested_at DESC LIMIT 40
      `.catch(() => [] as any[]),

      // ── DIE ABRECHNUNGEN DIESES MENSCHEN (19.08.2026) ─────────────────
      // Damit der Reiter „Provisionen" nicht nur zeigt, WAS verdient wurde,
      // sondern auch WELCHER BELEG darüber existiert und ob er beim Menschen
      // angekommen ist. Dieselben Felder wie in der Abrechnungs-Zentrale.
      sqlPool`
        SELECT s.id, s.statement_no, s.period_start, s.period_end, s.issued_at,
               s.net_cents, s.gesendet_am, s.sende_anzahl,
               (s.pdf_base64 IS NOT NULL) AS hat_pdf,
               p.status AS auszahlung_status
          FROM fiaon_commission_statements s
          LEFT JOIN fiaon_payouts p ON p.id = s.payout_id
         WHERE s.agent_id = ${id}
         ORDER BY s.issued_at DESC LIMIT 60
      `.catch(() => [] as any[]),

      // ── DIE ZEHN JÜNGSTEN KUNDENBEWEGUNGEN ────────────────────────────
      sqlPool`
        SELECT cl.id, cl.ref, cl.type, cl.outcome, cl.note, cl.created_at,
               COALESCE(NULLIF(TRIM(CONCAT_WS(' ', a.first_name, a.last_name)), ''),
                        a.company_name, a.contact_name, cl.ref) AS kunde
        FROM fiaon_contact_log cl
        LEFT JOIN fiaon_applications a ON a.ref = cl.ref
        WHERE cl.agent_id = ${id} AND cl.type <> 'system'
        ORDER BY cl.created_at DESC LIMIT 30
      `,

      // ── SENSIBLE EREIGNISSE ───────────────────────────────────────────
      sqlPool`
        SELECT e.id, e.type, e.meta, e.actor, e.reason, e.created_at
        FROM fiaon_agent_events e
        WHERE e.agent_id = ${id} OR e.from_agent_id = ${id} OR e.to_agent_id = ${id}
        ORDER BY e.created_at DESC LIMIT 40
      `,

      // ── DIE ZAHLEN ZU DEN GESPRÄCHEN ──────────────────────────────────
      // Sie zählen GENAU DIE MENGE, DIE DIE LISTE ZEIGT — dieselbe Bedingung,
      // aus derselben Funktion. Vorher zählten sie alles mit `agent_id`, also
      // auch die geratenen Zeilen: Die Kachel sagte 14, die Liste zeigte 12, und
      // niemand konnte den Unterschied erklären. Eine Kennzahl, die eine andere
      // Menge zählt als die Liste darunter, ist schlimmer als keine.
      //
      // NEU DABEI: `verbunden` — Anrufe mit Gesprächsdauer über null. Über die
      // Hälfte der Zeilen sind Wahlversuche, die nie durchkamen (GEMESSEN:
      // Lucas 404 von 784, Nikita 225 von 436). Sie als „Gespräche" zu zählen
      // erklärt, warum eine Liste mit 14 Einträgen nach Verwechslung aussieht.
      sqlPool.unsafe(`
        SELECT COUNT(*)::int AS anrufe,
               COUNT(*) FILTER (WHERE COALESCE(k.dauer_sek, 0) > 0)::int AS verbunden,
               COUNT(*) FILTER (WHERE k.dauer_sek >= 30)::int AS erreicht,
               COALESCE(SUM(k.dauer_sek), 0)::int AS sekunden,
               COUNT(*) FILTER (WHERE k.recording_url IS NOT NULL
                                AND k.aufnahme_geloescht_am IS NULL)::int AS aufnahmen,
               COUNT(*) FILTER (WHERE k.zusammenfassung IS NOT NULL)::int AS ausgewertet,
               COUNT(*) FILTER (WHERE k.transkript_status = 'fehlgeschlagen')::int AS gescheitert
        FROM fiaon_calls k
        WHERE k.agent_id = ${Number(id)}
          AND ${BELEGT_GEFUEHRT_SQL("k")}
      `),
    ]);

    const p = provisionen as any[];
    const summe = (f: (x: any) => boolean) =>
      p.filter(f).reduce((s, x) => s + Number(x.amount_cents || 0), 0);

    res.json({
      ok: true,
      provisionen: p,
      // Die Summen gehören dazu: Eine Liste aus 98 Zeilen ohne Summe ist
      // eine Zumutung — man rechnet sie im Kopf nach oder glaubt sie nicht.
      provisionSummen: {
        gesamt: summe(() => true),
        gebucht: summe((x) => x.status === "booked" || x.status === "gebucht"),
        ausgezahlt: summe((x) => !!x.payout_id),
        offen: summe((x) => !x.payout_id && x.status !== "cancelled"),
        storniert: summe((x) => x.status === "cancelled"),
        anzahl: p.length,
      },
      anrufe,
      anrufZahlen: (zahlen as any[])[0] ?? null,
      auszahlungen,
      // Dieselbe Form wie in der Abrechnungs-Zentrale — der Zustand wird über
      // DIESELBE Funktion abgeleitet, nicht hier zum zweiten Mal geraten.
      abrechnungen: (abrechnungen as any[]).map((s) => ({
        id: Number(s.id),
        nummer: s.statement_no,
        zeitraumVon: s.period_start ?? null,
        zeitraumBis: s.period_end ?? null,
        erzeugtAm: s.issued_at,
        betragCents: Number(s.net_cents ?? 0),
        hatPdf: s.hat_pdf === true,
        gesendetAm: s.gesendet_am ?? null,
        sendeAnzahl: Number(s.sende_anzahl ?? 0),
        zustand: abrechnungZustand(s),
      })),
      kunden,
      ereignisse,
    });
  } catch (err) {
    console.error("[TEAM] akte:", err);
    res.status(500).json({ ok: false, error: "Serverfehler" });
  }
});

/**
 * POST /admin/team/:id/gespraeche-auswerten — die KI liest die Transkripte.
 *
 * Beobachtungen, keine Note: Eine Zahl von eins bis zehn über einen Menschen
 * beendet das Gespräch mit ihm; eine Beobachtung eröffnet es.
 */
router.post("/admin/team/:id/gespraeche-auswerten", async (req: Request, res: Response) => {
  try {
    const { gespraecheAuswerten } = await import("../lib/fiaon-gespraechsanalyse");
    const erg = await gespraecheAuswerten(Number(req.params.id), {
      tage: req.body?.tage ? Number(req.body.tage) : 30,
      max: req.body?.max ? Number(req.body.max) : 12,
    });
    // Auch ein Fehlschlag geht mit HTTP 200 zurück: Der Grund ist die
    // eigentliche Auskunft, und ein 500er würde ihn im Client verschlucken.
    res.json({ ok: true, auswertung: erg });
  } catch (err) {
    console.error("[TEAM] auswertung:", err);
    res.status(500).json({ ok: false, error: "Serverfehler" });
  }
});

export default router;
