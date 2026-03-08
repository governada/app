# Civica Operations Guide

> **For:** You, the founder. Not agents.
> **Purpose:** Everything you need to run this project at the highest standard, organized by when you need it.
> **Philosophy:** You're building the governance platform that represents Cardano to the world. Every session should leave the product measurably better than you found it.

---

## Your Toolkit (Quick Reference)

| When | Command | What it does |
|------|---------|-------------|
| Starting a session | `/start` | Orients: branch status, lessons, in-progress work, git hygiene |
| Planning what to build | `/audit` | 10-dimension product audit with work plan for parallel agents |
| Checking sync health | `/audit-sync` | Pipeline reliability, performance, self-healing evaluation |
| Checking data quality | `/audit-data` | Integrity, completeness, consistency across all tables |
| Reviewing scoring rigor | `/audit-scoring` | Methodology, calibration, gaming resistance |
| After agents build | `/verify-audit` | Confirms previous gaps were closed |
| Shipping code | `/ship` | Full deploy pipeline: preflight → PR → CI → merge → deploy → verify |
| Quick production fix | `/hotfix` | Single-commit fix directly on main |
| Recording a lesson | `/learn` | Saves insight to persistent memory |
| End of session | `/retro` | Captures learnings, prunes stale docs |

---

## The Rhythm

### Every Session (15 min setup)

1. **Start clean.** Run `/start`. It checks your branch, reviews lessons, flags stale work.
2. **Know your goal.** Before opening code, decide: am I building a feature, fixing a bug, doing an audit, or exploring? Different modes need different context.
3. **End clean.** Either commit or explicitly note what's uncommitted. Run `/retro` if you learned something worth remembering.

### Weekly (1 hour)

1. **Sync health spot-check.** Quick `/audit-sync` — just glance at `v_sync_health` for failures, check if any syncs are running close to their staleness thresholds. This catches problems before they compound.
2. **Data freshness glance.** Check the admin integrity dashboard at `/admin/integrity` on production. The 6 KPI cards tell you immediately if something's off.
3. **Push pending work.** If you have uncommitted changes or open PRs from the week, either ship them or close them. Stale branches create confusion.

### Monthly (half day)

1. **Focused product audit.** Run `/audit step:N` on whatever step you're actively building. This gives you a tight, actionable work plan instead of boiling the ocean.
2. **Full sync audit.** Run `/audit-sync` — check error rates, self-healing effectiveness, performance trends. The sync pipeline is the plumbing; if it degrades silently, every surface suffers.
3. **Data integrity audit.** Run `/audit-data` — verify snapshot coverage, check for orphan records, validate score distributions. This is where you catch "the data looks fine but is actually wrong" issues.
4. **Update competitive landscape.** During the product audit, agents will WebSearch competitors. Review their findings in `competitive-landscape.md`. If a competitor shipped something interesting, note it.

### Quarterly (full day)

1. **Full product audit.** Run `/audit` (no arguments). All 10 dimensions, all evidence, full work plan. This is your strategic checkpoint.
2. **Scoring methodology audit.** Run `/audit-scoring` — review calibration values, run gaming scenarios, check if score distributions are healthy. This is when you decide if any calibration values need adjustment.
3. **Verify previous quarter's work.** Run `/verify-audit` against the last quarter's work plan. Did you actually close the gaps you identified? Score history in `build-manifest.md` shows your trendline.
4. **Review the vision.** Read `ultimate-vision.md` and ask: does this still reflect where we're going? Update if needed. This is the only time you should read the full 950-line document.

### Per Epoch (~5 days)

You don't need to do anything manual per epoch — the Inngest pipeline handles data collection, briefing generation, and snapshot creation automatically. But it's worth checking:
- Did `generate-citizen-briefings` run? (check sync_log)
- Did snapshot tables get new entries? (check-snapshot-completeness does this automatically)
- Is GHI trending as expected?

