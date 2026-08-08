// ═══════════════════════════════════════════════════════════════════════════
// FIAON VERTRIEBSLEITUNG — /agent/vertrieb
//
// Zwei Menschen im Team führen den Vertrieb: Sie brauchen den Blick über ALLE
// Kunden, dürfen zuweisen und Kundendaten korrigieren — aber kein Geld bewegen.
//
// WAS SIE DÜRFEN
//   · alle Personen sehen, filtern, suchen, die Akte öffnen
//   · zuweisen (einzeln und mehrfach)
//   · Stammdaten korrigieren (Name, Telefon, E-Mail, Adresse)
//   · Zusagedatum setzen, Ergebnis dokumentieren, sperren/entsperren
//   · Zahlungsdaten senden
//
// WAS SIE NICHT DÜRFEN
//   · Zahlungen buchen        → bleibt beim Betreiber
//   · Provisionen ändern      → bleibt beim Betreiber
//   · Agenten anlegen/löschen oder Rollen ändern
//   · Bankdaten anderer Agenten sehen
//
// Diese Grenze steht SERVERSEITIG in der WHERE-Bedingung und in `nurLeitung`,
// nicht in der Oberfläche. Ein normaler Agent, der /agent/vertrieb aufruft,
// bekommt 404 — nicht 403: Eine Ansicht, die es für ihn nicht gibt, soll ihre
// Existenz nicht bestätigen.
//
// JEDE Änderung landet in `fiaon_agent_events` mit actor='vertriebsleiter:<id>',
// altem und neuem Wert. Wer fremde Kundendaten ändern darf, muss nachvollziehbar
// sein — das ist keine Zutat, sondern Voraussetzung für die Rechtevergabe.
// ═══════════════════════════════════════════════════════════════════════════

import { Router, type Response } from "express";
import { sqlPool } from "../lib/db-pool";
import { requireAgent, type AgentRequest } from "./fiaon-agent";
import { ensureBetreuungSpalte } from "../lib/tier";
import { ERGEBNISSE, ergebnisAnwenden, istErgebnis } from "../lib/fiaon-kontakt-ergebnis";
import { waehlbareNummer } from "../lib/fiaon-telefon";

const router = Router();

let spalteGeprueft: Promise<void> | null = null;
/** Rollen-Spalte anlegen (idempotent). 'agent' | 'vertriebsleiter'. */
export function ensureRolleSpalte(): Promise<void> {
  // Gemerktes Promise statt Bool: Zwei gleichzeitige erste Anfragen hätten die
  // DDL sonst doppelt gestartet und sich gegenseitig ausgesperrt.
  if (!spalteGeprueft) {
    spalteGeprueft = (async () => {
      await sqlPool`ALTER TABLE fiaon_agents ADD COLUMN IF NOT EXISTS rolle TEXT NOT NULL DEFAULT 'agent'`;
      await ensureBetreuungSpalte(sqlPool);
    })().catch((e) => { spalteGeprueft = null; throw e; });
  }
  return spalteGeprueft;
}

/** Ist dieser Agent Vertriebsleiter? */
export async function istVertriebsleiter(agentId: number): Promise<boolean> {
  await ensureRolleSpalte();
  const [a] = await sqlPool`SELECT rolle FROM fiaon_agents WHERE id = ${agentId} AND active`;
  return String(a?.rolle || "agent") === "vertriebsleiter";
}

/**
 * Torwächter. 404 statt 403, und die Prüfung liest die Rolle bei JEDEM Aufruf
 * aus der Datenbank — ein entzogenes Recht wirkt damit sofort und nicht erst
 * beim nächsten Login.
 */
async function nurLeitung(req: AgentRequest, res: Response, next: any) {
  if (!(await istVertriebsleiter(req.agent!.id))) {
    return res.status(404).json({ ok: false, error: "Nicht gefunden" });
  }
  return next();
}

/**
 * Zweiter Torwächter: die angenommene Verpflichtungserklärung.
 *
 * Hier ist 403 richtig und 404 falsch — anders als bei der Rolle. Wer
 * Vertriebsleiter ist, DARF wissen, dass es diesen Bereich gibt; ihm fehlt nur
 * ein Schritt. Eine 404 würde ihn ratlos zurücklassen, statt ihn zur Erklärung
 * zu führen. Der Code im Fehler ist die Anweisung an die Oberfläche, welche
 * Ansicht sie zeigen muss.
 *
 * Die Prüfung sitzt bewusst in derselben Kette wie die Rollenprüfung. Läge sie
 * nur in der Oberfläche, hätte ein Neugieriger die Daten mit einem einzigen
 * Aufruf ohne Erklärung — und der Nachweis wäre wertlos.
 */
async function nurMitZusage(req: AgentRequest, res: Response, next: any) {
  const { zusageStand } = await import("../lib/fiaon-vertrieb-zusage");
  const stand = await zusageStand(req.agent!.id);
  if (stand.offen) {
    return res.status(403).json({
      ok: false,
      code: "zusage_erforderlich",
      version: stand.version,
      neufassung: stand.neufassung,
      error: stand.neufassung
        ? "Die Verpflichtungserklärung für die Vertriebsleitung wurde geändert. Bitte die neue Fassung lesen und annehmen."
        : "Bitte die Verpflichtungserklärung für die Vertriebsleitung lesen und annehmen.",
    });
  }
  return next();
}

// ───────────────────────────────────────────────────────────────────────────
// GET/POST /agent/vertrieb/zusage — Erklärung holen und annehmen
//
// Diese zwei Wege liegen VOR dem Zusage-Wächter (sonst könnte man die Erklärung
// nicht lesen, weil man sie noch nicht angenommen hat), aber HINTER der
// Rollenprüfung: Wer nicht Vertriebsleiter ist, bekommt auch die Erklärung nicht
// zu sehen — sonst verrät sie die Existenz des Bereichs.
// ───────────────────────────────────────────────────────────────────────────
router.get("/agent/vertrieb/zusage", requireAgent, nurLeitung, async (req: AgentRequest, res: Response) => {
  try {
    const { ZUSAGE_TEXT, zusageStand, zusageHash } = await import("../lib/fiaon-vertrieb-zusage");
    const stand = await zusageStand(req.agent!.id);
    res.json({
      ok: true,
      offen: stand.offen,
      neufassung: stand.neufassung,
      akzeptiertAm: stand.akzeptiertAm,
      // Der Name wird gebraucht, weil die Unterschrift genau er sein muss.
      name: req.agent!.name,
      vorname: req.agent!.first_name || req.agent!.name,
      pruefwert: zusageHash().slice(0, 16),
      text: ZUSAGE_TEXT,
    });
  } catch (err) {
    console.error("[FIAON-VERTRIEB] zusage lesen:", err);
    res.status(500).json({ ok: false, error: "Serverfehler" });
  }
});

