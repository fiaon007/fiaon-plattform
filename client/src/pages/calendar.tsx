/**
 * ============================================================================
 * CALENDAR PAGE — EXECUTIVE TIME COMMAND CENTER (User Edition)
 * ============================================================================
 * Ported from Team Calendar design. User's personal events + Global overlay.
 * - 3 views: Day / Week / Month
 * - Premium Glassmorphism
 * - Global events (holidays, ARAS updates, markers) as read-only overlay
 * - Filter chips for global event categories
 * - Full CRUD for personal events via /api/calendar/events
 * ============================================================================
 */

import React, { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Calendar, Clock, Plus, X, Save, Trash2, Loader2,
  ChevronLeft, ChevronRight, Info, MapPin, Sparkles,
  Lock, Filter, Globe, CalendarDays, AlertCircle
} from 'lucide-react';
import {
  format, addDays, subDays, isToday, isSameDay, startOfDay,
  startOfWeek, endOfWeek, startOfMonth, endOfMonth,
  eachDayOfInterval, addWeeks, subWeeks, addMonths, subMonths,
  isSameMonth, parseISO
} from 'date-fns';
import { de } from 'date-fns/locale';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Sidebar } from '@/components/layout/sidebar';
import { TopBar } from '@/components/layout/topbar';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import type { SubscriptionResponse } from '@shared/schema';
import {
  getGlobalEvents2026,
  GLOBAL_EVENT_FILTERS,
  GLOBAL_EVENT_COLORS,
  GLOBAL_EVENT_LABELS,
  type GlobalEvent,
  type GlobalEventCategory,
} from '@/lib/global-events-2026';

// ============================================================================
// TYPES
// ============================================================================

interface PersonalEvent {
  id: string;
  title: string;
  description?: string;
  date: string;       // YYYY-MM-DD
  time: string;       // HH:mm
  duration: number;
  location?: string;
  attendees?: string;
  type: 'call' | 'meeting' | 'reminder' | 'other';
  status: 'scheduled' | 'completed' | 'cancelled';
  callId?: string;
  createdAt: string;
  updatedAt: string;
}

// Unified event for display
interface CalendarEvent {
  id: string;
  title: string;
  description?: string;
  date: Date;
  startTime?: string;
  endTime?: string;
  eventType: string;
  isGlobal: boolean;
  isReadOnly: boolean;
  category?: GlobalEventCategory;
  region?: string;
  location?: string;
  attendees?: string;
  callId?: string;
  personalEvent?: PersonalEvent; // original for editing
}

type CalendarView = 'day' | 'week' | 'month';
type DrawerMode = 'view' | 'edit' | 'create';

// ============================================================================
// COLORS
// ============================================================================

const EVENT_COLORS: Record<string, string> = {
  'call': '#FE9100',
  'meeting': '#e9d7c4',
  'reminder': '#a34e00',
  'other': '#6b7280',
  'holiday': '#6B7280',
  'holiday_regional': '#9CA3AF',
  'aras_update': '#FE9100',
  'marker': '#a34e00',
};

const EVENT_LABELS: Record<string, string> = {
  'call': 'Anruf',
  'meeting': 'Meeting',
  'reminder': 'Erinnerung',
  'other': 'Sonstige',
  'holiday': 'Feiertag',
  'holiday_regional': 'Regional',
  'aras_update': 'ARAS Update',
  'marker': 'Marker',
};

function getEventColor(event: CalendarEvent): string {
  if (event.isGlobal && event.category) {
    return GLOBAL_EVENT_COLORS[event.category] || '#6B7280';
  }
  return EVENT_COLORS[event.eventType] || '#FE9100';
}

// ============================================================================
// VIEW SWITCHER (from Team Calendar)
// ============================================================================

function ViewSwitcher({ currentView, onViewChange }: { currentView: CalendarView; onViewChange: (v: CalendarView) => void }) {
  const views: { id: CalendarView; label: string }[] = [
    { id: 'day', label: 'TAG' },
    { id: 'week', label: 'WOCHE' },
    { id: 'month', label: 'MONAT' },
  ];

  return (
    <div
      className="relative flex items-center"
      style={{
        height: '36px',
        borderRadius: '999px',
        background: 'rgba(255,255,255,0.03)',
        backdropFilter: 'blur(12px)',
        border: '1px solid rgba(233,215,196,0.12)',
        boxShadow: 'inset 0 1px 1px rgba(255,255,255,0.04)',
        padding: '3px',
      }}
    >
      {views.map((view) => {
        const isActive = currentView === view.id;
        return (
          <button
            key={view.id}
            onClick={() => onViewChange(view.id)}
            className="relative z-10 flex items-center justify-center transition-all duration-150"
            style={{
              height: '30px',
              padding: '0 14px',
              borderRadius: '999px',
              background: isActive
                ? 'linear-gradient(180deg, rgba(254,145,0,0.18), rgba(255,255,255,0.02))'
                : 'transparent',
              border: isActive ? '1px solid rgba(254,145,0,0.28)' : '1px solid transparent',
              boxShadow: isActive ? '0 0 16px rgba(254,145,0,0.22)' : 'none',
              fontFamily: 'Orbitron, sans-serif',
              fontSize: '11.5px',
              fontWeight: 700,
              letterSpacing: '0.18em',
              color: isActive ? '#FE9100' : 'rgba(233,215,196,0.72)',
            }}
          >
            {view.label}
          </button>
        );
      })}
    </div>
  );
}

// ============================================================================
// GLOBAL EVENT FILTER CHIPS
// ============================================================================

function GlobalFilterChips({
  activeFilters,
  onToggle,
}: {
  activeFilters: Set<GlobalEventCategory>;
  onToggle: (cat: GlobalEventCategory) => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="flex items-center gap-1 text-[10px]" style={{ color: 'rgba(255,255,255,0.4)' }}>
        <Globe className="w-3 h-3" />
      </span>
      {GLOBAL_EVENT_FILTERS.map((f) => {
        const isOn = activeFilters.has(f.id);
        const color = GLOBAL_EVENT_COLORS[f.id];
        return (
          <button
            key={f.id}
            onClick={() => onToggle(f.id)}
            className="transition-all duration-150"
            style={{
              height: '26px',
              padding: '0 10px',
              borderRadius: '999px',
              fontSize: '10px',
              fontWeight: 600,
              background: isOn ? `${color}18` : 'rgba(255,255,255,0.03)',
              border: isOn ? `1px solid ${color}40` : '1px solid rgba(255,255,255,0.06)',
              color: isOn ? color : 'rgba(255,255,255,0.45)',
            }}
          >
            {f.label}
          </button>
        );
      })}
    </div>
  );
}

// ============================================================================
// DAY PILL (from Team Calendar)
// ============================================================================

