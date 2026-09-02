'use client';

import { useEffect, useRef } from 'react';
import { ConnectionState } from 'livekit-client';
import { useConnectionState } from '@livekit/components-react';
import type { CallConnectionState } from '../types';

function mapState(state: ConnectionState, leaving: boolean): CallConnectionState {
  switch (state) {
    case ConnectionState.Connected:
      return 'connected';
    case ConnectionState.Connecting:
      return 'connecting';
    case ConnectionState.Reconnecting:
    case ConnectionState.SignalReconnecting:
      return 'reconnecting';
    default:
      // Fora de uma saída deliberada, "desconectado" é sempre um passo antes de tentar
      // de novo com o token renovado; reportar "conectando" evita piscar erro à toa.
      return leaving ? 'disconnected' : 'connecting';
  }
}

/**
 * Traduz o estado do LiveKit para o vocabulário de `packages/contracts` e avisa o consumidor
 * só quando o valor muda de verdade.
 */
export function useCallConnection(
  leaving: boolean,
  onConnectionChange: (state: CallConnectionState) => void,
): CallConnectionState {
  const state = mapState(useConnectionState(), leaving);
  const onChangeRef = useRef(onConnectionChange);
  const lastRef = useRef<CallConnectionState | null>(null);

  useEffect(() => {
    onChangeRef.current = onConnectionChange;
  }, [onConnectionChange]);

  useEffect(() => {
    if (lastRef.current === state) return;
    lastRef.current = state;
    onChangeRef.current(state);
  }, [state]);

  return state;
}
