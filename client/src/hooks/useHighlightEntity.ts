/**
 * ============================================================================
 * useHighlightEntity - Hook for highlighting entities from Command Center
 * ============================================================================
 * Reads `selected` query param and provides highlight state + auto-scroll
 * ============================================================================
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { useLocation } from 'wouter';

interface UseHighlightEntityOptions {
  clearAfterMs?: number; // Auto-clear highlight after N ms
  scrollBehavior?: ScrollBehavior;
}

export function useHighlightEntity(options: UseHighlightEntityOptions = {}) {
  const { clearAfterMs = 3000, scrollBehavior = 'smooth' } = options;
  const [highlightedId, setHighlightedId] = useState<string | null>(null);
  const [location, navigate] = useLocation();
  const elementRefs = useRef<Map<string, HTMLElement>>(new Map());

  // Read `selected` param from URL on mount
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const selectedId = params.get('selected');
    
    if (selectedId) {
      setHighlightedId(selectedId);
      
      // Clear the param from URL without causing navigation
      params.delete('selected');
      const newUrl = params.toString() 
        ? `${window.location.pathname}?${params.toString()}`
        : window.location.pathname;
      window.history.replaceState({}, '', newUrl);
      
      // Auto-clear highlight after delay
      if (clearAfterMs > 0) {
        const timer = setTimeout(() => {
          setHighlightedId(null);
        }, clearAfterMs);
        return () => clearTimeout(timer);
      }
    }
  }, [location, clearAfterMs]);

  // Scroll to highlighted element when it's registered
  useEffect(() => {
    if (highlightedId) {
      // Small delay to allow DOM to render
      const timer = setTimeout(() => {
        const element = elementRefs.current.get(highlightedId);
        if (element) {
          element.scrollIntoView({ behavior: scrollBehavior, block: 'center' });
        }
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [highlightedId, scrollBehavior]);

  // Register element ref for auto-scroll
  const registerRef = useCallback((id: string, element: HTMLElement | null) => {
    if (element) {
      elementRefs.current.set(id, element);
    } else {
      elementRefs.current.delete(id);
    }
  }, []);

  // Check if entity is highlighted
  const isHighlighted = useCallback((id: string) => {
    return highlightedId === id;
  }, [highlightedId]);

  // Get highlight styles for an entity
  const getHighlightStyles = useCallback((id: string): React.CSSProperties => {
    if (highlightedId !== id) return {};
    
    return {
      boxShadow: '0 0 0 2px rgba(254,145,0,0.5), 0 0 20px rgba(254,145,0,0.3)',
      borderColor: 'rgba(254,145,0,0.5)',
      animation: 'pulse-glow 1.5s ease-in-out infinite',
    };
  }, [highlightedId]);

  // Get highlight class for an entity
  const getHighlightClass = useCallback((id: string): string => {
    if (highlightedId !== id) return '';
    return 'ring-2 ring-orange-500/50 shadow-[0_0_20px_rgba(254,145,0,0.3)]';
  }, [highlightedId]);

  // Clear highlight manually
  const clearHighlight = useCallback(() => {
    setHighlightedId(null);
  }, []);

  return {
    highlightedId,
    isHighlighted,
    getHighlightStyles,
    getHighlightClass,
    registerRef,
    clearHighlight,
  };
}

export default useHighlightEntity;
