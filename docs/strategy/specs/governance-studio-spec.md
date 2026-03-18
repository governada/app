# Governance Studio — Work Plan & Spec

> **Status**: Active build
> **Branch**: `fix/workspace-layout-ux`
> **Goal**: Replace the current workspace shell (sidebar + fullscreen overlay) with a purpose-built Studio mode — minimal chrome, content-first, keyboard-driven, world-class UX.

---

## Architecture Overview

### Two Shells, One Design Language

```
Browse Mode (citizens, exploration)     Studio Mode (DReps, proposers, reviewers)
┌─────────────────────────────┐         ┌──────────────────────────────────────┐
│ Header                      │         │ StudioHeader (minimal)               │
├──────┬──────────────────────┤         ├──────────────────────────────────────┤
│Side  │                      │         │                                      │
│bar   │  Page Content        │         │    Full-width centered content        │
│      │                      │         │    (max-w-3xl, proposal editor)       │
│      │                      │         │                    ┌────────────────┐ │
│      │                      │         │                    │ Panel (on      │ │
│      │                      │         │                    │ demand, slides │ │
│      │                      │         │                    │ from right)    │ │
├──────┴──────────────────────┤         ├────────────────────┴────────────────┤ │
│ BottomNav (mobile)          │         │ StudioActionBar (sticky bottom)      │
└─────────────────────────────┘         └──────────────────────────────────────┘
```

### Studio Mode Detection

`GovernadaShell` detects studio routes via pathname:

- `/workspace/review` → Studio mode (review)
- `/workspace/author/<id>` → Studio mode (author)
- `/workspace/editor/<id>` → Studio mode (author)
- Everything else → Browse mode

When studio mode is active:

- `GovernadaSidebar` is NOT rendered
- `GovernadaHeader` is NOT rendered (replaced by `StudioHeader`)
- `GovernadaBottomNav` is NOT rendered (replaced by `StudioActionBar`)
- `EpochContextBar` is NOT rendered
- Background constellation globe is NOT rendered
- Main content has NO left padding (full-width)
- Footer is NOT rendered

### Component Inventory

**New components** (`components/studio/`):

| Component                 | Purpose                                                                                          |
| ------------------------- | ------------------------------------------------------------------------------------------------ |
| `StudioHeader.tsx`        | Minimal top bar: ← back, title, queue progress dots, Cmd+K, notifications, user badge            |
| `StudioActionBar.tsx`     | Sticky bottom bar: panel launchers (Agent, Intel, Notes) + context actions (Vote or Save/Submit) |
| `StudioPanel.tsx`         | On-demand right panel with tabs. Slides in from right. Resizable.                                |
| `StudioQueueProgress.tsx` | Dot-based progress indicator (●●●○○○) for the header                                             |
| `StudioProvider.tsx`      | React context providing studio state (panel open/closed, active tab, focus level)                |

**Modified components**:

| Component                       | Change                                                                                   |
| ------------------------------- | ---------------------------------------------------------------------------------------- |
| `GovernadaShell.tsx`            | Detect studio routes, conditionally hide sidebar/header/footer/bottom-nav                |
| `ReviewWorkspace.tsx`           | Complete rewrite — content-first layout, no queue list first, auto-select first proposal |
| `WorkspaceEmbed.tsx`            | Remove `WorkspaceLayout` wrapper, render editor directly, accept new layout props        |
| `app/workspace/layout.tsx`      | Suppress `SectionPillBar` in studio mode                                                 |
| `app/workspace/review/page.tsx` | Pass studio mode context                                                                 |

**Preserved (no changes)**:

- `ProposalEditor.tsx` (Tiptap) — unchanged
- `AgentChatPanel.tsx` — unchanged, wrapped inside `StudioPanel`
- `ReviewActionZone.tsx` — reused inside `StudioActionBar`
- `StatusBar.tsx` — reused inside `StudioHeader` or `StudioActionBar`
- All hooks (`useReviewQueue`, `useAgent`, `useDraft`, etc.) — unchanged
- All API routes — unchanged

