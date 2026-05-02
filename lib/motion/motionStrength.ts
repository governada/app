'use client';

import {
  createContext,
  createElement,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react';

const STORAGE_KEY = 'governada_motion_strength';
const REDUCED_MOTION_DEFAULT = 0.05; // Tim Q0.3

export type MotionStrength = number; // 0.0 to 1.0

type MotionStrengthContextValue = {
  strength: MotionStrength;
  setStrength: (value: MotionStrength) => void;
  resetToSystemDefault: () => void;
};

type MotionStrengthState = {
  strength: MotionStrength;
  hasStoredOverride: boolean;
};

const MotionStrengthContext = createContext<MotionStrengthContextValue | null>(null);

function getSystemDefault(): MotionStrength {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return 1.0;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
    ? REDUCED_MOTION_DEFAULT
    : 1.0;
}

function readStoredStrength(): MotionStrength | null {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === null) return null;
    const parsed = Number.parseFloat(stored);
    if (Number.isFinite(parsed) && parsed >= 0 && parsed <= 1) return parsed;
  } catch {
    // localStorage may be unavailable in restricted browser contexts.
  }
  return null;
}

function getInitialMotionStrengthState(): MotionStrengthState {
  const stored = readStoredStrength();
  if (stored !== null) {
    return { strength: stored, hasStoredOverride: true };
  }

  return { strength: getSystemDefault(), hasStoredOverride: false };
}

export function MotionStrengthProvider({ children }: { children: ReactNode }) {
  const [{ strength, hasStoredOverride }, setMotionStrengthState] = useState<MotionStrengthState>(
    getInitialMotionStrengthState,
  );

  useEffect(() => {
    if (
      typeof window === 'undefined' ||
      typeof window.matchMedia !== 'function' ||
      hasStoredOverride
    ) {
      return;
    }

    const motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    const updateFromSystem = () => {
      setMotionStrengthState({
        strength: motionQuery.matches ? REDUCED_MOTION_DEFAULT : 1.0,
        hasStoredOverride: false,
      });
    };

    updateFromSystem();
    motionQuery.addEventListener?.('change', updateFromSystem);
    return () => {
      motionQuery.removeEventListener?.('change', updateFromSystem);
    };
  }, [hasStoredOverride]);

  const setStrength = useCallback((value: MotionStrength) => {
    const clamped = Math.max(0, Math.min(1, value));
    setMotionStrengthState({ strength: clamped, hasStoredOverride: true });
    try {
      localStorage.setItem(STORAGE_KEY, String(clamped));
    } catch {
      // Keep in-memory state even if persistence is unavailable.
    }
  }, []);

  const resetToSystemDefault = useCallback(() => {
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      // Ignore unavailable storage; system default still updates in-memory.
    }
    setMotionStrengthState({ strength: getSystemDefault(), hasStoredOverride: false });
  }, []);

  return createElement(
    MotionStrengthContext.Provider,
    { value: { strength, setStrength, resetToSystemDefault } },
    children,
  );
}

export function useMotionStrength(): MotionStrength {
  const ctx = useContext(MotionStrengthContext);
  return ctx?.strength ?? 1.0;
}

export function useMotionStrengthSetter() {
  const ctx = useContext(MotionStrengthContext);
  if (!ctx) {
    throw new Error('useMotionStrengthSetter must be used within MotionStrengthProvider');
  }
  return { setStrength: ctx.setStrength, resetToSystemDefault: ctx.resetToSystemDefault };
}
