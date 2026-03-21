# Exploration: Conversational DRep Matching — Hero-Embedded Globe Convergence

> **Feature**: Conversational DRep Matching (backend merged, no frontend)
> **Date**: 2026-03-20
> **Trigger**: Backend engine (`conversationalMatch.ts`, `match-conversation` API, semantic embeddings, 6D alignment pills, Redis session state) merged via PR #434 but has no frontend. Old `QuickMatchFlow.tsx` still shows the simple 4-question walkthrough.

---

## Phase 1: Current State Snapshot

### What Users See Today

**Homepage hero** (`AnonymousLanding.tsx`): Full-screen ConstellationScene (3D globe with ~800 DRep/SPO/CC nodes in teal/purple/gold), "Your ADA gives you a voice" copy, two path cards below ("Find My DRep" → `/match`, "Browse Pools" → `/governance/pools`).

**Match page** (`QuickMatchFlow.tsx`): Separate route at `/match`. 4 fixed questions, single-choice per question (Conservative/Growth/Balanced, etc.), live GovernanceRadar, top 3 DRep results with match percentages.

**The journey**: Read hero → click CTA → navigate to `/match` → orient on new page → answer 4 questions → see results. That's 3-4 decision points and a full page navigation before anything happens.

### What's Working Well (Preserve)

- One-question-at-a-time full-screen focus
- Live radar visualization providing feedback during quiz
- Top 3 curated results (avoids paradox of choice)
- Shareable result page (`/match/result?profile=`)
- localStorage persistence (30-day match survival without auth)
- Progressive confidence scoring (7 sources, transparent breakdown)
- The 3D globe itself — cinematic, performant, real data

### What's At Its Ceiling

- **4 fixed questions, single-choice** — crude signal. "Conservative" on treasury says nothing about _why_ or _how much_
- **No freeform input** — citizens can't express nuance
- **No adaptive branching** — same questions regardless of what would improve the match
- **No semantic matching** — embedding infrastructure exists but unused
- **No importance weighting** — treasury and decentralization weighted equally even if citizen only cares about one
- **Globe is decorative** — the most impressive visual asset on the site has zero connection to matching
- **Matching is a separate page** — the product's most important conversion flow requires navigating away from the homepage

### JTBD

**Core**: "Find a DRep that represents my values"
**Strategic role**: Primary conversion funnel. Every quiz answer improves citizen profiles, system intelligence, and community clustering. This is where the intelligence engine meets the citizen for the first time.
**Competitive context**: No competitor in Cardano (GovTool, Tempo, 1694.io, DRep.tools) has any form of matching. No blockchain governance tool anywhere has structured matching. First-mover opportunity.

---

## Phase 2: Inspiration Research

| Pattern                             | Source                                 | Key Insight                                                                           |
| ----------------------------------- | -------------------------------------- | ------------------------------------------------------------------------------------- |
| Conversational adaptive questioning | Typeform + Duolingo + ChatGPT          | One-at-a-time with branching + freeform captures richer signal; 2-3x completion rates |
| Transparent match breakdown         | OkCupid + LinkedIn "How You Match"     | Per-dimension agreement builds trust; governance demands explainability               |
| Importance weighting                | iSideWith (81M users, 83% completion)  | Not all topics matter equally — let citizens weight them                              |
| React to specific elements          | Hinge (47% better engagement on text)  | Reacting to real statements captures finer preference signal                          |
| Identity reveal as shareable moment | Spotify Wrapped (120M users) + 23andMe | Data-as-identity creates the strongest viral loop in consumer software                |
| "Play first, profile second"        | Duolingo placement test                | Show value before asking for commitment; interact before deciding to commit           |
| Product-IS-the-landing-page         | Google Search, Spotify                 | The best landing pages don't describe the product — they ARE the product              |
| Live data visualization as feedback | Bloomberg Terminal, flight trackers    | Seeing data react to your input creates visceral trust in the system                  |
| Curated scarcity in results         | Coffee Meets Bagel                     | 3-5 deep matches beats infinite directory                                             |
| Deliberate diversity injection      | Filter bubble research                 | Include one "different perspective" match to prevent echo chambers                    |

