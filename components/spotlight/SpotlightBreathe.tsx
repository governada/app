'use client';

import { motion, useReducedMotion } from 'framer-motion';
import { Sparkles, ArrowRight } from 'lucide-react';
import { fadeInUp } from '@/lib/animations';

interface SpotlightBreatheProps {
  trackedCount: number;
  onCompare: () => void;
  onContinue: () => void;
}

/**
 * Breathe point shown every N entities in the spotlight queue.
 * "You've tracked 4 DReps. Want to compare them?"
 */
export function SpotlightBreathe({ trackedCount, onCompare, onContinue }: SpotlightBreatheProps) {
  const reducedMotion = useReducedMotion();

  return (
    <motion.div
      className="mx-auto flex max-w-lg flex-col items-center gap-5 rounded-2xl border border-primary/10 bg-card/60 px-8 py-10 text-center backdrop-blur-md"
      variants={reducedMotion ? undefined : fadeInUp}
      initial="hidden"
      animate="visible"
    >
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
        <Sparkles className="h-6 w-6 text-primary" />
      </div>

      <div className="space-y-2">
        <h3 className="text-lg font-semibold">Nice work exploring!</h3>
        {trackedCount > 0 ? (
          <p className="text-sm text-muted-foreground">
            You&apos;ve tracked {trackedCount}{' '}
            {trackedCount === 1 ? 'representative' : 'representatives'}.
            {trackedCount >= 2
              ? ' Want to compare them side by side?'
              : ' Keep exploring to find more.'}
          </p>
        ) : (
          <p className="text-sm text-muted-foreground">
            Take a moment to breathe. Track the ones that interest you to build your shortlist.
          </p>
        )}
      </div>

      <div className="flex items-center gap-3">
        {trackedCount >= 2 && (
          <button
            onClick={onCompare}
            className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Compare tracked
          </button>
        )}
        <button
          onClick={onContinue}
          className="flex items-center gap-1.5 rounded-lg border border-border/50 px-4 py-2 text-sm font-medium text-muted-foreground transition-colors hover:border-border hover:text-foreground"
        >
          Keep exploring
          <ArrowRight className="h-3.5 w-3.5" />
        </button>
      </div>
    </motion.div>
  );
}
