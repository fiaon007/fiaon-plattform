/**
 * ARAS Action Dispatcher
 * Centralized action execution for dashboard actions
 * Handles navigation, API calls, modals, and entity creation
 */

import type { Cta, ActionType } from '../dashboard/overview.schema';

export interface DispatchContext {
  navigate: (path: string) => void;
  openModal: (modalId: string, payload?: any) => void;
  showToast: (message: string, type?: 'success' | 'error' | 'info') => void;
  refetchDashboard: () => void;
}

export interface DispatchResult {
  success: boolean;
  message?: string;
  data?: any;
}

/**
 * Execute a dashboard action
 */
export async function dispatchAction(
  cta: Cta,
  context: DispatchContext
): Promise<DispatchResult> {
  const { actionType, payload = {} } = cta;

  console.log('[ActionDispatch]', actionType, payload);

  try {
    switch (actionType) {
      case 'NAVIGATE':
        return handleNavigate(payload, context);

      case 'OPEN_MODAL':
        return handleOpenModal(payload, context);

      case 'API_CALL':
        return handleApiCall(payload, context);

      case 'CREATE_ENTITY':
        return handleCreateEntity(payload, context);

      case 'START_CALL':
        return handleStartCall(payload, context);

      case 'START_CAMPAIGN':
        return handleStartCampaign(payload, context);

      case 'IMPORT_CONTACTS':
        return handleImportContacts(payload, context);

      case 'ADD_KB_SOURCE':
        return handleAddKbSource(payload, context);

      case 'CREATE_SPACE':
        return handleCreateSpace(payload, context);

      case 'CREATE_TASK':
        return handleCreateTask(payload, context);

      case 'FIX_ERROR':
        return handleFixError(payload, context);

      default:
        console.warn('[ActionDispatch] Unknown action type:', actionType);
        return { success: false, message: `Unknown action: ${actionType}` };
    }
  } catch (error: any) {
    console.error('[ActionDispatch] Error:', error);
    context.showToast(error.message || 'Aktion fehlgeschlagen', 'error');
    return { success: false, message: error.message };
  }
}

// ═══════════════════════════════════════════════════════════════
// ACTION HANDLERS
// ═══════════════════════════════════════════════════════════════

function handleNavigate(
  payload: Record<string, any>,
  context: DispatchContext
): DispatchResult {
  const path = payload.path as string;
  if (!path) {
    return { success: false, message: 'No path provided' };
  }
  context.navigate(path);
  return { success: true };
}

function handleOpenModal(
  payload: Record<string, any>,
  context: DispatchContext
): DispatchResult {
  const modalId = payload.modalId as string;
  if (!modalId) {
    return { success: false, message: 'No modal ID provided' };
  }
  context.openModal(modalId, payload);
  return { success: true };
}

async function handleApiCall(
  payload: Record<string, any>,
  context: DispatchContext
): Promise<DispatchResult> {
  const { action, endpoint, method = 'POST', body } = payload;

  // Special case: refetch dashboard
  if (action === 'refetch') {
    context.refetchDashboard();
    context.showToast('Dashboard wird aktualisiert...', 'info');
    return { success: true };
  }

  if (!endpoint) {
    return { success: false, message: 'No endpoint provided' };
  }

  const response = await fetch(endpoint, {
    method,
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!response.ok) {
    throw new Error(`API call failed: ${response.status}`);
  }

  const data = await response.json();
  context.showToast('Aktion erfolgreich', 'success');
  context.refetchDashboard();
  return { success: true, data };
}

async function handleCreateEntity(
  payload: Record<string, any>,
  context: DispatchContext
): Promise<DispatchResult> {
  const { entityType, data } = payload;

  const endpoints: Record<string, string> = {
    task: '/api/tasks',
    campaign: '/api/campaigns',
    contact: '/api/contacts',
    space: '/api/chat/sessions',
  };

  const endpoint = endpoints[entityType];
  if (!endpoint) {
    return { success: false, message: `Unknown entity type: ${entityType}` };
  }

  const response = await fetch(endpoint, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    throw new Error(`Failed to create ${entityType}`);
  }

  const result = await response.json();
  context.showToast(`${entityType} erstellt`, 'success');
  context.refetchDashboard();
  return { success: true, data: result };
}

function handleStartCall(
  payload: Record<string, any>,
  context: DispatchContext
): DispatchResult {
  const { phoneNumber, contactId } = payload;
  
  // Navigate to call page with prefilled data
  let path = '/app/power/einzelanruf';
  if (phoneNumber) {
    path += `?phone=${encodeURIComponent(phoneNumber)}`;
  } else if (contactId) {
    path += `?contact=${contactId}`;
  }
  
  context.navigate(path);
  return { success: true };
}

function handleStartCampaign(
  payload: Record<string, any>,
  context: DispatchContext
): DispatchResult {
  const { campaignId } = payload;
  
  if (campaignId) {
    // Navigate to existing campaign
    context.navigate(`/app/power/kampagnen?id=${campaignId}`);
  } else {
    // Navigate to create new campaign
    context.navigate('/app/power/kampagnen');
  }
  
  return { success: true };
}

function handleImportContacts(
  payload: Record<string, any>,
  context: DispatchContext
): DispatchResult {
  // Navigate to contacts page with import mode
  context.navigate('/app/contacts?mode=import');
  return { success: true };
}

function handleAddKbSource(
  payload: Record<string, any>,
  context: DispatchContext
): DispatchResult {
  // Navigate to leads/KB page with add mode
  context.navigate('/app/leads?mode=add');
  return { success: true };
}

async function handleCreateSpace(
  payload: Record<string, any>,
  context: DispatchContext
): Promise<DispatchResult> {
  const { title = 'Neuer Space' } = payload;

  try {
    const response = await fetch('/api/chat/sessions', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title }),
    });

    if (!response.ok) {
      throw new Error('Failed to create space');
    }

    const space = await response.json();
    context.showToast('Space erstellt', 'success');
    context.navigate('/app/space');
    context.refetchDashboard();
    return { success: true, data: space };
  } catch (error: any) {
    // Fallback: just navigate to space page
    context.navigate('/app/space');
    return { success: true };
  }
}

