/**
 * User node placement — computes 3D position for a citizen's match-derived
 * alignment on the governance constellation globe.
 *
 * Uses the same positioning logic as DReps (computeSpherePosition) so the
 * user node lands in the correct alignment neighborhood.
 */

import type { AlignmentScores } from '@/lib/drepIdentity';
import { alignmentsToArray, getDominantDimension } from '@/lib/drepIdentity';
import type { LayoutInput } from '@/lib/constellation/globe-layout';
import { computeSpherePosition, sphereToCartesian } from '@/lib/constellation/globe-layout';

/** Radius for the match user node — inner-mid shell, prominent but not center. */
const USER_NODE_RADIUS = 5.0;

/**
 * Compute 3D position for a citizen based on their quiz-derived alignment.
 * Uses the same sphere positioning as DReps so the user appears in the
 * correct alignment neighborhood.
 */
export function computeUserNodePosition(answers: AlignmentScores): [number, number, number] {
  const alignments = alignmentsToArray(answers);
  const syntheticInput: LayoutInput = {
    id: 'match-user',
    fullId: 'match-user',
    name: 'You',
    power: 0.5,
    score: 50,
    dominant: getDominantDimension(answers),
    alignments,
    nodeType: 'drep', // use drep positioning logic for citizens
  };
  const [lon, lat] = computeSpherePosition(syntheticInput);
  return sphereToCartesian(lat, lon, USER_NODE_RADIUS);
}

/** Euclidean distance in 6D alignment space. */
function euclideanDist6D(a: number[], b: number[]): number {
  let sum = 0;
  for (let i = 0; i < Math.min(a.length, b.length); i++) {
    const d = a[i] - b[i];
    sum += d * d;
  }
  return Math.sqrt(sum);
}

/** Find the closest cluster to the user's alignment vector. */
export function findClosestCluster(
  userAlignment: number[],
  clusters: Array<{ centroid6D: number[]; name: string; memberCount: number }>,
): { name: string; neighborCount: number } | null {
  if (clusters.length === 0) return null;

  let closest = clusters[0];
  let closestDist = euclideanDist6D(userAlignment, closest.centroid6D);

  for (let i = 1; i < clusters.length; i++) {
    const d = euclideanDist6D(userAlignment, clusters[i].centroid6D);
    if (d < closestDist) {
      closestDist = d;
      closest = clusters[i];
    }
  }

  return { name: closest.name, neighborCount: closest.memberCount };
}
