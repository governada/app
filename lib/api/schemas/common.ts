import { z } from 'zod';

export const DrepIdSchema = z.string().min(1, 'drepId is required');

export const TxHashSchema = z.string().min(1, 'txHash is required');

export const SessionTokenSchema = z.string().min(1, 'sessionToken is required');

export const ProposalIndexSchema = z.coerce.number().int().min(0);

export const PaginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});
