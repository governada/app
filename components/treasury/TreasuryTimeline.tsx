'use client';

import { useMemo, useState, useCallback, type MouseEvent } from 'react';
import { scaleLinear } from 'd3-scale';
import { area, line, curveMonotoneX } from 'd3-shape';
import { useChartDimensions } from '@/lib/charts/useChartDimensions';
import { GlowFilter, AreaGradient } from '@/lib/charts/GlowDefs';
import { chartTheme, CHART_PALETTE } from '@/lib/charts/theme';
import { useTreasuryHistory, useTreasuryPending } from '@/hooks/queries';
import { formatAda } from '@/lib/treasury';
import type { IncomeVsOutflow } from '@/lib/treasury';

/* ─── Types ───────────────────────────────────────────────────────────── */

interface TreasurySnapshotPoint {
  epoch: number;
  balanceAda: number;
  withdrawalsAda: number;
  reservesIncomeAda: number;
}

interface AnnotationEvent {
  epoch: number;
  kind: 'large-withdrawal' | 'high-income' | 'ncl-change';
  label: string;
  linkHref?: string;
}

interface PendingProposal {
  txHash: string;
  index: number;
  title: string;
  withdrawalAda: number;
  enactedEpoch?: number | null;
  proposalType?: string;
}

/* ─── Colours ─────────────────────────────────────────────────────────── */

const BALANCE_COLOR = CHART_PALETTE[0]; // Electric Cyan
const WITHDRAWAL_COLOR = 'oklch(0.60 0.20 25)'; // Red
const INCOME_COLOR = '#10b981'; // Emerald
const NCL_COLOR = CHART_PALETTE[1]; // Teal

const ANNOTATION_COLORS: Record<AnnotationEvent['kind'], string> = {
  'large-withdrawal': WITHDRAWAL_COLOR,
  'high-income': INCOME_COLOR,
  'ncl-change': NCL_COLOR,
};

/* ─── Component ───────────────────────────────────────────────────────── */

