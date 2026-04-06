# Deep Dive 05 - Performance and Scale

**Status:** In progress
**Started:** 2026-04-05
**Owner branch:** `feature/platform-architecture-review-series`
**Review goal:** verify cache strategy, query fan-out, bundle shape, route dynamism, and load readiness so high-traffic public surfaces and long-running sync paths do not degrade as usage grows.

## Scope

This pass focuses on the parts of the app where traffic growth or data growth will turn current design choices into real latency, cost, or reliability problems:

- anonymous landing and public API hot paths
- proposal list/detail query fan-out and cache shape
- workspace/reviewer shared-state fan-out
- background sync jobs whose cost grows with historical corpus size
- route dynamism and client/runtime pressure on the page surface
- load-test and bundle-analysis readiness

## Evidence Collected

- `package.json`
- `next.config.ts`
- `scripts/bundle-report.ts`
- `tests/load/scenarios/api-v1.js`
- `app/page.tsx`
- `components/hub/HubHomePage.tsx`
- `components/globe/GlobeLayout.tsx`
- `components/globe/ListOverlay.tsx`
- `app/api/proposals/route.ts`
- `app/api/governance/pulse/route.ts`
- `app/api/v1/proposals/route.ts`
- `app/proposal/[txHash]/[index]/page.tsx`
- `lib/data.ts`
- `lib/governance/proposalVotingSummary.ts`
- `lib/redis.ts`
- `hooks/queries.ts`
- `lib/workspace/reviewQueue.ts`
- `lib/workspace/proposalMonitor.ts`
- `lib/sync/proposals.ts`
- `lib/sync/votes.ts`
- `lib/sync/dreps.ts`
- `lib/sync/data-moat.ts`
- `lib/sync/slow.ts`
- `utils/koios.ts`
- `supabase/migrations/018_data_integrity.sql`
- `__tests__/lib/data.test.ts`

## Findings

### 1. The anonymous homepage was doing dead server-side database work on every request

**Severity:** Fixed in this worktree

**Evidence**

- `app/page.tsx` was querying Supabase for active DReps, total DReps, open proposals, and delegator counts through `getGovernancePulse()`.
- `components/hub/HubHomePage.tsx` accepted `pulseData` but did not consume it or pass it into `GlobeLayout`.
- That meant the hottest anonymous route stayed expensive even though the result never affected rendered output.

**Why it matters**

The landing page is the highest-probability public entry path. Paying for live DRep/proposal queries there without using the result is pure latency and database cost with no user benefit.

**Implementation status**

- Fixed in this worktree.
- Removed the unused `getGovernancePulse()` read path from `app/page.tsx`.
- Removed the dead `pulseData` prop from `components/hub/HubHomePage.tsx`.
- This keeps current behavior identical while removing unnecessary Supabase work from the landing route.

### 2. Proposal list surfaces still scale with broad reads and in-memory shaping

**Severity:** In progress

**Evidence**

- `app/api/v1/proposals/route.ts` loads `getAllProposalsWithVoteSummary()`, then filters, sorts, and slices in memory instead of pushing those constraints toward the read layer.
- `lib/data.ts:getAllProposalsWithVoteSummary()` still loads the full proposals set for that consumer surface.
- `app/api/proposals/route.ts` caches the response for 60 seconds, but each cache miss still reads all matching proposals, two separate `governance_stats` rows, all `proposal_outcomes`, and the shared voting-summary path.
- `lib/workspace/reviewQueue.ts` still loads `select('*')` for all open proposals plus raw sentiment rows for every open proposal before shaping the personalized queue.

**Why it matters**

These routes will get slower as proposal count and vote volume rise, even if the user only requests a small page or one personalized workspace view. That is manageable at current scale but becomes expensive under bursty public traffic.

**Implementation status**

- Partially reduced in this worktree.
- `lib/data.ts:getAllProposalsWithVoteSummary()` no longer performs an unbounded `drep_votes` scan; it now limits voter lookups to the fetched proposal tx hashes.
- Added focused regression coverage in `__tests__/lib/data.test.ts` so that query bound stays explicit.
- Remaining gap: the public proposal list surfaces still need filtering, pagination, and cache-key strategy pushed closer to the database/read boundary instead of full in-memory shaping.

### 3. Background vote ingestion and slow-sync jobs scale with total history instead of new change volume

**Severity:** Open

**Evidence**

- `lib/sync/proposals.ts`, `lib/sync/votes.ts`, and `lib/sync/dreps.ts` all touch Koios vote ingestion paths with overlapping scopes.
- `utils/koios.ts:fetchAllVotesBulk()` plus `lib/sync/votes.ts` still import and process full vote history in memory on the 6-hour sync path.
- `lib/sync/data-moat.ts` reprocesses the full metadata-archive corpus daily instead of only newly changed content.
- `lib/sync/slow.ts` applies bounded cache lookups against unbounded source sets, which risks churn instead of forward progress as the corpus grows.

