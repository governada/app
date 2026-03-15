'use client';

import { useMemo } from 'react';
import Link from 'next/link';
import { useWallet } from '@/utils/wallet';
import { useGovernanceHolder } from '@/hooks/queries';
import { useDRepVotes } from '@/hooks/queries';
import { useSegment } from '@/components/providers/SegmentProvider';
import { computeTier } from '@/lib/scoring/tiers';
import { CheckCircle2, XCircle, MinusCircle, CircleDashed, User } from 'lucide-react';
import { cn } from '@/lib/utils';

interface YourRepresentativeCardProps {
  txHash: string;
  proposalIndex: number;
}

const VOTE_CONFIG: Record<
  string,
  { icon: typeof CheckCircle2; label: string; color: string; bg: string }
> = {
  Yes: {
    icon: CheckCircle2,
    label: 'Voted Yes',
    color: 'text-emerald-600 dark:text-emerald-400',
    bg: 'bg-emerald-500/10',
  },
  No: {
    icon: XCircle,
    label: 'Voted No',
    color: 'text-red-600 dark:text-red-400',
    bg: 'bg-red-500/10',
  },
  Abstain: {
    icon: MinusCircle,
    label: 'Abstained',
    color: 'text-amber-600 dark:text-amber-400',
    bg: 'bg-amber-500/10',
  },
};

export function YourRepresentativeCard({ txHash, proposalIndex }: YourRepresentativeCardProps) {
  const { delegatedDrepId } = useWallet();
  const { segment, stakeAddress, delegatedDrep } = useSegment();

  // Only show for citizens with a normal DRep delegation
  const hasDrep =
    !!delegatedDrep &&
    delegatedDrep !== 'drep_always_abstain' &&
    delegatedDrep !== 'drep_always_no_confidence';

  // Fetch holder data for DRep name + score
  const { data: holderRaw, isLoading: holderLoading } = useGovernanceHolder(
    hasDrep ? stakeAddress : null,
  );

  // Fetch DRep votes to find their vote on this proposal
  const { data: votesData, isLoading: votesLoading } = useDRepVotes(
    hasDrep ? delegatedDrepId : null,
  );

  const vote = useMemo(() => {
    const vData = votesData as Record<string, unknown> | undefined;
    const votes = vData?.votes as Record<string, unknown>[] | undefined;
    if (!votes) return null;
    const match = votes.find(
      (v) => v.proposalTxHash === txHash && v.proposalIndex === proposalIndex,
    );
    return (match?.vote as string) || null;
  }, [votesData, txHash, proposalIndex]);

  // Don't render for non-citizens or those without a DRep
  if (segment !== 'citizen' || !hasDrep) return null;

  // Still loading
  if (holderLoading || votesLoading) {
    return (
      <div className="rounded-xl border-l-4 border-l-primary/60 border border-border/50 bg-card/70 backdrop-blur-md p-4 animate-pulse">
        <div className="h-4 w-48 bg-muted rounded" />
        <div className="h-3 w-32 bg-muted rounded mt-2" />
      </div>
    );
  }

  const holder = holderRaw as Record<string, unknown> | undefined;
  const drep = holder?.drep as Record<string, unknown> | undefined;
  const drepName = (drep?.name as string) || (drep?.ticker as string) || 'Your DRep';
  const drepScore = (drep?.score as number) ?? 0;
  const tier = computeTier(drepScore);

  const voteConfig = vote ? VOTE_CONFIG[vote] : null;
  const VoteIcon = voteConfig?.icon ?? CircleDashed;

  return (
    <div className="rounded-xl border-l-4 border-l-primary/60 border border-border/50 bg-card/70 backdrop-blur-md p-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          {/* Avatar placeholder */}
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10">
            <User className="h-4 w-4 text-primary" />
          </div>

          <div className="min-w-0">
            {/* DRep name + score */}
            <div className="flex items-center gap-2">
              <Link
                href={`/drep/${encodeURIComponent(delegatedDrepId!)}`}
                className="text-sm font-semibold text-foreground hover:text-primary truncate"
              >
                {drepName}
              </Link>
              <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                {tier} &middot; {Math.round(drepScore)}
              </span>
            </div>

            {/* Vote status */}
            <div className="flex items-center gap-1.5 mt-0.5">
              <VoteIcon
                className={cn('h-3.5 w-3.5', voteConfig?.color ?? 'text-muted-foreground')}
              />
              <span
                className={cn('text-xs font-medium', voteConfig?.color ?? 'text-muted-foreground')}
              >
                {voteConfig ? voteConfig.label : "Hasn't voted on this yet"}
              </span>
            </div>
          </div>
        </div>

        <Link
          href={`/drep/${encodeURIComponent(delegatedDrepId!)}`}
          className="shrink-0 text-xs text-primary hover:underline"
        >
          Profile
        </Link>
      </div>
    </div>
  );
}
