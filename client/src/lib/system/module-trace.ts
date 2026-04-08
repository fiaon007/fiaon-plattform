/**
 * ARAS Module Trace - Ultra-lightweight forensic trace for Safari TDZ debugging
 * Zero dependencies. Safe to import anywhere.
 * 
 * Usage: markModule('dashboard:init') at key points
 * In error boundary: getLastMarks(40) shows crash path
 */

interface TraceData {
  marks: string[];
  push: (mark: string) => void;
  last: (n?: number) => string[];
}

// Initialize trace on window (survives module reloads)
function initTrace(): TraceData {
  const MAX_MARKS = 200;
  
  if (typeof window !== 'undefined') {
    // Reuse existing trace if present
    if ((window as any).__ARAS_TRACE__) {
      return (window as any).__ARAS_TRACE__;
    }
    
    const trace: TraceData = {
      marks: [],
      push(mark: string) {
        const entry = `${Date.now()}|${mark}`;
        this.marks.push(entry);
        // Hard cap to prevent memory bloat
        if (this.marks.length > MAX_MARKS) {
          this.marks.shift();
        }
      },
      last(n = 40) {
        return this.marks.slice(-n);
      },
    };
    
    (window as any).__ARAS_TRACE__ = trace;
    return trace;
  }
  
  // SSR fallback (no-op)
  return {
    marks: [],
    push() {},
    last() { return []; },
  };
}

const trace = initTrace();

/**
 * Mark a module/checkpoint in the trace
 * Safe to call anywhere - no side effects
 */
export function markModule(name: string): void {
  trace.push(name);
}

/**
 * Get last N marks for debugging
 */
export function getLastMarks(n = 40): string[] {
  return trace.last(n);
}

/**
 * Format marks for display in error boundary
 */
export function formatTraceForDisplay(): string {
  const marks = getLastMarks(40);
  if (marks.length === 0) {
    return '(no trace marks)';
  }
  return marks.map((m, i) => {
    const [ts, name] = m.split('|');
    const time = new Date(parseInt(ts, 10)).toISOString().slice(11, 23);
    return `${i + 1}. [${time}] ${name}`;
  }).join('\n');
}
