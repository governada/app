'use client';

/**
 * useEntityPreviewStack — manages a stack of previewed entities within
 * the Co-Pilot panel.
 *
 * Supports push/pop/reset with a max depth of 3 to prevent infinite nesting.
 * Provides a breadcrumb trail for navigation UI.
 */

import { useCallback, useState, useMemo } from 'react';
import type { PeekEntityType } from '@/hooks/usePeekDrawer';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface PreviewEntity {
  type: PeekEntityType;
  id: string;
  /** Secondary key for composite IDs (e.g., proposal index) */
  secondaryId?: string | number;
  /** Display label for breadcrumb trail (e.g., "DRep: CardanoSpark") */
  label: string;
}

export interface Breadcrumb {
  label: string;
  depth: number;
}

export interface UseEntityPreviewStackReturn {
  /** Current entity being previewed (top of stack), or null if stack is empty */
  current: PreviewEntity | null;
  /** Full stack of previewed entities */
  stack: PreviewEntity[];
  /** Breadcrumb trail for navigation */
  breadcrumbs: Breadcrumb[];
  /** Current depth (0 = no preview, 1-3 = preview levels) */
  depth: number;
  /** Whether the stack has reached max depth */
  isAtMaxDepth: boolean;
  /** Whether a preview is currently active */
  isActive: boolean;
  /** Push a new entity onto the stack (no-op if at max depth) */
  push: (entity: PreviewEntity) => void;
  /** Pop the top entity off the stack (go back one level) */
  pop: () => void;
  /** Navigate to a specific depth in the breadcrumb trail */
  navigateTo: (depth: number) => void;
  /** Clear the entire stack (return to panel root) */
  reset: () => void;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const MAX_DEPTH = 3;

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useEntityPreviewStack(): UseEntityPreviewStackReturn {
  const [stack, setStack] = useState<PreviewEntity[]>([]);

  const current = stack.length > 0 ? stack[stack.length - 1] : null;
  const depth = stack.length;
  const isAtMaxDepth = depth >= MAX_DEPTH;
  const isActive = depth > 0;

  const breadcrumbs: Breadcrumb[] = useMemo(
    () => stack.map((entity, i) => ({ label: entity.label, depth: i + 1 })),
    [stack],
  );

  const push = useCallback((entity: PreviewEntity) => {
    setStack((prev) => {
      if (prev.length >= MAX_DEPTH) return prev;
      // Prevent pushing the same entity that's already on top
      const top = prev[prev.length - 1];
      if (
        top &&
        top.type === entity.type &&
        top.id === entity.id &&
        top.secondaryId === entity.secondaryId
      ) {
        return prev;
      }
      return [...prev, entity];
    });
  }, []);

  const pop = useCallback(() => {
    setStack((prev) => {
      if (prev.length === 0) return prev;
      return prev.slice(0, -1);
    });
  }, []);

  const navigateTo = useCallback((targetDepth: number) => {
    setStack((prev) => {
      if (targetDepth <= 0) return [];
      if (targetDepth >= prev.length) return prev;
      return prev.slice(0, targetDepth);
    });
  }, []);

  const reset = useCallback(() => {
    setStack([]);
  }, []);

  return {
    current,
    stack,
    breadcrumbs,
    depth,
    isAtMaxDepth,
    isActive,
    push,
    pop,
    navigateTo,
    reset,
  };
}
