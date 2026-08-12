// ═══════════════════════════════════════════════════════════════════════════
// FIAON AGENT — STARTSEITE UND DIE EINE KUNDENLISTE
//
// Warum diese Datei entsteht (Meldung des Vertriebs, 05.08.2026):
//
//   Florentine: „Der Bereich Heute sorgt eher für doppelte Arbeit und
//               Überschneidungen. Unser Vorschlag: alle Kunden ausschließlich
//               unter Meine Kunden führen und von oben nach unten abarbeiten."
//
// Sie hat recht, und der Grund ist strukturell: Eine Tagesliste NEBEN der
// Kundenliste sind zwei Wahrheiten über denselben Bestand. Wer in der einen
// arbeitet, hinterlässt in der anderen einen veralteten Stand — und zwei
// Mitarbeiter rufen denselben Menschen an.
//
// AB HIER GILT:
//   /agent/start   informiert. Verdienst, Zahlen, Termine. KEINE Arbeitsaktionen.
//   /agent/kunden  ist die EINZIGE Arbeitsliste. Alles, was zugewiesen ist,
//                  steht dort — von oben nach unten abarbeitbar.
//
// Die Sortierung der Kundenliste ist die eigentliche Leistung dieser Datei: Sie
// nimmt dem Agenten die Entscheidung ab, WEN er als nächstes anruft. Genau diese
// Entscheidung hat die alte Tagesliste getroffen — deshalb gibt es sie nicht
// mehr, sondern die Reihenfolge steht in der einen Liste.
// ═══════════════════════════════════════════════════════════════════════════

import { Router, type Response } from "express";
import { sqlPool } from "../lib/db-pool";
import { aufbereiten } from "../lib/fiaon-buchungen";
import { requireAgent, type AgentRequest, getSettings } from "./fiaon-agent";
import { waehlbareNummer } from "../lib/fiaon-telefon";
import { hinweisFuer, type TierGrund } from "../lib/tier-hinweise";
import { ensureBetreuungSpalte } from "../lib/tier";
import { stufeAusTier } from "@shared/fiaon-kundenstatus";
import { ruhtSql } from "../lib/fiaon-nicht-erreicht";
import { terminLink } from "../lib/fiaon-termine";

const router = Router();

/**
 * HEUTE — in Europe/Berlin, nicht in UTC.
 *
 * `CURRENT_DATE` ist das Datum des SERVERS, und der läuft auf UTC. Zwischen
 * Mitternacht und zwei Uhr Berliner Zeit (im Winter: eine Stunde) ist das noch
 * der Vortag. Eine Zusage „für heute" fiel in diesem Fenster aus dem obersten
 * Rang und rutschte hinter die Stufe A — gemessen am 09.08.2026 um 00:15 Uhr
 * Berliner Zeit, wo UTC noch den 08.08. anzeigte.
 *
 * Dieselbe Tagesgrenze wie `berlinToday()` in server/lib/fiaon-time.ts, nur
 * für SQL. Wer hier `CURRENT_DATE` schreibt, baut den Fehler neu.
 */
const HEUTE = `(NOW() AT TIME ZONE 'Europe/Berlin')::date`;

const NAME_SQL = `COALESCE(
  NULLIF(TRIM(CONCAT_WS(' ', p.first_name, p.last_name)), ''),
  NULLIF(TRIM(p.company_name), ''),
  NULLIF(TRIM(p.contact_name), ''),
  p.primary_email,
  CONCAT('Person ', p.id)
)`;

