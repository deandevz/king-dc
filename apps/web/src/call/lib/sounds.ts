import { Track } from 'livekit-client';

/** Nome do arquivo em `apps/web/public/sounds/<nome>.mp3` (decisão D25). */
export type CallSound =
  | 'mutar'
  | 'desmutar'
  | 'mute-fone'
  | 'desmute-fone'
  | 'tela-inicio'
  | 'tela-fim'
  | 'entrou'
  | 'saiu';

export function micSound(enabled: boolean): CallSound {
  return enabled ? 'desmutar' : 'mutar';
}

export function deafSound(deafened: boolean): CallSound {
  return deafened ? 'mute-fone' : 'desmute-fone';
}

/**
 * Som de uma publicação de track entrando ou saindo da sala. Só a tela em si conta: o
 * áudio dela é outra publicação e tocaria o som duas vezes.
 */
export function shareSound(source: Track.Source, published: boolean): CallSound | null {
  if (source !== Track.Source.ScreenShare) return null;
  return published ? 'tela-inicio' : 'tela-fim';
}

/**
 * Toca no dispositivo de saída escolhido, no volume geral. Falha de autoplay ou de
 * `setSinkId` (Firefox não tem) só silencia o som: nunca pode quebrar a call.
 */
export function playSound(sound: CallSound, volume: number, sinkId: string | null): void {
  const audio = new Audio(`/sounds/${sound}.mp3`);
  audio.volume = Math.min(1, Math.max(0, volume));
  const routed =
    sinkId !== null && typeof audio.setSinkId === 'function'
      ? audio.setSinkId(sinkId).catch(() => undefined)
      : Promise.resolve();
  void routed.then(() => audio.play()).catch(() => undefined);
}
