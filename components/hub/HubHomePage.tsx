'use client';

import { useSegment } from '@/components/providers/SegmentProvider';
import { AnonymousLanding } from './AnonymousLanding';
import { HubCardSkeleton } from './cards/HubCard';
import { SynapticHomePage } from '@/components/synaptic/SynapticHomePage';

interface PulseData {
  activeProposals: number;
  activeDReps: number;
  totalDReps: number;
  totalDelegators: number;
}

interface HubHomePageProps {
  pulseData: PulseData;
}

/**
 * HubHomePage — The home page dispatcher.
 *
 * Anonymous: Clean conversion landing page with globe + social proof.
 * All authenticated: Synaptic Brief — full-viewport constellation with
 * Seneca AI briefing panel.
 */
export function HubHomePage({ pulseData }: HubHomePageProps) {
  const { segment, isLoading } = useSegment();

  if (isLoading) {
    return (
      <div className="mx-auto w-full max-w-2xl space-y-3 px-[var(--space-md)] py-[var(--space-lg)]">
        <HubCardSkeleton />
        <HubCardSkeleton />
        <HubCardSkeleton />
        <HubCardSkeleton />
      </div>
    );
  }

  if (segment === 'anonymous') {
    return <AnonymousLanding pulseData={pulseData} />;
  }

  // All authenticated personas: Synaptic Brief
  return <SynapticHomePage />;
}
