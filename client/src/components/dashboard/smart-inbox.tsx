/**
 * ARAS Smart Inbox - Triage UI Component
 * Premium inbox experience for Mission Control
 * Classifies items: AKTION | IN ARBEIT | FEHLGESCHLAGEN | INFO
 */

import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { formatDistanceToNow } from 'date-fns';
import { de } from 'date-fns/locale';
import type { UserTask } from '@shared/schema';
import {
  type InboxItem,
  type InboxTab,
  type SourceFilter,
  type InboxCounts,
  buildInboxItems,
  filterInbox,
  countsByTab,
  sortInboxItems,
  loadDismissedIds,
  dismissInfoItem,
  clearDismissedIds,
  createTasksFromInboxItems,
  copyFailedItemsToClipboard,
} from '@/lib/inbox/triage';

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
};

// Animation variants
const ANIM = {
  duration: 0.22,
  stagger: 0.03,
};

const listItemVariants = {
  hidden: { opacity: 0, y: 8 },
  visible: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -8 },
};

// ═══════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════

interface SmartInboxProps {
  calls: any[];
  spaces: any[];
  tasks: UserTask[];
  userId: string;
  sourceFilter: SourceFilter;
  searchQuery: string;
  onOpenItem: (item: InboxItem) => void;
  onRefreshFeed: () => void;
  onSourceFilterChange: (filter: SourceFilter) => void;
  onSearchChange: (query: string) => void;
  // Queue context for drawer navigation
  inboxQueueRef?: React.MutableRefObject<{ items: InboxItem[]; currentIndex: number } | null>;
  // Focus mode filtering
  focusKey?: string | null;
}

// ═══════════════════════════════════════════════════════════════
// COMPONENT
// ═══════════════════════════════════════════════════════════════

