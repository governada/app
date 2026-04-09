# Governada Platform 2026

> **Status:** PROPOSED
> **Created:** 2026-04-09
> **Origin:** Architecture review after the product vision expanded from a governance intelligence app into a dual-surface product: public discovery plus premium AI-native Studio workflows.
> **Goal:** Evolve Governada from a strong single-app stack into a world-class platform for two distinct experiences: `Discovery` and `Studio`.

---

## Why This Exists

Governada's current stack was chosen for an earlier product shape. Over two months of iteration, the product has moved significantly:

- The public experience is no longer just a data dashboard. It is a differentiated 3D discovery and engagement surface.
- The premium surface is no longer just an admin area. It is aiming toward a serious AI-native workspace that blends elements of Cursor, Linear, and Notion.
- AI is no longer a support feature. It is a first-class part of how users explore, decide, draft, review, and act.

The existing stack is not wrong. In fact, much of it is still strong. The problem is that the current topology is optimized for a single app with shared assumptions, while the product is now clearly asking for:

1. Two explicit product surfaces with different jobs, interaction models, and visual languages.
2. A provider-neutral AI platform instead of vendor-specific integrations scattered through the app.
3. A more deliberate answer to collaboration, local-first behavior, and premium workspace architecture.
4. Fewer overlapping infrastructure control planes.

This initiative exists to address that drift deliberately instead of letting it accumulate as incidental complexity.

---

## Executive Summary

1. Keep the core app stack: `Next.js`, `React`, `TypeScript`, `Supabase/Postgres`, `TanStack Query`, `Tiptap`, `react-three-fiber`, `Inngest`, `Sentry`, `PostHog`, and wallet-native custom auth.
2. Split the product architecture into two bounded domains: `Discovery` and `Studio`.
3. Keep one repo and one deployable in the near term, but introduce explicit domain boundaries before considering any runtime split.
4. Introduce a provider-neutral AI platform layer with tracing, prompt versioning, evals, fallback routing, and tool contracts.
5. Re-open the collaboration/local-first question as a deliberate decision gate rather than treating it as permanently deferred.
6. Set up the low-privilege `governada-review` Codex cloud environment immediately. Defer the privileged `governada-runtime` environment until Phase 0 exit criteria are met.

---

## What Stays, What Changes

### Keep

- `Next.js 16 + React 19 + TypeScript` as the web and application foundation.
- `Supabase/Postgres` as the system of record for structured governance and workspace data.
- `TanStack Query` for client-side mutation and cache ergonomics.
- `Tiptap` as the editor foundation for rich authoring and AI-assisted editing.
- `react-three-fiber` and `three` for the constellation and immersive discovery layer.
- `Inngest` for durable background execution, retries, scheduled workflows, and AI post-processing.
- `Sentry` and `PostHog` for product and runtime visibility.
- Wallet-native custom auth, because Cardano wallet signatures remain a real product requirement that generic SaaS auth does not solve cleanly.

### Reshape

- One undifferentiated app shell into two explicit product domains: `Discovery` and `Studio`.
- Vendor-specific AI integrations into one provider-neutral AI platform layer.
- Markdown-first workspace persistence into structured canonical document storage with derived export formats.
- Blanket dynamic rendering into explicit freshness tiers using modern Next.js caching primitives.
- A single design language stretched across all surfaces into a shared brand foundation plus two distinct operating systems.
- The current "many control planes" hosting posture into a more intentional runtime model.

### Later

- `Liveblocks` if the hardest premium problem is real-time editing, comments, presence, and multiplayer authoring.
- `Electric` if the hardest premium problem becomes Linear-style local-first structured sync, offline workflows, and low-latency collaborative state.
- `pgvector` and richer retrieval infrastructure once the AI platform layer is stable.
- Realtime voice or ambient spatial AI only after Discovery and Studio are already excellent without them.

### Never

- Rebuild the editor from scratch.
- Move core transactional state into Redis.
- Split into many microservices before domain boundaries are stable.
- Treat Windows desktop automation as a strategic product/platform path.
- Force the same visual grammar onto both Discovery and Studio.

