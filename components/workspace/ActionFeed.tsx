'use client';

import Link from 'next/link';
import {
  AlertTriangle,
  Clock,
  Vote,
  FileText,
  MessageCircle,
  TrendingDown,
  ArrowRight,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import type { CockpitData } from '@/hooks/queries';

// ── Card types ───────────────────────────────────────────────────────

function ProposalCard({
  proposal,
}: {
  proposal: CockpitData['actionFeed']['pendingProposals'][number];
}) {
  const isUrgent = proposal.isUrgent;
  return (
    <Link
      href={`/proposal/${proposal.txHash}/${proposal.index}`}
      className="group flex items-start gap-3 rounded-xl border border-border bg-card p-3.5 transition-colors hover:border-primary/40"
    >
      <div
        className={cn(
          'mt-0.5 rounded-full p-1.5',
          isUrgent ? 'bg-red-100 dark:bg-red-900/30' : 'bg-amber-100 dark:bg-amber-900/30',
        )}
      >
        {isUrgent ? (
          <AlertTriangle className="h-3.5 w-3.5 text-red-600 dark:text-red-400" />
        ) : (
          <Clock className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400" />
        )}
      </div>
      <div className="flex-1 min-w-0 space-y-0.5">
        <p className="text-sm font-medium text-foreground truncate">{proposal.title}</p>
        <div className="flex items-center gap-2 flex-wrap">
          <Badge variant="secondary" className="text-[10px]">
            {proposal.proposalType}
          </Badge>
          {proposal.epochsRemaining !== null && (
            <span
              className={cn(
                'text-[10px] font-medium',
                isUrgent ? 'text-red-600 dark:text-red-400' : 'text-amber-600 dark:text-amber-400',
              )}
            >
              {proposal.epochsRemaining === 0
                ? 'Expires this epoch'
                : `${proposal.epochsRemaining} epoch${proposal.epochsRemaining !== 1 ? 's' : ''} left`}
            </span>
          )}
        </div>
      </div>
      <ArrowRight className="mt-1.5 h-3.5 w-3.5 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
    </Link>
  );
}

function RationaleCard({ vote }: { vote: { txHash: string; index: number; title: string } }) {
  return (
    <Link
      href={`/proposal/${vote.txHash}/${vote.index}`}
      className="group flex items-start gap-3 rounded-xl border border-border bg-card p-3.5 transition-colors hover:border-primary/40"
    >
      <div className="mt-0.5 rounded-full p-1.5 bg-blue-100 dark:bg-blue-900/30">
        <FileText className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />
      </div>
      <div className="flex-1 min-w-0 space-y-0.5">
        <p className="text-sm font-medium text-foreground truncate">{vote.title}</p>
        <p className="text-[10px] text-blue-600 dark:text-blue-400 font-medium">
          Add rationale to build trust
        </p>
      </div>
      <ArrowRight className="mt-1.5 h-3.5 w-3.5 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
    </Link>
  );
}

function QuestionsAlert({ count }: { count: number }) {
  return (
    <Link
      href="/workspace/questions"
      className="group flex items-start gap-3 rounded-xl border border-border bg-card p-3.5 transition-colors hover:border-primary/40"
    >
      <div className="mt-0.5 rounded-full p-1.5 bg-violet-100 dark:bg-violet-900/30">
        <MessageCircle className="h-3.5 w-3.5 text-violet-600 dark:text-violet-400" />
      </div>
      <div className="flex-1 min-w-0 space-y-0.5">
        <p className="text-sm font-medium text-foreground">
          {count} unanswered question{count !== 1 ? 's' : ''}
        </p>
        <p className="text-[10px] text-violet-600 dark:text-violet-400 font-medium">
          Responding to delegators improves accountability
        </p>
      </div>
      <ArrowRight className="mt-1.5 h-3.5 w-3.5 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
    </Link>
  );
}

function ScoreAlert({ delta, recommendation }: { delta: number; recommendation: string | null }) {
  if (delta >= 0) return null;
  return (
    <div className="flex items-start gap-3 rounded-xl border border-rose-500/20 bg-rose-500/5 p-3.5">
      <div className="mt-0.5 rounded-full p-1.5 bg-rose-100 dark:bg-rose-900/30">
        <TrendingDown className="h-3.5 w-3.5 text-rose-600 dark:text-rose-400" />
      </div>
      <div className="flex-1 min-w-0 space-y-0.5">
        <p className="text-sm font-medium text-foreground">
          Score dropped {Math.abs(delta)} points this week
        </p>
        {recommendation && <p className="text-[10px] text-muted-foreground">{recommendation}</p>}
      </div>
    </div>
  );
}

// ── Main Feed ────────────────────────────────────────────────────────

export function ActionFeed({ actionFeed }: { actionFeed: CockpitData['actionFeed'] }) {
  const urgentProposals = actionFeed.pendingProposals.filter((p) => p.isUrgent);
  const normalProposals = actionFeed.pendingProposals.filter((p) => !p.isUrgent);
  const hasItems =
    actionFeed.pendingCount > 0 ||
    actionFeed.unexplainedVotes.length > 0 ||
    actionFeed.unansweredQuestions > 0 ||
    actionFeed.scoreAlerts.delta < 0;

  if (!hasItems) {
    return (
      <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/5 p-6 text-center">
        <Vote className="mx-auto h-8 w-8 text-emerald-500 mb-2" />
        <p className="text-base font-semibold text-foreground">All caught up</p>
        <p className="text-sm text-muted-foreground mt-1">
          No actions need your attention right now.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
          <Vote className="h-4 w-4 text-muted-foreground" />
          Action Feed
        </h3>
        <span className="text-xs text-muted-foreground tabular-nums">
          {actionFeed.pendingCount +
            actionFeed.unexplainedVotes.length +
            actionFeed.unansweredQuestions}{' '}
          items
        </span>
      </div>

      <div className="space-y-2">
        {/* Score alert first if dropping */}
        <ScoreAlert
          delta={actionFeed.scoreAlerts.delta}
          recommendation={actionFeed.scoreAlerts.recommendation}
        />

        {/* Urgent proposals first */}
        {urgentProposals.map((p) => (
          <ProposalCard key={`${p.txHash}-${p.index}`} proposal={p} />
        ))}

        {/* Unexplained votes */}
        {actionFeed.unexplainedVotes.slice(0, 3).map((v) => (
          <RationaleCard key={`${v.txHash}-${v.index}`} vote={v} />
        ))}

        {/* Unanswered questions */}
        {actionFeed.unansweredQuestions > 0 && (
          <QuestionsAlert count={actionFeed.unansweredQuestions} />
        )}

        {/* Normal proposals */}
        {normalProposals.slice(0, 5).map((p) => (
          <ProposalCard key={`${p.txHash}-${p.index}`} proposal={p} />
        ))}
      </div>
    </div>
  );
}
