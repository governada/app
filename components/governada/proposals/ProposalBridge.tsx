'use client';

import Link from 'next/link';
import { Vote, CheckCircle2, Wallet } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useSegment } from '@/components/providers/SegmentProvider';
import { useWallet } from '@/utils/wallet';
import { canBodyVote } from '@/lib/governance/votingBodies';
import { CitizenSentimentReaction } from './CitizenSentimentReaction';
import { cn } from '@/lib/utils';

interface ProposalBridgeProps {
  txHash: string;
  proposalIndex: number;
  title: string;
  isOpen: boolean;
  proposalType?: string | null;
  /** Pre-fetched existing vote choice if any (e.g. "Yes", "No", "Abstain") */
  existingVote?: string | null;
}

/**
 * ProposalBridge — lightweight bridge from the discovery layer to the action layer.
 *
 * Replaces ProposalActionZone + InlineActionNudge. No embedded voting flows.
 * - Governance actors: "Review & Vote" button → /workspace/review?proposal={key}
 * - Citizens: inline CitizenSentimentReaction (one-tap micro-interaction)
 * - Anonymous: wallet-connect CTA
 */
export function ProposalBridge({
  txHash,
  proposalIndex,
  title,
  isOpen,
  proposalType,
  existingVote,
}: ProposalBridgeProps) {
  const { segment } = useSegment();
  const { authenticate } = useWallet();

  const isGovernanceActor = segment === 'drep' || segment === 'spo' || segment === 'cc';
  const effectiveType = proposalType ?? 'InfoAction';
  const voterBody = segment === 'spo' ? 'spo' : segment === 'cc' ? 'cc' : 'drep';
  const canVote = isGovernanceActor && canBodyVote(voterBody, effectiveType);
  const proposalKey = `${txHash}:${proposalIndex}`;

  // ── Governance actors: bridge to ReviewWorkspace ──
  if (isGovernanceActor) {
    return (
      <section className="space-y-3">
        {isOpen && canVote && (
          <div
            className={cn(
              'flex items-center justify-between gap-3 rounded-xl border px-4 py-3',
              existingVote
                ? 'border-emerald-500/20 bg-emerald-500/5'
                : 'border-primary/20 bg-primary/5',
            )}
          >
            <div className="flex items-center gap-2.5 min-w-0">
              {existingVote ? (
                <>
                  <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
                  <span className="text-sm font-medium truncate">
                    You voted{' '}
                    <Badge variant="outline" className="ml-1 text-xs">
                      {existingVote}
                    </Badge>
                  </span>
                </>
              ) : (
                <>
                  <Vote className="h-4 w-4 text-primary shrink-0" />
                  <span className="text-sm text-muted-foreground truncate">
                    This proposal needs your vote
                  </span>
                </>
              )}
            </div>
            <Button asChild size="sm" variant={existingVote ? 'outline' : 'default'}>
              <Link
                href={`/workspace/review?proposal=${proposalKey}`}
                aria-label={`${existingVote ? 'Review' : 'Review and vote on'} ${title}`}
              >
                {existingVote ? 'Review' : 'Review & Vote'}
              </Link>
            </Button>
          </div>
        )}

        {/* Citizen sentiment as discovery data for governance actors */}
        <CitizenSentimentReaction
          txHash={txHash}
          proposalIndex={proposalIndex}
          isOpen={isOpen}
          readOnly
        />
      </section>
    );
  }

  // ── Anonymous: connect CTA ──
  if (segment === 'anonymous') {
    return (
      <section className="space-y-3">
        <div className="flex items-center justify-between gap-3 rounded-xl border border-border bg-card px-4 py-3">
          <div className="flex items-center gap-2.5">
            <Wallet className="h-4 w-4 text-muted-foreground shrink-0" />
            <span className="text-sm text-muted-foreground">
              Connect your wallet to share your opinion
            </span>
          </div>
          <Button size="sm" variant="outline" onClick={() => authenticate?.()}>
            Connect
          </Button>
        </div>
        {/* Show read-only results even for anonymous */}
        <CitizenSentimentReaction
          txHash={txHash}
          proposalIndex={proposalIndex}
          isOpen={isOpen}
          readOnly
        />
      </section>
    );
  }

  // ── Citizen: interactive sentiment reaction ──
  return (
    <section>
      <CitizenSentimentReaction txHash={txHash} proposalIndex={proposalIndex} isOpen={isOpen} />
    </section>
  );
}
