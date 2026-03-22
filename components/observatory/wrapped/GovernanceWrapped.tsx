'use client';

/**
 * GovernanceWrapped — Spotify Wrapped-style governance epoch recap.
 *
 * Generates a series of shareable slides summarizing an epoch's governance
 * activity across Treasury, Committee, and Health. Personal stats when
 * wallet is connected.
 */

import { useState, useCallback, useRef } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { Share2, ChevronRight, ChevronLeft, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useQuery } from '@tanstack/react-query';

interface GovernanceWrappedProps {
  epoch: number;
  onClose: () => void;
}

interface WrappedData {
  epoch: number;
  treasury: {
    totalDisbursedAda: number;
    proposalsEnacted: number;
    effectivenessRate: number;
    topCategory: string;
  };
  committee: {
    proposalsReviewed: number;
    agreementPct: number;
    notableDissenter: string | null;
    unanimousCount: number;
  };
  health: {
    ghiStart: number;
    ghiEnd: number;
    strongestComponent: string;
    weakestComponent: string;
  };
  personal?: {
    votesCount: number;
    drepAlignmentPct: number;
    treasuryShareAda: number;
    engagementRank: string;
  };
}

const SLIDE_COUNT = 6;

export function GovernanceWrapped({ epoch, onClose }: GovernanceWrappedProps) {
  const [slideIndex, setSlideIndex] = useState(0);
  const prefersReducedMotion = useReducedMotion();
  const containerRef = useRef<HTMLDivElement>(null);

  const { data, isLoading } = useQuery<WrappedData>({
    queryKey: ['governance-wrapped', epoch],
    queryFn: async () => {
      const res = await fetch(`/api/observatory/wrapped?epoch=${epoch}`);
      if (!res.ok) throw new Error(`${res.status}`);
      return res.json();
    },
    staleTime: Infinity, // Epoch data doesn't change
  });

  const nextSlide = useCallback(() => {
    setSlideIndex((prev) => Math.min(prev + 1, SLIDE_COUNT - 1));
  }, []);

  const prevSlide = useCallback(() => {
    setSlideIndex((prev) => Math.max(prev - 1, 0));
  }, []);

  const handleShare = useCallback(async () => {
    if (!containerRef.current) return;

    try {
      // Use canvas API to capture the slide
      const el = containerRef.current;
      const canvas = document.createElement('canvas');
      const rect = el.getBoundingClientRect();
      canvas.width = rect.width * 2;
      canvas.height = rect.height * 2;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      // Draw a dark background + simplified capture
      ctx.fillStyle = '#0a0a12';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Use SVG foreign object approach for capturing HTML
      const svgData = `<svg xmlns="http://www.w3.org/2000/svg" width="${canvas.width}" height="${canvas.height}">
        <foreignObject width="100%" height="100%">
          <div xmlns="http://www.w3.org/1999/xhtml" style="transform: scale(2); transform-origin: top left;">
            ${el.outerHTML}
          </div>
        </foreignObject>
      </svg>`;
      const svgBlob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' });
      const url = URL.createObjectURL(svgBlob);
      const img = new Image();
      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve();
        img.onerror = reject;
        img.src = url;
      });
      ctx.drawImage(img, 0, 0);
      URL.revokeObjectURL(url);

      const blob = await new Promise<Blob>((resolve) =>
        canvas.toBlob((b: Blob | null) => resolve(b!), 'image/png'),
      );

      if (navigator.share) {
        await navigator.share({
          title: `Governance Wrapped — Epoch ${epoch}`,
          text: `My Cardano governance recap for Epoch ${epoch}`,
          files: [new File([blob], `governance-wrapped-${epoch}.png`, { type: 'image/png' })],
        });
      } else {
        // Fallback: download
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `governance-wrapped-${epoch}.png`;
        a.click();
        URL.revokeObjectURL(url);
      }
    } catch {
      // Silently fail — sharing is optional
    }
  }, [epoch]);

  const formatAda = (ada: number) =>
    new Intl.NumberFormat('en', { notation: 'compact', maximumFractionDigits: 1 }).format(ada);

  if (isLoading || !data) {
    return (
      <div className="fixed inset-0 z-50 bg-background/95 backdrop-blur-xl flex items-center justify-center">
        <div className="text-center space-y-3">
          <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-sm text-muted-foreground">Generating your Wrapped...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 bg-background/98 backdrop-blur-xl flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border/20">
        <span className="text-sm font-semibold text-muted-foreground">Governance Wrapped</span>
        <button
          onClick={onClose}
          className="w-8 h-8 rounded-full hover:bg-muted/50 flex items-center justify-center transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Slide area */}
      <div className="flex-1 flex items-center justify-center px-4 py-8">
        <div
          ref={containerRef}
          className="w-full max-w-sm aspect-[9/16] rounded-2xl overflow-hidden relative"
        >
          <AnimatePresence mode="wait">
            <motion.div
              key={slideIndex}
              className="absolute inset-0"
              initial={prefersReducedMotion ? undefined : { opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={prefersReducedMotion ? undefined : { opacity: 0, scale: 1.05 }}
              transition={{ duration: 0.3 }}
            >
              {slideIndex === 0 && <TitleSlide epoch={data.epoch} />}
              {slideIndex === 1 && <TreasurySlide data={data.treasury} formatAda={formatAda} />}
              {slideIndex === 2 && <CommitteeSlide data={data.committee} />}
              {slideIndex === 3 && <HealthSlide data={data.health} />}
              {slideIndex === 4 && (
                <PersonalSlide data={data.personal} epoch={data.epoch} formatAda={formatAda} />
              )}
              {slideIndex === 5 && <ShareSlide epoch={data.epoch} />}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>

      {/* Navigation */}
      <div className="flex items-center justify-between px-4 py-3 border-t border-border/20">
        <button
          onClick={prevSlide}
          disabled={slideIndex === 0}
          className="w-10 h-10 rounded-full hover:bg-muted/50 flex items-center justify-center transition-colors disabled:opacity-30"
        >
          <ChevronLeft className="w-5 h-5" />
        </button>

        {/* Dots */}
        <div className="flex gap-1.5">
          {Array.from({ length: SLIDE_COUNT }).map((_, i) => (
            <button
              key={i}
              onClick={() => setSlideIndex(i)}
              className={cn(
                'w-1.5 h-1.5 rounded-full transition-colors',
                i === slideIndex ? 'bg-primary' : 'bg-muted-foreground/20',
              )}
            />
          ))}
        </div>

        {slideIndex < SLIDE_COUNT - 1 ? (
          <button
            onClick={nextSlide}
            className="w-10 h-10 rounded-full hover:bg-muted/50 flex items-center justify-center transition-colors"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        ) : (
          <button
            onClick={handleShare}
            className="flex items-center gap-1.5 px-3 py-2 rounded-full bg-primary/15 hover:bg-primary/25 text-primary text-sm font-medium transition-colors"
          >
            <Share2 className="w-3.5 h-3.5" />
            Share
          </button>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Individual Slides
// ---------------------------------------------------------------------------

function TitleSlide({ epoch }: { epoch: number }) {
  return (
    <div className="h-full bg-gradient-to-br from-[oklch(0.15_0.03_260)] via-[oklch(0.12_0.02_280)] to-[oklch(0.10_0.015_300)] flex flex-col items-center justify-center p-8 text-center">
      <motion.p
        className="text-xs font-semibold tracking-[0.3em] uppercase text-primary/60 mb-4"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
      >
        Governance Wrapped
      </motion.p>
      <motion.h1
        className="text-5xl font-bold tracking-tight"
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 0.4, type: 'spring', stiffness: 200 }}
      >
        Epoch {epoch}
      </motion.h1>
      <motion.p
        className="text-sm text-muted-foreground mt-3"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.7 }}
      >
        The Recap
      </motion.p>
      <motion.div
        className="mt-8 text-[10px] text-muted-foreground/40 font-medium"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1 }}
      >
        governada.io
      </motion.div>
    </div>
  );
}

