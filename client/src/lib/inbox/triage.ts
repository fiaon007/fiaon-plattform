/**
 * ARAS Smart Inbox - Triage Engine
 * Classifies feed items into action categories based on real data only
 * No fake data, no assumptions - purely deterministic
 */

import type { UserTask } from '@shared/schema';
import { buildContactRefFromCall, buildContactRefFromSpace } from '@/lib/contacts/contact-key';

// ═══════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════

export type InboxStatus = 'action' | 'pending' | 'failed' | 'info';
export type SourceType = 'call' | 'space';

export interface InboxItem {
  id: string | number;
  sourceType: SourceType;
  sourceId: string;
  title: string;
  subtitle?: string;
  createdAt?: string;
  status: InboxStatus;
  nextStep?: string;
  outcome?: string;
  error?: string;
  taskOpenCount?: number;
  summaryStatus?: string;
  contactKey?: string; // For focus mode filtering
  rawRef: any; // Original data reference for drawer
}

export interface InboxCounts {
  action: number;
  pending: number;
  failed: number;
  info: number;
  total: number;
}

export type SourceFilter = 'all' | 'calls' | 'space';
export type InboxTab = 'action' | 'pending' | 'failed' | 'info';

// ═══════════════════════════════════════════════════════════════
// SAFE HELPERS
// ═══════════════════════════════════════════════════════════════

function safeString(val: unknown): string | undefined {
  if (typeof val === 'string') {
    const trimmed = val.trim();
    return trimmed.length > 0 ? trimmed : undefined;
  }
  return undefined;
}

function safeArray<T>(val: unknown): T[] {
  return Array.isArray(val) ? val : [];
}

// ═══════════════════════════════════════════════════════════════
// NEXT STEP EXTRACTION (from real fields only)
// ═══════════════════════════════════════════════════════════════

function extractNextStep(item: any, sourceType: SourceType): string | undefined {
  if (sourceType === 'call') {
    // Try multiple paths where nextStep might exist
    const candidates = [
      item.summary?.nextStep,
      item.summary?.full?.nextStep,
      item.summaryFull?.nextStep,
      item.metadata?.summary?.nextStep,
    ];
    for (const c of candidates) {
      const s = safeString(c);
      if (s && s.length > 5) return s;
    }
  } else if (sourceType === 'space') {
    // Space session paths
    const candidates = [
      item.summaryFull?.nextStep,
      item.metadata?.spaceSummary?.full?.nextStep,
      item.metadata?.spaceSummary?.nextStep,
      item.summary?.nextStep,
    ];
    for (const c of candidates) {
      const s = safeString(c);
      if (s && s.length > 5) return s;
    }
  }
  return undefined;
}

function extractOutcome(item: any, sourceType: SourceType): string | undefined {
  if (sourceType === 'call') {
    const candidates = [
      item.summary?.outcome,
      item.summary?.full?.outcome,
      item.summaryFull?.outcome,
      item.summaryShort,
    ];
    for (const c of candidates) {
      const s = safeString(c);
      if (s && s.length > 3) return s;
    }
  } else if (sourceType === 'space') {
    const candidates = [
      item.summaryFull?.outcome,
      item.summaryShort,
      item.metadata?.spaceSummary?.full?.outcome,
    ];
    for (const c of candidates) {
      const s = safeString(c);
      if (s && s.length > 3) return s;
    }
  }
  return undefined;
}

// ═══════════════════════════════════════════════════════════════
// STATUS DETECTION (deterministic, data-based)
// ═══════════════════════════════════════════════════════════════

function detectStatus(
  item: any,
  sourceType: SourceType,
  openTasksForItem: number
): InboxStatus {
  // 1) FAILED - check for explicit error/failed status
  const summaryStatus = safeString(item.summaryStatus);
  const itemStatus = safeString(item.status);
  const errorField = safeString(item.error) || safeString(item.summaryError);

  if (
    summaryStatus === 'failed' ||
    itemStatus === 'failed' ||
    itemStatus === 'error' ||
    errorField
  ) {
    return 'failed';
  }

  // 2) PENDING - check for processing/pending status
  if (
    summaryStatus === 'pending' ||
    itemStatus === 'pending' ||
    itemStatus === 'processing' ||
    itemStatus === 'in_progress'
  ) {
    return 'pending';
  }

  // 3) ACTION - has nextStep or open tasks linked to this item
  const nextStep = extractNextStep(item, sourceType);
  if (nextStep || openTasksForItem > 0) {
    return 'action';
  }

  // 4) INFO - everything else (completed, no action needed)
  return 'info';
}

// ═══════════════════════════════════════════════════════════════
// BUILD INBOX ITEMS
// ═══════════════════════════════════════════════════════════════

interface BuildInboxParams {
  calls: any[];
  spaces: any[];
  tasks: UserTask[];
}

