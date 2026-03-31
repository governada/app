/**
 * focusIntent — Window-level shared focus intent for the reactive focus engine.
 *
 * Mirrors focusState.ts: window globals are the only truly shared transport
 * between the parent React tree and R3F's separate fiber tree.
 *
 * Producers (SenecaMatch, discovery tools, etc.) write intents here.
 * The engine in GlobeConstellation reads intents and derives FocusState + camera.
 */

import type { FocusIntent } from './types';
import { DEFAULT_INTENT } from './types';

const INTENT_KEY = '__globeFocusIntent' as const;
const INTENT_VER_KEY = '__globeFocusIntentVersion' as const;

/** Read the current shared focus intent (SSR-safe) */
export function getSharedIntent(): FocusIntent {
  if (typeof window === 'undefined') return DEFAULT_INTENT;
  return (
    ((window as unknown as Record<string, unknown>)[INTENT_KEY] as FocusIntent) ?? DEFAULT_INTENT
  );
}

/** Write a new focus intent to the shared window global and bump version */
export function setSharedIntent(intent: FocusIntent): void {
  if (typeof window === 'undefined') return;
  const w = window as unknown as Record<string, unknown>;
  w[INTENT_KEY] = intent;
  w[INTENT_VER_KEY] = ((w[INTENT_VER_KEY] as number) ?? 0) + 1;
}

/** Read the intent version counter (used by engine tick to detect changes) */
export function getSharedIntentVersion(): number {
  if (typeof window === 'undefined') return 0;
  return ((window as unknown as Record<string, unknown>)[INTENT_VER_KEY] as number) ?? 0;
}
