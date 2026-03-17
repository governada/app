'use client';

/**
 * RevisionJustificationFlow — shown to proposers when saving a new version.
 *
 * For each changed section between the current draft and the last version:
 * - Shows a word-level diff preview
 * - Text input for the proposer's justification
 * - Theme linking dropdown to connect the change to a feedback theme
 * - AI assist button to auto-draft a justification from the diff + feedback context
 * - Submit saves the version with all justifications via the revision API
 * - Skip saves the version without justifications (discouraged but allowed)
 */

import { useMemo, useState, useCallback } from 'react';
import { computeWordDiff, type WordDiffSegment } from '@/lib/workspace/wordDiff';
import type { DraftContent } from '@/lib/workspace/types';
import type { ChangeJustification } from '@/lib/workspace/revision/types';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Sparkles, Send, SkipForward } from 'lucide-react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface FeedbackThemeOption {
  id: string;
  summary: string;
  category: 'concern' | 'support' | 'question' | 'suggestion';
  endorsementCount: number;
}

interface RevisionJustificationFlowProps {
  /** Content from the last saved version */
  previousContent: DraftContent;
  /** Current draft content (the new version about to be saved) */
  currentContent: DraftContent;
  /** Available feedback themes to link justifications to */
  feedbackThemes?: FeedbackThemeOption[];
  /** Callback: submit the revision with justifications */
  onSubmit: (justifications: ChangeJustification[], versionName: string) => void;
  /** Callback: skip justifications and save version directly */
  onSkip: () => void;
  /** Callback: cancel the flow (go back to editing) */
  onCancel: () => void;
  /** Whether the submission is in progress */
  isSubmitting?: boolean;
  /** Callback for AI justification generation */
  onGenerateJustification?: (field: string, oldText: string, newText: string) => Promise<string>;
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

const NO_THEME = '__none__';

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function CompactDiff({ segments }: { segments: WordDiffSegment[] }) {
  return (
    <div className="rounded-md border border-border/40 bg-card/50 px-2.5 py-1.5 text-xs leading-relaxed max-h-32 overflow-y-auto">
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

interface JustificationFieldProps {
  field: string;
  label: string;
  segments: WordDiffSegment[];
  justificationText: string;
  linkedThemeId: string;
  feedbackThemes: FeedbackThemeOption[];
  onJustificationChange: (text: string) => void;
  onThemeChange: (themeId: string) => void;
  onGenerateAI?: () => void;
  isGenerating?: boolean;
}

function JustificationField({
  label,
  segments,
  justificationText,
  linkedThemeId,
  feedbackThemes,
  onJustificationChange,
  onThemeChange,
  onGenerateAI,
  isGenerating,
}: JustificationFieldProps) {
  return (
    <div className="space-y-2 rounded-lg border border-border/50 bg-card/30 p-3">
      {/* Section header */}
      <h4 className="text-sm font-semibold">{label}</h4>

      {/* Compact diff preview */}
      <CompactDiff segments={segments} />

      {/* Justification input */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <label className="text-xs text-muted-foreground">Why did you make this change?</label>
          {onGenerateAI && (
            <Button
              variant="ghost"
              size="sm"
              className="h-6 text-[11px] text-blue-400 hover:text-blue-300"
              onClick={onGenerateAI}
              disabled={isGenerating}
            >
              <Sparkles className="h-3 w-3 mr-1" />
              {isGenerating ? 'Generating...' : 'Generate justification'}
            </Button>
          )}
        </div>
        <textarea
          className={cn(
            'w-full rounded-md border border-border/60 bg-background px-3 py-2',
            'text-sm placeholder:text-muted-foreground/50',
            'focus:outline-none focus:ring-1 focus:ring-ring',
            'resize-none min-h-[60px]',
          )}
          placeholder="e.g., Revised per community feedback — added per-milestone cost breakdown"
          value={justificationText}
          onChange={(e) => onJustificationChange(e.target.value)}
        />
      </div>

      {/* Theme linking */}
      {feedbackThemes.length > 0 && (
        <div className="space-y-1">
          <label className="text-xs text-muted-foreground">Link to feedback theme (optional)</label>
          <Select value={linkedThemeId || NO_THEME} onValueChange={onThemeChange}>
            <SelectTrigger className="h-8 text-xs">
              <SelectValue placeholder="Select a theme..." />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={NO_THEME} className="text-xs">
                No linked theme
              </SelectItem>
              {feedbackThemes.map((theme) => (
                <SelectItem key={theme.id} value={theme.id} className="text-xs">
                  <span className="capitalize">{theme.category}</span>:{' '}
                  {theme.summary.length > 60 ? `${theme.summary.slice(0, 60)}...` : theme.summary}
                  <span className="ml-1 text-muted-foreground">({theme.endorsementCount})</span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function RevisionJustificationFlow({
  previousContent,
  currentContent,
  feedbackThemes = [],
  onSubmit,
  onSkip,
  onCancel,
  isSubmitting = false,
  onGenerateJustification,
}: RevisionJustificationFlowProps) {
  const [versionName, setVersionName] = useState('');
  const [justifications, setJustifications] = useState<
    Record<string, { text: string; themeId: string }>
  >({});
  const [generatingField, setGeneratingField] = useState<string | null>(null);

  // Compute changed fields
  const changedFields = useMemo(() => {
    return FIELDS.filter(({ key }) => {
      const oldText = String(previousContent[key] || '');
      const newText = String(currentContent[key] || '');
      return oldText !== newText;
    }).map(({ key, label }) => {
      const oldText = String(previousContent[key] || '');
      const newText = String(currentContent[key] || '');
      const segments = computeWordDiff(oldText, newText);
      return { key, label, oldText, newText, segments };
    });
  }, [previousContent, currentContent]);

  const handleJustificationChange = useCallback((field: string, text: string) => {
    setJustifications((prev) => ({
      ...prev,
      [field]: { text, themeId: prev[field]?.themeId ?? '' },
    }));
  }, []);

  const handleThemeChange = useCallback((field: string, themeId: string) => {
    const resolvedId = themeId === NO_THEME ? '' : themeId;
    setJustifications((prev) => ({
      ...prev,
      [field]: { text: prev[field]?.text ?? '', themeId: resolvedId },
    }));
  }, []);

  const handleGenerateAI = useCallback(
    async (field: string, oldText: string, newText: string) => {
      if (!onGenerateJustification) return;
      setGeneratingField(field);
      try {
        const generated = await onGenerateJustification(field, oldText, newText);
        setJustifications((prev) => ({
          ...prev,
          [field]: { text: generated, themeId: prev[field]?.themeId ?? '' },
        }));
      } finally {
        setGeneratingField(null);
      }
    },
    [onGenerateJustification],
  );

  const handleSubmit = useCallback(() => {
    const changeJustifications: ChangeJustification[] = changedFields
      .map(({ key }) => {
        const j = justifications[key];
        return {
          field: key as ChangeJustification['field'],
          justification: j?.text || '',
          linkedThemeId: j?.themeId || undefined,
        };
      })
      .filter((j) => j.justification.length > 0);

    onSubmit(changeJustifications, versionName || `Revision ${new Date().toLocaleDateString()}`);
  }, [changedFields, justifications, versionName, onSubmit]);

  const hasAnyJustifications = Object.values(justifications).some((j) => j.text.trim().length > 0);

  if (changedFields.length === 0) {
    return (
      <div className="text-center py-6">
        <p className="text-sm text-muted-foreground">
          No sections have changed since the last version.
        </p>
        <Button variant="ghost" size="sm" className="mt-2" onClick={onCancel}>
          Go back
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div>
        <h3 className="text-base font-semibold">Revision Justifications</h3>
        <p className="text-xs text-muted-foreground mt-0.5">
          Explain why you changed each section. Reviewers will see these justifications alongside
          the diffs. This creates an accountability trail for your revisions.
        </p>
      </div>

      {/* Version name input */}
      <div className="space-y-1">
        <label className="text-xs font-medium">Version name</label>
        <input
          type="text"
          className={cn(
            'w-full rounded-md border border-border/60 bg-background px-3 py-2',
            'text-sm placeholder:text-muted-foreground/50',
            'focus:outline-none focus:ring-1 focus:ring-ring',
          )}
          placeholder="e.g., v2 — Budget revision"
          value={versionName}
          onChange={(e) => setVersionName(e.target.value)}
        />
      </div>

      {/* Per-section justification fields */}
      <div className="space-y-3">
        {changedFields.map(({ key, label, oldText, newText, segments }) => (
          <JustificationField
            key={key}
            field={key}
            label={label}
            segments={segments}
            justificationText={justifications[key]?.text ?? ''}
            linkedThemeId={justifications[key]?.themeId ?? ''}
            feedbackThemes={feedbackThemes}
            onJustificationChange={(text) => handleJustificationChange(key, text)}
            onThemeChange={(themeId) => handleThemeChange(key, themeId)}
            onGenerateAI={
              onGenerateJustification ? () => handleGenerateAI(key, oldText, newText) : undefined
            }
            isGenerating={generatingField === key}
          />
        ))}
      </div>

      {/* Actions */}
      <div className="flex items-center justify-between pt-2 border-t border-border/30">
        <Button variant="ghost" size="sm" onClick={onCancel} disabled={isSubmitting}>
          Cancel
        </Button>

        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            className="text-muted-foreground"
            onClick={onSkip}
            disabled={isSubmitting}
          >
            <SkipForward className="h-3.5 w-3.5 mr-1" />
            Save without justifications
          </Button>
          <Button size="sm" onClick={handleSubmit} disabled={isSubmitting || !versionName.trim()}>
            <Send className="h-3.5 w-3.5 mr-1" />
            {isSubmitting ? 'Saving...' : hasAnyJustifications ? 'Submit revision' : 'Save version'}
          </Button>
        </div>
      </div>
    </div>
  );
}
