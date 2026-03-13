'use client';

import type { ReactNode } from 'react';
import { useGovernanceDepth } from '@/hooks/useGovernanceDepth';
import type { GovernanceDepth } from '@/lib/governanceTuner';

interface DepthGateProps {
  /** Minimum depth required to render children */
  minDepth: GovernanceDepth;
  /** What to render when depth is below threshold (default: nothing) */
  fallback?: ReactNode;
  children: ReactNode;
}

/**
 * Renders children only when the user's governance depth meets the minimum threshold.
 *
 * Critical: data-fetching hooks must live inside DepthGate'd child components,
 * NOT at the parent level. When DepthGate returns the fallback, children don't
 * mount and their hooks don't fire — keeping API calls proportional to what
 * the user actually sees.
 */
export function DepthGate({ minDepth, fallback = null, children }: DepthGateProps) {
  const { isAtLeast } = useGovernanceDepth();
  return isAtLeast(minDepth) ? <>{children}</> : <>{fallback}</>;
}
