/**
 * ============================================================================
 * ARAS COMMAND CENTER - SAVED VIEWS (localStorage)
 * ============================================================================
 * Client-side filter/view persistence for Internal CRM
 * Path B: No DB schema, uses localStorage per user/device
 * ============================================================================
 */

// Storage key prefix
const STORAGE_KEY_PREFIX = 'aras_views_v1';

// Entity types that support saved views
export type ViewEntity = 'contacts' | 'companies' | 'deals' | 'tasks' | 'calls';

// Filter value types
export interface ViewFilters {
  status?: string;
  stage?: string;
  source?: string;
  industry?: string;
  dateRange?: {
    start?: string;
    end?: string;
  };
  search?: string;
  tags?: string[];
  [key: string]: any;
}

// Sort configuration
export interface ViewSort {
  field: string;
  direction: 'asc' | 'desc';
}

// Saved view structure
export interface SavedView {
  id: string;
  name: string;
  entity: ViewEntity;
  filters: ViewFilters;
  sort?: ViewSort;
  createdAt: string;
  updatedAt: string;
}

// Storage structure per entity
interface ViewStorage {
  views: SavedView[];
  activeViewId?: string;
}

/**
 * Generate storage key for entity views
 */
function getStorageKey(userId: string | undefined, entity: ViewEntity): string {
  const userPart = userId || 'anonymous';
  return `${STORAGE_KEY_PREFIX}:${userPart}:${entity}`;
}

/**
 * Generate unique view ID
 */
