/**
 * Observatory Types — shared types for the unified governance observatory.
 */

// ---------------------------------------------------------------------------
// Playback Engine
// ---------------------------------------------------------------------------

export type PlaybackSpeed = 0.5 | 1 | 2 | 4;

export interface PlaybackState {
  /** Current epoch being viewed */
  epoch: number;
  /** Position within epoch: 0 = start, 1 = end (current moment for live) */
  position: number;
  /** Whether playback is active */
  isPlaying: boolean;
  /** Playback speed multiplier */
  speed: PlaybackSpeed;
  /** Whether we're viewing the live/current epoch */
  isLive: boolean;
  /** Compare mode: second epoch to overlay */
  compareEpoch: number | null;
}

// ---------------------------------------------------------------------------
// Epoch Events — used to sync across panels during playback
// ---------------------------------------------------------------------------

export type ObservatoryEventType =
  | 'treasury_withdrawal'
  | 'treasury_income'
  | 'cc_vote'
  | 'proposal_submitted'
  | 'proposal_ratified'
  | 'proposal_enacted'
  | 'proposal_expired'
  | 'proposal_dropped'
  | 'drep_activated'
  | 'drep_deactivated'
  | 'ghi_shift';

export interface ObservatoryEvent {
  type: ObservatoryEventType;
  /** Normalized position within epoch (0-1) */
  position: number;
  /** Human-readable label */
  label: string;
  /** Related proposal tx hash if applicable */
  proposalTxHash?: string;
  proposalIndex?: number;
  /** Related CC member if applicable */
  ccHotId?: string;
  /** Amount in ADA for treasury events */
  amountAda?: number;
  /** Category for treasury events */
  category?: string;
  /** Vote value for CC votes */
  vote?: 'yes' | 'no' | 'abstain';
  /** GHI delta for health events */
  ghiDelta?: number;
}

// ---------------------------------------------------------------------------
// Panel Focus
// ---------------------------------------------------------------------------

export type ObservatoryFocus = 'treasury' | 'committee' | 'health' | null;

// ---------------------------------------------------------------------------
// Observatory Data — aggregated from existing endpoints
// ---------------------------------------------------------------------------

export interface ObservatoryTreasurySummary {
  balanceAda: number;
  nclUtilizationPct: number;
  nclRemainingAda: number;
  pendingCount: number;
  pendingTotalAda: number;
  runwayMonths: number;
  burnRatePerEpoch: number;
  effectivenessRate: number;
  categories: {
    category: string;
    totalAda: number;
    proposalCount: number;
    pctOfTotal: number;
  }[];
  pendingProposals: {
    txHash: string;
    index: number;
    title: string;
    withdrawalAda: number;
    pctOfBalance: number;
    treasuryTier: string;
  }[];
}

export interface ObservatoryCommitteeSummary {
  status: 'healthy' | 'attention' | 'critical';
  narrative: string;
  trend: 'improving' | 'stable' | 'declining';
  activeMembers: number;
  avgFidelity: number | null;
  tensionCount: number;
  members: {
    ccHotId: string;
    name: string | null;
    fidelityGrade: string | null;
    fidelityScore: number | null;
    voteCount: number;
    yesCount: number;
    noCount: number;
    abstainCount: number;
    archetype?: string;
  }[];
  blocs: {
    label: string;
    members: string[];
    internalAgreementPct: number;
  }[];
  agreements: {
    memberA: string;
    memberB: string;
    voteAgreementPct: number;
  }[];
}

export interface ObservatoryHealthSummary {
  ghiScore: number;
  band: 'critical' | 'fair' | 'good' | 'strong';
  trend: { direction: 'improving' | 'stable' | 'declining'; delta: number };
  components: {
    key: string;
    label: string;
    category: 'engagement' | 'quality' | 'resilience';
    score: number;
    weight: number;
    trend: number;
  }[];
  history: { epoch: number; score: number }[];
}

// ---------------------------------------------------------------------------
// AI Narrative
// ---------------------------------------------------------------------------

export interface ObservatoryNarrative {
  /** One-paragraph unified briefing */
  unified: string;
  /** Domain-specific briefings (for expanded panel views) */
  treasury: string;
  committee: string;
  health: string;
  /** Generated at (ISO timestamp) */
  generatedAt: string;
}
