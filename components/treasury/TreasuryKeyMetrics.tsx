'use client';

import { cn } from '@/lib/utils';
import { formatAda } from '@/lib/treasury';
import type { NclUtilization } from '@/lib/treasury';

interface TreasuryKeyMetricsProps {
  ncl: NclUtilization | null;
  pendingCount: number;
  effectivenessRate: number | null;
}

function MetricCard({
  label,
  value,
  subtext,
  className,
}: {
  label: string;
  value: string;
  subtext?: string;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'rounded-xl border border-border/50 bg-card/70 backdrop-blur-md p-4',
        className,
      )}
    >
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-xl font-semibold mt-0.5">{value}</p>
      {subtext && <p className="text-xs text-muted-foreground mt-0.5">{subtext}</p>}
    </div>
  );
}

export function TreasuryKeyMetrics({
  ncl,
  pendingCount,
  effectivenessRate,
}: TreasuryKeyMetricsProps) {
  const nclValue = ncl ? `${Math.round(ncl.utilizationPct)}%` : '—';
  const nclSubtext = ncl ? `₳${formatAda(ncl.remainingAda)} remaining` : 'No active NCL period';

  return (
    <div className="grid grid-cols-3 gap-3">
      <MetricCard label="Budget Used" value={nclValue} subtext={nclSubtext} />
      <MetricCard
        label="Awaiting Votes"
        value={String(pendingCount)}
        subtext={pendingCount === 0 ? 'None active' : 'proposals pending'}
      />
      <MetricCard
        label="Money Well Spent"
        value={effectivenessRate !== null ? `${effectivenessRate}%` : '—'}
        subtext={effectivenessRate !== null ? 'of funded projects delivered' : 'Awaiting data'}
      />
    </div>
  );
}
