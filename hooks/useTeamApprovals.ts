'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface TeamApproval {
  memberId: string;
  stakeAddress: string;
  role: string;
  approvedAt: string | null;
}

export interface ApprovalsResponse {
  approvals: TeamApproval[];
  allApproved: boolean;
  pendingCount: number;
}

import { fetchJson, postJson } from '@/lib/api/client';

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

/** Fetch team approval status for a draft */
export function useTeamApprovals(draftId: string | null) {
  return useQuery<ApprovalsResponse>({
    queryKey: ['team-approvals', draftId],
    queryFn: () => fetchJson(`/api/workspace/drafts/${encodeURIComponent(draftId!)}/approvals`),
    enabled: !!draftId,
    staleTime: 15_000,
  });
}

// ---------------------------------------------------------------------------
// Mutations
// ---------------------------------------------------------------------------

/** Record approval for the current user */
export function useApproveSubmission(draftId: string) {
  const queryClient = useQueryClient();

  return useMutation<{ success: boolean; approvedAt: string }, Error, { stakeAddress: string }>({
    mutationFn: ({ stakeAddress }) =>
      postJson(`/api/workspace/drafts/${encodeURIComponent(draftId)}/approvals`, {
        stakeAddress,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['team-approvals', draftId] });
    },
  });
}
