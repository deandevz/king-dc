import type { FastifyInstance } from 'fastify';
import { PresenceCache } from '../lib/presence.js';
import { registerAuthRoutes } from './auth.js';
import { registerChannelRoutes } from './channels.js';
import { registerHealthRoute } from './health.js';
import { registerInviteRoutes } from './invites.js';
import { registerMeRoutes } from './me.js';
import { registerWebhookRoutes } from './webhooks.js';

/** Todas as rotas na instância raiz: o parser cru do webhook não pode ficar encapsulado. */
export function registerRoutes(app: FastifyInstance): void {
  app.decorate('presence', new PresenceCache());
  registerHealthRoute(app);
  registerAuthRoutes(app);
  registerMeRoutes(app);
  registerChannelRoutes(app);
  registerInviteRoutes(app);
  registerWebhookRoutes(app);
}
