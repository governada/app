/**
 * SPO + CC Vote Sync — fetches SPO and Constitutional Committee votes from Koios,
 * upserts to spo_votes and cc_votes tables, then computes inter-body alignment.
 */

import { inngest } from '@/lib/inngest';
import { getSupabaseAdmin } from '@/lib/supabase';
import { fetchAllSPOVotesBulk, fetchAllCCVotesBulk } from '@/utils/koios';
import { SyncLogger, batchUpsert, errMsg, emitPostHog } from '@/lib/sync-utils';
import { computeAndCacheAlignment } from '@/lib/interBodyAlignment';

export const syncSpoAndCcVotes = inngest.createFunction(
  {
    id: 'sync-spo-cc-votes',
    retries: 2,
    concurrency: { limit: 1, scope: 'env', key: '"spo-cc-votes"' },
  },
  [{ cron: '45 */6 * * *' }, { event: 'drepscore/sync.spo-cc-votes' }],
  async ({ step }) => {
    const spoResult = await step.run('fetch-spo-votes', async () => {
      const supabase = getSupabaseAdmin();
      const logger = new SyncLogger(supabase, 'spo_votes' as any);
      await logger.start();

      try {
        const votes = await fetchAllSPOVotesBulk();

        const rows = votes.map((v) => ({
          pool_id: v.pool_id,
          proposal_tx_hash: v.proposal_tx_hash,
          proposal_index: v.proposal_index,
          vote: v.vote,
          block_time: v.block_time,
          tx_hash: v.tx_hash,
          epoch: v.epoch,
        }));

        let upserted = 0;
        if (rows.length > 0) {
          const result = await batchUpsert(
            supabase,
            'spo_votes',
            rows,
            'pool_id,proposal_tx_hash,proposal_index',
            'spo-votes',
          );
          upserted = result.success;
        }

        await logger.finalize(true, null, { spoVotesFetched: votes.length, upserted });
        return { fetched: votes.length, upserted };
      } catch (err) {
        await logger.finalize(false, errMsg(err), {});
        throw err;
      }
    });

    const ccResult = await step.run('fetch-cc-votes', async () => {
      const supabase = getSupabaseAdmin();
      const logger = new SyncLogger(supabase, 'cc_votes' as any);
      await logger.start();

      try {
        const votes = await fetchAllCCVotesBulk();

        const rows = votes.map((v) => ({
          cc_hot_id: v.cc_hot_id,
          proposal_tx_hash: v.proposal_tx_hash,
          proposal_index: v.proposal_index,
          vote: v.vote,
          block_time: v.block_time,
          tx_hash: v.tx_hash,
          epoch: v.epoch,
        }));

        let upserted = 0;
        if (rows.length > 0) {
          const result = await batchUpsert(
            supabase,
            'cc_votes',
            rows,
            'cc_hot_id,proposal_tx_hash,proposal_index',
            'cc-votes',
          );
          upserted = result.success;
        }

        await logger.finalize(true, null, { ccVotesFetched: votes.length, upserted });
        return { fetched: votes.length, upserted };
      } catch (err) {
        await logger.finalize(false, errMsg(err), {});
        throw err;
      }
    });

    const alignmentResult = await step.run('compute-alignment', async () => {
      try {
        const upserted = await computeAndCacheAlignment();
        return { alignmentCached: upserted };
      } catch (err) {
        console.error('[sync-spo-cc-votes] Alignment computation failed:', errMsg(err));
        return { alignmentCached: 0, error: errMsg(err) };
      }
    });

    await step.run('emit-analytics', async () => {
      await emitPostHog(true, 'spo_votes' as any, 0, {
        spo_votes: spoResult.fetched,
        cc_votes: ccResult.fetched,
        alignment_cached: alignmentResult.alignmentCached,
      });
    });

    return {
      spo: spoResult,
      cc: ccResult,
      alignment: alignmentResult,
    };
  },
);
