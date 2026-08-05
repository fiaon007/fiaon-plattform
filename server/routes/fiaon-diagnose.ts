// ═══════════════════════════════════════════════════════════════════
// FIAON System-Diagnose (Phase 5) — /admin/diagnose (nur Admin).
//
// Liefert dem Betreiber eine strukturierte Ereignis-/Problem-Konsole:
//  - GET  /admin/diagnose/events   persistierte + synthetische Ereignisse,
//         gefiltert (severity/category/from/to/q), aggregiert nach Fingerprint.
//  - GET  /admin/diagnose/raw      Rohdaten-Ring-Puffer (maskiert, Suche, Download).
//  - POST /admin/diagnose/ai       KI-Zusammenfassung (nur maskierte/aggregierte Daten).
//  - GET  /admin/diagnose/export   persistierte Ereignisse eines Zeitraums als Datei.
//  - POST /admin/diagnose/purge    Löschfunktion (alt/alles).
//
// Alle Routen liegen hinter blockAgentsFromAdmin (in routes.ts vor diesem
// Router gemountet) — Agenten erhalten 403. Keine Kundendaten im Klartext:
// persistierte Nachrichten sind bereits serverseitig maskiert; synthetische
// Ereignisse enthalten nur Zähler/aggregierte Werte.
// ═══════════════════════════════════════════════════════════════════

import { Router, type Request, type Response } from "express";
import { sqlPool } from "../lib/db-pool";
import { getSettings } from "./fiaon-agent";
import { aiComplete } from "./fiaon-leistung";
import { getRawTail, purgeDiagnostics, maskSensitive, DIAGNOSTICS_CONFIG, type Severity, type Category } from "../lib/fiaon-diagnostics";

const router = Router();

const SEVERITIES: Severity[] = ["kritisch", "warnung", "info"];
const CATEGORIES: Category[] = ["email_make", "lead", "zahlung", "agent", "kunde", "system"];

/** Zeitraum aus Query — Default 24 h, hart begrenzt auf 30 Tage (Retention). */
function parseRange(req: Request): { from: Date; to: Date } {
  const to = req.query.to ? new Date(String(req.query.to)) : new Date();
  const from = req.query.from ? new Date(String(req.query.from)) : new Date(Date.now() - 24 * 3600_000);
  const safeTo = isNaN(to.getTime()) ? new Date() : to;
  let safeFrom = isNaN(from.getTime()) ? new Date(Date.now() - 24 * 3600_000) : from;
  const maxSpan = 30 * 864e5;
  if (safeTo.getTime() - safeFrom.getTime() > maxSpan) safeFrom = new Date(safeTo.getTime() - maxSpan);
  return { from: safeFrom, to: safeTo };
}

// ═══════════════════════════════════════════════════════════════════
// SYNTHETISCHE EREIGNISSE — live aus den Geschäftstabellen abgeleitet
// (dieselben Signale wie die Dashboard-Warn-Kacheln, P4-B → „eine Wahrheit").
// Enthalten NUR Zähler/aggregierte Werte, nie Kundendaten im Klartext.
// ═══════════════════════════════════════════════════════════════════
interface SynthEvent {
  synthetic: true;
  id: string;
  severity: Severity;
  category: Category;
  code: string;
  message: string;
  hint?: string;
  link?: string;
  action?: { kind: string; label: string; ref?: string } | null;
  at: string;
  count: number;
}