---

## How to Run a Build Session

This is the workflow that maximizes quality per session:

### 1. Audit → Work Plan (30 min)

Run the appropriate audit command. The output is a prioritized list of chunks with dependencies, PR grouping, and decision points.

### 2. Decide → Clarify (15 min)

Review the work plan. For each chunk:
- **P0 (critical):** Do these first. They block other work.
- **Decision points:** Answer these NOW, before agents start building. A wrong assumption here wastes an entire session.
- **Parallel opportunities:** Identify chunks that can run simultaneously (different files, no dependencies).

### 3. Execute → Ship (bulk of session)

Launch agents on independent chunks in parallel using worktrees:
```
claude --worktree chunk-a    # Agent 1: scoring fix
claude --worktree chunk-b    # Agent 2: UI improvement (different files)
```

Each agent should:
- Deep-dive into the relevant files before building
- Ask you targeted questions if the chunk has decision points
- Follow the full `/ship` pipeline when done

### 4. Verify → Close (15 min)

After agents ship their chunks:
- Run `/verify-audit` to confirm gaps were closed
- Check production (hit the endpoints, look at the pages)
- Update `build-manifest.md` if checkboxes changed
- Run `/retro` to capture any lessons

---

## Quality Standards (Your Checklist)

These are the standards you hold yourself and your agents to. If any of these slip, the product's credibility as "Cardano's governance platform" slips with it.

### Code Quality
- [ ] TypeScript strict, no `any` types except at system boundaries
- [ ] Every client-side fetch uses TanStack Query
- [ ] Every route touching Supabase has `force-dynamic`
- [ ] Every new Inngest function is registered in `route.ts`
- [ ] No `console.log` in production code
- [ ] Pre-commit hooks catch formatting and lint issues

### Data Quality
- [ ] Every new metric gets snapshot tables from day one (data compounds)
- [ ] Zod validation on all external data sources (Koios, user input)
- [ ] Sync functions have `onFailure` handlers
- [ ] Score distributions spread across 0-100 (not clustering)
- [ ] Hash verification rates >98%

### UX Quality
- [ ] Citizens get briefings, not dashboards
- [ ] Every page has loading skeleton, error state, and empty state
- [ ] Mobile works (design for phones, adapt for desktop)
- [ ] Scores tell stories ("72 means your DRep is solid but missed 3 votes")
- [ ] Every insight connects to an action

### Scoring Quality
- [ ] All calibration values documented with rationale
- [ ] No single-signal gaming strategy produces a high score
- [ ] Percentile normalization handles ties correctly
- [ ] Temporal decay reflects real governance windows (6-month half-life)
- [ ] Score methodology is defensible if challenged publicly

### Deployment Quality
- [ ] Preflight passes before every push
- [ ] CI green before every merge
- [ ] Pre-merge check blocks if CI is running on main
- [ ] Railway logs checked after deploy
- [ ] Production endpoints verified after deploy
- [ ] Inngest functions re-registered (PUT) if changed

---

## The Files That Matter

You don't need to read all 950 lines of the vision doc. Here's what to actually reference:

| Situation | Read This | Why |
|-----------|-----------|-----|
| "What should I build next?" | `build-manifest.md` | Checkbox list of what's done, what's not |
| "How should this feature work?" | Relevant persona doc in `docs/strategy/personas/` | Each persona has a complete product spec |
| "Is this a good idea?" | `.claude/rules/product-strategy.md` | 11 principles + 6 engineering principles |
| "How should this look?" | `.claude/rules/product-vision.md` | Design principles + UX rules |
| "What's our current score?" | Bottom of `build-manifest.md` | Audit score history trendline |
| "What are competitors doing?" | `competitive-landscape.md` | Updated during audits |
| "What did I learn last time?" | Memory files (auto-loaded) | Persistent across sessions |

---

## Decision Framework

