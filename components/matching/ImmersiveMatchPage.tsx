'use client';

import { useRef, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';
import { X } from 'lucide-react';
import { ConversationalMatchFlow } from '@/components/matching/ConversationalMatchFlow';
import { useFeatureFlag } from '@/components/FeatureGate';
import { cn } from '@/lib/utils';
import type { ConstellationRef } from '@/components/GovernanceConstellation';

const ConstellationScene = dynamic(
  () => import('@/components/ConstellationScene').then((m) => ({ default: m.ConstellationScene })),
  { ssr: false, loading: () => <div className="w-full h-full bg-black" /> },
);

/**
 * Immersive matching page — "Xavier's Room."
 *
 * Full-screen globe + conversational matching flow.
 * No distractions, no scrolling — just the globe and the questions.
 */
export function ImmersiveMatchPage() {
  const router = useRouter();
  const globeRef = useRef<ConstellationRef>(null);
  const [isMatching, setIsMatching] = useState(false);
  const conversationalEnabled = useFeatureFlag('conversational_matching');

  const handleClose = useCallback(() => {
    router.push('/');
  }, [router]);

  const handleMatchStart = useCallback(() => {
    setIsMatching(true);
  }, []);

  // Redirect if conversational matching is disabled
  if (conversationalEnabled === false) {
    router.replace('/');
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 bg-black flex flex-col">
      {/* Close button — top right, above the globe */}
      <button
        onClick={handleClose}
        className={cn(
          'absolute top-4 right-4 z-50 rounded-full p-2',
          'bg-white/10 backdrop-blur-sm border border-white/10',
          'text-white/70 hover:text-white hover:bg-white/20',
          'transition-all duration-200',
        )}
        aria-label="Close matching"
      >
        <X className="h-5 w-5" />
      </button>

      {/* Globe — fills entire viewport */}
      <div className="absolute inset-0">
        <ConstellationScene ref={globeRef} className="w-full h-full" interactive={false} />
      </div>

      {/* Gradient overlay for readability */}
      <div className="absolute inset-x-0 bottom-0 h-[60%] bg-gradient-to-t from-black/80 via-black/40 to-transparent pointer-events-none" />

      {/* Matching flow — anchored to bottom center */}
      <div
        className={cn(
          'relative z-10 mt-auto w-full flex flex-col items-center',
          'px-6 pb-[calc(env(safe-area-inset-bottom,16px)+16px)]',
        )}
      >
        {/* Title — only before matching starts */}
        {!isMatching && (
          <div className="text-center mb-6 max-w-lg">
            <h1 className="font-display text-2xl sm:text-3xl font-bold text-white tracking-tight">
              Find your governance match
            </h1>
            <p className="mt-2 text-sm sm:text-base text-white/70">
              Answer a few questions. The globe narrows down to your ideal representative.
            </p>
          </div>
        )}

        <div className="w-full max-w-lg">
          <ConversationalMatchFlow globeRef={globeRef} onMatchStart={handleMatchStart} />
        </div>
      </div>
    </div>
  );
}
