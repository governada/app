# Proposal Lifecycle Phase 3: Submission Ceremony

> **Status:** Complete — shipped to production (PRs #464, #465)
> **Created:** 2026-03-19
> **Depends on:** Phase 2 (complete — PRs #460-463)
> **Estimated effort:** 2-3 sessions

---

## Why This Exists

Submitting a governance action on Cardano commits ~100,000 ADA as a refundable deposit. The current submission flow is a compact modal with a type-to-confirm gate — appropriate for a prototype, but not for a $100K decision. The exploration recommended a "Launch Sequence" — a full-page experience with proportional ceremony that shows the proposer's journey, surfaces the readiness data from Phase 2, and creates a deliberate pause before the irreversible action.

**Note:** The actual MeshJS governance action transaction is not yet implemented (CIP-108 metadata publishes but the on-chain tx returns `status: 'published'`). This phase builds the submission ceremony UX so that when MeshJS support ships, the ceremony is ready. The final wallet signature step will be wired when available.

---

## Current State

**SubmissionFlow.tsx** — 5-step modal:

1. Review (shows draft content summary)
2. Deposit Warning (100K ADA, balance check)
3. Confirmation (type "SUBMIT" to proceed)
4. Processing (publishing, building, signing steps)
5. Success/Error

**What works:** The state machine (`useGovernanceAction` hook) handles the phase transitions cleanly. The preflight balance check exists. The CIP-108 publish endpoint works.

**What's missing from the exploration recommendation:**

- Not full-page (still a modal)
- No financial simulation (deposit, balance, return conditions, voting mechanics)
- No team sign-off gate
- No cooldown timer
- No approval chain summary (journey context at signing time)
- No confidence score integration
- No post-submission monitoring view

---

## What to Build

### 3.1 — Full-Page Submission Experience

Replace the modal-based SubmissionFlow with a dedicated full-page route: `/workspace/author/[draftId]/submit`

**Navigation:** The "Submit On-Chain" button in DraftActions navigates to this page instead of opening a modal. The page uses WorkspacePanels for layout consistency.

**Page structure:**

```
┌─ Submit: [Proposal Title] ──────────────────────────────────────┐
│ ← Back to editor                                                 │
│                                                                   │
│  ┌─ Left: Journey Summary ─────┐  ┌─ Right: Submission ────────┐ │
│  │                              │  │                             │ │
│  │  Community Confidence: 78%   │  │  Step 1 of 4               │ │
│  │  ████████████████░░░░ High   │  │                             │ │
│  │                              │  │  [Current step content]     │ │
│  │  ── Journey ──────────       │  │                             │ │
│  │  ✓ Draft created (Mar 12)    │  │                             │ │
│  │  ✓ 3 versions (v1→v3)       │  │                             │ │
│  │  ✓ 5 reviews received        │  │                             │ │
│  │  ✓ All reviews addressed     │  │                             │ │
│  │  ✓ Constitutional: Pass      │  │                             │ │
│  │  ✓ 48h in review             │  │                             │ │
│  │                              │  │                             │ │
│  │  ── Team ────────────        │  │                             │ │
│  │  ✓ Alice (Lead) approved     │  │                             │ │
│  │  ✓ Bob (Editor) approved     │  │                             │ │
│  │                              │  │                             │ │
│  └──────────────────────────────┘  └─────────────────────────────┘ │
└──────────────────────────────────────────────────────────────────┘
```

**Left panel (Journey Summary):** Always visible. Shows the proposal's path to this point — an at-a-glance approval chain (Ironclad pattern). Computed from existing data:

- Confidence score + level (from `computeConfidence`)
- Draft timeline (created → versions → reviews → responses)
- Review summary (count, average score, stale count)
- Constitutional check result
- Team sign-off status (if team exists)

**Right panel (Submission Steps):** Multi-step wizard progressing through the ceremony.

### 3.2 — Submission Steps

The right panel progresses through 4 steps:

**Step 1: Financial Simulation**

```
┌─ Financial Impact ──────────────────────────────┐
│                                                   │
│  Deposit Required:      100,000 ADA               │
│  Estimated Fee:         ~2 ADA                     │
│  Your Wallet Balance:   250,000 ADA                │
│  Balance After:         149,998 ADA                │
│                                                   │
│  ── Deposit Return Conditions ──                  │
│  ✓ Returned if proposal is ratified               │
│  ✓ Returned if proposal expires (after N epochs)  │
│  ⚠ May not be returned if dropped as              │
│    unconstitutional                                │
│                                                   │
│  ── Voting Mechanics ──                           │
│  Bodies that vote: DRep + CC                       │
│  Threshold: 67% DRep voting power + CC majority   │
│  Voting period: ~6 epochs (~30 days)              │
│                                                   │
│  [Insufficient funds? →]  (shown if can't afford) │
│                                                   │
│                            [Continue →]            │
└───────────────────────────────────────────────────┘
```

**Data sources:**

- Deposit/fee/balance: from `useGovernanceAction` preflight (EXISTS)
- Deposit return conditions: static content per proposal type
- Voting mechanics: computed from proposal type → which bodies vote, what threshold. Use `lib/constitution.ts` article references for threshold data.
- Voting period: approximate from epoch params

**Step 2: CIP-108 Preview**

```
┌─ Metadata Preview ──────────────────────────────┐
│                                                   │
│  This is the governance metadata that will be     │
│  published permanently. Review it carefully.      │
│                                                   │
│  ┌─ CIP-108 JSON-LD ──────────────────────────┐  │
│  │  {                                          │  │
│  │    "@context": { ... },                     │  │
│  │    "body": {                                │  │
│  │      "title": "...",                        │  │
│  │      "abstract": "...",                     │  │
│  │      ...                                    │  │
│  │    }                                        │  │
│  │  }                                          │  │
│  └─────────────────────────────────────────────┘  │
│                                                   │
│  Anchor URL: governada.io/api/workspace/cip108/.. │
│  Content Hash: blake2b-256: a1b2c3...             │
│                                                   │
│                    [← Back]  [Continue →]          │
└───────────────────────────────────────────────────┘
```

**Data:** Generate CIP-108 preview using existing `useCip108Preview()` hook.

**Step 3: Team Sign-Off** (conditional — only if team exists)

```
┌─ Team Authorization ────────────────────────────┐
│                                                   │
│  All team members must approve before submission. │
│                                                   │
│  ✓ Alice (Lead) — approved                       │
│  ✓ Bob (Editor) — approved                       │
│  ✗ Carol (Editor) — pending                      │
│                                                   │
│  Waiting for 1 team member...                     │
│                                                   │
│  [Request Approval →] (sends notification)        │
│                                                   │
│                    [← Back]  [Continue →]          │
│                    (disabled until all approved)   │
└───────────────────────────────────────────────────┘
```

**This is NEW functionality.** Requires:

- New DB column or table: `proposal_team_approvals` (team_member_id, approved_at)
- API endpoint: `POST /api/workspace/drafts/[draftId]/approve` (team member approves)
- API endpoint: `GET /api/workspace/drafts/[draftId]/approvals` (list approvals)
- The lead can always proceed (they're the submitter). Editors must approve.
- If no team exists, this step is skipped entirely.

**Simplification option:** For Phase 3, make team sign-off INFORMATIONAL rather than BLOCKING. Show the sign-off status but allow the lead to proceed regardless. The blocking gate can be added in Phase 4 when team collaboration is more mature.

**Step 4: Final Confirmation + Cooldown**

```
┌─ Confirm Submission ────────────────────────────┐
│                                                   │
│              100,000 ADA                          │
│          REFUNDABLE DEPOSIT                       │
│                                                   │
│  This action is irreversible once confirmed.      │
│  The deposit will be locked until the proposal    │
│  is ratified or expires.                          │
│                                                   │
│  ┌─────────────────────────────────────────────┐  │
│  │  ░░░░░░░░░░░░░░░░░░░░░░░░░  15s remaining  │  │
│  └─────────────────────────────────────────────┘  │
│                                                   │
│  [← Back]  [Sign & Submit] (disabled during       │
│             cooldown, enabled after 15s)           │
└───────────────────────────────────────────────────┘
```

**Cooldown timer:** 15 seconds. The "Sign & Submit" button is disabled and shows a countdown. After 15 seconds, it becomes active. This forced pause prevents impulse submissions.

**On click "Sign & Submit":**

1. Call `useGovernanceAction` hook's `confirmSubmission()`
2. Show processing overlay (publishing → building → signing → submitting)
3. On success → navigate to success view
4. On error → show error with retry option

### 3.3 — Success View

After successful submission, show a celebration + next steps:

```
┌─ Submission Successful ─────────────────────────┐
│                                                   │
│  🎉 Your proposal is now on-chain!               │
│                                                   │
│  Transaction: abc123...def                        │
│  [View on Cardanoscan →]                          │
│                                                   │
│  ── What Happens Next ──                          │
│  • DReps and CC members will review and vote      │
│  • Voting period: ~6 epochs (~30 days)            │
│  • You'll see voting progress in your portfolio   │
│  • Deposit returned on ratification or expiry     │
│                                                   │
│  [Return to Portfolio →]  [Share →]               │
└───────────────────────────────────────────────────┘
```

### 3.4 — Journey Summary Panel

The left panel computes the proposal's journey from existing data:

```typescript
interface JourneySummary {
  createdAt: string;
  versionCount: number;
  reviewCount: number;
  nonStaleReviewCount: number;
  averageScore: number | null;
  allReviewsAddressed: boolean;
  constitutionalCheck: 'pass' | 'warning' | 'fail' | null;
  timeInReview: number; // hours
  teamApprovals?: { name: string; role: string; approved: boolean }[];
  confidence: ConfidenceResult;
}
```

All data comes from existing hooks/APIs — no new backend needed.

---

## Schema Changes

### Migration: Team Approvals (optional — only if blocking sign-off)

If implementing team sign-off as a BLOCKING gate:

```sql
CREATE TABLE proposal_team_approvals (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  draft_id UUID NOT NULL REFERENCES proposal_drafts(id) ON DELETE CASCADE,
  team_member_id UUID NOT NULL REFERENCES proposal_team_members(id) ON DELETE CASCADE,
  approved_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(draft_id, team_member_id)
);
```

**If implementing as INFORMATIONAL only (recommended for Phase 3):** No migration needed. Show team status from existing `proposal_team_members` data without a separate approval table. The blocking gate can use this table in Phase 4.

---

## API Changes

| Endpoint                                                    | Method | Change         | Purpose                      |
| ----------------------------------------------------------- | ------ | -------------- | ---------------------------- |
| None required for Phase 3 if team sign-off is informational | —      | —              | —                            |
| `POST /api/workspace/drafts/[id]/approve`                   | POST   | New (optional) | Team member records approval |
| `GET /api/workspace/drafts/[id]/approvals`                  | GET    | New (optional) | List team approvals          |

**Recommendation:** Skip the approval APIs for Phase 3. Make Step 3 (Team Sign-Off) informational — shows who's on the team and their roles, but doesn't block. Add the approval API + blocking gate in Phase 4 when team collaboration is more mature.

---

## New Files

| File                                                             | Purpose                                                        |
| ---------------------------------------------------------------- | -------------------------------------------------------------- |
| `app/workspace/author/[draftId]/submit/page.tsx`                 | Full-page submission route                                     |
| `components/workspace/author/submission/JourneySummary.tsx`      | Left panel — approval chain display                            |
| `components/workspace/author/submission/FinancialSimulation.tsx` | Step 1 — deposit, balance, return conditions, voting mechanics |
| `components/workspace/author/submission/MetadataPreview.tsx`     | Step 2 — CIP-108 JSON-LD preview                               |
| `components/workspace/author/submission/TeamSignOff.tsx`         | Step 3 — team approval status (informational)                  |
| `components/workspace/author/submission/FinalConfirmation.tsx`   | Step 4 — cooldown timer + sign button                          |
| `components/workspace/author/submission/SubmissionSuccess.tsx`   | Post-submission celebration + next steps                       |

---

## Execution Plan

### Session 1: Full-page route + financial simulation + journey summary (parallel-safe)

**Agent A — Frontend (submission page + steps 1-2):**

- Create `/workspace/author/[draftId]/submit/page.tsx` route
- Create JourneySummary component (left panel)
- Create FinancialSimulation component (Step 1)
- Create MetadataPreview component (Step 2)
- Wire WorkspacePanels layout
- Navigation from DraftActions "Submit On-Chain" → new route

**Agent B — Frontend (steps 3-4 + success):**

- Create TeamSignOff component (Step 3 — informational, shows team roles)
- Create FinalConfirmation component (Step 4 — cooldown timer + submit button)
- Create SubmissionSuccess component (post-submission view)
- Wire the step progression (wizard state machine)
- Connect to existing `useGovernanceAction` hook for the actual submission

### Session 2: Integration + polish

- Wire all steps together into a cohesive wizard flow
- Test: navigate to submit → step through → cooldown → sign → success
- Type-specific handling (Treasury shows withdrawal amount, Parameter shows params)
- Voting mechanics display per proposal type
- Mobile responsive layout
- Edge cases: insufficient balance, no team, already submitted
- Update DraftActions to navigate to new route instead of opening modal
- Remove old SubmissionFlow modal (or keep as fallback behind feature flag)

---

## What This Unblocks

| Phase 4 Feature                   | Depends on Phase 3                                        |
| --------------------------------- | --------------------------------------------------------- |
| **Post-submission monitoring**    | Success view links to monitoring dashboard                |
| **Team approval gate** (blocking) | TeamSignOff component exists, needs API + blocking logic  |
| **Deposit tracking**              | Financial simulation establishes the deposit data display |
| **Relaunch on failure**           | Success/error views provide the starting point            |

---

## What We Are NOT Doing in Phase 3

- **Actual MeshJS governance action transaction** — The CIP-108 publish works, but the on-chain tx depends on MeshJS. The ceremony is built so it's ready when MeshJS ships.
- **Blocking team approval gate** — Team sign-off is informational in Phase 3. Blocking requires a new table + approval API (Phase 4).
- **Post-submission monitoring dashboard** — That's Phase 4. The success view links forward to it.
- **Deposit tracking** — Tracking whether a deposit was returned requires on-chain data. Phase 4.
- **Vote simulation** — "Would this proposal pass?" prediction is a future feature.

---

## Risks

| Risk                                                  | Likelihood   | Mitigation                                                                                                                                          |
| ----------------------------------------------------- | ------------ | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| Full-page feels heavy for Info Actions (no deposit)   | Medium       | Scale ceremony by type: Info Actions skip financial simulation + cooldown (deposit is 0 or very low). Show a simplified 2-step flow.                |
| Cooldown timer feels patronizing to experienced users | Low          | 15 seconds is short. The timer shows the deposit amount prominently — it's a feature, not friction.                                                 |
| MeshJS not ready → signing step is a no-op            | High (known) | The ceremony works up to "Sign & Submit". The actual signing is behind a feature flag. Users see "Publishing metadata..." as the current end state. |
| Journey summary data is expensive to compute          | Low          | All data already fetched (draft, reviews, versions, confidence). No new API calls.                                                                  |
