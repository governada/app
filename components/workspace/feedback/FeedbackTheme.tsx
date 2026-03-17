'use client';

/**
 * FeedbackThemeCard — single feedback theme with expand/collapse,
 * endorsement button, key voices, and proposer action buttons.
 */

import { useState, useCallback } from 'react';
import {
  ChevronDown,
  ChevronRight,
  ThumbsUp,
  AlertCircle,
  CheckCircle2,
  HelpCircle,
  Lightbulb,
  Check,
  Clock,
  X,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useEndorseTheme, useAddressTheme } from '@/hooks/useFeedbackThemes';
import type { FeedbackTheme } from '@/lib/workspace/feedback/types';

// ---------------------------------------------------------------------------
// Category styling
// ---------------------------------------------------------------------------

const CATEGORY_CONFIG: Record<
  FeedbackTheme['category'],
  { icon: typeof AlertCircle; label: string; badgeClass: string; borderClass: string }
> = {
  concern: {
    icon: AlertCircle,
    label: 'Concern',
    badgeClass:
      'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 border-red-200 dark:border-red-800',
    borderClass: 'border-red-200/50 dark:border-red-900/30',
  },
  support: {
    icon: CheckCircle2,
    label: 'Support',
    badgeClass:
      'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800',
    borderClass: 'border-emerald-200/50 dark:border-emerald-900/30',
  },
  question: {
    icon: HelpCircle,
    label: 'Question',
    badgeClass:
      'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 border-blue-200 dark:border-blue-800',
    borderClass: 'border-blue-200/50 dark:border-blue-900/30',
  },
  suggestion: {
    icon: Lightbulb,
    label: 'Suggestion',
    badgeClass:
      'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 border-amber-200 dark:border-amber-800',
    borderClass: 'border-amber-200/50 dark:border-amber-900/30',
  },
};

