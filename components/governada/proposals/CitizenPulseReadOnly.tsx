'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { BarChart3, Users } from 'lucide-react';
import { useWallet } from '@/utils/wallet';
import { useSentimentResults, useConcernFlags } from '@/hooks/useEngagement';
import { CONCERN_FLAG_LABELS } from '@/lib/engagement/labels';
import type { ConcernFlagType } from '@/lib/api/schemas/engagement';

interface CitizenPulseReadOnlyProps {
  txHash: string;
  proposalIndex: number;
}

/**
 * Read-only view of citizen sentiment and concerns for DReps/SPOs.
 * Shows aggregated results without voting buttons.
 * DReps also see their delegator sentiment breakdown.
 */
export function CitizenPulseReadOnly({ txHash, proposalIndex }: CitizenPulseReadOnlyProps) {
  const { ownDRepId } = useWallet();
  const { data: sentimentResults, isLoading: sentimentLoading } = useSentimentResults(
    txHash,
    proposalIndex,
    ownDRepId,
  );
  const { data: concernResults, isLoading: concernsLoading } = useConcernFlags(
    txHash,
    proposalIndex,
  );

  if (sentimentLoading || concernsLoading) {
    return (
      <Card className="bg-muted/30">
        <CardHeader className="pb-3">
          <Skeleton className="h-5 w-40" />
        </CardHeader>
        <CardContent className="space-y-3">
          <Skeleton className="h-3 w-full" />
          <Skeleton className="h-3 w-3/4" />
          <Skeleton className="h-3 w-1/2" />
        </CardContent>
      </Card>
    );
  }

  const community = sentimentResults?.community ?? { support: 0, oppose: 0, unsure: 0, total: 0 };
  const delegators = ownDRepId ? (sentimentResults?.delegators ?? null) : null;
  const stakeWeighted = ownDRepId ? (sentimentResults?.stakeWeighted ?? null) : null;
  const flags = concernResults?.flags ?? {};
  const totalFlags = concernResults?.total ?? 0;

  const hasSentiment = community.total > 0;
  const hasConcerns = totalFlags > 0;

  if (!hasSentiment && !hasConcerns) {
    return (
      <Card className="bg-muted/30">
        <CardContent className="py-4">
          <p className="text-sm text-muted-foreground text-center flex items-center justify-center gap-2">
            <Users className="h-4 w-4" />
            No citizen feedback yet
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-muted/30">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm flex items-center gap-2">
          <BarChart3 className="h-4 w-4 text-primary" />
          What Citizens Think
          {hasSentiment && (
            <span className="text-xs font-normal text-muted-foreground ml-auto">
              {community.total} citizen{community.total !== 1 ? 's' : ''} responded
            </span>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* DRep delegator sentiment */}
        {delegators && delegators.total > 0 && (
          <div className="rounded-lg bg-primary/5 border border-primary/10 p-3 space-y-2">
            <p className="text-xs font-semibold text-primary">Your Delegators</p>
            <SentimentBar
              label="Support"
              count={delegators.support}
              total={delegators.total}
              color="bg-green-500"
            />
            <SentimentBar
              label="Oppose"
              count={delegators.oppose}
              total={delegators.total}
              color="bg-red-500"
            />
            <SentimentBar
              label="Unsure"
              count={delegators.unsure}
              total={delegators.total}
              color="bg-amber-500"
            />
            <p className="text-xs text-muted-foreground">
              {delegators.total} delegator{delegators.total !== 1 ? 's' : ''} voted
              {stakeWeighted && stakeWeighted.total > 0 && (
                <span>
                  {' '}
                  &middot; stake-weighted:{' '}
                  {Math.round((stakeWeighted.support / stakeWeighted.total) * 100)}% support
                </span>
              )}
            </p>
          </div>
        )}

        {/* Community sentiment */}
        {hasSentiment && (
          <div className="space-y-2">
            {delegators && delegators.total > 0 && (
              <p className="text-xs font-semibold text-muted-foreground">All Citizens</p>
            )}
            <SentimentBar
              label="Support"
              count={community.support}
              total={community.total}
              color="bg-green-500"
            />
            <SentimentBar
              label="Oppose"
              count={community.oppose}
              total={community.total}
              color="bg-red-500"
            />
            <SentimentBar
              label="Unsure"
              count={community.unsure}
              total={community.total}
              color="bg-amber-500"
            />
          </div>
        )}

        {/* Top concerns */}
        {hasConcerns && (
          <div className="pt-2 border-t border-border/50 space-y-2">
            <p className="text-xs font-semibold text-muted-foreground">Top Concerns</p>
            <div className="flex flex-wrap gap-1.5">
              {(Object.entries(flags) as [ConcernFlagType, number][])
                .filter(([, count]) => count > 0)
                .sort(([, a], [, b]) => b - a)
                .slice(0, 5)
                .map(([flagType, count]) => {
                  const label = CONCERN_FLAG_LABELS[flagType];
                  if (!label) return null;
                  return (
                    <span
                      key={flagType}
                      className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-[10px] bg-muted/50 border border-border/50 text-muted-foreground"
                    >
                      <span>{label.emoji}</span>
                      <span>{label.label}</span>
                      <span className="tabular-nums opacity-70">{count}</span>
                    </span>
                  );
                })}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function SentimentBar({
  label,
  count,
  total,
  color,
}: {
  label: string;
  count: number;
  total: number;
  color: string;
}) {
  const percent = total > 0 ? Math.round((count / total) * 100) : 0;
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-xs">
        <span>{label}</span>
        <span className="tabular-nums text-muted-foreground">
          {count} ({percent}%)
        </span>
      </div>
      <div className="h-1.5 rounded-full bg-muted overflow-hidden">
        <div
          className={`h-full rounded-full ${color} transition-all duration-700 ease-out`}
          style={{ width: `${percent}%` }}
        />
      </div>
    </div>
  );
}