export function TreasuryTimeline() {
  const { data: rawHistory } = useTreasuryHistory(60);
  const { data: rawPending } = useTreasuryPending();

  const snapshots: TreasurySnapshotPoint[] = useMemo(() => {
    const hist = rawHistory as
      | { snapshots: TreasurySnapshotPoint[]; incomeVsOutflow: IncomeVsOutflow[] }
      | undefined;
    return hist?.snapshots ?? [];
  }, [rawHistory]);

  const incomeVsOutflow: IncomeVsOutflow[] = useMemo(() => {
    const hist = rawHistory as
      | { snapshots: TreasurySnapshotPoint[]; incomeVsOutflow: IncomeVsOutflow[] }
      | undefined;
    return hist?.incomeVsOutflow ?? [];
  }, [rawHistory]);

  const proposals: PendingProposal[] = useMemo(() => {
    const pending = rawPending as { proposals: PendingProposal[] } | undefined;
    return pending?.proposals ?? [];
  }, [rawPending]);

  // Derive annotation events
  const annotations: AnnotationEvent[] = useMemo(() => {
    if (snapshots.length === 0) return [];

    const events: AnnotationEvent[] = [];
    const epochSet = new Set(snapshots.map((s) => s.epoch));

    // Large withdrawals (>5M ADA)
    for (const s of snapshots) {
      if (s.withdrawalsAda > 5_000_000) {
        // Find matching proposals for context
        const matchingProposal = proposals.find(
          (p) => p.proposalType === 'TreasuryWithdrawals' && p.enactedEpoch === s.epoch,
        );
        events.push({
          epoch: s.epoch,
          kind: 'large-withdrawal',
          label: matchingProposal
            ? `${matchingProposal.title.slice(0, 40)}${matchingProposal.title.length > 40 ? '...' : ''}: -₳${formatAda(s.withdrawalsAda)}`
            : `Large withdrawal: -₳${formatAda(s.withdrawalsAda)}`,
          linkHref: matchingProposal
            ? `/proposal/${matchingProposal.txHash}/${matchingProposal.index}`
            : undefined,
        });
      }
    }

    // Unusual income epochs (>2x average)
    const avgIncome = snapshots.reduce((sum, s) => sum + s.reservesIncomeAda, 0) / snapshots.length;
    for (const s of snapshots) {
      if (s.reservesIncomeAda > avgIncome * 2 && avgIncome > 0 && epochSet.has(s.epoch)) {
        events.push({
          epoch: s.epoch,
          kind: 'high-income',
          label: `High income: +₳${formatAda(s.reservesIncomeAda)}`,
        });
      }
    }

    return events;
  }, [snapshots, proposals]);

  if (snapshots.length < 2) {
    return (
      <div className="rounded-xl border border-border/50 bg-card/70 backdrop-blur-md p-5">
        <p className="text-sm text-muted-foreground">
          Treasury history will appear here once enough snapshots are collected.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <TimelineChart snapshots={snapshots} annotations={annotations} />
      <NetFlowBar data={incomeVsOutflow} />
    </div>
  );
}

/* ─── Chart ───────────────────────────────────────────────────────────── */

interface TimelineChartProps {
  snapshots: TreasurySnapshotPoint[];
  annotations: AnnotationEvent[];
}

function TimelineChart({ snapshots, annotations }: TimelineChartProps) {
  const { containerRef, dimensions } = useChartDimensions(280, {
    top: 16,
    right: 16,
    bottom: 32,
    left: 56,
  });
  const { width, innerWidth, innerHeight, margin } = dimensions;
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  const epochs = useMemo(() => snapshots.map((s) => s.epoch), [snapshots]);
  const balances = useMemo(() => snapshots.map((s) => s.balanceAda), [snapshots]);

  const xScale = useMemo(
    () =>
      scaleLinear()
        .domain([epochs[0], epochs[epochs.length - 1]])
        .range([0, innerWidth]),
    [epochs, innerWidth],
  );

  const yScale = useMemo(() => {
    const min = Math.min(...balances);
    const max = Math.max(...balances);
    const padding = (max - min) * 0.1 || max * 0.1;
    return scaleLinear()
      .domain([Math.max(0, min - padding), max + padding])
      .range([innerHeight, 0]);
  }, [balances, innerHeight]);

  const balanceLine = useMemo(() => {
    const gen = line<TreasurySnapshotPoint>()
      .x((d) => xScale(d.epoch))
      .y((d) => yScale(d.balanceAda))
      .curve(curveMonotoneX);
    return gen(snapshots) ?? '';
  }, [snapshots, xScale, yScale]);

  const balanceArea = useMemo(() => {
    const gen = area<TreasurySnapshotPoint>()
      .x((d) => xScale(d.epoch))
      .y0(innerHeight)
      .y1((d) => yScale(d.balanceAda))
      .curve(curveMonotoneX);
    return gen(snapshots) ?? '';
  }, [snapshots, xScale, yScale, innerHeight]);

  const handleMouseMove = useCallback(
    (e: MouseEvent<SVGRectElement>) => {
      const svg = e.currentTarget.closest('svg');
      if (!svg) return;
      const rect = svg.getBoundingClientRect();
      const relX = e.clientX - rect.left - margin.left;
      // Find nearest epoch index
      const epochRange = epochs[epochs.length - 1] - epochs[0];
      if (epochRange === 0) return;
      const hoveredEpoch = epochs[0] + (relX / innerWidth) * epochRange;
      let nearest = 0;
      let minDist = Infinity;
      for (let i = 0; i < epochs.length; i++) {
        const dist = Math.abs(epochs[i] - hoveredEpoch);
        if (dist < minDist) {
          minDist = dist;
          nearest = i;
        }
      }
      setHoveredIndex(nearest);
    },
    [epochs, innerWidth, margin.left],
  );

  const handleMouseLeave = useCallback(() => setHoveredIndex(null), []);

  const yTicks = useMemo(() => yScale.ticks(5), [yScale]);

  // X-axis tick selection: show ~6 labels max
  const xTicks = useMemo(() => {
    if (epochs.length <= 8) return epochs;
    const step = Math.ceil(epochs.length / 6);
    return epochs.filter((_, i) => i % step === 0);
  }, [epochs]);

  const hovered = hoveredIndex !== null ? snapshots[hoveredIndex] : null;

  // Map annotation epochs to indices for positioning
  const annotationPositions = useMemo(
    () =>
      annotations
        .map((a) => {
          const idx = snapshots.findIndex((s) => s.epoch === a.epoch);
          if (idx < 0) return null;
          return { ...a, x: xScale(a.epoch), y: yScale(snapshots[idx].balanceAda) };
        })
        .filter(Boolean) as (AnnotationEvent & { x: number; y: number })[],
    [annotations, snapshots, xScale, yScale],
  );

  return (
    <div
      className="rounded-xl border border-border/50 bg-card/70 backdrop-blur-md p-5"
      role="img"
      aria-label="Treasury balance over time with event annotations"
    >
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-medium text-muted-foreground">Treasury Balance Over Time</h3>
        {hovered && (
          <span className="text-xs text-muted-foreground tabular-nums">
            Epoch {hovered.epoch}: ₳{formatAda(hovered.balanceAda)}
          </span>
        )}
      </div>

      <div ref={containerRef} className="relative w-full" style={{ height: 280 }}>
        {width > 0 && (
          <svg width={width} height={280} aria-hidden="true">
            <defs>
              <GlowFilter id="treasury-timeline-glow" stdDeviation={3} />
              <AreaGradient id="treasury-timeline-fill" color={BALANCE_COLOR} topOpacity={0.2} />
            </defs>

            <g transform={`translate(${margin.left},${margin.top})`}>
              {/* Y-axis grid lines + labels */}
              {yTicks.map((t) => (
                <g key={t}>
                  <line
                    x1={0}
                    x2={innerWidth}
                    y1={yScale(t)}
                    y2={yScale(t)}
                    stroke="currentColor"
                    strokeWidth={0.5}
                    strokeDasharray="4 4"
                    className="text-border"
                  />
                  <text
                    x={-8}
                    y={yScale(t)}
                    textAnchor="end"
                    dominantBaseline="central"
                    fontSize={chartTheme.font.size.tick}
                    className="fill-muted-foreground"
                  >
                    ₳{formatAda(t)}
                  </text>
                </g>
              ))}

              {/* X-axis labels */}
              {xTicks.map((epoch) => (
                <text
                  key={epoch}
                  x={xScale(epoch)}
                  y={innerHeight + 20}
                  textAnchor="middle"
                  fontSize={chartTheme.font.size.tick}
                  className="fill-muted-foreground"
                >
                  E{epoch}
                </text>
              ))}

              {/* Area fill */}
              <path d={balanceArea} fill="url(#treasury-timeline-fill)" />

              {/* Glow line */}
              <path
                d={balanceLine}
                fill="none"
                stroke={BALANCE_COLOR}
                strokeWidth={2.5}
                filter="url(#treasury-timeline-glow)"
                opacity={0.5}
              />

              {/* Main line */}
              <path
                d={balanceLine}
                fill="none"
                stroke={BALANCE_COLOR}
                strokeWidth={2}
                strokeLinejoin="round"
                strokeLinecap="round"
              />

              {/* Annotation markers */}
              {annotationPositions.map((a, i) => (
                <g key={`${a.epoch}-${a.kind}-${i}`}>
                  {a.linkHref ? (
                    <a href={a.linkHref} target="_self">
                      <AnnotationMarker
                        cx={a.x}
                        cy={a.y}
                        color={ANNOTATION_COLORS[a.kind]}
                        label={a.label}
                      />
                    </a>
                  ) : (
                    <AnnotationMarker
                      cx={a.x}
                      cy={a.y}
                      color={ANNOTATION_COLORS[a.kind]}
                      label={a.label}
                    />
                  )}
                </g>
              ))}

              {/* Hover guideline + dot */}
              {hovered && hoveredIndex !== null && (
                <>
                  <line
                    x1={xScale(hovered.epoch)}
                    x2={xScale(hovered.epoch)}
                    y1={0}
                    y2={innerHeight}
                    stroke="currentColor"
                    strokeWidth={1}
                    strokeDasharray="3 3"
                    className="text-muted-foreground/50"
                  />
                  <circle
                    cx={xScale(hovered.epoch)}
                    cy={yScale(hovered.balanceAda)}
                    r={4}
                    fill={BALANCE_COLOR}
                    stroke="var(--card)"
                    strokeWidth={2}
                  />
                </>
              )}

              {/* Hover tooltip */}
              {hovered && hoveredIndex !== null && (
                <HoverTooltip
                  x={xScale(hovered.epoch)}
                  innerWidth={innerWidth}
                  epoch={hovered.epoch}
                  balance={hovered.balanceAda}
                  income={hovered.reservesIncomeAda}
                  outflow={hovered.withdrawalsAda}
                />
              )}

              {/* Invisible interaction rect */}
              <rect
                x={0}
                y={0}
                width={innerWidth}
                height={innerHeight}
                fill="transparent"
                onMouseMove={handleMouseMove}
                onMouseLeave={handleMouseLeave}
              />
            </g>
          </svg>
        )}
      </div>

      {/* Legend */}
      <div className="flex flex-wrap items-center gap-4 mt-2 text-[10px] text-muted-foreground">
        <span className="flex items-center gap-1">
          <span
            className="inline-block h-2 w-2 rounded-full"
            style={{ background: BALANCE_COLOR }}
          />
          Balance
        </span>
        <span className="flex items-center gap-1">
          <span
            className="inline-block h-2 w-2 rounded-full"
            style={{ background: WITHDRAWAL_COLOR }}
          />
          Large withdrawal
        </span>
        <span className="flex items-center gap-1">
          <span
            className="inline-block h-2 w-2 rounded-full"
            style={{ background: INCOME_COLOR }}
          />
          High income epoch
        </span>
      </div>
    </div>
  );
}

/* ─── Annotation Marker ───────────────────────────────────────────────── */

interface AnnotationMarkerProps {
  cx: number;
  cy: number;
  color: string;
  label: string;
}

function AnnotationMarker({ cx, cy, color, label }: AnnotationMarkerProps) {
  return (
    <g className="group/annotation">
      {/* Pulse ring */}
      <circle
        cx={cx}
        cy={cy}
        r={8}
        fill={color}
        opacity={0}
        className="group-hover/annotation:opacity-20 transition-opacity"
      >
        <animate attributeName="r" values="4;10;4" dur="2s" repeatCount="indefinite" begin="0s" />
        <animate
          attributeName="opacity"
          values="0.3;0;0.3"
          dur="2s"
          repeatCount="indefinite"
          begin="0s"
        />
      </circle>
      {/* Solid dot */}
      <circle
        cx={cx}
        cy={cy}
        r={4}
        fill={color}
        stroke="var(--card)"
        strokeWidth={2}
        className="cursor-pointer"
      />
      {/* Tooltip on hover */}
      <g className="opacity-0 group-hover/annotation:opacity-100 transition-opacity pointer-events-none">
        <rect
          x={cx - 100}
          y={cy - 32}
          width={200}
          height={22}
          rx={4}
          fill={chartTheme.colors.tooltipBg}
          stroke={chartTheme.colors.tooltipBorder}
          strokeWidth={1}
        />
        <text x={cx} y={cy - 18} textAnchor="middle" fontSize={10} className="fill-foreground">
          {label.length > 45 ? label.slice(0, 42) + '...' : label}
        </text>
      </g>
    </g>
  );
}

/* ─── Hover Tooltip ───────────────────────────────────────────────────── */

interface HoverTooltipProps {
  x: number;
  innerWidth: number;
  epoch: number;
  balance: number;
  income: number;
  outflow: number;
}

function HoverTooltip({ x, innerWidth, epoch, balance, income, outflow }: HoverTooltipProps) {
  const tooltipWidth = 150;
  const tooltipHeight = 60;
  // Flip side if too close to edge
  const tx = x + tooltipWidth + 10 > innerWidth ? x - tooltipWidth - 10 : x + 10;

  return (
    <g className="pointer-events-none">
      <rect
        x={tx}
        y={4}
        width={tooltipWidth}
        height={tooltipHeight}
        rx={6}
        fill={chartTheme.colors.tooltipBg}
        stroke={chartTheme.colors.tooltipBorder}
        strokeWidth={1}
        opacity={0.95}
      />
      <text x={tx + 8} y={20} fontSize={11} fontWeight={600} className="fill-foreground">
        Epoch {epoch}
      </text>
      <text x={tx + 8} y={34} fontSize={10} className="fill-muted-foreground">
        Balance: ₳{formatAda(balance)}
      </text>
      <text x={tx + 8} y={48} fontSize={10} className="fill-muted-foreground">
        In: +₳{formatAda(income)} / Out: -₳{formatAda(outflow)}
      </text>
    </g>
  );
}

/* ─── Net Flow Bar ────────────────────────────────────────────────────── */

interface NetFlowBarProps {
  data: IncomeVsOutflow[];
}

function NetFlowBar({ data }: NetFlowBarProps) {
  if (data.length === 0) return null;

  const maxAbs = Math.max(...data.map((d) => Math.abs(d.netAda)), 1);

  return (
    <div className="rounded-xl border border-border/50 bg-card/70 backdrop-blur-md px-5 py-3">
      <h4 className="text-xs font-medium text-muted-foreground mb-2">Net Flow per Epoch</h4>
      <div className="flex items-center gap-px h-6">
        {data.map((d) => {
          const pct = Math.abs(d.netAda) / maxAbs;
          const isPositive = d.netAda >= 0;
          return (
            <div
              key={d.epoch}
              className="flex-1 relative group"
              title={`E${d.epoch}: ${isPositive ? '+' : '-'}₳${formatAda(Math.abs(d.netAda))}`}
            >
              <div
                className={`w-full rounded-sm transition-all ${
                  isPositive ? 'bg-emerald-500/60' : 'bg-red-400/50'
                }`}
                style={{ height: `${Math.max(2, pct * 24)}px` }}
              />
            </div>
          );
        })}
      </div>
      <div className="flex items-center gap-4 mt-1 text-[10px] text-muted-foreground">
        <span className="flex items-center gap-1">
          <span className="inline-block h-2 w-2 rounded-sm bg-emerald-500/60" />
          Net positive
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block h-2 w-2 rounded-sm bg-red-400/50" />
          Net negative
        </span>
      </div>
    </div>
  );
}
