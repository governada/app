import type { Metadata } from 'next';
import { headers } from 'next/headers';
import Script from 'next/script';
import { PageViewTracker } from '@/components/PageViewTracker';
import { HubHomePage } from '@/components/hub/HubHomePage';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Governada — Cardano Governance Intelligence',
  description:
    'Cardano has a government. Know who represents you. Build your governance team, track proposals, and participate in on-chain democracy.',
  openGraph: {
    title: 'Governada — Cardano Governance Intelligence',
    description:
      'Know who represents your ADA in Cardano governance. Build your governance team, track proposals, and take action.',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Governada — Cardano Governance Intelligence',
    description: 'Cardano has a government. Know who represents you.',
  },
};

interface HomePageProps {
  searchParams: Promise<{ filter?: string; entity?: string; match?: string; sort?: string }>;
}

export default async function HomePage({ searchParams }: HomePageProps) {
  const [params, headerStore] = await Promise.all([searchParams, headers()]);
  const nonce = headerStore.get('x-nonce') ?? undefined;

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'WebApplication',
    name: 'Governada',
    url: 'https://governada.io',
    description:
      'Governance intelligence for Cardano. Build your governance team, track proposals, and participate in on-chain democracy.',
    applicationCategory: 'GovernanceApplication',
    operatingSystem: 'Web',
    offers: {
      '@type': 'Offer',
      price: '0',
      priceCurrency: 'USD',
    },
    publisher: {
      '@type': 'Organization',
      name: 'Governada',
      url: 'https://governada.io',
    },
  };

  return (
    <>
      <Script
        id="json-ld-organization"
        nonce={nonce}
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <PageViewTracker event="homepage_viewed" />
      <HubHomePage
        filter={params.filter}
        entity={params.entity}
        match={params.match === 'true'}
        sort={params.sort}
      />
    </>
  );
}
