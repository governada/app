'use client';

import { formatAda } from '@/lib/treasury';
import { useWallet } from '@/utils/wallet';
import { useDRepTreasuryRecord } from '@/hooks/useDRepTreasuryRecord';
import { Skeleton } from '@/components/ui/skeleton';

/**
 * Shows citizens how their delegated DRep votes on treasury proposals.
 * Only renders when the citizen has a delegated DRep with treasury votes.
 */
export function CitizenDRepStance() {
  const { delegatedDrepId } = useWallet();
  const { data, isLoading } = useDRepTreasuryRecord(delegatedDrepId);

  if (!delegatedDrepId) return null;
  if (isLoading) return <Skeleton className="h-16 w-full rounded-xl" />;

  const record = data?.record;
  if (!record || record.totalProposals === 0) return null;

  const approvalRate =
    record.totalProposals > 0
      ? Math.round((record.approvedCount / record.totalProposals) * 100)
      : 0;

  return (
    <div className="rounded-xl border border-border/50 bg-card/70 backdrop-blur-md p-4 text-sm">
      <p className="text-muted-foreground">
        <span className="font-medium text-foreground">Your DRep</span> approved{' '}
        <span className="font-semibold text-foreground">{approvalRate}%</span> of treasury proposals
        (₳{formatAda(record.approvedAda)} across {record.approvedCount} of {record.totalProposals})
        {record.judgmentScore !== null && (
          <span>
            {' '}
            — <span className="font-semibold text-foreground">{record.judgmentScore}%</span> of
            approved spending delivered
          </span>
        )}
      </p>
    </div>
  );
}