**Anti-patterns to avoid:**

- Over-questioning (OkCupid research: 500 questions ≠ better matches than 50)
- Opaque algorithms (governance demands radical transparency)
- Filter bubbles (only showing confirming matches undermines civic discourse)

Full pattern entries added to `docs/strategy/context/world-class-patterns.md` under "Search & Discovery".

---

## Phase 3: Data Opportunity Scan

### Existing Data (Ready to Use)

| Data                                  | Location                                       | Matching Role                                               |
| ------------------------------------- | ---------------------------------------------- | ----------------------------------------------------------- |
| 6D alignment vectors (DRep)           | `dreps.alignment_*` columns                    | Distance computation target                                 |
| 6D alignment vectors (user)           | `matchStore.ts`, `user_governance_profiles`    | Distance computation source                                 |
| DRep rationale embeddings             | `embeddings` table                             | Semantic similarity search                                  |
| Conversational state machine          | `conversationalMatch.ts`                       | Multi-round adaptive flow with quality gates                |
| Multi-select pill questions           | `conversationalPillGenerator.ts`               | 4 rounds, 6 alignment dimensions                            |
| Semantic similarity search            | `embeddings/query.ts` → `match_embeddings` RPC | Text-to-DRep matching                                       |
| Progressive confidence (7 sources)    | `confidence.ts`                                | Match quality transparency                                  |
| Per-dimension agreement               | `dimensionAgreement.ts`                        | Explain WHY matches work                                    |
| Match narrative generation            | `matchNarrative.ts`                            | Human-readable match explanations                           |
| Governance personality classification | `drepIdentity.ts`                              | Archetype names + identity colors                           |
| **Globe node alignment data**         | `ConstellationNode3D.alignments[]`             | **Every node on the globe already has 6D alignment scores** |
| Globe highlight/dim system            | `SceneState.highlightId/dimmed`                | Node visual state management                                |
| Globe `getColor` per-node callback    | `NodePoints` component                         | Per-node color already parameterized                        |

### New Data Needed

| Requirement                                    | Enables                                          | Feasibility                                                        |
| ---------------------------------------------- | ------------------------------------------------ | ------------------------------------------------------------------ |
| `highlightMatchingNodes()` on ConstellationRef | Globe reacts to matching in real-time            | Easy — alignment data + highlight system exist                     |
| Importance weighting in distance formula       | Weighted matching (dealbreaker vs. nice-to-have) | Easy — multiply dimension distances by weight                      |
| Match color constant + shader support          | Distinct visual for matched nodes                | Easy — add `MATCH_COLOR` + `aMatchIntensity` attribute             |
| Bridge match selection                         | "Different perspective" DRep                     | Easy — high-score DRep with max disagreement on low-importance dim |
| Real-time text embedding                       | Semantic fast-track                              | Medium — optimize embedding latency to < 2s                        |

### Key Insight

**The globe IS the matching visualization.** Every node already carries alignment data. The infrastructure to highlight, dim, pulse, and color nodes individually already exists. Connecting the matching engine to the globe visualization requires adding one method and one color — not rebuilding anything.

---

## Phase 4: Three Alternative Concepts

---

### Concept A: "Globe Convergence" — Hero-Embedded Matching with Live Globe Feedback

**Core Insight**: The matching flow IS the homepage. The globe doesn't just decorate — it visualizes the matching algorithm in real-time as citizens express their preferences.

**Inspiration Source**: Google Search (product IS the landing page) + flight tracker live visualization + Spotify Wrapped (identity reveal) + Typeform (conversational flow)

#### The Experience

**Act 1: The Invitation (0-5 seconds)**

The homepage loads. The globe rotates slowly — 800 nodes glowing teal (DReps), purple (SPOs), gold (CC). The hero copy reads:

> "Your ADA gives you a voice."
> "What matters to you in governance?"

