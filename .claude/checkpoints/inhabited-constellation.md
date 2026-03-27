# Inhabited Constellation — Build Checkpoint

## Plan File

`C:\Users\dalto\.claude-personal\plans\valiant-brewing-zephyr.md`

## Current State

**Phase 1 COMPLETE. Phase 2 is next.**

Deploy verifier was launched but may not have reported back yet. First action for new agent: verify `https://governada.io/g` returns 200, then proceed to Phase 2.

## Completed Phases

### Phase 0: Seneca Unification — MERGED (PR #630)

- Unified Seneca state, deleted dead code, fixed homepage rendering

### Phase 1: Globe URL State + Route Foundation — MERGED (PR #632)

- Created `/g/` route namespace with entity sub-routes
- `lib/globe/urlState.ts` — URL state encode/decode (focus, zoom, filter, sector, view, temporal)
- `components/globe/GlobeLayout.tsx` — Full-viewport globe client component with Seneca
- `app/g/layout.tsx` — Layout wrapping GlobeLayout with Suspense fallback
- `app/g/page.tsx` — Globe home with SSR governance stats
- `app/g/drep/[drepId]/page.tsx` — DRep focus with SSR profile data
- `app/g/proposal/[txHash]/[index]/page.tsx` — Proposal focus with SSR
- `app/g/pool/[poolId]/page.tsx` — Pool focus with SSR
- `app/g/cc/[ccHotId]/page.tsx` — CC member focus with SSR
- `hooks/useSenecaThread.ts` — Extended route detection for /g/ paths
- `components/governada/GovernadaShell.tsx` — Globe mode: hides background globe, footer, bottom nav, SenecaOrbAndThread (GlobeLayout provides its own)

## Key Architecture Decisions

- SSR content rendered as `sr-only` inside GlobeLayout (hidden from visual users, visible to crawlers)
- GlobeLayout manages its own Seneca orb/thread (GovernadaShell suppresses its copy in globe mode)
- Node clicks navigate to `/g/[entity]` routes using Next.js router
- Globe flyTo triggered on route change via `deriveEntityFocusFromPath()` helper
- URL state module (`lib/globe/urlState.ts`) ready for Phase 3 filtering but not yet wired to globe state
- GovernadaShell detects `isGlobeMode` via `pathname === '/g' || pathname.startsWith('/g/')` — applies: no background globe, no footer, no bottom nav, no SectionTransition, negative margin to pull content behind transparent header

## Next Phase: 2 (Panel Overlay System)

From the plan file:

**Goal:** Floating detail panels that render OVER the globe, replacing separate detail pages.

### New Components to Build

- `components/globe/PanelOverlay.tsx` — Container for entity detail panels. Fixed position, right-aligned on desktop, bottom sheet on mobile. Glassmorphic backdrop. Dismissible.
- `components/globe/ProposalPanel.tsx` — Proposal detail in panel form. Reuses: ProposalVerdictStrip, LivingBrief, VoteAdoptionCurve, ProposalVoterTabs (condensed).
- `components/globe/DRepPanel.tsx` — DRep detail in panel form. Reuses: DRepProfileHero (compact), ScoreCard, AlignmentTrajectory, DRepProfileTabsV2 (condensed).
- `components/globe/PoolPanel.tsx` — Pool detail in panel. Reuses: SpoProfileHero (compact), score, votes.
- `components/globe/CCMemberPanel.tsx` — CC member detail in panel.
- `components/globe/PanelTransition.tsx` — Animated panel enter/exit (slide from right on desktop, slide up on mobile).

### Panel ↔ Globe Sync

- Selecting an entity in a panel highlights its node on the globe
- Globe `flyToNode` called when panel opens
- Panel close restores previous camera position
- Panel supports "related entities" links that navigate the globe

### Panel Architecture

```
GlobeLayout
  ├── ConstellationScene (full viewport, z-0)
  ├── PanelOverlay (fixed right, z-30)
  │   └── [ProposalPanel | DRepPanel | PoolPanel | CCMemberPanel]
  ├── SenecaThread (floating, z-40)
  └── GlobeControls (filter chips, zoom, list toggle — z-20)
```

### Key Files to Study

- `components/globe/GlobeLayout.tsx` — WHERE panels will be rendered (add PanelOverlay at z-30)
- `components/governada/panel/GovernancePanel.tsx` — existing panel patterns (can reference for layout)
- `components/governada/peeks/PeekDrawer*.tsx` — existing peek drawer pattern (glassmorphic, slide-in)
- `components/governada/profiles/DRepProfileClient.tsx` — DRep profile layout to condense
- `components/governada/proposals/ProposalHeroV2.tsx` — proposal hero to condense
- `components/governada/profiles/SpoProfileClient.tsx` — SPO profile to condense
- `components/governada/peeks/DRepPeek.tsx` — existing compact DRep card (good reference)
- `components/governada/peeks/ProposalPeek.tsx` — existing compact proposal card
- `components/governada/peeks/PoolPeek.tsx` — existing compact pool card
- `components/governada/peeks/CCMemberPeek.tsx` — existing compact CC member card

### Validation Checklist (Phase 2)

- Dev server: click a node on the globe → panel slides in with entity details
- Dev server: panel content matches existing detail pages (no missing data)
- Dev server: close panel → globe returns to previous view
- Dev server: click "related entity" link in panel → globe navigates, new panel opens
- Dev server: mobile — panel renders as bottom sheet, swipe to dismiss
- Dev server: panel + globe behind it both visible (glassmorphic transparency)
- `npm run preflight` passes

## Remaining Phases After Phase 2

### Phase 3: List Overlay + Filtering

- Translucent entity list overlaying globe (left side)
- Filter chips, sort, hover→highlight node, click→detail panel
- Wire URL state (urlState.ts) to globe filters

### Phase 4: Seneca Intent Routing

- Seneca queries → globe state changes ("show me proposals" → filter, "show drep X" → flyTo)
- Intent detection in advisor.ts, executeIntent in useSenecaThread

### Phase 5: Mobile Adaptation

- 2D constellation fallback for low-end devices
- Touch-optimized controls

### Phase 6: Migration + Cleanup

- Redirect old /governance/\* routes to /g equivalents
- Delete dead discover components
- Update navigation config
