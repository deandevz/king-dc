'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { createAudioAnalyser, createLocalAudioTrack } from 'livekit-client';
import type { LocalAudioTrack } from 'livekit-client';
import type { MicTest } from './types';

/** ~20 leituras por segundo: rápido o bastante para o medidor parecer contínuo. */
const SAMPLE_MS = 50;

/**
 * Medidor do teste de microfone do modal de configurações. Vive fora de qualquer sala:
 * abre a própria track, mede pelo analisador do Web Audio e devolve 0..1.
 */
export function useMicTest(deviceId: string | null): MicTest {
  const [level, setLevel] = useState(0);
  const trackRef = useRef<LocalAudioTrack | null>(null);
  const cleanupRef = useRef<(() => Promise<void>) | null>(null);
  const timerRef = useRef<number | null>(null);
  const runningRef = useRef(false);

  const stop = useCallback((): void => {
    runningRef.current = false;
    if (timerRef.current !== null) {
      window.clearInterval(timerRef.current);
      timerRef.current = null;
    }
    const cleanup = cleanupRef.current;
    cleanupRef.current = null;
    if (cleanup !== null) void cleanup().catch(() => undefined);
    // A track precisa parar sempre: deixá-la viva mantém o LED do microfone aceso.
    trackRef.current?.stop();
    trackRef.current = null;
    setLevel(0);
  }, []);

  const start = useCallback((): void => {
    if (runningRef.current) return;
    runningRef.current = true;
    void (async () => {
      try {
        const track = await createLocalAudioTrack(
          // `ideal`: id antigo (Safari troca por sessão) cai no microfone padrão em vez de falhar.
          deviceId === null ? {} : { deviceId: { ideal: deviceId } },
        );
        if (!runningRef.current) {
          track.stop();
          return;
        }
        const analyser = createAudioAnalyser(track);
        trackRef.current = track;
        cleanupRef.current = analyser.cleanup;
        timerRef.current = window.setInterval(() => {
          setLevel(Math.min(1, Math.max(0, analyser.calculateVolume())));
        }, SAMPLE_MS);
      } catch {
        runningRef.current = false;
        setLevel(0);
      }
    })();
  }, [deviceId]);

  // Trocar de dispositivo com o teste rodando reabre a captura no novo microfone.
  useEffect(() => {
    if (!runningRef.current) return;
    stop();
    start();
  }, [deviceId, start, stop]);

  useEffect(() => () => stop(), [stop]);

  return { level, start, stop };
}
