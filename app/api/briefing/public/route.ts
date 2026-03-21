/**
 * GET /api/briefing/public
 *
 * Lightweight public endpoint returning anonymized briefing highlights.
 * No auth required — designed for anonymous visitors on the landing page.
 *
 * Returns the current epoch, one headline from the latest recap, and
 * basic governance stats (active proposals, total DReps, treasury balance).
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
  headline: PublicHeadline | null;
  epochStats: {
    activeProposals: number;
    totalDReps: number;
    treasuryBalance?: number;
  };
}

// ---------------------------------------------------------------------------
// Headline builder (reuses logic from citizen briefing)
// ---------------------------------------------------------------------------

function buildPublicHeadline(
  recap: {
    proposals_submitted: number | null;
    proposals_ratified: number | null;
    proposals_expired: number | null;
    proposals_dropped: number | null;
    drep_participation_pct: number | null;
    treasury_withdrawn_ada: number | null;
    ai_narrative: string | null;
  } | null,
): PublicHeadline | null {
  if (!recap) return null;

  // Priority 1: Ratified proposals — most impactful
  if (recap.proposals_ratified && recap.proposals_ratified > 0) {
    return {
      title: `Governance approved ${recap.proposals_ratified} proposal${recap.proposals_ratified > 1 ? 's' : ''}`,
      description: recap.proposals_submitted
        ? `${recap.proposals_submitted} were submitted this epoch — ${recap.proposals_ratified} made it through`
        : 'Ratified on-chain and moving to enactment',
      type: 'proposal',
    };
  }

  // Priority 2: Treasury withdrawals
  if (recap.treasury_withdrawn_ada && recap.treasury_withdrawn_ada > 0) {
    const ada = recap.treasury_withdrawn_ada;
    const formatted =
      ada >= 1_000_000
        ? `${(ada / 1_000_000).toFixed(1)}M`
        : ada >= 1_000
          ? `${Math.round(ada / 1_000)}K`
          : new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(ada);

    return {
      title: `Treasury paid out ${formatted} ADA`,
      description: 'Approved withdrawal proposals were executed from the community treasury',
      type: 'treasury',
    };
  }

  // Priority 3: Participation stats — public page always spins positive
  if (recap.drep_participation_pct != null) {
    const pct = Math.round(recap.drep_participation_pct);
    if (pct >= 70) {
      return {
        title: `Strong turnout: ${pct}% of DReps voted`,
        description: 'Your representatives are actively engaged in governance decisions',
        type: 'governance',
      };
    }
    // Low/moderate turnout — reframe positively for anonymous visitors.
    // Hard truths are available behind auth in the full citizen briefing.
    if (pct > 0) {
      return {
        title: `Representatives are shaping Cardano's future`,
        description: `${pct}% of representatives voted this epoch — governance is in motion`,
        type: 'governance',
      };
    }
  }

  // Priority 4: Proposals submitted (positive framing — community is active)
  if (recap.proposals_submitted && recap.proposals_submitted > 0) {
    return {
      title: `${recap.proposals_submitted} new proposal${recap.proposals_submitted > 1 ? 's' : ''} submitted`,
      description: 'The community is actively proposing changes to Cardano governance',
      type: 'proposal',
    };
  }

  // Quiet epoch fallback — positive framing
  return {
    title: 'Governance is running smoothly',
    description: 'A stable epoch — the network is governed and secure',
    type: 'governance',
  };
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
  const headline = buildPublicHeadline(recapResult.data);
  const treasuryBalanceAda = treasuryResult.data?.balance_lovelace
    ? Math.round(treasuryResult.data.balance_lovelace / 1_000_000)
    : undefined;

  const response: PublicBriefingResponse = {
    epoch: currentEpoch,
    headline,
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
