'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { GenealogyEntry } from '@/lib/constitution/types';
import { fetchJson, postJson } from '@/lib/api/client';

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

/** Fetch the genealogy timeline for an amendment draft. */
export function useAmendmentGenealogy(draftId: string | null) {
  return useQuery<{ entries: GenealogyEntry[] }>({
    queryKey: ['amendment-genealogy', draftId],
    queryFn: () =>
      fetchJson(`/api/workspace/amendment-genealogy?draftId=${encodeURIComponent(draftId!)}`),
    enabled: !!draftId,
    staleTime: 30_000,
  });
}

// ---------------------------------------------------------------------------
// Mutations
// ---------------------------------------------------------------------------

/** Record a new genealogy event for an amendment change. */
export function useRecordGenealogy() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: {
      draftId: string;
      changeId: string;
      action: 'created' | 'accepted' | 'rejected' | 'modified' | 'merged';
      actionReason?: string;
      sourceType?: 'author' | 'reviewer' | 'ai';
    }) => postJson<{ entry: GenealogyEntry }>('/api/workspace/amendment-genealogy', body),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['amendment-genealogy', variables.draftId] });
    },
  });
}
