'use client';

import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { cn } from '@/lib/utils';
import type { ConstellationNode3D } from '@/lib/constellation/types';

interface GlobeTooltipProps {
  node: ConstellationNode3D | null;
  screenPos: { x: number; y: number } | null;
}

const OFFSET = 16;

function formatAda(amount: number): string {
  if (amount >= 1_000_000_000) return `${(amount / 1_000_000_000).toFixed(1)}B`;
  if (amount >= 1_000_000) return `${(amount / 1_000_000).toFixed(1)}M`;
  if (amount >= 1_000) return `${(amount / 1_000).toFixed(0)}K`;
  return String(amount);
}

/**
 * Cursor-following tooltip for globe node hover.
 * Shows entity-specific details for DReps, SPOs, and CC members.
 * Flips position near viewport edges to stay visible.
 */
export function GlobeTooltip({ node, screenPos }: GlobeTooltipProps) {
  const prefersReducedMotion = useReducedMotion();
  const tooltipRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState<{ x: number; y: number } | null>(null);

  useEffect(() => {
    if (!screenPos || !node) {
      setPosition(null);
      return;
    }

    const vw = window.innerWidth;
    const vh = window.innerHeight;

    // Default: right and below cursor
    let x = screenPos.x + OFFSET;
    let y = screenPos.y + OFFSET;

    // Flip horizontal near right edge
    if (screenPos.x > vw - 300) {
      x = screenPos.x - OFFSET - 260;
    }

    // Flip vertical near bottom edge
    if (screenPos.y > vh - 200) {
      y = screenPos.y - OFFSET - 120;
    }

    setPosition({ x, y });
  }, [screenPos, node]);

  const displayName = node?.name
    ? node.name.length > 24
      ? node.name.slice(0, 24) + '...'
      : node.name
    : node
      ? `${node.id.slice(0, 12)}...`
      : '';

  return (
    <AnimatePresence>
      {node && position && (
        <motion.div
          ref={tooltipRef}
          initial={prefersReducedMotion ? { opacity: 1 } : { opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, scale: 0.95 }}
          transition={{ duration: 0.15 }}
          className={cn(
            'pointer-events-none fixed z-[100]',
            'rounded-xl border border-white/10 bg-black/85 backdrop-blur-md',
            'px-4 py-3 shadow-2xl max-w-[280px]',
          )}
          style={{
            left: position.x,
            top: position.y,
          }}
        >
          {/* Name */}
          <p className="text-sm font-semibold text-white truncate">{displayName}</p>

          {/* Entity-specific details */}
          {node.nodeType === 'drep' && <DRepTooltipContent node={node} />}
          {node.nodeType === 'spo' && <SPOTooltipContent node={node} />}
          {node.nodeType === 'cc' && <CCTooltipContent node={node} />}
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function DRepTooltipContent({ node }: { node: ConstellationNode3D }) {
  return (
    <>
      <div className="flex items-center gap-3 mt-1 text-xs text-white/60">
        <span className="text-teal-400">DRep</span>
        <span>
          Score <strong className="text-white/90">{node.score}</strong>
        </span>
      </div>
      <div className="flex items-center gap-3 mt-0.5 text-xs text-white/50">
        {node.adaAmount != null && node.adaAmount > 0 && (
          <span>
            <strong className="text-white/80">{formatAda(node.adaAmount)}</strong> &#8371; delegated
          </span>
        )}
        {node.delegatorCount != null && node.delegatorCount > 0 && (
          <span>{node.delegatorCount.toLocaleString()} delegators</span>
        )}
      </div>
    </>
  );
}

function SPOTooltipContent({ node }: { node: ConstellationNode3D }) {
  return (
    <>
      <div className="flex items-center gap-3 mt-1 text-xs text-white/60">
        <span className="text-purple-400">Pool</span>
        <span>
          Score <strong className="text-white/90">{node.score}</strong>
        </span>
      </div>
      <div className="flex items-center gap-3 mt-0.5 text-xs text-white/50">
        {node.voteCount != null && node.voteCount > 0 && (
          <span>
            <strong className="text-white/80">{node.voteCount}</strong> governance votes
          </span>
        )}
      </div>
    </>
  );
}

function CCTooltipContent({ node }: { node: ConstellationNode3D }) {
  return (
    <>
      <div className="flex items-center gap-3 mt-1 text-xs text-white/60">
        <span className="text-amber-400">Committee</span>
        {node.fidelityGrade && (
          <span>
            Grade <strong className="text-white/90">{node.fidelityGrade}</strong>
          </span>
        )}
      </div>
      <div className="mt-0.5 text-xs text-white/50">Constitutional Committee Member</div>
    </>
  );
}