Below the copy, floating in front of the globe: 6-8 governance topic pills in a relaxed cloud layout — **Treasury**, **Innovation**, **Security**, **Transparency**, **Decentralization**, **Developer Funding**, **Community Growth**, **Constitutional Compliance**. Each pill is a frosted glass chip, subtle, inviting.

Below the pills: a soft text input with rotating ghost text: _"Or tell us what matters..."_

No "Find My DRep" button. No CTA. The pills ARE the interaction. The citizen is already inside the product.

**Act 2: First Touch — The Globe Awakens (5-15 seconds)**

The citizen taps **"Treasury"**. Three things happen simultaneously:

1. **The pill activates** — it brightens, gets a subtle ring, and floats slightly forward. Other pills remain but dim slightly.
2. **The globe responds** — nodes whose alignment vectors are strong on treasury dimensions shift from teal/purple to a warm **amber/gold accent color** (distinct from all existing node colors). Maybe 150-200 nodes light up across the globe. The rest dim to 15% opacity. The bloom effect makes the matched nodes glow.
3. **The hero morphs** — the remaining homepage content (stat cards, glass window, etc.) slides down and dims. The globe + pills expand to fill more viewport. A subtle confidence ring appears at the bottom: "Finding your matches... 25% confident"

The citizen _sees_ their preference reflected on the globe. 200 nodes just lit up because they care about treasury. The visual is immediate and visceral.

**Act 3: Convergence (15-60 seconds)**

The next round slides in smoothly below the activated pill — new pills specific to treasury: **"Preserve the treasury"**, **"Invest in growth"**, **"Fund developers"**, **"Balance both"**. These are the conversational pills from `conversationalPillGenerator.ts`, multi-select enabled.

The citizen taps **"Preserve the treasury"** and **"Fund developers"**. The globe converges:

- Nodes aligned with treasury conservation AND developer funding stay bright amber
- Nodes only aligned with one dimension fade to a dimmer amber
- Nodes aligned with neither fade back to default teal/purple at low opacity
- The lit cluster shrinks from ~200 to ~60 nodes

The confidence ring advances: "45% confident — 2 more questions to sharpen your match"

Round 3: Adaptive question based on what would most improve match quality (from quality gates in `conversationalMatch.ts`). Maybe governance values — transparency vs. decentralization. The citizen selects. The globe converges further: ~15-20 bright nodes.

Optional Round 4 (if quality gate not yet met): A trade-off question that forces cross-dimensional stance. By now, only 5-10 nodes glow bright on the globe.

At any point, the citizen can type freeform text in the input field. This text accumulates for semantic matching via the embedding pipeline.

**Act 4: The Importance Moment (5 seconds, optional)**

Before final matching, a quick card: "What matters most?" The dimensions they've expressed opinions on appear as draggable pills in three zones: **Dealbreaker** / **Important** / **Nice to have**. This takes one interaction and dramatically improves match quality by weighting the distance formula.

**Act 5: The Identity Reveal (the shareable moment)**

Brief processing animation — the globe rotates to center the bright cluster. The confidence ring completes. Then:

A bold card slides over the globe (globe still visible behind, amber nodes still glowing):

> **"You're a Treasury Guardian"**
> Your governance priorities: fiscal stewardship, developer investment, transparency
> [6D radar visualization]
> [Share button — generates OG image card]

This is about THEM first, not about DReps. The governance archetype name + radar is the identity moment. It's the Spotify Wrapped of governance — shareable, personal, self-affirming.

**Act 6: The Matches — Globe Fly-To**

Below the identity card, 3 match cards slide in sequentially (staggered animation). As each appears, the globe camera subtly adjusts to bring that node into view:

**Match 1 (Top Match):**

- DRep name + Governance Rings + match % in Fraunces display type
- "This DRep wrote: _'[actual rationale excerpt that matches citizen's expressed beliefs]'_" (from semantic similarity)
- 2-3 agree/differ dimension badges
- Expandable: full radar overlay (citizen vs DRep), per-dimension breakdown, confidence sources
- "Delegate" CTA

