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
//   · Zahlungen buchen        → bleibt beim Vorgesetzten
//   · Provisionen ändern      → bleibt beim Vorgesetzten
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
import { aktivitaetSchreiben } from "../lib/fiaon-aktivitaet";
import multer from "multer";
import { sqlPool } from "../lib/db-pool";
import { parseBerlinInput } from "../lib/fiaon-time";
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
 * Leitung ODER Onboarding — und Onboarding nur bei EIGENEM Termin (20.08.2026).
 *
 * ── DER BEFUND ─────────────────────────────────────────────────────────────
 * Onboarding sah „0 Kunden" und kam auch an keine Akte: `nurLeitung` antwortet
 * mit 404. Gemessen: Viktoria Reichert und Rifka Rovcanin haben heute je fünf
 * Startgespräche und konnten die Akte des Menschen nicht öffnen, mit dem sie in
 * zehn Minuten sprechen.
 *
 * ── DIE GRENZE BLEIBT EINE ABFRAGE, KEINE ROLLE ────────────────────────────
 * Ein Onboarder darf NICHT den ganzen Bestand sehen. Er darf die Akte der
 * Menschen sehen, mit denen er einen Termin hat — dieselbe Menge, die seine
 * Arbeitsliste zeigt. Deshalb wird hier die Kennung des Kunden gegen die
 * Termine geprüft, und zwar in der Datenbank.
 *
 * Die Verpflichtungserklärung (`nurMitZusage`) gilt für die Vertriebsleitung:
 * Sie sieht den GESAMTEN Bestand. Onboarding sieht nur seine Terminkunden und
 * braucht sie deshalb nicht — sonst stünde ein Onboarder vor einem Rechtsdokument
 * über eine Befugnis, die er nicht hat.
 */
