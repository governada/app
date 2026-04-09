# Codex Cloud Setup

This repo supports Codex cloud best when you use a low-privilege review environment by default and a separate runtime-enabled environment only for tasks that need the app to boot.

For trusted local Codex clients, repo-scoped defaults live in [`.codex/config.toml`](C:/Users/dalto/governada/governada-app/.codex/config.toml). Cloud tasks still primarily follow [AGENTS.md](C:/Users/dalto/governada/governada-app/AGENTS.md) plus the selected Codex cloud environment settings.

## Recommended Environments

### `governada-review`

Use for:

- code review
- docs changes
- static refactors
- targeted fixes that do not need live services

Recommended settings:

- Image: default `universal`
- Node.js: `20`
- Setup script:

```bash
set -euxo pipefail
node --version
npm ci
```

- Maintenance script: leave blank initially
- Agent internet access: `Off`

Recommended verification baseline:

```bash
npm run codex:doctor
npm run codex:verify
```

Then add only the smallest scope-specific command needed for the task.

For review-heavy tasks that need stronger confidence:

```bash
npm run codex:review-check
```

### `governada-runtime`

Use only for:

- tasks that need `npm run dev`, `npm run build`, or other runtime behavior
- tasks that need configured third-party services
- debugging environment-dependent issues

Recommended settings:

- Image: default `universal`
- Node.js: `20`
- Setup script:

```bash
set -euxo pipefail
node --version
npm ci
```

- Maintenance script: leave blank initially
- Agent internet access: keep `Off` unless the agent phase truly needs live network access

Recommended runtime verification:

```bash
npm run codex:runtime-check
```

`npm run codex:runtime-check` defaults to `GOVERNADA_DISABLE_REMOTE_FONTS=1`, which tells the runtime check to use repo-local mocked Google Fonts responses instead of live fetches. If you want runtime tasks to exercise the exact branded fonts, unset that variable and allowlist:

- `fonts.googleapis.com`
- `fonts.gstatic.com`

If the agent phase needs network access, keep the allowlist narrow. Typical hosts for this repo may include:

- `api.koios.rest`
- your Supabase project host
- your Upstash Redis host
- any specific analytics or observability host required for the task

Prefer `GET`, `HEAD`, and `OPTIONS` only unless the task explicitly needs write calls.

## Environment Variables

Codex cloud environment variables stay available during the full task, including the agent phase. Codex cloud secrets are only available to setup scripts and are removed before the agent phase, so runtime credentials for this app must be configured as environment variables, not setup-only secrets.

Use [`.env.codex.example`](C:/Users/dalto/governada/governada-app/.env.codex.example) as the sanitized starting point.

Required runtime variables currently enforced in [lib/env.ts](C:/Users/dalto/governada/governada-app/lib/env.ts):

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SECRET_KEY`
- `SESSION_SECRET`
- `CRON_SECRET`
- `UPSTASH_REDIS_REST_URL`
- `UPSTASH_REDIS_REST_TOKEN`

Optional runtime variable for restricted builds:

- `GOVERNADA_DISABLE_REMOTE_FONTS=1` so `npm run codex:runtime-check` uses repo-local mocked Google Fonts responses instead of live font fetches

Do not copy [`.env.local`](C:/Users/dalto/governada/governada-app/.env.local) into Codex cloud. This repo treats that file as production-connected local state.

## Repo-Specific Guidance

- Follow [AGENTS.md](C:/Users/dalto/governada/governada-app/AGENTS.md).
- In Codex cloud, skip the local Windows worktree workflow. The cloud container is already isolated per task.
- Do not use Windows-only PowerShell wrappers in setup or maintenance scripts.
- Start from `npm run codex:doctor` and `npm run codex:verify` before adding heavier checks.
- Use `npm run codex:review-check` for a full review gate and `npm run codex:runtime-check` for app-enabled runtime environments.
- Prefer staging or read-only credentials for any runtime-enabled environment.
- Treat `.claude/` hooks and other desktop-specific adapter layers as optional local tooling, not required Codex cloud infrastructure.

## What To Avoid

- Do not use `.env.local` in Codex cloud.
- Do not run sync backfills or other write-heavy production operations without explicit approval.
- Do not enable unrestricted agent internet access unless there is a clear task-specific reason.
