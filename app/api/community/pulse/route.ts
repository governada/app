export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { withRouteHandler } from '@/lib/api/withRouteHandler';
import { getFeatureFlag } from '@/lib/featureFlags';
import { createClient } from '@/lib/supabase';
import { blockTimeToEpoch } from '@/lib/koios';

/**
 * GET /api/community/pulse?epoch=620
 *
 * Serves aggregated matching intelligence — topic heatmap, archetype
 * distribution, community centroid, and governance temperature.
 * Feature-gated behind `community_intelligence`.
 */
export const GET = withRouteHandler(async (request: NextRequest) => {
  const enabled = await getFeatureFlag('community_intelligence', false);
  if (!enabled) {
    return NextResponse.json({ error: 'Feature not enabled' }, { status: 404 });
  }

  const { searchParams } = new URL(request.url);
  const epochParam = searchParams.get('epoch');
  const epoch = epochParam
    ? parseInt(epochParam, 10)
    : blockTimeToEpoch(Math.floor(Date.now() / 1000));

  const supabase = createClient();

  // Fetch match_preferences snapshot
  const { data: prefsSnapshot } = await supabase
    .from('community_intelligence_snapshots')
    .select('data, computed_at')
    .eq('snapshot_type', 'match_preferences')
    .eq('epoch', epoch)
    .single();

  // Fetch temperature snapshot
  const { data: tempSnapshot } = await supabase
    .from('community_intelligence_snapshots')
    .select('data')
    .eq('snapshot_type', 'temperature')
    .eq('epoch', epoch)
    .single();

  if (!prefsSnapshot?.data) {
    return NextResponse.json(
      {
        epoch,
        totalSessions: 0,
        topicHeatmap: [],
        archetypeDistribution: [],
        communityCentroid: [50, 50, 50, 50, 50, 50],
        temperature: { value: 0, band: 'cold' },
        updatedAt: null,
      },
      { headers: { 'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=60' } },
    );
  }

  const prefs = prefsSnapshot.data as {
    totalSessions: number;
    topicFrequency: Record<string, number>;
    topicTrends: Record<string, number>;
    archetypeDistribution: Record<string, number>;
    communityCentroid: number[];
  };

  // Build topic heatmap sorted by count descending
  const topicHeatmap = Object.entries(prefs.topicFrequency ?? {})
    .map(([topic, count]) => ({
      topic,
      count,
      trend: prefs.topicTrends?.[topic] ?? 0,
    }))
    .sort((a, b) => b.count - a.count);

  // Build archetype distribution with percentages
  const totalArchetypes = Object.values(prefs.archetypeDistribution ?? {}).reduce(
    (sum, n) => sum + n,
    0,
  );
  const archetypeDistribution = Object.entries(prefs.archetypeDistribution ?? {})
    .map(([archetype, count]) => ({
      archetype,
      count,
      percentage: totalArchetypes > 0 ? Math.round((count / totalArchetypes) * 100) : 0,
    }))
    .sort((a, b) => b.count - a.count);

  // Temperature
  const tempData = tempSnapshot?.data as {
    temperature?: number;
    band?: string;
  } | null;

  return NextResponse.json(
    {
      epoch,
      totalSessions: prefs.totalSessions ?? 0,
      topicHeatmap,
      archetypeDistribution,
      communityCentroid: prefs.communityCentroid ?? [50, 50, 50, 50, 50, 50],
      temperature: {
        value: tempData?.temperature ?? 0,
        band: tempData?.band ?? 'cold',
      },
      updatedAt: prefsSnapshot.computed_at,
    },
    { headers: { 'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=60' } },
  );
});
