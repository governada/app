/**
 * Conversational DRep Matching — state machine.
 *
 * Manages a multi-round conversation session where users answer governance
 * questions via pill selection. Accumulates alignment signals, evaluates
 * quality gates, and executes hybrid matching (6D alignment + optional
 * semantic similarity).
 *
 * Gated behind feature flags: `conversational_matching` and
 * `conversational_matching_semantic`.
 */

import type { AlignmentScores, AlignmentDimension } from '@/lib/drepIdentity';
import { extractAlignments, getDominantDimension, getIdentityColor } from '@/lib/drepIdentity';
import { computeDimensionAgreement } from '@/lib/matching/dimensionAgreement';
import { getSupabaseAdmin } from '@/lib/supabase';
import type { PillOption } from './conversationalPillGenerator';
import { getQuestionForRound, TOTAL_QUESTIONS } from './conversationalPillGenerator';

/* ─── Types ────────────────────────────────────────────── */

export interface ConversationRound {
  question: string;
  pills: PillOption[];
  selectedIds: string[];
  rawText?: string;
}

export interface ConversationSession {
  id: string;
  rounds: ConversationRound[];
  accumulatedText: string;
  extractedAlignment: Partial<AlignmentScores>;
  qualityGates: QualityGates;
  status: 'in_progress' | 'ready_to_match' | 'matched';
  topicHints?: string[];
  pass?: number; // 0 = first pass, 1+ = continue refining (uses follow-up questions)
}

export interface QualityGates {
  discriminativePower: number;
  dimensionalCoverage: number;
  specificity: number;
  passed: boolean;
}

export interface MatchResult {
  drepId: string;
  drepName: string | null;
  score: number;
  semanticScore?: number;
  alignmentScore: number;
  matchingRationales?: { proposalTitle: string; excerpt: string; similarity: number }[];
  alignments: AlignmentScores;
  identityColor: string;
  agreeDimensions: string[];
  differDimensions: string[];
  tier: string | null;
  isBridgeMatch?: boolean;
}

export interface SpoMatchResult {
  poolId: string;
  poolName: string | null;
  ticker: string | null;
  score: number;
  alignments: AlignmentScores;
  identityColor: string;
  agreeDimensions: string[];
  differDimensions: string[];
  governanceScore: number;
  voteCount: number;
}

export interface MatchResults {
  matches: MatchResult[];
  bridgeMatch: MatchResult | null;
  spoMatches: SpoMatchResult[];
}

/* ─── Constants ────────────────────────────────────────── */

const MAX_ROUNDS = 4;
const MAX_RAW_TEXT_LENGTH = 500;

/** Quality gate thresholds */
const QUALITY_THRESHOLDS = {
  dimensionalCoverage: 4, // >= 4 of 6 dims deviate from neutral 50
  specificity: 15, // average deviation from 50 >= 15
};

const ALL_DIMENSIONS: AlignmentDimension[] = [
  'treasuryConservative',
  'treasuryGrowth',
  'decentralization',
  'security',
  'innovation',
  'transparency',
];

/* ─── Session management ────────────────────────────────── */

/**
 * Create a new conversational matching session.
 */
export function createSession(
  id: string,
  topicHints?: string[],
  pass: number = 0,
): ConversationSession {
  return {
    id,
    rounds: [],
    accumulatedText: '',
    extractedAlignment: {},
    qualityGates: {
      discriminativePower: 0,
      dimensionalCoverage: 0,
      specificity: 0,
      passed: false,
    },
    status: 'in_progress',
    topicHints,
    pass,
  };
}

/**
 * Process a round answer: resolve selected pills, accumulate text,
 * extract alignment, and check quality gates.
 */
