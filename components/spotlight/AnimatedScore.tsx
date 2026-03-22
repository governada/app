'use client';

import { useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/utils';

interface AnimatedScoreProps {
  value: number;
  /** Duration in ms (default 800) */
  duration?: number;
  className?: string;
  /** If true, skip animation and show value immediately */
  immediate?: boolean;
}

/**
 * Animated counter that counts from 0 to target value with an ease-out curve.
 * The visual counter is `aria-hidden`; a screen-reader-only span holds the real value.
 */
export function AnimatedScore({
  value,
  duration = 800,
  className,
  immediate = false,
}: AnimatedScoreProps) {
  const [display, setDisplay] = useState(immediate ? value : 0);
  const rafRef = useRef<number>(0);
  const startRef = useRef<number>(0);

  useEffect(() => {
    if (immediate) {
      setDisplay(value);
      return;
    }

    // Reset to 0 and animate up
    setDisplay(0);
    startRef.current = 0;

    const animate = (timestamp: number) => {
      if (!startRef.current) startRef.current = timestamp;
      const elapsed = timestamp - startRef.current;
      const progress = Math.min(elapsed / duration, 1);

      // Ease-out curve: 1 - (1 - t)^3
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplay(Math.round(eased * value));

      if (progress < 1) {
        rafRef.current = requestAnimationFrame(animate);
      }
    };

    rafRef.current = requestAnimationFrame(animate);

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [value, duration, immediate]);

  return (
    <>
      <span aria-hidden="true" className={cn('tabular-nums', className)}>
        {display}
      </span>
      <span className="sr-only">{value}</span>
    </>
  );
}
