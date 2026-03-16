# Feature Exploration: Proposal Authoring & Lifecycle Management

> **Status:** Exploration complete — awaiting founder decision
> **Created:** 2026-03-16
> **Companion to:** `explorations/proposal-review-tool.md` (the DRep/SPO review workspace)
> **Scope:** End-to-end proposal lifecycle: drafting, feedback, iteration, version management, submission, and the handoff to the review/voting process

---

## Phase 1: Current State — How Proposals Are Born and Die Today

### The On-Chain Process (CIP-1694)

Any ADA holder can submit a governance action by depositing 100,000 ADA and providing a CIP-108 compliant JSON-LD metadata document hosted on IPFS/Arweave. The action has a 6-epoch (~30 day) lifetime. If not ratified by the required governance bodies within that window, it expires and the deposit returns.

**Seven action types exist:** Motion of No-Confidence, New CC/Threshold, Constitutional Amendment, Hard Fork Initiation, Protocol Parameter Changes, Treasury Withdrawals, Info Actions.

**Critical constraint: governance actions are immutable after submission.** If there's an error or the community demands changes, the team must withdraw and resubmit — costing another 100,000 ADA deposit and resetting the clock.

### The Off-Chain Reality (Where the Real Problems Live)

There is **no canonical drafting or collaboration tool**. The current workflow:

| Stage                | Where It Happens                      | Tools Used                                    |
| -------------------- | ------------------------------------- | --------------------------------------------- |
| Ideation             | Twitter, Discord                      | Informal posts, voice channels                |
| Drafting             | Private                               | Google Docs, PDFs, markdown files             |
| Community feedback   | Cardano Forum, GovTool discussions    | Forum threads, scattered replies              |
| Coalition building   | Twitter, Discord DMs, community calls | Informal, no structured process               |
| Metadata preparation | Technical teams                       | Manual CIP-108 JSON-LD creation, IPFS pinning |
| On-chain submission  | CLI or GovTool                        | `cardano-cli conway transaction build`        |
| Voting period        | GovTool, Governada, explorers         | 6 epochs, immutable                           |

### The Constitutional Amendment Disaster (The Case Study)

The Cardano Constitution went through versions v1.0 → v2.3 → v2.4. What happened:

- **Changes tracked via separate PDF documents** ("List of changes from v1.0 to v2.4.pdf") — no integrated diffing
- **EMURGO (the largest DRep) voted No on v2.3** because of three specific wording changes they disagreed with. These changes were buried in a lengthy legal document with no clear way to find them.
- **The three contested changes had to be reverted** to v1.0 wording in v2.4 before EMURGO would support it
- **DReps demanded line-by-line change tracking** — the same way legal document revisions are conducted. No tool provided this.
- **The on-chain record shows only THAT the constitution hash changed** — not WHAT changed. The entire deliberation history exists only in scattered forum posts and PDFs.

This is exactly the problem Governada can solve.

### The 12 Friction Points

1. **No drafting or collaboration tool** — teams use Google Docs, PDFs, forum posts
2. **No version control** — constitutional amendments tracked via separate PDF changelogs
3. **Immutability after submission** — errors cost 100K ADA + a fresh 30-day cycle
4. **100K ADA deposit barrier** — penalizes iteration and grassroots proposals
5. **Fragmented discussion** — feedback scattered across 5+ platforms
6. **No diff tooling** — DReps must compare lengthy documents manually
7. **Inconsistent proposal formats** — each team structures differently
8. **No link between off-chain discussion and on-chain action** — the anchor URL doesn't carry history
9. **No formal review process** — no stages, no gates, no structured feedback
10. **No constitutional pre-check** — teams discover constitutional conflicts after submission
11. **No proposal comparison** — DReps evaluating competing proposals must read each independently
12. **GovTool instability** — nearly sunset, rotating maintenance teams, limited features

### Existing Tools and Their Gaps

| Tool                                          | What It Does                                   | What It Doesn't Do                                                      |
| --------------------------------------------- | ---------------------------------------------- | ----------------------------------------------------------------------- |
| **GovTool**                                   | DRep registration, proposal discussion, voting | No drafting, no version control, no structured review, nearly sunset    |
| **Cardano Forum**                             | Community discussion of proposal drafts        | No connection to on-chain actions, no metadata enforcement, no workflow |
| **AI Proposal Examiner** (Cardano Foundation) | Constitutional compliance checks, risk scoring | Assessment only — no drafting, no iteration support                     |
| **Ekklesia**                                  | Off-chain budget polling, DRep signaling       | Budget-specific, no general proposal management                         |
| **Governada** (current)                       | Proposal viewing, voting, intelligence         | No authoring, no pre-submission support                                 |

