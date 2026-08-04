// ═══════════════════════════════════════════════════════════════════
// FIAON Admin-Kommandozentrale (Paket O) — Read-only-Endpoints für den Hub
// - /admin/hub/stats:      Tages-Kennzahlen für /admin (Kopfbereich)
// - /admin/search:         Globale Schnellsuche (Cmd+K) über Kunden + Agents
// - /admin/invoices:       Rechnungs-Übersicht (Nummernkreis, Download-Links)
// - /admin/system-status:  Base-URL, Make-Webhook-Diagnose, INVOICE_VAT_MODE
// - /admin/legal-review:   LEGAL_REVIEW_PACKAGE.md read-only anzeigen
// Agent-Tokens werden durch blockAgentsFromAdmin (fiaon-agent.ts, davor
// gemountet) mit 403 abgewiesen. Keine Logik-/Schreib-Endpoints hier.
// ═══════════════════════════════════════════════════════════════════

import { Router } from "express";
import { sqlPool } from "../lib/db-pool";
import { readFile } from "fs/promises";
import path from "path";
import { getSettings, setSetting } from "./fiaon-agent";
import { baseUrlDiagnostics, absoluteUrl } from "../fiaon-base-url";
import { sendMakeWebhook, makePayloadFromRow, type MakeWebhookPayload } from "../make-webhook";
import { MAKE_EVENT_REGISTRY, getEventDef } from "../make-events-registry";
import { signInvoiceUrl } from "../fiaon-invoice";
import { berlinToday } from "../lib/fiaon-time";

const router = Router();

// ── O1: Tages-Kennzahlen ─────────────────────────────────────────────────────
router.get("/admin/hub/stats", async (_req, res) => {
  try {
    // `ist_entwurf` ausschliessen: 3.236 Zeilen (54 % des Bestands) haben weder
    // E-Mail noch Telefon — Menschen, die im Funnel vor dem Kontaktschritt
    // abgesprungen sind. „Neue Anträge heute" war bisher die Summe aus echten
    // Anträgen und diesen Absprüngen. Gepflegt wird das Kennzeichen an genau
    // einer Stelle (fiaon-person-model.ts), hier wird es nur gelesen.
    const [row] = await sqlPool`
      SELECT
        COUNT(*) FILTER (WHERE created_at::date = CURRENT_DATE AND merged_into IS NULL AND NOT ist_entwurf) AS today_new,
        COUNT(*) FILTER (WHERE payment_status = 'claimed_paid' AND merged_into IS NULL) AS claimed_count,
        COALESCE(SUM(amount_due) FILTER (WHERE payment_status = 'claimed_paid' AND merged_into IS NULL), 0) AS claimed_sum,
        COUNT(*) FILTER (WHERE payment_status = 'paid' AND payment_reference IS NOT NULL AND completed_at::date = CURRENT_DATE AND merged_into IS NULL) AS today_paid_count,
        COALESCE(SUM(amount_due) FILTER (WHERE payment_status = 'paid' AND payment_reference IS NOT NULL AND completed_at::date = CURRENT_DATE AND merged_into IS NULL), 0) AS today_paid_sum,
        COUNT(*) FILTER (WHERE invoice_number IS NOT NULL AND merged_into IS NULL) AS invoice_count
      FROM fiaon_applications
    `;
    const [payouts] = await sqlPool`
      SELECT COUNT(*) AS open FROM fiaon_payouts WHERE status = 'angefordert'
    `.catch(() => [{ open: 0 }] as any);
    const [agents] = await sqlPool`
      SELECT COUNT(*) FILTER (WHERE active) AS active,
             COUNT(*) FILTER (WHERE bank_change_ack = FALSE) AS bank_changes
      FROM fiaon_agents
    `.catch(() => [{ active: 0, bank_changes: 0 }] as any);
    res.json({
      ok: true,
      todayNew: Number(row.today_new),
      claimed: { count: Number(row.claimed_count), sum: Number(row.claimed_sum) },
      todayPaid: { count: Number(row.today_paid_count), sum: Number(row.today_paid_sum) },
      invoiceCount: Number(row.invoice_count),
      openPayouts: Number(payouts.open),
      activeAgents: Number(agents.active),
      bankChanges: Number(agents.bank_changes),
    });
  } catch (err) {
    console.error("[FIAON-HUB] stats:", err);
    res.status(500).json({ ok: false, error: "Serverfehler" });
  }
});

// ── P4-A: Hinweis-Badges + Aufgaben + Warnungen — EIN gecachter Endpoint ─────
// Alle Zähler serverseitig in einem Rutsch aggregiert, 60 s In-Memory-Cache
// (512-MB-Budget: nur ein kleines JSON-Objekt, keine Listen). Frontend pollt
// alle 60 s — kein Realtime-Stack, keine sechs Einzel-Requests.
let badgeCache: { at: number; data: any } | null = null;
const BADGE_CACHE_MS = 60_000;

