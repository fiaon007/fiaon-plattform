// ═══════════════════════════════════════════════════════════════════════════
// FIAON OFFICE — Vertriebs-Arbeitsliste, Mandate, volle Akte (23.08.2026)
// E-043 (Plan §15) + E-044/§16/§16a.
//
//   GET  /agent/vertrieb/arbeitsliste        → 6 Slots (2+2+2) + Zähler + Mandate
//   POST /agent/vertrieb/mandat/:personId    → Mandat übernommen (mandat_seit)
//   GET  /agent/vertrieb/mandate             → Mandats-Kennungen + Anzahl (x/500)
//   GET  /agent/vertrieb/aktivitaet/:personId→ Zeitleiste ALLER Kundenereignisse
//                                              + Vollständigkeit (Kartenstatus)
//
// ── §16a: „Aktive Kunden“ zählen NUR übernommene Mandate ───────────────────
// VORHER zählte die Oberfläche alle bezahlten/zugewiesenen Kunden. GEPRÜFT:
// `betreuung_seit` taugt nicht als Mandatsmarke — `betreuungMerken` (lib/tier.ts)
// setzt sie bei JEDEM dokumentierten Ergebnis (auch „nicht erreicht“), und die
// Zuteilung trägt sie nach. Deshalb NEUES, rein additives Feld
// `fiaon_persons.mandat_seit` (ADD COLUMN IF NOT EXISTS, unten): Es wird
// AUSSCHLIESSLICH beim Buchen von „Mandat angenommen“ gesetzt (COALESCE –
// der erste Zeitpunkt gewinnt). NACHHER: „Aktive Kunden x/500“ liest nur
// dieses Feld; bloße Zuweisung zählt nicht.
//
// KEINE eigenen Bausteine: Kartenform (KARTE_SQL/karte) und Ausschlüsse
// (ruhtSql, wartetSql, is_blocked, ist_test_am, Wiedervorlage) kommen aus
// derselben Quelle wie /agent/kunden/liste. „Kein Interesse“ braucht KEINE
// neue Tabelle: `erreicht_abgelehnt` setzt `is_blocked`, das Verteilung und
// alle Listen schon respektieren.
//
// ── §16: kundeVollstaendig() ist die EINE Wahrheit für den Kartenstatus ────
// Paket bezahlt + SCHUFA (pack_key='schufa') bezahlt + Kontoauszug + Ausweis.
// Exportiert — das Chefbüro (Admin) nutzt dieselbe Funktion später.
// ═══════════════════════════════════════════════════════════════════════════
import { Router, type Response } from "express";
import { sqlPool } from "../lib/db-pool";
import { requireAgent, type AgentRequest } from "./fiaon-agent";
import { KARTE_SQL, karte } from "./fiaon-agent-start";
import { ruhtSql } from "../lib/fiaon-nicht-erreicht";
import { wartetSql } from "../lib/fiaon-warten";
import { ensureKartenSpalten } from "../lib/fiaon-kartenstatus";
import { ensureBetreuungSpalte } from "../lib/tier";

const router = Router();

const HEUTE = `(NOW() AT TIME ZONE 'Europe/Berlin')::date`;
export const MANDATE_MAX = 500;

/** Rein additive Spalte für §16a — memoisiert wie ensureBetreuungSpalte. */
let vertriebBereit: Promise<void> | null = null;
function ensureVertriebSpalten(): Promise<void> {
  if (!vertriebBereit) {
    vertriebBereit = (async () => {
      await sqlPool`ALTER TABLE fiaon_persons ADD COLUMN IF NOT EXISTS mandat_seit TIMESTAMPTZ`;
      await sqlPool`CREATE INDEX IF NOT EXISTS fiaon_persons_mandat_idx ON fiaon_persons (assigned_agent_id) WHERE mandat_seit IS NOT NULL`;
    })().catch((e) => { vertriebBereit = null; throw e; });
  }
  return vertriebBereit;
}

