/**
 * Treasury Spending Categories
 *
 * Aggregates enacted treasury withdrawals by derived category,
 * combining AI classification dimensions with title keyword matching.
 */

import { createClient } from '@/lib/supabase';
import { lovelaceToAda } from '@/lib/treasury';
import { logger } from '@/lib/logger';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface SpendingProposal {
  title: string;
  amountAda: number;
  epoch: number;
  txHash: string;
  index: number;
}

export interface SpendingCategory {
  category: string;
  totalAda: number;
  proposalCount: number;
  pctOfTotal: number;
  proposals: SpendingProposal[];
}

export interface SpendingTrendPoint {
  epoch: number;
  categories: Record<string, number>;
}

// ---------------------------------------------------------------------------
// Category classification
// ---------------------------------------------------------------------------

const CATEGORIES = [
  'Development & Infrastructure',
  'Community & Education',
  'Security & Audit',
  'Research',
  'Operations',
  'Other',
] as const;

type CategoryName = (typeof CATEGORIES)[number];

interface ClassificationScores {
  dimTreasuryGrowth: number;
  dimInnovation: number;
  dimSecurity: number;
  dimDecentralization: number;
  dimTransparency: number;
}

/** Keyword patterns mapped to categories (checked against lowercased title). */
const KEYWORD_MAP: Array<{ pattern: RegExp; category: CategoryName }> = [
  { pattern: /\baudit\b|\bsecur|\bpentesting|\bvulnerabilit/, category: 'Security & Audit' },
  {
    pattern: /\beducat|\bcommunity|\boutreach|\bonboard|\bworkshop|\bbootcamp|\bhackathon/,
    category: 'Community & Education',
  },
  {
    pattern: /\bresearch|\bacadem|\bstudy|\banalys|\bwhitepaper|\bpaper\b/,
    category: 'Research',
  },
  {
    pattern:
      /\bdevelop|\bbuild|\binfrastructur|\btool|\bsdk|\bapi\b|\bprotocol|\bplatform|\bopen.?source|\bsoftware|\bnode\b|\bchain/,
    category: 'Development & Infrastructure',
  },
  {
    pattern: /\boperat|\badmin|\blegal|\bmarketing|\bhr\b|\bsalar|\bstaff|\bteam\b|\bgovernan/,
    category: 'Operations',
  },
];

/**
 * Classify a proposal into one of ~6 categories using a combination of
 * AI dimension scores and title keyword matching.
 */
function classifyProposal(title: string | null, dims: ClassificationScores | null): CategoryName {
  const lowerTitle = (title ?? '').toLowerCase();

  // 1. Title keyword match (highest confidence)
  for (const { pattern, category } of KEYWORD_MAP) {
    if (pattern.test(lowerTitle)) return category;
  }

  // 2. AI dimension-based classification
  if (dims) {
    const { dimSecurity, dimInnovation, dimDecentralization, dimTransparency, dimTreasuryGrowth } =
      dims;

    // Threshold-based mapping — pick the highest-scoring dimension
    const dimMap: Array<{ score: number; category: CategoryName }> = [
      { score: dimSecurity, category: 'Security & Audit' },
      { score: dimInnovation, category: 'Development & Infrastructure' },
      { score: dimDecentralization, category: 'Community & Education' },
      { score: dimTransparency, category: 'Operations' },
      { score: dimTreasuryGrowth, category: 'Development & Infrastructure' },
    ];

    const best = dimMap.reduce((a, b) => (b.score > a.score ? b : a));
    if (best.score >= 0.5) return best.category;
  }

  return 'Other';
}

// ---------------------------------------------------------------------------
// Main query functions
// ---------------------------------------------------------------------------

/**
 * Fetch all enacted TreasuryWithdrawals proposals, classify them,
 * and return spending grouped by category.
 */
