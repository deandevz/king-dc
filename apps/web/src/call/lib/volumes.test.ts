import { describe, expect, it } from 'vitest';
import { parseUserVolumes, userVolume, volumeLabel, withUserVolume } from './volumes';

describe('parseUserVolumes', () => {
  it('lê o mapa gravado', () => {
    expect(parseUserVolumes('{"u1":0.4}')).toEqual({ u1: 0.4 });
  });

  it('vira mapa vazio sem valor, com JSON quebrado ou fora de 0..1', () => {
    expect(parseUserVolumes(null)).toEqual({});
    expect(parseUserVolumes('{')).toEqual({});
    expect(parseUserVolumes('{"u1":1.5}')).toEqual({});
    expect(parseUserVolumes('[1]')).toEqual({});
  });
});

describe('userVolume', () => {
  it('quem não está no mapa fica em 1', () => {
    expect(userVolume({ u1: 0.2 }, 'u1')).toBe(0.2);
    expect(userVolume({ u1: 0.2 }, 'u2')).toBe(1);
  });
});

describe('withUserVolume', () => {
  it('grava preso em 0..1 sem mexer nos outros', () => {
    expect(withUserVolume({ u2: 0.5 }, 'u1', 0.3)).toEqual({ u1: 0.3, u2: 0.5 });
    expect(withUserVolume({}, 'u1', 7)).toEqual({});
    expect(withUserVolume({}, 'u1', -1)).toEqual({ u1: 0 });
    expect(withUserVolume({}, 'u1', Number.NaN)).toEqual({});
  });

  it('voltar para 1 apaga a entrada', () => {
    expect(withUserVolume({ u1: 0.3, u2: 0.5 }, 'u1', 1)).toEqual({ u2: 0.5 });
  });
});

describe('volumeLabel', () => {
  it('mostra porcentagem inteira', () => {
    expect(volumeLabel(0.357)).toBe('36%');
    expect(volumeLabel(1)).toBe('100%');
  });
});
