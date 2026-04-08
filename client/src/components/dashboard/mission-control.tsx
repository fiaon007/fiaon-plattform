/**
 * ARAS Mission Control - Main Dashboard Component
 * The central command center - premium, data-driven, interactive
 * UPGRADE: Session gating, safe defaults, "Vertrieb starten?" CTA
 */

import React, { useState, useEffect, Suspense, lazy } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  RefreshCw, AlertTriangle, X, Phone, Users, 
  Calendar, Sparkles, ChevronRight, TrendingUp, Target,
  Zap, ArrowRight, Activity, Filter, Search
} from 'lucide-react';
import { useDashboardOverview, needsSetup } from '@/lib/dashboard/use-dashboard-overview';
import { KpiCards } from './kpi-cards';
import { ActivityStream } from './activity-stream';
import { ContactsDrawer } from './contacts-drawer';
import { CallCard } from './call-card';
import { ActionCenter } from './action-center';
import { FollowUpQueue } from './follow-up-queue';
import { DailyBriefing } from './daily-briefing';
import { ContactDrawer } from './contact-drawer';
import { ArasMark } from '@/components/brand/aras-mark';
import type { RecentCall } from '@/lib/dashboard/overview.schema';
import { ModuleBoundary } from '@/components/system/module-boundary';
import { asArray, isValidString, safeNumber } from '@/lib/utils/safe';
import type { User } from '@shared/schema';

// ═══════════════════════════════════════════════════════════════
// MISSION CONTROL DESIGN SYSTEM
// ═══════════════════════════════════════════════════════════════

// Design Tokens (ARAS CI)
const DT = {
  orange: '#ff6a00',
  gold: '#e9d7c4',
  panelBg: 'rgba(0,0,0,0.42)',
  panelBorder: 'rgba(255,255,255,0.08)',
  glow: '0 0 0 1px rgba(255,106,0,0.18), 0 0 22px rgba(255,106,0,0.10)',
  glowOrange: 'rgba(255,106,0,0.25)',
  glowGold: 'rgba(233,215,196,0.18)',
};

// Spacing System (responsive)
const SPACING = {
  pad: { desktop: 24, tablet: 18, mobile: 16 },
  gap: { desktop: 16, tablet: 14, mobile: 12 },
  radius: 16,
};

// Motion Tokens (consistent timing)
const MOTION = {
  fast: '160ms',
  base: '240ms',
  slow: '320ms',
  drawer: '280ms',
  backdrop: '180ms',
  easing: 'ease-out',
};

// CSS Variables for Mission Control
const MC_CSS_VARS = {
  '--mc-pad': '24px',
  '--mc-gap': '16px',
  '--mc-radius-card': '16px',
  '--mc-radius-btn': '14px',
  '--mc-radius-chip': '12px',
  '--mc-border': 'rgba(255,255,255,0.06)',
  '--mc-glass': 'rgba(255,255,255,0.03)',
  '--mc-text-dim': 'rgba(255,255,255,0.72)',
  '--mc-orange': '#ff6a00',
  '--mc-gold': '#e9d7c4',
} as React.CSSProperties;

// Focus Ring Utility - visible on dark background, mandatory for all interactive elements
const focusRingClass = 'focus:outline-none focus:ring-2 focus:ring-[#ff6a00]/50 focus:ring-offset-2 focus:ring-offset-black/80 transition-shadow duration-120';

// Premium Button Utility - hover lift, active press, focus ring
const premiumButtonClass = `
  transition-all duration-200
  hover:translate-y-[-1px] hover:shadow-lg
  active:translate-y-0 active:shadow-md
  ${focusRingClass}
`.trim().replace(/\s+/g, ' ');

interface MissionControlProps {
  user: User | null;
}

function ModuleSkeleton({ height = 200 }: { height?: number }) {
  return (
    <div 
      className="rounded-2xl overflow-hidden animate-pulse"
      style={{ 
        height,
        background: 'rgba(0,0,0,0.35)',
        border: '1px solid rgba(255,255,255,0.08)'
      }}
    >
      <div className="p-4">
        <div className="h-4 w-32 bg-white/10 rounded mb-3" />
        <div className="space-y-2">
          <div className="h-3 w-full bg-white/5 rounded" />
          <div className="h-3 w-3/4 bg-white/5 rounded" />
        </div>
      </div>
    </div>
  );
}

