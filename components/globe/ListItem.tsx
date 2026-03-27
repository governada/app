'use client';

/**
 * ListItem — Compact entity card for the globe list overlay.
 *
 * Renders a condensed view of DReps, proposals, pools, or CC members.
 * Highlights on hover (syncs with globe). Clicks open the detail panel.
 */

import { cn } from '@/lib/utils';
import { computeTier } from '@/lib/scoring/tiers';
import {
  tierKey,
  TIER_SCORE_COLOR,
  TIER_LEFT_ACCENT,
} from '@/components/governada/cards/tierStyles';
import type { EnrichedDRep } from '@/lib/koios';
import type { BrowseProposal } from '@/components/governada/discover/ProposalCard';
import type { GovernadaSPOData } from '@/components/governada/cards/GovernadaSPOCard';
import type { CommitteeMemberQuickView } from '@/hooks/queries';

// ---------------------------------------------------------------------------
// Union entity type
// ---------------------------------------------------------------------------

export type ListEntity =
  | { type: 'drep'; data: EnrichedDRep }
  | { type: 'proposal'; data: BrowseProposal; currentEpoch: number | null }
  | { type: 'pool'; data: GovernadaSPOData }
  | { type: 'cc'; data: CommitteeMemberQuickView };

interface ListItemProps {
  entity: ListEntity;
  onHover?: (nodeId: string | null) => void;
  onClick?: (route: string) => void;
  isHighlighted?: boolean;
}

export function ListItem({ entity, onHover, onClick, isHighlighted }: ListItemProps) {
  const nodeId = getNodeId(entity);
  const route = getRoute(entity);

  return (
    <button
      className={cn(
        'w-full text-left px-3 py-2.5 rounded-lg transition-all duration-150',
        'hover:bg-white/[0.06] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary/50',
        isHighlighted && 'bg-white/[0.08] ring-1 ring-white/10',
      )}
      onMouseEnter={() => onHover?.(nodeId)}
      onMouseLeave={() => onHover?.(null)}
      onClick={() => onClick?.(route)}
    >
      {entity.type === 'drep' && <DRepItem drep={entity.data} />}
      {entity.type === 'proposal' && (
        <ProposalItem proposal={entity.data} currentEpoch={entity.currentEpoch} />
      )}
      {entity.type === 'pool' && <PoolItem pool={entity.data} />}
      {entity.type === 'cc' && <CCItem member={entity.data} />}
    </button>
  );
}

// ---------------------------------------------------------------------------
// DRep list item
// ---------------------------------------------------------------------------

