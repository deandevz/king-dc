import type { ParticipantInfo } from 'livekit-server-sdk';
import { afterAll, afterEach, beforeAll, beforeEach, expect, test, vi } from 'vitest';
import { PRESENCE_CACHE_MS, channelSchema, channelsResponseSchema } from '@kingdc/contracts';
import {
  createChannel,
  createUser,
  participantInfo,
  resetDb,
  sessionFor,
  withSession,
} from './helpers.js';
import { buildTestApp, fakeLiveKit } from './setup.js';
import type { TestApp } from './setup.js';

let testApp: TestApp;
let listCalls: string[] = [];
let listImpl: (room: string) => Promise<ParticipantInfo[]> = async () => [];

beforeAll(async () => {
  testApp = await buildTestApp({
    livekit: fakeLiveKit({
      listParticipants: async (room) => {
        listCalls.push(room);
        return listImpl(room);
      },
    }),
  });
});

afterAll(async () => {
  await testApp.close();
});

beforeEach(async () => {
  await resetDb(testApp.app);
  listCalls = [];
  listImpl = async () => [];
});

afterEach(() => {
  vi.useRealTimers();
});

/** Só o relógio anda: os timers de verdade continuam, senão o `inject` do Fastify trava. */
function advanceClock(ms: number): void {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(Date.now() + ms);
}

/** Espera o `refreshInBackground` terminar (o `.then` roda no próximo tick). */
async function settle(): Promise<void> {
  for (let i = 0; i < 5; i += 1) await new Promise((resolve) => setImmediate(resolve));
}

async function seedChannels(): Promise<void> {
  await createChannel(testApp.app, 'geral', 0);
  await createChannel(testApp.app, 'jogos', 1);
  await createChannel(testApp.app, 'afk', 2);
}

test('GET /channels sem cookie devolve 401', async () => {
  const response = await testApp.app.inject({ method: 'GET', url: '/channels' });

  expect(response.statusCode).toBe(401);
});

test('GET /channels devolve os canais na ordem de position', async () => {
  await seedChannels();
  const sid = await sessionFor(testApp.app, await createUser(testApp.app));

  const response = await testApp.app.inject({
    method: 'GET',
    url: '/channels',
    ...withSession(sid),
  });

  expect(response.statusCode).toBe(200);
  const body = channelsResponseSchema.parse(response.json());
  expect(body.channels.map((channel) => channel.slug)).toEqual(['geral', 'jogos', 'afk']);
  expect(body.onlineCount).toBe(0);
  expect(response.headers['x-presence-stale']).toBeUndefined();
});

test('presença traduz tracks e atributo em micMuted, deafened e screenSharing', async () => {
  await seedChannels();
  const sid = await sessionFor(testApp.app, await createUser(testApp.app));
  listImpl = async (room) =>
    room === 'geral'
      ? [
          participantInfo({
            identity: 'u1',
            metadata: JSON.stringify({ nickname: 'lele', avatarUrl: '/avatars/u1.webp?v=1' }),
            mic: 'live',
          }),
          participantInfo({ identity: 'u2', name: 'tonhão', mic: 'muted', deafened: true, screen: true }),
          participantInfo({ identity: 'u3', name: 'duda', mic: 'none' }),
        ]
      : [];

  const response = await testApp.app.inject({
    method: 'GET',
    url: '/channels',
    ...withSession(sid),
  });

  const body = channelsResponseSchema.parse(response.json());
  const geral = body.channels.find((channel) => channel.slug === 'geral');
  expect(geral?.participants).toEqual([
    {
      userId: 'u1',
      nickname: 'lele',
      avatarUrl: '/avatars/u1.webp?v=1',
      micMuted: false,
      deafened: false,
      screenSharing: false,
    },
    {
      userId: 'u2',
      nickname: 'tonhão',
      avatarUrl: null,
      micMuted: true,
      deafened: true,
      screenSharing: true,
    },
    {
      userId: 'u3',
      nickname: 'duda',
      avatarUrl: null,
      micMuted: true,
      deafened: false,
      screenSharing: false,
    },
  ]);
  expect(body.onlineCount).toBe(3);
});

test('onlineCount conta userIds distintos entre canais', async () => {
  await seedChannels();
  const sid = await sessionFor(testApp.app, await createUser(testApp.app));
  listImpl = async (room) =>
    room === 'afk' ? [] : [participantInfo({ identity: 'u1', name: 'lele', mic: 'live' })];

  const response = await testApp.app.inject({
    method: 'GET',
    url: '/channels',
    ...withSession(sid),
  });

  expect(channelsResponseSchema.parse(response.json()).onlineCount).toBe(1);
});

