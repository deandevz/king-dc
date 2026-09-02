'use client';

import { createContext, useContext } from 'react';
import type { ChannelWithPresence, Me, PresenceParticipant } from '@kingdc/contracts';
import type { AudioPrefs, CallConnectionState } from '@/call';

export type AppState = {
  /** Usuário logado com nick garantido: sem nick o app manda para o onboarding. */
  me: Me & { nickname: string };
  /** Presença do polling com a sala do canal conectado por cima (`presenceOverlay`). */
  channels: ChannelWithPresence[];
  onlineCount: number;
  /** Presença velha: o LiveKit não respondeu (`X-Presence-Stale`) ou a própria API está fora. */
  stale: boolean;
  channelsLoading: boolean;
  /** Canal em que o usuário pediu para estar. `null` = fora de qualquer call. */
  activeSlug: string | null;
  connection: CallConnectionState;
  audioPrefs: AudioPrefs;
  updateAudioPrefs: (patch: Partial<AudioPrefs>) => void;
  selectChannel: (slug: string) => void;
  join: (slug: string) => void;
  leave: () => void;
  /** A `CallRoom` reporta quem está na sala; vale mais que o polling no canal conectado. */
  reportParticipants: (slug: string, participants: PresenceParticipant[]) => void;
  setConnection: (state: CallConnectionState) => void;
  openSettings: () => void;
  openInvite: () => void;
  refreshMe: () => Promise<void>;
};

const AppContext = createContext<AppState | null>(null);

export const AppContextProvider = AppContext.Provider;

export function useApp(): AppState {
  const state = useContext(AppContext);
  if (state === null) throw new Error('useApp precisa do AppShell acima.');
  return state;
}

/** Canal atual pelo slug da rota, ou `undefined` quando a rota não é de canal. */
export function findChannel(
  channels: ChannelWithPresence[],
  slug: string,
): ChannelWithPresence | undefined {
  return channels.find((channel) => channel.slug === slug);
}
