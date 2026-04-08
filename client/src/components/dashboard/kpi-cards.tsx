/**
 * ARAS Mission Control - KPI Cards
 * Premium KPI display with ARAS CI design
 * Animated counters, subtle glow, micro-motion
 */

import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Phone, Megaphone, Users, MessageSquare, Database, Zap } from 'lucide-react';
import type { AllKpis } from '@/lib/dashboard/overview.schema';

// Design Tokens
const DT = {
  orange: '#ff6a00',
  gold: '#e9d7c4',
  panelBg: 'rgba(0,0,0,0.42)',
  panelBorder: 'rgba(255,255,255,0.08)',
  glow: '0 0 20px rgba(255,106,0,0.15)',
};

interface KpiCardsProps {
  kpis: AllKpis;
  period: 'today' | 'week' | 'month';
  onPeriodChange?: (period: 'today' | 'week' | 'month') => void;
  onContactsClick?: () => void;
}

interface KpiCardData {
  id: string;
  title: string;
  value: number;
  subtitle: string;
  icon: React.ReactNode;
  trend?: 'up' | 'down' | 'stable';
  trendValue?: string;
  color?: string;
  onClick?: () => void;
}

function AnimatedCounter({ value, duration = 1000 }: { value: number; duration?: number }) {
  const [displayValue, setDisplayValue] = useState(0);

  useEffect(() => {
    if (value === 0) {
      setDisplayValue(0);
      return;
    }

    const startTime = Date.now();
    const startValue = displayValue;
    
    const animate = () => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / duration, 1);
      // Easing function
      const eased = 1 - Math.pow(1 - progress, 3);
      const current = Math.round(startValue + (value - startValue) * eased);
      
      setDisplayValue(current);
      
      if (progress < 1) {
        requestAnimationFrame(animate);
      }
    };
    
    requestAnimationFrame(animate);
  }, [value, duration]);

  return <span>{displayValue}</span>;
}

function KpiCard({ data, index }: { data: KpiCardData; index: number }) {
  const trendColor = data.trend === 'up' ? '#22c55e' : data.trend === 'down' ? '#ef4444' : '#6b7280';
  const isClickable = !!data.onClick;
  
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: index * 0.05 }}
      onClick={data.onClick}
      className={`relative rounded-xl overflow-hidden group ${isClickable ? 'cursor-pointer' : ''}`}
      style={{
        background: DT.panelBg,
        border: `1px solid ${DT.panelBorder}`,
        backdropFilter: 'blur(20px)',
      }}
    >
      {/* Glow on hover */}
      <div 
        className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none"
        style={{ boxShadow: DT.glow }}
      />
      
      {/* Content */}
      <div className="p-4 relative z-10">
        <div className="flex items-start justify-between mb-3">
          <div 
            className="p-2 rounded-lg"
            style={{ 
              background: `rgba(255,106,0,0.12)`,
              color: data.color || DT.orange,
            }}
          >
            {data.icon}
          </div>
          
          {data.trend && data.trendValue && (
            <div 
              className="flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded"
              style={{ 
                background: `${trendColor}15`,
                color: trendColor,
              }}
            >
              {data.trend === 'up' ? '↑' : data.trend === 'down' ? '↓' : '→'}
              {data.trendValue}
            </div>
          )}
        </div>
        
        <div 
          className="text-2xl font-bold font-['Orbitron'] mb-1"
          style={{ color: data.color || DT.gold }}
        >
          <AnimatedCounter value={data.value} />
        </div>
        
        <div className="text-[11px] font-medium text-white/80 mb-0.5">
          {data.title}
        </div>
        
        <div className="text-[9px] text-white/40">
          {data.subtitle}
        </div>
      </div>
      
      {/* Bottom accent line */}
      <div 
        className="absolute bottom-0 left-0 right-0 h-[2px]"
        style={{ 
          background: `linear-gradient(90deg, transparent, ${data.color || DT.orange}40, transparent)`,
        }}
      />
    </motion.div>
  );
}

export function KpiCards({ kpis, period, onPeriodChange, onContactsClick }: KpiCardsProps) {
  const periodData = {
    today: kpis.calls.started.today,
    week: kpis.calls.started.week,
    month: kpis.calls.started.month,
  };

  // Only show the 4 most relevant KPIs (removed Spaces + Quota per user request)
  const cards: KpiCardData[] = [
    {
      id: 'calls',
      title: 'Calls',
      value: periodData[period],
      subtitle: `${kpis.calls.successful[period]} erfolgreich`,
      icon: <Phone size={18} />,
      trend: kpis.calls.started[period] > 0 ? 'up' : 'stable',
      trendValue: `${kpis.calls.successful[period]}/${periodData[period]}`,
      color: '#ff6a00',
    },
    {
      id: 'campaigns',
      title: 'Kampagnen',
      value: kpis.campaigns.active,
      subtitle: `${kpis.campaigns.completed} abgeschlossen`,
      icon: <Megaphone size={18} />,
      trend: kpis.campaigns.active > 0 ? 'up' : 'stable',
      trendValue: `${kpis.campaigns.active} aktiv`,
      color: '#f59e0b',
    },
    {
      id: 'contacts',
      title: 'Kontakte',
      value: kpis.contacts.total,
      subtitle: `${kpis.contacts.new[period]} neu ${period === 'today' ? 'heute' : period === 'week' ? 'diese Woche' : 'diesen Monat'}`,
      icon: <Users size={18} />,
      trend: kpis.contacts.new[period] > 0 ? 'up' : 'stable',
      trendValue: `+${kpis.contacts.new[period]}`,
      color: '#22c55e',
      onClick: onContactsClick, // Open drawer on click
    },
    {
      id: 'calendar',
      title: 'Termine',
      value: 0, // TODO: Connect to calendar data
      subtitle: 'Nächste 7 Tage',
      icon: <Database size={18} />,
      trend: 'stable',
      color: '#3b82f6',
    },
  ];

  return (
    <div className="space-y-4">
      {/* Period Selector */}
      {onPeriodChange && (
        <div className="flex items-center gap-2">
          {(['today', 'week', 'month'] as const).map((p) => (
            <button
              key={p}
              onClick={() => onPeriodChange(p)}
              className={`px-3 py-1.5 text-[10px] font-medium uppercase tracking-wider rounded-lg transition-all ${
                period === p 
                  ? 'bg-[#ff6a00]/20 text-[#ff6a00] border border-[#ff6a00]/30' 
                  : 'bg-white/5 text-white/50 border border-transparent hover:bg-white/10'
              }`}
            >
              {p === 'today' ? 'Heute' : p === 'week' ? '7 Tage' : '30 Tage'}
            </button>
          ))}
        </div>
      )}
      
      {/* KPI Grid - 4 cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {cards.map((card, index) => (
          <KpiCard key={card.id} data={card} index={index} />
        ))}
      </div>
    </div>
  );
}

export default KpiCards;
