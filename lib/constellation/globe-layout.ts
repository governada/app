/**
 * Volumetric constellation layout engine.
 *
 * Maps governance participants into a 3D volume bounded by a sphere:
 *   - CC members = distributed sentinels throughout mid-volume (r 3-6)
 *   - Active DReps = inner-mid shell (r 4-6.5), positioned by alignment dimensions
 *   - Regular DReps = mid-outer shell (r 5-7.5)
 *   - SPOs = infrastructure layer (r 5.5-7.5)
 *   - Inactive/retired = periphery (r 7-8)
 *
 * Alignment dimensions map to 6 longitude bands (60° each).
 * Specialization strength maps to latitude spread.
 * Node significance maps to radial depth (closer to center = more significant).
 */

import type {
  ConstellationNode3D,
  ConstellationEdge3D,
  LayoutResult,
  GovernanceNodeType,
} from './types';
import type { AlignmentDimension } from '@/lib/drepIdentity';
import { getDimensionOrder } from '@/lib/drepIdentity';

const DIMS = getDimensionOrder();

// 6 dimensions → 6 longitude sectors, 60° each
const DIM_LONGITUDES: Record<string, number> = (() => {
  const map: Record<string, number> = {};
  DIMS.forEach((dim, i) => {
    map[dim] = (i / DIMS.length) * Math.PI * 2 - Math.PI;
  });
  return map;
})();

export const GLOBE_RADIUS = 8; // sphere boundary — the constellation's edge
/** Alias for consumers that reference the layout extent */
export const CONSTELLATION_EXTENT = GLOBE_RADIUS;

const MIN_VISIBLE_SCALE = 0.06;
const MAX_VISIBLE_SCALE = 0.25;
const SPO_SCALE_FACTOR = 0.6;
const CC_SCALE_FACTOR = 0.7;
const SPO_LIMIT = 400;

/**
 * Compute the radial depth for a node based on type and significance.
 * Lower radius = closer to center = more significant/active.
 */
function computeVolumetricRadius(input: LayoutInput): number {
  const hash = simpleHash(input.id);
  const hashNorm = (hash % 10000) / 10000;

  switch (input.nodeType) {
    case 'cc':
      return 3.0 + hashNorm * 3.0; // range 3-6
    case 'drep': {
      if (input.drepStatus === 'Inactive' || input.drepStatus === 'Retired') {
        return 7.0 + hashNorm * 1.0;
      }
      if (input.score > 70) {
        return 4.0 + (1 - input.score / 100) * 2.5;
      }
      return 5.0 + (1 - Math.min(1, input.power)) * 2.5;
    }
    case 'spo':
      return 5.5 + hashNorm * 2.0;
    default:
      return GLOBE_RADIUS * 0.9;
  }
}

export interface LayoutInput {
  id: string;
  fullId: string;
  name: string | null;
  power: number;
  score: number;
  dominant: AlignmentDimension;
  alignments: number[];
  nodeType: GovernanceNodeType;
  geoLat?: number;
  geoLon?: number;
  adaAmount?: number;
  drepStatus?: string;
  delegatorCount?: number;
  voteCount?: number;
  fidelityGrade?: string;
}

