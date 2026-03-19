/**
 * GET /api/intelligence/context?path=[pathname]&stakeAddress=[addr]
 *
 * Contextual AI synthesis endpoint (Co-Pilot brain). Given a page path
 * and optional user context, returns an AI-synthesized contextual briefing.
 *
 * Route-specific synthesis:
 * - Proposal page: constitutional concerns + community sentiment
 * - DRep page: alignment match + score trajectory
 * - Hub: personalized governance briefing + priority actions
 */

import { NextResponse } from 'next/server';
import { withRouteHandler } from '@/lib/api/withRouteHandler';
import { synthesizeContext } from '@/lib/intelligence/context';

export const dynamic = 'force-dynamic';

export const GET = withRouteHandler(async (request) => {
  const pathname = request.nextUrl.searchParams.get('path');
  if (!pathname) {
    return NextResponse.json({ error: 'path parameter required' }, { status: 400 });
  }

  const stakeAddress = request.nextUrl.searchParams.get('stakeAddress') ?? undefined;
  const entityId = request.nextUrl.searchParams.get('entityId') ?? undefined;

  const result = await synthesizeContext({ pathname, stakeAddress, entityId });

  return NextResponse.json(result, {
    headers: {
      'Cache-Control': stakeAddress
        ? 'private, s-maxage=300, stale-while-revalidate=600'
        : 'public, s-maxage=300, stale-while-revalidate=600',
    },
  });
});