/** Eigener Kunde? Dieselbe Grenze wie meinePerson in fiaon-agent-kunden.ts. */
async function eigene(personId: number, agentId: number): Promise<boolean> {
  const [p] = (await sqlPool`
    SELECT 1 AS ok FROM fiaon_persons
    WHERE id = ${personId} AND assigned_agent_id = ${agentId} AND merged_into_person_id IS NULL
  `) as any[];
  return !!p;
}

// ═══════════════════════════════════════════════════════════════════════════
// §16: Ist der Kunde VOLLSTÄNDIG? — die eine, exportierte Wahrheit.
//   Paket bezahlt UND SCHUFA (74 €, pack_key='schufa') bezahlt UND
//   Kontoauszug (bank_statement_pdf) UND Ausweis (id_card_pdf) vorhanden.
// Erst dann: „Vollständig – liegt bei FIAON zur Bearbeitung“; sonst überall
// der Platzhalter „In Bearbeitung“.
// ═══════════════════════════════════════════════════════════════════════════
export async function kundeVollstaendig(personId: number): Promise<{
  vollstaendig: boolean; paketBezahlt: boolean; schufaBezahlt: boolean; kontoauszug: boolean; ausweis: boolean;
}> {
  const [z] = (await sqlPool`
    SELECT
      EXISTS (SELECT 1 FROM fiaon_applications a
        WHERE a.person_id = ${personId} AND a.merged_into IS NULL AND a.archived_at IS NULL
          AND a.payment_status = 'paid'
          AND COALESCE(a.pack_key, '') <> 'schufa') AS paket,
      EXISTS (SELECT 1 FROM fiaon_applications a
        WHERE a.person_id = ${personId} AND a.merged_into IS NULL AND a.archived_at IS NULL
          AND a.payment_status = 'paid'
          AND (a.pack_key = 'schufa' OR a.pack_name ILIKE '%bonität%' OR a.pack_name ILIKE '%schufa%')) AS schufa,
      EXISTS (SELECT 1 FROM fiaon_applications a
        WHERE a.person_id = ${personId} AND a.merged_into IS NULL
          AND a.bank_statement_pdf IS NOT NULL) AS kontoauszug,
      EXISTS (SELECT 1 FROM fiaon_applications a
        WHERE a.person_id = ${personId} AND a.merged_into IS NULL
          AND a.id_card_pdf IS NOT NULL) AS ausweis
  `) as any[];
  const paketBezahlt = !!z?.paket, schufaBezahlt = !!z?.schufa, kontoauszug = !!z?.kontoauszug, ausweis = !!z?.ausweis;
  return { vollstaendig: paketBezahlt && schufaBezahlt && kontoauszug && ausweis, paketBezahlt, schufaBezahlt, kontoauszug, ausweis };
}

/** Die Mandats-Zahlen eines Mitarbeiters — nur mandat_seit zählt (§16a). */
async function mandatsZahlen(agentId: number): Promise<{ anzahl: number; ids: number[] }> {
  await ensureVertriebSpalten();
  const rows = (await sqlPool`
    SELECT id FROM fiaon_persons
    WHERE assigned_agent_id = ${agentId} AND mandat_seit IS NOT NULL
      AND merged_into_person_id IS NULL AND ist_test_am IS NULL AND NOT is_blocked
  `) as any[];
  return { anzahl: rows.length, ids: rows.map((r) => Number(r.id)) };
}

/** Die drei Gruppen der Arbeitsliste — Übersetzung des vorhandenen priority_tier. */
const GRUPPEN: { key: string; tier: number }[] = [
  { key: "bezahlt_gemeldet", tier: 1 },
  { key: "rechnung_offen", tier: 2 },
  { key: "lead", tier: 3 },
];
const JE_GRUPPE = 2;
const SLOTS = 6;

