/**
 * ARAS Today OS - Timeline Data Layer
 * Deterministic timeline building from real data only
 * No fake timestamps, no guessing
 */

import { buildContactRefFromCall, buildContactRefFromSpace, buildContactRefFromTask } from '@/lib/contacts/contact-key';

// ═══════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════

export type TimelineItemType = 'calendar' | 'call' | 'space' | 'task' | 'inbox';

export interface TimelineItem {
  id: string;
  type: TimelineItemType;
  title: string;
  subtitle?: string;
  at?: Date;
  endAt?: Date;
  contactKey?: string;
  sourceId?: string;
  sourceType?: 'call' | 'space' | 'task';
  status?: 'action' | 'pending' | 'failed' | 'info' | 'done';
  priority?: 'hoch' | 'mittel' | 'niedrig';
  meta?: Record<string, any>;
}

export interface TimelineCounts {
  action: number;
  pending: number;
  failed: number;
  tasksDue: number;
}

export interface DayStrip {
  date: Date;
  hasAny: boolean;
  counts: {
    events: number;
    actions: number;
    pending: number;
    failed: number;
  };
}

export interface WeekStripResult {
  days: DayStrip[];
}

export interface TodayTimelineResult {
  timed: TimelineItem[];
  untimed: TimelineItem[];
  counts: TimelineCounts;
  unassignedCount: number;
}

// ═══════════════════════════════════════════════════════════════
// SAFE HELPERS
// ═══════════════════════════════════════════════════════════════

function safeArray<T>(val: unknown): T[] {
  return Array.isArray(val) ? val : [];
}

function safeString(val: unknown): string | undefined {
  if (typeof val === 'string') {
    const trimmed = val.trim();
    return trimmed.length > 0 ? trimmed : undefined;
  }
  return undefined;
}

function parseDate(val: unknown): Date | undefined {
  if (!val) return undefined;
  if (val instanceof Date) {
    return isNaN(val.getTime()) ? undefined : val;
  }
  if (typeof val === 'string' || typeof val === 'number') {
    const d = new Date(val);
    return isNaN(d.getTime()) ? undefined : d;
  }
  return undefined;
}

