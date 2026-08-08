// ═══════════════════════════════════════════════════════════════════
// FIAON Arbeitsberichte (Phase 4, P4-C) — /admin/leistung + /agent/leistung
//
// RECHTLICHER RAHMEN (verbindlich, siehe SYSTEM_DIAGNOSE.md Phase 4):
// Protokolliert werden ARBEITSERGEBNISSE, keine Verhaltensüberwachung.
// KEIN Tracking von Arbeitsbeginn/-ende, Pausen, Anwesenheit oder Inaktivität
// (Scheinselbstständigkeits-Indiz / DSGVO). Alles hier Ausgewertete stammt aus
// Logs, die die Agenten selbst erzeugen (Kontakt-Ergebnisse, Übernahmen,
// Link-Versand) — und JEDER Agent sieht seine eigenen Zahlen im Portal
// (/agent/leistung, Spiegelansicht). Keine Geheim-Logs.
//
// KI-Zusammenfassung: NUR aggregierte Kennzahlen gehen an die KI — keine
// Kundendaten, keine Kontaktdaten, Agenten anonymisiert als „Agent A/B/…".
// Provider: Gemini (Flash, günstigste Option — Key liegt im Server-Env für
// gemini-enrich), Fallback OpenAI gpt-4o-mini. KI-Ausfall ⇒ verständlicher
// Fehler, die Zahlen bleiben unabhängig davon sichtbar.
// ═══════════════════════════════════════════════════════════════════

import { Router, type Request, type Response } from "express";
import { sqlPool } from "../lib/db-pool";
import { requireAgent, getSettings, setSetting, type AgentRequest } from "./fiaon-agent";

const router = Router();

/** Zeitraum aus Query — Default 30 Tage, hart begrenzt auf 366 Tage. */
function parseRange(req: Request): { from: Date; to: Date } {
  const to = req.query.to ? new Date(String(req.query.to)) : new Date();
  const from = req.query.from
    ? new Date(String(req.query.from))
    : new Date(Date.now() - 30 * 864e5);
  const safeTo = isNaN(to.getTime()) ? new Date() : to;
  let safeFrom = isNaN(from.getTime()) ? new Date(Date.now() - 30 * 864e5) : from;
  if (safeTo.getTime() - safeFrom.getTime() > 366 * 864e5) {
    safeFrom = new Date(safeTo.getTime() - 366 * 864e5);
  }
  return { from: safeFrom, to: safeTo };
}

