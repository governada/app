# Build Step: Globe Convergence — Conversational Matching Frontend

**Status:** PHASE_3_DECISION_GATE
**Started:** 2026-03-20
**Scope:** Hero-embedded conversational matching with live globe convergence

## Phase 1 Summary

- **Vision Analysis**: 42 requirements, 8 decision points, 1 critical conflict (route architecture)
- **Codebase Scout**: 95% infrastructure exists. Backend matching engine complete. Globe supports extensible node highlighting. Main work is UI assembly.
- **Audit Pre-Screen**: 7 dimensions affected, 8 critical quality gates

## Key Findings

1. Backend conversational matching is production-ready (state machine, quality gates, semantic search, 30 tests)
2. Globe already has alignment data per node + highlight/dim/pulse system — adding match visualization is additive, not architectural
3. Current homepage hero has ConstellationScene at 50vh with two CTA cards below — pills replace the cards
4. Shader system uses buffer attributes (`aDimmed`, `aSize`, `aNodeColor`) — adding `aMatchIntensity` follows exact same pattern
5. Identity/personality system (`drepIdentity.ts`) has archetype names, colors, and classification ready
6. View Transitions API + Framer Motion layout animations already in codebase — hero morph is a matter of wiring, not inventing

## Decisions Needed (Phase 3)

See architecture plan below — each chunk has decision points flagged.

## Phase 1 Detail Files

- Vision: see agent output (42 requirements documented)
- Codebase: see agent output (API contracts, shader system, integration points mapped)
- Audit: see agent output (7 dimensions, per-chunk quality targets, 8 quality gates)

---

# Architecture Plan — Globe Convergence

## Execution Principles

1. **Chunks are PR-sized.** Each chunk = 1 PR. Max ~500 lines changed.
2. **Foundation first.** Shared hooks/components before page integration.
3. **Globe integration is additive.** Never break existing constellation rendering.
4. **Feature-flagged from day one.** `conversational_matching` gates new flow; old quiz remains as fallback.
5. **Mobile-first.** Every chunk includes responsive design — not a separate "mobile pass."

---

## Chunk 1: Conversational Match Hook + Pill Components

**Priority:** P0 (critical — foundation for everything)
**Effort:** L (3-8 hours)
**Audit dimensions:** Intelligence & Data, Conversion & Onboarding
**Expected score impact:** Intelligence: 6→7 (+1), Conversion: 5→6 (+1)
**Depends on:** None
**PR group:** A

### Context

The backend API exists (`/api/governance/match-conversation`) but has no frontend consumer. We need a React hook that manages the conversational state machine (start → answer → answer → match) and pill UI components that render the questions.

### Scope

**Create:**

- `hooks/useConversationalMatch.ts` — manages session lifecycle
  - `startSession()` → calls API action "start", stores sessionId
  - `submitAnswer(selectedPillIds: string[], rawText?: string)` → calls API action "answer"
  - `getMatches()` → calls API action "match"
  - State: `round`, `question`, `qualityGates`, `status`, `preview`, `matches`, `isLoading`, `error`
  - Confidence percentage derived from quality gates
  - localStorage persistence: save partial progress so refresh doesn't lose state
  - Auto-detects "ready_to_match" status from API response

- `components/matching/PillCloud.tsx` — governance topic pill cloud
  - Props: `pills: {id, text, selected}[]`, `onSelect(id)`, `multiSelect: boolean`, `layout: 'cloud' | 'grid'`
  - Visual: frosted glass chips (use existing `glass` variant from design system)
  - Animation: spring entrance stagger, selection glow (Compass Amber accent)
  - Responsive: cloud layout on desktop, wrapped grid on mobile
  - Accessibility: keyboard navigable (arrow keys between pills, Space/Enter to toggle)

- `components/matching/ConfidenceRing.tsx` — circular progress indicator
  - Props: `confidence: number (0-100)`, `label?: string`
  - Visual: SVG circular progress, Compass Teal fill, percentage in Fraunces display
  - Animation: spring transition on value change
  - Text: "25% confident" / "Ready to match!" at 100%

- `components/matching/ConversationalRound.tsx` — single question card
  - Props: `question`, `onAnswer`, `roundNumber`, `totalRounds`
  - Layout: question text + pill cloud + optional text input + "Next" CTA
  - One-card-at-a-time with AnimatePresence exit/enter
  - Freeform text area: expandable, 500 char limit, rotating ghost text
  - Mobile: full-width, large touch targets (44px min)