/** Felder, die jede Karte braucht — einmal definiert, in beiden Abfragen benutzt. */
const KARTE_SQL = `
  p.id, ${NAME_SQL} AS name, p.primary_email, p.primary_phone, p.country,
  p.priority_tier, p.tier_reason, p.promised_payment_date, p.follow_up_date,
  p.unreachable_count, p.invoice_sent_count, p.is_blocked, p.betreuung_seit,
  (SELECT a.ref FROM fiaon_applications a
    WHERE a.person_id = p.id AND a.merged_into IS NULL
    ORDER BY a.created_at DESC LIMIT 1) AS ref,
  (SELECT a.payment_reference FROM fiaon_applications a
    WHERE a.person_id = p.id AND a.merged_into IS NULL
    ORDER BY a.created_at DESC LIMIT 1) AS zahlungsreferenz,
  (SELECT a.payment_status FROM fiaon_applications a
    WHERE a.person_id = p.id AND a.merged_into IS NULL
    ORDER BY a.created_at DESC LIMIT 1) AS zahlungsstatus,
  (SELECT a.pack_name FROM fiaon_applications a
    WHERE a.person_id = p.id AND a.merged_into IS NULL
    ORDER BY a.created_at DESC LIMIT 1) AS pack_name,
  -- ══════════════════════════════════════════════════════════════════════════
  -- ALLE BUCHUNGEN, NICHT NUR DIE NEUESTE
  --
  -- Ein Agent (11.08.2026) über Shahed Mohammad: „Ursprünglich war er wegen
  -- seines Pakets bei mir hinterlegt. Jetzt ist das Paket komplett verschwunden
  -- und er taucht nur noch wegen der Schufa auf."
  --
  -- Gemessen: Er hat ZWEI Bestellungen — ultra (79,99 €, 23.07.) und
  -- Bonitätsauskunft (74 €, 31.07.). Die Karte holte mit
  -- „ORDER BY created_at DESC LIMIT 1" die neueste; das Paket verschwand.
  --
  -- 410 Kunden haben mehr als eine offene Buchung. Alle sahen nur eine.
  --
  -- Ein Kunde hat BUCHUNGEN, nicht eine Bestellung. Die Aufbereitung steht in
  -- server/lib/fiaon-buchungen.ts — hier nur die Rohdaten in einem Rutsch,
  -- damit es keine Abfrage je Kunde braucht.
  -- ══════════════════════════════════════════════════════════════════════════
  (SELECT COALESCE(JSON_AGG(JSON_BUILD_OBJECT(
            'ref', a.ref, 'pack_key', a.pack_key, 'pack_name', a.pack_name,
            'amount_due', a.amount_due, 'payment_status', a.payment_status,
            'status', a.status, 'created_at', a.created_at,
            'payment_due_date', a.payment_due_date,
            'payment_reference', a.payment_reference,
            'cancelled_at', a.cancelled_at, 'refunded_at', a.refunded_at
          ) ORDER BY a.created_at), '[]'::json)
     FROM fiaon_applications a
     WHERE a.person_id = p.id AND a.merged_into IS NULL
       AND a.archived_at IS NULL AND a.gdpr_deleted_at IS NULL) AS buchungen_roh,
  (SELECT a.amount_due FROM fiaon_applications a
    WHERE a.person_id = p.id AND a.merged_into IS NULL
    ORDER BY a.created_at DESC LIMIT 1) AS amount_due,
  (SELECT a.status FROM fiaon_applications a
    WHERE a.person_id = p.id AND a.merged_into IS NULL
    ORDER BY a.created_at DESC LIMIT 1) AS letzter_status,
  (SELECT a.phone FROM fiaon_applications a
    WHERE a.person_id = p.id AND a.merged_into IS NULL AND NULLIF(a.phone,'') IS NOT NULL
    ORDER BY a.created_at DESC LIMIT 1) AS app_phone,
  (SELECT a.phone_country_code FROM fiaon_applications a
    WHERE a.person_id = p.id AND a.merged_into IS NULL AND NULLIF(a.phone,'') IS NOT NULL
    ORDER BY a.created_at DESC LIMIT 1) AS app_vorwahl,
  (SELECT NULLIF(a.contact_phone,'') FROM fiaon_applications a
    WHERE a.person_id = p.id AND a.merged_into IS NULL AND NULLIF(a.contact_phone,'') IS NOT NULL
    ORDER BY a.created_at DESC LIMIT 1) AS app_contact_phone,
  (SELECT COALESCE(NULLIF(a.email,''), NULLIF(a.contact_email,''), NULLIF(a.billing_email,''))
    FROM fiaon_applications a
    WHERE a.person_id = p.id AND a.merged_into IS NULL
    ORDER BY a.created_at DESC LIMIT 1) AS app_email,
  COALESCE(NULLIF(p.street,''), (SELECT NULLIF(a.street,'') FROM fiaon_applications a
    WHERE a.person_id = p.id AND a.merged_into IS NULL AND NULLIF(a.street,'') IS NOT NULL
    ORDER BY a.created_at DESC LIMIT 1)) AS strasse,
  COALESCE(NULLIF(p.zip,''), (SELECT NULLIF(a.zip,'') FROM fiaon_applications a
    WHERE a.person_id = p.id AND a.merged_into IS NULL AND NULLIF(a.zip,'') IS NOT NULL
    ORDER BY a.created_at DESC LIMIT 1)) AS plz,
  COALESCE(NULLIF(p.city,''), (SELECT NULLIF(a.city,'') FROM fiaon_applications a
    WHERE a.person_id = p.id AND a.merged_into IS NULL AND NULLIF(a.city,'') IS NOT NULL
    ORDER BY a.created_at DESC LIMIT 1)) AS ort,
  COALESCE(p.birthdate, (SELECT a.birthdate FROM fiaon_applications a
    WHERE a.person_id = p.id AND a.merged_into IS NULL AND a.birthdate IS NOT NULL
    ORDER BY a.created_at DESC LIMIT 1)) AS geburtsdatum,
  (SELECT MAX(cl.created_at) FROM fiaon_contact_log cl
    JOIN fiaon_applications a2 ON a2.ref = cl.ref
    WHERE a2.person_id = p.id AND cl.voided_at IS NULL) AS letzter_kontakt,
  (SELECT cl.outcome FROM fiaon_contact_log cl
    JOIN fiaon_applications a2 ON a2.ref = cl.ref
    WHERE a2.person_id = p.id AND cl.type = 'result' AND cl.voided_at IS NULL
    ORDER BY cl.created_at DESC LIMIT 1) AS letztes_ergebnis,
  (SELECT cl.scheduled_at FROM fiaon_contact_log cl
    JOIN fiaon_applications a2 ON a2.ref = cl.ref
    WHERE a2.person_id = p.id AND cl.outcome = 'rueckruf_termin'
      AND cl.voided_at IS NULL AND cl.done_at IS NULL
    ORDER BY cl.scheduled_at DESC LIMIT 1) AS rueckruf_am,
  p.ruhe_seit, p.terminlink_mail_am,
  (SELECT t.beginn FROM fiaon_termine t
    WHERE t.person_id = p.id AND t.status = 'gebucht' AND t.beginn > NOW()
    ORDER BY t.beginn ASC LIMIT 1) AS termin_am
`;

