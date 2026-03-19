/**
 * GET /api/intelligence/priority?stakeAddress=[addr]
 *
 * Alignment-driven priority scoring. Uses user's alignment vector +
 * current governance state to score proposal relevance. Returns sorted
 * priority queue: most relevant proposals for this user.
 */

import { NextResponse } from 'next/server';
import { withRouteHandler } from '@/lib/api/withRouteHandler';
import { computePriority } from '@/lib/intelligence/priority';

export const dynamic = 'force-dynamic';

export const GET = withRouteHandler(async (request) => {
  const stakeAddress = request.nextUrl.searchParams.get('stakeAddress');
  if (!stakeAddress) {
    return NextResponse.json({ error: 'stakeAddress parameter required' }, { status: 400 });
  }

  const limitParam = request.nextUrl.searchParams.get('limit');
  const limit = limitParam ? Math.min(parseInt(limitParam, 10), 50) : 20;

  const result = await computePriority(stakeAddress, limit);

  return NextResponse.json(result, {
    headers: {
      'Cache-Control': 'private, s-maxage=300, stale-while-revalidate=600',
    },
  });
});
