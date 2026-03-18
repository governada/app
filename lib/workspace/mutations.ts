'use client';

import {
  useMutation,
  useQueryClient,
  type QueryKey,
  type UseMutationOptions,
} from '@tanstack/react-query';
import { toastSuccess, toastError } from './toast';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface OptimisticMutationOptions<TData, TVariables, TContext> {
  /** The async function that performs the server mutation */
  mutationFn: (vars: TVariables) => Promise<TData>;
  /** TanStack Query key to optimistically update and invalidate on settle */
  queryKey: QueryKey;
  /** Given the current cache data and mutation variables, return the optimistic next state */
  optimisticUpdate?: (old: unknown, vars: TVariables) => unknown;
  /** Toast shown on success. Omit for silent success (e.g. auto-save). */
  successMessage?: string;
  /** Toast shown on error with rollback. */
  errorMessage?: string;
  /** Additional TanStack Query mutation options (onSuccess, onError, etc.) */
  options?: Omit<UseMutationOptions<TData, Error, TVariables, TContext>, 'mutationFn'>;
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

/**
 * Wraps `useMutation` with an opinionated optimistic update + rollback + toast pattern.
 *
 * 1. `onMutate`  — cancels in-flight queries, snapshots current cache, applies optimistic update.
 * 2. `onError`   — rolls back to snapshot, shows error toast with optional retry action.
 * 3. `onSuccess` — shows success toast (if provided).
 * 4. `onSettled` — invalidates the query key to reconcile with the server.
 *
 * Usage:
 * ```ts
 * const createDraft = useOptimisticMutation({
 *   mutationFn: (vars) => postJson('/api/workspace/drafts', vars),
 *   queryKey: ['author-drafts', stakeAddress],
 *   optimisticUpdate: (old, vars) => ({
 *     ...old, drafts: [tempDraft, ...(old as any).drafts],
 *   }),
 *   successMessage: 'Draft created',
 *   errorMessage: 'Failed to create draft',
 * });
 * ```
 */
export function useOptimisticMutation<TData, TVariables, TContext = { previous: unknown }>({
  mutationFn,
  queryKey,
  optimisticUpdate,
  successMessage,
  errorMessage,
  options,
}: OptimisticMutationOptions<TData, TVariables, TContext>) {
  const queryClient = useQueryClient();

  return useMutation<TData, Error, TVariables, { previous: unknown }>({
    mutationFn,

    onMutate: async (vars) => {
      if (!optimisticUpdate) return { previous: undefined };

      // Cancel any outgoing refetches so they don't overwrite the optimistic update
      await queryClient.cancelQueries({ queryKey });

      // Snapshot the current cache value for rollback
      const previous = queryClient.getQueryData(queryKey);

      // Apply the optimistic update
      queryClient.setQueryData(queryKey, (old: unknown) => optimisticUpdate(old, vars));

      return { previous };
    },

    onError: (_err, _vars, context) => {
      // Rollback to the snapshot on error
      if (context?.previous !== undefined) {
        queryClient.setQueryData(queryKey, context.previous);
      }
      toastError(errorMessage ?? 'Something went wrong');
    },

    onSuccess: (_data, _vars, _context) => {
      if (successMessage) toastSuccess(successMessage);
    },

    onSettled: () => {
      // Always refetch from server to reconcile
      queryClient.invalidateQueries({ queryKey });
    },

    ...(options as Omit<
      UseMutationOptions<TData, Error, TVariables, { previous: unknown }>,
      'mutationFn'
    >),
  });
}