---

## Product Boundaries

### Discovery

`Discovery` is the public and civic-facing experience. It should feel atmospheric, legible, and revealing.

Primary jobs:

- discover governance entities, proposals, and system dynamics
- understand the state of the ecosystem quickly
- explore relationships through the constellation and related visual systems
- build confidence, trust, and curiosity
- convert users into deeper engagement or premium workflows

Architecture bias:

- server-heavy
- cache-friendly
- narrative-first
- progressive enhancement for 3D and advanced visualizations
- resilient in degraded network conditions

### Studio

`Studio` is the premium workbench. It should feel intentional, dense, and operational.

Primary jobs:

- draft, review, compare, annotate, and refine content
- orchestrate AI-assisted reasoning and editing
- manage workflows, queues, states, and approvals
- preserve context across sessions
- support premium JTBDs that feel superior to generic documents or issue trackers

Architecture bias:

- action-heavy
- optimistic UI
- keyboard-first
- collaboration-ready
- structured data and structured documents
- stronger internal instrumentation than the public app

---

## Target Architecture

### Recommended Migration Topology

This initiative does **not** recommend an immediate big-bang rewrite.

#### Near Term

- one repo
- one Next.js application
- two explicit route and package domains: `Discovery` and `Studio`
- one shared design-token foundation
- one shared data and auth platform

#### Medium Term

- shared domain packages extracted inside the monorepo
- AI platform separated from app surfaces
- Studio kernel stabilized
- collaboration plane selected and implemented

#### End State

- still one repo
- either one deployable with clean domain boundaries, or two deployables if the split produces clear operational value
- the split is a **decision gate**, not a starting assumption

### Layer Model

| Layer | Target | Notes |
| --- | --- | --- |
| Web framework | Next.js 16 App Router + React 19 | Lean harder into RSC and Cache Components where appropriate |
| Public UX | RSC-heavy Discovery shell | Static or cached outer shell, dynamic islands only where needed |
| Premium UX | Client-heavier Studio shell | Stronger local state, optimistic actions, collaboration hooks |
| Data system of record | Supabase/Postgres | Continue as the center of gravity |
| Background execution | Inngest | Keep durable steps, retries, schedules, and fan-out workflows |
| AI platform | Internal gateway + provider adapters | Models become interchangeable infrastructure |
| Collaboration plane | Decision gate: Liveblocks first or Electric first | Chosen based on the dominant premium JTBD |
| Cache and coordination | Redis/Upstash for rate limiting and ephemeral coordination only | Not canonical state |
| Observability | Sentry + PostHog + AI traces/evals | Product, runtime, and AI quality all visible |
| Edge/runtime | Railway or Vercel behind Cloudflare | Explicit gate in Phase 0 |

### Authentication Direction

Keep wallet-native authentication. Refine the implementation.

Target posture:

- keep wallet signature login and custom sessions
- centralize session validation and route protection
- reduce auth logic duplication across routes
- evaluate moving from broad service-role assumptions toward narrower scoped tokens where practical
- keep Supabase Auth out of the critical path unless it earns its way back in

---

## Design System Direction

Governada should keep one brand, but stop pretending it only needs one interaction language.

### Shared Foundation

Shared across the whole product:

- typography family
- base tokens
- semantic colors
- accessibility primitives
- motion tokens
- component quality bar
- brand identity

### Discovery Design System

Keep and deepen the current `Compass / Constellation` direction described in [design-language.md](../design-language.md).

Characteristics:

- atmospheric
- civic
- exploratory
- emotionally resonant
- narrative first
- visually distinctive

### Studio Design System

Introduce a separate Studio operating language. Working name: `Workbench`.

Characteristics:

- quieter
- denser
- keyboard-first
- lower visual drama
- more explicit hierarchy
- stronger panel and command metaphors

### Rule

`Discovery` should feel like an instrument for understanding the ecosystem.

`Studio` should feel like an instrument for getting high-stakes work done.

They should share DNA, not presentation.

---

## Relationship To Existing Strategy Docs

