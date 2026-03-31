'use client';

import { useState, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, ChevronRight, Sparkles, ArrowRight, User, Zap } from 'lucide-react';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import type { AlignmentScores } from '@/lib/drepIdentity';
import { buildAlignmentFromAnswers } from '@/lib/matching/answerVectors';
import type { MatchResult, QuickMatchResponse } from '@/hooks/useQuickMatch';
import {
  buildMatchStartSequence,
  buildAnswerSequence,
  buildRevealSequence,
  buildMatchCleanupSequence,
} from '@/lib/globe/matchChoreography';

/* ─── Globe Command Types ─────────────────────────────────── */

import type { GlobeCommand } from '@/hooks/useSenecaGlobeBridge';

/* ─── Props ───────────────────────────────────────────────── */

interface CerebroMatchFlowProps {
  /** Callback to dispatch globe commands (flyTo, highlight, pulse, etc.) */
  onGlobeCommand: (command: GlobeCommand) => void;
  /** Called when match completes with results */
  onMatchComplete?: (results: MatchResult[]) => void;
  /** Called when user cancels */
  onCancel?: () => void;
}

/* ─── State Machine ───────────────────────────────────────── */

type MatchPhase = 'idle' | 'questioning' | 'computing' | 'results' | 'done';

/* ─── Round Definitions ───────────────────────────────────── */

interface RoundDef {
  question: string;
  questionId: string;
  options: Array<{ label: string; answerKey: string }>;
}

const ROUNDS: RoundDef[] = [
  {
    question: 'What matters most to you in Cardano governance?',
    questionId: 'treasury',
    options: [
      { label: 'Protecting the treasury', answerKey: 'conservative' },
      { label: 'Funding innovation', answerKey: 'growth' },
      { label: 'Balanced approach', answerKey: 'balanced' },
    ],
  },
  {
    question: 'How should Cardano approach protocol changes?',
    questionId: 'protocol',
    options: [
      { label: 'Security and caution first', answerKey: 'caution' },
      { label: 'Move fast, embrace innovation', answerKey: 'innovation' },
      { label: 'Case by case evaluation', answerKey: 'case_by_case' },
    ],
  },
  {
    question: 'How important is transparency in governance?',
    questionId: 'transparency',
    options: [
      { label: 'Essential — full visibility', answerKey: 'essential' },
      { label: 'Nice to have', answerKey: 'nice_to_have' },
      { label: "Doesn't matter much", answerKey: 'doesnt_matter' },
    ],
  },
  {
    question: 'How should voting power be distributed?',
    questionId: 'decentralization',
    options: [
      { label: 'Spread as widely as possible', answerKey: 'spread_widely' },
      { label: 'Concentrate with experts', answerKey: 'concentrated' },
      { label: 'Current balance is fine', answerKey: 'current_fine' },
    ],
  },
  {
    question: "What's the biggest risk facing Cardano governance?",
    questionId: 'governance_risk',
    options: [
      { label: 'Voter apathy', answerKey: 'voter_apathy' },
      { label: 'Plutocracy (whale dominance)', answerKey: 'plutocracy' },
      { label: 'Moving too slowly', answerKey: 'too_slow' },
      { label: 'Lack of accountability', answerKey: 'lack_accountability' },
    ],
  },
  {
    question: 'How should DReps engage with their delegators?',
    questionId: 'drep_engagement',
    options: [
      { label: 'Regular updates & rationales', answerKey: 'regular_updates' },
      { label: 'Only on major decisions', answerKey: 'major_decisions_only' },
      { label: 'Delegators should trust and verify independently', answerKey: 'trust_and_verify' },
    ],
  },
  {
    question: "What's your priority for treasury spending this year?",
    questionId: 'spending_priority',
    options: [
      { label: 'Developer tooling & infrastructure', answerKey: 'dev_tooling' },
      { label: 'Community education & outreach', answerKey: 'community_education' },
      { label: 'DeFi & ecosystem growth', answerKey: 'defi_growth' },
      { label: 'Constitutional development', answerKey: 'constitutional_dev' },
    ],
  },
];

/** Minimum questions before "Match me now" appears */
const MIN_QUESTIONS_FOR_MATCH = 2;

/* ─── Helpers ─────────────────────────────────────────────── */

function alignmentToArray(scores: AlignmentScores): number[] {
  return [
    scores.treasuryConservative ?? 50,
    scores.treasuryGrowth ?? 50,
    scores.decentralization ?? 50,
    scores.security ?? 50,
    scores.innovation ?? 50,
    scores.transparency ?? 50,
  ];
}

