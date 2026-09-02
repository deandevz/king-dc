import { defineConfig } from 'prisma/config';
import { loadLocalEnv } from './src/lib/load-env.js';

loadLocalEnv();

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
    seed: 'tsx prisma/seed.ts',
  },
  datasource: {
    url: process.env.DATABASE_URL ?? '',
  },
});
