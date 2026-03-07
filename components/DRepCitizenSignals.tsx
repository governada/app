'use client';

import { useQuery } from '@tanstack/react-query';
import { Users, TrendingUp, TrendingDown, Minus } from 'lucide-react';

interface EngagementData {
  proposalsWithSentiment: number;
  totalCitizenVotes: number;
  sentimentAlignment: number | null;
  alignedCount: number;
  divergedCount: number;
  noSentimentCount: number;
}

export function DRepCitizenSignals({ drepId }: { drepId: string }) {
  const { data, isLoading } = useQuery<EngagementData>({
    queryKey: ['drep-engagement', drepId],
    queryFn: () =>
      fetch(`/api/drep/${encodeURIComponent(drepId)}/engagement`).then((r) => r.json()),
    staleTime: 5 * 60 * 1000,
  });

  if (isLoading || !data || data.proposalsWithSentiment === 0) return null;

  const alignment = data.sentimentAlignment;
  const compared = data.alignedCount + data.divergedCount;

  const AlignIcon =
    alignment != null && alignment >= 70
      ? TrendingUp
      : alignment != null && alignment < 50
        ? TrendingDown
        : Minus;

  const alignColor =
    alignment != null && alignment >= 70
      ? 'text-emerald-500'
      : alignment != null && alignment < 50
        ? 'text-rose-500'
        : 'text-amber-500';

  const alignLabel =
    alignment != null && alignment >= 70
      ? 'votes with citizen sentiment'
      : alignment != null && alignment < 50
        ? 'often diverges from citizen sentiment'
        : 'mixed alignment with citizen sentiment';

  return (
    <div className="rounded-xl border border-border bg-card px-5 py-4 space-y-2">
      <div className="flex items-center gap-2">
        <Users className="h-4 w-4 text-primary" />
        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
          Citizen Sentiment Signal
        </span>
      </div>

      <div className="flex items-center justify-between">
        <div className="space-y-0.5">
          {alignment != null && (
            <div className="flex items-center gap-1.5">
              <AlignIcon className={`h-4 w-4 ${alignColor}`} />
              <span className="text-sm font-medium">
                <span className={`font-bold tabular-nums ${alignColor}`}>{alignment}%</span>{' '}
                {alignLabel}
              </span>
            </div>
          )}
          <p className="text-xs text-muted-foreground">
            {data.totalCitizenVotes.toLocaleString()} citizen
            {data.totalCitizenVotes !== 1 ? 's' : ''} expressed views across {compared} proposal
            {compared !== 1 ? 's' : ''}
          </p>
        </div>

        {alignment != null && compared > 0 && (
          <div className="flex items-center gap-1">
            <div className="w-16 h-1.5 rounded-full bg-border overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${
                  alignment >= 70
                    ? 'bg-emerald-500'
                    : alignment >= 50
                      ? 'bg-amber-500'
                      : 'bg-rose-500'
                }`}
                style={{ width: `${alignment}%` }}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
