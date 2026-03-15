'use client';

import { useMemo, useId, useRef, useEffect, useState } from 'react';
import type { ConvictionPulseData } from '@/lib/convictionPulse';
import type { VotePowerByEpoch } from '@/lib/data';
import type { VoteProjection } from '@/lib/voteProjection';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { useDepthConfig } from '@/hooks/useDepthConfig';
import { cn } from '@/lib/utils';

interface PowerFallback {
  yesPower: number;
  noPower: number;
  abstainPower: number;
  yesCount: number;
  noCount: number;
  abstainCount: number;
}

interface ConvictionTugOfWarProps {
  data: ConvictionPulseData;
  powerByEpoch: VotePowerByEpoch[];
  powerFallback?: PowerFallback | null;
  projection?: VoteProjection | null;
  isOpen: boolean;
  className?: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function MetricDisplay({
  label,
  value,
  tooltip,
}: {
  label: string;
  value: number;
  tooltip: string;
}) {
  const color =
    value >= 60 ? 'text-emerald-400' : value >= 30 ? 'text-amber-400' : 'text-muted-foreground';

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="flex items-center gap-1.5 cursor-help">
            <span className="text-xs text-muted-foreground uppercase tracking-wider">{label}</span>
            <span className={cn('text-lg font-bold tabular-nums leading-none', color)}>
              {value}
            </span>
          </div>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="max-w-64 text-xs">
          {tooltip}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

function formatAdaFromLovelace(lovelace: number): string {
  const ada = lovelace / 1_000_000;
  if (ada >= 1_000_000_000) return `${(ada / 1_000_000_000).toFixed(1)}B`;
  if (ada >= 1_000_000) return `${(ada / 1_000_000).toFixed(1)}M`;
  if (ada >= 1_000) return `${(ada / 1_000).toFixed(0)}K`;
  return ada.toFixed(0);
}

function formatAdaShort(ada: number): string {
  if (ada >= 1_000_000_000) return `${(ada / 1_000_000_000).toFixed(1)}B`;
  if (ada >= 1_000_000) return `${(ada / 1_000_000).toFixed(1)}M`;
  if (ada >= 1_000) return `${(ada / 1_000).toFixed(0)}K`;
  return ada.toFixed(0);
}

/** Map proposalSections to depth 0-3 */
function getDepth(sections: Record<string, boolean>): 0 | 1 | 2 | 3 {
  if (sections.sourceMaterial) return 3;
  if (sections.outcomeSection) return 2;
  if (sections.actionZone) return 1;
  return 0;
}

function getVerdictColor(projection: VoteProjection | null | undefined): string {
  if (!projection) return 'text-muted-foreground';
  switch (projection.projectedOutcome) {
    case 'passing':
    case 'likely_pass':
    case 'leaning_pass':
      return 'text-emerald-400';
    case 'unlikely_pass':
    case 'leaning_fail':
      return 'text-red-400';
    default:
      return 'text-foreground/70';
  }
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ConvictionTugOfWar({
  data,
  powerByEpoch,
  powerFallback,
  projection,
  isOpen,
  className,
}: ConvictionTugOfWarProps) {
  const cssId = useId().replace(/:/g, '');
  const { proposalSections } = useDepthConfig<'governance'>('governance');
  const depth = getDepth(proposalSections);

  // Aggregate vote power
  const totals = useMemo(() => {
    let yes = powerByEpoch.reduce((s, p) => s + p.yesPower, 0);
    let no = powerByEpoch.reduce((s, p) => s + p.noPower, 0);
    let abstain = powerByEpoch.reduce((s, p) => s + p.abstainPower, 0);
    let yesCount = powerByEpoch.reduce((s, p) => s + p.yesCount, 0);
    let noCount = powerByEpoch.reduce((s, p) => s + p.noCount, 0);
    let abstainCount = powerByEpoch.reduce((s, p) => s + p.abstainCount, 0);

    if (yes + no + abstain === 0 && powerFallback) {
      yes = powerFallback.yesPower;
      no = powerFallback.noPower;
      abstain = powerFallback.abstainPower;
      yesCount = powerFallback.yesCount;
      noCount = powerFallback.noCount;
      abstainCount = powerFallback.abstainCount;
    }

    const total = yes + no + abstain;
    const yesNoTotal = yes + no || 1;
    return {
      yes,
      no,
      abstain,
      yesCount,
      noCount,
      abstainCount,
      total,
      totalAda: total / 1_000_000,
      yesPct: total > 0 ? (yes / yesNoTotal) * 100 : 50,
      noPct: total > 0 ? (no / yesNoTotal) * 100 : 50,
    };
  }, [powerByEpoch, powerFallback]);

  const balancePoint = totals.yes + totals.no > 0 ? totals.no / (totals.yes + totals.no) : 0.5;
  const glowIntensity = Math.max(0.3, data.conviction / 100);
  const hasPower = totals.total > 0;
  const yesWinning = totals.yes > totals.no;
  const verdictColor = getVerdictColor(projection);

  // Animation
  const [progress, setProgress] = useState(0);
  const animRef = useRef(false);
  useEffect(() => {
    if (animRef.current) return;
    animRef.current = true;
    const start = performance.now();
    function tick(now: number) {
      const t = Math.min(1, (now - start) / 1500);
      setProgress(1 - Math.pow(1 - t, 3));
      if (t < 1) requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
  }, []);

  // Clash pulse
  const [clashGlow, setClashGlow] = useState(0.5);
  useEffect(() => {
    let frame: number;
    const start = performance.now();
    function pulse(now: number) {
      const t = ((now - start) % 2000) / 2000;
      setClashGlow(0.4 + 0.6 * (0.5 + 0.5 * Math.sin(t * Math.PI * 2)));
      frame = requestAnimationFrame(pulse);
    }
    frame = requestAnimationFrame(pulse);
    return () => cancelAnimationFrame(frame);
  }, []);

  const svgWidth = 600;
  const svgHeight = depth === 0 ? 36 : 48;
  const beamY = depth === 0 ? 4 : 8;
  const beamHeight = depth === 0 ? 20 : 24;
  const clashX = balancePoint * svgWidth;
  const noWidth = clashX * progress;
  const yesWidth = (svgWidth - clashX) * progress;

  // ─── hands_off: compact verdict + beam only ───────────────────────
  if (depth === 0) {
    return (
      <div className={cn('rounded-xl border border-border/50 bg-card/50 px-5 py-3', className)}>
        {/* Verdict + beam in one tight row */}
        <div className="flex items-center gap-3 mb-2">
          {projection && (
            <span className={cn('text-sm font-semibold shrink-0', verdictColor)}>
              {projection.verdictLabel}
            </span>
          )}
          {!projection && hasPower && (
            <span
              className={cn(
                'text-sm font-semibold shrink-0',
                yesWinning ? 'text-emerald-400' : 'text-red-400',
              )}
            >
              {yesWinning ? 'Yes leads' : 'No leads'}
            </span>
          )}
          <span className="text-xs text-muted-foreground">
            {Math.round(totals.noPct)}% No — {Math.round(totals.yesPct)}% Yes
          </span>
        </div>
        {hasPower && (
          <svg
            viewBox={`0 0 ${svgWidth} ${svgHeight}`}
            className="w-full"
            style={{ height: '28px' }}
          >
            <defs>
              <linearGradient id={`no-g-${cssId}`} x1="0" y1="0" x2="1" y2="0">
                <stop offset="0%" stopColor="#ef4444" stopOpacity={0.8} />
                <stop offset="100%" stopColor="#ef4444" stopOpacity={0.4} />
              </linearGradient>
              <linearGradient id={`yes-g-${cssId}`} x1="1" y1="0" x2="0" y2="0">
                <stop offset="0%" stopColor="#10b981" stopOpacity={0.8} />
                <stop offset="100%" stopColor="#10b981" stopOpacity={0.4} />
              </linearGradient>
            </defs>
            <rect
              x="0"
              y={beamY}
              width={svgWidth}
              height={beamHeight}
              rx={beamHeight / 2}
              fill="currentColor"
              fillOpacity={0.06}
            />
            <rect
              x={clashX - noWidth}
              y={beamY}
              width={noWidth}
              height={beamHeight}
              rx={noWidth > beamHeight ? beamHeight / 2 : noWidth / 2}
              fill={`url(#no-g-${cssId})`}
            />
            <rect
              x={clashX}
              y={beamY}
              width={yesWidth}
              height={beamHeight}
              rx={yesWidth > beamHeight ? beamHeight / 2 : yesWidth / 2}
              fill={`url(#yes-g-${cssId})`}
            />
          </svg>
        )}
      </div>
    );
  }

  // ─── informed+: full card with depth-adaptive sections ────────────
  return (
    <div className={cn('rounded-xl border border-border/50 bg-card/50 overflow-hidden', className)}>
      {/* Metrics row — informed+ shows conviction/polarization */}
      <div className="px-5 pt-4 pb-2 flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-5">
          <MetricDisplay
            label="Conviction"
            value={data.conviction}
            tooltip="How deeply DReps care about this proposal (0-100). Based on rationale rate, quality of reasoning, and breadth of participation. High conviction means DReps are engaging seriously."
          />
          <MetricDisplay
            label="Polarization"
            value={data.polarization}
            tooltip="How divided the community is on this proposal (0-100). Low = broad consensus, High = sharp disagreement. Based on the distribution of voting power across Yes, No, and Abstain."
          />
        </div>
        {/* informed: voter count only. engaged+: + ADA */}
        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          <span>{data.totalVoters} voters</span>
          {depth >= 2 && totals.totalAda > 0 && (
            <>
              <span className="text-border">|</span>
              <span>{formatAdaShort(totals.totalAda)} ADA</span>
            </>
          )}
        </div>
      </div>

      {/* Tug-of-war beam */}
      <div className="px-5 pb-2">
        {hasPower ? (
          <>
            {/* Side labels — informed+ shows voter counts */}
            <div className="flex items-end justify-between mb-2">
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold text-red-400">No</span>
                <span className="text-xs text-muted-foreground tabular-nums">
                  {totals.noCount} voter{totals.noCount !== 1 ? 's' : ''}
                </span>
              </div>
              {totals.abstainCount > 0 && (
                <div className="text-xs text-muted-foreground text-center">
                  {totals.abstainCount} abstain
                </div>
              )}
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground tabular-nums">
                  {totals.yesCount} voter{totals.yesCount !== 1 ? 's' : ''}
                </span>
                <span className="text-sm font-semibold text-emerald-400">Yes</span>
              </div>
            </div>

            {/* SVG beam */}
            <svg
              viewBox={`0 0 ${svgWidth} ${svgHeight}`}
              className="w-full"
              style={{ height: '48px' }}
              role="img"
              aria-label={`Voting power balance: ${Math.round(totals.yesPct)}% Yes, ${Math.round(totals.noPct)}% No`}
            >
              <defs>
                <linearGradient id={`no-g-${cssId}`} x1="0" y1="0" x2="1" y2="0">
                  <stop offset="0%" stopColor="#ef4444" stopOpacity={0.9 * glowIntensity} />
                  <stop offset="100%" stopColor="#ef4444" stopOpacity={0.5 * glowIntensity} />
                </linearGradient>
                <linearGradient id={`yes-g-${cssId}`} x1="1" y1="0" x2="0" y2="0">
                  <stop offset="0%" stopColor="#10b981" stopOpacity={0.9 * glowIntensity} />
                  <stop offset="100%" stopColor="#10b981" stopOpacity={0.5 * glowIntensity} />
                </linearGradient>
                <filter id={`glow-${cssId}`} x="-10%" y="-50%" width="120%" height="200%">
                  <feGaussianBlur in="SourceGraphic" stdDeviation="4" />
                </filter>
                <filter id={`clash-${cssId}`} x="-100%" y="-100%" width="300%" height="300%">
                  <feGaussianBlur in="SourceGraphic" stdDeviation="6" />
                </filter>
              </defs>

              <rect
                x="0"
                y={beamY}
                width={svgWidth}
                height={beamHeight}
                rx={beamHeight / 2}
                fill="currentColor"
                fillOpacity={0.06}
              />

              {/* No glow + beam */}
              <rect
                x={clashX - noWidth}
                y={beamY}
                width={noWidth}
                height={beamHeight}
                rx={beamHeight / 2}
                fill="#ef4444"
                opacity={0.15 * glowIntensity}
                filter={`url(#glow-${cssId})`}
              />
              <rect
                x={clashX - noWidth}
                y={beamY}
                width={noWidth}
                height={beamHeight}
                rx={noWidth > beamHeight ? beamHeight / 2 : noWidth / 2}
                fill={`url(#no-g-${cssId})`}
              />

              {/* Yes glow + beam */}
              <rect
                x={clashX}
                y={beamY}
                width={yesWidth}
                height={beamHeight}
                rx={beamHeight / 2}
                fill="#10b981"
                opacity={0.15 * glowIntensity}
                filter={`url(#glow-${cssId})`}
              />
              <rect
                x={clashX}
                y={beamY}
                width={yesWidth}
                height={beamHeight}
                rx={yesWidth > beamHeight ? beamHeight / 2 : yesWidth / 2}
                fill={`url(#yes-g-${cssId})`}
              />

              {/* Clash point */}
              {progress > 0.8 && (
                <>
                  <circle
                    cx={clashX}
                    cy={beamY + beamHeight / 2}
                    r={12}
                    fill="white"
                    opacity={0.12 * clashGlow}
                    filter={`url(#clash-${cssId})`}
                  />
                  <circle
                    cx={clashX}
                    cy={beamY + beamHeight / 2}
                    r={4}
                    fill="white"
                    opacity={0.6 * clashGlow}
                  />
                </>
              )}

              {/* ADA labels — engaged+ only */}
              {depth >= 2 && (
                <>
                  <text
                    x={8}
                    y={svgHeight - 1}
                    className="fill-red-400"
                    fontSize="10"
                    fontWeight="600"
                  >
                    {formatAdaFromLovelace(totals.no)} ADA
                  </text>
                  <text
                    x={svgWidth - 8}
                    y={svgHeight - 1}
                    textAnchor="end"
                    className="fill-emerald-400"
                    fontSize="10"
                    fontWeight="600"
                  >
                    {formatAdaFromLovelace(totals.yes)} ADA
                  </text>
                </>
              )}

              {/* Center percentage — always visible */}
              <text
                x={svgWidth / 2}
                y={svgHeight - 1}
                textAnchor="middle"
                className="fill-muted-foreground"
                fontSize="10"
              >
                {Math.round(totals.noPct)}% — {Math.round(totals.yesPct)}%
              </text>
            </svg>
          </>
        ) : (
          <div className="flex items-center justify-center h-12 text-sm text-muted-foreground">
            The force balance will appear as DReps cast their votes.
          </div>
        )}
      </div>

      {/* Threshold progress — informed+ */}
      {projection && projection.thresholdPct != null && (
        <div className="px-5 pb-3 pt-2 border-t border-border/20">
          <div className="flex items-center justify-between mb-1.5">
            <span className={cn('text-sm font-semibold', verdictColor)}>
              {projection.verdictLabel}
            </span>
            {isOpen && projection.epochsRemaining != null && projection.epochsRemaining > 0 && (
              <span className="text-xs text-muted-foreground">
                {projection.epochsRemaining} epoch{projection.epochsRemaining !== 1 ? 's' : ''}{' '}
                remaining
              </span>
            )}
          </div>

          {/* Threshold bar */}
          <div className="relative h-2.5 rounded-full bg-muted/40 overflow-visible mb-2">
            <div
              className="absolute inset-y-0 left-0 rounded-full bg-emerald-500 transition-all duration-500"
              style={{ width: `${Math.min(100, projection.currentYesPct)}%` }}
            />
            <div
              className="absolute top-[-4px] bottom-[-4px] w-0.5 bg-foreground/50"
              style={{ left: `${Math.min(100, projection.thresholdPct)}%` }}
            >
              <div className="absolute -top-4 left-1/2 -translate-x-1/2 text-[9px] text-muted-foreground whitespace-nowrap font-medium">
                {Math.round(projection.thresholdPct)}%
              </div>
            </div>
          </div>

          {/* informed: just the key number */}
          <span className="text-xs text-foreground/70">
            {projection.currentYesPct.toFixed(1)}% of active stake voting Yes
            {projection.yesOfVotersPct != null && projection.participationPct < 50 && (
              <span className="text-muted-foreground ml-1">
                ({Math.round(projection.yesOfVotersPct)}% of voters)
              </span>
            )}
          </span>

          {/* engaged+: verdict detail + historical evidence */}
          {depth >= 2 && (
            <div className="mt-1.5 space-y-0.5">
              <p className="text-xs text-muted-foreground">{projection.verdictDetail}</p>
              {projection.historicalEvidence && (
                <p className="text-xs text-muted-foreground">{projection.historicalEvidence}</p>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