test('cache de 2 s evita uma segunda ida ao LiveKit', async () => {
  await seedChannels();
  const sid = await sessionFor(testApp.app, await createUser(testApp.app));

  await testApp.app.inject({ method: 'GET', url: '/channels', ...withSession(sid) });
  const afterFirst = listCalls.length;
  await testApp.app.inject({ method: 'GET', url: '/channels', ...withSession(sid) });

  expect(afterFirst).toBe(3);
  expect(listCalls.length).toBe(3);
});

test('cache vencido responde na hora com o valor antigo e atualiza em background', async () => {
  await seedChannels();
  const sid = await sessionFor(testApp.app, await createUser(testApp.app));
  listImpl = async () => [participantInfo({ identity: 'u1', name: 'lele', mic: 'live' })];
  await testApp.app.inject({ method: 'GET', url: '/channels', ...withSession(sid) });

  advanceClock(PRESENCE_CACHE_MS + 1);
  let release: () => void = () => undefined;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  listImpl = async () => {
    await gate;
    return [
      participantInfo({ identity: 'u1', name: 'lele', mic: 'live' }),
      participantInfo({ identity: 'u2', name: 'duda', mic: 'live' }),
    ];
  };

  const stale = await testApp.app.inject({ method: 'GET', url: '/channels', ...withSession(sid) });
  expect(channelsResponseSchema.parse(stale.json()).onlineCount).toBe(1);
  expect(stale.headers['x-presence-stale']).toBeUndefined();
  expect(listCalls.length).toBe(6);

  // Segundo polling com a atualização ainda no ar: não empilha outra ida ao LiveKit.
  await testApp.app.inject({ method: 'GET', url: '/channels', ...withSession(sid) });
  expect(listCalls.length).toBe(6);

  release();
  await settle();
  const fresh = await testApp.app.inject({ method: 'GET', url: '/channels', ...withSession(sid) });
  expect(channelsResponseSchema.parse(fresh.json()).onlineCount).toBe(2);
  expect(listCalls.length).toBe(6);
});

test('falha da atualização em background liga o X-Presence-Stale sem perder o valor antigo', async () => {
  await seedChannels();
  const sid = await sessionFor(testApp.app, await createUser(testApp.app));
  listImpl = async () => [participantInfo({ identity: 'u1', name: 'lele', mic: 'live' })];
  await testApp.app.inject({ method: 'GET', url: '/channels', ...withSession(sid) });

  advanceClock(PRESENCE_CACHE_MS + 1);
  listImpl = async () => {
    throw new Error('connect ECONNREFUSED');
  };
  await testApp.app.inject({ method: 'GET', url: '/channels', ...withSession(sid) });
  await settle();

  const response = await testApp.app.inject({ method: 'GET', url: '/channels', ...withSession(sid) });
  expect(response.headers['x-presence-stale']).toBe('1');
  expect(channelsResponseSchema.parse(response.json()).onlineCount).toBe(1);

  listImpl = async () => [participantInfo({ identity: 'u1', name: 'lele', mic: 'live' })];
  await testApp.app.inject({ method: 'GET', url: '/channels', ...withSession(sid) });
  await settle();
  const recovered = await testApp.app.inject({ method: 'GET', url: '/channels', ...withSession(sid) });
  expect(recovered.headers['x-presence-stale']).toBeUndefined();
});

test('webhook apaga a entrada do canal: o polling seguinte bloqueia e busca fresco', async () => {
  await seedChannels();
  const sid = await sessionFor(testApp.app, await createUser(testApp.app));
  listImpl = async () => [participantInfo({ identity: 'u1', name: 'lele', mic: 'live' })];
  await testApp.app.inject({ method: 'GET', url: '/channels', ...withSession(sid) });

  testApp.app.presence.forget('geral');
  listImpl = async (room) =>
    room === 'geral'
      ? [
          participantInfo({ identity: 'u1', name: 'lele', mic: 'live' }),
          participantInfo({ identity: 'u2', name: 'duda', mic: 'live' }),
        ]
      : [participantInfo({ identity: 'u1', name: 'lele', mic: 'live' })];

  const response = await testApp.app.inject({ method: 'GET', url: '/channels', ...withSession(sid) });

  const body = channelsResponseSchema.parse(response.json());
  expect(body.channels.find((channel) => channel.slug === 'geral')?.participants).toHaveLength(2);
  // Só o canal esquecido foi buscado de novo; os outros dois vieram do cache.
  expect(listCalls.length).toBe(4);
});

