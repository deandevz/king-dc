'use client';

import { useCallback, useEffect, useRef } from 'react';
import { RoomEvent } from 'livekit-client';
import type {
  LocalTrackPublication,
  RemoteParticipant,
  RemoteTrackPublication,
  Room,
} from 'livekit-client';
import type { AudioPrefs } from '../types';
import { playSound, shareSound } from '../lib/sounds';
import type { CallSound } from '../lib/sounds';

/**
 * Sons da call (decisão D25). Mudo e ensurdecer tocam por quem clicou, via `play`.
 * Entrar, sair e tela tocam para todo mundo na sala, a partir dos eventos do SDK, que
 * só emite `ParticipantConnected` e `TrackPublished` depois de conectado: quem chega
 * numa sala cheia, com tela aberta, não ouve nada além do próprio "entrou".
 * Push-to-talk não toca nada, como no Discord.
 */
export function useCallSounds(room: Room, prefs: AudioPrefs): (sound: CallSound) => void {
  const { outputVolume, outputDeviceId } = prefs;
  const play = useCallback(
    (sound: CallSound): void => playSound(sound, outputVolume, outputDeviceId),
    [outputVolume, outputDeviceId],
  );
  const playRef = useRef(play);

  useEffect(() => {
    playRef.current = play;
  }, [play]);

  useEffect(() => {
    const share =
      (published: boolean) =>
      (publication: RemoteTrackPublication | LocalTrackPublication): void => {
        const sound = shareSound(publication.source, published);
        if (sound !== null) playRef.current(sound);
      };
    const started = share(true);
    const stopped = share(false);
    // Quem sai da sala tem as tracks despublicadas antes do evento de saída, já fora da
    // lista de remotos: aí vale só o "saiu", sem "tela parou" junto.
    const remoteStopped = (
      publication: RemoteTrackPublication,
      participant: RemoteParticipant,
    ): void => {
      if (room.remoteParticipants.has(participant.identity)) stopped(publication);
    };
    const joined = (): void => playRef.current('entrou');
    const left = (): void => playRef.current('saiu');
    room
      .on(RoomEvent.Connected, joined)
      .on(RoomEvent.ParticipantConnected, joined)
      .on(RoomEvent.ParticipantDisconnected, left)
      .on(RoomEvent.TrackPublished, started)
      .on(RoomEvent.LocalTrackPublished, started)
      .on(RoomEvent.TrackUnpublished, remoteStopped)
      .on(RoomEvent.LocalTrackUnpublished, stopped);
    return () => {
      room
        .off(RoomEvent.Connected, joined)
        .off(RoomEvent.ParticipantConnected, joined)
        .off(RoomEvent.ParticipantDisconnected, left)
        .off(RoomEvent.TrackPublished, started)
        .off(RoomEvent.LocalTrackPublished, started)
        .off(RoomEvent.TrackUnpublished, remoteStopped)
        .off(RoomEvent.LocalTrackUnpublished, stopped);
    };
  }, [room]);

  return play;
}
