# Inhabited Constellation — Build Checkpoint

## Plan File

`C:\Users\dalto\.claude-personal\plans\valiant-brewing-zephyr.md`

## Status

- **Phase 0**: Complete — PR #630 (Seneca unification, dead code removal)
- **Phase 1**: Complete — PR #632 (/g/ route namespace, globe URL state)
- **Phase 2**: Complete — PR #633 (panel overlay system)
- **Phase 3**: Complete — PR #634 (list overlay + filtering + globe controls)
- **Phase 4**: Complete — PR #636 (Seneca intent routing — 8 intent types)
- **Phase 5**: Complete — PR #637 (2D canvas fallback, GPU tier detection, touch targets)
- **Phase 6**: NOT STARTED — Migration + Cleanup

## Current Branch

`claude/adoring-kilby` — rebased on main, all Phase 5 work merged.

## Phase 6 Requirements (Final Phase)

**Goal:** Redirect old governance routes to globe equivalents. Remove dead page components. Update navigation.

### Route Redirects (implement as `redirect()` in each page.tsx)

```
/governance/proposals       → /g?filter=proposals
/governance/representatives → /g?filter=dreps
/governance/pools           → /g?filter=spos
/governance/treasury        → /g?sector=treasury
/governance/health          → /g (health is ambient globe state)
/governance/committee       → /g?filter=cc
/governance/leaderboard     → /g?filter=dreps&sort=score
/proposal/[tx]/[i]          → /g/proposal/[tx]/[i]
/drep/[id]                  → /g/drep/[id]
/pool/[id]                  → /g/pool/[id]
```

### Routes to KEEP (do NOT redirect)

- `app/governance/observatory` — already spatial-first, different paradigm
- `app/governance/committee/compare` — specialized comparison tool
- `app/governance/committee/data` — specialized data tool
- `app/governance/briefing` — briefing page
- `app/governance/health/methodology` — methodology docs
- `app/governance/health/tracker` — health tracker tool
- `app/governance/report/[epoch]` — epoch report pages

### Dead Code Removal

Delete these discover components (replaced by globe ListOverlay + FilterBar):

- `components/governada/discover/GovernadaDRepBrowse.tsx`
- `components/governada/discover/ProposalsBrowse.tsx`
- `components/governada/discover/GovernadaSPOBrowse.tsx`
- `components/governada/discover/GovernadaDiscover.tsx`
- `components/governada/discover/DiscoverFilterBar.tsx`
- `components/governada/discover/DiscoverPagination.tsx`
- `components/governada/discover/DiscoverHero.tsx`
- `components/governada/discover/MatchAwareDiscoverHero.tsx`

**IMPORTANT**: Before deleting, grep for imports of each component. Some may be referenced from pages that are being redirected (safe to delete together) or from pages being kept (need to update those pages first).

### Navigation Updates

- Update `lib/nav/config.ts` to point governance items to `/g` routes
- SectionTabBar: remove governance items or repurpose as globe filter toggles

### Homepage Update

- Anonymous: globe already fills viewport. "Explore governance" CTA → `/g`
- Authenticated: SynapticBriefPanel stays. "Explore governance" CTA → `/g`

### Key Files for Context

| File                                      | Purpose                                          |
| ----------------------------------------- | ------------------------------------------------ |
| `components/globe/GlobeLayout.tsx`        | The /g/ client layout with all overlays          |
| `lib/globe/urlState.ts`                   | URL state encoding (filter, sector, view params) |
| `lib/nav/config.ts`                       | Navigation rail configuration                    |
| `components/governada/GovernadaShell.tsx` | Shell with nav rail + SectionTabBar              |
| `components/governada/SectionTabBar.tsx`  | Tab bar within governance sections               |

### Validation Checklist

- [ ] All old governance URLs redirect correctly (no 404s)
- [ ] External links to `/governance/proposals` land on `/g?filter=proposals`
- [ ] Navigation rail/tabs point to `/g` routes
- [ ] No dead imports after component deletion (preflight catches this)
- [ ] `/g` and all `/g/[entity]` routes still work after nav changes
- [ ] Homepage CTAs navigate to `/g`
- [ ] Accessibility: list mode (Ctrl+L) provides full table/card view of all entity types
- [ ] `npm run preflight` passes
- [ ] Production health check after deploy