function TreasurySlide({
  data,
  formatAda,
}: {
  data: WrappedData['treasury'];
  formatAda: (n: number) => string;
}) {
  return (
    <div className="h-full bg-gradient-to-br from-amber-950/30 via-[oklch(0.12_0.02_75)] to-[oklch(0.10_0.015_60)] flex flex-col items-center justify-center p-8 text-center">
      <p className="text-xs font-semibold tracking-[0.2em] uppercase text-amber-400/60 mb-6">
        The Treasury
      </p>
      <motion.p
        className="text-4xl font-bold text-amber-300"
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 0.3, type: 'spring' }}
      >
        {formatAda(data.totalDisbursedAda)} ADA
      </motion.p>
      <p className="text-sm text-muted-foreground mt-2">disbursed this epoch</p>

      <div className="mt-8 space-y-3 w-full">
        <StatRow label="Proposals enacted" value={String(data.proposalsEnacted)} delay={0.5} />
        <StatRow
          label="Delivery rate"
          value={`${Math.round(data.effectivenessRate)}%`}
          delay={0.6}
        />
        <StatRow label="Top category" value={data.topCategory} delay={0.7} />
      </div>
    </div>
  );
}

function CommitteeSlide({ data }: { data: WrappedData['committee'] }) {
  return (
    <div className="h-full bg-gradient-to-br from-violet-950/30 via-[oklch(0.12_0.02_295)] to-[oklch(0.10_0.015_280)] flex flex-col items-center justify-center p-8 text-center">
      <p className="text-xs font-semibold tracking-[0.2em] uppercase text-violet-400/60 mb-6">
        The Chamber
      </p>
      <motion.p
        className="text-4xl font-bold text-violet-300"
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 0.3, type: 'spring' }}
      >
        {data.proposalsReviewed}
      </motion.p>
      <p className="text-sm text-muted-foreground mt-2">proposals reviewed</p>

      <div className="mt-8 space-y-3 w-full">
        <StatRow label="Agreement rate" value={`${Math.round(data.agreementPct)}%`} delay={0.5} />
        <StatRow label="Unanimous votes" value={String(data.unanimousCount)} delay={0.6} />
        {data.notableDissenter && (
          <StatRow label="Notable dissenter" value={data.notableDissenter} delay={0.7} />
        )}
      </div>
    </div>
  );
}

