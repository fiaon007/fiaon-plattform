/**
 * ============================================================================
 * INBOUND MAIL HOOKS
 * ============================================================================
 * Fetch hooks with polling for real-time inbox experience
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useCallback, useRef, useEffect } from 'react';
import type { 
  InboundMailListItem, 
  InboundMailDetail, 
  InboundMailCounts, 
  InboundMailFilters,
  InboundMailStatus 
} from './types';

const POLL_INTERVAL = 12000; // 12 seconds

// ============================================================================
// LIST HOOK
// ============================================================================

export function useInboundMailList(filters: InboundMailFilters = {}) {
  const { status = 'NEW', q, mailbox, limit = 30 } = filters;

  return useQuery({
    queryKey: ['inbound-mail-list', status, q, mailbox, limit],
    queryFn: async (): Promise<{ items: InboundMailListItem[]; nextCursor: number | null }> => {
      const params = new URLSearchParams();
      if (status) params.set('status', status);
      if (q) params.set('q', q);
      if (mailbox) params.set('mailbox', mailbox);
      params.set('limit', String(limit));

      const res = await fetch(`/api/internal/mail/inbound?${params}`, {
        credentials: 'include',
      });

      if (!res.ok) {
        throw new Error('Failed to fetch inbound mails');
      }

      const json = await res.json();
      return {
        items: json.data || [],
        nextCursor: json.pagination?.nextCursor || null,
      };
    },
    refetchInterval: POLL_INTERVAL,
    staleTime: 5000,
  });
}

// ============================================================================
// DETAIL HOOK (with in-memory cache)
// ============================================================================

const detailCache = new Map<number, InboundMailDetail>();

export function useInboundMailDetail(id: number | null) {
  return useQuery({
    queryKey: ['inbound-mail-detail', id],
    queryFn: async (): Promise<InboundMailDetail | null> => {
      if (!id) return null;

      // Check cache first
      if (detailCache.has(id)) {
        return detailCache.get(id)!;
      }

      const res = await fetch(`/api/internal/mail/inbound/${id}`, {
        credentials: 'include',
      });

      if (!res.ok) {
        throw new Error('Failed to fetch mail detail');
      }

      const json = await res.json();
      const detail = json.data as InboundMailDetail;

      // Cache it (keep max 10 items)
      if (detailCache.size >= 10) {
        const firstKey = detailCache.keys().next().value;
        if (firstKey !== undefined) detailCache.delete(firstKey);
      }
      detailCache.set(id, detail);

      return detail;
    },
    enabled: !!id,
    staleTime: 30000,
  });
}

// ============================================================================
// COUNTS HOOK
// ============================================================================

export function useInboundMailCounts() {
  return useQuery({
    queryKey: ['inbound-mail-counts'],
    queryFn: async (): Promise<InboundMailCounts> => {
      const res = await fetch('/api/internal/mail/inbound/count', {
        credentials: 'include',
      });

      if (!res.ok) {
        throw new Error('Failed to fetch mail counts');
      }

      const json = await res.json();
      return json.counts;
    },
    refetchInterval: POLL_INTERVAL,
    staleTime: 5000,
  });
}

// ============================================================================
// UPDATE STATUS MUTATION
// ============================================================================

export function useUpdateMailStatus() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, status }: { id: number; status: InboundMailStatus }) => {
      const res = await fetch(`/api/internal/mail/inbound/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ status }),
      });

      if (!res.ok) {
        throw new Error('Failed to update mail status');
      }

      return res.json();
    },
    onSuccess: (_, { id }) => {
      // Invalidate list and counts
      queryClient.invalidateQueries({ queryKey: ['inbound-mail-list'] });
      queryClient.invalidateQueries({ queryKey: ['inbound-mail-counts'] });
      // Update cache
      detailCache.delete(id);
      queryClient.invalidateQueries({ queryKey: ['inbound-mail-detail', id] });
    },
  });
}

// ============================================================================
// POLLING SYNC INDICATOR
// ============================================================================

export function usePollingIndicator() {
  const lastFetchRef = useRef<Date>(new Date());
  const { data, dataUpdatedAt } = useInboundMailCounts();

  useEffect(() => {
    if (dataUpdatedAt) {
      lastFetchRef.current = new Date(dataUpdatedAt);
    }
  }, [dataUpdatedAt]);

  return {
    lastSync: lastFetchRef.current,
    isLive: !!data,
  };
}
