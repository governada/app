import type { Metadata } from 'next';
import { PageViewTracker } from '@/components/PageViewTracker';
import { WorkspaceVotesPage } from '@/components/hub/WorkspaceVotesPage';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Voting Record — Governada',
  description: 'Your complete voting record with rationale status.',
};

/**
 * You/Record — Voting history + rationale coverage.
 *
 * Same view citizens see on your public profile, plus "add rationale" CTAs.
 * This is your public record from your own perspective.
 */
export default function RecordPage() {
  return (
    <>
      <PageViewTracker event="you_record_viewed" />
      <WorkspaceVotesPage />
    </>
  );
}
