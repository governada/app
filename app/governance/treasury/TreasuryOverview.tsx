'use client';

import { TreasuryHero } from '@/components/treasury/TreasuryHero';
import { NclUtilizationTrend } from '@/components/treasury/NclUtilizationTrend';
import { TreasuryTimeline } from '@/components/treasury/TreasuryTimeline';
import { TreasurySection } from '@/components/treasury/TreasurySection';
import { TreasuryPendingProposals } from '@/components/TreasuryPendingProposals';
import { TreasuryAccountabilitySection } from '@/components/TreasuryAccountabilitySection';
import { TreasuryPersonalImpact } from '@/components/treasury/TreasuryPersonalImpact';
import { CitizenDRepStance } from '@/components/treasury/CitizenDRepStance';
import { useDRepTreasuryRecord } from '@/hooks/useDRepTreasuryRecord';
import { useWallet } from '@/utils/wallet';
import dynamic from 'next/dynamic';

const TreasurySimulator = dynamic(
  () =>
    import('@/components/TreasurySimulator').then((m) => ({
      default: m.TreasurySimulator,
    })),
  {
    ssr: false,
    loading: () => <div className="h-64 animate-pulse bg-muted rounded-xl" />,
  },
);

const SpendingTreemap = dynamic(
  () =>
    import('@/components/treasury/SpendingTreemap').then((m) => ({
      default: m.SpendingTreemap,
    })),
  {
    ssr: false,
    loading: () => <div className="h-64 animate-pulse bg-muted rounded-xl" />,
  },
);

const YouDrawIt = dynamic(
  () =>
    import('@/components/treasury/YouDrawIt').then((m) => ({
      default: m.YouDrawIt,
    })),
  {
    ssr: false,
    loading: () => <div className="h-48 animate-pulse bg-muted rounded-xl" />,
  },
);

import { DRepTreasuryTrackRecord } from '@/components/treasury/DRepTreasuryTrackRecord';
import { SegmentGate } from '@/components/shared/SegmentGate';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { useTreasuryCurrent, useTreasuryNcl } from '@/hooks/queries';
import { useSegment } from '@/components/providers/SegmentProvider';
import { generateTreasuryNarrative } from '@/lib/treasury';
import type { NclUtilization } from '@/lib/treasury';
import { useQuery } from '@tanstack/react-query';
import { fetchJson } from '@/lib/api/client';

interface TreasuryCurrentData {
  balance: number;
  epoch: number;
  snapshotAt: string;
  runwayMonths: number;
  burnRatePerEpoch: number;
  trend: 'growing' | 'shrinking' | 'stable';
  healthScore: number | null;
  healthComponents: Record<string, number> | null;
  pendingCount: number;
  pendingTotalAda?: number;
}

/**
 * Treasury Story — Narrative Overview
 *
 * Section 1 — "The State of the Treasury": hero verdict + one-line narrative
 * Section 2 — "Where the Money Goes": NCL bar + spending treemap
 * Section 3 — "The Story So Far": event-annotated balance timeline
 * Section 4 — "What's Being Decided": pending proposals + stance cards
 * Section 5 — "Test Your Instincts": YouDrawIt interactive challenge
 * Section 6 — "Did It Work?": accountability section (promoted from accordion)
 * Section 7 — "Your Impact": personal treasury impact (segment-gated)
 * Deep Dive — Accordions: NCL utilization trend + simulator (power users)
 */
