'use client';

/**
 * RevisionDiffView — reviewer's revision review experience.
 *
 * Renders the full proposal with word-level diffs inline (green added,
 * red removed strikethrough). Unchanged sections are collapsed by default.
 * Each changed section shows: the diff + justification callout + feedback
 * theme link. Per-section actions: [Approve] [Flag for further revision].
 * Progress bar: "3/5 changes reviewed".
 *
 * Accepts version data as props — the parent page provides it.
 */

import { useMemo, useCallback, useState } from 'react';
import { computeWordDiff, type WordDiffSegment } from '@/lib/workspace/wordDiff';
import type { DraftContent } from '@/lib/workspace/types';
import type { ChangeJustification, RevisionReviewState } from '@/lib/workspace/revision/types';
import { ChangeJustificationCallout } from './ChangeJustificationCallout';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Check, Flag, ChevronDown, ChevronRight } from 'lucide-react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface FeedbackThemeInfo {
  id: string;
  summary: string;
  endorsementCount: number;
}

interface RevisionDiffViewProps {
  /** Content from the previous version */
  oldContent: DraftContent;
  /** Content from the new (revised) version */
  newContent: DraftContent;
  /** Proposer's change justifications */
  justifications: ChangeJustification[];
  /** When the revision was submitted */
  revisionTimestamp?: string;
  /** Version labels for display */
  oldVersionName?: string;
  newVersionName?: string;
  /** Feedback theme lookup: theme ID -> theme info */
  themeMap?: Record<string, FeedbackThemeInfo>;
  /** Callback when reviewer approves a section change */
  onApproveChange?: (field: string) => void;
  /** Callback when reviewer flags a section for further revision */
  onFlagChange?: (field: string) => void;
  /** Current review state (which sections have been reviewed) */
  reviewState?: RevisionReviewState;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const FIELDS = [
  { key: 'title' as const, label: 'Title' },
  { key: 'abstract' as const, label: 'Abstract' },
  { key: 'motivation' as const, label: 'Motivation' },
  { key: 'rationale' as const, label: 'Rationale' },
] as const;

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function InlineDiff({ segments }: { segments: WordDiffSegment[] }) {
  return (
    <div className="rounded-md border border-border/60 bg-card px-3 py-2 text-sm leading-relaxed">
      {segments.map((seg, i) => {
        if (seg.type === 'unchanged') return <span key={i}>{seg.text}</span>;
        if (seg.type === 'removed') {
          return (
            <span key={i} className="line-through text-rose-500 dark:text-rose-400">
              {seg.text}
            </span>
          );
        }
        return (
          <span
            key={i}
            className="bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 rounded-sm px-0.5"
          >
            {seg.text}
          </span>
        );
      })}
    </div>
  );
}

function UnchangedSection({ label, text }: { label: string; text: string }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="border-b border-border/30 py-2">
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors w-full text-left"
      >
        {expanded ? (
          <ChevronDown className="h-3.5 w-3.5" />
        ) : (
          <ChevronRight className="h-3.5 w-3.5" />
        )}
        <span className="font-medium">{label}</span>
        <span className="ml-1 text-muted-foreground/50">— unchanged</span>
      </button>
      {expanded && (
        <div className="mt-2 rounded-md border border-border/30 bg-card/50 px-3 py-2 text-sm text-muted-foreground leading-relaxed">
          {text || <span className="italic">Empty</span>}
        </div>
      )}
    </div>
  );
}

interface ChangedSectionProps {
  label: string;
  field: string;
  segments: WordDiffSegment[];
  justification?: ChangeJustification;
  revisionTimestamp?: string;
  themeInfo?: FeedbackThemeInfo;
  status: 'pending' | 'approved' | 'flagged';
  onApprove?: () => void;
  onFlag?: () => void;
}