### Decision Points

None — execute directly. API contract is defined, component patterns exist in codebase.

### Verification

- `useConversationalMatch` hook: start → answer → answer → match cycle works end-to-end
- Pills render, multi-select works, keyboard navigation works
- Confidence ring updates on each round
- Mobile responsive at 375px, 414px, 768px, 1024px breakpoints
- Preflight passes (lint, types, format)

### Files to Read First

- `lib/matching/conversationalMatch.ts` (types + state machine)
- `lib/matching/conversationalPillGenerator.ts` (question/pill definitions)
- `app/api/governance/match-conversation/route.ts` (API contract)
- `hooks/useQuickMatch.ts` (existing pattern to follow)
- `lib/matchStore.ts` (localStorage persistence pattern)
- `components/ui/` (existing component patterns, glass variant)

---

## Chunk 2: Globe Match Highlighting

**Priority:** P0 (critical — the differentiator)
**Effort:** L (3-8 hours)
**Audit dimensions:** Emotional Impact, Visual Craft, Performance
**Expected score impact:** Emotional Impact: 5→8 (+3), Visual Craft: 7→8 (+1)
**Depends on:** None (can be built in parallel with Chunk 1)
**PR group:** B

### Context

The globe already renders 200-800 governance nodes with alignment data. We need to add a `highlightMatches()` method that colors nodes based on alignment distance to the citizen's emerging profile, creating the "globe convergence" effect.

### Scope

**Modify:**

- `components/GlobeConstellation.tsx`:
  - Add `MATCH_COLOR` constant: warm amber `#f59e0b` (distinct from teal DRep, purple SPO, gold CC)
  - Add `matchedNodeIds: Set<string>` and `matchIntensities: Map<string, number>` to SceneState
  - Add `highlightMatches(userAlignment: number[], threshold: number)` to ConstellationRef
    - Computes 6D Euclidean distance between `userAlignment` and each node's `alignments[]`
    - Nodes within threshold get added to `matchedNodeIds` with intensity = `1 - (distance / maxDistance)`
    - Non-matched nodes get `aDimmed = 1.0` (existing dim system)
  - Add `clearMatches()` to ConstellationRef (resets to default colors)
  - Modify `NodePoints` buffer computation:
    - When `matchedNodeIds.size > 0`: matched nodes get `MATCH_COLOR` blended with original color by intensity
    - Matched nodes get subtle size increase (1.2x) for emphasis
    - Non-matched nodes dim to 15% opacity (existing behavior)
  - Add smooth camera drift: when matches update, gently rotate globe to center the matched cluster centroid

- `lib/constellation/types.ts`:
  - Add `highlightMatches` and `clearMatches` to ConstellationRef interface

**Performance constraints:**

- Distance computation for 800 nodes must complete in <5ms (simple Euclidean, no allocation)
- Buffer updates batched (one geometry.attributes.needsUpdate per round, not per node)
- No new render passes (reuse existing bloom)

### Decision Points

**Match color choice**: Should matched nodes be:

- A) Warm amber `#f59e0b` (distinct from all existing colors, warm/inviting)
- B) Bright white `#ffffff` (maximum contrast, "lit up" feeling)
- C) Identity color of citizen's dominant dimension (personalized)

**Recommendation:** A (amber) for Phase 1. It's distinct, warm, and works with bloom. Can evolve to C (identity-colored) in a polish pass.

### Verification

- Call `highlightMatches([80, 20, 70, 30, 60, 90], 150)` → ~200 nodes light up amber
- Call `highlightMatches([80, 20, 70, 30, 60, 90], 80)` → ~30 nodes light up amber
- Non-matched nodes visibly dim
- No frame rate drops on low-end GPU (test with `quality = 'low'`, 200 nodes)
- `clearMatches()` restores original colors
- Camera drift toward matched cluster centroid is smooth (0.8s transition)
- Existing `findMe`, `flyToNode`, `pulseNode` still work correctly

### Files to Read First

- `components/GlobeConstellation.tsx` (full file — shaders, buffers, SceneState)
- `lib/constellation/types.ts` (ConstellationRef interface)
- `lib/constellation/globe-layout.ts` (node positioning)

---

## Chunk 3: Hero Embedding + Conversational Flow Integration

