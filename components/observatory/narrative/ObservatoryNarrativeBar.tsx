'use client';

/**
 * ObservatoryNarrativeBar — AI-generated one-paragraph governance briefing.
 *
 * Streams a unified narrative synthesizing Treasury, Committee, and Health
 * intelligence into a single, readable paragraph. This replaces three separate
 * hero sections with one interpretive voice.
 */

import { useQuery } from '@tanstack/react-query';
import { motion, useReducedMotion } from 'framer-motion';
import { Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Skeleton } from '@/components/ui/skeleton';

interface ObservatoryNarrativeBarProps {
  epoch: number;
  className?: string;
}

interface NarrativeResponse {
  unified: string;
  generatedAt: string;
}

export function ObservatoryNarrativeBar({ epoch, className }: ObservatoryNarrativeBarProps) {
  const prefersReducedMotion = useReducedMotion();

  const { data, isLoading, error } = useQuery<NarrativeResponse>({
    queryKey: ['observatory-narrative', epoch],
    queryFn: async () => {
      const res = await fetch(`/api/observatory/narrative?epoch=${epoch}`);
      if (!res.ok) throw new Error(`${res.status}`);
      return res.json();
    },
    staleTime: 5 * 60_000, // 5 min
    enabled: epoch > 0,
    retry: 1,
  });

  if (error && !data) {
    // Silently degrade — narrative is enhancement, not critical
    return null;
  }

  return (
    <div className={cn('px-4 py-3', className)}>
      <motion.div
        className="rounded-xl border border-border/20 bg-card/40 backdrop-blur-md px-4 py-3"
        initial={prefersReducedMotion ? undefined : { opacity: 0, y: 4 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
      >
        <div className="flex items-start gap-2.5">
          <Sparkles className="w-3.5 h-3.5 mt-0.5 shrink-0 text-primary/60" />
          <div className="flex-1 min-w-0">
            {isLoading ? (
              <div className="space-y-1.5">
                <Skeleton className="h-3.5 w-full" />
                <Skeleton className="h-3.5 w-4/5" />
              </div>
            ) : data?.unified ? (
              <p className="text-sm leading-relaxed text-foreground/80">{data.unified}</p>
            ) : (
              <NarrativeFallback epoch={epoch} />
            )}
          </div>
        </div>
      </motion.div>
    </div>
  );
}

/**
 * Template-based fallback when AI narrative is unavailable.
 * Uses data already fetched by the panels to construct a basic narrative.
 */
function NarrativeFallback({ epoch }: { epoch: number }) {
  return (
    <p className="text-sm leading-relaxed text-muted-foreground/70 italic">
      Governance Observatory — Epoch {epoch}. Expand any panel to explore the details.
    </p>
  );
}
