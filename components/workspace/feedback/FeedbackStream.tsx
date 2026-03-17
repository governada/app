'use client';

/**
 * FeedbackStream — main consolidated feedback list for a proposal.
 *
 * Renders FeedbackTheme cards sorted by endorsement count.
 * Shows a "Novel Feedback" section for recently unclassified annotations.
 * Proposer view: includes Address/Defer/Dismiss actions per theme.
 * Reviewer view: includes +1 endorsement button per theme.
 */

import { useMemo } from 'react';
import { MessageSquareText, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useFeedbackThemes } from '@/hooks/useFeedbackThemes';
import { FeedbackThemeCard } from './FeedbackTheme';
import { SealedOverlay } from './SealedOverlay';
import type { FeedbackTheme } from '@/lib/workspace/feedback/types';

interface FeedbackStreamProps {
  proposalTxHash: string;
  proposalIndex: number;
  /** Whether the current user is the proposal owner (shows address actions) */
  isProposer: boolean;
  className?: string;
}

export function FeedbackStream({
  proposalTxHash,
  proposalIndex,
  isProposer,
  className,
}: FeedbackStreamProps) {
  const { themes, isSealed, isLoading } = useFeedbackThemes(proposalTxHash, proposalIndex);

  // Separate addressed/open themes
  const { openThemes, addressedThemes, novelThemes } = useMemo(() => {
    const open: FeedbackTheme[] = [];
    const addressed: FeedbackTheme[] = [];
    const novel: FeedbackTheme[] = [];

    for (const theme of themes) {
      if (theme.addressedStatus !== 'open') {
        addressed.push(theme);
      } else if (theme.novelContributions.length > 0 && theme.endorsementCount <= 1) {
        novel.push(theme);
      } else {
        open.push(theme);
      }
    }

    // Sort open themes by endorsement count (descending)
    open.sort((a, b) => b.endorsementCount - a.endorsementCount);
    // Sort novel by recency (most recent first)
    novel.sort(
      (a, b) =>
        new Date(b.novelContributions[0]?.timestamp ?? 0).getTime() -
        new Date(a.novelContributions[0]?.timestamp ?? 0).getTime(),
    );

    return { openThemes: open, addressedThemes: addressed, novelThemes: novel };
  }, [themes]);

  // Sealed state
  if (isSealed) {
    return <SealedOverlay className={className} />;
  }

  // Loading
  if (isLoading) {
    return (
      <div className={cn('space-y-3', className)}>
        <div className="h-6 w-48 bg-muted/50 rounded animate-pulse" />
        <div className="h-24 bg-muted/30 rounded-lg animate-pulse" />
        <div className="h-24 bg-muted/30 rounded-lg animate-pulse" />
      </div>
    );
  }

  // Empty state
  if (themes.length === 0) {
    return (
      <div className={cn('text-center py-8 space-y-2', className)}>
        <MessageSquareText className="mx-auto h-8 w-8 text-muted-foreground/40" />
        <p className="text-sm text-muted-foreground">No community feedback yet</p>
        <p className="text-xs text-muted-foreground/70">
          Themes will appear here as reviewers submit annotations.
        </p>
      </div>
    );
  }

  const totalReviewers = new Set(
    themes.flatMap((t) => [
      ...t.keyVoices.map((v) => v.reviewerId),
      ...t.novelContributions.map((c) => c.reviewerId),
    ]),
  ).size;

  return (
    <div className={cn('space-y-4', className)}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-foreground">
          Community Feedback
          {totalReviewers > 0 && (
            <span className="ml-1.5 text-xs font-normal text-muted-foreground">
              ({totalReviewers} reviewer{totalReviewers !== 1 ? 's' : ''})
            </span>
          )}
        </h3>
        <span className="text-xs text-muted-foreground tabular-nums">
          {themes.length} theme{themes.length !== 1 ? 's' : ''}
        </span>
      </div>

      {/* Open themes */}
      {openThemes.length > 0 && (
        <div className="space-y-2">
          {openThemes.map((theme) => (
            <FeedbackThemeCard
              key={theme.id}
              theme={theme}
              proposalTxHash={proposalTxHash}
              proposalIndex={proposalIndex}
              isProposer={isProposer}
            />
          ))}
        </div>
      )}

      {/* Novel feedback section */}
      {novelThemes.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center gap-1.5">
            <Sparkles className="h-3.5 w-3.5 text-amber-500" />
            <h4 className="text-xs font-medium text-muted-foreground">
              Novel Feedback ({novelThemes.length})
            </h4>
          </div>
          {novelThemes.map((theme) => (
            <FeedbackThemeCard
              key={theme.id}
              theme={theme}
              proposalTxHash={proposalTxHash}
              proposalIndex={proposalIndex}
              isProposer={isProposer}
            />
          ))}
        </div>
      )}

      {/* Addressed themes (collapsed) */}
      {addressedThemes.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-xs font-medium text-muted-foreground">
            Addressed ({addressedThemes.length})
          </h4>
          {addressedThemes.map((theme) => (
            <FeedbackThemeCard
              key={theme.id}
              theme={theme}
              proposalTxHash={proposalTxHash}
              proposalIndex={proposalIndex}
              isProposer={isProposer}
              defaultCollapsed
            />
          ))}
        </div>
      )}
    </div>
  );
}