export function processAnswer(
  session: ConversationSession,
  selectedIds: string[],
  rawText?: string,
): ConversationSession {
  if (session.status !== 'in_progress') return session;
  if (session.rounds.length >= MAX_ROUNDS) return session;

  const roundIndex = session.rounds.length;
  const questionSet = getQuestionForRound(
    roundIndex,
    undefined,
    session.topicHints,
    session.pass ?? 0,
  );
  if (!questionSet) return session;

  // Sanitize raw text
  const sanitizedRawText = rawText ? rawText.slice(0, MAX_RAW_TEXT_LENGTH) : undefined;

  // Resolve selected pills
  const allPills = questionSet.pills;
  const selectedPills = allPills.filter((p) => selectedIds.includes(p.id));

  // All-selected = skipped round (no alignment info)
  const isSkipped = selectedPills.length === allPills.length;

  // Build round record
  const round: ConversationRound = {
    question: questionSet.question,
    pills: allPills,
    selectedIds: isSkipped ? [] : selectedIds,
    rawText: sanitizedRawText,
  };

  // Accumulate text from selected pills (for potential semantic matching)
  let newAccumulatedText = session.accumulatedText;
  if (!isSkipped && selectedPills.length > 0) {
    const pillTexts = selectedPills.map((p) => p.text).join('. ');
    newAccumulatedText += (newAccumulatedText ? ' ' : '') + pillTexts;
  }
  if (sanitizedRawText) {
    newAccumulatedText += (newAccumulatedText ? ' ' : '') + sanitizedRawText;
  }

  // Update alignment from selected pills (skip if all selected)
  const newAlignment = { ...session.extractedAlignment };
  if (!isSkipped && selectedPills.length > 0) {
    mergeAlignmentHints(newAlignment, selectedPills);
  }

  // Build updated session
  const updatedRounds = [...session.rounds, round];
  const updatedSession: ConversationSession = {
    ...session,
    rounds: updatedRounds,
    accumulatedText: newAccumulatedText,
    extractedAlignment: newAlignment,
    qualityGates: evaluateQualityGates({
      ...session,
      rounds: updatedRounds,
      extractedAlignment: newAlignment,
    }),
  };

  // Check if we should transition to ready_to_match
  if (updatedSession.qualityGates.passed || updatedRounds.length >= MAX_ROUNDS) {
    updatedSession.status = 'ready_to_match';
  }

  return updatedSession;
}

/**
 * Merge alignment hints from selected pills into the accumulated alignment.
 * Multi-select: average alignment hints for selected pills.
 */
function mergeAlignmentHints(
  alignment: Partial<AlignmentScores>,
  selectedPills: PillOption[],
): void {
  if (selectedPills.length === 0) return;

  // Collect all dimension updates from selected pills
  const dimUpdates: Partial<Record<AlignmentDimension, number[]>> = {};

  for (const pill of selectedPills) {
    for (const [dim, val] of Object.entries(pill.alignmentHint)) {
      if (val === undefined || val === null) continue;
      const key = dim as AlignmentDimension;
      if (!dimUpdates[key]) dimUpdates[key] = [];
      dimUpdates[key]!.push(val as number);
    }
  }

  // Average values per dimension, then merge with existing
  for (const [dim, values] of Object.entries(dimUpdates) as [AlignmentDimension, number[]][]) {
    const avg = values.reduce((a, b) => a + b, 0) / values.length;
    const existing = alignment[dim];

    if (existing !== undefined && existing !== null) {
      // Weighted blend: newer answers have increasing influence
      // This gives later rounds slightly more weight (blend rather than overwrite)
      alignment[dim] = Math.round((existing + avg) / 2);
    } else {
      alignment[dim] = Math.round(avg);
    }
  }
}

/* ─── Quality gates ─────────────────────────────────────── */

/**
 * Evaluate quality gates for the current session state.
 */
