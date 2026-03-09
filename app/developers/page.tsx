import type { Metadata } from 'next';
import { DeveloperPage } from '@/components/DeveloperPage';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Developers — Governada API',
  description:
    'Build on governance intelligence. Interactive API explorer, embeddable widgets, and documentation for the Governada v1 API.',
  openGraph: {
    title: 'Governada Developer Platform',
    description:
      'Build on governance intelligence. API explorer, embeddable widgets, and documentation.',
  },
};

export default function DevelopersPage() {
  return <DeveloperPage />;
}
