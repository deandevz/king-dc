import { z } from 'zod';
import { loadLocalEnv } from './lib/load-env.js';

loadLocalEnv();

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  HOST: z.string().default('0.0.0.0'),
  PORT: z.coerce.number().int().positive().default(3000),
  DATABASE_URL: z.string().min(1),
  SESSION_SECRET: z.string().min(32),
  LIVEKIT_URL: z.string().min(1),
  LIVEKIT_API_KEY: z.string().min(1),
  LIVEKIT_API_SECRET: z.string().min(1),
  LIVEKIT_HOST_HTTP: z.string().min(1),
  AVATAR_DIR: z.string().default('/data/avatars'),
});

export type Env = z.infer<typeof envSchema>;

/** Lê e valida o ambiente. Falha cedo e alto se faltar variável obrigatória. */
export function readEnv(source: NodeJS.ProcessEnv = process.env): Env {
  const parsed = envSchema.safeParse(source);
  if (!parsed.success) {
    const missing = parsed.error.issues.map((issue) => issue.path.join('.')).join(', ');
    throw new Error(`Variáveis de ambiente inválidas ou ausentes: ${missing}`);
  }
  return parsed.data;
}
