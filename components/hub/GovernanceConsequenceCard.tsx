'use client';

import Link from 'next/link';
import { ArrowRight } from 'lucide-react';

interface GovernanceConsequenceCardProps {
  activeProposals: number;
  totalDelegators: number;
}

/**
 * GovernanceConsequenceCard — Shows anonymous visitors why governance matters to their ADA.
 *
 * Compact amber/gold card with a concrete consequence statement and a link
 * to the governance overview. Entire card is clickable for better UX.
 */
export function GovernanceConsequenceCard({
  activeProposals,
  totalDelegators,
}: GovernanceConsequenceCardProps) {
  const delegatorLabel =
    totalDelegators > 0 ? `${totalDelegators.toLocaleString()} ADA holders` : 'ADA holders';

  const headline =
    activeProposals > 0
      ? `${activeProposals} active proposal${activeProposals !== 1 ? 's' : ''} \u00b7 ${delegatorLabel} represented`
      : `${delegatorLabel} already represented`;

  return (
    <Link
      href="/governance"
      className="block rounded-xl border border-amber-500/20 bg-amber-950/15 backdrop-blur-md px-3 py-2.5 transition-all duration-200 hover:border-amber-400/40 hover:shadow-lg hover:shadow-amber-500/5 hover:-translate-y-0.5"
    >
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-medium text-amber-200/90">{headline}</p>
        <span className="inline-flex items-center gap-1 text-xs font-medium text-amber-400 shrink-0">
          Explore
          <ArrowRight className="h-3 w-3" />
        </span>
      </div>
    </Link>
  );
}
