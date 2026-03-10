/**
 * GET /api/engagement/credibility
 *
 * Returns the authenticated user's citizen credibility tier and weight.
 * Used by the engage page to show users their signal weight tier.
 */

import { NextResponse } from 'next/server';
import { withRouteHandler, type RouteContext } from '@/lib/api/withRouteHandler';
import { computeCredibility } from '@/lib/citizenCredibility';
import { computeEngagementLevel } from '@/lib/citizen/engagementLevel';

export const dynamic = 'force-dynamic';

export const GET = withRouteHandler(
  async (_request, ctx: RouteContext) => {
    const result = await computeCredibility(ctx.userId ?? null, ctx.wallet ?? null);

    // Compute engagement level from available credibility data
    const engagementLevel = computeEngagementLevel({
      hasDelegation: result.factors.delegationActive,
      epochRecapViewCount: 0,
      pollParticipationCount: result.factors.priorEngagementCount,
      shareCount: 0,
      visitStreak: 0,
      accountAgeDays: 0,
    });

    return NextResponse.json(
      {
        ...result,
        engagementLevel: {
          level: engagementLevel.level,
          nextLevel: engagementLevel.nextLevel,
          progressToNext: engagementLevel.progressToNext,
        },
      },
      {
        headers: { 'Cache-Control': 'private, s-maxage=300, stale-while-revalidate=600' },
      },
    );
  },
  { auth: 'optional' },
);
