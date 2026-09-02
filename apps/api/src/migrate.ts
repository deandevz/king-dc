import { fileURLToPath } from 'node:url';
import { readEnv } from './env.js';
import { applyMigrations } from './lib/migrations.js';

/** Entrypoint do container: `node dist/migrate.js` antes de subir a API. */
const migrationsDir = fileURLToPath(new URL('../prisma/migrations', import.meta.url));
const applied = await applyMigrations(readEnv().DATABASE_URL, migrationsDir);
console.warn(
  applied.length === 0
    ? 'migrações: nada pendente'
    : `migrações aplicadas: ${applied.join(', ')}`,
);
