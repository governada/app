'use client';

import { useState, useCallback, useMemo } from 'react';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import type { AlignmentScores } from '@/lib/drepIdentity';
import {
  loadMatchProfile,
  saveMatchProfile,
  alignmentDistance,
  distanceToMatchScore,
  type StoredMatchProfile,
} from '@/lib/matchStore';
import { useGovernanceDepth } from '@/hooks/useGovernanceDepth';
import { InlineQuickMatch } from './InlineQuickMatch';
import {
  Users,
  TrendingUp,
  TrendingDown,
  Minus,
  CheckCircle2,
  XCircle,
  Compass,
} from 'lucide-react';

/* ─── Types ───────────────────────────────────────────── */

interface SpoProfileClientProps {
  poolId: string;
  poolName: string;
  poolAlignments: AlignmentScores;
  delegatorCount: number;
  scoreMomentum: number | null;
}

/* ─── Alignment computation ───────────────────────────── */

const ALIGNMENT_DIMS: { key: keyof AlignmentScores; label: string }[] = [
  { key: 'treasuryConservative', label: 'Treasury (Conservative)' },
  { key: 'treasuryGrowth', label: 'Treasury (Growth)' },
  { key: 'decentralization', label: 'Decentralization' },
  { key: 'security', label: 'Security' },
  { key: 'innovation', label: 'Innovation' },
  { key: 'transparency', label: 'Transparency' },
];

function computeSpoAlignment(user: AlignmentScores, spo: AlignmentScores) {
  const distance = alignmentDistance(user, spo);
  const matchScore = distanceToMatchScore(distance);

  const agreements: string[] = [];
  const disagreements: string[] = [];

  for (const dim of ALIGNMENT_DIMS) {
    const userVal = (user[dim.key] as number) ?? 50;
    const spoVal = (spo[dim.key] as number) ?? 50;
    const diff = Math.abs(userVal - spoVal);

    if (spoVal !== 50 && diff <= 15) {
      agreements.push(dim.label);
    } else if (diff >= 30) {
      disagreements.push(dim.label);
    }
  }

  return { matchScore, agreements, disagreements };
}

/* ─── Trend config ────────────────────────────────────── */

const TREND_CONFIG = {
  growing: { icon: TrendingUp, label: 'Score rising', className: 'text-emerald-500' },
  stable: { icon: Minus, label: 'Score stable', className: 'text-muted-foreground' },
  declining: { icon: TrendingDown, label: 'Score declining', className: 'text-amber-500' },
} as const;

/* ─── Component ───────────────────────────────────────── */

