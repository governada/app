'use client';

import { motion, useReducedMotion } from 'framer-motion';
import { useEffect, useRef } from 'react';
import { computeTier } from '@/lib/scoring/tiers';
import { TierBadge } from '@/components/governada/cards/TierBadge';
import { hapticMedium } from '@/lib/haptics';
import { spring } from '@/lib/animations';

interface TierStampProps {
  score: number;
  /** Delay before stamp animation (seconds) */
  delay?: number;
  /** Skip animation */
  immediate?: boolean;
  className?: string;
}

/**
 * Tier badge that stamps in with a scale-bounce animation + haptic feedback.
 */
export function TierStamp({ score, delay = 0, immediate = false, className }: TierStampProps) {
  const reducedMotion = useReducedMotion();
  const shouldAnimate = !immediate && !reducedMotion;
  const hapticFired = useRef(false);

  const tier = computeTier(score);

  // Fire haptic when animation reaches peak
  useEffect(() => {
    if (!shouldAnimate || hapticFired.current) return;

    const timeout = setTimeout(
      () => {
        hapticMedium();
        hapticFired.current = true;
      },
      delay * 1000 + 200,
    ); // ~200ms is when spring.bouncy overshoots to scale=1

    return () => clearTimeout(timeout);
  }, [shouldAnimate, delay]);

  // Reset haptic ref when score changes
  useEffect(() => {
    hapticFired.current = false;
  }, [score]);

  if (!shouldAnimate) {
    return (
      <div className={className}>
        <TierBadge tier={tier} />
      </div>
    );
  }

  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, scale: 0.3 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ ...spring.bouncy, delay }}
    >
      <TierBadge tier={tier} />
    </motion.div>
  );
}
