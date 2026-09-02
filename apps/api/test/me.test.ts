import { randomBytes } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import sharp from 'sharp';
import { afterAll, beforeAll, beforeEach, expect, test } from 'vitest';
import { AVATAR_MAX_BYTES, meResponseSchema } from '@kingdc/contracts';
import { avatarPath } from '../src/lib/avatar.js';
import {
  createChannel,
  createUser,
  multipart,
  participantInfo,
  pngFixture,
  resetDb,
  sessionFor,
  withSession,
} from './helpers.js';
import { buildTestApp, fakeLiveKit, testEnv } from './setup.js';
import type { TestApp } from './setup.js';

let testApp: TestApp;
const avatarDir = testEnv().AVATAR_DIR;

type MetadataCall = { room: string; identity: string; metadata: string };
let metadataCalls: MetadataCall[] = [];
let updateImpl: () => Promise<void> = async () => undefined;

beforeAll(async () => {
  testApp = await buildTestApp({
    livekit: fakeLiveKit({
      updateParticipantMetadata: async (room, identity, metadata) => {
        metadataCalls.push({ room, identity, metadata });
        await updateImpl();
      },
    }),
  });
});

afterAll(async () => {
  await testApp.close();
});

beforeEach(async () => {
  await resetDb(testApp.app);
  metadataCalls = [];
  updateImpl = async () => undefined;
});

/** Põe o usuário no cache de presença de `slug`, como se ele estivesse na call. */
function putInRoom(slug: string, userId: string): void {
  testApp.app.presence.set(slug, [
    { userId, nickname: 'antigo', avatarUrl: null, micMuted: false, screenSharing: false },
  ]);
}

test('GET /me sem cookie devolve 401 UNAUTHENTICATED', async () => {
  const response = await testApp.app.inject({ method: 'GET', url: '/me' });

  expect(response.statusCode).toBe(401);
  expect(response.json()).toMatchObject({ error: { code: 'UNAUTHENTICATED' } });
});

test('GET /me devolve o usuário da sessão', async () => {
  const user = await createUser(testApp.app, { nickname: 'tonhão' });
  const sid = await sessionFor(testApp.app, user);

  const response = await testApp.app.inject({ method: 'GET', url: '/me', ...withSession(sid) });

  expect(response.statusCode).toBe(200);
  expect(meResponseSchema.parse(response.json())).toMatchObject({
    id: user.id,
    nickname: 'tonhão',
    avatarUrl: null,
  });
});

test('PATCH /me guarda o apelido com trim', async () => {
  const user = await createUser(testApp.app, { nickname: null });
  const sid = await sessionFor(testApp.app, user);

  const response = await testApp.app.inject({
    method: 'PATCH',
    url: '/me',
    ...withSession(sid),
    payload: { nickname: '  duda  ' },
  });

  expect(response.statusCode).toBe(200);
  expect(meResponseSchema.parse(response.json()).nickname).toBe('duda');
});

test('PATCH /me recusa apelido curto, longo, com quebra de linha ou caractere invisível', async () => {
  const user = await createUser(testApp.app);
  const sid = await sessionFor(testApp.app, user);

  const invalid = [
    'a',
    'x'.repeat(25),
    'nome\ncom quebra',
    'nome\tcom tab',
    'zero\u200Bwidth',
    '\u202Eodatrevni',
    'solto\uD83D',
    '\u2800\u2800\u2800',
  ];
  for (const nickname of invalid) {
    const response = await testApp.app.inject({
      method: 'PATCH',
      url: '/me',
      ...withSession(sid),
      payload: { nickname },
    });
    expect(response.statusCode, nickname).toBe(400);
    expect(response.json()).toMatchObject({ error: { code: 'VALIDATION' } });
  }
});

test('PUT /me/avatar grava 256×256 WebP e devolve avatarUrl com ?v=', async () => {
  const user = await createUser(testApp.app);
  const sid = await sessionFor(testApp.app, user);

  const response = await testApp.app.inject({
    method: 'PUT',
    url: '/me/avatar',
    ...withSession(sid),
    ...multipart(await pngFixture()),
  });

  expect(response.statusCode).toBe(200);
  const body = meResponseSchema.parse(response.json());
  expect(body.avatarUrl).toMatch(new RegExp(`^/avatars/${user.id}\\.webp\\?v=\\d+$`));

  const written = await readFile(avatarPath(avatarDir, user.id));
  const metadata = await sharp(written).metadata();
  expect(metadata.format).toBe('webp');
  expect([metadata.width, metadata.height]).toEqual([256, 256]);
});

