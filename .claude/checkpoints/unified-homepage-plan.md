# Unified Homepage: Three Worlds Refactor

## Context

Governada has two nearly identical routes (`/` and `/g`) both rendering a full-viewport constellation globe with Seneca AI. The homepage has a sophisticated Seneca briefing panel that streams personalized governance narratives and controls the globe. The `/g` route adds a filter bar, list overlay, and entity detail panels — but these are half-baked (broken links, inaccurate rows, panels compete with Seneca for space). A separate `/match` route runs an immersive matching flow that's also accessible via Seneca on the homepage.

**Goal**: Merge everything into ONE unified experience on `/`. Navigation simplifies from 4 worlds to 3: **Home, Workspace, You**. "Governance" and "Match" nav items are eliminated — Home IS governance exploration + matching + briefing.

---

## Phase 1: Navigation Simplification — Three Worlds

Remove "Governance" and "Match" from navigation. Home absorbs both.

### `lib/nav/config.ts`

- **`getSidebarSections()`**: Remove the Governance section entirely. Return 3 sections: Home, Workspace, You.
- **`getBottomBarItems()`**:
  - Anonymous: `[Home]` — 1 item (Match is a Seneca mode on Home)
  - Citizen (undelegated): `[Home, Workspace]` — 2 items
  - Citizen (delegated): `[Home, Workspace, You]` — 3 items
  - DRep/SPO/CC: `[Home, Workspace, You]` — 3 items
- **`getPillBarItems()`**: For homepage (`/`), return governance sub-items as pill bar: `Proposals | Representatives | Pools | Observatory`. Each sets `?filter=` URL param.
- **`getCurrentSection()`**: `/g*` and `/governance*` map to `'home'`
- **`SECTION_SHORTCUTS`**: Remove `governance: 'G G'`. Keep `home: 'G H'`, `workspace: 'G W'`, `you: 'G Y'`
- **`SECTION_METRIC_KEYS`**: Remove `governance` entry. Home can show active proposals in its tooltip.

### `components/governada/NavigationRail.tsx`

- Auto-updates from config. Now renders 3 icons: Home (compass), Workspace (briefcase), You (user). Plus Help dropdown and pinned entities at bottom.

### `components/governada/GovernadaBottomNav.tsx`

- Auto-updates from `getBottomBarItems()`. Anonymous users see just 1 item (Home). Auth users see 2-3.

### `components/governada/HeaderBreadcrumbs.tsx`

- Update `ROUTE_LABELS`: governance filter breadcrumbs now under Home context. `/?filter=proposals` → "Home > Proposals"

---

## Phase 2: Route Consolidation — Kill `/g` and `/match`

### Routes to convert to redirects:

| Current Route                     | Redirect To                              |
| --------------------------------- | ---------------------------------------- |
| `/g`                              | `/`                                      |
| `/g/drep/[drepId]`                | `/drep/[drepId]` (canonical entity page) |
| `/g/proposal/[txHash]/[index]`    | `/proposal/[txHash]/[index]`             |
| `/g/pool/[poolId]`                | `/pool/[poolId]`                         |
| `/g/cc/[ccHotId]`                 | `/committee/[ccHotId]`                   |
| `/governance`                     | `/`                                      |
| `/governance/proposals`           | `/?filter=proposals`                     |
| `/governance/representatives`     | `/?filter=dreps`                         |
| `/governance/pools`               | `/?filter=spos`                          |
| `/governance/committee`           | `/?filter=cc`                            |
| `/governance/committee/[ccHotId]` | `/committee/[ccHotId]`                   |
| `/governance/health`              | `/`                                      |
| `/governance/leaderboard`         | `/?filter=dreps&sort=score`              |
| `/governance/treasury`            | `/?filter=treasury`                      |
| `/match`                          | `/?match=true`                           |

### Routes to KEEP (standalone content pages):

- `/governance/observatory` — mission control page (real content)
- `/governance/briefing` — briefing teaser page
- `/governance/health/epoch/[epoch]` — epoch report pages
- `/governance/health/methodology` — methodology page
- `/governance/health/tracker` — health tracker
- `/governance/report/[epoch]` — governance reports
- `/governance/committee/data` — CC data page
- `/governance/committee/compare` — CC comparison page

These stay under `/governance/` as deep-link content pages. No nav item points to them — accessed via Seneca, search, or internal links.

### Entity pages to KEEP (SEO/sharing):

- `/drep/[drepId]` — full DRep profile (existing standalone)
- `/proposal/[txHash]/[index]` — full proposal page
- `/pool/[poolId]` — full pool page
- `/committee/[ccHotId]` — full CC member page

These can optionally include a "View in Globe" button → `/?entity=drep_[id]`.

### `components/governada/GovernadaShell.tsx`

- Remove `isGlobeMode` detection and all `/g`-specific special casing
- Background ConstellationScene stays for ambient effect on non-homepage pages (workspace, you) — or remove if preferred
- Seneca orb/thread no longer needs globe-mode exceptions (single Seneca instance)

---

## Phase 3: Homepage Unified Experience

