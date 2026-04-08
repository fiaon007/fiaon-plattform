/**
 * ARAS Contact Insights Engine
 * Aggregates contact data from calls, spaces, and tasks
 * No fake data - only real fields
 */

import {
  type ContactRef,
  buildContactRefFromCall,
  buildContactRefFromSpace,
  buildContactRefFromTask,
} from './contact-key';

// ═══════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════

export interface ContactInsight {
  ref: ContactRef;
  lastActivityAt?: string | number | Date;
  lastActivityType?: 'call' | 'space' | 'task';
  openTasks: number;
  pendingCount: number;
  failedCount: number;
  actionCount: number;
  lastOutcome?: string;
  lastNextStep?: string;
  sources: {
    calls: string[];
    spaces: string[];
    tasks: string[];
  };
}

interface BuildInsightsParams {
  calls: any[];
  spaces: any[];
  tasks: any[];
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

function parseTimestamp(val: unknown): number | undefined {
  if (!val) return undefined;
  if (typeof val === 'number') return val;
  if (typeof val === 'string') {
    const parsed = new Date(val).getTime();
    return isNaN(parsed) ? undefined : parsed;
  }
  if (val instanceof Date) {
    const time = val.getTime();
    return isNaN(time) ? undefined : time;
  }
  return undefined;
}

// ═══════════════════════════════════════════════════════════════
// EXTRACT NEXT STEP / OUTCOME (real data only)
// ═══════════════════════════════════════════════════════════════

function extractNextStep(item: any, type: 'call' | 'space'): string | undefined {
  if (type === 'call') {
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
  } else if (type === 'space') {
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

function extractOutcome(item: any, type: 'call' | 'space'): string | undefined {
  if (type === 'call') {
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
  } else if (type === 'space') {
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
// STATUS DETECTION
// ═══════════════════════════════════════════════════════════════

function isPending(item: any): boolean {
  const summaryStatus = safeString(item.summaryStatus);
  const status = safeString(item.status);
  return summaryStatus === 'pending' || status === 'pending' || status === 'processing' || status === 'in_progress';
}

function isFailed(item: any): boolean {
  const summaryStatus = safeString(item.summaryStatus);
  const status = safeString(item.status);
  const hasError = !!safeString(item.error) || !!safeString(item.summaryError);
  return summaryStatus === 'failed' || status === 'failed' || status === 'error' || hasError;
}

function hasAction(item: any, type: 'call' | 'space'): boolean {
  return !!extractNextStep(item, type);
}

// ═══════════════════════════════════════════════════════════════
// BUILD CONTACT INSIGHTS
// ═══════════════════════════════════════════════════════════════

export function buildContactInsights({ calls, spaces, tasks }: BuildInsightsParams): ContactInsight[] {
  const insightsMap = new Map<string, ContactInsight>();
  
  // Build lookup maps for task resolution
  const callsById = new Map<string, any>();
  const spacesById = new Map<string, any>();
  
  for (const call of safeArray(calls)) {
    if (call.id) callsById.set(String(call.id), call);
  }
  for (const space of safeArray(spaces)) {
    if (space.id) spacesById.set(String(space.id), space);
  }
  
  const lookup = { callsById, spacesById };

  // Helper to get or create insight
  const getOrCreateInsight = (ref: ContactRef): ContactInsight => {
    let insight = insightsMap.get(ref.key);
    if (!insight) {
      insight = {
        ref,
        openTasks: 0,
        pendingCount: 0,
        failedCount: 0,
        actionCount: 0,
        sources: { calls: [], spaces: [], tasks: [] },
      };
      insightsMap.set(ref.key, insight);
    }
    return insight;
  };

  // Process calls
  for (const call of safeArray(calls)) {
    const ref = buildContactRefFromCall(call);
    if (!ref) continue;

    const insight = getOrCreateInsight(ref);
    const callId = String(call.id);
    
    if (!insight.sources.calls.includes(callId)) {
      insight.sources.calls.push(callId);
    }

    // Update timestamps
    const timestamp = parseTimestamp(call.createdAt);
    if (timestamp) {
      const currentLast = parseTimestamp(insight.lastActivityAt);
      if (!currentLast || timestamp > currentLast) {
        insight.lastActivityAt = timestamp;
        insight.lastActivityType = 'call';
        
        // Update outcome/nextStep from most recent
        const outcome = extractOutcome(call, 'call');
        if (outcome) insight.lastOutcome = outcome;
        
        const nextStep = extractNextStep(call, 'call');
        if (nextStep) insight.lastNextStep = nextStep;
      }
    }

    // Count statuses
    if (isPending(call)) insight.pendingCount++;
    if (isFailed(call)) insight.failedCount++;
    if (hasAction(call, 'call')) insight.actionCount++;
  }

  // Process spaces
  for (const space of safeArray(spaces)) {
    const ref = buildContactRefFromSpace(space);
    if (!ref) continue;

    const insight = getOrCreateInsight(ref);
    const spaceId = String(space.id);
    
    if (!insight.sources.spaces.includes(spaceId)) {
      insight.sources.spaces.push(spaceId);
    }

    // Update timestamps
    const timestamp = parseTimestamp(space.lastMessageAt) || 
                     parseTimestamp(space.updatedAt) || 
                     parseTimestamp(space.createdAt);
    if (timestamp) {
      const currentLast = parseTimestamp(insight.lastActivityAt);
      if (!currentLast || timestamp > currentLast) {
        insight.lastActivityAt = timestamp;
        insight.lastActivityType = 'space';
        
        const outcome = extractOutcome(space, 'space');
        if (outcome) insight.lastOutcome = outcome;
        
        const nextStep = extractNextStep(space, 'space');
        if (nextStep) insight.lastNextStep = nextStep;
      }
    }

    // Count statuses
    if (isPending(space)) insight.pendingCount++;
    if (isFailed(space)) insight.failedCount++;
    if (hasAction(space, 'space')) insight.actionCount++;
  }

  // Process tasks
  for (const task of safeArray(tasks)) {
    const ref = buildContactRefFromTask(task, lookup);
    if (!ref) continue;

    const insight = getOrCreateInsight(ref);
    const taskId = String(task.id);
    
    if (!insight.sources.tasks.includes(taskId)) {
      insight.sources.tasks.push(taskId);
    }

    // Check if task is open
    const isDone = task.done === true || task.status === 'done' || task.status === 'completed';
    const isSnoozed = task.snoozedUntil && new Date(task.snoozedUntil).getTime() > Date.now();
    
    if (!isDone && !isSnoozed) {
      insight.openTasks++;
    }

    // Update timestamps from task
    const timestamp = parseTimestamp(task.createdAt) || parseTimestamp(task.updatedAt);
    if (timestamp) {
      const currentLast = parseTimestamp(insight.lastActivityAt);
      if (!currentLast || timestamp > currentLast) {
        insight.lastActivityAt = timestamp;
        insight.lastActivityType = 'task';
      }
    }
  }

  return Array.from(insightsMap.values());
}

// ═══════════════════════════════════════════════════════════════
// RANK CONTACTS (deterministic, no fantasy)
// ═══════════════════════════════════════════════════════════════

export function rankContacts(list: ContactInsight[]): ContactInsight[] {
  return [...list].sort((a, b) => {
    // 1. Failed count (desc) - problems first
    if (a.failedCount !== b.failedCount) {
      return b.failedCount - a.failedCount;
    }

    // 2. Open tasks (desc) - people with pending work
    if (a.openTasks !== b.openTasks) {
      return b.openTasks - a.openTasks;
    }

    // 3. Action count (desc) - people with next steps
    if (a.actionCount !== b.actionCount) {
      return b.actionCount - a.actionCount;
    }

    // 4. Pending count (desc) - processing items
    if (a.pendingCount !== b.pendingCount) {
      return b.pendingCount - a.pendingCount;
    }

    // 5. Last activity (desc) - most recent first
    const aTime = parseTimestamp(a.lastActivityAt) || 0;
    const bTime = parseTimestamp(b.lastActivityAt) || 0;
    
    // Items without timestamp go to the end
    if (aTime === 0 && bTime === 0) return 0;
    if (aTime === 0) return 1;
    if (bTime === 0) return -1;
    
    return bTime - aTime;
  });
}

// ═══════════════════════════════════════════════════════════════
// GET BEST SOURCE FOR OPENING (newest call/space)
// ═══════════════════════════════════════════════════════════════

export function getBestSourceToOpen(
  insight: ContactInsight,
  callsById: Map<string, any>,
  spacesById: Map<string, any>
): { type: 'call' | 'space'; id: string; raw: any } | null {
  let bestSource: { type: 'call' | 'space'; id: string; raw: any; timestamp: number } | null = null;

  // Check calls
  for (const callId of insight.sources.calls) {
    const call = callsById.get(callId);
    if (call) {
      const timestamp = parseTimestamp(call.createdAt) || 0;
      if (!bestSource || timestamp > bestSource.timestamp) {
        bestSource = { type: 'call', id: callId, raw: call, timestamp };
      }
    }
  }

  // Check spaces
  for (const spaceId of insight.sources.spaces) {
    const space = spacesById.get(spaceId);
    if (space) {
      const timestamp = parseTimestamp(space.lastMessageAt) || 
                       parseTimestamp(space.updatedAt) || 
                       parseTimestamp(space.createdAt) || 0;
      if (!bestSource || timestamp > bestSource.timestamp) {
        bestSource = { type: 'space', id: spaceId, raw: space, timestamp };
      }
    }
  }

  if (bestSource) {
    return { type: bestSource.type, id: bestSource.id, raw: bestSource.raw };
  }

  return null;
}
