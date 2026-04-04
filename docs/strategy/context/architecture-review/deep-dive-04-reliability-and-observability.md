# Deep Dive 04 - Reliability and Observability

**Status:** In progress
**Started:** 2026-04-03
**Owner branch:** `feature/platform-architecture-review-series`
**Review goal:** verify env validation, health checks, deploy/runtime safeguards, logging, Sentry/instrumentation, cron/heartbeat coverage, and operational failure diagnosis.

## Scope

This pass covers the operational surfaces that determine whether the app can fail loudly, fail consistently, and be diagnosed quickly:

- Environment validation and startup safeguards
- Health endpoints and readiness/liveness behavior
- Logging, Sentry, and request-error capture
- Cron and heartbeat coverage for sync jobs
- Failure diagnosis paths for syncs, alerts, and admin integrity checks
- Deploy and preview verification confidence

## Evidence Collected

- `lib/env.ts`
- `instrumentation.ts`
- `middleware.ts`
- `proxy.ts`
- `lib/api/handler.ts`
- `lib/syncPolicy.ts`
- `lib/sync-utils.ts`
- `lib/sentry-cron.ts`
- `app/api/health/route.ts`
- `app/api/health/deep/route.ts`
- `app/api/health/sync/route.ts`
- `app/api/health/ready/route.ts`
- `app/api/admin/integrity/route.ts`
- `app/api/admin/integrity/alert/route.ts`
- `inngest/functions/sync-freshness-guard.ts`
- `.github/workflows/post-deploy.yml`
- `.github/workflows/preview.yml`
- `scripts/smoke-test.ts`
- `scripts/check-deploy-health.mjs`
- `package.json`
- `__tests__/api/health.test.ts`
- `__tests__/api/health-sync.test.ts`
- `__tests__/api/v1-dreps.test.ts`
- `__tests__/api/v1-drep-history.test.ts`
- `__tests__/instrumentation.test.ts`
- `__tests__/proxy.test.ts`
- `__tests__/lib/syncPolicy.test.ts`

## Findings

### 1. Operational diagnosis was fragmented across several health models

**Severity:** Fixed in this worktree

**Evidence**

- `app/api/health/route.ts`, `app/api/health/sync/route.ts`, `app/api/admin/integrity/alert/route.ts`, and `inngest/functions/sync-freshness-guard.ts` previously maintained their own stale-threshold tables.
- The threshold drift was concrete, not cosmetic:
  - `proposals` used `90` minutes in broad health and self-healing, but `120` in simple liveness.
  - `secondary`, `scoring`, `alignment`, `treasury`, and `ghi` all diverged across the four surfaces.
- Missing-row handling also drifted, especially around "never ran" sync types.

**Why it matters**

The same outage could be labeled differently depending on which operator surface saw it first. That creates noisy triage, duplicate retriggers, and unclear incident ownership.

**Implementation status**

- Fixed in this worktree.
- `lib/syncPolicy.ts` now defines a layered canonical sync registry instead of one local threshold map per surface.
- The shared policy models intentionally different meanings:
  - `retriggerAfterMinutes` for self-healing and alerting
  - `degradedAfterMinutes` / `criticalAfterMinutes` for broad health
  - `externalCriticalAfterMinutes` for simple external liveness
- `app/api/health/route.ts`, `app/api/health/sync/route.ts`, `app/api/admin/integrity/alert/route.ts`, and `inngest/functions/sync-freshness-guard.ts` now consume that shared policy.
- Auto-healing is now gated on sync types that actually define an event instead of assuming every monitored type is triggerable.

### 2. Tier-gated API routes still inherited public CDN cache headers

**Severity:** Fixed in this worktree

**Evidence**

- `lib/api/handler.ts` previously applied shared public GET caching to successful tier-gated responses.
- `app/api/v1/dreps/[drepId]/history/route.ts` and `app/api/v1/dreps/[drepId]/votes/route.ts` are pro-tier routes that inherited that default.

**Why it matters**

Authenticated or entitlement-sensitive responses should not silently share public CDN cache semantics. Even when the payload is user-agnostic, the cache policy is the wrong default for trust and incident handling.

**Implementation status**

- Fixed earlier in this worktree by switching tier-gated successful GETs to `Cache-Control: private, no-store`.
- Verified with `__tests__/api/v1-drep-history.test.ts` and `__tests__/api/v1-dreps.test.ts`.

### 3. Snapshot health failures were swallowed by the main health endpoint

**Severity:** Fixed in this worktree

**Evidence**

- `app/api/health/route.ts` computed snapshot health across many tables.
- That same route swallowed snapshot-diagnostic exceptions as "best effort", which meant the endpoint could stay apparently healthy while its own diagnostic layer was blind.

**Why it matters**

If the snapshot diagnostic layer fails, operators need to know that the health endpoint has lost part of its visibility. Silent failure creates false confidence during incident response.

**Implementation status**

- Fixed in this worktree.
- `app/api/health/route.ts` now returns explicit snapshot status metadata instead of swallowing diagnostic failure.
- Snapshot diagnostic failure now degrades the top-level health result instead of leaving the route silently optimistic.
- Snapshot check results are now rolled into a top-level snapshot status instead of being returned as an unranked sidecar payload.

