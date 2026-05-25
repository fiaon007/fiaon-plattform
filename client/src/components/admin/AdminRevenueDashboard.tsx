import { useState, useEffect, useMemo } from "react";
import { formatCurrency, formatDateTime } from "./AdminApplicationsManager";

export default function AdminRevenueDashboard() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [syncLoading, setSyncLoading] = useState(false);
  const [syncResult, setSyncResult] = useState<string | null>(null);
  const [txFilter, setTxFilter] = useState<'all' | 'succeeded' | 'failed'>('all');
  const [showAllTx, setShowAllTx] = useState(false);

  const fetchRevenue = async () => {
    setLoading(true); setError(null);
    try {
      const res = await fetch('/api/fiaon/admin/stripe/revenue', { credentials: 'include' });
      const json = await res.json();
      if (res.ok && json.ok) { setData(json); }
      else { setError(json.error || `Fehler (${res.status})`); }
    } catch (err: any) { setError(err?.message || 'Netzwerkfehler'); }
    finally { setLoading(false); }
  };

  const runSync = async () => {
    setSyncLoading(true); setSyncResult(null);
    try {
      const res = await fetch('/api/fiaon/admin/stripe/sync', { method: 'POST', credentials: 'include' });
      const json = await res.json();
      if (res.ok && json.ok) {
        setSyncResult(`Sync erfolgreich: ${json.updated} aktualisiert von ${json.total} Kunden`);
        fetchRevenue();
      } else { setSyncResult(`Fehler: ${json.error || 'Unbekannt'}`); }
    } catch (err: any) { setSyncResult(`Fehler: ${err?.message}`); }
    setSyncLoading(false);
  };

  useEffect(() => { fetchRevenue(); }, []);

  const filteredTx = useMemo(() => {
    if (!data?.transactions) return [];
    if (txFilter === 'all') return data.transactions;
    return data.transactions.filter((t: any) => t.status === txFilter);
  }, [data?.transactions, txFilter]);

  const visibleTx = showAllTx ? filteredTx : filteredTx.slice(0, 20);

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="h-48 rounded-2xl bg-slate-50 animate-pulse" />
        <div className="grid grid-cols-4 gap-3">{[...Array(4)].map((_, i) => <div key={i} className="h-24 rounded-2xl bg-slate-50 animate-pulse" />)}</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-rose-50 border border-rose-200 rounded-2xl p-6 text-center">
        <p className="text-[14px] font-semibold text-rose-800">{error}</p>
        <button onClick={fetchRevenue} className="mt-3 px-4 py-2 rounded-xl text-[13px] font-semibold bg-rose-600 text-white hover:bg-rose-700">Erneut versuchen</button>
      </div>
    );
  }

  if (!data) return null;
  const { summary, monthlyRevenue, transactions } = data;

  return (
    <div className="space-y-5">
      {/* Annual Target Progress */}
      <div className="bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 rounded-2xl p-6 text-white overflow-hidden relative">
        <div className="absolute inset-0 opacity-10" style={{ background: 'radial-gradient(circle at 80% 20%, #3b82f6, transparent 50%)' }} />
        <div className="relative">
          <div className="flex items-start justify-between mb-4">
            <div>
              <p className="text-[11px] uppercase tracking-widest text-slate-400 font-bold">Jahresziel 2026</p>
              <p className="text-3xl font-bold mt-1 tabular-nums">{formatCurrency(summary.totalRevenue)}<span className="text-lg text-slate-400 ml-2">/ {formatCurrency(summary.annualTarget)}</span></p>
            </div>
            <div className="text-right">
              <p className="text-4xl font-bold text-emerald-400 tabular-nums">{summary.progressPercent}%</p>
              <p className="text-[11px] text-slate-400 mt-0.5">erreicht</p>
            </div>
          </div>
          <div className="h-3 bg-slate-700 rounded-full overflow-hidden">
            <div className="h-full bg-gradient-to-r from-emerald-500 to-emerald-400 rounded-full transition-all duration-1000" style={{ width: `${summary.progressPercent}%` }} />
          </div>
          <div className="flex items-center justify-between mt-3 text-[11px] text-slate-400">
            <span>Brutto-Umsatz (Stripe)</span>
            <span>Noch {formatCurrency(summary.annualTarget - summary.totalRevenue)} bis Ziel</span>
          </div>
        </div>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-2 lg:grid-cols-4 xl:grid-cols-6 gap-3">
        <MetricCard label="Brutto-Umsatz" value={formatCurrency(summary.totalRevenue)} color="emerald" />
        <MetricCard label="Netto (nach Erstattung)" value={formatCurrency(summary.netRevenue)} color="blue" />
        <MetricCard label="MRR" value={formatCurrency(summary.mrr)} color="violet" sub="Monthly Recurring" />
        <MetricCard label="ARR" value={formatCurrency(summary.arr)} color="violet" sub="Annual Recurring" />
        <MetricCard label="Aktive Abos" value={String(summary.activeSubs)} color="emerald" sub={`${summary.canceledSubs} gekündigt`} />
        <MetricCard label="Fehlgeschlagen" value={String(summary.failedCharges)} color={summary.failedCharges > 0 ? "rose" : "slate"} sub={`von ${summary.totalCharges} Charges`} />
      </div>

      {/* Monthly Revenue Chart */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
          <div>
            <h3 className="text-[14px] font-bold text-slate-900">Monatlicher Umsatz</h3>
            <p className="text-[12px] text-slate-500 mt-0.5">{monthlyRevenue.length} Monate mit Umsatz</p>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={runSync} disabled={syncLoading} className="px-3.5 py-2 rounded-xl text-[12px] font-semibold bg-slate-900 text-white hover:bg-slate-700 disabled:opacity-50 transition-colors flex items-center gap-1.5">
              {syncLoading && <div className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
              Stripe Sync
            </button>
            <button onClick={fetchRevenue} disabled={loading} className="p-2 rounded-xl hover:bg-slate-100 transition-colors">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className={loading ? 'animate-spin' : ''}><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg>
            </button>
          </div>
        </div>
        {syncResult && (
          <div className={`mx-5 mt-3 px-4 py-2.5 rounded-xl text-[12px] font-semibold ${syncResult.startsWith('Fehler') ? 'bg-rose-50 text-rose-700' : 'bg-emerald-50 text-emerald-700'}`}>{syncResult}</div>
        )}
        <div className="px-6 py-5">
          {monthlyRevenue.length === 0 ? (
            <p className="text-center text-[13px] text-slate-400 py-8">Noch keine Umsatzdaten</p>
          ) : (
            <div className="flex items-end gap-1.5 h-40">
              {monthlyRevenue.map((m: any) => {
                const maxAmount = Math.max(...monthlyRevenue.map((x: any) => x.amount));
                const height = maxAmount > 0 ? Math.max(8, (m.amount / maxAmount) * 100) : 8;
                const [year, month] = m.month.split('-');
                const monthNames = ['Jan', 'Feb', 'Mär', 'Apr', 'Mai', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez'];
                return (
                  <div key={m.month} className="flex-1 flex flex-col items-center gap-1 group" title={`${monthNames[parseInt(month) - 1]} ${year}: ${formatCurrency(m.amount)}`}>
                    <p className="text-[10px] font-bold text-slate-600 opacity-0 group-hover:opacity-100 transition-opacity tabular-nums">{formatCurrency(m.amount)}</p>
                    <div className="w-full rounded-t-lg bg-emerald-500 transition-all group-hover:bg-emerald-600" style={{ height: `${height}%` }} />
                    <p className="text-[9px] text-slate-400 font-semibold">{monthNames[parseInt(month) - 1]}</p>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Transactions */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
          <div>
            <h3 className="text-[14px] font-bold text-slate-900">Alle Transaktionen</h3>
            <p className="text-[12px] text-slate-500 mt-0.5">{filteredTx.length} Einträge</p>
          </div>
          <div className="flex items-center gap-2">
            <select value={txFilter} onChange={e => setTxFilter(e.target.value as any)} className="px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-[12px] font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-100">
              <option value="all">Alle ({transactions?.length || 0})</option>
              <option value="succeeded">Erfolgreich ({transactions?.filter((t: any) => t.status === 'succeeded').length || 0})</option>
              <option value="failed">Fehlgeschlagen ({transactions?.filter((t: any) => t.status === 'failed').length || 0})</option>
            </select>
          </div>
        </div>
        <div className="divide-y divide-slate-50">
          {visibleTx.map((tx: any) => (
            <div key={tx.id} className={`flex items-center justify-between px-6 py-3 ${tx.status === 'failed' ? 'bg-rose-50/30' : ''}`}>
              <div className="flex items-center gap-3 min-w-0">
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${tx.status === 'succeeded' ? 'bg-emerald-100 text-emerald-600' : tx.status === 'failed' ? 'bg-rose-100 text-rose-600' : 'bg-slate-100 text-slate-500'}`}>
                  {tx.status === 'succeeded' ? <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="20 6 9 17 4 12"/></svg> : <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>}
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-[13px] font-semibold text-slate-800">{formatCurrency(tx.amount)}</p>
                    {tx.matchedName && <span className="text-[11px] text-slate-500">{tx.matchedName}</span>}
                    {tx.matchedPackage && <span className="text-[10px] bg-blue-50 text-blue-700 px-1.5 py-0.5 rounded font-medium">{tx.matchedPackage}</span>}
                  </div>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-[11px] text-slate-400">{formatDateTime(tx.created)}</span>
                    {tx.customerEmail && <span className="text-[11px] text-slate-400">{tx.customerEmail}</span>}
                    {tx.failureMessage && <span className="text-[10px] text-rose-600 font-medium">{tx.failureMessage}</span>}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {tx.matchedRef && <span className="text-[10px] font-mono text-slate-400">{tx.matchedRef}</span>}
                <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${tx.status === 'succeeded' ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'}`}>
                  {tx.status === 'succeeded' ? 'Bezahlt' : 'Fehlgeschlagen'}
                </span>
                {tx.receiptUrl && <a href={tx.receiptUrl} target="_blank" rel="noopener noreferrer" className="text-[11px] text-blue-600 hover:underline">Beleg</a>}
              </div>
            </div>
          ))}
        </div>
        {filteredTx.length > 20 && !showAllTx && (
          <div className="px-6 py-4 border-t border-slate-100 text-center">
            <button onClick={() => setShowAllTx(true)} className="px-4 py-2 rounded-xl text-[13px] font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 transition-colors">Alle {filteredTx.length} anzeigen</button>
          </div>
        )}
      </div>
    </div>
  );
}

function MetricCard({ label, value, color, sub }: { label: string; value: string; color: string; sub?: string }) {
  const colorMap: Record<string, string> = {
    emerald: 'bg-emerald-50 border-emerald-200 text-emerald-800',
    blue: 'bg-blue-50 border-blue-200 text-blue-800',
    violet: 'bg-violet-50 border-violet-200 text-violet-800',
    rose: 'bg-rose-50 border-rose-200 text-rose-800',
    slate: 'bg-slate-50 border-slate-200 text-slate-800',
  };
  return (
    <div className={`rounded-2xl border p-4 ${colorMap[color] || colorMap.slate}`}>
      <p className="text-[10px] font-bold uppercase tracking-wider opacity-60">{label}</p>
      <p className="text-lg font-bold mt-1 tabular-nums">{value}</p>
      {sub && <p className="text-[10px] opacity-50 mt-0.5">{sub}</p>}
    </div>
  );
}
