import { z } from 'zod';
import { NICK_MAX, NICK_MIN } from './constants.js';
import { visibleTextSchema } from './text.js';

/** Usuário autenticado. `nickname: null` manda o front para /onboarding. */
export const meSchema = z.object({
  id: z.string(),
  code: z.string(),
  nickname: z.string().nullable(),
  avatarUrl: z.string().nullable(),
  isAdmin: z.boolean(),
});
export type Me = z.infer<typeof meSchema>;

/** Apelido: 2..24 caracteres visíveis, sem controle nem formatação (decisão D14). */
export const nicknameSchema = visibleTextSchema(NICK_MIN, NICK_MAX);

export const updateMeRequestSchema = z.object({ nickname: nicknameSchema });
export type UpdateMeRequest = z.infer<typeof updateMeRequestSchema>;

export const meResponseSchema = meSchema;
export type MeResponse = Me;
