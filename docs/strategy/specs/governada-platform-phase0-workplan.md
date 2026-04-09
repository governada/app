# Work Plan: Governada Platform 2026 Phase 0

> **Initiative**: [docs/strategy/plans/governada-platform-2026.md](../plans/governada-platform-2026.md)
> **Created**: 2026-04-09
> **Execution model**: Sequential baseline -> focused parallel analysis -> synthesis -> decision prep -> runtime gate
> **Purpose**: Convert Phase 0 of the Governada Platform 2026 initiative into concrete execution work with explicit artifacts, gates, and exit criteria.

---

## Phase 0 Mission

Phase 0 is not a rewrite. It is the work required to make the rest of the initiative safe and precise.

It exists to answer four questions before architecture changes accelerate:

1. Can the team execute the initiative safely in Codex cloud and macOS-first local workflows?
2. What exactly is the current architecture, by product domain and runtime dependency?
3. What staging and runtime-safety model is required before enabling a privileged cloud runtime environment?
4. Which architectural decisions need ADRs before implementation work begins?

The output of Phase 0 is decision leverage, not visible product reinvention.

---

## Phase 0 Deliverables

By the end of Phase 0, the repo should contain or have validated:

- a working `governada-review` Codex cloud environment
- a verified review command contract for cloud/macOS-first work
- a documented staging/runtime safety model
- an architecture inventory for:
  - product domains
  - route groups
  - data access paths
  - AI entrypoints
  - auth touchpoints
  - runtime dependencies
- an ADR backlog for the unresolved platform gates
- a go/no-go decision for creating `governada-runtime`

---

## Execution Principles

1. **Environment safety first.** No privileged runtime cloud environment until non-production runtime expectations are explicit.
2. **Document what exists before redesigning it.** The initiative should respond to the actual repo, not a remembered mental model.
3. **Separate discovery from decision.** Phase 0 can prepare decisions without forcing all of them immediately.
4. **Prefer artifacts over discussion.** Every analysis task should land as a tracked doc, checklist, or ADR candidate.
5. **Do not let hosting migration become the first move.** Runtime changes are downstream of inventory, safety, and domain boundaries.

---

## Artifact Map

These are the concrete outputs Phase 0 should produce.

| Artifact | Purpose | Status |
| --- | --- | --- |
| `docs/strategy/plans/governada-platform-2026.md` | Initiative-level strategy, phases, gates, and target architecture | Exists |
| `docs/strategy/specs/governada-platform-phase0-workplan.md` | This execution document | New |
| `docs/strategy/specs/governada-platform-architecture-inventory.md` | Inventory of current routes, domains, data paths, AI, auth, runtime dependencies | Exists |
| `docs/strategy/specs/governada-platform-runtime-safety.md` | Staging, env, secret, and cloud runtime safety model | Exists |
| `docs/strategy/decisions/*.md` | ADRs for the major unresolved platform decisions | Phase 0 prep / later decisions |

---

## Workstreams

### Workstream A: Environment Baseline

Goal: validate that the review-grade cloud path is real and sufficient for most initiative work.

Outputs:

- `governada-review` exists
- review tasks can run `codex:doctor` and `codex:verify`
- repo docs match actual cloud usage

### Workstream B: Runtime Safety

Goal: define the line between review-safe and runtime-safe work.

Outputs:

- staging/runtime safety model
- approved env var classes
- production-coupling risks called out
- go/no-go rule for `governada-runtime`

### Workstream C: Architecture Inventory

Goal: replace intuition with a concrete map of the current system.

Outputs:

- route and domain inventory
- data and cache path inventory
- AI usage inventory
- auth and privileged-action inventory
- hosting/runtime dependency map

### Workstream D: Decision Prep

Goal: turn the initiative's big open questions into properly framed decisions.

Outputs:

- ADR backlog
- recommended sequencing for decision writing
- criteria for each major gate

---

## Chunk Plan

### Chunk 0A: Review Environment Validation

**Priority**: P0  
**Effort**: S  
**Depends on**: None  
**PR group**: A

### Scope

- confirm `governada-review` has been created
- run the baseline smoke task in Codex cloud:
  - `npm run codex:doctor`
  - `npm run codex:verify`
- record any gaps between repo docs and actual environment behavior
- confirm Node 20 and setup assumptions are correct

### Expected Artifacts

- no new artifact required if the smoke test passes cleanly
- doc fixes only if the environment behavior contradicts [docs/codex-cloud.md](../codex-cloud.md)

### Verification

- review environment can execute the baseline commands
- no runtime env vars are required for review work

---

### Chunk 0B: Runtime Safety Model

**Priority**: P0  
**Effort**: M  
**Depends on**: 0A  
**PR group**: A

### Scope

- define safe categories for:
  - local env files
  - cloud env variables
  - setup-only secrets
  - staging credentials
  - read-only vs write-capable runtime tasks
- define the minimum required conditions for creating `governada-runtime`
- document what is currently unsafe in the repo:
  - `.env.local` production coupling
  - runtime checks needing privileged env
  - any app flows that still assume production-connected state

### Expected Artifact

