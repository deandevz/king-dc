'use client';

import type { JSX } from 'react';
import type { ChannelWithPresence, PresenceParticipant } from '@kingdc/contracts';
import { Avatar, Button, Icon } from '@/ui';
import styles from './WaitingRoom.module.css';

function summary(participants: PresenceParticipant[]): string {
  const sharing = participants.find((person) => person.screenSharing);
  const people =
    participants.length === 1 ? '1 pessoa na sala' : `${participants.length} pessoas na sala`;
  const screen =
    sharing === undefined ? 'ninguém compartilhando tela' : `${sharing.nickname} está compartilhando a tela`;
  return `${people} · ${screen}`;
}

function BigAvatar({ person }: { person: PresenceParticipant }): JSX.Element {
  const badge = person.deafened
    ? 'deafened'
    : person.micMuted
      ? 'muted'
      : person.screenSharing
        ? 'sharing'
        : null;

  return (
    <li className={styles.person}>
      <span className={styles.avatarSlot}>
        <Avatar
          userId={person.userId}
          nickname={person.nickname}
          avatarUrl={person.avatarUrl}
          size={88}
          muted={person.micMuted}
        />
        {badge !== null ? (
          <span className={badge === 'sharing' ? styles.badgeSharing : styles.badgeMuted}>
            <Icon
              name={badge === 'deafened' ? 'headphonesOff' : badge === 'muted' ? 'micOff' : 'screen'}
              size={13}
            />
          </span>
        ) : null}
      </span>
      <span className={styles.personName}>{person.nickname}</span>
    </li>
  );
}

export type WaitingRoomProps = {
  channel: ChannelWithPresence;
  onJoin: () => void;
};

/** Sala de espera: quem já está no canal e o botão de entrar (Main.dc.html:150-193). */
export function WaitingRoom({ channel, onJoin }: WaitingRoomProps): JSX.Element {
  const empty = channel.participants.length === 0;

  return (
    <div className={styles.room}>
      <div className={styles.intro}>
        <h2 className={styles.title}>{channel.name}</h2>
        <p className={styles.subtitle}>
          {empty ? 'Ninguém aqui ainda. Seja o primeiro a entrar.' : summary(channel.participants)}
        </p>
      </div>

      {empty ? null : (
        <ul className={styles.people}>
          {channel.participants.map((person) => (
            <BigAvatar key={person.userId} person={person} />
          ))}
        </ul>
      )}

      <Button pill className={styles.join} onClick={onJoin}>
        <Icon name="mic" size={18} strokeWidth={1.8} />
        Entrar no canal
      </Button>
    </div>
  );
}