function DayPill({ date, isSelected, hasEvents, onClick }: {
  date: Date; isSelected: boolean; hasEvents: boolean; onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="flex flex-col items-center justify-center transition-all duration-150"
      style={{
        height: '52px',
        minWidth: '48px',
        padding: '0 12px',
        borderRadius: '14px',
        background: isSelected ? 'rgba(255,106,0,0.16)' : 'rgba(255,255,255,0.04)',
        border: isSelected ? '1px solid rgba(255,106,0,0.28)' : '1px solid rgba(255,255,255,0.06)',
        boxShadow: isSelected ? '0 0 20px rgba(255,106,0,0.12)' : 'none',
      }}
    >
      <span className="text-[10px] uppercase tracking-wider" style={{ color: isSelected ? '#ff6a00' : 'rgba(255,255,255,0.45)' }}>
        {format(date, 'EEE', { locale: de })}
      </span>
      <span className="text-[15px] font-semibold" style={{ color: isSelected ? '#ff6a00' : 'rgba(255,255,255,0.7)' }}>
        {format(date, 'd')}
      </span>
      {hasEvents && !isSelected && (
        <div className="w-1 h-1 rounded-full mt-0.5" style={{ background: '#FE9100' }} />
      )}
    </button>
  );
}

// ============================================================================
// EVENT CARD (from Team Calendar)
// ============================================================================

function EventCard({ event, onClick }: { event: CalendarEvent; onClick?: () => void }) {
  const color = getEventColor(event);
  const label = event.isGlobal && event.category
    ? GLOBAL_EVENT_LABELS[event.category]
    : EVENT_LABELS[event.eventType] || event.eventType;

  return (
    <button
      onClick={onClick}
      className="w-full text-left group transition-all duration-150"
      style={{
        background: 'rgba(255,255,255,0.03)',
        border: '1px solid rgba(255,255,255,0.08)',
        borderRadius: '14px',
        padding: '14px',
      }}
      onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.05)'; }}
      onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.03)'; }}
    >
      <div className="flex gap-3">
        <div className="w-[3px] rounded-full flex-shrink-0" style={{ background: color, minHeight: '40px' }} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <p className="text-[14px] font-semibold truncate" style={{ color: 'rgba(255,255,255,0.9)' }}>
              {event.title}
            </p>
            {event.isGlobal && (
              <Lock className="w-3 h-3 flex-shrink-0" style={{ color: 'rgba(255,255,255,0.3)' }} />
            )}
            {event.callId && (
              <Sparkles className="w-3.5 h-3.5 flex-shrink-0" style={{ color: '#FE9100' }} />
            )}
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {event.startTime && (
              <span className="text-[11px]" style={{ color: 'rgba(255,255,255,0.55)' }}>
                {event.startTime}{event.endTime ? ` – ${event.endTime}` : ''}
              </span>
            )}
            <span
              className="text-[10px] px-2 py-0.5 rounded-full"
              style={{ background: `${color}15`, color }}
            >
              {label}
            </span>
            {event.isGlobal && event.region && (
              <span className="text-[9px] px-1.5 py-0.5 rounded-full" style={{ background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.5)' }}>
                {event.region}
              </span>
            )}
          </div>
        </div>
      </div>
    </button>
  );
}

// ============================================================================
// EMPTY STATE
// ============================================================================

function CalendarEmptyState({ onAddEvent }: { onAddEvent?: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-10 text-center">
      <Calendar className="w-10 h-10 mb-3" style={{ color: 'rgba(255,255,255,0.12)' }} />
      <p className="text-[12px] mb-3" style={{ color: 'rgba(255,255,255,0.45)' }}>
        Keine Termine an diesem Tag
      </p>
      {onAddEvent && (
        <button
          onClick={onAddEvent}
          className="text-[11px] px-3 py-1.5 rounded-lg transition-colors"
          style={{ background: 'rgba(254,145,0,0.08)', border: '1px solid rgba(254,145,0,0.15)', color: '#FE9100' }}
        >
          Termin hinzufügen
        </button>
      )}
    </div>
  );
}

// ============================================================================
// WEEK VIEW
// ============================================================================