**The gap is clear: nothing manages the proposal lifecycle from draft to submission.** Every tool picks up the story after on-chain submission. The entire authoring, iteration, and pre-submission review process has no tooling at all.

---

## Phase 2: Inspiration Research — Key Patterns

### Legislative Drafting

| Pattern                                       | Source                                        | Core Insight                                                                                                                        |
| --------------------------------------------- | --------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| **Semantic structure beneath simple surface** | LegisPro / Akoma Ntoso XML                    | Proposals look like rich text but are structured data. Enables smart comparison, template enforcement, machine-readable amendments. |
| **Change sets (not just track changes)**      | LegisPro                                      | Named bundles of modifications that can be toggled, compared, and merged independently. More powerful than linear version history.  |
| **Named lifecycle stages**                    | U.S. Congress bill versions (IS→RH→EH→ES→ENR) | Not just timestamps — each stage has a name, rules, and significance. "Engrossed" means something different from "Introduced."      |
| **The Amendment Tree**                        | U.S. Senate ATS                               | Structured branching model for amendments. Capacity constraints force prioritization.                                               |
| **Point-in-time navigation**                  | UK legislation.gov.uk                         | "Show me this law as it stood on date X." Time-travel through document history.                                                     |
| **Railway/journey metaphor**                  | EU Legislative Train Schedule                 | Proposals as carriages on a track. Visual progress, delay, or derailment.                                                           |

### Legal Versioning

| Pattern                                | Source                            | Core Insight                                                                                                                                                       |
| -------------------------------------- | --------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Redline vs. Blackline**              | Legal practice (Ironclad, Litera) | Redline = negotiation tool (active editing with attribution). Blackline = verification tool (clean comparison between versions). Both needed for different stages. |
| **Three-pane synchronized comparison** | Litera Compare                    | Original, modified, and redline with synced scrolling and numbered changes. The legal gold standard.                                                               |
| **Semantic diff**                      | CallidusAI, Spellbook             | Flags meaning-changing edits separately from cosmetic rewording. "shall" → "may" is a semantic shift, not just a word swap.                                        |
| **AI-assisted first-pass redline**     | Ironclad Jurist AI                | AI proposes amendments against the organization's playbook, with explanations. Human reviews and accepts/rejects.                                                  |

### Collaborative Authoring

| Pattern                                 | Source      | Core Insight                                                                                                    |
| --------------------------------------- | ----------- | --------------------------------------------------------------------------------------------------------------- |
| **Suggesting mode**                     | Google Docs | Proposed changes exist as tracked suggestions until explicitly accepted. Separates "proposing" from "deciding." |
| **Named versions**                      | Google Docs | Mark specific states with meaningful names ("Pre-Community-Review Draft"). Filter to see only named versions.   |
| **Edit summaries**                      | Wikipedia   | Every edit requires a summary. Creates human-readable changelog alongside the technical diff.                   |
| **Talk pages**                          | Wikipedia   | Discussion about the document happens in a parallel space, not inline. Separates content from meta-discussion.  |
| **Change Requests (PR model for docs)** | GitBook     | Document changes submitted as pull-request-like objects. Reviewed, commented, approved, merged.                 |

### Governance Proposal Platforms

| Pattern                                | Source                | Core Insight                                                                                                                |
| -------------------------------------- | --------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| **Discussion-to-proposal pipeline**    | Commonwealth, ENS DAO | Community discussion threads promoted to formal proposals, preserving the provenance of ideas.                              |
| **Structured review rubrics**          | Cardano Catalyst      | Not "leave a comment" but "rate Impact 1-5, rate Feasibility 1-5, explain your reasoning." Comparable, aggregable feedback. |
| **Proposal simulation**                | Tally                 | Preview what would happen on-chain if the proposal passes. "This would transfer X ADA from the treasury."                   |
| **Draft-to-on-chain pipeline**         | Tally, Snapshot       | Off-chain drafts iterated before formal on-chain submission. Different people can draft vs. submit.                         |
| **Gasless participation for feedback** | Snapshot              | Lower the barrier to commenting/reviewing to near-zero.                                                                     |

### Process Design

| Pattern                                   | Source                       | Core Insight                                                                                                  |
| ----------------------------------------- | ---------------------------- | ------------------------------------------------------------------------------------------------------------- |
| **Final Comment Period (FCP)**            | Rust RFC, IETF               | Bounded timeframe before a decision with a stated disposition (accept/reject/postpone). Forces resolution.    |
| **Working Draft stage**                   | IETF Internet-Drafts         | Low-stakes "sandbox" where ideas can be half-baked without reputational risk.                                 |
| **Wide review requirement**               | W3C                          | Advancing requires demonstrating that relevant stakeholders actively reviewed, not just that nobody objected. |
| **Point-by-point response**               | Academic peer review         | Authors must formally address every reviewer concern, either incorporating it or explaining why not.          |
| **Ready-for-dev status**                  | Figma handoff                | Explicit binary signal: this is done / this is still in progress. Gates what actions are available.           |
| **Implementation experience requirement** | W3C Candidate Recommendation | Advancement requires evidence the spec works in practice. Grounds proposals in reality.                       |

