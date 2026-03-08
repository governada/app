'use client';

import { type Transition, type Variants } from 'framer-motion';

/* ──────────────────────────────────────────────
   Duration tokens (milliseconds)
   ────────────────────────────────────────────── */

export const DURATION = {
  fast: 0.15,
  normal: 0.25,
  slow: 0.4,
} as const;

/* ──────────────────────────────────────────────
   Easing curves
   ────────────────────────────────────────────── */

export const EASE = {
  out: [0.16, 1, 0.3, 1] as [number, number, number, number],
  inOut: [0.42, 0, 0.58, 1] as [number, number, number, number],
} as const;

/* ──────────────────────────────────────────────
   Spring presets — the animation vocabulary
   for the entire app. Every animated element
   uses one of these three springs.
   ────────────────────────────────────────────── */

export const spring = {
  snappy: { type: 'spring', stiffness: 400, damping: 30 } as Transition,
  smooth: { type: 'spring', stiffness: 200, damping: 25 } as Transition,
  bouncy: { type: 'spring', stiffness: 300, damping: 15 } as Transition,
} as const;

/* ──────────────────────────────────────────────
   Shared animation variants
   ────────────────────────────────────────────── */

export const fadeInUp: Variants = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: spring.smooth,
  },
};

export const fadeIn: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { duration: 0.4 },
  },
};

export const scaleIn: Variants = {
  hidden: { opacity: 0, scale: 0.95 },
  visible: {
    opacity: 1,
    scale: 1,
    transition: spring.snappy,
  },
};

export const staggerContainer: Variants = {
  hidden: {},
  visible: {
    transition: {
      staggerChildren: 0.05,
      delayChildren: 0.1,
    },
  },
};

export const staggerContainerSlow: Variants = {
  hidden: {},
  visible: {
    transition: {
      staggerChildren: 0.08,
      delayChildren: 0.15,
    },
  },
};

/* ──────────────────────────────────────────────
   Radar-specific variants
   ────────────────────────────────────────────── */

export const radarReveal: Variants = {
  hidden: { scale: 0, opacity: 0 },
  visible: {
    scale: 1,
    opacity: 1,
    transition: { ...spring.smooth, delay: 0.1 },
  },
};

export const radarAxisReveal: Variants = {
  hidden: { pathLength: 0, opacity: 0 },
  visible: {
    pathLength: 1,
    opacity: 1,
    transition: { ...spring.smooth, duration: 0.8 },
  },
};

/* ──────────────────────────────────────────────
   Hex score morphing
   ────────────────────────────────────────────── */

export const hexMorph: Variants = {
  hidden: { scale: 0.8, opacity: 0 },
  visible: {
    scale: 1,
    opacity: 1,
    transition: spring.bouncy,
  },
};

/* ──────────────────────────────────────────────
   Page transition variants — directional
   Used by template.tsx via NavDirectionProvider.
   ────────────────────────────────────────────── */

export type NavDirection = 'forward' | 'backward' | 'neutral';

const SLIDE_PX = 60;

export const pageTransitionVariants: Variants = {
  enterForward: { opacity: 0, x: SLIDE_PX },
  enterBackward: { opacity: 0, x: -SLIDE_PX },
  enterNeutral: { opacity: 0, y: 8 },
  center: { opacity: 1, x: 0, y: 0 },
};

export function getPageTransition(direction: NavDirection): Transition {
  return direction === 'neutral'
    ? spring.smooth
    : { type: 'spring', stiffness: 300, damping: 28, mass: 0.8 };
}

export function getPageInitial(direction: NavDirection) {
  switch (direction) {
    case 'forward':
      return 'enterForward';
    case 'backward':
      return 'enterBackward';
    default:
      return 'enterNeutral';
  }
}

/* ──────────────────────────────────────────────
   Briefing entrance — orchestrated stagger
   ────────────────────────────────────────────── */

export const briefingContainer: Variants = {
  hidden: {},
  visible: {
    transition: {
      staggerChildren: 0.1,
      delayChildren: 0.05,
    },
  },
};

export const briefingItem: Variants = {
  hidden: { opacity: 0, y: 12 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: DURATION.normal, ease: EASE.out },
  },
};
