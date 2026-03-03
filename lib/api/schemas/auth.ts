import { z } from 'zod';

export const WalletAuthSchema = z.object({
  address: z.string().min(1, 'address is required'),
  nonce: z.string().min(1, 'nonce is required'),
  nonceSignature: z.string().min(1, 'nonceSignature is required'),
  signature: z.string().min(1, 'signature is required'),
  key: z.string().min(1, 'key is required'),
});