**Match 2 & 3:** Same format, staggered entrance.

**Match 4: The Bridge Match (Different Perspective)**

- "A different perspective worth considering"
- A high-quality DRep who disagrees on one non-dealbreaker dimension but is highly respected
- "Challenges your view on [X] but is a leader in [Y]"
- Prevents filter bubble, demonstrates intellectual honesty

**Act 7: Continuation**

- "Go deeper" → full conversational flow for citizens wanting to refine
- "Explore the globe" → interactive mode, tap any lit node to see that DRep
- "Share your governance identity" → OG image card for Twitter/Discord
- "Delegate now" → wallet connect flow

The URL has been updating via `history.pushState` throughout — `/` → `/#matching` → `/#identity` → `/#results` — so back button works and results are shareable.

#### Emotional Arc

| Stage           | Feeling                                                                |
| --------------- | ---------------------------------------------------------------------- |
| Landing         | Awe ("this globe is beautiful")                                        |
| First pill tap  | Wonder ("it responded to me — those nodes just lit up")                |
| Convergence     | Agency + excitement ("I can see it narrowing down, finding MY people") |
| Quality gate    | Control ("I choose when I'm ready")                                    |
| Identity reveal | Self-recognition + delight ("Treasury Guardian — that's ME")           |
| Matches         | Trust + specificity ("I can see why, and they quoted real words")      |
| Bridge match    | Respect ("this app is intellectually honest")                          |

#### Data Requirements

| Requirement                             | Status     | Notes                                                                                   |
| --------------------------------------- | ---------- | --------------------------------------------------------------------------------------- |
| Conversational state machine            | **EXISTS** | `conversationalMatch.ts`                                                                |
| Multi-select pills with alignment hints | **EXISTS** | `conversationalPillGenerator.ts`                                                        |
| Freeform text accumulation              | **EXISTS** | Session state in Redis                                                                  |
| Semantic embedding search               | **EXISTS** | `embeddings/query.ts`                                                                   |
| Quality gates (auto-progression)        | **EXISTS** | `conversationalMatch.ts`                                                                |
| Globe node alignment data               | **EXISTS** | `ConstellationNode3D.alignments[]`                                                      |
| Globe highlight/dim/pulse system        | **EXISTS** | `SceneState` + shader attributes                                                        |
| Per-node `getColor` callback            | **EXISTS** | `NodePoints` component                                                                  |
| `highlightMatchingNodes()` method       | **NEEDS**  | New method on `ConstellationRef` — compute alignment distance per node, set match state |
| `MATCH_COLOR` in shaders                | **NEEDS**  | Add amber/gold match color distinct from DRep teal and SPO purple                       |
| Match intensity attribute in shader     | **NEEDS**  | `aMatchIntensity` float for graduated glow (strong match = brighter)                    |
| Importance weighting                    | **NEEDS**  | Weight multipliers in Euclidean distance formula                                        |
| Bridge match selection                  | **NEEDS**  | High-score DRep with max disagreement on low-importance dimension                       |
| Hero morph animations                   | **NEEDS**  | Framer Motion layout animations for homepage content transition                         |
| Identity card + OG image                | **NEEDS**  | Shareable governance identity card component                                            |

#### What It Removes

- The `/match` page as a separate route (matching lives on the homepage)
- The "Find My DRep" CTA button (pills ARE the interaction)
- Fixed 4-question sequence (adaptive branching)
- Single-choice constraint (multi-select + freeform)
- The globe as decoration (it becomes the core visualization)
- The two-path card layout in the hero (replaced by pill cloud)

#### The Ceiling

