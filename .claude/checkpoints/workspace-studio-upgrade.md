# Workspace Studio Upgrade — Handoff Document

> **Status**: Phase 1 COMPLETE. Phases 2-6 remain.
> **Branch**: `claude/pedantic-dhawan`
> **Plan**: `C:\Users\dalto\.claude-personal\plans\glimmering-discovering-crescent.md`
> **Updated**: 2026-03-28

## CRITICAL: Handoff Instructions for Next Agent

1. **Read this entire document first** before writing any code.
2. **Read the plan** at the path above — it contains the full exploration, concepts, and implementation roadmap.
3. **Read the memory files** at `C:\Users\dalto\.claude-personal\projects\C--Users-dalto-governada-governada-app\memory\` — critical feedback from the founder:
   - `feedback_workspace_scope.md` — Workspace = authoring + review only
   - `feedback_globe_functional_nav.md` — Globe as functional navigation
   - `feedback_globe_interaction_model.md` — Globe is visual + Seneca-driven, NOT directly clickable
   - `feedback_legal_change_tracking.md` — Legal-grade tracked changes required
4. **Run `npm run preflight`** to verify the codebase compiles before starting work.
5. **Follow these same handoff practices**: If you begin to run out of context, pause to document and commit a proper handoff document for the next agent before stopping. Quality over quantity.
6. **Pause for decision gating** if you discover something that needs founder discussion/alignment.
7. **Critical rules** (from founder):
   - Workspace = authoring + review studio ONLY (not performance/votes/rationales)
   - Globe is Seneca-driven, NOT directly clickable — users interact via Seneca widget
   - Legal-grade tracked changes are required (reviewer suggestions, version diffs, revision narratives)
   - AI feedback aggregation (theme clustering, endorsement, sealed period) must stay prominent
   - AI should BE the workspace — intelligence as annotations, columns, structured analysis, not a sidebar chatbot

---

## What Was Completed (Phase 1 — All Subphases)

### Phase 1a: QualityPulse + Ambient Constitutional Check

**Files created**:

- `components/workspace/author/QualityPulse.tsx` — Always-visible quality strip above panel tabs with per-section indicators, constitutional badge, feedback count
- `hooks/useAmbientConstitutionalCheck.ts` — Auto-runs constitutional check on content change (5s debounce, FNV-1a hash dedup)

**Files modified**:

- `components/studio/StudioPanel.tsx` — Added `headerContent?: ReactNode` prop for persistent above-tab content
- `app/workspace/editor/[draftId]/page.tsx` — Wired QualityPulse, ambient constitutional check, section analysis hooks

### Phase 1b: Tracked Changes for All Proposal Types

**Architecture decision**: Reuses existing `AIDiffAdded`/`AIDiffRemoved` marks (not a new mark system). Reviewer tracked changes use `review-` editId prefix for visual distinction (blue tint vs green for AI).

**Files modified**:

- `components/workspace/editor/AIDiffMark.tsx`:
  - Extended `AIDiffAdded` and `AIDiffRemoved` marks with `explanation` and `authorName` attributes
  - Reviewer changes render with blue highlighting (vs green for AI suggestions)
  - Added `applyReviewerEdit(editor, proposedText, explanation, authorName)` — applies tracked change at current selection
  - Added `scanAllTrackedChanges(editor)` — extracts all pending changes with metadata
- `components/workspace/editor/SelectionToolbar.tsx`:
  - Added `showSuggestEdit` and `onSuggestEdit` props
  - New "Suggest Edit" button (blue-themed, PenLine icon) appears for reviewers
  - Expanding shows replacement text input + explanation field + submit
  - Pre-fills with selected text for convenience
- `components/workspace/editor/ProposalEditor.tsx`:
  - Added `showSuggestEdit` and `onSuggestEdit` props, passed through to SelectionToolbar
  - Added `handleSuggestEdit` callback that applies `applyReviewerEdit`
- `app/workspace/editor/[draftId]/page.tsx`:
  - `showSuggestEdit={!isOwner && mode === 'review'}` enables for reviewers only
  - PostHog: `tracked_change_proposed` event

### Phase 1c: Proactive Seneca Insights

**Files created**:

- `components/workspace/author/ProactiveInsight.tsx` — Ambient AI insight card below QualityPulse
  - Surfaces top completeness gap or vagueness issue from section analysis
  - 3s typing idle timer (hides while typing)
  - 30s auto-dismiss
  - "Improve this section" CTA triggers AI agent via existing `agentSendMessage`

**Files modified**:

- `app/workspace/editor/[draftId]/page.tsx`:
  - Added ProactiveInsight below QualityPulse in headerContent (owners only)
  - `handleInsightApply` sends section improvement prompt to agent
  - PostHog: `proactive_insight_applied` event

### Phase 1e: Version Diff from Editor

**Files modified**:

- `app/workspace/editor/[draftId]/page.tsx`:
  - Added `VersionCompareDialog` next to "Save Version" button in editor toolbar
  - Shows when versions array has 2+ entries

---

## What Remains

### Phase 2: Review Decision Table (L effort)

Replace the review queue kanban with an AI-enriched analytical decision table.

**Key files to modify**:

- `components/workspace/review/ReviewWorkspace.tsx` — Main review page layout
- `components/workspace/review/ReviewQueue.tsx` — Current kanban queue (replace with table)
- `components/workspace/review/ReviewQueueList.tsx` — Current list items
- `app/api/workspace/review-queue/route.ts` — API needs constitutional risk, alignment columns

**Key files to reference**:

- `hooks/useReviewQueue.ts` — Data source, returns `ReviewQueueItem[]`
- `lib/workspace/types.ts` — `ReviewQueueItem` type (has interBodyVotes, citizenSentiment, epochsRemaining)

**What the API currently returns**: Proposals with inter-body vote tallies, citizen sentiment, epochs remaining, existing vote. Does NOT yet include constitutional check data, alignment scores, or risk levels.

**Implementation**:

1. Create `DecisionTable` component with sortable/filterable columns
2. Columns: Proposal, Type, Urgency, Constitutional Risk, Treasury Impact, Alignment, Community Signal, Your Status
3. Enhance review-queue API to include pre-computed constitutional checks and alignment scores
4. Inline expansion for each cell (click to see detail without leaving table)
5. Unify pre-chain (feedback) and post-chain (voting) into one table with phase filter
6. Use `@tanstack/react-table` (already in deps) for sorting/filtering
7. Feature-flag behind `workspace_decision_table`
8. PostHog: `review_table_sorted`, `review_table_filtered`, `review_cell_expanded`

### Phase 3: Review Studio Intelligence (L effort)

Seneca summary as default view, persistent decision panel, structured analysis visible without tabs.

**Key files**:

- `app/workspace/review/page.tsx` — Review page router
- `components/workspace/review/ProposalContent.tsx` — Raw proposal display
- `components/workspace/review/ReviewWorkspace.tsx` — Studio layout (3-panel resizable)
- `components/studio/StudioPanel.tsx` — Panel system (already has headerContent support)

**What to build**:

1. `SenecaSummary` component — personalized AI summary framed through user's governance philosophy
2. `DecisionPanel` — persistent right panel replacing Vote tab: position tracker, vote buttons, rationale, assumptions
3. `IntelligenceStrip` — compact structured analysis (constitutional, treasury, proposer, community, inter-body)
4. Pre-chain mode: DecisionPanel adapts to show ReviewRubric + "Suggest Edit" instead of vote buttons
5. Revision diff: "What changed?" shows diff between community review version and current version

**Architecture decisions needed from founder**:

- Does the decision panel replace the Vote tab entirely, or sit alongside it?
- How do tracked changes from reviewers persist to the database? (Currently only in-document marks)

### Phase 4: Author Decision Table (M effort)

Replace author kanban with intelligent portfolio table. Same pattern as Phase 2 but for author's drafts. Columns: Draft, Status, Quality Signal, Community Feedback, Constitutional, Next Action.

### Phase 5: Globe-Workspace Bridge (M effort)

Seneca-mediated navigation from globe to workspace.

**Key constraint**: Globe is NOT directly clickable. Seneca choreographs globe via intents. Cards overlay focused nodes and ARE clickable.

**Files**:

- `hooks/useSenecaGlobeBridge.ts` — Add workspace intent types
- `components/governada/panel/SenecaConversation.tsx` — Add workspace quick-action pills
- Create `components/globe/WorkspaceOverlayCards.tsx` — Contextual cards on focused nodes

### Phase 6: Design Language & Mobile (M effort)

Full Compass enforcement + mobile optimization. Bottom sheet panels, simplified mobile editor, touch targets, reduced motion.

---

## Key Type Signatures for Next Agent

### ReviewQueueItem (from lib/workspace/types.ts)

```typescript
interface ReviewQueueItem {
  txHash: string;
  proposalIndex: number;
  title: string;
  abstract: string | null;
  aiSummary: string | null;
  proposalType: string;
  withdrawalAmount: number | null;
  treasuryTier: string | null;
  epochsRemaining: number | null;
  isUrgent: boolean;
  interBodyVotes: InterBodyVotes; // { drep, spo, cc: { yes, no, abstain } }
  citizenSentiment: CitizenSentiment | null;
  existingVote: string | null;
  sealedUntil: string | null;
  motivation: string | null;
  rationale: string | null;
}
```

### ProposalDraft (from lib/workspace/types.ts)

```typescript
interface ProposalDraft {
  id: string;
  ownerStakeAddress: string;
  title: string;
  abstract: string;
  motivation: string;
  rationale: string;
  proposalType: ProposalType;
  typeSpecific: Record<string, unknown>;
  status: DraftStatus; // 'draft' | 'community_review' | 'response_revision' | 'final_comment' | 'submitted' | 'archived'
  currentVersion: number;
  supersedesId: string | null;
  lastConstitutionalCheck: ConstitutionalCheckResult | null;
  communityReviewStartedAt: string | null;
  submittedTxHash: string | null;
}
```

### AIDiffMark Extended Attributes

```typescript
// Both AIDiffAdded and AIDiffRemoved now support:
{
  editId: string | null; // 'ai-*' for AI, 'review-*' for reviewer tracked changes
  explanation: string | null; // Why this change was suggested
  authorName: string | null; // Who suggested it
}
```

### New Public APIs in AIDiffMark.tsx

```typescript
// Apply a reviewer's tracked change at the current selection
applyReviewerEdit(editor, proposedText, explanation, authorName): string | null  // returns editId

