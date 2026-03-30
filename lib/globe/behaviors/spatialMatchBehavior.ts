/**
 * Spatial match behavior — places a match-derived user node on the globe.
 *
 * Handles: placeUserNode
 *
 * Sets the userNode field in FocusState so the rendering layer can display
 * the citizen's position in governance space after the match reveal.
 */

import type { GlobeBehavior, BehaviorContext } from './types';
import type { GlobeCommand } from '@/lib/globe/types';
import { getSharedFocus, setSharedFocus } from '@/lib/globe/focusState';

export function createSpatialMatchBehavior(): GlobeBehavior {
  return {
    id: 'spatialMatch',
    handles: ['placeUserNode'],
    execute(command: GlobeCommand, _ctx: BehaviorContext) {
      if (command.type !== 'placeUserNode') return;

      const current = getSharedFocus();
      setSharedFocus({
        ...current,
        userNode: { position: command.position, intensity: command.intensity },
      });
    },
    cleanup() {
      const current = getSharedFocus();
      setSharedFocus({ ...current, userNode: null });
    },
  };
}
