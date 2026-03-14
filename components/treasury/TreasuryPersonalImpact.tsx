'use client';

import { useQuery } from '@tanstack/react-query';
import { formatAda } from '@/lib/treasury';
import type { DRepTreasuryRecord } from '@/lib/treasury';
import { useSegment } from '@/components/providers/SegmentProvider';
import { useTreasuryPending } from '@/hooks/queries';

interface TreasuryPersonalImpactProps {
  balanceAda: number;
  nclRemainingAda: number | null;
  nclAda: number | null;
  nclUtilizationPct: number | null;
}

export function TreasuryPersonalImpact({
  balanceAda,
  nclRemainingAda,
  nclAda,
  nclUtilizationPct,
}: TreasuryPersonalImpactProps) {
  const { drepId } = useSegment();

  const { data: rawRecord } = useQuery<{ record: DRepTreasuryRecord }>({
    queryKey: ['treasury-drep-record', drepId],
    queryFn: async () => {
      const res = await fetch(`/api/treasury/drep-record?drepId=${encodeURIComponent(drepId!)}`);
      if (!res.ok) throw new Error('Failed to fetch DRep treasury record');
      return res.json();
    },
    enabled: !!drepId,
    staleTime: 5 * 60 * 1000,
  });

  const { data: rawPending } = useTreasuryPending();
  const pending = rawPending as { totalAda: number; proposals: unknown[] } | undefined;

  const record = rawRecord?.record;
  const hasDRepData = !!record && record.totalProposals > 0;

  // Compute what-if: if all pending pass, new utilization
  const pendingTotalAda = pending?.totalAda ?? 0;
  const postPendingUtilization =
    nclAda && nclRemainingAda != null && nclUtilizationPct != null
      ? Math.round(((nclAda - nclRemainingAda + pendingTotalAda) / nclAda) * 100)
      : null;

  if (!hasDRepData && pendingTotalAda === 0) return null;

  return (
    <div className="rounded-xl border border-border/50 bg-card/70 backdrop-blur-md p-5">
      <h3 className="text-sm font-semibold mb-3">Your Treasury Impact</h3>

      <div className="space-y-3">
        {/* DRep voting record summary */}
        {hasDRepData && record && (
          <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm">
            <div>
              <span className="text-muted-foreground">Approved </span>
              <span className="font-semibold text-emerald-400">
                ₳{formatAda(record.approvedAda)}
              </span>
              <span className="text-muted-foreground text-xs ml-1">
                ({record.approvedCount} proposals)
              </span>
            </div>
            <div>
              <span className="text-muted-foreground">Opposed </span>
              <span className="font-semibold text-red-400">₳{formatAda(record.opposedAda)}</span>
              <span className="text-muted-foreground text-xs ml-1">({record.opposedCount})</span>
            </div>
            {record.abstainedCount > 0 && (
              <div>
                <span className="text-muted-foreground">Abstained </span>
                <span className="font-semibold">{record.abstainedCount}</span>
              </div>
            )}
          </div>
        )}

        {/* Judgment score */}
        {hasDRepData && record?.judgmentScore !== null && record?.judgmentScore !== undefined && (
          <div className="text-sm">
            <span className="text-muted-foreground">Of what you approved, </span>
            <span className="font-semibold">{record.judgmentScore}%</span>
            <span className="text-muted-foreground"> delivered results</span>
          </div>
        )}

        {/* Pending impact projection */}
        {pendingTotalAda > 0 && (
          <div className="text-sm text-muted-foreground pt-2 border-t border-border/30">
            If all {pending?.proposals.length ?? 0} pending proposals pass:{' '}
            <span className="font-semibold text-foreground">₳{formatAda(pendingTotalAda)}</span>{' '}
            leaves the treasury
            {postPendingUtilization !== null && nclUtilizationPct !== null && (
              <span>
                {' '}
                — budget utilization{' '}
                <span className="font-semibold text-foreground">
                  {Math.round(nclUtilizationPct)}% → {postPendingUtilization}%
                </span>
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