async function computeBadges(): Promise<any> {
  const [apps] = await sqlPool`
    SELECT
      COUNT(*) FILTER (WHERE payment_status = 'claimed_paid' AND merged_into IS NULL)::int AS zahlungen,
      COUNT(*) FILTER (WHERE payment_status = 'paid' AND merged_into IS NULL
        AND COALESCE(commission_basis, '') <> 'direktzahler'
        AND assigned_agent_id IS NOT NULL
        AND NOT EXISTS (SELECT 1 FROM fiaon_commissions c WHERE c.ref = fiaon_applications.ref AND c.amount_cents > 0 AND c.status <> 'storniert')
      )::int AS nachbuchung
    FROM fiaon_applications
  `;
  const [dup] = await sqlPool`
    SELECT COUNT(*)::int AS c FROM (
      SELECT LOWER(TRIM(email)) FROM fiaon_applications
      WHERE merged_into IS NULL AND email IS NOT NULL AND TRIM(email) <> ''
      GROUP BY LOWER(TRIM(email))
      HAVING COUNT(*) > 1
         AND COUNT(*) FILTER (WHERE payment_status IN ('pending_payment', 'claimed_paid')) > 0
    ) x
  `;
  const [payouts] = await sqlPool`
    SELECT COUNT(*)::int AS c FROM fiaon_payouts WHERE status = 'angefordert'
  `.catch(() => [{ c: 0 }] as any);
  // #18: „Lange bezahlt, nie bestätigt" — Kunden, die seit > 7 Tagen „Ich habe
  // überwiesen" gemeldet haben (claimed_paid), aber nie auf 'paid' bestätigt
  // wurden. Hier liegt unerkannter Umsatz. MIN(...) für die Alter-Anzeige.
  const [payConfirm] = await sqlPool`
    SELECT COUNT(*)::int AS c,
           FLOOR(EXTRACT(EPOCH FROM (NOW() - MIN(claimed_paid_at))) / 86400)::int AS oldest_days
    FROM fiaon_applications
    WHERE payment_status = 'claimed_paid' AND merged_into IS NULL
      AND claimed_paid_at IS NOT NULL AND claimed_paid_at < NOW() - INTERVAL '7 days'
  `.catch(() => [{ c: 0, oldest_days: null }] as any);
  // Prompt 2/3: Badge zeigt Tickets, die auf eine BETREIBER-ANTWORT warten —
  // nicht alle offenen. „Wartet" = der jüngste echte Beitrag (agent/admin) im
  // Thread stammt vom Agenten. Fällt auf „offen" zurück, falls (noch) kein
  // Verlauf existiert (defensiv gegen Alt-Daten).
  const [feedback] = await sqlPool`
    SELECT COUNT(*)::int AS c FROM fiaon_agent_feedback f
    WHERE (
      SELECT m.author FROM fiaon_agent_feedback_messages m
      WHERE m.feedback_id = f.id AND m.author IN ('agent', 'admin')
      ORDER BY m.created_at DESC, m.id DESC LIMIT 1
    ) = 'agent'
  `.catch(() => [{ c: 0 }] as any);
  const [bank] = await sqlPool`
    SELECT COUNT(*) FILTER (WHERE match_status = 'unmatched' AND applied = FALSE)::int AS unmatched,
           COUNT(*) FILTER (WHERE match_status IN ('matched', 'manual') AND applied = FALSE)::int AS matched_unapplied
    FROM fiaon_bank_txns
  `.catch(() => [{ unmatched: 0, matched_unapplied: 0 }] as any);

  // Warn-Signale (echte Probleme, mit Erklärung + Lösung im Frontend)
  const [leadIntake] = await sqlPool`
    SELECT EXTRACT(EPOCH FROM (NOW() - MAX(erstellt_am))) / 3600 AS hours FROM fiaon_leads
  `.catch(() => [{ hours: null }] as any);
  const [blockedAkten] = await sqlPool`
    SELECT COUNT(*)::int AS c, MIN(ag.name) AS first_agent
    FROM fiaon_leads l JOIN fiaon_agents ag ON ag.id = l.opened_by_agent_id
    WHERE l.opened_at IS NOT NULL AND l.status IN ('neu', 'kontaktiert', 'nicht_erreichbar')
  `.catch(() => [{ c: 0, first_agent: null }] as any);
  // P5-D: kritische Diagnose-Ereignisse der letzten 24 h — Nav-Badge + Warn-Kachel.
  const [diag] = await sqlPool`
    SELECT COUNT(DISTINCT fingerprint)::int AS c
    FROM fiaon_diagnostics
    WHERE severity = 'kritisch' AND created_at > NOW() - INTERVAL '24 hours'
  `.catch(() => [{ c: 0 }] as any);
  const settings = await getSettings();

  return {
    // Badges (Nav): Schlüssel = Nav-Pfad-Kürzel; 0 ⇒ Frontend blendet aus.
    badges: {
      zahlungen: Number(apps.zahlungen),
      auszahlungen: Number(payouts.c),
      feedback: Number(feedback.c),
      nachbuchung: Number(apps.nachbuchung),
      dubletten: Number(dup.c),
      kontoabgleich: Number(bank.unmatched),
      diagnose: Number(diag.c), // P5-D: kritische Ereignisse (24 h)
    },
    // Zusatzsignale für die Dashboard-Warn-Kacheln
    warn: {
      leadIntakeHours: leadIntake.hours != null ? Math.round(Number(leadIntake.hours)) : null,
      followupPaused: settings.lead_followup_enabled !== "1",
      bankMatchedUnapplied: Number(bank.matched_unapplied),
      blockedAkten: Number(blockedAkten.c),
      blockedAktenAgent: blockedAkten.first_agent || null,
      criticalDiagnostics: Number(diag.c), // P5-D: eine Wahrheit, zwei Ansichten
      // #18: seit > 7 Tagen angekündigt, nie bestätigt (unerkannter Umsatz)
      paymentConfirmBacklog: Number(payConfirm.c),
      paymentConfirmOldestDays: payConfirm.oldest_days != null ? Number(payConfirm.oldest_days) : null,
    },
    at: new Date().toISOString(),
  };
}

