import { createHash } from 'node:crypto';
import { AccessToken } from 'livekit-server-sdk';
import { afterAll, beforeAll, beforeEach, expect, test } from 'vitest';
import { createLiveKitService } from '../src/lib/livekit.js';
import { createChannel, createUser, resetDb, sessionFor, withSession } from './helpers.js';
import { buildTestApp, testEnv } from './setup.js';
import type { TestApp } from './setup.js';

const env = testEnv();
const WEBHOOK_HEADERS = { 'content-type': 'application/webhook+json' };

let testApp: TestApp;

/** Assina o corpo como o LiveKit faz: JWT com o claim `sha256` do corpo em base64. */
async function signBody(body: string, secret = env.LIVEKIT_API_SECRET): Promise<string> {
  const token = new AccessToken(env.LIVEKIT_API_KEY, secret);
  token.sha256 = createHash('sha256').update(body).digest('base64');
  return token.toJwt();
}

function eventBody(event: string, room: string): string {
  return JSON.stringify({ event, room: { name: room }, id: 'ev_1', createdAt: '1' });
}

beforeAll(async () => {
  testApp = await buildTestApp({
    livekit: createLiveKitService({
      url: env.LIVEKIT_URL,
      hostHttp: env.LIVEKIT_HOST_HTTP,
      apiKey: env.LIVEKIT_API_KEY,
      apiSecret: env.LIVEKIT_API_SECRET,
    }),
  });
});

afterAll(async () => {
  await testApp.close();
});

beforeEach(async () => {
  await resetDb(testApp.app);
});

test('webhook assinado corretamente responde 200 e apaga o cache do canal', async () => {
  await createChannel(testApp.app, 'geral', 0);
  testApp.app.presence.set('geral', [
    { userId: 'u1', nickname: 'lele', avatarUrl: null, micMuted: false, screenSharing: false },
  ]);
  testApp.app.presence.set('jogos', []);
  const body = eventBody('participant_joined', 'geral');

  const response = await testApp.app.inject({
    method: 'POST',
    url: '/webhooks/livekit',
    headers: { ...WEBHOOK_HEADERS, authorization: await signBody(body) },
    payload: body,
  });

  expect(response.statusCode).toBe(200);
  expect(response.json()).toEqual({ ok: true });
  expect(testApp.app.presence.peek('geral')).toBeNull();
  // Só o canal do evento: os outros continuam servindo do cache.
  expect(testApp.app.presence.peek('jogos')?.participants).toEqual([]);
});

test('evento que não mexe em presença não derruba o cache', async () => {
  testApp.app.presence.set('geral', []);
  const body = eventBody('egress_started', 'geral');

  const response = await testApp.app.inject({
    method: 'POST',
    url: '/webhooks/livekit',
    headers: { ...WEBHOOK_HEADERS, authorization: await signBody(body) },
    payload: body,
  });

  expect(response.statusCode).toBe(200);
  expect(testApp.app.presence.peek('geral')?.participants).toEqual([]);
});

test('webhook sem header Authorization devolve 401', async () => {
  const body = eventBody('room_started', 'geral');

  const response = await testApp.app.inject({
    method: 'POST',
    url: '/webhooks/livekit',
    headers: WEBHOOK_HEADERS,
    payload: body,
  });

  expect(response.statusCode).toBe(401);
  expect(response.json()).toMatchObject({ error: { code: 'UNAUTHENTICATED' } });
});

test('webhook assinado com outro segredo devolve 401', async () => {
  const body = eventBody('room_started', 'geral');

  const response = await testApp.app.inject({
    method: 'POST',
    url: '/webhooks/livekit',
    headers: {
      ...WEBHOOK_HEADERS,
      authorization: await signBody(body, 'segredo-de-outro-servidor'),
    },
    payload: body,
  });

  expect(response.statusCode).toBe(401);
});

test('corpo alterado depois da assinatura devolve 401 e não mexe no cache', async () => {
  testApp.app.presence.set('geral', []);
  const authorization = await signBody(eventBody('participant_left', 'geral'));

  const response = await testApp.app.inject({
    method: 'POST',
    url: '/webhooks/livekit',
    headers: { ...WEBHOOK_HEADERS, authorization },
    payload: eventBody('participant_left', 'outro-canal'),
  });

  expect(response.statusCode).toBe(401);
  expect(testApp.app.presence.peek('geral')).toEqual({ participants: [], fresh: true, failed: false });
});

test('o parser cru vale só para o webhook: JSON comum segue como JSON', async () => {
  const user = await createUser(testApp.app, { nickname: null });
  const sid = await sessionFor(testApp.app, user);

  const response = await testApp.app.inject({
    method: 'PATCH',
    url: '/me',
    ...withSession(sid),
    payload: { nickname: 'vitão' },
  });

  expect(response.statusCode).toBe(200);
  expect(response.json()).toMatchObject({ nickname: 'vitão' });
});
