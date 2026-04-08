/**
 * Task Extractor - Extracts actionable tasks from Call/Space nextStep summaries
 * Rule-based, no hallucination - only extracts what's actually in the text
 */

import { createHash } from 'crypto';

export interface ExtractedTask {
  title: string;
  priority: 'low' | 'medium' | 'high';
  dueAt: Date | null;
  details?: string;
}

// Priority keywords (German)
const HIGH_PRIORITY_KEYWORDS = [
  'termin', 'angebot', 'rückruf', 'sofort', 'dringend', 'heute', 'asap',
  'wichtig', 'deadline', 'frist', 'morgen', 'urgent'
];

const MEDIUM_PRIORITY_KEYWORDS = [
  'nachfassen', 'mail', 'info', 'senden', 'schicken', 'kontaktieren',
  'prüfen', 'checken', 'klären', 'besprechen'
];

// Date extraction patterns (German)
const DATE_PATTERNS: Array<{ pattern: RegExp; getDate: () => Date }> = [
  {
    pattern: /\bheute\b/i,
    getDate: () => {
      const d = new Date();
      d.setHours(18, 0, 0, 0);
      return d;
    }
  },
  {
    pattern: /\bmorgen\b/i,
    getDate: () => {
      const d = new Date();
      d.setDate(d.getDate() + 1);
      d.setHours(9, 0, 0, 0);
      return d;
    }
  },
  {
    pattern: /\bübermorgen\b/i,
    getDate: () => {
      const d = new Date();
      d.setDate(d.getDate() + 2);
      d.setHours(9, 0, 0, 0);
      return d;
    }
  },
  {
    pattern: /\bnächste woche\b/i,
    getDate: () => {
      const d = new Date();
      d.setDate(d.getDate() + 7);
      d.setHours(9, 0, 0, 0);
      return d;
    }
  },
  {
    pattern: /\bmontag\b/i,
    getDate: () => getNextWeekday(1)
  },
  {
    pattern: /\bdienstag\b/i,
    getDate: () => getNextWeekday(2)
  },
  {
    pattern: /\bmittwoch\b/i,
    getDate: () => getNextWeekday(3)
  },
  {
    pattern: /\bdonnerstag\b/i,
    getDate: () => getNextWeekday(4)
  },
  {
    pattern: /\bfreitag\b/i,
    getDate: () => getNextWeekday(5)
  }
];

function getNextWeekday(targetDay: number): Date {
  const d = new Date();
  const currentDay = d.getDay();
  let daysUntil = targetDay - currentDay;
  if (daysUntil <= 0) daysUntil += 7;
  d.setDate(d.getDate() + daysUntil);
  d.setHours(9, 0, 0, 0);
  return d;
}

/**
 * Generate a fingerprint for deduplication
 * Based on sourceType + sourceId + normalized title
 */
export function generateFingerprint(
  sourceType: 'call' | 'space' | 'manual',
  sourceId: string,
  title: string
): string {
  const normalized = title.toLowerCase().trim().replace(/\s+/g, ' ');
  const input = `${sourceType}:${sourceId}:${normalized}`;
  return createHash('sha256').update(input).digest('hex').slice(0, 16);
}

/**
 * Extract priority from task text
 */
function extractPriority(text: string): 'low' | 'medium' | 'high' {
  const lower = text.toLowerCase();
  
  for (const keyword of HIGH_PRIORITY_KEYWORDS) {
    if (lower.includes(keyword)) return 'high';
  }
  
  for (const keyword of MEDIUM_PRIORITY_KEYWORDS) {
    if (lower.includes(keyword)) return 'medium';
  }
  
  return 'medium';
}

/**
 * Extract due date from task text (only if clearly stated)
 */
function extractDueDate(text: string): Date | null {
  for (const { pattern, getDate } of DATE_PATTERNS) {
    if (pattern.test(text)) {
      return getDate();
    }
  }
  
  // Try to match explicit date format: DD.MM. or DD.MM.YYYY
  const explicitDateMatch = text.match(/(\d{1,2})\.(\d{1,2})\.?(\d{4})?/);
  if (explicitDateMatch) {
    const day = parseInt(explicitDateMatch[1], 10);
    const month = parseInt(explicitDateMatch[2], 10) - 1;
    const year = explicitDateMatch[3] 
      ? parseInt(explicitDateMatch[3], 10) 
      : new Date().getFullYear();
    
    const date = new Date(year, month, day, 9, 0, 0, 0);
    if (!isNaN(date.getTime())) {
      return date;
    }
  }
  
  return null;
}

/**
 * Split nextStep text into individual task candidates
 */
function splitIntoCandidates(text: string): string[] {
  // Normalize
  const normalized = text.trim().replace(/\r\n/g, '\n');
  
  // Split by common bullet/list markers
  const lines = normalized.split(/[\n•\-–\*]+/);
  
  // Also try splitting by numbered items: 1. 2. 3.
  const withNumbers = lines.flatMap(line => 
    line.split(/\d+\.\s+/).filter(Boolean)
  );
  
  return withNumbers
    .map(s => s.trim())
    .filter(s => s.length >= 6 && s.length <= 180);
}

/**
 * Main extraction function: nextStep string -> array of tasks
 */
export function extractTasksFromNextStep(nextStep: string): ExtractedTask[] {
  if (!nextStep || typeof nextStep !== 'string') {
    return [];
  }
  
  const candidates = splitIntoCandidates(nextStep);
  
  // Dedupe and limit to max 5 tasks
  const seen = new Set<string>();
  const tasks: ExtractedTask[] = [];
  
  for (const candidate of candidates) {
    if (tasks.length >= 5) break;
    
    // Normalize for dedup
    const normalized = candidate.toLowerCase().trim();
    if (seen.has(normalized)) continue;
    seen.add(normalized);
    
    // Skip if too short or doesn't look like an action
    if (candidate.length < 6) continue;
    
    tasks.push({
      title: candidate.slice(0, 180),
      priority: extractPriority(candidate),
      dueAt: extractDueDate(candidate),
    });
  }
  
  // If no bullets found but we have a single nextStep, use it as one task
  if (tasks.length === 0 && nextStep.trim().length >= 6 && nextStep.trim().length <= 180) {
    tasks.push({
      title: nextStep.trim(),
      priority: extractPriority(nextStep),
      dueAt: extractDueDate(nextStep),
    });
  }
  
  return tasks;
}

/**
 * Extract tasks from a call summary
 */
export function extractTasksFromCallSummary(
  callId: string | number,
  summary: { nextStep?: string; outcome?: string } | null
): ExtractedTask[] {
  if (!summary?.nextStep) return [];
  return extractTasksFromNextStep(summary.nextStep);
}

/**
 * Extract tasks from a space session summary
 */
export function extractTasksFromSpaceSummary(
  sessionId: string | number,
  summary: { nextStep?: string; outcome?: string } | null
): ExtractedTask[] {
  if (!summary?.nextStep) return [];
  return extractTasksFromNextStep(summary.nextStep);
}
