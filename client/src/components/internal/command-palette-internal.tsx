/**
 * ============================================================================
 * ARAS COMMAND CENTER - INTERNAL COMMAND PALETTE
 * ============================================================================
 * Premium ⌘K command palette for Internal CRM
 * Combines navigation commands + global search
 * ============================================================================
 */

import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useLocation } from 'wouter';
import { useQuery } from '@tanstack/react-query';
import { 
  Search, Users, Building2, TrendingUp, CheckSquare, Phone,
  LayoutDashboard, Sparkles, Settings, Command, ArrowRight
} from 'lucide-react';
import { apiGet } from '@/lib/api';

// Design Tokens
const DT = {
  orange: '#ff6a00',
  gold: '#e9d7c4',
  panelBg: 'rgba(8,8,12,0.94)',
  panelBorder: 'rgba(255,106,0,0.15)',
  rowBg: 'rgba(255,255,255,0.02)',
  rowBgHover: 'rgba(255,255,255,0.06)',
  rowBgSelected: 'rgba(255,106,0,0.12)',
  textDim: 'rgba(255,255,255,0.55)',
};

// Animation config
const ANIM = {
  duration: 0.16,
  easing: [0.22, 1, 0.36, 1] as const,
};

// Icon mapping for search result types
const TYPE_ICONS: Record<string, any> = {
  contact: Users,
  company: Building2,
  deal: TrendingUp,
  task: CheckSquare,
  call: Phone,
};

const TYPE_LABELS: Record<string, string> = {
  contact: 'Kontakt',
  company: 'Unternehmen',
  deal: 'Deal',
  task: 'Aufgabe',
  call: 'Anruf',
};

// Search result type from API
interface SearchHit {
  type: 'contact' | 'company' | 'deal' | 'task' | 'call';
  id: string;
  title: string;
  subtitle?: string;
  meta?: {
    stage?: string;
    status?: string;
    dueDate?: string;
    updatedAt?: string;
    value?: number;
  };
  route: string;
}

// Built-in navigation commands
interface NavCommand {
  id: string;
  title: string;
  subtitle?: string;
  icon: any;
  route: string;
  keywords: string[];
}

const NAV_COMMANDS: NavCommand[] = [
  {
    id: 'nav-dashboard',
    title: 'Dashboard',
    subtitle: 'Command Center Übersicht',
    icon: LayoutDashboard,
    route: '/internal/dashboard',
    keywords: ['home', 'übersicht', 'zentrale'],
  },
  {
    id: 'nav-contacts',
    title: 'Kontakte',
    subtitle: 'CRM Kontaktverwaltung',
    icon: Users,
    route: '/internal/contacts',
    keywords: ['contacts', 'personen', 'crm'],
  },
  {
    id: 'nav-companies',
    title: 'Unternehmen',
    subtitle: 'Firmenverwaltung',
    icon: Building2,
    route: '/internal/companies',
    keywords: ['companies', 'firmen', 'organisation'],
  },
  {
    id: 'nav-deals',
    title: 'Deals & Pipeline',
    subtitle: 'Sales Pipeline',
    icon: TrendingUp,
    route: '/internal/deals',
    keywords: ['pipeline', 'sales', 'verkauf', 'investoren'],
  },
  {
    id: 'nav-tasks',
    title: 'Tasks',
    subtitle: 'Aufgabenverwaltung',
    icon: CheckSquare,
    route: '/internal/tasks',
    keywords: ['aufgaben', 'todo', 'to-do'],
  },
  {
    id: 'nav-calls',
    title: 'Call Logs',
    subtitle: 'Anrufprotokoll',
    icon: Phone,
    route: '/internal/calls',
    keywords: ['anrufe', 'telefon', 'logs'],
  },
];

interface InternalCommandPaletteProps {
  onCreateContact?: () => void;
  onCreateCompany?: () => void;
  onCreateDeal?: () => void;
  onCreateTask?: () => void;
  onOpenAIBrief?: () => void;
}

