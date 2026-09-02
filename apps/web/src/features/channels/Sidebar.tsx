'use client';

import type { JSX } from 'react';
import { Icon } from '@/ui';
import { useApp } from '@/features/shell/AppContext';
import { ChannelList } from './ChannelList';
import { UserDock } from './UserDock';
import styles from './Sidebar.module.css';

/** Coluna esquerda de 260px: marca, canais com presença e dock do usuário. */
export function Sidebar(): JSX.Element {
  const { onlineCount, stale } = useApp();

  return (
    <aside className={styles.sidebar}>
      <header className={styles.header}>
        <span className={styles.logo}>
          <Icon name="brand" size={18} />
        </span>
        <div className={styles.identity}>
          <span className={styles.name}>King DC</span>
          <span className={styles.online}>
            <span className={styles.dot} />
            {onlineCount} online
          </span>
        </div>
      </header>

      <div className={styles.list}>
        <span className={styles.sectionLabel}>Canais de voz</span>
        <ChannelList />
        {stale ? (
          <span className={styles.stale} role="status">
            Presença pode estar desatualizada.
          </span>
        ) : null}
      </div>

      <UserDock />
    </aside>
  );
}
