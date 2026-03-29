'use client';

/**
 * DiscoveryOverlay — Lightweight entity card list when a filter is active.
 *
 * Desktop: Left side panel (350px) — CSS hidden on mobile.
 * Mobile: Bottom sheet — CSS hidden on desktop.
 *
 * Each filter type renders a separate sub-component that calls only
 * its own data hook, avoiding unnecessary fetches.
 */

import { useMemo, useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, ArrowUpDown } from 'lucide-react';
import { Sheet, SheetContent } from '@/components/ui/sheet';
import { useDReps, useProposals, useCommitteeMembers } from '@/hooks/queries';
import { useQuery } from '@tanstack/react-query';
import { computeTier } from '@/lib/scoring/tiers';
import { cn } from '@/lib/utils';
import { posthog } from '@/lib/posthog';
import { encodeEntityParam } from '@/lib/homepage/parseEntityParam';
import type { EnrichedDRep } from '@/lib/koios';
import type { BrowseProposal } from '@/components/governada/discover/ProposalCard';
import type { GovernadaSPOData } from '@/components/governada/cards/GovernadaSPOCard';
import type { CommitteeMemberQuickView } from '@/hooks/queries';
import { TIER_SCORE_COLOR, TIER_BADGE_BG, tierKey } from '@/components/governada/cards/tierStyles';

type SortMode = 'score' | 'activity';

const CARD_CLASS =
  'w-full text-left p-3 rounded-xl border border-white/5 bg-white/[0.02] hover:bg-white/[0.05] transition-colors';

interface DiscoveryOverlayProps {
  filter: string | null;
  initialSort?: string;
  onEntitySelect: (entityParam: string) => void;
  onClose: () => void;
}

const FILTER_LABELS: Record<string, string> = {
  proposals: 'Proposals',
  dreps: 'DReps',
  spos: 'Stake Pools',
  cc: 'Committee',
  treasury: 'Treasury',
};

// ─── Per-filter content components (each calls only its own hook) ──

function DRepList({
  sortMode,
  onEntitySelect,
}: {
  sortMode: SortMode;
  onEntitySelect: (p: string) => void;
}) {
  const { data: raw } = useDReps();
  const drepsData = raw as { allDReps?: EnrichedDRep[] } | undefined;
  const sorted = useMemo(() => {
    const dreps = drepsData?.allDReps ?? [];
    return sortMode === 'score'
      ? [...dreps].sort((a, b) => (b.drepScore ?? 0) - (a.drepScore ?? 0))
      : [...dreps].sort((a, b) => (b.delegatorCount ?? 0) - (a.delegatorCount ?? 0));
  }, [drepsData, sortMode]);

  return (
    <div className="space-y-2">
      {sorted.slice(0, 50).map((d) => {
        const tier = computeTier(d.drepScore ?? 0);
        const tk = tierKey(tier);
        return (
          <button
            key={d.drepId}
            onClick={() => onEntitySelect(encodeEntityParam('drep', d.drepId))}
            className={CARD_CLASS}
          >
            <div className="flex items-center gap-3">
              <div
                className={cn(
                  'w-9 h-9 rounded-lg flex items-center justify-center text-sm font-bold',
                  TIER_BADGE_BG[tk],
                )}
              >
                {d.drepScore ?? '—'}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">
                  {d.name || d.handle || d.drepId?.slice(0, 16)}
                </p>
                <p className="text-xs text-muted-foreground">
                  {d.delegatorCount ?? 0} delegators · {d.isActive ? 'Active' : 'Inactive'}
                </p>
              </div>
              <span className={cn('text-xs font-medium', TIER_SCORE_COLOR[tk])}>{tier}</span>
            </div>
          </button>
        );
      })}
    </div>
  );
}

function ProposalList({ onEntitySelect }: { onEntitySelect: (p: string) => void }) {
  const { data: raw } = useProposals(200);
  const proposalsData = raw as { proposals?: BrowseProposal[] } | undefined;
  const proposals = proposalsData?.proposals ?? [];

  return (
    <div className="space-y-2">
      {proposals.slice(0, 50).map((p) => (
        <button
          key={`${p.txHash}_${p.index}`}
          onClick={() => onEntitySelect(encodeEntityParam('proposal', p.txHash, String(p.index)))}
          className={CARD_CLASS}
        >
          <p className="text-sm font-medium line-clamp-2">
            {p.title || `Proposal ${p.txHash?.slice(0, 12)}`}
          </p>
          <div className="flex items-center gap-2 mt-1">
            <span className="text-xs text-muted-foreground">{p.type ?? 'Proposal'}</span>
            {p.status && (
              <span className="text-xs px-1.5 py-0.5 rounded bg-white/5">{p.status}</span>
            )}
          </div>
        </button>
      ))}
    </div>
  );
}

