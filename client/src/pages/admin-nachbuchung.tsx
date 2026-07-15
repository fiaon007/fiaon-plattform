import { useState, useEffect, useCallback } from "react";
import { Link } from "wouter";
import { PageIntro } from "@/components/admin/PageHelp";

// ============================================================================
// /admin/nachbuchung (Paket EB + EC) — Provisionen nachbuchen
// - Auto-Erkennung: bezahlte, zugewiesene Bestellungen OHNE positive Provision
//   (findet die Dubletten-Bug-Altfälle UND künftige — kein hartcodiertes Array).
// - Betrag inkl. Quelle (Bestellung / Dublette / Bankeingang); „Betrag unklar"
//   ist NICHT sammelbuchbar, nur einzeln mit manueller Eingabe.
// - Buchung nutzt den bestehenden Abschluss-Hook onCustomerPaid (idempotent).
// - EC: „Zuordnung reparieren" mit Vorschau + Ergebnis-Report.
// Design nach Paket E: monochrom slate, Text-Badges, keine Emojis.
// ============================================================================

interface Candidate {
  ref: string;
  payment_reference: string | null;
  pack_name: string | null;
  customer_name: string | null;
  email: string | null;
  paid_at: string | null;
  agent_id: number | null;
  agent_name: string | null;
  agent_suggested?: boolean;
  rate_bp: number;
  amount_cents: number | null;
  amount_source: "order" | "donor" | "bank" | "none";
  donor_ref: string | null;
  estimated_commission_cents: number | null;
  status: "nachbuchbar" | "betrag_unklar";
}

interface Summary { total: number; bookable: number; unclear: number; bookableCommissionCents: number; }

