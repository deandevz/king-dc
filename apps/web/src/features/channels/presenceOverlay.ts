import type { ChannelWithPresence, PresenceParticipant } from '@kingdc/contracts';

export type PresenceOverlay = {
  /** Canal em que estou conectado agora; `null` fora de qualquer call. */
  activeSlug: string | null;
  /** Lista vinda da sala do LiveKit; `null` enquanto o primeiro evento não chegou. */
  live: PresenceParticipant[] | null;
  /** Eu, otimista, enquanto a sala ainda não reportou nada. */
  self: PresenceParticipant | null;
  /** Acabei de sair: some de todo canal até o polling parar de me listar. */
  hideSelf: boolean;
};

export type OverlaidPresence = {
  channels: ChannelWithPresence[];
  onlineCount: number;
};

function upsert(
  participants: readonly PresenceParticipant[],
  self: PresenceParticipant,
): PresenceParticipant[] {
  const others = participants.filter((person) => person.userId !== self.userId);
  return [...others, self];
}

/**
 * A presença do polling (`GET /channels`, até 2 s de atraso mais o cache da API) com o que
 * a shell sabe agora por cima: no canal conectado vale a lista da sala do LiveKit, e enquanto
 * ela não chega valho eu, otimista. Fora dele eu não apareço, porque o polling ainda pode me
 * listar no canal anterior ou naquele de onde acabei de sair.
 */
export function applyPresenceOverlay(
  channels: readonly ChannelWithPresence[],
  overlay: PresenceOverlay,
): OverlaidPresence {
  const selfId = overlay.self?.userId ?? null;
  const dropSelfElsewhere = overlay.activeSlug !== null || overlay.hideSelf;

  const merged = channels.map((channel) => {
    if (channel.slug === overlay.activeSlug) {
      if (overlay.live !== null) return { ...channel, participants: overlay.live };
      if (overlay.self !== null) {
        return { ...channel, participants: upsert(channel.participants, overlay.self) };
      }
      return { ...channel };
    }
    if (!dropSelfElsewhere || selfId === null) return { ...channel };
    return {
      ...channel,
      participants: channel.participants.filter((person) => person.userId !== selfId),
    };
  });

  const online = new Set<string>();
  for (const channel of merged) {
    for (const person of channel.participants) online.add(person.userId);
  }
  return { channels: merged, onlineCount: online.size };
}

/** O polling ainda me lista em algum canal? Enquanto listar, a saída otimista continua valendo. */
export function pollingListsUser(
  channels: readonly ChannelWithPresence[],
  userId: string,
): boolean {
  return channels.some((channel) =>
    channel.participants.some((person) => person.userId === userId),
  );
}
