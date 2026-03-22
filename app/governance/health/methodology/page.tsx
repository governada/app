export const dynamic = 'force-dynamic';

import type { Metadata } from 'next';
import { PageViewTracker } from '@/components/PageViewTracker';
import { GHIMethodology } from '@/components/governada/methodology/GHIMethodology';
import { CALIBRATION_VERSION } from '@/lib/scoring/calibration';

export const metadata: Metadata = {
  title: 'Governada — GHI Methodology',
  description:
    'How the Governance Health Index is calculated. Full methodology, component weights, calibration curves, and scoring rubric — published for public scrutiny.',
  openGraph: {
    title: 'Governada — GHI Methodology',
    description: 'Complete, transparent scoring methodology for the Governance Health Index.',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Governada — GHI Methodology',
    description: 'Complete, transparent scoring methodology for the Governance Health Index.',
  },
};

export default function MethodologyPage() {
  return (
    <>
      <PageViewTracker event="page_viewed_ghi_methodology" />
      <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
        <GHIMethodology version={CALIBRATION_VERSION} />
      </div>
    </>
  );
}
