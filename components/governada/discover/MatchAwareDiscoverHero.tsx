'use client';

import { useMemo } from 'react';
import Link from 'next/link';
import { ChevronRight, Sparkles, Users } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Skeleton } from '@/components/ui/skeleton';
import { computeTier } from '@/lib/scoring/tiers';
import { TIER_SCORE_COLOR, tierKey } from '@/components/governada/cards/tierStyles';
import { loadMatchProfile, alignmentDistance, distanceToMatchScore } from '@/lib/matchStore';
import type { AlignmentScores } from '@/lib/drepIdentity';

/* ── Types ──────────────────────────────────────────────────────────── */

interface DiscoverEntity {
  id: string;
  name: string;
  score: number;
  participationPct: number | null;
  alignmentTreasuryConservative?: number | null;
  alignmentTreasuryGrowth?: number | null;
  alignmentDecentralization?: number | null;
  alignmentSecurity?: number | null;
  alignmentInnovation?: number | null;
  alignmentTransparency?: number | null;
}

interface MatchAwareDiscoverHeroProps {
  entityType: 'drep' | 'spo';
  entities: DiscoverEntity[];
  isLoading: boolean;
  /** Total registered count (may differ from entities.length if filtered) */
  totalCount?: number;
}

/* ── Helpers ─────────────────────────────────────────────────────────── */

function getEntityAlignment(entity: DiscoverEntity): AlignmentScores {
  return {
    treasuryConservative: entity.alignmentTreasuryConservative ?? 50,
    treasuryGrowth: entity.alignmentTreasuryGrowth ?? 50,
    decentralization: entity.alignmentDecentralization ?? 50,
    security: entity.alignmentSecurity ?? 50,
    innovation: entity.alignmentInnovation ?? 50,
    transparency: entity.alignmentTransparency ?? 50,
  };
}

const LABELS = {
  drep: {
    singular: 'representative',
    plural: 'representatives',
    heading: 'Representatives',
    findCta: 'Find your representative',
    matchCta: 'Take the 60-second match quiz',
    retakeCta: 'Retake the match quiz',
    browseHref: '/governance/representatives',
    matchHref: '/match',
  },
  spo: {
    singular: 'pool',
    plural: 'pools',
    heading: 'Stake Pools',
    findCta: 'Find a governance-active pool',
    matchCta: 'Take the 60-second match quiz',
    retakeCta: 'Retake the match quiz',
    browseHref: '/governance/pools',
    matchHref: '/match',
  },
} as const;

/* ── Compact entity row ──────────────────────────────────────────────── */

function EntityRow({
  entity,
  entityType,
  matchScore,
  rank,
}: {
  entity: DiscoverEntity;
  entityType: 'drep' | 'spo';
  matchScore?: number;
  rank: number;
}) {
  const score = entity.score;
  const tier = tierKey(computeTier(score));
  const href = entityType === 'drep' ? `/drep/${entity.id}` : `/pool/${entity.id}`;

  return (
    <Link
      href={href}
      className="group flex items-center gap-3 px-4 py-3 rounded-lg hover:bg-muted/30 transition-colors"
    >
      <span className="text-xs text-muted-foreground/50 font-mono tabular-nums w-5 text-center shrink-0">
        {rank}
      </span>
      <div className="flex-1 min-w-0">
        <span className="text-sm font-medium truncate block group-hover:text-primary transition-colors">
          {entity.name}
        </span>
      </div>
      {matchScore != null && (
        <span
          className={cn(
            'text-[10px] font-bold tabular-nums px-1.5 py-0.5 rounded-full shrink-0',
            matchScore >= 70
              ? 'bg-emerald-500/10 text-emerald-400'
              : matchScore >= 50
                ? 'bg-amber-500/10 text-amber-400'
                : 'bg-muted text-muted-foreground',
          )}
        >
          {matchScore}% match
        </span>
      )}
      <span className={cn('text-sm font-bold tabular-nums shrink-0', TIER_SCORE_COLOR[tier])}>
        {score}
      </span>
      <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/30 shrink-0" />
    </Link>
  );
}

