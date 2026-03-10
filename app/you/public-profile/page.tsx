export const dynamic = 'force-dynamic';

import type { Metadata } from 'next';
import { PublicProfileView } from '@/components/hub/PublicProfileView';

export const metadata: Metadata = {
  title: 'Governada — Public Profile',
  description: 'See how delegators view your governance profile and find ways to improve it.',
};

/**
 * /you/public-profile — DRep/SPO only.
 * Shows how your public governance profile appears to delegators,
 * with actionable tips to improve profile completeness.
 */
export default function PublicProfilePage() {
  return (
    <div className="container mx-auto px-4 sm:px-6 py-6">
      <PublicProfileView />
    </div>
  );
}
