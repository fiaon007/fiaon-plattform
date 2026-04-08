/**
 * ARAS Command Palette - Global Command Center
 * Cmd/Ctrl+K to open, ESC to close
 * Premium cinematic UI with instant performance
 * Uses DI pattern - no import-time side effects
 */

import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { Command, CommandStatusChip } from '@/lib/commands/command-types';
import { groupCommands } from '@/lib/commands/command-registry';
import { useCommandRegistry } from '@/lib/commands/command-context';

// Design Tokens
const DT = {
  orange: '#ff6a00',
  gold: '#e9d7c4',
  panelBg: 'rgba(8,8,12,0.92)',
  panelBorder: 'rgba(255,255,255,0.08)',
  rowBg: 'rgba(255,255,255,0.02)',
  rowBgHover: 'rgba(255,255,255,0.06)',
  rowBgSelected: 'rgba(255,106,0,0.12)',
  textDim: 'rgba(255,255,255,0.55)',
  statusAction: '#ff6a00',
  statusPending: '#f59e0b',
  statusFailed: '#ef4444',
  statusOpen: '#3b82f6',
  statusDone: '#22c55e',
};

// Animation config
const ANIM = {
  duration: 0.18,
  easing: [0.22, 1, 0.36, 1] as const,
};

interface CommandPaletteProps {
  userId?: string;
}

