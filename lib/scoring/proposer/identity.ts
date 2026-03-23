/**
 * Proposer Identity Resolution
 *
 * Resolves CIP-100 author metadata from proposals into canonical proposer
 * entities. Handles alias deduplication (e.g. "KtorZ" and
 * "KtorZ <matthias.benkort@...>" map to the same proposer).
 *
 * Called by the sync pipeline after proposal metadata is fetched.
 */

import { getSupabaseAdmin } from '@/lib/supabase';
import { logger } from '@/lib/logger';
import { createHash } from 'crypto';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface CIP100Author {
  name?: string;
  witness?: {
    publicKey?: string;
    witnessAlgorithm?: string;
  };
}

/** Known institutional/organizational proposers for type classification. */
const INSTITUTIONAL_NAMES = new Set([
  'intersect',
  'cardano foundation',
  'input output global',
  'iog',
  'emurgo',
]);

const ORGANIZATION_PATTERNS = [
  /foundation$/i,
  /council$/i,
  /network$/i,
  /alliance$/i,
  /committee$/i,
  /holdings/i,
];

// ---------------------------------------------------------------------------
// Identity resolution
// ---------------------------------------------------------------------------

/**
 * Normalize an author name for deduplication.
 * Strips email addresses, trims whitespace, lowercases.
 * "KtorZ <matthias.benkort@cardanofoundation.org>" → "ktorz"
 */
