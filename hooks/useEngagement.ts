'use client';

import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { CredibilityResult, CredibilityTier } from '@/lib/citizenCredibility';
import { useSegment } from '@/components/providers/SegmentProvider';
import { fetchJson } from '@/lib/api/client';

const STALE_30S = 30_000;
const STALE_60S = 60_000;

// -- Sentiment --

export interface SentimentResults {
  community: { support: number; oppose: number; unsure: number; total: number };
  delegators?: { support: number; oppose: number; unsure: number; total: number };
  stakeWeighted?: { support: number; oppose: number; unsure: number; total: number };
  userSentiment: 'support' | 'oppose' | 'unsure' | null;
  hasVoted: boolean;
}

export function useSentimentResults(txHash: string, proposalIndex: number, drepId?: string | null) {
  const params = new URLSearchParams({
    proposalTxHash: txHash,
    proposalIndex: String(proposalIndex),
  });
  if (drepId) params.set('drepId', drepId);

  return useQuery<SentimentResults>({
    queryKey: ['citizen-sentiment', txHash, proposalIndex, drepId ?? null],
    queryFn: () => fetchJson(`/api/engagement/sentiment/results?${params}`),
    staleTime: STALE_30S,
  });
}

// -- Concern Flags --

export interface ConcernFlagResults {
  flags: Record<string, number>;
  total: number;
  userFlags: string[];
}

export function useConcernFlags(txHash: string, proposalIndex: number) {
  return useQuery<ConcernFlagResults>({
    queryKey: ['concern-flags', txHash, proposalIndex],
    queryFn: () =>
      fetchJson(
        `/api/engagement/concerns/results?proposalTxHash=${txHash}&proposalIndex=${proposalIndex}`,
      ),
    staleTime: STALE_30S,
  });
}

// -- Impact Tags --

export interface ImpactTagResults {
  awareness: Record<string, number>;
  ratings: Record<string, number>;
  total: number;
  userTag: { awareness: string; rating: string } | null;
}

export function useImpactTags(txHash: string, proposalIndex: number) {
  return useQuery<ImpactTagResults>({
    queryKey: ['impact-tags', txHash, proposalIndex],
    queryFn: () =>
      fetchJson(
        `/api/engagement/impact/results?proposalTxHash=${txHash}&proposalIndex=${proposalIndex}`,
      ),
    staleTime: STALE_30S,
  });
}

// -- Priority Signals --

export interface PriorityRankings {
  rankings: { priority: string; score: number; rank: number; firstChoiceCount: number }[];
  totalVoters: number;
  epoch: number;
}

export function usePriorityRankings(epoch?: number) {
  const params = epoch ? `?epoch=${epoch}` : '';
  return useQuery<PriorityRankings>({
    queryKey: ['priority-rankings', epoch ?? 'current'],
    queryFn: () => fetchJson(`/api/engagement/priorities/results${params}`),
    staleTime: STALE_60S,
  });
}

export interface UserPrioritySignal {
  rankedPriorities: string[];
  epoch: number;
}

export function useUserPrioritySignal(epoch?: number) {
  const params = epoch ? `?epoch=${epoch}` : '';
  return useQuery<UserPrioritySignal | null>({
    queryKey: ['user-priority-signal', epoch ?? 'current'],
    queryFn: () => fetchJson(`/api/engagement/priorities/user${params}`),
    staleTime: STALE_60S,
  });
}

// -- Assemblies --

export interface Assembly {
  id: string;
  title: string;
  description: string | null;
  question: string;
  options: { key: string; label: string; description?: string }[];
  status: 'draft' | 'active' | 'closed' | 'cancelled' | 'quorum_not_met';
  epoch: number;
  opensAt: string;
  closesAt: string;
  results: { key: string; label: string; count: number; percentage: number }[] | null;
  totalVotes: number;
  quorumThreshold?: number;
}

export interface AssemblyWithUserVote extends Assembly {
  userVote: string | null;
}

export function useActiveAssembly() {
  return useQuery<AssemblyWithUserVote | null>({
    queryKey: ['active-assembly'],
    queryFn: () => fetchJson('/api/engagement/assembly/active'),
    staleTime: STALE_60S,
  });
}

export function useAssemblyHistory() {
  return useQuery<Assembly[]>({
    queryKey: ['assembly-history'],
    queryFn: () => fetchJson('/api/engagement/assembly/history'),
    staleTime: STALE_60S,
  });
}

// -- Citizen Voice (engagement feedback loop) --

