'use client';

/**
 * SenecaAnnotation — Ambient contextual insight that appears inline on pages.
 *
 * Renders as a subtle, dismissible badge with Seneca branding.
 * Non-blocking, lazily loaded, session-dismissible.
 */

import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { X, TrendingUp, TrendingDown, Vote, UserCheck, Sparkles } from 'lucide-react';
import { CompassSigil } from '@/components/governada/CompassSigil';
import { cn } from '@/lib/utils';
import type { SenecaAnnotationData } from '@/app/api/intelligence/annotations/route';

interface SenecaAnnotationProps {
  annotation: SenecaAnnotationData;
  onDismiss: (id: string) => void;
  className?: string;
}

const TYPE_ICONS: Record<SenecaAnnotationData['type'], typeof TrendingUp> = {
  alignment_drift: TrendingDown,
  vote_context: Vote,
  score_change: TrendingUp,
  delegation_nudge: UserCheck,
};

const VARIANT_STYLES: Record<
  SenecaAnnotationData['variant'],
  { border: string; bg: string; text: string }
> = {
  info: {
    border: 'border-sky-500/20',
    bg: 'bg-sky-500/5',
    text: 'text-sky-400/80',
  },
  warning: {
    border: 'border-amber-500/20',
    bg: 'bg-amber-500/5',
    text: 'text-amber-400/80',
  },
  success: {
    border: 'border-emerald-500/20',
    bg: 'bg-emerald-500/5',
    text: 'text-emerald-400/80',
  },
  neutral: {
    border: 'border-white/[0.08]',
    bg: 'bg-white/[0.02]',
    text: 'text-muted-foreground/70',
  },
};

export function SenecaAnnotation({ annotation, onDismiss, className }: SenecaAnnotationProps) {
  const prefersReducedMotion = useReducedMotion();
  const Icon = TYPE_ICONS[annotation.type] ?? Sparkles;
  const styles = VARIANT_STYLES[annotation.variant];

  return (
    <AnimatePresence>
      <motion.div
        key={annotation.id}
        initial={prefersReducedMotion ? { opacity: 1 } : { opacity: 0, y: 4 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -4 }}
        transition={{ duration: 0.2 }}
        className={cn(
          'flex items-center gap-2 px-3 py-2 rounded-xl border',
          styles.border,
          styles.bg,
          'backdrop-blur-sm',
          className,
        )}
      >
        <CompassSigil state="idle" size={12} />
        <Icon className={cn('h-3.5 w-3.5 shrink-0', styles.text)} />
        <span className={cn('text-xs leading-relaxed flex-1', styles.text)}>{annotation.text}</span>
        <button
          type="button"
          onClick={() => onDismiss(annotation.id)}
          className="p-0.5 rounded text-muted-foreground/30 hover:text-muted-foreground/60 transition-colors shrink-0"
          aria-label="Dismiss annotation"
        >
          <X className="h-3 w-3" />
        </button>
      </motion.div>
    </AnimatePresence>
  );
}

/**
 * SenecaAnnotationStack — Renders a list of annotations vertically.
 * Use this on pages where multiple annotations may apply.
 */
export function SenecaAnnotationStack({
  annotations,
  onDismiss,
  className,
}: {
  annotations: SenecaAnnotationData[];
  onDismiss: (id: string) => void;
  className?: string;
}) {
  if (annotations.length === 0) return null;

  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      {annotations.map((a) => (
        <SenecaAnnotation key={a.id} annotation={a} onDismiss={onDismiss} />
      ))}
    </div>
  );
}
