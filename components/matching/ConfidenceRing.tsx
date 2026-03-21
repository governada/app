'use client';

import { cn } from '@/lib/utils';

/* ─── Types ─────────────────────────────────────────────── */

interface ConfidenceRingProps {
  confidence: number; // 0-100
  size?: number; // default 64
  label?: string;
  showPercentage?: boolean; // default true
  className?: string;
}

/* ─── Constants ─────────────────────────────────────────── */

const RADIUS = 42;
const STROKE_WIDTH = 6;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

/* ─── Component ─────────────────────────────────────────── */

export function ConfidenceRing({
  confidence,
  size = 64,
  label,
  showPercentage = true,
  className,
}: ConfidenceRingProps) {
  const clamped = Math.max(0, Math.min(100, confidence));
  const offset = CIRCUMFERENCE - (clamped / 100) * CIRCUMFERENCE;
  const isReady = clamped >= 95;
  const displayLabel = isReady ? 'Ready to match!' : label;

  return (
    <div className={cn('flex flex-col items-center gap-1', className)}>
      <svg
        width={size}
        height={size}
        viewBox="0 0 100 100"
        className="block"
        role="img"
        aria-label={`Confidence: ${clamped}%`}
      >
        {/* Track */}
        <circle
          cx="50"
          cy="50"
          r={RADIUS}
          fill="none"
          className="stroke-white/10"
          strokeWidth={STROKE_WIDTH}
        />
        {/* Progress */}
        <circle
          cx="50"
          cy="50"
          r={RADIUS}
          fill="none"
          stroke="var(--color-primary, #2dd4bf)"
          strokeWidth={STROKE_WIDTH}
          strokeLinecap="round"
          strokeDasharray={CIRCUMFERENCE}
          strokeDashoffset={offset}
          transform="rotate(-90 50 50)"
          style={{
            transition: 'stroke-dashoffset 0.6s ease-out',
          }}
        />
        {/* Center percentage */}
        {showPercentage && (
          <text
            x="50"
            y="50"
            textAnchor="middle"
            dominantBaseline="central"
            className="fill-foreground font-display text-[22px] font-semibold"
          >
            {clamped}
          </text>
        )}
      </svg>
      {/* Label below */}
      {displayLabel && (
        <span
          className={cn(
            'text-center text-xs text-muted-foreground',
            isReady && 'animate-pulse text-primary',
          )}
        >
          {displayLabel}
        </span>
      )}
    </div>
  );
}