router.get("/admin/hub/badges", async (_req, res) => {
  try {
    if (badgeCache && Date.now() - badgeCache.at < BADGE_CACHE_MS) {
      return res.json({ ok: true, cached: true, ...badgeCache.data });
    }
    const data = await computeBadges();
    badgeCache = { at: Date.now(), data };
    res.json({ ok: true, cached: false, ...data });
  } catch (err) {
    console.error("[FIAON-HUB] badges:", err);
    res.status(500).json({ ok: false, error: "Serverfehler" });
  }
});

// ── Lage: die vier Fragen, die das Dashboard beantworten muss ────────────────
// 1. Was haben WIR heute verdient?         → Umsatz bestätigter Zahlungen
// 2. Was haben die AGENTEN verdient?       → Provisionen, Rangliste
// 3. Wie viele Zahlungen sind angekündigt?  → heute und insgesamt
// 4. Was haben die Agenten zugesagt?       → „Kunde zahlt am …", je Agent
//
// Tagesgrenze: Europe/Berlin, nicht UTC. Die Alt-Kennzahlen benutzen
// `::date = CURRENT_DATE` — das ist im Sommer zwei Stunden falsch, eine Zahlung
// um 01:30 Berliner Zeit zählte dort noch zum Vortag. Deshalb hier durchgehend
// (spalte AT TIME ZONE 'Europe/Berlin')::date. Alle Zeitspalten sind timestamptz.
//
// EIN Endpoint, 60 s Cache: das Dashboard soll nicht sechs Abfragen auslösen.
let lageCache: { at: number; data: any } | null = null;
const LAGE_CACHE_MS = 60_000;

