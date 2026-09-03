import { DisconnectReason } from 'livekit-client';
import type { AudioPrefs } from '../types';

/**
 * Volume aplicado a um participante remoto. Ensurdecido zera tudo (decisão D9); fora disso
 * é o volume de saída das preferências vezes o volume individual (decisão D26), preso em 0..1.
 */
export function remoteVolume(deafened: boolean, outputVolume: number, userVolume = 1): number {
  if (deafened) return 0;
  const output = Number.isFinite(outputVolume) ? outputVolume : 1;
  return Math.min(1, Math.max(0, output * userVolume));
}

/**
 * Ensurdecer muta o microfone; desensurdecer religa, exceto em push-to-talk, onde o mic só
 * abre segurando a tecla (decisão D9).
 */
export function micEnabledAfterDeafChange(
  nextDeafened: boolean,
  mode: AudioPrefs['inputMode'],
): boolean {
  return nextDeafened ? false : micEnabledForMode(mode);
}

/** Estado do microfone ao entrar na sala e ao trocar de modo (decisão D12). */
export function micEnabledForMode(mode: AudioPrefs['inputMode']): boolean {
  return mode === 'vad';
}

/** Quedas em que a sala não volta sozinha: outra aba com a mesma identidade, remoção, sala fechada. */
const FINAL_DISCONNECTS = new Set<DisconnectReason>([
  DisconnectReason.CLIENT_INITIATED,
  DisconnectReason.DUPLICATE_IDENTITY,
  DisconnectReason.PARTICIPANT_REMOVED,
  DisconnectReason.ROOM_DELETED,
  DisconnectReason.ROOM_CLOSED,
]);

/**
 * Depois de uma queda, pegar token novo e reconectar só faz sentido se a causa for
 * transitória (rede, servidor, token vencido). Com `DUPLICATE_IDENTITY`, reconectar
 * derrubaria a outra aba e as duas ficariam se expulsando para sempre.
 */
export function shouldRenewAfterDisconnect(reason: DisconnectReason | undefined): boolean {
  return reason === undefined || !FINAL_DISCONNECTS.has(reason);
}
