/**
 * ============================================================================
 * ARAS DEBUG HOOK - Dev-only instrumentation
 * ============================================================================
 * Logs route, query key, fetch status, row count, and errors to console
 * ONLY when localStorage.aras_debug === '1'
 * 
 * Usage: useArasDebug({ route, queryKey, status, data, error });
 * ============================================================================
 */

import { useEffect } from 'react';

interface ArasDebugOptions {
  route: string;
  queryKey: string | string[];
  status: 'idle' | 'loading' | 'success' | 'error' | 'pending';
  data?: unknown;
  error?: unknown;
  componentName?: string;
}

const isDebugEnabled = (): boolean => {
  if (typeof window === 'undefined') return false;
  try {
    return localStorage.getItem('aras_debug') === '1';
  } catch {
    return false;
  }
};

export function useArasDebug(options: ArasDebugOptions): void {
  const { route, queryKey, status, data, error, componentName } = options;

  useEffect(() => {
    if (!isDebugEnabled()) return;

    const timestamp = new Date().toISOString().split('T')[1].slice(0, 12);
    const keyStr = Array.isArray(queryKey) ? queryKey.join('|') : queryKey;
    const rowCount = Array.isArray(data) 
      ? data.length 
      : (data && typeof data === 'object' && 'length' in data) 
        ? (data as any).length 
        : data ? 1 : 0;

    const prefix = `[ARAS-DEBUG ${timestamp}]`;
    const component = componentName || 'Unknown';

    if (status === 'loading' || status === 'pending') {
      console.log(
        `${prefix} 🔄 LOADING | Route: ${route} | Component: ${component} | QueryKey: ${keyStr}`
      );
    } else if (status === 'success') {
      console.log(
        `${prefix} ✅ SUCCESS | Route: ${route} | Component: ${component} | QueryKey: ${keyStr} | Rows: ${rowCount}`
      );
    } else if (status === 'error') {
      console.error(
        `${prefix} ❌ ERROR | Route: ${route} | Component: ${component} | QueryKey: ${keyStr}`,
        error
      );
    }
  }, [route, queryKey, status, data, error, componentName]);
}

/**
 * Debug log helper for mount/unmount tracking
 */
export function useArasDebugMount(componentName: string, route: string): void {
  useEffect(() => {
    if (!isDebugEnabled()) return;

    const timestamp = new Date().toISOString().split('T')[1].slice(0, 12);
    console.log(`[ARAS-DEBUG ${timestamp}] 📦 MOUNT | Component: ${componentName} | Route: ${route}`);

    return () => {
      const unmountTime = new Date().toISOString().split('T')[1].slice(0, 12);
      console.log(`[ARAS-DEBUG ${unmountTime}] 📤 UNMOUNT | Component: ${componentName} | Route: ${route}`);
    };
  }, [componentName, route]);
}

/**
 * Check if debug mode is enabled (for conditional logging in components)
 */
export function isArasDebugEnabled(): boolean {
  return isDebugEnabled();
}
