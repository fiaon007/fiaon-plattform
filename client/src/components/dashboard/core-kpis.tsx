/**
 * ARAS Mission Control - Core KPIs
 * Simplified KPI row with only 4 essential metrics
 * Calls, Campaigns, Contacts, Termine
 */

import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Phone, Megaphone, Users, Calendar, ChevronRight } from 'lucide-react';
import type { AllKpis } from '@/lib/dashboard/overview.schema';

const DT = {
  orange: '#ff6a00',
  gold: '#e9d7c4',
  panelBg: 'rgba(0,0,0,0.42)',
  panelBorder: 'rgba(255,255,255,0.08)',
};

interface CoreKpisProps {
  kpis: AllKpis;
  calendarToday?: number;
  calendarWeek?: number;
  period: 'today' | 'week' | 'month';
  onPeriodChange: (period: 'today' | 'week' | 'month') => void;
  onContactsClick?: () => void;
}

interface KpiCardProps {
  icon: React.ReactNode;
  label: string;
  value: number;
  subValue?: string;
  color: string;
  onClick?: () => void;
  clickable?: boolean;
}

function KpiCard({ icon, label, value, subValue, color, onClick, clickable }: KpiCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={clickable ? { scale: 1.02, y: -2 } : undefined}
      whileTap={clickable ? { scale: 0.98 } : undefined}
      onClick={onClick}
      className={`relative overflow-hidden rounded-xl p-4 transition-all ${clickable ? 'cursor-pointer' : ''}`}
      style={{
        background: DT.panelBg,
        border: `1px solid ${DT.panelBorder}`,
      }}
    >
      {/* Accent line */}
      <div 
        className="absolute top-0 left-0 right-0 h-1"
        style={{ background: `linear-gradient(90deg, ${color}, transparent)` }}
      />

      <div className="flex items-start justify-between">
        <div>
          <div 
            className="w-8 h-8 rounded-lg flex items-center justify-center mb-3"
            style={{ background: `${color}20` }}
          >
            <span style={{ color }}>{icon}</span>
          </div>
          <p className="text-[10px] text-white/40 uppercase tracking-wider mb-1">{label}</p>
          <p className="text-2xl font-bold text-white">{value.toLocaleString('de-DE')}</p>
          {subValue && (
            <p className="text-[10px] text-white/30 mt-0.5">{subValue}</p>
          )}
        </div>

        {clickable && (
          <ChevronRight size={16} className="text-white/20" />
        )}
      </div>
    </motion.div>
  );
}

export function CoreKpis({ kpis, calendarToday = 0, calendarWeek = 0, period, onPeriodChange, onContactsClick }: CoreKpisProps) {
  const getPeriodValue = (periodData: { today: number; week: number; month: number }) => {
    return periodData[period] || 0;
  };

  const callsValue = getPeriodValue(kpis.calls.successful);
  const callsTotal = getPeriodValue(kpis.calls.started);
  const contactsNew = getPeriodValue(kpis.contacts.new);
  const termineValue = period === 'today' ? calendarToday : calendarWeek;

  return (
    <div className="space-y-4">
      {/* Period Selector */}
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-medium text-white/60">Überblick</h2>
        <div className="flex gap-1 p-1 rounded-lg bg-white/5">
          {(['today', 'week', 'month'] as const).map((p) => (
            <button
              key={p}
              onClick={() => onPeriodChange(p)}
              className={`px-3 py-1.5 text-[10px] rounded-md transition-all uppercase tracking-wider font-medium ${
                period === p 
                  ? 'bg-white/10 text-white' 
                  : 'text-white/40 hover:text-white/60'
              }`}
            >
              {p === 'today' ? 'Heute' : p === 'week' ? '7 Tage' : '30 Tage'}
            </button>
          ))}
        </div>
      </div>

      {/* KPI Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KpiCard
          icon={<Phone size={16} />}
          label="Calls"
          value={callsValue}
          subValue={callsTotal > 0 ? `${callsTotal} gestartet` : undefined}
          color="#22c55e"
        />
        <KpiCard
          icon={<Megaphone size={16} />}
          label="Kampagnen"
          value={kpis.campaigns.active}
          subValue={kpis.campaigns.completed > 0 ? `${kpis.campaigns.completed} abgeschlossen` : undefined}
          color={DT.orange}
        />
        <KpiCard
          icon={<Users size={16} />}
          label="Kontakte"
          value={kpis.contacts.total}
          subValue={contactsNew > 0 ? `+${contactsNew} neu` : undefined}
          color="#3b82f6"
          onClick={onContactsClick}
          clickable={!!onContactsClick}
        />
        <KpiCard
          icon={<Calendar size={16} />}
          label="Termine"
          value={termineValue}
          subValue={period === 'today' ? 'heute' : 'diese Woche'}
          color="#8b5cf6"
        />
      </div>
    </div>
  );
}

export default CoreKpis;