**Priority:** P0 (critical — the user-facing experience)
**Effort:** L (3-8 hours)
**Audit dimensions:** Conversion & Onboarding, Emotional Impact, Mobile & Responsive
**Expected score impact:** Conversion: 6→8 (+2), Emotional Impact: 8→9 (+1)
**Depends on:** Chunk 1 (hook + pills) and Chunk 2 (globe highlighting)
**PR group:** C

### Context

This is the integration chunk — wiring the conversational UI into the homepage hero, connecting it to the globe, and implementing the hero morph animation. This is where the vision comes together.

### Scope

**Create:**

- `components/matching/ConversationalMatchFlow.tsx` — orchestrator component
  - Uses `useConversationalMatch` hook for state
  - Uses `ConstellationRef` (via ref forwarding from parent) for globe control
  - Manages flow states: `idle` → `matching` → `revealing` → `results`
  - On each answer: calls `highlightMatches()` with updated alignment vector + progressive threshold
  - Threshold progression: round 1 = 180, round 2 = 120, round 3 = 80, round 4 = 50
  - Shows `ConversationalRound` cards with AnimatePresence transitions
  - Shows `ConfidenceRing` advancing per round
  - Freeform text input available alongside pills (secondary, below pills)
  - "Ready to match" auto-prompt when quality gates pass

**Modify:**

- `components/hub/AnonymousLanding.tsx`:
  - Replace two-path CTA cards with `ConversationalMatchFlow` embedded in hero section
  - Hero morph animation: on first pill tap, homepage content below (stats, glass window, social proof) fades to 20% opacity and slides down 40px via Framer Motion `layout` + `animate`
  - Globe expands from 50vh to 65vh (more visual real estate for convergence)
  - "Looking for a stake pool?" secondary text link below the flow (preserves pool discovery path)
  - Feature flag gate: if `conversational_matching` disabled, render old CTA cards

- URL state management:
  - On match start: `history.pushState({}, '', '/#matching')`
  - On results: `history.pushState({}, '', '/#results')`
  - Back button: `popstate` listener reverts to idle state
  - If user navigates directly to `/#matching`, auto-start the flow

**Mobile layout:**

- Pills: wrapped grid (3 per row on 375px, 4 per row on 414px+)
- Globe: top 40% of viewport, fixed position during matching
- Questions: bottom 60%, scrollable
- Full-screen focus: all non-matching content hidden on mobile during flow

### Decision Points

**Hero morph trigger**: When should the homepage content fade?

- A) On first pill tap (immediate commitment signal)
- B) After first round completion (user has invested)

**Recommendation:** A — first pill tap. The visual feedback (globe lighting up + content fading) is the reward for engaging. Waiting until after a full round is too late.

### Verification

- Anonymous user lands on `/`, sees pills in hero, taps one → globe responds, hero morphs
- Full conversational flow works: 2-4 rounds → results
- Back button from `/#matching` returns to idle state
- Feature flag off → old CTA cards render
- Mobile: pills fit on 375px screen, globe stays visible during flow
- Framer Motion transitions are smooth (60fps)
- Pool discovery path still accessible via secondary link
- Preflight passes

### Files to Read First

- `components/hub/AnonymousLanding.tsx` (hero structure)
- `components/hub/HubHomePage.tsx` (page dispatcher)
- Chunk 1 outputs (hook, pill components)
- Chunk 2 outputs (globe highlighting API)
- `lib/featureFlags.ts` (flag checking pattern)

---

## Chunk 4: Governance Identity Card + Match Results

**Priority:** P0 (critical — the payoff)
**Effort:** L (3-8 hours)
**Audit dimensions:** Emotional Impact, Shareability, Visual Craft, Intelligence & Data
**Expected score impact:** Emotional Impact: 9→10 (+1), Conversion: 8→9 (+1)
**Depends on:** Chunk 3 (flow integration)
**PR group:** D

### Context

After matching, the citizen sees their governance identity ("You're a Treasury Guardian") and their top 3 DRep matches + 1 bridge match. This is the emotional peak and the shareable moment.

### Scope

**Create:**

- `components/matching/GovernanceIdentityCard.tsx` — the shareable identity moment
  - Props: `personalityLabel`, `identityColor`, `alignments`, `onShare`
  - Layout: bold card overlaying globe (globe still visible behind, amber nodes glowing)
  - Typography: archetype name in Fraunces 600 at 36-48px (Browse mode)
  - One-line personality summary
  - Mini 6D radar (reuse `GovernanceRadar.tsx` at 120px)
  - Share button → generates canvas screenshot (fixed dimensions for social media)
  - Animation: slide up with spring, identity color glow border
  - Mobile: full-width card, radar below name

