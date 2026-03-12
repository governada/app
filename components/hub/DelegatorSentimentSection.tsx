'use client';

import Link from 'next/link';
import { BarChart3, ThumbsUp, ThumbsDown, HelpCircle, ExternalLink } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { Skeleton } from '@/components/ui/skeleton';
import { getStoredSession } from '@/lib/supabaseAuth';

interface DelegatorSentimentSectionProps {
  drepId: string;
}

interface DelegatorSentimentData {
  proposals: {
    txHash: string;
    proposalIndex: number;
    title: string | null;
    delegatorSentiment: {
      support: number;
      oppose: number;
      unsure: number;
      total: number;
    };
  }[];
  aggregate: {
    support: number;
    oppose: number;
    unsure: number;
    total: number;
  };
}

/**
 * DelegatorSentimentSection -- Shows how a DRep's delegators feel about active proposals.
 *
 * Queries aggregated sentiment signals from citizens delegated to this DRep,
 * giving the representative direct insight into delegator preferences.
 *
 * JTBD: "How do my delegators feel about current governance?"
 */
export function DelegatorSentimentSection({ drepId }: DelegatorSentimentSectionProps) {
  const { data, isLoading, isError } = useQuery<DelegatorSentimentData>({
    queryKey: ['delegator-sentiment', drepId],
    queryFn: async () => {
      const headers: HeadersInit = {};
      const token = getStoredSession();
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const res = await fetch(
        `/api/engagement/sentiment/delegator-aggregate?drepId=${encodeURIComponent(drepId)}`,
        { headers },
      );
      if (!res.ok) throw new Error(`${res.status}`);
      return res.json();
    },
    staleTime: 60_000,
    retry: 1,
  });

  if (isLoading) {
    return (
      <div className="rounded-2xl border border-border bg-card p-5 space-y-3">
        <Skeleton className="h-4 w-40" />
        <Skeleton className="h-16 w-full" />
      </div>
    );
  }

  // Gracefully handle API not existing yet or errors
  if (isError || !data || data.aggregate.total === 0) {
    return null;
  }

  const { aggregate, proposals } = data;
  const supportPct =
    aggregate.total > 0 ? Math.round((aggregate.support / aggregate.total) * 100) : 0;
  const opposePct =
    aggregate.total > 0 ? Math.round((aggregate.oppose / aggregate.total) * 100) : 0;
  const unsurePct =
    aggregate.total > 0 ? Math.round((aggregate.unsure / aggregate.total) * 100) : 0;

  return (
    <div className="rounded-2xl border border-primary/10 bg-primary/[0.03] p-5 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium flex items-center gap-2">
          <BarChart3 className="h-4 w-4 text-primary" />
          Your Delegators&apos; Sentiment
        </h3>
        <span className="text-[10px] text-muted-foreground tabular-nums">
          {aggregate.total} signal{aggregate.total !== 1 ? 's' : ''} across proposals
        </span>
      </div>

      {/* Aggregate sentiment bars */}
      <div className="space-y-2">
        <SentimentBar
          label="Support"
          count={aggregate.support}
          percent={supportPct}
          color="bg-green-500"
          icon={ThumbsUp}
        />
        <SentimentBar
          label="Oppose"
          count={aggregate.oppose}
          percent={opposePct}
          color="bg-red-500"
          icon={ThumbsDown}
        />
        <SentimentBar
          label="Unsure"
          count={aggregate.unsure}
          percent={unsurePct}
          color="bg-amber-500"
          icon={HelpCircle}
        />
      </div>

      {/* Per-proposal breakdown */}
      {proposals.length > 0 && (
        <div className="space-y-1.5 pt-2 border-t border-border/30">
          <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
            By Proposal
          </p>
          {proposals.slice(0, 5).map((p) => {
            const total = p.delegatorSentiment.total;
            const pctSupport =
              total > 0 ? Math.round((p.delegatorSentiment.support / total) * 100) : 0;
            return (
              <Link
                key={`${p.txHash}-${p.proposalIndex}`}
                href={`/proposal/${p.txHash}/${p.proposalIndex}`}
                className="group flex items-center justify-between gap-2 rounded-lg px-2 py-1.5 hover:bg-white/[0.03] transition-colors"
              >
                <span className="text-xs text-foreground truncate min-w-0 flex-1">
                  {p.title ?? `Proposal ${p.txHash.slice(0, 8)}...`}
                </span>
                <span className="flex items-center gap-1.5 shrink-0">
                  <span className="inline-flex h-1 w-6 rounded-full bg-muted overflow-hidden">
                    <span
                      className="h-full bg-emerald-500 rounded-full"
                      style={{ width: `${pctSupport}%` }}
                    />
                  </span>
                  <span className="text-[10px] text-muted-foreground tabular-nums">
                    {total} votes
                  </span>
                  <ExternalLink className="h-3 w-3 text-muted-foreground/40 group-hover:text-primary transition-colors" />
                </span>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}

function SentimentBar({
  label,
  count,
  percent,
  color,
  icon: Icon,
}: {
  label: string;
  count: number;
  percent: number;
  color: string;
  icon: typeof ThumbsUp;
}) {
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-xs">
        <span className="flex items-center gap-1.5">
          <Icon className="h-3 w-3 text-muted-foreground" />
          {label}
        </span>
        <span className="tabular-nums text-muted-foreground">
          {count} ({percent}%)
        </span>
      </div>
      <div className="h-1.5 rounded-full bg-muted overflow-hidden">
        <div
          className={`h-full rounded-full ${color} transition-all duration-700 ease-out`}
          style={{ width: `${percent}%` }}
        />
      </div>
    </div>
  );
}