---

## Component Specifications

### StudioHeader

```
┌────────────────────────────────────────────────────────────┐
│ ← governada    [Title · Type]    ●●●○○○    ⌘K   🔔  [DRep]│
└────────────────────────────────────────────────────────────┘
```

**Props:**

```ts
interface StudioHeaderProps {
  backHref?: string; // Default: "/workspace/review" or "/workspace/author"
  onBack?: () => void; // Override back behavior
  backLabel?: string; // e.g. "governada" or "Back to drafts"
  title?: string; // Proposal title (truncated)
  proposalType?: string; // Badge: "Treasury Withdrawal"
  queueProgress?: { current: number; total: number };
  showModeSwitch?: boolean; // Edit/Review/Diff tabs
  mode?: EditorMode;
  onModeChange?: (mode: EditorMode) => void;
}
```

**Behavior:**

- Height: 48px (py-2 px-4)
- Left: Back button (← + label). Clicking navigates to browse mode.
- Center: Proposal title (truncated, text-sm font-semibold) + type badge (text-[10px])
- Center-right: Queue progress dots (`StudioQueueProgress`)
- Right: ⌘K button, notification bell (from GovernadaHeader), user segment badge
- Border-bottom: `border-border` (standard)
- Visual signal: thin 2px top border in `var(--color-teal-500)` to indicate studio mode
- Mobile: Title hidden below sm, queue dots compact

### StudioActionBar

```
┌────────────────────────────────────────────────────────────┐
│  [💬 Agent]  [📊 Intel]  [📋 Notes]    [Yes] [No] [Abstain]│
└────────────────────────────────────────────────────────────┘
```

**Props:**

```ts
interface StudioActionBarProps {
  // Panel controls
  activePanel: 'agent' | 'intel' | 'notes' | null;
  onPanelToggle: (panel: 'agent' | 'intel' | 'notes') => void;
  // Context actions (review mode)
  reviewActions?: ReactNode; // ReviewActionZone buttons
  // Context actions (author mode)
  authorActions?: ReactNode; // Save/Submit buttons
  // Status info
  statusInfo?: ReactNode; // StatusBar content (completeness, etc.)
}
```

**Behavior:**

- Position: `sticky bottom-0` with `bg-background/95 backdrop-blur-sm border-t`
- Height: 48px (py-2 px-4)
- Left: Panel toggle buttons (icon + label). Active panel button is highlighted.
- Right: Context-specific action buttons
- Keyboard: Panel toggles respond to Cmd+Shift+C (agent), Cmd+Shift+I (intel), Cmd+Shift+N (notes)
- Mobile: Icon-only panel buttons, full-width action buttons below

### StudioPanel

**Props:**

```ts
interface StudioPanelProps {
  isOpen: boolean;
  onClose: () => void;
  activeTab: 'agent' | 'intel' | 'notes';
  onTabChange: (tab: 'agent' | 'intel' | 'notes') => void;
  width: number;
  onWidthChange: (width: number) => void;
  // Content
  agentContent: ReactNode; // AgentChatPanel
  intelContent?: ReactNode; // Intelligence cards
  notesContent?: ReactNode; // Decision journal
}
```

**Behavior:**

- Slides in from right edge with transition (transform + opacity, 200ms ease)
- Resizable left edge (drag handle, min 280px, max 50% viewport)
- Tab bar at top: Agent | Intel | Notes
- Close button (X) in top-right
- Escape key closes the panel
- Content area scrolls independently
- When open, main content area is pushed left (not overlaid)
- Mobile: renders as a bottom sheet (slides up from bottom, 80% height)

### StudioQueueProgress

```
●●●○○○  3/6
```

**Props:**

```ts
interface StudioQueueProgressProps {
  current: number;
  total: number;
  onClick?: () => void; // Opens queue picker
}
```

**Behavior:**

- Filled dots for completed + current, hollow for remaining
- Current dot is slightly larger or pulsing
- Clicking opens a dropdown/popover showing the full queue for quick-jump
- Compact text (3/6) shown next to dots
- Max 10 dots visible; beyond that, show `●●● 3/15`

