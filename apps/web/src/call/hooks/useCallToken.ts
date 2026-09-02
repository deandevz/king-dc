'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { LIVEKIT_TOKEN_REFRESH_MS } from '@kingdc/contracts';
import type { CallRoomProps } from '../types';

export type CallCredentials = { token: string; url: string };

export type CallTokenState = {
  credentials: CallCredentials | null;
  error: string | null;
  /** Busca um token novo. Usado no agendamento e depois de uma queda de conexão. */
  renew: () => void;
};

/**
 * Dono do token do LiveKit: pega um no mount e renova a cada `LIVEKIT_TOKEN_REFRESH_MS`
 * (decisão D6). Token vencido não derruba quem já está conectado, só barra a reconexão —
 * por isso o valor novo fica no estado e vira a prop `token` da sala.
 */
export function useCallToken(getToken: CallRoomProps['getToken']): CallTokenState {
  const [credentials, setCredentials] = useState<CallCredentials | null>(null);
  const [error, setError] = useState<string | null>(null);
  const getTokenRef = useRef(getToken);
  const aliveRef = useRef(false);

  useEffect(() => {
    getTokenRef.current = getToken;
  }, [getToken]);

  const renew = useCallback(() => {
    void (async () => {
      try {
        const next = await getTokenRef.current();
        if (!aliveRef.current) return;
        setCredentials({ token: next.token, url: next.url });
        setError(null);
      } catch {
        if (!aliveRef.current) return;
        setError('Não foi possível pegar a credencial da sala.');
      }
    })();
  }, []);

  useEffect(() => {
    aliveRef.current = true;
    renew();
    const timer = window.setInterval(renew, LIVEKIT_TOKEN_REFRESH_MS);
    return () => {
      aliveRef.current = false;
      window.clearInterval(timer);
    };
  }, [renew]);

  return { credentials, error, renew };
}
