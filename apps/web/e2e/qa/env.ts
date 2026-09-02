import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

/**
 * Chaves que o QA contra a stack real precisa do `.env` da raiz. Lidas sem imprimir e sem
 * dependência nova, no mesmo espírito de `../livekitEnv.ts`.
 */
export type QaEnv = {
  SEED_ADMIN_CODE: string;
  SEED_ADMIN_PASSWORD: string;
  WEB_HOST_PORT: string;
};

const KEYS: (keyof QaEnv)[] = ['SEED_ADMIN_CODE', 'SEED_ADMIN_PASSWORD', 'WEB_HOST_PORT'];

export function qaEnv(): QaEnv {
  const found: QaEnv = {
    SEED_ADMIN_CODE: process.env.SEED_ADMIN_CODE ?? '',
    SEED_ADMIN_PASSWORD: process.env.SEED_ADMIN_PASSWORD ?? '',
    WEB_HOST_PORT: process.env.WEB_HOST_PORT ?? '',
  };
  let raw: string;
  try {
    raw = readFileSync(resolve(process.cwd(), '../../.env'), 'utf8');
  } catch {
    return found;
  }
  for (const line of raw.split('\n')) {
    const match = /^\s*([A-Z_]+)\s*=\s*(.*?)\s*$/.exec(line);
    if (match === null) continue;
    const [, key, value] = match;
    if (key === undefined || value === undefined) continue;
    const known = KEYS.find((candidate) => candidate === key);
    if (known === undefined || found[known] !== '') continue;
    found[known] = value.replace(/^["']|["']$/g, '');
  }
  return found;
}

/** Origem do web da stack real (`docker compose up`), sem barra no fim. */
export function qaBaseUrl(env: QaEnv): string {
  return process.env.QA_BASE_URL ?? `http://localhost:${env.WEB_HOST_PORT || '3001'}`;
}

/** Os specs `@qa-real` só rodam quando pedidos: consomem a stack real e minutos do LiveKit. */
export const QA_REAL = process.env.QA_REAL === '1';
