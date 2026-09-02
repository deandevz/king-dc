import type { FastifyReply } from 'fastify';
import type { ErrorCode } from '@kingdc/contracts';

/** Resposta de erro no formato único da API: `{ error: { code, message } }`. */
export function sendError(
  reply: FastifyReply,
  status: number,
  code: ErrorCode,
  message: string,
): FastifyReply {
  return reply.status(status).send({ error: { code, message } });
}

/** Reconhece erros que carregam `code` (Prisma, Fastify) sem importar a classe deles. */
export function hasErrorCode(error: unknown, code: string): boolean {
  return error instanceof Error && 'code' in error && error.code === code;
}