function HealthSlide({ data }: { data: WrappedData['health'] }) {
  const delta = data.ghiEnd - data.ghiStart;
  const direction = delta > 0 ? '+' : '';
  return (
    <div className="h-full bg-gradient-to-br from-emerald-950/30 via-[oklch(0.12_0.02_192)] to-[oklch(0.10_0.015_180)] flex flex-col items-center justify-center p-8 text-center">
      <p className="text-xs font-semibold tracking-[0.2em] uppercase text-emerald-400/60 mb-6">
        The Pulse
      </p>
      <motion.div
        className="flex items-baseline gap-2"
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 0.3, type: 'spring' }}
      >
        <span className="text-4xl font-bold text-emerald-300">{Math.round(data.ghiEnd)}</span>
        <span
          className={cn('text-lg font-semibold', delta >= 0 ? 'text-emerald-400' : 'text-rose-400')}
        >
          {direction}
          {Math.round(delta)}
        </span>
      </motion.div>
      <p className="text-sm text-muted-foreground mt-2">Governance Health Index</p>

      <div className="mt-8 space-y-3 w-full">
        <StatRow label="Strongest" value={data.strongestComponent} delay={0.5} />
        <StatRow label="Weakest" value={data.weakestComponent} delay={0.6} />
      </div>
    </div>
  );
}

function PersonalSlide({
  data,
  epoch,
  formatAda,
}: {
  data: WrappedData['personal'] | undefined;
  epoch: number;
  formatAda: (n: number) => string;
}) {
  if (!data) {
    return (
      <div className="h-full bg-gradient-to-br from-[oklch(0.15_0.03_260)] via-[oklch(0.12_0.02_280)] to-[oklch(0.10_0.015_300)] flex flex-col items-center justify-center p-8 text-center">
        <p className="text-xs font-semibold tracking-[0.2em] uppercase text-primary/60 mb-6">
          Your Epoch
        </p>
        <p className="text-lg font-medium text-muted-foreground">
          Connect your wallet to see your personal governance stats
        </p>
        <p className="text-xs text-muted-foreground/50 mt-4">governada.io</p>
      </div>
    );
  }

  return (
    <div className="h-full bg-gradient-to-br from-[oklch(0.15_0.03_192)] via-[oklch(0.12_0.02_200)] to-[oklch(0.10_0.015_210)] flex flex-col items-center justify-center p-8 text-center">
      <p className="text-xs font-semibold tracking-[0.2em] uppercase text-primary/60 mb-6">
        Your Epoch {epoch}
      </p>

      <div className="space-y-3 w-full">
        <StatRow label="Proposals voted on" value={String(data.votesCount)} delay={0.3} />
        <StatRow
          label="DRep alignment"
          value={`${Math.round(data.drepAlignmentPct)}%`}
          delay={0.4}
        />
        <StatRow
          label="Treasury share"
          value={`${formatAda(data.treasuryShareAda)} ADA`}
          delay={0.5}
        />
        <StatRow label="Engagement" value={data.engagementRank} delay={0.6} />
      </div>
    </div>
  );
}

function ShareSlide({ epoch }: { epoch: number }) {
  return (
    <div className="h-full bg-gradient-to-br from-[oklch(0.15_0.03_260)] via-[oklch(0.12_0.02_280)] to-[oklch(0.10_0.015_300)] flex flex-col items-center justify-center p-8 text-center">
      <motion.p
        className="text-xs font-semibold tracking-[0.3em] uppercase text-primary/60 mb-4"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.2 }}
      >
        Epoch {epoch}
      </motion.p>
      <motion.h2
        className="text-2xl font-bold"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
      >
        Share your
        <br />
        governance story
      </motion.h2>
      <motion.p
        className="text-sm text-muted-foreground mt-3"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.6 }}
      >
        See the full epoch replay at governada.io
      </motion.p>
      <motion.div
        className="mt-8 text-[10px] text-muted-foreground/40 font-medium"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.8 }}
      >
        governada.io/governance/observatory
      </motion.div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function StatRow({ label, value, delay }: { label: string; value: string; delay: number }) {
  return (
    <motion.div
      className="flex items-center justify-between px-4 py-2 rounded-lg bg-white/5"
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay }}
    >
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="text-sm font-semibold">{value}</span>
    </motion.div>
  );
}
