'use client';

import { User } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatAda } from '@/lib/treasury';
import type { NclUtilization } from '@/lib/treasury';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

/* ── Types ──────────────────────────────────────────────────────────── */

interface TreasuryHeroProps {
  balanceAda: number;
  trend: 'growing' | 'shrinking' | 'stable';
  ncl: NclUtilization | null;
  effectivenessRate: number | null;
  pendingCount: number;
  pendingTotalAda?: number;
  runwayMonths: number;
  proportionalShareAda?: number;
}

type VerdictStatus = 'healthy' | 'attention' | 'critical';

/* ── Status derivation ──────────────────────────────────────────────── */

function deriveStatus(
  ncl: NclUtilization | null,
  effectivenessRate: number | null,
  trend: 'growing' | 'shrinking' | 'stable',
  runwayMonths: number,
): VerdictStatus {
  if (ncl?.status === 'critical') return 'critical';
  if (runwayMonths > 0 && runwayMonths < 12) return 'critical';
  if (ncl?.status === 'elevated') return 'attention';
  if (effectivenessRate !== null && effectivenessRate < 50) return 'attention';
  if (trend === 'shrinking') return 'attention';
  return 'healthy';
}

const STATUS_CONFIG = {
  healthy: {
    label: 'Treasury is Healthy',
    color: 'text-emerald-400',
    ring: 'ring-emerald-500/20',
    dot: 'bg-emerald-500',
    glow: 'shadow-[0_0_12px_rgba(16,185,129,0.15)]',
    barEnacted: 'bg-emerald-500',
    barPending: 'bg-emerald-500/40',
    barGlow: '#10b981',
  },
  attention: {
    label: 'Treasury Needs Attention',
    color: 'text-amber-400',
    ring: 'ring-amber-500/20',
    dot: 'bg-amber-500',
    glow: 'shadow-[0_0_12px_rgba(245,158,11,0.15)]',
    barEnacted: 'bg-amber-500',
    barPending: 'bg-amber-500/40',
    barGlow: '#f59e0b',
  },
  critical: {
    label: 'Treasury Under Pressure',
    color: 'text-red-400',
    ring: 'ring-red-500/20',
    dot: 'bg-red-500',
    glow: 'shadow-[0_0_12px_rgba(239,68,68,0.15)]',
    barEnacted: 'bg-red-500',
    barPending: 'bg-red-500/40',
    barGlow: '#ef4444',
  },
} as const;

/* ── Component ──────────────────────────────────────────────────────── */

function formatRunwayHero(months: number): string {
  if (months >= 999) return '10yr+';
  if (months >= 24) return `${Math.floor(months / 12)}yr+`;
  return `${months}mo`;
}

function runwayColor(months: number): string {
  if (months > 24) return 'text-emerald-400';
  if (months >= 12) return 'text-amber-400';
  return 'text-red-400';
}