export async function computeLage(): Promise<any> {
  // EINE Tagesgrenze für alle vier Abfragen, in JavaScript bestimmt: liefe der
  // Tageswechsel mitten in der Auswertung, würden sich sonst zwei Abfragen auf
  // verschiedene Tage beziehen und die Summen widersprächen sich.
  const heute = berlinToday();

  // 1) Umsatz heute / gestern / Monat — amount_due ist EUR-numeric, daher × 100.
  const [umsatz] = await sqlPool`
    SELECT
      COUNT(*) FILTER (WHERE tag = ${heute}::date)::int                        AS heute_anzahl,
      ROUND(COALESCE(SUM(betrag) FILTER (WHERE tag = ${heute}::date), 0) * 100) AS heute_cents,
      COUNT(*) FILTER (WHERE tag = ${heute}::date - 1)::int                    AS gestern_anzahl,
      ROUND(COALESCE(SUM(betrag) FILTER (WHERE tag = ${heute}::date - 1), 0) * 100) AS gestern_cents,
      COUNT(*) FILTER (WHERE tag >= date_trunc('month', ${heute}::date)::date)::int AS monat_anzahl,
      ROUND(COALESCE(SUM(betrag) FILTER (WHERE tag >= date_trunc('month', ${heute}::date)::date), 0) * 100) AS monat_cents,
      COUNT(*)::int                                                           AS gesamt_anzahl,
      ROUND(COALESCE(SUM(betrag), 0) * 100)                                   AS gesamt_cents
    FROM (
      SELECT (completed_at AT TIME ZONE 'Europe/Berlin')::date AS tag, amount_due AS betrag
      FROM fiaon_applications
      WHERE payment_status = 'paid' AND payment_reference IS NOT NULL
        AND merged_into IS NULL AND completed_at IS NOT NULL
    ) x
  `;

  // 1b) Verlauf der letzten 14 Tage. Eine Tageszahl allein sagt nichts — erst
  //     die Reihe zeigt, ob heute ein guter oder ein schwacher Tag ist. Tage
  //     ohne Zahlung müssen als 0 auftauchen, sonst zieht die Linie eine Lücke
  //     glatt und ein Ausfall wird unsichtbar: daher generate_series + LEFT JOIN.
  const verlauf = await sqlPool`
    SELECT reihe.tag::date AS tag,
           COALESCE(z.anzahl, 0)::int AS anzahl,
           ROUND(COALESCE(z.summe, 0) * 100) AS cents
    FROM generate_series(${heute}::date - 13, ${heute}::date, INTERVAL '1 day') AS reihe(tag)
    LEFT JOIN (
      SELECT (completed_at AT TIME ZONE 'Europe/Berlin')::date AS tag,
             COUNT(*) AS anzahl, SUM(amount_due) AS summe
      FROM fiaon_applications
      WHERE payment_status = 'paid' AND payment_reference IS NOT NULL
        AND merged_into IS NULL AND completed_at IS NOT NULL
        AND (completed_at AT TIME ZONE 'Europe/Berlin')::date >= ${heute}::date - 13
      GROUP BY 1
    ) z ON z.tag = reihe.tag::date
    ORDER BY reihe.tag
  `;

  // 2) Provisionen je Agent — Rangliste nach Monat. Testkonten bleiben draussen,
  //    stornierte Provisionen zählen nicht. `own` = Eigenabschluss (die Zahl, die
  //    Leistung zeigt), `override` = Anteil aus dem Team darunter.
  const agenten = await sqlPool`
    SELECT a.id, a.name, a.avatar,
      COALESCE(SUM(c.amount_cents) FILTER (WHERE (c.created_at AT TIME ZONE 'Europe/Berlin')::date = ${heute}::date), 0)::bigint AS heute_cents,
      COALESCE(SUM(c.amount_cents) FILTER (WHERE (c.created_at AT TIME ZONE 'Europe/Berlin')::date >= date_trunc('month', ${heute}::date)::date), 0)::bigint AS monat_cents,
      COALESCE(SUM(c.amount_cents), 0)::bigint AS gesamt_cents,
      COUNT(c.id) FILTER (WHERE c.kind = 'own' AND (c.created_at AT TIME ZONE 'Europe/Berlin')::date >= date_trunc('month', ${heute}::date)::date)::int AS abschluesse_monat,
      COUNT(c.id) FILTER (WHERE c.kind = 'own')::int AS abschluesse_gesamt
    FROM fiaon_agents a
    LEFT JOIN fiaon_commissions c ON c.agent_id = a.id AND c.status <> 'storniert'
    WHERE a.active AND COALESCE(a.is_test_account, FALSE) = FALSE
    GROUP BY a.id, a.name, a.avatar
    ORDER BY monat_cents DESC, gesamt_cents DESC
  `;

  // 3) Angekündigte Zahlungen des Kunden („Ich habe überwiesen") — heute und
  //    insgesamt. `alt` = älter als 7 Tage: das ist der Stapel, in dem
  //    unerkannter Umsatz liegt.
  const [ankuendigung] = await sqlPool`
    SELECT
      COUNT(*)::int AS gesamt_anzahl,
      ROUND(COALESCE(SUM(amount_due), 0) * 100) AS gesamt_cents,
      COUNT(*) FILTER (WHERE (claimed_paid_at AT TIME ZONE 'Europe/Berlin')::date = ${heute}::date)::int AS heute_anzahl,
      ROUND(COALESCE(SUM(amount_due) FILTER (WHERE (claimed_paid_at AT TIME ZONE 'Europe/Berlin')::date = ${heute}::date), 0) * 100) AS heute_cents,
      COUNT(*) FILTER (WHERE claimed_paid_at < NOW() - INTERVAL '7 days')::int AS alt_anzahl,
      ROUND(COALESCE(SUM(amount_due) FILTER (WHERE claimed_paid_at < NOW() - INTERVAL '7 days'), 0) * 100) AS alt_cents
    FROM fiaon_applications
    WHERE payment_status = 'claimed_paid' AND merged_into IS NULL
  `;

  // 4) Zahlungszusagen, die der Agent aufgenommen hat („Kunde zahlt am …").
  //    DISTINCT ON (ref): pro Kunde zählt nur die JÜNGSTE Zusage, sonst würde ein
  //    dreimal verschobener Termin dreifach in der Statistik stehen. Bereits
  //    bezahlte oder stornierte Bestellungen fallen heraus — eine erfüllte Zusage
  //    ist keine offene Aufgabe.
  const zusagen = await sqlPool`
    WITH neueste AS (
      SELECT DISTINCT ON (l.ref) l.ref, l.agent_id, l.agent_name, l.promised_date
      FROM fiaon_contact_log l
      WHERE l.promised_date IS NOT NULL AND l.voided_at IS NULL
      ORDER BY l.ref, l.promised_date DESC, l.id DESC
    )
    SELECT COALESCE(ag.name, n.agent_name, 'Ohne Agent') AS name, n.agent_id,
      COUNT(*)::int AS gesamt,
      COUNT(*) FILTER (WHERE (n.promised_date AT TIME ZONE 'Europe/Berlin')::date = ${heute}::date)::int AS heute_faellig,
      COUNT(*) FILTER (WHERE (n.promised_date AT TIME ZONE 'Europe/Berlin')::date > ${heute}::date)::int AS kuenftig,
      COUNT(*) FILTER (WHERE (n.promised_date AT TIME ZONE 'Europe/Berlin')::date < ${heute}::date)::int AS ueberfaellig,
      ROUND(COALESCE(SUM(app.amount_due), 0) * 100) AS summe_cents
    FROM neueste n
    JOIN fiaon_applications app ON app.ref = n.ref
      AND app.merged_into IS NULL
      AND app.payment_status NOT IN ('paid', 'cancelled', 'refunded')
    LEFT JOIN fiaon_agents ag ON ag.id = n.agent_id
    GROUP BY COALESCE(ag.name, n.agent_name, 'Ohne Agent'), n.agent_id
    ORDER BY gesamt DESC
  `;

  const summe = (feld: string) => zusagen.reduce((s: number, z: any) => s + Number(z[feld] || 0), 0);
  const zahl = (v: any) => Number(v || 0);

  return {
    umsatz: {
      heute: { anzahl: zahl(umsatz.heute_anzahl), cents: zahl(umsatz.heute_cents) },
      gestern: { anzahl: zahl(umsatz.gestern_anzahl), cents: zahl(umsatz.gestern_cents) },
      monat: { anzahl: zahl(umsatz.monat_anzahl), cents: zahl(umsatz.monat_cents) },
      gesamt: { anzahl: zahl(umsatz.gesamt_anzahl), cents: zahl(umsatz.gesamt_cents) },
      verlauf: verlauf.map((v: any) => ({
        tag: typeof v.tag === "string" ? v.tag : new Date(v.tag).toISOString().slice(0, 10),
        anzahl: zahl(v.anzahl), cents: zahl(v.cents),
      })),
    },
    // Team-Provision: was vom Umsatz an die Agenten geht. Netto = Umsatz − Provision.
    provision: {
      heuteCents: agenten.reduce((s: number, a: any) => s + zahl(a.heute_cents), 0),
      monatCents: agenten.reduce((s: number, a: any) => s + zahl(a.monat_cents), 0),
      gesamtCents: agenten.reduce((s: number, a: any) => s + zahl(a.gesamt_cents), 0),
    },
    agenten: agenten.map((a: any) => {
      const z = zusagen.find((z: any) => Number(z.agent_id) === Number(a.id));
      return {
        id: Number(a.id), name: a.name, avatar: a.avatar || null,
        heuteCents: zahl(a.heute_cents), monatCents: zahl(a.monat_cents), gesamtCents: zahl(a.gesamt_cents),
        abschluesseMonat: zahl(a.abschluesse_monat), abschluesseGesamt: zahl(a.abschluesse_gesamt),
        zusagen: z ? { gesamt: zahl(z.gesamt), heuteFaellig: zahl(z.heute_faellig), kuenftig: zahl(z.kuenftig), ueberfaellig: zahl(z.ueberfaellig), summeCents: zahl(z.summe_cents) } : null,
      };
    }),
    ankuendigungen: {
      heute: { anzahl: zahl(ankuendigung.heute_anzahl), cents: zahl(ankuendigung.heute_cents) },
      gesamt: { anzahl: zahl(ankuendigung.gesamt_anzahl), cents: zahl(ankuendigung.gesamt_cents) },
      alt: { anzahl: zahl(ankuendigung.alt_anzahl), cents: zahl(ankuendigung.alt_cents) },
    },
    zusagen: {
      gesamt: summe("gesamt"), heuteFaellig: summe("heute_faellig"),
      kuenftig: summe("kuenftig"), ueberfaellig: summe("ueberfaellig"),
      summeCents: summe("summe_cents"),
      jeAgent: zusagen.map((z: any) => ({
        name: z.name, agentId: z.agent_id != null ? Number(z.agent_id) : null,
        gesamt: zahl(z.gesamt), heuteFaellig: zahl(z.heute_faellig),
        kuenftig: zahl(z.kuenftig), ueberfaellig: zahl(z.ueberfaellig), summeCents: zahl(z.summe_cents),
      })),
    },
    at: new Date().toISOString(),
  };
}

