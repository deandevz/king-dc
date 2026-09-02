'use client';

import { useEffect } from 'react';
import type { Room } from 'livekit-client';
import type { AudioPrefs } from '../types';

/**
 * Reflete as preferências de dispositivo (decisão D10) na sala já conectada. Trocar o
 * `deviceId` nas opções da sala recriaria a `Room` inteira; `switchActiveDevice` troca
 * a track no ar e ainda vira o padrão das próximas.
 */
export function useAudioDevices(room: Room, prefs: AudioPrefs): void {
  const { inputDeviceId, outputDeviceId } = prefs;

  useEffect(() => {
    if (inputDeviceId === null) return;
    void room.switchActiveDevice('audioinput', inputDeviceId).catch(() => undefined);
  }, [room, inputDeviceId]);

  useEffect(() => {
    if (outputDeviceId === null) return;
    void room.switchActiveDevice('audiooutput', outputDeviceId).catch(() => undefined);
  }, [room, outputDeviceId]);
}
