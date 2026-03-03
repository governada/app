import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase';
import { findSimilarByClassification } from '@/lib/proposalSimilarity';
import { getFeatureFlag } from '@/lib/featureFlags';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const useClassification = await getFeatureFlag('proposal_similarity', false);

    const tx = request.nextUrl.searchParams.get('tx');
    const indexParam = request.nextUrl.searchParams.get('index');

    if (!tx) {
      return NextResponse.json({ error: 'tx parameter required' }, { status: 400 });
    }

    const index = indexParam ? parseInt(indexParam) : 0;

    if (useClassification) {
      const similar = await findSimilarByClassification(tx, index, 5);
      return NextResponse.json(similar, {
        headers: { 'Cache-Control': 'public, s-maxage=120, stale-while-revalidate=600' },
      });
    }

    // Fallback: read from similarity cache if available
    const supabase = createClient();
    const { data: cached } = await supabase
      .from('proposal_similarity_cache')
      .select('similar_tx_hash, similar_index, similarity_score')
      .eq('proposal_tx_hash', tx)
      .eq('proposal_index', index)
      .order('similarity_score', { ascending: false })
      .limit(5);

    if (cached && cached.length > 0) {
      const { data: proposals } = await supabase
        .from('proposals')
        .select('tx_hash, proposal_index, title, proposal_type')
        .in(
          'tx_hash',
          cached.map((c) => c.similar_tx_hash),
        );

      const proposalMap = new Map(
        (proposals || []).map((p) => [`${p.tx_hash}-${p.proposal_index}`, p]),
      );

      const results = cached.map((c) => {
        const p = proposalMap.get(`${c.similar_tx_hash}-${c.similar_index}`);
        return {
          txHash: c.similar_tx_hash,
          index: c.similar_index,
          title: p?.title || 'Untitled',
          proposalType: p?.proposal_type || 'Unknown',
          similarityScore: c.similarity_score,
        };
      });

      return NextResponse.json(results, {
        headers: { 'Cache-Control': 'public, s-maxage=120, stale-while-revalidate=600' },
      });
    }

    return NextResponse.json([], {
      headers: { 'Cache-Control': 'public, s-maxage=60' },
    });
  } catch (error) {
    console.error('[proposals/similar] Error:', error);
    return NextResponse.json({ error: 'Failed to find similar proposals' }, { status: 500 });
  }
}
