'use client';

import { useEffect } from 'react';
import { posthog } from '@/lib/posthog';
import { emitDiscoveryEvent } from '@/lib/discovery/events';

const FIRST_VISIT_STORAGE_KEY = 'governada_first_visit_seen';

interface PageViewTrackerProps {
  event: string;
  properties?: Record<string, string | number | boolean | null>;
  /** Optional discovery event to emit alongside the analytics event */
  discoveryEvent?: string;
}

function captureFirstVisit() {
  try {
    if (localStorage.getItem(FIRST_VISIT_STORAGE_KEY) !== null) return;

    posthog.capture('first_visit', {
      source: 'homepage',
      timestamp: new Date().toISOString(),
    });
    localStorage.setItem(FIRST_VISIT_STORAGE_KEY, 'true');
  } catch {
    // localStorage can be unavailable in private or restricted contexts.
  }
}

export function PageViewTracker({ event, properties, discoveryEvent }: PageViewTrackerProps) {
  useEffect(() => {
    if (event === 'homepage_viewed') {
      captureFirstVisit();
    }
    posthog.capture(event, properties);
    if (discoveryEvent) {
      emitDiscoveryEvent(discoveryEvent);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- properties is an object literal from parent; only event name matters for re-trigger
  }, [event, discoveryEvent]);

  return null;
}