router.get("/agent/vertrieb/arbeitsliste", requireAgent, async (req: AgentRequest, res: Response) => {
  try {
    const { istInkasso } = await import("./fiaon-inkasso-bereich");
    if (await istInkasso(req.agent!.id)) {
      return res.status(404).json({ ok: false, error: "Diese Liste gibt es für dich nicht — deine Arbeit steht unter „Forderungen“." });
    }
    // E-045 (Plan §17): VORHER bekam die Rolle „onboarding" eine leere Liste —
    // NACHHER ist sie Bonitätsmanager wie alle und arbeitet ihre zugewiesenen
    // Kunden. (Ohne Bestand ist die Liste von selbst leer.)

    await ensureKartenSpalten();
    await ensureBetreuungSpalte(sqlPool);
    await ensureVertriebSpalten();
    const me = req.agent!.id;

    // Gemeinsame Ausschlüsse — dieselben Bausteine wie die große Liste, plus:
    // ein gebuchter Termin in der Zukunft heißt „Mandat angenommen“ — raus.
    const basis = [
      "p.assigned_agent_id = $1",
      "p.merged_into_person_id IS NULL",
      "p.ist_test_am IS NULL",
      "NOT p.is_blocked",
      `NOT ${ruhtSql("p")}`,
      `NOT ${wartetSql("p")}`,
      `(p.follow_up_date IS NULL OR p.follow_up_date <= ${HEUTE})`,
      `NOT EXISTS (
         SELECT 1 FROM fiaon_termine tz
         WHERE tz.person_id = p.id AND tz.status = 'gebucht'
           AND tz.abgesagt_am IS NULL AND tz.beginn > NOW())`,
    ].join(" AND ");

    const ordnung = `
      CASE
        WHEN p.promised_payment_date IS NOT NULL AND p.promised_payment_date <= ${HEUTE} THEN 0
        WHEN EXISTS (
          SELECT 1 FROM fiaon_contact_log cl JOIN fiaon_applications a3 ON a3.ref = cl.ref
          WHERE a3.person_id = p.id AND cl.outcome = 'rueckruf_termin' AND cl.done_at IS NULL
            AND cl.voided_at IS NULL AND cl.scheduled_at IS NOT NULL AND cl.scheduled_at <= NOW()
        ) THEN 1
        ELSE 2
      END,
      COALESCE(p.updated_at, p.created_at) DESC NULLS LAST,
      p.id DESC`;

    // §16: Vollständigkeit als Spalten direkt an der Karte — dieselbe Regel
    // wie kundeVollstaendig(), damit die 6 Slots keinen zweiten Weg brauchen.
    const VOLL_SQL = `
      (EXISTS (SELECT 1 FROM fiaon_applications a WHERE a.person_id = p.id AND a.merged_into IS NULL
         AND a.archived_at IS NULL AND a.payment_status = 'paid' AND COALESCE(a.pack_key,'') <> 'schufa')
       AND EXISTS (SELECT 1 FROM fiaon_applications a WHERE a.person_id = p.id AND a.merged_into IS NULL
         AND a.archived_at IS NULL AND a.payment_status = 'paid'
         AND (a.pack_key = 'schufa' OR a.pack_name ILIKE '%bonität%' OR a.pack_name ILIKE '%schufa%'))
       AND EXISTS (SELECT 1 FROM fiaon_applications a WHERE a.person_id = p.id AND a.merged_into IS NULL
         AND a.bank_statement_pdf IS NOT NULL)
       AND EXISTS (SELECT 1 FROM fiaon_applications a WHERE a.person_id = p.id AND a.merged_into IS NULL
         AND a.id_card_pdf IS NOT NULL)) AS voll_kunde`;

    const mandate = await mandatsZahlen(me);
    const [g1, g2, g3, zaehlerR] = await Promise.all([
      ...GRUPPEN.map((g) => sqlPool.unsafe(
        `SELECT ${KARTE_SQL}, p.mandat_seit, ${VOLL_SQL} FROM fiaon_persons p
         WHERE ${basis} AND p.priority_tier = ${g.tier}
         ORDER BY ${ordnung} LIMIT ${SLOTS}`, [me],
      )),
      sqlPool.unsafe(
        `SELECT
           COUNT(*) FILTER (WHERE p.priority_tier = 1)::int AS bezahlt_gemeldet,
           COUNT(*) FILTER (WHERE p.priority_tier = 2)::int AS rechnung_offen,
           COUNT(*) FILTER (WHERE p.priority_tier = 3)::int AS lead
         FROM fiaon_persons p WHERE ${basis}`, [me],
      ),
    ]);

    const toepfe: { key: string; rows: any[] }[] = [
      { key: "bezahlt_gemeldet", rows: g1 as any[] },
      { key: "rechnung_offen", rows: g2 as any[] },
      { key: "lead", rows: g3 as any[] },
    ];
    const slot = (key: string, r: any) => ({
      gruppe: key,
      kunde: { ...karte(r), mandatSeit: r.mandat_seit ?? null, vollstaendig: !!r.voll_kunde },
    });
    const slots: { gruppe: string; kunde: any }[] = [];
    for (const t of toepfe) for (const r of t.rows.splice(0, JE_GRUPPE)) slots.push(slot(t.key, r));
    for (const t of toepfe) while (slots.length < SLOTS && t.rows.length > 0) slots.push(slot(t.key, t.rows.shift()));

    const z = (zaehlerR as any[])[0] || {};
    res.json({
      ok: true,
      rolle: "agent",
      slots,
      zaehler: {
        bezahlt_gemeldet: Number(z.bezahlt_gemeldet || 0),
        rechnung_offen: Number(z.rechnung_offen || 0),
        lead: Number(z.lead || 0),
      },
      mandate: { anzahl: mandate.anzahl, max: MANDATE_MAX },
    });
  } catch (err) {
    console.error("[OFFICE-VERTRIEB] arbeitsliste:", err);
    res.status(500).json({ ok: false, error: "Serverfehler" });
  }
});

