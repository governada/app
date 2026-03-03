import { z } from 'zod';
import { DrepIdSchema, SessionTokenSchema, TxHashSchema, ProposalIndexSchema } from './common';

export const DrepClaimSchema = z.object({
  sessionToken: SessionTokenSchema,
  drepId: DrepIdSchema,
});

export const DrepPhilosophySchema = z.object({
  sessionToken: SessionTokenSchema,
  philosophyText: z.string().min(1, 'philosophyText is required').max(5000),
});

export const DrepPositionSchema = z.object({
  sessionToken: SessionTokenSchema,
  proposalTxHash: TxHashSchema,
  proposalIndex: ProposalIndexSchema,
  statementText: z.string().min(1, 'statementText is required').max(5000),
});

export const DrepExplanationSchema = z.object({
  sessionToken: SessionTokenSchema,
  proposalTxHash: TxHashSchema,
  proposalIndex: ProposalIndexSchema,
  explanationText: z.string().min(1, 'explanationText is required').max(5000),
  aiAssisted: z.boolean().optional(),
});
