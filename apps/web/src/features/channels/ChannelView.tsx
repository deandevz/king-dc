'use client';

import { useCallback } from 'react';
import type { JSX } from 'react';
import type { PresenceParticipant } from '@kingdc/contracts';
import { CallRoom } from '@/call';
import { createChannelToken } from '@/lib/api';
import { findChannel, useApp } from '@/features/shell/AppContext';
import { ChannelHeader } from './ChannelHeader';
import { WaitingRoom } from './WaitingRoom';
import styles from './ChannelView.module.css';

/**
 * Um canal na mesma rota em dois estados: sala de espera enquanto `idle`,
 * `CallRoom` do módulo `@/call` enquanto conectado. Entrar e sair não troca de rota.
 */
export function ChannelView({ slug }: { slug: string }): JSX.Element {
  const {
    me,
    channels,
    channelsLoading,
    activeSlug,
    connection,
    audioPrefs,
    join,
    leave,
    reportParticipants,
    setConnection,
    openSettings,
  } = useApp();

  const channel = findChannel(channels, slug);
  const inCall = activeSlug === slug;

  const getToken = useCallback(() => createChannelToken(slug), [slug]);
  const handleParticipants = useCallback(
    (participants: PresenceParticipant[]) => reportParticipants(slug, participants),
    [reportParticipants, slug],
  );

  if (channel === undefined) {
    return (
      <>
        <ChannelHeader name={channelsLoading ? 'Carregando…' : 'Canal não encontrado'} />
        <div className={styles.body}>
          <p className={styles.missing}>
            {channelsLoading ? 'Buscando os canais…' : 'Esse canal não existe mais.'}
          </p>
        </div>
      </>
    );
  }

  return (
    <>
      <ChannelHeader
        name={channel.name}
        connected={inCall && connection === 'connected'}
        participantCount={channel.participants.length}
      />
      <div className={styles.body}>
        {inCall ? (
          <CallRoom
            channel={{ slug: channel.slug, name: channel.name }}
            me={{ id: me.id, nickname: me.nickname, avatarUrl: me.avatarUrl }}
            getToken={getToken}
            audioPrefs={audioPrefs}
            onLeave={leave}
            onConnectionChange={setConnection}
            onOpenSettings={openSettings}
            onParticipantsChange={handleParticipants}
          />
        ) : (
          <WaitingRoom channel={channel} onJoin={() => join(slug)} />
        )}
      </div>
    </>
  );
}
