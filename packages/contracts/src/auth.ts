import { z } from 'zod';
import { CODE_LENGTH, INVITE_ALPHABET, PASSWORD_MAX, PASSWORD_MIN } from './constants.js';
import { meSchema } from './me.js';

const codePattern = new RegExp(`^[${INVITE_ALPHABET}]{${CODE_LENGTH}}$`);

/** Código de convite/login: 6 caracteres do alfabeto de D2, sempre maiúsculos. */
export const inviteCodeSchema = z
  .string()
  .trim()
  .toUpperCase()
  .regex(codePattern, 'Código inválido');
export type InviteCode = z.infer<typeof inviteCodeSchema>;

export const loginRequestSchema = z.object({
  code: inviteCodeSchema,
  password: z.string().min(PASSWORD_MIN).max(PASSWORD_MAX),
});
export type LoginRequest = z.infer<typeof loginRequestSchema>;

export const loginResponseSchema = z.object({ user: meSchema });
export type LoginResponse = z.infer<typeof loginResponseSchema>;

export const logoutResponseSchema = z.object({ ok: z.literal(true) });
export type LogoutResponse = z.infer<typeof logoutResponseSchema>;
