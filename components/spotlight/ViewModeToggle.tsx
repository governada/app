'use client';

import { Spotlight, LayoutGrid, TableProperties } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { SpotlightViewMode } from './types';

interface ViewModeToggleProps {
  mode: SpotlightViewMode;
  onChange: (mode: SpotlightViewMode) => void;
  /** Hide table option (e.g., for proposals which don't have table view) */
  hideTable?: boolean;
}

const MODES: { value: SpotlightViewMode; icon: typeof Spotlight; label: string }[] = [
  { value: 'spotlight', icon: Spotlight, label: 'Spotlight' },
  { value: 'cards', icon: LayoutGrid, label: 'Grid' },
  { value: 'table', icon: TableProperties, label: 'Table' },
];

/**
 * Toggle between Spotlight / Grid / Table view modes.
 */
export function ViewModeToggle({ mode, onChange, hideTable = false }: ViewModeToggleProps) {
  const modes = hideTable ? MODES.filter((m) => m.value !== 'table') : MODES;

  return (
    <div className="flex items-center rounded-lg border border-border/40 bg-card/40 p-0.5">
      {modes.map(({ value, icon: Icon, label }) => (
        <button
          key={value}
          onClick={() => onChange(value)}
          className={cn(
            'flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors',
            mode === value
              ? 'bg-primary/10 text-primary'
              : 'text-muted-foreground hover:text-foreground',
          )}
          aria-pressed={mode === value}
          title={`${label} view`}
        >
          <Icon className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">{label}</span>
        </button>
      ))}
    </div>
  );
}
