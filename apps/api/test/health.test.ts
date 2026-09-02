import { afterAll, beforeAll, expect, test } from 'vitest';
import { healthResponseSchema } from '@kingdc/contracts';
import { buildApp } from '../src/app.js';
import { createPrismaClient } from '../src/lib/prisma.js';
import { buildTestApp, fakeLiveKit, testEnv } from './setup.js';
import type { TestApp } from './setup.js';

let testApp: TestApp;

beforeAll(async () => {
  testApp = await buildTestApp();
});

afterAll(async () => {
  await testApp.close();
});

test('GET /health responde 200 com o banco acessível', async () => {
  const response = await testApp.app.inject({ method: 'GET', url: '/health' });

  expect(response.statusCode).toBe(200);
  const body = healthResponseSchema.parse(response.json());
  expect(body).toEqual({ ok: true, db: true, livekit: true });
});

test('GET /health com o banco fora continua 200, com db:false', async () => {
  const env = testEnv({ DATABASE_URL: 'postgresql://kingdc:x@127.0.0.1:1/kingdc' });
  const app = await buildApp({
    env,
    prisma: createPrismaClient(env.DATABASE_URL),
    livekit: fakeLiveKit(),
  });
  try {
    const response = await app.inject({ method: 'GET', url: '/health' });

    expect(response.statusCode).toBe(200);
    expect(healthResponseSchema.parse(response.json())).toEqual({ ok: true, db: false, livekit: true });
  } finally {
    await app.close();
  }
});

test('rota inexistente devolve 404 no formato de erro padrão', async () => {
  const response = await testApp.app.inject({ method: 'GET', url: '/nao-existe' });

  expect(response.statusCode).toBe(404);
  expect(response.json()).toEqual({
    error: { code: 'NOT_FOUND', message: 'Rota não encontrada.' },
  });
});