async function leitungOderOnboarding(req: AgentRequest, res: Response, next: any) {
  if (await istVertriebsleiter(req.agent!.id)) return nurMitZusage(req, res, next);
  const { istOnboarding } = await import("./fiaon-onboarding-bereich");
  if (!(await istOnboarding(req.agent!.id))) {
    return res.status(404).json({ ok: false, error: "Nicht gefunden" });
  }
  const personId = Number(req.params.id);
  if (!Number.isFinite(personId) || personId <= 0) {
    return res.status(400).json({ ok: false, error: "Ungültige Kennung." });
  }
  const [treffer] = (await sqlPool`
    SELECT 1 AS da FROM fiaon_termine
     WHERE person_id = ${personId} AND agent_id = ${Number(req.agent!.id)}
       AND abgesagt_am IS NULL
       AND (beginn AT TIME ZONE 'Europe/Berlin')::date
           >= (NOW() AT TIME ZONE 'Europe/Berlin')::date - INTERVAL '14 days'
     LIMIT 1
  `.catch(() => [] as any[])) as any[];
  if (!treffer) {
    // 403 mit Grund, nicht 404: Der Onboarder DARF wissen, dass es die Akte
    // gibt — ihm fehlt der Termin. Eine 404 ließe ihn glauben, der Kunde sei weg.
    return res.status(403).json({
      ok: false,
      error: "Diese Akte gehört nicht zu einem deiner Startgespräche. Du siehst die "
        + "Akte der Menschen, mit denen du einen Termin hast.",
    });
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
      FROM fiaon_persons p
      WHERE p.merged_into_person_id IS NULL
        -- ── DIESELBE GRUNDMENGE WIE „BESTAND JE MITARBEITER" (22.08.2026, B7) ──
        -- Die Tabelle darunter filtert Prüfstands-Konten heraus, die Kopfzahl
        -- tat es nicht: Die Summe der Zeilen konnte die Kachel per
        -- Konstruktion nie erreichen. Ein Zähler, dem niemand traut, kostet
        -- jeden Tag Vertrauen in die ganze Seite.
        AND p.ist_test_am IS NULL
        AND NOT EXISTS (SELECT 1 FROM fiaon_agents ta
                        WHERE ta.id = p.assigned_agent_id AND COALESCE(ta.is_test_account, FALSE))
    `;
    // Die schweren Befunde der Bestandswache gehören in dieselbe Kopfzeile:
    // „Bezahlt ohne Startgespräch" ist der teuerste Bestand des Hauses, und er
    // stand bisher nur auf /admin/hub — einem Ort, den die Leitung nicht betritt.
    const { bestandPruefen } = await import("../lib/fiaon-bestandswache");
    const befunde = await bestandPruefen().catch(() => [] as any[]);
    const befund = (art: string) => befunde.find((b: any) => b.art === art)?.anzahl ?? 0;
    const agenten = await sqlPool`
      SELECT a.id, a.name, a.rolle,
             COUNT(p.id) FILTER (WHERE p.priority_tier = 1 AND NOT p.is_blocked)::int AS tier1,
             COUNT(p.id) FILTER (WHERE p.priority_tier = 2 AND NOT p.is_blocked)::int AS tier2,
             COUNT(p.id) FILTER (WHERE p.priority_tier = 3 AND NOT p.is_blocked)::int AS tier3,
             COUNT(p.id) FILTER (WHERE p.betreuung_seit IS NOT NULL)::int AS betreut,
             -- ── 24.08.2026: MANDATE GEHÖREN IN DIE LEITUNGSSICHT ──────────
             -- „Betreut" zählt betreuung_seit — das setzt lib/tier.ts bei
             -- JEDEM dokumentierten Ergebnis, auch bei „nicht erreicht"
             -- (§16a). Es ist deshalb KEIN Bestand. Der Bestand des Hauses
             -- sind die Mandate, und genau die zeigt der Mitarbeiter selbst
             -- unter /agent/bestand. GEMESSEN am 24.08.2026: 1678 Personen
             -- mit betreuung_seit gegen 411 echte Mandate.
             COUNT(p.id) FILTER (WHERE p.mandat_seit IS NOT NULL AND NOT p.is_blocked)::int AS mandate
      FROM fiaon_agents a
      -- ── 24.08.2026: DIE KOPFZAHL SCHLOSS PRÜFSTANDS-PERSONEN AUS, DIESE
      -- TABELLE NICHT ──────────────────────────────────────────────────────
      -- Der Kommentar an der Kopfzahl behauptet seit dem 22.08. „dieselbe
      -- Grundmenge wie Bestand je Mitarbeiter". Sie war es nicht: oben steht
      -- ist_test_am IS NULL, hier stand es nicht — die Summe der Zeilen konnte
      -- die Kachel per Konstruktion nie erreichen. GEMESSEN am 24.08.2026:
      -- eine Prüfstands-Person im Bestand von Nikita Boychenko (Konto 13).
      LEFT JOIN fiaon_persons p ON p.assigned_agent_id = a.id
        AND p.merged_into_person_id IS NULL AND p.ist_test_am IS NULL
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
        bezahltOhneOnboarding: befund("bezahlt_ohne_onboarding"),
        bezahltOhneBetreuer: befund("bezahlt_ohne_betreuer"),
      },
      bestandswache: befunde.map((b: any) => ({ art: b.art, anzahl: b.anzahl, gewicht: b.gewicht, klartext: b.klartext })),
      agenten: (agenten as any[]).map((a) => ({
        id: a.id, name: a.name, rolle: a.rolle,
        tier1: a.tier1, tier2: a.tier2, tier3: a.tier3, betreut: a.betreut,
        // Die Mandate — dieselbe Zahl, die der Mitarbeiter selbst unter
        // /agent/bestand sieht (mandat_seit, §16a).
        mandate: a.mandate,
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
// Land und Geburtsdatum seit 22.08.2026 (Scheibe 4) — beide werden wirklich geschrieben, nicht nur „erlaubt".
const STAMM_FELDER = ["first_name", "last_name", "company_name", "primary_email", "primary_phone", "street", "zip", "city", "country", "birthdate"] as const;

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

    // ══════════════════════════════════════════════════════════════════════
    // BERLIN-ZEIT, NICHT UTC
    //
    // ── DER BEFUND (11.08.2026) ───────────────────────────────────────────
    // Ein Agent: „Datum und Uhrzeit verändern sich teilweise beim Speichern.
    // Morgen 10:00 Uhr wird 12:00 Uhr. Heute 20:00 Uhr landet plötzlich am
    // 18.08. um 22:00 Uhr."
    //
    // Gemessen in fiaon_contact_log: Eintrag #8884 steht als
    // „2026-08-18T20:00:00.000Z" — also 20:00 UTC, was in Berlin 22:00 ist.
    // Genau der gemeldete Fall.
    //
    // Hier stand der Rohwert aus dem Formular direkt im INSERT. Ein
    // „2026-08-18T20:00" ohne Zeitzone deutet PostgreSQL bei einer
    // `timestamptz`-Spalte als UTC — nicht als Wandzeit des Nutzers.
    //
    // `parseBerlinInput` (server/lib/fiaon-time.ts) macht genau diese
    // Umrechnung und behandelt auch die Zeitumstellung. `logAction` nutzt sie
    // seit Langem; nur diese Stelle schrieb daran vorbei.
    //
    // AGENTS.md sagt es: „Zeitzone ist Europe/Berlin — über
    // server/lib/fiaon-time.ts, nie über new Date()."
    // ══════════════════════════════════════════════════════════════════════
    await sqlPool`
      INSERT INTO fiaon_contact_log (ref, agent_id, agent_name, type, outcome, note, promised_date, scheduled_at, created_at)
      VALUES (${ref.ref}, ${req.agent!.id}, ${`${req.agent!.name} (Vertriebsleitung)`}, 'result', ${art},
              ${req.body?.notiz ? String(req.body.notiz).slice(0, 4000) : null},
              ${parseBerlinInput(req.body?.zusageDatum)},
              ${parseBerlinInput(req.body?.terminDatum)}, NOW())
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
router.get("/agent/vertrieb/person/:id", requireAgent, leitungOderOnboarding, async (req: AgentRequest, res: Response) => {
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
        -- ══════════════════════════════════════════════════════════════════
        -- DIE KLAMMERN FEHLTEN (behoben 19.08.2026)
        --
        -- Vorher: type IN (…) AND meta LIKE a OR meta LIKE b. In SQL bindet AND
        -- stärker als OR, das ergibt also (type IN … AND a) ODER b — der
        -- zweite Zweig prüfte den Typ NICHT MEHR. Jedes Ereignis mit dieser
        -- Personennummer im Rumpf landete in der Liste „Zuweisungen".
        --
        -- Aufgefallen beim Suchen nach der weißen Akte. Gedeckt war es von
        -- einem catch, das im Fehlerfall eine leere Liste liefert — deshalb
        -- ist es niemandem aufgefallen.
        -- ══════════════════════════════════════════════════════════════════
        AND (e.meta LIKE ${`%"person_id" : ${id}%`} OR e.meta LIKE ${`%"person_id":${id}%`})
      ORDER BY e.created_at DESC LIMIT 40
    `.catch((e) => {
      console.error("[FIAON-VERTRIEB] Zuweisungen konnten nicht geladen werden:", e);
      return [] as any[];
    });

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
    // Die Referenz mitgeben, damit der Server sie gegen die Auflösung prüft:
    // Auch die Vertriebsleitung sieht eine Karte, die nach einem Pakettausch
    // veraltet sein kann (Befund vom 19.08.2026).
    const erg = await zahlungsdatenSenden(id, req.agent!.id, `${req.agent!.name} (Vertriebsleitung)`,
      { ref: req.body?.ref ?? null });
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
//      dieselbe Funktion, die der Vorgesetzte benutzt.
//   2. BELEGPFLICHT. Ohne benannten Nachweis (Bankeingang oder Überweisungsbeleg)
//      und ohne echtes Eingangsdatum geht es nicht. Ein Klick „ist bezahlt" ohne
//      Grund wäre eine Einladung, Provision auf Verdacht zu erzeugen.
//   3. NACHVOLLZIEHBARKEIT. Wer, wann, mit welchem Beleg — in
//      `fiaon_agent_events` UND im Kundenverlauf, damit es der Vorgesetzte in der
//      Zahlungszentrale sieht, ohne suchen zu müssen.
//   4. KEINE RÜCKNAHME. Storno, Rückerstattung und Reaktivierung bleiben beim
//      Vorgesetzter. Wer buchen darf, darf nicht auch spurlos zurückbuchen.
// ═══════════════════════════════════════════════════════════════════════════

router.get("/agent/vertrieb/service", requireAgent, nurLeitung, nurMitZusage, async (_req: AgentRequest, res: Response) => {
  try {
    const { serviceZahlen } = await import("../lib/fiaon-kundenlage");
    const { kandidatenZahlen } = await import("../lib/fiaon-dubletten-kandidaten");
    const zahlen = await serviceZahlen();
    // Dubletten-Kandidaten als fünfte Kopfzahl. Die Suche läuft über den ganzen
    // Bestand, darf aber die vier Zahlen nicht aufhalten, wenn sie klemmt.
    const dubletten = await kandidatenZahlen().catch(() => ({ gesamt: 0, jeStufe: null }));

    // ── Pipeline-Kennzahlen ──────────────────────────────────────────────
    // Der Ruhe-Pool gehört in die Leitungssicht, sonst ist er genau das
    // versteckte Loch, das er nicht sein soll: Der Agent sieht seine eigenen
    // Ruhenden, aber nur hier steht, wie viele es im Haus insgesamt sind.
    const { wiedereinstiegKennzahl } = await import("../lib/fiaon-wiedereinstieg");
    const { ruhtSql } = await import("../lib/fiaon-nicht-erreicht");
    const [ruhe] = (await sqlPool.unsafe(`
      SELECT COUNT(*)::int AS ruhend,
             COUNT(*) FILTER (WHERE p.terminlink_mail_am IS NOT NULL)::int AS terminlink_versandt,
             (SELECT COUNT(*)::int FROM fiaon_termine t WHERE t.status = 'gebucht' AND t.beginn > NOW()) AS termine_offen
      FROM fiaon_persons p
      WHERE p.merged_into_person_id IS NULL AND ${ruhtSql("p")}
    `)) as any[];
    const wiedereinstieg = await wiedereinstiegKennzahl().catch(() => null);

    res.json({
      ok: true,
      zahlen: { ...zahlen, dubletten: dubletten.gesamt, dublettenStufen: dubletten.jeStufe },
      pipeline: {
        ruhend: Number(ruhe?.ruhend || 0),
        terminlinkVersandt: Number(ruhe?.terminlink_versandt || 0),
        termineOffen: Number(ruhe?.termine_offen || 0),
        wiedereinstieg,
      },
    });
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
        // Der hinterlegte Beleg steht in der Liste NEBEN dem Bankeingang — wer
        // bucht, sieht beides ohne Umweg über eine WhatsApp-Gruppe.
        beleg: r.beleg_da
          ? {
              vorhanden: true,
              datum: r.payment_proof_date ? new Date(r.payment_proof_date).toISOString().slice(0, 10) : null,
              von: r.payment_proof_by ?? null,
              url: `/api/fiaon/agent/vertrieb/antrag/${encodeURIComponent(String(r.ref))}/zahlungsbeleg`,
            }
          : { vorhanden: false },
      })),
    });
  } catch (err) {
    console.error("[FIAON-VERTRIEB] zahlungen:", err);
    res.status(500).json({ ok: false, error: "Serverfehler" });
  }
});

