export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase';
import { logger } from '@/lib/logger';

/**
 * GET /api/observatory/narrative?epoch=N
 *
 * Returns a unified AI-generated narrative briefing synthesizing
 * Treasury, Committee, and Health intelligence. Falls back to
 * template-based narrative if AI generation unavailable.
 *
 * Narratives are pre-generated at epoch boundaries via Inngest
 * and cached in the database. This endpoint serves from cache.
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const epoch = parseInt(searchParams.get('epoch') || '0', 10);

    const supabase = createClient();

    // Try to fetch pre-generated narrative from DB
    const { data: cached } = await supabase
      .from('observatory_narratives')
      .select('unified, treasury, committee, health, generated_at')
      .eq('epoch', epoch)
      .order('generated_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (cached) {
      return NextResponse.json(
        {
          unified: cached.unified,
          treasury: cached.treasury,
          committee: cached.committee,
          health: cached.health,
          generatedAt: cached.generated_at,
        },
        {
          headers: {
            'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600',
          },
        },
      );
    }

    // Fallback: generate a template-based narrative from current data
    const narrative = await generateTemplateNarrative(supabase, epoch);

    return NextResponse.json(narrative, {
      headers: {
        'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=120',
      },
    });
  } catch (error) {
    logger.error('Observatory narrative failed', { error });
    return NextResponse.json(
      { unified: null, generatedAt: new Date().toISOString() },
      { status: 200 }, // Degrade gracefully — narrative is enhancement
    );
  }
}

/**
 * Generate a template-based narrative from current data.
 * Used when AI-generated narrative is not yet cached.
 */
async function generateTemplateNarrative(supabase: ReturnType<typeof createClient>, epoch: number) {
  // Fetch key metrics in parallel
  const [treasuryRes, ccRes, ghiRes] = await Promise.allSettled([
    supabase
      .from('treasury_snapshots')
      .select('balance_ada')
      .order('epoch', { ascending: false })
      .limit(1)
      .single(),
    supabase.from('cc_members').select('cc_hot_id').eq('status', 'authorized'),
    supabase
      .from('ghi_snapshots')
      .select('score')
      .order('epoch', { ascending: false })
      .limit(1)
      .single(),
  ]);

  const balance = treasuryRes.status === 'fulfilled' ? treasuryRes.value.data?.balance_ada : null;
  const ccCount = ccRes.status === 'fulfilled' ? (ccRes.value.data?.length ?? 0) : 0;
  const ghiScore = ghiRes.status === 'fulfilled' ? ghiRes.value.data?.score : null;

  const balanceStr = balance
    ? `${new Intl.NumberFormat('en', { notation: 'compact', maximumFractionDigits: 1 }).format(balance / 1_000_000)} ADA in reserve`
    : 'treasury data loading';
  const ccStr =
    ccCount > 0 ? `${ccCount} constitutional guardians active` : 'committee data loading';
  const ghiStr =
    ghiScore != null ? `governance health at ${Math.round(ghiScore)}` : 'health data loading';

  const unified = `Governance Observatory — Epoch ${epoch || 'current'}. ${balanceStr}, ${ccStr}, ${ghiStr}. Expand any panel to explore the details.`;

  return {
    unified,
    treasury: null,
    committee: null,
    health: null,
    generatedAt: new Date().toISOString(),
  };
}
