/**
 * Proposer Score Engine
 *
 * 4-pillar scoring model for governance proposers:
 *   1. Track Record (35%)  — approval rate + delivery + trajectory
 *   2. Proposal Quality (30%) — specification completeness + community engagement
 *   3. Fiscal Responsibility (20%) — request reasonableness + efficiency
 *   4. Governance Citizenship (15%) — responsiveness + transparency
 *
 * Uses absolute calibration curves (same as DRep/SPO/CC scores).
 * Confidence-gated: 1 proposal = max Emerging, 2-3 = max Bronze, 4+ = full.
 */

import { getSupabaseAdmin } from '@/lib/supabase';
import { calibrate, type CalibrationCurve } from '@/lib/scoring/calibration';
import { logger } from '@/lib/logger';

// ---------------------------------------------------------------------------
// Weights & Calibration
// ---------------------------------------------------------------------------

export const PROPOSER_PILLAR_WEIGHTS = {
  trackRecord: 0.35,
  proposalQuality: 0.3,
  fiscalResponsibility: 0.2,
  governanceCitizenship: 0.15,
} as const;

/**
 * Calibration curves for proposer score pillars.
 *
 * Track Record:
 * - floor (15): ~15% approval rate, 1 enacted out of many.
 * - targetLow (40): ~40% approval rate, some enacted, no delivery data yet.
 * - targetHigh (70): ~70% approval rate, good track record.
 * - ceiling (90): 90%+ approval with delivery evidence.
 */
export const PROPOSER_CALIBRATION: Record<string, CalibrationCurve> = {
  trackRecord: { floor: 15, targetLow: 40, targetHigh: 70, ceiling: 90 },
  proposalQuality: { floor: 20, targetLow: 40, targetHigh: 65, ceiling: 85 },
  fiscalResponsibility: { floor: 15, targetLow: 35, targetHigh: 65, ceiling: 85 },
  governanceCitizenship: { floor: 10, targetLow: 30, targetHigh: 60, ceiling: 80 },
};

/** Confidence tiers based on proposal count. */
const CONFIDENCE_TIERS = [
  { maxProposals: 1, confidence: 40, maxTier: 'Emerging' },
  { maxProposals: 3, confidence: 70, maxTier: 'Bronze' },
] as const;

const FULL_CONFIDENCE_PROPOSALS = 4;

const TIER_BOUNDARIES = [
  { name: 'Emerging', min: 0, max: 39 },
  { name: 'Bronze', min: 40, max: 54 },
  { name: 'Silver', min: 55, max: 69 },
  { name: 'Gold', min: 70, max: 84 },
  { name: 'Diamond', min: 85, max: 94 },
  { name: 'Legendary', min: 95, max: 100 },
] as const;

// ---------------------------------------------------------------------------
// Pillar computations
// ---------------------------------------------------------------------------

interface ProposerData {
  id: string;
  proposalCount: number;
  enactedCount: number;
  droppedCount: number;
  proposals: {
    txHash: string;
    proposalIndex: number;
    proposalType: string;
    withdrawalAmount: number | null;
    hasAbstract: boolean;
    hasBody: boolean;
    proposedEpoch: number | null;
    enacted: boolean;
    dropped: boolean;
    voteCount: number;
    deliveryScore: number | null;
  }[];
}

function computeTrackRecord(data: ProposerData): number {
  if (data.proposalCount === 0) return 0;

  // Exclude InfoActions from approval rate (non-binding)
  const actionable = data.proposals.filter((p) => p.proposalType !== 'InfoAction');
  if (actionable.length === 0) return 50; // InfoAction-only proposer gets neutral

  // Sub-signal 1: Approval rate (60%)
  const enacted = actionable.filter((p) => p.enacted).length;
  const approvalRate = (enacted / actionable.length) * 100;

  // Sub-signal 2: Delivery score (25%) — from proposal_outcomes
  const withDelivery = data.proposals.filter((p) => p.deliveryScore !== null);
  let deliveryScore = 50; // neutral when no data
  if (withDelivery.length > 0) {
    deliveryScore =
      withDelivery.reduce((s, p) => s + (p.deliveryScore ?? 0), 0) / withDelivery.length;
  }

  // Sub-signal 3: Volume bonus (15%) — more proposals = more experience
  // 1 proposal = 20, 3 = 50, 5 = 70, 10+ = 100
  const volumeScore = Math.min(100, 20 + (data.proposalCount - 1) * 13);

  return approvalRate * 0.6 + deliveryScore * 0.25 + volumeScore * 0.15;
}

