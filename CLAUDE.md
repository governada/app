# Governada Claude Adapter

Canonical agent instructions live in `AGENTS.md`.

Claude Code should read `AGENTS.md` before doing any work in this repo. Files under `.claude/` are provider-specific adapters for Claude commands, hooks, skills, and local settings. They must delegate to the `AGENTS.md` workflow and repo `package.json` scripts instead of restating workflow, auth, worktree, or deployment policy here.
