# Architecture Inventory: Governada Platform 2026 Phase 0

> **Initiative**: [docs/strategy/plans/governada-platform-2026.md](../plans/governada-platform-2026.md)
> **Work plan**: [docs/strategy/specs/governada-platform-phase0-workplan.md](governada-platform-phase0-workplan.md)
> **Created**: 2026-04-09
> **Status**: Phase 0 baseline
> **Method**: repo inspection of `app/`, `lib/`, `inngest/`, `scripts/`, and strategy docs on 2026-04-09

---

## At A Glance

Governada is already a large multi-surface product inside one Next.js app:

- `92` App Router page entrypoints under `app/`
- `350` API route handlers under `app/api/`
- `59` registered Inngest functions in [app/api/inngest/route.ts](../../app/api/inngest/route.ts)
- a mixed product shape spanning public discovery, personalized citizen workflows, premium workspace workflows, and internal operations

The repo is not a greenfield app that needs a new stack from scratch. It is a mature single deployable that now needs clearer domain boundaries and a cleaner control-plane story.

---

## Inventory Highlights

### Strengths

- One strong app foundation: [Next.js 16](../../package.json), [React 19](../../package.json), TypeScript, App Router.
- Clear data gravity around Supabase/Postgres via [lib/data.ts](../../lib/data.ts), [lib/supabase.ts](../../lib/supabase.ts), and the sync pipeline.
- A substantial Studio/workspace foundation already exists in `app/workspace`, `app/api/workspace`, and `lib/workspace`.
- AI is already centralized more than the README implies through [lib/ai.ts](../../lib/ai.ts) and [lib/ai/provider.ts](../../lib/ai/provider.ts).

### Frictions

- Product boundaries are implicit rather than enforced.
- Runtime documentation is partially stale or conflicting.
- AI, discovery, and workspace concerns are more advanced than the repo's public architecture description.
- Review-safe, runtime-safe, and production-coupled workflows still need clearer separation.

---

## Domain Map

### Discovery

Public and civic-facing discovery is the largest visible product surface.

Representative page namespaces:

- `app/governance`
- `app/drep`
- `app/pool`
- `app/committee`
- `app/pulse`
- `app/compare`
- `app/engage`
- `app/learn`
- `app/help`
- `app/developers`
- `app/g`
- `app/proposal`
- `app/discover`
- `app/embed`
- `app/share`

Representative API namespaces:

- `app/api/governance`
- `app/api/drep`
- `app/api/proposals`
- `app/api/treasury`
- `app/api/committee`
- `app/api/og`
- `app/api/embed`
- `app/api/observatory`
- `app/api/briefing`
- `app/api/briefs`

Discovery is already more than a browse layer. It includes public intelligence, share/OG generation, scoring explanation, and atmospheric navigation surfaces.

### Discovery-Personalized

These routes are not Studio, but they are also not anonymous/public in the same way as Discovery.

Representative page namespaces:

- `app/you`
- `app/my-gov`
- `app/match`
- `app/wrapped`
- `app/delegation`
- `app/claim`

Representative API namespaces:

- `app/api/you`
- `app/api/user`
- `app/api/engagement`
- `app/api/dashboard`
- `app/api/match`
- `app/api/telegram`

This is the area most likely to need an explicit naming and ownership decision later. It feels closer to "personalized discovery" than to Studio.

### Studio

Studio is already real, not hypothetical.

Representative page namespaces:

- `app/workspace`
- `app/workspace/author`
- `app/workspace/editor`
- `app/workspace/review`
- `app/workspace/votes`
- `app/workspace/delegators`
- `app/workspace/performance`

Representative API namespaces:

- `app/api/workspace/drafts`
- `app/api/workspace/reviews`
- `app/api/workspace/annotations`
- `app/api/workspace/agent`
- `app/api/workspace/research`
- `app/api/workspace/review-queue`
- `app/api/workspace/review-session`
- `app/api/workspace/revision`
- `app/api/workspace/constitutional-check`
- `app/api/workspace/amendment-bridge`

Studio already contains the beginnings of:

- proposal authoring
- review workflows
- AI-assisted drafting
- revision management
- structured feedback
- collaboration-like team concepts

### Internal Operations

The repo also contains a serious internal operations surface.

Representative page namespaces:

- `app/admin`
- `app/admin/pipeline`
- `app/admin/systems`
- `app/admin/integrity`
- `app/admin/assemblies`
- `app/admin/preview`

