'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { motion, LayoutGroup, useReducedMotion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { useSegment } from '@/components/providers/SegmentProvider';
import { getPillBarItems } from '@/lib/nav/config';
import { useGovernanceDepth } from '@/hooks/useGovernanceDepth';
import { useSidebarMetrics } from '@/hooks/useSidebarMetrics';
import { useTranslation } from '@/lib/i18n/useTranslation';
import { useScrollDirection } from '@/hooks/useScrollDirection';

interface SectionTabBarProps {
  section: string;
}

/**
 * SectionTabBar — horizontal sub-page navigation with underline active indicator.
 * Visible on ALL breakpoints (desktop and mobile).
 * Replaces mobile-only SectionPillBar with a unified tab bar.
 */
export function SectionTabBar({ section: _section }: SectionTabBarProps) {
  const pathname = usePathname();
  const { t } = useTranslation();
  const { segment, drepId, poolId } = useSegment();
  const { depth } = useGovernanceDepth();
  const metrics = useSidebarMetrics();
  const prefersReducedMotion = useReducedMotion();
  const scrollDirection = useScrollDirection(10);
  // On mobile, the header slides away on scroll-down. Subnav needs to be at
  // top-0 when header is hidden, top-10 (40px) when header is visible.
  const mobileHeaderVisible = scrollDirection !== 'down';

  const items = getPillBarItems(pathname, segment, { drepId, poolId, depth });

  if (!items || items.length < 1) return null;

  const isActive = (href: string) => {
    if (href === pathname) return true;
    if (href !== '/' && pathname.startsWith(href + '/')) return true;
    return false;
  };

  return (
    <div
      className={cn(
        'sticky z-20 border-b border-border/10 bg-background/40 backdrop-blur-xl transition-[top] duration-300 md:pt-0',
        // Mobile: follow header visibility. Desktop: always below header.
        mobileHeaderVisible ? 'top-10 md:top-10' : 'top-0 md:top-10',
      )}
    >
      <nav
        className="flex items-center gap-1 px-4 lg:px-6 h-10 overflow-x-auto scrollbar-none [mask-image:linear-gradient(to_right,transparent_0%,black_16px,black_calc(100%-16px),transparent_100%)]"
        aria-label="Section navigation"
      >
        <LayoutGroup id="section-tabs">
          {items.map((item) => {
            const active = isActive(item.href);
            const count = item.sublabelKey ? metrics[item.sublabelKey] : undefined;

            if (item.disabled) {
              return (
                <span
                  key={item.href}
                  className="shrink-0 px-3 py-2 text-sm font-medium whitespace-nowrap relative min-h-[40px] inline-flex items-center text-muted-foreground/40 cursor-not-allowed"
                  title={item.disabledTooltip}
                  aria-disabled="true"
                >
                  {t(item.label)}
                </span>
              );
            }

            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  'shrink-0 px-3 py-2 text-sm font-medium transition-colors whitespace-nowrap relative',
                  'min-h-[40px] inline-flex items-center',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary',
                  active ? 'text-foreground' : 'text-muted-foreground hover:text-foreground',
                )}
                aria-current={active ? 'page' : undefined}
              >
                {t(item.label)}
                {count && <span className="text-xs text-muted-foreground/60 ml-1.5">{count}</span>}
                {!active && item.sublabelKey && metrics[item.sublabelKey] && (
                  <span
                    className="ml-1 inline-block w-1 h-1 rounded-full bg-primary/60"
                    aria-hidden="true"
                  />
                )}
                {active &&
                  (prefersReducedMotion ? (
                    <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary rounded-full" />
                  ) : (
                    <motion.span
                      layoutId="section-tab-indicator"
                      className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary rounded-full"
                      transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                    />
                  ))}
              </Link>
            );
          })}
        </LayoutGroup>
      </nav>
    </div>
  );
}