- `docs/strategy/specs/governada-platform-runtime-safety.md`

### Verification

- clear yes/no rule exists for when `governada-runtime` may be created
- staging/read-only expectations are explicit

---

### Chunk 0C: Architecture Inventory

**Priority**: P0  
**Effort**: L  
**Depends on**: 0A  
**PR group**: B

### Scope

Create a practical inventory of the current architecture with the goal of supporting later boundary work.

Inventory sections:

- current route groups and their primary persona/product jobs
- candidate `Discovery` vs `Studio` vs `Shared` classification
- current data flow:
  - source of truth
  - sync pipeline
  - server reads
  - client reads
  - cache surfaces
- AI usage map:
  - providers
  - routes
  - UI entrypoints
  - background jobs
  - prompt/tool hotspots
- auth map:
  - wallet auth paths
  - session validation points
  - admin or privileged action paths
- runtime dependency map:
  - Railway
  - Cloudflare
  - Inngest
  - Supabase
  - Upstash
  - external APIs

### Expected Artifact

- `docs/strategy/specs/governada-platform-architecture-inventory.md`

### Verification

- a new engineer could use the doc to understand the current stack shape without scanning the entire repo
- every major initiative track has a factual baseline to build from

---

### Chunk 0D: Decision Backlog And ADR Scoping

**Priority**: P0  
**Effort**: M  
**Depends on**: 0B, 0C  
**PR group**: C

### Scope

Turn the platform initiative's open gates into a decision backlog with explicit criteria, owners, and prerequisite discovery.

Required decision candidates:

- hosting direction: Railway vs Vercel for the web tier
- deployable topology: one app vs split deployables
- canonical Studio content model
- collaboration plane: Liveblocks-first vs Electric-first
- AI platform shape: provider-neutral gateway design
- auth hardening direction for wallet-native sessions and privilege boundaries

### Expected Artifacts

- updates to `docs/strategy/plans/governada-platform-2026.md` if sequencing or framing changes
- optional ADR stub files if the team wants to pre-create them
- at minimum, a decision backlog section added to the architecture inventory or runtime safety doc

Current landing spot:

- [governada-platform-architecture-inventory.md](governada-platform-architecture-inventory.md) now contains the Phase 0 decision backlog baseline

### Verification

- every unresolved gate has:
  - a question
  - default recommendation
  - required inputs
  - suggested decision window

---

### Chunk 0E: Runtime Environment Gate

**Priority**: P0  
**Effort**: S  
**Depends on**: 0B, 0C, 0D  
**PR group**: D

### Scope

Make the explicit call on whether to create `governada-runtime`.

Decision rule:

- create it only if staging/read-only runtime credentials exist and the runtime safety model is accepted
- otherwise defer it and continue with review-only cloud execution during Phase 1

### Expected Artifact

- decision recorded in one of:
  - `docs/strategy/plans/governada-platform-2026.md`
  - a strategy decision doc under `docs/strategy/decisions/`
  - a new ADR if the decision carries long-lived architectural consequences

### Verification

- there is no ambiguity about whether the runtime environment should exist yet

---

## Parallelization Model

Recommended execution order:

1. `0A` first and alone
2. `0B` and `0C` can proceed in parallel once `0A` is complete
3. `0D` depends on both `0B` and `0C`
4. `0E` is the close-out gate

If using multiple agents:

- Agent 1: runtime safety
- Agent 2: architecture inventory
- Main agent: synthesis, decision backlog, and runtime gate

---

## File Ownership Guidance

Phase 0 is mostly documentation and repo-contract work.

| Chunk | Likely files |
| --- | --- |
| `0A` | `docs/codex-cloud.md`, `AGENTS.md`, `package.json` if validation gaps are discovered |
| `0B` | new runtime safety doc, possibly env templates and cloud docs |
| `0C` | new architecture inventory doc, possible references from initiative |
| `0D` | initiative doc, strategy decisions, ADR backlog notes |
| `0E` | initiative doc and/or a decision record |

---

## Exit Criteria

Phase 0 is complete when all of the following are true:

- `governada-review` is operational
- review workflows are verified in cloud
- a runtime safety model exists
- an architecture inventory exists
- the major platform decisions have explicit backlog framing
- there is a documented yes/no outcome for creating `governada-runtime`

If any one of those is missing, Phase 0 is still open.

---

## Non-Goals

Phase 0 does **not** include:

- hosting migration
- repo or runtime split
- collaboration layer implementation
- AI gateway implementation
- visual redesign of Discovery or Studio
- feature delivery unrelated to platform readiness

---

## Recommended Immediate Next Action

Execute Chunk `0A` by running the first smoke task in `governada-review`, then use:

- [governada-platform-runtime-safety.md](governada-platform-runtime-safety.md)
- [governada-platform-architecture-inventory.md](governada-platform-architecture-inventory.md)

as the baseline inputs for Chunk `0D`.

Suggested cloud smoke prompt:

```text
In the governada-review environment on main, run:
1. npm run codex:doctor
2. npm run codex:verify
Then summarize whether the environment is review-ready and list any blockers.
```
