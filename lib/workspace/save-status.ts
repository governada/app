import { create } from 'zustand';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type SaveStatus = 'idle' | 'saving' | 'saved' | 'error';

interface SaveStatusState {
  status: SaveStatus;
  setSaving: () => void;
  setSaved: () => void;
  setError: () => void;
  setIdle: () => void;
}

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------

/**
 * Tiny Zustand store for workspace auto-save status.
 *
 * - `saving`  — mutation in flight
 * - `saved`   — mutation succeeded (auto-resets to idle after 2 s)
 * - `error`   — mutation failed
 * - `idle`    — nothing happening
 *
 * Consumed by `SaveStatusIndicator` in the status bar.
 */
export const useSaveStatus = create<SaveStatusState>((set) => ({
  status: 'idle',

  setSaving: () => set({ status: 'saving' }),

  setSaved: () => {
    set({ status: 'saved' });
    // Auto-reset to idle after 2 seconds so the indicator fades out
    setTimeout(() => set((s) => (s.status === 'saved' ? { status: 'idle' } : s)), 2000);
  },

  setError: () => set({ status: 'error' }),

  setIdle: () => set({ status: 'idle' }),
}));
