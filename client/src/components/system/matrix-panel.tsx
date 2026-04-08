/**
 * MatrixPanel - Tech Terminal Component
 * Premium matrix-style display for system data
 * Never shows fake data - missing values display as "—"
 */

import { type ReactNode, useMemo } from 'react';
import { motion } from 'framer-motion';
import { staggerDelay, prefersReducedMotion } from '@/lib/motion/aras-motion';
import { asArray } from '@/lib/utils/safe';

export interface MatrixLine {
  label: string;
  value: string | number | null | undefined;
  tone?: 'ok' | 'warn' | 'bad' | 'info';
}

interface MatrixPanelProps {
  title: string;
  lines: MatrixLine[];
  footer?: ReactNode;
  accent?: 'green' | 'orange';
  statusChip?: {
    label: string;
    tone: 'ok' | 'warn' | 'bad' | 'info';
  };
  helpText?: string;
  onHelpClick?: () => void;
}

// Tone to color mapping
const toneColors = {
  ok: { text: '#22c55e', bg: 'rgba(34, 197, 94, 0.12)' },
  warn: { text: '#f59e0b', bg: 'rgba(245, 158, 11, 0.12)' },
  bad: { text: '#ef4444', bg: 'rgba(239, 68, 68, 0.12)' },
  info: { text: '#3b82f6', bg: 'rgba(59, 130, 246, 0.12)' },
};

// Format value - never return undefined/null, always "—"
function formatValue(value: string | number | null | undefined): string {
  if (value === null || value === undefined || value === '') {
    return '—';
  }
  return String(value);
}

export function MatrixPanel({
  title,
  lines,
  footer,
  accent = 'green',
  statusChip,
  helpText,
  onHelpClick,
}: MatrixPanelProps) {
  // NULL-SAFE: Always work with array
  const safeLines = asArray<MatrixLine>(lines);
  
  const accentColor = accent === 'green' ? '#00ff9a' : '#ff6a00';
  const accentColorDim = accent === 'green' ? 'rgba(0,255,154,0.5)' : 'rgba(255,106,0,0.5)';
  const accentBg = accent === 'green' ? 'rgba(0,255,154,0.02)' : 'rgba(255,106,0,0.02)';
  const accentBorder = accent === 'green' ? 'rgba(0,255,154,0.12)' : 'rgba(255,106,0,0.12)';

  const reducedMotion = useMemo(() => prefersReducedMotion(), []);

  return (
    <motion.div
      initial={reducedMotion ? false : { opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.42, ease: [0.32, 0.72, 0, 1] }}
      className="relative rounded-2xl overflow-hidden aras-matrix-scanlines"
      style={{
        background: accentBg,
        border: `1px solid ${accentBorder}`,
        boxShadow: accent === 'green' 
          ? '0 0 20px rgba(0, 255, 154, 0.06)' 
          : '0 0 20px rgba(255, 106, 0, 0.06)',
      }}
    >
      {/* Corner highlights */}
      <div 
        className="absolute top-0 left-0 w-3 h-[1px]"
        style={{ background: `linear-gradient(90deg, ${accentColor}, transparent)` }}
      />
      <div 
        className="absolute top-0 left-0 h-3 w-[1px]"
        style={{ background: `linear-gradient(180deg, ${accentColor}, transparent)` }}
      />
      <div 
        className="absolute top-0 right-0 w-3 h-[1px]"
        style={{ background: `linear-gradient(-90deg, ${accentColor}, transparent)` }}
      />
      <div 
        className="absolute top-0 right-0 h-3 w-[1px]"
        style={{ background: `linear-gradient(180deg, ${accentColor}, transparent)` }}
      />

      {/* Header */}
      <div 
        className="px-4 py-3 flex items-center justify-between border-b relative z-10"
        style={{ borderColor: accentBorder }}
      >
        <div className="flex items-center gap-2">
          {/* Terminal cursor indicator */}
          <div 
            className="w-2 h-2 rounded-full"
            style={{ 
              background: accentColor,
              boxShadow: `0 0 8px ${accentColor}`,
              animation: reducedMotion ? 'none' : 'pulse 2s infinite',
            }}
          />
          <h3 
            className="text-[10px] font-bold uppercase tracking-[0.2em]"
            style={{ 
              fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
              color: accentColor,
              textShadow: `0 0 12px ${accentColorDim}`,
            }}
          >
            {title}
          </h3>
        </div>

        <div className="flex items-center gap-2">
          {/* Help link */}
          {helpText && onHelpClick && (
            <button
              onClick={onHelpClick}
              className="text-[9px] font-medium transition-colors hover:underline"
              style={{ color: 'rgba(255,255,255,0.4)' }}
            >
              Was ist das?
            </button>
          )}

          {/* Status chip */}
          {statusChip && (
            <span
              className="text-[9px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded"
              style={{
                background: toneColors[statusChip.tone].bg,
                color: toneColors[statusChip.tone].text,
              }}
            >
              {statusChip.label}
            </span>
          )}
        </div>
      </div>

      {/* Lines */}
      <div className="p-4 relative z-10">
        <div 
          className="space-y-2 text-[11px]"
          style={{ fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace' }}
        >
          {safeLines.map((line, idx) => {
            const displayValue = formatValue(line.value);
            const isEmpty = displayValue === '—';
            const valueColor = line.tone 
              ? toneColors[line.tone].text 
              : isEmpty 
                ? 'rgba(255,255,255,0.3)' 
                : accentColor;

            return (
              <motion.div
                key={line.label}
                initial={reducedMotion ? false : { opacity: 0, x: -4 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ 
                  duration: 0.3, 
                  delay: staggerDelay(idx, 0.05, 0.1),
                  ease: [0.32, 0.72, 0, 1],
                }}
                className="flex items-center justify-between"
              >
                <span style={{ color: 'rgba(255,255,255,0.5)' }}>
                  {line.label.toUpperCase()}:
                </span>
                <span 
                  style={{ 
                    color: valueColor,
                    textShadow: !isEmpty && !line.tone ? `0 0 8px ${accentColorDim}` : 'none',
                  }}
                >
                  {displayValue}
                </span>
              </motion.div>
            );
          })}
        </div>
      </div>

      {/* Footer */}
      {footer && (
        <div 
          className="px-4 py-3 border-t relative z-10"
          style={{ borderColor: accentBorder }}
        >
          {footer}
        </div>
      )}

      {/* Pulse animation keyframe */}
      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
      `}</style>
    </motion.div>
  );
}

export default MatrixPanel;
