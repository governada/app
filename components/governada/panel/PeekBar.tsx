'use client';

/**
 * PeekBar — always-visible 40px hint bar on mobile (<1024px).
 *
 * Shows a 1-line context hint from governance state data (e.g.,
 * "3 active proposals · 42% epoch progress"). Tapping opens the
 * mobile intelligence bottom sheet.
 *
 * Positioned fixed at the bottom, above the bottom nav bar.
 * Subtle glassmorphic styling matching the app.
 *
 * Feature-flagged behind `governance_copilot`.
 */

import { useMemo } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { ChevronUp, Zap } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useQuery } from '@tanstack/react-query';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface PeekBarProps {
  /** Handler called when the bar is tapped / swiped up */
  onOpen: () => void;
  /** Whether the sheet is currently open (hide bar when open) */
  isSheetOpen: boolean;
  /** Additional classes */
  className?: string;
}

interface GovernanceStateResponse {
  urgency: number;
  temperature: number;
  epoch: {
    currentEpoch: number;
    progress: number;
    remainingSeconds: number;
    activeProposalCount: number;
  };
  userState: {
    delegatedDrepId: string | null;
    pendingVotes: number;
    hasPendingActions: boolean;
    drepScore: number | null;
    drepRank: number | null;
  } | null;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function buildHintText(data: GovernanceStateResponse | undefined): string {
  if (!data) return 'Governance intelligence loading...';

  const parts: string[] = [];

  // Active proposals count
  if (data.epoch.activeProposalCount > 0) {
    const count = data.epoch.activeProposalCount;
    parts.push(`${count} active proposal${count === 1 ? '' : 's'}`);
  }

  // User-specific hints
  if (data.userState) {
    if (data.userState.pendingVotes > 0) {
      parts.push(
        `${data.userState.pendingVotes} pending vote${data.userState.pendingVotes === 1 ? '' : 's'}`,
      );
    }
    if (data.userState.delegatedDrepId) {
      parts.push('DRep delegated');
    }
  }

  // Epoch progress
  const epochPct = Math.round(data.epoch.progress * 100);
  if (epochPct > 0) {
    parts.push(`Epoch ${epochPct}%`);
  }

  if (parts.length === 0) {
    return 'Governance is quiet';
  }

  // Show up to 2 parts for brevity in the bar
  return parts.slice(0, 2).join(' \u00B7 ');
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function PeekBar({ onOpen, isSheetOpen, className }: PeekBarProps) {
  const prefersReducedMotion = useReducedMotion();

  const { data } = useQuery<GovernanceStateResponse>({
    queryKey: ['governance-state-peek'],
    queryFn: async () => {
      const res = await fetch('/api/intelligence/governance-state');
      if (!res.ok) throw new Error('Failed to fetch governance state');
      return res.json();
    },
    staleTime: 60_000,
    refetchInterval: 120_000,
  });

  const hintText = useMemo(() => buildHintText(data), [data]);

  // Urgency indicator (subtle tint)
  const urgencyColor = useMemo(() => {
    if (!data) return 'text-muted-foreground';
    if (data.urgency >= 70) return 'text-amber-400';
    if (data.urgency >= 40) return 'text-primary/80';
    return 'text-muted-foreground';
  }, [data]);

  if (isSheetOpen) return null;

  return (
    <motion.button
      type="button"
      onClick={onOpen}
      className={cn(
        // Fixed at bottom, above bottom nav (bottom-nav is typically 64px)
        'fixed left-0 right-0 z-40 lg:hidden',
        'h-10 flex items-center justify-between gap-2 px-4',
        // Glassmorphic
        'bg-background/70 backdrop-blur-xl',
        'border-t border-border/20',
        // Safe area
        'pb-[env(safe-area-inset-bottom)]',
        className,
      )}
      style={{
        bottom: 'calc(64px + env(safe-area-inset-bottom, 0px))',
      }}
      initial={prefersReducedMotion ? false : { y: 40, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{
        duration: prefersReducedMotion ? 0 : 0.3,
        ease: [0.16, 1, 0.3, 1],
      }}
      aria-label="Open governance intelligence panel"
    >
      {/* Left: context hint */}
      <div className="flex items-center gap-2 min-w-0 flex-1">
        <Zap className={cn('h-3.5 w-3.5 shrink-0', urgencyColor)} />
        <span className="text-xs text-muted-foreground truncate">{hintText}</span>
      </div>

      {/* Right: expand indicator */}
      <ChevronUp className="h-3.5 w-3.5 shrink-0 text-muted-foreground/50" />
    </motion.button>
  );
}