Representative API namespaces:

- `app/api/admin`
- `app/api/sync`
- `app/api/health`
- `app/api/inngest`
- `app/api/preview`

This surface should stay distinct from both Discovery and Studio. It is operational infrastructure and internal product tooling.

### Shared Platform

Shared platform concerns span every surface:

- `app/api/auth`
- `app/api/v1`
- `app/api/settings`
- `lib/api`
- `lib/supabaseAuth.ts`
- `lib/adminAuth.ts`
- `lib/featureFlags.ts`
- `lib/posthog*.ts`
- `lib/email.ts`
- `lib/notifications.ts`

This is the likely long-term shared package zone once the domain split becomes more explicit.

---

## Route Surface Snapshot

### Pages by top-level namespace

Top page groups from `app/**/page.tsx`:

| Namespace | Count | Interpretation |
| --- | --- | --- |
| `governance` | 17 | main discovery and system-intelligence surface |
| `workspace` | 15 | Studio and premium operations |
| `admin` | 10 | internal operations |
| `you` | 9 | personalized citizen/member experience |
| `help` | 4 | support and methodology |
| `my-gov` | 4 | legacy/personalized paths still present |
| `g` | 4 | short-form canonical profile/detail paths |

Smaller single-purpose groups such as `compare`, `pulse`, `discover`, `committee`, `developers`, `engage`, and `learn` reinforce that the public discovery layer is broad, not narrow.

### API routes by top-level namespace

Top API groups from `app/api/**/route.ts` and `route.tsx`:

| Namespace | Count | Interpretation |
| --- | --- | --- |
| `governance` | 62 | discovery intelligence, summaries, timelines, trends |
| `workspace` | 47 | Studio operations, drafting, review, AI, revisions |
| `og` | 36 | share cards and generated visual endpoints |
| `admin` | 26 | internal operations, feature flags, preview, systems |
| `engagement` | 19 | citizen participation, endorsements, assemblies |
| `drep` | 13 | entity-specific detail APIs |
| `intelligence` | 12 | advisor and research APIs |
| `dashboard` | 11 | personalized home/data APIs |
| `treasury` | 11 | treasury-specific intelligence |
| `v1` | 11 | public API platform surface |

This API distribution strongly supports the product split:

- public discovery and intelligence are already extensive
- Studio is already large enough to be treated as a first-class domain
- internal ops and public API platform concerns are separate enough to be modeled independently

---

## Data Architecture

### System of record

There are three distinct data planes today.

1. External governance data
   - Primary upstream is Koios via `lib/koios.ts`, `utils/koios`, and `lib/sync/*`
   - Blockfrost appears as a treasury fallback in [inngest/functions/sync-treasury-snapshot.ts](../../inngest/functions/sync-treasury-snapshot.ts) and [inngest/functions/reconcile-data.ts](../../inngest/functions/reconcile-data.ts)

2. Product and workspace state
   - Supabase/Postgres is the persistent product database
   - Reads use [lib/supabase.ts](../../lib/supabase.ts)
   - Session revocation, feature flags, draft workflows, AI provenance, and admin data all route through Supabase

3. Ephemeral control data
   - Upstash Redis via [lib/redis.ts](../../lib/redis.ts)
   - Used for rate limiting, session revocation acceleration, and best-effort caching

### Read path

The intended public-data read path is:

`Koios -> sync pipeline -> Supabase -> Next.js reads`

Evidence:

- [README.md](../../README.md) describes Koios as source of truth and Supabase as persistent cache
- [lib/data.ts](../../lib/data.ts) reads from Supabase first and only falls back to Koios when needed
- [lib/data.ts](../../lib/data.ts) can trigger background Inngest sync events when data is stale or missing

This is a strong pattern and should remain the main Discovery contract.

### Write path

There are two main write classes:

- user/product writes through API routes into Supabase
- background enrichment, sync, scoring, and notification writes through Inngest

Examples:

- wallet/user auth and session state
- workspace drafts, reviews, approvals, notes, and feedback
- admin preview, feature flags, and systems automation data
- sync tables, scores, proposal intelligence, embeddings, and AI logs

### Client-side data model

The repo standard says client data fetching should use TanStack Query rather than ad hoc `useEffect` fetch state. This matches the current direction of `hooks/queries.ts` and the broader app structure.

---

## Background Execution

Background execution is already a major subsystem.

