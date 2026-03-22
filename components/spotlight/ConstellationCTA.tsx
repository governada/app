'use client';

import { motion, useReducedMotion } from 'framer-motion';
import { Globe2, ArrowRight } from 'lucide-react';
import { fadeInUp } from '@/lib/animations';

interface ConstellationCTAProps {
  trackedCount: number;
  onClick: () => void;
}

/**
 * "See where your picks sit in the governance universe →"
 * Appears after tracking 3+ entities in spotlight mode.
 */
export function ConstellationCTA({ trackedCount, onClick }: ConstellationCTAProps) {
  const reducedMotion = useReducedMotion();

  return (
    <motion.button
      onClick={onClick}
      className="group flex w-full items-center gap-3 rounded-xl border border-primary/20 bg-primary/5 px-5 py-4 text-left transition-colors hover:border-primary/40 hover:bg-primary/10"
      variants={reducedMotion ? undefined : fadeInUp}
      initial={reducedMotion ? undefined : 'hidden'}
      animate="visible"
    >
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10">
        <Globe2 className="h-5 w-5 text-primary" />
      </div>

      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-foreground">
          See where your {trackedCount} picks sit in the governance universe
        </p>
        <p className="text-xs text-muted-foreground">
          Explore the 3D constellation — your tracked representatives will pulse
        </p>
      </div>

      <ArrowRight className="h-4 w-4 shrink-0 text-primary/60 transition-transform group-hover:translate-x-0.5" />
    </motion.button>
  );
}
