# Homepage Seneca + Globe Match Flow — Session Handoff

## What This Is

A complete context document for continuing work on the Governada homepage's Seneca AI companion + 3D globe constellation integration, specifically the "Find Your DRep" match flow. Written after an extended session that shipped 8 PRs (#682-691) addressing the architecture but with **visual behavior still not confirmed working as expected**.

## The Vision (User's Words)

> "Seneca is the user engagement function and the globe actively visualizes Seneca's thoughts and processing. These are meant to feel very symbiotic and cohesive."

> "The user should feel as-if they were using Cerebro from X-men to search for and locate their match within the constellation."

Key behaviors the user expects:

1. **Universal focus/unfocus**: When Seneca focuses on ANYTHING (match flow, single DRep, proposal, semantic search), unfocused nodes dramatically shrink + fade to near-black. Focused nodes glow and grow.
2. **Progressive narrowing during match**: Q1 shows ~200 DReps, Q2 narrows to ~50, Q3 to ~10, Q4 to ~5. Camera follows the shrinking cluster, approaching from different angles each round.
3. **Graceful #1 match reveal**: After Q4, camera smoothly flies from wherever it was to the #1 match node (dead-center on screen). Profile card appears BELOW the node. No jarring camera resets.
4. **Browsing other matches**: Clicking match #2-5 in the Seneca panel should snappily fly the camera to that node and show its card.
5. **This extends beyond match flow**: Any Seneca activity that involves filtering/highlighting nodes should produce the same Cerebro effect.

## Architecture (Current State)

### Key Files

| File                                          | Purpose                                                                                                    |
| --------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| `components/GlobeConstellation.tsx`           | 3D globe renderer (R3F/Three.js, ~2200 lines). Contains `FocusState`, `NodePoints`, all imperative methods |
| `components/GovernanceConstellation.tsx`      | `ConstellationRef` interface — the imperative API surface                                                  |
| `components/ConstellationScene.tsx`           | Thin forwardRef wrapper around GlobeConstellation                                                          |
| `hooks/useSenecaGlobeBridge.ts`               | `GlobeCommand` types + `executeGlobeCommand()` dispatcher                                                  |
| `lib/globe/matchChoreography.ts`              | Sequence builders for match flow stages                                                                    |
| `components/governada/panel/SenecaMatch.tsx`  | Match quiz UI (4 questions, dispatches choreography)                                                       |
| `components/governada/MatchResultOverlay.tsx` | Portal overlay for focused match card                                                                      |
| `components/synaptic/SynapticHomePage.tsx`    | Authenticated homepage (globe + SynapticBriefPanel)                                                        |
| `components/synaptic/SynapticBriefPanel.tsx`  | Briefing panel that renders SenecaMatch when mode='matching'                                               |
| `components/hub/AnonymousLanding.tsx`         | Anonymous homepage (interactive globe + SenecaMatch)                                                       |
| `app/api/governance/constellation/route.ts`   | Constellation API — returns all nodes for globe                                                            |
| `app/api/governance/quick-match/route.ts`     | Match API — Euclidean distance ranking, returns top 5                                                      |

### Data Flow: Match Command Execution

```
User answers question in SenecaMatch
  → buildAnswerSequence(round, alignment, threshold) [matchChoreography.ts]
  → returns GlobeCommand (type: 'highlight' with topN + scanProgressOverride)
  → sendGlobeCommand() dispatches via:
    1. onGlobeCommand prop callback (if passed)
    2. window.dispatchEvent(new CustomEvent('senecaGlobeCommand', { detail: cmd }))
  → SynapticHomePage listener receives CustomEvent
  → bridge.executeGlobeCommand(cmd)
  → globe.highlightMatches(alignment, threshold, { topN, ... })
  → setSceneState({ focus: { active, focusedIds, intensities, scanProgress, ... } })
  → ConstellationNodes receives focus prop
  → NodePoints recomputes buffers via useMemo
  → useFrame lerps current values toward target (smooth transitions)
```