export function evaluateQualityGates(
  session: Pick<ConversationSession, 'extractedAlignment' | 'rounds'>,
  sampleEmbeddings?: number[][],
): QualityGates {
  const alignment = session.extractedAlignment;

  // Dimensional coverage: how many of 6 dims deviate from neutral 50
  let deviatingDims = 0;
  let totalDeviation = 0;
  let dimsWithValues = 0;

  for (const dim of ALL_DIMENSIONS) {
    const val = alignment[dim];
    if (val !== undefined && val !== null) {
      dimsWithValues++;
      const deviation = Math.abs(val - 50);
      totalDeviation += deviation;
      if (deviation > 0) deviatingDims++;
    }
  }

  // Specificity: average deviation from 50 across dimensions that have values
  const specificity = dimsWithValues > 0 ? totalDeviation / dimsWithValues : 0;

  // Discriminative power: variance of similarities against DRep rationale sample
  // (only computable when sample embeddings are provided — computed server-side)
  let discriminativePower = 0;
  if (sampleEmbeddings && sampleEmbeddings.length >= 2) {
    // Placeholder — actual computation happens in executeMatch using embedding quality module
    discriminativePower = 0.5;
  }

  const passed =
    deviatingDims >= QUALITY_THRESHOLDS.dimensionalCoverage &&
    specificity >= QUALITY_THRESHOLDS.specificity;

  return {
    discriminativePower,
    dimensionalCoverage: deviatingDims,
    specificity: Math.round(specificity * 10) / 10,
    passed,
  };
}

/* ─── Matching ──────────────────────────────────────────── */

/**
 * Build a full AlignmentScores from the accumulated partial alignment.
 * Missing dimensions default to 50 (neutral).
 */
export function buildFullAlignment(partial: Partial<AlignmentScores>): AlignmentScores {
  return {
    treasuryConservative: partial.treasuryConservative ?? 50,
    treasuryGrowth: partial.treasuryGrowth ?? 50,
    decentralization: partial.decentralization ?? 50,
    security: partial.security ?? 50,
    innovation: partial.innovation ?? 50,
    transparency: partial.transparency ?? 50,
  };
}

/**
 * Execute matching: hybrid 6D alignment + optional semantic similarity.
 * Accepts optional dimension weights (e.g., { treasuryConservative: 3.0, innovation: 0.3 }).
 */
