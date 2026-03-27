# Explore: Authenticated Homepage — Globe + Seneca as Unified Brain

> **Date**: 2026-03-26
> **Feature**: Authenticated homepage experience (cockpit, globe, Seneca, actions)
> **Trigger**: Founder frustrated with regression — zoomed globe, ugly CC ring, missing Seneca, dead widgets

---

## Phase 1: Current State Snapshot

### Routes & Components

- **Entry**: `app/page.tsx` → `HubHomePage.tsx` (segment dispatcher)
- **Cockpit v2** (flag `globe_homepage_v2`): `CockpitHomePage.tsx` → StatusStrip, SenecaStrip, ActionRail, OverlayTabs, CockpitDetailPanel, SenecaOrb
- **Globe**: `GlobeConstellation.tsx` (Three.js, full viewport)
- **CC visuals**: `CCCrownRing.tsx` (golden torus + hex medallions)
- **Seneca**: SenecaOrb (bottom-right, does nothing), SenecaStrip (single-line typewriter), IntelligencePanel (right slide-out)

### Core JTBD (from ux-constraints.md)

| Persona | Job                                   | 5-Second Answer                                    |
| ------- | ------------------------------------- | -------------------------------------------------- |
| Citizen | Check if anything needs my attention  | "Everything's fine" or "Something needs attention" |
| DRep    | See what needs my action right now    | "N proposals need your vote"                       |
| SPO     | Check my governance reputation status | "Your score is X, trending up/stable/down"         |

### What's Working Well

- **Anonymous globe** is beautiful and atmospheric — the full-viewport living constellation is the brand
- **Globe-Seneca bridge** infrastructure exists (custom events, camera flyTo)
- **Intelligence layer** is deep — advisor, context synthesis, governance state, priority signals
- **Matching engine** is mature — profile, confidence, dimension agreement, narrative generation
- **Embeddings** are production-ready — pgvector, OpenAI, semantic search, hybrid search
- **Boot sequence** concept (timed cascade revealing layers) is architecturally sound

### What's At Its Ceiling / Broken

1. **Zoomed-in globe** — loses the panoramic wonder of the anonymous view. The globe's power IS the overview.
2. **CC Crown Ring** — golden torus with hex medallions looks gimmicky. These are constitutional guardians, not royalty.
3. **Proposals as white nodes outside globe** — disconnected from the network. Proposals should be WITHIN the governance body, not orbiting it.
4. **HUD bar under header** — StatusStrip + SenecaStrip compete with GovernadaHeader. Two bars of text fighting for attention.
5. **OverlayTabs (action bar)** — 3/4 tabs are non-functional. The concept of switching globe "modes" is valid but the execution is unfinished.
6. **SenecaOrb** — beautiful concept (floating AI orb with whisper bubbles), but literally does nothing right now.
7. **No Seneca briefing** — the entire intelligence layer exists in the backend but nothing narrates on the homepage.
8. **No temporal replay** — TemporalScrubber is a placeholder component.
9. **CockpitDetailPanel** — right-side detail panel works but feels disconnected from the flow.

### Current Score: 3/10

The anonymous globe experience is 8/10. The authenticated version took that 8 and made it a 3 by adding half-built layers that obscure the globe's beauty without delivering functional value.

---

## Phase 2: Technology Possibility Scan

### 2a: AI/ML Capability Audit

| Capability                       | Status        | What It Enables                                      |
| -------------------------------- | ------------- | ---------------------------------------------------- |
| **Seneca persona system**        | EXISTS        | Consistent AI voice across all narration             |
| **Streaming text generation**    | EXISTS        | Real-time narration via SSE                          |
| **Governance state synthesis**   | EXISTS        | "Here's what's happening right now" in 1-2 sentences |
| **Priority signals**             | EXISTS        | "Here's what matters to YOU" based on alignments     |
| **Entity detection in text**     | EXISTS        | Parse governance entities from natural language      |
| **Semantic embeddings**          | EXISTS        | Vector search for proposals, DReps, rationales       |
| **Match narrative generation**   | EXISTS        | "Why this DRep fits you" explanations                |
| **Deep research decomposition**  | EXISTS        | Break complex questions into sub-queries             |
| **Proposal prediction**          | EXISTS        | Cosine similarity + sigmoid for support estimation   |
| **Character profiles**           | EXISTS        | Vivid DRep/SPO character generation                  |
| **Alignment drift detection**    | EXISTS        | Track divergence between citizen and their DRep      |
| **Hub insights**                 | EXISTS        | AI-generated personalized dashboard intelligence     |
| **Context-aware briefing**       | EXISTS        | Per-page, per-persona context synthesis              |
| **Globe camera bridge**          | EXISTS        | Custom events to fly globe camera to nodes           |
| **Globe node highlighting**      | EXISTS        | urgentNodeIds, completedNodeIds, overlayColorMode    |
| **Conversational advisor**       | EXISTS        | Multi-turn streaming conversation                    |
| **Predicted follow-ups**         | BUILDABLE_NOW | Extend advisor to suggest 2-3 next questions         |
| **Globe-synchronized narration** | BUILDABLE_NOW | Stream text + emit globe commands per entity mention |
| **Temporal governance replay**   | BUILDABLE_NOW | Vote/delegation data exists, need animation pipeline |
| **Neural pathway visualization** | BUILDABLE_NOW | Node connection arcs exist, need animation trigger   |
| **Ambient proactive alerts**     | BUILDABLE_NOW | Priority signals exist, need push-to-UI pipeline     |

