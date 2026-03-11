'use client';

import { useSegment } from '@/components/providers/SegmentProvider';
import { HubCardRenderer } from './HubCardRenderer';
import { AnonymousLanding } from './AnonymousLanding';
import { HubCardSkeleton } from './cards/HubCard';
import { ConstellationScene } from '@/components/ConstellationScene';

interface PulseData {
  totalAdaGoverned: string;
  activeProposals: number;
  activeDReps: number;
  totalDReps: number;
  votesThisWeek: number;
  claimedDReps: number;
  activeSpOs: number;
  ccMembers: number;
}

interface HubHomePageProps {
  pulseData: PulseData;
}

/**
 * HubHomePage — The home page dispatcher.
 *
 * Anonymous: Clean conversion landing page.
 * Authenticated: Hub cards over a subtle constellation globe background.
 */
export function HubHomePage({ pulseData }: HubHomePageProps) {
  const { segment, isLoading } = useSegment();

  // While detecting segment, show skeleton cards to prevent CLS flash
  if (isLoading) {
    return (
      <div className="mx-auto w-full max-w-2xl space-y-3 px-4 py-6">
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

  // Authenticated homepage — globe background with glassmorphic cards
  return (
    <div className="relative min-h-[calc(100vh-4rem)]">
      {/* Globe extends to top-0 so it shows through the transparent header.
          lg:left-60 offsets past the sidebar (visible from lg breakpoint). */}
      <div className="fixed inset-0 lg:left-60 pointer-events-none opacity-25">
        <ConstellationScene className="w-full h-full" interactive={false} />
      </div>
      <div className="relative z-10">
        <HubCardRenderer persona={segment} />
      </div>
    </div>
  );
}
