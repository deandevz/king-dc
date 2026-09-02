import type { PresenceParticipant } from '@kingdc/contracts';
import { parseParticipantProfile } from './metadata';

/** O mínimo que a lista de presença precisa de um participante do LiveKit. */
export type PresenceSource = {
  identity: string;
  name: string | undefined;
  metadata: string | undefined;
  /** Track de microfone ausente ou mutada, a mesma regra do `GET /channels`. */
  micMuted: boolean;
  deafened: boolean;
  screenSharing: boolean;
};

/**
 * Participantes da sala → o shape de presença da API, para a sidebar do canal atual poder
 * trocar a lista do polling pela da sala sem saber de onde ela veio.
 * Ordem estável por `userId`: a sidebar não pode dançar a cada evento do LiveKit.
 */
export function toPresenceList(sources: readonly PresenceSource[]): PresenceParticipant[] {
  return sources
    .map((source) => {
      const profile = parseParticipantProfile(source.metadata, source.name, source.identity);
      return {
        userId: source.identity,
        nickname: profile.nickname,
        avatarUrl: profile.avatarUrl,
        micMuted: source.micMuted,
        deafened: source.deafened,
        screenSharing: source.screenSharing,
      };
    })
    .sort((left, right) => left.userId.localeCompare(right.userId));
}

/** Duas listas iguais campo a campo. Evita avisar a shell a cada render da sala. */
export function samePresenceList(
  left: readonly PresenceParticipant[],
  right: readonly PresenceParticipant[],
): boolean {
  if (left.length !== right.length) return false;
  return left.every((person, index) => {
    const other = right[index];
    if (other === undefined) return false;
    return (
      person.userId === other.userId &&
      person.nickname === other.nickname &&
      person.avatarUrl === other.avatarUrl &&
      person.micMuted === other.micMuted &&
      person.deafened === other.deafened &&
      person.screenSharing === other.screenSharing
    );
  });
}