export async function executeMatch(
  session: ConversationSession,
  options: {
    useSemantic: boolean;
    limit?: number;
    weights?: Record<string, number>;
  },
): Promise<MatchResults> {
  const limit = options.limit ?? 5;
  const weights = options.weights;
  const userAlignment = buildFullAlignment(session.extractedAlignment);

  const supabase = getSupabaseAdmin();

  // Fetch DReps with alignment scores
  const { data: dreps } = await supabase
    .from('dreps')
    .select(
      'id, info, score, current_tier, alignment_treasury_conservative, alignment_treasury_growth, alignment_decentralization, alignment_security, alignment_innovation, alignment_transparency',
    )
    .not('alignment_treasury_conservative', 'is', null);

  if (!dreps?.length) return { matches: [], bridgeMatch: null, spoMatches: [] };

  // Compute 6D alignment scores for each DRep
  const alignmentResults = dreps.map((d) => {
    const drepAlignments = extractAlignments(d);
    const distance = weightedEuclideanDistance6D(userAlignment, drepAlignments, weights);
    const alignmentScore = distanceToScore(distance, weights);
    const dimAgreement = computeDimensionAgreement(userAlignment, drepAlignments);
    const info = d.info as Record<string, unknown> | null;

    return {
      drepId: d.id as string,
      drepName: (info?.name as string) || null,
      drepScore: Number(d.score) || 0,
      alignmentScore,
      alignments: drepAlignments,
      identityColor: getIdentityColor(getDominantDimension(drepAlignments)).hex,
      agreeDimensions: dimAgreement.agreeDimensions,
      differDimensions: dimAgreement.differDimensions,
      tier: (d.current_tier as string) || null,
    };
  });

  // Optional semantic matching
  let semanticMap: Map<string, number> | undefined;
  let rationaleMap: Map<string, { proposalTitle: string; excerpt: string; similarity: number }[]> =
    new Map();

  if (options.useSemantic && session.accumulatedText.length > 20) {
    try {
      const { semanticSearch } = await import('@/lib/embeddings/query');

      const semanticResults = await semanticSearch(session.accumulatedText, 'rationale', {
        threshold: 0.3,
        limit: limit * 3,
      });

      // Group by DRep (secondary_id is the DRep ID for rationale embeddings)
      semanticMap = new Map<string, number>();
      for (const result of semanticResults) {
        const drepId = result.secondary_id ?? result.entity_id;
        const existing = semanticMap.get(drepId) ?? 0;
        semanticMap.set(drepId, Math.max(existing, result.similarity));

        // Collect matching rationales
        if (!rationaleMap.has(drepId)) rationaleMap.set(drepId, []);
        rationaleMap.get(drepId)!.push({
          proposalTitle: (result.metadata?.proposal_title as string) ?? 'Governance Action',
          excerpt: (result.metadata?.excerpt as string) ?? '',
          similarity: result.similarity,
        });
      }
    } catch {
      // Semantic search failure is non-fatal — fall back to alignment-only
      semanticMap = undefined;
      rationaleMap = new Map();
    }
  }

  // Combine scores
  const results: MatchResult[] = alignmentResults.map((r) => {
    const semanticScore = semanticMap?.get(r.drepId);
    const combinedScore = semanticScore
      ? Math.round(r.alignmentScore * 0.6 + semanticScore * 100 * 0.4)
      : r.alignmentScore;

    return {
      drepId: r.drepId,
      drepName: r.drepName,
      score: combinedScore,
      semanticScore: semanticScore ? Math.round(semanticScore * 100) : undefined,
      alignmentScore: r.alignmentScore,
      matchingRationales: rationaleMap.get(r.drepId)?.slice(0, 3),
      alignments: r.alignments,
      identityColor: r.identityColor,
      agreeDimensions: r.agreeDimensions,
      differDimensions: r.differDimensions,
      tier: r.tier,
    };
  });

  // Sort by combined score, then entity quality score
  results.sort((a, b) => b.score - a.score);

  // Filter: minimum quality threshold + exclude unnamed entities (hex IDs are bad UX)
  const MIN_SCORE = 40;
  const filtered = results.filter((r) => r.score >= MIN_SCORE && r.drepName);
  const topMatches = filtered.slice(0, limit);

  // Find bridge match
  const bridgeMatch = selectBridgeMatch(filtered, topMatches, alignmentResults, weights);

  // ── SPO Matching ──────────────────────────────────────
  const spoMatches = await matchSpos(supabase, userAlignment, weights);

  return { matches: topMatches, bridgeMatch, spoMatches };
}

/* ─── SPO Matching ─────────────────────────────────────── */

/**
 * Match SPOs using the same 6D alignment as DReps.
 * Queries the latest epoch's alignment snapshots.
 */
