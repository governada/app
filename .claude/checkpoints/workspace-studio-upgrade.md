# Workspace Studio Upgrade — Handoff Document

> **Status**: Phase 1a COMPLETE (Quality Pulse + Ambient Constitutional Check). Phase 1b-1f + Phases 2-6 remain.
> **Branch**: `claude/epic-jang` (worktree at `.claude/worktrees/epic-jang`)
> **Plan**: `C:\Users\dalto\.claude-personal\plans\glimmering-discovering-crescent.md`
> **Date**: 2026-03-28

## CRITICAL: Handoff Instructions for Next Agent

1. **Read this entire document first** before writing any code.
2. **Read the plan** at the path above — it contains the full exploration, concepts, and implementation roadmap.
3. **Read the memory files** at `C:\Users\dalto\.claude-personal\projects\C--Users-dalto-governada-governada-app\memory\` — critical feedback from the founder:
   - `feedback_workspace_scope.md` — Workspace = authoring + review only
   - `feedback_globe_functional_nav.md` — Globe as functional navigation
   - `feedback_globe_interaction_model.md` — Globe is visual + Seneca-driven, NOT directly clickable
   - `feedback_legal_change_tracking.md` — Legal-grade tracked changes required
4. **Run `npm run preflight`** to verify the codebase compiles before starting work.
5. **Follow these same handoff practices**: If you begin to run out of context, pause to document and commit a proper handoff document before stopping. Quality over quantity.
6. **Pause for decision gating** if you discover something that needs founder discussion/alignment.

---

## What Was Completed (Phase 1a)

### 1. QualityPulse Component

**File**: `components/workspace/author/QualityPulse.tsx` (NEW)

Always-visible quality signal strip that renders ABOVE the panel tabs in the author studio. Shows:

- Per-section quality indicators (title, abstract, motivation, rationale) derived from section analysis results
- Constitutional check status badge (pass/warning/fail with flag count)
- Community feedback count (theme count + reviewer count)

**Architecture**: Stateless presentation component. Receives data via props. Renders as a compact horizontal strip with icons + labels.

### 2. Ambient Constitutional Check Hook

**File**: `hooks/useAmbientConstitutionalCheck.ts` (NEW)

Auto-runs constitutional check when draft content changes, debounced 5 seconds. Features:

- Content hash dedup (FNV-1a) — skips re-check if content unchanged
- Persists result to draft via `updateDraft` mutation (fire-and-forget)
- Exposes `result`, `isLoading`, `recheck()` for UI
- Initializes from `draft.lastConstitutionalCheck` cache

### 3. StudioPanel headerContent Support

**File**: `components/studio/StudioPanel.tsx` (MODIFIED)

Added `headerContent?: ReactNode` prop to `StudioPanelProps`. Renders above the tab bar in both desktop and mobile views. Always visible regardless of which tab is active.

### 4. Editor Page Wiring

**File**: `app/workspace/editor/[draftId]/page.tsx` (MODIFIED)

- Added imports: `QualityPulse`, `useAmbientConstitutionalCheck`, `useSectionAnalysis`
- Instantiated hooks: `useAmbientConstitutionalCheck(draft)`, `useSectionAnalysis(draft)`
- Added ambient section analysis trigger (effect that fires `analyzeSection()` on content length changes)
- Created `qualityPulseNode` that passes content + section results + constitutional result to QualityPulse
- Passed `headerContent={qualityPulseNode}` through `AuthorPanelWrapper` to `StudioPanel`

---

## What Remains

### Phase 1b: Tracked Changes for All Proposal Types (M effort)

**Goal**: Extend the amendment editor's suggest mode / tracked changes to ALL proposal types in the standard ProposalEditor.

**Key files**:

- `components/workspace/editor/ProposalEditor.tsx` — Register suggest mode extensions
- `app/workspace/amendment/[draftId]/page.tsx` — Reference implementation for suggest mode
- Amendment editor uses `SuggestModePlugin` + `proposeChange()` + `scanDiffMarks()`

**What to do**:

1. Extract the suggest mode extension from the amendment editor into a reusable Tiptap extension
2. Register it in ProposalEditor (only active in 'review' mode or when reviewer suggests changes)
3. Add UI for reviewers to propose tracked changes on community drafts (select text -> suggest edit)
4. Add UI for proposers to accept/reject tracked changes from reviewers
5. Wire Seneca to suggest tracked changes via `proposeChange()` (agent already has `injectProposedEdit()`)

**Architecture note**: The current ProposalEditor has `AIDiff` marks for inline diffs from the AI agent. Tracked changes from reviewers are different — they're persistent, attributed, and stored in the database (not ephemeral like AI suggestions). May need a new annotation type or separate mark.

### Phase 1c: Proactive Seneca Insights (M effort)

**Goal**: Seneca proactively surfaces insights in the sidebar without the user asking.

**Key files**:

- `components/workspace/author/QualityPulse.tsx` — Could show Seneca insight cards below quality indicators
- `hooks/useSectionAnalysis.ts` — Already runs section analysis; results include `vaguenessIssues`, `completenessGaps`
- `lib/ai/skills/readiness-narrative.ts` — Already generates narrative insight

**What to do**:

1. When section analysis returns `needs_work` quality, surface the top vagueness issue or completeness gap as a proactive insight in the sidebar
2. Show as a small card below the QualityPulse: "Seneca: Your motivation doesn't address budget precedent. [Apply suggestion]"
3. The "Apply suggestion" button uses the existing `onApplyFix` pattern from `AuthorIntelligencePanel`
4. Don't show if user is actively typing (debounce)

### Phase 1d: Design Language Enforcement (S effort)

**What to do**:

- Replace Tailwind hardcoded vote colors with Compass tokens (`--cerulean`, `--copper`, `--slate-vote`)
- Use `--compass-teal` for primary actions consistently
- Ensure Fraunces for scores/heroes, Space Grotesk for body
- Check spacing against Compass density mode tokens

### Phase 1e: Version Diff View in Editor (S effort)

**Goal**: Make version comparison accessible from the editor (not just from the portfolio).

**Key files**:

- `components/workspace/editor/VersionDiffView.tsx` — Already exists
- `app/workspace/editor/[draftId]/page.tsx` — Needs a way to trigger diff view (button in toolbar or slash command)

---

### Phase 2: Review Decision Table (L effort)

Replace the review queue kanban with an AI-enriched analytical decision table. See plan for full spec.

**Key files to modify**:

- `components/workspace/review/ReviewWorkspace.tsx` — Main review page
- `components/workspace/review/ReviewQueue.tsx` — Current kanban queue
- `components/workspace/review/ReviewQueueList.tsx` — Current list items

**Key files to reference**:

- `hooks/useReviewQueue.ts` — Data source for review items
- `lib/workspace/types.ts` — `ReviewQueueItem` type
- `app/api/workspace/review-queue/route.ts` — API that returns proposals + intelligence

**New infrastructure needed**:

- Background pre-computation pipeline (Inngest function triggered on new proposals)
- API endpoint changes to include pre-computed analysis in review queue response
- Decision table component with sortable/filterable AI-computed columns

### Phase 3: Review Studio Intelligence (L effort)

Reimagine the review studio with Seneca summary as default view, persistent decision panel, structured analysis.

**Key files**:

- `app/workspace/review/page.tsx` — Review page (routes to ReviewPageRouter)
- `components/workspace/review/ProposalContent.tsx` — Raw proposal display
- `components/workspace/review/ReviewWorkspace.tsx` — Studio layout
- `components/studio/StudioPanel.tsx` — Panel system (already has headerContent support)

**Architecture decisions needed**:

- Where does the Seneca summary render? (Above raw text, as a new section?)
- Does the decision panel replace the Vote tab or sit alongside it?
- How do tracked changes flow from reviewer to proposer database?

### Phase 4: Author Decision Table (M effort)

Replace author kanban with intelligent portfolio table. See Phase 2 for pattern — similar approach but for author's drafts.

### Phase 5: Globe-Workspace Bridge (M effort)

Seneca-mediated globe navigation to workspace. Requires:

- New Seneca intent types for workspace navigation
- Contextual card components for overlaying on globe nodes
- Seneca widget quick-action pills for workspace entry

**Key constraint**: Globe is NOT directly clickable. Seneca choreographs globe via intents. Cards overlay focused nodes and ARE clickable.

### Phase 6: Design Language & Mobile (M effort)

Full Compass enforcement across all workspace surfaces + mobile optimization.

---

## Key Type Signatures for Next Agent

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

### ConstitutionalCheckResult (from lib/workspace/types.ts)

```typescript
interface ConstitutionalCheckResult {
  flags: Array<{ article: string; section?: string; concern: string; severity: string }>;
  score: 'pass' | 'warning' | 'fail';
  summary: string;
}
```

### StudioPanel headerContent

The `StudioPanel` component now accepts `headerContent?: ReactNode` which renders above the tab bar in both desktop and mobile views. Use this for any always-visible content.

---

## User Feedback Summary

The founder provided these key constraints during the exploration:

1. **Workspace = authoring + review studio only** — Performance, votes, rationales, delegators belong elsewhere
2. **Globe is Seneca-driven, not directly interactive** — Users interact via Seneca widget, Seneca choreographs globe
3. **Legal-grade tracked changes required** — Reviewer suggestions as tracked changes, version diffs, revision narratives
4. **AI feedback aggregation must be prominent** — Existing consolidation system (Inngest clustering, themes, endorsements, sealed period) is a first-class surface
5. **Author is a destination, not a compose action** — Full portfolio workspace, not a simple form
6. **AI should BE the workspace** — Intelligence surfaces as annotations, columns, structured analysis — not a sidebar chatbot
