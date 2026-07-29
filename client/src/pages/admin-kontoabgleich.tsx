import { useState, useEffect, useCallback } from "react";
import { Upload, RefreshCw, Check, X, Link2, Search } from "lucide-react";
import { PageIntro } from "@/components/admin/PageHelp";

// ════════════════════════════════════════════════════════════════════
// /admin/kontoabgleich — Bank-Reconciliation (Kontoeingänge ↔ Kunden).
// Nur EINGÄNGE der Kunden (CREDIT + DEPOSIT). Verbuchen setzt payment_status
// ='paid' OHNE Provision. Nicht zuordenbare Eingänge manuell zuordnen/ignorieren.
// ════════════════════════════════════════════════════════════════════

const ACCENT = "#2563eb";

async function apiF(path: string, init?: RequestInit) {
  const res = await fetch(`/api/fiaon${path}`, {
    credentials: "include",
    headers: init?.body ? { "Content-Type": "application/json" } : undefined,
    ...init,
  });
  const json = await res.json().catch(() => null);
  return { status: res.status, ok: res.ok && json?.ok, json };
}

function eur(cents: number | null | undefined) {
  if (cents == null) return "—";
  return `${(Number(cents) / 100).toLocaleString("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`;
}
function fmtDT(v: string | null) {
  if (!v) return "—";
  try { return new Date(v).toLocaleString("de-DE", { day: "2-digit", month: "2-digit", year: "2-digit", hour: "2-digit", minute: "2-digit" }); } catch { return "—"; }
}

// ── Der Kontoauszug wird SERVERSEITIG gelesen ───────────────────────
// Früher zerlegte der Browser die Datei mit einer festen Spaltentabelle. Hiess
// eine Spalte anders, verschwand die Zeile wortlos — von 100 Eingängen wurden 9
// zugeordnet. Jetzt geht der Rohtext an den Server: `server/lib/wise-csv.ts`
// erkennt die Spalten in mehreren Sprach- und Formatvarianten und ANTWORTET MIT
// EINEM FEHLER, wenn eine Pflichtspalte fehlt. Diese Logik ist durch Tests
// abgesichert (`scripts/wise-csv-test.ts`) — im Browser war sie es nie.

const STATUS_CHIPS = [
  { key: "", label: "Alle" },
  { key: "matched", label: "Zugeordnet" },
  { key: "manual", label: "Manuell" },
  { key: "unmatched", label: "Offen" },
  { key: "ignored", label: "Ignoriert" },
];

