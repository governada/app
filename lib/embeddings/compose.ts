/**
 * Text composition functions for each entity type.
 * Creates enriched documents that capture semantic meaning for embedding.
 */

import { createHash } from 'crypto';
import type { ComposedDocument } from './types';

function contentHash(text: string): string {
  return createHash('sha256').update(text).digest('hex');
}

/** Clean and join text parts, filtering out nullish values. */
function composeParts(parts: (string | null | undefined)[]): string {
  return parts.filter(Boolean).join('\n\n');
}

export function composeProposal(proposal: {
  tx_hash: string;
  index: number;
  title: string | null;
  abstract: string | null;
  proposal_type: string | null;
  ai_summary?: string | null;
  classification_narrative?: string | null;
}): ComposedDocument {
  const text = composeParts([
    proposal.title && `Title: ${proposal.title}`,
    proposal.abstract && `Abstract: ${proposal.abstract}`,
    proposal.proposal_type && `Type: ${proposal.proposal_type}`,
    proposal.ai_summary && `Summary: ${proposal.ai_summary}`,
    proposal.classification_narrative && `Classification: ${proposal.classification_narrative}`,
  ]);
  return {
    entityType: 'proposal',
    entityId: `${proposal.tx_hash}:${proposal.index}`,
    text,
    contentHash: contentHash(text),
  };
}

export function composeRationale(rationale: {
  tx_hash: string;
  index: number;
  voter_id: string;
  rationale_text: string | null;
  vote_direction: string | null;
  proposal_title?: string | null;
  proposal_type?: string | null;
  drep_name?: string | null;
}): ComposedDocument {
  const text = composeParts([
    rationale.drep_name && `DRep: ${rationale.drep_name}`,
    rationale.vote_direction && `Vote: ${rationale.vote_direction}`,
    rationale.proposal_title && `On proposal: ${rationale.proposal_title}`,
    rationale.proposal_type && `Proposal type: ${rationale.proposal_type}`,
    rationale.rationale_text && `Rationale: ${rationale.rationale_text}`,
  ]);
  return {
    entityType: 'rationale',
    entityId: `${rationale.tx_hash}:${rationale.index}`,
    secondaryId: rationale.voter_id,
    text,
    contentHash: contentHash(text),
  };
}

export function composeDrepProfile(drep: {
  drep_id: string;
  name: string | null;
  objectives: string | null;
  motivations: string | null;
  alignment_narrative?: string | null;
  personality_label?: string | null;
  sample_rationales?: string[];
}): ComposedDocument {
  const text = composeParts([
    drep.name && `Name: ${drep.name}`,
    drep.objectives && `Objectives: ${drep.objectives}`,
    drep.motivations && `Motivations: ${drep.motivations}`,
    drep.alignment_narrative && `Alignment: ${drep.alignment_narrative}`,
    drep.personality_label && `Personality: ${drep.personality_label}`,
    drep.sample_rationales?.length
      ? `Sample rationales:\n${drep.sample_rationales.slice(0, 5).join('\n---\n')}`
      : null,
  ]);
  return {
    entityType: 'drep_profile',
    entityId: drep.drep_id,
    text,
    contentHash: contentHash(text),
  };
}

export function composeUserPreference(user: {
  user_id: string;
  conversation_text: string;
  personality_label?: string | null;
  alignment_narrative?: string | null;
}): ComposedDocument {
  const text = composeParts([
    user.conversation_text,
    user.personality_label && `Personality: ${user.personality_label}`,
    user.alignment_narrative && `Alignment: ${user.alignment_narrative}`,
  ]);
  return {
    entityType: 'user_preference',
    entityId: user.user_id,
    text,
    contentHash: contentHash(text),
  };
}

export function composeProposalDraft(draft: {
  draft_id: string;
  title: string | null;
  abstract: string | null;
  motivation: string | null;
  rationale: string | null;
}): ComposedDocument {
  const text = composeParts([
    draft.title && `Title: ${draft.title}`,
    draft.abstract && `Abstract: ${draft.abstract}`,
    draft.motivation && `Motivation: ${draft.motivation}`,
    draft.rationale && `Rationale: ${draft.rationale}`,
  ]);
  return {
    entityType: 'proposal_draft',
    entityId: draft.draft_id,
    text,
    contentHash: contentHash(text),
  };
}

export function composeReviewAnnotation(annotation: {
  annotation_id: string;
  annotation_text: string;
  proposal_section?: string | null;
  reviewer_stance?: string | null;
}): ComposedDocument {
  const text = composeParts([
    annotation.reviewer_stance && `Stance: ${annotation.reviewer_stance}`,
    annotation.proposal_section && `Section: ${annotation.proposal_section}`,
    `Review: ${annotation.annotation_text}`,
  ]);
  return {
    entityType: 'review_annotation',
    entityId: annotation.annotation_id,
    text,
    contentHash: contentHash(text),
  };
}