router.post("/agent/vertrieb/zusage", requireAgent, nurLeitung, async (req: AgentRequest, res: Response) => {
  try {
    const { zusageSpeichern } = await import("../lib/fiaon-vertrieb-zusage");
    // IP hinter einem Reverse Proxy: der erste Eintrag der Kette ist der Client.
    const weiter = String(req.headers["x-forwarded-for"] || "").split(",")[0].trim();
    const ergebnis = await zusageSpeichern({
      agentId: req.agent!.id,
      agentName: req.agent!.name,
      version: String(req.body?.version || ""),
      nameGetippt: String(req.body?.name || ""),
      gelesen: req.body?.gelesen === true,
      ip: weiter || req.socket?.remoteAddress || null,
      userAgent: String(req.headers["user-agent"] || "").slice(0, 500) || null,
    });
    if (!ergebnis.ok) return res.status(400).json({ ok: false, error: ergebnis.grund });

    // Rechtevergabe und ihre Annahme gehören in dasselbe Protokoll wie jede
    // andere Handlung der Vertriebsleitung.
    await protokoll(req.agent!.id, "vertrieb_zusage_angenommen", {
      version: String(req.body?.version || ""),
      name_getippt: String(req.body?.name || "").trim(),
    });
    res.json({
      ok: true,
      akzeptiertAm: ergebnis.akzeptiertAm,
      meldung: "Angenommen. Der Bereich Vertrieb ist jetzt für dich offen.",
    });
  } catch (err) {
    console.error("[FIAON-VERTRIEB] zusage annehmen:", err);
    res.status(500).json({ ok: false, error: "Serverfehler" });
  }
});

/** Protokoll — ohne Ausnahme, mit altem und neuem Wert. */
async function protokoll(
  leiterId: number,
  typ: string,
  daten: Record<string, unknown>,
  betroffenerAgent?: number | null,
): Promise<void> {
  await sqlPool`
    INSERT INTO fiaon_agent_events (agent_id, type, meta, actor, from_agent_id, to_agent_id)
    VALUES (${betroffenerAgent ?? leiterId}, ${typ}, ${JSON.stringify({ ...daten, durch: leiterId })},
            ${`vertriebsleiter:${leiterId}`},
            ${(daten as any).von_agent ?? null}, ${(daten as any).nach_agent ?? null})
  `.catch((e) => console.error("[FIAON-VERTRIEB] Protokoll:", e));
}

const NAME_SQL = `COALESCE(
  NULLIF(TRIM(CONCAT_WS(' ', p.first_name, p.last_name)), ''),
  NULLIF(TRIM(p.company_name), ''),
  NULLIF(TRIM(p.contact_name), ''),
  p.primary_email,
  CONCAT('Person ', p.id)
)`;

// ───────────────────────────────────────────────────────────────────────────
// GET /agent/vertrieb/uebersicht — Kopfzahlen
// ───────────────────────────────────────────────────────────────────────────
router.get("/agent/vertrieb/uebersicht", requireAgent, nurLeitung, nurMitZusage, async (req: AgentRequest, res: Response) => {
  try {
    const [z] = await sqlPool`
      SELECT
        COUNT(*) FILTER (WHERE priority_tier = 1 AND NOT is_blocked)::int AS tier1,
        COUNT(*) FILTER (WHERE priority_tier = 2 AND NOT is_blocked)::int AS tier2,
        COUNT(*) FILTER (WHERE priority_tier = 3 AND NOT is_blocked)::int AS tier3,
        COUNT(*) FILTER (WHERE priority_tier BETWEEN 1 AND 3 AND assigned_agent_id IS NULL AND NOT is_blocked)::int AS ohne_agent,
        COUNT(*) FILTER (WHERE is_blocked)::int AS gesperrt,
        COUNT(*) FILTER (WHERE promised_payment_date = CURRENT_DATE)::int AS zusage_heute,
        COUNT(*) FILTER (WHERE promised_payment_date < CURRENT_DATE AND priority_tier BETWEEN 1 AND 2)::int AS zusage_ueberfaellig
      FROM fiaon_persons WHERE merged_into_person_id IS NULL
    `;
    const agenten = await sqlPool`
      SELECT a.id, a.name, a.rolle,
             COUNT(p.id) FILTER (WHERE p.priority_tier = 1 AND NOT p.is_blocked)::int AS tier1,
             COUNT(p.id) FILTER (WHERE p.priority_tier = 2 AND NOT p.is_blocked)::int AS tier2,
             COUNT(p.id) FILTER (WHERE p.priority_tier = 3 AND NOT p.is_blocked)::int AS tier3,
             COUNT(p.id) FILTER (WHERE p.betreuung_seit IS NOT NULL)::int AS betreut
      FROM fiaon_agents a
      LEFT JOIN fiaon_persons p ON p.assigned_agent_id = a.id AND p.merged_into_person_id IS NULL
      WHERE a.active AND NOT COALESCE(a.is_test_account, FALSE)
      GROUP BY a.id, a.name, a.rolle
      ORDER BY a.name
    `;
    res.json({
      ok: true,
      zahlen: {
        tier1: z.tier1, tier2: z.tier2, tier3: z.tier3,
        ohneAgent: z.ohne_agent, gesperrt: z.gesperrt,
        zusageHeute: z.zusage_heute, zusageUeberfaellig: z.zusage_ueberfaellig,
      },
      agenten: (agenten as any[]).map((a) => ({
        id: a.id, name: a.name, rolle: a.rolle,
        tier1: a.tier1, tier2: a.tier2, tier3: a.tier3, betreut: a.betreut,
        gesamt: a.tier1 + a.tier2 + a.tier3,
      })),
    });
  } catch (err) {
    console.error("[FIAON-VERTRIEB] uebersicht:", err);
    res.status(500).json({ ok: false, error: "Serverfehler" });
  }
});

