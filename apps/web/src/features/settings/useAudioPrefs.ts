'use client';

import { useCallback, useSyncExternalStore } from 'react';
import { audioPrefsSchema, AUDIO_PREFS_STORAGE_KEY, DEFAULT_AUDIO_PREFS } from '@kingdc/contracts';
import type { AudioPrefs } from '@/call';

/**
 * Preferências de áudio só no localStorage (decisão D10), como store externa: o servidor
 * renderiza o padrão e o browser troca pelo que está no disco na hidratação.
 */
let cache: AudioPrefs | null = null;
const listeners = new Set<() => void>();

function read(): AudioPrefs {
  try {
    const raw = window.localStorage.getItem(AUDIO_PREFS_STORAGE_KEY);
    if (raw === null) return DEFAULT_AUDIO_PREFS;
    const parsed = audioPrefsSchema.safeParse(JSON.parse(raw));
    return parsed.success ? parsed.data : DEFAULT_AUDIO_PREFS;
  } catch {
    return DEFAULT_AUDIO_PREFS;
  }
}

function getSnapshot(): AudioPrefs {
  if (cache === null) cache = read();
  return cache;
}

function getServerSnapshot(): AudioPrefs {
  return DEFAULT_AUDIO_PREFS;
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function writePrefs(patch: Partial<AudioPrefs>): void {
  cache = { ...getSnapshot(), ...patch };
  try {
    window.localStorage.setItem(AUDIO_PREFS_STORAGE_KEY, JSON.stringify(cache));
  } catch {
    // Sem localStorage (aba privada, disco cheio) as preferências valem só nesta sessão.
  }
  for (const listener of listeners) listener();
}

export type UseAudioPrefs = {
  prefs: AudioPrefs;
  update: (patch: Partial<AudioPrefs>) => void;
};

export function useAudioPrefs(): UseAudioPrefs {
  const prefs = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const update = useCallback((patch: Partial<AudioPrefs>) => writePrefs(patch), []);
  return { prefs, update };
}
