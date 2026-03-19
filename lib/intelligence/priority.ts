/**
 * Alignment-Driven Priority API
 *
 * Uses a user's 6D alignment vector + current governance state to score
 * proposal relevance. Returns a sorted priority queue: most relevant
 * proposals for this user.
 *
 * This is the first time Governada's alignment engine drives what users SEE,
 * not just what they search for.
 */

import { createClient } from '@/lib/supabase';
import { logger } from '@/lib/logger';
import { cached } from '@/lib/redis';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface PriorityProposal {
  txHash: string;
  proposalIndex: number;
  title: string | null;
  proposalType: string;
  relevanceScore: number; // 0-100
  relevanceReason: string;
  treasuryTier: string | null;
  expirationEpoch: number | null;
  voteCount: number;
}

export interface PriorityResult {
  proposals: PriorityProposal[];
  userAlignmentAvailable: boolean;
  computedAt: string;
}

// ---------------------------------------------------------------------------
// Alignment dimensions (match proposal_classifications columns)
// ---------------------------------------------------------------------------

const CLASSIFICATION_COLS = [
  'dim_treasury_conservative',
  'dim_treasury_growth',
  'dim_decentralization',
  'dim_security',
  'dim_innovation',
  'dim_transparency',
] as const;

// ---------------------------------------------------------------------------
// Core computation
// ---------------------------------------------------------------------------

/**
 * Compute alignment-driven priority scores for active proposals.
 *
 * @param stakeAddress - User's stake address (used to find their DRep alignment or delegation)
 * @param limit - Max proposals to return (default 20)
 */
export async function computePriority(stakeAddress: string, limit = 20): Promise<PriorityResult> {
  const cacheKey = `priority:${stakeAddress}`;

  try {
    return await cached(cacheKey, 300, () => computePriorityUncached(stakeAddress, limit));
  } catch (err) {
    logger.warn('[intelligence/priority] Redis cache failed, computing directly', { error: err });
    return computePriorityUncached(stakeAddress, limit);
  }
}

