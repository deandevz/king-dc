import { randomBytes } from 'node:crypto';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { SESSION_COOKIE, SESSION_TTL_DAYS } from '@kingdc/contracts';
import { sendError } from '../lib/errors.js';

const DAY_MS = 24 * 60 * 60 * 1000;
const SESSION_TTL_MS = SESSION_TTL_DAYS * DAY_MS;
/** Só renova o cookie quando já passou um dia, para não escrever no banco a cada request. */
const SLIDE_THRESHOLD_MS = DAY_MS;

export type SessionUser = {
  id: string;
  code: string;
  nickname: string | null;
  avatarUpdatedAt: Date | null;
  isAdmin: boolean;
};

export type SessionRecord = { id: string; expiresAt: Date };

/**
 * Estreita `request.user` dentro de uma rota que já passou por `requireAuth`. Lança se a
 * rota esqueceu o preHandler — é bug de programação, não erro do cliente.
 */
export function requireUser(request: FastifyRequest): SessionUser {
  if (request.user === null) {
    throw new Error('rota autenticada registrada sem requireAuth');
  }
  return request.user;
}

export type SessionStore = {
  /** Cria a sessão no Postgres e devolve o token que vai no cookie. */
  create(userId: string): Promise<SessionRecord>;
  destroy(sessionId: string): Promise<void>;
  /** Apaga sessões vencidas. Roda a cada login: 20 pessoas não justificam um agendador. */
  purgeExpired(): Promise<number>;
};

function newSessionId(): string {
  return randomBytes(32).toString('base64url');
}

export function setSessionCookie(
  reply: FastifyReply,
  session: SessionRecord,
  secure: boolean,
): void {
  reply.setCookie(SESSION_COOKIE, session.id, {
    path: '/',
    httpOnly: true,
    sameSite: 'lax',
    secure,
    signed: true,
    expires: session.expiresAt,
  });
}

export function clearSessionCookie(reply: FastifyReply, secure: boolean): void {
  reply.clearCookie(SESSION_COOKIE, { path: '/', httpOnly: true, sameSite: 'lax', secure });
}

/** Id da sessão do cookie assinado, ou `null` se não há cookie ou a assinatura não bate. */
export function readSessionId(request: FastifyRequest): string | null {
  const raw = request.cookies[SESSION_COOKIE];
  if (raw === undefined) return null;
  const unsigned = request.unsignCookie(raw);
  return unsigned.valid && unsigned.value !== null ? unsigned.value : null;
}

/**
 * Sessão própria: cookie assinado + linha na tabela `Session`. Evita a dependência do
 * `@fastify/session`, que traria um store em memória que não sobrevive a restart.
 */
export function registerSession(app: FastifyInstance): void {
  const secureCookie = app.env.NODE_ENV === 'production';

  const store: SessionStore = {
    async create(userId) {
      const id = newSessionId();
      const expiresAt = new Date(Date.now() + SESSION_TTL_MS);
      await app.prisma.session.create({ data: { id, userId, expiresAt } });
      return { id, expiresAt };
    },
    async destroy(sessionId) {
      await app.prisma.session.deleteMany({ where: { id: sessionId } });
    },
    async purgeExpired() {
      const result = await app.prisma.session.deleteMany({
        where: { expiresAt: { lt: new Date() } },
      });
      return result.count;
    },
  };

  app.decorate('sessions', store);
  app.decorateRequest('user', null);
  app.decorateRequest('sessionId', null);

  /** Autentica e devolve `true` quando a requisição pode seguir. */
  async function authenticate(request: FastifyRequest, reply: FastifyReply): Promise<boolean> {
    const sessionId = readSessionId(request);
    if (sessionId === null) {
      await sendError(reply, 401, 'UNAUTHENTICATED', 'Sessão ausente ou inválida.');
      return false;
    }

    const session = await app.prisma.session.findUnique({
      where: { id: sessionId },
      include: { user: true },
    });

    if (session === null || session.expiresAt.getTime() <= Date.now()) {
      if (session !== null) await store.destroy(sessionId);
      clearSessionCookie(reply, secureCookie);
      await sendError(reply, 401, 'UNAUTHENTICATED', 'Sessão ausente ou inválida.');
      return false;
    }

    request.sessionId = session.id;
    request.user = {
      id: session.user.id,
      code: session.user.code,
      nickname: session.user.nickname,
      avatarUpdatedAt: session.user.avatarUpdatedAt,
      isAdmin: session.user.isAdmin,
    };

    const remaining = session.expiresAt.getTime() - Date.now();
    if (SESSION_TTL_MS - remaining >= SLIDE_THRESHOLD_MS) {
      const expiresAt = new Date(Date.now() + SESSION_TTL_MS);
      await app.prisma.session.update({ where: { id: session.id }, data: { expiresAt } });
      setSessionCookie(reply, { id: session.id, expiresAt }, secureCookie);
    }
    return true;
  }

  app.decorate('requireAuth', async (request: FastifyRequest, reply: FastifyReply) => {
    await authenticate(request, reply);
  });

  app.decorate('requireAdmin', async (request: FastifyRequest, reply: FastifyReply) => {
    if (!(await authenticate(request, reply))) return;
    if (request.user === null || !request.user.isAdmin) {
      await sendError(reply, 403, 'FORBIDDEN', 'Apenas o admin pode fazer isso.');
    }
  });
}
