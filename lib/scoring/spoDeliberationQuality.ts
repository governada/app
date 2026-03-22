/**
 * SPO Deliberation Quality pillar (25% of SPO Score V3).
 *
 * V3.2: Replaces broken rationale-based scoring with voting behavior signals.
 * Four sub-components:
 * - Vote Diversity (35%): Penalizes rubber-stamping (>85% same direction)
 * - Dissent Rate (30%): 15-40% minority voting is the sweet spot
 * - Type Breadth (20%): Fraction of distinct proposal types voted on
 * - Coverage Entropy (15%): Shannon entropy across proposal types
 */

import { SPO_DELIBERATION_WEIGHTS, SPO_ABSTAIN_PENALTY } from './calibration';

export interface SpoDeliberationVoteData {
  proposalKey: string;
  vote: 'Yes' | 'No' | 'Abstain';
  blockTime: number;
  proposalBlockTime: number;
  proposalType: string;
  importanceWeight: number;
  hasRationale: boolean;
  /** Majority vote direction among all SPOs for this proposal (by simple count). */
  spoMajorityVote?: 'Yes' | 'No' | null;
}

// ---------------------------------------------------------------------------
// Sub-component 1: Vote Diversity (35%)
// ---------------------------------------------------------------------------

/**
 * Penalizes >85% same-direction voting (rubber-stamping).
 * Also penalizes high abstain rates (>60%).
 *
 * Score logic:
 * - Count direction fractions (Yes%, No%, Abstain%)
 * - If the dominant non-abstain direction exceeds 85%, penalize proportionally
 * - Apply abstain penalty if abstain rate > threshold
 *
 * Min votes: 5. Below that, return neutral 50.
 */
export function computeSpoVoteDiversity(votes: SpoDeliberationVoteData[]): number {
  const MIN_VOTES = 5;
  const DOMINANT_THRESHOLD = 0.85;

  if (votes.length < MIN_VOTES) return 50;

  let yesCount = 0;
  let noCount = 0;
  let abstainCount = 0;

  for (const v of votes) {
    if (v.vote === 'Yes') yesCount++;
    else if (v.vote === 'No') noCount++;
    else abstainCount++;
  }

  const total = votes.length;
  const abstainRate = abstainCount / total;

  // Compute diversity among non-abstain votes
  const nonAbstain = yesCount + noCount;
  let diversityScore: number;

  if (nonAbstain === 0) {
    // All abstains — no real voting diversity
    diversityScore = 0;
  } else {
    const dominantFraction = Math.max(yesCount, noCount) / nonAbstain;

    if (dominantFraction <= DOMINANT_THRESHOLD) {
      // Good diversity — scale linearly from threshold to 50/50
      // At 50/50 → 100, at 85% → ~50
      diversityScore =
        50 + 50 * ((DOMINANT_THRESHOLD - dominantFraction) / (DOMINANT_THRESHOLD - 0.5));
    } else {
      // Rubber-stamping — penalize proportionally
      // At 85% → 50, at 100% → 0
      diversityScore = 50 * ((1 - dominantFraction) / (1 - DOMINANT_THRESHOLD));
    }
  }

  // Apply abstain penalty
  if (abstainRate > SPO_ABSTAIN_PENALTY.threshold) {
    const penalty = Math.max(
      SPO_ABSTAIN_PENALTY.minFactor,
      1 - (abstainRate - SPO_ABSTAIN_PENALTY.threshold),
    );
    diversityScore *= penalty;
  }

  return clamp(Math.round(diversityScore));
}

// ---------------------------------------------------------------------------
// Sub-component 2: Dissent Rate (30%)
// ---------------------------------------------------------------------------

/**
 * Rewards SPOs who vote in the minority 15-40% of the time.
 * Uses spoMajorityVote (determined by simple vote count among all SPOs per proposal).
 *
 * Sweet spot curve:
 * - <15% dissent: linearly ramp from 30 → 100
 * - 15-40% dissent: full score 100
 * - >40% dissent: linearly decay from 100 → 30
 * - If spoMajorityVote is not available, skip that vote
 *
 * If fewer than 3 votes have majority data, return neutral 50.
 */
