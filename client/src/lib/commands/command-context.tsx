/**
 * ARAS Command Palette Context
 * Provides registry instance via React context
 * No import-time side effects - registry created at runtime
 * 
 * TDZ-SAFE: Uses lazy context initialization to avoid Safari ESM issues
 */

import React, { createContext, useContext, useRef, useEffect, useState, type ReactNode } from 'react';
import { createCommandRegistry, type CommandRegistry } from './command-registry';
import { registerNavigationCommands } from './modules/navigation-commands';

interface CommandContextValue {
  registry: CommandRegistry;
  isReady: boolean;
}

// TDZ-SAFE: Lazy context initialization
// Safari's strict ESM can fail if context is accessed during module evaluation
let _commandContext: React.Context<CommandContextValue | null> | null = null;

function getCommandContext(): React.Context<CommandContextValue | null> {
  if (!_commandContext) {
    _commandContext = createContext<CommandContextValue | null>(null);
  }
  return _commandContext;
}

interface CommandProviderProps {
  children: ReactNode;
  navigate: (path: string) => void;
}

/**
 * Command Provider - creates registry and bootstraps core commands
 */
export function CommandProvider({ children, navigate }: CommandProviderProps) {
  const registryRef = useRef<CommandRegistry | null>(null);
  const [isReady, setIsReady] = useState(false);

  // Create registry once
  if (!registryRef.current) {
    registryRef.current = createCommandRegistry();
  }

  // Bootstrap core commands at runtime (not import time)
  useEffect(() => {
    const registry = registryRef.current;
    if (!registry) return;

    // Register navigation commands
    registerNavigationCommands(registry, navigate);
    
    setIsReady(true);

    // Cleanup on unmount
    return () => {
      registry.unregister('navigation');
    };
  }, [navigate]);

  const value: CommandContextValue = {
    registry: registryRef.current!,
    isReady,
  };

  const CommandContext = getCommandContext();
  return (
    <CommandContext.Provider value={value}>
      {children}
    </CommandContext.Provider>
  );
}

/**
 * Hook to access the command registry
 * TDZ-SAFE: Uses lazy context getter
 */
export function useCommandRegistry(): CommandRegistry | null {
  const CommandContext = getCommandContext();
  const context = useContext(CommandContext);
  return context?.registry ?? null;
}

/**
 * Hook to check if commands are ready
 * TDZ-SAFE: Uses lazy context getter
 */
export function useCommandsReady(): boolean {
  const CommandContext = getCommandContext();
  const context = useContext(CommandContext);
  return context?.isReady ?? false;
}
