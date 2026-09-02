import { describe, expect, test } from 'vitest';
import type { ChannelWithPresence, PresenceParticipant } from '@kingdc/contracts';
import { applyPresenceOverlay, pollingListsUser } from './presenceOverlay';

function person(userId: string, overrides: Partial<PresenceParticipant> = {}): PresenceParticipant {
  return {
    userId,
    nickname: userId,
    avatarUrl: null,
    micMuted: false,
    deafened: false,
    screenSharing: false,
    ...overrides,
  };
}

function channel(slug: string, participants: PresenceParticipant[]): ChannelWithPresence {
  return { id: `ch-${slug}`, slug, name: slug, position: 0, participants };
}

const ME = person('me', { nickname: 'bruce', micMuted: true });

const OFF = { activeSlug: null, live: null, self: ME, hideSelf: false } as const;

describe('applyPresenceOverlay', () => {
  test('fora de call devolve o polling como veio', () => {
    const channels = [channel('geral', [person('u1')]), channel('jogos', [])];

    const result = applyPresenceOverlay(channels, OFF);

    expect(result.channels[0]?.participants).toEqual([person('u1')]);
    expect(result.onlineCount).toBe(1);
  });

  test('entrar mostra o próprio usuário antes do primeiro evento da sala', () => {
    const channels = [channel('geral', [person('u1')]), channel('jogos', [])];

    const result = applyPresenceOverlay(channels, { ...OFF, activeSlug: 'geral' });

    expect(result.channels[0]?.participants).toEqual([person('u1'), ME]);
    expect(result.onlineCount).toBe(2);
  });

  test('a lista da sala substitui a do polling no canal conectado', () => {
    const channels = [channel('geral', [person('u1'), person('u2')])];
    const live = [person('u1', { micMuted: true }), ME];

    const result = applyPresenceOverlay(channels, { ...OFF, activeSlug: 'geral', live });

    expect(result.channels[0]?.participants).toEqual(live);
    expect(result.onlineCount).toBe(2);
  });

  test('o polling não me duplica no canal antigo enquanto estou em outro', () => {
    const channels = [channel('geral', [person('u1'), ME]), channel('jogos', [])];

    const result = applyPresenceOverlay(channels, { ...OFF, activeSlug: 'jogos', live: [ME] });

    expect(result.channels[0]?.participants).toEqual([person('u1')]);
    expect(result.channels[1]?.participants).toEqual([ME]);
    expect(result.onlineCount).toBe(2);
  });

  test('sair me tira na hora, mesmo com o polling ainda me listando', () => {
    const channels = [channel('geral', [person('u1'), ME])];

    const result = applyPresenceOverlay(channels, { ...OFF, hideSelf: true });

    expect(result.channels[0]?.participants).toEqual([person('u1')]);
    expect(result.onlineCount).toBe(1);
  });

  test('o próprio usuário não entra duas vezes quando o polling já o traz', () => {
    const channels = [channel('geral', [person('u1'), person('me', { nickname: 'antigo' })])];

    const result = applyPresenceOverlay(channels, { ...OFF, activeSlug: 'geral' });

    expect(result.channels[0]?.participants).toEqual([person('u1'), ME]);
  });

  test('sem canal nenhum o contador é zero', () => {
    expect(applyPresenceOverlay([], { ...OFF, activeSlug: 'geral' })).toEqual({
      channels: [],
      onlineCount: 0,
    });
  });
});

describe('pollingListsUser', () => {
  test('acha o usuário em qualquer canal', () => {
    const channels = [channel('geral', []), channel('jogos', [person('me')])];

    expect(pollingListsUser(channels, 'me')).toBe(true);
    expect(pollingListsUser(channels, 'outro')).toBe(false);
  });
});
