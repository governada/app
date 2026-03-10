'use client';

import { useEffect, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Sparkles } from 'lucide-react';
import { loadMatchProfile, alignmentDistance, distanceToMatchScore } from '@/lib/matchStore';
import type { AlignmentScores } from '@/lib/drepIdentity';

interface MatchContextBadgeProps {
  /** The DRep's alignment scores — used to compute match against stored user profile. */
  drepAlignments: AlignmentScores;
  /** If an explicit match score is already provided (e.g. from URL param), skip localStorage. */
  existingMatchScore?: number | null;
}

/**
 * Shows "Your match: X%" when the user has completed Quick Match and the
 * current DRep can be scored against their stored governance preferences.
 *
 * Reads from localStorage — renders nothing if no stored profile or if
 * an explicit matchScore is already being displayed.
 */
export function MatchContextBadge({ drepAlignments, existingMatchScore }: MatchContextBadgeProps) {
  const [matchScore, setMatchScore] = useState<number | null>(null);

  useEffect(() => {
    // Don't compute if an explicit score is already shown
    if (existingMatchScore != null && existingMatchScore > 0) return;

    const profile = loadMatchProfile();
    if (!profile) return;

    const distance = alignmentDistance(profile.userAlignments, drepAlignments);
    const score = distanceToMatchScore(distance);
    if (score > 0) {
      setMatchScore(score);
    }
  }, [drepAlignments, existingMatchScore]);

  if (matchScore === null) return null;

  return (
    <Badge variant="outline" className="text-xs gap-1 border-primary/30 bg-primary/5 text-primary">
      <Sparkles className="h-3 w-3" />
      Your match: {matchScore}%
    </Badge>
  );
}