// ───────────────────────────────────────────────────────────────────────────
// GET /agent/vertrieb/personen — alle Personen, gefiltert
// ───────────────────────────────────────────────────────────────────────────
router.get("/agent/vertrieb/personen", requireAgent, nurLeitung, nurMitZusage, async (req: AgentRequest, res: Response) => {
  try {
    const filter = String(req.query.filter || "alle");
    const agent = req.query.agent ? Number(req.query.agent) : null;
    const q = String(req.query.q || "").trim();
    const limit = Math.min(400, Math.max(1, Number(req.query.limit) || 200));

    const wo: string[] = ["p.merged_into_person_id IS NULL"];
    if (filter === "tier1") wo.push("p.priority_tier = 1 AND NOT p.is_blocked");
    else if (filter === "tier2") wo.push("p.priority_tier = 2 AND NOT p.is_blocked");
    else if (filter === "tier3") wo.push("p.priority_tier = 3 AND NOT p.is_blocked");
    else if (filter === "bezahlt") wo.push("p.priority_tier = 0");
    else if (filter === "ohne_agent") wo.push("p.assigned_agent_id IS NULL AND p.priority_tier BETWEEN 1 AND 3 AND NOT p.is_blocked");
    else if (filter === "gesperrt") wo.push("p.is_blocked");
    else if (filter === "zusage_heute") wo.push("p.promised_payment_date = CURRENT_DATE");
    else if (filter === "ueberfaellig") wo.push("p.promised_payment_date < CURRENT_DATE AND p.priority_tier BETWEEN 1 AND 2");
    else if (filter === "betreut") wo.push("p.betreuung_seit IS NOT NULL");
    else wo.push("p.priority_tier BETWEEN 1 AND 3");
    if (agent === 0) wo.push("p.assigned_agent_id IS NULL");
    else if (agent) wo.push(`p.assigned_agent_id = ${agent}`);

    const rows = await sqlPool.unsafe(`
      SELECT p.id, ${NAME_SQL} AS name, p.primary_email, p.primary_phone, p.country,
             p.priority_tier, p.tier_reason, p.promised_payment_date, p.follow_up_date,
             p.unreachable_count, p.invoice_sent_count, p.is_blocked, p.betreuung_seit,
             p.assigned_agent_id, ag.name AS agent_name,
             (SELECT MAX(cl.created_at) FROM fiaon_contact_log cl
               JOIN fiaon_applications a2 ON a2.ref = cl.ref
               WHERE a2.person_id = p.id AND cl.voided_at IS NULL) AS letzter_kontakt,
             (SELECT cl.agent_name FROM fiaon_contact_log cl
               JOIN fiaon_applications a2 ON a2.ref = cl.ref
               WHERE a2.person_id = p.id AND cl.type = 'result' AND cl.agent_id IS NOT NULL
               ORDER BY cl.created_at DESC LIMIT 1) AS betreuer_name,
             (SELECT cl.scheduled_at FROM fiaon_contact_log cl
               JOIN fiaon_applications a2 ON a2.ref = cl.ref
               WHERE a2.person_id = p.id AND cl.outcome = 'rueckruf_termin' AND cl.done_at IS NULL
               ORDER BY cl.scheduled_at DESC LIMIT 1) AS rueckruf_am,
             (SELECT a2.pack_name FROM fiaon_applications a2
               WHERE a2.person_id = p.id AND a2.merged_into IS NULL AND a2.archived_at IS NULL
               ORDER BY a2.created_at DESC LIMIT 1) AS pack_name,
             (SELECT a2.amount_due FROM fiaon_applications a2
               WHERE a2.person_id = p.id AND a2.merged_into IS NULL AND a2.archived_at IS NULL
               ORDER BY a2.created_at DESC LIMIT 1) AS amount_due,
             (SELECT a2.ref FROM fiaon_applications a2
               WHERE a2.person_id = p.id AND a2.merged_into IS NULL AND a2.archived_at IS NULL
               ORDER BY a2.created_at DESC LIMIT 1) AS ref,
             (SELECT a2.phone FROM fiaon_applications a2
               WHERE a2.person_id = p.id AND a2.merged_into IS NULL AND a2.archived_at IS NULL AND NULLIF(a2.phone,'') IS NOT NULL
               ORDER BY a2.created_at DESC LIMIT 1) AS app_phone,
             (SELECT a2.phone_country_code FROM fiaon_applications a2
               WHERE a2.person_id = p.id AND a2.merged_into IS NULL AND a2.archived_at IS NULL AND NULLIF(a2.phone,'') IS NOT NULL
               ORDER BY a2.created_at DESC LIMIT 1) AS app_vorwahl
      FROM fiaon_persons p
      LEFT JOIN fiaon_agents ag ON ag.id = p.assigned_agent_id
      WHERE ${wo.join(" AND ")}
        AND ($1 = '' OR ${NAME_SQL} ILIKE '%' || $1 || '%'
             OR COALESCE(p.primary_email,'') ILIKE '%' || $1 || '%'
             OR COALESCE(p.primary_phone,'') ILIKE '%' || $1 || '%'
             OR EXISTS (SELECT 1 FROM fiaon_applications a3 WHERE a3.person_id = p.id
                          AND (a3.ref ILIKE '%' || $1 || '%' OR COALESCE(a3.payment_reference,'') ILIKE '%' || $1 || '%'))
             -- Frühere Angaben mitsuchen: Nach einem Zusammenschluss ist die alte
             -- Adresse des Kunden nur noch ein Alias. Ohne diesen Zweig fände die
             -- Vertriebsleitung den Kunden unter der Adresse nicht, die er am
             -- Telefon nennt.
             OR EXISTS (SELECT 1 FROM fiaon_person_aliases al WHERE al.person_id = p.id
                          AND (al.value_norm ILIKE '%' || $1 || '%'
                               OR COALESCE(al.value_raw,'') ILIKE '%' || $1 || '%'
                               OR COALESCE(al.feld_wert,'') ILIKE '%' || $1 || '%')))
      ORDER BY p.priority_tier ASC, p.promised_payment_date ASC NULLS LAST, p.id DESC
      LIMIT ${limit}
    `, [q]);

    res.json({
      ok: true,
      anzahl: rows.length,
      personen: (rows as any[]).map((p) => {
        const tel = waehlbareNummer(
          [{ nummer: p.app_phone, vorwahl: p.app_vorwahl }, { nummer: p.primary_phone }],
          p.country,
        );
        return {
          personId: p.id, name: p.name, email: p.primary_email,
          telefon: tel.anzeige, telefonWaehlbar: tel.waehlbar,
          tier: p.priority_tier, tierGrund: p.tier_reason,
          zusagedatum: p.promised_payment_date, wiedervorlage: p.follow_up_date,
          rueckrufAm: p.rueckruf_am,
          nichtErreicht: p.unreachable_count, rechnungVersandt: p.invoice_sent_count,
          gesperrt: p.is_blocked, betreutSeit: p.betreuung_seit,
          agentId: p.assigned_agent_id, agentName: p.agent_name,
          betreuerName: p.betreuer_name,
          letzterKontakt: p.letzter_kontakt,
          produkt: p.pack_name ? String(p.pack_name).split("\n")[0].trim() : null,
          betrag: p.amount_due != null ? Math.round(Number(p.amount_due) * 100) : null,
          ref: p.ref,
        };
      }),
    });
  } catch (err) {
    console.error("[FIAON-VERTRIEB] personen:", err);
    res.status(500).json({ ok: false, error: "Serverfehler" });
  }
});