- `59` functions are registered in [app/api/inngest/route.ts](../../app/api/inngest/route.ts)
- major function families include:
  - `sync-*`
  - `generate-*`
  - `compute-*`
  - `score-*`
  - `check-*`
  - `notify-*`
  - `alert-*`

Examples of responsibilities:

- core sync and freshness
- score computation
- proposal intelligence precomputation
- citizen and governance brief generation
- embeddings and AI quality scoring
- notifications and systems automation

This means Governada is already an async platform, not just a request/response web app.

---

## AI Architecture

### Current provider layer

AI is more advanced than the current README description suggests.

- [lib/ai.ts](../../lib/ai.ts) supports Anthropic and OpenAI model routing
- [lib/ai/provider.ts](../../lib/ai/provider.ts) adds:
  - BYOK lookup from `encrypted_api_keys`
  - provider routing
  - provenance logging to `ai_activity_log`

So the repo already has a partial provider-neutral AI layer, even though prompt logic and feature-level orchestration are still distributed.

### Discovery and intelligence entrypoints

Representative discovery-side AI routes:

- [app/api/intelligence/research/route.ts](../../app/api/intelligence/research/route.ts)
- [app/api/intelligence/advisor/route.ts](../../app/api/intelligence/advisor/route.ts)
- [app/api/proposals/explain/route.ts](../../app/api/proposals/explain/route.ts)
- [app/api/governance/inter-body-narrative/route.ts](../../app/api/governance/inter-body-narrative/route.ts)
- [app/api/you/identity-narrative/route.ts](../../app/api/you/identity-narrative/route.ts)

These routes support narrative explanation, research, advisory, and public-facing intelligence.

### Studio AI entrypoints

Representative Studio-side AI routes:

- [app/api/workspace/agent/route.ts](../../app/api/workspace/agent/route.ts)
- [app/api/workspace/research/route.ts](../../app/api/workspace/research/route.ts)
- [app/api/workspace/amendment-bridge/route.ts](../../app/api/workspace/amendment-bridge/route.ts)
- [app/api/workspace/constitutional-check/route.ts](../../app/api/workspace/constitutional-check/route.ts)

The Studio agent is already tool-oriented. See [lib/workspace/agent/tools.ts](../../lib/workspace/agent/tools.ts) for proposal editing, review-comment drafting, constitutional checks, and related tool execution.

### Background AI workloads

Representative AI-heavy background jobs:

- [inngest/functions/generate-epoch-summary.ts](../../inngest/functions/generate-epoch-summary.ts)
- [inngest/functions/generate-governance-brief.ts](../../inngest/functions/generate-governance-brief.ts)
- [inngest/functions/generate-drep-epoch-updates.ts](../../inngest/functions/generate-drep-epoch-updates.ts)
- [inngest/functions/generate-citizen-briefings.ts](../../inngest/functions/generate-citizen-briefings.ts)
- [inngest/functions/generate-cc-briefing.ts](../../inngest/functions/generate-cc-briefing.ts)
- [inngest/functions/generateAiContent.ts](../../inngest/functions/generateAiContent.ts)
- [inngest/functions/generate-embeddings.ts](../../inngest/functions/generate-embeddings.ts)
- [inngest/functions/score-ai-quality.ts](../../inngest/functions/score-ai-quality.ts)

### Architectural reading

The repo is not at "AI bolted on" anymore. It already has:

- multiple AI entry surfaces
- multiple provider support
- BYOK
- background enrichment
- some tool-oriented Studio behavior

The remaining gap is not basic integration. It is platformization: one clearer internal AI contract, prompt/version discipline, tracing/evals, and better separation between Discovery AI and Studio AI.

---

## Auth And Privilege Map

### Wallet-native authentication

Core auth path:

- [app/api/auth/nonce/route.ts](../../app/api/auth/nonce/route.ts)
- [app/api/auth/wallet/route.ts](../../app/api/auth/wallet/route.ts)
- [app/api/auth/logout/route.ts](../../app/api/auth/logout/route.ts)
- [lib/supabaseAuth.ts](../../lib/supabaseAuth.ts)

Characteristics:

- wallet signature-based auth
- JWT session tokens
- revocation checks through Redis and Supabase
- fail-closed behavior when revocation systems are unavailable

### Admin privilege boundary

Admin access is environment-driven through [lib/adminAuth.ts](../../lib/adminAuth.ts):

- `ADMIN_WALLETS`
- `DEV_ADMIN_WALLETS` outside production

Representative admin entrypoints:

