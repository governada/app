// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  runSequence,
  flattenSequence,
  isEngineLocked,
  acquireEngineLock,
  releaseEngineLock,
  type SequenceStep,
} from '@/lib/globe/sequencer';
import type { GlobeCommand } from '@/lib/globe/types';

// ---------------------------------------------------------------------------
// Setup: ensure clean lock state between tests
// ---------------------------------------------------------------------------

beforeEach(() => {
  releaseEngineLock();
});

// ---------------------------------------------------------------------------
// Engine lock
// ---------------------------------------------------------------------------

describe('engine lock', () => {
  it('starts unlocked', () => {
    expect(isEngineLocked()).toBe(false);
  });

  it('acquires and releases', () => {
    expect(acquireEngineLock()).toBe(true);
    expect(isEngineLocked()).toBe(true);
    releaseEngineLock();
    expect(isEngineLocked()).toBe(false);
  });

  it('returns false when already locked', () => {
    acquireEngineLock();
    expect(acquireEngineLock()).toBe(false);
    releaseEngineLock();
  });
});

// ---------------------------------------------------------------------------
// flattenSequence
// ---------------------------------------------------------------------------

describe('flattenSequence', () => {
  it('extracts steps from a sequence command', () => {
    const steps: SequenceStep[] = [
      { command: { type: 'dim' } as GlobeCommand, delayMs: 0 },
      { command: { type: 'clear' } as GlobeCommand, delayMs: 500 },
    ];
    const cmd = { type: 'sequence' as const, steps };
    const result = flattenSequence(cmd as GlobeCommand);
    expect(result).toEqual(steps);
  });

  it('wraps a single command in a step array', () => {
    const cmd = { type: 'dim' } as GlobeCommand;
    const result = flattenSequence(cmd);
    expect(result).toEqual([{ command: cmd, delayMs: 0 }]);
  });
});

// ---------------------------------------------------------------------------
// runSequence
// ---------------------------------------------------------------------------

describe('runSequence', () => {
  it('dispatches all steps and resolves', async () => {
    const dispatched: GlobeCommand[] = [];
    const dispatch = (cmd: GlobeCommand) => dispatched.push(cmd);

    const steps: SequenceStep[] = [
      { command: { type: 'dim' } as GlobeCommand, delayMs: 0 },
      { command: { type: 'clear' } as GlobeCommand, delayMs: 0 },
    ];

    const handle = runSequence(steps, dispatch);
    await handle.done;

    expect(dispatched).toHaveLength(2);
    expect(dispatched[0].type).toBe('dim');
    expect(dispatched[1].type).toBe('clear');
  });

  it('resolves immediately for empty sequence', async () => {
    const handle = runSequence([], vi.fn());
    await handle.done;
    expect(isEngineLocked()).toBe(false);
  });

  it('acquires engine lock during execution', async () => {
    const steps: SequenceStep[] = [{ command: { type: 'dim' } as GlobeCommand, delayMs: 10 }];

    const handle = runSequence(steps, vi.fn());
    expect(isEngineLocked()).toBe(true);

    await handle.done;
    expect(isEngineLocked()).toBe(false);
  });

  it('releases engine lock on completion', async () => {
    const steps: SequenceStep[] = [{ command: { type: 'dim' } as GlobeCommand, delayMs: 0 }];

    const handle = runSequence(steps, vi.fn());
    await handle.done;
    expect(isEngineLocked()).toBe(false);
  });

  it('cancels pending steps', async () => {
    const dispatched: GlobeCommand[] = [];
    const dispatch = (cmd: GlobeCommand) => dispatched.push(cmd);

    const steps: SequenceStep[] = [
      { command: { type: 'dim' } as GlobeCommand, delayMs: 0 },
      { command: { type: 'clear' } as GlobeCommand, delayMs: 5000 }, // Won't fire
    ];

    const handle = runSequence(steps, dispatch);
    // First step (0ms delay) dispatches synchronously
    handle.cancel();

    // done resolves (cancel is graceful, not an error)
    await handle.done;
    expect(dispatched).toHaveLength(1); // Only first step
    expect(isEngineLocked()).toBe(false);
  });

  it('releases engine lock on cancel', async () => {
    const steps: SequenceStep[] = [{ command: { type: 'dim' } as GlobeCommand, delayMs: 100 }];

    const handle = runSequence(steps, vi.fn());
    expect(isEngineLocked()).toBe(true);
    handle.cancel();
    expect(isEngineLocked()).toBe(false);

    await handle.done; // Resolves gracefully on cancel
  });

  it('cancels previous sequence when a new one starts', async () => {
    const dispatched: GlobeCommand[] = [];
    const dispatch = (cmd: GlobeCommand) => dispatched.push(cmd);

    const steps1: SequenceStep[] = [
      { command: { type: 'dim' } as GlobeCommand, delayMs: 0 },
      { command: { type: 'clear' } as GlobeCommand, delayMs: 5000 },
    ];
    const steps2: SequenceStep[] = [{ command: { type: 'reset' } as GlobeCommand, delayMs: 0 }];

    const handle1 = runSequence(steps1, dispatch);
    const handle2 = runSequence(steps2, dispatch);

    // handle1 resolves (graceful cancel)
    await handle1.done;
    await handle2.done;

    // dim (from seq1) + reset (from seq2)
    expect(dispatched.map((c) => c.type)).toEqual(['dim', 'reset']);
  });

  it('calls onStep callback for each step', async () => {
    const stepIndices: number[] = [];
    const steps: SequenceStep[] = [
      { command: { type: 'dim' } as GlobeCommand, delayMs: 0 },
      { command: { type: 'clear' } as GlobeCommand, delayMs: 0 },
      { command: { type: 'reset' } as GlobeCommand, delayMs: 0 },
    ];

    const handle = runSequence(steps, vi.fn(), {
      onStep: (i) => stepIndices.push(i),
    });
    await handle.done;

    expect(stepIndices).toEqual([0, 1, 2]);
  });

  it('handles delayed steps correctly', async () => {
    vi.useFakeTimers();
    try {
      const dispatched: GlobeCommand[] = [];
      const dispatch = (cmd: GlobeCommand) => dispatched.push(cmd);

      const steps: SequenceStep[] = [
        { command: { type: 'dim' } as GlobeCommand, delayMs: 0 },
        { command: { type: 'flash', nodeId: 'a' } as GlobeCommand, delayMs: 100 },
        { command: { type: 'clear' } as GlobeCommand, delayMs: 200 },
      ];

      const handle = runSequence(steps, dispatch);

      // First step dispatches synchronously (0ms delay)
      expect(dispatched).toHaveLength(1);

      // Advance 100ms — second step fires
      await vi.advanceTimersByTimeAsync(100);
      expect(dispatched).toHaveLength(2);

      // Advance 200ms — third step fires
      await vi.advanceTimersByTimeAsync(200);
      expect(dispatched).toHaveLength(3);

      await handle.done;
    } finally {
      vi.useRealTimers();
    }
  });

  it('skips engine lock when lockEngine is false', async () => {
    const steps: SequenceStep[] = [{ command: { type: 'dim' } as GlobeCommand, delayMs: 0 }];

    const handle = runSequence(steps, vi.fn(), { lockEngine: false });
    // Engine should NOT be locked
    expect(isEngineLocked()).toBe(false);
    await handle.done;
  });
});
