/**
 * GET /api/briefing/public
 *
 * Public endpoint returning anonymized briefing highlights.
 * No auth required — designed for anonymous visitors.
 *
 * Returns the current epoch, positively-framed headlines, an AI narrative,
 * and basic governance stats. The landing page uses `headline` (first item);
 * the /governance/briefing teaser page uses the full `headlines` array.
 */

import { NextResponse } from 'next/server';
import { withRouteHandler } from '@/lib/api/withRouteHandler';
import { createClient } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type HeadlineType = 'proposal' | 'treasury' | 'governance';

interface PublicHeadline {
  title: string;
  description: string;
  type?: HeadlineType;
}

interface PublicBriefingResponse {
  epoch: number;
  /** First headline — used by the landing page card */
  headline: PublicHeadline | null;
  /** All headlines — used by the full briefing teaser page */
  headlines: PublicHeadline[];
  /** AI-generated narrative summary (truncated for public consumption) */
  narrative: string | null;
  epochStats: {
    activeProposals: number;
    totalDReps: number;
    treasuryBalance?: number;
  };
}

// ---------------------------------------------------------------------------
// Headline builder — positive framing for anonymous visitors
// ---------------------------------------------------------------------------

type RecapData = {
  proposals_submitted: number | null;
  proposals_ratified: number | null;
  proposals_expired: number | null;
  proposals_dropped: number | null;
  drep_participation_pct: number | null;
  treasury_withdrawn_ada: number | null;
  ai_narrative: string | null;
};

function buildPublicHeadlines(recap: RecapData | null): PublicHeadline[] {
  if (!recap) return [];

  const headlines: PublicHeadline[] = [];

  // Ratified proposals — most impactful
  if (recap.proposals_ratified && recap.proposals_ratified > 0) {
    headlines.push({
      title: `Governance approved ${recap.proposals_ratified} proposal${recap.proposals_ratified > 1 ? 's' : ''}`,
      description: recap.proposals_submitted
        ? `${recap.proposals_submitted} were submitted this epoch — ${recap.proposals_ratified} made it through`
        : 'Ratified on-chain and moving to enactment',
      type: 'proposal',
    });
  }

  // Treasury withdrawals
  if (recap.treasury_withdrawn_ada && recap.treasury_withdrawn_ada > 0) {
    const ada = recap.treasury_withdrawn_ada;
    const formatted =
      ada >= 1_000_000
        ? `${(ada / 1_000_000).toFixed(1)}M`
        : ada >= 1_000
          ? `${Math.round(ada / 1_000)}K`
          : new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(ada);

    headlines.push({
      title: `Treasury paid out ${formatted} ADA`,
      description: 'Approved withdrawal proposals were executed from the community treasury',
      type: 'treasury',
    });
  }

  // Participation stats — always positive for public
  if (recap.drep_participation_pct != null) {
    const pct = Math.round(recap.drep_participation_pct);
    if (pct >= 70) {
      headlines.push({
        title: `Strong turnout: ${pct}% of DReps voted`,
        description: 'Your representatives are actively engaged in governance decisions',
        type: 'governance',
      });
    } else if (pct > 0) {
      headlines.push({
        title: `Representatives are shaping Cardano's future`,
        description: `${pct}% of representatives voted this epoch — governance is in motion`,
        type: 'governance',
      });
    }
  }

  // Proposals submitted
  if (recap.proposals_submitted && recap.proposals_submitted > 0 && headlines.length < 4) {
    headlines.push({
      title: `${recap.proposals_submitted} new proposal${recap.proposals_submitted > 1 ? 's' : ''} submitted`,
      description: 'The community is actively proposing changes to Cardano governance',
      type: 'proposal',
    });
  }

  // Quiet epoch fallback
  if (headlines.length === 0) {
    headlines.push({
      title: 'Governance is running smoothly',
      description: 'A stable epoch — the network is governed and secure',
      type: 'governance',
    });
  }

  return headlines;
}

// ---------------------------------------------------------------------------
// Handler
// ---------------------------------------------------------------------------

export const GET = withRouteHandler(async () => {
  const supabase = createClient();

  // Fetch epoch, recap, active proposals, DRep count, and treasury in parallel
  const [statsResult, recapResult, proposalCountResult, drepCountResult, treasuryResult] =
    await Promise.all([
      supabase
        .from('governance_stats')
        .select('current_epoch')
        .eq('id', 1)
        .single(),
      supabase
        .from('epoch_recaps')
        .select(
          'proposals_submitted, proposals_ratified, proposals_expired, proposals_dropped, drep_participation_pct, treasury_withdrawn_ada, ai_narrative',
        )
        .order('epoch', { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabase
        .from('proposals')
        .select('tx_hash', { count: 'exact', head: true })
        .is('ratified_epoch', null)
        .is('expired_epoch', null)
        .is('dropped_epoch', null),
      supabase
        .from('dreps')
        .select('id', { count: 'exact', head: true })
        .eq('is_active', true),
      supabase
        .from('treasury_snapshots')
        .select('balance_lovelace')
        .order('epoch_no', { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]);

  const currentEpoch = statsResult.data?.current_epoch ?? 0;
  const headlines = buildPublicHeadlines(recapResult.data);
  const treasuryBalanceAda = treasuryResult.data?.balance_lovelace
    ? Math.round(treasuryResult.data.balance_lovelace / 1_000_000)
    : undefined;

  // Truncate AI narrative for public consumption (first ~300 chars)
  const rawNarrative = recapResult.data?.ai_narrative ?? null;
  const narrative = rawNarrative
    ? rawNarrative.length > 300
      ? rawNarrative.slice(0, 300).replace(/\s+\S*$/, '') + '...'
      : rawNarrative
    : null;

  const response: PublicBriefingResponse = {
    epoch: currentEpoch,
    headline: headlines[0] ?? null,
    headlines,
    narrative,
    epochStats: {
      activeProposals: proposalCountResult.count ?? 0,
      totalDReps: drepCountResult.count ?? 0,
      treasuryBalance: treasuryBalanceAda,
    },
  };

  return NextResponse.json(response, {
    headers: { 'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600' },
  });
});
