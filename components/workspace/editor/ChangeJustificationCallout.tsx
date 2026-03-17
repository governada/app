'use client';

/**
 * ChangeJustificationCallout — small callout card rendered next to each diff block.
 *
 * Displays the proposer's justification text, linked feedback theme (if any),
 * and timestamp. Uses muted styling so it doesn't visually dominate the diff.
 */

import type { ChangeJustification } from '@/lib/workspace/revision/types';
import { cn } from '@/lib/utils';
import { MessageSquareText, Link2 } from 'lucide-react';

interface ChangeJustificationCalloutProps {
  /** The justification data for this section change */
  justification: ChangeJustification;
  /** When the revision was submitted */
  timestamp?: string;
  /** Optional: the linked feedback theme summary (if the theme was resolved) */
  linkedThemeSummary?: string;
  /** Optional: the endorsement count on the linked theme */
  linkedThemeEndorsements?: number;
  /** Additional CSS classes */
  className?: string;
}

export function ChangeJustificationCallout({
  justification,
  timestamp,
  linkedThemeSummary,
  linkedThemeEndorsements,
  className,
}: ChangeJustificationCalloutProps) {
  return (
    <div
      className={cn('rounded-md border border-border/40 bg-muted/30 px-3 py-2 text-xs', className)}
    >
      {/* Justification text */}
      <div className="flex items-start gap-1.5">
        <MessageSquareText className="h-3.5 w-3.5 mt-0.5 shrink-0 text-muted-foreground" />
        <p className="text-muted-foreground leading-relaxed">{justification.justification}</p>
      </div>

      {/* Linked feedback theme */}
      {justification.linkedThemeId && linkedThemeSummary && (
        <div className="mt-1.5 flex items-start gap-1.5 pl-5">
          <Link2 className="h-3 w-3 mt-0.5 shrink-0 text-blue-400" />
          <div className="text-[11px] text-muted-foreground">
            <span className="text-blue-400">Addresses feedback:</span>{' '}
            <span className="italic">{linkedThemeSummary}</span>
            {linkedThemeEndorsements != null && linkedThemeEndorsements > 0 && (
              <span className="ml-1 text-muted-foreground/70">
                ({linkedThemeEndorsements} endorsement
                {linkedThemeEndorsements === 1 ? '' : 's'})
              </span>
            )}
          </div>
        </div>
      )}

      {/* Timestamp */}
      {timestamp && (
        <p className="mt-1 pl-5 text-[10px] text-muted-foreground/50">
          {new Date(timestamp).toLocaleString()}
        </p>
      )}
    </div>
  );
}
