import type { FastifyInstance, FastifyReply } from 'fastify';
import {
  LIVEKIT_TOKEN_TTL_SECONDS,
  PRESENCE_STALE_HEADER,
  channelSlugParamsSchema,
  createChannelRequestSchema,
} from '@kingdc/contracts';
import type {
  Channel,
  ChannelTokenResponse,
  ChannelsResponse,
  PresenceParticipant,
} from '@kingdc/contracts';
import { hasErrorCode, sendError } from '../lib/errors.js';
import { avatarUrlFor } from '../lib/me.js';
import { toPresenceParticipant } from '../lib/presence.js';
import { toSlug } from '../lib/slug.js';
import { requireUser } from '../plugins/session.js';

const CHANNEL_FIELDS = { id: true, slug: true, name: true, position: true } as const;

type Presence = { byChannel: Map<string, PresenceParticipant[]>; stale: boolean };

/**
 * Presença de todos os canais com cache *stale-while-revalidate* de 2 s (decisão D5).
 * Cache fresco: serve. Cache vencido: serve o antigo e dispara a atualização em background
 * (uma por canal). Sem cache: bloqueia, com `Promise.allSettled` para os canais em falta em
 * paralelo. Canal cujo `listParticipants` falha entra com lista vazia e liga o `stale`; a
 * falha nunca vai para o cache, então o próximo polling tenta de novo.
 */
async function collectPresence(app: FastifyInstance, slugs: string[]): Promise<Presence> {
  const byChannel = new Map<string, PresenceParticipant[]>();
  const missing: string[] = [];
  let stale = false;

  const fetchParticipants = (slug: string): Promise<PresenceParticipant[]> =>
    app.livekit.listParticipants(slug).then((infos) => infos.map(toPresenceParticipant));
  const warn = (slug: string, err: unknown): void => {
    app.log.warn({ slug, err }, 'presença indisponível: LiveKit não respondeu');
  };

  for (const slug of slugs) {
    const cached = app.presence.peek(slug);
    if (cached === null) {
      missing.push(slug);
      continue;
    }
    byChannel.set(slug, cached.participants);
    if (cached.failed) stale = true;
    if (!cached.fresh) {
      app.presence.refreshInBackground(slug, () => fetchParticipants(slug), (err) => warn(slug, err));
    }
  }

  const results = await Promise.allSettled(missing.map(fetchParticipants));
  for (const [index, result] of results.entries()) {
    const slug = missing[index];
    if (slug === undefined) continue;
    if (result.status === 'rejected') {
      warn(slug, result.reason);
      byChannel.set(slug, []);
      stale = true;
      continue;
    }
    app.presence.set(slug, result.value);
    byChannel.set(slug, result.value);
  }

  return { byChannel, stale };
}

/** `GET/POST /channels` e `POST /channels/:slug/token` (decisões D5, D6, D7, D17). */
export function registerChannelRoutes(app: FastifyInstance): void {
  const auth = { preHandler: app.requireAuth };

  app.get('/channels', auth, async (_request, reply): Promise<ChannelsResponse> => {
    const rows = await app.prisma.channel.findMany({
      orderBy: { position: 'asc' },
      select: CHANNEL_FIELDS,
    });
    const { byChannel, stale } = await collectPresence(
      app,
      rows.map((row) => row.slug),
    );
    if (stale) reply.header(PRESENCE_STALE_HEADER, '1');

    const online = new Set<string>();
    const channels = rows.map((row) => {
      const participants = byChannel.get(row.slug) ?? [];
      for (const participant of participants) online.add(participant.userId);
      return { ...row, participants };
    });
    return { channels, onlineCount: online.size };
  });

  app.post(
    '/channels',
    { preHandler: app.requireAdmin },
    async (request, reply): Promise<Channel | FastifyReply> => {
      const parsed = createChannelRequestSchema.safeParse(request.body);
      if (!parsed.success) {
        const message = 'Nome do canal precisa ter de 1 a 32 caracteres visíveis, sem caracteres de controle.';
        return sendError(reply, 400, 'VALIDATION', message);
      }
      const name = parsed.data.name;
      const slug = toSlug(name);
      if (slug.length === 0) {
        const message = 'O nome precisa ter ao menos uma letra ou número.';
        return sendError(reply, 400, 'VALIDATION', message);
      }
      try {
        return await app.prisma.$transaction(async (tx) => {
          const highest = await tx.channel.aggregate({ _max: { position: true } });
          return tx.channel.create({
            data: { slug, name, position: (highest._max.position ?? -1) + 1 },
            select: CHANNEL_FIELDS,
          });
        });
      } catch (error) {
        if (hasErrorCode(error, 'P2002')) {
          return sendError(reply, 409, 'VALIDATION', `Já existe um canal em "${slug}".`);
        }
        throw error;
      }
    },
  );

  app.post(
    '/channels/:slug/token',
    auth,
    async (request, reply): Promise<ChannelTokenResponse | FastifyReply> => {
      const params = channelSlugParamsSchema.safeParse(request.params);
      const slug = params.success ? params.data.slug : '';
      const channel = await app.prisma.channel.findUnique({
        where: { slug },
        select: CHANNEL_FIELDS,
      });
      if (channel === null) return sendError(reply, 404, 'NOT_FOUND', 'Canal não encontrado.');

      const user = requireUser(request);
      if (user.nickname === null) {
        return sendError(reply, 403, 'FORBIDDEN', 'Escolha um apelido antes de entrar num canal.');
      }

      const metadata = JSON.stringify({
        nickname: user.nickname,
        avatarUrl: avatarUrlFor(user.id, user.avatarUpdatedAt),
      });

      try {
        const token = await app.livekit.createToken({
          room: channel.slug,
          identity: user.id,
          name: user.nickname,
          metadata,
        });
        return {
          token,
          url: app.livekit.url,
          expiresAt: new Date(Date.now() + LIVEKIT_TOKEN_TTL_SECONDS * 1000).toISOString(),
        };
      } catch (error) {
        request.log.error({ err: error }, 'falha ao assinar token do LiveKit');
        return sendError(reply, 503, 'LIVEKIT_UNAVAILABLE', 'Voz indisponível. Tente de novo.');
      }
    },
  );
}
