import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import { logger } from '@/lib/logger';
import { withRouteHandler, type RouteContext } from '@/lib/api/withRouteHandler';

export const dynamic = 'force-dynamic';

/**
 * GET /api/engagement/sentiment/consensus
 *
 * Returns aggregated community sentiment across all active proposals.
 * Used by the Community Consensus visualization on the Hub (feature-flagged).
 */
export const GET = withRouteHandler(
  async (_request: NextRequest, _context: RouteContext) => {
    const supabase = getSupabaseAdmin();

    try {
      // Get all sentiment votes for active proposals
      // Active proposals: those without ratified/dropped/expired epochs
      const { data: activeProposals, error: proposalError } = await supabase
        .from('proposals')
        .select('tx_hash, proposal_index, title')
        .is('ratified_epoch', null)
        .is('dropped_epoch', null)
        .is('expired_epoch', null);

      if (proposalError) {
        logger.error('Consensus: proposal query error', { error: proposalError.message });
        return NextResponse.json({ error: 'Query failed' }, { status: 500 });
      }

      if (!activeProposals || activeProposals.length === 0) {
        return NextResponse.json({
          aggregate: { support: 0, oppose: 0, unsure: 0, total: 0, proposalCount: 0 },
          proposals: [],
        });
      }

      const txHashes = activeProposals.map((p) => p.tx_hash);

      const { data: votes, error: voteError } = await supabase
        .from('citizen_sentiment')
        .select('sentiment, proposal_tx_hash, proposal_index')
        .in('proposal_tx_hash', txHashes);

      if (voteError) {
        logger.error('Consensus: sentiment query error', { error: voteError.message });
        return NextResponse.json({ error: 'Query failed' }, { status: 500 });
      }

      const rows = votes || [];

      // Build title map
      const titleMap = new Map<string, string>();
      for (const p of activeProposals) {
        titleMap.set(`${p.tx_hash}:${p.proposal_index}`, p.title ?? '');
      }

      // Aggregate
      const aggregate = { support: 0, oppose: 0, unsure: 0, total: 0, proposalCount: 0 };
      const proposalMap = new Map<
        string,
        {
          txHash: string;
          index: number;
          title: string;
          support: number;
          oppose: number;
          unsure: number;
          total: number;
        }
      >();

      for (const row of rows) {
        if (row.sentiment === 'support') aggregate.support++;
        else if (row.sentiment === 'oppose') aggregate.oppose++;
        else if (row.sentiment === 'unsure') aggregate.unsure++;
        aggregate.total++;

        const key = `${row.proposal_tx_hash}:${row.proposal_index}`;
        const entry = proposalMap.get(key) ?? {
          txHash: row.proposal_tx_hash,
          index: row.proposal_index,
          title: titleMap.get(key) || `Proposal ${row.proposal_tx_hash.slice(0, 8)}...`,
          support: 0,
          oppose: 0,
          unsure: 0,
          total: 0,
        };
        if (row.sentiment === 'support') entry.support++;
        else if (row.sentiment === 'oppose') entry.oppose++;
        else if (row.sentiment === 'unsure') entry.unsure++;
        entry.total++;
        proposalMap.set(key, entry);
      }

      aggregate.proposalCount = proposalMap.size;

      // Sort by total engagement descending
      const proposals = [...proposalMap.values()].sort((a, b) => b.total - a.total);

      return NextResponse.json({ aggregate, proposals });
    } catch (err) {
      logger.error('Consensus aggregate error', { error: err });
      return NextResponse.json({ error: 'Internal error' }, { status: 500 });
    }
  },
  { auth: 'none' },
);