/** Kern-Aggregation: Arbeitsergebnisse je Agent im Zeitraum (nur Ergebnisse!). */
export async function computeLeistung(from: Date, to: Date): Promise<any> {
  // 1) Lead-Log: Übernahmen, Kontakte, Ergebnisse nach Typ, Links, Rückgaben
  const leadLog = await sqlPool`
    SELECT agent_id,
      COUNT(*) FILTER (WHERE type = 'claim')::int AS akten,
      COUNT(*) FILTER (WHERE type = 'result')::int AS kontakte_leads,
      COUNT(*) FILTER (WHERE type = 'email_sent')::int AS links,
      COUNT(*) FILTER (WHERE type = 'system' AND note LIKE 'Akte ohne Kontakt-Ergebnis geschlossen%')::int AS rueckgaben
    FROM fiaon_lead_log
    WHERE agent_id IS NOT NULL AND created_at BETWEEN ${from} AND ${to}
    GROUP BY agent_id
  `;
  const outcomes = await sqlPool`
    SELECT agent_id, outcome, COUNT(*)::int AS c
    FROM fiaon_lead_log
    WHERE agent_id IS NOT NULL AND type = 'result' AND outcome IS NOT NULL
      AND created_at BETWEEN ${from} AND ${to}
    GROUP BY agent_id, outcome
  `;
  // 2) Kunden-Log: dokumentierte Kontakte an Bestellungen
  const custLog = await sqlPool`
    SELECT agent_id,
      COUNT(*) FILTER (WHERE type = 'result')::int AS kontakte_kunden,
      COUNT(*) FILTER (WHERE type = 'email_sent')::int AS kundenmails
    FROM fiaon_contact_log
    WHERE agent_id IS NOT NULL AND voided_at IS NULL AND created_at BETWEEN ${from} AND ${to}
    GROUP BY agent_id
  `;
  // 3) Konversionen (Lead → Antrag) je betreuendem Agent
  const conversions = await sqlPool`
    SELECT assigned_agent_id AS agent_id, COUNT(*)::int AS konversionen
    FROM fiaon_leads
    WHERE assigned_agent_id IS NOT NULL AND status = 'konvertiert'
      AND konvertiert_am BETWEEN ${from} AND ${to}
    GROUP BY assigned_agent_id
  `;
  // 4) Abschlüsse + Umsatz — die EINE Wahrheit (paid + Referenz, Zeit-Anker completed_at)
  const paid = await sqlPool`
    SELECT assigned_agent_id AS agent_id, COUNT(*)::int AS abschluesse,
      COALESCE(SUM(ROUND(COALESCE(amount_due::numeric, 0) * 100)), 0)::bigint AS umsatz_cents
    FROM fiaon_applications
    WHERE assigned_agent_id IS NOT NULL AND payment_status = 'paid'
      AND merged_into IS NULL AND NOT COALESCE(alt_bestand, FALSE)
      AND COALESCE(completed_at, claimed_paid_at, created_at) BETWEEN ${from} AND ${to}
    GROUP BY assigned_agent_id
  `;
  // 5) Provision (gebucht im Zeitraum, nicht storniert)
  const commissions = await sqlPool`
    SELECT agent_id, COALESCE(SUM(amount_cents), 0)::bigint AS provision_cents
    FROM fiaon_commissions
    WHERE status <> 'storniert' AND amount_cents > 0 AND created_at BETWEEN ${from} AND ${to}
    GROUP BY agent_id
  `;
  // 6) Reaktionsschnelligkeit: Lead-Eingang → erster dokumentierter Kontakt des
  //    Agenten. (Hinweis: Zuweisungs-Zeitpunkt wird historisch nicht gespeichert;
  //    Anker ist ehrlich der Lead-Eingang — im UI genau so beschriftet.)
  const reaction = await sqlPool`
    SELECT g.agent_id, AVG(EXTRACT(EPOCH FROM (g.first_at - l.erstellt_am)) / 3600)::numeric(10,1) AS avg_hours
    FROM (
      SELECT lead_id, agent_id, MIN(created_at) AS first_at
      FROM fiaon_lead_log
      WHERE agent_id IS NOT NULL AND type IN ('result', 'email_sent')
      GROUP BY lead_id, agent_id
    ) g
    JOIN fiaon_leads l ON l.id = g.lead_id
    WHERE g.first_at BETWEEN ${from} AND ${to} AND g.first_at >= l.erstellt_am
    GROUP BY g.agent_id
  `;
  // 7) Anteil Direktzahler: eigene Leads, die OHNE dokumentierten Kontakt des
  //    Agenten selbst gezahlt haben (commission_basis = 'direktzahler')
  const direkt = await sqlPool`
    SELECT l.assigned_agent_id AS agent_id,
      COUNT(*)::int AS paid_leads,
      COUNT(*) FILTER (WHERE a.commission_basis = 'direktzahler')::int AS direktzahler
    FROM fiaon_leads l
    JOIN fiaon_applications a ON a.ref = l.converted_order_id AND a.merged_into IS NULL
    WHERE l.assigned_agent_id IS NOT NULL
      AND a.payment_status = 'paid' AND NOT COALESCE(a.alt_bestand, FALSE)
      AND COALESCE(a.completed_at, a.claimed_paid_at, a.created_at) BETWEEN ${from} AND ${to}
    GROUP BY l.assigned_agent_id
  `;

  const agents = await sqlPool`SELECT id, name, active FROM fiaon_agents ORDER BY name ASC`;
  const byId = new Map<number, any>();
  for (const a of agents) {
    byId.set(Number(a.id), {
      agentId: Number(a.id), name: a.name, active: !!a.active,
      akten: 0, kontakte: 0, kontakteLeads: 0, kontakteKunden: 0,
      links: 0, kundenmails: 0, rueckgaben: 0, outcomes: {} as Record<string, number>,
      konversionen: 0, abschluesse: 0, umsatzCents: 0, provisionCents: 0,
      reaktionStunden: null as number | null,
      rueckgabeQuote: null as number | null,
      direktzahler: 0, paidLeads: 0, direktzahlerQuote: null as number | null,
    });
  }
  const put = (rows: any[], fill: (t: any, r: any) => void) => {
    for (const r of rows) { const t = byId.get(Number(r.agent_id)); if (t) fill(t, r); }
  };
  put(leadLog, (t, r) => { t.akten = Number(r.akten); t.kontakteLeads = Number(r.kontakte_leads); t.links = Number(r.links); t.rueckgaben = Number(r.rueckgaben); });
  put(outcomes, (t, r) => { t.outcomes[r.outcome] = Number(r.c); });
  put(custLog, (t, r) => { t.kontakteKunden = Number(r.kontakte_kunden); t.kundenmails = Number(r.kundenmails); });
  put(conversions, (t, r) => { t.konversionen = Number(r.konversionen); });
  put(paid, (t, r) => { t.abschluesse = Number(r.abschluesse); t.umsatzCents = Number(r.umsatz_cents); });
  put(commissions, (t, r) => { t.provisionCents = Number(r.provision_cents); });
  put(reaction, (t, r) => { t.reaktionStunden = r.avg_hours != null ? Number(r.avg_hours) : null; });
  put(direkt, (t, r) => { t.paidLeads = Number(r.paid_leads); t.direktzahler = Number(r.direktzahler); });

  const list = Array.from(byId.values()).map((t) => {
    t.kontakte = t.kontakteLeads + t.kontakteKunden;
    t.rueckgabeQuote = t.akten > 0 ? Math.round((t.rueckgaben / t.akten) * 1000) / 10 : null;
    t.direktzahlerQuote = t.paidLeads > 0 ? Math.round((t.direktzahler / t.paidLeads) * 1000) / 10 : null;
    return t;
  });
  // Nur Agenten mit Aktivität im Zeitraum ODER aktive Agenten anzeigen
  const visible = list.filter((t) => t.active || t.kontakte > 0 || t.akten > 0 || t.abschluesse > 0 || t.provisionCents > 0);

  // 8) Zeitverlauf (Team, täglich): Kontakte + Abschlüsse
  const seriesContacts = await sqlPool`
    SELECT (created_at AT TIME ZONE 'Europe/Berlin')::date AS d, COUNT(*)::int AS c
    FROM fiaon_lead_log
    WHERE agent_id IS NOT NULL AND type = 'result' AND created_at BETWEEN ${from} AND ${to}
    GROUP BY 1 ORDER BY 1
  `;
  const seriesPaid = await sqlPool`
    SELECT (COALESCE(completed_at, claimed_paid_at, created_at) AT TIME ZONE 'Europe/Berlin')::date AS d, COUNT(*)::int AS c
    FROM fiaon_applications
    WHERE payment_status = 'paid' AND merged_into IS NULL AND NOT COALESCE(alt_bestand, FALSE)
      AND COALESCE(completed_at, claimed_paid_at, created_at) BETWEEN ${from} AND ${to}
    GROUP BY 1 ORDER BY 1
  `;

  // 9) Quellen/Kampagnen-Konversion (für die KI-Analyse + Anzeige)
  const sources = await sqlPool`
    SELECT COALESCE(NULLIF(TRIM(l.quelle), ''), 'unbekannt') AS quelle,
      COUNT(*)::int AS leads,
      COUNT(*) FILTER (WHERE l.status = 'konvertiert')::int AS konvertiert,
      COUNT(*) FILTER (WHERE a.payment_status = 'paid' AND NOT COALESCE(a.alt_bestand, FALSE))::int AS zahlend
    FROM fiaon_leads l
    LEFT JOIN fiaon_applications a ON a.ref = l.converted_order_id AND a.merged_into IS NULL
    WHERE l.erstellt_am BETWEEN ${from} AND ${to}
    GROUP BY 1 ORDER BY leads DESC LIMIT 12
  `;

  const totals = visible.reduce((acc, t) => {
    acc.akten += t.akten; acc.kontakte += t.kontakte; acc.links += t.links;
    acc.konversionen += t.konversionen; acc.abschluesse += t.abschluesse;
    acc.umsatzCents += t.umsatzCents; acc.provisionCents += t.provisionCents;
    acc.rueckgaben += t.rueckgaben; acc.direktzahler += t.direktzahler;
    return acc;
  }, { akten: 0, kontakte: 0, links: 0, konversionen: 0, abschluesse: 0, umsatzCents: 0, provisionCents: 0, rueckgaben: 0, direktzahler: 0 });

  return {
    range: { from: from.toISOString(), to: to.toISOString() },
    agents: visible,
    totals,
    series: {
      kontakte: seriesContacts.map((r: any) => ({ date: r.d, count: Number(r.c) })),
      abschluesse: seriesPaid.map((r: any) => ({ date: r.d, count: Number(r.c) })),
    },
    sources: sources.map((r: any) => ({
      quelle: r.quelle, leads: Number(r.leads), konvertiert: Number(r.konvertiert), zahlend: Number(r.zahlend),
    })),
  };
}

