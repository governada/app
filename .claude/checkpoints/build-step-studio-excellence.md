# Build Step: Studio Excellence — World-Class Author & Review (Layer 2)

**Status:** PHASE_2_COMPLETE
**Started:** 2026-03-29
**Current Phase:** 2 of 6 (Intelligence Architecture)
**PR chain:** #700 (Phase 1 — Editor Foundation)
**Predecessor:** `.claude/checkpoints/workspace-studio-upgrade.md` (Phases 1-5 DEPLOYED)

---

## Context: What Already Shipped (Don't Rebuild)

The `workspace-studio-upgrade.md` build shipped Phases 1-5 of the original plan. Before starting, you MUST read that checkpoint to understand what's already built. Here's the summary:

### Already deployed to production:

- **QualityPulse + ambient constitutional check** (PR #685) — `useAmbientConstitutionalCheck` hook, margin indicators
- **Review DecisionTable** replacing kanban (PR #688) — 8 cell components, sort/filter/search, keyboard nav
- **DecisionPanel** replacing Vote tab (PR #690) — always-visible right column, IntelligenceStrip, SenecaSummary
- **Reviewer suggestion annotations** (PR #690) — Supabase migration `069_annotation_suggestions.sql`, `suggested_text` JSONB + `status` column, `useSuggestionAnnotations` hook, `SelectionToolbar` "Suggest Change" button
- **Author DecisionTable** (PR #690) — `AuthorDecisionTable`, `useAuthorTableItems`, phase/quality/feedback cells
- **ProposalEditor extensions** (PR #685) — `AIDiffMark` extended for reviewer-sourced diffs, `SelectionToolbar` extended with suggest-change flow
- **Globe → Workspace bridge** (PR #695) — workspace pills on Seneca, WorkspaceCards overlay
- **Phase 6 (Design Language & Mobile) NOT YET DONE** — see workspace-studio-upgrade.md for scope

### What this means for our plan:

Several items from our 6-phase plan are **already partially or fully built**. The agent must read the current code before implementing to avoid duplication. Specifically:

| Our Plan Item                                   | Status                                                                      | What Remains                                                                                                         |
| ----------------------------------------------- | --------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| Phase 1: Wire Tiptap to all proposals           | **DONE** — PR #700 merged 2026-03-29                                        | None                                                                                                                 |
| Phase 2: Persistent Intelligence Brief          | **DONE** — PR #704 merged 2026-03-29                                        | None — scrollable brief, stage transformations, role adaptation all shipped                                          |
| Phase 3: Tracked changes + reviewer suggestions | **PARTIALLY DONE** — suggestion annotations, AIDiffMark extensions deployed | Need: author suggestion resolution UI, version diff on return, lifecycle editor mode integration, margin refinements |
| Phase 4: Agent evolution                        | **NOT DONE**                                                                | Full implementation needed                                                                                           |
| Phase 5: Pre-computation pipeline               | **NOT DONE**                                                                | Full implementation needed                                                                                           |
| Phase 6: Mobile + polish                        | **NOT DONE** (also not done in predecessor build)                           | Full implementation needed                                                                                           |

---

## Plan Location

Full plan with all 6 phases, design philosophy, end-to-end lifecycle, and three-layer architecture:
`C:\Users\dalto\.claude-personal\plans\imperative-pondering-glade.md`

---

## Phase 1: Editor Foundation — Wire Tiptap to All Proposals

**This remains the single highest-ROI change and the foundation for everything else.**

### Goal

Replace `DraftForm.tsx` textareas with `ProposalEditor.tsx` (Tiptap) for all standard proposal types (InfoAction, TreasuryWithdrawals, ParameterChange, HardForkInitiation, NoConfidence, NewCommittee). NewConstitution already uses the amendment editor — no change needed there.

### Why First

The Tiptap editor infrastructure is fully built (ProposalEditor.tsx, all extensions). But standard proposals bypass all of it, using plain `<Textarea>` elements. Every Phase 2-6 feature (tracked changes between author/reviewer, agent edits as inline diffs, ghost text completions, margin decorations, slash commands, Cmd+K) depends on Tiptap being the editing substrate.

### Architecture Decision

`DraftEditor.tsx` currently:

1. Loads draft via `useDraft(draftId)` hook
2. For empty drafts with AI: shows `ScaffoldForm`
3. For NewConstitution + flag: redirects to amendment editor
4. **For everything else: renders `DraftForm` (textareas)** ← REPLACE THIS

Replace step 4 with rendering `ProposalEditor` wrapped in the `StudioProvider` shell:

- `content` prop from draft data `{ title, abstract, motivation, rationale }`
- `onContentChange` → `useUpdateDraft` mutation (debounced auto-save, same pattern as DraftForm)
- `mode` driven by `draft.status`: 'edit' for draft/response_revision, 'review' for community_review/final_comment
- Type-specific fields (TreasuryFields, ParameterChangeFields) render as form section beside/below editor
- Slash commands → existing AI skills
- Cmd+K → agent via `useAgent` hook
- Agent edits → `injectProposedEdit(editor, edit)` (same pattern as ReviewWorkspace)

### Key Files To Read FIRST

1. `.claude/checkpoints/workspace-studio-upgrade.md` — what's already been built (CRITICAL)
2. `components/workspace/author/DraftEditor.tsx` — THE file you're modifying
3. `components/workspace/editor/ProposalEditor.tsx` — the Tiptap editor you're wiring in
4. `components/workspace/author/DraftForm.tsx` — reference for auto-save, type-specific fields, provenance
5. `components/workspace/review/ReviewWorkspace.tsx` — BLUEPRINT for how ProposalEditor + useAgent are already wired together
6. `hooks/useDrafts.ts` — useUpdateDraft mutation
7. `hooks/useAgent.ts` — agent SSE hook
8. `hooks/useAmbientConstitutionalCheck.ts` — already built, wire to margin indicators
9. `components/workspace/author/QualityPulse.tsx` — already built, keep working

### Key Type Signatures

```typescript
// ProposalEditor props (components/workspace/editor/ProposalEditor.tsx)
interface ProposalEditorProps {
  content: { title?: string; abstract?: string; motivation?: string; rationale?: string };
  mode: EditorMode; // 'edit' | 'review' | 'diff'
  readOnly?: boolean;
  onContentChange?: (content: {
    title: string;
    abstract: string;
    motivation: string;
    rationale: string;
  }) => void;
  onSlashCommand?: (command: SlashCommandType, section: ProposalField) => void;
  onCommand?: (instruction: string, selectedText: string, section: ProposalField) => void;
  onCommentCreate?: (comment: InlineCommentData, from: number, to: number) => void;
  onCommentDelete?: (commentId: string) => void;
  onDiffAccept?: (editId: string) => void;
  onDiffReject?: (editId: string) => void;
  onCompletionAccept?: (text: string) => void;
  onEditorReady?: (editor: Editor) => void;
  currentUserId?: string;
  marginIndicators?: MarginIndicator[];
  excludeFields?: ProposalField[];
}

// ProposedEdit (lib/workspace/editor/types.ts)
interface ProposedEdit {
  field: ProposalField;
  anchorStart: number;
  anchorEnd: number;
  originalText: string;
  proposedText: string;
  explanation: string;
}
```

### Patterns To Follow

**ReviewWorkspace.tsx is the blueprint.** It already wires ProposalEditor + useAgent:

- Captures editor instance via `onEditorReady`
- Watches `useAgent.lastEdit` → `injectProposedEdit(editor, edit)`
- Watches `useAgent.lastComment` → `injectInlineComment`
- Passes `onSlashCommand`, `onCommand` callbacks

### What NOT To Change

- ScaffoldForm flow — keep as-is, it feeds into the editor
- Amendment editor routing — keep as-is
- Submission ceremony, Monitor, Debrief pages — untouched in Phase 1
- Review side — untouched in Phase 1
- QualityPulse, ProactiveInsight — already built, keep working
- AuthorDecisionTable — already built, keep working

### Phase 1 Verification (COMPLETE — PR #700)

- [x] InfoAction draft → Tiptap editor loads with 4 section blocks
- [x] Auto-save works (500ms debounce)
- [x] Slash commands + Cmd+K → agent integration
- [x] Treasury draft → type-specific fields render below editor
- [x] ParameterChange draft → parameter select + value fields render
- [x] community_review/final_comment/submitted → read-only for all
- [x] response_revision → editable for owner/lead/editor
- [x] Team editor/lead roles can edit (via useTeam integration)
- [x] ScaffoldForm shows for empty drafts with author_ai_draft flag
- [x] Amendment draft → still routes to ConstitutionEditor (no regression)
- [x] Constitutional check → colored margin indicators
- [x] `npm run preflight` passes (842/842 tests)

### Phase 1 Key Decisions

- **ProposalEditor was already wired** via `app/workspace/editor/[draftId]/page.tsx`. The old `DraftEditor.tsx` + `DraftForm.tsx` were dead code — the author route already routed to the Tiptap workspace page.
- **Phase 1 scope was closing 5 gaps** vs building from scratch: type-specific fields, scaffold, lifecycle mode, team roles, margin indicators.
- **TypeSpecificFields extracted** to `components/workspace/editor/TypeSpecificFields.tsx` as a standalone component (not inline in the page).
- **Margin indicators map constitutional flags to sections** by keyword matching in flag concern text (abstract→1, motivation→2, rationale→3, default→2).

### Phase 1 Files Modified

- `components/workspace/editor/TypeSpecificFields.tsx` (NEW — 156 lines)
- `app/workspace/editor/[draftId]/page.tsx` (modified — added ~100 lines)

---

## Phase 2: Intelligence Architecture — COMPLETE (PR #704)

### What Was Built

Replaced the empty Intel tab (author) and DecisionPanel accordion (review) with scrollable, stage-driven Intelligence Briefs.

### Architecture: Section Registry Pattern

A `lib/workspace/intelligence/registry.ts` maps each `DraftStatus` to an ordered array of `SectionConfig` objects. Two orchestrators (`AuthorBrief`, `ReviewIntelBrief`) read the registry and compose from shared section primitives in `components/intelligence/sections/`.

### New Files (18)

**Infrastructure:**

- `lib/workspace/intelligence/types.ts` — `SectionConfig`, `SectionId`, `BriefStage`, `AuthorBriefContext`, `ReviewBriefContext`
- `lib/workspace/intelligence/registry.ts` — `getAuthorSections(stage)`, `getReviewSections(voterRole)`, stage→section mappings

**Shared components:**

- `components/intelligence/BriefShell.tsx` — scrollable container, iterates section configs, collapsible cards with PostHog analytics
- `components/intelligence/AuthorBrief.tsx` — orchestrator (takes `ProposalDraft`, reads `draft.status`, renders via BriefShell)
- `components/intelligence/ReviewIntelBrief.tsx` — orchestrator (takes `ReviewQueueItem` fields + `voterRole`)

**Author sections:**

- `ConstitutionalSection.tsx` — wraps `useAISkill('constitutional-check')`, accepts cached `ConstitutionalCheckResult`
- `ReadinessSection.tsx` — radial gauge using `computeConfidence()` from `lib/workspace/confidence.ts`
- `SimilarProposalsSection.tsx` — wraps `useAISkill('research-precedent')`
- `RiskRegisterSection.tsx` — aggregates constitutional flags + treasury + community concerns
- `ReviewSummarySection.tsx` — review count, dimensional scores, top concerns (uses `useDraftReviews`)
- `FeedbackTriageBoard.tsx` — card-based theme triage with status grouping + action buttons (uses `useFeedbackThemes` + `useAddressTheme`)
- `SubmissionChecklist.tsx` — 4 explicit gates with pass/fail status
- `MonitorEmbed.tsx` — embeds `VotingProgress` + `VoteActivity` + `DepositStatus`

**Review sections:**

- `ExecutiveSummary.tsx` — shows `aiSummary` from ReviewQueueItem
- `QuickAssessment.tsx` — key signals (treasury, urgency, consensus direction)
- `StakeholderLandscape.tsx` — VoteBar per body + citizen sentiment
- `ProposerProfileSection.tsx` — wraps `useProposerTrackRecord`
- `KeyQuestionsSection.tsx` — wraps `research-precedent` skill output

### Modified Files (3)

- `app/workspace/editor/[draftId]/page.tsx` — added `intelContent` prop to `AuthorPanelWrapper`, passes `<AuthorBrief>` with draft data + constitutional result + canEdit
- `components/workspace/review/ReviewWorkspace.tsx` — replaced both `<IntelPanel>` usages with `<ReviewIntelBrief>` (StudioPanel Intel tab + DecisionPanel intelContent)
- `components/workspace/review/DecisionPanel.tsx` — removed `IntelSection` accordion wrapper, renders `intelContent` in `overflow-y-auto` scroll container

### Key Type Signatures (for Phase 3 agent)

```typescript
// SectionConfig (lib/workspace/intelligence/types.ts)
interface SectionConfig {
  id: SectionId;
  title: string;
  priority: number;
  defaultExpanded: boolean;
  lazyAI?: boolean;
  icon: string;
}

// AuthorBrief props (components/intelligence/AuthorBrief.tsx)
interface AuthorBriefProps {
  draft: ProposalDraft;
  draftId: string;
  constitutionalResult?: ConstitutionalCheckResult | null;
  canEdit?: boolean;
}

// ReviewIntelBrief props (components/intelligence/ReviewIntelBrief.tsx)
interface ReviewIntelBriefProps {
  proposalId: string;
  proposalIndex: number;
  proposalType: string;
  proposalContent: { title; abstract; motivation; rationale };
  interBodyVotes?: { drep; spo; cc };
  citizenSentiment?: CitizenSentiment | null;
  aiSummary?: string | null;
  withdrawalAmount?: number | null;
  treasuryTier?: string | null;
  epochsRemaining?: number | null;
  isUrgent?: boolean;
  voterRole: string;
}
```

### Phase 2 Stage Behaviors (Author Brief)

| Stage               | Sections Shown                                                      |
| ------------------- | ------------------------------------------------------------------- |
| `draft`             | Constitutional + Readiness + Similar Proposals + Risk Register      |
| `community_review`  | ReviewSummary + Constitutional + Readiness + Similar + Risk         |
| `response_revision` | FeedbackTriage + Constitutional + Readiness                         |
| `final_comment`     | SubmissionChecklist + Constitutional + Readiness                    |
| `submitted`         | MonitorEmbed (VotingProgress + VoteActivity + DepositStatus inline) |

### Phase 2 Decisions

- **No feature flag gate** — the author Intel tab was empty ("coming soon"), so this is pure additive with zero regression risk. The review side replaces `IntelPanel` with the same data in a better container.
- **Section registry pattern** chosen over a single conditional component — makes adding/reordering sections a one-line change.
- **Separate orchestrators** (AuthorBrief vs ReviewIntelBrief) — the data models are fundamentally different (ProposalDraft vs ReviewQueueItem).
- **AI sections use `useEffect` for fetch** — not inline render calls, to satisfy React hooks lint (`react-hooks/refs` rule).
- **ConstitutionalSection accepts cached `ConstitutionalCheckResult`** — avoids re-running AI when the ambient check already ran. Maps the stored type (no `summary` field) to the skill output type.

---

## What Already Exists for Phase 3 (from workspace-studio-upgrade build)

Before building Phase 3, the next agent MUST understand these already-deployed components:

1. **Suggestion annotations** — Supabase migration `069_annotation_suggestions.sql` added `suggested_text` JSONB + `status` column to `proposal_annotations`. `AnnotationType` includes `'suggestion'`. `AnnotationStatus` is `'active' | 'accepted' | 'rejected'`.

2. **`useSuggestionAnnotations` hook** (`hooks/useSuggestionAnnotations.ts`) — filters/creates/accepts/rejects suggestion annotations.

3. **`SelectionToolbar` "Suggest Change" button** (`components/workspace/editor/SelectionToolbar.tsx`) — already shows in review mode. `showSuggestEdit` prop on `ProposalEditor` controls visibility.

4. **`AIDiffMark` extended for reviewer-sourced diffs** (`components/workspace/editor/extensions/AIDiffMark.tsx`) — supports diffs from agent, reviewer, or author sources.

5. **`showSuggestEdit` prop wired in editor page** — line ~699 of `app/workspace/editor/[draftId]/page.tsx`: `showSuggestEdit={!isOwner && mode === 'review'}`.

6. **Lifecycle-driven mode** — already implemented in editor page (lines 267-277): draft→edit, response_revision→edit, community_review/final_comment/submitted→review.

### What Phase 3 Still Needs

- **Author suggestion resolution UI**: During `response_revision`, author sees reviewer suggestions as inline tracked changes. Accept (apply text), Reject (mark considered), Modify. This UI does NOT exist yet — the existing `useSuggestionAnnotations.acceptSuggestion()` mutation exists but no component renders these for the author to act on.
- **Version diff on return**: When reviewer returns after revision, show "Changes Since Your Review". `reviewedAtVersion` is on `DraftReview` type. Need visual diff or highlight for changed sections.
- **Ambient margin refinements**: Constitutional check runs on debounced content change (~2s), not just on save. Current implementation triggers on save via `useAmbientConstitutionalCheck`. Could be tightened.

---

## Context Window Protocol

If your context window is filling up:

1. Commit all work to feature branch, push
2. Create PR if ready, or note branch name
3. Update THIS checkpoint: what you completed, what's in progress, new type signatures, gotchas
4. Commit checkpoint to main:
   ```bash
   cd C:\Users\dalto\governada\governada-app
   git pull origin main
   git add .claude/checkpoints/build-step-studio-excellence.md
   git commit -m "checkpoint: studio excellence phase N progress"
   git push origin main
   ```
5. Include "Next Agent Prompt" section below with full context

If your context window is filling up:

1. Commit all work to feature branch, push
2. Create PR if ready, or note branch name
3. Update THIS checkpoint: what you completed, what's in progress, new type signatures, gotchas
4. Commit checkpoint to main:
   ```bash
   cd C:\Users\dalto\governada\governada-app
   git pull origin main
   git add .claude/checkpoints/build-step-studio-excellence.md
   git commit -m "checkpoint: studio excellence phase N progress"
   git push origin main
   ```
5. Include "Next Agent Prompt" section below with full context

---

## Next Agent Prompt

```
You are building Phase 3 of the Studio Excellence build for Governada — Living Document Substrate (tracked changes + reviewer suggestions flywheel).

## FIRST: Read the checkpoint (CRITICAL — it's on main, not in your worktree)

Your worktree was created from a branch. The checkpoint is on main. To access it:

  git fetch origin main
  git show origin/main:.claude/checkpoints/build-step-studio-excellence.md > /tmp/checkpoint.md
  cat /tmp/checkpoint.md

This checkpoint contains:
- Full inventory of what's already built (Phases 1-2 + predecessor build)
- Key type signatures you'll need (ProposalEditor props, SectionConfig, annotation types)
- What's already deployed for Phase 3 (suggestion annotations, useSuggestionAnnotations hook, SelectionToolbar "Suggest Change", AIDiffMark extensions, lifecycle-driven editor modes)
- What Phase 3 still needs to build (the gaps listed below)

## THEN: Read the full 6-phase plan

  cat "C:\Users\dalto\.claude-personal\plans\imperative-pondering-glade.md"

Phase 3 starts at line ~201 in the plan ("Phase 3: Living Document Substrate").

## What's Already Deployed (DON'T REBUILD)

Phase 1 (PR #700): Tiptap wired to all proposal types
Phase 2 (PR #704): Stage-driven Intelligence Brief in both author + review studios

For Phase 3 specifically, these are ALREADY BUILT from the predecessor workspace-studio-upgrade:
- Supabase migration 069: `suggested_text` JSONB + `status` on proposal_annotations
- `useSuggestionAnnotations` hook (hooks/useSuggestionAnnotations.ts)
- SelectionToolbar "Suggest Change" button (already visible in review mode)
- AIDiffMark extended for reviewer-sourced diffs
- Lifecycle-driven editor modes (draft→edit, community_review→review, etc.)

## What Phase 3 NEEDS TO BUILD

1. **Author suggestion resolution UI** — During `response_revision`, the author needs to see reviewer suggestions as inline tracked changes and act on them (Accept/Reject/Modify). The mutation (`acceptSuggestion`, `rejectSuggestion`) exists in `useSuggestionAnnotations` but no component renders these for the author to interact with.

2. **Version diff on return** — When a reviewer returns after the proposer revised, show "Changes Since Your Review" indicator. `DraftReview.reviewedAtVersion` field exists. Need visual diff highlighting for changed sections.

3. **Ambient margin refinement** — Currently constitutional check runs on save. Tighten to run on debounced content change (~2s) for real-time margin traffic lights.

## Key Files to Read

- `hooks/useSuggestionAnnotations.ts` — the mutation API for accepting/rejecting suggestions
- `components/workspace/editor/extensions/AIDiffMark.tsx` — how diffs render inline
- `components/workspace/editor/SelectionToolbar.tsx` — the "Suggest Change" flow
- `components/workspace/editor/ProposalEditor.tsx` — where modes, diffs, and margins all wire together
- `app/workspace/editor/[draftId]/page.tsx` — the author workspace (integration point)
- `components/workspace/review/ReviewWorkspace.tsx` — the review workspace
- `lib/workspace/types.ts` — DraftReview (has reviewedAtVersion), AnnotationType, SuggestedText, AnnotationStatus
- `hooks/useAmbientConstitutionalCheck.ts` — current trigger pattern

## CRITICAL: Plan before building

Phase 3 has deep overlap with already-shipped components. You MUST read the current code to understand what exists before proposing changes. Use EnterPlanMode to design the approach, get user approval, then build.

The biggest risk is duplicating or conflicting with the existing suggestion infrastructure. The mutations and storage are DONE — the gap is purely the author-facing resolution UI and the reviewer return-visit diff experience.

If you run low on context, follow the checkpoint protocol documented in the checkpoint file (commit checkpoint to main before stopping).
```
