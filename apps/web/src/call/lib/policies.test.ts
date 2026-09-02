import { describe, expect, it } from 'vitest';
import { DisconnectReason } from 'livekit-client';
import {
  micEnabledAfterDeafChange,
  micEnabledForMode,
  remoteVolume,
  shouldRenewAfterDisconnect,
} from './policies';

describe('remoteVolume', () => {
  it('zera todo mundo enquanto ensurdecido', () => {
    expect(remoteVolume(true, 0.8)).toBe(0);
  });

  it('usa o volume de saída das preferências fora do deaf', () => {
    expect(remoteVolume(false, 0.35)).toBe(0.35);
  });

  it('prende o volume em 0..1 e ignora valor inválido', () => {
    expect(remoteVolume(false, 4)).toBe(1);
    expect(remoteVolume(false, -2)).toBe(0);
    expect(remoteVolume(false, Number.NaN)).toBe(1);
  });
});

describe('micEnabledAfterDeafChange', () => {
  it('ensurdecer muta o microfone em qualquer modo', () => {
    expect(micEnabledAfterDeafChange(true, 'vad')).toBe(false);
    expect(micEnabledAfterDeafChange(true, 'ptt')).toBe(false);
  });

  it('desensurdecer religa o microfone, menos em push-to-talk', () => {
    expect(micEnabledAfterDeafChange(false, 'vad')).toBe(true);
    expect(micEnabledAfterDeafChange(false, 'ptt')).toBe(false);
  });
});

describe('micEnabledForMode', () => {
  it('entra com microfone ligado em detecção de voz e desligado em push-to-talk', () => {
    expect(micEnabledForMode('vad')).toBe(true);
    expect(micEnabledForMode('ptt')).toBe(false);
  });
});

describe('shouldRenewAfterDisconnect', () => {
  it('renova e reconecta em queda transitória ou sem motivo', () => {
    expect(shouldRenewAfterDisconnect(undefined)).toBe(true);
    expect(shouldRenewAfterDisconnect(DisconnectReason.UNKNOWN_REASON)).toBe(true);
    expect(shouldRenewAfterDisconnect(DisconnectReason.SIGNAL_CLOSE)).toBe(true);
    expect(shouldRenewAfterDisconnect(DisconnectReason.JOIN_FAILURE)).toBe(true);
    expect(shouldRenewAfterDisconnect(DisconnectReason.SERVER_SHUTDOWN)).toBe(true);
  });

  it('não reconecta quando outra aba assumiu a identidade ou a sala acabou', () => {
    expect(shouldRenewAfterDisconnect(DisconnectReason.DUPLICATE_IDENTITY)).toBe(false);
    expect(shouldRenewAfterDisconnect(DisconnectReason.PARTICIPANT_REMOVED)).toBe(false);
    expect(shouldRenewAfterDisconnect(DisconnectReason.ROOM_DELETED)).toBe(false);
    expect(shouldRenewAfterDisconnect(DisconnectReason.CLIENT_INITIATED)).toBe(false);
  });
});
