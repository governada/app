import type { Metadata } from 'next';
import { MatchExperienceClient } from './MatchExperienceClient';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Governance Match - Governada',
  description:
    'Find your Cardano governance identity and discover the DReps and SPOs that align with your values.',
  openGraph: {
    title: 'Governance Match - Governada',
    description:
      'Find your Cardano governance identity and discover the DReps and SPOs that align with your values.',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Governance Match - Governada',
    description: 'Discover your Cardano governance identity with Governada.',
  },
};

export default function MatchPage() {
  return <MatchExperienceClient />;
}
