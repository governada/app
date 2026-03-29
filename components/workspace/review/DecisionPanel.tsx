'use client';

import { useState, useCallback, type ReactNode } from 'react';
import {
  CheckCircle2,
  XCircle,
  MinusCircle,
  Loader2,
  Sparkles,
  ChevronDown,
  ChevronRight,
  Shield,
  FileSearch,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { posthog } from '@/lib/posthog';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface DecisionPanelProps {
  /** Current user's selected vote */
  selectedVote: 'Yes' | 'No' | 'Abstain' | null;
  onVoteChange: (vote: 'Yes' | 'No' | 'Abstain') => void;
  onSubmit: () => void;
  isSubmitting: boolean;
  /** Whether the user has already voted on this proposal */
  hasVoted: boolean;
  currentVoteChoice: string | null;
  /** Rationale */
  rationale: string;
  onRationaleChange: (text: string) => void;
  onAIDraft: () => void;
  isDraftingRationale: boolean;
  /** Context */
  proposalTitle: string;
  voterId: string;
  voterRole: string;
  /** Intelligence content (rendered as accordion sections) */
  intelContent?: ReactNode;
}

// ---------------------------------------------------------------------------
// Vote selector
// ---------------------------------------------------------------------------

const VOTE_OPTIONS: Array<{
  value: 'Yes' | 'No' | 'Abstain';
  label: string;
  Icon: typeof CheckCircle2;
  activeColor: string;
  hoverColor: string;
}> = [
  {
    value: 'Yes',
    label: 'Yes',
    Icon: CheckCircle2,
    activeColor: 'text-teal-400 border-teal-500/50 bg-teal-500/10',
    hoverColor: 'hover:border-teal-500/30',
  },
  {
    value: 'No',
    label: 'No',
    Icon: XCircle,
    activeColor: 'text-amber-500 border-amber-600/50 bg-amber-600/10',
    hoverColor: 'hover:border-amber-600/30',
  },
  {
    value: 'Abstain',
    label: 'Abstain',
    Icon: MinusCircle,
    activeColor: 'text-zinc-400 border-zinc-500/50 bg-zinc-500/10',
    hoverColor: 'hover:border-zinc-500/30',
  },
];

const MAX_RATIONALE = 5000;

// ---------------------------------------------------------------------------
// Collapsible section for intelligence
// ---------------------------------------------------------------------------

function IntelSection({
  title,
  icon: Icon,
  children,
  defaultOpen = false,
}: {
  title: string;
  icon: typeof Shield;
  children: ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className="border-t border-border/30">
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className="flex items-center gap-2 w-full px-3 py-2 text-left text-xs text-muted-foreground hover:text-foreground transition-colors"
      >
        <Icon className="h-3.5 w-3.5" />
        <span className="font-medium">{title}</span>
        {open ? (
          <ChevronDown className="h-3 w-3 ml-auto" />
        ) : (
          <ChevronRight className="h-3 w-3 ml-auto" />
        )}
      </button>
      {open && <div className="px-3 pb-3">{children}</div>}
    </div>
  );
}

// ---------------------------------------------------------------------------
// DecisionPanel — always-visible right panel for vote decisions
// ---------------------------------------------------------------------------

export function DecisionPanel({
  selectedVote,
  onVoteChange,
  onSubmit,
  isSubmitting,
  hasVoted,
  currentVoteChoice,
  rationale,
  onRationaleChange,
  onAIDraft,
  isDraftingRationale,
  proposalTitle,
  voterId,
  voterRole,
  intelContent,
}: DecisionPanelProps) {
  const charCount = rationale.length;

  const handleVoteSelect = useCallback(
    (vote: 'Yes' | 'No' | 'Abstain') => {
      onVoteChange(vote);
      posthog.capture('decision_panel_vote_selected', { vote });
    },
    [onVoteChange],
  );

  return (
    <div className="flex flex-col h-full overflow-y-auto">
      {/* Header */}
      <div className="shrink-0 px-3 pt-3 pb-2 border-b border-border/30">
        <h3 className="text-xs font-semibold text-foreground">Your Decision</h3>
        <p className="text-[10px] text-muted-foreground truncate mt-0.5">{proposalTitle}</p>
        <p className="text-[10px] text-muted-foreground/60">
          {voterRole} &middot; {voterId.slice(0, 12)}...
        </p>
      </div>

      {/* Already voted banner */}
      {hasVoted && currentVoteChoice && (
        <div className="shrink-0 mx-3 mt-2 rounded-md border border-emerald-500/30 bg-emerald-500/10 px-3 py-2">
          <div className="flex items-center gap-2 text-xs">
            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
            <span className="font-medium text-emerald-400">Voted: {currentVoteChoice}</span>
          </div>
        </div>
      )}

      {/* Vote selector */}
      {!hasVoted && (
        <div className="shrink-0 px-3 pt-3 space-y-2">
          <label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">
            Vote
          </label>
          <div className="flex gap-1.5">
            {VOTE_OPTIONS.map(({ value, label, Icon, activeColor, hoverColor }) => (
              <button
                key={value}
                onClick={() => handleVoteSelect(value)}
                className={cn(
                  'flex-1 flex items-center justify-center gap-1.5 px-2 py-2 text-xs rounded border transition-colors cursor-pointer',
                  selectedVote === value
                    ? activeColor
                    : `text-muted-foreground border-border ${hoverColor}`,
                )}
              >
                <Icon className="h-3.5 w-3.5" />
                {label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Rationale */}
      {!hasVoted && (
        <div className="shrink-0 px-3 pt-3 space-y-1.5">
          <div className="flex items-center justify-between">
            <label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">
              Rationale
            </label>
            <button
              onClick={onAIDraft}
              disabled={isDraftingRationale}
              className={cn(
                'flex items-center gap-1 px-2 py-0.5 text-[10px] font-medium rounded border transition-colors cursor-pointer',
                isDraftingRationale
                  ? 'opacity-50 cursor-not-allowed border-border text-muted-foreground'
                  : 'border-primary/30 text-primary hover:bg-primary/10',
              )}
            >
              {isDraftingRationale ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <Sparkles className="h-3 w-3" />
              )}
              AI Draft
            </button>
          </div>
          <textarea
            value={rationale}
            onChange={(e) => onRationaleChange(e.target.value)}
            placeholder="Explain your reasoning..."
            rows={4}
            className="w-full rounded-md border border-border bg-muted/20 px-2.5 py-2 text-xs text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:ring-1 focus:ring-primary/50 resize-none"
          />
          <div className="flex items-center justify-between text-[10px]">
            <span className="text-muted-foreground/50">Published on-chain (CIP-100)</span>
            <span
              className={cn(
                'tabular-nums',
                charCount > MAX_RATIONALE ? 'text-red-400' : 'text-muted-foreground/50',
              )}
            >
              {charCount.toLocaleString()}/{MAX_RATIONALE.toLocaleString()}
            </span>
          </div>

          {/* Submit */}
          <button
            onClick={onSubmit}
            disabled={isSubmitting || !selectedVote}
            className={cn(
              'w-full flex items-center justify-center gap-2 px-3 py-2 rounded-md text-xs font-medium transition-colors cursor-pointer mt-1',
              selectedVote
                ? 'bg-primary text-primary-foreground hover:bg-primary/90'
                : 'bg-muted text-muted-foreground cursor-not-allowed',
              isSubmitting && 'opacity-60 cursor-not-allowed',
            )}
          >
            {isSubmitting ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                Submitting...
              </>
            ) : (
              'Submit Vote'
            )}
          </button>
        </div>
      )}

      {/* Intelligence accordion — scrollable area */}
      <div className="flex-1 mt-3 overflow-y-auto">
        {intelContent && (
          <IntelSection title="Intelligence" icon={FileSearch} defaultOpen>
            {intelContent}
          </IntelSection>
        )}
      </div>
    </div>
  );
}
