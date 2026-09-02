'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { JSX } from 'react';
import { LiveKitRoom } from '@livekit/components-react';
import type { DisconnectReason, RoomOptions } from 'livekit-client';
import { Glass } from '@/ui';
import type { CallRoomProps } from './types';
import { CallStage } from './CallStage';
import { useCallToken } from './hooks/useCallToken';
import { micEnabledForMode, shouldRenewAfterDisconnect } from './lib/policies';
import styles from './CallRoom.module.css';

function buildRoomOptions(prefs: CallRoomProps['audioPrefs']): RoomOptions {
  return {
    // Preset fixo de tela (decisão D8). Simulcast fica ligado, que é o default.
    publishDefaults: { screenShareEncoding: { maxBitrate: 2_000_000, maxFramerate: 30 } },
    audioCaptureDefaults:
      prefs.inputDeviceId === null ? {} : { deviceId: { ideal: prefs.inputDeviceId } },
    audioOutput: prefs.outputDeviceId === null ? {} : { deviceId: prefs.outputDeviceId },
  };
}

/**
 * Sala de voz do King DC. Dona da conexão, da renovação de token (D6), do áudio, dos
 * tiles e da barra de controles. Não conhece rotas nem cookies: tudo que vem de fora
 * chega por `getToken` e pelos callbacks.
 */
export function CallRoom({
  channel,
  getToken,
  audioPrefs,
  onLeave,
  onConnectionChange,
  onOpenSettings,
  onParticipantsChange,
}: CallRoomProps): JSX.Element {
  const { credentials, error, renew } = useCallToken(getToken);
  const [leaving, setLeaving] = useState(false);
  const leavingRef = useRef(false);

  // As opções fixam a identidade da `Room`: mudá-las recriaria a conexão. Trocas de
  // dispositivo em tempo real passam por `switchActiveDevice` dentro do palco.
  const [roomOptions] = useState<RoomOptions>(() => buildRoomOptions(audioPrefs));

  const handleLeaveIntent = useCallback((): void => {
    leavingRef.current = true;
    setLeaving(true);
  }, []);

  const handleDisconnected = useCallback(
    (reason?: DisconnectReason): void => {
      if (leavingRef.current) return;
      // Queda definitiva (outra aba com a mesma conta, removido, sala fechada): volta para
      // a sala de espera em vez de tentar entrar de novo.
      if (!shouldRenewAfterDisconnect(reason)) {
        leavingRef.current = true;
        onLeave();
        return;
      }
      // Queda transitória: pega um token novo, porque o antigo pode ter vencido e a
      // reconexão do SDK seria rejeitada.
      renew();
    },
    [onLeave, renew],
  );

  useEffect(() => {
    onConnectionChange('connecting');
  }, [onConnectionChange]);

  if (error !== null && credentials === null) {
    return (
      <Glass variant="card" className={styles.failure}>
        <span className={styles.failureTitle}>Não deu para entrar em {channel.name}</span>
        <span className={styles.failureHint}>{error}</span>
      </Glass>
    );
  }

  return (
    <LiveKitRoom
      className={styles.room}
      serverUrl={credentials?.url}
      token={credentials?.token}
      connect={credentials !== null && !leaving}
      audio={micEnabledForMode(audioPrefs.inputMode)}
      video={false}
      options={roomOptions}
      onDisconnected={handleDisconnected}
    >
      <CallStage
        audioPrefs={audioPrefs}
        leaving={leaving}
        onConnectionChange={onConnectionChange}
        onOpenSettings={onOpenSettings}
        onLeaveIntent={handleLeaveIntent}
        onLeave={onLeave}
        {...(onParticipantsChange === undefined ? {} : { onParticipantsChange })}
      />
    </LiveKitRoom>
  );
}