function normalizeName(name: string): string {
  return name
    .replace(/<[^>]+>/g, '') // strip email/angle-bracket content
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

/**
 * Generate a stable proposer ID from a normalized name + optional public key.
 * Uses a hash to ensure IDs are URL-safe and consistent.
 */
function generateProposerId(normalizedName: string, publicKey?: string): string {
  const input = publicKey ? `${normalizedName}:${publicKey}` : normalizedName;
  return createHash('sha256').update(input).digest('hex').slice(0, 16);
}

/**
 * Classify proposer type based on name patterns.
 */
function classifyProposerType(name: string): 'individual' | 'organization' | 'institutional' {
  const lower = name.toLowerCase();
  if (INSTITUTIONAL_NAMES.has(lower)) return 'institutional';
  if (ORGANIZATION_PATTERNS.some((p) => p.test(name))) return 'organization';
  // Names with spaces and no org patterns are likely individuals
  // Single-word names could be either, default to individual
  return 'individual';
}

/**
 * Extract the display name from a CIP-100 author entry.
 * Prefers the name field, strips email suffixes for cleaner display.
 */
function extractDisplayName(author: CIP100Author): string {
  if (!author.name) return 'Unknown';
  // Keep the full name for display but clean up formatting
  return author.name.replace(/<[^>]+>/g, '').trim();
}

// ---------------------------------------------------------------------------
// Main resolution function
// ---------------------------------------------------------------------------

/**
 * Resolve all proposers from the proposals table.
 * Idempotent — safe to run repeatedly. Creates new proposers, updates
 * aliases, and links proposals to proposers.
 *
 * Returns the number of proposers created/updated.
 */
export async function resolveAllProposers(): Promise<{
  proposersCreated: number;
  proposersUpdated: number;
  proposalsLinked: number;
}> {
  const supabase = getSupabaseAdmin();

  // 1. Fetch all proposals with author metadata
  const { data: proposals, error: fetchErr } = await supabase
    .from('proposals')
    .select(
      'tx_hash, proposal_index, meta_json, proposed_epoch, enacted_epoch, dropped_epoch, expired_epoch, ratified_epoch',
    );

  if (fetchErr || !proposals) {
    logger.error('[ProposerIdentity] Failed to fetch proposals', { error: fetchErr });
    return { proposersCreated: 0, proposersUpdated: 0, proposalsLinked: 0 };
  }

  // 2. Build a map of normalized name → proposer data
  const proposerMap = new Map<
    string,
    {
      id: string;
      displayName: string;
      type: 'individual' | 'organization' | 'institutional';
      aliases: { name: string; key: string }[];
      proposals: {
        txHash: string;
        index: number;
        proposedEpoch: number | null;
        enacted: boolean;
        dropped: boolean;
      }[];
    }
  >();

  for (const p of proposals) {
    const meta = p.meta_json as Record<string, unknown> | null;
    if (!meta) continue;

    const authors = meta.authors as CIP100Author[] | undefined;
    if (!authors || !Array.isArray(authors) || authors.length === 0) continue;

    for (const author of authors) {
      if (!author.name || author.name.trim() === '') continue;

      const normalized = normalizeName(author.name);
      const publicKey = author.witness?.publicKey ?? '';
      const proposerId = generateProposerId(normalized, publicKey || undefined);

      let entry = proposerMap.get(proposerId);
      if (!entry) {
        entry = {
          id: proposerId,
          displayName: extractDisplayName(author),
          type: classifyProposerType(author.name),
          aliases: [],
          proposals: [],
        };
        proposerMap.set(proposerId, entry);
      }

      // Add alias if not already present
      const aliasKey = publicKey || '';
      const hasAlias = entry.aliases.some((a) => a.name === author.name && a.key === aliasKey);
      if (!hasAlias) {
        entry.aliases.push({ name: author.name, key: aliasKey });
      }

      // Add proposal link
      entry.proposals.push({
        txHash: p.tx_hash,
        index: p.proposal_index,
        proposedEpoch: p.proposed_epoch,
        enacted: !!(p.enacted_epoch || p.ratified_epoch),
        dropped: !!(p.dropped_epoch || (p.expired_epoch && !p.enacted_epoch && !p.ratified_epoch)),
      });
    }
  }

  // 3. Upsert proposers
  let created = 0;
  let updated = 0;
  let linked = 0;

  for (const entry of proposerMap.values()) {
    const firstEpoch =
      entry.proposals
        .map((p) => p.proposedEpoch)
        .filter((e): e is number => e !== null)
        .sort((a, b) => a - b)[0] ?? null;

    const proposalCount = entry.proposals.length;
    const enactedCount = entry.proposals.filter((p) => p.enacted).length;
    const droppedCount = entry.proposals.filter((p) => p.dropped).length;

    const { error: upsertErr, data: upsertData } = await supabase
      .from('proposers')
      .upsert(
        {
          id: entry.id,
          display_name: entry.displayName,
          type: entry.type,
          first_proposal_epoch: firstEpoch,
          proposal_count: proposalCount,
          enacted_count: enactedCount,
          dropped_count: droppedCount,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'id' },
      )
      .select('id');

    if (upsertErr) {
      logger.error('[ProposerIdentity] Failed to upsert proposer', {
        proposerId: entry.id,
        error: upsertErr,
      });
      continue;
    }

    if (upsertData?.length) {
      // Check if this was a create or update (approximation)
      created++;
    }

    // 4. Upsert aliases
    for (const alias of entry.aliases) {
      await supabase.from('proposer_aliases').upsert(
        {
          alias_name: alias.name,
          alias_key: alias.key,
          proposer_id: entry.id,
        },
        { onConflict: 'alias_name,alias_key' },
      );
    }

    // 5. Link proposals
    for (const p of entry.proposals) {
      const { error: linkErr } = await supabase.from('proposal_proposers').upsert(
        {
          proposal_tx_hash: p.txHash,
          proposal_index: p.index,
          proposer_id: entry.id,
        },
        { onConflict: 'proposal_tx_hash,proposal_index,proposer_id' },
      );
      if (!linkErr) linked++;
    }
  }

  updated = created; // all are upserts in this batch model

  logger.info('[ProposerIdentity] Resolution complete', {
    proposers: proposerMap.size,
    proposalsLinked: linked,
  });

  return { proposersCreated: proposerMap.size, proposersUpdated: updated, proposalsLinked: linked };
}