---

## Phase 3: Data Opportunity Scan

### What the Authoring Lifecycle Generates

If Governada owns the proposal lifecycle, it captures data that no other tool has:

| Data                                                                                   | What It Enables                                                                                          |
| -------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| **Draft history** — every version of the proposal as it evolves                        | Diff engine, "show me what changed," trust signal ("this proposal went through 7 iterations")            |
| **Feedback history** — every comment, review, and response                             | Quality signal ("23 DReps reviewed this draft"), accountability ("the team addressed 18 of 20 concerns") |
| **Amendment proposals** — structured change requests against the proposal              | The debate record: what was proposed, what was accepted, what was rejected and why                       |
| **Constitutional pre-check results** — AI analysis at each version                     | Compliance trajectory: "v1 had 3 constitutional concerns, v4 has 0"                                      |
| **Community sentiment by section** — which parts are contested vs. agreed              | Focus signal for reviewers: "Section 3's budget is contested, everything else has consensus"             |
| **Author responsiveness** — how quickly and thoroughly teams respond to feedback       | Trust signal for future proposals from the same team                                                     |
| **Proposal comparison data** — structured fields across competing proposals            | "Compare these 3 competing treasury proposals side by side"                                              |
| **Off-chain to on-chain provenance** — the full journey from idea to governance action | Transparency: the on-chain action links back to every discussion and iteration that produced it          |

**This data compounds.** After one year of proposal lifecycle management, Governada has a dataset of governance deliberation that literally cannot exist anywhere else — it's created by the process, not scraped from the chain.

### The Moat This Creates

Today, anyone can build a governance dashboard from on-chain data. The on-chain moat is shallow. But the **off-chain proposal lifecycle data** — drafts, feedback, amendments, debates, author track records, constitutional evolution — is created by Governada's platform and exists nowhere else. This is the second moat (alongside citizen engagement data) that makes the platform irreplaceable.

---

## Phase 4: Three Alternative Concepts

### Concept A: "The Legislative Studio"

**Core Insight:** Governance proposals are legislation. Build the legislative drafting platform that Cardano deserves — structured authoring, semantic versioning, amendment management, constitutional compliance, and the full lifecycle from idea to ratification.

**Inspiration:** LegisPro + Google Docs Suggesting Mode + Litera Compare + Tally proposal simulation

#### The Experience

**For Proposal Teams:**

The team opens `/workspace/author` and starts a new proposal:

1. **Template selection.** Choose proposal type (Treasury Withdrawal, Parameter Change, Constitutional Amendment, Info Action, etc.). Each template has required and optional sections pre-configured. CIP-108 fields are enforced by structure.

2. **Collaborative editor.** A rich-text editor with structured sections (Title, Abstract, Motivation, Rationale, Budget, Timeline, Team, References). Multiple team members edit simultaneously. Every section is semantically tagged — the system knows "this is the budget section" not "this is text on page 3."

3. **Version management.** Named versions at each stage: "Working Draft v1," "Post-Community-Feedback v2," "Final for Submission v3." Each named version is a snapshot that can be compared against any other.

4. **Constitutional pre-check.** At any point, the team can run a constitutional compliance check. AI analyzes the proposal against the Cardano Constitution (v2.4) and flags potential conflicts with specific articles. The team addresses flags before submission.

5. **Community Review phase.** When the team marks the proposal "Ready for Community Review," it becomes visible to DReps, SPOs, and citizens. Structured feedback forms (not just comments) collect reviews with dimensional scores.

6. **Amendment management.** DReps and community members can propose amendments as structured "change sets" — suggested modifications to specific sections that exist independently of the base document. The team accepts, rejects, or modifies each amendment, with a response explaining their decision.

7. **Diff engine.** At any point, anyone can compare any two versions with a three-pane view: original, modified, redline. Semantic awareness means the tool highlights "budget changed from 5M to 3M ADA" not just "text on line 47 changed."

8. **Final Comment Period.** Before on-chain submission, the team triggers an FCP — a bounded window (e.g., 5 days / 1 epoch) with a stated disposition ("we intend to submit"). This gives the community one last chance to raise concerns. FCP is announced to all DReps/SPOs via the review workspace.

