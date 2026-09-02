import { describe, expect, it } from 'vitest';
import { Track } from 'livekit-client';
import { deafSound, micSound, shareSound } from './sounds';

describe('shareSound', () => {
  it('toca início e fim só para a tela em si', () => {
    expect(shareSound(Track.Source.ScreenShare, true)).toBe('tela-inicio');
    expect(shareSound(Track.Source.ScreenShare, false)).toBe('tela-fim');
  });

  it('ignora o áudio da tela e o microfone', () => {
    expect(shareSound(Track.Source.ScreenShareAudio, true)).toBeNull();
    expect(shareSound(Track.Source.Microphone, false)).toBeNull();
  });
});

describe('micSound e deafSound', () => {
  it('seguem o estado novo', () => {
    expect(micSound(false)).toBe('mutar');
    expect(micSound(true)).toBe('desmutar');
    expect(deafSound(true)).toBe('mute-fone');
    expect(deafSound(false)).toBe('desmute-fone');
  });
});
