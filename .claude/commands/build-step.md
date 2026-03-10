Build a vision step end-to-end: research, plan, get user approval, execute in parallel, deploy autonomously.

## Input

Argument: `$ARGUMENTS` — Required: step/phase number (e.g., "2", "3"). Optional scope qualifier.

## Checkpoint System

Writes session state to `.claude/checkpoints/build-step-[N].md` after each phase. If context compacts or session resumes, read the checkpoint file to recover state.

## Phase 1: Vision Intelligence (3 Parallel Subagents)

Launch ALL simultaneously. READ-ONLY research. Each writes findings to a checkpoint file.

**1A. Vision Analyst** — "Read `docs/strategy/ultimate-vision.md` Phase [N] + `docs/strategy/context/build-manifest.md` + relevant persona docs. Extract every remaining [ ] item with: feature name, vision spec, persona impact, dependencies, success criteria. Flag ambiguities as decision points. **Write findings to `.claude/checkpoints/build-step-[N]-vision.md`**. Return: item count, decision point count."

**1B. Codebase Scout** — "Read build-manifest for Phase [N] requirements. Search codebase for: partial implementations, patterns to follow, reusable infrastructure, integration points. Check database tables + migrations. **Write findings to `.claude/checkpoints/build-step-[N]-codebase.md`**. Return: existing work summary, technical risk count."

**1C. Audit Pre-Screen** — "Read build-manifest for Phase [N]. Read audit command files + `audit-rubric.md`. For each affected audit dimension: define what 8+/10 looks like for this phase's features. **Write findings to `.claude/checkpoints/build-step-[N]-audit.md`**. Return: affected dimension count."

**After all return**, write consolidated checkpoint to `.claude/checkpoints/build-step-[N].md` with status `PHASE_2_PLANNING`, phase 1 summary, and links to detail files.

## Phase 2: Architecture Proposal

Read all Phase 1 checkpoint files. Synthesize into a build plan per `docs/strategy/context/work-plan-template.md`:

1. **Chunk breakdown**: PR-sized chunks with priority, effort, audit dimensions, files, patterns
2. **Decision points**: Question, options with pros/cons, recommendation, reversibility
3. **Assumption challenges**: State, challenge, mitigation for each implicit assumption
4. **World-class bar**: Per chunk — solid (7/10) vs world-class (9+/10), let user decide
5. **Merge sequence**: Independent (parallel) → grouped (atomic) → sequential (ordered)

## Phase 3: Decision Gate (MANDATORY PAUSE)

Present full plan. Ask: chunk breakdown OK? Decision point preferences? Solid vs world-class per chunk? Scope changes? **Do NOT proceed until user approves.**

Send notification: `bash scripts/notify.sh "decision_gate" "/build-step [N]: Plan ready" "[chunk count, migration count, estimated time]"`

**Update checkpoint**: Set status to `PHASE_4_EXECUTING`, record approved decisions.

## Phase 4: Parallel Execution

Launch chunk agents in worktrees (`isolation: "worktree"`).

Each agent gets: scope, approved decisions, quality targets, patterns to follow, files to read. Instructions: read first → implement → follow CLAUDE.md constraints → meet quality targets → preflight → commit → `gh auth switch --user drepscore` → push → create PR → wait for CI (max 3 retries) → STOP, report PR#/files/tests/CI/quality targets met.

**Escalation rules**: Unexpected decision → STOP. Missing dependency → STOP. Otherwise proceed autonomously.

Parallelism: independent chunks launch simultaneously. Same-PR groups = one agent. Dependent chunks wait for dependency merge.

**Update checkpoint**: Record each PR# and status as agents complete.

## Phase 5: Autonomous Deployment

Read `.claude/rules/deploy-config.md` for mode. Follow deploy pipeline in `docs/strategy/context/commands-reference.md`.

For each PR group in merge order: rebase check → `pre-merge-check.sh` → merge (squash) → apply migrations → wait for Railway → Inngest sync if needed → smoke test. If smoke test FAILS → STOP entire sequence, alert user.

Between groups: rebase next group's branches onto updated main.

## Phase 6: Post-Build Verification

1. Launch targeted audit subagents for affected dimensions only
2. Validate affected user journeys
3. Update `build-manifest.md` checkboxes
4. Present completion report: PRs deployed, audit scores (pre vs post vs target), remaining work

Send notification: `bash scripts/notify.sh "complete" "/build-step [N] finished" "[results summary]"`

**Update checkpoint**: Set status to `COMPLETE`, record final scores.

## Rules

- Phase 3 is NON-NEGOTIABLE — user must approve before code
- Checkpoint file is written after EVERY phase transition
- Chunk agents escalate, never guess
- Smoke test failures STOP the sequence
- Audit pre-alignment prevents rework — every chunk gets quality targets