function computeProposalQuality(data: ProposerData): number {
  if (data.proposals.length === 0) return 0;

  // Sub-signal 1: Specification completeness (50%)
  // Does the proposal have: title (assumed yes), abstract, body, author metadata?
  let completenessTotal = 0;
  for (const p of data.proposals) {
    let score = 30; // base: has title + author (they're in the system)
    if (p.hasAbstract) score += 35;
    if (p.hasBody) score += 35;
    completenessTotal += score;
  }
  const completeness = completenessTotal / data.proposals.length;

  // Sub-signal 2: Community engagement (50%)
  // Did their proposals generate votes and discussion?
  let engagementTotal = 0;
  for (const p of data.proposals) {
    // Vote count scoring: 0 votes = 0, 10 = 40, 30 = 70, 50+ = 100
    const voteScore = Math.min(100, p.voteCount * 2);
    engagementTotal += voteScore;
  }
  const engagement = engagementTotal / data.proposals.length;

  return completeness * 0.5 + engagement * 0.5;
}

function computeFiscalResponsibility(data: ProposerData): number {
  const treasuryProposals = data.proposals.filter((p) => p.proposalType === 'TreasuryWithdrawals');

  // Non-treasury proposers get neutral score
  if (treasuryProposals.length === 0) return 50;

  // Sub-signal 1: Enacted rate for treasury asks (60%)
  const enacted = treasuryProposals.filter((p) => p.enacted).length;
  const enactedRate = (enacted / treasuryProposals.length) * 100;

  // Sub-signal 2: Delivery on funded proposals (40%)
  const funded = treasuryProposals.filter((p) => p.enacted);
  const withDelivery = funded.filter((p) => p.deliveryScore !== null);
  let deliveryScore = 50; // neutral when no delivery data
  if (withDelivery.length > 0) {
    deliveryScore =
      withDelivery.reduce((s, p) => s + (p.deliveryScore ?? 0), 0) / withDelivery.length;
  }

  return enactedRate * 0.6 + deliveryScore * 0.4;
}

function computeGovernanceCitizenship(data: ProposerData): number {
  // This pillar is the hardest to measure with current data.
  // For Phase A, we use proxy signals:

  // Sub-signal 1: Proposal type diversity (40%)
  // Proposers who engage across multiple governance areas show broader citizenship
  const types = new Set(data.proposals.map((p) => p.proposalType));
  const diversityScore = Math.min(100, types.size * 30); // 1 type=30, 2=60, 3+=90

  // Sub-signal 2: Proposal completeness (30%)
  // Treating specification quality as a citizenship signal — putting effort in
  const withBody = data.proposals.filter((p) => p.hasBody).length;
  const bodyRate = (withBody / data.proposals.length) * 100;

  // Sub-signal 3: Sustained engagement (30%)
  // Proposers who submit across multiple epochs show commitment
  const uniqueEpochs = new Set(
    data.proposals.map((p) => p.proposedEpoch).filter((e): e is number => e !== null),
  );
  const sustainedScore = Math.min(100, uniqueEpochs.size * 25); // 1 epoch=25, 2=50, 4+=100

  return diversityScore * 0.4 + bodyRate * 0.3 + sustainedScore * 0.3;
}

// ---------------------------------------------------------------------------
// Confidence & Tier
// ---------------------------------------------------------------------------

function computeConfidence(proposalCount: number): number {
  for (const tier of CONFIDENCE_TIERS) {
    if (proposalCount <= tier.maxProposals) return tier.confidence;
  }
  return 100;
}

function getTier(score: number, proposalCount: number): string {
  // Apply confidence cap
  for (const cap of CONFIDENCE_TIERS) {
    if (proposalCount <= cap.maxProposals) {
      const maxTierBoundary = TIER_BOUNDARIES.find((t) => t.name === cap.maxTier);
      if (maxTierBoundary) {
        // Find the tier for the actual score, but cap it
        const actualTier = TIER_BOUNDARIES.find((t) => score >= t.min && score <= t.max);
        const actualIdx = TIER_BOUNDARIES.findIndex((t) => t.name === actualTier?.name);
        const capIdx = TIER_BOUNDARIES.findIndex((t) => t.name === cap.maxTier);
        if (actualIdx > capIdx) return cap.maxTier;
      }
    }
  }
  return TIER_BOUNDARIES.find((t) => score >= t.min && score <= t.max)?.name ?? 'Emerging';
}

// ---------------------------------------------------------------------------
// Main scoring function
// ---------------------------------------------------------------------------

/**
 * Compute scores for all proposers and update the database.
 * Called by the Inngest sync pipeline.
 */
