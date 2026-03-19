/**
 * GET /api/intelligence/governance-state?stakeAddress=[addr]
 *
 * Consolidated governance state endpoint. Returns urgency, temperature,
 * epoch context, and per-user state when authenticated.
 *
 * Powers: Governance Pulse dot, temporal mode detection, Co-Pilot readiness
 * signal, Hub card ordering.
 */

import { NextResponse } from 'next/server';
import { withRouteHandler } from '@/lib/api/withRouteHandler';
import { computeGovernanceState } from '@/lib/intelligence/governance-state';

export const dynamic = 'force-dynamic';

export const GET = withRouteHandler(async (request) => {
  const stakeAddress = request.nextUrl.searchParams.get('stakeAddress') ?? undefined;

  const state = await computeGovernanceState(stakeAddress);

  return NextResponse.json(state, {
    headers: {
      'Cache-Control': stakeAddress
        ? 'private, s-maxage=60, stale-while-revalidate=120'
        : 'public, s-maxage=60, stale-while-revalidate=120',
    },
  });
});