9. **On-chain submission.** When the team submits, Governada generates the CIP-108 JSON-LD, hosts it on IPFS, computes the anchor hash, and constructs the governance transaction. The full draft history, feedback, and amendments are linked from the metadata.

10. **Handoff to review workspace.** The proposal flows into DRep/SPO review workspaces with its entire lifecycle history. The personalized brief can reference: "This proposal went through 4 iterations, addressed 23 pieces of community feedback, and passed constitutional pre-check."

**For Constitutional Amendments specifically:**

- **Line-by-line diff view.** Current constitution on the left, proposed amendment on the right, with every change highlighted. This is the exact feature DReps demanded.
- **Article-level navigation.** "Show me all proposed changes to Article 4." Jump directly to the relevant section.
- **Impact analysis.** "This amendment would change the treasury withdrawal process from X to Y. Here's what that means in practice."

#### The Ceiling

| Dimension          | Score                                                                 |
| ------------------ | --------------------------------------------------------------------- |
| JTBD Coverage      | 10/10 — covers the entire lifecycle                                   |
| Differentiation    | 10/10 — nothing like this exists in any blockchain ecosystem          |
| Power User Ceiling | 10/10 — professional-grade tooling                                    |
| Simplicity         | 5/10 — complex tool with a learning curve                             |
| Feasibility        | 5/10 — XL+ build, significant new infrastructure                      |
| Adoption Barrier   | High — teams must change their workflow to use Governada for drafting |

#### What It Sacrifices

- **Simplicity.** This is a professional tool. Casual users would be overwhelmed.
- **Build time.** The collaborative editor alone is a major engineering effort.
- **Adoption friction.** Teams that already have a drafting process must be convinced to switch.

**Effort:** XL+ (collaborative editor, version management, amendment system, diff engine, CIP-108 generation, IPFS hosting, constitutional pre-check, on-chain submission)

---

### Concept B: "The RFC Pipeline"

**Core Insight:** You don't need to build a Google Docs competitor. What's missing isn't the editor — it's the **process**. Build the stage-gated lifecycle pipeline that transforms chaotic off-chain discussion into structured, reviewable, submittable governance actions.

**Inspiration:** Rust RFC Process + IETF + W3C + ENS DAO + Academic Peer Review

#### The Experience

**For Proposal Teams:**

The team creates a proposal on Governada by importing their draft (paste markdown, upload PDF, or write in a simple markdown editor). The authoring tool is deliberately lightweight — it's not competing with Google Docs. What Governada adds is the **lifecycle pipeline**:

```
  WORKING DRAFT          COMMUNITY REVIEW         FINAL COMMENT PERIOD       ON-CHAIN
  ─────────────          ────────────────         ────────────────────       ────────
  Import/write           Structured feedback       Bounded decision window    CIP-108 gen
  Team iterates          Rubric-based reviews      Stated disposition         IPFS hosting
  Constitutional check   Point-by-point response   Last objection window      Tx submission
  Internal collaboration Version comparison        DRep/SPO notification      → Review workspace
```

**Stage 1: Working Draft**

- Team imports or writes their proposal
- AI constitutional pre-check available at any time
- Internal team discussion (private)
- Multiple versions can be saved with names and summaries
- Proposal is not visible to the public yet
- The team can invite specific DReps or advisors for early private feedback

**Stage 2: Community Review** (triggered by team when ready)

- Proposal becomes publicly visible
- Structured review rubric: reviewers score on relevant dimensions (Impact, Feasibility, Constitutional Alignment, Value for Money) with written feedback
- Discussion threads per section (Talk page pattern — discussion is separate from the document)
- DReps can propose amendments (structured change suggestions)
- Community sentiment aggregated (support, concerns, questions)
- **Minimum time at this stage** (e.g., 2 epochs / 10 days) to prevent rushing

**Stage 3: Response & Revision**

- Team publishes a formal **point-by-point response** to all substantive feedback
- Each reviewer concern is either addressed (incorporated into a new version) or respectfully declined (with explanation)
- New version published with diff available against the Community Review version
- Reviews update their scores if satisfied
- **The response document becomes part of the permanent record**

**Stage 4: Final Comment Period**

- Team announces intention to submit with a specific disposition
- Bounded window (1 epoch / 5 days)
- All DReps/SPOs notified via review workspace
- Last chance for objections
- If no blocking objections, proceeds to submission
- If blocking objections raised, returns to Stage 3 for another iteration

**Stage 5: On-Chain Submission**

- Governada generates CIP-108 JSON-LD from the structured proposal
- Hosts on IPFS, computes anchor hash
- Team signs and submits the governance transaction
- The proposal enters the on-chain voting period with its **entire lifecycle history linked**

