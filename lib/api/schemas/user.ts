import { z } from 'zod';
import { SessionTokenSchema } from './common';

export const EmailSchema = z.object({
  email: z.string().min(1, 'email is required').email('Invalid email address'),
});

export const ChannelConnectSchema = z.object({
  channel: z.string().min(1, 'channel is required'),
  channelIdentifier: z.string().min(1, 'channelIdentifier is required'),
  config: z.record(z.string(), z.unknown()).optional(),
});

export const ChannelDeleteSchema = z.object({
  channel: z.string().min(1, 'channel is required'),
});

export const NotificationPrefSchema = z.object({
  channel: z.string().min(1, 'channel is required'),
  eventType: z.string().min(1, 'eventType is required'),
  enabled: z.boolean(),
});

export const TelegramConnectSchema = z.object({
  token: z.string().min(1, 'token is required'),
});

export const OnboardingSchema = z.object({
  sessionToken: SessionTokenSchema,
  item: z.string().min(1, 'item is required'),
  completed: z.boolean().optional(),
});

const PushCriticalProposalSchema = z.object({
  type: z.literal('critical-proposal-open'),
  proposalTitle: z.string().optional(),
  txHash: z.string().optional(),
  index: z.coerce.number().int().min(0).optional(),
});

const PushPendingProposalsSchema = z.object({
  type: z.literal('drep-pending-proposals'),
  pendingCount: z.coerce.number().int().min(0).optional(),
  criticalCount: z.coerce.number().int().min(0).optional(),
});

const PushTestSchema = z.object({
  type: z.literal('test'),
});

export const PushSendSchema = z.discriminatedUnion('type', [
  PushCriticalProposalSchema,
  PushPendingProposalsSchema,
  PushTestSchema,
]);
