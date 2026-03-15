'use client';

import { TrendingUp, CheckCircle2, XCircle, Info, Clock } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { useDepthConfig } from '@/hooks/useDepthConfig';
import { cn } from '@/lib/utils';
import type { VoteProjection, ProjectedOutcome } from '@/lib/voteProjection';

interface VoteProgressProps {
  projection: VoteProjection;
  isOpen: boolean;
}

// ---------------------------------------------------------------------------
// Verdict styling — green when trending pass, red when trending fail
// ---------------------------------------------------------------------------

function getVerdictStyle(outcome: ProjectedOutcome) {
  switch (outcome) {
    case 'passing':
      return {
        icon: CheckCircle2,
        color: 'text-emerald-400',
        bgColor: 'bg-emerald-500/8 border-emerald-500/20',
        barColor: 'bg-emerald-500',
        ghostColor: 'bg-emerald-500/20',
      };
    case 'likely_pass':
    case 'leaning_pass':
      return {
        icon: TrendingUp,
        color: 'text-emerald-400',
        bgColor: 'bg-emerald-500/8 border-emerald-500/20',
        barColor: 'bg-emerald-500',
        ghostColor: 'bg-emerald-500/20',
      };
    case 'too_close':
      return {
        icon: Clock,
        color: 'text-emerald-400',
        bgColor: 'bg-emerald-500/8 border-emerald-500/20',
        barColor: 'bg-emerald-500',
        ghostColor: 'bg-emerald-500/15',
      };
    case 'leaning_fail':
    case 'unlikely_pass':
      return {
        icon: XCircle,
        color: 'text-red-400',
        bgColor: 'bg-red-500/8 border-red-500/20',
        barColor: 'bg-emerald-500',
        ghostColor: 'bg-red-500/15',
      };
    case 'no_threshold':
      return {
        icon: Info,
        color: 'text-blue-400',
        bgColor: 'bg-blue-500/8 border-blue-500/20',
        barColor: 'bg-blue-500',
        ghostColor: 'bg-blue-500/20',
      };
  }
}

// ---------------------------------------------------------------------------
// Compute a projected yes% for the bar even when trajectory returns null.
// Uses historical pass rate as a proxy: if 87% of treasury proposals pass,
// project that the bar will reach ~87% of the threshold.
// ---------------------------------------------------------------------------

