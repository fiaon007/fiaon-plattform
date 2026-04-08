/**
 * ARAS TODAY OS - Timeline + Quick Actions + Week Strip
 * Premium dashboard workspace component
 * ARAS 2026 design - clean, futuristic, readable
 */

import React, { useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { format } from 'date-fns';
import { de } from 'date-fns/locale';
import type { TimelineItem, DayStrip, TimelineCounts } from '@/lib/timeline/timeline';
import { asArray } from '@/lib/utils/safe';

// Design Tokens
const DT = {
  orange: '#ff6a00',
  gold: '#e9d7c4',
  panelBg: 'rgba(0,0,0,0.35)',
  panelBorder: 'rgba(255,255,255,0.10)',
  rowBg: 'rgba(255,255,255,0.02)',
  statusAction: '#ff6a00',
  statusPending: '#f59e0b',
  statusFailed: '#ef4444',
  statusInfo: '#6b7280',
  statusDone: '#22c55e',
  timelineGlow: 'rgba(255,106,0,0.3)',
};

// Animation config
const ANIM = {
  duration: 0.22,
  stagger: 0.04,
};

const listItemVariants = {
  hidden: { opacity: 0, y: 6 },
  visible: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -6 },
};

// ═══════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════

interface TodayOSProps {
  itemsTimed: TimelineItem[];
  itemsUntimed: TimelineItem[];
  weekStrip: { days: DayStrip[] };
  counts: TimelineCounts;
  focusKey: string | null;
  unassignedCount?: number;
  onOpen: (item: TimelineItem) => void;
  onTaskDone?: (taskId: string, done: boolean) => Promise<void>;
  onTaskSnooze?: (taskId: string, mode: '1h' | 'tomorrow' | 'nextweek') => Promise<void>;
  onCreateTaskFromItem?: (item: TimelineItem) => Promise<void>;
}

// ═══════════════════════════════════════════════════════════════
// COMPONENT
// ═══════════════════════════════════════════════════════════════

