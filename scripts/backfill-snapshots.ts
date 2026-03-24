#!/usr/bin/env npx tsx
/**
 * Historical Data Backfill — recovers governance data from Epoch 509 (Conway genesis) onward.
 *
 * Usage: npx tsx scripts/backfill-snapshots.ts <table|phase|all> [--from epoch] [--to epoch] [--dry-run]
 *
 * Phase 1 (DB-only): governance_epoch_stats, participation, alignment, vote_snapshots, epoch_recaps
 * Phase 2 (Koios):   power_history, voting_summary, delegation
 * Phase 3 (Derived):  treasury_health, classification_history
 *
 * Examples:
 *   npx tsx scripts/backfill-snapshots.ts all --from 509
 *   npx tsx scripts/backfill-snapshots.ts phase1 --from 509
 *   npx tsx scripts/backfill-snapshots.ts governance_epoch_stats --from 509 --to 550
 *   npx tsx scripts/backfill-snapshots.ts power_history --dry-run
 */

import { existsSync } from 'fs';
import { resolve } from 'path';

const envPath = resolve(__dirname, '..', '.env.local');
if (existsSync(envPath)) process.loadEnvFile(envPath);

import { getSupabaseAdmin } from '../lib/supabase';
import {
  fetchDRepVotingPowerHistory,
  fetchProposalVotingSummary,
  fetchDRepDelegatorCount,
  fetchTreasuryHistory,
} from '../utils/koios';
import { blockTimeToEpoch } from '../lib/koios';
import { getCurrentEpoch } from '../lib/constants';

const CONWAY_GENESIS_EPOCH = 509;
const BATCH_SIZE = 100;
const KOIOS_DELAY_MS = 200; // rate limit guard between Koios calls

const supabase = getSupabaseAdmin();
let DRY_RUN = false;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

async function getEpochRange(from?: number, to?: number): Promise<{ from: number; to: number }> {
  const current = getCurrentEpoch();
  return {
    from: Math.max(CONWAY_GENESIS_EPOCH, from ?? CONWAY_GENESIS_EPOCH),
    to: to ?? current,
  };
}

async function upsertBatch(table: string, rows: Record<string, unknown>[], onConflict: string) {
  if (rows.length === 0) return 0;
  if (DRY_RUN) return rows.length;
  let inserted = 0;
  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const batch = rows.slice(i, i + BATCH_SIZE);
    const { error } = await supabase.from(table).upsert(batch, { onConflict });
    if (error) {
      console.error(`  [${table}] batch upsert error: ${error.message}`);
    } else {
      inserted += batch.length;
    }
  }
  return inserted;
}

function progress(label: string, current: number, total: number, extra = '') {
  const pct = total > 0 ? Math.round((current / total) * 100) : 0;
  process.stdout.write(`\r  [${label}] ${current}/${total} (${pct}%) ${extra}    `);
}

// ---------------------------------------------------------------------------
// Phase 1A: governance_epoch_stats
// ---------------------------------------------------------------------------

async function backfillGovernanceEpochStats(fromEpoch: number, toEpoch: number) {
  console.log(`\n=== governance_epoch_stats (${fromEpoch}–${toEpoch}) ===`);
  const totalEpochs = toEpoch - fromEpoch + 1;

  for (let epoch = fromEpoch; epoch <= toEpoch; epoch++) {
    progress('epoch_stats', epoch - fromEpoch + 1, totalEpochs, `epoch ${epoch}`);

    const { data: existing } = await supabase
      .from('governance_epoch_stats')
      .select('epoch_no')
      .eq('epoch_no', epoch)
      .maybeSingle();
    if (existing) continue;

    // Count DRep votes this epoch
    const { data: votes } = await supabase
      .from('drep_votes')
      .select('drep_id')
      .eq('epoch_no', epoch);

    const uniqueVoters = new Set((votes || []).map((v) => v.drep_id));
    const activeDreps = uniqueVoters.size;
    if (activeDreps === 0) continue; // no governance activity this epoch

    // Count total registered DReps (approximate — uses count of all DReps with any vote up to this epoch)
    const { data: historicalVoters } = await supabase
      .from('drep_votes')
      .select('drep_id')
      .lte('epoch_no', epoch);
    const totalDreps = new Set((historicalVoters || []).map((v) => v.drep_id)).size;

    // Proposal stats for this epoch
    const [submitted, ratified, expired, dropped] = await Promise.all([
      supabase
        .from('proposals')
        .select('tx_hash', { count: 'exact', head: true })
        .eq('proposed_epoch', epoch),
      supabase
        .from('proposals')
        .select('tx_hash', { count: 'exact', head: true })
        .eq('ratified_epoch', epoch),
      supabase
        .from('proposals')
        .select('tx_hash', { count: 'exact', head: true })
        .eq('expired_epoch', epoch),
      supabase
        .from('proposals')
        .select('tx_hash', { count: 'exact', head: true })
        .eq('dropped_epoch', epoch),
    ]);

    // Total proposals up to this epoch
    const { count: totalProposals } = await supabase
      .from('proposals')
      .select('tx_hash', { count: 'exact', head: true })
      .lte('proposed_epoch', epoch);

    // Participation rate
    const participationRate =
      totalDreps > 0 ? Math.round((activeDreps / totalDreps) * 10000) / 100 : 0;

    // Rationale rate (votes with meta_url this epoch)
    const { count: rationaleCount } = await supabase
      .from('drep_votes')
      .select('vote_tx_hash', { count: 'exact', head: true })
      .eq('epoch_no', epoch)
      .not('meta_url', 'is', null);

    const totalVotes = (votes || []).length;
    const rationaleRate =
      totalVotes > 0 ? Math.round(((rationaleCount || 0) / totalVotes) * 10000) / 100 : 0;

    // Average DRep score for this epoch
    const { data: scores } = await supabase
      .from('drep_score_history')
      .select('score')
      .eq('epoch_no', epoch)
      .not('score', 'is', null);
    const avgScore =
      scores && scores.length > 0
        ? Math.round((scores.reduce((s, r) => s + (r.score || 0), 0) / scores.length) * 100) / 100
        : null;

    // Delegated ADA: sum power snapshots for this epoch
    const { data: powerData } = await supabase
      .from('drep_power_snapshots')
      .select('amount_lovelace')
      .eq('epoch_no', epoch);

    const totalDelegated = (powerData || []).reduce(
      (sum, r) => sum + BigInt(r.amount_lovelace || 0),
      BigInt(0),
    );

    if (!DRY_RUN) {
      const { error } = await supabase.from('governance_epoch_stats').upsert(
        {
          epoch_no: epoch,
          total_dreps: totalDreps,
          active_dreps: activeDreps,
          total_delegated_ada_lovelace: totalDelegated.toString(),
          total_proposals: totalProposals || 0,
          proposals_submitted: submitted.count || 0,
          proposals_ratified: ratified.count || 0,
          proposals_expired: expired.count || 0,
          proposals_dropped: dropped.count || 0,
          participation_rate: participationRate,
          rationale_rate: rationaleRate,
          avg_drep_score: avgScore,
          computed_at: new Date().toISOString(),
        },
        { onConflict: 'epoch_no' },
      );
      if (error) console.error(`\n  epoch ${epoch}: ${error.message}`);
    }
  }
  console.log('\n  Done.');
}

