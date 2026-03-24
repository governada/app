'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { ProposalTeam, TeamMember, TeamInvite } from '@/lib/workspace/types';
import { fetchJson, postJson, patchJson, deleteJson } from '@/lib/api/client';

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

/** Fetch team + members for a draft */
export function useTeam(draftId: string | null) {
  return useQuery<{ team: ProposalTeam | null; members: TeamMember[] }>({
    queryKey: ['proposal-team', draftId],
    queryFn: () => fetchJson(`/api/workspace/teams?draftId=${encodeURIComponent(draftId!)}`),
    enabled: !!draftId,
    staleTime: 30_000,
  });
}

// ---------------------------------------------------------------------------
// Mutations
// ---------------------------------------------------------------------------

/** Create a team for a draft */
export function useCreateTeam() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: { draftId: string; name?: string }) =>
      postJson<{ team: ProposalTeam; members: TeamMember[] }>('/api/workspace/teams', body),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['proposal-team', variables.draftId] });
    },
  });
}

/** Generate an invite code for a team */
export function useCreateInvite() {
  return useMutation({
    mutationFn: (body: {
      teamId: string;
      role: 'editor' | 'viewer';
      expiresInHours?: number;
      maxUses?: number;
    }) => postJson<{ invite: TeamInvite }>('/api/workspace/teams/invite', body),
  });
}

/** Join a team using an invite code */
export function useJoinTeam() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: { inviteCode: string }) =>
      postJson<{ success: boolean; teamId: string }>('/api/workspace/teams/join', body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['proposal-team'] });
    },
  });
}

/** Update a member's role */
export function useUpdateMemberRole() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: { memberId: string; role: 'editor' | 'viewer' }) =>
      patchJson<{ success: boolean }>('/api/workspace/teams/members', body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['proposal-team'] });
    },
  });
}

/** Remove a member from the team */
export function useRemoveMember() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: { memberId: string }) =>
      deleteJson<{ success: boolean }>('/api/workspace/teams/members', body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['proposal-team'] });
    },
  });
}