| Dimension        | Score | Rationale                                                                                                                    |
| ---------------- | ----- | ---------------------------------------------------------------------------------------------------------------------------- |
| JTBD fulfillment | 9/10  | Conversational + semantic + visual convergence = dramatically better match quality and trust                                 |
| Emotional impact | 10/10 | Globe convergence + identity reveal + DRep quotes = genuinely cinematic                                                      |
| Simplicity       | 7/10  | More complex than 4-question quiz, but feels simpler because there's no navigation and the globe makes the algorithm visible |
| Differentiation  | 10/10 | Nothing like this exists in any governance tool, Web2 or Web3                                                                |
| Feasibility      | 8/10  | Backend + globe + data all exist. Main work is frontend UI + globe integration                                               |
| Shareability     | 9/10  | Governance Identity Card + "watch the globe react" = screenshot/screen-record moments                                        |

#### What It Sacrifices

- The current quiz's extreme simplicity (3 taps and done)
- Deterministic flow (adaptive = different citizens see different questions)
- The "Stake" path's equal billing on the homepage (becomes secondary CTA below)
- E2E testability of a fixed sequence (mitigated: quality gates have 30 tests)

#### Effort: **Medium-Large**

Frontend: conversational UI shell, hero morph animations, globe integration, identity reveal, match results
Backend: importance weighting, bridge match selection, `highlightMatchingNodes()` on ConstellationRef
The backend matching engine, API, session state, embeddings, and globe are ALL already built.

#### The Share Moment

Two share moments:

1. **The Governance Identity Card** — bold visual card with archetype name, radar, personality. "I'm a Treasury Guardian on @governada_io — who are you?"
2. **The Globe Convergence** — screen recording of tapping pills and watching nodes light up. "Watch what happens when I tell this app what I care about." This is the kind of thing that goes viral in crypto Twitter.

---

### Concept B: "Statement Reactions" — Match by Reacting to Real DRep Positions

**Core Insight**: Instead of asking abstract questions, show real anonymized DRep statements and let reactions be the matching signal. The "unmasking" at the end reveals which DRep said what.

**Inspiration Source**: Hinge prompt reactions + Tinder swipe + iSideWith "choose another stance"

#### The Experience

1. Full-screen cards showing real DRep governance statements (anonymized, from `drep_rationales`)
2. Three reactions per card: Agree / Interesting / Disagree
3. 6-10 statements spanning governance dimensions, each mapping to alignment hints
4. Dwell time tracked as implicit signal
5. Quality gate after 6 reactions: "Ready for matches?"
6. **The Unmasking**: "Remember this statement you agreed with? That was [DRep Name]." Match feels earned because citizen already resonated with their actual words.
7. Deep dive: which specific statements the citizen agreed/disagreed with per DRep

#### Emotional Arc

Intrigue → education → empowerment → surprise + validation → trust

#### The Ceiling

| Dimension        | Score                                                               |
| ---------------- | ------------------------------------------------------------------- |
| JTBD fulfillment | 9/10                                                                |
| Emotional impact | 10/10 (the unmasking is genuinely delightful)                       |
| Simplicity       | 8/10                                                                |
| Differentiation  | 10/10                                                               |
| Feasibility      | 6/10 (needs statement curation pipeline + dimension classification) |
| Shareability     | 7/10                                                                |

#### Effort: **Large** — needs statement curation pipeline, dimension classification, dwell time tracking

---

### Concept C: "60-Second DNA" — Radically Simple, One Input

**Core Insight**: Ask one open-ended question. Let AI do the rest.

**Inspiration Source**: Wealthfront risk profiling + Credit Karma score reveal

#### The Experience

1. One prompt: "What matters to you in governance?" with rotating ghost text
2. Citizen types 1-3 sentences OR taps fallback pills
3. Text goes straight to embedding pipeline → semantic search against all DRep rationale embeddings
4. 2-3 second "analyzing" animation showing concepts extracted from their text
5. "Governance DNA" reveal: primary + secondary traits, distinctive belief quote
6. 3 matches with the specific DRep statement that most closely matches what they wrote
7. "Want a deeper match?" CTA for citizens wanting to refine

#### The Ceiling