function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function startOfDay(d: Date): Date {
  const copy = new Date(d);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

// ═══════════════════════════════════════════════════════════════
// STATUS + PRIORITY DETECTION (deterministic)
// ═══════════════════════════════════════════════════════════════

function detectStatus(item: any, type: TimelineItemType): TimelineItem['status'] {
  // Check for failed
  const status = safeString(item.status);
  const summaryStatus = safeString(item.summaryStatus);
  const hasError = !!safeString(item.error) || !!safeString(item.summaryError);
  
  if (status === 'failed' || status === 'error' || summaryStatus === 'failed' || hasError) {
    return 'failed';
  }

  // Check for pending
  if (summaryStatus === 'pending' || status === 'pending' || status === 'processing' || status === 'in_progress') {
    return 'pending';
  }

  // Check for done (tasks only)
  if (type === 'task' && (item.done === true || status === 'done' || status === 'completed')) {
    return 'done';
  }

  // Check for action
  const hasNextStep = !!extractNextStep(item, type);
  if (hasNextStep) {
    return 'action';
  }

  return 'info';
}

function extractNextStep(item: any, type: TimelineItemType): string | undefined {
  if (type === 'call') {
    const candidates = [
      item.summary?.nextStep,
      item.summary?.full?.nextStep,
      item.summaryFull?.nextStep,
    ];
    for (const c of candidates) {
      const s = safeString(c);
      if (s && s.length > 5) return s;
    }
  } else if (type === 'space') {
    const candidates = [
      item.summaryFull?.nextStep,
      item.metadata?.spaceSummary?.full?.nextStep,
    ];
    for (const c of candidates) {
      const s = safeString(c);
      if (s && s.length > 5) return s;
    }
  } else if (type === 'task') {
    return safeString(item.nextStep) || safeString(item.description);
  }
  return undefined;
}

const HIGH_PRIORITY_KEYWORDS = /rückruf|termin|angebot|dringend|urgent|asap/i;

function detectPriority(item: TimelineItem): TimelineItem['priority'] {
  // Failed is always high
  if (item.status === 'failed') {
    return 'hoch';
  }

  // Action with keywords is high
  if (item.status === 'action') {
    const text = `${item.title || ''} ${item.subtitle || ''}`;
    if (HIGH_PRIORITY_KEYWORDS.test(text)) {
      return 'hoch';
    }
    return 'mittel';
  }

  return 'niedrig';
}

// ═══════════════════════════════════════════════════════════════
// BUILD TODAY TIMELINE
// ═══════════════════════════════════════════════════════════════

interface BuildTodayParams {
  now: Date;
  calls: any[];
  spaces: any[];
  tasks: any[];
  inboxItems?: any[];
  calendarEvents?: any[];
  focusKey?: string | null;
}

export function buildTodayTimeline({
  now,
  calls,
  spaces,
  tasks,
  inboxItems,
  calendarEvents,
  focusKey,
}: BuildTodayParams): TodayTimelineResult {
  const today = startOfDay(now);
  const items: TimelineItem[] = [];
  let unassignedCount = 0;

  // Build lookup for task contact resolution
  const callsById = new Map<string, any>();
  const spacesById = new Map<string, any>();
  for (const call of safeArray(calls)) {
    if (call.id) callsById.set(String(call.id), call);
  }
  for (const space of safeArray(spaces)) {
    if (space.id) spacesById.set(String(space.id), space);
  }
  const lookup = { callsById, spacesById };

  // Process calendar events
  for (const event of safeArray(calendarEvents)) {
    const start = parseDate(event.start) || parseDate(event.startTime) || parseDate(event.startAt);
    const end = parseDate(event.end) || parseDate(event.endTime) || parseDate(event.endAt);
    
    // Only include if start is today
    if (!start || !isSameDay(start, today)) continue;

    const item: TimelineItem = {
      id: `cal-${event.id || Math.random().toString(36).slice(2)}`,
      type: 'calendar',
      title: safeString(event.title) || safeString(event.summary) || 'Termin',
      subtitle: safeString(event.location),
      at: start,
      endAt: end,
      status: 'info',
      meta: { eventId: event.id },
    };

    // Contact key from attendees if available
    const attendeeEmail = safeString(event.attendees?.[0]?.email);
    if (attendeeEmail) {
      item.contactKey = `email:${attendeeEmail.toLowerCase()}`;
    }

    item.priority = detectPriority(item);
    
    // Focus filtering
    if (focusKey) {
      if (item.contactKey === focusKey) {
        items.push(item);
      } else {
        unassignedCount++;
      }
    } else {
      items.push(item);
    }
  }

  // Process calls (only if timestamp is today)
  for (const call of safeArray(calls)) {
    const timestamp = parseDate(call.startedAt) || parseDate(call.createdAt) || parseDate(call.timestamp);
    
    // Only include if timestamp is today (or no timestamp for untimed)
    const isToday = timestamp && isSameDay(timestamp, today);
    if (!isToday && timestamp) continue; // Future/past calls excluded

    const contactRef = buildContactRefFromCall(call);
    const status = detectStatus(call, 'call');

    const item: TimelineItem = {
      id: `call-${call.id}`,
      type: 'call',
      title: safeString(call.contactName) || safeString(call.phoneNumber) || 'Anruf',
      subtitle: extractNextStep(call, 'call') || safeString(call.summaryShort),
      at: isToday ? timestamp : undefined,
      contactKey: contactRef?.key,
      sourceId: String(call.id),
      sourceType: 'call',
      status,
      meta: { duration: call.duration, phoneNumber: call.phoneNumber },
    };

    item.priority = detectPriority(item);

    // Focus filtering
    if (focusKey) {
      if (item.contactKey === focusKey) {
        items.push(item);
      } else if (!item.contactKey) {
        unassignedCount++;
      } else {
        // Different contact, exclude
      }
    } else {
      items.push(item);
    }
  }

  // Process spaces (only if timestamp is today)
  for (const space of safeArray(spaces)) {
    const timestamp = parseDate(space.lastMessageAt) || parseDate(space.updatedAt) || parseDate(space.createdAt);
    
    const isToday = timestamp && isSameDay(timestamp, today);
    if (!isToday && timestamp) continue;

    const contactRef = buildContactRefFromSpace(space);
    const status = detectStatus(space, 'space');

    const item: TimelineItem = {
      id: `space-${space.id}`,
      type: 'space',
      title: safeString(space.title) || 'Space Chat',
      subtitle: extractNextStep(space, 'space') || safeString(space.summaryShort),
      at: isToday ? timestamp : undefined,
      contactKey: contactRef?.key,
      sourceId: String(space.id),
      sourceType: 'space',
      status,
      meta: { messageCount: space.messageCount },
    };

    item.priority = detectPriority(item);

    if (focusKey) {
      if (item.contactKey === focusKey) {
        items.push(item);
      } else if (!item.contactKey) {
        unassignedCount++;
      }
    } else {
      items.push(item);
    }
  }

  // Process tasks (dueAt today, snoozedUntil today, or untimed)
  for (const task of safeArray(tasks)) {
    const dueAt = parseDate(task.dueAt);
    const snoozedUntil = parseDate(task.snoozedUntil);
    const isDone = task.done === true || task.status === 'done' || task.status === 'completed';
    
    // Determine if task is relevant for today
    let isRelevantToday = false;
    let taskTime: Date | undefined;

    if (dueAt && isSameDay(dueAt, today)) {
      isRelevantToday = true;
      taskTime = dueAt;
    } else if (snoozedUntil && isSameDay(snoozedUntil, today)) {
      isRelevantToday = true;
      taskTime = snoozedUntil;
    } else if (!dueAt && !snoozedUntil && !isDone) {
      // Untimed open task - include
      isRelevantToday = true;
    } else if (dueAt && dueAt < today && !isDone) {
      // Overdue task - include
      isRelevantToday = true;
    }

    if (!isRelevantToday) continue;

    const contactRef = buildContactRefFromTask(task, lookup);
    const status = isDone ? 'done' : detectStatus(task, 'task');

    const item: TimelineItem = {
      id: `task-${task.id}`,
      type: 'task',
      title: safeString(task.title) || 'Aufgabe',
      subtitle: safeString(task.description) || safeString(task.nextStep),
      at: taskTime,
      contactKey: contactRef?.key,
      sourceId: String(task.id),
      sourceType: 'task',
      status,
      meta: { 
        taskId: task.id,
        sourceType: task.sourceType,
        sourceId: task.sourceId,
        done: isDone,
      },
    };

    item.priority = detectPriority(item);

    if (focusKey) {
      if (item.contactKey === focusKey) {
        items.push(item);
      } else if (!item.contactKey) {
        unassignedCount++;
      }
    } else {
      items.push(item);
    }
  }

  // Split into timed and untimed
  const timed: TimelineItem[] = [];
  const untimed: TimelineItem[] = [];

  for (const item of items) {
    if (item.at) {
      timed.push(item);
    } else {
      untimed.push(item);
    }
  }

  // Sort timed by time
  timed.sort((a, b) => (a.at?.getTime() || 0) - (b.at?.getTime() || 0));

  // Sort untimed: failed > action > pending > newest (by id as fallback)
  untimed.sort((a, b) => {
    const statusOrder = { failed: 0, action: 1, pending: 2, info: 3, done: 4 };
    const aOrder = statusOrder[a.status || 'info'] ?? 3;
    const bOrder = statusOrder[b.status || 'info'] ?? 3;
    if (aOrder !== bOrder) return aOrder - bOrder;
    return a.id.localeCompare(b.id);
  });

  // Calculate counts
  const counts: TimelineCounts = {
    action: items.filter(i => i.status === 'action').length,
    pending: items.filter(i => i.status === 'pending').length,
    failed: items.filter(i => i.status === 'failed').length,
    tasksDue: items.filter(i => i.type === 'task' && i.at && i.status !== 'done').length,
  };

  return { timed, untimed, counts, unassignedCount };
}

// ═══════════════════════════════════════════════════════════════
// BUILD WEEK STRIP (7 days starting from today)
// ═══════════════════════════════════════════════════════════════

interface BuildWeekStripParams {
  now: Date;
  calendarEvents?: any[];
  calls: any[];
  spaces: any[];
  tasks: any[];
  focusKey?: string | null;
}

export function buildWeekStrip({
  now,
  calendarEvents,
  calls,
  spaces,
  tasks,
  focusKey,
}: BuildWeekStripParams): WeekStripResult {
  const days: DayStrip[] = [];
  const todayStart = startOfDay(now);

  for (let i = 0; i < 7; i++) {
    const dayDate = new Date(todayStart);
    dayDate.setDate(todayStart.getDate() + i);

    const counts = {
      events: 0,
      actions: 0,
      pending: 0,
      failed: 0,
    };

    // Count calendar events for this day
    for (const event of safeArray(calendarEvents)) {
      const start = parseDate(event.start) || parseDate(event.startTime) || parseDate(event.startAt);
      if (start && isSameDay(start, dayDate)) {
        counts.events++;
      }
    }

    // Count calls for this day
    for (const call of safeArray(calls)) {
      const timestamp = parseDate(call.startedAt) || parseDate(call.createdAt);
      if (timestamp && isSameDay(timestamp, dayDate)) {
        const status = detectStatus(call, 'call');
        if (status === 'failed') counts.failed++;
        else if (status === 'pending') counts.pending++;
        else if (status === 'action') counts.actions++;
      }
    }

    // Count spaces for this day
    for (const space of safeArray(spaces)) {
      const timestamp = parseDate(space.lastMessageAt) || parseDate(space.updatedAt);
      if (timestamp && isSameDay(timestamp, dayDate)) {
        const status = detectStatus(space, 'space');
        if (status === 'failed') counts.failed++;
        else if (status === 'pending') counts.pending++;
        else if (status === 'action') counts.actions++;
      }
    }

    // Count tasks due this day
    for (const task of safeArray(tasks)) {
      const dueAt = parseDate(task.dueAt);
      const snoozedUntil = parseDate(task.snoozedUntil);
      const isDone = task.done === true || task.status === 'done';
      
      if (!isDone) {
        if ((dueAt && isSameDay(dueAt, dayDate)) || (snoozedUntil && isSameDay(snoozedUntil, dayDate))) {
          counts.actions++;
        }
      }
    }

    const hasAny = counts.events > 0 || counts.actions > 0 || counts.pending > 0 || counts.failed > 0;

    days.push({
      date: dayDate,
      hasAny,
      counts,
    });
  }

  return { days };
}