### 2b: Spatial & Visual Computation

The globe already has:

- Node types with distinct colors (DRep teal, SPO purple, CC golden, proposals white)
- Delegation bond arcs between nodes
- Atmosphere shader driven by healthScore (teal=healthy, amber=stressed) and urgency (heartbeat pulse)
- Camera interpolation (flyTo behavior)
- Network edges overlay (delegation bonds, voting alignment, CC-DRep connections)
- Overlay color modes (urgent, network, proposals, ecosystem)

What's POSSIBLE but not built:

- **Neural pathway animation**: Light up arcs sequentially as if electricity flows through the network
- **Node pulsing synchronized to text stream**: As Seneca mentions a DRep, that node pulses
- **Proposal integration INTO the globe**: Proposals as energy sources within the constellation, not orbiting outside
- **CC members as anchor nodes**: Large, stable, central — not a separate floating ring
- **Temporal morphing**: Globe state transitions smoothly between epochs (nodes appear/disappear/move)
- **User-centric gravity**: The authenticated user's node subtly pulls related nodes closer

### 2c: Cross-Feature Integration

- **Match flow** could START from the globe — Seneca says "I see you don't have a DRep yet. Want me to find your match?" and the globe begins highlighting potential matches with match-intensity brightness
- **Proposal review** could be previewed on the globe — hovering a proposal node shows vote distribution as colored arcs to DReps who voted
- **Epoch history** feeds temporal replay — every vote, delegation, and proposal has timestamps
- **Treasury flows** could render as energy moving through the network — proposals that receive funding pulse with a golden wave

---

## Phase 3: Inspiration Research (Key Findings)

### Spotify AI DJ — Narrated Curation with Personality

The DJ explains WHY things matter to you, not just what happened. "Here's a deep cut from an artist you haven't listened to in a while" — the insight is personal, not informational. A "writers' room" of experts + AI produces commentary that blends editorial judgment with personalization.

**For Governada**: Seneca should say "A treasury proposal just entered voting that would fund developer tools — and based on your governance DNA, you usually support these. But your DRep voted No last time. Want me to explain why?" — personal, contextual, actionable.

### Bbycroft LLM Visualization — Visible Thinking

Full 3D visualization of a transformer network where you can watch data flow through layers in real-time. Each layer lights up as computation passes through. Seamless macro-to-micro zoom.

**For Governada**: When Seneca is "thinking," neural pathway arcs light up across the globe connecting the nodes Seneca is analyzing. The visual metaphor: you're watching Seneca's brain process governance data in real-time.

### Siri/Voice-Assistant Orb — 4-State Visual Machine

Idle (soft glow) → Listening (waveform expands) → Thinking (slow rotation, color shift) → Responding (pulsing waves, full brightness). Perlin noise for organic displacement. Each state has distinct rotation speeds and animation intensities.

**For Governada**: The globe itself IS the orb. When Seneca is idle, the globe breathes gently. When analyzing, nodes pulse. When narrating, arcs light up in sync with text streaming. The entire globe is the visual embodiment of Seneca.

### Perplexity — Predicted Follow-Ups

Recognizes users don't always know what to ask next. Suggests 2-3 follow-up questions after every answer. 82% of users say the interface is cleaner than competitors.

**For Governada**: Every Seneca briefing segment ends with 2-3 contextual follow-ups: "Dig into the treasury impact?" / "Compare this to your DRep's position?" / "See how other citizens feel?"

### Bloomberg Terminal — Task-Organized Density

Keyboard-first, autocomplete-driven. The LAST command shows your 8 most recent functions. Color-coded keys. Job is "concealing complexity" — density organized by task, not data type.

**For Governada**: Seneca search bar is the Bloomberg command line. Type anything, get results. Keyboard shortcuts (1-4) switch globe overlays. Power users never touch the mouse.

### Spotify Wrapped — Shareable Temporal Identity Cards