/** Die Lage EINES Kunden: Zahlung mit Bankeingängen, Dokumente, Zugang. */
// ═══════════════════════════════════════════════════════════════════════════
// POST /agent/vertrieb/person/:id/betreuer — den Provisionsanspruch setzen (E-027)
//
// Justin, 22.08.2026: „Leitung darf Provision setzen." Vorher stand der
// Anspruch ausschließlich in der Kontaktkette; die Leitung SAH den Betreuer
// (Spalte „Betreuer"), konnte ihn aber weder setzen noch korrigieren — für
// jeden Fall (Strauß, Demiroski, Renner) brauchte es Justin.
//
// Regeln: Pflichtbegründung (≥ 10 Zeichen); nur solange für die Bestellung
// nichts ausgezahlt oder angefordert ist; eine bereits gebuchte, noch nicht
// ausgezahlte Provision eines anderen wird storniert und neu gebucht — beides
// mit Spur in Akte, Protokoll und Agenten-Ereignissen.
// ═══════════════════════════════════════════════════════════════════════════
let entscheidSpalten = false;
async function ensureEntscheidSpalten(): Promise<void> {
  if (entscheidSpalten) return;
  await sqlPool`
    ALTER TABLE fiaon_applications
    ADD COLUMN IF NOT EXISTS commission_agent_id INTEGER,
    ADD COLUMN IF NOT EXISTS commission_decided_by VARCHAR,
    ADD COLUMN IF NOT EXISTS commission_decided_note TEXT,
    ADD COLUMN IF NOT EXISTS commission_decided_at TIMESTAMPTZ
  `;
  entscheidSpalten = true;
}

