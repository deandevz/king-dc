import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

/**
 * Carrega o `.env` da raiz do monorepo quando ele existe (desenvolvimento local).
 * Em container as variáveis já vêm do ambiente, então a ausência do arquivo não é erro.
 */
export function loadLocalEnv(fromDir = process.cwd()): void {
  const candidates = [resolve(fromDir, '.env'), resolve(fromDir, '../../.env')];
  for (const file of candidates) {
    if (existsSync(file)) {
      process.loadEnvFile(file);
      return;
    }
  }
}