9:16 vertical format for Instagram Stories/TikTok. Bite-sized slides, one insight per card with dramatic animation. Vibrant gradients designed to stand out in feeds.

**For Governada**: "Epoch Wrapped" — per-user governance participation cards. Globe renders a personalized time-lapse. Shareable to Twitter/X in vertical format.

---

## Phase 4: Three Alternative Concepts

---

### Concept A: "The Synaptic Brief" — Seneca Narrates, the Globe Illustrates

**Core Insight**: The homepage IS a personalized governance briefing delivered as a live stream. The globe is not a standalone visualization — it's the visual cortex of Seneca's narration. Text and globe are one system: as Seneca mentions entities, the globe reacts.

**Why This Is Novel**: No product combines AI-narrated briefing with a synchronized 3D spatial visualization. Perplexity has conversational research but no spatial dimension. Stripe has a beautiful globe but no intelligence layer. Bloomberg has density but no narration. This fuses all three: conversational AI + spatial visualization + governance intelligence, where the three are one system, not separate features.

**Inspiration Source**: Spotify AI DJ (personality-driven narration) + Bbycroft LLM Viz (visible thinking) + Perplexity (follow-up questions). Goes BEYOND all three by making the narration DRIVE a spatial visualization in real-time.

**The Experience**:

1. **Arrival** (0-2s): Full-viewport globe, identical vantage to anonymous view — the panoramic constellation. No HUD clutter. Just the globe, the header nav, and a subtle Seneca presence.

2. **Seneca awakens** (2-4s): A soft pulse originates from the center of the globe. A text panel slides up from the bottom-left (roughly 40% width, 30% height) — clean, dark glass, the Compass palette. Seneca's avatar (a small teal orb) appears at the top of the panel.

3. **The Brief begins** (4-15s): Seneca streams a personalized 2-3 sentence governance briefing. AS the text streams:
   - When Seneca mentions "3 proposals entering voting" → 3 proposal nodes within the globe pulse with amber light, arcs ripple outward to connected DReps
   - When Seneca mentions "your DRep" → the user's delegation bond arc glows teal, camera eases slightly toward the DRep node
   - When Seneca mentions "treasury health" → a golden energy wave pulses through the globe's core
   - Each entity mention is a **clickable inline link** in the text — hover previews the entity, click navigates

4. **The Invitation** (15-20s): The brief concludes. Below the text, 3 follow-up chips appear:
   - "Show me the proposals" (globe highlights all active proposals)
   - "How's my DRep doing?" (globe flies to DRep, detail panel opens)
   - "What should I do?" (Seneca generates a priority-ordered action list)

   If the user does nothing for 10s, a fourth chip: "Brief me on what I missed" (epoch changes since last visit).

5. **Interactive exploration**: Clicking any chip triggers Seneca to stream a deeper response. The globe reconfigures to match. The text panel grows to accommodate longer responses. The user can also:
   - Click any globe node directly → Seneca explains it
   - Type in the Seneca panel → free-form conversation
   - Press `Esc` → panel minimizes, globe returns to ambient state
   - Press `Space` → replay the brief

6. **The "wow" moment**: When Seneca mentions a contentious proposal, the globe splits into two visible clusters — DReps who voted Yes on one side, No on the other, with arcs crossing the divide. The division is visceral. You SEE the governance tension.

**The Emotional Arc**:

- **Entry**: Wonder (the globe is alive and breathing)
- **Brief begins**: Engagement ("Seneca is talking TO me, not AT me")
- **Entity highlights**: Delight ("the globe is showing me what Seneca is saying")
- **Follow-up chips**: Agency ("I choose what to explore next")
- **Deep conversation**: Flow ("I'm in dialogue with Cardano's governance")
- **Telling a friend**: "You have to see what Governada does — the AI literally shows you what's happening in governance while it explains it. The whole globe lights up."

**The Technical Engine**:

- Seneca streams via SSE (EXISTS)
- Entity detection in stream extracts globe commands (BUILDABLE_NOW — extend `entityDetector.ts` to emit `senecaGlobeCommand` events mid-stream)
- Globe camera interpolation on entity mention (EXISTS — `useSenecaGlobeBridge`)
- Node highlighting on mention (EXISTS — `urgentNodeIds` mechanism)
- Follow-up generation as part of briefing response (BUILDABLE_NOW — extend advisor prompt to append 3 follow-ups)
- Priority signals feed briefing personalization (EXISTS — `lib/intelligence/priority.ts`)
- Vote cluster visualization (BUILDABLE_NOW — PCA positions exist, need to animate cluster separation)

**Cross-Feature Connections**:

- Brief feeds naturally into Match flow ("Find my DRep" chip → QuickMatch)
- Brief feeds into Proposal review ("Show proposals" → governance/proposals with context)
- Brief feeds into Workspace ("Vote now" → workspace with proposal pre-loaded)
- Epoch replay is a recorded version of a past brief with temporal globe animation