function PoolList({
  sortMode,
  onEntitySelect,
}: {
  sortMode: SortMode;
  onEntitySelect: (p: string) => void;
}) {
  const { data: pools } = useQuery<GovernadaSPOData[]>({
    queryKey: ['governada-pools'],
    queryFn: async () => {
      const res = await fetch('/api/governance/pools');
      if (!res.ok) return [];
      const data = await res.json();
      return data.pools ?? [];
    },
    staleTime: 120_000,
  });

  const sorted = useMemo(() => {
    const list = pools ?? [];
    return sortMode === 'score'
      ? [...list].sort((a, b) => (b.governanceScore ?? 0) - (a.governanceScore ?? 0))
      : [...list].sort((a, b) => (b.voteCount ?? 0) - (a.voteCount ?? 0));
  }, [pools, sortMode]);

  return (
    <div className="space-y-2">
      {sorted.slice(0, 50).map((pool) => {
        const tier = computeTier(pool.governanceScore ?? 0);
        const tk = tierKey(tier);
        return (
          <button
            key={pool.poolId}
            onClick={() => onEntitySelect(encodeEntityParam('pool', pool.poolId))}
            className={CARD_CLASS}
          >
            <div className="flex items-center gap-3">
              <div
                className={cn(
                  'w-9 h-9 rounded-lg flex items-center justify-center text-sm font-bold',
                  TIER_BADGE_BG[tk],
                )}
              >
                {pool.governanceScore ?? '—'}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">
                  {pool.ticker ? `[${pool.ticker}] ` : ''}
                  {pool.poolName || pool.poolId?.slice(0, 16)}
                </p>
                <p className="text-xs text-muted-foreground">
                  {pool.voteCount ?? 0} votes · {pool.delegatorCount ?? 0} delegators
                </p>
              </div>
              <span className={cn('text-xs font-medium', TIER_SCORE_COLOR[tk])}>{tier}</span>
            </div>
          </button>
        );
      })}
    </div>
  );
}

function CCList({ onEntitySelect }: { onEntitySelect: (p: string) => void }) {
  const { data: raw } = useCommitteeMembers();
  const ccData = raw as { members?: CommitteeMemberQuickView[] } | undefined;
  const members = ccData?.members ?? [];

  return (
    <div className="space-y-2">
      {members.map((m) => (
        <button
          key={m.ccHotId}
          onClick={() => onEntitySelect(encodeEntityParam('cc', m.ccHotId))}
          className={CARD_CLASS}
        >
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-white/5 flex items-center justify-center text-sm font-bold">
              {m.fidelityGrade || '—'}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{m.name || m.ccHotId?.slice(0, 16)}</p>
              <p className="text-xs text-muted-foreground">
                {m.voteCount ?? 0} votes · {Math.round(m.approvalRate ?? 0)}% approval
              </p>
            </div>
          </div>
        </button>
      ))}
    </div>
  );
}

function FilterContent({
  filter,
  sortMode,
  onEntitySelect,
}: {
  filter: string;
  sortMode: SortMode;
  onEntitySelect: (p: string) => void;
}) {
  switch (filter) {
    case 'dreps':
      return <DRepList sortMode={sortMode} onEntitySelect={onEntitySelect} />;
    case 'proposals':
    case 'treasury':
      return <ProposalList onEntitySelect={onEntitySelect} />;
    case 'spos':
      return <PoolList sortMode={sortMode} onEntitySelect={onEntitySelect} />;
    case 'cc':
      return <CCList onEntitySelect={onEntitySelect} />;
    default:
      return <p className="text-sm text-muted-foreground p-4">No results</p>;
  }
}

// ─── Main ──────────────────────────────────────────────────

export function DiscoveryOverlay({
  filter,
  initialSort,
  onEntitySelect,
  onClose,
}: DiscoveryOverlayProps) {
  const [sortMode, setSortMode] = useState<SortMode>(
    initialSort === 'activity' ? 'activity' : 'score',
  );
  const isOpen = filter !== null;

  useEffect(() => {
    if (filter) {
      posthog.capture('discovery_filter_opened', { filter });
    }
  }, [filter]);

  const header = filter ? (
    <div className="flex items-center justify-between px-4 py-3 border-b border-white/5">
      <h2 className="text-sm font-medium">{FILTER_LABELS[filter] ?? filter}</h2>
      <div className="flex items-center gap-2">
        <button
          onClick={() => setSortMode((m) => (m === 'score' ? 'activity' : 'score'))}
          className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowUpDown className="h-3 w-3" />
          {sortMode === 'score' ? 'Score' : 'Activity'}
        </button>
        <button
          onClick={onClose}
          className="p-1 rounded hover:bg-white/5 text-muted-foreground"
          aria-label="Close discovery"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  ) : null;

  return (
    <>
      {/* Mobile: bottom sheet */}
      <div className="md:hidden">
        <Sheet open={isOpen} onOpenChange={(open) => !open && onClose()}>
          <SheetContent
            side="bottom"
            className="max-h-[70vh] rounded-t-2xl bg-background/95 backdrop-blur-xl border-t border-white/10 px-0"
            showCloseButton={false}
          >
            <div className="flex justify-center py-2">
              <div className="w-8 h-1 rounded-full bg-white/20" />
            </div>
            {header}
            <div className="overflow-y-auto px-4 py-3 max-h-[calc(70vh-5rem)]">
              {filter && (
                <FilterContent
                  filter={filter}
                  sortMode={sortMode}
                  onEntitySelect={onEntitySelect}
                />
              )}
            </div>
          </SheetContent>
        </Sheet>
      </div>

      {/* Desktop: left side panel */}
      <div className="hidden md:block">
        <AnimatePresence>
          {isOpen && filter && (
            <motion.div
              key="discovery-overlay-desktop"
              initial={{ x: -370, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: -370, opacity: 0 }}
              transition={{ type: 'spring', stiffness: 300, damping: 30 }}
              className={cn(
                'fixed top-14 left-16 bottom-20 z-40',
                'w-[350px]',
                'backdrop-blur-2xl bg-black/75 border border-white/[0.08]',
                'rounded-2xl shadow-2xl shadow-black/40',
                'flex flex-col overflow-hidden',
              )}
            >
              {header}
              <div className="flex-1 overflow-y-auto px-4 py-3">
                <FilterContent
                  filter={filter}
                  sortMode={sortMode}
                  onEntitySelect={onEntitySelect}
                />
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </>
  );
}
