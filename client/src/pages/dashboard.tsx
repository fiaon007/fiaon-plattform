import React, { useState, useEffect, useMemo, useCallback, Component, type ReactNode, type ErrorInfo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useLocation } from 'wouter';
import { useAuth } from '@/hooks/useAuth';
import { useDashboardOverview } from '@/lib/dashboard/use-dashboard-overview';
import { formatDistanceToNow } from 'date-fns';
import { de } from 'date-fns/locale';
import type { ActivityItem, RecentCall, ActionItem } from '@/lib/dashboard/overview.schema';

/* ═══ COPY ═══ */
const COPY = {
  pageTitle: 'Dashboard',
  pageSub: 'Deine Aktivitäten, nächste Schritte — und was ARAS im Hintergrund macht.',
  greeting: (n: string) => `Willkommen zurück, ${n}`,
  systemLive: 'SYSTEM: LIVE', systemHint: 'Alle ARAS Dienste sind aktiv.',
  syncOk: 'SYNC: OK', syncHint: 'Deine Daten sind synchronisiert.',
  kpiCalls: 'Anrufe', kpiCampaigns: 'Kampagnen', kpiContacts: 'Kontakte', kpiFollowups: 'Follow-ups',
  actionsTitle: 'Nächste Schritte', actionsSub: 'Empfohlene Aktionen basierend auf deiner Nutzung.',
  activityTitle: 'Letzte Aktivitäten',
  activityEmpty: 'Noch keine Aktivitäten — starte deinen ersten Call, dann siehst du hier alles live.',
  systemTitle: 'Systemstatus', planTitle: 'Dein Plan & Limits',
  followupsTitle: 'Follow-up Queue',
  followupsEmpty: 'Keine offenen Follow-ups. Starte Calls, um Empfehlungen zu erhalten.',
  briefingTitle: 'KI-Briefing',
  briefingEmpty: 'Noch kein Briefing verfügbar. Führe Calls durch für ein tägliches Briefing.',
  callsTitle: 'Letzte Anrufe',
  callsEmpty: 'Noch keine Anrufe — starte deinen ersten Call mit ARAS Voice.',
  btnPower: 'Power Call starten', btnPowerH: 'Einzelanruf — ARAS ruft sofort an.',
  btnCamp: 'Kampagne öffnen', btnCampH: 'Öffnet das Campaign Studio.',
  btnKB: 'Wissensdatenbank', btnKBH: 'Deine Wissensquellen verwalten.',
  errorTitle: 'Daten konnten nicht geladen werden', errorSub: 'Bitte versuche es erneut.', errorReload: 'Neu laden',
};

/* ═══ ARAS CI TOKENS ═══ */
const C = {
  gold: '#e9d7c4', goldDark: '#a34e00', orange: '#FE9100', bgDark: '#0a0a0e',
  glass: 'rgba(255,255,255,0.020)', stroke: 'rgba(233,215,196,0.10)',
  text1: 'rgba(255,255,255,0.92)', text2: 'rgba(255,255,255,0.62)', text3: 'rgba(255,255,255,0.38)',
};
const EASE: [number, number, number, number] = [0.16, 1, 0.3, 1];
const orb: React.CSSProperties = { fontFamily: "'Orbitron', sans-serif", fontWeight: 800, letterSpacing: '0.02em' };
const CARD = 'relative rounded-[26px] border backdrop-blur-2xl overflow-hidden';
const CStyle: React.CSSProperties = { borderColor: C.stroke, background: C.glass };
const CHOV = 'transition-all duration-200 hover:border-[rgba(254,145,0,0.22)]';

/* ═══ ERROR BOUNDARY ═══ */
class EB extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null };
  static getDerivedStateFromError(e: Error) { return { error: e }; }
  componentDidCatch(e: Error, info: ErrorInfo) { console.error('[Dashboard EB]', e, info); }
  render() {
    if (this.state.error) return (
      <div className="flex-1 min-h-0 flex items-center justify-center" style={{ background: C.bgDark }}>
        <div className="text-center p-8 max-w-sm">
          <div className="text-[18px] mb-3" style={{ ...orb, color: C.gold }}>{COPY.errorTitle}</div>
          <p className="text-[13px] mb-5" style={{ color: C.text2 }}>{this.state.error.message}</p>
          <button onClick={() => { this.setState({ error: null }); window.location.reload(); }}
            className="px-5 py-2.5 rounded-full text-[12px] font-semibold tracking-[0.08em] uppercase"
            style={{ border: `1px solid ${C.orange}40`, color: C.orange, background: `${C.orange}10` }}>{COPY.errorReload}</button>
        </div>
      </div>
    );
    return this.props.children;
  }
}