| Dimension        | Score                                         |
| ---------------- | --------------------------------------------- |
| JTBD fulfillment | 8/10 (single input has less signal)           |
| Emotional impact | 9/10                                          |
| Simplicity       | 10/10 (literally one question)                |
| Differentiation  | 10/10                                         |
| Feasibility      | 7/10 (needs real-time embedding optimization) |
| Shareability     | 8/10                                          |

#### Effort: **Small-Medium**

---

## Phase 5: Comparative Analysis

| Dimension            | Current Quiz | A: Globe Convergence | B: Statement Reactions | C: 60-Second DNA |
| -------------------- | ------------ | -------------------- | ---------------------- | ---------------- |
| **JTBD Ceiling**     | 6/10         | 9/10                 | 9/10                   | 8/10             |
| **Emotional Impact** | 5/10         | **10/10**            | 10/10                  | 9/10             |
| **Simplicity**       | 9/10         | 7/10                 | 8/10                   | **10/10**        |
| **Differentiation**  | 6/10         | **10/10**            | 10/10                  | 10/10            |
| **Feasibility**      | 10/10        | **8/10**             | 6/10                   | 7/10             |
| **Shareability**     | 6/10         | **9/10**             | 7/10                   | 8/10             |
| **Total**            | **42/60**    | **53/60**            | **50/60**              | **52/60**        |

**Concept A wins.** Highest ceiling across the board, and critically: the globe integration gives it an emotional impact that's impossible to replicate in a flat UI. The other concepts are strong ideas to steal from — B's "unmasking" moment and C's single-input fast-track both enhance Concept A.

---

## Phase 6: Recommendation

### Build: Concept A (Globe Convergence) with elements from B and C

#### What to steal from B and C

- **From B (Statement Reactions)**: Ground match results in actual DRep quotes. When showing matches, include: "This DRep wrote: _'[excerpt]'_ — which echoes your belief about [topic]." Don't need the full reaction flow, just the payoff.
- **From C (60-Second DNA)**: The single text input as a **fast-track entry point** alongside the pills. Citizens who prefer typing get an express lane to semantic matching. Citizens who prefer tapping get the pill flow. Both paths converge on globe convergence.

#### Implementation Roadmap

**Phase 1: Conversational UI + Hero Embedding** (highest impact, do first)

- Build `ConversationalMatchFlow.tsx` — conversational UI shell
  - Pill cloud component (multi-select, frosted glass, cloud layout)
  - One-card-at-a-time transitions (Framer Motion layout animations)
  - Freeform text input with rotating ghost text
  - Confidence ring component (circular progress)
  - Adaptive "ready to match" CTA (from quality gates)
- Hero morph: wire pills into `AnonymousLanding.tsx` hero section
  - Replace two-path cards with pill cloud + text input
  - Homepage content dims/slides when matching starts
  - URL updates via shallow routing (`/#matching`, `/#results`)
- Wire to existing `/api/governance/match-conversation` endpoint
- Enable `conversational_matching` feature flag
- Keep `/match` route as fallback (redirects to homepage for anonymous)

**Phase 2: Globe Integration** (the differentiator)

- Add `MATCH_COLOR` constant (warm amber: `#f59e0b` or similar — test against teal/purple)
- Add `matchedNodeIds: Set<string>` to `SceneState`
- Add `aMatchIntensity` float attribute to node shaders — 0.0 = default color, 1.0 = full match color
- Modify `NodePoints` buffers: when `matchedNodeIds` has entries, compute match intensity per node based on alignment distance to citizen's current vector
- Add `highlightMatches(alignmentVector: number[], threshold: number)` to `ConstellationRef`
  - Computes Euclidean distance between citizen vector and each node's `alignments[]`
  - Sets `matchedNodeIds` for nodes within threshold
  - Progressive threshold tightening per round (round 1: broad, round 4: tight)
- Bloom effect makes matched nodes glow naturally (already configured)
- Non-matched nodes dim to 15% opacity (existing `dimmed` system)
- Globe subtly rotates to show matched cluster when results ready

**Phase 3: Identity Reveal + Results**

