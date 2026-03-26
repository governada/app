# Cockpit Build — Progress Checkpoint

## Status: Phases 0-3B+6 Complete, Phases 4-5+7-13 Remaining

## Plan Location

`C:\Users\dalto\.claude-personal\plans\cozy-noodling-neumann.md`

## Completed Phases

### Phase 0: Foundation Store & Types ✅

- `stores/cockpitStore.ts` — Zustand store with all state fields + actions
- `lib/cockpit/types.ts` — CockpitOverlay, ActionRailItem, BootSequenceStep, NodeEnrichment, BOOT_SEQUENCE
- `lib/cockpit/overlayConfigs.ts` — OVERLAY_CONFIGS, OVERLAY_ORDER, SHORTCUT_TO_OVERLAY

### Phase 1: Cockpit Shell + Status Strip ✅

- `components/cockpit/CockpitHomePage.tsx` — Main orchestrator: full viewport globe, HUD overlay container, boot sequence, mobile detection, node hover, governance state density
- `components/cockpit/StatusStrip.tsx` — Top HUD bar: epoch progress, temperature gauge, urgent count, sound toggle, density-responsive
- `components/hub/HubHomePage.tsx` — Swapped InhabitedConstellation for CockpitHomePage behind globe_homepage_v2 flag

### Phase 2A: Seneca Strip ✅

- `components/cockpit/SenecaStrip.tsx` — Single-line AI insight bar: boot typewriter, 30s rotation, hover-reactive, dead-time discovery, briefing-as-choreography
- `hooks/useSenecaStrip.ts` — Data hook: fetches from /api/intelligence/context, rotation, dead-time detection

### Phase 2B: Action Rail ✅

- `components/cockpit/ActionRail.tsx` — Left-edge vertical rail: 3-5 cards, overlay-filtered, stagger entrance
- `components/cockpit/ActionRailCard.tsx` — Glassmorphic card: priority pip, deadline, action button, hover→globe pan, completion animation
- `hooks/useCockpitActions.ts` — Enhanced action queue: overlay filtering, globe node ID mapping, completion tracking

### Phase 2C: Overlay Tabs ✅

- `components/cockpit/OverlayTabs.tsx` — Bottom-center tab bar: 4 tabs, keyboard 1-4, Framer Motion active indicator, boot slide-up

### Phase 6: Sound Design ✅

- `hooks/useGovernadaSound.ts` — Procedural Web Audio: ambient drone, crystalline ping, click, whoosh. Opt-in, temperature-modulated.

## Current Branch

`claude/hungry-kowalevski` (worktree)

## Commits So Far

1. `26d4529c` — Phase 0+1: Foundation store, types, shell, status strip
2. `b60d186d` — Phase 2A+2B+2C+6: Seneca strip, action rail, overlay tabs, sound
3. `469d9431` — Phase 3A partial: globe overlay color mode + urgent node IDs
4. `663429b2` — Phase 3B: enhanced tooltip with action buttons, visited, social

### Phase 3A: Globe Overlay Color Mode ✅ (partial)

- `GlobeConstellation.tsx` — Added `overlayColorMode` and `urgentNodeIds` props
- Overlay-aware color callbacks: urgent dims non-actionable nodes, proposals dims non-proposals, network dims proposals
- Props threaded from main component → ConstellationNodes → color callbacks
- **Still needed in 3A**: urgency PULSING (animated emissive cycling in useFrame), visited ring shader (aVisited attribute), social shimmer shader, personalized gravity in globe-layout.ts

### Phase 3B: Enhanced Tooltip ✅

- `GlobeTooltip.tsx` — Added action buttons per entity type, visited chip, social presence count, cockpit store hover sync

## Remaining Phases (in priority order)

### HIGHEST PRIORITY:

- **Phase 5**: Transition Cinematics + Detail Panel — THE critical missing piece for the DRep narrative. Create `CockpitDetailPanel.tsx` (right-side panel with peek content + "Open in Studio →" button). Enhance `GlobeConstellation.flyToNodeImpl` for coordinated 600ms zoom. Wire panel opening from node click.

### HIGH PRIORITY:

- **Phase 3A completion**: Add urgency pulsing (useFrame animation), visited ring (shader attribute), personalized gravity (globe-layout.ts modification). Currently only overlay coloring is done.
- **Phase 9**: Boot Choreography — finalize cascade timing, sync Seneca boot narration with HUD entrance
- **Phase 10**: Completion Feedback — detect vote completion on window focus, trigger card animation + node green flash

### MEDIUM PRIORITY:

- **Phase 4**: Network Edges — `NetworkEdges.tsx` R3F component + API route
- **Phase 7**: Temporal Scrubbing — `TemporalScrubber.tsx` + historical data hook
- **Phase 8**: Mobile Cockpit — `CockpitMobile.tsx` + mobile-specific components

### LOWER PRIORITY:

- **Phase 11**: Accessibility — `CockpitTextMode.tsx`, ARIA, keyboard nav, GPU fallback

### LAST:

- **Phase 12**: Chrome Verification (16 checkpoints)
- **Phase 13**: Adversarial Review

## Key Integration Points for Next Agent

- `CockpitHomePage.tsx` has all HUD components integrated (StatusStrip, SenecaStrip, ActionRail, OverlayTabs)
- `StatusStrip.tsx` has `{/* Phase 7: TemporalScrubber will go here */}` comment
- `GlobeConstellation.tsx` has `overlayColorMode` + `urgentNodeIds` props but NOT yet: urgency pulsing, visited ring shader, social shimmer, personalized gravity
- `GlobeTooltip.tsx` is fully enhanced with action buttons, visited chip, social presence
- `CockpitHomePage.tsx` needs Phase 5 addition: `CockpitDetailPanel` integration for node click → panel slide-in → "Open in Studio" flow
- The `ConstellationScene` wrapper (used by CockpitHomePage) needs the new props threaded through — check if `overlayColorMode` and `urgentNodeIds` are passed from CockpitHomePage → ConstellationScene → GlobeConstellation

## How to Resume

1. Read this checkpoint and the plan at `C:\Users\dalto\.claude-personal\plans\cozy-noodling-neumann.md`
2. Verify current state: `cd C:\Users\dalto\governada\governada-app\.claude\worktrees\hungry-kowalevski && git log --oneline -6`
3. **Start with Phase 5** (Detail Panel + Cinematics) — it's the most critical for the DRep narrative flow
4. Then Phase 9 (Boot Choreography) and Phase 10 (Completion Feedback) to nail the narrative
5. After each phase: typecheck (`npx tsc --noEmit`), commit, update this checkpoint
6. When all phases done: push, create PR, run Chrome verification (Phase 12), then adversarial review (Phase 13)
