import { describe, expect, test } from 'vitest';
import { samePresenceList, toPresenceList } from './presence';
import type { PresenceSource } from './presence';

function source(identity: string, overrides: Partial<PresenceSource> = {}): PresenceSource {
  return {
    identity,
    name: undefined,
    metadata: undefined,
    micMuted: false,
    screenSharing: false,
    ...overrides,
  };
}

describe('toPresenceList', () => {
  test('lê nick e foto do metadata do token', () => {
    const list = toPresenceList([
      source('u1', {
        metadata: JSON.stringify({ nickname: 'lele', avatarUrl: '/avatars/u1.webp?v=1' }),
        micMuted: true,
        screenSharing: true,
      }),
    ]);

    expect(list).toEqual([
      {
        userId: 'u1',
        nickname: 'lele',
        avatarUrl: '/avatars/u1.webp?v=1',
        micMuted: true,
        screenSharing: true,
      },
    ]);
  });

  test('sem metadata cai no nome e depois na identidade', () => {
    const list = toPresenceList([source('u1', { name: 'tonhão' }), source('u2')]);

    expect(list.map((person) => person.nickname)).toEqual(['tonhão', 'u2']);
    expect(list.every((person) => person.avatarUrl === null)).toBe(true);
  });

  test('a ordem é estável por userId, não pela ordem do LiveKit', () => {
    const first = toPresenceList([source('b'), source('a'), source('c')]);
    const second = toPresenceList([source('c'), source('b'), source('a')]);

    expect(first.map((person) => person.userId)).toEqual(['a', 'b', 'c']);
    expect(second).toEqual(first);
  });
});

describe('samePresenceList', () => {
  test('ignora listas idênticas e pega qualquer campo diferente', () => {
    const base = toPresenceList([source('u1'), source('u2')]);

    expect(samePresenceList(base, toPresenceList([source('u2'), source('u1')]))).toBe(true);
    expect(samePresenceList(base, toPresenceList([source('u1', { micMuted: true }), source('u2')]))).toBe(false);
    expect(samePresenceList(base, toPresenceList([source('u1')]))).toBe(false);
    expect(
      samePresenceList(base, toPresenceList([source('u1'), source('u2', { screenSharing: true })])),
    ).toBe(false);
  });
});