When you're unsure about a product or architecture decision, run it through these filters in order:

1. **Does it serve the citizen?** (Principle #1) — If it doesn't ultimately make an ADA holder's life better, question it.
2. **Does it feed the flywheel?** (Engineering Principle #6) — If this feature's data doesn't improve other surfaces, it might be a dead end.
3. **Is it persona-appropriate?** (Principle #4) — Citizens need briefings, DReps need workspaces. Don't give everyone the same product.
4. **Can it be gamed?** — If a DRep/SPO can trivially inflate their position, the scoring loses credibility.
5. **Does it compound?** — Features that get better over time (snapshot data, engagement history) are worth more than features that are static.
6. **Is it the simplest version?** — Don't over-engineer. Three similar lines of code beat a premature abstraction.

---

## Common Pitfalls (Learned the Hard Way)

These are patterns that have cost you time in the past:

1. **"PR created — merge when ready"** is NOT done. Code compiling locally is 60% of the job. The other 40% is the deploy pipeline.
2. **Developing on main or a stale branch.** Always start from fresh main, always create a feature branch first.
3. **Skipping post-deploy verification.** After merge, you MUST check Railway logs and hit production endpoints. Things that pass CI can still break in production.
4. **Reading the full vision doc for routine decisions.** The rules files and build manifest are sufficient 95% of the time. Save the vision doc for quarterly reviews.
5. **Not installing npm packages before merging.** If an agent scaffolds an import without `npm install`, Railway build breaks.
6. **Letting worktrees accumulate.** After a PR merges, remove the worktree immediately. Stale worktrees cause confusion and disk waste.

---

## Measuring Progress

Your north star metrics:

| Metric | How to Measure | Target |
|--------|---------------|--------|
| Product audit score | `/audit` total score | Increasing quarter over quarter |
| Sync reliability | `/audit-sync` S1 dimension | 8+/10 |
| Data integrity | `/audit-data` D1+D2 dimensions | 8+/10 each |
| Scoring differentiation | `/audit-scoring` M1 dimension | 8+/10 |
| Build velocity | PRs merged per week | Consistent (not declining) |
| Vision completion | `build-manifest.md` checkbox % | Step 7 → Step 8 progression |

The audit score history at the bottom of `build-manifest.md` is your trendline. If scores are flat or declining across quarters, something is wrong with your process, not your code.

---

## When Things Go Wrong

### Sync is broken
1. Check `/admin/integrity` on production
2. Run `/audit-sync` to identify the specific pipeline
3. Check `sync_log` for recent failures
4. The freshness guard should self-heal within 30 min — if it doesn't, the failure is permanent (e.g., Koios API changed)

### Scores look wrong
1. Run `/audit-scoring calibration` to check distribution
2. Query actual score distributions from Supabase
3. Check if a sync failure left stale data
4. Check if calibration values need adjustment (quarterly review)

### Production is down
1. Run `/hotfix` for single-commit fixes
2. Check Railway logs for the crash
3. Check Sentry for the error
4. Check Cloudflare for 524 timeouts (usually means an Inngest step exceeded 100s)

### An agent built something wrong
1. Don't let it merge. Review the PR diff.
2. If already merged, create a revert PR (`git revert <sha>`)
3. Run `/learn` to record what went wrong so it doesn't happen again
4. Check if a rule or hook should be added to prevent the class of error

---

## The Long Game

You're building a product with a compounding data moat. Every day the system runs, the moat deepens:
- Every snapshot creates history a competitor can never replicate
- Every citizen engagement signal creates intelligence no one else has
- Every epoch of scoring builds reputation records that compound

The audits, the quality checks, the calibration reviews — they're not overhead. They're how you ensure the compounding works correctly. A scoring system that loses community trust is worse than no scoring system at all.

The cadence exists so you never have to do a "big cleanup." Small, regular quality checks prevent the kind of debt that requires a rewrite. Trust the rhythm.
