import { describe, test, expect } from 'vitest';
import {
  composeProposal,
  composeRationale,
  composeDrepProfile,
  composeUserPreference,
  composeProposalDraft,
  composeReviewAnnotation,
} from '@/lib/embeddings/compose';

describe('composeProposal', () => {
  test('produces correct entityType and entityId', () => {
    const doc = composeProposal({
      tx_hash: 'abc123',
      index: 0,
      title: 'Fund the thing',
      abstract: 'A great proposal',
      proposal_type: 'InfoAction',
    });
    expect(doc.entityType).toBe('proposal');
    expect(doc.entityId).toBe('abc123:0');
    expect(doc.secondaryId).toBeUndefined();
  });

  test('includes all non-null fields in text', () => {
    const doc = composeProposal({
      tx_hash: 'tx1',
      index: 1,
      title: 'My Proposal',
      abstract: 'Some abstract',
      proposal_type: 'TreasuryWithdrawals',
      ai_summary: 'AI says this',
      classification_narrative: 'Classified as X',
    });
    expect(doc.text).toContain('Title: My Proposal');
    expect(doc.text).toContain('Abstract: Some abstract');
    expect(doc.text).toContain('Type: TreasuryWithdrawals');
    expect(doc.text).toContain('Summary: AI says this');
    expect(doc.text).toContain('Classification: Classified as X');
  });

  test('handles null fields gracefully', () => {
    const doc = composeProposal({
      tx_hash: 'tx2',
      index: 0,
      title: 'Only Title',
      abstract: null,
      proposal_type: null,
    });
    expect(doc.text).toContain('Title: Only Title');
    expect(doc.text).not.toContain('Abstract');
    expect(doc.text).not.toContain('Type');
  });

  test('produces stable content hash', () => {
    const a = composeProposal({
      tx_hash: 'tx3',
      index: 0,
      title: 'Stable',
      abstract: 'Hash test',
      proposal_type: null,
    });
    const b = composeProposal({
      tx_hash: 'tx3',
      index: 0,
      title: 'Stable',
      abstract: 'Hash test',
      proposal_type: null,
    });
    expect(a.contentHash).toBe(b.contentHash);
    expect(a.contentHash).toHaveLength(64); // SHA-256 hex
  });

  test('different content produces different hash', () => {
    const a = composeProposal({
      tx_hash: 'tx4',
      index: 0,
      title: 'Version A',
      abstract: null,
      proposal_type: null,
    });
    const b = composeProposal({
      tx_hash: 'tx4',
      index: 0,
      title: 'Version B',
      abstract: null,
      proposal_type: null,
    });
    expect(a.contentHash).not.toBe(b.contentHash);
  });
});

describe('composeRationale', () => {
  test('produces correct entityType, entityId, and secondaryId', () => {
    const doc = composeRationale({
      tx_hash: 'vtx1',
      index: 2,
      voter_id: 'drep1abc',
      rationale_text: 'I support this',
      vote_direction: 'Yes',
    });
    expect(doc.entityType).toBe('rationale');
    expect(doc.entityId).toBe('vtx1:2');
    expect(doc.secondaryId).toBe('drep1abc');
  });

  test('includes context fields', () => {
    const doc = composeRationale({
      tx_hash: 'vtx2',
      index: 0,
      voter_id: 'drep2',
      rationale_text: 'Bad idea',
      vote_direction: 'No',
      proposal_title: 'The Proposal',
      proposal_type: 'HardForkInitiation',
      drep_name: 'Alice',
    });
    expect(doc.text).toContain('DRep: Alice');
    expect(doc.text).toContain('Vote: No');
    expect(doc.text).toContain('On proposal: The Proposal');
    expect(doc.text).toContain('Rationale: Bad idea');
  });
});

describe('composeDrepProfile', () => {
  test('produces correct entityType and entityId', () => {
    const doc = composeDrepProfile({
      drep_id: 'drep_abc',
      name: 'Bob',
      objectives: 'Build things',
      motivations: 'For the community',
    });
    expect(doc.entityType).toBe('drep_profile');
    expect(doc.entityId).toBe('drep_abc');
  });

  test('includes sample rationales', () => {
    const doc = composeDrepProfile({
      drep_id: 'drep_xyz',
      name: null,
      objectives: null,
      motivations: null,
      sample_rationales: ['First rationale', 'Second rationale'],
    });
    expect(doc.text).toContain('Sample rationales:');
    expect(doc.text).toContain('First rationale');
  });

  test('limits sample rationales to 5', () => {
    const rationales = Array.from({ length: 10 }, (_, i) => `Rationale ${i}`);
    const doc = composeDrepProfile({
      drep_id: 'drep_many',
      name: null,
      objectives: null,
      motivations: null,
      sample_rationales: rationales,
    });
    expect(doc.text).toContain('Rationale 4');
    expect(doc.text).not.toContain('Rationale 5');
  });
});

describe('composeUserPreference', () => {
  test('produces correct entityType', () => {
    const doc = composeUserPreference({
      user_id: 'user123',
      conversation_text: 'I care about decentralization',
    });
    expect(doc.entityType).toBe('user_preference');
    expect(doc.entityId).toBe('user123');
  });

  test('includes optional fields', () => {
    const doc = composeUserPreference({
      user_id: 'user456',
      conversation_text: 'My preferences',
      personality_label: 'The Guardian',
      alignment_narrative: 'Conservative approach',
    });
    expect(doc.text).toContain('Personality: The Guardian');
    expect(doc.text).toContain('Alignment: Conservative approach');
  });
});

describe('composeProposalDraft', () => {
  test('produces correct document', () => {
    const doc = composeProposalDraft({
      draft_id: 'draft-001',
      title: 'My Draft',
      abstract: 'Draft abstract',
      motivation: 'Why we need this',
      rationale: 'Because reasons',
    });
    expect(doc.entityType).toBe('proposal_draft');
    expect(doc.entityId).toBe('draft-001');
    expect(doc.text).toContain('Title: My Draft');
    expect(doc.text).toContain('Motivation: Why we need this');
  });
});

describe('composeReviewAnnotation', () => {
  test('produces correct document', () => {
    const doc = composeReviewAnnotation({
      annotation_id: 'ann-001',
      annotation_text: 'This section needs work',
      proposal_section: 'Abstract',
      reviewer_stance: 'Concerned',
    });
    expect(doc.entityType).toBe('review_annotation');
    expect(doc.entityId).toBe('ann-001');
    expect(doc.text).toContain('Stance: Concerned');
    expect(doc.text).toContain('Section: Abstract');
    expect(doc.text).toContain('Review: This section needs work');
  });

  test('handles missing optional fields', () => {
    const doc = composeReviewAnnotation({
      annotation_id: 'ann-002',
      annotation_text: 'Looks good',
    });
    expect(doc.text).toContain('Review: Looks good');
    expect(doc.text).not.toContain('Stance');
    expect(doc.text).not.toContain('Section');
  });
});
