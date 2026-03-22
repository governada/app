'use client';

import { type AlignmentDimension, getIdentityColor } from '@/lib/drepIdentity';

interface SpotlightBackgroundProps {
  dimension: AlignmentDimension | null;
}

/**
 * Full-viewport background that transitions to the entity's dominant alignment color.
 * Uses a CSS transition for smooth 600ms color shifts.
 */
export function SpotlightBackground({ dimension }: SpotlightBackgroundProps) {
  const color = dimension ? getIdentityColor(dimension) : null;

  return (
    <div
      className="pointer-events-none fixed inset-0 -z-10 transition-all duration-[600ms] ease-out"
      style={{
        background: color
          ? `radial-gradient(ellipse at 50% 30%, rgba(${color.rgb.join(',')}, 0.08) 0%, transparent 70%)`
          : 'transparent',
      }}
      aria-hidden="true"
    />
  );
}
