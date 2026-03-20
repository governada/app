'use client';

/**
 * EntityPreview — inline entity preview within the Co-Pilot panel.
 *
 * When the panel shows entity links (e.g., "Related Proposals" on a DRep page),
 * clicking one slides a preview in from the right. Supports breadcrumb navigation
 * with a max stack depth of 3 levels.
 *
 * Animations: slide left/right with Framer Motion (200ms).
 * Respects `prefers-reduced-motion`.
 *
 * Feature-flagged behind `governance_copilot`.
 */

import { useCallback, useRef, useEffect } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { ArrowLeft, ExternalLink, ChevronRight } from 'lucide-react';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import { EntityPreviewCard } from './EntityPreviewCard';
import type { UseEntityPreviewStackReturn, PreviewEntity } from '@/hooks/useEntityPreviewStack';
import type { PeekEntityType } from '@/hooks/usePeekDrawer';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface EntityPreviewProps {
  /** The preview stack hook return — pass from the parent panel */
  previewStack: UseEntityPreviewStackReturn;
  /** Children = the panel's root content (shown when no preview is active) */
  children: React.ReactNode;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const SLIDE_DURATION = 0.2;

// Easing: custom ease-out for smooth slide
const SLIDE_EASE = [0.16, 1, 0.3, 1] as const;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function entityHref(type: PeekEntityType, id: string, secondaryId?: string | number): string {
  switch (type) {
    case 'proposal':
      return `/proposal/${id}/${secondaryId ?? 0}`;
    case 'drep':
      return `/drep/${id}`;
    case 'pool':
      return `/pool/${id}`;
    case 'cc':
      return `/governance/committee/${encodeURIComponent(id)}`;
    default:
      return '#';
  }
}

function entityTypeLabel(type: PeekEntityType): string {
  switch (type) {
    case 'proposal':
      return 'Proposal';
    case 'drep':
      return 'DRep';
    case 'pool':
      return 'Pool';
    case 'cc':
      return 'CC Member';
    default:
      return 'Entity';
  }
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function EntityPreview({ previewStack, children }: EntityPreviewProps) {
  const prefersReducedMotion = useReducedMotion();
  const contentRef = useRef<HTMLDivElement>(null);

  const { current, breadcrumbs, depth, isActive, pop, navigateTo, reset } = previewStack;

  const duration = prefersReducedMotion ? 0 : SLIDE_DURATION;

  // Scroll to top when a new preview is pushed
  useEffect(() => {
    if (isActive && contentRef.current) {
      contentRef.current.scrollTop = 0;
    }
  }, [depth, isActive]);

  // Keyboard: Escape pops the preview stack
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Escape' && isActive) {
        e.stopPropagation();
        pop();
      }
    },
    [isActive, pop],
  );

  return (
    <div className="relative h-full overflow-hidden" onKeyDown={handleKeyDown}>
      {/* Root panel content */}
      <AnimatePresence mode="popLayout">
        {!isActive && (
          <motion.div
            key="panel-root"
            className="h-full overflow-y-auto"
            initial={false}
            animate={{ x: 0, opacity: 1 }}
            exit={{
              x: prefersReducedMotion ? 0 : -60,
              opacity: 0,
            }}
            transition={{ duration, ease: SLIDE_EASE }}
          >
            {children}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Preview layer */}
      <AnimatePresence mode="popLayout">
        {isActive && current && (
          <motion.div
            key={`preview-${depth}-${current.type}-${current.id}`}
            ref={contentRef}
            className="absolute inset-0 h-full overflow-y-auto"
            initial={{
              x: prefersReducedMotion ? 0 : '100%',
              opacity: prefersReducedMotion ? 0 : 1,
            }}
            animate={{ x: 0, opacity: 1 }}
            exit={{
              x: prefersReducedMotion ? 0 : '100%',
              opacity: prefersReducedMotion ? 0 : 1,
            }}
            transition={{ duration, ease: SLIDE_EASE }}
          >
            {/* Navigation header */}
            <div className="sticky top-0 z-10 bg-background/80 backdrop-blur-md border-b border-border/10 px-3 py-2 space-y-1.5">
              {/* Back button */}
              <button
                type="button"
                onClick={depth === 1 ? reset : pop}
                className={cn(
                  'flex items-center gap-1.5 text-xs font-medium transition-colors',
                  'text-muted-foreground hover:text-foreground',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded-md px-1 py-0.5',
                )}
                aria-label={depth === 1 ? 'Back to panel' : 'Back to previous preview'}
              >
                <ArrowLeft className="h-3.5 w-3.5" />
                {depth === 1 ? 'Back to Compass' : `Back`}
              </button>

              {/* Breadcrumb trail */}
              {breadcrumbs.length > 1 && (
                <nav
                  className="flex items-center gap-1 text-[10px] text-muted-foreground overflow-x-auto"
                  aria-label="Preview navigation"
                >
                  <button
                    type="button"
                    onClick={reset}
                    className="shrink-0 hover:text-foreground transition-colors"
                  >
                    Panel
                  </button>
                  {breadcrumbs.map((crumb, i) => {
                    const isLast = i === breadcrumbs.length - 1;
                    return (
                      <span key={crumb.depth} className="flex items-center gap-1 shrink-0">
                        <ChevronRight className="h-2.5 w-2.5 text-muted-foreground/50" />
                        {isLast ? (
                          <span className="text-foreground font-medium truncate max-w-[120px]">
                            {crumb.label}
                          </span>
                        ) : (
                          <button
                            type="button"
                            onClick={() => navigateTo(crumb.depth)}
                            className="hover:text-foreground transition-colors truncate max-w-[100px]"
                          >
                            {crumb.label}
                          </button>
                        )}
                      </span>
                    );
                  })}
                </nav>
              )}
            </div>

            {/* Entity preview content */}
            <div className="px-4 pb-4">
              <EntityPreviewCard
                type={current.type}
                id={current.id}
                secondaryId={current.secondaryId}
              />

              {/* Open full page link */}
              <div className="mt-4 pt-3 border-t border-border/20">
                <Link
                  href={entityHref(current.type, current.id, current.secondaryId)}
                  className={cn(
                    'flex items-center justify-center gap-2 w-full py-2 rounded-lg',
                    'text-xs font-medium transition-colors',
                    'text-muted-foreground hover:text-foreground hover:bg-muted/30',
                    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary',
                  )}
                >
                  Open full {entityTypeLabel(current.type)} page
                  <ExternalLink className="h-3 w-3" />
                </Link>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Re-export types for convenience
// ---------------------------------------------------------------------------

export type { PreviewEntity, UseEntityPreviewStackReturn };