async function computeSyntheticEvents(): Promise<SynthEvent[]> {
  const out: SynthEvent[] = [];
  const now = new Date().toISOString();
  const push = (e: Omit<SynthEvent, "synthetic" | "id" | "at" | "count"> & { count?: number }) =>
    out.push({ synthetic: true, id: `synth_${e.code}`, at: now, count: e.count ?? 1, ...e });

  // 1) Lead-Eingang: seit X Stunden kein Lead (hätte den Make-Ausfall gezeigt).
  const [leadGap] = await sqlPool`
    SELECT EXTRACT(EPOCH FROM (NOW() - MAX(erstellt_am))) / 3600 AS hours FROM fiaon_leads
  `.catch(() => [{ hours: null }] as any);
  const gapH = leadGap?.hours != null ? Math.round(Number(leadGap.hours)) : null;
  if (gapH != null && gapH >= 24) {
    push({
      severity: gapH >= 48 ? "kritisch" : "warnung", category: "lead", code: "lead_intake_gap",
      message: `Seit ${gapH} Stunden kein neuer Lead-Eingang.`,
      hint: "Normalerweise liefern die Lead-Ads laufend. Läuft das Make-Szenario? Ist der Intake-Webhook erreichbar (E-Mail-Events → Diagnose)?",
      link: "/admin/events",
    });
  }

  // 2) Nachfass-Automatik pausiert (Interessenten bekommen keine Erinnerungen).
  const settings = await getSettings().catch(() => ({} as Record<string, string>));
  if (settings.lead_followup_enabled !== "1") {
    push({
      severity: "warnung", category: "lead", code: "followup_paused",
      message: "Die Lead-Nachfass-Automatik ist pausiert — Interessenten bekommen aktuell keine automatischen Erinnerungen.",
      hint: "Falls nicht beabsichtigt: in den Lead-Einstellungen wieder einschalten.",
      link: "/admin/leads",
    });
  }

  // 3) Zahlungen: nicht zugeordnete Bank-Eingänge (Geld liegt unverbucht).
  const [bank] = await sqlPool`
    SELECT COUNT(*) FILTER (WHERE match_status = 'unmatched' AND applied = FALSE)::int AS unmatched,
           COUNT(*) FILTER (WHERE match_status IN ('matched','manual') AND applied = FALSE)::int AS matched_unapplied,
           COUNT(*) FILTER (WHERE amount_ok = FALSE AND applied = FALSE AND match_status <> 'ignored')::int AS amount_mismatch
    FROM fiaon_bank_txns
  `.catch(() => [{ unmatched: 0, matched_unapplied: 0, amount_mismatch: 0 }] as any);
  // Diese beiden Meldungen führen in den Kontoabgleich. Ist er abgeschaltet
  // (kontoabgleich_enabled = false), wären sie eine Aufforderung, eine
  // abgeschaltete Seite zu benutzen — also stumm. Die Daten bleiben, nur der
  // Hinweis entfällt. Zugeordnete, aber unverbuchte Eingänge melden wir weiter:
  // sie gehören zu /admin/verbuchung, das bewusst aktiv bleibt.
  const { kontoabgleichAktiv } = await import("./fiaon-reconcile");
  const abgleichAn = await kontoabgleichAktiv();
  if (abgleichAn && Number(bank?.unmatched) > 0) {
    push({
      severity: "warnung", category: "zahlung", code: "bank_unmatched", count: Number(bank.unmatched),
      message: `${bank.unmatched} Bank-Eingang/Eingänge ohne Zuordnung — Geld liegt unverbucht auf dem Konto.`,
      hint: "Im Kontoabgleich zuordnen (Vorschläge nach Einzahlername + Betrag) und verbuchen.",
      link: "/admin/kontoabgleich",
    });
  }
  if (abgleichAn && Number(bank?.amount_mismatch) > 0) {
    push({
      severity: "warnung", category: "zahlung", code: "bank_amount_mismatch", count: Number(bank.amount_mismatch),
      message: `${bank.amount_mismatch} zugeordnete(r) Eingang/Eingänge mit Betrags-Abweichung — nicht stillschweigend übernehmen.`,
      hint: "Im Kontoabgleich prüfen: Teilzahlung, Gebührenabzug oder falscher Kunde?",
      link: "/admin/kontoabgleich",
    });
  }
  const { verbuchungAktiv } = await import("./fiaon-verbuchung");
  if ((await verbuchungAktiv()) && Number(bank?.matched_unapplied) > 0) {
    push({
      severity: "warnung", category: "zahlung", code: "bank_matched_unapplied", count: Number(bank.matched_unapplied),
      message: `${bank.matched_unapplied} zugeordnete(r) Bank-Eingang/Eingänge noch nicht verbucht — der Kunde gilt weiter als unbezahlt.`,
      hint: "Unter „Zahlungen verbuchen“ mit Vorschau abschließen (Altfälle aus der Zeit des Kontoabgleichs).",
      link: "/admin/verbuchung",
    });
  }

  // 4) Zahlungen: bezahlte Bestellung ohne gebuchte Provision (mit Betreuung).
  const [nachbuchung] = await sqlPool`
    SELECT COUNT(*) FILTER (WHERE payment_status = 'paid' AND merged_into IS NULL
      AND COALESCE(commission_basis, '') <> 'direktzahler' AND assigned_agent_id IS NOT NULL
      AND NOT EXISTS (SELECT 1 FROM fiaon_commissions c WHERE c.ref = fiaon_applications.ref AND c.amount_cents > 0 AND c.status <> 'storniert')
    )::int AS c
    FROM fiaon_applications
  `.catch(() => [{ c: 0 }] as any);
  if (Number(nachbuchung?.c) > 0) {
    push({
      severity: "info", category: "zahlung", code: "commission_missing", count: Number(nachbuchung.c),
      message: `${nachbuchung.c} bezahlte Bestellung(en) mit Betreuung, aber ohne gebuchte Provision.`,
      hint: "Im Nachbuchungs-Center prüfen und (nach Bestätigung) buchen.",
      link: "/admin/nachbuchung",
    });
  }

  // 5) Zahlungen: Dubletten-Gruppen mit offenen Bestellungen.
  const [dup] = await sqlPool`
    SELECT COUNT(*)::int AS c FROM (
      SELECT LOWER(TRIM(email)) FROM fiaon_applications
      WHERE merged_into IS NULL AND email IS NOT NULL AND TRIM(email) <> ''
      GROUP BY LOWER(TRIM(email))
      HAVING COUNT(*) > 1 AND COUNT(*) FILTER (WHERE payment_status IN ('pending_payment','claimed_paid')) > 0
    ) x
  `.catch(() => [{ c: 0 }] as any);
  if (Number(dup?.c) > 0) {
    push({
      severity: "info", category: "zahlung", code: "duplicate_groups", count: Number(dup.c),
      message: `${dup.c} Dubletten-Gruppe(n) mit offenen Bestellungen derselben Person.`,
      hint: "In der Zahlungszentrale zusammenführen (Soft-Delete, nichts geht verloren).",
      link: "/admin/zahlungen#dubletten",
    });
  }

  // 6) Agenten: blockierte Akte (übernommen, aber kein Ergebnis dokumentiert).
  const blocked = await sqlPool`
    SELECT l.id, ag.name AS agent_name,
      EXTRACT(EPOCH FROM (NOW() - l.opened_at)) / 3600 AS hours
    FROM fiaon_leads l JOIN fiaon_agents ag ON ag.id = l.opened_by_agent_id
    WHERE l.opened_at IS NOT NULL AND l.status IN ('neu','kontaktiert','nicht_erreichbar')
    ORDER BY l.opened_at ASC
  `.catch(() => [] as any);
  if (blocked.length > 0) {
    const oldest = Math.round(Number(blocked[0].hours || 0));
    push({
      severity: oldest >= 2 ? "warnung" : "info", category: "agent", code: "blocked_akte", count: blocked.length,
      message: `${blocked.length} offene Lead-Akte(n) ohne dokumentiertes Ergebnis (älteste seit ${oldest} h, u. a. bei ${maskSensitive(blocked[0].agent_name)}).`,
      hint: "Nach Ablauf der Auto-Freigabe löst sich das selbst — du kannst die Akte auch sofort freigeben.",
      link: "/admin/leads",
      action: { kind: "release_akte", label: "Akte freigeben", ref: String(blocked[0].id) },
    });
  }

  // 7) System: Make-Webhook gar nicht konfiguriert (kein Mailversand möglich).
  if (!process.env.MAKE_WEBHOOK_URL) {
    push({
      severity: "kritisch", category: "email_make", code: "make_url_missing",
      message: "MAKE_WEBHOOK_URL ist nicht gesetzt — es können KEINE automatischen Kunden-Mails ausgelöst werden.",
      hint: "Umgebungsvariable im Deployment hinterlegen und einmal über E-Mail-Events testen.",
      link: "/admin/events",
    });
  }
  if (!process.env.LEAD_INTAKE_SECRET) {
    push({
      severity: "kritisch", category: "lead", code: "intake_secret_missing",
      message: "LEAD_INTAKE_SECRET ist nicht gesetzt — der Lead-Intake-Webhook weist ALLE Einlieferungen ab.",
      hint: "Secret im Deployment setzen und im Make-Header 'x-lead-secret' hinterlegen.",
      link: "/admin/leads",
    });
  }

  return out;
}

