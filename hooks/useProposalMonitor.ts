'use client';

/**
 * Hook to fetch monitoring data for a submitted governance action.
 *
 * Uses TanStack Query with a 1-minute stale time and 5-minute auto-refetch
 * since voting data changes slowly (epoch-based).
 */

import { useQuery } from '@tanstack/react-query';
import type { ProposalMonitorData } from '@/lib/workspace/monitor-types';
import { fetchJson } from '@/lib/api/client';

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useProposalMonitor(txHash: string | null, proposalIndex: number | null) {
  return useQuery<ProposalMonitorData>({
    queryKey: ['proposal-monitor', txHash, proposalIndex],
    queryFn: () =>
      fetchJson<ProposalMonitorData>(
        `/api/workspace/proposals/monitor?txHash=${encodeURIComponent(txHash!)}&proposalIndex=${proposalIndex}`,
      ),
    enabled: !!txHash && proposalIndex != null,
    staleTime: 60_000, // 1 minute
    refetchInterval: 300_000, // refetch every 5 minutes
  });
}
