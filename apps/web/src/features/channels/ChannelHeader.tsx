'use client';

import type { JSX } from 'react';
import { Badge, Icon } from '@/ui';
import { useApp } from '@/features/shell/AppContext';
import styles from './ChannelHeader.module.css';

export type ChannelHeaderProps = {
  name: string;
  connected?: boolean;
  /** `null` esconde o contador (usado fora de um canal). */
  participantCount?: number | null;
};

/** Header de 64px do painel de conteúdo (Main.dc.html:132, Call.dc.html:124). */
export function ChannelHeader({
  name,
  connected = false,
  participantCount = null,
}: ChannelHeaderProps): JSX.Element {
  const { me, openInvite } = useApp();

  return (
    <header className={styles.header}>
      <Icon name="channel" size={18} className={styles.icon} />
      <h1 className={styles.title}>{name}</h1>
      {connected ? <Badge dot>Conectado</Badge> : null}
      <span className={styles.spacer} />

      {participantCount !== null ? (
        <span className={styles.people}>
          <Icon name="people" size={16} />
          {participantCount}
        </span>
      ) : null}

      {/* Só admin convida (decisão D21). */}
      {me.isAdmin ? (
        <button type="button" className={styles.invite} onClick={openInvite}>
          <Icon name="invite" size={16} className={styles.inviteIcon} />
          Convidar
        </button>
      ) : null}
    </header>
  );
}
