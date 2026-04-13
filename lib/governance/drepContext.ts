import type { createClient } from '@/lib/supabase';
import { getDRepTreasuryTrackRecord, type DRepTreasuryRecord } from '@/lib/treasury';

type QueryClient = Pick<ReturnType<typeof createClient>, 'from'>;

export interface GovernanceAlignmentProfile {
  personalityLabel: string | null;
  alignmentScores: Record<string, number> | null;
}

export interface GovernanceDrepAlignmentScores {
  treasuryConservative: number;
  treasuryGrowth: number;
  decentralization: number;
  security: number;
  innovation: number;
  transparency: number;
}

export interface GovernanceDrepSnapshot {
  id: string;
  name: string;
  score: number;
  sizeTier: string | null;
  effectiveParticipation: number | null;
  rationaleRate: number | null;
  scoreMomentum: number | null;
  alignmentScores: GovernanceDrepAlignmentScores;
  treasuryTrackRecord: DRepTreasuryRecord | null;
}

export interface DrepPersonalVote {
  proposalTitle: string;
  vote: string;
  rationaleSnippet: string | null;
}

export interface DrepPersonalContextSeed {
  drepId: string | null;
  philosophy: string | null;
  recentVotes: DrepPersonalVote[];
}

function readAlignmentDimension(
  scores: Record<string, unknown> | null | undefined,
  camelKey: keyof GovernanceDrepAlignmentScores,
  snakeKey: string,
): number {
  return coerceAlignmentScore(scores?.[camelKey] ?? scores?.[snakeKey]);
}

function coerceAlignmentScore(value: unknown): number {
  if (value == null) return 50;
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : 50;
}

function toAlignmentScores(
  row: Record<string, unknown> | null | undefined,
): GovernanceDrepAlignmentScores {
  return {
    treasuryConservative: coerceAlignmentScore(row?.alignment_treasury_conservative),
    treasuryGrowth: coerceAlignmentScore(row?.alignment_treasury_growth),
    decentralization: coerceAlignmentScore(row?.alignment_decentralization),
    security: coerceAlignmentScore(row?.alignment_security),
    innovation: coerceAlignmentScore(row?.alignment_innovation),
    transparency: coerceAlignmentScore(row?.alignment_transparency),
  };
}

function buildAlignmentVector(
  scores: GovernanceDrepAlignmentScores | Record<string, number> | null | undefined,
): number[] {
  return [
    readAlignmentDimension(scores as Record<string, unknown> | null | undefined, 'treasuryConservative', 'treasury_conservative'),
    readAlignmentDimension(scores as Record<string, unknown> | null | undefined, 'treasuryGrowth', 'treasury_growth'),
    readAlignmentDimension(scores as Record<string, unknown> | null | undefined, 'decentralization', 'decentralization'),
    readAlignmentDimension(scores as Record<string, unknown> | null | undefined, 'security', 'security'),
    readAlignmentDimension(scores as Record<string, unknown> | null | undefined, 'innovation', 'innovation'),
    readAlignmentDimension(scores as Record<string, unknown> | null | undefined, 'transparency', 'transparency'),
  ];
}

function normalizeAlignmentScores(
  scores: Record<string, unknown> | null | undefined,
): GovernanceDrepAlignmentScores | null {
  if (!scores || typeof scores !== 'object') {
    return null;
  }

  return {
    treasuryConservative: readAlignmentDimension(scores, 'treasuryConservative', 'treasury_conservative'),
    treasuryGrowth: readAlignmentDimension(scores, 'treasuryGrowth', 'treasury_growth'),
    decentralization: readAlignmentDimension(scores, 'decentralization', 'decentralization'),
    security: readAlignmentDimension(scores, 'security', 'security'),
    innovation: readAlignmentDimension(scores, 'innovation', 'innovation'),
    transparency: readAlignmentDimension(scores, 'transparency', 'transparency'),
  };
}

function cosineSimilarity(a: number[], b: number[]): number | null {
  if (a.length === 0 || a.length !== b.length) return null;

  let dot = 0;
  let magnitudeA = 0;
  let magnitudeB = 0;

  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    magnitudeA += a[i] * a[i];
    magnitudeB += b[i] * b[i];
  }

  const denominator = Math.sqrt(magnitudeA) * Math.sqrt(magnitudeB);
  if (denominator === 0) return null;
  return dot / denominator;
}

