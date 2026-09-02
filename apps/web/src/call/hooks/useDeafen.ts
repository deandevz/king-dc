'use client';

import { useEffect, useRef, useState } from 'react';
import { RoomEvent, Track } from 'livekit-client';
import type { RemoteParticipant, Room } from 'livekit-client';
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
