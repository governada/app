/**
 * Behavior Registry — register and execute globe behaviors by command type.
 *
 * Behaviors are registered globally. When a command is dispatched, the registry
 * checks if any registered behavior handles it. If so, the behavior executes.
 * If not, the caller falls back to direct ref calls.
 */

import type { GlobeCommand } from '@/lib/globe/types';
import type { GlobeBehavior, BehaviorContext } from './types';

const behaviors: GlobeBehavior[] = [];

export function registerBehavior(behavior: GlobeBehavior): void {
  // Prevent duplicate registration
  if (behaviors.some((b) => b.id === behavior.id)) return;
  behaviors.push(behavior);
}

/**
 * Try to execute a command via a registered behavior.
 * Returns true if a behavior handled it, false if no behavior matched.
 */
export function executeBehavior(command: GlobeCommand, ctx: BehaviorContext): boolean {
  for (const behavior of behaviors) {
    if (behavior.handles.includes(command.type)) {
      behavior.execute(command, ctx);
      return true;
    }
  }
  return false;
}

/**
 * Run cleanup on all registered behaviors.
 * Call when exiting a mode (e.g., match mode → idle).
 */
export function cleanupBehaviors(): void {
  for (const behavior of behaviors) {
    behavior.cleanup?.();
  }
}
