import { Skeleton } from '@/components/ui/skeleton';

export default function DraftEditorLoading() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-6 space-y-6">
      <div className="flex items-center gap-3">
        <Skeleton className="h-8 w-8 rounded" />
        <Skeleton className="h-7 w-64" />
        <Skeleton className="h-5 w-24 rounded-full" />
      </div>
      <div className="flex flex-col lg:flex-row gap-6">
        <div className="flex-1 space-y-5">
          <Skeleton className="h-10 w-full rounded-md" />
          <Skeleton className="h-24 w-full rounded-md" />
          <Skeleton className="h-48 w-full rounded-md" />
          <Skeleton className="h-48 w-full rounded-md" />
        </div>
        <div className="w-full lg:w-80 space-y-4">
          <Skeleton className="h-48 w-full rounded-xl" />
          <Skeleton className="h-64 w-full rounded-xl" />
        </div>
      </div>
    </div>
  );
}
