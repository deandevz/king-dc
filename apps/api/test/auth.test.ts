import { afterAll, beforeAll, beforeEach, expect, test } from 'vitest';
import { SESSION_COOKIE, loginResponseSchema } from '@kingdc/contracts';
import {
  cookieFrom,
  createInvite,
  createUser,
  freshIp,
  login,
  resetDb,
  withSession,
} from './helpers.js';
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

test('login de usuário existente devolve Me e grava o cookie de sessão', async () => {
  const user = await createUser(testApp.app, { nickname: 'lele', isAdmin: true });

  const response = await login(testApp.app, user.code, user.password);

  expect(response.statusCode).toBe(200);
  const body = loginResponseSchema.parse(response.json());
  expect(body.user).toMatchObject({
    id: user.id,
    code: user.code,
    nickname: 'lele',
    isAdmin: true,
  });
  expect(body.user.avatarUrl).toBeNull();

  const cookie = response.cookies.find((entry) => entry.name === SESSION_COOKIE);
  expect(cookie?.httpOnly).toBe(true);
  expect(cookie?.sameSite?.toLowerCase()).toBe('lax');
  const sessions = await testApp.app.prisma.session.count({ where: { userId: user.id } });
  expect(sessions).toBe(1);
});

test('código minúsculo é normalizado para maiúsculo antes da busca', async () => {
  const user = await createUser(testApp.app, { code: 'ABC234' });

  const response = await login(testApp.app, 'abc234', user.password);

  expect(response.statusCode).toBe(200);
});

test('senha errada e código inexistente devolvem exatamente a mesma resposta', async () => {
  const user = await createUser(testApp.app, { code: 'KKK234' });

  const wrongPassword = await login(testApp.app, user.code, 'outra-senha-qualquer');
  const unknownCode = await login(testApp.app, 'ZZZ999', 'outra-senha-qualquer');

  expect(wrongPassword.statusCode).toBe(401);
  expect(unknownCode.statusCode).toBe(401);
  expect(wrongPassword.json()).toEqual({
    error: { code: 'INVALID_CREDENTIALS', message: 'Código ou senha inválidos.' },
  });
  expect(unknownCode.json()).toEqual(wrongPassword.json());
});

test('convite válido e não usado cria o usuário e marca o convite como usado', async () => {
  const admin = await createUser(testApp.app, { isAdmin: true });
  const code = await createInvite(testApp.app, admin.id);

  const response = await login(testApp.app, code, 'senha-nova-1234');

  expect(response.statusCode).toBe(200);
  const body = loginResponseSchema.parse(response.json());
  expect(body.user.code).toBe(code);
  expect(body.user.nickname).toBeNull();
  expect(body.user.isAdmin).toBe(false);

  const invite = await testApp.app.prisma.invite.findUniqueOrThrow({ where: { code } });
  expect(invite.usedAt).not.toBeNull();
});

test('convite expirado devolve INVITE_EXPIRED e não cria usuário', async () => {
  const admin = await createUser(testApp.app, { isAdmin: true });
  const code = await createInvite(testApp.app, admin.id, {
    expiresAt: new Date(Date.now() - 1000),
  });

  const response = await login(testApp.app, code, 'senha-nova-1234');

  expect(response.statusCode).toBe(401);
  expect(response.json()).toMatchObject({ error: { code: 'INVITE_EXPIRED' } });
  expect(await testApp.app.prisma.user.count({ where: { code } })).toBe(0);
});

test('convite já usado responde como código inválido, sem vazar que existe', async () => {
  const admin = await createUser(testApp.app, { isAdmin: true });
  const code = await createInvite(testApp.app, admin.id, { usedAt: new Date() });

  const response = await login(testApp.app, code, 'senha-nova-1234');

  expect(response.statusCode).toBe(401);
  expect(response.json()).toMatchObject({ error: { code: 'INVALID_CREDENTIALS' } });
});

test('dois logins simultâneos com o mesmo convite criam exatamente um usuário', async () => {
  const admin = await createUser(testApp.app, { isAdmin: true });
  const code = await createInvite(testApp.app, admin.id);

  const [first, second] = await Promise.all([
    login(testApp.app, code, 'senha-nova-1234'),
    login(testApp.app, code, 'senha-nova-5678'),
  ]);

  const statuses = [first.statusCode, second.statusCode].sort((a, b) => a - b);
  expect(statuses).toEqual([200, 401]);
  expect(await testApp.app.prisma.user.count({ where: { code } })).toBe(1);
});

