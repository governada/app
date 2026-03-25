'use client';

/**
 * TreasuryFutures — World-class interactive treasury visualization.
 *
 * Three modes:
 *   Explore  — Baseline projection with per-proposal toggle
 *   Simulate — Spending rate slider with pinnable scenario comparison
 *   Predict  — Draw-your-forecast with cinematic reveal
 *
 * Replaces both TreasurySimulator.tsx and YouDrawIt.tsx with a unified,
 * visually stunning experience built on D3 scales and raw SVG.
 */

import {
  useState,
  useCallback,
  useMemo,
  useRef,
  useEffect,
  type MouseEvent,
  type TouchEvent,
} from 'react';
import { scaleLinear } from 'd3-scale';
import { line as d3line, area as d3area, curveMonotoneX } from 'd3-shape';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Eye, Sliders, Pencil, Share2, RotateCcw, Pin } from 'lucide-react';
import { useChartDimensions } from '@/lib/charts/useChartDimensions';
import { GlowFilter, AreaGradient } from '@/lib/charts/GlowDefs';
import { chartTheme } from '@/lib/charts/theme';
import { spring, fadeInUp } from '@/lib/animations';
import { posthog } from '@/lib/posthog';
import { formatAda } from '@/lib/treasury';
import { useTreasuryHistory, useTreasurySimulate, useTreasuryPending } from '@/hooks/queries';

// ── Types ────────────────────────────────────────────────────────────────────

type FuturesMode = 'explore' | 'simulate' | 'predict';

interface HistoryEntry {
  epoch: number;
  balanceAda: number;
  withdrawalsAda?: number;
}

interface SimulationScenario {
  key: string;
  name: string;
  projectedMonths: number;
  depletionEpoch: number | null;
  balanceCurve: Array<{ epoch: number; balanceAda: number }>;
}

interface SimulationData {
  currentBalance: number;
  currentEpoch: number;
  burnRatePerEpoch: number;
  avgIncomePerEpoch: number;
  pendingTotalAda: number;
  scenarios: SimulationScenario[];
  counterfactual?: {
    totalWithdrawnAda: number;
    largestWithdrawals: Array<{ title: string; amountAda: number; epoch: number }>;
    hypotheticalBalanceAda: number;
    additionalRunwayMonths: number;
  };
}

interface PendingProposal {
  txHash: string;
  index: number;
  title: string;
  withdrawalAda: number;
  pctOfBalance: number;
  treasuryTier: string;
  proposedEpoch: number;
}

interface DrawnPoint {
  epoch: number;
  balanceAda: number;
}

interface SavedScenario {
  id: number;
  burnAdjust: number;
  label: string;
  curve: Array<{ epoch: number; balanceAda: number }>;
  color: string;
}

type PredictPhase = 'challenge' | 'drawing' | 'reveal' | 'complete';
type PredictionResult = 'close' | 'optimistic' | 'pessimistic';

// ── Constants ────────────────────────────────────────────────────────────────

const CHART_HEIGHT = 420;
const FUTURE_EPOCHS = 30;

const COLORS = {
  historical: 'oklch(0.72 0.14 200)',
  projection: 'oklch(0.72 0.14 200)',
  projectionDash: 'oklch(0.80 0.17 200)',
  userDraw: 'oklch(0.80 0.16 80)',
  reveal: 'oklch(0.72 0.17 160)',
  fillHistorical: 'oklch(0.72 0.14 200 / 0.06)',
  fillProjection: 'oklch(0.72 0.14 200 / 0.04)',
  proposalChip: 'oklch(0.75 0.14 80)',
} as const;

const SAVED_SCENARIO_COLORS = [
  'oklch(0.75 0.14 80)', // amber
  'oklch(0.60 0.18 290)', // violet
  'oklch(0.68 0.16 160)', // emerald
];

const MODE_TABS: { key: FuturesMode; label: string; icon: typeof Eye }[] = [
  { key: 'explore', label: 'Explore', icon: Eye },
  { key: 'simulate', label: 'Simulate', icon: Sliders },
  { key: 'predict', label: 'Predict', icon: Pencil },
];

// ── Seneca Commentary Lines ──────────────────────────────────────────────────

function getSenecaCommentary(
  mode: FuturesMode,
  context: {
    pendingCount?: number;
    pendingTotalAda?: number;
    runwayMonths?: number;
    predictionResult?: PredictionResult;
    burnAdjust?: number;
  },
): string {
  const {
    pendingCount = 0,
    pendingTotalAda = 0,
    runwayMonths = 0,
    predictionResult,
    burnAdjust = 1,
  } = context;

  if (mode === 'explore') {
    if (pendingCount === 0) {
      return 'No proposals await the treasury. A quiet moment — but governance never sleeps.';
    }
    return `${pendingCount} proposal${pendingCount > 1 ? 's' : ''} request${pendingCount === 1 ? 's' : ''} ${formatAda(pendingTotalAda)} from the common wealth. Whether this is investment or indulgence depends on what they build.`;
  }

  if (mode === 'simulate') {
    if (burnAdjust === 0) {
      return 'A frozen treasury is a hoarded treasury. Wealth undeployed is potential unrealized.';
    }
    if (runwayMonths >= 999) {
      return 'At this rate the treasury outlasts us all. The question is not longevity — it is deployment.';
    }
    if (runwayMonths > 120) {
      return `At this rate, the treasury sustains operations for ${Math.round(runwayMonths / 12)} years. The question is not whether there is enough — it is whether it is being deployed wisely.`;
    }
    if (runwayMonths > 24) {
      return `${Math.round(runwayMonths / 12)} years of runway remains. Comfortable — but comfort breeds complacency.`;
    }
    return `Only ${runwayMonths} months of runway. Urgency concentrates the mind. Every proposal must now earn its place.`;
  }

  if (mode === 'predict') {
    if (!predictionResult) {
      return 'Where do you think the treasury is heading? Draw your prediction — then face reality.';
    }
    switch (predictionResult) {
      case 'close':
        return 'Your intuition matches the data. A rare gift — most govern by instinct alone.';
      case 'optimistic':
        return 'Hope is admirable. But the treasury answers to mathematics, not aspiration.';
      case 'pessimistic':
        return 'Your intuition was pessimistic. The treasury is more resilient than most assume — provided governance remains active.';
    }
  }

  return '';
}

// ── Prediction Comparison ────────────────────────────────────────────────────

