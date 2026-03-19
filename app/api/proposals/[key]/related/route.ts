/**
 * GET /api/proposals/[key]/related
 *
 * Find related proposals using classification + embedding similarity.
 * Delegates to the existing `findSimilarByClassification` in lib/proposalSimilarity.ts.
 *
 * The [key] param is formatted as "{txHash}-{proposalIndex}".
 */

import { NextResponse } from 'next/server';
import { withRouteHandler } from '@/lib/api/withRouteHandler';
import { findSimilarByClassification } from '@/lib/proposalSimilarity';

export const dynamic = 'force-dynamic';

export const GET = withRouteHandler(async (request) => {
  const url = new URL(request.url);
  // Extract key from path: /api/proposals/[key]/related
  const pathParts = url.pathname.split('/');
  const proposalIdx = pathParts.findIndex((p) => p === 'proposals');
  const key = proposalIdx >= 0 ? pathParts[proposalIdx + 1] : null;

  if (!key) {
    return NextResponse.json({ error: 'Proposal key required' }, { status: 400 });
  }

  // Parse key as txHash-proposalIndex
  const lastDash = key.lastIndexOf('-');
  const txHash = lastDash > 0 ? key.slice(0, lastDash) : key;
  const proposalIndex = lastDash > 0 ? parseInt(key.slice(lastDash + 1), 10) : 0;

  const limitParam = request.nextUrl.searchParams.get('limit');
  const limit = limitParam ? Math.min(parseInt(limitParam, 10), 20) : 5;

  const similar = await findSimilarByClassification(txHash, proposalIndex, limit);

  return NextResponse.json(
    { related: similar },
    {
      headers: { 'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600' },
    },
  );
});