/* ═══ HELPERS ═══ */
function fmtA(ts: string | Date) { try { return formatDistanceToNow(new Date(ts), { addSuffix: true, locale: de }); } catch { return '—'; } }

/* ═══ SECTION CARD ═══ */
function SC({ title, children, sub, right }: { title: string; children: ReactNode; sub?: string; right?: ReactNode }) {
  return (
    <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35, ease: EASE }}
      className={`${CARD} ${CHOV}`} style={CStyle}>
      <div className="p-5 sm:p-6">
        <div className="flex items-start justify-between mb-4">
          <div><div className="text-[14px] font-bold tracking-wide" style={{ ...orb, color: C.gold }}>{title}</div>
            {sub && <p className="text-[12px] mt-1" style={{ color: C.text3 }}>{sub}</p>}</div>
          {right}
        </div>
        {children}
      </div>
    </motion.div>
  );
}

/* ═══ CHIP ═══ */
function Chip({ label, hint, live, warn }: { label: string; hint: string; live?: boolean; warn?: boolean }) {
  const [h, sH] = useState(false);
  return (
    <div className="relative" onMouseEnter={() => sH(true)} onMouseLeave={() => sH(false)}>
      <div className="flex items-center gap-2 px-3 py-1.5 rounded-full text-[10px] font-semibold tracking-[0.14em] uppercase select-none cursor-default"
        style={{ border: `1px solid ${warn ? 'rgba(245,158,11,0.25)' : C.stroke}`, background: C.glass, color: warn ? '#f59e0b' : C.gold }}>
        {live && <span className="w-[7px] h-[7px] rounded-full flex-shrink-0" style={{ background: warn ? '#f59e0b' : '#22c55e', boxShadow: `0 0 10px ${warn ? 'rgba(245,158,11,0.6)' : 'rgba(34,197,94,0.6)'}`, animation: 'pulse 1.8s ease-in-out infinite' }} />}
        {label}
      </div>
      <AnimatePresence>{h && <motion.div initial={{ opacity: 0, y: 2 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
        className="absolute top-full mt-1.5 left-0 text-[9px] whitespace-nowrap" style={{ color: C.text3 }}>{hint}</motion.div>}</AnimatePresence>
    </div>
  );
}

/* ═══ BUTTONS ═══ */
function BtnP({ children, onClick, hint, disabled }: { children: ReactNode; onClick?: () => void; hint?: string; disabled?: boolean }) {
  const [h, sH] = useState(false);
  return (
    <div className="relative" onMouseEnter={() => sH(true)} onMouseLeave={() => sH(false)}>
      <button onClick={onClick} disabled={disabled}
        className="px-5 py-2.5 rounded-full text-[12px] font-semibold tracking-[0.06em] transition-all duration-200 hover:translate-y-[-1px] disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FE9100]/50"
        style={{ border: `1px solid ${C.orange}40`, color: '#fff', background: `linear-gradient(135deg,${C.orange}22,rgba(255,255,255,0.02))`, boxShadow: `0 8px 32px ${C.orange}12` }}>
        {children}</button>
      <AnimatePresence>{h && hint && <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        className="absolute top-full mt-1 text-[9px] whitespace-nowrap" style={{ color: C.text3 }}>{hint}</motion.div>}</AnimatePresence>
    </div>
  );
}
function BtnS({ children, onClick, hint }: { children: ReactNode; onClick?: () => void; hint?: string }) {
  const [h, sH] = useState(false);
  return (
    <div className="relative" onMouseEnter={() => sH(true)} onMouseLeave={() => sH(false)}>
      <button onClick={onClick}
        className="px-5 py-2.5 rounded-full text-[12px] font-semibold tracking-[0.06em] transition-all duration-200 hover:translate-y-[-1px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FE9100]/50"
        style={{ border: `1px solid ${C.stroke}`, color: C.text2, background: C.glass }}>{children}</button>
      <AnimatePresence>{h && hint && <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        className="absolute top-full mt-1 text-[9px] whitespace-nowrap" style={{ color: C.text3 }}>{hint}</motion.div>}</AnimatePresence>
    </div>
  );
}

/* ═══ SKELETON ═══ */
function Skel({ h = 120 }: { h?: number }) {
  return <div className={`${CARD} animate-pulse`} style={{ height: h, borderColor: C.stroke, background: 'rgba(255,255,255,0.015)' }}>
    <div className="p-5"><div className="h-3 w-28 rounded-lg mb-3" style={{ background: 'rgba(255,255,255,0.06)' }} /><div className="h-2.5 w-40 rounded-lg mb-2" style={{ background: 'rgba(255,255,255,0.03)' }} /><div className="h-2.5 w-32 rounded-lg" style={{ background: 'rgba(255,255,255,0.03)' }} /></div></div>;
}

/* ═══ KPI CARD ═══ */
function KpiCard({ label, value, sub, hint, delay = 0 }: { label: string; value: number; sub: string; hint: string; delay?: number }) {
  const [hov, sH] = useState(false);
  const [disp, setDisp] = useState(0);
  useEffect(() => {
    if (value === 0) { setDisp(0); return; }
    const s = Date.now();
    const tick = () => { const p = Math.min((Date.now() - s) / 800, 1); setDisp(Math.round(value * (1 - Math.pow(1 - p, 3)))); if (p < 1) requestAnimationFrame(tick); };
    requestAnimationFrame(tick);
  }, [value]);
  return (
    <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3, delay, ease: EASE }}
      className={`${CARD} ${CHOV} cursor-default`} style={CStyle} onMouseEnter={() => sH(true)} onMouseLeave={() => sH(false)}>
      <div className="p-4 sm:p-5">
        <div className="text-[10px] font-semibold tracking-[0.14em] uppercase mb-2" style={{ color: C.text3 }}>{label}</div>
        <div className="text-[28px] sm:text-[32px] leading-none font-bold mb-1.5" style={{ ...orb, color: C.gold }}>{disp}</div>
        <div className="text-[11px]" style={{ color: C.text2 }}>{sub}</div>
      </div>
      <div className="absolute bottom-0 inset-x-0 h-[2px]" style={{ background: `linear-gradient(90deg,transparent,${C.orange}30,transparent)` }} />
      <AnimatePresence>{hov && <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        className="absolute bottom-[-22px] left-0 text-[9px] whitespace-nowrap z-10" style={{ color: C.text3 }}>{hint}</motion.div>}</AnimatePresence>
    </motion.div>
  );
}

