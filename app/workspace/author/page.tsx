import type { Metadata } from 'next';
import { PageViewTracker } from '@/components/PageViewTracker';
import { AuthorWorkspace } from '@/components/workspace/author/AuthorWorkspace';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Proposal Author — Governada',
  description:
    'Draft governance proposals, run constitutional checks, and preview CIP-108 metadata.',
};

export default function AuthorPage() {
  return (
    <>
      <PageViewTracker event="author_workspace_viewed" />
      <AuthorWorkspace />
    </>
  );
}
