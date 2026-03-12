'use client';

import { useEffect } from 'react';
import { posthog } from '@/lib/posthog';
import { generateTreasuryNarrative, formatAda } from '@/lib/treasury';
import type { NclUtilization, TreasuryNarrativeData } from '@/lib/treasury';
import { useSegment } from '@/components/providers/SegmentProvider';

interface TreasuryNarrativeHeroProps {
  balanceAda: number;
  trend: 'growing' | 'shrinking' | 'stable';
  effectivenessRate: number | null;
  pendingCount: number;
  pendingTotalAda: number;
  runwayMonths: number;
  ncl: NclUtilization | null;
  /** Citizen's proportional share (ADA), if available */
  proportionalShareAda?: number | null;
}

export function TreasuryNarrativeHero({
  balanceAda,
  trend,
  effectivenessRate,
  pendingCount,
  pendingTotalAda,
  runwayMonths,
  ncl,
  proportionalShareAda,
}: TreasuryNarrativeHeroProps) {
  const { segment } = useSegment();

  const narrativeData: TreasuryNarrativeData = {
    balanceAda,
    trend,
    effectivenessRate,
    pendingCount,
    pendingTotalAda,
    runwayMonths,
    ncl,
  };

  const narrative = generateTreasuryNarrative(narrativeData);

  useEffect(() => {
    posthog.capture('treasury_narrative_viewed', {
      ncl_available: !!ncl,
      ncl_status: ncl?.status ?? null,
      ncl_utilization_pct: ncl?.utilizationPct ?? null,
    });
  }, [ncl]);

  return (
    <div className="rounded-xl border border-border/50 bg-card/70 backdrop-blur-md p-5">
      <p className="text-sm sm:text-base leading-relaxed text-foreground/90">{narrative}</p>

      {/* Citizen proportional share */}
      {segment === 'citizen' && proportionalShareAda != null && proportionalShareAda > 0 && (
        <p className="mt-2 text-xs text-muted-foreground">
          Your proportional share: ₳{formatAda(proportionalShareAda)}
        </p>
      )}

      {/* DRep contextual note */}
      {segment === 'drep' && ncl && pendingCount > 0 && (
        <p className="mt-2 text-xs text-muted-foreground">
          Your votes on pending proposals directly affect NCL utilization. See the pending proposals
          section below for per-proposal impact.
        </p>
      )}
    </div>
  );
}
