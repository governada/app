# Runtime Safety: Governada Platform 2026 Phase 0

> **Initiative**: [docs/strategy/plans/governada-platform-2026.md](../plans/governada-platform-2026.md)
> **Work plan**: [docs/strategy/specs/governada-platform-phase0-workplan.md](governada-platform-phase0-workplan.md)
> **Created**: 2026-04-09
> **Status**: Phase 0 baseline
> **Current recommendation**: `governada-review` is approved. `governada-runtime` remains blocked until the minimum runtime safety checklist is satisfied.

---

## Purpose

This document defines the line between:

- review-safe cloud work
- runtime-safe cloud work
- unsafe production-coupled work

Phase 0 needs this line to be explicit before Codex is allowed to boot the app with real credentials or touch write-capable services.

---

## Current Repo Reality

The current repo already exposes the main safety constraints:

- [README.md](../../README.md) and [docs/codex-cloud.md](../../codex-cloud.md) both warn that `.env.local` points at production services.
- [lib/env.ts](../../lib/env.ts) enforces the minimum runtime contract for any real app boot:
  - `NEXT_PUBLIC_SUPABASE_URL`
  - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
  - `SUPABASE_SECRET_KEY`
  - `SESSION_SECRET`
  - `CRON_SECRET`
  - `UPSTASH_REDIS_REST_URL`
  - `UPSTASH_REDIS_REST_TOKEN`
- [scripts/codex-cloud-doctor.mjs](../../scripts/codex-cloud-doctor.mjs) already distinguishes review-ready from runtime-ready environments.
- [scripts/codex-runtime-check.mjs](../../scripts/codex-runtime-check.mjs) proves that runtime verification is a real app build, not a docs-only check.
- [scripts/seed-staging.ts](../../scripts/seed-staging.ts) shows that the repo already assumes a separate staging Supabase project can exist, but that staging path is not yet the standard local or cloud contract.

Implication: the review environment can exist safely without runtime credentials, but the runtime environment must not be created casually or by copying local production-connected env files.

---

## Environment Classes

| Environment | Purpose | Allowed credentials | Notes |
| --- | --- | --- | --- |
| `governada-review` | docs, review, static refactors, non-runtime fixes | none | Start from `npm run codex:doctor` and `npm run codex:verify` only |
| `governada-runtime` | build, boot, runtime debugging, service-aware tasks | staging or read-only runtime env vars only | Must use environment variables, not Codex setup-only secrets |
| local macOS | human development, browser debugging, manual verification | safe local env or staging env | Should not inherit `.env.local` blindly |
| local Windows | compatibility path only | same as macOS, but not the canonical workflow | Keep outside the strategic runtime contract |

---

## Credential Classes

