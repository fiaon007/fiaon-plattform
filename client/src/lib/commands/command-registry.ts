/**
 * ARAS Command Registry - Factory Pattern
 * No module-level state, no import-time side effects
 * Safe from TDZ issues in Safari/JSCore
 */

import type { Command, CommandRegistration } from './command-types';

// Last used command storage key
const LAST_USED_KEY = 'aras:command-palette:last-used';

// Group ordering for display
const GROUP_ORDER = ['Navigation', 'Aktionen', 'Fokus', 'Öffnen', 'System'];

type Listener = () => void;

/**
 * Command Registry Interface
 */
export interface CommandRegistry {
  register(sourceId: string, commands: Command[]): void;
  unregister(sourceId: string): void;
  getAll(): Command[];
  search(query: string): Command[];
  group(commands: Command[]): Map<string, Command[]>;
  subscribe(listener: Listener): () => void;
  saveLastUsed(commandId: string, userId?: string): void;
  getLastUsed(userId?: string): string[];
}

/**
 * Create a new command registry instance
 * No side effects - pure factory function
 */
export function createCommandRegistry(): CommandRegistry {
  const registrations = new Map<string, CommandRegistration>();
  const listeners = new Set<Listener>();

  function notifyListeners(): void {
    for (const listener of listeners) {
      try {
        listener();
      } catch (err) {
        console.error('[CommandRegistry] Listener error:', err);
      }
    }
  }

  function register(sourceId: string, commands: Command[]): void {
    registrations.set(sourceId, { sourceId, commands });
    notifyListeners();
  }

  function unregister(sourceId: string): void {
    registrations.delete(sourceId);
    notifyListeners();
  }

  function getAll(): Command[] {
    const allCommands: Command[] = [];
    
    for (const registration of registrations.values()) {
      for (const cmd of registration.commands) {
        if (!cmd.isAvailable || cmd.isAvailable()) {
          allCommands.push(cmd);
        }
      }
    }
    
    return allCommands;
  }

  function search(query: string): Command[] {
    const commands = getAll();
    
    if (!query.trim()) {
      return commands;
    }
    
    const q = query.toLowerCase().trim();
    
    return commands.filter(cmd => {
      if (cmd.title.toLowerCase().includes(q)) return true;
      if (cmd.subtitle?.toLowerCase().includes(q)) return true;
      if (cmd.keywords?.some(k => k.toLowerCase().includes(q))) return true;
      if (cmd.group.toLowerCase().includes(q)) return true;
      return false;
    }).sort((a, b) => {
      const aExact = a.title.toLowerCase().startsWith(q);
      const bExact = b.title.toLowerCase().startsWith(q);
      if (aExact && !bExact) return -1;
      if (!aExact && bExact) return 1;
      
      const aGroupIdx = GROUP_ORDER.indexOf(a.group);
      const bGroupIdx = GROUP_ORDER.indexOf(b.group);
      if (aGroupIdx !== bGroupIdx) return aGroupIdx - bGroupIdx;
      
      return a.title.localeCompare(b.title, 'de');
    });
  }

  function group(commands: Command[]): Map<string, Command[]> {
    const groups = new Map<string, Command[]>();
    
    for (const g of GROUP_ORDER) {
      groups.set(g, []);
    }
    
    for (const cmd of commands) {
      const g = groups.get(cmd.group);
      if (g) {
        g.push(cmd);
      } else {
        groups.set(cmd.group, [cmd]);
      }
    }
    
    for (const [key, value] of groups) {
      if (value.length === 0) {
        groups.delete(key);
      }
    }
    
    return groups;
  }

  function subscribe(listener: Listener): () => void {
    listeners.add(listener);
    return () => listeners.delete(listener);
  }

  function saveLastUsed(commandId: string, userId?: string): void {
    try {
      const key = userId ? `${LAST_USED_KEY}:${userId}` : LAST_USED_KEY;
      const history = getLastUsed(userId);
      const newHistory = [commandId, ...history.filter(id => id !== commandId)].slice(0, 5);
      localStorage.setItem(key, JSON.stringify(newHistory));
    } catch {
      // Ignore localStorage errors
    }
  }

  function getLastUsed(userId?: string): string[] {
    try {
      const key = userId ? `${LAST_USED_KEY}:${userId}` : LAST_USED_KEY;
      const stored = localStorage.getItem(key);
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  }

  return {
    register,
    unregister,
    getAll,
    search,
    group,
    subscribe,
    saveLastUsed,
    getLastUsed,
  };
}

/**
 * Utility: Group commands (standalone, for use without registry instance)
 */
export function groupCommands(commands: Command[]): Map<string, Command[]> {
  const groups = new Map<string, Command[]>();
  
  for (const g of GROUP_ORDER) {
    groups.set(g, []);
  }
  
  for (const cmd of commands) {
    const g = groups.get(cmd.group);
    if (g) {
      g.push(cmd);
    } else {
      groups.set(cmd.group, [cmd]);
    }
  }
  
  for (const [key, value] of groups) {
    if (value.length === 0) {
      groups.delete(key);
    }
  }
  
  return groups;
}