// ── Admin: Team-Bericht ──────────────────────────────────────────────────────
router.get("/admin/leistung", async (req: Request, res: Response) => {
  try {
    const { from, to } = parseRange(req);
    const data = await computeLeistung(from, to);
    // Letzte gespeicherte KI-Zusammenfassung mitliefern (kopier-/nachlesbar)
    const settings = await getSettings();
    let lastSummary: any = null;
    try { lastSummary = JSON.parse(settings.leistung_last_summary || "null"); } catch {}
    res.json({ ok: true, ...data, lastSummary });
  } catch (err) {
    console.error("[FIAON-LEISTUNG] admin:", err);
    res.status(500).json({ ok: false, error: "Serverfehler" });
  }
});

// ── Agent: Spiegelansicht (nur die EIGENEN Zahlen — Transparenz) ─────────────
router.get("/agent/leistung", requireAgent, async (req: AgentRequest, res: Response) => {
  try {
    const { from, to } = parseRange(req);
    const data = await computeLeistung(from, to);
    const me = data.agents.find((a: any) => a.agentId === req.agent!.id) || null;
    // Team-Durchschnitt zur Einordnung (keine Namen der Kollegen)
    const n = data.agents.length || 1;
    const teamAvg = {
      kontakte: Math.round(data.totals.kontakte / n),
      abschluesse: Math.round((data.totals.abschluesse / n) * 10) / 10,
      umsatzCents: Math.round(data.totals.umsatzCents / n),
    };
    res.json({ ok: true, range: data.range, me, teamAvg, series: data.series });
  } catch (err) {
    console.error("[FIAON-LEISTUNG] agent:", err);
    res.status(500).json({ ok: false, error: "Serverfehler" });
  }
});