// ───────────────────────────────────────────────────────────────────────────
// POST /agent/vertrieb/zuweisen — einzeln oder mehrfach
// ───────────────────────────────────────────────────────────────────────────
router.post("/agent/vertrieb/zuweisen", requireAgent, nurLeitung, nurMitZusage, async (req: AgentRequest, res: Response) => {
  try {
    const ids = Array.isArray(req.body?.personIds)
      ? req.body.personIds.map((n: any) => Number(n)).filter((n: number) => Number.isInteger(n) && n > 0)
      : [];
    const zielAgent = req.body?.agentId === null ? null : Number(req.body?.agentId) || null;
    if (ids.length === 0) return res.status(400).json({ ok: false, error: "Keine Person ausgewählt" });
    if (ids.length > 200) return res.status(400).json({ ok: false, error: "Höchstens 200 Personen auf einmal" });

    if (zielAgent) {
      const [ag] = await sqlPool`
        SELECT id, name FROM fiaon_agents WHERE id = ${zielAgent} AND active AND NOT COALESCE(is_test_account, FALSE)
      `;
      if (!ag) return res.status(400).json({ ok: false, error: "Dieser Mitarbeiter ist nicht aktiv" });
    }

    let geaendert = 0;
    for (const id of ids) {
      const [vorher] = await sqlPool`
        SELECT assigned_agent_id, betreuung_seit FROM fiaon_persons
        WHERE id = ${id} AND merged_into_person_id IS NULL
      `;
      if (!vorher) continue;
      if (Number(vorher.assigned_agent_id || 0) === Number(zielAgent || 0)) continue;

      await sqlPool.begin(async (tx) => {
        // Grund und Akteur für den Protokoll-Trigger (Migration 033).
        await tx`SELECT set_config('fiaon.reason', 'vertriebsleitung', true)`;
        await tx`SELECT set_config('fiaon.actor', ${`vertriebsleiter:${req.agent!.id}`}, true)`;
        await tx`
          UPDATE fiaon_persons SET assigned_agent_id = ${zielAgent}, updated_at = NOW()
          WHERE id = ${id}
        `;
        // ── UND DIE BESTELLUNGEN MIT (05.08.2026) ──────────────────────────
        // Die Zuständigkeit stand bisher an zwei Stellen: an der Person und an
        // jeder Bestellung. Wo beide auseinanderliefen, war derselbe Kunde auf
        // einer Seite da und auf der anderen weg — gemessen 24 Fälle, gemeldet
        // als „teilweise sind Kunden in Heute, aber nicht in Meine Kunden".
        // Schlimmer noch: Das Altmodell der Provision liest die BESTELLUNG. Eine
        // Zuweisung, die sie nicht mitzieht, verschiebt die Arbeit, aber nicht
        // die Grundlage der Abrechnung.
        await tx`
          UPDATE fiaon_applications SET assigned_agent_id = ${zielAgent}, updated_at = NOW()
          WHERE person_id = ${id} AND merged_into IS NULL
        `;
      });
      await protokoll(req.agent!.id, "vertrieb_zuweisung", {
        person_id: id, von_agent: vorher.assigned_agent_id, nach_agent: zielAgent,
        war_betreut: !!vorher.betreuung_seit,
      }, zielAgent);
      geaendert++;
    }
    res.json({
      ok: true, geaendert,
      meldung: zielAgent
        ? `${geaendert} Kunde(n) zugewiesen. Der Provisionsanspruch bleibt beim dokumentierten Betreuer.`
        : `${geaendert} Kunde(n) aus der Zuweisung genommen.`,
    });
  } catch (err) {
    console.error("[FIAON-VERTRIEB] zuweisen:", err);
    res.status(500).json({ ok: false, error: "Serverfehler" });
  }
});

// ───────────────────────────────────────────────────────────────────────────
// PATCH /agent/vertrieb/person/:id — Stammdaten korrigieren
// ───────────────────────────────────────────────────────────────────────────
const STAMM_FELDER = ["first_name", "last_name", "company_name", "primary_email", "primary_phone", "street", "zip", "city"] as const;

router.patch("/agent/vertrieb/person/:id", requireAgent, nurLeitung, nurMitZusage, async (req: AgentRequest, res: Response) => {
  try {
    const id = Number(req.params.id);
    const [vorher] = await sqlPool`SELECT * FROM fiaon_persons WHERE id = ${id} AND merged_into_person_id IS NULL`;
    if (!vorher) return res.status(404).json({ ok: false, error: "Kunde nicht gefunden" });

    const aenderungen: Record<string, { alt: any; neu: any }> = {};
    for (const feld of STAMM_FELDER) {
      if (req.body?.[feld] === undefined) continue;
      const neu = String(req.body[feld] ?? "").trim() || null;
      if (String(vorher[feld] ?? "") === String(neu ?? "")) continue;
      aenderungen[feld] = { alt: vorher[feld], neu };
    }
    if (Object.keys(aenderungen).length === 0) {
      return res.json({ ok: true, geaendert: 0, meldung: "Keine Änderung." });
    }

    for (const [feld, wert] of Object.entries(aenderungen)) {
      await sqlPool.unsafe(
        `UPDATE fiaon_persons SET ${feld} = $1, updated_at = NOW() WHERE id = $2`,
        [wert.neu, id],
      );
    }
    // Alt UND neu ins Protokoll — eine Änderung ohne den alten Wert ist nicht
    // nachvollziehbar, sondern nur eine Behauptung.
    await protokoll(req.agent!.id, "vertrieb_stammdaten", { person_id: id, aenderungen });
    res.json({ ok: true, geaendert: Object.keys(aenderungen).length, aenderungen });
  } catch (err) {
    console.error("[FIAON-VERTRIEB] stammdaten:", err);
    res.status(500).json({ ok: false, error: "Serverfehler" });
  }
});

// ───────────────────────────────────────────────────────────────────────────
// POST /agent/vertrieb/person/:id/ergebnis — dokumentieren wie ein Agent
// ───────────────────────────────────────────────────────────────────────────
router.post("/agent/vertrieb/person/:id/ergebnis", requireAgent, nurLeitung, nurMitZusage, async (req: AgentRequest, res: Response) => {
  try {
    const id = Number(req.params.id);
    const art = String(req.body?.art || "");
    if (!istErgebnis(art)) {
      return res.status(400).json({ ok: false, error: `Unbekanntes Ergebnis. Erlaubt: ${ERGEBNISSE.join(", ")}` });
    }
    const [ref] = await sqlPool`
      SELECT a.ref FROM fiaon_applications a
      WHERE a.person_id = ${id} AND a.merged_into IS NULL
      ORDER BY a.created_at DESC LIMIT 1
    `;
    if (!ref?.ref) return res.status(400).json({ ok: false, error: "Keine Bestellung, an der der Verlauf hängen könnte" });

    await sqlPool`
      INSERT INTO fiaon_contact_log (ref, agent_id, agent_name, type, outcome, note, promised_date, scheduled_at, created_at)
      VALUES (${ref.ref}, ${req.agent!.id}, ${`${req.agent!.name} (Vertriebsleitung)`}, 'result', ${art},
              ${req.body?.notiz ? String(req.body.notiz).slice(0, 4000) : null},
              ${req.body?.zusageDatum || null}, ${req.body?.terminDatum || null}, NOW())
    `;
    const wirkung = await ergebnisAnwenden({
      ref: ref.ref, personId: id, ergebnis: art,
      zusageDatum: req.body?.zusageDatum || null,
      terminDatum: req.body?.terminDatum || null,
    });
    // „Anrufer blockiert" bedeutet überall dasselbe: Der Kunde wechselt den
    // Betreuer. Täte es das hier nicht, hätte dasselbe Wort in zwei Ansichten
    // zwei Bedeutungen — und die Vertriebsleitung müsste von Hand nachziehen,
    // was der Agent mit einem Klick bekommt.
    let uebergabe: { ok: boolean; an: string | null; grund: string } | undefined;
    if (art === "nummer_blockiert") {
      const { uebergabeAnNaechsten } = await import("../lib/fiaon-uebergabe");
      const u = await uebergabeAnNaechsten(id, req.agent!.id, `${req.agent!.name} (Vertriebsleitung)`);
      uebergabe = { ok: u.ok, an: u.neuerAgentName, grund: u.grund };
    }
    await protokoll(req.agent!.id, "vertrieb_ergebnis", { person_id: id, ergebnis: art, wirkung, uebergabe });
    res.json({
      ok: true, wirkung, uebergabe,
      meldung: uebergabe
        ? (uebergabe.ok ? `Übergeben an ${uebergabe.an}. ${uebergabe.grund}` : uebergabe.grund)
        : wirkung.meldung,
    });
  } catch (err) {
    console.error("[FIAON-VERTRIEB] ergebnis:", err);
    res.status(500).json({ ok: false, error: "Serverfehler" });
  }
});

