/**
 * Micro-Copy System — centralized copy bank for UI micro-moments.
 * The difference between a shadcn template and a product with personality.
 */

export const LOADING_MESSAGES = {
  proposals: 'Counting votes...',
  discover: 'Mapping the constellation...',
  dashboard: 'Checking the chain...',
  pulse: 'Reading the governance pulse...',
  treasury: 'Tallying the treasury...',
  profile: 'Loading your governance journey...',
  drep: 'Building their governance portrait...',
  default: 'Loading...',
} as const;

export const ERROR_MESSAGES = {
  generic: 'The chain threw us a curveball. Try refreshing.',
  network: 'Lost connection to the governance layer. Check your network and try again.',
  notFound: "We looked everywhere in the constellation — this page doesn't exist.",
  rateLimit: 'Too many requests. Governance moves at its own pace — try again in a moment.',
} as const;

export const SCORE_BAND_LABELS: Record<string, string> = {
  strong: 'Governance powerhouse',
  good: 'Solid contributor',
  fair: 'Getting started',
  low: 'Room to grow',
};

export const CTA_LABELS = {
  connectWallet: 'Enter Governance',
  connectWalletShort: 'Connect',
  exploreDreps: 'Explore DReps',
  seeProposals: 'See Live Proposals',
  delegate: 'Delegate Your Voice',
  findDrep: 'Find Your Representative',
  viewProfile: 'View Full Profile',
  compare: 'Compare DReps',
  claimProfile: 'Claim Your Profile',
} as const;

export const PAGE_DESCRIPTIONS = {
  discover: 'Find the representative that matches your governance values.',
  proposals: 'Track Cardano governance proposals, DRep votes, and treasury decisions in real time.',
  pulse: "Real-time health of Cardano's on-chain governance.",
  treasury: "How Cardano's treasury is being spent — and whether it should be.",
  governance: 'Your personal governance hub. Track your delegation and participation.',
  dashboard: 'Your command center for governance.',
  compare: 'See how DReps stack up against each other.',
} as const;

export const EMPTY_STATE_MESSAGES = {
  noProposals:
    'The governance pipeline has quiet moments — check back soon or broaden your search.',
  noDreps:
    'No DReps match. Try adjusting your filters — there are hundreds of active representatives to explore.',
  noVotes: 'This DRep may be new or taking a break from governance.',
  noWatchlist:
    "Your watchlist is empty. Star DReps you want to track — you'll see their activity here.",
  noInbox: 'All caught up! No pending actions right now.',
} as const;

export function getLoadingMessage(page: keyof typeof LOADING_MESSAGES): string {
  return LOADING_MESSAGES[page] || LOADING_MESSAGES.default;
}

export function getScoreBandLabel(score: number): string {
  if (score >= 80) return SCORE_BAND_LABELS.strong;
  if (score >= 60) return SCORE_BAND_LABELS.good;
  if (score >= 40) return SCORE_BAND_LABELS.fair;
  return SCORE_BAND_LABELS.low;
}

// ─── Governance Terms ────────────────────────────────────────────────────────

export type GovTermSegment = 'anonymous' | 'citizen' | 'drep' | 'spo';

export interface GovTermDef {
  /** Display label used as the tooltip trigger text */
  label: string;
  /** One-sentence plain definition */
  definition: string;
  /** Segment-aware "Why it matters" framing. Falls back to `default`. */
  whyItMatters: Partial<Record<GovTermSegment, string>> & { default: string };
}

