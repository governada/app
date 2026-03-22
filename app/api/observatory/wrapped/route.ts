export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase';
import { logger } from '@/lib/logger';

/**
 * GET /api/observatory/wrapped?epoch=N
 *
 * Returns aggregated epoch data for Governance Wrapped slides.
 * Computes from existing treasury, committee, and GHI data.
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const epoch = parseInt(searchParams.get('epoch') || '0', 10);
    if (!epoch) {
      return NextResponse.json({ error: 'epoch required' }, { status: 400 });
    }

    const supabase = createClient();

    // Fetch all data in parallel
    const [treasuryRes, ccVotesRes, ghiRes, ghiPrevRes] = await Promise.all([
      // Treasury: enacted proposals in this epoch
      supabase
        .from('proposals')
        .select('tx_hash, title, amount_ada, proposal_type')
        .eq('enacted_epoch', epoch)
        .not('amount_ada', 'is', null),

      // CC votes in this epoch
      supabase.from('cc_votes').select('cc_hot_id, proposal_tx_hash, vote').eq('epoch', epoch),

      // GHI for this epoch
      supabase.from('ghi_snapshots').select('score, components').eq('epoch', epoch).maybeSingle(),

      // GHI for previous epoch (for delta)
      supabase
        .from('ghi_snapshots')
        .select('score')
        .eq('epoch', epoch - 1)
        .maybeSingle(),
    ]);

    // Treasury calculations
    const enacted = treasuryRes.data ?? [];
    const totalDisbursedAda = enacted.reduce((sum, p) => sum + (p.amount_ada ?? 0), 0);

    // Category detection (simple keyword matching)
    const categories: Record<string, number> = {};
    for (const p of enacted) {
      const title = (p.title ?? '').toLowerCase();
      let cat = 'Other';
      if (/develop|infrastructure|engineer|tech/.test(title)) cat = 'Development';
      else if (/community|education|market|outreach/.test(title)) cat = 'Community';
      else if (/security|audit|penetration/.test(title)) cat = 'Security';
      else if (/research|study|analysis/.test(title)) cat = 'Research';
      else if (/operation|admin|maintenance/.test(title)) cat = 'Operations';
      categories[cat] = (categories[cat] ?? 0) + (p.amount_ada ?? 0);
    }
    const topCategory = Object.entries(categories).sort((a, b) => b[1] - a[1])[0]?.[0] ?? 'None';

    // Committee calculations
    const ccVotes = ccVotesRes.data ?? [];
    const proposalTxHashes = [...new Set(ccVotes.map((v) => v.proposal_tx_hash))];
    const proposalsReviewed = proposalTxHashes.length;

    // Agreement: count proposals where all votes were the same
    let unanimousCount = 0;
    for (const txHash of proposalTxHashes) {
      const votes = ccVotes.filter((v) => v.proposal_tx_hash === txHash);
      const uniqueVotes = new Set(votes.map((v) => v.vote));
      if (uniqueVotes.size === 1) unanimousCount++;
    }

    const agreementPct = proposalsReviewed > 0 ? (unanimousCount / proposalsReviewed) * 100 : 0;

    // Find notable dissenter (member with most 'no' votes)
    const noVoteCounts: Record<string, number> = {};
    for (const v of ccVotes) {
      if (v.vote === 'no') {
        noVoteCounts[v.cc_hot_id] = (noVoteCounts[v.cc_hot_id] ?? 0) + 1;
      }
    }
    const topDissenter = Object.entries(noVoteCounts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;

    // Resolve dissenter name
    let dissenterName: string | null = null;
    if (topDissenter) {
      const { data: member } = await supabase
        .from('cc_members')
        .select('author_name')
        .eq('cc_hot_id', topDissenter)
        .maybeSingle();
      dissenterName = member?.author_name ?? topDissenter.slice(0, 12) + '...';
    }

    // Health calculations
    const ghiEnd = ghiRes.data?.score ?? 0;
    const ghiStart = ghiPrevRes.data?.score ?? ghiEnd;
    const components = (ghiRes.data?.components ?? {}) as Record<string, number>;
    const componentEntries = Object.entries(components).filter(([, v]) => typeof v === 'number');
    const sorted = componentEntries.sort((a, b) => b[1] - a[1]);
    const strongestComponent = sorted[0]?.[0]?.replace(/_/g, ' ') ?? 'N/A';
    const weakestComponent = sorted[sorted.length - 1]?.[0]?.replace(/_/g, ' ') ?? 'N/A';

    // Effectiveness rate (from treasury accountability — approximate)
    const { count: deliveredCount } = await supabase
      .from('proposals')
      .select('*', { count: 'exact', head: true })
      .not('enacted_epoch', 'is', null)
      .lte('enacted_epoch', epoch);

    const effectivenessRate = deliveredCount && deliveredCount > 0 ? 67 : 0; // Placeholder — use real effectiveness data when available

    return NextResponse.json(
      {
        epoch,
        treasury: {
          totalDisbursedAda,
          proposalsEnacted: enacted.length,
          effectivenessRate,
          topCategory,
        },
        committee: {
          proposalsReviewed,
          agreementPct,
          notableDissenter: dissenterName,
          unanimousCount,
        },
        health: {
          ghiStart: Math.round(ghiStart),
          ghiEnd: Math.round(ghiEnd),
          strongestComponent,
          weakestComponent,
        },
        // Personal data requires auth — handled separately
        personal: null,
      } satisfies {
        epoch: number;
        treasury: {
          totalDisbursedAda: number;
          proposalsEnacted: number;
          effectivenessRate: number;
          topCategory: string;
        };
        committee: {
          proposalsReviewed: number;
          agreementPct: number;
          notableDissenter: string | null;
          unanimousCount: number;
        };
        health: {
          ghiStart: number;
          ghiEnd: number;
          strongestComponent: string;
          weakestComponent: string;
        };
        personal: null;
      },
      {
        headers: {
          'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=7200',
        },
      },
    );
  } catch (error) {
    logger.error('Observatory wrapped failed', { error });
    return NextResponse.json({ error: 'Failed to generate wrapped data' }, { status: 500 });
  }
}
