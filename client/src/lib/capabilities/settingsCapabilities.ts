/**
 * Settings Capabilities System
 * 
 * Probes real API endpoints to determine which settings features are available.
 * Only features that return 2xx are shown in the UI.
 */

export interface Capability {
  key: string;
  label: string;
  description: string;
  test: () => Promise<boolean>;
  critical?: boolean;
}

export interface CapabilityResult {
  key: string;
  available: boolean;
  error?: string;
}

const CACHE_KEY = 'aras_settings_capabilities';
const CACHE_DURATION_MS = 2 * 60 * 1000; // 2 minutes

interface CachedCapabilities {
  timestamp: number;
  results: Record<string, boolean>;
}

/**
 * Probe an endpoint with timeout
 */
async function probeEndpoint(
  url: string,
  options: RequestInit = {},
  timeoutMs: number = 5000
): Promise<boolean> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
      credentials: 'include',
    });
    clearTimeout(timeout);
    return response.ok;
  } catch {
    clearTimeout(timeout);
    return false;
  }
}

/**
 * Define all settings capabilities - grouped by section
 */
export const SETTINGS_CAPABILITIES: Capability[] = [
  // === KONTO ===
  {
    key: 'subscription',
    label: 'Abonnement',
    description: 'Plan- und Nutzungsinformationen',
    critical: true,
    test: () => probeEndpoint('/api/user/subscription'),
  },
  {
    key: 'profile',
    label: 'Profil',
    description: 'Benutzerdaten bearbeiten',
    critical: true,
    test: () => probeEndpoint('/api/user/subscription'),
  },
  {
    key: 'usage',
    label: 'Nutzung',
    description: 'Verbrauch und Limits',
    test: () => probeEndpoint('/api/user/usage'),
  },
  // === SICHERHEIT ===
  {
    key: 'password',
    label: 'Passwort',
    description: 'Passwort ändern',
    test: () => probeEndpoint('/api/user/subscription'),
  },
  {
    key: 'deleteAccount',
    label: 'Account löschen',
    description: 'Account permanent entfernen',
    test: () => probeEndpoint('/api/user/subscription'),
  },
  // === DATEN & WISSEN ===
  {
    key: 'dataSources',
    label: 'Datenquellen',
    description: 'Wissensbasis verwalten',
    test: () => probeEndpoint('/api/user/data-sources'),
  },
  {
    key: 'knowledgeHealth',
    label: 'Wissens-Status',
    description: 'Knowledge System Health',
    test: () => probeEndpoint('/api/user/knowledge/health'),
  },
  // === DIAGNOSE ===
  {
    key: 'knowledgeDigest',
    label: 'Knowledge Digest',
    description: 'AI-Kontext Vorschau',
    test: () => probeEndpoint('/api/user/knowledge/digest?mode=space'),
  },
  {
    key: 'profileContext',
    label: 'Profil-Kontext',
    description: 'AI Profildaten',
    test: () => probeEndpoint('/api/user/profile-context'),
  },
];

/**
 * Section definitions for UI grouping
 */
export interface SettingsSection {
  id: string;
  label: string;
  description: string;
  icon: string;
  capabilities: string[];
}

export const SETTINGS_SECTIONS: SettingsSection[] = [
  {
    id: 'account',
    label: 'Konto',
    description: 'Profil, Plan & Nutzung',
    icon: 'User',
    capabilities: ['subscription', 'profile', 'usage'],
  },
  {
    id: 'security',
    label: 'Sicherheit',
    description: 'Passwort & Zugriff',
    icon: 'Shield',
    capabilities: ['password', 'deleteAccount'],
  },
  {
    id: 'data',
    label: 'Daten & Wissen',
    description: 'Wissensbasis & Quellen',
    icon: 'Database',
    capabilities: ['dataSources', 'knowledgeHealth'],
  },
  {
    id: 'diagnose',
    label: 'Diagnose',
    description: 'Debug & Transparenz',
    icon: 'Activity',
    capabilities: ['knowledgeDigest', 'profileContext'],
  },
];

/**
 * Check if a section has any available capabilities
 */
export function isSectionAvailable(
  capabilities: Record<string, boolean>,
  section: SettingsSection
): boolean {
  return section.capabilities.some((cap) => capabilities[cap] === true);
}

/**
 * Get available sections only
 */
export function getAvailableSections(
  capabilities: Record<string, boolean>
): SettingsSection[] {
  return SETTINGS_SECTIONS.filter((section) =>
    isSectionAvailable(capabilities, section)
  );
}

/**
 * Load cached capabilities from sessionStorage
 */
function loadCachedCapabilities(): Record<string, boolean> | null {
  try {
    const cached = sessionStorage.getItem(CACHE_KEY);
    if (!cached) return null;

    const parsed: CachedCapabilities = JSON.parse(cached);
    const age = Date.now() - parsed.timestamp;

    if (age > CACHE_DURATION_MS) {
      sessionStorage.removeItem(CACHE_KEY);
      return null;
    }

    return parsed.results;
  } catch {
    return null;
  }
}

/**
 * Save capabilities to sessionStorage
 */
function saveCachedCapabilities(results: Record<string, boolean>): void {
  try {
    const cached: CachedCapabilities = {
      timestamp: Date.now(),
      results,
    };
    sessionStorage.setItem(CACHE_KEY, JSON.stringify(cached));
  } catch {
    // Ignore storage errors
  }
}

/**
 * Probe all capabilities in parallel
 */
export async function probeCapabilities(): Promise<Record<string, boolean>> {
  // Check cache first
  const cached = loadCachedCapabilities();
  if (cached) {
    return cached;
  }

  // Probe all capabilities in parallel with 5s total timeout
  const results: Record<string, boolean> = {};

  const probePromises = SETTINGS_CAPABILITIES.map(async (cap) => {
    try {
      const available = await cap.test();
      results[cap.key] = available;
    } catch {
      results[cap.key] = false;
    }
  });

  // Wait for all probes with timeout
  await Promise.race([
    Promise.all(probePromises),
    new Promise((resolve) => setTimeout(resolve, 5000)),
  ]);

  // Ensure all keys have a value
  for (const cap of SETTINGS_CAPABILITIES) {
    if (!(cap.key in results)) {
      results[cap.key] = false;
    }
  }

  // Cache results
  saveCachedCapabilities(results);

  return results;
}

/**
 * Check if a specific capability is available
 */
export function isCapabilityAvailable(
  capabilities: Record<string, boolean>,
  key: string
): boolean {
  return capabilities[key] === true;
}

/**
 * Get available capabilities only
 */
export function getAvailableCapabilities(
  capabilities: Record<string, boolean>
): string[] {
  return Object.entries(capabilities)
    .filter(([, available]) => available)
    .map(([key]) => key);
}