async function matchSpos(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  userAlignment: AlignmentScores,
  weights?: Record<string, number>,
): Promise<SpoMatchResult[]> {
  try {
    // Get latest epoch with SPO data
    const { data: maxEpoch } = await supabase
      .from('spo_alignment_snapshots')
      .select('epoch_no')
      .order('epoch_no', { ascending: false })
      .limit(1)
      .maybeSingle();

    const epoch = maxEpoch?.epoch_no;
    if (!epoch) return [];

    // Fetch SPO alignments for latest epoch
    const { data: alignments } = await supabase
      .from('spo_alignment_snapshots')
      .select(
        'pool_id, alignment_treasury_conservative, alignment_treasury_growth, alignment_decentralization, alignment_security, alignment_innovation, alignment_transparency',
      )
      .eq('epoch_no', epoch)
      .not('alignment_treasury_conservative', 'is', null);

    if (!alignments?.length) return [];

    // Fetch SPO scores + metadata
    const { data: scores } = await supabase
      .from('spo_score_snapshots')
      .select('pool_id, governance_score, vote_count')
      .eq('epoch_no', epoch);

    const scoreMap = new Map(
      (scores ?? []).map((s) => [
        s.pool_id,
        { governanceScore: Number(s.governance_score) || 0, voteCount: Number(s.vote_count) || 0 },
      ]),
    );

    // Fetch pool metadata (name, ticker) from pools table
    const poolIds = alignments.map((a) => a.pool_id);
    const { data: poolMeta } = await supabase
      .from('pools')
      .select('pool_id, pool_name, ticker')
      .in('pool_id', poolIds);

    const metaMap = new Map(
      (poolMeta ?? []).map((p) => [
        p.pool_id,
        { name: (p.pool_name as string) || null, ticker: (p.ticker as string) || null },
      ]),
    );

    // Score each SPO
    const spoResults = alignments.map((row) => {
      const spoAlignments: AlignmentScores = {
        treasuryConservative: Number(row.alignment_treasury_conservative) || 50,
        treasuryGrowth: Number(row.alignment_treasury_growth) || 50,
        decentralization: Number(row.alignment_decentralization) || 50,
        security: Number(row.alignment_security) || 50,
        innovation: Number(row.alignment_innovation) || 50,
        transparency: Number(row.alignment_transparency) || 50,
      };

      const distance = weightedEuclideanDistance6D(userAlignment, spoAlignments, weights);
      const score = distanceToScore(distance, weights);
      const dimAgreement = computeDimensionAgreement(userAlignment, spoAlignments);
      const meta = metaMap.get(row.pool_id);
      const scoreInfo = scoreMap.get(row.pool_id);

      return {
        poolId: row.pool_id as string,
        poolName: meta?.name ?? null,
        ticker: meta?.ticker ?? null,
        score,
        alignments: spoAlignments,
        identityColor: getIdentityColor(getDominantDimension(spoAlignments)).hex,
        agreeDimensions: dimAgreement.agreeDimensions,
        differDimensions: dimAgreement.differDimensions,
        governanceScore: scoreInfo?.governanceScore ?? 0,
        voteCount: scoreInfo?.voteCount ?? 0,
      };
    });

    // Filter: named pools with minimum score, sorted by match score
    return spoResults
      .filter((s) => s.score >= 40 && (s.poolName || s.ticker))
      .sort((a, b) => b.score - a.score)
      .slice(0, 3);
  } catch {
    // SPO matching failure is non-fatal
    return [];
  }
}

/* ─── Helpers ───────────────────────────────────────────── */

/**
 * Get the next question for the current session state.
 * Returns null if max rounds reached or session is not in_progress.
 */
export function getNextQuestion(session: ConversationSession) {
  if (session.status !== 'in_progress') return null;
  if (session.rounds.length >= MAX_ROUNDS) return null;
  return getQuestionForRound(
    session.rounds.length,
    undefined,
    session.topicHints,
    session.pass ?? 0,
  );
}

/**
 * Weighted Euclidean distance across 6 alignment dimensions.
 * When no weights are provided, all dimensions get weight 1.0 (backward compatible).
 */
function weightedEuclideanDistance6D(
  a: AlignmentScores,
  b: AlignmentScores,
  weights?: Record<string, number>,
): number {
  let sum = 0;
  for (const dim of ALL_DIMENSIONS) {
    const weight = weights?.[dim] ?? 1.0;
    const diff = (a[dim] ?? 50) - (b[dim] ?? 50);
    sum += diff * diff * weight;
  }
  return Math.sqrt(sum);
}

/**
 * Convert distance to 0-100 score. Max distance scales with weights.
 */
function distanceToScore(distance: number, weights?: Record<string, number>): number {
  // Max possible distance: sqrt(sum(weight_i * 100^2))
  let maxDistSq = 0;
  for (const dim of ALL_DIMENSIONS) {
    const weight = weights?.[dim] ?? 1.0;
    maxDistSq += weight * 100 * 100;
  }
  const maxDist = Math.sqrt(maxDistSq);
  return Math.max(0, Math.round((1 - distance / maxDist) * 100));
}

