import { describe, expect, it } from 'vitest';
import { parseParticipantProfile } from './metadata';

describe('parseParticipantProfile', () => {
  it('lê nick e avatar do metadata do token', () => {
    const metadata = JSON.stringify({ nickname: 'lele', avatarUrl: '/avatars/u1.webp?v=9' });
    expect(parseParticipantProfile(metadata, 'ignorado', 'u1')).toEqual({
      nickname: 'lele',
      avatarUrl: '/avatars/u1.webp?v=9',
    });
  });

  it('cai no name do participante quando não há metadata', () => {
    expect(parseParticipantProfile(undefined, 'tonhão', 'u2')).toEqual({
      nickname: 'tonhão',
      avatarUrl: null,
    });
  });

  it('cai na identidade quando não há metadata nem name', () => {
    expect(parseParticipantProfile('', '   ', 'u3')).toEqual({
      nickname: 'u3',
      avatarUrl: null,
    });
  });

  it('não quebra com JSON inválido', () => {
    expect(parseParticipantProfile('{isso não é json', 'duda', 'u4').nickname).toBe('duda');
  });

  it('ignora campos de outro tipo e JSON que não é objeto', () => {
    const wrongTypes = JSON.stringify({ nickname: 42, avatarUrl: false });
    expect(parseParticipantProfile(wrongTypes, 'vitão', 'u5')).toEqual({
      nickname: 'vitão',
      avatarUrl: null,
    });
    expect(parseParticipantProfile('["lele"]', 'rafa', 'u6').nickname).toBe('rafa');
  });

  it('trata avatar vazio como ausência de foto', () => {
    const metadata = JSON.stringify({ nickname: 'mari', avatarUrl: '  ' });
    expect(parseParticipantProfile(metadata, undefined, 'u7').avatarUrl).toBeNull();
  });
});
