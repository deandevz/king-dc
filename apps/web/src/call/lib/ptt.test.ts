import { describe, expect, it } from 'vitest';
import { isTypingTarget, shouldStartTalking, shouldStopTalking } from './ptt';
import type { PttKeyEvent } from './ptt';

const KEY = 'Backquote';

function event(overrides: Partial<PttKeyEvent> = {}): PttKeyEvent {
  return {
    code: KEY,
    repeat: false,
    target: document.body,
    ctrlKey: false,
    metaKey: false,
    altKey: false,
    ...overrides,
  };
}

describe('isTypingTarget', () => {
  it('reconhece campos de texto e conteúdo editável', () => {
    const input = document.createElement('input');
    const textarea = document.createElement('textarea');
    const editable = document.createElement('div');
    editable.setAttribute('contenteditable', 'true');
    expect(isTypingTarget(input)).toBe(true);
    expect(isTypingTarget(textarea)).toBe(true);
    expect(isTypingTarget(editable)).toBe(true);
  });

  it('não confunde o corpo da página com um campo', () => {
    expect(isTypingTarget(document.body)).toBe(false);
    expect(isTypingTarget(null)).toBe(false);
  });
});

describe('shouldStartTalking', () => {
  it('abre o microfone na tecla configurada', () => {
    expect(shouldStartTalking(event(), KEY)).toBe(true);
  });

  it('ignora outra tecla', () => {
    expect(shouldStartTalking(event({ code: 'KeyA' }), KEY)).toBe(false);
  });

  it('ignora o auto-repeat do teclado', () => {
    expect(shouldStartTalking(event({ repeat: true }), KEY)).toBe(false);
  });

  it('ignora a tecla enquanto o foco está num campo', () => {
    const input = document.createElement('input');
    expect(shouldStartTalking(event({ target: input }), KEY)).toBe(false);
  });

  it('ignora combinações com modificador', () => {
    expect(shouldStartTalking(event({ ctrlKey: true }), KEY)).toBe(false);
    expect(shouldStartTalking(event({ metaKey: true }), KEY)).toBe(false);
    expect(shouldStartTalking(event({ altKey: true }), KEY)).toBe(false);
  });

  it('respeita uma tecla diferente nas preferências', () => {
    expect(shouldStartTalking(event({ code: 'ShiftLeft' }), 'ShiftLeft')).toBe(true);
  });
});

describe('shouldStopTalking', () => {
  it('fecha o microfone ao soltar a tecla, mesmo com o foco em um campo', () => {
    expect(shouldStopTalking({ code: KEY }, KEY)).toBe(true);
  });

  it('não fecha com outra tecla', () => {
    expect(shouldStopTalking({ code: 'KeyB' }, KEY)).toBe(false);
  });
});