export function CommandPalette({ userId }: CommandPaletteProps) {
  const registry = useCommandRegistry();
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [isExecuting, setIsExecuting] = useState(false);
  const [executionError, setExecutionError] = useState<string | null>(null);
  const [, forceUpdate] = useState({});
  
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);

  // Subscribe to registry changes
  useEffect(() => {
    if (!registry) return;
    const unsubscribe = registry.subscribe(() => forceUpdate({}));
    return unsubscribe;
  }, [registry]);

  // Get filtered commands
  const filteredCommands = useMemo(() => {
    if (!registry) return [];
    const commands = registry.search(query);
    
    // Boost last used commands when no query
    if (!query.trim()) {
      const lastUsed = registry.getLastUsed(userId);
      return commands.sort((a, b) => {
        const aLastUsedIdx = lastUsed.indexOf(a.id);
        const bLastUsedIdx = lastUsed.indexOf(b.id);
        
        // Both in last used - sort by recency
        if (aLastUsedIdx !== -1 && bLastUsedIdx !== -1) {
          return aLastUsedIdx - bLastUsedIdx;
        }
        // Only a in last used
        if (aLastUsedIdx !== -1) return -1;
        // Only b in last used
        if (bLastUsedIdx !== -1) return 1;
        
        return 0;
      });
    }
    
    return commands;
  }, [registry, query, userId]);

  // Group commands for display
  const groupedCommands = useMemo(() => {
    return groupCommands(filteredCommands);
  }, [filteredCommands]);

  // Flatten for keyboard navigation
  const flatCommands = useMemo(() => {
    const flat: Command[] = [];
    for (const commands of groupedCommands.values()) {
      flat.push(...commands);
    }
    return flat;
  }, [groupedCommands]);

  // Reset selection when query changes
  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  // Scroll selected item into view
  useEffect(() => {
    if (!listRef.current) return;
    const selected = listRef.current.querySelector('[data-selected="true"]');
    if (selected) {
      selected.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }
  }, [selectedIndex]);

  // Global keyboard handler
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      const target = e.target as HTMLElement;
      const isInputFocused = target.tagName === 'INPUT' || 
                             target.tagName === 'TEXTAREA' || 
                             target.isContentEditable;

      // Cmd/Ctrl+K - always open (even in inputs)
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        if (!isOpen) {
          previousFocusRef.current = document.activeElement as HTMLElement;
        }
        setIsOpen(prev => !prev);
        return;
      }

      // "/" - open only if not in input
      if (e.key === '/' && !isInputFocused && !isOpen) {
        e.preventDefault();
        previousFocusRef.current = document.activeElement as HTMLElement;
        setIsOpen(true);
        return;
      }

      // ESC - close
      if (e.key === 'Escape' && isOpen) {
        e.preventDefault();
        handleClose();
        return;
      }
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]);

  // Focus input when opening
  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setSelectedIndex(0);
      setExecutionError(null);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  const handleClose = useCallback(() => {
    setIsOpen(false);
    setQuery('');
    setExecutionError(null);
    // Return focus
    setTimeout(() => {
      previousFocusRef.current?.focus();
    }, 50);
  }, []);

  const executeCommand = useCallback(async (command: Command) => {
    setIsExecuting(true);
    setExecutionError(null);
    
    try {
      await command.perform();
      registry?.saveLastUsed(command.id, userId);
      handleClose();
    } catch (err) {
      console.error('[CommandPalette] Command failed:', err);
      setExecutionError(err instanceof Error ? err.message : 'Aktion fehlgeschlagen');
    } finally {
      setIsExecuting(false);
    }
  }, [registry, userId, handleClose]);

  const handleInputKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex(prev => Math.min(prev + 1, flatCommands.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex(prev => Math.max(prev - 1, 0));
    } else if (e.key === 'Enter' && flatCommands[selectedIndex]) {
      e.preventDefault();
      executeCommand(flatCommands[selectedIndex]);
    }
  }, [flatCommands, selectedIndex, executeCommand]);

  const copyErrorDetails = useCallback(async () => {
    if (!executionError) return;
    try {
      await navigator.clipboard.writeText(`ARAS Command Error: ${executionError}`);
    } catch {
      // Ignore
    }
  }, [executionError]);

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: ANIM.duration }}
            className="fixed inset-0 z-[9998]"
            style={{
              background: 'radial-gradient(ellipse at center, rgba(0,0,0,0.75) 0%, rgba(0,0,0,0.92) 100%)',
              backdropFilter: 'blur(8px)',
            }}
            onClick={handleClose}
          />

          {/* Dialog */}
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: -10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: -10 }}
            transition={{ duration: ANIM.duration, ease: ANIM.easing }}
            className="fixed top-[15vh] left-1/2 -translate-x-1/2 z-[9999] w-[92vw] max-w-[720px]"
          >
            <div
              className="rounded-2xl overflow-hidden"
              style={{
                background: DT.panelBg,
                border: `1px solid ${DT.panelBorder}`,
                boxShadow: '0 25px 80px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,106,0,0.1)',
              }}
            >
              {/* Subtle noise overlay */}
              <div
                className="absolute inset-0 pointer-events-none opacity-[0.015]"
                style={{
                  backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.8' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E")`,
                }}
              />

              {/* Input */}
              <div className="p-4 border-b relative z-10" style={{ borderColor: 'rgba(255,255,255,0.05)' }}>
                <input
                  ref={inputRef}
                  type="text"
                  value={query}
                  onChange={e => setQuery(e.target.value)}
                  onKeyDown={handleInputKeyDown}
                  placeholder="Befehl oder Suche…"
                  className="w-full bg-transparent text-sm font-mono outline-none"
                  style={{
                    color: DT.gold,
                    caretColor: DT.orange,
                  }}
                  autoComplete="off"
                  autoCorrect="off"
                  spellCheck={false}
                />
              </div>

              {/* Execution status */}
              {isExecuting && (
                <div className="px-4 py-2 border-b relative z-10" style={{ borderColor: 'rgba(255,255,255,0.05)' }}>
                  <p className="text-[11px] text-neutral-400 animate-pulse">Wird ausgeführt…</p>
                </div>
              )}

              {/* Error display */}
              {executionError && (
                <div className="px-4 py-3 border-b relative z-10" style={{ borderColor: 'rgba(255,255,255,0.05)', background: 'rgba(239,68,68,0.1)' }}>
                  <p className="text-[11px] text-red-400 mb-2">{executionError}</p>
                  <button
                    onClick={copyErrorDetails}
                    className="text-[10px] text-neutral-500 hover:text-neutral-400 transition-colors"
                  >
                    Details kopieren
                  </button>
                </div>
              )}

              {/* Command list */}
              <div
                ref={listRef}
                className="max-h-[50vh] overflow-y-auto relative z-10"
                style={{ scrollbarWidth: 'thin', scrollbarColor: 'rgba(255,255,255,0.1) transparent' }}
              >
                {flatCommands.length === 0 ? (
                  <div className="px-4 py-8 text-center">
                    <p className="text-xs text-neutral-500">
                      {query ? 'Keine Befehle gefunden' : 'Keine Befehle verfügbar'}
                    </p>
                  </div>
                ) : (
                  <>
                    {Array.from(groupedCommands.entries()).map(([groupName, commands]) => (
                      <div key={groupName}>
                        {/* Group header */}
                        <div className="px-4 py-2 sticky top-0" style={{ background: DT.panelBg }}>
                          <p className="text-[9px] font-bold uppercase tracking-wide" style={{ color: DT.textDim }}>
                            {groupName}
                          </p>
                        </div>

                        {/* Commands */}
                        {commands.map((cmd) => {
                          const globalIndex = flatCommands.indexOf(cmd);
                          const isSelected = globalIndex === selectedIndex;

                          return (
                            <button
                              key={cmd.id}
                              data-selected={isSelected}
                              onClick={() => executeCommand(cmd)}
                              onMouseEnter={() => setSelectedIndex(globalIndex)}
                              className="w-full text-left px-4 py-2.5 flex items-center justify-between gap-3 transition-all"
                              style={{
                                background: isSelected ? DT.rowBgSelected : 'transparent',
                                borderLeft: isSelected ? `2px solid ${DT.orange}` : '2px solid transparent',
                              }}
                            >
                              <div className="flex-1 min-w-0">
                                <p className="text-sm truncate" style={{ color: isSelected ? DT.gold : '#ccc' }}>
                                  {cmd.title}
                                </p>
                                {cmd.subtitle && (
                                  <p className="text-[10px] truncate" style={{ color: DT.textDim }}>
                                    {cmd.subtitle}
                                  </p>
                                )}
                              </div>

                              {cmd.statusChip && (
                                <StatusChip status={cmd.statusChip} />
                              )}
                            </button>
                          );
                        })}
                      </div>
                    ))}
                  </>
                )}
              </div>

              {/* Footer hint */}
              <div className="px-4 py-2 border-t relative z-10 flex items-center justify-between" style={{ borderColor: 'rgba(255,255,255,0.05)' }}>
                <div className="flex items-center gap-3 text-[9px]" style={{ color: DT.textDim }}>
                  <span>↑↓ navigieren</span>
                  <span>↵ ausführen</span>
                  <span>esc schließen</span>
                </div>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

// Status chip component
function StatusChip({ status }: { status: CommandStatusChip }) {
  const colors: Record<CommandStatusChip, string> = {
    AKTION: DT.statusAction,
    'IN ARBEIT': DT.statusPending,
    FEHLER: DT.statusFailed,
    OFFEN: DT.statusOpen,
    ERLEDIGT: DT.statusDone,
  };

  const color = colors[status] || DT.textDim;

  return (
    <span
      className="px-1.5 py-0.5 rounded text-[8px] font-bold uppercase flex-shrink-0"
      style={{ background: `${color}20`, color }}
    >
      {status}
    </span>
  );
}

export default CommandPalette;