/* ═══ ACTION ROW ═══ */
function ActionRow({ action, nav }: { action: ActionItem; nav: (p: string) => void }) {
  const [hov, sH] = useState(false);
  const path = (action.primaryCta?.payload as Record<string,string>)?.path || '/app/dashboard';
  const pColor = action.priority === 'high' ? C.orange : action.priority === 'medium' ? '#f59e0b' : C.text3;
  const pLabel = action.priority === 'high' ? 'Empfohlen' : action.priority === 'medium' ? 'Bereit' : 'Optional';
  return (
    <div className="py-3 border-b last:border-b-0 transition-colors hover:bg-white/[0.02]" style={{ borderColor: 'rgba(255,255,255,0.04)' }}
      onMouseEnter={() => sH(true)} onMouseLeave={() => sH(false)}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="text-[13px] font-semibold mb-0.5" style={{ color: C.text1 }}>{action.title}</div>
          <div className="text-[11px] leading-relaxed" style={{ color: C.text3 }}>{action.description}</div>
        </div>
        <div className="flex items-center gap-2.5 flex-shrink-0">
          <span className="px-2.5 py-1 rounded-full text-[9px] font-semibold tracking-[0.08em] uppercase"
            style={{ border: `1px solid ${pColor}30`, color: pColor, background: `${pColor}08` }}>{pLabel}</span>
          <button onClick={() => nav(path)}
            className="px-3.5 py-1.5 rounded-full text-[10px] font-semibold tracking-[0.06em] transition-all duration-200 hover:translate-y-[-1px]"
            style={{ border: `1px solid ${C.orange}30`, color: C.orange, background: `${C.orange}08` }}>Öffnen</button>
        </div>
      </div>
      <AnimatePresence>{hov && <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
        className="text-[9px] mt-1.5" style={{ color: C.text3 }}>Öffnet die Seite, wo du diesen Schritt erledigst.</motion.div>}</AnimatePresence>
    </div>
  );
}

