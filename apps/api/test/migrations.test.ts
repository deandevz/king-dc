import { execFile } from 'node:child_process';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import pg from 'pg';
import { afterAll, beforeAll, expect, inject, test } from 'vitest';
import { applyMigrations } from '../src/lib/migrations.js';

const run = promisify(execFile);
const require = createRequire(import.meta.url);
const apiRoot = fileURLToPath(new URL('..', import.meta.url));
const migrationsDir = fileURLToPath(new URL('../prisma/migrations', import.meta.url));

/** Banco vazio no mesmo container: o principal já foi migrado pelo CLI do Prisma. */
const FRESH_DB = 'kingdc_migrate_test';
let freshUrl: string;

beforeAll(async () => {
  const mainUrl = inject('databaseUrl');
  const admin = new pg.Client({ connectionString: mainUrl });
  await admin.connect();
  await admin.query(`DROP DATABASE IF EXISTS ${FRESH_DB}`);
  await admin.query(`CREATE DATABASE ${FRESH_DB}`);
  await admin.end();
  const url = new URL(mainUrl);
  url.pathname = `/${FRESH_DB}`;
  freshUrl = url.toString();
});

afterAll(async () => {
  const admin = new pg.Client({ connectionString: inject('databaseUrl') });
  await admin.connect();
  await admin.query(`DROP DATABASE IF EXISTS ${FRESH_DB} WITH (FORCE)`);
  await admin.end();
});

async function prismaStatus(databaseUrl: string): Promise<string> {
  const prismaCli = require.resolve('prisma/build/index.js');
  const { stdout } = await run(process.execPath, [prismaCli, 'migrate', 'status'], {
    cwd: apiRoot,
    env: { ...process.env, DATABASE_URL: databaseUrl },
  });
  return stdout;
}

test('num banco migrado pelo CLI do Prisma não há nada a aplicar e o checksum confere', async () => {
  await expect(applyMigrations(inject('databaseUrl'), migrationsDir)).resolves.toEqual([]);
});

test('num banco vazio aplica tudo, é idempotente e o CLI do Prisma reconhece o resultado', async () => {
  const first = await applyMigrations(freshUrl, migrationsDir);
  expect(first).toEqual(['20260901210757_init']);
  expect(await applyMigrations(freshUrl, migrationsDir)).toEqual([]);

  const client = new pg.Client({ connectionString: freshUrl });
  await client.connect();
  try {
    const tables = await client.query<{ tablename: string }>(
      "SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename",
    );
    expect(tables.rows.map((row) => row.tablename)).toEqual([
      'Channel',
      'Invite',
      'Session',
      'User',
      '_prisma_migrations',
    ]);
  } finally {
    await client.end();
  }

  expect(await prismaStatus(freshUrl)).toContain('Database schema is up to date');
});

test('migração aplicada com outro conteúdo é recusada, não silenciada', async () => {
  const client = new pg.Client({ connectionString: freshUrl });
  await client.connect();
  try {
    await client.query(`UPDATE "_prisma_migrations" SET "checksum" = repeat('0', 64)`);
    await expect(applyMigrations(freshUrl, migrationsDir)).rejects.toThrow('outro conteúdo');
  } finally {
    await client.end();
  }
});
