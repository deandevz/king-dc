import type { FastifyInstance } from 'fastify';
import type { HealthResponse } from '@kingdc/contracts';

/**
 * `GET /health`: 200 enquanto o processo vive. `db` só é `false` quando a
 * query falha; `livekit` reporta se as credenciais estão configuradas — bater no LiveKit
 * a cada healthcheck do compose custaria milhares de chamadas por dia.
 *
 * `logLevel: 'silent'`: o compose chama a rota a cada 10 s e as duas linhas de request/
 * response por chamada (~17 mil por dia) empurrariam um erro real para fora da rotação.
 * Banco fora vira uma linha `warn`, sem o stack trace do Prisma.
 */
/** Primeira linha útil do erro: a mensagem do Prisma começa com linha em branco. */
function firstLine(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  const line = message
    .split('\n')
    .map((part) => part.trim())
    .find((part) => part.length > 0);
  return (line ?? 'sem detalhe').slice(0, 160);
}

export function registerHealthRoute(app: FastifyInstance): void {
  app.get('/health', { logLevel: 'silent' }, async (): Promise<HealthResponse> => {
    let db = true;
    try {
      await app.prisma.$queryRaw`SELECT 1`;
    } catch (error) {
      app.log.warn(`healthcheck: banco indisponível (${firstLine(error)})`);
      db = false;
    }
    const livekit = app.env.LIVEKIT_API_KEY.length > 0 && app.env.LIVEKIT_API_SECRET.length > 0;
    return { ok: true, db, livekit };
  });
}
