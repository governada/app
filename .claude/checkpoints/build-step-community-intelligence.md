# Build Step: Community Intelligence from Matching Data

## The Thesis

Every citizen who completes the matching flow generates a governance preference signal. Today that signal dies after producing match results. This build step turns those signals into **community intelligence** — aggregate insights that feed back to every persona in the product, creating compounding flywheels that get more valuable with every match completed.

**No governance platform anywhere does this.** ISideWith collects political preferences but doesn't feed them back to representatives. GovTool doesn't even collect preferences. This is Governada's proprietary data moat.

## What Data We're Collecting (Already)

From every match session:

1. **Pill selections** — which of 8 governance topics citizens select (Treasury, Innovation, Security, Transparency, Decentralization, Developer Funding, Community Growth, Constitutional Compliance)
2. **Importance weights** — dealbreaker (3x) / important (1x) / nice-to-have (0.3x) per dimension
3. **Freeform text** — raw natural language about governance beliefs (up to 500 chars per round, up to 4 rounds)
4. **6D alignment vectors** — computed governance personality profile (0-100 per dimension)
5. **Archetype classification** — Treasury Guardian, Innovation Champion, etc.
6. **Match outcomes** — which DReps were shown, expanded, triggered delegation intent

From ongoing engagement: 7. **Proposal sentiment votes** — support/oppose/unsure on active proposals 8. **Priority signals** — ranked-choice governance focus areas 9. **Endorsements** — citizen-to-DRep endorsement signals

## What Already Exists (Backend)

Infrastructure that's built but not connected to matching data:

- `getCitizenMandate()` — aggregates priority rankings with trend analysis
- `getSentimentDivergence()` — measures citizen vs. DRep vote alignment (Jensen-Shannon divergence)
- `getGovernanceTemperature()` — single 0-100 community mood score
- `user_governance_profiles` table — auto-recomputed alignment profiles
- `engagement_signal_aggregations` table — all citizen signals per entity
- `community_intelligence_snapshots` table — cached aggregate metrics

## The Build: 4 Intelligence Layers

### Layer 1: Matching Signal Pipeline (Backend)

**Store every match session's aggregate signals (anonymous, no PII).**

New table: `governance_preference_signals`

```sql
create table governance_preference_signals (
  id uuid primary key default gen_random_uuid(),
  epoch integer not null,
  -- Aggregate pill selections (what topics citizens care about)
  topic_selections jsonb not null,          -- {treasury: 1, innovation: 1, security: 0, ...}
  -- Importance weights (what's dealbreaker vs nice-to-have)
  importance_weights jsonb,                 -- {treasury: 'dealbreaker', innovation: 'important', ...}
  -- Alignment vector (the 6D governance personality)
  alignment_vector float8[6] not null,      -- [treasuryConservative, treasuryGrowth, decentralization, security, innovation, transparency]
  -- Archetype
  archetype text not null,                  -- 'Treasury Guardian', 'Innovation Champion', etc.
  -- Freeform text topics (extracted keywords, not raw text — privacy-safe)
  extracted_topics text[],                  -- ['developer tooling', 'RWA', 'hard fork timeline']
  -- Match outcome signals
  matched_drep_ids text[],                  -- which DReps were shown
  expanded_drep_ids text[],                 -- which were expanded (interest signal)
  delegated_drep_id text,                   -- which (if any) triggered delegation
  -- Metadata
  created_at timestamptz default now()
);
```

New Inngest function: `aggregate-preference-signals`

- Runs daily at epoch boundary
- Computes: topic trend scores, archetype distribution, alignment centroid shift, emerging text topics
- Writes to `community_intelligence_snapshots` with new signal types

### Layer 2: Community Pulse Dashboard (All Personas)

**A new section accessible from the Compass/Hub showing live community intelligence.**

#### 2a. Topic Heatmap

- "What the community cares about right now"
- Visual: horizontal bar chart of topic selections, sorted by popularity
- Trend arrows: "Innovation ↑23% this epoch" / "Treasury ↓8%"
- Data: aggregated from `governance_preference_signals.topic_selections`

#### 2b. Archetype Distribution

