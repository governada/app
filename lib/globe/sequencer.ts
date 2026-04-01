/**
 * sequencer — Promise-based sequence runner for theatrical globe choreography.
 *
 * The reactive FocusEngine handles the declarative 80% of globe control
 * (producers write FocusIntent → engine derives FocusState + camera).
 *
 * This sequencer handles the remaining 20%: multi-step theatrical moments
 * (reveal countdowns, spatial placement, cleanup fades) that require precise
 * timing coordination. Only ~4 sequences total use this.
 *
 * Key features:
 * - Promise-based: `handle.done` resolves when the sequence completes
 * - Engine lock: prevents FocusEngine from processing intents during sequences
 * - Abort: `handle.cancel()` clears pending steps and releases the lock
 * - Step callbacks: `onStep(index)` for progress tracking
 *
 * Usage:
 *   const steps = buildRevealSequence(matches, alignment, 0);
 *   const handle = runSequence(flattenSequence(steps), dispatchGlobeCommand);
 *   await handle.done;
 *   setStep('results'); // Overlay appears at the right moment
 */

import type { GlobeCommand } from './types';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface SequenceStep {
  command: GlobeCommand;
  delayMs: number;
}

export interface SequenceHandle {
  /** Resolves when the sequence completes OR is cancelled. Never rejects. */
  done: Promise<void>;
  /** Cancel remaining steps, clear pending timeouts, release engine lock. */
  cancel: () => void;
}

export interface SequenceOptions {
  /** Called after each step is dispatched (0-indexed). */
  onStep?: (index: number) => void;
  /** If true, acquire the engine lock before running (default: true). */
  lockEngine?: boolean;
}

// ---------------------------------------------------------------------------
// Engine lock — prevents FocusEngine from processing intents during sequences
// ---------------------------------------------------------------------------

const LOCK_KEY = '__globeEngineLocked' as const;

/** Check if the engine is currently locked by a running sequence. */
export function isEngineLocked(): boolean {
  if (typeof window === 'undefined') return false;
  return (window as unknown as Record<string, unknown>)[LOCK_KEY] === true;
}

/** Acquire the engine lock. Returns false if already locked. */
export function acquireEngineLock(): boolean {
  if (typeof window === 'undefined') return false;
  const w = window as unknown as Record<string, unknown>;
  if (w[LOCK_KEY] === true) return false; // Already locked
  w[LOCK_KEY] = true;
  return true;
}

/** Release the engine lock. */
export function releaseEngineLock(): void {
  if (typeof window === 'undefined') return;
  (window as unknown as Record<string, unknown>)[LOCK_KEY] = false;
}

// ---------------------------------------------------------------------------
// Active sequence tracking — ensures only one sequence runs at a time
// ---------------------------------------------------------------------------

let activeCancel: (() => void) | null = null;

// ---------------------------------------------------------------------------
// Sequence runner
// ---------------------------------------------------------------------------

/**
 * Run a sequence of globe commands with specified delays between steps.
 *
 * Each step's `delayMs` is the time to wait BEFORE dispatching that step's command.
 * Steps with `delayMs: 0` are dispatched immediately (synchronously in the same tick).
 *
 * If another sequence is already running, it is cancelled first.
 */
export function runSequence(
  steps: SequenceStep[],
  dispatch: (cmd: GlobeCommand) => void,
  options?: SequenceOptions,
): SequenceHandle {
  // Cancel any currently-running sequence
  if (activeCancel) {
    activeCancel();
    activeCancel = null;
  }

  const shouldLock = options?.lockEngine !== false;
  const pendingTimeouts = new Set<ReturnType<typeof setTimeout>>();
  let cancelled = false;
  let resolveDone: () => void;

  const done = new Promise<void>((resolve) => {
    resolveDone = resolve;
  });

  // Acquire engine lock. The previous cancel's cleanup() should have released it,
  // but we release defensively first in case of edge cases.
  if (shouldLock) {
    releaseEngineLock();
    acquireEngineLock();
  }

  function cleanup() {
    for (const id of pendingTimeouts) clearTimeout(id);
    pendingTimeouts.clear();
    if (shouldLock) releaseEngineLock();
    activeCancel = null;
  }

  function cancel() {
    if (cancelled) return;
    cancelled = true;
    cleanup();
    resolveDone();
  }

  // Track this as the active sequence
  activeCancel = cancel;

  // Handle empty sequence
  if (steps.length === 0) {
    cleanup();
    resolveDone!();
    return { done, cancel: () => {} };
  }

  // Execute steps sequentially using chained timeouts
  let stepIndex = 0;

  function executeStep() {
    if (cancelled || stepIndex >= steps.length) return;

    const step = steps[stepIndex];
    const currentIndex = stepIndex;
    stepIndex++;

    const run = () => {
      if (cancelled) return;
      dispatch(step.command);
      options?.onStep?.(currentIndex);

      if (stepIndex >= steps.length) {
        // All steps dispatched — mark as done so cancel() is a no-op
        cancelled = true;
        cleanup();
        resolveDone!();
      } else {
        executeStep();
      }
    };

    if (step.delayMs <= 0) {
      // Synchronous dispatch for 0-delay steps
      run();
    } else {
      const id = setTimeout(() => {
        pendingTimeouts.delete(id);
        run();
      }, step.delayMs);
      pendingTimeouts.add(id);
    }
  }

  executeStep();

  return { done, cancel };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Flatten a GlobeCommand (which may be a 'sequence' type with nested steps)
 * into a flat array of SequenceSteps.
 */
export function flattenSequence(cmd: GlobeCommand): SequenceStep[] {
  if (cmd.type === 'sequence' && 'steps' in cmd) {
    return (cmd as { type: 'sequence'; steps: SequenceStep[] }).steps;
  }
  // Single command — wrap it
  return [{ command: cmd, delayMs: 0 }];
}
