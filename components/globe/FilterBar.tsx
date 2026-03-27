'use client';

/**
 * FilterBar — Entity type filter chips + sort dropdown for the globe list.
 *
 * Renders horizontally above the list overlay. Filter selection syncs with
 * URL state and dims non-matching globe nodes.
 */

import { cn } from '@/lib/utils';
import { Users, FileText, Server, Shield, ArrowUpDown } from 'lucide-react';
import type { GlobeFilter } from '@/lib/globe/urlState';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type SortMode = 'score' | 'activity' | 'recent';

interface FilterBarProps {
  activeFilter: GlobeFilter | null;
  onFilterChange: (filter: GlobeFilter | null) => void;
  sort: SortMode;
  onSortChange: (sort: SortMode) => void;
  counts?: {
    dreps?: number;
    proposals?: number;
    spos?: number;
    cc?: number;
  };
}

// ---------------------------------------------------------------------------
// Filter chip definitions
// ---------------------------------------------------------------------------

const FILTER_CHIPS: {
  value: GlobeFilter;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}[] = [
  { value: 'dreps', label: 'DReps', icon: Users },
  { value: 'proposals', label: 'Proposals', icon: FileText },
  { value: 'spos', label: 'Pools', icon: Server },
  { value: 'cc', label: 'Committee', icon: Shield },
];

const SORT_OPTIONS: { value: SortMode; label: string }[] = [
  { value: 'score', label: 'Score' },
  { value: 'activity', label: 'Activity' },
  { value: 'recent', label: 'Recent' },
];

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function FilterBar({
  activeFilter,
  onFilterChange,
  sort,
  onSortChange,
  counts,
}: FilterBarProps) {
  return (
    <div className="flex items-center gap-1.5 px-3 py-2">
      {/* Filter chips */}
      <div className="flex items-center gap-1 flex-1 overflow-x-auto scrollbar-none">
        {FILTER_CHIPS.map(({ value, label, icon: Icon }) => {
          const isActive = activeFilter === value;
          const count =
            counts?.[
              value === 'proposals'
                ? 'proposals'
                : value === 'dreps'
                  ? 'dreps'
                  : value === 'spos'
                    ? 'spos'
                    : 'cc'
            ];

          return (
            <button
              key={value}
              onClick={() => onFilterChange(isActive ? null : value)}
              className={cn(
                'flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium transition-all duration-150 shrink-0',
                'focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary/50',
                isActive
                  ? 'bg-white/15 text-foreground ring-1 ring-white/10'
                  : 'text-muted-foreground hover:text-foreground hover:bg-white/[0.06]',
              )}
            >
              <Icon className="h-3 w-3" />
              <span>{label}</span>
              {count != null && (
                <span
                  className={cn(
                    'text-[10px] tabular-nums',
                    isActive ? 'text-foreground/70' : 'text-muted-foreground/60',
                  )}
                >
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Sort dropdown */}
      <div className="relative shrink-0">
        <button
          className={cn(
            'flex items-center gap-1 px-2 py-1 rounded-lg text-xs text-muted-foreground',
            'hover:text-foreground hover:bg-white/[0.06] transition-colors',
            'focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary/50',
          )}
          onClick={() => {
            // Cycle through sort modes
            const idx = SORT_OPTIONS.findIndex((o) => o.value === sort);
            const next = SORT_OPTIONS[(idx + 1) % SORT_OPTIONS.length];
            onSortChange(next.value);
          }}
          title={`Sort by ${sort}`}
        >
          <ArrowUpDown className="h-3 w-3" />
          <span className="hidden sm:inline">
            {SORT_OPTIONS.find((o) => o.value === sort)?.label}
          </span>
        </button>
      </div>
    </div>
  );
}