// ───────────────────────────────────────────────────────────────────────────
// POST /agent/vertrieb/person/:id/sperre — sperren / entsperren
// ───────────────────────────────────────────────────────────────────────────
router.post("/agent/vertrieb/person/:id/sperre", requireAgent, nurLeitung, nurMitZusage, async (req: AgentRequest, res: Response) => {
  try {
    const id = Number(req.params.id);
    const sperren = req.body?.sperren !== false;
    // `merged_into_person_id IS NULL` fehlte hier: Eine zusammengeführte Person
    // ließ sich noch sperren und entsperren — eine Änderung an einem Wegweiser,
    // die niemand mehr sieht, während der echte Kunde unberührt bleibt.
    const [vorher] = await sqlPool`
      SELECT is_blocked FROM fiaon_persons WHERE id = ${id} AND merged_into_person_id IS NULL
    `;
    if (!vorher) return res.status(404).json({ ok: false, error: "Kunde nicht gefunden" });
    await sqlPool`
      UPDATE fiaon_persons
      SET is_blocked = ${sperren}, follow_up_date = ${sperren ? null : sqlPool`follow_up_date`}, updated_at = NOW()
      WHERE id = ${id}
    `;
    await protokoll(req.agent!.id, "vertrieb_sperre", { person_id: id, alt: vorher.is_blocked, neu: sperren });
    res.json({
      ok: true,
      meldung: sperren ? "Gesperrt — erscheint in keiner Anrufliste mehr." : "Entsperrt — erscheint wieder in der Liste.",
    });
  } catch (err) {
    console.error("[FIAON-VERTRIEB] sperre:", err);
    res.status(500).json({ ok: false, error: "Serverfehler" });
  }
});

// ───────────────────────────────────────────────────────────────────────────
// GET /agent/vertrieb/person/:id — die Akte
// ───────────────────────────────────────────────────────────────────────────
router.get("/agent/vertrieb/person/:id", requireAgent, nurLeitung, nurMitZusage, async (req: AgentRequest, res: Response) => {
  try {
    const id = Number(req.params.id);
    const [p] = await sqlPool.unsafe(`
      SELECT p.*, ${NAME_SQL} AS anzeige_name, ag.name AS agent_name
      FROM fiaon_persons p LEFT JOIN fiaon_agents ag ON ag.id = p.assigned_agent_id
      WHERE p.id = $1 AND p.merged_into_person_id IS NULL`, [id]);
    if (!p) return res.status(404).json({ ok: false, error: "Kunde nicht gefunden" });

    const bestellungen = await sqlPool`
      SELECT a.ref, a.payment_reference, a.payment_status, a.pack_name, a.amount_due,
             a.created_at, a.completed_at, a.promised_pay_date, a.invoice_number,
             ag.name AS agent_name
      FROM fiaon_applications a
      LEFT JOIN fiaon_agents ag ON ag.id = a.assigned_agent_id
      WHERE a.person_id = ${id} ORDER BY a.created_at DESC
    `;
    const verlauf = await sqlPool`
      SELECT cl.created_at, cl.agent_name, cl.type, cl.outcome, cl.note, cl.scheduled_at, cl.promised_date, cl.ref
      FROM fiaon_contact_log cl
      JOIN fiaon_applications a ON a.ref = cl.ref
      WHERE a.person_id = ${id} AND cl.voided_at IS NULL
      ORDER BY cl.created_at DESC LIMIT 100
    `;
    const zuweisungen = await sqlPool`
      SELECT e.created_at, e.from_agent_id, e.to_agent_id, e.reason, e.actor,
             vf.name AS von_name, vt.name AS nach_name
      FROM fiaon_agent_events e
      LEFT JOIN fiaon_agents vf ON vf.id = e.from_agent_id
      LEFT JOIN fiaon_agents vt ON vt.id = e.to_agent_id
      WHERE e.type IN ('person_owner_changed', 'vertrieb_zuweisung')
        AND e.meta LIKE ${`%"person_id" : ${id}%`} OR e.meta LIKE ${`%"person_id":${id}%`}
      ORDER BY e.created_at DESC LIMIT 40
    `.catch(() => [] as any[]);

    const tel = waehlbareNummer([{ nummer: p.primary_phone }], p.country);
    res.json({
      ok: true,
      person: {
        personId: p.id, name: p.anzeige_name,
        vorname: p.first_name, nachname: p.last_name, firma: p.company_name,
        email: p.primary_email, telefon: tel.anzeige, telefonWaehlbar: tel.waehlbar,
        strasse: p.street, plz: p.zip, ort: p.city, land: p.country,
        geburtsdatum: p.birthdate,
        tier: p.priority_tier, tierGrund: p.tier_reason,
        zusagedatum: p.promised_payment_date, wiedervorlage: p.follow_up_date,
        nichtErreicht: p.unreachable_count, rechnungVersandt: p.invoice_sent_count,
        gesperrt: p.is_blocked, betreutSeit: p.betreuung_seit,
        agentId: p.assigned_agent_id, agentName: p.agent_name,
      },
      bestellungen, verlauf, zuweisungen,
    });
  } catch (err) {
    console.error("[FIAON-VERTRIEB] akte:", err);
    res.status(500).json({ ok: false, error: "Serverfehler" });
  }
});

