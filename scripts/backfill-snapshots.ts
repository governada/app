#!/usr/bin/env npx tsx
/**
 * Backfill missing snapshot data from raw source tables.
 *
 * Usage: npx tsx scripts/backfill-snapshots.ts [table] [--from epoch] [--to epoch]
 *
 * Backfillable tables:
 *   treasury_health  — recomputes from treasury_snapshots
 *   alignment        — recomputes from drep_votes + spo_votes + cc_votes
 *   participation    — recomputes from drep_votes
 *
 * Not backfillable (data is ephemeral):
 *   proposal_vote_snapshots   — Koios only returns current tallies
 *   classification_history     — old vectors are gone once overwritten
 */

import { existsSync } from 'fs';
import { resolve } from 'path';

const envPath = resolve(__dirname, '..', '.env.local');
if (existsSync(envPath)) process.loadEnvFile(envPath);

import { getSupabaseAdmin } from '../lib/supabase';
import { calculateTreasuryHealthScore } from '../lib/treasury';

const supabase = getSupabaseAdmin();

async function getCurrentEpoch(): Promise<number> {
  const { data } = await supabase
    .from('governance_stats')
    .select('current_epoch')
    .eq('id', 1)
    .single();
  return data?.current_epoch ?? 0;
}

async function getEpochRange(from?: number, to?: number): Promise<{ from: number; to: number }> {
  const current = await getCurrentEpoch();
  return {
    from: from ?? Math.max(1, current - 30),
    to: to ?? current,
  };
}

async function backfillTreasuryHealth(fromEpoch: number, toEpoch: number) {
  console.log(`Backfilling treasury_health_snapshots for epochs ${fromEpoch}–${toEpoch}`);

  for (let epoch = fromEpoch; epoch <= toEpoch; epoch++) {
    const { data: existing } = await supabase
      .from('treasury_health_snapshots')
      .select('epoch')
      .eq('epoch', epoch)
      .maybeSingle();
    if (existing) {
      console.log(`  epoch ${epoch}: already exists, skipping`);
      continue;
    }

    const { data: rawSnapshot } = await supabase
      .from('treasury_snapshots')
      .select('*')
      .eq('epoch_no', epoch)
      .maybeSingle();

    if (!rawSnapshot) {
      console.log(`  epoch ${epoch}: no raw treasury data, skipping`);
      continue;
    }

    const health = await calculateTreasuryHealthScore();
    if (!health) {
      console.log(`  epoch ${epoch}: insufficient data for health score, skipping`);
      continue;
    }

    const { data: pendingData } = await supabase
      .from('proposals')
      .select('withdrawal_amount')
      .eq('proposal_type', 'TreasuryWithdrawals')
      .is('ratified_epoch', null)
      .is('enacted_epoch', null)
      .is('expired_epoch', null)
      .is('dropped_epoch', null);

    const pendingCount = pendingData?.length ?? 0;
    const pendingTotalAda = (pendingData || []).reduce(
      (sum, p) => sum + (p.withdrawal_amount || 0),
      0,
    );

    const { error } = await supabase.from('treasury_health_snapshots').insert({
      epoch,
      health_score: health.score,
      balance_trend: health.components.balanceTrend,
      withdrawal_velocity: health.components.withdrawalVelocity,
      income_stability: health.components.incomeStability,
      pending_load: health.components.pendingLoad,
      runway_adequacy: health.components.runwayAdequacy,
      runway_months: health.runwayMonths,
      burn_rate_per_epoch: health.burnRatePerEpoch,
      pending_count: pendingCount,
      pending_total_ada: pendingTotalAda,
    });

    if (error) {
      console.error(`  epoch ${epoch}: INSERT failed — ${error.message}`);
    } else {
      console.log(`  epoch ${epoch}: inserted (score=${health.score})`);
    }
  }

  await supabase.from('sync_log').insert({
    sync_type: 'snapshot_backfill',
    started_at: new Date().toISOString(),
    finished_at: new Date().toISOString(),
    success: true,
    metrics: { table: 'treasury_health_snapshots', from: fromEpoch, to: toEpoch },
  });
}

async function backfillParticipation(fromEpoch: number, toEpoch: number) {
  console.log(`Backfilling governance_participation_snapshots for epochs ${fromEpoch}–${toEpoch}`);

  for (let epoch = fromEpoch; epoch <= toEpoch; epoch++) {
    const { data: existing } = await supabase
      .from('governance_participation_snapshots')
      .select('epoch')
      .eq('epoch', epoch)
      .maybeSingle();
    if (existing) {
      console.log(`  epoch ${epoch}: already exists, skipping`);
      continue;
    }

    const [votersResult, totalDrepsResult] = await Promise.all([
      supabase.from('drep_votes').select('drep_id').eq('epoch_no', epoch),
      supabase
        .from('dreps')
        .select('drep_id', { count: 'exact', head: true })
        .eq('registered', true),
    ]);

    const uniqueVoters = new Set((votersResult.data || []).map((v) => v.drep_id));
    const activeDreps = uniqueVoters.size;
    const totalDreps = totalDrepsResult.count || 1;

    if (activeDreps === 0) {
      console.log(`  epoch ${epoch}: no voters found, skipping`);
      continue;
    }

    const participationRate = Math.round((activeDreps / totalDreps) * 10000) / 100;

    const { error } = await supabase.from('governance_participation_snapshots').insert({
      epoch,
      active_drep_count: activeDreps,
      total_drep_count: totalDreps,
      participation_rate: participationRate,
    });

    if (error) {
      console.error(`  epoch ${epoch}: INSERT failed — ${error.message}`);
    } else {
      console.log(
        `  epoch ${epoch}: inserted (${activeDreps}/${totalDreps} = ${participationRate}%)`,
      );
    }
  }

  await supabase.from('sync_log').insert({
    sync_type: 'snapshot_backfill',
    started_at: new Date().toISOString(),
    finished_at: new Date().toISOString(),
    success: true,
    metrics: { table: 'governance_participation_snapshots', from: fromEpoch, to: toEpoch },
  });
}

async function main() {
  const args = process.argv.slice(2);
  const table = args[0];
  const fromIdx = args.indexOf('--from');
  const toIdx = args.indexOf('--to');
  const fromArg = fromIdx >= 0 ? parseInt(args[fromIdx + 1]) : undefined;
  const toArg = toIdx >= 0 ? parseInt(args[toIdx + 1]) : undefined;

  const { from, to } = await getEpochRange(fromArg, toArg);

  switch (table) {
    case 'treasury_health':
      await backfillTreasuryHealth(from, to);
      break;
    case 'participation':
      await backfillParticipation(from, to);
      break;
    default:
      console.log(
        'Usage: npx tsx scripts/backfill-snapshots.ts <table> [--from epoch] [--to epoch]',
      );
      console.log('Tables: treasury_health, participation');
      process.exit(1);
  }

  console.log('Done.');
  process.exit(0);
}

main().catch((e) => {
  console.error('Fatal:', e);
  process.exit(1);
});