test('corpo fora do formato esperado devolve 400 VALIDATION', async () => {
  const response = await testApp.app.inject({
    method: 'POST',
    url: '/auth/login',
    headers: { 'x-forwarded-for': freshIp() },
    payload: { code: 'ABC', password: 'curta' },
  });

  expect(response.statusCode).toBe(400);
  expect(response.json()).toMatchObject({ error: { code: 'VALIDATION' } });
});

test('rate limit corta a 11ª tentativa do mesmo IP dentro de um minuto', async () => {
  const ip = freshIp();
  const attempts = [];
  for (let i = 0; i < 10; i += 1) {
    attempts.push(await login(testApp.app, 'ZZZ999', 'senha-errada-123', ip));
  }
  expect(attempts.every((response) => response.statusCode === 401)).toBe(true);

  const blocked = await login(testApp.app, 'ZZZ999', 'senha-errada-123', ip);

  expect(blocked.statusCode).toBe(429);
  expect(blocked.json()).toMatchObject({ error: { code: 'RATE_LIMITED' } });
});

test('rate limit ignora X-Forwarded-For forjado quando o cliente não é proxy de rede privada', async () => {
  // Socket de IP público: o header não é confiável, então o limite vale para o socket.
  const remoteAddress = '203.0.113.9';
  const attempt = () =>
    testApp.app.inject({
      method: 'POST',
      url: '/auth/login',
      remoteAddress,
      headers: { 'x-forwarded-for': freshIp() },
      payload: { code: 'ZZZ999', password: 'senha-errada-123' },
    });
  for (let i = 0; i < 10; i += 1) {
    expect((await attempt()).statusCode).toBe(401);
  }

  const blocked = await attempt();

  expect(blocked.statusCode).toBe(429);
  expect(blocked.json()).toMatchObject({ error: { code: 'RATE_LIMITED' } });
});

test('login varre as sessões vencidas de qualquer usuário', async () => {
  const user = await createUser(testApp.app);
  const other = await createUser(testApp.app);
  await testApp.app.prisma.session.createMany({
    data: [
      { id: 'vencida-1', userId: other.id, expiresAt: new Date(Date.now() - 1000) },
      { id: 'viva-1', userId: other.id, expiresAt: new Date(Date.now() + 60_000) },
    ],
  });

  const response = await login(testApp.app, user.code, user.password);

  expect(response.statusCode).toBe(200);
  const remaining = await testApp.app.prisma.session.findMany({ where: { userId: other.id } });
  expect(remaining.map((session) => session.id)).toEqual(['viva-1']);
});

test('logout apaga a sessão do banco e limpa o cookie', async () => {
  const user = await createUser(testApp.app);
  const sid = cookieFrom(await login(testApp.app, user.code, user.password));

  const response = await testApp.app.inject({
    method: 'POST',
    url: '/auth/logout',
    ...withSession(sid),
  });

  expect(response.statusCode).toBe(200);
  expect(response.json()).toEqual({ ok: true });
  expect(await testApp.app.prisma.session.count({ where: { userId: user.id } })).toBe(0);

  const afterLogout = await testApp.app.inject({ method: 'GET', url: '/me', ...withSession(sid) });
  expect(afterLogout.statusCode).toBe(401);
});

test('logout é idempotente: sem cookie ou com sessão já apagada devolve 200', async () => {
  const semCookie = await testApp.app.inject({ method: 'POST', url: '/auth/logout' });
  expect(semCookie.statusCode).toBe(200);
  expect(semCookie.json()).toEqual({ ok: true });

  const user = await createUser(testApp.app);
  const sid = cookieFrom(await login(testApp.app, user.code, user.password));
  await testApp.app.inject({ method: 'POST', url: '/auth/logout', ...withSession(sid) });
  const repetido = await testApp.app.inject({ method: 'POST', url: '/auth/logout', ...withSession(sid) });

  expect(repetido.statusCode).toBe(200);
  expect(repetido.json()).toEqual({ ok: true });
  expect(repetido.cookies.find((entry) => entry.name === SESSION_COOKIE)?.value).toBe('');
});
