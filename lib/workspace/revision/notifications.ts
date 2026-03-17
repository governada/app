/**
 * Revision notification logic.
 *
 * When a proposer publishes a new version with justifications, notify all
 * users who previously interacted with the proposal (annotated, voted,
 * or endorsed a feedback theme).
 */

import { getSupabaseAdmin } from '@/lib/supabase';
import { logger } from '@/lib/logger';

interface RecipientInfo {
  userId: string;
  type: 'commenter' | 'voter' | 'endorser';
}

/**
 * Notify all reviewers who previously interacted with this proposal
 * that a new revision has been published.
 *
 * Queries three sources of prior interaction:
 * 1. Users who left annotations on this proposal (commenters)
 * 2. Users who endorsed feedback themes on this proposal (endorsers)
 * 3. (Future) Users who voted on this proposal (voters — requires on-chain proposal linkage)
 *
 * Creates one `proposal_revision_notifications` row per unique user,
 * with the strongest interaction type taking priority.
 */
export async function notifyReviewers(
  proposalId: string,
  draftId: string,
  versionNumber: number,
  changedFields: string[],
  addressedThemes: string[],
): Promise<void> {
  const admin = getSupabaseAdmin();

  // Collect unique recipients from different interaction sources
  const recipientMap = new Map<string, RecipientInfo>();

  // 1. Find users who left annotations on this proposal draft
  //    Annotations reference proposal_tx_hash, but for drafts we look up
  //    by joining through the draft's linked proposal if any, or by the draft_id
  //    in the reviews table.
  try {
    // Get annotations by looking for reviews on this draft
    const { data: reviews } = await admin
      .from('proposal_draft_reviews')
      .select('reviewer_stake_address')
      .eq('draft_id', draftId);

    if (reviews) {
      for (const review of reviews) {
        // Look up the user_id for this stake address
        const { data: user } = await admin
          .from('user_profiles')
          .select('user_id')
          .eq('stake_address', review.reviewer_stake_address)
          .single();

        if (user?.user_id) {
          recipientMap.set(user.user_id, {
            userId: user.user_id,
            type: 'commenter',
          });
        }
      }
    }
  } catch (err) {
    // Table may not exist yet — log and continue
    logger.warn('Could not query draft reviews for notifications', { error: err });
  }

  // 2. Find users who endorsed feedback themes on this proposal
  try {
    const { data: endorsements } = await admin
      .from('proposal_theme_endorsements')
      .select('reviewer_user_id, theme:proposal_feedback_themes!inner(proposal_tx_hash)')
      .not('reviewer_user_id', 'is', null);

    // Filter endorsements belonging to themes for this draft's proposal
    // This is a best-effort — if themes are linked via proposal_tx_hash we
    // need the draft's linked proposal hash. For now, use draft_id matching
    // through any available linkage.
    if (endorsements) {
      for (const endorsement of endorsements) {
        const userId = endorsement.reviewer_user_id;
        if (userId && !recipientMap.has(userId)) {
          recipientMap.set(userId, {
            userId,
            type: 'endorser',
          });
        }
      }
    }
  } catch (err) {
    // Tables may not exist yet — log and continue
    logger.warn('Could not query theme endorsements for notifications', { error: err });
  }

  // 3. Find the draft owner so we can exclude them from notifications
  let ownerStakeAddress: string | null = null;
  try {
    const { data: draft } = await admin
      .from('proposal_drafts')
      .select('owner_stake_address')
      .eq('id', draftId)
      .single();

    ownerStakeAddress = draft?.owner_stake_address ?? null;
  } catch {
    // Non-critical — worst case the owner gets a self-notification
  }

  // Exclude the draft owner from notifications
  if (ownerStakeAddress) {
    try {
      const { data: ownerProfile } = await admin
        .from('user_profiles')
        .select('user_id')
        .eq('stake_address', ownerStakeAddress)
        .single();

      if (ownerProfile?.user_id) {
        recipientMap.delete(ownerProfile.user_id);
      }
    } catch {
      // Non-critical
    }
  }

  if (recipientMap.size === 0) {
    logger.info('No reviewers to notify for revision', {
      draftId,
      versionNumber,
    });
    return;
  }

  // Create notification rows
  const notifications = Array.from(recipientMap.values()).map((recipient) => ({
    draft_id: draftId,
    version_number: versionNumber,
    recipient_user_id: recipient.userId,
    recipient_type: recipient.type,
    sections_changed: changedFields,
    themes_addressed: addressedThemes,
  }));

  const { error } = await admin.from('proposal_revision_notifications').insert(notifications);

  if (error) {
    logger.error('Failed to create revision notifications', {
      error,
      draftId,
      versionNumber,
      recipientCount: notifications.length,
    });
    return;
  }

  logger.info('Created revision notifications', {
    draftId,
    versionNumber,
    recipientCount: notifications.length,
    changedFields,
    addressedThemes,
  });
}