router.get("/admin/hub/lage", async (_req, res) => {
  try {
    if (lageCache && Date.now() - lageCache.at < LAGE_CACHE_MS) {
      return res.json({ ok: true, cached: true, ...lageCache.data });
    }
    const data = await computeLage();
    lageCache = { at: Date.now(), data };
    res.json({ ok: true, cached: false, ...data });
  } catch (err) {
    console.error("[FIAON-HUB] lage:", err);
    res.status(500).json({ ok: false, error: "Serverfehler" });
  }
});

// ── O3: Globale Schnellsuche (Cmd+K) ─────────────────────────────────────────
// Kunden: Name / E-Mail / Referenz / Zahlungsreferenz / Telefon. Leads: Name /
// E-Mail / Telefon. Agents: Name / E-Mail. (Kunden-IBANs existieren nicht —
// Kunden zahlen an UNS; Agent-IBANs sind verschlüsselt, bewusst nicht suchbar.)
// PROMPT 1/2: Jeder Treffer öffnet DIE AKTE (/admin/kunde/…) — keine Sackgassen,
// kein „nur Rechnung" mehr (ersetzt den kaputten Suchtreffer der Zahlungszentrale).
router.get("/admin/search", async (req, res) => {
  try {
    const q = String(req.query.q || "").trim();
    if (q.length < 2) return res.json({ ok: true, results: [] });
    const like = `%${q}%`;
    const qDigits = q.replace(/\D/g, "");
    const digitsLike = qDigits.length >= 5 ? `%${qDigits}%` : null;
    const customers = await sqlPool`
      SELECT ref, payment_reference, payment_status, amount_due,
             first_name, last_name, contact_name, company_name, email, contact_email
      FROM fiaon_applications
      WHERE merged_into IS NULL AND (
        ref ILIKE ${like} OR payment_reference ILIKE ${like}
        OR first_name ILIKE ${like} OR last_name ILIKE ${like}
        OR company_name ILIKE ${like} OR contact_name ILIKE ${like}
        OR email ILIKE ${like} OR contact_email ILIKE ${like}
        OR phone ILIKE ${like}
        OR (${digitsLike}::text IS NOT NULL AND regexp_replace(COALESCE(phone_country_code,'') || COALESCE(phone,'') , '\\D', '', 'g') LIKE ${digitsLike})
        OR (first_name || ' ' || last_name) ILIKE ${like}
      )
      ORDER BY updated_at DESC NULLS LAST
      LIMIT 8
    `;
    // Leads (nicht konvertierte) — konvertierte laufen über die Antrags-Akte
    const leads = await sqlPool`
      SELECT id, vorname, nachname, email, telefon, status, quelle
      FROM fiaon_leads
      WHERE converted_order_id IS NULL AND (
        vorname ILIKE ${like} OR nachname ILIKE ${like}
        OR (COALESCE(vorname,'') || ' ' || COALESCE(nachname,'')) ILIKE ${like}
        OR email ILIKE ${like}
        OR (${digitsLike}::text IS NOT NULL AND regexp_replace(COALESCE(telefon,''), '\\D', '', 'g') LIKE ${digitsLike})
      )
      ORDER BY erstellt_am DESC
      LIMIT 6
    `.catch(() => [] as any);
    const agents = await sqlPool`
      SELECT id, name, email FROM fiaon_agents
      WHERE name ILIKE ${like} OR email ILIKE ${like}
      LIMIT 4
    `.catch(() => [] as any);

    const results = [
      ...customers.map((c: any) => ({
        type: "kunde",
        label: c.company_name || [c.first_name, c.last_name].filter(Boolean).join(" ") || c.contact_name || c.ref,
        sub: `${c.payment_reference || c.ref}${c.email || c.contact_email ? ` · ${c.email || c.contact_email}` : ""}`,
        status: c.payment_status,
        url: `/admin/kunde/${encodeURIComponent(c.ref)}`,
      })),
      ...leads.map((l: any) => ({
        type: "lead",
        label: [l.vorname, l.nachname].filter(Boolean).join(" ") || l.email || l.telefon || `Lead #${l.id}`,
        sub: `Lead · ${l.quelle || "—"}${l.email ? ` · ${l.email}` : ""}`,
        status: l.status,
        url: `/admin/kunde/lead-${l.id}`,
      })),
      ...agents.map((a: any) => ({
        type: "agent",
        label: a.name,
        sub: a.email,
        status: null,
        url: `/admin/team`,
      })),
    ];
    res.json({ ok: true, results });
  } catch (err) {
    console.error("[FIAON-HUB] search:", err);
    res.status(500).json({ ok: false, error: "Serverfehler" });
  }
});

