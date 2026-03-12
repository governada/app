'use client';

import { useMemo } from 'react';
import { formatAda } from '@/lib/treasury';
import type { IncomeVsOutflow } from '@/lib/treasury';

interface TreasuryEpochFlowProps {
  data: IncomeVsOutflow[];
}

export function TreasuryEpochFlow({ data }: TreasuryEpochFlowProps) {
  const recent = useMemo(() => data.slice(-6), [data]);

  if (recent.length === 0) return null;

  const maxValue = Math.max(...recent.flatMap((d) => [d.incomeAda, d.outflowAda]), 1);
  const latestNet = recent[recent.length - 1]?.netAda ?? 0;

  return (
    <div className="rounded-xl border border-border/50 bg-card/70 backdrop-blur-md p-5">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-medium text-muted-foreground">Epoch Flow (last 6)</h3>
        <span className="text-xs text-muted-foreground">
          Latest net:{' '}
          <span className={latestNet >= 0 ? 'text-emerald-400' : 'text-red-400'}>
            {latestNet >= 0 ? '+' : ''}₳{formatAda(Math.abs(latestNet))}
          </span>
        </span>
      </div>

      <div className="flex items-end gap-1.5 h-20">
        {recent.map((epoch) => {
          const inHeight = (epoch.incomeAda / maxValue) * 100;
          const outHeight = (epoch.outflowAda / maxValue) * 100;

          return (
            <div
              key={epoch.epoch}
              className="flex-1 flex items-end gap-0.5"
              title={`Epoch ${epoch.epoch}`}
            >
              {/* Income bar */}
              <div
                className="flex-1 bg-emerald-500/60 rounded-t-sm transition-all"
                style={{ height: `${Math.max(2, inHeight)}%` }}
              />
              {/* Outflow bar */}
              <div
                className="flex-1 bg-red-400/50 rounded-t-sm transition-all"
                style={{ height: `${Math.max(2, outHeight)}%` }}
              />
            </div>
          );
        })}
      </div>

      {/* Epoch labels */}
      <div className="flex gap-1.5 mt-1">
        {recent.map((epoch) => (
          <div key={epoch.epoch} className="flex-1 text-center text-[10px] text-muted-foreground">
            {epoch.epoch}
          </div>
        ))}
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 mt-2 text-[10px] text-muted-foreground">
        <span className="flex items-center gap-1">
          <span className="inline-block h-2 w-2 rounded-sm bg-emerald-500/60" />
          Income
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block h-2 w-2 rounded-sm bg-red-400/50" />
          Outflow
        </span>
      </div>
    </div>
  );
}