- "Who is the Cardano governance community?"
- Visual: donut chart showing archetype percentages
- "Treasury Guardians: 34% | Innovation Champions: 22% | Security Sentinels: 18% | ..."
- Temporal: "Innovation Champions grew from 15% to 22% since epoch 615"

#### 2c. Alignment Centroid

- "Where the community stands"
- Visual: GovernanceRadar showing the AVERAGE citizen alignment (the community centroid)
- Compare: overlay individual citizen's alignment vs. community average
- Shift detection: "The community shifted toward decentralization this epoch"

#### 2d. Emerging Topics (from freeform text)

- "What's on the community's mind"
- NLP extraction from freeform text inputs → topic clusters
- "Real World Assets mentioned by 47 citizens this epoch (new topic)"
- "Hard fork timeline concern rising — 23 mentions, up from 8 last epoch"
- This feeds back to auto-populate new topic pills in the matching flow

#### 2e. Governance Temperature Widget

- Already computed by `getGovernanceTemperature()`
- Wire it to a visible widget on the Hub/Compass
- "Community temperature: 72 (Warm) — high engagement, moderate polarization"

### Layer 3: Persona-Specific Intelligence Feeds

#### For Citizens (Hub/Civic Identity)

- **"Where you fit"**: "You're in the 12% of citizens who prioritize both decentralization AND innovation"
- **Community comparison radar**: your alignment vs. community centroid overlaid
- **Archetype cohort**: "Treasury Guardians like you tend to delegate to DReps who score 8+ on participation"
- **Alignment evolution**: "Your governance priorities shifted toward security since you first matched" (requires matching history)
- **Proposal predictions**: "Based on your alignment, you'd likely support Proposal X (treasury-conservative, high transparency)"

#### For DReps (Workspace/Profile)

- **Delegator intelligence dashboard**: "Your delegators care about: Infrastructure (42%), Developer Tooling (31%), Security (27%)"
- **Representation gap alert**: "37% of citizens who match with you prioritize innovation, but you voted against 2/3 innovation proposals"
- **Demand signal**: "Growing demand for DReps who prioritize Constitutional Compliance — only 4 active DReps serve this niche"
- **Competitive positioning**: "You rank #3 among DReps for innovation-focused citizens, but #47 for treasury-focused citizens"
- **Sentiment preview**: "Before the vote: 67% of matched citizens support this proposal, 21% oppose"

#### For Proposers (Author Studio)

- **Community alignment score**: "Your proposal resonates with 34% of active citizens (Innovation Champions + balanced)"
- **Framing suggestions**: "38% of citizens list security as a dealbreaker — consider highlighting security benefits"
- **Support prediction**: "Estimated DRep support: 72% (based on aligned DRep voting patterns)"
- **Topic timing**: "Developer tooling proposals have 23% higher community support this epoch vs. last"

#### For SPOs (Profile/Workspace)

- **Staker intelligence**: "Citizens who delegate to your pool prioritize: Security (89%), Decentralization (76%)"
- **Governance positioning**: "Your governance votes align 85% with your stakers' priorities — strong representation"

#### For CC Members (Profile)

- **Constitutional alignment**: "Citizens' top priority diverges from committee votes on 2/8 proposals this epoch"
- **Mandate visibility**: "The citizen mandate this epoch: Infrastructure > Security > DeFi"

### Layer 4: Auto-Learning Topic Engine

**The matching flow evolves based on what citizens tell us.**

#### Freeform Text Mining Pipeline

- New Inngest function: `extract-matching-topics`
- Runs weekly
- Input: all freeform text from `governance_preference_signals.extracted_topics`
- Processing: Claude AI clusters text into topic themes
- Output: ranked list of emerging topics with frequency + trend
- If a new topic exceeds threshold (e.g., 30+ mentions in an epoch): auto-promote to pill

#### Dynamic Pill System

- Replace hardcoded `INITIAL_TOPICS` array with a DB-driven topic list
- New table: `matching_topics`
  - `id`, `text` (display name), `alignment_hints` (6D mapping), `source` ('static' | 'community'), `epoch_introduced`, `selection_count`, `enabled`
