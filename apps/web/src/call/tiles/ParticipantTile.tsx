'use client';

import type { JSX } from 'react';
import { Track } from 'livekit-client';
import type { Participant } from 'livekit-client';
import { useIsMuted, useIsSpeaking } from '@livekit/components-react';
import { Avatar, Icon, cx } from '@/ui';
import type { CallTile } from '../lib/tiles';
import { SpeakingBars } from './SpeakingBars';
import styles from './ParticipantTile.module.css';

export type ParticipantTileProps = {
  participant: Participant;
  tile: CallTile;
  /** `grid` é a coluna de 132 px da sala de espera; `strip` é o tile de 104 px da call. */
  variant: 'grid' | 'strip';
  onClick?: () => void;
};

export function ParticipantTile({
  participant,
  tile,
  variant,
  onClick,
}: ParticipantTileProps): JSX.Element {
  const speaking = useIsSpeaking(participant);
  const muted = useIsMuted({ participant, source: Track.Source.Microphone });
  const label = tile.isLocal ? `${tile.nickname} · você` : tile.nickname;
  const avatarSize = variant === 'grid' ? 88 : 44;

  const status = muted ? (
    <Icon name="micOff" size={variant === 'grid' ? 13 : 14} className={styles.muteIcon} />
  ) : tile.isSharing ? (
    <Icon name="screen" size={variant === 'grid' ? 13 : 14} className={styles.shareIcon} />
  ) : speaking ? (
    <SpeakingBars tall={variant === 'grid'} />
  ) : null;

  const content = (
    <>
      <span className={styles.avatarSlot}>
        <Avatar
          userId={tile.identity}
          nickname={tile.nickname}
          avatarUrl={tile.avatarUrl}
          size={avatarSize}
          speaking={speaking && !muted}
          muted={muted}
        />
        {variant === 'grid' && status !== null ? (
          <span className={cx(styles.badge, muted && styles.badgeMuted)}>{status}</span>
        ) : null}
      </span>
      <span className={styles.name}>{label}</span>
      {variant === 'strip' && status !== null ? (
        <span className={styles.status}>{status}</span>
      ) : null}
    </>
  );

  const className = cx(
    styles.tile,
    variant === 'grid' ? styles.grid : styles.strip,
    variant === 'strip' && speaking && !muted && styles.speaking,
    variant === 'strip' && tile.isSharing && !speaking && styles.sharing,
  );

  const flags = {
    'data-identity': tile.identity,
    'data-muted': String(muted),
    'data-speaking': String(speaking),
    'data-sharing': String(tile.isSharing),
  };

  if (onClick === undefined) {
    return (
      <div className={className} {...flags}>
        {content}
      </div>
    );
  }
  return (
    <button
      type="button"
      className={className}
      {...flags}
      onClick={onClick}
      aria-label={`Ver a tela de ${tile.nickname}`}
    >
      {content}
    </button>
  );
}
