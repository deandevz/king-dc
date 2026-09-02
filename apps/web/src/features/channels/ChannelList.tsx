'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { JSX } from 'react';
import type { ChannelWithPresence, PresenceParticipant } from '@kingdc/contracts';
import { Avatar, Icon, cx } from '@/ui';
import { useApp } from '@/features/shell/AppContext';
import styles from './ChannelList.module.css';

const SKELETON_ROWS = 4;

function ParticipantRow({
  person,
  isMe,
}: {
  person: PresenceParticipant;
  isMe: boolean;
}): JSX.Element {
  return (
    <li className={styles.person}>
      <Avatar
        userId={person.userId}
        nickname={person.nickname}
        avatarUrl={person.avatarUrl}
        size={22}
        muted={person.micMuted}
      />
      <span className={cx(styles.personName, person.micMuted && styles.personMuted)}>
        {person.nickname}
      </span>
      {isMe ? <span className={styles.youTag}>você</span> : null}
      {person.micMuted ? (
        <Icon name="micOff" size={14} className={styles.mutedIcon} aria-label="Microfone mudo" />
      ) : null}
      {person.screenSharing ? (
        <Icon name="screen" size={14} className={styles.sharingIcon} aria-label="Compartilhando tela" />
      ) : null}
    </li>
  );
}

function ChannelRow({ channel }: { channel: ChannelWithPresence }): JSX.Element {
  const pathname = usePathname();
  const { me, activeSlug, selectChannel } = useApp();
  const viewing = pathname === `/app/c/${channel.slug}`;
  const inCall = activeSlug === channel.slug;
  const count = channel.participants.length;

  return (
    <li>
      <Link
        href={`/app/c/${channel.slug}`}
        className={cx(styles.channel, viewing && styles.viewing, inCall && styles.inCall)}
        aria-current={viewing ? 'page' : undefined}
        onClick={(event) => {
          event.preventDefault();
          selectChannel(channel.slug);
        }}
      >
        <Icon name="channel" size={17} className={styles.channelIcon} />
        <span className={styles.channelName}>{channel.name}</span>
        {count > 0 ? <span className={styles.count}>{count}</span> : null}
      </Link>

      {count > 0 ? (
        <ul className={styles.people}>
          {channel.participants.map((person) => (
            <ParticipantRow key={person.userId} person={person} isMe={person.userId === me.id} />
          ))}
        </ul>
      ) : null}
    </li>
  );
}

export function ChannelList(): JSX.Element {
  const { channels, channelsLoading } = useApp();

  if (channelsLoading) {
    return (
      <ul className={styles.list} aria-busy="true" aria-label="Carregando canais">
        {Array.from({ length: SKELETON_ROWS }, (_unused, index) => (
          <li key={index} className={styles.skeleton} />
        ))}
      </ul>
    );
  }

  if (channels.length === 0) {
    return <p className={styles.empty}>Nenhum canal ainda.</p>;
  }

  return (
    <ul className={styles.list}>
      {channels.map((channel) => (
        <ChannelRow key={channel.id} channel={channel} />
      ))}
    </ul>
  );
}