// ---------------------------------------------------------------------------
// Phase 1B: governance_participation_snapshots
// ---------------------------------------------------------------------------

async function backfillParticipation(fromEpoch: number, toEpoch: number) {
  console.log(`\n=== governance_participation_snapshots (${fromEpoch}–${toEpoch}) ===`);
  const totalEpochs = toEpoch - fromEpoch + 1;

  for (let epoch = fromEpoch; epoch <= toEpoch; epoch++) {
    progress('participation', epoch - fromEpoch + 1, totalEpochs, `epoch ${epoch}`);

    const { data: existing } = await supabase
      .from('governance_participation_snapshots')
      .select('epoch')
      .eq('epoch', epoch)
      .maybeSingle();
    if (existing) continue;

    const [votersResult, rationaleResult] = await Promise.all([
      supabase.from('drep_votes').select('drep_id').eq('epoch_no', epoch),
      supabase
        .from('drep_votes')
        .select('vote_tx_hash', { count: 'exact', head: true })
        .eq('epoch_no', epoch)
        .not('meta_url', 'is', null),
    ]);

    const uniqueVoters = new Set((votersResult.data || []).map((v) => v.drep_id));
    const activeDreps = uniqueVoters.size;
    if (activeDreps === 0) continue;

    // Historical total DReps (all who ever voted up to this epoch)
    const { data: allVoters } = await supabase
      .from('drep_votes')
      .select('drep_id')
      .lte('epoch_no', epoch);
    const totalDreps = new Set((allVoters || []).map((v) => v.drep_id)).size;

    const totalVotes = (votersResult.data || []).length;
    const participationRate = Math.round((activeDreps / totalDreps) * 10000) / 100;
    const rationaleRate =
      totalVotes > 0 ? Math.round(((rationaleResult.count || 0) / totalVotes) * 10000) / 100 : 0;

    // Total voting power from power snapshots
    const { data: powerData } = await supabase
      .from('drep_power_snapshots')
      .select('amount_lovelace')
      .eq('epoch_no', epoch);
    const totalPower = (powerData || []).reduce(
      (sum, r) => sum + BigInt(r.amount_lovelace || 0),
      BigInt(0),
    );

    if (!DRY_RUN) {
      const { error } = await supabase.from('governance_participation_snapshots').upsert(
        {
          epoch,
          active_drep_count: activeDreps,
          total_drep_count: totalDreps,
          participation_rate: participationRate,
          rationale_rate: rationaleRate,
          total_voting_power_lovelace: totalPower > 0 ? Number(totalPower) : null,
          snapshot_at: new Date().toISOString(),
        },
        { onConflict: 'epoch' },
      );
      if (error) console.error(`\n  epoch ${epoch}: ${error.message}`);
    }
  }
  console.log('\n  Done.');
}

// ---------------------------------------------------------------------------
// Phase 1C: proposal_vote_snapshots + inter_body_alignment_snapshots
// ---------------------------------------------------------------------------