export async function getTreasurySpendingByCategory(): Promise<SpendingCategory[]> {
  const supabase = createClient();

  // Fetch enacted treasury withdrawal proposals
  const { data: proposals, error: propError } = await supabase
    .from('proposals')
    .select('tx_hash, proposal_index, title, withdrawal_amount, enacted_epoch')
    .eq('proposal_type', 'TreasuryWithdrawals')
    .not('enacted_epoch', 'is', null)
    .order('enacted_epoch', { ascending: true });

  if (propError) {
    logger.error('[treasury-categories] Failed to fetch proposals', { error: propError.message });
    return [];
  }

  if (!proposals || proposals.length === 0) return [];

  // Fetch AI classifications for these proposals
  const txHashes = [...new Set(proposals.map((p) => p.tx_hash))];
  const { data: classifications } = await supabase
    .from('proposal_classifications')
    .select(
      'proposal_tx_hash, proposal_index, dim_treasury_growth, dim_innovation, dim_security, dim_decentralization, dim_transparency',
    )
    .in('proposal_tx_hash', txHashes);

  const classMap = new Map<string, ClassificationScores>();
  for (const c of classifications ?? []) {
    classMap.set(`${c.proposal_tx_hash}-${c.proposal_index}`, {
      dimTreasuryGrowth: c.dim_treasury_growth ?? 0,
      dimInnovation: c.dim_innovation ?? 0,
      dimSecurity: c.dim_security ?? 0,
      dimDecentralization: c.dim_decentralization ?? 0,
      dimTransparency: c.dim_transparency ?? 0,
    });
  }

  // Group proposals by category
  const categoryMap = new Map<string, { totalAda: number; proposals: SpendingProposal[] }>();

  for (const cat of CATEGORIES) {
    categoryMap.set(cat, { totalAda: 0, proposals: [] });
  }

  let grandTotal = 0;

  for (const p of proposals) {
    const amountAda = p.withdrawal_amount ? lovelaceToAda(p.withdrawal_amount) : 0;
    if (amountAda <= 0) continue;

    const key = `${p.tx_hash}-${p.proposal_index}`;
    const dims = classMap.get(key) ?? null;
    const category = classifyProposal(p.title, dims);

    const entry = categoryMap.get(category)!;
    entry.totalAda += amountAda;
    entry.proposals.push({
      title: p.title ?? 'Untitled Proposal',
      amountAda,
      epoch: p.enacted_epoch!,
      txHash: p.tx_hash,
      index: p.proposal_index,
    });

    grandTotal += amountAda;
  }

  // Build result array, sorted by totalAda descending
  const result: SpendingCategory[] = [];
  for (const [category, data] of categoryMap) {
    if (data.proposals.length === 0) continue;
    result.push({
      category,
      totalAda: data.totalAda,
      proposalCount: data.proposals.length,
      pctOfTotal: grandTotal > 0 ? (data.totalAda / grandTotal) * 100 : 0,
      proposals: data.proposals.sort((a, b) => b.amountAda - a.amountAda),
    });
  }

  result.sort((a, b) => b.totalAda - a.totalAda);
  return result;
}

/**
 * Return epoch-by-epoch spending aggregated by category
 * for a stacked area / trend chart.
 */
export async function getSpendingTrend(): Promise<SpendingTrendPoint[]> {
  const supabase = createClient();

  const { data: proposals, error } = await supabase
    .from('proposals')
    .select('tx_hash, proposal_index, title, withdrawal_amount, enacted_epoch')
    .eq('proposal_type', 'TreasuryWithdrawals')
    .not('enacted_epoch', 'is', null)
    .order('enacted_epoch', { ascending: true });

  if (error || !proposals || proposals.length === 0) return [];

  // Fetch classifications
  const txHashes = [...new Set(proposals.map((p) => p.tx_hash))];
  const { data: classifications } = await supabase
    .from('proposal_classifications')
    .select(
      'proposal_tx_hash, proposal_index, dim_treasury_growth, dim_innovation, dim_security, dim_decentralization, dim_transparency',
    )
    .in('proposal_tx_hash', txHashes);

  const classMap = new Map<string, ClassificationScores>();
  for (const c of classifications ?? []) {
    classMap.set(`${c.proposal_tx_hash}-${c.proposal_index}`, {
      dimTreasuryGrowth: c.dim_treasury_growth ?? 0,
      dimInnovation: c.dim_innovation ?? 0,
      dimSecurity: c.dim_security ?? 0,
      dimDecentralization: c.dim_decentralization ?? 0,
      dimTransparency: c.dim_transparency ?? 0,
    });
  }

  // Group by epoch
  const epochMap = new Map<number, Record<string, number>>();

  for (const p of proposals) {
    const amountAda = p.withdrawal_amount ? lovelaceToAda(p.withdrawal_amount) : 0;
    if (amountAda <= 0 || !p.enacted_epoch) continue;

    const key = `${p.tx_hash}-${p.proposal_index}`;
    const dims = classMap.get(key) ?? null;
    const category = classifyProposal(p.title, dims);

    if (!epochMap.has(p.enacted_epoch)) {
      epochMap.set(p.enacted_epoch, {});
    }
    const cats = epochMap.get(p.enacted_epoch)!;
    cats[category] = (cats[category] ?? 0) + amountAda;
  }

  // Sort by epoch and return
  return Array.from(epochMap.entries())
    .sort(([a], [b]) => a - b)
    .map(([epoch, categories]) => ({ epoch, categories }));
}