export function TodayOS({
  itemsTimed,
  itemsUntimed,
  weekStrip,
  counts,
  focusKey,
  unassignedCount = 0,
  onOpen,
  onTaskDone,
  onTaskSnooze,
  onCreateTaskFromItem,
}: TodayOSProps) {
  // NULL-SAFE: Always work with arrays
  const safeItemsTimed = asArray<TimelineItem>(itemsTimed);
  const safeItemsUntimed = asArray<TimelineItem>(itemsUntimed);
  const safeWeekDays = asArray<DayStrip>(weekStrip?.days);
  
  const hasAnyItems = safeItemsTimed.length > 0 || safeItemsUntimed.length > 0;

  return (
    <motion.div
      data-tour="mc-today-os"
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: ANIM.duration, delay: 0.15 }}
      className="rounded-2xl overflow-hidden relative"
      style={{
        background: DT.panelBg,
        backdropFilter: 'blur(20px)',
        border: `1px solid ${DT.panelBorder}`,
      }}
    >
      {/* Subtle scanline overlay (10% intensity) */}
      <div
        className="absolute inset-0 pointer-events-none opacity-[0.03]"
        style={{
          backgroundImage: 'repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(255,255,255,0.03) 2px, rgba(255,255,255,0.03) 4px)',
        }}
      />

      {/* Header */}
      <div className="p-4 border-b relative z-10" style={{ borderColor: 'rgba(255,255,255,0.05)' }}>
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3
              className="text-sm font-bold uppercase tracking-wide"
              style={{
                background: `linear-gradient(90deg, ${DT.gold}, ${DT.orange})`,
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
              }}
            >
              TODAY OS
            </h3>
            <p className="text-[10px] text-neutral-500 mt-0.5">
              Dein heutiger Arbeitsfluss — Termine, Aktionen, Status
            </p>
          </div>

          {/* Status chips */}
          <div className="flex flex-wrap gap-1 justify-end">
            {counts.action > 0 && (
              <StatusChip label="Aktion" count={counts.action} color={DT.statusAction} />
            )}
            {counts.pending > 0 && (
              <StatusChip label="In Arbeit" count={counts.pending} color={DT.statusPending} />
            )}
            {counts.failed > 0 && (
              <StatusChip label="Fehler" count={counts.failed} color={DT.statusFailed} />
            )}
            {counts.tasksDue > 0 && (
              <StatusChip label="Fällig" count={counts.tasksDue} color={DT.gold} />
            )}
            {focusKey && (
              <span
                className="px-1.5 py-0.5 rounded text-[8px] font-bold uppercase"
                style={{ background: 'rgba(255,106,0,0.15)', color: DT.orange }}
              >
                Fokus aktiv
              </span>
            )}
          </div>
        </div>

        {/* Week Strip */}
        <div className="mt-3">
          <WeekStripRow days={weekStrip.days} />
        </div>
      </div>

      {/* Body */}
      <div className="p-3 relative z-10 space-y-3 max-h-[400px] overflow-y-auto" style={{ scrollbarWidth: 'thin', scrollbarColor: 'rgba(255,255,255,0.1) transparent' }}>
        {/* Unassigned hint (focus mode) */}
        {focusKey && unassignedCount > 0 && (
          <div className="px-2 py-1.5 rounded-lg text-[10px] text-neutral-500" style={{ background: 'rgba(255,255,255,0.02)' }}>
            {unassignedCount} Eintrag{unassignedCount > 1 ? 'e' : ''} nicht sicher zuordenbar (ausgeblendet im Fokus)
          </div>
        )}

        {/* Empty state */}
        {!hasAnyItems && (
          <div className="text-center py-8">
            <p className="text-xs text-neutral-500 mb-1">Heute ist ruhig.</p>
            <p className="text-[10px] text-neutral-600">
              Sobald Calls, Space oder Aufgaben anfallen, erscheint hier dein Arbeitsfluss.
            </p>
          </div>
        )}

        {/* Timed Timeline */}
        {itemsTimed.length > 0 && (
          <div className="relative">
            {/* Vertical timeline line */}
            <div
              className="absolute left-[42px] top-2 bottom-2 w-px"
              style={{ background: `linear-gradient(180deg, ${DT.timelineGlow}, transparent)` }}
            />

            <AnimatePresence mode="popLayout">
              {itemsTimed.map((item, idx) => (
                <TimelineRow
                  key={item.id}
                  item={item}
                  index={idx}
                  showTime
                  onOpen={() => onOpen(item)}
                  onTaskDone={onTaskDone}
                  onTaskSnooze={onTaskSnooze}
                  onCreateTask={onCreateTaskFromItem}
                />
              ))}
            </AnimatePresence>
          </div>
        )}

        {/* Untimed Section */}
        {itemsUntimed.length > 0 && (
          <div className="pt-2">
            <p className="text-[9px] uppercase tracking-wide text-neutral-600 px-1 mb-2">Ohne Zeit</p>
            <AnimatePresence mode="popLayout">
              {itemsUntimed.map((item, idx) => (
                <TimelineRow
                  key={item.id}
                  item={item}
                  index={idx}
                  showTime={false}
                  onOpen={() => onOpen(item)}
                  onTaskDone={onTaskDone}
                  onTaskSnooze={onTaskSnooze}
                  onCreateTask={onCreateTaskFromItem}
                />
              ))}
            </AnimatePresence>
          </div>
        )}
      </div>
    </motion.div>
  );
}

// ═══════════════════════════════════════════════════════════════
// STATUS CHIP
// ═══════════════════════════════════════════════════════════════

function StatusChip({ label, count, color }: { label: string; count: number; color: string }) {
  return (
    <span
      className="px-1.5 py-0.5 rounded text-[8px] font-bold uppercase"
      style={{ background: `${color}15`, color }}
    >
      {label}: {count}
    </span>
  );
}

// ═══════════════════════════════════════════════════════════════
// WEEK STRIP
// ═══════════════════════════════════════════════════════════════