async function backfillVoteAndAlignmentSnapshots(fromEpoch: number, toEpoch: number) {
  console.log(
    `\n=== proposal_vote_snapshots + inter_body_alignment_snapshots (${fromEpoch}–${toEpoch}) ===`,
  );

  // Get all proposals that were active during the epoch range
  const { data: proposals } = await supabase
    .from('proposals')
    .select(
      'tx_hash, proposal_index, proposed_epoch, expired_epoch, ratified_epoch, enacted_epoch, dropped_epoch',
    )
    .lte('proposed_epoch', toEpoch)
    .order('proposed_epoch', { ascending: true });

  if (!proposals || proposals.length === 0) {
    console.log('  No proposals found.');
    return;
  }

  console.log(`  Found ${proposals.length} proposals to process.`);
  let processed = 0;

  for (const prop of proposals) {
    processed++;
    progress('vote_snaps', processed, proposals.length, `${prop.tx_hash.slice(0, 12)}...`);

    // Determine epoch range this proposal was active
    const startEpoch = Math.max(prop.proposed_epoch || CONWAY_GENESIS_EPOCH, fromEpoch);
    const endEpoch = Math.min(
      prop.enacted_epoch ||
        prop.expired_epoch ||
        prop.dropped_epoch ||
        prop.ratified_epoch ||
        toEpoch,
      toEpoch,
    );

    for (let epoch = startEpoch; epoch <= endEpoch; epoch++) {
      // Fetch all votes for this proposal in this epoch (across all bodies)
      const [drepVotes, spoVotes, ccVotes] = await Promise.all([
        supabase
          .from('drep_votes')
          .select('vote, voting_power_lovelace')
          .eq('proposal_tx_hash', prop.tx_hash)
          .eq('proposal_index', prop.proposal_index)
          .eq('epoch_no', epoch),
        supabase
          .from('spo_votes')
          .select('vote')
          .eq('proposal_tx_hash', prop.tx_hash)
          .eq('proposal_index', prop.proposal_index)
          .eq('epoch', epoch),
        supabase
          .from('cc_votes')
          .select('vote')
          .eq('proposal_tx_hash', prop.tx_hash)
          .eq('proposal_index', prop.proposal_index)
          .eq('epoch', epoch),
      ]);

      const dv = drepVotes.data || [];
      const sv = spoVotes.data || [];
      const cv = ccVotes.data || [];

      // Skip if no votes at all this epoch
      if (dv.length === 0 && sv.length === 0 && cv.length === 0) continue;

      // Count DRep votes by type
      const drepYes = dv.filter((v) => v.vote === 'Yes');
      const drepNo = dv.filter((v) => v.vote === 'No');
      const drepAbstain = dv.filter((v) => v.vote === 'Abstain');
      const drepYesPower = drepYes.reduce((s, v) => s + Number(v.voting_power_lovelace || 0), 0);
      const drepNoPower = drepNo.reduce((s, v) => s + Number(v.voting_power_lovelace || 0), 0);

      // proposal_vote_snapshots
      const voteRow = {
        epoch,
        proposal_tx_hash: prop.tx_hash,
        proposal_index: prop.proposal_index,
        drep_yes_count: drepYes.length,
        drep_no_count: drepNo.length,
        drep_abstain_count: drepAbstain.length,
        drep_yes_power: drepYesPower,
        drep_no_power: drepNoPower,
        spo_yes_count: sv.filter((v) => v.vote === 'Yes').length,
        spo_no_count: sv.filter((v) => v.vote === 'No').length,
        spo_abstain_count: sv.filter((v) => v.vote === 'Abstain').length,
        cc_yes_count: cv.filter((v) => v.vote === 'Yes').length,
        cc_no_count: cv.filter((v) => v.vote === 'No').length,
        cc_abstain_count: cv.filter((v) => v.vote === 'Abstain').length,
        snapshot_at: new Date().toISOString(),
      };

      // inter_body_alignment_snapshots
      const drepTotal = dv.length;
      const spoTotal = sv.length;
      const ccTotal = cv.length;
      const drepYesPct = drepTotal > 0 ? Math.round((drepYes.length / drepTotal) * 10000) / 100 : 0;
      const drepNoPct = drepTotal > 0 ? Math.round((drepNo.length / drepTotal) * 10000) / 100 : 0;
      const spoYesPct =
        spoTotal > 0
          ? Math.round((sv.filter((v) => v.vote === 'Yes').length / spoTotal) * 10000) / 100
          : 0;
      const spoNoPct =
        spoTotal > 0
          ? Math.round((sv.filter((v) => v.vote === 'No').length / spoTotal) * 10000) / 100
          : 0;
      const ccYesPct =
        ccTotal > 0
          ? Math.round((cv.filter((v) => v.vote === 'Yes').length / ccTotal) * 10000) / 100
          : 0;
      const ccNoPct =
        ccTotal > 0
          ? Math.round((cv.filter((v) => v.vote === 'No').length / ccTotal) * 10000) / 100
          : 0;

      // Alignment = how much do bodies agree? Simple: avg pairwise similarity of yes%
      const bodies = [
        drepTotal > 0 ? drepYesPct : null,
        spoTotal > 0 ? spoYesPct : null,
        ccTotal > 0 ? ccYesPct : null,
      ].filter((v): v is number => v !== null);

      let alignmentScore = 100;
      if (bodies.length >= 2) {
        let totalDiff = 0;
        let pairs = 0;
        for (let i = 0; i < bodies.length; i++) {
          for (let j = i + 1; j < bodies.length; j++) {
            totalDiff += Math.abs(bodies[i] - bodies[j]);
            pairs++;
          }
        }
        alignmentScore = Math.round((100 - totalDiff / pairs) * 100) / 100;
      }

      const alignRow = {
        epoch,
        proposal_tx_hash: prop.tx_hash,
        proposal_index: prop.proposal_index,
        drep_yes_pct: drepYesPct,
        drep_no_pct: drepNoPct,
        drep_total: drepTotal,
        spo_yes_pct: spoYesPct,
        spo_no_pct: spoNoPct,
        spo_total: spoTotal,
        cc_yes_pct: ccYesPct,
        cc_no_pct: ccNoPct,
        cc_total: ccTotal,
        alignment_score: Math.max(0, Math.min(100, alignmentScore)),
        snapshot_at: new Date().toISOString(),
      };

      if (!DRY_RUN) {
        await Promise.all([
          supabase
            .from('proposal_vote_snapshots')
            .upsert(voteRow, { onConflict: 'epoch,proposal_tx_hash,proposal_index' }),
          supabase
            .from('inter_body_alignment_snapshots')
            .upsert(alignRow, { onConflict: 'epoch,proposal_tx_hash,proposal_index' }),
        ]);
      }
    }
  }
  console.log('\n  Done.');
}

