# Agent Guide

Provider-agnostic instructions for autonomous agents working in this repo. Treat this file as the portable workflow brief. Provider-specific adapters live under `.claude/`.

## Core Rules

- Feature work happens in a worktree. The shared `governada-app` checkout stays on `main`. Hotfixes are the only exception.
- Search before creating. Extend existing components, hooks, routes, and utilities unless extension is genuinely infeasible.
- Non-trivial bugs require root-cause analysis before fixing. Do not patch symptoms first.
- `.env.local` points at production services. Never perform write-heavy syncs, backfills, or destructive data operations without explicit approval.
- Risky user-facing work should be feature-flagged.

## Hard Constraints

- Any `app/**/page.tsx` or `app/**/route.ts` touching Supabase, Redis, or `process.env` must export `const dynamic = 'force-dynamic'`.
- Any new file in `inngest/functions/` must be imported and registered in `app/api/inngest/route.ts`.
- Client-side data fetching uses TanStack Query, not raw `fetch` with ad-hoc `useEffect` state.
- Pages and components read cached governance data via `lib/data.ts`, not direct Koios calls.
- Migrations go through Supabase MCP. After a migration, regenerate and commit `types/database.ts`.

These constraints are enforced by `npm run agent:validate`. Run it before shipping. CI also runs it.

## Workflow

1. Start from fresh `origin/main`.
2. Read only the minimal context needed. Use the strategy registry and manifest before diving into the full vision docs.
3. Make the smallest change that solves the actual problem.
4. Run `npm run agent:validate` and the relevant local verification for the scope.
5. For feature work, open a PR with `Summary`, `Existing Code Audit`, `Robustness`, and `Impact` sections.
6. Before merging, run `scripts/pre-merge-check.sh`.
7. After merge, verify deploy health and smoke tests.

## Autonomy Boundary

Routine reads, edits, local verification, git hygiene, and PR preparation should not require approval. Pause for:

- Destructive production-data operations
- Scope expansion beyond the request
- Architectural forks with materially different tradeoffs
- Secrets, credential rotation, or external account changes

## Setup Files

- Local MCP credentials belong in `.mcp.json`, which stays ignored.
- Local Claude overrides belong in `.claude/settings.local.json`, which stays ignored.
- Use `.mcp.example.json` as the sanitized template for new machines.