function SystemAlertBanner({ alerts, onDismiss }: { 
  alerts: any[]; 
  onDismiss: (id: string) => void;
}) {
  if (alerts.length === 0) return null;

  return (
    <div className="space-y-2 mb-4">
      {alerts.map((alert) => (
        <motion.div
          key={alert.id}
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          className="rounded-xl p-3 flex items-center gap-3"
          style={{
            background: alert.type === 'error' 
              ? 'rgba(239,68,68,0.15)' 
              : alert.type === 'warning'
              ? 'rgba(245,158,11,0.15)'
              : 'rgba(59,130,246,0.15)',
            border: `1px solid ${
              alert.type === 'error' 
                ? 'rgba(239,68,68,0.3)' 
                : alert.type === 'warning'
                ? 'rgba(245,158,11,0.3)'
                : 'rgba(59,130,246,0.3)'
            }`,
          }}
        >
          <AlertTriangle 
            size={16} 
            style={{ 
              color: alert.type === 'error' ? '#ef4444' : alert.type === 'warning' ? '#f59e0b' : '#3b82f6' 
            }} 
          />
          <div className="flex-1">
            <p className="text-[12px] font-medium text-white/90">{alert.title}</p>
            {alert.description && (
              <p className="text-[10px] text-white/50">{alert.description}</p>
            )}
          </div>
          {alert.dismissible && (
            <button 
              onClick={() => onDismiss(alert.id)}
              className="p-1 hover:bg-white/10 rounded transition-colors"
            >
              <X size={14} className="text-white/40" />
            </button>
          )}
        </motion.div>
      ))}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// HERO CTA PANEL - "Vertrieb starten?"
// ═══════════════════════════════════════════════════════════════

function SalesHeroCTA() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: 0.1 }}
      className="relative overflow-hidden rounded-2xl p-6 sm:p-8"
      style={{
        background: `linear-gradient(135deg, rgba(255,106,0,0.12) 0%, rgba(0,0,0,0.6) 50%, rgba(255,106,0,0.08) 100%)`,
        border: '1px solid rgba(255,106,0,0.2)',
        boxShadow: '0 0 40px rgba(255,106,0,0.1), inset 0 1px 0 rgba(255,255,255,0.05)',
      }}
    >
      {/* Glow effect */}
      <div 
        className="absolute -top-24 -right-24 w-48 h-48 rounded-full blur-3xl opacity-30"
        style={{ background: DT.orange }}
      />
      
      <div className="relative z-10 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-6">
        <div className="flex-1">
          <div className="flex items-center gap-3 mb-3">
            <ArasMark size={48} animate glow />
            <div>
              <h2 className="text-xl sm:text-2xl font-bold text-white font-['Orbitron']">
                Vertrieb starten?
              </h2>
            </div>
          </div>
          <p className="text-sm sm:text-base text-white/70 max-w-md">
            Starte jetzt mit nur 1 Klick <span className="text-white font-semibold">10.000 Anrufe GLEICHZEITIG!</span>
          </p>
        </div>

        <div className="flex flex-col sm:flex-row gap-3">
          <a
            href="/app/campaigns"
            className="group flex items-center justify-center gap-2 px-6 py-3 rounded-xl font-semibold text-white transition-all duration-300 hover:scale-[1.02]"
            style={{
              background: `linear-gradient(135deg, ${DT.orange}, #ff8533)`,
              boxShadow: '0 4px 20px rgba(255,106,0,0.4)',
            }}
          >
            <span>Kampagnen öffnen</span>
            <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" />
          </a>
        </div>
      </div>
    </motion.div>
  );
}

// ═══════════════════════════════════════════════════════════════
// KI PRIORITÄTEN PANEL (replaces Contact Radar)
// ═══════════════════════════════════════════════════════════════

interface KIPriority {
  id: string;
  title: string;
  description: string;
  icon: React.ReactNode;
  action: { label: string; href: string };
  priority: 'high' | 'medium' | 'low';
}

