import { parseParticipantProfile } from './metadata';

/** O mínimo que a redução precisa de um participante do LiveKit. */
export type TileSource = {
  identity: string;
  name: string | undefined;
  metadata: string | undefined;
  isLocal: boolean;
};

/** Descritor de um tile. Falar e mutar são lidos por hook dentro do próprio tile. */
export type CallTile = {
  identity: string;
  nickname: string;
  avatarUrl: string | null;
  isLocal: boolean;
  isSharing: boolean;
};

/**
 * Participantes → tiles, na ordem em que o LiveKit entrega, com o local sempre por
 * último (é assim no artboard: "bruce · você" fecha a faixa).
 */
export function buildTiles(
  sources: readonly TileSource[],
  sharingIdentities: readonly string[],
): CallTile[] {
  const sharing = new Set(sharingIdentities);
  const tiles = sources.map((source) => {
    const profile = parseParticipantProfile(source.metadata, source.name, source.identity);
    return {
      identity: source.identity,
      nickname: profile.nickname,
      avatarUrl: profile.avatarUrl,
      isLocal: source.isLocal,
      isSharing: sharing.has(source.identity),
    };
  });
  return [...tiles.filter((tile) => !tile.isLocal), ...tiles.filter((tile) => tile.isLocal)];
}

/**
 * Tela em foco: a escolhida enquanto ela existir, senão a primeira que ainda estiver no
 * ar. Sem nenhuma tela, devolve `null` e a área volta para a grade de avatares.
 */
export function resolveFocusedShare(
  liveSids: readonly string[],
  selected: string | null,
): string | null {
  if (selected !== null && liveSids.includes(selected)) return selected;
  return liveSids[0] ?? null;
}