function getConfidenceLabel(answeredCount: number): { label: string; pct: number } {
  if (answeredCount >= 7) return { label: 'Deep match', pct: 95 };
  if (answeredCount >= 5) return { label: 'Strong match', pct: 85 };
  if (answeredCount >= 4) return { label: 'Good match', pct: 75 };
  if (answeredCount >= 2) return { label: 'Basic match', pct: 50 };
  return { label: 'Warming up', pct: 25 };
}

/* ─── Component ───────────────────────────────────────────── */

export function CerebroMatchFlow({
  onGlobeCommand,
  onMatchComplete,
  onCancel,
}: CerebroMatchFlowProps) {
  const [phase, setPhase] = useState<MatchPhase>('idle');
  const [roundIndex, setRoundIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [results, setResults] = useState<MatchResult[]>([]);
  const [error, setError] = useState<string | null>(null);
  const submittingRef = useRef(false);

  const answeredCount = Object.keys(answers).length;

  /* ── Submit match request ── */
  const submitMatch = useCallback(
    async (finalAnswers: Record<string, string>) => {
      if (submittingRef.current) return;
      submittingRef.current = true;
      setPhase('computing');
      setError(null);

      onGlobeCommand({ type: 'dim' });

      try {
        const res = await fetch('/api/governance/quick-match', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            treasury: finalAnswers.treasury,
            protocol: finalAnswers.protocol,
            transparency: finalAnswers.transparency,
            decentralization: finalAnswers.decentralization,
            governance_risk: finalAnswers.governance_risk,
            drep_engagement: finalAnswers.drep_engagement,
            spending_priority: finalAnswers.spending_priority,
          }),
        });

        if (!res.ok) {
          throw new Error(`Match failed: ${res.status}`);
        }

        const data: QuickMatchResponse = await res.json();
        const topMatches = data.matches.slice(0, 5);
        setResults(topMatches);
        setPhase('results');

        const finalAlignment = buildAlignmentFromAnswers(finalAnswers);
        onGlobeCommand(
          buildRevealSequence(
            topMatches.map((m) => ({ nodeId: m.drepId })),
            alignmentToArray(finalAlignment),
            60,
          ),
        );

        onMatchComplete?.(topMatches);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Match failed');
        setPhase('questioning'); // Allow retry
      } finally {
        submittingRef.current = false;
      }
    },
    [onGlobeCommand, onMatchComplete],
  );

  /* ── Handle pill selection ── */
  const handleSelect = useCallback(
    (questionId: string, answerKey: string) => {
      const updated = { ...answers, [questionId]: answerKey };
      setAnswers(updated);

      // Globe choreography for this answer
      const updatedAlignment = buildAlignmentFromAnswers(updated);
      onGlobeCommand(
        buildAnswerSequence(roundIndex, alignmentToArray(updatedAlignment), 9999, ROUNDS.length),
      );

      // Advance to next round after brief pause
      setTimeout(() => {
        const nextIdx = roundIndex + 1;
        if (nextIdx >= ROUNDS.length) {
          // All questions answered — auto-submit
          submitMatch(updated);
        } else {
          setRoundIndex(nextIdx);
        }
      }, 600);
    },
    [answers, roundIndex, onGlobeCommand, submitMatch],
  );

  /* ── "Match me now" — early exit with current answers ── */
  const handleMatchNow = useCallback(() => {
    // Fill defaults for missing core questions
    const filled: Record<string, string> = {
      ...answers,
      treasury: answers.treasury || 'balanced',
      protocol: answers.protocol || 'case_by_case',
    };
    setAnswers(filled);
    submitMatch(filled);
  }, [answers, submitMatch]);

  /* ── Cancel ── */
  const handleCancel = useCallback(() => {
    onGlobeCommand(buildMatchCleanupSequence());
    setPhase('idle');
    setRoundIndex(0);
    setAnswers({});
    setResults([]);
    onCancel?.();
  }, [onGlobeCommand, onCancel]);

  /* ── Start flow ── */
  const handleStart = useCallback(() => {
    onGlobeCommand(buildMatchStartSequence());
    setPhase('questioning');
    setRoundIndex(0);
    setAnswers({});
    setResults([]);
    setError(null);
  }, [onGlobeCommand]);

  /* ── Done ── */
  const handleDone = useCallback(() => {
    setPhase('done');
  }, []);

  /* ─── Render ────────────────────────────────────────────── */

  const currentRound =
    phase === 'questioning' && roundIndex < ROUNDS.length ? ROUNDS[roundIndex] : null;
  const showMatchNow = answeredCount >= MIN_QUESTIONS_FOR_MATCH && phase === 'questioning';
  const confidence = getConfidenceLabel(answeredCount);

  return (
    <AnimatePresence mode="wait">
      {/* ── Idle: Start Button ── */}
      {phase === 'idle' && (
        <motion.div
          key="idle"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          className="absolute bottom-8 left-1/2 z-30 -translate-x-1/2"
        >
          <button
            onClick={handleStart}
            className={cn(
              'flex items-center gap-2 rounded-full px-6 py-3',
              'bg-teal-500/20 text-teal-400 backdrop-blur-xl',
              'border border-teal-500/30',
              'text-sm font-medium transition-all',
              'hover:bg-teal-500/30 hover:border-teal-500/50',
              'hover:shadow-lg hover:shadow-teal-500/10',
            )}
          >
            <Sparkles className="h-4 w-4" />
            Find Your DRep Match
          </button>
        </motion.div>
      )}

      {/* ── Round Questions ── */}
      {currentRound && (
        <motion.div
          key={`round-${roundIndex}`}
          initial={{ opacity: 0, y: 30, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -20, scale: 0.95 }}
          transition={{ type: 'spring', stiffness: 300, damping: 30 }}
          className={cn(
            'absolute bottom-8 left-1/2 z-30 w-full max-w-md -translate-x-1/2',
            'rounded-2xl border border-border/50 bg-background/80 p-6 backdrop-blur-xl',
            'shadow-2xl shadow-black/40',
          )}
        >
          {/* Header */}
          <div className="mb-1 flex items-center justify-between">
            <div className="flex items-center gap-2">
              {/* Round indicators */}
              <div className="flex gap-1">
                {ROUNDS.map((_, i) => (
                  <div
                    key={i}
                    className={cn(
                      'h-1.5 rounded-full transition-colors duration-300',
                      i < ROUNDS.length ? 'w-4' : 'w-4',
                      i < roundIndex
                        ? 'bg-teal-400'
                        : i === roundIndex
                          ? 'bg-teal-400/60'
                          : 'bg-muted-foreground/20',
                    )}
                  />
                ))}
              </div>
              <span className="ml-2 text-xs text-muted-foreground">
                {roundIndex + 1}/{ROUNDS.length}
              </span>
            </div>
            <button
              onClick={handleCancel}
              className="rounded-full p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              aria-label="Cancel match"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Confidence indicator */}
          {answeredCount > 0 && (
            <div className="mb-2 flex items-center gap-2">
              <div className="h-1 flex-1 rounded-full bg-muted-foreground/10">
                <motion.div
                  className="h-full rounded-full bg-teal-500/50"
                  initial={{ width: '0%' }}
                  animate={{ width: `${confidence.pct}%` }}
                  transition={{ duration: 0.4 }}
                />
              </div>
              <span className="text-[10px] text-muted-foreground">{confidence.label}</span>
            </div>
          )}

          {/* Question */}
          <h3 className="mb-4 mt-3 font-[family-name:var(--font-heading)] text-lg font-semibold text-foreground">
            {currentRound.question}
          </h3>

          {/* Pill Options */}
          <div className="flex flex-col gap-2">
            {currentRound.options.map((option, i) => (
              <motion.button
                key={option.answerKey}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.08 }}
                onClick={() => handleSelect(currentRound.questionId, option.answerKey)}
                className={cn(
                  'flex items-center justify-between rounded-full px-4 py-2.5',
                  'border border-border/50 bg-background/60',
                  'text-left text-sm font-medium text-foreground',
                  'transition-all duration-200',
                  'hover:border-teal-500/50 hover:bg-teal-500/10 hover:text-teal-300',
                  'active:scale-[0.98]',
                )}
              >
                <span>{option.label}</span>
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              </motion.button>
            ))}
          </div>

          {/* "Match me now" CTA — appears after MIN_QUESTIONS_FOR_MATCH */}
          {showMatchNow && (
            <motion.button
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              onClick={handleMatchNow}
              className={cn(
                'mt-3 flex w-full items-center justify-center gap-2 rounded-full px-4 py-2.5',
                'bg-teal-500/15 text-sm font-semibold text-teal-400',
                'border border-teal-500/30',
                'transition-all hover:bg-teal-500/25 hover:border-teal-500/50',
              )}
            >
              <Zap className="h-4 w-4" />
              Match me now ({confidence.label.toLowerCase()})
            </motion.button>
          )}
        </motion.div>
      )}

      {/* ── Computing ── */}
      {phase === 'computing' && (
        <motion.div
          key="computing"
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.9 }}
          className={cn(
            'absolute bottom-8 left-1/2 z-30 w-full max-w-sm -translate-x-1/2',
            'rounded-2xl border border-border/50 bg-background/80 p-6 backdrop-blur-xl',
            'shadow-2xl shadow-black/40',
          )}
        >
          <div className="flex flex-col items-center gap-3">
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
            >
              <Sparkles className="h-6 w-6 text-teal-400" />
            </motion.div>
            <p className="text-sm font-medium text-foreground">Scanning the constellation...</p>
            <p className="text-xs text-muted-foreground">
              Finding representatives aligned with your values
            </p>
          </div>
        </motion.div>
      )}

      {/* ── Results ── */}
      {phase === 'results' && (
        <motion.div
          key="results"
          initial={{ opacity: 0, y: 30, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -20 }}
          transition={{ type: 'spring', stiffness: 300, damping: 30 }}
          className={cn(
            'absolute bottom-8 left-1/2 z-30 w-full max-w-md -translate-x-1/2',
            'rounded-2xl border border-border/50 bg-background/80 p-6 backdrop-blur-xl',
            'shadow-2xl shadow-black/40',
          )}
        >
          {/* Header */}
          <div className="mb-4 flex items-center justify-between">
            <h3 className="font-[family-name:var(--font-heading)] text-lg font-semibold text-foreground">
              Your Top Matches
            </h3>
            <button
              onClick={handleCancel}
              className="rounded-full p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              aria-label="Close results"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {error && (
            <div className="mb-3 rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-400">
              {error}
            </div>
          )}

          {results.length === 0 && !error && (
            <p className="py-4 text-center text-sm text-muted-foreground">
              No strong matches found. Try adjusting your preferences.
            </p>
          )}

          {/* Match List */}
          <div className="flex flex-col gap-2">
            {results.map((match, i) => (
              <motion.div
                key={match.drepId}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.1 }}
                className={cn(
                  'flex items-center gap-3 rounded-xl border border-border/40 bg-background/40 p-3',
                  'transition-all duration-200 hover:border-teal-500/40 hover:bg-teal-500/5',
                )}
              >
                {/* Rank */}
                <div
                  className={cn(
                    'flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold',
                    i === 0 ? 'bg-teal-500/20 text-teal-400' : 'bg-muted text-muted-foreground',
                  )}
                >
                  {i + 1}
                </div>

                {/* Info */}
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-foreground">
                    {match.drepName || `${match.drepId.slice(0, 8)}...${match.drepId.slice(-6)}`}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {match.matchScore}% match
                    {match.signatureInsight && ` · ${match.signatureInsight}`}
                  </p>
                </div>

                {/* Score Badge */}
                <div className="shrink-0 rounded-full bg-teal-500/10 px-2.5 py-0.5 text-xs font-semibold text-teal-400">
                  {match.matchScore}%
                </div>

                {/* View Link */}
                <Link
                  href={`/drep/${match.drepId}`}
                  className={cn(
                    'flex shrink-0 items-center gap-1 rounded-full px-3 py-1.5',
                    'border border-border/50 bg-background/60 text-xs font-medium text-foreground',
                    'transition-all hover:border-teal-500/50 hover:text-teal-400',
                  )}
                  onClick={() => {
                    onGlobeCommand({ type: 'flyTo', nodeId: match.drepId });
                  }}
                >
                  <User className="h-3 w-3" />
                  View
                </Link>
              </motion.div>
            ))}
          </div>

          {/* Actions */}
          <div className="mt-4 flex items-center justify-between">
            <button
              onClick={handleStart}
              className="text-xs text-muted-foreground transition-colors hover:text-foreground"
            >
              Try again
            </button>
            <button
              onClick={handleDone}
              className={cn(
                'flex items-center gap-1.5 rounded-full px-4 py-2',
                'bg-teal-500/20 text-sm font-medium text-teal-400',
                'transition-all hover:bg-teal-500/30',
              )}
            >
              Done
              <ArrowRight className="h-3.5 w-3.5" />
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
