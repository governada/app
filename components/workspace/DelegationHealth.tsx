'use client';

import { Users, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { CockpitData } from '@/hooks/queries';

function formatAda(ada: number): string {
  if (ada >= 1_000_000) return `${(ada / 1_000_000).toFixed(1)}M`;
  if (ada >= 1_000) return `${(ada / 1_000).toFixed(0)}K`;
  return ada.toLocaleString();
}

export function DelegationHealth({ delegation }: { delegation: CockpitData['delegation'] }) {
  const { currentDelegators, delegatorDelta, snapshots } = delegation;

  const DeltaIcon = delegatorDelta > 0 ? TrendingUp : delegatorDelta < 0 ? TrendingDown : Minus;
  const deltaColor =
    delegatorDelta > 0
      ? 'text-emerald-500'
      : delegatorDelta < 0
        ? 'text-rose-500'
        : 'text-muted-foreground';

  // Latest voting power
  const latestSnapshot = snapshots.length > 0 ? snapshots[snapshots.length - 1] : null;
  const votingPowerAda = latestSnapshot?.votingPowerAda ?? 0;

  // Sparkline: normalize to 0-100 for mini chart
  const sparkData = snapshots.slice(-12);
  const maxPower = Math.max(...sparkData.map((s) => s.votingPowerAda), 1);
  const minPower = Math.min(...sparkData.map((s) => s.votingPowerAda));
  const range = maxPower - minPower || 1;

  return (
    <div className="rounded-2xl border border-border bg-card p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
          <Users className="h-4 w-4 text-muted-foreground" />
          Delegation
        </h3>
        <div className={cn('flex items-center gap-1 text-xs', deltaColor)}>
          <DeltaIcon className="h-3 w-3" />
          <span className="tabular-nums">
            {delegatorDelta > 0 ? '+' : ''}
            {delegatorDelta}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-xl bg-muted/50 p-3 text-center">
          <p className="text-xl font-bold tabular-nums text-foreground">
            {currentDelegators ?? '—'}
          </p>
          <p className="text-[10px] text-muted-foreground mt-0.5">Delegators</p>
        </div>
        <div className="rounded-xl bg-muted/50 p-3 text-center">
          <p className="text-xl font-bold tabular-nums text-foreground">
            {formatAda(votingPowerAda)}
          </p>
          <p className="text-[10px] text-muted-foreground mt-0.5">Voting Power (₳)</p>
        </div>
      </div>

      {/* Mini sparkline */}
      {sparkData.length >= 3 && (
        <div className="h-10 flex items-end gap-px">
          {sparkData.map((s) => {
            const height = ((s.votingPowerAda - minPower) / range) * 100;
            return (
              <div
                key={s.epoch}
                className="flex-1 rounded-t-sm bg-primary/30 min-h-[2px]"
                style={{ height: `${Math.max(5, height)}%` }}
                title={`Epoch ${s.epoch}: ${formatAda(s.votingPowerAda)} ₳`}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}
