export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import { getFeatureFlag } from '@/lib/featureFlags';
import { logger } from '@/lib/logger';

const MAX_BATCH = 10;

/**
 * Batch fetch cached narratives for pre-loading the spotlight queue.
 * Does NOT generate on demand — only returns what's cached.
 * This keeps the batch endpoint fast and predictable.
 */
export async function POST(req: NextRequest) {
  try {
    const enabled = await getFeatureFlag('spotlight_narratives');
    if (!enabled) {
      return NextResponse.json({ narratives: {} });
    }

    const { entityType, entityIds } = await req.json();
    if (!entityType || !Array.isArray(entityIds)) {
      return NextResponse.json({ error: 'Missing entityType or entityIds' }, { status: 400 });
    }

    const ids = entityIds.slice(0, MAX_BATCH);
    const table = entityType === 'drep' ? 'dreps' : 'pools';
    const idCol = entityType === 'drep' ? 'drep_id' : 'pool_id';

    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from(table)
      .select(`${idCol}, spotlight_narrative`)
      .in(idCol, ids)
      .not('spotlight_narrative', 'is', null);

    if (error) {
      logger.error('[Spotlight Batch] Query error', { error });
      return NextResponse.json({ narratives: {} });
    }

    const narratives: Record<string, string> = {};
    for (const row of data ?? []) {
      const id = (row as Record<string, unknown>)[idCol] as string;
      const narrative = (row as Record<string, unknown>).spotlight_narrative as string;
      if (id && narrative) {
        narratives[id] = narrative;
      }
    }

    return NextResponse.json({ narratives });
  } catch (err) {
    logger.error('[Spotlight Batch] Error', { error: err });
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
