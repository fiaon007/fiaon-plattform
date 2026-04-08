/**
 * ARAS Build ID System
 * Detects cache mismatches after deployments and triggers hard reload
 * Prevents cryptic runtime errors from mixed old/new chunks
 */

// Build ID from Vite environment variable (set at build time)
export const BUILD_ID: string = import.meta.env.VITE_BUILD_ID ?? 'dev';

const STORAGE_KEY = 'aras:buildId:last';
const RELOAD_FLAG = 'aras:buildId:reloaded';

/**
 * Check if the current build ID matches the cached one.
 * If mismatch detected, trigger a hard reload (once).
 * Call this early in app initialization.
 */
export function checkBuildIdAndReload(): boolean {
  // Skip in dev mode
  if (BUILD_ID === 'dev') {
    return false;
  }

  try {
    const lastBuildId = localStorage.getItem(STORAGE_KEY);
    const wasReloaded = sessionStorage.getItem(RELOAD_FLAG);

    // If we already reloaded this session, don't loop
    if (wasReloaded === 'true') {
      // Clear the reload flag for next session
      sessionStorage.removeItem(RELOAD_FLAG);
      localStorage.setItem(STORAGE_KEY, BUILD_ID);
      return false;
    }

    // First visit or same build - just save
    if (!lastBuildId || lastBuildId === BUILD_ID) {
      localStorage.setItem(STORAGE_KEY, BUILD_ID);
      return false;
    }

    // Mismatch detected - trigger hard reload
    console.warn(`[ARAS] Build ID mismatch: ${lastBuildId} → ${BUILD_ID}. Reloading...`);
    localStorage.setItem(STORAGE_KEY, BUILD_ID);
    sessionStorage.setItem(RELOAD_FLAG, 'true');
    
    // Hard reload to clear cached chunks
    window.location.reload();
    return true;
  } catch (err) {
    // localStorage/sessionStorage might be blocked
    console.warn('[ARAS] Could not check build ID:', err);
    return false;
  }
}

/**
 * Force a hard reload (for error recovery)
 */
export function forceHardReload(): void {
  try {
    sessionStorage.setItem(RELOAD_FLAG, 'true');
  } catch {
    // Ignore
  }
  window.location.reload();
}
