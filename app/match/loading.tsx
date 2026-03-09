import { Skeleton } from '@/components/ui/skeleton';

export default function MatchLoading() {
  return (
    <div className="container mx-auto px-4 py-8 space-y-8 max-w-3xl">
      {/* Title + subtitle */}
      <div className="text-center space-y-2">
        <Skeleton className="h-8 w-56 mx-auto" />
        <Skeleton className="h-5 w-80 mx-auto" />
      </div>
      {/* Question card */}
      <div className="rounded-xl border bg-card p-8 space-y-6">
        <Skeleton className="h-6 w-3/4 mx-auto" />
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-12 w-full rounded-lg" />
          ))}
        </div>
        <Skeleton className="h-10 w-32 mx-auto" />
      </div>
    </div>
  );
}