export function buildInboxItems({ calls, spaces, tasks }: BuildInboxParams): InboxItem[] {
  const items: InboxItem[] = [];
  const openTasks = safeArray(tasks).filter(t => t.status === 'open');

  // Helper to count open tasks for a specific source
  const countOpenTasks = (sourceType: SourceType, sourceId: string): number => {
    return openTasks.filter(
      t => t.sourceType === sourceType && t.sourceId === sourceId
    ).length;
  };

  // Process calls
  for (const call of safeArray(calls)) {
    const id = call.id;
    if (!id) continue;

    const sourceId = String(id);
    const taskCount = countOpenTasks('call', sourceId);
    const status = detectStatus(call, 'call', taskCount);
    const contactRef = buildContactRefFromCall(call);

    items.push({
      id,
      sourceType: 'call',
      sourceId,
      title: safeString(call.contactName) || safeString(call.phoneNumber) || 'Unbekannter Anruf',
      subtitle: extractOutcome(call, 'call'),
      createdAt: safeString(call.createdAt),
      status,
      nextStep: extractNextStep(call, 'call'),
      outcome: extractOutcome(call, 'call'),
      error: safeString(call.error) || safeString(call.summaryError),
      taskOpenCount: taskCount > 0 ? taskCount : undefined,
      summaryStatus: safeString(call.summaryStatus),
      contactKey: contactRef?.key,
      rawRef: call,
    });
  }

  // Process space sessions
  for (const session of safeArray(spaces)) {
    const id = session.id;
    if (!id) continue;

    const sourceId = String(id);
    const taskCount = countOpenTasks('space', sourceId);
    const status = detectStatus(session, 'space', taskCount);
    const contactRef = buildContactRefFromSpace(session);

    items.push({
      id,
      sourceType: 'space',
      sourceId,
      title: safeString(session.title) || 'Unbenannter Chat',
      subtitle: extractOutcome(session, 'space'),
      createdAt: safeString(session.lastMessageAt) || safeString(session.updatedAt) || safeString(session.createdAt),
      status,
      nextStep: extractNextStep(session, 'space'),
      outcome: extractOutcome(session, 'space'),
      error: safeString(session.error) || safeString(session.summaryError),
      taskOpenCount: taskCount > 0 ? taskCount : undefined,
      summaryStatus: safeString(session.summaryStatus),
      contactKey: contactRef?.key,
      rawRef: session,
    });
  }

  return items;
}

// ═══════════════════════════════════════════════════════════════
// FILTER INBOX
// ═══════════════════════════════════════════════════════════════

interface FilterParams {
  items: InboxItem[];
  sourceFilter: SourceFilter;
  tab: InboxTab;
  query?: string;
  dismissedIds?: Set<string>;
  focusKey?: string | null; // Focus mode: only show items with this contactKey
}

export interface FilterResult {
  items: InboxItem[];
  unfocusedCount: number; // Items hidden due to focus mode (no contactKey match)
}

export function filterInbox({
  items,
  sourceFilter,
  tab,
  query,
  dismissedIds,
  focusKey,
}: FilterParams): FilterResult {
  let filtered = items;
  let unfocusedCount = 0;

  // 1) Filter by source type
  if (sourceFilter === 'calls') {
    filtered = filtered.filter(i => i.sourceType === 'call');
  } else if (sourceFilter === 'space') {
    filtered = filtered.filter(i => i.sourceType === 'space');
  }

  // 2) Filter by inbox tab (status)
  filtered = filtered.filter(i => i.status === tab);

  // 3) For INFO tab, exclude dismissed items
  if (tab === 'info' && dismissedIds && dismissedIds.size > 0) {
    filtered = filtered.filter(i => !dismissedIds.has(`${i.sourceType}-${i.sourceId}`));
  }

  // 4) Filter by focus key (contact focus mode)
  if (focusKey) {
    const beforeFocus = filtered.length;
    filtered = filtered.filter(i => i.contactKey === focusKey);
    unfocusedCount = beforeFocus - filtered.length;
  }

  // 5) Filter by search query
  if (query && query.trim().length > 0) {
    const q = query.toLowerCase().trim();
    filtered = filtered.filter(i => {
      const title = (i.title || '').toLowerCase();
      const subtitle = (i.subtitle || '').toLowerCase();
      const nextStep = (i.nextStep || '').toLowerCase();
      return title.includes(q) || subtitle.includes(q) || nextStep.includes(q);
    });
  }

  return { items: filtered, unfocusedCount };
}

// ═══════════════════════════════════════════════════════════════
// COUNT BY TAB
// ═══════════════════════════════════════════════════════════════

export function countsByTab(
  items: InboxItem[],
  sourceFilter: SourceFilter,
  dismissedIds?: Set<string>
): InboxCounts {
  // First filter by source
  let filtered = items;
  if (sourceFilter === 'calls') {
    filtered = filtered.filter(i => i.sourceType === 'call');
  } else if (sourceFilter === 'space') {
    filtered = filtered.filter(i => i.sourceType === 'space');
  }

  // Count INFO excluding dismissed
  const infoItems = filtered.filter(i => i.status === 'info');
  const visibleInfoCount = dismissedIds && dismissedIds.size > 0
    ? infoItems.filter(i => !dismissedIds.has(`${i.sourceType}-${i.sourceId}`)).length
    : infoItems.length;

  return {
    action: filtered.filter(i => i.status === 'action').length,
    pending: filtered.filter(i => i.status === 'pending').length,
    failed: filtered.filter(i => i.status === 'failed').length,
    info: visibleInfoCount,
    total: filtered.length,
  };
}

