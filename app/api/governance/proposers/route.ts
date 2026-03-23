export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { withRouteHandler } from '@/lib/api/withRouteHandler';
import { getProposalProposers } from '@/lib/scoring/proposer/data';

export const GET = withRouteHandler(
  async (request) => {
    const txHash = request.nextUrl.searchParams.get('txHash');
    const indexStr = request.nextUrl.searchParams.get('index');

    if (!txHash || !indexStr) {
      return NextResponse.json(
        { error: 'txHash and index query parameters required' },
        { status: 400 },
      );
    }

    const proposalIndex = parseInt(indexStr, 10);
    if (isNaN(proposalIndex)) {
      return NextResponse.json({ error: 'Invalid index' }, { status: 400 });
    }

    const proposers = await getProposalProposers(txHash, proposalIndex);

    return NextResponse.json(proposers, {
      headers: { 'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=600' },
    });
  },
  { rateLimit: { max: 120, window: 60 } },
);
