'use client';

import { useState } from 'react';
import { Brain, ChevronDown, ChevronRight } from 'lucide-react';

interface SenecaSummaryProps {
  summary: string | null;
}

export function SenecaSummary({ summary }: SenecaSummaryProps) {
  const [expanded, setExpanded] = useState(true);

  if (!summary) return null;

  return (
    <div className="rounded-lg border border-[var(--compass-teal)]/20 bg-[var(--compass-teal)]/5 mb-4 overflow-hidden">
      <button
        type="button"
        onClick={() => setExpanded((prev) => !prev)}
        className="flex items-center gap-2 w-full px-4 py-2.5 text-left hover:bg-[var(--compass-teal)]/10 transition-colors"
      >
        <Brain className="h-4 w-4 text-[var(--compass-teal)]" />
        <span className="text-xs font-medium text-[var(--compass-teal)]">Seneca Summary</span>
        {expanded ? (
          <ChevronDown className="h-3.5 w-3.5 text-[var(--compass-teal)]/60 ml-auto" />
        ) : (
          <ChevronRight className="h-3.5 w-3.5 text-[var(--compass-teal)]/60 ml-auto" />
        )}
      </button>

      {expanded && (
        <div className="px-4 pb-3 text-sm text-foreground/80 leading-relaxed">{summary}</div>
      )}
    </div>
  );
}
