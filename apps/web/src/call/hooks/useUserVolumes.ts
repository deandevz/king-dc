'use client';

import { useCallback, useSyncExternalStore } from 'react';
import { USER_VOLUMES_STORAGE_KEY } from '@kingdc/contracts';
import type { UserVolumes } from '@kingdc/contracts';
import { parseUserVolumes, withUserVolume } from '../lib/volumes';

/**
 * Volume por participante só no localStorage (decisão D26), como store externa: o mesmo
 * desenho de `useAudioPrefs`, para o servidor renderizar o padrão sem divergir na hidratação.
 */
const EMPTY: UserVolumes = {};
let cache: UserVolumes | null = null;
const listeners = new Set<() => void>();

function getSnapshot(): UserVolumes {
  if (cache === null) {
    try {
      cache = parseUserVolumes(window.localStorage.getItem(USER_VOLUMES_STORAGE_KEY));
    } catch {
      cache = EMPTY;
    }
  }
  return cache;
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export type UseUserVolumes = {
  volumes: UserVolumes;
  setVolume: (userId: string, value: number) => void;
};

export function useUserVolumes(): UseUserVolumes {
  const volumes = useSyncExternalStore(subscribe, getSnapshot, () => EMPTY);
  const setVolume = useCallback((userId: string, value: number): void => {
    cache = withUserVolume(getSnapshot(), userId, value);
    try {
      window.localStorage.setItem(USER_VOLUMES_STORAGE_KEY, JSON.stringify(cache));
    } catch {
      // Sem localStorage (aba privada, disco cheio) o ajuste vale só nesta sessão.
    }
    for (const listener of listeners) listener();
  }, []);
  return { volumes, setVolume };
}