### StudioProvider

```ts
interface StudioState {
  // Panel
  panelOpen: boolean;
  activePanel: 'agent' | 'intel' | 'notes';
  panelWidth: number;
  // Focus
  focusLevel: 0 | 1 | 2; // 0=normal, 1=panel hidden, 2=zen (header hidden too)
  // Queue
  queuePosition: number;
  queueTotal: number;
}
```

---

## Execution Chunks

### Chunk 1: Studio Shell + GovernadaShell Integration

**Files to create:**

- `components/studio/StudioProvider.tsx`
- `components/studio/StudioHeader.tsx`
- `components/studio/StudioActionBar.tsx`
- `components/studio/StudioPanel.tsx`
- `components/studio/StudioQueueProgress.tsx`

**Files to modify:**

- `components/governada/GovernadaShell.tsx` — add studio route detection + conditional rendering
- `app/workspace/layout.tsx` — suppress SectionPillBar in studio mode

**Acceptance criteria:**

- Studio routes show minimal header, no sidebar, no bottom nav
- Non-studio routes are completely unaffected
- Panel slides in/out smoothly
- Action bar is sticky at bottom
- All components follow Compass design language (dark theme, Space Grotesk, proper spacing)

### Chunk 2: Review Flow Rewrite

**Files to modify:**

- `components/workspace/review/ReviewWorkspace.tsx` — complete rewrite for studio layout
- `components/workspace/editor/WorkspaceEmbed.tsx` — remove WorkspaceLayout wrapper, render editor directly

**Key changes:**

1. Remove the "queue list first, then open editor" pattern
2. Auto-select first unreviewed proposal on mount
3. Render proposal content full-width centered (max-w-3xl mx-auto)
4. Move `ReviewActionZone` buttons into `StudioActionBar`
5. Wrap `AgentChatPanel` inside `StudioPanel` as the "Agent" tab
6. Remove `WorkspaceLayout` usage — editor renders directly in the page content area
7. Remove the separate `queueRailContent` — queue is navigated via J/K and progress dots

**Layout in review mode:**

```
StudioHeader (← governada | "Amaru TWO 2026" · Treasury | ●●●○○○ | ⌘K 🔔 DRep)
─────────────────────────────────────────────────────────────────────────────────
                                                              ┌─ StudioPanel ─┐
   [Proposal content, full-width centered max-w-3xl]          │ Agent | Intel  │
   [ProposalEditor in read-only mode]                         │                │
   [Below editor: optional inline intelligence cards]         │ (content)      │
                                                              │                │
                                                              └────────────────┘
─────────────────────────────────────────────────────────────────────────────────
StudioActionBar ([Agent] [Intel] [Notes]  ···  [Yes] [No] [Abstain])
```

### Chunk 3: Author Flow Adaptation

**Files to modify:**

- `app/workspace/editor/[draftId]/page.tsx` — adapt for studio layout
- `app/workspace/author/[draftId]/page.tsx` — same (delegates to editor route)

**Key changes:**

1. Remove `WorkspaceLayout` wrapper (same as review)
2. Editor renders full-width centered
3. Action bar shows: [Agent] [Feedback] [Preview] ··· [Save Draft] [Submit]
4. Panel tabs: Agent (chat) | Feedback (themes) | Preview (rendered view)
5. Back button: "← Back to drafts" → navigates to `/workspace/author`

### Chunk 4: Queue Processing UX

**Files to modify:**

- `components/workspace/review/ReviewWorkspace.tsx` — add queue processing logic
- `components/studio/StudioQueueProgress.tsx` — add queue picker popover

**Key features:**

1. **J/K navigation**: Press J to go to next proposal, K for previous. Content swaps in-place.
2. **Y/N/A voting**: Press Y/N/A to start the vote flow (same as clicking the button)
3. **S to snooze**: Move current proposal to end of queue
4. **R for rationale**: Open rationale step
5. **Auto-advance**: After successful vote, auto-advance to next proposal (with 1.5s delay for toast)
6. **Queue completion**: When all proposals reviewed, show celebration state
7. **Toast notifications**: "Vote recorded ✓" toast on successful vote

