/**
 * ARAS Mission Control - Dashboard Overview Hook
 * Single source of truth for all dashboard data
 * Handles fetching, caching, validation, and safe defaults
 */

import { useQuery } from '@tanstack/react-query';
import { 
  DashboardOverview, 
  parseDashboardOverview, 
  getEmptyDashboard,
  createDefaultOverview,
  getSetupActions,
  ActionItem,
  ActivityItem,
  SystemAlert,
} from './overview.schema';

const DASHBOARD_QUERY_KEY = ['dashboard', 'overview'];
const STALE_TIME = 30 * 1000; // 30 seconds
const REFETCH_INTERVAL = 60 * 1000; // 60 seconds

interface UseDashboardOverviewOptions {
  enabled?: boolean;
  refetchInterval?: number;
}

interface UseDashboardOverviewResult {
  data: DashboardOverview;
  isLoading: boolean;
  isError: boolean;
  error: Error | null;
  refetch: () => void;
  lastUpdated: Date | null;
}

/**
 * Fetch dashboard overview from backend
 * NEVER throws - always returns valid DashboardOverview
 */
async function fetchDashboardOverview(): Promise<DashboardOverview> {
  try {
    const response = await fetch('/api/dashboard/overview', {
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    // Handle 401 - session expired
    if (response.status === 401) {
      const errorData = createDefaultOverview();
      errorData.systemAlerts.push({
        id: `auth-error-${Date.now()}`,
        type: 'warning',
        title: 'Session abgelaufen',
        description: 'Bitte melde dich erneut an.',
        service: 'auth',
        timestamp: new Date().toISOString(),
        dismissible: false,
        actionCta: {
          label: 'Neu anmelden',
          actionType: 'NAVIGATE',
          payload: { path: '/auth' },
        },
      });
      return errorData;
    }

    if (!response.ok) {
      // Don't throw - return empty dashboard with error alert
      const errorData = createDefaultOverview();
      errorData.systemAlerts.push({
        id: `api-error-${Date.now()}`,
        type: 'warning',
        title: 'Dashboard-Daten konnten nicht vollständig geladen werden',
        description: `Server antwortete mit Status ${response.status}. Einige Daten sind möglicherweise nicht aktuell.`,
        service: 'dashboard-api',
        timestamp: new Date().toISOString(),
        dismissible: true,
      });
      return errorData;
    }

    const json = await response.json();
    return parseDashboardOverview(json);
  } catch (error) {
    if (import.meta.env.DEV) {
      console.error('[Dashboard] Fetch failed:', error);
    }
    // Return safe defaults with error alert - NEVER throw
    const errorData = createDefaultOverview();
    errorData.systemAlerts.push({
      id: `fetch-error-${Date.now()}`,
      type: 'error',
      title: 'Verbindung zum Server fehlgeschlagen',
      description: 'Bitte prüfe deine Internetverbindung und versuche es erneut.',
      service: 'network',
      timestamp: new Date().toISOString(),
      dismissible: true,
      actionCta: {
        label: 'Erneut versuchen',
        actionType: 'API_CALL',
        payload: { action: 'refetch' },
      },
    });
    return errorData;
  }
}

/**
 * Main hook for dashboard overview data
 * Always returns valid data - never undefined
 */
export function useDashboardOverview(
  options: UseDashboardOverviewOptions = {}
): UseDashboardOverviewResult {
  const { enabled = true, refetchInterval = REFETCH_INTERVAL } = options;

  const query = useQuery({
    queryKey: DASHBOARD_QUERY_KEY,
    queryFn: fetchDashboardOverview,
    enabled,
    staleTime: STALE_TIME,
    refetchInterval: enabled ? refetchInterval : false,
    refetchOnWindowFocus: true,
    retry: 2,
    retryDelay: 1000,
  });

  // Always return valid data - use createDefaultOverview if query failed/loading
  // This NEVER crashes - createDefaultOverview always returns valid structure
  const data: DashboardOverview = query.data ?? createDefaultOverview();

  return {
    data,
    isLoading: query.isLoading,
    isError: query.isError,
    error: query.error as Error | null,
    refetch: query.refetch,
    lastUpdated: query.dataUpdatedAt ? new Date(query.dataUpdatedAt) : null,
  };
}

/**
 * Helper to merge setup actions with dynamic actions
 */
export function mergeActions(
  dynamicActions: ActionItem[],
  hasContacts: boolean,
  hasCampaigns: boolean,
  hasKb: boolean
): ActionItem[] {
  const setupActions = getSetupActions();
  
  // Filter setup actions based on what user already has
  const filteredSetup = setupActions.filter(action => {
    if (action.id === 'setup-contacts' && hasContacts) return false;
    if (action.id === 'setup-campaign' && hasCampaigns) return false;
    if (action.id === 'setup-kb' && hasKb) return false;
    return true;
  });

  // Combine: dynamic actions first, then remaining setup actions
  return [...dynamicActions, ...filteredSetup];
}

/**
 * Helper to filter activities by type
 */
export function filterActivities(
  activities: ActivityItem[],
  types?: string[]
): ActivityItem[] {
  if (!types || types.length === 0) return activities;
  return activities.filter(a => types.includes(a.type));
}

/**
 * Helper to filter activities by time range
 */
export function filterActivitiesByTime(
  activities: ActivityItem[],
  hours: number = 24
): ActivityItem[] {
  const cutoff = new Date(Date.now() - hours * 60 * 60 * 1000);
  return activities.filter(a => new Date(a.timestamp) > cutoff);
}

/**
 * Helper to get critical alerts (errors)
 */
export function getCriticalAlerts(alerts: SystemAlert[]): SystemAlert[] {
  return alerts.filter(a => a.type === 'error');
}

/**
 * Helper to check if dashboard needs setup
 */
export function needsSetup(data: DashboardOverview): boolean {
  const { kpis } = data;
  return (
    kpis.contacts.total === 0 &&
    kpis.calls.started.month === 0 &&
    kpis.campaigns.active === 0 &&
    kpis.knowledge.totalDocuments === 0
  );
}