- `components/matching/MatchResultCard.tsx` — individual DRep match card
  - Props: `match: MatchResult`, `rank`, `isBridge?: boolean`, `expanded`, `onExpand`, `onDelegate`
  - Default view: DRep name, Governance Rings, match % (Fraunces), 2-3 agree/differ badges, 1-sentence narrative
  - If semantic match: "This DRep wrote: _'[excerpt]'_" quote block
  - Bridge variant: "A different perspective" header, explains disagreement dimension
  - Expanded view: full radar overlay (citizen vs DRep), per-dimension breakdown, confidence bar, "Delegate" CTA
  - Animation: staggered entrance (200ms apart), expand with layout animation
  - Globe fly-to: when card enters viewport, call `pulseNode(drepId)` on globe

- `components/matching/MatchResults.tsx` — results container
  - Shows `GovernanceIdentityCard` first
  - Then 3 `MatchResultCard` components (staggered)
  - Then 1 bridge `MatchResultCard` with distinct styling
  - Bottom CTAs: "Go deeper" | "Explore the globe" | "Delegate now"
  - "Go deeper" leads to full conversational refinement (re-enter flow)
  - "Delegate now" triggers wallet connect flow

**Modify:**

- `lib/matchStore.ts` — persist conversational match results (not just quiz results)
  - Add `conversationalProfile` field alongside existing `answers`
  - Store `personalityLabel`, `identityColor`, `alignments`, `matchResults`

### Decision Points

**Bridge match visual distinction**: How should the bridge card differ visually?

- A) Same card with "Different Perspective" badge (minimal distinction)
- B) Different card color/border (e.g., violet instead of teal)
- C) Card with a "challenge" icon and contrast explanation

**Recommendation:** B — distinct border color (violet or amber) + "Different Perspective" header text. Subtle enough to not feel scary, distinct enough to be noticed.

### Verification

- Identity card shows correct archetype name + radar + identity color
- Share button generates an image at 1200x630px (OG image standard)
- 3 match cards + 1 bridge card render with staggered animation
- Expanded card shows full per-dimension breakdown
- Bridge card visually distinct from top 3
- Globe pulses matched DRep node when card enters viewport
- localStorage persists match results
- "Delegate now" CTA opens wallet connect
- Preflight passes

### Files to Read First

- `lib/drepIdentity.ts` (personality classification, archetype names, colors)
- `components/GovernanceRadar.tsx` (radar component props)
- `components/matching/MatchCard.tsx` (existing match card for patterns)
- `components/matching/ConfidenceBar.tsx` (confidence visualization)
- `lib/matching/dimensionAgreement.ts` (agree/differ logic)
- `lib/matching/matchNarrative.ts` (narrative generation)

---

## Chunk 5: Importance Weighting + Bridge Match Algorithm

**Priority:** P1 (high — match quality improvement)
**Effort:** M (1-3 hours)
**Audit dimensions:** Intelligence & Data
**Expected score impact:** Intelligence: 7→8 (+1)
**Depends on:** Chunk 1 (hook)
**PR group:** E

### Context

Currently all 6 alignment dimensions are weighted equally. Adding importance weighting lets citizens mark dimensions as "Dealbreaker" / "Important" / "Nice to have", and the matching algorithm weights distances accordingly. Bridge match selection logic also lives here.

### Scope

**Create:**