### FocusState (the universal abstraction — PR #686)

```typescript
interface FocusState {
  active: boolean; // When true, unfocused nodes dim
  focusedIds: Set<string>; // Nodes that glow
  intensities: Map<string, number>; // Per-node glow strength (0-1)
  scanProgress: number; // 0-1, drives progressive fade
  colorOverrides: Map<string, string> | null; // Vote split colors
  nodeTypeFilter: string | null; // e.g., 'drep' during match flow
}
```

Replaced 7 independent dimming systems (dimmed, highlightId, matchedNodeIds, matchIntensities, scanProgress, matchNodeTypeFilter, voteSplitMap colors) with this single state.

### Top-N Matching (PR #691)

Threshold-based matching failed because DRep alignments cluster near center (765 of 866 matched at threshold 120). Changed to top-N ranking:

- Q1: top 200 closest DReps (scanProgress 0.15)
- Q2: top 50 (scanProgress 0.40)
- Q3: top 10 (scanProgress 0.70)
- Q4: top 5 (scanProgress 0.95)

This guarantees progressive narrowing regardless of data distribution.

## What Was Shipped (8 PRs)

| PR   | Title                                                                        | Status |
| ---- | ---------------------------------------------------------------------------- | ------ |
| #682 | Wire Cerebro match choreography — scan sweeps, dive angles, countdown reveal | Merged |
| #683 | Constellation API returns 6 DReps instead of 866 — broken isActive filter    | Merged |
| #684 | Center matched DRep node on screen during flyToMatch reveal                  | Merged |
| #686 | Universal FocusState abstraction for globe node rendering                    | Merged |
| #687 | Three bugs preventing Cerebro dimming and graceful reveal                    | Merged |
| #689 | Ensure focus state triggers buffer recomputation + compact overlay card      | Merged |
| #691 | Replace threshold-based matching with top-N ranking for data-driven camera   | Merged |

## What Is NOT Working (as of end of session)

**The user reports that NONE of the visual changes are visible in production.** Specifically:

1. **Dimming never appears** — unfocused nodes look the same as idle despite FocusState being active. The code sets `focus.active = true` and `isUnfocused` computes correctly in the buffer, but the visual result on screen doesn't change.

2. **Camera doesn't follow match clusters** — despite top-N and centroid computation, the camera behavior appears unchanged. This could be because the `zoomToCluster` camera code in `highlightMatches` may not be executing (it returns early if `noZoom` is true, but the choreography now sends the command directly without wrapping in a sequence).

3. **Reveal transition is jarring** — simplified in PR #687 (removed the dollyTarget pullback), but user still reports it doesn't feel graceful.

4. **Overlay card too large** — compacted in PR #689 (360px, p-4, max-h-50vh) but user reported it still clips behind header.

## Root Cause Hypotheses (NOT YET CONFIRMED)

The visual code looks correct on paper. The most likely causes:

### Hypothesis A: R3F Reconciler Not Triggering Re-renders

The `useMemo` in NodePoints depends on `focus.active`, `focus.focusedIds`, etc. React Three Fiber uses a separate reconciler. State updates via `setSceneState` may not propagate through the R3F component tree the same way as regular React. The buffers might never recompute.

**How to test**: Add a `console.log` inside the `useMemo` callback in NodePoints to verify it fires when focus changes. Or add a visual debug indicator (e.g., turn ALL nodes red when `focus.active` is true) to confirm the state reaches rendering.

### Hypothesis B: The `sequence` Command Handler Creates Timing Issues

The choreography sends commands as `sequence` types. The sequence handler uses `setTimeout` to fire sub-commands. If the globe ref becomes stale between timeouts, commands silently fail (`if (!globe) return`).

**How to test**: Bypass the choreography entirely — dispatch a raw `highlight` command directly from SenecaMatch to see if the globe responds at all.

### Hypothesis C: The `buildAnswerSequence` Now Returns a Raw Command, Not a Sequence