- [ultimate-vision.md](../ultimate-vision.md) remains the north star.
- [workspace-foundation.md](workspace-foundation.md) becomes the Studio-kernel input for Phase 2.
- [design-language.md](../design-language.md) remains the Discovery design foundation.
- [world-class-packages.md](../world-class-packages.md) remains the quality and polish track.
- [governada-platform-phase0-workplan.md](../specs/governada-platform-phase0-workplan.md) is the execution document for Phase 0 baseline, safety, inventory, and decision-prep work.
- This initiative does not replace those documents. It coordinates them into a platform-level program.

---

## Initiative Tracks

### Track A: Platform Baseline

Goal: make architecture work safe to execute.

Deliverables:

- `governada-review` Codex cloud environment live
- safe staging environment and safe local non-production env
- stable review and runtime verification contracts
- architecture inventory of routes, data paths, AI entrypoints, and runtime dependencies

### Track B: Domain Boundaries

Goal: make `Discovery` and `Studio` explicit in code and ownership.

Deliverables:

- route map and package map by domain
- explicit "shared vs discovery vs studio" module boundaries
- reduced cross-domain file churn
- ownership notes for future work packages

### Track C: Design System Split

Goal: keep one brand while creating two real operating systems.

Deliverables:

- shared token layer
- Discovery shell rules
- Studio shell rules
- component inventory tagged by domain
- migration plan for surfaces currently mixing both languages

### Track D: Studio Kernel

Goal: turn Studio into a real workspace substrate, not an accretion of feature components.

Deliverables:

- persistent workspace state model
- command registry and palette
- panel composition and persistence
- optimistic mutations
- canonical content model for Studio documents

### Track E: AI Platform

Goal: make AI infrastructure a platform, not a vendor dependency graph.

Deliverables:

- provider-neutral model gateway
- prompt and tool schema registry
- tracing and evals
- fallback routing
- explicit classification of AI responsibilities by workflow

### Track F: Collaboration Plane

Goal: choose and implement the right collaboration strategy for premium JTBDs.

Deliverables:

- decision gate between Liveblocks-first and Electric-first
- pilot implementation in one constrained Studio workflow
- documented conflict resolution and offline behavior

### Track G: Runtime and Infra

Goal: reduce platform sprawl and align runtime choices with the product's actual needs.

Deliverables:

- Railway vs Vercel decision
- hosting topology decision
- preview/runtime policy
- cache strategy and edge policy
- deploy verification and rollback standards

### Track H: Quality and Operability

Goal: raise confidence as architecture changes land.

Deliverables:

- stronger CI gates
- runtime health reporting
- AI-quality dashboards
- accessibility and performance budgets
- post-deploy verification standards

---

## Phases

### Phase 0: Baseline And Safety

**Objective:** make the initiative executable without locking in architecture too early.

### Deliverables

- validate `governada-review` Codex cloud environment
- do **not** create `governada-runtime` yet
- define safe staging credentials and env strategy in [governada-platform-runtime-safety.md](../specs/governada-platform-runtime-safety.md)
- verify review checks in cloud/macOS paths
- maintain the current system map in [governada-platform-architecture-inventory.md](../specs/governada-platform-architecture-inventory.md)

### Exit Criteria

- review environment is usable for autonomous code work
- staging exists or has an approved implementation path
- runtime dependencies are documented
- the team has enough confidence to create the runtime environment later without accidental production coupling

### Phase 1: Domain Boundaries

**Objective:** make the product split explicit before changing runtime or collaboration architecture.

### Deliverables

- `Discovery` and `Studio` route boundaries documented and enforced
- shared packages identified
- package extraction plan written
- current features mapped to product domains

### Exit Criteria

- a new feature can be classified as Discovery, Studio, or Shared without ambiguity
- shared code starts to look deliberate rather than incidental

### Phase 2: Design Systems And Studio Kernel

**Objective:** turn the current shell direction into an actual platform substrate.

### Deliverables

- shared token layer
- Discovery shell rules codified
- Studio shell rules codified
- Studio kernel implemented or largely scaffolded:
  - workspace state
  - command system
  - panel model
  - optimistic mutation conventions
