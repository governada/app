# ADR-002: Inngest over Vercel Cron

## Status
Accepted

## Context
DRepScore needs 20+ background jobs: data sync (Koios), score calculation, notifications, report generation. Options: Vercel Cron (simple, limited), Inngest (durable, step functions, retries), BullMQ (self-hosted Redis queues).

## Decision
Use Inngest for all background processing. Functions are durable, have built-in retries, and support cron schedules and event-driven triggers.

## Consequences
- Inngest handles retries, step functions, and scheduling — no custom queue infrastructure
- Dependency on Inngest service availability (mitigated: sync routes also work via HTTP cron as fallback)
- 22 registered functions with varying schedules (30min to weekly)
- Inngest dev server required for local testing (`npm run inngest:dev`)
- Must register all functions in `app/api/inngest/route.ts` — forgetting causes silent failures
