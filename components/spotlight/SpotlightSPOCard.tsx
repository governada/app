'use client';

import { motion, useReducedMotion } from 'framer-motion';
import { Users, Coins, TrendingUp, TrendingDown, Star, Vote } from 'lucide-react';
import { cn } from '@/lib/utils';
import { fadeIn } from '@/lib/animations';
import { AnimatedScore } from './AnimatedScore';
import { AnimatedAlignmentRing } from './AnimatedAlignmentRing';
import { TierStamp } from './TierStamp';
import type { GovernadaSPOData } from '@/components/governada/cards/GovernadaSPOCard';
import { getPoolStrengths } from '@/components/governada/cards/GovernadaSPOCard';
import {
  extractAlignments,
  getDominantDimension,
  getIdentityColor,
  getIdentityGradient,
  getDimensionLabel,
  getPersonalityLabel,
} from '@/lib/drepIdentity';
import { TIER_SCORE_COLOR, tierKey } from '@/components/governada/cards/tierStyles';
import { computeTier } from '@/lib/scoring/tiers';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatAda(ada: number): string {
  if (ada >= 1_000_000_000) return `${(ada / 1_000_000_000).toFixed(1)}B`;
  if (ada >= 1_000_000) return `${(ada / 1_000_000).toFixed(1)}M`;
  if (ada >= 1_000) return `${Math.round(ada / 1_000)}K`;
  return String(ada);
}

// ─── Component ────────────────────────────────────────────────────────────────

interface SpotlightSPOCardProps {
  pool: GovernadaSPOData;
  isTracked: boolean;
  narrative?: string | null;
}