export function TreasuryOverview() {
  const { segment, drepId } = useSegment();
  const { delegatedDrepId, balanceAda: walletBalanceAda } = useWallet();
  const effectiveDrepId = segment === 'drep' ? drepId : delegatedDrepId;
  const { data: rawDrepRecord } = useDRepTreasuryRecord(effectiveDrepId);
  const drepVotes = rawDrepRecord?.record?.votes;

  const { data: rawCurrent } = useTreasuryCurrent();
  const treasury = rawCurrent as TreasuryCurrentData | undefined;

  const { data: rawNcl } = useTreasuryNcl();
  const ncl = (rawNcl as { ncl: NclUtilization | null } | undefined)?.ncl ?? null;

  const { data: rawEffectiveness } = useQuery({
    queryKey: ['treasury-effectiveness'],
    queryFn: () => fetchJson<{ effectivenessRate: number | null }>('/api/treasury/effectiveness'),
    staleTime: 5 * 60 * 1000,
  });

  const balance = treasury?.balance ?? 0;
  const burnRate = treasury?.burnRatePerEpoch ?? 0;
  const runway = treasury?.runwayMonths ?? 0;
  const epoch = treasury?.epoch ?? 0;
  const trend = treasury?.trend ?? 'stable';
  const pendingCount = treasury?.pendingCount ?? 0;
  const pendingTotalAda = treasury?.pendingTotalAda ?? 0;
  const effectivenessRate = rawEffectiveness?.effectivenessRate ?? null;

  const proportionalShare =
    walletBalanceAda && balance ? (walletBalanceAda / 37_000_000_000) * balance : undefined;

  const nclImpact = ncl
    ? {
        utilizationPct: ncl.utilizationPct,
        remainingAda: ncl.remainingAda,
        nclAda: ncl.period.nclAda,
      }
    : null;

  const narrative = treasury
    ? generateTreasuryNarrative({
        balanceAda: balance,
        trend,
        effectivenessRate,
        pendingCount,
        pendingTotalAda,
        runwayMonths: runway,
        ncl,
      })
    : null;

  return (
    <div className="space-y-8">
      {/* ──────────────────────────────────────────────────────────────
          SECTION 1 — "The State of the Treasury"
          Hero verdict + one-line narrative summary.
         ────────────────────────────────────────────────────────────── */}
      <TreasurySection title="The State of the Treasury">
        <TreasuryHero
          balanceAda={balance}
          trend={trend}
          ncl={ncl}
          effectivenessRate={effectivenessRate}
          pendingCount={pendingCount}
          pendingTotalAda={pendingTotalAda}
          runwayMonths={runway}
          proportionalShareAda={proportionalShare}
        />
        {narrative && <p className="text-sm text-muted-foreground leading-relaxed">{narrative}</p>}
      </TreasurySection>

      {/* ──────────────────────────────────────────────────────────────
          SECTION 2 — "Where the Money Goes"
          NCL budget context + spending treemap (built by another agent).
         ────────────────────────────────────────────────────────────── */}
      <TreasurySection
        title="Where the Money Goes"
        subtitle="How the treasury budget is being allocated this period"
      >
        <SpendingTreemap />
      </TreasurySection>

      {/* ──────────────────────────────────────────────────────────────
          SECTION 3 — "The Story So Far"
          Event-annotated balance timeline replacing plain epoch flow.
         ────────────────────────────────────────────────────────────── */}
      <TreasurySection
        title="The Story So Far"
        subtitle="Treasury balance over time, with key governance events marked"
      >
        <TreasuryTimeline />
      </TreasurySection>

      {/* ──────────────────────────────────────────────────────────────
          SECTION 4 — "What's Being Decided"
          Pending proposals + DRep/citizen stance cards.
         ────────────────────────────────────────────────────────────── */}
      <TreasurySection title="What's Being Decided">
        {/* DRep stance callout (for DReps: your track record as context) */}
        <SegmentGate show={['drep']}>
          {drepId && (
            <div className="mb-4">
              <DRepTreasuryTrackRecord drepId={drepId} />
            </div>
          )}
        </SegmentGate>

        {/* Citizen stance callout: how their delegated DRep votes on treasury */}
        <SegmentGate show={['citizen']}>
          <div className="mb-4">
            <CitizenDRepStance />
          </div>
        </SegmentGate>

        <TreasuryPendingProposals
          treasuryBalanceAda={balance}
          runwayMonths={runway}
          nclImpact={nclImpact}
          drepVotes={drepVotes}
        />
      </TreasurySection>

      {/* ──────────────────────────────────────────────────────────────
          SECTION 5 — "Test Your Instincts"
          YouDrawIt interactive challenge (built by another agent).
         ────────────────────────────────────────────────────────────── */}
      <TreasurySection
        title="Test Your Instincts"
        subtitle="Can you predict where the treasury is heading?"
      >
        <YouDrawIt />
      </TreasurySection>

      {/* ──────────────────────────────────────────────────────────────
          SECTION 6 — "Did It Work?"
          Accountability promoted from accordion into main flow.
         ────────────────────────────────────────────────────────────── */}
      <TreasurySection
        title="Did It Work?"
        subtitle={
          effectivenessRate !== null
            ? `${effectivenessRate}% of funded projects have delivered`
            : 'Tracking whether funded projects delivered on their promises'
        }
      >
        <TreasuryAccountabilitySection />
      </TreasurySection>

      {/* ──────────────────────────────────────────────────────────────
          SECTION 7 — "Your Impact"
          Personal treasury impact, gated to connected users.
         ────────────────────────────────────────────────────────────── */}
      <SegmentGate show={['drep', 'citizen']}>
        <TreasurySection title="Your Impact">
          <TreasuryPersonalImpact
            balanceAda={balance}
            nclRemainingAda={ncl?.remainingAda ?? null}
            nclAda={ncl?.period.nclAda ?? null}
            nclUtilizationPct={ncl?.utilizationPct ?? null}
          />
        </TreasurySection>
      </SegmentGate>

      {/* ──────────────────────────────────────────────────────────────
          DEEP DIVE — Power user analytical depth
          Reduced to NCL utilization trend + simulator.
         ────────────────────────────────────────────────────────────── */}
      <Accordion type="multiple" className="space-y-2">
        {ncl && (
          <AccordionItem
            value="ncl-trend"
            className="rounded-xl border border-border/50 bg-card/70 backdrop-blur-md px-5"
          >
            <AccordionTrigger className="text-sm font-semibold hover:no-underline">
              How has spending evolved?
              <span className="ml-2 text-xs font-normal text-muted-foreground">
                {Math.round(ncl.utilizationPct)}% used
              </span>
            </AccordionTrigger>
            <AccordionContent>
              <NclUtilizationTrend />
            </AccordionContent>
          </AccordionItem>
        )}

        <AccordionItem
          value="simulator"
          className="rounded-xl border border-border/50 bg-card/70 backdrop-blur-md px-5"
        >
          <AccordionTrigger className="text-sm font-semibold hover:no-underline">
            Model different futures
          </AccordionTrigger>
          <AccordionContent>
            <TreasurySimulator currentBalance={balance} burnRate={burnRate} currentEpoch={epoch} />
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    </div>
  );
}