router.post("/agent/vertrieb/person/:id/betreuer", requireAgent, nurLeitung, nurMitZusage, async (req: AgentRequest, res: Response) => {
  try {
    await ensureEntscheidSpalten();
    const id = Number(req.params.id);
    const agentId = Number(req.body?.agentId || 0);
    const grund = String(req.body?.grund || "").trim();
    if (!agentId) return res.status(400).json({ ok: false, error: "Bitte einen Mitarbeiter wählen." });
    if (grund.length < 10) return res.status(400).json({ ok: false, error: "Bitte in einem Satz begründen (mindestens 10 Zeichen) — die Begründung steht dauerhaft am Kunden." });
    const [ziel] = (await sqlPool`SELECT id, name, rolle FROM fiaon_agents WHERE id = ${agentId} AND active AND NOT COALESCE(is_test_account, FALSE)`) as any[];
    if (!ziel) return res.status(404).json({ ok: false, error: "Diesen Mitarbeiter gibt es nicht (mehr)." });

    const bestellungen = (await sqlPool`
      SELECT a.ref, a.payment_status, a.commission_agent_id, a.assigned_agent_id,
             (SELECT COUNT(*)::int FROM fiaon_commissions c WHERE c.ref = a.ref AND c.status IN ('ausgezahlt', 'angefordert')) AS gesperrt,
             (SELECT json_agg(json_build_object('id', c.id, 'agent_id', c.agent_id, 'status', c.status, 'amount_cents', c.amount_cents, 'kind', c.kind))
                FROM fiaon_commissions c WHERE c.ref = a.ref AND c.status NOT IN ('storniert') AND c.amount_cents > 0) AS provisionen
      FROM fiaon_applications a
      WHERE a.person_id = ${id} AND a.merged_into IS NULL AND a.archived_at IS NULL AND a.gdpr_deleted_at IS NULL
      ORDER BY a.created_at DESC`) as any[];
    if (bestellungen.length === 0) return res.status(404).json({ ok: false, error: "Keine Bestellung zu diesem Kunden." });
    if (bestellungen.some((b) => Number(b.gesperrt) > 0)) {
      return res.status(409).json({ ok: false, error: "Für diesen Kunden wurde bereits eine Provision angefordert oder ausgezahlt. Ab hier entscheidet nur der Vorgesetzte (Nachbuchungs-Center)." });
    }

    const vorher = bestellungen.map((b) => ({ ref: b.ref, entscheid: b.commission_agent_id ?? null, provisionen: b.provisionen || [] }));
    await sqlPool`
      UPDATE fiaon_applications
      SET commission_agent_id = ${agentId}, commission_decided_by = ${`Vertriebsleitung ${req.agent!.name}`},
          commission_decided_note = ${grund.slice(0, 500)}, commission_decided_at = NOW(), updated_at = NOW()
      WHERE person_id = ${id} AND merged_into IS NULL AND archived_at IS NULL AND gdpr_deleted_at IS NULL`;

    // Bezahlte Bestellungen: bestehende (nicht ausgezahlte) Provision eines
    // anderen stornieren und nach der neuen Regel buchen.
    const umgebucht: string[] = [];
    for (const b of bestellungen) {
      if (String(b.payment_status) !== "paid") continue;
      const fremd = (b.provisionen || []).filter((c: any) => Number(c.agent_id) !== agentId);
      for (const c of fremd) {
        await sqlPool`UPDATE fiaon_commissions SET status = 'storniert', note = CONCAT_WS(' · ', note, ${`storniert ${new Date().toLocaleDateString("de-DE")}: Anspruch durch Vertriebsleitung ${req.agent!.name} auf ${ziel.name} gesetzt — ${grund.slice(0, 200)}`}), updated_at = NOW() WHERE id = ${Number(c.id)}`.catch(async () =>
          sqlPool`UPDATE fiaon_commissions SET status = 'storniert' WHERE id = ${Number(c.id)}`);
      }
      const eigene = (b.provisionen || []).some((c: any) => Number(c.agent_id) === agentId);
      if (!eigene) {
        try {
          const { onCustomerPaid } = await import("./fiaon-agent");
          await onCustomerPaid(String(b.ref), { forceAgentId: agentId, forceReason: `Vertriebsleitung ${req.agent!.name}: ${grund.slice(0, 200)}` });
          umgebucht.push(String(b.ref));
        } catch (e) { console.error("[FIAON-VERTRIEB] Umbuchung:", e); }
      }
    }

    await protokoll(req.agent!.id, "vertrieb_betreuer_gesetzt", { person_id: id, agent_id: agentId, agent_name: ziel.name, grund, vorher, umgebucht });
    await sqlPool`
      INSERT INTO fiaon_contact_log (person_id, ref, agent_id, agent_name, type, note, created_at)
      VALUES (${id}, ${bestellungen[0].ref}, ${req.agent!.id}, ${req.agent!.name}, 'system',
              ${`Provisionsanspruch durch die Vertriebsleitung auf ${ziel.name} gesetzt. Begründung: ${grund}${umgebucht.length ? ` — umgebucht: ${umgebucht.join(", ")}` : ""}`}, NOW())
    `.catch(() => {});
    res.json({ ok: true, meldung: `Der Anspruch liegt jetzt bei ${ziel.name}.${umgebucht.length ? ` ${umgebucht.length} bezahlte Bestellung(en) umgebucht.` : ""}`, umgebucht });
  } catch (err) {
    console.error("[FIAON-VERTRIEB] betreuer:", err);
    res.status(500).json({ ok: false, error: "Serverfehler" });
  }
});