export interface CitizenVoiceProposal {
  txHash: string;
  index: number;
  title: string | null;
  proposalType: string | null;
  userSentiment: string;
  communitySupport: number;
  communityTotal: number;
  communityAgreement: number | null;
  drepVote: string | null;
  drepAligned: boolean | null;
  outcome: string;
}

export interface CitizenVoiceSummary {
  totalVotes: number;
  sentimentBreakdown: { support: number; oppose: number; unsure: number };
  avgCommunityAgreement: number | null;
  drepAligned: number;
  drepDiverged: number;
  epoch: number;
}

export interface CitizenVoiceData {
  proposals: CitizenVoiceProposal[];
  summary: CitizenVoiceSummary | null;
}

export function useCitizenVoice(wallet?: string | null) {
  const params = wallet ? `?wallet=${encodeURIComponent(wallet)}` : '';
  return useQuery<CitizenVoiceData>({
    queryKey: ['citizen-voice', wallet ?? null],
    queryFn: () => fetchJson(`/api/engagement/citizen-voice${params}`),
    staleTime: STALE_60S,
    enabled: !!wallet,
  });
}

// -- Endorsements --

export interface EndorsementResults {
  entityType: string;
  entityId: string;
  total: number;
  byType: Record<string, number>;
  userEndorsements: string[];
}

export function useEndorsements(entityType: string, entityId: string) {
  return useQuery<EndorsementResults>({
    queryKey: ['endorsements', entityType, entityId],
    queryFn: () =>
      fetchJson(
        `/api/engagement/endorsements?entityType=${encodeURIComponent(entityType)}&entityId=${encodeURIComponent(entityId)}`,
      ),
    staleTime: STALE_60S,
    enabled: !!entityId,
  });
}

// -- Batch Endorsement Counts --

export interface BatchEndorsementCounts {
  counts: Record<string, number>;
}

/**
 * Fetch endorsement counts for multiple entities in a single request.
 * Returns a map of entityId -> total endorsement count (only entries with count > 0).
 */
export function useBatchEndorsementCounts(entityType: string, entityIds: string[]) {
  const key = entityIds.length > 0 ? entityIds.slice().sort().join(',') : '';
  return useQuery<BatchEndorsementCounts>({
    queryKey: ['endorsement-counts', entityType, key],
    queryFn: () =>
      fetchJson(
        `/api/engagement/endorsements/batch?entityType=${encodeURIComponent(entityType)}&entityIds=${encodeURIComponent(entityIds.join(','))}`,
      ),
    staleTime: STALE_60S,
    enabled: entityIds.length > 0,
  });
}

// -- Citizen Credibility --

export type { CredibilityResult as CitizenCredibility } from '@/lib/citizenCredibility';

export interface CredibilityWithLevel extends CredibilityResult {
  engagementLevel?: {
    level: string;
    nextLevel: string | null;
    progressToNext: number;
  };
}

/** Credibility weight per tier (midpoint) for admin simulation */
const TIER_WEIGHT: Record<CredibilityTier, number> = {
  standard: 0.3,
  enhanced: 0.65,
  full: 0.9,
};

/**
 * Fetch citizen credibility + engagement level data.
 * When admin dimension overrides are active, patches the response so
 * downstream components (EngagementHero, etc.) render the simulated state.
 */
export function useCitizenCredibility() {
  const { dimensionOverrides } = useSegment();
  const query = useQuery<CredibilityWithLevel>({
    queryKey: ['citizen-credibility'],
    queryFn: () => fetchJson('/api/engagement/credibility'),
    staleTime: 5 * 60 * 1000,
  });

  const patchedData = useMemo(() => {
    if (!query.data) return undefined;
    const hasEngagementOverride = dimensionOverrides.engagementLevel != null;
    const hasCredibilityOverride = dimensionOverrides.credibilityTier != null;
    if (!hasEngagementOverride && !hasCredibilityOverride) return query.data;

    const patched = { ...query.data };

    if (hasCredibilityOverride) {
      const tier = dimensionOverrides.credibilityTier!;
      patched.tier = tier;
      patched.weight = TIER_WEIGHT[tier];
    }

    if (hasEngagementOverride && patched.engagementLevel) {
      const level = dimensionOverrides.engagementLevel!;
      patched.engagementLevel = {
        ...patched.engagementLevel,
        level,
        nextLevel:
          level === 'Champion'
            ? null
            : level === 'Engaged'
              ? 'Champion'
              : level === 'Informed'
                ? 'Engaged'
                : 'Informed',
        progressToNext: level === 'Champion' ? 100 : 50,
      };
    }

    return patched;
  }, [query.data, dimensionOverrides.engagementLevel, dimensionOverrides.credibilityTier]);

  return { ...query, data: patchedData };
}