**Keyboard shortcut registration:**

- Must be disabled when user is typing in textarea/input (rationale, agent chat)
- Must be disabled when panel is focused
- Use existing `useKeyboardShortcuts` pattern

### Chunk 5: Polish + Transitions

**Specific polish items:**

1. **Studio entry transition**: When navigating from browse to studio, the sidebar slides out and header morphs. Framer Motion `AnimatePresence` on sidebar. CSS transition on header.
2. **Content crossfade**: When J/K navigating between proposals, content fades out/in (opacity 150ms).
3. **Panel slide**: StudioPanel slides in from right edge (transform translateX, 200ms spring).
4. **Visual mode signal**: StudioHeader has a 2px top border in teal (`border-t-2 border-teal-500`).
5. **Queue dot animation**: Current dot has a subtle pulse animation.
6. **Vote toast**: Success toast slides up from bottom, fades after 2s.
7. **Queue completion celebration**: "All caught up 🎉" with Governance Rings animation.

---

## Quality Bar

### What "World-Class" Means Here

| Dimension               | Target                                         | Specific Criteria                                                                        |
| ----------------------- | ---------------------------------------------- | ---------------------------------------------------------------------------------------- |
| **Chrome reduction**    | No element that doesn't serve the current task | Header: 1 bar, 48px. No sidebar. No footer. Action bar: 1 bar, 48px. Total chrome: 96px. |
| **Content focus**       | Proposal text is the dominant visual element   | Max-w-3xl centered. Generous padding. Space Grotesk body. Clear section headers.         |
| **Keyboard efficiency** | Power users never touch the mouse              | J/K/Y/N/A/S/R/Escape + Cmd+K all functional. Flow state possible.                        |
| **Panel flexibility**   | Panels serve the user, not the layout          | Agent/Intel/Notes on-demand. Not permanent. Not overlapping content.                     |
| **Visual identity**     | Unmistakably Governada                         | Dark mode, teal accent, Fraunces for scores, constellation reference in header logo      |
| **Transitions**         | Every state change has smooth motion           | No layout jumps. No flash of unstyled content. Spring physics on panels.                 |
| **Mobile**              | Functional, not just responsive                | Action bar adapts. Panels become bottom sheets. Full-width content natural.              |

### Linear-Quality Checklist

- [ ] Every interactive element has hover + active states
- [ ] Keyboard shortcuts have visible hints (tooltips or Cmd+K menu)
- [ ] Focus rings are visible and consistent
- [ ] Loading states for content swap (skeleton or crossfade, never blank)
- [ ] Error states are graceful (toast, not page-level error)
- [ ] Empty states guide action ("No proposals to review" + suggestion)
- [ ] Typography hierarchy is clear (title → section → body → metadata)
- [ ] Spacing is consistent (using Compass Work mode: 14px base, 12px padding)

---

## Migration Notes

### What Gets Removed (after all chunks ship)

- `WorkspaceLayout.tsx` fullscreen overlay pattern — replaced by studio shell
- `WorkspaceToolbar.tsx` as standalone component — replaced by StudioHeader
- Queue rail in `ReviewWorkspace` — replaced by J/K + progress dots
- Double header (app header + workspace toolbar) — single StudioHeader

### What's Preserved

- `ProposalEditor` (Tiptap) — the editor itself is excellent, don't touch it
- `AgentChatPanel` — wraps inside StudioPanel's Agent tab
- `ReviewActionZone` — the vote flow logic stays, buttons move to action bar
- All hooks and data layer — zero backend changes
- Feature flags — `proposal_workspace` still gates the feature

### Rollback

If studio mode has issues:

- The old `WorkspaceLayout.tsx` fullscreen overlay still exists
- Studio mode is route-detected — removing the detection restores old behavior
- No database migrations, no API changes, no flag changes needed