test('GET /avatars serve o arquivo gravado, com cache imutável', async () => {
  const user = await createUser(testApp.app);
  const sid = await sessionFor(testApp.app, user);
  await testApp.app.inject({
    method: 'PUT',
    url: '/me/avatar',
    ...withSession(sid),
    ...multipart(await pngFixture()),
  });

  const response = await testApp.app.inject({ method: 'GET', url: `/avatars/${user.id}.webp` });

  expect(response.statusCode).toBe(200);
  expect(response.headers['content-type']).toContain('image/webp');
  expect(response.headers['cache-control']).toContain('immutable');
  expect((await sharp(response.rawPayload).metadata()).format).toBe('webp');
});

test('executável renomeado para .png é recusado com AVATAR_INVALID', async () => {
  const user = await createUser(testApp.app);
  const sid = await sessionFor(testApp.app, user);
  const fakeExe = Buffer.concat([Buffer.from('MZ\x90\x00'), randomBytes(4096)]);

  const response = await testApp.app.inject({
    method: 'PUT',
    url: '/me/avatar',
    ...withSession(sid),
    ...multipart(fakeExe, { filename: 'foto.png', contentType: 'image/png' }),
  });

  expect(response.statusCode).toBe(400);
  expect(response.json()).toMatchObject({ error: { code: 'AVATAR_INVALID' } });
});

test('SVG com script é recusado mesmo sendo decodificável', async () => {
  const user = await createUser(testApp.app);
  const sid = await sessionFor(testApp.app, user);
  const svg = Buffer.from(
    '<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64">' +
      '<script>alert(1)</script><rect width="64" height="64" fill="red"/></svg>',
  );

  const response = await testApp.app.inject({
    method: 'PUT',
    url: '/me/avatar',
    ...withSession(sid),
    ...multipart(svg, { filename: 'foto.svg', contentType: 'image/svg+xml' }),
  });

  expect(response.statusCode).toBe(400);
  expect(response.json()).toMatchObject({ error: { code: 'AVATAR_INVALID' } });
});

test('upload de 5 MB + 1 byte é cortado com AVATAR_TOO_LARGE', async () => {
  const user = await createUser(testApp.app);
  const sid = await sessionFor(testApp.app, user);

  const response = await testApp.app.inject({
    method: 'PUT',
    url: '/me/avatar',
    ...withSession(sid),
    ...multipart(randomBytes(AVATAR_MAX_BYTES + 1)),
  });

  expect(response.statusCode).toBe(413);
  expect(response.json()).toMatchObject({ error: { code: 'AVATAR_TOO_LARGE' } });
});

test('PUT /me/avatar sem parte de arquivo devolve 400 VALIDATION', async () => {
  const user = await createUser(testApp.app);
  const sid = await sessionFor(testApp.app, user);

  const response = await testApp.app.inject({
    method: 'PUT',
    url: '/me/avatar',
    ...withSession(sid),
    headers: { 'content-type': 'multipart/form-data; boundary=----vazio' },
    payload: Buffer.from('------vazio--\r\n'),
  });

  expect(response.statusCode).toBe(400);
  expect(response.json()).toMatchObject({ error: { code: 'VALIDATION' } });
});

test('PUT /me/avatar com JSON em vez de multipart devolve 400 VALIDATION em português', async () => {
  const user = await createUser(testApp.app);
  const sid = await sessionFor(testApp.app, user);

  const response = await testApp.app.inject({
    method: 'PUT',
    url: '/me/avatar',
    ...withSession(sid),
    payload: { file: 'nao-e-multipart' },
  });

  expect(response.statusCode).toBe(400);
  expect(response.json()).toEqual({
    error: {
      code: 'VALIDATION',
      message: 'Envie a imagem como multipart/form-data, no campo "file".',
    },
  });
});

test('GET /avatars/ (o diretório) devolve 404, não 403', async () => {
  const response = await testApp.app.inject({ method: 'GET', url: '/avatars/' });

  expect(response.statusCode).toBe(404);
  expect(response.json()).toMatchObject({ error: { code: 'NOT_FOUND' } });
});