function comparePrediction(
  drawnPoints: DrawnPoint[],
  projectedData: Array<{ epoch: number; balanceAda: number }>,
): { result: PredictionResult; pctDiff: number; userFinal: number; projectedFinal: number } {
  if (drawnPoints.length === 0) {
    return { result: 'close', pctDiff: 0, userFinal: 0, projectedFinal: 0 };
  }
  const userFinalPoint = drawnPoints[drawnPoints.length - 1];
  const projectedAtSameEpoch = projectedData.reduce((best, p) =>
    Math.abs(p.epoch - userFinalPoint.epoch) < Math.abs(best.epoch - userFinalPoint.epoch)
      ? p
      : best,
  );
  const projectedBalance = projectedAtSameEpoch.balanceAda;
  const pctDiff =
    projectedBalance > 0 ? (userFinalPoint.balanceAda - projectedBalance) / projectedBalance : 0;

  let result: PredictionResult;
  if (Math.abs(pctDiff) <= 0.15) result = 'close';
  else if (pctDiff > 0) result = 'optimistic';
  else result = 'pessimistic';

  return {
    result,
    pctDiff,
    userFinal: userFinalPoint.balanceAda,
    projectedFinal: projectedBalance,
  };
}

// ── Main Component ───────────────────────────────────────────────────────────

