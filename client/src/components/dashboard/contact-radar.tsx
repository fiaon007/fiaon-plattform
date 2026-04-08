/**
 * ARAS Contact Radar - Mini CRM Component
 * Prioritizes contacts by tasks, errors, and next steps
 * ARAS 2026 design - clean, futuristic, premium
 */

import React, { useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { ContactInsight } from '@/lib/contacts/contact-insights';
import { asArray } from '@/lib/utils/safe';

// Design Tokens
const DT = {
  orange: '#ff6a00',
  gold: '#e9d7c4',
  panelBg: 'rgba(0,0,0,0.35)',
  panelBorder: 'rgba(255,255,255,0.10)',
  rowBg: 'rgba(255,255,255,0.02)',
  statusFailed: '#ef4444',
  statusPending: '#f59e0b',
  statusAction: '#ff6a00',
};

// Animation config
const ANIM = {
  duration: 0.22,
  stagger: 0.04,
};

const listItemVariants = {
  hidden: { opacity: 0, x: -8 },
  visible: { opacity: 1, x: 0 },
  exit: { opacity: 0, x: 8 },
};

// ═══════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════

interface ContactRadarProps {
  insights: ContactInsight[];
  focusKey: string | null;
  onFocus: (contactKey: string) => void;
  onClearFocus: () => void;
  onOpenBest: (item: ContactInsight) => void;
  pinnedKeys: string[];
  onTogglePin: (key: string) => void;
}

// ═══════════════════════════════════════════════════════════════
// COMPONENT
// ═══════════════════════════════════════════════════════════════

export function ContactRadar({
  insights,
  focusKey,
  onFocus,
  onClearFocus,
  onOpenBest,
  pinnedKeys,
  onTogglePin,
}: ContactRadarProps) {
  // NULL-SAFE: Always work with arrays
  const safeInsights = asArray<ContactInsight>(insights);
  const safePinnedKeys = asArray<string>(pinnedKeys);
  
  // Separate pinned and unpinned
  const { pinned, unpinned } = useMemo(() => {
    const pinnedSet = new Set(safePinnedKeys);
    const pinnedItems: ContactInsight[] = [];
    const unpinnedItems: ContactInsight[] = [];

    for (const insight of safeInsights) {
      if (pinnedSet.has(insight.ref.key)) {
        pinnedItems.push(insight);
      } else {
        unpinnedItems.push(insight);
      }
    }

    return { pinned: pinnedItems, unpinned: unpinnedItems.slice(0, 8) };
  }, [safeInsights, safePinnedKeys]);

  const hasAnyContacts = safeInsights.length > 0;

  return (
    <motion.div
      data-tour="mc-contact-radar"
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: ANIM.duration, delay: 0.1 }}
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
        <h3
          className="text-sm font-bold uppercase tracking-wide"
          style={{
            background: `linear-gradient(90deg, ${DT.gold}, ${DT.orange})`,
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
          }}
        >
          Contact Radar
        </h3>
        <p className="text-[10px] text-neutral-500 mt-0.5">
          Priorisiert nach Aufgaben, Fehlern und nächsten Schritten
        </p>
      </div>

      {/* Body */}
      <div className="p-3 relative z-10 space-y-3">
        {/* Pinned Contacts Row */}
        {pinned.length > 0 && (
          <div className="space-y-1.5">
            <p className="text-[9px] uppercase tracking-wide text-neutral-600 px-1">Angepinnt</p>
            <div className="flex flex-wrap gap-1.5">
              {pinned.map((insight) => (
                <PinnedChip
                  key={insight.ref.key}
                  insight={insight}
                  isFocused={focusKey === insight.ref.key}
                  onFocus={() => onFocus(insight.ref.key)}
                  onUnpin={() => onTogglePin(insight.ref.key)}
                />
              ))}
            </div>
          </div>
        )}

        {/* Contact List */}
        {!hasAnyContacts ? (
          <div className="text-center py-6">
            <p className="text-xs text-neutral-500 mb-1">Noch keine Kontakte erkannt.</p>
            <p className="text-[10px] text-neutral-600">
              Sobald Calls/Space laufen, erscheint hier dein Radar.
            </p>
          </div>
        ) : (
          <div className="space-y-1">
            <AnimatePresence mode="popLayout">
              {unpinned.map((insight, idx) => (
                <ContactRow
                  key={insight.ref.key}
                  insight={insight}
                  index={idx}
                  isFocused={focusKey === insight.ref.key}
                  isPinned={pinnedKeys.includes(insight.ref.key)}
                  onFocus={() => onFocus(insight.ref.key)}
                  onOpen={() => onOpenBest(insight)}
                  onTogglePin={() => onTogglePin(insight.ref.key)}
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
// PINNED CHIP
// ═══════════════════════════════════════════════════════════════

interface PinnedChipProps {
  insight: ContactInsight;
  isFocused: boolean;
  onFocus: () => void;
  onUnpin: () => void;
}

function PinnedChip({ insight, isFocused, onFocus, onUnpin }: PinnedChipProps) {
  return (
    <div
      className="group flex items-center gap-1 px-2 py-1 rounded-lg transition-all"
      style={{
        background: isFocused ? 'rgba(255,106,0,0.15)' : 'rgba(255,255,255,0.04)',
        border: `1px solid ${isFocused ? 'rgba(255,106,0,0.3)' : 'rgba(255,255,255,0.08)'}`,
      }}
    >
      <button
        onClick={onFocus}
        className="text-[10px] font-medium truncate max-w-[100px] transition-colors"
        style={{ color: isFocused ? DT.orange : DT.gold }}
      >
        {insight.ref.label}
      </button>
      <button
        onClick={onUnpin}
        className="text-[9px] text-neutral-600 hover:text-red-400 transition-colors opacity-0 group-hover:opacity-100"
      >
        ×
      </button>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// CONTACT ROW
// ═══════════════════════════════════════════════════════════════

interface ContactRowProps {
  insight: ContactInsight;
  index: number;
  isFocused: boolean;
  isPinned: boolean;
  onFocus: () => void;
  onOpen: () => void;
  onTogglePin: () => void;
}

function ContactRow({
  insight,
  index,
  isFocused,
  isPinned,
  onFocus,
  onOpen,
  onTogglePin,
}: ContactRowProps) {
  const { ref, failedCount, openTasks, pendingCount, actionCount } = insight;

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
        className="flex items-center gap-2 p-2.5 rounded-xl transition-all"
        style={{
          background: isFocused ? 'rgba(255,106,0,0.08)' : DT.rowBg,
          border: `1px solid ${isFocused ? 'rgba(255,106,0,0.2)' : 'transparent'}`,
        }}
      >
        {/* Contact Info */}
        <div className="flex-1 min-w-0">
          <p
            className="text-xs font-medium truncate transition-colors"
            style={{ color: isFocused ? DT.orange : DT.gold }}
          >
            {ref.label}
          </p>
          {ref.hint && (
            <p className="text-[9px] text-neutral-600 truncate">{ref.hint}</p>
          )}
        </div>

        {/* Status Strip */}
        <div className="flex items-center gap-1 flex-shrink-0">
          {failedCount > 0 && (
            <StatusBadge label="Fehler" count={failedCount} color={DT.statusFailed} />
          )}
          {openTasks > 0 && (
            <StatusBadge label="Offen" count={openTasks} color={DT.statusAction} />
          )}
          {pendingCount > 0 && (
            <StatusBadge label="In Arbeit" count={pendingCount} color={DT.statusPending} />
          )}
          {actionCount > 0 && failedCount === 0 && openTasks === 0 && (
            <StatusBadge label="Aktion" count={actionCount} color={DT.statusAction} />
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
          <button
            onClick={onOpen}
            className="text-[9px] font-medium px-1.5 py-0.5 rounded transition-all hover:bg-white/[0.08]"
            style={{ color: DT.gold }}
          >
            Öffnen
          </button>
          <button
            onClick={onFocus}
            className="text-[9px] font-medium px-1.5 py-0.5 rounded transition-all hover:bg-white/[0.08]"
            style={{ color: isFocused ? '#888' : DT.orange }}
          >
            {isFocused ? 'Fokussiert' : 'Fokus'}
          </button>
          <button
            onClick={onTogglePin}
            className="text-[9px] font-medium px-1.5 py-0.5 rounded transition-all hover:bg-white/[0.08]"
            style={{ color: isPinned ? '#888' : '#666' }}
          >
            {isPinned ? 'Entpinnen' : 'Pin'}
          </button>
        </div>
      </div>
    </motion.div>
  );
}

// ═══════════════════════════════════════════════════════════════
// STATUS BADGE
// ═══════════════════════════════════════════════════════════════

interface StatusBadgeProps {
  label: string;
  count: number;
  color: string;
}

function StatusBadge({ label, count, color }: StatusBadgeProps) {
  return (
    <span
      className="px-1.5 py-0.5 rounded text-[8px] font-bold uppercase"
      style={{
        background: `${color}15`,
        color: color,
      }}
    >
      {label}: {count}
    </span>
  );
}

// ═══════════════════════════════════════════════════════════════
// FOCUS BAR (Sticky mini-bar when focus is active)
// ═══════════════════════════════════════════════════════════════

interface FocusBarProps {
  contactLabel: string;
  onClearFocus: () => void;
  onOpenContact: () => void;
}

export function FocusBar({ contactLabel, onClearFocus, onOpenContact }: FocusBarProps) {
  return (
    <motion.div
      data-tour="mc-focus"
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      transition={{ duration: 0.2 }}
      className="sticky top-0 z-30 mb-4"
    >
      <div
        className="flex items-center justify-between gap-3 px-4 py-2.5 rounded-xl mx-auto max-w-2xl"
        style={{
          background: 'rgba(0,0,0,0.6)',
          backdropFilter: 'blur(12px)',
          border: '1px solid rgba(255,106,0,0.3)',
          boxShadow: '0 0 20px rgba(255,106,0,0.15), inset 0 0 0 1px rgba(255,106,0,0.1)',
        }}
      >
        <div className="flex items-center gap-2">
          <span className="text-[10px] uppercase tracking-wide text-neutral-500">Fokus:</span>
          <span
            className="text-sm font-semibold"
            style={{
              background: `linear-gradient(90deg, ${DT.gold}, ${DT.orange})`,
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
            }}
          >
            {contactLabel}
          </span>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={onOpenContact}
            className="text-[10px] font-medium px-3 py-1 rounded-lg transition-all hover:bg-white/[0.08]"
            style={{ color: DT.gold }}
          >
            Kontakt öffnen
          </button>
          <button
            onClick={onClearFocus}
            className="text-[10px] font-medium px-3 py-1 rounded-lg transition-all hover:bg-white/[0.08]"
            style={{ color: '#888' }}
          >
            Fokus beenden
          </button>
        </div>
      </div>
    </motion.div>
  );
}

export default ContactRadar;
