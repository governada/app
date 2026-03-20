'use client';

import { useState } from 'react';
import { X, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface TriageInsight {
  /** Short sentence describing what needs attention */
  text: string;
  /** Priority: higher = show first */
  priority: number;
}

interface TriageSummaryProps {
  insights: TriageInsight[];
  className?: string;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function TriageSummary({ insights, className }: TriageSummaryProps) {
  const [dismissed, setDismissed] = useState(false);

  // Sort by priority (highest first) and take top 2
  const topInsights = insights
    .filter((i) => i.text.length > 0)
    .sort((a, b) => b.priority - a.priority)
    .slice(0, 2);

  if (dismissed || topInsights.length === 0) return null;

  return (
    <div
      className={cn(
        'flex items-start gap-2.5 rounded-lg bg-accent/50 px-3 py-2.5 text-sm',
        className,
      )}
    >
      <Sparkles className="h-4 w-4 text-[var(--compass-teal)] shrink-0 mt-0.5" />
      <p className="flex-1 text-muted-foreground leading-relaxed">
        {topInsights.map((insight, i) => (
          <span key={i}>
            {i > 0 && ' '}
            {insight.text}
          </span>
        ))}
      </p>
      <button
        onClick={() => setDismissed(true)}
        className="shrink-0 p-0.5 rounded text-muted-foreground/50 hover:text-muted-foreground transition-colors"
        aria-label="Dismiss summary"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}
