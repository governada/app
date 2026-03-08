/**
 * Engagement Quality pillar (35% of DRep Score).
 * Three layers: Provision Rate, Rationale Quality, Deliberation Signal.
 * Replaces the old binary rationale rate.
 */

import { DECAY_LAMBDA, type VoteData, type ProposalVotingSummary } from './types';
import {
  ENGAGEMENT_LAYER_WEIGHTS,
  DELIBERATION_WEIGHTS,
  VOTE_DIVERSITY_THRESHOLDS,
  VOTE_DIVERSITY_MIN_VOTES,
  DISSENT_CURVE,
} from './calibration';

const LAYER_WEIGHTS = ENGAGEMENT_LAYER_WEIGHTS;
const DELIB_WEIGHTS = DELIBERATION_WEIGHTS;
const INFO_ACTION = 'InfoAction';

/**
 * Compute raw Engagement Quality scores (0-100) for all DReps.
 *
 * @param drepVotes Map of drepId → their votes (enriched with rationale quality & importance)
 * @param votingSummaries Map of proposalKey → voting power summary (for majority determination)
 * @param allProposalTypes Set of all distinct proposal types in the system
 * @param nowSeconds Current unix timestamp
 */
export function computeEngagementQuality(
  drepVotes: Map<string, VoteData[]>,
  votingSummaries: Map<string, ProposalVotingSummary>,
  allProposalTypes: Set<string>,
  nowSeconds: number,
): Map<string, number> {
  const scores = new Map<string, number>();

  for (const [drepId, votes] of drepVotes) {
    if (votes.length === 0) {
      scores.set(drepId, 0);
      continue;
    }

    const provision = computeProvisionRate(votes, nowSeconds);
    const quality = computeRationaleQuality(votes, nowSeconds);
    const deliberation = computeDeliberationSignal(votes, votingSummaries, allProposalTypes);

    const raw =
      provision * LAYER_WEIGHTS.provision +
      quality * LAYER_WEIGHTS.quality +
      deliberation * LAYER_WEIGHTS.deliberation;

    scores.set(drepId, clamp(Math.round(raw)));
  }

  return scores;
}

/**
 * Layer 1 — Provision Rate (40% of pillar).
 * Weighted by proposal importance and temporal decay.
 * InfoActions excluded (non-binding polls don't need rationale).
 */
function computeProvisionRate(votes: VoteData[], nowSeconds: number): number {
  let weightedHas = 0;
  let totalWeight = 0;

  for (const v of votes) {
    if (v.proposalType === INFO_ACTION) continue;

    const ageDays = Math.max(0, (nowSeconds - v.blockTime) / 86400);
    const decay = Math.exp(-DECAY_LAMBDA * ageDays);
    const w = v.importanceWeight * decay;

    totalWeight += w;
    if (v.rationaleQuality !== null && v.rationaleQuality > 0) {
      weightedHas += w;
    }
  }

  return totalWeight === 0 ? 0 : (weightedHas / totalWeight) * 100;
}

/**
 * Layer 2 — Rationale Quality (40% of pillar).
 * Weighted average of AI quality scores across votes, with importance and decay.
 * DReps with 0 rationales get 0. DReps with few but excellent rationales can score high.
 */
function computeRationaleQuality(votes: VoteData[], nowSeconds: number): number {
  let weightedQuality = 0;
  let totalWeight = 0;

  for (const v of votes) {
    if (v.proposalType === INFO_ACTION) continue;
    if (v.rationaleQuality === null || v.rationaleQuality === 0) continue;

    const ageDays = Math.max(0, (nowSeconds - v.blockTime) / 86400);
    const decay = Math.exp(-DECAY_LAMBDA * ageDays);
    const w = v.importanceWeight * decay;

    totalWeight += w;
    weightedQuality += v.rationaleQuality * w;
  }

  return totalWeight === 0 ? 0 : weightedQuality / totalWeight;
}