**Why it matters**

These jobs get slower forever as history accumulates. Even if traffic stays flat, sync latency, memory pressure, and upstream rate-limit exposure all grow with data size.

### 4. The page surface is still heavily dynamic

**Severity:** Open

**Evidence**

- A route scan across `app/**/page.tsx` and `app/**/page.ts` shows `59` of `92` page routes export `dynamic = 'force-dynamic'`.
- High-traffic pages like `app/page.tsx` and `app/proposal/[txHash]/[index]/page.tsx` are included in that set.

**Why it matters**

Not every page should be static, but a large fully dynamic footprint narrows caching and future partial-prerendering options. That raises the floor on server cost and makes it harder to separate “truly personalized” from “accidentally uncached.”

### 5. The homepage globe shell had hidden-state entity overfetch

**Severity:** Fixed in this worktree

**Evidence**

- `components/globe/ListOverlay.tsx` mounted `useDReps()`, `useProposals(200)`, `useCommitteeMembers()`, and the local pools `useQuery()` before the `if (!isOpen) return null` guard.
- `components/globe/GlobeLayout.tsx` keeps `ListOverlay` in the homepage tree at all times and only toggles its open state.
- That meant the closed homepage list panel still kicked off all four entity queries even when the user never opened it.

**Why it matters**

This is classic hidden-state overfetch: the homepage pays network and client work for a panel the user may never touch. It is especially wasteful on the anonymous landing route where first-load budget matters most.

**Implementation status**

- Fixed in this worktree.
- `hooks/queries.ts` now supports explicit `enabled` gating for `useDReps()`, `useProposals()`, and `useCommitteeMembers()`.
- `components/globe/ListOverlay.tsx` now disables those entity queries, plus the pools query, while the overlay is closed.
- Added focused component coverage in `__tests__/components/ListOverlay.test.tsx`.

## Risk Ranking

1. Public and workspace proposal list surfaces still over-read and over-shape data relative to the request.
2. Background vote and archive jobs scale with full historical corpus size instead of deltas.
3. Dynamic rendering is widely used across the page surface without a clearly ranked cache strategy.
4. The homepage still mounts a heavy client globe shell immediately, even after the hidden-state list overfetch fix.

## Open Questions

- Which proposal-list surface should be the next DD05 hardening slice: the public `v1` proposals API, the legacy `/api/proposals` route, or the workspace review queue?
- Should the proposal detail page keep its current fully dynamic posture, or can metadata/data reads be split so the main page body benefits from stronger caching than the personalized edges?
- Is the right long-term fix for the votes sync incremental ingestion, upstream checkpointing, or a dedicated append-only internal vote log?

## Next Actions

1. Push public proposal-list filtering and pagination closer to the shared read layer instead of materializing the full proposal set on every cache miss.
2. Choose the primary vote-ingestion owner and reduce the current triplicated Koios vote-read paths.
3. Map which `force-dynamic` pages are truly personalized versus simply carrying historical implementation debt.
4. Profile and reduce the homepage client-shell initial load, especially always-mounted globe and panel surfaces that remain first-render critical.

## Handoff

**Current status:** In progress

**What changed this session**

- Started DD05 and mapped the initial hot-path surfaces for public pages, proposal routes, and background sync growth.
- Removed dead SSR pulse queries from `app/page.tsx`.
- Removed the unused `pulseData` contract from `components/hub/HubHomePage.tsx`.
- Bounded `getAllProposalsWithVoteSummary()` so it only reads `drep_votes` rows for the fetched proposal tx hashes instead of scanning the entire table.
- Added focused regression coverage in `__tests__/lib/data.test.ts`.
- Gated `ListOverlay` entity queries behind visible state and added focused component coverage in `__tests__/components/ListOverlay.test.tsx`.

**Validated findings**

- The homepage had unnecessary live Supabase work on every request. Fixed in this worktree.
- The homepage list overlay was overfetching entity data while closed. Fixed in this worktree.
- Public/workspace proposal list surfaces still rely on broad reads and in-memory shaping. Partially reduced, still open.
- Background vote/archive sync paths still scale with total historical corpus size. Open.
- `force-dynamic` usage is widespread across the page surface. Open.

**Next agent starts here**

Finish the proposal-list branch of DD05 first. Read `app/api/v1/proposals/route.ts`, `app/api/proposals/route.ts`, `lib/data.ts`, and `lib/workspace/reviewQueue.ts`, then decide which surface should own the next pagination/cache-shape reduction.