// ── §16a: Mandat übernehmen — beim Buchen von „Mandat angenommen“ ──────────
router.post("/agent/vertrieb/mandat/:personId", requireAgent, async (req: AgentRequest, res: Response) => {
  try {
    await ensureVertriebSpalten();
    const personId = Number(req.params.personId);
    if (!Number.isFinite(personId) || personId <= 0) return res.status(404).json({ ok: false, error: "Kunde nicht gefunden" });
    if (!(await eigene(personId, req.agent!.id))) return res.status(404).json({ ok: false, error: "Kunde nicht gefunden" });
    const [r] = (await sqlPool`
      UPDATE fiaon_persons
      SET mandat_seit = COALESCE(mandat_seit, NOW()), updated_at = NOW()
      WHERE id = ${personId}
      RETURNING mandat_seit
    `) as any[];
    const zahlen = await mandatsZahlen(req.agent!.id);
    res.json({ ok: true, mandatSeit: r?.mandat_seit ?? null, anzahl: zahlen.anzahl, max: MANDATE_MAX });
  } catch (err) {
    console.error("[OFFICE-VERTRIEB] mandat:", err);
    res.status(500).json({ ok: false, error: "Serverfehler" });
  }
});

router.get("/agent/vertrieb/mandate", requireAgent, async (req: AgentRequest, res: Response) => {
  try {
    const z = await mandatsZahlen(req.agent!.id);
    res.json({ ok: true, anzahl: z.anzahl, ids: z.ids, max: MANDATE_MAX });
  } catch (err) {
    console.error("[OFFICE-VERTRIEB] mandate:", err);
    res.status(500).json({ ok: false, error: "Serverfehler" });
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// §16: Volle Akte — GET /agent/vertrieb/aktivitaet/:personId
// Zeitleiste ALLER Kundenereignisse: Klicks (fiaon_click_events über die
// Bestell-Refs der Person), Bestellungen/Zahlungen/Raten, Mails
// (fiaon_mail_log), Anrufe (fiaon_calls), Gesprächsergebnisse
// (fiaon_contact_log). Zugriff: dieselbe Grenze wie /agent/crm/kunden/:id
// (assigned_agent_id = ich). Jede Quelle ist einzeln abgesichert — eine
// fehlende Tabelle darf die Akte nicht leeren.
// ═══════════════════════════════════════════════════════════════════════════
type Kat = "klick" | "zahlung" | "gespraech" | "mail" | "system";
interface Ereignis { am: string; kat: Kat; titel: string; detail: string | null; roh: string | null }

/** Klick-Ereignisse in Menschensprache — rohe Namen bleiben als Nebentext. */
function klickTitel(event: string, step: number | null, page: string | null, data: any): string {
  const s = step != null ? ` ${step}` : "";
  const feste: Record<string, string> = {
    pack_select: `Paket gewählt${data?.pack ? `: ${data.pack}` : ""}`,
    pack_upgrade: "Paket hochgestuft",
    pack_switch: "Paket gewechselt",
    step_change: `Antrag Schritt${s} ausgefüllt`,
    contract_download: "Vertrag heruntergeladen",
    checkout_bank_transfer: "Zahlungsseite (Überweisung) geöffnet",
    login: "Im Kundenbereich angemeldet",
    page_view: `Seite angesehen${page ? `: ${page}` : ""}`,
    upload: "Unterlage hochgeladen",
  };
  if (feste[event]) return feste[event];
  if (page) {
    const seiten: [string, string][] = [
      ["preise", "Hat die Preisseite angesehen"], ["antrag", "War im Antrag"],
      ["kundenbereich", "War im Kundenbereich"], ["mein-bereich", "War im Kundenbereich"],
      ["privatkunden", "Hat die Privatkunden-Seite angesehen"], ["business", "Hat die Business-Seite angesehen"],
    ];
    for (const [teil, text] of seiten) if (page.includes(teil)) return text;
    return `Seite angesehen: ${page}`;
  }
  return event.replace(/[_-]+/g, " ");
}

const MAIL_TITEL: Record<string, string> = {
  payment_details: "Zahlungsdaten-Mail", welcome: "Willkommens-/Zugangs-Mail",
  nicht_erreicht_termin: "Terminlink-Mail", onboarding_einladung: "Einladung zum Startgespräch",
  number_update_request: "Bitte um neue Rufnummer", payment_reminder: "Zahlungserinnerung",
  payment_confirmed: "Zahlungsbestätigung", lead_followup: "Nachfass-Mail",
  lead_application_link: "Antragslink-Mail",
};

router.get("/agent/vertrieb/aktivitaet/:personId", requireAgent, async (req: AgentRequest, res: Response) => {
  try {
    const personId = Number(req.params.personId);
    if (!Number.isFinite(personId) || personId <= 0) return res.status(404).json({ ok: false, error: "Kunde nicht gefunden" });
    if (!(await eigene(personId, req.agent!.id))) return res.status(404).json({ ok: false, error: "Kunde nicht gefunden" });

    const refs = ((await sqlPool`
      SELECT ref FROM fiaon_applications WHERE person_id = ${personId} AND merged_into IS NULL
    `.catch(() => [] as any[])) as any[]).map((r) => String(r.ref));

    const leer: any[] = [];
    const [klicks, apps, raten, mails, anrufe, kontakte, voll] = await Promise.all([
      refs.length ? sqlPool`
        SELECT event, step, page, data, created_at FROM fiaon_click_events
        WHERE application_ref = ANY(${refs}::text[])
        ORDER BY created_at DESC LIMIT 400
      `.catch(() => leer) : Promise.resolve(leer),
      sqlPool`
        SELECT ref, pack_name, amount_due, payment_status, created_at, completed_at,
               documents_uploaded_at, archived_at, archived_reason
        FROM fiaon_applications WHERE person_id = ${personId} AND merged_into IS NULL
      `.catch(() => leer),
      refs.length ? sqlPool`
        SELECT rate_nr, betrag_cents, faellig_am, status, bezahlt_am
        FROM fiaon_abo_raten WHERE ref = ANY(${refs}::text[]) AND storniert_am IS NULL
      `.catch(() => leer) : Promise.resolve(leer),
      sqlPool`
        SELECT event, status, empfaenger, grund, created_at FROM fiaon_mail_log
        WHERE person_id = ${personId} ORDER BY created_at DESC LIMIT 200
      `.catch(() => leer),
      sqlPool`
        SELECT richtung, status, beginn, nummer FROM fiaon_calls
        WHERE person_id = ${personId} ORDER BY beginn DESC LIMIT 200
      `.catch(() => leer),
      sqlPool`
        SELECT c.created_at, c.type, c.outcome, c.note, c.agent_name
        FROM fiaon_contact_log c JOIN fiaon_applications a ON a.ref = c.ref
        WHERE a.person_id = ${personId} AND c.voided_at IS NULL
        ORDER BY c.created_at DESC LIMIT 200
      `.catch(() => leer),
      kundeVollstaendig(personId),
    ]);

    const e: Ereignis[] = [];
    for (const k of klicks as any[]) {
      e.push({ am: k.created_at, kat: "klick", titel: klickTitel(String(k.event), k.step != null ? Number(k.step) : null, k.page, k.data), detail: k.page || null, roh: String(k.event) });
    }
    for (const a of apps as any[]) {
      if (a.created_at) e.push({ am: a.created_at, kat: "system", titel: `Bestellung angelegt${a.pack_name ? `: ${String(a.pack_name).split("\n")[0]}` : ""}`, detail: a.ref, roh: null });
      if (a.completed_at) e.push({ am: a.completed_at, kat: "system", titel: "Antrag abgeschlossen", detail: a.ref, roh: null });
      if (a.documents_uploaded_at) e.push({ am: a.documents_uploaded_at, kat: "klick", titel: "Unterlagen hochgeladen (Kontoauszug/Ausweis)", detail: a.ref, roh: "documents_uploaded" });
      if (a.payment_status === "paid") e.push({ am: a.completed_at || a.created_at, kat: "zahlung", titel: `Erste Zahlung bankbestätigt${a.amount_due ? ` – ${Number(a.amount_due).toFixed(2).replace(".", ",")} €` : ""}`, detail: a.ref, roh: "paid" });
      if (a.archived_at) e.push({ am: a.archived_at, kat: "system", titel: "Bestellung archiviert", detail: a.archived_reason || a.ref, roh: null });
    }
    for (const r of raten as any[]) {
      if (r.bezahlt_am) e.push({ am: r.bezahlt_am, kat: "zahlung", titel: `Rate ${r.rate_nr} bezahlt – ${(Number(r.betrag_cents) / 100).toFixed(2).replace(".", ",")} €`, detail: null, roh: null });
    }
    for (const m of mails as any[]) {
      e.push({ am: m.created_at, kat: "mail", titel: `${MAIL_TITEL[String(m.event)] ?? `Mail: ${m.event}`} ${m.status === "versandt" ? "versandt" : `– ${m.status}`}`, detail: m.empfaenger || m.grund || null, roh: String(m.event) });
    }
    for (const a of anrufe as any[]) {
      e.push({ am: a.beginn, kat: "gespraech", titel: a.richtung === "eingehend" ? "Kunde hat angerufen" : "Anruf an den Kunden", detail: a.status || null, roh: null });
    }
    for (const k of kontakte as any[]) {
      e.push({ am: k.created_at, kat: "gespraech", titel: k.type === "note" ? "Notiz" : `Gesprächsergebnis: ${k.outcome || k.type}`, detail: [k.agent_name, k.note].filter(Boolean).join(" – ") || null, roh: k.outcome || k.type });
    }
    e.sort((a, b) => new Date(b.am).getTime() - new Date(a.am).getTime());

    res.json({ ok: true, ereignisse: e.slice(0, 500), vollstaendig: voll });
  } catch (err) {
    console.error("[OFFICE-VERTRIEB] aktivitaet:", err);
    res.status(500).json({ ok: false, error: "Serverfehler" });
  }
});

export default router;
