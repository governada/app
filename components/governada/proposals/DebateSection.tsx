'use client';

import { useState } from 'react';
import Link from 'next/link';
import { MessageSquare, ShieldCheck, ShieldAlert, ChevronDown, ChevronUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ShareActions } from '@/components/ShareActions';
import { ProposalDepthGate } from '@/components/governada/proposals/ProposalDepthGate';
import { useSegment } from '@/components/providers/SegmentProvider';
import { cn } from '@/lib/utils';
import type { RationaleEntry } from './ProposalTopRationales';

interface DebateSectionProps {
  rationales: RationaleEntry[];
  proposalTitle?: string;
  txHash?: string;
  proposalIndex?: number;
}

function RationaleCard({
  entry,
  expanded,
  onToggle,
  shareUrl,
  shareText,
}: {
  entry: RationaleEntry;
  expanded: boolean;
  onToggle: () => void;
  shareUrl?: string;
  shareText?: string;
}) {
  const displayText = entry.rationaleAiSummary || entry.rationaleText;
  const hasFullText = entry.rationaleText != null && entry.rationaleText.length > 200;

  return (
    <div className="rounded-lg border border-border/50 bg-background/50 p-3 space-y-2">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <Link
            href={`/drep/${entry.drepId}`}
            className="text-sm font-medium hover:text-primary transition-colors truncate"
          >
            {entry.drepName || `${entry.drepId.slice(0, 16)}\u2026`}
          </Link>
          {entry.hashVerified === true && (
            <ShieldCheck
              className="h-3.5 w-3.5 text-green-500 shrink-0"
              aria-label="On-chain verified"
            />
          )}
          {entry.hashVerified === false && (
            <ShieldAlert
              className="h-3.5 w-3.5 text-amber-500 shrink-0"
              aria-label="Hash mismatch"
            />
          )}
        </div>
        {shareUrl && shareText && (
          <ShareActions
            url={shareUrl}
            text={shareText}
            surface="debate-rationale"
            variant="compact"
            metadata={{ drep_id: entry.drepId, vote: entry.vote }}
            className="shrink-0"
          />
        )}
      </div>
      <p className={cn('text-sm text-foreground/80 leading-relaxed', !expanded && 'line-clamp-3')}>
        {expanded && hasFullText ? entry.rationaleText : displayText}
      </p>
      {hasFullText && (
        <Button
          variant="ghost"
          size="sm"
          onClick={onToggle}
          className="text-xs h-7 px-2 text-muted-foreground hover:text-foreground"
        >
          {expanded ? (
            <>
              Show less <ChevronUp className="h-3 w-3 ml-1" />
            </>
          ) : (
            <>
              Read more <ChevronDown className="h-3 w-3 ml-1" />
            </>
          )}
        </Button>
      )}
    </div>
  );
}

/** Build share text for a rationale */
function buildShareText(entry: RationaleEntry, proposalTitle?: string): string {
  const name = entry.drepName || `DRep ${entry.drepId.slice(0, 12)}`;
  const excerpt = (entry.rationaleAiSummary || entry.rationaleText || '').slice(0, 120);
  const suffix = excerpt.length >= 120 ? '...' : '';
  const titlePart = proposalTitle ? ` on "${proposalTitle}"` : '';
  return `${name}${titlePart}: "${excerpt}${suffix}" via @Governada`;
}

function RationaleColumn({
  label,
  color,
  rationales,
  expanded,
  setExpanded,
  emptyText,
  shareUrl,
  proposalTitle,
  maxVisible,
}: {
  label: string;
  color: string;
  rationales: RationaleEntry[];
  expanded: string | null;
  setExpanded: (id: string | null) => void;
  emptyText: string;
  shareUrl?: string;
  proposalTitle?: string;
  maxVisible: number;
}) {
  const visible = rationales.slice(0, maxVisible);
  const overflow = rationales.length - maxVisible;

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 mb-4">
        <div className={`h-1 w-8 rounded-full ${color}`} />
        <span
          className={`text-sm font-semibold ${color.replace('bg-', 'text-').replace('-500', '-400')}`}
        >
          {label} ({rationales.length})
        </span>
      </div>
      {visible.map((r) => (
        <RationaleCard
          key={r.drepId}
          entry={r}
          expanded={expanded === r.drepId}
          onToggle={() => setExpanded(expanded === r.drepId ? null : r.drepId)}
          shareUrl={shareUrl}
          shareText={shareUrl ? buildShareText(r, proposalTitle) : undefined}
        />
      ))}
      {rationales.length === 0 && (
        <p className="text-sm text-muted-foreground/60 italic">{emptyText}</p>
      )}
      {overflow > 0 && (
        <p className="text-xs text-muted-foreground text-center">
          +{overflow} more rationale{overflow !== 1 ? 's' : ''}
        </p>
      )}
    </div>
  );
}