export function buildDrepPhilosophyText(metadata: unknown): string | null {
  if (!metadata || typeof metadata !== 'object') {
    return null;
  }

  const meta = metadata as Record<string, unknown>;
  const parts: string[] = [];
  if (meta.objectives) parts.push(`Objectives: ${meta.objectives}`);
  if (meta.motivations) parts.push(`Motivations: ${meta.motivations}`);
  if (meta.qualifications) parts.push(`Qualifications: ${meta.qualifications}`);

  return parts.join('\n') || null;
}

export async function resolveClaimedDrepIdForWallet(
  supabase: QueryClient,
  walletAddress: string,
): Promise<string | null> {
  if (!walletAddress) return null;

  const { data } = await supabase
    .from('users')
    .select('claimed_drep_id')
    .eq('wallet_address', walletAddress)
    .maybeSingle();

  return typeof data?.claimed_drep_id === 'string' && data.claimed_drep_id.length > 0
    ? data.claimed_drep_id
    : null;
}

export async function fetchGovernanceAlignmentProfile(
  supabase: QueryClient,
  actorAddress: string,
): Promise<GovernanceAlignmentProfile | null> {
  if (!actorAddress) return null;

  const { data } = await supabase
    .from('user_governance_profiles')
    .select('personality_label, alignment_scores')
    .eq('wallet_address', actorAddress)
    .maybeSingle();

  if (!data) return null;

  const normalizedAlignmentScores = normalizeAlignmentScores(
    (data.alignment_scores as Record<string, unknown> | null) ?? null,
  );

  return {
    personalityLabel: data.personality_label ?? null,
    alignmentScores: normalizedAlignmentScores as Record<string, number> | null,
  };
}

export async function fetchGovernanceDrepSnapshot(
  supabase: QueryClient,
  drepId: string,
): Promise<GovernanceDrepSnapshot | null> {
  const [{ data: drep }, treasuryTrackRecord] = await Promise.all([
    supabase
      .from('dreps')
      .select(
        'id, score, info, size_tier, effective_participation, rationale_rate, alignment_treasury_conservative, alignment_treasury_growth, alignment_decentralization, alignment_security, alignment_innovation, alignment_transparency, score_momentum',
      )
      .eq('id', drepId)
      .maybeSingle(),
    getDRepTreasuryTrackRecord(drepId).catch(() => null),
  ]);

  if (!drep) {
    return null;
  }

  const info = (drep.info ?? {}) as Record<string, unknown>;

  return {
    id: drep.id,
    name: (info.name as string) || drep.id.slice(0, 16),
    score: drep.score ?? 0,
    sizeTier: drep.size_tier ?? null,
    effectiveParticipation: drep.effective_participation ?? null,
    rationaleRate: drep.rationale_rate ?? null,
    scoreMomentum: drep.score_momentum ?? null,
    alignmentScores: toAlignmentScores(drep as Record<string, unknown>),
    treasuryTrackRecord,
  };
}

export async function fetchDrepPersonalContextSeed(
  supabase: QueryClient,
  walletAddress: string,
): Promise<DrepPersonalContextSeed> {
  const drepId = await resolveClaimedDrepIdForWallet(supabase, walletAddress);
  if (!drepId) {
    return { drepId: null, philosophy: null, recentVotes: [] };
  }

  const [{ data: drep }, { data: votes }] = await Promise.all([
    supabase.from('dreps').select('metadata').eq('id', drepId).maybeSingle(),
    supabase
      .from('drep_votes')
      .select('vote, block_time, proposals!inner(title)')
      .eq('drep_id', drepId)
      .order('block_time', { ascending: false })
      .limit(10),
  ]);

  return {
    drepId,
    philosophy: buildDrepPhilosophyText(drep?.metadata ?? null),
    recentVotes: (votes ?? []).map((vote) => ({
      proposalTitle: (vote.proposals as { title?: string })?.title ?? 'Unknown',
      vote: vote.vote ?? 'Unknown',
      rationaleSnippet: null,
    })),
  };
}

export function computeAlignmentMatchPercent(
  viewerProfile: GovernanceAlignmentProfile | null,
  drepAlignmentScores: GovernanceDrepAlignmentScores,
): number | null {
  if (!viewerProfile?.alignmentScores) {
    return null;
  }

  const similarity = cosineSimilarity(
    buildAlignmentVector(viewerProfile.alignmentScores),
    buildAlignmentVector(drepAlignmentScores),
  );

  return similarity == null ? null : Math.round(similarity * 100);
}