// ── Rechnungs-Übersicht ──────────────────────────────────────────────────────
router.get("/admin/invoices", async (req, res) => {
  try {
    const q = String(req.query.q || "").trim();
    const like = `%${q}%`;
    const rows = q.length >= 2
      ? await sqlPool`
          SELECT ref, payment_reference, invoice_number, invoice_date, amount_due, payment_status,
                 first_name, last_name, contact_name, company_name, email, contact_email
          FROM fiaon_applications
          WHERE invoice_number IS NOT NULL AND merged_into IS NULL
            AND (invoice_number ILIKE ${like} OR payment_reference ILIKE ${like} OR ref ILIKE ${like}
                 OR first_name ILIKE ${like} OR last_name ILIKE ${like} OR company_name ILIKE ${like}
                 OR email ILIKE ${like} OR contact_email ILIKE ${like})
          ORDER BY invoice_number DESC
          LIMIT 200
        `
      : await sqlPool`
          SELECT ref, payment_reference, invoice_number, invoice_date, amount_due, payment_status,
                 first_name, last_name, contact_name, company_name, email, contact_email
          FROM fiaon_applications
          WHERE invoice_number IS NOT NULL AND merged_into IS NULL
          ORDER BY invoice_number DESC
          LIMIT 200
        `;
    res.json({ ok: true, data: rows });
  } catch (err) {
    console.error("[FIAON-HUB] invoices:", err);
    res.status(500).json({ ok: false, error: "Serverfehler" });
  }
});

// ── System-Status (Diagnose, read-only) ──────────────────────────────────────
router.get("/admin/system-status", async (_req, res) => {
  try {
    const settings = await getSettings();
    let makeLastEvents: Record<string, string> = {};
    try {
      makeLastEvents = JSON.parse(settings.make_last_events || "{}");
    } catch {}
    res.json({
      ok: true,
      baseUrl: baseUrlDiagnostics(),
      makeWebhookConfigured: Boolean(process.env.MAKE_WEBHOOK_URL),
      makeLastEvents,
      invoiceVatMode: (process.env.INVOICE_VAT_MODE || "none").toLowerCase(),
      defaults: {
        commissionRateBp: Number(settings.default_commission_rate_bp),
        payoutMinCents: Number(settings.payout_min_cents),
      },
    });
  } catch (err) {
    console.error("[FIAON-HUB] system-status:", err);
    res.status(500).json({ ok: false, error: "Serverfehler" });
  }
});

// ── Verbuchungen / Finanzen: bestätigte Zahlungen eines Zeitraums ────────────
// Read-only. Zeigt je bestätigte Zahlung (payment_status='paid') den Umsatz,
// den zugewiesenen Agent und dessen eingefrorene Provision (fiaon_commissions).
// Netto = Umsatz − Provisionen (was bei uns bleibt). Alles in Integer-Cents.
// Zeitbezug ist der Bestätigungszeitpunkt completed_at, ausgewertet in
// Europe/Berlin (korrekte Tagesgrenzen). Zeitraum aus fester Whitelist.
const BOOKING_RANGES: Record<string, string> = {
  today: "bd = today",
  yesterday: "bd = today - 1",
  "7d": "bd >= today - 6",
  "30d": "bd >= today - 29",
  month: "date_trunc('month', bd) = date_trunc('month', today)",
};

