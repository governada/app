'use client';

import { useCallback, useSyncExternalStore } from 'react';
import type { SpotlightEntityType, SpotlightViewMode } from '@/components/spotlight/types';

// ─── Storage Keys ─────────────────────────────────────────────────────────────

const TRACKED_KEY = (t: SpotlightEntityType) => `governada_spotlight_tracked_${t}`;
const SKIPPED_KEY = (t: SpotlightEntityType) => `governada_spotlight_skipped_${t}`;
const INDEX_KEY = (t: SpotlightEntityType) => `governada_spotlight_index_${t}`;
const VIEW_MODE_KEY = 'governada_spotlight_view_mode';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function readSet(key: string): Set<string> {
  if (typeof window === 'undefined') return new Set();
  try {
    const raw = localStorage.getItem(key);
    return raw ? new Set(JSON.parse(raw) as string[]) : new Set();
  } catch {
    return new Set();
  }
}

function writeSet(key: string, set: Set<string>): void {
  localStorage.setItem(key, JSON.stringify([...set]));
}

function readNumber(key: string, fallback: number): number {
  if (typeof window === 'undefined') return fallback;
  const raw = localStorage.getItem(key);
  return raw ? parseInt(raw, 10) || fallback : fallback;
}

// ─── External Store for Tracked IDs ───────────────────────────────────────────
// This lets multiple components subscribe to tracked ID changes across the app.

const listeners = new Set<() => void>();
let snapshotVersion = 0;

function emitChange() {
  snapshotVersion++;
  listeners.forEach((l) => l());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function getSnapshot() {
  return snapshotVersion;
}

function getServerSnapshot() {
  return 0;
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useSpotlightTracking(entityType: SpotlightEntityType) {
  // Subscribe to changes so React re-renders when tracking state changes
  useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  const trackedKey = TRACKED_KEY(entityType);
  const skippedKey = SKIPPED_KEY(entityType);
  const indexKey = INDEX_KEY(entityType);

  const trackedIds = readSet(trackedKey);
  const skippedIds = readSet(skippedKey);
  const currentIndex = readNumber(indexKey, 0);

  const track = useCallback(
    (id: string) => {
      const set = readSet(trackedKey);
      set.add(id);
      writeSet(trackedKey, set);
      // Remove from skipped if it was there
      const skip = readSet(skippedKey);
      if (skip.has(id)) {
        skip.delete(id);
        writeSet(skippedKey, skip);
      }
      emitChange();
    },
    [trackedKey, skippedKey],
  );

  const untrack = useCallback(
    (id: string) => {
      const set = readSet(trackedKey);
      set.delete(id);
      writeSet(trackedKey, set);
      emitChange();
    },
    [trackedKey],
  );

  const skip = useCallback(
    (id: string) => {
      const set = readSet(skippedKey);
      set.add(id);
      writeSet(skippedKey, set);
      emitChange();
    },
    [skippedKey],
  );

  const isTracked = useCallback((id: string) => readSet(trackedKey).has(id), [trackedKey]);

  const setIndex = useCallback(
    (index: number) => {
      localStorage.setItem(indexKey, String(index));
      emitChange();
    },
    [indexKey],
  );

  const clearAll = useCallback(() => {
    localStorage.removeItem(trackedKey);
    localStorage.removeItem(skippedKey);
    localStorage.removeItem(indexKey);
    emitChange();
  }, [trackedKey, skippedKey, indexKey]);

  return {
    trackedIds,
    skippedIds,
    currentIndex,
    trackedCount: trackedIds.size,
    track,
    untrack,
    skip,
    isTracked,
    setIndex,
    clearAll,
  };
}

// ─── View Mode ────────────────────────────────────────────────────────────────

export function useSpotlightViewMode(): [SpotlightViewMode, (mode: SpotlightViewMode) => void] {
  useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  const mode =
    (typeof window !== 'undefined'
      ? (localStorage.getItem(VIEW_MODE_KEY) as SpotlightViewMode | null)
      : null) ?? 'spotlight';

  const setMode = useCallback((m: SpotlightViewMode) => {
    localStorage.setItem(VIEW_MODE_KEY, m);
    emitChange();
  }, []);

  return [mode, setMode];
}