export function computeGlobeLayout(inputs: LayoutInput[], nodeLimit: number): LayoutResult {
  const drepInputs = inputs.filter((n) => n.nodeType === 'drep');
  const spoInputs = inputs.filter((n) => n.nodeType === 'spo').slice(0, SPO_LIMIT);
  const ccInputs = inputs.filter((n) => n.nodeType === 'cc');

  const sorted = [...drepInputs].sort((a, b) => b.power - a.power);
  const active = sorted.slice(0, nodeLimit);

  const nodes: ConstellationNode3D[] = [];
  const nodeMap = new Map<string, ConstellationNode3D>();

  // DReps — volumetric distribution based on score/activity
  for (const input of active) {
    const [lon, lat] = computeSpherePosition(input);
    const r = computeVolumetricRadius(input);
    const pos = sphereToCartesian(lat, lon, r);
    const baseScale = MIN_VISIBLE_SCALE + input.power * (MAX_VISIBLE_SCALE - MIN_VISIBLE_SCALE);
    const depthBoost = 1 + ((GLOBE_RADIUS - r) / GLOBE_RADIUS) * 0.4;
    const node: ConstellationNode3D = {
      ...input,
      position: pos,
      scale: baseScale * depthBoost,
      depth: r / GLOBE_RADIUS,
    };
    nodes.push(node);
    nodeMap.set(node.id, node);
  }

  // CC members — distributed sentinels throughout the volume
  for (const input of ccInputs) {
    const [lon, lat] = computeSpherePosition(input);
    const r = computeVolumetricRadius(input);
    const pos = sphereToCartesian(lat, lon, r);
    const depthBoost = 1 + ((GLOBE_RADIUS - r) / GLOBE_RADIUS) * 0.4;
    const scale = MAX_VISIBLE_SCALE * CC_SCALE_FACTOR * depthBoost;
    const node: ConstellationNode3D = {
      ...input,
      position: pos,
      scale,
      depth: r / GLOBE_RADIUS,
    };
    nodes.push(node);
    nodeMap.set(node.id, node);
  }

  // SPOs — infrastructure layer, volumetric depth
  for (let i = 0; i < spoInputs.length; i++) {
    const input = spoInputs[i];
    let lat: number;
    let lon: number;

    if (input.geoLat != null && input.geoLon != null) {
      lat = (input.geoLat * Math.PI) / 180;
      lon = (input.geoLon * Math.PI) / 180;
    } else {
      const hash = simpleHash(input.id);
      lon = (i / spoInputs.length) * Math.PI * 2 - Math.PI;
      lat = (((hash % 140) - 70) / 70) * (Math.PI / 2) * 0.85;
    }

    const r = computeVolumetricRadius(input);
    const pos = sphereToCartesian(lat, lon, r);
    const baseScale =
      (MIN_VISIBLE_SCALE + input.power * (MAX_VISIBLE_SCALE - MIN_VISIBLE_SCALE)) *
      SPO_SCALE_FACTOR;
    const scoreNorm = Math.max(0, Math.min(1, (input.score - 30) / 70));
    const depthBoost = 1 + ((GLOBE_RADIUS - r) / GLOBE_RADIUS) * 0.4;
    const node: ConstellationNode3D = {
      ...input,
      position: pos,
      scale: baseScale * (0.7 + scoreNorm * 0.6) * depthBoost,
      geoLat: input.geoLat,
      geoLon: input.geoLon,
      depth: r / GLOBE_RADIUS,
    };
    nodes.push(node);
    nodeMap.set(node.id, node);
  }

  // Edges computed client-side from cluster data (constellation lines)
  return { nodes, edges: [], nodeMap };
}

/**
 * Map alignment scores to longitude/latitude on the sphere.
 */
export function computeSpherePosition(input: LayoutInput): [number, number] {
  const scores = input.alignments;
  const hash = simpleHash(input.id);
  const hashNorm = (hash % 10000) / 10000;

  let wx = 0,
    wy = 0,
    totalWeight = 0;
  for (let i = 0; i < DIMS.length; i++) {
    const score = scores[i] ?? 50;
    const weight = Math.abs(score - 50);
    const angle = DIM_LONGITUDES[DIMS[i]];
    wx += Math.cos(angle) * weight;
    wy += Math.sin(angle) * weight;
    totalWeight += weight;
  }

  let lon: number;
  if (totalWeight < 1) {
    lon = hashNorm * Math.PI * 2 - Math.PI;
  } else {
    const dirAngle = Math.atan2(wy, wx);
    const jitter = (hashNorm - 0.5) * (Math.PI / 3);
    lon = dirAngle + jitter;
  }

  const specialization = Math.min(1, totalWeight / (DIMS.length * 30));
  const hashLat = (((hash >> 8) % 1000) / 1000 - 0.5) * 2;
  const latSign = hashLat >= 0 ? 1 : -1;
  const lat = latSign * specialization * (Math.PI / 2) * 0.8 + (hashLat * 0.2 * Math.PI) / 2;

  return [lon, clamp(lat, -Math.PI / 2 + 0.1, Math.PI / 2 - 0.1)];
}

/**
 * Position by alignment — convenience export for user node placement,
 * cluster detection, and proposal positioning. Uses sphere positioning
 * at a standard DRep-shell radius.
 */
export function positionByAlignment(input: LayoutInput): [number, number, number] {
  const [lon, lat] = computeSpherePosition(input);
  const r = 5.5; // mid-shell radius
  return sphereToCartesian(lat, lon, r);
}

export function sphereToCartesian(
  lat: number,
  lon: number,
  radius: number,
): [number, number, number] {
  return [
    radius * Math.cos(lat) * Math.cos(lon),
    radius * Math.cos(lat) * Math.sin(lon),
    radius * Math.sin(lat),
  ];
}

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}

export function simpleHash(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash + str.charCodeAt(i)) | 0;
  }
  return Math.abs(hash);
}