function DRepItem({ drep }: { drep: EnrichedDRep }) {
  const score = Math.round(drep.drepScore ?? 0);
  const tier = computeTier(score);
  const tk = tierKey(tier);
  const name = drep.name || drep.ticker || truncateId(drep.drepId);

  return (
    <div className={cn('flex items-center gap-3', TIER_LEFT_ACCENT[tk], 'pl-3')}>
      {/* Score pill */}
      <div
        className={cn('text-sm font-semibold tabular-nums w-8 text-center', TIER_SCORE_COLOR[tk])}
      >
        {score}
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium text-foreground truncate">{name}</div>
        <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
          <span>{drep.totalVotes ?? 0} votes</span>
          <span className="text-white/20">·</span>
          <span>{formatPower(drep.votingPower)}</span>
          {tier !== 'Emerging' && (
            <>
              <span className="text-white/20">·</span>
              <span className={TIER_SCORE_COLOR[tk]}>{tier}</span>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Proposal list item
// ---------------------------------------------------------------------------

const STATUS_COLOR: Record<string, string> = {
  Ratified: 'text-emerald-400',
  Enacted: 'text-emerald-400',
  Active: 'text-amber-400',
  Expired: 'text-muted-foreground',
  Dropped: 'text-red-400',
};

function ProposalItem({
  proposal,
  currentEpoch,
}: {
  proposal: BrowseProposal;
  currentEpoch: number | null;
}) {
  const status = proposal.status ?? 'Active';
  const isOpen =
    status === 'Active' && currentEpoch != null && (proposal.expirationEpoch ?? 0) > currentEpoch;
  const displayStatus = isOpen ? 'Open' : status;
  const treasury = proposal.withdrawalAmount;

  return (
    <div className="flex items-start gap-3">
      {/* Status indicator */}
      <div
        className={cn(
          'mt-1 w-2 h-2 rounded-full shrink-0',
          isOpen
            ? 'bg-amber-400'
            : status === 'Ratified' || status === 'Enacted'
              ? 'bg-emerald-400'
              : 'bg-muted-foreground/40',
        )}
      />
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium text-foreground truncate">
          {proposal.title || `Proposal #${proposal.index}`}
        </div>
        <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
          <span className={STATUS_COLOR[status] ?? 'text-muted-foreground'}>{displayStatus}</span>
          {proposal.type && (
            <>
              <span className="text-white/20">·</span>
              <span>{proposal.type}</span>
            </>
          )}
          {treasury != null && treasury > 0 && (
            <>
              <span className="text-white/20">·</span>
              <span>{formatAda(treasury)}</span>
            </>
          )}
        </div>
      </div>
      {/* Tri-body mini bar */}
      {proposal.triBody && <MiniVoteBar tri={proposal.triBody} />}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Pool list item
// ---------------------------------------------------------------------------

function PoolItem({ pool }: { pool: GovernadaSPOData }) {
  const score = Math.round(pool.governanceScore ?? 0);
  const tier = computeTier(score);
  const tk = tierKey(tier);
  const name = pool.ticker || pool.poolName || truncateId(pool.poolId);

  return (
    <div className={cn('flex items-center gap-3', TIER_LEFT_ACCENT[tk], 'pl-3')}>
      <div
        className={cn('text-sm font-semibold tabular-nums w-8 text-center', TIER_SCORE_COLOR[tk])}
      >
        {score}
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium text-foreground truncate">{name}</div>
        <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
          <span>{pool.voteCount} votes</span>
          <span className="text-white/20">·</span>
          <span>{formatStake(pool.liveStakeAda)}</span>
          {tier !== 'Emerging' && (
            <>
              <span className="text-white/20">·</span>
              <span className={TIER_SCORE_COLOR[tk]}>{tier}</span>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// CC member list item
// ---------------------------------------------------------------------------

const GRADE_COLOR: Record<string, string> = {
  A: 'text-emerald-400',
  B: 'text-cyan-400',
  C: 'text-amber-400',
  D: 'text-orange-400',
  F: 'text-red-400',
};

function CCItem({ member }: { member: CommitteeMemberQuickView }) {
  const grade = member.fidelityGrade ?? '?';
  const name = member.name || truncateId(member.ccHotId);

  return (
    <div className="flex items-center gap-3">
      <div
        className={cn(
          'text-sm font-bold w-8 text-center',
          GRADE_COLOR[grade] ?? 'text-muted-foreground',
        )}
      >
        {grade}
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium text-foreground truncate">{name}</div>
        <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
          <span>{member.voteCount} votes</span>
          <span className="text-white/20">·</span>
          <span>{Math.round(member.approvalRate)}% approval</span>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Mini vote bar for proposals
// ---------------------------------------------------------------------------

interface TriBody {
  drep?: { yes: number; no: number; abstain: number };
  spo?: { yes: number; no: number; abstain: number };
  cc?: { yes: number; no: number; abstain: number };
}

function MiniVoteBar({ tri }: { tri: TriBody }) {
  // Use DRep votes as primary indicator
  const data = tri.drep ?? tri.spo ?? tri.cc;
  if (!data) return null;
  const total = data.yes + data.no + data.abstain;
  if (total === 0) return null;
  const yesPct = (data.yes / total) * 100;
  const noPct = (data.no / total) * 100;

  return (
    <div className="w-12 h-1.5 rounded-full bg-muted/40 overflow-hidden flex shrink-0 mt-2">
      {yesPct > 0 && <div className="bg-emerald-500/80" style={{ width: `${yesPct}%` }} />}
      {noPct > 0 && <div className="bg-red-500/70" style={{ width: `${noPct}%` }} />}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getNodeId(entity: ListEntity): string {
  switch (entity.type) {
    case 'drep':
      return `drep_${entity.data.drepId}`;
    case 'proposal':
      return `proposal_${entity.data.txHash}_${entity.data.index}`;
    case 'pool':
      return `spo_${entity.data.poolId}`;
    case 'cc':
      return `cc_${entity.data.ccHotId}`;
  }
}

function getRoute(entity: ListEntity): string {
  switch (entity.type) {
    case 'drep':
      return `/g/drep/${encodeURIComponent(entity.data.drepId)}`;
    case 'proposal':
      return `/g/proposal/${entity.data.txHash}/${entity.data.index}`;
    case 'pool':
      return `/g/pool/${encodeURIComponent(entity.data.poolId)}`;
    case 'cc':
      return `/g/cc/${encodeURIComponent(entity.data.ccHotId)}`;
  }
}

function truncateId(id: string): string {
  if (id.length <= 12) return id;
  return `${id.slice(0, 6)}…${id.slice(-4)}`;
}

function formatPower(power: number | null | undefined): string {
  if (power == null || power === 0) return '0 ₳';
  if (power >= 1_000_000_000) return `${(power / 1_000_000_000).toFixed(1)}B ₳`;
  if (power >= 1_000_000) return `${(power / 1_000_000).toFixed(1)}M ₳`;
  if (power >= 1_000) return `${Math.round(power / 1_000)}K ₳`;
  return `${Math.round(power)} ₳`;
}

function formatAda(ada: number): string {
  if (ada >= 1_000_000_000) return `₳${(ada / 1_000_000_000).toFixed(1)}B`;
  if (ada >= 1_000_000) return `₳${(ada / 1_000_000).toFixed(1)}M`;
  if (ada >= 1_000) return `₳${Math.round(ada / 1_000)}K`;
  return `₳${Math.round(ada)}`;
}

function formatStake(ada: number): string {
  if (ada >= 1_000_000_000) return `${(ada / 1_000_000_000).toFixed(1)}B ₳`;
  if (ada >= 1_000_000) return `${(ada / 1_000_000).toFixed(1)}M ₳`;
  if (ada >= 1_000) return `${Math.round(ada / 1_000)}K ₳`;
  return `${Math.round(ada)} ₳`;
}
