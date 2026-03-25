'use client';

import { useEffect, useRef } from 'react';
import { motion, useReducedMotion, useAnimationControls } from 'framer-motion';
import { cn } from '@/lib/utils';

type SigilState =
  | 'idle'
  | 'greeting'
  | 'thinking'
  | 'speaking'
  | 'urgent'
  | 'celebration'
  | 'searching'
  | 'connected';

interface CompassSigilProps {
  /** Animation state */
  state?: SigilState;
  /** Size in pixels (default 32) */
  size?: number;
  /** Optional accent color override (oklch string) */
  accentColor?: string;
  /** Additional className */
  className?: string;
}

// --- Color helpers ---
const TEAL = 'oklch(0.72 0.12 192)';
const AMBER = 'oklch(0.78 0.14 70)';
const GOLD = 'oklch(0.82 0.12 80)';

function colorForState(state: SigilState, accent?: string): string {
  if (accent) return accent;
  switch (state) {
    case 'urgent':
      return AMBER;
    case 'connected':
      return GOLD;
    default:
      return TEAL;
  }
}

// --- Rotation configs per state ---
function rotationConfig(state: SigilState) {
  switch (state) {
    case 'idle':
    case 'greeting':
      return { duration: 30, ease: 'linear' as const };
    case 'thinking':
      return { duration: 4, ease: 'linear' as const };
    case 'searching':
      return { duration: 1.5, ease: 'linear' as const };
    case 'speaking':
    case 'urgent':
    case 'celebration':
    case 'connected':
      return null; // no continuous rotation
  }
}

// --- Pulse / scale animation per state ---
function pulseVariants(state: SigilState): {
  animate: Record<string, number | number[]>;
  transition: Record<string, unknown>;
} {
  switch (state) {
    case 'idle':
      return {
        animate: {
          opacity: [0.7, 1, 0.7],
          scale: 1,
        },
        transition: {
          opacity: { duration: 3, repeat: Infinity, ease: 'easeInOut' },
          scale: { duration: 0 },
        },
      };
    case 'greeting':
      return {
        animate: { opacity: 1, scale: [1, 1.1, 1] },
        transition: {
          scale: { duration: 1, ease: 'easeOut' as const },
          opacity: { duration: 0.3 },
        },
      };
    case 'thinking':
      return {
        animate: {
          opacity: 1,
          scale: [0.95, 1.05, 0.95],
        },
        transition: {
          scale: { duration: 0.8, repeat: Infinity, ease: 'easeInOut' as const },
          opacity: { duration: 0 },
        },
      };
    case 'speaking':
      return {
        animate: {
          opacity: 1,
          scale: [1, 1.03, 1],
        },
        transition: {
          scale: { duration: 1.2, repeat: Infinity, ease: 'easeInOut' as const },
          opacity: { duration: 0 },
        },
      };
    case 'urgent':
      return {
        animate: {
          opacity: 1,
          scale: [1, 1.05, 1],
        },
        transition: {
          scale: { duration: 0.6, repeat: Infinity, ease: 'easeInOut' as const },
          opacity: { duration: 0 },
        },
      };
    case 'celebration':
      return {
        animate: { opacity: 1, scale: [1, 1.2, 1] },
        transition: {
          scale: { duration: 0.6, ease: 'easeOut' as const },
          opacity: { duration: 0 },
        },
      };
    case 'searching':
      return {
        animate: {
          opacity: 1,
          scale: 1,
        },
        transition: {
          opacity: { duration: 0 },
          scale: { duration: 0 },
        },
      };
    case 'connected':
      return {
        animate: {
          opacity: [0.8, 1, 0.8],
          scale: 1,
        },
        transition: {
          opacity: { duration: 3, repeat: Infinity, ease: 'easeInOut' as const },
          scale: { duration: 0 },
        },
      };
  }
}

// --- SVG needle path (tapered from center outward) ---
// Creates a thin tapered needle along the Y-axis, pointing upward.
// cx, cy = center; length = how far the tip extends; base = half-width at base
function needlePath(cx: number, cy: number, length: number, base: number): string {
  // Tip at top, base at center
  const tipY = cy - length;
  return [
    `M ${cx} ${tipY}`, // tip
    `L ${cx + base} ${cy}`, // base right
    `L ${cx - base} ${cy}`, // base left
    'Z',
  ].join(' ');
}

