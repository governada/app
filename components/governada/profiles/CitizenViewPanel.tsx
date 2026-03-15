'use client';

import Link from 'next/link';
import { cn } from '@/lib/utils';
import { Eye, Info, Lightbulb, CheckCircle2, ArrowRight } from 'lucide-react';
import { TrustSignals, type TrustSignal } from '@/components/governada/profiles/TrustSignals';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

/* ─── Types ───────────────────────────────────────────── */

interface CitizenViewPanelProps {
  drepId: string;
  trustSignals: TrustSignal[];
  tier: string;
  delegatorCount: number;
  participationRate: number;
  rationaleRate: number;
  className?: string;
}

/* ─── Insight generation ─────────────────────────────── */

interface Insight {
  type: 'improvement' | 'positive';
  message: string;
}

function generateInsights(participationRate: number, rationaleRate: number): Insight[] {
  const insights: Insight[] = [];

  if (participationRate < 70) {
    const votesNeeded = Math.ceil(((70 - participationRate) / 100) * 20);
    insights.push({
      type: 'improvement',
      message: `Your participation rate (${Math.round(participationRate)}%) is below the "Votes on most proposals" threshold. Vote on ${Math.max(votesNeeded, 1)} more proposals to improve this signal.`,
    });
  }

  if (rationaleRate < 60) {
    const votesNeeded = Math.ceil(((60 - rationaleRate) / 100) * 10);
    insights.push({
      type: 'improvement',
      message: `Your rationale rate (${Math.round(rationaleRate)}%) shows as "Sometimes provides rationale." Writing rationale on your next ${Math.max(votesNeeded, 1)} votes would upgrade this to "Writes rationale on most votes."`,
    });
  }

  if (participationRate >= 70 && rationaleRate >= 60) {
    insights.push({
      type: 'positive',
      message:
        'Your trust signals are strong. Citizens see you as a consistent, transparent representative.',
    });
  }

  return insights;
}

/* ─── Component ──────────────────────────────────────── */

export function CitizenViewPanel({
  drepId,
  trustSignals,
  tier,
  participationRate,
  rationaleRate,
  className,
}: CitizenViewPanelProps) {
  const insights = generateInsights(participationRate, rationaleRate);

  return (
    <div
      className={cn(
        'rounded-lg border border-border/60 bg-card/50 backdrop-blur-sm p-4 sm:p-5 space-y-4',
        className,
      )}
    >
      {/* Header */}
      <div className="flex items-center gap-2">
        <Eye className="h-4 w-4 text-primary shrink-0" />
        <h3 className="text-sm font-semibold text-foreground">How Citizens See You</h3>
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Info className="h-3.5 w-3.5 text-muted-foreground cursor-help shrink-0" />
            </TooltipTrigger>
            <TooltipContent side="top" className="max-w-xs">
              <p className="text-xs">
                Citizens now see your profile through the Decision Engine — alignment-first with
                these trust signals
              </p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>

      {/* Trust Signals preview */}
      <div className="rounded-md border border-border/40 bg-muted/30 p-3">
        <TrustSignals tier={tier} signals={trustSignals} />
      </div>

      {/* Insight callouts */}
      {insights.length > 0 && (
        <div className="space-y-2">
          {insights.map((insight, i) => (
            <div
              key={i}
              className={cn(
                'flex items-start gap-2 rounded-md px-3 py-2.5 text-xs leading-relaxed',
                insight.type === 'improvement'
                  ? 'bg-amber-50 text-amber-800 dark:bg-amber-950/20 dark:text-amber-300'
                  : 'bg-emerald-50 text-emerald-800 dark:bg-emerald-950/20 dark:text-emerald-300',
              )}
            >
              {insight.type === 'improvement' ? (
                <Lightbulb className="h-3.5 w-3.5 mt-0.5 shrink-0" />
              ) : (
                <CheckCircle2 className="h-3.5 w-3.5 mt-0.5 shrink-0" />
              )}
              <span>{insight.message}</span>
            </div>
          ))}
        </div>
      )}

      {/* Preview as citizen link */}
      <Link
        href={`/drep/${encodeURIComponent(drepId)}`}
        className="inline-flex items-center gap-1.5 text-xs font-medium text-primary hover:text-primary/80 transition-colors"
      >
        Preview as citizen
        <ArrowRight className="h-3 w-3" />
      </Link>
    </div>
  );
}