PR #691 changed `buildAnswerSequence` to return a bare `{ type: 'highlight', ... }` instead of `{ type: 'sequence', steps: [...] }`. SenecaMatch dispatches this via `sendGlobeCommand()` which calls `dispatchGlobeCommand()` (CustomEvent). The bridge receives it and calls `executeGlobeCommand()`. This should work — the bridge handles `highlight` commands directly. But verify this path actually executes.

### Hypothesis D: The Per-Frame Lerp Is Too Slow

NodePoints uses exponential smoothing to transition between target and current buffer values. The `fastFactor` for dimming is `1 - Math.pow(0.0001, delta)`. At 60fps, `delta ≈ 0.016`, so `fastFactor ≈ 1 - 0.0001^0.016 ≈ 1 - 0.856 ≈ 0.144`. This means each frame moves 14.4% toward the target — should be visible within ~10 frames (0.17s). This is probably fine but worth checking.

## Debugging Strategy

1. **Start a dev server** — the production deploy cycle is too slow for debugging. Use `npm run dev` and test locally.
2. **Add console.log in NodePoints useMemo** — verify it fires when match starts. Log `focus.active`, `focus.focusedIds.size`.
3. **Add a hard visual test** — when `focus.active` is true, set ALL unfocused nodes to bright RED instead of near-black. If you can't see red nodes, the state isn't reaching rendering.
4. **Bypass choreography** — dispatch `{ type: 'matchStart' }` directly and check if DReps light up and non-DReps dim.
5. **Check the CustomEvent path** — add a log in SynapticHomePage's listener to confirm events are received.

## Alignment Score Data Context

The user asked about alignment score computation. Key findings:

- Alignment scores ARE computed from ALL-TIME voting history (no epoch filter)
- `sync-alignment` Inngest function runs daily, fetches all votes, all proposals
- 6-month half-life temporal decay (older votes weighted less but still count)
- Scores are percentile-normalized (0-100 rank among all DReps)
- The clustering (most DReps near 50) is because percentile normalization compresses the distribution, and many DReps vote similarly on the proposals that have come through
- The top-N approach solves this for the globe — it always finds the N _relatively_ closest matches

## Key Constants

| Constant                  | Value                  | Location               |
| ------------------------- | ---------------------- | ---------------------- |
| `TOP_N_PER_ROUND`         | [200, 50, 10, 5]       | matchChoreography.ts   |
| `SCAN_PROGRESS_PER_ROUND` | [0.15, 0.4, 0.7, 0.95] | matchChoreography.ts   |
| `DIVE_ANGLES`             | [0.5, -0.8, 0.2, 0]    | matchChoreography.ts   |
| `DIVE_ELEVATIONS`         | [0.3, 0, -0.25, 0]     | matchChoreography.ts   |
| `DEFAULT_ROTATION_SPEED`  | 0.005                  | GlobeConstellation.tsx |
| `MATCH_COLOR`             | '#f59e0b' (amber)      | GlobeConstellation.tsx |
| `POINT_SCALE`             | varies by quality tier | GlobeConstellation.tsx |

## User Feedback Patterns

- The user wants **world-class**, not incremental — they explicitly approved the full FocusState refactor
- They expect the globe to be **functional navigation**, not decoration
- "Cerebro" is the persistent analogy — the globe should feel like a brain scanning for and locating specific nodes
- The user is testing as an authenticated Citizen (not anonymous) on `governada.io`
- Dev server wasn't working during this session so all testing was via production deploys (slow feedback loop)

## Recommended Next Steps

1. **Get a dev server running** — `npm run dev` is essential for fast iteration
2. **Verify the focus state reaches NodePoints** — this is the #1 unknown
3. **If focus state IS reaching NodePoints but nodes don't dim**, the issue is in the Three.js shader/material pipeline (buffer attributes not being pushed to GPU)
4. **If focus state is NOT reaching NodePoints**, trace the React component tree update path through the R3F Canvas
5. **Once dimming works**, verify camera movement with the top-N approach
6. **Then polish**: reveal transition, overlay card positioning, glory ring subtlety
