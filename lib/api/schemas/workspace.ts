import { z } from 'zod';

// ---------------------------------------------------------------------------
// Shared enums
// ---------------------------------------------------------------------------

const ProposalTypeEnum = z.enum([
  'InfoAction',
  'TreasuryWithdrawals',
  'ParameterChange',
  'HardForkInitiation',
  'NoConfidence',
  'NewCommittee',
  'NewConstitution',
]);

// ---------------------------------------------------------------------------
// Draft CRUD schemas (authoring pipeline)
// ---------------------------------------------------------------------------

export const CreateDraftSchema = z.object({
  stakeAddress: z.string().min(1, 'stakeAddress is required'),
  title: z.string().max(200).default(''),
  abstract: z.string().max(2000).default(''),
  motivation: z.string().max(10000).default(''),
  rationale: z.string().max(10000).default(''),
  proposalType: ProposalTypeEnum,
  typeSpecific: z.record(z.string(), z.unknown()).optional(),
});

export const UpdateDraftSchema = z.object({
  title: z.string().max(200).optional(),
  abstract: z.string().max(2000).optional(),
  motivation: z.string().max(10000).optional(),
  rationale: z.string().max(10000).optional(),
  proposalType: ProposalTypeEnum.optional(),
  typeSpecific: z.record(z.string(), z.unknown()).optional(),
  status: z.enum(['draft', 'review', 'ready', 'submitted', 'archived']).optional(),
});

export const SaveVersionSchema = z.object({
  versionName: z.string().min(1, 'versionName is required').max(200),
  editSummary: z.string().max(1000).optional(),
});

// ---------------------------------------------------------------------------
// Constitutional pre-check schema
// ---------------------------------------------------------------------------

export const ConstitutionalCheckSchema = z.object({
  title: z.string().min(1, 'title is required').max(200),
  abstract: z.string().max(2000).default(''),
  motivation: z.string().max(10000).default(''),
  rationale: z.string().max(10000).default(''),
  proposalType: ProposalTypeEnum,
  typeSpecific: z.record(z.string(), z.unknown()).optional(),
});

// ---------------------------------------------------------------------------
// CIP-108 preview schema
// ---------------------------------------------------------------------------

export const Cip108PreviewSchema = z.object({
  title: z.string().min(1, 'title is required').max(200),
  abstract: z.string().max(2000).default(''),
  motivation: z.string().max(10000).default(''),
  rationale: z.string().max(10000).default(''),
  authorName: z.string().max(200).optional(),
});

// ---------------------------------------------------------------------------
// Review queue schema
// ---------------------------------------------------------------------------

export const ReviewQueueParamsSchema = z.object({
  drepId: z.string().optional(),
  poolId: z.string().optional(),
});