// ═══════════════════════════════════════════════════════════════
// SORT INBOX ITEMS
// ═══════════════════════════════════════════════════════════════

export function sortInboxItems(items: InboxItem[], tab: InboxTab): InboxItem[] {
  const sorted = [...items];

  sorted.sort((a, b) => {
    // For ACTION: items with open tasks first, then by newest
    if (tab === 'action') {
      const aHasTasks = (a.taskOpenCount || 0) > 0 ? 1 : 0;
      const bHasTasks = (b.taskOpenCount || 0) > 0 ? 1 : 0;
      if (aHasTasks !== bHasTasks) {
        return bHasTasks - aHasTasks; // Tasks first
      }
    }

    // For PENDING: oldest first (to see what's stuck)
    if (tab === 'pending') {
      const aTime = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const bTime = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      return aTime - bTime; // Oldest first
    }

    // For FAILED and INFO: newest first
    const aTime = a.createdAt ? new Date(a.createdAt).getTime() : 0;
    const bTime = b.createdAt ? new Date(b.createdAt).getTime() : 0;
    return bTime - aTime; // Newest first
  });

  return sorted;
}

// ═══════════════════════════════════════════════════════════════
// DISMISSED INFO PERSISTENCE (localStorage)
// ═══════════════════════════════════════════════════════════════

const DISMISSED_KEY_PREFIX = 'aras.inbox.dismissed';

export function getDismissedKey(userId: string): string {
  return `${DISMISSED_KEY_PREFIX}.${userId}`;
}

export function loadDismissedIds(userId: string): Set<string> {
  try {
    const key = getDismissedKey(userId);
    const stored = localStorage.getItem(key);
    if (stored) {
      const arr = JSON.parse(stored);
      return new Set(Array.isArray(arr) ? arr : []);
    }
  } catch (err) {
    console.error('[Inbox] Failed to load dismissed IDs:', err);
  }
  return new Set();
}

export function saveDismissedIds(userId: string, ids: Set<string>): void {
  try {
    const key = getDismissedKey(userId);
    localStorage.setItem(key, JSON.stringify([...ids]));
  } catch (err) {
    console.error('[Inbox] Failed to save dismissed IDs:', err);
  }
}

export function dismissInfoItem(userId: string, item: InboxItem): Set<string> {
  const current = loadDismissedIds(userId);
  const itemKey = `${item.sourceType}-${item.sourceId}`;
  current.add(itemKey);
  saveDismissedIds(userId, current);
  return current;
}

export function clearDismissedIds(userId: string): void {
  try {
    const key = getDismissedKey(userId);
    localStorage.removeItem(key);
  } catch (err) {
    console.error('[Inbox] Failed to clear dismissed IDs:', err);
  }
}

// ═══════════════════════════════════════════════════════════════
// BATCH TASK CREATION HELPER
// ═══════════════════════════════════════════════════════════════

export interface BatchTaskResult {
  created: number;
  skipped: number;
  failed: number;
  errors: string[];
}

export async function createTasksFromInboxItems(
  items: InboxItem[],
  maxCount: number = 10
): Promise<BatchTaskResult> {
  const result: BatchTaskResult = { created: 0, skipped: 0, failed: 0, errors: [] };

  // Only items with nextStep
  const actionable = items.filter(i => i.nextStep).slice(0, maxCount);

  for (const item of actionable) {
    try {
      const res = await fetch('/api/user/tasks', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: item.nextStep!.slice(0, 180),
          sourceType: item.sourceType,
          sourceId: item.sourceId,
        }),
      });

      if (res.status === 409) {
        result.skipped++;
      } else if (res.ok) {
        result.created++;
      } else {
        result.failed++;
        result.errors.push(`${item.title}: Server Error (${res.status})`);
      }
    } catch (err) {
      result.failed++;
      result.errors.push(`${item.title}: Verbindungsfehler`);
    }
  }

  return result;
}

// ═══════════════════════════════════════════════════════════════
// COPY FAILED ITEMS TO CLIPBOARD
// ═══════════════════════════════════════════════════════════════

export async function copyFailedItemsToClipboard(items: InboxItem[]): Promise<boolean> {
  const lines = items.map(item => {
    const time = item.createdAt 
      ? new Date(item.createdAt).toLocaleString('de-DE', { dateStyle: 'short', timeStyle: 'short' })
      : '—';
    const status = item.error || 'Fehlgeschlagen';
    return `${item.title} | ${time} | ${status}`;
  });

  const text = lines.join('\n');

  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}
