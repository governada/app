import { create } from 'zustand';

export type SynapticPhase = 'idle' | 'briefing' | 'conversation' | 'minimized';

interface SynapticState {
  phase: SynapticPhase;
  briefingText: string;
  chips: string[];
  isStreaming: boolean;
  error: string | null;

  // Actions
  startBriefing: () => void;
  appendText: (text: string) => void;
  setChips: (chips: string[]) => void;
  finishBriefing: () => void;
  setError: (error: string) => void;
  minimize: () => void;
  restore: () => void;
  startConversation: () => void;
  reset: () => void;
}

export const useSynapticStore = create<SynapticState>((set) => ({
  phase: 'idle',
  briefingText: '',
  chips: [],
  isStreaming: false,
  error: null,

  startBriefing: () =>
    set({ phase: 'briefing', briefingText: '', chips: [], isStreaming: true, error: null }),

  appendText: (text) => set((s) => ({ briefingText: s.briefingText + text })),

  setChips: (chips) => set({ chips }),

  finishBriefing: () => set({ isStreaming: false }),

  setError: (error) => set({ error, isStreaming: false }),

  minimize: () => set({ phase: 'minimized' }),

  restore: () =>
    set((s) => ({
      phase: s.briefingText ? 'briefing' : 'idle',
    })),

  startConversation: () => set({ phase: 'conversation' }),

  reset: () =>
    set({
      phase: 'idle',
      briefingText: '',
      chips: [],
      isStreaming: false,
      error: null,
    }),
}));
