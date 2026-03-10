import { Skeleton } from '@/components/ui/skeleton';

export default function GovernanceLoading() {
  return (
    <div className="container mx-auto px-4 sm:px-6 py-6 space-y-6">
      <Skeleton className="h-8 w-48" />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <Skeleton key={i} className="h-32 w-full rounded-xl" />
        ))}
      </div>
    </div>
  );
}
