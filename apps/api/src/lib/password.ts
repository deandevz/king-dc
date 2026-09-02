import { randomBytes } from 'node:crypto';
import { hash, verify } from '@node-rs/argon2';
import type { Algorithm, Options } from '@node-rs/argon2';

/**
 * Argon2id com 64 MiB e 3 passes. `parallelism: 1` de propósito: o custo de memória é
 * por thread, e 64 MiB × 4 threads por login apertaria demais uma VPS de 4 GB.
 */
// `Algorithm` é um `const enum` ambiente: só existe em tipo, então o valor vai literal.
const ARGON2ID = 2 as Algorithm;

const ARGON2_OPTIONS: Options = {
  algorithm: ARGON2ID,
  memoryCost: 65536,
  timeCost: 3,
  parallelism: 1,
};

export function hashPassword(password: string): Promise<string> {
  return hash(password, ARGON2_OPTIONS);
}

/** Os parâmetros vêm dentro do próprio hash (formato PHC), então não se repetem aqui. */
export async function verifyPassword(passwordHash: string, password: string): Promise<boolean> {
  try {
    return await verify(passwordHash, password);
  } catch {
    // Hash corrompido no banco não deve virar 500: trata como senha errada.
    return false;
  }
}

let dummyHash: Promise<string> | null = null;

/**
 * Gasta o mesmo tempo de um Argon2 real quando o código não existe. Sem isso, "código
 * inexistente" responde na hora e "senha errada" demora, e o tempo vira um oráculo que
 * diz quais códigos estão em uso.
 */
export async function verifyDummyPassword(password: string): Promise<void> {
  dummyHash ??= hashPassword(randomBytes(24).toString('base64url'));
  await verifyPassword(await dummyHash, password);
}