export const GOV_TERMS: Record<string, GovTermDef> = {
  drep: {
    label: 'DRep',
    definition:
      'Someone who votes on Cardano decisions on behalf of ADA holders like you. Think of them as your elected representative.',
    whyItMatters: {
      anonymous:
        'When you choose a representative, your ADA backs their votes on every governance decision — without leaving your wallet.',
      citizen:
        'Your representative votes on every proposal using your ADA. Their track record tells you how well they represent your values.',
      drep: 'Your DRep status means every vote you cast carries the weight of everyone who delegated to you.',
      spo: 'DReps vote on governance actions that directly affect network parameters and treasury allocation — the same decisions that affect your pool.',
      default:
        'DReps vote on Cardano governance proposals using the voting power of the ADA holders who delegate to them.',
    },
  },
  epoch: {
    label: 'Epoch',
    definition:
      'Cardano works in 5-day cycles. At the end of each cycle, staking rewards are paid out and governance votes are counted.',
    whyItMatters: {
      citizen:
        'Governance proposals can expire at the end of a cycle — your representative has a narrow window to vote before the deadline.',
      drep: 'Each epoch is a governance window. Missed votes within an epoch are permanent — they drag your Reliability score.',
      default:
        'Epochs are the heartbeat of Cardano — rewards, delegation snapshots, and governance deadlines all align to epoch boundaries.',
    },
  },
  delegation: {
    label: 'Delegation',
    definition:
      'Choosing who votes on your behalf. Like voting in an election — you pick your representative, but your ADA stays in your wallet.',
    whyItMatters: {
      anonymous:
        "Delegating is free and doesn't move your ADA — you're just choosing who speaks for you in governance decisions.",
      citizen:
        'You can switch your representative at any time — the change takes effect at the start of the next 5-day cycle.',
      default:
        'Delegation is how ADA holders participate in governance without voting on every proposal themselves.',
    },
  },
  governanceAction: {
    label: 'Governance Action',
    definition:
      'A proposal to change something about Cardano — like spending community funds, updating network rules, or approving a major upgrade.',
    whyItMatters: {
      citizen:
        'Every proposal that passes changes how Cardano works — spending, network rules, and upgrades all go through this process. Your representative votes on each one.',
      drep: 'Your vote on each governance action is recorded on-chain permanently. How you vote (and whether you explain it) shapes your score.',
      default:
        "Governance actions are how Cardano's rules get changed. They require approval from DReps, stake pools, and the Constitutional Committee.",
    },
  },
  votingPower: {
    label: 'Voting Power',
    definition:
      'The total ADA backing a representative. The more ADA holders choose them, the more weight their votes carry.',
    whyItMatters: {
      citizen:
        'The more people choose the same representative, the stronger their voice in governance decisions.',
      drep: 'Governada deliberately excludes voting power from your score — governance quality, not whale capture, is what we reward.',
      default:
        "Voting power determines how much weight a DRep's vote carries. High voting power doesn't mean high quality.",
    },
  },
  rationale: {
    label: 'Rationale',
    definition:
      "A representative's explanation of why they voted a certain way. The reasoning behind the vote.",
    whyItMatters: {
      citizen:
        "Rationales show you your representative's thinking — the difference between someone who deliberates and someone who just clicks a button.",
      drep: 'Providing rationales is the single highest-leverage action to improve your Engagement Quality score. Each one is AI-analyzed for depth.',
      default:
        'Rationales turn votes from yes/no signals into accountable positions — essential for informed delegation.',
    },
  },
  drepScore: {
    label: 'DRep Score',
    definition:
      'A quality score from 0 to 100 measuring how well a representative does their job — based on how they vote, how often they participate, and how transparent they are.',
    whyItMatters: {
      citizen:
        'The score gives you a quick read on representative quality. Higher is better — but tap through to see the details behind the number.',
      drep: 'Your score is percentile-normalized against all DReps. Improving any pillar moves you up relative to the field.',
      default:
        "The DRep Score isn't about voting power — it measures governance discipline, transparency, and engagement quality.",
    },
  },
  tier: {
    label: 'Governance Tier',
    definition:
      'A quality ranking for representatives: Emerging, Bronze, Silver, Gold, Diamond, and Legendary. Like a trust badge — higher tiers mean better governance track records.',
    whyItMatters: {
      citizen:
        'Tier badges give you an instant read on how good a representative is without needing to understand the numbers.',
      drep: 'Each tier unlock is a milestone — Diamond and Legendary DReps are in the top 15% and 5% of the field respectively.',
      default:
        'Tiers translate percentile scores into memorable, comparable labels that make governance quality scannable at a glance.',
    },
  },
  treasury: {
    label: 'Treasury',
    definition:
      "Cardano's community fund — built from transaction fees — that pays for ecosystem development. Like a city budget that residents vote on.",
    whyItMatters: {
      citizen:
        'Your representative votes on how this money is spent. Large withdrawals can fund critical projects — or waste community resources.',
      drep: 'Treasury governance actions carry the highest stakes. Your treasury voting record is scrutinized by delegators and analysts.',
      default:
        'The Cardano treasury holds billions in ADA. Every withdrawal requires governance approval from DReps, pools, and the Constitutional Committee.',
    },
  },
  constitutionalCommittee: {
    label: 'Constitutional Committee',
    definition:
      "A group of elected officials who make sure all governance decisions follow Cardano's rules (the constitution). They're the final check.",
    whyItMatters: {
      citizen:
        'Even if representatives approve a proposal, this committee can block it if it breaks the rules — protecting your interests.',
      default:
        'The Constitutional Committee is one of three governance bodies. Their approval (alongside DReps and stake pools) is required for most governance actions.',
    },
  },
  hardFork: {
    label: 'Hard Fork',
    definition:
      'A major software upgrade to Cardano that everyone on the network adopts at the same time. Think of it as a system-wide update.',
    whyItMatters: {
      citizen:
        "These upgrades change how Cardano works at a fundamental level. Your representative's vote shapes the network's future.",
      spo: 'Hard forks require pool operators to update node software — your vote and upgrade readiness both matter here.',
      default:
        'Hard forks are the highest-stakes governance actions — they literally change how Cardano works at the protocol level.',
    },
  },
  quorum: {
    label: 'Quorum',
    definition:
      "The minimum number of people who need to participate for a vote to count. If not enough representatives show up, the decision doesn't go through.",
    whyItMatters: {
      citizen:
        "If not enough representatives vote, a decision can't pass — even if everyone who voted said yes. That's why having an active representative matters.",
      drep: "Low participation hurts everyone — if overall DRep voting doesn't reach quorum, governance actions fail even if those who voted approved them.",
      default:
        "Quorum prevents a small group from passing governance actions when most of the network isn't paying attention.",
    },
  },
} as const;

export function getGovTerm(key: string): GovTermDef | null {
  return GOV_TERMS[key as keyof typeof GOV_TERMS] ?? null;
}

export function getWhyItMatters(term: GovTermDef, segment?: GovTermSegment | null): string {
  if (segment && segment in term.whyItMatters) {
    return (term.whyItMatters as Record<string, string>)[segment];
  }
  return term.whyItMatters.default;
}