export function SpoProfileClient({
  poolId,
  poolName,
  poolAlignments,
  delegatorCount,
  scoreMomentum,
}: SpoProfileClientProps) {
  const { isAtLeast } = useGovernanceDepth();

  // Check localStorage for existing Quick Match results
  const [localAlignment, setLocalAlignment] = useState<AlignmentScores | null>(() => {
    if (typeof window === 'undefined') return null;
    const profile = loadMatchProfile();
    return profile?.userAlignments ?? null;
  });

  // Compute alignment when user has quiz results
  const alignmentResult = useMemo(() => {
    if (!localAlignment) return null;
    const hasPoolAlignment =
      poolAlignments.treasuryConservative != null || poolAlignments.decentralization != null;
    if (!hasPoolAlignment) return null;
    return computeSpoAlignment(localAlignment, poolAlignments);
  }, [localAlignment, poolAlignments]);

  // Handle quiz completion — save and switch to alignment view
  const handleMatchComplete = useCallback((alignment: AlignmentScores) => {
    saveMatchProfile({
      userAlignments: alignment,
      personalityLabel: '',
      identityColor: '',
      matchType: 'spo',
      answers: {},
      timestamp: Date.now(),
    } satisfies StoredMatchProfile);
    setLocalAlignment(alignment);
  }, []);

  const hasAlignment = !!localAlignment;
  const hasAlignmentResult = !!alignmentResult;

  // Momentum display
  const momentumLabel =
    scoreMomentum !== null
      ? scoreMomentum > 3
        ? 'growing'
        : scoreMomentum >= -3
          ? 'stable'
          : 'declining'
      : ('stable' as const);

  const trend = TREND_CONFIG[momentumLabel];
  const TrendIcon = trend.icon;

  return (
    <div className="space-y-4">
      {hasAlignment && hasAlignmentResult ? (
        /* ── Alignment Result (Decision Engine equivalent) ── */
        <div className="rounded-xl border border-primary/20 bg-card/70 backdrop-blur-md p-5 sm:p-6 space-y-4">
          <div className="space-y-2">
            <div className="flex items-center gap-2 mb-1">
              <Compass className="h-4 w-4 text-primary" />
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Governance Values Alignment
              </span>
            </div>
            <div className="flex items-baseline gap-3">
              <span className="text-3xl font-bold font-mono tabular-nums text-primary">
                {alignmentResult.matchScore}%
              </span>
              <span className="text-sm text-muted-foreground">
                alignment with <span className="text-foreground font-medium">{poolName}</span>
              </span>
            </div>
            <p className="text-xs text-muted-foreground">
              Based on your Quick Match preferences and this pool&apos;s voting patterns
            </p>
          </div>

          {(alignmentResult.agreements.length > 0 || alignmentResult.disagreements.length > 0) && (
            <div className="grid gap-3 sm:grid-cols-2">
              {alignmentResult.agreements.length > 0 && (
                <div className="space-y-1.5">
                  <span className="text-xs font-medium text-emerald-500">You agree on</span>
                  {alignmentResult.agreements.map((dim) => (
                    <div
                      key={dim}
                      className="flex items-center gap-1.5 text-sm text-muted-foreground"
                    >
                      <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
                      {dim}
                    </div>
                  ))}
                </div>
              )}
              {alignmentResult.disagreements.length > 0 && (
                <div className="space-y-1.5">
                  <span className="text-xs font-medium text-amber-500">You differ on</span>
                  {alignmentResult.disagreements.map((dim) => (
                    <div
                      key={dim}
                      className="flex items-center gap-1.5 text-sm text-muted-foreground"
                    >
                      <XCircle className="h-3.5 w-3.5 text-amber-500 shrink-0" />
                      {dim}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          <div className="text-xs text-muted-foreground border-t border-border/30 pt-3">
            <Link href="/match" className="text-primary hover:underline">
              Retake the quiz
            </Link>{' '}
            to update your preferences
          </div>
        </div>
      ) : isAtLeast('deep') ? (
        /* ── Deep depth without alignment — prompt to quiz ── */
        <div className={cn('rounded-lg border p-6 text-center')}>
          <p className="text-muted-foreground">
            Take the{' '}
            <Link href="/match" className="underline">
              Quick Match quiz
            </Link>{' '}
            to see how this pool aligns with your governance values.
          </p>
        </div>
      ) : (
        /* ── Discovery Mode — quiz + social proof ── */
        <>
          <InlineQuickMatch
            drepName={poolName}
            drepId={poolId}
            onMatchComplete={handleMatchComplete}
          />

          {/* Social proof */}
          <div className="rounded-xl border border-border/50 bg-card/70 backdrop-blur-md px-5 py-4 space-y-2">
            <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
              <span className="flex items-center gap-1.5">
                <Users className="h-4 w-4 text-primary/70" />
                <span className="font-medium text-foreground tabular-nums">
                  {delegatorCount.toLocaleString()}
                </span>{' '}
                delegators trust this pool
              </span>
              <span className={cn('flex items-center gap-1', trend.className)}>
                <TrendIcon className="h-3.5 w-3.5" />
                <span className="text-xs">{trend.label}</span>
              </span>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
