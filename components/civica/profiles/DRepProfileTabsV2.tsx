'use client';

import { AnimatedTabs, type TabDefinition } from '@/components/AnimatedTabs';
import { Vote, BarChart3, TrendingUp, Users, MessageSquare } from 'lucide-react';
import type { ReactNode } from 'react';

interface DRepProfileTabsV2Props {
  drepId?: string;
  votingRecordContent: ReactNode;
  scoreAnalysisContent: ReactNode;
  trajectoryContent: ReactNode;
  communityContent: ReactNode;
  /** Pass statementsContent to show the Statements tab (only when drep_communication flag is on) */
  statementsContent?: ReactNode;
}

/**
 * Civica VP2 tabs — same as DRepProfileTabs but with Phase B "Statements" tab scaffold.
 * The Statements tab is conditionally rendered (caller gates it with drep_communication flag).
 */
export function DRepProfileTabsV2({
  drepId,
  votingRecordContent,
  scoreAnalysisContent,
  trajectoryContent,
  communityContent,
  statementsContent,
}: DRepProfileTabsV2Props) {
  const tabs: TabDefinition[] = [
    {
      id: 'voting',
      label: 'Voting Record',
      icon: Vote,
      content: votingRecordContent,
    },
    {
      id: 'score',
      label: 'Score Analysis',
      icon: BarChart3,
      content: scoreAnalysisContent,
    },
    {
      id: 'trajectory',
      label: 'Trajectory',
      icon: TrendingUp,
      content: trajectoryContent,
    },
    {
      id: 'community',
      label: 'Community',
      icon: Users,
      content: communityContent,
    },
    // Phase B scaffold: only shown when drep_communication flag is on
    ...(statementsContent != null
      ? [
          {
            id: 'statements',
            label: 'Statements',
            icon: MessageSquare,
            content: statementsContent,
          } satisfies TabDefinition,
        ]
      : []),
  ];

  return (
    <AnimatedTabs
      tabs={tabs}
      defaultTab="voting"
      stickyOffset={64}
      trackingContext={drepId ? { drepId } : undefined}
    />
  );
}