export default function TreasuryFutures() {
  const [mode, setMode] = useState<FuturesMode>('explore');

  // ── Data hooks ──────────────────────────────────────────────────────
  const { data: historyRaw, isLoading: historyLoading } = useTreasuryHistory(50);
  const [burnAdjust, setBurnAdjust] = useState(1);
  const { data: simRaw, isLoading: simLoading } = useTreasurySimulate(burnAdjust);
  const { data: pendingRaw } = useTreasuryPending();

  const historyObj = historyRaw as { snapshots?: HistoryEntry[] } | undefined;
  const history = historyObj?.snapshots;
  const simulation = simRaw as SimulationData | undefined;
  const pending = pendingRaw as { proposals: PendingProposal[]; totalAda: number } | undefined;
  const loading = historyLoading || simLoading;

  // ── Derived data ────────────────────────────────────────────────────
  const historicalData = useMemo<DrawnPoint[]>(() => {
    if (!history) return [];
    return history
      .map((h) => ({ epoch: h.epoch, balanceAda: h.balanceAda }))
      .sort((a, b) => a.epoch - b.epoch);
  }, [history]);

  const currentEpoch = useMemo(
    () =>
      simulation?.currentEpoch ??
      (historicalData.length > 0 ? historicalData[historicalData.length - 1].epoch : 0),
    [simulation, historicalData],
  );

  const currentBalance = useMemo(
    () =>
      simulation?.currentBalance ??
      (historicalData.length > 0 ? historicalData[historicalData.length - 1].balanceAda : 0),
    [simulation, historicalData],
  );

  const baselineProjection = useMemo<DrawnPoint[]>(() => {
    if (!simulation?.scenarios) return [];
    const conservative = simulation.scenarios.find((s) => s.key === 'conservative');
    if (!conservative) return simulation.scenarios[0]?.balanceCurve ?? [];
    return conservative.balanceCurve.filter((p) => p.epoch >= currentEpoch);
  }, [simulation, currentEpoch]);

  const pendingProposals = useMemo(() => pending?.proposals ?? [], [pending?.proposals]);
  const runwayMonths =
    simulation?.scenarios?.find((s) => s.key === 'conservative')?.projectedMonths ?? 0;

  // ── Explore mode: proposal toggles ──────────────────────────────────
  const [disabledProposals, setDisabledProposals] = useState<Set<string>>(new Set());

  const toggleProposal = useCallback((key: string) => {
    setDisabledProposals((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }, []);

  const activeProposalTotal = useMemo(() => {
    return pendingProposals
      .filter((p) => !disabledProposals.has(`${p.txHash}-${p.index}`))
      .reduce((sum, p) => sum + p.withdrawalAda, 0);
  }, [pendingProposals, disabledProposals]);

  // Compute the explore projection: baseline adjusted by toggled proposals
  const exploreProjection = useMemo<DrawnPoint[]>(() => {
    if (!baselineProjection.length || !currentBalance) return baselineProjection;
    // Simple approach: adjust the baseline by the ratio of disabled proposal ADA
    const totalPending = pendingProposals.reduce((s, p) => s + p.withdrawalAda, 0);
    const removedAda = totalPending - activeProposalTotal;
    if (removedAda === 0 || totalPending === 0) return baselineProjection;

    // Shift the entire curve up by the removed amount, scaled linearly
    return baselineProjection.map((pt) => ({
      epoch: pt.epoch,
      balanceAda: pt.balanceAda + removedAda,
    }));
  }, [baselineProjection, pendingProposals, activeProposalTotal, currentBalance]);

  const setExplorePreset = useCallback(
    (preset: 'all' | 'none' | 'pace') => {
      if (preset === 'all') {
        setDisabledProposals(new Set());
      } else if (preset === 'none') {
        setDisabledProposals(new Set(pendingProposals.map((p) => `${p.txHash}-${p.index}`)));
      } else {
        // Current pace: keep roughly half
        const half = Math.ceil(pendingProposals.length / 2);
        setDisabledProposals(
          new Set(pendingProposals.slice(half).map((p) => `${p.txHash}-${p.index}`)),
        );
      }
      posthog.capture('treasury_futures_used', { mode: 'explore', action: `preset_${preset}` });
    },
    [pendingProposals],
  );

  // ── Simulate mode ───────────────────────────────────────────────────
  const [savedScenarios, setSavedScenarios] = useState<SavedScenario[]>([]);
  const nextScenarioId = useRef(0);

  const handleBurnChange = useCallback((value: number) => {
    setBurnAdjust(value);
  }, []);

  const saveScenario = useCallback(() => {
    if (!simulation?.scenarios) return;
    const conservative = simulation.scenarios.find((s) => s.key === 'conservative');
    if (!conservative) return;
    if (savedScenarios.length >= 3) return;

    const id = nextScenarioId.current++;
    const color = SAVED_SCENARIO_COLORS[savedScenarios.length % SAVED_SCENARIO_COLORS.length];
    const label = `${Math.round(burnAdjust * 100)}% spend`;

    setSavedScenarios((prev) => [
      ...prev,
      { id, burnAdjust, label, curve: conservative.balanceCurve, color },
    ]);
    posthog.capture('treasury_futures_used', {
      mode: 'simulate',
      action: 'save_scenario',
      burnAdjust,
    });
  }, [simulation, burnAdjust, savedScenarios.length]);

  const clearScenarios = useCallback(() => {
    setSavedScenarios([]);
  }, []);

  // ── Predict mode ────────────────────────────────────────────────────
  const [predictPhase, setPredictPhase] = useState<PredictPhase>('challenge');
  const [drawnPoints, setDrawnPoints] = useState<DrawnPoint[]>([]);
  const [isDrawing, setIsDrawing] = useState(false);
  const [revealProgress, setRevealProgress] = useState(0);
  const [copied, setCopied] = useState(false);
  const prefersReducedMotion = useReducedMotion();
  const hasTrackedPredictStart = useRef(false);

  const comparison = useMemo(() => {
    if (predictPhase !== 'reveal' && predictPhase !== 'complete') return null;
    if (drawnPoints.length === 0) return null;
    return comparePrediction(drawnPoints, baselineProjection);
  }, [predictPhase, drawnPoints, baselineProjection]);

  const resetPredict = useCallback(() => {
    setPredictPhase('challenge');
    setDrawnPoints([]);
    setRevealProgress(0);
    setCopied(false);
    hasTrackedPredictStart.current = false;
  }, []);

  // Reset predict state when switching away
  const handleModeChange = useCallback(
    (newMode: FuturesMode) => {
      setMode(newMode);
      if (newMode !== 'predict') resetPredict();
      posthog.capture('treasury_futures_used', { mode: newMode, action: 'switch_mode' });
    },
    [resetPredict],
  );

  // ── Seneca commentary ───────────────────────────────────────────────
  const senecaText = useMemo(() => {
    return getSenecaCommentary(mode, {
      pendingCount: pendingProposals.length,
      pendingTotalAda: pending?.totalAda ?? 0,
      runwayMonths,
      predictionResult: comparison?.result,
      burnAdjust,
    });
  }, [
    mode,
    pendingProposals.length,
    pending?.totalAda,
    runwayMonths,
    comparison?.result,
    burnAdjust,
  ]);

  // ── Consequence framing ─────────────────────────────────────────────
  const consequenceText = useMemo(() => {
    if (!simulation) return null;
    const avgProposalSize =
      pending?.totalAda && pendingProposals.length > 0
        ? pending.totalAda / pendingProposals.length
        : 5_000_000;
    const proposalsCount = avgProposalSize > 0 ? Math.floor(currentBalance / avgProposalSize) : 0;
    const coverageEpoch =
      runwayMonths >= 999 ? null : currentEpoch + Math.round(runwayMonths / (5 / 30.44));

    const parts: string[] = [];
    if (proposalsCount > 0)
      parts.push(`Enough for ${proposalsCount} more proposals of average size`);
    if (coverageEpoch && runwayMonths < 999)
      parts.push(`Covers operations through epoch ${coverageEpoch}`);
    return parts.length > 0 ? parts : null;
  }, [
    simulation,
    pending?.totalAda,
    pendingProposals.length,
    currentBalance,
    runwayMonths,
    currentEpoch,
  ]);

  // ── Loading state ───────────────────────────────────────────────────
  if (loading && !historicalData.length) {
    return <Skeleton className="h-[560px] w-full rounded-xl" />;
  }

  if (!historicalData.length) return null;

  return (
    <div className="space-y-0 rounded-xl border border-border/30 bg-[oklch(0.11_0.015_240)] overflow-hidden">
      {/* ── Mode Tab Bar ──────────────────────────────────────────── */}
      <div className="flex border-b border-border/20">
        {MODE_TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => handleModeChange(tab.key)}
            className={`flex items-center gap-1.5 px-4 py-2.5 text-xs font-medium transition-colors relative ${
              mode === tab.key
                ? 'text-foreground'
                : 'text-muted-foreground hover:text-foreground/80'
            }`}
          >
            <tab.icon className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">{tab.label}</span>
            {mode === tab.key && (
              <motion.div
                layoutId="futures-tab-indicator"
                className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary rounded-full"
                transition={spring.snappy}
              />
            )}
          </button>
        ))}
      </div>

      {/* ── Mode Controls ─────────────────────────────────────────── */}
      <AnimatePresence mode="wait">
        {mode === 'explore' && (
          <motion.div
            key="explore-controls"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <ExploreControls
              proposals={pendingProposals}
              disabledProposals={disabledProposals}
              onToggle={toggleProposal}
              onPreset={setExplorePreset}
            />
          </motion.div>
        )}
        {mode === 'simulate' && (
          <motion.div
            key="simulate-controls"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <SimulateControls
              burnAdjust={burnAdjust}
              onBurnChange={handleBurnChange}
              onSave={saveScenario}
              onClear={clearScenarios}
              savedCount={savedScenarios.length}
              runwayMonths={runwayMonths}
            />
          </motion.div>
        )}
        {mode === 'predict' && (
          <motion.div
            key="predict-controls"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <PredictControls
              phase={predictPhase}
              onReset={resetPredict}
              onShare={() => {
                if (!comparison) return;
                const direction =
                  comparison.userFinal > comparison.projectedFinal ? 'grow' : 'shrink';
                const text = [
                  `I predicted the Cardano treasury would ${direction} to ${formatAda(comparison.userFinal)} ADA.`,
                  `Reality: ${formatAda(comparison.projectedFinal)} ADA (${Math.abs(Math.round(comparison.pctDiff * 100))}% ${comparison.pctDiff >= 0 ? 'above' : 'below'}).`,
                  '',
                  'Try it yourself at governada.io/governance/treasury',
                ].join('\n');
                navigator.clipboard.writeText(text).then(() => {
                  setCopied(true);
                  setTimeout(() => setCopied(false), 2000);
                });
                posthog.capture('treasury_prediction_shared', {
                  pctDiff: Math.round(comparison.pctDiff * 100),
                });
              }}
              copied={copied}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Chart Canvas ──────────────────────────────────────────── */}
      <FuturesChart
        mode={mode}
        historicalData={historicalData}
        currentEpoch={currentEpoch}
        currentBalance={currentBalance}
        projection={mode === 'explore' ? exploreProjection : baselineProjection}
        pendingProposals={
          mode === 'explore'
            ? pendingProposals.filter((p) => !disabledProposals.has(`${p.txHash}-${p.index}`))
            : []
        }
        savedScenarios={mode === 'simulate' ? savedScenarios : []}
        // Predict mode state
        predictPhase={predictPhase}
        drawnPoints={drawnPoints}
        isDrawing={isDrawing}
        revealProgress={revealProgress}
        onDrawStart={(pt) => {
          if (mode !== 'predict') return;
          if (predictPhase !== 'challenge' && predictPhase !== 'drawing') return;
          if (!hasTrackedPredictStart.current) {
            posthog.capture('treasury_futures_used', { mode: 'predict', action: 'draw_start' });
            hasTrackedPredictStart.current = true;
          }
          setPredictPhase('drawing');
          setIsDrawing(true);
          setDrawnPoints([pt]);
        }}
        onDrawMove={(pt) => {
          if (!isDrawing) return;
          setDrawnPoints((prev) => {
            if (prev.length > 0 && pt.epoch <= prev[prev.length - 1].epoch) return prev;
            return [...prev, pt];
          });
        }}
        onDrawEnd={() => {
          if (!isDrawing) return;
          setIsDrawing(false);
          if (drawnPoints.length >= 2) {
            setPredictPhase('reveal');
            const { pctDiff } = comparePrediction(drawnPoints, baselineProjection);
            posthog.capture('treasury_futures_used', {
              mode: 'predict',
              action: 'draw_complete',
              pctDiff: Math.round(pctDiff * 100),
            });
            if (prefersReducedMotion) {
              setRevealProgress(1);
              setTimeout(() => setPredictPhase('complete'), 300);
            } else {
              const duration = 1500;
              const start = performance.now();
              const animate = (now: number) => {
                const elapsed = now - start;
                const progress = Math.min(elapsed / duration, 1);
                const eased = 1 - Math.pow(1 - progress, 3);
                setRevealProgress(eased);
                if (progress < 1) requestAnimationFrame(animate);
                else setPredictPhase('complete');
              };
              requestAnimationFrame(animate);
            }
          }
        }}
      />

      {/* ── Predict Result ────────────────────────────────────────── */}
      <AnimatePresence>
        {mode === 'predict' && predictPhase === 'complete' && comparison && (
          <motion.div
            key="predict-result"
            className="px-4 pb-2 text-center space-y-2"
            variants={fadeInUp}
            initial="hidden"
            animate="visible"
            exit={{ opacity: 0 }}
          >
            <div className="flex justify-center gap-6 text-sm">
              <div className="text-center">
                <div className="text-muted-foreground text-[10px]">Your prediction</div>
                <div
                  className="font-mono tabular-nums font-semibold"
                  style={{ color: COLORS.userDraw }}
                >
                  {formatAda(comparison.userFinal)}
                </div>
              </div>
              <div className="text-center">
                <div className="text-muted-foreground text-[10px]">Projected</div>
                <div
                  className="font-mono tabular-nums font-semibold"
                  style={{ color: COLORS.reveal }}
                >
                  {formatAda(comparison.projectedFinal)}
                </div>
              </div>
              <div className="text-center">
                <div className="text-muted-foreground text-[10px]">Difference</div>
                <div className="font-mono tabular-nums font-semibold">
                  {comparison.pctDiff >= 0 ? '+' : ''}
                  {Math.round(comparison.pctDiff * 100)}%
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Consequence Framing ────────────────────────────────────── */}
      {consequenceText && mode !== 'predict' && (
        <div className="flex gap-3 px-4 pb-1 justify-center flex-wrap">
          {consequenceText.map((text, i) => (
            <span key={i} className="text-[10px] text-muted-foreground/60 tabular-nums">
              {text}
            </span>
          ))}
        </div>
      )}

      {/* ── Seneca Commentary ─────────────────────────────────────── */}
      <div className="px-4 py-3 border-t border-border/10">
        <AnimatePresence mode="wait">
          <motion.p
            key={senecaText}
            className="text-xs text-muted-foreground italic text-center leading-relaxed"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.4 }}
          >
            &ldquo;{senecaText}&rdquo;
          </motion.p>
        </AnimatePresence>
      </div>
    </div>
  );
}