**For the DRep Review Workspace:**
When this proposal arrives in the DRep's review workspace, the personalized brief includes:

- "This proposal went through 3 iterations over 4 weeks"
- "18 DRep reviews submitted; 15 favorable, 2 concerns (both addressed), 1 opposed"
- "Constitutional pre-check: clear (2 early flags resolved in v2)"
- "Author responsiveness: all 23 feedback items addressed within 48 hours"
- Diff available: "Show me what changed from the Community Review version to the Final version"

#### The Ceiling

| Dimension          | Score                                                                     |
| ------------------ | ------------------------------------------------------------------------- |
| JTBD Coverage      | 9/10 — covers the lifecycle but with a lighter editor                     |
| Differentiation    | 9/10 — no blockchain ecosystem has a stage-gated proposal pipeline        |
| Power User Ceiling | 8/10 — strong process, but editor is basic                                |
| Simplicity         | 8/10 — teams bring their own editor, Governada adds the pipeline          |
| Feasibility        | 7/10 — L build; process infrastructure, review system, CIP-108 generation |
| Adoption Barrier   | Medium — teams keep their editor, add Governada for the process           |

#### What It Sacrifices

- **Editor quality.** Teams who want rich collaborative editing still use Google Docs. Governada's editor is markdown-only.
- **Real-time collaboration.** No simultaneous editing within Governada's editor.
- **Amendment management depth.** Amendments are suggested but not managed as first-class change sets.

**Effort:** L (lifecycle pipeline, review rubric system, response requirement, FCP mechanism, CIP-108 generation, version comparison, notification system)

---

### Concept C: "The Proposal Forge"

**Core Insight:** Teams will draft proposals wherever they want. They already have workflows. Don't fight that. Instead, be the **forge** — the place where raw drafts are shaped through structured feedback, constitutional fire-testing, version tracking, and the final submission process. Import-first, not author-first.

**Inspiration:** Draftable (import + compare) + Figma handoff (ready status) + Commonwealth (discussion-to-proposal pipeline) + GitHub (diff + review + merge)

#### The Experience

**For Proposal Teams:**

The team drafts their proposal wherever they prefer (Google Docs, Notion, markdown). When they're ready for feedback, they bring it to Governada:

**Step 1: Import**

- Paste markdown, upload PDF/DOCX, or paste a URL (Governada fetches and converts)
- Governada parses the content into structured sections using AI (identifies title, abstract, budget, timeline, rationale, etc.)
- Team verifies the parsing and makes corrections
- Constitutional pre-check runs automatically on import

**Step 2: Iterate (the core loop)**

- Community feedback flows in (reviews, questions, amendments)
- Team imports a new version when they've revised
- **Governada automatically generates the diff** between any two versions — even if they were edited in different tools
- Three-pane comparison view: previous version, current version, redline
- Numbered change list with navigation
- Semantic highlighting: "Budget changed from 5M to 3M ADA" flagged separately from cosmetic edits
- Each import creates a named version snapshot ("Post-EMURGO-Feedback v3")

**Step 3: Pre-submission**

- Team marks proposal as "Ready for Submission"
- Final constitutional check
- CIP-108 metadata auto-generated from structured content
- Preview of on-chain governance action
- Simulation: "If this passes, X ADA will transfer to addresses Y and Z"
- Final Comment Period (optional but encouraged)

**Step 4: Submit**

- Governada hosts final document on IPFS, generates anchor hash
- Team signs governance transaction
- Full version history linked in metadata

**The Diff Engine (the core product):**

For constitutional amendments specifically:

```
+------ CONSTITUTION DIFF: v2.4 → Proposed Amendment ------+
|                                                           |
|  Article 4: The Cardano Treasury                          |
|  ─────────────────────────────────────                    |
|                                                           |
|  Section 3 (MODIFIED):                                    |
|                                                           |
|  [-] Treasury withdrawals shall be proportionate to       |
|  [-] expected ecosystem benefit as determined by the      |
|  [-] governance process.                                  |
|                                                           |
|  [+] Treasury withdrawals shall be proportionate to       |
|  [+] expected ecosystem benefit as determined by the      |
|  [+] governance process, and shall not exceed the Net     |
|  [+] Change Limit approved for the current budget cycle.  |
|                                                           |
|  Change: Added NCL constraint to Section 3                |
|  Impact: High — constrains all treasury withdrawals       |
|  Constitutional alignment: Self-referential (defines      |
|  a new constitutional constraint)                         |
|                                                           |
|  [3 DRep annotations on this change]                      |
|  [Ask a question about this change]                       |
|                                                           |
|  ── Next change (2 of 7) ──                               |
|                                                           |
+-----------------------------------------------------------+
     [← Previous] [Next →]  7 changes total  [View full document]
```

