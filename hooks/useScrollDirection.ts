'use client';

import { useState, useEffect, useRef } from 'react';

export type ScrollDirection = 'up' | 'down' | 'top';

/**
 * Tracks scroll direction with a threshold to avoid jitter.
 * Returns 'top' when at the very top of the page, 'up' when scrolling up,
 * 'down' when scrolling down.
 */
export function useScrollDirection(threshold = 10): ScrollDirection {
  const [direction, setDirection] = useState<ScrollDirection>('top');
  const lastScrollY = useRef(0);
  const ticking = useRef(false);

  useEffect(() => {
    lastScrollY.current = window.scrollY;

    const update = () => {
      const scrollY = window.scrollY;

      if (scrollY <= 5) {
        setDirection('top');
      } else if (scrollY > lastScrollY.current + threshold) {
        setDirection('down');
      } else if (scrollY < lastScrollY.current - threshold) {
        setDirection('up');
      }

      lastScrollY.current = scrollY;
      ticking.current = false;
    };

    const onScroll = () => {
      if (!ticking.current) {
        requestAnimationFrame(update);
        ticking.current = true;
      }
    };

    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, [threshold]);

  return direction;
}
