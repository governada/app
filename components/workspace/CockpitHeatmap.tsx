'use client';

import { cn } from '@/lib/utils';
import { Flame } from 'lucide-react';
import type { CockpitData } from '@/hooks/queries';

function getVoteColor(votes: number): string {
  if (votes >= 5) return 'bg-emerald-500/80';
  if (votes >= 3) return 'bg-emerald-500/55';
  if (votes >= 2) return 'bg-emerald-500/35';
  if (votes >= 1) return 'bg-emerald-500/15';
  return 'bg-muted/30';
}

interface CockpitHeatmapProps {
  heatmap: CockpitData['activityHeatmap'];
  className?: string;
}

export function CockpitHeatmap({ heatmap, className }: CockpitHeatmapProps) {
  const { epochs, streak } = heatmap;

  return (
    <div className={cn('rounded-2xl border border-border bg-card p-4 space-y-3', className)}>
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-foreground">Activity</h3>
        {streak > 0 && (
          <div className="flex items-center gap-1 text-xs text-amber-500">
            <Flame className="h-3 w-3" />
            <span className="tabular-nums font-medium">
              {streak} epoch{streak !== 1 ? 's' : ''}
            </span>
          </div>
        )}
      </div>

      {/* Mini heatmap grid — 24 epochs in 6x4 */}
      <div className="grid grid-cols-8 gap-1">
        {epochs.map((e) => (
          <div
            key={e.epoch}
            className={cn('h-4 rounded-sm', getVoteColor(e.votes))}
            title={`Epoch ${e.epoch}: ${e.votes} vote${e.votes !== 1 ? 's' : ''}`}
          />
        ))}
      </div>

      <div className="flex justify-between text-[10px] text-muted-foreground">
        <span>Epoch {epochs[0]?.epoch}</span>
        <div className="flex items-center gap-1">
          <span>Less</span>
          <div className="flex gap-0.5">
            {[
              'bg-muted/30',
              'bg-emerald-500/15',
              'bg-emerald-500/35',
              'bg-emerald-500/55',
              'bg-emerald-500/80',
            ].map((c, i) => (
              <div key={i} className={cn('h-2.5 w-2.5 rounded-sm', c)} />
            ))}
          </div>
          <span>More</span>
        </div>
        <span>Epoch {epochs[epochs.length - 1]?.epoch}</span>
      </div>
    </div>
  );
}
