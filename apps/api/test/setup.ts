import { inject } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildApp } from '../src/app.js';
import type { Env } from '../src/env.js';
import { createPrismaClient } from '../src/lib/prisma.js';
import type { LiveKitService } from '../src/lib/livekit.js';

export function testEnv(overrides: Partial<Env> = {}): Env {
  return {
    NODE_ENV: 'test',
    HOST: '127.0.0.1',
    PORT: 3000,
    DATABASE_URL: inject('databaseUrl'),
    SESSION_SECRET: 'segredo-de-teste-com-mais-de-32-caracteres',
    LIVEKIT_URL: 'wss://livekit.test',
    LIVEKIT_API_KEY: 'test-key',
    LIVEKIT_API_SECRET: 'test-secret-com-tamanho-suficiente',
    LIVEKIT_HOST_HTTP: 'http://livekit.test',
    AVATAR_DIR: new URL('./tmp-avatars/', import.meta.url).pathname,
    ...overrides,
  };
}

/** LiveKit falso: sala sempre vazia, token e webhook determinísticos. */
export function fakeLiveKit(overrides: Partial<LiveKitService> = {}): LiveKitService {
  return {
    url: 'wss://livekit.test',
    listParticipants: async () => [],
    updateParticipantMetadata: async () => undefined,
    createToken: async () => 'token-de-teste',
    verifyWebhook: async () => {
      throw new Error('webhook não configurado neste teste');
    },
    ...overrides,
  };
}

export type TestApp = {
  app: FastifyInstance;
  close: () => Promise<void>;
};

/** Constrói a app apontando para o Postgres efêmero da rodada. */
export async function buildTestApp(options: { livekit?: LiveKitService } = {}): Promise<TestApp> {
  const env = testEnv();
  const prisma = createPrismaClient(env.DATABASE_URL);
  const app = await buildApp({
    env,
    prisma,
    livekit: options.livekit ?? fakeLiveKit(),
  });
  await app.ready();
  return { app, close: () => app.close() };
}
