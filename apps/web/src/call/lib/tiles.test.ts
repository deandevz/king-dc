import { describe, expect, it } from 'vitest';
import { buildTiles, resolveFocusedShare } from './tiles';
import type { TileSource } from './tiles';

function source(identity: string, isLocal = false): TileSource {
  return {
    identity,
    name: identity,
    metadata: JSON.stringify({ nickname: identity, avatarUrl: null }),
    isLocal,
  };
}

describe('buildTiles', () => {
  it('mantém a ordem do LiveKit e joga o participante local para o fim', () => {
    const tiles = buildTiles([source('eu', true), source('a'), source('b')], []);
    expect(tiles.map((tile) => tile.identity)).toEqual(['a', 'b', 'eu']);
    expect(tiles[2]?.isLocal).toBe(true);
  });

  it('marca quem está compartilhando a tela', () => {
    const tiles = buildTiles([source('a'), source('b')], ['b']);
    expect(tiles.map((tile) => tile.isSharing)).toEqual([false, true]);
  });

  it('resolve nick e avatar pelo metadata de cada participante', () => {
    const withPhoto: TileSource = {
      identity: 'u1',
      name: 'fallback',
      metadata: JSON.stringify({ nickname: 'lele', avatarUrl: '/avatars/u1.webp' }),
      isLocal: false,
    };
    const tiles = buildTiles([withPhoto], []);
    expect(tiles[0]).toMatchObject({ nickname: 'lele', avatarUrl: '/avatars/u1.webp' });
  });

  it('devolve lista vazia sem participantes', () => {
    expect(buildTiles([], ['sid'])).toEqual([]);
  });
});

describe('resolveFocusedShare', () => {
  it('mantém em foco a tela escolhida enquanto ela existir', () => {
    expect(resolveFocusedShare(['s1', 's2'], 's2')).toBe('s2');
  });

  it('cai para a primeira tela viva quando a escolhida sai do ar', () => {
    expect(resolveFocusedShare(['s2', 's3'], 's1')).toBe('s2');
  });

  it('sem escolha, foca a primeira disponível', () => {
    expect(resolveFocusedShare(['s7'], null)).toBe('s7');
  });

  it('sem tela nenhuma, não há foco e a área volta para a grade', () => {
    expect(resolveFocusedShare([], 's1')).toBeNull();
    expect(resolveFocusedShare([], null)).toBeNull();
  });
});
