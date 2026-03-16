'use client';

import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { ThumbsUp, ThumbsDown, HelpCircle, Users } from 'lucide-react';
import { useWallet } from '@/utils/wallet';
import { getStoredSession } from '@/lib/supabaseAuth';
import { resolveRewardAddress } from '@meshsdk/core';
import { hapticLight } from '@/lib/haptics';
import { useSentimentResults } from '@/hooks/useEngagement';
import { cn } from '@/lib/utils';

type SentimentChoice = 'support' | 'oppose' | 'unsure';

interface CitizenSentimentReactionProps {
  txHash: string;
  proposalIndex: number;
  isOpen: boolean;
  /** If true, show read-only results only (for governance actors) */
  readOnly?: boolean;
}

const CHOICES: { key: SentimentChoice; icon: typeof ThumbsUp; label: string }[] = [
  { key: 'support', icon: ThumbsUp, label: 'Support' },
  { key: 'oppose', icon: ThumbsDown, label: 'Oppose' },
  { key: 'unsure', icon: HelpCircle, label: 'Unsure' },
];

const BAR_COLORS: Record<SentimentChoice, string> = {
  support: 'bg-emerald-500',
  oppose: 'bg-rose-500',
  unsure: 'bg-zinc-400',
};

/**
 * CitizenSentimentReaction — lightweight one-tap sentiment micro-interaction.
 * Designed as discovery infrastructure: enriches the proposal page for all users.
 */
export function CitizenSentimentReaction({
  txHash,
  proposalIndex,
  isOpen,
  readOnly = false,
}: CitizenSentimentReactionProps) {
  const { connected, isAuthenticated, address, delegatedDrepId, ownDRepId, authenticate } =
    useWallet();
  const queryClient = useQueryClient();
  const { data, isLoading } = useSentimentResults(txHash, proposalIndex, ownDRepId);

  const [voting, setVoting] = useState(false);

  const userSentiment = data?.userSentiment ?? null;
  const community = data?.community ?? { support: 0, oppose: 0, unsure: 0, total: 0 };
  const total = community.total;

  const castVote = async (sentiment: SentimentChoice) => {
    if (voting || readOnly) return;
    hapticLight();
    setVoting(true);

    try {
      if (!connected || !isAuthenticated) {
        await authenticate?.();
        setVoting(false);
        return;
      }

      const token = getStoredSession();
      if (!token || !address) {
        setVoting(false);
        return;
      }

      const stakeAddress = resolveRewardAddress(address);

      // Optimistic update
      const queryKey = ['citizen-sentiment', txHash, proposalIndex, ownDRepId ?? null];
      queryClient.setQueryData(queryKey, (old: typeof data) =>
        old
          ? {
              ...old,
              hasVoted: true,
              userSentiment: sentiment,
              community: {
                ...old.community,
                [sentiment]: old.community[sentiment] + (old.hasVoted ? 0 : 1),
                ...(old.userSentiment && old.userSentiment !== sentiment
                  ? { [old.userSentiment]: Math.max(0, old.community[old.userSentiment] - 1) }
                  : {}),
                total: old.community.total + (old.hasVoted ? 0 : 1),
              },
            }
          : old,
      );

      await fetch('/api/engagement/sentiment/vote', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          proposalTxHash: txHash,
          proposalIndex,
          sentiment,
          stakeAddress,
          delegatedDrepId: delegatedDrepId ?? undefined,
        }),
      });

      queryClient.invalidateQueries({ queryKey });
    } catch {
      queryClient.invalidateQueries({
        queryKey: ['citizen-sentiment', txHash, proposalIndex, ownDRepId ?? null],
      });
    } finally {
      setVoting(false);
    }
  };

  if (isLoading) {
    return <div className="h-10 animate-pulse rounded-lg bg-muted/30" />;
  }

  // No votes yet and closed proposal — nothing to show
  if (total === 0 && !isOpen) return null;

  const showButtons = isOpen && !readOnly;
  const canVote = connected && isAuthenticated;

  return (
    <div className="space-y-2">
      {/* Voting pills */}
      {showButtons && (
        <div className="flex items-center gap-2">
          {CHOICES.map(({ key, icon: Icon, label }) => {
            const isSelected = userSentiment === key;
            return (
              <button
                key={key}
                onClick={() => castVote(key)}
                disabled={voting || (!canVote && false)}
                className={cn(
                  'inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-all',
                  'border outline-none focus-visible:ring-2 focus-visible:ring-ring',
                  isSelected
                    ? 'border-primary bg-primary/15 text-primary'
                    : 'border-border bg-card text-muted-foreground hover:border-primary/40 hover:text-foreground',
                  voting && 'opacity-50 cursor-not-allowed',
                )}
                aria-label={`${label}${isSelected ? ' (your vote)' : ''}`}
              >
                <Icon className="h-3.5 w-3.5" />
                {label}
              </button>
            );
          })}
          {!canVote && (
            <button
              onClick={() => authenticate?.()}
              className="text-[11px] text-primary hover:underline ml-1"
            >
              Connect to vote
            </button>
          )}
        </div>
      )}

      {/* Results bar + social proof */}
      {total > 0 && (
        <div className="space-y-1">
          <div className="flex h-2 w-full overflow-hidden rounded-full bg-muted/30">
            {(['support', 'oppose', 'unsure'] as SentimentChoice[]).map((key) => {
              const pct = total > 0 ? (community[key] / total) * 100 : 0;
              if (pct === 0) return null;
              return (
                <div
                  key={key}
                  className={cn('transition-all duration-300', BAR_COLORS[key])}
                  style={{ width: `${pct}%` }}
                />
              );
            })}
          </div>
          <div className="flex items-center justify-between text-[11px] text-muted-foreground">
            <div className="flex items-center gap-1">
              <Users className="h-3 w-3" />
              <span>
                {total} citizen{total !== 1 ? 's' : ''} weighed in
              </span>
            </div>
            {total > 0 && (
              <div className="flex items-center gap-2">
                <span className="text-emerald-500">
                  {Math.round((community.support / total) * 100)}% support
                </span>
                <span className="text-rose-500">
                  {Math.round((community.oppose / total) * 100)}% oppose
                </span>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
