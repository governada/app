/**
 * Match Signals — fire-and-forget POST to collect anonymous matching
 * preference signals for community intelligence aggregation.
 */

import type { AlignmentScores } from '@/lib/drepIdentity';
import { alignmentsToArray } from '@/lib/drepIdentity';

interface MatchSignalInput {
  selectedTopics: Set<string>;
  userAlignments: AlignmentScores;
  personalityLabel: string;
  matches: Array<{
    drepId: string;
    drepName?: string | null;
    score: number;
  }>;
  expandedDrepIds?: string[];
  freeformTopics?: string[];
}

/**
 * Send anonymous match signals to the community intelligence pipeline.
 * Fire-and-forget — never blocks the UI.
 */
export function sendMatchSignals(input: MatchSignalInput): void {
  try {
    const topicSelections: Record<string, boolean> = {};
    for (const topic of input.selectedTopics) {
      // Strip the 'topic-' prefix from the pill IDs
      const key = topic.replace(/^topic-/, '');
      topicSelections[key] = true;
    }

    const body = {
      topicSelections,
      alignmentVector: alignmentsToArray(input.userAlignments),
      archetype: input.personalityLabel,
      matchedDrepIds: input.matches.map((m) => m.drepId),
      expandedDrepIds: input.expandedDrepIds ?? [],
      freeformTopics: input.freeformTopics ?? [],
    };

    // Fire and forget — no await, no error handling needed
    fetch('/api/governance/match-signals', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }).catch(() => {
      // Silently swallow — this is non-critical telemetry
    });
  } catch {
    // Never throw from a fire-and-forget function
  }
}