const ADDRESSED_CONFIG: Record<string, { icon: typeof Check; label: string; className: string }> = {
  addressed: {
    icon: Check,
    label: 'Addressed',
    className: 'text-emerald-600 dark:text-emerald-400',
  },
  deferred: {
    icon: Clock,
    label: 'Deferred',
    className: 'text-amber-600 dark:text-amber-400',
  },
  dismissed: {
    icon: X,
    label: 'Dismissed',
    className: 'text-muted-foreground',
  },
};

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface FeedbackThemeCardProps {
  theme: FeedbackTheme;
  proposalTxHash: string;
  proposalIndex: number;
  isProposer: boolean;
  defaultCollapsed?: boolean;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function FeedbackThemeCard({
  theme,
  proposalTxHash,
  proposalIndex,
  isProposer,
  defaultCollapsed = false,
}: FeedbackThemeCardProps) {
  const [expanded, setExpanded] = useState(!defaultCollapsed);
  const config = CATEGORY_CONFIG[theme.category];
  const CategoryIcon = config.icon;

  const endorseMutation = useEndorseTheme(proposalTxHash, proposalIndex);
  const addressMutation = useAddressTheme(proposalTxHash, proposalIndex);

  const handleEndorse = useCallback(() => {
    endorseMutation.mutate({ themeId: theme.id });
  }, [endorseMutation, theme.id]);

  const handleAddress = useCallback(
    (action: 'addressed' | 'deferred' | 'dismissed') => {
      addressMutation.mutate({ themeId: theme.id, action });
    },
    [addressMutation, theme.id],
  );

  const isAddressed = theme.addressedStatus !== 'open';
  const addressedInfo = isAddressed ? ADDRESSED_CONFIG[theme.addressedStatus] : null;

  return (
    <div
      className={cn(
        'rounded-lg border bg-card transition-colors',
        config.borderClass,
        isAddressed && 'opacity-75',
      )}
    >
      {/* Collapsed header */}
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="flex w-full items-start gap-2 px-3 py-2.5 text-left"
      >
        {expanded ? (
          <ChevronDown className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
        ) : (
          <ChevronRight className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
        )}

        <div className="flex-1 min-w-0 space-y-1">
          <div className="flex items-center gap-2 flex-wrap">
            <Badge variant="outline" className={cn('text-[10px] px-1.5 py-0', config.badgeClass)}>
              <CategoryIcon className="h-2.5 w-2.5" />
              {config.label}
            </Badge>

            {isAddressed && addressedInfo && (
              <Badge
                variant="outline"
                className={cn('text-[10px] px-1.5 py-0', addressedInfo.className)}
              >
                <addressedInfo.icon className="h-2.5 w-2.5" />
                {addressedInfo.label}
              </Badge>
            )}
          </div>

          <p className={cn('text-sm text-foreground/90', !expanded && 'line-clamp-2')}>
            {theme.summary}
          </p>
        </div>

        {/* Endorsement count */}
        <div className="flex items-center gap-1 shrink-0 text-xs tabular-nums text-muted-foreground">
          <ThumbsUp className="h-3 w-3" />
          {theme.endorsementCount}
        </div>
      </button>

      {/* Expanded content */}
      {expanded && (
        <div className="px-3 pb-3 space-y-3 border-t border-border/50 pt-2">
          {/* Key voices */}
          {theme.keyVoices.length > 0 && (
            <div className="space-y-1.5">
              <h5 className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
                Key Voices
              </h5>
              {theme.keyVoices.map((voice, i) => (
                <div key={i} className="flex items-start gap-2 rounded-md bg-muted/30 px-2.5 py-2">
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-foreground/80 italic">&ldquo;{voice.text}&rdquo;</p>
                    <p className="text-[10px] text-muted-foreground mt-1">
                      {voice.reviewerId.slice(0, 12)}...
                      {voice.timestamp && (
                        <span className="ml-1">
                          {new Date(voice.timestamp).toLocaleDateString(undefined, {
                            month: 'short',
                            day: 'numeric',
                          })}
                        </span>
                      )}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Novel contributions */}
          {theme.novelContributions.length > 0 && (
            <div className="space-y-1.5">
              <h5 className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
                Novel Additions
              </h5>
              {theme.novelContributions.map((contrib, i) => (
                <div
                  key={i}
                  className="flex items-start gap-2 rounded-md bg-amber-500/5 border border-amber-500/10 px-2.5 py-2"
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-foreground/80">{contrib.text}</p>
                    <p className="text-[10px] text-muted-foreground mt-1">
                      {contrib.reviewerId.slice(0, 12)}...
                      {contrib.timestamp && (
                        <span className="ml-1">
                          {new Date(contrib.timestamp).toLocaleDateString(undefined, {
                            month: 'short',
                            day: 'numeric',
                          })}
                        </span>
                      )}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Addressed reason (if any) */}
          {isAddressed && theme.addressedReason && (
            <div className="rounded-md bg-muted/30 px-2.5 py-2">
              <p className="text-[10px] font-medium text-muted-foreground mb-0.5">
                Proposer&apos;s Response
              </p>
              <p className="text-xs text-foreground/80">{theme.addressedReason}</p>
            </div>
          )}

          {/* Linked annotations count */}
          {theme.linkedAnnotationIds.length > 0 && (
            <p className="text-[10px] text-muted-foreground">
              Based on {theme.linkedAnnotationIds.length} annotation
              {theme.linkedAnnotationIds.length !== 1 ? 's' : ''}
            </p>
          )}

          {/* Actions */}
          <div className="flex items-center gap-2 pt-1">
            {/* Reviewer: endorse button */}
            {!isProposer && !isAddressed && (
              <Button
                variant="outline"
                size="xs"
                onClick={handleEndorse}
                disabled={endorseMutation.isPending}
                className="gap-1"
              >
                <ThumbsUp className="h-3 w-3" />
                {endorseMutation.isPending ? 'Endorsing...' : '+1 Endorse'}
              </Button>
            )}

            {/* Proposer: address actions */}
            {isProposer && !isAddressed && (
              <>
                <Button
                  variant="outline"
                  size="xs"
                  onClick={() => handleAddress('addressed')}
                  disabled={addressMutation.isPending}
                  className="gap-1 text-emerald-600 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800"
                >
                  <Check className="h-3 w-3" />
                  Address
                </Button>
                <Button
                  variant="outline"
                  size="xs"
                  onClick={() => handleAddress('deferred')}
                  disabled={addressMutation.isPending}
                  className="gap-1"
                >
                  <Clock className="h-3 w-3" />
                  Defer
                </Button>
                <Button
                  variant="ghost"
                  size="xs"
                  onClick={() => handleAddress('dismissed')}
                  disabled={addressMutation.isPending}
                  className="gap-1 text-muted-foreground"
                >
                  <X className="h-3 w-3" />
                  Dismiss
                </Button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
