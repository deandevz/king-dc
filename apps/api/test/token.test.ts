import { TokenVerifier } from 'livekit-server-sdk';
import { afterAll, beforeAll, beforeEach, expect, test } from 'vitest';
import { LIVEKIT_TOKEN_TTL_SECONDS, channelTokenResponseSchema } from '@kingdc/contracts';
import { createLiveKitService } from '../src/lib/livekit.js';
import {
  createChannel,
  createUser,
  multipart,
  pngFixture,
  resetDb,
  sessionFor,
  withSession,
} from './helpers.js';
import { buildTestApp, fakeLiveKit, testEnv } from './setup.js';
import type { TestApp } from './setup.js';

const env = testEnv();
const verifier = new TokenVerifier(env.LIVEKIT_API_KEY, env.LIVEKIT_API_SECRET);

let testApp: TestApp;

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
  await createChannel(testApp.app, 'geral', 0);
});

test('token assinado carrega identity, metadata e os grants exatos', async () => {
  const user = await createUser(testApp.app, { nickname: 'lele' });
  const sid = await sessionFor(testApp.app, user);
  await testApp.app.inject({
    method: 'PUT',
    url: '/me/avatar',
    ...withSession(sid),
    ...multipart(await pngFixture()),
  });

  const response = await testApp.app.inject({
    method: 'POST',
    url: '/channels/geral/token',
    ...withSession(sid),
  });

  expect(response.statusCode).toBe(200);
  const body = channelTokenResponseSchema.parse(response.json());
  expect(body.url).toBe(env.LIVEKIT_URL);

  const claims = await verifier.verify(body.token);
  expect(claims.sub).toBe(user.id);
  expect(claims.name).toBe('lele');
  expect(JSON.parse(claims.metadata ?? '{}')).toEqual({
    nickname: 'lele',
    avatarUrl: expect.stringMatching(new RegExp(`^/avatars/${user.id}\\.webp\\?v=\\d+$`)),
  });
  expect(claims.video).toMatchObject({
    room: 'geral',
    roomJoin: true,
    canPublish: true,
    canSubscribe: true,
    canPublishSources: ['microphone', 'screen_share', 'screen_share_audio'],
  });
  expect(claims.video?.canPublishSources).not.toContain('camera');
});

test('o token vale 6 horas e o expiresAt bate com o claim exp', async () => {
  const sid = await sessionFor(testApp.app, await createUser(testApp.app, { nickname: 'duda' }));

  const response = await testApp.app.inject({
    method: 'POST',
    url: '/channels/geral/token',
    ...withSession(sid),
  });

  const body = channelTokenResponseSchema.parse(response.json());
  const claims = await verifier.verify(body.token);
  const secondsAhead = (new Date(body.expiresAt).getTime() - Date.now()) / 1000;
  expect(secondsAhead).toBeGreaterThan(LIVEKIT_TOKEN_TTL_SECONDS - 60);
  expect(secondsAhead).toBeLessThanOrEqual(LIVEKIT_TOKEN_TTL_SECONDS);
  const expSkewMs = Math.abs((claims.exp ?? 0) * 1000 - new Date(body.expiresAt).getTime());
  expect(expSkewMs).toBeLessThan(5000);
});

test('canal inexistente devolve 404 NOT_FOUND', async () => {
  const sid = await sessionFor(testApp.app, await createUser(testApp.app, { nickname: 'lele' }));

  const response = await testApp.app.inject({
    method: 'POST',
    url: '/channels/nao-existe/token',
    ...withSession(sid),
  });

  expect(response.statusCode).toBe(404);
  expect(response.json()).toMatchObject({ error: { code: 'NOT_FOUND' } });
});

test('usuário sem apelido não recebe token: 403 FORBIDDEN', async () => {
  const sid = await sessionFor(testApp.app, await createUser(testApp.app, { nickname: null }));

  const response = await testApp.app.inject({
    method: 'POST',
    url: '/channels/geral/token',
    ...withSession(sid),
  });

  expect(response.statusCode).toBe(403);
  expect(response.json()).toMatchObject({ error: { code: 'FORBIDDEN' } });
});

test('sem cookie devolve 401', async () => {
  const response = await testApp.app.inject({ method: 'POST', url: '/channels/geral/token' });

  expect(response.statusCode).toBe(401);
});

test('falha ao assinar devolve 503 LIVEKIT_UNAVAILABLE', async () => {
  const broken = await buildTestApp({
    livekit: fakeLiveKit({
      createToken: async () => {
        throw new Error('sem credencial do LiveKit');
      },
    }),
  });
  try {
    const sid = await sessionFor(broken.app, await createUser(broken.app, { nickname: 'lele' }));

    const response = await broken.app.inject({
      method: 'POST',
      url: '/channels/geral/token',
      ...withSession(sid),
    });

    expect(response.statusCode).toBe(503);
    expect(response.json()).toMatchObject({ error: { code: 'LIVEKIT_UNAVAILABLE' } });
  } finally {
    await broken.close();
  }
});
