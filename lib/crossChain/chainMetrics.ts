import type { Chain, ChainBenchmark } from '@/lib/crossChain';

// ---------------------------------------------------------------------------
// Governance model descriptions
// ---------------------------------------------------------------------------

export const GOVERNANCE_MODELS: Record<
  Chain,
  { tagline: string; description: string; source: string }
> = {
  cardano: {
    tagline: 'DRep-based delegation',
    description:
      'Cardano uses delegated representatives (DReps) who vote on governance proposals on behalf of ADA holders. Any ADA holder can become a DRep or delegate to one. Proposals cover treasury spending, protocol parameters, and constitutional changes.',
    source: 'Cardano GHI (on-chain via Koios)',
  },
  ethereum: {
    tagline: 'DAO token voting',
    description:
      'Ethereum governance is fragmented across independent DAOs, each with their own token and voting rules. Delegates vote on behalf of token holders within each DAO. There is no unified chain-level governance.',
    source: 'Tally',
  },
  polkadot: {
    tagline: 'Conviction voting',
    description:
      'Polkadot uses conviction voting where token holders lock tokens for longer periods to increase their voting weight. Referenda pass through multiple tracks with different approval thresholds based on impact level.',
    source: 'SubSquare',
  },
};

// ---------------------------------------------------------------------------
// Chain-specific metric definitions
// ---------------------------------------------------------------------------

export interface ChainMetric {
  key: string;
  label: string;
  value: number | string | null;
  context: string;
  source: string;
}

type MetricExtractor = (b: ChainBenchmark) => ChainMetric[];

function raw<T>(b: ChainBenchmark, key: string): T | undefined {
  return (b.rawData as Record<string, unknown>)?.[key] as T | undefined;
}

const cardanoMetrics: MetricExtractor = (b) => {
  const ghiScore = raw<number>(b, 'ghiScore');
  const ghiBand = raw<string>(b, 'ghiBand');
  const components = raw<{ name: string; value: number }[]>(b, 'components') ?? [];
  const participation = components.find((c) => c.name === 'Participation');
  const rationale = components.find((c) => c.name === 'Rationale');

  return [
    {
      key: 'ghi',
      label: 'GHI Score',
      value: ghiScore != null ? `${ghiScore} (${ghiBand ?? '—'})` : null,
      context: 'Governance Health Index — composite health score for Cardano governance',
      source: 'GHI',
    },
    {
      key: 'dreps',
      label: 'Active DReps',
      value: b.delegateCount,
      context: 'Delegated representatives currently registered and eligible to vote',
      source: 'GHI',
    },
    {
      key: 'participation',
      label: 'DRep Participation',
      value: participation?.value != null ? `${participation.value}%` : null,
      context: 'Median participation rate of active DReps across recent proposals',
      source: 'GHI',
    },
    {
      key: 'rationale',
      label: 'Rationale Rate',
      value: rationale?.value != null ? `${rationale.value}%` : null,
      context: 'Percentage of DRep votes that include a written rationale',
      source: 'GHI',
    },
    {
      key: 'proposals',
      label: 'Open Proposals',
      value: b.proposalCount,
      context: 'Governance proposals currently tracked',
      source: 'GHI',
    },
    {
      key: 'throughput',
      label: 'Proposal Throughput',
      value: b.proposalThroughput != null ? `${b.proposalThroughput}%` : null,
      context: 'Percentage of proposals receiving votes from DReps',
      source: 'GHI',
    },
  ];
};

const ethereumMetrics: MetricExtractor = (b) => {
  const orgs = raw<{ slug: string; name: string; delegates: number; proposals: number }[]>(b, 'orgs') ?? [];
  const totalTokenOwners = raw<number>(b, 'totalTokenOwners');

  return [
    {
      key: 'daos',
      label: 'Active DAOs',
      value: orgs.length || null,
      context: 'Top DAOs tracked via Tally — each has independent token governance',
      source: 'Tally',
    },
    {
      key: 'delegates',
      label: 'Total Delegates',
      value: b.delegateCount,
      context: 'Combined delegates across all tracked DAOs',
      source: 'Tally',
    },
    {
      key: 'turnout',
      label: 'Avg Voter Turnout',
      value: b.participationRate != null ? `${b.participationRate}%` : null,
      context: 'Average voters per proposal relative to delegates in the top DAO',
      source: 'Tally',
    },
    {
      key: 'proposals',
      label: 'Proposal Volume',
      value: b.proposalCount,
      context: 'Total proposals across all tracked DAOs',
      source: 'Tally',
    },
    {
      key: 'throughput',
      label: 'Proposal Throughput',
      value: b.proposalThroughput != null ? `${b.proposalThroughput}%` : null,
      context: 'Percentage of recent proposals that received at least one vote',
      source: 'Tally',
    },
    {
      key: 'tokenOwners',
      label: 'Token Owners',
      value: totalTokenOwners ?? null,
      context: 'Combined governance token holders across all tracked DAOs',
      source: 'Tally',
    },
  ];
};

const polkadotMetrics: MetricExtractor = (b) => {
  const recentCount = raw<number>(b, 'recentReferendaCount') ?? 0;

  return [
    {
      key: 'totalReferenda',
      label: 'Total Referenda',
      value: b.proposalCount,
      context: 'Lifetime OpenGov referenda — proposals voted on by token holders',
      source: 'SubSquare',
    },
    {
      key: 'activeReferenda',
      label: 'Active Referenda',
      value: b.participationRate != null && b.proposalCount != null
        ? Math.round((b.participationRate / 100) * b.proposalCount)
        : null,
      context: 'Referenda currently open for voting',
      source: 'SubSquare',
    },
    {
      key: 'throughput',
      label: 'Recent Throughput',
      value: b.proposalThroughput != null ? `${b.proposalThroughput}%` : null,
      context: 'Percentage of recent referenda that received on-chain votes',
      source: 'SubSquare',
    },
    {
      key: 'recentCount',
      label: 'Recent Referenda',
      value: recentCount || null,
      context: 'Number of referenda in the most recent batch fetched',
      source: 'SubSquare',
    },
  ];
};

const EXTRACTORS: Record<Chain, MetricExtractor> = {
  cardano: cardanoMetrics,
  ethereum: ethereumMetrics,
  polkadot: polkadotMetrics,
};

export function getChainMetrics(benchmark: ChainBenchmark): ChainMetric[] {
  const extractor = EXTRACTORS[benchmark.chain];
  return extractor(benchmark).filter((m) => m.value != null);
}

// ---------------------------------------------------------------------------
// Headline metric for compact variant
// ---------------------------------------------------------------------------

export function getHeadlineMetric(benchmark: ChainBenchmark): string {
  switch (benchmark.chain) {
    case 'cardano':
      return benchmark.delegateCount != null
        ? `${formatCompact(benchmark.delegateCount)} DReps`
        : 'No data';
    case 'ethereum':
      return benchmark.delegateCount != null
        ? `${formatCompact(benchmark.delegateCount)} delegates`
        : 'No data';
    case 'polkadot':
      return benchmark.proposalCount != null
        ? `${formatCompact(benchmark.proposalCount)} referenda`
        : 'No data';
  }
}

function formatCompact(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toLocaleString();
}