export function DebateSection({
  rationales,
  proposalTitle,
  txHash,
  proposalIndex,
}: DebateSectionProps) {
  const [expanded, setExpanded] = useState<string | null>(null);
  const { segment } = useSegment();
  const isAnonymous = segment === 'anonymous';

  const withRationale = rationales.filter((r) => r.rationaleAiSummary || r.rationaleText);
  const yesRationales = withRationale.filter((r) => r.vote === 'Yes');
  const noRationales = withRationale.filter((r) => r.vote === 'No');
  const abstainRationales = withRationale.filter((r) => r.vote === 'Abstain');

  const debateUrl =
    txHash != null && proposalIndex != null
      ? `https://governada.io/proposal/${encodeURIComponent(txHash)}/${proposalIndex}#debate`
      : undefined;

  // Anonymous: 2 per column visible, rest behind blur. Connected: 4.
  const maxPerColumn = isAnonymous ? 2 : 4;
  const hasOverflow =
    abstainRationales.length > 0 ||
    yesRationales.length > maxPerColumn ||
    noRationales.length > maxPerColumn;

  return (
    <section id="debate" className="rounded-2xl border border-border/50 bg-card/50 overflow-hidden">
      <div className="px-6 py-4 border-b border-border/50">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <MessageSquare className="h-4 w-4" />
            The Debate
          </h2>
          <div className="flex items-center gap-3">
            <span className="text-xs text-muted-foreground">
              {withRationale.length} rationale{withRationale.length !== 1 ? 's' : ''} published
            </span>
            {debateUrl && (
              <ShareActions
                url={debateUrl}
                text={
                  proposalTitle
                    ? `The debate on "${proposalTitle}" — see what DReps are saying via @Governada`
                    : 'See what DReps are saying about this proposal via @Governada'
                }
                surface="debate-section"
                variant="compact"
              />
            )}
          </div>
        </div>
      </div>

      <div className="p-6">
        {withRationale.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">
            No representatives have published rationales yet.
          </p>
        ) : (
          <>
            {/* Main For/Against columns — limited for anonymous */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <RationaleColumn
                label="For"
                color="bg-emerald-500"
                rationales={yesRationales}
                expanded={expanded}
                setExpanded={setExpanded}
                emptyText="No supporting rationales yet"
                shareUrl={debateUrl}
                proposalTitle={proposalTitle}
                maxVisible={maxPerColumn}
              />
              <RationaleColumn
                label="Against"
                color="bg-red-500"
                rationales={noRationales}
                expanded={expanded}
                setExpanded={setExpanded}
                emptyText="No opposing rationales yet"
                shareUrl={debateUrl}
                proposalTitle={proposalTitle}
                maxVisible={maxPerColumn}
              />
            </div>

            {/* Overflow + abstain rationales gated for anonymous */}
            {hasOverflow && (
              <ProposalDepthGate
                message="Connect to see all rationales and join the debate"
                surface="debate-overflow"
              >
                <div className="space-y-4">
                  {abstainRationales.length > 0 && (
                    <div className="mt-6 pt-4 border-t border-border/50">
                      <div className="flex items-center gap-2 mb-3">
                        <div className="h-1 w-8 rounded-full bg-amber-500" />
                        <span className="text-sm font-semibold text-amber-400">
                          Abstained ({abstainRationales.length})
                        </span>
                      </div>
                      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                        {abstainRationales.slice(0, 2).map((r) => (
                          <RationaleCard
                            key={r.drepId}
                            entry={r}
                            expanded={expanded === r.drepId}
                            onToggle={() => setExpanded(expanded === r.drepId ? null : r.drepId)}
                            shareUrl={debateUrl}
                            shareText={debateUrl ? buildShareText(r, proposalTitle) : undefined}
                          />
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </ProposalDepthGate>
            )}
          </>
        )}
      </div>
    </section>
  );
}
