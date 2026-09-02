import Fastify from 'fastify';
import type { FastifyError, FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { ZodError } from 'zod';
import { readEnv } from './env.js';
import type { Env } from './env.js';
import { sendError } from './lib/errors.js';
import { createLiveKitService } from './lib/livekit.js';
import type { LiveKitService } from './lib/livekit.js';
import { createPrismaClient } from './lib/prisma.js';
import type { PrismaClient } from './lib/prisma.js';
import { registerCorePlugins } from './plugins/core.js';
import { registerPrisma } from './plugins/prisma.js';
import { registerSession } from './plugins/session.js';
import { registerRoutes } from './routes/index.js';

export type BuildAppOptions = {
  env?: Env;
  prisma?: PrismaClient;
  livekit?: LiveKitService;
};

/** Monta a aplicação sem escutar porta. Testes injetam `prisma` e `livekit` falsos. */
export async function buildApp(options: BuildAppOptions = {}): Promise<FastifyInstance> {
  const env = options.env ?? readEnv();

  const app = Fastify({
    logger: env.NODE_ENV === 'test' ? false : { level: 'info' },
    // Só proxies em rede privada (Caddy/Next na rede do compose) podem falar quem é o
    // cliente. Com `true`, qualquer um exposto direto forjava `X-Forwarded-For` e furava o
    // rate limit do login, que é por IP.
    trustProxy: ['loopback', 'uniquelocal'],
    bodyLimit: 1_048_576,
  });

  app.decorate('env', env);

  const prisma = options.prisma ?? createPrismaClient(env.DATABASE_URL);
  registerPrisma(app, prisma);

  app.decorate(
    'livekit',
    options.livekit ??
      createLiveKitService({
        url: env.LIVEKIT_URL,
        hostHttp: env.LIVEKIT_HOST_HTTP,
        apiKey: env.LIVEKIT_API_KEY,
        apiSecret: env.LIVEKIT_API_SECRET,
      }),
  );

  await registerCorePlugins(app);
  registerSession(app);
  registerRoutes(app);

  app.setErrorHandler((error: FastifyError, request: FastifyRequest, reply: FastifyReply) => {
    if (error instanceof ZodError) {
      return sendError(reply, 400, 'VALIDATION', 'Dados inválidos.');
    }
    const status = error.statusCode ?? 500;
    if (status >= 500) {
      request.log.error({ err: error }, 'erro não tratado');
      return sendError(reply, 500, 'INTERNAL', 'Erro interno.');
    }
    if (status === 429) {
      return sendError(reply, 429, 'RATE_LIMITED', 'Muitas tentativas. Espere um pouco.');
    }
    if (status === 404) {
      return sendError(reply, 404, 'NOT_FOUND', 'Rota não encontrada.');
    }
    return sendError(reply, status, 'VALIDATION', error.message);
  });

  return app;
}