The homepage becomes the single Seneca+Globe surface for all users.

### `app/page.tsx`

- Add URL param handling: `?filter=proposals|dreps|spos|cc|treasury`, `?entity=drep_[id]|proposal_[hash]_[idx]|pool_[id]|cc_[id]`, `?match=true`
- Pass params to client component

### `components/hub/HubHomePage.tsx`

- Accept `filter`, `entity`, and `match` params from URL
- Dispatch: anonymous → AnonymousLanding, auth → SynapticHomePage
- Both variants support filter/entity/match params

### `components/hub/AnonymousLanding.tsx`

- When `?filter=` set: show discovery overlay with filtered entities, globe highlights matching type
- When `?entity=` set: open entity detail sheet, flyTo node
- When `?match=true`: launch Seneca match flow
- Keep globe interactive (already is)

### `components/synaptic/SynapticHomePage.tsx`

- **Make globe interactive alongside Seneca** (currently `interactive={false}`). Users can click nodes even while Seneca briefing panel is open.
- When `?filter=` set: Seneca acknowledges ("Showing proposals..."), globe highlights, discovery overlay appears
- When `?entity=` set: flyTo entity, open detail sheet, Seneca provides context
- When `?match=true`: launch Seneca match flow (same as existing match intent detection)
- Pill bar (from nav config) items set `?filter=` on click
- Briefing panel becomes dismissible — after reading, user dismisses to free viewport. Seneca input persists at bottom.

### New: `components/hub/EntityDetailSheet.tsx`

- Bottom sheet (mobile) / right panel (desktop)
- Reuses existing panel content components:
  - `DRepGlobePanel` content → DRep detail
  - `ProposalGlobePanel` content → Proposal detail
  - `PoolGlobePanel` content → Pool detail
  - `CCMemberGlobePanel` content → CC detail
- Coexists with Seneca: detail sheet is above globe, Seneca input stays at bottom
- Close: button + Escape + swipe. "Open full page" link to `/drep/[id]` etc.
- Activated by: URL `?entity=` param, node click, Seneca focus intent

### New: `components/hub/DiscoveryOverlay.tsx`

- Lightweight entity card list when a filter is active
- Replaces heavy `ListOverlay` from `/g`
- Desktop: left side panel (350px). Mobile: bottom sheet.
- Invoked by: pill bar filter click, Seneca intent ("show me DReps"), keyboard `L`
- Entity cards: name, score, tier badge, one-line summary. Click → sets `?entity=`
- Data from existing hooks: `useDReps()`, `useProposals()`, `usePools()`, `useCommitteeMembers()`
- Basic sort options (score, activity, recent)

### Seneca Changes:

**`components/synaptic/SynapticBriefPanel.tsx`**

- Add discovery chips: "Browse Proposals", "Find a DRep", "Pool Rankings"
- Add match chip: "Find my match" (launches match flow in Seneca)
- Discovery intent → update URL `?filter=` → DiscoveryOverlay appears + globe highlights
- Briefing dismissible → Seneca input bar persists

**`hooks/useSenecaGlobeBridge.ts`** (existing, minor additions)

- `browse` intent → set `?filter=` → DiscoveryOverlay
- `focus` intent → set `?entity=` → EntityDetailSheet + flyTo
- These intents already exist — wire them to URL param updates

---

## Phase 4: Cleanup

### Components to remove:

| Component                                    | Replacement                           |
| -------------------------------------------- | ------------------------------------- |
| `components/globe/GlobeLayout.tsx`           | Homepage layout absorbs orchestration |
| `components/globe/FilterBar.tsx`             | Pill bar + Seneca intents             |
| `components/globe/ListOverlay.tsx`           | `DiscoveryOverlay`                    |
| `components/globe/ListItem.tsx`              | Discovery overlay cards               |
| `components/globe/PanelOverlay.tsx`          | `EntityDetailSheet`                   |
| `components/globe/GlobeControls.tsx`         | Keyboard shortcuts + Seneca           |
| `components/matching/ImmersiveMatchPage.tsx` | Seneca match mode on Home             |

### Components to KEEP (reused):

| Component                           | Used In                                  |
| ----------------------------------- | ---------------------------------------- |
| `GlobeConstellation.tsx`            | Globe rendering (untouched)              |
| `ConstellationScene.tsx`            | Scene wrapper (untouched)                |
| `DRepGlobePanel.tsx`                | EntityDetailSheet                        |
| `ProposalGlobePanel.tsx`            | EntityDetailSheet                        |
| `PoolGlobePanel.tsx`                | EntityDetailSheet                        |
| `CCMemberGlobePanel.tsx`            | EntityDetailSheet                        |
| `UserNodeRings.tsx`                 | User node on globe (untouched)           |
| `ProposalNodes.tsx`                 | Proposal octahedra (untouched)           |
| `Constellation2D.tsx`               | 2D fallback (untouched)                  |
| `panelUtils.ts`                     | Entity extraction (adapt for URL params) |
| `useSenecaGlobeBridge.ts`           | Globe commands (untouched)               |
| `lib/constellation/globe-layout.ts` | 6D positioning (untouched)               |
| `lib/globe/matchChoreography.ts`    | Match flow (untouched)                   |

