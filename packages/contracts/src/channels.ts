import { z } from 'zod';
import { CHANNEL_NAME_MAX, CHANNEL_NAME_MIN } from './constants.js';
import { visibleTextSchema } from './text.js';

export const channelSchema = z.object({
  id: z.string(),
  slug: z.string(),
  name: z.string(),
  position: z.number().int(),
});
export type Channel = z.infer<typeof channelSchema>;

/** Um participante dentro de um canal, visto pelo LiveKit. */
export const presenceParticipantSchema = z.object({
  userId: z.string(),
  nickname: z.string(),
  avatarUrl: z.string().nullable(),
  micMuted: z.boolean(),
  screenSharing: z.boolean(),
});
export type PresenceParticipant = z.infer<typeof presenceParticipantSchema>;

export const channelWithPresenceSchema = channelSchema.extend({
  participants: z.array(presenceParticipantSchema),
});
export type ChannelWithPresence = z.infer<typeof channelWithPresenceSchema>;

export const channelsResponseSchema = z.object({
  channels: z.array(channelWithPresenceSchema),
  onlineCount: z.number().int().nonnegative(),
});
export type ChannelsResponse = z.infer<typeof channelsResponseSchema>;

/** Nome de exibição do canal: 1..32 caracteres visíveis (decisão D17). */
export const createChannelRequestSchema = z.object({
  name: visibleTextSchema(CHANNEL_NAME_MIN, CHANNEL_NAME_MAX),
});
export type CreateChannelRequest = z.infer<typeof createChannelRequestSchema>;

export const createChannelResponseSchema = channelSchema;
export type CreateChannelResponse = Channel;

export const channelSlugParamsSchema = z.object({ slug: z.string().min(1) });
export type ChannelSlugParams = z.infer<typeof channelSlugParamsSchema>;

/** Resposta de `POST /channels/:slug/token`. */
export const channelTokenResponseSchema = z.object({
  token: z.string(),
  url: z.string(),
  expiresAt: z.iso.datetime(),
});
export type ChannelTokenResponse = z.infer<typeof channelTokenResponseSchema>;