**What It Removes**:

- StatusStrip (epoch info moves to header, which already shows it)
- SenecaStrip (replaced by the full briefing panel)
- OverlayTabs (replaced by Seneca-driven globe state changes)
- ActionRail (actions surface through Seneca's brief, not a separate rail)
- CCCrownRing (CC members become large anchor nodes within the constellation)
- CockpitDetailPanel (replaced by inline entity previews in Seneca's text)

**The Ceiling**: JTBD 9/10 | Emotional 10/10 | Novelty 10/10 | Differentiation 10/10 | Feasibility 7/10

**What It Sacrifices**: Information density for first-time visitors. Power users who want a dashboard-at-a-glance won't get one — they get a narrative. Mitigated by: Seneca's brief IS the glance (2-3 sentences), and follow-up chips provide instant drill-down.

**Effort**: L (2-3 days for core, +2 days for polish)

**The Share Moment**: Screen-recording the moment Seneca mentions a contentious proposal and the globe splits into Yes/No clusters with arcs crossing the divide. "Look at what Governada does when governance is divided."

**The "No One Else Does This" Statement**: "Governada is the only platform where an AI companion narrates your governance briefing while a living constellation visualizes every entity it discusses in real-time."

---

### Concept B: "The Governance Pulse" — The Globe Has a Heartbeat

**Core Insight**: The globe is a living organism. It has a heartbeat. The heartbeat IS governance activity — every vote, delegation, and proposal creates a pulse that ripples through the constellation. Seneca is the organism's consciousness, speaking only when something is noteworthy. You don't read governance. You FEEL it.

**Why This Is Novel**: No data visualization has ever made data feel physiological. Health apps track heartbeats but don't VISUALIZE them spatially. Trading floors show tickers but don't make you FEEL market tension. This makes governance tangible as a living system with vital signs — heart rate (activity), temperature (sentiment), blood pressure (power concentration).

**Inspiration Source**: Apple Health (vital signs at a glance) + NASA Mission Control (situational awareness) + Audio-reactive visualizations (visual response to signal). Goes BEYOND by making the visualization itself the primary interface — not a chart showing vitals, but a living body BEING vital.

**The Experience**:

1. **Arrival**: Full-viewport globe. You immediately notice it's ALIVE — a rhythmic pulse emanates from the center outward, like a heartbeat. The pulse frequency maps to current governance activity. During a quiet epoch day, it's a slow, calming throb. When multiple proposals are in voting, it's a rapid, energetic pulse. You feel the tempo before you read anything.

2. **Vital signs (ambient)**: Three subtle indicators float at the globe's edge, not in a bar — they're part of the globe's atmosphere:
   - **Pulse rate** (bottom center, small): "42 bpm" — governance actions per hour, rendered as a micro EKG line
   - **Temperature** (top right, small): "52° — Mild" — sentiment temperature, already exists
   - **Pressure** (top left, small): Voting power concentration indicator

3. **Seneca speaks (proactive)**: Seneca doesn't always speak. It watches. When something noteworthy happens, a subtle ripple originates from the relevant node and Seneca's voice appears as a floating annotation near that node — not in a panel, but ON the globe, like a thought bubble in the constellation:
   - "This proposal just crossed the approval threshold" (annotation near proposal node, which pulses golden)
   - "Your DRep hasn't voted in 3 days — unusual for them" (annotation near DRep node, which dims)
   - "A new delegation wave — 12 citizens just delegated to your DRep" (wave of teal pulses converge on DRep node)

4. **Interaction**: Touch/click any node and it becomes the heartbeat's focal point — the pulse now emanates FROM that node. Seneca contextualizes:
   - Click DRep → pulse shows their voting rhythm (regular = reliable, erratic = inconsistent)
   - Click proposal → pulse shows voting momentum (accelerating = gaining support, decelerating = stalling)
   - Click your own node → pulse shows your governance footprint rippling through the network

5. **The Daily Ritual**: Each visit, you glance at the pulse. Fast pulse = governance is active, check in. Slow pulse = nothing urgent, move on. This creates a 2-second homepage visit pattern that's addictive — like checking your heart rate on Apple Watch.

6. **The "wow" moment**: During a contentious vote, the globe's heartbeat becomes irregular — arrhythmic — as opposing voting blocks create competing pulse sources. Two rhythms fight for dominance. When the vote resolves, one rhythm wins and the globe returns to a steady beat. You watch governance resolve in real-time as a visual drama.

**The Emotional Arc**:

- **Entry**: Ambient awareness ("the pulse tells me everything in 1 second")
- **Fast pulse**: Curiosity ("what's happening?")
- **Seneca annotation**: Informed ("ah, that's why")
- **Node click**: Understanding ("I see how this connects")
- **Telling a friend**: "Governada has a heartbeat — you can literally FEEL when governance is active"

**The Technical Engine**:

- Heartbeat pulse: shader animation driven by governance activity count from `/api/intelligence/governance-state` (BUILDABLE_NOW)
- Proactive Seneca annotations: extend `useSenecaStrip` to render as floating 3D labels near nodes instead of a top bar (BUILDABLE_NOW)
- Node-centric pulse redirection on click: modify atmosphere shader focal point (BUILDABLE_NOW)
- Competing pulse sources during contentious votes: multi-source shader animation (BUILDABLE_NOW — vote distribution data exists)
- Activity count per hour: aggregate from votes/delegations table (EXISTS — data in Supabase)

**Cross-Feature Connections**:

- Pulse rate becomes a persistent micro-indicator across all pages (like a fitness tracker complication)
- Epoch Wrapped includes "Your governance heartbeat" — a replay of pulse patterns over time
- Anomaly detection: irregular heartbeat = automatic Seneca alert

**What It Removes**:

- All HUD bars (StatusStrip, SenecaStrip)
- ActionRail (actions surface as Seneca annotations)
- OverlayTabs (the pulse IS the overview — no modes needed)
- CCCrownRing (CC members are high-frequency pulse nodes, not a separate ring)
- Text-heavy UI elements (this is a VISUAL-FIRST experience)

**The Ceiling**: JTBD 7/10 | Emotional 10/10 | Novelty 10/10 | Differentiation 10/10 | Feasibility 6/10

**What It Sacrifices**: Explicit information density. You FEEL governance state but don't READ details without clicking. Citizens who want "what should I do?" don't get a clear answer from the pulse alone. DReps who need an action queue don't see one. Mitigated by: Seneca annotations proactively surface actions, and clicking nodes reveals detail.

**Effort**: XL (4-5 days for shader work + Seneca annotation system)

**The Share Moment**: Time-lapse of the governance heartbeat over an epoch — the pulse accelerating as voting deadlines approach, becoming arrhythmic during contentious votes, then settling. "Watch Cardano's governance heartbeat over 5 days."

**The "No One Else Does This" Statement**: "Governada is the only platform where you can feel governance as a living heartbeat — a 2-second glance tells you the state of an entire ecosystem."

---

### Concept C: "The Synapse" — Globe as Seneca's Visible Brain

**Core Insight**: The globe IS Seneca's brain, rendered as a neural network. Governance entities are neurons. Connections between them are synapses. When Seneca thinks about something, you watch the neural pathways light up across the globe in real-time — electrical impulses flowing from node to node as Seneca traces relationships. The experience is: you're looking inside the mind of an AI that understands your governance ecosystem.

**Why This Is Novel**: Bbycroft's LLM viz shows AI thinking but it's abstract and educational. This makes AI thinking SPATIAL and PERSONAL — mapped onto a governance topology that represents YOUR ecosystem. No product has ever shown an AI's reasoning process as a real-time spatial visualization overlaid on domain-specific data.

**Inspiration Source**: Bbycroft LLM visualization (visible AI thinking) + NeuroGlance brain atlas (guided tour with AI narration) + Siri orb (4-state visual machine). Goes BEYOND all three by mapping AI reasoning onto a REAL data topology (not abstract layers) and making the visualization interactive (not just watchable).

**The Experience**:

1. **Arrival**: Full-viewport globe — the familiar constellation. But look closer: faint gossamer threads connect nodes in a web-like neural mesh. The network is barely visible, breathing softly. This IS Seneca's neural substrate.

2. **Seneca boots** (2-4s): The globe's center brightens. A wave of soft light pulses outward through the neural mesh — Seneca coming online. A minimal text element appears bottom-center (not a panel — just floating text like a subtitle):

   _"Good evening. Let me look at what's changed..."_

3. **Neural trace** (4-10s): Visible electrical impulses begin flowing through the mesh. You can SEE Seneca scanning the network:
   - Impulses flow to proposal nodes → proposals pulse as Seneca "reads" them
   - Impulses flow to the user's DRep → the delegation bond glows as Seneca checks alignment
   - Impulses converge on a cluster → Seneca found something noteworthy

   The text updates as Seneca processes:
   _"3 proposals active... your DRep voted on 2... one needs attention."_

4. **Focus reveal**: The neural impulses converge on the noteworthy item. The globe camera eases toward it (not a snap — a gentle drift). The surrounding nodes dim slightly. The focal node and its connections brighten. A detail card appears beside it:
   - Proposal title + 1-line Seneca summary
   - Your DRep's position (or "hasn't voted yet")
   - Community sentiment indicator
   - Action button: "Review" or "See analysis"

5. **Branching paths**: After showing the focal item, Seneca offers branches — not as text chips but as VISIBLE neural pathways from the current node. Three paths glow, each leading to a different destination:
   - Path to a cluster of DReps → "See who supports this"
   - Path to treasury → "See the financial impact"
   - Path to your profile → "See how this aligns with your values"

   Click a path and the impulse flows along it, camera follows, and you arrive at the next topic. The experience is TRAVERSING the neural network.

6. **Free exploration**: At any time, click any node to redirect Seneca's attention. Neural impulses reroute to your chosen node. Seneca responds to what you're looking at — like Gemini Live's "point and ask" but spatial.

7. **The "wow" moment**: When you ask Seneca a complex question ("Why did governance health drop this epoch?"), you watch impulses explode outward from the center, racing across dozens of pathways simultaneously, probing different parts of the network. Nodes light up in sequence as Seneca traces the causal chain. Then the impulses converge back to center and Seneca delivers the answer — you watched it THINK.

**The Emotional Arc**:

- **Entry**: Intrigue ("the network is alive, something is moving through it")
- **Neural trace**: Awe ("I'm watching an AI think about governance")
- **Focus reveal**: Clarity ("it found what matters to me")
- **Path traversal**: Agency ("I choose where to go in the network")
- **Complex query**: Wonder ("I literally watched it work through the answer")
- **Telling a friend**: "Governada shows you an AI thinking — you watch it trace through the governance network to find answers"

**The Technical Engine**:

- Neural mesh: Additional line geometry connecting all nodes with very low opacity (BUILDABLE_NOW — positions exist, need mesh generation)
- Impulse animation: Shader-driven particle flow along mesh edges (BUILDABLE_NOW — similar to existing arc animation but directional)
- Trace routing: When Seneca mentions entity X, emit impulse from center → X along shortest mesh path (BUILDABLE_NOW — need graph shortest-path calculation)
- Streaming text with entity extraction: Extend `entityDetector.ts` to emit globe commands mid-stream (BUILDABLE_NOW)
- Branching paths as glowing edges: Identify 3 most relevant connected nodes and highlight edges (BUILDABLE_NOW — edge data exists)
- Complex query visualization: Fan-out impulse to all queried data sources, converge on answer (BUILDABLE_NOW)

**Cross-Feature Connections**:

- Neural trace becomes a universal "Seneca is working" indicator across all pages
- Research deep-dives show the full neural trace for transparency ("here's how I found this answer")
- Epoch replay shows the epoch's neural activity as a time-lapse — every query, every insight, every connection Seneca made

**What It Removes**:

- All HUD bars (replaced by floating subtitle text)
- ActionRail (actions surface through Seneca's neural focus)
- OverlayTabs (the neural trace IS the overlay — it shows what's relevant)
- CCCrownRing (CC members are large anchor neurons with many connections)
- CockpitDetailPanel (replaced by in-context detail cards at node locations)
- SenecaOrb (the GLOBE is Seneca's embodiment — no separate orb needed)

**The Ceiling**: JTBD 8/10 | Emotional 10/10 | Novelty 10/10 | Differentiation 10/10 | Feasibility 5/10

**What It Sacrifices**: Immediate readability. The neural visualization is mesmerizing but requires a moment to understand. First-time users may be confused by impulses flowing through the network. Mitigated by: the floating text provides grounding context, and the brief is still text-based — the neural trace is ambient enhancement, not the only information source.

**Effort**: XL (5-7 days for neural mesh + impulse shaders + path routing + Seneca integration)

**The Share Moment**: Recording Seneca answering a complex governance question with impulses racing across the neural network, converging, and delivering the answer. "Watch an AI think about blockchain governance."

**The "No One Else Does This" Statement**: "Governada is the only platform where you can watch an AI trace through a governance neural network to find answers — you literally see it think."

---

## Phase 5: Comparative Analysis

| Dimension            | Current (Cockpit v2) | A: Synaptic Brief | B: Governance Pulse        | C: The Synapse      |
| -------------------- | -------------------- | ----------------- | -------------------------- | ------------------- |
| JTBD Ceiling         | 3/10                 | 9/10              | 7/10                       | 8/10                |
| Emotional Impact     | 3/10                 | 9/10              | 10/10                      | 10/10               |
| Novelty              | 5/10                 | 9/10              | 10/10                      | 10/10               |
| Technical Ambition   | 6/10                 | 7/10              | 8/10                       | 9/10                |
| Differentiation      | 5/10                 | 9/10              | 10/10                      | 10/10               |
| Viral / Share Moment | 2/10                 | 8/10              | 9/10                       | 10/10               |
| Feasibility          | 3/10                 | 7/10              | 5/10                       | 4/10                |
| Data Requirements    | Has everything       | Has everything    | Needs activity aggregation | Needs graph routing |
| Effort               | —                    | L (2-3 days)      | XL (4-5 days)              | XL (5-7 days)       |

**The Question**: Concept A has the highest JTBD ceiling with the best feasibility. Concept C has the highest "I've never seen anything like this" factor. Concept B has the most visceral emotional impact.

---

## Phase 6: Recommendation

### The Winning Concept: A+C Hybrid — "The Synaptic Brief"

**Concept A as the foundation** (Seneca narrates, globe illustrates) **with Concept C's neural mesh as the visual language** (impulses flowing through the constellation as Seneca thinks).

### Why This Hybrid Wins

1. **JTBD ceiling is 9/10** — Seneca's briefing directly answers every persona's core question within 15 seconds
2. **Novelty is 10/10** — No product combines AI narration + synchronized spatial visualization + visible AI reasoning
3. **Feasibility is 6-7/10** — Most building blocks exist; neural mesh is the main new work
4. **The "wow" compounds**: The brief gives you value (JTBD), the globe gives you wonder (emotional), the neural trace gives you transparency (trust)

### What to Steal from Concept B

- **The heartbeat**: The globe SHOULD have a subtle ambient pulse driven by governance activity. This is cheap to build (just atmosphere shader modulation) and gives the 2-second-glance value ("fast pulse = check in")
- **Proactive annotations**: When Seneca notices something urgent between visits, surface it as a floating annotation on the globe — don't wait for the user to ask

### The "Wow" Walkthrough (Investor Demo)

> _You open Governada. The constellation globe fills your screen — thousands of nodes representing every participant in Cardano's governance. It's breathing gently, a slow pulse showing that governance is calm today._
>
> _A text panel slides up from the bottom corner. Seneca, your governance companion, begins speaking:_
>
> _"Good evening. Three proposals entered voting since your last visit."_
>
> _As Seneca says "three proposals," three nodes within the constellation pulse with amber light. Faint neural impulses flow outward from them through the mesh, connecting to DReps who've already voted._
>
> _"Your DRep voted Yes on two of them. The third — a 2.5M ADA treasury withdrawal for developer tooling — is contentious. 47% support."_
>
> _The globe camera drifts toward the contentious proposal. You see it at the center of a tense web — teal arcs to supporters on one side, amber arcs to opponents on the other. The governance tension is VISIBLE._
>
> _Three chips appear below: "See the arguments" / "Check your DRep's position" / "What should I do?"_
>
> _You click "See the arguments." Seneca's neural impulses race outward from the proposal, tracing paths to rationales submitted by DReps on both sides. The globe highlights the speakers. Seneca streams a balanced summary of the Yes and No arguments, with inline links to each DRep who made them._
>
> _You realize: in 30 seconds, without clicking through any pages, you understand the governance landscape. The AI found what matters. The visualization showed you why it matters. And you chose your own path through it._

### Implementation Roadmap

**Phase 1: Foundation (Day 1)** — Remove the regression

- Strip: StatusStrip, SenecaStrip, OverlayTabs, ActionRail, CCCrownRing, CockpitDetailPanel
- Restore full-viewport globe with anonymous-view camera position
- CC members become large anchor nodes within constellation (not a separate ring)
- Proposals become nodes WITHIN the globe (not orbiting outside)
- Result: Clean globe, no HUD clutter, authenticated users see the same beautiful globe as anonymous

**Phase 2: Seneca Briefing Panel (Day 1-2)** — The text layer

- Build briefing panel: bottom-left, glass-morphism, ~40% width, ~30% height
- Wire to `/api/intelligence/hub-insights` + `/api/intelligence/priority` for personalized brief
- Stream via SSE with `createAnthropicStream()`
- Add entity detection in stream → emit `senecaGlobeCommand` events
- Add follow-up chip generation (3 suggested actions appended to brief)
- Add click handlers on chips → deeper Seneca response + globe reconfiguration
- Add free-form text input at bottom of panel → full advisor conversation

**Phase 3: Globe Synchronization (Day 2-3)** — The visual brain

- Node pulse on entity mention (extend existing `urgentNodeIds` mechanism)
- Camera drift on entity mention (extend existing `useSenecaGlobeBridge`)
- Vote cluster visualization for contentious proposals (PCA-based separation)
- Neural mesh: gossamer threads connecting nearby nodes (low-opacity line geometry)
- Neural impulse animation: directional particle flow along mesh edges when Seneca "thinks"

**Phase 4: Ambient Vitals (Day 3)** — The heartbeat steal from Concept B

- Globe atmosphere pulse rate driven by governance activity count
- Subtle vital signs as atmospheric effects (not HUD text)
- Proactive Seneca annotations for urgent items (floating near relevant nodes)

**Phase 5: Temporal Replay (Day 3-4)** — The share moment

- Epoch replay: temporal scrubber that morphs globe state across epoch
- Shareable "Epoch Wrapped" cards (vertical format, Compass palette)
- Screen-recordable briefing playback for social sharing

### What to REMOVE

| Component                    | Why                                                                   |
| ---------------------------- | --------------------------------------------------------------------- |
| StatusStrip                  | Epoch info already in header. Temperature becomes atmospheric.        |
| SenecaStrip                  | Replaced by full briefing panel                                       |
| OverlayTabs                  | Globe state driven by Seneca, not manual tabs                         |
| ActionRail                   | Actions surface through Seneca's brief                                |
| CCCrownRing + hex medallions | CC members become anchor nodes in constellation                       |
| CockpitDetailPanel           | Replaced by inline entity previews in Seneca panel                    |
| SenecaOrb (bottom-right)     | The globe IS Seneca's embodiment                                      |
| NetworkEdges (SVG overlay)   | Replaced by Three.js neural mesh                                      |
| Boot sequence timing         | No need for cascading HUD reveal — globe + Seneca are the only layers |

### New Data/AI Requirements

| Need                                   | Status        | Work                                            |
| -------------------------------------- | ------------- | ----------------------------------------------- |
| Streaming briefing with entity tagging | BUILDABLE_NOW | Extend advisor to emit entity events mid-stream |
| Neural mesh geometry                   | BUILDABLE_NOW | Generate line mesh from node positions          |
| Impulse shader                         | BUILDABLE_NOW | Directional particle animation along edges      |
| Follow-up chip generation              | BUILDABLE_NOW | Append to advisor response format               |
| Vote cluster separation                | BUILDABLE_NOW | PCA coordinates exist, animate separation       |
| Activity-driven pulse rate             | BUILDABLE_NOW | Count recent governance actions                 |
| Temporal replay data                   | EXISTS        | Vote/delegation timestamps in Supabase          |

### Risk Assessment

| Risk                                | Mitigation                                                                                               |
| ----------------------------------- | -------------------------------------------------------------------------------------------------------- |
| Neural mesh hurts globe performance | Start with low node-count mesh, profile, optimize. Fallback: no mesh, just node highlights               |
| Seneca briefing feels slow          | Stream immediately. First sentence appears in <2s. Show globe breathing while loading                    |
| Users miss the old HUD density      | The briefing panel IS the density — inline entity links provide instant drill-down                       |
| Mobile layout challenges            | Mobile: Seneca brief as a card below a smaller globe. Neural mesh disabled. Same content, adapted layout |
| AI costs from per-visit briefings   | Cache briefings per-epoch-day. Only regenerate when governance state changes. ~$0.01/briefing            |

### Validation Suggestion

Before building the full neural mesh (Phase 3), ship Phases 1-2 first:

1. Clean globe + Seneca briefing panel with entity highlighting (no neural mesh yet)
2. Test with 5-10 real users: Does the narrated briefing + synchronized globe feel like one system?
3. If yes → build the neural mesh. If no → iterate on the briefing/globe synchronization first.

This de-risks the most ambitious visual work while delivering immediate value.

---

## CC Member Symbology: The Rethink

Instead of a golden crown ring with hexagonal medallions:

**CC members as gravitational anchors**: Large, luminous nodes positioned at the constellation's structural intersections. They don't float ABOVE the network — they're embedded WITHIN it, at key structural positions. Their size reflects constitutional weight. Their color is a warm amber (not gold — gold reads as "royalty," amber reads as "wisdom/warmth").

When a CC member votes, their node emits a distinctive SQUARE pulse (vs the circular pulse of DReps) — a visual cue that this is a different KIND of authority. Their connections to proposals they've reviewed are rendered as structured lattice lines (geometric, orderly) vs the organic curves of DRep delegation bonds — visually communicating "constitutional order."

## Proposal Symbology: The Rethink

Instead of white nodes hovering outside the globe:

**Proposals as energy sources within the constellation**: Proposals are rendered INSIDE the globe, positioned near the DRep clusters most relevant to them (based on vote distribution or category alignment). Their visual treatment:

- **Active proposals**: Warm amber glow with radiating arcs to DReps who've voted
- **Passed proposals**: Soft teal (completed, part of the governance body now)
- **Failed proposals**: Dim, reduced opacity (fading from the constellation)
- **Contentious proposals**: Dual-tone (teal + amber arcs showing the divide)

Proposals aren't separate from the governance body — they're EVENTS within it. Like electrical storms in a neural network.