function KIPrioritiesPanel({ kpis, activity }: { kpis: any; activity: any[] }) {
  // Generate AI-driven priorities based on actual data
  const priorities: KIPriority[] = [];

  // Check for setup needs
  if (safeNumber(kpis?.contacts?.total) === 0) {
    priorities.push({
      id: 'import-contacts',
      title: 'Kontakte importieren',
      description: 'Importiere deine ersten Kontakte um mit Calls zu starten.',
      icon: <Users size={16} style={{ color: DT.orange }} />,
      action: { label: 'Importieren', href: '/app/contacts' },
      priority: 'high',
    });
  }

  if (safeNumber(kpis?.campaigns?.active) === 0 && safeNumber(kpis?.contacts?.total) > 0) {
    priorities.push({
      id: 'start-campaign',
      title: 'Erste Kampagne starten',
      description: 'Du hast Kontakte aber noch keine aktive Kampagne.',
      icon: <Target size={16} style={{ color: DT.orange }} />,
      action: { label: 'Erstellen', href: '/app/campaigns' },
      priority: 'high',
    });
  }

  if (safeNumber(kpis?.calls?.failed?.today) > 0) {
    priorities.push({
      id: 'retry-failed',
      title: `${kpis.calls.failed.today} fehlgeschlagene Calls`,
      description: 'Einige Anrufe heute waren nicht erfolgreich.',
      icon: <Phone size={16} className="text-red-400" />,
      action: { label: 'Prüfen', href: '/app/power' },
      priority: 'medium',
    });
  }

  // Add calendar suggestion if no recent activity
  if (asArray(activity).length === 0) {
    priorities.push({
      id: 'connect-calendar',
      title: 'Kalender verbinden',
      description: 'Verbinde deinen Kalender für automatische Terminplanung.',
      icon: <Calendar size={16} className="text-blue-400" />,
      action: { label: 'Verbinden', href: '/app/calendar' },
      priority: 'low',
    });
  }

  // Default if all good
  if (priorities.length === 0) {
    priorities.push({
      id: 'all-good',
      title: 'Alles im grünen Bereich',
      description: 'Keine dringenden Aktionen erforderlich.',
      icon: <Sparkles size={16} className="text-green-400" />,
      action: { label: 'Dashboard', href: '/app/dashboard' },
      priority: 'low',
    });
  }

  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.3, delay: 0.2 }}
      className="rounded-2xl p-5"
      style={{
        background: DT.panelBg,
        border: `1px solid ${DT.panelBorder}`,
      }}
    >
      <div className="flex items-center gap-2 mb-4">
        <Sparkles size={16} style={{ color: DT.orange }} />
        <h3 className="text-sm font-semibold text-white">KI Prioritäten</h3>
      </div>

      <div className="space-y-3">
        {priorities.slice(0, 4).map((item) => (
          <div 
            key={item.id}
            className="flex items-start gap-3 p-3 rounded-xl transition-colors hover:bg-white/5"
            style={{ borderLeft: `2px solid ${item.priority === 'high' ? DT.orange : item.priority === 'medium' ? '#f59e0b' : '#6b7280'}` }}
          >
            <div className="mt-0.5">{item.icon}</div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium text-white truncate">{item.title}</p>
              <p className="text-[10px] text-white/50 mt-0.5">{item.description}</p>
            </div>
            <a
              href={item.action.href}
              className="text-[10px] px-2 py-1 rounded-md font-medium transition-colors hover:bg-white/10"
              style={{ color: DT.orange }}
            >
              {item.action.label}
            </a>
          </div>
        ))}
      </div>
    </motion.div>
  );
}

// ═══════════════════════════════════════════════════════════════
// CALENDAR MINI PANEL
// ═══════════════════════════════════════════════════════════════

