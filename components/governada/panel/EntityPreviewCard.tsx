'use client';

/**
 * EntityPreviewCard — compact entity card rendered within the Co-Pilot panel
 * entity preview.
 *
 * Reuses the same data-fetching patterns as peek drawer variants (DRepPeek,
 * ProposalPeek, PoolPeek, CCMemberPeek) but in a panel-width layout.
 *
 * Feature-flagged behind `governance_copilot`.
 */

import type { PeekEntityType } from '@/hooks/usePeekDrawer';
import { ProposalPeek } from '@/components/governada/peeks/ProposalPeek';
import { DRepPeek } from '@/components/governada/peeks/DRepPeek';
import { PoolPeek } from '@/components/governada/peeks/PoolPeek';
import { CCMemberPeek } from '@/components/governada/peeks/CCMemberPeek';

interface EntityPreviewCardProps {
  type: PeekEntityType;
  id: string;
  secondaryId?: string | number;
}

/**
 * Routes to the correct peek variant based on entity type.
 * The peek components already fetch their own data and render
 * loading skeletons — they work identically inside the panel.
 */
export function EntityPreviewCard({ type, id, secondaryId }: EntityPreviewCardProps) {
  switch (type) {
    case 'proposal':
      return (
        <ProposalPeek
          txHash={id}
          index={
            typeof secondaryId === 'number' ? secondaryId : parseInt(String(secondaryId ?? '0'), 10)
          }
        />
      );
    case 'drep':
      return <DRepPeek drepId={id} />;
    case 'pool':
      return <PoolPeek poolId={id} />;
    case 'cc':
      return <CCMemberPeek ccHotId={id} />;
    default:
      return null;
  }
}
