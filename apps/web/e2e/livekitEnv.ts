import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

export type LiveKitEnv = {
  LIVEKIT_URL: string;
  LIVEKIT_API_KEY: string;
  LIVEKIT_API_SECRET: string;
};

const KEYS: (keyof LiveKitEnv)[] = ['LIVEKIT_URL', 'LIVEKIT_API_KEY', 'LIVEKIT_API_SECRET'];

/**
 * O Playwright não carrega `.env`. Lemos só as três chaves do LiveKit do `.env` da raiz do
 * monorepo, sem imprimi-las e sem dependência nova. Usado pelo `playwright.config.ts` (que
 * repassa as chaves ao mock) e pelos specs que só fazem sentido com um LiveKit de verdade.
 */
export function livekitEnv(): LiveKitEnv {
  const found: LiveKitEnv = {
    LIVEKIT_URL: process.env.LIVEKIT_URL ?? '',
    LIVEKIT_API_KEY: process.env.LIVEKIT_API_KEY ?? '',
    LIVEKIT_API_SECRET: process.env.LIVEKIT_API_SECRET ?? '',
  };
  if (found.LIVEKIT_URL !== '') return found;

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
    if (known === undefined) continue;
    found[known] = value.replace(/^["']|["']$/g, '');
  }
  return found;
}

/** `true` quando dá para emitir token de verdade: sem isso os specs de sala real são pulados. */
export function hasLiveKit(env: LiveKitEnv): boolean {
  return env.LIVEKIT_URL !== '' && env.LIVEKIT_API_KEY !== '' && env.LIVEKIT_API_SECRET !== '';
}
