/**
 * Alignment Drift Detection Engine.
 * Compares citizen governance profiles (6D) against their delegated
 * DRep's current alignment. Classifies drift severity and surfaces
 * alternative DRep suggestions when drift is high.
 */

export const ALIGNMENT_DIMENSIONS = [
  'treasury_conservative',
  'treasury_growth',
  'decentralization',
  'security',
  'innovation',
  'transparency',
] as const;

export type AlignmentDimension = (typeof ALIGNMENT_DIMENSIONS)[number];

export type Alignment6D = Record<AlignmentDimension, number>;

export type DriftClassification = 'low' | 'moderate' | 'high';

export interface DimensionDrift {
  dimension: AlignmentDimension;
  citizenValue: number;
  drepValue: number;
  delta: number;
}

export interface DriftResult {
  driftScore: number;
  classification: DriftClassification;
  dimensionDrifts: DimensionDrift[];
  worstDimension: AlignmentDimension | null;
}

import { ALIGNMENT_DRIFT_WEIGHTS, DRIFT_THRESHOLDS } from '@/lib/scoring/calibration';

// Map camelCase calibration keys to snake_case drift dimension keys
const DIMENSION_WEIGHTS: Record<AlignmentDimension, number> = {
  treasury_conservative: ALIGNMENT_DRIFT_WEIGHTS.treasuryConservative,
  treasury_growth: ALIGNMENT_DRIFT_WEIGHTS.treasuryGrowth,
  decentralization: ALIGNMENT_DRIFT_WEIGHTS.decentralization,
  security: ALIGNMENT_DRIFT_WEIGHTS.security,
  innovation: ALIGNMENT_DRIFT_WEIGHTS.innovation,
  transparency: ALIGNMENT_DRIFT_WEIGHTS.transparency,
};

/**
 * Compute alignment drift between a citizen's governance profile and
 * their delegated DRep's voting alignment.
 *
 * Both inputs are 6D alignment vectors with values 0-100.
 * Drift score is a weighted aggregate of per-dimension distances (0-100 scale).
 */
export function computeAlignmentDrift(
  citizenAlignment: Alignment6D,
  drepAlignment: Alignment6D,
): DriftResult {
  const dimensionDrifts: DimensionDrift[] = [];
  let weightedSum = 0;
  let maxDelta = 0;
  let worstDimension: AlignmentDimension | null = null;

  for (const dim of ALIGNMENT_DIMENSIONS) {
    const citizenVal = citizenAlignment[dim] ?? 50;
    const drepVal = drepAlignment[dim] ?? 50;
    const delta = Math.abs(citizenVal - drepVal);

    dimensionDrifts.push({
      dimension: dim,
      citizenValue: citizenVal,
      drepValue: drepVal,
      delta,
    });

    weightedSum += delta * (DIMENSION_WEIGHTS[dim] ?? 1 / 6);

    if (delta > maxDelta) {
      maxDelta = delta;
      worstDimension = dim;
    }
  }

  const driftScore = Math.round(weightedSum);
  const classification = classifyDrift(driftScore);

  return {
    driftScore,
    classification,
    dimensionDrifts,
    worstDimension,
  };
}

function classifyDrift(score: number): DriftClassification {
  if (score <= DRIFT_THRESHOLDS.low) return 'low';
  if (score <= DRIFT_THRESHOLDS.moderate) return 'moderate';
  return 'high';
}

/**
 * Convert camelCase alignment scores (as stored in user_governance_profiles)
 * to the snake_case Alignment6D format used by the drift engine.
 */
const CAMEL_TO_SNAKE: Record<string, AlignmentDimension> = {
  treasuryConservative: 'treasury_conservative',
  treasuryGrowth: 'treasury_growth',
  decentralization: 'decentralization',
  security: 'security',
  innovation: 'innovation',
  transparency: 'transparency',
};

export function toAlignment6D(camelScores: Record<string, number | null>): Alignment6D {
  const result: Alignment6D = {
    treasury_conservative: 50,
    treasury_growth: 50,
    decentralization: 50,
    security: 50,
    innovation: 50,
    transparency: 50,
  };
  for (const [camel, snake] of Object.entries(CAMEL_TO_SNAKE)) {
    const val = camelScores[camel];
    if (val != null) result[snake] = val;
  }
  return result;
}
