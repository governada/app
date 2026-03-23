/**
 * Input quality gates for AI scoring use cases.
 *
 * Pre-call validation ensures we don't waste API calls on garbage input
 * and provides clear rejection reasons for debugging.
 */

export interface InputValidationResult {
  valid: boolean;
  reason?: string;
  warnings?: string[];
  inputStats?: Record<string, number>;
}

const BARE_URL_RE = /^https?:\/\/\S+$/;

/**
 * Validate input for DRep rationale quality scoring.
 */
export function validateRationaleInput(input: {
  rationaleText: string;
  proposalTitle?: string;
}): InputValidationResult {
  const warnings: string[] = [];
  const text = (input.rationaleText ?? '').trim();
  const stats: Record<string, number> = {
    textLength: text.length,
    hasTitle: input.proposalTitle ? 1 : 0,
  };

  if (!text || text.length < 20) {
    return {
      valid: false,
      reason: 'rationale_too_short',
      warnings,
      inputStats: stats,
    };
  }

  if (BARE_URL_RE.test(text)) {
    return {
      valid: false,
      reason: 'rationale_is_bare_url',
      warnings,
      inputStats: stats,
    };
  }

  if (!input.proposalTitle) {
    warnings.push('missing_proposal_title');
  }

  return { valid: true, warnings, inputStats: stats };
}

/**
 * Validate input for CC (Constitutional Committee) rationale analysis.
 */
export function validateCCRationaleInput(input: {
  rationale: string;
  proposalType?: string;
  memberHistory?: unknown[];
}): InputValidationResult {
  const warnings: string[] = [];
  const text = (input.rationale ?? '').trim();
  const stats: Record<string, number> = {
    textLength: text.length,
    hasProposalType: input.proposalType ? 1 : 0,
    memberHistoryCount: input.memberHistory?.length ?? 0,
  };

  if (!text || text.length < 50) {
    return {
      valid: false,
      reason: 'cc_rationale_too_short',
      warnings,
      inputStats: stats,
    };
  }

  if (!input.proposalType) {
    warnings.push('missing_proposal_type');
  }

  if (!input.memberHistory || input.memberHistory.length === 0) {
    warnings.push('no_member_history');
  }

  return { valid: true, warnings, inputStats: stats };
}

/**
 * Validate input for proposal quality scoring.
 */
export function validateProposalQualityInput(input: {
  abstract?: string;
  body?: string;
  motivation?: string;
  proposalType?: string;
}): InputValidationResult {
  const warnings: string[] = [];
  const abstractLen = (input.abstract ?? '').trim().length;
  const bodyLen = (input.body ?? '').trim().length;
  const stats: Record<string, number> = {
    abstractLength: abstractLen,
    bodyLength: bodyLen,
    motivationLength: (input.motivation ?? '').trim().length,
    hasProposalType: input.proposalType ? 1 : 0,
  };

  if (abstractLen < 30 && bodyLen === 0) {
    return {
      valid: false,
      reason: 'proposal_content_too_short',
      warnings,
      inputStats: stats,
    };
  }

  if (!input.proposalType) {
    warnings.push('missing_proposal_type');
  }

  if (!input.motivation) {
    warnings.push('missing_motivation');
  }

  return { valid: true, warnings, inputStats: stats };
}

/**
 * Validate input for constitutional alignment checks.
 */
export function validateConstitutionalCheckInput(input: {
  title: string;
  abstract?: string;
  proposalType?: string;
}): InputValidationResult {
  const warnings: string[] = [];
  const title = (input.title ?? '').trim();
  const abstractLen = (input.abstract ?? '').trim().length;
  const stats: Record<string, number> = {
    titleLength: title.length,
    abstractLength: abstractLen,
    hasProposalType: input.proposalType ? 1 : 0,
  };

  if (!title) {
    return {
      valid: false,
      reason: 'missing_title',
      warnings,
      inputStats: stats,
    };
  }

  if (abstractLen < 10) {
    return {
      valid: false,
      reason: 'abstract_too_short',
      warnings,
      inputStats: stats,
    };
  }

  if (!input.proposalType) {
    warnings.push('missing_proposal_type');
  }

  return { valid: true, warnings, inputStats: stats };
}
