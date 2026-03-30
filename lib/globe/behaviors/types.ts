/**
 * Globe behavior types — structured extension point for globe behaviors.
 */

import type { GlobeCommand } from '@/lib/globe/types';
import type { ConstellationNode3D } from '@/lib/constellation/types';

export interface BehaviorContext {
  /** Dispatch a globe command (may be handled by another behavior or the bridge) */
  dispatch: (command: GlobeCommand) => void;
  /** Schedule a command after a delay — returns cancel function */
  schedule: (command: GlobeCommand, delayMs: number) => () => void;
  /** Get current constellation nodes */
  getNodes: () => ConstellationNode3D[];
}

export interface GlobeBehavior {
  /** Unique identifier */
  id: string;
  /** Which command types this behavior handles */
  handles: GlobeCommand['type'][];
  /** Execute the command */
  execute: (command: GlobeCommand, ctx: BehaviorContext) => void;
  /** Optional cleanup when the behavior's mode exits */
  cleanup?: () => void;
}