/** Aus einer Zeile wird eine Karte — eine Stelle, drei Ansichten. */
export function karte(p: any) {
  const h = hinweisFuer(p.tier_reason as TierGrund, p.letzter_status);
  const tel = waehlbareNummer(
    [
      { nummer: p.app_phone, vorwahl: p.app_vorwahl },
      { nummer: p.primary_phone },
      { nummer: p.app_contact_phone },
    ],
    p.country,
  );
  return {
    personId: Number(p.id),
    name: p.name,
    telefon: tel.anzeige,
    telefonWaehlbar: tel.waehlbar,
    telefonHinweis: tel.hinweis,
    email: p.primary_email || p.app_email || null,
    tier: Number(p.priority_tier),
    tierGrund: p.tier_reason,
    titel: h.titel,
    hinweis: h.hinweis,
    produkt: p.pack_name ? String(p.pack_name).split("\n")[0].trim() : null,
    // ── ALLE BUCHUNGEN ────────────────────────────────────────────────────
    // Damit der Agent sieht, was gebucht wurde, was bezahlt ist und was offen
    // — auch wenn es zwei Vorgänge sind (Paket + Bonitätsauskunft).
    buchungen: aufbereiten(p.buchungen_roh),
    betrag: p.amount_due != null ? Math.round(Number(p.amount_due) * 100) : null,
    zusagedatum: p.promised_payment_date,
    wiedervorlage: p.follow_up_date,
    rueckrufAm: p.rueckruf_am,
    nichtErreicht: Number(p.unreachable_count || 0),
    rechnungVersandt: Number(p.invoice_sent_count || 0),
    gesperrt: !!p.is_blocked,
    // ── Stufe A/B/C ────────────────────────────────────────────────────────
    // Kein neues Feld in der Datenbank: Die Stufe IST das Tier, nur mit einem
    // Namen, den ein Mensch versteht (shared/fiaon-kundenstatus.ts).
    stufe: stufeAusTier(p.priority_tier),
    // ── Nicht-erreicht-Automatik ───────────────────────────────────────────
    ruhtSeit: p.ruhe_seit || null,
    terminlinkMailAm: p.terminlink_mail_am || null,
    terminAm: p.termin_am || null,
    // Der persoenliche Buchungslink — fuer den Kopierknopf, wenn keine
    // E-Mail hinterlegt ist („per WhatsApp senden").
    terminLink: terminLink(Number(p.id)),
    betreutSeit: p.betreuung_seit,
    letzterKontakt: p.letzter_kontakt,
    letztesErgebnis: p.letztes_ergebnis,
    stammdaten: {
      strasse: p.strasse || null, plz: p.plz || null, ort: p.ort || null,
      land: p.country || null, geburtsdatum: p.geburtsdatum || null,
    },
    zahlung: {
      referenz: p.zahlungsreferenz || null,
      status: p.zahlungsstatus || null,
      ref: p.ref || null,
    },
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// GET /agent/start — die Startseite informiert
// ═══════════════════════════════════════════════════════════════════════════
router.get("/agent/start", requireAgent, async (req: AgentRequest, res: Response) => {
  try {
    await ensureBetreuungSpalte(sqlPool);
    const me = req.agent!.id;

    // ── EINE WELLE STATT NEUN ──────────────────────────────────────────────
    // Diese Seite braucht sieben unabhängige Auskünfte. Hintereinander gestellt
    // kostet jede einen vollen Weg zur Datenbank; gemessen wurden 254 ms pro Weg
    // und 5 Sekunden für die Seite, obwohl die Datenbank selbst nur 9 ms
    // rechnete. Wer morgens die Startseite öffnet, wartet dann fünf Sekunden auf
    // Zahlen, die längst bereitstehen.
    //
    // Deshalb: alles Unabhängige gleichzeitig, und nur `moeglich` in einer
    // zweiten Welle — es braucht den Provisionssatz aus `agentRow`.
    const [settings, geldR, agentRowR, offenerAntragR, zahlenR, zusagen, rueckrufe] = await Promise.all([
      getSettings(),
      sqlPool`
      SELECT
        COALESCE(SUM(amount_cents) FILTER (WHERE status = 'bestaetigt'), 0)::bigint AS guthaben,
        COALESCE(SUM(amount_cents) FILTER (WHERE status = 'in_auszahlung'), 0)::bigint AS angefordert,
        COALESCE(SUM(amount_cents) FILTER (WHERE status = 'ausgezahlt'), 0)::bigint AS ausgezahlt,
        COALESCE(SUM(amount_cents) FILTER (WHERE status <> 'storniert'
          AND created_at >= date_trunc('month', NOW())), 0)::bigint AS monat
      FROM fiaon_commissions WHERE agent_id = ${me}
    `,
      sqlPool`
      SELECT commission_rate_bp, monthly_goal_cents, bank_iban_masked, rolle
      FROM fiaon_agents WHERE id = ${me}
    `,
      sqlPool`
      SELECT id, amount_cents, requested_at FROM fiaon_payouts
      WHERE agent_id = ${me} AND status = 'angefordert'
      ORDER BY requested_at DESC LIMIT 1
    `,
      sqlPool`
      SELECT
        COUNT(*) FILTER (WHERE priority_tier BETWEEN 1 AND 3 AND NOT is_blocked)::int AS offen,
        COUNT(*) FILTER (WHERE priority_tier = 1 AND NOT is_blocked)::int AS tier1,
        COUNT(*) FILTER (WHERE priority_tier = 2 AND NOT is_blocked)::int AS tier2,
        COUNT(*) FILTER (WHERE priority_tier = 3 AND NOT is_blocked)::int AS tier3,
        COUNT(*) FILTER (WHERE priority_tier = 0)::int AS bezahlt,
        COUNT(*) FILTER (WHERE promised_payment_date = ${sqlPool.unsafe(HEUTE)} AND NOT is_blocked)::int AS zusage_heute,
        COUNT(*) FILTER (WHERE promised_payment_date < ${sqlPool.unsafe(HEUTE)} AND priority_tier BETWEEN 1 AND 2
                           AND NOT is_blocked)::int AS zusage_ueberfaellig
      FROM fiaon_persons
      WHERE assigned_agent_id = ${me} AND merged_into_person_id IS NULL
    `,
      // ── Zahlungszusagen: die einzige echte Terminliste ───────────────────
      sqlPool.unsafe(`
      SELECT ${KARTE_SQL}
      FROM fiaon_persons p
      WHERE p.assigned_agent_id = $1 AND p.merged_into_person_id IS NULL
        AND NOT p.is_blocked AND p.priority_tier BETWEEN 1 AND 2
        AND p.promised_payment_date IS NOT NULL
      ORDER BY p.promised_payment_date ASC
      LIMIT 60
    `, [me]),
      // ── Rückrufe: Datum UND Uhrzeit ─────────────────────────────────────
      sqlPool`
      SELECT DISTINCT ON (a.person_id)
             a.person_id, cl.scheduled_at, cl.note,
             COALESCE(NULLIF(TRIM(CONCAT_WS(' ', p.first_name, p.last_name)), ''),
                      p.company_name, p.contact_name, p.primary_email) AS name,
             p.priority_tier, p.tier_reason
      FROM fiaon_contact_log cl
      JOIN fiaon_applications a ON a.ref = cl.ref
      JOIN fiaon_persons p ON p.id = a.person_id
      WHERE cl.outcome = 'rueckruf_termin' AND cl.voided_at IS NULL AND cl.done_at IS NULL
        AND p.assigned_agent_id = ${me} AND p.merged_into_person_id IS NULL
        AND NOT p.is_blocked AND p.priority_tier BETWEEN 1 AND 3
        AND cl.scheduled_at IS NOT NULL
      ORDER BY a.person_id, cl.scheduled_at DESC
    `,
    ]);

    const geld = (geldR as any[])[0] || {};
    const agentRow = (agentRowR as any[])[0];
    const offenerAntrag = (offenerAntragR as any[])[0];
    const zahlen = (zahlenR as any[])[0] || {};
    const rateBp = Number(agentRow?.commission_rate_bp || settings.default_commission_rate_bp || 1500);
    const mindest = parseInt(String(settings.payout_min_cents ?? "5000"), 10);

    // Zweite Welle: braucht den Provisionssatz von oben. „Möglich" heißt
    // ausdrücklich möglich — es ist KEIN Anspruch, sondern der Wert der offenen
    // Kunden zum eigenen Satz.
    const [moeglich = { cents: 0, anzahl: 0 }] = await sqlPool`
      SELECT COALESCE(SUM(ROUND(ROUND(COALESCE(a.amount_due::numeric, 0) * 100) * ${rateBp} / 10000.0)), 0)::bigint AS cents,
             COUNT(*)::int AS anzahl
      FROM fiaon_applications a
      JOIN fiaon_persons p ON p.id = a.person_id
      WHERE p.assigned_agent_id = ${me} AND p.merged_into_person_id IS NULL
        AND a.merged_into IS NULL AND a.payment_status IN ('pending_payment', 'claimed_paid')
    `;

    res.json({
      ok: true,
      agent: {
        vorname: req.agent!.first_name || req.agent!.name,
        name: req.agent!.name,
        rolle: String(agentRow?.rolle || "agent"),
      },
      verdienst: {
        guthabenCents: Number(geld.guthaben),
        angefordertCents: Number(geld.angefordert),
        ausgezahltCents: Number(geld.ausgezahlt),
        monatCents: Number(geld.monat),
        moeglichCents: Number(moeglich.cents),
        moeglichAnzahl: Number(moeglich.anzahl),
        monatszielCents: agentRow?.monthly_goal_cents ? Number(agentRow.monthly_goal_cents) : null,
        satzBp: rateBp,
        mindestCents: mindest,
        auszahlbar: Number(geld.guthaben) >= mindest && !offenerAntrag,
        bankHinterlegt: !!agentRow?.bank_iban_masked,
        offenerAntrag: offenerAntrag
          ? { id: Number(offenerAntrag.id), cents: Number(offenerAntrag.amount_cents), am: offenerAntrag.requested_at }
          : null,
      },
      kunden: {
        offen: zahlen.offen, tier1: zahlen.tier1, tier2: zahlen.tier2, tier3: zahlen.tier3,
        bezahlt: zahlen.bezahlt,
        zusageHeute: zahlen.zusage_heute, zusageUeberfaellig: zahlen.zusage_ueberfaellig,
      },
      zusagen: (zusagen as any[]).map(karte),
      rueckrufe: (rueckrufe as any[]).map((r) => ({
        personId: Number(r.person_id),
        name: r.name,
        am: r.scheduled_at,
        notiz: r.note,
        tier: Number(r.priority_tier),
        tierGrund: r.tier_reason,
      })).sort((a, b) => +new Date(a.am) - +new Date(b.am)),
    });
  } catch (err) {
    console.error("[AGENT-START] start:", err);
    res.status(500).json({ ok: false, error: "Serverfehler" });
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// GET /agent/kunden/liste — DIE Arbeitsliste
//
// Die Sortierung nimmt dem Agenten die Frage ab, wen er als nächstes anruft.
// Genau diese Frage hat die alte Tagesliste beantwortet — jetzt steht die
// Antwort in derselben Liste, in der auch gearbeitet wird.
// ═══════════════════════════════════════════════════════════════════════════
type Sortierung = "arbeit" | "neu" | "betrag" | "name";

const ORDNUNG: Record<Sortierung, string> = {
  // Arbeitsreihenfolge — die fachliche Rangfolge, in SQL gegossen:
  //   1 Zusage heute oder überfällig   (ein gegebenes Wort hat ein Datum)
  //   2 Rückruf heute oder überfällig  (ein vereinbarter Termin)
  //   3 Tier 1 — Zahlung gemeldet
  //   4 Tier 2 — Rechnung offen, dann Frist abgelaufen, dann Antrag fertig
  //   5 Tier 3 — Antrag abgebrochen, dann nur Lead
  // Innerhalb jeder Gruppe: längste Wartezeit zuerst.
  arbeit: `
    CASE
      -- 1 Gebuchter Termin heute. Der Kunde hat sich die Uhrzeit selbst
      --   ausgesucht und wartet — das schlaegt alles andere.
      WHEN EXISTS (
        SELECT 1 FROM fiaon_termine t
        WHERE t.person_id = p.id AND t.status = 'gebucht'
          AND t.beginn::date = ${HEUTE}
      ) THEN 1
      WHEN p.promised_payment_date IS NOT NULL AND p.promised_payment_date <= ${HEUTE} THEN 2
      WHEN EXISTS (
        SELECT 1 FROM fiaon_contact_log cl JOIN fiaon_applications a3 ON a3.ref = cl.ref
        WHERE a3.person_id = p.id AND cl.outcome = 'rueckruf_termin' AND cl.done_at IS NULL
          AND cl.voided_at IS NULL AND cl.scheduled_at IS NOT NULL AND cl.scheduled_at <= NOW()
      ) THEN 3
      -- Ab hier die Stufen: A vor B vor C. Innerhalb von B bleibt die
      -- bewaehrte Feinsortierung (offene Rechnung vor abgelaufener Frist).
      WHEN p.priority_tier = 1 THEN 4
      WHEN p.priority_tier = 2 AND p.tier_reason = 'rechnung_offen' THEN 5
      WHEN p.priority_tier = 2 AND p.tier_reason = 'zahlungsfrist_abgelaufen' THEN 6
      WHEN p.priority_tier = 2 THEN 7
      WHEN p.priority_tier = 3 AND p.tier_reason = 'antrag_abgebrochen' THEN 8
      ELSE 9
    END ASC,
    -- Innerhalb des Termin-Rangs nach Uhrzeit: 09:20 vor 14:40.
    (SELECT MIN(t2.beginn) FROM fiaon_termine t2
      WHERE t2.person_id = p.id AND t2.status = 'gebucht' AND t2.beginn > NOW()) ASC NULLS LAST,
    (SELECT MAX(cl.created_at) FROM fiaon_contact_log cl
      JOIN fiaon_applications a4 ON a4.ref = cl.ref
      WHERE a4.person_id = p.id AND cl.voided_at IS NULL) ASC NULLS FIRST,
    p.id ASC`,
  neu: `p.assigned_at DESC NULLS LAST, p.id DESC`,
  betrag: `(SELECT MAX(a5.amount_due) FROM fiaon_applications a5
             WHERE a5.person_id = p.id AND a5.merged_into IS NULL) DESC NULLS LAST, p.id ASC`,
  name: `${NAME_SQL} ASC`,
};

/**
 * GET /agent/termine/faellig — was steht in der nächsten halben Stunde an?
 *
 * ── DER AUFTRAG (11.08.2026) ───────────────────────────────────────────────
 * Ein Agent: „Bei gebuchten Terminen/Rückrufen gibt es aktuell keine
 * Erinnerung, wodurch Termine schnell übersehen oder verpasst werden können."
 *
 * Eine Mail-Erinnerung gibt es bereits (`runCallbackReminders`, 60 Minuten
 * vorher über Make). Sie hängt an einem externen Dienst, einer
 * Zweig-Konfiguration und einem offenen Postfach.
 *
 * Diese Route bedient die Leiste IM PORTAL — sie braucht nichts davon.
 *
 * ── AUCH DAS ÜBERFÄLLIGE ───────────────────────────────────────────────────
 * Ein Termin, der vor zwanzig Minuten war, ist wichtiger als einer in zwanzig
 * Minuten. Deshalb reicht das Fenster zwei Stunden zurück: Wer gerade
 * telefoniert hat und danach ins Portal schaut, soll sehen, was er verpasst
 * hat — nicht nur, was kommt.
 */
router.get("/agent/termine/faellig", requireAgent, async (req: AgentRequest, res: Response) => {
  try {
    const vorlauf = Math.min(120, Math.max(5, Number(req.query.vorlauf) || 30));
    const me = req.agent!.id;

    const [rueckrufe, gespraeche] = await Promise.all([
      // Rückrufe aus dem Kontaktverlauf.
      sqlPool`
        SELECT DISTINCT ON (a.person_id)
               cl.id AS log_id, a.person_id, cl.scheduled_at, cl.note,
               COALESCE(NULLIF(TRIM(CONCAT_WS(' ', p.first_name, p.last_name)), ''),
                        p.company_name, p.contact_name, p.primary_phone, 'Ohne Namen') AS name
        FROM fiaon_contact_log cl
        JOIN fiaon_applications a ON a.ref = cl.ref
        JOIN fiaon_persons p ON p.id = a.person_id
        WHERE cl.agent_id = ${me}
          AND cl.outcome = 'rueckruf_termin'
          AND cl.done_at IS NULL AND cl.voided_at IS NULL
          AND cl.scheduled_at IS NOT NULL
          AND cl.scheduled_at BETWEEN NOW() - INTERVAL '2 hours'
                                  AND NOW() + (${vorlauf} || ' minutes')::interval
          AND p.merged_into_person_id IS NULL
        ORDER BY a.person_id, cl.scheduled_at DESC
      `,
      // Und gebuchte Startgespräche.
      sqlPool`
        SELECT t.id AS log_id, t.person_id, t.beginn AS scheduled_at, NULL::text AS note,
               COALESCE(NULLIF(TRIM(CONCAT_WS(' ', p.first_name, p.last_name)), ''),
                        p.company_name, p.contact_name, 'Ohne Namen') AS name
        FROM fiaon_termine t
        JOIN fiaon_persons p ON p.id = t.person_id
        WHERE t.agent_id = ${me} AND t.status = 'gebucht'
          AND t.beginn BETWEEN NOW() - INTERVAL '2 hours'
                           AND NOW() + (${vorlauf} || ' minutes')::interval
          AND p.merged_into_person_id IS NULL
      `.catch(() => [] as any[]),
    ]);

    const bauen = (r: any, art: "rueckruf" | "startgespraech") => ({
      logId: Number(r.log_id),
      personId: Number(r.person_id),
      name: String(r.name),
      wann: new Date(r.scheduled_at).toISOString(),
      inMinuten: Math.round((new Date(r.scheduled_at).getTime() - Date.now()) / 60_000),
      notiz: r.note ? String(r.note).slice(0, 90) : null,
      art,
    });

    res.json({
      ok: true,
      termine: [
        ...(rueckrufe as any[]).map((r) => bauen(r, "rueckruf")),
        ...(gespraeche as any[]).map((r) => bauen(r, "startgespraech")),
      ].sort((a, b) => a.inMinuten - b.inMinuten),
    });
  } catch (err) {
    console.error("[AGENT] termine/faellig:", err);
    res.status(500).json({ ok: false, error: "Serverfehler" });
  }
});

router.get("/agent/kunden/liste", requireAgent, async (req: AgentRequest, res: Response) => {
  try {
    // ══════════════════════════════════════════════════════════════════════
    // DAS FORDERUNGSMANAGEMENT SIEHT DIESE LISTE NICHT
    //
    // ── DER BEFUND ────────────────────────────────────────────────────────
    // Der Vorgesetzte: „Die Abteilung Forderungsmanagement hat Kunden drinnen,
    // die die Agenten abgelehnt haben oder auf nicht erreicht. Das ist falsch!
    // Das Forderungsmanagement hat NUR ausschließlich die Kunden, die ihr Abo
    // nicht bezahlt haben."
    //
    // Die Rate-Liste selbst war sauber — gemessen: alle 100 Zeilen `tier 0
    // (bezahlt)`, keine abgelehnte, keine nicht erreichte. Das Leck war ein
    // anderes: Der Menüpunkt „Kunden" trug KEINE Rollenbeschränkung. Ein
    // Inkasso-Konto meldet sich an, sieht „Kunden" im Menü und öffnet damit
    // die volle Vertriebsliste — mit Ablehnungen, Leads und allem.
    //
    // ── DIE WAND STEHT IM SERVER, NICHT IM MENÜ ───────────────────────────
    // Einen Menüpunkt auszublenden ist keine Grenze, sondern eine Bitte: Die
    // Adresse steht weiter offen, und wer sie einmal gesehen hat, ruft sie
    // wieder auf. Dieselbe Bauweise wie beim Vertrieb und beim Onboarding.
    // ══════════════════════════════════════════════════════════════════════
    const { istInkasso } = await import("./fiaon-inkasso-bereich");
    if (await istInkasso(req.agent!.id)) {
      return res.status(404).json({
        ok: false,
        error: "Diese Liste gibt es für dich nicht. Deine Arbeit steht unter „Forderungen“ — "
          + "dort stehen ausschließlich Kunden mit einer offenen Rate.",
      });
    }

    await ensureBetreuungSpalte(sqlPool);
    const me = req.agent!.id;
    const filter = String(req.query.filter || "alle");
    const sortRoh = String(req.query.sort || "arbeit") as Sortierung;
    const sort: Sortierung = ORDNUNG[sortRoh] ? sortRoh : "arbeit";
    const q = String(req.query.q || "").trim();
    const limit = Math.min(500, Math.max(1, Number(req.query.limit) || 300));

    // ══════════════════════════════════════════════════════════════════════
    // EIN ANGESPRUNGENER KUNDE STEHT IMMER IN DER LISTE
    //
    // ── DER BEFUND (11.08.2026) ───────────────────────────────────────────
    // Ein Agent: „Wenn ich auf einen gebuchten Termin klicke, lande ich zwar
    // im Bereich Kunden, aber nicht beim entsprechenden Kunden und muss ihn
    // anschließend nochmal manuell suchen."
    //
    // Der Sprung (?person=) war gebaut — er ging nur ins Leere, wenn der Kunde
    // nicht in der gefilterten Liste steht. Ein Rückruf kann bei jemandem
    // liegen, der ruht, bezahlt hat oder in einer anderen Stufe ist.
    //
    // Diese eine Kennung hebt jeden Filter auf. Die Rechteprüfung bleibt:
    // `assigned_agent_id = $1` steht unverändert davor, also sieht niemand
    // einen fremden Kunden.
    // ══════════════════════════════════════════════════════════════════════
    const nurPerson = req.query.person ? Number(req.query.person) : null;

    const wo: string[] = [
      "p.assigned_agent_id = $1",
      "p.merged_into_person_id IS NULL",
      // Testeinträge sind keine Kunden (server/lib/fiaon-testerkennung.ts).
      "p.ist_test_am IS NULL",
    ];
    // Bezahlte Kunden sind KEIN Arbeitsvorrat. Sie sind über den eigenen Filter
    // erreichbar, stehen aber nie in der Standardliste — sonst arbeitet man sich
    // durch Menschen, die schon gezahlt haben.
    if (filter === "bezahlt") wo.push("p.priority_tier = 0");
    else if (filter === "gesperrt") wo.push("p.is_blocked");
    else {
      wo.push("p.priority_tier BETWEEN 1 AND 3", "NOT p.is_blocked");
      if (filter === "tier1") wo.push("p.priority_tier = 1");
      else if (filter === "rechnung_offen") wo.push("p.tier_reason = 'rechnung_offen'");
      else if (filter === "frist_abgelaufen") wo.push("p.tier_reason = 'zahlungsfrist_abgelaufen'");
      else if (filter === "antrag_offen") wo.push("p.tier_reason IN ('antrag_abgeschlossen', 'antrag_abgebrochen')");
      else if (filter === "leads") wo.push("p.priority_tier = 3");
      else if (filter === "zusage_heute") wo.push(`p.promised_payment_date = ${HEUTE}`);
      else if (filter === "ueberfaellig") wo.push(`p.promised_payment_date < ${HEUTE}`);
      else if (filter === "rueckruf") {
        wo.push(`EXISTS (
          SELECT 1 FROM fiaon_contact_log cl JOIN fiaon_applications a6 ON a6.ref = cl.ref
          WHERE a6.person_id = p.id AND cl.outcome = 'rueckruf_termin'
            AND cl.done_at IS NULL AND cl.voided_at IS NULL)`);
      } else if (filter === "nicht_erreicht") wo.push("p.unreachable_count > 0");
      else if (filter === "ruhend") wo.push(ruhtSql("p"));

      // ── DER RUHE-POOL IST KEIN VERSTECKTES LOCH ──────────────────────────
      // Wer viermal nicht erreicht wurde, verschwindet aus der TAGESLISTE —
      // nicht aus dem Bestand. Deshalb wird er nur in den Ansichten
      // ausgeblendet, in denen der Agent „wen rufe ich jetzt an?" fragt.
      // Im Filter „Ruhend" und in jeder gezielten Suche steht er weiter da;
      // eine Suche, die einen Kunden nicht findet, den es gibt, ist der
      // schlimmere Fehler.
      if (!["ruhend", "nicht_erreicht", "gesperrt", "bezahlt"].includes(filter) && !q) {
        wo.push(`NOT ${ruhtSql("p")}`);

        // ══════════════════════════════════════════════════════════════════
        // WER EINE VERABREDUNG IN DER ZUKUNFT HAT, IST HEUTE FERTIG
        //
        // ── DER ANLASS ────────────────────────────────────────────────────
        // Ein Agent: „Wenn ich den Kunden ‚nicht erreicht' klicke, bleibt er
        // trotzdem in der Liste — verschwinden tut er bei mir nicht."
        //
        // Gemessen am 11.08.2026: **311 Kunden** hatten eine Wiedervorlage in
        // der Zukunft und standen trotzdem in den Arbeitslisten. Das Ergebnis
        // setzte `follow_up_date = morgen`, aber die Liste sah es nicht an.
        //
        // Die Folge ist genau die, die der Agent beschreibt: Er ruft denselben
        // Menschen zweimal an. Für den Kunden ist das aufdringlich, für den
        // Agenten Zeitverlust, und die Liste wird nie kürzer — sie ist ein
        // Eimer ohne Boden.
        //
        // ── DIE REGEL ─────────────────────────────────────────────────────
        // Eine Wiedervorlage in der Zukunft ist eine VERABREDUNG. Wer sie hat,
        // gehört heute nicht in die Frage „wen rufe ich jetzt an?".
        //
        // Ausgenommen: eine Zahlungszusage. Wer für den 20. zugesagt hat, muss
        // trotzdem sichtbar bleiben — nicht zum Anrufen, sondern weil sein
        // Geld erwartet wird. Dafür gibt es die Filter „Zusage heute" und
        // „Überfällig".
        //
        // Der Kunde ist NICHT weg: Er steht im Filter „Nicht erreicht" und in
        // jeder Suche. Eine Liste, die einen Kunden versteckt, den es gibt,
        // wäre der schlimmere Fehler.
        // ══════════════════════════════════════════════════════════════════
        wo.push(`(p.follow_up_date IS NULL OR p.follow_up_date <= ${HEUTE})`);
      }
    }

    // Drei unabhängige Auskünfte — gleichzeitig, nicht hintereinander. Sonst
    // kostet die Liste drei Wege zur Datenbank statt einem (siehe Startseite).
    const [rows, zR, rueckrufR] = await Promise.all([
      sqlPool.unsafe(`
      SELECT ${KARTE_SQL}
      FROM fiaon_persons p
      WHERE (${wo.join(" AND ")}${nurPerson && Number.isFinite(nurPerson)
        ? `\n             OR (p.assigned_agent_id = $1 AND p.id = ${Math.trunc(nurPerson)})` : ""})
        AND ($2 = '' OR ${NAME_SQL} ILIKE '%' || $2 || '%'
             OR COALESCE(p.primary_email, '') ILIKE '%' || $2 || '%'
             OR COALESCE(p.primary_phone, '') ILIKE '%' || $2 || '%'
             OR EXISTS (SELECT 1 FROM fiaon_applications a7 WHERE a7.person_id = p.id
                          AND (a7.ref ILIKE '%' || $2 || '%'
                               OR COALESCE(a7.payment_reference, '') ILIKE '%' || $2 || '%')))
      ORDER BY ${ORDNUNG[sort]}
      LIMIT ${limit}
    `, [me, q]),
      // Zähler für die Filter-Chips — in EINER Abfrage, damit die Chips nicht
      // zehn Anfragen kosten.
      sqlPool`
      SELECT
        -- ══════════════════════════════════════════════════════════════════
        -- DIE ZÄHLER MÜSSEN DIESELBE MENGE ZÄHLEN WIE DIE LISTE ZEIGT
        --
        -- ── DER BEFUND (11.08.2026) ───────────────────────────────────────
        -- Ein Agent: „Die Zahlen oben stimmen teilweise nicht mit den
        -- tatsächlich enthaltenen Kunden überein. Beispiel: Zahlung gemeldet
        -- zeigt 23, im Ordner befinden sich aber nur 2."
        --
        -- Die Liste filtert zwei Dinge zusätzlich, die hier fehlten:
        --   ist_test_am IS NULL   Testeinträge sind keine Kunden
        --   NOT ruht              wer viermal nicht erreicht wurde, ruht
        --
        -- Heute ergibt beides zufällig dieselbe Zahl (gemessen bei allen fünf
        -- Agenten: keine Lücke). Das ist kein Zustand, auf den man baut —
        -- sobald ein Kunde in den Ruhe-Pool wandert, klafft sie wieder.
        --
        -- Ein Zähler, der eine andere Menge zählt als die Liste zeigt, ist der
        -- schlimmere Fehler: Dann traut man keiner Zahl mehr.
        -- ══════════════════════════════════════════════════════════════════
        COUNT(*) FILTER (WHERE priority_tier BETWEEN 1 AND 3 AND NOT is_blocked
          AND ist_test_am IS NULL)::int AS alle,
        COUNT(*) FILTER (WHERE priority_tier = 1 AND NOT is_blocked
          AND ist_test_am IS NULL)::int AS tier1,
        COUNT(*) FILTER (WHERE tier_reason = 'rechnung_offen' AND NOT is_blocked AND ist_test_am IS NULL)::int AS rechnung_offen,
        COUNT(*) FILTER (WHERE tier_reason = 'zahlungsfrist_abgelaufen' AND NOT is_blocked AND ist_test_am IS NULL)::int AS frist_abgelaufen,
        COUNT(*) FILTER (WHERE tier_reason IN ('antrag_abgeschlossen','antrag_abgebrochen') AND NOT is_blocked AND ist_test_am IS NULL)::int AS antrag_offen,
        COUNT(*) FILTER (WHERE priority_tier = 3 AND NOT is_blocked
          AND ist_test_am IS NULL)::int AS leads,
        COUNT(*) FILTER (WHERE promised_payment_date = ${sqlPool.unsafe(HEUTE)} AND NOT is_blocked AND priority_tier BETWEEN 1 AND 3
          AND ist_test_am IS NULL)::int AS zusage_heute,
        COUNT(*) FILTER (WHERE promised_payment_date < ${sqlPool.unsafe(HEUTE)} AND NOT is_blocked AND priority_tier BETWEEN 1 AND 3
          AND ist_test_am IS NULL)::int AS ueberfaellig,
        COUNT(*) FILTER (WHERE unreachable_count > 0 AND NOT is_blocked AND priority_tier BETWEEN 1 AND 3
          AND ist_test_am IS NULL)::int AS nicht_erreicht,
        -- ── WER WARTET AUF SEINEN TERMIN? ──────────────────────────────────
        -- Die Zahl beantwortet die Frage, die entsteht, sobald Karten
        -- verschwinden: „Wo sind die Leute hin, die ich nicht erreicht habe?"
        -- Ohne sie fühlt sich das Verschwinden wie ein Verlust an — und genau
        -- dieses Gefühl hat dazu geführt, dieselben Menschen zweimal
        -- anzurufen.
        COUNT(*) FILTER (WHERE follow_up_date > CURRENT_DATE AND NOT is_blocked
                         AND priority_tier BETWEEN 1 AND 3)::int AS wartet,
        -- Wer wartet auf eine Terminbuchung? Diese Zahl beantwortet die Frage
        -- „wo sind die Leute hin, die ich nicht erreicht habe".
        COUNT(*) FILTER (WHERE follow_up_date > CURRENT_DATE AND NOT is_blocked
                         AND priority_tier BETWEEN 1 AND 3)::int AS wartet,
        COUNT(*) FILTER (WHERE priority_tier = 0)::int AS bezahlt,
        COUNT(*) FILTER (WHERE is_blocked)::int AS gesperrt,
        -- Der eigene Vorrat je Stufe. Die drei Zahlen im Kopf der Liste sagen
        -- dem Agenten in einer Sekunde, ob er in der Pflicht (A/B) oder in der
        -- Kür (C) arbeitet. Ruhende zählen NICHT mit — sie sind heute nicht dran.
        COUNT(*) FILTER (WHERE priority_tier = 1 AND NOT is_blocked AND NOT ruht)::int AS stufe_a,
        COUNT(*) FILTER (WHERE priority_tier = 2 AND NOT is_blocked AND NOT ruht)::int AS stufe_b,
        COUNT(*) FILTER (WHERE priority_tier = 3 AND NOT is_blocked AND NOT ruht)::int AS stufe_c,
        COUNT(*) FILTER (WHERE ruht)::int AS ruhend
      FROM (
        SELECT p.*, ${sqlPool.unsafe(ruhtSql("p"))} AS ruht
        FROM fiaon_persons p
        WHERE p.assigned_agent_id = ${me} AND p.merged_into_person_id IS NULL
      ) p
    `,
      sqlPool`
      SELECT COUNT(DISTINCT a.person_id)::int AS c
      FROM fiaon_contact_log cl
      JOIN fiaon_applications a ON a.ref = cl.ref
      JOIN fiaon_persons p ON p.id = a.person_id
      WHERE cl.outcome = 'rueckruf_termin' AND cl.done_at IS NULL AND cl.voided_at IS NULL
        AND p.assigned_agent_id = ${me} AND NOT p.is_blocked AND p.priority_tier BETWEEN 1 AND 3
    `,
    ]);
    const z = (zR as any[])[0] || {};
    const rueckrufZahl = (rueckrufR as any[])[0] || { c: 0 };

    res.json({
      ok: true,
      anzahl: rows.length,
      sort,
      filter,
      zaehler: {
        alle: z.alle, tier1: z.tier1, rechnung_offen: z.rechnung_offen,
        frist_abgelaufen: z.frist_abgelaufen, antrag_offen: z.antrag_offen,
        leads: z.leads, zusage_heute: z.zusage_heute, ueberfaellig: z.ueberfaellig,
        rueckruf: rueckrufZahl.c, nicht_erreicht: z.nicht_erreicht, wartet: z.wartet,
        bezahlt: z.bezahlt, gesperrt: z.gesperrt, ruhend: z.ruhend,
      },
      // Der Vorrat je Stufe für den Kopf der Liste.
      vorrat: { A: Number(z.stufe_a || 0), B: Number(z.stufe_b || 0), C: Number(z.stufe_c || 0) },
      kunden: (rows as any[]).map(karte),
    });
  } catch (err) {
    console.error("[AGENT-START] kundenliste:", err);
    res.status(500).json({ ok: false, error: "Serverfehler" });
  }
});

export default router;
