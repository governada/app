'use client';

import { TrendingUp, TrendingDown, Minus, Trophy } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { CockpitData } from '@/hooks/queries';

const TIER_ACCENT: Record<string, string> = {
  Emerging: 'text-zinc-400',
  Bronze: 'text-amber-700 dark:text-amber-500',
  Silver: 'text-zinc-400 dark:text-zinc-300',
  Gold: 'text-yellow-500 dark:text-yellow-400',
  Diamond: 'text-cyan-400 dark:text-cyan-300',
  Legendary: 'text-purple-400 dark:text-purple-300',
};

const TIER_BG: Record<string, string> = {
  Emerging: 'bg-zinc-500/10',
  Bronze: 'bg-amber-500/10',
  Silver: 'bg-zinc-400/10',
  Gold: 'bg-yellow-500/10',
  Diamond: 'bg-cyan-400/10',
  Legendary: 'bg-purple-400/10',
};

interface CockpitScoreHeroProps {
  score: CockpitData['score'];
}

export function CockpitScoreHero({ score }: CockpitScoreHeroProps) {
  const trend = score.trend;
  const TrendIcon = trend > 0 ? TrendingUp : trend < 0 ? TrendingDown : Minus;
  const trendColor =
    trend > 0 ? 'text-emerald-500' : trend < 0 ? 'text-rose-500' : 'text-muted-foreground';

  const pillars = [
    { key: 'engagementQuality', label: 'Engagement', value: score.pillars.engagementQuality },
    {
      key: 'effectiveParticipation',
      label: 'Participation',
      value: score.pillars.effectiveParticipation,
    },
    { key: 'reliability', label: 'Reliability', value: score.pillars.reliability },
    { key: 'governanceIdentity', label: 'Identity', value: score.pillars.governanceIdentity },
  ];

  return (
    <div className="rounded-2xl border border-border bg-card p-5 space-y-4">
      {/* Score + Tier + Trend */}
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span
              className={cn(
                'inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold',
                TIER_BG[score.tier] ?? 'bg-muted',
                TIER_ACCENT[score.tier] ?? 'text-foreground',
              )}
            >
              <Trophy className="h-3 w-3" />
              {score.tier}
            </span>
            {score.rank && (
              <span className="text-xs text-muted-foreground tabular-nums">
                #{score.rank} of {score.totalDReps}
              </span>
            )}
          </div>
          <p className="text-sm text-muted-foreground">{score.narrative}</p>
        </div>

        <div className="text-right">
          <span className="text-4xl font-bold tabular-nums text-foreground">{score.current}</span>
          <div className={cn('flex items-center justify-end gap-1 text-xs', trendColor)}>
            <TrendIcon className="h-3 w-3" />
            <span className="tabular-nums">
              {trend > 0 ? '+' : ''}
              {trend} pts
            </span>
          </div>
        </div>
      </div>

      {/* 4-Pillar Mini Bars */}
      <div className="grid grid-cols-4 gap-2">
        {pillars.map((p) => (
          <div key={p.key} className="space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-[10px] text-muted-foreground truncate">{p.label}</span>
              <span className="text-[10px] font-medium tabular-nums text-foreground">
                {p.value}
              </span>
            </div>
            <div className="h-1.5 rounded-full bg-muted overflow-hidden">
              <div
                className={cn(
                  'h-full rounded-full transition-all duration-500',
                  p.value >= 70 ? 'bg-emerald-500' : p.value >= 40 ? 'bg-amber-500' : 'bg-rose-500',
                )}
                style={{ width: `${Math.min(100, p.value)}%` }}
              />
            </div>
          </div>
        ))}
      </div>

      {/* Tier Progress */}
      {score.tierProgress.nextTier && (
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <div className="flex-1 h-1 rounded-full bg-muted overflow-hidden">
            <div
              className="h-full rounded-full bg-primary/60"
              style={{ width: `${score.tierProgress.percentWithinTier}%` }}
            />
          </div>
          <span className="tabular-nums whitespace-nowrap">
            {score.tierProgress.pointsToNext} pts to {score.tierProgress.nextTier}
          </span>
        </div>
      )}
    </div>
  );
}
