import { afterAll, beforeAll, beforeEach, expect, test } from 'vitest';
import {
  CODE_LENGTH,
  INVITE_ALPHABET,
  INVITE_TTL_DAYS,
  createInviteResponseSchema,
  invitesResponseSchema,
  loginResponseSchema,
} from '@kingdc/contracts';
import { createInvite, createUser, login, resetDb, sessionFor, withSession } from './helpers.js';
import { buildTestApp } from './setup.js';
import type { TestApp } from './setup.js';

let testApp: TestApp;

beforeAll(async () => {
  testApp = await buildTestApp();
});

afterAll(async () => {
  await testApp.close();
});

beforeEach(async () => {
  await resetDb(testApp.app);
});

test('POST /invites gera código de 6 caracteres do alfabeto e validade de 7 dias', async () => {
  const admin = await createUser(testApp.app, { isAdmin: true });
  const sid = await sessionFor(testApp.app, admin);

  const response = await testApp.app.inject({
    method: 'POST',
    url: '/invites',
    ...withSession(sid),
  });

  expect(response.statusCode).toBe(200);
  const body = createInviteResponseSchema.parse(response.json());
  expect(body.code).toHaveLength(CODE_LENGTH);
  expect([...body.code].every((char) => INVITE_ALPHABET.includes(char))).toBe(true);

  const days = (new Date(body.expiresAt).getTime() - Date.now()) / (24 * 60 * 60 * 1000);
  expect(days).toBeGreaterThan(INVITE_TTL_DAYS - 0.01);
  expect(days).toBeLessThanOrEqual(INVITE_TTL_DAYS);

  const invite = await testApp.app.prisma.invite.findUniqueOrThrow({ where: { code: body.code } });
  expect(invite.createdById).toBe(admin.id);
  expect(invite.usedAt).toBeNull();
});

test('o código gerado serve de login e cria a conta na primeira senha', async () => {
  const sid = await sessionFor(testApp.app, await createUser(testApp.app, { isAdmin: true }));
  const created = createInviteResponseSchema.parse(
    (await testApp.app.inject({ method: 'POST', url: '/invites', ...withSession(sid) })).json(),
  );

  const response = await login(testApp.app, created.code, 'senha-nova-1234');

  expect(response.statusCode).toBe(200);
  expect(loginResponseSchema.parse(response.json()).user.code).toBe(created.code);
});

test('GET /invites lista do mais novo para o mais velho', async () => {
  const admin = await createUser(testApp.app, { isAdmin: true });
  const sid = await sessionFor(testApp.app, admin);
  const older = await createInvite(testApp.app, admin.id);
  await testApp.app.prisma.invite.update({
    where: { code: older },
    data: { createdAt: new Date(Date.now() - 60_000), usedAt: new Date() },
  });
  const newer = await createInvite(testApp.app, admin.id);

  const response = await testApp.app.inject({
    method: 'GET',
    url: '/invites',
    ...withSession(sid),
  });

  expect(response.statusCode).toBe(200);
  const body = invitesResponseSchema.parse(response.json());
  expect(body.invites.map((invite) => invite.code)).toEqual([newer, older]);
  expect(body.invites[0]?.usedAt).toBeNull();
  expect(body.invites[1]?.usedAt).not.toBeNull();
});

test('usuário comum recebe 403 nas duas rotas de convite', async () => {
  const admin = await createUser(testApp.app, { isAdmin: true });
  await createInvite(testApp.app, admin.id);
  const sid = await sessionFor(testApp.app, await createUser(testApp.app));

  for (const method of ['POST', 'GET'] as const) {
    const response = await testApp.app.inject({ method, url: '/invites', ...withSession(sid) });
    expect(response.statusCode, method).toBe(403);
    expect(response.json()).toMatchObject({ error: { code: 'FORBIDDEN' } });
  }
});

test('sem cookie as rotas de convite devolvem 401', async () => {
  for (const method of ['POST', 'GET'] as const) {
    const response = await testApp.app.inject({ method, url: '/invites' });
    expect(response.statusCode, method).toBe(401);
    expect(response.json()).toMatchObject({ error: { code: 'UNAUTHENTICATED' } });
  }
});