| Class | Examples | Review env | Runtime env | Rules |
| --- | --- | --- | --- | --- |
| Public runtime identifiers | `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `NEXT_PUBLIC_SITE_URL`, `NEXT_PUBLIC_VAPID_PUBLIC_KEY`, `NEXT_PUBLIC_SENTRY_DSN`, `NEXT_PUBLIC_POSTHOG_KEY`, `NEXT_PUBLIC_POSTHOG_HOST`, `NEXT_PUBLIC_KOIOS_BASE_URL` | No | Yes, but non-production only | Public does not mean harmless. These values still decide which system the app talks to. |
| Server runtime secrets | `SUPABASE_SECRET_KEY`, `SESSION_SECRET`, `CRON_SECRET`, `UPSTASH_REDIS_REST_TOKEN`, `UPSTASH_REDIS_REST_URL` | No | Yes | Must point to staging or read-only systems. Production keys are out of bounds for autonomous runtime work. |
| AI provider keys | `ANTHROPIC_API_KEY`, `OPENAI_API_KEY`, BYOK test keys | No | Optional | Use staging, capped, or test accounts. Prefer provider keys that cannot mutate external customer state. |
| Workflow and background keys | `INNGEST_BASE_URL`, `INNGEST_SIGNING_KEY`, `INNGEST_EVENT_KEY` | No | Optional | If present, they must target a staging or isolated Inngest runtime, not production. |
| Notification and outbound creds | `RESEND_API_KEY`, `TELEGRAM_BOT_TOKEN`, `DISCORD_WEBHOOK_URL`, VAPID keys | No | Optional, but only if sandboxed | Staging mail domains, staging bots, or dry-run channels only. Never send real user-facing notifications from agent workflows by default. |
| Admin and privilege controls | `ADMIN_WALLETS`, preview/admin allowlists | No | Yes, but scoped to test accounts | Do not include founder or production admin wallets in a cloud runtime environment. |
| Setup-only secrets | Codex cloud "Secrets" fields | Not needed | Not sufficient | Codex removes these before the agent phase, so they cannot power runtime app tasks. |
| Local-only developer toggles | `DEV_MOCK_AUTH`, `DEV_ADMIN_WALLETS` | Not needed | Usually no | Keep these local unless there is a narrow staging test case. |

---

## Task Classes

| Task class | Examples | Allowed in review env | Allowed in runtime env | Notes |
| --- | --- | --- | --- | --- |
| Review-safe | `npm run codex:doctor`, `npm run codex:verify`, docs edits, type-only refactors | Yes | Yes | Default Codex cloud path |
| Runtime read-only | `npm run codex:runtime-check`, `next build`, GET-only smoke tests, feature rendering checks | No | Yes | Requires staging or read-only runtime credentials |
| Runtime write-safe | draft creation in staging, workspace test flows, preview session testing, test notifications | No | Yes, if staging-only | Must be isolated to staging projects and test identities |
| Operationally risky | `/api/sync/*`, `/api/admin/*`, manual backfills, alert routes, seed scripts, migration-adjacent changes | No | Not by default | Requires explicit human approval plus environment-specific guardrails |
| Production-coupled | using `.env.local`, production Supabase service role, production Redis, production Inngest, founder/admin wallets | No | No | Explicitly prohibited for autonomous cloud work |

---

## What Makes This Repo Risky Today

### 1. Local default state is production-connected

[README.md](../../README.md) and [AGENTS.md](../../AGENTS.md) both say `.env.local` points at production services. That means "works on my machine" local behavior is not a safe default to reproduce in Codex cloud or on a future macOS setup.

### 2. Runtime checks are real runtime checks

[scripts/codex-runtime-check.mjs](../../scripts/codex-runtime-check.mjs) is intentionally stronger than review verification. It asserts runtime env vars and runs a production build. That is the correct behavior, but it means runtime credentials are meaningful and should be treated as privileged.

### 3. Background jobs and admin routes are not sandbox-neutral

The app exposes:

- sync routes under [app/api/sync](../../app/api/sync)
- admin routes under [app/api/admin](../../app/api/admin)
- notification and channel routes under [app/api/user](../../app/api/user) and [app/api/telegram](../../app/api/telegram)
- a large registered job surface in [app/api/inngest/route.ts](../../app/api/inngest/route.ts)

Those surfaces can mutate database state, create side effects, or fire external notifications.

### 4. Staging exists as an idea, not yet as the runtime contract

[scripts/seed-staging.ts](../../scripts/seed-staging.ts) is useful evidence that a staging posture is possible, but Phase 0 still needs to define:

- which tables or services may be copied
- whether staging is read-only or write-capable for agent work
- which notification providers stay disabled in staging
- whether Inngest and Redis are isolated from production

---

## Minimum Bar For `governada-runtime`

Do not create `governada-runtime` until every item below is true.

### Required

- Supabase points to a non-production project.
- Upstash points to a non-production database.
- `SESSION_SECRET` and `CRON_SECRET` are unique to staging.
- `NEXT_PUBLIC_SITE_URL` points to a staging or isolated runtime URL.
- Any `ADMIN_WALLETS` value is limited to staging/test wallets only.
- Codex cloud environment variables, not setup-only secrets, hold the runtime values needed during the agent phase.
- The intended smoke commands are documented and reproducible:
  - `npm run codex:doctor`
  - `npm run codex:runtime-check`

### Strongly recommended

- Inngest points to a staging or isolated server, or runtime tasks avoid background event emission entirely.
- Resend, Telegram, Discord, and push channels are disabled or redirected to staging/test destinations.
- PostHog and Sentry point to staging projects or are disabled for runtime agent tasks.
- Agent internet access is still `Off` unless the task truly needs live outbound calls.
- If internet is enabled, the allowlist is host-specific and method-limited.

### Explicitly not acceptable

- copying `.env.local` into Codex cloud
- sharing production service-role credentials with the runtime environment
- pointing runtime checks at production Supabase or Redis
- using founder wallets, production preview cohorts, or real notification channels for agent testing

---

## Current Go / No-Go Decision

| Environment | Decision | Reason |
| --- | --- | --- |
| `governada-review` | Go | No runtime credentials required; the repo already supports a safe review contract |
| `governada-runtime` | No-go for now | The runtime safety checklist is not yet fully satisfied or verified in repo-tracked form |

This is a deliberate Phase 0 outcome, not a blocker. The initiative benefits immediately from `governada-review`, while runtime enablement should wait until the staging posture is explicit.

---

## Recommended Follow-Ups

1. Validate `governada-review` by running the Phase 0 smoke task in Codex cloud:
   - `npm run codex:doctor`
   - `npm run codex:verify`
2. Define the staging package for any future runtime environment:
   - staging Supabase
   - staging Redis
   - staging or disabled Inngest
   - staging or disabled outbound notification providers
3. Decide whether `governada-runtime` is meant to support:
   - read-only runtime debugging only
   - or full staging write flows for Studio and admin workflows
4. Once that decision is explicit, record the runtime go/no-go outcome in an ADR or in the platform initiative.
