/**
 * ARAS Mission Control - Calendar Panel
 * Shows upcoming events with quick actions
 * Premium ARAS CI design
 */

import React from 'react';
import { motion } from 'framer-motion';
import { 
  Calendar, Clock, Video, MapPin, Plus, 
  ChevronRight, Link2, ExternalLink
} from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { asArray, safeTrim } from '@/lib/utils/safe';

const DT = {
  orange: '#ff6a00',
  gold: '#e9d7c4',
  panelBg: 'rgba(0,0,0,0.42)',
  panelBorder: 'rgba(255,255,255,0.08)',
};

interface CalendarEvent {
  id: string;
  title: string;
  start: string;
  end?: string;
  location?: string;
  meetingLink?: string;
  type?: 'meeting' | 'call' | 'task' | 'reminder';
}

interface CalendarPanelProps {
  className?: string;
}

function EventCard({ event, isToday }: { event: CalendarEvent; isToday: boolean }) {
  const startDate = new Date(event.start);
  const timeStr = startDate.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
  
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="group p-3 rounded-xl transition-all duration-200 hover:bg-white/5"
      style={{ borderLeft: `3px solid ${isToday ? DT.orange : DT.gold}40` }}
    >
      <div className="flex items-start gap-3">
        {/* Time */}
        <div className="text-center shrink-0 w-12">
          <p className="text-sm font-bold" style={{ color: isToday ? DT.orange : DT.gold }}>
            {timeStr}
          </p>
          <p className="text-[9px] text-white/30 uppercase">
            {isToday ? 'Heute' : startDate.toLocaleDateString('de-DE', { weekday: 'short' })}
          </p>
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <h4 className="text-sm font-medium text-white truncate">
            {event.title || 'Ohne Titel'}
          </h4>
          {event.location && (
            <p className="text-xs text-white/40 flex items-center gap-1 mt-1">
              <MapPin size={10} />
              {event.location}
            </p>
          )}
        </div>

        {/* Quick Action */}
        {event.meetingLink && (
          <a
            href={event.meetingLink}
            target="_blank"
            rel="noopener noreferrer"
            className="p-2 rounded-lg opacity-0 group-hover:opacity-100 transition-all hover:bg-white/10"
            title="Meeting beitreten"
          >
            <Video size={14} className="text-blue-400" />
          </a>
        )}
      </div>
    </motion.div>
  );
}

export function CalendarPanel({ className = '' }: CalendarPanelProps) {
  // Fetch calendar events
  const { data: eventsRaw = [], isLoading } = useQuery({
    queryKey: ['calendar-events-panel'],
    queryFn: async () => {
      const res = await fetch('/api/calendar/events', { credentials: 'include' });
      if (!res.ok) return [];
      return res.json();
    },
    staleTime: 60 * 1000,
  });

  const events = asArray(eventsRaw) as CalendarEvent[];
  
  // Filter to today + next 7 days
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const weekEnd = new Date(todayStart.getTime() + 7 * 24 * 60 * 60 * 1000);
  
  const upcomingEvents = events
    .filter(e => {
      const start = new Date(e.start);
      return start >= todayStart && start <= weekEnd;
    })
    .sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime())
    .slice(0, 5);

  const todayEvents = upcomingEvents.filter(e => {
    const start = new Date(e.start);
    const tomorrow = new Date(todayStart.getTime() + 24 * 60 * 60 * 1000);
    return start >= todayStart && start < tomorrow;
  });

  const isCalendarConnected = events.length > 0 || !isLoading;

  return (
    <div 
      className={`rounded-2xl overflow-hidden ${className}`}
      style={{ 
        background: DT.panelBg,
        border: `1px solid ${DT.panelBorder}`,
      }}
    >
      {/* Header */}
      <div className="p-4 border-b border-white/5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Calendar size={16} style={{ color: DT.orange }} />
            <h3 className="text-sm font-semibold text-white">Termine</h3>
            {todayEvents.length > 0 && (
              <span 
                className="px-2 py-0.5 text-[10px] rounded-full font-medium"
                style={{ background: `${DT.orange}22`, color: DT.orange }}
              >
                {todayEvents.length} heute
              </span>
            )}
          </div>
          <button
            onClick={() => window.location.href = '/app/calendar'}
            className="p-1.5 rounded-lg hover:bg-white/10 transition-colors"
            title="Kalender öffnen"
          >
            <ChevronRight size={14} className="text-white/40" />
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="p-2">
        {isLoading ? (
          <div className="space-y-2 p-2">
            {[1, 2, 3].map(i => (
              <div key={i} className="animate-pulse flex gap-3">
                <div className="w-12 h-8 bg-white/10 rounded" />
                <div className="flex-1">
                  <div className="h-4 w-3/4 bg-white/10 rounded mb-1" />
                  <div className="h-3 w-1/2 bg-white/5 rounded" />
                </div>
              </div>
            ))}
          </div>
        ) : upcomingEvents.length === 0 ? (
          <div className="text-center py-6 px-4">
            <Calendar size={32} className="mx-auto text-white/10 mb-2" />
            <p className="text-xs text-white/40 mb-3">
              {isCalendarConnected ? 'Keine Termine diese Woche' : 'Kalender nicht verbunden'}
            </p>
            <div className="flex flex-col gap-2">
              <button
                onClick={() => window.location.href = '/app/calendar?new=1'}
                className="px-3 py-2 text-xs rounded-lg transition-all hover:scale-[1.02] flex items-center justify-center gap-1.5"
                style={{ background: `${DT.orange}22`, color: DT.orange }}
              >
                <Plus size={12} />
                Termin anlegen
              </button>
              {!isCalendarConnected && (
                <button
                  onClick={() => window.location.href = '/app/settings?tab=integrations'}
                  className="px-3 py-2 text-xs rounded-lg text-white/40 hover:text-white/60 hover:bg-white/5 transition-all flex items-center justify-center gap-1.5"
                >
                  <Link2 size={12} />
                  Kalender verbinden
                </button>
              )}
            </div>
          </div>
        ) : (
          <div className="space-y-1">
            {upcomingEvents.map((event) => (
              <EventCard 
                key={event.id} 
                event={event}
                isToday={todayEvents.some(e => e.id === event.id)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Footer Quick Actions */}
      {upcomingEvents.length > 0 && (
        <div className="p-3 border-t border-white/5 flex gap-2">
          <button
            onClick={() => window.location.href = '/app/calendar?new=1'}
            className="flex-1 py-2 text-xs rounded-lg text-white/50 hover:text-white hover:bg-white/5 transition-all flex items-center justify-center gap-1.5"
          >
            <Plus size={12} />
            Neu
          </button>
          <button
            onClick={() => window.location.href = '/app/calendar'}
            className="flex-1 py-2 text-xs rounded-lg text-white/50 hover:text-white hover:bg-white/5 transition-all flex items-center justify-center gap-1.5"
          >
            <ExternalLink size={12} />
            Öffnen
          </button>
        </div>
      )}
    </div>
  );
}

export default CalendarPanel;
