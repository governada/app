'use client';

/**
 * Revision management hooks.
 *
 * Provides TanStack Query hooks for fetching revision state
 * and submitting revisions with change justifications.
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { ChangeJustification, RevisionState } from '@/lib/workspace/revision/types';
import type { DraftVersion } from '@/lib/workspace/types';
import { fetchJson, postJson } from '@/lib/api/client';

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

/** Fetch the current revision state for a draft (latest version, diffs, justifications) */
export function useRevisionState(draftId: string | null) {
  return useQuery<{ state: RevisionState }>({
    queryKey: ['revision-state', draftId],
    queryFn: () => fetchJson(`/api/workspace/revision?draftId=${encodeURIComponent(draftId!)}`),
    enabled: !!draftId,
    staleTime: 15_000,
  });
}

// ---------------------------------------------------------------------------
// Mutations
// ---------------------------------------------------------------------------

interface SubmitRevisionInput {
  versionName: string;
  editSummary?: string;
  changeJustifications: ChangeJustification[];
}

/** Submit a new revision with change justifications */
export function useSubmitRevision(draftId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: SubmitRevisionInput) =>
      postJson<{ version: DraftVersion }>('/api/workspace/revision', {
        draftId,
        versionName: input.versionName,
        editSummary: input.editSummary,
        changeJustifications: input.changeJustifications,
      }),
    onSuccess: () => {
      // Invalidate revision state and draft queries
      queryClient.invalidateQueries({ queryKey: ['revision-state', draftId] });
      queryClient.invalidateQueries({ queryKey: ['author-draft', draftId] });
      queryClient.invalidateQueries({ queryKey: ['author-drafts'] });
    },
  });
}