function CalendarMiniPanel() {
  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.3, delay: 0.3 }}
      className="rounded-2xl p-5"
      style={{
        background: DT.panelBg,
        border: `1px solid ${DT.panelBorder}`,
      }}
    >
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Calendar size={16} style={{ color: DT.orange }} />
          <h3 className="text-sm font-semibold text-white">Nächste Termine</h3>
        </div>
        <a 
          href="/app/calendar" 
          className="text-[10px] text-white/50 hover:text-white/70 transition-colors flex items-center gap-1"
        >
          Alle <ChevronRight size={12} />
        </a>
      </div>

      <div className="space-y-2">
        <div className="text-center py-6">
          <Calendar size={32} className="mx-auto mb-2 text-white/20" />
          <p className="text-xs text-white/40">Keine Termine heute</p>
          <a 
            href="/app/calendar"
            className="text-[10px] mt-2 inline-block px-3 py-1 rounded-full transition-colors hover:bg-white/10"
            style={{ color: DT.orange }}
          >
            Termin anlegen
          </a>
        </div>
      </div>
    </motion.div>
  );
}

// ═══════════════════════════════════════════════════════════════
// RECENT CALLS PANEL - REAL DATA with Audio/Transcript/Summary
// ═══════════════════════════════════════════════════════════════

function RecentCallsPanel({ calls, isLoading, onOpenContact }: { 
  calls: RecentCall[]; 
  isLoading: boolean;
  onOpenContact?: (id: string) => void;
}) {
  if (isLoading) {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="rounded-2xl p-5"
        style={{ background: DT.panelBg, border: `1px solid ${DT.panelBorder}` }}
      >
        <div className="flex items-center gap-2 mb-4">
          <Phone size={16} style={{ color: DT.orange }} />
          <h3 className="text-sm font-semibold text-white">Letzte Anrufe</h3>
        </div>
        <div className="space-y-3">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-20 rounded-xl bg-white/5 animate-pulse" />
          ))}
        </div>
      </motion.div>
    );
  }

  if (calls.length === 0) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="rounded-2xl p-6"
        style={{ background: DT.panelBg, border: `1px solid ${DT.panelBorder}` }}
      >
        <div className="flex items-center gap-2 mb-4">
          <Phone size={16} style={{ color: DT.orange }} />
          <h3 className="text-sm font-semibold text-white">Letzte Anrufe</h3>
        </div>
        <div className="text-center py-8">
          <div 
            className="w-14 h-14 rounded-2xl mx-auto mb-3 flex items-center justify-center"
            style={{ background: `${DT.orange}15` }}
          >
            <Phone size={24} style={{ color: DT.orange }} />
          </div>
          <p className="text-sm text-white/60 mb-2">Noch keine Anrufe</p>
          <p className="text-xs text-white/40 mb-4">Starte deinen ersten Anruf mit ARAS Voice</p>
          <a
            href="/app/power/einzelanruf"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium text-white transition-all hover:scale-105"
            style={{ background: `linear-gradient(135deg, ${DT.orange}, #ff8533)` }}
          >
            <Phone size={14} />
            Ersten Call starten
          </a>
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-2xl overflow-hidden"
      style={{ background: DT.panelBg, border: `1px solid ${DT.panelBorder}` }}
    >
      <div className="p-4 border-b" style={{ borderColor: 'rgba(255,255,255,0.05)' }}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Phone size={16} style={{ color: DT.orange }} />
            <h3 
              className="text-sm font-bold uppercase tracking-wide"
              style={{
                background: `linear-gradient(90deg, ${DT.gold}, ${DT.orange})`,
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
              }}
            >
              Letzte Anrufe
            </h3>
          </div>
          <span className="text-[10px] text-white/30">
            {calls.length} Anrufe
          </span>
        </div>
      </div>

      <div className="p-4 space-y-3 max-h-[600px] overflow-y-auto">
        {calls.map((call) => (
          <CallCard 
            key={call.id} 
            call={call}
            onOpenDetails={(id) => window.location.href = `/app/power?call=${id}`}
            onOpenContact={(id) => onOpenContact ? onOpenContact(id) : window.location.href = `/app/contacts/${id}`}
          />
        ))}
      </div>

      {/* Load More / Pagination hint */}
      {calls.length >= 20 && (
        <div className="px-4 py-3 border-t text-center" style={{ borderColor: 'rgba(255,255,255,0.05)' }}>
          <p className="text-[10px] text-white/30">
            Zeigt die letzten {calls.length} Anrufe • Weitere über Filter verfügbar
          </p>
        </div>
      )}
    </motion.div>
  );
}

