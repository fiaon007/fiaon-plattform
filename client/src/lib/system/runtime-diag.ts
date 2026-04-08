/**
 * ARAS Runtime Diagnostics
 * Collects environment info for error reporting
 * No side effects - pure function
 */

import { BUILD_ID } from './build-id';

export interface RuntimeDiagInfo {
  buildId: string;
  userAgent: string;
  href: string;
  timestamp: string;
  timezone: string;
  language: string;
  cookiesEnabled: boolean;
  onLine: boolean;
  deviceMemory?: number;
  hardwareConcurrency?: number;
}

/**
 * Get runtime diagnostic information
 * Safe to call at any time - no side effects
 */
export function getRuntimeDiag(): RuntimeDiagInfo {
  return {
    buildId: BUILD_ID,
    userAgent: navigator.userAgent,
    href: window.location.href,
    timestamp: new Date().toISOString(),
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    language: navigator.language,
    cookiesEnabled: navigator.cookieEnabled,
    onLine: navigator.onLine,
    deviceMemory: (navigator as any).deviceMemory,
    hardwareConcurrency: navigator.hardwareConcurrency,
  };
}

/**
 * Format diagnostic info for clipboard/logging
 */
export function formatRuntimeDiag(diag: RuntimeDiagInfo): string {
  return `ARAS Runtime Diagnostics
========================
Build: ${diag.buildId}
Time: ${diag.timestamp}
Timezone: ${diag.timezone}
URL: ${diag.href}
User Agent: ${diag.userAgent}
Language: ${diag.language}
Online: ${diag.onLine}
Cookies: ${diag.cookiesEnabled}
Device Memory: ${diag.deviceMemory ?? 'N/A'} GB
CPU Cores: ${diag.hardwareConcurrency ?? 'N/A'}`;
}
