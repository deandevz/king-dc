import type { FastifyInstance } from 'fastify';
import type { PrismaClient } from '../lib/prisma.js';

/** Deixa o cliente Prisma disponível em `app.prisma` e fecha a conexão no shutdown. */
export function registerPrisma(app: FastifyInstance, prisma: PrismaClient): void {
  app.decorate('prisma', prisma);
  app.addHook('onClose', async () => {
    await prisma.$disconnect();
  });
}