export function SmartInbox({
  calls,
  spaces,
  tasks,
  userId,
  sourceFilter,
  searchQuery,
  onOpenItem,
  onRefreshFeed,
  onSourceFilterChange,
  onSearchChange,
  inboxQueueRef,
  focusKey,
}: SmartInboxProps) {
  // State
  const [inboxTab, setInboxTab] = useState<InboxTab>('action');
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(() => loadDismissedIds(userId));
  const [batchConfirm, setBatchConfirm] = useState<string | null>(null);
  const [batchProgress, setBatchProgress] = useState<string | null>(null);
  const [refreshCooldown, setRefreshCooldown] = useState(false);
  const [showDismissedPanel, setShowDismissedPanel] = useState(false);

  // Build all inbox items
  const allItems = useMemo(() => {
    return buildInboxItems({ calls, spaces, tasks });
  }, [calls, spaces, tasks]);

  // Counts per tab (for badges)
  const counts = useMemo(() => {
    return countsByTab(allItems, sourceFilter, dismissedIds);
  }, [allItems, sourceFilter, dismissedIds]);

  // Filtered and sorted items for current view
  const { displayItems, unfocusedCount } = useMemo(() => {
    const result = filterInbox({
      items: allItems,
      sourceFilter,
      tab: inboxTab,
      query: searchQuery,
      dismissedIds: inboxTab === 'info' ? dismissedIds : undefined,
      focusKey,
    });
    return {
      displayItems: sortInboxItems(result.items, inboxTab),
      unfocusedCount: result.unfocusedCount,
    };
  }, [allItems, sourceFilter, inboxTab, searchQuery, dismissedIds, focusKey]);

  // Update queue ref for drawer navigation
  useEffect(() => {
    if (inboxQueueRef) {
      inboxQueueRef.current = { items: displayItems, currentIndex: 0 };
    }
  }, [displayItems, inboxQueueRef]);

  // ═══════════════════════════════════════════════════════════════
  // BATCH ACTIONS
  // ═══════════════════════════════════════════════════════════════

  const handleBatchCreateTasks = useCallback(async () => {
    if (batchConfirm !== 'create-tasks') {
      setBatchConfirm('create-tasks');
      return;
    }

    setBatchConfirm(null);
    setBatchProgress('0/10');

    const itemsWithNextStep = displayItems.filter(i => i.nextStep).slice(0, 10);
    let created = 0;
    let skipped = 0;

    for (let i = 0; i < itemsWithNextStep.length; i++) {
      const item = itemsWithNextStep[i];
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
          skipped++;
        } else if (res.ok) {
          created++;
        }
      } catch {
        // Continue on error
      }
      setBatchProgress(`${i + 1}/${itemsWithNextStep.length}`);
    }

    setBatchProgress(`${created} erstellt, ${skipped} übersprungen`);
    setTimeout(() => setBatchProgress(null), 3000);
  }, [batchConfirm, displayItems]);

  const handleOpenQueue = useCallback(() => {
    if (displayItems.length > 0) {
      if (inboxQueueRef) {
        inboxQueueRef.current = { items: displayItems, currentIndex: 0 };
      }
      onOpenItem(displayItems[0]);
    }
  }, [displayItems, onOpenItem, inboxQueueRef]);

  const handleRefreshFeed = useCallback(() => {
    if (refreshCooldown) return;
    onRefreshFeed();
    setRefreshCooldown(true);
    setTimeout(() => setRefreshCooldown(false), 30000);
  }, [refreshCooldown, onRefreshFeed]);

  const handleCopyFailed = useCallback(async () => {
    const success = await copyFailedItemsToClipboard(displayItems);
    setBatchProgress(success ? 'In Zwischenablage kopiert' : 'Kopieren fehlgeschlagen');
    setTimeout(() => setBatchProgress(null), 2000);
  }, [displayItems]);

  const handleDismissItem = useCallback((item: InboxItem) => {
    const newDismissed = dismissInfoItem(userId, item);
    setDismissedIds(new Set(newDismissed));
  }, [userId]);

  const handleClearDismissed = useCallback(() => {
    clearDismissedIds(userId);
    setDismissedIds(new Set());
    setShowDismissedPanel(false);
  }, [userId]);

  // ═══════════════════════════════════════════════════════════════
  // TAB CONFIG
  // ═══════════════════════════════════════════════════════════════

  const tabConfig: { key: InboxTab; label: string; count: number }[] = [
    { key: 'action', label: 'Aktion', count: counts.action },
    { key: 'pending', label: 'In Arbeit', count: counts.pending },
    { key: 'failed', label: 'Fehlgeschlagen', count: counts.failed },
    { key: 'info', label: 'Info', count: counts.info },
  ];

  // ═══════════════════════════════════════════════════════════════
  // RENDER
  // ═══════════════════════════════════════════════════════════════

  return (
    <div className="space-y-3">
      {/* Source Filter Tabs - preserve existing */}
      <div className="flex items-center gap-1 p-0.5 rounded-lg" style={{ background: 'rgba(255,255,255,0.03)' }}>
        {(['all', 'calls', 'space'] as SourceFilter[]).map(filter => (
          <button
            key={filter}
            onClick={() => onSourceFilterChange(filter)}
            className="px-3 py-1.5 rounded-md text-[10px] font-semibold uppercase tracking-wide transition-all"
            style={{
              background: sourceFilter === filter ? 'rgba(255,106,0,0.12)' : 'transparent',
              color: sourceFilter === filter ? DT.orange : '#888',
              border: sourceFilter === filter ? '1px solid rgba(255,106,0,0.25)' : '1px solid transparent',
            }}
          >
            {filter === 'all' ? 'Alles' : filter === 'calls' ? 'Calls' : 'Space'}
          </button>
        ))}
      </div>

      {/* Inbox Tabs */}
      <div 
        data-tour="mc-inbox-tabs"
        className="flex items-center gap-1 p-0.5 rounded-lg" 
        style={{ background: 'rgba(255,255,255,0.02)' }}
      >
        {tabConfig.map(({ key, label, count }) => {
          const isActive = inboxTab === key;
          const statusColor = key === 'action' ? DT.statusAction
            : key === 'pending' ? DT.statusPending
            : key === 'failed' ? DT.statusFailed
            : DT.statusInfo;

          return (
            <button
              key={key}
              onClick={() => setInboxTab(key)}
              className="relative px-3 py-1.5 rounded-md text-[10px] font-semibold uppercase tracking-wide transition-all flex items-center gap-1.5"
              style={{
                background: isActive ? 'rgba(255,255,255,0.06)' : 'transparent',
                color: isActive ? '#fff' : '#777',
                border: isActive ? '1px solid rgba(255,255,255,0.1)' : '1px solid transparent',
                boxShadow: isActive ? 'inset 0 1px 2px rgba(0,0,0,0.2)' : 'none',
              }}
            >
              {label}
              {count > 0 && (
                <span
                  className="px-1.5 py-0.5 rounded text-[9px] font-bold"
                  style={{
                    background: isActive ? `${statusColor}20` : 'rgba(255,255,255,0.06)',
                    color: isActive ? statusColor : '#666',
                  }}
                >
                  {count}
                </span>
              )}
              {isActive && (
                <motion.div
                  layoutId="inbox-tab-indicator"
                  className="absolute bottom-0 left-1/2 -translate-x-1/2 w-6 h-0.5 rounded-full"
                  style={{ background: `linear-gradient(90deg, ${DT.orange}, ${DT.gold})` }}
                />
              )}
            </button>
          );
        })}
      </div>

      {/* Batch Actions Row */}
      <div 
        data-tour="mc-inbox-actions"
        className="flex items-center justify-between gap-2 px-1"
      >
        <div className="flex items-center gap-2">
          {/* Tab-specific actions */}
          {inboxTab === 'action' && (
            <>
              {batchConfirm === 'create-tasks' ? (
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-neutral-400">Wirklich erstellen?</span>
                  <button
                    onClick={handleBatchCreateTasks}
                    className="text-[10px] font-medium px-2 py-1 rounded transition-all hover:bg-white/[0.06]"
                    style={{ color: DT.orange }}
                  >
                    Ja
                  </button>
                  <button
                    onClick={() => setBatchConfirm(null)}
                    className="text-[10px] font-medium px-2 py-1 rounded transition-all hover:bg-white/[0.06]"
                    style={{ color: '#888' }}
                  >
                    Abbrechen
                  </button>
                </div>
              ) : (
                <button
                  onClick={handleBatchCreateTasks}
                  disabled={!displayItems.some(i => i.nextStep)}
                  className="text-[10px] font-medium px-2 py-1 rounded transition-all hover:bg-white/[0.06] disabled:opacity-40"
                  style={{ color: DT.orange, border: '1px solid rgba(255,106,0,0.2)' }}
                >
                  Aufgaben erstellen (max 10)
                </button>
              )}
              <button
                onClick={handleOpenQueue}
                disabled={displayItems.length === 0}
                className="text-[10px] font-medium px-2 py-1 rounded transition-all hover:bg-white/[0.06] disabled:opacity-40"
                style={{ color: '#aaa' }}
              >
                Alle öffnen
              </button>
            </>
          )}

          {inboxTab === 'pending' && (
            <>
              <button
                onClick={handleRefreshFeed}
                disabled={refreshCooldown}
                className="text-[10px] font-medium px-2 py-1 rounded transition-all hover:bg-white/[0.06] disabled:opacity-40"
                style={{ color: DT.statusPending, border: '1px solid rgba(245,158,11,0.2)' }}
              >
                {refreshCooldown ? 'Cooldown...' : 'Jetzt aktualisieren'}
              </button>
            </>
          )}

          {inboxTab === 'failed' && (
            <>
              <button
                onClick={handleOpenQueue}
                disabled={displayItems.length === 0}
                className="text-[10px] font-medium px-2 py-1 rounded transition-all hover:bg-white/[0.06] disabled:opacity-40"
                style={{ color: DT.statusFailed, border: '1px solid rgba(239,68,68,0.2)' }}
              >
                Alle prüfen
              </button>
              <button
                onClick={handleCopyFailed}
                disabled={displayItems.length === 0}
                className="text-[10px] font-medium px-2 py-1 rounded transition-all hover:bg-white/[0.06] disabled:opacity-40"
                style={{ color: '#aaa' }}
              >
                Kopieren
              </button>
            </>
          )}

          {inboxTab === 'info' && (
            <>
              <button
                onClick={() => setShowDismissedPanel(!showDismissedPanel)}
                className="text-[10px] font-medium px-2 py-1 rounded transition-all hover:bg-white/[0.06]"
                style={{ color: '#888' }}
              >
                Ausblendungen ({dismissedIds.size})
              </button>
            </>
          )}
        </div>

        {/* Progress indicator */}
        {batchProgress && (
          <span className="text-[10px] font-medium" style={{ color: DT.gold }}>
            {batchProgress}
          </span>
        )}
      </div>

      {/* Dismissed Panel (INFO tab only) */}
      <AnimatePresence>
        {showDismissedPanel && inboxTab === 'info' && dismissedIds.size > 0 && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="px-3 py-2 rounded-lg text-[10px]"
            style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}
          >
            <div className="flex items-center justify-between">
              <span className="text-neutral-400">
                {dismissedIds.size} ausgeblendet (nur dieses Gerät)
              </span>
              <button
                onClick={handleClearDismissed}
                className="font-medium px-2 py-0.5 rounded hover:bg-white/[0.06] transition-all"
                style={{ color: DT.orange }}
              >
                Alles einblenden
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Search Input */}
      <input
        type="text"
        value={searchQuery}
        onChange={(e) => onSearchChange(e.target.value)}
        placeholder="Suchen..."
        className="w-full px-3 py-2 rounded-lg text-xs bg-transparent outline-none transition-all"
        style={{
          background: 'rgba(255,255,255,0.03)',
          border: '1px solid rgba(255,255,255,0.08)',
          color: '#ddd',
        }}
      />

      {/* Focus mode hint */}
      {focusKey && unfocusedCount > 0 && (
        <div className="px-2 py-1.5 rounded-lg text-[10px] text-neutral-500" style={{ background: 'rgba(255,255,255,0.02)' }}>
          {unfocusedCount} Eintrag{unfocusedCount > 1 ? 'e' : ''} nicht zuordenbar (ausgeblendet im Fokus)
        </div>
      )}

      {/* Inbox List */}
      <div 
        data-tour="mc-inbox-list"
        className="space-y-1.5 max-h-[420px] overflow-y-auto"
        style={{ scrollbarWidth: 'thin', scrollbarColor: 'rgba(255,255,255,0.1) transparent' }}
      >
        <AnimatePresence mode="popLayout">
          {displayItems.length === 0 ? (
            <motion.div
              key="empty"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="text-center py-8"
            >
              <p className="text-xs text-neutral-500 mb-1">
                {inboxTab === 'action' && 'Keine offenen Aktionen.'}
                {inboxTab === 'pending' && 'Keine laufenden Summaries.'}
                {inboxTab === 'failed' && 'Keine fehlgeschlagenen Items.'}
                {inboxTab === 'info' && 'Keine Info-Items.'}
              </p>
              <p className="text-[10px] text-neutral-600">
                {inboxTab === 'action' && 'Sobald Next Steps erkannt werden, erscheinen sie hier.'}
                {inboxTab === 'pending' && 'Verarbeitungen werden hier angezeigt.'}
                {inboxTab === 'failed' && 'Fehler werden hier gesammelt.'}
                {inboxTab === 'info' && 'Abgeschlossene Items ohne Aktion.'}
              </p>
            </motion.div>
          ) : (
            displayItems.map((item, idx) => (
              <InboxListItem
                key={`${item.sourceType}-${item.id}`}
                item={item}
                tab={inboxTab}
                index={idx}
                onOpen={() => {
                  if (inboxQueueRef) {
                    inboxQueueRef.current = { items: displayItems, currentIndex: idx };
                  }
                  onOpenItem(item);
                }}
                onDismiss={inboxTab === 'info' ? () => handleDismissItem(item) : undefined}
              />
            ))
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// INBOX LIST ITEM
// ═══════════════════════════════════════════════════════════════

interface InboxListItemProps {
  item: InboxItem;
  tab: InboxTab;
  index: number;
  onOpen: () => void;
  onDismiss?: () => void;
}

function InboxListItem({ item, tab, index, onOpen, onDismiss }: InboxListItemProps) {
  const statusColor = tab === 'action' ? DT.statusAction
    : tab === 'pending' ? DT.statusPending
    : tab === 'failed' ? DT.statusFailed
    : DT.statusInfo;

  const statusLabel = tab === 'action' ? 'Aktion'
    : tab === 'pending' ? 'Wird verarbeitet'
    : tab === 'failed' ? 'Fehler'
    : 'Info';

  const timeAgo = item.createdAt
    ? formatDistanceToNow(new Date(item.createdAt), { addSuffix: true, locale: de })
    : undefined;

  return (
    <motion.div
      variants={listItemVariants}
      initial="hidden"
      animate="visible"
      exit="exit"
      transition={{ duration: ANIM.duration, delay: index * ANIM.stagger }}
      className="group relative"
    >
      <button
        onClick={onOpen}
        className="w-full text-left p-3 rounded-xl transition-all hover:translate-y-[-1px]"
        style={{
          background: DT.rowBg,
          border: `1px solid ${DT.panelBorder}`,
        }}
      >
        <div className="flex items-start gap-3">
          {/* Type chip */}
          <span
            className="flex-shrink-0 px-1.5 py-0.5 rounded text-[9px] font-bold uppercase"
            style={{
              background: item.sourceType === 'call' ? 'rgba(255,106,0,0.12)' : 'rgba(233,215,196,0.12)',
              color: item.sourceType === 'call' ? DT.orange : DT.gold,
            }}
          >
            {item.sourceType === 'call' ? 'Call' : 'Space'}
          </span>

          {/* Content */}
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium text-neutral-200 truncate">{item.title}</p>
            {item.subtitle && (
              <p className="text-[10px] text-neutral-500 truncate mt-0.5">{item.subtitle}</p>
            )}
            <div className="flex items-center gap-2 mt-1.5">
              {timeAgo && (
                <span className="text-[9px] text-neutral-600">{timeAgo}</span>
              )}
              {item.taskOpenCount && item.taskOpenCount > 0 && (
                <span className="text-[9px] px-1.5 py-0.5 rounded" style={{ background: 'rgba(255,106,0,0.1)', color: DT.orange }}>
                  {item.taskOpenCount} Aufgabe{item.taskOpenCount > 1 ? 'n' : ''}
                </span>
              )}
            </div>
          </div>

          {/* Status badge */}
          <span
            className="flex-shrink-0 px-1.5 py-0.5 rounded text-[9px] font-medium"
            style={{
              background: `${statusColor}15`,
              color: statusColor,
            }}
          >
            {statusLabel}
          </span>
        </div>

        {/* Next Step preview (action tab) */}
        {tab === 'action' && item.nextStep && (
          <p 
            className="text-[10px] text-neutral-400 mt-2 pl-8 line-clamp-1"
            style={{ borderLeft: `2px solid ${DT.orange}30` }}
          >
            {item.nextStep}
          </p>
        )}

        {/* Error preview (failed tab) */}
        {tab === 'failed' && item.error && (
          <p 
            className="text-[10px] mt-2 pl-8 line-clamp-1"
            style={{ color: DT.statusFailed, borderLeft: `2px solid ${DT.statusFailed}30` }}
          >
            {item.error}
          </p>
        )}
      </button>

      {/* Dismiss button for INFO items */}
      {onDismiss && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onDismiss();
          }}
          className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 text-[9px] px-1.5 py-0.5 rounded transition-all hover:bg-white/[0.08]"
          style={{ color: '#666' }}
        >
          Ausblenden
        </button>
      )}
    </motion.div>
  );
}

export default SmartInbox;
