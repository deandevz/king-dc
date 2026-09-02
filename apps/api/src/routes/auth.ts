import type { FastifyInstance, FastifyReply } from 'fastify';
import { loginRequestSchema } from '@kingdc/contracts';
import type { LoginResponse, LogoutResponse } from '@kingdc/contracts';
import { sendError } from '../lib/errors.js';
import { consumeInvite } from '../lib/invites.js';
import { USER_FOR_ME_SELECT, toMe } from '../lib/me.js';
import type { UserForMe } from '../lib/me.js';
import { hashPassword, verifyDummyPassword, verifyPassword } from '../lib/password.js';
import { clearSessionCookie, readSessionId, setSessionCookie } from '../plugins/session.js';

/** 10 tentativas por minuto por IP. */
const LOGIN_RATE_LIMIT = { max: 10, timeWindow: '1 minute' };

/**
 * Mensagem única para "código não existe", "senha errada" e "convite já usado". Junto com
 * o hash de mentira de `verifyDummyPassword`, nem o corpo nem o tempo dizem se o código
 * existe.
 */
const INVALID_CREDENTIALS = 'Código ou senha inválidos.';

/** `POST /auth/login` e `POST /auth/logout` (decisão D1). */
export function registerAuthRoutes(app: FastifyInstance): void {
  const secureCookie = app.env.NODE_ENV === 'production';

  async function startSession(reply: FastifyReply, user: UserForMe): Promise<LoginResponse> {
    // Sessão vencida só some quando alguém tenta usá-la; quem nunca volta deixaria a linha
    // para sempre. O login é o momento barato de varrer.
    await app.sessions.purgeExpired();
    const session = await app.sessions.create(user.id);
    setSessionCookie(reply, session, secureCookie);
    return { user: toMe(user) };
  }

  /** Código sem usuário: só entra se for um convite válido e ainda não usado (D1). */
  async function loginWithInvite(
    reply: FastifyReply,
    code: string,
    password: string,
  ): Promise<LoginResponse | FastifyReply> {
    const invite = await app.prisma.invite.findUnique({ where: { code } });

    if (invite === null || invite.usedAt !== null) {
      await verifyDummyPassword(password);
      return sendError(reply, 401, 'INVALID_CREDENTIALS', INVALID_CREDENTIALS);
    }

    if (invite.expiresAt.getTime() <= Date.now()) {
      return sendError(reply, 401, 'INVITE_EXPIRED', 'Este convite expirou. Peça outro ao admin.');
    }

    const passwordHash = await hashPassword(password);
    const created = await consumeInvite(app.prisma, code, passwordHash);
    if (created === null) {
      // Outro login levou o mesmo convite entre a leitura e o UPDATE.
      return sendError(reply, 401, 'INVALID_CREDENTIALS', INVALID_CREDENTIALS);
    }
    return startSession(reply, created);
  }

  app.post(
    '/auth/login',
    { config: { rateLimit: LOGIN_RATE_LIMIT } },
    async (request, reply): Promise<LoginResponse | FastifyReply> => {
      const parsed = loginRequestSchema.safeParse(request.body);
      if (!parsed.success) {
        return sendError(reply, 400, 'VALIDATION', 'Código ou senha em formato inválido.');
      }
      const { code, password } = parsed.data;

      const user = await app.prisma.user.findUnique({
        where: { code },
        select: { ...USER_FOR_ME_SELECT, passwordHash: true },
      });
      if (user === null) return loginWithInvite(reply, code, password);

      if (!(await verifyPassword(user.passwordHash, password))) {
        return sendError(reply, 401, 'INVALID_CREDENTIALS', INVALID_CREDENTIALS);
      }
      return startSession(reply, user);
    },
  );

  // Idempotente: sem cookie, ou com sessão já apagada, a resposta é a mesma.
  // "Sair" nunca falha por já ter saído.
  app.post('/auth/logout', async (request, reply): Promise<LogoutResponse> => {
    const sessionId = readSessionId(request);
    if (sessionId !== null) await app.sessions.destroy(sessionId);
    clearSessionCookie(reply, secureCookie);
    return { ok: true };
  });
}
