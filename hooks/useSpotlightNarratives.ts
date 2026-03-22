'use client';

import { useQuery } from '@tanstack/react-query';

/**
 * Fetch a single spotlight narrative for an entity.
 * Falls back gracefully — if the API returns null, the card uses template narrative.
 */
export function useSpotlightNarrative(entityType: 'drep' | 'spo' | null, entityId: string | null) {
  return useQuery({
    queryKey: ['spotlight-narrative', entityType, entityId],
    queryFn: async () => {
      if (!entityType || !entityId) return null;
      const res = await fetch('/api/spotlight/narrative', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ entityType, entityId }),
      });
      if (!res.ok) return null;
      const data = await res.json();
      return (data.narrative as string) ?? null;
    },
    enabled: !!entityType && !!entityId,
    staleTime: 5 * 60 * 1000, // 5 minutes
    retry: false,
  });
}

/**
 * Batch-fetch cached narratives for the next N entities in the spotlight queue.
 * Used for pre-loading to eliminate latency during browsing.
 */
export function useSpotlightNarrativesBatch(
  entityType: 'drep' | 'spo' | null,
  entityIds: string[],
) {
  return useQuery({
    queryKey: ['spotlight-narratives-batch', entityType, entityIds.join(',')],
    queryFn: async () => {
      if (!entityType || entityIds.length === 0) return {};
      const res = await fetch('/api/spotlight/narratives/batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ entityType, entityIds }),
      });
      if (!res.ok) return {};
      const data = await res.json();
      return (data.narratives as Record<string, string>) ?? {};
    },
    enabled: !!entityType && entityIds.length > 0,
    staleTime: 5 * 60 * 1000,
    retry: false,
  });
}