### Link updates:

- Grep for all internal links to `/g`, `/governance`, `/match` and update to `/` with appropriate params
- Update `derivePageContext()` for new URL structure
- Update DeepLinkHandler for any `/g`-based deep links

---

## Phase 5: Keyboard Shortcuts & Polish

- Remove `G G` shortcut (governance)
- Add `F` key on homepage: cycle filter (proposals → dreps → spos → cc → clear)
- Add `L` key on homepage: toggle discovery overlay
- `Esc`: close entity detail sheet / clear filter
- Verify all persona x filter x entity combinations
- Verify mobile bottom bar spacing with fewer items
- Verify pill bar appears on homepage
- Verify Seneca briefing + discovery + entity detail coexist without layout conflicts

---

## Execution Strategy: 4 PRs

| PR       | Scope                                                                                                                                        | Effort | Risk                    |
| -------- | -------------------------------------------------------------------------------------------------------------------------------------------- | ------ | ----------------------- |
| **PR 1** | Nav simplification: remove Governance + Match from nav config, update rail/bottom bar/pill bar                                               | S      | Low — nav config only   |
| **PR 2** | Route consolidation: `/g` and `/match` redirects, GovernadaShell cleanup                                                                     | S      | Low — redirects only    |
| **PR 3** | Homepage unified: URL params, EntityDetailSheet, DiscoveryOverlay, interactive globe for auth, discovery chips in Seneca, match flow on Home | M      | Medium — largest change |
| **PR 4** | Cleanup: remove deprecated components, update all internal links, keyboard shortcuts, polish                                                 | S      | Low — removal + polish  |

---

## Checkpoint / Handoff Protocol

When approaching context window limits (or before starting a new PR), write a checkpoint to `.claude/checkpoints/unified-homepage.md` and **commit it to the main checkout** (not the worktree) so a fresh agent in a new worktree can access it.

### Checkpoint contents:

1. **Current state**: Which PRs are merged, which are in-progress, what branch is active
2. **What's done**: Files modified, components created, routes redirected — be specific with file paths
3. **What's NOT done**: Remaining work from the plan, with file paths and specific changes needed
4. **Key type signatures**: Interfaces, hook return shapes, and component props that the next agent will need (avoid re-reading 15 files to rediscover them)
5. **Gotchas discovered**: Any non-obvious patterns, edge cases, or surprises found during implementation
6. **Test status**: What passes, what's broken, what needs manual verification
7. **Resume instructions**: Exact steps to continue — branch name, next PR to start, dependencies

### Instructions for the next agent (include these verbatim in the checkpoint):

```
## Instructions for Continuing Agent

1. Read this checkpoint FIRST, then read the master plan at
   `docs/strategy/context/unified-homepage-plan.md` (or the plan file referenced below).
2. Before writing any code, use /start or enter plan mode to build a specific plan
   for YOUR phase/PR. The master plan gives the overall architecture — you need to
   plan the detailed implementation for your specific scope.
3. Get user approval on your phase plan before executing.
4. When YOU approach context limits, write an updated checkpoint following this same
   protocol. Commit it to the main checkout (not the worktree).
5. The checkpoint must be self-sufficient: a fresh agent reading ONLY the checkpoint
   + the master plan should be able to continue without re-exploring the codebase.
```

### How to commit to main checkout:

```bash
# From worktree, write the checkpoint file to the main checkout path
cp .claude/checkpoints/unified-homepage.md \
   /c/Users/dalto/governada/governada-app/.claude/checkpoints/unified-homepage.md
# Then commit from main checkout
cd /c/Users/dalto/governada/governada-app
git add .claude/checkpoints/unified-homepage.md
git commit -m "checkpoint: unified homepage refactor state"
cd -  # return to worktree
```

---

## Verification (after each PR)

1. `npm run preflight` — format + lint + types + test all pass
2. Visual verification via Claude Chrome (desktop 1280px + mobile 375px):
   - Homepage loads with globe for all personas
   - Nav shows 3 worlds: Home, Workspace, You
   - Anonymous bottom bar: just Home (1 item)
   - Auth bottom bar: Home, Workspace, You (3 items)
   - Pill bar shows Proposals/Representatives/Pools/Observatory on homepage
   - `/?filter=proposals` highlights proposals on globe + shows discovery overlay
   - `/?entity=drep_[id]` opens detail sheet + flies globe to node
   - `/?match=true` launches match flow in Seneca
   - Seneca briefing auto-streams for auth users
   - "Show me DReps" in Seneca → sets filter → globe highlights
   - `/g` redirects to `/`
   - `/match` redirects to `/?match=true`
   - `/drep/[id]` standalone pages still work
   - `/governance/observatory` still works (standalone content)
   - Entity detail sheet and Seneca coexist without competing
   - Clicking globe node while Seneca is open works (globe now interactive for auth)
3. `npm run smoke-test` on production after merge
4. Verify no broken links via grep for old route references
