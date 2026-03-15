/**
 * SPO Trust signal computation — maps SPO-specific data to the same
 * TrustSignal interface used by DReps for consistent rendering.
 *
 * Must NOT use 'use client' so server components can import it.
 */

import type { TrustSignal } from './trustSignals';

export function computeSpoTrustSignals(spo: {
  participationRate: number;
  lastVotedText: string | null;
  scoreMomentum: number | null;
  governanceStatement: string | null;
  isClaimed: boolean;
  homepage: string | null;
  socialLinks: Array<{ uri: string }>;
  delegatorCount: number;
}): TrustSignal[] {
  const signals: TrustSignal[] = [];

  // Participation
  const rate = spo.participationRate;
  signals.push({
    key: 'participation',
    label:
      rate >= 70
        ? `Votes on ${rate}% of proposals`
        : rate >= 40
          ? `Votes on ${rate}% of proposals`
          : `Limited voting (${rate}%)`,
    value: rate,
    status: rate >= 70 ? 'strong' : rate >= 40 ? 'moderate' : 'weak',
  });

  // Reliability (mapped from voting recency)
  const lastVoted = spo.lastVotedText;
  let reliabilityStatus: TrustSignal['status'] = 'weak';
  let reliabilityLabel = 'No voting history yet';
  let reliabilityValue = 0;

  if (lastVoted) {
    if (lastVoted.includes('today') || lastVoted.includes('yesterday')) {
      reliabilityStatus = 'strong';
      reliabilityLabel = 'Voted within the last day';
      reliabilityValue = 100;
    } else if (lastVoted.includes('days')) {
      reliabilityStatus = 'strong';
      reliabilityLabel = lastVoted;
      reliabilityValue = 80;
    } else if (lastVoted.includes('week')) {
      reliabilityStatus = 'moderate';
      reliabilityLabel = lastVoted;
      reliabilityValue = 50;
    } else if (lastVoted.includes('month')) {
      reliabilityStatus = 'moderate';
      reliabilityLabel = lastVoted;
      reliabilityValue = 30;
    } else {
      reliabilityStatus = 'weak';
      reliabilityLabel = lastVoted;
      reliabilityValue = 10;
    }
  }

  signals.push({
    key: 'reliability',
    label: reliabilityLabel,
    value: reliabilityValue,
    status: reliabilityStatus,
  });

  // Delegation trend (using score momentum as proxy)
  const momentum = spo.scoreMomentum;
  if (momentum !== null) {
    const trendStatus: TrustSignal['status'] =
      momentum > 3 ? 'strong' : momentum >= -3 ? 'moderate' : 'weak';
    signals.push({
      key: 'delegation_trend',
      label:
        momentum > 3
          ? `Score rising (+${momentum} pts)`
          : momentum >= -3
            ? 'Score stable'
            : `Score declining (${momentum} pts)`,
      value: momentum,
      status: trendStatus,
      detail: `${spo.delegatorCount.toLocaleString()} delegators`,
    });
  }

  // Profile quality
  let completeness = 0;
  if (spo.isClaimed) completeness += 30;
  if (spo.governanceStatement) completeness += 30;
  if (spo.homepage) completeness += 20;
  if (spo.socialLinks.length > 0) completeness += 20;

  const profileStatus: TrustSignal['status'] =
    completeness >= 80 ? 'strong' : completeness >= 50 ? 'moderate' : 'weak';

  signals.push({
    key: 'profile_quality',
    label:
      completeness >= 80
        ? 'Complete, claimed profile'
        : completeness >= 50
          ? 'Partial profile'
          : 'Minimal profile',
    value: completeness,
    status: profileStatus,
    detail: spo.isClaimed ? 'Verified operator' : undefined,
  });

  return signals;
}
