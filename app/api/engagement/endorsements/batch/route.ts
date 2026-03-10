import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase';
import { withRouteHandler } from '@/lib/api/withRouteHandler';

export const dynamic = 'force-dynamic';

/**
 * GET /api/engagement/endorsements/batch?entityType=drep&entityIds=id1,id2,...
 *
 * Returns a map of entityId -> total endorsement count.
 * Uses precomputed engagement_signal_aggregations for performance.
 * Falls back to direct count from citizen_endorsements if aggregations are empty.
 */
export const GET = withRouteHandler(
  async (request: NextRequest) => {
    const { searchParams } = request.nextUrl;
    const entityType = searchParams.get('entityType');
    const entityIdsParam = searchParams.get('entityIds');

    if (!entityType || !entityIdsParam) {
      return NextResponse.json({ error: 'entityType and entityIds required' }, { status: 400 });
    }

    const entityIds = entityIdsParam.split(',').filter(Boolean).slice(0, 100); // Cap at 100
    if (entityIds.length === 0) {
      return NextResponse.json({ counts: {} });
    }

    const supabase = createClient();

    // Try precomputed aggregations first (most efficient)
    const { data: aggRows } = await supabase
      .from('engagement_signal_aggregations')
      .select('entity_id, data')
      .eq('entity_type', entityType)
      .eq('signal_type', 'endorsements')
      .in('entity_id', entityIds);

    const counts: Record<string, number> = {};

    if (aggRows && aggRows.length > 0) {
      for (const row of aggRows) {
        const data = row.data as { total?: number } | null;
        if (data && typeof data.total === 'number' && data.total > 0) {
          counts[row.entity_id] = data.total;
        }
      }
    }

    // For any IDs not found in aggregations, fall back to direct count
    const missingIds = entityIds.filter((id) => !(id in counts));
    if (missingIds.length > 0) {
      const { data: directRows } = await supabase
        .from('citizen_endorsements')
        .select('entity_id')
        .eq('entity_type', entityType)
        .in('entity_id', missingIds);

      if (directRows) {
        const directCounts: Record<string, number> = {};
        for (const row of directRows) {
          directCounts[row.entity_id] = (directCounts[row.entity_id] || 0) + 1;
        }
        for (const [id, count] of Object.entries(directCounts)) {
          if (count > 0) counts[id] = count;
        }
      }
    }

    return NextResponse.json(
      { counts },
      {
        headers: {
          'Cache-Control': 'public, s-maxage=120, stale-while-revalidate=300',
        },
      },
    );
  },
  { auth: 'none' },
);