function WeekView({ selectedDate, events, onEventClick, onDayClick, onSlotClick }: {
  selectedDate: Date; events: CalendarEvent[];
  onEventClick: (e: CalendarEvent) => void; onDayClick: (d: Date) => void;
  onSlotClick?: (d: Date, h: number) => void;
}) {
  const [hoveredSlot, setHoveredSlot] = useState<{ day: string; hour: number } | null>(null);
  const weekStart = startOfWeek(selectedDate, { weekStartsOn: 1 });
  const weekEnd = endOfWeek(selectedDate, { weekStartsOn: 1 });
  const weekDays = eachDayOfInterval({ start: weekStart, end: weekEnd });
  const timeSlots = Array.from({ length: 14 }, (_, i) => i + 7);

  const eventsByDay = useMemo(() => {
    const grouped: Record<string, CalendarEvent[]> = {};
    weekDays.forEach(day => {
      const key = format(day, 'yyyy-MM-dd');
      grouped[key] = events
        .filter(e => isSameDay(e.date, day))
        .sort((a, b) => (a.startTime || '00:00').localeCompare(b.startTime || '00:00'));
    });
    return grouped;
  }, [events, weekStart, weekEnd]);

  const getEventPosition = (event: CalendarEvent) => {
    if (!event.startTime) return { top: 0, height: 30 };
    const [sH, sM] = event.startTime.split(':').map(Number);
    const [eH, eM] = (event.endTime || event.startTime).split(':').map(Number);
    const startOff = (sH - 7) * 60 + sM;
    const endOff = (eH - 7) * 60 + eM;
    return { top: (startOff / 60) * 40, height: Math.max(((Math.max(endOff - startOff, 15)) / 60) * 40, 22) };
  };

  return (
    <div className="flex gap-4">
      <div className="flex-1 min-w-0">
        <div
          className="overflow-x-auto relative"
          style={{
            background: 'rgba(255,255,255,0.02)', borderRadius: '14px',
            border: '1px solid rgba(255,255,255,0.06)',
          }}
        >
          <div className="flex border-b" style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
            <div className="w-12 flex-shrink-0" />
            {weekDays.map((day) => (
              <button key={day.toISOString()} onClick={() => onDayClick(day)}
                className="flex-1 min-w-[80px] py-2 text-center transition-colors"
                style={{ borderLeft: '1px solid rgba(233,215,196,0.08)', background: isToday(day) ? 'rgba(254,145,0,0.08)' : 'transparent' }}
              >
                <span className="text-[10px] uppercase block" style={{ color: isToday(day) ? '#FE9100' : 'rgba(255,255,255,0.45)' }}>
                  {format(day, 'EEE', { locale: de })}
                </span>
                <span className="text-[14px] font-semibold" style={{ color: isToday(day) ? '#FE9100' : 'rgba(255,255,255,0.8)' }}>
                  {format(day, 'd')}
                </span>
                {isToday(day) && <div className="w-1.5 h-1.5 rounded-full mx-auto mt-1" style={{ background: '#FE9100' }} />}
              </button>
            ))}
          </div>

          <div className="relative" style={{ height: '560px', overflow: 'hidden' }}>
            <div className="absolute inset-0 overflow-y-auto" style={{ scrollbarWidth: 'none' }}>
              {timeSlots.map((hour) => (
                <div key={hour} className="flex" style={{ height: '40px', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                  <div className="w-12 flex-shrink-0 text-right pr-2 pt-0.5" style={{ fontSize: '10px', color: 'rgba(255,255,255,0.35)' }}>
                    {hour.toString().padStart(2, '0')}
                  </div>
                  {weekDays.map((day) => {
                    const dayKey = format(day, 'yyyy-MM-dd');
                    const isHovered = hoveredSlot?.day === dayKey && hoveredSlot?.hour === hour;
                    return (
                      <div key={`${hour}-${day.toISOString()}`}
                        className="flex-1 min-w-[80px] relative cursor-pointer group"
                        style={{ borderLeft: '1px solid rgba(233,215,196,0.08)', background: isHovered ? 'rgba(254,145,0,0.08)' : 'transparent', transition: 'background 0.15s ease' }}
                        onMouseEnter={() => setHoveredSlot({ day: dayKey, hour })}
                        onMouseLeave={() => setHoveredSlot(null)}
                        onClick={() => onSlotClick?.(day, hour)}
                      >
                        {isHovered && (
                          <div className="absolute inset-1 flex items-center justify-center rounded-md pointer-events-none"
                            style={{ border: '1px dashed rgba(254,145,0,0.28)', background: 'rgba(254,145,0,0.04)' }}>
                            <span className="text-[9px] opacity-60" style={{ color: '#FE9100' }}>+ Termin</span>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              ))}

              <div className="absolute inset-0 flex pointer-events-none" style={{ left: '48px' }}>
                {weekDays.map((day, dayIndex) => {
                  const dayKey = format(day, 'yyyy-MM-dd');
                  const dayEvents = (eventsByDay[dayKey] || []).filter(e => e.startTime);
                  return (
                    <div key={day.toISOString()} className="flex-1 min-w-[80px] relative" style={{ borderLeft: dayIndex > 0 ? '1px solid transparent' : 'none' }}>
                      {dayEvents.map((event, idx) => {
                        const pos = getEventPosition(event);
                        const color = getEventColor(event);
                        return (
                          <button key={event.id} onClick={() => onEventClick(event)}
                            className="absolute left-1 right-1 overflow-hidden text-left transition-all pointer-events-auto"
                            style={{
                              top: `${pos.top}px`, height: `${pos.height}px`,
                              background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(8px)',
                              border: '1px solid rgba(233,215,196,0.10)', borderLeft: `3px solid ${color}`,
                              borderRadius: '8px', padding: '4px 6px', zIndex: idx + 1,
                            }}
                          >
                            <p className="text-[11px] font-medium truncate" style={{ color: 'rgba(255,255,255,0.9)' }}>{event.title}</p>
                            {pos.height > 30 && event.startTime && (
                              <p className="text-[9px] truncate" style={{ color: 'rgba(255,255,255,0.5)' }}>{event.startTime}</p>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="w-[240px] flex-shrink-0 hidden lg:block" style={{ background: 'rgba(255,255,255,0.02)', borderRadius: '14px', border: '1px solid rgba(255,255,255,0.06)', padding: '12px' }}>
        <h3 className="text-[10px] tracking-[0.18em] mb-3" style={{ fontFamily: 'Orbitron, sans-serif', color: 'rgba(255,255,255,0.55)' }}>
          DIESE WOCHE
        </h3>
        <div className="space-y-3 overflow-y-auto" style={{ maxHeight: '500px', scrollbarWidth: 'none' }}>
          {weekDays.map((day) => {
            const dayKey = format(day, 'yyyy-MM-dd');
            const dayEvents = eventsByDay[dayKey] || [];
            if (dayEvents.length === 0) return null;
            return (
              <div key={day.toISOString()}>
                <p className="text-[10px] font-medium mb-1.5" style={{ color: isToday(day) ? '#FE9100' : 'rgba(255,255,255,0.5)' }}>
                  {format(day, 'EEE d. MMM', { locale: de })}
                </p>
                <div className="space-y-1.5">
                  {dayEvents.slice(0, 4).map((event) => {
                    const color = getEventColor(event);
                    return (
                      <button key={event.id} onClick={() => onEventClick(event)} className="w-full text-left p-2 rounded-lg transition-colors"
                        style={{ background: 'rgba(255,255,255,0.03)', borderLeft: `2px solid ${color}` }}
                        onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.06)'; }}
                        onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.03)'; }}
                      >
                        <p className="text-[11px] font-medium truncate" style={{ color: 'rgba(255,255,255,0.85)' }}>{event.title}</p>
                        {event.startTime && <p className="text-[9px]" style={{ color: 'rgba(255,255,255,0.45)' }}>{event.startTime}</p>}
                      </button>
                    );
                  })}
                  {dayEvents.length > 4 && <p className="text-[9px] pl-2" style={{ color: 'rgba(255,255,255,0.4)' }}>+{dayEvents.length - 4} weitere</p>}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// MONTH VIEW
// ============================================================================

function MonthView({ selectedDate, events, onEventClick, onDayClick, onCellClick }: {
  selectedDate: Date; events: CalendarEvent[];
  onEventClick: (e: CalendarEvent) => void; onDayClick: (d: Date) => void;
  onCellClick?: (d: Date) => void;
}) {
  const [hoveredDay, setHoveredDay] = useState<string | null>(null);
  const monthStart = startOfMonth(selectedDate);
  const monthEnd = endOfMonth(selectedDate);
  const calendarStart = startOfWeek(monthStart, { weekStartsOn: 1 });
  const calendarEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });
  const calendarDays = eachDayOfInterval({ start: calendarStart, end: calendarEnd });

  const eventsByDay = useMemo(() => {
    const grouped: Record<string, CalendarEvent[]> = {};
    calendarDays.forEach(day => {
      const key = format(day, 'yyyy-MM-dd');
      grouped[key] = events.filter(e => isSameDay(e.date, day)).sort((a, b) => (a.startTime || '00:00').localeCompare(b.startTime || '00:00'));
    });
    return grouped;
  }, [events, calendarDays]);

  return (
    <div style={{ background: 'rgba(255,255,255,0.02)', borderRadius: '14px', border: '1px solid rgba(255,255,255,0.06)', overflow: 'hidden' }}>
      <div className="grid grid-cols-7 border-b" style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
        {['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'].map((name) => (
          <div key={name} className="py-2 text-center" style={{ fontSize: '10px', color: 'rgba(255,255,255,0.45)', fontWeight: 500 }}>
            {name}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7">
        {calendarDays.map((day) => {
          const dayKey = format(day, 'yyyy-MM-dd');
          const dayEvents = eventsByDay[dayKey] || [];
          const isCurrentMonth = isSameMonth(day, selectedDate);
          const isTodayDate = isToday(day);
          const isHovered = hoveredDay === dayKey;

          return (
            <div key={day.toISOString()} className="relative text-left transition-colors group cursor-pointer"
              style={{
                minHeight: '80px', padding: '6px',
                borderRight: '1px solid rgba(255,255,255,0.04)', borderBottom: '1px solid rgba(255,255,255,0.04)',
                background: isTodayDate ? 'rgba(254,145,0,0.06)' : isHovered ? 'rgba(255,255,255,0.03)' : 'transparent',
                opacity: isCurrentMonth ? 1 : 0.4,
              }}
              onMouseEnter={() => setHoveredDay(dayKey)}
              onMouseLeave={() => setHoveredDay(null)}
              onClick={() => onCellClick?.(day)}
            >
              {isTodayDate ? (
                <span className="absolute top-1 left-1 w-6 h-6 rounded-full flex items-center justify-center"
                  style={{ border: '2px solid #FE9100', background: 'rgba(254,145,0,0.15)' }}>
                  <span style={{ color: '#FE9100', fontSize: '12px', fontWeight: 600 }}>{format(day, 'd')}</span>
                </span>
              ) : (
                <span className="text-[12px] font-medium" style={{ color: isCurrentMonth ? 'rgba(255,255,255,0.8)' : 'rgba(255,255,255,0.3)' }}>
                  {format(day, 'd')}
                </span>
              )}

              <div className="mt-1 space-y-0.5" style={{ marginTop: isTodayDate ? '24px' : '4px' }}>
                {dayEvents.slice(0, 3).map((event) => {
                  const color = getEventColor(event);
                  return (
                    <div key={event.id} className="truncate text-[9px] px-1.5 py-0.5 rounded"
                      style={{ background: `${color}20`, color, border: `1px solid ${color}30` }}
                      onClick={(e) => { e.stopPropagation(); onEventClick(event); }}
                    >
                      {event.title}
                    </div>
                  );
                })}
                {dayEvents.length > 3 && (
                  <div className="text-[9px] px-1.5" style={{ color: 'rgba(255,255,255,0.5)' }}>+{dayEvents.length - 3} mehr</div>
                )}
              </div>

              {isHovered && isCurrentMonth && (
                <div className="absolute bottom-1 right-1 w-5 h-5 flex items-center justify-center rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                  style={{ background: 'rgba(254,145,0,0.15)', border: '1px dashed rgba(254,145,0,0.4)' }}>
                  <Plus className="w-3 h-3" style={{ color: '#FE9100' }} />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ============================================================================
// EVENT DETAIL DRAWER
// ============================================================================

function EventDetailDrawer({ event, isOpen, mode, onClose, onSave, onDelete, isSaving, isDeleting }: {
  event: CalendarEvent | null; isOpen: boolean; mode: DrawerMode;
  onClose: () => void; onSave: (data: any) => void; onDelete: (id: string) => void;
  isSaving?: boolean; isDeleting?: boolean;
}) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [eventDate, setEventDate] = useState('');
  const [startTime, setStartTime] = useState('09:00');
  const [endTime, setEndTime] = useState('10:00');
  const [location, setLocation] = useState('');
  const [attendees, setAttendees] = useState('');
  const [eventType, setEventType] = useState('meeting');

  const isEditing = mode === 'edit' || mode === 'create';
  const isCreate = mode === 'create';

  useEffect(() => {
    if (event) {
      setTitle(event.title || '');
      setDescription(event.description || '');
      setEventDate(event.date ? format(event.date, 'yyyy-MM-dd') : format(new Date(), 'yyyy-MM-dd'));
      setStartTime(event.startTime || '09:00');
      setEndTime(event.endTime || '10:00');
      setLocation(event.location || '');
      setAttendees(event.attendees || '');
      setEventType(event.eventType || 'meeting');
    }
  }, [event]);

  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => { if (e.key === 'Escape' && isOpen) onClose(); };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [isOpen, onClose]);

  const handleSave = () => {
    if (!title.trim()) return;
    const [sH, sM] = startTime.split(':').map(Number);
    const [eH, eM] = endTime.split(':').map(Number);
    const durationMin = Math.max((eH * 60 + eM) - (sH * 60 + sM), 15);

    onSave({
      title: title.trim(),
      description: description.trim() || undefined,
      date: eventDate,
      time: startTime,
      duration: durationMin,
      location: location.trim() || undefined,
      attendees: attendees.trim() || undefined,
      type: eventType,
      status: 'scheduled',
    });
  };

  if (!event) return null;

  const color = getEventColor(event);
  const label = event.isGlobal && event.category ? GLOBAL_EVENT_LABELS[event.category] : EVENT_LABELS[event.eventType] || 'Termin';

  const drawerContent = (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }} className="fixed inset-0 z-[9998]"
            style={{ background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(6px)' }} onClick={onClose} />

          <motion.div initial={{ x: '100%', opacity: 0 }} animate={{ x: 0, opacity: 1 }}
            exit={{ x: '100%', opacity: 0 }} transition={{ type: 'spring', damping: 30, stiffness: 300 }}
            className="fixed z-[9999] flex flex-col"
            style={{
              top: '12px', right: '12px', width: 'min(560px, 94vw)', height: 'calc(100vh - 24px)',
              background: 'rgba(0,0,0,0.94)', backdropFilter: 'blur(20px)',
              border: '1px solid rgba(255,106,0,0.22)', borderRadius: '24px',
              boxShadow: '0 40px 140px rgba(0,0,0,0.9)',
            }}
          >
            {/* Header */}
            <div className="flex-shrink-0 p-6 pb-4" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  {isEditing ? (
                    <input type="text" value={title} onChange={(e) => setTitle(e.target.value)}
                      placeholder="Titel eingeben..." autoFocus
                      className="w-full text-[20px] font-semibold leading-tight mb-2 bg-transparent outline-none"
                      style={{ color: 'rgba(255,255,255,0.95)', borderBottom: '1px solid rgba(255,255,255,0.2)', paddingBottom: '4px' }} />
                  ) : (
                    <h2 className="text-[20px] font-semibold leading-tight mb-2" style={{ color: 'rgba(255,255,255,0.95)' }}>
                      {event.title}
                    </h2>
                  )}
                  <div className="flex items-center gap-2">
                    <span className="inline-flex items-center text-[10px] tracking-[0.22em] px-3"
                      style={{ height: '26px', borderRadius: '999px', background: `${color}18`, color, fontFamily: 'Orbitron, sans-serif' }}>
                      {label.toUpperCase()}
                    </span>
                    {event.isGlobal && (
                      <span className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full"
                        style={{ background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.5)' }}>
                        <Lock className="w-3 h-3" /> Global (read-only)
                      </span>
                    )}
                    {event.region && (
                      <span className="text-[10px] px-2 py-0.5 rounded-full" style={{ background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.5)' }}>
                        {event.region}
                      </span>
                    )}
                  </div>
                </div>
                <button onClick={onClose} className="flex-shrink-0 flex items-center justify-center transition-colors"
                  style={{ width: '36px', height: '36px', borderRadius: '12px', background: 'rgba(255,255,255,0.04)' }}>
                  <X className="w-5 h-5" style={{ color: 'rgba(255,255,255,0.6)' }} />
                </button>
              </div>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6" style={{ scrollbarWidth: 'none' }}>
              {/* Time & Date */}
              <div>
                <label className="block text-[10px] tracking-[0.18em] mb-3" style={{ fontFamily: 'Orbitron, sans-serif', color: 'rgba(255,255,255,0.55)' }}>
                  ZEIT & DATUM
                </label>
                <div className="p-4" style={{ background: 'rgba(255,255,255,0.04)', borderRadius: '14px' }}>
                  {isEditing ? (
                    <div className="space-y-3">
                      <input type="date" value={eventDate} onChange={(e) => setEventDate(e.target.value)}
                        className="w-full px-3 py-2 rounded-lg bg-transparent outline-none"
                        style={{ border: '1px solid rgba(255,255,255,0.15)', color: 'rgba(255,255,255,0.9)', fontSize: '14px' }} />
                      <div className="flex gap-3">
                        <div className="flex-1">
                          <label className="block text-[10px] mb-1" style={{ color: 'rgba(255,255,255,0.5)' }}>Von</label>
                          <input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)}
                            className="w-full px-3 py-2 rounded-lg bg-transparent outline-none"
                            style={{ border: '1px solid rgba(255,255,255,0.15)', color: 'rgba(255,255,255,0.9)', fontSize: '14px' }} />
                        </div>
                        <div className="flex-1">
                          <label className="block text-[10px] mb-1" style={{ color: 'rgba(255,255,255,0.5)' }}>Bis</label>
                          <input type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)}
                            className="w-full px-3 py-2 rounded-lg bg-transparent outline-none"
                            style={{ border: '1px solid rgba(255,255,255,0.15)', color: 'rgba(255,255,255,0.9)', fontSize: '14px' }} />
                        </div>
                      </div>
                    </div>
                  ) : (
                    <>
                      <p className="text-[15px] font-medium mb-1" style={{ color: 'rgba(255,255,255,0.9)' }}>
                        {format(event.date, 'EEEE, d. MMMM yyyy', { locale: de })}
                      </p>
                      {event.startTime && (
                        <p className="text-[13px]" style={{ color: 'rgba(255,255,255,0.6)' }}>
                          {event.startTime}{event.endTime ? ` – ${event.endTime}` : ''}
                        </p>
                      )}
                    </>
                  )}
                </div>
              </div>

              {/* Type (edit only) */}
              {isEditing && (
                <div>
                  <label className="block text-[10px] tracking-[0.18em] mb-3" style={{ fontFamily: 'Orbitron, sans-serif', color: 'rgba(255,255,255,0.55)' }}>TYP</label>
                  <select value={eventType} onChange={(e) => setEventType(e.target.value)}
                    className="text-[11px] px-3 py-1.5 rounded-full outline-none cursor-pointer"
                    style={{ background: 'rgba(254,145,0,0.15)', color: '#FE9100', border: '1px solid rgba(254,145,0,0.3)' }}>
                    <option value="meeting">Meeting</option>
                    <option value="call">Anruf</option>
                    <option value="reminder">Erinnerung</option>
                    <option value="other">Sonstige</option>
                  </select>
                </div>
              )}

              {/* Description */}
              <div>
                <label className="block text-[10px] tracking-[0.18em] mb-3" style={{ fontFamily: 'Orbitron, sans-serif', color: 'rgba(255,255,255,0.55)' }}>BESCHREIBUNG</label>
                {isEditing ? (
                  <textarea value={description} onChange={(e) => setDescription(e.target.value)}
                    placeholder="Beschreibung hinzufügen…" className="w-full resize-none outline-none"
                    style={{ minHeight: '120px', padding: '14px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.10)', borderRadius: '14px', color: 'rgba(255,255,255,0.85)', fontSize: '13px', lineHeight: '1.6' }} />
                ) : (
                  <p className="text-[13px] leading-relaxed" style={{ color: event.description ? 'rgba(255,255,255,0.65)' : 'rgba(255,255,255,0.3)' }}>
                    {event.description || 'Keine Beschreibung'}
                  </p>
                )}
              </div>

              {/* Location & Attendees (edit) */}
              {isEditing && (
                <>
                  <div>
                    <label className="block text-[10px] tracking-[0.18em] mb-3" style={{ fontFamily: 'Orbitron, sans-serif', color: 'rgba(255,255,255,0.55)' }}>ORT</label>
                    <input type="text" value={location} onChange={(e) => setLocation(e.target.value)} placeholder="Optional"
                      className="w-full px-3 py-2 rounded-lg bg-transparent outline-none"
                      style={{ border: '1px solid rgba(255,255,255,0.15)', color: 'rgba(255,255,255,0.9)', fontSize: '14px' }} />
                  </div>
                  <div>
                    <label className="block text-[10px] tracking-[0.18em] mb-3" style={{ fontFamily: 'Orbitron, sans-serif', color: 'rgba(255,255,255,0.55)' }}>TEILNEHMER</label>
                    <input type="text" value={attendees} onChange={(e) => setAttendees(e.target.value)} placeholder="Optional"
                      className="w-full px-3 py-2 rounded-lg bg-transparent outline-none"
                      style={{ border: '1px solid rgba(255,255,255,0.15)', color: 'rgba(255,255,255,0.9)', fontSize: '14px' }} />
                  </div>
                </>
              )}

              {/* Location & Attendees (view) */}
              {!isEditing && (event.location || event.attendees) && (
                <div className="space-y-2">
                  {event.location && (
                    <div className="flex items-center gap-2">
                      <MapPin className="w-3.5 h-3.5" style={{ color: 'rgba(255,255,255,0.4)' }} />
                      <span className="text-[12px]" style={{ color: 'rgba(255,255,255,0.6)' }}>{event.location}</span>
                    </div>
                  )}
                  {event.attendees && (
                    <div className="flex items-center gap-2">
                      <CalendarDays className="w-3.5 h-3.5" style={{ color: 'rgba(255,255,255,0.4)' }} />
                      <span className="text-[12px]" style={{ color: 'rgba(255,255,255,0.6)' }}>{event.attendees}</span>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="flex-shrink-0 p-6 pt-4 flex items-center justify-between gap-4" style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
              <div>
                {!isCreate && !event.isGlobal && !event.isReadOnly && (
                  <button onClick={() => onDelete(event.id)} disabled={isDeleting}
                    className="flex items-center gap-2 px-4 transition-colors"
                    style={{ height: '42px', borderRadius: '14px', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.15)', color: 'rgba(239,68,68,0.7)', fontSize: '13px' }}>
                    {isDeleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                    Löschen
                  </button>
                )}
              </div>
              <div className="flex items-center gap-3">
                <button onClick={onClose} className="px-5 transition-colors"
                  style={{ height: '42px', borderRadius: '14px', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.7)', fontSize: '13px' }}>
                  {isEditing ? 'Abbrechen' : 'Schließen'}
                </button>
                {isEditing && (
                  <button onClick={handleSave} disabled={isSaving || !title.trim()}
                    className="flex items-center gap-2 px-5 transition-colors"
                    style={{
                      height: '42px', borderRadius: '14px',
                      background: (isSaving || !title.trim()) ? 'rgba(254,145,0,0.3)' : 'linear-gradient(135deg, #FE9100, #e67e00)',
                      color: 'white', fontSize: '13px', fontWeight: 500,
                      opacity: (isSaving || !title.trim()) ? 0.6 : 1,
                    }}>
                    {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                    {isCreate ? 'Erstellen' : 'Speichern'}
                  </button>
                )}
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );

  if (typeof document !== 'undefined') {
    return createPortal(drawerContent, document.body);
  }
  return null;
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export default function CalendarPage() {
  const { user, isLoading: authLoading } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  // Calendar state
  const [calendarView, setCalendarView] = useState<CalendarView>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('aras.calendar.view');
      if (saved === 'day' || saved === 'week' || saved === 'month') return saved;
    }
    return 'week';
  });
  const [selectedDate, setSelectedDate] = useState<Date>(startOfDay(new Date()));
  const [weekOffset, setWeekOffset] = useState(0);
  const [currentTime, setCurrentTime] = useState(new Date());

  // Drawer state
  const [drawerEvent, setDrawerEvent] = useState<CalendarEvent | null>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [drawerMode, setDrawerMode] = useState<DrawerMode>('view');

  // Global event filters
  const [activeGlobalFilters, setActiveGlobalFilters] = useState<Set<GlobalEventCategory>>(() => {
    const s = new Set<GlobalEventCategory>();
    GLOBAL_EVENT_FILTERS.forEach(f => { if (f.defaultOn) s.add(f.id); });
    return s;
  });

  // Persist view
  useEffect(() => {
    if (typeof window !== 'undefined') localStorage.setItem('aras.calendar.view', calendarView);
  }, [calendarView]);

  // Live clock
  useEffect(() => {
    const interval = setInterval(() => setCurrentTime(new Date()), 60000);
    return () => clearInterval(interval);
  }, []);

  // Current displayed month for API range
  const displayMonth = useMemo(() => {
    if (calendarView === 'month') return selectedDate;
    return selectedDate;
  }, [selectedDate, calendarView]);

  // Fetch personal events (3-month window for smooth nav)
  const fetchStart = format(subMonths(startOfMonth(displayMonth), 1), 'yyyy-MM-dd');
  const fetchEnd = format(addMonths(endOfMonth(displayMonth), 1), 'yyyy-MM-dd');

  const { data: personalEvents = [], isLoading } = useQuery<PersonalEvent[]>({
    queryKey: ['/api/calendar/events', fetchStart, fetchEnd],
    queryFn: async () => {
      try {
        const res = await fetch(`/api/calendar/events?start=${fetchStart}&end=${fetchEnd}`, { credentials: 'include' });
        if (!res.ok) return [];
        const data = await res.json();
        return Array.isArray(data) ? data : [];
      } catch { return []; }
    },
    enabled: !!user,
    staleTime: 30000,
  });

  // Subscription data
  const { data: subscription } = useQuery<SubscriptionResponse>({
    queryKey: ['/api/user/subscription'],
    queryFn: async () => {
      try {
        const res = await fetch('/api/user/subscription', { credentials: 'include' });
        if (!res.ok) return null as any;
        return await res.json();
      } catch { return null as any; }
    },
    enabled: !!user && !authLoading,
    retry: false,
  });

  const subscriptionData = subscription || {
    plan: 'pro', status: 'active', aiMessagesUsed: 0, voiceCallsUsed: 0,
    aiMessagesLimit: null, voiceCallsLimit: null, renewalDate: new Date().toISOString(),
    trialMessagesUsed: 0, trialEndDate: null, hasPaymentMethod: false,
    requiresPaymentSetup: false, isTrialActive: false, canUpgrade: true,
  } as SubscriptionResponse;

  // Transform personal events to CalendarEvent
  const personalCalEvents: CalendarEvent[] = useMemo(() => {
    return personalEvents.map((e) => {
      const [hours, minutes] = (e.time || '09:00').split(':').map(Number);
      const endMinutes = hours * 60 + minutes + (e.duration || 60);
      const endH = Math.floor(endMinutes / 60);
      const endM = endMinutes % 60;
      return {
        id: e.id,
        title: e.title,
        description: e.description,
        date: parseISO(e.date),
        startTime: e.time,
        endTime: `${endH.toString().padStart(2, '0')}:${endM.toString().padStart(2, '0')}`,
        eventType: e.type,
        isGlobal: false,
        isReadOnly: false,
        location: e.location,
        attendees: e.attendees,
        callId: e.callId,
        personalEvent: e,
      };
    });
  }, [personalEvents]);

  // Transform global events to CalendarEvent (filtered)
  const globalCalEvents: CalendarEvent[] = useMemo(() => {
    return getGlobalEvents2026()
      .filter(g => activeGlobalFilters.has(g.category))
      .map(g => ({
        id: g.id,
        title: g.title,
        description: g.description,
        date: parseISO(g.date),
        startTime: undefined,
        endTime: undefined,
        eventType: g.category,
        isGlobal: true,
        isReadOnly: true,
        category: g.category,
        region: g.region,
      }));
  }, [activeGlobalFilters]);

  // Merged events
  const allEvents = useMemo(() => [...personalCalEvents, ...globalCalEvents], [personalCalEvents, globalCalEvents]);

  // CRUD mutations
  const createMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await fetch('/api/calendar/events', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        credentials: 'include', body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error('Failed');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/calendar/events'] });
      toast({ title: 'Termin erstellt', description: 'Neuer Termin wurde hinzugefügt.' });
      closeDrawer();
    },
    onError: () => toast({ title: 'Fehler', description: 'Termin konnte nicht erstellt werden.', variant: 'destructive' }),
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, ...data }: any) => {
      const res = await fetch(`/api/calendar/events/${id}`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        credentials: 'include', body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error('Failed');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/calendar/events'] });
      toast({ title: 'Gespeichert', description: 'Termin wurde aktualisiert.' });
      closeDrawer();
    },
    onError: () => toast({ title: 'Fehler', description: 'Änderungen konnten nicht gespeichert werden.', variant: 'destructive' }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/calendar/events/${id}`, { method: 'DELETE', credentials: 'include' });
      if (!res.ok) throw new Error('Failed');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/calendar/events'] });
      toast({ title: 'Gelöscht', description: 'Termin wurde entfernt.' });
      closeDrawer();
    },
  });

  // AI call processing
  const [isProcessingAI, setIsProcessingAI] = useState(false);

  useEffect(() => {
    if (!user) return;
    const checkRecentCalls = async () => {
      try {
        const res = await fetch('/api/calendar/check-recent-calls', { credentials: 'include' });
        if (res.ok) {
          const data = await res.json();
          if (data.hasUnprocessedCalls) {
            toast({
              title: 'AI Terminvorschläge verfügbar',
              description: 'Es gibt neue Anrufe. Möchten Sie Termine daraus erstellen?',
            });
          }
        }
      } catch {}
    };
    checkRecentCalls();
  }, [user]);

  const processCallsWithAI = async () => {
    setIsProcessingAI(true);
    try {
      const res = await fetch('/api/calendar/ai-process-calls', { method: 'POST', credentials: 'include' });
      if (!res.ok) { toast({ title: 'Fehler', description: 'AI Verarbeitung fehlgeschlagen.', variant: 'destructive' }); return; }
      const data = await res.json();
      queryClient.invalidateQueries({ queryKey: ['/api/calendar/events'] });
      toast({ title: 'AI Verarbeitung erfolgreich', description: `${data.eventsCreated} Termine wurden erstellt.` });
    } catch {
      toast({ title: 'Fehler', description: 'AI Verarbeitung fehlgeschlagen.', variant: 'destructive' });
    } finally { setIsProcessingAI(false); }
  };

  // Handlers
  const handleEventClick = useCallback((event: CalendarEvent) => {
    setDrawerEvent(event);
    setDrawerMode(event.isGlobal ? 'view' : 'view');
    setIsDrawerOpen(true);
  }, []);

  const handleCreateEvent = useCallback((date?: Date) => {
    const d = date || selectedDate;
    const newEvent: CalendarEvent = {
      id: 'new', title: '', description: '', date: d,
      startTime: '09:00', endTime: '10:00', eventType: 'meeting',
      isGlobal: false, isReadOnly: false,
    };
    setDrawerEvent(newEvent);
    setDrawerMode('create');
    setIsDrawerOpen(true);
  }, [selectedDate]);

  const handleSlotClick = useCallback((date: Date, hour: number) => {
    const st = `${hour.toString().padStart(2, '0')}:00`;
    const eh = Math.min(hour + 1, 20);
    const et = `${eh.toString().padStart(2, '0')}:00`;
    const newEvent: CalendarEvent = {
      id: 'new', title: '', date, startTime: st, endTime: et,
      eventType: 'meeting', isGlobal: false, isReadOnly: false,
    };
    setDrawerEvent(newEvent);
    setDrawerMode('create');
    setIsDrawerOpen(true);
  }, []);

  const handleCellClick = useCallback((date: Date) => {
    handleCreateEvent(date);
  }, [handleCreateEvent]);

  const closeDrawer = useCallback(() => {
    setIsDrawerOpen(false);
    setDrawerMode('view');
    setTimeout(() => setDrawerEvent(null), 200);
  }, []);

  const handleDayClick = useCallback((date: Date) => {
    setSelectedDate(date);
    setCalendarView('day');
    setWeekOffset(0);
  }, []);

  const toggleGlobalFilter = useCallback((cat: GlobalEventCategory) => {
    setActiveGlobalFilters(prev => {
      const next = new Set(prev);
      if (next.has(cat)) next.delete(cat); else next.add(cat);
      return next;
    });
  }, []);

  // Day navigation pills
  const days = useMemo(() => {
    const baseDate = addDays(startOfDay(new Date()), weekOffset * 7);
    return Array.from({ length: 7 }, (_, i) => addDays(baseDate, i - 3));
  }, [weekOffset]);

  const selectedDayEvents = useMemo(() => {
    return allEvents.filter(e => isSameDay(e.date, selectedDate))
      .sort((a, b) => { if (!a.startTime && !b.startTime) return 0; if (!a.startTime) return 1; if (!b.startTime) return -1; return a.startTime.localeCompare(b.startTime); });
  }, [allEvents, selectedDate]);

  const hasEventsOnDay = (date: Date) => allEvents.some(e => isSameDay(e.date, date));

  const currentMonthYear = format(selectedDate, 'MMMM yyyy', { locale: de }).toUpperCase();

  // Loading
  if (authLoading || !user) {
    return (
      <div className="flex h-screen items-center justify-center bg-black">
        <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}>
          <CalendarDays className="w-12 h-12" style={{ color: '#FE9100' }} />
        </motion.div>
      </div>
    );
  }

  return (
    <div className="flex h-screen relative overflow-hidden bg-transparent">
      <Sidebar activeSection="calendar" onSectionChange={(section) => window.location.href = `/app/${section}`}
        isCollapsed={sidebarCollapsed} onToggleCollapse={() => setSidebarCollapsed(!sidebarCollapsed)} />

      <div className="flex-1 flex flex-col relative overflow-hidden">
        <TopBar currentSection="calendar" subscriptionData={subscriptionData} user={user as any} isVisible={true} />

        <div className="flex-1 overflow-y-auto p-6" style={{ background: 'transparent' }}>
          <div className="max-w-6xl mx-auto">
            {/* Main Glass Container */}
            <div style={{
              background: 'rgba(0,0,0,0.46)', backdropFilter: 'blur(20px)',
              border: '1px solid rgba(255,255,255,0.10)', borderRadius: '22px',
              padding: '20px', boxShadow: '0 12px 48px rgba(0,0,0,0.35)',
            }}>
              {/* Header */}
              <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 mb-3">
                <div>
                  <h2 className="text-[13px]" style={{ fontFamily: 'Orbitron, sans-serif', letterSpacing: '0.24em', color: '#e9d7c4', opacity: 0.95 }}>
                    KALENDER
                  </h2>
                  <p className="text-[12px] mt-1.5" style={{ color: 'rgba(255,255,255,0.55)' }}>
                    Termine · AI-Anrufe · Feiertage DACH
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <ViewSwitcher currentView={calendarView} onViewChange={setCalendarView} />

                  <button onClick={() => handleCreateEvent()}
                    className="group relative flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all hover:scale-[1.02]"
                    style={{ background: 'linear-gradient(135deg, #FE9100, #e67e00)', color: 'white', fontSize: '11px', fontWeight: 500 }}>
                    <Plus className="w-3.5 h-3.5" />
                    <span>Termin</span>
                  </button>

                  {isProcessingAI && (
                    <span className="text-[10px] px-2 py-1 rounded-lg" style={{ background: 'rgba(254,145,0,0.12)', color: '#FE9100' }}>
                      <Loader2 className="w-3 h-3 inline animate-spin mr-1" />AI...
                    </span>
                  )}

                  {isLoading && <Loader2 className="w-4 h-4 animate-spin" style={{ color: 'rgba(255,255,255,0.4)' }} />}

                  <span className="text-[10px] tracking-wider hidden sm:inline" style={{ fontFamily: 'Orbitron, sans-serif', color: 'rgba(255,255,255,0.45)' }}>
                    {currentMonthYear}
                  </span>
                </div>
              </div>

              {/* Filter Chips */}
              <div className="mb-4">
                <GlobalFilterChips activeFilters={activeGlobalFilters} onToggle={toggleGlobalFilter} />
              </div>

              {/* Separator */}
              <div className="h-px mb-5 relative overflow-hidden" style={{ background: 'rgba(255,255,255,0.06)' }}>
                <div className="absolute left-0 top-0 h-full w-24" style={{ background: 'linear-gradient(90deg, rgba(255,106,0,0.3), transparent)' }} />
              </div>

              {/* ========== DAY VIEW ========== */}
              {calendarView === 'day' && (
                <>
                  <div className="flex items-center gap-2 mb-5">
                    <button onClick={() => setWeekOffset(w => w - 1)}
                      className="w-8 h-8 flex items-center justify-center rounded-full"
                      style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)' }}>
                      <ChevronLeft className="w-4 h-4" style={{ color: 'rgba(255,255,255,0.5)' }} />
                    </button>
                    <div className="flex-1 flex justify-between gap-2 overflow-x-auto py-1">
                      {days.map((day) => (
                        <DayPill key={day.toISOString()} date={day} isSelected={isSameDay(day, selectedDate)}
                          hasEvents={hasEventsOnDay(day)} onClick={() => setSelectedDate(day)} />
                      ))}
                    </div>
                    <button onClick={() => setWeekOffset(w => w + 1)}
                      className="w-8 h-8 flex items-center justify-center rounded-full"
                      style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)' }}>
                      <ChevronRight className="w-4 h-4" style={{ color: 'rgba(255,255,255,0.5)' }} />
                    </button>
                  </div>

                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-baseline gap-3">
                      <span className="text-[22px] font-bold" style={{ fontFamily: 'Orbitron, sans-serif', color: '#e9d7c4' }}>
                        {format(selectedDate, 'EEE', { locale: de }).toUpperCase()} · {format(selectedDate, 'dd')}
                      </span>
                      <span className="text-[12px]" style={{ color: 'rgba(255,255,255,0.45)' }}>
                        {format(selectedDate, 'MMMM yyyy', { locale: de })}
                      </span>
                      {isToday(selectedDate) && (
                        <span className="text-[10px] px-2 py-0.5 rounded-full" style={{ background: 'rgba(255,106,0,0.15)', color: '#ff6a00' }}>HEUTE</span>
                      )}
                    </div>
                    {isToday(selectedDate) && (
                      <div className="flex items-center gap-1.5">
                        <Clock className="w-3.5 h-3.5" style={{ color: 'rgba(255,255,255,0.45)' }} />
                        <span className="text-[12px] font-medium" style={{ color: 'rgba(255,255,255,0.65)' }}>{format(currentTime, 'HH:mm')}</span>
                      </div>
                    )}
                  </div>

                  <div className="space-y-2.5 max-h-[400px] overflow-y-auto pr-1" style={{ scrollbarWidth: 'none' }}>
                    <AnimatePresence mode="wait">
                      {selectedDayEvents.length === 0 ? (
                        <motion.div key="empty" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                          <CalendarEmptyState onAddEvent={() => handleCreateEvent()} />
                        </motion.div>
                      ) : (
                        <motion.div key={selectedDate.toISOString()} initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -5 }} className="space-y-2.5">
                          {selectedDayEvents.map((event) => (
                            <EventCard key={event.id} event={event} onClick={() => handleEventClick(event)} />
                          ))}
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>

                  {!isToday(selectedDate) && (
                    <button onClick={() => { setSelectedDate(startOfDay(new Date())); setWeekOffset(0); }}
                      className="w-full mt-4 py-2.5 text-[11px] font-medium tracking-wider transition-all"
                      style={{ borderRadius: '10px', background: 'rgba(255,106,0,0.08)', border: '1px solid rgba(255,106,0,0.15)', color: '#FE9100' }}>
                      ZURÜCK ZU HEUTE
                    </button>
                  )}
                </>
              )}

              {/* ========== WEEK VIEW ========== */}
              {calendarView === 'week' && (
                <>
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                      <button onClick={() => setSelectedDate(d => subWeeks(d, 1))}
                        className="w-8 h-8 flex items-center justify-center rounded-full"
                        style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)' }}>
                        <ChevronLeft className="w-4 h-4" style={{ color: 'rgba(255,255,255,0.5)' }} />
                      </button>
                      <span className="text-[14px] font-medium" style={{ color: 'rgba(255,255,255,0.8)' }}>
                        {format(startOfWeek(selectedDate, { weekStartsOn: 1 }), 'd. MMM', { locale: de })} – {format(endOfWeek(selectedDate, { weekStartsOn: 1 }), 'd. MMM yyyy', { locale: de })}
                      </span>
                      <button onClick={() => setSelectedDate(d => addWeeks(d, 1))}
                        className="w-8 h-8 flex items-center justify-center rounded-full"
                        style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)' }}>
                        <ChevronRight className="w-4 h-4" style={{ color: 'rgba(255,255,255,0.5)' }} />
                      </button>
                    </div>
                    <button onClick={() => setSelectedDate(startOfDay(new Date()))}
                      className="text-[11px] px-3 py-1.5 rounded-lg"
                      style={{ background: 'rgba(255,106,0,0.08)', border: '1px solid rgba(255,106,0,0.15)', color: '#FE9100' }}>
                      Heute
                    </button>
                  </div>
                  <WeekView selectedDate={selectedDate} events={allEvents}
                    onEventClick={handleEventClick} onDayClick={handleDayClick} onSlotClick={handleSlotClick} />
                </>
              )}

              {/* ========== MONTH VIEW ========== */}
              {calendarView === 'month' && (
                <>
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                      <button onClick={() => setSelectedDate(d => subMonths(d, 1))}
                        className="w-8 h-8 flex items-center justify-center rounded-full"
                        style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)' }}>
                        <ChevronLeft className="w-4 h-4" style={{ color: 'rgba(255,255,255,0.5)' }} />
                      </button>
                      <span className="text-[16px] font-semibold"
                        style={{ color: '#e9d7c4', fontFamily: 'Orbitron, sans-serif', letterSpacing: '0.1em' }}>
                        {format(selectedDate, 'MMMM yyyy', { locale: de }).toUpperCase()}
                      </span>
                      <button onClick={() => setSelectedDate(d => addMonths(d, 1))}
                        className="w-8 h-8 flex items-center justify-center rounded-full"
                        style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)' }}>
                        <ChevronRight className="w-4 h-4" style={{ color: 'rgba(255,255,255,0.5)' }} />
                      </button>
                    </div>
                    <button onClick={() => setSelectedDate(startOfDay(new Date()))}
                      className="text-[11px] px-3 py-1.5 rounded-lg"
                      style={{ background: 'rgba(255,106,0,0.08)', border: '1px solid rgba(255,106,0,0.15)', color: '#FE9100' }}>
                      Heute
                    </button>
                  </div>
                  <MonthView selectedDate={selectedDate} events={allEvents}
                    onEventClick={handleEventClick} onDayClick={handleDayClick} onCellClick={handleCellClick} />
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Event Detail Drawer */}
      <EventDetailDrawer
        event={drawerEvent} isOpen={isDrawerOpen} mode={drawerMode}
        onClose={closeDrawer}
        onSave={(data) => {
          if (drawerMode === 'create') {
            createMutation.mutate(data);
          } else if (drawerEvent?.personalEvent) {
            updateMutation.mutate({ id: drawerEvent.personalEvent.id, ...data });
          }
        }}
        onDelete={(id) => deleteMutation.mutate(id)}
        isSaving={createMutation.isPending || updateMutation.isPending}
        isDeleting={deleteMutation.isPending}
      />
    </div>
  );
}
