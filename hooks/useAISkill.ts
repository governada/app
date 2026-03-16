'use client';

/**
 * TanStack Query hook for invoking AI skills.
 *
 * Wraps POST /api/ai/skill. Returns structured output + provenance metadata.
 */

import { useMutation } from '@tanstack/react-query';
import { getStoredSession } from '@/lib/supabaseAuth';
import type { SkillResult } from '@/lib/ai/skills/types';

interface SkillInvocationParams {
  skill: string;
  input: Record<string, unknown>;
  proposalTxHash?: string;
  proposalIndex?: number;
  draftId?: string;
}

/** Invoke an AI skill and return the structured result with provenance. */
export function useAISkill<T = unknown>() {
  return useMutation<SkillResult<T>, Error, SkillInvocationParams>({
    mutationFn: async (params) => {
      const token = getStoredSession();
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const res = await fetch('/api/ai/skill', {
        method: 'POST',
        headers,
        body: JSON.stringify(params),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? `AI skill failed (${res.status})`);
      }

      const data = await res.json();

      // Fire PostHog event
      import('@/lib/posthog')
        .then(({ posthog }) =>
          posthog.capture('ai_skill_invoked', {
            skill: params.skill,
            key_source: data.provenance?.keySource,
            model: data.provenance?.model,
          }),
        )
        .catch(() => {});

      return data as SkillResult<T>;
    },
  });
}
