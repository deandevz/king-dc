import { randomInt } from 'node:crypto';
import { CODE_LENGTH, INVITE_ALPHABET, INVITE_TTL_DAYS } from '@kingdc/contracts';
import { USER_FOR_ME_SELECT } from './me.js';
import type { UserForMe } from './me.js';
import type { PrismaClient } from './prisma.js';

const DAY_MS = 24 * 60 * 60 * 1000;

/** Quantas vezes tentar de novo quando o código sorteado já existe. */
const MAX_CODE_ATTEMPTS = 10;

/** 6 caracteres do alfabeto de D2, sorteados com o gerador criptográfico do Node. */
export function generateInviteCode(): string {
  let code = '';
  for (let i = 0; i < CODE_LENGTH; i += 1) {
    code += INVITE_ALPHABET.charAt(randomInt(INVITE_ALPHABET.length));
  }
  return code;
}

export function inviteExpiry(from: Date = new Date()): Date {
  return new Date(from.getTime() + INVITE_TTL_DAYS * DAY_MS);
}

/**
 * O código também é login (decisão D1), então precisa ser único entre convites **e**
 * usuários — o admin do seed tem código sem convite correspondente.
 */
export async function reserveInviteCode(prisma: PrismaClient): Promise<string> {
  for (let attempt = 0; attempt < MAX_CODE_ATTEMPTS; attempt += 1) {
    const code = generateInviteCode();
    const [invite, user] = await Promise.all([
      prisma.invite.findUnique({ where: { code }, select: { code: true } }),
      prisma.user.findUnique({ where: { code }, select: { id: true } }),
    ]);
    if (invite === null && user === null) return code;
  }
  throw new Error('não consegui sortear um código de convite livre');
}

/**
 * Consome o convite e cria o usuário na mesma transação. O `usedAt: null` dentro do
 * `WHERE` do UPDATE é o que impede dois logins simultâneos de criarem duas contas com o
 * mesmo código: o segundo encontra a linha já marcada e afeta 0 linhas.
 */
export async function consumeInvite(
  prisma: PrismaClient,
  code: string,
  passwordHash: string,
): Promise<UserForMe | null> {
  return prisma.$transaction(async (tx) => {
    const claimed = await tx.invite.updateMany({
      where: { code, usedAt: null, expiresAt: { gt: new Date() } },
      data: { usedAt: new Date() },
    });
    if (claimed.count !== 1) return null;
    return tx.user.create({
      data: { code, passwordHash },
      select: USER_FOR_ME_SELECT,
    });
  });
}
