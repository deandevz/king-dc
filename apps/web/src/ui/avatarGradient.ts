import { AVATAR_GRADIENT_COUNT } from '@kingdc/contracts';

/**
 * Índice do gradiente do avatar sem foto (decisão D13): hash simples do id, mod 7.
 * Precisa ser determinístico entre abas e sessões, por isso não usa nada aleatório.
 */
export function avatarGradientIndex(userId: string): number {
  let hash = 0;
  for (let index = 0; index < userId.length; index += 1) {
    hash = (hash * 31 + userId.charCodeAt(index)) >>> 0;
  }
  return hash % AVATAR_GRADIENT_COUNT;
}

/** Primeira letra do apelido, em maiúsculo. Cai no `?` quando não há apelido. */
export function avatarInitial(nickname: string | null): string {
  const trimmed = nickname?.trim() ?? '';
  return trimmed.length > 0 ? [...trimmed][0]!.toUpperCase() : '?';
}