router.get("/admin/bookings", async (req, res) => {
  try {
    const range = String(req.query.range || "today");
    const cond = BOOKING_RANGES[range] || BOOKING_RANGES.today;
    // Nur whitelisted Ausdrücke werden eingesetzt — keine Nutzereingabe im SQL.
    const rows = await sqlPool.unsafe(`
      WITH b AS (
        SELECT
          a.ref, a.payment_reference, a.invoice_number, a.pack_name, a.amount_due,
          a.completed_at, a.assigned_agent_id,
          a.first_name, a.last_name, a.contact_name, a.company_name,
          a.email, a.contact_email,
          ag.name AS agent_name,
          c.amount_cents AS commission_cents, c.rate_bp,
          (a.completed_at AT TIME ZONE 'Europe/Berlin')::date AS bd,
          (now() AT TIME ZONE 'Europe/Berlin')::date AS today
        FROM fiaon_applications a
        LEFT JOIN fiaon_agents ag ON ag.id = a.assigned_agent_id
        LEFT JOIN LATERAL (
          SELECT amount_cents, rate_bp
          FROM fiaon_commissions
          WHERE ref = a.ref AND amount_cents > 0 AND status <> 'storniert'
          ORDER BY id LIMIT 1
        ) c ON TRUE
        WHERE a.payment_status = 'paid'
          AND a.merged_into IS NULL
          AND a.completed_at IS NOT NULL
      )
      SELECT ref, payment_reference, invoice_number, pack_name, amount_due,
             completed_at, assigned_agent_id, agent_name, commission_cents, rate_bp,
             first_name, last_name, contact_name, company_name, email, contact_email
      FROM b
      WHERE ${cond}
      ORDER BY completed_at DESC
    `);

    const custName = (r: any): string =>
      r.company_name || [r.first_name, r.last_name].filter(Boolean).join(" ") || r.contact_name || r.ref;

    const bookings = rows.map((r: any) => {
      const revenueCents = Math.round(Number(r.amount_due || 0) * 100);
      const commissionCents = Number(r.commission_cents || 0);
      return {
        ref: r.ref,
        paymentReference: r.payment_reference,
        invoiceNumber: r.invoice_number,
        customer: custName(r),
        email: r.email || r.contact_email || null,
        packName: (r.pack_name || "").replace(/\n/g, " ").trim() || null,
        completedAt: r.completed_at,
        agentId: r.assigned_agent_id,
        agentName: r.agent_name,
        rateBp: r.rate_bp != null ? Number(r.rate_bp) : null,
        revenueCents,
        commissionCents,
        netCents: revenueCents - commissionCents,
      };
    });

    // Aggregat gesamt
    const totals = bookings.reduce(
      (acc, b) => {
        acc.count += 1;
        acc.revenueCents += b.revenueCents;
        acc.commissionCents += b.commissionCents;
        return acc;
      },
      { count: 0, revenueCents: 0, commissionCents: 0 },
    );
    const netCents = totals.revenueCents - totals.commissionCents;

    // Aufschlüsselung je Mitarbeiter (ohne Zuweisung = Direktgeschäft)
    const byAgentMap = new Map<string, any>();
    for (const b of bookings) {
      const key = b.agentId != null ? `a${b.agentId}` : "direct";
      let g = byAgentMap.get(key);
      if (!g) {
        g = {
          agentId: b.agentId ?? null,
          agentName: b.agentId != null ? b.agentName || `Agent #${b.agentId}` : "Direkt (ohne Agent)",
          count: 0,
          revenueCents: 0,
          commissionCents: 0,
        };
        byAgentMap.set(key, g);
      }
      g.count += 1;
      g.revenueCents += b.revenueCents;
      g.commissionCents += b.commissionCents;
    }
    const byAgent = Array.from(byAgentMap.values()).sort((a, b) => b.commissionCents - a.commissionCents);

    res.json({
      ok: true,
      range,
      totals: { ...totals, netCents },
      byAgent,
      bookings,
      vatMode: (process.env.INVOICE_VAT_MODE || "none").toLowerCase(),
    });
  } catch (err) {
    console.error("[FIAON-HUB] bookings:", err);
    res.status(500).json({ ok: false, error: "Serverfehler" });
  }
});

// ═══════════════ PAKET T: EVENT-TEST-KONSOLE ═══════════════
// Löst das Make-Struktur-Problem dauerhaft: Make lernt die Payload-Struktur
// eines Events nur beim ersten echten Empfang — über die Konsole lässt sich
// JEDES Registry-Event mit realistischen Beispielwerten (test: true) senden,
// ohne den kompletten Workflow auslösen zu müssen. sendMakeWebhook bleibt
// der einzige Versandweg. Verlauf: letzte 20 Sends in fiaon_settings.

const TEST_HISTORY_KEY = "make_test_history";
const TEST_HISTORY_MAX = 20;

async function recordTestSend(entry: { event: string; email: string; ok: boolean; mode: "test" | "real"; at: string }): Promise<void> {
  try {
    const settings = await getSettings();
    let history: any[] = [];
    try { history = JSON.parse(settings[TEST_HISTORY_KEY] || "[]"); } catch {}
    history.unshift(entry);
    await setSetting(TEST_HISTORY_KEY, JSON.stringify(history.slice(0, TEST_HISTORY_MAX)));
  } catch (err) {
    console.warn("[FIAON-EVENTS] Verlauf-Write fehlgeschlagen:", err instanceof Error ? err.message : err);
  }
}

function eventCustomerName(r: any): string {
  return r.company_name || [r.first_name, r.last_name].filter(Boolean).join(" ") || r.contact_name || r.ref;
}

/** Baut den ECHTEN Payload eines kundengebundenen Events aus einer Bestellzeile —
 *  identisch zu den produktiven Versandpfaden (fiaon-antrag.ts). */
function buildRealPayload(eventType: string, row: any): MakeWebhookPayload {
  const base = makePayloadFromRow(row);
  switch (eventType) {
    case "payment_details":
    case "claim_received":
      return { ...base, invoice_url: row.payment_reference ? signInvoiceUrl(row.payment_reference) : null };
    case "payment_reminder":
      return {
        ...base,
        invoice_url: row.payment_reference ? signInvoiceUrl(row.payment_reference) : null,
        reminder_number: Number(row.reminder_count || 0) + 1,
      };
    case "payment_confirmed":
      return { ...base, login_url: absoluteUrl("/login") };
    default: // welcome
      return base;
  }
}

// T1 + T3: Registry, Diagnose (letzter Versand je Event) und Test-Verlauf
router.get("/admin/events/registry", async (_req, res) => {
  try {
    const settings = await getSettings();
    let lastEvents: Record<string, string> = {};
    let history: any[] = [];
    try { lastEvents = JSON.parse(settings.make_last_events || "{}"); } catch {}
    try { history = JSON.parse(settings[TEST_HISTORY_KEY] || "[]"); } catch {}
    // makeBranchReady: heuristisch — Events mit „Betreiber-TODO" in der Beschreibung
    // oder recommendationOnly haben (noch) keinen Make-Zweig → UI zeigt Hinweis.
    const events = MAKE_EVENT_REGISTRY.map((e) => ({
      ...e,
      makeBranchReady: !e.deprecated && !e.recommendationOnly && !/Betreiber-TODO/i.test(e.description),
    }));
    res.json({
      ok: true,
      events,
      makeWebhookConfigured: Boolean(process.env.MAKE_WEBHOOK_URL),
      lastEvents,
      history,
    });
  } catch (err) {
    console.error("[FIAON-EVENTS] registry:", err);
    res.status(500).json({ ok: false, error: "Serverfehler" });
  }
});

