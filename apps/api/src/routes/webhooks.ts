import type { FastifyInstance, FastifyReply } from 'fastify';
import { sendError } from '../lib/errors.js';

/** Content type que o LiveKit usa nos webhooks. */
const WEBHOOK_CONTENT_TYPE = 'application/webhook+json';

/**
 * Eventos que mudam quem está em qual canal. Egress, ingress e afins não mexem em presença.
 */
const PRESENCE_EVENTS = new Set([
  'participant_joined',
  'participant_left',
  'track_published',
  'track_unpublished',
  'room_started',
  'room_finished',
]);

/**
 * `POST /webhooks/livekit`. A assinatura é sobre os bytes exatos do corpo,
 * então este content type — e só ele — chega como string crua, sem passar pelo JSON.
 * O webhook não é fonte de verdade de presença: ele apaga a entrada do canal no cache, para
 * que o próximo `GET /channels` busque fresco em vez de servir o valor antigo (D5).
 */
export function registerWebhookRoutes(app: FastifyInstance): void {
  app.addContentTypeParser(
    WEBHOOK_CONTENT_TYPE,
    { parseAs: 'string' },
    (_request, body: string, done) => {
      done(null, body);
    },
  );

  app.post('/webhooks/livekit', async (request, reply): Promise<{ ok: true } | FastifyReply> => {
    const raw = typeof request.body === 'string' ? request.body : '';
    try {
      const event = await app.livekit.verifyWebhook(raw, request.headers.authorization);
      const room = event.room?.name ?? '';
      if (PRESENCE_EVENTS.has(event.event)) {
        if (room === '') app.presence.clear();
        else app.presence.forget(room);
      }
      request.log.info({ event: event.event, room }, 'webhook do LiveKit');
    } catch (error) {
      request.log.warn({ err: error }, 'webhook do LiveKit recusado');
      return sendError(reply, 401, 'UNAUTHENTICATED', 'Assinatura do webhook inválida.');
    }
    return { ok: true };
  });
}