// ── KI-Zusammenfassung (P4-C) ────────────────────────────────────────────────
// DSGVO: ausschließlich aggregierte Kennzahlen. Agenten werden anonymisiert
// („Agent A/B/…"), Quellen-Namen sind Kampagnen-Bezeichnungen (keine Personen).
//
// WICHTIG: In FIAON läuft JEDE KI ausschließlich über OPENAI_API_KEY — kein
// Gemini, kein anderer Anbieter. Diese Funktion ist die EINE zentrale Stelle
// für alle FIAON-KI-Aufrufe (Leistung + Diagnose). Modell überschreibbar via
// OPENAI_MODEL (Default: gpt-4o-mini).
export async function aiComplete(prompt: string): Promise<{ text: string; provider: string }> {
  const openaiKey = process.env.OPENAI_API_KEY;
  if (!openaiKey) {
    throw new Error("Kein OPENAI_API_KEY hinterlegt. Bitte den OpenAI-Schlüssel im Deployment setzen — die KI-Auswertung nutzt ausschließlich OpenAI.");
  }
  const model = process.env.OPENAI_MODEL || "gpt-4o-mini";

  let resp: globalThis.Response;
  try {
    resp = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${openaiKey}` },
      body: JSON.stringify({
        model,
        temperature: 0.3,
        max_tokens: 1500,
        messages: [{ role: "user", content: prompt }],
      }),
      signal: AbortSignal.timeout(45_000),
    });
  } catch (e: any) {
    const reason = e?.name === "TimeoutError" ? "Zeitüberschreitung (45 s)" : (e?.message || "Netzwerkfehler");
    throw new Error(`OpenAI nicht erreichbar: ${reason}. Bitte später erneut versuchen — die Zahlen unten bleiben davon unberührt.`);
  }

  if (!resp.ok) {
    const body = await resp.text().catch(() => "");
    console.error("[FIAON-KI] OpenAI-Fehler:", resp.status, body.slice(0, 500));
    // Klartext-Ursache aus der OpenAI-Antwort ziehen (Key ungültig, Kontingent, Modell …).
    let detail = "";
    try { detail = JSON.parse(body)?.error?.message || ""; } catch {}
    const hint = resp.status === 401 ? "Der OPENAI_API_KEY ist ungültig oder abgelaufen."
      : resp.status === 429 ? "OpenAI-Kontingent/Rate-Limit erreicht (Guthaben prüfen)."
      : resp.status === 404 ? `Modell „${model}" ist für diesen Key nicht verfügbar (OPENAI_MODEL anpassen).`
      : `OpenAI-Fehler (HTTP ${resp.status}).`;
    throw new Error(`${hint}${detail ? ` — ${detail}` : ""}`);
  }

  const j: any = await resp.json();
  const text = j?.choices?.[0]?.message?.content || "";
  if (!text.trim()) throw new Error("OpenAI hat eine leere Antwort geliefert. Bitte erneut versuchen.");
  return { text: text.trim(), provider: model };
}

