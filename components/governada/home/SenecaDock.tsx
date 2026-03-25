'use client';

/**
 * SenecaDock — Warm, context-aware Seneca entry point on the anonymous homepage.
 *
 * Replaces hero text by communicating what Cardano governance IS, why it matters,
 * and what the user can do — through Seneca's voice, not marketing copy.
 *
 * Three states:
 * 1. First Visit  — Value proposition + "Find my representative" CTA
 * 2. Returning    — Dynamic narrative pulse + "Continue where I left off"
 * 3. Post-Match   — Previous match results + "Ready to delegate?"
 *
 * Also detects wallet extensions for personalized messaging.
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import { Send, Sparkles, ArrowRight, RotateCcw } from 'lucide-react';
import { motion, useReducedMotion } from 'framer-motion';
import { useSenecaWarmth } from '@/hooks/useSenecaWarmth';
import { CompassSigil } from '@/components/governada/CompassSigil';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface SenecaDockProps {
  onStartConversation: (query: string) => void;
  onStartMatch?: () => void;
  narrativePulse?: string;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function SenecaDock({ onStartConversation, onStartMatch, narrativePulse }: SenecaDockProps) {
  const [inputValue, setInputValue] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const prefersReducedMotion = useReducedMotion();
  const { dockState, walletDetected, matchMemory, greeting, markVisited } = useSenecaWarmth();

  // Mark visited after first render
  useEffect(() => {
    const timer = setTimeout(markVisited, 2000);
    return () => clearTimeout(timer);
  }, [markVisited]);

  const handleSubmit = useCallback(
    (e: React.FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      const query = inputValue.trim();
      if (!query) return;
      onStartConversation(query);
      setInputValue('');
    },
    [inputValue, onStartConversation],
  );

  const handleMatchClick = useCallback(() => {
    if (onStartMatch) {
      onStartMatch();
    }
  }, [onStartMatch]);

  return (
    <motion.div
      initial={prefersReducedMotion ? { opacity: 1 } : { opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.6, duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
      className="fixed bottom-4 left-4 right-4 sm:right-auto sm:left-4 lg:left-16 sm:w-[22rem] z-40 pointer-events-auto"
    >
      <div className="rounded-2xl border border-white/[0.08] bg-black/75 backdrop-blur-2xl shadow-2xl overflow-hidden">
        {/* Sigil + warm content */}
        <div className="px-5 pt-5 pb-3">
          {/* Compass Sigil */}
          <div className="mb-3">
            <CompassSigil state="greeting" size={28} />
          </div>

          {/* State-dependent warm content */}
          {dockState === 'first-visit' && <FirstVisitContent walletDetected={walletDetected} />}
          {dockState === 'returning' && (
            <ReturningContent greeting={greeting} narrativePulse={narrativePulse} />
          )}
          {dockState === 'post-match' && matchMemory && (
            <PostMatchContent matchMemory={matchMemory} />
          )}
        </div>

        {/* Primary CTA */}
        <div className="px-4 pb-3">
          {dockState === 'post-match' && matchMemory ? (
            <div className="flex gap-2">
              <button
                type="button"
                onClick={handleMatchClick}
                className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-primary/20 border border-primary/30 px-3 py-2.5 text-sm font-medium text-primary hover:bg-primary/30 transition-colors"
              >
                <Sparkles className="h-3.5 w-3.5" />
                See my matches
              </button>
              <button
                type="button"
                onClick={handleMatchClick}
                className="flex items-center justify-center rounded-xl bg-white/[0.04] border border-white/[0.08] px-3 py-2.5 text-xs text-white/50 hover:text-white/70 hover:bg-white/[0.08] transition-colors"
              >
                <RotateCcw className="h-3.5 w-3.5" />
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={handleMatchClick}
              className="w-full flex items-center justify-center gap-2 rounded-xl bg-primary/15 border border-primary/25 px-4 py-2.5 text-sm font-medium text-primary hover:bg-primary/25 transition-colors group"
            >
              <Sparkles className="h-3.5 w-3.5" />
              Find my representative
              <ArrowRight className="h-3.5 w-3.5 opacity-0 -translate-x-1 group-hover:opacity-100 group-hover:translate-x-0 transition-all" />
            </button>
          )}
        </div>

        {/* Free-form input */}
        <form onSubmit={handleSubmit} className="px-4 pb-4">
          <div className="flex items-center gap-2 rounded-xl bg-white/[0.04] border border-white/[0.06] px-3 py-2">
            <input
              ref={inputRef}
              type="text"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              placeholder="Ask Seneca anything..."
              className="flex-1 bg-transparent text-sm text-white/90 placeholder:text-white/25 focus:outline-none"
            />
            <button
              type="submit"
              disabled={!inputValue.trim()}
              className="shrink-0 text-white/30 hover:text-primary disabled:opacity-20 transition-colors"
              aria-label="Send"
            >
              <Send className="h-3.5 w-3.5" />
            </button>
          </div>
        </form>
      </div>
    </motion.div>
  );
}

// ---------------------------------------------------------------------------
// Sub-components for each dock state
// ---------------------------------------------------------------------------

function FirstVisitContent({ walletDetected }: { walletDetected: boolean }) {
  return (
    <div className="space-y-2">
      <h2
        className="text-[15px] font-semibold text-white/90 leading-snug"
        style={{ fontFamily: 'var(--font-governada-display)' }}
      >
        Cardano runs on decentralized governance.
      </h2>
      <p className="text-[13px] text-white/55 leading-relaxed">
        {walletDetected ? (
          <>
            I see you have a wallet — you&apos;re halfway to participating. Find a representative
            for your ADA in about 60 seconds.
          </>
        ) : (
          <>
            700 representatives are making decisions about a $2 billion treasury right now. One of
            them could represent your ADA — and finding them takes 60 seconds.
          </>
        )}
      </p>
    </div>
  );
}

function ReturningContent({
  greeting,
  narrativePulse,
}: {
  greeting: string;
  narrativePulse?: string;
}) {
  return (
    <div className="space-y-2">
      <h2
        className="text-[15px] font-semibold text-white/90 leading-snug"
        style={{ fontFamily: 'var(--font-governada-display)' }}
      >
        {greeting}. Welcome back.
      </h2>
      {narrativePulse ? (
        <p className="text-[13px] text-white/55 leading-relaxed">{narrativePulse}</p>
      ) : (
        <p className="text-[13px] text-white/55 leading-relaxed">
          Governance is always moving. Ask me what&apos;s changed, or find your representative.
        </p>
      )}
    </div>
  );
}

function PostMatchContent({
  matchMemory,
}: {
  matchMemory: { topMatches: Array<{ name: string; score: number }>; archetype?: string };
}) {
  const topMatch = matchMemory.topMatches[0];
  const matchCount = matchMemory.topMatches.length;

  return (
    <div className="space-y-2">
      <h2
        className="text-[15px] font-semibold text-white/90 leading-snug"
        style={{ fontFamily: 'var(--font-governada-display)' }}
      >
        Welcome back{matchMemory.archetype ? `, ${matchMemory.archetype}` : ''}.
      </h2>
      <p className="text-[13px] text-white/55 leading-relaxed">
        {topMatch ? (
          <>
            You matched with <span className="text-white/75 font-medium">{topMatch.name}</span> (
            {topMatch.score}%)
            {matchCount > 1 && (
              <>
                {' '}
                and {matchCount - 1} other{matchCount > 2 ? 's' : ''}
              </>
            )}{' '}
            last time. Ready to delegate?
          </>
        ) : (
          <>You started finding your representative. Pick up where you left off?</>
        )}
      </p>
    </div>
  );
}
