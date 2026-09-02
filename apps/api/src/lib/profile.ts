import type { FastifyInstance } from 'fastify';
import type { Me } from '@kingdc/contracts';

/**
 * Canais em que a pessoa está agora. Usa o cache de presença quando ele tem o canal; só
 * pergunta ao LiveKit pelos canais que ainda não estão no cache.
 */
async function roomsWithUser(app: FastifyInstance, userId: string): Promise<string[]> {
  const channels = await app.prisma.channel.findMany({ select: { slug: true } });
  const found: string[] = [];
  const unknown: string[] = [];

  for (const { slug } of channels) {
    const cached = app.presence.peek(slug);
    if (cached === null) {
      unknown.push(slug);
      continue;
    }
    if (cached.participants.some((person) => person.userId === userId)) found.push(slug);
  }

  const results = await Promise.allSettled(
    unknown.map((slug) => app.livekit.listParticipants(slug)),
  );
  for (const [index, result] of results.entries()) {
    const slug = unknown[index];
    if (slug === undefined || result.status === 'rejected') continue;
    if (result.value.some((info) => info.identity === userId)) found.push(slug);
  }
  return found;
}

/**
 * Nick e foto viajam no `metadata` do token (decisão D6), então trocar o perfil não muda
 * nada para quem já está na sala. Aqui reescrevemos o `metadata` de quem está em call e
 * apagamos o cache daqueles canais, para a sidebar dos outros pegar o valor novo.
 *
 * É best-effort: LiveKit fora do ar não pode derrubar o `PATCH /me`.
 */
export async function propagateProfile(app: FastifyInstance, me: Me): Promise<void> {
  if (me.nickname === null) return;
  const metadata = JSON.stringify({ nickname: me.nickname, avatarUrl: me.avatarUrl });

  let rooms: string[];
  try {
    rooms = await roomsWithUser(app, me.id);
  } catch (error) {
    app.log.warn({ err: error, userId: me.id }, 'perfil não propagado: presença indisponível');
    return;
  }

  const results = await Promise.allSettled(
    rooms.map((room) => app.livekit.updateParticipantMetadata(room, me.id, metadata)),
  );
  for (const [index, result] of results.entries()) {
    const room = rooms[index];
    if (room === undefined) continue;
    if (result.status === 'rejected') {
      app.log.warn({ err: result.reason, room }, 'perfil não propagado para a sala');
      continue;
    }
    app.presence.forget(room);
  }
}
