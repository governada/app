'use client';

import { useRouter } from 'next/navigation';
import { Skeleton } from '@/components/ui/skeleton';
import { WorkspaceEditorShell } from '@/components/workspace/editor/WorkspaceEditorShell';
import { useWorkspaceEditorController } from '../_hooks/useWorkspaceEditorController';

function WorkspaceEditorLoadingState() {
  return (
    <div className="flex flex-col h-screen">
      <div className="h-12 border-t-2 border-teal-500 border-b border-b-border bg-background px-4 flex items-center shrink-0">
        <Skeleton className="h-5 w-24" />
        <div className="flex-1" />
        <Skeleton className="h-5 w-32" />
      </div>
      <div className="flex-1 flex items-start justify-center pt-12">
        <div className="max-w-3xl w-full px-6 space-y-4">
          <Skeleton className="h-8 w-2/3" />
          <Skeleton className="h-32 w-full rounded-xl" />
          <Skeleton className="h-24 w-full rounded-xl" />
          <Skeleton className="h-36 w-full rounded-xl" />
        </div>
      </div>
      <div className="h-12 border-t border-border bg-background shrink-0" />
    </div>
  );
}

function WorkspaceEditorErrorState() {
  const router = useRouter();

  return (
    <div className="flex items-center justify-center h-screen">
      <div className="text-center space-y-3">
        <h1 className="text-lg font-semibold">Draft not found</h1>
        <button
          onClick={() => router.push('/workspace/author')}
          className="text-sm text-primary hover:underline cursor-pointer"
        >
          Back to Author
        </button>
      </div>
    </div>
  );
}

export default function WorkspaceEditorPage() {
  const controller = useWorkspaceEditorController();

  if (controller.isLoading) return <WorkspaceEditorLoadingState />;
  if (controller.error || !controller.draft) return <WorkspaceEditorErrorState />;
  return <WorkspaceEditorShell controller={controller} />;
}

