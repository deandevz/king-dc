import { describe, expect, it } from 'vitest';
import { pttKeyLabel } from './pttLabel';

describe('pttKeyLabel', () => {
  it('traduz os códigos com nome próprio', () => {
    expect(pttKeyLabel('Backquote')).toBe('`');
    expect(pttKeyLabel('Space')).toBe('Espaço');
    expect(pttKeyLabel('ControlLeft')).toBe('Ctrl esq.');
    expect(pttKeyLabel('ShiftRight')).toBe('Shift dir.');
    expect(pttKeyLabel('BracketLeft')).toBe('[');
  });

  it('reduz letras, dígitos, teclado numérico e F1..F12 ao caractere', () => {
    expect(pttKeyLabel('KeyV')).toBe('V');
    expect(pttKeyLabel('Digit3')).toBe('3');
    expect(pttKeyLabel('Numpad7')).toBe('Num 7');
    expect(pttKeyLabel('F12')).toBe('F12');
  });

  it('devolve o código cru quando não conhece', () => {
    expect(pttKeyLabel('IntlBackslash')).toBe('IntlBackslash');
    expect(pttKeyLabel('')).toBe('');
  });
});
