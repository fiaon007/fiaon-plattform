/**
 * ARAS Lazy Import with Retry
 * Handles chunk loading failures gracefully with exponential backoff
 * Prevents hard crashes from network issues or cache mismatches
 */

import { lazy, type ComponentType } from 'react';

interface LazyWithRetryOptions {
  retries?: number;
  baseDelay?: number;
  maxDelay?: number;
}

type ComponentImporter<T> = () => Promise<{ default: T }>;

/**
 * Creates a lazy component with automatic retry on import failure.
 * Uses exponential backoff with jitter to avoid thundering herd.
 */
export function lazyWithRetry<T extends ComponentType<any>>(
  importer: ComponentImporter<T>,
  options: LazyWithRetryOptions = {}
): React.LazyExoticComponent<T> {
  const { retries = 2, baseDelay = 250, maxDelay = 2000 } = options;

  return lazy(async () => {
    let lastError: Error | undefined;

    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        // Attempt the import
        const module = await importer();
        return module;
      } catch (err) {
        lastError = err instanceof Error ? err : new Error(String(err));
        
        // Log the retry attempt
        if (attempt < retries) {
          const delay = Math.min(baseDelay * Math.pow(2, attempt), maxDelay);
          const jitter = Math.random() * 100;
          const totalDelay = delay + jitter;
          
          console.warn(
            `[ARAS] Chunk load failed (attempt ${attempt + 1}/${retries + 1}), retrying in ${Math.round(totalDelay)}ms...`,
            lastError.message
          );
          
          await sleep(totalDelay);
        }
      }
    }

    // All retries exhausted
    console.error('[ARAS] Chunk load failed after all retries:', lastError);
    throw lastError;
  });
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Preload a lazy component (useful for route prefetching)
 */
export function preloadLazy<T extends ComponentType<any>>(
  lazyComponent: React.LazyExoticComponent<T>
): void {
  // Access the internal _payload to trigger preload
  // This is a React internal but widely used pattern
  try {
    const payload = (lazyComponent as any)._payload;
    if (payload && typeof payload._result === 'function') {
      payload._result();
    }
  } catch {
    // Silently ignore if structure changes
  }
}
