'use client';

/**
 * EndorsementPrompt — shown when a reviewer's annotation overlaps
 * an existing feedback theme. Prompts: "Endorse (+1)" | "Add as new" | "Cancel"
 */

import { useState, useCallback } from 'react';
import { ThumbsUp, Plus, X, Users } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { useEndorseTheme } from '@/hooks/useFeedbackThemes';
import type { FeedbackTheme } from '@/lib/workspace/feedback/types';

interface EndorsementPromptProps {
  /** The overlapping theme to prompt endorsement for */
  theme: FeedbackTheme;
  /** The new annotation text that overlaps */
  annotationText: string;
  proposalTxHash: string;
  proposalIndex: number;
  /** Called when user chooses to endorse (annotation may be skipped) */
  onEndorse: () => void;
  /** Called when user chooses to add as a new annotation anyway */
  onAddNew: () => void;
  /** Called when user cancels */
  onCancel: () => void;
  className?: string;
}

export function EndorsementPrompt({
  theme,
  annotationText,
  proposalTxHash,
  proposalIndex,
  onEndorse,
  onAddNew,
  onCancel,
  className,
}: EndorsementPromptProps) {
  const [additionalContext, setAdditionalContext] = useState('');
  const endorseMutation = useEndorseTheme(proposalTxHash, proposalIndex);

  const handleEndorse = useCallback(() => {
    endorseMutation.mutate(
      {
        themeId: theme.id,
        additionalContext: additionalContext.trim() || annotationText,
      },
      {
        onSuccess: () => onEndorse(),
      },
    );
  }, [endorseMutation, theme.id, additionalContext, annotationText, onEndorse]);

  return (
    <div
      className={cn(
        'rounded-lg border border-indigo-500/30 bg-indigo-500/5 p-4 space-y-3',
        className,
      )}
    >
      {/* Header */}
      <div className="flex items-start gap-2">
        <Users className="mt-0.5 h-4 w-4 shrink-0 text-indigo-500" />
        <div className="space-y-1">
          <p className="text-sm font-medium text-foreground">Similar feedback already raised</p>
          <p className="text-xs text-muted-foreground">
            Your note is similar to feedback from {theme.endorsementCount} other reviewer
            {theme.endorsementCount !== 1 ? 's' : ''}. Endorse the existing theme instead?
          </p>
        </div>
      </div>

      {/* Existing theme preview */}
      <div className="rounded-md bg-muted/30 px-3 py-2">
        <p className="text-xs font-medium text-muted-foreground mb-0.5 uppercase tracking-wider">
          Existing theme
        </p>
        <p className="text-sm text-foreground/90">{theme.summary}</p>
        <p className="text-[10px] text-muted-foreground mt-1">
          {theme.endorsementCount} endorsement{theme.endorsementCount !== 1 ? 's' : ''}
        </p>
      </div>

      {/* Optional additional context */}
      <div>
        <label
          htmlFor="endorsement-context"
          className="text-[10px] font-medium text-muted-foreground block mb-1"
        >
          Add specific detail (optional — may be surfaced as a novel contribution)
        </label>
        <textarea
          id="endorsement-context"
          className="w-full rounded-md border border-border bg-background px-2.5 py-1.5 text-xs placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-ring resize-none"
          rows={2}
          placeholder="e.g., Especially the 200K 'operations' line — compare to Proposal #231"
          value={additionalContext}
          onChange={(e) => setAdditionalContext(e.target.value)}
          maxLength={2000}
        />
      </div>

      {/* Action buttons */}
      <div className="flex items-center gap-2">
        <Button
          variant="default"
          size="sm"
          onClick={handleEndorse}
          disabled={endorseMutation.isPending}
          className="gap-1"
        >
          <ThumbsUp className="h-3.5 w-3.5" />
          {endorseMutation.isPending ? 'Endorsing...' : 'Endorse (+1)'}
        </Button>
        <Button variant="outline" size="sm" onClick={onAddNew} className="gap-1">
          <Plus className="h-3.5 w-3.5" />
          Add as new
        </Button>
        <Button variant="ghost" size="sm" onClick={onCancel} className="gap-1">
          <X className="h-3.5 w-3.5" />
          Cancel
        </Button>
      </div>

      {/* Error state */}
      {endorseMutation.error && (
        <p className="text-xs text-destructive">{endorseMutation.error.message}</p>
      )}
    </div>
  );
}
