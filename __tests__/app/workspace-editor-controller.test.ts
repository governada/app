import { describe, expect, it } from 'vitest';
import {
  deriveWorkspaceEditorPermissions,
  deriveWorkspaceEditorReadinessBadge,
} from '@/app/workspace/editor/_hooks/useWorkspaceEditorController';

describe('workspace editor controller helpers', () => {
  it('derives proposer permissions for the owner', () => {
    expect(
      deriveWorkspaceEditorPermissions({
        stakeAddress: 'stake_owner',
        ownerStakeAddress: 'stake_owner',
        teamRole: null,
        draftStatus: 'draft',
        segment: 'drep',
      }),
    ).toEqual({
      isOwner: true,
      canEdit: true,
      readOnly: false,
      stageReadOnly: false,
      userRole: 'proposer',
    });
  });

  it('derives read-only state for community review drafts', () => {
    expect(
      deriveWorkspaceEditorPermissions({
        stakeAddress: 'stake_viewer',
        ownerStakeAddress: 'stake_owner',
        teamRole: 'viewer',
        draftStatus: 'community_review',
        segment: 'cc',
      }),
    ).toEqual({
      isOwner: false,
      canEdit: false,
      readOnly: true,
      stageReadOnly: true,
      userRole: 'cc_member',
    });
  });

  it('flags incomplete drafts with a low readiness badge', () => {
    expect(
      deriveWorkspaceEditorReadinessBadge(
        {
          title: 'Title',
          abstract: 'Short abstract',
          motivation: '',
          rationale: '',
          lastConstitutionalCheck: { score: 'fail' } as never,
        },
        true,
      ),
    ).toEqual({ level: 'low', blockerCount: 2 });
  });

  it('returns strong readiness for a complete passing draft', () => {
    expect(
      deriveWorkspaceEditorReadinessBadge(
        {
          title: 'A complete title',
          abstract: 'A substantially long abstract for the proposal',
          motivation: 'Motivation text',
          rationale: 'Rationale text',
          lastConstitutionalCheck: { score: 'pass' } as never,
        },
        true,
      ),
    ).toEqual({ level: 'strong', blockerCount: 0 });
  });
});
