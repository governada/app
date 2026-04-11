'use client';

import { useEffect } from 'react';
import { Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useSenecaThreadStore } from '@/stores/senecaThreadStore';

/**
 * Guarantees that the dedicated /match route actually enters the matching flow.
 * If hydration or persisted panel state leaves Seneca elsewhere, this component
 * re-asserts match mode and provides a stable manual fallback CTA.
 */
export function MatchRouteActivator() {
  const isOpen = useSenecaThreadStore((state) => state.isOpen);
  const mode = useSenecaThreadStore((state) => state.mode);
  const startMatch = useSenecaThreadStore((state) => state.startMatch);

  useEffect(() => {
    const ensureMatchMode = () => {
      const state = useSenecaThreadStore.getState();
      if (!state.isOpen || state.mode !== 'matching') {
        state.startMatch();
      }
    };

    ensureMatchMode();
    const settleTimer = window.setTimeout(ensureMatchMode, 300);
    const retryTimer = window.setTimeout(ensureMatchMode, 1_500);

    return () => {
      window.clearTimeout(settleTimer);
      window.clearTimeout(retryTimer);
    };
  }, [startMatch]);

  if (isOpen && mode === 'matching') {
    return null;
  }

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-24 z-30 flex justify-center px-4 lg:bottom-8 lg:right-[25rem] lg:left-auto lg:justify-end lg:px-0">
      <Button
        type="button"
        size="lg"
        onClick={() => startMatch()}
        className="pointer-events-auto gap-2 rounded-full bg-primary px-5 shadow-lg shadow-primary/20"
      >
        <Sparkles className="h-4 w-4" />
        Start Match
      </Button>
    </div>
  );
}
