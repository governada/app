/**
 * Change detection + justification helpers for the revision system.
 *
 * Compares two DraftContent snapshots and returns per-field change details
 * using the existing word-level diff utility.
 */

import type { DraftContent } from '@/lib/workspace/types';
import { computeWordDiff } from '@/lib/workspace/wordDiff';
import type { ChangedSection } from './types';

/** The content fields we compare between versions */
const CONTENT_FIELDS = ['title', 'abstract', 'motivation', 'rationale'] as const;

/**
 * Compute which sections changed between two content snapshots.
 *
 * For each field that differs, produces a word-level diff summary
 * and a count of changed words.
 */
export function computeChangedSections(
  oldContent: DraftContent,
  newContent: DraftContent,
): ChangedSection[] {
  const changed: ChangedSection[] = [];

  for (const field of CONTENT_FIELDS) {
    const oldText = (oldContent[field] as string) ?? '';
    const newText = (newContent[field] as string) ?? '';

    if (oldText === newText) continue;

    const segments = computeWordDiff(oldText, newText);

    let addedCount = 0;
    let removedCount = 0;

    for (const seg of segments) {
      if (seg.type === 'added') {
        // Count words (split on whitespace, filter empties)
        addedCount += seg.text.split(/\s+/).filter((w) => w.length > 0).length;
      } else if (seg.type === 'removed') {
        removedCount += seg.text.split(/\s+/).filter((w) => w.length > 0).length;
      }
    }

    const parts: string[] = [];
    if (addedCount > 0) parts.push(`${addedCount} word${addedCount === 1 ? '' : 's'} added`);
    if (removedCount > 0)
      parts.push(`${removedCount} word${removedCount === 1 ? '' : 's'} removed`);

    const diffSummary = parts.length > 0 ? parts.join(', ') : 'Content changed';

    changed.push({
      field,
      oldText,
      newText,
      diffSummary,
      wordChangeCount: addedCount + removedCount,
    });
  }

  return changed;
}
