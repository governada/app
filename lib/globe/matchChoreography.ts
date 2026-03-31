/**
 * matchChoreography — Cerebro-style dive-through camera choreography.
 *
 * The camera dives INTO the constellation, weaving between nodes as it
 * progressively narrows toward DRep matches. Each answer approaches from
 * a different angle, creating the "hunting for your DRep" sensation.
 *
 * Globe rotates very slowly during match (ambient life) while the camera
 * does all the intentional motion. Non-DRep nodes are aggressively muted.
 *
 * Used by SenecaMatch to orchestrate the globe during the match flow.
 */

import type { GlobeCommand } from '@/lib/globe/types';

type SequenceStep = { command: GlobeCommand; delayMs: number };

// ---------------------------------------------------------------------------
// Reveal timing — exported so SenecaMatch can sync overlay/countdown UI
// ---------------------------------------------------------------------------

/**
 * Total duration from the start of the reveal sequence to when the overlay
 * should appear. Depends on match count (up to 5 flash steps).
 *
 * Sequence: dim(0ms) → pause(800ms) → flash runners-up(500ms each) → flash #2(600ms)
 *   → flash #1(900ms) → flyTo delay(600ms) + 3s hold
 */
export function getRevealDurationMs(matchCount: number): number {
  const clampedCount = Math.min(matchCount, 5);
  if (clampedCount === 0) return 0;
  // 800ms tension pause + runner-up flashes + #2 flash + #1 flash + flyTo delay + 3s hold
  const runnerUpCount = Math.max(0, clampedCount - 2); // 5th, 4th, 3rd place
  const flashMs = runnerUpCount * 500 + (clampedCount >= 2 ? 600 : 0) + 900;
  return 800 + flashMs + 600 + 3000;
}

// ---------------------------------------------------------------------------
// Stage 5: Match Reveal — blackout → countdown 5→4→3→2→1 → fly to #1
// (Match start + Q&A phases migrated to reactive FocusIntent engine)
// ---------------------------------------------------------------------------

export function buildRevealSequence(
  topMatches: Array<{ nodeId: string }>,
  _alignment: number[],
  _threshold: number,
): GlobeCommand {
  const steps: SequenceStep[] = [];

  if (topMatches.length === 0) {
    return { type: 'sequence', steps };
  }

  // Phase 1: Tension build — dim everything, slow cinematic orbit
  steps.push({ command: { type: 'dim' }, delayMs: 0 });
  steps.push({
    command: {
      type: 'cinematic',
      state: { orbitSpeed: 0.008, dollyTarget: 14, dimTarget: 1, transitionDuration: 0.5 },
    },
    delayMs: 0,
  });

  // Phase 2: Dramatic pause — darkness builds anticipation (800ms of nothing)
  // The first flash carries the 800ms delay

  // Phase 3: Sequential illumination — top 5 in reverse (5th→4th→3rd→2nd→1st)
  // Escalating delays: 500ms for runners-up, 600ms for #2, 900ms for #1
  const reversed = [...topMatches].reverse().slice(0, 5);
  for (let i = 0; i < reversed.length; i++) {
    const match = reversed[i];
    const isTop = i === reversed.length - 1; // #1 match
    const isSecond = i === reversed.length - 2; // #2 match
    const isFirst = i === 0; // first flash (carries the dramatic pause)
    let delayMs: number;
    if (isFirst)
      delayMs = 800; // includes dramatic pause
    else if (isTop)
      delayMs = 900; // longest anticipation for #1
    else if (isSecond) delayMs = 600;
    else delayMs = 500;
    steps.push({ command: { type: 'flash', nodeId: match.nodeId }, delayMs });
  }

  // Phase 4: Lock-on — stop orbit, then dramatic fly to #1
  steps.push({
    command: {
      type: 'cinematic',
      state: { orbitSpeed: 0, dollyTarget: 14, dimTarget: 1, transitionDuration: 0.3 },
    },
    delayMs: 200,
  });
  steps.push({
    command: { type: 'matchFlyTo', nodeId: topMatches[0].nodeId },
    delayMs: 400,
  });

  return { type: 'sequence', steps };
}

// ---------------------------------------------------------------------------
// Stage 5b: Spatial Reveal — extends reveal with user node + neighborhood
// ---------------------------------------------------------------------------

/** Additional duration added by the spatial reveal steps. */
const SPATIAL_EXTEND_MS = 3500;

/**
 * Total duration for the spatial reveal variant (existing reveal + spatial steps).
 */
export function getSpatialRevealDurationMs(matchCount: number): number {
  return getRevealDurationMs(matchCount) + SPATIAL_EXTEND_MS;
}

/**
 * Build the spatial match reveal sequence — existing reveal sequence plus
 * user node placement, camera reframe to user position, and neighborhood glow.
 *
 * The key shift: the user's position becomes the destination, not the DRep's.
 */
export function buildSpatialRevealSequence(
  topMatches: Array<{ nodeId: string }>,
  alignment: number[],
  threshold: number,
  userPosition: [number, number, number],
): GlobeCommand {
  // Get the existing reveal sequence steps
  const baseReveal = buildRevealSequence(topMatches, alignment, threshold);
  const baseSteps: SequenceStep[] = baseReveal.type === 'sequence' ? baseReveal.steps : [];

  // Append spatial steps after the existing reveal
  const spatialSteps: SequenceStep[] = [
    // User node appears with warm gold glow
    {
      command: { type: 'placeUserNode', position: userPosition, intensity: 1.0 },
      delayMs: 800,
    },
    // Camera flies to the user's position — "here's where YOU belong"
    {
      command: { type: 'flyToPosition', target: userPosition, distance: 3.5, duration: 2.0 },
      delayMs: 400,
    },
    // Neighborhood DReps glow with match intensity
    {
      command: {
        type: 'highlight',
        alignment,
        threshold: 9999,
        topN: 15,
        drepOnly: true,
        noZoom: true,
        scanProgressOverride: 0.15,
      },
      delayMs: 1500,
    },
    // Gentle pullback to show the neighborhood
    {
      command: {
        type: 'cinematic',
        state: { orbitSpeed: 0.003, dollyTarget: 6, dimTarget: 0.3, transitionDuration: 1.5 },
      },
      delayMs: 800,
    },
  ];

  return {
    type: 'sequence',
    steps: [...baseSteps, ...spatialSteps],
  };
}

// ---------------------------------------------------------------------------
// Cleanup: restore globe to normal
// ---------------------------------------------------------------------------

export function buildMatchCleanupSequence(): GlobeCommand {
  return {
    type: 'sequence',
    steps: [
      {
        command: {
          type: 'cinematic',
          state: { orbitSpeed: 0, dollyTarget: 14, dimTarget: 0, transitionDuration: 1.0 },
        },
        delayMs: 0,
      },
      { command: { type: 'clear' }, delayMs: 300 },
      { command: { type: 'setRotation', speed: 1 }, delayMs: 400 },
      { command: { type: 'reset' }, delayMs: 600 },
    ],
  };
}
