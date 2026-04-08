/**
 * ARAS Navigation Commands
 * DI pattern - receives registry as parameter, no import-time side effects
 */

import type { Command } from '../command-types';
import type { CommandRegistry } from '../command-registry';

/**
 * Build navigation commands
 * Pure function - no side effects
 */
export function buildNavigationCommands(
  navigate: (path: string) => void
): Command[] {
  return [
    {
      id: 'nav-dashboard',
      group: 'Navigation',
      title: 'Dashboard öffnen',
      keywords: ['mission control', 'übersicht', 'home'],
      perform: () => navigate('/app/dashboard'),
    },
    {
      id: 'nav-space',
      group: 'Navigation',
      title: 'Space öffnen',
      keywords: ['chat', 'ai', 'assistent'],
      perform: () => navigate('/app/space'),
    },
    {
      id: 'nav-power',
      group: 'Navigation',
      title: 'Power öffnen',
      keywords: ['analyse', 'recherche', 'deep'],
      perform: () => navigate('/app/power'),
    },
    {
      id: 'nav-campaigns',
      group: 'Navigation',
      title: 'Kampagnen öffnen',
      keywords: ['outbound', 'sequenz', 'automation'],
      perform: () => navigate('/app/campaigns'),
    },
    {
      id: 'nav-contacts',
      group: 'Navigation',
      title: 'Kontakte öffnen',
      keywords: ['crm', 'leads', 'personen'],
      perform: () => navigate('/app/contacts'),
    },
    {
      id: 'nav-calendar',
      group: 'Navigation',
      title: 'Kalender öffnen',
      keywords: ['termine', 'events', 'schedule'],
      perform: () => navigate('/app/calendar'),
    },
    {
      id: 'nav-leads',
      group: 'Navigation',
      title: 'Wissensdatenbank öffnen',
      keywords: ['knowledge', 'daten', 'quellen'],
      perform: () => navigate('/app/leads'),
    },
    {
      id: 'nav-settings',
      group: 'Navigation',
      title: 'Einstellungen öffnen',
      keywords: ['profil', 'account', 'config'],
      perform: () => navigate('/app/settings'),
    },
  ];
}

/**
 * Register navigation commands with a registry
 * Called at runtime, not import time
 */
export function registerNavigationCommands(
  registry: CommandRegistry,
  navigate: (path: string) => void
): void {
  const commands = buildNavigationCommands(navigate);
  registry.register('navigation', commands);
}