async function computePriorityUncached(
  stakeAddress: string,
  limit: number,
): Promise<PriorityResult> {
  const supabase = createClient();

  // Step 1: Get user's alignment vector
  // Try direct DRep match first, then try via delegation
  const userAlignment = await getUserAlignment(supabase, stakeAddress);

  // Step 2: Get active proposals with their classifications
  const [proposalsResult, classificationsResult, voteCountsResult] = await Promise.all([
    supabase
      .from('proposals')
      .select(
        'tx_hash, proposal_index, title, proposal_type, treasury_tier, expiration_epoch, block_time',
      )
      .is('ratified_epoch', null)
      .is('enacted_epoch', null)
      .is('dropped_epoch', null)
      .is('expired_epoch', null)
      .order('block_time', { ascending: false }),
    supabase.from('proposal_classifications').select('*'),
    supabase.from('drep_votes').select('proposal_tx_hash, proposal_index'),
  ]);

  const proposals = proposalsResult.data ?? [];
  if (proposals.length === 0) {
    return {
      proposals: [],
      userAlignmentAvailable: userAlignment !== null,
      computedAt: new Date().toISOString(),
    };
  }

  // Build classification map
  const classMap = new Map<string, number[]>();
  for (const c of classificationsResult.data ?? []) {
    const row = c as Record<string, unknown>;
    const key = `${row.proposal_tx_hash}-${row.proposal_index}`;
    const vec = CLASSIFICATION_COLS.map((col) => Number(row[col]) || 0);
    classMap.set(key, vec);
  }

  // Build vote count map
  const voteCountMap = new Map<string, number>();
  for (const v of voteCountsResult.data ?? []) {
    const key = `${v.proposal_tx_hash}-${v.proposal_index}`;
    voteCountMap.set(key, (voteCountMap.get(key) ?? 0) + 1);
  }

  // Step 3: Score each proposal
  const SHELLEY_GENESIS = 1596491091;
  const EPOCH_LEN = 432000;
  const SHELLEY_BASE = 209;
  const currentEpoch = Math.floor((Date.now() / 1000 - SHELLEY_GENESIS) / EPOCH_LEN) + SHELLEY_BASE;

  const scored: PriorityProposal[] = proposals.map((p) => {
    const key = `${p.tx_hash}-${p.proposal_index}`;
    const classVec = classMap.get(key);
    const voteCount = voteCountMap.get(key) ?? 0;

    let relevanceScore = 0;
    let relevanceReason = 'Active proposal';

    // Factor 1: Alignment match (0-50 points)
    if (userAlignment && classVec) {
      const match = cosineSimilarity(userAlignment, classVec);
      const alignmentScore = Math.round(match * 50);
      relevanceScore += alignmentScore;
      if (alignmentScore > 30) {
        relevanceReason = 'Strong alignment match';
      } else if (alignmentScore > 15) {
        relevanceReason = 'Moderate alignment match';
      }
    } else if (!userAlignment) {
      // No alignment data - use classification signal strength instead
      if (classVec) {
        const maxSignal = Math.max(...classVec);
        relevanceScore += Math.round(maxSignal * 25);
      }
    }

    // Factor 2: Urgency from expiration (0-25 points)
    if (p.expiration_epoch) {
      const epochsRemaining = p.expiration_epoch - currentEpoch;
      if (epochsRemaining <= 1) {
        relevanceScore += 25;
        relevanceReason = 'Expiring very soon';
      } else if (epochsRemaining <= 2) {
        relevanceScore += 15;
      } else if (epochsRemaining <= 3) {
        relevanceScore += 8;
      }
    }

    // Factor 3: Treasury significance (0-15 points)
    if (p.treasury_tier === 'large' || p.treasury_tier === 'whale') {
      relevanceScore += 15;
      if (relevanceReason === 'Active proposal') {
        relevanceReason = 'High treasury impact';
      }
    } else if (p.treasury_tier === 'medium') {
      relevanceScore += 8;
    }

    // Factor 4: Recency bonus (0-10 points)
    if (p.block_time) {
      const ageHours = (Date.now() / 1000 - p.block_time) / 3600;
      if (ageHours < 24) {
        relevanceScore += 10;
        if (relevanceReason === 'Active proposal') {
          relevanceReason = 'Recently proposed';
        }
      } else if (ageHours < 72) {
        relevanceScore += 5;
      }
    }

    return {
      txHash: p.tx_hash,
      proposalIndex: p.proposal_index,
      title: p.title,
      proposalType: p.proposal_type,
      relevanceScore: Math.min(100, relevanceScore),
      relevanceReason,
      treasuryTier: p.treasury_tier,
      expirationEpoch: p.expiration_epoch ?? null,
      voteCount,
    };
  });

  // Sort by relevance and take top N
  scored.sort((a, b) => b.relevanceScore - a.relevanceScore);

  return {
    proposals: scored.slice(0, limit),
    userAlignmentAvailable: userAlignment !== null,
    computedAt: new Date().toISOString(),
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function getUserAlignment(
  supabase: ReturnType<typeof createClient>,
  stakeAddress: string,
): Promise<number[] | null> {
  // Try direct DRep alignment
  const { data: drep } = await supabase
    .from('dreps')
    .select(
      'alignment_treasury_conservative, alignment_treasury_growth, alignment_decentralization, alignment_security, alignment_innovation, alignment_transparency',
    )
    .eq('id', stakeAddress)
    .maybeSingle();

  if (drep) {
    const vec = extractAlignmentVector(drep);
    // Only return if at least one dimension is non-default
    if (vec.some((v) => v !== 50)) return vec;
  }

  // Try via delegation: find which DRep the user is delegated to
  try {
    const { fetchDelegatedDRep } = await import('@/utils/koios');
    const delegatedDrepId = await fetchDelegatedDRep(stakeAddress);
    if (delegatedDrepId) {
      const { data: delegatedDrep } = await supabase
        .from('dreps')
        .select(
          'alignment_treasury_conservative, alignment_treasury_growth, alignment_decentralization, alignment_security, alignment_innovation, alignment_transparency',
        )
        .eq('id', delegatedDrepId)
        .maybeSingle();

      if (delegatedDrep) {
        const vec = extractAlignmentVector(delegatedDrep);
        if (vec.some((v) => v !== 50)) return vec;
      }
    }
  } catch {
    // Koios unavailable - no alignment data
  }

  return null;
}

function extractAlignmentVector(row: {
  alignment_treasury_conservative: number | null;
  alignment_treasury_growth: number | null;
  alignment_decentralization: number | null;
  alignment_security: number | null;
  alignment_innovation: number | null;
  alignment_transparency: number | null;
}): number[] {
  return [
    row.alignment_treasury_conservative ?? 50,
    row.alignment_treasury_growth ?? 50,
    row.alignment_decentralization ?? 50,
    row.alignment_security ?? 50,
    row.alignment_innovation ?? 50,
    row.alignment_transparency ?? 50,
  ];
}

function cosineSimilarity(a: number[], b: number[]): number {
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  const denominator = Math.sqrt(normA) * Math.sqrt(normB);
  return denominator === 0 ? 0 : dotProduct / denominator;
}
