'use client';

import { X, Lightbulb } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useFirstVisit } from '@/hooks/useFirstVisit';
import { briefingItem } from '@/lib/animations';

interface FirstVisitBannerProps {
  pageKey: string;
  message: string;
}

/**
 * A subtle educational banner shown on a user's first visit to a page.
 * Dismissible, persisted via localStorage so it only shows once.
 */
export function FirstVisitBanner({ pageKey, message }: FirstVisitBannerProps) {
  const { showBanner, dismiss } = useFirstVisit(pageKey);

  return (
    <AnimatePresence>
      {showBanner && (
        <motion.div
          variants={briefingItem}
          initial="hidden"
          animate="visible"
          exit={{ opacity: 0, height: 0, marginBottom: 0 }}
          className="rounded-lg border border-primary/20 bg-primary/5 px-4 py-3 mb-4"
        >
          <div className="flex items-start gap-3">
            <Lightbulb className="h-4 w-4 text-primary shrink-0 mt-0.5" />
            <p className="flex-1 text-sm text-muted-foreground leading-relaxed">{message}</p>
            <button
              onClick={dismiss}
              className="shrink-0 text-muted-foreground hover:text-foreground transition-colors p-0.5"
              aria-label="Dismiss"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
