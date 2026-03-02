'use client';

import { createContext, useContext, useRef, useCallback } from 'react';
import { usePathname } from 'next/navigation';
import { type NavDirection } from '@/lib/animations';

const NavDirectionContext = createContext<NavDirection>('neutral');

export function useNavDirection() {
  return useContext(NavDirectionContext);
}

function pathDepth(p: string) {
  return p.split('/').filter(Boolean).length;
}

const GOVERNANCE_ROUTES = new Set([
  '/pulse',
  '/treasury',
  '/governance',
  '/proposals',
  '/discover',
]);

function inferDirection(prev: string, next: string): NavDirection {
  if (!prev || prev === next) return 'neutral';

  const prevDepth = pathDepth(prev);
  const nextDepth = pathDepth(next);

  if (nextDepth > prevDepth) return 'forward';
  if (nextDepth < prevDepth) return 'backward';

  // Same depth — lateral navigation between top-level sections
  const prevBase = '/' + (prev.split('/')[1] ?? '');
  const nextBase = '/' + (next.split('/')[1] ?? '');
  if (GOVERNANCE_ROUTES.has(prevBase) && GOVERNANCE_ROUTES.has(nextBase)) {
    return 'neutral';
  }

  return 'neutral';
}

export function NavDirectionProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const prevPathRef = useRef('');
  const directionRef = useRef<NavDirection>('neutral');

  const computeDirection = useCallback(() => {
    if (prevPathRef.current && prevPathRef.current !== pathname) {
      directionRef.current = inferDirection(prevPathRef.current, pathname);
    } else {
      directionRef.current = 'neutral';
    }
    prevPathRef.current = pathname;
    return directionRef.current;
  }, [pathname]);

  const direction = computeDirection();

  return (
    <NavDirectionContext.Provider value={direction}>
      {children}
    </NavDirectionContext.Provider>
  );
}