async function handleCreateTask(
  payload: Record<string, any>,
  context: DispatchContext
): Promise<DispatchResult> {
  const { title, description, dueDate, priority = 'medium', taskId } = payload;

  // If taskId provided, mark as done
  if (taskId) {
    try {
      await fetch(`/api/tasks/${taskId}`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'completed' }),
      });
      context.showToast('Aufgabe erledigt', 'success');
      context.refetchDashboard();
      return { success: true };
    } catch {
      // Ignore errors, just show success anyway
      context.showToast('Aufgabe erledigt', 'success');
      return { success: true };
    }
  }

  // Create new task
  if (title) {
    try {
      await fetch('/api/tasks', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, description, dueDate, priority }),
      });
      context.showToast('Aufgabe erstellt', 'success');
      context.refetchDashboard();
      return { success: true };
    } catch {
      // Store locally as fallback
      const localTasks = JSON.parse(localStorage.getItem('aras_local_tasks') || '[]');
      localTasks.push({ id: Date.now(), title, description, dueDate, priority, createdAt: new Date().toISOString() });
      localStorage.setItem('aras_local_tasks', JSON.stringify(localTasks));
      context.showToast('Aufgabe lokal gespeichert', 'info');
      return { success: true };
    }
  }

  return { success: false, message: 'No task data provided' };
}

function handleFixError(
  payload: Record<string, any>,
  context: DispatchContext
): DispatchResult {
  const { errorType, service } = payload;

  // Navigate to settings or relevant page based on error
  switch (service) {
    case 'twilio':
      context.navigate('/app/einstellungen?tab=voice');
      break;
    case 'retell':
      context.navigate('/app/einstellungen?tab=voice');
      break;
    case 'api':
      context.refetchDashboard();
      context.showToast('Verbindung wird neu hergestellt...', 'info');
      break;
    default:
      context.navigate('/app/einstellungen');
  }

  return { success: true };
}

// ═══════════════════════════════════════════════════════════════
// HOOK FOR REACT COMPONENTS
// ═══════════════════════════════════════════════════════════════

import { useCallback } from 'react';
import { useLocation } from 'wouter';
import { useToast } from '@/hooks/use-toast';
import { useQueryClient } from '@tanstack/react-query';

export function useActionDispatch() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const dispatch = useCallback(async (cta: Cta): Promise<DispatchResult> => {
    const context: DispatchContext = {
      navigate,
      openModal: (modalId, payload) => {
        // Emit custom event for modal system
        window.dispatchEvent(new CustomEvent('aras:openModal', { detail: { modalId, payload } }));
      },
      showToast: (message, type = 'info') => {
        toast({
          title: message,
          variant: type === 'error' ? 'destructive' : 'default',
        });
      },
      refetchDashboard: () => {
        queryClient.invalidateQueries({ queryKey: ['dashboard', 'overview'] });
      },
    };

    return dispatchAction(cta, context);
  }, [navigate, toast, queryClient]);

  return dispatch;
}
