'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { AlertTriangle, Clock, ArrowRight } from 'lucide-react';

interface UrgentProposal {
  txHash: string;
  index: number;
  title: string;
  proposalType: string;
  epochsRemaining: number;
}

interface DashboardUrgentBarProps {
  drepId: string;
}

export function DashboardUrgentBar({ drepId }: DashboardUrgentBarProps) {
  const [proposals, setProposals] = useState<UrgentProposal[]>([]);

  useEffect(() => {
    fetch(`/api/dashboard/urgent?drepId=${encodeURIComponent(drepId)}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data?.proposals) setProposals(data.proposals);
      })
      .catch(() => {});
  }, [drepId]);

  if (proposals.length === 0) return null;

  return (
    <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-4 space-y-3">
      <div className="flex items-center gap-2">
        <AlertTriangle className="h-4 w-4 text-amber-500" />
        <span className="text-sm font-semibold">
          {proposals.length} proposal{proposals.length !== 1 ? 's' : ''} awaiting
          your vote
        </span>
      </div>
      <div className="space-y-2">
        {proposals.slice(0, 3).map((p) => (
          <Link
            key={`${p.txHash}-${p.index}`}
            href={`/proposals/${p.txHash}/${p.index}`}
            className="flex items-center justify-between gap-3 p-2 rounded-md hover:bg-amber-500/10 transition-colors"
          >
            <div className="flex items-center gap-2 min-w-0">
              <Badge
                variant="outline"
                className="text-[10px] shrink-0 border-amber-500/30"
              >
                {p.proposalType}
              </Badge>
              <span className="text-sm truncate">{p.title}</span>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <span className="flex items-center gap-1 text-xs text-amber-600 dark:text-amber-400">
                <Clock className="h-3 w-3" />
                {p.epochsRemaining} epoch{p.epochsRemaining !== 1 ? 's' : ''}
              </span>
              <ArrowRight className="h-3.5 w-3.5 text-muted-foreground" />
            </div>
          </Link>
        ))}
      </div>
      {proposals.length > 3 && (
        <Link href="/dashboard/inbox">
          <Button variant="ghost" size="sm" className="text-xs">
            View all {proposals.length} pending proposals
          </Button>
        </Link>
      )}
    </div>
  );
}