// ── GET /admin/diagnose/events ────────────────────────────────────────────────
// Aggregiert persistierte Ereignisse nach Fingerprint (Bündelung „23× …") und
// mischt die synthetischen Live-Signale ein. Filter + Zeitraum + Freitext.
router.get("/admin/diagnose/events", async (req: Request, res: Response) => {
  try {
    const { from, to } = parseRange(req);
    const sevFilter = String(req.query.severity || "").split(",").map((s) => s.trim()).filter((s) => SEVERITIES.includes(s as Severity));
    const catFilter = String(req.query.category || "").split(",").map((s) => s.trim()).filter((s) => CATEGORIES.includes(s as Category));
    const q = String(req.query.q || "").trim().toLowerCase();

    // Persistierte Ereignisse, aggregiert nach Fingerprint.
    const rows = await sqlPool`
      SELECT fingerprint,
        (ARRAY_AGG(severity ORDER BY created_at DESC))[1] AS severity,
        (ARRAY_AGG(category ORDER BY created_at DESC))[1] AS category,
        (ARRAY_AGG(code ORDER BY created_at DESC))[1] AS code,
        (ARRAY_AGG(message ORDER BY created_at DESC))[1] AS message,
        (ARRAY_AGG(hint ORDER BY created_at DESC))[1] AS hint,
        (ARRAY_AGG(link ORDER BY created_at DESC))[1] AS link,
        (ARRAY_AGG(action ORDER BY created_at DESC))[1] AS action,
        COUNT(*)::int AS count,
        MIN(created_at) AS first_seen,
        MAX(created_at) AS last_seen
      FROM fiaon_diagnostics
      WHERE created_at BETWEEN ${from} AND ${to}
      GROUP BY fingerprint
      ORDER BY MAX(created_at) DESC
      LIMIT 500
    `.catch(() => [] as any);

    let events: any[] = rows.map((r: any) => ({
      synthetic: false,
      id: `db_${r.fingerprint}`,
      severity: r.severity, category: r.category, code: r.code,
      message: r.message, hint: r.hint || undefined, link: r.link || undefined,
      action: r.action || null,
      count: Number(r.count),
      at: r.last_seen, firstSeen: r.first_seen, lastSeen: r.last_seen,
    }));

    // Synthetische Live-Signale einmischen (immer „jetzt" — außerhalb Retention).
    const synth = await computeSyntheticEvents();
    events = [...synth, ...events];

    // Filter anwenden.
    if (sevFilter.length) events = events.filter((e) => sevFilter.includes(e.severity));
    if (catFilter.length) events = events.filter((e) => catFilter.includes(e.category));
    if (q) events = events.filter((e) => `${e.message} ${e.hint || ""} ${e.code} ${e.category}`.toLowerCase().includes(q));

    // Sortierung: Schweregrad, dann Aktualität.
    const rank: Record<string, number> = { kritisch: 0, warnung: 1, info: 2 };
    events.sort((a, b) => (rank[a.severity] - rank[b.severity]) || (new Date(b.at).getTime() - new Date(a.at).getTime()));

    // Zähl-Übersicht (für die Filter-Chips).
    const counts = { kritisch: 0, warnung: 0, info: 0 } as Record<string, number>;
    for (const e of events) counts[e.severity] = (counts[e.severity] || 0) + 1;

    res.json({
      ok: true,
      range: { from: from.toISOString(), to: to.toISOString() },
      counts,
      events: events.slice(0, 300),
      retentionDays: DIAGNOSTICS_CONFIG.RETENTION_DAYS,
    });
  } catch (err) {
    console.error("[FIAON-DIAGNOSE] events:", err);
    res.status(500).json({ ok: false, error: "Serverfehler" });
  }
});

