'use client';

import type { JSX } from 'react';
import { Icon } from '@/ui';
import { ChannelHeader } from './ChannelHeader';
import styles from './NoChannel.module.css';

/** Estado inicial de `/app`: ainda não há canal escolhido (decisão D20). */
export function NoChannel(): JSX.Element {
  return (
    <>
      <ChannelHeader name="King DC" />
      <div className={styles.body}>
        <Icon name="channel" size={28} className={styles.icon} />
        <h2 className={styles.title}>Escolha um canal</h2>
        <p className={styles.subtitle}>
          Clique num canal da lista para ver quem está lá e entrar na conversa.
        </p>
      </div>
    </>
  );
}