function generateViewId(): string {
  return `view_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

/**
 * Read views from localStorage (with error handling)
 */
function readStorage(key: string): ViewStorage {
  try {
    const stored = localStorage.getItem(key);
    if (!stored) return { views: [] };
    
    const parsed = JSON.parse(stored);
    // Validate structure
    if (!Array.isArray(parsed.views)) {
      return { views: [] };
    }
    return parsed;
  } catch (e) {
    console.warn('[SavedViews] Failed to read storage:', e);
    return { views: [] };
  }
}

/**
 * Write views to localStorage (with error handling)
 */
function writeStorage(key: string, data: ViewStorage): boolean {
  try {
    localStorage.setItem(key, JSON.stringify(data));
    return true;
  } catch (e) {
    console.warn('[SavedViews] Failed to write storage:', e);
    return false;
  }
}

// ============================================================================
// PUBLIC API
// ============================================================================

/**
 * Get all saved views for an entity
 */
export function getSavedViews(userId: string | undefined, entity: ViewEntity): SavedView[] {
  const key = getStorageKey(userId, entity);
  const storage = readStorage(key);
  return storage.views;
}

/**
 * Get a single saved view by ID
 */
export function getSavedView(userId: string | undefined, entity: ViewEntity, viewId: string): SavedView | undefined {
  const views = getSavedViews(userId, entity);
  return views.find(v => v.id === viewId);
}

/**
 * Get the currently active view for an entity
 */
export function getActiveView(userId: string | undefined, entity: ViewEntity): SavedView | undefined {
  const key = getStorageKey(userId, entity);
  const storage = readStorage(key);
  if (!storage.activeViewId) return undefined;
  return storage.views.find(v => v.id === storage.activeViewId);
}

/**
 * Set the active view for an entity
 */
export function setActiveView(userId: string | undefined, entity: ViewEntity, viewId: string | undefined): boolean {
  const key = getStorageKey(userId, entity);
  const storage = readStorage(key);
  storage.activeViewId = viewId;
  return writeStorage(key, storage);
}

/**
 * Create a new saved view
 */
export function createSavedView(
  userId: string | undefined,
  entity: ViewEntity,
  name: string,
  filters: ViewFilters,
  sort?: ViewSort
): SavedView | null {
  const key = getStorageKey(userId, entity);
  const storage = readStorage(key);
  
  const now = new Date().toISOString();
  const newView: SavedView = {
    id: generateViewId(),
    name,
    entity,
    filters,
    sort,
    createdAt: now,
    updatedAt: now,
  };
  
  storage.views.push(newView);
  
  if (writeStorage(key, storage)) {
    return newView;
  }
  return null;
}

/**
 * Update an existing saved view
 */
export function updateSavedView(
  userId: string | undefined,
  entity: ViewEntity,
  viewId: string,
  updates: { name?: string; filters?: ViewFilters; sort?: ViewSort }
): SavedView | null {
  const key = getStorageKey(userId, entity);
  const storage = readStorage(key);
  
  const viewIndex = storage.views.findIndex(v => v.id === viewId);
  if (viewIndex === -1) return null;
  
  const view = storage.views[viewIndex];
  const updatedView: SavedView = {
    ...view,
    name: updates.name ?? view.name,
    filters: updates.filters ?? view.filters,
    sort: updates.sort ?? view.sort,
    updatedAt: new Date().toISOString(),
  };
  
  storage.views[viewIndex] = updatedView;
  
  if (writeStorage(key, storage)) {
    return updatedView;
  }
  return null;
}

/**
 * Delete a saved view
 */
export function deleteSavedView(userId: string | undefined, entity: ViewEntity, viewId: string): boolean {
  const key = getStorageKey(userId, entity);
  const storage = readStorage(key);
  
  const viewIndex = storage.views.findIndex(v => v.id === viewId);
  if (viewIndex === -1) return false;
  
  storage.views.splice(viewIndex, 1);
  
  // Clear active view if it was deleted
  if (storage.activeViewId === viewId) {
    storage.activeViewId = undefined;
  }
  
  return writeStorage(key, storage);
}

/**
 * Clear all saved views for an entity
 */
export function clearAllViews(userId: string | undefined, entity: ViewEntity): boolean {
  const key = getStorageKey(userId, entity);
  return writeStorage(key, { views: [] });
}

// ============================================================================
// REACT HOOK
// ============================================================================

import { useState, useCallback, useEffect } from 'react';

interface UseSavedViewsResult {
  views: SavedView[];
  activeView: SavedView | undefined;
  setActiveViewId: (viewId: string | undefined) => void;
  createView: (name: string, filters: ViewFilters, sort?: ViewSort) => SavedView | null;
  updateView: (viewId: string, updates: { name?: string; filters?: ViewFilters; sort?: ViewSort }) => SavedView | null;
  deleteView: (viewId: string) => boolean;
  refresh: () => void;
}

/**
 * React hook for managing saved views
 */
export function useSavedViews(userId: string | undefined, entity: ViewEntity): UseSavedViewsResult {
  const [views, setViews] = useState<SavedView[]>([]);
  const [activeViewId, setActiveViewIdState] = useState<string | undefined>();

  // Load views on mount
  const refresh = useCallback(() => {
    const loadedViews = getSavedViews(userId, entity);
    setViews(loadedViews);
    
    const key = getStorageKey(userId, entity);
    const storage = readStorage(key);
    setActiveViewIdState(storage.activeViewId);
  }, [userId, entity]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  // Active view object
  const activeView = views.find(v => v.id === activeViewId);

  // Set active view
  const setActiveViewIdHandler = useCallback((viewId: string | undefined) => {
    setActiveView(userId, entity, viewId);
    setActiveViewIdState(viewId);
  }, [userId, entity]);

  // Create view
  const createView = useCallback((name: string, filters: ViewFilters, sort?: ViewSort) => {
    const newView = createSavedView(userId, entity, name, filters, sort);
    if (newView) {
      setViews(prev => [...prev, newView]);
    }
    return newView;
  }, [userId, entity]);

  // Update view
  const updateView = useCallback((viewId: string, updates: { name?: string; filters?: ViewFilters; sort?: ViewSort }) => {
    const updatedView = updateSavedView(userId, entity, viewId, updates);
    if (updatedView) {
      setViews(prev => prev.map(v => v.id === viewId ? updatedView : v));
    }
    return updatedView;
  }, [userId, entity]);

  // Delete view
  const deleteViewHandler = useCallback((viewId: string) => {
    const success = deleteSavedView(userId, entity, viewId);
    if (success) {
      setViews(prev => prev.filter(v => v.id !== viewId));
      if (activeViewId === viewId) {
        setActiveViewIdState(undefined);
      }
    }
    return success;
  }, [userId, entity, activeViewId]);

  return {
    views,
    activeView,
    setActiveViewId: setActiveViewIdHandler,
    createView,
    updateView,
    deleteView: deleteViewHandler,
    refresh,
  };
}