export function TreasuryHero({
  balanceAda,
  trend,
  ncl,
  effectivenessRate,
  pendingCount,
  pendingTotalAda,
  runwayMonths,
  proportionalShareAda,
}: TreasuryHeroProps) {
  const status = deriveStatus(ncl, effectivenessRate, trend, runwayMonths);
  const config = STATUS_CONFIG[status];

  const enactedPct = ncl ? Math.min(100, ncl.utilizationPct) : 0;
  const pendingPct = ncl
    ? Math.min(100 - enactedPct, ncl.projectedUtilizationPct - ncl.utilizationPct)
    : 0;

  return (
    <div
      className={cn(
        'rounded-xl border border-border/50 bg-card/70 backdrop-blur-md p-5 ring-1 space-y-4',
        config.ring,
        config.glow,
      )}
    >
      {/* ── Runway hero number ─────────────────────────────────── */}
      {runwayMonths > 0 && (
        <p className={cn('text-3xl font-bold tabular-nums', runwayColor(runwayMonths))}>
          {formatRunwayHero(runwayMonths)} runway
        </p>
      )}

      {/* ── Verdict headline ────────────────────────────────────── */}
      <div className="flex items-center gap-2.5">
        <span className={cn('h-2.5 w-2.5 rounded-full animate-pulse', config.dot)} />
        <h2 className={cn('text-lg font-semibold', config.color)}>{config.label}</h2>
      </div>

      {/* ── Key stats row ───────────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-sm">
        <span className="text-muted-foreground">
          ₳<span className="font-semibold text-foreground">{formatAda(balanceAda)}</span> balance
          {trend !== 'stable' && (
            <span className="ml-1 text-xs">({trend === 'growing' ? '↑' : '↓'})</span>
          )}
        </span>
        <span className="text-muted-foreground">
          <span className="font-semibold text-foreground">{pendingCount}</span>{' '}
          {pendingCount === 1 ? 'proposal' : 'proposals'} pending
          {pendingTotalAda != null && pendingTotalAda > 0 && (
            <span className="ml-1">(₳{formatAda(pendingTotalAda)})</span>
          )}
        </span>
        {runwayMonths > 0 && (
          <span className="text-muted-foreground">
            <span className="font-semibold text-foreground">
              {runwayMonths < 12 ? `${runwayMonths}mo` : `${Math.round(runwayMonths / 12)}yr`}
            </span>{' '}
            runway
          </span>
        )}
      </div>

      {/* ── Personal share ────────────────────────────────────── */}
      {proportionalShareAda != null && (
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <User className="h-3 w-3" />
          <span>Your proportional share: ₳{formatAda(proportionalShareAda)}</span>
        </div>
      )}

      {/* ── NCL Budget bar (inline) ─────────────────────────────── */}
      {ncl && (
        <div className="space-y-2.5">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>
              NCL Budget: ₳{formatAda(ncl.period.nclAda)}{' '}
              <span className="text-muted-foreground/60">
                (Epochs {ncl.period.startEpoch}–{ncl.period.endEpoch})
              </span>
            </span>
            <span className="font-medium">
              {Math.round(ncl.utilizationPct)}% used · ₳{formatAda(ncl.remainingAda)} remaining
            </span>
          </div>

          {/* Segmented bar */}
          <TooltipProvider>
            <div className="relative h-3 w-full">
              <div className="absolute inset-0 rounded-full bg-muted/30" />
              <Tooltip>
                <TooltipTrigger asChild>
                  <div
                    className={cn(
                      'absolute inset-y-0 left-0 rounded-l-full transition-all',
                      config.barEnacted,
                    )}
                    style={{
                      width: `${enactedPct}%`,
                      boxShadow: `0 0 6px ${config.barGlow}40`,
                    }}
                  >
                    <div className="absolute inset-x-0 top-0 h-[40%] rounded-t-full bg-white/[0.12]" />
                  </div>
                </TooltipTrigger>
                <TooltipContent>
                  Enacted: ₳{formatAda(ncl.enactedWithdrawalsAda)} ({Math.round(ncl.utilizationPct)}
                  %)
                </TooltipContent>
              </Tooltip>
              {pendingPct > 0 && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div
                      className={cn('absolute inset-y-0 transition-all', config.barPending)}
                      style={{
                        left: `${enactedPct}%`,
                        width: `${pendingPct}%`,
                        backgroundImage:
                          'repeating-linear-gradient(45deg, transparent, transparent 3px, rgba(255,255,255,0.1) 3px, rgba(255,255,255,0.1) 6px)',
                      }}
                    />
                  </TooltipTrigger>
                  <TooltipContent>
                    Pending: ₳{formatAda(ncl.pendingWithdrawalsAda)} ({Math.round(pendingPct)}%)
                  </TooltipContent>
                </Tooltip>
              )}
            </div>
          </TooltipProvider>

          {/* Context */}
          <div className="flex flex-wrap items-center gap-x-5 gap-y-1 text-xs text-muted-foreground">
            <span>
              Epoch {ncl.epochsElapsed} of {ncl.period.endEpoch - ncl.period.startEpoch} in this
              budget period ({Math.round(ncl.periodProgressPct)}%)
            </span>
            {ncl.sustainabilityRatio < 1 && (
              <span className="text-amber-400">
                NCL exceeds projected annual income (ratio: {ncl.sustainabilityRatio}x)
              </span>
            )}
          </div>
        </div>
      )}

      {!ncl && (
        <p className="text-xs text-muted-foreground">
          No active NCL period. The community has not yet set a spending limit.
        </p>
      )}
    </div>
  );
}
