export const dynamic = 'force-dynamic';

import { Suspense } from 'react';
import type { Metadata } from 'next';
import { PageViewTracker } from '@/components/PageViewTracker';
import { ObservatoryLayout } from '@/components/observatory/ObservatoryLayout';
import { ObservatoryErrorBoundary } from '@/components/observatory/ObservatoryErrorBoundary';
import { Skeleton } from '@/components/ui/skeleton';
import { AdvisorPanel } from '@/components/governada/shared/AdvisorPanel';

export const metadata: Metadata = {
  title: 'Governada — Governance Observatory',
  description:
    'Live mission control for Cardano governance — treasury flows, constitutional committee, and governance health in one unified view.',
  openGraph: {
    title: 'Governada — Governance Observatory',
    description:
      'Watch treasury money flow, constitutional guardians deliberate, and governance health pulse — all synchronized in real-time.',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Governada — Governance Observatory',
    description: 'Mission control for Cardano governance.',
  },
};

function ObservatoryFallback() {
  return (
    <div className="space-y-3 px-4 py-3">
      {/* Playback bar skeleton */}
      <div className="rounded-xl border border-border/20 bg-card/40 backdrop-blur-md px-4 py-2 flex items-center gap-3">
        <Skeleton className="h-8 w-8 rounded-full" />
        <Skeleton className="h-3 w-16" />
        <Skeleton className="h-1 flex-1 rounded-full" />
        <Skeleton className="h-4 w-20" />
        <Skeleton className="h-5 w-12 rounded-full" />
      </div>

      {/* Narrative skeleton */}
      <div className="rounded-xl border border-border/20 bg-card/40 backdrop-blur-md px-4 py-3">
        <Skeleton className="h-3.5 w-full" />
        <Skeleton className="h-3.5 w-3/4 mt-1.5" />
      </div>

      {/* Three panels skeleton */}
      <div className="hidden md:grid md:grid-cols-3 gap-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div
            key={i}
            className="rounded-xl border border-border/30 bg-card/60 backdrop-blur-md p-3 space-y-3"
          >
            <div className="flex items-center gap-1.5">
              <Skeleton className="h-3.5 w-3.5 rounded" />
              <Skeleton className="h-3 w-16" />
            </div>
            <Skeleton className="h-[200px] w-full rounded-lg" />
            <Skeleton className="h-3 w-24" />
          </div>
        ))}
      </div>

      {/* Mobile single panel skeleton */}
      <div className="md:hidden">
        <div className="flex justify-center gap-1.5 py-2">
          <Skeleton className="h-1.5 w-1.5 rounded-full" />
          <Skeleton className="h-1.5 w-1.5 rounded-full" />
          <Skeleton className="h-1.5 w-1.5 rounded-full" />
        </div>
        <div className="rounded-xl border border-border/30 bg-card/60 backdrop-blur-md p-3 space-y-3">
          <Skeleton className="h-3.5 w-20" />
          <Skeleton className="h-[240px] w-full rounded-lg" />
        </div>
      </div>
    </div>
  );
}

export default function ObservatoryPage() {
  return (
    <>
      <PageViewTracker event="governance_observatory_viewed" />
      <div className="container mx-auto space-y-0">
        <ObservatoryErrorBoundary>
          <Suspense fallback={<ObservatoryFallback />}>
            <ObservatoryLayout />
          </Suspense>
        </ObservatoryErrorBoundary>
        <div className="px-4 pb-6">
          <AdvisorPanel />
        </div>
      </div>
    </>
  );
}
