'use client';

import { Suspense, useCallback, useMemo, useState } from 'react';
import type { JSX } from 'react';
import { notFound, useSearchParams } from 'next/navigation';
import { CallRoom, DEFAULT_AUDIO_PREFS } from '@/call';
import type { AudioPrefs, CallConnectionState } from '@/call';
import styles from './page.module.css';

const ENABLED =
  process.env.NODE_ENV !== 'production' || process.env.NEXT_PUBLIC_DEV_CALL === '1';

function DevCall(): JSX.Element {
  const params = useSearchParams();
  const url = params.get('url') ?? '';
  const token = params.get('token') ?? '';
  const nick = params.get('nick') ?? 'dev';
  const mode: AudioPrefs['inputMode'] = params.get('mode') === 'ptt' ? 'ptt' : 'vad';
  const [connection, setConnection] = useState<CallConnectionState>('connecting');

  const audioPrefs = useMemo<AudioPrefs>(
    () => ({ ...DEFAULT_AUDIO_PREFS, inputMode: mode }),
    [mode],
  );
  const getToken = useCallback(
    async () => ({
      token,
      url,
      expiresAt: new Date(Date.now() + 6 * 60 * 60 * 1000).toISOString(),
    }),
    [token, url],
  );

  return (
    <main className={styles.page}>
      <span className={styles.state} data-testid="dev-connection">
        {connection}
      </span>
      <CallRoom
        channel={{ slug: 'dev', name: 'Dev' }}
        me={{ id: nick, nickname: nick, avatarUrl: null }}
        getToken={getToken}
        audioPrefs={audioPrefs}
        onLeave={() => setConnection('disconnected')}
        onConnectionChange={setConnection}
        onOpenSettings={() => undefined}
      />
    </main>
  );
}

/** Página só de teste: serve ao e2e real e à revisão manual. Fora do dev, não existe. */
export default function DevCallPage(): JSX.Element {
  if (!ENABLED) notFound();
  return (
    <Suspense fallback={<main className={styles.page} />}>
      <DevCall />
    </Suspense>
  );
}
