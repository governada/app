'use client';

import { useState, useCallback, useMemo } from 'react';
import { motion } from 'framer-motion';
import { RotateCcw, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { GovernanceIdentityCard } from './GovernanceIdentityCard';
import { MatchResultCard } from './MatchResultCard';
import type { AlignmentScores } from '@/lib/drepIdentity';
import type { MatchResult } from '@/lib/matching/conversationalMatch';
import type { ConstellationRef } from '@/components/GovernanceConstellation';
import Link from 'next/link';

/* ─── Types ─────────────────────────────────────────────── */

interface MatchResultsProps {
  personalityLabel: string;
  identityColor: string;
  userAlignments: AlignmentScores;
  matches: MatchResult[];
  onReset: () => void;
  onDelegate?: (drepId: string) => void;
  globeRef?: React.RefObject<ConstellationRef | null>;
}

/* ─── Helpers ───────────────────────────────────────────── */

/**
 * Pick the best "bridge" match: the match with the lowest score
 * but highest disagreement on at least one dimension.
 * Falls back to the last match if no clear bridge exists.
 */
function pickBridgeMatch(matches: MatchResult[]): MatchResult | null {
  if (matches.length < 4) return null;

  // Candidates: matches ranked 4+ (skip top 3)
  const candidates = matches.slice(3);

  // Sort by most differ dimensions descending, then lowest score
  const sorted = [...candidates].sort((a, b) => {
    const differDiff = b.differDimensions.length - a.differDimensions.length;
    if (differDiff !== 0) return differDiff;
    return a.score - b.score;
  });

  return sorted[0] ?? null;
}

/* ─── Component ─────────────────────────────────────────── */

export function MatchResults({
  personalityLabel,
  identityColor,
  userAlignments,
  matches,
  onReset,
  onDelegate,
  globeRef,
}: MatchResultsProps) {
  const [showMatches, setShowMatches] = useState(false);
  const [expandedIndex, setExpandedIndex] = useState<number | null>(null);

  const topMatches = useMemo(() => matches.slice(0, 3), [matches]);
  const bridgeMatch = useMemo(() => pickBridgeMatch(matches), [matches]);

  const handleContinue = useCallback(() => {
    setShowMatches(true);
  }, []);

  const handleExpand = useCallback((index: number) => {
    setExpandedIndex((prev) => (prev === index ? null : index));
  }, []);

  return (
    <div className="w-full space-y-6">
      {/* Identity card — always visible */}
      <GovernanceIdentityCard
        personalityLabel={personalityLabel}
        identityColor={identityColor}
        alignments={userAlignments}
        onContinue={!showMatches ? handleContinue : undefined}
      />

      {/* Match result cards — revealed after "See your matches" */}
      {showMatches && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.3 }}
          className="space-y-4"
        >
          <h3 className="text-sm font-medium text-muted-foreground">Your top matches</h3>

          {/* Top 3 matches */}
          {topMatches.map((match, i) => (
            <MatchResultCard
              key={match.drepId}
              match={match}
              rank={i + 1}
              userAlignments={userAlignments}
              expanded={expandedIndex === i}
              onExpand={() => handleExpand(i)}
              onDelegate={onDelegate}
              globeRef={globeRef}
            />
          ))}

          {/* Bridge match */}
          {bridgeMatch && (
            <MatchResultCard
              key={`bridge-${bridgeMatch.drepId}`}
              match={bridgeMatch}
              rank={4}
              isBridge
              userAlignments={userAlignments}
              expanded={expandedIndex === 99}
              onExpand={() => handleExpand(99)}
              onDelegate={onDelegate}
              globeRef={globeRef}
            />
          )}

          {/* No matches fallback */}
          {matches.length === 0 && (
            <p className="text-center text-sm text-muted-foreground py-4">
              No strong matches found. Try again with different priorities.
            </p>
          )}

          {/* Bottom CTAs */}
          <div className="flex flex-col items-center gap-3 pt-4">
            <Button variant="outline" onClick={onReset} className="gap-2 min-h-[44px]">
              <RotateCcw className="h-4 w-4" />
              Start over
            </Button>

            <Link
              href="/match?type=spo"
              className="text-sm text-muted-foreground hover:text-foreground transition-colors inline-flex items-center gap-1"
            >
              Looking for a stake pool? Complete your governance team
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        </motion.div>
      )}
    </div>
  );
}