export function SpotlightSPOCard({ pool, isTracked, narrative }: SpotlightSPOCardProps) {
  const reducedMotion = useReducedMotion();
  const immediate = !!reducedMotion;

  const alignments = extractAlignments({
    alignmentTreasuryConservative: pool.alignmentTreasuryConservative ?? null,
    alignmentTreasuryGrowth: pool.alignmentTreasuryGrowth ?? null,
    alignmentDecentralization: pool.alignmentDecentralization ?? null,
    alignmentSecurity: pool.alignmentSecurity ?? null,
    alignmentInnovation: pool.alignmentInnovation ?? null,
    alignmentTransparency: pool.alignmentTransparency ?? null,
  });
  const dominant = getDominantDimension(alignments);
  const identityColor = getIdentityColor(dominant);
  const score = pool.governanceScore ?? 0;
  const tier = tierKey(computeTier(score));
  const strengths = getPoolStrengths(pool);
  const momentum = pool.scoreMomentum ?? 0;
  const archetype = getPersonalityLabel(alignments);

  const displayNarrative = narrative ?? buildTemplateNarrative(pool, strengths);

  return (
    <div
      className="relative overflow-hidden rounded-2xl border border-border/40 bg-card/70 backdrop-blur-md"
      style={{ background: getIdentityGradient(dominant) }}
    >
      {isTracked && (
        <div className="absolute right-4 top-4 z-10">
          <Star className="h-5 w-5 fill-amber-400 text-amber-400" />
        </div>
      )}

      <div
        className="h-1 w-full"
        style={{ background: `linear-gradient(90deg, ${identityColor.hex}, transparent)` }}
      />

      <div className="flex flex-col gap-6 p-6 sm:p-8">
        {/* Header */}
        <div className="flex items-start gap-5">
          <div className="flex flex-col items-center gap-1">
            <div className="relative">
              <AnimatedAlignmentRing
                alignments={alignments}
                size={100}
                delay={500}
                immediate={immediate}
              />
              <div className="absolute inset-0 flex items-center justify-center">
                <span className={cn('text-2xl font-bold tabular-nums', TIER_SCORE_COLOR[tier])}>
                  <AnimatedScore value={score} immediate={immediate} />
                </span>
              </div>
            </div>
          </div>

          <div className="flex min-w-0 flex-1 flex-col gap-2">
            <div className="flex items-center gap-3">
              <h2 className="truncate text-xl font-semibold sm:text-2xl">
                {pool.ticker ?? pool.poolName ?? pool.poolId.slice(0, 16)}
              </h2>
              <TierStamp score={score} delay={0.35} immediate={immediate} />
            </div>

            {pool.poolName && pool.ticker && (
              <p className="truncate text-sm text-muted-foreground">{pool.poolName}</p>
            )}

            <div className="flex items-center gap-2">
              <span
                className="rounded-full px-2.5 py-0.5 text-xs font-medium"
                style={{
                  color: identityColor.hex,
                  backgroundColor: `rgba(${identityColor.rgb.join(',')}, 0.1)`,
                  border: `1px solid rgba(${identityColor.rgb.join(',')}, 0.2)`,
                }}
              >
                {archetype}
              </span>
              <span className="text-xs text-muted-foreground">{getDimensionLabel(dominant)}</span>
            </div>

            {strengths.length > 0 && (
              <div className="flex gap-1.5">
                {strengths.map((s) => (
                  <span
                    key={s}
                    className="rounded-md bg-emerald-500/10 px-2 py-0.5 text-xs font-medium text-emerald-400"
                  >
                    {s}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Governance Statement Preview */}
        {pool.governanceStatement && (
          <motion.div
            className="rounded-lg border border-border/20 bg-white/[0.02] px-4 py-3"
            variants={immediate ? undefined : fadeIn}
            initial={immediate ? undefined : 'hidden'}
            animate="visible"
            transition={immediate ? undefined : { delay: 0.6 }}
          >
            <p className="line-clamp-2 text-sm italic text-muted-foreground">
              &ldquo;{pool.governanceStatement}&rdquo;
            </p>
          </motion.div>
        )}

        {/* Narrative */}
        <motion.p
          className="text-sm leading-relaxed text-muted-foreground"
          variants={immediate ? undefined : fadeIn}
          initial={immediate ? undefined : 'hidden'}
          animate="visible"
          transition={immediate ? undefined : { delay: 0.8 }}
        >
          {displayNarrative}
        </motion.p>

        {/* Stats */}
        <div className="flex flex-wrap items-center gap-4 border-t border-border/20 pt-4 text-xs text-muted-foreground">
          <div className="flex items-center gap-1.5">
            <Vote className="h-3.5 w-3.5" />
            <span className="tabular-nums">{pool.voteCount}</span>
            <span>votes</span>
          </div>
          <div className="flex items-center gap-1.5">
            <Users className="h-3.5 w-3.5" />
            <span className="tabular-nums">{pool.delegatorCount.toLocaleString()}</span>
            <span>delegators</span>
          </div>
          <div className="flex items-center gap-1.5">
            <Coins className="h-3.5 w-3.5" />
            <span className="tabular-nums">{formatAda(pool.liveStakeAda)}</span>
            <span>ADA</span>
          </div>
          {pool.participationPct != null && (
            <div className="flex items-center gap-1.5">
              <span className="tabular-nums">{Math.round(pool.participationPct)}%</span>
              <span>participation</span>
            </div>
          )}
          {momentum !== 0 && (
            <div className="flex items-center gap-1">
              {momentum > 0 ? (
                <TrendingUp className="h-3.5 w-3.5 text-emerald-400" />
              ) : (
                <TrendingDown className="h-3.5 w-3.5 text-red-400" />
              )}
              <span
                className={cn('tabular-nums', momentum > 0 ? 'text-emerald-400' : 'text-red-400')}
              >
                {momentum > 0 ? '+' : ''}
                {momentum.toFixed(1)}
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function buildTemplateNarrative(pool: GovernadaSPOData, strengths: string[]): string {
  const parts: string[] = [];

  const participation = pool.participationPct ?? 0;
  if (participation >= 90) {
    parts.push(`Votes on ${Math.round(participation)}% of governance proposals.`);
  } else if (participation >= 60) {
    parts.push(`Active governance participant with ${Math.round(participation)}% vote rate.`);
  } else {
    parts.push(`Participates in ${Math.round(participation)}% of governance votes.`);
  }

  if (strengths.length > 0) {
    parts.push(`Strengths: ${strengths.join(' and ').toLowerCase()}.`);
  }

  if (pool.liveStakeAda >= 50_000_000) {
    parts.push('Large pool with significant delegator trust.');
  }

  return parts.join(' ');
}