function fmtCents(c: number | null | undefined): string {
  if (c == null) return "—";
  return `${(c / 100).toLocaleString("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`;
}
function fmtDate(v: string | null): string {
  if (!v) return "—";
  try { return new Date(v).toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric" }); } catch { return "—"; }
}
const SOURCE_LABEL: Record<string, string> = {
  order: "aus Bestellung", donor: "aus Dublette", bank: "aus Bankeingang", none: "unbekannt",
};

const inputCls =
  "w-full px-3 py-2 rounded-lg border border-slate-200 bg-white text-[13px] text-slate-900 placeholder:text-slate-400 focus:border-[#2563eb] focus:ring-2 focus:ring-[#2563eb]/10 outline-none transition-colors";
const btnPrimary =
  "px-4 py-2.5 rounded-lg text-white text-[13px] font-semibold transition-colors disabled:opacity-40 bg-[#2563eb] hover:bg-[#1d4fd7]";
const btnGhost =
  "px-3.5 py-2 rounded-lg border border-slate-200 bg-white text-[12px] font-semibold text-slate-600 hover:border-slate-300 hover:text-slate-800 transition-colors disabled:opacity-40";

export default function AdminNachbuchungPage() {
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState<string | null>(null);
  const [busyRef, setBusyRef] = useState<string | null>(null);
  const [bulkBusy, setBulkBusy] = useState(false);
  const [manualAmount, setManualAmount] = useState<Record<string, string>>({});

  // EC — Reparatur-Zuordnung
  const [repairPreview, setRepairPreview] = useState<{ count: number; refs: any[] } | null>(null);
  const [repairBusy, setRepairBusy] = useState(false);
  const [repairReport, setRepairReport] = useState<any[] | null>(null);

  const flash = (m: string) => { setMsg(m); setTimeout(() => setMsg(null), 6000); };

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/fiaon/admin/commission-backfill/candidates", { credentials: "include" });
      const json = await res.json().catch(() => null);
      if (res.ok && json?.ok) { setCandidates(json.candidates || []); setSummary(json.summary || null); }
    } catch { /* best effort */ } finally { setLoading(false); }
  }, []);

  const loadRepairPreview = useCallback(async () => {
    try {
      const res = await fetch("/api/fiaon/admin/payments/repair-attribution/preview", { credentials: "include" });
      const json = await res.json().catch(() => null);
      if (res.ok && json?.ok) setRepairPreview({ count: json.count, refs: json.refs || [] });
    } catch { /* best effort */ }
  }, []);

  useEffect(() => { load(); loadRepairPreview(); }, [load, loadRepairPreview]);

  const bookOne = async (c: Candidate) => {
    setBusyRef(c.ref);
    try {
      const body: any = {};
      if (c.status === "betrag_unklar") {
        const eur = Number((manualAmount[c.ref] || "").replace(",", "."));
        if (!eur || eur <= 0) { flash("Bitte einen gültigen Betrag eingeben."); setBusyRef(null); return; }
        body.manualAmountCents = Math.round(eur * 100);
      }
      // P2-B: Fall ohne zugewiesenen Agent — Buchung nur mit bewusster Bestätigung
      // des Betreuungs-Vorschlags (Admin-Entscheid, wird im Audit protokolliert).
      if (c.agent_suggested) {
        if (!c.agent_id) { flash("Kein Agent ermittelbar — bitte zuerst manuell zuweisen."); setBusyRef(null); return; }
        if (!confirm(`Diese Bestellung hat KEINEN zugewiesenen Agent.\n\nVorschlag aus dokumentierter Betreuung: ${c.agent_name || `Agent #${c.agent_id}`}\n\nZuweisen und Provision buchen? (Admin-Entscheid, wird protokolliert)`)) { setBusyRef(null); return; }
        body.agentId = c.agent_id;
      }
      const res = await fetch(`/api/fiaon/admin/commission-backfill/${encodeURIComponent(c.ref)}/book`, {
        method: "POST", headers: { "Content-Type": "application/json" }, credentials: "include", body: JSON.stringify(body),
      });
      const json = await res.json().catch(() => null);
      if (res.ok && json?.ok) {
        flash(json.alreadyBooked ? "War bereits gebucht — nichts geändert." : `Provision gebucht (${SOURCE_LABEL[json.source] || json.source}).`);
        await load();
      } else { flash(json?.error || "Fehler beim Buchen"); }
    } catch { flash("Netzwerkfehler"); } finally { setBusyRef(null); }
  };

  const bookAll = async () => {
    if (!summary || summary.bookable === 0) return;
    if (!confirm(`${summary.bookable} eindeutige Fälle nachbuchen?\n\nGesamte Provision: ${fmtCents(summary.bookableCommissionCents)}\n\nFälle mit unklarem Betrag (${summary.unclear}) werden übersprungen und müssen einzeln gebucht werden.`)) return;
    setBulkBusy(true);
    try {
      const res = await fetch("/api/fiaon/admin/commission-backfill/book-all", { method: "POST", credentials: "include" });
      const json = await res.json().catch(() => null);
      if (res.ok && json?.ok) {
        flash(`${json.booked} gebucht · ${json.skipped} bereits vorhanden · ${json.failed} fehlgeschlagen · ${json.unclear} unklar (übersprungen).`);
        await load();
      } else { flash(json?.error || "Fehler bei der Sammelbuchung"); }
    } catch { flash("Netzwerkfehler"); } finally { setBulkBusy(false); }
  };

  const runRepair = async () => {
    if (!repairPreview || repairPreview.count === 0) return;
    if (!confirm(`${repairPreview.count} bezahlte Bestellung(en) ohne Agent einer betreuenden Dublette zuordnen?\n\nEs wird nur die Zuordnung gesetzt — KEINE Provision. Provisionen buchst du danach im Nachbuchungs-Center.`)) return;
    setRepairBusy(true);
    try {
      const res = await fetch("/api/fiaon/admin/payments/repair-attribution", { method: "POST", credentials: "include" });
      const json = await res.json().catch(() => null);
      if (res.ok && json?.ok) {
        setRepairReport(json.refs || []);
        flash(`${json.count} Bestellung(en) zugeordnet.`);
        await loadRepairPreview();
        await load();
      } else { flash(json?.error || "Fehler bei der Reparatur"); }
    } catch { flash("Netzwerkfehler"); } finally { setRepairBusy(false); }
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8 sm:py-12">
        <PageIntro
          id="nachbuchung"
          title="Provisionen nachbuchen"
          subtitle="Hier findest du bezahlte Bestellungen, für die noch keine Provision gebucht wurde — und entscheidest, wer sie bekommt."
          steps={[
            "Die Tabelle erkennt automatisch alle bezahlten Bestellungen ohne Provisionseintrag — auch Fälle OHNE zugewiesenen Agent (mit Vorschlag aus der dokumentierten Betreuung).",
            "„Vorschlag — bestätigen“ heißt: Das System hat einen Agenten mit dokumentiertem Kontakt gefunden. Gebucht wird NUR nach deiner ausdrücklichen Bestätigung — nie automatisch.",
            "Die Buchung nutzt den regulären Abschluss-Weg (eingefrorener Provisionssatz, Werber-Beteiligung, Meilenstein) und ist doppelt-sicher: bereits gebuchte Fälle werden nie erneut gebucht.",
            "„Betrag unklar“: Für diese Fälle fehlt der Zahlbetrag — trage ihn manuell ein und buche einzeln. Die Sammelbuchung überspringt sie bewusst.",
            "Direktzahler (Zahlung ohne dokumentierte Agenten-Arbeit) erscheinen hier bewusst NICHT — dort entsteht kein Anspruch.",
          ]}
        />

        {msg && (
          <div className="mb-4 px-4 py-3 rounded-xl border border-slate-200 bg-white text-[13px] text-slate-700">{msg}</div>
        )}

        {/* ── EC: Zuordnung reparieren ── */}
        <div className="bg-white border border-slate-200 rounded-2xl p-5 mb-5">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="min-w-0">
              <h2 className="text-[15px] font-bold text-slate-900">Zuordnung reparieren</h2>
              <p className="text-[12px] text-slate-500 mt-1 max-w-xl">
                Überträgt bei bezahlten Bestellungen ohne Agent die Zuweisung der zugehörigen Dublette (gleiche E-Mail, betreut von einem Agent).
                Idempotent — bereits reparierte Bestände melden 0.
              </p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <span className="text-[13px] font-semibold text-slate-600 tabular-nums">
                {repairPreview ? `${repairPreview.count} offen` : "…"}
              </span>
              <button type="button" onClick={runRepair} disabled={repairBusy || !repairPreview || repairPreview.count === 0} className={btnPrimary}>
                {repairBusy ? "Repariert …" : "Zuordnung reparieren"}
              </button>
            </div>
          </div>
          {repairPreview && repairPreview.count > 0 && (
            <div className="mt-3 border border-slate-100 rounded-xl overflow-hidden divide-y divide-slate-50">
              {repairPreview.refs.slice(0, 20).map((r: any) => (
                <div key={r.ref} className="px-3.5 py-2 flex items-center justify-between gap-3 text-[12px]">
                  <span className="font-medium text-slate-700 truncate">{r.customer_name || "—"}
                    <span className="ml-2 font-mono text-[11px] text-slate-400">{r.payment_reference || r.ref}</span>
                  </span>
                  <span className="text-slate-500 shrink-0">→ {r.agent_name || `Agent #${r.assigned_agent_id}`}</span>
                </div>
              ))}
            </div>
          )}
          {repairReport && (
            <div className="mt-3 px-3.5 py-3 rounded-xl bg-slate-50 border border-slate-100">
              <p className="text-[12px] font-semibold text-slate-700 mb-1">Ergebnis: {repairReport.length} zugeordnet</p>
              {repairReport.length > 0 && (
                <ul className="text-[11.5px] text-slate-500 space-y-0.5">
                  {repairReport.map((r: any) => (
                    <li key={r.ref}><span className="font-mono">{r.ref}</span> → Agent #{r.agentId} (aus {r.donor})</li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>

        {/* ── EB: Zusammenfassung + Sammelbuchung ── */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
          <div className="bg-white border border-slate-200 rounded-2xl p-4">
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">Ohne Provision</p>
            <p className="text-xl font-bold text-slate-900 tabular-nums">{summary ? summary.total : "—"}</p>
          </div>
          <div className="bg-white border border-slate-200 rounded-2xl p-4">
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">Nachbuchbar</p>
            <p className="text-xl font-bold text-emerald-600 tabular-nums">{summary ? summary.bookable : "—"}</p>
          </div>
          <div className="bg-white border border-slate-200 rounded-2xl p-4">
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">Betrag unklar</p>
            <p className="text-xl font-bold text-amber-600 tabular-nums">{summary ? summary.unclear : "—"}</p>
          </div>
          <div className="bg-white border border-slate-200 rounded-2xl p-4">
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">Provisionssumme</p>
            <p className="text-xl font-bold text-slate-900 tabular-nums">{summary ? fmtCents(summary.bookableCommissionCents) : "—"}</p>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <p className="text-[12px] text-slate-500">
            „Betrag unklar" wird bei der Sammelbuchung übersprungen — bitte einzeln mit manueller Betragseingabe buchen.
          </p>
          <button type="button" onClick={bookAll} disabled={bulkBusy || !summary || summary.bookable === 0} className={btnPrimary}>
            {bulkBusy ? "Bucht …" : `Alle nachbuchbaren buchen${summary && summary.bookable > 0 ? ` (${summary.bookable})` : ""}`}
          </button>
        </div>

        {/* ── EB: Tabelle ── */}
        <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/70">
                  {["Kunde", "Referenz", "Bezahlt am", "Betrag", "Agent", "Satz", "Provision", "Status", "Aktion"].map((h) => (
                    <th key={h} className="px-4 py-3 text-[11px] font-bold uppercase tracking-wider text-slate-400 whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {loading && (
                  <tr><td colSpan={9} className="px-4 py-12 text-center text-[13px] text-slate-400">Lädt…</td></tr>
                )}
                {!loading && candidates.length === 0 && (
                  <tr><td colSpan={9} className="px-4 py-12 text-center text-[13px] text-slate-400">Keine offenen Nachbuchungen — alles gebucht.</td></tr>
                )}
                {!loading && candidates.map((c) => (
                  <tr key={c.ref} className="border-b border-slate-50 hover:bg-slate-50/50 transition-colors align-top">
                    <td className="px-4 py-3">
                      <p className="text-[13px] font-semibold text-slate-900">{c.customer_name || "—"}</p>
                      <p className="text-[11px] text-slate-400">{c.email || "—"}</p>
                    </td>
                    <td className="px-4 py-3">
                      <span className="font-mono text-[12px] font-bold text-[#2563eb]">{c.payment_reference || c.ref}</span>
                      {c.donor_ref && <p className="text-[10px] text-slate-400 font-mono">Dublette: {c.donor_ref}</p>}
                    </td>
                    <td className="px-4 py-3 text-[12px] text-slate-500 whitespace-nowrap">{fmtDate(c.paid_at)}</td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span className="text-[13px] font-bold">{fmtCents(c.amount_cents)}</span>
                      <p className="text-[10px] text-slate-400">{SOURCE_LABEL[c.amount_source]}</p>
                    </td>
                    <td className="px-4 py-3 text-[12px] text-slate-600 whitespace-nowrap">
                      {c.agent_name || (c.agent_id ? `#${c.agent_id}` : "—")}
                      {c.agent_suggested && (
                        <span className="block mt-0.5 px-1.5 py-0.5 rounded text-[10px] font-bold bg-blue-50 text-[#2563eb] w-fit">Vorschlag — bestätigen</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-[12px] text-slate-500 whitespace-nowrap">{(c.rate_bp / 100).toLocaleString("de-DE")} %</td>
                    <td className="px-4 py-3 text-[13px] font-bold whitespace-nowrap">{fmtCents(c.estimated_commission_cents)}</td>
                    <td className="px-4 py-3">
                      {c.status === "nachbuchbar" ? (
                        <span className="inline-block px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-700">Nachbuchbar</span>
                      ) : (
                        <span className="inline-block px-2.5 py-1 rounded-full text-[11px] font-bold bg-amber-100 text-amber-700">Betrag unklar</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {c.status === "betrag_unklar" ? (
                        <div className="flex items-center gap-1.5">
                          <input
                            type="text" inputMode="decimal" placeholder="Betrag €"
                            value={manualAmount[c.ref] || ""}
                            onChange={(e) => setManualAmount((m) => ({ ...m, [c.ref]: e.target.value }))}
                            className={`${inputCls} !w-24`}
                          />
                          <button type="button" onClick={() => bookOne(c)} disabled={busyRef === c.ref} className={btnGhost}>
                            {busyRef === c.ref ? "…" : "Buchen"}
                          </button>
                        </div>
                      ) : (
                        <button type="button" onClick={() => bookOne(c)} disabled={busyRef === c.ref} className={btnPrimary}>
                          {busyRef === c.ref ? "…" : "Provision buchen"}
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <p className="text-[12px] text-slate-400 mt-4">
          Nachgebuchte Provisionen erscheinen sofort im Agent-Portal (Guthaben) und fließen in den nächsten Auszahlungslauf.
          Alle Buchungen und Betrags-Ergänzungen sind im Kundenverlauf (Audit) protokolliert. Siehe auch{" "}
          <Link href="/admin/team" className="text-[#2563eb] font-semibold">Team-Übersicht</Link>.
        </p>
      </div>
    </div>
  );
}
