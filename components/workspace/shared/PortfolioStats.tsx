'use client';

import { cn } from '@/lib/utils';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface StatItem {
  label: string;
  value: number;
  /** Highlight this stat with foreground weight + optional color */
  emphasis?: boolean;
  /** Optional color class for the value (e.g., 'text-amber-400') */
  color?: string;
}

interface PortfolioStatsProps {
  stats: StatItem[];
  className?: string;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function PortfolioStats({ stats, className }: PortfolioStatsProps) {
  // Don't render if all values are 0
  const hasData = stats.some((s) => s.value > 0);
  if (!hasData) return null;

  return (
    <div
      className={cn('flex items-center gap-4 text-xs text-muted-foreground flex-wrap', className)}
    >
      {stats.map((stat) => (
        <span key={stat.label} className="flex items-center gap-1.5">
          <span
            className={cn(
              'tabular-nums',
              stat.emphasis && 'font-semibold text-foreground',
              stat.color,
            )}
          >
            {stat.value}
          </span>
          <span>{stat.label}</span>
        </span>
      ))}
    </div>
  );
}
