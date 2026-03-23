/**
 * Inngest: Score Proposers
 *
 * Resolves proposer identities from CIP-100 metadata, then computes
 * scores for all proposers. Runs daily after proposal sync completes.
 */

import { inngest } from '@/lib/inngest';
import { resolveAllProposers, scoreAllProposers } from '@/lib/scoring/proposer';
import { logger } from '@/lib/logger';

export const scoreProposers = inngest.createFunction(
  {
    id: 'score-proposers',
    name: 'Score Proposers',
    retries: 2,
  },
  [{ cron: '0 3 * * *' }, { event: 'drepscore/sync.proposers' }],
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Inngest dual-trigger type inference
  async ({ step }: any) => {
    const resolution = await step.run('resolve-identities', async () => {
      const result = await resolveAllProposers();
      logger.info('[ScoreProposers] Identity resolution complete', result);
      return result;
    });

    const scoring = await step.run('score-proposers', async () => {
      const result = await scoreAllProposers();
      logger.info('[ScoreProposers] Scoring complete', result);
      return result;
    });

    return { resolution, scoring };
  },
);
