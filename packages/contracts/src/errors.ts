import { z } from 'zod';

/** Códigos de erro que a API pode devolver. */
export const ERROR_CODES = [
  'INVALID_CREDENTIALS',
  'INVITE_EXPIRED',
  'VALIDATION',
  'UNAUTHENTICATED',
  'FORBIDDEN',
  'NOT_FOUND',
  'RATE_LIMITED',
  'AVATAR_INVALID',
  'AVATAR_TOO_LARGE',
  'LIVEKIT_UNAVAILABLE',
  // Erro não previsto do servidor precisa de um código próprio.
  'INTERNAL',
] as const;

export const errorCodeSchema = z.enum(ERROR_CODES);
export type ErrorCode = z.infer<typeof errorCodeSchema>;

/** Formato único de erro: `{ error: { code, message } }`. */
export const apiErrorSchema = z.object({
  error: z.object({
    code: errorCodeSchema,
    message: z.string(),
  }),
});
export type ApiError = z.infer<typeof apiErrorSchema>;
