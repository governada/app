# Unified Homepage Refactor — Checkpoint

**Last updated**: 2026-03-29
**Master plan**: `.claude/checkpoints/unified-homepage-plan.md`

## Current State

### PRs

| PR   | Status      | Branch                  | Description                                                       |
| ---- | ----------- | ----------------------- | ----------------------------------------------------------------- |
| #740 | **MERGED**  | `feat/three-worlds-nav` | Nav simplification: remove Governance + Match from nav            |
| PR 2 | Not started | —                       | Route consolidation: `/g` and `/match` redirects                  |
| PR 3 | Not started | —                       | Homepage unified: URL params, EntityDetailSheet, DiscoveryOverlay |
| PR 4 | Not started | —                       | Cleanup: remove deprecated components                             |

### What's Done (PR 1)

- `lib/nav/config.ts`: Removed Governance section from sidebar. Renamed `GOVERNANCE_ITEMS` → `HOME_DISCOVERY_ITEMS` with `/?filter=` hrefs. Simplified all bottom bar configs (anon: 1 item, auth: 2-3). Updated `getPillBarItems()` to show discovery items on homepage. Updated `getCurrentSection()` to map `/g*`, `/governance*`, `/match*` to `'home'`. Updated `SECTION_METRIC_KEYS`.
- `components/governada/NavigationRail.tsx`: Removed `G G` shortcut. Updated docstring from "Four Worlds" to "Three Worlds".
- `docs/strategy/context/world-class-patterns.md`: Added 4 patterns (Bloomberg ASKB, Apple Maps Explore, Figma Canvas, Arc Command Bar).

### What's NOT Done

**PR 2 — Route Consolidation** (S effort):

- Convert `/g` routes to redirects → `/` (with `?entity=` params) or `/drep/[id]` etc.
- Convert `/match/page.tsx` to redirect → `/?match=true`
- Update `GovernadaShell.tsx`: remove `isGlobeMode` detection and `/g`-specific special casing
- Update governance redirect pages to point to `/?filter=` instead of `/g?filter=`
- Files: `app/g/page.tsx`, `app/g/layout.tsx`, `app/g/drep/[drepId]/page.tsx`, `app/g/proposal/*/page.tsx`, `app/g/pool/*/page.tsx`, `app/g/cc/*/page.tsx`, `app/match/page.tsx`, `app/governance/page.tsx`, `app/governance/proposals/page.tsx`, `app/governance/representatives/page.tsx`, `app/governance/pools/page.tsx`, `app/governance/committee/page.tsx`, `app/governance/health/page.tsx`, `app/governance/leaderboard/page.tsx`, `app/governance/treasury/page.tsx`, `components/governada/GovernadaShell.tsx`

**PR 3 — Homepage Unified Experience** (M effort):

- `app/page.tsx`: Add URL param handling (`?filter=`, `?entity=`, `?match=`)
- `components/hub/HubHomePage.tsx`: Accept and dispatch filter/entity/match params
- `components/synaptic/SynapticHomePage.tsx`: Make globe interactive alongside Seneca (`interactive={true}`), handle filter/entity/match params, make briefing panel dismissible
- `components/hub/AnonymousLanding.tsx`: Handle filter/entity/match params
- New `components/hub/EntityDetailSheet.tsx`: Bottom sheet (mobile) / right panel (desktop), reuses `DRepGlobePanel`, `ProposalGlobePanel`, `PoolGlobePanel`, `CCMemberGlobePanel` content
- New `components/hub/DiscoveryOverlay.tsx`: Entity card list for active filters, desktop left panel / mobile bottom sheet, uses `useDReps()`, `useProposals()`, `usePools()`, `useCommitteeMembers()`
- `components/synaptic/SynapticBriefPanel.tsx`: Add discovery + match chips
- `hooks/useSenecaGlobeBridge.ts`: Wire browse/focus intents to URL param updates

**PR 4 — Cleanup** (S effort):

- Remove: `GlobeLayout.tsx`, `FilterBar.tsx`, `ListOverlay.tsx`, `ListItem.tsx`, `PanelOverlay.tsx`, `GlobeControls.tsx`, `ImmersiveMatchPage.tsx`
- Grep for all links to `/g`, `/governance`, `/match` and update
- Update `derivePageContext()` for new URL structure
- Add `F` (filter cycle) and `L` (discovery toggle) keyboard shortcuts on homepage

### Key Type Signatures

```typescript
// lib/nav/config.ts
HOME_DISCOVERY_ITEMS: NavItem[] — [{href:'/?filter=proposals', label:'Proposals', ...}, ...]
getSidebarSections(ctx: NavContext): NavSection[] — returns 3 sections (home, workspace, you)
getBottomBarItems(segmentOrOpts): NavItem[] — 1-3 items per persona
getPillBarItems(pathname, segment, context): NavItem[] | null — returns HOME_DISCOVERY_ITEMS for '/'

// GlobeConstellation.tsx (ConstellationRef API — existing, untouched)
flyToNode(nodeId: string): void
pulseNode(nodeId: string): void
highlightMatches(alignment[], threshold, options): void
matchStart(): void
matchFlyTo(nodeId: string): void
clearMatches(): void
dimAll(): void
setVoteSplit(voteMap): void
resetCamera(): void

// useSenecaGlobeBridge.ts (existing, untouched)
handleNodeClick(node): void — flyTo + navigate URL
executeGlobeCommand(command: GlobeCommand): void

// GlobeCommand types (existing)
type GlobeCommand = { type: 'flyTo'|'pulse'|'highlight'|'voteSplit'|'reset'|'clear'|'dim'|'matchStart'|'matchFlyTo'|'scan'|'warmTopic'|'sequence'|'setRotation'|'zoomOut'|'flash'|'cinematic', ... }

// panelUtils.ts — deriveEntityFromPath(pathname) extracts entity type + id from URL
// Will need adaptation for URL params (?entity=drep_[id]) in PR 3
```

### Gotchas Discovered

1. The globe does NOT use PCA coordinates — it uses a hand-crafted 6D alignment mapping where each dimension gets a 60° longitude sector. No need to add PCA-to-3D mapping.
2. SynapticHomePage renders the globe with `interactive={false}` — Seneca controls the camera. PR 3 needs to change this to `true` so users can click nodes.
3. Two separate Seneca implementations: `SynapticBriefPanel` (homepage) vs `SenecaThread` in `GlobeLayout` (globe). Unification in PR 3 means the homepage's Seneca handles everything.
4. Most `/governance/*` sub-pages already redirect to `/g?filter=...` — just need to update targets to `/?filter=...`.
5. The worktree has many pre-existing "modified" files from main checkout divergence. Only stage specific files for commits.

## Instructions for Continuing Agent

1. Read this checkpoint FIRST, then read the master plan at `.claude/checkpoints/unified-homepage-plan.md`.
2. Before writing any code, use /start or enter plan mode to build a specific plan for YOUR phase/PR. The master plan gives the overall architecture — you need to plan the detailed implementation for your specific scope.
3. Get user approval on your phase plan before executing.
4. When YOU approach context limits, write an updated checkpoint following this same protocol. Commit it to the main checkout (not the worktree).
5. The checkpoint must be self-sufficient: a fresh agent reading ONLY the checkpoint + the master plan should be able to continue without re-exploring the codebase.
