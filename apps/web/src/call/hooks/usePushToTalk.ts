'use client';

import { useEffect, useRef } from 'react';
import { shouldStartTalking, shouldStopTalking } from '../lib/ptt';

/**
 * Push-to-talk (decisão D12): segurar a tecla abre o microfone, soltar fecha. Perder o
 * foco da janela ou esconder a aba também fecha — senão o microfone fica aberto sem que
 * o `keyup` chegue. Só funciona com a aba em foco, que é o limite do browser.
 */
export function usePushToTalk(
  enabled: boolean,
  pttKey: string,
  setTalking: (talking: boolean) => void,
): void {
  const setTalkingRef = useRef(setTalking);
  const holdingRef = useRef(false);

  useEffect(() => {
    setTalkingRef.current = setTalking;
  }, [setTalking]);

  useEffect(() => {
    if (!enabled) return;

    const release = (): void => {
      if (!holdingRef.current) return;
      holdingRef.current = false;
      setTalkingRef.current(false);
    };
    const onKeyDown = (event: KeyboardEvent): void => {
      if (!shouldStartTalking(event, pttKey)) return;
      event.preventDefault();
      if (holdingRef.current) return;
      holdingRef.current = true;
      setTalkingRef.current(true);
    };
    const onKeyUp = (event: KeyboardEvent): void => {
      if (shouldStopTalking(event, pttKey)) release();
    };
    const onVisibilityChange = (): void => {
      if (document.visibilityState === 'hidden') release();
    };

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('blur', release);
    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('blur', release);
      document.removeEventListener('visibilitychange', onVisibilityChange);
      release();
    };
  }, [enabled, pttKey]);
}
