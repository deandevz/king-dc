import { z } from 'zod';

/** `GET /health`: sempre 200 enquanto o processo vive. */
export const healthResponseSchema = z.object({
  ok: z.literal(true),
  db: z.boolean(),
  livekit: z.boolean(),
});
export type HealthResponse = z.infer<typeof healthResponseSchema>;