test('webhook no meio de uma atualização em background descarta o resultado velho', async () => {
  await seedChannels();
  const sid = await sessionFor(testApp.app, await createUser(testApp.app));
  listImpl = async () => [participantInfo({ identity: 'u1', name: 'lele', mic: 'live' })];
  await testApp.app.inject({ method: 'GET', url: '/channels', ...withSession(sid) });

  advanceClock(PRESENCE_CACHE_MS + 1);
  let release: () => void = () => undefined;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  listImpl = async () => {
    await gate;
    return [participantInfo({ identity: 'u1', name: 'lele', mic: 'live' })];
  };
  await testApp.app.inject({ method: 'GET', url: '/channels', ...withSession(sid) });

  testApp.app.presence.forget('geral');
  release();
  await settle();

  expect(testApp.app.presence.peek('geral')).toBeNull();
  expect(testApp.app.presence.peek('jogos')?.fresh).toBe(true);
});

test('LiveKit fora do ar devolve participants vazio e X-Presence-Stale: 1', async () => {
  await seedChannels();
  const sid = await sessionFor(testApp.app, await createUser(testApp.app));
  listImpl = async () => {
    throw new Error('connect ECONNREFUSED');
  };

  const response = await testApp.app.inject({
    method: 'GET',
    url: '/channels',
    ...withSession(sid),
  });

  expect(response.statusCode).toBe(200);
  expect(response.headers['x-presence-stale']).toBe('1');
  const body = channelsResponseSchema.parse(response.json());
  expect(body.channels.every((channel) => channel.participants.length === 0)).toBe(true);
  expect(body.onlineCount).toBe(0);
});

test('falha do LiveKit não vai para o cache: o polling seguinte tenta de novo', async () => {
  await seedChannels();
  const sid = await sessionFor(testApp.app, await createUser(testApp.app));
  listImpl = async () => {
    throw new Error('connect ECONNREFUSED');
  };

  await testApp.app.inject({ method: 'GET', url: '/channels', ...withSession(sid) });
  listImpl = async () => [participantInfo({ identity: 'u1', name: 'lele', mic: 'live' })];
  const response = await testApp.app.inject({
    method: 'GET',
    url: '/channels',
    ...withSession(sid),
  });

  expect(response.headers['x-presence-stale']).toBeUndefined();
  expect(channelsResponseSchema.parse(response.json()).onlineCount).toBe(1);
});

test('POST /channels cria com slug em kebab-case e position no fim da lista', async () => {
  await seedChannels();
  const sid = await sessionFor(testApp.app, await createUser(testApp.app, { isAdmin: true }));

  const response = await testApp.app.inject({
    method: 'POST',
    url: '/channels',
    ...withSession(sid),
    payload: { name: 'Música Boa!' },
  });

  expect(response.statusCode).toBe(200);
  expect(channelSchema.parse(response.json())).toMatchObject({
    slug: 'musica-boa',
    name: 'Música Boa!',
    position: 3,
  });
});

test('POST /channels com slug repetido devolve 409', async () => {
  await seedChannels();
  const sid = await sessionFor(testApp.app, await createUser(testApp.app, { isAdmin: true }));

  const response = await testApp.app.inject({
    method: 'POST',
    url: '/channels',
    ...withSession(sid),
    payload: { name: 'Geral' },
  });

  expect(response.statusCode).toBe(409);
  expect(response.json()).toMatchObject({ error: { code: 'VALIDATION' } });
});

test('POST /channels recusa nome vazio, longo demais, só com símbolos ou com caractere invisível', async () => {
  const sid = await sessionFor(testApp.app, await createUser(testApp.app, { isAdmin: true }));

  for (const name of ['', 'x'.repeat(33), '!!!', 'Sala\nNova', 'Sala\u200BNova']) {
    const response = await testApp.app.inject({
      method: 'POST',
      url: '/channels',
      ...withSession(sid),
      payload: { name },
    });
    expect(response.statusCode, name).toBe(400);
    expect(response.json()).toMatchObject({ error: { code: 'VALIDATION' } });
  }
});

test('POST /channels com usuário comum devolve 403 FORBIDDEN', async () => {
  const sid = await sessionFor(testApp.app, await createUser(testApp.app));

  const response = await testApp.app.inject({
    method: 'POST',
    url: '/channels',
    ...withSession(sid),
    payload: { name: 'Novo' },
  });

  expect(response.statusCode).toBe(403);
  expect(response.json()).toMatchObject({ error: { code: 'FORBIDDEN' } });
});

test('POST /channels sem cookie devolve 401', async () => {
  const response = await testApp.app.inject({
    method: 'POST',
    url: '/channels',
    payload: { name: 'Novo' },
  });

  expect(response.statusCode).toBe(401);
});
