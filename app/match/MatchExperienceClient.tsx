'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Compass, ShieldCheck, Sparkles } from 'lucide-react';
import { PageViewTracker } from '@/components/PageViewTracker';
import { SenecaMatch } from '@/components/governada/panel/SenecaMatch';

const MATCH_TRAITS = [
  '7 signal questions',
  'No wallet required',
  'Public DRep evidence',
  'Refine later with live votes',
] as const;

export function MatchExperienceClient() {
  const router = useRouter();

  return (
    <>
      <PageViewTracker event="match_page_viewed" />
      <section className="relative px-4 py-8 sm:px-6 lg:px-8">
        <div className="mx-auto grid max-w-6xl gap-8 lg:min-h-[calc(100vh-12rem)] lg:grid-cols-[minmax(0,1.1fr)_minmax(360px,420px)] lg:items-center">
          <div className="space-y-6">
            <div className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.24em] text-primary/90">
              <Compass className="h-3.5 w-3.5" />
              Governance Match
            </div>

            <div className="space-y-4">
              <h1 className="max-w-3xl font-fraunces text-4xl font-semibold tracking-tight text-foreground sm:text-5xl lg:text-6xl">
                Find the Cardano representatives who actually match how you govern.
              </h1>
              <p className="max-w-2xl text-base leading-7 text-muted-foreground sm:text-lg">
                This route is now a dedicated public match flow, not a hidden homepage mode. The
                founder-critical path is a focused quiz surface with direct progression into the
                first question, clear evidence expectations, and no dependency on the heavyweight
                globe entry shell.
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              {MATCH_TRAITS.map((trait) => (
                <div
                  key={trait}
                  className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-foreground/85 shadow-[0_18px_50px_-28px_rgba(15,23,42,0.9)]"
                >
                  {trait}
                </div>
              ))}
            </div>

            <div className="rounded-3xl border border-emerald-400/20 bg-emerald-400/10 p-5 shadow-[0_24px_90px_-40px_rgba(16,185,129,0.45)]">
              <div className="flex items-start gap-3">
                <ShieldCheck className="mt-0.5 h-5 w-5 text-emerald-300" />
                <div className="space-y-2">
                  <p className="text-sm font-semibold text-emerald-100">Why this route exists</p>
                  <p className="text-sm leading-6 text-emerald-50/85">
                    Quick Match should be a durable public journey on its own. It now starts with
                    the quiz card directly so visitors can answer, progress, and inspect the
                    resulting DRep evidence without first depending on the full homepage globe
                    experience.
                  </p>
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3 text-sm">
              <Link
                href="/?filter=dreps"
                className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-foreground/85 transition-colors hover:bg-white/10"
              >
                Browse DReps first
              </Link>
              <Link
                href="/help/methodology"
                className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-transparent px-4 py-2 text-muted-foreground transition-colors hover:border-white/20 hover:text-foreground"
              >
                Review methodology
              </Link>
            </div>
          </div>

          <div className="relative">
            <div className="absolute inset-0 rounded-[2rem] bg-gradient-to-br from-primary/20 via-cyan-400/10 to-transparent blur-3xl" />
            <div className="relative overflow-hidden rounded-[2rem] border border-white/10 bg-black/55 shadow-[0_36px_120px_-54px_rgba(14,165,233,0.55)] backdrop-blur-2xl">
              <div className="flex items-center gap-2 border-b border-white/10 px-4 py-3 text-xs uppercase tracking-[0.24em] text-muted-foreground">
                <Sparkles className="h-3.5 w-3.5 text-primary/80" />
                Match Console
              </div>
              <div className="min-h-[640px] p-2">
                <SenecaMatch onBack={() => router.push('/')} />
              </div>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
