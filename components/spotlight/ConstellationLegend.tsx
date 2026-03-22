'use client';

import { getDimensionOrder, getIdentityColor, getDimensionLabel } from '@/lib/drepIdentity';

/**
 * Color legend overlay for the constellation browse.
 * Shows which color corresponds to which alignment dimension.
 */
export function ConstellationLegend() {
  const dimensions = getDimensionOrder();

  return (
    <div className="flex flex-wrap gap-x-4 gap-y-1.5 rounded-lg border border-border/20 bg-card/60 px-3 py-2 backdrop-blur-sm">
      {dimensions.map((dim) => {
        const color = getIdentityColor(dim);
        return (
          <div key={dim} className="flex items-center gap-1.5">
            <div className="h-2 w-2 rounded-full" style={{ backgroundColor: color.hex }} />
            <span className="text-[10px] text-muted-foreground">{getDimensionLabel(dim)}</span>
          </div>
        );
      })}
    </div>
  );
}