// ---------------------------------------------------------------------------
// Phase 1D: epoch_recaps
// ---------------------------------------------------------------------------

async function backfillEpochRecaps(fromEpoch: number, toEpoch: number) {
  console.log(`\n=== epoch_recaps (${fromEpoch}–${toEpoch}) ===`);
  const totalEpochs = toEpoch - fromEpoch + 1;

  for (let epoch = fromEpoch; epoch <= toEpoch; epoch++) {
    progress('epoch_recaps', epoch - fromEpoch + 1, totalEpochs, `epoch ${epoch}`);

    const { data: existing } = await supabase
      .from('epoch_recaps')
      .select('epoch')
      .eq('epoch', epoch)
      .maybeSingle();
    if (existing) continue;

    const [submittedResult, ratifiedResult, expiredResult, droppedResult] = await Promise.all([
      supabase
        .from('proposals')
        .select('tx_hash', { count: 'exact', head: true })
        .eq('proposed_epoch', epoch),
      supabase
        .from('proposals')
        .select('tx_hash', { count: 'exact', head: true })
        .eq('ratified_epoch', epoch),
      supabase
        .from('proposals')
        .select('tx_hash', { count: 'exact', head: true })
        .eq('expired_epoch', epoch),
      supabase
        .from('proposals')
        .select('tx_hash', { count: 'exact', head: true })
        .eq('dropped_epoch', epoch),
    ]);

    const submitted = submittedResult.count || 0;
    const ratified = ratifiedResult.count || 0;
    const expired = expiredResult.count || 0;
    const dropped = droppedResult.count || 0;

    // DRep participation
    const { data: votes } = await supabase
      .from('drep_votes')
      .select('drep_id')
      .eq('epoch_no', epoch);
    const uniqueVoters = new Set((votes || []).map((v) => v.drep_id)).size;
    const { data: allVoters } = await supabase
      .from('drep_votes')
      .select('drep_id')
      .lte('epoch_no', epoch);
    const totalDreps = new Set((allVoters || []).map((v) => v.drep_id)).size || 1;
    const participationPct = Math.round((uniqueVoters / totalDreps) * 1000) / 10;

    // Treasury withdrawn
    const { data: treasuryData } = await supabase
      .from('proposals')
      .select('withdrawal_amount')
      .eq('proposal_type', 'TreasuryWithdrawals')
      .eq('enacted_epoch', epoch);
    const treasuryWithdrawn = (treasuryData || []).reduce(
      (s, p) => s + (p.withdrawal_amount || 0),
      0,
    );

    // Generate simple narrative
    const parts = [`Epoch ${epoch}:`];
    if (submitted > 0) parts.push(`${submitted} proposals submitted`);
    if (ratified > 0) parts.push(`${ratified} ratified`);
    if (expired > 0) parts.push(`${expired} expired`);
    if (dropped > 0) parts.push(`${dropped} dropped`);
    parts.push(`${participationPct}% DRep participation`);
    if (treasuryWithdrawn > 0)
      parts.push(`${Math.round(treasuryWithdrawn / 1_000_000)}M ADA withdrawn`);
    const narrative = parts.join(', ');

    if (submitted === 0 && ratified === 0 && expired === 0 && dropped === 0 && uniqueVoters === 0)
      continue;

    if (!DRY_RUN) {
      const { error } = await supabase.from('epoch_recaps').upsert(
        {
          epoch,
          proposals_submitted: submitted,
          proposals_ratified: ratified,
          proposals_expired: expired,
          proposals_dropped: dropped,
          drep_participation_pct: participationPct,
          treasury_withdrawn_ada: Math.round(treasuryWithdrawn),
          ai_narrative: narrative,
          computed_at: new Date().toISOString(),
        },
        { onConflict: 'epoch' },
      );
      if (error) console.error(`\n  epoch ${epoch}: ${error.message}`);
    }
  }
  console.log('\n  Done.');
}

// ---------------------------------------------------------------------------
// Phase 2A: drep_power_snapshots (from Koios /drep_voting_power_history)
// ---------------------------------------------------------------------------