function ChangedSectionBlock({
  label,
  field: _field,
  segments,
  justification,
  revisionTimestamp,
  themeInfo,
  status,
  onApprove,
  onFlag,
}: ChangedSectionProps) {
  return (
    <div
      className={cn(
        'border-l-2 py-3',
        status === 'approved' && 'border-l-emerald-500/50',
        status === 'flagged' && 'border-l-amber-500/50',
        status === 'pending' && 'border-l-blue-500/50',
      )}
    >
      <div className="pl-3 space-y-2">
        {/* Section header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h4 className="text-sm font-semibold">{label}</h4>
            {status === 'approved' && (
              <span className="inline-flex items-center gap-1 text-[10px] text-emerald-500 font-medium">
                <Check className="h-3 w-3" /> Approved
              </span>
            )}
            {status === 'flagged' && (
              <span className="inline-flex items-center gap-1 text-[10px] text-amber-500 font-medium">
                <Flag className="h-3 w-3" /> Flagged
              </span>
            )}
          </div>

          {/* Actions */}
          {status === 'pending' && (
            <div className="flex items-center gap-1.5">
              <Button
                variant="ghost"
                size="sm"
                className="h-7 text-xs text-emerald-600 hover:text-emerald-700 hover:bg-emerald-500/10"
                onClick={onApprove}
              >
                <Check className="h-3.5 w-3.5 mr-1" />
                Approve
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 text-xs text-amber-600 hover:text-amber-700 hover:bg-amber-500/10"
                onClick={onFlag}
              >
                <Flag className="h-3.5 w-3.5 mr-1" />
                Flag
              </Button>
            </div>
          )}
        </div>

        {/* Word-level inline diff */}
        <InlineDiff segments={segments} />

        {/* Change justification callout */}
        {justification && (
          <ChangeJustificationCallout
            justification={justification}
            timestamp={revisionTimestamp}
            linkedThemeSummary={themeInfo?.summary}
            linkedThemeEndorsements={themeInfo?.endorsementCount}
            className="ml-0"
          />
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function RevisionDiffView({
  oldContent,
  newContent,
  justifications,
  revisionTimestamp,
  oldVersionName,
  newVersionName,
  themeMap = {},
  onApproveChange,
  onFlagChange,
  reviewState: externalReviewState,
}: RevisionDiffViewProps) {
  // Internal review state (used when no external state is provided)
  const [internalPerField, setInternalPerField] = useState<
    Record<string, 'pending' | 'approved' | 'flagged'>
  >({});

  // Build a map of justifications by field
  const justificationMap = useMemo(() => {
    const map = new Map<string, ChangeJustification>();
    for (const j of justifications) {
      map.set(j.field, j);
    }
    return map;
  }, [justifications]);

  // Compute diffs per field
  const fieldDiffs = useMemo(() => {
    return FIELDS.map(({ key, label }) => {
      const oldText = String(oldContent[key] || '');
      const newText = String(newContent[key] || '');
      const changed = oldText !== newText;
      const segments = changed ? computeWordDiff(oldText, newText) : [];
      return { key, label, oldText, newText, changed, segments };
    });
  }, [oldContent, newContent]);

  const changedFields = fieldDiffs.filter((f) => f.changed);
  const unchangedFields = fieldDiffs.filter((f) => !f.changed);

  // Use external review state if provided, otherwise use internal
  const perField = externalReviewState?.perField ?? internalPerField;
  const reviewedCount = Object.values(perField).filter(
    (s) => s === 'approved' || s === 'flagged',
  ).length;
  const totalChanges = changedFields.length;
  const progressPercent = totalChanges > 0 ? (reviewedCount / totalChanges) * 100 : 0;

  const handleApprove = useCallback(
    (field: string) => {
      if (onApproveChange) {
        onApproveChange(field);
      } else {
        setInternalPerField((prev) => ({ ...prev, [field]: 'approved' }));
      }
    },
    [onApproveChange],
  );

  const handleFlag = useCallback(
    (field: string) => {
      if (onFlagChange) {
        onFlagChange(field);
      } else {
        setInternalPerField((prev) => ({ ...prev, [field]: 'flagged' }));
      }
    },
    [onFlagChange],
  );

  return (
    <div className="space-y-4">
      {/* Header: version comparison + progress */}
      <div className="space-y-2">
        <div className="flex items-center justify-between text-sm">
          <div className="flex items-center gap-2">
            {oldVersionName && (
              <span className="rounded bg-red-500/10 px-2 py-0.5 text-xs font-medium text-red-400">
                {oldVersionName}
              </span>
            )}
            <span className="text-muted-foreground">→</span>
            {newVersionName && (
              <span className="rounded bg-green-500/10 px-2 py-0.5 text-xs font-medium text-green-400">
                {newVersionName}
              </span>
            )}
          </div>

          {totalChanges > 0 && (
            <span className="text-xs text-muted-foreground">
              {reviewedCount}/{totalChanges} changes reviewed
            </span>
          )}
        </div>

        {/* Progress bar */}
        {totalChanges > 0 && <Progress value={progressPercent} className="h-1.5" />}
      </div>

      {/* Changed sections */}
      {changedFields.length > 0 && (
        <div className="space-y-3">
          {changedFields.map(({ key, label, segments }) => {
            const justification = justificationMap.get(key);
            const themeInfo = justification?.linkedThemeId
              ? themeMap[justification.linkedThemeId]
              : undefined;

            return (
              <ChangedSectionBlock
                key={key}
                label={label}
                field={key}
                segments={segments}
                justification={justification}
                revisionTimestamp={revisionTimestamp}
                themeInfo={themeInfo}
                status={perField[key] ?? 'pending'}
                onApprove={() => handleApprove(key)}
                onFlag={() => handleFlag(key)}
              />
            );
          })}
        </div>
      )}

      {/* Unchanged sections (collapsed by default) */}
      {unchangedFields.length > 0 && (
        <div className="mt-4">
          <p className="text-[10px] text-muted-foreground/50 uppercase tracking-wider mb-1">
            Unchanged sections
          </p>
          {unchangedFields.map(({ key, label, newText }) => (
            <UnchangedSection key={key} label={label} text={newText} />
          ))}
        </div>
      )}

      {/* No changes notice */}
      {changedFields.length === 0 && (
        <div className="text-center py-8">
          <p className="text-sm text-muted-foreground">No changes between versions</p>
        </div>
      )}
    </div>
  );
}