export function CompassSigil({
  state = 'idle',
  size = 32,
  accentColor,
  className,
}: CompassSigilProps) {
  const prefersReduced = useReducedMotion();
  const rotateControls = useAnimationControls();
  const prevStateRef = useRef<SigilState>(state);

  const color = colorForState(state, accentColor);

  // Viewbox is 100x100 for clean math
  const vb = 100;
  const cx = vb / 2;
  const cy = vb / 2;
  const needleLength = 38; // from center to tip
  const needleBase = 2.8; // half-width at base
  const centerRadius = 7.5; // ~15% of 100/2

  // Cardinal directions as rotation angles
  const cardinals = [0, 90, 180, 270];

  // --- Handle rotation animation ---
  useEffect(() => {
    if (prefersReduced) {
      rotateControls.set({ rotate: 0 });
      return;
    }

    const config = rotationConfig(state);
    if (config) {
      rotateControls.start({
        rotate: [0, 360],
        transition: {
          duration: config.duration,
          ease: config.ease,
          repeat: Infinity,
        },
      });
    } else {
      // Stop rotation smoothly by settling at current position
      rotateControls.stop();
    }
  }, [state, prefersReduced, rotateControls]);

  // Transition back to idle after one-shot states
  useEffect(() => {
    prevStateRef.current = state;
  }, [state]);

  const pulse = pulseVariants(state);

  // Searching wobble — slight oscillation on the rotation axis
  const wobble =
    state === 'searching' && !prefersReduced
      ? {
          x: [0, 1, -1, 0.5, -0.5, 0],
          y: [0, -0.5, 0.5, -0.3, 0.3, 0],
        }
      : {};
  const wobbleTransition =
    state === 'searching' && !prefersReduced
      ? {
          x: { duration: 0.6, repeat: Infinity, ease: 'easeInOut' as const },
          y: { duration: 0.8, repeat: Infinity, ease: 'easeInOut' as const },
        }
      : {};

  // Drop shadow / glow for speaking and connected states
  const glowFilter =
    state === 'speaking' || state === 'connected'
      ? `drop-shadow(0 0 ${size * 0.08}px ${color})`
      : state === 'urgent'
        ? `drop-shadow(0 0 ${size * 0.06}px ${AMBER})`
        : undefined;

  // Static render for reduced motion
  if (prefersReduced) {
    return (
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${vb} ${vb}`}
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className={cn('shrink-0', className)}
        role="img"
        aria-label="Seneca compass sigil"
      >
        {cardinals.map((angle) => (
          <path
            key={angle}
            d={needlePath(cx, cy, needleLength, needleBase)}
            fill={color}
            transform={`rotate(${angle} ${cx} ${cy})`}
          />
        ))}
        <circle cx={cx} cy={cy} r={centerRadius} fill={color} />
      </svg>
    );
  }

  return (
    <motion.div
      className={cn('inline-flex shrink-0 items-center justify-center', className)}
      style={{
        width: size,
        height: size,
        filter: glowFilter,
      }}
      animate={{
        ...pulse.animate,
        ...wobble,
      }}
      transition={
        {
          ...pulse.transition,
          ...wobbleTransition,
        } as Record<string, unknown>
      }
    >
      <motion.svg
        width="100%"
        height="100%"
        viewBox={`0 0 ${vb} ${vb}`}
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        animate={rotateControls}
        style={{ originX: '50%', originY: '50%' }}
        role="img"
        aria-label="Seneca compass sigil"
      >
        {/* Cardinal needles */}
        {cardinals.map((angle) => (
          <motion.path
            key={angle}
            d={needlePath(cx, cy, needleLength, needleBase)}
            fill={color}
            transform={`rotate(${angle} ${cx} ${cy})`}
          />
        ))}

        {/* Center circle */}
        <motion.circle cx={cx} cy={cy} r={centerRadius} fill={color} />
      </motion.svg>
    </motion.div>
  );
}
