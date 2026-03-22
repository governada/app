'use client';

import { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { RotateCcw, ExternalLink } from 'lucide-react';
import { posthog } from '@/lib/posthog';
import { Button } from '@/components/ui/button';
import { GovernanceIdentityCard } from './GovernanceIdentityCard';
import { MatchResultCard } from './MatchResultCard';
import type { AlignmentScores } from '@/lib/drepIdentity';
import type { MatchResult, SpoMatchResult } from '@/lib/matching/conversationalMatch';
import type { ConstellationRef } from '@/components/GovernanceConstellation';
import { cn } from '@/lib/utils';

/* ─── Types ─────────────────────────────────────────────── */

interface MatchResultsProps {
  personalityLabel: string;
  identityColor: string;
  userAlignments: AlignmentScores;
  matches: MatchResult[];
  spoMatches?: SpoMatchResult[];
  onReset: () => void;
  onDelegate?: (drepId: string) => void;
  globeRef?: React.RefObject<ConstellationRef | null>;
}

/* ─── Helpers ───────────────────────────────────────────── */

function pickBridgeMatch(matches: MatchResult[]): MatchResult | null {
  if (matches.length < 4) return null;
  const candidates = matches.slice(3);
  const sorted = [...candidates].sort((a, b) => {
    const differDiff = b.differDimensions.length - a.differDimensions.length;
    if (differDiff !== 0) return differDiff;
    return a.score - b.score;
  });
  return sorted[0] ?? null;
}

/* ─── SPO Match Card (compact) ──────────────────────────── */

function SpoMatchCard({ spo, rank }: { spo: SpoMatchResult; rank: number }) {
  const displayName = spo.ticker
    ? `[${spo.ticker}] ${spo.poolName ?? ''}`
    : (spo.poolName ?? spo.poolId.slice(0, 16) + '...');

  return (
    <a
      href={`/pool/${encodeURIComponent(spo.poolId)}`}
      className={cn(
        'flex items-center gap-3 rounded-lg border border-white/[0.08] bg-card/40 backdrop-blur-sm',
        'px-4 py-3 transition-colors hover:border-violet-500/30',
      )}
    >
      {/* Rank */}
      <span
        className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold text-white shrink-0"
        style={{ backgroundColor: spo.identityColor }}
      >
        {rank}
      </span>

      {/* Name + vote count */}
      <div className="flex-1 min-w-0">
        <span className="font-medium text-sm text-foreground truncate block">{displayName}</span>
        {spo.voteCount > 0 && (
          <span className="text-[10px] text-muted-foreground">
            {spo.voteCount} governance vote{spo.voteCount !== 1 ? 's' : ''}
          </span>
        )}
      </div>

      {/* Score */}
      <span
        className="font-display text-lg font-bold tabular-nums shrink-0"
        style={{ color: spo.identityColor }}
      >
        {Math.round(spo.score)}%
      </span>

      <ExternalLink className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
    </a>
  );
}

/* ─── Component ─────────────────────────────────────────── */

export function MatchResults({
  personalityLabel,
  identityColor,
  userAlignments,
  matches,
  spoMatches,
  onReset,
  onDelegate,
  globeRef,
}: MatchResultsProps) {
  const [expandedIndex, setExpandedIndex] = useState<number | null>(null);
  const prefersReducedMotion = useReducedMotion();

  const topMatches = useMemo(() => matches.slice(0, 3), [matches]);
  const bridgeMatch = useMemo(() => pickBridgeMatch(matches), [matches]);

  // Fire identity viewed event once on mount
  const identityTrackedRef = useRef(false);
  useEffect(() => {
    if (!identityTrackedRef.current) {
      identityTrackedRef.current = true;
      posthog.capture('match_identity_viewed', {
        personality: personalityLabel,
        identityColor,
      });
    }
  }, [personalityLabel, identityColor]);

  const handleShare = useCallback(() => {
    posthog.capture('match_identity_shared');
  }, []);

  const handleExpand = useCallback(
    (index: number, isBridge: boolean) => {
      const isExpanding = expandedIndex !== index;
      if (isExpanding) {
        posthog.capture('match_result_expanded', {
          rank: isBridge ? 'bridge' : index + 1,
          isBridge,
        });
      }
      setExpandedIndex((prev) => (prev === index ? null : index));
    },
    [expandedIndex],
  );

  const handleDelegate = useCallback(
    (drepId: string, rank: number) => {
      posthog.capture('match_delegate_clicked', { drepId, rank });
      onDelegate?.(drepId);
    },
    [onDelegate],
  );

  return (
    <div className="w-full space-y-5">
      {/* Identity card — compact */}
      <GovernanceIdentityCard
        personalityLabel={personalityLabel}
        identityColor={identityColor}
        alignments={userAlignments}
        onShare={handleShare}
      />

      {/* DRep match result cards — immediately visible */}
      <motion.div
        initial={prefersReducedMotion ? false : { opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={prefersReducedMotion ? { duration: 0 } : { duration: 0.4, delay: 0.2 }}
        className="space-y-4"
      >
        <h3 className="text-sm font-medium text-muted-foreground">Your DRep matches</h3>

        {topMatches.map((match, i) => (
          <MatchResultCard
            key={match.drepId}
            match={match}
            rank={i + 1}
            userAlignments={userAlignments}
            expanded={expandedIndex === i}
            onExpand={() => handleExpand(i, false)}
            onDelegate={onDelegate ? (drepId) => handleDelegate(drepId, i + 1) : undefined}
            globeRef={globeRef}
          />
        ))}

        {bridgeMatch && (
          <MatchResultCard
            key={`bridge-${bridgeMatch.drepId}`}
            match={bridgeMatch}
            rank={4}
            isBridge
            userAlignments={userAlignments}
            expanded={expandedIndex === 99}
            onExpand={() => handleExpand(99, true)}
            onDelegate={onDelegate ? (drepId) => handleDelegate(drepId, 4) : undefined}
            globeRef={globeRef}
          />
        )}

        {matches.length === 0 && (
          <p className="text-center text-sm text-muted-foreground py-4">
            No strong DRep matches found. Try again with different priorities.
          </p>
        )}
      </motion.div>

      {/* SPO matches — separate section */}
      {spoMatches && spoMatches.length > 0 && (
        <motion.div
          initial={prefersReducedMotion ? false : { opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={prefersReducedMotion ? { duration: 0 } : { duration: 0.4, delay: 0.4 }}
          className="space-y-3"
        >
          <div>
            <h3 className="text-sm font-medium text-muted-foreground">Your stake pool matches</h3>
            <p className="text-[11px] text-muted-foreground/70 mt-0.5">
              SPOs aligned with your governance values
            </p>
          </div>

          {spoMatches.map((spo, i) => (
            <SpoMatchCard key={spo.poolId} spo={spo} rank={i + 1} />
          ))}
        </motion.div>
      )}

      {/* Bottom CTAs */}
      <div className="flex flex-col items-center gap-3 pt-2">
        <Button variant="outline" onClick={onReset} className="gap-2 min-h-[44px]">
          <RotateCcw className="h-4 w-4" />
          Continue refining
        </Button>
      </div>
    </div>
  );
}
