'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { SectionSentiment } from '@/lib/constitution/types';
import { fetchJson, postJson } from '@/lib/api/client';

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

/** Fetch aggregated section sentiment for an amendment draft. */
export function useAmendmentSentiment(draftId: string | null) {
  return useQuery<{ sections: Record<string, SectionSentiment> }>({
    queryKey: ['amendment-sentiment', draftId],
    queryFn: () =>
      fetchJson(`/api/workspace/amendment-sentiment?draftId=${encodeURIComponent(draftId!)}`),
    enabled: !!draftId,
    staleTime: 30_000,
  });
}

// ---------------------------------------------------------------------------
// Mutations
// ---------------------------------------------------------------------------

/** Submit or update the current user's sentiment on a section. */
export function useSubmitSentiment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: {
      draftId: string;
      sectionId: string;
      sentiment: 'support' | 'oppose' | 'neutral';
      comment?: string;
    }) =>
      postJson<{
        sentiment: {
          id: string;
          draftId: string;
          sectionId: string;
          userId: string;
          sentiment: string;
          comment: string | null;
          createdAt: string;
          updatedAt: string;
        };
      }>('/api/workspace/amendment-sentiment', body),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['amendment-sentiment', variables.draftId] });
    },
  });
}
