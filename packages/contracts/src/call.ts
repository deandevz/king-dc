import { z } from 'zod';
import { DEFAULT_PTT_KEY } from './constants.js';
import type { ChannelTokenResponse, PresenceParticipant } from './channels.js';

/** Preferências de áudio, guardadas só no localStorage do browser (decisão D10). */
export const audioPrefsSchema = z.object({
  // '' (option "Padrão" do select ou id vazio antes da permissão) vira null.
  inputDeviceId: z.string().min(1).nullable().catch(null),
  outputDeviceId: z.string().min(1).nullable().catch(null),
  outputVolume: z.number().min(0).max(1),
  inputMode: z.enum(['vad', 'ptt']),
  pttKey: z.string().min(1),
});
export type AudioPrefs = z.infer<typeof audioPrefsSchema>;

export const DEFAULT_AUDIO_PREFS: AudioPrefs = {
  inputDeviceId: null,
  outputDeviceId: null,
  outputVolume: 1,
  inputMode: 'vad',
  pttKey: DEFAULT_PTT_KEY,
};

/** Estados de conexão que a sala reporta para fora. */
export const callConnectionStates = [
  'connecting',
  'connected',
  'reconnecting',
  'disconnected',
] as const;
export const callConnectionStateSchema = z.enum(callConnectionStates);
export type CallConnectionState = z.infer<typeof callConnectionStateSchema>;

/**
 * Interface congelada do módulo `call/`. Tipo puro, sem JSX, para que o
 * pacote de contratos não dependa de React.
 */
export type CallRoomProps = {
  channel: { slug: string; name: string };
  me: { id: string; nickname: string; avatarUrl: string | null };
  getToken: () => Promise<ChannelTokenResponse>;
  audioPrefs: AudioPrefs;
  onLeave: () => void;
  onConnectionChange: (state: CallConnectionState) => void;
  onOpenSettings: () => void;
  /**
   * Lista de quem está na sala, no mesmo shape da presença da API, a cada mudança:
   * entrou, saiu, mutou, começou/parou de compartilhar tela ou trocou o perfil. Inclui o
   * participante local. É o que deixa a sidebar do canal atual em tempo real.
   */
  onParticipantsChange?: (participants: PresenceParticipant[]) => void;
};

/** Retorno de `useMicTest`, usado pelo modal de configurações fora de uma sala. */
export type MicTest = {
  level: number;
  start: () => void;
  stop: () => void;
};
