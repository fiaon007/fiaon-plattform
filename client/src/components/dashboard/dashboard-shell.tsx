/**
 * ARAS Dashboard Shell
 * Cycle-free shell that lazy loads dashboard modules
 * Each module becomes its own chunk - if one crashes, others still load
 * Safari TDZ-safe: No import-time side effects
 */

import React, { Suspense, useMemo, useCallback, useState } from 'react';
import { motion } from 'framer-motion';
import { lazyWithRetry } from '@/lib/react/lazy-with-retry';
import { ModuleBoundary } from '@/components/system/module-boundary';
import type { User } from '@shared/schema';

// Lazy modules - each becomes its own chunk
// NO barrel imports, only direct paths
const MissionBriefing = lazyWithRetry(() => import('@/components/dashboard/mission-briefing'));
const SmartInbox = lazyWithRetry(() => import('@/components/dashboard/smart-inbox'));
const ContactRadar = lazyWithRetry(() => import('@/components/dashboard/contact-radar'));
const TodayOS = lazyWithRetry(() => import('@/components/dashboard/today-os'));
const MatrixPanel = lazyWithRetry(() => import('@/components/system/matrix-panel'));

// Skeleton loader for modules
function DashboardModuleSkeleton({ title, height }: { title: string; height: number }) {
  return (
    <div 
      className="rounded-[20px] overflow-hidden animate-pulse"
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

export interface DashboardShellProps {
  user: User | null;
  // All data and callbacks passed via DI - no imports
  data: {
    callLogs: any[];
    chatSessions: any[];
    openTasks: any[];
    calendar: any[];
    systemStatus: any;
  };
  handlers: {
    onOpenDetails: (item: any) => void;
    onCreateTask: (items: any[]) => void;
    onDismissInfo: (id: string) => void;
    onFocusContact: (key: string | null) => void;
    onPinContact: (key: string) => void;
  };
  state: {
    focusKey: string | null;
    pinnedKeys: string[];
    activeFilter: 'all' | 'call' | 'space';
    searchQuery: string;
  };
  setters: {
    setActiveFilter: (filter: 'all' | 'call' | 'space') => void;
    setSearchQuery: (q: string) => void;
    setFocusKey: (key: string | null) => void;
    setPinnedKeys: (keys: string[]) => void;
  };
}

export function DashboardShell(props: DashboardShellProps) {
  const { user, data, handlers, state, setters } = props;

  // Design tokens - defined in shell, not imported
  const DT = useMemo(() => ({
    orange: '#ff6a00',
    gold: '#e9d7c4',
    panelBg: 'rgba(0,0,0,0.42)',
    panelBorder: 'rgba(255,255,255,0.08)',
    glow: '0 0 0 1px rgba(255,106,0,0.18), 0 0 22px rgba(255,106,0,0.10)',
  }), []);

  // All module props prepared here - no import-time computation
  const missionBriefingProps = useMemo(() => ({
    user,
    callsToday: data.callLogs.filter((c: any) => {
      const d = new Date(c.timestamp);
      const today = new Date();
      return d.toDateString() === today.toDateString();
    }).length,
  }), [user, data.callLogs]);

  const smartInboxProps = useMemo(() => ({
    callLogs: data.callLogs,
    chatSessions: data.chatSessions,
    onOpenDetails: handlers.onOpenDetails,
    onCreateTasks: handlers.onCreateTask,
    onDismissInfo: handlers.onDismissInfo,
    activeFilter: state.activeFilter,
    setActiveFilter: setters.setActiveFilter,
    searchQuery: state.searchQuery,
    setSearchQuery: setters.setSearchQuery,
  }), [data, handlers, state, setters]);

  const contactRadarProps = useMemo(() => ({
    callLogs: data.callLogs,
    chatSessions: data.chatSessions,
    openTasks: data.openTasks,
    focusKey: state.focusKey,
    pinnedKeys: state.pinnedKeys,
    onFocusContact: handlers.onFocusContact,
    onPinContact: handlers.onPinContact,
    onOpenBestSource: handlers.onOpenDetails,
  }), [data, state, handlers]);

  const todayOSProps = useMemo(() => ({
    callLogs: data.callLogs,
    calendar: data.calendar,
    openTasks: data.openTasks,
  }), [data]);

  const matrixProps = useMemo(() => ({
    systemStatus: data.systemStatus,
    metrics: {
      totalCalls: data.callLogs.length,
      totalSessions: data.chatSessions.length,
      pendingTasks: data.openTasks.filter((t: any) => t.status === 'pending').length,
    },
  }), [data]);

  return (
    <div className="flex-1 min-h-0">
      <div className="max-w-[1200px] mx-auto px-4 sm:px-6 py-6 space-y-6">
        
        {/* Header - inline, not imported */}
        <motion.div
          data-tour="mc-header"
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
              <motion.span
                initial={{ scaleX: 0 }}
                animate={{ scaleX: 1 }}
                transition={{ duration: 0.6, delay: 0.2 }}
                className="absolute -bottom-1.5 left-0 right-0 h-[2px] origin-left"
                style={{
                  background: `linear-gradient(90deg, ${DT.orange}, ${DT.gold}50, transparent)`,
                }}
              />
            </h1>
            <p className="text-[13px] text-neutral-500 mt-2">
              Anrufe & Space-Aktivität in Echtzeit
            </p>
          </div>
          <div 
            className="flex items-center gap-2 px-3 py-1.5 rounded-full self-start sm:self-auto"
            style={{
              background: 'rgba(34,197,94,0.08)',
              border: '1px solid rgba(34,197,94,0.2)',
            }}
          >
            <div className="w-1.5 h-1.5 rounded-full bg-green-500/80" />
            <span className="text-[11px] text-green-400/90 font-medium uppercase tracking-wide">
              Bereit
            </span>
          </div>
        </motion.div>

        {/* Mission Briefing */}
        <ModuleBoundary name="MissionBriefing" height={120}>
          <Suspense fallback={<DashboardModuleSkeleton title="Mission Briefing" height={120} />}>
            <MissionBriefing {...missionBriefingProps} />
          </Suspense>
        </ModuleBoundary>

        {/* Main Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* Left Column - Smart Inbox */}
          <div className="lg:col-span-2 space-y-6">
            <ModuleBoundary name="SmartInbox" height={400}>
              <Suspense fallback={<DashboardModuleSkeleton title="Smart Inbox" height={400} />}>
                <SmartInbox {...smartInboxProps} />
              </Suspense>
            </ModuleBoundary>
          </div>

          {/* Right Column */}
          <div className="space-y-6">
            
            {/* Contact Radar */}
            <ModuleBoundary name="ContactRadar" height={320}>
              <Suspense fallback={<DashboardModuleSkeleton title="Contact Radar" height={320} />}>
                <ContactRadar {...contactRadarProps} />
              </Suspense>
            </ModuleBoundary>

            {/* Today OS */}
            <ModuleBoundary name="TodayOS" height={280}>
              <Suspense fallback={<DashboardModuleSkeleton title="Today OS" height={280} />}>
                <TodayOS {...todayOSProps} />
              </Suspense>
            </ModuleBoundary>
          </div>
        </div>

        {/* Bottom Row - Matrix Panels */}
        <ModuleBoundary name="MatrixPanel" height={200}>
          <Suspense fallback={<DashboardModuleSkeleton title="System Status" height={200} />}>
            <MatrixPanel {...matrixProps} />
          </Suspense>
        </ModuleBoundary>
      </div>
    </div>
  );
}
