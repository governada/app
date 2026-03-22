/**
 * Sybil Confidence Penalty for SPO Score V3.2.
 * Reduces confidence (not raw score) for pools with unresolved sybil flags.
 */
import { SYBIL_CONFIDENCE_PENALTY } from './calibration';

export interface SybilConfidenceFlag {
  pool_a: string;
  pool_b: string;
  agreement_rate: number;
  resolved: boolean;
}

export function computeSybilConfidencePenalty(
  poolId: string,
  flags: SybilConfidenceFlag[],
): number {
  const unresolved = flags.filter(
    (f) => !f.resolved && (f.pool_a === poolId || f.pool_b === poolId),
  );
  if (unresolved.length === 0) return 0;

  // Multiple different partners = strongest penalty
  const partners = new Set<string>();
  for (const f of unresolved) {
    partners.add(f.pool_a === poolId ? f.pool_b : f.pool_a);
  }
  if (partners.size >= 2) return SYBIL_CONFIDENCE_PENALTY.multiPartner;

  // High agreement rate = high confidence flag
  const maxAgreement = Math.max(...unresolved.map((f) => f.agreement_rate));
  if (maxAgreement >= 0.98) return SYBIL_CONFIDENCE_PENALTY.highConfidence;

  return SYBIL_CONFIDENCE_PENALTY.standard;
}

export function applySybilPenalty(baseConfidence: number, penalty: number): number {
  return Math.max(0, Math.min(100, baseConfidence - penalty));
}
