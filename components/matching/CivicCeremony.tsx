'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { Share2, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { GovernanceRings, type GovernanceRingsData } from '@/components/ui/GovernanceRings';

/* ─── Types ─────────────────────────────────────────────── */

export interface CivicCeremonyProps {
  drepName: string;
  matchPercentage: number;
  /** Formatted ADA amount, e.g. "12,345" */
  governancePower: string;
  onContinue: () => void;
  onShare: () => void;
}

/* ─── Constants ──────────────────────────────────────────── */

/** Initial rings data for a freshly transitioned citizen */
const CEREMONY_RINGS: GovernanceRingsData = {
  participation: 20,
  deliberation: 0,
  impact: 0,
};

/* ─── Ceremony sequence phases ───────────────────────────── */

type Phase = 'dim' | 'rings' | 'card' | 'done';

/* ─── Component ──────────────────────────────────────────── */

export function CivicCeremony({
  drepName,
  matchPercentage,
  governancePower,
  onContinue,
  onShare,
}: CivicCeremonyProps) {
  const prefersReducedMotion = useReducedMotion();
  const [phase, setPhase] = useState<Phase>(prefersReducedMotion ? 'card' : 'dim');

  // Sequence through phases with timers
  useEffect(() => {
    if (prefersReducedMotion) {
      setPhase('card');
      return;
    }

    // dim (200ms) → rings (800ms bloom) → card slides up
    const timers: ReturnType<typeof setTimeout>[] = [];

    timers.push(setTimeout(() => setPhase('rings'), 200));
    timers.push(setTimeout(() => setPhase('card'), 1200));

    return () => timers.forEach(clearTimeout);
  }, [prefersReducedMotion]);

  const handleContinue = useCallback(() => {
    setPhase('done');
    // Small delay for exit animation
    setTimeout(onContinue, 300);
  }, [onContinue]);

  const handleShare = useCallback(() => {
    onShare();
  }, [onShare]);

  // Phase: done — nothing rendered
  if (phase === 'done') return null;

  const showRings = phase === 'rings' || phase === 'card';
  const showCard = phase === 'card';

  return (
    <AnimatePresence>
      {/* Full-screen overlay backdrop */}
      <motion.div
        key="ceremony-backdrop"
        className="fixed inset-0 z-[100] flex items-center justify-center"
        initial={{ backgroundColor: 'rgba(0, 0, 0, 0)' }}
        animate={{ backgroundColor: 'rgba(0, 0, 0, 0.8)' }}
        exit={{ backgroundColor: 'rgba(0, 0, 0, 0)', transition: { duration: 0.3 } }}
        transition={{ duration: 0.2, ease: 'easeOut' }}
      >
        <div className="flex flex-col items-center gap-6 px-4 max-w-md w-full">
          {/* Governance Rings — bloom entrance */}
          {showRings && (
            <motion.div
              key="ceremony-rings"
              initial={prefersReducedMotion ? { opacity: 1 } : { opacity: 0, scale: 0.5 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={
                prefersReducedMotion
                  ? { duration: 0 }
                  : { type: 'spring', stiffness: 200, damping: 15, duration: 0.8 }
              }
            >
              <GovernanceRings
                data={CEREMONY_RINGS}
                size="hero"
                animate={true}
                entrance={prefersReducedMotion ? 'none' : 'bloom'}
              />
            </motion.div>
          )}

          {/* Civic Identity Card — slides up */}
          {showCard && (
            <motion.div
              key="ceremony-card"
              className="w-full rounded-2xl border border-border/50 bg-card/95 backdrop-blur-xl p-8 text-center shadow-2xl"
              initial={prefersReducedMotion ? { opacity: 1 } : { opacity: 0, y: 40 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 20, transition: { duration: 0.2 } }}
              transition={
                prefersReducedMotion
                  ? { duration: 0 }
                  : { type: 'spring', stiffness: 300, damping: 25, delay: 0.1 }
              }
            >
              {/* Civic title */}
              <h2 className="font-display text-3xl font-semibold text-foreground tracking-tight">
                Citizen
              </h2>

              {/* Representation info */}
              <p className="mt-3 text-sm text-muted-foreground">
                Represented by <span className="text-foreground font-medium">{drepName}</span>
                <span className="mx-1.5 text-muted-foreground/50">&middot;</span>
                <span className="text-primary font-medium">{matchPercentage}% match</span>
              </p>

              {/* Governance Power */}
              <div className="mt-4 inline-flex items-baseline gap-1.5">
                <span className="text-xs text-muted-foreground uppercase tracking-wider">
                  Governance Power
                </span>
              </div>
              <p className="text-2xl font-semibold text-foreground tabular-nums">
                <span className="text-primary">{'\u20B3'}</span>
                {governancePower}
              </p>

              {/* Tagline */}
              <p className="mt-4 text-sm text-muted-foreground/80 italic">
                Your voice in Cardano&apos;s future is now active.
              </p>

              {/* Action buttons */}
              <div className="mt-6 flex items-center justify-center gap-3">
                <Button variant="outline" size="sm" onClick={handleShare} className="gap-1.5">
                  <Share2 className="h-3.5 w-3.5" />
                  Share
                </Button>
                <Button size="sm" onClick={handleContinue} className="gap-1.5">
                  Continue to Hub
                  <ArrowRight className="h-3.5 w-3.5" />
                </Button>
              </div>
            </motion.div>
          )}
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