#### The Ceiling

| Dimension          | Score                                                                    |
| ------------------ | ------------------------------------------------------------------------ |
| JTBD Coverage      | 8/10 — strong on iteration and comparison, lighter on authoring          |
| Differentiation    | 9/10 — the diff engine alone is unique; no blockchain tool does this     |
| Power User Ceiling | 9/10 — the diff + comparison tools are professional-grade                |
| Simplicity         | 9/10 — teams keep their workflow, Governada adds governance capabilities |
| Feasibility        | 8/10 — M-L build; diff engine is the main technical challenge            |
| Adoption Barrier   | Low — import-first means zero workflow disruption                        |

#### What It Sacrifices

- **Collaborative authoring.** Teams draft elsewhere. Governada doesn't own the writing experience.
- **Real-time feedback during drafting.** Feedback only flows when the team imports a new version.
- **Process enforcement.** Without owning the editor, Governada can't enforce minimum review times or mandatory sections.

**Effort:** M-L (diff engine, import/parsing pipeline, version management, CIP-108 generation, constitutional pre-check, three-pane comparison UI)

---

## Phase 5: Integration Analysis — How Authoring Connects to the Review Workspace

This is the critical analysis: how does each authoring concept connect to the DRep/SPO review workspace from `proposal-review-tool.md`?

### The Handoff Point

The authoring lifecycle produces a governance action. The review workspace consumes it. The handoff enriches the review experience:

| Authoring Data                            | How It Enriches the Review Workspace                                                          |
| ----------------------------------------- | --------------------------------------------------------------------------------------------- |
| Version history                           | Brief says: "This went through 4 iterations." DRep can view diff between any versions.        |
| Community review scores                   | Brief includes: "15 DReps reviewed pre-submission; average Impact score: 4.2/5"               |
| Author response document                  | Available in Source Material tab: "Team addressed all 23 concerns. Read the response."        |
| Constitutional pre-check history          | Brief says: "2 constitutional flags raised in v1, both resolved in v2."                       |
| Amendment proposals                       | Q&A tab shows: "7 amendments proposed. 4 accepted, 2 declined (with explanation), 1 pending." |
| Section-level sentiment                   | Intelligence sidebar: "Section 3 (Budget) is contested. Sections 1-2, 4-5 have consensus."    |
| Author responsiveness metrics             | Trust signal in brief: "Team responded to all feedback within 48 hours."                      |
| Diff from last community-reviewed version | Source Material tab: "3 changes since community review. View diff."                           |

### Which Authoring Concept Integrates Best?

| Integration Dimension                  | A: Legislative Studio                              | B: RFC Pipeline                                       | C: Proposal Forge                           |
| -------------------------------------- | -------------------------------------------------- | ----------------------------------------------------- | ------------------------------------------- |
| **Data richness for review workspace** | 10/10 — owns everything                            | 9/10 — structured process generates rich data         | 7/10 — only has data from imported versions |
| **Seamless handoff**                   | 10/10 — same platform, same data model             | 9/10 — structured stages create clear handoff         | 7/10 — import-based; less history           |
| **Constitutional amendment support**   | 10/10 — semantic diff, article-level tracking      | 7/10 — markdown diff, less semantic awareness         | 9/10 — diff engine is the core product      |
| **Author-reviewer interaction**        | 10/10 — amendments, Q&A, responses all in-platform | 9/10 — structured review with point-by-point response | 6/10 — feedback only on imported versions   |
| **Competing proposal comparison**      | 10/10 — structured data enables apples-to-apples   | 8/10 — structured rubrics enable comparison           | 7/10 — less structured data                 |

### The Unified System Architecture

Regardless of which authoring concept we choose, the architecture must support:

```
AUTHORING WORKSPACE                    REVIEW WORKSPACE
(Proposal Teams)                       (DReps/SPOs/CC)

  ┌──────────────┐                     ┌──────────────┐
  │ Draft Editor  │                     │ Brief        │◄── enriched by
  │ or Import     │                     │              │    authoring data
  ├──────────────┤     HANDOFF         ├──────────────┤
  │ Version Mgmt  │ ─── on-chain ───►  │ Source Matl.  │◄── includes all
  │ Named stages  │     submission     │ + Diff Engine │    versions + diffs
  ├──────────────┤                     ├──────────────┤
  │ Community     │◄── same system ──► │ Q&A           │◄── continuous from
  │ Feedback      │                     │              │    authoring phase
  ├──────────────┤                     ├──────────────┤
  │ Constitutional│                     │ AI Research   │◄── includes pre-
  │ Pre-check     │                     │              │    check history
  ├──────────────┤                     ├──────────────┤
  │ Amendments    │                     │ Peer Review   │◄── builds on pre-
  │ & Responses   │                     │              │    submission reviews
  └──────────────┘                     ├──────────────┤
                                       │ My Notes      │
                                       ├──────────────┤
                                       │ Vote + Share  │
                                       └──────────────┘
```

