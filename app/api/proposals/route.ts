import { NextRequest, NextResponse } from 'next/server';
import { withRouteHandler } from '@/lib/api/withRouteHandler';
import { getSupabaseAdmin } from '@/lib/supabase';
import { logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';

export const GET = withRouteHandler(async (request, { requestId }) => {
  const { searchParams } = new URL(request.url);
  const limit = Math.min(parseInt(searchParams.get('limit') || '100', 10), 500);

  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from('proposals')
    .select(
      'tx_hash, proposal_index, title, proposal_type, expired_epoch, ratified_epoch, enacted_epoch, dropped_epoch',
    )
    .order('proposed_epoch', { ascending: false })
    .limit(limit);

  if (error) {
    logger.error('Failed to fetch proposals', {
      context: 'proposals',
      error: error.message,
      requestId,
    });
    return NextResponse.json({ error: 'Failed to fetch proposals' }, { status: 500 });
  }

  const proposals = (data || []).map((p) => {
    let status = 'active';
    if (p.enacted_epoch) status = 'enacted';
    else if (p.ratified_epoch) status = 'ratified';
    else if (p.expired_epoch) status = 'expired';
    else if (p.dropped_epoch) status = 'dropped';
    return {
      txHash: p.tx_hash,
      index: p.proposal_index,
      title: p.title,
      status,
      type: p.proposal_type,
    };
  });

  return NextResponse.json({ proposals });
});
