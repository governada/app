/**
 * Proposal Trend Detection
 * Analyzes proposal types and classification vectors over time
 * to detect emerging patterns and shifts in governance activity.
 */

import { createClient } from '@/lib/supabase';

export interface ProposalTrend {
  dimension: string;
  direction: 'up' | 'down' | 'stable';
  magnitude: number;
  description: string;
  recentEpochAvg: number;
  olderEpochAvg: number;
}

export interface TrendAnalysis {
  trends: ProposalTrend[];
  epochRange: { start: number; end: number };
  totalProposals: number;
}

const DIMENSIONS = [
  'dim_treasury_conservative',
  'dim_treasury_growth',
  'dim_decentralization',
  'dim_security',
  'dim_innovation',
  'dim_transparency',
] as const;

const DIMENSION_LABELS: Record<string, string> = {
  dim_treasury_conservative: 'Treasury Conservative',
  dim_treasury_growth: 'Treasury Growth',
  dim_decentralization: 'Decentralization',
  dim_security: 'Security',
  dim_innovation: 'Innovation',
  dim_transparency: 'Transparency',
};

/**
 * Detect trends in proposal classifications over a range of epochs.
 * Splits the range into halves and compares average classification scores.
 */
export async function detectProposalTrends(epochRange = 10): Promise<TrendAnalysis> {
  const supabase = createClient();

  const { data: proposals } = await supabase
    .from('proposals')
    .select('tx_hash, proposal_index, proposed_epoch, proposal_type')
    .order('proposed_epoch', { ascending: false })
    .limit(500);

  if (!proposals || proposals.length === 0) {
    return { trends: [], epochRange: { start: 0, end: 0 }, totalProposals: 0 };
  }

  const maxEpoch = Math.max(...proposals.map((p) => p.proposed_epoch));
  const minEpoch = maxEpoch - epochRange;
  const midEpoch = maxEpoch - Math.floor(epochRange / 2);

  const filtered = proposals.filter((p) => p.proposed_epoch >= minEpoch);
  if (filtered.length < 4) {
    return {
      trends: [],
      epochRange: { start: minEpoch, end: maxEpoch },
      totalProposals: filtered.length,
    };
  }

  const { data: rawClassifications } = await supabase
    .from('proposal_classifications')
    .select('*')
    .in(
      'proposal_tx_hash',
      filtered.map((p) => p.tx_hash),
    );

  const classifications = (rawClassifications || []) as unknown as Array<Record<string, number | string>>;
  if (classifications.length < 4) {
    return {
      trends: [],
      epochRange: { start: minEpoch, end: maxEpoch },
      totalProposals: filtered.length,
    };
  }

  const proposalEpochMap = new Map(
    filtered.map((p) => [`${p.tx_hash}-${p.proposal_index}`, p.proposed_epoch]),
  );

  const recentVecs: Record<string, number[]> = {};
  const olderVecs: Record<string, number[]> = {};

  for (const dim of DIMENSIONS) {
    recentVecs[dim] = [];
    olderVecs[dim] = [];
  }

  for (const c of classifications) {
    const key = `${c.proposal_tx_hash}-${c.proposal_index}`;
    const epoch = proposalEpochMap.get(key as string);
    if (epoch === undefined) continue;

    const target = epoch >= midEpoch ? recentVecs : olderVecs;
    for (const dim of DIMENSIONS) {
      target[dim].push(Number(c[dim]) || 0);
    }
  }

  const trends: ProposalTrend[] = [];

  for (const dim of DIMENSIONS) {
    const recent = recentVecs[dim];
    const older = olderVecs[dim];
    if (recent.length < 2 || older.length < 2) continue;

    const recentAvg = recent.reduce((s, v) => s + v, 0) / recent.length;
    const olderAvg = older.reduce((s, v) => s + v, 0) / older.length;
    const delta = recentAvg - olderAvg;
    const magnitude = Math.abs(delta);

    if (magnitude < 0.05) continue;

    const direction: ProposalTrend['direction'] =
      delta > 0.05 ? 'up' : delta < -0.05 ? 'down' : 'stable';

    const label = DIMENSION_LABELS[dim] || dim;
    const pctChange = olderAvg > 0 ? Math.round((delta / olderAvg) * 100) : 0;
    const dirWord = direction === 'up' ? 'increasing' : direction === 'down' ? 'decreasing' : 'stable';

    trends.push({
      dimension: dim,
      direction,
      magnitude: Math.round(magnitude * 100) / 100,
      description: `${label} proposals ${dirWord} ${Math.abs(pctChange)}% over last ${epochRange} epochs`,
      recentEpochAvg: Math.round(recentAvg * 100) / 100,
      olderEpochAvg: Math.round(olderAvg * 100) / 100,
    });
  }

  // Also detect proposal type volume trends
  const recentTypes: Record<string, number> = {};
  const olderTypes: Record<string, number> = {};

  for (const p of filtered) {
    const target = p.proposed_epoch >= midEpoch ? recentTypes : olderTypes;
    target[p.proposal_type] = (target[p.proposal_type] || 0) + 1;
  }

  const allTypes = new Set([...Object.keys(recentTypes), ...Object.keys(olderTypes)]);
  for (const type of allTypes) {
    const recentCount = recentTypes[type] || 0;
    const olderCount = olderTypes[type] || 0;
    if (recentCount + olderCount < 3) continue;

    const delta = recentCount - olderCount;
    if (Math.abs(delta) < 2) continue;

    const direction: ProposalTrend['direction'] = delta > 0 ? 'up' : 'down';
    const pctChange = olderCount > 0 ? Math.round((delta / olderCount) * 100) : 100;

    trends.push({
      dimension: `type_${type}`,
      direction,
      magnitude: Math.abs(delta),
      description: `${type} proposals ${direction === 'up' ? 'increasing' : 'decreasing'} ${Math.abs(pctChange)}% over last ${epochRange} epochs`,
      recentEpochAvg: recentCount,
      olderEpochAvg: olderCount,
    });
  }

  trends.sort((a, b) => b.magnitude - a.magnitude);

  return {
    trends: trends.slice(0, 10),
    epochRange: { start: minEpoch, end: maxEpoch },
    totalProposals: filtered.length,
  };
}
