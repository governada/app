import type { Metadata } from 'next';
import Link from 'next/link';
import { HomePageShell } from '@/components/hub/HomePageShell';

// Keep /match on the request lifecycle so nonce-aware scripts still receive the
// live request headers under the repo CSP policy.
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
  return (
    <>
      <section className="pointer-events-none fixed inset-x-0 top-24 z-30 flex justify-center px-4">
        <div className="pointer-events-auto w-full max-w-xl rounded-3xl border border-white/10 bg-black/70 p-6 text-white shadow-2xl shadow-black/40 backdrop-blur-xl">
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-primary/80">
            Quick Match
          </p>
          <h1 className="mt-3 font-fraunces text-3xl font-semibold tracking-tight text-white">
            Find Your Match
          </h1>
          <p className="mt-3 max-w-lg text-sm leading-6 text-white/72">
            Use the governance globe to explore the field, then launch the matching flow when the
            client runtime is ready. If you want a faster start, jump straight into DRep discovery.
          </p>
          <div className="mt-5 flex flex-wrap gap-3">
            <Link
              href="/?match=true"
              className="inline-flex min-h-11 items-center justify-center rounded-full bg-primary px-5 py-2 text-sm font-semibold text-black transition-colors hover:bg-primary/90"
            >
              Start Match
            </Link>
            <Link
              href="/?filter=dreps"
              className="inline-flex min-h-11 items-center justify-center rounded-full border border-white/15 px-5 py-2 text-sm font-semibold text-white/88 transition-colors hover:border-white/25 hover:bg-white/5"
            >
              Browse DReps
            </Link>
          </div>
        </div>
      </section>
      <HomePageShell match pageViewEvent="match_page_viewed" />
    </>
  );
}