/** Min entity score for bridge match candidates */
const BRIDGE_MIN_ENTITY_SCORE = 60;
/** Min agree dimensions for a bridge candidate */
const BRIDGE_MIN_AGREE = 3;
/** Min differ dimensions for a bridge candidate */
const BRIDGE_MIN_DIFFER = 1;

/**
 * Select the best "bridge" match: a DRep that agrees on most dimensions
 * but meaningfully disagrees on at least one — ideally the user's lowest-weighted dimension.
 */
function selectBridgeMatch(
  allFiltered: MatchResult[],
  topMatches: MatchResult[],
  alignmentResults: {
    drepId: string;
    drepScore: number;
    agreeDimensions: string[];
    differDimensions: string[];
  }[],
  weights?: Record<string, number>,
): MatchResult | null {
  const topIds = new Set(topMatches.map((m) => m.drepId));

  // Build a lookup for entity scores
  const entityScoreMap = new Map<string, number>();
  for (const r of alignmentResults) {
    entityScoreMap.set(r.drepId, r.drepScore);
  }

  // Find the lowest-weighted dimension name (for preferring disagreement there)
  let lowestWeightDim: string | null = null;
  if (weights) {
    let minWeight = Infinity;
    for (const [dim, w] of Object.entries(weights)) {
      if (w < minWeight) {
        minWeight = w;
        lowestWeightDim = dim;
      }
    }
  }

  // Convert dimension key to label for comparison with agree/differDimensions (which use labels)
  const DIMENSION_LABEL_MAP: Record<string, string> = {};
  for (const dim of ALL_DIMENSIONS) {
    // Import-free: reconstruct labels inline to match dimensionAgreement output
    const label = dim
      .replace(/([A-Z])/g, ' $1')
      .replace(/^./, (s) => s.toUpperCase())
      .trim();
    DIMENSION_LABEL_MAP[dim] = label;
  }
  // Override with known exact labels from dimensionAgreement.ts
  DIMENSION_LABEL_MAP['treasuryConservative'] = 'Treasury Conservative';
  DIMENSION_LABEL_MAP['treasuryGrowth'] = 'Treasury Growth';
  DIMENSION_LABEL_MAP['decentralization'] = 'Decentralization';
  DIMENSION_LABEL_MAP['security'] = 'Security';
  DIMENSION_LABEL_MAP['innovation'] = 'Innovation';
  DIMENSION_LABEL_MAP['transparency'] = 'Transparency';

  const lowestWeightLabel = lowestWeightDim ? DIMENSION_LABEL_MAP[lowestWeightDim] : null;

  let bestCandidate: MatchResult | null = null;
  let bestBridgeScore = -Infinity;

  for (const candidate of allFiltered) {
    // Skip top matches
    if (topIds.has(candidate.drepId)) continue;

    // Entity quality threshold
    const entityScore = entityScoreMap.get(candidate.drepId) ?? 0;
    if (entityScore < BRIDGE_MIN_ENTITY_SCORE) continue;

    // Must have enough agree and differ dimensions
    if (candidate.agreeDimensions.length < BRIDGE_MIN_AGREE) continue;
    if (candidate.differDimensions.length < BRIDGE_MIN_DIFFER) continue;

    // Bridge score: favor high overall match + disagreement on lowest-weight dimension
    let bridgeScore = candidate.score;

    // Bonus for disagreeing on the lowest-weighted dimension
    if (lowestWeightLabel && candidate.differDimensions.includes(lowestWeightLabel)) {
      bridgeScore += 10;
    }

    if (bridgeScore > bestBridgeScore) {
      bestBridgeScore = bridgeScore;
      bestCandidate = candidate;
    }
  }

  if (bestCandidate) {
    return { ...bestCandidate, isBridgeMatch: true };
  }

  return null;
}

export {
  MAX_ROUNDS,
  MAX_RAW_TEXT_LENGTH,
  TOTAL_QUESTIONS,
  ALL_DIMENSIONS,
  weightedEuclideanDistance6D as _weightedEuclideanDistance6D,
  distanceToScore as _distanceToScore,
};