function WeekStripRow({ days }: { days: DayStrip[] }) {
  const dayNames = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'];

  return (
    <div className="flex gap-1">
      {days.map((day, idx) => {
        const dayName = dayNames[day.date.getDay()];
        const dayNum = day.date.getDate();
        const isToday = idx === 0;

        return (
          <div
            key={idx}
            className="flex-1 rounded-lg p-1.5 text-center transition-all"
            style={{
              background: isToday ? 'rgba(255,106,0,0.1)' : 'rgba(255,255,255,0.02)',
              border: `1px solid ${isToday ? 'rgba(255,106,0,0.2)' : 'transparent'}`,
            }}
          >
            <p
              className="text-[9px] font-medium"
              style={{ color: isToday ? DT.orange : '#888' }}
            >
              {dayName}
            </p>
            <p
              className="text-[10px] font-bold"
              style={{ color: isToday ? DT.gold : '#666' }}
            >
              {dayNum}
            </p>
            {day.hasAny && (
              <div className="flex justify-center gap-0.5 mt-0.5">
                {day.counts.events > 0 && (
                  <span className="text-[7px] text-neutral-500">T:{day.counts.events}</span>
                )}
                {day.counts.actions > 0 && (
                  <span className="text-[7px]" style={{ color: DT.statusAction }}>A:{day.counts.actions}</span>
                )}
                {day.counts.pending > 0 && (
                  <span className="text-[7px]" style={{ color: DT.statusPending }}>P:{day.counts.pending}</span>
                )}
                {day.counts.failed > 0 && (
                  <span className="text-[7px]" style={{ color: DT.statusFailed }}>F:{day.counts.failed}</span>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// TIMELINE ROW
// ═══════════════════════════════════════════════════════════════

interface TimelineRowProps {
  item: TimelineItem;
  index: number;
  showTime: boolean;
  onOpen: () => void;
  onTaskDone?: (taskId: string, done: boolean) => Promise<void>;
  onTaskSnooze?: (taskId: string, mode: '1h' | 'tomorrow' | 'nextweek') => Promise<void>;
  onCreateTask?: (item: TimelineItem) => Promise<void>;
}

function TimelineRow({
  item,
  index,
  showTime,
  onOpen,
  onTaskDone,
  onTaskSnooze,
  onCreateTask,
}: TimelineRowProps) {
  const [loading, setLoading] = React.useState(false);
  const [snoozeOpen, setSnoozeOpen] = React.useState(false);

  const timeLabel = useMemo(() => {
    if (!showTime || !item.at) return '—';
    return format(item.at, 'HH:mm');
  }, [showTime, item.at]);

  const statusColor = useMemo(() => {
    switch (item.status) {
      case 'failed': return DT.statusFailed;
      case 'pending': return DT.statusPending;
      case 'action': return DT.statusAction;
      case 'done': return DT.statusDone;
      default: return DT.statusInfo;
    }
  }, [item.status]);

  const statusLabel = useMemo(() => {
    switch (item.status) {
      case 'failed': return 'Fehler';
      case 'pending': return 'In Arbeit';
      case 'action': return 'Aktion';
      case 'done': return 'Erledigt';
      default: return 'Info';
    }
  }, [item.status]);

  const handleTaskDone = async () => {
    if (!onTaskDone || !item.meta?.taskId) return;
    setLoading(true);
    try {
      await onTaskDone(String(item.meta.taskId), !item.meta.done);
    } finally {
      setLoading(false);
    }
  };

  const handleSnooze = async (mode: '1h' | 'tomorrow' | 'nextweek') => {
    if (!onTaskSnooze || !item.meta?.taskId) return;
    setLoading(true);
    setSnoozeOpen(false);
    try {
      await onTaskSnooze(String(item.meta.taskId), mode);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateTask = async () => {
    if (!onCreateTask) return;
    setLoading(true);
    try {
      await onCreateTask(item);
    } finally {
      setLoading(false);
    }
  };

  const isTask = item.type === 'task';
  const hasNextStep = !!item.subtitle && item.status === 'action';

  return (
    <motion.div
      variants={listItemVariants}
      initial="hidden"
      animate="visible"
      exit="exit"
      transition={{ duration: ANIM.duration, delay: index * ANIM.stagger }}
      className="group relative"
    >
      <div
        className="flex items-center gap-2 p-2 rounded-xl transition-all"
        style={{
          background: DT.rowBg,
        }}
      >
        {/* Time label */}
        {showTime && (
          <span
            className="w-10 text-[10px] font-mono text-right flex-shrink-0"
            style={{ color: '#666' }}
          >
            {timeLabel}
          </span>
        )}

        {/* Timeline dot */}
        {showTime && (
          <div
            className="w-2 h-2 rounded-full flex-shrink-0"
            style={{ background: statusColor, boxShadow: `0 0 6px ${statusColor}` }}
          />
        )}

        {/* Content */}
        <div className="flex-1 min-w-0">
          <p className="text-xs font-medium truncate" style={{ color: DT.gold }}>
            {item.title}
          </p>
          {item.subtitle && (
            <p className="text-[10px] text-neutral-500 truncate">{item.subtitle}</p>
          )}
        </div>

        {/* Status badge */}
        <span
          className="px-1.5 py-0.5 rounded text-[8px] font-bold uppercase flex-shrink-0"
          style={{ background: `${statusColor}15`, color: statusColor }}
        >
          {statusLabel}
        </span>

        {/* Actions */}
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
          <button
            onClick={onOpen}
            className="text-[9px] font-medium px-1.5 py-0.5 rounded transition-all hover:bg-white/[0.08]"
            style={{ color: DT.gold }}
          >
            Öffnen
          </button>

          {isTask && onTaskDone && (
            <button
              onClick={handleTaskDone}
              disabled={loading}
              className="text-[9px] font-medium px-1.5 py-0.5 rounded transition-all hover:bg-white/[0.08] disabled:opacity-50"
              style={{ color: item.meta?.done ? '#888' : DT.statusDone }}
            >
              {item.meta?.done ? 'Rückgängig' : 'Erledigt'}
            </button>
          )}

          {isTask && onTaskSnooze && !item.meta?.done && (
            <div className="relative">
              <button
                onClick={() => setSnoozeOpen(!snoozeOpen)}
                className="text-[9px] font-medium px-1.5 py-0.5 rounded transition-all hover:bg-white/[0.08]"
                style={{ color: '#888' }}
              >
                Snooze
              </button>
              {snoozeOpen && (
                <div
                  className="absolute right-0 top-full mt-1 rounded-lg p-1 z-20"
                  style={{ background: 'rgba(0,0,0,0.9)', border: '1px solid rgba(255,255,255,0.1)' }}
                >
                  <button
                    onClick={() => handleSnooze('1h')}
                    className="block w-full text-left text-[9px] px-2 py-1 rounded hover:bg-white/[0.08]"
                    style={{ color: '#aaa' }}
                  >
                    +1 Stunde
                  </button>
                  <button
                    onClick={() => handleSnooze('tomorrow')}
                    className="block w-full text-left text-[9px] px-2 py-1 rounded hover:bg-white/[0.08]"
                    style={{ color: '#aaa' }}
                  >
                    Morgen
                  </button>
                  <button
                    onClick={() => handleSnooze('nextweek')}
                    className="block w-full text-left text-[9px] px-2 py-1 rounded hover:bg-white/[0.08]"
                    style={{ color: '#aaa' }}
                  >
                    Nächste Woche
                  </button>
                </div>
              )}
            </div>
          )}

          {!isTask && hasNextStep && onCreateTask && (
            <button
              onClick={handleCreateTask}
              disabled={loading}
              className="text-[9px] font-medium px-1.5 py-0.5 rounded transition-all hover:bg-white/[0.08] disabled:opacity-50"
              style={{ color: DT.orange }}
            >
              Als Aufgabe
            </button>
          )}
        </div>
      </div>
    </motion.div>
  );
}

export default TodayOS;