/**
 * Layer 3 — Deliberation Signal (20% of pillar).
 * Sub-components: vote diversity, dissent rate, proposal type breadth.
 */
function computeDeliberationSignal(
  votes: VoteData[],
  votingSummaries: Map<string, ProposalVotingSummary>,
  allProposalTypes: Set<string>,
): number {
  const diversity = computeVoteDiversity(votes);
  const dissent = computeDissentRate(votes, votingSummaries);
  const breadth = computeTypeBreadth(votes, allProposalTypes);

  return (
    diversity * DELIB_WEIGHTS.voteDiversity +
    dissent * DELIB_WEIGHTS.dissent +
    breadth * DELIB_WEIGHTS.typeBreadth
  );
}

/**
 * Vote diversity: rescale the existing deliberation modifier concept to 0-100.
 * Penalizes rubber-stamping (>85% same vote direction).
 */
function computeVoteDiversity(votes: VoteData[]): number {
  if (votes.length <= VOTE_DIVERSITY_MIN_VOTES) return 50; // too few votes to judge

  const counts = { Yes: 0, No: 0, Abstain: 0 };
  for (const v of votes) counts[v.vote]++;

  const dominant = Math.max(counts.Yes, counts.No, counts.Abstain);
  const dominantRatio = dominant / votes.length;

  // Thresholds sorted ascending by maxRatio — first match wins
  for (const t of VOTE_DIVERSITY_THRESHOLDS) {
    if (dominantRatio <= t.maxRatio) return t.score;
  }
  return VOTE_DIVERSITY_THRESHOLDS[VOTE_DIVERSITY_THRESHOLDS.length - 1].score;
}

/**
 * Dissent rate: percentage of votes against the eventual majority outcome.
 * Moderate dissent (15-40%) scores highest (independent thinking).
 * Zero = rubber-stamper, very high = contrarian.
 */
function computeDissentRate(
  votes: VoteData[],
  votingSummaries: Map<string, ProposalVotingSummary>,
): number {
  let dissentCount = 0;
  let eligibleCount = 0;

  for (const v of votes) {
    if (v.vote === 'Abstain') continue;

    const summary = votingSummaries.get(v.proposalKey);
    if (!summary) continue;

    eligibleCount++;
    const majority = summary.drepYesVotePower >= summary.drepNoVotePower ? 'Yes' : 'No';

    if (v.vote !== majority) dissentCount++;
  }

  if (eligibleCount < DISSENT_CURVE.minVotes) return 50; // too few data points

  const rate = dissentCount / eligibleCount;
  return scoreDissentCurve(rate);
}

/**
 * Dissent scoring curve: sweet spot at 15-40%.
 */
function scoreDissentCurve(rate: number): number {
  const { zeroRate, sweetSpotStart, sweetSpotEnd, sweetSpotScore, minScore } = DISSENT_CURVE;
  if (rate <= 0) return zeroRate;
  if (rate < sweetSpotStart)
    return zeroRate + (rate / sweetSpotStart) * (sweetSpotScore - zeroRate);
  if (rate <= sweetSpotEnd) return sweetSpotScore;
  if (rate < 1.0)
    return Math.max(
      minScore,
      sweetSpotScore - ((rate - sweetSpotEnd) / (1 - sweetSpotEnd)) * (sweetSpotScore - minScore),
    );
  return minScore;
}

/**
 * Proposal type breadth: what fraction of distinct proposal types
 * has this DRep voted on? Rewards governance surface area coverage.
 */
function computeTypeBreadth(votes: VoteData[], allProposalTypes: Set<string>): number {
  if (allProposalTypes.size === 0) return 50;

  const votedTypes = new Set<string>();
  for (const v of votes) votedTypes.add(v.proposalType);

  return (votedTypes.size / allProposalTypes.size) * 100;
}

function clamp(v: number): number {
  return Math.max(0, Math.min(100, v));
}
