'use client';

import { type ReactNode, useState, useCallback } from 'react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { getGlossaryEntry } from '@/lib/glossary';

interface GovTermProps {
  /** The glossary key to look up (case-insensitive) */
  term: string;
  /** Override display text (defaults to the term itself) */
  children?: ReactNode;
}

/**
 * Inline governance term with a tooltip definition.
 * Desktop: hover to show. Mobile: tap to toggle.
 * Renders a dotted underline to hint it's interactive.
 */
export function GovTerm({ term, children }: GovTermProps) {
  const entry = getGlossaryEntry(term);
  const [open, setOpen] = useState(false);

  const handleTap = useCallback(() => {
    setOpen((prev) => !prev);
  }, []);

  if (!entry) {
    return <span>{children ?? term}</span>;
  }

  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip open={open} onOpenChange={setOpen}>
        <TooltipTrigger asChild>
          <button
            type="button"
            onClick={handleTap}
            className="underline decoration-dotted decoration-muted-foreground/50 underline-offset-2 text-inherit font-inherit cursor-help inline"
          >
            {children ?? term}
          </button>
        </TooltipTrigger>
        <TooltipContent side="top" className="max-w-[280px]">
          <p className="text-xs leading-relaxed">{entry.definition}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
