import { createHash, randomUUID } from 'node:crypto';
import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import pg from 'pg';

/**
 * Aplica as migrações de `prisma/migrations` sem o CLI do Prisma, que custa ~230 MB na
 * imagem (Studio, PGlite, TypeScript, motores) só para rodar `migrate deploy` no boot.
 *
 * Compatível com a tabela `_prisma_migrations` do próprio Prisma: mesmo DDL, mesmo
 * checksum (sha256 do `migration.sql`), então `prisma migrate dev/status` em
 * desenvolvimento continuam enxergando o que foi aplicado aqui, e vice-versa.
 */

const TABLE = '"_prisma_migrations"';

const TABLE_DDL = `CREATE TABLE IF NOT EXISTS ${TABLE} (
  "id"                  VARCHAR(36) PRIMARY KEY NOT NULL,
  "checksum"            VARCHAR(64) NOT NULL,
  "finished_at"         TIMESTAMPTZ,
  "migration_name"      VARCHAR(255) NOT NULL,
  "logs"                TEXT,
  "rolled_back_at"      TIMESTAMPTZ,
  "started_at"          TIMESTAMPTZ NOT NULL DEFAULT now(),
  "applied_steps_count" INTEGER NOT NULL DEFAULT 0
)`;

type AppliedRow = {
  migration_name: string;
  checksum: string;
  finished_at: Date | null;
  rolled_back_at: Date | null;
};

function checksumOf(sql: string): string {
  return createHash('sha256').update(sql).digest('hex');
}

async function listMigrations(dir: string): Promise<string[]> {
  const entries = await readdir(dir, { withFileTypes: true });
  return entries
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();
}

/** Recusa continuar quando o banco discorda dos arquivos: é sinal de conserto manual. */
function assertConsistent(name: string, checksum: string, row: AppliedRow): void {
  if (row.rolled_back_at !== null) return;
  if (row.checksum !== checksum) {
    throw new Error(`migração ${name} já aplicada com outro conteúdo; não edite migrações aplicadas`);
  }
  if (row.finished_at === null) {
    throw new Error(`migração ${name} falhou numa tentativa anterior; resolva com "prisma migrate resolve"`);
  }
}

async function applyOne(client: pg.Client, name: string, sql: string): Promise<void> {
  await client.query('BEGIN');
  try {
    await client.query(sql);
    await client.query(
      `INSERT INTO ${TABLE} ("id", "checksum", "migration_name", "started_at", "finished_at", "applied_steps_count")
       VALUES ($1, $2, $3, now(), now(), 1)`,
      [randomUUID(), checksumOf(sql), name],
    );
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  }
}

/** Aplica o que falta, em ordem, uma transação por migração. Devolve os nomes aplicados. */
export async function applyMigrations(databaseUrl: string, migrationsDir: string): Promise<string[]> {
  const client = new pg.Client({ connectionString: databaseUrl });
  await client.connect();
  try {
    await client.query(TABLE_DDL);
    const { rows } = await client.query<AppliedRow>(
      `SELECT "migration_name", "checksum", "finished_at", "rolled_back_at" FROM ${TABLE}`,
    );
    const applied = new Map(rows.map((row) => [row.migration_name, row]));

    const done: string[] = [];
    for (const name of await listMigrations(migrationsDir)) {
      const sql = await readFile(join(migrationsDir, name, 'migration.sql'), 'utf8');
      const row = applied.get(name);
      if (row !== undefined) {
        assertConsistent(name, checksumOf(sql), row);
        if (row.rolled_back_at === null) continue;
      }
      await applyOne(client, name, sql);
      done.push(name);
    }
    return done;
  } finally {
    await client.end();
  }
}
