# Agent Guide

Portable workflow brief for autonomous agents in this repo.

`AGENTS.md` plus the portable `npm run ...` scripts are the source of truth for Codex-facing workflows. Local adapter layers such as `.claude/` and `.cursor/` are convenience tooling; if they drift from this file, follow this file and the repo scripts.

## Operating Model

- Codex cloud is the primary autonomous environment. Design agent workflows for isolated Linux containers first.
- macOS is the preferred local human environment.
- Windows local support is compatibility-only. Do not make PowerShell, WSL, or Windows sandbox workarounds the core repo contract.
- Local feature work in a shared checkout happens in a fresh worktree. Codex cloud tasks do not create repo-managed worktrees because the cloud container is already isolated per task.
- `.env.local` points at production services. Never copy it into Codex cloud, and never run write-heavy syncs, backfills, or destructive data operations without explicit approval.
- Risky user-facing work should be feature-flagged.

## Solution Standard

- Prefer the most elegant solution that fully solves the problem. Elegant means coherent with the existing architecture, durable under growth, easy to maintain, and likely to reduce future rework.
- Do not choose shortcuts or minimal-diff patches when they preserve avoidable technical debt, performance issues, or scalability limits.
- When the elegant solution is broader than the quickest patch, recommend it explicitly and explain why the broader change is justified.
- In updates, handoffs, and PRs, always communicate impact: what changed, why it matters, who or what benefits, and the implications for performance, maintainability, scalability, and risk.

## Hard Constraints

- Any `app/**/page.tsx` or `app/**/route.ts` touching Supabase, Redis, or `process.env` must export `const dynamic = 'force-dynamic'`.
- Any new file in `inngest/functions/` must be imported and registered in `app/api/inngest/route.ts`.
- Client-side data fetching uses TanStack Query, not raw `fetch` with ad-hoc `useEffect` state.
- Pages and components read cached governance data via `lib/data.ts`, not direct Koios calls.
- Migrations go through Supabase MCP. After a migration, regenerate and commit `types/database.ts`.

These constraints are enforced by `npm run agent:validate`. `npm run codex:verify` is the Codex-safe baseline wrapper for this repo.

## Standard Commands

- `npm run codex:doctor` checks whether the current environment is review-ready or runtime-ready for app boot.
- `npm run codex:verify` runs the cheapest reliable Codex baseline check.
- `npm run codex:review-check` runs the full review-oriented verification set: lint, type-check, and unit tests.
- `npm run codex:runtime-check` validates required runtime env and then runs a production build, defaulting to mocked Google Fonts responses for restricted environments.
- On Windows Codex Desktop, if `npm run codex:review-check` hits `spawn EPERM`, run `npm run lint`, `npm run type-check`, and `npm run test:unit` as separate top-level commands instead.
- `npm run session:doctor` summarizes local branch, worktree, and stash state.
- `npm run worktree:new -- <name>` creates a local isolated worktree from `origin/main`.
- `npm run worktree:sync` syncs the shared checkout or an existing local worktree.
- `npm run pre-merge-check -- <PR#>` is the required pre-merge verification gate.
- `npm run deploy:verify` is the required post-merge deploy check.

## Cloud Workflow

- Treat Codex cloud as an isolated Linux checkout. Use bash-compatible setup and verification commands only.
- Start cloud tasks with `npm run codex:doctor` and `npm run codex:verify`, then add `npm run codex:review-check` or `npm run codex:runtime-check` only when the task needs them.
- Setup scripts can install dependencies, but any credential the agent needs during the task must be configured as an environment variable, not a setup-only secret.
- Keep agent internet access off by default. If a task genuinely needs network access during the agent phase, allowlist only the exact domains and HTTP methods required.
- Use `.env.codex.example` and `docs/codex-cloud.md` for runtime-enabled Codex cloud environments. Never copy `.env.local`.
- Prefer a low-privilege review environment by default. Use a separate runtime-enabled environment only when the task needs the app to boot or touch live integrations.

## Local Workflow

1. Prefer Codex cloud for autonomous work. Use local development when you need interactive browser debugging, manual investigation, or other human-in-the-loop workflows.
2. For local feature work in a shared checkout, create a fresh worktree with `npm run worktree:new -- <name>`.
3. Start from fresh `origin/main`. When resuming an existing local worktree or shared checkout, run `npm run worktree:sync`.
4. Read the context needed to understand the surrounding system, constraints, and adjacent abstractions. Use the strategy registry and manifest before diving into the larger vision docs.
5. Recommend and implement the most elegant solution justified by the problem, not the smallest possible diff.
6. Run `npm run codex:verify` and then the verification scope that proves the change is correct and robust for the affected area.
7. In status updates, final handoffs, and PRs, explain the impact of the work so the reasoning and consequences are clear.
8. For feature work, open a PR with `Summary`, `Existing Code Audit`, `Robustness`, and `Impact` sections.
9. Before merging, run `npm run pre-merge-check -- <PR#>`.
10. After merge, run `npm run deploy:verify`.

## Local Compatibility Notes

- `npm run gh:auth-status` and `npm run auth:repair` manage the repo-scoped GitHub CLI context for local workflows.
- Windows-only wrappers and `.claude` hooks are optional local adapters, not required repo infrastructure.
- If a local adapter or hook disagrees with this file, `AGENTS.md` and the portable package scripts win.
- On Windows Codex Desktop, keep `workspace-write` and prefer the approved npm wrappers. If a mutating Git or worktree command fails with `EPERM`, access denied, or a likely sandbox error, rerun it with escalation using an already-approved prefix instead of inventing a broader shell workaround.

## Autonomy Boundary

Routine reads, edits, local verification, git hygiene, and PR preparation should not require approval. Pause for:

- destructive production-data operations
- scope expansion beyond the request
- architectural forks with materially different tradeoffs
- secrets, credential rotation, or external account changes

## Setup Files

- `.codex/config.toml` contains trusted project-scoped Codex defaults for local Codex clients.
- `.mcp.json` contains local MCP credentials and stays ignored.
- `.mcp.example.json` is the sanitized template for new machines.
- `.claude/settings.local.json` contains local Claude overrides and stays ignored.
- `.claude/` and `.cursor/` are local adapter layers, not the primary Codex source of truth.