/**
 * PATCH /agent/vertrieb/person/:id/paket — Paket und Betrag der OFFENEN Bestellung ändern (Scheibe 4).
 * Nach der Zahlung nicht mehr: Dann ist es eine Rückerstattung/Nachbuchung — Vorgesetzter.
 */
router.patch("/agent/vertrieb/person/:id/paket", requireAgent, nurLeitung, nurMitZusage, async (req: AgentRequest, res: Response) => {
  try {
    const id = Number(req.params.id);
    const packKey = String(req.body?.packKey || "");
    const grund = String(req.body?.grund || "").trim();
    const { paket, PAKETE } = await import("@shared/fiaon-pakete");
    const pk = paket(packKey);
    if (!pk || !pk.abo) return res.status(400).json({ ok: false, error: `Unbekanntes Paket. Erlaubt: ${PAKETE.filter((x) => x.abo).map((x) => x.key).join(", ")}` });
    if (grund.length < 5) return res.status(400).json({ ok: false, error: "Bitte kurz begründen — die Änderung steht dauerhaft am Kunden." });
    const [a] = (await sqlPool`
      SELECT ref, pack_key, pack_name, amount_due, payment_status FROM fiaon_applications
      WHERE person_id = ${id} AND merged_into IS NULL AND archived_at IS NULL AND gdpr_deleted_at IS NULL
        AND type IS DISTINCT FROM 'schufa' AND ref NOT LIKE 'FIAON-SCHUFA-%'
      ORDER BY created_at DESC LIMIT 1`) as any[];
    if (!a) return res.status(404).json({ ok: false, error: "Keine Paketbestellung zu diesem Kunden." });
    if (String(a.payment_status) === "paid") return res.status(409).json({ ok: false, error: "Diese Bestellung ist bezahlt. Ein Paketwechsel danach ist eine Rückerstattung oder Nachbuchung — bitte den Vorgesetzten." });
    const { paketNameFuerDaten } = await import("@shared/fiaon-paketname");
    const name = paketNameFuerDaten(pk.key) ?? pk.label;
    const betrag = (pk.preisCents / 100).toFixed(2);
    await sqlPool`UPDATE fiaon_applications SET pack_key = ${pk.key}, pack_name = ${name}, amount_due = ${betrag}, updated_at = NOW() WHERE ref = ${a.ref}`;
    await protokoll(req.agent!.id, "vertrieb_paket_geaendert", { person_id: id, ref: a.ref, alt: { pack_key: a.pack_key, amount_due: a.amount_due }, neu: { pack_key: pk.key, amount_due: betrag }, grund });
    await sqlPool`
      INSERT INTO fiaon_contact_log (person_id, ref, agent_id, agent_name, type, note, created_at)
      VALUES (${id}, ${a.ref}, ${req.agent!.id}, ${req.agent!.name}, 'system',
              ${`Paket geändert: ${a.pack_name || a.pack_key || "—"} (${a.amount_due ?? "?"} €) → ${name} (${betrag} €). Grund: ${grund}. Eine bereits versandte Zahlungsdaten-Mail ist damit veraltet — bitte neu senden.`}, NOW())
    `.catch(() => {});
    res.json({ ok: true, meldung: `Paket auf ${name} (${betrag} €) gesetzt. Bitte die Zahlungsdaten neu senden — die alte Mail nennt den alten Betrag.` });
  } catch (err) {
    console.error("[FIAON-VERTRIEB] paket:", err);
    res.status(500).json({ ok: false, error: "Serverfehler" });
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// GET /agent/vertrieb/bestandswache — die Listen hinter den schweren Befunden
//
// Die Wache (server/lib/fiaon-bestandswache.ts) misst seit dem 21.08.2026,
// wie viele bezahlte Kunden kein Startgespräch haben — und zeigte die Liste
// nur auf /admin/hub. Florentine und Daniel haben dort keinen Zugang (C15).
// Dieselben Bedingungen, hier als Liste für die Menschen, die sie abarbeiten.
// ═══════════════════════════════════════════════════════════════════════════
router.get("/agent/vertrieb/bestandswache", requireAgent, nurLeitung, nurMitZusage, async (req: AgentRequest, res: Response) => {
  try {
    const art = String(req.query.art || "ohne_onboarding");
    const { ONBOARDING_GEDULD_TAGE } = await import("../lib/fiaon-bestandswache");
    const zeilen = art === "ohne_betreuer"
      ? (await sqlPool`
          SELECT p.id AS person_id,
                 COALESCE(NULLIF(TRIM(CONCAT_WS(' ', p.first_name, p.last_name)), ''), p.company_name, p.contact_name, p.primary_email) AS name,
                 p.primary_phone, p.primary_email,
                 (SELECT a.ref FROM fiaon_applications a WHERE a.person_id = p.id AND a.merged_into IS NULL AND a.archived_at IS NULL
                    AND a.payment_status = 'paid' ORDER BY a.paid_at DESC NULLS LAST, a.created_at DESC LIMIT 1) AS ref,
                 (SELECT MIN(a.paid_at) FROM fiaon_applications a WHERE a.person_id = p.id AND a.merged_into IS NULL AND a.payment_status = 'paid') AS bezahlt_am,
                 NULL::text AS zustaendig
          FROM fiaon_persons p
          WHERE p.assigned_agent_id IS NULL AND p.merged_into_person_id IS NULL
            AND p.ist_test_am IS NULL AND NOT COALESCE(p.is_blocked, FALSE)
            AND EXISTS (SELECT 1 FROM fiaon_applications ap WHERE ap.person_id = p.id
              AND ap.merged_into IS NULL AND ap.archived_at IS NULL AND ap.payment_status = 'paid')
          ORDER BY bezahlt_am ASC NULLS LAST LIMIT 300`) as any[]
      : (await sqlPool`
          SELECT p.id AS person_id,
                 COALESCE(NULLIF(TRIM(CONCAT_WS(' ', p.first_name, p.last_name)), ''), p.company_name, p.contact_name, p.primary_email) AS name,
                 p.primary_phone, p.primary_email,
                 ag.name AS zustaendig,
                 (SELECT a.ref FROM fiaon_applications a WHERE a.person_id = p.id AND a.merged_into IS NULL AND a.archived_at IS NULL
                    AND a.payment_status = 'paid' AND NOT (COALESCE(a.type,'') = 'schufa' OR a.ref LIKE 'FIAON-SCHUFA-%')
                    ORDER BY a.paid_at DESC NULLS LAST, a.created_at DESC LIMIT 1) AS ref,
                 (SELECT MIN(a.paid_at) FROM fiaon_applications a WHERE a.person_id = p.id AND a.merged_into IS NULL
                    AND a.payment_status = 'paid' AND NOT (COALESCE(a.type,'') = 'schufa' OR a.ref LIKE 'FIAON-SCHUFA-%')) AS bezahlt_am,
                 (SELECT t.beginn FROM fiaon_termine t WHERE t.person_id = p.id AND t.quelle = 'onboarding_call'
                    AND t.status = 'gebucht' AND t.abgesagt_am IS NULL ORDER BY t.beginn LIMIT 1) AS termin_am,
                 p.startgespraech_mail_am AS eingeladen_am
          FROM fiaon_persons p
          LEFT JOIN fiaon_agents ag ON ag.id = p.assigned_agent_id
          WHERE p.merged_into_person_id IS NULL AND p.ist_test_am IS NULL AND NOT COALESCE(p.is_blocked, FALSE)
            AND EXISTS (SELECT 1 FROM fiaon_applications ap WHERE ap.person_id = p.id
              AND ap.merged_into IS NULL AND ap.archived_at IS NULL AND ap.payment_status = 'paid'
              AND NOT (COALESCE(ap.type,'') = 'schufa' OR ap.ref LIKE 'FIAON-SCHUFA-%'))
            AND NOT EXISTS (SELECT 1 FROM fiaon_termine t WHERE t.person_id = p.id
              AND t.quelle = 'onboarding_call' AND t.status = 'erledigt')
            AND NOT EXISTS (SELECT 1 FROM fiaon_applications ax WHERE ax.person_id = p.id AND ax.merged_into IS NULL
              AND ax.onboarding_pflicht = FALSE AND NULLIF(TRIM(COALESCE(ax.onboarding_ausnahme_grund, '')), '') IS NOT NULL)
          ORDER BY bezahlt_am ASC NULLS LAST LIMIT 300`) as any[];
    const heute = Date.now();
    res.json({
      ok: true, art, geduldTage: ONBOARDING_GEDULD_TAGE,
      zeilen: zeilen.map((z) => ({
        personId: Number(z.person_id), name: z.name, telefon: z.primary_phone, email: z.primary_email,
        ref: z.ref, zustaendig: z.zustaendig ?? null,
        bezahltAm: z.bezahlt_am ?? null,
        tage: z.bezahlt_am ? Math.floor((heute - new Date(z.bezahlt_am).getTime()) / 86_400_000) : null,
        terminAm: z.termin_am ?? null, eingeladenAm: z.eingeladen_am ?? null,
      })),
    });
  } catch (err) {
    console.error("[FIAON-VERTRIEB] bestandswache:", err);
    res.status(500).json({ ok: false, error: "Serverfehler" });
  }
});

/** PATCH /agent/vertrieb/person/:id/karte — den Kartenstatus pflegen (Leitung), protokolliert. */
router.patch("/agent/vertrieb/person/:id/karte", requireAgent, nurLeitung, nurMitZusage, async (req: AgentRequest, res: Response) => {
  try {
    const id = Number(req.params.id);
    const { istKartenStatus, kartenLage, kartenStatusText, ensureKartenSpalten } = await import("../lib/fiaon-kartenstatus");
    await ensureKartenSpalten();
    const status = String(req.body?.status ?? "");
    if (!istKartenStatus(status)) return res.status(400).json({ ok: false, error: "Unbekannter Kartenstatus." });
    const notiz = String(req.body?.notiz ?? "").trim().slice(0, 500) || null;
    const vorher = await kartenLage(id);
    if (!vorher.ref) return res.status(404).json({ ok: false, error: "Dieser Kunde hat keine Paketbestellung — und damit keine Karte." });
    await sqlPool`
      UPDATE fiaon_applications
      SET karten_status = ${status}, karten_status_am = NOW(),
          karten_notiz = COALESCE(${notiz}, karten_notiz), updated_at = NOW()
      WHERE ref = ${vorher.ref}
    `;
    await protokoll(req.agent!.id, "vertrieb_kartenstatus", { person_id: id, ref: vorher.ref, alt: vorher.status, neu: status, notiz });
    await sqlPool`
      INSERT INTO fiaon_contact_log (person_id, ref, agent_id, agent_name, type, note, created_at)
      VALUES (${id}, ${vorher.ref}, ${req.agent!.id}, ${req.agent!.name}, 'system',
              ${`Kartenstatus: ${vorher.status ? kartenStatusText(vorher.status) : "unbekannt"} → ${kartenStatusText(status)}${notiz ? ` (${notiz})` : ""}`}, NOW())
    `.catch(() => {});
    res.json({ ok: true, karte: await kartenLage(id), meldung: `Kartenstatus steht jetzt auf „${kartenStatusText(status)}“.` });
  } catch (err) {
    console.error("[FIAON-VERTRIEB] karte:", err);
    res.status(500).json({ ok: false, error: "Serverfehler" });
  }
});

router.get("/agent/vertrieb/person/:id/lage", requireAgent, leitungOderOnboarding, async (req: AgentRequest, res: Response) => {
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
    const { kartenLage, KARTEN_STATUS } = await import("../lib/fiaon-kartenstatus");
    const [zahlung, dokumente, zugang, karte] = await Promise.all([
      zahlungsLage(id),
      dokumentLage(id),
      zugangsLage(p.primary_email || p.app_email || ""),
      kartenLage(id),
    ]);
    res.json({ ok: true, zahlung, dokumente, zugang, karte, kartenStatusListe: KARTEN_STATUS });
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

    // Liegt ein hinterlegter Beleg vor, verweist die Buchung darauf — statt nur
    // auf eine Beschreibung. Vorher stand im Protokoll „Überweisungsbeleg" und
    // niemand konnte nachsehen, welcher.
    const { belegStand } = await import("../lib/fiaon-zahlungsbeleg");
    const hinterlegt = await belegStand(String(app.ref)).catch(() => null);
    const beleg = {
      art,
      notiz,
      zahlungsdatum,
      bankeingang: bank ? { id: Number(bank.id), betragCent: Number(bank.amount_cents), verwendungszweck: bank.reference_raw } : null,
      betragCent: app.amount_due != null ? Math.round(Number(app.amount_due) * 100) : null,
      hinterlegterBeleg: hinterlegt?.vorhanden
        ? {
            datum: hinterlegt.datum, von: hinterlegt.von, am: hinterlegt.am,
            notiz: hinterlegt.notiz,
            url: `/api/fiaon/agent/vertrieb/antrag/${encodeURIComponent(String(app.ref))}/zahlungsbeleg`,
          }
        : null,
    };
    await protokoll(req.agent!.id, "vertrieb_zahlung_gebucht", { ref: app.ref, payment_reference: paymentRef, beleg });

    // Auch in den Kundenverlauf — dort sucht der Vorgesetzte, wenn er später fragt,
    // warum diese Bestellung bezahlt ist.
    await sqlPool`
      INSERT INTO fiaon_contact_log (ref, agent_id, agent_name, type, outcome, note, created_at)
      VALUES (${app.ref}, ${req.agent!.id}, ${`${req.agent!.name} (Vertriebsleitung)`}, 'note', NULL,
              ${`Zahlung gebucht (Eingang ${zahlungsdatum}, Nachweis: ${art === "bankeingang" ? "Bankeingang" : "Überweisungsbeleg"}${hinterlegt?.vorhanden ? `, hinterlegter Beleg vom ${hinterlegt.datum}` : ""}) — ${notiz}`},
              NOW())
    `.catch((e) => console.error("[FIAON-VERTRIEB] Verlaufseintrag:", e));

    // Und in die Diagnose des Vorgesetzten: Eine gebuchte Zahlung ohne Geld auf dem
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
// ARCHIVIEREN ja, WIEDERHERSTELLEN nein: Zurückholen bleibt beim Vorgesetzten.
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

// ── Zahlungsbeleg: hinterlegen, ansehen (Vertriebsleitung) ────────────────
const belegUploadVertrieb = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

router.post("/agent/vertrieb/antrag/:ref/zahlungsbeleg", requireAgent, nurLeitung, nurMitZusage,
  belegUploadVertrieb.single("beleg"), async (req: AgentRequest, res: Response) => {
    const { fuehreBelegUploadAus } = await import("./fiaon-dubletten");
    const { status, antwort } = await fuehreBelegUploadAus(
      String(req.params.ref), (req as any).file, req.body, alsAkteur(req),
    );
    res.status(status).json(antwort);
  });

router.get("/agent/vertrieb/antrag/:ref/zahlungsbeleg", requireAgent, nurLeitung, nurMitZusage, async (req: AgentRequest, res: Response) => {
  try {
    const { belegDaten } = await import("../lib/fiaon-zahlungsbeleg");
    const beleg = await belegDaten(String(req.params.ref));
    if (!beleg) return res.status(404).json({ ok: false, error: "Kein Beleg hinterlegt" });
    res.setHeader("Content-Type", beleg.typ);
    res.setHeader("Content-Disposition", `inline; filename="${beleg.name.replace(/[^\w.-]/g, "_")}"`);
    res.setHeader("Cache-Control", "private, max-age=60");
    res.send(beleg.daten);
  } catch (err) {
    console.error("[FIAON-VERTRIEB] zahlungsbeleg:", err);
    res.status(500).json({ ok: false, error: "Serverfehler" });
  }
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

// ═══════════════════════════════════════════════════════════════════════════
// DAS COCKPIT: ZAHLUNG BUCHEN UND EINZELLÖSCHUNG
// ═══════════════════════════════════════════════════════════════════════════

/**
 * POST /agent/vertrieb/person/:id/zahlung-gebucht — mit Beleg.
 *
 * ── WARUM EIN BELEGSATZ UND KEIN HÄKCHEN ───────────────────────────────────
 * Diese Aktion schaltet Leistungen frei und erzeugt Provisionen. Wenn später
 * jemand fragt „warum steht der auf bezahlt, ich sehe kein Geld", muss die
 * Antwort in der Akte stehen — und nicht „das hat damals jemand angeklickt".
 */
router.post("/agent/vertrieb/person/:id/zahlung-gebucht", requireAgent, nurLeitung, nurMitZusage,
  async (_req: AgentRequest, res: Response) => {
  // ══════════════════════════════════════════════════════════════════════
  // GESCHLOSSEN (22.08.2026, E-022 / K3)
  //
  // Dieser Weg schrieb `payment_status = 'paid'` als rohes UPDATE und rief
  // die Provisionsbuchung mit `.catch(() => {})` — scheiterte sie, war der
  // Kunde bezahlt und die Provision weg, ohne Meldung. Keine Abo-Kette,
  // keine Bestätigungsmail, `paid_at = NOW()` statt des echten Eingangs.
  // Der geprüfte Weg (Belegpflicht, Bankeingang, Abo-Kette) ist
  // POST /agent/vertrieb/zahlung/:paymentRef/bezahlt — die Akte öffnet jetzt
  // denselben Dialog wie der Reiter „Zahlungen". Die Route bleibt als
  // Wegweiser stehen, damit ein alter Client eine Antwort bekommt.
  // ══════════════════════════════════════════════════════════════════════
  res.status(410).json({
    ok: false,
    error: "Dieser Buchungsweg ist geschlossen. Bitte „Zahlung prüfen und buchen“ in der Akte benutzen — mit Beleg und Eingangsdatum.",
  });
});

/**
 * POST /agent/vertrieb/person/:id/loeschen — Einzellöschung nach DSGVO.
 *
 * ── DIE LOGIK IST NICHT NEU ────────────────────────────────────────────────
 * Die Anonymisierung steht in `/admin/applications/:ref/gdpr-delete` und ist
 * geprüft: Name, Adresse, Telefon, E-Mail und KYC-Dokumente werden
 * unwiderruflich entfernt, Rechnungsnummer und Zahlungen bleiben (die
 * Buchhaltung darf keine Löcher bekommen).
 *
 * Diese Route ruft dieselbe Logik über den internen Weg auf. Sie NACHZUBAUEN
 * hieße, zwei Löschungen zu pflegen — und beim nächsten „auch die Telefonnummer
 * in den Anrufen anonymisieren" eine davon zu vergessen.
 *
 * MASSENLÖSCHUNG bleibt dem Vorgesetzten: Eine Leitung, die versehentlich
 * einen Filter falsch setzt, könnte sonst hundert Akten auf einmal entwerten.
 */
router.post("/agent/vertrieb/person/:id/loeschen", requireAgent, nurLeitung, nurMitZusage,
  async (req: AgentRequest, res: Response) => {
  try {
    const id = Number(req.params.id);
    const grund = String(req.body?.grund || "").trim();
    if (grund.length < 8) {
      return res.status(400).json({
        ok: false,
        error: "Bei einer Löschung braucht es einen vollständigen Satz als Grund.",
      });
    }
    const [p] = (await sqlPool`
      SELECT p.id, TRIM(COALESCE(p.first_name,'') || ' ' || COALESCE(p.last_name,'')) AS name
      FROM fiaon_persons p WHERE p.id = ${id} AND p.merged_into_person_id IS NULL
    `) as any[];
    if (!p) return res.status(404).json({ ok: false, error: "Kunde nicht gefunden." });

    // ALLE Bestellungen dieser Person anonymisieren — nicht nur die neueste.
    // Eine halb gelöschte Person ist keine gelöschte Person.
    const refs = (await sqlPool`
      SELECT ref FROM fiaon_applications
      WHERE person_id = ${id} AND gdpr_deleted_at IS NULL
    `) as any[];

    const anon = `geloescht-p${id}@anonym.invalid`;
    for (const r of refs) {
      await sqlPool`
        UPDATE fiaon_applications SET
          first_name = 'Gelöscht', last_name = '(DSGVO)', contact_name = NULL,
          email = ${anon}, contact_email = NULL, billing_email = NULL,
          phone = NULL, phone_country_code = NULL, contact_phone = NULL,
          street = NULL, zip = NULL, city = NULL,
          bank_statement_pdf = NULL, id_card_pdf = NULL, schufa_pdf = NULL,
          utm = NULL,
          payment_status = CASE WHEN payment_status IN ('pending_payment','claimed_paid','expired')
                                THEN 'cancelled' ELSE payment_status END,
          cancelled_at = CASE WHEN payment_status IN ('pending_payment','claimed_paid','expired')
                              THEN NOW() ELSE cancelled_at END,
          account_status = 'suspended',
          gdpr_deleted_at = NOW(), updated_at = NOW()
        WHERE ref = ${r.ref}
      `;
    }

    // Die Person selbst: anonymisiert und aus allen Arbeitslisten heraus.
    await sqlPool`
      UPDATE fiaon_persons SET
        first_name = 'Gelöscht', last_name = '(DSGVO)',
        primary_email = ${anon}, primary_phone = NULL,
        is_blocked = TRUE, updated_at = NOW()
      WHERE id = ${id}
    `;

    await sqlPool`
      INSERT INTO fiaon_contact_log (person_id, agent_id, agent_name, type, note, created_at)
      VALUES (${id}, ${req.agent!.id}, ${req.agent!.name}, 'system',
              ${`Kunde gelöscht (DSGVO) von ${req.agent!.name}. Grund: ${grund}. `
                + `${refs.length} Bestellung(en) anonymisiert; Rechnungsnummern und Zahlungen bleiben `
                + `aus Buchhaltungspflicht erhalten.`}, NOW())
    `.catch(() => {});
    await aktivitaetSchreiben({
      typ: "geloescht_endgueltig", wer: req.agent!.name,
      referenz: String(id), grund,
      meta: { name: p.name, bestellungen: refs.length },
    });

    console.log(`[VERTRIEB] DSGVO-Löschung: Person ${id} von ${req.agent!.name} — ${grund}`);
    res.json({
      ok: true,
      meldung: `${p.name} ist anonymisiert. ${refs.length} Bestellung(en) betroffen; `
        + "Rechnungen und Zahlungen bleiben als Zahlen erhalten.",
    });
  } catch (err) {
    console.error("[VERTRIEB] loeschen:", err);
    res.status(500).json({ ok: false, error: "Serverfehler" });
  }
});

export default router;