The key insight: **the Q&A system, the review rubric, the amendment system, and the constitutional analysis are shared infrastructure.** They exist during authoring AND during voting. The handoff isn't a wall between two systems — it's a phase transition in a continuous process.

---

## Phase 6: Recommendation

### The Winning Concept: B (RFC Pipeline) + C's Diff Engine + A's Constitutional Amendment Support

**Why this hybrid wins:**

1. **B's stage-gated pipeline is the highest-leverage addition.** The biggest problem isn't "teams can't draft" (they can, in Google Docs). The biggest problem is **there's no process** between drafting and on-chain submission. B builds the process.

2. **C's import-first approach is the right adoption strategy.** Requiring teams to learn a new editor is a barrier. Letting them draft anywhere and importing into Governada for the governance lifecycle is zero-friction.

3. **A's constitutional amendment support is non-negotiable for that proposal type.** The line-by-line diff, article-level navigation, and semantic change tracking are the feature DReps demanded. Build this for constitutional amendments specifically.

4. **B's structured review + point-by-point response creates the richest handoff data.** Every DRep concern addressed, every score updated, every amendment accepted/rejected — this is what makes the review workspace briefs dramatically more informative.

### The Unified Lifecycle

```
PHASE 1          PHASE 2              PHASE 3           PHASE 4           PHASE 5
Working Draft     Community Review     Response &         Final Comment      On-Chain
                                       Revision           Period

Import/write      Structured reviews   Point-by-point     Bounded window     CIP-108 gen
AI const. check   Section discussions  response required  Disposition stated IPFS hosting
Private feedback  Amendments proposed  New version + diff 1 epoch duration   Tx submission
Named versions    Rubric scores        Reviews updated    Last objections    → Review WS
                  Min. 2 epoch stay    Diff available     DRep notification  Lifecycle linked
```

**For Constitutional Amendments, add:**

