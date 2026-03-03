import { inngest } from '@/lib/inngest';
import { executeProposalsSync } from '@/lib/sync/proposals';
import { pingHeartbeat } from '@/lib/sync-utils';

export const syncProposals = inngest.createFunction(
  {
    id: 'sync-proposals',
    retries: 3,
    concurrency: {
      limit: 2,
      scope: 'env',
      key: '"koios-frequent"',
    },
  },
  [{ cron: '*/30 * * * *' }, { event: 'drepscore/sync.proposals' }],
  async ({ step }) => {
    const result = await step.run('execute-proposals-sync', () => executeProposalsSync());
    await step.run('heartbeat', () => pingHeartbeat('HEARTBEAT_URL_PROPOSALS'));
    return result;
  },
);