/* ═══ ACTIVITY ROW ═══ */
const actColors: Record<string, string> = { call_completed: '#22c55e', call_failed: '#ef4444', call_started: '#3b82f6', campaign_started: '#f59e0b', campaign_completed: '#22c55e', contact_added: '#22c55e', contact_enriched: '#8b5cf6', kb_uploaded: '#3b82f6', kb_error: '#ef4444', system_alert: '#ef4444' };

function ActRow({ item, index }: { item: ActivityItem; index: number }) {
  const color = actColors[item.type] || C.text3;
  return (
    <motion.div initial={{ opacity: 0, x: -6 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.2, delay: index * 0.03 }}
      className="flex items-start gap-3 py-2.5 border-b last:border-b-0" style={{ borderColor: 'rgba(255,255,255,0.04)' }}>
      <div className="w-[7px] h-[7px] rounded-full mt-1.5 flex-shrink-0" style={{ background: color, boxShadow: `0 0 8px ${color}40` }} />
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2">
          <span className="text-[12px] font-medium truncate" style={{ color: C.text1 }}>{item.title}</span>
          <span className="text-[9px] flex-shrink-0" style={{ color: C.text3 }}>{fmtA(item.timestamp)}</span>
        </div>
        {item.description && <div className="text-[10px] mt-0.5 truncate" style={{ color: C.text3 }}>{item.description}</div>}
      </div>
    </motion.div>
  );
}

/* ═══ STATUS ROW ═══ */
function StatusRow({ name, status, hint }: { name: string; status: 'LIVE' | 'BEREIT' | 'WARN'; hint: string }) {
  const [h, sH] = useState(false);
  const clr = status === 'LIVE' ? '#22c55e' : status === 'BEREIT' ? '#3b82f6' : '#f59e0b';
  return (
    <div className="py-2.5 border-b last:border-b-0 cursor-default" style={{ borderColor: 'rgba(255,255,255,0.04)' }}
      onMouseEnter={() => sH(true)} onMouseLeave={() => sH(false)}>
      <div className="flex items-center justify-between">
        <span className="text-[12px]" style={{ color: C.text2 }}>{name}</span>
        <div className="flex items-center gap-2">
          <span className="w-[6px] h-[6px] rounded-full" style={{ background: clr, boxShadow: `0 0 8px ${clr}60` }} />
          <span className="text-[10px] font-semibold tracking-[0.08em] uppercase" style={{ color: clr }}>{status}</span>
        </div>
      </div>
      <AnimatePresence>{h && <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
        className="text-[9px] mt-1" style={{ color: C.text3 }}>{hint}</motion.div>}</AnimatePresence>
    </div>
  );
}

/* ═══ USAGE BAR ═══ */
function UsageBar({ label, used, limit }: { label: string; used: number; limit: number }) {
  const pct = limit > 0 ? Math.min((used / limit) * 100, 100) : 0;
  const warn = pct > 80;
  return (
    <div className="py-2">
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-[11px]" style={{ color: C.text2 }}>{label}</span>
        <span className="text-[10px] font-medium" style={{ color: warn ? '#f59e0b' : C.text3 }}>{used} / {limit}</span>
      </div>
      <div className="h-[3px] rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.06)' }}>
        <motion.div initial={{ width: 0 }} animate={{ width: `${pct}%` }} transition={{ duration: 0.8, ease: EASE }}
          className="h-full rounded-full" style={{ background: warn ? 'linear-gradient(90deg,#f59e0b,#ef4444)' : `linear-gradient(90deg,${C.gold},${C.orange})` }} />
      </div>
    </div>
  );
}

