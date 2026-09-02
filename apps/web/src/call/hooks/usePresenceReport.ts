'use client';

import { useEffect, useMemo, useRef } from 'react';
import { Track } from 'livekit-client';
import type { Participant } from 'livekit-client';
import type { PresenceParticipant } from '@kingdc/contracts';
import { samePresenceList, toPresenceList } from '../lib/presence';

/** Sem publicação de microfone o participante conta como mudo, igual ao `GET /channels`. */
function isMicMuted(participant: Participant): boolean {
  return participant.getTrackPublication(Track.Source.Microphone)?.isMuted !== false;
}

/**
 * Avisa a shell de quem está na sala a cada mudança de verdade. `useParticipants` já
 * re-renderiza em entrada, saída, mudo, publicação de tela e troca de metadata, então basta
 * remontar a lista e comparar com a última enviada para não repetir o mesmo aviso.
 *
 * `enabled` é o "já conectou": antes disso o participante local ainda não tem identidade
 * nem metadata, e reportar essa lista apagaria o palpite otimista da shell.
 */
export function usePresenceReport(
  participants: readonly Participant[],
  sharingIdentities: readonly string[],
  enabled: boolean,
  onParticipantsChange: ((participants: PresenceParticipant[]) => void) | undefined,
): void {
  const list = useMemo(() => {
    const sharing = new Set(sharingIdentities);
    return toPresenceList(
      participants
        .filter((participant) => participant.identity !== '')
        .map((participant) => ({
          identity: participant.identity,
          name: participant.name,
          metadata: participant.metadata,
          micMuted: isMicMuted(participant),
          screenSharing: sharing.has(participant.identity),
        })),
    );
  }, [participants, sharingIdentities]);

  const callbackRef = useRef(onParticipantsChange);
  useEffect(() => {
    callbackRef.current = onParticipantsChange;
  }, [onParticipantsChange]);

  const lastRef = useRef<PresenceParticipant[] | null>(null);
  useEffect(() => {
    if (!enabled || list.length === 0) return;
    if (lastRef.current !== null && samePresenceList(lastRef.current, list)) return;
    lastRef.current = list;
    callbackRef.current?.(list);
  }, [enabled, list]);
}
