import { useQuery } from '@tanstack/react-query';
import type { DRepTreasuryRecord } from '@/lib/treasury';

/**
 * Fetch a DRep's treasury voting record.
 * Shared between DRepTreasuryTrackRecord, TreasuryPersonalImpact,
 * CitizenDRepStance, and TreasuryPendingProposals.
 */
export function useDRepTreasuryRecord(drepId: string | null | undefined) {
  return useQuery<{ record: DRepTreasuryRecord }>({
    queryKey: ['treasury-drep-record', drepId],
    queryFn: async () => {
      const res = await fetch(`/api/treasury/drep-record?drepId=${encodeURIComponent(drepId!)}`);
      if (!res.ok) throw new Error('Failed to fetch DRep treasury record');
      return res.json();
    },
    enabled: !!drepId,
    staleTime: 5 * 60 * 1000,
  });
}
