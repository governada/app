'use client';

import { createContext, useContext, useCallback, useSyncExternalStore } from 'react';

interface DiscoveryHubContextValue {
  openHub: () => void;
  setCurrentPage: (page: string) => void;
}

const DiscoveryHubContext = createContext<DiscoveryHubContextValue | null>(null);

export function useDiscoveryHub() {
  return useContext(DiscoveryHubContext);
}

export { DiscoveryHubContext };

// ── Global open callback ─────────────────────────────────────────────────────
// Because DiscoveryHub is lazy-loaded (dynamic, ssr:false), the context
// provider isn't available when the header first renders. This module-level
// callback lets any component trigger openHub even before the context mounts.

let _globalOpenHub: (() => void) | null = null;
const _listeners = new Set<() => void>();

function subscribe(cb: () => void) {
  _listeners.add(cb);
  return () => _listeners.delete(cb);
}

function getSnapshot() {
  return _globalOpenHub;
}

/** Called by DiscoveryHub on mount to register its open handler globally. */
export function registerOpenHub(fn: () => void) {
  _globalOpenHub = fn;
  _listeners.forEach((cb) => cb());
}

/** Called by DiscoveryHub on unmount. */
export function unregisterOpenHub() {
  _globalOpenHub = null;
  _listeners.forEach((cb) => cb());
}

/**
 * Hook for components outside the DiscoveryHub context tree (e.g., header).
 * Returns the openHub function once DiscoveryHub has mounted.
 */
export function useGlobalOpenHub(): (() => void) | null {
  return useSyncExternalStore(subscribe, getSnapshot, () => null);
}