test('DELETE /me/avatar apaga o arquivo e zera avatarUrl', async () => {
  const user = await createUser(testApp.app);
  const sid = await sessionFor(testApp.app, user);
  await testApp.app.inject({
    method: 'PUT',
    url: '/me/avatar',
    ...withSession(sid),
    ...multipart(await pngFixture()),
  });

  const response = await testApp.app.inject({
    method: 'DELETE',
    url: '/me/avatar',
    ...withSession(sid),
  });

  expect(response.statusCode).toBe(200);
  expect(meResponseSchema.parse(response.json()).avatarUrl).toBeNull();
  await expect(readFile(avatarPath(avatarDir, user.id))).rejects.toThrow();
});

test('PATCH /me reescreve o metadata na sala em que o usuário está', async () => {
  await createChannel(testApp.app, 'geral', 0);
  await createChannel(testApp.app, 'jogos', 1);
  const user = await createUser(testApp.app, { nickname: 'duda' });
  const sid = await sessionFor(testApp.app, user);
  putInRoom('geral', user.id);
  putInRoom('jogos', 'outra-pessoa');

  const response = await testApp.app.inject({
    method: 'PATCH',
    url: '/me',
    ...withSession(sid),
    payload: { nickname: 'dudinha' },
  });

  expect(response.statusCode).toBe(200);
  expect(metadataCalls).toEqual([
    {
      room: 'geral',
      identity: user.id,
      metadata: JSON.stringify({ nickname: 'dudinha', avatarUrl: null }),
    },
  ]);
  // O canal atualizado sai do cache: o próximo GET /channels traz o nick novo.
  expect(testApp.app.presence.peek('geral')).toBeNull();
  expect(testApp.app.presence.peek('jogos')).not.toBeNull();
});

test('sem cache do canal, a sala é descoberta pelo listParticipants', async () => {
  await createChannel(testApp.app, 'geral', 0);
  const user = await createUser(testApp.app, { nickname: 'duda' });
  const sid = await sessionFor(testApp.app, user);
  const app = await buildTestApp({
    livekit: fakeLiveKit({
      listParticipants: async () => [participantInfo({ identity: user.id, name: 'duda' })],
      updateParticipantMetadata: async (room, identity, metadata) => {
        metadataCalls.push({ room, identity, metadata });
      },
    }),
  });

  try {
    const response = await app.app.inject({
      method: 'PATCH',
      url: '/me',
      ...withSession(sid),
      payload: { nickname: 'dudinha' },
    });

    expect(response.statusCode).toBe(200);
    expect(metadataCalls.map((call) => call.room)).toEqual(['geral']);
  } finally {
    await app.close();
  }
});

test('PUT /me/avatar propaga a foto nova e DELETE propaga a volta ao gradiente', async () => {
  await createChannel(testApp.app, 'geral', 0);
  const user = await createUser(testApp.app, { nickname: 'duda' });
  const sid = await sessionFor(testApp.app, user);

  putInRoom('geral', user.id);
  await testApp.app.inject({
    method: 'PUT',
    url: '/me/avatar',
    ...withSession(sid),
    ...multipart(await pngFixture()),
  });

  putInRoom('geral', user.id);
  await testApp.app.inject({ method: 'DELETE', url: '/me/avatar', ...withSession(sid) });

  expect(metadataCalls).toHaveLength(2);
  const [uploaded, removed] = metadataCalls;
  expect(JSON.parse(uploaded?.metadata ?? '{}')).toMatchObject({ nickname: 'duda' });
  expect(String(JSON.parse(uploaded?.metadata ?? '{}').avatarUrl)).toContain(`/avatars/${user.id}.webp`);
  expect(JSON.parse(removed?.metadata ?? '{}')).toEqual({ nickname: 'duda', avatarUrl: null });
});

test('LiveKit fora do ar não derruba o PATCH /me', async () => {
  await createChannel(testApp.app, 'geral', 0);
  const user = await createUser(testApp.app, { nickname: 'duda' });
  const sid = await sessionFor(testApp.app, user);
  putInRoom('geral', user.id);
  updateImpl = async () => {
    throw new Error('connect ECONNREFUSED');
  };

  const response = await testApp.app.inject({
    method: 'PATCH',
    url: '/me',
    ...withSession(sid),
    payload: { nickname: 'dudinha' },
  });

  expect(response.statusCode).toBe(200);
  expect(meResponseSchema.parse(response.json()).nickname).toBe('dudinha');
  // A falha não apaga o cache: sem confirmação do LiveKit, o valor antigo continua valendo.
  expect(testApp.app.presence.peek('geral')).not.toBeNull();
});
