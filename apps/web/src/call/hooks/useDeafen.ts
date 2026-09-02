'use client';

import { useEffect, useRef, useState } from 'react';
import { RoomEvent, Track } from 'livekit-client';
import type { RemoteParticipant, Room } from 'livekit-client';
import { DEAFENED_ATTRIBUTE, DEAFENED_ON } from '@kingdc/contracts';
import { remoteVolume } from '../lib/policies';

const DEAFENED_SOURCES = [Track.Source.Microphone, Track.Source.ScreenShareAudio] as const;

export type DeafenState = {
  deafened: boolean;
  /** Volume que vale para os remotos agora: 0 quando ensurdecido (decisão D9). */
  volume: number;
  setDeafened: (next: boolean) => void;
};

/**
 * Ensurdecer é client-side: o LiveKit não tem o conceito. Aplica `setVolume` em todos os
 * remotos atuais e em quem chegar depois — sem isso, quem entra durante o "deaf" é ouvido.
 * O estado vai para os outros como atributo do participante (decisão D9).
 */
export function useDeafen(room: Room, outputVolume: number): DeafenState {
  const [deafened, setDeafened] = useState(false);
  const volume = remoteVolume(deafened, outputVolume);
  const volumeRef = useRef(volume);

  useEffect(() => {
    volumeRef.current = volume;
    room.remoteParticipants.forEach((participant) => {
      DEAFENED_SOURCES.forEach((source) => participant.setVolume(volume, source));
    });
  }, [room, volume]);

  useEffect(() => {
    const local = room.localParticipant;
    // Antes de conectar não há o que publicar; o valor inicial é "ouvindo" de qualquer jeito.
    if (!deafened && local.attributes[DEAFENED_ATTRIBUTE] !== DEAFENED_ON) return;
    void local
      .setAttributes({ [DEAFENED_ATTRIBUTE]: deafened ? DEAFENED_ON : '' })
      .catch(() => undefined);
  }, [room, deafened]);

  useEffect(() => {
    const applyToNewcomer = (participant: RemoteParticipant): void => {
      DEAFENED_SOURCES.forEach((source) => participant.setVolume(volumeRef.current, source));
    };
    room.on(RoomEvent.ParticipantConnected, applyToNewcomer);
    return () => {
      room.off(RoomEvent.ParticipantConnected, applyToNewcomer);
    };
  }, [room]);

  return { deafened, volume, setDeafened };
}