- `components/matching/ImportanceWeighting.tsx` — quick importance card
  - Shows dimensions the citizen expressed opinions on (from quality gates' dimensional coverage)
  - Three drop zones: "Dealbreaker" (3x weight) / "Important" (1x) / "Nice to have" (0.3x)
  - Drag-and-drop OR tap-to-cycle (mobile-friendly)
  - One interaction card, not a multi-step process
  - Default: all dimensions at "Important"

**Modify:**

- `lib/matching/conversationalMatch.ts`:
  - Accept `weights: Record<string, number>` in match action
  - Multiply dimension distances by weight in Euclidean formula
  - Add bridge match selection: after top 3, find highest-scoring DRep with max disagreement on lowest-weighted dimension

- `app/api/governance/match-conversation/route.ts`:
  - Accept `weights` in match action request body
  - Pass to matching function

- `hooks/useConversationalMatch.ts`:
  - Add `setWeights(weights)` method
  - Pass weights to match API call

### Decision Points

None — execute directly. Algorithm is well-defined.

### Verification

- Setting a dimension to "Dealbreaker" changes top match when that dimension disagrees
- Bridge match differs from top 3 on at least one dimension
- Existing matching tests still pass (backward compatible — weights default to 1)
- New tests: weighted distance formula, bridge match selection
- Preflight passes

### Files to Read First

- `lib/matching/conversationalMatch.ts` (matching algorithm)
- `lib/matching/dimensionAgreement.ts` (how agreement is computed)
- `__tests__/matching/conversationalMatch.test.ts` (existing tests)

---

## Chunk 6: Semantic Fast-Track + DRep Quote Integration

**Priority:** P1 (high — maximizes AI embedding potential)
**Effort:** L (3-8 hours)
**Audit dimensions:** Intelligence & Data, Emotional Impact, Differentiation
**Expected score impact:** Intelligence: 8→9 (+1), Emotional Impact: 9→10 (+1)
**Depends on:** Chunks 3 + 4 (flow + results must exist)
**PR group:** F

### Context

The semantic embedding infrastructure exists end-to-end but has no frontend exposure. This chunk enables the `conversational_matching_semantic` flag, wires freeform text to real-time embedding search, and surfaces actual DRep rationale quotes in match results.

### Scope

**Modify:**

- `hooks/useConversationalMatch.ts`:
  - When freeform text is submitted, include in `rawText` field of answer action
  - On match action: if semantic enabled, match results include `matchingRationales[]` with actual DRep quotes
  - Show "Analyzing your governance philosophy..." loading state while embedding runs

- `components/matching/ConversationalMatchFlow.tsx`:
  - Text input sends accumulated text to API on each round
  - When semantic results return, globe highlighting also accounts for semantic matches (additional node IDs from semantic results)
  - Processing animation: citizen's text appears center-screen, governance concepts light up around it as "extracted meaning" visual

- `components/matching/MatchResultCard.tsx`:
  - When `match.matchingRationales` exists, show quote block: "This DRep wrote: _'[excerpt]'_"
  - Quote block styled as a pullquote (italic, left border, attribution)
  - Max 1 quote per match card (highest similarity)

- `components/matching/ConversationalRound.tsx`:
  - Enhance freeform text input: make it more prominent (not just secondary)
  - Add rotating ghost text examples: "I care about...", "Cardano should...", "The treasury needs..."
  - Show character count (max 500)

**Enable:**

- Enable `conversational_matching_semantic` feature flag for production

### Decision Points

**Semantic matching weight**: How much should semantic similarity count vs. alignment distance?

- Current backend default: 60% alignment + 40% semantic
- Keep this or adjust?

**Recommendation:** Keep 60/40 — the backend default is reasonable. Alignment is more structured; semantic adds nuance. Can tune later with A/B data.

### Verification

- Type "I believe Cardano's treasury should fund open-source developer tools" → matches include DReps who wrote about developer funding (semantic match)
- Same text produces different matches than tapping "Treasury Growth" pill alone
- DRep quotes appear in match cards when semantic matching is active
- Processing animation shows during embedding (< 2s)
- Fallback: if embedding fails, fall back to pure alignment matching (no error shown to user)
- Existing non-semantic flow still works when text field is empty
- Preflight passes

### Files to Read First

- `lib/embeddings/provider.ts` (how to embed text)
- `lib/embeddings/query.ts` (how to search)
- `app/api/governance/match-conversation/route.ts` (semantic matching code path)
- `lib/matching/conversationalMatch.ts` (hybrid scoring)

---

## Chunk 7: Analytics + Feature Flag Rollout + Polish

**Priority:** P2 (medium — measurement + final polish)
**Effort:** M (1-3 hours)
**Audit dimensions:** All (cross-cutting)
**Expected score impact:** Conversion measurement, performance baselines
**Depends on:** All previous chunks
**PR group:** G

### Context

Final polish, analytics instrumentation, and production rollout of the feature flag.

### Scope

**Modify:**

- PostHog events (follow `noun_verb` convention):
  - `match_started` (entry: 'hero_pill' | 'hero_text' | 'match_page')
  - `match_round_completed` (round, confidence, pills_selected, has_text)
  - `match_completed` (rounds, confidence, used_semantic, top_match_score)
  - `identity_card_viewed` (archetype)
  - `identity_card_shared` (archetype, platform)
  - `match_result_expanded` (rank, drep_id)
  - `match_delegate_clicked` (rank, drep_id, match_score)

- `/match` route redirect: if `conversational_matching` flag enabled, redirect anonymous visitors to `/#matching` on homepage

- `prefers-reduced-motion` respect: all animations degrade to instant transitions

- Accessibility pass:
  - All pills have `role="checkbox"` + `aria-checked`
  - Confidence ring has `role="progressbar"` + `aria-valuenow`
  - Match cards have `role="article"` + heading hierarchy
  - Globe state changes announced via `aria-live="polite"` region

- Performance: lazy-load `ConversationalMatchFlow` (dynamic import, not in initial bundle)

- Enable `conversational_matching` flag in production (gradual rollout: admin → 10% → 50% → 100%)

### Decision Points

None — execute directly.

### Verification

- PostHog events fire at each step (verify in PostHog debugger)
- `/match` redirects to `/#matching` when flag enabled
- Screen reader announces pill selections and confidence changes
- `prefers-reduced-motion` disables spring animations
- Bundle size increase < 50KB gzipped
- Lighthouse Performance > 85, Accessibility > 90 on mobile
- Preflight passes
- Smoke test passes on production

### Files to Read First

- `lib/analytics.ts` or PostHog integration files
- `lib/featureFlags.ts` (flag management)
- `app/match/page.tsx` (redirect logic)

---

## Merge Sequence

```
Phase 1 (parallel):
  Chunk 1 (Hook + Pills)     ──┐
  Chunk 2 (Globe Highlighting) ┘── can build simultaneously

Phase 2 (sequential):
  Chunk 3 (Hero Embedding)    ── depends on 1 + 2

Phase 3 (parallel after 3):
  Chunk 4 (Identity + Results) ──┐
  Chunk 5 (Importance + Bridge)  ┘── can build simultaneously after 3

Phase 4 (sequential):
  Chunk 6 (Semantic Fast-Track) ── depends on 3 + 4

Phase 5 (final):
  Chunk 7 (Analytics + Polish) ── depends on all
```

**Estimated total: 7 PRs, ~4 build phases**

---

## Assumption Challenges

| Assumption                          | Challenge                                 | Mitigation                                                                                  |
| ----------------------------------- | ----------------------------------------- | ------------------------------------------------------------------------------------------- |
| Citizens will type freeform text    | Most may prefer tapping pills             | Pills are primary; text is always optional. Semantic value compounds for those who do type. |
| Globe convergence is visible enough | On mobile 200 nodes, amber may be subtle  | Test on real devices. Increase matched node size to 1.4x. Bloom makes amber glow.           |
| 4 rounds max is enough signal       | Some citizens may want deeper exploration | "Go deeper" CTA after results re-enters flow for refinement                                 |
| Hero morph won't confuse users      | Users expect stable homepages             | Transition is smooth + reversible (back button). A/B test via feature flag.                 |
| Semantic latency < 2s               | OpenAI embedding API could spike          | Fallback to pure alignment. Globe convergence IS the loading animation.                     |

---

## World-Class vs. Solid Choices

| Element              | Solid (7/10)                       | World-Class (9+/10)                                                   | Default     |
| -------------------- | ---------------------------------- | --------------------------------------------------------------------- | ----------- |
| Pill interaction     | Static grid, tap to select         | Frosted glass cloud, spring animations, selection glow                | World-class |
| Globe convergence    | Highlight/dim nodes                | Graduated intensity, amber glow, camera drift to cluster              | World-class |
| Identity reveal      | Text card with archetype name      | Bold visual card, radar, shareable OG image                           | World-class |
| Match results        | List of DRep cards                 | Staggered entrance, DRep quotes, globe fly-to per card                | World-class |
| Bridge match         | 4th card in same style             | Distinct styling, explicit "different perspective" framing            | World-class |
| Importance weighting | Equal weights (skip card)          | Drag/tap zones: Dealbreaker/Important/Nice-to-have                    | World-class |
| Semantic fast-track  | Text field exists but no embedding | Real-time embedding, DRep quotes, different matches for text vs pills | World-class |
| Mobile               | Functional but cramped             | Globe stays visible, full-screen focus, touch-optimized               | World-class |

**Recommendation: World-class on ALL elements.** This is the conversion funnel — the first thing citizens see. There is no "solid is fine" option for the front door.