- [app/api/admin/check/route.ts](../../app/api/admin/check/route.ts)
- [app/api/admin/feature-flags/route.ts](../../app/api/admin/feature-flags/route.ts)
- [app/api/admin/systems/route.ts](../../app/api/admin/systems/route.ts)

### Workspace permission boundary

Studio/workspace permissioning is mostly route-local today:

- draft ownership checks
- reviewer vs proposer vs CC-member role handling
- stake-address comparisons
- optional preview/session logic in some flows

This is workable, but it is also a sign that authorization policy is spread across many route handlers rather than centralized into one shared policy layer.

---

## Runtime And Control Planes

### Current runtime stack

The current stack appears to be:

- Next.js standalone web app
- Docker-based deployment
- Cloudflare in front of the app
- Railway as the web/runtime host
- Supabase for data
- Upstash for cache/rate limits
- Inngest for background execution
- Anthropic and OpenAI for AI
- Sentry and PostHog for observability
- Resend, Telegram, Discord, and push channels for outbound notifications

### Important documentation drift

There are notable mismatches between repo docs and current code:

1. [README.md](../../README.md) says "Inngest Cloud", but [app/api/inngest/route.ts](../../app/api/inngest/route.ts) contains self-hosted Railway-private-network callback handling via `INNGEST_SERVE_ORIGIN` and `INNGEST_SERVE_PATH`.
2. [README.md](../../README.md) says "22 durable functions", but the repo currently registers `59`.
3. [README.md](../../README.md) describes AI primarily as Anthropic, but [lib/ai.ts](../../lib/ai.ts) and [lib/ai/provider.ts](../../lib/ai/provider.ts) clearly support both Anthropic and OpenAI.

These mismatches matter because Phase 0 architecture decisions should be made against the codebase that exists, not stale summaries.

---

## Main Architectural Tensions

### 1. Discovery and Studio are already different products

The file layout, route volume, and interaction patterns already indicate two product domains. The main task is to formalize that split, not invent it.

### 2. Personalized citizen workflows sit between domains

`you`, `engagement`, `dashboard`, and some `intelligence` routes are not obviously pure Discovery or pure Studio. They are likely their own "personalized discovery" band and should be classified deliberately in Phase 1.

### 3. AI is partially centralized but not yet platformized

Provider selection is centralized, but prompts, tracing assumptions, and workflow orchestration are still fragmented across routes, libraries, and Inngest functions.

### 4. Runtime documentation is behind the code

The repo now has enough moving parts that stale infra summaries become strategically dangerous. Phase 0 should treat runtime inventory and doc correction as real platform work.

---

## Decision Backlog

This is the minimum Phase 0 decision backlog derived from the current inventory.

| Decision | Default recommendation | Inputs still needed | Likely artifact |
| --- | --- | --- | --- |
| Web hosting direction: Railway vs Vercel | Keep open until runtime and caching review is complete | real deployment constraints, preview needs, background coupling, Next.js operational tradeoffs | ADR |
| Deployable topology: one deployable vs split web surfaces | Keep one deployable for now, enforce domain boundaries first | boundary churn, package extraction plan, runtime independence | ADR |
| Discovery vs Studio boundary rules | Treat `workspace` as Studio, `admin` as Internal Ops, `governance` as Discovery, decide where `you` and `intelligence` belong | route-by-route ownership review | Phase 1 boundary doc or ADR |
| Canonical Studio content model | Move toward structured canonical storage, not markdown-first persistence | current draft schema, export needs, review workflows | ADR |
| Collaboration plane: Liveblocks-first vs Electric-first | Decide later based on the hardest premium workflow, not preference | multiplayer editing needs vs local-first structured sync needs | ADR |
| AI platform shape | Build on the existing multi-provider core rather than replacing it | tracing, prompt registry, eval plan, provider fallback policy | ADR |
| Auth hardening direction | Keep wallet-native auth, then centralize authorization policy | admin boundary review, workspace role model, preview/session rules | ADR |

---

## Recommended Follow-Ups

1. Use this document and [governada-platform-runtime-safety.md](governada-platform-runtime-safety.md) as the factual baseline for Phase 0 decisions.
2. Correct stale runtime summaries in user-facing docs as Phase 0 continues.
3. Turn the decision backlog above into individual ADRs once the staging/runtime safety posture is accepted.
4. In Phase 1, explicitly classify `you`, `engagement`, and `intelligence` as `Discovery`, `Studio`, or `Shared` instead of leaving them ambiguous.
