'use client';

/**
 * VersionDiffView — Read-only view rendering word-level diffs inline.
 *
 * Takes two DraftContent objects and shows changes with green (added) and red
 * (removed) inline marks. Uses `computeWordDiff` from `lib/workspace/wordDiff.ts`.
 *
 * This component does NOT use Tiptap — it renders a static, read-only diff view
 * for use in Diff mode. The diff is purely visual.
 */

import { useMemo } from 'react';
import { computeWordDiff } from '@/lib/workspace/wordDiff';
import type { WordDiffSegment } from '@/lib/workspace/wordDiff';
import type { DraftContent } from '@/lib/workspace/types';
import type { ProposalField } from '@/lib/workspace/editor/types';

// ---------------------------------------------------------------------------
// Section configuration (mirrors SectionBlock)
// ---------------------------------------------------------------------------

const DIFF_SECTIONS: Array<{ field: ProposalField; label: string }> = [
  { field: 'title', label: 'Title' },
  { field: 'abstract', label: 'Abstract' },
  { field: 'motivation', label: 'Motivation' },
  { field: 'rationale', label: 'Rationale' },
];

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface VersionDiffViewProps {
  /** The older version content */
  oldContent: DraftContent;
  /** The newer version content */
  newContent: DraftContent;
  /** Optional labels for the versions */
  oldLabel?: string;
  newLabel?: string;
  /** Whether to collapse unchanged sections */
  collapseUnchanged?: boolean;
  /** Optional change justifications per field */
  justifications?: Array<{
    field: string;
    justification: string;
    linkedThemeId?: string;
  }>;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function VersionDiffView({
  oldContent,
  newContent,
  oldLabel = 'Previous',
  newLabel = 'Current',
  collapseUnchanged = false,
  justifications,
}: VersionDiffViewProps) {
  // Compute diffs for all sections
  const diffs = useMemo(() => {
    const result: Record<ProposalField, { segments: WordDiffSegment[]; hasChanges: boolean }> = {
      title: { segments: [], hasChanges: false },
      abstract: { segments: [], hasChanges: false },
      motivation: { segments: [], hasChanges: false },
      rationale: { segments: [], hasChanges: false },
    };

    for (const { field } of DIFF_SECTIONS) {
      const oldText = oldContent[field] || '';
      const newText = newContent[field] || '';
      const segments = computeWordDiff(oldText, newText);
      const hasChanges = segments.some((s) => s.type !== 'unchanged');
      result[field] = { segments, hasChanges };
    }

    return result;
  }, [oldContent, newContent]);

  const changedCount = DIFF_SECTIONS.filter((s) => diffs[s.field].hasChanges).length;

  return (
    <div className="version-diff-view p-6 max-w-3xl mx-auto space-y-4">
      {/* Diff header */}
      <div className="flex items-center justify-between px-4 py-2 rounded-lg bg-muted/30 border border-border/30">
        <div className="flex items-center gap-3 text-sm">
          <span className="text-muted-foreground">{oldLabel}</span>
          <span className="text-muted-foreground/50">&rarr;</span>
          <span className="font-medium text-foreground">{newLabel}</span>
        </div>
        <span className="text-[11px] text-muted-foreground tabular-nums">
          {changedCount} of {DIFF_SECTIONS.length} sections changed
        </span>
      </div>

      {/* Diff legend */}
      <div className="flex items-center gap-4 px-4 text-[11px] text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <span className="inline-block w-3 h-3 rounded-sm bg-emerald-200/60 dark:bg-emerald-900/40 border border-emerald-400/30" />
          Added
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block w-3 h-3 rounded-sm bg-red-200/60 dark:bg-red-900/40 border border-red-400/30 line-through" />
          Removed
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block w-3 h-3 rounded-sm bg-muted border border-border/30" />
          Unchanged
        </span>
      </div>

      {/* Section diffs */}
      {DIFF_SECTIONS.map(({ field, label }) => {
        const { segments, hasChanges } = diffs[field];
        const justification = justifications?.find((j) => j.field === field);

        if (collapseUnchanged && !hasChanges) {
          return <CollapsedSection key={field} label={label} />;
        }

        return (
          <div key={field} className="border border-border/50 rounded-lg bg-card overflow-hidden">
            {/* Section header */}
            <div className="flex items-center justify-between px-4 py-2 bg-muted/20 border-b border-border/30">
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                  {label}
                </span>
                {hasChanges ? (
                  <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 font-medium">
                    Changed
                  </span>
                ) : (
                  <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground">
                    Unchanged
                  </span>
                )}
              </div>
            </div>

            {/* Change justification callout */}
            {justification && (
              <div className="mx-4 mt-3 px-3 py-2 rounded-md border border-primary/20 bg-primary/5">
                <div className="text-[10px] uppercase tracking-wide text-primary/70 font-medium mb-1">
                  Why this changed
                </div>
                <p className="text-xs leading-relaxed text-foreground/80">
                  {justification.justification}
                </p>
              </div>
            )}

            {/* Diff content */}
            <div className="px-4 py-3">
              <div className="text-sm leading-relaxed whitespace-pre-wrap">
                {segments.map((segment, i) => (
                  <DiffSegment key={i} segment={segment} />
                ))}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function DiffSegment({ segment }: { segment: WordDiffSegment }) {
  switch (segment.type) {
    case 'added':
      return (
        <span className="ai-diff-added bg-emerald-200/60 dark:bg-emerald-900/40 text-emerald-900 dark:text-emerald-100 rounded-sm px-0.5">
          {segment.text}
        </span>
      );
    case 'removed':
      return (
        <span className="ai-diff-removed bg-red-200/60 dark:bg-red-900/40 text-red-900 dark:text-red-100 line-through rounded-sm px-0.5 opacity-70">
          {segment.text}
        </span>
      );
    case 'unchanged':
    default:
      return <span className="text-foreground/90">{segment.text}</span>;
  }
}

function CollapsedSection({ label }: { label: string }) {
  return (
    <div className="border border-border/30 rounded-lg bg-muted/10 px-4 py-2 flex items-center justify-between">
      <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground/50">
        {label}
      </span>
      <span className="text-[10px] text-muted-foreground/40">No changes</span>
    </div>
  );
}