/* ═══ FOLLOW-UP ROW ═══ */
function FURow({ item, nav }: { item: any; nav: (p: string) => void }) {
  const [h, sH] = useState(false);
  const sc = item.sentiment === 'positive' ? '#22c55e' : item.sentiment === 'negative' ? '#ef4444' : C.text3;
  return (
    <div className="py-2.5 border-b last:border-b-0 hover:bg-white/[0.02]" style={{ borderColor: 'rgba(255,255,255,0.04)' }}
      onMouseEnter={() => sH(true)} onMouseLeave={() => sH(false)}>
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="text-[12px] font-medium truncate" style={{ color: C.text1 }}>{item.contactName}</div>
          <div className="text-[10px] mt-0.5 truncate" style={{ color: C.text3 }}>{item.action}</div>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {item.sentiment && <span className="w-[6px] h-[6px] rounded-full" style={{ background: sc }} />}
          <button onClick={() => nav(`/app/power?call=${item.callId}`)}
            className="text-[9px] font-semibold tracking-[0.06em] uppercase px-2 py-1 rounded-full hover:bg-white/5"
            style={{ color: C.orange }}>Öffnen</button>
        </div>
      </div>
      <AnimatePresence>{h && <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        className="text-[9px] mt-1" style={{ color: C.text3 }}>{item.reason} · {fmtA(item.lastCallAt)}</motion.div>}</AnimatePresence>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   MAIN DASHBOARD CONTENT
   ═══════════════════════════════════════════════════════════════ */
function DashboardContent() {
  const { user, isLoading: authLoading } = useAuth();
  const { data, isLoading, refetch, lastUpdated } = useDashboardOverview();
  const [, setLocation] = useLocation();
  const nav = useCallback((path: string) => setLocation(path), [setLocation]);

  const [period, setPeriod] = useState<'today' | 'week' | 'month'>('today');
  const [stats, setStats] = useState<any>(null);
  const [followups, setFollowups] = useState<any[]>([]);
  const [followupsTotal, setFollowupsTotal] = useState(0);
  const [briefing, setBriefing] = useState<any>(null);
  const [suppLoading, setSuppLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setSuppLoading(true);
      const r = await Promise.allSettled([
        fetch('/api/dashboard/stats', { credentials: 'include' }).then(r => r.ok ? r.json() : null),
        fetch('/api/dashboard/followups?limit=8', { credentials: 'include' }).then(r => r.ok ? r.json() : null),
        fetch('/api/ai/daily-briefing', { method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include', body: JSON.stringify({ range: '7d' }) }).then(r => r.ok ? r.json() : null),
      ]);
      if (cancelled) return;
      if (r[0].status === 'fulfilled' && r[0].value) setStats(r[0].value);
      if (r[1].status === 'fulfilled' && r[1].value) { setFollowups(r[1].value.followups || []); setFollowupsTotal(r[1].value.total || 0); }
      if (r[2].status === 'fulfilled' && r[2].value) setBriefing(r[2].value);
      setSuppLoading(false);
    })();
    return () => { cancelled = true; };
  }, []);

  const u = user as any;
  const userName = data.user.name || u?.firstName || u?.email?.split('@')[0] || 'User';
  const plan = data.user.plan || 'free';
  const kpis = data.kpis;
  const activities = useMemo(() => [...data.activity].slice(0, 12), [data.activity]);
  const actions = useMemo(() => [...data.nextActions].slice(0, 6), [data.nextActions]);
  const alerts = data.systemAlerts;

  const callsValue = kpis.calls.started[period];
  const callsSuccessful = kpis.calls.successful[period];
  const contactsTotal = kpis.contacts.total;
  const campaignsActive = kpis.campaigns.active;
  const openFollowups = followupsTotal || (stats?.openFollowups?.value ?? 0);
  const periodLabel = period === 'today' ? 'heute' : period === 'week' ? 'diese Woche' : 'diesen Monat';

  const hasErrors = alerts.some(a => a.type === 'error');
  const hasWarnings = alerts.some(a => a.type === 'warning');

  if (authLoading) return (
    <div className="flex items-center justify-center h-full" style={{ background: C.bgDark }}>
      <div className="animate-spin rounded-full h-10 w-10 border-b-2" style={{ borderColor: C.orange }} />
    </div>
  );
  if (!user) return (
    <div className="flex items-center justify-center h-full" style={{ background: C.bgDark }}>
      <div className="text-center">
        <div className="text-[16px] mb-2" style={{ ...orb, color: C.gold }}>Nicht eingeloggt</div>
        <button onClick={() => nav('/auth')} className="text-[12px] mt-2 px-4 py-2 rounded-full" style={{ color: C.orange, border: `1px solid ${C.orange}30` }}>Anmelden</button>
      </div>
    </div>
  );

  if (isLoading && !data.activity.length) return (
    <div className="flex-1 min-h-0 overflow-y-auto" style={{ background: `linear-gradient(180deg,${C.bgDark},#07070c)` }}>
      <div className="max-w-[1240px] mx-auto px-4 sm:px-6 lg:px-8 py-8 pb-24 space-y-6">
        <Skel h={100} /><div className="grid grid-cols-2 lg:grid-cols-4 gap-4">{[1,2,3,4].map(i=><Skel key={i} h={110} />)}</div>
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-8 space-y-6"><Skel h={240} /><Skel h={280} /></div>
          <div className="lg:col-span-4 space-y-6"><Skel h={200} /><Skel h={180} /><Skel h={160} /></div>
        </div>
      </div>
    </div>
  );

  return (
    <div className="flex-1 min-h-0 overflow-y-auto" style={{ background: `linear-gradient(180deg,${C.bgDark},#07070c)` }}>
      <div className="fixed inset-0 pointer-events-none z-0" style={{ background: 'radial-gradient(1200px 700px at 18% 10%,rgba(254,145,0,0.06),transparent 62%),radial-gradient(900px 560px at 86% 18%,rgba(233,215,196,0.04),transparent 64%)' }} />

      <div className="relative z-[1] max-w-[1240px] mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-10 pb-24 space-y-6" role="main" aria-label="ARAS Dashboard">

        {/* ── A) HEADER ── */}
        <motion.div initial={{ opacity: 0, y: -12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, ease: EASE }}>
          <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-5 mb-5">
            <div>
              <p className="text-[12px] mb-1.5" style={{ color: C.text3 }}>{COPY.greeting(userName)}</p>
              <h1 className="text-[32px] sm:text-[40px] leading-[1.05] mb-2" style={{ ...orb, color: C.gold }}>{COPY.pageTitle}</h1>
              <p className="text-[14px] leading-relaxed max-w-xl" style={{ color: C.text2 }}>{COPY.pageSub}</p>
            </div>
            <div className="flex flex-wrap items-center gap-2.5">
              <Chip label={COPY.systemLive} hint={COPY.systemHint} live={!hasErrors} warn={hasErrors} />
              <Chip label={hasWarnings ? 'SYNC: WARN' : COPY.syncOk} hint={hasWarnings ? 'Einige Daten konnten nicht geladen werden.' : COPY.syncHint} live warn={hasWarnings} />
              <Chip label={`${plan.toUpperCase()} · ${kpis.quotas.calls.used}/${kpis.quotas.calls.limit}`} hint="Dein aktueller Plan und verbrauchte Calls." />
              {lastUpdated && <span className="text-[9px]" style={{ color: C.text3 }}>{fmtA(lastUpdated)}</span>}
            </div>
          </div>
          <div className="flex flex-wrap gap-3">
            <BtnP onClick={() => nav('/app/power')} hint={COPY.btnPowerH}>{COPY.btnPower}</BtnP>
            <BtnS onClick={() => nav('/app/campaigns')} hint={COPY.btnCampH}>{COPY.btnCamp}</BtnS>
            <BtnS onClick={() => nav('/app/leads')} hint={COPY.btnKBH}>{COPY.btnKB}</BtnS>
            <button onClick={() => refetch()} className="px-3 py-2 rounded-full text-[10px] font-semibold tracking-[0.08em] uppercase transition-all duration-200 hover:bg-white/5"
              style={{ color: C.text3, border: `1px solid ${C.stroke}` }}>{isLoading ? 'Lädt…' : 'Aktualisieren'}</button>
          </div>
        </motion.div>

        {/* System Alerts */}
        {alerts.filter(a => a.type === 'error' || a.type === 'warning').slice(0, 3).map(alert => (
          <motion.div key={alert.id} initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }}
            className="rounded-2xl px-4 py-3 flex items-center gap-3"
            style={{ border: `1px solid ${alert.type === 'error' ? 'rgba(239,68,68,0.25)' : 'rgba(245,158,11,0.25)'}`, background: alert.type === 'error' ? 'rgba(239,68,68,0.06)' : 'rgba(245,158,11,0.06)' }}>
            <span className="w-[7px] h-[7px] rounded-full flex-shrink-0" style={{ background: alert.type === 'error' ? '#ef4444' : '#f59e0b' }} />
            <span className="text-[12px] font-medium" style={{ color: C.text1 }}>{alert.title}</span>
            {alert.description && <span className="text-[10px]" style={{ color: C.text3 }}>{alert.description}</span>}
          </motion.div>
        ))}

        {/* ── B) KPI STRIP ── */}
        <div>
          <div className="flex items-center gap-2 mb-4">
            {(['today', 'week', 'month'] as const).map(p => (
              <button key={p} onClick={() => setPeriod(p)}
                className="px-3.5 py-1.5 rounded-full text-[10px] font-semibold tracking-[0.08em] uppercase transition-all duration-200"
                style={{ border: `1px solid ${period === p ? C.orange + '40' : C.stroke}`, color: period === p ? C.orange : C.text3, background: period === p ? C.orange + '10' : 'transparent' }}>
                {p === 'today' ? 'Heute' : p === 'week' ? '7 Tage' : '30 Tage'}</button>
            ))}
          </div>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <KpiCard label={COPY.kpiCalls} value={callsValue} sub={`${callsSuccessful} erfolgreich ${periodLabel}`} hint="Berechnet aus deinen Voice Calls." delay={0} />
            <KpiCard label={COPY.kpiCampaigns} value={campaignsActive} sub={`${kpis.campaigns.completed} abgeschlossen`} hint="Aktive und abgeschlossene Kampagnen." delay={0.05} />
            <KpiCard label={COPY.kpiContacts} value={contactsTotal} sub={`${kpis.contacts.new[period]} neu ${periodLabel}`} hint="Alle importierten Kontakte." delay={0.1} />
            <KpiCard label={COPY.kpiFollowups} value={openFollowups} sub="offen" hint="Anrufe, die einen nächsten Schritt erfordern." delay={0.15} />
          </div>
        </div>

        {/* ── MAIN GRID: Left 8 / Right 4 ── */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">

          {/* LEFT COLUMN */}
          <div className="lg:col-span-8 space-y-6">

            {/* C) ACTION CENTER */}
            <SC title={COPY.actionsTitle} sub={COPY.actionsSub}>
              {actions.length > 0
                ? <div>{actions.map(a => <ActionRow key={a.id} action={a} nav={nav} />)}</div>
                : <div className="text-center py-6"><div className="text-[13px] mb-1" style={{ color: C.text2 }}>Alles erledigt</div><div className="text-[11px]" style={{ color: C.text3 }}>Keine dringenden Aktionen erforderlich.</div></div>}
            </SC>

            {/* D) ACTIVITY FEED */}
            <SC title={COPY.activityTitle}>
              {isLoading
                ? <div className="space-y-3">{[1,2,3,4].map(i => <div key={i} className="h-10 rounded-xl animate-pulse" style={{ background: 'rgba(255,255,255,0.03)' }} />)}</div>
                : activities.length > 0
                  ? <div>{activities.map((a, i) => <ActRow key={a.id} item={a} index={i} />)}</div>
                  : <div className="text-center py-8"><div className="text-[12px]" style={{ color: C.text2 }}>{COPY.activityEmpty}</div></div>}
            </SC>

            {/* RECENT CALLS */}
            {data.recentCalls.length > 0 && (
              <SC title={COPY.callsTitle} right={<span className="text-[10px]" style={{ color: C.text3 }}>{data.recentCalls.length} Anrufe</span>}>
                <div className="max-h-[400px] overflow-y-auto">
                  {data.recentCalls.slice(0, 8).map((call: RecentCall) => (
                    <div key={call.id} onClick={() => nav(`/app/power?call=${call.id}`)}
                      className="py-2.5 border-b last:border-b-0 flex items-start justify-between gap-3 cursor-pointer hover:bg-white/[0.02] transition-colors"
                      style={{ borderColor: 'rgba(255,255,255,0.04)' }}>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="w-[6px] h-[6px] rounded-full flex-shrink-0" style={{ background: call.status === 'completed' ? '#22c55e' : call.status === 'failed' ? '#ef4444' : '#3b82f6' }} />
                          <span className="text-[12px] font-medium truncate" style={{ color: C.text1 }}>{call.contact?.name || call.contact?.phone || 'Unbekannt'}</span>
                        </div>
                        {call.summary?.short && <div className="text-[10px] mt-0.5 ml-4 truncate" style={{ color: C.text3 }}>{call.summary.short}</div>}
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        {call.duration != null && <span className="text-[9px]" style={{ color: C.text3 }}>{Math.round(call.duration / 60)}min</span>}
                        <span className="text-[9px]" style={{ color: C.text3 }}>{fmtA(call.startedAt)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </SC>
            )}
            {data.recentCalls.length === 0 && !isLoading && (
              <SC title={COPY.callsTitle}>
                <div className="text-center py-8">
                  <div className="text-[12px] mb-2" style={{ color: C.text2 }}>{COPY.callsEmpty}</div>
                  <button onClick={() => nav('/app/power')} className="text-[10px] font-semibold px-4 py-2 rounded-full" style={{ color: C.orange, border: `1px solid ${C.orange}30` }}>{COPY.btnPower}</button>
                </div>
              </SC>
            )}
          </div>

          {/* RIGHT COLUMN */}
          <div className="lg:col-span-4 space-y-6">

            {/* E) SYSTEM STATUS */}
            <SC title={COPY.systemTitle}>
              <StatusRow name="ARAS Core" status={hasErrors ? 'WARN' : 'LIVE'} hint="Hauptsystem für alle ARAS Funktionen." />
              <StatusRow name="Voice Engine" status="BEREIT" hint="Sprachverarbeitung und Anruf-System." />
              <StatusRow name="Campaign Engine" status="BEREIT" hint="Automatisierte Outbound-Kampagnen." />
              <StatusRow name="Knowledge Sync" status={kpis.knowledge.errorSources > 0 ? 'WARN' : 'LIVE'} hint="Synchronisierung deiner Wissensdatenbank." />
            </SC>

            {/* PLAN & LIMITS */}
            <SC title={COPY.planTitle} right={
              <button onClick={() => nav('/app/billing')} className="text-[9px] font-semibold tracking-[0.08em] uppercase px-2.5 py-1 rounded-full hover:bg-white/5" style={{ color: C.orange }}>Plan ansehen</button>
            }>
              <div className="mb-2"><span className="text-[18px] font-bold" style={{ ...orb, color: C.orange }}>{plan.charAt(0).toUpperCase() + plan.slice(1)}</span></div>
              <UsageBar label="Voice Calls" used={kpis.quotas.calls.used} limit={kpis.quotas.calls.limit} />
              <UsageBar label="Spaces" used={kpis.quotas.spaces.used} limit={kpis.quotas.spaces.limit} />
              <UsageBar label="Speicher (MB)" used={kpis.quotas.storage.used} limit={kpis.quotas.storage.limit} />
            </SC>

            {/* FOLLOW-UP QUEUE */}
            <SC title={COPY.followupsTitle} right={followupsTotal > 0 ? <span className="text-[10px]" style={{ color: C.text3 }}>{followupsTotal} gesamt</span> : undefined}>
              {suppLoading
                ? <div className="space-y-2">{[1,2,3].map(i => <div key={i} className="h-12 rounded-xl animate-pulse" style={{ background: 'rgba(255,255,255,0.03)' }} />)}</div>
                : followups.length > 0
                  ? <div>{followups.slice(0, 5).map(f => <FURow key={f.id} item={f} nav={nav} />)}</div>
                  : <div className="text-center py-5"><div className="text-[11px]" style={{ color: C.text3 }}>{COPY.followupsEmpty}</div></div>}
            </SC>

            {/* KI BRIEFING */}
            {briefing && (
              <SC title={COPY.briefingTitle}>
                {briefing.headline && <div className="text-[13px] font-semibold mb-2" style={{ color: C.text1 }}>{briefing.headline}</div>}
                {briefing.missionSummary && <div className="text-[11px] leading-relaxed mb-3" style={{ color: C.text2 }}>{briefing.missionSummary}</div>}
                {briefing.topPriorities?.length > 0 && (
                  <div className="space-y-1.5">{briefing.topPriorities.slice(0, 3).map((p: any, i: number) => (
                    <div key={i} className="text-[11px] py-1.5 border-b last:border-b-0" style={{ borderColor: 'rgba(255,255,255,0.04)', color: C.text2 }}>
                      <span className="font-medium" style={{ color: C.text1 }}>{p.title || p.action}</span>
                      {p.reason && <span className="ml-1.5" style={{ color: C.text3 }}>· {p.reason}</span>}
                    </div>
                  ))}</div>
                )}
              </SC>
            )}
            {!briefing && !suppLoading && (
              <SC title={COPY.briefingTitle}>
                <div className="text-center py-5"><div className="text-[11px]" style={{ color: C.text3 }}>{COPY.briefingEmpty}</div></div>
              </SC>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="text-center pt-4 border-t" style={{ borderColor: 'rgba(255,255,255,0.04)' }}>
          <p className="text-[9px]" style={{ color: 'rgba(255,255,255,0.15)' }}>ARAS AI Dashboard · {new Date().getFullYear()}</p>
        </div>
      </div>

      <style>{`@keyframes pulse{0%,100%{transform:scale(1);opacity:1}50%{transform:scale(1.4);opacity:0.6}}`}</style>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   PAGE EXPORT
   ═══════════════════════════════════════════════════════════════ */
export default function Dashboard() {
  return <EB><DashboardContent /></EB>;
}
