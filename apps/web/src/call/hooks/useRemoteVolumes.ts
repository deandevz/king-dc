'use client';

import { useCallback, useEffect, useRef } from 'react';
import { RoomEvent, Track } from 'livekit-client';
import type { RemoteParticipant, Room } from 'livekit-client';
import type { UserVolumes } from '@kingdc/contracts';
import { remoteVolume } from '../lib/policies';
import { userVolume } from '../lib/volumes';

const SOURCES = [Track.Source.Microphone, Track.Source.ScreenShareAudio] as const;

/**
 * Único dono do volume dos remotos: ensurdecer (D9), volume de saída (D10) e volume por
 * participante (D26) entram numa conta só. Aplica nos atuais e em quem chegar depois; o
 * `setVolume` do participante fica guardado e vale também para tracks assinadas mais tarde.
 */
export function useRemoteVolumes(
  room: Room,
  deafened: boolean,
  outputVolume: number,
  volumes: UserVolumes,
): void {
  const apply = useCallback(
    (participant: RemoteParticipant): void => {
      const volume = remoteVolume(
        deafened,
        outputVolume,
        userVolume(volumes, participant.identity),
      );
      SOURCES.forEach((source) => participant.setVolume(volume, source));
    },
    [deafened, outputVolume, volumes],
  );
  const applyRef = useRef(apply);

  useEffect(() => {
    applyRef.current = apply;
    room.remoteParticipants.forEach(apply);
  }, [room, apply]);

  useEffect(() => {
    const onConnected = (participant: RemoteParticipant): void => applyRef.current(participant);
    room.on(RoomEvent.ParticipantConnected, onConnected);
    return () => {
      room.off(RoomEvent.ParticipantConnected, onConnected);
    };
  }, [room]);
}
