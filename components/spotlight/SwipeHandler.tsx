'use client';

import { useRef, useCallback, type ReactNode, type PointerEvent } from 'react';

interface SwipeHandlerProps {
  onSwipeLeft?: () => void;
  onSwipeRight?: () => void;
  /** Minimum horizontal distance to trigger swipe (px, default 50) */
  threshold?: number;
  /** Enable visual drag feedback via CSS transform */
  visualFeedback?: boolean;
  children: ReactNode;
  className?: string;
}

/**
 * Pointer-event-based swipe handler. No external dependencies.
 * Distinguishes horizontal swipes from vertical scrolls.
 * Provides optional visual drag feedback during swipe.
 */
export function SwipeHandler({
  onSwipeLeft,
  onSwipeRight,
  threshold = 50,
  visualFeedback = true,
  children,
  className,
}: SwipeHandlerProps) {
  const startX = useRef(0);
  const startY = useRef(0);
  const currentX = useRef(0);
  const isTracking = useRef(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const handlePointerDown = useCallback((e: PointerEvent<HTMLDivElement>) => {
    // Only track primary pointer (not right-click or multi-touch)
    if (e.button !== 0) return;

    startX.current = e.clientX;
    startY.current = e.clientY;
    currentX.current = e.clientX;
    isTracking.current = true;

    // Capture pointer for reliable tracking
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
  }, []);

  const handlePointerMove = useCallback(
    (e: PointerEvent<HTMLDivElement>) => {
      if (!isTracking.current) return;

      currentX.current = e.clientX;
      const dx = currentX.current - startX.current;
      const dy = e.clientY - startY.current;

      // If vertical movement exceeds horizontal, stop tracking (user is scrolling)
      if (Math.abs(dy) > Math.abs(dx) && Math.abs(dy) > 10) {
        isTracking.current = false;
        if (containerRef.current && visualFeedback) {
          containerRef.current.style.transform = '';
          containerRef.current.style.transition = 'transform 0.2s ease-out';
        }
        return;
      }

      // Visual feedback: translate the container
      if (visualFeedback && containerRef.current && Math.abs(dx) > 5) {
        // Dampen the movement slightly
        const dampened = dx * 0.6;
        containerRef.current.style.transform = `translateX(${dampened}px)`;
        containerRef.current.style.transition = 'none';
      }
    },
    [visualFeedback],
  );

  const handlePointerUp = useCallback(
    (e: PointerEvent<HTMLDivElement>) => {
      if (!isTracking.current) return;
      isTracking.current = false;

      const dx = currentX.current - startX.current;

      // Reset visual transform
      if (visualFeedback && containerRef.current) {
        containerRef.current.style.transform = '';
        containerRef.current.style.transition = 'transform 0.2s ease-out';
      }

      // Release pointer capture
      (e.target as HTMLElement).releasePointerCapture?.(e.pointerId);

      // Check threshold
      if (Math.abs(dx) < threshold) return;

      if (dx > 0) {
        onSwipeRight?.();
      } else {
        onSwipeLeft?.();
      }
    },
    [threshold, onSwipeLeft, onSwipeRight, visualFeedback],
  );

  const handlePointerCancel = useCallback(() => {
    isTracking.current = false;
    if (visualFeedback && containerRef.current) {
      containerRef.current.style.transform = '';
      containerRef.current.style.transition = 'transform 0.2s ease-out';
    }
  }, [visualFeedback]);

  return (
    <div
      ref={containerRef}
      className={className}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerCancel}
      style={{ touchAction: 'pan-y' }} // Allow vertical scroll, capture horizontal
    >
      {children}
    </div>
  );
}