export function InternalCommandPalette({
  onCreateContact,
  onCreateCompany,
  onCreateDeal,
  onCreateTask,
  onOpenAIBrief,
}: InternalCommandPaletteProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [, setLocation] = useLocation();
  
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);

  // Debounced search query
  const [debouncedQuery, setDebouncedQuery] = useState('');
  
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(query);
    }, 180);
    return () => clearTimeout(timer);
  }, [query]);

  // Search API query
  const { data: searchData, isLoading: isSearching } = useQuery({
    queryKey: ['internal-search', debouncedQuery],
    queryFn: async () => {
      if (debouncedQuery.length < 2) return { results: [], totalResults: 0 };
      const result = await apiGet<{results: any[], totalResults: number}>(`/api/internal/search?q=${encodeURIComponent(debouncedQuery)}&limit=5`);
      if (!result.ok) throw result.error;
      return result.data || { results: [], totalResults: 0 };
    },
    enabled: debouncedQuery.length >= 2 && isOpen,
    staleTime: 30000,
  });

  // Filter nav commands by query
  const filteredNavCommands = useMemo(() => {
    if (!query.trim()) return NAV_COMMANDS;
    const q = query.toLowerCase();
    return NAV_COMMANDS.filter(cmd => 
      cmd.title.toLowerCase().includes(q) ||
      cmd.subtitle?.toLowerCase().includes(q) ||
      cmd.keywords.some(k => k.toLowerCase().includes(q))
    );
  }, [query]);

  // Build action commands
  const actionCommands = useMemo(() => {
    const actions: { id: string; title: string; subtitle: string; icon: any; action: () => void }[] = [];
    
    if (onCreateContact) {
      actions.push({
        id: 'create-contact',
        title: 'Neuen Kontakt erstellen',
        subtitle: 'Kontakt hinzufügen',
        icon: Users,
        action: onCreateContact,
      });
    }
    if (onCreateCompany) {
      actions.push({
        id: 'create-company',
        title: 'Neues Unternehmen erstellen',
        subtitle: 'Firma hinzufügen',
        icon: Building2,
        action: onCreateCompany,
      });
    }
    if (onCreateDeal) {
      actions.push({
        id: 'create-deal',
        title: 'Neuen Deal erstellen',
        subtitle: 'Deal hinzufügen',
        icon: TrendingUp,
        action: onCreateDeal,
      });
    }
    if (onCreateTask) {
      actions.push({
        id: 'create-task',
        title: 'Neue Aufgabe erstellen',
        subtitle: 'Task hinzufügen',
        icon: CheckSquare,
        action: onCreateTask,
      });
    }
    if (onOpenAIBrief) {
      actions.push({
        id: 'ai-brief',
        title: 'ARAS AI: Wochenbericht',
        subtitle: 'KI-Analyse starten',
        icon: Sparkles,
        action: onOpenAIBrief,
      });
    }

    // Filter by query
    if (!query.trim()) return actions;
    const q = query.toLowerCase();
    return actions.filter(a => 
      a.title.toLowerCase().includes(q) || 
      a.subtitle.toLowerCase().includes(q)
    );
  }, [query, onCreateContact, onCreateCompany, onCreateDeal, onCreateTask, onOpenAIBrief]);

  // Search results from API
  const searchResults: SearchHit[] = searchData?.results || [];

  // Total item count for keyboard navigation
  const totalItems = filteredNavCommands.length + actionCommands.length + searchResults.length;

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
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  const handleClose = useCallback(() => {
    setIsOpen(false);
    setQuery('');
    setTimeout(() => {
      previousFocusRef.current?.focus();
    }, 50);
  }, []);

  const handleSelect = useCallback((route: string, action?: () => void) => {
    if (action) {
      action();
    } else {
      setLocation(route);
    }
    handleClose();
  }, [setLocation, handleClose]);

  const handleInputKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex(prev => Math.min(prev + 1, totalItems - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex(prev => Math.max(prev - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      
      // Determine which item is selected
      let idx = selectedIndex;
      
      // Navigation commands
      if (idx < filteredNavCommands.length) {
        handleSelect(filteredNavCommands[idx].route);
        return;
      }
      idx -= filteredNavCommands.length;
      
      // Action commands
      if (idx < actionCommands.length) {
        handleSelect('', actionCommands[idx].action);
        return;
      }
      idx -= actionCommands.length;
      
      // Search results
      if (idx < searchResults.length) {
        handleSelect(searchResults[idx].route);
        return;
      }
    }
  }, [selectedIndex, totalItems, filteredNavCommands, actionCommands, searchResults, handleSelect]);

  // Calculate global index for each section
  let globalIndex = 0;

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
              background: 'radial-gradient(ellipse at center, rgba(0,0,0,0.78) 0%, rgba(0,0,0,0.94) 100%)',
              backdropFilter: 'blur(12px)',
            }}
            onClick={handleClose}
          />

          {/* Dialog */}
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: -10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: -10 }}
            transition={{ duration: ANIM.duration, ease: ANIM.easing }}
            className="fixed top-[12vh] left-1/2 -translate-x-1/2 z-[9999] w-[92vw] max-w-[680px]"
            role="dialog"
            aria-modal="true"
            aria-label="Command Palette"
          >
            <div
              className="rounded-3xl overflow-hidden"
              style={{
                background: DT.panelBg,
                border: `1px solid ${DT.panelBorder}`,
                boxShadow: '0 25px 80px rgba(0,0,0,0.7), 0 0 0 1px rgba(255,106,0,0.08)',
              }}
            >
              {/* Input */}
              <div className="p-4 border-b flex items-center gap-3" style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
                <Search className="w-5 h-5 text-white/40" />
                <input
                  ref={inputRef}
                  type="text"
                  value={query}
                  onChange={e => setQuery(e.target.value)}
                  onKeyDown={handleInputKeyDown}
                  placeholder="Suche oder Befehl eingeben…"
                  className="flex-1 bg-transparent text-[15px] font-medium outline-none placeholder:text-white/30"
                  style={{
                    color: DT.gold,
                    caretColor: DT.orange,
                  }}
                  autoComplete="off"
                  autoCorrect="off"
                  spellCheck={false}
                />
                <kbd className="px-2 py-1 text-[10px] text-white/30 bg-white/5 rounded border border-white/10">
                  ESC
                </kbd>
              </div>

              {/* Results */}
              <div
                ref={listRef}
                className="max-h-[52vh] overflow-y-auto"
                style={{ scrollbarWidth: 'thin', scrollbarColor: 'rgba(255,255,255,0.1) transparent' }}
              >
                {/* Navigation Commands */}
                {filteredNavCommands.length > 0 && (
                  <div className="py-2">
                    <div className="px-4 py-1.5">
                      <p className="text-[9px] font-bold uppercase tracking-wider" style={{ color: DT.textDim }}>
                        Navigation
                      </p>
                    </div>
                    {filteredNavCommands.map((cmd) => {
                      const isSelected = globalIndex === selectedIndex;
                      const currentIndex = globalIndex++;
                      const Icon = cmd.icon;
                      
                      return (
                        <button
                          key={cmd.id}
                          data-selected={isSelected}
                          onClick={() => handleSelect(cmd.route)}
                          onMouseEnter={() => setSelectedIndex(currentIndex)}
                          className="w-full text-left px-4 py-2.5 flex items-center gap-3 transition-all"
                          style={{
                            background: isSelected ? DT.rowBgSelected : 'transparent',
                            borderLeft: isSelected ? `2px solid ${DT.orange}` : '2px solid transparent',
                          }}
                        >
                          <div className="w-8 h-8 rounded-lg flex items-center justify-center" 
                               style={{ background: isSelected ? 'rgba(255,106,0,0.2)' : 'rgba(255,255,255,0.05)' }}>
                            <Icon className="w-4 h-4" style={{ color: isSelected ? DT.orange : 'rgba(255,255,255,0.5)' }} />
                          </div>
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
                          {isSelected && <ArrowRight className="w-4 h-4" style={{ color: DT.orange }} />}
                        </button>
                      );
                    })}
                  </div>
                )}

                {/* Action Commands */}
                {actionCommands.length > 0 && (
                  <div className="py-2 border-t" style={{ borderColor: 'rgba(255,255,255,0.05)' }}>
                    <div className="px-4 py-1.5">
                      <p className="text-[9px] font-bold uppercase tracking-wider" style={{ color: DT.textDim }}>
                        Aktionen
                      </p>
                    </div>
                    {actionCommands.map((cmd) => {
                      const isSelected = globalIndex === selectedIndex;
                      const currentIndex = globalIndex++;
                      const Icon = cmd.icon;
                      
                      return (
                        <button
                          key={cmd.id}
                          data-selected={isSelected}
                          onClick={() => handleSelect('', cmd.action)}
                          onMouseEnter={() => setSelectedIndex(currentIndex)}
                          className="w-full text-left px-4 py-2.5 flex items-center gap-3 transition-all"
                          style={{
                            background: isSelected ? DT.rowBgSelected : 'transparent',
                            borderLeft: isSelected ? `2px solid ${DT.orange}` : '2px solid transparent',
                          }}
                        >
                          <div className="w-8 h-8 rounded-lg flex items-center justify-center" 
                               style={{ background: isSelected ? 'rgba(255,106,0,0.2)' : 'rgba(255,255,255,0.05)' }}>
                            <Icon className="w-4 h-4" style={{ color: isSelected ? DT.orange : 'rgba(255,255,255,0.5)' }} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm truncate" style={{ color: isSelected ? DT.gold : '#ccc' }}>
                              {cmd.title}
                            </p>
                            <p className="text-[10px] truncate" style={{ color: DT.textDim }}>
                              {cmd.subtitle}
                            </p>
                          </div>
                          <span
                            className="px-1.5 py-0.5 rounded text-[8px] font-bold uppercase"
                            style={{ background: `${DT.orange}20`, color: DT.orange }}
                          >
                            AKTION
                          </span>
                        </button>
                      );
                    })}
                  </div>
                )}

                {/* Search Results */}
                {query.length >= 2 && (
                  <div className="py-2 border-t" style={{ borderColor: 'rgba(255,255,255,0.05)' }}>
                    <div className="px-4 py-1.5 flex items-center justify-between">
                      <p className="text-[9px] font-bold uppercase tracking-wider" style={{ color: DT.textDim }}>
                        Suchergebnisse
                      </p>
                      {isSearching && (
                        <div className="w-3 h-3 border-2 border-orange-500/30 border-t-orange-500 rounded-full animate-spin" />
                      )}
                    </div>
                    
                    {searchResults.length === 0 && !isSearching && (
                      <div className="px-4 py-6 text-center">
                        <p className="text-xs text-white/30">Keine Ergebnisse für "{query}"</p>
                      </div>
                    )}

                    {searchResults.map((result) => {
                      const isSelected = globalIndex === selectedIndex;
                      const currentIndex = globalIndex++;
                      const Icon = TYPE_ICONS[result.type] || Search;
                      
                      return (
                        <button
                          key={`${result.type}-${result.id}`}
                          data-selected={isSelected}
                          onClick={() => handleSelect(result.route)}
                          onMouseEnter={() => setSelectedIndex(currentIndex)}
                          className="w-full text-left px-4 py-2.5 flex items-center gap-3 transition-all"
                          style={{
                            background: isSelected ? DT.rowBgSelected : 'transparent',
                            borderLeft: isSelected ? `2px solid ${DT.orange}` : '2px solid transparent',
                          }}
                        >
                          <div className="w-8 h-8 rounded-lg flex items-center justify-center" 
                               style={{ background: isSelected ? 'rgba(255,106,0,0.2)' : 'rgba(255,255,255,0.05)' }}>
                            <Icon className="w-4 h-4" style={{ color: isSelected ? DT.orange : 'rgba(255,255,255,0.5)' }} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm truncate" style={{ color: isSelected ? DT.gold : '#ccc' }}>
                              {result.title}
                            </p>
                            {result.subtitle && (
                              <p className="text-[10px] truncate" style={{ color: DT.textDim }}>
                                {result.subtitle}
                              </p>
                            )}
                          </div>
                          <span
                            className="px-1.5 py-0.5 rounded text-[8px] font-medium uppercase"
                            style={{ background: 'rgba(255,255,255,0.05)', color: DT.textDim }}
                          >
                            {TYPE_LABELS[result.type] || result.type}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                )}

                {/* Empty state */}
                {totalItems === 0 && query.length < 2 && (
                  <div className="px-4 py-8 text-center">
                    <p className="text-xs text-white/30">Mindestens 2 Zeichen eingeben zum Suchen</p>
                  </div>
                )}
              </div>

              {/* Footer */}
              <div className="px-4 py-2.5 border-t flex items-center justify-between" style={{ borderColor: 'rgba(255,255,255,0.05)' }}>
                <div className="flex items-center gap-4 text-[9px]" style={{ color: DT.textDim }}>
                  <span className="flex items-center gap-1">
                    <kbd className="px-1 py-0.5 bg-white/5 rounded">↑↓</kbd>
                    navigieren
                  </span>
                  <span className="flex items-center gap-1">
                    <kbd className="px-1 py-0.5 bg-white/5 rounded">↵</kbd>
                    ausführen
                  </span>
                  <span className="flex items-center gap-1">
                    <kbd className="px-1 py-0.5 bg-white/5 rounded">esc</kbd>
                    schließen
                  </span>
                </div>
                <div className="flex items-center gap-1 text-[9px]" style={{ color: DT.textDim }}>
                  <Command className="w-3 h-3" />
                  <span>K</span>
                </div>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

export default InternalCommandPalette;