// ── Explore Controls ─────────────────────────────────────────────────────────

function ExploreControls({
  proposals,
  disabledProposals,
  onToggle,
  onPreset,
}: {
  proposals: PendingProposal[];
  disabledProposals: Set<string>;
  onToggle: (key: string) => void;
  onPreset: (preset: 'all' | 'none' | 'pace') => void;
}) {
  return (
    <div className="px-4 py-3 space-y-2 border-b border-border/10">
      <div className="flex items-center justify-between">
        <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
          Pending Proposals
        </span>
        <div className="flex gap-1">
          {(['all', 'none', 'pace'] as const).map((preset) => (
            <button
              key={preset}
              onClick={() => onPreset(preset)}
              className="px-2 py-0.5 text-[10px] rounded bg-muted/40 text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors capitalize"
            >
              {preset === 'all' ? 'All pass' : preset === 'none' ? 'None pass' : 'Current pace'}
            </button>
          ))}
        </div>
      </div>
      {proposals.length === 0 ? (
        <p className="text-xs text-muted-foreground/60 italic">No pending proposals</p>
      ) : (
        <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto">
          {proposals.map((p) => {
            const key = `${p.txHash}-${p.index}`;
            const active = !disabledProposals.has(key);
            return (
              <button
                key={key}
                onClick={() => onToggle(key)}
                className={`flex items-center gap-1 px-2 py-1 rounded text-[10px] font-medium transition-all ${
                  active
                    ? 'bg-amber-500/15 text-amber-300 border border-amber-500/30'
                    : 'bg-muted/20 text-muted-foreground/50 border border-transparent line-through'
                }`}
                title={p.title}
              >
                <span
                  className={`w-2 h-2 rounded-full shrink-0 ${active ? 'bg-amber-400' : 'bg-muted-foreground/30'}`}
                />
                <span className="truncate max-w-[120px]">{p.title}</span>
                <span className="font-mono tabular-nums opacity-70">
                  {formatAda(p.withdrawalAda)}
                </span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── Simulate Controls ────────────────────────────────────────────────────────

function SimulateControls({
  burnAdjust,
  onBurnChange,
  onSave,
  onClear,
  savedCount,
  runwayMonths,
}: {
  burnAdjust: number;
  onBurnChange: (v: number) => void;
  onSave: () => void;
  onClear: () => void;
  savedCount: number;
  runwayMonths: number;
}) {
  return (
    <div className="px-4 py-3 space-y-3 border-b border-border/10">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
            Spending Rate
          </span>
          <span className="font-mono tabular-nums text-sm font-bold text-foreground">
            {Math.round(burnAdjust * 100)}%
          </span>
        </div>
        <div className="flex items-center gap-3 text-xs">
          <span className="text-muted-foreground">
            Runway:{' '}
            <span className="font-mono tabular-nums font-semibold text-foreground">
              {runwayMonths >= 999 ? '∞' : `${runwayMonths}mo`}
            </span>
          </span>
        </div>
      </div>

      <input
        type="range"
        min={0}
        max={3}
        step={0.05}
        value={burnAdjust}
        onChange={(e) => onBurnChange(parseFloat(e.target.value))}
        className="w-full accent-primary h-1.5"
      />

      <div className="flex items-center justify-between">
        <div className="flex gap-1.5">
          {[
            { label: 'Freeze', value: 0 },
            { label: 'Current', value: 1 },
            { label: '+50%', value: 1.5 },
            { label: '2x', value: 2 },
            { label: '3x', value: 3 },
          ].map((preset) => (
            <button
              key={preset.label}
              onClick={() => onBurnChange(preset.value)}
              className={`px-2 py-0.5 text-[10px] rounded transition-colors ${
                burnAdjust === preset.value
                  ? 'bg-primary/20 text-primary font-semibold'
                  : 'bg-muted/40 text-muted-foreground hover:text-foreground'
              }`}
            >
              {preset.label}
            </button>
          ))}
        </div>
        <div className="flex gap-1.5">
          <Button
            variant="outline"
            size="sm"
            onClick={onSave}
            disabled={savedCount >= 3}
            className="h-6 text-[10px] px-2"
          >
            <Pin className="w-3 h-3 mr-1" />
            Pin ({savedCount}/3)
          </Button>
          {savedCount > 0 && (
            <Button variant="ghost" size="sm" onClick={onClear} className="h-6 text-[10px] px-2">
              Clear
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Predict Controls ─────────────────────────────────────────────────────────

function PredictControls({
  phase,
  onReset,
  onShare,
  copied,
}: {
  phase: PredictPhase;
  onReset: () => void;
  onShare: () => void;
  copied: boolean;
}) {
  return (
    <div className="px-4 py-2 flex items-center justify-between border-b border-border/10">
      <AnimatePresence mode="wait">
        {phase === 'challenge' && (
          <motion.p
            key="challenge"
            className="text-xs text-muted-foreground"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            Draw your prediction on the chart &rarr;
          </motion.p>
        )}
        {phase === 'drawing' && (
          <motion.p
            key="drawing"
            className="text-xs text-amber-400 font-medium"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            Keep drawing... release to reveal.
          </motion.p>
        )}
        {(phase === 'reveal' || phase === 'complete') && (
          <motion.p
            key="result"
            className="text-xs text-emerald-400 font-medium"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            {phase === 'reveal' ? 'Revealing...' : 'Prediction complete'}
          </motion.p>
        )}
      </AnimatePresence>
      <div className="flex gap-1.5">
        {(phase === 'reveal' || phase === 'complete') && (
          <>
            <Button variant="ghost" size="sm" onClick={onReset} className="h-6 text-[10px] px-2">
              <RotateCcw className="w-3 h-3 mr-1" /> Retry
            </Button>
            <Button variant="ghost" size="sm" onClick={onShare} className="h-6 text-[10px] px-2">
              <Share2 className="w-3 h-3 mr-1" /> {copied ? 'Copied!' : 'Share'}
            </Button>
          </>
        )}
      </div>
    </div>
  );
}

// ── Chart Canvas ─────────────────────────────────────────────────────────────

interface FuturesChartProps {
  mode: FuturesMode;
  historicalData: DrawnPoint[];
  currentEpoch: number;
  currentBalance: number;
  projection: DrawnPoint[];
  pendingProposals: PendingProposal[];
  savedScenarios: SavedScenario[];
  // Predict
  predictPhase: 'challenge' | 'drawing' | 'reveal' | 'complete';
  drawnPoints: DrawnPoint[];
  isDrawing: boolean;
  revealProgress: number;
  onDrawStart: (pt: DrawnPoint) => void;
  onDrawMove: (pt: DrawnPoint) => void;
  onDrawEnd: () => void;
}

function FuturesChart({
  mode,
  historicalData,
  currentEpoch,
  currentBalance,
  projection,
  pendingProposals,
  savedScenarios,
  predictPhase,
  drawnPoints,
  isDrawing: _isDrawing,
  revealProgress,
  onDrawStart,
  onDrawMove,
  onDrawEnd,
}: FuturesChartProps) {
  const { containerRef, dimensions } = useChartDimensions(CHART_HEIGHT, {
    left: 56,
    bottom: 36,
    top: 16,
    right: 16,
  });
  const { width, innerWidth, innerHeight, margin } = dimensions;
  const svgRef = useRef<SVGSVGElement>(null);
  const prefersReducedMotion = useReducedMotion();

  const maxFutureEpoch = currentEpoch + FUTURE_EPOCHS;

  // ── Scales ──────────────────────────────────────────────────────
  const allEpochs = useMemo(() => {
    const epochs = [
      ...historicalData.map((d) => d.epoch),
      maxFutureEpoch,
      ...projection.map((d) => d.epoch),
      ...savedScenarios.flatMap((s) => s.curve.map((p) => p.epoch)),
    ];
    return [Math.min(...epochs), Math.max(...epochs)];
  }, [historicalData, projection, savedScenarios, maxFutureEpoch]);

  const allBalances = useMemo(() => {
    const balances = [
      ...historicalData.map((d) => d.balanceAda),
      ...projection.map((d) => d.balanceAda),
      ...drawnPoints.map((d) => d.balanceAda),
      ...savedScenarios.flatMap((s) => s.curve.map((p) => p.balanceAda)),
    ];
    return Math.max(...balances, 1);
  }, [historicalData, projection, drawnPoints, savedScenarios]);

  const xScale = useMemo(
    () => scaleLinear().domain(allEpochs).range([0, innerWidth]),
    [allEpochs, innerWidth],
  );

  const yScale = useMemo(
    () =>
      scaleLinear()
        .domain([0, allBalances * 1.1])
        .range([innerHeight, 0]),
    [allBalances, innerHeight],
  );

  // ── Path generators ─────────────────────────────────────────────
  const lineGen = useMemo(
    () =>
      d3line<DrawnPoint>()
        .x((d) => xScale(d.epoch))
        .y((d) => yScale(d.balanceAda))
        .curve(curveMonotoneX),
    [xScale, yScale],
  );

  const areaGen = useMemo(
    () =>
      d3area<DrawnPoint>()
        .x((d) => xScale(d.epoch))
        .y0(innerHeight)
        .y1((d) => yScale(d.balanceAda))
        .curve(curveMonotoneX),
    [xScale, yScale, innerHeight],
  );

  const historicalPath = useMemo(() => lineGen(historicalData) ?? '', [lineGen, historicalData]);
  const historicalAreaPath = useMemo(
    () => areaGen(historicalData) ?? '',
    [areaGen, historicalData],
  );
  const projectionPath = useMemo(() => lineGen(projection) ?? '', [lineGen, projection]);
  const projectionAreaPath = useMemo(() => areaGen(projection) ?? '', [areaGen, projection]);

  // User drawn path (predict mode)
  const userPath = useMemo(() => {
    if (drawnPoints.length < 2) return '';
    const fullPath = [{ epoch: currentEpoch, balanceAda: currentBalance }, ...drawnPoints];
    return lineGen(fullPath) ?? '';
  }, [lineGen, drawnPoints, currentEpoch, currentBalance]);

  // Saved scenario paths (simulate mode)
  const savedPaths = useMemo(
    () =>
      savedScenarios.map((s) => ({
        ...s,
        d: lineGen(s.curve.filter((p) => p.epoch >= currentEpoch)) ?? '',
      })),
    [savedScenarios, lineGen, currentEpoch],
  );

  // Projection path length for cinematic reveal
  const projectionPathLength = useMemo(() => {
    if (typeof document === 'undefined' || !projectionPath) return 1000;
    const tempSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    const tempPath = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    tempPath.setAttribute('d', projectionPath);
    tempSvg.appendChild(tempPath);
    document.body.appendChild(tempSvg);
    const length = tempPath.getTotalLength();
    document.body.removeChild(tempSvg);
    return length;
  }, [projectionPath]);

  // ── Axis ticks ──────────────────────────────────────────────────
  const yTicks = useMemo(() => yScale.ticks(5), [yScale]);
  const xTicks = useMemo(() => xScale.ticks(8).map(Math.round), [xScale]);

  // ── Current epoch position ──────────────────────────────────────
  const currentX = xScale(currentEpoch);
  const currentY = yScale(currentBalance);

  // ── Pulsing dot for predict challenge ───────────────────────────
  const [pulseRadius, setPulseRadius] = useState(6);
  useEffect(() => {
    if (mode !== 'predict' || predictPhase !== 'challenge' || prefersReducedMotion) return;
    let frame: number;
    const animate = () => {
      const t = (Date.now() % 2000) / 2000;
      setPulseRadius(6 + Math.sin(t * Math.PI * 2) * 3);
      frame = requestAnimationFrame(animate);
    };
    frame = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(frame);
  }, [mode, predictPhase, prefersReducedMotion]);

  // ── Drawing handlers ────────────────────────────────────────────
  const svgToPoint = useCallback(
    (clientX: number, clientY: number): DrawnPoint | null => {
      const svg = svgRef.current;
      if (!svg) return null;
      const rect = svg.getBoundingClientRect();
      const relX = clientX - rect.left - margin.left;
      const relY = clientY - rect.top - margin.top;
      const epoch = Math.round(xScale.invert(relX));
      const balanceAda = yScale.invert(relY);
      if (epoch <= currentEpoch || epoch > maxFutureEpoch) return null;
      if (balanceAda < 0) return null;
      return { epoch, balanceAda: Math.max(0, balanceAda) };
    },
    [xScale, yScale, margin, currentEpoch, maxFutureEpoch],
  );

  const handleMouseDown = useCallback(
    (e: MouseEvent<SVGRectElement>) => {
      const pt = svgToPoint(e.clientX, e.clientY);
      if (pt) onDrawStart(pt);
    },
    [svgToPoint, onDrawStart],
  );
  const handleMouseMove = useCallback(
    (e: MouseEvent<SVGRectElement>) => {
      const pt = svgToPoint(e.clientX, e.clientY);
      if (pt) onDrawMove(pt);
    },
    [svgToPoint, onDrawMove],
  );
  const handleTouchStart = useCallback(
    (e: TouchEvent<SVGRectElement>) => {
      e.preventDefault();
      const touch = e.touches[0];
      const pt = svgToPoint(touch.clientX, touch.clientY);
      if (pt) onDrawStart(pt);
    },
    [svgToPoint, onDrawStart],
  );
  const handleTouchMove = useCallback(
    (e: TouchEvent<SVGRectElement>) => {
      e.preventDefault();
      const touch = e.touches[0];
      const pt = svgToPoint(touch.clientX, touch.clientY);
      if (pt) onDrawMove(pt);
    },
    [svgToPoint, onDrawMove],
  );
  const handleTouchEnd = useCallback(
    (e: TouchEvent<SVGRectElement>) => {
      e.preventDefault();
      onDrawEnd();
    },
    [onDrawEnd],
  );

  // ── Hover tooltip state ─────────────────────────────────────────
  const [hoveredEpoch, setHoveredEpoch] = useState<number | null>(null);

  const handleHoverMove = useCallback(
    (e: MouseEvent<SVGRectElement>) => {
      if (mode === 'predict') return; // predict mode uses draw
      const svg = svgRef.current;
      if (!svg) return;
      const rect = svg.getBoundingClientRect();
      const relX = e.clientX - rect.left - margin.left;
      setHoveredEpoch(Math.round(xScale.invert(relX)));
    },
    [mode, xScale, margin.left],
  );

  // Is prediction interactive?
  const isPredictDrawable =
    mode === 'predict' && (predictPhase === 'challenge' || predictPhase === 'drawing');

  return (
    <div
      ref={containerRef}
      className="relative w-full select-none"
      style={{ height: CHART_HEIGHT }}
      role="img"
      aria-label="Treasury Futures interactive chart"
    >
      {width > 0 && (
        <svg
          ref={svgRef}
          width={width}
          height={CHART_HEIGHT}
          className={isPredictDrawable ? 'cursor-crosshair' : ''}
        >
          <defs>
            <GlowFilter id="tf-glow-hist" stdDeviation={2} />
            <GlowFilter id="tf-glow-proj" stdDeviation={3} />
            <GlowFilter id="tf-glow-user" stdDeviation={3} />
            <GlowFilter id="tf-glow-reveal" stdDeviation={4} />
            <AreaGradient id="tf-area-hist" color={COLORS.historical} topOpacity={0.08} />
            <AreaGradient id="tf-area-proj" color={COLORS.projection} topOpacity={0.05} />
            {/* Pulsing glow for reveal */}
            <filter id="tf-reveal-pulse" x="-100%" y="-100%" width="300%" height="300%">
              <feGaussianBlur in="SourceGraphic" stdDeviation={6} />
              <feComposite in2="SourceGraphic" operator="over" />
            </filter>
          </defs>

          <g transform={`translate(${margin.left},${margin.top})`}>
            {/* Grid */}
            {yTicks.map((t) => (
              <g key={`y-${t}`}>
                <line
                  x1={0}
                  x2={innerWidth}
                  y1={yScale(t)}
                  y2={yScale(t)}
                  stroke="oklch(0.20 0.01 260)"
                  strokeWidth={0.5}
                  strokeDasharray="4 4"
                />
                <text
                  x={-8}
                  y={yScale(t)}
                  textAnchor="end"
                  dominantBaseline="central"
                  fontSize={chartTheme.font.size.tick}
                  className="fill-muted-foreground"
                  fontFamily={chartTheme.font.mono}
                >
                  {formatAda(t)}
                </text>
              </g>
            ))}
            {xTicks.map((t) => (
              <text
                key={`x-${t}`}
                x={xScale(t)}
                y={innerHeight + 20}
                textAnchor="middle"
                fontSize={chartTheme.font.size.tick}
                className="fill-muted-foreground"
                fontFamily={chartTheme.font.mono}
              >
                {t}
              </text>
            ))}

            {/* "Now" divider */}
            <line
              x1={currentX}
              x2={currentX}
              y1={0}
              y2={innerHeight}
              stroke="oklch(0.35 0.02 260)"
              strokeWidth={1}
              strokeDasharray="6 4"
            />
            <text
              x={currentX}
              y={-4}
              textAnchor="middle"
              fontSize={9}
              className="fill-muted-foreground"
              fontFamily={chartTheme.font.family}
            >
              Now
            </text>

            {/* Historical area + line */}
            <path d={historicalAreaPath} fill="url(#tf-area-hist)" />
            <path
              d={historicalPath}
              fill="none"
              stroke={COLORS.historical}
              strokeWidth={2.5}
              filter="url(#tf-glow-hist)"
              opacity={0.25}
            />
            <path
              d={historicalPath}
              fill="none"
              stroke={COLORS.historical}
              strokeWidth={2}
              strokeLinecap="round"
            />

            {/* Projection line — visible in explore/simulate modes */}
            {mode !== 'predict' && (
              <>
                <path d={projectionAreaPath} fill="url(#tf-area-proj)" />
                <path
                  d={projectionPath}
                  fill="none"
                  stroke={COLORS.projectionDash}
                  strokeWidth={2}
                  filter="url(#tf-glow-proj)"
                  opacity={0.2}
                />
                <path
                  d={projectionPath}
                  fill="none"
                  stroke={COLORS.projectionDash}
                  strokeWidth={1.5}
                  strokeDasharray="8 4"
                  strokeLinecap="round"
                />
              </>
            )}

            {/* Predict mode: projection hidden until reveal */}
            {mode === 'predict' &&
              (predictPhase === 'reveal' || predictPhase === 'complete') &&
              projectionPath && (
                <>
                  <path
                    d={projectionAreaPath}
                    fill={`oklch(0.72 0.17 160 / ${0.06 * revealProgress})`}
                  />
                  <path
                    d={projectionPath}
                    fill="none"
                    stroke={COLORS.reveal}
                    strokeWidth={2.5}
                    filter="url(#tf-reveal-pulse)"
                    opacity={0.3 * revealProgress}
                  />
                  <path
                    d={projectionPath}
                    fill="none"
                    stroke={COLORS.reveal}
                    strokeWidth={2.5}
                    strokeLinecap="round"
                    strokeDasharray={projectionPathLength}
                    strokeDashoffset={projectionPathLength * (1 - revealProgress)}
                  />
                </>
              )}

            {/* Saved scenario lines (simulate mode) */}
            {savedPaths.map((sp) => (
              <g key={sp.id}>
                <path
                  d={sp.d}
                  fill="none"
                  stroke={sp.color}
                  strokeWidth={1.5}
                  opacity={0.4}
                  strokeDasharray="6 3"
                  strokeLinecap="round"
                />
              </g>
            ))}

            {/* User drawn line (predict mode) */}
            {mode === 'predict' && userPath && (
              <>
                <path
                  d={userPath}
                  fill="none"
                  stroke={COLORS.userDraw}
                  strokeWidth={2.5}
                  filter="url(#tf-glow-user)"
                  opacity={0.25}
                />
                <path
                  d={userPath}
                  fill="none"
                  stroke={COLORS.userDraw}
                  strokeWidth={2.5}
                  strokeLinecap="round"
                  strokeDasharray={predictPhase === 'drawing' ? '6 3' : 'none'}
                />
                {drawnPoints.length > 0 && (
                  <circle
                    cx={xScale(drawnPoints[drawnPoints.length - 1].epoch)}
                    cy={yScale(drawnPoints[drawnPoints.length - 1].balanceAda)}
                    r={4}
                    fill={COLORS.userDraw}
                    stroke="oklch(0.11 0.015 240)"
                    strokeWidth={2}
                  />
                )}
              </>
            )}

            {/* Current balance dot */}
            {mode === 'predict' && predictPhase === 'challenge' && (
              <circle
                cx={currentX}
                cy={currentY}
                r={pulseRadius}
                fill={COLORS.historical}
                opacity={0.2}
              />
            )}
            <circle
              cx={currentX}
              cy={currentY}
              r={4}
              fill={COLORS.historical}
              stroke="oklch(0.11 0.015 240)"
              strokeWidth={2}
            />

            {/* Proposal chips on timeline (explore mode) */}
            {mode === 'explore' &&
              pendingProposals.map((p) => {
                const px = xScale(
                  Math.min(
                    Math.max(p.proposedEpoch || currentEpoch + 2, allEpochs[0]),
                    allEpochs[1],
                  ),
                );
                // Position above the projection line at that epoch
                const projPt = projection.reduce(
                  (best, pt) =>
                    Math.abs(pt.epoch - (p.proposedEpoch || currentEpoch + 2)) <
                    Math.abs(best.epoch - (p.proposedEpoch || currentEpoch + 2))
                      ? pt
                      : best,
                  projection[0] || { epoch: currentEpoch, balanceAda: currentBalance },
                );
                const py = yScale(projPt.balanceAda) - 20;
                return (
                  <g key={`${p.txHash}-${p.index}`}>
                    {/* Drop line */}
                    <line
                      x1={px}
                      x2={px}
                      y1={py + 16}
                      y2={yScale(projPt.balanceAda)}
                      stroke={COLORS.proposalChip}
                      strokeWidth={0.5}
                      strokeDasharray="2 2"
                      opacity={0.4}
                    />
                    {/* Chip */}
                    <foreignObject
                      x={px - 50}
                      y={Math.max(0, py - 10)}
                      width={100}
                      height={24}
                      style={{ overflow: 'visible' }}
                    >
                      <div className="flex justify-center">
                        <div className="px-1.5 py-0.5 rounded bg-amber-500/10 border border-amber-500/20 text-[8px] text-amber-300 font-mono tabular-nums whitespace-nowrap backdrop-blur-sm">
                          {formatAda(p.withdrawalAda)}
                        </div>
                      </div>
                    </foreignObject>
                  </g>
                );
              })}

            {/* Hover crosshair (explore + simulate) */}
            {hoveredEpoch !== null && mode !== 'predict' && (
              <line
                x1={xScale(hoveredEpoch)}
                x2={xScale(hoveredEpoch)}
                y1={0}
                y2={innerHeight}
                stroke="oklch(0.40 0.02 260)"
                strokeWidth={0.5}
                strokeDasharray="3 3"
              />
            )}

            {/* Interaction rect */}
            {isPredictDrawable ? (
              <rect
                x={Math.max(0, currentX)}
                y={0}
                width={Math.max(0, innerWidth - currentX)}
                height={innerHeight}
                fill="transparent"
                onMouseDown={handleMouseDown}
                onMouseMove={handleMouseMove}
                onMouseUp={onDrawEnd}
                onMouseLeave={onDrawEnd}
                onTouchStart={handleTouchStart}
                onTouchMove={handleTouchMove}
                onTouchEnd={handleTouchEnd}
                aria-label="Drawing area"
                role="slider"
                aria-valuemin={0}
                aria-valuemax={allBalances}
                aria-valuenow={
                  drawnPoints.length > 0
                    ? Math.round(drawnPoints[drawnPoints.length - 1].balanceAda)
                    : Math.round(currentBalance)
                }
              />
            ) : (
              <rect
                x={0}
                y={0}
                width={innerWidth}
                height={innerHeight}
                fill="transparent"
                onMouseMove={handleHoverMove}
                onMouseLeave={() => setHoveredEpoch(null)}
              />
            )}
          </g>
        </svg>
      )}

      {/* Hover tooltip (explore + simulate) */}
      {hoveredEpoch !== null && mode !== 'predict' && width > 0 && (
        <div
          className="absolute z-50 pointer-events-none"
          style={{
            left: margin.left + xScale(hoveredEpoch),
            top: 40,
            transform: `translate(${xScale(hoveredEpoch) > innerWidth * 0.7 ? '-110%' : '10%'}, 0)`,
          }}
        >
          <div className="rounded-lg border bg-[oklch(0.10_0.015_260)] p-2 shadow-xl text-[10px] backdrop-blur-sm border-border/40">
            <p className="font-medium mb-0.5 text-xs">Epoch {hoveredEpoch}</p>
            {(() => {
              const closestPt = projection.reduce(
                (best, p) =>
                  Math.abs(p.epoch - hoveredEpoch) < Math.abs(best.epoch - hoveredEpoch) ? p : best,
                projection[0] || { epoch: currentEpoch, balanceAda: currentBalance },
              );
              if (Math.abs(closestPt.epoch - hoveredEpoch) > 5) return null;
              return (
                <div className="flex items-center gap-2">
                  <span
                    className="h-1.5 w-1.5 rounded-full"
                    style={{ backgroundColor: COLORS.projectionDash }}
                  />
                  <span className="text-muted-foreground">Balance:</span>
                  <span className="font-mono tabular-nums">{formatAda(closestPt.balanceAda)}</span>
                </div>
              );
            })()}
            {savedPaths.map((sp) => {
              const closestPt = sp.curve
                .filter((p) => p.epoch >= currentEpoch)
                .reduce(
                  (best, p) =>
                    Math.abs(p.epoch - hoveredEpoch!) < Math.abs(best.epoch - hoveredEpoch!)
                      ? p
                      : best,
                  { epoch: currentEpoch, balanceAda: currentBalance },
                );
              if (Math.abs(closestPt.epoch - hoveredEpoch!) > 5) return null;
              return (
                <div key={sp.id} className="flex items-center gap-2">
                  <span
                    className="h-1.5 w-1.5 rounded-full"
                    style={{ backgroundColor: sp.color }}
                  />
                  <span className="text-muted-foreground">{sp.label}:</span>
                  <span className="font-mono tabular-nums">{formatAda(closestPt.balanceAda)}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Legend */}
      <div className="absolute bottom-1 left-0 right-0 flex gap-3 justify-center flex-wrap text-[10px] text-muted-foreground/60 px-4">
        <LegendItem color={COLORS.historical} label="Historical" />
        {mode !== 'predict' && (
          <LegendItem color={COLORS.projectionDash} label="Projected" dashed />
        )}
        {mode === 'predict' &&
          (predictPhase === 'drawing' ||
            predictPhase === 'reveal' ||
            predictPhase === 'complete') && (
            <LegendItem color={COLORS.userDraw} label="Your Prediction" />
          )}
        {mode === 'predict' && (predictPhase === 'reveal' || predictPhase === 'complete') && (
          <LegendItem color={COLORS.reveal} label="Model Projection" />
        )}
        {savedPaths.map((sp) => (
          <LegendItem key={sp.id} color={sp.color} label={sp.label} dashed />
        ))}
      </div>
    </div>
  );
}

// ── Legend Item ───────────────────────────────────────────────────────────────

function LegendItem({ color, label, dashed }: { color: string; label: string; dashed?: boolean }) {
  return (
    <div className="flex items-center gap-1">
      <span
        className="w-3 h-0.5 rounded"
        style={{
          backgroundColor: color,
          borderBottom: dashed ? `1px dashed ${color}` : undefined,
        }}
      />
      {label}
    </div>
  );
}