- Build `GovernanceIdentityCard.tsx` — the shareable identity moment
  - Archetype name from `drepIdentity.ts` personality classification
  - 6D radar visualization (existing `GovernanceRadar.tsx`)
  - One-line personality summary
  - Share button (canvas-to-image or OG image generation)
- Match result cards with DRep quotes (from semantic similarity results)
- Per-dimension agreement breakdown (existing `dimensionAgreement.ts`)
- Bridge match — one "different perspective" DRep
- Globe fly-to animation as each match card appears

**Phase 4: Polish + Semantic Fast-Track**

- Importance weighting card ("What matters most?" — dealbreaker/important/nice-to-have)
- Weighted distance formula in matching algorithm
- Enable `conversational_matching_semantic` flag
- Optimize text → embedding → search latency (< 2s)
- Single-input fast-track (Concept C express lane) for text-first citizens
- Mobile optimization (compact pill layout, full-screen focus mode on tap)
- "Explore the globe" interactive mode post-results

#### What to REMOVE

| Remove                               | Why                                        |
| ------------------------------------ | ------------------------------------------ |
| `QuickMatchFlow.tsx` as primary flow | Replaced by `ConversationalMatchFlow.tsx`  |
| "Find My DRep" CTA button            | Pills ARE the interaction                  |
| Two-path card layout in hero         | Replaced by pill cloud + text input        |
| Fixed 4-question sequence            | Replaced by adaptive rounds                |
| Single-choice constraint             | Replaced by multi-select + freeform        |
| Globe as decoration                  | It becomes the core matching visualization |

**Keep**: `QuickMatch.tsx` (3-question variant) as a lightweight embed for DRep profile pages and external widget use. Pool matching path moves to a secondary CTA below the hero ("Looking for a stake pool?") or as a branch in the conversational flow.

#### Risk Assessment

| Risk                                    | Likelihood | Mitigation                                                                                                                                  |
| --------------------------------------- | ---------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| Globe convergence performance on mobile | Medium     | GPU tier detection already caps at 200 nodes on low-end. Fewer nodes = effect still works, just smaller. Test on real devices.              |
| Freeform text produces vague input      | Medium     | Fallback to pill flow always available. Ghost text examples guide. "Not sure? Try quick picks →" CTA.                                       |
| Hero morph feels jarring                | Low        | Framer Motion layout animations + View Transitions API already in the codebase. Test transition timing carefully.                           |
| Citizens miss the old simple quiz       | Low        | The pill flow IS the simple quiz but better. Fast-track is even simpler. And the globe makes it magical.                                    |
| Semantic matching latency > 2s          | Low        | Supabase `match_embeddings` RPC is fast. Can show globe converging as loading state — the convergence animation IS the processing feedback. |
| "Stake" path loses visibility           | Medium     | Add "Looking for a stake pool?" link below pills. Or: after DRep matching, offer "Now find a pool to complete your governance team."        |

#### Validation Before Full Build

1. **Enable `conversational_matching` flag** for admin users
2. **Build minimal conversational UI** (pills only, no globe integration, no importance weighting) — test core flow works
3. **Add `highlightMatches()` to globe** — test visual convergence with hardcoded alignment vectors
4. **If both work**: proceed with full integration. The pieces are validated independently before connecting them.

---

## The Vision in One Paragraph

A citizen lands on Governada and sees a slowly rotating globe with hundreds of glowing nodes — each one a real governance participant. Below the globe: "What matters to you?" with governance topic pills floating in front. They tap "Treasury." Instantly, 200 nodes on the globe shift to warm amber — those are DReps who care about treasury too. They tap "Preserve the treasury." The amber cluster narrows to 60. One more answer: 15 bright nodes. The app found their people. A card slides in: "You're a Treasury Guardian." Their governance identity, visualized. Below: three DRep matches, each with a real quote that echoes what the citizen said they believe. The globe camera drifts toward the top match. The citizen never left the homepage. They never filled out a form. They just told the app what they care about, and watched the world respond.