// ── GET /admin/diagnose/raw ───────────────────────────────────────────────────
// Rohdaten-Ring-Puffer (maskiert). ?q= Filter, ?download=1 → Datei.
router.get("/admin/diagnose/raw", async (req: Request, res: Response) => {
  try {
    const q = String(req.query.q || "");
    const tail = getRawTail({ q, limit: DIAGNOSTICS_CONFIG.RAW_MAX_LINES });
    if (String(req.query.download || "") === "1") {
      const body = tail.lines
        .slice().reverse() // im Download chronologisch (älteste zuerst)
        .map((l) => `${l.at} [${l.level.toUpperCase()}] ${l.text}`)
        .join("\n");
      res.setHeader("Content-Type", "text/plain; charset=utf-8");
      res.setHeader("Content-Disposition", `attachment; filename="fiaon-rohdaten-${new Date().toISOString().slice(0, 19)}.txt"`);
      return res.send(body || "(leer)");
    }
    res.json({ ok: true, ...tail });
  } catch (err) {
    console.error("[FIAON-DIAGNOSE] raw:", err);
    res.status(500).json({ ok: false, error: "Serverfehler" });
  }
});

// ── GET /admin/diagnose/export ────────────────────────────────────────────────
// Persistierte Ereignisse eines Zeitraums als JSON-Datei (bereits maskiert).
router.get("/admin/diagnose/export", async (req: Request, res: Response) => {
  try {
    const { from, to } = parseRange(req);
    const rows = await sqlPool`
      SELECT severity, category, code, message, hint, link, created_at
      FROM fiaon_diagnostics
      WHERE created_at BETWEEN ${from} AND ${to}
      ORDER BY created_at ASC
      LIMIT 5000
    `.catch(() => [] as any);
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="fiaon-diagnose-${new Date().toISOString().slice(0, 10)}.json"`);
    res.send(JSON.stringify({ range: { from, to }, count: rows.length, events: rows }, null, 2));
  } catch (err) {
    console.error("[FIAON-DIAGNOSE] export:", err);
    res.status(500).json({ ok: false, error: "Serverfehler" });
  }
});

// ── POST /admin/diagnose/purge ────────────────────────────────────────────────
router.post("/admin/diagnose/purge", async (req: Request, res: Response) => {
  try {
    const all = req.body?.all === true;
    const deleted = await purgeDiagnostics(all);
    res.json({ ok: true, deleted, all });
  } catch (err) {
    console.error("[FIAON-DIAGNOSE] purge:", err);
    res.status(500).json({ ok: false, error: "Serverfehler" });
  }
});

// ── POST /admin/diagnose/ai ───────────────────────────────────────────────────
// KI-Auswertung: „Was ist gerade kaputt, was wiederholt sich, wahrscheinliche
// Ursache, Reihenfolge der Behebung." Nur maskierte/aggregierte Daten an die KI.
router.post("/admin/diagnose/ai", async (req: Request, res: Response) => {
  try {
    const { from, to } = parseRange(req);
    const rows = await sqlPool`
      SELECT severity, category, code,
        (ARRAY_AGG(message ORDER BY created_at DESC))[1] AS beispiel,
        COUNT(*)::int AS anzahl,
        MIN(created_at) AS zuerst, MAX(created_at) AS zuletzt
      FROM fiaon_diagnostics
      WHERE created_at BETWEEN ${from} AND ${to}
      GROUP BY severity, category, code
      ORDER BY anzahl DESC
      LIMIT 60
    `.catch(() => [] as any);
    const synth = await computeSyntheticEvents();

    const payload = {
      zeitraum: { von: from.toISOString(), bis: to.toISOString() },
      persistierteFehlerGruppen: rows.map((r: any) => ({
        schweregrad: r.severity, kategorie: r.category, code: r.code,
        anzahl: r.anzahl, beispiel: r.beispiel, zuerst: r.zuerst, zuletzt: r.zuletzt,
      })),
      liveSignale: synth.map((s) => ({ schweregrad: s.severity, kategorie: s.category, code: s.code, meldung: s.message, anzahl: s.count })),
    };

    if (payload.persistierteFehlerGruppen.length === 0 && payload.liveSignale.length === 0) {
      return res.json({ ok: true, summary: { at: new Date().toISOString(), provider: "keiner", text: "Im gewählten Zeitraum sind keine Probleme erfasst. Es gibt aktuell nichts zu beheben." } });
    }

    const prompt = [
      "Du bist der technische Betriebs-Analyst einer kleinen deutschen Fintech-Plattform (Kreditkarten-Anträge, Telefon-Vertrieb, Make.com für E-Mails).",
      "Analysiere die folgenden AGGREGIERTEN, bereits anonymisierten/maskierten Diagnose-Daten. Antworte auf Deutsch, Klartext für einen Nicht-Techniker, mit Markdown-Überschriften.",
      "Gliedere GENAU so:",
      "## Was ist gerade kaputt",
      "## Was wiederholt sich (Muster/Häufungen)",
      "## Wahrscheinliche Ursache",
      "## Reihenfolge der Behebung (nummeriert, wichtigstes zuerst)",
      "Beziehe dich nur auf die Daten, erfinde nichts. Nenne konkrete Codes/Kategorien. Wenn nichts Kritisches vorliegt, sage das klar.",
      "",
      "DATEN (JSON):",
      JSON.stringify(payload),
    ].join("\n");

    const { text, provider } = await aiComplete(prompt);
    res.json({ ok: true, summary: { at: new Date().toISOString(), provider, text } });
  } catch (err) {
    console.error("[FIAON-DIAGNOSE] ai:", err);
    res.status(502).json({ ok: false, error: err instanceof Error ? err.message : "KI-Auswertung fehlgeschlagen" });
  }
});

export default router;
