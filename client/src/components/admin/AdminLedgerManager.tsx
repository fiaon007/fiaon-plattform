import { useEffect, useState, useMemo } from "react";

/* ── Types ── */
interface LedgerEntry {
  id: number;
  booking_date: string;
  value_date: string;
  reference: string;
  description: string;
  category: string;
  booking_type: "credit" | "debit";
  amount_cents: number;
  currency: string;
  counter_account: string | null;
  notes: string | null;
  created_at: string;
  runningBalance?: number;
}
interface LedgerData { openingBalanceCents: number; currency: string; entries: LedgerEntry[]; }

/* ── Helpers ── */
const n2 = (cents: number) =>
  new Intl.NumberFormat("de-CH", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format((cents || 0) / 100);
const fmtDate = (v: string) => { try { return new Date(v).toLocaleDateString("de-CH", { day: "2-digit", month: "2-digit", year: "numeric" }); } catch { return v; } };
const fmtDateTime = (v: string) => { try { return new Date(v).toLocaleString("de-CH", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }); } catch { return v; } };

const api = (url: string, opts: RequestInit = {}) =>
  fetch(url, { ...opts, credentials: "include", headers: { ...(opts.headers as Record<string,string> ?? {}), "x-admin-token": "fiaon-admin-2024" } });

const TODAY = new Date().toISOString().split("T")[0];

const CATEGORIES = [
  "Managementgebühren","Beratungshonorare","Zinserträge","Investmentrenditen",
  "Dividendenerträge","Erfolgsgebühren","Provisionen","Darlehensrückflüsse",
  "Personalkosten","Miete & Infrastruktur","Rechtsberatung","Bankgebühren",
  "Reise & Repräsentation","IT & Infrastruktur","Investorenausschüttungen",
  "Steuern & Abgaben","Versicherungen","Externe Dienstleister","Repräsentation","Sonstiges",
];

const inputCls = "w-full px-3 py-2.5 border border-slate-300 rounded-lg bg-white text-[13px] text-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-900/20 focus:border-slate-500 transition-all font-mono";