// T2: Test-Versand — Beispiel-Payload (optional editiert), email ersetzt, test: true
router.post("/admin/events/test", async (req, res) => {
  try {
    const { eventType, email, payload } = req.body || {};
    const def = getEventDef(String(eventType || ""));
    if (!def) return res.status(400).json({ ok: false, error: "Unbekannter Event-Typ" });
    const to = String(email || "").trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)) return res.status(400).json({ ok: false, error: "Gültige Test-E-Mail-Adresse angeben" });
    if (!process.env.MAKE_WEBHOOK_URL) {
      return res.status(400).json({ ok: false, error: "MAKE_WEBHOOK_URL ist nicht gesetzt — Versand nicht möglich" });
    }
    const merged: MakeWebhookPayload = {
      ...def.example,
      ...(payload && typeof payload === "object" && !Array.isArray(payload) ? payload : {}),
      email: to,
      test: true,
    } as MakeWebhookPayload;
    const at = new Date().toISOString();
    const sent = await sendMakeWebhook(def.type, merged);
    await recordTestSend({ event: def.type, email: to, ok: sent, mode: "test", at });
    res.json({ ok: true, sent, at });
  } catch (err) {
    console.error("[FIAON-EVENTS] test:", err);
    res.status(500).json({ ok: false, error: "Serverfehler" });
  }
});

// T2: „Für echten Kunden senden“ — dryRun liefert Vorschau für den Bestätigungsdialog,
// der eigentliche Versand nutzt die ECHTEN Kundendaten (nur kundengebundene Events).
router.post("/admin/events/send-real", async (req, res) => {
  try {
    const { eventType, paymentRef, dryRun } = req.body || {};
    const def = getEventDef(String(eventType || ""));
    if (!def) return res.status(400).json({ ok: false, error: "Unbekannter Event-Typ" });
    if (!def.customerBound || def.deprecated) {
      return res.status(400).json({ ok: false, error: "Dieses Event ist nicht kundengebunden — nur Test-Versand möglich" });
    }
    if (def.recommendationOnly) {
      return res.status(400).json({ ok: false, error: "Dieses Event ist eine Empfehlung ohne Auto-Versand — nur Test-Versand an eine Test-Adresse möglich (erst Make-Zweig + Template anlegen)." });
    }
    const q = String(paymentRef || "").trim();
    if (q.length < 4) return res.status(400).json({ ok: false, error: "Referenz angeben (Zahlungsreferenz oder Antrags-Referenz)" });
    const rows = await sqlPool`
      SELECT ref, payment_reference, amount_due, first_name, last_name, contact_name, company_name,
             email, contact_email, billing_email, pack_name, payment_status, reminder_count
      FROM fiaon_applications
      WHERE (payment_reference = ${q} OR ref = ${q}) AND merged_into IS NULL
      LIMIT 1
    `;
    if (rows.length === 0) return res.status(404).json({ ok: false, error: "Kunde/Bestellung nicht gefunden" });
    const row = rows[0];
    const realPayload = buildRealPayload(def.type, row);
    if (!realPayload.email) return res.status(400).json({ ok: false, error: "Kunde hat keine E-Mail-Adresse hinterlegt" });

    if (dryRun) {
      return res.json({
        ok: true,
        preview: true,
        customer: eventCustomerName(row),
        email: realPayload.email,
        status: row.payment_status,
        payload: realPayload,
      });
    }

    if (!process.env.MAKE_WEBHOOK_URL) {
      return res.status(400).json({ ok: false, error: "MAKE_WEBHOOK_URL ist nicht gesetzt — Versand nicht möglich" });
    }
    // payment_reminder zählt kanalübergreifend als Erinnerung (20h-Dedupe, Paket V)
    if (def.type === "payment_reminder") {
      await sqlPool`
        UPDATE fiaon_applications SET last_reminder_at = NOW(), reminder_count = COALESCE(reminder_count, 0) + 1, updated_at = NOW()
        WHERE ref = ${row.ref}
      `;
    }
    const at = new Date().toISOString();
    const sent = await sendMakeWebhook(def.type, realPayload);
    await recordTestSend({ event: def.type, email: String(realPayload.email), ok: sent, mode: "real", at });
    res.json({ ok: true, sent, at, customer: eventCustomerName(row), email: realPayload.email });
  } catch (err) {
    console.error("[FIAON-EVENTS] send-real:", err);
    res.status(500).json({ ok: false, error: "Serverfehler" });
  }
});

// ── P4-F: Changelog (read-only aus CHANGELOG.md — „Was ist neu?") ────────────
router.get("/admin/changelog", async (_req, res) => {
  try {
    const filePath = path.resolve(process.cwd(), "CHANGELOG.md");
    const content = await readFile(filePath, "utf-8").catch(() => null);
    res.json({ ok: true, content, exists: content != null });
  } catch (err) {
    console.error("[FIAON-HUB] changelog:", err);
    res.status(500).json({ ok: false, error: "Serverfehler" });
  }
});

// ── Rechtstexte-Review-Status (read-only Anzeige der Review-Datei) ───────────
router.get("/admin/legal-review", async (_req, res) => {
  try {
    const filePath = path.resolve(process.cwd(), "LEGAL_REVIEW_PACKAGE.md");
    const content = await readFile(filePath, "utf-8").catch(() => null);
    res.json({ ok: true, content, exists: content != null });
  } catch (err) {
    console.error("[FIAON-HUB] legal-review:", err);
    res.status(500).json({ ok: false, error: "Serverfehler" });
  }
});

export default router;
