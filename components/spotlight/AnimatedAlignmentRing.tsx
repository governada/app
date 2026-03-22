'use client';

import { motion, useReducedMotion } from 'framer-motion';
import {
  type AlignmentScores,
  getDimensionOrder,
  getIdentityColor,
  getDimensionLabel,
  alignmentsToArray,
} from '@/lib/drepIdentity';
import { spring } from '@/lib/animations';

interface AnimatedAlignmentRingProps {
  alignments: AlignmentScores;
  size?: number;
  /** Delay before first segment begins animating (ms) */
  delay?: number;
  /** If true, show ring at full values immediately */
  immediate?: boolean;
}

/**
 * SVG ring that fills with alignment dimension colors in sequence.
 * Each of 6 segments fills proportionally to its alignment score.
 */
export function AnimatedAlignmentRing({
  alignments,
  size = 120,
  delay = 0,
  immediate = false,
}: AnimatedAlignmentRingProps) {
  const reducedMotion = useReducedMotion();
  const shouldAnimate = !immediate && !reducedMotion;

  const dimensions = getDimensionOrder();
  const scores = alignmentsToArray(alignments);
  const center = size / 2;
  const radius = size / 2 - 8;
  const strokeWidth = 6;
  const circumference = 2 * Math.PI * radius;
  const segmentLength = circumference / 6;

  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      className="shrink-0"
      role="img"
      aria-label="Alignment dimensions ring"
    >
      {/* Background ring */}
      <circle
        cx={center}
        cy={center}
        r={radius}
        fill="none"
        stroke="currentColor"
        strokeWidth={strokeWidth}
        className="text-white/5"
      />

      {/* Dimension segments */}
      {dimensions.map((dim, i) => {
        const score = scores[i];
        const normalizedScore = score / 100;
        const color = getIdentityColor(dim);
        const offset = segmentLength * i;
        // Each segment fills proportionally to its score
        const fillLength = segmentLength * normalizedScore;
        const gapLength = circumference - fillLength;
        const segDelay = delay / 1000 + i * 0.1;

        return (
          <motion.circle
            key={dim}
            cx={center}
            cy={center}
            r={radius}
            fill="none"
            stroke={color.hex}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeDasharray={`${fillLength} ${gapLength}`}
            strokeDashoffset={-offset}
            initial={shouldAnimate ? { strokeDasharray: `0 ${circumference}` } : undefined}
            animate={{ strokeDasharray: `${fillLength} ${gapLength}` }}
            transition={shouldAnimate ? { ...spring.bouncy, delay: segDelay } : { duration: 0 }}
            style={{
              transform: 'rotate(-90deg)',
              transformOrigin: `${center}px ${center}px`,
            }}
          >
            <title>{`${getDimensionLabel(dim)}: ${score}`}</title>
          </motion.circle>
        );
      })}

      {/* Center score area (left empty for composability) */}
    </svg>
  );
}
