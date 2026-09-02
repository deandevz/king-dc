import type { Env } from '../env.js';
import type { LiveKitService } from '../lib/livekit.js';
import type { PresenceCache } from '../lib/presence.js';
import type { PrismaClient } from '../lib/prisma.js';
import type { SessionStore, SessionUser } from '../plugins/session.js';

declare module 'fastify' {
  interface FastifyInstance {
    env: Env;
    prisma: PrismaClient;
    livekit: LiveKitService;
    sessions: SessionStore;
    /** Cache de presença de 2 s; o webhook do LiveKit o invalida (decisão D5). */
    presence: PresenceCache;
    /** preHandler que exige cookie de sessão válido; devolve 401 UNAUTHENTICATED. */
    requireAuth: preHandlerHookHandler;
    /** preHandler que exige sessão válida de um usuário admin; devolve 403 FORBIDDEN. */
    requireAdmin: preHandlerHookHandler;
  }

  interface FastifyRequest {
    user: SessionUser | null;
    sessionId: string | null;
  }
}

export {};