function getEffectiveProjection(projection: VoteProjection): number {
  // If we have a real trajectory projection, use it
  if (
    projection.projectedFinalYesPct != null &&
    projection.projectedFinalYesPct > projection.currentYesPct
  ) {
    return projection.projectedFinalYesPct;
  }

  // Fallback: use historical pass rate to estimate where similar proposals end up
  if (projection.historicalPassRate != null && projection.thresholdPct != null) {
    // If 87% of similar proposals pass, project that this one reaches the threshold * 0.87
    // Blend with current position: don't project below where we already are
    const historicalTarget = projection.thresholdPct * (0.5 + projection.historicalPassRate * 0.7);
    return Math.max(projection.currentYesPct + 1, Math.min(100, historicalTarget));
  }

  return projection.currentYesPct;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function VoteProgress({ projection, isOpen }: VoteProgressProps) {
  const { proposalSections } = useDepthConfig<'governance'>('governance');
  const depth = getDepthLevel(proposalSections);
  const style = getVerdictStyle(projection.projectedOutcome);
  const Icon = style.icon;

  // For closed proposals, show final result
  if (!isOpen) {
    return (
      <div className={cn('rounded-xl border px-5 py-3.5 flex items-center gap-3', style.bgColor)}>
        <Icon className={cn('h-5 w-5 shrink-0', style.color)} />
        <div className="min-w-0">
          <span className={cn('text-sm font-semibold', style.color)}>
            {projection.isPassing ? 'Passed' : 'Did not pass'}
          </span>
          {depth >= 1 && (
            <span className="text-sm text-muted-foreground ml-2">{projection.verdictDetail}</span>
          )}
        </div>
      </div>
    );
  }

  // ─── hands_off: single verdict line ─────────────────────────────────
  if (depth === 0) {
    return (
      <div className={cn('rounded-xl border px-5 py-3.5 flex items-center gap-3', style.bgColor)}>
        <Icon className={cn('h-5 w-5 shrink-0', style.color)} />
        <span className={cn('text-sm font-semibold', style.color)}>{projection.verdictLabel}</span>
        {projection.thresholdPct != null && (
          <span className="text-sm text-muted-foreground">
            {Math.round(projection.currentYesPct)}% of {Math.round(projection.thresholdPct)}% needed
          </span>
        )}
      </div>
    );
  }

  // ─── informed+: progress bar with threshold ─────────────────────────
  const effectiveProjection = getEffectiveProjection(projection);
  const showProjectedFill = effectiveProjection > projection.currentYesPct + 0.5;

  return (
    <div className={cn('rounded-xl border overflow-hidden', style.bgColor)}>
      {/* Verdict header */}
      <div className="px-5 py-3.5 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <Icon className={cn('h-5 w-5 shrink-0', style.color)} />
          <span className={cn('text-sm font-semibold', style.color)}>
            {projection.verdictLabel}
          </span>
          {projection.confidence === 'low' && (
            <Badge variant="outline" className="text-[11px] text-muted-foreground shrink-0">
              Limited data
            </Badge>
          )}
        </div>
        {projection.epochsRemaining != null && projection.epochsRemaining > 0 && (
          <span className="text-sm text-muted-foreground shrink-0">
            {projection.epochsRemaining} epoch{projection.epochsRemaining !== 1 ? 's' : ''}{' '}
            remaining
          </span>
        )}
      </div>

      {/* Progress bar */}
      {projection.thresholdPct != null && (
        <div className="px-5 pb-3.5">
          <div className="relative h-3.5 rounded-full bg-muted/40 overflow-visible">
            {/* Projected fill (lighter shade extension) — always shows where we expect to land */}
            {showProjectedFill && (
              <div
                className={cn('absolute inset-y-0 left-0 rounded-full', style.ghostColor)}
                style={{ width: `${Math.min(100, effectiveProjection)}%` }}
              />
            )}
            {/* Yes power fill (solid — actual votes) */}
            <div
              className={cn(
                'absolute inset-y-0 left-0 rounded-full transition-all duration-500',
                style.barColor,
              )}
              style={{ width: `${Math.min(100, projection.currentYesPct)}%` }}
            />
            {/* Threshold marker */}
            <div
              className="absolute top-[-5px] bottom-[-5px] w-0.5 bg-foreground/50"
              style={{ left: `${Math.min(100, projection.thresholdPct)}%` }}
            >
              <div className="absolute -top-5 left-1/2 -translate-x-1/2 text-[10px] text-muted-foreground whitespace-nowrap font-medium">
                {Math.round(projection.thresholdPct)}%
              </div>
            </div>
          </div>

          {/* Numbers below bar */}
          <div className="flex items-center justify-between mt-2.5">
            <div className="flex items-center gap-2.5 flex-wrap">
              <span className="text-sm text-foreground/80">
                {projection.currentYesPct.toFixed(1)}% of active stake voting Yes
              </span>
              {projection.yesOfVotersPct != null && projection.participationPct < 50 && (
                <span className="text-sm text-muted-foreground">
                  ({Math.round(projection.yesOfVotersPct)}% of voters)
                </span>
              )}
            </div>
            {showProjectedFill && (
              <span className="text-sm text-muted-foreground shrink-0">
                Projected: ~{Math.round(effectiveProjection)}%
                {effectiveProjection >= (projection.thresholdPct ?? 0) ? ' (passes)' : ''}
              </span>
            )}
          </div>
        </div>
      )}

      {/* engaged+: detailed context */}
      {depth >= 2 && (
        <div className="px-5 pb-3.5 space-y-1.5 border-t border-border/20 pt-3">
          <p className="text-sm text-foreground/80">{projection.verdictDetail}</p>
          {projection.historicalEvidence && (
            <p className="text-sm text-muted-foreground">{projection.historicalEvidence}</p>
          )}
          {projection.confidence !== 'high' && (
            <p className="text-xs text-muted-foreground italic">{projection.confidenceReason}</p>
          )}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Map the proposalSections config to a numeric depth level */
function getDepthLevel(sections: Record<string, boolean>): 0 | 1 | 2 | 3 {
  if (sections.sourceMaterial) return 3; // deep
  if (sections.outcomeSection) return 2; // engaged
  if (sections.actionZone) return 1; // informed
  return 0; // hands_off
}
