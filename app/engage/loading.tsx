import { Skeleton } from '@/components/ui/skeleton';

export default function EngageLoading() {
  return (
    <div className="container mx-auto px-4 py-8 space-y-8">
      {/* Title */}
      <div className="space-y-2">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-5 w-96" />
      </div>
      {/* Engagement Hero */}
      <div className="rounded-xl border border-border p-5 flex items-center gap-5">
        <Skeleton className="h-[72px] w-[72px] rounded-full shrink-0" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-5 w-32" />
          <Skeleton className="h-4 w-48" />
          <Skeleton className="h-3 w-36" />
        </div>
      </div>
      {/* Epoch Recap */}
      <Skeleton className="h-32 w-full rounded-xl" />
      {/* Assembly */}
      <Skeleton className="h-48 w-full rounded-xl" />
      {/* Priority signals */}
      <div className="space-y-4">
        <Skeleton className="h-6 w-40" />
        <Skeleton className="h-64 w-full rounded-xl" />
      </div>
      {/* Citizen Voice */}
      <Skeleton className="h-48 w-full rounded-xl" />
    </div>
  );
}
