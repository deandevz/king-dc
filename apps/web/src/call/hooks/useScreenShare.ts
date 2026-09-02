'use client';

import { useCallback, useEffect, useRef } from 'react';
import type { Room, ScreenShareCaptureOptions } from 'livekit-client';

/** Preset fixo de captura de tela (decisão D8): 1280×720 @ 30 fps, nítido, com áudio. */
export const SCREEN_SHARE_OPTIONS: ScreenShareCaptureOptions = {
  resolution: { width: 1280, height: 720, frameRate: 30 },
  contentHint: 'detail',
  audio: true,
};

function isUserCancelled(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  return error.name === 'NotAllowedError' || error.name === 'AbortError';
}

export type ScreenShareControls = {
  start: () => void;
  stop: () => void;
};

/**
 * Liga e desliga o compartilhamento de tela. Cancelar o seletor do browser não é erro,
 * é o usuário desistindo. O desmonte sempre desliga a captura: `getDisplayMedia` vazado
 * deixa a aba com o indicador de gravação aceso mesmo fora da call.
 */
export function useScreenShare(room: Room): ScreenShareControls {
  const roomRef = useRef(room);

  useEffect(() => {
    roomRef.current = room;
  }, [room]);

  const stop = useCallback((): void => {
    void room.localParticipant.setScreenShareEnabled(false).catch(() => undefined);
  }, [room]);

  const start = useCallback((): void => {
    void room.localParticipant
      .setScreenShareEnabled(true, SCREEN_SHARE_OPTIONS)
      .catch((error: unknown) => {
        if (isUserCancelled(error)) return;
        console.warn('Falha ao compartilhar a tela', error);
      });
  }, [room]);

  useEffect(
    () => () => {
      void roomRef.current.localParticipant
        .setScreenShareEnabled(false)
        .catch(() => undefined);
    },
    [],
  );

  return { start, stop };
}
