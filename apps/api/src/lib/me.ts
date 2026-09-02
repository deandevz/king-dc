import type { Me } from '@kingdc/contracts';

/** Campos do usuário que a API expõe. É o shape do `SessionUser` e da linha do banco. */
export type UserForMe = {
  id: string;
  code: string;
  nickname: string | null;
  avatarUpdatedAt: Date | null;
  isAdmin: boolean;
};

/** `select` do Prisma que devolve exatamente um `UserForMe`. */
export const USER_FOR_ME_SELECT = {
  id: true,
  code: true,
  nickname: true,
  avatarUpdatedAt: true,
  isAdmin: true,
} as const;

/**
 * `/avatars/<id>.webp?v=<epoch ms>` (decisão D13). O `?v=` é o que quebra o cache
 * imutável quando a pessoa troca de foto.
 */
export function avatarUrlFor(userId: string, avatarUpdatedAt: Date | null): string | null {
  if (avatarUpdatedAt === null) return null;
  return `/avatars/${userId}.webp?v=${avatarUpdatedAt.getTime()}`;
}

export function toMe(user: UserForMe): Me {
  return {
    id: user.id,
    code: user.code,
    nickname: user.nickname,
    avatarUrl: avatarUrlFor(user.id, user.avatarUpdatedAt),
    isAdmin: user.isAdmin,
  };
}
