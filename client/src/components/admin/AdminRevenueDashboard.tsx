import { useState, useEffect, useMemo, useCallback } from "react";
import { formatCurrency, formatDateTime } from "./AdminApplicationsManager";

const MONTH_NAMES = ['Jan', 'Feb', 'Mär', 'Apr', 'Mai', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez'];
const CHART_H = 180;

// ─── Icons ─────────────────────────────────────────────────────────────────
const IconTrend = () => <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/></svg>;
const IconChurn = () => <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>;
const IconTarget = () => <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/></svg>;
const IconAI = () => <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M12 2a10 10 0 1 0 10 10"/><path d="M12 6v6l4 2"/><circle cx="18" cy="6" r="3" fill="currentColor" stroke="none" opacity=".4"/></svg>;
const IconSync = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg>;
const IconRefresh = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg>;
const IconCheck = () => <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="20 6 9 17 4 12"/></svg>;
const IconX = () => <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>;
const IconBolt = () => <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor" stroke="none"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/></svg>;
const IconEuro = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M4 9a8 8 0 1 1 0 6M4 12h12"/></svg>;

export default function AdminRevenueDashboard() {
  const [data, setData] = useState<any>(null);
  const [ai, setAi] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [aiLoading, setAiLoading] = useState(false);
  const [syncLoading, setSyncLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [syncMsg, setSyncMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);
  const [txFilter, setTxFilter] = useState<'all' | 'succeeded' | 'failed'>('all');
  const [showAllTx, setShowAllTx] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const fetchRevenue = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const res = await fetch('/api/fiaon/admin/stripe/revenue', { credentials: 'include' });
      const json = await res.json();
      if (res.ok && json.ok) { setData(json); setLastUpdated(new Date()); }
      else setError(json.error || `Fehler ${res.status}`);
    } catch (e: any) { setError(e?.message || 'Netzwerkfehler'); }
    finally { setLoading(false); }
  }, []);

  const fetchAI = useCallback(async () => {
    setAiLoading(true);
    try {
      const res = await fetch('/api/fiaon/admin/stripe/ai-insights', { credentials: 'include' });
      const json = await res.json();
      if (res.ok && json.ok) setAi(json);
    } catch { /* silent */ }
    finally { setAiLoading(false); }
  }, []);

  const runSync = async () => {
    setSyncLoading(true); setSyncMsg(null);
    try {
      const res = await fetch('/api/fiaon/admin/stripe/sync', { method: 'POST', credentials: 'include' });
      const json = await res.json();
      if (res.ok && json.ok) {
        setSyncMsg({ type: 'ok', text: `${json.updated} / ${json.total} aktualisiert` });
        fetchRevenue();
      } else setSyncMsg({ type: 'err', text: json.error || 'Unbekannt' });
    } catch (e: any) { setSyncMsg({ type: 'err', text: e?.message }); }
    setSyncLoading(false);
  };

  useEffect(() => { fetchRevenue(); }, [fetchRevenue]);
  useEffect(() => { if (data) fetchAI(); }, [data, fetchAI]);

  const filteredTx = useMemo(() => {
    if (!data?.transactions) return [];
    if (txFilter === 'all') return data.transactions;
    return data.transactions.filter((t: any) => t.status === txFilter);
  }, [data?.transactions, txFilter]);

  // ─── Loading skeleton ─────────────────────────────────────────────────────
  if (loading) return (
    <div className="space-y-4">
      <div className="h-56 rounded-2xl bg-gradient-to-br from-slate-800 to-slate-900 animate-pulse" />
      <div className="grid grid-cols-3 lg:grid-cols-6 gap-3">{[...Array(6)].map((_, i) => <div key={i} className="h-20 rounded-2xl bg-slate-100 animate-pulse" />)}</div>
      <div className="h-64 rounded-2xl bg-slate-50 animate-pulse" />
    </div>
  );

  // ─── Error state ──────────────────────────────────────────────────────────
  if (error) return (
    <div className="bg-rose-50 border border-rose-200 rounded-2xl p-8 text-center">
      <div className="w-12 h-12 rounded-2xl bg-rose-100 flex items-center justify-center mx-auto mb-3"><IconX /></div>
      <p className="text-[14px] font-semibold text-rose-800 mb-1">Stripe-Verbindung fehlgeschlagen</p>
      <p className="text-[12px] text-rose-600 mb-4">{error}</p>
      <button onClick={fetchRevenue} className="px-4 py-2 rounded-xl text-[13px] font-semibold bg-rose-600 text-white hover:bg-rose-700 transition-colors">Erneut versuchen</button>
    </div>
  );

  if (!data) return null;
  const { summary, monthlyRevenue, transactions } = data;
  const maxMonth = Math.max(...(monthlyRevenue.map((m: any) => m.amount) as number[]), 1);
  const daysLeft = Math.ceil((new Date(`${new Date().getFullYear()}-12-31`).getTime() - Date.now()) / 86400000);
  const aiC = ai?.computed;
  const aiI = ai?.aiInsights;
  const sentimentColor = aiI?.sentiment === 'positive' ? 'text-emerald-400' : aiI?.sentiment === 'negative' ? 'text-rose-400' : 'text-amber-400';

  return (
    <div className="space-y-5">

      {/* ── TOP BAR ─────────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-[18px] font-bold text-slate-900">Revenue Intelligence</h2>
          {lastUpdated && <p className="text-[11px] text-slate-400 mt-0.5">Live-Daten von Stripe · zuletzt um {lastUpdated.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}</p>}
        </div>
        <div className="flex items-center gap-2">
          {syncMsg && <span className={`text-[11px] font-semibold px-3 py-1.5 rounded-lg ${syncMsg.type === 'ok' ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'}`}>{syncMsg.text}</span>}
          <button onClick={runSync} disabled={syncLoading} className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-[12px] font-semibold bg-slate-900 text-white hover:bg-slate-700 disabled:opacity-50 transition-all">
            {syncLoading ? <div className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <IconSync />}
            Stripe Sync
          </button>
          <button onClick={() => { fetchRevenue(); fetchAI(); }} disabled={loading} className="p-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 transition-colors text-slate-500">
            <div className={loading ? 'animate-spin' : ''}><IconRefresh /></div>
          </button>
        </div>
      </div>

      {/* ── HERO: Jahresziel ─────────────────────────────────────────────────── */}
      <div className="relative rounded-3xl overflow-hidden text-white" style={{ background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 50%, #0f172a 100%)' }}>
        <div className="absolute inset-0 pointer-events-none" style={{ background: 'radial-gradient(ellipse at 20% 50%, rgba(16,185,129,.12) 0%, transparent 60%), radial-gradient(ellipse at 80% 20%, rgba(99,102,241,.1) 0%, transparent 50%)' }} />
        <div className="relative p-7">
          <div className="flex flex-col lg:flex-row lg:items-center gap-6">
            {/* Left: Big number */}
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-3">
                <span className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-emerald-400 bg-emerald-400/10 px-2.5 py-1 rounded-full border border-emerald-400/20">
                  <IconTarget />Jahresziel {new Date().getFullYear()}
                </span>
              </div>
              <p className="text-5xl font-black tabular-nums tracking-tight leading-none">{formatCurrency(summary.totalRevenue)}</p>
              <p className="text-[14px] text-slate-400 mt-2">von <span className="text-white font-bold">{formatCurrency(summary.annualTarget)}</span> Ziel · <span className={summary.progressPercent >= 50 ? 'text-emerald-400 font-bold' : 'text-amber-400 font-bold'}>{summary.progressPercent}% erreicht</span></p>

              {/* Progress bar with milestone marks */}
              <div className="mt-5 relative">
                <div className="h-2.5 bg-white/10 rounded-full overflow-hidden">
                  <div className="h-full rounded-full transition-all duration-1000" style={{ width: `${summary.progressPercent}%`, background: summary.progressPercent >= 75 ? 'linear-gradient(90deg, #10b981, #34d399)' : summary.progressPercent >= 40 ? 'linear-gradient(90deg, #f59e0b, #fbbf24)' : 'linear-gradient(90deg, #6366f1, #8b5cf6)' }} />
                </div>
                {[25, 50, 75].map(mark => (
                  <div key={mark} className="absolute top-1/2 -translate-y-1/2 w-px h-4 bg-white/20" style={{ left: `${mark}%` }} />
                ))}
                <div className="flex justify-between mt-1.5 text-[9px] text-slate-500 font-semibold">
                  <span>€0</span><span>€25k</span><span>€50k</span><span>€75k</span><span>€100k</span>
                </div>
              </div>
              <p className="text-[12px] text-slate-400 mt-3">Noch <span className="text-white font-semibold">{formatCurrency(Math.max(0, summary.annualTarget - summary.totalRevenue))}</span> bis Jahresziel · {daysLeft} Tage verbleibend</p>
            </div>

            {/* Right: KPI strip */}
            <div className="grid grid-cols-2 lg:grid-cols-1 gap-2.5 lg:w-52 shrink-0">
              {[
                { label: 'MRR', value: formatCurrency(summary.mrr), icon: <IconEuro />, color: 'emerald' },
                { label: 'ARR', value: formatCurrency(summary.arr), icon: <IconTrend />, color: 'indigo' },
                { label: 'Aktive Abos', value: `${summary.activeSubs}x`, icon: <IconCheck />, color: summary.pastDueSubs > 0 ? 'amber' : 'emerald' },
                { label: 'Churn-Risiko', value: `${summary.pastDueSubs} überfällig`, icon: <IconChurn />, color: summary.pastDueSubs > 0 ? 'rose' : 'emerald' },
              ].map(k => (
                <div key={k.label} className={`rounded-xl px-3.5 py-2.5 border ${k.color === 'rose' ? 'bg-rose-500/10 border-rose-500/20' : k.color === 'amber' ? 'bg-amber-500/10 border-amber-500/20' : k.color === 'indigo' ? 'bg-indigo-500/10 border-indigo-500/20' : 'bg-emerald-500/10 border-emerald-500/20'}`}>
                  <div className={`flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider mb-1 ${k.color === 'rose' ? 'text-rose-400' : k.color === 'amber' ? 'text-amber-400' : k.color === 'indigo' ? 'text-indigo-400' : 'text-emerald-400'}`}>
                    {k.icon}{k.label}
                  </div>
                  <p className="text-[17px] font-bold text-white tabular-nums">{k.value}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ── KPI GRID ─────────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-3 lg:grid-cols-6 gap-3">
        {[
          { label: 'Brutto-Umsatz', value: formatCurrency(summary.totalRevenue), sub: 'alle Zahlungen', accent: 'border-l-emerald-500' },
          { label: 'Netto', value: formatCurrency(summary.netRevenue), sub: 'nach Erstattungen', accent: 'border-l-blue-500' },
          { label: 'Erstattungen', value: formatCurrency(summary.totalRefunded), sub: `${((summary.totalRefunded / (summary.totalRevenue || 1)) * 100).toFixed(1)}% Refund-Rate`, accent: 'border-l-amber-500' },
          { label: 'Transaktionen', value: String(summary.successfulCharges), sub: `${summary.totalCharges} gesamt`, accent: 'border-l-violet-500' },
          { label: 'Fehlgeschlagen', value: String(summary.failedCharges), sub: `${((summary.failedCharges / (summary.totalCharges || 1)) * 100).toFixed(1)}% Rate`, accent: summary.failedCharges > 0 ? 'border-l-rose-500' : 'border-l-slate-200' },
          { label: 'Abos gesamt', value: String(summary.totalSubs), sub: `${summary.canceledSubs} gekündigt`, accent: 'border-l-slate-400' },
        ].map(k => (
          <div key={k.label} className={`bg-white rounded-2xl border border-slate-100 border-l-4 ${k.accent} p-4 shadow-sm`}>
            <p className="text-[9px] font-bold uppercase tracking-widest text-slate-400 mb-1">{k.label}</p>
            <p className="text-[18px] font-black tabular-nums text-slate-900 leading-tight">{k.value}</p>
            <p className="text-[10px] text-slate-400 mt-0.5">{k.sub}</p>
          </div>
        ))}
      </div>

      {/* ── MAIN GRID: Chart + AI ─────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 xl:grid-cols-5 gap-5">

        {/* Monthly Revenue Chart */}
        <div className="xl:col-span-3 bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
            <div>
              <h3 className="text-[14px] font-bold text-slate-900">Monatsumsatz</h3>
              <p className="text-[11px] text-slate-400 mt-0.5">{monthlyRevenue.length} Monate mit Umsatz</p>
            </div>
            {aiC && (
              <div className="flex items-center gap-1.5 text-[11px] font-semibold">
                <span className={`flex items-center gap-1 px-2 py-1 rounded-lg ${aiC.growthRate >= 0 ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'}`}>
                  <IconTrend />{aiC.growthRate >= 0 ? '+' : ''}{aiC.growthRate}%
                </span>
              </div>
            )}
          </div>
          <div className="px-6 pt-6 pb-4">
            {monthlyRevenue.length === 0 ? (
              <div className="flex items-center justify-center h-44 text-slate-400 text-[13px]">Noch keine Umsatzdaten</div>
            ) : (
              <div className="space-y-2">
                {/* Y-axis labels + bars */}
                <div className="flex items-end gap-[5px]" style={{ height: `${CHART_H}px` }}>
                  {monthlyRevenue.map((m: any, i: number) => {
                    const barH = Math.max(6, Math.round((m.amount / maxMonth) * (CHART_H - 28)));
                    const [yr, mo] = m.month.split('-');
                    const isCurrentMonth = m.month === `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`;
                    return (
                      <div key={m.month} className="flex-1 flex flex-col items-center justify-end gap-1 group relative" style={{ height: `${CHART_H}px` }}>
                        {/* Tooltip */}
                        <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10 bg-slate-900 text-white text-[10px] font-bold px-2 py-1 rounded-lg whitespace-nowrap shadow-lg">
                          {MONTH_NAMES[parseInt(mo) - 1]} {yr}: {formatCurrency(m.amount)}
                        </div>
                        {/* Bar */}
                        <div
                          className={`w-full rounded-t-lg transition-all duration-500 group-hover:brightness-110 ${isCurrentMonth ? 'bg-emerald-500' : 'bg-slate-200 group-hover:bg-emerald-400'}`}
                          style={{ height: `${barH}px` }}
                        />
                        <p className="text-[9px] text-slate-400 font-semibold shrink-0">{MONTH_NAMES[parseInt(mo) - 1]}</p>
                      </div>
                    );
                  })}
                  {/* Projection bar */}
                  {aiC && aiC.avgMonthly > 0 && (
                    <div className="flex-1 flex flex-col items-center justify-end gap-1" style={{ height: `${CHART_H}px` }}>
                      <div className="w-full rounded-t-lg border-2 border-dashed border-indigo-300 opacity-60" style={{ height: `${Math.max(6, Math.round((aiC.avgMonthly / maxMonth) * (CHART_H - 28)))}px`, background: 'rgba(99,102,241,0.1)' }} />
                      <p className="text-[9px] text-indigo-400 font-bold shrink-0">Prog.</p>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
          {/* Projection line info */}
          {aiC && (
            <div className="px-6 py-3 border-t border-slate-50 bg-slate-50/50 flex items-center justify-between">
              <div className="flex items-center gap-2 text-[11px] text-slate-500">
                <div className="w-4 h-0.5 border-t-2 border-dashed border-indigo-400" />
                Lineare Prognose Jahresende
              </div>
              <p className="text-[12px] font-bold text-indigo-700">{formatCurrency(aiC.projectedYearEnd)}</p>
            </div>
          )}
        </div>

        {/* AI Intelligence Panel */}
        <div className="xl:col-span-2 rounded-2xl overflow-hidden" style={{ background: 'linear-gradient(135deg, #0f172a, #1e293b)' }}>
          <div className="px-5 py-4 border-b border-white/5 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-lg bg-violet-500/20 flex items-center justify-center text-violet-400"><IconAI /></div>
              <span className="text-[13px] font-bold text-white">KI-Analyse</span>
            </div>
            {aiLoading && <div className="w-3.5 h-3.5 border-2 border-violet-400/30 border-t-violet-400 rounded-full animate-spin" />}
            {!aiLoading && <button onClick={fetchAI} className="text-[10px] font-semibold text-slate-500 hover:text-slate-300 transition-colors">Aktualisieren</button>}
          </div>

          {aiLoading && !aiI ? (
            <div className="px-5 py-8 space-y-3">
              {[...Array(4)].map((_, i) => <div key={i} className="h-3 rounded-full bg-white/10 animate-pulse" style={{ width: `${85 - i * 10}%` }} />)}
            </div>
          ) : aiI ? (
            <div className="px-5 py-4 space-y-4">
              {/* Headline */}
              <div className={`text-[12px] font-semibold leading-relaxed ${sentimentColor}`}>{aiI.headline}</div>

              {/* Forecast */}
              <div className="space-y-1">
                <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-500"><IconTarget />Prognose</div>
                <p className="text-[11px] text-slate-300 leading-relaxed">{aiI.forecast}</p>
              </div>

              {/* Churn */}
              <div className="space-y-1">
                <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-rose-400"><IconChurn />Churn-Risiko</div>
                <p className="text-[11px] text-slate-300 leading-relaxed">{aiI.churn}</p>
                {aiC && aiC.churnRisk > 0 && (
                  <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-rose-500/10 border border-rose-500/20 mt-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-rose-400 animate-pulse" />
                    <span className="text-[11px] font-bold text-rose-400">{aiC.churnRisk} Abos überfällig</span>
                  </div>
                )}
              </div>

              {/* Growth */}
              <div className="space-y-1">
                <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-emerald-400"><IconTrend />Wachstum</div>
                <p className="text-[11px] text-slate-300 leading-relaxed">{aiI.growth}</p>
              </div>

              {/* Actions */}
              {aiI.actions && aiI.actions.length > 0 && (
                <div className="space-y-1.5 pt-1">
                  <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-amber-400"><IconBolt />Handlungsempfehlungen</div>
                  {aiI.actions.map((a: string, i: number) => (
                    <div key={i} className="flex gap-2 text-[11px] text-slate-300 leading-relaxed">
                      <span className="text-amber-400 font-bold shrink-0">{i + 1}.</span>
                      <span>{a}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div className="px-5 py-8 text-center">
              {/* Computed fallback when AI is unavailable */}
              {aiC ? (
                <div className="space-y-3 text-left">
                  <StatRow label="Ø Monatsumsatz" value={formatCurrency(aiC.avgMonthly)} />
                  <StatRow label="Prognose Jahresende" value={formatCurrency(aiC.projectedYearEnd)} highlight={aiC.projectedYearEnd >= 100000} />
                  <StatRow label="Benötigt/Monat für Ziel" value={formatCurrency(aiC.neededPerMonth)} />
                  <StatRow label="Wachstumsrate" value={`${aiC.growthRate >= 0 ? '+' : ''}${aiC.growthRate}%`} highlight={aiC.growthRate > 0} />
                  {aiC.churnRisk > 0 && <StatRow label="Churn-Risiko" value={`${aiC.churnRisk} Abos`} danger />}
                </div>
              ) : (
                <p className="text-[12px] text-slate-500">KI nicht verfügbar</p>
              )}
            </div>
          )}

          {/* Computed quick stats bottom strip */}
          {aiC && (
            <div className="mx-4 mb-4 grid grid-cols-3 gap-2 pt-3 border-t border-white/5">
              <MiniStat label="Benötigt/Monat" value={formatCurrency(aiC.neededPerMonth)} />
              <MiniStat label="Prognose" value={formatCurrency(aiC.projectedYearEnd)} highlight />
              <MiniStat label="Wachstum" value={`${aiC.growthRate >= 0 ? '+' : ''}${aiC.growthRate}%`} positive={aiC.growthRate > 0} />
            </div>
          )}
        </div>
      </div>

      {/* ── SUBSCRIPTION HEALTH ──────────────────────────────────────────────── */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100">
          <h3 className="text-[14px] font-bold text-slate-900">Abo-Gesundheit</h3>
          <p className="text-[11px] text-slate-400 mt-0.5">{summary.totalSubs} Abonnements insgesamt</p>
        </div>
        <div className="px-6 py-5 grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { label: 'Aktiv', count: summary.activeSubs, of: summary.totalSubs, color: '#10b981' },
            { label: 'Überfällig', count: summary.pastDueSubs, of: summary.totalSubs, color: '#f59e0b' },
            { label: 'Gekündigt', count: summary.canceledSubs, of: summary.totalSubs, color: '#ef4444' },
            { label: 'Erfolgsrate', count: summary.successfulCharges, of: summary.totalCharges, label2: 'Transaktionen', color: '#6366f1' },
          ].map(s => {
            const pct = s.of > 0 ? Math.round((s.count / s.of) * 100) : 0;
            return (
              <div key={s.label} className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-semibold text-slate-600">{s.label}</span>
                  <span className="text-[11px] font-bold tabular-nums" style={{ color: s.color }}>{s.count}</span>
                </div>
                <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                  <div className="h-full rounded-full transition-all duration-700" style={{ width: `${pct}%`, background: s.color }} />
                </div>
                <p className="text-[10px] text-slate-400">{pct}% {s.label2 || 'aller Abos'}</p>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── TRANSACTIONS ─────────────────────────────────────────────────────── */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
          <div>
            <h3 className="text-[14px] font-bold text-slate-900">Transaktionen</h3>
            <p className="text-[11px] text-slate-400 mt-0.5">{filteredTx.length} Einträge</p>
          </div>
          <div className="flex items-center gap-2">
            {(['all', 'succeeded', 'failed'] as const).map(f => (
              <button key={f} onClick={() => setTxFilter(f)} className={`px-3 py-1.5 rounded-lg text-[11px] font-semibold transition-colors ${txFilter === f ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>
                {f === 'all' ? `Alle (${transactions?.length || 0})` : f === 'succeeded' ? `Bezahlt (${transactions?.filter((t: any) => t.status === 'succeeded').length || 0})` : `Fehler (${transactions?.filter((t: any) => t.status === 'failed').length || 0})`}
              </button>
            ))}
          </div>
        </div>
        <div className="divide-y divide-slate-50">
          {(showAllTx ? filteredTx : filteredTx.slice(0, 25)).map((tx: any) => (
            <div key={tx.id} className={`flex items-center justify-between px-6 py-3 hover:bg-slate-50/70 transition-colors ${tx.status === 'failed' ? 'bg-rose-50/20' : ''}`}>
              <div className="flex items-center gap-3 min-w-0">
                <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${tx.status === 'succeeded' ? 'bg-emerald-100 text-emerald-600' : 'bg-rose-100 text-rose-600'}`}>
                  {tx.status === 'succeeded' ? <IconCheck /> : <IconX />}
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-[13px] font-bold text-slate-800 tabular-nums">{formatCurrency(tx.amount)}</p>
                    {tx.matchedName && <span className="text-[12px] text-slate-600">{tx.matchedName}</span>}
                    {tx.matchedPackage && <span className="text-[10px] bg-indigo-50 text-indigo-700 border border-indigo-100 px-2 py-0.5 rounded-full font-semibold">{tx.matchedPackage}</span>}
                    {tx.refunded && <span className="text-[10px] bg-amber-50 text-amber-700 px-2 py-0.5 rounded-full font-semibold border border-amber-100">Erstattet</span>}
                  </div>
                  <div className="flex items-center gap-3 mt-0.5">
                    <span className="text-[11px] text-slate-400">{formatDateTime(tx.created)}</span>
                    {tx.customerEmail && <span className="text-[11px] text-slate-400 truncate max-w-[180px]">{tx.customerEmail}</span>}
                    {tx.paymentMethod && <span className="text-[10px] bg-slate-100 px-1.5 py-0.5 rounded text-slate-500 uppercase">{tx.paymentMethod}</span>}
                    {tx.failureMessage && <span className="text-[11px] text-rose-600 font-medium">· {tx.failureMessage}</span>}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2.5 shrink-0 ml-4">
                {tx.matchedRef && <span className="text-[10px] font-mono text-slate-300 hidden lg:block">{tx.matchedRef}</span>}
                <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold ${tx.status === 'succeeded' ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' : 'bg-rose-50 text-rose-700 border border-rose-100'}`}>
                  {tx.status === 'succeeded' ? '✓ Bezahlt' : '✗ Fehlgeschlagen'}
                </span>
                {tx.receiptUrl && <a href={tx.receiptUrl} target="_blank" rel="noopener noreferrer" className="text-[11px] font-semibold text-blue-500 hover:text-blue-700 transition-colors">Beleg ↗</a>}
              </div>
            </div>
          ))}
        </div>
        {filteredTx.length > 25 && !showAllTx && (
          <div className="px-6 py-4 border-t border-slate-100 flex items-center justify-center">
            <button onClick={() => setShowAllTx(true)} className="px-5 py-2.5 rounded-xl text-[13px] font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 transition-colors">
              Alle {filteredTx.length} Transaktionen anzeigen
            </button>
          </div>
        )}
        {filteredTx.length === 0 && (
          <div className="py-12 text-center text-[13px] text-slate-400">Keine Transaktionen in diesem Filter</div>
        )}
      </div>
    </div>
  );
}

// ─── Helper components ────────────────────────────────────────────────────────

function StatRow({ label, value, highlight, danger }: { label: string; value: string; highlight?: boolean; danger?: boolean }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-[11px] text-slate-500">{label}</span>
      <span className={`text-[12px] font-bold tabular-nums ${danger ? 'text-rose-400' : highlight ? 'text-emerald-400' : 'text-white'}`}>{value}</span>
    </div>
  );
}

function MiniStat({ label, value, highlight, positive }: { label: string; value: string; highlight?: boolean; positive?: boolean }) {
  return (
    <div className="text-center">
      <p className="text-[9px] font-bold uppercase tracking-wider text-slate-500 mb-0.5">{label}</p>
      <p className={`text-[12px] font-bold tabular-nums ${highlight ? 'text-indigo-400' : positive !== undefined ? (positive ? 'text-emerald-400' : 'text-rose-400') : 'text-slate-400'}`}>{value}</p>
    </div>
  );
}
