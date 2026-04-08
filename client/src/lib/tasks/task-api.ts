/**
 * Task API Client - Clean wrapper for task operations
 * Handles auth, errors, and local fallback gracefully
 */

import type { UserTask } from '@shared/schema';

// Types
export interface TaskFilters {
  status?: 'open' | 'done' | 'all';
  sourceType?: 'call' | 'space' | 'manual';
  sourceId?: string;
  limit?: number;
  sinceDays?: number;
}

export interface CreateTaskPayload {
  title: string;
  sourceType?: 'call' | 'space' | 'manual';
  sourceId?: string;
  priority?: 'low' | 'medium' | 'high';
  dueAt?: string;
  details?: string;
}

export interface TaskApiResult<T> {
  success: boolean;
  data?: T;
  error?: string;
  isOffline?: boolean;
}

// Local storage keys
const LOCAL_TASKS_KEY = 'aras.tasks.local';
const INGEST_TIMESTAMP_KEY = 'aras.tasks.ingest.last';
const INGEST_COOLDOWN_MS = 60000; // 1 minute between ingests

/**
 * Fetch tasks with filters
 */
export async function fetchTasks(filters: TaskFilters = {}): Promise<TaskApiResult<UserTask[]>> {
  try {
    const params = new URLSearchParams();
    if (filters.status) params.set('status', filters.status);
    if (filters.sourceType) params.set('sourceType', filters.sourceType);
    if (filters.sourceId) params.set('sourceId', filters.sourceId);
    if (filters.limit) params.set('limit', String(filters.limit));
    if (filters.sinceDays) params.set('sinceDays', String(filters.sinceDays));

    const res = await fetch(`/api/user/tasks?${params.toString()}`, {
      credentials: 'include',
      headers: { 'Accept': 'application/json' },
    });

    if (res.status === 401) {
      return { success: false, error: 'Nicht angemeldet', data: [] };
    }

    if (!res.ok) {
      return { success: false, error: `Server Error (${res.status})`, data: [] };
    }

    const data = await res.json();
    return { success: true, data: Array.isArray(data) ? data : [] };
  } catch (err) {
    console.error('[TaskAPI] fetchTasks failed:', err);
    // Return local tasks as fallback
    const localTasks = getLocalTasks();
    return { 
      success: false, 
      error: 'Verbindungsfehler', 
      data: localTasks,
      isOffline: true,
    };
  }
}

/**
 * Create a new task
 */
export async function createTask(payload: CreateTaskPayload): Promise<TaskApiResult<UserTask>> {
  try {
    const res = await fetch('/api/user/tasks', {
      method: 'POST',
      credentials: 'include',
      headers: { 
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify({
        title: payload.title,
        sourceType: payload.sourceType || 'manual',
        sourceId: payload.sourceId || null,
        priority: payload.priority || 'medium',
        dueAt: payload.dueAt || null,
        details: payload.details || null,
      }),
    });

    if (res.status === 401) {
      return { success: false, error: 'Nicht angemeldet' };
    }

    if (res.status === 409) {
      return { success: false, error: 'Aufgabe existiert bereits' };
    }

    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      return { success: false, error: errData.error || `Server Error (${res.status})` };
    }

    const data = await res.json();
    return { success: true, data };
  } catch (err) {
    console.error('[TaskAPI] createTask failed:', err);
    // Store locally as fallback
    const localTask = createLocalTask(payload);
    return { 
      success: true, 
      data: localTask,
      isOffline: true,
    };
  }
}

/**
 * Create task from a next step line (convenience wrapper)
 */
export async function createTaskFromNextStep(
  line: string,
  sourceType: 'call' | 'space',
  sourceId: string,
  contactLabel?: string
): Promise<TaskApiResult<UserTask>> {
  return createTask({
    title: line.trim().slice(0, 180),
    sourceType,
    sourceId,
    details: contactLabel ? `Kontakt: ${contactLabel}` : undefined,
  });
}

/**
 * Mark task as done or undone
 */
