'use client';

/**
 * PeekBar — always-visible 40px hint bar on mobile (<1024px).
 *
 * Context-aware: shows warm messaging based on visit state instead of
 * generic rotating ghost prompts. Tapping opens the mobile intelligence
 * bottom sheet.
 *
 * Three states:
 * - First visit: "Find your representative in 60 seconds →"
 * - Returning: Dynamic narrative pulse or governance context
 * - Post-match: "Your top match: X (Y%) — delegate? →"
 *
 * Positioned fixed at the bottom, above the bottom nav bar.
 * Feature-flagged behind `governance_copilot`.
 */

import { motion, useReducedMotion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { useSenecaWarmth } from '@/hooks/useSenecaWarmth';
import { CompassSigil } from '@/components/governada/CompassSigil';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface PeekBarProps {
  /** Handler called when the bar is tapped / swiped up */
  onOpen: () => void;
  /** Handler called when a ghost prompt is tapped — opens sheet in conversation mode */
  onOpenWithPrompt?: (prompt: string) => void;
  /** Whether the sheet is currently open (hide bar when open) */
  isSheetOpen: boolean;
  /** Dynamic narrative pulse from the homepage API */
  narrativePulse?: string;
  /** Additional classes */
  className?: string;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function PeekBar({
  onOpen,
  onOpenWithPrompt,
  isSheetOpen,
  narrativePulse,
  className,
}: PeekBarProps) {
  const prefersReducedMotion = useReducedMotion();
  const { dockState, matchMemory } = useSenecaWarmth();

  if (isSheetOpen) return null;

  // Determine what text to show based on visit state
  let peekText: string;
  let peekAction: () => void;

  switch (dockState) {
    case 'post-match': {
      const topMatch = matchMemory?.topMatches[0];
      peekText = topMatch
        ? `Your match: ${topMatch.name} (${topMatch.score}%) — delegate? →`
        : 'See your matches →';
      peekAction = () => {
        if (onOpenWithPrompt) {
          onOpenWithPrompt('Show me my match results');
        } else {
          onOpen();
        }
      };
      break;
    }
    case 'returning': {
      peekText = narrativePulse || "What's new in governance →";
      peekAction = () => {
        if (onOpenWithPrompt && narrativePulse) {
          onOpenWithPrompt("What's happening in governance right now?");
        } else {
          onOpen();
        }
      };
      break;
    }
    default: {
      peekText = 'Find your representative in 60 seconds →';
      peekAction = () => {
        if (onOpenWithPrompt) {
          onOpenWithPrompt('Help me find my representative');
        } else {
          onOpen();
        }
      };
      break;
    }
  }

  return (
    <motion.div
      className={cn(
        'fixed left-0 right-0 z-40 lg:hidden',
        'h-11 flex items-center gap-2.5 px-3',
        'bg-background/70 backdrop-blur-xl',
        'border-t border-border/20',
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
    >
      {/* Left: Compass Sigil + warm context text */}
      <button
        type="button"
        onClick={peekAction}
        className="flex items-center gap-2.5 min-w-0 flex-1 text-left"
        aria-label={peekText}
      >
        <CompassSigil state="idle" size={16} />
        <span className="text-xs text-muted-foreground/70 truncate">{peekText}</span>
      </button>
    </motion.div>
  );
}
