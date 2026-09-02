import { mkdir } from 'node:fs/promises';
import fastifyCookie from '@fastify/cookie';
import fastifyMultipart from '@fastify/multipart';
import fastifyRateLimit from '@fastify/rate-limit';
import fastifyStatic from '@fastify/static';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { AVATAR_MAX_BYTES } from '@kingdc/contracts';
import { sendError } from '../lib/errors.js';

/**
 * Plugins de infraestrutura. O rate limit entra com `global: false`: cada rota que
 * precisa (login, por exemplo) liga o seu próprio limite via `config.rateLimit`.
 */
export async function registerCorePlugins(app: FastifyInstance): Promise<void> {
  await app.register(fastifyCookie, { secret: app.env.SESSION_SECRET });

  await app.register(fastifyMultipart, {
    limits: { fileSize: AVATAR_MAX_BYTES, files: 1, fields: 4 },
  });

  await app.register(fastifyRateLimit, {
    global: false,
    // O plugin *lança* o que este builder devolve, então precisa ser um Error com
    // `statusCode`: quem monta o corpo `{ error: { code: 'RATE_LIMITED' } }` é o
    // errorHandler da app, um lugar só para todos os erros.
    errorResponseBuilder: (_request, context) =>
      Object.assign(new Error(`Limite atingido. Tente de novo em ${context.after}.`), {
        statusCode: context.statusCode,
      }),
  });

  await mkdir(app.env.AVATAR_DIR, { recursive: true });
  await app.register(fastifyStatic, {
    root: app.env.AVATAR_DIR,
    prefix: '/avatars/',
    index: false,
    // `Cache-Control: public, max-age=31536000, immutable`;
    // a troca de foto é sinalizada pelo `?v=` na URL.
    cacheControl: true,
    maxAge: 31_536_000_000,
    immutable: true,
  });

  const notFound = (_request: FastifyRequest, reply: FastifyReply): FastifyReply =>
    sendError(reply, 404, 'NOT_FOUND', 'Rota não encontrada.');
  app.setNotFoundHandler(notFound);
  // O diretório em si não é um avatar: sem isto o `@fastify/static` responde 403.
  app.get('/avatars/', notFound);
}
