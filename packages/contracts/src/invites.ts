import { z } from 'zod';

export const createInviteResponseSchema = z.object({
  code: z.string(),
  expiresAt: z.iso.datetime(),
});
export type CreateInviteResponse = z.infer<typeof createInviteResponseSchema>;

export const inviteSummarySchema = z.object({
  code: z.string(),
  createdAt: z.iso.datetime(),
  expiresAt: z.iso.datetime(),
  usedAt: z.iso.datetime().nullable(),
});
export type InviteSummary = z.infer<typeof inviteSummarySchema>;

export const invitesResponseSchema = z.object({
  invites: z.array(inviteSummarySchema),
});
export type InvitesResponse = z.infer<typeof invitesResponseSchema>;