export function computeSpoDissentRate(votes: SpoDeliberationVoteData[]): number {
  const SWEET_LOW = 0.15;
  const SWEET_HIGH = 0.4;
  const FLOOR = 30;
  const MIN_VOTES_WITH_MAJORITY = 3;

  // Filter to votes that have majority data and are non-abstain
  const eligibleVotes = votes.filter((v) => v.spoMajorityVote != null && v.vote !== 'Abstain');

  if (eligibleVotes.length < MIN_VOTES_WITH_MAJORITY) return 50;

  let dissentCount = 0;
  for (const v of eligibleVotes) {
    if (v.vote !== v.spoMajorityVote) {
      dissentCount++;
    }
  }

  const dissentRate = dissentCount / eligibleVotes.length;

  if (dissentRate >= SWEET_LOW && dissentRate <= SWEET_HIGH) {
    return 100;
  }

  if (dissentRate < SWEET_LOW) {
    // Ramp: 0% dissent → FLOOR, SWEET_LOW → 100
    return clamp(Math.round(FLOOR + (100 - FLOOR) * (dissentRate / SWEET_LOW)));
  }

  // dissentRate > SWEET_HIGH
  // Decay: SWEET_HIGH → 100, 100% dissent → FLOOR
  const decayRange = 1 - SWEET_HIGH;
  const excess = dissentRate - SWEET_HIGH;
  return clamp(Math.round(100 - (100 - FLOOR) * (excess / decayRange)));
}

// ---------------------------------------------------------------------------
// Sub-component 3: Type Breadth (20%)
// ---------------------------------------------------------------------------

/**
 * Fraction of distinct proposal types the SPO has voted on,
 * weighted by proposal frequency.
 *
 * Same logic as DRep coverage breadth: types with more proposals
 * contribute more weight, so voting on Treasury (90% of proposals)
 * matters more than missing the rare HardFork vote.
 */
export function computeSpoTypeBreadth(
  votes: SpoDeliberationVoteData[],
  allProposalTypes: Set<string>,
): number {
  if (allProposalTypes.size === 0) return 50;

  const votedTypes = new Set<string>();
  for (const v of votes) votedTypes.add(v.proposalType);

  // Simple fraction — no frequency weighting here since we don't have
  // per-type proposal counts. Frequency-weighted version is in coverageEntropy.
  const fraction = votedTypes.size / allProposalTypes.size;
  return clamp(Math.round(fraction * 100));
}

// ---------------------------------------------------------------------------
// Sub-component 4: Coverage Entropy (15%) — kept from V3
// ---------------------------------------------------------------------------

/**
 * Proposal Coverage Entropy: Shannon entropy across proposal types.
 * Balanced engagement across types > token engagement across all types.
 * Normalized to 0-100 by dividing by max possible entropy.
 */
export function computeCoverageEntropy(
  votes: SpoDeliberationVoteData[],
  allProposalTypes: Set<string>,
): number {
  if (votes.length === 0 || allProposalTypes.size === 0) return 0;

  const typeCounts = new Map<string, number>();
  for (const v of votes) {
    typeCounts.set(v.proposalType, (typeCounts.get(v.proposalType) ?? 0) + 1);
  }

  const totalVotes = votes.length;
  let entropy = 0;

  for (const count of typeCounts.values()) {
    const p = count / totalVotes;
    if (p > 0) {
      entropy -= p * Math.log2(p);
    }
  }

  // Normalize by max possible entropy (uniform distribution across all types)
  const maxEntropy = Math.log2(allProposalTypes.size);
  if (maxEntropy === 0) return 50;

  return clamp(Math.round((entropy / maxEntropy) * 100));
}

// ---------------------------------------------------------------------------
// Main computation
// ---------------------------------------------------------------------------

/**
 * Compute raw Deliberation Quality scores (0-100) for all SPOs.
 */
export function computeSpoDeliberationQuality(
  poolVotes: Map<string, SpoDeliberationVoteData[]>,
  allProposalTypes: Set<string>,
  _nowSeconds: number,
): Map<string, number> {
  const scores = new Map<string, number>();
  const w = SPO_DELIBERATION_WEIGHTS;

  for (const [poolId, votes] of poolVotes) {
    if (votes.length === 0) {
      scores.set(poolId, 0);
      continue;
    }

    const diversity = computeSpoVoteDiversity(votes);
    const dissent = computeSpoDissentRate(votes);
    const breadth = computeSpoTypeBreadth(votes, allProposalTypes);
    const entropy = computeCoverageEntropy(votes, allProposalTypes);

    const raw =
      diversity * w.voteDiversity +
      dissent * w.dissent +
      breadth * w.typeBreadth +
      entropy * w.coverageEntropy;

    scores.set(poolId, clamp(Math.round(raw)));
  }

  return scores;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function clamp(v: number): number {
  return Math.max(0, Math.min(100, v));
}