// Scan document for all tracked changes (AI + reviewer)
scanAllTrackedChanges(editor): Array<{
  editId: string;
  originalText: string;
  proposedText: string;
  explanation: string | null;
  authorName: string | null;
  isReviewer: boolean;  // true if editId starts with 'review-'
}>
```

### SectionAnalysisOutput (from lib/ai/skills/section-analysis.ts)

```typescript
interface SectionAnalysisOutput {
  constitutionalFlags: Array<{ article: string; concern: string; severity: string }>;
  completenessGaps: Array<{ label: string; suggestion: string }>;
  vaguenessIssues: Array<{ text: string; suggestion: string }>;
  overallQuality: 'strong' | 'adequate' | 'needs_work';
  summary: string;
}
```

### FeedbackTheme (from lib/workspace/feedback/types.ts)

```typescript
interface FeedbackTheme {
  id: string;
  summary: string;
  category: 'concern' | 'support' | 'question' | 'suggestion';
  endorsementCount: number;
  keyVoices: Array<{ reviewerId; text; timestamp }>;
  novelContributions: Array<{ reviewerId; text; timestamp }>;
  addressedStatus: 'open' | 'addressed' | 'deferred' | 'dismissed';
  addressedReason?: string;
  linkedAnnotationIds: string[];
}
```

---

## User Feedback Summary

1. **Workspace = authoring + review studio only** — Performance, votes, rationales, delegators belong elsewhere
2. **Globe is Seneca-driven, not directly interactive** — Users interact via Seneca widget, Seneca choreographs globe
3. **Legal-grade tracked changes required** — Reviewer suggestions as tracked changes, version diffs, revision narratives
4. **AI feedback aggregation must be prominent** — Existing consolidation system (Inngest clustering, themes, endorsements, sealed period) is a first-class surface
5. **Author is a destination, not a compose action** — Full portfolio workspace, not a simple form
6. **AI should BE the workspace** — Intelligence surfaces as annotations, columns, structured analysis — not a sidebar chatbot