// ═══════════════════════════════════════════════════════════════
// SESSION GATE SKELETON
// ═══════════════════════════════════════════════════════════════

function SessionLoadingSkeleton() {
  return (
    <div className="flex-1 min-h-0">
      <div className="max-w-[1400px] mx-auto px-4 sm:px-6 py-6 space-y-6">
        {/* Header Skeleton */}
        <div className="animate-pulse">
          <div className="h-3 w-16 bg-white/10 rounded mb-2" />
          <div className="h-8 w-64 bg-white/10 rounded mb-2" />
          <div className="h-4 w-48 bg-white/5 rounded" />
        </div>

        {/* KPI Skeleton */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="h-24 rounded-xl bg-white/5 animate-pulse" />
          ))}
        </div>

        {/* Content Skeleton */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <div className="h-48 rounded-xl bg-white/5 animate-pulse" />
            <div className="h-64 rounded-xl bg-white/5 animate-pulse" />
          </div>
          <div className="space-y-6">
            <div className="h-48 rounded-xl bg-white/5 animate-pulse" />
            <div className="h-48 rounded-xl bg-white/5 animate-pulse" />
          </div>
        </div>
      </div>
    </div>
  );
}

function SessionExpiredFallback() {
  return (
    <div className="flex-1 min-h-0 flex items-center justify-center">
      <div className="text-center p-8">
        <div 
          className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4"
          style={{ background: `linear-gradient(135deg, ${DT.orange}22, ${DT.orange}08)` }}
        >
          <AlertTriangle size={28} style={{ color: DT.orange }} />
        </div>
        <h2 className="text-lg font-semibold text-white mb-2">Session abgelaufen</h2>
        <p className="text-sm text-white/50 mb-4">Bitte melde dich erneut an.</p>
        <a
          href="/auth"
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl font-medium text-white transition-all hover:scale-105"
          style={{ background: `linear-gradient(135deg, ${DT.orange}, #ff8533)` }}
        >
          Neu anmelden
          <ArrowRight size={16} />
        </a>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════

export function MissionControl({ user }: MissionControlProps) {
  const { data, isLoading, refetch, lastUpdated } = useDashboardOverview();
  const [kpiPeriod, setKpiPeriod] = useState<'today' | 'week' | 'month'>('today');
  const [dismissedAlerts, setDismissedAlerts] = useState<Set<string>>(new Set());
  const [contactsDrawerOpen, setContactsDrawerOpen] = useState(false);
  
  // V4: New state for enhanced features
  const [selectedContactId, setSelectedContactId] = useState<string | null>(null);
  const [followups, setFollowups] = useState<any[]>([]);
  const [followupsTotal, setFollowupsTotal] = useState(0);
  const [followupsLoading, setFollowupsLoading] = useState(false);
  const [briefing, setBriefing] = useState<any>(null);
  const [briefingLoading, setBriefingLoading] = useState(false);
  const [stats, setStats] = useState<any>(null);

  // V4: Fetch follow-ups and briefing on mount
  useEffect(() => {
    const fetchFollowups = async () => {
      setFollowupsLoading(true);
      try {
        const res = await fetch('/api/dashboard/followups?limit=10', { credentials: 'include' });
        if (res.ok) {
          const data = await res.json();
          setFollowups(data.followups || []);
          setFollowupsTotal(data.total || 0);
        }
      } catch (e) { console.error('Followups fetch error:', e); }
      finally { setFollowupsLoading(false); }
    };

    const fetchBriefing = async () => {
      setBriefingLoading(true);
      try {
        const res = await fetch('/api/ai/daily-briefing', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ range: '7d' }),
        });
        if (res.ok) {
          const data = await res.json();
          setBriefing(data);
        }
      } catch (e) { console.error('Briefing fetch error:', e); }
      finally { setBriefingLoading(false); }
    };

    const fetchStats = async () => {
      try {
        const res = await fetch('/api/dashboard/stats', { credentials: 'include' });
        if (res.ok) {
          setStats(await res.json());
        }
      } catch (e) { console.error('Stats fetch error:', e); }
    };

    fetchFollowups();
    fetchBriefing();
    fetchStats();
  }, []);

  const handleRefreshBriefing = async () => {
    setBriefingLoading(true);
    try {
      const res = await fetch('/api/ai/daily-briefing', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ range: '7d', forceRefresh: true }),
      });
      if (res.ok) setBriefing(await res.json());
    } catch (e) { console.error('Briefing refresh error:', e); }
    finally { setBriefingLoading(false); }
  };

  // SESSION GATE: If user not valid, show appropriate fallback
  const hasValidUser = user && isValidString(user.id);
  
  // Show skeleton while loading
  if (isLoading && !data) {
    return <SessionLoadingSkeleton />;
  }

  // Show login fallback if no valid user after loading
  if (!hasValidUser && !isLoading) {
    return <SessionExpiredFallback />;
  }

  const visibleAlerts = asArray<{ id: string; type: string; title: string; description?: string; dismissible?: boolean }>(data.systemAlerts).filter(a => !dismissedAlerts.has(a.id));

  const handleDismissAlert = (id: string) => {
    setDismissedAlerts(prev => new Set(Array.from(prev).concat(id)));
  };

  return (
    <div className="flex-1 min-h-0">
      <div className="max-w-[1400px] mx-auto px-4 sm:px-6 py-6 space-y-8">
        
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.24 }}
          className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4"
        >
          <div>
            <p className="text-[10px] uppercase tracking-[0.25em] text-neutral-600 mb-2 font-medium">
              ARAS AI
            </p>
            <h1 
              className="text-2xl sm:text-3xl font-black font-['Orbitron'] tracking-wide inline-block relative"
              style={{
                background: `linear-gradient(90deg, ${DT.orange}, #ffb15a, ${DT.gold}, #ffb15a, ${DT.orange})`,
                backgroundSize: '200% auto',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                animation: 'sheen 10s linear infinite',
              }}
            >
              MISSION CONTROL
            </h1>
            <p className="text-xs text-neutral-400 mt-1">
              Deine Kommandozentrale • {data.user.name || user?.firstName || user?.email?.split('@')[0] || 'User'}
            </p>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <div 
                className="w-2 h-2 rounded-full animate-pulse"
                style={{ background: isLoading ? '#f59e0b' : '#22c55e' }}
              />
              <span className="text-[10px] text-neutral-500 uppercase tracking-wider">
                {isLoading ? 'Lädt...' : 'Bereit'}
              </span>
            </div>

            <button
              onClick={() => refetch()}
              disabled={isLoading}
              className="p-2 rounded-lg transition-all hover:bg-white/5 disabled:opacity-50"
            >
              <RefreshCw 
                size={16} 
                className={`text-white/40 ${isLoading ? 'animate-spin' : ''}`} 
              />
            </button>

            {lastUpdated && (
              <span className="text-[9px] text-white/30">
                {lastUpdated.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}
              </span>
            )}
          </div>
        </motion.div>

        {/* System Alerts */}
        <SystemAlertBanner alerts={visibleAlerts} onDismiss={handleDismissAlert} />

        {/* HERO CTA: Vertrieb starten? */}
        <SalesHeroCTA />

        {/* KPI Cards - nur die wichtigsten 4 */}
        <KpiCards 
          kpis={data.kpis} 
          period={kpiPeriod} 
          onPeriodChange={setKpiPeriod}
          onContactsClick={() => setContactsDrawerOpen(true)}
        />

        {/* V4: AI Briefing Card */}
        <DailyBriefing 
          briefing={briefing}
          loading={briefingLoading}
          onRefresh={handleRefreshBriefing}
          onOpenCall={(id) => window.location.href = `/app/power?call=${id}`}
        />

        {/* Main Content Grid - V4 Layout: 70/30 split */}
        <div className="grid grid-cols-1 lg:grid-cols-10 gap-6">
          
          {/* Left Column (70%) - Call Intelligence Feed */}
          <div className="lg:col-span-7 space-y-6">
            {/* Recent Calls - REAL DATA with Audio/Transcript/Summary */}
            <RecentCallsPanel 
              calls={asArray<RecentCall>(data.recentCalls)} 
              isLoading={isLoading}
              onOpenContact={(id) => setSelectedContactId(id)}
            />

            {/* Activity Stream */}
            <ActivityStream 
              activities={asArray(data.activity)} 
              isLoading={isLoading}
              maxItems={8}
            />
          </div>

          {/* Right Column (30%) - Intelligence Panels */}
          <div className="lg:col-span-3 space-y-6">
            {/* V4: Follow-Up Queue - Money Maker */}
            <FollowUpQueue 
              followups={followups}
              total={followupsTotal}
              loading={followupsLoading}
              onOpenCall={(id) => window.location.href = `/app/power?call=${id}`}
              onOpenContact={(id) => setSelectedContactId(id)}
            />

            {/* Gemini Action Center - AI recommendations from calls */}
            <ActionCenter 
              calls={asArray<RecentCall>(data.recentCalls)} 
              isLoading={isLoading}
              onOpenCall={(id) => window.location.href = `/app/power?call=${id}`}
            />

            {/* Calendar Mini Panel */}
            <CalendarMiniPanel />
          </div>
        </div>

        {/* Debug Info Bar (only with ?debug=1) */}
        {window.location.search.includes('debug=1') && (data as any).debug && (
          <div 
            className="rounded-lg p-3 mt-4"
            style={{ background: 'rgba(59,130,246,0.1)', border: '1px solid rgba(59,130,246,0.2)' }}
          >
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <Activity size={12} className="text-blue-400" />
                <span className="text-[10px] font-medium text-blue-400">DEBUG INFO</span>
              </div>
              {/* DATA MAPPING ERROR indicator */}
              {(data as any).debug.totalRaw > 0 && asArray(data.recentCalls).length === 0 && (
                <span className="text-[9px] px-2 py-0.5 rounded bg-red-500/20 text-red-400 font-medium">
                  DATA MAPPING ERROR
                </span>
              )}
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-[9px] text-white/60">
              <div>callLogs: <span className="text-white">{(data as any).debug.sources?.callLogs || 0}</span></div>
              <div>internal: <span className="text-white">{(data as any).debug.sources?.internalCallLogs || 0}</span></div>
              <div>totalRaw: <span className="text-white">{(data as any).debug.totalRaw || 0}</span></div>
              <div>deduped: <span className="text-white">{(data as any).debug.totalDeduped || 0}</span></div>
              <div>returned: <span className="text-white">{(data as any).debug.totalReturned || 0}</span></div>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-[9px] text-white/60 mt-2">
              <div>matchField: <span className="text-blue-300">{(data as any).debug.scope?.matchFieldUsed || 'unknown'}</span></div>
              <div>userId: <span className="text-white/50">{(data as any).debug.userId?.substring(0, 12)}...</span></div>
              <div>firstIds: <span className="text-white/50">{((data as any).debug.firstCallIds || []).slice(0, 2).join(', ') || 'none'}</span></div>
            </div>
            <div className="text-[8px] text-white/20 mt-1">
              {(data as any).debug.timestamp}
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="text-center pt-4 border-t border-white/5">
          <p className="text-[9px] text-white/20">
            ARAS AI Mission Control • Build {import.meta.env.VITE_BUILD_ID || 'dev'}
          </p>
        </div>
      </div>

      {/* Contacts Drawer (legacy) */}
      <ContactsDrawer 
        isOpen={contactsDrawerOpen} 
        onClose={() => setContactsDrawerOpen(false)} 
      />

      {/* V4: Contact Timeline Drawer */}
      <ContactDrawer
        contactId={selectedContactId}
        onClose={() => setSelectedContactId(null)}
        onOpenCall={(id) => window.location.href = `/app/power?call=${id}`}
        onAddToCampaign={(id) => window.location.href = `/app/campaigns?contact=${id}`}
        onCreateTask={(id) => window.location.href = `/app/tasks?contact=${id}`}
      />
    </div>
  );
}

export default MissionControl;
