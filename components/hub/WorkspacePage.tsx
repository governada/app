'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useSegment } from '@/components/providers/SegmentProvider';

/**
 * WorkspacePage — Smart redirect to the right workspace sub-page per persona.
 *
 * Each persona has a primary workspace activity:
 * - DReps: Review queue (their #1 JTBD)
 * - SPOs: Performance / gov score dashboard
 * - Citizens/CC: Proposal authoring
 * - Anonymous: Back to home (shouldn't reach workspace)
 */
export function WorkspacePage() {
  const { segment } = useSegment();
  const router = useRouter();

  useEffect(() => {
    switch (segment) {
      case 'drep':
        router.replace('/workspace/review');
        break;
      case 'spo':
        router.replace('/workspace/performance');
        break;
      case 'citizen':
      case 'cc':
        router.replace('/workspace/author');
        break;
      default:
        router.replace('/');
        break;
    }
  }, [segment, router]);

  return null;
}
