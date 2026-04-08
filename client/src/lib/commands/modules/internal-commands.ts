/**
 * ARAS Internal CRM Commands
 * Commands for the Command Center (admin/staff only)
 * DI pattern - receives registry as parameter, no import-time side effects
 */

import type { Command } from '../command-types';
import type { CommandRegistry } from '../command-registry';

/**
 * Build internal CRM navigation commands
 * Pure function - no side effects
 */
export function buildInternalCommands(
  navigate: (path: string) => void,
  options?: {
    onCreateContact?: () => void;
    onCreateCompany?: () => void;
    onCreateDeal?: () => void;
    onCreateTask?: () => void;
    onOpenAIBrief?: () => void;
  }
): Command[] {
  const commands: Command[] = [
    // Navigation Commands
    {
      id: 'internal-nav-dashboard',
      group: 'Navigation',
      title: 'Command Center Dashboard',
      subtitle: 'Interne Übersicht',
      keywords: ['dashboard', 'home', 'übersicht', 'zentrale'],
      perform: () => navigate('/internal/dashboard'),
    },
    {
      id: 'internal-nav-contacts',
      group: 'Navigation',
      title: 'Kontakte öffnen',
      subtitle: 'CRM Kontaktverwaltung',
      keywords: ['contacts', 'kontakte', 'personen', 'crm'],
      perform: () => navigate('/internal/contacts'),
    },
    {
      id: 'internal-nav-companies',
      group: 'Navigation',
      title: 'Unternehmen öffnen',
      subtitle: 'Firmenverwaltung',
      keywords: ['companies', 'firmen', 'unternehmen', 'organisation'],
      perform: () => navigate('/internal/companies'),
    },
    {
      id: 'internal-nav-deals',
      group: 'Navigation',
      title: 'Deals & Pipeline öffnen',
      subtitle: 'Sales Pipeline',
      keywords: ['deals', 'pipeline', 'sales', 'verkauf', 'investoren'],
      perform: () => navigate('/internal/deals'),
    },
    {
      id: 'internal-nav-tasks',
      group: 'Navigation',
      title: 'Tasks öffnen',
      subtitle: 'Aufgabenverwaltung',
      keywords: ['tasks', 'aufgaben', 'todo', 'to-do'],
      perform: () => navigate('/internal/tasks'),
    },
    {
      id: 'internal-nav-calls',
      group: 'Navigation',
      title: 'Call Logs öffnen',
      subtitle: 'Anrufprotokoll',
      keywords: ['calls', 'anrufe', 'telefon', 'logs'],
      perform: () => navigate('/internal/calls'),
    },
  ];

  // Action Commands (only if handlers provided)
  if (options?.onCreateContact) {
    commands.push({
      id: 'internal-create-contact',
      group: 'Aktionen',
      title: 'Neuen Kontakt erstellen',
      subtitle: 'Kontakt hinzufügen',
      keywords: ['create', 'new', 'kontakt', 'hinzufügen'],
      statusChip: 'AKTION',
      perform: options.onCreateContact,
    });
  }

  if (options?.onCreateCompany) {
    commands.push({
      id: 'internal-create-company',
      group: 'Aktionen',
      title: 'Neues Unternehmen erstellen',
      subtitle: 'Firma hinzufügen',
      keywords: ['create', 'new', 'firma', 'unternehmen', 'hinzufügen'],
      statusChip: 'AKTION',
      perform: options.onCreateCompany,
    });
  }

  if (options?.onCreateDeal) {
    commands.push({
      id: 'internal-create-deal',
      group: 'Aktionen',
      title: 'Neuen Deal erstellen',
      subtitle: 'Deal/Opportunity hinzufügen',
      keywords: ['create', 'new', 'deal', 'opportunity', 'hinzufügen'],
      statusChip: 'AKTION',
      perform: options.onCreateDeal,
    });
  }

  if (options?.onCreateTask) {
    commands.push({
      id: 'internal-create-task',
      group: 'Aktionen',
      title: 'Neue Aufgabe erstellen',
      subtitle: 'Task hinzufügen',
      keywords: ['create', 'new', 'task', 'aufgabe', 'todo', 'hinzufügen'],
      statusChip: 'AKTION',
      perform: options.onCreateTask,
    });
  }

  if (options?.onOpenAIBrief) {
    commands.push({
      id: 'internal-ai-brief',
      group: 'Aktionen',
      title: 'ARAS AI: Wochenbericht',
      subtitle: 'KI-gestützte Analyse starten',
      keywords: ['ai', 'brief', 'analyse', 'weekly', 'woche', 'bericht'],
      statusChip: 'AKTION',
      perform: options.onOpenAIBrief,
    });
  }

  // System Commands
  commands.push({
    id: 'internal-toggle-debug',
    group: 'System',
    title: 'Debug Mode umschalten',
    subtitle: 'Entwickler-Ansicht (nur intern)',
    keywords: ['debug', 'developer', 'entwickler', 'dev'],
    isAvailable: () => {
      // Only in development or for specific users
      return process.env.NODE_ENV === 'development' || 
             localStorage.getItem('aras:debug-allowed') === 'true';
    },
    perform: () => {
      const current = localStorage.getItem('aras:debug-mode') === 'true';
      localStorage.setItem('aras:debug-mode', (!current).toString());
      window.dispatchEvent(new CustomEvent('aras:debug-toggle', { detail: { enabled: !current } }));
    },
  });

  return commands;
}

/**
 * Register internal CRM commands with a registry
 * Called at runtime, not import time
 */
export function registerInternalCommands(
  registry: CommandRegistry,
  navigate: (path: string) => void,
  options?: Parameters<typeof buildInternalCommands>[1]
): void {
  const commands = buildInternalCommands(navigate, options);
  registry.register('internal-crm', commands);
}

/**
 * Unregister internal CRM commands
 */
export function unregisterInternalCommands(registry: CommandRegistry): void {
  registry.unregister('internal-crm');
}