/* ── Main component ──────────────────────────────────────────────────── */

export function MatchAwareDiscoverHero({
  entityType,
  entities,
  isLoading,
  totalCount,
}: MatchAwareDiscoverHeroProps) {
  const labels = LABELS[entityType];
  const count = totalCount ?? entities.length;

  // Check for match profile in localStorage
  const matchProfile = useMemo(() => {
    try {
      return loadMatchProfile();
    } catch {
      return null;
    }
  }, []);

  // Compute match scores and sort
  const rankedEntities = useMemo(() => {
    if (!matchProfile) {
      // No match profile — sort by governance score, show top 5
      return entities
        .slice()
        .sort((a, b) => b.score - a.score)
        .slice(0, 5)
        .map((e) => ({ entity: e, matchScore: undefined as number | undefined }));
    }

    // Has match profile — compute match scores and sort by blended score
    const userAlign = matchProfile.userAlignments;
    return entities
      .map((e) => {
        const entityAlign = getEntityAlignment(e);
        const distance = alignmentDistance(userAlign, entityAlign);
        const matchScore = distanceToMatchScore(distance);
        const blended = (matchScore / 100) * 0.7 + (e.score / 100) * 0.3;
        return { entity: e, matchScore, blended };
      })
      .sort((a, b) => b.blended - a.blended)
      .slice(0, 5)
      .map(({ entity, matchScore }) => ({ entity, matchScore }));
  }, [entities, matchProfile]);

  // Stats
  const avgParticipation = useMemo(() => {
    const withPct = entities.filter((e) => e.participationPct != null);
    if (withPct.length === 0) return null;
    return Math.round(
      withPct.reduce((sum, e) => sum + (e.participationPct ?? 0), 0) / withPct.length,
    );
  }, [entities]);

  if (isLoading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-6 w-48" />
        <div className="rounded-xl border border-border/50 bg-card/70 backdrop-blur-md p-4 space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-12 rounded-lg" />
          ))}
        </div>
      </div>
    );
  }

  const hasMatches = matchProfile != null;

  return (
    <div className="space-y-3" data-discovery={`gov-${entityType}`}>
      <h1 className="text-xl font-bold tracking-tight">{labels.heading}</h1>

      {/* Stats bar */}
      <div className="flex items-center gap-4 text-sm text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <Users className="h-3.5 w-3.5" />
          <span className="font-semibold text-foreground">{count.toLocaleString()}</span>{' '}
          governance-active {labels.plural}
        </span>
        {avgParticipation != null && (
          <span>
            <span className="font-semibold text-foreground">{avgParticipation}%</span> avg
            participation
          </span>
        )}
      </div>

      {/* Ranked entities */}
      <div className="rounded-xl border border-border/50 bg-card/70 backdrop-blur-md overflow-hidden">
        {hasMatches && (
          <div className="flex items-center gap-2 px-4 py-2.5 border-b border-border/30 bg-primary/5">
            <Sparkles className="h-3.5 w-3.5 text-primary" />
            <span className="text-xs font-medium text-foreground">
              Your top matches based on governance alignment
            </span>
          </div>
        )}
        {!hasMatches && rankedEntities.length > 0 && (
          <div className="px-4 py-2.5 border-b border-border/30">
            <span className="text-xs font-medium text-muted-foreground">
              Top {labels.plural} by governance score
            </span>
          </div>
        )}
        <div className="divide-y divide-border/20">
          {rankedEntities.map(({ entity, matchScore }, i) => (
            <EntityRow
              key={entity.id}
              entity={entity}
              entityType={entityType}
              matchScore={matchScore}
              rank={i + 1}
            />
          ))}
        </div>
      </div>

      {/* CTA */}
      <Link
        href={labels.matchHref}
        className="group flex items-center justify-between rounded-lg border border-border/40 bg-primary/5 hover:bg-primary/10 px-4 py-2.5 transition-colors"
      >
        <span className="text-sm font-medium text-foreground">
          {hasMatches ? labels.retakeCta : labels.matchCta}
        </span>
        <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-foreground transition-colors" />
      </Link>
    </div>
  );
}
