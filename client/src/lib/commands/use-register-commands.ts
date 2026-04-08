/**
 * ARAS Command Registration Hooks
 * Dependency injection pattern - registry passed as parameter
 * No import-time side effects
 */

import { useEffect, useRef } from 'react';
import type { Command } from './command-types';
import type { CommandRegistry } from './command-registry';

/**
 * Hook to register commands from a component
 * Automatically cleans up on unmount
 */
export function useRegisterCommands(
  registry: CommandRegistry | null,
  sourceId: string,
  commands: Command[]
): void {
  const commandsRef = useRef(commands);
  commandsRef.current = commands;

  useEffect(() => {
    if (!registry) return;
    registry.register(sourceId, commandsRef.current);
    
    return () => {
      registry.unregister(sourceId);
    };
  }, [registry, sourceId]);

  // Update commands when they change
  useEffect(() => {
    if (!registry) return;
    registry.register(sourceId, commands);
  }, [registry, sourceId, commands]);
}

/**
 * Hook to register commands lazily (for dynamic commands)
 */
export function useRegisterDynamicCommands(
  registry: CommandRegistry | null,
  sourceId: string,
  getCommands: () => Command[],
  deps: React.DependencyList
): void {
  useEffect(() => {
    if (!registry) return;
    const commands = getCommands();
    registry.register(sourceId, commands);
    
    return () => {
      registry.unregister(sourceId);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [registry, sourceId, ...deps]);
}
