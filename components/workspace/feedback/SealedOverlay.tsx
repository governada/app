'use client';

/**
 * SealedOverlay — shown during the sealed period when community
 * feedback is hidden. Encourages independent review.
 */

import { Shield, EyeOff } from 'lucide-react';
import { cn } from '@/lib/utils';

interface SealedOverlayProps {
  /** Optional time remaining text (e.g., "12h 30m remaining") */
  timeRemaining?: string;
  className?: string;
}

export function SealedOverlay({ timeRemaining, className }: SealedOverlayProps) {
  return (
    <div
      className={cn(
        'rounded-lg border border-indigo-500/30 bg-indigo-500/5 p-6 text-center space-y-3',
        className,
      )}
    >
      <div className="flex justify-center">
        <div className="rounded-full bg-indigo-500/10 p-3">
          <Shield className="h-6 w-6 text-indigo-500" />
        </div>
      </div>

      <div className="space-y-1">
        <h3 className="text-sm font-semibold text-indigo-700 dark:text-indigo-300">
          Independent Review Period
        </h3>
        <div className="flex items-center justify-center gap-1.5 text-xs text-muted-foreground">
          <EyeOff className="h-3.5 w-3.5" />
          <p>Community feedback is hidden during independent review.</p>
        </div>
      </div>

      <p className="text-xs text-foreground/70 max-w-sm mx-auto">
        Form your own opinion first. Submit your first annotation to unlock community feedback, or
        wait for the independent review period to end.
      </p>

      {timeRemaining && (
        <p className="text-[10px] text-indigo-600/70 dark:text-indigo-400/70">{timeRemaining}</p>
      )}
    </div>
  );
}