- canonical content model decision implemented for at least one Studio workflow

### Exit Criteria

- Studio feels like one coherent workspace
- Discovery and Studio no longer fight for the same visual grammar

### Phase 3: AI Platform

**Objective:** make model usage auditable, portable, and reliable.

### Deliverables

- internal AI gateway with provider adapters
- prompt and tool registry
- request tracing
- evaluation framework for core AI workflows
- fallback policy for model/provider failures

### Exit Criteria

- critical AI workflows are no longer hard-bound to a single vendor path
- product teams can change model policy without rewriting feature code

### Phase 4: Collaboration Plane

**Objective:** choose the right premium collaboration architecture based on the actual dominant JTBD.

### Deliverables

- decision gate outcome: `Liveblocks first` or `Electric first`
- pilot workflow shipped on the chosen platform
- explicit model for presence, sync, offline behavior, and conflicts

### Exit Criteria

- the premium workspace has one credible collaboration story instead of several half-stories

### Phase 5: Runtime And Launch Quality

**Objective:** align infra and operations to the matured architecture.

### Deliverables

- Railway vs Vercel decision executed if warranted
- runtime environment and staging environment stabilized
- performance budgets
- accessibility budgets
- AI quality budgets
- post-deploy health and rollback standards

### Exit Criteria

- the runtime model matches the product shape
- platform decisions are no longer blocking product work

---

## Decision Gates

| Gate | Question | Default Recommendation | When |
| --- | --- | --- | --- |
| DG-1 | Should cloud setup start before the architecture initiative? | Yes for `governada-review`; no for `governada-runtime` until Phase 0 exit | Immediately |
| DG-2 | Should Governada stay on Railway or move the web tier to Vercel? | Stay open; decide after runtime inventory and caching review | Phase 0 |
| DG-3 | Should Governada split into multiple deployables? | No immediate split; enforce domain boundaries first | Phase 1 |
| DG-4 | What is the canonical Studio content model? | Structured document model first, markdown as derived output | Phase 2 |
| DG-5 | Which collaboration plane comes first? | Choose Liveblocks if rich text and comments dominate; choose Electric if structured local-first workflows dominate | Phase 4 |
| DG-6 | Should AI stay vendor-specific in app code? | No; move to an internal gateway and provider-neutral contracts | Phase 3 |
| DG-7 | Should auth stay custom wallet-native? | Yes, but centralize and harden the implementation | Phase 0-2 |

### Gate Notes

#### DG-2: Railway vs Vercel

Default posture:

- do not migrate hosting just because Vercel is fashionable
- do migrate if modern Next.js caching, previews, and operations are materially better there for this app
- keep Cloudflare for DNS, CDN, and security policy regardless

#### DG-5: Liveblocks vs Electric

Use `Liveblocks first` if:

- simultaneous editing
- inline comments
- presence
- multiplayer review

are the main premium differentiators.

Use `Electric first` if:

- structured entity sync
- local-first state
- offline support
- instant list/board/workflow UX

are the main premium differentiators.

Do not commit to both as first-class bets at the same time.

---

## Risks

### Risk 1: Platform Rewrite Without Product Wins

The initiative becomes an excuse to rebuild internals without creating user-visible improvement.

Mitigation:

- each phase must produce visible product leverage
- every infrastructure change must be attached to a premium or discovery outcome

### Risk 2: Boundary Theater

The codebase gets new folders and labels, but the boundaries are not real.

Mitigation:

- track cross-domain file churn
- enforce ownership and module rules
- test the boundaries with real feature work

### Risk 3: Collaboration Overbuild

The team implements a sophisticated local-first or multiplayer stack before the premium workflow proves it.

Mitigation:

- require DG-5
- ship one pilot first
- do not generalize from a hypothetical need

### Risk 4: AI Abstraction Too Early

The AI platform layer becomes elaborate before there are enough evaluations and product patterns to justify it.

Mitigation:

- start with core workflows only
- gateway, tracing, and fallbacks come first
- keep feature-level abstractions thin

### Risk 5: Hosting Migration Too Early

A runtime move absorbs attention before domain boundaries and caching strategy are settled.

Mitigation:

- hosting is a Phase 0 gate, not a precondition for the initiative
- only migrate with explicit operational upside

### Risk 6: Design Bifurcation Drift

Discovery and Studio become visually unrelated or duplicated.

Mitigation:

- shared tokens remain mandatory
- brand and accessibility rules remain shared
- split interaction language, not identity

---

## Success Metrics

### Platform Execution

- `governada-review` is live and used for routine autonomous work
- `governada-runtime` exists only after safe staging/runtime rules are in place
- no critical workflow depends on local Windows desktop automation

### Architecture Quality

- new work can be classified cleanly as `Discovery`, `Studio`, or `Shared`
- cross-domain file churn decreases over time
- Studio content has a canonical structured model
- AI providers are hidden behind one internal contract for critical workflows

### Discovery Quality

- public routes use cached or partially cached shells wherever freshness allows
- 3D and advanced visuals have credible fallbacks
- performance and error budgets are explicitly tracked

### Studio Quality

- panel state persists across sessions
- key actions are optimistic and recoverable
- keyboard command coverage is first-class
- at least one premium workflow proves materially better than generic docs/tasks tools

### AI Quality

- critical AI workflows have tracing, prompt versioning, and fallback routing
- high-value workflows have evaluation coverage
- model swaps or policy changes do not require broad feature rewrites

### Operability

- runtime and background jobs are observable at the workflow level
- deploy verification is standardized
- staging is safe enough to exercise runtime-heavy changes without production coupling

---

## Sequencing Recommendation

Do this in this order:

1. set up `governada-review`
2. approve this initiative
3. execute Phase 0
4. decide on runtime hosting and staging posture
5. create `governada-runtime` only after Phase 0 exit criteria are met

This order gives you execution leverage immediately without prematurely encoding architecture choices into privileged cloud environments.

---

## Immediate Next Steps

### Week 1

- validate `governada-review`
- approve this initiative as the platform program
- execute [governada-platform-phase0-workplan.md](../specs/governada-platform-phase0-workplan.md)
- review [governada-platform-runtime-safety.md](../specs/governada-platform-runtime-safety.md)
- review [governada-platform-architecture-inventory.md](../specs/governada-platform-architecture-inventory.md)

### Week 2

- turn the architecture inventory into boundary decisions
- turn the runtime safety model into a runtime go/no-go decision
- create an ADR backlog for DG-2 through DG-7

### Week 3+

- start Phase 1 domain-boundary work
- use [workspace-foundation.md](workspace-foundation.md) as the Studio-kernel execution plan
- keep [world-class-packages.md](../world-class-packages.md) as the quality companion track

---

## Reference Inputs

Repo strategy inputs:

- [ultimate-vision.md](../ultimate-vision.md)
- [design-language.md](../design-language.md)
- [workspace-foundation.md](workspace-foundation.md)
- [world-class-packages.md](../world-class-packages.md)
- [001-jwt-wallet-auth.md](../../adr/001-jwt-wallet-auth.md)

External reference inputs:

- [Next.js Cache Components](https://nextjs.org/docs/app/getting-started/cache-components)
- [React `useEffectEvent`](https://react.dev/reference/react/useEffectEvent)
- [Supabase Realtime](https://supabase.com/docs/guides/realtime)
- [Supabase pgvector](https://supabase.com/docs/guides/database/extensions/pgvector)
- [Inngest Steps](https://www.inngest.com/docs/learn/inngest-steps)
- [OpenAI Responses Migration](https://platform.openai.com/docs/guides/responses-vs-chat-completions)
- [OpenAI Realtime](https://platform.openai.com/docs/guides/realtime-model-capabilities)
- [Liveblocks Tiptap](https://liveblocks.io/docs/products/text-editor/tiptap)
- [Electric](https://electric-sql.com/product/electric)
- [Vercel Functions](https://vercel.com/docs/functions/)