function DetailRow({ label, value, mono = false, highlight }: { label: string; value: React.ReactNode; mono?: boolean; highlight?: string }) {
  return (
    <div className="py-3 border-b border-slate-100 last:border-0 flex gap-3">
      <span className="w-[130px] shrink-0 text-[10px] font-bold text-slate-400 uppercase tracking-[.1em] pt-0.5">{label}</span>
      <span className={`text-[13px] text-slate-900 break-all ${mono ? "font-mono" : "font-medium"} ${highlight || ""}`}>{value || <span className="text-slate-300">—</span>}</span>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="block"><span className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">{label}</span>{children}</label>;
}

/* ── Main Component ── */
export default function AdminLedgerManager() {
  const [data, setData] = useState<LedgerData | null>(null);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedEntry, setSelectedEntry] = useState<LedgerEntry | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<LedgerEntry | null>(null);
  const [search, setSearch] = useState("");
  const [filterType, setFilterType] = useState<"all"|"credit"|"debit">("all");
  const [filterCat, setFilterCat] = useState("all");
  const [filterDateFrom, setFilterDateFrom] = useState("");
  const [filterDateTo, setFilterDateTo] = useState("");
  const [page, setPage] = useState(0);
  const PAGE_SIZE = 40;

  const flash = (m: string) => { setToast(m); setTimeout(() => setToast(null), 3000); };

  const load = async () => {
    setLoading(true);
    try {
      const r = await api("/api/admin/ledger");
      const d = await r.json();
      if (d.ok) setData(d);
    } catch { } finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  const enriched: LedgerEntry[] = useMemo(() => {
    if (!data) return [];
    let bal = data.openingBalanceCents;
    return data.entries.map(e => {
      bal += e.booking_type === "credit" ? e.amount_cents : -e.amount_cents;
      return { ...e, runningBalance: bal };
    });
  }, [data]);

  const stats = useMemo(() => {
    const totalCredits = enriched.filter(e => e.booking_type === "credit").reduce((s, e) => s + e.amount_cents, 0);
    const totalDebits  = enriched.filter(e => e.booking_type === "debit" ).reduce((s, e) => s + e.amount_cents, 0);
    const currentBalance = enriched.length > 0 ? (enriched[enriched.length-1].runningBalance ?? 0) : (data?.openingBalanceCents ?? 0);
    return { totalCredits, totalDebits, currentBalance, net: totalCredits - totalDebits };
  }, [enriched, data]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    return enriched.filter(e => {
      if (filterType !== "all" && e.booking_type !== filterType) return false;
      if (filterCat !== "all" && e.category !== filterCat) return false;
      if (filterDateFrom && e.booking_date < filterDateFrom) return false;
      if (filterDateTo   && e.booking_date > filterDateTo)   return false;
      if (q && ![e.description, e.reference, e.category, e.counter_account ?? ""].join(" ").toLowerCase().includes(q)) return false;
      return true;
    }).reverse();
  }, [enriched, filterType, filterCat, filterDateFrom, filterDateTo, search]);

  const paged = filtered.slice(page * PAGE_SIZE, (page+1) * PAGE_SIZE);
  const pageCount = Math.ceil(filtered.length / PAGE_SIZE);

  const deleteEntry = async () => {
    if (!confirmDelete) return;
    setBusy(true);
    try {
      await api(`/api/admin/ledger/${confirmDelete.id}`, { method: "DELETE" });
      setConfirmDelete(null);
      if (selectedEntry?.id === confirmDelete.id) setSelectedEntry(null);
      flash("Buchung gelöscht");
      await load();
    } finally { setBusy(false); }
  };

  if (loading) return (
    <div className="space-y-4">
      <div className="h-44 rounded-lg bg-slate-100 animate-pulse" />
      <div className="h-96 rounded-lg bg-slate-100 animate-pulse" />
    </div>
  );

  /* date range for header */
  const firstDate = enriched.length > 0 ? enriched[0].booking_date : TODAY;
  const lastDate  = enriched.length > 0 ? enriched[enriched.length-1].booking_date : TODAY;

  return (
    <div className="space-y-0">
      {toast && <div className="fixed top-4 right-4 z-[70] px-4 py-2.5 bg-slate-900 text-white text-[13px] font-semibold rounded-lg shadow-xl border border-slate-700">{toast}</div>}

      {/* ══════════════ BANK STATEMENT HEADER ══════════════ */}
      <div style={{ background: "linear-gradient(160deg, #0D1B3E 0%, #122044 60%, #0D1B3E 100%)" }} className="rounded-t-2xl px-8 pt-7 pb-0 relative overflow-hidden">
        {/* Subtle grid */}
        <div className="absolute inset-0 opacity-[0.04]" style={{ backgroundImage: "linear-gradient(rgba(255,255,255,.8) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.8) 1px, transparent 1px)", backgroundSize: "40px 40px" }} />

        <div className="relative">
          {/* Top row */}
          <div className="flex items-start justify-between gap-6 mb-6">
            <div>
              <p className="text-[10px] font-bold tracking-[.25em] uppercase mb-1" style={{ color: "#B8923A" }}>Schwarzott Group · Zürich</p>
              <h2 className="text-[22px] font-bold text-white leading-tight tracking-tight">Kontoauszug</h2>
              <p className="text-[12px] mt-1" style={{ color: "#7a8ba8" }}>Hauptkonto CHF · Löwenstrasse 20, 8001 Zürich</p>
            </div>
            <div className="text-right hidden sm:block">
              <p className="text-[10px] font-bold tracking-[.15em] uppercase mb-1" style={{ color: "#B8923A" }}>Zeitraum</p>
              <p className="text-[13px] font-bold text-white">{fmtDate(firstDate)} – {fmtDate(lastDate)}</p>
              <p className="text-[11px] mt-0.5" style={{ color: "#7a8ba8" }}>{enriched.length} Buchungen</p>
            </div>
          </div>

          {/* IBAN row */}
          <div className="flex flex-wrap gap-x-8 gap-y-1 mb-6">
            <div><p className="text-[9px] font-bold uppercase tracking-[.15em] mb-0.5" style={{ color: "#7a8ba8" }}>IBAN</p><p className="text-[13px] font-mono font-bold text-white tracking-wider">CH56 0483 5012 3456 7800 9</p></div>
            <div><p className="text-[9px] font-bold uppercase tracking-[.15em] mb-0.5" style={{ color: "#7a8ba8" }}>BIC / SWIFT</p><p className="text-[13px] font-mono font-bold text-white">UBSWCHZH80A</p></div>
            <div><p className="text-[9px] font-bold uppercase tracking-[.15em] mb-0.5" style={{ color: "#7a8ba8" }}>Kontonummer</p><p className="text-[13px] font-mono font-bold text-white">0483-5012345.67</p></div>
            <div><p className="text-[9px] font-bold uppercase tracking-[.15em] mb-0.5" style={{ color: "#7a8ba8" }}>Währung</p><p className="text-[13px] font-mono font-bold text-white">CHF</p></div>
          </div>

          {/* Balance bar */}
          <div className="flex flex-wrap items-stretch gap-0 border-t" style={{ borderColor: "rgba(184,146,58,.3)" }}>
            <div className="flex-1 min-w-[200px] pt-4 pb-5 pr-8 border-r" style={{ borderColor: "rgba(184,146,58,.2)" }}>
              <p className="text-[9px] font-bold uppercase tracking-[.15em] mb-1" style={{ color: "#7a8ba8" }}>Aktueller Kontostand</p>
              <p className="text-[34px] font-bold leading-none tracking-tight" style={{ color: "#d4af6a", fontVariantNumeric: "tabular-nums" }}>
                CHF {n2(stats.currentBalance)}
              </p>
            </div>
            <div className="flex divide-x pt-4 pb-5" style={{ borderColor: "rgba(184,146,58,.2)" }}>
              <div className="px-6">
                <p className="text-[9px] font-bold uppercase tracking-[.15em] mb-1" style={{ color: "#7a8ba8" }}>Haben (Eingänge)</p>
                <p className="text-[16px] font-bold tabular-nums" style={{ color: "#4ade80" }}>+CHF {n2(stats.totalCredits)}</p>
              </div>
              <div className="px-6">
                <p className="text-[9px] font-bold uppercase tracking-[.15em] mb-1" style={{ color: "#7a8ba8" }}>Soll (Ausgänge)</p>
                <p className="text-[16px] font-bold tabular-nums" style={{ color: "#f87171" }}>−CHF {n2(stats.totalDebits)}</p>
              </div>
              <div className="px-6">
                <p className="text-[9px] font-bold uppercase tracking-[.15em] mb-1" style={{ color: "#7a8ba8" }}>Netto</p>
                <p className={`text-[16px] font-bold tabular-nums`} style={{ color: stats.net >= 0 ? "#4ade80" : "#f87171" }}>
                  {stats.net >= 0 ? "+" : "−"}CHF {n2(Math.abs(stats.net))}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ══════════════ FILTER + ACTION BAR ══════════════ */}
      <div className="bg-white border-x border-slate-200 px-5 py-3 flex flex-wrap items-center gap-2">
        <input value={search} onChange={e => { setSearch(e.target.value); setPage(0); }} placeholder="Suchen…" className="w-52 px-3 py-1.5 border border-slate-200 rounded-md bg-slate-50 text-[12px] focus:outline-none focus:ring-1 focus:ring-slate-400 transition-all" />
        <div className="flex border border-slate-200 rounded-md overflow-hidden">
          {(["all","credit","debit"] as const).map(t => (
            <button key={t} onClick={() => { setFilterType(t); setPage(0); }}
              className={`px-3 py-1.5 text-[12px] font-semibold transition-colors border-r border-slate-200 last:border-0 ${filterType === t ? "bg-slate-900 text-white" : "bg-white text-slate-600 hover:bg-slate-50"}`}>
              {t === "all" ? "Alle" : t === "credit" ? "Haben" : "Soll"}
            </button>
          ))}
        </div>
        <select value={filterCat} onChange={e => { setFilterCat(e.target.value); setPage(0); }} className="px-2.5 py-1.5 border border-slate-200 rounded-md bg-white text-[12px] text-slate-700 focus:outline-none focus:ring-1 focus:ring-slate-400">
          <option value="all">Alle Kategorien</option>
          {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
        <input type="date" value={filterDateFrom} onChange={e => { setFilterDateFrom(e.target.value); setPage(0); }} className="px-2 py-1.5 border border-slate-200 rounded-md bg-white text-[12px] text-slate-700 focus:outline-none" />
        <span className="text-slate-300 text-[12px]">–</span>
        <input type="date" value={filterDateTo} onChange={e => { setFilterDateTo(e.target.value); setPage(0); }} className="px-2 py-1.5 border border-slate-200 rounded-md bg-white text-[12px] text-slate-700 focus:outline-none" />
        {(search || filterType !== "all" || filterCat !== "all" || filterDateFrom || filterDateTo) && (
          <button onClick={() => { setSearch(""); setFilterType("all"); setFilterCat("all"); setFilterDateFrom(""); setFilterDateTo(""); setPage(0); }} className="text-[11px] text-slate-400 hover:text-slate-700 px-1 underline underline-offset-2">zurücksetzen</button>
        )}
        <div className="ml-auto flex items-center gap-2">
          <span className="text-[11px] text-slate-400">{filtered.length} von {enriched.length} Buchungen</span>
          <button onClick={load} className="p-1.5 rounded-md hover:bg-slate-100 transition-colors text-slate-400" title="Neu laden">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg>
          </button>
          <button onClick={() => setShowAddModal(true)} className="px-4 py-1.5 text-[12px] font-bold text-white rounded-md transition-colors" style={{ background: "#0D1B3E" }}>
            + Buchung erfassen
          </button>
        </div>
      </div>

      {/* ══════════════ LEDGER TABLE ══════════════ */}
      <div className="bg-white border border-slate-200 rounded-b-2xl overflow-hidden shadow-sm">
        {paged.length === 0 ? (
          <div className="py-16 text-center text-[13px] text-slate-400">Keine Buchungen gefunden</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[960px] border-collapse">
              <thead>
                <tr style={{ background: "#f8f9fb", borderBottom: "2px solid #e2e8f0" }}>
                  <th className="text-left py-2.5 px-3 text-[10px] font-bold uppercase tracking-[.12em] text-slate-500 w-[92px]">Buchungsdat.</th>
                  <th className="text-left py-2.5 px-3 text-[10px] font-bold uppercase tracking-[.12em] text-slate-500 w-[92px]">Wertst.-Dat.</th>
                  <th className="text-left py-2.5 px-3 text-[10px] font-bold uppercase tracking-[.12em] text-slate-500 w-[130px]">Referenz</th>
                  <th className="text-left py-2.5 px-3 text-[10px] font-bold uppercase tracking-[.12em] text-slate-500">Buchungstext</th>
                  <th className="text-left py-2.5 px-3 text-[10px] font-bold uppercase tracking-[.12em] text-slate-500 w-[140px] hidden xl:table-cell">Kategorie</th>
                  <th className="text-right py-2.5 px-3 text-[10px] font-bold uppercase tracking-[.12em] text-rose-500 w-[120px]">Soll CHF</th>
                  <th className="text-right py-2.5 px-3 text-[10px] font-bold uppercase tracking-[.12em] text-emerald-600 w-[120px]">Haben CHF</th>
                  <th className="text-right py-2.5 px-3 text-[10px] font-bold uppercase tracking-[.12em] text-slate-700 w-[130px] border-l border-slate-200">Saldo CHF</th>
                  <th className="w-[32px]"></th>
                </tr>
              </thead>
              <tbody>
                {paged.map((entry, i) => {
                  const isSelected = selectedEntry?.id === entry.id;
                  const showDateRow = i === 0 || paged[i-1].booking_date !== entry.booking_date;
                  return (
                    <>
                      {showDateRow && (
                        <tr key={`d-${entry.booking_date}`} style={{ background: "#f1f5f9", borderTop: i !== 0 ? "1px solid #e2e8f0" : undefined }}>
                          <td colSpan={9} className="px-3 py-1">
                            <span className="text-[10px] font-bold text-slate-500 tracking-wider uppercase">{fmtDate(entry.booking_date)}</span>
                          </td>
                        </tr>
                      )}
                      <tr key={entry.id}
                        onClick={() => setSelectedEntry(isSelected ? null : entry)}
                        className={`group cursor-pointer transition-colors border-b border-slate-100 ${isSelected ? "bg-[#0D1B3E]/[0.04]" : "hover:bg-slate-50/70"}`}
                        style={isSelected ? { borderLeft: "3px solid #0D1B3E" } : { borderLeft: "3px solid transparent" }}>
                        <td className="py-2.5 px-3 text-[12px] font-mono text-slate-600 whitespace-nowrap">{fmtDate(entry.booking_date)}</td>
                        <td className="py-2.5 px-3 text-[12px] font-mono text-slate-500 whitespace-nowrap">{fmtDate(entry.value_date)}</td>
                        <td className="py-2.5 px-3">
                          <span className="text-[10px] font-mono text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200">{entry.reference}</span>
                        </td>
                        <td className="py-2.5 px-3">
                          <p className="text-[13px] font-medium text-slate-800 leading-snug">{entry.description}</p>
                          {entry.counter_account && <p className="text-[11px] text-slate-400 mt-0.5">{entry.counter_account}</p>}
                        </td>
                        <td className="py-2.5 px-3 hidden xl:table-cell">
                          <span className="text-[11px] text-slate-500">{entry.category}</span>
                        </td>
                        <td className="py-2.5 px-3 text-right tabular-nums">
                          {entry.booking_type === "debit" ? <span className="text-[13px] font-semibold text-rose-600">{n2(entry.amount_cents)}</span> : <span className="text-slate-200">—</span>}
                        </td>
                        <td className="py-2.5 px-3 text-right tabular-nums">
                          {entry.booking_type === "credit" ? <span className="text-[13px] font-semibold text-slate-800">{n2(entry.amount_cents)}</span> : <span className="text-slate-200">—</span>}
                        </td>
                        <td className="py-2.5 px-3 text-right tabular-nums border-l border-slate-200">
                          <span className="text-[13px] font-bold text-slate-900">{n2(entry.runningBalance ?? 0)}</span>
                        </td>
                        <td className="py-2.5 px-1 text-center">
                          <button onClick={e => { e.stopPropagation(); setConfirmDelete(entry); }}
                            className="opacity-0 group-hover:opacity-100 transition-opacity w-6 h-6 rounded hover:bg-rose-50 flex items-center justify-center text-slate-300 hover:text-rose-500 mx-auto">
                            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/></svg>
                          </button>
                        </td>
                      </tr>
                    </>
                  );
                })}
              </tbody>
              {/* Footer total row */}
              {paged.length > 0 && (
                <tfoot>
                  <tr style={{ background: "#f8f9fb", borderTop: "2px solid #e2e8f0" }}>
                    <td colSpan={5} className="px-3 py-2.5 text-[11px] font-bold text-slate-500 uppercase tracking-wider">Seitenübersicht</td>
                    <td className="px-3 py-2.5 text-right tabular-nums">
                      <span className="text-[12px] font-bold text-rose-600">{n2(paged.filter(e => e.booking_type === "debit").reduce((s,e) => s+e.amount_cents, 0))}</span>
                    </td>
                    <td className="px-3 py-2.5 text-right tabular-nums">
                      <span className="text-[12px] font-bold text-slate-800">{n2(paged.filter(e => e.booking_type === "credit").reduce((s,e) => s+e.amount_cents, 0))}</span>
                    </td>
                    <td className="px-3 py-2.5 text-right border-l border-slate-200"></td>
                    <td></td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        )}

        {/* Pagination */}
        {pageCount > 1 && (
          <div className="px-5 py-3 border-t border-slate-100 flex items-center justify-between bg-slate-50/60">
            <p className="text-[11px] text-slate-400">Seite {page+1} von {pageCount} · {filtered.length} Einträge</p>
            <div className="flex items-center gap-1">
              <button disabled={page === 0} onClick={() => setPage(p => p-1)} className="px-3 py-1.5 rounded-md text-[12px] font-semibold text-slate-600 bg-white border border-slate-200 hover:bg-slate-100 disabled:opacity-40 transition-colors">‹ Zurück</button>
              <button disabled={page >= pageCount-1} onClick={() => setPage(p => p+1)} className="px-3 py-1.5 rounded-md text-[12px] font-semibold text-slate-600 bg-white border border-slate-200 hover:bg-slate-100 disabled:opacity-40 transition-colors">Weiter ›</button>
            </div>
          </div>
        )}
      </div>

      {/* ══════════════ DETAIL DRAWER ══════════════ */}
      {selectedEntry && (
        <>
          <div className="fixed inset-0 z-40 bg-slate-900/20 backdrop-blur-[2px]" onClick={() => setSelectedEntry(null)} />
          <div className="fixed right-0 top-0 h-full w-[420px] z-50 flex flex-col bg-white shadow-2xl border-l border-slate-200"
            style={{ boxShadow: "-8px 0 40px rgba(0,0,0,.12)" }}>
            {/* Drawer Header */}
            <div className="px-6 py-4 border-b border-slate-200 flex items-start justify-between" style={{ background: "#0D1B3E" }}>
              <div>
                <p className="text-[9px] font-bold uppercase tracking-[.18em] mb-1" style={{ color: "#B8923A" }}>Buchungsdetail</p>
                <p className="text-[15px] font-bold text-white leading-tight">{selectedEntry.reference}</p>
                <p className="text-[11px] mt-0.5" style={{ color: "#7a8ba8" }}>{fmtDate(selectedEntry.booking_date)}</p>
              </div>
              <button onClick={() => setSelectedEntry(null)} className="w-8 h-8 rounded-lg flex items-center justify-center text-white/40 hover:text-white hover:bg-white/10 transition-colors mt-0.5">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>
            </div>

            {/* Amount highlight */}
            <div className={`px-6 py-4 border-b border-slate-100 ${selectedEntry.booking_type === "credit" ? "bg-emerald-50" : "bg-rose-50"}`}>
              <div className="flex items-center justify-between">
                <div>
                  <p className={`text-[10px] font-bold uppercase tracking-wider mb-0.5 ${selectedEntry.booking_type === "credit" ? "text-emerald-600" : "text-rose-600"}`}>
                    {selectedEntry.booking_type === "credit" ? "Haben – Eingang" : "Soll – Ausgang"}
                  </p>
                  <p className={`text-[28px] font-bold tabular-nums leading-none ${selectedEntry.booking_type === "credit" ? "text-emerald-700" : "text-rose-700"}`}>
                    {selectedEntry.booking_type === "credit" ? "+" : "−"} CHF {n2(selectedEntry.amount_cents)}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-0.5">Saldo nach Buchung</p>
                  <p className="text-[16px] font-bold text-slate-800 tabular-nums">CHF {n2(selectedEntry.runningBalance ?? 0)}</p>
                </div>
              </div>
            </div>

            {/* Detail fields */}
            <div className="flex-1 overflow-auto px-6 py-2">
              <DetailRow label="Beschreibung" value={selectedEntry.description} />
              <DetailRow label="Kategorie" value={selectedEntry.category} />
              <DetailRow label="Buchungsdatum" value={fmtDate(selectedEntry.booking_date)} mono />
              <DetailRow label="Wertst.-Datum" value={fmtDate(selectedEntry.value_date)} mono />
              <DetailRow label="Referenz" value={selectedEntry.reference} mono />
              <DetailRow label="Währung" value={selectedEntry.currency} mono />
              <DetailRow label="Gegenkonto" value={selectedEntry.counter_account} />
              <DetailRow label="Notizen" value={selectedEntry.notes} />
              <DetailRow label="Erfasst am" value={fmtDateTime(selectedEntry.created_at)} mono />
              <DetailRow label="Buchungs-ID" value={`#${selectedEntry.id}`} mono />
            </div>

            {/* Drawer Actions */}
            <div className="px-6 py-4 border-t border-slate-100 bg-slate-50">
              <button onClick={() => { setConfirmDelete(selectedEntry); }}
                className="w-full py-2.5 rounded-lg text-[13px] font-bold text-rose-600 bg-white border border-rose-200 hover:bg-rose-50 transition-colors">
                Buchung löschen
              </button>
            </div>
          </div>
        </>
      )}

      {/* ══════════════ ADD MODAL ══════════════ */}
      {showAddModal && <AddEntryModal onClose={() => setShowAddModal(false)} onSave={async (form) => {
        setBusy(true);
        try {
          const r = await api("/api/admin/ledger", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
          const d = await r.json();
          if (d.ok) { setShowAddModal(false); flash("Buchung erfasst"); await load(); } else flash(d.error || "Fehler");
        } finally { setBusy(false); }
      }} busy={busy} />}

      {/* ══════════════ DELETE CONFIRM ══════════════ */}
      {confirmDelete && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100">
              <h3 className="text-[14px] font-bold text-slate-900">Buchung unwiderruflich löschen?</h3>
            </div>
            <div className="px-6 py-4">
              <p className="text-[13px] text-slate-700 font-medium mb-0.5">{confirmDelete.description}</p>
              <p className="text-[13px] font-mono text-slate-500 mb-3">{confirmDelete.reference}</p>
              <div className={`text-[20px] font-bold tabular-nums mb-4 ${confirmDelete.booking_type === "credit" ? "text-emerald-700" : "text-rose-600"}`}>
                {confirmDelete.booking_type === "credit" ? "+" : "−"} CHF {n2(confirmDelete.amount_cents)}
              </div>
              <p className="text-[12px] text-amber-700 bg-amber-50 border border-amber-200 px-3 py-2 rounded-lg">Der laufende Kontostand wird entsprechend korrigiert.</p>
            </div>
            <div className="flex gap-2 px-6 py-4 border-t border-slate-100 bg-slate-50">
              <button onClick={() => setConfirmDelete(null)} className="flex-1 py-2.5 rounded-lg text-[13px] font-bold bg-white border border-slate-200 text-slate-700 hover:bg-slate-100 transition-colors">Abbrechen</button>
              <button onClick={deleteEntry} disabled={busy} className="flex-1 py-2.5 rounded-lg text-[13px] font-bold bg-rose-600 text-white hover:bg-rose-700 transition-colors disabled:opacity-50">{busy ? "…" : "Löschen"}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ══════════════ ADD ENTRY MODAL ══════════════ */
function AddEntryModal({ onClose, onSave, busy }: { onClose: () => void; onSave: (f: any) => void; busy: boolean }) {
  const [f, setF] = useState({ bookingDate: TODAY, valueDate: TODAY, reference: "", description: "", category: "Sonstiges", bookingType: "credit", amountCents: "", counterAccount: "", notes: "" });
  const set = (k: string, v: string) => setF(p => ({ ...p, [k]: v }));
  const genRef = () => { const d = f.bookingDate.replace(/-/g,""); set("reference", `${f.bookingType === "credit" ? "SGC" : "SGD"}-${d}-${Math.random().toString(36).slice(2,6).toUpperCase()}`); };
  const submit = () => { const a = Math.round(parseFloat(f.amountCents || "0") * 100); if (!f.description || !f.category || a <= 0) return; onSave({ ...f, amountCents: a, reference: f.reference || `SG-${Date.now()}` }); };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg max-h-[92vh] overflow-auto" onClick={e => e.stopPropagation()}>
        <div className="sticky top-0 px-6 py-4 border-b border-slate-200 flex items-center justify-between" style={{ background: "#0D1B3E" }}>
          <div>
            <p className="text-[9px] font-bold uppercase tracking-[.18em] mb-0.5" style={{ color: "#B8923A" }}>Schwarzott Group Banking</p>
            <h3 className="text-[14px] font-bold text-white">Neue Buchung erfassen</h3>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-lg flex items-center justify-center text-white/40 hover:text-white hover:bg-white/10 transition-colors">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>
        <div className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Buchungsart *">
              <div className="flex rounded-lg overflow-hidden border border-slate-300">
                {(["credit","debit"] as const).map(t => (
                  <button key={t} type="button" onClick={() => set("bookingType", t)}
                    className={`flex-1 py-2.5 text-[12px] font-bold transition-colors ${f.bookingType === t ? (t === "credit" ? "bg-emerald-700 text-white" : "bg-rose-700 text-white") : "bg-white text-slate-600 hover:bg-slate-50"}`}>
                    {t === "credit" ? "Haben / Eingang" : "Soll / Ausgang"}
                  </button>
                ))}
              </div>
            </Field>
            <Field label="Betrag CHF *">
              <input type="number" step="0.01" min="0" value={f.amountCents} onChange={e => set("amountCents", e.target.value)} className={inputCls} placeholder="0.00" />
            </Field>
          </div>
          <Field label="Buchungstext *">
            <input value={f.description} onChange={e => set("description", e.target.value)} className={inputCls} placeholder="z.B. Managementgebühren Q2 2026 – Müller Family Office" />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Buchungsdatum *">
              <input type="date" value={f.bookingDate} onChange={e => set("bookingDate", e.target.value)} className={inputCls} />
            </Field>
            <Field label="Wertstellungsdatum">
              <input type="date" value={f.valueDate} onChange={e => set("valueDate", e.target.value)} className={inputCls} />
            </Field>
          </div>
          <Field label="Kategorie *">
            <select value={f.category} onChange={e => set("category", e.target.value)} className={inputCls}>
              {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </Field>
          <Field label="Referenz">
            <div className="flex gap-2">
              <input value={f.reference} onChange={e => set("reference", e.target.value)} className={inputCls} placeholder="SGC-20260619-0001" />
              <button type="button" onClick={genRef} className="px-3 py-2 text-[12px] font-bold text-slate-700 bg-slate-100 border border-slate-300 rounded-lg hover:bg-slate-200 whitespace-nowrap">Auto</button>
            </div>
          </Field>
          <Field label="Gegenkonto">
            <input value={f.counterAccount} onChange={e => set("counterAccount", e.target.value)} className={inputCls} placeholder="z.B. Müller Family Office, UBS AG Zürich" />
          </Field>
          <Field label="Interne Notiz">
            <textarea value={f.notes} onChange={e => set("notes", e.target.value)} rows={2} className={inputCls} style={{ resize: "none" }} placeholder="Optionale interne Notiz für die Buchhaltung…" />
          </Field>
          <button disabled={busy || !f.description || !parseFloat(f.amountCents || "0")} onClick={submit}
            className="w-full py-3 text-[13px] font-bold text-white rounded-lg transition-colors disabled:opacity-50"
            style={{ background: "#0D1B3E" }}>
            {busy ? "Wird gespeichert…" : "Buchung erfassen"}
          </button>
        </div>
      </div>
    </div>
  );
}
