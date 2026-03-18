'use client';

/**
 * SaveStatusIndicator — subtle status text for the workspace status bar.
 *
 * Reads from the `useSaveStatus` Zustand store and displays:
 *   idle    → nothing (empty render)
 *   saving  → "Saving..."
 *   saved   → "Saved"   (with a check mark)
 *   error   → "Save error" (with an X mark)
 */

import { useSaveStatus } from '@/lib/workspace/save-status';
import { Loader2, Check, X } from 'lucide-react';

export function SaveStatusIndicator() {
  const status = useSaveStatus((s) => s.status);

  if (status === 'idle') return null;

  return (
    <span className="flex items-center gap-1 text-[11px] text-muted-foreground animate-in fade-in duration-200">
      {status === 'saving' && (
        <>
          <Loader2 className="h-3 w-3 animate-spin" />
          <span>Saving...</span>
        </>
      )}
      {status === 'saved' && (
        <>
          <Check className="h-3 w-3 text-emerald-500" />
          <span>Saved</span>
        </>
      )}
      {status === 'error' && (
        <>
          <X className="h-3 w-3 text-destructive" />
          <span>Save error</span>
        </>
      )}
    </span>
  );
}