async function backfillPowerSnapshots() {
  console.log('\n=== drep_power_snapshots (Koios /drep_voting_power_history) ===');

  // Get all DReps that have ever voted
  const { data: drepRows } = await supabase.from('dreps').select('id').range(0, 99999);

  if (!drepRows || drepRows.length === 0) {
    console.log('  No DReps found.');
    return;
  }

  console.log(`  Fetching power history for ${drepRows.length} DReps from Koios...`);
  let totalInserted = 0;
  let fetched = 0;

  for (const drep of drepRows) {
    fetched++;
    progress('power_history', fetched, drepRows.length, drep.id.slice(0, 20));

    try {
      const history = await fetchDRepVotingPowerHistory(drep.id);
      if (!history || history.length === 0) continue;

      const rows = history.map((h) => ({
        drep_id: drep.id,
        epoch_no: h.epoch_no,
        amount_lovelace: parseInt(String(h.amount), 10),
        delegator_count: 0, // will be enriched by delegation backfill
      }));

      if (!DRY_RUN) {
        const inserted = await upsertBatch('drep_power_snapshots', rows, 'drep_id,epoch_no');
        totalInserted += inserted;
      } else {
        totalInserted += rows.length;
      }

      await sleep(KOIOS_DELAY_MS);
    } catch (err) {
      console.error(`\n  ${drep.id}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }
  console.log(`\n  Inserted ${totalInserted} power snapshot rows.`);
}

// ---------------------------------------------------------------------------
// Phase 2B: proposal_voting_summary (from Koios /proposal_voting_summary)
// ---------------------------------------------------------------------------

async function backfillProposalVotingSummary() {
  console.log('\n=== proposal_voting_summary (Koios /proposal_voting_summary) ===');

  const { data: proposals } = await supabase
    .from('proposals')
    .select('tx_hash, proposal_index, proposal_id')
    .order('proposed_epoch', { ascending: true });

  if (!proposals || proposals.length === 0) {
    console.log('  No proposals found.');
    return;
  }

  // Filter to proposals not already in voting_summary
  const { data: existing } = await supabase
    .from('proposal_voting_summary')
    .select('proposal_tx_hash, proposal_index');

  const existingKeys = new Set(
    (existing || []).map((e) => `${e.proposal_tx_hash}-${e.proposal_index}`),
  );
  const toFetch = proposals.filter(
    (p) => !existingKeys.has(`${p.tx_hash}-${p.proposal_index}`) && p.proposal_id,
  );

  console.log(
    `  ${proposals.length} proposals total, ${toFetch.length} need voting summary from Koios.`,
  );

  let fetched = 0;
  let inserted = 0;

  for (const prop of toFetch) {
    fetched++;
    progress('voting_summary', fetched, toFetch.length, prop.tx_hash.slice(0, 12));

    try {
      const summary = await fetchProposalVotingSummary(prop.proposal_id!);
      if (!summary) continue;

      if (!DRY_RUN) {
        const { error } = await supabase.from('proposal_voting_summary').upsert(
          {
            proposal_tx_hash: prop.tx_hash,
            proposal_index: prop.proposal_index,
            epoch_no: ((summary as Record<string, unknown>).epoch_no as number) || 0,
            drep_yes_votes_cast: summary.drep_yes_votes_cast,
            drep_yes_vote_power: summary.drep_yes_vote_power,
            drep_no_votes_cast: summary.drep_no_votes_cast,
            drep_no_vote_power: summary.drep_no_vote_power,
            drep_abstain_votes_cast: summary.drep_abstain_votes_cast,
            drep_abstain_vote_power: summary.drep_abstain_vote_power,
            drep_always_abstain_power:
              ((summary as Record<string, unknown>).drep_always_abstain_power as number) ?? null,
            drep_always_no_confidence_power:
              ((summary as Record<string, unknown>).drep_always_no_confidence_power as number) ??
              null,
            pool_yes_votes_cast: summary.pool_yes_votes_cast,
            pool_yes_vote_power: summary.pool_yes_vote_power,
            pool_no_votes_cast: summary.pool_no_votes_cast,
            pool_no_vote_power: summary.pool_no_vote_power,
            pool_abstain_votes_cast: summary.pool_abstain_votes_cast,
            pool_abstain_vote_power: summary.pool_abstain_vote_power,
            committee_yes_votes_cast: summary.committee_yes_votes_cast,
            committee_no_votes_cast: summary.committee_no_votes_cast,
            committee_abstain_votes_cast: summary.committee_abstain_votes_cast,
            fetched_at: new Date().toISOString(),
          },
          { onConflict: 'proposal_tx_hash,proposal_index' },
        );
        if (!error) inserted++;
        else console.error(`\n  ${prop.tx_hash}: ${error.message}`);
      } else {
        inserted++;
      }

      await sleep(KOIOS_DELAY_MS);
    } catch (err) {
      console.error(`\n  ${prop.tx_hash}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }
  console.log(`\n  Inserted ${inserted} voting summary rows.`);
}

// ---------------------------------------------------------------------------
// Phase 2C: delegation_snapshots (enriches power snapshots with delegator counts)
// ---------------------------------------------------------------------------

async function backfillDelegationSnapshots(fromEpoch: number, toEpoch: number) {
  console.log(`\n=== delegation_snapshots (${fromEpoch}–${toEpoch}) ===`);

  // Derive delegation_snapshots from drep_power_snapshots, paginating to avoid 1000-row limit

  // First count total power snapshots in range
  const { count: totalPower } = await supabase
    .from('drep_power_snapshots')
    .select('drep_id', { count: 'exact', head: true })
    .gte('epoch_no', fromEpoch)
    .lte('epoch_no', toEpoch);

  if (!totalPower || totalPower === 0) {
    console.log('  No power snapshot data to derive from. Run power_history first.');
    return;
  }

  console.log(`  ${totalPower} power snapshots to process.`);

  // Check what already exists
  const existingKeys = new Set<string>();
  let existingOffset = 0;
  while (true) {
    const { data: existing } = await supabase
      .from('delegation_snapshots')
      .select('epoch, drep_id')
      .gte('epoch', fromEpoch)
      .lte('epoch', toEpoch)
      .range(existingOffset, existingOffset + 9999);
    if (!existing || existing.length === 0) break;
    for (const e of existing) existingKeys.add(`${e.epoch}-${e.drep_id}`);
    existingOffset += existing.length;
    if (existing.length < 10000) break;
  }

  console.log(`  ${existingKeys.size} existing delegation snapshots.`);

  // Paginate through power snapshots (PostgREST default limit is 1000)
  let offset = 0;
  let totalInserted = 0;
  const PAGE_SIZE = 999;

  while (offset < totalPower) {
    const { data: powerData } = await supabase
      .from('drep_power_snapshots')
      .select('drep_id, epoch_no, amount_lovelace, delegator_count')
      .gte('epoch_no', fromEpoch)
      .lte('epoch_no', toEpoch)
      .order('epoch_no', { ascending: true })
      .range(offset, offset + PAGE_SIZE - 1);

    if (!powerData || powerData.length === 0) break;

    const rows: Record<string, unknown>[] = [];
    for (const snap of powerData) {
      const key = `${snap.epoch_no}-${snap.drep_id}`;
      if (existingKeys.has(key)) continue;

      rows.push({
        epoch: snap.epoch_no,
        drep_id: snap.drep_id,
        delegator_count: snap.delegator_count || 0,
        total_power_lovelace: snap.amount_lovelace,
        snapshot_at: new Date().toISOString(),
      });
      existingKeys.add(key); // prevent duplicates within same run
    }

    if (!DRY_RUN && rows.length > 0) {
      const inserted = await upsertBatch('delegation_snapshots', rows, 'epoch,drep_id');
      totalInserted += inserted;
    }

    progress(
      'delegation',
      Math.min(offset + PAGE_SIZE, totalPower),
      totalPower,
      `${rows.length} new`,
    );
    offset += powerData.length;
    if (powerData.length < PAGE_SIZE) break;
  }

  console.log(`\n  Inserted ${totalInserted} delegation snapshot rows.`);
}

// ---------------------------------------------------------------------------
// Phase 2D: treasury_snapshots (from Koios /totals)
// ---------------------------------------------------------------------------

async function backfillTreasurySnapshots(fromEpoch: number, toEpoch: number) {
  console.log(`\n=== treasury_snapshots (Koios /totals, ${fromEpoch}–${toEpoch}) ===`);

  const history = await fetchTreasuryHistory(200); // fetch up to 200 epochs
  if (!history || history.length === 0) {
    console.log('  No treasury history from Koios.');
    return;
  }

  console.log(`  Koios returned ${history.length} epochs of treasury data.`);

  // Filter to requested range
  const filtered = history.filter((h) => h.epoch >= fromEpoch && h.epoch <= toEpoch);
  console.log(`  ${filtered.length} epochs in range.`);

  let inserted = 0;
  for (let i = 0; i < filtered.length; i++) {
    const snap = filtered[i];
    progress('treasury_snap', i + 1, filtered.length, `epoch ${snap.epoch}`);

    // Calculate withdrawals and income from adjacent epochs
    const prev = i > 0 ? filtered[i - 1] : history.find((h) => h.epoch === snap.epoch - 1);
    const withdrawalsLovelace = '0'; // Will be enriched from proposals below
    let reservesIncome = '0';

    if (prev) {
      // Look up enacted treasury withdrawals for this epoch
      const { data: enacted } = await supabase
        .from('proposals')
        .select('withdrawal_amount')
        .eq('proposal_type', 'TreasuryWithdrawals')
        .eq('enacted_epoch', snap.epoch);

      const totalWithdrawals = (enacted || []).reduce(
        (sum, p) => sum + BigInt(p.withdrawal_amount || 0) * BigInt(1_000_000),
        BigInt(0),
      );

      reservesIncome = (snap.balance - prev.balance + totalWithdrawals).toString();

      if (!DRY_RUN) {
        const { error } = await supabase.from('treasury_snapshots').upsert(
          {
            epoch_no: snap.epoch,
            balance_lovelace: snap.balance.toString(),
            reserves_lovelace: snap.reserves.toString(),
            withdrawals_lovelace: totalWithdrawals.toString(),
            reserves_income_lovelace: reservesIncome,
            snapshot_at: new Date().toISOString(),
          },
          { onConflict: 'epoch_no' },
        );
        if (!error) inserted++;
        else console.error(`\n  epoch ${snap.epoch}: ${error.message}`);
      } else {
        inserted++;
      }
    } else {
      // First epoch — no previous to calculate income from
      if (!DRY_RUN) {
        const { error } = await supabase.from('treasury_snapshots').upsert(
          {
            epoch_no: snap.epoch,
            balance_lovelace: snap.balance.toString(),
            reserves_lovelace: snap.reserves.toString(),
            withdrawals_lovelace: withdrawalsLovelace,
            reserves_income_lovelace: reservesIncome,
            snapshot_at: new Date().toISOString(),
          },
          { onConflict: 'epoch_no' },
        );
        if (!error) inserted++;
        else console.error(`\n  epoch ${snap.epoch}: ${error.message}`);
      } else {
        inserted++;
      }
    }
  }
  console.log(`\n  Inserted ${inserted} treasury snapshot rows.`);
}

// ---------------------------------------------------------------------------
// Phase 3A: treasury_health_snapshots (recalculate from treasury_snapshots)
// ---------------------------------------------------------------------------

async function backfillTreasuryHealth(fromEpoch: number, toEpoch: number) {
  console.log(`\n=== treasury_health_snapshots (${fromEpoch}–${toEpoch}) ===`);

  // Get all treasury snapshots for the window
  const { data: allSnapshots } = await supabase
    .from('treasury_snapshots')
    .select('epoch_no, balance_lovelace, withdrawals_lovelace, reserves_income_lovelace')
    .gte('epoch_no', Math.max(fromEpoch - 30, CONWAY_GENESIS_EPOCH))
    .lte('epoch_no', toEpoch)
    .order('epoch_no', { ascending: true });

  if (!allSnapshots || allSnapshots.length === 0) {
    console.log('  No treasury snapshots found.');
    return;
  }

  const LOVELACE = 1_000_000;
  const MONTHS_PER_EPOCH = 5 / 30.44;
  const HEALTHY_RUNWAY = 24;

  const epochsToProcess = allSnapshots.filter((s) => s.epoch_no >= fromEpoch);
  console.log(`  ${epochsToProcess.length} epochs with treasury data.`);
  let inserted = 0;

  for (let i = 0; i < epochsToProcess.length; i++) {
    const snap = epochsToProcess[i];
    progress('treasury_health', i + 1, epochsToProcess.length, `epoch ${snap.epoch_no}`);

    const { data: existing } = await supabase
      .from('treasury_health_snapshots')
      .select('epoch')
      .eq('epoch', snap.epoch_no)
      .maybeSingle();
    if (existing) continue;

    // Get window of snapshots up to this epoch for calculation
    const window = allSnapshots.filter((s) => s.epoch_no <= snap.epoch_no).slice(-30);
    if (window.length < 2) continue;

    const balances = window.map((s) => Number(BigInt(s.balance_lovelace)) / LOVELACE);
    const withdrawals = window.map((s) => Number(BigInt(s.withdrawals_lovelace || 0)) / LOVELACE);
    const incomes = window.map((s) => Number(BigInt(s.reserves_income_lovelace || 0)) / LOVELACE);
    const currentBal = balances[balances.length - 1];

    // Burn rate (avg withdrawals over last 10)
    const recentW = withdrawals.slice(-10);
    const burnRate = recentW.reduce((a, b) => a + b, 0) / recentW.length;
    const runwayMonths = burnRate > 0 ? (currentBal / burnRate) * MONTHS_PER_EPOCH : 999;

    // 1. Balance trend
    const firstBal = balances[0];
    const pctChange = ((currentBal - firstBal) / firstBal) * 100;
    const balanceTrend = Math.max(0, Math.min(100, 50 + pctChange * 5));

    // 2. Withdrawal velocity
    const halfIdx = Math.floor(withdrawals.length / 2);
    const firstHalf = withdrawals.slice(0, halfIdx);
    const secondHalf = withdrawals.slice(halfIdx);
    const avgFirst =
      firstHalf.length > 0 ? firstHalf.reduce((a, b) => a + b, 0) / firstHalf.length : 0;
    const avgSecond =
      secondHalf.length > 0 ? secondHalf.reduce((a, b) => a + b, 0) / secondHalf.length : 0;
    const velocityRatio = avgFirst > 0 ? avgSecond / avgFirst : 1;
    const withdrawalVelocity = Math.max(0, Math.min(100, 100 - (velocityRatio - 1) * 50));

    // 3. Income stability
    const positiveIncomes = incomes.filter((i) => i > 0);
    let incomeStability = 50;
    if (positiveIncomes.length >= 2) {
      const mean = positiveIncomes.reduce((a, b) => a + b, 0) / positiveIncomes.length;
      const variance =
        positiveIncomes.reduce((s, v) => s + (v - mean) ** 2, 0) / positiveIncomes.length;
      const cv = Math.sqrt(variance) / (mean || 1);
      incomeStability = Math.max(0, Math.min(100, 100 - cv * 100));
    }

    // 4. Pending load (use current pending proposals at time of calculation — approximation)
    const pendingLoad = 80; // Default: we can't know historical pending state

    // 5. Runway adequacy
    const runwayAdequacy =
      runwayMonths >= 999
        ? 100
        : Math.max(0, Math.min(100, (runwayMonths / HEALTHY_RUNWAY) * 50 + 25));

    const score = Math.round(
      balanceTrend * 0.2 +
        withdrawalVelocity * 0.2 +
        incomeStability * 0.15 +
        pendingLoad * 0.2 +
        runwayAdequacy * 0.25,
    );

    if (!DRY_RUN) {
      const { error } = await supabase.from('treasury_health_snapshots').upsert(
        {
          epoch: snap.epoch_no,
          health_score: Math.max(0, Math.min(100, score)),
          balance_trend: Math.round(balanceTrend),
          withdrawal_velocity: Math.round(withdrawalVelocity),
          income_stability: Math.round(incomeStability),
          pending_load: Math.round(pendingLoad),
          runway_adequacy: Math.round(runwayAdequacy),
          runway_months: Math.round(runwayMonths),
          burn_rate_per_epoch: Math.round(burnRate),
          pending_count: 0,
          pending_total_ada: 0,
        },
        { onConflict: 'epoch' },
      );
      if (!error) inserted++;
      else console.error(`\n  epoch ${snap.epoch_no}: ${error.message}`);
    } else {
      inserted++;
    }
  }
  console.log(`\n  Inserted ${inserted} treasury health snapshots.`);
}

// ---------------------------------------------------------------------------
// Phase 3B: classification_history (snapshot current classifications)
// ---------------------------------------------------------------------------

async function backfillClassificationHistory() {
  console.log('\n=== classification_history (snapshot from proposal_classifications) ===');

  const { data: classifications } = await supabase
    .from('proposal_classifications')
    .select('*')
    .not('dim_decentralization', 'is', null);

  if (!classifications || classifications.length === 0) {
    console.log('  No classifications to snapshot.');
    return;
  }

  // Check existing
  const { data: existing } = await supabase
    .from('classification_history')
    .select('proposal_tx_hash, proposal_index');

  const existingKeys = new Set(
    (existing || []).map((e) => `${e.proposal_tx_hash}-${e.proposal_index}`),
  );

  const toInsert = classifications
    .filter((c) => !existingKeys.has(`${c.proposal_tx_hash}-${c.proposal_index}`))
    .map((c) => ({
      proposal_tx_hash: c.proposal_tx_hash,
      proposal_index: c.proposal_index,
      classified_at: c.classified_at || new Date().toISOString(),
      classifier_version: 'v1-backfill',
      dim_treasury_conservative: c.dim_treasury_conservative || 0,
      dim_treasury_growth: c.dim_treasury_growth || 0,
      dim_decentralization: c.dim_decentralization || 0,
      dim_security: c.dim_security || 0,
      dim_innovation: c.dim_innovation || 0,
      dim_transparency: c.dim_transparency || 0,
    }));

  console.log(`  ${toInsert.length} new classification history rows to insert.`);

  if (!DRY_RUN && toInsert.length > 0) {
    const inserted = await upsertBatch(
      'classification_history',
      toInsert,
      'proposal_tx_hash,proposal_index,classified_at',
    );
    console.log(`  Inserted ${inserted} rows.`);
  }
}

// ---------------------------------------------------------------------------
// Phase runners
// ---------------------------------------------------------------------------

async function runPhase1(from: number, to: number) {
  await backfillGovernanceEpochStats(from, to);
  await backfillParticipation(from, to);
  await backfillVoteAndAlignmentSnapshots(from, to);
  await backfillEpochRecaps(from, to);
}

async function runPhase2(from: number, to: number) {
  await backfillPowerSnapshots();
  await backfillProposalVotingSummary();
  await backfillTreasurySnapshots(from, to);
  await backfillDelegationSnapshots(from, to);
}

async function runPhase3(from: number, to: number) {
  await backfillTreasuryHealth(from, to);
  await backfillClassificationHistory();
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  const args = process.argv.slice(2);
  const target = args[0];

  if (!target) {
    console.log(
      'Usage: npx tsx scripts/backfill-snapshots.ts <target> [--from epoch] [--to epoch] [--dry-run]',
    );
    console.log('\nTargets:');
    console.log('  all                      Run all phases (1, 2, 3)');
    console.log(
      '  phase1                   DB-only: epoch_stats, participation, vote_snaps, recaps',
    );
    console.log('  phase2                   Koios: power_history, voting_summary, delegation');
    console.log('  phase3                   Derived: treasury_health, classification_history');
    console.log('  governance_epoch_stats    Per-epoch governance aggregate stats');
    console.log('  participation            Governance participation snapshots');
    console.log('  vote_snapshots           Proposal vote + inter-body alignment snapshots');
    console.log('  epoch_recaps             Epoch recap narratives');
    console.log('  power_history            DRep voting power history from Koios');
    console.log('  voting_summary           Proposal voting summaries from Koios');
    console.log('  delegation               Delegation snapshots from power data');
    console.log('  treasury_snapshots       Treasury balance history from Koios');
    console.log('  treasury_health          Treasury health score snapshots');
    console.log('  classification_history   Classification dimension history');
    process.exit(1);
  }

  DRY_RUN = args.includes('--dry-run');
  if (DRY_RUN) console.log('DRY RUN — no data will be written.\n');

  const fromIdx = args.indexOf('--from');
  const toIdx = args.indexOf('--to');
  const fromArg = fromIdx >= 0 ? parseInt(args[fromIdx + 1]) : undefined;
  const toArg = toIdx >= 0 ? parseInt(args[toIdx + 1]) : undefined;
  const { from, to } = await getEpochRange(fromArg, toArg);

  console.log(`Epoch range: ${from} – ${to} (${to - from + 1} epochs)`);
  const start = Date.now();

  switch (target) {
    case 'all':
      await runPhase1(from, to);
      await runPhase2(from, to);
      await runPhase3(from, to);
      break;
    case 'phase1':
      await runPhase1(from, to);
      break;
    case 'phase2':
      await runPhase2(from, to);
      break;
    case 'phase3':
      await runPhase3(from, to);
      break;
    case 'governance_epoch_stats':
      await backfillGovernanceEpochStats(from, to);
      break;
    case 'participation':
      await backfillParticipation(from, to);
      break;
    case 'vote_snapshots':
      await backfillVoteAndAlignmentSnapshots(from, to);
      break;
    case 'epoch_recaps':
      await backfillEpochRecaps(from, to);
      break;
    case 'power_history':
      await backfillPowerSnapshots();
      break;
    case 'voting_summary':
      await backfillProposalVotingSummary();
      break;
    case 'delegation':
      await backfillDelegationSnapshots(from, to);
      break;
    case 'treasury_snapshots':
      await backfillTreasurySnapshots(from, to);
      break;
    case 'treasury_health':
      await backfillTreasuryHealth(from, to);
      break;
    case 'classification_history':
      await backfillClassificationHistory();
      break;
    default:
      console.error(`Unknown target: ${target}`);
      process.exit(1);
  }

  const elapsed = ((Date.now() - start) / 1000).toFixed(1);
  console.log(`\nCompleted in ${elapsed}s.`);
  process.exit(0);
}

main().catch((e) => {
  console.error('Fatal:', e);
  process.exit(1);
});
