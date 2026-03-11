'use client';

import Link from 'next/link';
import { ArrowRight, Users, Server } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ConstellationScene } from '@/components/ConstellationScene';

interface AnonymousLandingProps {
  pulseData?: {
    totalAdaGoverned: string;
    activeProposals: number;
    activeDReps: number;
    activeSpOs: number;
  };
}

/**
 * Anonymous Landing — Clean conversion page.
 *
 * Radical simplicity. One value prop, one visual, two CTAs.
 * Passes the 5-second test: "This helps me participate in Cardano governance."
 *
 * Two-path entry: Find your DRep OR Find your Stake Pool.
 * Both go to Quick Match with the appropriate tab pre-selected.
 */
export function AnonymousLanding({ pulseData }: AnonymousLandingProps) {
  return (
    <div className="relative flex flex-col min-h-[calc(100vh-4rem)]">
      {/* Constellation hero */}
      <section className="relative flex-1 min-h-[50vh] sm:-mt-14 overflow-hidden flex items-center justify-center">
        <div className="absolute inset-0">
          <ConstellationScene className="w-full h-full" interactive={false} />
        </div>

        {/* Gradient fade */}
        <div className="absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-background to-transparent pointer-events-none" />

        {/* Hero content */}
        <div className="relative z-10 text-center max-w-lg px-6 sm:pt-14">
          <h1 className="font-display text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight text-white leading-tight hero-text-shadow">
            Your ADA gives you
            <br />
            <span className="text-primary">a voice.</span>
          </h1>
          <p
            className="mt-4 text-lg sm:text-xl text-white/90 font-medium"
            style={{
              textShadow: '0 2px 12px rgba(0,0,0,0.8), 0 0 40px rgba(0,0,0,0.5)',
            }}
          >
            It takes 60 seconds to use it.
          </p>
        </div>
      </section>

      {/* CTAs + social proof */}
      <section className="relative z-10 mx-auto w-full max-w-lg px-6 -mt-8 pb-12 space-y-6">
        {/* Two CTAs — DRep and Stake Pool paths */}
        <div className="flex flex-col sm:flex-row gap-3">
          <Button asChild size="lg" className="flex-1 gap-2">
            <Link href="/match?tab=drep">
              <Users className="h-4 w-4" />
              Find Your Representative
              <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
          <Button asChild variant="outline" size="lg" className="flex-1 gap-2">
            <Link href="/match?tab=spo">
              <Server className="h-4 w-4" />
              Find Your Stake Pool
              <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
        </div>

        {/* Social proof — framed as liveness, not raw metrics */}
        {pulseData && (
          <div className="flex items-center justify-center gap-4 text-xs text-muted-foreground">
            <span>
              <strong className="text-foreground">{pulseData.activeDReps}</strong> active
              representatives
            </span>
            <span className="text-border">|</span>
            <span>
              <strong className="text-foreground">{pulseData.activeProposals}</strong> proposals
              being voted on
            </span>
          </div>
        )}

        {/* Secondary discovery link */}
        <div className="flex justify-center">
          <Link
            href="/governance/health"
            className="text-xs text-muted-foreground/70 hover:text-primary transition-colors"
          >
            Is Cardano governance healthy? &rarr;
          </Link>
        </div>
      </section>
    </div>
  );
}
