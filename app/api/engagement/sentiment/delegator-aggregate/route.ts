import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import { logger } from '@/lib/logger';
import { withRouteHandler, type RouteContext } from '@/lib/api/withRouteHandler';

export const dynamic = 'force-dynamic';

/**
 * GET /api/engagement/sentiment/delegator-aggregate?drepId=...
 *
 * Returns aggregated sentiment from citizens who are delegated to this DRep.
 * Used in the workspace delegators page to give DReps insight into their
 * delegators' governance preferences.
 */
export const GET = withRouteHandler(
  async (request: NextRequest, _context: RouteContext) => {
    const { searchParams } = new URL(request.url);
    const drepId = searchParams.get('drepId');

    if (!drepId) {
      return NextResponse.json({ error: 'drepId required' }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();

    try {
      // Get all sentiment votes from citizens delegated to this DRep
      const { data: votes, error } = await supabase
        .from('citizen_sentiment')
        .select('sentiment, proposal_tx_hash, proposal_index')
        .eq('delegated_drep_id', drepId);

      if (error) {
        logger.error('Delegator sentiment query error', {
          context: 'engagement/sentiment/delegator-aggregate',
          error: error.message,
        });
        return NextResponse.json({ error: 'Query failed' }, { status: 500 });
      }

      const rows = votes || [];

      // Aggregate totals
      const aggregate = { support: 0, oppose: 0, unsure: 0, total: 0 };
      const proposalMap = new Map<
        string,
        {
          txHash: string;
          proposalIndex: number;
          support: number;
          oppose: number;
          unsure: number;
          total: number;
        }
      >();

      for (const row of rows) {
        // Aggregate
        if (row.sentiment === 'support') aggregate.support++;
        else if (row.sentiment === 'oppose') aggregate.oppose++;
        else if (row.sentiment === 'unsure') aggregate.unsure++;
        aggregate.total++;

        // Per-proposal
        const key = `${row.proposal_tx_hash}:${row.proposal_index}`;
        const entry = proposalMap.get(key) ?? {
          txHash: row.proposal_tx_hash,
          proposalIndex: row.proposal_index,
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

      // Get proposal titles
      const proposalKeys = [...proposalMap.values()];
      const titleMap = new Map<string, string>();

      if (proposalKeys.length > 0) {
        const txHashes = [...new Set(proposalKeys.map((p) => p.txHash))];
        const { data: proposals } = await supabase
          .from('proposals')
          .select('tx_hash, proposal_index, title')
          .in('tx_hash', txHashes);

        if (proposals) {
          for (const p of proposals) {
            titleMap.set(`${p.tx_hash}:${p.proposal_index}`, p.title ?? '');
          }
        }
      }

      // Build response sorted by total votes descending
      const proposals = proposalKeys
        .sort((a, b) => b.total - a.total)
        .map((p) => ({
          txHash: p.txHash,
          proposalIndex: p.proposalIndex,
          title: titleMap.get(`${p.txHash}:${p.proposalIndex}`) || null,
          delegatorSentiment: {
            support: p.support,
            oppose: p.oppose,
            unsure: p.unsure,
            total: p.total,
          },
        }));

      return NextResponse.json({ aggregate, proposals });
    } catch (err) {
      logger.error('Delegator sentiment aggregate error', {
        context: 'engagement/sentiment/delegator-aggregate',
        error: err,
      });
      return NextResponse.json({ error: 'Internal error' }, { status: 500 });
    }
  },
  { auth: 'optional' },
);