/** Zahlungsdaten senden — nutzt denselben Weg wie der Agent. */
router.post("/agent/vertrieb/person/:id/zahlungsdaten", requireAgent, nurLeitung, nurMitZusage, async (req: AgentRequest, res: Response) => {
  try {
    const id = Number(req.params.id);
    const { zahlungsdatenSenden } = await import("./fiaon-agent-kunden");
    const erg = await zahlungsdatenSenden(id, req.agent!.id, `${req.agent!.name} (Vertriebsleitung)`);
    if (!erg.ok) return res.status(erg.status || 400).json({ ok: false, error: erg.error });
    await protokoll(req.agent!.id, "vertrieb_zahlungsdaten", { person_id: id, empfaenger: erg.empfaenger });
    res.json({ ok: true, versandtAn: erg.empfaenger, warnung: erg.warnung });
  } catch (err) {
    console.error("[FIAON-VERTRIEB] zahlungsdaten:", err);
    res.status(500).json({ ok: false, error: "Serverfehler" });
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// SERVICE-RECHTE (06.08.2026)
//
// Gemeldet: „Damit ich Vertrieblern bei Fragen und kleineren Kundenproblemen
// direkt helfen kann, ohne dass alles bei dir landet."
//
// Vier Dinge kommen täglich: Ist das Geld da? Welche Unterlagen fehlen? Warum
// kommt der Kunde nicht ins Konto? Und was liegt insgesamt offen?
//
// Die Buchung einer Zahlung ist die schwerste Befugnis in diesem System — sie
// schaltet ein Konto frei, löst eine Kundenmail aus, legt eine Ratenkette an und
// bucht eine Provision. Deshalb gilt hier:
//
//   1. EINE Buchung, kein Nachbau: `alsBezahltBuchen` aus fiaon-antrag.ts,
//      dieselbe Funktion, die der Betreiber benutzt.
//   2. BELEGPFLICHT. Ohne benannten Nachweis (Bankeingang oder Überweisungsbeleg)
//      und ohne echtes Eingangsdatum geht es nicht. Ein Klick „ist bezahlt" ohne
//      Grund wäre eine Einladung, Provision auf Verdacht zu erzeugen.
//   3. NACHVOLLZIEHBARKEIT. Wer, wann, mit welchem Beleg — in
//      `fiaon_agent_events` UND im Kundenverlauf, damit es der Betreiber in der
//      Zahlungszentrale sieht, ohne suchen zu müssen.
//   4. KEINE RÜCKNAHME. Storno, Rückerstattung und Reaktivierung bleiben beim
//      Betreiber. Wer buchen darf, darf nicht auch spurlos zurückbuchen.
// ═══════════════════════════════════════════════════════════════════════════

router.get("/agent/vertrieb/service", requireAgent, nurLeitung, nurMitZusage, async (_req: AgentRequest, res: Response) => {
  try {
    const { serviceZahlen } = await import("../lib/fiaon-kundenlage");
    const { kandidatenZahlen } = await import("../lib/fiaon-dubletten-kandidaten");
    const zahlen = await serviceZahlen();
    // Dubletten-Kandidaten als fünfte Kopfzahl. Die Suche läuft über den ganzen
    // Bestand, darf aber die vier Zahlen nicht aufhalten, wenn sie klemmt.
    const dubletten = await kandidatenZahlen().catch(() => ({ gesamt: 0, jeStufe: null }));
    res.json({ ok: true, zahlen: { ...zahlen, dubletten: dubletten.gesamt, dublettenStufen: dubletten.jeStufe } });
  } catch (err) {
    console.error("[FIAON-VERTRIEB] service:", err);
    res.status(500).json({ ok: false, error: "Serverfehler" });
  }
});

/** Offene Zahlungen. `bankeingang` zeigt die Fälle, in denen das Geld belegt ist. */
router.get("/agent/vertrieb/zahlungen", requireAgent, nurLeitung, nurMitZusage, async (req: AgentRequest, res: Response) => {
  try {
    const { offeneZahlungen } = await import("../lib/fiaon-kundenlage");
    const rows = await offeneZahlungen(String(req.query.filter || "alle"), String(req.query.q || ""));
    res.json({
      ok: true,
      anzahl: rows.length,
      zahlungen: rows.map((r: any) => ({
        ref: r.ref,
        personId: r.person_id == null ? null : Number(r.person_id),
        name: r.name,
        email: r.email,
        verwendungszweck: r.payment_reference,
        status: r.payment_status,
        betragCent: r.amount_due != null ? Math.round(Number(r.amount_due) * 100) : null,
        frist: r.payment_due_date,
        zusagedatum: r.promised_payment_date,
        paket: r.pack_name ? String(r.pack_name).split("\n")[0].trim() : null,
        agentName: r.agent_name,
        letzterKontakt: r.letzter_kontakt,
        bankTreffer: Number(r.bank_treffer || 0),
      })),
    });
  } catch (err) {
    console.error("[FIAON-VERTRIEB] zahlungen:", err);
    res.status(500).json({ ok: false, error: "Serverfehler" });
  }
});

/** Die Lage EINES Kunden: Zahlung mit Bankeingängen, Dokumente, Zugang. */
router.get("/agent/vertrieb/person/:id/lage", requireAgent, nurLeitung, nurMitZusage, async (req: AgentRequest, res: Response) => {
  try {
    const id = Number(req.params.id);
    const [p] = await sqlPool`
      SELECT id, primary_email,
             (SELECT COALESCE(NULLIF(a.email,''), NULLIF(a.contact_email,''), NULLIF(a.billing_email,''))
                FROM fiaon_applications a WHERE a.person_id = p.id AND a.merged_into IS NULL
                ORDER BY a.created_at DESC LIMIT 1) AS app_email
      FROM fiaon_persons p WHERE p.id = ${id} AND p.merged_into_person_id IS NULL
    `;
    if (!p) return res.status(404).json({ ok: false, error: "Kunde nicht gefunden" });
    const { zahlungsLage, dokumentLage, zugangsLage } = await import("../lib/fiaon-kundenlage");
    const [zahlung, dokumente, zugang] = await Promise.all([
      zahlungsLage(id),
      dokumentLage(id),
      zugangsLage(p.primary_email || p.app_email || ""),
    ]);
    res.json({ ok: true, zahlung, dokumente, zugang });
  } catch (err) {
    console.error("[FIAON-VERTRIEB] lage:", err);
    res.status(500).json({ ok: false, error: "Serverfehler" });
  }
});

/** Bezahlte Kunden mit fehlenden Unterlagen. */
router.get("/agent/vertrieb/dokumente", requireAgent, nurLeitung, nurMitZusage, async (req: AgentRequest, res: Response) => {
  try {
    const { fehlendeDokumente } = await import("../lib/fiaon-kundenlage");
    const rows = await fehlendeDokumente(String(req.query.q || ""));
    res.json({
      ok: true,
      anzahl: rows.length,
      kunden: rows.map((r: any) => ({
        ref: r.ref,
        personId: r.person_id == null ? null : Number(r.person_id),
        name: r.name, email: r.email,
        paket: r.pack_name ? String(r.pack_name).split("\n")[0].trim() : null,
        kycStatus: r.kyc_status,
        bezahltAm: r.completed_at,
        profilFertigAm: r.profile_completed_at,
        agentName: r.agent_name,
        // Inhalte gibt es hier nicht — nur, was fehlt. Ein Ausweisscan ist das
        // sensibelste Dokument im Bestand; für „was fehlt noch?" braucht ihn
        // niemand zu sehen.
        fehlt: [r.ausweis_fehlt ? "Ausweis" : null, r.auszug_fehlt ? "Kontoauszug" : null].filter(Boolean),
      })),
    });
  } catch (err) {
    console.error("[FIAON-VERTRIEB] dokumente:", err);
    res.status(500).json({ ok: false, error: "Serverfehler" });
  }
});

/** Bezahlte Kunden, die nicht in ihr Konto kommen — mit echtem Login-Urteil. */
router.get("/agent/vertrieb/zugang", requireAgent, nurLeitung, nurMitZusage, async (req: AgentRequest, res: Response) => {
  try {
    const { zugangsProbleme } = await import("../lib/fiaon-kundenlage");
    const kunden = await zugangsProbleme(String(req.query.q || ""));
    res.json({ ok: true, anzahl: kunden.length, kunden });
  } catch (err) {
    console.error("[FIAON-VERTRIEB] zugang:", err);
    res.status(500).json({ ok: false, error: "Serverfehler" });
  }
});

/**
 * Zahlung buchen — mit Beleg, oder gar nicht.
 *
 * `beleg.art`:
 *   bankeingang  Ein Eingang im Bankbestand, dessen Verwendungszweck passt.
 *                Die Referenz wird SERVERSEITIG gegengeprüft; eine ID allein
 *                genügt nicht, sonst wäre der „Beleg" eine Behauptung.
 *   beleg        Der Kunde hat einen Überweisungsbeleg gezeigt. Dann ist eine
 *                Beschreibung Pflicht (was war zu sehen: Datum, Betrag, Empfänger).
 */
router.post("/agent/vertrieb/zahlung/:paymentRef/bezahlt", requireAgent, nurLeitung, nurMitZusage, async (req: AgentRequest, res: Response) => {
  try {
    const paymentRef = String(req.params.paymentRef);
    const art = String(req.body?.belegArt || "");
    const notiz = String(req.body?.notiz || "").trim();
    const zahlungsdatum = String(req.body?.zahlungsdatum || "").trim();
    const bankId = req.body?.bankeingangId ? Number(req.body.bankeingangId) : null;

    if (!["bankeingang", "beleg"].includes(art)) {
      return res.status(400).json({ ok: false, error: "Bitte angeben, worauf sich die Buchung stützt: Bankeingang oder Überweisungsbeleg." });
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(zahlungsdatum)) {
      return res.status(400).json({ ok: false, error: "Bitte das tatsächliche Datum des Geldeingangs angeben (JJJJ-MM-TT)." });
    }
    if (notiz.length < 10) {
      return res.status(400).json({
        ok: false,
        error: "Bitte in einem Satz festhalten, was du geprüft hast — das ist der Nachweis für diese Buchung.",
      });
    }

    const [app] = await sqlPool`
      SELECT ref, payment_reference, payment_status, amount_due, person_id
      FROM fiaon_applications WHERE payment_reference = ${paymentRef} AND merged_into IS NULL
    `;
    if (!app) return res.status(404).json({ ok: false, error: "Bestellung nicht gefunden" });
    if (app.payment_status === "paid") {
      return res.status(400).json({ ok: false, error: "Diese Bestellung ist bereits als bezahlt gebucht." });
    }

    // Beim Bankeingang wird der Beleg GEPRÜFT, nicht geglaubt.
    let bank: any = null;
    if (art === "bankeingang") {
      if (!bankId) return res.status(400).json({ ok: false, error: "Bitte den Bankeingang auswählen." });
      [bank] = await sqlPool`
        SELECT id, amount_cents, reference_raw, extracted_ref, matched_ref, payer_name, booked_at, applied
        FROM fiaon_bank_txns WHERE id = ${bankId}
      `;
      if (!bank) return res.status(400).json({ ok: false, error: "Bankeingang nicht gefunden." });
      const zweck = `${bank.reference_raw || ""} ${bank.extracted_ref || ""} ${bank.matched_ref || ""}`.toUpperCase();
      const passt = zweck.includes(String(app.payment_reference || "\u0000").toUpperCase())
        || String(bank.matched_ref || "").toUpperCase() === String(app.ref).toUpperCase();
      if (!passt) {
        return res.status(400).json({
          ok: false,
          error: `Der Verwendungszweck dieses Eingangs nennt nicht ${app.payment_reference}. `
            + `Wenn du trotzdem sicher bist, dass das Geld zu dieser Bestellung gehört, buche über „Überweisungsbeleg" und `
            + `beschreibe im Nachweis, woran du es erkannt hast.`,
        });
      }
    }

    const { alsBezahltBuchen } = await import("./fiaon-antrag");
    const wirkung = await alsBezahltBuchen(paymentRef, {
      zahlungsdatum,
      quelle: `vertriebsleiter:${req.agent!.id}`,
    });
    if (!wirkung.ok) return res.status(wirkung.status).json({ ok: false, error: wirkung.error });

    if (bank) {
      // Den Bankeingang als verbucht markieren, damit er nicht ein zweites Mal
      // als „offen" vorgeschlagen wird.
      await sqlPool`
        UPDATE fiaon_bank_txns
        SET applied = TRUE, applied_at = NOW(), matched_ref = COALESCE(matched_ref, ${app.ref}),
            match_status = 'manual',
            note = CONCAT_WS(' | ', note, ${`Vertriebsleitung ${req.agent!.name}: ${notiz}`}), updated_at = NOW()
        WHERE id = ${bank.id}
      `.catch((e) => console.error("[FIAON-VERTRIEB] Bankeingang markieren:", e));
    }

    const beleg = {
      art,
      notiz,
      zahlungsdatum,
      bankeingang: bank ? { id: Number(bank.id), betragCent: Number(bank.amount_cents), verwendungszweck: bank.reference_raw } : null,
      betragCent: app.amount_due != null ? Math.round(Number(app.amount_due) * 100) : null,
    };
    await protokoll(req.agent!.id, "vertrieb_zahlung_gebucht", { ref: app.ref, payment_reference: paymentRef, beleg });

    // Auch in den Kundenverlauf — dort sucht der Betreiber, wenn er später fragt,
    // warum diese Bestellung bezahlt ist.
    await sqlPool`
      INSERT INTO fiaon_contact_log (ref, agent_id, agent_name, type, outcome, note, created_at)
      VALUES (${app.ref}, ${req.agent!.id}, ${`${req.agent!.name} (Vertriebsleitung)`}, 'note', NULL,
              ${`Zahlung gebucht (Eingang ${zahlungsdatum}, Nachweis: ${art === "bankeingang" ? "Bankeingang" : "Überweisungsbeleg"}) — ${notiz}`},
              NOW())
    `.catch((e) => console.error("[FIAON-VERTRIEB] Verlaufseintrag:", e));

    // Und in die Diagnose des Betreibers: Eine gebuchte Zahlung ohne Geld auf dem
    // Konto fällt sonst erst beim Kontoabgleich auf — dann ist die Provision längst
    // bestätigt. Diese Zeile ist die Bitte um Gegenkontrolle.
    try {
      const { logDiagnostic } = await import("../lib/fiaon-diagnostics");
      logDiagnostic({
        severity: art === "bankeingang" ? "info" : "warnung",
        category: "zahlung",
        code: "VERTRIEB-BUCHUNG",
        message: `${req.agent!.name} hat ${paymentRef} als bezahlt gebucht (Nachweis: ${art}, Eingang ${zahlungsdatum}).`,
        hint: art === "bankeingang"
          ? "Nachweis war ein Bankeingang mit passendem Verwendungszweck."
          : "Nachweis war ein vom Kunden gezeigter Überweisungsbeleg — bitte beim nächsten Kontoabgleich gegenprüfen.",
        link: "/admin/zahlungen",
      });
    } catch { /* Diagnose darf eine Buchung nie verhindern */ }

    res.json({
      ok: true,
      meldung: `Als bezahlt gebucht. Das Konto ist freigeschaltet, die Bestätigung an den Kunden ist unterwegs.`
        + ` Erste Monatsrate fällig am ${wirkung.naechsteAboFaelligkeit}.`,
      zahlungsdatum: wirkung.zahlungsdatum,
      naechsteAboFaelligkeit: wirkung.naechsteAboFaelligkeit,
    });
  } catch (err) {
    console.error("[FIAON-VERTRIEB] zahlung buchen:", err);
    res.status(500).json({ ok: false, error: "Serverfehler" });
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// FÜNFTER BEREICH: DUBLETTEN
//
// Dieselbe Maschine wie /admin/dubletten — dieselbe Kandidatensuche, dieselbe
// Merge-Funktion, dieselben Protokolle. Nur die Tür ist eine andere
// (nurLeitung + nurMitZusage statt Admin-Code).
//
// Warum die Vertriebsleitung das darf: Sie telefoniert mit den Kunden und ist
// die Einzige, die „Axel Conrad zweimal" tatsächlich beurteilen kann. Ein
// Zusammenschluss ist keine Geldbuchung; er verschiebt keine Provision und
// beendet keine Bestellung. Was er anfasst — die Zuständigkeit —, verlangt bei
// zwei verschiedenen Betreuern ohnehin eine ausdrückliche, protokollierte Wahl.
//
// ARCHIVIEREN ja, WIEDERHERSTELLEN nein: Zurückholen bleibt beim Betreiber.
// ═══════════════════════════════════════════════════════════════════════════

/** Klartext-Akteur für alle Protokolle dieses Bereichs. */
const alsAkteur = (req: AgentRequest) => ({
  name: `${req.agent!.name} (Vertriebsleitung)`,
  agentId: req.agent!.id,
});

router.get("/agent/vertrieb/dubletten", requireAgent, nurLeitung, nurMitZusage, async (req: AgentRequest, res: Response) => {
  try {
    const { findeKandidaten, kandidatenZahlen, STUFE_TEXT } = await import("../lib/fiaon-dubletten-kandidaten");
    const stufen = req.query.stufe ? String(req.query.stufe).split(",").filter(Boolean) : undefined;
    const kandidaten = await findeKandidaten({ stufen: stufen as any, grenze: 200 });
    res.json({ ok: true, kandidaten, zahlen: await kandidatenZahlen(), stufenText: STUFE_TEXT });
  } catch (err) {
    console.error("[FIAON-VERTRIEB] dubletten:", err);
    res.status(500).json({ ok: false, error: "Serverfehler" });
  }
});

router.get("/agent/vertrieb/dubletten/paar/:a/:b", requireAgent, nurLeitung, nurMitZusage, async (req: AgentRequest, res: Response) => {
  try {
    const { gegenueberstellung } = await import("../lib/fiaon-dubletten-kandidaten");
    const daten = await gegenueberstellung(Number(req.params.a), Number(req.params.b));
    if (!daten) return res.status(404).json({ ok: false, error: "Paar nicht gefunden" });
    res.json({ ok: true, ...daten });
  } catch (err) {
    console.error("[FIAON-VERTRIEB] dubletten paar:", err);
    res.status(500).json({ ok: false, error: "Serverfehler" });
  }
});

router.post("/agent/vertrieb/dubletten/zusammenfuehren", requireAgent, nurLeitung, nurMitZusage, async (req: AgentRequest, res: Response) => {
  const { fuehreMergeAus } = await import("./fiaon-dubletten");
  const { status, antwort } = await fuehreMergeAus(req.body, alsAkteur(req));
  res.status(status).json(antwort);
});

router.post("/agent/vertrieb/dubletten/keine-dublette", requireAgent, nurLeitung, nurMitZusage, async (req: AgentRequest, res: Response) => {
  const { merkeKeineDublette } = await import("./fiaon-dubletten");
  const { status, antwort } = await merkeKeineDublette(req.body, alsAkteur(req));
  res.status(status).json(antwort);
});

// ── Archiv: die Vertriebsleitung darf archivieren, nicht zurückholen ──────
router.get("/agent/vertrieb/antrag/:ref/archiv-pruefung", requireAgent, nurLeitung, nurMitZusage, async (req: AgentRequest, res: Response) => {
  try {
    const { archivPruefung, ARCHIV_GRUENDE } = await import("../lib/fiaon-antrag-archiv");
    const pruefung = await archivPruefung(String(req.params.ref));
    if (!pruefung) return res.status(404).json({ ok: false, error: "Bestellung nicht gefunden" });
    res.json({ ok: true, pruefung, gruende: ARCHIV_GRUENDE });
  } catch (err) {
    console.error("[FIAON-VERTRIEB] archiv-pruefung:", err);
    res.status(500).json({ ok: false, error: "Serverfehler" });
  }
});

router.post("/agent/vertrieb/antrag/:ref/archivieren", requireAgent, nurLeitung, nurMitZusage, async (req: AgentRequest, res: Response) => {
  const { fuehreArchivierungAus } = await import("./fiaon-dubletten");
  const { status, antwort } = await fuehreArchivierungAus(
    String(req.params.ref), req.body, { ...alsAkteur(req), rolle: "leitung" },
  );
  res.status(status).json(antwort);
});

/** Offene Meldungen „Als Testeintrag melden" aus der Agentenliste. */
router.get("/agent/vertrieb/testeintrag-meldungen", requireAgent, nurLeitung, nurMitZusage, async (_req: AgentRequest, res: Response) => {
  try {
    const rows = await sqlPool`
      SELECT v.id, v.ref, v.text, v.autor_name, v.created_at, v.status,
             a.person_id, a.payment_status, a.archived_at,
             COALESCE(NULLIF(TRIM(CONCAT_WS(' ', a.first_name, a.last_name)), ''),
                      NULLIF(TRIM(a.company_name), ''), a.email, a.ref) AS kunde
      FROM fiaon_vermerke v
      LEFT JOIN fiaon_applications a ON a.ref = v.ref
      WHERE v.art = 'aufgabe' AND v.entfernt_am IS NULL AND v.status = 'offen'
        AND v.text LIKE 'Als Testeintrag gemeldet%'
      ORDER BY v.created_at DESC LIMIT 100
    `;
    res.json({ ok: true, meldungen: rows });
  } catch (err) {
    console.error("[FIAON-VERTRIEB] testeintrag-meldungen:", err);
    res.status(500).json({ ok: false, error: "Serverfehler" });
  }
});

export default router;
