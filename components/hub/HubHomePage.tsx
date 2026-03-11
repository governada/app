'use client';

import { useSearchParams } from 'next/navigation';
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
 * HubHomePage — The new home page dispatcher.
 *
 * Anonymous: Clean conversion landing page.
 * Authenticated: Hub card renderer based on persona.
 *
 * Background exploration: use ?bg=globe or ?bg=gradient to compare styles.
 * Remove the exploration code once a decision is made.
 */
export function HubHomePage({ pulseData }: HubHomePageProps) {
  const { segment, isLoading } = useSegment();
  const searchParams = useSearchParams();
  const bgMode = searchParams.get('bg');

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

  // Authenticated homepage — optional background exploration
  if (bgMode === 'globe') {
    return (
      <div className="relative min-h-[calc(100vh-4rem)]">
        {/* Subtle globe behind cards */}
        <div className="fixed inset-0 top-14 pointer-events-none opacity-25">
          <ConstellationScene className="w-full h-full" interactive={false} />
        </div>
        <div className="relative z-10">
          <HubCardRenderer persona={segment} />
        </div>
      </div>
    );
  }

  if (bgMode === 'gradient') {
    return (
      <div className="relative min-h-[calc(100vh-4rem)]">
        {/* Ambient aurora gradient */}
        <div className="fixed inset-0 top-14 pointer-events-none overflow-hidden">
          <div className="absolute -top-1/2 -left-1/2 w-[200%] h-[200%] animate-[spin_120s_linear_infinite]">
            <div className="absolute top-1/4 left-1/4 w-96 h-96 rounded-full bg-primary/20 blur-[120px]" />
            <div className="absolute top-1/3 right-1/4 w-80 h-80 rounded-full bg-emerald-500/15 blur-[100px]" />
            <div className="absolute bottom-1/4 left-1/3 w-72 h-72 rounded-full bg-violet-500/12 blur-[100px]" />
          </div>
        </div>
        <div className="relative z-10">
          <HubCardRenderer persona={segment} />
        </div>
      </div>
    );
  }

  // Default — no background (current behavior)
  return <HubCardRenderer persona={segment} />;
}
