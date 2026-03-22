'use client';

import { motion, useReducedMotion } from 'framer-motion';
import { Users, Coins, TrendingUp, TrendingDown, Minus, Star } from 'lucide-react';
import { cn } from '@/lib/utils';
import { fadeIn, spring } from '@/lib/animations';
import { AnimatedScore } from './AnimatedScore';
import { AnimatedAlignmentRing } from './AnimatedAlignmentRing';
import { TierStamp } from './TierStamp';
import type { EnrichedDRep } from '@/lib/koios';
import {
  extractAlignments,
  getDominantDimension,
  getIdentityColor,
  getIdentityGradient,
  getCompoundArchetype,
  getDimensionLabel,
} from '@/lib/drepIdentity';
import { TIER_SCORE_COLOR, tierKey } from '@/components/governada/cards/tierStyles';
import { computeTier } from '@/lib/scoring/tiers';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getPillarStrengths(drep: EnrichedDRep): string[] {
  const pillars: [string, number][] = [
    ['Explains votes', drep.engagementQuality ?? 0],
    ['Active voter', drep.effectiveParticipationV3 ?? 0],
    ['Reliable', drep.reliabilityV3 ?? 0],
    ['Clear identity', drep.governanceIdentity ?? 0],
  ];
  return pillars
    .filter(([, v]) => v >= 65)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 2)
    .map(([label]) => label);
}

function formatAda(lovelace: string): string {
  const ada = parseInt(lovelace, 10) / 1_000_000;
  if (ada >= 1_000_000_000) return `${(ada / 1_000_000_000).toFixed(1)}B`;
  if (ada >= 1_000_000) return `${(ada / 1_000_000).toFixed(1)}M`;
  if (ada >= 1_000) return `${Math.round(ada / 1_000)}K`;
  return String(Math.round(ada));
}

// ─── Component ────────────────────────────────────────────────────────────────

interface SpotlightDRepCardProps {
  drep: EnrichedDRep;
  isTracked: boolean;
  /** AI-generated narrative (null = use template fallback) */
  narrative?: string | null;
}

export function SpotlightDRepCard({ drep, isTracked, narrative }: SpotlightDRepCardProps) {
  const reducedMotion = useReducedMotion();
  const immediate = !!reducedMotion;

  const alignments = extractAlignments(drep);
  const dominant = getDominantDimension(alignments);
  const identityColor = getIdentityColor(dominant);
  const archetype = getCompoundArchetype(alignments);
  const strengths = getPillarStrengths(drep);
  const tier = tierKey(computeTier(drep.drepScore));
  const momentum = drep.scoreMomentum ?? 0;

  // Template fallback narrative
  const displayNarrative = narrative ?? buildTemplateNarrative(drep, archetype, strengths);

  return (
    <div
      className="relative overflow-hidden rounded-2xl border border-border/40 bg-card/70 backdrop-blur-md"
      style={{ background: getIdentityGradient(dominant) }}
    >
      {/* Tracked indicator */}
      {isTracked && (
        <div className="absolute right-4 top-4 z-10">
          <Star className="h-5 w-5 fill-amber-400 text-amber-400" />
        </div>
      )}

      {/* Identity accent bar */}
      <div
        className="h-1 w-full"
        style={{ background: `linear-gradient(90deg, ${identityColor.hex}, transparent)` }}
      />

      <div className="flex flex-col gap-6 p-6 sm:p-8">
        {/* Header: Score + Name + Tier */}
        <div className="flex items-start gap-5">
          {/* Score circle */}
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
                  <AnimatedScore value={drep.drepScore} immediate={immediate} />
                </span>
              </div>
            </div>
          </div>

          {/* Name + archetype */}
          <div className="flex min-w-0 flex-1 flex-col gap-2">
            <div className="flex items-center gap-3">
              <h2 className="truncate text-xl font-semibold sm:text-2xl">
                {drep.name || drep.ticker || drep.drepId.slice(0, 16)}
              </h2>
              <TierStamp score={drep.drepScore} delay={0.35} immediate={immediate} />
            </div>

            {/* Personality archetype */}
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

            {/* Strengths */}
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

        {/* AI Narrative */}
        <motion.p
          className="text-sm leading-relaxed text-muted-foreground"
          variants={immediate ? undefined : fadeIn}
          initial={immediate ? undefined : 'hidden'}
          animate="visible"
          transition={immediate ? undefined : { delay: 0.8 }}
        >
          {displayNarrative}
        </motion.p>

        {/* Stats row */}
        <div className="flex flex-wrap items-center gap-4 border-t border-border/20 pt-4 text-xs text-muted-foreground">
          <div className="flex items-center gap-1.5">
            <Users className="h-3.5 w-3.5" />
            <span className="tabular-nums">{drep.delegatorCount.toLocaleString()}</span>
            <span>delegators</span>
          </div>
          <div className="flex items-center gap-1.5">
            <Coins className="h-3.5 w-3.5" />
            <span className="tabular-nums">{formatAda(drep.votingPowerLovelace)}</span>
            <span>ADA</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="tabular-nums">{drep.totalVotes}</span>
            <span>votes</span>
          </div>
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

// ─── Template Narrative (Zero API Cost Fallback) ──────────────────────────────

function buildTemplateNarrative(
  drep: EnrichedDRep,
  archetype: string,
  strengths: string[],
): string {
  const parts: string[] = [];

  // Participation sentence
  const partRate = drep.participationRate ?? 0;
  if (partRate >= 90) {
    parts.push(`Votes on ${Math.round(partRate)}% of proposals.`);
  } else if (partRate >= 70) {
    parts.push(`Active voter with ${Math.round(partRate)}% participation.`);
  } else if (partRate >= 40) {
    parts.push(`Participates in ${Math.round(partRate)}% of governance votes.`);
  } else {
    parts.push(`Selective voter — participates in ${Math.round(partRate)}% of proposals.`);
  }

  // Strength sentence
  if (strengths.length > 0) {
    parts.push(`Known for: ${strengths.join(' and ').toLowerCase()}.`);
  }

  // Momentum sentence
  const momentum = drep.scoreMomentum ?? 0;
  if (momentum > 0.5) {
    parts.push('Score trending upward.');
  } else if (momentum < -0.5) {
    parts.push('Score trending downward recently.');
  }

  return parts.join(' ');
}