function AssignModal({ txn, onClose, onDone }: { txn: any; onClose: () => void; onDone: () => void }) {
  const [q, setQ] = useState("");
  const [results, setResults] = useState<any[]>([]);
  // P2-A: Fuzzy-Vorschläge (Einzahlername + Betrag) — NUR Vorschlag mit Konfidenz,
  // der Admin bestätigt per Klick (assign). Nie automatische Verbuchung.
  const [suggestions, setSuggestions] = useState<any[]>([]);
  useEffect(() => {
    apiF(`/admin/reconcile/${txn.id}/suggestions`).then((r) => r.ok && setSuggestions(r.json.data || []));
  }, [txn.id]);
  useEffect(() => {
    if (q.trim().length < 2) { setResults([]); return; }
    const t = setTimeout(() => { apiF(`/admin/reconcile/search?q=${encodeURIComponent(q.trim())}`).then((r) => r.ok && setResults(r.json.data || [])); }, 250);
    return () => clearTimeout(t);
  }, [q]);
  const assign = async (ref: string) => {
    const r = await apiF(`/admin/reconcile/${txn.id}/assign`, { method: "POST", body: JSON.stringify({ ref }) });
    if (r.ok) { onDone(); onClose(); }
  };
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center py-10 px-3" onClick={onClose}>
      <div className="absolute inset-0 bg-slate-900/40" />
      <div className="relative w-full max-w-lg bg-white border border-slate-200 rounded-2xl shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="px-5 py-4 border-b border-slate-100 flex items-center gap-3">
          <p className="text-[15px] font-bold text-slate-900 flex-1">Eingang zuordnen</p>
          <button onClick={onClose} className="w-8 h-8 rounded-lg border border-slate-200 text-slate-400 flex items-center justify-center"><X size={15} /></button>
        </div>
        <div className="p-5">
          <div className="mb-3 text-[12px] text-slate-500">
            {eur(txn.amount_cents)} · {txn.payer_name || "—"} · <span className="text-slate-400">{txn.reference_raw}</span>
          </div>
          {suggestions.length > 0 && (
            <div className="mb-3">
              <p className="text-[11px] font-bold uppercase tracking-wide text-slate-400 mb-1.5">Vorschläge (Name + Betrag — bitte prüfen)</p>
              <div className="divide-y divide-slate-100 border border-slate-200 rounded-lg overflow-hidden">
                {suggestions.map((s) => (
                  <button key={s.ref} onClick={() => assign(s.ref)} className="w-full text-left px-3 py-2 hover:bg-slate-50 flex items-center gap-2">
                    <div className="flex-1 min-w-0">
                      <p className="text-[13px] font-semibold text-slate-800 truncate">{s.customer_name || "—"}</p>
                      <p className="text-[11px] text-slate-400">{s.payment_reference || s.ref} · {s.payment_status} · {eur(Math.round(Number(s.amount_due || 0) * 100))}</p>
                    </div>
                    <span className={`shrink-0 px-2 py-0.5 rounded-full text-[10px] font-bold ${s.confidence === "hoch" ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"}`} title={s.confidenceLabel}>
                      {s.confidence === "hoch" ? "Konfidenz hoch" : "Konfidenz mittel"}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}
          <div className="flex items-center gap-2 mb-3 px-2.5 py-1.5 rounded-lg border border-slate-200">
            <Search size={14} className="text-slate-400" />
            <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Referenz, Name oder E-Mail…" className="flex-1 text-[13px] outline-none" />
          </div>
          <div className="max-h-72 overflow-y-auto divide-y divide-slate-100">
            {results.length === 0 && <p className="text-[12px] text-slate-400 py-3 text-center">Mind. 2 Zeichen eingeben.</p>}
            {results.map((a) => (
              <button key={a.ref} onClick={() => assign(a.ref)} className="w-full text-left py-2 hover:bg-slate-50 flex items-center gap-2">
                <div className="flex-1">
                  <p className="text-[13px] font-semibold text-slate-800">{a.customer_name || "—"}</p>
                  <p className="text-[11px] text-slate-400">{a.ref} · {a.payment_status} · {eur(Math.round(Number(a.amount_due) * 100))}</p>
                </div>
                <Link2 size={14} className="text-slate-400" />
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function AdminKontoabgleichPage() {
  const [data, setData] = useState<any[]>([]);
  const [summary, setSummary] = useState<any>(null);
  const [filter, setFilter] = useState("");
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [flash, setFlash] = useState<string | null>(null);
  const [assignTxn, setAssignTxn] = useState<any>(null);
  const [syncAmount, setSyncAmount] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    const params = new URLSearchParams();
    if (filter) params.set("status", filter);
    if (q.trim()) params.set("q", q.trim());
    Promise.all([
      apiF(`/admin/reconcile/list?${params.toString()}`).then((r) => r.ok && setData(r.json.data || [])),
      apiF(`/admin/reconcile/summary`).then((r) => r.ok && setSummary(r.json.summary)),
    ]).finally(() => setLoading(false));
  }, [filter, q]);
  useEffect(load, [load]);
  useEffect(() => { if (flash) { const t = setTimeout(() => setFlash(null), 4000); return () => clearTimeout(t); } }, [flash]);

  const onFile = async (file: File) => {
    setBusy(true); setFlash(null);
    try {
      const csv = await file.text();
      const r = await apiF("/admin/reconcile/import", { method: "POST", body: JSON.stringify({ csv }) });
      if (r.ok) {
        const st = r.json.stufen || {};
        const sicher = (st.referenz || 0) + (st.iban || 0) + (st.name_betrag || 0);
        setFlash(
          `Import: ${r.json.imported} Eingänge — ${sicher} sicher zugeordnet ` +
          `(${st.referenz || 0}× Referenz, ${st.iban || 0}× IBAN, ${st.name_betrag || 0}× Name+Betrag), ` +
          `${r.json.unmatched} zur Prüfung. ` +
          (r.json.hinweise?.length ? r.json.hinweise.join(" · ") + ". " : "") +
          "Nichts verbucht, keine E-Mail verschickt.",
        );
      } else {
        // Die Begründung des Servers wird vollständig angezeigt — sie nennt die
        // fehlende Pflichtspalte und die tatsächlich gefundenen Überschriften.
        setFlash(r.json?.error || "Import fehlgeschlagen.");
      }
      load();
    } finally { setBusy(false); }
  };

  const apply = async (id: number) => {
    const r = await apiF(`/admin/reconcile/${id}/apply`, { method: "POST", body: JSON.stringify({ syncAmount }) });
    if (r.ok) { setFlash(`Verbucht: ${r.json.ref}`); load(); } else setFlash(r.json?.error || "Fehler");
  };
  const ignore = async (id: number) => { const r = await apiF(`/admin/reconcile/${id}/ignore`, { method: "POST" }); if (r.ok) load(); };
  const applyAll = async () => {
    setBusy(true);
    const r = await apiF("/admin/reconcile/apply-matched", { method: "POST", body: JSON.stringify({ syncAmount }) });
    if (r.ok) setFlash(`${r.json.applied}/${r.json.total} zugeordnete Eingänge verbucht.`);
    setBusy(false); load();
  };
  // P2-A: unzugeordnete Eingänge mit dem reparierten Matcher erneut prüfen
  // (heilt den 0-%-Altbestand aus D6 — ordnet nur zu, verbucht NICHTS).
  const rematch = async () => {
    setBusy(true);
    const r = await apiF("/admin/reconcile/rematch", { method: "POST" });
    if (r.ok) setFlash(`Neu abgeglichen: ${r.json.matched} von ${r.json.checked} offenen Eingängen jetzt zugeordnet (nichts verbucht — bitte prüfen und verbuchen).`);
    else setFlash(r.json?.error || "Fehler beim Neu-Abgleich");
    setBusy(false); load();
  };

  return (
    <div className="px-4 sm:px-6 py-5 max-w-6xl mx-auto">
      <div className="mb-4 flex items-start gap-3">
        <div className="flex-1 min-w-0">
          <PageIntro
            id="kontoabgleich"
            title="Kontoabgleich"
            subtitle="Hier gleichst du die echten Bank-Eingänge mit den Kunden ab und verbuchst sie — identisch zum „bezahlt“-Button."
            steps={[
              "Lade rechts den Kontoauszug (CSV, z. B. Wise) hoch. Nur Kunden-EINGÄNGE werden importiert — Ausgänge und Karten-Umsätze ignoriert das System automatisch.",
              "Das System ordnet Eingänge per Zahlungsreferenz (FIAON-…) automatisch zu. „Offene neu abgleichen“ prüft alte, unzugeordnete Eingänge erneut — ordnet nur zu, verbucht nichts.",
              "Offene Eingänge ohne Referenz ordnest du per „Zuordnen“ zu — mit Vorschlägen nach Einzahlername + Betrag (Konfidenz wird angezeigt, du bestätigst immer selbst).",
              "„Verbuchen“ wirkt exakt wie der „bezahlt“-Button: Freischaltung, Dubletten-Stopp, Bestätigungs-Mail (genau 1×), Provisionsprüfung. Betrags-Abweichungen werden markiert, nie stillschweigend übernommen.",
              "„Ignorieren“ ist für Eingänge, die keine Kundenzahlung sind (z. B. eigene Umbuchung).",
            ]}
          />
        </div>
        <label className={`px-3 py-2 rounded-lg text-white text-[12px] font-semibold inline-flex items-center gap-1.5 shrink-0 cursor-pointer ${busy ? "opacity-50" : ""}`} style={{ background: ACCENT }}>
          <Upload size={13} /> Kontoauszug (CSV)
          <input type="file" accept=".csv,text/csv" className="hidden" disabled={busy} onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])} />
        </label>
      </div>

      {flash && <div className="mb-4 px-4 py-2.5 rounded-lg border border-slate-300 bg-white text-[13px] text-slate-700 whitespace-pre-line">{flash}</div>}

      {summary && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
          <div className="bg-white border border-slate-200 rounded-xl p-3"><p className="text-[11px] text-slate-400">Eingänge gesamt</p><p className="text-lg font-bold text-slate-900 tabular-nums">{eur(summary.totalCents)}</p><p className="text-[11px] text-slate-400">{summary.totalCount} Buchungen</p></div>
          <div className="bg-white border border-slate-200 rounded-xl p-3"><p className="text-[11px] text-slate-400">Zugeordnet</p><p className="text-lg font-bold text-slate-900 tabular-nums">{eur(summary.matchedCents)}</p><p className="text-[11px] text-slate-400">{summary.matchedCount} · verbucht {summary.appliedCount}</p></div>
          <div className="bg-white border border-slate-200 rounded-xl p-3"><p className="text-[11px] text-slate-400">Offen (nicht zugeordnet)</p><p className="text-lg font-bold text-slate-900 tabular-nums">{eur(summary.unmatchedCents)}</p><p className="text-[11px] text-slate-400">{summary.unmatchedCount} Buchungen</p></div>
          <div className="bg-white border border-slate-200 rounded-xl p-3"><p className="text-[11px] text-slate-400">Betrags-Abweichungen</p><p className="text-lg font-bold text-slate-900 tabular-nums">{summary.discrepancyCount}</p><p className="text-[11px] text-slate-400">{summary.ignoredCount} ignoriert</p></div>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2 mb-3">
        {STATUS_CHIPS.map((c) => (
          <button key={c.key} onClick={() => setFilter(c.key)} className={`px-3 py-1.5 rounded-lg text-[12px] font-semibold border ${filter === c.key ? "bg-slate-900 text-white border-slate-900" : "border-slate-200 text-slate-500 hover:border-slate-300"}`}>{c.label}</button>
        ))}
        <label className="flex items-center gap-1.5 text-[12px] text-slate-600 ml-2"><input type="checkbox" checked={syncAmount} onChange={(e) => setSyncAmount(e.target.checked)} /> Betrag exakt übernehmen</label>
        <div className="ml-auto flex items-center gap-2">
          <button onClick={rematch} disabled={busy} className="px-3 py-1.5 rounded-lg border border-slate-300 text-[12px] font-semibold text-slate-600 hover:border-slate-400 disabled:opacity-40" title="Offene Eingänge mit dem reparierten Matcher erneut prüfen — ordnet nur zu, verbucht nichts">Offene neu abgleichen</button>
          <button onClick={applyAll} disabled={busy} className="px-3 py-1.5 rounded-lg text-white text-[12px] font-semibold disabled:opacity-40" style={{ background: ACCENT }}>Alle zugeordneten verbuchen</button>
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Name, Referenz…" className="px-3 py-1.5 rounded-lg border border-slate-200 text-[13px] w-44" />
          <button onClick={load} className="w-9 h-9 rounded-lg border border-slate-200 text-slate-400 flex items-center justify-center"><RefreshCw size={15} /></button>
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <table className="w-full text-[13px]">
          <thead className="bg-slate-50 text-slate-400 text-[11px] uppercase tracking-wide">
            <tr>
              <th className="text-left px-3 py-2.5 font-semibold">Datum</th>
              <th className="text-left px-3 py-2.5 font-semibold">Einzahler / Referenz</th>
              <th className="text-right px-3 py-2.5 font-semibold">Betrag</th>
              <th className="text-left px-3 py-2.5 font-semibold">Kunde / Antrag</th>
              <th className="text-left px-3 py-2.5 font-semibold">Status</th>
              <th className="text-right px-3 py-2.5 font-semibold">Aktion</th>
            </tr>
          </thead>
          <tbody>
            {loading && <tr><td colSpan={6} className="px-4 py-6 text-center text-slate-400">Lädt…</td></tr>}
            {!loading && data.length === 0 && <tr><td colSpan={6} className="px-4 py-6 text-center text-slate-400">Keine Eingänge — Kontoauszug (CSV) hochladen.</td></tr>}
            {data.map((t) => (
              <tr key={t.id} className="border-t border-slate-100">
                <td className="px-3 py-2 text-slate-500 whitespace-nowrap">{fmtDT(t.booked_at)}</td>
                <td className="px-3 py-2 text-slate-600"><span className="font-semibold">{t.payer_name || "—"}</span><br /><span className="text-[11px] text-slate-400">{t.reference_raw}</span></td>
                <td className="px-3 py-2 text-right font-semibold text-slate-800 tabular-nums whitespace-nowrap">{eur(t.amount_cents)}<br />{t.currency !== "EUR" && <span className="text-[11px] text-slate-400">{t.currency}</span>}</td>
                <td className="px-3 py-2 text-slate-600">
                  {t.matched_ref ? <span>{t.customer_name || "—"}<br /><span className="text-[11px] text-slate-400">{t.matched_ref} · {t.payment_status || "—"}{t.amount_ok === false && <span className="text-amber-600"> · Betrag ≠ {eur(Math.round(Number(t.amount_due) * 100))}</span>}</span>{t.payerNameMismatch && <><br /><span className="text-[11px] text-slate-500 italic" title="Die Referenz stimmt — der Einzahlername ist der verlässliche Anker nicht.">{t.payerHint || "Name weicht ab (Zahlung evtl. durch Dritte)"}</span></>}</span> : <span className="text-slate-400">—</span>}
                </td>
                <td className="px-3 py-2">
                  <span className={`inline-block px-2.5 py-0.5 rounded-full border text-[11px] font-semibold ${t.applied ? "border-emerald-200 text-emerald-700 bg-emerald-50" : t.match_status === "unmatched" ? "border-amber-200 text-amber-700 bg-amber-50" : t.match_status === "ignored" ? "border-slate-200 text-slate-400" : "border-slate-200 text-slate-500"}`}>
                    {t.applied ? "verbucht" : t.match_status === "matched" ? "zugeordnet" : t.match_status === "manual" ? "manuell" : t.match_status === "ignored" ? "ignoriert" : "offen"}
                  </span>
                </td>
                <td className="px-3 py-2 text-right whitespace-nowrap">
                  {!t.applied && t.match_status !== "ignored" && (
                    <div className="inline-flex items-center gap-1.5">
                      {t.matched_ref
                        ? <button onClick={() => apply(t.id)} className="px-2.5 py-1 rounded-lg text-white text-[11px] font-semibold inline-flex items-center gap-1" style={{ background: ACCENT }}><Check size={12} /> Verbuchen</button>
                        : <button onClick={() => setAssignTxn(t)} className="px-2.5 py-1 rounded-lg border border-slate-200 text-[11px] font-semibold text-slate-600 inline-flex items-center gap-1"><Link2 size={12} /> Zuordnen</button>}
                      {t.match_status !== "manual" && !t.matched_ref && <button onClick={() => ignore(t.id)} className="px-2 py-1 rounded-lg border border-slate-200 text-[11px] text-slate-400">Ignorieren</button>}
                      {t.matched_ref && <button onClick={() => setAssignTxn(t)} className="px-2 py-1 rounded-lg border border-slate-200 text-[11px] text-slate-400">Ändern</button>}
                    </div>
                  )}
                  {t.applied && <span className="text-[11px] text-slate-400">{fmtDT(t.applied_at)}</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {assignTxn && <AssignModal txn={assignTxn} onClose={() => setAssignTxn(null)} onDone={load} />}
    </div>
  );
}