export async function markTaskDone(taskId: number, done: boolean = true): Promise<TaskApiResult<UserTask>> {
  try {
    const res = await fetch(`/api/user/tasks/${taskId}/done`, {
      method: 'POST',
      credentials: 'include',
      headers: { 
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify({ done }),
    });

    if (res.status === 401) {
      return { success: false, error: 'Nicht angemeldet' };
    }

    if (res.status === 404) {
      return { success: false, error: 'Aufgabe nicht gefunden' };
    }

    if (!res.ok) {
      return { success: false, error: `Server Error (${res.status})` };
    }

    const data = await res.json();
    return { success: true, data };
  } catch (err) {
    console.error('[TaskAPI] markTaskDone failed:', err);
    return { success: false, error: 'Verbindungsfehler', isOffline: true };
  }
}

/**
 * Snooze task
 */
export async function snoozeTask(
  taskId: number, 
  mode: '1h' | 'tomorrow' | 'nextweek' | string
): Promise<TaskApiResult<UserTask>> {
  try {
    // Calculate snooze timestamp
    let snoozedUntil: string;
    const now = new Date();

    if (mode === '1h') {
      snoozedUntil = new Date(now.getTime() + 60 * 60 * 1000).toISOString();
    } else if (mode === 'tomorrow') {
      const tomorrow = new Date(now);
      tomorrow.setDate(tomorrow.getDate() + 1);
      tomorrow.setHours(9, 0, 0, 0);
      snoozedUntil = tomorrow.toISOString();
    } else if (mode === 'nextweek') {
      const nextWeek = new Date(now);
      nextWeek.setDate(nextWeek.getDate() + 7);
      nextWeek.setHours(9, 0, 0, 0);
      snoozedUntil = nextWeek.toISOString();
    } else {
      // Assume ISO date string
      snoozedUntil = mode;
    }

    const res = await fetch(`/api/user/tasks/${taskId}/snooze`, {
      method: 'POST',
      credentials: 'include',
      headers: { 
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify({ snoozedUntil }),
    });

    if (res.status === 401) {
      return { success: false, error: 'Nicht angemeldet' };
    }

    if (res.status === 404) {
      return { success: false, error: 'Aufgabe nicht gefunden' };
    }

    if (!res.ok) {
      return { success: false, error: `Server Error (${res.status})` };
    }

    const data = await res.json();
    return { success: true, data };
  } catch (err) {
    console.error('[TaskAPI] snoozeTask failed:', err);
    return { success: false, error: 'Verbindungsfehler', isOffline: true };
  }
}

/**
 * Unsnooze task (clear snooze)
 */
export async function unsnoozeTask(taskId: number): Promise<TaskApiResult<UserTask>> {
  try {
    const res = await fetch(`/api/user/tasks/${taskId}/snooze`, {
      method: 'POST',
      credentials: 'include',
      headers: { 
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify({ snoozedUntil: null }),
    });

    if (!res.ok) {
      return { success: false, error: `Server Error (${res.status})` };
    }

    const data = await res.json();
    return { success: true, data };
  } catch (err) {
    console.error('[TaskAPI] unsnoozeTask failed:', err);
    return { success: false, error: 'Verbindungsfehler', isOffline: true };
  }
}

/**
 * Trigger task sync from summaries (rate limited)
 */
export async function syncTasks(): Promise<TaskApiResult<{ created: number; skipped: number }>> {
  // Rate limit check
  const lastIngest = localStorage.getItem(INGEST_TIMESTAMP_KEY);
  if (lastIngest) {
    const elapsed = Date.now() - parseInt(lastIngest, 10);
    if (elapsed < INGEST_COOLDOWN_MS) {
      return { success: true, data: { created: 0, skipped: 0 } };
    }
  }

  try {
    const res = await fetch('/api/user/tasks/sync', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Accept': 'application/json' },
    });

    // Update timestamp regardless of result
    localStorage.setItem(INGEST_TIMESTAMP_KEY, String(Date.now()));

    if (res.status === 401) {
      return { success: false, error: 'Nicht angemeldet' };
    }

    if (!res.ok) {
      return { success: false, error: `Server Error (${res.status})` };
    }

    const data = await res.json();
    return { success: true, data };
  } catch (err) {
    console.error('[TaskAPI] syncTasks failed:', err);
    return { success: false, error: 'Verbindungsfehler', isOffline: true };
  }
}

/**
 * Check if sync is allowed (rate limit)
 */
export function canSyncTasks(): boolean {
  const lastIngest = localStorage.getItem(INGEST_TIMESTAMP_KEY);
  if (!lastIngest) return true;
  const elapsed = Date.now() - parseInt(lastIngest, 10);
  return elapsed >= INGEST_COOLDOWN_MS;
}

// ============================================
// LOCAL FALLBACK STORAGE
// ============================================

function getLocalTasks(): UserTask[] {
  try {
    const stored = localStorage.getItem(LOCAL_TASKS_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
}

function saveLocalTasks(tasks: UserTask[]): void {
  try {
    localStorage.setItem(LOCAL_TASKS_KEY, JSON.stringify(tasks));
  } catch (err) {
    console.error('[TaskAPI] Failed to save local tasks:', err);
  }
}

function createLocalTask(payload: CreateTaskPayload): UserTask {
  const now = new Date().toISOString();
  const tasks = getLocalTasks();
  
  const newTask: UserTask = {
    id: Date.now(), // Temporary ID
    userId: 'local',
    sourceType: payload.sourceType || 'manual',
    sourceId: payload.sourceId || null,
    fingerprint: `local-${Date.now()}`,
    title: payload.title,
    details: payload.details || null,
    priority: payload.priority || 'medium',
    dueAt: payload.dueAt ? new Date(payload.dueAt) : null,
    status: 'open',
    snoozedUntil: null,
    createdAt: new Date(now),
    updatedAt: new Date(now),
    completedAt: null,
  };

  tasks.push(newTask);
  saveLocalTasks(tasks);
  return newTask;
}

/**
 * Copy task title to clipboard
 */
export async function copyTaskToClipboard(task: UserTask): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(task.title);
    return true;
  } catch {
    return false;
  }
}
