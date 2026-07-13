import { useState, useEffect, useCallback } from "react";
import { Upload, RefreshCw, Check, X, Link2, Search } from "lucide-react";

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

// ── CSV-Parser (Wise-Export), Trennzeichen automatisch ───────────────
function parseDelimited(text: string, delim: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [], field = "", inQ = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQ) {
      if (c === '"') { if (text[i + 1] === '"') { field += '"'; i++; } else inQ = false; }
      else field += c;
    } else if (c === '"') inQ = true;
    else if (c === delim) { row.push(field); field = ""; }
    else if (c === "\n") { row.push(field); rows.push(row); row = []; field = ""; }
    else if (c !== "\r") field += c;
  }
  if (field.length || row.length) { row.push(field); rows.push(row); }
  return rows.filter((r) => r.some((x) => x.trim() !== ""));
}
function detectDelim(sample: string): string {
  const first = sample.split(/\r?\n/)[0] || "";
  const counts: Record<string, number> = { ",": 0, ";": 0, "\t": 0 };
  for (const ch of first) if (ch in counts) counts[ch]++;
  const best = Object.entries(counts).sort((a, b) => b[1] - a[1])[0];
  return best[1] > 0 ? best[0] : ",";
}

const COLMAP: Record<string, string> = {
  "transferwise id": "txnId", "wise id": "txnId", "id": "txnId",
  "date time": "dateTime", "datetime": "dateTime",
  "amount": "amount", "currency": "currency",
  "description": "description", "payment reference": "reference", "reference": "reference",
  "payer name": "payerName",
  "transaction type": "transactionType", "transaction details type": "detailsType",
};

function parseBankCsv(text: string): any[] {
  const rows = parseDelimited(text, detectDelim(text));
  if (rows.length < 2) return [];
  const header = rows[0].map((h) => h.trim().toLowerCase());
  const idx: Record<string, number> = {};
  header.forEach((h, i) => { const key = COLMAP[h]; if (key && idx[key] === undefined) idx[key] = i; });
  return rows.slice(1).map((cols) => ({
    txnId: idx.txnId != null ? cols[idx.txnId] : "",
    dateTime: idx.dateTime != null ? cols[idx.dateTime] : "",
    amount: idx.amount != null ? cols[idx.amount] : "",
    currency: idx.currency != null ? cols[idx.currency] : "EUR",
    description: idx.description != null ? cols[idx.description] : "",
    reference: idx.reference != null ? cols[idx.reference] : "",
    payerName: idx.payerName != null ? cols[idx.payerName] : "",
    transactionType: idx.transactionType != null ? cols[idx.transactionType] : "",
    detailsType: idx.detailsType != null ? cols[idx.detailsType] : "",
  }));
}

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
      const rows = parseBankCsv(await file.text());
      if (rows.length === 0) { setFlash("Keine verwertbaren Zeilen erkannt."); return; }
      const r = await apiF("/admin/reconcile/import", { method: "POST", body: JSON.stringify({ rows }) });
      if (r.ok) setFlash(`Import: ${r.json.imported} Eingänge (${r.json.matched} zugeordnet, ${r.json.unmatched} offen, ${r.json.skipped} übersprungen — nur Kunden-Eingänge).`);
      else setFlash(r.json?.error || "Import fehlgeschlagen.");
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

  return (
    <div className="px-4 sm:px-6 py-5 max-w-6xl mx-auto">
      <div className="mb-4 flex items-start gap-3">
        <div className="flex-1">
          <h1 className="text-xl font-bold tracking-tight text-slate-900">Kontoabgleich</h1>
          <p className="text-[13px] text-slate-500">Reale Kontoeingänge (Kunden) exakt mit den Anträgen abgleichen und verbuchen — nur Eingänge, keine Provision.</p>
        </div>
        <label className={`px-3 py-2 rounded-lg text-white text-[12px] font-semibold inline-flex items-center gap-1.5 shrink-0 cursor-pointer ${busy ? "opacity-50" : ""}`} style={{ background: ACCENT }}>
          <Upload size={13} /> Kontoauszug (CSV)
          <input type="file" accept=".csv,text/csv" className="hidden" disabled={busy} onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])} />
        </label>
      </div>

      {flash && <div className="mb-4 px-4 py-2.5 rounded-lg border border-slate-300 bg-white text-[13px] text-slate-700">{flash}</div>}

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
                  {t.matched_ref ? <span>{t.customer_name || "—"}<br /><span className="text-[11px] text-slate-400">{t.matched_ref} · {t.payment_status || "—"}{t.amount_ok === false && <span className="text-amber-600"> · Betrag ≠ {eur(Math.round(Number(t.amount_due) * 100))}</span>}</span></span> : <span className="text-slate-400">—</span>}
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
