import { Skeleton } from '@/components/ui/skeleton';

export default function EngageLoading() {
  return (
    <div className="container mx-auto px-4 py-8 space-y-8">
      {/* Title */}
      <div className="space-y-2">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-5 w-96" />
      </div>
      {/* Credibility banner */}
      <Skeleton className="h-16 w-full rounded-xl" />
      {/* Priority signals grid */}
      <div className="space-y-4">
        <Skeleton className="h-6 w-40" />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-32 rounded-xl" />
          ))}
        </div>
      </div>
      {/* Assembly section */}
      <Skeleton className="h-64 w-full rounded-xl" />
    </div>
  );
}
