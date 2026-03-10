'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useSegment } from '@/components/providers/SegmentProvider';
import { Skeleton } from '@/components/ui/skeleton';

/**
 * Persona-aware redirect for /governance.
 *
 * Routes users to the most relevant governance sub-page based on their role:
 * - Anonymous            -> /governance/proposals  (universal entry point)
 * - Citizen (undelegated)-> /governance/representatives (help them find a DRep)
 * - Citizen (delegated)  -> /governance/proposals  (track what matters)
 * - DRep                 -> /governance/proposals  (their core workflow)
 * - SPO                  -> /governance/pools       (their peer view)
 * - CC                   -> /governance/proposals  (committee context)
 */
function getDestination(segment: string, delegatedDrep: string | null): string {
  if (segment === 'citizen' && !delegatedDrep) return '/governance/representatives';
  if (segment === 'spo') return '/governance/pools';
  return '/governance/proposals';
}

export function GovernanceRedirect() {
  const router = useRouter();
  const { segment, delegatedDrep, isLoading } = useSegment();

  useEffect(() => {
    if (isLoading) return;
    router.replace(getDestination(segment, delegatedDrep));
  }, [segment, delegatedDrep, isLoading, router]);

  // When segment is already resolved (cached in sessionStorage), isLoading is false
  // on the first render — skip showing the skeleton to avoid a flash.
  if (!isLoading) return null;

  return (
    <div className="container mx-auto px-4 sm:px-6 py-6">
      <div className="space-y-4">
        <Skeleton className="h-8 w-48" />
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-24 w-full rounded-xl" />
          ))}
        </div>
      </div>
    </div>
  );
}
