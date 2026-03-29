'use client';

import { Shield, Coins, Users, BarChart3 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import type { InterBodyVotes, CitizenSentiment } from '@/lib/workspace/types';

interface IntelligenceStripProps {
  interBodyVotes?: InterBodyVotes;
  citizenSentiment?: CitizenSentiment | null;
  withdrawalAmount?: number | null;
  treasuryTier?: string | null;
  epochsRemaining?: number | null;
  isUrgent?: boolean;
}

function VoteTallyChip({
  label,
  tally,
}: {
  label: string;
  tally: { yes: number; no: number; abstain: number };
}) {
  const total = tally.yes + tally.no + tally.abstain;
  if (total === 0) return null;
  const pct = Math.round((tally.yes / total) * 100);
  const color = pct >= 67 ? 'text-emerald-400' : pct >= 50 ? 'text-amber-400' : 'text-red-400';
  return (
    <span className="text-xs text-muted-foreground">
      {label} <span className={`font-medium ${color}`}>{pct}%</span>
    </span>
  );
}

export function IntelligenceStrip({
  interBodyVotes,
  citizenSentiment,
  withdrawalAmount,
  treasuryTier,
  epochsRemaining,
  isUrgent,
}: IntelligenceStripProps) {
  const hasTreasury = withdrawalAmount != null && withdrawalAmount > 0;
  const hasSentiment = citizenSentiment && citizenSentiment.total > 0;

  // Format treasury amount
  let treasuryLabel = '';
  if (hasTreasury) {
    if (withdrawalAmount >= 1_000_000) {
      treasuryLabel = `₳${(withdrawalAmount / 1_000_000).toFixed(1)}M`;
    } else if (withdrawalAmount >= 1_000) {
      treasuryLabel = `₳${Math.round(withdrawalAmount / 1_000)}K`;
    } else {
      treasuryLabel = `₳${withdrawalAmount.toLocaleString()}`;
    }
  }

  // Citizen sentiment
  let sentimentLabel = '';
  let sentimentColor = '';
  if (hasSentiment) {
    const pct = Math.round((citizenSentiment.support / citizenSentiment.total) * 100);
    sentimentLabel = `${pct}% support`;
    sentimentColor = pct >= 60 ? 'text-emerald-400' : pct <= 40 ? 'text-red-400' : 'text-amber-400';
  }

  // Urgency
  const urgencyColor = !epochsRemaining
    ? ''
    : epochsRemaining <= 1
      ? 'text-red-400'
      : epochsRemaining <= 3
        ? 'text-amber-400'
        : 'text-muted-foreground';

  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-lg border border-border/50 bg-muted/20 px-4 py-2.5 mb-4">
      {/* Constitutional risk — placeholder */}
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <Shield className="h-3.5 w-3.5" />
        <span className="text-muted-foreground/50">—</span>
      </div>

      {/* Treasury impact */}
      {hasTreasury && (
        <div className="flex items-center gap-1.5 text-xs">
          <Coins className="h-3.5 w-3.5 text-amber-400" />
          <span className="font-medium text-foreground">{treasuryLabel}</span>
          {treasuryTier && <span className="text-muted-foreground/60">{treasuryTier}</span>}
        </div>
      )}

      {/* Citizen sentiment */}
      {hasSentiment && (
        <div className="flex items-center gap-1.5 text-xs">
          <Users className="h-3.5 w-3.5 text-muted-foreground" />
          <span className={`font-medium ${sentimentColor}`}>{sentimentLabel}</span>
          <span className="text-muted-foreground/50">
            ({citizenSentiment.total} citizen{citizenSentiment.total !== 1 ? 's' : ''})
          </span>
        </div>
      )}

      {/* Inter-body vote tallies */}
      {interBodyVotes && (
        <div className="flex items-center gap-3 text-xs">
          <BarChart3 className="h-3.5 w-3.5 text-muted-foreground" />
          <VoteTallyChip label="DRep" tally={interBodyVotes.drep} />
          <VoteTallyChip label="SPO" tally={interBodyVotes.spo} />
          <VoteTallyChip label="CC" tally={interBodyVotes.cc} />
        </div>
      )}

      {/* Urgency */}
      {epochsRemaining != null && (
        <div className={`flex items-center gap-1 text-xs font-medium ml-auto ${urgencyColor}`}>
          {epochsRemaining}e left
          {isUrgent && (
            <Badge variant="outline" className="text-[10px] border-red-500/40 text-red-400 ml-1">
              Urgent
            </Badge>
          )}
        </div>
      )}
    </div>
  );
}
