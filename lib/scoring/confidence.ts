/**
 * Score Confidence System for SPO Score V3.
 * Measures how reliable an SPO's score is based on available evidence.
 *
 * Effects:
 * - Confidence < 60 caps tier at Emerging
 * - Low-confidence SPOs contribute less to percentile distribution
 * - UI renders low-confidence scores with a "provisional" marker
 */

import { SPO_CONFIDENCE } from './calibration';

/**
 * Compute confidence (0-100) for a single SPO based on evidence volume.
 *
 * - voteCount: primary signal (~15 votes = 80% confidence)
 * - epochSpan: how many epochs between first and last vote
 * - typeCoverage: fraction of proposal types voted on (0-1)
 */
export function computeConfidence(
  voteCount: number,
  epochSpan: number,
  typeCoverage: number,
): number {
  const voteFactor = 1 - Math.exp(-voteCount / SPO_CONFIDENCE.voteDecayRate);
  const spanFactor = 1 - Math.exp(-epochSpan / SPO_CONFIDENCE.spanDecayRate);
  const typeFactor = Math.min(1, typeCoverage / SPO_CONFIDENCE.typeCoverageThreshold);

  return Math.round(
    (voteFactor * SPO_CONFIDENCE.weights.vote +
      spanFactor * SPO_CONFIDENCE.weights.span +
      typeFactor * SPO_CONFIDENCE.weights.type) *
      100,
  );
}

/**
 * Confidence-weighted percentile normalization.
 * Low-confidence entries contribute less to the distribution,
 * preventing 2-vote SPOs from distorting rankings for 200-vote SPOs.
 *
 * Algorithm:
 * 1. Weight each entry's "count" in the ranking by its confidence
 * 2. Compute weighted percentile ranks
 */
export function percentileNormalizeWeighted(
  rawScores: Map<string, number>,
  confidences: Map<string, number>,
): Map<string, number> {
  const entries = [...rawScores.entries()];
  const n = entries.length;

  if (n === 0) return new Map();
  if (n === 1) return new Map([[entries[0][0], 50]]);

  const sorted = entries
    .map(([id, value]) => ({
      id,
      value,
      weight: Math.max(0.1, (confidences.get(id) ?? 50) / 100),
    }))
    .sort((a, b) => a.value - b.value);

  const totalWeight = sorted.reduce((sum, e) => sum + e.weight, 0);
  const percentiles = new Map<string, number>();

  let cumulativeWeight = 0;
  let i = 0;

  while (i < sorted.length) {
    let j = i;
    let tieWeight = 0;

    // Find all entries with the same value (ties)
    while (j < sorted.length && sorted[j].value === sorted[i].value) {
      tieWeight += sorted[j].weight;
      j++;
    }

    // Percentile = midpoint of the cumulative weight range for this tie group
    const midCumulative = cumulativeWeight + tieWeight / 2;
    const percentile = Math.round((midCumulative / totalWeight) * 100);

    for (let k = i; k < j; k++) {
      percentiles.set(sorted[k].id, Math.min(100, percentile));
    }

    cumulativeWeight += tieWeight;
    i = j;
  }

  return percentiles;
}

/** Minimum confidence required for tier assignment above Emerging. */
export const CONFIDENCE_TIER_THRESHOLD = SPO_CONFIDENCE.tierThreshold;