### 4. Operational monitoring still fails open when observability and alerting env wiring is missing

**Severity:** High

**Evidence**

- `lib/env.ts` validates only runtime-critical variables and treats Sentry, Discord, email, heartbeat, and related ops integrations as optional.
- `instrumentation.ts` will simply disable Sentry when `NEXT_PUBLIC_SENTRY_DSN` is absent.
- `lib/sync-utils.ts` silently no-ops for alert delivery, heartbeat pings, and analytics deploy hooks when related env vars are absent.

**Why it matters**

A production deploy can come up "healthy" while error monitoring, operator alerting, or external cron visibility is effectively disabled. That is an operability failure, not a convenience.

**Implementation status**

- Open.
- This should be fixed through an explicit ops-critical env contract rather than by marking every integration universally required in every environment.

### 5. Cron observability coverage is still thin relative to the number of scheduled jobs

**Severity:** High

**Evidence**

- The repo has many cron-triggered Inngest jobs, but only a subset currently have durable Sentry Cron or heartbeat coverage.
- Freshness-critical jobs like `sync-drep-scores`, `generate-epoch-summary`, and `sync-freshness-guard` are especially important to cover consistently.

**Why it matters**

World-class observability requires durable visibility into the jobs that gate freshness, epoch transitions, and operator alerts. Missing cron instrumentation means silent missed runs remain possible.

**Implementation status**

- Open.
- This needs a tiered cron coverage policy so the most important scheduled jobs are instrumented mechanically instead of opportunistically.

### 6. Deploy and preview verification are still too time-based and not release-aware

**Severity:** Medium

**Evidence**

- `.github/workflows/post-deploy.yml` waits a fixed interval before smoke tests rather than proving it is checking the intended release.
- `.github/workflows/preview.yml` still depends on derived preview-target assumptions and hardcoded success messaging.
- `scripts/smoke-test.ts` defaults to the production site URL when a specific target is not provided.

**Why it matters**

Verification that can target the wrong release or the wrong URL creates false positives. That weakens the entire reliability story even when smoke tests technically pass.

**Implementation status**

- Open.
- This should be fixed by making deploy and preview verification resolve actual deployment targets and report real result counts.

## Risk Ranking

1. Ops-critical env wiring still fails open.
2. Cron coverage is thinner than the number of scheduled jobs that matter.
3. Deploy and preview verification are not yet release-aware.
4. Snapshot policy itself is still broader than the freshness-policy layer and may need its own canonical registry in a later pass.

## Open Questions

- Should ops-critical env validation fail at startup, deploy verification, or both?
- Which cron-triggered jobs should be treated as tier 1 for heartbeat and Sentry Cron coverage?
- Should deploy verification prove a build ID, a commit SHA, or a provider-native deployment identifier before smoke tests run?

## Next Actions

1. Define and enforce the ops-critical env contract.
2. Expand tier-1 cron observability coverage.
3. Make deploy and preview verification release-aware.

## Handoff

**Current status:** In progress

**What changed this session**

- Replaced the drifting per-route freshness tables with a layered canonical sync policy in `lib/syncPolicy.ts`.
- Updated `app/api/health/route.ts`, `app/api/health/sync/route.ts`, `app/api/admin/integrity/alert/route.ts`, and `inngest/functions/sync-freshness-guard.ts` to consume that shared policy.
- Fixed the main health endpoint so snapshot-diagnostic failures surface explicitly and degrade the top-level health result instead of being swallowed.
- Updated `app/api/health/deep/route.ts` to document the current Redis dependency posture accurately after the earlier rate-limit hardening work.
- Pulled in parallel scout findings for runtime-boundary mapping, ops env contracts, cron coverage, and deploy verification gaps.

**Validated findings**

- Operational diagnosis no longer depends on four drifting stale-threshold tables. Fixed in this worktree.
- Tier-gated API routes no longer inherit public CDN cache headers. Fixed earlier in this worktree.
- Snapshot diagnostic failure now surfaces instead of being silently swallowed. Fixed in this worktree.
- Ops-critical env wiring, cron coverage, and release-aware deploy verification remain open DD04 findings.

**Verification**

- Passed `npm run test:unit -- __tests__/lib/syncPolicy.test.ts __tests__/api/health.test.ts __tests__/api/health-sync.test.ts`.
- Passed `npm run agent:validate`.
- Passed `npm run type-check`.
- Passed focused lint for `lib/syncPolicy.ts`, `app/api/health/route.ts`, `app/api/health/sync/route.ts`, `app/api/admin/integrity/alert/route.ts`, and `inngest/functions/sync-freshness-guard.ts`.

**Open questions**

- See the `Open Questions` section above.

**Next actions**

- Start with the ops env contract and tier-1 cron coverage instead of reopening the sync-policy layer.
- Keep deploy and preview verification hardening as the next DD04 implementation slice after ops visibility is enforced.

**Next agent starts here**

Start with `lib/env.ts`, `instrumentation.ts`, `lib/sync-utils.ts`, `.github/workflows/post-deploy.yml`, `.github/workflows/preview.yml`, and `scripts/check-deploy-health.mjs`. The current highest-value DD04 work is enforcing ops-critical observability wiring and making deploy verification release-aware.