router.post("/admin/leistung/ai-summary", async (req: Request, res: Response) => {
  try {
    const { from, to } = parseRange(req);
    const data = await computeLeistung(from, to);

    // Anonymisieren: Agent A/B/C … — KEINE Namen an die KI.
    // Der Token pro Agent ist stabil an die Reihenfolge gekoppelt; die Rück-
    // Zuordnung (Token → echter Name) bleibt AUSSCHLIESSLICH auf unserem Server
    // und wird der Anzeige mitgegeben — die KI erhält niemals einen Namen.
    const agentTokens = data.agents.map((_: any, i: number) => `Agent ${String.fromCharCode(65 + (i % 26))}${i >= 26 ? Math.floor(i / 26) : ""}`);
    const anonAgents = data.agents.map((a: any, i: number) => ({
      agent: agentTokens[i],
      akten: a.akten, kontakte: a.kontakte, links: a.links,
      ergebnisse: a.outcomes, konversionen: a.konversionen,
      abschluesse: a.abschluesse, umsatzEur: Math.round(a.umsatzCents / 100),
      reaktionStundenLeadEingangBisKontakt: a.reaktionStunden,
      rueckgabeQuotePct: a.rueckgabeQuote, direktzahlerQuotePct: a.direktzahlerQuote,
    }));
    const agentMap: Record<string, string> = {};
    data.agents.forEach((a: any, i: number) => { agentMap[agentTokens[i]] = a.name; });
    const payload = {
      zeitraum: data.range,
      team: anonAgents,
      summen: { ...data.totals, umsatzEur: Math.round(data.totals.umsatzCents / 100), provisionEur: Math.round(data.totals.provisionCents / 100) },
      quellen: data.sources,
      verlaufKontakteProTag: data.series.kontakte,
      verlaufAbschluesseProTag: data.series.abschluesse,
    };

    const prompt = [
      "Du bist Vertriebs-Analyst für ein kleines deutsches Fintech (Kreditkarten-Anträge, Telefon-Vertrieb).",
      "Analysiere die folgenden AGGREGIERTEN Team-Kennzahlen eines Zeitraums. Antworte auf Deutsch, in Klartext für einen Nicht-Analysten, mit Markdown-Überschriften.",
      "Gliedere GENAU so:",
      "## Was lief gut",
      "## Wo bricht es ab (Prozessschritt mit dem größten Verlust)",
      "## Beste Quelle/Kampagne (Konversion, nicht nur Menge)",
      "## Konkrete Handlungsempfehlungen (max. 5, priorisiert)",
      "## Auffälligkeiten / möglicher technischer Ausfall",
      "Für Auffälligkeiten: Prüfe z. B. Quellen mit vielen Leads aber 0 Konversion, Tage mit 0 Kontakten trotz Aktivität davor, extreme Ausreißer einzelner Agenten — und sage ehrlich, wenn die Datenbasis für eine Aussage zu dünn ist.",
      "Keine erfundenen Zahlen; beziehe dich nur auf die Daten. Agenten sind anonymisiert (Agent A/B/…).",
      "",
      "DATEN (JSON):",
      JSON.stringify(payload),
    ].join("\n");

    const { text, provider } = await aiComplete(prompt);
    // agentMap: Rück-Zuordnung Token→Name NUR für die Anzeige. Der gespeicherte
    // Text bleibt anonymisiert; die Anzeige ersetzt „Agent A" durch den echten
    // Namen (Datenschutz gegenüber OpenAI bleibt, Analyse wird lesbar).
    const summary = { at: new Date().toISOString(), range: data.range, provider, text, agentMap };
    // Speicherbar: letzte Zusammenfassung in den Settings (kopierbar im UI).
    await setSetting("leistung_last_summary", JSON.stringify(summary));
    res.json({ ok: true, summary });
  } catch (err) {
    console.error("[FIAON-LEISTUNG] ai-summary:", err);
    res.status(502).json({ ok: false, error: err instanceof Error ? err.message : "KI-Zusammenfassung fehlgeschlagen" });
  }
});

export default router;
