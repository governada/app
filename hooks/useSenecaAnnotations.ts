'use client';

/**
 * useSenecaAnnotations — TanStack Query hook for ambient Seneca annotations.
 *
 * Fetches contextual annotations for the current page from the server.
 * Handles dismissal state per-session (sessionStorage) so dismissed
 * annotations don't re-appear within the same browsing session.
 */

import { useQuery } from '@tanstack/react-query';
import { useCallback, useMemo, useState } from 'react';
import type { SenecaAnnotationData } from '@/app/api/intelligence/annotations/route';
import { getStoredSession } from '@/lib/supabaseAuth';

interface UseSenecaAnnotationsOptions {
  pageContext: string;
  entityId?: string;
  /** Disable fetching (e.g., if feature flag is off client-side) */
  enabled?: boolean;
}

interface UseSenecaAnnotationsResult {
  annotations: SenecaAnnotationData[];
  isLoading: boolean;
  dismiss: (id: string) => void;
}

const DISMISSED_KEY = 'governada_dismissed_annotations';

function getDismissedIds(): Set<string> {
  if (typeof window === 'undefined') return new Set();
  try {
    const raw = sessionStorage.getItem(DISMISSED_KEY);
    return raw ? new Set(JSON.parse(raw) as string[]) : new Set();
  } catch {
    return new Set();
  }
}

function persistDismissedId(id: string) {
  if (typeof window === 'undefined') return;
  try {
    const ids = getDismissedIds();
    ids.add(id);
    sessionStorage.setItem(DISMISSED_KEY, JSON.stringify([...ids]));
  } catch {
    // Ignore storage errors
  }
}

export function useSenecaAnnotations({
  pageContext,
  entityId,
  enabled = true,
}: UseSenecaAnnotationsOptions): UseSenecaAnnotationsResult {
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(() => getDismissedIds());

  const { data, isLoading } = useQuery({
    queryKey: ['seneca-annotations', pageContext, entityId],
    queryFn: async () => {
      const params = new URLSearchParams({ pageContext });
      if (entityId) params.set('entityId', entityId);

      const headers: Record<string, string> = {};
      const token = getStoredSession();
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const res = await fetch(`/api/intelligence/annotations?${params}`, { headers });
      if (!res.ok) return { annotations: [], pageContext: '' };
      return res.json() as Promise<{ annotations: SenecaAnnotationData[]; pageContext: string }>;
    },
    enabled: enabled && !!pageContext,
    staleTime: 60_000, // 1 minute
    refetchOnWindowFocus: false,
  });

  const dismiss = useCallback((id: string) => {
    persistDismissedId(id);
    setDismissedIds((prev) => new Set([...prev, id]));
  }, []);

  const rawAnnotations = data?.annotations;
  const annotations = useMemo(() => {
    if (!rawAnnotations) return [];
    return rawAnnotations.filter((a) => !dismissedIds.has(a.id));
  }, [rawAnnotations, dismissedIds]);

  return { annotations, isLoading, dismiss };
}