- Line-by-line diff against current constitution at every version
- Article-level change navigation
- Semantic change classification (cosmetic vs. substantive)
- Side-by-side current constitution vs. proposed amendment
- CC member early review invitation (they're the constitutional guardians)

### Implementation Roadmap

#### Wave 1: The Proposal Pipeline Foundation (Phases 0-2)

**Phase 0: Data Model & Import** (2-3 days)

- Proposal entity with revision history (every version stored, not just current)
- Import pipeline: paste markdown, upload PDF/DOCX, AI section parsing
- Named version management with edit summaries
- New route: `/workspace/author`

**Phase 1: Lifecycle Pipeline** (3-5 days)

- Stage management: Working Draft → Community Review → Response → FCP → Submitted
- Stage transition rules (minimum time at Community Review, FCP duration)
- Notification system for stage transitions
- Proposal visibility controls (private during Working Draft, public during Community Review)

**Phase 2: Constitutional Pre-Check** (2-3 days)

- AI constitutional analysis at any point during drafting
- Flag display with specific article references
- Pre-check history tracked across versions
- "Pre-check passed" badge for proposals that clear constitutional review

#### Wave 2: Structured Review & Response (Phases 3-4)

**Phase 3: Review System** (3-5 days)

- Structured review rubric (per proposal type: Impact, Feasibility, Constitutional Alignment, Value for Money)
- Section-level discussion threads (Talk page pattern)
- Amendment proposals (structured change suggestions against specific sections)
- Review score aggregation and display
- Shared infrastructure with the review workspace (Q&A, annotations)

**Phase 4: Response Requirement** (2-3 days)

- Point-by-point response interface (author addresses each review concern)
- Accept/decline/modify workflow for amendments
- Response document published as part of the permanent record
- Reviewer notification: "The team responded to your concern"
- Score update prompt: "Does the team's response satisfy your concern?"

#### Wave 3: Diff Engine & Comparison (Phases 5-6)

**Phase 5: Version Comparison** (3-5 days)

- Three-pane comparison: previous version, current version, redline
- Numbered change list with click-to-navigate
- Semantic awareness for structured sections (budget changes flagged separately)
- Diff available between any two named versions

**Phase 6: Constitutional Amendment Diff** (3-5 days)

- Line-by-line diff against current constitution text
- Article-level change navigation
- Semantic change classification (cosmetic vs. substantive vs. structural)
- Side-by-side constitution view
- Change impact annotations

#### Wave 4: Submission & Integration (Phases 7-8)

**Phase 7: On-Chain Submission** (3-5 days)

- CIP-108 JSON-LD generation from structured proposal
- IPFS hosting with anchor hash computation
- Governance transaction construction (MeshJS)
- Proposal simulation ("If this passes, here's what happens on-chain")
- Lifecycle history linked in metadata

**Phase 8: Review Workspace Integration** (2-3 days)

- Authoring lifecycle data feeds into the personalized brief
- Diff engine available in Source Material tab
- Q&A threads carry over from authoring to review
- Review scores and response documents visible in review workspace
- "Proposal went through N iterations, M concerns addressed" trust signals

### How It Connects to the Review Workspace

| Review Workspace Tab | What Authoring Adds                                                                                                      |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| **Brief**            | "4 iterations, 18 reviews, 15 favorable, constitutional check passed, team response time avg 36hr"                       |
| **Source Material**  | All versions with diffs. For constitutional amendments: line-by-line against current constitution.                       |
| **Q&A**              | Questions from Community Review carry forward. Unresolved questions highlighted.                                         |
| **Peer Review**      | Pre-submission structured reviews visible. DReps can see how the proposal evolved based on feedback.                     |
| **My Notes**         | DReps who participated in Community Review have their previous notes preserved.                                          |
| **AI Research**      | AI can reference the proposal's iteration history. "The budget was 7M in v1 and reduced to 5M after community feedback." |

### The Lock-In Thesis

When both systems are running:

1. **Proposal teams** use Governada because that's where the structured review process happens, where constitutional pre-checks run, where DReps will see their proposal with full context
2. **DReps** use Governada because that's where proposals arrive with rich lifecycle data, where their review workspace lives, where the diff engine shows exactly what changed
3. **Citizens** benefit from unprecedented transparency: every proposal's journey from raw draft to ratified governance action is visible
4. **The dataset** of governance deliberation — drafts, feedback, amendments, responses, votes, rationales — becomes a moat that compounds every epoch

No one can replicate this by scraping on-chain data. The authoring lifecycle is the missing half of the governance data moat.

### Risk Assessment

| Risk                                            | Likelihood | Mitigation                                                                                                                                                                    |
| ----------------------------------------------- | ---------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Teams don't adopt (keep using Forum + GovTool)  | Medium     | Import-first approach means zero workflow change. The value proposition is: "Your proposal arrives in DRep workspaces with full context. Without Governada, it arrives cold." |
| Too complex for casual proposers                | Low        | Working Draft stage is deliberately lightweight. Pipeline stages are progressive — simple proposals can skip to FCP quickly.                                                  |
| Constitutional pre-check gives false confidence | Medium     | Always show as advisory, not definitive. "AI suggests no conflicts, but CC members make the final determination."                                                             |
| Diff engine accuracy on imported documents      | Medium     | Use established comparison libraries. For high-stakes diffs (constitutional amendments), offer manual review mode.                                                            |
| GovTool or other tools catch up                 | Low        | GovTool nearly sunset; community maintenance teams don't have the AI/intelligence layer or the lifecycle pipeline vision.                                                     |

### Validation Suggestion

**Cheapest test:** Take the recent Constitution v2.3 → v2.4 amendment, generate the line-by-line diff with semantic annotations, and share it with DReps who were frustrated by the process. Ask: "If every constitutional amendment came with this view, would it change how you evaluate them?"

**Medium test:** For the next treasury proposal cycle, offer 3-5 proposal teams early access to the Working Draft → Community Review pipeline. Track whether proposals that go through the pipeline receive more informed votes and fewer post-submission complaints.

---

## Appendix: Unified Roadmap (Authoring + Review)

Both systems built in coordinated waves:

| Wave  | Authoring                                              | Review                               | Standalone Value                                                      |
| ----- | ------------------------------------------------------ | ------------------------------------ | --------------------------------------------------------------------- |
| **1** | Pipeline foundation + import                           | Brief + Vote + Share + Queue         | Authors get the pipeline. DReps get the workspace.                    |
| **2** | Structured review + response                           | Source Material + Notes              | Authors get feedback. DReps can go deep.                              |
| **3** | Diff engine + version comparison                       | Q&A + AI Research                    | Authors see version evolution. DReps get intelligence.                |
| **4** | Constitutional amendment support + on-chain submission | Peer Deliberation + Decision Journal | The full system. Constitutional amendments get line-by-line tracking. |

**The key scheduling insight:** Wave 1 of both systems can be built in parallel by different engineers. The shared infrastructure (Q&A system, notification system, proposal data model) should be designed upfront in a shared Phase 0.

Total estimated effort across both systems: 16-24 weeks of engineering to reach Wave 4 completion. Each wave is independently shippable and valuable.
