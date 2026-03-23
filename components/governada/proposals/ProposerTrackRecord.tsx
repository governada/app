'use client';

import { useQuery } from '@tanstack/react-query';
import { CheckCircle2, XCircle, Clock, Building2, User, Landmark } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ProposerSummary {
  id: string;
  displayName: string;
  type: 'individual' | 'organization' | 'institutional';
  proposalCount: number;
  enactedCount: number;
  droppedCount: number;
  compositeScore: number | null;
  tier: string;
  confidence: number;
}

// ---------------------------------------------------------------------------
// Tier badge colors
// ---------------------------------------------------------------------------

const TIER_COLORS: Record<string, string> = {
  Emerging: 'bg-white/10 text-white/50',
  Bronze: 'bg-amber-900/30 text-amber-400',
  Silver: 'bg-slate-400/20 text-slate-300',
  Gold: 'bg-yellow-500/20 text-yellow-400',
  Diamond: 'bg-cyan-500/20 text-cyan-300',
  Legendary: 'bg-purple-500/20 text-purple-300',
};

const TYPE_ICONS = {
  individual: User,
  organization: Building2,
  institutional: Landmark,
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

interface ProposerTrackRecordProps {
  txHash: string;
  proposalIndex: number;
}

export function ProposerTrackRecord({ txHash, proposalIndex }: ProposerTrackRecordProps) {
  const { data: proposers, isLoading } = useQuery<ProposerSummary[]>({
    queryKey: ['proposal-proposers', txHash, proposalIndex],
    queryFn: async () => {
      const res = await fetch(`/api/governance/proposers?txHash=${txHash}&index=${proposalIndex}`);
      if (!res.ok) return [];
      return res.json();
    },
    staleTime: 10 * 60 * 1000, // 10 minutes
  });

  if (isLoading || !proposers?.length) return null;

  return (
    <TooltipProvider>
      <div className="flex flex-wrap gap-3">
        {proposers.map((proposer) => (
          <ProposerChip key={proposer.id} proposer={proposer} />
        ))}
      </div>
    </TooltipProvider>
  );
}

function ProposerChip({ proposer }: { proposer: ProposerSummary }) {
  const TypeIcon = TYPE_ICONS[proposer.type] ?? User;
  const total = proposer.proposalCount;
  const enacted = proposer.enactedCount;
  const dropped = proposer.droppedCount;
  const inProgress = total - enacted - dropped;
  const approvalRate = total > 0 ? Math.round((enacted / total) * 100) : 0;

  const tierColor = TIER_COLORS[proposer.tier] ?? TIER_COLORS.Emerging;

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div className="flex items-center gap-2 rounded-lg border border-white/5 bg-white/[0.02] px-3 py-2 text-sm">
          <TypeIcon className="h-3.5 w-3.5 text-white/40" />
          <span className="font-medium text-white/70">{proposer.displayName}</span>

          {/* Track record mini-stats */}
          <div className="flex items-center gap-1.5 text-xs text-white/40">
            <span className="flex items-center gap-0.5">
              <CheckCircle2 className="h-3 w-3 text-emerald-400/70" />
              {enacted}
            </span>
            {dropped > 0 && (
              <span className="flex items-center gap-0.5">
                <XCircle className="h-3 w-3 text-red-400/70" />
                {dropped}
              </span>
            )}
            {inProgress > 0 && (
              <span className="flex items-center gap-0.5">
                <Clock className="h-3 w-3 text-amber-400/70" />
                {inProgress}
              </span>
            )}
          </div>

          {/* Tier badge */}
          {proposer.compositeScore !== null && (
            <span className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${tierColor}`}>
              {proposer.tier}
            </span>
          )}
        </div>
      </TooltipTrigger>
      <TooltipContent side="bottom" className="max-w-xs">
        <div className="space-y-1.5">
          <p className="font-medium">{proposer.displayName}</p>
          <p className="text-xs text-muted-foreground">
            {total} proposal{total !== 1 ? 's' : ''} submitted · {approvalRate}% approval rate
          </p>
          <div className="flex gap-3 text-xs">
            <span className="text-emerald-400">{enacted} enacted</span>
            <span className="text-red-400">{dropped} dropped</span>
            {inProgress > 0 && <span className="text-amber-400">{inProgress} in progress</span>}
          </div>
          {proposer.compositeScore !== null && (
            <p className="text-xs text-muted-foreground">
              Proposer Score: {proposer.compositeScore}/100 ({proposer.tier})
            </p>
          )}
        </div>
      </TooltipContent>
    </Tooltip>
  );
}
