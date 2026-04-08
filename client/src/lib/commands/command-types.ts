/**
 * ARAS Command Palette - Type Definitions
 * Clean architecture: lib/* never imports from components/*
 */

export type CommandGroup = 
  | 'Navigation'
  | 'Aktionen'
  | 'Fokus'
  | 'Öffnen'
  | 'System';

export type CommandStatusChip = 
  | 'AKTION'
  | 'FEHLER'
  | 'IN ARBEIT'
  | 'OFFEN'
  | 'ERLEDIGT';

export interface Command {
  id: string;
  group: CommandGroup;
  title: string;
  subtitle?: string;
  keywords?: string[];
  statusChip?: CommandStatusChip;
  perform: () => void | Promise<void>;
  isAvailable?: () => boolean;
}

export interface CommandRegistration {
  sourceId: string;
  commands: Command[];
}

export interface CommandPaletteState {
  isOpen: boolean;
  query: string;
  selectedIndex: number;
  isExecuting: boolean;
  executionError: string | null;
}
