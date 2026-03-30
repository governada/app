'use client';

import { PageViewTracker } from '@/components/PageViewTracker';
import { useSegment } from '@/components/providers/SegmentProvider';
import { useSearchParams } from 'next/navigation';
import dynamic from 'next/dynamic';

const DRepScorecardView = dynamic(
  () =>
    import('@/components/governada/identity/DRepScorecardView').then((m) => ({
      default: m.DRepScorecardView,
    })),
  { ssr: false },
);

const SPOScorecardView = dynamic(
  () =>
    import('@/components/governada/identity/SPOScorecardView').then((m) => ({
      default: m.SPOScorecardView,
    })),
  { ssr: false },
);

/**
 * Unified Scorecard — adapts to DRep or SPO based on segment.
 *
 * For dual-role users, the `role` query param selects which scorecard to show.
 * Includes: pillar breakdown, tier progression, competitive rank, delegator summary.
 */
export function ScorecardClient() {
  const { segment, drepId, poolId } = useSegment();
  const searchParams = useSearchParams();
  const roleParam = searchParams.get('role');

  const hasDrep = segment === 'drep' || !!drepId;
  const hasSpo = segment === 'spo' || !!poolId;
  const isDualRole = hasDrep && hasSpo;

  // Determine which scorecard to show
  const showDrep = isDualRole ? roleParam !== 'spo' : hasDrep;
  const showSpo = isDualRole ? roleParam === 'spo' : hasSpo;

  return (
    <div className="mx-auto max-w-2xl px-4 sm:px-6 py-8">
      <PageViewTracker
        event="you_scorecard_viewed"
        properties={{ role: showDrep ? 'drep' : 'spo' }}
      />
      {showDrep && <DRepScorecardView />}
      {showSpo && !showDrep && <SPOScorecardView />}
      {!showDrep && !showSpo && (
        <div className="text-center text-muted-foreground py-16">
          <p>Connect as a DRep or SPO to see your governance scorecard.</p>
        </div>
      )}
    </div>
  );
}
