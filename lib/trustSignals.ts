/**
 * Trust signal computation — shared between server (page.tsx) and client (TrustSignals.tsx).
 * Must NOT use 'use client' so server components can import it.
 */

export interface TrustSignal {
  key: 'participation' | 'rationale' | 'reliability' | 'delegation_trend' | 'profile_quality';
  label: string;
  value: number;
  status: 'strong' | 'moderate' | 'weak';
  detail?: string;
}

export function computeTrustSignals(drep: {
  effectiveParticipation?: number | null;
  rationaleRate?: number | null;
  reliabilityStreak?: number | null;
  reliabilityRecency?: number | null;
  delegatorCount?: number | null;
  previousDelegatorCount?: number | null;
  profileCompleteness?: number | null;
  metadataHashVerified?: boolean | null;
}): TrustSignal[] {
  const signals: TrustSignal[] = [];

  // Participation
  const participation = drep.effectiveParticipation ?? 0;
  signals.push({
    key: 'participation',
    label:
      participation >= 70
        ? `Votes on ${Math.round(participation)}% of proposals`
        : participation >= 40
          ? `Votes on ${Math.round(participation)}% of proposals`
          : `Limited voting (${Math.round(participation)}%)`,
    value: participation,
    status: participation >= 70 ? 'strong' : participation >= 40 ? 'moderate' : 'weak',
  });

  // Rationale
  const rationaleRate = drep.rationaleRate ?? 0;
  signals.push({
    key: 'rationale',
    label:
      rationaleRate >= 60
        ? 'Writes rationale on most votes'
        : rationaleRate >= 30
          ? 'Sometimes provides rationale'
          : 'Rarely provides rationale',
    value: rationaleRate,
    status: rationaleRate >= 60 ? 'strong' : rationaleRate >= 30 ? 'moderate' : 'weak',
  });

  // Reliability
  const reliabilityStreak = drep.reliabilityStreak ?? 0;
  const reliabilityRecency = drep.reliabilityRecency ?? 999;
  const reliabilityStatus: TrustSignal['status'] =
    reliabilityStreak >= 10 ? 'strong' : reliabilityRecency <= 2 ? 'moderate' : 'weak';

  signals.push({
    key: 'reliability',
    label:
      reliabilityStreak >= 10
        ? `Active ${reliabilityStreak} consecutive epochs`
        : reliabilityRecency <= 2
          ? 'Voted recently'
          : reliabilityRecency < 999
            ? `Inactive for ${reliabilityRecency} epochs`
            : 'No voting history yet',
    value: reliabilityStreak,
    status: reliabilityStatus,
  });

  // Delegation trend
  const current = drep.delegatorCount ?? 0;
  const previous = drep.previousDelegatorCount ?? null;

  if (previous !== null && previous > 0) {
    const change = ((current - previous) / previous) * 100;
    const trendStatus: TrustSignal['status'] =
      change > 5 ? 'strong' : change > -5 ? 'moderate' : 'weak';

    signals.push({
      key: 'delegation_trend',
      label:
        change > 5
          ? `Growing delegation (+${Math.round(change)}%)`
          : change > -5
            ? 'Stable delegation'
            : `Declining delegation (${Math.round(change)}%)`,
      value: Math.round(change),
      status: trendStatus,
      detail: `${current.toLocaleString()} delegators`,
    });
  } else {
    signals.push({
      key: 'delegation_trend',
      label: 'Delegation trend unavailable',
      value: 0,
      status: 'weak',
    });
  }

  // Profile quality
  const profileCompleteness = drep.profileCompleteness ?? 0;
  const metadataHashVerified = drep.metadataHashVerified ?? false;
  const profileStatus: TrustSignal['status'] =
    profileCompleteness >= 80 && metadataHashVerified
      ? 'strong'
      : profileCompleteness >= 50
        ? 'moderate'
        : 'weak';

  signals.push({
    key: 'profile_quality',
    label:
      profileCompleteness >= 80 && metadataHashVerified
        ? 'Complete, verified profile'
        : profileCompleteness >= 50
          ? 'Partial profile'
          : 'Minimal profile',
    value: profileCompleteness,
    status: profileStatus,
    detail: metadataHashVerified ? 'Verified metadata' : undefined,
  });

  return signals;
}
