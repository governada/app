'use client';

import { useMutation } from '@tanstack/react-query';
import type { AmendmentBridgeOutput } from '@/lib/constitution/types';
import { postJson } from '@/lib/api/client';

// ---------------------------------------------------------------------------
// Mutation (on-demand, not auto-fetch)
// ---------------------------------------------------------------------------

interface BridgeResponse {
  output: AmendmentBridgeOutput;
  provenance: {
    skillName: string;
    model: string;
    keySource: 'platform' | 'byok';
    tokensUsed?: number;
    executedAt: string;
  };
}

/** Generate bridging statements for an amendment draft (on-demand). */
export function useAmendmentBridging(draftId: string | null) {
  return useMutation({
    mutationFn: () => {
      if (!draftId) throw new Error('draftId is required');
      return postJson<BridgeResponse>('/api/workspace/amendment-bridge', { draftId });
    },
  });
}