- Static topics (Treasury, Innovation, etc.) always present
- Community-detected topics appear/disappear based on relevance
- Visual distinction: community topics get a subtle "trending" indicator

#### Feedback Loop

```
Citizens type freeform text → AI extracts topics
  → Topics cluster and trend → threshold crossed
  → New pill appears in matching flow ("Real World Assets 🔥")
  → Citizens select it → more alignment data collected
  → Better matches, better community intelligence
  → Cycle repeats
```

## Flywheel Effects

### 1. Matching → Intelligence → Better Matching

Every match completed makes the community intelligence richer, which makes the insights more compelling, which draws more citizens to complete matching. The product gets smarter with every user.

### 2. Citizen Insights → DRep Accountability

DReps see what their delegators actually care about. If they ignore it, their representation gap score drops. Citizens see this in DRep profiles. DReps are incentivized to align. Governance improves.

### 3. Pre-Vote Signals → Proposal Quality

Proposers see community sentiment BEFORE submitting. They can align framing to community priorities. Better proposals get funded. Treasury outcomes improve. Citizens see the impact. They engage more.

### 4. Trending Topics → Platform Relevance

The matching flow automatically adapts to what the community is discussing. Governada is always presenting the most relevant governance questions. Citizens feel heard. Engagement compounds.

### 5. Shareability → Viral Growth

"I'm an Innovation Champion in the 12% of Cardano citizens who prioritize decentralization" is inherently shareable. Civic identity + community positioning = social proof + viral distribution.

## Implementation Phases

### Phase A: Signal Pipeline + Community Pulse (Foundation)

- [ ] Create `governance_preference_signals` table
- [ ] Write matching data to signals table on match completion
- [ ] Create `aggregate-preference-signals` Inngest function
- [ ] Build Community Pulse API endpoints
- [ ] Build Topic Heatmap + Archetype Distribution components
- [ ] Wire Governance Temperature to Hub widget
- [ ] Add "Where you fit" to citizen Civic Identity section

**Effort: L (1 week)**
**Impact: Unlocks all downstream intelligence. Every phase depends on this.**

### Phase B: DRep + Proposer Intelligence Feeds

- [ ] Build DRep Delegator Intelligence dashboard card
- [ ] Build Representation Gap alert system
- [ ] Build Proposer Community Alignment score
- [ ] Wire sentiment preview to proposal pages
- [ ] Add demand signals to DRep discovery

**Effort: L (1 week)**
**Impact: Directly activates Accountability + Proposal Quality flywheels**

### Phase C: Auto-Learning Topic Engine

- [ ] Build `extract-matching-topics` Inngest function (Claude AI)
- [ ] Create `matching_topics` table + admin UI
- [ ] Replace hardcoded pills with DB-driven topic list
- [ ] Add "trending" visual indicator for community-detected topics
- [ ] Build feedback dashboard showing topic evolution

**Effort: M (3-4 days)**
**Impact: Platform stays perpetually relevant. Matching flow evolves without manual curation.**

### Phase D: Advanced Insights + Predictions

- [ ] Proposal support prediction model (citizen alignment → expected DRep votes)
- [ ] Citizen alignment evolution tracking (how your priorities change over time)
- [ ] Cross-body alignment analysis (citizens vs. DReps vs. SPOs vs. CC on each dimension)
- [ ] Epoch governance report generation powered by matching intelligence
- [ ] B2B intelligence API for external integrations

**Effort: XL (2+ weeks)**
**Impact: Category-defining. No governance platform has predictive community intelligence.**

## What This Unlocks Strategically

1. **Data moat**: Every citizen match makes the intelligence layer richer. Competitors can copy the UI but not the accumulated preference data.
2. **B2B revenue potential**: Aggregate governance intelligence is valuable to Catalyst teams, research institutions, and governance tool builders.
3. **Pre-vote governance**: For the first time, the community's voice is heard BEFORE votes happen, not just after.
4. **Adaptive product**: The matching flow evolves with the community. No manual curation needed.
5. **Civic identity as platform**: Citizens don't just find a DRep — they discover their governance identity, see where they fit, and track how the community evolves. This is a reason to return.
