'use client';

import type { JSX } from 'react';
import { Avatar, Icon, IconButton, cx } from '@/ui';
import { findChannel, useApp } from '@/features/shell/AppContext';
import styles from './UserDock.module.css';

const CONNECTED_STATES = new Set(['connecting', 'connected', 'reconnecting']);

/** Rodapé de 68px da sidebar: quem sou eu, onde estou e os atalhos (Main.dc.html:107). */
export function UserDock(): JSX.Element {
  const { me, channels, activeSlug, connection, openSettings } = useApp();

  const channel = activeSlug === null ? undefined : findChannel(channels, activeSlug);
  const inCall = activeSlug !== null && CONNECTED_STATES.has(connection);
  const status =
    channel !== undefined && inCall
      ? `${channel.name} · ${connection === 'connected' ? 'conectado' : 'conectando'}`
      : 'Online';

  return (
    <div className={styles.dock}>
      <span className={styles.avatarSlot}>
        <Avatar userId={me.id} nickname={me.nickname} avatarUrl={me.avatarUrl} size={34} />
        <span className={styles.presence} />
      </span>

      <div className={styles.identity}>
        <span className={styles.nick}>{me.nickname}</span>
        <span className={cx(styles.status, inCall && styles.statusInCall)} title={status}>
          {status}
        </span>
      </div>

      {/*
        O design põe mic e fone aqui, mas `CallRoomProps` não dá controle de microfone à
        shell: mudo e ensurdecer moram na barra da call. Botão morto seria
        pior que botão ausente, então o dock fica só com o atalho de configurações.
      */}
      <IconButton shape="square" label="Configurações" onClick={openSettings}>
        <Icon name="settings" size={17} />
      </IconButton>
    </div>
  );
}
