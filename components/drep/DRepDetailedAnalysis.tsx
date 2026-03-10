'use client';

import { useState, type ReactNode } from 'react';
import { ChevronDown } from 'lucide-react';
import { useSegment } from '@/components/providers/SegmentProvider';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface DRepDetailedAnalysisProps {
  children: ReactNode;
}

/**
 * Progressive disclosure gate for DRep profile analytics sections.
 *
 * - Citizens and anonymous users see a collapsed "Show detailed analysis" toggle.
 * - DReps, SPOs, CC members, and researchers see everything expanded by default.
 *
 * This keeps the citizen experience focused on summary intelligence while
 * preserving full depth for governance participants who need it.
 */
export function DRepDetailedAnalysis({ children }: DRepDetailedAnalysisProps) {
  const { segment, isLoading } = useSegment();

  // DReps, SPOs, and CC members see everything expanded
  const isDetailedSegment = segment === 'drep' || segment === 'spo' || segment === 'cc';

  const [expanded, setExpanded] = useState(isDetailedSegment);

  // For detailed segments, always render expanded (no gate)
  if (isDetailedSegment) {
    return <>{children}</>;
  }

  // While loading segment, render nothing to avoid flash of collapsed → expanded
  if (isLoading) {
    return null;
  }

  // Citizens and anonymous users get the collapsible gate
  return (
    <div className="space-y-4">
      {!expanded && (
        <div className="flex justify-center py-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setExpanded(true)}
            className="gap-2 text-muted-foreground hover:text-foreground"
          >
            <span>Show detailed analysis</span>
            <ChevronDown className="h-4 w-4" />
          </Button>
        </div>
      )}

      <div
        className={cn(
          'transition-all duration-300 ease-in-out',
          expanded ? 'opacity-100' : 'max-h-0 overflow-hidden opacity-0',
        )}
      >
        {/* Only mount children when expanded to avoid unnecessary data fetching */}
        {expanded && <div className="space-y-6">{children}</div>}
      </div>

      {expanded && (
        <div className="flex justify-center py-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setExpanded(false)}
            className="gap-2 text-xs text-muted-foreground"
          >
            <span>Hide detailed analysis</span>
            <ChevronDown className="h-4 w-4 rotate-180" />
          </Button>
        </div>
      )}
    </div>
  );
}
