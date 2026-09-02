import { execFile } from 'node:child_process';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import { PostgreSqlContainer } from '@testcontainers/postgresql';
import type { TestProject } from 'vitest/node';

const run = promisify(execFile);
const require = createRequire(import.meta.url);
const apiRoot = fileURLToPath(new URL('..', import.meta.url));

declare module 'vitest' {
  interface ProvidedContext {
    databaseUrl: string;
  }
}

/** Chama o CLI do Prisma pelo entrypoint JS: `pnpm` não existe no PATH de um spawn direto. */
async function migrate(databaseUrl: string): Promise<void> {
  const prismaCli = require.resolve('prisma/build/index.js');
  await run(process.execPath, [prismaCli, 'migrate', 'deploy'], {
    cwd: apiRoot,
    env: { ...process.env, DATABASE_URL: databaseUrl },
  });
}

/**
 * Sobe um Postgres efêmero para a rodada inteira e aplica as migrações reais.
 * Isolado do banco de desenvolvimento de propósito: teste não suja dado de dev.
 */
export default async function setup(project: TestProject): Promise<() => Promise<void>> {
  const container = await new PostgreSqlContainer('postgres:18-alpine')
    .withDatabase('kingdc_test')
    .withUsername('kingdc')
    .withPassword('kingdc')
    .start();

  const databaseUrl = container.getConnectionUri();
  await migrate(databaseUrl);
  project.provide('databaseUrl', databaseUrl);

  return async () => {
    await container.stop();
  };
}