export async function scoreAllProposers(): Promise<{ scored: number }> {
  const supabase = getSupabaseAdmin();

  // 1. Fetch all proposers with their proposal links
  const { data: proposers, error: propErr } = await supabase
    .from('proposers')
    .select('id, proposal_count, enacted_count, dropped_count');

  if (propErr || !proposers?.length) {
    logger.error('[ProposerScore] Failed to fetch proposers', { error: propErr });
    return { scored: 0 };
  }

  let scored = 0;

  for (const proposer of proposers) {
    // 2. Fetch linked proposals with their data
    const { data: links } = await supabase
      .from('proposal_proposers')
      .select('proposal_tx_hash, proposal_index')
      .eq('proposer_id', proposer.id);

    if (!links?.length) continue;

    const txHashes = links.map((l) => l.proposal_tx_hash);

    const { data: proposals } = await supabase
      .from('proposals')
      .select(
        'tx_hash, proposal_index, proposal_type, withdrawal_amount, abstract, proposed_epoch, enacted_epoch, dropped_epoch, expired_epoch, ratified_epoch, meta_json',
      )
      .in('tx_hash', txHashes);

    if (!proposals?.length) continue;

    // 3. Get vote counts per proposal
    const { data: votes } = await supabase
      .from('drep_votes')
      .select('proposal_tx_hash, proposal_index')
      .in('proposal_tx_hash', txHashes);

    const voteCounts = new Map<string, number>();
    for (const v of votes ?? []) {
      const key = `${v.proposal_tx_hash}-${v.proposal_index}`;
      voteCounts.set(key, (voteCounts.get(key) ?? 0) + 1);
    }

    // 4. Get delivery scores
    const { data: outcomes } = await supabase
      .from('proposal_outcomes')
      .select('proposal_tx_hash, proposal_index, delivery_score')
      .in('proposal_tx_hash', txHashes);

    const deliveryScores = new Map<string, number | null>();
    for (const o of outcomes ?? []) {
      deliveryScores.set(`${o.proposal_tx_hash}-${o.proposal_index}`, o.delivery_score);
    }

    // 5. Build proposer data
    const proposerData: ProposerData = {
      id: proposer.id,
      proposalCount: proposer.proposal_count,
      enactedCount: proposer.enacted_count,
      droppedCount: proposer.dropped_count,
      proposals: proposals.map((p) => {
        const key = `${p.tx_hash}-${p.proposal_index}`;
        const meta = p.meta_json as Record<string, unknown> | null;
        return {
          txHash: p.tx_hash,
          proposalIndex: p.proposal_index,
          proposalType: p.proposal_type,
          withdrawalAmount: p.withdrawal_amount ? Number(p.withdrawal_amount) : null,
          hasAbstract: !!(p.abstract && (p.abstract as string).length > 10),
          hasBody: !!(meta && typeof meta.body === 'object' && meta.body !== null),
          proposedEpoch: p.proposed_epoch,
          enacted: !!(p.enacted_epoch || p.ratified_epoch),
          dropped: !!(
            p.dropped_epoch ||
            (p.expired_epoch && !p.enacted_epoch && !p.ratified_epoch)
          ),
          voteCount: voteCounts.get(key) ?? 0,
          deliveryScore: deliveryScores.get(key) ?? null,
        };
      }),
    };

    // 6. Compute pillars
    const rawTrackRecord = computeTrackRecord(proposerData);
    const rawQuality = computeProposalQuality(proposerData);
    const rawFiscal = computeFiscalResponsibility(proposerData);
    const rawCitizenship = computeGovernanceCitizenship(proposerData);

    // 7. Calibrate
    const calTrackRecord = calibrate(rawTrackRecord, PROPOSER_CALIBRATION.trackRecord);
    const calQuality = calibrate(rawQuality, PROPOSER_CALIBRATION.proposalQuality);
    const calFiscal = calibrate(rawFiscal, PROPOSER_CALIBRATION.fiscalResponsibility);
    const calCitizenship = calibrate(rawCitizenship, PROPOSER_CALIBRATION.governanceCitizenship);

    // 8. Composite
    const composite = Math.min(
      100,
      Math.max(
        0,
        Math.round(
          calTrackRecord * PROPOSER_PILLAR_WEIGHTS.trackRecord +
            calQuality * PROPOSER_PILLAR_WEIGHTS.proposalQuality +
            calFiscal * PROPOSER_PILLAR_WEIGHTS.fiscalResponsibility +
            calCitizenship * PROPOSER_PILLAR_WEIGHTS.governanceCitizenship,
        ),
      ),
    );

    const confidence = computeConfidence(proposer.proposal_count);
    const tier = getTier(composite, proposer.proposal_count);

    // 9. Update
    await supabase
      .from('proposers')
      .update({
        composite_score: composite,
        track_record_score: Math.round(calTrackRecord),
        proposal_quality_score: Math.round(calQuality),
        fiscal_responsibility_score: Math.round(calFiscal),
        governance_citizenship_score: Math.round(calCitizenship),
        confidence,
        tier,
        updated_at: new Date().toISOString(),
      })
      .eq('id', proposer.id);

    scored++;
  }

  logger.info('[ProposerScore] Scoring complete', { scored });
  return { scored };
}
