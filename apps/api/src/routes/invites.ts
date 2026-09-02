import type { FastifyInstance } from 'fastify';
import type { CreateInviteResponse, InvitesResponse } from '@kingdc/contracts';
import { inviteExpiry, reserveInviteCode } from '../lib/invites.js';
import { requireUser } from '../plugins/session.js';

/** `POST /invites` e `GET /invites`, só para admin (decisões D2, D4). */
export function registerInviteRoutes(app: FastifyInstance): void {
  const admin = { preHandler: app.requireAdmin };

  app.post('/invites', admin, async (request): Promise<CreateInviteResponse> => {
    const code = await reserveInviteCode(app.prisma);
    const invite = await app.prisma.invite.create({
      data: { code, createdById: requireUser(request).id, expiresAt: inviteExpiry() },
      select: { code: true, expiresAt: true },
    });
    return { code: invite.code, expiresAt: invite.expiresAt.toISOString() };
  });

  app.get('/invites', admin, async (): Promise<InvitesResponse> => {
    const rows = await app.prisma.invite.findMany({
      orderBy: { createdAt: 'desc' },
      select: { code: true, createdAt: true, expiresAt: true, usedAt: true },
    });
    return {
      invites: rows.map((row) => ({
        code: row.code,
        createdAt: row.createdAt.toISOString(),
        expiresAt: row.expiresAt.toISOString(),
        usedAt: row.usedAt === null ? null : row.usedAt.toISOString(),
      })),
    };
  });
}
